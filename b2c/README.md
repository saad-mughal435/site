<div align="center">

# Pebble & Co. — DTC storefront demo

**A direct-to-consumer e-commerce demo with a Shopify-style admin panel. Vanilla stack, mock API, runs entirely in your browser.**

[![Live](https://img.shields.io/badge/live-saadm.dev%2Fb2c%2F-7c9cff?style=for-the-badge)](https://saadm.dev/b2c/)
[![Portfolio](https://img.shields.io/badge/portfolio-saadm.dev-5eead4?style=for-the-badge)](https://saadm.dev/)
[![License](https://img.shields.io/badge/license-MIT-c4b5fd?style=for-the-badge)](../LICENSE)

</div>

---

## What this is

A complete direct-to-consumer commerce demo — storefront, catalog, product detail, cart, multi-step checkout, customer account, and a 7-section admin panel — all running in the browser with a fetch-interceptor mock API. Built to show what shipping a self-contained commerce surface looks like without leaning on Shopify, Stripe, or any other SaaS.

## Quick links

- 🌐 **Live storefront**: [saadm.dev/b2c/](https://saadm.dev/b2c/)
- ⚙ **Admin panel**: [saadm.dev/b2c/admin.html](https://saadm.dev/b2c/admin.html)
- 🏠 **Full portfolio**: [saadm.dev](https://saadm.dev/)

## What you can do

### Customer side
- Browse a 24-product catalog with category filters, search, and featured carousels.
- View product detail with reviews (~80 fabricated), variants (colour / size), specs, related products.
- Add to cart, apply promo codes (`SUMMER15`, `FREESHIP`, etc.), proceed to multi-step checkout.
- Pay via fabricated card / Apple Pay / Google Pay — order confirmation page, order email log entry.
- Manage account: order history, addresses, loyalty points, wishlist, password / email update.

### Admin side
- **Dashboard** — KPIs, revenue trend, recent orders, low-stock alerts.
- **Orders** — table + detail, status overrides (paid / fulfilled / shipped / delivered / cancelled / refunded), print packing slip + refund.
- **Products** — CRUD with variant pricing, bulk publish / unpublish / feature, CSV export.
- **Customers** — segment view, lifetime value, order history per customer.
- **Promotions** — promo-code editor (percent / fixed / shipping).
- **Banners** — homepage hero editor.
- **Email log** — every transactional email rendered in-app.
- **Settings** — currencies, FX rates, contact, danger-zone reset.

## Tech

| Layer | Tools |
|-------|-------|
| Markup / styles | Semantic HTML5 · modern CSS3 (Grid + Flexbox + custom properties) |
| Frontend | Vanilla JavaScript (ES6+) — no framework, no build step |
| State | `localStorage` (cart, orders, customer overrides, banners, settings) |
| Mock backend | `fetch` + `XMLHttpRequest` shim under `js/mock-api.js` |
| Notifications | Hand-rolled toast stack + bell dropdown |
| Notifications | Hand-rolled toast stack + bell dropdown |
| Hosting | Cloudflare Pages |

## Running locally

```bash
git clone https://github.com/saad-mughal435/pebble-storefront.git
cd pebble-storefront
python -m http.server 8000
# open http://localhost:8000
```

No build step. Edit a file, refresh.

## Repository structure

```
.
├── index.html          # Storefront landing
├── products.html       # Catalog grid + filters
├── product.html        # Single product detail
├── cart.html           # Cart + promo entry
├── checkout.html       # Multi-step checkout
├── success.html        # Order confirmation
├── account.html        # Customer dashboard
├── admin.html          # 7-section admin SPA
├── css/shop.css        # Coral/peach light design system
└── js/
    ├── data.js         # 24 products · 80 reviews · 12 customers · 30 orders
    ├── mock-api.js     # Fetch shim with 25+ endpoints
    ├── app.js          # Shared shell utilities
    ├── storefront.js   # Catalog + product detail logic
    ├── checkout.js     # Multi-step checkout flow
    ├── admin.js        # Admin SPA bootstrap + hash routing
    ├── admin-sections.js # Per-section renderers
    └── notifications.js  # Toast + bell + email log
```

## Canonical source

Mirror of `site/b2c/` from the main portfolio repo, split out for visibility:

📦 **[saad-mughal435/site](https://github.com/saad-mughal435/site)** (under `b2c/`)

Updates flow from there via `git subtree split`.

## License

[MIT](LICENSE). All products, prices, reviews, customers and order data are fabricated.

---

<div align="center">

Built by **[Muhammad Saad](https://saadm.dev)** · Electrical & Automation Engineer · ERP/OEE Developer · UAE-based, open to relocate worldwide.

</div>
