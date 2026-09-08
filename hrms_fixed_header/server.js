const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const dataStore = require('./lib/dataStore');
const reportDefs = require('./lib/reportDefs');
const builder = require('./lib/builder');
const copilot = require('./lib/copilot');
const { toCsv } = require('./lib/csv');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');


// ---------------------------------------------------------------------------
// Demo authentication / RBAC
// ---------------------------------------------------------------------------
// Credentials are intentionally demo-only. Replace with database-backed
// identity provider (OIDC/SSO) before production deployment.
const USERS = {
  'ceo@soxibeta.com': { password: 'ceo2026', role: 'cxo', name: 'CEO Executive Suite' },
  'chro@soxibeta.com': { password: 'chro2026', role: 'chro', name: 'Chief Human Resources Officer' },
  'hrbp@soxibeta.com': { password: 'hrbp2026', role: 'hrbp', name: 'Sales HR Business Partner' },
  'manager@soxibeta.com': { password: 'manager2026', role: 'manager', name: 'Operations / Engineering Lead' },
  'employee@soxibeta.com': { password: 'employee2026', role: 'employee', name: 'Individual Contributor' }
};
const sessions = new Map();
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_FILE = path.join(__dirname, 'data', '.sessions.json');

// Persist demo sessions so a browser refresh (and even a server restart)
// does not unexpectedly sign the active user out.
function loadSessions() {
  try {
    if (!fs.existsSync(SESSION_FILE)) return;
    const saved = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
    const now = Date.now();
    Object.entries(saved).forEach(([token, session]) => {
      if (session && session.email && session.expiresAt > now && USERS[session.email]) {
        sessions.set(token, session);
      }
    });
  } catch (err) {
    console.warn('Could not restore persisted sessions:', err.message);
  }
}

function persistSessions() {
  try {
    const dir = path.dirname(SESSION_FILE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify(Object.fromEntries(sessions), null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist sessions:', err.message);
  }
}

loadSessions();

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(header.split(';').filter(Boolean).map(part => {
    const i = part.indexOf('=');
    return [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())];
  }));
}

function createSession(email) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { email, createdAt: Date.now(), expiresAt: Date.now() + SESSION_TTL_MS });
  persistSessions();
  return token;
}

function getAuthenticatedUser(req) {
  const token = parseCookies(req).hrms_session;
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    if (session) { sessions.delete(token); persistSessions(); }
    return null;
  }
  const user = USERS[session.email];
  if (!user) return null;
  return { email: session.email, ...user };
}

function requireAuth(req, res) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    sendJson(res, 401, { error: 'Authentication required', redirect: '/login.html' });
    return null;
  }
  return user;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  });
  res.end(JSON.stringify(data));
}

function sendCsv(res, filename, csvString) {
  res.writeHead(200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}.csv"`,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  });
  res.end(csvString);
}

