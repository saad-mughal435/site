/* =========================================================
   ABOUT - verbatim from home.app.jsx
   ========================================================= */
import { Reveal, WordReveal } from './primitives';

export function About() {
  return (
    <section id="about" className="section container">
      <Reveal className="section-head">
        <span className="section-tag">Fig. 01 - About</span>
        <h2><WordReveal>I sit between the factory floor and the keyboard.</WordReveal></h2>
      </Reveal>
      <div className="about-grid">
        <Reveal className="about-copy">
          <p>I&rsquo;m an <strong>Automation &amp; Software Developer</strong> at Kingsley Beverage FZCO in Dubai, where I&rsquo;m
            the sole developer of the MES/ERP platform running across the plant - and also work hands-on as
            <strong> Automation Engineer</strong> and <strong>IT Administrator</strong>. My engineering background
            (B.Sc. Electrical / Computer Engineering, COMSATS Islamabad) lets me run and support the Krones beverage
            lines and troubleshoot production issues, then build the software <em>around</em> that workflow - the
            machine automation is OEM-locked, so my work is the OEE reporting, QC records, inventory, and management
            dashboards that sit on top of it.</p>
          <p>Before Kingsley I spent two years as a <strong>NOC Engineer at PTCL</strong> on GPON / PSTN / broadband
            infrastructure, where I shipped a Python tool that auto-generated configuration scripts from tickets and
            removed hours of manual prep a day. The throughline: I look at slow, manual operational work and rebuild
            it in code - which is exactly the automation, backend, and ERP/MES work I want to keep doing.</p>
        </Reveal>
        <Reveal className="aside-card">
          <div className="aside-card-head">// quick facts</div>
          <dl>
            <dt>Location</dt><dd>UAE-based · Open to relocate worldwide</dd>
            <dt>Education</dt><dd>B.Sc. Electrical Engineering - Computer Engineering Major - COMSATS Islamabad (2024)</dd>
            <dt>Languages</dt><dd>English (IELTS) · Urdu</dd>
            <dt>Open to</dt><dd>On-site · Hybrid · Remote</dd>
            <dt>Status</dt><dd><span className="led" style={{ marginRight: 6 }}></span>Open to work</dd>
          </dl>
        </Reveal>
      </div>
    </section>
  );
}
