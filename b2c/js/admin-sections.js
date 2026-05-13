/* =========================================================
   Pebble & Co. - admin section renderers
   Exposes window.PebbleAdmin = { dashboard, orders, products, ... }
   Each function takes the host element and renders into it.
   ========================================================= */
(function () {
  'use strict';

  const PA = window.PebbleAdmin = {};
  const fm = (n) => window.formatMoney(n);

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* =========================================================
     DASHBOARD
     ========================================================= */
  PA.dashboard = async function (host) {
    const data = await fetch('/b2c/api/admin/dashboard').then(r => r.json());
    const k = data.kpis;
    host.innerHTML = `
      <div class="admin-page">
        <header class="admin-page-head">
          <div>
            <h1 class="admin-h1">Dashboard</h1>
            <p class="admin-sub">A snapshot of how the store is doing today.</p>
          </div>
          <div class="admin-page-actions">
            <button class="btn btn-ghost btn-sm" id="dash-refresh">↻ Refresh</button>
            <button class="btn btn-primary btn-sm" onclick="window.location.hash='#orders'">View orders &rarr;</button>
          </div>
        </header>

        <div class="kpi-grid">
          ${kpi('Revenue (all time)', fm(k.revenue_total), '+12.4%', 'good')}
          ${kpi('Orders today', k.orders_today, '+3', 'good')}
          ${kpi('Avg order value', fm(k.avg_order), '+$4.20', 'good')}
          ${kpi('Conversion', k.conversion_pct.toFixed(2) + '%', '+0.3pp', 'good')}
          ${kpi('New customers', k.new_customers, 'this week', 'neutral')}
          ${kpi('Inventory value', fm(k.inventory_value), '-', 'neutral')}
        </div>

        <div class="admin-grid-2">
          <div class="admin-card">
            <div class="admin-card-head">
              <h3>Revenue, last 7 days</h3>
              <span class="admin-card-sub">${fm(data.revenue_trend.reduce((s, d) => s + d.revenue, 0))} total</span>
            </div>
            <div class="bar-chart">
              ${data.revenue_trend.map(d => {
                const max = Math.max(...data.revenue_trend.map(x => x.revenue));
                const h = Math.round((d.revenue / max) * 100);
                const lbl = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][d.day % 7];
                return `<div class="bar-wrap"><div class="bar" style="height:${h}%;" title="${fm(d.revenue)}"></div><div class="bar-label">${lbl}</div></div>`;
              }).join('')}
            </div>
          </div>

          <div class="admin-card">
            <div class="admin-card-head">
              <h3>Low stock</h3>
              <span class="admin-card-sub">${data.low_stock.length} item(s)</span>
            </div>
            <div class="admin-list">
              ${data.low_stock.slice(0, 6).map(p => `
                <div class="admin-list-row">
                  <div>
                    <div style="font-weight:600;">${esc(p.name)}</div>
                    <div style="color:var(--ink-soft); font-size:12.5px;">${esc(p.category)}</div>
                  </div>
                  <div style="text-align:right;">
                    <div style="color:var(--red); font-weight:700;">${p.stock} left</div>
                    <div style="font-size:12px; color:var(--ink-mute);">${fm(p.price)}</div>
                  </div>
                </div>
              `).join('') || '<div style="color:var(--ink-soft); padding:18px 0;">All stock levels healthy.</div>'}
            </div>
          </div>
        </div>

        <div class="admin-card" style="margin-top:24px;">
          <div class="admin-card-head">
            <h3>Recent orders</h3>
            <a href="#orders" class="btn-link">View all &rarr;</a>
          </div>
          ${ordersTable(data.recent_orders, true)}
        </div>
      </div>
    `;
    host.querySelector('#dash-refresh').addEventListener('click', () => PA.dashboard(host));
  };

  function kpi(label, value, delta, kind) {
    return `
      <div class="kpi-tile">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">${value}</div>
        <div class="kpi-delta ${kind}">${delta}</div>
      </div>`;
  }

  /* =========================================================
     ORDERS
     ========================================================= */
  PA.orders = async function (host) {
    let filter = 'all';
    let search = '';

    async function refresh() {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('status', filter);
      if (search) params.set('search', search);
      const { items } = await fetch('/b2c/api/admin/orders?' + params).then(r => r.json());
      document.getElementById('orders-body').innerHTML = ordersTable(items, false);
      document.getElementById('orders-count').textContent = `${items.length} order(s)`;
      wireRowClicks();
    }

    function wireRowClicks() {
      document.querySelectorAll('#orders-body [data-order]').forEach(r => {
        r.addEventListener('click', () => openOrderModal(r.dataset.order));
      });
    }

    host.innerHTML = `
      <div class="admin-page">
        <header class="admin-page-head">
          <div>
            <h1 class="admin-h1">Orders</h1>
            <p class="admin-sub" id="orders-count">Loading...</p>
          </div>
          <div class="admin-page-actions">
            <button class="btn btn-ghost btn-sm">Export CSV (demo)</button>
            <button class="btn btn-primary btn-sm">Create order</button>
          </div>
        </header>

        <div class="admin-filterbar">
          <input type="text" placeholder="Search by order # or customer..." id="orders-search">
          <div class="admin-pills" id="orders-status">
            ${['all','paid','fulfilled','shipped','delivered','cancelled','refunded'].map(s =>
              `<button class="pill ${s === filter ? 'active' : ''}" data-s="${s}">${s}</button>`
            ).join('')}
          </div>
        </div>

        <div class="admin-card" style="padding:0; overflow:hidden;">
          <div id="orders-body"></div>
        </div>
      </div>
    `;

    host.querySelector('#orders-search').addEventListener('input', (e) => {
      search = e.target.value;
      refresh();
    });
    host.querySelectorAll('#orders-status .pill').forEach(b => {
      b.addEventListener('click', () => {
        filter = b.dataset.s;
        host.querySelectorAll('#orders-status .pill').forEach(x => x.classList.toggle('active', x === b));
        refresh();
      });
    });

    refresh();
  };

  function ordersTable(items, compact) {
    if (!items.length) return '<div style="padding:40px; text-align:center; color:var(--ink-soft);">No orders match.</div>';
    return `
      <table class="admin-table">
        <thead><tr>
          <th>Order</th><th>Customer</th><th>Date</th>
          ${compact ? '' : '<th>Items</th>'}
          <th>Status</th><th style="text-align:right;">Total</th>
        </tr></thead>
        <tbody>
          ${items.map(o => `
            <tr data-order="${o.number || o.id}">
              <td><strong>${o.number || o.id}</strong></td>
              <td>${esc(o.customer_name || '-')}</td>
              <td>${new Date(o.placed_at).toLocaleDateString()}</td>
              ${compact ? '' : `<td>${o.lines?.length || 0}</td>`}
              <td><span class="badge ${statusBadge(o.status)}">${o.status}</span></td>
              <td style="text-align:right; font-weight:700;">${fm(o.total)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function statusBadge(s) {
    return s === 'paid' || s === 'fulfilled' || s === 'delivered' ? 'badge-green'
         : s === 'shipped' ? 'badge-sage'
         : s === 'cancelled' || s === 'refunded' ? 'badge-red'
         : 'badge-amber';
  }

  async function openOrderModal(id) {
    const o = await fetch('/b2c/api/admin/orders/' + encodeURIComponent(id)).then(r => r.json());
    if (!o) return;
    showAdminModal(`Order ${o.number || o.id}`, `
      <div class="admin-modal-grid">
        <div>
          <h4>Items</h4>
          <div class="success-lines">
            ${(o.lines || []).map(l => `
              <div class="success-line">
                <div class="success-line-image">${l.product ? window.makeProductSvg(l.product, {k:0}) : ''}<span>${l.qty}</span></div>
                <div class="success-line-body">
                  <div class="success-line-name">${esc(l.product_name || l.product?.name || '-')}</div>
                  ${l.variant_name ? `<div class="success-line-variant">${esc(l.variant_name)}</div>` : ''}
                </div>
                <div class="success-line-price">${fm(l.line_total)}</div>
              </div>
            `).join('')}
          </div>
          <div style="margin-top:14px;">
            <div class="summary-row"><span>Subtotal</span><span>${fm(o.subtotal)}</span></div>
            ${o.discount > 0 ? `<div class="summary-row discount"><span>Discount</span><span>- ${fm(o.discount)}</span></div>` : ''}
            <div class="summary-row"><span>Shipping</span><span>${(o.shipping_cost ?? o.shipping) === 0 ? 'Free' : fm(o.shipping_cost ?? o.shipping)}</span></div>
            <div class="summary-row"><span>Tax</span><span>${fm(o.tax)}</span></div>
            <div class="summary-row total"><span>Total</span><span>${fm(o.total)}</span></div>
          </div>
        </div>
        <div>
          <h4>Customer</h4>
          <p>${esc(o.customer_name)}</p>
          <p style="color:var(--ink-soft); font-size:13px;">${esc(o.customer_email || '')}</p>

          <h4 style="margin-top:18px;">Payment</h4>
          <p>${esc(o.payment_method || (o.payment ? o.payment.kind : 'card'))}</p>

          <h4 style="margin-top:18px;">Status</h4>
          <p><span class="badge ${statusBadge(o.status)}">${o.status}</span></p>

          <div style="margin-top:18px; display:flex; flex-direction:column; gap:8px;">
            <button class="btn btn-primary btn-sm">Mark as shipped</button>
            <button class="btn btn-ghost btn-sm">Print packing slip</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red); border-color:#f4c4b8;">Refund (demo)</button>
          </div>
        </div>
      </div>
    `);
  }

  /* =========================================================
     PRODUCTS
     ========================================================= */
  PA.products = async function (host) {
    const { items } = await fetch('/b2c/api/admin/products').then(r => r.json());
    host.innerHTML = `
      <div class="admin-page">
        <header class="admin-page-head">
          <div>
            <h1 class="admin-h1">Products</h1>
            <p class="admin-sub">${items.length} products &middot; ${items.filter(p => p.stock < 15).length} low stock</p>
          </div>
          <div class="admin-page-actions">
            <button class="btn btn-ghost btn-sm">Import CSV</button>
            <button class="btn btn-primary btn-sm">+ New product</button>
          </div>
        </header>

        <div class="admin-card" style="padding:0;">
          <table class="admin-table">
            <thead><tr>
              <th></th><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Rating</th><th></th>
            </tr></thead>
            <tbody>
              ${items.map((p, k) => `
                <tr data-prod="${p.id}">
                  <td style="width:56px;">
                    <div style="width:42px; height:42px; border-radius:8px; overflow:hidden; background:var(--surface-2);">
                      ${window.makeProductSvg(p, { k })}
                    </div>
                  </td>
                  <td>
                    <div style="font-weight:600;">${esc(p.name)}</div>
                    <div style="color:var(--ink-mute); font-size:12px; font-family:var(--mono);">${esc(p.sku || p.id)}</div>
                  </td>
                  <td>${esc(p.category)}</td>
                  <td>${fm(p.price)}${p.compare_at ? `<div style="color:var(--ink-mute); font-size:12px; text-decoration:line-through;">${fm(p.compare_at)}</div>` : ''}</td>
                  <td><span class="badge ${p.stock < 10 ? 'badge-red' : p.stock < 25 ? 'badge-amber' : 'badge-green'}">${p.stock}</span></td>
                  <td>★ ${p.rating} <span style="color:var(--ink-mute); font-size:12px;">(${p.review_count})</span></td>
                  <td style="text-align:right;">
                    <button class="btn-link" data-edit>Edit</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    host.querySelectorAll('[data-edit]').forEach(b => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        window.toast('Product editor coming soon (demo)', 'success');
      });
    });
  };

  /* =========================================================
     CUSTOMERS
     ========================================================= */
  PA.customers = async function (host) {
    const { items } = await fetch('/b2c/api/admin/customers').then(r => r.json());
    const segments = {
      vip:       items.filter(c => c.segment === 'vip').length,
      returning: items.filter(c => c.segment === 'returning').length,
      new:       items.filter(c => c.segment === 'new').length,
    };
    host.innerHTML = `
      <div class="admin-page">
        <header class="admin-page-head">
          <div>
            <h1 class="admin-h1">Customers</h1>
            <p class="admin-sub">${items.length} accounts &middot; ${segments.vip} VIP, ${segments.returning} returning, ${segments.new} new</p>
          </div>
          <div class="admin-page-actions">
            <button class="btn btn-ghost btn-sm">Export</button>
            <button class="btn btn-primary btn-sm">+ Add customer</button>
          </div>
        </header>

        <div class="seg-tiles">
          <div class="seg-tile seg-vip"><div class="seg-label">VIP</div><div class="seg-count">${segments.vip}</div></div>
          <div class="seg-tile seg-ret"><div class="seg-label">Returning</div><div class="seg-count">${segments.returning}</div></div>
          <div class="seg-tile seg-new"><div class="seg-label">New</div><div class="seg-count">${segments.new}</div></div>
        </div>

        <div class="admin-card" style="padding:0; margin-top:18px;">
          <table class="admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Joined</th><th>Orders</th><th>Lifetime value</th><th>Segment</th><th>Points</th></tr></thead>
            <tbody>
              ${items.map(c => `
                <tr data-cust="${c.id}">
                  <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                      <div class="cust-avatar">${initials(c.name)}</div>
                      <strong>${esc(c.name)}</strong>
                    </div>
                  </td>
                  <td style="font-family:var(--mono); font-size:13px;">${esc(c.email)}</td>
                  <td>${new Date(c.joined).toLocaleDateString()}</td>
                  <td>${c.orders_count}</td>
                  <td style="font-weight:700;">${fm(c.lifetime_value)}</td>
                  <td><span class="badge ${c.segment === 'vip' ? 'badge-coral' : c.segment === 'returning' ? 'badge-sage' : 'badge-amber'}">${c.segment}</span></td>
                  <td style="font-family:var(--mono);">${c.points}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  function initials(name) {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  /* =========================================================
     PROMOTIONS
     ========================================================= */
  PA.promotions = async function (host) {
    const { items } = await fetch('/b2c/api/admin/promotions').then(r => r.json());
    host.innerHTML = `
      <div class="admin-page">
        <header class="admin-page-head">
          <div>
            <h1 class="admin-h1">Promotions</h1>
            <p class="admin-sub">${items.length} active codes &middot; banner schedule below</p>
          </div>
          <div class="admin-page-actions">
            <button class="btn btn-primary btn-sm">+ New promo code</button>
          </div>
        </header>

        <div class="admin-card" style="padding:0;">
          <table class="admin-table">
            <thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min subtotal</th><th>Uses</th><th>Status</th></tr></thead>
            <tbody>
              ${items.map(p => `
                <tr>
                  <td><code class="codechip">${esc(p.code)}</code></td>
                  <td>${p.type}</td>
                  <td>${p.type === 'percent' ? p.value + '%' : p.type === 'fixed' ? '$' + p.value : 'Free shipping'}</td>
                  <td>${p.min_subtotal ? fm(p.min_subtotal) : '-'}</td>
                  <td>${p.used_count ?? 0}/${p.max_uses ?? '∞'}</td>
                  <td><span class="badge ${p.active ? 'badge-green' : 'badge-red'}">${p.active ? 'active' : 'inactive'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="admin-card" style="margin-top:24px;">
          <div class="admin-card-head">
            <h3>Banner schedule</h3>
            <button class="btn btn-ghost btn-sm">+ Add banner</button>
          </div>
          <div class="admin-list">
            <div class="admin-list-row">
              <div><strong>Spring drop is live</strong><div style="color:var(--ink-soft); font-size:13px;">Active &middot; appears in hero eyebrow</div></div>
              <span class="badge badge-green">running</span>
            </div>
            <div class="admin-list-row">
              <div><strong>Free shipping over $75</strong><div style="color:var(--ink-soft); font-size:13px;">Active &middot; nav strip and cart bar</div></div>
              <span class="badge badge-green">running</span>
            </div>
            <div class="admin-list-row">
              <div><strong>WELCOME15 for new signups</strong><div style="color:var(--ink-soft); font-size:13px;">Triggered after newsletter signup</div></div>
              <span class="badge badge-sage">automation</span>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  /* =========================================================
     ANALYTICS
     ========================================================= */
  PA.analytics = async function (host) {
    const data = await fetch('/b2c/api/admin/analytics').then(r => r.json());
    const f = data.funnel;
    host.innerHTML = `
      <div class="admin-page">
        <header class="admin-page-head">
          <div>
            <h1 class="admin-h1">Analytics</h1>
            <p class="admin-sub">Last 30 days &middot; mock data, refreshed each load</p>
          </div>
        </header>

        <div class="admin-card">
          <div class="admin-card-head"><h3>Revenue, last 30 days</h3></div>
          <div class="bar-chart bar-chart-tall">
            ${data.revenue_trend.map(d => {
              const max = Math.max(...data.revenue_trend.map(x => x.revenue));
              const h = Math.round((d.revenue / max) * 100);
              return `<div class="bar-wrap"><div class="bar" style="height:${h}%;" title="${fm(d.revenue)}"></div></div>`;
            }).join('')}
          </div>
        </div>

        <div class="admin-grid-2" style="margin-top:24px;">
          <div class="admin-card">
            <div class="admin-card-head"><h3>Conversion funnel</h3></div>
            <div class="funnel">
              ${[
                ['Visitors',          f.visitors,         '100%'],
                ['Viewed product',    f.viewed_product,   pct(f.viewed_product,   f.visitors)],
                ['Added to cart',     f.added_to_cart,    pct(f.added_to_cart,    f.visitors)],
                ['Reached checkout',  f.reached_checkout, pct(f.reached_checkout, f.visitors)],
                ['Purchased',         f.purchased,        pct(f.purchased,        f.visitors)],
              ].map(([label, n, p]) => `
                <div class="funnel-row">
                  <div class="funnel-bar" style="width:${p};"></div>
                  <div class="funnel-label">${label}</div>
                  <div class="funnel-value">${n.toLocaleString()} <span>(${p})</span></div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="admin-card">
            <div class="admin-card-head"><h3>Revenue by category</h3></div>
            <div class="cat-bars">
              ${data.by_category.map(c => {
                const max = Math.max(...data.by_category.map(x => x.revenue));
                return `
                  <div class="cat-bar-row">
                    <div class="cat-bar-label">${esc(c.category)}</div>
                    <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${(c.revenue/max)*100}%;"></div></div>
                    <div class="cat-bar-value">${fm(c.revenue)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <div class="admin-card" style="margin-top:24px;">
          <div class="admin-card-head"><h3>Top 10 products</h3></div>
          <table class="admin-table">
            <thead><tr><th>Rank</th><th>Product</th><th>Category</th><th>Reviews</th><th>Rating</th><th>Revenue</th></tr></thead>
            <tbody>
              ${data.top_products.map((p, i) => `
                <tr>
                  <td>#${i + 1}</td>
                  <td><strong>${esc(p.name)}</strong></td>
                  <td>${esc(p.category)}</td>
                  <td>${p.review_count}</td>
                  <td>★ ${p.rating}</td>
                  <td style="font-weight:700;">${fm(p.price * p.review_count)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  function pct(n, d) { return d ? (Math.round((n / d) * 1000) / 10) + '%' : '0%'; }

  /* =========================================================
     EMAIL LOG
     ========================================================= */
  PA.emaillog = async function (host) {
    const { items } = await fetch('/b2c/api/admin/email-log').then(r => r.json());
    host.innerHTML = `
      <div class="admin-page">
        <header class="admin-page-head">
          <div>
            <h1 class="admin-h1">Email log</h1>
            <p class="admin-sub">Outbound transactional emails (mock - no real emails sent)</p>
          </div>
          <div class="admin-page-actions">
            <button class="btn btn-ghost btn-sm">Resend last</button>
            <button class="btn btn-primary btn-sm">Compose</button>
          </div>
        </header>

        <div class="admin-card" style="padding:0;">
          <table class="admin-table">
            <thead><tr><th>Type</th><th>To</th><th>Subject</th><th>Preview</th><th>Sent</th></tr></thead>
            <tbody>
              ${items.map(e => `
                <tr>
                  <td><span class="badge ${emailBadge(e.kind)}">${e.kind.replace(/_/g, ' ')}</span></td>
                  <td style="font-family:var(--mono); font-size:13px;">${esc(e.to)}</td>
                  <td><strong>${esc(e.subject)}</strong></td>
                  <td style="color:var(--ink-soft); font-size:13px; max-width:320px;">${esc(e.preview)}</td>
                  <td style="white-space:nowrap; font-size:13px; color:var(--ink-mute);">${timeAgo(e.sent_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  function emailBadge(k) {
    if (k === 'order_confirmation') return 'badge-green';
    if (k === 'shipping')           return 'badge-sage';
    if (k === 'stock_alert')        return 'badge-amber';
    if (k === 'welcome')            return 'badge-coral';
    if (k === 'abandoned_cart')     return 'badge-red';
    return 'badge';
  }

  function timeAgo(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return Math.round(diff) + 's ago';
    if (diff < 3600)  return Math.round(diff / 60) + 'm ago';
    if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
    return Math.round(diff / 86400) + 'd ago';
  }

  /* =========================================================
     SETTINGS
     ========================================================= */
  PA.settings = async function (host) {
    const s = await fetch('/b2c/api/admin/settings').then(r => r.json());
    host.innerHTML = `
      <div class="admin-page">
        <header class="admin-page-head">
          <div>
            <h1 class="admin-h1">Settings</h1>
            <p class="admin-sub">Store config, shipping, tax, integrations</p>
          </div>
        </header>

        <div class="admin-grid-2">
          <div class="admin-card">
            <h3>Store info</h3>
            <form class="checkout-form" style="padding:0; border:0; background:transparent; margin-top:14px;">
              <div class="form-field"><label>Store name</label><input value="${esc(s.store_name)}"></div>
              <div class="form-field"><label>Contact email</label><input value="${esc(s.email)}"></div>
              <div class="form-row-2">
                <div class="form-field"><label>Free shipping threshold</label><input value="${s.free_shipping_threshold}"></div>
                <div class="form-field"><label>Tax rate</label><input value="${(s.tax_rate * 100).toFixed(2)}%"></div>
              </div>
            </form>
          </div>

          <div class="admin-card">
            <h3>Integrations</h3>
            <div class="admin-list" style="margin-top:10px;">
              ${[
                ['Mailchimp',         s.integrations.mailchimp,        'Newsletter sync'],
                ['Klaviyo',           s.integrations.klaviyo,          'Lifecycle email'],
                ['Google Analytics',  s.integrations.googleAnalytics,  'Site analytics'],
                ['Meta Pixel',        s.integrations.metaPixel,        'Ad attribution'],
                ['Sage 50',           false,                           'Accounting export'],
                ['SAP B1',            false,                           'Inventory sync'],
              ].map(([name, on, blurb]) => `
                <div class="admin-list-row">
                  <div>
                    <div style="font-weight:600;">${name}</div>
                    <div style="color:var(--ink-soft); font-size:12.5px;">${blurb}</div>
                  </div>
                  <label class="toggle">
                    <input type="checkbox" ${on ? 'checked' : ''}>
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="admin-card">
            <h3>Shipping zones</h3>
            <div class="admin-list" style="margin-top:10px;">
              <div class="admin-list-row"><div>UAE &amp; Saudi Arabia</div><span style="font-family:var(--mono);">Free over $75 / $8 flat</span></div>
              <div class="admin-list-row"><div>GCC ex. UAE/SA</div><span style="font-family:var(--mono);">$12 flat / Express $24</span></div>
              <div class="admin-list-row"><div>United States</div><span style="font-family:var(--mono);">$18 flat / Express $35</span></div>
              <div class="admin-list-row"><div>Rest of world</div><span style="font-family:var(--mono);">$26 flat</span></div>
            </div>
          </div>

          <div class="admin-card">
            <h3>Notifications</h3>
            <div class="admin-list" style="margin-top:10px;">
              <div class="admin-list-row"><div>New order alert</div><label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label></div>
              <div class="admin-list-row"><div>Low stock (under 10)</div><label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label></div>
              <div class="admin-list-row"><div>Daily summary email</div><label class="toggle"><input type="checkbox"><span class="toggle-slider"></span></label></div>
              <div class="admin-list-row"><div>Abandoned cart reminders</div><label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label></div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  /* =========================================================
     Modal helper
     ========================================================= */
  function showAdminModal(title, html) {
    const existing = document.querySelector('.modal-backdrop');
    if (existing) existing.remove();
    const m = document.createElement('div');
    m.className = 'modal-backdrop';
    m.innerHTML = `
      <div class="modal modal-lg">
        <div class="modal-head">
          <h3>${title}</h3>
          <button class="modal-close" aria-label="Close">×</button>
        </div>
        <div class="modal-body">${html}</div>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', (e) => { if (e.target === m) m.remove(); });
    m.querySelector('.modal-close').addEventListener('click', () => m.remove());
  }
})();
