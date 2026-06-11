/* ============================================================================
   home.app.jsx  -  SOURCE OF TRUTH for the saadm.dev homepage React app.
   The browser loads the compiled home.app.js; there is NO runtime Babel.
   After editing this file, regenerate the shipped JS and commit BOTH:
       npm run build:home
       (= babel home.app.jsx --presets @babel/preset-react -o home.app.js)
   React / ReactDOM are CDN globals (index.html), so this uses the classic
   JSX runtime (React.createElement) - do NOT add ES module imports.
   ============================================================================ */

const { useState, useEffect, useRef, useMemo, useCallback, Fragment } = React;
const { createRoot } = ReactDOM;

/* =========================================================
   SINGLE-SOURCE FACTS  -  defined once, referenced everywhere
   ========================================================= */
const KINGSLEY = { departments: 5, reportingSpeedup: 60 };
const AVAILABILITY = 'UAE-based, open to relocate worldwide, and happy with on-site, hybrid, or remote work';

/* =========================================================
   HOOKS
   ========================================================= */
function useInView(ref, opts = {}) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No IntersectionObserver (very old browser) -> just show the content.
    if (typeof IntersectionObserver === 'undefined') { setInView(true); return; }
    // threshold 0 fires as soon as the element enters the viewport, so it works
    // for any height. (A 0.12 threshold can never be met by a container taller
    // than ~8x the viewport - e.g. the single-column projects grid on mobile -
    // which would leave its cards stuck at opacity:0.)
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); io.disconnect(); } },
      { threshold: 0, rootMargin: '0px 0px -60px 0px', ...opts }
    );
    io.observe(el);
    // Failsafe: never leave content permanently hidden if the observer never fires.
    const t = setTimeout(() => setInView(true), 1800);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);
  return inView;
}

function useScrollPos() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return scrolled;
}

function useScrollProgress() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setP(max > 0 ? (h.scrollTop / max) * 100 : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return p;
}

/* =========================================================
   PRIMITIVES
   ========================================================= */
function Reveal({ children, className = '', stagger = false, as: Tag = 'div', ...rest }) {
  const ref = useRef(null);
  const inView = useInView(ref);
  return (
    <Tag
      ref={ref}
      className={(stagger ? 'stagger ' : 'reveal ') + (inView ? 'inView ' : '') + className}
      {...rest}
    >
      {children}
    </Tag>
  );
}

function ScrollProgress() {
  const p = useScrollProgress();
  return <div className="scroll-progress" aria-hidden="true" style={{ transform: `scaleX(${p / 100})` }} />;
}

