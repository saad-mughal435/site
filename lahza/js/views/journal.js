/* journal.js — chronological feed with search + mood filter chips. */
(function () {
  'use strict';
  window.LahzaViews = window.LahzaViews || {};
  var esc = function (s) { return LahzaApp.escapeHtml(s); };
  var state = { q: '', mood: 'all' };

  var MOODS = ['all', 'joyful', 'calm', 'energized', 'tense', 'low', 'neutral'];

  window.LahzaViews.journal = function (app) {
    render(app);
    refresh(app);
  };

  function render(app) {
    var chipsHtml = MOODS.map(function (m) {
      var activeStyle = state.mood === m ? ' style="background:rgba(255,107,107,0.18);border-color:var(--lz-coral);color:var(--lz-coral);"' : '';
      var label = m === 'all' ? 'All' : (LahzaApp.MOOD_EMOJI[m] || '') + ' ' + LahzaApp.MOOD_LABEL[m];
      return '<button class="lz-prompt-chip" data-mood="' + m + '"' + activeStyle + '>' + label + '</button>';
    }).join('');

    app.innerHTML =
        '<div class="lz-topbar"><div class="lz-topbar-title">Journal</div></div>'
      + '<div class="lz-view">'
      +   '<input class="lz-input" id="jr-search" aria-label="Search entries" placeholder="Search entries…" style="margin-bottom:10px;" value="' + esc(state.q) + '">'
      +   '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;overflow-x:auto;">' + chipsHtml + '</div>'
      +   '<div id="jr-list"><div class="lz-loading"><span></span><span></span><span></span></div></div>'
      + '</div>';

    // Search
    var search = document.getElementById('jr-search');
    search.addEventListener('input', function () {
      state.q = search.value;
      clearTimeout(window.__jrSearch);
      window.__jrSearch = setTimeout(function () { refresh(app); }, 200);
    });

    // Mood filter chips
    app.querySelectorAll('[data-mood]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.mood = b.getAttribute('data-mood');
        render(app);
        refresh(app);
      });
    });
  }

  function refresh(app) {
    var params = [];
    if (state.q) params.push('q=' + encodeURIComponent(state.q));
    if (state.mood !== 'all') params.push('mood=' + encodeURIComponent(state.mood));
    LahzaApp.api('/entries' + (params.length ? '?' + params.join('&') : '')).then(function (r) {
      var entries = r.body.items || [];
      var host = document.getElementById('jr-list');
      if (!host) return;
      if (!entries.length) {
        host.innerHTML = '<div class="lz-card" style="text-align:center;color:var(--lz-muted);padding:24px;">No entries match. Try clearing the filter.</div>';
        return;
      }
      // Group by month
      var groups = {};
      entries.forEach(function (e) {
        var key = new Date(e.ts).toLocaleDateString('en', { month: 'long', year: 'numeric' });
        (groups[key] = groups[key] || []).push(e);
      });
      host.innerHTML = Object.keys(groups).map(function (k) {
        return '<div class="lz-section-title">' + esc(k) + '</div>'
          + groups[k].map(entryCard).join('');
      }).join('');
      host.querySelectorAll('[data-entry]').forEach(function (el) {
        el.addEventListener('click', function () { openEntrySheet(el.getAttribute('data-entry')); });
      });
    });
  }

  function entryCard(e) {
    return '<div class="lz-entry-card" data-entry="' + esc(e.id) + '" style="cursor:pointer;">'
      + '<div class="lz-mood-dot ' + esc(e.mood) + '" style="margin-top:6px;"></div>'
      + '<div style="flex:1;min-width:0;">'
      +   '<div class="lz-entry-card-date">' + esc(LahzaApp.fmtDate(e.ts)) + ' · ' + esc(LahzaApp.MOOD_LABEL[e.mood] || e.mood) + '</div>'
      +   '<div class="lz-entry-card-body">' + esc(e.body) + '</div>'
      +   (e.tags && e.tags.length ? '<div class="lz-entry-card-tags">' + e.tags.map(function (t) { return '<span class="lz-mood-chip">#' + esc(t) + '</span>'; }).join('') + '</div>' : '')
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
          + '</div>'
          + '<p style="font-size:14.5px;line-height:1.65;white-space:pre-wrap;color:var(--lz-ink);">' + esc(e.body) + '</p>'
          + (e.tags && e.tags.length ? '<div class="lz-entry-card-tags" style="margin-top:10px;">' + e.tags.map(function (t) { return '<span class="lz-mood-chip">#' + esc(t) + '</span>'; }).join('') + '</div>' : '')
          + '<button class="lz-btn lz-btn--ghost lz-btn--sm" id="entry-del" style="margin-top:14px;color:var(--lz-coral);">Delete entry</button>',
        onMount: function (sheet, close) {
          sheet.querySelector('#entry-del').addEventListener('click', function () {
            if (!confirm('Delete this entry? It will not come back.')) return;
            LahzaApp.api('/entries/' + encodeURIComponent(e.id), { method: 'DELETE' }).then(function () {
              window.toast('Deleted', 'warn');
              close();
              refresh(document.getElementById('app'));
            });
          });
        }
      });
    });
  }
})();
