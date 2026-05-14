/* =========================================================
   Pebble & Co. - product detail page
   ========================================================= */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const root = document.getElementById('product-root');
    if (!root) return;

    const id = new URLSearchParams(window.location.search).get('id') || 'p-001';
    const res = await fetch('/b2c/api/products/' + id);
    if (!res.ok) {
      root.innerHTML = `<div style="padding:80px 0; text-align:center;">
        <h2>We can't find that product.</h2>
        <p style="color:var(--ink-soft); margin:12px 0 24px;">It might be out of stock or moved.</p>
        <a class="btn btn-primary" href="products.html">Back to shop</a>
      </div>`;
      return;
    }
    const { product, reviews, related } = await res.json();

    document.getElementById('bc-category').textContent = product.category[0].toUpperCase() + product.category.slice(1);
    document.title = `${product.name} - Pebble & Co.`;

    let selectedVariant = product.variants[0];
    let qty = 1;
    let activeImg = 0;

    function render() {
      const save = product.compare_at ? Math.round((1 - product.price / product.compare_at) * 100) : 0;
      const stockState = product.stock <= 0 ? 'out' : (product.stock < 10 ? 'low' : 'in');
      const stockLabel = stockState === 'out' ? 'Out of stock'
                        : stockState === 'low' ? `Only ${product.stock} left`
                        : 'In stock';
      root.innerHTML = `
        <div class="product-page">
          <div class="product-gallery">
            <div class="product-gallery-main" id="gallery-main">
              ${window.makeProductSvg(product, { k: activeImg, variantHex: selectedVariant.hex })}
            </div>
            <div class="product-gallery-thumbs">
              ${[0,1,2,3].map(k => `
                <div class="product-gallery-thumb ${activeImg === k ? 'active' : ''}" data-thumb="${k}">
                  ${window.makeProductSvg(product, { k, variantHex: selectedVariant.hex })}
                </div>
              `).join('')}
            </div>
          </div>

          <div class="product-info">
            <div class="product-info-category">${product.category}</div>
            <h1>${product.name}</h1>
            <div class="product-rating" style="margin-bottom:8px;">
              <span class="star" style="color:var(--amber);">${window.starString(product.rating)}</span>
              <a href="#reviews" style="color:var(--ink-soft); font-size:13.5px;">${product.review_count} reviews</a>
            </div>
            <div class="product-info-price">
              <span class="now">${window.formatMoney(product.price)}</span>
              ${product.compare_at ? `<span class="compare">${window.formatMoney(product.compare_at)}</span><span class="save">SAVE ${save}%</span>` : ''}
            </div>
            <p class="product-info-desc">${product.short_desc}</p>

            <div class="variant-picker">
              <div class="variant-label">Color: <strong id="variant-name">${selectedVariant.name}</strong></div>
              <div class="variant-options">
                ${product.variants.map(v => `
                  <button class="variant-swatch ${v.id === selectedVariant.id ? 'active' : ''}"
                          style="background:${v.hex}"
                          aria-label="${v.name}"
                          data-variant="${v.id}"
                          title="${v.name} - ${v.stock} in stock"></button>
                `).join('')}
              </div>
            </div>

            <div class="stock-line">
              <span class="stock-dot ${stockState === 'out' ? 'out' : stockState === 'low' ? 'low' : ''}"></span>
              <strong>${stockLabel}</strong> &middot; Ships within 1-2 business days
            </div>

            <ul class="product-feature-list">
              ${(product.features || []).map(f => `<li>${f}</li>`).join('')}
            </ul>

            <div class="add-to-cart-row">
              <div class="qty-stepper" role="group" aria-label="Quantity">
                <button class="qty-btn" data-qty="-1" aria-label="Decrease">-</button>
                <input class="qty-input" id="qty-input" type="text" value="1" inputmode="numeric" aria-label="Quantity">
                <button class="qty-btn" data-qty="+1" aria-label="Increase">+</button>
              </div>
              <button class="btn btn-primary btn-lg" id="add-to-cart" style="flex:1;">
                Add to cart - ${window.formatMoney(product.price)}
              </button>
              <button class="product-wishlist" data-wishlist="${product.id}" aria-label="Save to wishlist" style="position:relative; top:0; right:0; box-shadow:0 0 0 1px var(--line);">
                <svg viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              </button>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:13px; color:var(--ink-soft); margin-bottom:24px;">
              <div>✓ Free shipping over $75</div>
              <div>✓ 30-day returns</div>
              <div>✓ 2-year warranty minimum</div>
              <div>✓ Repairs available for life</div>
            </div>

            <div class="product-tabs">
              <div class="tab-buttons" role="tablist">
                <button class="tab-button active" data-tab="desc">Description</button>
                <button class="tab-button" data-tab="specs">Specs</button>
                <button class="tab-button" data-tab="reviews" id="reviews">Reviews (${reviews.length})</button>
                <button class="tab-button" data-tab="shipping">Shipping</button>
              </div>

              <div class="tab-panel active" data-panel="desc">
                <p style="color:var(--ink-2); font-size:15px; line-height:1.7;">${product.description}</p>
              </div>
              <div class="tab-panel" data-panel="specs">
                <table class="spec-table">
                  ${Object.entries(product.specs || {}).map(([k, v]) => `
                    <tr><td>${k.replace(/_/g, ' ')}</td><td>${v}</td></tr>
                  `).join('')}
                </table>
              </div>
              <div class="tab-panel" data-panel="reviews">
                <div style="display:flex; align-items:center; gap:16px; margin-bottom:18px; padding-bottom:14px; border-bottom:1px solid var(--line);">
                  <div style="font-size:36px; font-weight:700; color:var(--ink);">${product.rating}</div>
                  <div>
                    <div style="color:var(--amber); font-size:18px;">${window.starString(product.rating)}</div>
                    <div style="color:var(--ink-soft); font-size:13px;">${reviews.length} reviews from verified customers</div>
                  </div>
                </div>
                <div class="review-list">
                  ${reviews.slice(0, 8).map(r => `
                    <div class="review">
                      <div class="review-head">
                        <div>
                          <span class="review-author">${r.author}</span>
                          ${r.verified ? '<span class="review-verified">✓ Verified buyer</span>' : ''}
                        </div>
                        <div style="text-align:right;">
                          <div class="review-stars">${window.starString(r.rating)}</div>
                          <div class="review-date">${new Date(r.date).toLocaleDateString()}</div>
                        </div>
                      </div>
                      <div class="review-title">${r.title}</div>
                      <div class="review-body">${r.body}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
              <div class="tab-panel" data-panel="shipping">
                <ul class="product-feature-list">
                  <li>Free shipping on orders over $75 anywhere in the demo region.</li>
                  <li>Standard delivery 3-5 business days. Express available at checkout.</li>
                  <li>30-day returns - no questions, no restocking fee.</li>
                  <li>Warranty repairs handled in-house with a 14-day average turnaround.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      `;

      wireInteractions();
    }

    function wireInteractions() {
      // Thumbs
      root.querySelectorAll('[data-thumb]').forEach(t => {
        t.addEventListener('click', () => {
          activeImg = Number(t.dataset.thumb);
          render();
        });
      });
      // Variant
      root.querySelectorAll('[data-variant]').forEach(b => {
        b.addEventListener('click', () => {
          selectedVariant = product.variants.find(v => v.id === b.dataset.variant);
          render();
        });
      });
      // Qty
      root.querySelectorAll('[data-qty]').forEach(b => {
        b.addEventListener('click', () => {
          const d = Number(b.dataset.qty);
          qty = Math.max(1, Math.min(99, qty + d));
          const input = document.getElementById('qty-input');
          if (input) input.value = qty;
        });
      });
      const qtyInput = document.getElementById('qty-input');
      if (qtyInput) qtyInput.addEventListener('change', () => {
        qty = Math.max(1, Math.min(99, Number(qtyInput.value) || 1));
        qtyInput.value = qty;
      });

      // Add to cart
      const atc = document.getElementById('add-to-cart');
      if (atc) {
        const handleAddClick = async () => {
          atc.disabled = true;
          atc.textContent = 'Adding...';
          await window.addToCart(product.id, selectedVariant, qty);
          atc.disabled = false;
          atc.textContent = 'View cart →';
          atc.onclick = () => window.location.href = 'cart.html';
          setTimeout(() => {
            if (atc.textContent === 'View cart →') {
              atc.onclick = null;
              atc.innerHTML = `Add to cart - ${window.formatMoney(product.price)}`;
              atc.addEventListener('click', handleAddClick);
            }
          }, 4000);
        };
        atc.addEventListener('click', handleAddClick);
      }

      // Tabs
      root.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', () => {
          const t = btn.dataset.tab;
          root.querySelectorAll('.tab-button').forEach(b => b.classList.toggle('active', b === btn));
          root.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === t));
        });
      });

      // Wishlist
      root.querySelectorAll('[data-wishlist]').forEach(btn => {
        const list = JSON.parse(localStorage.getItem('pebble.wishlist') || '[]');
        if (list.includes(btn.dataset.wishlist)) btn.classList.add('active');
        btn.addEventListener('click', async (e) => {
          e.preventDefault(); e.stopPropagation();
          await fetch('/b2c/api/wishlist', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product_id: btn.dataset.wishlist }),
          });
          btn.classList.toggle('active');
          window.toast(btn.classList.contains('active') ? 'Saved' : 'Removed');
        });
      });
    }

    render();

    // Related products
    if (related && related.length) {
      document.getElementById('related-section').style.display = 'block';
      document.getElementById('related-grid').innerHTML = related.map((p, k) => `
        <a href="product.html?id=${p.id}" class="product-card">
          <div class="product-image">
            <div class="product-image-svg">${window.makeProductSvg(p, { k })}</div>
          </div>
          <div class="product-body">
            <div class="product-category">${p.category}</div>
            <h3 class="product-name">${p.name}</h3>
            <div class="product-meta">
              <div class="product-price">${window.formatMoney(p.price)}</div>
              <div class="product-rating"><span class="star">★</span>${p.rating}</div>
            </div>
          </div>
        </a>
      `).join('');
    }
  }
})();
