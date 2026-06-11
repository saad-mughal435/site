/* home.fx.js - the scroll/motion layer for saadm.dev.
 *
 * Deliberately decoupled from the React app (home.app.js): it only touches the
 * DOM after render and adds smooth scroll and a subtle scroll-driven parallax.
 * (The earlier custom cursor / magnetic buttons / 3D tilt were removed - the
 * site is content-first.) Everything is feature-detected and wrapped in
 * try/catch, and skipped under prefers-reduced-motion - so if a CDN lib fails
 * to load or anything throws, the plain (already-working) site is unaffected.
 *
 * Libraries (gsap + ScrollTrigger and @studio-freight/lenis): this file
 * injects them itself, and only on capable desktops (pointer: fine, width
 * >= 1024px, no reduced-motion) - phones and touch devices never download
 * them. Pages that still carry static <script> tags keep working: the loader
 * is a no-op when window.gsap is already present. No WebGL - the backdrop is
 * static CSS.
 */
(function () {
  'use strict';

  var REDUCE = false;
  try { REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var FINE = true;
  try { FINE = window.matchMedia('(pointer: fine)').matches; } catch (e) {}
  // The custom cursor / 3D tilt are reserved for capable desktops; touch, small
  // screens and reduced-motion get the plain (already-working) page.
  var BIG = true;
  try { BIG = window.matchMedia('(min-width: 1024px)').matches; } catch (e) {}

  /* ============================================== On-demand CDN motion libs */
  // Injected here instead of <script> tags in every page head so phones and
  // reduced-motion users never pay for them. cb ALWAYS fires - initMotion
  // already degrades gracefully when a lib is missing or a CDN fetch fails.
  var FX_LIBS = [
    'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
    'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js',
    'https://cdn.jsdelivr.net/npm/@studio-freight/lenis@1.0.42/dist/lenis.min.js'
  ];
  function ensureLibs(cb) {
    if (window.gsap && window.ScrollTrigger && window.Lenis) { cb(); return; }
    if (REDUCE || !FINE || !BIG) { cb(); return; }
    var left = FX_LIBS.length;
    function done() { left--; if (left === 0) cb(); }
    for (var i = 0; i < FX_LIBS.length; i++) {
      var s = document.createElement('script');
      s.src = FX_LIBS[i];
      s.async = false; /* preserve gsap -> ScrollTrigger execution order */
      s.crossOrigin = 'anonymous';
      s.onload = done;
      s.onerror = done; /* never block boot on a failed fetch */
      document.head.appendChild(s);
    }
  }

  /* =================================================== Smooth scroll + GSAP */
  function initMotion() {
    var gsap = window.gsap;
    var ST = window.ScrollTrigger;
    var lenis = null;

    if (!REDUCE && window.Lenis) {
      lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1.0 });
      window.__lenis = lenis;
      if (gsap && ST) {
        lenis.on('scroll', ST.update);
        gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
        gsap.ticker.lagSmoothing(0);
      } else {
        var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
        requestAnimationFrame(raf);
      }
      // Anchor links should use Lenis so smooth scroll is consistent.
      document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href^="#"]');
        if (!a) return;
        var id = a.getAttribute('href');
        if (id && id.length > 1) {
          var el = document.querySelector(id);
          if (el) { e.preventDefault(); lenis.scrollTo(el, { offset: -70 }); }
        }
      });
    }

    if (gsap && ST && !REDUCE) {
      gsap.registerPlugin(ST);
      // Parallax the hero (transform only - the React CSS reveal still owns
      // opacity, so these never fight). The hero is a stable, non-reveal node.
      if (document.querySelector('.hero-photo')) {
        gsap.to('.hero-photo', {
          yPercent: -16, ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        });
      }
      if (document.querySelector('.hero-left')) {
        gsap.to('.hero-left', {
          yPercent: 9, ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        });
      }
      // Subtle depth parallax on each section's eyebrow tag as it scrolls past.
      gsap.utils.toArray('.section .section-tag').forEach(function (el) {
        gsap.fromTo(el, { y: 26 }, {
          y: -26, ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });
      // Keep triggers correct as the React app re-renders on view toggle.
      var ro = new MutationObserver(function () { ST.refresh(); });
      var root = document.getElementById('root');
      if (root) ro.observe(root, { childList: true, subtree: true });
    }
  }

  /* ================================================================ boot */
  // React 18 may flush its first render a tick after home.app.js runs, so wait
  // for the hero to exist before wiring GSAP triggers to real DOM nodes.
  function whenContent(cb) {
    var tries = 0;
    (function check() {
      if (document.querySelector('.hero') || tries > 120) { cb(); return; }
      tries++;
      requestAnimationFrame(check);
    })();
  }

  function boot() {
    ensureLibs(function () {
      whenContent(function () { try { initMotion(); } catch (e) {} });
    });
    document.documentElement.classList.add('fx-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
