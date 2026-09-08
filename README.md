# HRMS Portal — Enterprise Dashboard

Enterprise Human Resource Management System featuring role-based access control (RBAC), executive analytics dashboards, dynamic report builder, AI copilot, and scheduled exports.

## Features
- **Modern UI/UX**: Navy-blue and emerald green theme with dual light/dark mode support.
- **Role-Based Access Control (RBAC)**: Scoped access for CEO, CHRO, HRBP, Manager, and Employee.
- **Analytics & Visualizations**:
  - Headcount & presence trend line charts
  - Workforce composition donut & stacked bar charts
  - Departmental attrition metrics
  - Recruitment pipeline funnel & workforce activity snapshot
- **Executable Report Engine**: 21 pre-built reports with instant CSV generation.
- **AI Copilot**: Natural language queries computed against role-scoped data.
- **Zero External Dependencies**: Powered by pure Node.js and Vanilla JS.
- **Vercel Serverless Ready**: Configured for 1-click zero-config Vercel deployments.

---

## Run Locally

```powershell
node server.js
```

Open your browser at:
```text
http://localhost:3000/
```

---

## Demo Roles & Credentials

| Role | Scope | Email | Password |
| :--- | :--- | :--- | :--- |
| **CEO Suite** | Global Enterprise Scope (4 Entities) | `ceo@soxibeta.com` | `ceo2026` |
| **CHRO** | Talent, Attrition & Recruitment | `chro@soxibeta.com` | `chro2026` |
| **HRBP** | Department Scope (Sales) | `hrbp@soxibeta.com` | `hrbp2026` |
| **Line Manager** | Management Pod Direct Reports | `manager@soxibeta.com` | `manager2026` |
| **Employee** | Self-Service Scoped Access | `employee@soxibeta.com` | `employee2026` |

---

## Deploy to Vercel

1. Push to GitHub (`main` branch).
2. Import the repository into [Vercel](https://vercel.com).
3. Leave all default build settings (Framework: *Other*, Root Directory: `./`).
4. Click **Deploy**.
