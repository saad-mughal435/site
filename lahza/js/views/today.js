/* today.js — Today view. AI prompt of the day + streak ring + recent strip. */
(function () {
  'use strict';
  window.LahzaViews = window.LahzaViews || {};
  var esc = function (s) { return LahzaApp.escapeHtml(s); };

  window.LahzaViews.today = function (app) {
    app.innerHTML =
        '<div class="lz-topbar"><div class="lz-topbar-title">Today</div></div>'
      + '<div class="lz-view">'
      +   '<div class="lz-loading"><span></span><span></span><span></span></div>'
      + '</div>';

    Promise.all([
      LahzaApp.api('/streak'),
      LahzaApp.api('/entries?limit=4'),
      LahzaApp.api('/settings')
    ]).then(function (rs) {
      var streak = rs[0].body.streak || 0;
      var entries = rs[1].body.items || [];
      var settings = rs[2].body.settings || {};
      render(streak, entries, settings);
    });

    function render(streak, entries, settings) {
      var hr = new Date().getHours();
      var greeting = hr < 5 ? 'Late one?' : hr < 12 ? 'Good morning.' : hr < 17 ? 'Afternoon.' : hr < 22 ? 'Evening.' : 'Late one?';
      var todayKey = new Date().toISOString().slice(0, 10);
      var alreadyToday = entries.some(function (e) { return e.date === todayKey; });

      // Streak ring SVG (circle progress)
      var ringPct = Math.min(1, streak / 30);
      var r = 38, cir = 2 * Math.PI * r;
      var ringSvg =
          '<svg viewBox="0 0 96 96" width="96" height="96">'
        +   '<circle class="lz-streak-ring-track" cx="48" cy="48" r="' + r + '" stroke-width="6"/>'
        +   '<circle class="lz-streak-ring-fill"  cx="48" cy="48" r="' + r + '" stroke-width="6" stroke-dasharray="' + cir.toFixed(1) + '" stroke-dashoffset="' + (cir * (1 - ringPct)).toFixed(1) + '"/>'
        + '</svg>';

      var ctaLabel = alreadyToday ? '✓ Already written today — add another' : '+ Write today’s entry';
      var recentHtml = entries.length === 0
        ? '<div class="lz-card" style="text-align:center;color:var(--lz-muted);font-size:13.5px;padding:20px;">No entries yet. Start tonight.</div>'
        : entries.slice(0, 4).map(function (e) { return entryRow(e); }).join('');

      app.innerHTML =
          '<div class="lz-topbar"><div class="lz-topbar-title">' + esc(greeting) + '</div></div>'
        + '<div class="lz-view">'
        +   '<div class="lz-card" style="display:flex;align-items:center;gap:16px;">'
        +     '<div class="lz-streak-ring">' + ringSvg + '<div class="lz-streak-ring-text">' + streak + '<small>day streak</small></div></div>'
        +     '<div style="flex:1;">'
        +       '<div style="font-size:13px;color:var(--lz-muted);text-transform:uppercase;letter-spacing:.06em;font-weight:700;margin-bottom:4px;">Today’s prompt</div>'
        +       '<div id="today-prompt" style="font-size:16px;font-weight:600;line-height:1.4;color:var(--lz-ink);min-height:42px;"><span class="lz-ai-loading"></span> <span style="color:var(--lz-muted);">Asking AI for a prompt…</span></div>'
        +     '</div>'
        +   '</div>'
        +   '<button class="lz-btn lz-btn--primary lz-btn--lg lz-btn--block" id="today-compose">' + ctaLabel + '</button>'
        +   '<div class="lz-section-title">Recent</div>'
        +   '<div id="today-recent">' + recentHtml + '</div>'
        + '</div>';

      // Wire compose CTA
      document.getElementById('today-compose').addEventListener('click', function () {
        window.location.hash = 'compose';
      });
      // Wire entry rows
      app.querySelectorAll('[data-entry-id]').forEach(function (el) {
        el.addEventListener('click', function () { openEntrySheet(el.getAttribute('data-entry-id')); });
      });

      // Fetch the AI prompt async
      var recentMood = entries[0] && entries[0].mood;
      LahzaAI.suggestPrompt({ hour: hr, recent_mood: recentMood, day_of_week: new Date().toLocaleDateString('en', { weekday: 'long' }) }).then(function (r) {
        var el = document.getElementById('today-prompt');
        if (el) el.innerHTML = esc(r.text);
      }).catch(function () {
        var el = document.getElementById('today-prompt');
        if (el) el.innerHTML = esc('What surprised you today?');
      });
    }

    function entryRow(e) {
      return '<div class="lz-entry-card" data-entry-id="' + esc(e.id) + '" style="cursor:pointer;">'
        + '<div class="lz-mood-dot ' + esc(e.mood) + '" style="margin-top:6px;"></div>'
        + '<div style="flex:1;min-width:0;">'
        +   '<div class="lz-entry-card-date">' + esc(LahzaApp.fmtDate(e.ts)) + ' · ' + esc(LahzaApp.MOOD_LABEL[e.mood] || e.mood) + '</div>'
        +   '<div class="lz-entry-card-body" style="font-size:13.5px;line-height:1.5;">' + esc(e.body) + '</div>'
        + '</div>'
        + '</div>';
    }

    function openEntrySheet(id) {
      LahzaApp.api('/entries/' + encodeURIComponent(id)).then(function (r) {
        if (!r.body.ok) return;
        var e = r.body.entry;
        LahzaApp.showSheet({
          title: LahzaApp.fmtDateLong(e.ts),
          body:
              '<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;font-size:13px;color:var(--lz-ink-2);">'
            +   '<span style="font-size:24px;">' + (LahzaApp.MOOD_EMOJI[e.mood] || '😐') + '</span>'
            +   '<span class="lz-mood-chip"><span class="lz-mood-dot ' + esc(e.mood) + '"></span>' + esc(LahzaApp.MOOD_LABEL[e.mood] || e.mood) + '</span>'
            +   '<span style="color:var(--lz-muted);font-size:11.5px;font-family:var(--lz-font-mono);margin-inline-start:auto;">' + esc(LahzaApp.fmtTime(e.ts)) + '</span>'
            + '</div>'
            + '<p style="font-size:14.5px;line-height:1.65;white-space:pre-wrap;color:var(--lz-ink);">' + esc(e.body) + '</p>'
            + (e.tags && e.tags.length ? '<div class="lz-entry-card-tags">' + e.tags.map(function (t) { return '<span class="lz-mood-chip">#' + esc(t) + '</span>'; }).join('') + '</div>' : '')
            + (e.emotions && e.emotions.length ? '<div style="margin-top:10px;font-size:11.5px;color:var(--lz-muted);">Emotions: ' + esc(e.emotions.join(', ')) + '</div>' : '')
        });
      });
    }
  };
})();
