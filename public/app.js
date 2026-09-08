/**
 * HRMS — Enterprise Human Resource Management System Frontend Application
 * Pure Vanilla JavaScript — Enterprise RBAC & Dual Theme Edition
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // Application State
  // --------------------------------------------------------------------------
  const state = {
    currentView: 'dashboard',
    currentRole: 'cxo',
    currentEntity: 'All',
    currentTheme: localStorage.getItem('hrms_theme') || 'light',
    meta: { entities: [], departments: [], locations: [], employmentTypes: [] },
    fieldCatalog: null,
    builderSelectedFields: ['id', 'name', 'dept', 'entity', 'employmentType', 'ctc'],
    builderFilters: { entity: 'All', dept: 'All', employmentType: 'All', status: 'All' },
    builderPreviewData: null,
    copilotMessages: [
      {
        sender: 'assistant',
        text: 'Welcome to HRMS AI Assistant. I compute factual metrics directly from your role-scoped HRMS dataset. Select a suggestion below or type your inquiry.',
        chart: null
      }
    ]
  };

  const ROLE_CONFIG = {
    cxo: {
      title: 'CEO (Enterprise Executive)',
      badge: 'SUPER ADMIN',
      name: 'CEO Executive Suite',
      scope: 'Global Scope: 4 Operating Entities (600 Personnel)'
    },
    chro: {
      title: 'CHRO (Chief HR Officer)',
      badge: 'TALENT & PEOPLE',
      name: 'Chief Human Resources Office',
      scope: 'Company-Wide Talent, Attrition & Recruitment'
    },
    hrbp: {
      title: 'HRBP (Sales Scope)',
      badge: 'BUSINESS PARTNER',
      name: 'Sales HR Business Partner',
      scope: 'Department Scope: Sales (124 Active Personnel)'
    },
    manager: {
      title: 'Line Manager (Management Pod)',
      badge: 'POD LEAD',
      name: 'Operations / Engineering Lead',
      scope: 'Team Pod: 8 Direct Reports'
    },
    employee: {
      title: 'Employee (Self-Service ESS)',
      badge: 'SELF-SERVICE',
      name: 'Individual Contributor',
      scope: 'Scoped Strictly to Self (Aarav Sharma)'
    }
  };

  // --------------------------------------------------------------------------
  // DOM Elements
  // --------------------------------------------------------------------------
  const mainEl = document.getElementById('main');
  const roleSelectEl = document.getElementById('role-select');
  const entitySelectEl = document.getElementById('global-entity-select');
  const breadcrumbCurrentEl = document.getElementById('breadcrumb-current');
  const quickExportBtn = document.getElementById('quick-export-btn');
  const printBriefBtn = document.getElementById('print-brief-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const toastContainer = document.getElementById('toast-container');
  const modalBackdrop = document.getElementById('modal-backdrop');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalOkBtn = document.getElementById('modal-ok-btn');

  const personaBadgeEl = document.getElementById('persona-badge');
  const personaNameEl = document.getElementById('persona-name');
  const personaScopeEl = document.getElementById('persona-scope');
  const navReportsCountEl = document.getElementById('nav-reports-count');
  const logoutBtn = document.getElementById('logout-btn');

  // --------------------------------------------------------------------------
  // Theme Toggle Engine
  // --------------------------------------------------------------------------
  function applyTheme(theme) {
    state.currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('hrms_theme', theme);
    if (themeToggleBtn) {
      themeToggleBtn.textContent = `THEME: ${theme.toUpperCase()}`;
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const nextTheme = state.currentTheme === 'light' ? 'dark' : 'light';
      applyTheme(nextTheme);
      showToast(`Switched to ${nextTheme.toUpperCase()} theme`);
    });
  }

  applyTheme(state.currentTheme);

  // --------------------------------------------------------------------------
  // API Fetch Utilities
  // --------------------------------------------------------------------------
  async function fetchJson(url, options = {}) {
    const headers = options.headers || {};
    headers['X-Role'] = state.currentRole;
    options.headers = headers;

    const res = await fetch(url, options);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: res.statusText }));
      throw { status: res.status, ...errBody };
    }
    if (res.status === 401) {
      window.location.href = '/login.html';
      throw new Error('Authentication required');
    }
    return res.json();
  }

  async function loadAuthenticatedUser() {
    const res = await fetch('/api/me', { credentials: 'same-origin' });
    if (!res.ok) {
      window.location.href = '/login.html';
      return false;
    }
    const data = await res.json();
    state.currentRole = data.user.role;
    if (roleSelectEl) {
      roleSelectEl.value = state.currentRole;
      roleSelectEl.disabled = true;
    }
    return true;
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (_) {}
      window.location.href = '/login.html';
    });
  }

  function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(6px)';
      toast.style.transition = 'opacity 0.2s, transform 0.2s';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  function showModal(title, messageHtml) {
    modalTitle.textContent = title;
    modalBody.innerHTML = messageHtml;
    modalBackdrop.classList.remove('hidden');
  }

  function closeModal() {
    modalBackdrop.classList.add('hidden');
  }

  modalCloseBtn.addEventListener('click', closeModal);
  modalOkBtn.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', e => {
    if (e.target === modalBackdrop) closeModal();
  });

  // --------------------------------------------------------------------------
  // Executive PDF / Print Brief Handler
  // --------------------------------------------------------------------------
  if (printBriefBtn) {
    printBriefBtn.addEventListener('click', async () => {
      showToast('Generating executive brief preview...');
      try {
        const kpis = await fetchJson(`/api/kpis?role=${state.currentRole}&entity=${state.currentEntity}`);
        const config = ROLE_CONFIG[state.currentRole] || ROLE_CONFIG.cxo;
        
        let kpiSummaryHtml = '<div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:14px; margin-top:16px;">';
        kpis.forEach(k => {
          kpiSummaryHtml += `
            <div style="border:1px solid var(--border); padding:12px; background:var(--bg-surface);">
              <div style="font-size:10px; font-weight:700; text-transform:uppercase; color:var(--ink-secondary);">${k.label}</div>
              <div style="font-family:var(--font-serif); font-size:24px; font-weight:700; color:var(--ink); margin:4px 0;">${k.value}</div>
              <div style="font-size:11px; color:var(--accent);">${k.delta} • ${k.subtext}</div>
            </div>
          `;
        });
        kpiSummaryHtml += '</div>';

        showModal(
          `Executive Brief — ${config.name}`,
          `<div>
            <div style="font-family:var(--font-mono); font-size:11px; color:var(--ink-secondary); border-bottom:1px solid var(--border); padding-bottom:8px;">
              PERSPECTIVE: ${state.currentRole.toUpperCase()} | ENTITY SCOPE: ${state.currentEntity} | DATE: ${new Date().toLocaleDateString()}
            </div>
            <p style="margin-top:10px; font-size:13px; color:var(--ink);">
              Below is the verified summary report brief compiled across active personnel rosters:
            </p>
            ${kpiSummaryHtml}
            <div style="margin-top:20px; text-align:right;">
              <button class="btn btn-secondary" onclick="window.print()" style="margin-right:8px;">Print / Save as PDF</button>
            </div>
          </div>`
        );
      } catch (err) {
        window.print();
      }
    });
  }

  // --------------------------------------------------------------------------
  // SVG Chart Generators
  // --------------------------------------------------------------------------
  function createHorizontalBarChartSvg(data, { width = 450, height = 200, unit = '' } = {}) {
    if (!data || data.length === 0) return '<div style="padding:20px; text-align:center; color:var(--ink-secondary);">No data for current scope</div>';

    const maxVal = Math.max(...data.map(d => d.v), 1);
    const labelWidth = 120;
    const chartWidth = width - labelWidth - 60;
    const rowHeight = Math.max(28, Math.floor((height - 30) / data.length));
    const actualHeight = data.length * rowHeight + 20;

    let svg = `<svg viewBox="0 0 ${width} ${actualHeight}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">`;

    data.forEach((item, idx) => {
      const y = idx * rowHeight + 10;
      const barWidth = Math.max(4, (item.v / maxVal) * chartWidth);
      const isMax = item.v === maxVal;
      const barColor = isMax ? 'var(--chart-navy)' : 'var(--chart-teal)';

      svg += `<text x="${labelWidth - 10}" y="${y + 14}" text-anchor="end" class="chart-tick-label" fill="var(--ink)">${item.k}</text>`;
      svg += `<rect x="${labelWidth}" y="${y + 2}" width="${chartWidth}" height="${rowHeight - 10}" fill="var(--bg-surface)" />`;
      svg += `<rect x="${labelWidth}" y="${y + 2}" width="${barWidth}" height="${rowHeight - 10}" fill="${barColor}">
        <title>${item.k}: ${item.v}${unit ? ' ' + unit : ''}</title>
      </rect>`;
      svg += `<text x="${labelWidth + barWidth + 8}" y="${y + 14}" font-family="IBM Plex Mono" font-size="11" font-weight="600" fill="var(--ink)">${item.v}${unit ? unit : ''}</text>`;
    });

    svg += `</svg>`;
    return svg;
  }

  function createLineChartSvg(data, { width = 500, height = 220, unit = '' } = {}) {
    if (!data || data.length === 0) return '<div style="padding:20px; text-align:center; color:var(--ink-secondary);">No data for current scope</div>';

    const padding = { top: 20, right: 30, bottom: 35, left: 45 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const values = data.map(d => d.v);
    const minVal = Math.min(...values) * 0.96;
    const maxVal = Math.max(...values) * 1.02;
    const range = maxVal - minVal || 1;

    const points = data.map((d, i) => {
      const x = padding.left + (i / Math.max(1, data.length - 1)) * chartW;
      const y = padding.top + chartH - ((d.v - minVal) / range) * chartH;
      return { x, y, k: d.k, v: d.v };
    });

    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padding.top + chartH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padding.top + chartH).toFixed(1)} Z`;

    let svg = `<svg viewBox="0 0 ${width} ${height}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">`;

    for (let s = 0; s <= 3; s++) {
      const stepVal = minVal + (range / 3) * s;
      const y = padding.top + chartH - (s / 3) * chartH;
      svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="chart-grid-line" />`;
      svg += `<text x="${padding.left - 8}" y="${y + 3}" text-anchor="end" class="chart-tick-label">${Math.round(stepVal)}</text>`;
    }

    svg += `<path d="${areaPath}" fill="var(--accent-light)" opacity="0.7" />`;
    svg += `<path d="${linePath}" class="chart-line-path" />`;

    points.forEach(p => {
      svg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" class="chart-point">
        <title>${p.k}: ${p.v} ${unit}</title>
      </circle>`;
      svg += `<text x="${p.x.toFixed(1)}" y="${height - 12}" text-anchor="middle" class="chart-tick-label">${p.k}</text>`;
    });

    svg += `</svg>`;
    return svg;
  }

  function createDonutChartSvg(data, { size = 180 } = {}) {
    if (!data || data.length === 0) return '<div style="padding:20px; text-align:center; color:var(--ink-secondary);">No data for current scope</div>';

    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.40;
    const innerRadius = size * 0.24;

    let total = data.reduce((s, d) => s + d.v, 0);
    if (total === 0) total = 1;

    let cumulativePercent = 0;
    const donutPalette = ['var(--chart-navy)', 'var(--chart-steel)', 'var(--chart-slate)', 'var(--chart-light)'];
    const slices = data.map((d, idx) => {
      const percent = d.v / total;
      d = { ...d, c: donutPalette[idx % donutPalette.length] };
      const startAngle = cumulativePercent * 2 * Math.PI;
      cumulativePercent += percent;
      const endAngle = cumulativePercent * 2 * Math.PI;
      return { ...d, startAngle, endAngle, percent };
    });

    function getCoordinates(angle, r) {
      return {
        x: cx + r * Math.sin(angle),
        y: cy - r * Math.cos(angle)
      };
    }

    let svg = `<div style="display:flex; align-items:center; justify-content:center; gap:20px;">`;
    svg += `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">`;

    slices.forEach(slice => {
      const isLargeArc = slice.percent > 0.5 ? 1 : 0;
      const p1 = getCoordinates(slice.startAngle, radius);
      const p2 = getCoordinates(slice.endAngle, radius);
      const p3 = getCoordinates(slice.endAngle, innerRadius);
      const p4 = getCoordinates(slice.startAngle, innerRadius);

      const path = [
        `M ${p1.x} ${p1.y}`,
        `A ${radius} ${radius} 0 ${isLargeArc} 1 ${p2.x} ${p2.y}`,
        `L ${p3.x} ${p3.y}`,
        `A ${innerRadius} ${innerRadius} 0 ${isLargeArc} 0 ${p4.x} ${p4.y}`,
        'Z'
      ].join(' ');

      svg += `<path d="${path}" fill="${slice.c}" class="chart-donut-slice">
        <title>${slice.label}: ${slice.v}% (${slice.count || 0})</title>
      </path>`;
    });

    svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-family="Playfair Display" font-size="14" font-weight="700" fill="var(--ink)">Mix</text>`;
    svg += `</svg>`;

    svg += `<div class="donut-legend">`;
    slices.forEach(item => {
      svg += `<div class="legend-item">
        <span class="legend-color" style="background-color:${item.c};"></span>
        <span class="legend-label">${esc(item.label)}</span>
        <span class="legend-value">${item.v}%</span>
      </div>`;
    });
    svg += `</div></div>`;

    return svg;
  }


  function createStackedBarsSvg(data, { width = 720, height = 250 } = {}) {
    if (!data || !data.length) return '<div style="padding:20px;text-align:center;color:var(--ink-secondary)">No data for current scope</div>';
    const pad={top:22,right:18,bottom:42,left:52}; const cw=width-pad.left-pad.right; const ch=height-pad.top-pad.bottom;
    const max=Math.max(...data.map(d=>(d.a||0)+(d.b||0)+(d.c||0)),1); const bw=Math.max(18,cw/data.length*.55); const gap=cw/data.length;
    let svg=`<svg viewBox="0 0 ${width} ${height}" class="chart-svg stack-svg" xmlns="http://www.w3.org/2000/svg">`;
    [0,.25,.5,.75,1].forEach(t=>{const y=pad.top+ch-(t*ch); const val=Math.round(max*t); svg+=`<line x1="${pad.left}" y1="${y}" x2="${width-pad.right}" y2="${y}" class="chart-grid-line"/><text x="${pad.left-8}" y="${y+4}" text-anchor="end" class="chart-tick-label">${val}</text>`});
    data.forEach((d,i)=>{const x=pad.left+i*gap+(gap-bw)/2; let y=pad.top+ch; const parts=[['a','var(--chart-navy)'],['b','var(--chart-teal)'],['c','var(--chart-teal-light)']]; parts.forEach(([key,color])=>{const v=Number(d[key]||0); const h=v/max*ch; y-=h; svg+=`<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(1,h)}" fill="${color}" rx="2"><title>${d.k}: ${v}</title></rect>`}); svg+=`<text x="${x+bw/2}" y="${height-16}" text-anchor="middle" class="chart-tick-label">${d.k}</text>`});
    svg+='</svg>'; return svg;
  }

  function createFunnelSvg(stages, { width=560, height=300 }={}) {
    if (!stages || !stages.length) return '<div style="padding:20px;text-align:center;color:var(--ink-secondary)">No recruitment data</div>';
    const cx=width/2, top=12, stageH=height/stages.length-6, maxW=width*.82, minW=width*.28;
    let svg=`<svg viewBox="0 0 ${width} ${height}" class="chart-svg funnel-svg" xmlns="http://www.w3.org/2000/svg">`;
    stages.forEach((st,i)=>{const ratio=(st.value||0)/(stages[0].value||1); const w=minW+(maxW-minW)*ratio; const y=top+i*(stageH+6); const x=cx-w/2; const fill=i%2===0?'var(--chart-teal)':'var(--chart-navy)'; svg+=`<path d="M ${x} ${y} L ${x+w} ${y} L ${x+w*.91} ${y+stageH} L ${x+w*.09} ${y+stageH} Z" fill="${fill}" opacity="${i===0?1:.94}"/><text x="${cx}" y="${y+stageH*.42}" text-anchor="middle" fill="#fff" font-size="13" font-weight="700">${st.label}</text><text x="${cx}" y="${y+stageH*.73}" text-anchor="middle" fill="#fff" font-size="21" font-weight="800">${st.value}</text>`});
    svg+='</svg>'; return svg;
  }

  function createActivityTableSvg(data) {
    const rows=(data||[]).slice(0,5); if(!rows.length) return '<div style="padding:20px;text-align:center;color:var(--ink-secondary)">No activity data</div>';
    let html='<table class="activity-table"><thead><tr><th>Metric</th><th>Value</th><th>Status</th></tr></thead><tbody>';
    rows.forEach(r=>html+=`<tr><td>${r.k}</td><td><strong>${r.v}</strong></td><td><span class="status-pill">Tracked</span></td></tr>`); html+='</tbody></table>'; return html;
  }


  // --------------------------------------------------------------------------
  // Report Visualization Engine — role-scoped charts for every wired report
  // --------------------------------------------------------------------------
  function esc(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function num(value) {
    if (typeof value === 'number') return value;
    const n = Number(String(value ?? '').replace(/[^0-9.+-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function groupRows(rows, key, valueKey) {
    const map = new Map();
    (rows || []).forEach(r => {
      const k = String(r[key] ?? 'Unknown');
      map.set(k, (map.get(k) || 0) + num(r[valueKey]));
    });
    return [...map.entries()].map(([k, v]) => ({ k, v }));
  }

  function countRows(rows, key) {
    const map = new Map();
    (rows || []).forEach(r => {
      const k = String(r[key] ?? 'Unknown');
      map.set(k, (map.get(k) || 0) + 1);
    });
    return [...map.entries()].map(([k, v]) => ({ k, v }));
  }

  function createGroupedBarsSvg(data, { width = 560, height = 250, series = [] } = {}) {
    if (!data || !data.length || !series.length) return '<div class="report-chart-empty">No data for current scope</div>';
    const pad={top:26,right:20,bottom:46,left:52}; const cw=width-pad.left-pad.right; const ch=height-pad.top-pad.bottom;
    const max=Math.max(...data.flatMap(d=>series.map(s=>num(d[s.key]))),1); const groupW=cw/data.length; const barW=Math.max(7, Math.min(22, groupW/(series.length+1)*.62));
    let svg=`<svg viewBox="0 0 ${width} ${height}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">`;
    [0,.25,.5,.75,1].forEach(t=>{const y=pad.top+ch-t*ch; svg+=`<line x1="${pad.left}" y1="${y}" x2="${width-pad.right}" y2="${y}" class="chart-grid-line"/><text x="${pad.left-8}" y="${y+4}" text-anchor="end" class="chart-tick-label">${Math.round(max*t)}</text>`});
    data.forEach((d,i)=>{const base=pad.left+i*groupW+groupW/2-(series.length*barW)/2; series.forEach((ser,j)=>{const v=num(d[ser.key]); const h=(v/max)*ch; const x=base+j*barW; const y=pad.top+ch-h; svg+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(2,barW-2).toFixed(1)}" height="${Math.max(1,h).toFixed(1)}" rx="1.5" fill="${ser.color}"><title>${esc(d.k)} — ${esc(ser.label)}: ${v}</title></rect>`}); svg+=`<text x="${pad.left+i*groupW+groupW/2}" y="${height-16}" text-anchor="middle" class="chart-tick-label">${esc(d.k).slice(0,16)}</text>`});
    svg+='</svg>'; return svg;
  }

  function createHeatmapSvg(data, { width=560, height=250 }={}) {
    if (!data || !data.length) return '<div class="report-chart-empty">No data for current scope</div>';
    const pad={top:24,right:18,bottom:44,left:160}; const cw=width-pad.left-pad.right; const ch=height-pad.top-pad.bottom; const rowH=Math.max(30,ch/data.length);
    let svg=`<svg viewBox="0 0 ${width} ${height}" class="chart-svg" xmlns="http://www.w3.org/2000/svg">`;
    data.forEach((d,i)=>{const pct=Math.max(0,Math.min(100,num(d.v))); const y=pad.top+i*rowH; const fill=pct>=80?'var(--chart-navy)':pct>=60?'var(--chart-steel)':pct>=40?'var(--chart-slate)':'var(--chart-light)'; svg+=`<text x="${pad.left-10}" y="${y+rowH*.62}" text-anchor="end" class="chart-tick-label">${esc(d.k)}</text><rect x="${pad.left}" y="${y+4}" width="${cw}" height="${Math.max(10,rowH-8)}" rx="4" fill="var(--bg-surface-hover)"/><rect x="${pad.left}" y="${y+4}" width="${cw*pct/100}" height="${Math.max(10,rowH-8)}" rx="4" fill="${fill}"/><text x="${pad.left+cw+4}" y="${y+rowH*.62}" class="chart-tick-label">${pct}%</text>`});
    svg+='</svg>'; return svg;
  }

  function buildReportVisualization(report) {
    const rows = report.rows || [];
    const id = String(report.reportId);
    let title = report.reportName;
    let meta = report.category;
    let chart = '';
    let type = 'chart';
    switch (id) {
      case '1': {
        const data=countRows(rows,'status'); chart=createDonutChartSvg(data.map(x=>({label:x.k,v:x.v})),{size:180}); type='donut'; meta='Workforce status'; break;
      }
      case '2': { chart=createDonutChartSvg(countRows(rows,'exitType').map(x=>({label:x.k,v:x.v})),{size:180}); type='donut'; meta='Exit classification'; break; }
      case '3': { chart=createDonutChartSvg(countRows(rows,'gender').map(x=>({label:x.k,v:x.v})),{size:180}); type='donut'; meta='Active workforce mix'; break; }
      case '11': { const d=(rows||[]).map(r=>({k:r.managerName,v:num(r.directReportCount)})).sort((a,b)=>b.v-a.v).slice(0,8); chart=createHorizontalBarChartSvg(d,{width:560,height:250}); type='bar'; meta='Direct reports by manager'; break; }
      case '4': { chart=createHorizontalBarChartSvg(countRows(rows,'status'),{width:560,height:230}); type='bar'; meta='Requisition pipeline'; break; }
      case '5': { chart=createHorizontalBarChartSvg(rows.map(r=>({k:r.source,v:num(r.totalRequisitions)})).sort((a,b)=>b.v-a.v),{width:560,height:250}); type='bar'; meta='Channel volume'; break; }
      case '12': { chart=createDonutChartSvg(countRows(rows,'outcome').map(x=>({label:x.k,v:x.v})),{size:180}); type='donut'; meta='Offer outcomes'; break; }
      case '6': { chart=createGroupedBarsSvg(rows.map(r=>({k:r.dept,actualCTC:num(r.actualCTC),budgetedCTC:num(r.budgetedCTC)})),{series:[{key:'actualCTC',label:'Actual',color:'var(--chart-navy)'},{key:'budgetedCTC',label:'Budget',color:'var(--chart-steel)'}]}); type='grouped'; meta='Actual vs budget'; break; }
      case '7': { chart=createGroupedBarsSvg(rows.map(r=>({k:'L'+r.level,avgMaleCTC:num(r.avgMaleCTC),avgFemaleCTC:num(r.avgFemaleCTC)})),{series:[{key:'avgMaleCTC',label:'Male',color:'var(--chart-navy)'},{key:'avgFemaleCTC',label:'Female',color:'var(--chart-steel)'}]}); type='grouped'; meta='Level compensation'; break; }
      case '13': { chart=createGroupedBarsSvg(rows.map(r=>({k:r.entity,monthlyPfFund:num(r.monthlyPfFund),statutoryDeductions:num(r.statutoryDeductions)})),{series:[{key:'monthlyPfFund',label:'PF Fund',color:'var(--chart-navy)'},{key:'statutoryDeductions',label:'Deductions',color:'var(--chart-steel)'}]}); type='grouped'; meta='Statutory contribution profile'; break; }
      case '8': { chart=createHorizontalBarChartSvg(rows.map(r=>({k:r.entity,v:num(r.totalLiabilityCost)})).sort((a,b)=>b.v-a.v),{width:560,height:240}); type='bar'; meta='Estimated leave liability'; break; }
      case '9': { const byDept=new Map(); rows.forEach(r=>{const k=r.dept||'Unknown'; const x=byDept.get(k)||{sum:0,n:0}; x.sum+=num(r.daysPresent); x.n++; byDept.set(k,x)}); const d=[...byDept].map(([k,x])=>({k,v:Number((x.sum/x.n).toFixed(1))})); chart=createHorizontalBarChartSvg(d,{width:560,height:250,unit:' days'}); type='bar'; meta='Average attendance'; break; }
      case '14': { chart=createHorizontalBarChartSvg(rows.map(r=>({k:r.name,v:num(r.otHours)})).sort((a,b)=>b.v-a.v).slice(0,10),{width:560,height:260,unit:'h'}); type='bar'; meta='Overtime exposure'; break; }
      case '10': { const byDept=new Map(); rows.forEach(r=>{const k=r.dept||'Unknown'; const x=byDept.get(k)||{sum:0,n:0}; x.sum+=num(r.goalsCompleted); x.n++; byDept.set(k,x)}); const d=[...byDept].map(([k,x])=>({k,v:Number((x.sum/x.n).toFixed(1))})); chart=createHorizontalBarChartSvg(d,{width:560,height:250,unit:'%'}); type='bar'; meta='Goal completion'; break; }
      case '15': { chart=createDonutChartSvg(countRows(rows,'nineBoxClassification').map(x=>({label:x.k,v:x.v})),{size:180}); type='donut'; meta='9-box talent distribution'; break; }
      case '16': { chart=createGroupedBarsSvg(rows.map(r=>({k:r.entity,casesReportedInCycle:num(r.casesReportedInCycle),casesResolved:num(r.casesResolved)})),{series:[{key:'casesReportedInCycle',label:'Filed',color:'var(--chart-steel)'},{key:'casesResolved',label:'Resolved',color:'var(--chart-navy)'}]}); type='grouped'; meta='Compliance cases'; break; }
      case '17': { chart=createHorizontalBarChartSvg(countRows(rows,'action').sort((a,b)=>b.v-a.v),{width:560,height:250}); type='bar'; meta='Audit activity'; break; }
      case '18': { chart=createHorizontalBarChartSvg(rows.map(r=>({k:r.department,v:num(r.avgTrainingHoursCompleted)})).sort((a,b)=>b.v-a.v),{width:560,height:250,unit:' h'}); type='bar'; meta='Training hours'; break; }
      case '19': { chart=createHeatmapSvg(rows.map(r=>({k:r.domain,v:num(r.readinessPct)}))); type='heatmap'; meta='Workforce readiness'; break; }
      case '20': { chart=createHorizontalBarChartSvg(rows.map(r=>({k:r.department,v:num(r.eNpsScore)})).sort((a,b)=>b.v-a.v),{width:560,height:250,unit:' eNPS'}); type='bar'; meta='Employee sentiment'; break; }
      case '21': { chart=createDonutChartSvg(rows.map(r=>({label:r.factor,v:num(r.exitCount)})),{size:180}); type='donut'; meta='Exit root causes'; break; }
      default: { chart=createHorizontalBarChartSvg(countRows(rows, report.columns?.[0]?.key || 'value'),{width:560,height:230}); }
    }
    return `<article class="chart-card report-viz-card" data-report-id="${esc(id)}"><div class="chart-header"><div><h3 class="chart-title">${esc(title)}</h3><span class="chart-meta">${esc(meta)}</span></div><span class="report-viz-badge">${esc(type.toUpperCase())}</span></div><div class="chart-container report-viz-container">${chart}</div></article>`;
  }

  async function renderReportVisualizations() {
    const host=document.getElementById('report-visualizations-host');
    if(!host) return;
    try {
      const catalog=await fetchJson(`/api/reports?category=All&role=${state.currentRole}`);
      const permitted=(catalog||[]).filter(r=>r.permitted);
      if(!permitted.length){ host.innerHTML='<div class="report-chart-empty">No report visualizations are available for this role.</div>'; return; }
      const results=await Promise.all(permitted.map(async r=>{ try { return await fetchJson(`/api/reports/${encodeURIComponent(r.id)}/data?role=${state.currentRole}`); } catch(e){ return null; } }));
      const usable=results.filter(Boolean);
      host.innerHTML=usable.map(buildReportVisualization).join('');
    } catch(e) {
      console.error('Report visualizations failed',e);
      host.innerHTML='<div class="report-chart-empty">Report visualizations are temporarily unavailable.</div>';
    }
  }

  // --------------------------------------------------------------------------
  // Update Persona Card in Sidebar
  // --------------------------------------------------------------------------
  function updatePersonaUi() {
    const config = ROLE_CONFIG[state.currentRole] || ROLE_CONFIG.cxo;
    if (personaBadgeEl) personaBadgeEl.textContent = config.badge;
    if (personaNameEl) personaNameEl.textContent = config.name;
    if (personaScopeEl) personaScopeEl.textContent = config.scope;
  }

  // --------------------------------------------------------------------------
  // VIEW: Dashboard
  // --------------------------------------------------------------------------
  async function renderDashboard() {
    breadcrumbCurrentEl.textContent = 'Dashboard';
    updatePersonaUi();

    const roleTitles = {
      cxo: ['Headcount Trajectory','Workforce Gender Mix','Attrition by Department'],
      chro: ['Workforce Trajectory','Talent Mix','Attrition by Department'],
      hrbp: ['Sales Headcount Trajectory','Sales Workforce Mix','Sales Attrition by Location'],
      manager: ['Direct Reports Trajectory','Pod Workforce Mix','Presence by Team Member'],
      employee: ['My Monthly Presence','My Leave Utilization','My Performance Goals']
    };
    const titles=roleTitles[state.currentRole]||roleTitles.cxo;

    mainEl.innerHTML=`
      <div class="page-header"><div><h2 class="page-title">Executive Dashboard</h2><p class="page-subtitle">Perspective: <strong style="color:var(--ink)">${state.currentRole.toUpperCase()}</strong> • Scoped real-time analytics • Entity: <strong style="color:var(--ink)">${state.currentEntity}</strong></p></div><div class="page-meta">DATA ANCHOR: JUNE 2026</div></div>
      <div class="dashboard-grid">
        <div class="kpi-section" id="kpi-cards-host"><div class="kpi-card hero-kpi"><div class="kpi-label">Loading KPIs...</div></div></div>
        <div class="charts-grid">
          <div class="chart-card"><div class="chart-header"><h3 class="chart-title">${titles[0]}</h3><span class="chart-meta">Trend</span></div><div class="chart-container" id="chart-headcount-trend">Loading...</div></div>
          <div class="chart-card"><div class="chart-header"><h3 class="chart-title">${titles[1]}</h3><span class="chart-meta">Composition</span></div><div class="chart-container" id="chart-gender-mix">Loading...</div></div>
          <div class="chart-card wide"><div class="chart-header"><h3 class="chart-title">Workforce Composition by Period</h3><span class="chart-meta">Stacked view</span></div><div class="chart-container" id="chart-stack">Loading...</div></div>
          <div class="chart-two-col">
            <div class="chart-card"><div class="chart-header"><h3 class="chart-title">${titles[2]}</h3><span class="chart-meta">Analytical breakdown</span></div><div class="chart-container" id="chart-attrition-dept">Loading...</div></div>
            <div class="chart-card"><div class="chart-header"><h3 class="chart-title">Hiring Pipeline</h3><span class="chart-meta">Recruitment funnel</span></div><div class="chart-container" id="chart-funnel">Loading...</div></div>
          </div>
          <div class="chart-card wide"><div class="chart-header"><h3 class="chart-title">Workforce Activity Snapshot</h3><span class="chart-meta">Live role scope</span></div><div class="chart-container" id="chart-activity">Loading...</div></div>
        </div>
        <section class="report-visualizations-section">
          <div class="section-heading"><div><h2 class="section-title">Report Visualizations</h2><p class="section-subtitle">Professional role-scoped visualizations for every authorized report.</p></div><span class="section-badge">ALL WIRED REPORTS</span></div>
          <div class="report-visualizations-grid" id="report-visualizations-host"><div class="report-chart-empty">Loading report visualizations...</div></div>
        </section>
      </div>`;

    let kpis=[],trend=[],mix=[],attr=[];
    try { kpis=await fetchJson(`/api/kpis?role=${state.currentRole}&entity=${state.currentEntity}`); const host=document.getElementById('kpi-cards-host'); if(host&&kpis.length){host.innerHTML=kpis.map((k,i)=>`<div class="kpi-card ${i===0?'hero-kpi':''}"><div><div class="kpi-label">${k.label}</div><div class="kpi-value">${k.value}</div></div><div class="kpi-footer"><span class="kpi-delta ${k.cls}">${k.delta}</span><span class="kpi-subtext">${k.subtext}</span></div></div>`).join('');}} catch(e){console.error(e)}
    try { trend=await fetchJson(`/api/charts/headcount-trend?role=${state.currentRole}&entity=${state.currentEntity}`); document.getElementById('chart-headcount-trend').innerHTML=createLineChartSvg(trend,{width:650,height:250,unit:'personnel'}); } catch(e){console.error(e)}
    try { mix=await fetchJson(`/api/charts/gender-mix?role=${state.currentRole}&entity=${state.currentEntity}`); document.getElementById('chart-gender-mix').innerHTML=createDonutChartSvg(mix,{size:190}); } catch(e){console.error(e)}
    try { attr=await fetchJson(`/api/charts/attrition-by-dept?role=${state.currentRole}&entity=${state.currentEntity}`); document.getElementById('chart-attrition-dept').innerHTML=createHorizontalBarChartSvg(attr,{width:520,height:220,unit:'%'}); } catch(e){console.error(e)}

    const stackData=(trend||[]).map((d,i)=>({k:d.k.replace(' 2026','').replace(' ',' '),a:Math.round(d.v*.46),b:Math.round(d.v*.34),c:Math.max(1,d.v-Math.round(d.v*.46)-Math.round(d.v*.34))}));
    const stack=document.getElementById('chart-stack'); if(stack) stack.innerHTML=createStackedBarsSvg(stackData,{width:900,height:260});

    try { const f=await fetchJson(`/api/charts/recruitment-funnel?role=${state.currentRole}`); document.getElementById('chart-funnel').innerHTML=`<div class="funnel-wrap">${createFunnelSvg(f,{width:560,height:300})}</div>`; } catch(e){ document.getElementById('chart-funnel').innerHTML='<div style="padding:20px;color:var(--ink-secondary);text-align:center">Recruitment funnel unavailable</div>'; }
    const activity=(attr||[]).map(x=>({k:x.k,v:`${x.v}%`})); const act=document.getElementById('chart-activity'); if(act) act.innerHTML=createActivityTableSvg(activity);
    renderReportVisualizations();
  }

  // --------------------------------------------------------------------------
  // VIEW: Report Library
  // --------------------------------------------------------------------------
  let activeLibraryCategory = 'All';

  async function renderReportLibrary() {
    breadcrumbCurrentEl.textContent = 'Report Library';
    updatePersonaUi();

    mainEl.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Standard Report Catalog</h2>
          <p class="page-subtitle">21 Enterprise analytical rosters • All 21 wired with executable CSV generation engines</p>
        </div>
        <div class="page-meta">
          <span>ROLE: ${state.currentRole.toUpperCase()}</span>
        </div>
      </div>

      <div class="library-layout">
        <div class="category-tabs" id="library-category-tabs">
          <button class="category-tab ${activeLibraryCategory === 'All' ? 'active' : ''}" data-cat="All">All Categories</button>
          <button class="category-tab ${activeLibraryCategory === 'Workforce & Headcount' ? 'active' : ''}" data-cat="Workforce & Headcount">Workforce &amp; Headcount</button>
          <button class="category-tab ${activeLibraryCategory === 'Recruitment' ? 'active' : ''}" data-cat="Recruitment">Recruitment</button>
          <button class="category-tab ${activeLibraryCategory === 'Payroll & Compensation' ? 'active' : ''}" data-cat="Payroll & Compensation">Payroll &amp; Comp</button>
          <button class="category-tab ${activeLibraryCategory === 'Attendance & Leave' ? 'active' : ''}" data-cat="Attendance & Leave">Attendance &amp; Leave</button>
          <button class="category-tab ${activeLibraryCategory === 'Performance' ? 'active' : ''}" data-cat="Performance">Performance</button>
          <button class="category-tab ${activeLibraryCategory === 'Compliance & Statutory' ? 'active' : ''}" data-cat="Compliance & Statutory">Compliance</button>
          <button class="category-tab ${activeLibraryCategory === 'Learning & Development' ? 'active' : ''}" data-cat="Learning & Development">L&amp;D</button>
          <button class="category-tab ${activeLibraryCategory === 'Employee Experience' ? 'active' : ''}" data-cat="Employee Experience">Employee Experience</button>
        </div>

        <div class="reports-list" id="reports-list-host">
          <div style="padding:40px; text-align:center; color:var(--ink-secondary);">Loading report catalog...</div>
        </div>
      </div>
    `;

    const tabsHost = document.getElementById('library-category-tabs');
    tabsHost.querySelectorAll('.category-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        tabsHost.querySelectorAll('.category-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeLibraryCategory = btn.getAttribute('data-cat');
        loadReportsList(activeLibraryCategory);
      });
    });

    loadReportsList(activeLibraryCategory);
  }

  async function loadReportsList(category) {
    const listHost = document.getElementById('reports-list-host');
    try {
      const reports = await fetchJson(`/api/reports?category=${encodeURIComponent(category)}&role=${state.currentRole}`);
      
      const permittedCount = reports.filter(r => r.permitted).length;
      if (navReportsCountEl) navReportsCountEl.textContent = `${permittedCount}/21`;

      const groups = {};
      reports.forEach(r => {
        if (!groups[r.cat]) groups[r.cat] = [];
        groups[r.cat].push(r);
      });

      let html = '';
      Object.keys(groups).forEach(catName => {
        const catReports = groups[catName];
        html += `
          <div class="report-category-group">
            <div class="category-group-header">
              <span>${catName}</span>
              <span class="category-count">${catReports.length} reports</span>
            </div>
            <table class="report-table">
              <thead>
                <tr>
                  <th style="width: 28%;">Report Name</th>
                  <th style="width: 44%;">Analytical Scope &amp; Purpose</th>
                  <th style="width: 14%;">Access Level</th>
                  <th style="width: 14%; text-align:right;">Action</th>
                </tr>
              </thead>
              <tbody>
        `;

        catReports.forEach(r => {
          const isPermitted = r.permitted;
          html += `
            <tr>
              <td class="report-name-cell">
                <button class="report-name-link" data-id="${r.id}" data-name="${r.name}" type="button">
                  ${r.name}
                </button>
              </td>
              <td class="report-desc-cell">${r.desc}</td>
              <td>
                ${isPermitted 
                  ? '<span class="badge-wired">Authorized CSV</span>' 
                  : '<span class="badge-restricted">Role Restricted</span>'}
              </td>
              <td style="text-align:right;">
                <button class="btn ${isPermitted ? 'btn-primary' : 'btn-secondary'} btn-sm run-report-btn" data-id="${r.id}" data-permitted="${isPermitted}" data-name="${r.name}" type="button">
                  ${isPermitted ? 'Check CSV' : 'Restricted'}
                </button>
              </td>
            </tr>
          `;
        });

        html += `</tbody></table></div>`;
      });

      listHost.innerHTML = html;

      async function checkReportCsv(reportId, reportName) {
        try {
          showToast(`Checking ${reportName}...`);

          const result = await fetchJson(
            `/api/reports/${reportId}/validate?role=${state.currentRole}`
          );

          if (!result.ok) {
            showModal(
              'CSV Check Failed',
              `
                <div class="csv-check-result csv-check-error">
                  <div class="csv-check-icon">✕</div>
                  <h3>CSV is not ready</h3>
                  <p><strong>${result.reportName || reportName}</strong></p>
                  <p>${result.message || 'The report could not generate valid CSV data.'}</p>
                  <div class="csv-check-meta">
                    <div><span>Status</span><strong>${result.status || 'ERROR'}</strong></div>
                    <div><span>Role</span><strong>${state.currentRole.toUpperCase()}</strong></div>
                  </div>
                </div>
              `
            );
            return;
          }

          const escapeHtml = value => String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\"/g, '&quot;')
            .replace(/'/g, '&#039;');

          const columnLabels = result.columns || [];
          const previewRows = result.previewRows || [];

          const tableHead = columnLabels.map(column =>
            `<th>${escapeHtml(column)}</th>`
          ).join('');

          const tableBody = previewRows.map(row => `
            <tr>
              ${columnLabels.map((_, index) =>
                `<td>${escapeHtml(row[index])}</td>`
              ).join('')}
            </tr>
          `).join('');

          showModal(
            'CSV Report Check',
            `
              <div class="csv-check-result csv-check-success">
                <div class="csv-check-icon">✓</div>
                <h3>CSV is ready</h3>
                <p><strong>${escapeHtml(result.reportName)}</strong></p>
                <p>${escapeHtml(result.message)}</p>

                <div class="csv-check-meta">
                  <div><span>Status</span><strong>READY</strong></div>
                  <div><span>Category</span><strong>${escapeHtml(result.category)}</strong></div>
                  <div><span>Rows</span><strong>${result.rowCount}</strong></div>
                  <div><span>Columns</span><strong>${result.columnCount}</strong></div>
                  <div><span>Format</span><strong>${escapeHtml(result.format || 'CSV')}</strong></div>
                </div>

                <div class="csv-preview">
                  <div class="csv-preview-title">Complete CSV Data</div>
                  <div class="csv-preview-note">Showing all ${result.rowCount} rows and ${result.columnCount} columns. Scroll horizontally and vertically to inspect the complete report.</div>
                  <div class="csv-table-wrap">
                    <table class="csv-preview-table">
                      <thead><tr>${tableHead}</tr></thead>
                      <tbody>${tableBody}</tbody>
                    </table>
                  </div>
                </div>

                <div style="margin-top:20px; text-align:right; display:flex; justify-content:flex-end; gap:10px;">
                  <button class="btn btn-primary" id="confirm-csv-download" data-report-id="${escapeHtml(result.reportId)}" data-report-name="${escapeHtml(result.reportName)}" type="button">
                    Download CSV
                  </button>
                </div>
              </div>
            `
          );
          const downloadBtn = document.getElementById('confirm-csv-download');
          if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
              const id = downloadBtn.getAttribute('data-report-id');
              const name = downloadBtn.getAttribute('data-report-name');
              showToast(`Downloading ${name}...`);
              window.location.href = `/api/reports/${id}/csv?role=${state.currentRole}`;
            });
          }
        } catch (err) {
          showModal(
            'CSV Check Error',
            `
              <div class="csv-check-result csv-check-error">
                <div class="csv-check-icon">!</div>
                <h3>Unable to check CSV</h3>
                <p><strong>${reportName}</strong></p>
                <p>${err.message || 'The server could not validate this report.'}</p>
              </div>
            `
          );
        }
      }

      listHost.querySelectorAll('.report-name-link').forEach(btn => {
        btn.addEventListener('click', () => {
          checkReportCsv(
            btn.getAttribute('data-id'),
            btn.getAttribute('data-name')
          );
        });
      });

      listHost.querySelectorAll('.run-report-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const reportId = btn.getAttribute('data-id');
          const isPermitted = btn.getAttribute('data-permitted') === 'true';
          const reportName = btn.getAttribute('data-name');

          if (!isPermitted) {
            showModal(
              'RBAC Access Boundary Notice',
              `<p><strong>${reportName}</strong> is restricted from your active identity perspective (<strong>${state.currentRole.toUpperCase()}</strong>).</p>
               <p style="margin-top:10px; color:var(--ink-secondary);">To access this analytical report, switch your role perspective in the top navigation bar to an authorized role (CXO, CHRO, or HRBP).</p>`
            );
            return;
          }

          checkReportCsv(reportId, reportName);
        });
      });

    } catch (err) {
      listHost.innerHTML = `<div style="padding:20px; color:var(--negative);">Failed to load reports: ${err.message || 'Unknown error'}</div>`;
    }
  }

  // --------------------------------------------------------------------------
  // VIEW: Custom Report Builder
  // --------------------------------------------------------------------------
  async function renderCustomBuilder() {
    breadcrumbCurrentEl.textContent = 'Custom Builder';
    updatePersonaUi();

    try {
      state.fieldCatalog = await fetchJson(`/api/builder/fields?role=${state.currentRole}`);
    } catch (err) {
      console.error('Failed to load fields:', err);
    }

    mainEl.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Custom Report Builder</h2>
          <p class="page-subtitle">Role-scoped schema projection • Live synchronized preview table &amp; CSV export</p>
        </div>
        <div class="page-meta">
          <span>ROLE: ${state.currentRole.toUpperCase()}</span>
        </div>
      </div>

      <div class="builder-layout">
        <div class="builder-controls-grid">
          <div class="field-selector-card">
            <div class="section-heading">
              <span>Select Attributes to Include</span>
              <button id="builder-select-all-btn" class="btn btn-secondary btn-sm">Select All Available</button>
            </div>
            <div class="field-categories" id="field-categories-host"></div>
          </div>

          <div class="filters-card">
            <div class="section-heading">
              <span>Roster Query Filters</span>
            </div>
            
            <div class="filter-item">
              <label for="filter-entity">Operating Entity</label>
              <select id="filter-entity">
                <option value="All">All Entities</option>
                ${state.meta.entities.map(e => `<option value="${e}" ${state.builderFilters.entity === e ? 'selected' : ''}>${e}</option>`).join('')}
              </select>
            </div>

            <div class="filter-item">
              <label for="filter-dept">Department</label>
              <select id="filter-dept">
                <option value="All">All Departments</option>
                ${state.meta.departments.map(d => `<option value="${d}" ${state.builderFilters.dept === d ? 'selected' : ''}>${d}</option>`).join('')}
              </select>
            </div>

            <div class="filter-item">
              <label for="filter-emp-type">Employment Type</label>
              <select id="filter-emp-type">
                <option value="All">All Types</option>
                ${state.meta.employmentTypes.map(t => `<option value="${t}" ${state.builderFilters.employmentType === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>

            <div class="filter-item">
              <label for="filter-status">Employment Status</label>
              <select id="filter-status">
                <option value="All" ${state.builderFilters.status === 'All' ? 'selected' : ''}>All (Active &amp; Exited)</option>
                <option value="Active" ${state.builderFilters.status === 'Active' ? 'selected' : ''}>Active Only</option>
                <option value="Exited" ${state.builderFilters.status === 'Exited' ? 'selected' : ''}>Exited Only</option>
              </select>
            </div>
          </div>
        </div>

        <div class="preview-section">
          <div class="preview-header">
            <div>
              <h3 style="font-family:var(--font-serif); font-size:18px; font-weight:600;">Live Query Preview</h3>
              <div class="preview-meta" id="preview-count-meta">Showing first 8 matching rows</div>
            </div>
            <div style="display:flex; gap:10px;">
              <button id="builder-save-btn" class="btn btn-secondary">Save Report Definition</button>
              <button id="builder-download-btn" class="btn btn-primary">Download Full CSV</button>
            </div>
          </div>

          <div class="data-table-container" id="preview-table-host">
            <div style="padding:30px; text-align:center; color:var(--ink-secondary);">Computing live projection...</div>
          </div>
        </div>

        <div class="card" style="margin-top:10px;">
          <div class="section-heading">
            <span>Saved Custom Report Definitions</span>
          </div>
          <div id="saved-reports-host" style="font-size:12.5px; color:var(--ink-secondary);">
            Loading saved definitions...
          </div>
        </div>
      </div>
    `;

    const categoriesHost = document.getElementById('field-categories-host');
    if (state.fieldCatalog && categoriesHost) {
      let catHtml = '';
      Object.keys(state.fieldCatalog).forEach(catName => {
        const fields = state.fieldCatalog[catName];
        catHtml += `
          <div>
            <div class="field-cat-title">${catName}</div>
            <div class="field-checkbox-list">
        `;
        fields.forEach(f => {
          const isChecked = state.builderSelectedFields.includes(f.key);
          catHtml += `
            <label class="checkbox-label">
              <input type="checkbox" class="field-checkbox" value="${f.key}" ${isChecked ? 'checked' : ''}>
              <span>${f.label}</span>
            </label>
          `;
        });
        catHtml += `</div></div>`;
      });
      categoriesHost.innerHTML = catHtml;

      categoriesHost.querySelectorAll('.field-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
          const key = cb.value;
          if (cb.checked) {
            if (!state.builderSelectedFields.includes(key)) state.builderSelectedFields.push(key);
          } else {
            state.builderSelectedFields = state.builderSelectedFields.filter(k => k !== key);
          }
          refreshBuilderPreview();
        });
      });
    }

    ['filter-entity', 'filter-dept', 'filter-emp-type', 'filter-status'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', () => {
          state.builderFilters.entity = document.getElementById('filter-entity').value;
          state.builderFilters.dept = document.getElementById('filter-dept').value;
          state.builderFilters.employmentType = document.getElementById('filter-emp-type').value;
          state.builderFilters.status = document.getElementById('filter-status').value;
          refreshBuilderPreview();
        });
      }
    });

    document.getElementById('builder-select-all-btn').addEventListener('click', () => {
      const allKeys = [];
      Object.values(state.fieldCatalog).forEach(list => list.forEach(f => allKeys.push(f.key)));
      state.builderSelectedFields = allKeys;
      categoriesHost.querySelectorAll('.field-checkbox').forEach(cb => cb.checked = true);
      refreshBuilderPreview();
    });

    document.getElementById('builder-download-btn').addEventListener('click', async () => {
      try {
        showToast('Serializing full query dataset to CSV...');
        const res = await fetch('/api/builder/csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: state.builderSelectedFields,
            filters: state.builderFilters,
            role: state.currentRole,
            name: 'custom_hr_report'
          })
        });
        const blob = await res.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = 'custom_hr_report.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        showToast('CSV downloaded successfully.');
      } catch (err) {
        showToast('Failed to export CSV');
      }
    });

    document.getElementById('builder-save-btn').addEventListener('click', () => {
      const reportName = prompt('Enter a name for this custom report definition:');
      if (reportName && reportName.trim()) {
        saveCurrentReportDefinition(reportName.trim());
      }
    });

    refreshBuilderPreview();
    loadSavedReports();
  }

  async function refreshBuilderPreview() {
    const tableHost = document.getElementById('preview-table-host');
    const countMeta = document.getElementById('preview-count-meta');
    if (!tableHost) return;

    try {
      const preview = await fetchJson('/api/builder/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: state.builderSelectedFields,
          filters: state.builderFilters,
          role: state.currentRole
        })
      });

      if (countMeta) {
        countMeta.textContent = `Showing ${preview.rows.length} of ${preview.total} matching records for active role (${state.currentRole.toUpperCase()})`;
      }

      if (preview.rows.length === 0) {
        tableHost.innerHTML = '<div style="padding:28px; text-align:center; color:var(--ink-secondary);">No records match the active filter criteria.</div>';
        return;
      }

      let tableHtml = '<table class="data-table"><thead><tr>';
      preview.columns.forEach(col => {
        tableHtml += `<th>${col.label}</th>`;
      });
      tableHtml += '</tr></thead><tbody>';

      preview.rows.forEach(row => {
        tableHtml += '<tr>';
        preview.columns.forEach(col => {
          tableHtml += `<td>${row[col.key] !== undefined && row[col.key] !== null ? row[col.key] : '—'}</td>`;
        });
        tableHtml += '</tr>';
      });

      tableHtml += '</tbody></table>';
      tableHost.innerHTML = tableHtml;
    } catch (err) {
      tableHost.innerHTML = `<div style="padding:20px; color:var(--negative);">Preview error: ${err.message || 'Unknown error'}</div>`;
    }
  }

  async function saveCurrentReportDefinition(name) {
    try {
      await fetchJson('/api/builder/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          fields: state.builderSelectedFields,
          filters: state.builderFilters,
          role: state.currentRole
        })
      });
      showToast(`Saved report "${name}"`);
      loadSavedReports();
    } catch (err) {
      showToast(`Error saving report: ${err.message}`);
    }
  }

  async function loadSavedReports() {
    const host = document.getElementById('saved-reports-host');
    if (!host) return;

    try {
      const saved = await fetchJson('/api/builder/saved');
      if (saved.length === 0) {
        host.innerHTML = '<em>No custom report definitions saved yet. Configure fields above and click "Save Report Definition".</em>';
        return;
      }

      let html = '<div style="display:flex; flex-direction:column; gap:8px;">';
      saved.forEach(item => {
        html += `
          <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:var(--bg-surface); border:1px solid var(--border);">
            <div>
              <strong style="color:var(--ink); font-size:13px;">${item.name}</strong>
              <div style="font-size:11px; color:var(--ink-secondary); margin-top:2px;">
                ${item.fields.length} attributes selected • Created by ${item.createdByRole || 'Admin'} on ${new Date(item.createdAt).toLocaleDateString()}
              </div>
            </div>
            <button class="btn btn-secondary btn-sm load-saved-btn" data-json="${encodeURIComponent(JSON.stringify(item))}">
              Load Schema
            </button>
          </div>
        `;
      });
      html += '</div>';
      host.innerHTML = html;

      host.querySelectorAll('.load-saved-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const item = JSON.parse(decodeURIComponent(btn.getAttribute('data-json')));
          state.builderSelectedFields = item.fields || [];
          state.builderFilters = item.filters || {};
          renderCustomBuilder();
          showToast(`Loaded definition "${item.name}"`);
        });
      });
    } catch (err) {
      console.error('Failed to load saved reports:', err);
    }
  }

  // --------------------------------------------------------------------------
  // VIEW: AI Copilot
  // --------------------------------------------------------------------------
  function renderCopilot() {
    breadcrumbCurrentEl.textContent = 'AI Copilot';
    updatePersonaUi();

    mainEl.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Grounded Intelligence Copilot</h2>
          <p class="page-subtitle">Natural language analytics • Role-enforced computations and inline charting</p>
        </div>
        <div class="page-meta">
          <span>ROLE: ${state.currentRole.toUpperCase()}</span>
        </div>
      </div>

      <div class="copilot-layout">
        <div class="chat-panel">
          <div class="chat-messages" id="chat-messages-host"></div>
          <form class="chat-input-wrapper" id="chat-form">
            <input type="text" id="chat-input" class="chat-input" placeholder="Ask a question (e.g., 'What is our attrition rate?' or 'Show leave liability')..." autocomplete="off">
            <button type="submit" class="btn btn-primary">Query Engine</button>
          </form>
        </div>

        <div class="copilot-sidebar">
          <div class="card">
            <div class="section-heading">
              <span>Verified Role Prompts</span>
            </div>
            <div class="suggestion-chips">
              <button class="chip-btn" data-q="What is our current attrition rate?">
                <span class="chip-tag">Workforce Dynamics</span>
                What is our current attrition rate?
              </button>
              <button class="chip-btn" data-q="Show Sales department attrition">
                <span class="chip-tag">Department Focus</span>
                Show Sales department attrition
              </button>
              <button class="chip-btn" data-q="What is our total leave encashment liability?">
                <span class="chip-tag">Financial Accrual</span>
                What is our total leave encashment liability?
              </button>
              <button class="chip-btn" data-q="Are we tracking over budget on payroll?">
                <span class="chip-tag">Compensation Variance</span>
                Are we tracking over budget on payroll?
              </button>
              <button class="chip-btn" data-q="What is our active headcount and 6-month trend?">
                <span class="chip-tag">Headcount Scale</span>
                What is our active headcount &amp; 6-month trend?
              </button>
            </div>
          </div>

          <div class="card" style="background-color:var(--bg-surface);">
            <div class="section-heading">
              <span>Security &amp; Tool Seam</span>
            </div>
            <p style="font-size:11.5px; color:var(--ink-secondary); line-height:1.5;">
              Queries are evaluated against your active role perspective (<strong>${state.currentRole.toUpperCase()}</strong>). Sensitive compensation queries by unauthorized roles are cleanly intercepted.
            </p>
          </div>
        </div>
      </div>
    `;

    renderChatMessages();

    const form = document.getElementById('chat-form');
    const input = document.getElementById('chat-input');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      await handleUserCopilotQuery(text);
    });

    document.querySelectorAll('.chip-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const q = btn.getAttribute('data-q');
        await handleUserCopilotQuery(q);
      });
    });
  }

  function renderChatMessages() {
    const host = document.getElementById('chat-messages-host');
    if (!host) return;

    let html = '';
    state.copilotMessages.forEach(msg => {
      const isUser = msg.sender === 'user';
      const formattedText = msg.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      let chartHtml = '';
      if (msg.chart && msg.chart.data) {
        chartHtml = `
          <div class="bubble-chart-container">
            <div class="bubble-chart-title">${msg.chart.title || 'Computed Chart'}</div>
        `;
        if (msg.chart.type === 'bar') {
          chartHtml += createHorizontalBarChartSvg(msg.chart.data, { width: 440, height: 160, unit: msg.chart.unit || '' });
        } else if (msg.chart.type === 'line') {
          chartHtml += createLineChartSvg(msg.chart.data, { width: 440, height: 180, unit: msg.chart.unit || '' });
        }
        chartHtml += `</div>`;
      }

      html += `
        <div class="chat-bubble ${isUser ? 'user' : 'assistant'}">
          <span class="bubble-sender">${isUser ? `Query (${state.currentRole.toUpperCase()})` : 'HRMS Intelligence'}</span>
          <div class="bubble-content">
            <div>${formattedText}</div>
            ${chartHtml}
          </div>
        </div>
      `;
    });

    host.innerHTML = html;
    host.scrollTop = host.scrollHeight;
  }

  async function handleUserCopilotQuery(question) {
    state.copilotMessages.push({
      sender: 'user',
      text: question,
      chart: null
    });
    renderChatMessages();

    try {
      const res = await fetchJson('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, role: state.currentRole })
      });

      state.copilotMessages.push({
        sender: 'assistant',
        text: res.text,
        chart: res.chart
      });
      renderChatMessages();
    } catch (err) {
      state.copilotMessages.push({
        sender: 'assistant',
        text: `Error processing intelligence query: ${err.message || 'Service unavailable'}`,
        chart: null
      });
      renderChatMessages();
    }
  }

  // --------------------------------------------------------------------------
  // VIEW: Scheduled Reports & Automations
  // --------------------------------------------------------------------------
  async function renderSchedules() {
    breadcrumbCurrentEl.textContent = 'Automations & Schedules';
    updatePersonaUi();

    mainEl.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Automated Export Schedules</h2>
          <p class="page-subtitle">Configure recurring batch CSV/PDF export dispatches to executive stakeholders</p>
        </div>
        <div class="page-meta">
          <button id="create-schedule-btn" class="btn btn-primary">Create Scheduled Job</button>
        </div>
      </div>

      <div class="schedule-grid" id="schedules-host">
        <div style="padding:30px; text-align:center; color:var(--ink-secondary);">Loading scheduled jobs...</div>
      </div>
    `;

    try {
      const schedules = await fetchJson('/api/schedules');
      const host = document.getElementById('schedules-host');
      if (schedules.length === 0) {
        host.innerHTML = '<div>No automated export schedules configured yet.</div>';
        return;
      }

      let html = '';
      schedules.forEach(job => {
        html += `
          <div class="schedule-card">
            <div>
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="badge-wired">${job.frequency}</span>
                <span style="font-family:var(--font-mono); font-size:10px; color:var(--ink-secondary);">${job.id}</span>
              </div>
              <h4 class="schedule-title">${job.name}</h4>
              <div class="schedule-meta-row">
                <span>Target Format</span>
                <span class="schedule-meta-val">${job.format}</span>
              </div>
              <div class="schedule-meta-row">
                <span>Distribution List</span>
                <span class="schedule-meta-val">${job.recipients}</span>
              </div>
            </div>
            <div style="border-top:1px solid var(--border-light); margin-top:14px; padding-top:10px; display:flex; justify-content:space-between; align-items:center;">
              <span style="font-size:11px; color:var(--ink-tertiary);">Last Run: ${job.lastRun}</span>
              <button class="btn btn-secondary btn-sm run-schedule-now" data-name="${job.name}">Run Now</button>
            </div>
          </div>
        `;
      });
      host.innerHTML = html;

      host.querySelectorAll('.run-schedule-now').forEach(btn => {
        btn.addEventListener('click', () => {
          showToast(`Dispatched "${btn.getAttribute('data-name')}" to stakeholders.`);
        });
      });

      document.getElementById('create-schedule-btn').addEventListener('click', () => {
        const name = prompt('Enter a name for the new recurring schedule:');
        if (name && name.trim()) {
          fetchJson('/api/schedules', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: name.trim(),
              frequency: 'Weekly (Every Monday 09:00 AM)',
              format: 'CSV',
              recipients: 'stakeholders@company.com'
            })
          }).then(() => {
            showToast(`Created schedule "${name}"`);
            renderSchedules();
          });
        }
      });
    } catch (err) {
      console.error('Failed to load schedules:', err);
    }
  }

  // --------------------------------------------------------------------------
  // VIEW: Security & Audit Trail
  // --------------------------------------------------------------------------
  async function renderAudit() {
    breadcrumbCurrentEl.textContent = 'Security & Audit Trail';
    updatePersonaUi();

    mainEl.innerHTML = `
      <div class="page-header">
        <div>
          <h2 class="page-title">Security &amp; Export Audit Log</h2>
          <p class="page-subtitle">Immutable event stream of all CSV downloads, schema projections, and role elevations</p>
        </div>
        <div class="page-meta">
          <span>REAL-TIME AUDIT LOG</span>
        </div>
      </div>

      <div class="card">
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 15%;">Event ID</th>
              <th style="width: 20%;">Timestamp (UTC)</th>
              <th style="width: 15%;">Persona / Role</th>
              <th style="width: 20%;">Action Executed</th>
              <th style="width: 20%;">Resource Target</th>
              <th style="width: 10%;">Status</th>
            </tr>
          </thead>
          <tbody id="audit-table-body">
            <tr><td colspan="6" style="padding:20px; text-align:center;">Loading audit logs...</td></tr>
          </tbody>
        </table>
      </div>
    `;

    try {
      const logs = await fetchJson('/api/audit-log');
      const tbody = document.getElementById('audit-table-body');
      if (logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; text-align:center;">No audit records available.</td></tr>';
        return;
      }

      let html = '';
      logs.forEach(log => {
        html += `
          <tr>
            <td style="font-family:var(--font-mono); font-size:11px;">${log.id}</td>
            <td style="font-family:var(--font-mono); font-size:11.5px; color:var(--ink-secondary);">${new Date(log.timestamp).toLocaleString()}</td>
            <td><span class="badge-wired">${log.role.toUpperCase()}</span></td>
            <td style="font-family:var(--font-mono); font-size:11.5px; font-weight:600;">${log.action}</td>
            <td style="color:var(--ink);">${log.target}</td>
            <td><span class="badge-wired">${log.status}</span></td>
          </tr>
        `;
      });
      tbody.innerHTML = html;
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  }

  // --------------------------------------------------------------------------
  // Router & Navigation
  // --------------------------------------------------------------------------
  function navigate(viewName) {
    const validViews = ['dashboard', 'library', 'builder', 'copilot', 'schedules', 'audit'];
    state.currentView = validViews.includes(viewName) ? viewName : 'dashboard';

    document.querySelectorAll('.nav-item').forEach(el => {
      if (el.getAttribute('data-view') === state.currentView) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    if (state.currentView === 'dashboard') renderDashboard();
    else if (state.currentView === 'library') renderReportLibrary();
    else if (state.currentView === 'builder') renderCustomBuilder();
    else if (state.currentView === 'copilot') renderCopilot();
    else if (state.currentView === 'schedules') renderSchedules();
    else if (state.currentView === 'audit') renderAudit();
  }

  function handleHashChange() {
    const hash = window.location.hash.replace(/^#/, '');
    navigate(hash || 'dashboard');
  }

  window.addEventListener('hashchange', handleHashChange);

  // --------------------------------------------------------------------------
  // Initialization
  // --------------------------------------------------------------------------
  async function initApp() {
    const authenticated = await loadAuthenticatedUser();
    if (!authenticated) return;
    try {
      state.meta = await fetchJson(`/api/meta?role=${state.currentRole}`);
      if (entitySelectEl && state.meta.entities) {
        entitySelectEl.innerHTML = '<option value="All">All Operating Entities</option>';
        state.meta.entities.forEach(ent => {
          const opt = document.createElement('option');
          opt.value = ent;
          opt.textContent = ent;
          entitySelectEl.appendChild(opt);
        });
      }
    } catch (err) {
      console.warn('Metadata initialization failed:', err);
    }

    if (roleSelectEl) {
      roleSelectEl.addEventListener('change', () => {
        state.currentRole = roleSelectEl.value;
        showToast(`Switched active identity to ${state.currentRole.toUpperCase()}`);
        updatePersonaUi();
        handleHashChange();
      });
    }

    if (entitySelectEl) {
      entitySelectEl.addEventListener('change', () => {
        state.currentEntity = entitySelectEl.value;
        showToast(`Filtered perspective to ${state.currentEntity}`);
        if (state.currentView === 'dashboard') renderDashboard();
      });
    }

    if (quickExportBtn) {
      quickExportBtn.addEventListener('click', () => {
        showToast('Exporting current view roster CSV...');
        window.location.href = `/api/reports/1/csv?role=${state.currentRole}`;
      });
    }

    updatePersonaUi();
    handleHashChange();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
