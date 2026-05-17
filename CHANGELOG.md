# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.1.0] - 2026-05-17 - Sanad: AI customer-support copilot demo (seventh demo)

### Added
- **Sanad** at `/sanad/` - seventh interactive demo and the first one
  with real LLM integration. A SaaS-style customer-support helpdesk
  with Claude woven into every screen rather than bolted on as a
  separate chat widget. ~5,200 LOC across 6 HTML pages + 1 CSS + 10
  JS modules.
- **Agent inbox** (`sanad/inbox.html`) - three-column layout:
  conversation list with filter chips and live search; thread view
  with day separators, message bubbles, internal-note toggle and
  agent composer; right-hand **AI Copilot sidebar** with six cards -
  suggested reply (with knowledge-base citation chips and a one-click
  Insert into composer), conversation summary with topic tags,
  sentiment with confidence bar, auto-category with confidence, EN↔AR
  translation toggle, and quick actions (escalate, snooze, mark
  resolved). Each AI call shows a loading state and times-out
  gracefully to a "mock" badge.
- **Customer chat widget** (`sanad/chat.html`) - two views
  switchable from the topbar: an "embedded" preview on a fake
  company website (with the chat bubble in the corner), and a
  full-screen mode. Streaming-typewriter AI replies with clickable
  knowledge-base citation chips that open a side drawer.
  "Talk to a human" creates a real ticket in the agent inbox.
  Conversation history persists across reloads.
- **Knowledge base** (`sanad/kb.html`) - sidebar by category, search,
  77 seeded articles (20 fully written + 57 stubs) across 6
  categories. Hash-routed: `#/`, `#/category/{id}`,
  `#/article/{slug}`. Each article has a custom tiny markdown
  renderer (no library) and a helpful-vote widget. Admin-only AI
  actions per article: **Generate FAQ**, **Suggest improvements**,
  **Translate to Arabic**.
- **11-section admin SPA** (`sanad/admin.html`) - hash-routed:
  Dashboard (KPIs + 7-day bar + sentiment split + hourly heatmap +
  recent conversations + AI-cost ticker), Conversations (table with
  status filters), Knowledge base (CRUD + AI "Find gaps" that
  clusters recent tickets and proposes new articles), Categories
  (CRUD with auto-tag toggle), Agents (list + permission matrix for
  agent / lead / admin), Customers (directory with LTV), **AI
  Console** (model selector for Haiku 4.5 / Sonnet 4.6 / Opus 4.7,
  editable system prompt with test-with-sample preview, temperature
  / max-tokens / cache toggles), Analytics (daily volume bars,
  by-category split, AI calls by feature, fallback rate, latency,
  cost, CSV export), Integrations (Slack / Linear / Stripe /
  Webhook stubs), Settings (business info + reset-demo), Audit log
  with CSV export.
- **AI engine** (`sanad/js/ai-engine.js`) - `window.SanadAI` with 8
  feature methods: `replySuggestion`, `summarize`, `categorize`,
  `sentiment`, `kbAnswer` (with streaming option), `translate`,
  `generateFAQ`, `findKbGaps`. Each method builds a feature-specific
  system prompt and POSTs `{model, system, messages, max_tokens,
  stream?}` to `/api/sanad/ai/call`. On 503 or network error, falls
  back transparently to a deterministic pattern-matched response
  dictionary. Every call is logged to `/sanad/api/admin/ai-logs` so
  the admin dashboard can track usage, latency, and fallback rate.
- **Mock API surface** (`sanad/js/mock-api.js`) - fetch interceptor
  serving `/sanad/api/*` from `SANAD_DATA` + localStorage.
  Conversations (list / get / create / update / status / assign),
  messages (create), KB articles (CRUD + helpful-vote), categories
  (action-based CRUD), agents, customers, admin dashboard, settings,
  audit log, AI logs. ~375 LOC mirroring the proven POS mock-api
  pattern (with the operator-precedence parens lesson applied).
