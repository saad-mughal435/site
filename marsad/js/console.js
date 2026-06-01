/* console.js — Marsad dispatcher console (centrepiece).
 *
 * Four-region layout:
 *   - Top KPI strip (pending, in-flight, delivered today, SLA breaches, on-time %)
 *   - Map (left ~65%) — vehicles + order pins + hub
 *   - Order queue + driver list (right ~35%) — filter chips, AI batch button
 *   - Bottom AI dispatcher copilot strip — open chat, explain-delay shortcut
 *
 * Subscribes to MarsadSim and diff-renders on tick. Same pattern as the
 * Watad console. */
(function () {
  'use strict';
  var D = window.MARSAD_DATA;
  var esc = MarsadApp.escapeHtml;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    filter: 'active',       // 'active' | 'pending' | 'breach' | 'all'
    selectedOrderId: null,
    selectedDriverId: null
  };
  var seenOrders = new Set();

  // ============ Mode badge ============
  MarsadAI.health().then(function (h) {
    var el = $('mode-badge'); if (!el) return;
    var nm = h.model.indexOf('haiku') !== -1 ? 'Haiku 4.5' : h.model.indexOf('sonnet') !== -1 ? 'Sonnet 4.6' : 'Opus 4.8';
    el.className = h.live ? 'mrs-mode-badge live' : 'mrs-mode-badge';
    el.textContent = h.live ? 'Live · ' + nm : 'Demo mode';
  });

  function init() {
    var map = MarsadMap.init('console-map');
    if (!map) return;
    MarsadMap.placeHub(D.HUB);
    // Initial render
    refresh();

    // Start the sim + subscribe
    if (window.MarsadSim) {
      window.MarsadSim.subscribe(onTick);
      window.MarsadSim.start();
    }

    // Wire filter chips
    document.addEventListener('click', function (e) {
      var chip = e.target.closest('[data-filter]');
      if (!chip) return;
      state.filter = chip.getAttribute('data-filter');
      refresh();
    });

    // Wire AI batch button
    var batchBtn = $('ai-batch');
    if (batchBtn) batchBtn.addEventListener('click', openBatchOptimize);

    // Wire AI chat button
    var chatBtn = $('ai-chat');
    if (chatBtn) chatBtn.addEventListener('click', openDispatcherChat);
  }

  function onTick(ev) {
    if (ev.type === 'tick') {
      refresh();
      // Vehicle marker updates
      Object.values(window.MarsadSim.vehicles).forEach(MarsadMap.updateVehiclePosition);
      // Delivered orders → flip pin colour + chime
      if (ev.delivered && ev.delivered.length) {
        ev.delivered.forEach(function (o) { MarsadMap.updateOrderStatus(o); });
        if (window.MarsadAudio) window.MarsadAudio.delivered();
      }
      if (ev.slaBreached && ev.slaBreached.length) {
        ev.slaBreached.forEach(function (o) {
          window.toast('⚠ SLA breach · ' + o.number + ' (' + o.zone_name + ')', 'error', 4500);
          MarsadMap.updateOrderStatus(o);
        });
        if (window.MarsadAudio) window.MarsadAudio.sla();
      }
    }
  }

  function refresh() {
    Promise.all([
      MarsadApp.api('/orders'),
      MarsadApp.api('/drivers')
    ]).then(function (rs) {
      var ords = rs[0].body.items || [];
      var drs = rs[1].body.items || [];
      renderKpiStrip(ords, drs);
      renderQueue(ords);
      renderDrivers(drs, ords);
      ensureMapOrders(ords);
    });
  }

  function renderKpiStrip(ords, drs) {
    var pending = ords.filter(function (o) { return o.status === 'pending'; }).length;
    var inFlight = ords.filter(function (o) { return ['assigned', 'picked_up', 'in_transit'].indexOf(o.status) !== -1; }).length;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var deliveredToday = ords.filter(function (o) { return o.status === 'delivered' && o.delivered_at && new Date(o.delivered_at) >= today; }).length;
    var breaches = ords.filter(function (o) { return o.sla_breached && o.status !== 'delivered'; }).length;
    var totalActive = pending + inFlight + breaches;
    var onTime = totalActive ? Math.round(100 * (1 - breaches / Math.max(1, totalActive))) : 100;
    var online = drs.filter(function (d) { return d.online; }).length;

    $('kpi-strip').innerHTML =
        kpi('📦', 'Pending', pending, 'awaiting assign', pending > 5 ? 'warn' : 'ok')
      + kpi('🚐', 'In flight', inFlight, 'on the road', 'ok')
      + kpi('✓',  'Delivered today', deliveredToday, 'since 00:00', 'ok')
      + kpi('⚠', 'SLA breaches', breaches, breaches ? 'investigate now' : 'all clear', breaches ? 'danger' : 'ok')
      + kpi('⏱', 'On-time', onTime + '%', 'last 24h', onTime < 90 ? 'warn' : 'ok')
      + kpi('👥', 'Online drivers', online, drs.length + ' total', 'ok');
  }
  function kpi(icon, label, value, sub, kind) {
    return '<div class="mrs-kpi-tile is-' + kind + '">'
      + '<span class="mrs-kpi-icon">' + icon + '</span>'
      + '<div>'
      +   '<div class="mrs-kpi-label">' + esc(label) + '</div>'
      +   '<div class="mrs-kpi-value">' + esc(String(value)) + '</div>'
      +   '<div class="mrs-kpi-sub">' + esc(sub) + '</div>'
      + '</div>'
      + '</div>';
  }

  function renderQueue(ords) {
    var filterFn = {
      pending: function (o) { return o.status === 'pending'; },
      active:  function (o) { return ['pending','assigned','picked_up','in_transit'].indexOf(o.status) !== -1; },
      breach:  function (o) { return o.sla_breached && o.status !== 'delivered'; },
      all:     function (o) { return true; }
    };
    var rows = ords.filter(filterFn[state.filter] || filterFn.active);
    var assetMap = {};
    D.DRIVERS.forEach(function (d) { assetMap[d.id] = d; });

    var chips = ['active', 'pending', 'breach', 'all'].map(function (f) {
      return '<button class="mrs-chip' + (state.filter === f ? ' active' : '') + '" data-filter="' + f + '">' + f + '</button>';
    }).join('');

    var queueHtml = rows.slice(0, 30).map(function (o) {
      var driver = assetMap[o.driver_id];
      var terminal = o.status === 'delivered' || o.status === 'failed';
      var sla = terminal
        ? ''
        : o.sla_breached
          ? '<span class="mrs-sla breach">SLA BREACH</span>'
          : o.sla_warn
            ? '<span class="mrs-sla warn">SLA &lt;10 min</span>'
            : '<span class="mrs-sla">SLA in ' + Math.max(0, Math.round((new Date(o.sla_deadline) - new Date()) / 60000)) + ' min</span>';
      var isNew = !seenOrders.has(o.id);
      seenOrders.add(o.id);
      return '<div class="mrs-order' + (isNew ? ' is-new' : '') + (o.sla_breached ? ' is-breach' : '') + '" data-order-id="' + esc(o.id) + '">'
        + '<div class="mrs-order-status mrs-chip ' + MarsadApp.STATUS_COLOR[o.status] + '">' + MarsadApp.STATUS_LABEL[o.status] + '</div>'
        + '<div class="mrs-order-body">'
        +   '<div class="mrs-order-no">' + esc(o.number) + ' · ' + esc(o.zone_name) + '</div>'
        +   '<div class="mrs-order-cust">' + esc(o.customer_name) + (o.cod_aed ? ' · <strong>COD ' + MarsadApp.fmtMoney(o.cod_aed) + '</strong>' : '') + '</div>'
        +   '<div class="mrs-order-meta">' + (driver ? esc(driver.name) : '<em>unassigned</em>') + (sla ? ' · ' + sla : '') + '</div>'
        + '</div>'
        + '<div class="mrs-order-actions">'
        +   '<button class="mrs-btn mrs-btn--sm" data-act="explain" data-id="' + esc(o.id) + '" aria-label="Explain delay" title="✦ Explain delay">✦</button>'
        +   '<button class="mrs-btn mrs-btn--sm" data-act="locate" data-id="' + esc(o.id) + '" aria-label="Locate on map" title="Locate on map">📍</button>'
        + '</div>'
        + '</div>';
    }).join('');

    $('queue').innerHTML =
        '<div class="mrs-queue-head">'
      +   '<div class="mrs-queue-chips">' + chips + '</div>'
      +   '<button class="mrs-btn mrs-btn--primary mrs-btn--sm" id="ai-batch" title="AI batch-assign pending orders">✦ AI batch-assign</button>'
      + '</div>'
      + '<div class="mrs-queue-list">' + (queueHtml || '<div class="mrs-empty">No orders match.</div>') + '</div>';

    $('queue').querySelectorAll('[data-act="explain"]').forEach(function (b) {
      b.addEventListener('click', function () { explainDelay(b.getAttribute('data-id')); });
    });
    $('queue').querySelectorAll('[data-act="locate"]').forEach(function (b) {
      b.addEventListener('click', function () {
        var o = ords.find(function (x) { return x.id === b.getAttribute('data-id'); });
        if (o) MarsadMap.focusOrder(o);
      });
    });
    $('queue').querySelectorAll('[data-order-id]').forEach(function (row) {
      row.addEventListener('click', function (e) {
        if (e.target.closest('button')) return;
        var oid = row.getAttribute('data-order-id');
        var o = ords.find(function (x) { return x.id === oid; });
        if (o) MarsadMap.focusOrder(o);
      });
    });
    // Re-wire batch button after the queue re-renders
    var batchBtn = $('ai-batch');
    if (batchBtn) batchBtn.addEventListener('click', openBatchOptimize);
  }

  function renderDrivers(drs, ords) {
    var listHtml = drs.slice(0, 16).map(function (d) {
      var queue = ords.filter(function (o) { return o.driver_id === d.id && ['assigned','picked_up','in_transit'].indexOf(o.status) !== -1; }).length;
      return '<div class="mrs-driver" data-driver-id="' + esc(d.id) + '">'
        + '<div class="mrs-driver-avatar">' + esc(initials(d.name)) + '</div>'
        + '<div class="mrs-driver-body">'
        +   '<div class="mrs-driver-name">' + esc(d.name) + '</div>'
        +   '<div class="mrs-driver-meta">' + esc(d.shift) + ' · ' + queue + ' active · ' + d.on_time_pct + '% SLA</div>'
        + '</div>'
        + '<div class="mrs-driver-status mrs-chip ' + d.status + '">' + esc(d.status.replace(/_/g, ' ')) + '</div>'
        + '</div>';
    }).join('');
    $('drivers').innerHTML = listHtml;
    $('drivers').querySelectorAll('[data-driver-id]').forEach(function (row) {
      row.addEventListener('click', function () {
        var did = row.getAttribute('data-driver-id');
        var sim = window.MarsadSim;
        if (!sim) return;
        var veh = Object.values(sim.vehicles).find(function (v) { return v.driver_id === did; });
        if (veh) MarsadMap.focusVehicle(veh);
      });
    });
  }

  function ensureMapOrders(ords) {
    // Place any order not yet on the map; update in place for ones already there.
    ords.forEach(function (o) {
      if (!o.dropoff_lat) return;
      // placeOrder is idempotent — updates icon + popup if already on the map,
      // so an open popup is not torn down on every tick.
      MarsadMap.placeOrder(o);
    });
    // Vehicles are placed/updated idempotently by onTick via
    // MarsadMap.updateVehiclePosition (which self-places on first sight),
    // so we do NOT re-place all vehicles here every refresh.
  }

  function initials(name) {
    return String(name || '?').split(/\s+/).slice(0, 2).map(function (p) { return p[0] || ''; }).join('').toUpperCase();
  }

  // ============ AI modals ============
  function explainDelay(orderId) {
    var order = (window.MarsadSim && window.MarsadSim.orders[orderId]) || D.ORDERS.find(function (o) { return o.id === orderId; });
    if (!order) return;
    var driver = order.driver_id ? D.DRIVERS.find(function (d) { return d.id === order.driver_id; }) : null;
    var modal = MarsadApp.showModal({
      title: '✦ Explain delay · ' + order.number,
      body: '<div class="mrs-ai-panel" id="ai-out"><span class="mrs-ai-loading"></span> <span style="color:var(--mrs-muted);">Reading order state…</span></div>'
        + '<div style="font-size:12px;color:var(--mrs-muted);margin-top:8px;">Order: <strong style="color:var(--mrs-ink);">' + esc(order.number) + '</strong> · ' + esc(order.zone_name) + (driver ? ' · ' + esc(driver.name) : '') + '</div>',
      foot: '<button class="mrs-btn" data-modal-close>Close</button>'
    });
    MarsadAI.explainDelay({ order: order, driver: driver }).then(function (r) {
      var out = modal.el.querySelector('#ai-out');
      if (!out) return;
      out.innerHTML =
          '<h4>✦ AI · ' + (r.fallback ? '<span class="mrs-mode-badge" style="font-size:9.5px;">mock</span>' : '<span class="mrs-mode-badge live" style="font-size:9.5px;">live</span>') + '</h4>'
        + '<div style="white-space:pre-wrap;font-size:13.5px;line-height:1.6;">' + esc(r.text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') + '</div>'
        + '<div style="margin-top:8px;font-size:10.5px;color:var(--mrs-muted);font-family:var(--mrs-mono);">' + esc(r.model || '?') + ' · ' + r.latency_ms + 'ms</div>';
    });
  }

  function openBatchOptimize() {
    MarsadApp.api('/orders?status=pending').then(function (r1) {
      var pending = r1.body.items || [];
      MarsadApp.api('/drivers?status=idle').then(function (r2) {
        var idle = r2.body.items || [];
        var modal = MarsadApp.showModal({
          title: '✦ AI batch-assign',
          size: 'lg',
          body: '<div style="display:flex;gap:14px;font-size:13px;color:var(--mrs-muted);margin-bottom:14px;">'
            + '<span>' + pending.length + ' pending</span>'
            + '<span>' + idle.length + ' idle drivers</span>'
            + '</div>'
            + '<div class="mrs-ai-panel" id="ai-out"><span class="mrs-ai-loading"></span> <span style="color:var(--mrs-muted);">Optimising…</span></div>',
          foot: '<button class="mrs-btn" data-modal-close>Close</button><button class="mrs-btn mrs-btn--primary" id="apply-all">Apply all</button>'
        });
        modal.el.querySelector('#apply-all').addEventListener('click', function () {
          window.toast('Applied · ' + Math.min(pending.length, idle.length * 3) + ' orders assigned (demo)', 'success');
          modal.close();
        });
        MarsadAI.batchOptimize({ pending: pending, drivers: idle }).then(function (r) {
          var out = modal.el.querySelector('#ai-out');
          if (!out) return;
          out.innerHTML =
              '<h4>✦ AI proposal ' + (r.fallback ? '<span class="mrs-mode-badge" style="font-size:9.5px;">mock</span>' : '<span class="mrs-mode-badge live" style="font-size:9.5px;">live</span>') + '</h4>'
            + '<div style="white-space:pre-wrap;font-size:13.5px;line-height:1.55;">' + esc(r.text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') + '</div>';
        });
      });
    });
  }

  function openDispatcherChat() {
    MarsadApp.showModal({
      title: '✦ Dispatcher copilot',
      size: 'lg',
      body: '<div id="chat-thread" style="max-height:50vh;overflow:auto;padding:8px 0;font-size:14px;line-height:1.6;color:var(--mrs-ink-2);"></div>'
        + '<div style="display:flex;gap:8px;margin-top:10px;">'
        + '  <input class="mrs-input" id="chat-input" placeholder="Ask Marsad — try \'fuel\', \'idle drivers\', \'sla\'…" style="flex:1;"/>'
        + '  <button class="mrs-btn mrs-btn--primary" id="chat-send" aria-label="Send" title="Send">↑</button>'
        + '</div>'
        + '<div style="margin-top:8px;font-size:11px;color:var(--mrs-muted);">Try: <em>"any breaches?"</em>, <em>"who has spare capacity?"</em>, <em>"fuel below 25%?"</em></div>',
      foot: '<button class="mrs-btn" data-modal-close>Close</button>',
      onMount: function (el, close) {
        var thread = el.querySelector('#chat-thread');
        var input = el.querySelector('#chat-input');
        var send = el.querySelector('#chat-send');
        var history = [];

        function snapshotState() {
          var kpis = {};
          Promise.resolve();
          return MarsadApp.api('/admin/dashboard').then(function (r) { return r.body.kpis; });
        }
        function append(role, content, meta) {
          var div = document.createElement('div');
          div.className = 'mrs-chat-msg ' + (role === 'user' ? 'out' : '');
          var bubble = '<div class="mrs-chat-bubble">' + esc(content).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>') + '</div>';
          var metaBit = meta ? '<div style="font-size:10px;color:var(--mrs-muted);font-family:var(--mrs-mono);margin-top:4px;">' + esc(meta) + '</div>' : '';
          if (role === 'user') {
            div.innerHTML = bubble + '<div class="mrs-msg-avatar">You</div>';
          } else {
            div.innerHTML = '<div class="mrs-msg-avatar">M</div><div style="min-width:0;flex:1;">' + bubble + metaBit + '</div>';
          }
          thread.appendChild(div);
          thread.scrollTop = thread.scrollHeight;
        }

        function go() {
          var q = (input.value || '').trim();
          if (!q) return;
          input.value = '';
          append('user', q);
          history.push({ role: 'user', content: q });
          var typing = document.createElement('div');
          typing.className = 'mrs-chat-msg';
          typing.innerHTML = '<div class="mrs-msg-avatar">M</div><div class="mrs-chat-bubble" style="font-size:13px;color:var(--mrs-muted);">…</div>';
          thread.appendChild(typing);
          snapshotState().then(function (state) {
            MarsadAI.dispatcherChat({ question: q, history: history.slice(-6), state: state }).then(function (r) {
              typing.remove();
              append('assistant', r.text, r.model + ' · ' + r.latency_ms + 'ms' + (r.fallback ? ' · mock' : ''));
              history.push({ role: 'assistant', content: r.text });
            });
          });
        }

        send.addEventListener('click', go);
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); go(); } });
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
