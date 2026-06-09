/* profile.js - Profile + settings: streak, total entries, language, theme, reset. */
(function () {
  'use strict';
  window.LahzaViews = window.LahzaViews || {};
  var esc = function (s) { return LahzaApp.escapeHtml(s); };

  window.LahzaViews.profile = function (app) {
    Promise.all([
      LahzaApp.api('/settings'),
      LahzaApp.api('/streak'),
      LahzaApp.api('/entries'),
      LahzaAI.health()
    ]).then(function (rs) {
      var s = rs[0].body.settings || {};
      var streak = rs[1].body.streak || 0;
      var entries = rs[2].body.items || [];
      var ai = rs[3];
      render(app, s, streak, entries, ai);
    });
  };

  function render(app, s, streak, entries, ai) {
    var aiLabel = ai.live ? 'Live · Haiku 4.5' : 'Demo mode';
    var aiClass = ai.live ? 'success' : '';
    app.innerHTML =
        '<div class="lz-topbar"><div class="lz-topbar-title">Profile</div></div>'
      + '<div class="lz-view">'
      +   '<div class="lz-card-strong lz-card">'
      +     '<div style="display:flex;align-items:center;gap:14px;">'
      +       '<div style="width:56px;height:56px;border-radius:14px;background:rgba(255,255,255,0.18);display:grid;place-items:center;font-family:var(--lz-font-display);font-weight:700;font-size:24px;">' + esc(initials()) + '</div>'
      +       '<div>'
      +         '<div style="font-family:var(--lz-font-display);font-size:20px;font-weight:700;">' + streak + ' day streak</div>'
      +         '<div style="font-size:13px;opacity:0.9;">' + entries.length + ' entries · since ' + esc(earliestDate(entries)) + '</div>'
      +       '</div>'
      +     '</div>'
      +   '</div>'

      +   '<div class="lz-section-title">AI mode</div>'
      +   '<div class="lz-card" style="display:flex;align-items:center;justify-content:space-between;gap:10px;">'
      +     '<div>'
      +       '<div style="font-size:14px;font-weight:600;">' + esc(aiLabel) + '</div>'
      +       '<div style="font-size:11.5px;color:var(--lz-muted);margin-top:2px;">' + (ai.live ? 'Real Claude via Worker proxy' : 'Deterministic mock - see README for Live setup') + '</div>'
      +     '</div>'
      +     '<span class="lz-mood-chip"' + (ai.live ? ' style="background:rgba(81,207,102,0.18);color:var(--lz-mood-energized);"' : '') + '>' + esc(ai.live ? 'LIVE' : 'DEMO') + '</span>'
      +   '</div>'

      +   '<div class="lz-section-title">Settings</div>'
      +   '<div class="lz-card">'
      +     '<div class="lz-field" style="margin-bottom:14px;">'
      +       '<div class="lz-field-label">Language</div>'
      +       '<select class="lz-select" id="pf-locale">'
      +         '<option value="en"' + (s.locale === 'en' ? ' selected' : '') + '>English</option>'
      +         '<option value="ar"' + (s.locale === 'ar' ? ' selected' : '') + '>العربية</option>'
      +       '</select>'
      +     '</div>'
      +     '<div class="lz-field" style="margin-bottom:14px;">'
      +       '<div class="lz-field-label">Theme</div>'
      +       '<select class="lz-select" id="pf-theme">'
      +         '<option value="auto"' + (s.theme === 'auto' ? ' selected' : '') + '>Auto (match device)</option>'
      +         '<option value="dark"' + (s.theme === 'dark' ? ' selected' : '') + '>Dark</option>'
      +         '<option value="light"' + (s.theme === 'light' ? ' selected' : '') + '>Light</option>'
      +       '</select>'
      +     '</div>'
      +     '<div class="lz-field" style="margin-bottom:0;">'
      +       '<div class="lz-field-label">Daily reminder</div>'
      +       '<input class="lz-input" type="time" id="pf-reminder" value="' + esc(s.reminder_time || '21:00') + '">'
      +     '</div>'
      +   '</div>'

      +   '<div class="lz-section-title">Privacy</div>'
      +   '<div class="lz-card" style="font-size:13px;color:var(--lz-ink-2);line-height:1.6;">'
      +     esc(s.privacy_note || 'Entries are stored only in your browser.')
      +   '</div>'

      +   '<div class="lz-section-title">Danger zone</div>'
      +   '<button class="lz-btn lz-btn--block" id="pf-export">📤 Export entries as JSON</button>'
      +   '<button class="lz-btn lz-btn--block" id="pf-reset" style="margin-top:8px;color:var(--lz-coral);border-color:rgba(255,107,107,0.45);">🗑 Reset demo (wipes everything)</button>'

      +   '<div style="margin-top:24px;text-align:center;font-size:11px;color:var(--lz-muted);font-family:var(--lz-font-mono);">'
      +     'Lahza · part of <a href="/" style="color:var(--lz-coral);" target="_blank" rel="noopener">saadm.dev</a> · v2.4.0'
      +   '</div>'
      + '</div>';

    document.getElementById('pf-locale').addEventListener('change', function (e) {
      LahzaApp.api('/settings', { method: 'POST', body: { locale: e.target.value } }).then(function () {
        document.documentElement.lang = e.target.value;
        document.body.setAttribute('dir', e.target.value === 'ar' ? 'rtl' : 'ltr');
        window.toast('Language updated', 'success');
      });
    });
    document.getElementById('pf-theme').addEventListener('change', function (e) {
      LahzaApp.api('/settings', { method: 'POST', body: { theme: e.target.value } }).then(function () { window.toast('Theme updated', 'success'); });
    });
    document.getElementById('pf-reminder').addEventListener('change', function (e) {
      LahzaApp.api('/settings', { method: 'POST', body: { reminder_time: e.target.value } }).then(function () { window.toast('Reminder updated', 'success'); });
    });
    document.getElementById('pf-export').addEventListener('click', function () {
      LahzaApp.api('/entries').then(function (r) {
        var blob = new Blob([JSON.stringify(r.body.items || [], null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = 'lahza-export-' + new Date().toISOString().slice(0,10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
        window.toast('Exported', 'success');
      });
    });
    document.getElementById('pf-reset').addEventListener('click', function () {
      if (!confirm('Wipe all entries, settings, and AI Coach history? Seed data will reload on next visit.')) return;
      // Wipe extra localStorage keys the mock-api /reset doesn't know about
      try {
        localStorage.removeItem('lahza.coach.history');
        localStorage.removeItem('lahza.coach.histVersion');
        localStorage.removeItem('lahza.entries.deletedSeed');
      } catch (e) {}
      LahzaApp.api('/reset', { method: 'POST' }).then(function () {
        window.toast('Demo reset', 'warn');
        setTimeout(function () { location.reload(); }, 600);
      });
    });
  }

  function initials() {
    return 'YOU';
  }
  function earliestDate(entries) {
    if (!entries.length) return '-';
    var oldest = entries[entries.length - 1];
    return new Date(oldest.ts).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  }
})();
