/* =========================================================
   Anvil Supply Co. - admin section renderers
   Exposes window.AnvilAdmin = { dashboard, orders, quotes, approvals, ... }
   ========================================================= */
(function () {
  'use strict';

  const AA = window.AnvilAdmin = {};
  const fm = (n) => window.formatMoney(n);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* =========================================================
     DASHBOARD
     ========================================================= */
  AA.dashboard = async function (host) {
    const data = await fetch('/b2b/api/admin/dashboard').then(r => r.json());
    const k = data.kpis;
    host.innerHTML = `
      <div class="admin-page">
        <header class="admin-page-head">
          <div>
            <h1 class="admin-h1">Operations dashboard</h1>
            <p class="admin-sub">A live view of orders, quotes, approvals, and AR.</p>
          </div>
          <div class="admin-page-actions">
            <button class="btn btn-ghost btn-sm" data-demo="Dashboard export coming soon (demo)">Export</button>
            <button class="btn btn-orange btn-sm" onclick="window.location.hash='#orders'">View order queue</button>
          </div>
        </header>

        <div class="kpi-grid">
          ${kpi('Revenue (all time)', fm(k.revenue_total), '+8.4% MoM', 'good')}
          ${kpi('Orders today', k.orders_today, 'last 24h')}
          ${kpi('Open quotes', k.open_quotes, 'awaiting reply', k.open_quotes > 0 ? 'warn' : null)}
          ${kpi('Pending approvals', k.pending_approvals, '> $1,000 threshold', k.pending_approvals > 0 ? 'warn' : null)}
          ${kpi('Overdue invoices', fm(k.overdue_invoices), 'past Net terms', k.overdue_invoices > 0 ? 'danger' : null)}
          ${kpi('Avg order value', fm(k.avg_order), 'per order')}
        </div>

        <div class="admin-grid-2">
          <div class="admin-card">
            <div class="admin-card-head">
              <h3>Revenue, last 7 days</h3>
              <span style="font-family:var(--mono); font-size:12px; color:var(--ink-soft);">${fm(data.revenue_trend.reduce((s,d) => s + d.revenue, 0))} total</span>
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
              <h3>Pending quotes</h3>
              <a href="#quotes" class="btn-link" style="font-size:12px;">View all &rarr;</a>
            </div>
            <div class="admin-list">
              ${data.pending_quotes.slice(0, 5).map(q => `
                <div class="admin-list-row">
                  <div>
                    <div style="font-weight:600;">${esc(q.company_name)}</div>
                    <div style="font-size:12px; color:var(--ink-soft);">${q.id} &middot; ${q.items_count} item(s) &middot; ${esc((q.notes || '').slice(0, 50))}</div>
                  </div>
                  <a href="#quotes" class="btn btn-primary btn-sm" style="text-decoration:none;">Respond</a>
                </div>
              `).join('') || '<div style="color:var(--ink-soft); padding:18px 0;">All quotes responded to.</div>'}
            </div>
          </div>
        </div>

        <div class="admin-grid-2" style="margin-top:18px;">
          <div class="admin-card">
            <div class="admin-card-head">
              <h3>Recent orders</h3>
              <a href="#orders" class="btn-link" style="font-size:12px;">View all &rarr;</a>
            </div>
            ${ordersTable(data.recent_orders)}
          </div>

          <div class="admin-card">
            <div class="admin-card-head">
              <h3>Low stock</h3>
              <a href="#products" class="btn-link" style="font-size:12px;">Reorder &rarr;</a>
            </div>
            <div class="admin-list">
              ${data.low_stock.map(p => `
                <div class="admin-list-row">
                  <div>
                    <div style="font-weight:600;">${esc(p.name)}</div>
                    <div style="font-size:12px; color:var(--ink-soft);"><code>${p.sku}</code> &middot; ${p.industry}</div>
                  </div>
                  <span class="badge ${p.stock < 30 ? 'badge-red' : 'badge-amber'}">${p.stock} left</span>
                </div>
              `).join('') || '<div style="color:var(--ink-soft); padding:18px 0;">All stocks healthy.</div>'}
            </div>
          </div>
        </div>
      </div>
    `;
  };

  function kpi(label, value, delta, kind) {
    const cls = kind === 'warn' ? 'warn' : kind === 'danger' ? 'danger' : '';
    const dcls = kind === 'good' ? 'good' : '';
    return `
      <div class="kpi-tile ${cls}">
        <div class="kpi-label">${label}</div>
        <div class="kpi-value">${value}</div>
        <div class="kpi-delta ${dcls}">${delta || ''}</div>
      </div>`;
  }

  /* =========================================================
     ORDERS
     ========================================================= */
  AA.orders = async function (host) {
    let filter = 'all';
    let search = '';

    async function refresh() {
      const q = new URLSearchParams();
      if (filter !== 'all') q.set('status', filter);
      if (search) q.set('search', search);
      const { items } = await fetch('/b2b/api/admin/orders?' + q).then(r => r.json());
      document.getElementById('orders-body').innerHTML = ordersTable(items);
      document.getElementById('orders-count').textContent = `${items.length} order(s)`;
      document.querySelectorAll('#orders-body [data-order]').forEach(r => {
        r.querySelector('[data-view]')?.addEventListener('click', () => openOrder(r.dataset.order));
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
            <button class="btn btn-ghost btn-sm" data-demo="Orders CSV export coming soon (demo)">Export CSV</button>
            <button class="btn btn-orange btn-sm" data-demo="Manual order creation coming soon (demo)">Create order</button>
          </div>
        </header>

        <div class="admin-filterbar">
          <input type="text" id="o-search" placeholder="Search PO, order #, or company...">
          <div class="admin-pills" id="o-pills">
            ${['all','submitted','awaiting_approval','approved','fulfilled','shipped','delivered','cancelled'].map(s =>
              `<button class="pill ${s === filter ? 'active' : ''}" data-s="${s}">${s.replace(/_/g, ' ')}</button>`
            ).join('')}
          </div>
        </div>

        <div class="admin-card" style="padding:0;">
          <div id="orders-body"></div>
        </div>
      </div>
    `;

    host.querySelector('#o-search').addEventListener('input', (e) => { search = e.target.value; refresh(); });
    host.querySelectorAll('#o-pills .pill').forEach(b => {
      b.addEventListener('click', () => {
        filter = b.dataset.s;
        host.querySelectorAll('#o-pills .pill').forEach(x => x.classList.toggle('active', x === b));
        refresh();
      });
    });
    refresh();
  };

  function ordersTable(items) {
    if (!items.length) return '<div style="padding:36px; text-align:center; color:var(--ink-soft);">No orders match.</div>';
    return `
      <table class="product-table">
        <thead><tr><th>Order</th><th>Customer</th><th>PO</th><th>Date</th><th>Status</th><th style="text-align:right;">Total</th><th></th></tr></thead>
        <tbody>
          ${items.map(o => `
            <tr data-order="${o.id}">
              <td class="sku-cell">${o.id}</td>
              <td>${esc(o.company_name || '-')}</td>
              <td style="font-family:var(--mono); font-size:12.5px; color:var(--ink-2);">${esc(o.po_number || '-')}</td>
              <td>${new Date(o.placed_at).toLocaleDateString()}</td>
              <td><span class="badge ${statusBadge(o.status)}">${o.status.replace(/_/g, ' ')}</span></td>
              <td style="font-family:var(--mono); text-align:right; font-weight:600;">${fm(o.total)}</td>
              <td><button class="btn-link" data-view>View</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function statusBadge(s) {
    if (s === 'delivered' || s === 'fulfilled' || s === 'approved') return 'badge-green';
    if (s === 'shipped') return 'badge-teal';
    if (s === 'awaiting_approval' || s === 'submitted') return 'badge-amber';
    if (s === 'cancelled') return 'badge-red';
    return 'badge-navy';
  }

  async function openOrder(id) {
    const o = await fetch('/b2b/api/orders/' + encodeURIComponent(id)).then(r => r.json());
    window.showModal(`Order ${o.id}`, `
      <div style="display:flex; flex-wrap:wrap; gap:12px; margin-bottom:14px; font-size:12.5px; color:var(--ink-soft);">
        <span><strong>PO:</strong> <code>${o.po_number || '-'}</code></span>
        <span><strong>Customer:</strong> ${esc(o.company_name)}</span>
        <span><strong>Status:</strong> <span class="badge ${statusBadge(o.status)}">${o.status}</span></span>
        <span><strong>Terms:</strong> ${esc(o.payment_terms)}</span>
      </div>
      <table class="product-table">
        <thead><tr><th>SKU</th><th>Name</th><th>Qty</th><th style="text-align:right;">Unit</th><th style="text-align:right;">Line</th></tr></thead>
        <tbody>
          ${(o.lines || []).map(l => `
            <tr><td class="sku-cell">${l.sku || l.product?.sku || '-'}</td><td>${esc(l.name || l.product?.name)}</td><td style="font-family:var(--mono);">${l.qty}</td><td style="font-family:var(--mono); text-align:right;">${fm(l.unit_price)}</td><td style="font-family:var(--mono); text-align:right; font-weight:600;">${fm(l.line_total)}</td></tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top:14px;">
        <div class="summary-row"><span>Subtotal</span><span style="font-family:var(--mono);">${fm(o.subtotal)}</span></div>
        ${o.discount > 0 ? `<div class="summary-row discount"><span>Discount</span><span>- ${fm(o.discount)}</span></div>` : ''}
        <div class="summary-row"><span>Freight</span><span style="font-family:var(--mono);">${o.freight === 0 ? 'Free' : fm(o.freight)}</span></div>
        <div class="summary-row"><span>Tax</span><span style="font-family:var(--mono);">${fm(o.tax)}</span></div>
        <div class="summary-row total"><span>Total</span><span>${fm(o.total)}</span></div>
      </div>
      <div style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" data-demo="Order marked as shipped (demo)">Mark shipped</button>
        <button class="btn btn-ghost btn-sm" data-demo="Pick list generated (demo)">Pick list</button>
        <button class="btn btn-ghost btn-sm" data-demo="Invoice generated (demo)">Invoice</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red); border-color:#f4c4b8;" data-demo="Order cancelled (demo)">Cancel</button>
      </div>
    `, { large: true });
  }

  /* =========================================================
     QUOTES
     ========================================================= */
  AA.quotes = async function (host) {
    const { items } = await fetch('/b2b/api/admin/quotes').then(r => r.json());
    host.innerHTML = `
      <div class="admin-page">
        <header class="admin-page-head">
          <div>
            <h1 class="admin-h1">Quote queue</h1>
            <p class="admin-sub">${items.filter(q => q.status === 'pending').length} pending response &middot; ${items.length} total</p>
          </div>
          <div class="admin-page-actions">
            <button class="btn btn-orange btn-sm" data-demo="Quote creation coming soon (demo)">+ New quote</button>
          </div>
        </header>

        <div class="admin-card" style="padding:0;">
          <table class="product-table">
            <thead><tr><th>Quote</th><th>Company</th><th>Requester</th><th>Requested</th><th>Items</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${items.map(q => `
                <tr>
                  <td class="sku-cell">${q.id}</td>
                  <td>${esc(q.company_name)}</td>
                  <td>${esc(q.requester)}</td>
                  <td>${new Date(q.requested_at).toLocaleDateString()}</td>
                  <td style="font-family:var(--mono);">${q.items_count}</td>
                  <td><span class="badge ${q.status === 'quoted' || q.status === 'accepted' ? 'badge-green' : q.status === 'pending' ? 'badge-amber' : q.status === 'expired' ? 'badge-red' : 'badge-navy'}">${q.status}</span></td>
                  <td><button class="btn-link" data-quote="${q.id}">Respond</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    host.querySelectorAll('[data-quote]').forEach(b => {
      b.addEventListener('click', () => respondQuote(b.dataset.quote, items));
    });
  };

  function respondQuote(id, items) {
    const q = items.find(x => x.id === id);
    if (!q) return;
    window.showModal(`Respond to ${q.id}`, `
      <div style="margin-bottom:12px; font-size:13px; color:var(--ink-soft);">
        <strong>${esc(q.company_name)}</strong> &middot; ${esc(q.requester)} &middot; ${q.items_count} item(s) &middot; ${new Date(q.requested_at).toLocaleDateString()}
      </div>
      ${q.notes ? `<div style="background:var(--surface-2); padding:10px 12px; border-radius:var(--r-sm); font-size:13px; margin-bottom:14px;"><strong>Notes:</strong> ${esc(q.notes)}</div>` : ''}
      <p style="font-size:13.5px; color:var(--ink-2); margin-bottom:12px;">In the full version this would show each line, let you enter your unit price + freight, and email a PDF quote to the customer.</p>
      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary btn-sm" data-demo="Quote sent to customer (demo)">Send quote</button>
        <button class="btn btn-ghost btn-sm" data-demo="Draft saved (demo)">Save draft</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red); border-color:#f4c4b8;" data-demo="Quote declined (demo)">Decline</button>
      </div>
    `, { large: true });
  }

  /* =========================================================
     APPROVALS
     ========================================================= */
  AA.approvals = async function (host) {
    const { items } = await fetch('/b2b/api/admin/approvals').then(r => r.json());
    host.innerHTML = `
      <div class="admin-page">
        <header class="admin-page-head">
          <div>
            <h1 class="admin-h1">Approval queue</h1>
            <p class="admin-sub">${items.filter(o => o.status === 'awaiting_approval').length} awaiting decision &middot; threshold $1,000</p>
          </div>
        </header>

        ${!items.length ? `<div style="padding:48px; text-align:center; color:var(--ink-soft); background:#fff; border:1px solid var(--line); border-radius:var(--r-lg);">Approval queue is empty. Nothing to review.</div>` : `
        <div class="admin-card" style="padding:0;">
          <table class="product-table">
            <thead><tr><th>Order</th><th>Company</th><th>Submitted by</th><th>Date</th><th style="text-align:right;">Total</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${items.map(o => `
                <tr>
                  <td class="sku-cell">${o.id}</td>
                  <td>${esc(o.company_name)}</td>
                  <td>${esc(o.customer_name)}</td>
                  <td>${new Date(o.placed_at).toLocaleDateString()}</td>
                  <td style="font-family:var(--mono); text-align:right; font-weight:600;">${fm(o.total)}</td>
                  <td><span class="badge ${statusBadge(o.status)}">${o.status.replace(/_/g, ' ')}</span></td>
                  <td>
                    <button class="btn btn-primary btn-sm" data-approve="${o.id}">Approve</button>
                    <button class="btn btn-ghost btn-sm" style="color:var(--red); border-color:#f4c4b8;" data-reject="${o.id}">Reject</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        `}
      </div>
    `;
    host.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => window.toast(`Order ${b.dataset.approve} approved`, 'success')));
    host.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', () => window.toast(`Order ${b.dataset.reject} rejected`, 'error')));
  };

  /* =========================================================
     PRODUCTS
     ========================================================= */
  AA.products = async function (host) {
    const { items } = await fetch('/b2b/api/admin/products').then(r => r.json());
    host.innerHTML = `
      <div class="admin-page">
        <header class="admin-page-head">
          <div>
            <h1 class="admin-h1">Products</h1>
            <p class="admin-sub">${items.length} active SKUs &middot; ${items.filter(p => p.stock < 50).length} low</p>
          </div>
          <div class="admin-page-actions">
            <button class="btn btn-ghost btn-sm" data-demo="SKU CSV import coming soon (demo)">Import CSV</button>
            <button class="btn btn-orange btn-sm" data-demo="SKU creation coming soon (demo)">+ New SKU</button>
          </div>
        </header>
        <div class="admin-card" style="padding:0;">
          <table class="product-table">
            <thead><tr><th>SKU</th><th>Name</th><th>Industry</th><th>Manufacturer</th><th>Stock</th><th>Unit</th><th>MOQ</th><th></th></tr></thead>
            <tbody>
              ${items.map(p => `
                <tr>
                  <td class="sku-cell">${p.sku}</td>
                  <td>${esc(p.name)}</td>
                  <td>${esc(p.industry)}</td>
                  <td>${esc(p.manufacturer)}</td>
                  <td><span class="badge ${p.stock < 30 ? 'badge-red' : p.stock < 80 ? 'badge-amber' : 'badge-green'}">${p.stock}</span></td>
                  <td style="font-family:var(--mono);">${fm(p.unit_price)}</td>
                  <td style="font-family:var(--mono);">${p.moq}</td>
                  <td><button class="btn-link" data-demo="Product editor coming soon (demo)">Edit</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  /* =========================================================
     CUSTOMERS
     ========================================================= */
  AA.customers = async function (host) {
    const { items } = await fetch('/b2b/api/admin/customers').then(r => r.json());
    host.innerHTML = `
      <div class="admin-page">
        <header class="admin-page-head">
          <div>
            <h1 class="admin-h1">Customers</h1>
            <p class="admin-sub">${items.length} companies &middot; ${items.filter(c => c.tier === 'Contract').length} on contract</p>
          </div>
          <div class="admin-page-actions">
            <button class="btn btn-orange btn-sm" data-demo="Customer onboarding coming soon (demo)">+ Add customer</button>
          </div>
        </header>
        <div class="admin-card" style="padding:0;">
          <table class="product-table">
            <thead><tr><th>Company</th><th>Tier</th><th>Terms</th><th style="text-align:right;">Credit limit</th><th style="text-align:right;">Open balance</th><th>Users</th><th></th></tr></thead>
            <tbody>
              ${items.map(c => `
                <tr data-cust="${c.id}">
                  <td><strong>${esc(c.name)}</strong><div style="font-family:var(--mono); font-size:11.5px; color:var(--ink-mute);">${c.id}</div></td>
                  <td><span class="badge ${c.tier === 'Contract' ? 'badge-navy' : 'badge-amber'}">${c.tier}</span></td>
                  <td>${esc(c.payment_terms)}</td>
                  <td style="font-family:var(--mono); text-align:right;">${fm(c.credit_limit)}</td>
                  <td style="font-family:var(--mono); text-align:right;${c.open_balance > 0 ? 'color:var(--red); font-weight:600;' : ''}">${fm(c.open_balance)}</td>
                  <td style="font-family:var(--mono);">${c.users.length}</td>
                  <td><button class="btn-link" data-open="${c.id}">View</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    host.querySelectorAll('[data-open]').forEach(b => b.addEventListener('click', () => openCustomer(b.dataset.open)));
  };

  async function openCustomer(id) {
    const c = await fetch('/b2b/api/admin/customers/' + id).then(r => r.json());
    window.showModal(c.name, `
      <div style="display:flex; gap:14px; flex-wrap:wrap; margin-bottom:14px; font-size:13px;">
        <span><strong>Tier:</strong> ${c.tier}</span>
        <span><strong>Terms:</strong> ${c.payment_terms}</span>
        <span><strong>Credit:</strong> ${fm(c.credit_limit)}</span>
        <span><strong>Open:</strong> ${fm(c.open_balance)}</span>
        <span><strong>Contract discount:</strong> ${(c.contract_discount*100).toFixed(0)}%</span>
      </div>

      <h4 style="font-size:11px; text-transform:uppercase; letter-spacing:0.6px; color:var(--ink-mute); margin:14px 0 6px;">Users</h4>
      <ul style="padding-left:18px; margin-bottom:14px; font-size:13.5px;">
        ${c.users.map(u => `<li>${esc(u.name)} &middot; <code>${esc(u.email)}</code> &middot; <span class="badge ${u.role === 'approver' ? 'badge-green' : 'badge-navy'}">${u.role}</span></li>`).join('')}
      </ul>

      <h4 style="font-size:11px; text-transform:uppercase; letter-spacing:0.6px; color:var(--ink-mute); margin:14px 0 6px;">Recent orders (${c.orders.length})</h4>
      <table class="product-table">
        <thead><tr><th>Order</th><th>Date</th><th>Status</th><th style="text-align:right;">Total</th></tr></thead>
        <tbody>
          ${c.orders.slice(0, 5).map(o => `<tr><td class="sku-cell">${o.id}</td><td>${new Date(o.placed_at).toLocaleDateString()}</td><td><span class="badge ${statusBadge(o.status)}">${o.status}</span></td><td style="font-family:var(--mono); text-align:right;">${fm(o.total)}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center; color:var(--ink-soft);">No orders.</td></tr>'}
        </tbody>
      </table>

      <h4 style="font-size:11px; text-transform:uppercase; letter-spacing:0.6px; color:var(--ink-mute); margin:14px 0 6px;">Invoices (${c.invoices.length})</h4>
      <table class="product-table">
        <thead><tr><th>Invoice</th><th>Due</th><th>Status</th><th style="text-align:right;">Amount</th></tr></thead>
        <tbody>
          ${c.invoices.map(i => `<tr><td class="sku-cell">${i.id}</td><td>${new Date(i.due_at).toLocaleDateString()}</td><td><span class="badge ${i.status === 'paid' ? 'badge-green' : i.status === 'overdue' ? 'badge-red' : 'badge-amber'}">${i.status}</span></td><td style="font-family:var(--mono); text-align:right;">${fm(i.amount)}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center; color:var(--ink-soft);">No invoices.</td></tr>'}
        </tbody>
      </table>
    `, { large: true });
  }

  /* =========================================================
     ANALYTICS
     ========================================================= */
  AA.analytics = async function (host) {
    const data = await fetch('/b2b/api/admin/analytics').then(r => r.json());
    host.innerHTML = `
      <div class="admin-page">
        <header class="admin-page-head">
          <div>
            <h1 class="admin-h1">Analytics</h1>
            <p class="admin-sub">Last 30 days &middot; mock data, refreshed on load</p>
          </div>
        </header>

        <div class="admin-card">
          <div class="admin-card-head"><h3>Revenue, last 30 days</h3><span style="font-family:var(--mono); color:var(--ink-soft); font-size:12px;">${fm(data.revenue_trend.reduce((s,d)=>s+d.revenue,0))} total</span></div>
          <div class="bar-chart" style="height:180px;">
            ${data.revenue_trend.map(d => {
              const max = Math.max(...data.revenue_trend.map(x => x.revenue));
              const h = Math.round((d.revenue / max) * 100);
              return `<div class="bar-wrap"><div class="bar" style="height:${h}%;" title="${fm(d.revenue)}"></div></div>`;
            }).join('')}
          </div>
        </div>

        <div class="admin-grid-2" style="margin-top:18px;">
          <div class="admin-card">
            <div class="admin-card-head"><h3>Revenue by industry</h3></div>
            <div class="funnel">
              ${data.by_industry.map(b => {
                const max = Math.max(...data.by_industry.map(x => x.revenue));
                const pct = (b.revenue / max) * 100;
                return `
                  <div class="funnel-row">
                    <div class="funnel-bar" style="width:${pct}%;"></div>
                    <div class="funnel-label">${esc(b.industry)}</div>
                    <div class="funnel-value">${fm(b.revenue)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="admin-card">
            <div class="admin-card-head"><h3>Top customers</h3></div>
            <table class="product-table">
              <thead><tr><th>Company</th><th style="text-align:right;">Revenue</th></tr></thead>
              <tbody>
                ${data.top_companies.slice(0, 8).map(c => `<tr><td>${esc(c.name)}</td><td style="font-family:var(--mono); text-align:right; font-weight:600;">${fm(c.revenue)}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="admin-grid-2" style="margin-top:18px;">
          <div class="admin-card">
            <div class="admin-card-head"><h3>Order fulfillment SLA</h3></div>
            <div style="font-family:var(--mono); font-size:34px; font-weight:700; color:var(--navy);">${data.fulfillment_avg_days} <span style="font-size:14px; color:var(--ink-mute); font-family:var(--sans);">avg days</span></div>
            <div style="font-size:13px; color:var(--ink-soft); margin-top:6px;">From submitted to shipped. Target ≤ 3.5 days.</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-head"><h3>Quote-to-order conversion</h3></div>
            <div style="font-family:var(--mono); font-size:34px; font-weight:700; color:var(--navy);">68% <span style="font-size:14px; color:var(--ink-mute); font-family:var(--sans);">last 90d</span></div>
            <div style="font-size:13px; color:var(--ink-soft); margin-top:6px;">Quotes that became real orders within 14 days.</div>
          </div>
        </div>
      </div>
    `;
  };

  /* =========================================================
     EMAIL LOG
     ========================================================= */
  AA.emaillog = async function (host) {
    const { items } = await fetch('/b2b/api/admin/email-log').then(r => r.json());
    host.innerHTML = `
      <div class="admin-page">
        <header class="admin-page-head">
          <div>
            <h1 class="admin-h1">Email log</h1>
            <p class="admin-sub">Outbound transactional emails (mock - no real sends)</p>
          </div>
        </header>
        <div class="admin-card" style="padding:0;">
          <table class="product-table">
            <thead><tr><th>Type</th><th>To</th><th>Subject</th><th>Preview</th><th>Sent</th></tr></thead>
            <tbody>
              ${items.map(e => `
                <tr>
                  <td><span class="badge ${emailBadge(e.kind)}">${e.kind.replace(/_/g, ' ')}</span></td>
                  <td style="font-family:var(--mono); font-size:12.5px;">${esc(e.to)}</td>
                  <td><strong>${esc(e.subject)}</strong></td>
                  <td style="color:var(--ink-soft); font-size:12.5px; max-width:340px;">${esc(e.preview)}</td>
                  <td style="white-space:nowrap; font-size:12px; color:var(--ink-mute); font-family:var(--mono);">${timeAgo(e.sent_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  function emailBadge(k) {
    if (k === 'order')    return 'badge-navy';
    if (k === 'quote')    return 'badge-amber';
    if (k === 'invoice')  return 'badge-red';
    if (k === 'approval') return 'badge-amber';
    if (k === 'shipment') return 'badge-teal';
    if (k === 'restock')  return 'badge-green';
    return 'badge';
  }

  function timeAgo(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return Math.round(diff) + 's ago';
    if (diff < 3600) return Math.round(diff / 60) + 'm ago';
    if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
    return Math.round(diff / 86400) + 'd ago';
  }

  /* =========================================================
     SETTINGS
     ========================================================= */
  AA.settings = async function (host) {
    const s = await fetch('/b2b/api/admin/settings').then(r => r.json());
    host.innerHTML = `
      <div class="admin-page">
        <header class="admin-page-head">
          <div>
            <h1 class="admin-h1">Settings</h1>
            <p class="admin-sub">Portal config, thresholds, integrations</p>
          </div>
        </header>

        <div class="admin-grid-2">
          <div class="admin-card">
            <h3>Portal info</h3>
            <div class="checkout-form-grid" style="margin-top:14px;">
              <div class="field full"><label>Portal name</label><input value="${esc(s.store_name)}"></div>
              <div class="field"><label>Free freight threshold</label><input value="$${s.free_freight_threshold}"></div>
              <div class="field"><label>Tax rate</label><input value="${(s.tax_rate * 100).toFixed(2)}%"></div>
              <div class="field"><label>Approval threshold</label><input value="$${s.approval_threshold}"></div>
              <div class="field"><label>Tier price breaks</label><input value="10 / 50 / 100"></div>
            </div>
          </div>

          <div class="admin-card">
            <h3>Integrations</h3>
            <div class="admin-list" style="margin-top:10px;">
              ${[
                ['SAP B1',        s.integrations.sap,        'Inventory + order sync'],
                ['Sage 50',       s.integrations.sage,       'Accounting export'],
                ['QuickBooks',    s.integrations.quickbooks, 'Invoice push'],
                ['Freightos',     s.integrations.freightos,  'Freight rate lookup'],
                ['HubSpot CRM',   false,                     'Quote pipeline sync'],
                ['Slack',         true,                      'Approval notifications'],
              ].map(([name, on, blurb]) => `
                <div class="admin-list-row">
                  <div>
                    <div style="font-weight:600;">${name}</div>
                    <div style="color:var(--ink-soft); font-size:12px;">${blurb}</div>
                  </div>
                  <label class="toggle"><input type="checkbox" ${on ? 'checked' : ''}><span class="toggle-slider"></span></label>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="admin-card">
            <h3>Workflow rules</h3>
            <div class="admin-list" style="margin-top:10px;">
              <div class="admin-list-row"><div>Auto-approve orders under $1,000</div><label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label></div>
              <div class="admin-list-row"><div>Require PO number at checkout</div><label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label></div>
              <div class="admin-list-row"><div>Block orders if credit limit exceeded</div><label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label></div>
              <div class="admin-list-row"><div>Auto-quote on standard SKUs</div><label class="toggle"><input type="checkbox"><span class="toggle-slider"></span></label></div>
              <div class="admin-list-row"><div>Email daily AR summary</div><label class="toggle"><input type="checkbox" checked><span class="toggle-slider"></span></label></div>
            </div>
          </div>

          <div class="admin-card">
            <h3>Shipping zones</h3>
            <div class="admin-list" style="margin-top:10px;">
              <div class="admin-list-row"><div>UAE</div><span style="font-family:var(--mono); font-size:12.5px;">Free over $500 / $35 flat</span></div>
              <div class="admin-list-row"><div>GCC ex. UAE</div><span style="font-family:var(--mono); font-size:12.5px;">$95 LCL / quoted FCL</span></div>
              <div class="admin-list-row"><div>MENA</div><span style="font-family:var(--mono); font-size:12.5px;">Quoted by destination</span></div>
              <div class="admin-list-row"><div>Local pickup (Jebel Ali)</div><span style="font-family:var(--mono); font-size:12.5px;">Free</span></div>
            </div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:18px;">
          <button class="btn btn-ghost btn-sm" data-demo="Settings reset to defaults (demo)">Reset</button>
          <button class="btn btn-orange btn-sm" data-demo="Settings saved (demo)">Save changes</button>
        </div>
      </div>
    `;
  };
})();
