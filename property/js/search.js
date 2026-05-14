/* search.js — Filters + list/map view for search.html */
(function () {
  'use strict';

  var state = {
    params: ManzilApp.qs(),
    page: 1,
    page_size: 12,
    total: 0,
    items: [],
    view: 'list',
    map: null,
    markers: []
  };

  function readControlsToState() {
    var f = state.params;
    document.getElementById('f-q').value = f.q || '';
    document.getElementById('f-area').value = f.area || '';
    document.getElementById('f-type').value = f.type || '';
    document.getElementById('f-beds').value = f.beds || '';
    document.getElementById('f-baths').value = f.baths || '';
    document.getElementById('f-price-min').value = f.price_min || '';
    document.getElementById('f-price-max').value = f.price_max || '';
    document.getElementById('f-furnished').value = f.furnished || '';
    document.getElementById('f-completion').value = f.completion || '';
    document.getElementById('f-sort').value = f.sort || 'featured';
    document.querySelectorAll('[name=transaction]').forEach(function (r) {
      r.checked = (f.transaction || 'buy') === r.value;
    });
  }
  function pullParamsFromControls() {
    state.params.q = document.getElementById('f-q').value;
    state.params.area = document.getElementById('f-area').value;
    state.params.type = document.getElementById('f-type').value;
    state.params.beds = document.getElementById('f-beds').value;
    state.params.baths = document.getElementById('f-baths').value;
    state.params.price_min = document.getElementById('f-price-min').value;
    state.params.price_max = document.getElementById('f-price-max').value;
    state.params.furnished = document.getElementById('f-furnished').value;
    state.params.completion = document.getElementById('f-completion').value;
    state.params.sort = document.getElementById('f-sort').value;
    var tx = document.querySelector('[name=transaction]:checked');
    state.params.transaction = tx ? tx.value : 'buy';
    state.params.amenities = (window._selectedAmenities || []).join(',');
    state.page = 1;
  }

  function reflectInUrl() {
    var url = location.pathname + ManzilApp.buildQs(state.params);
    history.replaceState({}, '', url);
  }

  function fetchAndRender() {
    var q = Object.assign({}, state.params, { page: state.page, page_size: state.page_size });
    var skel = '';
    for (var i = 0; i < 6; i++) skel += '<div class="m-skel m-skel--card"></div>';
    document.getElementById('results').innerHTML = skel;
    ManzilApp.api('/listings' + ManzilApp.buildQs(q)).then(function (r) {
      state.total = r.total;
      state.items = r.items;
      renderList();
      renderPagination();
      renderMap();
      document.getElementById('count').textContent = r.total.toLocaleString() + ' result' + (r.total === 1 ? '' : 's');
    });
  }

  function renderList() {
    var host = document.getElementById('results');
    if (!state.items.length) {
      host.innerHTML = '<div class="m-empty"><div class="m-empty-icon">🔍</div><h3>No matches</h3><p>Try widening your filters — clear price or remove the beds constraint.</p><button class="m-btn m-btn--primary" onclick="window.SearchPage.clearAll()">Reset filters</button></div>';
      return;
    }
    host.innerHTML = state.items.map(ManzilApp.listingCard).join('');
    ManzilApp.updateAllPrices();
    // hover sync with map
    host.querySelectorAll('[data-listing-id]').forEach(function (card) {
      var id = card.getAttribute('data-listing-id');
      card.addEventListener('mouseenter', function () { highlightMarker(id, true); });
      card.addEventListener('mouseleave', function () { highlightMarker(id, false); });
    });
  }

  function renderPagination() {
    var pages = Math.ceil(state.total / state.page_size) || 1;
    var host = document.getElementById('pagination');
    if (pages <= 1) { host.innerHTML = ''; return; }
    var html = '<button class="m-btn m-btn--ghost m-btn--sm" ' + (state.page === 1 ? 'disabled' : '') + ' data-pg="' + (state.page - 1) + '">← Prev</button>';
    var max = Math.min(pages, 7);
    var start = Math.max(1, Math.min(state.page - 3, pages - max + 1));
    for (var p = start; p < start + max; p++) {
      html += '<button class="m-btn m-btn--ghost m-btn--sm' + (p === state.page ? ' m-btn--primary' : '') + '" data-pg="' + p + '">' + p + '</button>';
    }
    html += '<button class="m-btn m-btn--ghost m-btn--sm" ' + (state.page === pages ? 'disabled' : '') + ' data-pg="' + (state.page + 1) + '">Next →</button>';
    host.innerHTML = html;
    host.querySelectorAll('[data-pg]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.page = Number(b.getAttribute('data-pg'));
        fetchAndRender();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
  }

  function renderMap() {
    if (state.view !== 'map') return;
    if (!window.L) { return; }
    if (!state.map) {
      state.map = L.map('mapEl', { zoomControl: true, attributionControl: true }).setView([25.15, 55.25], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 18
      }).addTo(state.map);
    }
    // clear markers
    state.markers.forEach(function (m) { state.map.removeLayer(m); });
    state.markers = [];
    if (!state.items.length) return;
    var group = L.featureGroup();
    state.items.forEach(function (l) {
      var price = ManzilApp.formatPrice(l.price_aed);
      var icon = L.divIcon({
        className: '',
        html: '<div class="m-map-pin' + (l.featured ? ' featured' : '') + '" data-listing="' + l.id + '">' + price + '</div>',
        iconSize: [80, 28],
        iconAnchor: [40, 28]
      });
      var marker = L.marker([l.lat, l.lng], { icon: icon }).addTo(state.map);
      marker.bindPopup(
        '<div style="min-width:200px;">'
        + '<img src="' + (l.photos[0] || '') + '" style="width:100%;height:120px;object-fit:cover;border-radius:6px;" />'
        + '<div style="font-weight:700;margin-top:6px;">' + price + '</div>'
        + '<div style="font-size:12px;color:#666;">' + l.title + '</div>'
        + '<a href="listing.html?id=' + l.id + '" style="display:block;margin-top:6px;color:#1f7a55;font-weight:600;">View details →</a>'
        + '</div>'
      );
      state.markers.push(marker);
      group.addLayer(marker);
    });
    try { state.map.fitBounds(group.getBounds(), { padding: [20, 20], maxZoom: 13 }); } catch (e) {}
  }
  function highlightMarker(id, on) {
    var pin = document.querySelector('.m-map-pin[data-listing="' + id + '"]');
    if (pin) pin.classList.toggle('active', on);
  }

  function toggleView(v) {
    state.view = v;
    document.querySelectorAll('[data-view-btn]').forEach(function (b) {
      b.classList.toggle('m-btn--primary', b.getAttribute('data-view-btn') === v);
    });
    document.getElementById('listWrap').style.display = v === 'map' ? 'none' : '';
    document.getElementById('mapWrap').style.display = v === 'map' ? '' : 'none';
    if (v === 'map') ensureLeaflet(renderMap);
  }

  function ensureLeaflet(cb) {
    if (window.L) { cb(); return; }
    var css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(css);
    var js = document.createElement('script');
    js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    js.onload = cb;
    document.head.appendChild(js);
  }

  function setupAmenities() {
    var pool = MANZIL_DATA.AMENITIES.slice(0, 18);
    window._selectedAmenities = (state.params.amenities || '').split(',').filter(Boolean);
    var host = document.getElementById('f-amenities');
    host.innerHTML = pool.map(function (a) {
      var sel = window._selectedAmenities.indexOf(a.id) !== -1;
      return '<button type="button" class="m-pill' + (sel ? ' active' : '') + '" data-amen="' + a.id + '">' + a.icon + ' ' + a.label + '</button>';
    }).join('');
    host.querySelectorAll('[data-amen]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-amen');
        var idx = window._selectedAmenities.indexOf(id);
        if (idx === -1) window._selectedAmenities.push(id); else window._selectedAmenities.splice(idx, 1);
        b.classList.toggle('active');
      });
    });
  }

  function saveSearch() {
    var label = (state.params.q || '') || ((state.params.transaction || 'buy') + ' · ' + (state.params.area || 'any area'));
    ManzilApp.api('/saved-searches', { method: 'POST', body: { action: 'add', q: label, params: state.params, alerts: true } }).then(function () {
      window.toast('Search saved with alerts on', 'success');
      if (window.ManzilNotifications) window.ManzilNotifications.push('Search saved', label);
    });
  }

  function clearAll() {
    Object.keys(state.params).forEach(function (k) { state.params[k] = ''; });
    state.params.transaction = 'buy';
    state.params.sort = 'featured';
    window._selectedAmenities = [];
    readControlsToState();
    setupAmenities();
    state.page = 1;
    reflectInUrl();
    fetchAndRender();
  }

  function init() {
    // populate area select
    var areaSel = document.getElementById('f-area');
    areaSel.innerHTML = '<option value="">All areas</option>' + MANZIL_DATA.AREAS.map(function (a) {
      return '<option value="' + a.id + '">' + a.name + '</option>';
    }).join('');

    readControlsToState();
    setupAmenities();

    var debouncedApply = ManzilApp.debounce(function () { pullParamsFromControls(); reflectInUrl(); fetchAndRender(); }, 200);

    document.getElementById('filterForm').addEventListener('change', debouncedApply);
    document.getElementById('f-q').addEventListener('input', debouncedApply);

    document.querySelectorAll('[data-view-btn]').forEach(function (b) {
      b.addEventListener('click', function () { toggleView(b.getAttribute('data-view-btn')); });
    });

    document.getElementById('saveSearchBtn').addEventListener('click', saveSearch);
    document.getElementById('resetBtn').addEventListener('click', clearAll);

    // Mobile filter drawer
    document.getElementById('openFiltersBtn').addEventListener('click', function () {
      document.getElementById('mobileFilters').classList.add('open');
      document.getElementById('mobileFiltersBd').classList.add('open');
    });
    document.getElementById('mobileFiltersBd').addEventListener('click', function () {
      document.getElementById('mobileFilters').classList.remove('open');
      document.getElementById('mobileFiltersBd').classList.remove('open');
    });
    document.getElementById('closeFiltersBtn').addEventListener('click', function () {
      document.getElementById('mobileFilters').classList.remove('open');
      document.getElementById('mobileFiltersBd').classList.remove('open');
    });

    fetchAndRender();
  }

  window.SearchPage = { init: init, clearAll: clearAll };
})();
