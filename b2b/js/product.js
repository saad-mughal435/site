/* =========================================================
   Anvil Supply Co. - product detail
   ========================================================= */
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const root = document.getElementById('product-root');
    const id = new URLSearchParams(window.location.search).get('sku')
            || new URLSearchParams(window.location.search).get('id')
            || 'sku-001';
    const res = await fetch('/b2b/api/products/' + encodeURIComponent(id));
    if (!res.ok) {
      root.innerHTML = `<div style="padding:60px 0; text-align:center;">
        <h2>SKU not found.</h2><p style="color:var(--ink-soft); margin:10px 0 20px;">Check the URL or browse the catalog.</p>
        <a href="catalog.html" class="btn btn-primary">Back to catalog</a></div>`;
      return;
    }
    const { product, related } = await res.json();
    document.title = `${product.sku} ${product.name} - Anvil Supply Co.`;
    document.getElementById('bc-industry').textContent =
      product.industry.charAt(0).toUpperCase() + product.industry.slice(1);

    let qty = product.moq;
    function tierFor(q) {
      const t = product.tier_pricing.slice().reverse().find(t => q >= t.min);
      return t || product.tier_pricing[0];
    }

    function render() {
      const tier = tierFor(qty);
      const stockClass = product.stock < 30 ? 'low' : '';
      root.innerHTML = `
        <div class="product-page">
          <div class="product-page-img">
            <div class="product-page-img-mark">${window.skuMark(product.sku)}</div>
            <div class="product-page-img-sub">
              <span>${product.sku}</span>
              <span>${product.manufacturer}</span>
            </div>
          </div>
          <div class="product-page-info">
            <div class="sku">${product.sku} &middot; ${product.manufacturer}</div>
            <h1>${product.name}</h1>
            <p class="blurb">${product.short_desc}</p>

            <div class="tier-pricing-table">
              <div class="tier-head">
                ${product.tier_pricing.map(t => `<div>${t.min}+ units</div>`).join('')}
              </div>
              <div class="tier-body">
                ${product.tier_pricing.map(t => `
                  <div>
                    <strong>${window.formatMoney(t.price)}</strong>
                    <span>${t.min === 1 ? 'each' : 'per unit'}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="product-stock-row">
              <span>
                <span class="stock-dot ${stockClass}"></span>
                <strong>${product.stock} in stock</strong>
              </span>
              <span>📦 Pack: <strong>${product.pack_size}</strong></span>
              <span>🚚 Lead time: <strong>${product.lead_time}</strong></span>
              <span>📏 MOQ: <strong>${product.moq} ${product.moq === 1 ? 'unit' : 'units'}</strong></span>
            </div>

            <div class="product-qty-row">
              <div class="qty-stepper" role="group" aria-label="Quantity">
                <button data-step="-1">-</button>
                <input id="qty-input" type="number" value="${qty}" min="${product.moq}" step="${product.pack_multiple}">
                <button data-step="+1">+</button>
              </div>
              <button class="btn btn-primary btn-lg" id="add-btn">Add ${qty} to cart - ${window.formatMoney(tier.price * qty)}</button>
              <a href="quote-request.html?sku=${encodeURIComponent(product.sku)}" class="btn btn-ghost btn-lg">Request volume quote</a>
            </div>
            <div style="font-size:12px; color:var(--ink-mute); margin-top:-8px; margin-bottom:14px; font-family:var(--mono);">
              Qty rounds to multiples of ${product.pack_multiple}. Tier price applies when you hit the next break.
            </div>

            <div class="product-tabs">
              <div class="tab-buttons" role="tablist">
                <button class="tab-button active" data-tab="desc">Description</button>
                <button class="tab-button" data-tab="specs">Specifications</button>
                <button class="tab-button" data-tab="shipping">Shipping &amp; lead time</button>
                <button class="tab-button" data-tab="related">Related SKUs</button>
              </div>
              <div class="tab-panel active" data-panel="desc">
                <p style="color:var(--ink-2); line-height:1.7;">${product.description}</p>
                <p style="color:var(--ink-soft); font-size:13px; margin-top:14px;">
                  Listed for B2B/wholesale only. Tier pricing applied automatically at checkout based on quantity in the line item.
                  Customer contract discounts apply on top of tier pricing.
                </p>
              </div>
              <div class="tab-panel" data-panel="specs">
                <table class="spec-table">
                  ${Object.entries(product.specs || {}).map(([k, v]) => `
                    <tr><td>${k.replace(/_/g, ' ')}</td><td>${v}</td></tr>
                  `).join('')}
                </table>
              </div>
              <div class="tab-panel" data-panel="shipping">
                <table class="spec-table">
                  <tr><td>Lead time</td><td>${product.lead_time}</td></tr>
                  <tr><td>Ships from</td><td>${product.specs.ships_from}</td></tr>
                  <tr><td>Free freight over</td><td>$500 per shipment</td></tr>
                  <tr><td>Standard freight</td><td>$35 flat (UAE/SA), $12 LCL local pickup</td></tr>
                  <tr><td>Returns</td><td>30 days, unopened, restocking fee may apply</td></tr>
                </table>
              </div>
              <div class="tab-panel" data-panel="related">
                <p style="color:var(--ink-soft); font-size:13.5px; margin-bottom:10px;">Customers who bought ${product.sku} often bought:</p>
                <ul style="padding-left:18px; line-height:1.9;">
                  ${(related || []).map(r => `<li><a href="product.html?sku=${encodeURIComponent(r.sku)}"><code>${r.sku}</code></a> &mdash; ${r.name}</li>`).join('')}
                </ul>
              </div>
            </div>
          </div>
        </div>
      `;
      wire();
    }

    function wire() {
      const input = document.getElementById('qty-input');
      const step = product.pack_multiple;
      root.querySelectorAll('[data-step]').forEach(b => {
        b.addEventListener('click', () => {
          const dir = b.dataset.step === '-1' ? -1 : 1;
          qty = Math.max(product.moq, qty + dir * step);
          input.value = qty;
          render();
        });
      });
      input.addEventListener('change', () => {
        let n = Number(input.value) || product.moq;
        n = Math.max(product.moq, Math.ceil(n / step) * step);
        qty = n;
        render();
      });
      document.getElementById('add-btn').addEventListener('click', async () => {
        const totals = await window.addToCart(product.sku, qty);
        if (totals) {
          document.getElementById('add-btn').textContent = 'View cart →';
          document.getElementById('add-btn').onclick = () => window.location.href = 'cart.html';
        }
      });
      root.querySelectorAll('.tab-button').forEach(b => {
        b.addEventListener('click', () => {
          const t = b.dataset.tab;
          root.querySelectorAll('.tab-button').forEach(x => x.classList.toggle('active', x === b));
          root.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === t));
        });
      });
    }

    render();

    if (related && related.length) {
      document.getElementById('related-section').style.display = 'block';
      document.getElementById('related-grid').innerHTML = related.map(p => `
        <a href="product.html?sku=${encodeURIComponent(p.sku)}" class="product-card" style="text-decoration:none; color:inherit;">
          <div class="sku">${p.sku} &middot; ${p.manufacturer}</div>
          <h4>${p.name}</h4>
          <div class="blurb">${p.short_desc}</div>
          <div class="row" style="margin-top:6px;"><span class="price">${window.formatMoney(p.unit_price)}</span><span class="moq">MOQ ${p.moq}</span></div>
        </a>
      `).join('');
    }
  }
})();
