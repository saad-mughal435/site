/* admin.js - Sanad admin SPA shell. Sidebar + hash router + topbar. */
(function () {
  'use strict';
  var NAV = [
    { group: 'Operate', items: [
      { id: 'dashboard',     icon: '📊', label: 'Dashboard' },
      { id: 'conversations', icon: '💬', label: 'Conversations' }
    ] },
    { group: 'Content', items: [
      { id: 'kb',         icon: '📚', label: 'Knowledge base' },
      { id: 'categories', icon: '🏷', label: 'Categories' }
    ] },
    { group: 'People', items: [
      { id: 'agents',     icon: '👤', label: 'Agents' },
      { id: 'customers',  icon: '👥', label: 'Customers' }
    ] },
    { group: 'Intelligence', items: [
      { id: 'ai_console', icon: '✦', label: 'AI Console' },
      { id: 'analytics',  icon: '📈', label: 'Analytics' }
    ] },
    { group: 'Setup', items: [
      { id: 'integrations', icon: '🔗', label: 'Integrations' },
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
    var html = '<a class="snd-admin-side-brand" href="index.html" style="color:inherit;text-decoration:none;"><span class="mark">S</span> Sanad</a>';
    NAV.forEach(function (g) {
      html += '<div class="snd-admin-group">' + g.group + '</div>';
      g.items.forEach(function (it) {
        html += '<a class="snd-admin-link' + (it.id === cur ? ' active' : '') + '" href="#' + it.id + '">'
              + '<span>' + it.icon + '</span><span>' + it.label + '</span></a>';
      });
    });
    html += '<div style="margin-top:auto;padding:18px 10px 4px;font-size:11px;color:rgba(241,245,249,.45);">'
          + '<a href="inbox.html" style="color:var(--snd-ink);">→ Agent inbox</a><br/>'
          + '<a href="chat.html" style="color:var(--snd-ink);">→ Chat widget</a><br/>'
          + '<a href="kb.html" style="color:var(--snd-ink);">→ Knowledge base</a></div>';
    document.getElementById('a-side').innerHTML = html;
  }
  function renderTop() {
    var t = document.getElementById('a-top');
    t.innerHTML = ''
      + '<div style="font-weight:700;font-size:15px;">' + PosAppOrSafeEsc(label(current())) + '</div>'
      + '<div style="margin-inline-start:auto;display:flex;align-items:center;gap:10px;">'
      +   '<span class="snd-mode-badge" id="a-mode">…</span>'
      +   '<span style="display:flex;align-items:center;gap:6px;padding:4px 10px;background:var(--snd-bg-light-2);border-radius:999px;font-size:12px;">'
      +     '<span style="width:22px;height:22px;border-radius:999px;background:linear-gradient(135deg,var(--snd-primary),var(--snd-mint-2));color:white;display:grid;place-items:center;font-weight:700;font-size:10px;">FA</span>'
      +     'Fatima Al-Mazrui · admin'
      +   '</span>'
      + '</div>';
    SanadAI.health().then(function (h) {
      var el = document.getElementById('a-mode');
      var nm = h.model.indexOf('haiku') !== -1 ? 'Haiku 4.5' : h.model.indexOf('sonnet') !== -1 ? 'Sonnet 4.6' : 'Opus 4.7';
      el.className = h.live ? 'snd-mode-badge live' : 'snd-mode-badge';
      el.textContent = h.live ? 'Live · ' + nm : 'Demo mode';
    });
  }
  function PosAppOrSafeEsc(s) { return SanadApp.escapeHtml(s); }
  function render() {
    renderSide();
    renderTop();
    var host = document.getElementById('a-content');
    host.innerHTML = '<div class="snd-text-muted" style="padding:60px 20px;text-align:center;">Loading ' + SanadApp.escapeHtml(label(current())) + '…</div>';
    var fn = window.SanadAdmin && window.SanadAdmin[current()];
    if (typeof fn === 'function') fn(host);
    else host.innerHTML = '<div class="snd-card"><h3>Section coming soon</h3><p class="snd-text-muted">This admin section is being built.</p></div>';
  }
  window.addEventListener('hashchange', render);
  document.addEventListener('DOMContentLoaded', render);
})();
