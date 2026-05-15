<div align="center">

# Kingsley MES / ERP - disconnected demo

**A faithful, sanitised walkthrough of the production MES/ERP system I designed and built at Kingsley Beverage FZCO.**

[![Live](https://img.shields.io/badge/live-saadm.dev%2Fapp%2F-7c9cff?style=for-the-badge)](https://saadm.dev/app/)
[![Portfolio](https://img.shields.io/badge/portfolio-saadm.dev-5eead4?style=for-the-badge)](https://saadm.dev/)
[![License](https://img.shields.io/badge/license-MIT-c4b5fd?style=for-the-badge)](../LICENSE)

</div>

---

## What this is

A **disconnected, in-browser** version of the manufacturing-floor MES / ERP system I built - production planning, inventory, quality control, OEE monitoring, accounts, Sage integration, and 6 print-ready PDF templates. The full application runs in your browser with a `fetch`-interceptor returning fabricated demo data; the actual production code (`_kingsley_private_DO_NOT_PUBLISH/`) is intentionally not in this repo.

Built solo as Automation Engineer / ERP Developer / IT Administrator at Kingsley Beverage FZCO, Dubai.

## Quick links

- 🌐 **Live walkthrough**: [saadm.dev/app/](https://saadm.dev/app/)
- 🎥 **Portfolio context**: [saadm.dev/demo.html](https://saadm.dev/demo.html)
- 🏠 **Full portfolio**: [saadm.dev](https://saadm.dev/)

## What you can see

- **20+ integrated modules** - production planning, job orders, inventory, recipes / BOM, QC seam check, batch tracking, dispatch, accounts, customs, equipment, PO status, GRN, yield reporting, analytics.
- **6 print-ready PDF document templates** - performa invoice, packing list, picking sheet, batch report, GRN, recipe sheet.
- **Auto-login as admin** - every module unlocked.
- **Mock-API interceptor** - every `fetch()` to `/api/*` is captured and answered from in-memory fabricated data. Realistic shortfalls, downtime causes, OEE math, batch numbers - but nothing real.

## Tech stack (in production)

| Layer | Tools |
|-------|-------|
| Backend | Python · FastAPI · pydantic · uvicorn |
| Data | MongoDB (Motor / pymongo) · SQL Server (pyodbc) · openpyxl |
| Frontend | Vanilla JavaScript (ES6+) · HTML5 · CSS3 · Tailwind |
| Reporting | fpdf · pdfplumber · pandas · NumPy |
| Auth | JWT · role-based access |
| Infra | Docker · Docker Compose · nginx · Linux · Cloudflare |
| Integration | Sage Evolution (custom adapter) |

## Tech in this demo (frontend-only mirror)

Just static HTML/CSS/JavaScript. The fetch interceptor at `js/mock-api.js` simulates the backend.

## Running locally

```bash
git clone https://github.com/saad-mughal435/kingsley-mes-demo.git
cd kingsley-mes-demo
python -m http.server 8000
# open http://localhost:8000
```

No build step. Edit a file, refresh.

## Repository structure

```
.
├── index.html          # Demo shell - auto-login + module loader
├── css/                # Scoped styles
├── js/
│   ├── mock-api.js     # Fetch interceptor returning fabricated data
│   ├── app.js          # Shell bootstrap
│   └── modules/        # 20+ self-contained modules
└── api/                # Static JSON / asset endpoints the demo references
```

## Canonical source

This repository is a **mirror** of `site/app/` from the main portfolio repo, split out for visibility. The canonical source - including the changelog, CI workflows, and deploy configuration - lives at:

📦 **[saad-mughal435/site](https://github.com/saad-mughal435/site)** (under `app/`)

Updates flow from there via `git subtree split`. PRs are welcome at either repo.

## License

[MIT](LICENSE). All data, customers, recipes, batch numbers, and document contents are fabricated for demonstration. The real production system source remains private.

---

<div align="center">

Built by **[Muhammad Saad](https://saadm.dev)** · Electrical & Automation Engineer · ERP/OEE Developer · UAE-based, open to relocate worldwide.

</div>
