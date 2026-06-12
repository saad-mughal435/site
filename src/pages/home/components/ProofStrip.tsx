/* =========================================================
   PROOF - verbatim from home.app.jsx
   ========================================================= */
import { PROOF_ITEMS, PROOF_QUOTES } from '../data';
import { Reveal, WordReveal } from './primitives';

export function ProofStrip() {
  return (
    <section id="proof" className="section container">
      <Reveal className="section-head">
        <span className="section-tag">Fig. 02 - Proof</span>
        <h2><WordReveal>Verifiable, not just claimed.</WordReveal></h2>
      </Reveal>
      <Reveal stagger className="proof-grid">
        {PROOF_ITEMS.map((item) => (
          <div className="proof-card" key={item.k}>
            <span className="meta-k">{item.k}</span>
            <p>{item.v}</p>
            <a href={item.link.href}
               {...(item.link.target ? { target: item.link.target, rel: 'noopener' } : {})}
            >{item.link.label}</a>
          </div>
        ))}
      </Reveal>
      {PROOF_QUOTES.length > 0 && (
        <Reveal stagger className="proof-quotes">
          {PROOF_QUOTES.map((q) => (
            <figure className="proof-quote" key={q.name}>
              <blockquote>{q.text}</blockquote>
              <figcaption>{q.name} · {q.role}</figcaption>
            </figure>
          ))}
        </Reveal>
      )}
    </section>
  );
}
