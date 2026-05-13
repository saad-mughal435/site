<div align="center">

# saadm.dev

**Personal portfolio for Saad — Full-Stack Developer in Dubai.**

[![Live](https://img.shields.io/badge/live-saadm.dev-6e8eff?style=flat-square)](https://saadm.dev/)
[![License: MIT](https://img.shields.io/badge/license-MIT-5eead4?style=flat-square)](LICENSE)
[![Cloudflare Pages](https://img.shields.io/badge/deploy-Cloudflare-f6821f?style=flat-square&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![Built with](https://img.shields.io/badge/built%20with-React%20%2B%20Vanilla%20CSS-c4b5fd?style=flat-square&logo=react&logoColor=white)](#tech-stack)
[![Lint](https://github.com/saad-mughal435/site/actions/workflows/lint.yml/badge.svg)](https://github.com/saad-mughal435/site/actions/workflows/lint.yml)

</div>

---

## Overview

A fast, accessible, dark-themed portfolio with a working contact form and an
interactive walkthrough of a real-world MES/ERP project.

| Page | What it does |
|------|--------------|
| [`/`](https://saadm.dev/) | Home. React 18 SPA (no build step) with animated hero, view-toggle (All / Coding / Engineering), tech-stack chips, timeline, projects, skills, FAQ. |
| [`/contact.html`](https://saadm.dev/contact.html) | Contact form, posts to [Formsubmit.co](https://formsubmit.co) → email inbox. |
| [`/demo.html`](https://saadm.dev/demo.html) | Static screenshot-style walkthrough of the MES/ERP project (fabricated data). |
| [`/app/`](https://saadm.dev/app/) | Disconnected live demo: the real frontend running entirely in the browser with a fetch interceptor. Auto-logs in as admin. |
| [`/b2c/`](https://saadm.dev/b2c/) | **Pebble & Co.** — full DTC storefront demo. Storefront, catalog, product detail, cart, multi-step checkout, customer account, Shopify-style admin panel. Mock API runs in-browser. |
| [`/b2b/`](https://saadm.dev/b2b/) | **Anvil Supply Co.** — full B2B wholesale portal demo. Tier pricing, MOQ, contract discounts, quote workflow, approval workflow for orders over $1,000, admin with order/quote/approval queues. |

## Tech stack

| Layer | Tools |
|-------|-------|
| **Markup / styling** | Semantic HTML5, modern CSS3 (Grid, Flexbox, custom properties, `@keyframes`) |
| **Frontend** | React 18 via CDN + Babel-standalone (no build step) for the homepage; Vanilla JS for `contact.html` / `demo.html` / `app/` |
| **Animations** | Scroll-triggered `IntersectionObserver` reveals, count-up stats, cursor-tilt 3D code window, magnetic CTAs, sliding view-toggle indicator, gradient orbs |
| **SEO** | Per-page meta, Open Graph, Twitter Cards, JSON-LD (Person, FAQPage, WebSite), canonical URLs, `sitemap.xml`, `robots.txt` |
| **Hosting** | Cloudflare Pages — auto-deploy on push to `main` |
| **CI** | GitHub Actions: Prettier check, HTML validation, link check |
| **Forms** | Formsubmit.co relay (no backend required) |

## Project structure

```
.
├── index.html             # React 18 home (single-file SPA)
├── contact.html           # Contact form
├── demo.html              # Static MES/ERP walkthrough
├── home.css               # Home page styles + animations
├── styles.css             # Shared styles (contact + demo + app)
├── script.js              # Home interactions
├── contact.js             # Contact form validation + AJAX submit
├── demo.css / demo.js     # Static walkthrough styles + nav
├── saad.png               # Profile headshot (avatar + OG image)
├── sitemap.xml            # Sitemap for search engines
├── robots.txt             # Crawl directives
├── _headers               # Cloudflare HTTP headers (cache, security)
├── _redirects             # Cloudflare URL rewrites
├── run.bat / push.bat     # Windows dev convenience scripts
├── package.json           # Dev scripts (no runtime deps)
├── app/                   # Disconnected live MES/ERP demo
│   ├── index.html
│   └── css/  js/  api/    # Sanitised assets + mock-api interceptor
├── b2c/                   # Pebble & Co. DTC storefront demo
│   ├── index.html  products.html  product.html
│   ├── cart.html  checkout.html  success.html
│   ├── account.html  admin.html
│   ├── css/shop.css       # Coral/peach light design system
│   └── js/                # data, mock-api, storefront, checkout, admin, notifications
├── b2b/                   # Anvil Supply Co. wholesale portal demo
│   ├── index.html  catalog.html  product.html
│   ├── cart.html  quote-request.html  checkout.html  success.html
│   ├── account.html  admin.html
│   ├── css/shop.css       # Navy/slate light design system
│   └── js/                # data, mock-api, catalog (bulk paste), checkout (approval), admin
└── .github/
    ├── workflows/lint.yml # Prettier + HTML validate + link check
    ├── ISSUE_TEMPLATE/
    └── PULL_REQUEST_TEMPLATE.md
```

## Local development

Requires Python 3 on `PATH` (no Node needed for the static site).

```bash
# Option 1: npm script
npm run dev

# Option 2: directly
python -m http.server 8000 --bind 127.0.0.1

# Option 3 (Windows): double-click run.bat
```

Then open <http://127.0.0.1:8000>.

No build step. No webpack. No bundler. Edit a file, refresh.

## Deploy

Pushes to `main` auto-deploy on Cloudflare Pages.

```bash
# Quick deploy (Windows: double-click push.bat instead)
git add .
git commit -m "feat: my change"
git pull --rebase origin main
git push
```

Cloudflare's GitHub webhook fires on push and a fresh build is live within ~30s
at <https://saadm.dev>.

### Cloudflare build settings

| Setting | Value |
|---------|-------|
| Framework preset | None |
| Build command | _(blank)_ |
| Build output directory | _(blank — repo root is the site)_ |
| Production branch | `main` |

## Quality / SEO

The homepage ships with:

- **Person JSON-LD** — name, jobTitle, employer, alumniOf, knowsAbout (50+ skills), knowsLanguage, sameAs. Read by Google's Knowledge Graph.
- **FAQPage JSON-LD** — drives the expandable Q&A rich result in Google.
- **WebSite JSON-LD** — enables sitelinks searchbox.
- **OpenGraph + Twitter Cards** — social-share previews on LinkedIn, X, WhatsApp, Slack.
- **Lighthouse-friendly** — accessible colour contrast, semantic markup, `prefers-reduced-motion` respected, mobile-first responsive.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports → [issues](https://github.com/saad-mughal435/site/issues).
Security disclosures → [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE). Profile content (writing, photo, identity) © Saad.

---

<div align="center">

Built by [Saad](https://saadm.dev) · Dubai, UAE

[saad@saadm.dev](mailto:saad@saadm.dev) · [LinkedIn](https://www.linkedin.com/in/muhammadsaad435/) · [GitHub](https://github.com/saad-mughal435)

</div>
