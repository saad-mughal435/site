/* admin.js - Watad admin SPA shell. Sidebar + hash router. */
(function () {
  'use strict';
  var NAV = [
    { group: 'Operate', items: [
      { id: 'dashboard',     icon: '📊', label: 'Dashboard' },
      { id: 'workorders',    icon: '🛠', label: 'Work orders' }
    ] },
    { group: 'Building', items: [
      { id: 'assets',     icon: '🏢', label: 'Assets' },
      { id: 'points',     icon: '📍', label: 'Points' },
      { id: 'alarms',     icon: '🔔', label: 'Alarms' },
      { id: 'schedules',  icon: '🗓', label: 'Schedules' }
    ] },
    { group: 'Team', items: [
      { id: 'staff', icon: '👤', label: 'Staff' }
    ] },
    { group: 'Intelligence', items: [
      { id: 'ai_console', icon: '✦', label: 'AI Console' }
    ] },
    { group: 'Setup', items: [
      { id: 'integrations', icon: '🔌', label: 'Integrations' },
      { id: 'settings',     icon: '⚙', label: 'Settings' },
      { id: 'audit',        icon: '🗂', label: 'Audit log' }
    ] }
  ];
  function current() { return (location.hash || '#dashboard').slice(1) || 'dashboard'; }
  function label(id) {
    var lbl;
    NAV.forEach(function (g) { g.items.forEach(function (it) { if (it.id === id) lbl = it.label; }); });
    return lbl || 'Admin';
  }
  function renderSide() {
    var cur = current();
    var html = '<a class="wtd-admin-side-brand" href="index.html" style="color:inherit;text-decoration:none;"><span class="mark">W</span> Watad</a>';
    NAV.forEach(function (g) {
      html += '<div class="wtd-admin-group">' + g.group + '</div>';
      g.items.forEach(function (it) {
        html += '<a class="wtd-admin-link' + (it.id === cur ? ' active' : '') + '" href="#' + it.id + '">'
              + '<span>' + it.icon + '</span><span>' + it.label + '</span></a>';
      });
    });
    html += '<div style="margin-top:auto;padding:18px 10px 4px;font-size:11px;color:rgba(230,238,249,.45);">'
          + '<a href="console.html" style="color:var(--wtd-ink);">→ Operations console</a><br/>'
          + '<a href="energy.html" style="color:var(--wtd-ink);">→ Energy dashboard</a><br/>'
          + '<a href="workorders.html" style="color:var(--wtd-ink);">→ Work orders</a></div>';
    document.getElementById('a-side').innerHTML = html;
  }
  function renderTop() {
    var t = document.getElementById('a-top');
    t.innerHTML = ''
      + '<div style="font-weight:700;font-size:15px;">' + WatadApp.escapeHtml(label(current())) + '</div>'
      + '<div style="margin-inline-start:auto;display:flex;align-items:center;gap:10px;">'
      +   '<span class="wtd-mode-badge" id="a-mode">…</span>'
      +   '<span style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:var(--wtd-bg-light-2);border-radius:999px;font-size:12px;">'
      +     '<span style="width:24px;height:24px;border-radius:999px;background:linear-gradient(135deg,var(--wtd-cyan),var(--wtd-green));color:var(--wtd-bg);display:grid;place-items:center;font-weight:700;font-size:10px;">LH</span>'
      +     'Layla Hassan · admin'
      +   '</span>'
      + '</div>';
    WatadAI.health().then(function (h) {
      var el = document.getElementById('a-mode');
      var nm = h.model.indexOf("fast") !== -1 ? 'Fast' : h.model.indexOf("balanced") !== -1 ? 'Balanced' : 'Max';
      el.className = h.live ? 'wtd-mode-badge live' : 'wtd-mode-badge';
      el.textContent = h.live ? 'Live · ' + nm : 'Demo mode';
    });
  }
  function render() {
    renderSide();
    renderTop();
    var host = document.getElementById('a-content');
    host.innerHTML = '<div class="wtd-text-muted" style="padding:60px 20px;text-align:center;">Loading ' + WatadApp.escapeHtml(label(current())) + '…</div>';
    var fn = window.WatadAdmin && window.WatadAdmin[current()];
    if (typeof fn === 'function') fn(host);
    else host.innerHTML = '<div class="wtd-card"><h3>Section not found</h3></div>';
  }
  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', render);
})();
