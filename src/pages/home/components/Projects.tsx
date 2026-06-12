/* =========================================================
   PROJECTS - ProjectCard + Projects, verbatim from home.app.jsx
   ========================================================= */
import { Fragment } from 'react';
import { PROJECTS } from '../data';
import type { Project } from '../data';
import { Reveal, TiltCard, WordReveal } from './primitives';

export function ProjectCard({ p, compact }: { p: Project; compact?: boolean }) {
  // compact = slider card: summary + tags + links (the bullet detail lives on
  // each demo's own page), so the row of demos stays scannable.
  return (
    <TiltCard tag="article" intensity={compact ? 4 : 5}
      className={'project' + (p.featured ? ' featured' : '') + (compact ? ' demo-slide' : '')}>
      <div className="project-meta">
        <span className="project-kind">{p.kind}</span>
        <span className="project-year">{p.year}</span>
      </div>
      <h3 className="project-title">{p.title}</h3>
      <p className="project-desc">{p.desc}</p>
      {!compact && <ul className="project-bullets">{p.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
      <div className="project-tags">{p.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
      {p.ctas && (
        <div className="project-cta">
          {p.ctas.map((c) => (
            <a key={c.label} href={c.href}
               className={'btn ' + (c.primary ? 'btn-primary' : 'btn-ghost') + (c.prominent ? ' btn-prominent' : '')}
               {...(c.target ? { target: c.target, rel: 'noopener' } : {})}>{c.label}</a>
          ))}
          {!compact && p.ctaSubtitle && <div className="cta-subtitle">{p.ctaSubtitle}</div>}
          {!compact && p.ctaTip && <div className="cta-tip">{p.ctaTip}</div>}
        </div>
      )}
    </TiltCard>
  );
}

export function Projects({ view }: { view: string }) {
  const items = PROJECTS.filter((p) => view === 'all' || p.domain === view || p.domain === 'all');
  return (
    <section id="projects" className="section container">
      <Reveal className="section-head">
        <span className="section-tag">Fig. 04 - Selected Work</span>
        <h2><WordReveal>Production software, backends and open source.</WordReveal></h2>
      </Reveal>
      <Reveal stagger className="projects-grid">
        {items.map((p) => (
          <Fragment key={p.title}>
            {p.sectionHeading && (
              <div className="project-section-heading">
                <span className="section-tag">{p.sectionEyebrow}</span>
                <h3>{p.sectionHeading}</h3>
                {p.sectionBlurb && <p>{p.sectionBlurb}</p>}
              </div>
            )}
            <ProjectCard p={p} />
          </Fragment>
        ))}
      </Reveal>
    </section>
  );
}
