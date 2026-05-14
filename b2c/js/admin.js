/* =========================================================
   Pebble & Co. - admin panel shell
   ========================================================= */
(function () {
  'use strict';

  const NAV = [
    { id: 'dashboard',  label: 'Dashboard',  icon: '📊', group: 'main' },
    { id: 'orders',     label: 'Orders',     icon: '📦', group: 'main' },
    { id: 'products',   label: 'Products',   icon: '🏷️',  group: 'main' },
    { id: 'customers',  label: 'Customers',  icon: '👥', group: 'main' },
    { id: 'promotions', label: 'Promotions', icon: '🎁', group: 'main' },
    { id: 'analytics',  label: 'Analytics',  icon: '📈', group: 'reports' },
    { id: 'emaillog',   label: 'Email log',  icon: '✉️', group: 'reports' },
    { id: 'settings',   label: 'Settings',   icon: '⚙️',  group: 'reports' },
  ];

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    renderSidebar();
    document.getElementById('admin-burger').addEventListener('click', () => {
      document.getElementById('admin-sidebar').classList.toggle('open');
    });
    window.addEventListener('hashchange', () => render(currentSection()));
    render(currentSection());

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-demo]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      if (window.toast) window.toast(btn.dataset.demo, 'success');
    });
  }

  function currentSection() {
    const h = (window.location.hash || '#dashboard').replace('#', '');
    return NAV.find(n => n.id === h) ? h : 'dashboard';
  }

  function renderSidebar() {
    const active = currentSection();
    const groups = [
      { label: 'Manage', items: NAV.filter(n => n.group === 'main') },
      { label: 'Insights', items: NAV.filter(n => n.group === 'reports') },
    ];
    document.getElementById('admin-nav').innerHTML = groups.map(g => `
      <div class="admin-nav-group">
        <div class="admin-nav-label">${g.label}</div>
        ${g.items.map(n => `
          <a href="#${n.id}" class="admin-nav-item ${active === n.id ? 'active' : ''}">
            <span class="admin-nav-icon">${n.icon}</span>
            <span>${n.label}</span>
          </a>
        `).join('')}
      </div>
    `).join('');
  }

  async function render(section) {
    renderSidebar();
    document.title = `${cap(section)} - Pebble Admin`;
    const main = document.getElementById('admin-main');
    main.innerHTML = '<div style="padding:60px 0; text-align:center; color:var(--ink-soft);">Loading...</div>';
    main.scrollTop = 0;
    const fn = window.PebbleAdmin && window.PebbleAdmin[section];
    if (typeof fn === 'function') {
      try { await fn(main); }
      catch (e) {
        console.error('admin section error', section, e);
        main.innerHTML = `<div style="padding:24px; color:var(--red);">Section failed to load: ${e.message}</div>`;
      }
    } else {
      main.innerHTML = `<div style="padding:60px 0; text-align:center; color:var(--ink-soft);">Section not implemented</div>`;
    }
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
})();
