/* =========================================================
   Pebble & Co. - checkout flow (shipping > payment > review)
   ========================================================= */
(function () {
  'use strict';

  const state = {
    step: 1,
    cart: null,
    shipping: loadOr('pebble.checkout.shipping', {
      first_name: 'Demo',
      last_name: 'Customer',
      email: 'demo@pebbleandco.test',
      phone: '+971 50 000 0000',
      address1: '12 Maple Lane',
      address2: '',
      city: 'Dubai',
      state: 'DU',
      postal: '00000',
      country: 'AE',
      method: 'standard',
    }),
    payment: loadOr('pebble.checkout.payment', {
      kind: 'card',
      card_name: 'Demo Customer',
      card_number: '4242 4242 4242 4242',
      exp: '12/29',
      cvc: '123',
      save_card: true,
    }),
    placing: false,
  };

  function loadOr(key, fallback) {
    try { return Object.assign({}, fallback, JSON.parse(localStorage.getItem(key) || '{}')); }
    catch (e) { return fallback; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    await refreshCart();
    if (!state.cart.lines.length) {
      window.location.href = 'cart.html';
      return;
    }
    render();
  }

  async function refreshCart() {
    const promo = localStorage.getItem('pebble.promo') || '';
    state.cart = await fetch('/b2c/api/cart?promo=' + encodeURIComponent(promo)).then(r => r.json());
  }

  function render() {
    document.querySelectorAll('[data-step-pill]').forEach(li => {
      const n = Number(li.dataset.stepPill);
      li.classList.toggle('active', n === state.step);
      li.classList.toggle('done', n < state.step);
    });

    const host = document.getElementById('checkout-content');
    if (state.step === 1) host.innerHTML = shippingMarkup();
    else if (state.step === 2) host.innerHTML = paymentMarkup();
    else host.innerHTML = reviewMarkup();

    renderSummary();
    wireForm();
  }

  function renderSummary() {
    const c = state.cart;
    const host = document.getElementById('checkout-summary-content');
    host.innerHTML = `
      <div class="checkout-lines">
        ${c.lines.map(l => `
          <div class="checkout-line">
            <div class="checkout-line-image">
              ${window.makeProductSvg(l.product, { k: 0 })}
              <span class="checkout-line-qty">${l.qty}</span>
            </div>
            <div class="checkout-line-body">
              <div class="checkout-line-name">${l.product.name}</div>
              ${l.variant_name ? `<div class="checkout-line-variant">${l.variant_name}</div>` : ''}
            </div>
            <div class="checkout-line-price">${window.formatMoney(l.line_total)}</div>
          </div>
        `).join('')}
      </div>

      <div style="border-top:1px solid var(--line); margin:14px 0;"></div>

      <div class="summary-row"><span>Subtotal</span><span>${window.formatMoney(c.subtotal)}</span></div>
      ${c.discount > 0 ? `<div class="summary-row discount"><span>Discount</span><span>- ${window.formatMoney(c.discount)}</span></div>` : ''}
      <div class="summary-row"><span>Shipping</span><span>${c.shipping === 0 ? 'Free' : window.formatMoney(c.shipping)}</span></div>
      <div class="summary-row"><span>Tax (5%)</span><span>${window.formatMoney(c.tax)}</span></div>
      <div class="summary-row total"><span>Total</span><span>${window.formatMoney(c.total)}</span></div>

      ${c.promo ? `<div style="font-size:12.5px; color:var(--green); margin-top:8px;">✓ ${c.promo.description}</div>` : ''}
    `;
  }

  /* ===================== Step 1: Shipping ===================== */
  function shippingMarkup() {
    const s = state.shipping;
    return `
      <h2 class="step-heading">Where should we send it?</h2>
      <form id="shipping-form" class="checkout-form" novalidate>
        <div class="form-row form-row-2">
          <div class="form-field">
            <label>First name</label>
            <input name="first_name" value="${esc(s.first_name)}" required>
          </div>
          <div class="form-field">
            <label>Last name</label>
            <input name="last_name" value="${esc(s.last_name)}" required>
          </div>
        </div>
        <div class="form-row form-row-2">
          <div class="form-field">
            <label>Email</label>
            <input name="email" type="email" value="${esc(s.email)}" required>
          </div>
          <div class="form-field">
            <label>Phone</label>
            <input name="phone" value="${esc(s.phone)}" required>
          </div>
        </div>
        <div class="form-field">
          <label>Address</label>
          <input name="address1" value="${esc(s.address1)}" required>
        </div>
        <div class="form-field">
          <label>Apartment, suite, etc. <span style="color:var(--ink-mute); font-weight:400;">(optional)</span></label>
          <input name="address2" value="${esc(s.address2)}">
        </div>
        <div class="form-row form-row-3">
          <div class="form-field">
            <label>City</label>
            <input name="city" value="${esc(s.city)}" required>
          </div>
          <div class="form-field">
            <label>State / Region</label>
            <input name="state" value="${esc(s.state)}" required>
          </div>
          <div class="form-field">
            <label>Postal code</label>
            <input name="postal" value="${esc(s.postal)}" required>
          </div>
        </div>
        <div class="form-field">
          <label>Country</label>
          <select name="country">
            <option value="AE" ${s.country==='AE'?'selected':''}>United Arab Emirates</option>
            <option value="SA" ${s.country==='SA'?'selected':''}>Saudi Arabia</option>
            <option value="US" ${s.country==='US'?'selected':''}>United States</option>
            <option value="GB" ${s.country==='GB'?'selected':''}>United Kingdom</option>
            <option value="DE" ${s.country==='DE'?'selected':''}>Germany</option>
          </select>
        </div>

        <h3 class="step-subheading">Shipping method</h3>
        <div class="ship-method-group">
          <label class="ship-method ${s.method==='standard'?'active':''}">
            <input type="radio" name="method" value="standard" ${s.method==='standard'?'checked':''}>
            <div>
              <div class="ship-method-title">Standard <span class="ship-method-price">${state.cart.subtotal >= 75 ? 'Free' : '$5.99'}</span></div>
              <div class="ship-method-sub">3-5 business days</div>
            </div>
          </label>
          <label class="ship-method ${s.method==='express'?'active':''}">
            <input type="radio" name="method" value="express" ${s.method==='express'?'checked':''}>
            <div>
              <div class="ship-method-title">Express <span class="ship-method-price">$14.99</span></div>
              <div class="ship-method-sub">1-2 business days</div>
            </div>
          </label>
          <label class="ship-method ${s.method==='pickup'?'active':''}">
            <input type="radio" name="method" value="pickup" ${s.method==='pickup'?'checked':''}>
            <div>
              <div class="ship-method-title">Local pickup <span class="ship-method-price">Free</span></div>
              <div class="ship-method-sub">Ready in 24 hours at Pebble Studio, Dubai</div>
            </div>
          </label>
        </div>

        <div class="checkout-nav">
          <a href="cart.html" class="btn btn-ghost">&larr; Back to cart</a>
          <button class="btn btn-primary btn-lg" type="submit">Continue to payment &rarr;</button>
        </div>
      </form>
    `;
  }

  /* ===================== Step 2: Payment ===================== */
  function paymentMarkup() {
    const p = state.payment;
    return `
      <h2 class="step-heading">How are you paying?</h2>
      <form id="payment-form" class="checkout-form" novalidate>
        <div class="pay-method-tabs">
          <label class="pay-tab ${p.kind==='card'?'active':''}">
            <input type="radio" name="kind" value="card" ${p.kind==='card'?'checked':''}>
            <span>💳 Card</span>
          </label>
          <label class="pay-tab ${p.kind==='paypal'?'active':''}">
            <input type="radio" name="kind" value="paypal" ${p.kind==='paypal'?'checked':''}>
            <span>PayPal</span>
          </label>
          <label class="pay-tab ${p.kind==='cod'?'active':''}">
            <input type="radio" name="kind" value="cod" ${p.kind==='cod'?'checked':''}>
            <span>Cash on delivery</span>
          </label>
        </div>

        <div data-pay-pane="card" style="${p.kind==='card'?'':'display:none;'}">
          <div class="form-field">
            <label>Name on card</label>
            <input name="card_name" value="${esc(p.card_name)}">
          </div>
          <div class="form-field">
            <label>Card number</label>
            <input name="card_number" inputmode="numeric" value="${esc(p.card_number)}" maxlength="19">
          </div>
          <div class="form-row form-row-2">
            <div class="form-field">
              <label>Expiry</label>
              <input name="exp" placeholder="MM/YY" value="${esc(p.exp)}" maxlength="5">
            </div>
            <div class="form-field">
              <label>CVC</label>
              <input name="cvc" inputmode="numeric" value="${esc(p.cvc)}" maxlength="4">
            </div>
          </div>
          <label style="display:flex; align-items:center; gap:8px; font-size:14px; color:var(--ink-soft); margin-top:6px;">
            <input type="checkbox" name="save_card" ${p.save_card?'checked':''}>
            Save this card for next time (mock only)
          </label>
          <div class="pay-disclaimer">
            🔒 This is a demo - no real payment is processed. The pre-filled card is the standard test number used by every payment SDK.
          </div>
        </div>

        <div data-pay-pane="paypal" style="${p.kind==='paypal'?'':'display:none;'}">
          <div style="padding:32px; border:2px dashed var(--line); border-radius:var(--radius); text-align:center; color:var(--ink-soft);">
            <p style="margin-bottom:8px;">In a real store this is where the PayPal redirect would live.</p>
            <p style="font-size:13px;">Click "Continue to review" - we'll pretend you signed in.</p>
          </div>
        </div>

        <div data-pay-pane="cod" style="${p.kind==='cod'?'':'display:none;'}">
          <div style="padding:24px; background:var(--surface-2); border-radius:var(--radius);">
            <h4 style="font-family:var(--display); font-size:18px; margin-bottom:8px;">Pay when it arrives</h4>
            <p style="color:var(--ink-soft); font-size:14px;">
              Available in UAE and Saudi Arabia only. The courier collects cash on delivery.
              A small handling fee of $2 is added at the review step.
            </p>
          </div>
        </div>

        <h3 class="step-subheading">Billing address</h3>
        <label style="display:flex; align-items:center; gap:8px; font-size:14px; margin-bottom:14px;">
          <input type="checkbox" id="same-billing" checked> Same as shipping address
        </label>

        <div class="checkout-nav">
          <button class="btn btn-ghost" type="button" data-back>&larr; Back to shipping</button>
          <button class="btn btn-primary btn-lg" type="submit">Continue to review &rarr;</button>
        </div>
      </form>
    `;
  }

  /* ===================== Step 3: Review ===================== */
  function reviewMarkup() {
    const s = state.shipping;
    const p = state.payment;
    const payDisplay = p.kind === 'card'
      ? `Card ending in <strong>${(p.card_number || '').replace(/\s/g,'').slice(-4)}</strong>`
      : p.kind === 'paypal' ? 'PayPal'
      : 'Cash on delivery';
    return `
      <h2 class="step-heading">Looks good?</h2>
      <p style="color:var(--ink-soft); margin-bottom:24px; font-size:14.5px;">
        Quick review then we place the order. Nothing is actually charged or shipped - this is a portfolio demo.
      </p>

      <div class="review-grid">
        <div class="review-card">
          <div class="review-card-head">
            <h4>Shipping</h4>
            <button class="btn-link" data-jump="1">Edit</button>
          </div>
          <p>${esc(s.first_name)} ${esc(s.last_name)}</p>
          <p>${esc(s.address1)}${s.address2 ? ', ' + esc(s.address2) : ''}</p>
          <p>${esc(s.city)}, ${esc(s.state)} ${esc(s.postal)}</p>
          <p>${esc(s.country)}</p>
          <p style="margin-top:8px; color:var(--ink-soft); font-size:13px;">${esc(s.email)} &middot; ${esc(s.phone)}</p>
        </div>

        <div class="review-card">
          <div class="review-card-head">
            <h4>Method</h4>
            <button class="btn-link" data-jump="1">Edit</button>
          </div>
          <p>${s.method === 'standard' ? 'Standard - 3-5 business days'
              : s.method === 'express' ? 'Express - 1-2 business days'
              : 'Local pickup at Pebble Studio'}</p>
        </div>

        <div class="review-card">
          <div class="review-card-head">
            <h4>Payment</h4>
            <button class="btn-link" data-jump="2">Edit</button>
          </div>
          <p>${payDisplay}</p>
        </div>
      </div>

      <h3 class="step-subheading">Order notes <span style="color:var(--ink-mute); font-weight:400; font-size:13px;">(optional)</span></h3>
      <textarea id="order-notes" placeholder="Anything we should know? Gift wrap, delivery instructions..." style="width:100%; min-height:80px; padding:12px 14px; border:1.5px solid var(--line); border-radius:var(--radius); font-family:inherit; font-size:14px; resize:vertical;"></textarea>

      <div style="margin-top:18px;">
        <label style="display:flex; align-items:flex-start; gap:10px; font-size:13.5px; color:var(--ink-soft);">
          <input type="checkbox" id="agree" checked style="margin-top:3px;">
          <span>I agree to the demo terms and confirm this is a portfolio demonstration, not a real purchase.</span>
        </label>
      </div>

      <div class="checkout-nav">
        <button class="btn btn-ghost" type="button" data-back>&larr; Back to payment</button>
        <button class="btn btn-primary btn-lg" id="place-order" type="button">
          Place order - ${window.formatMoney(state.cart.total)}
        </button>
      </div>
    `;
  }

  /* ===================== Wire forms ===================== */
  function wireForm() {
    if (state.step === 1) {
      const form = document.getElementById('shipping-form');
      form.querySelectorAll('input[name="method"]').forEach(r => {
        r.addEventListener('change', () => {
          form.querySelectorAll('.ship-method').forEach(el => el.classList.remove('active'));
          r.closest('.ship-method').classList.add('active');
        });
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        for (const [k, v] of fd.entries()) state.shipping[k] = v;
        save('pebble.checkout.shipping', state.shipping);
        state.step = 2;
        scrollTop();
        render();
      });
    }

    if (state.step === 2) {
      const form = document.getElementById('payment-form');
      form.querySelectorAll('input[name="kind"]').forEach(r => {
        r.addEventListener('change', () => {
          form.querySelectorAll('.pay-tab').forEach(el => el.classList.remove('active'));
          r.closest('.pay-tab').classList.add('active');
          form.querySelectorAll('[data-pay-pane]').forEach(p => {
            p.style.display = p.dataset.payPane === r.value ? '' : 'none';
          });
        });
      });
      form.querySelector('[data-back]').addEventListener('click', () => { state.step = 1; scrollTop(); render(); });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        state.payment.kind = fd.get('kind');
        ['card_name','card_number','exp','cvc'].forEach(k => state.payment[k] = fd.get(k) || state.payment[k]);
        state.payment.save_card = !!fd.get('save_card');
        save('pebble.checkout.payment', state.payment);
        state.step = 3;
        scrollTop();
        render();
      });
    }

    if (state.step === 3) {
      document.querySelector('[data-back]').addEventListener('click', () => { state.step = 2; scrollTop(); render(); });
      document.querySelectorAll('[data-jump]').forEach(b => {
        b.addEventListener('click', () => { state.step = Number(b.dataset.jump); scrollTop(); render(); });
      });
      document.getElementById('place-order').addEventListener('click', placeOrder);
    }
  }

  async function placeOrder() {
    if (state.placing) return;
    const agree = document.getElementById('agree');
    if (!agree.checked) {
      window.toast('Please accept the demo terms', 'error');
      return;
    }
    state.placing = true;
    const btn = document.getElementById('place-order');
    btn.disabled = true;
    btn.textContent = 'Placing order...';

    const notes = document.getElementById('order-notes').value.trim();
    const res = await fetch('/b2c/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shipping: state.shipping,
        payment: { kind: state.payment.kind, last4: (state.payment.card_number || '').replace(/\s/g,'').slice(-4) },
        notes,
        promo: localStorage.getItem('pebble.promo') || null,
      }),
    });
    const data = await res.json();
    if (!data.success) {
      state.placing = false;
      btn.disabled = false;
      btn.textContent = `Place order - ${window.formatMoney(state.cart.total)}`;
      window.toast(data.error || 'Something went wrong', 'error');
      return;
    }
    localStorage.removeItem('pebble.promo');
    window.location.href = `success.html?order=${encodeURIComponent(data.order.id)}`;
  }

  function scrollTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
