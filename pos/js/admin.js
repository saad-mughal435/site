/* admin.js - Qahwa POS admin SPA shell. Sidebar + hash router + topbar. */
(function () {
  'use strict';
  var NAV = [
    { group: 'Operate', items: [
      { id: 'dashboard', icon: '📊', label: 'Dashboard' },
      { id: 'orders',    icon: '🧾', label: 'Live orders' }
    ] },
    { group: 'Catalogue', items: [
      { id: 'products',   icon: '☕', label: 'Products' },
      { id: 'categories', icon: '📁', label: 'Categories' },
      { id: 'modifiers',  icon: '🧩', label: 'Modifiers' },
      { id: 'discounts',  icon: '%',  label: 'Discounts' }
    ] },
    { group: 'Floor', items: [
      { id: 'tables', icon: '🪑', label: 'Tables' },
      { id: 'staff',  icon: '👤', label: 'Staff' },
      { id: 'shifts', icon: '⏱',  label: 'Shifts' }
    ] },
    { group: 'Insights', items: [
      { id: 'reports',   icon: '📈', label: 'Reports' },
      { id: 'inventory', icon: '📦', label: 'Inventory' }
    ] },
    { group: 'Govern', items: [
      { id: 'receipt',  icon: '🧻', label: 'Receipt template' },
      { id: 'settings', icon: '⚙',  label: 'Settings' },
      { id: 'audit',    icon: '🗂', label: 'Audit log' }
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
    var html = '<a class="pos-admin-side-brand" href="index.html" style="color:inherit;"><span class="mark">Q</span> Qahwa POS</a>';
    NAV.forEach(function (g) {
      html += '<div class="pos-admin-group">' + g.group + '</div>';
      g.items.forEach(function (it) {
        html += '<a class="pos-admin-link' + (it.id === cur ? ' active' : '') + '" href="#' + it.id + '">'
              + '<span>' + it.icon + '</span><span>' + it.label + '</span></a>';
      });
    });
    html += '<div style="margin-top:auto;padding:18px 10px 4px;font-size:11px;color:rgba(245,235,217,.45);">'
          + '<a href="terminal.html" style="color:var(--pos-cream);">→ Cashier terminal</a><br/>'
          + '<a href="kitchen.html" style="color:var(--pos-cream);">→ Kitchen display</a></div>';
    document.getElementById('a-side').innerHTML = html;
  }
  function renderTop() {
    var t = document.getElementById('a-top');
    t.innerHTML = ''
      + '<div style="font-weight:700;font-size:15px;">' + PosApp.escapeHtml(label(current())) + '</div>'
      + '<div style="margin-inline-start:auto;display:flex;align-items:center;gap:10px;">'
      +   '<span style="font-size:12px;color:var(--pos-muted-light);">Qahwa Café · Downtown Dubai</span>'
      +   '<span style="width:30px;height:30px;border-radius:999px;background:var(--pos-accent);color:var(--pos-bg);display:grid;place-items:center;font-weight:800;font-size:12px;">DA</span>'
      + '</div>';
  }
  function render() {
    renderSide();
    renderTop();
    var host = document.getElementById('a-content');
    host.innerHTML = '<div class="pos-text-muted" style="padding:60px 20px;text-align:center;">Loading ' + PosApp.escapeHtml(label(current())) + '...</div>';
    var fn = window.PosAdmin && window.PosAdmin[current()];
    if (typeof fn === 'function') fn(host);
    else host.innerHTML = '<div class="pos-card"><h3>Section coming soon</h3><p class="pos-text-muted">This admin section is being built.</p></div>';
  }
  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', render);
})();
