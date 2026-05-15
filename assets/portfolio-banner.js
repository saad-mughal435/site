/* portfolio-banner.js — injects a small "Portfolio demo · fabricated data" strip
   at the very top of every sub-demo page. Loaded by each sub-site's app.js so
   the marker appears consistently across b2c/, b2b/, property/, vacation/.
   Dismissible; preference stored in localStorage so the banner doesn't keep
   reappearing across page navigations.

   Also injects its own CSS link relative to the requesting page — saves having
   to add a <link> tag to every sub-demo HTML file. */
(function () {
  'use strict';

  function loadCss() {
    if (document.getElementById('portfolio-demo-banner-css')) return;
    var l = document.createElement('link');
    l.id = 'portfolio-demo-banner-css';
    l.rel = 'stylesheet';
    // Match the location of the loading script — same /assets/ folder.
    l.href = '/assets/portfolio-banner.css?v=20260514';
    document.head.appendChild(l);
  }

  function inject() {
    loadCss();
    if (localStorage.getItem('portfolioBannerDismissed') === '1') return;
    if (document.getElementById('portfolio-demo-banner')) return;
    var bar = document.createElement('div');
    bar.id = 'portfolio-demo-banner';
    bar.className = 'portfolio-demo-banner';
    bar.innerHTML = ''
      + '<div class="pdb-inner">'
      +   '<span class="pdb-pill">Portfolio demo</span>'
      +   '<span class="pdb-text">Fabricated data · built by <strong>Muhammad Saad</strong></span>'
      +   '<a class="pdb-back" href="https://saadm.dev/">← back to saadm.dev</a>'
      +   '<button class="pdb-close" aria-label="Dismiss banner">×</button>'
      + '</div>';
    document.body.insertBefore(bar, document.body.firstChild);
    bar.querySelector('.pdb-close').addEventListener('click', function () {
      bar.remove();
      try { localStorage.setItem('portfolioBannerDismissed', '1'); } catch (e) { /* private mode */ }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
  else inject();
})();
