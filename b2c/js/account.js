/* =========================================================
   Pebble & Co. - customer account page
   ========================================================= */
(function () {
  'use strict';

  const TABS = [
    { id: 'orders',    label: 'Orders',    icon: '📦' },
    { id: 'wishlist',  label: 'Wishlist',  icon: '♡' },
    { id: 'addresses', label: 'Addresses', icon: '📍' },
    { id: 'profile',   label: 'Profile',   icon: '👤' },
    { id: 'loyalty',   label: 'Loyalty',   icon: '⭐' },
  ];

  let user = null;

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    user = await fetch('/b2c/api/account').then(r => r.json());
    document.getElementById('acct-greeting').textContent =
      `Welcome back, ${user.name.split(' ')[0]}. You have ${user.points || 0} loyalty points.`;

    renderTabs();

    document.getElementById('acct-logout').addEventListener('click', () => {
      window.toast('Signed out (demo - you stay signed in)', 'success');
    });

    window.addEventListener('hashchange', () => render(currentTab()));
    render(currentTab());
  }

  function currentTab() {
    const h = (window.location.hash || '#orders').replace('#', '');
    return TABS.find(t => t.id === h) ? h : 'orders';
  }

  function renderTabs() {
    const active = currentTab();
    document.getElementById('acct-tabs').innerHTML = TABS.map(t => `
      <a href="#${t.id}" class="acct-tab ${active === t.id ? 'active' : ''}" data-tab="${t.id}">
        <span class="acct-tab-icon">${t.icon}</span> ${t.label}
      </a>
    `).join('');
  }

  function render(tab) {
    renderTabs();
    const host = document.getElementById('acct-main');
    host.innerHTML = '<div style="padding:40px 0; text-align:center; color:var(--ink-soft);">Loading...</div>';
    if (tab === 'orders')    return renderOrders(host);
    if (tab === 'wishlist')  return renderWishlist(host);
    if (tab === 'addresses') return renderAddresses(host);
    if (tab === 'profile')   return renderProfile(host);
    if (tab === 'loyalty')   return renderLoyalty(host);
  }

  async function renderOrders(host) {
    const { items } = await fetch('/b2c/api/orders').then(r => r.json());
    if (!items.length) {
      host.innerHTML = panel('Orders', `<p class="acct-empty">No orders yet. <a href="products.html" class="btn-link">Start shopping &rarr;</a></p>`);
      return;
    }
    host.innerHTML = panel('Orders', `
      <div class="orders-table">
        <div class="orders-row orders-head">
          <div>Order</div><div>Date</div><div>Status</div><div>Total</div><div></div>
        </div>
        ${items.map(o => `
          <div class="orders-row" data-order="${o.number || o.id}">
            <div><strong>${o.number || o.id}</strong></div>
            <div>${new Date(o.placed_at).toLocaleDateString()}</div>
            <div><span class="badge ${statusBadge(o.status)}">${o.status}</span></div>
            <div>${window.formatMoney(o.total)}</div>
            <div><button class="btn-link" data-view>View</button></div>
          </div>
        `).join('')}
      </div>
    `);
    host.querySelectorAll('[data-order]').forEach(row => {
      row.querySelector('[data-view]').addEventListener('click', () => openOrder(row.dataset.order));
    });
  }

  function statusBadge(s) {
    return s === 'paid' || s === 'completed' ? 'badge-green'
         : s === 'shipped' ? 'badge-sage'
         : s === 'cancelled' || s === 'refunded' ? 'badge-red'
         : 'badge-amber';
  }

  async function openOrder(id) {
    const o = await fetch('/b2c/api/orders/' + encodeURIComponent(id)).then(r => r.ok ? r.json() : null);
    if (!o) return window.toast('Order not found', 'error');
    showModal(`Order ${o.number || o.id}`, `
      <div style="margin-bottom:14px; color:var(--ink-soft); font-size:13.5px;">
        Placed ${new Date(o.placed_at).toLocaleString()} &middot;
        <span class="badge ${statusBadge(o.status)}">${o.status}</span>
      </div>
      <div class="success-lines" style="margin-bottom:18px;">
        ${o.lines.map(l => `
          <div class="success-line">
            <div class="success-line-image">${l.product ? window.makeProductSvg(l.product, { k: 0 }) : ''}<span>${l.qty}</span></div>
            <div class="success-line-body">
              <div class="success-line-name">${l.product_name || l.product?.name || 'Item'}</div>
              ${l.variant_name ? `<div class="success-line-variant">${l.variant_name}</div>` : ''}
            </div>
            <div class="success-line-price">${window.formatMoney(l.line_total)}</div>
          </div>
        `).join('')}
      </div>
      <div class="summary-row"><span>Subtotal</span><span>${window.formatMoney(o.subtotal)}</span></div>
      ${o.discount > 0 ? `<div class="summary-row discount"><span>Discount</span><span>- ${window.formatMoney(o.discount)}</span></div>` : ''}
      <div class="summary-row"><span>Shipping</span><span>${(o.shipping_cost ?? o.shipping) === 0 ? 'Free' : window.formatMoney(o.shipping_cost ?? o.shipping)}</span></div>
      <div class="summary-row"><span>Tax</span><span>${window.formatMoney(o.tax)}</span></div>
      <div class="summary-row total"><span>Total</span><span>${window.formatMoney(o.total)}</span></div>
    `);
  }

  async function renderWishlist(host) {
    const { items } = await fetch('/b2c/api/wishlist').then(r => r.json());
    if (!items.length) {
      host.innerHTML = panel('Wishlist', `<p class="acct-empty">Nothing saved yet. Tap the heart on any product to keep it for later.</p>`);
      return;
    }
    host.innerHTML = panel('Wishlist', `
      <div class="product-grid" style="margin-top:6px;">
        ${items.map((p, k) => `
          <a href="product.html?id=${p.id}" class="product-card">
            <div class="product-image"><div class="product-image-svg">${window.makeProductSvg(p, { k })}</div></div>
            <div class="product-body">
              <div class="product-category">${p.category}</div>
              <h3 class="product-name">${p.name}</h3>
              <div class="product-meta">
                <div class="product-price">${window.formatMoney(p.price)}</div>
                <div class="product-rating"><span class="star">★</span>${p.rating}</div>
              </div>
            </div>
          </a>
        `).join('')}
      </div>
    `);
  }

  function renderAddresses(host) {
    const list = user.addresses || [];
    host.innerHTML = panel('Addresses', `
      <div class="addr-grid">
        ${list.map((a, i) => `
          <div class="addr-card ${a.default ? 'addr-default' : ''}">
            ${a.default ? '<span class="addr-badge">Default</span>' : ''}
            <h4>${a.label || 'Address ' + (i + 1)}</h4>
            <p>${a.line1}</p>
            ${a.line2 ? `<p>${a.line2}</p>` : ''}
            <p>${a.city}, ${a.state || ''} ${a.zip || a.postal || ''}</p>
            <p>${a.country}</p>
            <div class="addr-actions">
              <button class="btn-link">Edit</button>
              <button class="btn-link" style="color:var(--ink-mute);">Remove</button>
            </div>
          </div>
        `).join('')}
        <button class="addr-add" id="addr-add">
          <span style="font-size:32px; line-height:1;">+</span>
          <span>Add a new address</span>
        </button>
      </div>
    `);
    document.getElementById('addr-add').addEventListener('click', () => {
      window.toast('Address form coming soon (demo)', 'success');
    });
  }

  function renderProfile(host) {
    host.innerHTML = panel('Profile', `
      <form id="profile-form" class="checkout-form" style="padding:0; border:0; background:transparent;">
        <div class="form-row-2">
          <div class="form-field"><label>Full name</label><input name="name" value="${esc(user.name)}"></div>
          <div class="form-field"><label>Email</label><input name="email" type="email" value="${esc(user.email)}"></div>
        </div>
        <div class="form-row-2">
          <div class="form-field"><label>Phone</label><input name="phone" value="${esc(user.phone || '')}"></div>
          <div class="form-field"><label>Birthday <span style="color:var(--ink-mute); font-weight:400;">(optional)</span></label><input name="birthday" type="text" placeholder="DD/MM" value="${esc(user.birthday || '')}"></div>
        </div>

        <h3 class="step-subheading">Communication</h3>
        <label class="acct-toggle"><input type="checkbox" name="newsletter" ${user.newsletter ? 'checked' : ''}> Monthly newsletter</label>
        <label class="acct-toggle"><input type="checkbox" name="restock" ${user.restock ? 'checked' : ''}> Restock alerts for wishlisted items</label>
        <label class="acct-toggle"><input type="checkbox" name="sms"> SMS for shipping updates</label>

        <h3 class="step-subheading">Security</h3>
        <div class="form-row-2">
          <div class="form-field"><label>New password</label><input type="password" name="password" placeholder="********"></div>
          <div class="form-field"><label>Confirm</label><input type="password" name="password2" placeholder="********"></div>
        </div>

        <div style="margin-top:18px;">
          <button class="btn btn-primary" type="submit">Save changes</button>
        </div>
      </form>
    `);
    document.getElementById('profile-form').addEventListener('submit', (e) => {
      e.preventDefault();
      window.toast('Saved', 'success');
    });
  }

  function renderLoyalty(host) {
    const pts = user.points || 0;
    const tier = pts > 500 ? 'Stoneworks' : pts > 200 ? 'Riverstone' : 'Pebble';
    const next = pts > 500 ? null : pts > 200 ? 500 : 200;
    const progress = next ? Math.round((pts / next) * 100) : 100;
    host.innerHTML = panel('Loyalty', `
      <div class="loyalty-hero">
        <div>
          <div class="loyalty-tier">${tier} member</div>
          <div class="loyalty-points">${pts} <span>pts</span></div>
          ${next ? `<div class="loyalty-next">${next - pts} pts to <strong>${next > 500 ? 'Stoneworks' : 'Riverstone'}</strong></div>` : '<div class="loyalty-next">You are at the top tier</div>'}
          <div class="loyalty-bar"><div class="loyalty-fill" style="width:${progress}%;"></div></div>
        </div>
      </div>
      <h4 style="margin:24px 0 12px;">Earn points</h4>
      <div class="loyalty-grid">
        <div class="loyalty-card"><strong>+1 pt</strong> per $1 spent</div>
        <div class="loyalty-card"><strong>+50 pts</strong> for each product review</div>
        <div class="loyalty-card"><strong>+25 pts</strong> for a referral</div>
        <div class="loyalty-card"><strong>+100 pts</strong> on your birthday</div>
      </div>
      <h4 style="margin:24px 0 12px;">Redeem</h4>
      <div class="loyalty-grid">
        <div class="loyalty-card"><strong>100 pts</strong> -> $5 off</div>
        <div class="loyalty-card"><strong>250 pts</strong> -> $15 off</div>
        <div class="loyalty-card"><strong>500 pts</strong> -> Free shipping for a year</div>
        <div class="loyalty-card"><strong>1000 pts</strong> -> A small free gift</div>
      </div>
    `);
  }

  /* ---------- helpers ---------- */
  function panel(title, body) {
    return `<div class="acct-panel"><h2 class="acct-panel-title">${title}</h2>${body}</div>`;
  }

  function showModal(title, html) {
    const old = document.querySelector('.modal-backdrop');
    if (old) old.remove();
    const m = document.createElement('div');
    m.className = 'modal-backdrop';
    m.innerHTML = `
      <div class="modal">
        <div class="modal-head">
          <h3>${title}</h3>
          <button class="modal-close" aria-label="Close">×</button>
        </div>
        <div class="modal-body">${html}</div>
      </div>`;
    document.body.appendChild(m);
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => { m.remove(); document.removeEventListener('keydown', onKey); };
    document.addEventListener('keydown', onKey);
    m.addEventListener('click', (e) => { if (e.target === m) close(); });
    m.querySelector('.modal-close').addEventListener('click', close);
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
