/* stay-detail.js — Single listing page: gallery + reserve sidebar + calendar */
(function () {
  'use strict';

  var listing = null, host = null, dest = null, similar = [], reviews = [], availability = null;
  var range = { check_in: null, check_out: null };
  var guestsCount = 2;

  function load() {
    var id = VacationApp.qs().id;
    if (!id) { document.body.innerHTML = '<div class="v-empty"><h3>No listing id</h3></div>'; return; }
    VacationApp.api('/listings/' + encodeURIComponent(id)).then(function (r) {
      if (!r.body.ok) { document.body.innerHTML = '<div class="v-empty"><h3>Listing not found</h3></div>'; return; }
      listing = r.body.listing;
      host = r.body.host || {};
      reviews = r.body.reviews || [];
      similar = r.body.similar || [];
      dest = VACATION_DATA.DESTINATIONS.find(function (d) { return d.id === listing.destination_id; }) || {};
      // Pull dates from URL if provided
      var qs = VacationApp.qs();
      if (qs.check_in) range.check_in = qs.check_in;
      if (qs.check_out) range.check_out = qs.check_out;
      if (qs.guests) guestsCount = Number(qs.guests);
      return VacationApp.api('/availability/' + listing.id);
    }).then(function (r2) {
      availability = r2 ? r2.body : { blocked: [], booked: [] };
      VacationApp.pushRecentlyViewed(listing.id);
      render();
    });
  }

  var lightboxIndex = 0;
  function openLightbox(i) {
    lightboxIndex = i || 0;
    var el = document.createElement('div');
    el.className = 'v-lightbox';
    el.innerHTML = '<button class="v-lightbox-close">×</button><div class="v-lightbox-count"></div><button class="v-lightbox-nav prev">‹</button><img alt="" /><button class="v-lightbox-nav next">›</button>';
    document.body.appendChild(el);
    function show() {
      el.querySelector('img').src = listing.photos[lightboxIndex];
      el.querySelector('.v-lightbox-count').textContent = (lightboxIndex + 1) + ' / ' + listing.photos.length;
    }
    function prev() { lightboxIndex = (lightboxIndex - 1 + listing.photos.length) % listing.photos.length; show(); }
    function next() { lightboxIndex = (lightboxIndex + 1) % listing.photos.length; show(); }
    function close() { if (el.parentNode) el.parentNode.removeChild(el); document.removeEventListener('keydown', onKey); }
    function onKey(e) { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') prev(); else if (e.key === 'ArrowRight') next(); }
    el.querySelector('.v-lightbox-close').addEventListener('click', close);
    el.querySelector('.prev').addEventListener('click', prev);
    el.querySelector('.next').addEventListener('click', next);
    el.addEventListener('click', function (e) { if (e.target === el) close(); });
    document.addEventListener('keydown', onKey);
    show();
  }

  function refreshReserveSidebar() {
    var box = document.getElementById('reserve-box');
    if (!box) return;
    var nights = (range.check_in && range.check_out) ? VacationApp.nightsBetween(range.check_in, range.check_out) : 0;
    var q = nights > 0 ? VacationApp.quote(listing, range.check_in, range.check_out) : null;

    box.innerHTML = ''
      + '<div class="v-reserve-price"><span data-price-aed-exact="' + listing.base_nightly_aed + '">' + VacationApp.formatPriceExact(listing.base_nightly_aed) + '</span><span class="v-rate-unit"> / night</span></div>'
      + '<div class="v-reserve-dates">'
      +   '<button type="button" id="r-ci"><span class="v-r-k">Check in</span><span class="v-r-v">' + (range.check_in ? VacationApp.fmtDate(range.check_in) : 'Add date') + '</span></button>'
      +   '<button type="button" id="r-co"><span class="v-r-k">Check out</span><span class="v-r-v">' + (range.check_out ? VacationApp.fmtDate(range.check_out) : 'Add date') + '</span></button>'
      + '</div>'
      + '<div class="v-reserve-guests"><span><span class="v-r-k">Guests</span><span class="v-r-v">' + guestsCount + ' guest' + (guestsCount === 1 ? '' : 's') + '</span></span>'
      +   '<span style="display:flex;gap:6px;"><button class="v-pill" id="g-dec" type="button">−</button><button class="v-pill" id="g-inc" type="button">+</button></span>'
      + '</div>';

    if (q) {
      box.innerHTML += ''
        + '<div class="v-reserve-breakdown">'
        +   '<div><span>AED ' + listing.base_nightly_aed.toLocaleString() + ' × ' + q.nights + ' night' + (q.nights === 1 ? '' : 's') + '</span><span data-price-aed-exact="' + q.nightly_subtotal + '">' + VacationApp.formatPriceExact(q.nightly_subtotal) + '</span></div>'
        +   (q.cleaning_fee ? '<div><span>Cleaning fee</span><span data-price-aed-exact="' + q.cleaning_fee + '">' + VacationApp.formatPriceExact(q.cleaning_fee) + '</span></div>' : '')
        +   '<div><span>Service fee (10%)</span><span data-price-aed-exact="' + q.service_fee + '">' + VacationApp.formatPriceExact(q.service_fee) + '</span></div>'
        +   '<div><span>VAT (5%)</span><span data-price-aed-exact="' + q.vat + '">' + VacationApp.formatPriceExact(q.vat) + '</span></div>'
        +   '<div class="v-rb-total"><span>Total</span><span data-price-aed-exact="' + q.total + '">' + VacationApp.formatPriceExact(q.total) + '</span></div>'
        + '</div>'
        + '<button class="v-btn v-btn--primary v-btn--block v-mt-2" id="reserve-btn">' + (listing.instant_book ? '⚡ Reserve · Instant book' : 'Request to book') + '</button>';
    } else {
      box.innerHTML += '<button class="v-btn v-btn--primary v-btn--block v-mt-2" id="reserve-btn" disabled style="opacity:.6;cursor:not-allowed;">Pick dates first</button>';
    }
    box.innerHTML += '<p class="v-text-muted v-mt-1" style="font-size:11.5px;text-align:center;">You won\'t be charged in this demo — clicking Reserve writes the booking to localStorage.</p>';

    // Open calendar on date click
    box.querySelectorAll('#r-ci, #r-co').forEach(function (b) { b.addEventListener('click', openDateModal); });
    // Guest controls
    box.querySelector('#g-dec').addEventListener('click', function () {
      if (guestsCount > 1) { guestsCount--; refreshReserveSidebar(); }
    });
    box.querySelector('#g-inc').addEventListener('click', function () {
      if (guestsCount < listing.max_guests) { guestsCount++; refreshReserveSidebar(); }
      else if (window.toast) window.toast('Max ' + listing.max_guests + ' guests for this stay', 'warn', 2000);
    });
    var resBtn = box.querySelector('#reserve-btn');
    if (resBtn && !resBtn.disabled) {
      resBtn.addEventListener('click', function () {
        // Stash the pending quote and bounce to checkout
        VacationApp.jset('vacation.pending_quote', {
          listing_id: listing.id,
          check_in: range.check_in,
          check_out: range.check_out,
          guests_count: guestsCount
        });
        location.href = 'checkout.html';
      });
    }
  }

  function openDateModal() {
    VacationApp.showModal({
      title: 'Select dates',
      size: 'lg',
      body: '<div id="cal-host"></div>',
      foot: '<button class="v-btn" data-modal-close>Cancel</button><button class="v-btn v-btn--primary" id="cal-confirm">Confirm dates</button>',
      onMount: function (h, close) {
        var calInstance = window.VacationCalendar.mount(h.querySelector('#cal-host'), {
          mode: 'picker',
          checkIn: range.check_in,
          checkOut: range.check_out,
          blocked: availability.blocked || [],
          booked: availability.booked || [],
          onChange: function (r) {
            range.check_in = r.check_in;
            range.check_out = r.check_out;
          }
        });
        h.querySelector('#cal-confirm').addEventListener('click', function () {
          if (!range.check_in || !range.check_out) {
            if (window.toast) window.toast('Pick both a check-in and check-out date.', 'warn');
            return;
          }
          close();
          refreshReserveSidebar();
        });
      }
    });
  }

  function render() {
    var d = VACATION_DATA;
    var photos = listing.photos.slice(0, 5);
    var amen = listing.amenities || [];
    var avgRating = listing.rating;

    var html = ''
      + '<section class="v-container" style="padding-top:24px;">'
      +   '<nav style="font-size:12px;color:var(--vacation-muted);margin-bottom:12px;"><a href="search.html">All stays</a> / <a href="search.html?destination=' + dest.id + '">' + dest.name + '</a> / <span>' + VacationApp.escapeHtml(listing.title) + '</span></nav>'

      + '<div class="v-detail-gallery">'
      +   photos.map(function (p, i) {
            var more = (i === 4 && listing.photos.length > 5) ? '<div class="v-gallery-more">+ ' + (listing.photos.length - 5) + ' photos</div>' : '';
            return '<div class="v-gallery-cell" onclick="StayPage.openLightbox(' + i + ')"><img src="' + p + '" alt="" />' + more + '</div>';
          }).join('')
      + '</div>'

      + '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:18px;">'
      +   '<h1 style="margin:0;font-size:clamp(22px,3vw,30px);">' + VacationApp.escapeHtml(listing.title) + '</h1>'
      +   (listing.instant_book ? '<span class="v-chip" style="background:var(--vacation-teal);color:white;">⚡ Instant book</span>' : '')
      +   (host.superhost ? '<span class="v-chip superhost">★ Superhost</span>' : '')
      +   '<span class="v-chip"><span style="color:var(--vacation-accent);">★</span>&nbsp;' + avgRating.toFixed(2) + ' · ' + listing.review_count + ' reviews</span>'
      + '</div>'
      + '<div class="v-text-muted" style="font-size:13px;margin-top:4px;">📍 ' + VacationApp.escapeHtml(listing.address) + ' · ' + dest.name + '</div>'

      + '<div class="v-stat-row">'
      +   '<div class="v-stat"><div class="v-stat-k">Guests</div><div class="v-stat-v">' + listing.max_guests + '</div></div>'
      +   '<div class="v-stat"><div class="v-stat-k">Bedrooms</div><div class="v-stat-v">' + listing.bedrooms + '</div></div>'
      +   '<div class="v-stat"><div class="v-stat-k">Beds</div><div class="v-stat-v">' + listing.beds + '</div></div>'
      +   '<div class="v-stat"><div class="v-stat-k">Baths</div><div class="v-stat-v">' + listing.baths + '</div></div>'
      + '</div>'

      + '<div class="v-detail-grid">'
      +   '<div>'
      +     '<div class="v-host-card"><div class="v-host-head"><img src="' + host.photo + '" alt="" /><div><h4>Hosted by ' + VacationApp.escapeHtml(host.name) + '</h4>'
      +       '<div class="v-meta">Joined ' + (host.joined || '—') + ' · ' + (host.response_rate || 0) + '% response · ~' + (host.response_time_hrs || 0) + 'h reply</div></div>'
      +       '<div style="margin-inline-start:auto;display:flex;gap:6px;">' + (host.superhost ? '<span class="v-chip superhost">★ Superhost</span>' : '') + '</div>'
      +     '</div>'
      +     '<p style="margin-top:12px;font-size:13px;">' + VacationApp.escapeHtml(host.bio || '') + '</p>'
      +     '<div class="v-flex-wrap v-mt-1" style="font-size:12px;color:var(--vacation-muted);">Languages: ' + (host.languages || []).join(', ') + '</div>'
      +     '</div>'

      +     '<div class="v-panel v-mt-3"><h3 style="margin-top:0;">About this stay</h3><p>' + VacationApp.escapeHtml(listing.description) + '</p></div>'

      +     '<div class="v-panel v-mt-2"><h3 style="margin-top:0;">What this place offers</h3>'
      +       '<div class="v-amenity-grid">'
      +         amen.map(function (id) {
                  var a = d.AMENITIES.find(function (x) { return x.id === id; });
                  if (!a) return '';
                  return '<div class="v-amenity"><span class="v-amenity-icon">' + a.icon + '</span>' + a.label + '</div>';
                }).join('')
      +       '</div>'
      +     '</div>'

      +     '<div class="v-panel v-mt-2"><h3 style="margin-top:0;">Availability</h3><div id="avail-cal"></div></div>'

      +     '<div class="v-panel v-mt-2"><h3 style="margin-top:0;">Location</h3><div class="v-map v-map--detail" id="detail-map" data-map></div>'
      +       '<p style="font-size:13px;color:var(--vacation-muted);margin-top:8px;">' + VacationApp.escapeHtml(dest.blurb || '') + '</p>'
      +     '</div>'

      +     '<div class="v-panel v-mt-2"><h3 style="margin-top:0;">House rules</h3><ul style="margin:8px 0 0 18px;font-size:13.5px;color:var(--vacation-ink-2);">' + (listing.house_rules || []).map(function (r) { return '<li>' + VacationApp.escapeHtml(r) + '</li>'; }).join('') + '</ul>'
      +       '<div class="v-text-muted" style="font-size:12px;margin-top:8px;">Cancellation: <strong>' + listing.cancellation + '</strong></div>'
      +     '</div>'

      +     '<div class="v-panel v-mt-2"><h3 style="margin-top:0;">' + reviews.length + ' reviews · ' + avgRating.toFixed(2) + '★ overall</h3>'
      +       '<div class="v-grid v-grid-2 v-mt-1">'
      +         (reviews.length ? reviews.slice(0, 6).map(function (rv) {
                  var g = d.GUESTS.find(function (x) { return x.id === rv.guest_id; }) || { name: 'Guest' };
                  return '<div style="padding:14px;border:1px solid var(--vacation-line);border-radius:12px;background:#fcfaf3;"><div class="v-stars">' + VacationApp.stars(rv.rating_overall) + ' <span class="v-text-muted" style="font-size:12px;">' + rv.rating_overall.toFixed(1) + '</span></div><strong>' + VacationApp.escapeHtml(rv.title) + '</strong><p style="margin:6px 0 0;font-size:13px;">' + VacationApp.escapeHtml(rv.body) + '</p><div class="v-text-muted" style="font-size:11px;margin-top:6px;">— ' + g.name + ', ' + rv.date + '</div></div>';
                }).join('') : '<div class="v-empty">No reviews yet.</div>')
      +       '</div>'
      +     '</div>'

      +     (similar.length ? '<div class="v-mt-3"><h3>Similar stays in ' + dest.name + '</h3><div class="v-grid v-grid-2 v-mt-1">' + similar.map(function (l) { return VacationApp.listingCard(l); }).join('') + '</div></div>' : '')

      +   '</div>'

      +   '<aside class="v-detail-rail">'
      +     '<div class="v-reserve" id="reserve-box"></div>'
      +   '</aside>'
      + '</div>'
      + '</section>';

    document.getElementById('detail-host').innerHTML = html;
    refreshReserveSidebar();
    VacationApp.updateAllPrices();

    // Mount availability calendar (display-only)
    if (window.VacationCalendar) {
      window.VacationCalendar.mount(document.getElementById('avail-cal'), {
        mode: 'display',
        blocked: availability.blocked || [],
        booked: availability.booked || []
      });
    }

    // Lazy-load Leaflet for the location map
    var mapEl = document.getElementById('detail-map');
    if (mapEl && !window.L) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
      var js = document.createElement('script'); js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; js.onload = mountMap; document.head.appendChild(js);
    } else if (mapEl && window.L) {
      mountMap();
    }
    function mountMap() {
      var map = L.map('detail-map').setView([listing.lat, listing.lng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
      var icon = L.divIcon({ className: '', html: '<div class="v-map-pin">' + VacationApp.formatPrice(listing.base_nightly_aed) + '</div>', iconSize: [80, 28], iconAnchor: [40, 28] });
      L.marker([listing.lat, listing.lng], { icon: icon }).addTo(map);
    }
  }

  window.StayPage = { load: load, openLightbox: openLightbox };
})();
