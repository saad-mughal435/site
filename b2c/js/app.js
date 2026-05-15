/* =========================================================
   Pebble & Co. - shared app shell
   Renders nav, footer, cart count, toasts. Loaded on every page.
   ========================================================= */
// Cross-site portfolio-demo banner - appears above the fold on every page so
// recruiters landing via a deep link see this is a demo, not a real store.
(function () { var s = document.createElement('script'); s.src = '/assets/portfolio-banner.js?v=20260514'; s.async = true; document.head.appendChild(s); })();
(function () {
  'use strict';

  const $  = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));

  /* ---------- SVG placeholder generator ---------- */
  // Generates a deterministic decorative SVG for a product using its palette + initials.
  window.makeProductSvg = function (product, opts = {}) {
    const [a, b] = product.palette || ['#f15a3a', '#ffd4c4'];
    const initials = product.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
    const variantColor = opts.variantHex || null;
    return `
      <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="g-${product.id}-${opts.k||0}" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="${b}"/>
            <stop offset="1" stop-color="${a}" stop-opacity="0.6"/>
          </linearGradient>
        </defs>
        <rect width="400" height="400" fill="url(#g-${product.id}-${opts.k||0})"/>
        <circle cx="${120 + (opts.k||0) * 40}" cy="${140 + (opts.k||0) * 20}" r="90" fill="${a}" opacity="0.22"/>
        <circle cx="${280 - (opts.k||0) * 30}" cy="${280 - (opts.k||0) * 10}" r="70" fill="${variantColor || a}" opacity="0.42"/>
        <text x="50%" y="55%" text-anchor="middle"
              font-family="Fraunces, Georgia, serif" font-size="64" font-weight="600"
              fill="${a}" opacity="0.85" letter-spacing="-0.02em">${initials}</text>
      </svg>
    `;
  };

  /* ---------- Nav ---------- */
  window.renderNav = function (active) {
    const cart = JSON.parse(localStorage.getItem('pebble.cart') || '[]');
    const cartCount = cart.reduce((s, l) => s + l.qty, 0);
    const links = [
      { id: 'shop',     label: 'Shop',       href: 'products.html' },
      { id: 'audio',    label: 'Audio',      href: 'products.html?category=audio' },
      { id: 'home',     label: 'Home',       href: 'products.html?category=home' },
      { id: 'wearables',label: 'Wearables',  href: 'products.html?category=wearables' },
      { id: 'account',  label: 'Account',    href: 'account.html' },
    ];
    return `
      <header class="nav">
        <div class="container nav-inner">
          <a href="index.html" class="brand-mark">
            <span class="brand-dot"></span>
            Pebble &amp; Co.
          </a>
          <nav class="nav-links" aria-label="Primary">
            ${links.map(l => `<a href="${l.href}" class="${active === l.id ? 'active' : ''}">${l.label}</a>`).join('')}
            <a href="admin.html" style="color:var(--coral-deep); font-weight:600;">Admin</a>
          </nav>
          <div class="nav-actions">
            <button class="nav-icon-btn" aria-label="Search" data-action="search">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
              </svg>
            </button>
            <a href="account.html" class="nav-icon-btn" aria-label="Account">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>
              </svg>
            </a>
            <a href="cart.html" class="nav-icon-btn" aria-label="Cart" data-cart-icon>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 7h14l-1.5 11a2 2 0 0 1-2 1.7H8.5a2 2 0 0 1-2-1.7L5 7z"/>
                <path d="M9 7V5a3 3 0 0 1 6 0v2"/>
              </svg>
              ${cartCount > 0 ? `<span class="cart-count">${cartCount}</span>` : ''}
            </a>
            <button class="nav-icon-btn nav-burger" aria-label="Menu" data-action="menu">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 6h16M4 12h16M4 18h16"/>
              </svg>
            </button>
          </div>
        </div>
      </header>
    `;
  };

  window.renderFooter = function () {
    return `
      <footer class="footer">
        <div class="container">
          <div class="footer-grid">
            <div>
              <div class="brand-mark"><span class="brand-dot"></span>Pebble &amp; Co.</div>
              <p class="footer-brand-blurb">Small things, beautifully made. Built in a studio, shipped from a warehouse, kept around longer than the average thing.</p>
              <p style="font-size:12px; color:var(--ink-mute); font-family:var(--mono);">Demo store - all data is fabricated.</p>
            </div>
            <div class="footer-col">
              <h5>Shop</h5>
              <a href="products.html?category=audio">Audio</a>
              <a href="products.html?category=wearables">Wearables</a>
              <a href="products.html?category=home">Home</a>
              <a href="products.html?category=accessories">Accessories</a>
            </div>
            <div class="footer-col">
              <h5>Help</h5>
              <a href="#">Shipping &amp; returns</a>
              <a href="#">Repairs</a>
              <a href="#">Contact</a>
              <a href="account.html">Track an order</a>
            </div>
            <div class="footer-col">
              <h5>Pebble</h5>
              <a href="#">About</a>
              <a href="#">Journal</a>
              <a href="#">Sustainability</a>
              <a href="admin.html">Admin</a>
            </div>
          </div>
          <div class="footer-bottom">
            <span>© <span id="year"></span> Pebble &amp; Co. (demo). Made in a portfolio.</span>
            <span>${new Date().toLocaleString()}</span>
          </div>
        </div>
      </footer>
    `;
  };

  /* ---------- Toasts ---------- */
  let toastStack = null;
  function ensureToastStack() {
    if (toastStack) return toastStack;
    toastStack = document.createElement('div');
    toastStack.className = 'toast-stack';
    document.body.appendChild(toastStack);
    return toastStack;
  }
  window.toast = function (msg, kind = 'success', ms = 2500) {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.innerHTML = `<span>${msg}</span>`;
    ensureToastStack().appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(() => el.remove(), 250);
    }, ms);
  };

  /* ---------- Cart helpers (used by buttons across pages) ---------- */
  window.addToCart = async function (product_id, variant, qty = 1) {
    const res = await fetch('/b2c/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id,
        variant_id: variant?.id || null,
        variant_name: variant?.name || null,
        qty,
      }),
    });
    const totals = await res.json();
    if (totals.error === 'out_of_stock') {
      window.toast(`${totals.product_name || 'Item'} is out of stock`, 'error');
      return null;
    }
    updateCartIcon(totals);
    if (totals.warning === 'capped_to_stock') {
      window.toast(`Only ${totals.stock} of ${totals.product_name || 'this item'} in stock - quantity capped`, 'error', 3500);
    } else {
      window.toast('Added to cart', 'success');
    }
    return totals;
  };

  window.updateCartIcon = function (totals) {
    const icon = document.querySelector('[data-cart-icon]');
    if (!icon) return;
    const count = (totals?.lines || []).reduce((s, l) => s + l.qty, 0);
    const old = icon.querySelector('.cart-count');
    if (old) old.remove();
    if (count > 0) {
      const span = document.createElement('span');
      span.className = 'cart-count';
      span.textContent = count;
      icon.appendChild(span);
    }
  };

  window.formatMoney = function (n) {
    return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  window.starString = function (rating) {
    const full = Math.round(rating);
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  };

  /* ---------- Page bootstrap ---------- */
  window.bootstrapShell = function (activeNav) {
    const navHost = document.getElementById('nav-host');
    const footerHost = document.getElementById('footer-host');
    if (navHost) navHost.innerHTML = window.renderNav(activeNav);
    if (footerHost) footerHost.innerHTML = window.renderFooter();
    const y = document.getElementById('year');
    if (y) y.textContent = new Date().getFullYear();
  };

  /* ---------- Mobile menu toggle ---------- */
  document.addEventListener('click', (e) => {
    const burger = e.target.closest('[data-action="menu"]');
    if (burger) {
      const links = document.querySelector('.nav-links');
      if (links) links.classList.toggle('open');
    }
  });
})();
