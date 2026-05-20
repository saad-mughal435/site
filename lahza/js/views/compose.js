/* compose.js — Full-screen writing modal. AI prompt suggestions, mood
 * picker, tag chips, save. After save, AI mood-detect fires async so the
 * entry card immediately gets a mood dot. */
(function () {
  'use strict';
  window.LahzaViews = window.LahzaViews || {};
  var esc = function (s) { return LahzaApp.escapeHtml(s); };

  var MOOD_OPTIONS = [
    { id: 'joyful',    icon: '😊', label: 'Joyful' },
    { id: 'calm',      icon: '🌿', label: 'Calm' },
    { id: 'energized', icon: '⚡', label: 'Energy' },
    { id: 'tense',     icon: '😣', label: 'Tense' },
    { id: 'low',       icon: '🌧', label: 'Low' }
  ];

  var TAG_QUICK = ['work', 'gym', 'family', 'sleep', 'food', 'rest', 'focus', 'travel'];

  window.LahzaViews.compose = function (app) {
    var selectedMood = null;
    var selectedTags = new Set();
    var currentPrompt = '';
    var promptHistory = [];

    // Hide tab bar + FAB while composing
    var tabbar = document.getElementById('tabbar');
    var fab = document.getElementById('fab');
    if (tabbar) tabbar.style.display = 'none';
    if (fab) fab.style.display = 'none';

    var moodOptionsHtml = MOOD_OPTIONS.map(function (o) {
      return '<button class="lz-mood-option" data-mood="' + o.id + '">'
        + '<div class="lz-mood-option-icon">' + o.icon + '</div>'
        + '<div class="lz-mood-option-label">' + o.label + '</div>'
        + '</button>';
    }).join('');
    var tagChipsHtml = TAG_QUICK.map(function (t) {
      return '<span class="lz-prompt-chip" data-tag="' + t + '">#' + t + '</span>';
    }).join('');

    app.innerHTML =
        '<div class="lz-compose">'
      +   '<div class="lz-compose-head">'
      +     '<button class="lz-topbar-action" id="cmp-close" aria-label="Close">×</button>'
      +     '<div style="flex:1;text-align:center;font-weight:700;">New entry</div>'
      +     '<button class="lz-topbar-action" id="cmp-save" style="color:var(--lz-coral);font-weight:700;">Save</button>'
      +   '</div>'
      +   '<div class="lz-compose-body">'
      +     '<div class="lz-ai-panel">'
      +       '<div class="lz-ai-panel-head"><span class="lz-ai-loading"></span> ✦ AI prompt</div>'
      +       '<div class="lz-ai-panel-body" id="cmp-prompt">Loading…</div>'
      +       '<div style="margin-top:8px;display:flex;gap:6px;">'
      +         '<button class="lz-btn lz-btn--sm" id="cmp-prompt-cycle">Try another</button>'
      +       '</div>'
      +     '</div>'
      +     '<div class="lz-field">'
      +       '<div class="lz-field-label">Your entry</div>'
      +       '<textarea class="lz-textarea" id="cmp-body" placeholder="A few sentences are enough…" rows="6" autofocus></textarea>'
      +     '</div>'
      +     '<div class="lz-field">'
      +       '<div class="lz-field-label">Mood</div>'
      +       '<div class="lz-mood-picker">' + moodOptionsHtml + '</div>'
      +     '</div>'
      +     '<div class="lz-field">'
      +       '<div class="lz-field-label">Tags</div>'
      +       '<div id="cmp-tags">' + tagChipsHtml + '</div>'
      +     '</div>'
      +     '<p style="font-size:11.5px;color:var(--lz-muted);margin-top:14px;">Stays in your browser. If you skip the mood, Claude will guess one from the text after you save.</p>'
      +   '</div>'
      + '</div>';

    // Wire close
    document.getElementById('cmp-close').addEventListener('click', backOut);

    // Wire prompt cycle
    document.getElementById('cmp-prompt-cycle').addEventListener('click', loadPrompt);
    loadPrompt();

    // Wire mood picker
    app.querySelectorAll('[data-mood]').forEach(function (b) {
      b.addEventListener('click', function () {
        selectedMood = b.getAttribute('data-mood');
        app.querySelectorAll('[data-mood]').forEach(function (x) { x.classList.toggle('active', x === b); });
      });
    });

    // Wire tags
    app.querySelectorAll('[data-tag]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-tag');
        if (selectedTags.has(t)) selectedTags.delete(t);
        else selectedTags.add(t);
        b.style.background = selectedTags.has(t) ? 'rgba(255,107,107,0.18)' : '';
        b.style.borderColor = selectedTags.has(t) ? 'var(--lz-coral)' : '';
        b.style.color = selectedTags.has(t) ? 'var(--lz-coral)' : '';
      });
    });

    // Wire save
    document.getElementById('cmp-save').addEventListener('click', save);

    function loadPrompt() {
      var p = document.getElementById('cmp-prompt');
      p.innerHTML = '<span class="lz-ai-loading"></span> <span style="color:var(--lz-muted);">Generating…</span>';
      var hr = new Date().getHours();
      LahzaAI.suggestPrompt({ hour: hr }).then(function (r) {
        // Cycle: don't repeat the previous prompt
        if (promptHistory.indexOf(r.text) !== -1 && promptHistory.length < 6) {
          return loadPrompt();
        }
        currentPrompt = r.text;
        promptHistory.push(r.text);
        p.innerHTML = esc(r.text);
      }).catch(function () {
        currentPrompt = 'What surprised you today?';
        p.innerHTML = esc(currentPrompt);
      });
    }

    function save() {
      var bodyEl = document.getElementById('cmp-body');
      var bodyText = (bodyEl.value || '').trim();
      if (!bodyText) { window.toast('Write a sentence first', 'warn'); bodyEl.focus(); return; }

      var entry = {
        body: bodyText,
        mood: selectedMood || 'neutral',
        tags: Array.from(selectedTags),
        prompt: currentPrompt
      };

      var saveBtn = document.getElementById('cmp-save');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving…';

      LahzaApp.api('/entries', { method: 'POST', body: entry }).then(function (r) {
        if (!r.body.ok) { window.toast('Could not save', 'error'); saveBtn.disabled = false; saveBtn.textContent = 'Save'; return; }
        var saved = r.body.entry;
        window.toast(selectedMood ? 'Saved' : 'Saved · Claude is reading the mood…', 'success');

        // If user didn't pick a mood, ask AI to detect
        if (!selectedMood) {
          LahzaAI.detectMood({ entry_text: bodyText }).then(function (m) {
            var mood = m.mood || 'neutral';
            return LahzaApp.api('/entries/' + encodeURIComponent(saved.id), {
              method: 'PUT',
              body: { mood: mood, emotions: m.emotions || [] }
            });
          }).finally(function () { backOut(true); });
        } else {
          backOut(true);
        }
      });
    }

    function backOut(restoreNav) {
      if (tabbar) tabbar.style.display = '';
      if (fab) fab.style.display = '';
      window.location.hash = 'today';
    }
  };
})();
