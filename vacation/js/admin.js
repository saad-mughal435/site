/* admin.js - Admin SPA shell: sidebar, hash router, topbar */
(function () {
  'use strict';

  var NAV = [
    { group: 'Operate', items: [
      { id: 'dashboard',     icon: '📊', label: 'Dashboard' },
      { id: 'listings',      icon: '🏠', label: 'Listings' },
      { id: 'bookings',      icon: '🗓', label: 'Bookings' },
      { id: 'hosts',         icon: '👤', label: 'Hosts' },
      { id: 'guests',        icon: '👥', label: 'Guests' },
      { id: 'reviews',       icon: '★',  label: 'Reviews' }
    ] },
    { group: 'Finance', items: [
      { id: 'payments',      icon: '💳', label: 'Payments' }
    ] },
    { group: 'Grow', items: [
      { id: 'promotions',    icon: '🎟',  label: 'Promotions' },
      { id: 'destinations',  icon: '📍', label: 'Destinations' }
    ] },
    { group: 'Approvals', items: [
      { id: 'host_approvals',    icon: '🛡',  label: 'Host approvals' },
      { id: 'listing_approvals', icon: '✅', label: 'Listing approvals' }
    ] },
    { group: 'Govern', items: [
      { id: 'settings',      icon: '⚙',  label: 'Settings' },
      { id: 'audit',         icon: '🧾', label: 'Audit log' }
    ] }
  ];

  function current() {
    var h = (location.hash || '#dashboard').slice(1);
    // Backward-compat: the old single `#verifications` route redirects to the
    // new host-approvals area.
    if (h === 'verifications') { location.hash = '#host_approvals'; return 'host_approvals'; }
    return h;
  }

  function renderSide() {
    var cur = current();
    var html = '<div class="brand"><span class="v-logo-mark" style="width:28px;height:28px;font-size:13px;">V</span>Vacation Admin</div>';
    NAV.forEach(function (g) {
      html += '<div class="v-admin-group">' + g.group + '</div>';
      g.items.forEach(function (it) {
        html += '<a class="v-admin-link' + (it.id === cur ? ' active' : '') + '" href="#' + it.id + '"><span>' + it.icon + '</span><span>' + it.label + '</span></a>';
      });
    });
    html += '<div style="margin-top:auto;padding-top:24px;font-size:11px;color:rgba(255,255,255,.4);"><a href="index.html" style="color:rgba(255,255,255,.6);">← Back to Vacation Homes</a></div>';
    document.querySelector('.v-admin-side').innerHTML = html;
  }

  function renderTop() {
    document.querySelector('.v-admin-top').innerHTML = ''
      + '<div style="font-weight:700;font-size:14px;">' + sectionLabel(current()) + '</div>'
      + '<div class="v-admin-search"><input id="admin-q" placeholder="Search bookings, listings, hosts..." /></div>'
      + '<div style="margin-inline-start:auto;display:flex;align-items:center;gap:8px;">'
      +   '<div data-bell-host style="position:relative;display:inline-block;"></div>'
      +   '<div style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:#faf7f0;border-radius:999px;font-size:12px;"><span style="width:24px;height:24px;border-radius:999px;background:var(--vacation-primary);color:white;display:grid;place-items:center;font-weight:700;font-size:10px;">DA</span><span>Demo Admin</span></div>'
      + '</div>';
    if (window.VacationNotifications) window.VacationNotifications.render(document.querySelector('[data-bell-host]'));
  }

  function sectionLabel(id) {
    var found;
    NAV.forEach(function (g) { g.items.forEach(function (it) { if (it.id === id) found = it.label; }); });
    return found || 'Admin';
  }

  function render() {
    renderSide();
    renderTop();
    var host = document.querySelector('.v-admin-content');
    host.innerHTML = '<div class="v-empty">Loading ' + sectionLabel(current()) + '...</div>';
    var fn = window.VacationAdmin && window.VacationAdmin[current()];
    if (typeof fn === 'function') fn(host);
    else host.innerHTML = '<div class="v-empty"><h3>Section not found</h3></div>';
  }

  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', render);
})();
