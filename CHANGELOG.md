# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.7.0] - 2026-05-14 — Vacation Homes host onboarding + verification queue

### Added
- **Host onboarding wizard** at `/vacation/host-onboard.html` — 6-step
  multi-page wizard with save-and-resume drafts:
  1. About you — name, email, UAE phone, languages, bio, password.
  2. Verification — upload Emirates ID front + back, passport (if
     non-resident), title deed (Mulkiya) or tenancy contract (Ejari),
     DTCM Holiday Homes permit (if Dubai), bank IBAN. Files stored as
     base64 thumbnails for the demo; PDFs stored by filename.
  3. Property basics — type, title, destination, address, **map-pin
     selector** (Leaflet lazy-loaded), beds / baths / sqft / max guests.
  4. Photos & description — upload from device or paste URL or pick
     stock photo. Cover photo badged.
  5. Amenities & rules — 26-amenity multi-select with icons,
     house-rule checklist, cancellation policy.
  6. Pricing & calendar — base nightly (with suggestion), weekend
     surcharge %, cleaning fee, min/max nights, instant-book toggle,
     blocked dates.
  7. Review + submit — side-by-side summary, "Edit" jumps, confirm
     checkbox, submit.
  - Edit-mode (`?mode=edit&id=L0XX`) prefills the wizard; live edits
    to material fields re-trigger admin review.
- **Admin verification queue** at `/admin#verifications` — two tabs
  (Host applications + Listing reviews) with status filter chips.
  Drawer modal shows all document thumbnails with per-document approve
  / reject actions plus overall ✓ Approve · ↻ Request changes · ✕
  Reject buttons. Audit-log + bell notifications on every decision.
  - Admin dashboard gains a clickable **"Pending verifications"** KPI
    + dynamic system alerts pointing into the queue.
  - Admin listings table gains a **Status column** + filter chips
    (All / Live / Pending / Changes / Paused / Rejected) + bulk
    Approve / Pause actions.
- **Host dashboard** at `/vacation/host-dashboard.html` — six
  hash-routed sections: listings (KPIs + pause/unpause), bookings
  (upcoming / in-progress / past / cancelled), calendar (per-listing
  click-to-toggle blocked dates), earnings (KPIs + 12-month bar
  chart), profile (edit display name / photo / bio / languages),
  verification (per-doc status with re-upload on rejected docs).
  - **Host picker** when no session exists — lets reviewers
    impersonate any seed host (e.g., `h09` with changes_requested) to
    see every state of the pipeline.
- **Listing status pipeline** — every listing now has a `status`
  field: `live` / `pending_review` / `changes_requested` / `paused` /
  `rejected`. Public marketplace endpoints filter to **live-only** so
  pending or rejected listings never appear in search. Direct ID/slug
  lookup still works so hosts can preview.
- **Seed data**: 5 host applications spanning every state, 2 new
  `pending_review` listings, 6 `DOCUMENT_TYPES` taxonomy, `verified_at`
  on 3 superhosts.
- **Mock API additions**: 11 new public host endpoints +
  6 new admin verification endpoints + 3 listing-approval endpoints.
- New homepage CTA: **"List a property ↗"** on the Vacation Homes
  PROJECTS entry.
- New `_redirects` aliases: `/list-property`, `/become-a-host`,
  `/host-dashboard`.
- New CSS components: `.v-stepper`, `.v-wizard`, `.v-doc-card`,
  `.v-status-chip`, `.v-host-shell`, `.v-host-nav`, `.v-verif-banner`,
  `.v-drawer-backdrop` / `.v-drawer`, `.v-empty-illustration`,
  `.v-photo-strip`, `.v-amenity-grid`, `.v-map-pin`.

