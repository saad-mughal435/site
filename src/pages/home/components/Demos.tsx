/* =========================================================
   DEMOS - product demos as a 3-column grid (after Projects)
   Verbatim from home.app.jsx.
   ========================================================= */
import { DEMO_PROJECTS } from '../data';
import { Reveal, WordReveal } from './primitives';
import { ProjectCard } from './Projects';

export function Demos({ view }: { view: string }) {
  const items = DEMO_PROJECTS.filter((p) => view === 'all' || p.domain === view || p.domain === 'all');
  if (!items.length) return null;
  return (
    <section id="demos" className="section container">
      <Reveal className="section-head">
        <span className="section-tag">Fig. 05 - Demos</span>
        <h2><WordReveal>Product demos built around real workflows.</WordReveal></h2>
        <p className="demos-sub">Ten browser-based product demos - B2B portals, marketplaces, booking, POS, AI copilots and operations consoles - plus two earlier-work cards (PTCL tooling, Omdena). Each demo opens as a full product you can click through. <a href="demo.html" target="_blank" rel="noopener">Full gallery ↗</a></p>
      </Reveal>
      <Reveal stagger className="demos-grid">
        {items.map((p) => <ProjectCard key={p.title} p={p} compact />)}
      </Reveal>
    </section>
  );
}