function sendError(res, statusCode, message, details = null) {
  sendJson(res, statusCode, { error: message, details });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 2e6) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, pathname) {
  let relativePath = pathname === '/' ? 'index.html' : pathname;
  const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendError(res, 403, 'Forbidden');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return sendError(res, 404, 'File Not Found');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'public, max-age=3600'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method.toUpperCase();
  const requestedRole = parsedUrl.query.role || req.headers['x-role'] || 'cxo';
  const publicPath = pathname === '/' || pathname === '/login.html' || pathname === '/styles.css' || pathname === '/login.css' || pathname === '/app.js';
  const authUser = getAuthenticatedUser(req);
  const role = authUser ? authUser.role : requestedRole;

  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Role'
    });
    return res.end();
  }

  try {
    // Authentication
    if (method === 'POST' && pathname === '/api/login') {
      const body = await parseBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const user = USERS[email];
      if (!user || user.password !== password) {
        return sendError(res, 401, 'Invalid email or password');
      }
      const token = createSession(email);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': `hrms_session=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`
      });
      return res.end(JSON.stringify({ authenticated: true, user: { email, role: user.role, name: user.name } }));
    }

    if (method === 'POST' && pathname === '/api/logout') {
      const token = parseCookies(req).hrms_session;
      if (token) { sessions.delete(token); persistSessions(); }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Set-Cookie': 'hrms_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'
      });
      return res.end(JSON.stringify({ loggedOut: true }));
    }

    if (method === 'GET' && pathname === '/api/me') {
      const user = requireAuth(req, res);
      if (!user) return;
      return sendJson(res, 200, { authenticated: true, user: { email: user.email, role: user.role, name: user.name } });
    }

    // Protect all application APIs.
    if (pathname.startsWith('/api/')) {
      const user = requireAuth(req, res);
      if (!user) return;
    }

    // 1. GET /api/meta
    if (method === 'GET' && pathname === '/api/meta') {
      const meta = dataStore.getMeta(role);
      return sendJson(res, 200, meta);
    }

    // 2. GET /api/kpis?role=<role>
    if (method === 'GET' && pathname === '/api/kpis') {
      const kpis = dataStore.getKpis(role);
      return sendJson(res, 200, kpis);
    }

    // 3. GET /api/charts/headcount-trend
    if (method === 'GET' && pathname === '/api/charts/headcount-trend') {
      const data = dataStore.getHeadcountTrend(role);
      return sendJson(res, 200, data);
    }

    // 4. GET /api/charts/attrition-by-dept
    if (method === 'GET' && pathname === '/api/charts/attrition-by-dept') {
      const data = dataStore.getAttritionByDept(role);
      return sendJson(res, 200, data);
    }

    // 5. GET /api/charts/gender-mix
    if (method === 'GET' && pathname === '/api/charts/gender-mix') {
      const data = dataStore.getGenderMix(role);
      return sendJson(res, 200, data);
    }

    if (method === 'GET' && pathname === '/api/charts/recruitment-funnel') {
      const data = dataStore.getRecruitmentFunnel(role);
      return sendJson(res, 200, data);
    }

    // 6. GET /api/reports?category=<name|All>&role=<role>
    if (method === 'GET' && pathname === '/api/reports') {
      const category = parsedUrl.query.category || 'All';
      const catalog = reportDefs.getReportCatalog(category, role);
      return sendJson(res, 200, catalog);
    }

    // 7. GET /api/reports/:id/data
    // Return role-scoped report data for dashboard visualizations.
    const reportDataMatch = pathname.match(/^\/api\/reports\/([a-zA-Z0-9_-]+)\/data$/);
    if (method === 'GET' && reportDataMatch) {
      const reportId = reportDataMatch[1];
      const report = reportDefs.getReportById(reportId);
      if (!report) return sendError(res, 404, `Report ID '${reportId}' was not found in the catalog.`);
      const normalizedRole = (role || 'cxo').toLowerCase();
      if (report.allowedRoles && !report.allowedRoles.includes(normalizedRole)) {
        return sendJson(res, 403, { ok: false, reportId: report.id, reportName: report.name, status: 'RESTRICTED' });
      }
      const data = reportDefs.getReportData(reportId, normalizedRole);
      return sendJson(res, 200, { reportId: report.id, reportName: report.name, category: report.cat, ...data });
    }

    // 7. GET /api/reports/:id/validate
    // Check the selected report's CSV generator before allowing download.
    const reportValidateMatch = pathname.match(/^\/api\/reports\/([a-zA-Z0-9_-]+)\/validate$/);
    if (method === 'GET' && reportValidateMatch) {
      const reportId = reportValidateMatch[1];
      const report = reportDefs.getReportById(reportId);

      if (!report) {
        return sendError(res, 404, `Report ID '${reportId}' was not found in the catalog.`);
      }

      const normalizedRole = (role || 'cxo').toLowerCase();
      if (report.allowedRoles && !report.allowedRoles.includes(normalizedRole)) {
        return sendJson(res, 403, {
          ok: false,
          reportId: report.id,
          reportName: report.name,
          status: 'RESTRICTED',
          message: `Role ${normalizedRole.toUpperCase()} is not authorized for this report.`,
          allowedRoles: report.allowedRoles
        });
      }

      try {
        const generated = report.generator(normalizedRole);
        const columns = Array.isArray(generated.columns) ? generated.columns : [];
        const rows = Array.isArray(generated.rows) ? generated.rows : [];

        const validColumns = columns.length > 0 &&
          columns.every(column => column && column.key && column.label);
        const validRows = rows.every(row => row && typeof row === 'object' && !Array.isArray(row));

        if (!validColumns || !validRows) {
          return sendJson(res, 200, {
            ok: false,
            reportId: report.id,
            reportName: report.name,
            category: report.cat,
            status: 'ERROR',
            message: !validColumns
              ? 'The report did not generate valid CSV columns.'
              : 'The report generated invalid CSV row data.',
            columnCount: columns.length,
            rowCount: rows.length
          });
        }

        // Run the real CSV serializer as a final validation without downloading.
        const csvData = toCsv(columns, rows);
        if (typeof csvData !== 'string' || csvData.trim() === '') {
          return sendJson(res, 200, {
            ok: false,
            reportId: report.id,
            reportName: report.name,
            category: report.cat,
            status: 'ERROR',
            message: 'CSV generation returned empty data.',
            columnCount: columns.length,
            rowCount: rows.length
          });
        }

        return sendJson(res, 200, {
          ok: true,
          reportId: report.id,
          reportName: report.name,
          category: report.cat,
          format: report.fmt,
          status: 'READY',
          message: 'CSV can be generated successfully.',
          columnCount: columns.length,
          rowCount: rows.length,
          columns: columns.map(column => column.label),
          // Send the complete generated dataset so the user can inspect
          // every CSV field as rows and columns before downloading.
          previewRows: rows.map(row => columns.map(column => {
            const value = row[column.key];
            return value === null || value === undefined ? '' : value;
          }))
        });
      } catch (error) {
        console.error(`Report validation failed for ${report.name}:`, error);
        return sendJson(res, 200, {
          ok: false,
          reportId: report.id,
          reportName: report.name,
          category: report.cat,
          status: 'ERROR',
          message: error.message || 'CSV generation failed.'
        });
      }
    }

    // 8. GET /api/reports/:id/csv
    const reportCsvMatch = pathname.match(/^\/api\/reports\/([a-zA-Z0-9_-]+)\/csv$/);
    if (method === 'GET' && reportCsvMatch) {
      const reportId = reportCsvMatch[1];
      const report = reportDefs.getReportById(reportId);

      if (!report) {
        return sendError(res, 404, `Report ID '${reportId}' was not found in the catalog.`);
      }

      // Check RBAC permission
      const normalizedRole = role.toLowerCase();
      if (report.allowedRoles && !report.allowedRoles.includes(normalizedRole)) {
        dataStore.logAuditEvent({
          role: normalizedRole,
          action: 'ACCESS_DENIED',
          target: `Report ${report.id}: ${report.name}`,
          status: 'BLOCKED_RBAC'
        });
        return sendError(res, 403, `Access Denied: Your role (${role.toUpperCase()}) is not authorized to generate '${report.name}'.`);
      }

      const { columns, rows } = report.generator(role);
      const csvData = toCsv(columns, rows);
      const safeFilename = report.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

      dataStore.logAuditEvent({
        role: normalizedRole,
        action: 'DOWNLOAD_REPORT_CSV',
        target: `Report ${report.id}: ${report.name}`,
        recordCount: rows.length,
        status: 'SUCCESS'
      });

      return sendCsv(res, safeFilename, csvData);
    }

    // 9. GET /api/builder/fields
    if (method === 'GET' && pathname === '/api/builder/fields') {
      const fields = builder.getFieldCatalogForRole(role);
      return sendJson(res, 200, fields);
    }

    // 9. POST /api/builder/preview
    if (method === 'POST' && pathname === '/api/builder/preview') {
      const body = await parseBody(req);
      const userRole = body.role || role;
      const preview = builder.getPreview(body.fields, body.filters, userRole);
      return sendJson(res, 200, preview);
    }

    // 10. POST /api/builder/csv
    if (method === 'POST' && pathname === '/api/builder/csv') {
      const body = await parseBody(req);
      const userRole = body.role || role;
      const csvData = builder.getCsv(body.fields, body.filters, userRole);
      const filename = body.name ? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') : 'custom_report';
      return sendCsv(res, filename, csvData);
    }

    // 11. POST /api/builder/save
    if (method === 'POST' && pathname === '/api/builder/save') {
      const body = await parseBody(req);
      if (!body.name) return sendError(res, 400, 'Report name is required');
      const saved = builder.saveCustomReport(body, role);
      return sendJson(res, 201, saved);
    }

    // 12. GET /api/builder/saved
    if (method === 'GET' && pathname === '/api/builder/saved') {
      const list = builder.getCustomReports();
      return sendJson(res, 200, list);
    }

    // 13. POST /api/copilot
    if (method === 'POST' && pathname === '/api/copilot') {
      const body = await parseBody(req);
      const question = body.question || '';
      const userRole = body.role || role;
      const response = copilot.answerQuestion(question, userRole);
      return sendJson(res, 200, response);
    }

    // 14. GET /api/schedules
    if (method === 'GET' && pathname === '/api/schedules') {
      const list = dataStore.getSchedules();
      return sendJson(res, 200, list);
    }

    // 15. POST /api/schedules
    if (method === 'POST' && pathname === '/api/schedules') {
      const body = await parseBody(req);
      const newJob = dataStore.saveSchedule({ ...body, role });
      return sendJson(res, 201, newJob);
    }

    // 16. GET /api/audit-log
    if (method === 'GET' && pathname === '/api/audit-log') {
      const logs = dataStore.getAuditLog();
      return sendJson(res, 200, logs);
    }

    // Static Assets
    if (method === 'GET') {
      if (pathname === '/' || pathname === '/dashboard') {
        return serveStatic(req, res, authUser ? '/index.html' : '/login.html');
      }
      return serveStatic(req, res, pathname);
    }

    return sendError(res, 404, 'Endpoint Not Found');
  } catch (err) {
    console.error('Server error:', err);
    return sendError(res, 500, 'Internal Server Error', err.message);
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`  HRMS — Enterprise Human Resource Management System v2.0`);
  console.log(`  Running on http://localhost:${PORT}`);
  console.log(`  Enterprise RBAC | 21 Executable Reports | Zero Dependencies`);
  console.log(`======================================================\n`);
});
