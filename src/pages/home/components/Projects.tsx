/* =========================================================
   PROJECTS - ProjectCard + Projects, verbatim from home.app.jsx
   ========================================================= */
import { Fragment, useState } from 'react';
import { PROJECTS, viewItems } from '../data';
import type { Project } from '../data';
import { Reveal, TiltCard, WordReveal } from './primitives';

export function ProjectCard({ p, compact, beyondCap }: { p: Project; compact?: boolean; beyondCap?: boolean }) {
  // compact = slider card: summary + tags + links (the bullet detail lives on
  // each demo's own page), so the row of demos stays scannable.
  // beyondCap = past the mobile fold limit; hidden on phones until "show all".
  return (
    <TiltCard tag="article" intensity={compact ? 4 : 5}
      className={'project' + (p.featured ? ' featured' : '') + (compact ? ' demo-slide' : '') + (beyondCap ? ' beyond-cap' : '')}>
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

/* On a phone this section ran to twelve full cards. Show the first few and let
   the reader ask for the rest, rather than making everyone scroll past all of
   them. Desktop is unaffected - the cap is applied only inside the mobile media
   query, and `show-all` lifts it. */
const MOBILE_CAP = 6;

export function Projects({ view }: { view: string }) {
  const items = viewItems(PROJECTS, view);
  const [showAll, setShowAll] = useState(false);
  const hidden = Math.max(0, items.length - MOBILE_CAP);
  return (
    <section id="projects" className="section container">
      <Reveal className="section-head">
        <span className="section-tag">Fig. 04 - Selected Work</span>
        <h2><WordReveal>Production software, backends and open source.</WordReveal></h2>
      </Reveal>
      <Reveal stagger className={'projects-grid' + (showAll ? ' show-all' : '')}>
        {items.map((p, i) => {
          // The heading has to carry the same flag as its card, or hiding the
          // card past the cap would leave its section heading orphaned.
          const beyond = i >= MOBILE_CAP;
          return (
            <Fragment key={p.title}>
              {p.sectionHeading && (
                <div className={'project-section-heading' + (beyond ? ' beyond-cap' : '')}>
                  <span className="section-tag">{p.sectionEyebrow}</span>
                  <h3>{p.sectionHeading}</h3>
                  {p.sectionBlurb && <p>{p.sectionBlurb}</p>}
                </div>
              )}
              <ProjectCard p={p} beyondCap={beyond} />
            </Fragment>
          );
        })}
      </Reveal>
      {hidden > 0 && !showAll && (
        <div className="projects-more">
          <button type="button" className="btn btn-ghost" onClick={() => setShowAll(true)}>
            Show {hidden} more {hidden === 1 ? 'project' : 'projects'}
          </button>
        </div>
      )}
    </section>
  );
}
