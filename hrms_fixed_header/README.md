# HRMS Portal — Blue/Green Dashboard Redesign

This version keeps the existing HRMS role-based login, dashboard, Report Library, CSV generation, Custom Builder, AI Copilot, Schedules, and Audit features, while updating the UI/UX.

## Visual updates
- Modern navy-blue + HRMS green visual system based on the supplied reference dashboard.
- Updated typography, spacing, cards, navigation, KPI styling, buttons, and forms.
- Dashboard charts now include:
  - Headcount / presence trend line chart
  - Workforce composition donut chart
  - Workforce composition stacked bar chart
  - Attrition / presence horizontal bar chart
  - Recruitment pipeline funnel
  - Workforce activity snapshot table
- Charts use the HRMS role-scoped data already provided by the application.
- Login page uses the same blue/green visual language.

## Run locally

```powershell
cd .\hrms_fixed_header
npm install
node server.js
```

Open:

```text
http://localhost:3000/
```

## Demo roles
- CEO: ceo@soxibeta.com / ceo2026
- CHRO: chro@soxibeta.com / chro2026
- HRBP: hrbp@soxibeta.com / hrbp2026
- Manager: manager@soxibeta.com / manager2026
- Employee: employee@soxibeta.com / employee2026