function WordReveal({ children, className = '', as: Tag = 'span' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { threshold: 0.2 });
  const text = typeof children === 'string' ? children : '';
  if (!text) return <Tag className={className} ref={ref}>{children}</Tag>;
  const words = text.split(' ');
  return (
    <Tag ref={ref} className={'word-reveal ' + className + (inView ? ' inView' : '')}>
      {words.map((w, i) => (
        <span key={i} className="wr-word" style={{ transitionDelay: (i * 70) + 'ms' }}>
          {w}{i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </Tag>
  );
}

// Static card + button wrappers. Kept as thin components so call sites stay
// unchanged; the 3D-tilt and magnetic-follow effects were removed for a calmer,
// more professional feel. `intensity` is accepted and ignored.
function TiltCard({ children, intensity, className = '', tag: Tag = 'div', ...rest }) {
  return <Tag className={className} {...rest}>{children}</Tag>;
}

function MagneticBtn({ as: Tag = 'a', children, className = 'btn btn-primary', ...rest }) {
  return <Tag className={className} {...rest}>{children}</Tag>;
}

/* =========================================================
   NAV
   ========================================================= */
function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    try { return document.documentElement.getAttribute('data-theme') || 'dark'; }
    catch (_) { return 'dark'; }
  });
  const apply = (t) => {
    try {
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('theme', t);
      const m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', t === 'light' ? '#f5f7fc' : '#07080d');
    } catch (_) {}
    setTheme(t);
  };
  return (
    <button
      className="theme-toggle"
      type="button"
      aria-label="Toggle light or dark theme"
      aria-pressed={theme === 'light'}
      title="Toggle light / dark"
      onClick={() => apply(theme === 'light' ? 'dark' : 'light')}
    >
      <svg className="icon-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      <svg className="icon-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2v2.4M12 19.6V22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2 12h2.4M19.6 12H22M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7" /></svg>
    </button>
  );
}

function Nav() {
  const scrolled = useScrollPos();
  const [active, setActive] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sections = document.querySelectorAll('section[id]');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0.01 });
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);
  // Close mobile menu when a link is clicked or window resizes wide
  useEffect(() => {
    const onResize = () => { if (window.innerWidth > 760) setOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const close = () => setOpen(false);
  return (
    <header className={'nav' + (scrolled ? ' scrolled' : '') + (open ? ' menu-open' : '')}>
      <div className="container nav-inner">
        <a className="logo" href="#top" onClick={close}>
          <img className="logo-photo" width="38" height="38" decoding="async" src="saad.png" alt="Saad - Automation Engineer and ERP Developer in Dubai" />
          <span>Saad</span>
        </a>
        <nav className={'nav-links' + (open ? ' open' : '')}>
          <a href="#about" className={active === 'about' ? 'active' : ''} aria-current={active === 'about' ? 'page' : undefined} onClick={close}>About</a>
          <a href="#experience" className={active === 'experience' ? 'active' : ''} aria-current={active === 'experience' ? 'page' : undefined} onClick={close}>Experience</a>
          <a href="#projects" className={active === 'projects' ? 'active' : ''} aria-current={active === 'projects' ? 'page' : undefined} onClick={close}>Projects</a>
          <a href="#skills" className={active === 'skills' ? 'active' : ''} aria-current={active === 'skills' ? 'page' : undefined} onClick={close}>Skills</a>
          <a href="demo.html" target="_blank" rel="noopener" onClick={close} aria-label="Open the full demo gallery in a new tab">Demo ↗</a>
          <a href="contact.html" onClick={close}>Contact</a>
        </nav>
        <ThemeToggle />
        <a className="nav-cta" href="contact.html">Get in touch <span className="arrow">→</span></a>
        <button
          className={'nav-burger' + (open ? ' open' : '')}
          aria-label="Toggle navigation menu"
          aria-expanded={open}
          onClick={() => setOpen(v => !v)}
        >
          <span></span><span></span><span></span>
        </button>
      </div>
    </header>
  );
}

/* =========================================================
   VIEW TOGGLE
   ========================================================= */
const VIEWS = [
  { key: 'code', label: 'Coding' },
  { key: 'eng',  label: 'Engineering' },
];

function ViewToggle({ view, setView }) {
  const wrapRef = useRef(null);
  const [indicator, setIndicator] = useState({ left: 4, width: 0 });
  const recompute = () => {
    if (!wrapRef.current) return;
    const btn = wrapRef.current.querySelector('.vt-pill.active');
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

/* =========================================================
   HERO
   ========================================================= */
const HERO_COPY = {
  all: {
    title: ['Software for operations.', 'Automation behind it.'],
    sub: <Fragment>I&rsquo;m <strong>Saad</strong> - an <strong>Automation &amp; Software Developer</strong> focused on
      ERP systems, dashboards, backend tools, and web applications. I build software that replaces manual work
      - spreadsheets, paper logs, copy-paste reports, ticket prep, inventory tracking, admin panels, and
      business workflows. Engineering and IT-infrastructure background, so the systems I build are practical,
      reliable, and usable by real teams.</Fragment>,
    stack: 'Python · FastAPI · MongoDB · Docker · Linux · React',
    cta: { href: 'demo.html', label: 'Take demo ↗', target: '_blank' },
  },
  eng: {
    title: ['Operations on the floor.', 'Engineering behind it.'],
    sub: <Fragment>I&rsquo;m <strong>Saad</strong> - <strong>Automation Engineer</strong> with a software-first approach. I run and support Krones beverage production lines, coordinate operators during shifts, troubleshoot production issues, and build ERP / OEE / reporting tools around the production workflow. My strength is connecting factory operations with practical software systems: dashboards, batch records, downtime tracking, QC workflows, inventory visibility, and management reports.</Fragment>,
    stack: 'Krones line support · RCA · OEE tracking · GPON / PSTN',
    cta: { href: '#projects', label: 'See work →' },
  },
  code: {
    title: ['Software for operations.', 'Automation behind it.'],
    sub: <Fragment>I&rsquo;m <strong>Saad</strong> - an <strong>Automation &amp; Software Developer</strong> focused on
      ERP systems, dashboards, backend tools, and web applications. I build software that replaces manual work
      - spreadsheets, paper logs, copy-paste reports, inventory tracking, admin panels, and business
      workflows - with automation that runs itself.</Fragment>,
    stack: 'Python · FastAPI · Java · Spring Boot · C++17 · PostgreSQL · Docker · TypeScript',
    cta: { href: 'app/index.html', label: 'Launch live app ↗', target: '_blank' },
  },
};

function Hero({ view, setView }) {
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
            {' '}· <a href="hft-book/viewer.html" target="_blank" rel="noopener">live L2 viewer ↗</a>)</span>
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
          <img src="saad.png" width="400" height="500" loading="eager" decoding="async" fetchpriority="high"
               alt="Muhammad Saad - Automation & Software Developer, Dubai" />
          <figcaption><span className="plate-no">Plate 01</span> M. Saad · Automation &amp; Software · Dubai, UAE</figcaption>
        </figure>
      </div>
    </section>
  );
}

/* =========================================================
   STATS
   ========================================================= */
const STATS_ALL = [
  { num: KINGSLEY.reportingSpeedup, suffix: '%',    label: 'reduction in production reporting time', domain: 'code' },
  { num: KINGSLEY.departments,      suffix: '',     label: 'departments digitised through MES/ERP workflows', domain: 'code' },
  { num: 2,    suffix: ' yrs', label: 'industrial & telecom-ops experience', domain: 'all' },
  { num: 7,    suffix: '',     label: 'Krones subsystems supported in production', domain: 'eng' },
  { num: 2,    suffix: ' yrs', label: 'GPON / PSTN / broadband NOC operations', domain: 'eng' },
  { num: 6,    suffix: '+ yrs',label: 'writing Python since university - projects, internships, production', domain: 'code' },
];

function Stat({ s }) {
  return (
    <div className="stat">
      <div className="stat-num">
        {s.suffix.includes('%') ? '~' : ''}{s.num.toLocaleString()}{s.suffix}
      </div>
      <div className="stat-lbl">{s.label}</div>
    </div>
  );
}

function Stats({ view }) {
  const list = STATS_ALL.filter((s) => view === 'all' || s.domain === view || s.domain === 'all');
  return (
    <section className="stats container" id="stats">
      {list.map((s) => <Stat key={s.label} s={s} />)}
    </section>
  );
}

/* =========================================================
   FAQ - long-tail keyword capture + FAQPage rich result
   ========================================================= */
const FAQ_ITEMS = [
  {
    q: 'Is Saad available for hire?',
    a: <Fragment>Yes - open to automation, backend, full-stack, ERP / MES, IT-operations, and NOC roles. {AVAILABILITY}, and available immediately. Reach out via the <a href="contact.html">contact form</a>, email <a href="mailto:saad@saadm.dev">saad@saadm.dev</a>, or WhatsApp <a href="https://wa.me/971502578065" target="_blank" rel="noopener">+971 50 257 8065</a>.</Fragment>,
  },
  {
    q: 'What does the Kingsley MES / ERP platform do?',
    a: <Fragment>It replaces spreadsheets and paper across {KINGSLEY.departments} departments - production planning, QC, batch &amp; expiry tracking, inventory with FIFO, dispatch, accounts, and Sage Evolution integration - with OEE monitoring and print-ready PDF reports generated server-side from live data. Saad designed, built, and runs it end-to-end (Python / FastAPI, MongoDB + SQL Server, Docker, nginx), cutting production reporting time by roughly {KINGSLEY.reportingSpeedup}%.</Fragment>,
  },
  {
    q: 'What is Saad\'s tech stack?',
    a: <Fragment>Python, FastAPI, Java, Spring Boot, MongoDB, PostgreSQL, JavaScript, React, Docker, Linux, nginx, Cloudflare, Git, REST APIs, JWT auth, Pandas, and Sage Evolution integration - comfortable across the full lifecycle from data-model design through deployment and ops.</Fragment>,
  },
  {
    q: 'Can I see Saad\'s code?',
    a: <Fragment>Yes - try the <a href="demo.html" target="_blank" rel="noopener">interactive MES/ERP demo</a> (all data fabricated for privacy) and the live <a href="https://shopfloor-api-lvb0.onrender.com/" target="_blank" rel="noopener">ShopFloor API</a> in Java / Spring Boot, plus the open-source <a href="https://github.com/saad-mughal435/n8n-nodes-devtools" target="_blank" rel="noopener">n8n-nodes-devtools</a> automation node in TypeScript. Open source is on GitHub at <a href="https://github.com/saad-mughal435" target="_blank" rel="noopener">github.com/saad-mughal435</a>.</Fragment>,
  },
];

function FAQ() {
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

/* =========================================================
   ABOUT
   ========================================================= */
function About() {
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

/* =========================================================
   PROOF - verifiable signals, no testimonial gimmicks.
   Every card is a claim a recruiter can check in one click
   (except the Kingsley line, which is claim-only by design).
   ========================================================= */
const PROOF_ITEMS = [
  { k: 'In production',
    v: 'MES/ERP platform running daily at Kingsley Beverage FZCO, Dubai - sole developer, live since 2025.',
    link: { href: 'demo.html', label: 'See the walkthrough ↗', target: '_blank' } },
  { k: 'Open source',
    v: 'Public repos with green GitHub Actions CI - Java, TypeScript and C++17, tests on every push.',
    link: { href: 'https://github.com/saad-mughal435', label: 'github.com/saad-mughal435 ↗', target: '_blank' } },
  { k: 'Published',
    v: 'n8n community node on npm: @saadmughal435/n8n-nodes-devtools - unit-tested, MIT-licensed.',
    link: { href: 'https://www.npmjs.com/package/@saadmughal435/n8n-nodes-devtools', label: 'View on npm ↗', target: '_blank' } },
  { k: 'Open collab',
    v: 'ML contributor on global Omdena collaborations - 50+ contributor teams, accessibility and air-quality projects.',
    link: { href: 'https://www.omdena.com/', label: 'omdena.com ↗', target: '_blank' } },
];
// Short quotes from a manager / colleague. Leave empty to ship only the
// verifiable items above; fill in when the text is confirmed:
//   { text: '...', name: 'Full Name', role: 'Title, Company' }
const PROOF_QUOTES = [];

function ProofStrip() {
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

/* =========================================================
   EXPERIENCE
   ========================================================= */
const EXPERIENCE = [
  { domain: 'all',
    title: 'Automation & Software Developer · ERP Developer · IT Administrator',
    when: 'Jul 2025 - Present',
    company: 'Kingsley Beverage FZCO · Dubai, UAE',
    points: [
      <Fragment><strong>Designed and shipped a full MES/ERP platform from scratch</strong> across PPC, inventory, QC, accounts, production reporting, and Sage integration - sole developer, currently running in production.</Fragment>,
      <Fragment><strong>Reduced production reporting time by an estimated ~60%</strong> through automated OEE monitoring, batch tracking, PDF reports, and centralised workflows across <strong>5 departments</strong>.</Fragment>,
      <Fragment>Administer the underlying stack end-to-end - <em>Linux VM, MongoDB, Sage integration, Cloudflare-fronted nginx</em>, user accounts, backups, and deployment.</Fragment>,
      <Fragment>Run and support the <em>Krones</em> beverage production lines, coordinate operators during shifts, and troubleshoot production issues across blow molding, filling, Checkmate inspection, Variopac FS packaging, palletizing, and PET preform handling. The Krones machine automation is OEM-locked; my work focuses on line support and the surrounding ERP / OEE / reporting workflows.</Fragment>,
      'Support root-cause analysis and commissioning across interconnected line machines; author SOPs and operator instructions.',
    ],
  },
  { domain: 'all',
    title: 'NOC Engineer',
    when: 'Jul 2023 - Jul 2025',
    company: 'PTCL · Rawalpindi, Pakistan',
    points: [
      <Fragment>Backend operations for <em>GPON</em>, <em>PSTN</em>, and broadband network infrastructure at telecom scale.</Fragment>,
      <Fragment>Monitored national network performance via <em>SolarWinds NMS</em>; resolved faults using Huawei and Nokia tooling with minimal subscriber downtime.</Fragment>,
      <Fragment>Managed full incident lifecycle through <em>Oracle CRM</em>; partnered with the switching dept on PSTN migrations completed with zero outages.</Fragment>,
      <Fragment><strong>Built a Python tool</strong> that auto-generated PSTN configuration scripts from incoming tickets, removing manual prep work entirely and cutting provisioning time dramatically.</Fragment>,
    ],
  },
  { domain: 'code',
    title: 'Freelance Designer & WordPress Developer',
    when: '2019 - Jul 2025',
    company: 'Fiverr · Remote',
    points: [
      'Delivered branding, graphics, and custom WordPress builds for international clients.',
      'Managed multiple concurrent projects end-to-end - scoping, design, delivery.',
    ],
  },
  { domain: 'code',
    title: 'Machine Learning Intern',
    when: '2023',
    company: 'Omdena · Remote',
    points: [
      <Fragment>Contributed to ML models for <em>accessibility (vision-impaired navigation)</em> and <em>environmental monitoring (air-quality forecasting)</em> on global Omdena collaborations.</Fragment>,
      <Fragment>Built Python ML pipelines using <em>scikit-learn, NumPy, Pandas, Jupyter</em> as part of a globally distributed <strong>50+ contributor team</strong> - data cleaning, feature engineering, training, evaluation.</Fragment>,
    ],
  },
  { domain: 'eng',
    title: 'Technical Engineering Intern',
    when: 'Jun - Aug 2023',
    company: 'Kingsley Beverage FZCO · Dubai, UAE',
    points: [
      'First exposure to Krones machines; authored SOPs, work instructions, and quality manuals.',
      'Troubleshot and resolved machine faults under supervision.',
    ],
  },
  { domain: 'eng',
    title: 'Network Engineering Intern',
    when: 'Jun - Aug 2022',
    company: 'PTCL · Rawalpindi, Pakistan',
    points: [
      'Maintained power systems, wireless communication, and switching equipment.',
      'Contributed to a data center server migration with minimal disruption.',
    ],
  },
];

function Experience({ view }) {
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

/* =========================================================
   PROJECTS
   ========================================================= */
const PROJECTS = [
  {
    domain: 'all', featured: true, kind: 'Production system · Live interactive demo', year: '2025 - Present',
    sectionEyebrow: 'Featured manufacturing system',
    sectionHeading: 'The platform behind the factory floor',
    sectionBlurb: 'Internal operations platform built around the beverage production workflow. Replaces Excel + paper across production planning, QC seam-check, batch tracking + expiry, inventory + FIFO, dispatch, accounts, Sage Evolution integration, OEE monitoring - plus 6 print-ready PDF document templates. Sole developer, end-to-end, running in production today at a beverage plant. The platform does not modify Krones machine automation; it digitises the surrounding work.',
    title: 'Kingsley MES / ERP / OEE Platform',
    desc: <Fragment>An internal full-stack operations platform that ends manual workflows - spreadsheets, paper
      logs, copy-paste reports, ticket prep - across production planning, QC, batch tracking, inventory, dispatch,
      accounts, and Sage integration. The platform sits <em>around</em> the production line (Krones machine
      automation is locked OEM; this software digitises the operator-, QC-, stores-, and finance-side workflow).
      <strong>Sole developer</strong>, end-to-end, currently running in production. The &quot;Launch live app&quot;
      demo is interactive with the same UI and workflows - every value is fabricated for privacy but the structure
      is faithful to the real system.</Fragment>,
    bullets: [
      <Fragment><strong>20+ integrated modules</strong>: PPC · job orders · inventory · recipes/BOM · QC seam-check · batch &amp; expiry tracking · dispatch · accounts · OEE · GRN · customs · Sage Evolution integration</Fragment>,
      <Fragment><strong>6 print-ready PDF templates</strong>: proforma invoice, packing list, picking sheet, batch report, GRN, recipe sheet - all generated server-side from live data</Fragment>,
      <Fragment><strong>Full stack ownership</strong> (data model → API → UI → infra → deployment): Python/FastAPI service, MongoDB + SQL Server, React/vanilla JS frontends, Docker, Nginx, JWT auth with row-level RBAC</Fragment>,
      <Fragment><strong>~60%</strong> faster production reporting · <strong>5 departments</strong> on one system · operators, QC, stores, finance and management each have their own workflow</Fragment>,
    ],
    tags: ['Python', 'FastAPI', 'MongoDB', 'SQL Server', 'Docker', 'Nginx', 'TLS', 'JWT', 'RBAC', 'Sage Evolution', 'pandas', 'openpyxl', 'fpdf', 'OEE', 'Manufacturing'],
    ctaSubtitle: 'Live interactive demo - every value fabricated for privacy, every workflow faithful to the real system',
    ctaTip: <Fragment><strong>Best first view:</strong> open the <em>static walkthrough</em> for the 3-minute tour, then jump into the <em>live interactive demo</em>.</Fragment>,
    ctas: [
      { label: 'Launch live interactive demo ↗', href: 'app/index.html', target: '_blank', primary: true, prominent: true },
      { label: 'Static walkthrough', href: 'demo.html', target: '_blank' },
    ],
  },
  {
    domain: 'all', kind: 'Backend service · Live API · Open source · Java / Spring Boot', year: '2026',
    sectionEyebrow: 'Backend engineering',
    sectionHeading: 'The same operations domain, in Java & Spring Boot',
    sectionBlurb: 'A standalone REST backend that re-implements the manufacturing operations model - OEE, job orders, downtime, QC, FIFO inventory - in the enterprise Java stack. Open source, green CI, and deployed live with interactive Swagger docs you can click through.',
    title: 'ShopFloor API - MES / OEE backend',
    desc: <Fragment>A production-floor operations REST API in <strong>Spring Boot 3 / Java 21</strong>: job orders
      that <strong>compute OEE</strong> (Availability × Performance × Quality) on close, downtime with
      root-cause logging, QC holds, and <strong>FIFO inventory</strong> across stock lots. Layered service
      architecture, role-based JWT security, and a Flyway-managed PostgreSQL schema validated against the JPA
      entities - with green CI and interactive Swagger docs.</Fragment>,
    bullets: [
      <Fragment><strong>OEE engine</strong> - unit-tested Availability × Performance × Quality, computed end-to-end when a job order closes</Fragment>,
      <Fragment><strong>Spring Security (JWT)</strong> with operator / QC / manager roles enforced by <code>@PreAuthorize</code> method security</Fragment>,
      <Fragment><strong>JPA + PostgreSQL + Flyway</strong> (H2 demo profile); Hibernate <em>validate</em> keeps schema and entities in lockstep</Fragment>,
      <Fragment><strong>Tested + CI</strong> - JUnit 5, MockMvc, and a Testcontainers PostgreSQL integration test; GitHub Actions runs <code>mvn verify</code></Fragment>,
    ],
    tags: ['Java 21', 'Spring Boot 3', 'Spring Data JPA', 'Spring Security', 'PostgreSQL', 'Flyway', 'JWT', 'OpenAPI / Swagger', 'JUnit 5', 'Testcontainers', 'Docker', 'GitHub Actions'],
    ctas: [
      { label: 'Open live demo ↗', href: 'https://shopfloor-api-lvb0.onrender.com/', target: '_blank', primary: true, prominent: true },
      { label: 'View source on GitHub ↗', href: 'https://github.com/saad-mughal435/shopfloor-api', target: '_blank' },
    ],
    ctaSubtitle: 'Live on a free instance - the first request after idle can take ~50s to wake. Log in with manager / password.',
  },
  {
    domain: 'code', kind: 'Test automation · Open source · CI', year: '2026',
    sectionEyebrow: 'Quality engineering',
    sectionHeading: 'Tested like production software',
    sectionBlurb: 'Automated quality gates for the work above: a Playwright suite drives this very site and the ShopFloor API across real browsers and devices, runs in GitHub Actions on every push and nightly, and doubles as a production uptime check.',
    title: 'playwright-e2e - Cross-browser test automation',
    desc: <Fragment>A <strong>Playwright + TypeScript</strong> end-to-end suite that tests <strong>this portfolio</strong>
      and the live <strong>ShopFloor API</strong>. Browser specs cover load smoke, the React render, SEO / JSON-LD,
      navigation, the contact form, every project demo, and the Lahza PWA; API specs cover JWT auth and read-only
      domain endpoints - all green in CI across five browser and device targets.</Fragment>,
    bullets: [
      <Fragment><strong>Cross-browser + mobile</strong> - Chromium, Firefox, WebKit, plus Pixel 7 and iPhone 14 emulation</Fragment>,
      <Fragment><strong>Browser + API testing</strong> - DOM, SEO and PWA checks alongside read-only ShopFloor API auth and endpoint tests</Fragment>,
      <Fragment><strong>Accessibility</strong> - axe-core WCAG 2.0 / 2.1 A &amp; AA scan, gated on critical + serious issues</Fragment>,
      <Fragment><strong>GitHub Actions CI</strong> - every push, a nightly cron, and manual dispatch; uploads the HTML report</Fragment>,
    ],
    tags: ['Playwright', 'TypeScript', 'E2E Testing', 'API Testing', 'axe-core / a11y', 'Cross-browser', 'GitHub Actions', 'CI'],
    ctas: [
      { label: 'View source on GitHub ↗', href: 'https://github.com/saad-mughal435/playwright-e2e', target: '_blank', primary: true, prominent: true },
      { label: 'CI runs ↗', href: 'https://github.com/saad-mughal435/playwright-e2e/actions', target: '_blank' },
    ],
    ctaSubtitle: 'Cross-browser E2E + API + accessibility - green in CI, runs nightly against production.',
  },
  {
    domain: 'all', kind: 'Open-source n8n node · TypeScript · CI-tested', year: '2026',
    sectionEyebrow: 'Automation & open-source tooling',
    sectionHeading: 'An open-source n8n node for workflow automation',
    sectionBlurb: 'A published n8n community node that packages the developer and crypto primitives workflows keep reaching for - JWT, hashing, IDs, conversions, regex - behind a clean Resource / Operation UI. The logic is kept pure and unit-tested with green CI; the kind of TypeScript tooling that turns up in real automation and integration work.',
    title: 'n8n-nodes-devtools - n8n community node',
    desc: <Fragment>A standalone <strong>n8n community node</strong> in <strong>TypeScript</strong> that bundles the
      utilities every real workflow reaches for: <strong>JWT sign / verify</strong> (HS256/RS256, with
      <code>exp</code> / <code>nbf</code> checks), hashing and <strong>HMAC</strong>, UUID / Nano ID, JSON ↔ CSV
      and base64, and <strong>regex extraction</strong> with named groups. A programmatic <code>INodeType</code>
      over a framework-free core, so the behaviour is <strong>fully unit-tested</strong> with green CI.</Fragment>,
    bullets: [
      <Fragment><strong>JWT sign / verify</strong> - HS256/384/512 + RS256; verification checks the signature and <code>exp</code> / <code>nbf</code> and lets you pin the accepted algorithms</Fragment>,
      <Fragment><strong>Hashing + IDs</strong> - SHA-256/512 and keyed HMAC (hex or base64), UUID v4, and an unbiased Nano ID</Fragment>,
      <Fragment><strong>Convert + extract</strong> - RFC 4180 JSON ↔ CSV, base64, and regex with named capture groups</Fragment>,
      <Fragment><strong>Engineered as a sample</strong> - pure logic split from the n8n glue, 20 Jest tests, ESLint (n8n rules), and a lint + build + test GitHub Actions CI</Fragment>,
    ],
    tags: ['n8n', 'TypeScript', 'Node.js', 'n8n community node', 'JWT', 'HMAC / SHA-256', 'Jest', 'ESLint', 'GitHub Actions', 'JSON ↔ CSV', 'Regex'],
    ctas: [
      { label: 'View on npm ↗', href: 'https://www.npmjs.com/package/@saadmughal435/n8n-nodes-devtools', target: '_blank', primary: true, prominent: true },
      { label: 'View source on GitHub ↗', href: 'https://github.com/saad-mughal435/n8n-nodes-devtools', target: '_blank' },
      { label: 'CI runs ↗', href: 'https://github.com/saad-mughal435/n8n-nodes-devtools/actions', target: '_blank' },
    ],
    ctaSubtitle: 'Published on npm · MIT · green CI - npm install @saadmughal435/n8n-nodes-devtools',
  },
  {
    domain: 'code', kind: 'C++17 HFT engine · ITCH 5.0 · MoldUDP64 · FIX 4.4 · MT5 · CI', year: '2026',
    sectionEyebrow: 'Systems & C++',
    sectionHeading: 'Systems programming in C++',
    sectionBlurb: 'Five dependency-light C++17 repositories - modern CMake, unit tests (Catch2 fetched by CMake), and green GitHub Actions CI - led by a low-latency HFT market-data engine and spanning the operations, systems, networking and industrial-protocol domains the rest of this portfolio covers.',
    title: 'hft-orderbook - low-latency HFT engine (ITCH 5.0 · MoldUDP64 · FIX · MT5)',
    desc: <Fragment>A low-latency <strong>C++17</strong> trading-infrastructure engine. It reconstructs limit-order books from the real <strong>NASDAQ TotalView-ITCH 5.0</strong> feed - over <strong>BinaryFILE</strong> captures and the <strong>MoldUDP64</strong> UDP multicast transport - derives microstructure signals, scales across cores, speaks <strong>FIX 4.4</strong> order entry and a <strong>MetaTrader 5</strong> bridge, and can be <strong>watched reconstructing the book live in the browser</strong>. ITCH is pre-matched, so this is a <strong>reconstructor, not a matching engine</strong> - the hot path is an O(1) <code>order_ref → order</code> map.</Fragment>,
    bullets: [
      <Fragment><strong>Market connectivity</strong> - ITCH 5.0 decode by manual big-endian byte assembly (never a packed-struct cast over the wire); reads real <strong>BinaryFILE</strong> files and the <strong>MoldUDP64</strong> UDP feed with <strong>sequence-gap detection</strong>; routes every message to a per-symbol book by <code>stock_locate</code></Fragment>,
      <Fragment><strong>Lock-free, sub-microsecond, sharded</strong> - a wait-free SPSC ring (<code>alignas(64)</code> cache-line split, <code>PAUSE</code> busy-wait) feeds a decode → book pipeline in well under 100&nbsp;ns/msg; symbols shard across pinnable worker threads, one ring each - all <strong>validated race-free by ThreadSanitizer</strong></Fragment>,
      <Fragment><strong>Pluggable book, measured</strong> - templated over its price-level store: a <code>std::map</code> baseline, a flat sorted vector, and a <strong>price-tick-indexed windowed array</strong> (the canonical L2 structure, ~24% faster in the A/B) - all three parity-tested and benchmarked head-to-head with Google Benchmark</Fragment>,
      <Fragment><strong>Microstructure signals + live viewer</strong> - micro-price, order-book imbalance and spread (bps) plus a trade tape with VWAP / OHLCV, streamed as JSON over a <strong>dependency-free WebSocket</strong> (hand-rolled SHA-1 + RFC-6455 frame codec) to a browser L2 book viewer</Fragment>,
      <Fragment><strong>FIX 4.4 order entry</strong> - a compact FIX codec (NewOrderSingle / ExecutionReport) with auto BodyLength + CheckSum: the order-entry counterpart to the ITCH market-data side (market data in, orders out)</Fragment>,
      <Fragment><strong>MetaTrader 5 bridge</strong> - versioned NDJSON over TCP, an <code>ITCHBridge.mq5</code> EA, and a depth/signal publisher that streams the reconstructed book back; a mock-client integration test runs the full ticks → orders → acks round trip in CI without Windows</Fragment>,
      <Fragment><strong>Hardened & verified</strong> - every push runs ThreadSanitizer, Address / UB sanitizers, a <strong>libFuzzer</strong> decode harness and a clang <code>-Werror</code> build alongside <code>ctest</code> and a benchmark smoke</Fragment>,
    ],
    tags: ['C++17', 'HFT', 'NASDAQ ITCH 5.0', 'Lock-free', 'Low-latency', 'Sub-microsecond', 'MoldUDP64', 'UDP multicast', 'FIX 4.4', 'Order entry', 'Market data', 'Multi-symbol', 'Microstructure signals', 'Order-book imbalance', 'Sharded', 'WebSocket', 'MetaTrader 5', 'Benchmarked', 'Sanitized + fuzzed', 'CMake', 'GitHub Actions'],
    ctas: [
      { label: 'View on GitHub ↗', href: 'https://github.com/saad-mughal435/hft-orderbook', target: '_blank', primary: true, prominent: true },
      { label: 'Live L2 viewer ↗', href: '/hft-book/viewer.html', target: '_blank', prominent: true },
      { label: 'CI runs ↗', href: 'https://github.com/saad-mughal435/hft-orderbook/actions', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'C++17 library + CLI · Open source · CI', year: '2026',
    title: 'oee-core - OEE & downtime analytics (C++17)',
    desc: <Fragment>The same manufacturing-operations domain as my ShopFloor API, in modern C++. A library + CLI that computes <strong>OEE = Availability × Performance × Quality</strong> with divide-by-zero guards and factor clamping, grades the result, and builds a <strong>Pareto of downtime</strong> with MTTR / MTBF.</Fragment>,
    bullets: [
      <Fragment><strong>OEE engine</strong> - availability / performance / quality with over-speed clamping, unit-tested against the classic worked example (87.5% OEE)</Fragment>,
      <Fragment><strong>Downtime analytics</strong> - reason-coded Pareto with MTTR and MTBF from a CSV of stop events</Fragment>,
      <Fragment><strong>Modern C++17 + CMake</strong> - library, CLI and Catch2 tests; warnings-clean under <code>-Wall -Wextra -Wpedantic</code></Fragment>,
      <Fragment><strong>Green CI</strong> - GitHub Actions builds and runs <code>ctest</code> on every push</Fragment>,
    ],
    tags: ['C++17', 'CMake', 'Catch2', 'GitHub Actions', 'OEE', 'Manufacturing', 'CLI'],
    ctas: [
      { label: 'View on GitHub ↗', href: 'https://github.com/saad-mughal435/oee-core', target: '_blank', primary: true, prominent: true },
      { label: 'CI runs ↗', href: 'https://github.com/saad-mughal435/oee-core/actions', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'C++17 header-only library · Open source · CI', year: '2026',
    title: 'threadpool - header-only C++17 thread pool',
    desc: <Fragment>A single-header thread pool: <code>submit(fn, args…)</code> returns a <code>std::future</code>, exceptions propagate through <code>future.get()</code>, and the destructor <strong>drains the queue</strong> so every submitted task completes. Classic mutex + condition-variable design.</Fragment>,
    bullets: [
      <Fragment><strong>Futures + perfect forwarding</strong> - <code>submit</code> returns <code>std::future&lt;result&gt;</code> via <code>packaged_task</code></Fragment>,
      <Fragment><strong>Exception-safe</strong> - a throwing task rethrows from <code>get()</code>; copy/assignment disabled</Fragment>,
      <Fragment><strong>Graceful shutdown</strong> - drain-on-destruct guarantee, covered by a test</Fragment>,
      <Fragment><strong>Tested</strong> - result delivery, 1000-task throughput, parallel range-sum and exception propagation</Fragment>,
    ],
    tags: ['C++17', 'Concurrency', 'std::future', 'Header-only', 'CMake', 'Catch2', 'GitHub Actions'],
    ctas: [
      { label: 'View on GitHub ↗', href: 'https://github.com/saad-mughal435/threadpool', target: '_blank', primary: true, prominent: true },
      { label: 'CI runs ↗', href: 'https://github.com/saad-mughal435/threadpool/actions', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'C++17 CLI + library · Open source · CI', year: '2026',
    title: 'netlat - TCP connect-latency probe',
    desc: <Fragment>A NOC-style reachability / latency tool from my networking background. It times the TCP handshake to a <code>host:port</code> over N samples and reports <strong>min / avg / p50 / p95 / p99 / max</strong> plus jitter, using a <strong>non-blocking connect with a select() timeout</strong> so dead hosts fail fast.</Fragment>,
    bullets: [
      <Fragment><strong>Non-blocking connect + select() timeout</strong> over POSIX sockets - no hanging on unreachable hosts</Fragment>,
      <Fragment><strong>Latency statistics</strong> - nearest-rank percentiles (p50 / p95 / p99), mean and jitter (std-dev)</Fragment>,
      <Fragment><strong>Tested</strong> - the stats maths plus a real probe against a loopback listener and a refused port</Fragment>,
      <Fragment><strong>C++17 + CMake + CI</strong> - library, CLI, Catch2 tests, GitHub Actions</Fragment>,
    ],
    tags: ['C++17', 'POSIX sockets', 'TCP', 'Networking', 'CMake', 'Catch2', 'GitHub Actions'],
    ctas: [
      { label: 'View on GitHub ↗', href: 'https://github.com/saad-mughal435/netlat', target: '_blank', primary: true, prominent: true },
      { label: 'CI runs ↗', href: 'https://github.com/saad-mughal435/netlat/actions', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'C++17 library + CLI · Open source · CI', year: '2026',
    title: 'modbus-codec - Modbus RTU/TCP frame codec',
    desc: <Fragment>An industrial-protocol codec from my automation background. It encodes and decodes <strong>Modbus RTU</strong> (serial, CRC-16 checked) and <strong>Modbus TCP</strong> (MBAP header) frames, with helpers for the common function codes and exception responses - the fieldbus behind PLCs, drives and building-automation gear.</Fragment>,
    bullets: [
      <Fragment><strong>CRC-16/MODBUS</strong> - validated against the canonical <code>0x4B37</code> check value</Fragment>,
      <Fragment><strong>RTU + TCP framing</strong> - encode / decode with CRC and MBAP-length validation</Fragment>,
      <Fragment><strong>Function-code helpers</strong> - build / parse read requests (0x01-0x04), register responses, and exception detection</Fragment>,
      <Fragment><strong>Pure logic, tested</strong> - no I/O; Catch2 round-trip and rejection tests, green CI</Fragment>,
    ],
    tags: ['C++17', 'Modbus RTU', 'Modbus TCP', 'CRC-16', 'Industrial', 'CMake', 'Catch2', 'GitHub Actions'],
    ctas: [
      { label: 'View on GitHub ↗', href: 'https://github.com/saad-mughal435/modbus-codec', target: '_blank', primary: true, prominent: true },
      { label: 'CI runs ↗', href: 'https://github.com/saad-mughal435/modbus-codec/actions', target: '_blank' },
    ],
  },
];

/* Product demos - shown directly after Projects as a 3-column grid (compact cards). */
const DEMO_PROJECTS = [
  {
    domain: 'code', kind: 'Disconnected demo · Portfolio piece', year: '2026',
    title: 'Anvil Supply Co. - B2B wholesale portal',
    desc: <Fragment>A wholesale/industrial portal with tier pricing, MOQs, contract discounts, quote requests, and an
      approval workflow for large orders. Multi-user accounts with purchaser / approver / viewer roles, recurring
      orders, statements view, and a data-dense admin panel with quote queue and approval queue.</Fragment>,
    bullets: [
      <Fragment>Tier pricing (1/10/50/100), MOQ enforcement, customer contract discounts</Fragment>,
      <Fragment>Quote request workflow + approval workflow for orders over $1,000</Fragment>,
      <Fragment>Multi-user accounts (purchaser / approver / viewer), bulk SKU paste add</Fragment>,
      <Fragment>Admin: order queue, quote queue, approval queue, customers, analytics</Fragment>,
    ],
    tags: ['HTML5', 'CSS Grid', 'Vanilla JS (ES6+)', 'Tier pricing', 'Approval workflow', 'Role-based UI', 'Bulk SKU paste', 'Admin dashboard', 'Mock API'],
    ctas: [
      { label: 'Open portal ↗', href: 'b2b/index.html', target: '_blank', primary: true },
      { label: 'Open admin ↗', href: 'b2b/admin.html', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'Disconnected demo · Portfolio piece', year: '2026',
    title: 'Manzil Properties - Dubai marketplace',
    desc: <Fragment>A Dubai real-estate marketplace demo: 65+ listings, map-and-list search on
      Leaflet/OpenStreetMap, agent and agency profiles, a mortgage calculator with full amortisation,
      and a 15-section admin panel - plus a 6-step owner listing wizard feeding a verification queue.</Fragment>,
    bullets: [
      <Fragment>10 customer pages: home, search (list/map), listing detail, agents, agencies, areas, mortgage, compare, account</Fragment>,
      <Fragment>Map view with price-labelled pins, hover sync with list, single-pin detail map</Fragment>,
      <Fragment><strong>Owner-side: 6-step listing wizard</strong> (save-and-resume drafts, map-pin selector, transaction-type branching for buy/rent/off-plan, document upload - Emirates ID + Title Deed + DLD permit + NOC + IBAN) feeding an <strong>admin verification queue</strong> with approve / request-changes / reject</Fragment>,
      <Fragment>15-section admin SPA: dashboard, listings, inquiries pipeline, viewings calendar, agents, agencies, customers, analytics, promotions, content CMS, moderation, settings, audit, <strong>owner approvals, listing approvals</strong></Fragment>,
      <Fragment>AED/USD/GBP/EUR currency switcher, EN/AR locale toggle with RTL layout</Fragment>,
    ],
    tags: ['HTML5', 'CSS Grid', 'Vanilla JS (ES6+)', 'Owner onboarding wizard', 'Document upload', 'Verification queue', 'Leaflet · OpenStreetMap', 'localStorage', 'Mock API', 'Hash-routed SPA', 'i18n EN/AR', 'Multi-currency'],
    ctas: [
      { label: 'Open marketplace ↗', href: 'property/index.html', target: '_blank', primary: true },
      { label: 'List a property ↗', href: 'property/owner-onboard.html', target: '_blank' },
      { label: 'Open admin ↗', href: 'property/admin.html', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'Disconnected demo · Portfolio piece', year: '2026',
    title: 'Vacation Homes - UAE short-stay booking',
    desc: <Fragment>A UAE short-stay booking marketplace demo: 55 homes across 10 destinations, a hand-rolled
      date-range picker and availability calendar with conflict-check, per-night pricing with weekend surcharge
      and 5% VAT, and a 13-section admin SPA - plus a host listing wizard with a manual approval queue.</Fragment>,
    bullets: [
      <Fragment>Hand-rolled <strong>date-range picker</strong> + availability calendar (no library) with blocked / booked / available states</Fragment>,
      <Fragment><strong>Conflict-check booking flow</strong>: POST /bookings returns 409 if dates were just taken; UI bounces back with a toast</Fragment>,
      <Fragment><strong>Host-side: 6-step listing wizard</strong> (save-and-resume drafts, map-pin selector, document upload - Emirates ID + ownership + DTCM permit + IBAN) feeding an <strong>admin verification queue</strong> for manual approval; listings stay off-market until live</Fragment>,
      <Fragment>9 guest pages + 13-section admin SPA + host dashboard: dashboard, listings (CRUD + bulk + status pipeline + CSV), bookings, hosts (Superhost verify), guests, reviews, payments/payouts, promotions, destinations, <strong>host approvals + listing approvals (approve / request-changes / reject)</strong>, settings, audit</Fragment>,
      <Fragment>Full pricing breakdown: nightly subtotal × nights + weekend surcharge + cleaning + 10% service fee + 5% VAT</Fragment>,
    ],
    tags: ['HTML5', 'CSS Grid', 'Vanilla JS (ES6+)', 'Multi-step wizard', 'Document upload', 'Verification queue', 'Custom date-range picker', 'Leaflet maps', 'localStorage', 'Mock API', 'Hash-routed SPA'],
    ctas: [
      { label: 'Open marketplace ↗', href: 'vacation/index.html', target: '_blank', primary: true },
      { label: 'List a property ↗', href: 'vacation/host-onboard.html', target: '_blank' },
      { label: 'Open admin ↗', href: 'vacation/admin.html', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'Disconnected demo · Portfolio piece', year: '2026',
    title: 'Qahwa POS - café & quick-service POS',
    desc: <Fragment>A café and quick-service point-of-sale demo covering the in-person retail / F&amp;B vertical. Touch
      cashier terminal with PIN auth, kitchen display system with audio chime on new tickets, and a 14-section
      admin SPA for the back office. ~5,000 LOC, vanilla JS, all writes in localStorage - reset to seed any
      time from Settings.</Fragment>,
    bullets: [
      <Fragment><strong>Touch cashier terminal</strong>: PIN lock, category grid + product search, modifier modal (size / milk / syrup / extras with per-option price deltas), cart with qty steppers, cash / card / split payment with change calculator</Fragment>,
      <Fragment><strong>Kitchen Display System</strong>: 5-second polling, big card layout with elapsed-time warnings (amber &gt; 5 min, red &gt; 8 min), per-line ready checkboxes, Web Audio chime when a new ticket arrives</Fragment>,
      <Fragment><strong>14-section admin SPA</strong>: dashboard with hourly heatmap + weekly bars + top products + payment breakdown, live orders pipeline with refund flow, products CRUD + bulk + modifier-group multi-link, categories, modifiers, discounts, tables floor plan, staff RBAC, shifts with cash-denomination count + variance + printable Z-report, reports with CSV export, inventory with recipe-based deduction, receipt template with live preview, settings, audit log</Fragment>,
      <Fragment>Full order state machine (open → kitchen → ready → served → completed, plus refunded / held / voided) over a fetch interceptor serving <code>/pos/api/*</code></Fragment>,
    ],
    tags: ['HTML5', 'CSS Grid', 'Vanilla JS (ES6+)', 'PIN auth', 'Touch UI', 'KDS polling', 'Web Audio API', 'Mock API (fetch shim)', 'localStorage', 'Hash-routed SPA', 'Cash-drawer Z-report'],
    ctas: [
      { label: 'Open POS ↗', href: 'pos/index.html', target: '_blank', primary: true },
      { label: 'Cashier terminal ↗', href: 'pos/terminal.html', target: '_blank' },
      { label: 'Kitchen display ↗', href: 'pos/kitchen.html', target: '_blank' },
      { label: 'Open admin ↗', href: 'pos/admin.html', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'Disconnected demo · Portfolio piece', year: '2026',
    title: 'Sanad - AI customer-support copilot',
    desc: <Fragment>A SaaS-style helpdesk with an LLM integrated at every touchpoint. Built to demonstrate <strong>real LLM wiring</strong> end-to-end - system prompts, streaming, prompt caching, server-side key handling via a Cloudflare Worker proxy, graceful mock fallback when the key isn't set, and cost tracking - not just an OpenAI playground demo. Works offline in deterministic mock mode out of the box.</Fragment>,
    bullets: [
      <Fragment><strong>Agent inbox with AI sidebar</strong>: suggested reply (with KB citations), conversation summary, sentiment, auto-category, EN↔AR translation, AI-drafted quick-action reasons. Click "Insert" to push the AI's draft into the composer.</Fragment>,
      <Fragment><strong>Customer chat widget</strong>: streaming AI replies grounded in the knowledge base with clickable citation chips. "Talk to a human" creates a real ticket in the agent inbox.</Fragment>,
      <Fragment><strong>Knowledge base</strong>: 77 articles in 6 categories, tiny custom markdown renderer, admin-only AI actions per article (<em>Generate FAQ</em>, <em>Suggest improvements</em>, <em>Translate to Arabic</em>), plus a "Find gaps" feature that clusters recent tickets and proposes new articles.</Fragment>,
      <Fragment><strong>11-section admin SPA</strong>: dashboard with sentiment split + hourly heatmap + AI-cost ticker, conversations, KB CRUD, categories, agents with permission matrix, customers, <strong>AI Console</strong> (model selector Fast / Balanced / Max, editable system prompt with test-with-sample preview, temperature / max-tokens / cache toggles), analytics (daily volume, by-category, fallback rate, latency, cost, CSV export), integrations, settings, audit log.</Fragment>,
      <Fragment><strong>Live + mock modes</strong>: detects whether a Cloudflare Worker proxy with LLM_API_KEY is configured via <code>GET /api/sanad/ai/health</code> and shows a Live/Demo badge in the topbar. Every feature gracefully falls back to a deterministic pattern-matched mock when no key is set - the demo never breaks for visitors.</Fragment>,
    ],
    tags: ['Vanilla JS (ES6+)', 'LLM API', 'CF Worker proxy', 'RAG (lite)', 'Streaming', 'Prompt caching', 'Server-side keys', 'Mock fallback', 'EN/AR i18n', 'localStorage'],
    ctas: [
      { label: 'Open inbox ↗', href: 'sanad/inbox.html', target: '_blank', primary: true },
      { label: 'Try chat widget ↗', href: 'sanad/chat.html', target: '_blank' },
      { label: 'Help centre ↗', href: 'sanad/kb.html', target: '_blank' },
      { label: 'Open admin ↗', href: 'sanad/admin.html', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'Disconnected demo · Portfolio piece', year: '2026',
    title: 'Watad - smart-building / BMS operations console',
    desc: <Fragment>A live operator console for a commercial smart building - the kind of software Imdaad / EFS / Schneider / Honeywell ship to facilities teams. Live SVG floor plan with HVAC, lighting, metering and sensor equipment plotted as icons, a simulated BACnet/Modbus telemetry stream (5-second tick mutating ~200 points plausibly per asset class + outdoor temp + occupancy), severity-sorted alarm queue with audio cues, predictive-maintenance work orders, ASHRAE-overlaid energy curves, and an industrial-AI copilot. The <strong>first portfolio demo with a real-time data shape</strong> - proves I can think beyond REST.</Fragment>,
    bullets: [
      <Fragment><strong>Live SVG floor plan</strong> · 4 floors, 48 assets at absolute pixel coordinates. Equipment icons pulse red when their associated point is in alarm. Click any chiller / AHU / FCU / light / meter to drill into a 24h overlaid trend chart.</Fragment>,
      <Fragment><strong>Real-time telemetry simulator</strong> · ~200 points across the building, 5-second tick, plausible values per asset class (chiller load tracks outdoor temp, FCU zone temp drifts when occupied, sub-meters accumulate kWh), 288-sample history buffer per point regenerated from a seeded RNG so charts always look populated.</Fragment>,
      <Fragment><strong>Alarm management</strong> · severity ranks (info / warning / urgent / critical), audio cue on new urgent/critical, Acknowledge / Create-WO / ✦ AI-explain actions per alarm card. Rule editor in admin.</Fragment>,
      <Fragment><strong>Energy + sustainability</strong> · 30-day daily kWh bar chart with ASHRAE 90.1 reference band overlay, sub-meter breakdown with % of total + trend, DEWA DSM demand-response opt-in panel, kgCO₂ tile using UAE grid factor.</Fragment>,
      <Fragment><strong>10-section admin SPA</strong> · Dashboard (KPIs + 7-day energy bars + alarms-by-hour heatmap + top alarming assets), Assets, Points (with live current value column), Alarms (full audit + filters), Schedules, Work orders, Staff (RBAC), Integrations (BACnet / Modbus / DALI / MQTT / Maximo / ServiceNow), AI Console (model selector + system prompt + test-with-sample), Settings + Audit.</Fragment>,
      <Fragment><strong>3 BMS-tuned AI features</strong> · <em>Explain alarm</em> returns Action + Likely cause grounded in point values; <em>Suggest maintenance</em> proposes preventive tasks ranked by priority with AED estimates; <em>Optimise setpoints</em> reads occupancy + outdoor temp + current setpoints and proposes setpoint/schedule changes with estimated AED savings. Live AI when a Worker proxy is configured; deterministic mock fallback otherwise.</Fragment>,
    ],
    tags: ['Vanilla JS (ES6+)', 'CSS Grid', 'SVG floor plan', 'Real-time telemetry sim', 'BACnet/Modbus (simulated)', 'Web Audio API', 'LLM API', 'CF Worker proxy', 'ASHRAE 90.1 band', 'localStorage', 'Mock fallback'],
    ctas: [
      { label: 'Open console ↗', href: 'watad/console.html', target: '_blank', primary: true },
      { label: 'Energy dashboard ↗', href: 'watad/energy.html', target: '_blank' },
      { label: 'Work orders ↗', href: 'watad/workorders.html', target: '_blank' },
      { label: 'Open admin ↗', href: 'watad/admin.html', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'Mobile · PWA · Portfolio piece', year: '2026',
    title: 'Lahza - AI journaling + mood tracking (mobile-first PWA)',
    desc: <Fragment>A mobile-shaped <strong>Progressive Web App</strong> built to demonstrate
      mobile-product thinking and a new AI integration domain (consumer wellness).
      On desktop it renders inside a stylised iPhone frame; on mobile it's
      fullscreen and edge-to-edge; installed to a home screen it opens as a
      standalone window with no browser chrome. One AI-suggested prompt a day,
      a few sentences, and the model surfaces the mood + themes + patterns across
      the week - same Cloudflare Worker pattern as the other AI demos.</Fragment>,
    bullets: [
      <Fragment><strong>PWA installable</strong> on iOS, Android, and desktop via "Add to Home Screen". No App Store, no native compilation. Custom service worker scoped to <code>/lahza/</code> only.</Fragment>,
      <Fragment><strong>4 AI features</strong> · <em>Suggest prompt</em> (time-of-day + mood aware), <em>Detect mood</em> (returns structured JSON of mood + emotions from the entry text), <em>Weekly insights</em> (RAG over the last 7 entries, themes + wins + concerns), <em>AI Coach chat</em> (RAG over the last 14 entries, citation chips that open the cited entry in a bottom sheet).</Fragment>,
      <Fragment><strong>7 mobile views</strong> · Onboarding (3-card swipe), Today (AI prompt + streak ring + recent strip), Compose (full-screen modal with mood emoji picker), Journal (chronological feed with mood filter chips), Insights (7-day mood SVG chart + theme tags + AI summary), AI Coach chat, Profile (locale EN/AR, theme, export-JSON, reset).</Fragment>,
      <Fragment><strong>Privacy by default</strong> · entries live in <code>localStorage</code> only. In Live AI mode, only the active question is sent to the model via the Worker proxy.</Fragment>,
      <Fragment><strong>14-day fabricated seed</strong> from a deterministic RNG so first-time visitors see a populated mood chart, recent feed, and themes without waiting two weeks.</Fragment>,
      <Fragment><strong>Fourth AI demo</strong> in the portfolio after Sanad (helpdesk), Watad (operations) and Ask Saad (recruiter Q&A) - same Worker, same encrypted-secret pattern, four products.</Fragment>,
    ],
    tags: ['Vanilla JS (ES6+)', 'PWA', 'Service Worker', 'Web App Manifest', 'Mobile-first', 'CSS Grid', 'SVG chart', 'LLM API', 'CF Worker proxy', 'RAG', 'localStorage', 'Mock fallback', 'i18n EN/AR'],
    ctas: [
      { label: 'Open app ↗', href: 'lahza/', target: '_blank', primary: true },
      { label: 'AI Coach ↗', href: 'lahza/#coach', target: '_blank' },
      { label: 'Insights ↗', href: 'lahza/#insights', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'Disconnected demo · Portfolio piece', year: '2026',
    title: 'Marsad - fleet / logistics dispatcher console',
    desc: <Fragment>A live <strong>dispatcher console for a Dubai last-mile courier</strong>. 16 drivers, 12 vans + 4 motorbikes, 96 in-flight orders across 6 service zones (Marina, JLT, Downtown, Business Bay, Deira, Sharjah Al Nahda). Real Leaflet map with vehicle pins that tick toward their next drop every 4 seconds. The fleet simulator + AI dispatcher copilot are the technical differentiators - recognisably the same shape Aramex / Noon Express / Talabat run internally.</Fragment>,
    bullets: [
      <Fragment><strong>Live map with real coordinates</strong> · Leaflet + Carto dark tiles, real Dubai lat/lng. Vehicle pins move toward their assigned drop-off · order pins flip green on delivery · audio chime on SLA breach.</Fragment>,
      <Fragment><strong>Real-time fleet simulator</strong> · 4-second tick · 96 orders + 16 vehicles · plausible movement (vehicles head toward their next drop, deliver within 120m, then pick the next assignment). Pure JS, no map provider beyond tiles.</Fragment>,
      <Fragment><strong>4 AI dispatcher features</strong> · <em>Explain delay</em> for any order (cites real cause + recommends action), <em>Suggest reroute</em> to re-sequence a driver's stops by SLA deadline, <em>Batch-assign</em> pending orders across idle drivers, <em>Dispatcher chat</em> conversational copilot grounded in live fleet state.</Fragment>,
      <Fragment><strong>Driver-side view</strong> · simplified mobile-shaped UI for the driver - current job · route · COD pill · complete / handover buttons · today's earnings · streak. Switch drivers via top-right picker.</Fragment>,
      <Fragment><strong>9-section admin SPA</strong> · Dashboard (KPIs + top zones + driver leaderboard), Orders (filter + search), Drivers, Vehicles (with fuel + last-ping), Zones, Integrations (Shopify · Twilio · Google Maps · QuickBooks), AI Console, Settings, Audit log.</Fragment>,
      <Fragment><strong>UAE-shaped business logic</strong> · per-zone SLAs (Marina 90 min · Sharjah 150 min) · COD up to AED 500 · WPS-style driver compensation · Sheikh Mohammed Bin Zayed Road traffic context in the AI replies.</Fragment>,
    ],
    tags: ['Vanilla JS (ES6+)', 'Leaflet + OpenStreetMap', 'Real-time sim', 'CSS Grid', 'Web Audio API', 'LLM API', 'CF Worker proxy', 'Mock fallback', 'RAG', 'localStorage'],
    ctas: [
      { label: 'Open dispatcher ↗', href: 'marsad/console.html', target: '_blank', primary: true },
      { label: 'Driver view ↗', href: 'marsad/driver.html', target: '_blank' },
      { label: 'Open admin ↗', href: 'marsad/admin.html', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'Disconnected demo · Portfolio piece', year: '2026',
    title: 'Nabta - UAE HR + payroll SaaS',
    desc: <Fragment>A modern <strong>UAE-shaped HRIS</strong>: 32 employees across 5 departments, leave management with line-manager + HR approval, <strong>WPS-compliant payroll runs</strong> through Emirates NBD, recruitment kanban, performance review cycle, and an AI-powered HR policy assistant grounded in the company handbook + UAE Labour Law (Federal Decree-Law No. 33 of 2021). The kind of software every Dubai / Abu Dhabi mid-size company actually runs but typically buys (Bayzat / GulfTalent / Zimyo) rather than builds.</Fragment>,
    bullets: [
      <Fragment><strong>Employees module</strong> · 32 employees with full UAE-specific fields (Emirates ID, passport, visa expiry, IBAN, base + allowances) · filter by department / status · per-employee profile sheet with leave balance.</Fragment>,
      <Fragment><strong>Leave management</strong> · 7 leave types (Annual, Sick, Maternity, Paternity, Unpaid, Compassionate, Hajj/Umrah) · pending → approved / rejected workflow · line-manager + HR sign-off · per-employee balance tracking (30 annual + 15 sick per UAE Labour Law).</Fragment>,
      <Fragment><strong>WPS payroll runs</strong> · 6 months of historical runs + current draft · per-employee breakdown (base + allowances − deductions = net) · "Generate WPS SIF + Finalize" flow · pay-day 28th via Emirates NBD.</Fragment>,
      <Fragment><strong>Recruitment kanban</strong> · 4 open roles · 22 candidates · lead / applied / interview / offer / hired stages · source tracking · rating · expected salary range.</Fragment>,
      <Fragment><strong>Performance reviews</strong> · Q2-2026 cycle in flight · 12 reviews across status (not started / in progress / submitted) · rating + goals-met %.</Fragment>,
      <Fragment><strong>AI policy assistant</strong> · an LLM grounded in 6 HR policies (leave, WPS, visa, gratuity, probation, remote) + UAE Labour Law. Every reply cites the specific policy by <code>[pol-xxx]</code>. Click a citation chip → opens the source policy.</Fragment>,
    ],
    tags: ['Vanilla JS (ES6+)', 'CSS Grid', 'Hash-routed SPA', 'localStorage', 'Mock API (fetch shim)', 'LLM API', 'CF Worker proxy', 'RAG (policy KB)', 'Mock fallback', 'UAE WPS', 'UAE Labour Law 2021'],
    ctas: [
      { label: 'Open app ↗', href: 'nabta/app.html', target: '_blank', primary: true },
      { label: 'Run payroll ↗', href: 'nabta/app.html#payroll', target: '_blank' },
      { label: 'AI policy assistant ↗', href: 'nabta/app.html#ai_chat', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'Disconnected demo · Portfolio piece', year: '2026',
    title: 'Pebble & Co. - DTC storefront',
    desc: <Fragment>A full direct-to-consumer storefront built end-to-end as a portfolio piece - storefront, catalog,
      product detail, cart, multi-step checkout, customer account, and a Shopify-style admin panel with
      dashboard / orders / products / customers / promotions / analytics. Mock API runs entirely in-browser.</Fragment>,
    bullets: [
      <Fragment>Storefront + catalog + filters + product detail + cart + multi-step checkout</Fragment>,
      <Fragment>Customer account: orders, wishlist, addresses, loyalty points</Fragment>,
      <Fragment>Shopify-style admin: dashboard, orders, products, customers, promotions, analytics</Fragment>,
      <Fragment>In-browser notifications (toast + bell + email log + demo event ticker)</Fragment>,
    ],
    tags: ['HTML5', 'CSS Grid', 'Vanilla JS (ES6+)', 'localStorage', 'Mock API (fetch+XHR shim)', 'Multi-step checkout', 'Admin dashboard', 'Design system'],
    ctas: [
      { label: 'Open storefront ↗', href: 'b2c/index.html', target: '_blank', primary: true },
      { label: 'Open admin ↗', href: 'b2c/admin.html', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'Internal Tool', year: '2023 - 2025',
    title: 'PSTN Config Auto-Generator',
    desc: 'Python tool that ingested PTCL service-tickets and emitted ready-to-run configuration scripts using a structured database of area codes, number ranges, and network parameters.',
    bullets: ['Eliminated manual ticket prep','Faster provisioning + lower error rate','Zero-outage PSTN migrations'],
    tags: ['Python', 'SQLite', 'Templates', 'Telecom'],
  },
  {
    domain: 'code', kind: 'Open Collaboration', year: '2023',
    title: 'Omdena - AI for Accessibility',
    desc: 'Contributed to ML models for accessibility applications and environmental monitoring on a global Omdena collaboration - data, training, evaluation, deployment.',
    bullets: ['Hands-on model training & evaluation','Worked in a distributed contributor team'],
    tags: ['scikit-learn', 'NumPy', 'Pandas'],
  },
];

function ProjectCard({ p, compact }) {
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

function Projects({ view }) {
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

/* =========================================================
   DEMOS - product demos as a 3-column grid (after Projects)
   ========================================================= */
function Demos({ view }) {
  const items = DEMO_PROJECTS.filter((p) => view === 'all' || p.domain === view || p.domain === 'all');
  if (!items.length) return null;
  return (
    <section id="demos" className="section container">
      <Reveal className="section-head">
        <span className="section-tag">Fig. 05 - Demos</span>
        <h2><WordReveal>Product demos built around real workflows.</WordReveal></h2>
        <p className="demos-sub">Ten browser-based product demos - B2B portals, marketplaces, booking, POS, AI copilots and operations consoles. Each opens as a full product you can click through. <a href="demo.html" target="_blank" rel="noopener">Full gallery ↗</a></p>
      </Reveal>
      <Reveal stagger className="demos-grid">
        {items.map((p) => <ProjectCard key={p.title} p={p} compact />)}
      </Reveal>
    </section>
  );
}

/* =========================================================
   SKILLS
   ========================================================= */
// Grouped chip cards - no tier badges, no percentages. Each card shows the
// areas the section title implies. Lets the viewer scan instead of judge.
const SKILLS = [
  { domain: 'code', title: 'Backend & APIs', items:
    ['Python', 'FastAPI', 'Java', 'Spring Boot', 'Spring Data JPA', 'C++17', 'Lock-free', 'Low-latency', 'Market data', 'Market microstructure', 'FIX protocol', 'UDP multicast', 'TypeScript', 'Node.js', 'REST APIs', 'JWT Auth', 'OpenAPI / Swagger', 'Pydantic', 'async I/O'] },
  { domain: 'all', title: 'Manufacturing Systems', items:
    ['MES', 'ERP', 'OEE', 'PPC', 'QC Workflows', 'Batch Tracking', 'Inventory / FIFO', 'Sage Evolution'] },
  { domain: 'code', title: 'Frontend & UI', items:
    ['JavaScript ES6+', 'HTML5 / CSS3', 'Admin Dashboards', 'Multi-step Forms', 'Role-based UI', 'Responsive Design', 'SPA hash routing'] },
  { domain: 'code', title: 'Data & Reporting', items:
    ['MongoDB', 'PostgreSQL', 'SQL Server', 'Flyway', 'Pandas', 'OpenPyXL', 'Excel Automation', 'PDF Generation'] },
  { domain: 'code', title: 'Infrastructure & CI', items:
    ['Docker', 'Docker Compose', 'Linux', 'nginx', 'Cloudflare', 'Git / GitHub', 'GitHub Actions', 'CMake', 'n8n', 'Workflow Automation', "Let's Encrypt"] },
  { domain: 'eng', title: 'Industrial Operations', items:
    ['Krones Line Operations', 'Operator Coordination', 'Line Troubleshooting', 'RCA', 'SOPs', 'Commissioning Support', 'GPON / PSTN', 'Oracle CRM'] },
  { domain: 'all', title: 'Learning / Expanding', items:
    ['React', 'Tailwind CSS', 'PLC / Siemens basics', 'scikit-learn'] },
];

function SkillCard({ s }) {
  const ref = useRef(null);
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

function Skills({ view }) {
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

/* =========================================================
   CONTACT
   ========================================================= */
function Contact() {
  return (
    <section id="contact" className="section container">
      <Reveal className="contact-box">
        <div className="contact-left">
          <span className="section-tag">Fig. 07 - Contact</span>
          <h2>Let&rsquo;s build something that ships.</h2>
          <p>If you&rsquo;re hiring for automation, ERP/MES, manufacturing systems, backend engineering, IT operations, or
            Python-heavy technical roles in the UAE or remote, I&rsquo;d love to talk.</p>
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

/* =========================================================
   FOOTER
   ========================================================= */
function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-copy">© {new Date().getFullYear()} Muhammad Saad - Automation &amp; Software Developer. Hand-built with vanilla CSS.
          <span className="react-badge" title="This homepage is a React 18 single-page app (precompiled JSX, no build-time framework)">⚛ Built with React 18</span>
        </div>
        <div className="footer-links">
          <a href="mailto:saad@saadm.dev">Email</a>
          <a href="https://www.linkedin.com/in/muhammadsaad435/" target="_blank" rel="noopener">LinkedIn</a>
          <a href="https://github.com/saad-mughal435" target="_blank" rel="noopener">GitHub</a>
          <a href="#top">Back to top ↑</a>
        </div>
      </div>
    </footer>
  );
}

/* =========================================================
   APP
   ========================================================= */
function App() {
  const [view, setView] = useState(() => {
    try {
      const q = new URLSearchParams(window.location.search).get('view');
      if (q === 'eng' || q === 'code' || q === 'all') return q;
      const stored = localStorage.getItem('portfolio_view');
      return stored === 'eng' || stored === 'code' || stored === 'all' ? stored : 'code';
    } catch (_) { return 'code'; }
  });
  // Persist the active view and reflect it in the URL (?view=) so the page is
  // deep-linkable / shareable in a given mode. replaceState keeps it out of the
  // back-button history.
  useEffect(() => {
    try { localStorage.setItem('portfolio_view', view); } catch (_) {}
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('view') !== view) {
        url.searchParams.set('view', view);
        window.history.replaceState(null, '', url);
      }
    } catch (_) {}
  }, [view]);

  return (
    <Fragment>
      <a href="#top" className="skip-link">Skip to content</a>
      <ScrollProgress />
      <Nav />
      <main>
        <Hero view={view} setView={setView} />
        <Stats view={view} />
        <About />
        <ProofStrip />
        <Experience view={view} />
        <Projects view={view} />
        <Demos view={view} />
        <Skills view={view} />
        <FAQ />
        <Contact />
      </main>
      <Footer />
    </Fragment>
  );
}

createRoot(document.getElementById('root')).render(<App />);
