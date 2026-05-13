/* =========================================================
   Anvil Supply Co. - checkout flow
   3 steps: details > approval/terms > review > submit
   ========================================================= */
(function () {
  'use strict';

  const state = {
    step: 1,
    cart: null,
    me: null,
    details: load('anvil.checkout.details', {
      po_number: sessionStorage.getItem('anvil.po') || '',
      ship_to_id: '',
      attention: '',
      requested_date: '',
      notes: '',
    }),
    approval: load('anvil.checkout.approval', {
      payment_terms: '',
      approver_email: '',
      cost_center: '',
    }),
    placing: false,
  };

  function load(k, fb) {
    try { return Object.assign({}, fb, JSON.parse(localStorage.getItem(k) || '{}')); }
    catch (e) { return fb; }
  }
  function save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    [state.me, state.cart] = await Promise.all([
      fetch('/b2b/api/me').then(r => r.json()),
      fetch('/b2b/api/cart').then(r => r.json()),
    ]);
    if (!state.cart.lines.length) {
      window.location.href = 'cart.html';
      return;
    }
    if (!state.details.ship_to_id) state.details.ship_to_id = state.me.company.ship_to[0].id;
    if (!state.approval.payment_terms) state.approval.payment_terms = state.me.company.payment_terms;
    render();
  }

  function render() {
    document.querySelectorAll('[data-pill]').forEach(li => {
      const n = Number(li.dataset.pill);
      li.classList.toggle('active', n === state.step);
      li.classList.toggle('done', n < state.step);
    });

    const host = document.getElementById('checkout-content');
    if (state.step === 1) host.innerHTML = step1();
    if (state.step === 2) host.innerHTML = step2();
    if (state.step === 3) host.innerHTML = step3();
    renderSummary();
    wire();
  }

  function step1() {
    const ship = state.me.company.ship_to;
    return `
      <div class="checkout-card">
        <h2 class="step-heading">Order details</h2>

        <div class="checkout-form-grid">
          <div class="field full">
            <label>Purchase order number <span style="color:var(--red);">*</span></label>
            <input type="text" id="po-number" value="${esc(state.details.po_number)}" placeholder="e.g. PO-2026-12345" required>
            <span class="hint">Required for invoicing. Free format - we mirror it on your invoice.</span>
          </div>
        </div>

        <h3 class="step-subheading">Ship to</h3>
        <div class="option-card-group">
          ${ship.map(s => `
            <label class="option-card ${state.details.ship_to_id === s.id ? 'active' : ''}">
              <input type="radio" name="ship_to" value="${s.id}" ${state.details.ship_to_id === s.id ? 'checked' : ''}>
              <div class="option-card-body">
                <div class="option-card-title">
                  <span>${esc(s.label)}${s.default ? ' <span class="badge badge-navy" style="margin-left:6px;">DEFAULT</span>' : ''}</span>
                </div>
                <div class="option-card-sub">${esc(s.line1)} &middot; ${esc(s.city)}, ${esc(s.country)}</div>
              </div>
            </label>
          `).join('')}
        </div>
        <button class="btn-link" style="margin-top:6px;" id="add-shipto">+ Add a new ship-to (demo)</button>

        <h3 class="step-subheading">Delivery details</h3>
        <div class="checkout-form-grid">
          <div class="field">
            <label>Attention / recipient</label>
            <input type="text" id="attention" value="${esc(state.details.attention)}" placeholder="e.g. Warehouse supervisor">
          </div>
          <div class="field">
            <label>Requested delivery date</label>
            <input type="text" id="req-date" value="${esc(state.details.requested_date)}" placeholder="ASAP / 2026-06-12">
          </div>
          <div class="field full">
            <label>Delivery notes</label>
            <textarea id="notes" placeholder="Gate code, dock hours, anything we should know about the drop.">${esc(state.details.notes)}</textarea>
          </div>
        </div>

        <div class="checkout-nav">
          <a href="cart.html" class="btn btn-ghost">&larr; Back to cart</a>
          <button class="btn btn-primary btn-lg" id="step1-next">Continue to approval &rarr;</button>
        </div>
      </div>
    `;
  }

  function step2() {
    const needsApproval = state.cart.total >= 1000;
    return `
      <div class="checkout-card">
        <h2 class="step-heading">Approval &amp; payment terms</h2>

        ${needsApproval ? `
          <div class="approval-banner">
            ⚠ <strong>Approval required.</strong> Order total ${window.formatMoney(state.cart.total)} exceeds your auto-approve limit of $1,000.
            We'll route this to an approver before the order is released.
          </div>
        ` : `
          <div class="approval-banner" style="background:#ecf6ee; border-color:#b9d8c0; color:#1e5a30;">
            ✓ <strong>No approval needed.</strong> Order total ${window.formatMoney(state.cart.total)} is below your $1,000 auto-approve threshold.
          </div>
        `}

        ${needsApproval ? `
          <h3 class="step-subheading">Route for approval</h3>
          <div class="option-card-group">
            ${state.me.company.users.filter(u => u.role === 'approver').map(u => `
              <label class="option-card ${state.approval.approver_email === u.email ? 'active' : ''}">
                <input type="radio" name="approver" value="${u.email}" ${state.approval.approver_email === u.email ? 'checked' : ''}>
                <div class="option-card-body">
                  <div class="option-card-title"><span>${esc(u.name)}</span></div>
                  <div class="option-card-sub">${esc(u.email)} &middot; ${u.role}</div>
                </div>
              </label>
            `).join('') || '<div style="color:var(--ink-soft); font-size:13.5px;">No approvers on file for this account. Add one in account settings.</div>'}
          </div>
        ` : ''}

        <h3 class="step-subheading">Payment terms</h3>
        <div class="option-card-group">
          ${['Net 30', 'Net 60', 'Advance', 'Card on file'].map(term => `
            <label class="option-card ${state.approval.payment_terms === term ? 'active' : ''} ${state.me.company.payment_terms === term ? '' : ''}">
              <input type="radio" name="payment_terms" value="${term}" ${state.approval.payment_terms === term ? 'checked' : ''}>
              <div class="option-card-body">
                <div class="option-card-title">
                  <span>${term}</span>
                  ${state.me.company.payment_terms === term ? '<span class="badge badge-green">CONTRACT</span>' : ''}
                </div>
                <div class="option-card-sub">${termHint(term)}</div>
              </div>
            </label>
          `).join('')}
        </div>

        <h3 class="step-subheading">Cost center (optional)</h3>
        <div class="field">
          <input type="text" id="cost-center" value="${esc(state.approval.cost_center)}" placeholder="e.g. CC-4400 / Maintenance">
        </div>

        <div class="checkout-nav">
          <button class="btn btn-ghost" id="back-1">&larr; Back</button>
          <button class="btn btn-primary btn-lg" id="step2-next">Continue to review &rarr;</button>
        </div>
      </div>
    `;
  }

  function termHint(t) {
    if (t === 'Net 30') return 'Pay within 30 days of invoice. Default for contract accounts.';
    if (t === 'Net 60') return 'Pay within 60 days. Available for accounts with credit limit > $50,000.';
    if (t === 'Advance') return 'Pay before dispatch. No credit risk.';
    return 'Charged to card ending 4242 (demo).';
  }

  function step3() {
    const ship = state.me.company.ship_to.find(s => s.id === state.details.ship_to_id);
    return `
      <div class="checkout-card">
        <h2 class="step-heading">Review &amp; place order</h2>
        <p style="font-size:13.5px; color:var(--ink-soft); margin-bottom:18px;">Demo: clicking place order creates a mock order in your account. Nothing is actually charged or shipped.</p>

        <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:18px;">
          <div style="background:var(--surface-2); border-radius:var(--r); padding:14px;">
            <h4 style="font-size:11px; text-transform:uppercase; letter-spacing:0.6px; color:var(--ink-mute);">Bill to</h4>
            <p style="font-size:14px; margin-top:6px;"><strong>${esc(state.me.company.name)}</strong></p>
            <p style="font-size:13px; color:var(--ink-soft);">Account ${state.me.company.id} &middot; ${state.me.company.tier}</p>
            <p style="font-size:13px; color:var(--ink-soft);">Terms: ${esc(state.approval.payment_terms)}</p>
          </div>
          <div style="background:var(--surface-2); border-radius:var(--r); padding:14px;">
            <h4 style="font-size:11px; text-transform:uppercase; letter-spacing:0.6px; color:var(--ink-mute);">Ship to</h4>
            <p style="font-size:14px; margin-top:6px;"><strong>${esc(ship.label)}</strong></p>
            <p style="font-size:13px; color:var(--ink-soft);">${esc(ship.line1)}</p>
            <p style="font-size:13px; color:var(--ink-soft);">${esc(ship.city)}, ${esc(ship.country)}</p>
            ${state.details.attention ? `<p style="font-size:13px; color:var(--ink-soft);">Attn: ${esc(state.details.attention)}</p>` : ''}
          </div>
        </div>

        <div style="background:var(--surface-2); border-radius:var(--r); padding:14px; margin-bottom:18px;">
          <h4 style="font-size:11px; text-transform:uppercase; letter-spacing:0.6px; color:var(--ink-mute);">References</h4>
          <p style="font-size:13.5px; margin-top:4px;"><strong>PO:</strong> <code>${esc(state.details.po_number || '(none)')}</code></p>
          ${state.approval.cost_center ? `<p style="font-size:13.5px;"><strong>Cost center:</strong> <code>${esc(state.approval.cost_center)}</code></p>` : ''}
          ${state.details.requested_date ? `<p style="font-size:13.5px;"><strong>Requested delivery:</strong> ${esc(state.details.requested_date)}</p>` : ''}
          ${state.cart.total >= 1000 ? `<p style="font-size:13.5px;"><strong>Approver:</strong> ${esc(state.approval.approver_email || 'not selected')}</p>` : ''}
        </div>

        <h3 class="step-subheading">Items</h3>
        <table class="product-table" style="margin-bottom:18px;">
          <thead><tr><th>SKU</th><th>Name</th><th>Qty</th><th style="text-align:right;">Unit</th><th style="text-align:right;">Line total</th></tr></thead>
          <tbody>
            ${state.cart.lines.map(l => `
              <tr>
                <td class="sku-cell">${l.product.sku}</td>
                <td>${esc(l.product.name)}</td>
                <td style="font-family:var(--mono);">${l.qty}</td>
                <td style="font-family:var(--mono); text-align:right;">${window.formatMoney(l.unit_price)}</td>
                <td style="font-family:var(--mono); text-align:right; font-weight:600;">${window.formatMoney(l.line_total)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <label style="display:flex; align-items:flex-start; gap:10px; font-size:13px; color:var(--ink-soft); margin-top:12px;">
          <input type="checkbox" id="agree" checked style="margin-top:3px;">
          <span>I confirm this is a portfolio demonstration. No real order will be created or shipped.</span>
        </label>

        <div class="checkout-nav">
          <button class="btn btn-ghost" id="back-2">&larr; Back</button>
          <button class="btn btn-orange btn-lg" id="place-order">
            ${state.cart.total >= 1000 ? 'Submit for approval' : 'Place order'} - ${window.formatMoney(state.cart.total)}
          </button>
        </div>
      </div>
    `;
  }

  function renderSummary() {
    const c = state.cart;
    document.getElementById('checkout-summary').innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:14px;">
        ${c.lines.map(l => `
          <div style="display:flex; justify-content:space-between; gap:10px; font-size:13px;">
            <div style="min-width:0; flex:1;">
              <div style="font-family:var(--mono); font-size:12px; color:var(--navy); font-weight:600;">${l.product.sku} &times; ${l.qty}</div>
              <div style="color:var(--ink-soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(l.product.name)}</div>
            </div>
            <div style="font-family:var(--mono); font-weight:600; text-align:right;">${window.formatMoney(l.line_total)}</div>
          </div>
        `).join('')}
      </div>

      <div style="border-top:1px solid var(--line); padding-top:10px;"></div>
      <div class="summary-row"><span>Subtotal</span><span style="font-family:var(--mono);">${window.formatMoney(c.subtotal)}</span></div>
      ${c.discount > 0 ? `<div class="summary-row discount"><span>Contract discount</span><span>- ${window.formatMoney(c.discount)}</span></div>` : ''}
      <div class="summary-row"><span>Freight</span><span style="font-family:var(--mono);">${c.freight === 0 ? 'Free' : window.formatMoney(c.freight)}</span></div>
      <div class="summary-row"><span>Tax</span><span style="font-family:var(--mono);">${window.formatMoney(c.tax)}</span></div>
      <div class="summary-row total"><span>Total</span><span>${window.formatMoney(c.total)}</span></div>
    `;
  }

  function wire() {
    if (state.step === 1) {
      document.getElementById('step1-next').addEventListener('click', () => {
        const po = document.getElementById('po-number').value.trim();
        if (!po) { window.toast('PO number is required', 'error'); return; }
        state.details.po_number = po;
        state.details.attention = document.getElementById('attention').value.trim();
        state.details.requested_date = document.getElementById('req-date').value.trim();
        state.details.notes = document.getElementById('notes').value.trim();
        const ship = document.querySelector('input[name="ship_to"]:checked');
        if (ship) state.details.ship_to_id = ship.value;
        save('anvil.checkout.details', state.details);
        state.step = 2;
        scrollTop(); render();
      });
      document.querySelectorAll('input[name="ship_to"]').forEach(r => {
        r.addEventListener('change', () => {
          document.querySelectorAll('.option-card-group .option-card').forEach(c => c.classList.remove('active'));
          r.closest('.option-card').classList.add('active');
        });
      });
      document.getElementById('add-shipto').addEventListener('click', () => window.toast('Add ship-to coming soon (demo)', 'success'));
    }

    if (state.step === 2) {
      document.getElementById('back-1').addEventListener('click', () => { state.step = 1; scrollTop(); render(); });
      document.getElementById('step2-next').addEventListener('click', () => {
        const term = document.querySelector('input[name="payment_terms"]:checked');
        const approver = document.querySelector('input[name="approver"]:checked');
        if (!term) { window.toast('Pick a payment term', 'error'); return; }
        state.approval.payment_terms = term.value;
        if (approver) state.approval.approver_email = approver.value;
        state.approval.cost_center = document.getElementById('cost-center').value.trim();
        save('anvil.checkout.approval', state.approval);
        state.step = 3;
        scrollTop(); render();
      });
      document.querySelectorAll('input[name="payment_terms"], input[name="approver"]').forEach(r => {
        r.addEventListener('change', () => {
          const group = r.closest('.option-card-group');
          group.querySelectorAll('.option-card').forEach(c => c.classList.remove('active'));
          r.closest('.option-card').classList.add('active');
        });
      });
    }

    if (state.step === 3) {
      document.getElementById('back-2').addEventListener('click', () => { state.step = 2; scrollTop(); render(); });
      document.getElementById('place-order').addEventListener('click', placeOrder);
    }
  }

  async function placeOrder() {
    if (state.placing) return;
    const agree = document.getElementById('agree');
    if (!agree.checked) { window.toast('Please accept the demo terms', 'error'); return; }
    state.placing = true;
    const btn = document.getElementById('place-order');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    const shipTo = state.me.company.ship_to.find(s => s.id === state.details.ship_to_id);
    const res = await fetch('/b2b/api/checkout', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        po_number: state.details.po_number,
        ship_to: shipTo,
        attention: state.details.attention,
        requested_date: state.details.requested_date,
        notes: state.details.notes,
        payment_terms: state.approval.payment_terms,
        approver_email: state.approval.approver_email,
        cost_center: state.approval.cost_center,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      state.placing = false;
      btn.disabled = false;
      btn.textContent = 'Place order';
      window.toast(data.error || 'Submission failed', 'error');
      return;
    }
    sessionStorage.removeItem('anvil.po');
    window.location.href = `success.html?order=${encodeURIComponent(data.order.id)}`;
  }

  function scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
