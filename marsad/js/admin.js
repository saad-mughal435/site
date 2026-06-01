/* admin.js — Marsad admin SPA shell. Hash-routed, 9 sections. */
(function () {
  'use strict';
  var NAV = [
    { group: 'Operate',   items: [
      { id: 'dashboard', icon: '📊', label: 'Dashboard' },
      { id: 'orders',    icon: '📦', label: 'Orders' }
    ]},
    { group: 'Fleet',     items: [
      { id: 'drivers',   icon: '🧑‍✈️', label: 'Drivers' },
      { id: 'vehicles',  icon: '🚐', label: 'Vehicles' },
      { id: 'zones',     icon: '🗺',  label: 'Zones' }
    ]},
    { group: 'Setup',     items: [
      { id: 'integrations', icon: '🔌', label: 'Integrations' },
      { id: 'ai_console',   icon: '✦',  label: 'AI Console' },
      { id: 'settings',     icon: '⚙',  label: 'Settings' },
      { id: 'audit',        icon: '🗂', label: 'Audit log' }
    ]}
  ];
  function current() { return (location.hash || '#dashboard').replace('#', '') || 'dashboard'; }
  function label(id) {
    var lbl;
    NAV.forEach(function (g) { g.items.forEach(function (it) { if (it.id === id) lbl = it.label; }); });
    return lbl || 'Admin';
  }
  function renderSide() {
    var cur = current();
    var html = '<a class="mrs-admin-brand" href="index.html"><span class="mrs-brand-mark">M</span> Marsad</a>';
    NAV.forEach(function (g) {
      html += '<div class="mrs-admin-group">' + g.group + '</div>';
      g.items.forEach(function (it) {
        html += '<a class="mrs-admin-link' + (it.id === cur ? ' active' : '') + '" href="#' + it.id + '">'
          + '<span>' + it.icon + '</span><span>' + it.label + '</span></a>';
      });
    });
    html += '<div style="margin-top:auto;padding:16px 10px 4px;font-size:11px;color:rgba(230,238,249,.5);">'
      + '<a href="console.html" style="color:var(--mrs-coral);">→ Dispatcher console</a><br/>'
      + '<a href="driver.html" style="color:var(--mrs-coral);">→ Driver view</a></div>';
    document.getElementById('admin-side').innerHTML = html;
  }
  function renderTop() {
    var t = document.getElementById('admin-top');
    t.innerHTML = '<div style="font-weight:700;font-size:15px;">' + MarsadApp.escapeHtml(label(current())) + '</div>'
      + '<div style="margin-inline-start:auto;display:flex;align-items:center;gap:10px;">'
      +   '<span class="mrs-mode-badge" id="a-mode">…</span>'
      +   '<span style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:var(--mrs-bg-2);border-radius:999px;font-size:12px;color:var(--mrs-ink);">'
      +     '<span style="width:24px;height:24px;border-radius:999px;background:linear-gradient(135deg,var(--mrs-coral),var(--mrs-amber));color:var(--mrs-bg);display:grid;place-items:center;font-weight:700;font-size:10px;">DM</span>'
      +     'Dana Mansour · ops manager'
      +   '</span>'
      + '</div>';
    MarsadAI.health().then(function (h) {
      var el = document.getElementById('a-mode');
      var nm = h.model.indexOf('haiku') !== -1 ? 'Haiku 4.5' : h.model.indexOf('sonnet') !== -1 ? 'Sonnet 4.6' : 'Opus 4.8';
      el.className = h.live ? 'mrs-mode-badge live' : 'mrs-mode-badge';
      el.textContent = h.live ? 'Live · ' + nm : 'Demo mode';
    });
  }
  function render() {
    renderSide(); renderTop();
    var host = document.getElementById('admin-content');
    host.innerHTML = '<div class="mrs-loading"><span></span><span></span><span></span></div>';
    var fn = window.MarsadAdmin && window.MarsadAdmin[current()];
    if (typeof fn === 'function') fn(host);
    else host.innerHTML = '<div class="mrs-card">Section "' + current() + '" not implemented yet.</div>';
  }
  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', function () {
    if (window.MarsadSim && !window.MarsadSim.started) window.MarsadSim.start();
    render();
  });
})();
