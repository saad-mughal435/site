# Property Management

A client-side property-management platform demo for saadm.dev - a
"Happy Tenant + Happy Landlord"-style suite covering an entire residential
community operation. One shared domain engine drives **five role portals**:

| Portal | What it does |
|--------|--------------|
| **Tenant** (`tenant.html`) | Pay rent, raise & track maintenance, book amenities, register visitors, message the team, view lease & documents. |
| **Landlord / Owner** (`landlord.html`) | Portfolio value, occupancy, ROI/yield, rent-collection status, financials + printable owner statements, cost approvals. |
| **Property Manager** (`manager.html`) | Units, tenants, leases/renewals, rent collection + arrears, maintenance kanban with SLA, approvals, help desk, reports. |
| **Vendor** (`vendor.html`) | Accept / schedule / start / complete assigned work orders, log cost - drives the maintenance SLA clock. |
| **Inspector** (`inspector.html`) | Move-in / move-out / periodic / snagging inspections; room-by-room checklist feeding deposit reconciliation. |

Start at `index.html` to pick a role and sign in as a seeded persona.

## Architecture (no repeated functions)

Three layers, each the single source of truth for its concern:

- **`js/engine.js`** (`PMEngine`) - pure domain rules: status labels, money
  math, the work-order state machine + SLA, invoice/lease status, inspection
  scoring. No I/O.
- **`js/mock-api.js`** - the only module that persists state (`localStorage`
  `pm.*` deltas) and routes `/property-management/api/*` requests, calling the
  engine and emitting notifications.
- **`js/app.js`** (`PMApp` / `PMUI`) - shared shell, components and inline-SVG
  charts. Role pages (`tenant.js` ... `inspector.js`) are thin projections that
  only call the API + render.

`js/data.js` (`PM_DATA`) is a deterministic seed (mulberry32). Everything is
**synthetic** - names, Emirates IDs, IBANs, cheque numbers, Ejari numbers, DEWA
premises and figures are fabricated. No backend, no AI, no network calls beyond
same-origin assets. UAE conventions modelled: AED, Ejari, post-dated cheques,
DEWA, RERA rent index, security-deposit rules.