### Changed
- `host.html` mailto CTA → real two-CTA landing (**Start listing**
  / **I'm already a host**) with "6 steps · ~10 min · documents
  reviewed in 24h" note.

## [1.6.0] - 2026-05-14 — Vacation Homes demo

### Added
- **Vacation Homes** — fifth interactive demo at `/vacation/`. UAE
  short-stay booking marketplace with 55 listings across 10 destinations
  (Dubai Marina, Palm Jumeirah, Hatta Mountains, RAK Beach, AD Corniche,
  Fujairah Beach, Liwa Desert, etc.). Demonstrates a shape of software
  the other demos don't have: **date-range booking with conflict
  checking** and **per-night pricing**.
  - Guest surface: 9 pages — index (hero with date+guest search,
    featured stays, destinations, top hosts, why-VH, recently-viewed),
    search (filter+list+map with date-aware availability filtering),
    stay (gallery + lightbox + availability calendar + sticky reserve
    sidebar with live pricing breakdown), checkout (full pricing
    breakdown + payment + house-rules acceptance + server-side conflict
    re-check on submit), success (booking confirmation with ref number),
    trips (guest dashboard: upcoming / in-progress / past / cancelled /
    saved / profile, with cancel-booking flow), host (become-a-host
    info + earnings estimator), destinations (10 UAE areas with hero
    photos + listing counts), 404 (branded).
  - Admin SPA: 11 hash-routed sections — dashboard (KPIs + booking
    trend bar chart + alerts), listings (CRUD + bulk feature/verify/
    instant-toggle/delete + CSV export), bookings (table + status
    pipeline + refund flow + CSV export), hosts (CRUD + Superhost
    verification), guests (with trip count + total spent), reviews
    (moderation queue), payments (revenue/payouts/platform fee KPIs),
    promotions (seasonal coupons), destinations CMS, settings
    (currencies + service fee + VAT + danger-zone reset), audit log.
  - **Custom hand-rolled date-range picker** (`js/calendar.js`) in
    vanilla JS — no library. Two-month grid, click check-in then
    check-out, hover preview of range, blocked/booked dates crossed
    out with diagonal hatch, "available" state, RTL-aware.
  - **Booking conflict check** in the mock API: POST /bookings runs
    `isAvailable()` against current bookings + blocked dates before
    creating; returns `{ok:false, error:'conflict', status:409}` on
    overlap. Client bounces user back to the stay page with a toast.
  - **Pricing engine** computes nightly subtotal (with weekend
    surcharge), cleaning fee, 10% service fee, 5% VAT, and total —
    live as the date range changes in the reserve sidebar.
  - **Realistic seed data**: 10 destinations, 26 amenities, 22 hosts
    (3 superhosts), 55 listings, 16 guests, 42 bookings spanning
    past-completed / in-progress / upcoming / pending / cancelled /
    disputed / refunded, 90 reviews tied to completed bookings.
    Photos via curated 40-URL Unsplash pool.
  - Sitemap entries for `/vacation/index.html`, `/vacation/search.html`,
    `/vacation/destinations.html`, `/vacation/admin.html`.
  - `_headers` cache rules for `/vacation/css/*` and `/vacation/js/*`.
  - `_redirects` aliases: `/vacation-homes`, `/stays`.
  - Fifth card on `demo.html` chooser (Four → Five different shapes).
  - New PROJECTS entry on the homepage under the existing "Other
    software demos" umbrella (no new featured section — keeps MES-first
    positioning intact).
- Warm sand + terracotta + teal design palette (`vacation.css`),
  distinct from Manzil's emerald + gold.

## [1.5.0] - 2026-05-14 — positioning rework

### Changed
- **MES-first identity sweep.** Reordered the portfolio so the
  manufacturing-systems work reads as the headline and the three web
  demos (b2c, b2b, property) read as evidence of breadth.
  - Hero eyebrow: `Available · UAE-based · …` →
    `Currently available in the UAE · Open to relocate worldwide`.
  - Noscript H2 (the line that surfaces in LinkedIn / Twitter cards):
    `… ERP / OEE Developer · Full-Stack` →
    `Electrical & Automation Engineer building ERP/OEE systems for
    manufacturing.`
  - Page `<title>`, meta description, OG title + description, Twitter
    title + description, JSON-LD Person `jobTitle` + `description`:
    all lead with the new sentence and end with `UAE-based, open to
    relocate worldwide`.
  - Noscript stack line: flat 16-tag run-on → grouped by category
    (Backend / Frontend / Manufacturing-ERP / Reporting / Deployment)
    so it matches the React Skills section.
  - "Computer Engineering major" → "Computer Engineering
    specialization" in all 5 places it appeared (FAQ JSON-LD, two
    hero subs, About paragraph, About aside).
  - `PROJECTS` array: MES card retitled `Kingsley MES / ERP / OEE
    Platform`, expanded bullets, broader real-stack tags, dedicated
    section header. Pebble & Co. gets a single umbrella header
    `Other software demos / Other shapes of software I can ship`
    above it; Anvil & Manzil drop their per-project section headers
    so all three web demos flow under one umbrella.

### Added
- **`What this proves` credibility strip** (new section between
  About and Experience). Four bullets — production-line ops /
  cross-department workflows / stack integration / paper→software —
  with the tagline "I build operations software because I've worked
  operations." Bridges hero positioning to project evidence.
