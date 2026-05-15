/* admin.js - Admin SPA shell: sidebar, hash router, topbar */
(function () {
  'use strict';

  var NAV = [
    { group: 'Operate', items: [
      { id: 'dashboard',   icon: '📊', label: 'Dashboard' },
      { id: 'listings',    icon: '🏠', label: 'Listings' },
      { id: 'inquiries',   icon: '📨', label: 'Inquiries' },
      { id: 'viewings',    icon: '📅', label: 'Viewings' },
      { id: 'agents',      icon: '👤', label: 'Agents' },
      { id: 'agencies',    icon: '🏢', label: 'Agencies' },
      { id: 'customers',   icon: '👥', label: 'Customers' }
    ] },
    { group: 'Grow', items: [
      { id: 'analytics',   icon: '📈', label: 'Analytics' },
      { id: 'promotions',  icon: '⭐', label: 'Promotions' },
      { id: 'content',     icon: '📝', label: 'Content' }
    ] },
    { group: 'Approvals', items: [
      { id: 'owner_approvals',   icon: '🛡', label: 'Owner approvals' },
      { id: 'listing_approvals', icon: '✅', label: 'Listing approvals' }
    ] },
    { group: 'Govern', items: [
      { id: 'moderation',  icon: '🚩', label: 'Moderation' },
      { id: 'settings',    icon: '⚙',  label: 'Settings' },
      { id: 'audit',       icon: '🧾', label: 'Audit log' }
    ] }
  ];

  function current() {
    var h = (location.hash || '#dashboard').slice(1);
    // Backward-compat — old moderation routes still resolve.
    return h;
  }

  function renderSide() {
    var cur = current();
    var html = ''
      + '<div class="brand"><span class="m-logo-mark" style="width:28px;height:28px;font-size:13px;">م</span>Manzil Admin</div>';
    NAV.forEach(function (g) {
      html += '<div class="m-admin-group">' + g.group + '</div>';
      g.items.forEach(function (it) {
        html += '<a class="m-admin-link' + (it.id === cur ? ' active' : '') + '" href="#' + it.id + '"><span>' + it.icon + '</span><span>' + it.label + '</span></a>';
      });
    });
    html += '<div style="margin-top:auto;padding-top:24px;font-size:11px;color:rgba(255,255,255,.4);"><a href="index.html" style="color:rgba(255,255,255,.6);">← Back to Manzil</a></div>';
    document.querySelector('.m-admin-side').innerHTML = html;
  }

  function renderTop() {
    document.querySelector('.m-admin-top').innerHTML = ''
      + '<div style="font-weight:700;font-size:14px;">' + sectionLabel(current()) + '</div>'
      + '<div class="m-admin-search"><input id="admin-q" placeholder="Search listings, inquiries, agents..." /></div>'
      + '<div style="margin-inline-start:auto;display:flex;align-items:center;gap:8px;">'
      +   '<button class="m-pill m-pill--ghost" onclick="window.print()">🖨 Print</button>'
      +   '<div data-bell-host style="position:relative;display:inline-block;"></div>'
      +   '<div style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:#fafaf6;border-radius:999px;font-size:12px;"><span style="width:24px;height:24px;border-radius:999px;background:var(--manzil-primary);color:white;display:grid;place-items:center;font-weight:700;font-size:10px;">DA</span><span>Demo Admin</span></div>'
      + '</div>';
    if (window.ManzilNotifications) {
      window.ManzilNotifications.render(document.querySelector('[data-bell-host]'));
    }
  }

  function sectionLabel(id) {
    var found;
    NAV.forEach(function (g) { g.items.forEach(function (it) { if (it.id === id) found = it.label; }); });
    return found || 'Admin';
  }

  function render() {
    renderSide();
    renderTop();
    var host = document.querySelector('.m-admin-content');
    host.innerHTML = '<div class="m-empty">Loading ' + sectionLabel(current()) + '...</div>';
    var fn = window.ManzilAdmin && window.ManzilAdmin[current()];
    if (typeof fn === 'function') fn(host);
    else host.innerHTML = '<div class="m-empty"><h3>Section not found</h3></div>';
  }

  window.addEventListener('hashchange', render);
  window.AdminShell = { render: render, current: current };
  document.addEventListener('DOMContentLoaded', render);
})();
