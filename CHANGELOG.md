# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [5.10.1] - 2026-06-11 - Demo frame: technical lines, link previews, back-links

### Added

- Every demo card on demo.html carries a one-line "Technically:" summary (what the demo
  actually exercises - conflict-check booking, 5s-poll KDS, streaming LLM proxy, WPS payroll
  runs, etc.) so engineers can triage the gallery without opening each app.
- Marsad and Nabta landings get OG/Twitter blocks (they were the last two without link previews).
- B2B and B2C landings get the standard "<- saadm.dev" back-link in the hero (they were
  footer-only).

## [5.10.0] - 2026-06-11 - Professional read: restrained motion + one role story

### Changed

- **Motion layer slimmed to smooth scroll + subtle parallax.** The custom cursor, magnetic
  buttons and 3D card tilt are removed (code and CSS, not just disabled) - content-first.
  home.fx.js/css cache-busted across all 78 referencing pages.
- **One role story everywhere: backend, software engineering, ERP/MES, automation.** The
  six-track enumerations (including NOC, web development, technical operations and the noscript
  block's industrial maintenance) are gone from the homepage contact copy, FAQ + FAQPage JSON-LD,
  meta description, noscript fallback, contact page, and package.json. The Engineering view
  toggle still carries the industrial story for those who look.
- **Code-view project order:** ShopFloor API, hft-orderbook, n8n-nodes-devtools, then
  playwright-e2e - backend reviewers meet the Java backend and the systems flagship first.
  Content unchanged, order only.

## [5.9.9] - 2026-06-11 - Honest CI, WebP headshot, corpus and copy hygiene

### Changed

- **The Lint workflow can now actually fail.** All three jobs ran with swallowed exits
  (`|| true`, `fail: false`) - a green badge that could never turn red. Now: node --check parses
  every served script, html-validate runs a tuned-but-honest ruleset over the shell pages, notes
  and the L2 viewer (367 issues triaged: stylistic rules that conflict with deliberate choices are
  disabled with written rationale, 131 th elements gained scope="col", two intentional role=list
  divs carry inline disables), and the offline link check fails the job (root-dir fixed - its 12
  "errors" were all one false positive).
- **Headshot served as WebP** (20 KB vs the 84 KB palette PNG) everywhere it renders; PNG remains
  only for the apple-touch-icon and JSON-LD image.
- Chatbot corpus header no longer cites hardcoded index.html line numbers (they rotted on every
  release); replaced with a re-chunk maintenance note. Demos section copy now mentions the two
  earlier-work cards so the card count reads consistently. Proof section's Omdena card links to
  LinkedIn (where the role is listed) instead of the generic omdena.com homepage.
- One git author identity going forward (saad@saadm.dev) + .mailmap for the historical mix.

## [5.9.8] - 2026-06-11 - CSP: drop unsafe-eval and the Tailwind CDN

### Security

- With /app/ on precompiled Tailwind (5.9.7), the enforced Content-Security-Policy no longer
  allows 'unsafe-eval' or cdn.tailwindcss.com in script-src/style-src. Nothing served by the
  site evaluates code at runtime anymore. Browser-verified on /app/ (modules, dark mode,
  reception) before and after tightening.

## [5.9.7] - 2026-06-11 - /app/ Tailwind precompiled (no more runtime JIT)

### Changed

- The MES demo no longer loads the Tailwind Play CDN (runtime JIT compiler that forces
  'unsafe-eval' into the site CSP). Utilities are now precompiled into app/css/tailwind.css
  (55 KB minified) via `npm run build:appcss` (tailwindcss v3, default config - the app's dark
  theme lives in the hand-written dark.css, no dark: variants). The compiled sheet loads after
  dark.css to preserve the cascade order the runtime injection had. Re-run build:appcss whenever
  app/ markup adds new utility classes.

## [5.9.5] - 2026-06-11 - Deep-check fixes: four real demo bugs

Found by a browser-level sweep + flow tests (Playwright against production) across all demos.

### Fixed

- **POS kitchen display never showed orders** - the generic `/orders/:id` mock route matched
  `/orders/kitchen` before the literal kitchen route, so the KDS polled an eternal not_found
  while the terminal and admin both showed orders in the kitchen. Route now lets `kitchen`
  fall through (pos/js/mock-api.js).
- **Sanad inbox was click-dead on desktop** - the fx layer's `html.lenis body { height: auto }`
  out-specified `body.sanad { height: 100vh }`, collapsing the page behind `overflow: hidden`
  so nothing was hit-testable. `html.lenis body.sanad { height: 100vh }` re-asserts the app
  shell (sanad/css/sanad.css). Mobile was never affected (fx does not load there).
- **MES /app/ Accounting tabs threw `entries.slice is not a function`** - the mock returned
  bare arrays while the module reads `.entries`; on an array that resolves to
  `Array.prototype.entries` (a function) and the `|| []` guard never fires. Mock now returns
  the `{entries: [...]}` envelope (app/js/mock-api.js).
- **Manzil mortgage calculator showed "AED Infinity"** when the tenure field was cleared -
  `computeMortgage` now clamps/guards all inputs (property/js/app.js).
- Vacation reserve sidebar now labels the weekend rate in its per-night line, so
  `AED 1,450 x 3 nights` no longer appears to disagree with its own subtotal
  (vacation/js/stay-detail.js).
- Contact page "Email me" CV link is underlined (axe link-in-text-block, both themes).

## [5.9.4] - 2026-06-11 - Recheck fixes

### Fixed

- **Dead CV download buttons removed from contact.html** - three buttons still pointed at the
  deleted cv/ PDFs and 404ed at the exact moment a recruiter shows intent. Replaced with a
  one-line "email me for a CV" note until a real PDF exists.
- **Ask Saad chatbot corpus brought in line with the truth pass** - Manzil 15 -> 13 sections,
  Vacation Homes 12 -> 11 sections and 55+ -> 54 stays (cache-bust corpus.js?v=20260611a).
- README no longer instructs contributors to use the deleted run.bat / push.bat.

## [5.9.3] - 2026-06-11 - Fix CSP regression on the /app/ MES demo

### Fixed

- The enforced CSP in 5.9.2 dropped `cdn.tailwindcss.com` and `unsafe-eval`, which broke the
  Kingsley MES demo at /app/ (it uses the Tailwind Play CDN, which compiles classes in the browser
  and requires both) - the page rendered unstyled with a full-size logo. Restored both to the
  (still enforced) policy. Follow-up: self-host a compiled Tailwind build for /app/ so `unsafe-eval`
  can be dropped again site-wide.

## [5.9.1] - 2026-06-11 - Minified bundle + self-hosted React

### Performance

- **home.app.js is now minified** (babel -> terser in build:home): 103 KB -> 81 KB raw, with the
  remaining weight being content strings; gzips much smaller. The unminified compiled
  intermediate is neither committed nor served.
- **React + ReactDOM are self-hosted** from /vendor/ (pinned 18.3.1 production UMD builds)
  instead of unpkg - removes a third-party availability dependency and the SRI question for the
  homepage's render path; the unpkg preconnect is gone.

## [5.9.0] - 2026-06-11 - Repo hygiene and truthfulness pass

### Removed

- **Internal tooling no longer ships with the site** - the scripts/ directory (profile/repo setup
  helpers, OG-card and CV-stub generators), push.bat, run.bat and the orphaned index.v4.html are
  gone from the repository; a new .assetsignore also stops home.app.jsx, package files and
  node_modules from being served in production.
- meta keywords tags (ignored by search engines for years) and the profile:gender OG tag.
- "Tailored CVs" wording on the contact path - no CV downloads are promised until real PDFs exist.

### Changed

- **Order-book viewer copy now states exactly what it shows**: a synthetic ITCH session (generated
  by hft-orderbook's gencap) replayed through the real reconstruction engine, with ?ws= for a live
  wsbook feed. "Live" wording removed from the homepage, viewer head/explainer, notes, changelog
  and project card; real BinaryFILE captures are credited to the benchmark suite where they belong.
- **/app/ described accurately and licensed correctly**: the Kingsley MES/ERP demo UI is published
  with Kingsley Beverage FZCO's permission, all data fabricated; it is now explicitly excluded
  from the repo's MIT license (see app/LICENSE-NOTICE.md). One leftover real customer name in a QC
  form placeholder replaced; a sweep for other real names came back clean.
- Admin section counts corrected to match the code (Manzil 13, Vacation Homes 11); duplicate
  "AI-powered AI" phrasing fixed; humans.txt and sitemap lastmod dates refreshed; og.png
  cache-bust no longer uses a future date.

## [5.8.0] - 2026-06-11 - Engineering notes at /notes/

### Added

- **/notes/ - three engineering write-ups in the v5 shell** (same nav, fonts, theme bootstrap,
  social rail as contact.html; new notes.css article typography on existing tokens):
  - *Reconstructing the NASDAQ book: ITCH 5.0 decode and a lock-free SPSC pipeline* - real code
    from hft-orderbook (big-endian readers, SPSC ring), the BinaryFILE/MoldUDP64 split, the
    measured level-store A/B with its caveats, and the sanitizer CI story.
  - *An open OEE engine: building ShopFloor API next to a production MES* - the
    private-production / open-companion frame, the OeeCalculator edge cases, compute-at-close,
    Flyway + validate, Testcontainers.
  - *What running Krones lines taught me about writing operations software* - essay; the 6 a.m.
    handover, beating paper, the report as the product, honest measurement.
- Per-article TechArticle JSON-LD + OG/Twitter cards; CollectionPage + ItemList on the index;
  4 new sitemap.xml entries. Code samples render as plain bordered pre blocks (no fake window
  chrome), copied from the public repos.
- **Notes in the navigation** - homepage nav (7th link) + footer + noscript block + a 5th FAQ
  entry (mirrored in the FAQPage JSON-LD); contact.html and demo.html navs updated.

## [5.7.0] - 2026-06-11 - Proof section

### Added

- **"Verifiable, not just claimed." (Fig. 02 - Proof)** between About and Experience - four quiet
  cards, each a claim that can be checked in one click: the production MES/ERP at Kingsley (with
  the public walkthrough), open-source repos with green GitHub Actions CI, the published npm
  package @saadmughal435/n8n-nodes-devtools, and the Omdena open collaborations. Same card
  language as the stats row; no carousels, no avatars, no invented counts.
- Quote slots (`PROOF_QUOTES`) ship empty and render nothing - short manager/colleague quotes can
  be added later without any markup changes.

## [5.6.0] - 2026-06-11 - Homepage restructure: Demos before Skills + dual-track hero

### Changed

- **Demos now render directly after Projects** - the ten product demos read before the skills chip
  wall instead of being buried under it. Fig tags renumbered (Experience 03, Projects 04, Demos 05,
  Skills 06, Contact 07; 02 reserved for the upcoming Proof section).
- **Dual-track hero line** - a quiet mono "Two tracks" line under the CTAs, identical in every view:
  Python/FastAPI ERP + backend systems and C++17 low-latency market data, with direct links to
  hft-orderbook and the L2 viewer. The HFT story no longer hides behind the view toggle.
  The code-view stack string now includes C++17.
- The Get-in-touch nav pill hides at <= 1000px (it duplicates the Contact link) so the nav links
  never crowd the theme toggle at mid widths.

### Added

- WhatsApp row in the homepage contact list (it existed on contact.html and the rail but not here).
- aria-label on the nav "Demo" link clarifying it opens the gallery in a new tab.

## [5.5.2] - 2026-06-11 - SEO and meta hygiene

### Fixed

- **Lahza finally unfurls when shared** - the PWA landing page had no Open Graph or Twitter tags at
  all, so WhatsApp/LinkedIn links rendered blank. Added the full block plus a canonical.
- **L2 viewer is now a first-class shareable page** - og/twitter tags, theme-color, robots index,
  favicon, and a sitemap.xml entry for /hft-book/viewer.html.
- **/app/ has a way home** - the live MES/ERP demo shell had no link back to the portfolio; added a
  quiet fixed "Built by Muhammad Saad - saadm.dev" pill bottom-left.
- **index.v4.html no longer competes with the homepage** - the old v4 preview was still
  `index, follow`; now `noindex, follow`.

## [5.5.1] - 2026-06-11 - Cache TTLs

### Changed

- Root assets that are always referenced with `?v=` cache-bust params (home.css, home.app.js,
  home.fx.js, home.fx.css, styles.css, demo.css, tokens.css) now cache for a week instead of a
  day/5 minutes. Files loaded without `?v=` (script.js, demo.js, contact.js) stay at a day.

## [5.5.0] - 2026-06-11 - Performance pass: conditional motion libs, dead three.js sweep, og.png, fonts

### Performance

- **Removed the dead three.js stack from all 77 demo/app pages** - every demo page carried 7
  `three@0.137.5` script tags (plus gsap/ScrollTrigger/lenis) left over from the WebGL backdrop era,
  but no file in the repo references THREE anymore. Roughly 170 KB gzipped of never-executed JS gone
  from every demo page.
- **gsap + ScrollTrigger + lenis now load on demand** - home.fx.js injects them itself, and only on
  capable desktops (pointer: fine, >= 1024px, no reduced-motion). Phones, tablets and reduced-motion
  users no longer download ~130 KB of motion JS that never ran for them. Anchor scrolling falls back
  to the existing CSS `scroll-behavior: smooth`. Desktop behaviour is unchanged.
- **og.png cut from 474 KB to 46 KB** - the generator (scripts/build-og.py) now palette-quantizes
  with Floyd-Steinberg dithering; visually identical at link-preview scale. Cache-bust
  `og.png?v=20260612` across 25 pages.
- **Google Fonts trimmed to the weights actually used** - dropped Inter 700, JetBrains Mono 500/700
  and Space Grotesk 500 (verified against home.css); ~4 fewer woff2 files per first visit.
- **Hero photo prioritised for LCP** - `<link rel="preload" as="image">` for saad.png in the head
  plus `fetchpriority="high"` on the hero img, so the largest paint no longer waits for React to
  render before the browser discovers it. Removed the now-unneeded jsdelivr preconnect.

## [5.4.0] - 2026-06-10 - Plain-ASCII typography + L2 viewer explainer

### Changed

- **Removed every em dash and en dash across the whole site** - homepage, demo apps, CSS/JS, docs and
  the L2 viewer now use plain hyphens, for a clean ASCII look (141 files). Recompiled home.app.js;
  cache-bust v=20260610b.

### Added

- **"What you are looking at" explainer** on the L2 viewer: a deep description of what the engine is
  doing (ITCH feed -> decode -> O(1) order-ref reconstructor -> metrics + trade tape -> JSON snapshot
  -> view), what each panel means (order book / cumulative depth chart / signals), and how the data is
  produced (real wsbook --dump output, with ?ws= for live).

## [5.3.2] - 2026-06-10 - L2 viewer: depth-of-market chart + ticker header

### Added

- **Cumulative depth-of-market chart** (the iconic bid/ask staircase) under the ladder - an SVG area
  chart of cumulative size vs price, bids rising left / asks rising right with the spread gap and a mid
  marker, plus a price axis. The most recognisable "trading terminal" visual.
- **Ticker header** - symbol, a large last price that flashes green/red on the tick direction, a
  spread/mid readout, and a pulsing live/recorded status badge.
- **Mid-price sparkline** (session) in the signals panel.

### Changed

- Refined layout, spacing and monospace typography across the viewer; cache-bust the recorded data to
  `?v=3`. (SVG colours moved to CSS since `var()` isn't honoured in SVG presentation attributes; strokes
  use `non-scaling-stroke`.)

## [5.3.1] - 2026-06-10 - L2 viewer: clean (uncrossed) book + terminal polish

### Fixed

- **The viewer's book was crossed** (best bid above best ask, negative spread) because it replayed the
  engine's *stress* synthetic feed, which lets resting orders pile up across the mid (the engine is a
  reconstructor, not a matcher). The recorded `book-replay.json` is now produced from a new
  never-crossed generator (`make_synthetic_book`, every add priced inside the current best bid/ask) -
  a realistic L2 ladder with a tight ~1-bp spread, verified 0 crossed frames.

### Changed

- **Viewer polish** to read like a trading terminal: thousands-separated sizes, an inside/spread strip
  (mid + spread in ticks and bps), best-bid/ask row highlight, colored spread/imbalance, a live/recorded
  badge, and **last-trade / VWAP / volume** from the engine's trade tape (now in the snapshot stream).

## [5.3.0] - 2026-06-10 - hft-orderbook: HFT-role positioning (FIX, MoldUDP64, microsecond)

Refreshes the flagship C++ card to position the engine for an HFT / low-latency C++ role after adding
the order-entry and real-time-feed halves of a trading stack.

### Changed

- **Flagship card** sharpened: **MoldUDP64** UDP multicast feed (with sequence-gap detection),
  **FIX 4.4** order entry (market data in, orders out), and a **sub-microsecond** lock-free pipeline
  with `PAUSE` busy-wait + core pinning. New "Market connectivity" and "FIX 4.4 order entry" bullets;
  added tags (`MoldUDP64`, `UDP multicast`, `FIX 4.4`, `Order entry`, `Sub-microsecond`).
- **Skills**: added `FIX protocol` and `UDP multicast` to *Backend & APIs*.
- JSON-LD description + `<noscript>` line updated to match. Recompiled `home.app.js`; cache-bust
  `?v=20260610a`.

## [5.2.0] - 2026-06-09 - hft-orderbook: L2 WebSocket book viewer + next-round refresh

Adds an interactive demo and refreshes the flagship C++ card after a second deep improvement pass on
the repo (analytics & signals, a windowed level store, sharded scaling, a WebSocket viewer).

### Added

- **L2 book viewer** at `/hft-book/viewer.html` - a self-contained, theme-aware page that
  animates a recorded replay (`book-replay.json`, 72 snapshots produced by the C++
  `wsbook --dump` from a synthetic ITCH session) of the engine reconstructing a book: an L2
  depth ladder (bids/asks with size bars), micro-price / spread / order-book-imbalance readout, and
  play/pause. Pass `?ws=ws://host:port` to watch a local `wsbook` live. Respects
  `prefers-reduced-motion` and the site's theme.
- **"L2 viewer ↗"** CTA on the flagship card.

### Changed

- **Flagship card** bullets/tags refreshed: microstructure signals + VWAP/OHLCV tape; the price-tick
  **windowed level store** (~24% faster in the 3-way A/B); **sharded** multi-threaded scaling; the
  dependency-free **WebSocket** viewer. JSON-LD description + `<noscript>` line updated to match;
  skills nudge `Market microstructure`. Recompiled `home.app.js`; cache-bust `?v=20260609e`.

## [5.1.1] - 2026-06-09 - hft-orderbook flagship card refresh (real data, hardening, perf A/B)

Content refresh of the flagship C++ card after a major improvement pass on the repo. No layout or
structural change.

### Changed

- **hft-orderbook card bullets** now reflect: real **BinaryFILE** captures + **multi-symbol**
  routing by `stock_locate`; the lock-free pipeline **validated race-free by ThreadSanitizer**; the
  **pluggable level store** benchmarked head-to-head (Google Benchmark); the MT5 bridge's **depth
  publisher**; and the **ASan/UBSan + libFuzzer + clang `-Werror`** CI gates. New tags
  (`Multi-symbol`, `Benchmarked`, `Sanitized + fuzzed`).
- Updated the `SoftwareSourceCode` JSON-LD description and the `<noscript>` line to match; cache-bust
  bumped to `?v=20260609d`.

## [5.1.0] - 2026-06-09 - Flagship C++ project: hft-orderbook (HFT market-data engine)

Adds a flagship systems-programming project at the head of the "Systems programming in C++"
group. No restructuring; all existing content is preserved verbatim.

### Added

- **`hft-orderbook` flagship card** leading the C++ group - a low-latency **C++17** NASDAQ
  TotalView-ITCH 5.0 **order-book reconstructor** with a lock-free **SPSC decode→book pipeline**,
  Google Benchmark microbenches + an `obreplay` throughput/latency tool, and a **MetaTrader 5**
  NDJSON-over-TCP bridge (MQL5 EA). GitHub + CI-runs links; green CI.
- **`SoftwareSourceCode` JSON-LD entry** for hft-orderbook (ItemList position 9; the other C++
  repos shift to 10-13) and a matching `<noscript>` fallback line.
- **Skills nudge** - `Lock-free`, `Low-latency`, `Market data` added to *Backend & APIs*.

### Changed

- C++ section blurb now reads "Five … repositories … led by a low-latency HFT market-data engine".
- Recompiled `home.app.jsx` → `home.app.js`; cache-bust bumped to `?v=20260609c`.

## [5.0.0] - 2026-06-05 - Dual-theme premium redesign (light + dark, glass/glow)

A full visual rebuild of the portfolio shell into a premium "operations console" system with
a **visible light/dark theme toggle**. Deep-ink glass + glow by default, plus a clean bright
neutral light theme - re-unifying the marketing shell with the dark demo apps. All content,
SEO/JSON-LD, the Coding/Engineering view toggle, and functionality are preserved verbatim.

### Added

- **Theme system.** A sun/moon toggle in the nav on every shell page (homepage React nav,
  contact, demo gallery, 404). The choice persists in `localStorage['theme']` and is shared
  across all pages; a tiny inline head script applies it before first paint (no flash) and
  defaults to the visitor's OS `prefers-color-scheme`. The `theme-color` meta updates per theme.
- **WebGL/GSAP/Lenis animation layer is back on the homepage** (`home.fx.js`), now gated to
  capable desktops only (fine pointer, ≥1024px, not reduced-motion) and to the dark theme; the
  canvas is hidden in light mode, where the CSS glow background carries the look.
- **Theme-aware portfolio demo banner** - the injected strip follows the visitor's theme.

### Changed

- **New art direction (premium glass/glow).** Deep-ink surfaces, glass nav with scroll
  frosting, an animated dot-grid + drifting accent glows, gradient hero headline, glowing
  buttons, animated card borders, and soft glow hovers. The light theme is a clean bright
  neutral counterpart. Both themes are driven entirely by `[data-theme]` CSS variables.
- **New type system** - display **Space Grotesk**, body **Inter**, labels/data **JetBrains
  Mono** (replacing Fraunces + IBM Plex).
- **`home.css`** fully rewritten as a dual-theme token system (dark default + light); every
  homepage class re-skinned, all selectors preserved so the React markup is unchanged except
  for the added toggle.
- **`styles.css`** (contact, demo, 404) reworked to the same dual-theme tokens; every class
  name and legacy alias (`--bg`, `--fg`, `--accent`, `--grad`, …) preserved.
- **`demo.css`** re-themed; the app-shell "ink spine" sidebar is pinned dark in both themes.
- **`home.app.jsx`** gains a `ThemeToggle` component in the nav and was recompiled to
  `home.app.js` (`npm run build:home`).
- New dark "S" favicon, `theme-color: #07080d` default, and `color-scheme: dark light` across
  the shell pages; asset cache-busting query bumped to `?v=20260605b`.

### Notes

- `index.v4.html` - the unshipped dark preview that informed this direction - is now redundant
  and can be removed.
- `og.png` social card still shows the previous design; regeneration is deferred.

## [3.0.0] - 2026-06-05 - "Engineering Field Notes" - full portfolio-shell redesign

A ground-up redesign of the portfolio shell into a warm, light, editorial-technical
system that reads like a precision engineering logbook - a deliberate break from the
generic dark dev-portfolio look.

### Changed

- **New art direction (light "Engineering Field Notes").** Warm drafting-paper
  background, near-black ink, a single signal-red accent, a faint graph-paper grid,
  hairline rules, figure-numbered section tags (`Fig. 01 - About`), and a framed
  "Plate 01" headshot caption. Applied to the homepage, contact, 404, and the demo
  walkthrough as one cohesive system.
- **New type system.** Display set in **Fraunces** (characterful serif, italic for
  emphasis), body in **IBM Plex Sans**, technical labels/data in **IBM Plex Mono** -
  replacing Inter + JetBrains Mono.
- **`home.css`** fully rewritten for the new system (homepage React app).
- **`styles.css`** fully rewritten (shared by contact, 404, demo) to the same system,
  preserving every class name; legacy tokens (`--bg`, `--fg`, `--accent`, `--grad`, …)
  are aliased to the new palette so all existing rules resolve light.
- **`demo.css`** re-themed to a crisp light admin UI with an ink "ledger-spine"
  sidebar; the MES/ERP walkthrough structure and fabricated-data notice are unchanged.
- **`home.app.jsx`** markup updated (figure-style section tags, Plate caption) and
  recompiled to `home.app.js`. All content, copy, SEO/JSON-LD, the Coding/Engineering
  view toggle, and the FAQ are preserved verbatim.
- Light `theme-color` (`#ece4d2`), `color-scheme: light`, and a new ink/paper/signal
  favicon across all four shell pages.

### Removed

- The WebGL (three.js) + GSAP/ScrollTrigger + Lenis "overkill" animation layer is no
  longer loaded on the **shell pages** (homepage, contact, 404, demo); motion is now
  calm, CSS-only (staggered load reveals, scroll-in fades, refined hover states). The
  `home.fx.*` files remain in place - the demo sub-apps still reference them and are
  unchanged in this pass.

## [2.11.3] - 2026-06-04 - Smooth round 3D sphere

### Changed

- The 3D object is now a **smooth round sphere** (icosahedron subdivision 1 → 5)
  instead of a faceted/blocky low-poly die, with a cleaner geodesic wireframe over
  it. Bumped the `home.fx.js` cache-buster across all pages.

## [2.11.2] - 2026-06-04 - Cinematic bloom + refined composition

### Added

- **Cinematic bloom** post-processing (three.js `UnrealBloomPass` via
  `EffectComposer`) on the WebGL scene for a premium, glowing look. Feature-detected
  and try/catch-guarded; falls back to plain rendering if the modules don't load.
  Postprocessing modules added across all 81 pages.

### Changed

- Refined composition: the 3D icosahedron is now an **off-centre accent** (upper
  right) instead of dead-centre behind the hero text, and the motion is calmer and
  smoother. Bumped the `home.fx.js` cache-buster (`?v=…d`).

## [2.11.1] - 2026-06-04 - More 3D: glowing icosahedron centerpiece

### Added

- A real 3D centerpiece in the WebGL scene (site-wide): a breathing **fresnel
  icosahedron** with a wireframe overlay that rotates, wobbles, and reacts to mouse
  + scroll, alongside the particle field. More dramatic scroll camera dolly. Bumped
  the `home.fx.js` cache-buster across all 81 pages.

## [2.11.0] - 2026-06-04 - Animation layer rolled out site-wide

### Added

- The animation layer (WebGL particle background + GSAP/ScrollTrigger + Lenis
  smooth scroll + custom cursor + magnetic buttons) now loads on **every page** -
  80 demo / sub-pages injected, plus the homepage. Per the brief: full overkill
  everywhere. Assets referenced absolutely (`/home.fx.js`, `/home.fx.css`) so they
  work at any path depth.

### Changed

- FX canvas moved to `z-index:-1` so it sits behind content on pages without the
  homepage's `#root` wrapper; form fields, `.leaflet-container`, and `<canvas>`
  keep a native cursor.

### Notes

- On demos with an opaque full-page background the WebGL is hidden behind it (the
  custom cursor / smooth-scroll / magnetic still apply); the whole layer degrades
  gracefully if a CDN lib is blocked. Heavy interactive demos (maps, scrollable
  admin, real-time canvases) carry the full layer too - watch for scroll/cursor
  friction there.

## [2.10.1] - 2026-06-04 - Brighter particles + 3D tilt cards

### Changed

- Made the WebGL particles **more visible** (count 6.5k→9.5k desktop, larger point
  size, higher alpha). Added **3D tilt** on project + skill cards (cursor-driven
  perspective rotate with a lift shadow) and a gentle float on the hero headshot.

## [2.10.0] - 2026-06-04 - Overkill animation layer (WebGL + GSAP + smooth scroll)

### Added

- A full "Awwwards-style" animation layer on the homepage (`home.fx.js` +
  `home.fx.css`), decoupled from the React app and feature-detected so it can
  never break the page:
  - **WebGL background** (three.js r137): a ~6.5k-particle field with a custom
    GLSL shader, reacting to mouse + scroll, behind the content (the hero shows
    it through).
  - **Smooth scroll** (Lenis) integrated with **GSAP ScrollTrigger** parallax on
    the hero and section eyebrows.
  - **Custom cursor** (dot + trailing ring that grows over interactive elements)
    and **magnetic buttons**.
  - Fully gated on `prefers-reduced-motion` and coarse/touch pointers (mobile and
    motion-sensitive users get the calm static site). Libraries via CDN (three,
    gsap, lenis); no bundler. The React app is untouched.

## [2.9.0] - 2026-06-04 - Headshot in the hero + a richer React homepage

### Added

- **Headshot in the hero**: the professional photo (`saad.png`) now sits beside
  the intro in a clean two-column hero - a real photo where the removed fake-code
  panel used to be.
- **Deep-linkable view**: the Coding / Engineering toggle now reflects in the URL
  (`?view=…` via `history.replaceState`) and is read back on load, so a chosen
  view is shareable. Added a visible **"⚛ Built with React 18"** badge in the
  footer to signal the homepage is a React 18 single-page app.

### Changed

- Homepage React bundle rebuilt; `home.css` / `home.app.js` cache-busters bumped.

## [2.8.4] - 2026-06-04 - Cleaner, more professional homepage (remove fake-UI mockups)

### Changed

- Removed the decorative fake-UI "gimmicks" for a more professional, content-first
  feel: the **3D-tilted hero code window** (`engineer.py` / `close_shift.py` /
  `shift_report.yaml`), the fabricated **"Production dashboard / QC batch record /
  Inventory"** demo cards with DEMO badges, and the **mini code snippet** on the
  Kingsley project card. The hero is now a clean **single column**. Deleted the
  now-dead JS components (`CodeWindow`, `CODE_SNIPPETS`, `MesThumbnails`) and their
  CSS. The view toggle, stats, and real project cards are unchanged.

## [2.8.3] - 2026-06-04 - Fix: blank projects grid on narrow viewports

### Fixed

- The homepage **"Selected Work"** project cards rendered blank on mobile /
  narrow widths: the scroll-reveal kept them at `opacity:0` until an
  IntersectionObserver reported the grid ≥12% visible, but the single-column
  grid had grown taller than ~8× the viewport (ShopFloor + playwright + n8n
  cards), so 12% was never on screen at once and the observer never fired.
  Hardened `useInView` to trigger on **any** intersection (`threshold: 0`), to
  reveal immediately when `IntersectionObserver` is unavailable, and added a
  1.8s failsafe so content can never stay hidden. Rebuilt `home.app.js`, bumped
  the cache-buster.

## [2.8.2] - 2026-06-04 - Ask Saad chatbot learns the open-source repos

### Added

- The **Ask Saad** site chatbot's knowledge base (`ask/js/corpus.js`) now
  includes the three open-source repos - **n8n-nodes-devtools**, **ShopFloor
  API**, and **playwright-e2e** - so it can answer questions about Saad's
  automation, Java / Spring Boot, npm-published, and test-automation work, with
  citation chips that open npm / GitHub. Bumped the corpus cache-buster.

## [2.8.1] - 2026-06-04 - n8n-nodes-devtools published to npm

### Added

- **n8n-nodes-devtools is now published on npm** as
  [`@saadmughal435/n8n-nodes-devtools`](https://www.npmjs.com/package/@saadmughal435/n8n-nodes-devtools)
  (v1.0.0 - scoped under the personal namespace because the bare name collided
  with an existing package). The homepage project card now leads with a
  **"View on npm ↗"** CTA and shows an `npm install @saadmughal435/n8n-nodes-devtools`
  line; the README projects table and the no-JS fallback link npm too.

### Changed

- Homepage React bundle rebuilt (`home.app.js`) and its cache-buster bumped.

## [2.8.0] - 2026-06-03 - n8n-nodes-devtools: an open-source n8n node, wired across the portfolio

### Added

- **New project - [n8n-nodes-devtools](https://github.com/saad-mughal435/n8n-nodes-devtools)**:
  a standalone **n8n community node in TypeScript** bundling developer & crypto
  utilities - JWT sign/verify (HS256/RS256 with `exp`/`nbf` checks), hashing +
  HMAC (SHA-256/512), UUID / Nano ID, JSON↔CSV, base64, and regex extraction.
  Programmatic `INodeType` over a framework-free core, 20 Jest unit tests, ESLint
  (n8n rules), and a green lint + build + test GitHub Actions CI. Open source, MIT.
- Featured it on the homepage as its own **"Automation & open-source tooling"**
  project card (GitHub + CI links), and threaded **n8n / TypeScript / Node.js /
  Workflow Automation / JWT** through the hero stack, skills, the "Can I see
  Saad's code?" FAQ, the JSON-LD `knowsAbout`, the no-JS fallback, and
  `package.json` keywords - so the portfolio now reads as an automation-tooling
  shop alongside the Python/Java/JS work.

### Changed

- Homepage React bundle rebuilt (`home.app.js`) and its cache-buster bumped.

## [2.7.3] - 2026-06-01 - ShopFloor live links point at the new landing page

### Changed

- ShopFloor API now has a **branded landing page** at its root (explains the
  OEE model, a 3-step try-it, the domain, roles, stack, and a live example,
  with a button into Swagger). The homepage project card and `/demo` chooser
  card now link **"Open live demo"** to that landing page instead of dropping
  straight into raw Swagger.

## [2.7.2] - 2026-06-01 - ShopFloor API live demo wired in

### Added

- ShopFloor API is now **deployed live** (Render, free tier) at a public
  Swagger UI. Both the homepage project card and the `/demo` chooser card now
  link **"Open live API (Swagger) ↗"** (with the GitHub source as a secondary
  link on the homepage card), so visitors can log in (`manager` / `password`)
  and exercise the real endpoints, not just read the code.

## [2.7.1] - 2026-06-01 - ShopFloor in the /demo chooser

### Added

- Added a **ShopFloor API (Java / Spring Boot)** card to the demo chooser on
  `demo.html`, placed right after the ERP system so the two MES/OEE pieces -
  the production Python system and the open-source Java rebuild - sit together.

## [2.7.0] - 2026-06-01 - ShopFloor API: a Java / Spring Boot backend, wired across the portfolio

### Added

- **New project - [ShopFloor API](https://github.com/saad-mughal435/shopfloor-api)**: a
  manufacturing-operations (MES/OEE) REST backend in **Spring Boot 3 / Java 21**.
  Job orders that compute OEE on close, downtime + root-cause logging, QC holds,
  and FIFO inventory; layered services, role-based JWT security, JPA +
  PostgreSQL + Flyway (H2 demo profile), OpenAPI/Swagger, Docker, and a green
  GitHub Actions CI (JUnit 5, MockMvc, Testcontainers PostgreSQL). Open source.
- Featured it on the homepage as its own "Backend engineering" project card
  (links to the repo), and threaded **Java / Spring Boot / Spring Data JPA /
  PostgreSQL / Flyway / Maven / JUnit / Testcontainers / OpenAPI** through the
  hero stack, tech-stack chips, skills, marquee, FAQ, the JSON-LD `knowsAbout`,
  the no-JS fallback, and `package.json` keywords - so the portfolio now reads
  as a Java + Spring shop alongside the Python/JS work.

### Changed

- Homepage React bundle rebuilt (`home.app.js`) and its cache-buster bumped.

## [2.6.4] - 2026-06-01 - Fix: deploys were failing (invalid _redirects)

### Fixed

- **Removed the `/app/*  /app/index.html  200` rule from `_redirects`.**
  Cloudflare's `wrangler deploy` rejects it as an infinite-loop redirect
  (`.html` / `/index` stripping re-matches `/app/*`), which **failed the entire
  deploy** - so every push from v2.6.0 onward never went live and the site
  stayed frozen on the v2.5.0 build. Dropping the rule lets the deploy succeed
  and ships v2.6.0-v2.6.4 at once. The MES app keeps its `/app/`-namespaced
  client URLs; a deep-link hard-refresh falls through to the 404 (same as
  before) - a real `/app/` single-page-app asset handler is a separate
  follow-up.

## [2.6.3] - 2026-06-01 - Professional hero copy + cache fix

### Changed

- Reworked the hero headlines for a consistent, professional tone across both
  views: **Coding** reads "Software for operations. / Automation behind it."
  and **Engineering** reads "Operations on the floor. / Engineering behind
  it." Replaced the casual footer line ("a healthy disrespect for manual
  work") with a clean credit naming the role.

### Fixed

- Bumped the `home.app.js` cache-buster and set the file to revalidate
  (`max-age=300, must-revalidate`) so homepage rebuilds reach browsers and the
  CDN immediately instead of serving a day-old cached bundle. (This is why the
  v2.6.2 toggle change wasn't showing up.)

## [2.6.2] - 2026-06-01 - Homepage view toggle simplified

### Changed

- The hero "Tailored for" toggle now offers two views - **Coding** (default)
  and **Engineering** - instead of All / Coding / Engineering, so the homepage
  opens on the software-focused view. A previously-stored "All" preference
  falls back to Coding.

## [2.6.1] - 2026-06-01 - Drop in-browser Babel (precompiled homepage)

### Changed - performance

- The homepage React app is now **precompiled**. The JSX lives in
  `home.app.jsx` (source of truth) and is transpiled once via
  `npm run build:home` into the committed `home.app.js`; `index.html` loads
  that plain script with `defer`, and the React / ReactDOM CDN tags are
  deferred too.
- **Removed `@babel/standalone`** (~900 KB gzipped) and the per-visit,
  main-thread JSX transpile that previously blocked first paint. `index.html`
  shrank from ~101 KB to ~20 KB; the homepage now paints without downloading
  or running a compiler in the browser.
- Verified by rendering the compiled bundle against the real React 18 UMD in
  jsdom (`#root` mounts all sections, no React errors).
- Added `@babel/cli` + `@babel/preset-react` devDependencies and a `build:home`
  script. Deploy stays static (Cloudflare Pages serves committed files); the
  only build is this single local transpile when the homepage changes.

## [2.6.0] - 2026-06-01 - Site-wide hardening + polish pass

A multi-agent static audit of the homepage and all 12 demos (across
accessibility, performance, SEO, responsive layout, security and correctness)
surfaced 60 verified issues; this release fixes them. No new demos - existing
surfaces made faster, more correct, and more accessible.

### Fixed - functional bugs (recruiter-visible)

- **Manzil owner dashboard + admin were fully broken** - the code read a
  `.body` envelope the mock API never returns, throwing on every owner-dashboard
  section and on the admin owner-approvals / verification / listing drawers.
  Corrected the read paths in `owner-dashboard.js`, `admin-sections.js` and
  `owner-onboard.js` (the "Edit listing" wizard prefills again).
- **MES home dashboard rendered all-zero KPIs** - `/dashboard/stats` now
  returns `total_inventory_value` / `total_items` / `low_stock_count` /
  `active_recipes`, so the first screen shows real figures.
- **Dead mobile navigation** - wired the hamburger menus on the b2c and b2b
  storefronts and added a slide-over conversation list to the Sanad inbox
  (the inbox was unreachable at <=760px).
- **Manzil maps** - the search "Map" view left its right-hand list pane blank;
  a `.m-map-pin` class collision blew every compact price-pin up to 320px
  (renamed the wizard container to `.m-map-picker`); the "Talk to sales" CTA
  404'd (`contact.html` -> `../contact.html`).
- **Marsad** rebuilt all 112 map markers every 4s (flicker, popups slammed
  shut) - `placeOrder` is now idempotent.
- **Sanad** embedded chat could not reopen after closing; a dead KB intra-link
  was repaired.
- **Lahza** desktop "Install" CTA blanked the app; re-enabled pinch-zoom
  (removed `user-scalable=no`); removed an `aria-hidden` wrapper that hid
  focusable links.
- **Qahwa POS** admin floor plan collapsed all tables into one corner; receipts
  and TRN now read from settings.
- **b2c checkout** - the chosen shipping method now actually affects the total.
- Corrected contradictory / wrong figures visible to recruiters: Manzil admin
  (13 -> 15 sections), Vacation admin (11/12 -> 13) and stays (55 -> 54), Watad
  telemetry points (198 -> 182), Nabta visa-expiry KPI and a leave-id off-by-one,
  and a "performa" -> "proforma invoice" typo on the headline MES card + demo.

### Fixed - accessibility

- Added a "Skip to content" link; fixed the Skills heading-level skip
  (h2->h4 became h2->h3); gave the hero view-toggle a correct `role="group"` /
  `aria-pressed` pattern; exposed the Ask-Saad citation chips as keyboard /
  screen-reader-operable buttons with an `aria-live` region for AI replies;
  raised touch targets to 44px; added aria-labels to icon-only controls across
  Marsad / Sanad / Nabta / Lahza / POS; lifted the code-comment colour to WCAG AA.

### Fixed - SEO & social cards

- Pruned `sitemap.xml` to the 19 genuinely-indexable URLs (it was listing ~23
  `noindex` pages - a Search Console "Submitted URL marked noindex" error) and
  added `<lastmod>`.
- Added Open Graph + Twitter cards to every shareable demo landing page and
  fixed `demo.html` (it used the portrait headshot as its share image); added
  self-referential canonicals to indexable property / vacation / sanad pages.
- Synced the JSON-LD role list to the visible FAQ, de-keyword-stuffed the
  WebSite schema `name`, and corrected misleading schema comments.

### Changed - performance

- **`saad.png` 1.84 MB -> 83 KB** (a 1122x1402 image rendered at <=168px is now
  400x500 and compressed) - it sits on the critical path of every page.
- Reduced orb blur (80 -> 60px) and dropped the third orb on mobile; trimmed an
  unused mono font weight; added intrinsic `width`/`height` to nav and portrait
  images; normalised the MES app's 25 `utils.js` imports to a single module
  instance.

### Changed - security & infra

- Added a **Report-Only Content-Security-Policy** (scoped to the unpkg / Google
  Fonts / Leaflet tiles / in-browser-LLM origins the demos actually use),
  `rel="noopener"` on internal new-tab links, cache rules for previously
  uncovered root assets, and promoted the permanent
  vanity redirects to 301.
- Namespaced the MES app's client-side URLs under `/app/`, added an
  "Exit demo -> Portfolio" link, and marked the app shell `noindex`
  (`demo.html` is the indexable MES entry point). Stripped leftover
  `console.log` debug output across the demos.

## [2.5.0] - 2026-05-21 - Marsad (10th) + Nabta (11th) + shared design tokens

### Added - shared design tokens at `/tokens.css`

Brand + foundation tokens loaded by the homepage and the two new demos
(Marsad, Nabta). Includes:

- **Brand palette** - saadm.dev signature blue/teal/violet/coral/amber/gold/pink
- **Neutral scale** - 12 steps from `--neutral-0` (#07080d) to `--neutral-1000` (white)
- **Semantic colours** - status-ok / info / warning / urgent / critical / neutral
- **Typography** - UI sans (Inter), display serif (Fraunces), monospace (JetBrains Mono),
  Arabic (Tajawal). Modular type scale `--text-2xs` through `--text-6xl`.
- **8px spacing scale** - `--space-1` (4px) through `--space-24` (96px)
- **Radius scale** - `--radius-xs` (4px) through `--radius-2xl` (48px) + `--radius-full`
- **Shadow ramp** - three elevation steps + atmospheric blue tint
- **Easing** - `--ease` (smooth-out UI default), `--ease-in`, `--ease-out`, `--ease-bounce`
- **Duration tokens** - `--duration-instant` through `--duration-slower`
- **Z-index layer roles** - sticky / overlay / dropdown / modal / sheet / toast / tooltip / banner
- **Layout** - page max-widths for prose / content / page / wide
- **`prefers-reduced-motion`** auto-respected via `t-reduced-motion-safe`
- **Light-mode opt-in** via `data-theme="light"` for new demos

Existing demos (`/sanad/`, `/watad/`, `/b2c/`, `/b2b/`, `/property/`, etc)
keep their own scoped `--xxx-*` design systems untouched - zero-risk change
to anything shipped. New demos reference `/tokens.css` for spacing / radii
/ shadows so the visual rhythm stays consistent across the family.

### Added - Marsad (10th demo) · real-time fleet dispatcher console

A live dispatcher console for a Dubai last-mile courier. ~4,500 LOC across
6 HTML pages + 1 CSS + 11 JS modules.

- **Live Leaflet map** with real Dubai coordinates · Carto dark tiles
  · 16 vehicle pins (12 vans + 4 motorbikes) ticking toward 96 in-flight
  orders across 6 service zones (Marina, JLT, Downtown, Business Bay,
  Deira, Sharjah Al Nahda).
- **Fleet simulator** (`fleet-sim.js`) · 4-second tick · vehicles move
  toward their assigned drop-off, deliver within 120m, pick the next
  assignment from their driver's queue. Pure JS, no map provider
  beyond tile imagery. Same subscriber pattern as WatadSim.
- **4 AI dispatcher features** (`MarsadAI`): `explainDelay` (cites
  cause + recommends action), `suggestReroute` (re-sequences by SLA),
  `batchOptimize` (assigns pending across idle drivers), `dispatcherChat`
  (conversational copilot grounded in live state).
- **Driver-side view** (`driver.html`) · simplified mobile-shaped UI
  for the driver: current job, route, COD pill, complete / handover,
  today's earnings + streak. Driver picker top-right.
- **9-section admin SPA** · Dashboard (KPIs + top zones +
  leaderboard), Orders, Drivers, Vehicles (fuel + last-ping),
  Zones, Integrations (Shopify · Twilio · Google Maps · QuickBooks),
  AI Console, Settings, Audit log.
- **UAE-specific business logic** · per-zone SLAs (Marina 90 min ·
  Sharjah Al Nahda 150 min) · COD up to AED 500 · driver compensation
  rate per delivery + incentive · real Dubai geography in AI replies.
- **`/marsad/` aliases** - `/dispatcher` `/fleet` `/marsad-driver`.

### Added - Nabta (11th demo) · UAE HR + payroll SaaS

A modern UAE-shaped HRIS. ~3,800 LOC across 3 HTML pages + 1 CSS + 5 JS
modules. Single-SPA hash-routed because that's how real HRIS products
ship.

- **Dashboard** · KPIs (employees, pending leave, open roles, visa
  renewals, next payroll), recent leave activity, headcount by department.
- **Employees** · 32 employees with full UAE-specific fields (Emirates
  ID, passport, visa expiry, IBAN, base + allowances). Filter by
  department / status, drill into profile sheet with leave balance.
- **Leave management** · 7 leave types (Annual, Sick, Maternity,
  Paternity, Unpaid, Compassionate, Hajj/Umrah) · 18 in-flight
  requests · pending → approved/rejected workflow · line-manager + HR
  sign-off · per-employee balance tracking (30 annual + 15 sick per
  UAE Labour Law).
- **WPS payroll runs** · 6 months historical + current draft.
  Per-employee breakdown (base + allowances − deductions = net).
  "Generate WPS SIF + Finalize" flow. Pay-day 28th via Emirates NBD.
- **Recruitment kanban** · 4 open roles · 22 candidates · stages
  (lead / applied / interview / offer / hired) · source + rating +
  expected salary range.
- **Performance reviews** · Q2-2026 cycle · 12 reviews across status
  (not started / in progress / submitted) · rating + goals-met %.
- **AI policy assistant** (`NabtaAI`) · an LLM grounded in 6 HR
  policies (leave, WPS, visa, gratuity, probation, remote) + UAE
  Labour Law (Federal Decree-Law No. 33 of 2021). Every reply cites
  by `[pol-xxx]`. Click a citation chip → opens the source policy in
  a modal. Live + mock fallback.
- **Settings + audit** · company settings (pay day, WPS code, leave
  caps, probation), audit log with actor + action + target + details.
- **`/nabta/` aliases** - `/hr` `/payroll` `/wps`.

### Portfolio integration
- `demo.html` - 2 new demo cards (Marsad + Nabta). Intro "Nine" → "Eleven".
- `index.html` PROJECTS - two new entries between Lahza and Pebble.
  Each card has 3 CTAs. Plus 2 new bullets in the "Other software
  demos" list.
- `_headers` - cache rules for `/marsad/*` + `/nabta/*` + `/tokens.css`.
- `_redirects` - 6 new friendly aliases.
- `sitemap.xml` - 5 new entries.
- `README.md` - 2 new rows in the demos table; intro "nine" → "eleven";
  AI-integration count "four" → "six"; new mention of `/tokens.css`.
- `humans.txt` - Marsad + Nabta added; AI feature count + map list updated.
- `package.json` - 2.4.0 → 2.5.0.

### AI integration count
Six features now share the single Cloudflare Worker + encrypted
`LLM_API_KEY` secret:

1. **Sanad** - customer support copilot
2. **Watad** - facilities operations (3 features inside)
3. **Ask Saad** - recruiter Q&A on the homepage
4. **Lahza** - personal wellness (4 features inside)
5. **Marsad** - fleet dispatch (4 features inside)
6. **Nabta** - HR policy assistant

Same Worker, same key, six products. **No API key value anywhere in
the repo** - only env-var references in the Worker handler. Each demo's
README documents the additive `/api/<demo>/ai/*` branch as a paste-able
snippet.

### Mistake-prevention (from prior demos + this session)
- All regex routes in mock-api.js wrap match in parens (POS lesson).
- All CSS scoped with demo-specific prefix (`mrs-*`, `nbt-*`) - no bleed.
- `?v=20260521a` cache-bust on every script + link tag.
- Marsad's fleet-sim is in-memory only (vehicle positions don't persist
  to localStorage - they'd be wrong on reload anyway).
- Nabta's payroll breakdown excludes the one employee on `status: 'notice'`
  to match UAE practice (final settlement is a separate process).
- No `_worker.js` at site root; live mode is opt-in per demo.
- No AI co-author trailer on commits.

## [2.4.0] - 2026-05-20 - Lahza: AI journaling + mood-tracking mobile-first PWA (ninth demo)

### Added
- **Lahza** at `/lahza/` - the portfolio's **first mobile-shaped demo**
  and its **fourth AI integration**. A Progressive Web App for personal
  journaling: one AI-suggested prompt a day, a few sentences, and
  AI detects mood + surfaces weekly patterns. Installable on iOS,
  Android, and desktop via "Add to Home Screen" - no App Store, no
  native compilation, no review queue.

  **Why:** the other eight demos are desktop-first dashboards / admin
  SPAs / marketplaces. None of them proved Saad could ship a
  mobile-shaped product, which is a real gap when recruiters at any
  consumer-tech / app-studio / health-tech firm scan his work, and
  when Fiverr buyers searching "mobile app developer" reach his
  profile. Lahza closes it.

  ~3,800 LOC across 1 HTML shell + 1 CSS + 11 JS modules (data,
  mock-api, ai-engine, app, router, 7 view modules) + 1 manifest + 1
  service worker + 4 PNG/SVG icons.

- **PWA shell** (`lahza/index.html` + `lahza/manifest.webmanifest` +
  `lahza/sw.js`) - `display: standalone`, scope `/lahza/`, custom
  service worker scoped exclusively to `/lahza/*` (never controls the
  homepage React SPA or any other demo). Network-first for HTML +
  AI calls, cache-first for static assets. Cache version key bumps
  on each deploy.

- **Desktop "iPhone frame"** chrome (`lahza/css/lahza.css`) - on
  viewports ≥ 720px the app renders inside a 390×844 phone-shaped
  CSS box (border-radius 56px, 4px bezel, notch cutout, soft drop
  shadow) centred on a soft gradient backdrop with install hint
  cards. On mobile (< 720px) the frame disappears and the app takes
  `100dvh viewport-fit=cover`. Recruiters opening the link on
  desktop immediately see "this is a mobile app".

- **4 AI features** (`lahza/js/ai-engine.js`, `LahzaAI` namespace):
  - `suggestPrompt({hour, recent_mood, day_of_week})` → one short
    journaling prompt, time-of-day + mood aware. ~$0.0002/call live.
  - `detectMood({entry_text})` → returns JSON `{mood, confidence,
    emotions}` from one of six moods (calm / joyful / energized /
    tense / low / neutral). Called async after Save so the user
    doesn't wait. ~$0.0004/call live.
  - `weeklyInsights({entries})` → RAG over last 7 entries, returns
    themes + wins + concerns. ~$0.0012/call live.
  - `coachChat({question, history, entries})` → RAG over last 14
    entries, cites by `[entry-id]` at sentence endings. Citation
    chips render below the message and open the cited entry in a
    bottom sheet. ~$0.0008/call live.

  Same Live/Mock fallback pattern as Sanad / Watad / Ask Saad. Mock
  dictionaries are mood-aware (a low-mood prompt suggestion differs
  from an energized one). Live mode reuses the same Cloudflare
  Worker proxy and the same encrypted `LLM_API_KEY` secret as
  the other three AI demos - set once, all four use it.

- **7 mobile views** (`lahza/js/views/*.js`):
  - Onboarding · 3 swipeable cards (welcome / patterns / privacy)
  - Today · greeting + streak ring SVG + AI-suggested prompt + recent strip
  - Compose · full-screen modal with prompt-cycle button + 5-emoji
    mood picker + tag chips + auto-grow textarea + save
  - Journal · chronological feed grouped by month + search +
    mood filter chips + entry detail in bottom sheet
  - Insights · 7-day mood SVG line+area chart + theme tag list +
    AI weekly summary card (RAG over last 7 entries)
  - AI Coach · chat grounded in last 14 entries, citation chips
    that open the cited entry in a bottom sheet
  - Profile · streak + total entries + AI mode badge + language
    (EN/AR) + theme + reminder time + export-JSON + reset-demo

- **Seed data** (`lahza/js/data.js`) - 14 days of fabricated journal
  entries generated by a deterministic seeded RNG so first-time
  visitors see a populated mood chart, journal feed, and insights
  view immediately. Entries describe a generic Dubai-based knowledge
  worker (work, gym, family, weather) - intentionally NOT Saad's
  actual life, generic enough that no real person could pattern-match.

- **Privacy by default** - entries live in `localStorage` only. They
  never leave the device unless Live AI mode is enabled, in which
  case only the active question is sent to the model via the Worker
  proxy. README and Profile view both state this explicitly.

- **EN + AR locale toggle** in Profile. UI flips RTL; entry bodies
  keep their original language.

### Portfolio integration
- `demo.html` - 9th demo card (intro "Eight" → "Nine").
- `index.html` PROJECTS - new Lahza entry between Watad and Pebble,
  3 CTAs (Open app / AI Coach / Insights).
- `_headers` - cache rules for `/lahza/css/*`, `/lahza/js/*`,
  `/lahza/icons/*`, `/lahza/manifest.webmanifest`, and
  `/lahza/sw.js` (with `Service-Worker-Allowed: /lahza/` header).
- `_redirects` - friendly aliases `/journal`, `/mood`, `/coach`.
- `sitemap.xml` - `/lahza/` entry.
- `README.md` - new row in the demos table; intro "eight" → "nine".
- `humans.txt` - Lahza added to the LLM + Mobile sections.
- `package.json` - 2.3.0 → 2.4.0.
- `ask/js/corpus.js` - new `demo-lahza` doc so the Ask Saad chatbot
  cites Lahza when a recruiter asks about mobile / wellness / PWA work.

### Mistake-prevention (from prior demos)
- Service worker registered with explicit `scope: '/lahza/'` so it
  never controls the homepage React SPA or any other demo.
- `Service-Worker-Allowed` header sent in `_headers` defensively.
- Every CSS class + variable scoped with `lz-` / `--lz-` - no bleed.
- `HIST_VERSION` key on entries store + coach history so a future
  schema change wipes stale state cleanly.
- `?v=20260520a` cache-bust on every script + link tag.
- All regex routes in `mock-api.js` wrap the match assignment in
  parens (the POS / Watad / Ask lesson).
- No `_worker.js` at site root; live mode is opt-in.
- **No LLM API key value anywhere in the repo** - not in code,
  not in README examples, not as a placeholder. The key lives in
  Cloudflare's encrypted secrets, set via the dashboard, referenced
  in the Worker by env var name only.
- `100dvh` not `100vh` so iOS Safari's collapsing chrome doesn't push
  content off the bottom.
- Mock mode is the default; the app works realistically with no
  Worker / no key. Live mode is an upgrade, not a requirement.
- Compose textarea `max-height: 50dvh` so a long entry doesn't push
  the bottom bar off-screen.

## [2.3.0] - 2026-05-20 - Ask Saad: recruiter AI chatbot on the homepage

### Added
- **Ask Saad** - a floating ✦ cyan chat bubble on the homepage and the
  contact page. Recruiters ask plain-English questions ("Does he know
  Python?" / "What did he build at Kingsley?" / "Can he relocate?") and
  get 2-4 sentence answers grounded in a pre-chunked corpus extracted
  from the existing site content. Each reply renders one-click citation
  chips that drill into the relevant demo / role / FAQ.

  **Why:** the site now hosts eight interactive demos plus a long
  experience timeline + skills + FAQ. Recruiters in Dubai screen 50+
  candidates a week - most won't browse all eight. Ask Saad is the
  30-second answer that drills them straight to the right demo.

  This is **a feature on the homepage, not a 9th demo**. The site still
  lists "Eight" interactive demos; Ask Saad adds a chat bubble.

- **`ask/js/corpus.js`** - RAG knowledge base. ~40 documents extracted
  from existing homepage content blocks (`HERO_COPY` × 3, `FAQ_ITEMS`
  × 7, `EXPERIENCE` × 5, demo descriptions × 8, `STACK_GROUPS` × 9,
  `WhatThisProves` × 4, About prose, education, contact, quantified
  impact stats). Each doc has a stable `id`, plain-text body, a `link`
  or `scrollTo` anchor for citation drill-downs, and a hand-curated
  `tags[]` array. ~5 KB total.

- **`ask/js/engine.js`** - `AskAI` namespace. Live/Mock pattern matching
  Sanad/Watad: `health()`, `retrieve(q, k)`, `answer({question,
  history})`, `rateMessage()`. Retrieval is keyword + tag overlap
  (no embeddings, no vector DB - the corpus is small enough that
  `tagOverlap × 2 + titleMatch × 1.5 + bodyTokenOverlap × 1` works
  great). Top-3 retrieved docs are passed to AI in a `CONTEXT:`
  system-prompt block, each tagged `[doc-id]`. AI cites by
  `[doc-id]` at sentence endings; the client parses those into
  citation chips. Mock fallback returns a templated answer built from
  the top doc's body with the same citation chips so Demo mode is
  realistic.

- **`ask/js/chat.js`** - chat widget lifted from `sanad/js/chat.js`
  and trimmed for this use case (no full-screen view, no local Qwen
  model, no "talk to a human" handoff, no KB-article side drawer).
  Keeps the typewriter animation, mode badge, 👍/👎 feedback per
  message, starter chips ("Does he know Python?" / "What did he
  build at Kingsley?" / "Can he relocate?" / "Tell me about Watad"),
  history persistence with `HIST_VERSION` schema-migration key.
  Mounts itself once into the page as a sibling of the React tree -
  no conflict with the homepage SPA.

- **`ask/css/ask.css`** - scoped `--ask-*` styles for the bubble +
  chat window. Cyan + violet gradient to echo the existing site
  accent. Responsive: bubble + window reflow on mobile (`<480px`).

- **`ask/js/app.js`** - tiny `AskApp` helper shim (escapeHtml,
  jget/jset, showModal, toast). Lifted from `sanad/js/app.js` so
  chat.js doesn't have to import `SanadApp` across demos.

- **`ask/README.md`** - operator quick-start + live-mode setup
  (reference Cloudflare Worker handler for `/api/ask/ai/*`).

### Changed
- **`site/index.html`**: loads `ask/css/ask.css` in `<head>`, loads
  the 4 `ask/js/*` scripts after the React mount (line 1411+).
  Adds a `✦ Ask the AI` cyan pill button in the hero CTA row next
  to "Contact me" and the existing demo CTA.
- **`site/contact.html`**: loads the same Ask Saad assets. Adds a
  `✦ Or ask the AI` button in the form-actions row. When clicked
  the chat opens pre-filled with whatever the visitor has already
  typed in the message textarea - no lost context.
- **`site/_headers`**: cache rules for `/ask/css/*` and `/ask/js/*`
  matching the other demos' pattern (`max-age=300, must-revalidate`).
- **`site/README.md`**: new row in the features table - "Ask Saad -
  AI chatbot on the homepage".
- **`site/package.json`**: 2.2.0 → 2.3.0. Minor bump for an additive
  feature, no breaking changes.
- **`site/humans.txt`**: bumped to 2026-05-20 + added the Ask Saad
  line to the LLM section.

### Mistake-prevention (from prior demos)
- Widget injected **after** `createRoot(...).render(<App />)` so the
  React tree owns `#root` exclusively. The widget DOM (`#ask-bubble`,
  `#ask-window`) lives as a body sibling.
- Every CSS class + variable scoped with `ask-` / `--ask-` - no bleed
  into the homepage or any demo.
- `HIST_VERSION` key prevents stale canned-reply formats from showing
  up after a corpus update (same lesson as Sanad).
- Composer textarea has `max-height: 120px; overflow-y: auto` so a
  long question doesn't push the chat window off-screen.
- `?v=20260520a` cache-bust querystring on all `ask/*` script + link
  tags in both `index.html` and `contact.html`.
- Mock mode is the default; the chat answers realistically with
  citations even when no Worker is configured.
- Out-of-scope guard: when retrieval finds no decent match, the mock
  politely declines and points to saad@saadm.dev.

## [2.2.0] - 2026-05-18 - Watad: smart-building / BMS operations console (eighth demo)

### Added
- **Watad** at `/watad/` - eighth interactive demo and the first one
  with a **real-time data shape** (the prior seven were request/response
  CRUD with optional polling). A live operator console for a commercial
  smart building - the kind of software Imdaad / EFS / Schneider /
  Honeywell ship to facilities teams. Designed to fill a specific gap
  in the portfolio: none of the existing seven demos proved Saad's
  electrical-engineering + industrial operations background, which is
  exactly what UAE facilities management, building automation, energy
  utilities (DEWA / Masdar), and data-centre operators (Khazna)
  pattern-match for. ~4,400 LOC across 7 HTML pages + 1 CSS file +
  13 JS modules.
- **Operations console** (`watad/console.html`) - the centrepiece.
  Four-region layout: top KPI strip (alarms by severity, kW demand,
  avg zone temp, occupancy %, kgCO₂, BACnet status pill), live SVG
  floor plan with 48 equipment icons placed at absolute coordinates +
  pulse-on-alarm + zone heat tint + click-to-drill, severity-sorted
  alarm queue side panel with Web Audio cues + Acknowledge /
  Create-WO / ✦ AI-explain actions, bottom trend strip (3 mini SVG
  line charts - kW, avg zone temp, alarm count). Subscribes to
  `WatadSim` and diff-renders every 5s with no flicker.
- **Telemetry simulator** (`watad/js/telemetry-sim.js`) - the technical
  differentiator. ~310 LOC. Ticks every 5 seconds, mutates every
  point's value plausibly based on asset type + time of day +
  occupancy schedule + synthesised outdoor temperature curve.
  Raises and clears alarms based on per-point hi/lo thresholds.
  Keeps a 288-sample (~24h) history buffer per point regenerated
  from a deterministic seeded RNG so charts always look populated
  on first paint. Exposes `window.WatadSim.subscribe()` for any
  page to receive `tick` / `alarm-new` / `alarm-cleared` events.
- **Asset detail** (`watad/asset.html`) - URL: `?id=as-xxx`. 24h
  multi-point overlaid trend chart (custom SVG, no library), active
  + recent alarms, related work orders, manual override panel
  (setpoint slider, override status), asset metadata grid, AI panel
  with "Suggest maintenance".
- **Work orders module** (`watad/workorders.html`) - filter chips
  (open / in-progress / on-hold / completed / cancelled), table with
  WO# / asset / priority / assignee / due / status, create-WO modal
  (also triggered from console alarm → pre-fills title + priority +
  asset), drill-in modal with comments timeline + status pipeline +
  HTML5-canvas signature capture.
- **Energy dashboard** (`watad/energy.html`) - KPI tiles (today kWh,
  cost AED, kgCO₂, peak kW, 30-day total MWh), 30-day daily bar
  chart with **ASHRAE 90.1 reference-band overlay**, sub-meter table
  (% of total + vs-yesterday trend arrows), DEWA DSM
  demand-response opt-in panel, AI "Optimise setpoints" panel
  returning 2-3 suggestions with estimated AED savings.
- **10-section admin SPA** (`watad/admin.html`) - hash-routed:
  Dashboard (KPI tiles + 7-day energy bars + alarms-by-hour
  heatmap + top alarming assets + recent alarms), Assets (CRUD,
  filterable by type/floor), Points (all 198 points with live
  current value column), Alarms (full audit + filters), Schedules,
  Work orders (admin lens), Staff (with permission matrix for
  operator / tech / admin), Integrations (BACnet IP / Modbus TCP /
  DALI / MQTT / Maximo CMMS / ServiceNow), AI Console (model
  selector for Fast / Balanced / Max + editable system
  prompt + test-with-sample), Settings (energy tariff, CO₂ factor,
  ASHRAE band, units, reset-demo), Audit log with CSV export.
- **WatadAI** (`watad/js/ai-engine.js`) - lifted from `sanad/js/ai-engine.js`,
  same Live/Mock pattern, 3 BMS-specialised features:
  `explainAlarm({alarm, asset})` returns Action + Likely cause in
  2 paragraphs grounded in point values; `suggestMaintenance({asset,
  alarm_history})` returns 2-3 preventive tasks ranked by priority
  with AED estimates; `optimizeSetpoints({occupancy_pct,
  outdoor_temp_f, current_setpoints})` returns setpoint/schedule
  changes with estimated kWh + AED savings. Re-uses same
  `LLM_API_KEY` secret as Sanad - set once, both demos benefit.
- **Seed data** (`watad/js/data.js`) - Boulevard Tower B fictional
  building, 4 floors (Ground / L1 / L2 / Roof), 24 zones, 48 assets
  (2 chillers + 2 cooling towers + 4 AHUs + 20 FCUs + 7 lights + 7
  sub-meters + 5 occupancy + 1 CO₂), 182 telemetry points, 30
  alarms across all states (9 open + 4 acknowledged + 17 cleared),
  15 work orders (5 open + 5 in-progress + 5 completed), 6 staff,
  4 schedules, 6 integrations, 210 daily-energy-history records.
- **Design system** (`watad/css/watad.css`) - dark navy + electric
  cyan + amber/red alarm + safety green. Mirrors real SCADA/BMS UIs
  (Honeywell EBI, Schneider EcoStruxure, Siemens Desigo). Distinct
  from every other demo palette.
- **Landing + 404** - hero with three CTAs, six-feature explainer
  grid, two-minute walkthrough. Branded not-found page.
- **`watad/README.md`** - operator quick-start + live-mode setup
  steps (reference Worker handler for `/api/watad/ai/*`).

### Portfolio integration
- `demo.html` - eighth demo card + intro copy bumped "Seven" → "Eight".
- `index.html` - new PROJECTS data entry between Sanad and Pebble (4
  CTAs: console / energy / work orders / admin), plus new bullet in
  "Other software demos" list.
- `_headers` - cache rules for `/watad/css/*` and `/watad/js/*`.
- `_redirects` - friendly aliases `/bms`, `/building`, `/facilities`.
- `sitemap.xml` - 5 new entries.
- `README.md` - new row in the demos table.

### Changed
- Bumped to **2.2.0** (minor) - new vertical, no breaking changes to
  the existing seven demos.

## [2.1.0] - 2026-05-17 - Sanad: AI customer-support copilot demo (seventh demo)

### Added
- **Sanad** at `/sanad/` - seventh interactive demo and the first one
  with real LLM integration. A SaaS-style customer-support helpdesk
  with AI woven into every screen rather than bolted on as a
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
  Console** (model selector for Fast / Balanced / Max,
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
  `LLM_API_KEY` as a Cloudflare Worker secret), the cost
  guardrails, and the file layout. Includes a copy-pasteable Worker
  reference implementation.

### Live mode vs Demo mode
- Out of the box, Sanad ships in **Demo mode** - the topbar shows a
  "Demo mode" badge and all AI features return realistic
  pattern-matched mock responses. The demo works 100% offline and
  never breaks for visitors.
- To enable **Live mode** (real AI responses), the repo's
  Cloudflare Worker needs a `_worker.js` at root that proxies
  `/api/sanad/ai/*` to the LLM provider with a server-side secret. The
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
  preforms 0.18 / caps 0.045 / labels 0.038 / FG cases 9.60-19.20).
  Inventory scaled to factory levels (sugar 3.2t, preforms 480k,
  caps 510k, labels 470k, FG 1.6-3.8k cases). Customers 80k-500k
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
