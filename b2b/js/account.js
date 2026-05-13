/* =========================================================
   Anvil Supply Co. - account dashboard
   ========================================================= */
(function () {
  'use strict';

  const TABS = [
    { id: 'orders',    label: 'Orders',     icon: '📦' },
    { id: 'quotes',    label: 'Quotes',     icon: '💬' },
    { id: 'invoices',  label: 'Invoices',   icon: '🧾' },
    { id: 'recurring', label: 'Recurring',  icon: '🔁' },
    { id: 'addresses', label: 'Ship-to',    icon: '📍' },
    { id: 'users',     label: 'Users',      icon: '👥' },
    { id: 'profile',   label: 'Company',    icon: '🏢' },
  ];

  let me = null;
  const fm = (n) => window.formatMoney(n);

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    me = await fetch('/b2b/api/me').then(r => r.json());
    document.getElementById('acct-greeting').textContent =
      `${me.company.name} &middot; ${me.user.name} (${me.user.role})`;
    document.getElementById('acct-greeting').innerHTML =
      `<strong>${me.company.name}</strong> &middot; ${me.user.name} <span class="badge badge-navy" style="margin-left:6px;">${me.user.role.toUpperCase()}</span>`;
    renderTabs();
    window.addEventListener('hashchange', () => render(currentTab()));
    render(currentTab());
  }

  function currentTab() {
    const h = (window.location.hash || '#orders').replace('#', '');
    return TABS.find(t => t.id === h) ? h : 'orders';
  }

  function renderTabs() {
    const active = currentTab();
    document.getElementById('acct-tabs').innerHTML = TABS.map(t => `
      <a href="#${t.id}" class="acct-tab ${active === t.id ? 'active' : ''}">
        <span class="acct-tab-icon">${t.icon}</span> ${t.label}
      </a>
    `).join('');
  }

  function render(tab) {
    renderTabs();
    const host = document.getElementById('acct-main');
    host.innerHTML = '<div style="padding:40px; text-align:center; color:var(--ink-soft);">Loading...</div>';
    if (tab === 'orders')    return renderOrders(host);
    if (tab === 'quotes')    return renderQuotes(host);
    if (tab === 'invoices')  return renderInvoices(host);
    if (tab === 'recurring') return renderRecurring(host);
    if (tab === 'addresses') return renderAddresses(host);
    if (tab === 'users')     return renderUsers(host);
    if (tab === 'profile')   return renderProfile(host);
  }

  async function renderOrders(host) {
    const { items } = await fetch('/b2b/api/orders').then(r => r.json());
    if (!items.length) {
      host.innerHTML = panel('Orders', `<p style="padding:30px 0; color:var(--ink-soft); text-align:center;">No orders yet. <a href="catalog.html" class="btn-link">Browse the catalog &rarr;</a></p>`);
      return;
    }
    host.innerHTML = panel('Orders', `
      <table class="product-table">
        <thead><tr><th>Order</th><th>PO</th><th>Date</th><th>Status</th><th>Lines</th><th style="text-align:right;">Total</th><th></th></tr></thead>
        <tbody>
          ${items.map(o => `
            <tr data-order="${o.id}">
              <td class="sku-cell">${o.id}</td>
              <td style="font-family:var(--mono); font-size:12.5px;">${o.po_number || '-'}</td>
              <td>${new Date(o.placed_at).toLocaleDateString()}</td>
              <td><span class="badge ${statusBadge(o.status)}">${o.status.replace(/_/g, ' ')}</span></td>
              <td style="font-family:var(--mono);">${o.lines.length}</td>
              <td style="font-family:var(--mono); text-align:right; font-weight:600;">${fm(o.total)}</td>
              <td><button class="btn-link" data-view>View</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `);
    host.querySelectorAll('[data-order]').forEach(row => {
      row.querySelector('[data-view]').addEventListener('click', () => openOrderModal(row.dataset.order));
    });
  }

  function statusBadge(s) {
    if (s === 'delivered' || s === 'fulfilled' || s === 'approved') return 'badge-green';
    if (s === 'shipped') return 'badge-teal';
    if (s === 'awaiting_approval' || s === 'submitted') return 'badge-amber';
    if (s === 'cancelled') return 'badge-red';
    return 'badge-navy';
  }

  async function openOrderModal(id) {
    const o = await fetch('/b2b/api/orders/' + encodeURIComponent(id)).then(r => r.json());
    if (!o) return;
    window.showModal(`Order ${o.id}`, `
      <div style="display:flex; flex-wrap:wrap; gap:14px; margin-bottom:12px; font-size:13px; color:var(--ink-soft);">
        <span><strong>PO:</strong> <code>${o.po_number || '-'}</code></span>
        <span><strong>Status:</strong> <span class="badge ${statusBadge(o.status)}">${o.status}</span></span>
        <span><strong>Terms:</strong> ${o.payment_terms}</span>
        <span><strong>Placed:</strong> ${new Date(o.placed_at).toLocaleString()}</span>
      </div>
      <table class="product-table">
        <thead><tr><th>SKU</th><th>Name</th><th>Qty</th><th style="text-align:right;">Unit</th><th style="text-align:right;">Line</th></tr></thead>
        <tbody>
          ${o.lines.map(l => `
            <tr>
              <td class="sku-cell">${l.sku || l.product?.sku || '-'}</td>
              <td>${l.name || l.product?.name || '-'}</td>
              <td style="font-family:var(--mono);">${l.qty}</td>
              <td style="font-family:var(--mono); text-align:right;">${fm(l.unit_price)}</td>
              <td style="font-family:var(--mono); text-align:right; font-weight:600;">${fm(l.line_total)}</td>
            </tr>
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
        <button class="btn btn-primary btn-sm">Download PDF (demo)</button>
        <button class="btn btn-ghost btn-sm">Reorder these items</button>
      </div>
    `, { large: true });
  }

  async function renderQuotes(host) {
    const { items } = await fetch('/b2b/api/quotes').then(r => r.json());
    if (!items.length) {
      host.innerHTML = panel('Quotes', `<p style="padding:30px 0; color:var(--ink-soft); text-align:center;">No quote requests yet. <a href="quote-request.html" class="btn-link">Request a quote &rarr;</a></p>`);
      return;
    }
    host.innerHTML = panel('Quotes', `
      <table class="product-table">
        <thead><tr><th>Quote</th><th>Requested</th><th>Items</th><th>Notes</th><th>Status</th></tr></thead>
        <tbody>
          ${items.map(q => `
            <tr>
              <td class="sku-cell">${q.id}</td>
              <td>${new Date(q.requested_at).toLocaleDateString()}</td>
              <td style="font-family:var(--mono);">${q.items_count}</td>
              <td style="color:var(--ink-soft); font-size:12.5px;">${(q.notes || '').slice(0, 80)}${(q.notes || '').length > 80 ? '...' : ''}</td>
              <td><span class="badge ${q.status === 'quoted' || q.status === 'accepted' ? 'badge-green' : q.status === 'pending' ? 'badge-amber' : 'badge-red'}">${q.status}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `);
  }

  async function renderInvoices(host) {
    const { items } = await fetch('/b2b/api/invoices').then(r => r.json());
    const open = items.filter(i => i.status === 'open').reduce((s, i) => s + i.amount, 0);
    const overdue = items.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
    host.innerHTML = panel('Statements', `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:12px; margin-bottom:18px;">
        <div style="background:var(--surface-2); border-radius:var(--r); padding:14px;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.6px; color:var(--ink-mute);">Open balance</div>
          <div style="font-family:var(--mono); font-size:22px; font-weight:700; margin-top:4px;">${fm(open)}</div>
        </div>
        <div style="background:#f4cfc8; border-radius:var(--r); padding:14px;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.6px; color:var(--red);">Overdue</div>
          <div style="font-family:var(--mono); font-size:22px; font-weight:700; margin-top:4px; color:var(--red);">${fm(overdue)}</div>
        </div>
        <div style="background:#d8ecdd; border-radius:var(--r); padding:14px;">
          <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.6px; color:var(--green);">Credit limit</div>
          <div style="font-family:var(--mono); font-size:22px; font-weight:700; margin-top:4px; color:var(--green);">${fm(me.company.credit_limit)}</div>
        </div>
      </div>
      <table class="product-table">
        <thead><tr><th>Invoice</th><th>Due</th><th>Status</th><th style="text-align:right;">Amount</th><th></th></tr></thead>
        <tbody>
          ${items.map(i => `
            <tr>
              <td class="sku-cell">${i.id}</td>
              <td>${new Date(i.due_at).toLocaleDateString()}</td>
              <td><span class="badge ${i.status === 'paid' ? 'badge-green' : i.status === 'overdue' ? 'badge-red' : 'badge-amber'}">${i.status}</span></td>
              <td style="font-family:var(--mono); text-align:right; font-weight:600;">${fm(i.amount)}</td>
              <td><button class="btn-link">PDF</button></td>
            </tr>
          `).join('') || '<tr><td colspan="5" style="padding:30px; text-align:center; color:var(--ink-soft);">No invoices on file.</td></tr>'}
        </tbody>
      </table>
    `);
  }

  async function renderRecurring(host) {
    const { items } = await fetch('/b2b/api/recurring').then(r => r.json());
    host.innerHTML = panel('Recurring orders', `
      <p style="font-size:13px; color:var(--ink-soft); margin-bottom:14px;">Standing orders that auto-create on the schedule. Pause or edit anytime.</p>
      <div style="display:flex; flex-direction:column; gap:10px;">
        ${items.map(r => `
          <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:var(--r); padding:14px 16px; display:grid; grid-template-columns:1fr auto auto auto; gap:14px; align-items:center;">
            <div>
              <div style="font-weight:600;">${r.name}</div>
              <div style="font-size:12.5px; color:var(--ink-soft); font-family:var(--mono);">${r.line_count} lines &middot; ${r.frequency} &middot; next: ${new Date(r.next_run).toLocaleDateString()}</div>
            </div>
            <div style="font-family:var(--mono); font-weight:700;">${fm(r.total)}</div>
            <span class="badge ${r.active ? 'badge-green' : 'badge-amber'}">${r.active ? 'active' : 'paused'}</span>
            <button class="btn-link">Edit</button>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-orange btn-sm" style="margin-top:14px;">+ New recurring order</button>
    `);
  }

  function renderAddresses(host) {
    host.innerHTML = panel('Ship-to addresses', `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px,1fr)); gap:14px;">
        ${me.company.ship_to.map(s => `
          <div style="background:var(--surface-2); border:1px solid var(--line); border-radius:var(--r); padding:14px 16px; position:relative;">
            ${s.default ? '<span class="badge badge-navy" style="position:absolute; top:10px; right:12px;">DEFAULT</span>' : ''}
            <h4 style="font-size:14.5px; margin-bottom:6px;">${s.label}</h4>
            <p style="font-size:13.5px; color:var(--ink-2); margin:1px 0;">${s.line1}</p>
            <p style="font-size:13.5px; color:var(--ink-2); margin:1px 0;">${s.city}, ${s.country}</p>
            <div style="margin-top:10px; display:flex; gap:10px;">
              <button class="btn-link">Edit</button>
              <button class="btn-link danger">Remove</button>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-orange btn-sm" style="margin-top:16px;">+ Add ship-to</button>
    `);
  }

  function renderUsers(host) {
    host.innerHTML = panel('Users &amp; roles', `
      <p style="font-size:13px; color:var(--ink-soft); margin-bottom:14px;">Add purchasers, approvers, and viewers. Each role has different permissions.</p>
      <table class="product-table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th></th></tr></thead>
        <tbody>
          ${me.company.users.map(u => `
            <tr>
              <td><strong>${u.name}</strong></td>
              <td style="font-family:var(--mono); font-size:12.5px;">${u.email}</td>
              <td>
                <span class="badge ${u.role === 'approver' ? 'badge-green' : u.role === 'viewer' ? 'badge-amber' : 'badge-navy'}">${u.role}</span>
              </td>
              <td style="text-align:right;"><button class="btn-link">Edit</button> <button class="btn-link danger">Remove</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div style="margin-top:14px; display:flex; gap:8px;">
        <button class="btn btn-orange btn-sm">+ Invite user</button>
      </div>

      <h3 style="margin-top:24px; font-size:15px;">Role permissions</h3>
      <table class="product-table">
        <thead><tr><th>Action</th><th>Purchaser</th><th>Approver</th><th>Viewer</th></tr></thead>
        <tbody>
          ${[
            ['Browse catalog & cart', '✓','✓','✓'],
            ['Submit orders', '✓','✓',''],
            ['Approve orders over threshold', '','✓',''],
            ['Request quotes', '✓','✓',''],
            ['View invoices & statements', '✓','✓','✓'],
            ['Manage users', '','','-'],
          ].map(r => `<tr><td>${r[0]}</td><td style="text-align:center;">${r[1]||'-'}</td><td style="text-align:center;">${r[2]||'-'}</td><td style="text-align:center;">${r[3]||'-'}</td></tr>`).join('')}
        </tbody>
      </table>
    `);
  }

  function renderProfile(host) {
    host.innerHTML = panel('Company info', `
      <div class="checkout-form-grid">
        <div class="field"><label>Company name</label><input value="${me.company.name}"></div>
        <div class="field"><label>Account ID</label><input value="${me.company.id}" disabled></div>
        <div class="field"><label>Tier</label><input value="${me.company.tier}"></div>
        <div class="field"><label>Payment terms</label><input value="${me.company.payment_terms}"></div>
        <div class="field"><label>Credit limit</label><input value="$${me.company.credit_limit.toLocaleString()}"></div>
        <div class="field"><label>Open balance</label><input value="$${me.company.open_balance.toLocaleString()}" disabled></div>
        <div class="field full"><label>Contract discount</label><input value="${(me.company.contract_discount * 100).toFixed(1)}% on all SKUs" disabled></div>
      </div>
      <div style="margin-top:18px;">
        <button class="btn btn-primary btn-sm">Save changes</button>
        <button class="btn btn-ghost btn-sm">Request tier upgrade</button>
      </div>
    `);
  }

  function panel(title, body) {
    return `<div class="acct-panel"><h2 class="acct-panel-title">${title}</h2>${body}</div>`;
  }
})();
