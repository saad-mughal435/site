/* admin-sections.js - Qahwa POS admin section renderers (Phase 5 + 6).
   Each function on window.PosAdmin receives a host element to paint into. */
(function () {
  'use strict';
  var esc = PosApp.escapeHtml;
  var money = PosApp.fmtMoney;
  var fmtDt = PosApp.fmtDateTime;

  function statusChip(s) {
    var labels = { open: 'Open', kitchen: 'In kitchen', ready: 'Ready', served: 'Served', completed: 'Completed', refunded: 'Refunded', held: 'Held', voided: 'Voided' };
    return '<span class="pos-status-chip ' + esc(s) + '">' + esc(labels[s] || s) + '</span>';
  }

  var Admin = {};

  /* ===================================================================
     Dashboard
     =================================================================== */
  Admin.dashboard = function (host) {
    PosApp.api('/admin/dashboard').then(function (r) {
      var d = r.body;
      var weeklyMax = Math.max.apply(null, d.weekly.map(function (w) { return w.revenue; }).concat([1]));
      var hourMax = Math.max.apply(null, d.by_hour.concat([1]));
      var heatLevel = function (v) {
        if (v === 0) return '';
        var pct = v / hourMax;
        if (pct > 0.75) return 'h-4';
        if (pct > 0.5)  return 'h-3';
        if (pct > 0.25) return 'h-2';
        return 'h-1';
      };
      var paymentTotal = Object.keys(d.by_payment).reduce(function (s, k) { return s + d.by_payment[k]; }, 0) || 1;

      host.innerHTML =
        '<div class="pos-kpi-grid">'
        + '<div class="pos-kpi"><div class="pos-kpi-label">Revenue today</div><div class="pos-kpi-value">' + money(d.kpis.revenue_today) + '</div><div class="pos-kpi-sub">across ' + d.kpis.orders_today + ' orders</div></div>'
        + '<div class="pos-kpi"><div class="pos-kpi-label">Avg ticket</div><div class="pos-kpi-value">' + money(d.kpis.avg_ticket) + '</div><div class="pos-kpi-sub">per order</div></div>'
        + '<div class="pos-kpi"><div class="pos-kpi-label">In kitchen now</div><div class="pos-kpi-value">' + d.kpis.kitchen_active + '</div><div class="pos-kpi-sub"><a href="#orders" style="color:var(--pos-accent-2);">view live orders →</a></div></div>'
        + '<div class="pos-kpi"><div class="pos-kpi-label">Today</div><div class="pos-kpi-value" style="font-size:18px;">' + new Date().toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' }) + '</div><div class="pos-kpi-sub">Qahwa Café</div></div>'
        + '</div>'

        + '<div class="pos-mt-3" style="display:grid;grid-template-columns:1.5fr 1fr;gap:18px;">'
        +   '<div class="pos-card">'
        +     '<h3 style="margin-bottom:18px;">Last 7 days revenue</h3>'
        +     '<div class="pos-bars">'
        +       d.weekly.map(function (w) {
                  var h = Math.max(6, (w.revenue / weeklyMax) * 165);
                  return '<div class="bar" style="height:' + h + 'px;"><span>' + Math.round(w.revenue) + '</span></div>';
                }).join('')
        +     '</div>'
        +     '<div class="pos-bars-labels">' + d.weekly.map(function (w) { return '<span>' + esc(w.label) + '</span>'; }).join('') + '</div>'
        +   '</div>'
        +   '<div class="pos-card">'
        +     '<h3 style="margin-bottom:14px;">Top 5 products today</h3>'
        +     (d.top_products.length
                ? '<table class="pos-table">' + d.top_products.map(function (p, i) {
                    return '<tr><td style="width:22px;color:var(--pos-muted-light);font-family:var(--font-mono);">' + (i + 1) + '</td><td>' + esc(p.product) + '</td><td style="text-align:right;font-family:var(--font-mono);font-weight:700;">' + p.qty + '</td></tr>';
                  }).join('') + '</table>'
                : '<div class="pos-table-empty">No sales yet today.</div>')
        +   '</div>'
        + '</div>'

        + '<div class="pos-mt-3 pos-card">'
        +   '<h3 style="margin-bottom:14px;">Orders by hour (today)</h3>'
        +   '<div class="pos-heatmap">'
        +     '<div></div>' + d.by_hour.map(function (_, h) { return '<div style="font-size:9.5px;color:var(--pos-muted-light);text-align:center;font-family:var(--font-mono);">' + h + '</div>'; }).join('')
        +     '<div class="pos-heat-day">today</div>'
        +     d.by_hour.map(function (v) { return '<div class="pos-heat-cell ' + heatLevel(v) + '" title="' + v + ' orders"></div>'; }).join('')
        +   '</div>'
        + '</div>'

        + '<div class="pos-mt-3" style="display:grid;grid-template-columns:1fr 1.5fr;gap:18px;">'
        +   '<div class="pos-card">'
        +     '<h3 style="margin-bottom:14px;">Payment methods today</h3>'
        +     (Object.keys(d.by_payment).length
                ? Object.keys(d.by_payment).map(function (k) {
                    var pct = (d.by_payment[k] / paymentTotal * 100).toFixed(1);
                    return '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span style="text-transform:capitalize;font-weight:600;">' + esc(k) + '</span><span style="font-family:var(--font-mono);">' + money(d.by_payment[k]) + ' · ' + pct + '%</span></div><div style="height:8px;background:var(--pos-bg-light);border-radius:4px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:var(--pos-accent);"></div></div></div>';
                  }).join('')
                : '<div class="pos-table-empty">No completed payments yet today.</div>')
        +   '</div>'
        +   '<div class="pos-panel">'
        +     '<div class="pos-panel-head"><h3>Recent orders</h3><a href="#orders" style="font-size:13px;">All →</a></div>'
        +     '<table class="pos-table">'
        +       '<thead><tr><th>Order</th><th>Time</th><th>Type</th><th>Status</th><th style="text-align:right;">Total</th></tr></thead>'
        +       '<tbody>' + (d.recent.length
                  ? d.recent.map(function (o) { return '<tr><td style="font-family:var(--font-mono);">' + esc(o.order_no) + '</td><td>' + fmtDt(o.created_at) + '</td><td>' + esc(o.type || '—') + '</td><td>' + statusChip(o.status) + '</td><td style="text-align:right;font-family:var(--font-mono);font-weight:700;">' + money(o.total) + '</td></tr>'; }).join('')
                  : '<tr><td colspan="5" class="pos-table-empty">No orders yet.</td></tr>')
        +     '</tbody></table>'
        +   '</div>'
        + '</div>';
    });
  };

  /* ===================================================================
     Live orders
     =================================================================== */
  Admin.orders = function (host) {
    var state = { filter: 'all' };
    function paint() {
      PosApp.api('/admin/orders').then(function (r) {
        var rows = r.body.items;
        var counts = { all: rows.length };
        ['open','kitchen','ready','served','completed','refunded','held','voided'].forEach(function (s) {
          counts[s] = rows.filter(function (o) { return o.status === s; }).length;
        });
        if (state.filter !== 'all') rows = rows.filter(function (o) { return o.status === state.filter; });
        host.innerHTML =
          '<div class="pos-flex pos-mt-1" style="margin-bottom:14px;">'
          + ['all','open','kitchen','ready','served','completed','refunded','voided'].map(function (s) {
              return '<button class="pos-btn ' + (state.filter === s ? 'pos-btn--primary' : '') + '" data-fil="' + s + '" style="padding:6px 12px;min-height:32px;font-size:12px;">' + s + ' <span style="opacity:.7;">(' + (counts[s] || 0) + ')</span></button>';
            }).join('')
          + '</div>'
          + '<div class="pos-panel">'
          +   '<table class="pos-table">'
          +     '<thead><tr><th>Order</th><th>Time</th><th>Type</th><th>Cashier</th><th>Items</th><th>Status</th><th style="text-align:right;">Total</th><th></th></tr></thead>'
          +     '<tbody>' + (rows.length ? rows.map(function (o) {
                  var lineCount = (o.lines || []).reduce(function (s, l) { return s + l.qty; }, 0);
                  return '<tr>'
                    + '<td style="font-family:var(--font-mono);font-weight:600;">' + esc(o.order_no) + '</td>'
                    + '<td>' + fmtDt(o.created_at) + '</td>'
                    + '<td>' + (o.table_id ? '🪑 ' + esc(o.table_id.toUpperCase()) : '🛍 Takeaway') + '</td>'
                    + '<td style="font-size:12px;">' + esc((window.POS_DATA.STAFF.find(function (s) { return s.id === o.cashier_id; }) || {}).name || '—') + '</td>'
                    + '<td>' + lineCount + '</td>'
                    + '<td>' + statusChip(o.status) + '</td>'
                    + '<td style="text-align:right;font-family:var(--font-mono);font-weight:700;">' + money(o.total) + '</td>'
                    + '<td><button class="pos-btn" data-view="' + o.id + '" style="padding:5px 10px;min-height:30px;font-size:11px;">View</button></td>'
                    + '</tr>';
                }).join('') : '<tr><td colspan="8" class="pos-table-empty">No orders match.</td></tr>')
          +     '</tbody></table>'
          + '</div>';
        host.querySelectorAll('[data-fil]').forEach(function (b) {
          b.addEventListener('click', function () { state.filter = b.getAttribute('data-fil'); paint(); });
        });
        host.querySelectorAll('[data-view]').forEach(function (b) {
          b.addEventListener('click', function () { openOrder(b.getAttribute('data-view'), paint); });
        });
      });
    }
    paint();
  };

  function openOrder(oid, refresh) {
    PosApp.api('/orders/' + oid).then(function (r) {
      var o = r.body.order;
      var prodMap = {}; window.POS_DATA.PRODUCTS.forEach(function (p) { prodMap[p.id] = p; });
      var linesHtml = (o.lines || []).map(function (l) {
        var p = prodMap[l.product_id] || { name: l.product_id };
        return '<tr><td>' + l.qty + '×</td><td>' + esc(p.name) + '</td><td style="text-align:right;font-family:var(--font-mono);">' + money(l.line_total || l.unit_price * l.qty) + '</td></tr>';
      }).join('');
      var paymentsHtml = (o.payments || []).map(function (p) { return '<div style="font-size:13px;">' + esc(p.method) + ' · <span style="font-family:var(--font-mono);">' + money(p.amount) + '</span></div>'; }).join('') || '<div class="pos-text-muted" style="font-size:13px;">Not paid yet.</div>';

      PosApp.showModal({
        title: 'Order ' + o.order_no,
        size: 'lg',
        body:
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">'
          + '<div><div class="pos-kpi-label">Status</div><div>' + statusChip(o.status) + '</div></div>'
          + '<div><div class="pos-kpi-label">Type</div><div>' + (o.table_id ? '🪑 Table ' + esc(o.table_id.toUpperCase()) : '🛍 Takeaway') + '</div></div>'
          + '<div><div class="pos-kpi-label">Created</div><div>' + fmtDt(o.created_at) + '</div></div>'
          + '<div><div class="pos-kpi-label">Completed</div><div>' + (o.completed_at ? fmtDt(o.completed_at) : '—') + '</div></div>'
          + '</div>'
          + '<table class="pos-table" style="margin-bottom:14px;">' + linesHtml + '</table>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-family:var(--font-mono);font-size:13px;background:var(--pos-bg-light);padding:12px;border-radius:8px;">'
          +   '<div><div>Subtotal: ' + money(o.subtotal) + '</div><div>Discount: -' + money(o.discount || 0) + '</div><div>VAT: ' + money(o.vat) + '</div><div style="font-weight:800;font-size:15px;margin-top:6px;">Total: ' + money(o.total) + '</div></div>'
          +   '<div><div class="pos-kpi-label">Payments</div>' + paymentsHtml + '</div>'
          + '</div>'
          + '<div class="pos-mt-3" style="display:flex;gap:8px;flex-wrap:wrap;">'
          +   (o.status !== 'completed' && o.status !== 'refunded' ? '<button class="pos-btn pos-btn--primary" data-set="completed">Mark completed</button>' : '')
          +   (o.status === 'completed' ? '<button class="pos-btn pos-btn--danger" data-refund>Refund</button>' : '')
          +   (o.status === 'open' || o.status === 'kitchen' ? '<button class="pos-btn" data-set="voided">Void</button>' : '')
          + '</div>',
        onMount: function (el, close) {
          el.querySelectorAll('[data-set]').forEach(function (b) {
            b.addEventListener('click', function () {
              PosApp.api('/admin/orders/' + oid + '/status', { method: 'POST', body: { status: b.getAttribute('data-set') } }).then(function () {
                window.toast('Order updated', 'success');
                close(); refresh();
              });
            });
          });
          var rb = el.querySelector('[data-refund]');
          if (rb) rb.addEventListener('click', function () {
            var reason = prompt('Refund reason?') || '';
            PosApp.api('/orders/' + oid + '/refund', { method: 'POST', body: { reason: reason } }).then(function () {
              window.toast('Order refunded', 'warn');
              close(); refresh();
            });
          });
        }
      });
    });
  }

  /* ===================================================================
     Products
     =================================================================== */
  Admin.products = function (host) {
    var state = { q: '', cat: 'all', selected: new Set() };
    function paint() {
      Promise.all([PosApp.api('/admin/products'), PosApp.api('/categories')]).then(function (results) {
        var prods = results[0].body.items;
        var cats = results[1].body.items;
        var catMap = {}; cats.forEach(function (c) { catMap[c.id] = c; });
        var rows = prods.filter(function (p) {
          if (state.cat !== 'all' && p.category_id !== state.cat) return false;
          if (state.q && (p.name + ' ' + (p.name_ar || '')).toLowerCase().indexOf(state.q.toLowerCase()) === -1) return false;
          return true;
        });
        var selCount = state.selected.size;

        host.innerHTML =
          '<div class="pos-flex" style="margin-bottom:12px;align-items:center;">'
          + '<input class="pos-input" id="p-q" placeholder="Search products..." style="max-width:280px;" value="' + esc(state.q) + '" />'
          + '<select class="pos-select" id="p-cat" style="max-width:200px;">'
          +   '<option value="all">All categories</option>'
          +   cats.map(function (c) { return '<option value="' + c.id + '"' + (state.cat === c.id ? ' selected' : '') + '>' + esc(c.icon) + ' ' + esc(c.name) + '</option>'; }).join('')
          + '</select>'
          + '<span class="pos-text-muted" style="font-size:13px;">' + rows.length + ' products</span>'
          + '<button class="pos-btn pos-btn--primary" id="p-new" style="margin-inline-start:auto;">+ New product</button>'
          + '</div>'
          + (selCount ? '<div class="pos-card" style="margin-bottom:12px;padding:10px 14px;display:flex;gap:8px;align-items:center;background:var(--pos-bg-light);"><span style="font-weight:600;">' + selCount + ' selected</span>'
              + '<button class="pos-btn" data-bulk="activate" style="padding:5px 10px;min-height:32px;font-size:12px;">Activate</button>'
              + '<button class="pos-btn" data-bulk="deactivate" style="padding:5px 10px;min-height:32px;font-size:12px;">Deactivate</button>'
              + '<button class="pos-btn pos-btn--danger" data-bulk="delete" style="padding:5px 10px;min-height:32px;font-size:12px;">Delete</button>'
              + '<button class="pos-btn" id="p-clear" style="padding:5px 10px;min-height:32px;font-size:12px;margin-inline-start:auto;">Clear</button></div>'
              : '')
          + '<div class="pos-panel">'
          +   '<table class="pos-table">'
          +     '<thead><tr><th style="width:36px;"><input type="checkbox" id="p-all"' + (rows.length && rows.every(function (p) { return state.selected.has(p.id); }) ? ' checked' : '') + ' /></th>'
          +       '<th>Product</th><th>Category</th><th style="text-align:right;">Price</th><th style="text-align:right;">Cost</th><th style="text-align:right;">Margin</th><th>Status</th><th></th></tr></thead>'
          +     '<tbody>' + (rows.length ? rows.map(function (p) {
                  var margin = p.price_aed > 0 ? Math.round((p.price_aed - (p.cost_aed || 0)) / p.price_aed * 100) : 0;
                  return '<tr>'
                    + '<td><input type="checkbox" data-sel="' + p.id + '"' + (state.selected.has(p.id) ? ' checked' : '') + ' /></td>'
                    + '<td><div style="font-weight:600;">' + esc(p.name) + '</div>' + (p.name_ar ? '<div style="font-size:11.5px;color:var(--pos-muted-light);">' + esc(p.name_ar) + '</div>' : '') + '</td>'
                    + '<td style="font-size:12px;">' + esc((catMap[p.category_id] || {}).name || p.category_id) + '</td>'
                    + '<td style="text-align:right;font-family:var(--font-mono);">' + money(p.price_aed) + '</td>'
                    + '<td style="text-align:right;font-family:var(--font-mono);color:var(--pos-muted-light);">' + money(p.cost_aed || 0) + '</td>'
                    + '<td style="text-align:right;font-family:var(--font-mono);font-weight:600;color:' + (margin > 60 ? 'var(--pos-success)' : 'var(--pos-card-ink)') + ';">' + margin + '%</td>'
                    + '<td>' + (p.active ? '<span class="pos-status-chip completed">Active</span>' : '<span class="pos-status-chip voided">Inactive</span>') + '</td>'
                    + '<td><button class="pos-btn" data-edit="' + p.id + '" style="padding:5px 10px;min-height:30px;font-size:11px;">Edit</button></td>'
                    + '</tr>';
                }).join('') : '<tr><td colspan="8" class="pos-table-empty">No products match.</td></tr>')
          +     '</tbody></table>'
          + '</div>';

        document.getElementById('p-q').addEventListener('input', function (e) { state.q = e.target.value; paint(); });
        document.getElementById('p-cat').addEventListener('change', function (e) { state.cat = e.target.value; paint(); });
        document.getElementById('p-new').addEventListener('click', function () { editProduct(null, cats, paint); });
        var pall = document.getElementById('p-all');
        if (pall) pall.addEventListener('change', function (e) {
          if (e.target.checked) rows.forEach(function (p) { state.selected.add(p.id); });
          else rows.forEach(function (p) { state.selected.delete(p.id); });
          paint();
        });
        host.querySelectorAll('[data-sel]').forEach(function (cb) {
          cb.addEventListener('change', function () {
            var id = cb.getAttribute('data-sel');
            if (cb.checked) state.selected.add(id); else state.selected.delete(id);
            paint();
          });
        });
        host.querySelectorAll('[data-edit]').forEach(function (b) {
          b.addEventListener('click', function () {
            var p = prods.find(function (x) { return x.id === b.getAttribute('data-edit'); });
            editProduct(p, cats, paint);
          });
        });
        host.querySelectorAll('[data-bulk]').forEach(function (b) {
          b.addEventListener('click', function () {
            var op = b.getAttribute('data-bulk');
            if (op === 'delete' && !confirm('Delete ' + selCount + ' product' + (selCount === 1 ? '' : 's') + '?')) return;
            PosApp.api('/admin/products/bulk', { method: 'POST', body: { ids: Array.from(state.selected), op: op } }).then(function () {
              window.toast(op + 'd ' + selCount + ' products', 'success');
              state.selected.clear(); paint();
            });
          });
        });
        var clr = document.getElementById('p-clear');
        if (clr) clr.addEventListener('click', function () { state.selected.clear(); paint(); });
      });
    }
    paint();
  };

  function editProduct(p, cats, refresh) {
    var isNew = !p;
    var f = p || { name: '', name_ar: '', category_id: cats[0] && cats[0].id, price_aed: 0, cost_aed: 0, active: true, photo: '', modifier_group_ids: [] };
    var allMods = window.POS_DATA.MODIFIER_GROUPS;

    PosApp.showModal({
      title: isNew ? 'New product' : 'Edit ' + (f.name || ''),
      size: 'lg',
      body:
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
        + '<label class="pos-field"><span>Name</span><input class="pos-input" id="f-name" value="' + esc(f.name) + '" /></label>'
        + '<label class="pos-field"><span>Name (Arabic)</span><input class="pos-input" id="f-name-ar" value="' + esc(f.name_ar || '') + '" /></label>'
        + '<label class="pos-field"><span>Category</span><select class="pos-select" id="f-cat">'
        +   cats.map(function (c) { return '<option value="' + c.id + '"' + (c.id === f.category_id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('')
        + '</select></label>'
        + '<label class="pos-field"><span>Photo URL</span><input class="pos-input" id="f-photo" value="' + esc(f.photo || '') + '" placeholder="https://..." /></label>'
        + '<label class="pos-field"><span>Price (AED)</span><input class="pos-input" id="f-price" type="number" step="0.50" value="' + f.price_aed + '" /></label>'
        + '<label class="pos-field"><span>Cost (AED)</span><input class="pos-input" id="f-cost" type="number" step="0.10" value="' + (f.cost_aed || 0) + '" /></label>'
        + '<label class="pos-field" style="grid-column:1/-1;"><span>Status</span><select class="pos-select" id="f-active"><option value="true"' + (f.active ? ' selected' : '') + '>Active (visible in terminal)</option><option value="false"' + (!f.active ? ' selected' : '') + '>Inactive</option></select></label>'
        + '<div class="pos-field" style="grid-column:1/-1;"><span>Modifier groups</span>'
        +   '<div style="display:flex;flex-wrap:wrap;gap:6px;">'
        +     allMods.map(function (g) {
                var ck = (f.modifier_group_ids || []).indexOf(g.id) !== -1;
                return '<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--pos-line-light);border-radius:999px;font-size:13px;cursor:pointer;background:' + (ck ? 'var(--pos-bg-light)' : 'white') + ';"><input type="checkbox" data-mg="' + g.id + '"' + (ck ? ' checked' : '') + ' />' + esc(g.name) + '</label>';
              }).join('')
        +   '</div></div>'
        + '</div>',
      foot:
        (!isNew ? '<button class="pos-btn pos-btn--danger" id="f-del">Delete</button>' : '')
        + '<button class="pos-btn" data-modal-close style="margin-inline-start:auto;">Cancel</button>'
        + '<button class="pos-btn pos-btn--primary" id="f-save">Save product</button>',
      onMount: function (el, close) {
        el.querySelector('#f-save').addEventListener('click', function () {
          var body = {
            name: el.querySelector('#f-name').value.trim(),
            name_ar: el.querySelector('#f-name-ar').value.trim(),
            category_id: el.querySelector('#f-cat').value,
            photo: el.querySelector('#f-photo').value.trim(),
            price_aed: parseFloat(el.querySelector('#f-price').value) || 0,
            cost_aed: parseFloat(el.querySelector('#f-cost').value) || 0,
            active: el.querySelector('#f-active').value === 'true',
            modifier_group_ids: Array.from(el.querySelectorAll('[data-mg]')).filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute('data-mg'); })
          };
          if (!body.name) { window.toast('Name is required', 'error'); return; }
          var req = isNew
            ? PosApp.api('/admin/products', { method: 'POST', body: body })
            : PosApp.api('/admin/products/' + p.id, { method: 'PUT', body: body });
          req.then(function () { window.toast('Saved', 'success'); close(); refresh(); });
        });
        var del = el.querySelector('#f-del');
        if (del) del.addEventListener('click', function () {
          if (!confirm('Delete this product?')) return;
          PosApp.api('/admin/products/' + p.id, { method: 'DELETE' }).then(function () {
            window.toast('Deleted', 'warn'); close(); refresh();
          });
        });
      }
    });
  }

  /* ===================================================================
     Categories
     =================================================================== */
  Admin.categories = function (host) {
    function paint() {
      Promise.all([PosApp.api('/admin/categories'), PosApp.api('/admin/products')]).then(function (results) {
        var cats = results[0].body.items.slice().sort(function (a, b) { return (a.display_order || 0) - (b.display_order || 0); });
        var prods = results[1].body.items;
        host.innerHTML =
          '<div class="pos-flex" style="margin-bottom:12px;">'
          + '<button class="pos-btn pos-btn--primary" id="c-new" style="margin-inline-start:auto;">+ New category</button>'
          + '</div>'
          + '<div class="pos-panel">'
          +   '<table class="pos-table">'
          +     '<thead><tr><th>Order</th><th>Icon</th><th>Name</th><th>Name (Arabic)</th><th>Products</th><th></th></tr></thead>'
          +     '<tbody>' + cats.map(function (c) {
                  var count = prods.filter(function (p) { return p.category_id === c.id; }).length;
                  return '<tr>'
                    + '<td style="font-family:var(--font-mono);">' + (c.display_order || 0) + '</td>'
                    + '<td style="font-size:20px;">' + esc(c.icon || '🍽') + '</td>'
                    + '<td style="font-weight:600;">' + esc(c.name) + '</td>'
                    + '<td style="color:var(--pos-muted-light);">' + esc(c.name_ar || '—') + '</td>'
                    + '<td>' + count + '</td>'
                    + '<td><button class="pos-btn" data-cat-edit="' + c.id + '" style="padding:5px 10px;min-height:30px;font-size:11px;">Edit</button>'
                    + ' <button class="pos-btn pos-btn--danger" data-cat-del="' + c.id + '" style="padding:5px 10px;min-height:30px;font-size:11px;">Delete</button></td>'
                    + '</tr>';
                }).join('')
          +     '</tbody></table>'
          + '</div>';
        document.getElementById('c-new').addEventListener('click', function () { editCategory(null, paint); });
        host.querySelectorAll('[data-cat-edit]').forEach(function (b) {
          b.addEventListener('click', function () {
            var c = cats.find(function (x) { return x.id === b.getAttribute('data-cat-edit'); });
            editCategory(c, paint);
          });
        });
        host.querySelectorAll('[data-cat-del]').forEach(function (b) {
          b.addEventListener('click', function () {
            if (!confirm('Delete category? Products in this category will keep their tag but it will be empty.')) return;
            PosApp.api('/admin/categories', { method: 'POST', body: { action: 'remove', id: b.getAttribute('data-cat-del') } })
              .then(function () { window.toast('Deleted', 'warn'); paint(); });
          });
        });
      });
    }
    paint();
  };

  function editCategory(c, refresh) {
    var isNew = !c;
    var f = c || { name: '', name_ar: '', icon: '🍽', display_order: 99 };
    PosApp.showModal({
      title: isNew ? 'New category' : 'Edit ' + f.name,
      body:
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
        + '<label class="pos-field"><span>Name</span><input class="pos-input" id="cf-name" value="' + esc(f.name) + '" /></label>'
        + '<label class="pos-field"><span>Name (Arabic)</span><input class="pos-input" id="cf-name-ar" value="' + esc(f.name_ar || '') + '" /></label>'
        + '<label class="pos-field"><span>Icon (emoji)</span><input class="pos-input" id="cf-icon" value="' + esc(f.icon || '🍽') + '" /></label>'
        + '<label class="pos-field"><span>Display order</span><input class="pos-input" id="cf-order" type="number" value="' + (f.display_order || 99) + '" /></label>'
        + '</div>',
      foot: '<button class="pos-btn" data-modal-close style="margin-inline-start:auto;">Cancel</button><button class="pos-btn pos-btn--primary" id="cf-save">Save</button>',
      onMount: function (el, close) {
        el.querySelector('#cf-save').addEventListener('click', function () {
          var data = {
            name: el.querySelector('#cf-name').value.trim(),
            name_ar: el.querySelector('#cf-name-ar').value.trim(),
            icon: el.querySelector('#cf-icon').value.trim() || '🍽',
            display_order: parseInt(el.querySelector('#cf-order').value, 10) || 99
          };
          if (!data.name) { window.toast('Name required', 'error'); return; }
          var req = isNew
            ? PosApp.api('/admin/categories', { method: 'POST', body: { action: 'add', category: data } })
            : PosApp.api('/admin/categories', { method: 'POST', body: { action: 'update', id: c.id, changes: data } });
          req.then(function () { window.toast('Saved', 'success'); close(); refresh(); });
        });
      }
    });
  }

  /* ===================================================================
     Modifiers
     =================================================================== */
  Admin.modifiers = function (host) {
    function paint() {
      PosApp.api('/admin/modifiers').then(function (r) {
        var groups = r.body.items;
        host.innerHTML =
          '<div class="pos-flex" style="margin-bottom:14px;">'
          + '<button class="pos-btn pos-btn--primary" id="m-new" style="margin-inline-start:auto;">+ New modifier group</button>'
          + '</div>'
          + groups.map(function (g) {
              return '<div class="pos-card" style="margin-bottom:14px;">'
                + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">'
                +   '<h3 style="margin:0;">' + esc(g.name) + '</h3>'
                +   '<span class="pos-status-chip completed">' + esc(g.type) + '</span>'
                +   (g.required ? '<span class="pos-status-chip kitchen">Required</span>' : '')
                +   '<div style="margin-inline-start:auto;display:flex;gap:6px;">'
                +     '<button class="pos-btn" data-mg-edit="' + g.id + '" style="padding:5px 12px;min-height:32px;font-size:12px;">Edit</button>'
                +     '<button class="pos-btn pos-btn--danger" data-mg-del="' + g.id + '" style="padding:5px 12px;min-height:32px;font-size:12px;">Delete</button>'
                +   '</div>'
                + '</div>'
                + '<div style="display:flex;flex-wrap:wrap;gap:6px;">'
                +   (g.options || []).map(function (o) {
                      var d = o.price_delta || 0;
                      var sign = d > 0 ? '+' : (d < 0 ? '−' : '');
                      var amt = Math.abs(d).toFixed(2);
                      return '<span style="padding:6px 12px;background:var(--pos-bg-light);border-radius:999px;font-size:13px;display:inline-flex;gap:6px;align-items:center;">'
                        + esc(o.label) + (d !== 0 ? ' <span style="font-family:var(--font-mono);color:var(--pos-muted-light);font-size:11.5px;">' + sign + amt + '</span>' : '')
                        + '</span>';
                    }).join('')
                + '</div>'
                + '</div>';
            }).join('');

        document.getElementById('m-new').addEventListener('click', function () { editModGroup(null, paint); });
        host.querySelectorAll('[data-mg-edit]').forEach(function (b) {
          b.addEventListener('click', function () {
            var g = groups.find(function (x) { return x.id === b.getAttribute('data-mg-edit'); });
            editModGroup(g, paint);
          });
        });
        host.querySelectorAll('[data-mg-del]').forEach(function (b) {
          b.addEventListener('click', function () {
            if (!confirm('Delete this modifier group?')) return;
            PosApp.api('/admin/modifiers', { method: 'POST', body: { action: 'remove', id: b.getAttribute('data-mg-del') } })
              .then(function () { window.toast('Deleted', 'warn'); paint(); });
          });
        });
      });
    }
    paint();
  };

  function editModGroup(g, refresh) {
    var isNew = !g;
    var f = g || { name: '', type: 'single', required: false, options: [{ id: 'o-' + Date.now(), label: '', price_delta: 0 }] };
    var optsClone = JSON.parse(JSON.stringify(f.options || []));

    function renderOptsHtml() {
      return optsClone.map(function (o, i) {
        return '<div style="display:grid;grid-template-columns:1fr 110px 32px;gap:6px;margin-bottom:6px;align-items:center;">'
          + '<input class="pos-input" data-opt-label="' + i + '" placeholder="Label" value="' + esc(o.label) + '" />'
          + '<input class="pos-input" data-opt-price="' + i + '" type="number" step="0.50" placeholder="Δ price" value="' + (o.price_delta || 0) + '" />'
          + '<button class="pos-btn pos-btn--danger" data-opt-del="' + i + '" style="padding:6px;min-height:36px;font-size:14px;">×</button>'
          + '</div>';
      }).join('');
    }

    PosApp.showModal({
      title: isNew ? 'New modifier group' : 'Edit ' + (f.name || 'group'),
      size: 'lg',
      body:
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px;">'
        + '<label class="pos-field"><span>Group name</span><input class="pos-input" id="mf-name" value="' + esc(f.name) + '" /></label>'
        + '<label class="pos-field"><span>Selection type</span><select class="pos-select" id="mf-type"><option value="single"' + (f.type === 'single' ? ' selected' : '') + '>Single choice</option><option value="multi"' + (f.type === 'multi' ? ' selected' : '') + '>Multi choice</option></select></label>'
        + '<label class="pos-field"><span>Required</span><select class="pos-select" id="mf-req"><option value="false"' + (!f.required ? ' selected' : '') + '>Optional</option><option value="true"' + (f.required ? ' selected' : '') + '>Required</option></select></label>'
        + '</div>'
        + '<div class="pos-kpi-label">Options</div>'
        + '<div id="mf-opts">' + renderOptsHtml() + '</div>'
        + '<button class="pos-btn pos-mt-1" id="mf-add-opt" style="padding:6px 12px;min-height:34px;font-size:12px;">+ Add option</button>',
      foot: '<button class="pos-btn" data-modal-close style="margin-inline-start:auto;">Cancel</button><button class="pos-btn pos-btn--primary" id="mf-save">Save group</button>',
      onMount: function (el, close) {
        function bind() {
          el.querySelectorAll('[data-opt-label]').forEach(function (inp) {
            inp.addEventListener('input', function () { optsClone[+inp.getAttribute('data-opt-label')].label = inp.value; });
          });
          el.querySelectorAll('[data-opt-price]').forEach(function (inp) {
            inp.addEventListener('input', function () { optsClone[+inp.getAttribute('data-opt-price')].price_delta = parseFloat(inp.value) || 0; });
          });
          el.querySelectorAll('[data-opt-del]').forEach(function (b) {
            b.addEventListener('click', function () {
              optsClone.splice(+b.getAttribute('data-opt-del'), 1);
              el.querySelector('#mf-opts').innerHTML = renderOptsHtml(); bind();
            });
          });
        }
        bind();
        el.querySelector('#mf-add-opt').addEventListener('click', function () {
          optsClone.push({ id: 'o-' + Date.now(), label: '', price_delta: 0 });
          el.querySelector('#mf-opts').innerHTML = renderOptsHtml(); bind();
        });
        el.querySelector('#mf-save').addEventListener('click', function () {
          var data = {
            name: el.querySelector('#mf-name').value.trim(),
            type: el.querySelector('#mf-type').value,
            required: el.querySelector('#mf-req').value === 'true',
            options: optsClone.filter(function (o) { return o.label; })
          };
          if (!data.name) { window.toast('Group name required', 'error'); return; }
          var req = isNew
            ? PosApp.api('/admin/modifiers', { method: 'POST', body: { action: 'add', group: data } })
            : PosApp.api('/admin/modifiers', { method: 'POST', body: { action: 'update', id: g.id, changes: data } });
          req.then(function () { window.toast('Saved', 'success'); close(); refresh(); });
        });
      }
    });
  }

  /* ===================================================================
     Discounts
     =================================================================== */
  Admin.discounts = function (host) {
    function paint() {
      PosApp.api('/admin/discounts').then(function (r) {
        var rows = r.body.items;
        host.innerHTML =
          '<div class="pos-flex" style="margin-bottom:12px;">'
          + '<button class="pos-btn pos-btn--primary" id="d-new" style="margin-inline-start:auto;">+ New discount</button>'
          + '</div>'
          + '<div class="pos-panel">'
          +   '<table class="pos-table">'
          +     '<thead><tr><th>Code / Name</th><th>Type</th><th>Value</th><th>Min total</th><th>Status</th><th></th></tr></thead>'
          +     '<tbody>' + (rows.length ? rows.map(function (d) {
                  return '<tr>'
                    + '<td style="font-family:var(--font-mono);font-weight:600;">' + esc(d.code || d.name) + '</td>'
                    + '<td>' + esc(d.type) + '</td>'
                    + '<td style="font-family:var(--font-mono);">' + (d.type === 'pct' || d.type === 'percent' ? d.value + '%' : (d.type === 'fixed' || d.type === 'aed' ? money(d.value) : esc(d.type))) + '</td>'
                    + '<td style="font-family:var(--font-mono);">' + (d.min_total ? money(d.min_total) : '—') + '</td>'
                    + '<td>' + (d.active ? '<span class="pos-status-chip completed">Active</span>' : '<span class="pos-status-chip voided">Paused</span>') + '</td>'
                    + '<td><button class="pos-btn" data-tog="' + d.id + '" style="padding:5px 10px;min-height:30px;font-size:11px;">' + (d.active ? 'Pause' : 'Resume') + '</button>'
                    + ' <button class="pos-btn pos-btn--danger" data-rm="' + d.id + '" style="padding:5px 10px;min-height:30px;font-size:11px;">Delete</button></td>'
                    + '</tr>';
                }).join('') : '<tr><td colspan="6" class="pos-table-empty">No discounts.</td></tr>')
          +     '</tbody></table>'
          + '</div>';
        document.getElementById('d-new').addEventListener('click', function () {
          PosApp.showModal({
            title: 'New discount',
            body:
              '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
              + '<label class="pos-field"><span>Code / Name</span><input class="pos-input" id="df-code" placeholder="OPENING5" /></label>'
              + '<label class="pos-field"><span>Type</span><select class="pos-select" id="df-type"><option value="pct">% off</option><option value="fixed">AED off</option><option value="bogo">BOGO</option></select></label>'
              + '<label class="pos-field"><span>Value</span><input class="pos-input" id="df-val" type="number" step="1" value="10" /></label>'
              + '<label class="pos-field"><span>Min total (optional)</span><input class="pos-input" id="df-min" type="number" step="1" placeholder="0" /></label>'
              + '</div>',
            foot: '<button class="pos-btn" data-modal-close style="margin-inline-start:auto;">Cancel</button><button class="pos-btn pos-btn--primary" id="df-save">Save</button>',
            onMount: function (el, close) {
              el.querySelector('#df-save').addEventListener('click', function () {
                var body = {
                  code: el.querySelector('#df-code').value.trim(),
                  type: el.querySelector('#df-type').value,
                  value: parseFloat(el.querySelector('#df-val').value) || 0,
                  min_total: parseFloat(el.querySelector('#df-min').value) || 0
                };
                if (!body.code) { window.toast('Code required', 'error'); return; }
                PosApp.api('/admin/discounts', { method: 'POST', body: { action: 'add', discount: body } })
                  .then(function () { window.toast('Saved', 'success'); close(); paint(); });
              });
            }
          });
        });
        host.querySelectorAll('[data-tog]').forEach(function (b) {
          b.addEventListener('click', function () {
            PosApp.api('/admin/discounts', { method: 'POST', body: { action: 'toggle', id: b.getAttribute('data-tog') } }).then(paint);
          });
        });
        host.querySelectorAll('[data-rm]').forEach(function (b) {
          b.addEventListener('click', function () {
            if (!confirm('Delete discount?')) return;
            PosApp.api('/admin/discounts', { method: 'POST', body: { action: 'remove', id: b.getAttribute('data-rm') } })
              .then(function () { window.toast('Deleted', 'warn'); paint(); });
          });
        });
      });
    }
    paint();
  };

  /* ===================================================================
     Tables (floor plan)
     =================================================================== */
  Admin.tables = function (host) {
    PosApp.api('/tables').then(function (r) {
      var tbls = r.body.items;
      var STATUS_COLOR = { free: 'var(--pos-success)', seated: 'var(--pos-warn)', occupied: 'var(--pos-danger)', dirty: 'var(--pos-muted-light)' };
      host.innerHTML =
        '<div class="pos-card" style="margin-bottom:14px;">'
        + '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:13px;align-items:center;">'
        +   '<strong>Status legend:</strong>'
        +   Object.keys(STATUS_COLOR).map(function (k) { return '<span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;border-radius:3px;background:' + STATUS_COLOR[k] + ';"></span>' + k + '</span>'; }).join('')
        +   '<span class="pos-text-muted" style="margin-inline-start:auto;font-size:12px;">' + tbls.length + ' tables · ' + tbls.reduce(function (s, t) { return s + (t.capacity || 0); }, 0) + ' seats total</span>'
        + '</div></div>'
        + '<div class="pos-panel">'
        +   '<div class="pos-panel-head"><h3>Floor plan</h3><span class="pos-text-muted" style="font-size:12px;">Click a table to change status</span></div>'
        +   '<div style="position:relative;background:repeating-linear-gradient(0deg,transparent,transparent 39px,var(--pos-line-light) 39px,var(--pos-line-light) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,var(--pos-line-light) 39px,var(--pos-line-light) 40px),var(--pos-bg-light);height:520px;margin:14px;border-radius:8px;">'
        +     tbls.map(function (t) {
                var x = (t.position && t.position.x) || 50;
                var y = (t.position && t.position.y) || 50;
                return '<button data-t="' + t.id + '" class="pos-floor-table" style="position:absolute;left:' + x + 'px;top:' + y + 'px;width:80px;height:80px;border-radius:12px;background:white;border:3px solid ' + (STATUS_COLOR[t.status] || 'var(--pos-line)') + ';color:var(--pos-card-ink);font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:inherit;">'
                  + '<span style="font-size:15px;">' + esc(t.label) + '</span>'
                  + '<span style="font-size:10.5px;color:var(--pos-muted-light);">' + (t.capacity || 0) + ' seats</span>'
                  + '<span style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:' + (STATUS_COLOR[t.status] || 'var(--pos-muted-light)') + ';">' + esc(t.status) + '</span>'
                  + '</button>';
              }).join('')
        +   '</div>'
        + '</div>';
      host.querySelectorAll('[data-t]').forEach(function (b) {
        b.addEventListener('click', function () {
          var t = tbls.find(function (x) { return x.id === b.getAttribute('data-t'); });
          var next = t.status === 'free' ? 'seated' : (t.status === 'seated' ? 'occupied' : (t.status === 'occupied' ? 'dirty' : 'free'));
          PosApp.api('/tables/' + t.id + '/status', { method: 'PUT', body: { status: next } }).then(function () {
            window.toast(t.label + ' → ' + next, 'success'); Admin.tables(host);
          });
        });
      });
    });
  };

  /* ===================================================================
     Staff (RBAC)
     =================================================================== */
  Admin.staff = function (host) {
    function paint() {
      PosApp.api('/admin/staff').then(function (r) {
        var rows = r.body.items;
        var PERMS = {
          cashier: ['Take orders', 'Send to kitchen', 'Take payment', 'View shift'],
          supervisor: ['All cashier permissions', 'Apply discounts > 20%', 'Refund orders', 'Reopen shift'],
          manager: ['All supervisor permissions', 'Edit products / prices', 'Open / close shifts', 'Admin SPA access', 'Edit settings']
        };
        host.innerHTML =
          '<div class="pos-flex" style="margin-bottom:12px;">'
          + '<button class="pos-btn pos-btn--primary" id="st-new" style="margin-inline-start:auto;">+ New staff member</button>'
          + '</div>'
          + '<div class="pos-panel" style="margin-bottom:18px;">'
          +   '<table class="pos-table">'
          +     '<thead><tr><th>Name</th><th>Role</th><th>PIN</th><th></th></tr></thead>'
          +     '<tbody>' + rows.map(function (s) {
                  return '<tr>'
                    + '<td style="font-weight:600;">' + esc(s.name) + '</td>'
                    + '<td><span class="pos-status-chip ' + (s.role === 'manager' ? 'completed' : (s.role === 'supervisor' ? 'served' : 'open')) + '">' + esc(s.role) + '</span></td>'
                    + '<td style="font-family:var(--font-mono);letter-spacing:.2em;">' + esc(s.pin) + '</td>'
                    + '<td><button class="pos-btn" data-st-edit="' + s.id + '" style="padding:5px 10px;min-height:30px;font-size:11px;">Edit</button>'
                    + ' <button class="pos-btn pos-btn--danger" data-st-del="' + s.id + '" style="padding:5px 10px;min-height:30px;font-size:11px;">Delete</button></td>'
                    + '</tr>';
                }).join('')
          +     '</tbody></table>'
          + '</div>'
          + '<div class="pos-card"><h3 style="margin-bottom:10px;">Permission matrix</h3>'
          + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;">'
          +   Object.keys(PERMS).map(function (role) {
                return '<div><div class="pos-kpi-label">' + role + '</div>'
                  + '<ul style="margin:8px 0 0;padding-inline-start:18px;font-size:13px;line-height:1.7;">'
                  + PERMS[role].map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('')
                  + '</ul></div>';
              }).join('')
          + '</div></div>';
        document.getElementById('st-new').addEventListener('click', function () { editStaff(null, paint); });
        host.querySelectorAll('[data-st-edit]').forEach(function (b) {
          b.addEventListener('click', function () { editStaff(rows.find(function (s) { return s.id === b.getAttribute('data-st-edit'); }), paint); });
        });
        host.querySelectorAll('[data-st-del]').forEach(function (b) {
          b.addEventListener('click', function () {
            if (!confirm('Delete this staff member?')) return;
            PosApp.api('/admin/staff/' + b.getAttribute('data-st-del'), { method: 'DELETE' })
              .then(function () { window.toast('Deleted', 'warn'); paint(); });
          });
        });
      });
    }
    paint();
  };
  function editStaff(s, refresh) {
    var isNew = !s;
    var f = s || { name: '', role: 'cashier', pin: String(Math.floor(1000 + Math.random()*9000)) };
    PosApp.showModal({
      title: isNew ? 'New staff member' : 'Edit ' + f.name,
      body:
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
        + '<label class="pos-field"><span>Name</span><input class="pos-input" id="sf-name" value="' + esc(f.name) + '" /></label>'
        + '<label class="pos-field"><span>Role</span><select class="pos-select" id="sf-role">'
        +   ['cashier','supervisor','manager'].map(function (r) { return '<option value="' + r + '"' + (r === f.role ? ' selected' : '') + '>' + r + '</option>'; }).join('')
        + '</select></label>'
        + '<label class="pos-field" style="grid-column:1/-1;"><span>PIN (4 digits)</span><input class="pos-input" id="sf-pin" maxlength="4" value="' + esc(f.pin) + '" /></label>'
        + '</div>',
      foot: '<button class="pos-btn" data-modal-close style="margin-inline-start:auto;">Cancel</button><button class="pos-btn pos-btn--primary" id="sf-save">Save</button>',
      onMount: function (el, close) {
        el.querySelector('#sf-save').addEventListener('click', function () {
          var body = { name: el.querySelector('#sf-name').value.trim(), role: el.querySelector('#sf-role').value, pin: el.querySelector('#sf-pin').value.trim() };
          if (!body.name || !/^\d{4}$/.test(body.pin)) { window.toast('Name + 4-digit PIN required', 'error'); return; }
          var req = isNew ? PosApp.api('/admin/staff', { method: 'POST', body: body }) : PosApp.api('/admin/staff/' + s.id, { method: 'PUT', body: body });
          req.then(function () { window.toast('Saved', 'success'); close(); refresh(); });
        });
      }
    });
  }

  /* ===================================================================
     Shifts
     =================================================================== */
  Admin.shifts = function (host) {
    function paint() {
      Promise.all([PosApp.api('/shifts/current'), PosApp.api('/admin/orders')]).then(function (results) {
        var current = results[0].body.shift;
        var allOrders = results[1].body.items;
        // load all shifts via the seed + storage (re-shape from /shifts/current can't list all, so read POS_DATA directly)
        var allShifts = POS_DATA.SHIFTS.slice().concat(PosApp.jget('pos.shifts.created', [])).reverse();
        var edits = PosApp.jget('pos.shifts.edits', {});
        allShifts = allShifts.map(function (s) { return edits[s.id] ? Object.assign({}, s, edits[s.id]) : s; });

        var since = current ? new Date(current.opened_at) : new Date();
        var liveSales = current ? allOrders.filter(function (o) { return o.status === 'completed' && new Date(o.completed_at || o.created_at) >= since; }) : [];
        var liveCash = liveSales.reduce(function (s, o) { return s + (o.payments || []).filter(function (p) { return p.method === 'cash'; }).reduce(function (a, p) { return a + (p.amount || 0); }, 0); }, 0);
        var liveTotal = liveSales.reduce(function (s, o) { return s + o.total; }, 0);

        host.innerHTML =
          (current
            ? '<div class="pos-card" style="margin-bottom:18px;border-left:4px solid var(--pos-success);">'
              + '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">'
              +   '<div><div class="pos-kpi-label">Current shift</div><h3 style="margin:0;">Opened ' + fmtDt(current.opened_at) + '</h3></div>'
              +   '<div><div class="pos-kpi-label">Opening cash</div><div style="font-family:var(--font-mono);font-weight:700;">' + money(current.opening_count_aed) + '</div></div>'
              +   '<div><div class="pos-kpi-label">Live cash sales</div><div style="font-family:var(--font-mono);font-weight:700;color:var(--pos-success);">' + money(liveCash) + '</div></div>'
              +   '<div><div class="pos-kpi-label">Live total sales</div><div style="font-family:var(--font-mono);font-weight:700;">' + money(liveTotal) + '</div></div>'
              +   '<div><div class="pos-kpi-label">Orders</div><div style="font-family:var(--font-mono);font-weight:700;">' + liveSales.length + '</div></div>'
              +   '<button class="pos-btn pos-btn--danger" id="sh-close" style="margin-inline-start:auto;">Close shift…</button>'
              + '</div></div>'
            : '<div class="pos-card" style="margin-bottom:18px;text-align:center;">'
              + '<p style="margin:0 0 10px;" class="pos-text-muted">No open shift.</p>'
              + '<button class="pos-btn pos-btn--primary" id="sh-open">Open new shift</button>'
              + '</div>')
          + '<div class="pos-panel">'
          +   '<div class="pos-panel-head"><h3>Shift history</h3></div>'
          +   '<table class="pos-table">'
          +     '<thead><tr><th>Opened</th><th>Closed</th><th>Orders</th><th style="text-align:right;">Expected</th><th style="text-align:right;">Counted</th><th style="text-align:right;">Variance</th><th></th></tr></thead>'
          +     '<tbody>' + allShifts.filter(function (s) { return s.closed_at; }).map(function (s) {
                  var v = s.variance || 0;
                  return '<tr>'
                    + '<td>' + fmtDt(s.opened_at) + '</td>'
                    + '<td>' + fmtDt(s.closed_at) + '</td>'
                    + '<td>' + (s.orders_count || 0) + '</td>'
                    + '<td style="text-align:right;font-family:var(--font-mono);">' + money(s.expected_aed) + '</td>'
                    + '<td style="text-align:right;font-family:var(--font-mono);">' + money(s.closing_count_aed) + '</td>'
                    + '<td style="text-align:right;font-family:var(--font-mono);color:' + (Math.abs(v) > 5 ? 'var(--pos-danger)' : 'var(--pos-success)') + ';">' + (v >= 0 ? '+' : '') + money(v) + '</td>'
                    + '<td><button class="pos-btn" data-z="' + s.id + '" style="padding:5px 10px;min-height:30px;font-size:11px;">Z-report</button></td>'
                    + '</tr>';
                }).join('')
          +     '</tbody></table>'
          + '</div>';
        var op = document.getElementById('sh-open');
        if (op) op.addEventListener('click', function () {
          var amt = parseFloat(prompt('Opening cash float (AED)?', '500') || '0');
          PosApp.api('/shifts/open', { method: 'POST', body: { opening_count_aed: amt } }).then(function () { window.toast('Shift opened', 'success'); paint(); });
        });
        var cl = document.getElementById('sh-close');
        if (cl) cl.addEventListener('click', function () { closeShiftModal(current, liveCash, paint); });
        host.querySelectorAll('[data-z]').forEach(function (b) {
          b.addEventListener('click', function () {
            var s = allShifts.find(function (x) { return x.id === b.getAttribute('data-z'); });
            zReport(s);
          });
        });
      });
    }
    paint();
  };
  function closeShiftModal(current, liveCash, refresh) {
    var expected = (current.opening_count_aed || 0) + liveCash;
    PosApp.showModal({
      title: 'Close shift — cash count',
      body:
        '<p class="pos-text-muted" style="font-size:13.5px;margin:0 0 14px;">Count the drawer by denomination. Variance = counted − expected.</p>'
        + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;" id="denom-grid">'
        +   [500,200,100,50,20,10,5,1].map(function (d) {
              return '<label class="pos-field" style="flex-direction:row;align-items:center;gap:8px;"><span style="min-width:60px;flex:0;">' + d + ' AED</span><input class="pos-input" type="number" min="0" data-denom="' + d + '" placeholder="0" /></label>';
            }).join('')
        + '</div>'
        + '<div style="background:var(--pos-bg-light);padding:14px;border-radius:8px;font-family:var(--font-mono);">'
        +   '<div style="display:flex;justify-content:space-between;"><span>Expected:</span><strong id="exp-disp">' + money(expected) + '</strong></div>'
        +   '<div style="display:flex;justify-content:space-between;"><span>Counted:</span><strong id="cnt-disp">' + money(0) + '</strong></div>'
        +   '<div style="display:flex;justify-content:space-between;color:var(--pos-warn);"><span>Variance:</span><strong id="var-disp">' + money(-expected) + '</strong></div>'
        + '</div>',
      foot: '<button class="pos-btn" data-modal-close style="margin-inline-start:auto;">Cancel</button><button class="pos-btn pos-btn--danger" id="sh-confirm">Close shift</button>',
      onMount: function (el, close) {
        function recalc() {
          var sum = 0;
          el.querySelectorAll('[data-denom]').forEach(function (i) { sum += (parseFloat(i.value) || 0) * parseFloat(i.getAttribute('data-denom')); });
          el.querySelector('#cnt-disp').textContent = money(sum);
          var v = sum - expected;
          var vd = el.querySelector('#var-disp');
          vd.textContent = (v >= 0 ? '+' : '') + money(v);
          vd.parentElement.style.color = Math.abs(v) > 5 ? 'var(--pos-danger)' : 'var(--pos-success)';
        }
        el.querySelectorAll('[data-denom]').forEach(function (i) { i.addEventListener('input', recalc); });
        el.querySelector('#sh-confirm').addEventListener('click', function () {
          var sum = 0;
          el.querySelectorAll('[data-denom]').forEach(function (i) { sum += (parseFloat(i.value) || 0) * parseFloat(i.getAttribute('data-denom')); });
          PosApp.api('/shifts/close', { method: 'POST', body: { closing_count_aed: sum } }).then(function (r) {
            window.toast('Shift closed. Variance ' + money(r.body.shift.variance), 'success');
            close(); refresh(); zReport(r.body.shift);
          });
        });
      }
    });
  }
  function zReport(s) {
    PosApp.showModal({
      title: 'Z-Report — shift ' + s.id.slice(-6),
      body:
        '<div style="font-family:var(--font-mono);font-size:13px;line-height:1.7;background:white;padding:18px;border:1px dashed var(--pos-line-light);">'
        + '<div style="text-align:center;font-family:var(--font-display);font-size:18px;font-weight:700;">QAHWA CAFÉ</div>'
        + '<div style="text-align:center;font-size:11px;color:var(--pos-muted-light);">SHIFT Z-REPORT</div>'
        + '<hr style="border:0;border-top:1px dashed var(--pos-line-light);margin:10px 0;" />'
        + '<div style="display:flex;justify-content:space-between;"><span>Opened</span><span>' + fmtDt(s.opened_at) + '</span></div>'
        + '<div style="display:flex;justify-content:space-between;"><span>Closed</span><span>' + fmtDt(s.closed_at) + '</span></div>'
        + '<div style="display:flex;justify-content:space-between;"><span>Closed by</span><span>' + esc(s.closed_by || '—') + '</span></div>'
        + '<hr style="border:0;border-top:1px dashed var(--pos-line-light);margin:10px 0;" />'
        + '<div style="display:flex;justify-content:space-between;"><span>Orders</span><span>' + (s.orders_count || 0) + '</span></div>'
        + '<div style="display:flex;justify-content:space-between;"><span>Payments total</span><span>' + money(s.payments_total || 0) + '</span></div>'
        + '<hr style="border:0;border-top:1px dashed var(--pos-line-light);margin:10px 0;" />'
        + '<div style="display:flex;justify-content:space-between;"><span>Opening cash</span><span>' + money(s.opening_count_aed || 0) + '</span></div>'
        + '<div style="display:flex;justify-content:space-between;"><span>Expected</span><span>' + money(s.expected_aed || 0) + '</span></div>'
        + '<div style="display:flex;justify-content:space-between;"><span>Counted</span><span>' + money(s.closing_count_aed || 0) + '</span></div>'
        + '<div style="display:flex;justify-content:space-between;font-weight:700;color:' + (Math.abs(s.variance || 0) > 5 ? 'var(--pos-danger)' : 'var(--pos-success)') + ';"><span>Variance</span><span>' + ((s.variance || 0) >= 0 ? '+' : '') + money(s.variance || 0) + '</span></div>'
        + '<hr style="border:0;border-top:1px dashed var(--pos-line-light);margin:10px 0;" />'
        + '<div style="text-align:center;font-size:10.5px;color:var(--pos-muted-light);">— END OF SHIFT —</div>'
        + '</div>',
      foot: '<button class="pos-btn" data-modal-close style="margin-inline-start:auto;">Close</button><button class="pos-btn pos-btn--primary" onclick="window.print()">Print</button>'
    });
  }

  /* ===================================================================
     Reports
     =================================================================== */
  Admin.reports = function (host) {
    var state = { days: 7 };
    function paint() {
      PosApp.api('/admin/orders').then(function (r) {
        var rows = r.body.items.filter(function (o) { return o.status === 'completed'; });
        var since = new Date(); since.setHours(0,0,0,0); since.setDate(since.getDate() - (state.days - 1));
        rows = rows.filter(function (o) { return new Date(o.completed_at || o.created_at) >= since; });

        var byDay = {}, byCashier = {}, byProduct = {}, byPayment = {}, byHour = Array(24).fill(0);
        rows.forEach(function (o) {
          var d = new Date(o.completed_at || o.created_at);
          var dk = d.toISOString().slice(0,10);
          byDay[dk] = (byDay[dk] || 0) + o.total;
          byCashier[o.cashier_id] = (byCashier[o.cashier_id] || { count: 0, total: 0 });
          byCashier[o.cashier_id].count++; byCashier[o.cashier_id].total += o.total;
          (o.lines || []).forEach(function (l) {
            byProduct[l.product_id] = (byProduct[l.product_id] || { qty: 0, rev: 0 });
            byProduct[l.product_id].qty += l.qty;
            byProduct[l.product_id].rev += (l.line_total || l.unit_price * l.qty);
          });
          (o.payments || []).forEach(function (p) { byPayment[p.method] = (byPayment[p.method] || 0) + (p.amount || 0); });
          byHour[d.getHours()] += 1;
        });
        var topProducts = Object.keys(byProduct).map(function (id) { var p = window.POS_DATA.PRODUCTS.find(function (x) { return x.id === id; }); return { name: p ? p.name : id, qty: byProduct[id].qty, rev: byProduct[id].rev }; }).sort(function (a, b) { return b.rev - a.rev; });
        var staffMap = {}; window.POS_DATA.STAFF.forEach(function (s) { staffMap[s.id] = s.name; });
        var cashierRows = Object.keys(byCashier).map(function (id) { return { name: staffMap[id] || id, count: byCashier[id].count, total: byCashier[id].total }; }).sort(function (a, b) { return b.total - a.total; });
        var dayKeys = Object.keys(byDay).sort();
        var maxDay = Math.max.apply(null, Object.values(byDay).concat([1]));
        var hourMax = Math.max.apply(null, byHour.concat([1]));
        var totalRev = rows.reduce(function (s, o) { return s + o.total; }, 0);

        host.innerHTML =
          '<div class="pos-flex" style="margin-bottom:14px;align-items:center;">'
          + '<strong>Range:</strong>'
          + [1,7,30,90].map(function (d) { return '<button class="pos-btn ' + (state.days === d ? 'pos-btn--primary' : '') + '" data-days="' + d + '" style="padding:6px 12px;min-height:32px;font-size:12px;">Last ' + d + ' days</button>'; }).join('')
          + '<span class="pos-text-muted" style="margin-inline-start:auto;font-size:12px;">' + rows.length + ' orders · ' + money(totalRev) + '</span>'
          + '<button class="pos-btn" id="rep-csv" style="padding:6px 12px;min-height:32px;font-size:12px;">Export CSV</button>'
          + '</div>'

          + '<div class="pos-card pos-mt-2">'
          +   '<h3 style="margin-bottom:14px;">Daily revenue</h3>'
          +   (dayKeys.length
                ? '<div class="pos-bars">' + dayKeys.map(function (k) { var h = Math.max(6, (byDay[k] / maxDay) * 165); return '<div class="bar" style="height:' + h + 'px;"><span>' + Math.round(byDay[k]) + '</span></div>'; }).join('') + '</div>'
                  + '<div class="pos-bars-labels">' + dayKeys.map(function (k) { return '<span>' + k.slice(5) + '</span>'; }).join('') + '</div>'
                : '<div class="pos-table-empty">No data in range.</div>')
          + '</div>'

          + '<div class="pos-mt-3" style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
          +   '<div class="pos-panel">'
          +     '<div class="pos-panel-head"><h3>Top products</h3></div>'
          +     '<table class="pos-table"><thead><tr><th>Product</th><th style="text-align:right;">Qty</th><th style="text-align:right;">Revenue</th></tr></thead><tbody>'
          +     (topProducts.length ? topProducts.slice(0, 10).map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td style="text-align:right;font-family:var(--font-mono);">' + p.qty + '</td><td style="text-align:right;font-family:var(--font-mono);font-weight:600;">' + money(p.rev) + '</td></tr>'; }).join('') : '<tr><td colspan="3" class="pos-table-empty">—</td></tr>')
          +     '</tbody></table>'
          +   '</div>'
          +   '<div class="pos-panel">'
          +     '<div class="pos-panel-head"><h3>By cashier</h3></div>'
          +     '<table class="pos-table"><thead><tr><th>Cashier</th><th style="text-align:right;">Orders</th><th style="text-align:right;">Revenue</th></tr></thead><tbody>'
          +     (cashierRows.length ? cashierRows.map(function (c) { return '<tr><td>' + esc(c.name) + '</td><td style="text-align:right;font-family:var(--font-mono);">' + c.count + '</td><td style="text-align:right;font-family:var(--font-mono);font-weight:600;">' + money(c.total) + '</td></tr>'; }).join('') : '<tr><td colspan="3" class="pos-table-empty">—</td></tr>')
          +     '</tbody></table>'
          +   '</div>'
          + '</div>'

          + '<div class="pos-mt-3 pos-card">'
          +   '<h3 style="margin-bottom:14px;">Hourly distribution</h3>'
          +   '<div class="pos-heatmap">'
          +     '<div></div>' + byHour.map(function (_, h) { return '<div style="font-size:9.5px;color:var(--pos-muted-light);text-align:center;font-family:var(--font-mono);">' + h + '</div>'; }).join('')
          +     '<div class="pos-heat-day">all</div>'
          +     byHour.map(function (v) {
                  var lvl = '';
                  if (v > 0) { var p = v / hourMax; lvl = p > 0.75 ? 'h-4' : p > 0.5 ? 'h-3' : p > 0.25 ? 'h-2' : 'h-1'; }
                  return '<div class="pos-heat-cell ' + lvl + '" title="' + v + ' orders"></div>';
                }).join('')
          +   '</div>'
          + '</div>'

          + '<div class="pos-mt-3 pos-card">'
          +   '<h3 style="margin-bottom:10px;">Payment methods</h3>'
          +   (Object.keys(byPayment).length
                ? Object.keys(byPayment).map(function (k) {
                    var pct = (byPayment[k] / (totalRev || 1) * 100).toFixed(1);
                    return '<div style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;"><span style="text-transform:capitalize;font-weight:600;">' + esc(k) + '</span><span style="font-family:var(--font-mono);">' + money(byPayment[k]) + ' · ' + pct + '%</span></div><div style="height:8px;background:var(--pos-bg-light);border-radius:4px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:var(--pos-accent);"></div></div></div>';
                  }).join('')
                : '<div class="pos-table-empty">No data.</div>')
          + '</div>';
        host.querySelectorAll('[data-days]').forEach(function (b) {
          b.addEventListener('click', function () { state.days = +b.getAttribute('data-days'); paint(); });
        });
        document.getElementById('rep-csv').addEventListener('click', function () {
          var csv = ['order_no,date,cashier,type,subtotal,vat,discount,total,status'];
          rows.forEach(function (o) {
            csv.push([o.order_no, (o.completed_at || o.created_at), staffMap[o.cashier_id] || '', o.type || '', o.subtotal, o.vat, o.discount || 0, o.total, o.status].join(','));
          });
          var blob = new Blob([csv.join('\n')], { type: 'text/csv' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a'); a.href = url; a.download = 'qahwa-orders-' + new Date().toISOString().slice(0,10) + '.csv'; a.click();
          URL.revokeObjectURL(url);
          window.toast('Exported ' + rows.length + ' orders', 'success');
        });
      });
    }
    paint();
  };

  /* ===================================================================
     Inventory
     =================================================================== */
  Admin.inventory = function (host) {
    function paint() {
      PosApp.api('/inventory').then(function (r) {
        var rows = r.body.items;
        var low = rows.filter(function (i) { return i.on_hand < i.min_qty; });
        host.innerHTML =
          '<div class="pos-kpi-grid" style="margin-bottom:14px;">'
          + '<div class="pos-kpi"><div class="pos-kpi-label">Total SKUs</div><div class="pos-kpi-value">' + rows.length + '</div></div>'
          + '<div class="pos-kpi"><div class="pos-kpi-label">Below min</div><div class="pos-kpi-value" style="color:' + (low.length ? 'var(--pos-danger)' : 'var(--pos-success)') + ';">' + low.length + '</div>' + (low.length ? '<div class="pos-kpi-sub">' + esc(low.map(function (i) { return i.name; }).slice(0, 3).join(', ')) + (low.length > 3 ? '…' : '') + '</div>' : '') + '</div>'
          + '<div class="pos-kpi"><div class="pos-kpi-label">Stock value</div><div class="pos-kpi-value">' + money(rows.reduce(function (s, i) { return s + (i.on_hand * (i.cost_per_unit || 0)); }, 0)) + '</div></div>'
          + '</div>'
          + '<div class="pos-panel">'
          +   '<table class="pos-table">'
          +     '<thead><tr><th>Item</th><th>Unit</th><th style="text-align:right;">On hand</th><th style="text-align:right;">Min</th><th style="text-align:right;">Cost/unit</th><th></th></tr></thead>'
          +     '<tbody>' + rows.map(function (i) {
                  var lo = i.on_hand < i.min_qty;
                  return '<tr' + (lo ? ' style="background:rgba(231,76,60,.05);"' : '') + '>'
                    + '<td style="font-weight:600;">' + esc(i.name) + (lo ? ' <span class="pos-status-chip refunded">LOW</span>' : '') + '</td>'
                    + '<td style="font-size:12px;color:var(--pos-muted-light);">' + esc(i.unit) + '</td>'
                    + '<td style="text-align:right;font-family:var(--font-mono);font-weight:700;">' + i.on_hand + '</td>'
                    + '<td style="text-align:right;font-family:var(--font-mono);color:var(--pos-muted-light);">' + i.min_qty + '</td>'
                    + '<td style="text-align:right;font-family:var(--font-mono);">' + money(i.cost_per_unit || 0) + '</td>'
                    + '<td><button class="pos-btn" data-adj="' + i.id + '" style="padding:5px 10px;min-height:30px;font-size:11px;">Adjust</button></td>'
                    + '</tr>';
                }).join('')
          +     '</tbody></table>'
          + '</div>';
        host.querySelectorAll('[data-adj]').forEach(function (b) {
          b.addEventListener('click', function () {
            var item = rows.find(function (x) { return x.id === b.getAttribute('data-adj'); });
            var n = prompt('Adjust ' + item.name + ' (' + item.unit + '). Current: ' + item.on_hand + '. New value:', item.on_hand);
            if (n === null) return;
            var val = parseFloat(n);
            if (isNaN(val)) { window.toast('Invalid value', 'error'); return; }
            PosApp.api('/inventory/' + item.id + '/adjust', { method: 'POST', body: { on_hand: val, note: 'manual' } })
              .then(function () { window.toast('Updated', 'success'); paint(); });
          });
        });
      });
    }
    paint();
  };

  /* ===================================================================
     Receipt template
     =================================================================== */
  Admin.receipt = function (host) {
    function paint() {
      PosApp.api('/admin/settings').then(function (r) {
        var s = r.body.settings;
        host.innerHTML =
          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start;">'
          + '<div class="pos-card">'
          +   '<h3 style="margin-bottom:14px;">Template fields</h3>'
          +   '<label class="pos-field" style="margin-bottom:10px;"><span>Header (business name)</span><input class="pos-input" id="r-biz" value="' + esc(s.business_name || '') + '" /></label>'
          +   '<label class="pos-field" style="margin-bottom:10px;"><span>Address</span><textarea class="pos-textarea" id="r-addr" rows="2">' + esc(s.address || '') + '</textarea></label>'
          +   '<label class="pos-field" style="margin-bottom:10px;"><span>TRN (Tax Registration Number)</span><input class="pos-input" id="r-trn" value="' + esc(s.trn || '') + '" /></label>'
          +   '<label class="pos-field" style="margin-bottom:10px;"><span>Footer line</span><input class="pos-input" id="r-foot" value="' + esc(s.receipt_footer || 'Thank you for visiting Qahwa Café') + '" /></label>'
          +   '<label class="pos-field" style="margin-bottom:14px;"><span>VAT note</span><input class="pos-input" id="r-vat-note" value="' + esc(s.receipt_vat_note || 'All prices include 5% VAT') + '" /></label>'
          +   '<button class="pos-btn pos-btn--primary" id="r-save">Save template</button>'
          + '</div>'
          + '<div>'
          +   '<div class="pos-kpi-label" style="margin-bottom:8px;">Live preview</div>'
          +   '<div class="pos-receipt-paper" id="r-preview"></div>'
          + '</div>'
          + '</div>';
        function preview() {
          var d = {
            biz: document.getElementById('r-biz').value,
            addr: document.getElementById('r-addr').value,
            trn: document.getElementById('r-trn').value,
            foot: document.getElementById('r-foot').value,
            vat: document.getElementById('r-vat-note').value
          };
          document.getElementById('r-preview').innerHTML =
            '<div class="pos-receipt-head">'
            +   '<h2>' + esc(d.biz) + '</h2>'
            +   '<div class="pos-receipt-meta">' + esc(d.addr).replace(/\n/g, '<br/>') + '</div>'
            +   '<div class="pos-receipt-meta">TRN: ' + esc(d.trn) + '</div>'
            + '</div>'
            + '<div class="pos-receipt-meta" style="margin-bottom:8px;">Order #1024 · 15 May, 14:32 · Amani</div>'
            + '<div class="pos-receipt-line"><span>1× Cappuccino L</span><span>22.00</span></div>'
            + '<div class="pos-receipt-line"><span>1× Croissant</span><span>14.00</span></div>'
            + '<div class="pos-receipt-line"><span>Subtotal</span><span>36.00</span></div>'
            + '<div class="pos-receipt-line"><span>VAT 5%</span><span>1.80</span></div>'
            + '<div class="pos-receipt-line tot"><span>Total</span><span>AED 37.80</span></div>'
            + '<div class="pos-receipt-foot"><div>' + esc(d.foot) + '</div><div>' + esc(d.vat) + '</div></div>';
        }
        ['r-biz','r-addr','r-trn','r-foot','r-vat-note'].forEach(function (id) {
          document.getElementById(id).addEventListener('input', preview);
        });
        document.getElementById('r-save').addEventListener('click', function () {
          PosApp.api('/admin/settings', { method: 'POST', body: {
            business_name: document.getElementById('r-biz').value,
            address: document.getElementById('r-addr').value,
            trn: document.getElementById('r-trn').value,
            receipt_footer: document.getElementById('r-foot').value,
            receipt_vat_note: document.getElementById('r-vat-note').value
          } }).then(function () { window.toast('Receipt template saved', 'success'); });
        });
        preview();
      });
    }
    paint();
  };

  /* ===================================================================
     Settings
     =================================================================== */
  Admin.settings = function (host) {
    function paint() {
      PosApp.api('/admin/settings').then(function (r) {
        var s = r.body.settings;
        host.innerHTML =
          '<div class="pos-card" style="margin-bottom:14px;">'
          + '<h3 style="margin-bottom:14px;">Business</h3>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
          +   '<label class="pos-field"><span>Business name</span><input class="pos-input" id="set-biz" value="' + esc(s.business_name || '') + '" /></label>'
          +   '<label class="pos-field"><span>Currency</span><select class="pos-select" id="set-cur">' + ['AED','USD','EUR','GBP'].map(function (c) { return '<option value="' + c + '"' + (s.currency === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></label>'
          +   '<label class="pos-field"><span>Address</span><input class="pos-input" id="set-addr" value="' + esc(s.address || '') + '" /></label>'
          +   '<label class="pos-field"><span>TRN</span><input class="pos-input" id="set-trn" value="' + esc(s.trn || '') + '" /></label>'
          + '</div></div>'
          + '<div class="pos-card" style="margin-bottom:14px;">'
          + '<h3 style="margin-bottom:14px;">Tax &amp; gratuity</h3>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">'
          +   '<label class="pos-field"><span>VAT %</span><input class="pos-input" id="set-vat" type="number" step="0.5" value="' + (s.vat_pct || 5) + '" /></label>'
          +   '<label class="pos-field"><span>Tax included in prices</span><select class="pos-select" id="set-inc"><option value="false"' + (!s.tax_included ? ' selected' : '') + '>No (added at checkout)</option><option value="true"' + (s.tax_included ? ' selected' : '') + '>Yes</option></select></label>'
          +   '<label class="pos-field"><span>Default gratuity</span><select class="pos-select" id="set-grat">'
          +     ['off','10','12.5','custom'].map(function (v) { return '<option value="' + v + '"' + (String(s.gratuity_default) === v ? ' selected' : '') + '>' + (v === 'off' ? 'Off' : v === 'custom' ? 'Custom' : v + '%') + '</option>'; }).join('')
          +   '</select></label>'
          + '</div></div>'
          + '<div class="pos-card" style="margin-bottom:14px;">'
          + '<h3 style="margin-bottom:14px;">Operations</h3>'
          + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">'
          +   '<label class="pos-field"><span>Opening hours</span><input class="pos-input" id="set-hours" value="' + esc(s.opening_hours || '07:00–22:00') + '" /></label>'
          +   '<label class="pos-field"><span>Default printer name</span><input class="pos-input" id="set-print" value="' + esc(s.printer || 'Star TSP143IIIBI') + '" /></label>'
          + '</div></div>'
          + '<div class="pos-flex">'
          +   '<button class="pos-btn pos-btn--primary" id="set-save">Save settings</button>'
          +   '<button class="pos-btn pos-btn--danger" id="set-reset" style="margin-inline-start:auto;">Reset demo data</button>'
          + '</div>';
        document.getElementById('set-save').addEventListener('click', function () {
          PosApp.api('/admin/settings', { method: 'POST', body: {
            business_name: document.getElementById('set-biz').value,
            currency: document.getElementById('set-cur').value,
            address: document.getElementById('set-addr').value,
            trn: document.getElementById('set-trn').value,
            vat_pct: parseFloat(document.getElementById('set-vat').value),
            tax_included: document.getElementById('set-inc').value === 'true',
            gratuity_default: document.getElementById('set-grat').value,
            opening_hours: document.getElementById('set-hours').value,
            printer: document.getElementById('set-print').value
          } }).then(function () { window.toast('Settings saved', 'success'); });
        });
        document.getElementById('set-reset').addEventListener('click', function () {
          if (!confirm('Wipe all local edits, orders, shifts, products? Seed data will reload.')) return;
          PosApp.api('/admin/reset-demo', { method: 'POST' }).then(function () {
            window.toast('Demo reset', 'warn');
            setTimeout(function () { location.reload(); }, 600);
          });
        });
      });
    }
    paint();
  };

  /* ===================================================================
     Audit log
     =================================================================== */
  Admin.audit = function (host) {
    function paint() {
      PosApp.api('/admin/audit').then(function (r) {
        var rows = r.body.items;
        var staffMap = {}; window.POS_DATA.STAFF.forEach(function (s) { staffMap[s.id] = s.name; });
        host.innerHTML =
          '<div class="pos-flex" style="margin-bottom:12px;">'
          + '<span class="pos-text-muted" style="font-size:13px;">' + rows.length + ' entries</span>'
          + '<button class="pos-btn" id="aud-csv" style="margin-inline-start:auto;padding:6px 12px;min-height:32px;font-size:12px;">Export CSV</button>'
          + '</div>'
          + '<div class="pos-panel">'
          +   '<table class="pos-table">'
          +     '<thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th><th>Details</th></tr></thead>'
          +     '<tbody>' + (rows.length ? rows.map(function (a) {
                  return '<tr>'
                    + '<td style="font-family:var(--font-mono);font-size:12px;">' + fmtDt(a.when) + '</td>'
                    + '<td style="font-size:12.5px;">' + esc(staffMap[a.actor] || a.actor) + '</td>'
                    + '<td style="font-family:var(--font-mono);font-size:12px;color:var(--pos-accent-2);">' + esc(a.action) + '</td>'
                    + '<td style="font-family:var(--font-mono);font-size:12px;">' + esc(a.target) + '</td>'
                    + '<td style="font-size:12.5px;color:var(--pos-muted-light);">' + esc(a.details) + '</td>'
                    + '</tr>';
                }).join('') : '<tr><td colspan="5" class="pos-table-empty">No audit entries yet. Do something in the admin to populate this log.</td></tr>')
          +     '</tbody></table>'
          + '</div>';
        document.getElementById('aud-csv').addEventListener('click', function () {
          var csv = ['when,actor,action,target,details'];
          rows.forEach(function (a) { csv.push([a.when, staffMap[a.actor] || a.actor, a.action, a.target, '"' + (a.details || '').replace(/"/g, '""') + '"'].join(',')); });
          var blob = new Blob([csv.join('\n')], { type: 'text/csv' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a'); a.href = url; a.download = 'qahwa-audit-' + new Date().toISOString().slice(0,10) + '.csv'; a.click();
          URL.revokeObjectURL(url);
          window.toast('Exported ' + rows.length + ' entries', 'success');
        });
      });
    }
    paint();
  };

  window.PosAdmin = Admin;
})();
