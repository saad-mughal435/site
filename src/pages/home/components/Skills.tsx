/* =========================================================
   SKILLS - SkillCard + Skills, verbatim from home.app.jsx
   ========================================================= */
import { useRef } from 'react';
import { SKILLS } from '../data';
import type { SkillGroup } from '../data';
import { useInView } from '../hooks';
import { Reveal, WordReveal } from './primitives';

function SkillCard({ s }: { s: SkillGroup }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const inView = useInView(ref);
  return (
    <div ref={ref} className={'skill-card' + (inView ? ' inView' : '')}>
      <h3>{s.title}</h3>
      <div className="skill-chips">
        {s.items.map((name) => (
          <span className="skill-chip" key={name}>{name}</span>
        ))}
      </div>
    </div>
  );
}

export function Skills({ view }: { view: string }) {
  const items = SKILLS.filter((s) => view === 'all' || s.domain === view || s.domain === 'all');
  return (
    <section id="skills" className="section container">
      <Reveal className="section-head">
        <span className="section-tag">Fig. 06 - Skills</span>
        <h2><WordReveal>Skills I use to build and run operations software.</WordReveal></h2>
      </Reveal>
      <Reveal stagger className="skills-grid">
        {items.map((s) => <SkillCard key={s.title} s={s} />)}
      </Reveal>
    </section>
  );
}
