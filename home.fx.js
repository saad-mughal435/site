/* home.fx.js — the scroll/motion layer for saadm.dev.
 *
 * Deliberately decoupled from the React app (home.app.js): it only touches the
 * DOM after render and adds smooth scroll, scroll-driven parallax, a custom
 * cursor, magnetic buttons and 3D card tilt. Everything is feature-detected and
 * wrapped in try/catch, and the heavy bits are skipped under prefers-reduced-
 * motion / touch — so if a CDN lib fails to load or anything throws, the plain
 * (already-working) site is unaffected.
 *
 * Libraries (loaded via CDN in index.html): gsap + ScrollTrigger and
 * @studio-freight/lenis (smooth scroll). No WebGL — the backdrop is static CSS.
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
      // Parallax the hero (transform only — the React CSS reveal still owns
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

  /* ====================================================== Custom cursor */
  function initCursor() {
    var dot = document.createElement('div'); dot.id = 'fx-cursor-dot';
    var ring = document.createElement('div'); ring.id = 'fx-cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);
    document.body.classList.add('fx-cursor-on');

    var mxp = window.innerWidth / 2, myp = window.innerHeight / 2, rx = mxp, ry = myp;
    window.addEventListener('mousemove', function (e) {
      mxp = e.clientX; myp = e.clientY;
      dot.style.transform = 'translate(' + mxp + 'px,' + myp + 'px)';
    }, { passive: true });
    (function loop() {
      rx += (mxp - rx) * 0.18; ry += (myp - ry) * 0.18;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
      requestAnimationFrame(loop);
    })();

    var SEL = 'a, button, .btn, summary, .vt-pill, .project, .skill-chip, .tag';
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest && e.target.closest(SEL)) document.body.classList.add('fx-hover');
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest(SEL)) document.body.classList.remove('fx-hover');
    });
    window.addEventListener('mousedown', function () { document.body.classList.add('fx-down'); });
    window.addEventListener('mouseup', function () { document.body.classList.remove('fx-down'); });
  }

  /* ===================================================== Magnetic buttons */
  function initMagnetic() {
    var current = null;
    document.addEventListener('mousemove', function (e) {
      var btn = e.target.closest && e.target.closest('.btn');
      if (btn) {
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.3;
        var y = (e.clientY - r.top - r.height / 2) * 0.45;
        btn.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        if (current && current !== btn) current.style.transform = '';
        current = btn;
      } else if (current) {
        current.style.transform = '';
        current = null;
      }
    }, { passive: true });
  }

  /* ======================================================= 3D tilt cards */
  function initTilt() {
    var SEL = '.project, .skill-card';
    var current = null;
    function reset(el) { el.style.transform = ''; el.classList.remove('fx-tilting'); }
    document.addEventListener('mousemove', function (e) {
      var card = e.target.closest && e.target.closest(SEL);
      if (card) {
        if (current && current !== card) reset(current);
        current = card;
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.classList.add('fx-tilting');
        card.style.transform = 'perspective(900px) rotateX(' + (-py * 7).toFixed(2) +
          'deg) rotateY(' + (px * 9).toFixed(2) + 'deg) translateY(-4px)';
      } else if (current) {
        reset(current);
        current = null;
      }
    }, { passive: true });
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
    try { if (!REDUCE && FINE) initCursor(); } catch (e) {}
    try { if (FINE) initMagnetic(); } catch (e) {}
    try { if (!REDUCE && FINE && BIG) initTilt(); } catch (e) {}
    whenContent(function () { try { initMotion(); } catch (e) {} });
    document.documentElement.classList.add('fx-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
