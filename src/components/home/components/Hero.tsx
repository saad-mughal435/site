/* =========================================================
   VIEW TOGGLE + HERO - verbatim behaviour from home.app.jsx
   ========================================================= */
import { useEffect, useRef, useState } from 'react';
import { HERO_COPY, VIEWS } from '../data';
import { MagneticBtn } from './primitives';

export interface ViewProps {
  view: string;
  setView: (v: string) => void;
}

export function ViewToggle({ view, setView }: ViewProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [indicator, setIndicator] = useState({ left: 4, width: 0 });
  const recompute = () => {
    if (!wrapRef.current) return;
    const btn = wrapRef.current.querySelector('.vt-pill.active') as HTMLElement | null;
    if (!btn) return;
    setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
  };
  useEffect(() => { recompute(); }, [view]);
  useEffect(() => {
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, []);
  return (
    <div className="view-toggle" ref={wrapRef} role="group" aria-label="Switch portfolio view">
      <div className="vt-indicator" style={{ left: indicator.left + 'px', width: indicator.width + 'px' }}></div>
      {VIEWS.map((v) => (
        <button
          key={v.key}
          className={'vt-pill' + (view === v.key ? ' active' : '')}
          onClick={() => setView(v.key)}
          aria-pressed={view === v.key}
        >{v.label}</button>
      ))}
    </div>
  );
}

export function Hero({ view, setView }: ViewProps) {
  const copy = HERO_COPY[view] || HERO_COPY.all;
  return (
    <section className="hero container" id="top">
      <div className="hero-left">
        <div className="eyebrow"><span className="led" aria-hidden="true"></span> Currently available in the UAE · Open to relocate worldwide</div>
        <div className="view-toggle-wrap">
          <span className="view-toggle-hint">Tailored for:</span>
          <ViewToggle view={view} setView={setView} />
        </div>
        <h1 className="hero-title view-fade" key={'t-' + view}>
          {copy.title.map((line, i) => (
            <span className="line" key={i}>
              <span>{i === copy.title.length - 1 ? <span className="grad">{line}</span> : line}</span>
            </span>
          ))}
        </h1>
        <p className="hero-sub view-fade" key={'s-' + view}>{copy.sub}</p>
        <div className="hero-cta">
          <MagneticBtn as="a" href="contact.html" className="btn btn-primary">Contact me <span className="arrow">→</span></MagneticBtn>
          <a className="btn btn-ghost view-fade" key={'c-' + view}
             href={copy.cta.href}
             {...(copy.cta.target ? { target: copy.cta.target, rel: 'noopener' } : {})}
          >{copy.cta.label}</a>
        </div>
        <div className="hero-tracks">
          <span className="meta-k">Two tracks</span>
          <span>Python/FastAPI ERP + backend systems · C++17 low-latency market data
            {' '}(<a href="https://github.com/saad-mughal435/hft-orderbook" target="_blank" rel="noopener">hft-orderbook</a>
            {' '}· <a href="hft-book/viewer.html" target="_blank" rel="noopener">L2 viewer ↗</a>)</span>
        </div>
        <div className="hero-meta">
          <div><span className="meta-k">Currently</span><span className="meta-v">Kingsley Beverage FZCO · Dubai</span></div>
          <div className="view-fade" key={'m-' + view}>
            <span className="meta-k">Stack</span><span className="meta-v">{copy.stack}</span>
          </div>
          <div><span className="meta-k">Open to</span><span className="meta-v">On-site · Hybrid · Remote</span></div>
        </div>
      </div>
      <div className="hero-right">
        <figure className="hero-photo">
          <img src="saad.webp" width="400" height="500" loading="eager" decoding="async" fetchPriority="high"
               alt="Muhammad Saad - Automation & Software Developer, Dubai" />
          <figcaption><span className="plate-no">Plate 01</span> M. Saad · Automation &amp; Software · Dubai, UAE</figcaption>
        </figure>
      </div>
    </section>
  );
}
