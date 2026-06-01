/* router.js — Lahza hash router + bottom tab bar.
 * Routes: #today (default), #journal, #insights, #coach, #profile, #compose.
 * Compose is a full-screen modal-style view that overlays the app and has
 * its own back button (handled by views/compose.js). */
(function () {
  'use strict';

  var TABS = [
    { id: 'today',    label: 'Today',    icon: '☀' },
    { id: 'journal',  label: 'Journal',  icon: '📓' },
    { id: 'insights', label: 'Insights', icon: '📈' },
    { id: 'coach',    label: 'Coach',    icon: '✦' },
    { id: 'profile',  label: 'Profile',  icon: '⚙' }
  ];

  function currentRoute() {
    var h = (window.location.hash || '#today').replace('#', '').split('/')[0];
    // 'compose' is an overlay state — render the previously active tab too
    if (h === 'compose') return h;
    return TABS.find(function (t) { return t.id === h; }) ? h : 'today';
  }

  function renderTabbar() {
    var cur = currentRoute();
    var bar = document.getElementById('tabbar');
    if (!bar) return;
    bar.innerHTML = TABS.map(function (t) {
      return '<button class="lz-tab' + (cur === t.id ? ' active' : '') + '" data-route="' + t.id + '">'
        + '<span class="lz-tab-icon">' + t.icon + '</span>'
        + '<span>' + t.label + '</span>'
        + '</button>';
    }).join('');
    bar.querySelectorAll('[data-route]').forEach(function (b) {
      b.addEventListener('click', function () {
        window.location.hash = b.getAttribute('data-route');
      });
    });
  }

  // Per-route chrome rules. The FAB (compose shortcut) is hidden on the coach
  // view (overlaps the send button) and on the compose view (its own UI).
  // The tab bar is hidden on the compose view (full-screen modal).
  var ROUTES_HIDE_FAB    = { compose: true, coach: true };
  var ROUTES_HIDE_TABBAR = { compose: true };

  function setChrome(route) {
    var fab = document.getElementById('fab');
    var bar = document.getElementById('tabbar');
    if (fab) fab.style.display = ROUTES_HIDE_FAB[route]    ? 'none' : '';
    if (bar) bar.style.display = ROUTES_HIDE_TABBAR[route] ? 'none' : '';
  }

  function render() {
    var route = currentRoute();
    var app = document.getElementById('app');
    if (!app) return;
    renderTabbar();
    setChrome(route);
    var V = window.LahzaViews || {};
    if (route === 'compose' && typeof V.compose === 'function') return V.compose(app);
    if (typeof V[route] === 'function') return V[route](app);
    app.innerHTML = '<div class="lz-view"><p style="color:var(--lz-muted);">View "' + route + '" not implemented yet.</p></div>';
  }

  // FAB → compose
  function wireFab() {
    var fab = document.getElementById('fab');
    if (!fab) return;
    fab.addEventListener('click', function () { window.location.hash = 'compose'; });
  }

  // Onboarding gate — shown on first visit
  function onboardingGate(after) {
    var s = window.LahzaApp.jget('lahza.settings', null) || window.LAHZA_DATA.SETTINGS;
    if (s.onboarded) return after();
    if (window.LahzaViews && typeof window.LahzaViews.onboarding === 'function') {
      window.LahzaViews.onboarding(function () {
        s.onboarded = true;
        window.LahzaApp.jset('lahza.settings', s);
        after();
      });
    } else {
      after();
    }
  }

  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', function () {
    wireFab();
    onboardingGate(render);
  });
})();
