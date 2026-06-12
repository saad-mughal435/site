/* =========================================================
   EXPERIENCE - verbatim from home.app.jsx
   ========================================================= */
import { EXPERIENCE } from '../data';
import { Reveal, WordReveal } from './primitives';

export function Experience({ view }: { view: string }) {
  const items = EXPERIENCE.filter((e) => view === 'all' || e.domain === view || e.domain === 'all');
  return (
    <section id="experience" className="section container">
      <Reveal className="section-head">
        <span className="section-tag">Fig. 03 - Experience</span>
        <h2><WordReveal>A short career, but a wide one.</WordReveal></h2>
      </Reveal>
      <ol className="timeline">
        {items.map((e, i) => (
          <Reveal as="li" key={e.title + i} className="t-item">
            <div className="t-marker"></div>
            <div className="t-card">
              <div className="t-head">
                <h3>{e.title}</h3>
                <span className="t-when">{e.when}</span>
              </div>
              <div className="t-company">{e.company}</div>
              <ul className="t-points">{e.points.map((p, j) => <li key={j}>{p}</li>)}</ul>
            </div>
          </Reveal>
        ))}
      </ol>
    </section>
  );
}
