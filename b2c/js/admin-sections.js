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
            <button class="btn btn-ghost btn-sm" data-demo="CSV export coming soon (demo)">Export CSV (demo)</button>
            <button class="btn btn-primary btn-sm" data-demo="Manual order creation coming soon (demo)">Create order</button>
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
    const o = await fetch('/b2c/api/orders/' + encodeURIComponent(id)).then(r => r.ok ? r.json() : null);
    if (!o) { window.toast('Order not found', 'error'); return; }
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
          <p data-status-line><span class="badge ${statusBadge(o.status)}">${o.status}</span></p>

          <div style="margin-top:18px; display:flex; flex-direction:column; gap:8px;">
            <button class="btn btn-primary btn-sm" data-action="ship" ${o.status === 'shipped' || o.status === 'delivered' || o.status === 'refunded' ? 'disabled' : ''}>${o.status === 'shipped' ? '✓ Already shipped' : 'Mark as shipped'}</button>
            <button class="btn btn-ghost btn-sm" data-action="slip">Print packing slip</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--red); border-color:#f4c4b8;" data-action="refund" ${o.status === 'refunded' ? 'disabled' : ''}>${o.status === 'refunded' ? '✓ Refunded' : 'Refund (demo)'}</button>
          </div>
        </div>
      </div>
    `);
    wireOrderModalActions(o);
  }

  async function setOrderStatus(orderId, newStatus) {
    const r = await fetch('/b2c/api/admin/orders/' + encodeURIComponent(orderId), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    return r.ok ? r.json() : null;
  }

  function refreshRowBadge(orderId, newStatus) {
    const row = document.querySelector(`#orders-body [data-order="${orderId}"]`);
    if (!row) return;
    const badge = row.querySelector('.badge');
    if (!badge) return;
    badge.className = `badge ${statusBadge(newStatus)}`;
    badge.textContent = newStatus;
  }

  function wireOrderModalActions(order) {
    const modal = document.querySelector('.modal-backdrop');
    if (!modal) return;

    const shipBtn = modal.querySelector('[data-action="ship"]');
    const slipBtn = modal.querySelector('[data-action="slip"]');
    const refundBtn = modal.querySelector('[data-action="refund"]');
    const statusLine = modal.querySelector('[data-status-line]');

    function paintStatus(newStatus) {
      if (statusLine) statusLine.innerHTML = `<span class="badge ${statusBadge(newStatus)}">${newStatus}</span>`;
      refreshRowBadge(order.number || order.id, newStatus);
    }

    if (shipBtn) shipBtn.addEventListener('click', async () => {
      shipBtn.disabled = true;
      shipBtn.textContent = 'Marking…';
      const res = await setOrderStatus(order.number || order.id, 'shipped');
      if (!res || !res.success) { shipBtn.disabled = false; shipBtn.textContent = 'Mark as shipped'; window.toast('Could not update status', 'error'); return; }
      paintStatus('shipped');
      shipBtn.textContent = '✓ Marked as shipped';
      if (refundBtn) refundBtn.disabled = false;
      window.toast(`Order ${order.number || order.id} marked as shipped`, 'success');
    });

    if (slipBtn) slipBtn.addEventListener('click', () => printPackingSlip(order));

    if (refundBtn) refundBtn.addEventListener('click', async () => {
      if (!confirm(`Refund ${order.number || order.id}? (Demo — no real money moves.)`)) return;
      refundBtn.disabled = true;
      refundBtn.textContent = 'Refunding…';
      const res = await setOrderStatus(order.number || order.id, 'refunded');
      if (!res || !res.success) { refundBtn.disabled = false; refundBtn.textContent = 'Refund (demo)'; window.toast('Could not refund', 'error'); return; }
      paintStatus('refunded');
      refundBtn.textContent = '✓ Refunded';
      if (shipBtn) shipBtn.disabled = true;
      window.toast(`Order ${order.number || order.id} refunded (demo)`, 'success');
    });
  }

  function printPackingSlip(o) {
    const lines = (o.lines || []).map(l => `
      <tr>
        <td>${esc(l.product_name || l.product?.name || '-')}${l.variant_name ? ' <span style="color:#888; font-size:12px;">(' + esc(l.variant_name) + ')</span>' : ''}</td>
        <td style="font-family:'JetBrains Mono',monospace; font-size:12px; color:#666;">${esc(l.product?.sku || l.product_id || '')}</td>
        <td style="text-align:center; font-family:'JetBrains Mono',monospace;">${l.qty}</td>
        <td style="text-align:right; font-family:'JetBrains Mono',monospace;">$${Number(l.line_total).toFixed(2)}</td>
      </tr>
    `).join('');
    const ship = o.shipping || {};
    const shipName = [ship.first_name, ship.last_name].filter(Boolean).join(' ') || o.customer_name || '';
    const shippingCost = (o.shipping_cost ?? (typeof o.shipping === 'number' ? o.shipping : 0)) || 0;
    const html = `<!DOCTYPE html><html><head>
      <title>Packing Slip ${esc(o.number || o.id)}</title>
      <meta charset="UTF-8" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; max-width: 820px; margin: 0 auto; color: #1a1815; background: #fdfaf6; }
        .toolbar { position: sticky; top: 0; background: #fdfaf6; padding: 8px 0 16px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e8e0d6; }
        .toolbar button { background: #f15a3a; color: #fff; border: 0; padding: 10px 18px; border-radius: 999px; font-weight: 600; font-size: 13px; cursor: pointer; font-family: inherit; }
        .toolbar .meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #888; letter-spacing: 0.6px; text-transform: uppercase; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #f15a3a; padding-bottom: 22px; margin-bottom: 28px; }
        .brand { font-family: 'Fraunces', Georgia, serif; font-size: 30px; color: #f15a3a; font-weight: 600; letter-spacing: -0.01em; }
        .brand-sub { color: #888; font-size: 13px; margin-top: 4px; font-style: italic; }
        .doc-title { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; }
        .doc-meta { color: #888; font-size: 13px; margin-top: 4px; font-family: 'JetBrains Mono', monospace; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 28px; }
        .meta-block h4 { font-size: 10.5px; text-transform: uppercase; letter-spacing: 1.2px; color: #888; margin: 0 0 8px; font-weight: 700; }
        .meta-block p { margin: 2px 0; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
        th { background: #f5ede2; padding: 11px 14px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.7px; color: #555; font-weight: 700; }
        td { padding: 13px 14px; border-bottom: 1px solid #ece4d6; font-size: 14px; }
        .totals { background: #f5ede2; padding: 16px 22px; border-radius: 10px; max-width: 320px; margin-left: auto; }
        .totals .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13.5px; }
        .totals .grand { border-top: 1px solid #d6cbb8; margin-top: 8px; padding-top: 10px; font-size: 17px; font-weight: 700; }
        .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #ece4d6; font-size: 12px; color: #888; text-align: center; line-height: 1.6; }
        .stamp { display: inline-block; padding: 6px 14px; background: rgba(241,90,58,0.08); color: #f15a3a; font-size: 11px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; border-radius: 999px; border: 1px dashed rgba(241,90,58,0.5); margin-top: 14px; }
        @media print {
          .toolbar { display: none; }
          @page { margin: 1.2cm; }
          body { padding: 0; background: #fff; }
        }
      </style>
    </head><body>
      <div class="toolbar">
        <span class="meta">Pebble &amp; Co. — Packing Slip</span>
        <button onclick="window.print()">Print / Save as PDF</button>
      </div>
      <div class="header">
        <div>
          <div class="brand">Pebble &amp; Co.</div>
          <div class="brand-sub">Small things, beautifully made.</div>
        </div>
        <div style="text-align:right;">
          <div class="doc-title">PACKING SLIP</div>
          <div class="doc-meta">${esc(o.number || o.id)}</div>
        </div>
      </div>
      <div class="meta-grid">
        <div class="meta-block">
          <h4>Ship To</h4>
          <p><strong>${esc(shipName)}</strong></p>
          <p>${esc(ship.address1 || ship.line1 || '')}${ship.address2 ? ', ' + esc(ship.address2) : ''}</p>
          <p>${esc(ship.city || '')}${ship.state ? ', ' + esc(ship.state) : ''} ${esc(ship.postal || ship.zip || '')}</p>
          <p>${esc(ship.country || '')}</p>
          <p style="color:#888; font-size:12.5px; margin-top:6px;">${esc(ship.email || o.customer_email || '')}</p>
        </div>
        <div class="meta-block">
          <h4>Order Details</h4>
          <p><strong>Order:</strong> ${esc(o.number || o.id)}</p>
          <p><strong>Placed:</strong> ${new Date(o.placed_at).toLocaleDateString(undefined, {year:'numeric', month:'long', day:'numeric'})}</p>
          <p><strong>Status:</strong> ${esc(o.status)}</p>
          <p><strong>Payment:</strong> ${esc(o.payment_method || 'Card')}</p>
        </div>
      </div>
      <table>
        <thead><tr><th>Item</th><th>SKU</th><th style="text-align:center;">Qty</th><th style="text-align:right;">Line Total</th></tr></thead>
        <tbody>${lines}</tbody>
      </table>
      <div class="totals">
        <div class="row"><span>Subtotal</span><span>$${Number(o.subtotal || 0).toFixed(2)}</span></div>
        ${o.discount > 0 ? `<div class="row" style="color:#3a8a4a;"><span>Discount</span><span>- $${Number(o.discount).toFixed(2)}</span></div>` : ''}
        <div class="row"><span>Shipping</span><span>${shippingCost === 0 ? 'Free' : '$' + Number(shippingCost).toFixed(2)}</span></div>
        <div class="row"><span>Tax</span><span>$${Number(o.tax || 0).toFixed(2)}</span></div>
        <div class="row grand"><span>Total</span><span>$${Number(o.total || 0).toFixed(2)}</span></div>
      </div>
      <div class="footer">
        Thank you for ordering from Pebble &amp; Co. — questions? hello@pebbleandco.demo<br>
        <span class="stamp">Demo · fabricated data · no real shipment</span>
      </div>
    </body></html>`;
    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) { window.toast('Popup blocked — allow popups to print', 'error'); return; }
    w.document.write(html);
    w.document.close();
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
            <button class="btn btn-ghost btn-sm" data-demo="CSV import coming soon (demo)">Import CSV</button>
            <button class="btn btn-primary btn-sm" data-demo="Product creation coming soon (demo)">+ New product</button>
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
            <button class="btn btn-ghost btn-sm" data-demo="Customer export coming soon (demo)">Export</button>
            <button class="btn btn-primary btn-sm" data-demo="Customer creation coming soon (demo)">+ Add customer</button>
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
                <tr data-cust="${c.id}" style="cursor:pointer;">
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
    host.querySelectorAll('[data-cust]').forEach(row => {
      row.addEventListener('click', () => {
        const c = items.find(x => x.id === row.dataset.cust);
        if (!c) return;
        showAdminModal(c.name, `
          <div style="display:flex; flex-wrap:wrap; gap:14px; margin-bottom:14px; font-size:13.5px;">
            <span><strong>Email:</strong> <code>${esc(c.email)}</code></span>
            <span><strong>Segment:</strong> <span class="badge ${c.segment === 'vip' ? 'badge-coral' : c.segment === 'returning' ? 'badge-sage' : 'badge-amber'}">${c.segment}</span></span>
            <span><strong>Joined:</strong> ${new Date(c.joined).toLocaleDateString()}</span>
          </div>
          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-bottom:14px;">
            <div style="background:var(--surface-2); border-radius:var(--r-sm); padding:12px;">
              <div style="font-size:11px; text-transform:uppercase; color:var(--ink-mute); letter-spacing:0.6px;">Orders</div>
              <div style="font-family:var(--mono); font-size:22px; font-weight:700;">${c.orders_count}</div>
            </div>
            <div style="background:var(--surface-2); border-radius:var(--r-sm); padding:12px;">
              <div style="font-size:11px; text-transform:uppercase; color:var(--ink-mute); letter-spacing:0.6px;">Lifetime value</div>
              <div style="font-family:var(--mono); font-size:22px; font-weight:700;">${fm(c.lifetime_value)}</div>
            </div>
            <div style="background:var(--surface-2); border-radius:var(--r-sm); padding:12px;">
              <div style="font-size:11px; text-transform:uppercase; color:var(--ink-mute); letter-spacing:0.6px;">Points</div>
              <div style="font-family:var(--mono); font-size:22px; font-weight:700;">${c.points}</div>
            </div>
          </div>
          ${c.addresses && c.addresses.length ? `
            <h4 style="font-size:11px; text-transform:uppercase; letter-spacing:0.6px; color:var(--ink-mute); margin:14px 0 8px;">Addresses</h4>
            <ul style="padding-left:18px; font-size:13.5px; line-height:1.7;">
              ${c.addresses.map(a => `<li><strong>${esc(a.label || 'Address')}:</strong> ${esc(a.line1)}, ${esc(a.city)}, ${esc(a.country)}</li>`).join('')}
            </ul>
          ` : ''}
          <div style="margin-top:18px; display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" data-demo="Email composer coming soon (demo)">Email customer</button>
            <button class="btn btn-ghost btn-sm" data-demo="Customer edit coming soon (demo)">Edit profile</button>
          </div>
        `);
      });
    });
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
            <button class="btn btn-primary btn-sm" data-demo="Promo creation coming soon (demo)">+ New promo code</button>
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
            <button class="btn btn-ghost btn-sm" data-demo="Banner scheduling coming soon (demo)">+ Add banner</button>
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
            <button class="btn btn-ghost btn-sm" data-demo="Last email resent (demo)">Resend last</button>
            <button class="btn btn-primary btn-sm" data-demo="Email composer coming soon (demo)">Compose</button>
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

        <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:18px;">
          <button class="btn btn-ghost btn-sm" data-demo="Settings reset to defaults (demo)">Reset</button>
          <button class="btn btn-primary btn-sm" data-demo="Settings saved (demo)">Save changes</button>
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
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => { m.remove(); document.removeEventListener('keydown', onKey); };
    document.addEventListener('keydown', onKey);
    m.addEventListener('click', (e) => { if (e.target === m) close(); });
    m.querySelector('.modal-close').addEventListener('click', close);
  }
})();