- **3 stylized MES "screenshot" mockup cards** rendered above the
  featured MES project card. Pure CSS/JSX, no images required:
  Production dashboard (OEE 78%, 9,600 bph, 3,847 cs, 42 rejects +
  8-bar mini chart), QC batch record (5 PASS rows + verdict footer),
  Inventory + Sage (4 stock rows with sync ok / 312 short
  annotations). Swap-replaceable for real Kingsley screenshots later.
- **demo.html `Recommended 3-minute tour` panel** above the static
  walkthrough. Numbered 5-step guided path through the live MES app
  (Dashboard → Job order → QC → Inventory → Reporting), each with a
  one-line description and a deep-link button.

### Fixed
- **Realistic seeded data across `app/js/mock-api.js`.** Every screen
  of the live MES walkthrough was returning literal `1`s for unit
  costs, totals, debits, credits, balances, VAT, customs values, RM
  order values — read as "system broken" rather than "fabricated
  demo". Now derived from realistic AED unit costs (sugar 4.20 /
  preforms 0.18 / caps 0.045 / labels 0.038 / FG cases 9.60–19.20).
  Inventory scaled to factory levels (sugar 3.2t, preforms 480k,
  caps 510k, labels 470k, FG 1.6–3.8k cases). Customers 80k-500k
  credit limits with believable balances. Quotations / proforma /
  Sage drafts / accounting drafts / cashbook / AR / AP / customs /
  FTA / RM orders / price list / GL sales all derive from those
  unit costs so the math is internally consistent end-to-end. Bank
  balance, aging buckets, VAT summary, GRN values all replaced.

### Changed (contact page)
- Headline: `Let's talk. / I reply within 24 hours.` →
  `Let's discuss engineering, automation, manufacturing systems, or
  software opportunities.`. The 24-hour-reply line moves into the
  sub paragraph.
- Sub paragraph: prepended `Currently available in the UAE and open
  to relocate worldwide for the right full-time role, technical
  project, or manufacturing systems opportunity.` to mirror the
  homepage hero exactly.
- `Based in` row: `Dubai, United Arab Emirates` →
  `UAE · Open to relocate worldwide`.
- `Status` row: `Open to work` →
  `Open to full-time engineering / automation / software roles ·
  UAE & worldwide`.

### Added
- `.gitattributes` normalising line endings to LF (and CRLF only for
  `.bat`/`.ps1`), eliminating the LF→CRLF warnings on every Windows commit.
- `404.html` — branded not-found page with quick links back to home,
  demos, marketplace, storefront, wholesale, contact.
- `humans.txt` at `/humans.txt` — team, thanks, tooling notes.
- `.well-known/security.txt` (RFC 9116) — machine-readable security
  contact pointing at `SECURITY.md`.
- README badge: "Open to relocate worldwide".
- README file-tree entries for the new `property/` folder + new
  hygiene files.

### Changed
- `package.json` description and keywords no longer hard-code Dubai —
  now lead with "Electrical & Automation Engineer · ERP-OEE Developer"
  and "currently UAE-based, open to relocate worldwide". Version
  bumped from `1.0.0` (stale placeholder) to `1.4.0` to match the
  CHANGELOG. Added `bugs.url` field.
- README intro + footer rewritten to match new positioning.
- `_headers`: serve `humans.txt` and `.well-known/security.txt` with
  proper `text/plain; charset=utf-8` content type and 1-day cache.

## [1.4.0] - 2026-05-14

### Added
- **Manzil Properties** — Dubai real-estate marketplace demo at `/property/`.
  65+ listings across 15 UAE communities (Marina, Downtown, Palm, JBR,
  Business Bay, DIFC, JLT, Arabian Ranches, Emirates Hills, Springs, Meadows,
  Dubai Hills, DAMAC Hills, Mirdif, Al Barsha). 10 customer-facing pages
  including hero search, map-and-list results (Leaflet + OpenStreetMap),
  property detail with gallery lightbox, agent/agency profiles, area guides,
  mortgage calculator with full amortisation schedule, side-by-side compare,
  and customer dashboard. Admin SPA with 13 sections: dashboard, listings
  CRUD with bulk operations, inquiries inbox with pipeline, viewings
  calendar, agents, agencies, customers, analytics (line chart, funnel,
  leads-by-source), promotions, content CMS for area guides, moderation
  queue, settings, audit log. All API calls intercepted in-browser; all
  state in localStorage.
