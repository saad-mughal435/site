/* driver.js — Driver-facing view. Simplified UI showing the current
 * job, route, and complete/handover buttons. Identical state pattern as
 * the dispatcher console but stripped to one driver's queue. */
(function () {
  'use strict';
  var D = window.MARSAD_DATA;
  var esc = MarsadApp.escapeHtml;
  var $ = function (id) { return document.getElementById(id); };

  var driverId = (MarsadApp.qs().driver) || D.DRIVERS[0].id;
  var driver = D.DRIVERS.find(function (d) { return d.id === driverId; }) || D.DRIVERS[0];

  function init() {
    if (window.MarsadSim) window.MarsadSim.start();
    render();
    if (window.MarsadSim) window.MarsadSim.subscribe(function (ev) { if (ev.type === 'tick') render(); });
  }

  function render() {
    MarsadApp.api('/orders?driver=' + encodeURIComponent(driver.id)).then(function (r) {
      var ords = (r.body.items || []).filter(function (o) {
        return ['assigned', 'picked_up', 'in_transit'].indexOf(o.status) !== -1;
      }).sort(function (a, b) { return new Date(a.sla_deadline) - new Date(b.sla_deadline); });
      var current = ords[0];
      var rest = ords.slice(1);
      var doneToday = (r.body.items || []).filter(function (o) {
        if (o.status !== 'delivered' || !o.delivered_at) return false;
        var today = new Date(); today.setHours(0,0,0,0);
        return new Date(o.delivered_at) >= today;
      });
      var earnings = doneToday.length * (D.SETTINGS.rate_per_delivery_aed + D.SETTINGS.incentive_per_delivery_aed);

      var driverSelect = '<select id="driver-pick" class="mrs-input mrs-input--sm" style="margin-left:auto;width:auto;font-size:12px;">'
        + D.DRIVERS.map(function (d) { return '<option value="' + d.id + '"' + (d.id === driver.id ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('')
        + '</select>';

      var currentHtml = current
        ? renderCurrent(current)
        : '<div class="mrs-card" style="text-align:center;color:var(--mrs-muted);padding:30px;">All deliveries complete. Head back to the hub for your next batch.</div>';
      var queueHtml = rest.length
        ? rest.map(renderQueueRow).join('')
        : '<div class="mrs-card" style="text-align:center;color:var(--mrs-muted);padding:20px;font-size:13.5px;">Queue clear.</div>';
      var doneHtml = doneToday.slice(0, 8).map(function (o) {
        return '<div class="mrs-done-row"><span style="color:var(--mrs-mint);">✓</span> ' + esc(o.number) + ' · ' + esc(o.zone_name) + ' · ' + MarsadApp.fmtTime(o.delivered_at) + '</div>';
      }).join('');

      $('app').innerHTML =
          '<div class="mrs-driver-topbar">'
        +   '<div style="display:flex;align-items:center;gap:10px;">'
        +     '<a href="index.html" class="mrs-brand"><span class="mrs-brand-mark">M</span> Marsad</a>'
        +     '<span style="font-size:11.5px;color:var(--mrs-muted);font-family:var(--mrs-mono);">Driver view</span>'
        +   '</div>'
        +   driverSelect
        + '</div>'
        + '<div class="mrs-driver-shell">'
        +   '<div class="mrs-driver-hero">'
        +     '<div style="font-family:var(--mrs-display);font-size:22px;color:var(--mrs-ink);">' + esc(driver.name) + '</div>'
        +     '<div style="font-size:12.5px;color:var(--mrs-muted);">' + esc(driver.shift) + ' shift · ' + esc(driver.phone) + '</div>'
        +     '<div style="display:flex;gap:14px;margin-top:14px;">'
        +       '<div class="mrs-stat-tile"><div class="mrs-stat-v">' + doneToday.length + '</div><div class="mrs-stat-l">Today</div></div>'
        +       '<div class="mrs-stat-tile"><div class="mrs-stat-v">' + ords.length + '</div><div class="mrs-stat-l">Queue</div></div>'
        +       '<div class="mrs-stat-tile"><div class="mrs-stat-v">' + MarsadApp.fmtMoney(earnings) + '</div><div class="mrs-stat-l">Earnings</div></div>'
        +     '</div>'
        +   '</div>'
        +   currentHtml
        +   '<div class="mrs-section-title">Up next (' + rest.length + ')</div>'
        +   queueHtml
        +   '<div class="mrs-section-title">Delivered today (' + doneToday.length + ')</div>'
        +   doneHtml
        + '</div>';

      $('driver-pick').addEventListener('change', function (e) {
        driver = D.DRIVERS.find(function (d) { return d.id === e.target.value; });
        location.search = '?driver=' + driver.id;
      });
      document.querySelectorAll('[data-complete]').forEach(function (b) {
        b.addEventListener('click', function () { completeOrder(b.getAttribute('data-complete')); });
      });
      document.querySelectorAll('[data-handover]').forEach(function (b) {
        b.addEventListener('click', function () { handoverOrder(b.getAttribute('data-handover')); });
      });
    });
  }

  function renderCurrent(o) {
    var slaMin = Math.max(0, Math.round((new Date(o.sla_deadline) - new Date()) / 60000));
    var slaCls = o.sla_breached ? 'breach' : slaMin < 15 ? 'warn' : 'ok';
    return '<div class="mrs-card mrs-card-current">'
      + '<div style="font-size:11px;color:var(--mrs-muted);text-transform:uppercase;letter-spacing:.06em;font-weight:700;">Current delivery</div>'
      + '<h2 style="margin:6px 0 4px;font-family:var(--mrs-display);font-size:22px;">' + esc(o.number) + ' · ' + esc(o.zone_name) + '</h2>'
      + '<div style="font-size:13.5px;color:var(--mrs-ink-2);margin-bottom:8px;">' + esc(o.customer_name) + ' · <a href="tel:' + esc(o.customer_phone) + '" style="color:var(--mrs-coral);">' + esc(o.customer_phone) + '</a></div>'
      + '<div style="font-size:13.5px;color:var(--mrs-ink-2);margin-bottom:10px;">📍 ' + esc(o.address) + '</div>'
      + (o.notes ? '<div style="background:rgba(245,196,81,0.08);border:1px solid rgba(245,196,81,0.3);border-radius:8px;padding:8px 12px;font-size:12.5px;color:var(--mrs-amber);margin-bottom:10px;">📝 ' + esc(o.notes) + '</div>' : '')
      + (o.cod_aed ? '<div class="mrs-cod-pill">Collect COD: <strong>' + MarsadApp.fmtMoney(o.cod_aed) + '</strong></div>' : '')
      + '<div class="mrs-sla-row mrs-sla ' + slaCls + '">' + (o.sla_breached ? '⚠ SLA BREACHED · ' + Math.round((new Date() - new Date(o.sla_deadline)) / 60000) + ' min over' : 'SLA in ' + slaMin + ' min') + '</div>'
      + '<div style="display:flex;gap:8px;margin-top:14px;">'
      +   '<button class="mrs-btn mrs-btn--primary" data-complete="' + esc(o.id) + '" style="flex:1;">✓ Delivered</button>'
      +   '<button class="mrs-btn mrs-btn--ghost" data-handover="' + esc(o.id) + '">Handover</button>'
      + '</div>'
      + '</div>';
  }

  function renderQueueRow(o) {
    return '<div class="mrs-card" style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">'
      + '<div style="font-family:var(--mrs-mono);font-size:11px;color:var(--mrs-muted);">#' + esc(o.number.replace('MAR-', '')) + '</div>'
      + '<div style="flex:1;min-width:0;">'
      +   '<div style="font-size:13.5px;color:var(--mrs-ink);">' + esc(o.zone_name) + ' · ' + esc(o.customer_name) + '</div>'
      +   '<div style="font-size:11.5px;color:var(--mrs-muted);">' + esc(o.address) + '</div>'
      + '</div>'
      + '<div class="mrs-chip ' + MarsadApp.STATUS_COLOR[o.status] + '">' + MarsadApp.STATUS_LABEL[o.status] + '</div>'
      + '</div>';
  }

  function completeOrder(id) {
    MarsadApp.api('/orders/' + encodeURIComponent(id), { method: 'PUT', body: { status: 'delivered', delivered_at: new Date().toISOString() } }).then(function () {
      window.toast('Delivered', 'success');
      if (window.MarsadAudio) window.MarsadAudio.delivered();
      render();
    });
  }
  function handoverOrder(id) {
    MarsadApp.api('/orders/' + encodeURIComponent(id), { method: 'PUT', body: { status: 'pending', driver_id: null } }).then(function () {
      window.toast('Handed back to dispatcher', 'warn');
      render();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
