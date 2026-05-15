<div align="center">

# Anvil Supply Co. - B2B wholesale portal demo

**A wholesale / industrial portal with tier pricing, MOQs, contract discounts, quote requests, and an approval workflow for large orders.**

[![Live](https://img.shields.io/badge/live-saadm.dev%2Fb2b%2F-7c9cff?style=for-the-badge)](https://saadm.dev/b2b/)
[![Portfolio](https://img.shields.io/badge/portfolio-saadm.dev-5eead4?style=for-the-badge)](https://saadm.dev/)
[![License](https://img.shields.io/badge/license-MIT-c4b5fd?style=for-the-badge)](../LICENSE)

</div>

---

## What this is

A full B2B wholesale portal demo - built to demonstrate what a procurement-side product looks like when the rules are *quantities, contracts, approvals*, not just credit-card checkout. Multi-user accounts, role-based access (purchaser / approver / viewer), bulk SKU paste, tier pricing, MOQ enforcement, customer-specific contract discounts, quote request workflow, and an order-approval queue for transactions over $1,000.

Runs entirely in the browser with a mock API and `localStorage`.

## Quick links

- 🌐 **Live portal**: [saadm.dev/b2b/](https://saadm.dev/b2b/)
- ⚙ **Admin panel**: [saadm.dev/b2b/admin.html](https://saadm.dev/b2b/admin.html)
- 🏠 **Full portfolio**: [saadm.dev](https://saadm.dev/)

## What you can do

### Buyer side
- **Catalog** with table / grid toggle, bulk SKU paste add ("BR-6204, 10\nBX-1812, 4"), category filter, in-stock toggle.
- **Tier pricing** - see unit price drop as quantity climbs (1 / 10 / 50 / 100 break-points).
- **MOQ enforcement** - can't order under the minimum, can't pay over the credit limit.
- **Customer-specific contract discounts** applied automatically.
- **Quote request** flow for non-standard SKUs / quantities - agent picks it up in admin.
- **Multi-step checkout** with PO number, ship-to selection, payment terms.
- **Approval workflow** - orders over $1,000 route to the customer's approver before being placed.
- **Account dashboard** - orders, quotes, invoices, recurring orders, users + roles, ship-to addresses.

### Admin side
- **Order queue** - pending / processing / approved / shipped pipelines.
- **Quote queue** - manual price quotes, with one-click "convert to order".
- **Approval queue** - orders awaiting customer-side approver sign-off.
- **Customers** with credit limits, contract terms, user list.
- **Analytics** - revenue by customer, quote conversion, average order value.
- **Email log** - every transactional email rendered.

## Tech

Same vanilla stack as the rest of the portfolio:

| Layer | Tools |
|-------|-------|
| Markup / styles | Semantic HTML5 · modern CSS3 |
| Frontend | Vanilla JavaScript (ES6+) - no framework, no build |
| State | `localStorage` (cart, orders, quotes, approvals, customer overrides) |
| Mock backend | `fetch` + `XHR` shim under `js/mock-api.js` |
| Hosting | Cloudflare Pages |

## Running locally

```bash
git clone https://github.com/saad-mughal435/anvil-wholesale.git
cd anvil-wholesale
python -m http.server 8000
# open http://localhost:8000
```

## Repository structure

```
.
├── index.html             # Portal home
├── catalog.html           # SKU table + bulk paste
├── product.html           # SKU detail
├── cart.html              # Cart with PO + ship-to
├── quote-request.html     # RFQ flow
├── checkout.html          # Checkout + approval routing
├── success.html           # Order confirmation
├── account.html           # Buyer dashboard
├── admin.html             # Admin SPA
├── css/shop.css           # Navy/slate light design system
└── js/                    # data, mock-api, catalog (bulk paste),
                           # checkout (approval), admin (queues),
                           # notifications
```

## Canonical source

Mirror of `site/b2b/` from the main portfolio repo:

📦 **[saad-mughal435/site](https://github.com/saad-mughal435/site)** (under `b2b/`)

## License

[MIT](LICENSE). All SKUs, customers, prices, contracts and orders are fabricated.

---

<div align="center">

Built by **[Muhammad Saad](https://saadm.dev)** · Electrical & Automation Engineer · ERP/OEE Developer · UAE-based, open to relocate worldwide.

</div>
