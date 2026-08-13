/* =========================================================
   DEMOS - product demos as a 3-column grid (after Projects)
   Verbatim from home.app.jsx.
   ========================================================= */
import { DEMO_PROJECTS, viewItems } from '../data';
import { Reveal, WordReveal } from './primitives';
import { ProjectCard } from './Projects';

const NUM_WORD = ['no', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight',
                  'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen'];
const word = (n: number) => NUM_WORD[n] ?? String(n);

/* Earlier-work cards are not browser demos, so they are counted separately.
   Both counts are derived rather than written out - the hardcoded "Ten" was
   wrong, and named PTCL/Omdena even in views where those cards were filtered
   out. */
const EARLIER_KINDS = ['Internal Tool', 'Open Collaboration'];

export function Demos({ view }: { view: string }) {
  const items = viewItems(DEMO_PROJECTS, view);
  if (!items.length) return null;
  const earlier = items.filter((p) => EARLIER_KINDS.includes(p.kind));
  const demos = items.filter((p) => !EARLIER_KINDS.includes(p.kind));
  return (
    <section id="demos" className="section container">
      <Reveal className="section-head">
        <span className="section-tag">Fig. 05 - Demos</span>
        <h2><WordReveal>Product demos built around real workflows.</WordReveal></h2>
        <p className="demos-sub">
          {word(demos.length)} browser-based product demo{demos.length === 1 ? '' : 's'} - B2B portals,
          marketplaces, booking, POS, AI copilots and operations consoles
          {earlier.length > 0 && <> - plus {word(earlier.length).toLowerCase()} earlier-work
            card{earlier.length === 1 ? '' : 's'} ({earlier.map((p) => p.title).join(', ')})</>}.
          {' '}Every value in them is fabricated; the workflows are not. Each opens as a full product you can
          click through. <a href="demo.html" target="_blank" rel="noopener">Full gallery ↗</a>
        </p>
      </Reveal>
      <Reveal stagger className="demos-grid">
        {items.map((p) => <ProjectCard key={p.title} p={p} compact />)}
      </Reveal>
    </section>
  );
}
