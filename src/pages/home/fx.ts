/* =========================================================
   fx.ts - the scroll/motion layer for the homepage SHELL page.
   TypeScript port of root home.fx.js (which stays at the root
   FOREVER for the demo pages that load it as a plain script).

   Deliberately decoupled from the React app: it only touches the
   DOM after render and adds smooth scroll and a subtle
   scroll-driven parallax. Everything is feature-detected and
   wrapped in try/catch, and skipped under prefers-reduced-motion.
   gsap + ScrollTrigger and lenis are dynamic imports, loaded only
   on capable desktops (pointer: fine, width >= 1024px, no
   reduced-motion) - phones and touch devices never download them.
   ========================================================= */

/* eslint-disable @typescript-eslint/no-explicit-any */

function initMotion(gsap: any, ScrollTrigger: any, Lenis: any, reduce: boolean): void {
  let lenis: any = null;

  if (!reduce && Lenis) {
    lenis = new Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1.0 });
    (window as any).__lenis = lenis;
    if (gsap && ScrollTrigger) {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time: number) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      const raf = function (t: number) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
    // Anchor links should use Lenis so smooth scroll is consistent.
    document.addEventListener('click', function (e) {
      const target = e.target as Element | null;
      const a = target && target.closest && target.closest('a[href^="#"]');
      if (!a) return;
      const id = a.getAttribute('href');
      if (id && id.length > 1) {
        const el = document.querySelector(id);
        if (el) { e.preventDefault(); lenis.scrollTo(el, { offset: -70 }); }
      }
    });
  }

  if (gsap && ScrollTrigger && !reduce) {
    gsap.registerPlugin(ScrollTrigger);
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
    gsap.utils.toArray('.section .section-tag').forEach(function (el: any) {
      gsap.fromTo(el, { y: 26 }, {
        y: -26, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });
    // Keep triggers correct as the React app re-renders on view toggle.
    const ro = new MutationObserver(function () { ScrollTrigger.refresh(); });
    const root = document.getElementById('root');
    if (root) ro.observe(root, { childList: true, subtree: true });
  }
}

// React 19 may flush its first render a tick after main.tsx runs, so wait
// for the hero to exist before wiring GSAP triggers to real DOM nodes.
function whenContent(cb: () => void): void {
  let tries = 0;
  (function check() {
    if (document.querySelector('.hero') || tries > 120) { cb(); return; }
    tries++;
    requestAnimationFrame(check);
  })();
}

export function initFx(): void {
  let REDUCE = false;
  try { REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  let FINE = true;
  try { FINE = window.matchMedia('(pointer: fine)').matches; } catch (e) {}
  // The motion layer is reserved for capable desktops; touch, small screens
  // and reduced-motion get the plain (already-working) page.
  let BIG = true;
  try { BIG = window.matchMedia('(min-width: 1024px)').matches; } catch (e) {}

  document.documentElement.classList.add('fx-ready');

  // Phones, touch devices and reduced-motion users never download the libs.
  if (REDUCE || !FINE || !BIG) return;

  Promise.all([
    import('gsap'),
    import('gsap/ScrollTrigger'),
    import('lenis'),
  ]).then(function ([gsapMod, stMod, lenisMod]) {
    const gsap = gsapMod.gsap;
    const ScrollTrigger = stMod.ScrollTrigger;
    const Lenis = lenisMod.default;
    whenContent(function () { try { initMotion(gsap, ScrollTrigger, Lenis, REDUCE); } catch (e) {} });
  }).catch(function () { /* never block boot on a failed chunk fetch */ });
}
