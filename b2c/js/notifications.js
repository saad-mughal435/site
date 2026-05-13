/* =========================================================
   Pebble & Co. - admin notifications
   Bell dropdown, unread counter, demo event ticker.
   ========================================================= */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', init);

  const EVENT_TEMPLATES = [
    () => ({ kind: 'order',    title: 'New order',           body: `PBL-${Math.floor(11000 + Math.random()*8999)} - $${(40 + Math.random()*220).toFixed(2)}` }),
    () => ({ kind: 'review',   title: 'New 5-star review',   body: `${pick(['Bloom Earbuds','Hush Headphones','Slate Speaker','Ember Mug','Cove Lamp'])} got a fresh review` }),
    () => ({ kind: 'stock',    title: 'Low stock alert',     body: `${pick(['Bloom Earbuds (Coral)','Slate Speaker (Sage)','Ember Mug (Bone)','Drift Tote'])} below 5 units` }),
    () => ({ kind: 'customer', title: 'New customer',        body: `${pick(['Riley','Casey','Jordan','Avery','Sam'])} ${pick(['Demo','Sample','Placeholder'])} signed up` }),
    () => ({ kind: 'cart',     title: 'Abandoned cart',      body: `${pick(['Demo Shopper','Sample Customer','Casey Demo'])} left $${(60 + Math.random()*180).toFixed(2)} in cart` }),
    () => ({ kind: 'refund',   title: 'Refund requested',    body: `Order PBL-${Math.floor(11000 + Math.random()*8999)} - reason: changed mind` }),
  ];
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  let ticker = null;

  function init() {
    const bell  = document.getElementById('admin-bell');
    const panel = document.getElementById('admin-bell-panel');
    if (!bell || !panel) return;

    bell.addEventListener('click', (e) => {
      e.stopPropagation();
      const showing = !panel.hasAttribute('hidden');
      if (showing) panel.setAttribute('hidden', '');
      else { panel.removeAttribute('hidden'); refresh(); }
    });
    document.addEventListener('click', (e) => {
      if (!panel.hasAttribute('hidden') && !panel.contains(e.target) && e.target !== bell) {
        panel.setAttribute('hidden', '');
      }
    });

    document.getElementById('bell-mark-read').addEventListener('click', async () => {
      await fetch('/b2c/api/notifications', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
      refresh();
    });

    refresh();

    // Demo event ticker: occasionally push a fake event so the bell feels alive.
    ticker = setInterval(pushDemoEvent, 22000 + Math.random() * 14000);
    // First demo event after a moment so first-time visitors see the badge tick up.
    setTimeout(pushDemoEvent, 8000);

    window.addEventListener('beforeunload', () => { if (ticker) clearInterval(ticker); });
  }

  async function refresh() {
    const { items } = await fetch('/b2c/api/notifications').then(r => r.json());
    const count = items.filter(n => !n.read).length;
    const badge = document.getElementById('admin-bell-count');
    if (count > 0) { badge.textContent = count > 99 ? '99+' : count; badge.removeAttribute('hidden'); }
    else            { badge.setAttribute('hidden', ''); }

    const list = document.getElementById('admin-bell-list');
    if (!items.length) {
      list.innerHTML = `<div class="bell-empty">No notifications yet.</div>`;
      return;
    }
    list.innerHTML = items.slice(0, 20).map(n => `
      <div class="bell-item ${n.read ? '' : 'unread'}">
        <div class="bell-icon ${'bell-' + (n.kind || 'info')}">${iconFor(n.kind)}</div>
        <div class="bell-body">
          <div class="bell-title">${escape(n.title)}</div>
          <div class="bell-text">${escape(n.body || '')}</div>
          <div class="bell-time">${timeAgo(n.at)}</div>
        </div>
      </div>
    `).join('');
  }

  function iconFor(k) {
    return ({
      order:    '📦',
      review:   '★',
      stock:    '⚠',
      customer: '👤',
      cart:     '🛒',
      refund:   '↩',
      info:     'ℹ',
    })[k] || 'ℹ';
  }

  function timeAgo(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60)    return 'just now';
    if (diff < 3600)  return Math.round(diff / 60) + 'm ago';
    if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
    return Math.round(diff / 86400) + 'd ago';
  }

  function escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function pushDemoEvent() {
    const tmpl = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)]();
    await fetch('/b2c/api/notifications', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'push', ...tmpl }),
    });
    refresh();
    if (window.toast) window.toast(`${tmpl.title}: ${tmpl.body}`, 'success', 3200);
  }
})();
