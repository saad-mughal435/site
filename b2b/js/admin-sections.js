/* =========================================================
   Anvil Supply Co. - admin section renderers
   Exposes window.AnvilAdmin = { dashboard, orders, quotes, approvals, ... }
   ========================================================= */
(function () {
  'use strict';

  const AA = window.AnvilAdmin = {};
  const fm = (n) => window.formatMoney(n);
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* Shared helpers — CSV, form modal, refresh */
  function exportCSV(filename, rows, columns) {
    const cell = (v) => {
      if (v == null) return '';
      const s = String(v);
      return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const headers = columns.map(c => c.label);
    const lines = [headers.join(',')];
    rows.forEach(r => lines.push(columns.map(c => cell(typeof c.get === 'function' ? c.get(r) : r[c.key])).join(',')));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 200);
    window.toast(`Exported ${rows.length} row(s) to ${filename}`, 'success');
  }

  function formModal({ title, fields, submitLabel = 'Save', cancelLabel = 'Cancel', onSubmit, large = true }) {
    const fieldHTML = (f) => {
      const id = 'fld-' + f.name;
      const val = f.value == null ? '' : f.value;
      const req = f.required ? 'required' : '';
      const ph = f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '';
      const hint = f.hint ? `<div class="form-hint">${esc(f.hint)}</div>` : '';
      const lblExtra = f.required ? ' <span style="color:var(--red, #c33);">*</span>' : '';
      if (f.type === 'textarea') {
        return `<div class="form-field"><label for="${id}">${esc(f.label)}${lblExtra}</label>
          <textarea id="${id}" name="${esc(f.name)}" rows="${f.rows || 3}" ${req} ${ph}>${esc(val)}</textarea>${hint}</div>`;
      }
      if (f.type === 'select') {
        return `<div class="form-field"><label for="${id}">${esc(f.label)}${lblExtra}</label>
          <select id="${id}" name="${esc(f.name)}" ${req}>
            ${(f.options || []).map(o => `<option value="${esc(o.value)}" ${String(o.value) === String(val) ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
          </select>${hint}</div>`;
      }
      if (f.type === 'file') {
        return `<div class="form-field"><label for="${id}">${esc(f.label)}${lblExtra}</label>
          <input id="${id}" name="${esc(f.name)}" type="file" ${f.accept ? `accept="${esc(f.accept)}"` : ''} ${req} />${hint}</div>`;
      }
      return `<div class="form-field"><label for="${id}">${esc(f.label)}${lblExtra}</label>
        <input id="${id}" name="${esc(f.name)}" type="${f.type || 'text'}" value="${esc(val)}" ${ph} ${req} ${f.min != null ? `min="${f.min}"` : ''} ${f.max != null ? `max="${f.max}"` : ''} ${f.step ? `step="${f.step}"` : ''} ${f.maxlength ? `maxlength="${f.maxlength}"` : ''} />${hint}</div>`;
    };
    window.showModal(title, `
      <form class="admin-form" id="admin-form-inner" novalidate>
        <div class="form-grid ${large ? 'form-grid-2' : ''}">${fields.map(fieldHTML).join('')}</div>
        <div class="form-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-cancel>${esc(cancelLabel)}</button>
          <button type="submit" class="btn btn-orange btn-sm">${esc(submitLabel)}</button>
        </div>
      </form>
    `, { large: true });
    const modal = document.querySelector('.modal-backdrop');
    const form = modal.querySelector('#admin-form-inner');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {};
      fields.forEach(f => {
        const el = form.querySelector(`[name="${f.name}"]`);
        if (!el) return;
        if (f.type === 'file') data[f.name] = el.files;
        else data[f.name] = el.value;
      });
      for (const f of fields) {
        if (f.required && f.type !== 'file' && !String(data[f.name] || '').trim()) {
          window.toast(`"${f.label}" is required`, 'error');
          form.querySelector(`[name="${f.name}"]`)?.focus();
          return;
        }
      }
      try { await onSubmit(data, modal); }
      catch (err) { console.error(err); window.toast(err.message || 'Save failed', 'error'); }
    });
    modal.querySelector('[data-cancel]').addEventListener('click', () => modal.remove());
  }

  function parseCSV(text) {
    const lines = text.replace(/\r/g, '').split('\n').filter(Boolean);
    if (lines.length < 2) return [];
    const split = (line) => {
      const out = []; let cur = ''; let inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQ) { if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; } else if (ch === '"') inQ = false; else cur += ch; }
        else { if (ch === '"') inQ = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; }
      }
      out.push(cur);
      return out;
    };
    const headers = split(lines[0]).map(h => h.trim());
    return lines.slice(1).map(line => {
      const cells = split(line);
      const row = {};
      headers.forEach((h, i) => row[h] = (cells[i] || '').trim());
      return row;
    });
  }

  function rerenderSection(section) {
    const main = document.getElementById('admin-main');
    if (main && AA[section]) AA[section](main);
  }

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
            <button class="btn btn-ghost btn-sm" data-action="dash-export">Export snapshot</button>
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
              <span style="font-family:var(--mono); font-size:12px; color:var(--ink-soft);">${fm(data.revenue_trend.reduce((s,d) => s + d.revenue, 0))} total · ${(() => {
                const half = Math.floor(data.revenue_trend.length / 2);
                const recent = data.revenue_trend.slice(half).reduce((s, d) => s + d.revenue, 0);
                const earlier = data.revenue_trend.slice(0, half).reduce((s, d) => s + d.revenue, 0) || 1;
                const delta = ((recent - earlier) / earlier) * 100;
                const sign = delta >= 0 ? '+' : '';
                const color = delta >= 0 ? 'var(--green)' : 'var(--red)';
                return `<span style="color:${color}; font-weight:700;">${sign}${delta.toFixed(1)}%</span> vs prev`;
              })()}</span>
            </div>
            <div class="bar-chart">
              ${(() => {
                const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
                const max = Math.max(...data.revenue_trend.map(x => x.revenue));
                const today = new Date();
                const len = data.revenue_trend.length;
                return data.revenue_trend.map((d, idx) => {
                  const daysAgo = len - 1 - idx;
                  const dt = new Date(today.getTime() - daysAgo * 86400000);
                  const isToday = daysAgo === 0;
                  const lbl = isToday ? 'Today' : dayNames[dt.getDay()];
                  const h = Math.max(8, Math.round((d.revenue / max) * 100));
                  return `<div class="bar-wrap" title="${lbl}: ${fm(d.revenue)}">
                    <div class="bar ${isToday ? 'bar-today' : ''}" style="height:${h}%;">
                      <span class="bar-value">${'$' + Math.round(d.revenue).toLocaleString()}</span>
                    </div>
                    <div class="bar-label">${lbl}</div>
                  </div>`;
                }).join('');
              })()}
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

    host.querySelector('[data-action="dash-export"]').addEventListener('click', () => {
      const rows = [
        { metric: 'Revenue (all time)',     value: k.revenue_total },
        { metric: 'Orders today',           value: k.orders_today },
        { metric: 'Open quotes',            value: k.open_quotes },
        { metric: 'Pending approvals',      value: k.pending_approvals },
        { metric: 'Overdue invoices (AED)', value: k.overdue_invoices },
        { metric: 'Avg order value',        value: k.avg_order },
      ];
      exportCSV(`anvil-dashboard-snapshot-${new Date().toISOString().slice(0,10)}.csv`, rows, [
        { label: 'Metric', key: 'metric' }, { label: 'Value', key: 'value' },
      ]);
    });
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
    let lastItems = [];

    async function refresh() {
      const q = new URLSearchParams();
      if (filter !== 'all') q.set('status', filter);
      if (search) q.set('search', search);
      const { items } = await fetch('/b2b/api/admin/orders?' + q).then(r => r.json());
      lastItems = items;
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
            <button class="btn btn-ghost btn-sm" data-action="orders-export">Export CSV</button>
            <button class="btn btn-orange btn-sm" data-action="orders-create">Create order</button>
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

    host.querySelector('[data-action="orders-export"]').addEventListener('click', () => {
      if (!lastItems.length) { window.toast('Nothing to export', 'error'); return; }
      exportCSV(`anvil-orders-${new Date().toISOString().slice(0,10)}.csv`, lastItems, [
        { label: 'Order #', key: 'id' },
        { label: 'Company', key: 'company_name' },
        { label: 'Submitted by', key: 'customer_name' },
        { label: 'PO', key: 'po_number' },
        { label: 'Placed', get: r => new Date(r.placed_at).toISOString() },
        { label: 'Status', key: 'status' },
        { label: 'Lines', get: r => (r.lines || []).length },
        { label: 'Subtotal', key: 'subtotal' },
        { label: 'Discount', key: 'discount' },
        { label: 'Freight', key: 'freight' },
        { label: 'Tax', key: 'tax' },
        { label: 'Total', key: 'total' },
        { label: 'Payment terms', key: 'payment_terms' },
      ]);
    });

    host.querySelector('[data-action="orders-create"]').addEventListener('click', () => openB2BCreateOrder(refresh));

    refresh();
  };

  async function openB2BCreateOrder(onSaved) {
    const [{ items: companies }, { items: products }] = await Promise.all([
      fetch('/b2b/api/admin/customers').then(r => r.json()),
      fetch('/b2b/api/admin/products').then(r => r.json()),
    ]);
    formModal({
      title: 'Create order',
      submitLabel: 'Create order',
      fields: [
        { name: 'company_id', label: 'Customer company', type: 'select', required: true,
          options: companies.map(c => ({ value: c.id, label: `${c.name} · ${c.tier} · ${c.payment_terms}` })) },
        { name: 'product_id', label: 'Product / SKU', type: 'select', required: true,
          options: products.map(p => ({ value: p.id, label: `${p.sku} — ${p.name} · MOQ ${p.moq} · ${fm(p.unit_price)}` })) },
        { name: 'qty', label: 'Quantity', type: 'number', required: true, value: 10, min: 1 },
        { name: 'po_number', label: 'PO number', value: 'PO-' + Math.floor(2026000 + Math.random()*9999) },
        { name: 'notes', label: 'Notes', type: 'textarea', rows: 2 },
      ],
      onSubmit: async (data, modal) => {
        const co = companies.find(c => c.id === data.company_id);
        const prod = products.find(p => p.id === data.product_id);
        let qty = Math.max(prod.moq, Number(data.qty) || prod.moq);
        qty = Math.ceil(qty / prod.pack_multiple) * prod.pack_multiple;
        const tier = prod.tier_pricing.slice().reverse().find(t => qty >= t.min) || prod.tier_pricing[0];
        const unit_price = tier.price;
        const line_total = +(unit_price * qty).toFixed(2);
        const subtotal = line_total;
        const discount = +(subtotal * (co.contract_discount || 0)).toFixed(2);
        const after = subtotal - discount;
        const freight = after >= 500 ? 0 : 35;
        const tax = +(after * 0.05).toFixed(2);
        const total = +(after + freight + tax).toFixed(2);
        const orderNum = 'PO-' + Math.floor(40000 + Math.random() * 9999);
        const placed = new Date();
        const order = {
          id: orderNum, number: orderNum,
          company_id: co.id, company_name: co.name,
          customer_name: co.users[0]?.name || 'Admin', customer_email: co.users[0]?.email || '',
          placed_at: placed.toISOString(),
          eta: new Date(placed.getTime() + 5 * 24 * 3600 * 1000).toISOString(),
          status: total >= 1000 ? 'awaiting_approval' : 'submitted',
          requires_approval: total >= 1000,
          po_number: data.po_number || '',
          payment_terms: co.payment_terms,
          ship_to: co.ship_to[0],
          notes: data.notes || '',
          lines: [{
            product_id: prod.id, sku: prod.sku, name: prod.name, qty,
            unit_price, line_total,
            product: { id: prod.id, name: prod.name, sku: prod.sku, industry: prod.industry },
          }],
          subtotal, discount, freight, tax, total,
        };
        const existing = JSON.parse(localStorage.getItem('anvil.orders.created') || '[]');
        existing.unshift(order);
        localStorage.setItem('anvil.orders.created', JSON.stringify(existing));
        modal.remove();
        window.toast(`Order ${orderNum} created`, 'success');
        if (onSaved) onSaved();
      },
    });
  }

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
    if (!o || o.error) { window.toast('Order not found', 'error'); return; }
    const disabled = (s) => o.status === s ? 'disabled' : '';
    window.showModal(`Order ${o.id}`, `
      <div style="display:flex; flex-wrap:wrap; gap:12px; margin-bottom:14px; font-size:12.5px; color:var(--ink-soft);">
        <span><strong>PO:</strong> <code>${o.po_number || '-'}</code></span>
        <span><strong>Customer:</strong> ${esc(o.company_name)}</span>
        <span data-status-line><strong>Status:</strong> <span class="badge ${statusBadge(o.status)}">${o.status}</span></span>
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
        <button class="btn btn-primary btn-sm" data-action="ship" ${o.status === 'shipped' || o.status === 'delivered' || o.status === 'cancelled' ? 'disabled' : ''}>${o.status === 'shipped' ? '✓ Marked shipped' : 'Mark shipped'}</button>
        <button class="btn btn-ghost btn-sm" data-action="picklist">Pick list</button>
        <button class="btn btn-ghost btn-sm" data-action="invoice">Invoice</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red); border-color:#f4c4b8;" data-action="cancel" ${disabled('cancelled')}>${o.status === 'cancelled' ? '✓ Cancelled' : 'Cancel'}</button>
      </div>
    `, { large: true });
    wireB2BOrderActions(o);
  }

  async function setB2BOrderStatus(orderId, newStatus) {
    const r = await fetch('/b2b/api/admin/orders/' + encodeURIComponent(orderId), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    return r.ok ? r.json() : null;
  }

  function refreshB2BRowBadge(orderId, newStatus) {
    const row = document.querySelector(`#orders-body [data-order="${orderId}"]`);
    if (!row) return;
    const badge = row.querySelector('.badge');
    if (!badge) return;
    badge.className = `badge ${statusBadge(newStatus)}`;
    badge.textContent = newStatus.replace(/_/g, ' ');
  }

  function wireB2BOrderActions(order) {
    const modal = document.querySelector('.modal-backdrop');
    if (!modal) return;
    const shipBtn   = modal.querySelector('[data-action="ship"]');
    const pickBtn   = modal.querySelector('[data-action="picklist"]');
    const invBtn    = modal.querySelector('[data-action="invoice"]');
    const cancelBtn = modal.querySelector('[data-action="cancel"]');
    const statusLine = modal.querySelector('[data-status-line]');

    function paint(newStatus) {
      if (statusLine) statusLine.innerHTML = `<strong>Status:</strong> <span class="badge ${statusBadge(newStatus)}">${newStatus.replace(/_/g, ' ')}</span>`;
      refreshB2BRowBadge(order.id, newStatus);
    }

    if (shipBtn) shipBtn.addEventListener('click', async () => {
      shipBtn.disabled = true; shipBtn.textContent = 'Marking…';
      const res = await setB2BOrderStatus(order.id, 'shipped');
      if (!res?.success) { shipBtn.disabled = false; shipBtn.textContent = 'Mark shipped'; window.toast('Could not update', 'error'); return; }
      paint('shipped'); shipBtn.textContent = '✓ Marked shipped';
      window.toast(`Order ${order.id} marked as shipped`, 'success');
    });

    if (cancelBtn) cancelBtn.addEventListener('click', async () => {
      if (!confirm(`Cancel order ${order.id}? (Demo)`)) return;
      cancelBtn.disabled = true; cancelBtn.textContent = 'Cancelling…';
      const res = await setB2BOrderStatus(order.id, 'cancelled');
      if (!res?.success) { cancelBtn.disabled = false; cancelBtn.textContent = 'Cancel'; window.toast('Could not cancel', 'error'); return; }
      paint('cancelled'); cancelBtn.textContent = '✓ Cancelled';
      if (shipBtn) shipBtn.disabled = true;
      window.toast(`Order ${order.id} cancelled (demo)`, 'error');
    });

    if (pickBtn) pickBtn.addEventListener('click', () => printB2BDoc(order, 'picklist'));
    if (invBtn)  invBtn.addEventListener('click',  () => printB2BDoc(order, 'invoice'));
  }

  function printB2BDoc(o, kind) {
    const isInvoice = kind === 'invoice';
    const docTitle = isInvoice ? 'INVOICE' : 'PICK LIST';
    const lines = (o.lines || []).map((l, i) => `
      <tr>
        <td style="font-family:'JetBrains Mono',monospace; font-size:12.5px; color:#16314f; font-weight:600;">${esc(l.sku || l.product?.sku || '-')}</td>
        <td>${esc(l.name || l.product?.name || '-')}</td>
        <td style="text-align:center; font-family:'JetBrains Mono',monospace;">${l.qty}</td>
        ${isInvoice ? `<td style="text-align:right; font-family:'JetBrains Mono',monospace;">$${Number(l.unit_price).toFixed(2)}</td><td style="text-align:right; font-family:'JetBrains Mono',monospace; font-weight:600;">$${Number(l.line_total).toFixed(2)}</td>` : `<td style="text-align:center; color:#888;">${i + 1} of ${o.lines.length}</td><td style="text-align:right;"><input type="checkbox" style="width:18px; height:18px;" disabled /></td>`}
      </tr>
    `).join('');
    const ship = o.ship_to || {};
    const html = `<!DOCTYPE html><html><head>
      <title>${docTitle} ${esc(o.id)} — Anvil Supply Co.</title>
      <meta charset="UTF-8" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      <style>
        * { box-sizing: border-box; }
        body { font-family: 'Inter', system-ui, sans-serif; padding: 40px; max-width: 820px; margin: 0 auto; color: #0c1f37; background: #f4f6f9; }
        .toolbar { position: sticky; top: 0; background: #f4f6f9; padding: 8px 0 16px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #d6dde6; }
        .toolbar button { background: #d96a2c; color: #fff; border: 0; padding: 10px 18px; border-radius: 6px; font-weight: 600; font-size: 13px; cursor: pointer; font-family: inherit; }
        .toolbar .meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #56657a; letter-spacing: 0.6px; text-transform: uppercase; }
        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #16314f; padding-bottom: 20px; margin-bottom: 26px; background: #fff; padding: 22px 24px; border-radius: 8px; }
        .brand { display: flex; align-items: center; gap: 12px; }
        .brand-mark { background: #d96a2c; color: #fff; width: 44px; height: 44px; border-radius: 6px; display: grid; place-items: center; font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 700; }
        .brand-name { font-size: 18px; font-weight: 700; color: #16314f; letter-spacing: -0.01em; }
        .brand-sub { color: #56657a; font-size: 12px; margin-top: 2px; }
        .doc-title { font-size: 24px; font-weight: 700; color: #16314f; letter-spacing: 0.5px; }
        .doc-meta { color: #56657a; font-size: 12.5px; margin-top: 4px; font-family: 'JetBrains Mono', monospace; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px; }
        .meta-block { background: #fff; padding: 16px 18px; border-radius: 6px; border: 1px solid #e1e6ee; }
        .meta-block h4 { font-size: 10.5px; text-transform: uppercase; letter-spacing: 1px; color: #56657a; margin: 0 0 8px; font-weight: 700; }
        .meta-block p { margin: 2px 0; font-size: 13.5px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 18px; background: #fff; border-radius: 6px; overflow: hidden; border: 1px solid #e1e6ee; }
        th { background: #16314f; padding: 11px 14px; text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 1px; color: #fff; font-weight: 600; }
        td { padding: 12px 14px; border-bottom: 1px solid #eef1f5; font-size: 13.5px; }
        tr:last-child td { border-bottom: 0; }
        .totals { background: #fff; padding: 16px 22px; border-radius: 6px; max-width: 360px; margin-left: auto; border: 1px solid #e1e6ee; }
        .totals .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
        .totals .grand { border-top: 2px solid #16314f; margin-top: 8px; padding-top: 10px; font-size: 17px; font-weight: 700; color: #16314f; }
        .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #d6dde6; font-size: 11.5px; color: #56657a; text-align: center; line-height: 1.7; }
        .stamp { display: inline-block; padding: 5px 12px; background: rgba(217,106,44,0.1); color: #d96a2c; font-size: 10.5px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; border-radius: 4px; border: 1px dashed rgba(217,106,44,0.4); margin-top: 10px; }
        @media print {
          .toolbar { display: none; }
          @page { margin: 1.2cm; }
          body { padding: 0; background: #fff; }
          .header, .meta-block, table, .totals { border: none; box-shadow: none; }
        }
      </style>
    </head><body>
      <div class="toolbar">
        <span class="meta">Anvil Supply Co. — ${docTitle}</span>
        <button onclick="window.print()">Print / Save as PDF</button>
      </div>
      <div class="header">
        <div class="brand">
          <div class="brand-mark">A</div>
          <div>
            <div class="brand-name">Anvil Supply Co.</div>
            <div class="brand-sub">Industrial supplies, no nonsense.</div>
          </div>
        </div>
        <div style="text-align:right;">
          <div class="doc-title">${docTitle}</div>
          <div class="doc-meta">${esc(o.id)}${isInvoice ? ' · ' + new Date(o.placed_at).toLocaleDateString() : ''}</div>
        </div>
      </div>
      <div class="meta-grid">
        <div class="meta-block">
          <h4>${isInvoice ? 'Bill to' : 'Ship to'}</h4>
          <p><strong>${esc(o.company_name)}</strong></p>
          <p>${esc(ship.label || '')}</p>
          <p>${esc(ship.line1 || '')}</p>
          <p>${esc(ship.city || '')}${ship.country ? ', ' + esc(ship.country) : ''}</p>
          ${o.attention ? `<p style="color:#56657a; font-size:12.5px; margin-top:6px;"><strong>Attn:</strong> ${esc(o.attention)}</p>` : ''}
        </div>
        <div class="meta-block">
          <h4>References</h4>
          <p><strong>Order:</strong> ${esc(o.id)}</p>
          <p><strong>PO:</strong> ${esc(o.po_number || '-')}</p>
          <p><strong>Placed:</strong> ${new Date(o.placed_at).toLocaleDateString()}</p>
          ${isInvoice ? `<p><strong>Terms:</strong> ${esc(o.payment_terms || 'Net 30')}</p>` : `<p><strong>Status:</strong> ${esc(o.status)}</p>`}
          ${isInvoice ? `<p><strong>Due:</strong> ${new Date(new Date(o.placed_at).getTime() + 30 * 24 * 3600 * 1000).toLocaleDateString()}</p>` : ''}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>SKU</th><th>Description</th><th style="text-align:center;">Qty</th>
            ${isInvoice ? '<th style="text-align:right;">Unit</th><th style="text-align:right;">Line Total</th>' : '<th style="text-align:center;">Position</th><th style="text-align:right;">Picked</th>'}
          </tr>
        </thead>
        <tbody>${lines}</tbody>
      </table>
      ${isInvoice ? `
      <div class="totals">
        <div class="row"><span>Subtotal</span><span>$${Number(o.subtotal || 0).toFixed(2)}</span></div>
        ${o.discount > 0 ? `<div class="row" style="color:#1e5a30;"><span>Contract discount</span><span>- $${Number(o.discount).toFixed(2)}</span></div>` : ''}
        <div class="row"><span>Freight</span><span>${o.freight === 0 ? 'Free' : '$' + Number(o.freight).toFixed(2)}</span></div>
        <div class="row"><span>Tax</span><span>$${Number(o.tax || 0).toFixed(2)}</span></div>
        <div class="row grand"><span>Total due</span><span>$${Number(o.total || 0).toFixed(2)}</span></div>
      </div>
      ` : `
      <div class="meta-block" style="margin-top:6px;">
        <h4>Pick instructions</h4>
        <p style="font-size:13px; color:#42526e;">Pick from staging bay → verify SKU + lot → quantity check → tick box → consolidate at outbound dock. Flag any discrepancy on the discrepancy log.</p>
        <p style="font-size:12.5px; color:#56657a; margin-top:8px;"><strong>Picker:</strong> _________________________ &nbsp;&nbsp; <strong>Date/time:</strong> _________________________</p>
      </div>
      `}
      <div class="footer">
        Anvil Supply Co. · orders@anvil.demo · +971 4 010 1010<br>
        <span class="stamp">Demo · fabricated data · not a real ${isInvoice ? 'invoice' : 'pick list'}</span>
      </div>
    </body></html>`;
    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) { window.toast('Popup blocked — allow popups to print', 'error'); return; }
    w.document.write(html);
    w.document.close();
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
            <button class="btn btn-ghost btn-sm" data-action="quotes-export">Export CSV</button>
            <button class="btn btn-orange btn-sm" data-action="quotes-create">+ New quote</button>
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

    host.querySelector('[data-action="quotes-export"]').addEventListener('click', () => {
      exportCSV(`anvil-quotes-${new Date().toISOString().slice(0,10)}.csv`, items, [
        { label: 'Quote', key: 'id' }, { label: 'Company', key: 'company_name' }, { label: 'Requester', key: 'requester' },
        { label: 'Requested', get: r => new Date(r.requested_at).toISOString() },
        { label: 'Items', key: 'items_count' }, { label: 'Status', key: 'status' },
        { label: 'Notes', key: 'notes' },
      ]);
    });
    host.querySelector('[data-action="quotes-create"]').addEventListener('click', async () => {
      const { items: companies } = await fetch('/b2b/api/admin/customers').then(r => r.json());
      formModal({
        title: 'New quote request',
        submitLabel: 'Create quote',
        fields: [
          { name: 'company_id', label: 'Company', type: 'select', required: true,
            options: companies.map(c => ({ value: c.id, label: c.name })) },
          { name: 'items_count', label: 'Number of line items', type: 'number', value: 3, min: 1 },
          { name: 'notes', label: 'Notes from requester', type: 'textarea', rows: 3 },
        ],
        onSubmit: async (data, modal) => {
          const co = companies.find(c => c.id === data.company_id);
          const res = await fetch('/b2b/api/admin/quotes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, company_name: co?.name }) }).then(r => r.json());
          if (!res.success) { window.toast('Save failed', 'error'); return; }
          modal.remove();
          window.toast(`Quote ${res.quote.id} created`, 'success');
          rerenderSection('quotes');
        },
      });
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
        <button class="btn btn-primary btn-sm" data-action="quote-send">Send quote</button>
        <button class="btn btn-ghost btn-sm" data-action="quote-draft">Save draft</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red); border-color:#f4c4b8;" data-action="quote-decline">Decline</button>
      </div>
    `, { large: true });
    const modal = document.querySelector('.modal-backdrop');
    const setStatus = async (next) => {
      const r = await fetch('/b2b/api/admin/quotes/' + encodeURIComponent(q.id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }) }).then(x => x.json());
      if (!r?.success) { window.toast('Could not update', 'error'); return; }
      // Add an email log entry to make it visible
      await fetch('/b2b/api/admin/email-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to: `${q.company_id}@demo.local`, subject: `Quote ${q.id} — ${next}`, kind: 'quote', body: `Status changed to ${next} for ${q.company_name}.` }) });
      modal.remove();
      window.toast(`Quote ${q.id} → ${next}`, 'success');
      rerenderSection('quotes');
    };
    modal.querySelector('[data-action="quote-send"]').addEventListener('click', () => setStatus('quoted'));
    modal.querySelector('[data-action="quote-draft"]').addEventListener('click', () => setStatus('draft'));
    modal.querySelector('[data-action="quote-decline"]').addEventListener('click', () => {
      if (confirm(`Decline quote ${q.id}?`)) setStatus('declined');
    });
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
    host.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.approve;
      const res = await fetch('/b2b/api/admin/orders/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'approved' }) }).then(r => r.json());
      if (!res?.success) { window.toast('Could not approve', 'error'); return; }
      window.toast(`Order ${id} approved`, 'success');
      rerenderSection('approvals');
    }));
    host.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.reject;
      if (!confirm(`Reject order ${id}? (Demo)`)) return;
      const res = await fetch('/b2b/api/admin/orders/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'cancelled' }) }).then(r => r.json());
      if (!res?.success) { window.toast('Could not reject', 'error'); return; }
      window.toast(`Order ${id} rejected`, 'error');
      rerenderSection('approvals');
    }));
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
            <button class="btn btn-ghost btn-sm" data-action="products-export">Export CSV</button>
            <button class="btn btn-ghost btn-sm" data-action="products-import">Import CSV</button>
            <button class="btn btn-orange btn-sm" data-action="products-create">+ New SKU</button>
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
                  <td><button class="btn-link" data-edit data-id="${p.id}">Edit</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    host.querySelectorAll('[data-edit]').forEach(b => {
      b.addEventListener('click', () => {
        const p = items.find(x => x.id === b.dataset.id);
        if (p) openB2BProductEditor(p, () => rerenderSection('products'));
      });
    });
    host.querySelector('[data-action="products-export"]').addEventListener('click', () => {
      exportCSV(`anvil-products-${new Date().toISOString().slice(0,10)}.csv`, items, [
        { label: 'ID', key: 'id' }, { label: 'SKU', key: 'sku' }, { label: 'Name', key: 'name' },
        { label: 'Industry', key: 'industry' }, { label: 'Manufacturer', key: 'manufacturer' },
        { label: 'Unit price', key: 'unit_price' }, { label: 'Stock', key: 'stock' },
        { label: 'MOQ', key: 'moq' }, { label: 'Pack size', key: 'pack_size' }, { label: 'Lead time', key: 'lead_time' },
      ]);
    });
    host.querySelector('[data-action="products-import"]').addEventListener('click', () => {
      openB2BImportCSV('products', () => rerenderSection('products'));
    });
    host.querySelector('[data-action="products-create"]').addEventListener('click', () => {
      openB2BProductEditor(null, () => rerenderSection('products'));
    });
  };

  function openB2BProductEditor(existing, onSaved) {
    const isEdit = !!existing;
    formModal({
      title: isEdit ? `Edit ${existing.sku}` : 'New SKU',
      submitLabel: isEdit ? 'Save changes' : 'Create SKU',
      fields: [
        { name: 'sku', label: 'SKU', value: existing?.sku, required: true, placeholder: 'BR-6204' },
        { name: 'name', label: 'Product name', value: existing?.name, required: true },
        { name: 'industry', label: 'Industry', type: 'select', value: existing?.industry || 'consumables',
          options: ['packaging','chemicals','parts','consumables'].map(s => ({ value: s, label: s })) },
        { name: 'manufacturer', label: 'Manufacturer', value: existing?.manufacturer || 'Anvil House Brand' },
        { name: 'unit_price', label: 'Unit price (USD)', type: 'number', value: existing?.unit_price, required: true, min: 0, step: '0.01' },
        { name: 'stock', label: 'Stock', type: 'number', value: existing?.stock ?? 100, min: 0 },
        { name: 'moq', label: 'MOQ', type: 'number', value: existing?.moq ?? 1, min: 1 },
        { name: 'pack_size', label: 'Pack size', value: existing?.pack_size || '1 unit' },
        { name: 'lead_time', label: 'Lead time', value: existing?.lead_time || '3-5 days' },
        { name: 'short_desc', label: 'Short description', type: 'textarea', rows: 2, value: existing?.short_desc },
      ],
      onSubmit: async (data, modal) => {
        const url = isEdit ? `/b2b/api/admin/products/${encodeURIComponent(existing.id)}` : '/b2b/api/admin/products';
        const method = isEdit ? 'PUT' : 'POST';
        const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json());
        if (!res.success) { window.toast('Save failed', 'error'); return; }
        modal.remove();
        window.toast(isEdit ? 'SKU updated' : 'SKU created', 'success');
        if (onSaved) onSaved();
      },
    });
  }

  function openB2BImportCSV(kind, onDone) {
    formModal({
      title: `Import ${kind} from CSV`,
      large: false,
      fields: [
        { name: 'file', label: 'CSV file', type: 'file', accept: '.csv,text/csv', required: true,
          hint: 'Expected columns: sku, name, industry, manufacturer, unit_price, stock, moq, pack_size, lead_time' },
      ],
      submitLabel: 'Preview & import',
      onSubmit: async (data, modal) => {
        const file = data.file && data.file[0];
        if (!file) { window.toast('Pick a CSV', 'error'); return; }
        const text = await file.text();
        const rows = parseCSV(text);
        if (!rows.length) { window.toast('CSV is empty', 'error'); return; }
        modal.remove();
        const headers = Object.keys(rows[0]);
        window.showModal(`Import preview — ${rows.length} row(s)`, `
          <div style="max-height:380px; overflow:auto;">
            <table class="product-table">
              <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
              <tbody>${rows.slice(0,20).map(r => `<tr>${headers.map(h => `<td>${esc(r[h])}</td>`).join('')}</tr>`).join('')}</tbody>
            </table>
          </div>
          ${rows.length > 20 ? `<p style="color:var(--ink-mute); font-size:12.5px; margin-top:8px;">+ ${rows.length - 20} more row(s) hidden</p>` : ''}
          <div class="form-actions" style="margin-top:14px;">
            <button class="btn btn-ghost btn-sm" data-cancel-imp>Cancel</button>
            <button class="btn btn-orange btn-sm" data-confirm-imp>Import ${rows.length} row(s)</button>
          </div>
        `, { large: true });
        const m2 = document.querySelector('.modal-backdrop');
        m2.querySelector('[data-cancel-imp]').addEventListener('click', () => m2.remove());
        m2.querySelector('[data-confirm-imp]').addEventListener('click', async () => {
          let ok = 0;
          for (const r of rows) {
            const x = await fetch(`/b2b/api/admin/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) }).then(y => y.json()).catch(() => null);
            if (x?.success) ok++;
          }
          m2.remove();
          window.toast(`Imported ${ok} of ${rows.length} row(s)`, 'success');
          if (onDone) onDone();
        });
      },
    });
  }

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
            <button class="btn btn-ghost btn-sm" data-action="customers-export">Export CSV</button>
            <button class="btn btn-orange btn-sm" data-action="customers-create">+ Add customer</button>
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

    host.querySelector('[data-action="customers-export"]').addEventListener('click', () => {
      exportCSV(`anvil-customers-${new Date().toISOString().slice(0,10)}.csv`, items, [
        { label: 'ID', key: 'id' }, { label: 'Name', key: 'name' }, { label: 'Tier', key: 'tier' },
        { label: 'Terms', key: 'payment_terms' }, { label: 'Credit limit', key: 'credit_limit' },
        { label: 'Open balance', key: 'open_balance' }, { label: 'Contract discount', get: r => (r.contract_discount * 100).toFixed(1) + '%' },
        { label: 'Users', get: r => r.users.length },
      ]);
    });
    host.querySelector('[data-action="customers-create"]').addEventListener('click', () => {
      formModal({
        title: 'Add company',
        submitLabel: 'Create company',
        fields: [
          { name: 'name', label: 'Company name', required: true },
          { name: 'tier', label: 'Tier', type: 'select', value: 'Standard',
            options: [{ value: 'Standard', label: 'Standard' }, { value: 'Contract', label: 'Contract' }] },
          { name: 'payment_terms', label: 'Payment terms', type: 'select', value: 'Net 30',
            options: ['Net 30','Net 60','Advance','Card on file'].map(s => ({ value: s, label: s })) },
          { name: 'credit_limit', label: 'Credit limit (USD)', type: 'number', value: 25000, min: 0 },
          { name: 'contract_discount', label: 'Contract discount (%)', type: 'number', value: 0, min: 0, max: 30, step: '0.1' },
          { name: 'contact_name', label: 'Primary contact name' },
          { name: 'contact_email', label: 'Primary contact email', type: 'email' },
          { name: 'address', label: 'Ship-to address line 1' },
          { name: 'city', label: 'City', value: 'Dubai' },
        ],
        onSubmit: async (data, modal) => {
          const res = await fetch('/b2b/api/admin/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json());
          if (!res.success) { window.toast('Save failed', 'error'); return; }
          modal.remove();
          window.toast(`Company ${res.company.name} added`, 'success');
          rerenderSection('customers');
        },
      });
    });
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
          <div class="admin-card-head"><h3>Revenue, last 30 days</h3><span style="font-family:var(--mono); color:var(--ink-soft); font-size:12px;">${fm(data.revenue_trend.reduce((s,d)=>s+d.revenue,0))} total · avg ${fm(data.revenue_trend.reduce((s,d)=>s+d.revenue,0) / data.revenue_trend.length)}/day</span></div>
          <div class="bar-chart" style="height:200px;">
            ${(() => {
              const max = Math.max(...data.revenue_trend.map(x => x.revenue));
              const len = data.revenue_trend.length;
              return data.revenue_trend.map((d, idx) => {
                const h = Math.max(6, Math.round((d.revenue / max) * 100));
                const daysAgo = len - 1 - idx;
                const isToday = daysAgo === 0;
                return `<div class="bar-wrap" title="${daysAgo === 0 ? 'Today' : daysAgo + 'd ago'}: ${fm(d.revenue)}"><div class="bar ${isToday ? 'bar-today' : ''}" style="height:${h}%;"></div></div>`;
              }).join('');
            })()}
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
          <button class="btn btn-ghost btn-sm" data-action="settings-reset">Reset</button>
          <button class="btn btn-orange btn-sm" data-action="settings-save">Save changes</button>
        </div>
      </div>
    `;

    host.querySelector('[data-action="settings-save"]').addEventListener('click', async () => {
      const inputs = host.querySelectorAll('.checkout-form-grid input');
      const payload = {};
      payload.store_name = inputs[0]?.value || s.store_name;
      payload.free_freight_threshold = Number((inputs[1]?.value || '').replace(/[^0-9.]/g, '')) || s.free_freight_threshold;
      const rateRaw = (inputs[2]?.value || '').replace(/[^0-9.]/g, '');
      payload.tax_rate = rateRaw ? Number(rateRaw) / 100 : s.tax_rate;
      payload.approval_threshold = Number((inputs[3]?.value || '').replace(/[^0-9.]/g, '')) || 1000;
      const integToggles = host.querySelectorAll('.admin-card:nth-of-type(2) .toggle input');
      const integ = {};
      ['sap','sage','quickbooks','freightos'].forEach((k, i) => integ[k] = !!(integToggles[i]?.checked));
      payload.integrations = integ;
      const res = await fetch('/b2b/api/admin/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json());
      if (!res.success) { window.toast('Save failed', 'error'); return; }
      window.toast('Settings saved', 'success');
    });
    host.querySelector('[data-action="settings-reset"]').addEventListener('click', async () => {
      if (!confirm('Reset settings to defaults? (Demo)')) return;
      const res = await fetch('/b2b/api/admin/settings', { method: 'DELETE' }).then(r => r.json());
      if (!res.success) { window.toast('Reset failed', 'error'); return; }
      window.toast('Settings reset', 'success');
      rerenderSection('settings');
    });
  };
})();
