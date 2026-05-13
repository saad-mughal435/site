/* =========================================================
   Pebble & Co. - landing + catalog logic
   ========================================================= */
(function () {
  'use strict';

  /* ---------- Landing page ---------- */
  async function loadLanding() {
    if (!document.getElementById('featured-grid')) return;

    // Featured
    const feat = await fetch('/b2c/api/products/featured').then(r => r.json());
    document.getElementById('featured-grid').innerHTML =
      feat.items.slice(0, 8).map((p, i) => productCard(p, i)).join('');

    // Trending
    const trend = await fetch('/b2c/api/products/trending').then(r => r.json());
    document.getElementById('trending-grid').innerHTML =
      trend.items.slice(0, 6).map((p, i) => productCard(p, i)).join('');

    // Categories
    const cats = await fetch('/b2c/api/categories').then(r => r.json());
    document.getElementById('category-grid').innerHTML =
      cats.categories.map((c, i) => categoryTile(c, i)).join('');

    // Reviews strip
    const all = await fetch('/b2c/api/products').then(r => r.json());
    const reviewsPool = all.items.slice(0, 6).map(p => ({
      product: p.name,
      rating: 5,
      text: 'The packaging alone tells you what kind of brand this is.',
      author: 'Demo Shopper',
    }));
    // Wishlist hydration
    hydrateWishlist();
    bindWishlistClicks();
  }

  /* ---------- Catalog page ---------- */
  async function loadCatalog() {
    if (!document.getElementById('catalog-grid')) return;

    const params = new URLSearchParams(window.location.search);
    const state = {
      category: params.get('category') || 'all',
      min_price: '',
      max_price: '',
      search: params.get('q') || '',
      sort: 'newest',
    };

    // Sidebar
    const cats = (await fetch('/b2c/api/categories').then(r => r.json())).categories;
    renderFilters(cats, state);

    // Sort
    document.getElementById('sort-select').addEventListener('change', (e) => {
      state.sort = e.target.value;
      refresh();
    });

    async function refresh() {
      const q = new URLSearchParams({ ...state });
      const data = await fetch('/b2c/api/products?' + q).then(r => r.json());
      document.getElementById('catalog-count').textContent =
        `${data.total} product${data.total === 1 ? '' : 's'}`;
      document.getElementById('catalog-grid').innerHTML = data.items.length
        ? data.items.map((p, i) => productCard(p, i)).join('')
        : `<div style="padding:60px 20px; text-align:center; color:var(--ink-soft); grid-column:1/-1;">No products match. Try clearing filters.</div>`;
      hydrateWishlist();
      bindWishlistClicks();

      // Reflect category in heading
      const head = document.getElementById('catalog-heading');
      if (head) {
        const cat = cats.find(c => c.slug === state.category);
        head.textContent = cat ? cat.name : 'All products';
      }
    }

    function renderFilters(cats, state) {
      const host = document.getElementById('filters');
      host.innerHTML = `
        <div class="filters-group">
          <div class="filters-label">Category</div>
          <div class="filter-option ${state.category === 'all' ? 'active' : ''}" data-filter="category" data-value="all">All</div>
          ${cats.map(c => `
            <div class="filter-option ${state.category === c.slug ? 'active' : ''}" data-filter="category" data-value="${c.slug}">${c.name}</div>
          `).join('')}
        </div>
        <div class="filters-group">
          <div class="filters-label">Price (USD)</div>
          <div class="price-range">
            <input type="number" placeholder="Min" id="min-price" value="${state.min_price}">
            <input type="number" placeholder="Max" id="max-price" value="${state.max_price}">
          </div>
        </div>
        <div class="filters-group">
          <div class="filters-label">Tag</div>
          <div class="filter-option" data-filter="tag" data-value="">Any</div>
          <div class="filter-option" data-filter="tag" data-value="bestseller">Bestseller</div>
          <div class="filter-option" data-filter="tag" data-value="sale">On sale</div>
          <div class="filter-option" data-filter="tag" data-value="gift">Gift idea</div>
        </div>
        <button class="btn btn-ghost btn-sm btn-block" id="clear-filters">Clear filters</button>
      `;

      host.addEventListener('click', (e) => {
        const opt = e.target.closest('[data-filter]');
        if (!opt) return;
        const key = opt.dataset.filter, val = opt.dataset.value;
        state[key] = val;
        $$('[data-filter]', host).forEach(o => {
          if (o.dataset.filter === key) o.classList.toggle('active', o.dataset.value === val);
        });
        refresh();
      });

      ['min-price', 'max-price'].forEach(id => {
        const el = host.querySelector('#' + id);
        if (el) el.addEventListener('change', () => {
          state[id.replace('-', '_')] = el.value;
          refresh();
        });
      });
      host.querySelector('#clear-filters').addEventListener('click', () => {
        Object.assign(state, { category: 'all', min_price: '', max_price: '', search: '', sort: 'newest' });
        renderFilters(cats, state);
        refresh();
      });
    }

    refresh();
  }

  /* ---------- Shared product card markup ---------- */
  function productCard(p, k) {
    const tagBadges = (p.tags || []).slice(0, 1).map(t => {
      if (t === 'bestseller') return `<span class="badge badge-coral">Bestseller</span>`;
      if (t === 'sale')       return `<span class="badge badge-red">Sale</span>`;
      if (t === 'gift')       return `<span class="badge badge-sage">Gift idea</span>`;
      if (t === 'lifetime')   return `<span class="badge badge-amber">Lifetime</span>`;
      return '';
    }).join('');
    return `
      <a href="product.html?id=${p.id}" class="product-card" data-product-id="${p.id}">
        <div class="product-image">
          <div class="product-image-svg">${window.makeProductSvg(p, { k })}</div>
          ${tagBadges ? `<div class="product-tags">${tagBadges}</div>` : ''}
          <button class="product-wishlist" data-wishlist="${p.id}" aria-label="Save to wishlist" onclick="event.preventDefault(); event.stopPropagation();">
            <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
        </div>
        <div class="product-body">
          <div class="product-category">${p.category}</div>
          <h3 class="product-name">${p.name}</h3>
          <div class="product-meta">
            <div class="product-price">
              ${window.formatMoney(p.price)}
              ${p.compare_at ? `<span class="compare">${window.formatMoney(p.compare_at)}</span>` : ''}
            </div>
            <div class="product-rating"><span class="star">★</span>${p.rating}</div>
          </div>
          <div class="product-swatches" style="margin-top:6px;">
            ${(p.variants || []).slice(0, 4).map(v => `<span class="swatch" style="background:${v.hex}" title="${v.name}"></span>`).join('')}
          </div>
        </div>
      </a>
    `;
  }

  function categoryTile(c, i) {
    return `
      <a href="products.html?category=${c.slug}" class="category-tile" style="--cat-color:${c.palette[0]};">
        <div class="category-tile-icon">${c.icon}</div>
        <div>
          <div class="category-tile-name">${c.name}</div>
          <div class="category-tile-blurb">${c.blurb}</div>
        </div>
        <div class="category-tile-arrow">Shop ${c.name.toLowerCase()} &rarr;</div>
      </a>
    `;
  }

  /* ---------- Wishlist (heart icon state) ---------- */
  async function hydrateWishlist() {
    const list = JSON.parse(localStorage.getItem('pebble.wishlist') || '[]');
    document.querySelectorAll('[data-wishlist]').forEach(btn => {
      btn.classList.toggle('active', list.includes(btn.dataset.wishlist));
    });
  }

  function bindWishlistClicks() {
    document.querySelectorAll('[data-wishlist]').forEach(btn => {
      if (btn.__wired) return;
      btn.__wired = true;
      btn.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        const id = btn.dataset.wishlist;
        const res = await fetch('/b2c/api/wishlist', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ product_id: id }),
        });
        const data = await res.json();
        btn.classList.toggle('active');
        window.toast(btn.classList.contains('active') ? 'Saved to wishlist' : 'Removed from wishlist');
      });
    });
  }

  /* Helpers */
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));

  /* ---------- Newsletter form ---------- */
  document.addEventListener('submit', async (e) => {
    if (e.target.matches('[data-newsletter]')) {
      e.preventDefault();
      const email = new FormData(e.target).get('email');
      await fetch('/b2c/api/newsletter', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email})});
      window.toast('You are on the list. Welcome.');
      e.target.reset();
    }
  });

  /* ---------- Boot ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    loadLanding();
    loadCatalog();
  });
})();
