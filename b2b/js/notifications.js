/* =========================================================
   Anvil Supply Co. - admin notifications
   ========================================================= */
(function () {
  'use strict';

  const TEMPLATES = [
    () => ({ kind: 'order',    title: 'New order',           body: `PO-${Math.floor(40000 + Math.random()*9999)} from ${pick(COMPANIES)} - $${(800 + Math.random()*4000).toFixed(0)}` }),
    () => ({ kind: 'quote',    title: 'Quote request',       body: `${pick(COMPANIES)} requested pricing on ${1 + Math.floor(Math.random()*6)} line(s)` }),
    () => ({ kind: 'approval', title: 'Order awaiting approval', body: `PO-${Math.floor(40000 + Math.random()*9999)} requires approver action - $${(1200 + Math.random()*5000).toFixed(0)}` }),
    () => ({ kind: 'invoice',  title: 'Invoice overdue',     body: `INV-20${Math.floor(10 + Math.random()*99)} is past Net 30 - ${pick(COMPANIES)}` }),
    () => ({ kind: 'shipment', title: 'Order shipped',       body: `PO-${Math.floor(40000 + Math.random()*9999)} tracking emailed to customer` }),
    () => ({ kind: 'order',    title: 'Recurring order created', body: `Auto-created from schedule for ${pick(COMPANIES)}` }),
  ];
  const COMPANIES = ['Acme Demo Industries', 'Gamma Industrial Demo', 'Beta Sample Mfg.', 'Kilo Demo Maintenance Co.', 'Sigma Placeholder Co.', 'Tau Sample Engineering'];
  function pick(arr) { return arr[Math.floor(Math.random()*arr.length)]; }

  let ticker = null;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    const bell = document.getElementById('admin-bell');
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
      await fetch('/b2b/api/notifications', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action: 'mark_all_read' }) });
      refresh();
    });

    refresh();

    ticker = setInterval(pushDemo, 22000 + Math.random()*14000);
    setTimeout(pushDemo, 9000);
    window.addEventListener('beforeunload', () => { if (ticker) clearInterval(ticker); });
  }

  async function refresh() {
    const { items } = await fetch('/b2b/api/notifications').then(r => r.json());
    const unread = items.filter(n => !n.read).length;
    const badge = document.getElementById('admin-bell-count');
    if (unread > 0) { badge.textContent = unread > 99 ? '99+' : unread; badge.removeAttribute('hidden'); }
    else { badge.setAttribute('hidden', ''); }

    const list = document.getElementById('admin-bell-list');
    if (!items.length) {
      list.innerHTML = '<div class="bell-empty">No notifications yet.</div>';
      return;
    }
    list.innerHTML = items.slice(0, 20).map(n => `
      <div class="bell-item ${n.read ? '' : 'unread'}">
        <div class="bell-icon bell-${n.kind || 'info'}">${iconFor(n.kind)}</div>
        <div>
          <div class="bell-title">${escape(n.title)}</div>
          <div class="bell-text">${escape(n.body || '')}</div>
          <div class="bell-time">${timeAgo(n.at)}</div>
        </div>
      </div>
    `).join('');
  }

  function iconFor(k) {
    return ({ order:'📦', quote:'💬', approval:'⏳', invoice:'🧾', shipment:'🚚', restock:'✓', info:'ℹ' })[k] || 'ℹ';
  }
  function timeAgo(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.round(diff/60) + 'm ago';
    if (diff < 86400) return Math.round(diff/3600) + 'h ago';
    return Math.round(diff/86400) + 'd ago';
  }
  function escape(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  async function pushDemo() {
    const t = TEMPLATES[Math.floor(Math.random()*TEMPLATES.length)]();
    await fetch('/b2b/api/notifications', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ action: 'push', ...t }),
    });
    refresh();
    if (window.toast) window.toast(`${t.title}: ${t.body}`, 'success', 3200);
  }
})();
