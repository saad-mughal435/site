/* =========================================================
   Back-to-top button
   TypeScript port of the inline <script> block that used to sit
   next to the #back-to-top button on every shell page.
   ========================================================= */

(function () {
  const el = document.getElementById('back-to-top');
  if (!el) return;
  const btn = el;
  const threshold = 280;
  let ticking = false;
  function scrollY() {
    return window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }
  function update() {
    btn.classList.toggle('visible', scrollY() > threshold);
    ticking = false;
  }
  function onScroll() {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  btn.addEventListener('click', function () {
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } else if (window.scrollTo) {
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); }
      catch (e) { window.scrollTo(0, 0); }
    }
    btn.blur();
  });
  update();
})();
