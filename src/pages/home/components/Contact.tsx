/* =========================================================
   CONTACT - verbatim from home.app.jsx
   ========================================================= */
import { AVAILABILITY } from '../data';
import { MagneticBtn, Reveal } from './primitives';

export function Contact() {
  return (
    <section id="contact" className="section container">
      <Reveal className="contact-box">
        <div className="contact-left">
          <span className="section-tag">Fig. 07 - Contact</span>
          <h2>Let&rsquo;s build something that ships.</h2>
          <p>I build backend and operations software - ERP/MES platforms, APIs, and the tooling
            around them. If that fits a role you&rsquo;re working on, in the UAE or remote, I&rsquo;d be glad to talk.</p>
          <MagneticBtn as="a" href="contact.html" className="btn btn-primary">
            Open contact form <span className="arrow">→</span>
          </MagneticBtn>
        </div>
        <ul className="contact-list">
          <li><span className="contact-k">Email</span><a className="contact-v" href="mailto:saad@saadm.dev">saad@saadm.dev</a></li>
          <li><span className="contact-k">Phone</span><a className="contact-v" href="tel:+971502578065">+971 50 257 8065</a></li>
          <li><span className="contact-k">WhatsApp</span><a className="contact-v" href="https://wa.me/971502578065" target="_blank" rel="noopener">+971 50 257 8065</a></li>
          <li><span className="contact-k">LinkedIn</span><a className="contact-v" href="https://www.linkedin.com/in/muhammadsaad435/" target="_blank" rel="noopener">/in/muhammadsaad435</a></li>
          <li><span className="contact-k">Based in</span><span className="contact-v">{AVAILABILITY}</span></li>
        </ul>
      </Reveal>
    </section>
  );
}
