/* =========================================================
   FAQ - long-tail keyword capture + FAQPage rich result
   Verbatim from home.app.jsx (first item open by default).
   ========================================================= */
import { FAQ_ITEMS } from '../data';
import { Reveal } from './primitives';

export function FAQ() {
  return (
    <section id="faq" className="section container">
      <Reveal className="section-head">
        <span className="section-tag">Appendix - FAQ</span>
        <h2>About Muhammad Saad - engineering background, software delivery focus.</h2>
      </Reveal>
      <Reveal stagger className="faq-list">
        {FAQ_ITEMS.map((f, i) => (
          <details className="faq-item" key={i} open={i === 0}>
            <summary>{f.q}</summary>
            <div className="faq-answer">{f.a}</div>
          </details>
        ))}
      </Reveal>
    </section>
  );
}
