/* floorplan.js - Watad floor plan renderer.
 * Renders an SVG building outline per floor with equipment icons placed at
 * absolute pixel coordinates from data.js. Equipment pulses red when its
 * associated point has an active urgent/critical alarm. Hover tooltip shows
 * current point readings. Click drills into asset.html?id=<id>.
 *
 * Exposes window.WatadFloorPlan with: render(hostEl, floorId, opts).
 * Subscribes via WatadSim so it diff-renders without flicker.
 */
(function () {
  'use strict';
  var D = window.WATAD_DATA;
  var esc = WatadApp.escapeHtml;

  // Equipment icon glyph per type
  var GLYPH = {
    'chiller':       '❄',
    'cooling-tower': '🌀',
    'ahu':           '⬛',
    'fcu':           '◯',
    'light':         '⊕',
    'meter':         '⚡',
    'sensor-occ':    '⊙',
    'sensor-co2':    'CO₂'
  };

  // Wall outline per floor (SVG path strings, drawn to ~900×540 viewBox).
  // Hand-tuned for visual variety; not a literal architectural drawing.
  var FLOOR_OUTLINES = {
    'fl-roof': {
      walls: 'M40,80 L860,80 L860,460 L40,460 Z M40,200 L380,200 L380,460 M380,80 L380,200 M640,200 L860,200 M640,200 L640,460',
      label_zones: [
        { x: 200, y: 130, t: 'Chiller Plant' },
        { x: 540, y: 130, t: 'Cooling Tower Deck' },
        { x: 200, y: 340, t: 'Chiller Plant' },
        { x: 540, y: 340, t: 'AHU Plant Room' },
        { x: 760, y: 340, t: 'Electrical Room' }
      ]
    },
    'fl-l2': {
      walls: 'M40,80 L860,80 L860,460 L40,460 Z M40,260 L860,260 M180,80 L180,260 M340,80 L340,260 M500,80 L500,260 M660,80 L660,260 M780,260 L780,460 M200,260 L200,460 M400,260 L400,460 M600,260 L600,460',
      label_zones: [
        { x: 110, y: 170, t: 'Mirage Studios' },
        { x: 260, y: 170, t: 'Liwa Analytics' },
        { x: 420, y: 170, t: 'Burj Equities' },
        { x: 580, y: 170, t: 'Saif Trading' },
        { x: 760, y: 170, t: 'Pantry / IT' },
        { x: 120, y: 360, t: 'Open Office' },
        { x: 300, y: 360, t: 'Open Office' },
        { x: 500, y: 360, t: 'Training Suite' },
        { x: 690, y: 360, t: 'Pantry' },
        { x: 820, y: 360, t: 'IT' }
      ]
    },
    'fl-l1': {
      walls: 'M40,80 L860,80 L860,460 L40,460 Z M40,260 L860,260 M180,80 L180,260 M340,80 L340,260 M500,80 L500,260 M660,80 L660,260 M780,260 L780,460 M200,260 L200,460 M400,260 L400,460 M600,260 L600,460',
      label_zones: [
        { x: 110, y: 170, t: 'Acme · East' },
        { x: 260, y: 170, t: 'Acme · West' },
        { x: 420, y: 170, t: 'Nour Legal' },
        { x: 580, y: 170, t: 'Khaleej' },
        { x: 760, y: 170, t: 'Boardroom' },
        { x: 120, y: 360, t: 'Open Office' },
        { x: 300, y: 360, t: 'Open Office' },
        { x: 500, y: 360, t: 'Pantry' },
        { x: 690, y: 360, t: 'Pantry' },
        { x: 820, y: 360, t: 'Server' }
      ]
    },
    'fl-gnd': {
      walls: 'M40,80 L860,80 L860,460 L40,460 Z M40,280 L500,280 L500,460 M500,80 L500,280 M700,80 L700,460 M700,280 L860,280',
      label_zones: [
        { x: 270, y: 180, t: 'Main Lobby' },
        { x: 600, y: 180, t: 'Café & Retail' },
        { x: 270, y: 370, t: 'Reception' },
        { x: 780, y: 370, t: 'Parking Entry' }
      ]
    }
  };

  function buildSVG(floorId, w, h) {
    var spec = FLOOR_OUTLINES[floorId] || { walls: 'M40,80 L860,80 L860,460 L40,460 Z', label_zones: [] };
    return '<svg class="wtd-floor-svg" viewBox="0 0 ' + w + ' ' + h + '" xmlns="http://www.w3.org/2000/svg">'
      + '<defs>'
      +   '<linearGradient id="wtd-floor-bg" x1="0" y1="0" x2="0" y2="1">'
      +     '<stop offset="0%" stop-color="rgba(20,34,59,0.5)"/>'
      +     '<stop offset="100%" stop-color="rgba(10,20,38,0.85)"/>'
      +   '</linearGradient>'
      + '</defs>'
      + '<rect x="40" y="80" width="820" height="380" fill="url(#wtd-floor-bg)" rx="6"/>'
      + '<path d="' + spec.walls + '" fill="none" stroke="rgba(120,200,255,0.45)" stroke-width="1.5"/>'
      + spec.label_zones.map(function (z) {
          return '<text x="' + z.x + '" y="' + z.y + '" fill="rgba(184,197,221,0.6)" font-family="JetBrains Mono, monospace" font-size="10" text-anchor="middle" letter-spacing="0.5">' + esc(z.t) + '</text>';
        }).join('')
      + '</svg>';
  }

  function pointsForAsset(assetId) {
    return D.POINTS.filter(function (p) { return p.asset_id === assetId; });
  }

  function tooltipHtml(asset) {
    var pts = pointsForAsset(asset.id).slice(0, 6);
    var rows = pts.map(function (p) {
      var snap = window.WatadSim && window.WatadSim.getPoint(p.id);
      var v = snap ? WatadApp.fmtUnit(snap.value, p.unit) : '—';
      return p.name + ': ' + v;
    }).join('<br/>');
    return '<strong style="display:block;margin-bottom:4px;color:var(--wtd-cyan);">' + esc(asset.name) + '</strong>'
      + '<span style="font-family:var(--font-mono);font-size:10.5px;color:var(--wtd-ink-2);">' + rows + '</span>';
  }

  function activeAlarmsByAsset() {
    // Combine seeded + sim alarms (we read sim state for live ones)
    var byAsset = {};
    if (window.WatadSim && window.WatadSim.alarmsByPoint) {
      Object.keys(window.WatadSim.alarmsByPoint).forEach(function (pid) {
        var alm = window.WatadSim.alarmsByPoint[pid];
        if (!byAsset[alm.asset_id]) byAsset[alm.asset_id] = [];
        byAsset[alm.asset_id].push(alm);
      });
    }
    return byAsset;
  }

  var WatadFloorPlan = {
    render: function (host, floorId, opts) {
      opts = opts || {};
      var w = 900, h = 540;
      var floorAssets = D.ASSETS.filter(function (a) { return a.floor_id === floorId; });
      var alarmedByAsset = activeAlarmsByAsset();

      var html = buildSVG(floorId, w, h);
      floorAssets.forEach(function (a) {
        var hasAlarm = !!alarmedByAsset[a.id];
        var glyph = GLYPH[a.type] || '?';
        html += '<button class="wtd-equip is-' + a.type + (hasAlarm ? ' alarming' : '') + '" '
          + 'data-asset-id="' + esc(a.id) + '" '
          + 'style="left:' + a.x + 'px;top:' + a.y + 'px;" '
          + 'title="' + esc(a.name) + '">'
          + '<span>' + glyph + '</span>'
          + '<span class="wtd-equip-label">' + esc(a.name.split(' · ')[0]) + '</span>'
          + '<span class="wtd-equip-tooltip">' + tooltipHtml(a) + '</span>'
          + '</button>';
      });

      host.style.position = 'relative';
      host.style.minWidth = w + 'px';
      host.style.minHeight = h + 'px';
      host.innerHTML = html;

      // Click → drill into asset detail
      host.querySelectorAll('[data-asset-id]').forEach(function (el) {
        el.addEventListener('click', function () {
          window.location.href = 'asset.html?id=' + el.getAttribute('data-asset-id');
        });
      });
    },

    // Diff-render: just toggle .alarming class on existing icons without rebuilding.
    // Cheap path called on every sim tick.
    refreshAlarms: function (host) {
      var alarmedByAsset = activeAlarmsByAsset();
      host.querySelectorAll('[data-asset-id]').forEach(function (el) {
        var aid = el.getAttribute('data-asset-id');
        var wasAlarming = el.classList.contains('alarming');
        var isAlarming = !!alarmedByAsset[aid];
        if (wasAlarming !== isAlarming) el.classList.toggle('alarming', isAlarming);
      });
    },

    refreshTooltips: function (host) {
      // Rebuild tooltip contents with current sim values (cheap — just innerHTML
      // swap on the .wtd-equip-tooltip child, no event re-attach).
      host.querySelectorAll('[data-asset-id]').forEach(function (el) {
        var a = D.ASSETS.find(function (x) { return x.id === el.getAttribute('data-asset-id'); });
        if (!a) return;
        var tip = el.querySelector('.wtd-equip-tooltip');
        if (tip) tip.innerHTML = tooltipHtml(a);
      });
    }
  };

  window.WatadFloorPlan = WatadFloorPlan;
})();
