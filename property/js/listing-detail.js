/* listing-detail.js — Single property detail page logic */
(function () {
  'use strict';

  var listing = null, agent = null, agency = null, area = null, similar = [];

  function load() {
    var id = ManzilApp.qs().id;
    if (!id) { document.body.innerHTML = '<div class="m-empty"><h3>No listing id</h3></div>'; return; }
    ManzilApp.api('/listings/' + encodeURIComponent(id)).then(function (r) {
      if (!r.ok) { document.body.innerHTML = '<div class="m-empty"><h3>Listing not found</h3></div>'; return; }
      listing = r.listing;
      similar = r.similar;
      agent = MANZIL_DATA.AGENTS.find(function (a) { return a.id === listing.agent_id; }) || {};
      agency = MANZIL_DATA.AGENCIES.find(function (g) { return g.id === listing.agency_id; }) || {};
      area = MANZIL_DATA.AREAS.find(function (a) { return a.id === listing.area_id; }) || {};
      render();
      ManzilApp.pushRecentlyViewed(listing.id);
    });
  }

  var lightboxIndex = 0;
  function openLightbox(i) {
    lightboxIndex = i || 0;
    var el = document.createElement('div');
    el.className = 'm-lightbox';
    el.innerHTML = ''
      + '<button class="m-lightbox-close" aria-label="Close">×</button>'
      + '<div class="m-lightbox-count"></div>'
      + '<button class="m-lightbox-nav prev" aria-label="Previous">‹</button>'
      + '<img alt="Listing photo" />'
      + '<button class="m-lightbox-nav next" aria-label="Next">›</button>';
    document.body.appendChild(el);
    function show() {
      el.querySelector('img').src = listing.photos[lightboxIndex];
      el.querySelector('.m-lightbox-count').textContent = (lightboxIndex + 1) + ' / ' + listing.photos.length;
    }
    function prev() { lightboxIndex = (lightboxIndex - 1 + listing.photos.length) % listing.photos.length; show(); }
    function next() { lightboxIndex = (lightboxIndex + 1) % listing.photos.length; show(); }
    function close() { if (el.parentNode) el.parentNode.removeChild(el); document.removeEventListener('keydown', onKey); }
    function onKey(e) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    }
    el.querySelector('.m-lightbox-close').addEventListener('click', close);
    el.querySelector('.prev').addEventListener('click', prev);
    el.querySelector('.next').addEventListener('click', next);
    el.addEventListener('click', function (e) { if (e.target === el) close(); });
    document.addEventListener('keydown', onKey);
    show();
  }

  function mortgageWidget() {
    var price = listing.price_aed;
    var defaultDown = 25, defaultRate = 4.5, defaultYears = 25;
    var calc = function () {
      var down = Number(document.getElementById('mw-down').value);
      var rate = Number(document.getElementById('mw-rate').value);
      var years = Number(document.getElementById('mw-years').value);
      var r = ManzilApp.computeMortgage(price, down, rate, years);
      document.getElementById('mw-monthly').textContent = ManzilApp.formatPriceExact(r.monthly);
      document.getElementById('mw-total-int').textContent = ManzilApp.formatPriceExact(r.totalInt);
      document.getElementById('mw-loan').textContent = ManzilApp.formatPriceExact(r.loan);
    };
    setTimeout(function () {
      document.getElementById('mw-down').addEventListener('input', calc);
      document.getElementById('mw-rate').addEventListener('input', calc);
      document.getElementById('mw-years').addEventListener('input', calc);
      calc();
    }, 0);
    return ''
      + '<div class="m-mortgage">'
      +   '<h3 style="margin:0 0 8px;">Mortgage estimate</h3>'
      +   '<p class="m-text-muted" style="font-size:12px;margin:0 0 12px;">Illustrative only. UAE banks typically require 20–25% down for non-resident buyers.</p>'
      +   '<div class="m-mortgage-row">'
      +     '<label class="m-field"><span>Down payment %</span><input class="m-input" id="mw-down" type="number" min="10" max="80" value="' + defaultDown + '"></label>'
      +     '<label class="m-field"><span>Interest rate %</span><input class="m-input" id="mw-rate" type="number" min="1" max="15" step="0.1" value="' + defaultRate + '"></label>'
      +   '</div>'
      +   '<div class="m-mortgage-row">'
      +     '<label class="m-field"><span>Tenure (years)</span><input class="m-input" id="mw-years" type="number" min="5" max="30" value="' + defaultYears + '"></label>'
      +     '<label class="m-field"><span>Loan amount</span><input class="m-input" id="mw-loan" value="—" readonly></label>'
      +   '</div>'
      +   '<div class="m-mortgage-result">'
      +     '<div class="m-stat-k">Monthly payment</div>'
      +     '<div class="big" id="mw-monthly">—</div>'
      +     '<div class="m-mortgage-rows">'
      +       '<div><span class="m-text-muted">Total interest over tenure</span><strong id="mw-total-int">—</strong></div>'
      +     '</div>'
      +   '</div>'
      +   '<a class="m-btn m-btn--ghost m-btn--sm" href="mortgage.html?price=' + price + '" style="margin-top:8px;">Open full calculator →</a>'
      + '</div>';
  }

  function floorPlanSvg(beds, baths) {
    // Simple schematic floor plan SVG; rooms are placeholders.
    var rooms = [];
    var w = 600, h = 360;
    rooms.push({ x: 10, y: 10, w: 250, h: 160, label: 'Living' });
    rooms.push({ x: 270, y: 10, w: 320, h: 160, label: 'Kitchen / Dining' });
    var bw = (w - 20) / beds, bx = 10;
    for (var i = 0; i < Math.min(beds || 1, 4); i++) {
      rooms.push({ x: bx, y: 180, w: bw - 10, h: 100, label: i === 0 ? 'Master BR' : 'Bedroom ' + (i + 1) });
      bx += bw;
    }
    for (var j = 0; j < Math.min(baths || 1, 3); j++) {
      rooms.push({ x: 10 + j * 130, y: 290, w: 100, h: 60, label: 'Bath' });
    }
    rooms.push({ x: 440, y: 290, w: 150, h: 60, label: 'Balcony' });
    return ''
      + '<svg viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">'
      +   '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="#fafaf6" stroke="#ccc" stroke-width="2"/>'
      +   rooms.map(function (r, i) {
            var color = ['#dfe9e3','#e7ddc7','#dfe9e3','#e1dad0','#e7ddc7','#dfe9e3','#e1dad0','#dfe9e3'][i % 8];
            return '<g><rect x="' + r.x + '" y="' + r.y + '" width="' + r.w + '" height="' + r.h + '" fill="' + color + '" stroke="#888" stroke-width="1.5"/>'
              +    '<text x="' + (r.x + r.w / 2) + '" y="' + (r.y + r.h / 2 + 4) + '" font-size="13" text-anchor="middle" fill="#333" font-family="Inter, sans-serif">' + r.label + '</text></g>';
          }).join('')
      + '</svg>';
  }

  function render() {
    var d = MANZIL_DATA;
    var fav = ManzilApp.isFavorite(listing.id);
    var inCompare = ManzilApp.isInCompare(listing.id);
    var photos = listing.photos.slice(0, 5);

    var html = ''
      + '<section class="m-container" style="padding-top:24px;">'
      +   '<nav style="font-size:12px;color:var(--manzil-muted);margin-bottom:12px;">'
      +     '<a href="search.html?transaction=' + listing.transaction + '">' + (listing.transaction === 'rent' ? 'Rent' : listing.transaction === 'off-plan' ? 'Off-plan' : 'Buy') + '</a>'
      +     ' / <a href="search.html?type=' + listing.type + '">' + listing.type[0].toUpperCase() + listing.type.slice(1) + 's</a>'
      +     ' / <a href="area.html?slug=' + area.slug + '">' + area.name + '</a>'
      +     ' / <span>' + ManzilApp.escapeHtml(listing.title) + '</span>'
      +   '</nav>'

      + '<div class="m-detail-gallery">'
      +   photos.map(function (p, i) {
            var more = (i === 4 && listing.photos.length > 5) ? '<div class="m-gallery-more">+ ' + (listing.photos.length - 5) + ' photos</div>' : '';
            return '<div class="m-gallery-cell" onclick="ListingDetail.openLightbox(' + i + ')"><img src="' + p + '" alt="" />' + more + '</div>';
          }).join('')
      + '</div>'

      + '<div style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:18px;">'
      +   '<h1 style="margin:0;font-size:clamp(22px,3vw,30px);">' + ManzilApp.escapeHtml(listing.title) + '</h1>'
      +   (listing.verified ? '<span class="m-chip verified">Verified</span>' : '')
      +   (listing.featured ? '<span class="m-chip" style="background:var(--manzil-accent);color:white;">Featured</span>' : '')
      +   '<span class="m-chip">Listed ' + ManzilApp.relDate(listing.listed_at) + '</span>'
      +   '<div style="margin-inline-start:auto;display:flex;gap:6px;">'
      +     '<button class="m-btn m-btn--ghost m-btn--sm" data-fav="' + listing.id + '" onclick="ManzilApp.toggleFavorite(\'' + listing.id + '\')">' + (fav ? '♥ Saved' : '♡ Save') + '</button>'
      +     '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ListingDetail.toggleCompare()">' + (inCompare ? '✓ In compare' : '⊕ Compare') + '</button>'
      +     '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilApp.shareListing(\'' + listing.id + '\')">↗ Share</button>'
      +     '<button class="m-btn m-btn--ghost m-btn--sm" onclick="window.print()">⎙ Print</button>'
      +   '</div>'
      + '</div>'

      + '<div style="font-size:28px;font-weight:800;color:var(--manzil-primary);font-family:var(--font-display);margin-top:6px;" data-price-aed="' + listing.price_aed + '"' + (listing.transaction === 'rent' ? ' data-price-freq="' + (listing.rent_freq || 'year') + '"' : '') + '>'
      +   ManzilApp.formatPriceExact(listing.price_aed) + (listing.transaction === 'rent' ? ' <span style="font-size:14px;color:var(--manzil-muted)">per ' + (listing.rent_freq || 'year') + '</span>' : '')
      + '</div>'
      + '<div class="m-text-muted" style="font-size:13px;margin-top:4px;">📍 ' + ManzilApp.escapeHtml(listing.address) + ' · ' + ManzilApp.escapeHtml(area.name) + '</div>'

      + '<div class="m-stat-row">'
      +   '<div class="m-stat"><div class="m-stat-k">Beds</div><div class="m-stat-v">' + (listing.beds || 'Studio') + '</div></div>'
      +   '<div class="m-stat"><div class="m-stat-k">Baths</div><div class="m-stat-v">' + listing.baths + '</div></div>'
      +   '<div class="m-stat"><div class="m-stat-k">Size</div><div class="m-stat-v">' + listing.sqft.toLocaleString() + ' ft²</div></div>'
      +   '<div class="m-stat"><div class="m-stat-k">Type</div><div class="m-stat-v">' + listing.type[0].toUpperCase() + listing.type.slice(1) + '</div></div>'
      + '</div>'

      + '<div class="m-detail-grid">'
      +   '<div>'
      +     '<div class="m-panel"><h3 style="margin-top:0;">About this property</h3><p>' + ManzilApp.escapeHtml(listing.description) + '</p>'
      +       '<div class="m-flex-wrap m-mt-2" style="font-size:12px;color:var(--manzil-muted);">'
      +         '<span>📅 Built ' + listing.year_built + '</span>'
      +         '<span>🏗 ' + (listing.completion_status === 'ready' ? 'Ready' : 'Off-plan') + '</span>'
      +         '<span>' + (listing.furnished ? '🛋 Furnished' : '🛋 Unfurnished') + '</span>'
      +         '<span>💷 AED ' + Math.round(listing.price_aed / listing.sqft).toLocaleString() + ' /ft²</span>'
      +       '</div>'
      +     '</div>'

      +     '<div class="m-panel m-mt-2"><h3 style="margin-top:0;">Amenities & features</h3>'
      +       '<div class="m-amenity-grid">'
      +         listing.amenities.map(function (id) {
                  var a = d.AMENITIES.find(function (x) { return x.id === id; });
                  if (!a) return '';
                  return '<div class="m-amenity"><span class="m-amenity-icon">' + a.icon + '</span>' + a.label + '</div>';
                }).join('')
      +       '</div>'
      +     '</div>'

      +     '<div class="m-panel m-mt-2"><h3 style="margin-top:0;">Floor plan</h3>'
      +       '<div class="m-floor">' + floorPlanSvg(listing.beds, listing.baths) + '</div>'
      +       '<div class="m-floor-legend"><span><span class="sq" style="background:#dfe9e3;"></span>Living & bedrooms</span><span><span class="sq" style="background:#e7ddc7;"></span>Kitchen & utility</span><span><span class="sq" style="background:#e1dad0;"></span>Bath & balcony</span></div>'
      +     '</div>'

      +     '<div class="m-panel m-mt-2"><h3 style="margin-top:0;">Location</h3>'
      +       '<div class="m-map m-map--detail" id="detail-map" data-map></div>'
      +       '<p style="font-size:13px;color:var(--manzil-muted);margin-top:8px;">' + ManzilApp.escapeHtml(area.blurb) + '</p>'
      +       '<div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px;margin-top:6px;">'
      +         (area.schools && area.schools.length ? '<span>🎓 ' + area.schools.slice(0,2).join(' · ') + '</span>' : '')
      +         (area.malls && area.malls.length ? '<span>🛍 ' + area.malls.slice(0,2).join(' · ') + '</span>' : '')
      +         (area.metros && area.metros.length ? '<span>🚇 ' + area.metros.slice(0,2).join(' · ') + '</span>' : '')
      +       '</div>'
      +     '</div>'

      +     '<div class="m-mt-3">' + mortgageWidget() + '</div>'

      +     (similar && similar.length
                ? '<div class="m-mt-3"><h3>Similar in ' + area.name + '</h3><div class="m-grid m-grid-2" id="similar-grid">' + similar.map(ManzilApp.listingCard).join('') + '</div></div>'
                : '')

      +   '</div>'

      +   '<aside class="m-detail-rail">'
      +     '<div class="m-agent-card-rail">'
      +       '<div class="m-agent-head">'
      +         '<img src="' + agent.photo_url + '" alt="' + ManzilApp.escapeHtml(agent.name) + '" />'
      +         '<div>'
      +           '<h4>' + ManzilApp.escapeHtml(agent.name) + '</h4>'
      +           '<div class="m-meta">' + ManzilApp.escapeHtml(agency.name || '') + '</div>'
      +           '<div class="m-stars">' + ManzilApp.stars(agent.rating) + ' <span style="color:var(--manzil-muted);font-size:12px;">' + agent.rating + ' / ' + agent.deals_closed + ' deals</span></div>'
      +         '</div>'
      +       '</div>'
      +       '<div style="font-size:12px;color:var(--manzil-muted);margin-top:10px;">' + (agent.languages || []).join(' · ') + ' · ' + agent.years_exp + ' yrs experience</div>'
      +       '<div class="m-agent-actions">'
      +         '<button class="m-btn m-btn--primary m-btn--block" onclick="ManzilApp.openInquiry(\'' + listing.id + '\',\'viewing\')">📅 Schedule viewing</button>'
      +         '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">'
      +           '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilApp.openInquiry(\'' + listing.id + '\',\'call\')">📞 Call</button>'
      +           '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilApp.openInquiry(\'' + listing.id + '\',\'whatsapp\')">💬 WhatsApp</button>'
      +         '</div>'
      +         '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilApp.openInquiry(\'' + listing.id + '\',\'email\')">✉ Email agent</button>'
      +         '<button class="m-btn m-btn--ghost m-btn--sm" onclick="ManzilApp.openInquiry(\'' + listing.id + '\',\'callback\')">↩ Request callback</button>'
      +         '<a class="m-btn m-btn--ghost m-btn--sm" href="agent.html?id=' + agent.id + '">View agent profile →</a>'
      +       '</div>'
      +       '<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--manzil-line);font-size:12px;color:var(--manzil-muted);">'
      +         '<div>🪪 RERA permit: ' + ManzilApp.escapeHtml(agency.license_no || '') + '</div>'
      +         '<div style="margin-top:4px;">📞 ' + ManzilApp.escapeHtml(agent.phone || '') + '</div>'
      +       '</div>'
      +     '</div>'
      +   '</aside>'
      + '</div>'

      + '</section>';

    document.getElementById('detail-host').innerHTML = html;
    ManzilApp.updateAllPrices();

    // Lazy-load Leaflet
    var mapEl = document.getElementById('detail-map');
    if (mapEl && !window.L) {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
      var js = document.createElement('script'); js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      js.onload = function () { mountMap(); };
      document.head.appendChild(js);
    } else if (mapEl && window.L) {
      mountMap();
    }
    function mountMap() {
      var map = L.map('detail-map').setView([listing.lat, listing.lng], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
      var icon = L.divIcon({ className: '', html: '<div class="m-map-pin featured">' + ManzilApp.formatPrice(listing.price_aed) + '</div>', iconSize: [80, 28], iconAnchor: [40, 28] });
      L.marker([listing.lat, listing.lng], { icon: icon }).addTo(map);
    }
  }

  window.ListingDetail = {
    load: load, openLightbox: openLightbox,
    toggleCompare: function () { ManzilApp.toggleCompare(listing.id); render(); }
  };
})();
