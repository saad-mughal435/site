/* notifications.js — Toast stack + bell dropdown for Vacation Homes */
(function () {
  'use strict';

  function getStack() {
    var el = document.querySelector('.v-toast-stack');
    if (!el) {
      el = document.createElement('div');
      el.className = 'v-toast-stack';
      document.body.appendChild(el);
    }
    return el;
  }

  function toast(msg, kind, ms) {
    kind = kind || '';
    ms = ms || 2800;
    var stack = getStack();
    var el = document.createElement('div');
    el.className = 'v-toast ' + kind;
    el.textContent = msg;
    el.style.opacity = '0';
    el.style.transform = 'translateX(20px)';
    el.style.transition = 'opacity .18s ease, transform .18s ease';
    stack.appendChild(el);
    requestAnimationFrame(function () { el.style.opacity = '1'; el.style.transform = 'translateX(0)'; });
    setTimeout(function () {
      el.style.opacity = '0'; el.style.transform = 'translateX(20px)';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
    }, ms);
    return el;
  }
  window.toast = toast;

  function loadNotifications() {
    try { return JSON.parse(localStorage.getItem('vacation.notifications') || '[]'); } catch (e) { return []; }
  }
  function saveNotifications(list) {
    localStorage.setItem('vacation.notifications', JSON.stringify(list || []));
  }
  function seedIfEmpty() {
    var list = loadNotifications();
    if (list.length) return list;
    var now = Date.now();
    list = [
      { id: 'n1', title: 'Welcome to Vacation Homes — demo mode', body: 'All listings and bookings fabricated. Photos via Unsplash.', when: now - 60_000, unread: true },
      { id: 'n2', title: 'New summer promotion live', body: 'DUBAISUMMER25 — 25% off Marina villas, June–August.', when: now - 30 * 60_000, unread: true },
      { id: 'n3', title: 'Your saved search ran', body: '3 new Hatta cabins match your "weekend escape" alert.', when: now - 4 * 60 * 60_000, unread: false }
    ];
    saveNotifications(list);
    return list;
  }

  function relTime(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return s + 's ago';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    return Math.floor(s / 86400) + 'd ago';
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function renderBell(host) {
    if (!host) return;
    var list = seedIfEmpty();
    var unread = list.filter(function (n) { return n.unread; }).length;
    host.innerHTML = ''
      + '<button class="v-pill v-bell" type="button" aria-label="Notifications" data-bell-toggle>'
      +   '🔔' + (unread ? '<span class="v-bell-dot"></span>' : '')
      + '</button>'
      + '<div class="v-bell-panel" data-bell-panel>'
      +   '<div style="display:flex;justify-content:space-between;padding:6px 10px;align-items:center;">'
      +     '<strong style="font-size:13px;">Notifications</strong>'
      +     '<button class="v-pill v-pill--ghost v-btn--sm" data-bell-mark>Mark all read</button>'
      +   '</div>'
      +   list.map(function (n) {
            return '<div class="v-bell-item' + (n.unread ? ' unread' : '') + '">'
              +    '<div>' + escapeHtml(n.title) + '</div>'
              +    '<div class="when">' + escapeHtml(n.body) + ' · ' + relTime(n.when) + '</div>'
              +    '</div>';
          }).join('')
      +   (list.length === 0 ? '<div class="v-empty">No notifications yet.</div>' : '')
      + '</div>';

    var btn = host.querySelector('[data-bell-toggle]');
    var panel = host.querySelector('[data-bell-panel]');
    btn.addEventListener('click', function (e) { e.stopPropagation(); panel.classList.toggle('open'); });
    document.addEventListener('click', function (e) { if (!host.contains(e.target)) panel.classList.remove('open'); });
    host.querySelector('[data-bell-mark]').addEventListener('click', function () {
      var l = loadNotifications().map(function (n) { n.unread = false; return n; });
      saveNotifications(l);
      renderBell(host);
    });
  }

  function pushNotification(title, body) {
    var list = loadNotifications();
    list.unshift({ id: 'n' + Date.now(), title: title, body: body || '', when: Date.now(), unread: true });
    saveNotifications(list.slice(0, 30));
  }

  window.VacationNotifications = { render: renderBell, push: pushNotification, load: loadNotifications, save: saveNotifications };
})();
