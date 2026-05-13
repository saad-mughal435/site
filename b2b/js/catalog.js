/* =========================================================
   Anvil Supply Co. - catalog page
   ========================================================= */
(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const state = {
    industry: params.get('industry') || 'all',
    manufacturer: '',
    in_stock: false,
    max_moq: '',
    min_price: '',
    max_price: '',
    search: params.get('search') || '',
    sort: 'sku',
    view: localStorage.getItem('anvil.view') || 'table',
  };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await renderFilters();
    document.getElementById('sort-select').addEventListener('change', (e) => { state.sort = e.target.value; refresh(); });
    document.querySelectorAll('#view-toggle button').forEach(b => {
      b.classList.toggle('active', b.dataset.view === state.view);
      b.addEventListener('click', () => {
        state.view = b.dataset.view;
        localStorage.setItem('anvil.view', state.view);
        document.querySelectorAll('#view-toggle button').forEach(x => x.classList.toggle('active', x === b));
        renderResults();
      });
    });
    document.getElementById('bulk-preview').addEventListener('click', bulkPreview);
    document.getElementById('bulk-add-cart').addEventListener('click', bulkAddToCart);
    await refresh();
  }

  async function renderFilters() {
    const [{ items: industries }, { items: makers }] = await Promise.all([
      fetch('/b2b/api/industries').then(r => r.json()),
      fetch('/b2b/api/manufacturers').then(r => r.json()),
    ]);
    document.getElementById('filters').innerHTML = `
      <div class="filters-section">
        <div class="filters-label">Industry</div>
        <label class="filter-option ${state.industry === 'all' ? 'active' : ''}">
          <input type="radio" name="industry" value="all" ${state.industry === 'all' ? 'checked' : ''}> All industries
        </label>
        ${industries.map(i => `
          <label class="filter-option ${state.industry === i.slug ? 'active' : ''}">
            <input type="radio" name="industry" value="${i.slug}" ${state.industry === i.slug ? 'checked' : ''}>
            ${i.name}
          </label>
        `).join('')}
      </div>

      <div class="filters-section">
        <div class="filters-label">Manufacturer</div>
        <select class="filter-input" id="f-mfr">
          <option value="">All</option>
          ${makers.map(m => `<option value="${m}" ${state.manufacturer === m ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
      </div>

      <div class="filters-section">
        <div class="filters-label">Availability</div>
        <label class="filter-option ${state.in_stock ? 'active' : ''}">
          <input type="checkbox" id="f-stock" ${state.in_stock ? 'checked' : ''}> In stock only
        </label>
      </div>

      <div class="filters-section">
        <div class="filters-label">MOQ ≤</div>
        <input class="filter-input" type="number" id="f-moq" placeholder="any" value="${state.max_moq}">
      </div>

      <div class="filters-section">
        <div class="filters-label">Price range</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px;">
          <input class="filter-input" type="number" id="f-min" placeholder="Min" value="${state.min_price}">
          <input class="filter-input" type="number" id="f-max" placeholder="Max" value="${state.max_price}">
        </div>
      </div>

      <div class="filters-section">
        <div class="filters-label">Search</div>
        <input class="filter-input" type="text" id="f-search" placeholder="Name, SKU, blurb..." value="${state.search}">
      </div>
    `;

    document.querySelectorAll('[name="industry"]').forEach(r => r.addEventListener('change', () => {
      state.industry = r.value;
      document.querySelectorAll('.filters-section [name="industry"]').forEach(x => x.parentElement.classList.toggle('active', x.value === r.value));
      refresh();
    }));
    document.getElementById('f-mfr').addEventListener('change', (e) => { state.manufacturer = e.target.value; refresh(); });
    document.getElementById('f-stock').addEventListener('change', (e) => { state.in_stock = e.target.checked; refresh(); });
    document.getElementById('f-moq').addEventListener('input', debounce((e) => { state.max_moq = e.target.value; refresh(); }, 220));
    document.getElementById('f-min').addEventListener('input', debounce((e) => { state.min_price = e.target.value; refresh(); }, 220));
    document.getElementById('f-max').addEventListener('input', debounce((e) => { state.max_price = e.target.value; refresh(); }, 220));
    document.getElementById('f-search').addEventListener('input', debounce((e) => { state.search = e.target.value; refresh(); }, 220));
  }

  function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }

  let lastItems = [];

  async function refresh() {
    const q = new URLSearchParams();
    if (state.industry !== 'all') q.set('industry', state.industry);
    if (state.manufacturer) q.set('manufacturer', state.manufacturer);
    if (state.in_stock) q.set('in_stock', 'true');
    if (state.max_moq) q.set('max_moq', state.max_moq);
    if (state.search) q.set('search', state.search);
    if (state.sort) q.set('sort', state.sort);

    let { items } = await fetch('/b2b/api/products?' + q).then(r => r.json());
    if (state.min_price) items = items.filter(p => p.unit_price >= Number(state.min_price));
    if (state.max_price) items = items.filter(p => p.unit_price <= Number(state.max_price));
    lastItems = items;

    document.getElementById('catalog-count').textContent =
      `${items.length} SKU${items.length === 1 ? '' : 's'} ${state.industry !== 'all' ? '&middot; ' + state.industry : ''}`;
    document.getElementById('catalog-sub').textContent =
      state.industry === 'all'
        ? 'Browse, filter, paste a SKU list, or jump in.'
        : `${capitalize(state.industry)} - ${items.length} products in stock or available to order.`;
    document.getElementById('catalog-heading').textContent =
      state.industry === 'all' ? 'Full catalog' : capitalize(state.industry);

    renderResults();
  }

  function renderResults() {
    const host = document.getElementById('catalog-body');
    if (!lastItems.length) {
      host.innerHTML = `<div style="padding:40px; text-align:center; color:var(--ink-soft); background:var(--surface); border:1px solid var(--line); border-radius:var(--r-lg);">No SKUs match these filters. Clear the search or try All industries.</div>`;
      return;
    }
    host.innerHTML = state.view === 'table' ? tableMarkup(lastItems) : gridMarkup(lastItems);
    wireRows();
  }

  function tableMarkup(items) {
    return `
      <table class="product-table">
        <thead><tr>
          <th>SKU</th><th>Product</th><th>Pack</th><th>MOQ</th><th>Tier pricing</th><th>Stock</th><th>Qty</th><th></th>
        </tr></thead>
        <tbody>
          ${items.map(p => `
            <tr data-sku="${p.sku}">
              <td class="sku-cell"><a href="product.html?sku=${encodeURIComponent(p.sku)}">${p.sku}</a></td>
              <td class="name-cell">
                <strong>${p.name}</strong>
                <span>${p.manufacturer}</span>
              </td>
              <td><span style="font-family:var(--mono); font-size:12.5px;">${p.pack_size}</span></td>
              <td style="font-family:var(--mono);">${p.moq}</td>
              <td class="tier-cell">
                ${p.tier_pricing.map(t => `<div><span>${t.min}+</span> <span>$${t.price.toFixed(2)}</span></div>`).join('')}
              </td>
              <td>
                <span class="badge ${p.stock < 30 ? 'badge-red' : p.stock < 80 ? 'badge-amber' : 'badge-green'}">${p.stock}</span>
              </td>
              <td><input class="qty-input" type="number" min="0" step="${p.pack_multiple}" placeholder="${p.moq}"></td>
              <td style="text-align:right;">
                <button class="btn btn-primary btn-sm" data-add>Add</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function gridMarkup(items) {
    return `
      <div class="product-grid">
        ${items.map(p => `
          <div class="product-card" data-sku="${p.sku}">
            <div class="sku">${p.sku} &middot; ${p.manufacturer}</div>
            <h4>${p.name}</h4>
            <div class="blurb">${p.short_desc}</div>
            <div class="row"><span>Pack</span><span class="moq">${p.pack_size}</span></div>
            <div class="row"><span>MOQ</span><span class="moq">${p.moq}</span></div>
            <div class="row"><span>Stock</span><span class="stock ${p.stock < 30 ? 'low' : 'ok'}">${p.stock} in DC</span></div>
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-top:6px;">
              <span class="price">${window.formatMoney(p.unit_price)}</span>
              <a href="product.html?sku=${encodeURIComponent(p.sku)}" class="btn-link" style="font-size:12.5px;">Details &rarr;</a>
            </div>
            <div class="add-row">
              <input type="number" min="0" step="${p.pack_multiple}" placeholder="${p.moq}">
              <button class="btn btn-primary btn-sm" data-add>Add</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  function wireRows() {
    document.querySelectorAll('[data-sku]').forEach(row => {
      const addBtn = row.querySelector('[data-add]');
      const input = row.querySelector('input');
      if (!addBtn || !input) return;
      addBtn.addEventListener('click', async (e) => {
        e.preventDefault(); e.stopPropagation();
        const qty = Math.max(Number(input.value) || 0, 0);
        if (!qty) { window.toast('Enter a quantity', 'error'); return; }
        const totals = await window.addToCart(row.dataset.sku, qty);
        if (totals) input.value = '';
      });
    });
  }

  /* ---- Bulk SKU paste ---- */
  let bulkMatches = [];

  async function bulkPreview() {
    const lines = document.getElementById('bulk-input').value
      .split('\n').map(s => s.trim()).filter(Boolean);
    if (!lines.length) { window.toast('Paste at least one SKU', 'error'); return; }
    const res = await fetch('/b2b/api/bulk-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skus: lines }),
    });
    const { items } = await res.json();
    bulkMatches = items.filter(i => i.match && i.qty > 0);
    const missCount = items.length - bulkMatches.length;
    const total = bulkMatches.reduce((s, i) => s + i.line_total, 0);
    document.getElementById('bulk-summary').innerHTML =
      `${bulkMatches.length} matched &middot; ${missCount} not found &middot; <strong>${window.formatMoney(total)}</strong>`;
    document.getElementById('bulk-results').innerHTML = items.map(it => {
      if (!it.match) return `<div class="bulk-result miss"><strong>${it.sku}</strong><span>SKU not found</span><span></span><span></span></div>`;
      return `
        <div class="bulk-result">
          <strong style="font-family:var(--mono);">${it.sku}</strong>
          <span style="color:var(--ink);">${it.product.name}</span>
          <span style="font-family:var(--mono); text-align:right;">qty ${it.qty}</span>
          <span class="ok">${window.formatMoney(it.line_total)}</span>
        </div>
      `;
    }).join('');
    document.getElementById('bulk-add-cart').disabled = !bulkMatches.length;
  }

  async function bulkAddToCart() {
    if (!bulkMatches.length) return;
    const btn = document.getElementById('bulk-add-cart');
    btn.disabled = true;
    btn.textContent = 'Adding...';
    for (const item of bulkMatches) {
      await fetch('/b2b/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: item.sku, qty: item.qty, action: 'add' }),
      });
    }
    btn.disabled = false;
    btn.textContent = 'Add matched to cart';
    window.toast(`Added ${bulkMatches.length} SKU(s) to cart`, 'success');
    document.getElementById('bulk-input').value = '';
    document.getElementById('bulk-results').innerHTML = '';
    document.getElementById('bulk-summary').textContent = '';
    bulkMatches = [];
    // refresh cart icon
    const totals = await fetch('/b2b/api/cart').then(r => r.json());
    window.updateCartIcon(totals);
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
})();
