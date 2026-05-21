/* map.js — Leaflet wrapper for the dispatcher console map.
 *
 * Lifts the Leaflet pattern from /property/ (Manzil) but uses different
 * pin types: vehicles (van/bike icons that move tick-by-tick), orders
 * (delivery destination pins coloured by status), and the hub (a single
 * fixed marker). Exposes window.MarsadMap with init / addOrder / addVehicle
 * / updateVehicle / focus / clear methods. */
(function () {
  'use strict';
  var M;                              // the Leaflet map instance
  var vehicleLayers = {};             // vehicleId -> { marker, accuracyCircle }
  var orderLayers = {};               // orderId -> marker
  var routeLayer = null;
  var hubMarker = null;
  var followVehicleId = null;

  var DEFAULT_CENTER = [25.18, 55.27];   // Dubai roughly centred
  var DEFAULT_ZOOM = 11;

  function vehicleIconHtml(type, status) {
    var emoji = type === 'bike' ? '🛵' : '🚐';
    var cls = 'mrs-vehicle-marker' + (status === 'off_shift' ? ' off' : '');
    return '<div class="' + cls + '">' + emoji + '</div>';
  }
  function orderIconHtml(status) {
    var color = (
      status === 'delivered' ? '#34d399' :
      status === 'failed'    ? '#ef4444' :
      status === 'in_transit'? '#fb923c' :
      status === 'picked_up' ? '#fb923c' :
      status === 'assigned'  ? '#facc15' :
                                '#94a3b8'    // pending
    );
    return '<div class="mrs-order-marker" style="background:' + color + ';" data-status="' + status + '"></div>';
  }
  function hubIconHtml() {
    return '<div class="mrs-hub-marker">📦</div>';
  }

  function init(elId) {
    var el = document.getElementById(elId);
    if (!el) return null;
    if (typeof L === 'undefined') {
      el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--mrs-muted);">Leaflet failed to load. Map unavailable.</div>';
      return null;
    }
    M = L.map(el, { zoomControl: true, attributionControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap · © CARTO',
      maxZoom: 19, subdomains: 'abcd'
    }).addTo(M);
    return M;
  }

  function placeHub(hub) {
    if (!M) return;
    if (hubMarker) M.removeLayer(hubMarker);
    hubMarker = L.marker([hub.lat, hub.lng], {
      icon: L.divIcon({ html: hubIconHtml(), iconSize: [36, 36], iconAnchor: [18, 18], className: '' }),
      zIndexOffset: 1000
    }).bindPopup('<strong>Hub</strong><br/>' + hub.name).addTo(M);
  }

  function placeOrder(o) {
    if (!M) return;
    if (orderLayers[o.id]) M.removeLayer(orderLayers[o.id]);
    var marker = L.marker([o.dropoff_lat, o.dropoff_lng], {
      icon: L.divIcon({ html: orderIconHtml(o.status), iconSize: [16, 16], iconAnchor: [8, 8], className: '' })
    });
    var sla = o.sla_breached ? '<span style="color:#ef4444;font-weight:600;">SLA BREACHED</span> · ' : '';
    marker.bindPopup(
      '<div style="min-width:200px;">'
      + '<strong>' + escape(o.number) + '</strong> · ' + escape(o.status) + '<br/>'
      + sla
      + '<small>' + escape(o.zone_name) + ' · ' + escape(o.kind) + '</small><br/>'
      + '<small>' + escape(o.customer_name) + '</small>'
      + '</div>'
    );
    marker.addTo(M);
    orderLayers[o.id] = marker;
    return marker;
  }

  function placeVehicle(v) {
    if (!M) return;
    if (vehicleLayers[v.id]) M.removeLayer(vehicleLayers[v.id].marker);
    var driver = (window.MARSAD_DATA.DRIVERS || []).find(function (d) { return d.id === v.driver_id; });
    var status = driver ? driver.status : 'idle';
    var marker = L.marker([v.lat, v.lng], {
      icon: L.divIcon({ html: vehicleIconHtml(v.type, status), iconSize: [32, 32], iconAnchor: [16, 16], className: '' }),
      zIndexOffset: 500
    });
    marker.bindPopup(
      '<div style="min-width:200px;">'
      + '<strong>' + escape(v.reg) + '</strong> · ' + escape(v.type) + '<br/>'
      + (driver ? '<small>' + escape(driver.name) + ' · ' + escape(driver.shift) + ' shift</small><br/>' : '')
      + '<small>Speed: ' + Math.round(v.speed_kmh || 0) + ' km/h · Fuel: ' + Math.round(v.fuel_pct || 0) + '%</small>'
      + '</div>'
    );
    marker.addTo(M);
    vehicleLayers[v.id] = { marker: marker };
  }

  function updateVehiclePosition(v) {
    if (!M) return;
    var layer = vehicleLayers[v.id];
    if (!layer) { placeVehicle(v); return; }
    layer.marker.setLatLng([v.lat, v.lng]);
    // Update popup content
    var driver = (window.MARSAD_DATA.DRIVERS || []).find(function (d) { return d.id === v.driver_id; });
    layer.marker.setPopupContent(
      '<div style="min-width:200px;">'
      + '<strong>' + escape(v.reg) + '</strong> · ' + escape(v.type) + '<br/>'
      + (driver ? '<small>' + escape(driver.name) + ' · ' + escape(driver.shift) + ' shift</small><br/>' : '')
      + '<small>Speed: ' + Math.round(v.speed_kmh || 0) + ' km/h · Fuel: ' + Math.round(v.fuel_pct || 0) + '%</small>'
      + '</div>'
    );
    if (followVehicleId === v.id) M.setView([v.lat, v.lng], M.getZoom(), { animate: true });
  }

  function updateOrderStatus(o) {
    if (!M) return;
    var marker = orderLayers[o.id];
    if (!marker) return;
    marker.setIcon(L.divIcon({ html: orderIconHtml(o.status), iconSize: [16, 16], iconAnchor: [8, 8], className: '' }));
  }

  function focusOrder(o) {
    if (!M || !o) return;
    M.setView([o.dropoff_lat, o.dropoff_lng], 14, { animate: true });
    var marker = orderLayers[o.id];
    if (marker) marker.openPopup();
  }

  function focusVehicle(v) {
    if (!M || !v) return;
    M.setView([v.lat, v.lng], 14, { animate: true });
    var layer = vehicleLayers[v.id];
    if (layer) layer.marker.openPopup();
    followVehicleId = v.id;
    setTimeout(function () { followVehicleId = null; }, 8000);
  }

  function drawRoute(coords) {
    if (!M) return;
    if (routeLayer) M.removeLayer(routeLayer);
    if (!coords || coords.length < 2) return;
    routeLayer = L.polyline(coords, { color: '#22d3ee', weight: 3, opacity: 0.8, dashArray: '6,4' }).addTo(M);
    M.fitBounds(routeLayer.getBounds(), { padding: [60, 60] });
  }

  function clearAll() {
    Object.values(vehicleLayers).forEach(function (l) { M.removeLayer(l.marker); });
    Object.values(orderLayers).forEach(function (m) { M.removeLayer(m); });
    if (routeLayer) M.removeLayer(routeLayer);
    if (hubMarker) M.removeLayer(hubMarker);
    vehicleLayers = {}; orderLayers = {};
  }

  function escape(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  window.MarsadMap = {
    init: init,
    placeHub: placeHub,
    placeOrder: placeOrder,
    placeVehicle: placeVehicle,
    updateVehiclePosition: updateVehiclePosition,
    updateOrderStatus: updateOrderStatus,
    focusOrder: focusOrder,
    focusVehicle: focusVehicle,
    drawRoute: drawRoute,
    clearAll: clearAll
  };
})();