- **Seed data** (`sanad/js/data.js`) - 6 categories, 8 agents, 24
  customers (mix of EN and AR locales), 80 conversations across 5
  status buckets (22 open / 18 pending / 6 snoozed / 30 closed in
  last 7 days / 4 escalated), 227 messages generated from 16
  scripted conversation templates, 77 knowledge-base articles (20
  fully written + 57 titled stubs), 120 AI usage logs spread across
  the 6 features, 4 integrations, settings.
- **Design system** (`sanad/css/sanad.css`) - slate / charcoal +
  electric violet + mint accent. Distinct from every existing demo
  palette. Dark surfaces for the agent inbox and customer chat
  (where staff and end-users spend hours); light surfaces for the
  landing, KB, and admin.
- **Landing** (`sanad/index.html`) with three CTAs (Inbox, Chat,
  Admin), six-feature explainer grid, two-minute walkthrough.
- **404** branded not-found.
- **`sanad/README.md`** documents how to enable live mode (set
  `ANTHROPIC_API_KEY` as a Cloudflare Worker secret), the cost
  guardrails, and the file layout. Includes a copy-pasteable Worker
  reference implementation.

### Live mode vs Demo mode
- Out of the box, Sanad ships in **Demo mode** - the topbar shows a
  "Demo mode" badge and all AI features return realistic
  pattern-matched mock responses. The demo works 100% offline and
  never breaks for visitors.
