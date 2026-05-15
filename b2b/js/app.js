/* =========================================================
   Anvil Supply Co. - shared app shell
   ========================================================= */
// Cross-site portfolio-demo banner — appears above the fold on every page so
// recruiters landing via a deep link see this is a demo, not a real wholesaler.
(function () { var s = document.createElement('script'); s.src = '/assets/portfolio-banner.js?v=20260514'; s.async = true; document.head.appendChild(s); })();
(function () {
  'use strict';

  window.formatMoney = function (n) {
    return '$' + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  window.fmInt = function (n) {
    return Number(n).toLocaleString();
  };

  /* Tile mark used in cart rows and product detail header */
  window.skuMark = function (sku) {
    return (sku || '?').split('-')[0].slice(0, 3).toUpperCase();
  };

  /* SVG-ish placeholder card image for product cards (compact) */
  window.makeSkuPanel = function (product) {
    const mark = window.skuMark(product.sku || product.id);
    return `
      <svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
        <rect width="200" height="140" fill="#eef1f5"/>
        <rect x="0" y="0" width="200" height="6" fill="#16314f"/>
        <text x="50%" y="58%" text-anchor="middle" font-family="JetBrains Mono, monospace" font-weight="700" font-size="34" fill="#16314f" letter-spacing="-0.04em">${mark}</text>
        <text x="50%" y="82%" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#56657a">${product.sku || ''}</text>
      </svg>
    `;
  };

  window.renderNav = function (active) {
    const cart = JSON.parse(localStorage.getItem('anvil.cart') || '[]');
    const cartCount = cart.reduce((s, l) => s + l.qty, 0);
    const links = [
      { id: 'catalog',  label: 'Catalog',         href: 'catalog.html' },
      { id: 'quote',    label: 'Request a quote', href: 'quote-request.html' },
      { id: 'account',  label: 'Account',         href: 'account.html' },
    ];
    return `
      <div class="nav">
        <div class="nav-strip">
          <div class="container nav-strip-inner">
            <span>📞 +971 4 010 1010 &middot; <a href="mailto:orders@anvil.demo">orders@anvil.demo</a></span>
            <span>Net 30 terms available &middot; Free freight over $500</span>
          </div>
        </div>
        <div class="container nav-inner">
          <a href="index.html" class="brand-mark">
            <span class="anvil-logo">A</span>
            <span>Anvil Supply Co.</span>
          </a>
          <div class="nav-search">
            <svg class="nav-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>
            <input type="text" placeholder="Search SKU or product..." id="nav-search-input">
          </div>
          <nav class="nav-links" aria-label="Primary">
            ${links.map(l => `<a href="${l.href}" class="${active === l.id ? 'active' : ''}">${l.label}</a>`).join('')}
            <a href="admin.html" style="color:var(--orange);">Admin</a>
          </nav>
          <div class="nav-actions">
            <a href="cart.html" class="nav-icon-btn" aria-label="Cart" data-cart-icon>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 7h14l-1.5 11a2 2 0 0 1-2 1.7H8.5a2 2 0 0 1-2-1.7L5 7z"/>
                <path d="M9 7V5a3 3 0 0 1 6 0v2"/>
              </svg>
              ${cartCount > 0 ? `<span class="cart-count">${cartCount}</span>` : ''}
            </a>
            <button class="nav-icon-btn nav-burger" aria-label="Menu">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
          </div>
        </div>
        <div class="nav-subbar">
          <div class="container nav-subbar-inner">
            <a href="catalog.html?industry=packaging">Packaging</a>
            <a href="catalog.html?industry=chemicals">Chemicals</a>
            <a href="catalog.html?industry=parts">Spare parts</a>
            <a href="catalog.html?industry=consumables">Consumables</a>
            <span style="color:var(--ink-mute); font-family:var(--mono); font-size:11px; margin-left:auto;">DEMO MODE &middot; nothing real ships</span>
          </div>
        </div>
      </div>
    `;
  };

  window.renderFooter = function () {
    return `
      <footer class="footer">
        <div class="container">
          <div class="footer-grid">
            <div class="footer-brand">
              <div class="brand-mark" style="color:#fff;">
                <span class="anvil-logo" style="background:#fff; color:var(--navy);">A</span>
                <span>Anvil Supply Co.</span>
              </div>
              <p>Industrial supplies, no nonsense. Net 30 terms, tier pricing, fast freight. This is a portfolio demo - everything is fabricated.</p>
              <p style="font-family:var(--mono); font-size:11.5px; color:#7d8a9e;">orders@anvil.demo &middot; +971 4 010 1010</p>
            </div>
            <div>
              <h5>Categories</h5>
              <a href="catalog.html?industry=packaging">Packaging</a>
              <a href="catalog.html?industry=chemicals">Chemicals</a>
              <a href="catalog.html?industry=parts">Spare parts</a>
              <a href="catalog.html?industry=consumables">Consumables</a>
            </div>
            <div>
              <h5>For buyers</h5>
              <a href="quote-request.html">Request a quote</a>
              <a href="account.html#orders">My orders</a>
              <a href="account.html#invoices">Statements</a>
              <a href="account.html#recurring">Recurring orders</a>
            </div>
            <div>
              <h5>Account</h5>
              <a href="account.html#users">Users &amp; roles</a>
              <a href="account.html#addresses">Ship-to addresses</a>
              <a href="admin.html">Admin panel</a>
            </div>
            <div>
              <h5>Resources</h5>
              <a href="#">Catalog PDF</a>
              <a href="#">Spec sheets</a>
              <a href="#">Safety data sheets</a>
              <a href="#">Returns policy</a>
            </div>
          </div>
          <div class="footer-bottom">
            <span>© ${new Date().getFullYear()} Anvil Supply Co. (demo). Portfolio project.</span>
            <span>v1.4 &middot; ${new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </footer>
    `;
  };

  /* Toasts */
  let toastStack = null;
  function ensureToast() {
    if (toastStack) return toastStack;
    toastStack = document.createElement('div');
    toastStack.className = 'toast-stack';
    document.body.appendChild(toastStack);
    return toastStack;
  }
  window.toast = function (msg, kind = 'success', ms = 2400) {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    ensureToast().appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .2s, transform .2s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(20px)';
      setTimeout(() => el.remove(), 220);
    }, ms);
  };

  /* Cart helpers */
  window.addToCart = async function (sku, qty = 0) {
    const res = await fetch('/b2b/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: sku, sku, qty, action: 'add' }),
    });
    const totals = await res.json();
    if (totals.error === 'sku_not_found') {
      window.toast(`SKU ${sku} not found`, 'error');
      return null;
    }
    if (totals.error === 'out_of_stock') {
      window.toast(`${totals.sku} (${totals.name}) is out of stock`, 'error');
      return null;
    }
    updateCartIcon(totals);
    if (totals.warning === 'capped_to_stock') {
      window.toast(`Only ${totals.stock} units of ${totals.sku} in stock — capped`, 'error', 3500);
    } else {
      window.toast(`Added ${sku}`, 'success');
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
      span.textContent = window.fmInt(count);
      icon.appendChild(span);
    }
  };

  window.bootstrapShell = function (activeNav) {
    const navHost = document.getElementById('nav-host');
    const footerHost = document.getElementById('footer-host');
    if (navHost) navHost.innerHTML = window.renderNav(activeNav);
    if (footerHost) footerHost.innerHTML = window.renderFooter();

    const searchInput = document.getElementById('nav-search-input');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && searchInput.value.trim()) {
          window.location.href = 'catalog.html?search=' + encodeURIComponent(searchInput.value.trim());
        }
      });
    }
  };

  /* Modal */
  window.showModal = function (title, html, opts = {}) {
    const old = document.querySelector('.modal-backdrop');
    if (old) old.remove();
    const m = document.createElement('div');
    m.className = 'modal-backdrop';
    m.innerHTML = `
      <div class="modal ${opts.large ? 'modal-lg' : ''}">
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
    return m;
  };
})();
