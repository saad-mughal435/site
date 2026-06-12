/* =========================================================
   HOOKS - verbatim behaviour from the retired home.app.jsx
   ========================================================= */
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';

export function useInView(ref: RefObject<Element | null>, opts: IntersectionObserverInit = {}): boolean {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No IntersectionObserver (very old browser) -> just show the content.
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    // threshold 0 fires as soon as the element enters the viewport, so it works
    // for any height. (A 0.12 threshold can never be met by a container taller
    // than ~8x the viewport - e.g. the single-column projects grid on mobile -
    // which would leave its cards stuck at opacity:0.)
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); io.disconnect(); } },
      { threshold: 0, rootMargin: '0px 0px -60px 0px', ...opts }
    );
    io.observe(el);
    // Failsafe: never leave content permanently hidden if the observer never fires.
    const t = setTimeout(() => setInView(true), 1800);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);
  return inView;
}

export function useScrollPos(): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return scrolled;
}

export function useScrollProgress(): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? (h.scrollTop / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return p;
}