- To enable **Live mode** (real Claude responses), the repo's
  Cloudflare Worker needs a `_worker.js` at root that proxies
  `/api/sanad/ai/*` to Anthropic with a server-side secret. The
  initial attempt to add this Worker (commit 036a7ea) failed the
  Cloudflare Workers Builds twice in a row - the build config
  doesn't auto-detect `_worker.js` alongside `assets.directory:
  "."`. The Worker has been removed from this commit, and
  `sanad/README.md` includes the copy-pasteable Worker plus the
  Cloudflare dashboard steps to enable live mode opt-in.

### Portfolio integration
- `demo.html` - seventh demo card and intro copy bumped "Six" →
  "Seven different shapes".
- `index.html` - new PROJECTS entry between Qahwa POS and Pebble &
  Co. with four CTAs (Inbox / Chat / KB / Admin), and a new bullet
  in the "Other software demos" list.
- `_headers` - cache rules for `/sanad/css/*` and `/sanad/js/*`.
- `_redirects` - friendly aliases `/sanad-app`, `/copilot`,
  `/helpdesk`. (`/sanad` redirect omitted - it conflicts with the
  static index at `/sanad/`.)
- `sitemap.xml` - 5 new entries.
- `README.md` - new row in the demos table with live-mode caveat.

### Changed
- Bumped to **2.1.0** (minor) - new vertical, no breaking changes to
  the existing six demos.

## [2.0.0] - 2026-05-15 - Qahwa POS: café & quick-service POS demo (sixth demo)

### Added
- **Qahwa POS** at `/pos/` - sixth interactive demo. Café and
  quick-service point-of-sale system covering the in-person retail /
  F&B vertical that the previous five demos did not.
  ~5,000 LOC across 6 HTML pages + 1 CSS file + 7 JS modules.
- **Cashier terminal** (`pos/terminal.html`) - touch-optimized layout
  with PIN lock screen, category tabs + product grid + search, cart
  pane with qty steppers and modifier preview, modifier modal
  (size / milk / syrup / extras with per-option price deltas),
  payment flows (cash with numpad + change calculation, card with
  simulated approval, split cash + card), discount modal with %/AED/
  coupon, hold/void/KOT, receipt preview with print and email.
- **Kitchen Display System** (`pos/kitchen.html`) - polls
  `/orders/kitchen` every 5 seconds, big card layout with elapsed-
  time warnings (amber > 5 min, red > 8 min), per-line ready
  checkboxes, "Mark all served" buttons, Web Audio API chime on new
  orders, completed-strip at the bottom.
- **14-section admin SPA** (`pos/admin.html`) - hash-routed:
  Dashboard (KPIs, weekly bar chart, hourly heatmap, top products,
  payment-method breakdown, recent orders), Live orders (filter
  pipeline + per-order modal with status override + refund),
  Products (CRUD + bulk activate / deactivate / delete + modifier-
  group multi-link + margin calc), Categories, Modifiers (groups +
  options with price deltas), Discounts, Tables (floor plan with
  status-cycle on click), Staff (RBAC with permission matrix),
  Shifts (open / close with cash-denomination count + variance +
  Z-report), Reports (date-range bar chart, top products, by
  cashier, hourly distribution, payment methods, CSV export),
  Inventory (low-stock alerts + manual adjust), Receipt template
  (live preview with editable header / footer / TRN / VAT note),
  Settings (business + tax + ops + reset-demo), Audit log (CSV
  export).
- **Landing page** (`pos/index.html`) - hero with three big CTAs
  (terminal / KDS / admin), demo-PIN reference, "What's inside" 6-
  card grid, end-to-end try-it walkthrough.
- **Receipt page** (`pos/receipt.html`) - public receipt view with
  `?order=ID`, print stylesheet, copy-link button.
- **404 page** (`pos/404.html`) - branded not-found in the espresso /
  caramel palette.
- **Mock API surface** (`pos/js/mock-api.js`) - fetch interceptor
  serving `/pos/api/*` from `POS_DATA` + localStorage. ~30 routes
  covering auth (PIN-based), catalogue (products / categories /
  modifiers), orders (full state machine open → kitchen → ready →
  served → completed plus refunded / held / voided), kitchen
  polling, tables / shifts / inventory, and full admin CRUD. Pricing
  helper recomputes subtotal / 5% VAT / total on every mutation;
  inventory deducts via product → ingredient recipes on payment.
  Audit log + notifications persisted to localStorage.
- **Seed data** (`pos/js/data.js`) - 8 categories, 4 modifier
  groups, 49 products, 4 staff (PINs 1234 / 5678 / 1111 / 2222),
  12 tables with floor positions, 30 orders spanning every status,
  3 shifts, 4 discounts, 20 inventory items, settings (5% VAT, AED,
  Qahwa Café · Downtown Dubai).
- **Design system** (`pos/css/pos.css`) - espresso / caramel / cream
  palette distinct from prior demos. Dark surfaces for the terminal
  (cafés are often dim), light surfaces for admin. Touch-friendly
  sizing throughout (≥ 44 px tap targets, ≥ 60 px action buttons,
  ≥ 16 px primary text).

### Portfolio integration
- `demo.html` - sixth demo card added (Café POS) between Vacation
  Homes and the close of the chooser. Intro copy bumped from
  "Five demos" → "Six demos".
- `index.html` PROJECTS list - new Qahwa POS entry between
  Vacation Homes and Pebble & Co.
- `_headers` - cache rules for `/pos/css/*` and `/pos/js/*`.
- `_redirects` - friendly aliases `/qahwa`, `/cashier`, `/kds`.
- `sitemap.xml` - 4 new entries (index / terminal / kitchen / admin).

### Changed
- Bumped to **2.0.0** to mark the new vertical. The portfolio now
  ships six full interactive demos plus the MES walkthrough.

## [1.9.0] - 2026-05-16 - Manzil owner onboarding wizard + admin verification queue

### Added
- **Owner onboarding wizard** at `/property/owner-onboard.html` -
  full producer side of the Manzil marketplace. 6-step wizard with
  save-and-resume drafts in localStorage (`manzil.owner_draft`):
  1. About you - name, email, UAE mobile, languages, password, bio.
  2. Verification - Emirates ID front + back, passport (if non-
     resident), Title Deed (Mulkiya or Oqood), DLD permit number,
     NOC from developer (off-plan / rental), POA (optional), bank
     IBAN. File uploads stored as base64 thumbnails.
  3. Property basics - transaction (buy/rent/off-plan), type,
     community/area dropdown, **map-pin selector** (Leaflet lazy-
     loaded), beds/baths/sqft/year_built, completion status.
  4. Photos & description - upload from device or paste URL or
     stock photo. Cover photo badged.
  5. Amenities & features - 26-amenity multi-select, parking
     spots, furnished toggle.
  6. Pricing & terms - branches by transaction type:
     - Buy: asking price + previous price + commission % + service
       charge.
     - Rent: annual rent + cheques + deposit + contract length.
     - Off-plan: total price + down payment + handover + payment plan.
     Plus available-from date, viewings-by-appointment, negotiable
     toggle.
  7. Review + submit - section cards with Edit jumps + confirm
     checkbox.
  Demo-data button prefills every field so reviewers can click
  Continue through to submit without typing.
- **Admin verification queue** at `/property/admin.html` -
  two new sections under a new **"Approvals"** sidebar group:
  - **Owner approvals** (`#owner_approvals`) - identity + ownership
    document review queue with status-filter chips (submitted /
    changes_requested / approved / rejected). Drawer modal shows
    all docs as thumbnails with per-doc approve/reject buttons
    plus overall ✓ Approve · ↻ Request changes · ✕ Reject.
  - **Listing approvals** (`#listing_approvals`) - listings whose
    owner is verified. Filter chips (Pending review / Changes
    requested / Live / Paused / Rejected / All). Drawer modal
    shows listing details + photos + approve/reject.
  Audit-log entries on every decision.
- **Owner dashboard** at `/property/owner-dashboard.html` - 6
  hash-routed sections: My listings (KPIs + pause/unpause), Inquiries,
  Availability, Earnings (portfolio value), Profile, Verification.
  Owner picker on first visit so reviewers can impersonate any of
  5 seed owners spanning every state (o01 approved, o02 submitted,
  o03 changes_requested, o04 rejected, o05 just-submitted).
- **Listing status pipeline** - listings now flow
  `awaiting_owner_verification` → `pending_review` → `active`,
  with terminal states `changes_requested` / `paused` / `rejected` /
  `sold` / `rented` / `expired`. Public marketplace stays filtered to
  `active` only - pending or rejected listings never appear in
  search. Direct ID/slug lookup still works for owner preview.
- **Cascade approval**: when admin approves an owner, all that
  owner's listings sitting at `awaiting_owner_verification` flip to
  `pending_review` and surface in the listing-approval queue.
- **Seed data** (`property/js/data.js`): 5 owners + 5 owner
  applications spanning every status, 8 DOCUMENT_TYPES taxonomy
  with required-when rules, 2 new `awaiting_owner_verification`
  seed listings + 1 `pending_review` listing so both admin queues
  are non-empty on cold start. `LISTING_STATUSES` const added.
- **Mock API additions** (`property/js/mock-api.js`): 11 new
  public owner endpoints (`/auth/owner-signup`, `/owner/session`,
  `/owner/applications`, `/owner/listings`, `/owner/inquiries`,
  `/owner/dashboard`, etc.) + 5 admin verification endpoints
  (`/admin/verifications`, per-owner approve/request-changes/reject,
  per-doc approve/reject, `/admin/listings/{id}/{approve|request-
  changes|reject}`). Cascade logic on owner approval.
- **CSS additions** (`property/css/property.css`): new components
  `.m-stepper`, `.m-wizard`, `.m-doc-card`, `.m-status-chip` with
  9 state variants, `.m-host-shell`, `.m-drawer-backdrop` /
  `.m-drawer`, `.m-empty-illustration`, `.m-photo-strip`,
  `.m-amenity-grid`, `.m-map-pin`. ~250 LOC added.
- New "List your property" CTA card on `/property/index.html`
  (alongside Valuation + Yield calculators).
- New `_redirects` aliases: `/list-property` → owner-onboard.html,
  `/owner-dashboard` → owner-dashboard.html.
- New sitemap entries for owner-onboard.html + owner-dashboard.html.
- Homepage PROJECTS Manzil entry updated: new "List a property ↗"
  CTA, bullets describe the owner-side wizard + admin verification
  queue, and tags include "Owner onboarding wizard", "Document
  upload", "Verification queue".

## [1.8.1] - 2026-05-15 - Wording polish + skills bars → tier pills

### Changed
- **Static `<noscript>` fallback** - "Other software demos" list now
  matches the React PROJECTS order: **Anvil → Manzil → Vacation Homes
  → Pebble**. Added Vacation Homes (previously missing). Matters for
  SEO crawlers, LinkedIn previews, and corporate networks that strip
  JavaScript.
- **FAQ** - public salary question removed. Replaced with "What type
  of roles is Saad open to?" covering automation / ERP-MES /
  manufacturing systems / backend / IT ops / NOC / industrial
  maintenance / Python-heavy. FAQ heading "About Saad M…" →
  **"About Muhammad Saad…"**. "Who is Saad M?" → "Who is Muhammad
  Saad?".
- **Hero / code card** - primary CTA "Hire me →" → "Contact me →"
  (less assertive, better for recruiter audiences). Code-card role
  line "Systems Builder" → **"Operations Software Builder"**.
- **Metrics** - "departments digitised by the MES/ERP I built" →
  "departments digitized through MES/ERP workflows" (US spelling +
  clearer). "Krones subsystems owned end-to-end" → "Krones
  subsystems supported end-to-end" (more accurate for machinery
  context).
- **About** - second-paragraph next-goal sentence rewritten:
  "...That's what I want to do next - build automation, backend,
  ERP/MES, or technical operations systems for teams where
  reliability and real workflows matter."
- **Contact** - role list rewritten to centre on the strongest
  identity: "...automation, ERP/MES, manufacturing systems, backend
  engineering, IT operations, or Python-heavy technical roles..."
- **"Other software demos" section heading** - "Other shapes of
  software I can ship" → **"Other product demos I can ship"**.
- **Kingsley experience bullets** - reordered + tightened from 6
  bullets to 5 so the strongest two points (MES/ERP shipped + ~60%
  reporting-time cut) land at the top for fast scanners.
- **Skills section** - percentage progress bars **replaced with
  status-tier pills**. New 4-tier taxonomy:
  - `production` (teal) - shipping real production code with it today
  - `comfortable` (blue) - used in significant projects, can debug end-to-end
  - `working` (sand) - solid working knowledge, productive but not deep
  - `learning` (lavender) - actively learning / academic / in-progress
  Every skill row in the `SKILLS` array converted from `[name, percent]`
  to `[name, tier]`. New `.skill-tier--*` CSS variants in `home.css`;
  deprecated `.bar` / `.bar-lbl` rules removed from `home.css` (still
  present in `styles.css` for other pages that use them). React
  `SkillCard` renderer rewritten to paint the new pill.

### Added
- **MES featured card - "Best first view" hint.** New `ctaTip`
  field renders a small panel under the two CTA buttons telling
  reviewers to open the static walkthrough first (3-min tour), then
  the live interactive demo. Helps avoid the "open live → bounce off
  empty modules" failure mode.

## [1.8.0] - 2026-05-15 - Portfolio credibility polish (deep-scan round)

### Changed
- **MES walkthrough `demo.html`** - replaced every placeholder `1` /
  `AED 1.00` / `1 cpm` / `1%` across Job Orders, picking sheet,
  production control, batches today, inventory (RM + FG), QC
  measurements, GRN list, supplier lead times, quotations, performa
  invoice, dispatch, POs, vouchers, Sage entries, FG yield, forecast,
  customs/FTA, OEE ring chart, line speeds, and all six PDF templates
  with realistic fabricated numbers (e.g. 4,800 cs × AED 8.45 =
  AED 40,560; OEE 82%; speed 9,600 bph; QC measurements with proper
  spec ranges).
- **B2C `Pebble & Co.`** - fixed the lone "p" that rendered as garbage
  before the Trending section (now reads "Pebble" with a fluid
  `clamp()` font size). Softened the rating line from
  "★★★★★ 4.7 (2,840 reviews)" to "★★★★★ 4.7 demo rating · seed
  review data".
- **B2B `Anvil Supply Co.`** - prefixed hero copy with "Demo catalog
  with 40+ sample SKUs from 8 fictional manufacturers". Top sellers
  lead now reads "Sample best-selling SKUs from fictional customer
  activity".
- **Property `Manzil Properties`** - rewrote tagline ("Portfolio demo
  with 65+ sample listings..."), recent-closings eyebrow ("Sample
  data" / "Sample recent closings"), top-agents eyebrow ("Sample
  brokers" / "Demo agent profiles"), and the four trust cards:
  Verified listings → Status pipeline, Licensed agents → Agent
  profiles, Real photography → Representative imagery, Transparent
  pricing → Price history. No more "live" / "verified" / "actual
  photographs" claims.
- **Homepage `index.html`** - H2 trailing period removed; contact
  bullets switched from middot to colon; PROJECTS array reordered
  Anvil (B2B) → Manzil (Property) → Vacation Homes → Pebble (B2C)
  so the B2B demo closest to the manufacturing brand leads, and the
  B2C storefront sits last as supporting evidence. "Other software
  demos" blurb updated from "Three additional" to "Four additional".
- **Contact `contact.html`** - rewrote the ambiguous "reply within 24
  hours" sentence so the subject is unambiguously the author, added
  WhatsApp to the list of channels, appended ` · PDF` to each CV
  download button. `.contact-k::after` now renders a `:` after every
  field label (Status now reads "Status:" properly).

### Added
- `assets/portfolio-banner.js` + `assets/portfolio-banner.css` - a
  dismissible top strip ("Portfolio demo · fabricated data · ← back
  to saadm.dev") loaded by each sub-site's `app.js`. Recruiters who
  land directly on `/b2c/`, `/b2b/`, `/property/`, or `/vacation/`
  via a shared URL now see the demo framing above the fold instead
  of having to scroll to the footer. Banner is dismissible with
  `localStorage.portfolioBannerDismissed = '1'` state.
- **`/app/` demo guide** - a soft top panel on the live MES app
  dashboard pointing reviewers at the five most-populated tour pages
  (Dashboard / Job Orders / Quality Control / Inventory / Reporting)
  so they don't get lost in modules that intentionally show empty
  states. Dismissible.

### Deferred
- MES card thumbnail / synthetic dashboard mock-up on the homepage -
  flagged in the plan but skipped this round. Can ship as a follow-up.
- Seeding the `/app/` mock interceptor with realistic demo data for
  the five tour pages - current round adds the demo guide pointing
  to them, but the data seed remains a follow-up.

## [1.7.0] - 2026-05-14 - Vacation Homes host onboarding + verification queue

### Added
- **Host onboarding wizard** at `/vacation/host-onboard.html` - 6-step
  multi-page wizard with save-and-resume drafts:
  1. About you - name, email, UAE phone, languages, bio, password.
  2. Verification - upload Emirates ID front + back, passport (if
     non-resident), title deed (Mulkiya) or tenancy contract (Ejari),
     DTCM Holiday Homes permit (if Dubai), bank IBAN. Files stored as
     base64 thumbnails for the demo; PDFs stored by filename.
  3. Property basics - type, title, destination, address, **map-pin
     selector** (Leaflet lazy-loaded), beds / baths / sqft / max guests.
  4. Photos & description - upload from device or paste URL or pick
     stock photo. Cover photo badged.
  5. Amenities & rules - 26-amenity multi-select with icons,
     house-rule checklist, cancellation policy.
  6. Pricing & calendar - base nightly (with suggestion), weekend
     surcharge %, cleaning fee, min/max nights, instant-book toggle,
     blocked dates.
  7. Review + submit - side-by-side summary, "Edit" jumps, confirm
     checkbox, submit.
  - Edit-mode (`?mode=edit&id=L0XX`) prefills the wizard; live edits
    to material fields re-trigger admin review.
- **Admin verification queue** at `/admin#verifications` - two tabs
  (Host applications + Listing reviews) with status filter chips.
  Drawer modal shows all document thumbnails with per-document approve
  / reject actions plus overall ✓ Approve · ↻ Request changes · ✕
  Reject buttons. Audit-log + bell notifications on every decision.
  - Admin dashboard gains a clickable **"Pending verifications"** KPI
    + dynamic system alerts pointing into the queue.
  - Admin listings table gains a **Status column** + filter chips
    (All / Live / Pending / Changes / Paused / Rejected) + bulk
    Approve / Pause actions.
- **Host dashboard** at `/vacation/host-dashboard.html` - six
  hash-routed sections: listings (KPIs + pause/unpause), bookings
  (upcoming / in-progress / past / cancelled), calendar (per-listing
  click-to-toggle blocked dates), earnings (KPIs + 12-month bar
  chart), profile (edit display name / photo / bio / languages),
  verification (per-doc status with re-upload on rejected docs).
  - **Host picker** when no session exists - lets reviewers
    impersonate any seed host (e.g., `h09` with changes_requested) to
    see every state of the pipeline.
- **Listing status pipeline** - every listing now has a `status`
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

## [1.6.0] - 2026-05-14 - Vacation Homes demo

### Added
- **Vacation Homes** - fifth interactive demo at `/vacation/`. UAE
  short-stay booking marketplace with 55 listings across 10 destinations
  (Dubai Marina, Palm Jumeirah, Hatta Mountains, RAK Beach, AD Corniche,
  Fujairah Beach, Liwa Desert, etc.). Demonstrates a shape of software
  the other demos don't have: **date-range booking with conflict
  checking** and **per-night pricing**.
  - Guest surface: 9 pages - index (hero with date+guest search,
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
  - Admin SPA: 11 hash-routed sections - dashboard (KPIs + booking
    trend bar chart + alerts), listings (CRUD + bulk feature/verify/
    instant-toggle/delete + CSV export), bookings (table + status
    pipeline + refund flow + CSV export), hosts (CRUD + Superhost
    verification), guests (with trip count + total spent), reviews
    (moderation queue), payments (revenue/payouts/platform fee KPIs),
    promotions (seasonal coupons), destinations CMS, settings
    (currencies + service fee + VAT + danger-zone reset), audit log.
  - **Custom hand-rolled date-range picker** (`js/calendar.js`) in
    vanilla JS - no library. Two-month grid, click check-in then
    check-out, hover preview of range, blocked/booked dates crossed
    out with diagonal hatch, "available" state, RTL-aware.
  - **Booking conflict check** in the mock API: POST /bookings runs
    `isAvailable()` against current bookings + blocked dates before
    creating; returns `{ok:false, error:'conflict', status:409}` on
    overlap. Client bounces user back to the stay page with a toast.
  - **Pricing engine** computes nightly subtotal (with weekend
    surcharge), cleaning fee, 10% service fee, 5% VAT, and total -
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
    software demos" umbrella (no new featured section - keeps MES-first
    positioning intact).
- Warm sand + terracotta + teal design palette (`vacation.css`),
  distinct from Manzil's emerald + gold.

## [1.5.0] - 2026-05-14 - positioning rework

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
  About and Experience). Four bullets - production-line ops /
  cross-department workflows / stack integration / paper→software -
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
  order values - read as "system broken" rather than "fabricated
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
- `404.html` - branded not-found page with quick links back to home,
  demos, marketplace, storefront, wholesale, contact.
- `humans.txt` at `/humans.txt` - team, thanks, tooling notes.
- `.well-known/security.txt` (RFC 9116) - machine-readable security
  contact pointing at `SECURITY.md`.
- README badge: "Open to relocate worldwide".
- README file-tree entries for the new `property/` folder + new
  hygiene files.

### Changed
- `package.json` description and keywords no longer hard-code Dubai -
  now lead with "Electrical & Automation Engineer · ERP-OEE Developer"
  and "currently UAE-based, open to relocate worldwide". Version
  bumped from `1.0.0` (stale placeholder) to `1.4.0` to match the
  CHANGELOG. Added `bugs.url` field.
- README intro + footer rewritten to match new positioning.
- `_headers`: serve `humans.txt` and `.well-known/security.txt` with
  proper `text/plain; charset=utf-8` content type and 1-day cache.

## [1.4.0] - 2026-05-14

### Added
- **Manzil Properties** - Dubai real-estate marketplace demo at `/property/`.
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
