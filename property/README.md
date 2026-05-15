<div align="center">

# Manzil Properties - Dubai real-estate marketplace

**A two-sided property marketplace patterned on Property Finder / Bayut. Map + list search across 15 Dubai communities, mortgage / valuation / yield tools, and a 13-section admin SPA.**

[![Live](https://img.shields.io/badge/live-saadm.dev%2Fproperty%2F-7c9cff?style=for-the-badge)](https://saadm.dev/property/)
[![Portfolio](https://img.shields.io/badge/portfolio-saadm.dev-5eead4?style=for-the-badge)](https://saadm.dev/)
[![License](https://img.shields.io/badge/license-MIT-c4b5fd?style=for-the-badge)](../LICENSE)

</div>

---

## What this is

A complete real-estate marketplace demo - buyer side, agent side, and admin - running entirely in the browser. 65 listings, 24 agents, 10 agencies, 18 customers, 40 inquiries, 20 viewings across 15 Dubai communities. Real Unsplash photography. Leaflet + OpenStreetMap tiles. Full CRUD, leads pipeline, viewings calendar, analytics, moderation, and audit log.

Built to show what a marketplace-shaped product looks like when you're responsible for both the customer experience and the operator tooling.

## Quick links

- 🌐 **Live marketplace**: [saadm.dev/property/](https://saadm.dev/property/)
- ⚙ **Admin SPA**: [saadm.dev/property/admin.html](https://saadm.dev/property/admin.html)
- 💰 **Mortgage calculator**: [saadm.dev/property/mortgage.html](https://saadm.dev/property/mortgage.html)
- 📊 **Valuation tool**: [saadm.dev/property/valuation.html](https://saadm.dev/property/valuation.html)
- 📈 **Investment yield calculator**: [saadm.dev/property/yield.html](https://saadm.dev/property/yield.html)
- 🏠 **Full portfolio**: [saadm.dev](https://saadm.dev/)

## What you can do

### Customer surface (10 pages)
- **Hero search** with Buy / Rent / Off-plan tabs, location autocomplete, type + beds + price.
- **Search results** with filter bar, list ↔ map toggle (Leaflet + OSM, price-pinned markers, hover sync), pagination, saved searches.
- **Listing detail** - gallery + lightbox (keyboard nav), amenities grid, schematic floor plan SVG, location map, inline mortgage widget, agent contact rail (call / WhatsApp / email / schedule viewing / request callback modals), similar listings, share, print-as-brochure.
- **Agent + agency profiles** - stats, active listings, reviews.
- **Area guides** - 15 Dubai communities with hero, blurb, avg AED/ft², schools, malls, transit, area map.
- **Valuation tool** - comparable-based estimate, confidence read.
- **Mortgage calculator** - full amortisation, save scenarios.
- **Investment yield calculator** - gross + net yield, 5/10-year ROI, year-by-year cash flow.
- **Compare** - side-by-side up to 3 listings.
- **Customer dashboard** - favorites, saved searches, viewings, inquiries, mortgage scenarios.
- **AED / USD / GBP / EUR** currency switcher.
- **EN / AR** locale with RTL layout.

### Admin SPA - 13 hash-routed sections
| Section | What it does |
|---------|--------------|
| Dashboard | KPIs, monthly views/leads bar chart, inquiry status mix, top listings, recent inquiries, expiring listings, alerts |
| Listings | CRUD + bulk publish / feature / verify / delete · **CSV bulk import** · CSV export |
| Inquiries | Inbox-style 2-pane with pipeline (new → won/lost), **lead scoring 1–5** with auto-score, **activity timeline** (every event chronologically), quick contact buttons |
| Viewings | Month calendar + table, confirm / reschedule / cancel |
| Agents / Agencies / Customers | CRUD with performance metrics |
| Analytics | SVG line chart (views), leads by source, conversion funnel, top areas |
| Promotions | Featured campaigns + homepage banners |
| Content | Area-guide CMS |
| Moderation | Reported-listings queue |
| Settings | Currencies, FX, fees, danger-zone reset |
| Audit | Append-only log of every admin action |

## Tech

| Layer | Tools |
|-------|-------|
| Markup / styles | Semantic HTML5 · modern CSS3 with custom-property design system |
| Frontend | Vanilla JavaScript (ES6+) - no framework |
| Maps | Leaflet + OpenStreetMap tiles (lazy-loaded only on map pages) |
| Photography | Curated Unsplash CDN pool, deterministic per-listing |
| State | `localStorage` (favorites, compare, searches, mortgage scenarios, every admin write) |
| Mock API | `fetch` shim under `js/mock-api.js` with ~50 endpoints |
| i18n | EN + partial AR dictionary with RTL flip |
| Charts | Hand-rolled SVG (line + funnel) and HTML/CSS bars |
| Hosting | Cloudflare Pages |

## Running locally

```bash
git clone https://github.com/saad-mughal435/manzil-marketplace.git
cd manzil-marketplace
python -m http.server 8000
# open http://localhost:8000
```

## Repository structure (10 customer pages + 1 admin)

```
.
├── index.html              # Marketplace home
├── search.html             # List + map results
├── listing.html            # Property detail
├── agents.html / agent.html
├── areas.html  / area.html
├── mortgage.html
├── valuation.html
├── yield.html
├── compare.html
├── account.html
├── admin.html              # 13-section admin SPA
├── 404.html                # Branded 404
├── css/property.css        # Emerald + gold design system
└── js/                     # data (65 listings, 24 agents, etc.),
                            # mock-api, search, listing-detail,
                            # admin-sections, app, notifications
```

## Canonical source

Mirror of `site/property/` from the main portfolio repo:

📦 **[saad-mughal435/site](https://github.com/saad-mughal435/site)** (under `property/`)

## License

[MIT](LICENSE). All listings, agents, agencies, customers, inquiries and prices are fabricated for portfolio demonstration. RERA-style permit numbers are illustrative. Photography via [Unsplash](https://unsplash.com).

---

<div align="center">

Built by **[Muhammad Saad](https://saadm.dev)** · Electrical & Automation Engineer · ERP/OEE Developer · UAE-based, open to relocate worldwide.

</div>