- AED/USD/GBP/EUR currency switcher and EN/AR locale toggle.
- Real Unsplash photography hot-linked into listings (curated 40-URL pool).
- Sitemap entries for `/property/index.html`, `/property/search.html`,
  `/property/areas.html`, `/property/mortgage.html`, `/property/admin.html`.
- `_headers` cache rules for `/property/css/*` and `/property/js/*`.
- `_redirects` aliases: `/manzil`, `/properties`, `/property/admin`.

## [1.3.0] - 2026-05-14

### Added
- **Pebble & Co.** - full direct-to-consumer storefront demo at `/b2c/`.
  Storefront, catalog, product detail, cart, multi-step checkout, customer
  account, and a Shopify-style admin panel (dashboard, orders, products,
  customers, promotions, analytics, email log, settings). In-browser
  notifications with toast + bell + demo event ticker.
- **Anvil Supply Co.** - full B2B wholesale portal demo at `/b2b/`.
  Catalog with table/grid toggle and bulk SKU paste, tier pricing, MOQ
  enforcement, contract discounts, quote request flow, approval workflow
  for orders over $1,000. Account dashboard with orders, quotes,
  invoices, recurring orders, users & roles, ship-to addresses. Admin panel
  with order queue, quote queue, approval queue, customers, analytics,
  email log, settings.
- Two new entries on the homepage `PROJECTS` array with direct CTAs to each
  storefront and admin.
- Sitemap entries for both demos.
- `_headers` cache rules for `/b2c/` and `/b2b/` static assets.

### Changed
- All B2B and B2C demo data is fabricated. No real APIs, no real payments,
  no real shipping. Each demo ships its own mock-api shim that intercepts
  fetch + XHR for its prefix.

## [1.2.0] - 2026-05-14

### Added
- Visible tech-stack section with 9 groups and 60+ tools/technologies.
- FAQ section with FAQPage JSON-LD for Google rich results.
- WebSite schema (JSON-LD) for sitelinks support.
- Bing Webmaster verification file.
- `.editorconfig`, `.prettierrc`, `package.json`, `LICENSE`, `CHANGELOG.md`,
  `CONTRIBUTING.md`, `SECURITY.md`.
- GitHub Actions lint workflow + issue / PR templates.

### Changed
- Title and messaging re-positioned around full-stack development and
  automation that replaces manual work (broader than Excel-specific framing).
- Hero snippet `does[]` reordered: coding tasks first, Krones management last.
- Removed em dashes (104 across 7 files) for consistent typography.
- Smaller code-window font + `pre-wrap` so long lines fit without horizontal
  scroll on any viewport.

### Fixed
- Horizontal overflow on mobile caused by inline-block hero title spans.
- CSS Grid columns shrinking correctly via `min-width: 0`.
- View-toggle indicator recomputes on window resize.

## [1.1.0] - 2026-05-13

### Added
- Full SEO meta: title, description, keywords, Open Graph, Twitter Cards,
  canonical URL, theme-color, Apple touch icon.
- Person JSON-LD structured data for Google Knowledge Graph.
- `robots.txt` + `sitemap.xml`.
- Mobile hamburger navigation.
- Comprehensive mobile responsive rewrite (hero, stats, projects, skills,
  contact, demo).
- Real headshot avatar in nav (replaces gradient "MS" mark).
- Circular profile picture on contact page.
- Dark mode toggle for live MES/ERP demo app.

### Changed
- Current job title to `ERP Developer / IT Administrator / Production Assistant`.
- View toggle pill order: All / Coding / Engineering.
- Education line includes Computer Engineering major.

### Security
- Replaced QC signatory names that survived initial sanitisation.

## [1.0.0] - 2026-05-13

### Added
- Initial portfolio: React 18 (CDN) homepage with animated hero, scroll-reveal
  sections, count-up stats, magnetic CTAs, gradient orbs.
- Static MES/ERP walkthrough page (`demo.html`) with fabricated data.
- Live disconnected MES/ERP app at `/app/` with admin auto-login and full
  fetch interception (zero network calls leave the browser).
- Contact form via Formsubmit.co AJAX integration.
- Cloudflare Pages deployment with `_headers` + `_redirects`.

[Unreleased]: https://github.com/saad-mughal435/site/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/saad-mughal435/site/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/saad-mughal435/site/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/saad-mughal435/site/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/saad-mughal435/site/releases/tag/v1.0.0
