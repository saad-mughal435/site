/* checkout.js — Booking confirmation flow with conflict re-check */
(function () {
  'use strict';

  function load() {
    var pending = VacationApp.jget('vacation.pending_quote', null);
    if (!pending) {
      document.getElementById('checkout-host').innerHTML = '<div class="v-empty"><h3>No pending booking</h3><p>Start by picking a stay and dates.</p><a class="v-btn v-btn--primary" href="search.html">Browse stays →</a></div>';
      return;
    }
    VacationApp.api('/listings/' + pending.listing_id).then(function (r) {
      if (!r.body.ok) { document.getElementById('checkout-host').innerHTML = '<div class="v-empty"><h3>Listing not available</h3></div>'; return; }
      var listing = r.body.listing;
      var host = r.body.host || {};
      return VacationApp.api('/quote', { method: 'POST', body: { listing_id: pending.listing_id, check_in: pending.check_in, check_out: pending.check_out } }).then(function (q) {
        if (!q.body.ok) { document.getElementById('checkout-host').innerHTML = '<div class="v-empty"><h3>Couldn\'t get a quote</h3></div>'; return; }
        render(listing, host, pending, q.body.quote);
      });
    });
  }

  function render(listing, host, pending, qt) {
    document.getElementById('checkout-host').innerHTML = ''
      + '<section class="v-container v-section">'
      +   '<h1>Confirm and pay</h1>'
      +   '<div style="display:grid;gap:24px;grid-template-columns:1fr;" id="ck-grid">'

      +     '<div class="v-panel">'
      +       '<h3 style="margin-top:0;">Your trip</h3>'
      +       '<div style="display:flex;gap:14px;align-items:center;padding:10px;background:#faf7f0;border-radius:10px;margin-bottom:16px;">'
      +         '<img src="' + listing.photos[0] + '" alt="" style="width:88px;height:88px;border-radius:10px;object-fit:cover;" />'
      +         '<div><strong>' + VacationApp.escapeHtml(listing.title) + '</strong>'
      +         '<div class="v-text-muted" style="font-size:12px;">' + listing.bedrooms + 'BR · ' + listing.max_guests + ' guests max · Host: ' + host.name + '</div>'
      +         '<div class="v-text-muted" style="font-size:12px;">★ ' + listing.rating.toFixed(2) + ' (' + listing.review_count + ' reviews)</div></div>'
      +       '</div>'
      +       '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;">'
      +         '<div style="padding:10px 12px;border:1px solid var(--vacation-line-2);border-radius:10px;"><div class="v-stat-k">Check in</div><div style="font-weight:600;">' + VacationApp.fmtDate(pending.check_in) + '</div></div>'
      +         '<div style="padding:10px 12px;border:1px solid var(--vacation-line-2);border-radius:10px;"><div class="v-stat-k">Check out</div><div style="font-weight:600;">' + VacationApp.fmtDate(pending.check_out) + '</div></div>'
      +       '</div>'
      +       '<div style="padding:10px 12px;border:1px solid var(--vacation-line-2);border-radius:10px;margin-bottom:14px;"><div class="v-stat-k">Guests</div><div style="font-weight:600;">' + (pending.guests_count || 2) + ' guest' + ((pending.guests_count || 2) === 1 ? '' : 's') + '</div></div>'

      +       '<h3 style="margin:18px 0 8px;">Payment</h3>'
      +       '<div style="display:flex;gap:6px;margin-bottom:12px;">'
      +         '<button class="v-pill active" data-pm="card">Card</button>'
      +         '<button class="v-pill" data-pm="apple">Apple Pay</button>'
      +         '<button class="v-pill" data-pm="google">Google Pay</button>'
      +       '</div>'
      +       '<div id="card-fields">'
      +         '<label class="v-field"><span>Card number</span><input class="v-input" placeholder="4242 4242 4242 4242" /></label>'
      +         '<div class="v-flex v-mt-1"><label class="v-field" style="flex:1;"><span>Expiry</span><input class="v-input" placeholder="MM/YY" /></label>'
      +         '<label class="v-field" style="flex:1;"><span>CVC</span><input class="v-input" placeholder="123" /></label></div>'
      +         '<label class="v-field v-mt-1"><span>Cardholder name</span><input class="v-input" placeholder="Full name" /></label>'
      +       '</div>'

      +       '<h3 style="margin:18px 0 8px;">House rules &amp; cancellation</h3>'
      +       '<div style="font-size:13px;color:var(--vacation-ink-2);background:#faf7f0;padding:12px;border-radius:8px;">'
      +         (listing.house_rules || []).map(function (r) { return '<div>· ' + VacationApp.escapeHtml(r) + '</div>'; }).join('')
      +         + '<div style="margin-top:8px;"><strong>Cancellation:</strong> ' + listing.cancellation + '</div>'
      +       '</div>'
      +       '<label style="display:flex;gap:8px;align-items:flex-start;margin-top:12px;font-size:13px;"><input id="ck-agree" type="checkbox" />I agree to the house rules and cancellation policy.</label>'

      +       '<div class="v-flex v-mt-3"><a class="v-btn v-btn--ghost" href="stay.html?id=' + listing.id + '">← Back to stay</a>'
      +         '<button class="v-btn v-btn--primary" id="ck-confirm" style="flex:1;">Confirm and pay · ' + VacationApp.formatPriceExact(qt.total) + '</button>'
      +       '</div>'
      +     '</div>'

      +     '<aside class="v-panel" style="position:sticky;top:80px;align-self:start;">'
      +       '<h3 style="margin-top:0;">Pricing details</h3>'
      +       '<div class="v-reserve-breakdown" style="font-size:14px;">'
      +         '<div><span>AED ' + listing.base_nightly_aed.toLocaleString() + ' × ' + qt.nights + ' night' + (qt.nights === 1 ? '' : 's') + '</span><span data-price-aed-exact="' + qt.nightly_subtotal + '">' + VacationApp.formatPriceExact(qt.nightly_subtotal) + '</span></div>'
      +         (qt.weekend_surcharge ? '<div class="v-rb-line"><span style="opacity:.7;font-size:12px;">includes weekend surcharge (' + qt.weekend_nights + ' weekend night' + (qt.weekend_nights === 1 ? '' : 's') + ')</span><span></span></div>' : '')
      +         '<div><span>Cleaning fee</span><span data-price-aed-exact="' + qt.cleaning_fee + '">' + VacationApp.formatPriceExact(qt.cleaning_fee) + '</span></div>'
      +         '<div><span>Service fee (10%)</span><span data-price-aed-exact="' + qt.service_fee + '">' + VacationApp.formatPriceExact(qt.service_fee) + '</span></div>'
      +         '<div><span>VAT (5%)</span><span data-price-aed-exact="' + qt.vat + '">' + VacationApp.formatPriceExact(qt.vat) + '</span></div>'
      +         '<div class="v-rb-total"><span>Total (AED)</span><span data-price-aed-exact="' + qt.total + '">' + VacationApp.formatPriceExact(qt.total) + '</span></div>'
      +       '</div>'
      +       '<p class="v-text-muted v-mt-2" style="font-size:11.5px;">All prices in AED. Total includes 5% VAT.</p>'
      +     '</aside>'

      +   '</div>'
      + '</section>';

    // Wire
    document.querySelectorAll('[data-pm]').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('[data-pm]').forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
      });
    });
    document.getElementById('ck-confirm').addEventListener('click', function () {
      if (!document.getElementById('ck-agree').checked) {
        if (window.toast) window.toast('Please agree to the house rules + cancellation policy.', 'warn');
        return;
      }
      // Re-check conflict (server-side) before creating
      VacationApp.api('/bookings', { method: 'POST', body: { listing_id: pending.listing_id, check_in: pending.check_in, check_out: pending.check_out, guests_count: pending.guests_count } })
        .then(function (r) {
          if (r.body.ok) {
            localStorage.setItem('vacation.last_booking', JSON.stringify(r.body.booking));
            localStorage.removeItem('vacation.pending_quote');
            location.href = 'success.html?ref=' + r.body.booking.ref_number;
          } else if (r.body.error === 'conflict') {
            if (window.toast) window.toast('Those dates were just booked. Pick a different range.', 'error', 4000);
            setTimeout(function () { location.href = 'stay.html?id=' + pending.listing_id; }, 2000);
          } else {
            if (window.toast) window.toast('Could not create booking: ' + (r.body.message || r.body.error), 'error');
          }
        });
    });
    VacationApp.updateAllPrices();
  }

  window.CheckoutPage = { load: load };
})();
