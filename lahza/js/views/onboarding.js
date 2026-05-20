/* onboarding.js — 3-card swipe onboarding shown on first visit. Gated by
 * lahza.settings.onboarded localStorage flag (router.js handles the gate). */
(function () {
  'use strict';
  window.LahzaViews = window.LahzaViews || {};

  var CARDS = [
    {
      icon: '🌙',
      title: 'A moment a day.',
      body: 'Lahza is a tiny journaling habit. One AI-suggested prompt, a few sentences, and the patterns surface across the week.'
    },
    {
      icon: '✦',
      title: 'Claude reads the patterns.',
      body: 'After a few entries, your AI Coach can answer questions like "Why was Tuesday hard?" — grounded in your own writing, with citations.'
    },
    {
      icon: '🔒',
      title: 'Your entries stay in your browser.',
      body: 'Nothing is uploaded by default. localStorage only. You decide when (and whether) to ask Claude anything.'
    }
  ];

  window.LahzaViews.onboarding = function (done) {
    var i = 0;
    var app = document.getElementById('app');
    if (!app) return;
    var tabbar = document.getElementById('tabbar');
    var fab = document.getElementById('fab');
    if (tabbar) tabbar.style.display = 'none';
    if (fab) fab.style.display = 'none';

    function render() {
      var c = CARDS[i];
      var lastCard = i === CARDS.length - 1;
      app.innerHTML =
          '<div class="lz-onboard">'
        +   '<div class="lz-onboard-dots">'
        +     CARDS.map(function (_, k) { return '<span class="lz-onboard-dot' + (k === i ? ' active' : '') + '"></span>'; }).join('')
        +   '</div>'
        +   '<div class="lz-onboard-icon">' + c.icon + '</div>'
        +   '<h2 class="lz-onboard-title">' + LahzaApp.escapeHtml(c.title) + '</h2>'
        +   '<p class="lz-onboard-body">' + LahzaApp.escapeHtml(c.body) + '</p>'
        +   '<div class="lz-onboard-cta">'
        +     (i > 0 ? '<button class="lz-btn lz-btn--ghost" id="ob-back">← Back</button>' : '')
        +     '<button class="lz-btn lz-btn--primary lz-btn--lg lz-btn--block" id="ob-next">'
        +       (lastCard ? 'Get started' : 'Next →')
        +     '</button>'
        +     (!lastCard ? '<button class="lz-btn lz-btn--ghost lz-btn--sm" id="ob-skip" style="margin-top:4px;">Skip intro</button>' : '')
        +   '</div>'
        + '</div>';
      var next = document.getElementById('ob-next');
      var back = document.getElementById('ob-back');
      var skip = document.getElementById('ob-skip');
      if (next) next.addEventListener('click', function () {
        if (lastCard) finish();
        else { i++; render(); }
      });
      if (back) back.addEventListener('click', function () { i--; render(); });
      if (skip) skip.addEventListener('click', finish);
    }
    function finish() {
      if (tabbar) tabbar.style.display = '';
      if (fab) fab.style.display = '';
      done && done();
    }
    render();
  };
})();
