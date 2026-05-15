/* search.js - Filters, list/map, date-aware availability */
(function () {
  'use strict';

  var state = {
    params: VacationApp.qs(),
    page: 1,
    page_size: 12,
    total: 0,
    items: [],
    view: 'list',
    map: null,
    markers: []
  };

  function readControls() {
    var f = state.params;
    document.getElementById('f-q').value = f.q || '';
    document.getElementById('f-dest').value = f.destination || '';
    document.getElementById('f-ci').value = f.check_in || '';
    document.getElementById('f-co').value = f.check_out || '';
    document.getElementById('f-g').value = f.max_guests || f.guests || '';
    document.getElementById('f-type').value = f.type || '';
    document.getElementById('f-beds').value = f.beds || '';
    document.getElementById('f-pmin').value = f.price_min || '';
    document.getElementById('f-pmax').value = f.price_max || '';
    document.getElementById('f-instant').checked = f.instant_book === 'true';
    document.getElementById('f-sort').value = f.sort || 'featured';
  }
  function pull() {
    state.params.q = document.getElementById('f-q').value;
    state.params.destination = document.getElementById('f-dest').value;
    state.params.check_in = document.getElementById('f-ci').value;
    state.params.check_out = document.getElementById('f-co').value;
    state.params.max_guests = document.getElementById('f-g').value;
    state.params.type = document.getElementById('f-type').value;
    state.params.beds = document.getElementById('f-beds').value;
    state.params.price_min = document.getElementById('f-pmin').value;
    state.params.price_max = document.getElementById('f-pmax').value;
    state.params.instant_book = document.getElementById('f-instant').checked ? 'true' : '';
    state.params.sort = document.getElementById('f-sort').value;
    state.params.amenities = (window._selectedAmens || []).join(',');
    state.page = 1;
  }
  function reflectInUrl() {
    history.replaceState({}, '', location.pathname + VacationApp.buildQs(state.params));
  }
  function nightsSelected() {
    if (state.params.check_in && state.params.check_out) {
      return VacationApp.nightsBetween(state.params.check_in, state.params.check_out);
    }
    return 0;
  }

  function fetchAndRender() {
    var q = Object.assign({}, state.params, { page: state.page, page_size: state.page_size });
    var skel = '';
    for (var i = 0; i < 6; i++) skel += '<div class="v-skel v-skel--card"></div>';
    document.getElementById('results').innerHTML = skel;
    VacationApp.api('/listings' + VacationApp.buildQs(q)).then(function (r) {
      state.total = r.body.total;
      state.items = r.body.items;
      renderList();
      renderPagination();
      renderMap();
      document.getElementById('count').textContent = r.body.total.toLocaleString() + ' stay' + (r.body.total === 1 ? '' : 's');
    });
  }

  function renderList() {
    var host = document.getElementById('results');
    if (!state.items.length) {
      host.innerHTML = '<div class="v-empty"><div class="v-empty-icon">🔍</div><h3>No stays match</h3><p>Try widening dates or removing a filter.</p><button class="v-btn v-btn--primary" onclick="window.SearchPage.clearAll()">Reset filters</button></div>';
      return;
    }
    var nights = nightsSelected();
    host.innerHTML = state.items.map(function (l) {
      return VacationApp.listingCard(l, { nights: nights, checkIn: state.params.check_in, checkOut: state.params.check_out });
    }).join('');
    VacationApp.updateAllPrices();
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
    var html = '<button class="v-btn v-btn--ghost v-btn--sm" ' + (state.page === 1 ? 'disabled' : '') + ' data-pg="' + (state.page - 1) + '">← Prev</button>';
    var max = Math.min(pages, 7);
    var start = Math.max(1, Math.min(state.page - 3, pages - max + 1));
    for (var p = start; p < start + max; p++) {
      html += '<button class="v-btn v-btn--ghost v-btn--sm' + (p === state.page ? ' v-btn--primary' : '') + '" data-pg="' + p + '">' + p + '</button>';
    }
    html += '<button class="v-btn v-btn--ghost v-btn--sm" ' + (state.page === pages ? 'disabled' : '') + ' data-pg="' + (state.page + 1) + '">Next →</button>';
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
    if (state.view !== 'map' || !window.L) return;
    if (!state.map) {
      state.map = L.map('mapEl', { zoomControl: true }).setView([25.0, 55.3], 9);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap', maxZoom: 18 }).addTo(state.map);
    }
    state.markers.forEach(function (m) { state.map.removeLayer(m); });
    state.markers = [];
    if (!state.items.length) return;
    var group = L.featureGroup();
    state.items.forEach(function (l) {
      var price = VacationApp.formatPrice(l.base_nightly_aed);
      var icon = L.divIcon({ className: '', html: '<div class="v-map-pin" data-listing="' + l.id + '">' + price + '</div>', iconSize: [80, 28], iconAnchor: [40, 28] });
      var marker = L.marker([l.lat, l.lng], { icon: icon }).addTo(state.map);
      marker.bindPopup(
        '<div style="min-width:200px;">'
        + '<img src="' + (l.photos[0] || '') + '" style="width:100%;height:120px;object-fit:cover;border-radius:6px;" />'
        + '<div style="font-weight:700;margin-top:6px;">' + price + ' / night</div>'
        + '<div style="font-size:12px;color:#666;">' + l.title + '</div>'
        + '<a href="stay.html?id=' + l.id + '" style="display:block;margin-top:6px;color:#c66b3d;font-weight:600;">View details →</a>'
        + '</div>'
      );
      state.markers.push(marker);
      group.addLayer(marker);
    });
    try { state.map.fitBounds(group.getBounds(), { padding: [20, 20], maxZoom: 13 }); } catch (e) {}
  }
  function highlightMarker(id, on) {
    var pin = document.querySelector('.v-map-pin[data-listing="' + id + '"]');
    if (pin) pin.classList.toggle('active', on);
  }

  function toggleView(v) {
    state.view = v;
    document.querySelectorAll('[data-view-btn]').forEach(function (b) {
      b.classList.toggle('v-btn--primary', b.getAttribute('data-view-btn') === v);
    });
    document.getElementById('listWrap').style.display = v === 'map' ? 'none' : '';
    document.getElementById('mapWrap').style.display = v === 'map' ? '' : 'none';
    if (v === 'map') ensureLeaflet(renderMap);
  }
  function ensureLeaflet(cb) {
    if (window.L) { cb(); return; }
    var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'; document.head.appendChild(css);
    var js = document.createElement('script'); js.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'; js.onload = cb; document.head.appendChild(js);
  }

  function setupAmenities() {
    var pool = VACATION_DATA.AMENITIES.slice(0, 16);
    window._selectedAmens = (state.params.amenities || '').split(',').filter(Boolean);
    var host = document.getElementById('f-amenities');
    host.innerHTML = pool.map(function (a) {
      var sel = window._selectedAmens.indexOf(a.id) !== -1;
      return '<button type="button" class="v-pill' + (sel ? ' active' : '') + '" data-amen="' + a.id + '">' + a.icon + ' ' + a.label + '</button>';
    }).join('');
    host.querySelectorAll('[data-amen]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-amen');
        var idx = window._selectedAmens.indexOf(id);
        if (idx === -1) window._selectedAmens.push(id); else window._selectedAmens.splice(idx, 1);
        b.classList.toggle('active');
      });
    });
  }

  function clearAll() {
    Object.keys(state.params).forEach(function (k) { state.params[k] = ''; });
    state.params.sort = 'featured';
    window._selectedAmens = [];
    readControls();
    setupAmenities();
    state.page = 1;
    reflectInUrl();
    fetchAndRender();
  }

  function init() {
    // Populate destination select
    var destSel = document.getElementById('f-dest');
    destSel.innerHTML = '<option value="">All destinations</option>' + VACATION_DATA.DESTINATIONS.map(function (d) { return '<option value="' + d.id + '">' + d.name + '</option>'; }).join('');

    readControls();
    setupAmenities();

    var debApply = VacationApp.debounce(function () { pull(); reflectInUrl(); fetchAndRender(); }, 200);
    document.getElementById('filterForm').addEventListener('change', debApply);
    document.getElementById('f-q').addEventListener('input', debApply);

    document.querySelectorAll('[data-view-btn]').forEach(function (b) {
      b.addEventListener('click', function () { toggleView(b.getAttribute('data-view-btn')); });
    });
    document.getElementById('resetBtn').addEventListener('click', clearAll);

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
