/* kitchen.js - Kitchen Display System.
   Polls /orders/kitchen every 5s. Big card layout. Mark individual items
   ready, then mark order all-served. Audio chime on new order. */
(function () {
  'use strict';
  var D = window.POS_DATA;
  var $ = function (id) { return document.getElementById(id); };
  var esc = PosApp.escapeHtml;

  var seenOrderIds = new Set();
  var firstLoad = true;

  function chime() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(); var g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      o.start(); o.stop(ctx.currentTime + 0.42);
    } catch (e) { /* ignore */ }
  }

  function modLabels(modIds) {
    var labels = [];
    (modIds || []).forEach(function (oid) {
      D.MODIFIER_GROUPS.forEach(function (g) {
        var opt = g.options.find(function (o) { return o.id === oid; });
        if (opt) labels.push(opt.label);
      });
    });
    return labels.join(', ');
  }
  function elapsedClass(iso) {
    if (!iso) return '';
    var diff = (Date.now() - new Date(iso).getTime()) / 60000;
    if (diff > 8) return 'is-danger';
    if (diff > 5) return 'is-warn';
    return '';
  }

  function render(orders) {
    orders.sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
    var grid = $('k-grid');
    if (!orders.length) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:80px 20px;color:var(--pos-muted);"><div style="font-size:64px;margin-bottom:14px;">🍳</div><h3>All caught up.</h3><p style="font-size:14px;">No active orders right now.</p></div>';
    } else {
      grid.innerHTML = orders.map(function (o) {
        var allReady = (o.lines || []).every(function (l) { return l.ready; });
        return '<div class="pos-kds-card ' + elapsedClass(o.created_at) + (allReady ? ' is-ready' : '') + '" data-oid="' + o.id + '">'
          + '<div class="pos-kds-card-head">'
          +   '<h4>' + esc(o.order_no) + '</h4>'
          +   '<div class="pos-kds-card-time">' + PosApp.elapsed(o.created_at) + '</div>'
          + '</div>'
          + '<div class="pos-kds-card-meta">' + (o.table_id ? '🪑 Table ' + esc(o.table_id.toUpperCase()) : '🛍 Takeaway') + ' · ' + PosApp.fmtTime(o.created_at) + '</div>'
          + '<div class="pos-kds-card-lines">'
          +   (o.lines || []).map(function (l) {
                var p = D.PRODUCTS.find(function (x) { return x.id === l.product_id; });
                var mods = (l.modifiers && l.modifiers.length) ? '<span class="pos-kds-line-mods">' + esc(modLabels(l.modifiers)) + '</span>' : '';
                return '<div class="pos-kds-line' + (l.ready ? ' is-ready' : '') + '" data-lid="' + l.id + '">'
                  + '<span class="pos-kds-line-qty">' + l.qty + '×</span>'
                  + '<div class="pos-kds-line-name">' + esc(p ? p.name : l.product_id) + mods + '</div>'
                  + '<div class="pos-kds-line-check"></div>'
                  + '</div>';
              }).join('')
          + '</div>'
          + '<div class="pos-kds-card-foot">'
          +   (allReady
                ? '<button class="pos-btn pos-btn--success pos-btn--block" data-served="' + o.id + '">✓ Mark all served</button>'
                : '<button class="pos-btn pos-btn--ghost pos-btn--block" data-all="' + o.id + '">Mark all ready</button>')
          + '</div>'
          + '</div>';
      }).join('');
      grid.querySelectorAll('.pos-kds-line').forEach(function (el) {
        el.addEventListener('click', function () {
          var oid = el.closest('[data-oid]').getAttribute('data-oid');
          var lid = el.getAttribute('data-lid');
          if (el.classList.contains('is-ready')) return;
          PosApp.api('/orders/' + oid + '/item/' + lid + '/ready', { method: 'POST' }).then(poll);
        });
      });
      grid.querySelectorAll('[data-all]').forEach(function (b) {
        b.addEventListener('click', function () {
          PosApp.api('/orders/' + b.getAttribute('data-all') + '/ready', { method: 'POST' }).then(poll);
        });
      });
      grid.querySelectorAll('[data-served]').forEach(function (b) {
        b.addEventListener('click', function () {
          var oid = b.getAttribute('data-served');
          var order = orders.find(function (o) { return o.id === oid; });
          PosApp.api('/orders/' + oid + '/served', { method: 'POST' }).then(function () {
            addToStrip(order);
            poll();
          });
        });
      });
    }
    $('k-active').textContent = orders.length;
  }

  function addToStrip(o) {
    if (!o) return;
    var s = $('k-strip');
    var pill = document.createElement('span');
    pill.className = 'pos-kds-completed-pill';
    pill.textContent = o.order_no + ' · ' + PosApp.fmtTime(o.created_at);
    s.appendChild(pill);
    while (s.querySelectorAll('.pos-kds-completed-pill').length > 15) {
      s.querySelector('.pos-kds-completed-pill').remove();
    }
  }
  function updateClock() {
    var now = new Date();
    $('k-clock').textContent = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  }
  function loadCompletedToday() {
    PosApp.api('/admin/orders?status=completed').then(function (r) {
      var today = new Date(); today.setHours(0,0,0,0);
      var doneToday = (r.body.items || []).filter(function (o) { return new Date(o.completed_at || o.created_at) >= today; });
      $('k-completed').textContent = doneToday.length;
      if (doneToday.length) {
        var sum = doneToday.reduce(function (s, o) {
          if (!o.completed_at) return s;
          return s + (new Date(o.completed_at).getTime() - new Date(o.created_at).getTime());
        }, 0);
        $('k-avg').textContent = Math.round(sum / doneToday.length / 60000) + ' min';
      }
    });
  }
  function poll() {
    PosApp.api('/orders/kitchen').then(function (r) {
      var items = r.body.items || [];
      if (!firstLoad) {
        var newOnes = items.filter(function (o) { return !seenOrderIds.has(o.id); });
        if (newOnes.length) chime();
      }
      items.forEach(function (o) { seenOrderIds.add(o.id); });
      firstLoad = false;
      render(items);
      loadCompletedToday();
    });
  }

  poll();
  setInterval(poll, 5000);
  updateClock();
  setInterval(updateClock, 30000);
})();
