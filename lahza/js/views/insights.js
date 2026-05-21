/* insights.js — 7-day mood line chart + theme tag list + AI weekly summary. */
(function () {
  'use strict';
  window.LahzaViews = window.LahzaViews || {};
  var esc = function (s) { return LahzaApp.escapeHtml(s); };

  window.LahzaViews.insights = function (app) {
    app.innerHTML =
        '<div class="lz-topbar"><div class="lz-topbar-title">Insights</div></div>'
      + '<div class="lz-view">'
      +   '<div class="lz-loading"><span></span><span></span><span></span></div>'
      + '</div>';

    Promise.all([
      LahzaApp.api('/mood/week'),
      LahzaApp.api('/insights/tags'),
      LahzaApp.api('/entries?limit=14')
    ]).then(function (rs) {
      render(app, rs[0].body.days || [], rs[1].body.themes || [], rs[2].body.items || []);
    });
  };

  function render(app, days, themes, entries) {
    var themesInnerHtml = themes.map(function (t) {
      return '<span class="lz-mood-chip" style="font-size:13px;">#' + esc(t.tag) + ' <span style="opacity:.6;margin-left:4px;">' + t.count + '</span></span>';
    }).join('');
    var themesBlock = themes.length
      ? '<div class="lz-card" style="display:flex;flex-wrap:wrap;gap:8px;">' + themesInnerHtml + '</div>'
      : '<div class="lz-card" style="text-align:center;color:var(--lz-muted);">Not enough entries yet to find themes.</div>';

    app.innerHTML =
        '<div class="lz-topbar"><div class="lz-topbar-title">Insights</div></div>'
      + '<div class="lz-view">'
      +   '<div class="lz-section-title">Last 7 days · mood</div>'
      +   '<div class="lz-card">' + chartSvg(days) + '</div>'
      +   '<div class="lz-section-title">What kept showing up</div>'
      +   themesBlock
      +   '<div class="lz-section-title">✦ Weekly summary</div>'
      +   '<div class="lz-ai-panel" id="ins-ai">'
      +     '<div class="lz-ai-panel-body"><span class="lz-ai-loading"></span> <span style="color:var(--lz-muted);">Reading the last week…</span></div>'
      +   '</div>'
      + '</div>';

    // Fetch the AI weekly summary
    LahzaAI.weeklyInsights({ entries: entries.slice(0, 7) }).then(function (r) {
      var aiEl = document.getElementById('ins-ai');
      if (!aiEl) return;
      var html = esc(r.text).replace(/\*\*([^*]+)\*\*/g, '<strong style="color:var(--lz-coral);">$1</strong>');
      aiEl.innerHTML =
          '<div class="lz-ai-panel-head">✦ AI summary <span style="font-family:var(--lz-font-mono);font-size:10px;color:var(--lz-muted);margin-inline-start:auto;font-weight:600;">' + (r.fallback ? 'demo' : 'live') + ' · ' + (r.latency_ms || 0) + 'ms</span></div>'
        + '<div class="lz-ai-panel-body" style="white-space:pre-wrap;">' + html + '</div>';
    });
  }

  function chartSvg(days) {
    var w = 320, h = 140, pad = 24;
    var scoreMin = 0, scoreMax = 5;
    var pts = days.map(function (d, i) {
      var x = pad + (i * (w - pad * 2) / (days.length - 1 || 1));
      var y = d.score == null ? null : h - pad - ((d.score - scoreMin) / (scoreMax - scoreMin)) * (h - pad * 2);
      return { x: x, y: y, d: d };
    });
    var validPts = pts.filter(function (p) { return p.y != null; });
    if (validPts.length === 0) {
      // Empty state — no entries this week
      return '<div class="lz-chart" style="display:grid;place-items:center;color:var(--lz-muted);font-size:12.5px;">'
        + 'Write a few entries this week to see the chart fill in.'
        + '</div>';
    }
    // Single-point chart: just render the dot + axis labels, no line.
    var path = '', fillPath = '';
    if (validPts.length >= 2) {
      path = validPts.map(function (p, i) {
        return (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1);
      }).join(' ');
      fillPath = path
        + ' L' + validPts[validPts.length - 1].x.toFixed(1) + ',' + (h - pad)
        + ' L' + validPts[0].x.toFixed(1) + ',' + (h - pad) + ' Z';
    }
    var grid = '';
    for (var i = 1; i < 4; i++) {
      var y = pad + i * (h - pad * 2) / 4;
      grid += '<line x1="' + pad + '" y1="' + y + '" x2="' + (w - pad) + '" y2="' + y + '"/>';
    }
    var labels = days.map(function (d, i) {
      var x = pad + (i * (w - pad * 2) / (days.length - 1 || 1));
      return '<text x="' + x.toFixed(1) + '" y="' + (h - 6) + '" text-anchor="middle">' + esc(d.day.slice(0, 3)) + '</text>';
    }).join('');
    var dots = validPts.map(function (p) {
      return '<circle class="lz-chart-dot" cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.5"/>';
    }).join('');
    return '<div class="lz-chart"><svg class="lz-chart-svg" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">'
      + '<g class="lz-chart-grid">' + grid + '</g>'
      + '<g class="lz-chart-axis">' + labels + '</g>'
      + '<path class="lz-chart-fill" d="' + fillPath + '"/>'
      + '<path class="lz-chart-line" d="' + path + '"/>'
      + dots
      + '</svg></div>';
  }
})();
