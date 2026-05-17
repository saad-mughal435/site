/* terminal.js - Cashier touch terminal for Qahwa POS.
   PIN lock, product grid + category tabs, cart pane, modifier modal,
   payment flows (cash/card/split), KOT, hold/void, discount. */
(function () {
  'use strict';
  var D = window.POS_DATA;
  var $ = function (id) { return document.getElementById(id); };
  var esc = PosApp.escapeHtml;
  var fmt = PosApp.fmtMoney;

  var state = {
    pin: '',
    currentCategory: 'cat-coffee',
    search: '',
    order: null,
    products: D.PRODUCTS.filter(function (p) { return p.active; })
  };

  // ---------- PIN lock ----------
  function renderLock() {
    var pad = $('l-keypad');
    var keys = ['1','2','3','4','5','6','7','8','9','del','0','enter'];
    pad.innerHTML = keys.map(function (k) {
      if (k === 'del') return '<button class="pos-key del" data-k="del">⌫</button>';
      if (k === 'enter') return '<button class="pos-key" data-k="enter" style="background:var(--pos-accent);color:var(--pos-bg);">↵</button>';
      if (k === '0') return '<button class="pos-key zero" data-k="0">0</button>';
      return '<button class="pos-key" data-k="' + k + '">' + k + '</button>';
    }).join('');
    pad.querySelectorAll('[data-k]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-k');
        if (k === 'del') state.pin = state.pin.slice(0, -1);
        else if (k === 'enter') return tryLogin();
        else if (state.pin.length < 4) state.pin += k;
        renderPinDisplay();
        if (state.pin.length === 4) setTimeout(tryLogin, 150);
      });
    });
    var pickers = $('l-pickers');
    pickers.innerHTML = D.STAFF.map(function (s) {
      return '<button class="pos-lock-picker" data-pin="' + s.pin + '">' + s.name + ' (' + s.role + ' · ' + s.pin + ')</button>';
    }).join('');
    pickers.querySelectorAll('[data-pin]').forEach(function (b) {
      b.addEventListener('click', function () { state.pin = b.getAttribute('data-pin'); renderPinDisplay(); setTimeout(tryLogin, 200); });
    });
  }
  function renderPinDisplay() { $('l-display').textContent = state.pin.replace(/./g, '·').padEnd(4, '·'); $('l-error').textContent = ''; }
  function tryLogin() {
    PosApp.api('/auth/staff-login', { method: 'POST', body: { pin: state.pin } }).then(function (r) {
      if (r.body.ok) {
        $('lock').style.display = 'none';
        $('terminal').style.display = 'grid';
        $('t-user').textContent = r.body.staff.name + ' · ' + r.body.staff.role;
        state.pin = ''; renderPinDisplay();
        startOrder();
      } else {
        $('l-error').textContent = 'Wrong PIN. Try again.';
        state.pin = ''; renderPinDisplay();
      }
    });
  }
  $('t-logout').addEventListener('click', function () {
    PosApp.api('/auth/logout', { method: 'POST' }).then(function () {
      $('terminal').style.display = 'none'; $('lock').style.display = 'grid';
    });
  });

  // ---------- Categories + products ----------
  function renderCats() {
    var html = D.CATEGORIES.sort(function (a, b) { return a.display_order - b.display_order; }).map(function (c) {
      return '<button class="pos-cat' + (state.currentCategory === c.id ? ' is-active' : '') + '" data-cat="' + c.id + '"><span>' + c.icon + '</span> ' + esc(c.name) + '</button>';
    }).join('');
    $('t-cats').innerHTML = html;
    $('t-cats').querySelectorAll('[data-cat]').forEach(function (b) {
      b.addEventListener('click', function () { state.currentCategory = b.getAttribute('data-cat'); renderCats(); renderProducts(); });
    });
  }
  function renderProducts() {
    var rows = state.products.filter(function (p) { return p.category_id === state.currentCategory; });
    if (state.search) { var q = state.search.toLowerCase(); rows = rows.filter(function (p) { return (p.name + ' ' + p.name_ar).toLowerCase().indexOf(q) !== -1; }); }
    $('t-products').innerHTML = rows.map(function (p) {
      var hasMods = (p.modifier_group_ids || []).length > 0;
      return '<div class="pos-product' + (hasMods ? ' has-modifiers' : '') + '" data-pid="' + p.id + '">'
        + '<div class="pos-product-photo">' + (p.photo ? '<img src="' + esc(p.photo) + '" loading="lazy" alt="">' : '<span class="pos-product-photo-fallback">☕</span>') + '</div>'
        + '<div class="pos-product-body">'
        +   '<div class="pos-product-name">' + esc(p.name) + '</div>'
        +   '<div class="pos-product-price">' + fmt(p.price_aed) + '</div>'
        + '</div></div>';
    }).join('') || '<div class="pos-text-muted" style="padding:24px;text-align:center;">No products in this category.</div>';
    $('t-products').querySelectorAll('[data-pid]').forEach(function (el) {
      el.addEventListener('click', function () { onProductTap(el.getAttribute('data-pid')); });
    });
  }
  $('t-search').addEventListener('input', function (e) { state.search = e.target.value; renderProducts(); });

  // ---------- Modifier modal ----------
  function onProductTap(pid) {
    var p = state.products.find(function (x) { return x.id === pid; });
    if (!p) return;
    var groups = (p.modifier_group_ids || []).map(function (gid) { return D.MODIFIER_GROUPS.find(function (g) { return g.id === gid; }); }).filter(Boolean);
    if (!groups.length) return addLine(p, [], 1);
    openModifierModal(p, groups);
  }
  function openModifierModal(product, groups) {
    var selected = {}; // groupId -> [optionId]
    groups.forEach(function (g) { selected[g.id] = []; });
    function delta() {
      var d = 0;
      groups.forEach(function (g) {
        (selected[g.id] || []).forEach(function (oid) {
          var opt = g.options.find(function (o) { return o.id === oid; });
          if (opt) d += opt.price_delta;
        });
      });
      return d;
    }
    function bodyHtml() {
      return groups.map(function (g) {
        return '<div class="pos-mod-group">'
          + '<h4>' + esc(g.name) + (g.required ? '<span class="pos-mod-group-required">required</span>' : '') + '</h4>'
          + '<div class="pos-mod-options">'
          + g.options.map(function (o) {
              var on_ = (selected[g.id] || []).indexOf(o.id) !== -1;
              return '<button type="button" class="pos-mod-option' + (on_ ? ' is-selected' : '') + '" data-g="' + g.id + '" data-o="' + o.id + '" data-t="' + g.type + '">'
                + '<span>' + esc(o.label) + '</span>'
                + (o.price_delta ? '<span class="pos-mod-option-delta">+' + fmt(o.price_delta) + '</span>' : '')
                + '</button>';
            }).join('')
          + '</div></div>';
      }).join('');
    }
    var mod = PosApp.showModal({
      title: product.name + '  ·  ' + fmt(product.price_aed),
      size: 'lg',
      body: bodyHtml() + '<div style="margin-top:14px;padding:12px 14px;background:var(--pos-bg-2);border-radius:8px;display:flex;justify-content:space-between;align-items:center;"><span>Line total</span><strong id="mm-total" style="font-family:var(--font-mono);color:var(--pos-accent);">' + fmt(product.price_aed) + '</strong></div>',
      foot: '<button class="pos-btn" data-modal-close>Cancel</button><button class="pos-btn pos-btn--primary" id="mm-add">Add to order</button>',
      onMount: function (h, close) {
        function rerender() {
          h.querySelector('.pos-modal-body').innerHTML = bodyHtml() + '<div style="margin-top:14px;padding:12px 14px;background:var(--pos-bg-2);border-radius:8px;display:flex;justify-content:space-between;align-items:center;"><span>Line total</span><strong id="mm-total" style="font-family:var(--font-mono);color:var(--pos-accent);">' + fmt(product.price_aed + delta()) + '</strong></div>';
          wire();
        }
        function wire() {
          h.querySelectorAll('[data-o]').forEach(function (b) {
            b.addEventListener('click', function () {
              var gid = b.getAttribute('data-g'); var oid = b.getAttribute('data-o'); var t = b.getAttribute('data-t');
              if (t === 'single') selected[gid] = [oid];
              else {
                var idx = selected[gid].indexOf(oid);
                if (idx === -1) selected[gid].push(oid); else selected[gid].splice(idx, 1);
              }
              rerender();
            });
          });
        }
        wire();
        h.querySelector('#mm-add').addEventListener('click', function () {
          // Validate required groups
          var missing = groups.filter(function (g) { return g.required && (!selected[g.id] || !selected[g.id].length); });
          if (missing.length) return window.toast('Select: ' + missing.map(function (g) { return g.name; }).join(', '), 'warn');
          var allMods = [];
          Object.keys(selected).forEach(function (gid) { selected[gid].forEach(function (oid) { allMods.push(oid); }); });
          addLine(product, allMods, 1);
          close();
        });
      }
    });
  }

  // ---------- Order state ----------
  // Don't create an order on every page load — that pollutes localStorage and
  // admin views with empty `open` orders. Create lazily on the first product tap.
  function startOrder() {
    state.order = null;
    renderCats(); renderProducts(); renderCart();
  }
  function ensureOrder() {
    if (state.order) return Promise.resolve(state.order);
    return PosApp.api('/orders', { method: 'POST', body: { type: 'takeaway' } }).then(function (r) {
      state.order = r.body.order;
      return state.order;
    });
  }
  function modLabels(modIds) {
    var labels = [];
    modIds.forEach(function (oid) {
      D.MODIFIER_GROUPS.forEach(function (g) {
        var opt = g.options.find(function (o) { return o.id === oid; });
        if (opt) labels.push(opt.label);
      });
    });
    return labels.join(', ');
  }
  function lineUnit(product, modIds) {
    var d = 0;
    modIds.forEach(function (oid) {
      D.MODIFIER_GROUPS.forEach(function (g) {
        var opt = g.options.find(function (o) { return o.id === oid; });
        if (opt) d += opt.price_delta;
      });
    });
    return product.price_aed + d;
  }
  function addLine(product, modIds, qty) {
    ensureOrder().then(function () {
      var unit = lineUnit(product, modIds);
      var line = { id: 'ln-' + Math.random().toString(36).slice(2, 8), product_id: product.id, qty: qty, modifiers: modIds, unit_price: unit, line_total: unit * qty, ready: false };
      return PosApp.api('/orders/' + state.order.id, { method: 'PUT', body: { add_line: line } });
    }).then(function (r) {
      state.order = r.body.order; renderCart();
    });
  }
  function removeLine(lineId) {
    PosApp.api('/orders/' + state.order.id, { method: 'PUT', body: { remove_line: lineId } }).then(function (r) { state.order = r.body.order; renderCart(); });
  }
  function updateQty(lineId, qty) {
    if (qty < 1) return removeLine(lineId);
    PosApp.api('/orders/' + state.order.id, { method: 'PUT', body: { update_qty: { id: lineId, qty: qty } } }).then(function (r) { state.order = r.body.order; renderCart(); });
  }
  function renderCart() {
    var o = state.order;
    if (!o) {
      $('t-order-no').textContent = '—';
      $('t-order-type').textContent = 'Takeaway';
      $('t-order-meta').textContent = '';
      $('t-cart-lines').innerHTML = '<div class="pos-cart-empty"><div class="pos-cart-empty-mark">☕</div>Tap a product to start the order.</div>';
      $('t-subtotal').textContent = fmt(0);
      $('t-vat').textContent = fmt(0);
      $('t-total').textContent = fmt(0);
      $('t-disc-row').style.display = 'none';
      ['t-cash','t-card','t-split','t-discount-btn','t-hold','t-kot','t-void'].forEach(function (id) { $(id).disabled = true; });
      return;
    }
    $('t-order-no').textContent = o.order_no;
    $('t-order-type').textContent = o.type === 'dine-in' ? 'Dine-in · ' + (o.table_id || '') : 'Takeaway';
    $('t-order-meta').textContent = PosApp.fmtTime(o.created_at);
    var linesEl = $('t-cart-lines');
    if (!o.lines || !o.lines.length) {
      linesEl.innerHTML = '<div class="pos-cart-empty"><div class="pos-cart-empty-mark">☕</div>Tap a product to start the order.</div>';
    } else {
      linesEl.innerHTML = o.lines.map(function (l) {
        var p = state.products.find(function (x) { return x.id === l.product_id; });
        return '<div class="pos-cart-line">'
          + '<div class="pos-cart-line-qty"><button data-q="-" data-l="' + l.id + '">−</button><span class="pos-cart-line-qty-val">' + l.qty + '</span><button data-q="+" data-l="' + l.id + '">+</button></div>'
          + '<div class="pos-cart-line-info"><div class="pos-cart-line-name">' + esc(p ? p.name : l.product_id) + '</div>'
          +   (l.modifiers && l.modifiers.length ? '<div class="pos-cart-line-mods">' + esc(modLabels(l.modifiers)) + '</div>' : '')
          + '</div>'
          + '<div class="pos-cart-line-total">' + fmt(l.line_total) + '</div>'
          + '<button class="pos-cart-line-x" data-rm="' + l.id + '">×</button>'
          + '</div>';
      }).join('');
      linesEl.querySelectorAll('[data-q]').forEach(function (b) {
        b.addEventListener('click', function () {
          var l = o.lines.find(function (x) { return x.id === b.getAttribute('data-l'); });
          updateQty(l.id, l.qty + (b.getAttribute('data-q') === '+' ? 1 : -1));
        });
      });
      linesEl.querySelectorAll('[data-rm]').forEach(function (b) { b.addEventListener('click', function () { removeLine(b.getAttribute('data-rm')); }); });
    }
    $('t-subtotal').textContent = fmt(o.subtotal);
    $('t-vat').textContent = fmt(o.vat);
    $('t-total').textContent = fmt(o.total);
    if (o.discount > 0) { $('t-disc-row').style.display = ''; $('t-discount').textContent = '-' + fmt(o.discount); }
    else { $('t-disc-row').style.display = 'none'; }
    var hasLines = o.lines && o.lines.length > 0;
    // Once KOT has been sent the order is in the kitchen pipeline; don't allow
    // double-send. Discount can still be applied to a kitchen-status order.
    var alreadyKot = o.status !== 'open';
    ['t-cash','t-card','t-split','t-discount-btn','t-hold'].forEach(function (id) { $(id).disabled = !hasLines; });
    $('t-kot').disabled = !hasLines || alreadyKot;
    $('t-void').disabled = !hasLines;
    // Surface order status in the type pill so the cashier sees "In kitchen" etc.
    var typeLabel = o.type === 'dine-in' ? 'Dine-in · ' + (o.table_id || '') : 'Takeaway';
    var statusLabel = { kitchen: ' · In kitchen', ready: ' · Ready', served: ' · Served', held: ' · Held' }[o.status] || '';
    $('t-order-type').textContent = typeLabel + statusLabel;
  }

  // ---------- Payment flows ----------
  function payCash() {
    var o = state.order; if (!o) return;
    var entered = '';
    function disp() { return 'AED ' + (entered ? parseFloat(entered).toFixed(2) : '0.00'); }
    function changeStr() { var c = (parseFloat(entered) || 0) - o.total; return c >= 0 ? '+' + fmt(c) + ' change' : '-' + fmt(-c) + ' short'; }
    var m = PosApp.showModal({
      title: 'Cash payment · ' + fmt(o.total),
      body: '<div class="pos-num-label">Tendered amount</div>'
        + '<div class="pos-num-display" id="pn-disp">' + disp() + '</div>'
        + '<div id="pn-change" style="text-align:right;color:var(--pos-success);font-family:var(--font-mono);margin-bottom:8px;min-height:20px;"></div>'
        + '<div class="pos-num" id="pn-pad"></div>'
        + '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;justify-content:flex-end;">'
        +   ['Exact', '50', '100', '200', '500'].map(function (l) { return '<button class="pos-btn pos-btn--ghost" data-quick="' + l + '">' + l + '</button>'; }).join('')
        + '</div>',
      foot: '<button class="pos-btn" data-modal-close>Cancel</button><button class="pos-btn pos-btn--success" id="pn-complete">Complete sale</button>',
      onMount: function (h, close) {
        var keys = ['1','2','3','4','5','6','7','8','9','.','0','del'];
        h.querySelector('#pn-pad').innerHTML = keys.map(function (k) { return '<button data-k="' + k + '">' + (k === 'del' ? '⌫' : k) + '</button>'; }).join('');
        function refresh() {
          h.querySelector('#pn-disp').textContent = disp();
          h.querySelector('#pn-change').textContent = entered ? changeStr() : '';
        }
        h.querySelectorAll('[data-k]').forEach(function (b) {
          b.addEventListener('click', function () {
            var k = b.getAttribute('data-k');
            if (k === 'del') entered = entered.slice(0, -1);
            else if (k === '.' && entered.indexOf('.') !== -1) return;
            else entered += k;
            refresh();
          });
        });
        h.querySelectorAll('[data-quick]').forEach(function (b) {
          b.addEventListener('click', function () {
            var v = b.getAttribute('data-quick');
            entered = v === 'Exact' ? o.total.toFixed(2) : v;
            refresh();
          });
        });
        h.querySelector('#pn-complete').addEventListener('click', function () {
          var amt = parseFloat(entered) || o.total;
          if (amt < o.total) return window.toast('Tendered less than total', 'warn');
          PosApp.api('/orders/' + o.id + '/pay', { method: 'POST', body: { method: 'cash', amount: amt } }).then(function (r) {
            close();
            window.toast('Sale complete · change ' + fmt(r.body.change || 0), 'success', 3000);
            showReceipt(r.body.order, amt);
            startOrder();
          });
        });
      }
    });
  }
  function payCard() {
    var o = state.order; if (!o) return;
    var timers = [];
    var cancelled = false;
    var m = PosApp.showModal({
      title: 'Card payment · ' + fmt(o.total),
      body: '<div style="text-align:center;padding:30px 10px;">'
        + '<div style="font-size:48px;margin-bottom:14px;">💳</div>'
        + '<div id="cd-state" style="font-size:16px;color:var(--pos-ink);">Insert / tap card on reader…</div>'
        + '<div style="margin-top:18px;background:var(--pos-bg-2);height:6px;border-radius:999px;overflow:hidden;"><div id="cd-bar" style="height:100%;background:var(--pos-accent);width:0;transition:width 2.6s linear;"></div></div>'
        + '</div>',
      foot: '<button class="pos-btn" data-modal-close id="cd-cancel">Cancel</button>',
      onMount: function (h, close) {
        timers.push(setTimeout(function () { if (!cancelled) h.querySelector('#cd-bar').style.width = '100%'; }, 50));
        timers.push(setTimeout(function () {
          if (cancelled) return;
          h.querySelector('#cd-state').innerHTML = '<span style="color:var(--pos-success);">✓ Approved</span>';
          timers.push(setTimeout(function () {
            if (cancelled) return;
            PosApp.api('/orders/' + o.id + '/pay', { method: 'POST', body: { method: 'card', amount: o.total } }).then(function (r) {
              if (cancelled) return;
              close();
              window.toast('Card payment approved', 'success');
              showReceipt(r.body.order, o.total);
              startOrder();
            });
          }, 700));
        }, 2700));
        h.querySelector('#cd-cancel').addEventListener('click', function () {
          cancelled = true;
          timers.forEach(function (t) { clearTimeout(t); });
        });
      }
    });
  }
  function paySplit() {
    var o = state.order; if (!o) return;
    var cashAmt = (o.total / 2).toFixed(2);
    var cardAmt = (o.total - parseFloat(cashAmt)).toFixed(2);
    var m = PosApp.showModal({
      title: 'Split payment · ' + fmt(o.total),
      body: '<div class="pos-field"><span>Cash portion (AED)</span><input class="pos-input" id="sp-cash" type="number" step="0.01" value="' + cashAmt + '"/></div>'
        + '<div class="pos-field" style="margin-top:10px;"><span>Card portion (AED)</span><input class="pos-input" id="sp-card" type="number" step="0.01" value="' + cardAmt + '"/></div>'
        + '<div style="margin-top:14px;padding:12px;background:var(--pos-bg-2);border-radius:8px;font-family:var(--font-mono);font-size:13px;" id="sp-sum">Total covered: ' + fmt(parseFloat(cashAmt) + parseFloat(cardAmt)) + ' of ' + fmt(o.total) + '</div>',
      foot: '<button class="pos-btn" data-modal-close>Cancel</button><button class="pos-btn pos-btn--success" id="sp-go">Complete</button>',
      onMount: function (h, close) {
        function refresh() {
          var c = parseFloat(h.querySelector('#sp-cash').value || 0);
          var d = parseFloat(h.querySelector('#sp-card').value || 0);
          h.querySelector('#sp-sum').textContent = 'Total covered: ' + fmt(c + d) + ' of ' + fmt(o.total);
          h.querySelector('#sp-sum').style.color = Math.abs(c + d - o.total) < 0.01 ? 'var(--pos-success)' : 'var(--pos-warn)';
        }
        h.querySelector('#sp-cash').addEventListener('input', refresh);
        h.querySelector('#sp-card').addEventListener('input', refresh);
        h.querySelector('#sp-go').addEventListener('click', function () {
          var c = parseFloat(h.querySelector('#sp-cash').value || 0);
          var d = parseFloat(h.querySelector('#sp-card').value || 0);
          if (Math.abs(c + d - o.total) > 0.01) return window.toast('Amounts must total ' + fmt(o.total), 'warn');
          var payments = [];
          if (c > 0) payments.push({ method: 'cash', amount: c });
          if (d > 0) payments.push({ method: 'card', amount: d });
          PosApp.api('/orders/' + o.id + '/pay', { method: 'POST', body: { payments: payments } }).then(function (r) {
            close(); window.toast('Split payment complete', 'success');
            showReceipt(r.body.order, c + d);
            startOrder();
          });
        });
      }
    });
  }
  function openDiscount() {
    var o = state.order; if (!o) return;
    var presets = [5, 10, 15, 20, 30];
    var m = PosApp.showModal({
      title: 'Apply discount',
      body: '<div class="pos-flex" style="gap:8px;margin-bottom:12px;">'
        + presets.map(function (p) { return '<button class="pos-btn" data-pct="' + p + '">' + p + '% off</button>'; }).join('')
        + '</div>'
        + '<div class="pos-field"><span>Or fixed amount (AED)</span><input class="pos-input" id="dc-amt" type="number" step="0.01" min="0" max="' + o.subtotal + '" value="0"/></div>'
        + '<div class="pos-field" style="margin-top:10px;"><span>Coupon code</span><input class="pos-input" id="dc-code" placeholder="OPENING5 / STAFF20 / NEWBIE10"/></div>',
      foot: '<button class="pos-btn" data-modal-close>Cancel</button><button class="pos-btn pos-btn--ghost" id="dc-clear">Clear</button><button class="pos-btn pos-btn--primary" id="dc-apply">Apply</button>',
      onMount: function (h, close) {
        var amt = 0;
        h.querySelectorAll('[data-pct]').forEach(function (b) {
          b.addEventListener('click', function () { amt = +(o.subtotal * (parseInt(b.getAttribute('data-pct'), 10) / 100)).toFixed(2); apply(); });
        });
        function apply() {
          PosApp.api('/orders/' + o.id, { method: 'PUT', body: { discount: amt } }).then(function (r) {
            state.order = r.body.order; renderCart(); close();
            window.toast('Discount applied: ' + fmt(amt), 'success');
          });
        }
        h.querySelector('#dc-clear').addEventListener('click', function () { amt = 0; apply(); });
        h.querySelector('#dc-apply').addEventListener('click', function () {
          var fixed = parseFloat(h.querySelector('#dc-amt').value || 0);
          var code = (h.querySelector('#dc-code').value || '').toUpperCase().trim();
          if (code) {
            // Pull from API so admin-side edits to discount codes propagate.
            PosApp.api('/discounts').then(function (rr) {
              var discs = (rr.body && rr.body.items) || [];
              var match = discs.find(function (d) { return d.code === code && d.active; });
              if (!match) { window.toast('Invalid or expired code', 'warn'); return; }
              if (match.min_total && o.subtotal < match.min_total) { window.toast('Code requires min spend ' + fmt(match.min_total), 'warn'); return; }
              if (match.type === 'pct' || match.type === 'percent') amt = +(o.subtotal * (match.value / 100)).toFixed(2);
              else if (match.type === 'fixed' || match.type === 'aed') amt = match.value;
              else { window.toast('Code type not supported here', 'warn'); return; }
              window.toast('Code ' + code + ' applied', 'success');
              apply();
            });
            return;
          }
          if (fixed > 0) amt = fixed;
          apply();
        });
      }
    });
  }

  function sendKot() {
    var o = state.order; if (!o || !o.lines.length) return;
    PosApp.api('/orders/' + o.id + '/kot', { method: 'POST' }).then(function () {
      window.toast('🔔 Sent to kitchen', 'success');
      // Keep the cart visible so the cashier can still take payment after KOT
      // (matches the planned end-to-end flow: KOT → KDS preps → terminal pays).
      return PosApp.api('/orders/' + o.id);
    }).then(function (r) {
      if (r && r.body && r.body.order) { state.order = r.body.order; renderCart(); }
    });
  }
  function holdOrder() {
    if (!state.order || !state.order.lines.length) return;
    PosApp.api('/orders/' + state.order.id + '/hold', { method: 'POST' }).then(function () {
      window.toast('Order held', 'success'); startOrder();
    });
  }
  function voidOrder() {
    if (!state.order) return;
    if (!confirm('Void this order? Action will be logged.')) return;
    PosApp.api('/orders/' + state.order.id + '/void', { method: 'POST' }).then(function () {
      window.toast('Order voided', 'warn'); startOrder();
    });
  }

  // ---------- Receipt preview ----------
  function showReceipt(order, tendered) {
    var html = '<div class="pos-receipt-paper" style="background:white;color:#2a1f17;max-width:300px;margin:0 auto;padding:20px;font-family:var(--font-mono);font-size:12.5px;">'
      + '<div style="text-align:center;border-bottom:1px dashed rgba(42,31,23,.18);padding-bottom:10px;margin-bottom:10px;">'
      +   '<div style="font-family:var(--font-display);font-weight:700;font-size:17px;">Qahwa Café</div>'
      +   '<div style="font-size:11px;color:var(--pos-muted-light);">Downtown Dubai · TRN 100000000003</div>'
      + '</div>'
      + '<div style="font-size:11px;color:var(--pos-muted-light);">' + order.order_no + ' · ' + PosApp.fmtDateTime(order.completed_at || order.created_at) + ' · ' + esc(order.type) + '</div>'
      + '<div style="margin-top:8px;">'
      + (order.lines || []).map(function (l) {
          var p = D.PRODUCTS.find(function (x) { return x.id === l.product_id; });
          var mods = (l.modifiers && l.modifiers.length) ? '<div style="font-size:10.5px;color:var(--pos-muted-light);padding-left:8px;">' + esc(modLabels(l.modifiers)) + '</div>' : '';
          return '<div style="display:flex;justify-content:space-between;padding:3px 0;"><span>' + l.qty + 'x ' + esc(p ? p.name : '') + '</span><span>' + fmt(l.line_total) + '</span></div>' + mods;
        }).join('')
      + '</div>'
      + '<div style="margin-top:10px;border-top:1px dashed rgba(42,31,23,.18);padding-top:8px;">'
      +   '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>Subtotal</span><span>' + fmt(order.subtotal) + '</span></div>'
      +   (order.discount ? '<div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--pos-success);"><span>Discount</span><span>-' + fmt(order.discount) + '</span></div>' : '')
      +   '<div style="display:flex;justify-content:space-between;padding:2px 0;"><span>VAT 5%</span><span>' + fmt(order.vat) + '</span></div>'
      +   '<div style="display:flex;justify-content:space-between;padding:6px 0 0;font-weight:800;font-size:15px;"><span>Total</span><span>' + fmt(order.total) + '</span></div>'
      + '</div>'
      + (tendered ? '<div style="display:flex;justify-content:space-between;padding:6px 0 0;font-size:11px;color:var(--pos-muted-light);"><span>Tendered</span><span>' + fmt(tendered) + '</span></div>'
        + '<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:11px;color:var(--pos-muted-light);"><span>Change</span><span>' + fmt(Math.max(0, tendered - order.total)) + '</span></div>' : '')
      + '<div style="text-align:center;margin-top:14px;font-size:11px;color:var(--pos-muted-light);">Thank you. Come back soon. ☕</div>'
      + '</div>';
    PosApp.showModal({
      title: 'Receipt',
      body: html,
      foot: '<button class="pos-btn" data-modal-close>Close</button><button class="pos-btn pos-btn--ghost" id="rc-email">Email</button><button class="pos-btn pos-btn--primary" id="rc-print">Print</button>',
      onMount: function (h, close) {
        h.querySelector('#rc-print').addEventListener('click', function () { window.print(); });
        h.querySelector('#rc-email').addEventListener('click', function () { window.toast('Receipt emailed (demo)', 'success'); });
      }
    });
  }

  // ---------- Wire action buttons ----------
  $('t-cash').addEventListener('click', payCash);
  $('t-card').addEventListener('click', payCard);
  $('t-split').addEventListener('click', paySplit);
  $('t-discount-btn').addEventListener('click', openDiscount);
  $('t-hold').addEventListener('click', holdOrder);
  $('t-void').addEventListener('click', voidOrder);
  $('t-kot').addEventListener('click', sendKot);

  // ---------- Init ----------
  PosApp.api('/auth/me').then(function (r) {
    if (r.body.ok) {
      $('lock').style.display = 'none';
      $('terminal').style.display = 'grid';
      $('t-user').textContent = r.body.staff.name + ' · ' + r.body.staff.role;
      startOrder();
    } else {
      renderLock();
    }
  });
})();
