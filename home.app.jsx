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
   HOOKS
   ========================================================= */
function useInView(ref, opts = {}) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); io.disconnect(); } },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px', ...opts }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return inView;
}

function useCountUp(target, inView, duration = 1400) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let frame;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(target * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, target, duration]);
  return val;
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
  return <div className="scroll-progress" style={{ transform: `scaleX(${p / 100})` }} />;
}

function CursorSpotlight() {
  const ref = useRef(null);
  useEffect(() => {
    if (matchMedia('(hover: none)').matches) return;
    let frame;
    const onMove = (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (ref.current) {
          ref.current.style.transform = `translate(${e.clientX - 200}px, ${e.clientY - 200}px)`;
          ref.current.style.opacity = 1;
        }
      });
    };
    const onLeave = () => { if (ref.current) ref.current.style.opacity = 0; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseout', onLeave);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseout', onLeave); cancelAnimationFrame(frame); };
  }, []);
  return <div ref={ref} className="cursor-spotlight" aria-hidden="true" />;
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

const MARQUEE_ITEMS = [
  'Python', 'FastAPI', 'React', 'JavaScript', 'TypeScript', 'MongoDB', 'SQL Server',
  'Docker', 'Linux', 'nginx', 'Cloudflare', 'Git', 'GitHub', 'Tailwind CSS',
  'REST APIs', 'JWT', 'Pandas', 'NumPy', 'OpenAI API', 'LangChain', 'Sage Evolution',
  'OEE', 'MES / ERP', 'Production Automation',
];

function MarqueeStrip() {
  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
          <span className="marquee-item" key={i}>
            <span className="marquee-dot" />{item}
          </span>
        ))}
      </div>
    </div>
  );
}

function TiltCard({ children, intensity = 6, className = '', tag: Tag = 'div', ...rest }) {
  const ref = useRef(null);
  const onMove = (e) => {
    if (!ref.current) return;
    if (matchMedia('(hover: none)').matches) return;
    const r = ref.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * intensity;
    const y = ((e.clientY - r.top) / r.height - 0.5) * intensity;
    ref.current.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
    ref.current.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    ref.current.style.transform = `perspective(1200px) rotateY(${-x.toFixed(2)}deg) rotateX(${y.toFixed(2)}deg) translateY(-3px)`;
  };
  const reset = () => { if (ref.current) ref.current.style.transform = ''; };
  return (
    <Tag ref={ref} onMouseMove={onMove} onMouseLeave={reset} className={className} {...rest}>
      {children}
    </Tag>
  );
}

function MagneticBtn({ as: Tag = 'a', children, className = 'btn btn-primary', ...rest }) {
  const ref = useRef(null);
  const [t, setT] = useState({ x: 0, y: 0 });
  const onMove = (e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.25;
    const y = (e.clientY - r.top - r.height / 2) * 0.25;
    setT({ x, y });
  };
  const reset = () => setT({ x: 0, y: 0 });
  return (
    <Tag
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={className}
      style={{ transform: `translate(${t.x}px, ${t.y}px)` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/* =========================================================
   NAV
   ========================================================= */
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
          <a href="#about" className={active === 'about' ? 'active' : ''} onClick={close}>About</a>
          <a href="#experience" className={active === 'experience' ? 'active' : ''} onClick={close}>Experience</a>
          <a href="#projects" className={active === 'projects' ? 'active' : ''} onClick={close}>Projects</a>
          <a href="#skills" className={active === 'skills' ? 'active' : ''} onClick={close}>Skills</a>
          <a href="demo.html" target="_blank" rel="noopener" onClick={close}>Demo ↗</a>
          <a href="contact.html" onClick={close}>Contact</a>
        </nav>
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
    title: ['Hands on the line.', 'Eyes on the OEE.'],
    sub: <Fragment>I&rsquo;m <strong>Saad</strong> - <strong>Automation Engineer</strong> with a software-first approach. I run and support Krones beverage production lines, coordinate operators during shifts, troubleshoot production issues, and build ERP / OEE / reporting tools around the production workflow. My strength is connecting factory operations with practical software systems: dashboards, batch records, downtime tracking, QC workflows, inventory visibility, and management reports.</Fragment>,
    stack: 'Krones line support · RCA · OEE tracking · GPON / PSTN',
    cta: { href: '#projects', label: 'See work →' },
  },
  code: {
    title: ['I write code', 'that ends manual work.'],
    sub: <Fragment>I&rsquo;m <strong>Saad</strong> - an <strong>Automation &amp; Software Developer</strong> focused on
      ERP systems, dashboards, backend tools, and web applications. I build software that replaces manual work
      - spreadsheets, paper logs, copy-paste reports, inventory tracking, admin panels, and business
      workflows - with automation that runs itself.</Fragment>,
    stack: 'Python · FastAPI · MongoDB · Docker · Linux · React',
    cta: { href: 'app/index.html', label: 'Launch live app ↗', target: '_blank' },
  },
};

const CODE_SNIPPETS = {
  all: { title: 'engineer.py', body: (
    <Fragment>
      <span className="k">class</span> <span className="cls">Engineer</span>:{'\n'}
      {'    '}<span className="v">name</span>      = <span className="s">"Saad"</span>{'\n'}
      {'    '}<span className="v">based_in</span>  = <span className="s">"Dubai, UAE"</span>{'\n'}
      {'    '}<span className="v">open_to</span>   = <span className="s">"relocate worldwide"</span>{'\n'}
      {'    '}<span className="v">role</span>      = <span className="s">"Automation Engineer / ERP-OEE Developer / Operations Software Builder"</span>{'\n'}
      {'    '}<span className="v">does</span> = [{'\n'}
      {'        '}<span className="s">"Build MES/ERP from scratch"</span>,{'\n'}
      {'        '}<span className="s">"Replace manual workflows with automation"</span>,{'\n'}
      {'        '}<span className="s">"Ship full-stack apps in Python, FastAPI, and vanilla JavaScript"</span>,{'\n'}
      {'        '}<span className="s">"Own infrastructure end-to-end: db to deployment"</span>,{'\n'}
      {'        '}<span className="s">"Troubleshoot what others escalate"</span>,{'\n'}
      {'    '}]{'\n\n'}
      {'    '}<span className="k">def</span> <span className="fn">value</span>(<span className="v">self</span>) -&gt; <span className="c">str</span>:{'\n'}
      {'        '}<span className="k">return</span> <span className="s">"hardware + software, same engineer"</span>{'\n\n\n'}
      <span className="v">me</span> = <span className="cls">Engineer</span>(){'\n'}
      <span className="b">print</span>(<span className="v">me</span>.<span className="fn">value</span>())  <span className="comment"># → hardware + software, same engineer</span>
    </Fragment>
  )},
  code: { title: 'close_shift.py', body: (
    <Fragment>
      <span className="k">from</span> <span className="m">dataclasses</span> <span className="k">import</span> <span className="c">dataclass</span>{'\n'}
      <span className="k">from</span> <span className="m">decimal</span> <span className="k">import</span> <span className="c">Decimal</span>{'\n\n\n'}
      <span className="d">@dataclass</span>{'\n'}
      <span className="k">class</span> <span className="cls">Batch</span>:{'\n'}
      {'    '}<span className="v">line</span>: <span className="c">str</span>{'\n'}
      {'    '}<span className="v">recipe</span>: <span className="c">str</span>{'\n'}
      {'    '}<span className="v">good</span>: <span className="c">int</span>{'\n'}
      {'    '}<span className="v">reject</span>: <span className="c">int</span>{'\n'}
      {'    '}<span className="v">planned</span>: <span className="c">int</span>{'\n\n'}
      {'    '}<span className="d">@property</span>{'\n'}
      {'    '}<span className="k">def</span> <span className="fn">oee</span>(<span className="v">self</span>) -&gt; <span className="c">Decimal</span>:{'\n'}
      {'        '}<span className="v">avail</span>   = <span className="cls">Decimal</span>(<span className="v">self</span>.good + <span className="v">self</span>.reject) / <span className="v">self</span>.planned{'\n'}
      {'        '}<span className="v">quality</span> = <span className="cls">Decimal</span>(<span className="v">self</span>.good) / (<span className="v">self</span>.good + <span className="v">self</span>.reject){'\n'}
      {'        '}<span className="k">return</span> <span className="v">avail</span> * <span className="v">quality</span>  <span className="comment"># × performance</span>{'\n\n\n'}
      <span className="k">def</span> <span className="fn">close_shift</span>(<span className="v">batches</span>: <span className="c">list</span>[<span className="cls">Batch</span>]):{'\n'}
      {'    '}<span className="k">for</span> <span className="v">b</span> <span className="k">in</span> <span className="v">batches</span>:{'\n'}
      {'        '}<span className="fn">publish_to_mes</span>(<span className="v">b</span>, <span className="v">b</span>.<span className="fn">oee</span>)
    </Fragment>
  )},
  eng: { title: 'shift_report.yaml', body: (
    <Fragment>
      <span className="comment"># shift A · line A · 2026-05-13</span>{'\n'}
      <span className="k">line_support</span>:   <span className="s">saad</span>{'\n'}
      <span className="k">line</span>:           <span className="s">Line A - Krones</span>{'\n'}
      <span className="k">role</span>:{'\n'}
      {'  '}- <span className="s">line support</span>{'\n'}
      {'  '}- <span className="s">operator coordination</span>{'\n'}
      {'  '}- <span className="s">OEE reporting</span>{'\n'}
      <span className="k">subsystems</span>:{'\n'}
      {'  '}- <span className="s">blow_molder</span>:        <span className="v">✓ running</span>{'\n'}
      {'  '}- <span className="s">filler</span>:             <span className="v">✓ running</span>{'\n'}
      {'  '}- <span className="s">checkmate_inspection</span>: <span className="v">sensor flag · waiting check</span>{'\n'}
      {'  '}- <span className="s">variopac_fs</span>:        <span className="v">✓ running</span>{'\n'}
      {'  '}- <span className="s">palletizer</span>:         <span className="v">✓ running</span>{'\n\n'}
      <span className="k">recipe</span>:         <span className="s">Demo Beverage 500 mL</span>{'\n'}
      <span className="k">planned_qty</span>:    <span className="n">1000</span> cases{'\n'}
      <span className="k">good</span>:           <span className="n">962</span>{'\n'}
      <span className="k">reject</span>:         <span className="n">18</span>{'\n'}
      <span className="k">downtime_min</span>:   <span className="n">12</span>{'\n'}
      <span className="k">downtime_cause</span>: <span className="s">Variopac jam · cleared in 12 min</span>{'\n'}
      <span className="k">oee_percent</span>:    <span className="n">78</span>{'\n\n'}
      <span className="k">root_cause</span>:{'\n'}
      {'  '}<span className="k">where</span>:   <span className="s">Variopac infeed</span>{'\n'}
      {'  '}<span className="k">why</span>:     <span className="s">torn shrink film</span>{'\n'}
      {'  '}<span className="k">fix</span>:     <span className="s">replaced film roll · tension reset</span>{'\n'}
      {'  '}<span className="k">prevent</span>: <span className="s">spec change to film supplier</span>{'\n\n'}
      <span className="k">handover_to</span>:    <span className="s">shift B</span>
    </Fragment>
  )},
};

function CodeWindow({ view }) {
  const ref = useRef(null);
  const onMove = (e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform = `perspective(1400px) rotateY(${(-x * 8).toFixed(2)}deg) rotateX(${(y * 6).toFixed(2)}deg)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = 'perspective(1400px) rotateY(-3deg) rotateX(2deg)';
  };
  useEffect(() => { reset(); }, [view]);
  const snippet = CODE_SNIPPETS[view] || CODE_SNIPPETS.all;
  return (
    <div className="code-window view-fade" key={view} ref={ref}
         onMouseMove={onMove} onMouseLeave={reset}
         style={{ transform: 'perspective(1400px) rotateY(-3deg) rotateX(2deg)' }}>
      <div className="code-window-bar">
        <span className="dot red"></span><span className="dot yellow"></span><span className="dot green"></span>
        <span className="code-window-title">{snippet.title}</span>
      </div>
      <pre className="code-window-body"><code>{snippet.body}</code></pre>
    </div>
  );
}

function Hero({ view, setView }) {
  const copy = HERO_COPY[view] || HERO_COPY.all;
  return (
    <section className="hero container" id="top">
      <div className="hero-left">
        <div className="eyebrow"><span className="led"></span> Currently available in the UAE · Open to relocate worldwide</div>
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
          <button
            type="button"
            className="ask-cta-pill"
            title="Open the Ask Saad chatbot — AI grounded in his portfolio"
            onClick={() => { if (window.AskChat) window.AskChat.open(); }}
          >
            <span aria-hidden="true">✦</span> Ask the AI
          </button>
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
        <CodeWindow view={view} />
      </div>
    </section>
  );
}

/* =========================================================
   STATS
   ========================================================= */
const STATS_ALL = [
  { num: 60,   suffix: '%',    label: 'reduction in production reporting time', domain: 'code' },
  { num: 5,    suffix: '',     label: 'departments digitised through MES/ERP workflows', domain: 'code' },
  { num: 2,    suffix: ' yrs', label: 'industrial & telecom-ops experience', domain: 'all' },
  { num: 7,    suffix: '',     label: 'Krones subsystems supported in production', domain: 'eng' },
  { num: 2,    suffix: ' yrs', label: 'GPON / PSTN / broadband NOC operations', domain: 'eng' },
  { num: 6,    suffix: '+ yrs',label: 'writing Python since university - projects, internships, production', domain: 'code' },
];

function Stat({ s, view }) {
  const ref = useRef(null);
  const inView = useInView(ref);
  const v = useCountUp(s.num, inView);
  return (
    <div ref={ref} className="stat">
      <div className="stat-num">
        {s.suffix.includes('%') ? '~' : ''}{Math.round(v).toLocaleString()}{s.suffix}
      </div>
      <div className="stat-lbl">{s.label}</div>
    </div>
  );
}

function Stats({ view }) {
  const list = STATS_ALL.filter((s) => view === 'all' || s.domain === view || s.domain === 'all');
  return (
    <section className="stats container" id="stats">
      {list.map((s, i) => <Stat key={s.label} s={s} view={view} />)}
    </section>
  );
}

/* =========================================================
   STACK CHIPS - visible tag cloud (helps SEO + signals breadth)
   ========================================================= */
const STACK_GROUPS = [
  { label: 'Languages', tags: ['Python', 'JavaScript', 'HTML5', 'CSS3', 'SQL', 'Bash', 'C++'] },
  { label: 'Web / Frameworks', tags: ['FastAPI', 'Vanilla JS', 'ES Modules', 'React (learning)', 'JSX', 'Babel', 'Tailwind CSS', 'Responsive Design'] },
  { label: 'Backend / APIs', tags: ['REST APIs', 'JSON', 'JWT auth', 'Pydantic', 'Uvicorn', 'Motor', 'pymongo', 'pyodbc', 'asyncio', 'httpx'] },
  { label: 'Databases', tags: ['MongoDB', 'SQL Server', 'SQLite', 'Mongo aggregation', 'indexes', 'transactions'] },
  { label: 'Data / Automation', tags: ['Pandas', 'NumPy', 'OpenPyXL', 'Matplotlib', 'Excel automation', 'PDF generation', 'fpdf', 'pdfplumber', 'pypdf'] },
  { label: 'DevOps / Infra', tags: ['Docker', 'Docker Compose', 'Linux', 'Ubuntu', 'nginx', 'systemd', 'Cron', 'SSH', 'Cloudflare', 'Cloudflare Pages', 'Workers', 'Let\'s Encrypt'] },
  { label: 'Tooling', tags: ['Git', 'GitHub', 'GitHub Actions', 'VS Code', 'curl', 'jq', 'Postman'] },
  { label: 'AI / ML', tags: ['OpenAI API', 'LangChain', 'scikit-learn · model training (Omdena internship)'] },
  { label: 'Industrial', tags: ['MES', 'ERP', 'Sage Evolution', 'OEE', 'Production Planning', 'PLC concepts', 'Krones', 'GPON', 'PSTN'] },
];

function StackChips() {
  return (
    <section className="container stack-chips-section" id="stack">
      <Reveal className="section-head" style={{ marginBottom: 24 }}>
        <span className="section-tag">Tech stack</span>
        <h2 style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>Tools I use to build, ship, and run things.</h2>
      </Reveal>
      <Reveal className="stack-chips-grid">
        {STACK_GROUPS.map((g) => (
          <div className="stack-group" key={g.label}>
            <div className="stack-group-label">{g.label}</div>
            <div className="stack-chip-row">
              {g.tags.map((t) => <span key={t} className="stack-chip">{t}</span>)}
            </div>
          </div>
        ))}
      </Reveal>
    </section>
  );
}

/* =========================================================
   FAQ - long-tail keyword capture + FAQPage rich result
   ========================================================= */
const FAQ_ITEMS = [
  {
    q: 'Who is Muhammad Saad?',
    a: <Fragment>Muhammad Saad (Saad for short) is an <strong>Automation &amp; Software Developer</strong> currently based in the UAE and open to relocate worldwide. He builds ERP systems, dashboards, backend tools, admin panels, and web applications in Python, FastAPI, MongoDB, and JavaScript. Engineering background: B.Sc. Electrical Engineering with a Computer Engineering specialization from COMSATS Islamabad. Currently works as Automation Engineer and ERP Developer at Kingsley Beverage FZCO.</Fragment>,
  },
  {
    q: 'What does Saad work on?',
    a: <Fragment>The pattern is the same regardless of the project: take something a team is still doing by hand - spreadsheets, paper logs, ticket prep, copy-paste reports, manual reconciliations - and rebuild it as automation that runs itself. Most recently that meant designing and shipping a full-stack MES/ERP from scratch covering production planning, inventory, QC, accounts, and live reporting across 5 departments, plus running the Linux VM, MongoDB, Sage integration, and Cloudflare-fronted nginx behind it.</Fragment>,
  },
  {
    q: 'Is Saad available for hire?',
    a: <Fragment>Yes - open to backend, full-stack, automation, NOC engineering, IT infrastructure, and MES/ERP roles. On-site in the UAE, hybrid, or fully remote. Available immediately. Reach out via the <a href="contact.html">contact form</a>, email <a href="mailto:saad@saadm.dev">saad@saadm.dev</a>, or WhatsApp <a href="https://wa.me/971502578065" target="_blank" rel="noopener">+971 50 257 8065</a>.</Fragment>,
  },
  {
    q: 'What type of roles is Saad open to?',
    a: <Fragment>Automation, ERP / MES, manufacturing systems, backend engineering, IT operations, NOC engineering, industrial maintenance, and Python-heavy technical roles. Currently UAE-based; open to relocate worldwide. Open to on-site, hybrid, or fully remote.</Fragment>,
  },
  {
    q: 'What is Saad\'s tech stack?',
    a: <Fragment>Python, FastAPI, MongoDB, React, JavaScript, Docker, Linux, nginx, Cloudflare, Git, REST APIs, JWT auth, Pandas, OpenPyXL, scikit-learn, Sage Evolution integration. Comfortable with the full lifecycle from data model design through deployment and ops.</Fragment>,
  },
  {
    q: 'Where is Saad based?',
    a: <Fragment>Dubai, United Arab Emirates. Originally from Pakistan; graduated from COMSATS University Islamabad.</Fragment>,
  },
  {
    q: 'Can I see Saad\'s code?',
    a: <Fragment>Yes - check the <a href="demo.html" target="_blank" rel="noopener">live MES/ERP demo</a> (interactive, all data fabricated for privacy). Source for some open work is on GitHub at <a href="https://github.com/saad-mughal435" target="_blank" rel="noopener">github.com/saad-mughal435</a>.</Fragment>,
  },
];

function FAQ() {
  return (
    <section id="faq" className="section container">
      <Reveal className="section-head">
        <span className="section-tag">FAQ</span>
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
        <span className="section-tag">01 - About</span>
        <h2><WordReveal>I sit between the factory floor and the keyboard.</WordReveal></h2>
      </Reveal>
      <div className="about-grid">
        <Reveal className="about-copy">
          <p>I&rsquo;m an <strong>Automation &amp; Software Developer</strong> focused on ERP systems, dashboards, admin panels,
            and web applications. At Kingsley Beverage FZCO in Dubai I work as <strong>Automation Engineer</strong>,
            <strong>ERP Developer</strong>, and <strong>IT Administrator</strong>, and I&rsquo;m the sole developer of the
            enterprise software running across the plant.</p>
          <p>My engineering background (B.Sc. Electrical Engineering / Computer Engineering specialization, COMSATS
            Islamabad) helps me run and support the Krones beverage production lines, coordinate operators during
            shifts, and troubleshoot production issues across blow molding, filling, Checkmate inspection, Variopac FS
            packaging, palletizing, and PET preform handling.</p>
          <p>The Krones machine automation is OEM-locked; my software work sits around the production workflow through
            ERP / MES, OEE reporting, QC records, inventory, and management dashboards.</p>
          <p>Before that I spent two years as a <strong>NOC Engineer at PTCL</strong> running GPON / PSTN /
            broadband infrastructure, where I shipped a Python tool that auto-generated configuration scripts
            from tickets, eliminating hours of manual ticket prep every day.</p>
          <p>The pattern: I look at slow, manual operational work and rebuild it in code. That&rsquo;s what I want to do next
            - build automation, backend, ERP/MES, or technical operations systems for teams where reliability
            and real workflows matter.</p>
          <div className="about-tags">
            {['Python', 'FastAPI', 'React', 'JavaScript (ES6+)', 'HTML / CSS', 'CSS Grid', 'MongoDB',
              'Docker', 'Linux', 'nginx', 'Cloudflare', 'Git', 'REST APIs', 'JWT', 'Pandas',
              'Design Systems', 'MES / ERP', 'Sage', 'PLC concepts', 'Krones', 'RCA', 'GPON / PSTN'].map((t) =>
              <span className="tag" key={t}>{t}</span>
            )}
          </div>
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
        <span className="section-tag">02 - Experience</span>
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
    showCode: true,
    ctaSubtitle: 'Live interactive demo - every value fabricated for privacy, every workflow faithful to the real system',
    ctaTip: <Fragment><strong>Best first view:</strong> open the <em>static walkthrough</em> for the 3-minute tour, then jump into the <em>live interactive demo</em>.</Fragment>,
    ctas: [
      { label: 'Launch live interactive demo ↗', href: 'app/index.html', target: '_blank', primary: true, prominent: true },
      { label: 'Static walkthrough', href: 'demo.html', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'Disconnected demo · Portfolio piece', year: '2026',
    sectionEyebrow: 'Other software demos',
    sectionHeading: 'Product demos built around real workflows',
    sectionBlurb: 'These browser-based demos are not the headline of the portfolio. They show how the same operations-first approach can be applied to B2B portals, marketplaces, booking systems, storefronts, admin panels, approvals, dashboards, and workflow-heavy product software.',
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
    desc: <Fragment>A Dubai real-estate marketplace demo with 65+ listings across Marina, Downtown,
      Palm Jumeirah, JBR, Business Bay, DIFC, Arabian Ranches and more. Map-and-list search using
      Leaflet/OpenStreetMap, agent and agency profiles with verified RERA-style permits, mortgage
      calculator with full amortisation schedule, and a comprehensive 15-section admin panel covering
      listings CRUD, leads pipeline, viewings calendar, analytics, moderation and audit log.</Fragment>,
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
    desc: <Fragment>A UAE short-stay booking marketplace demo with 55 vacation homes across 10 destinations
      (Dubai Marina, Palm Jumeirah, Hatta Mountains, RAK Beach, Fujairah, Liwa Desert and more). Hand-rolled
      date-range picker, availability calendar with conflict-check, per-night pricing with weekend surcharge
      and 5% VAT breakdown, and a 13-section admin SPA covering listings, bookings, hosts, guests, reviews,
      payments, promotions, destinations CMS, host/listing approvals, settings and audit.</Fragment>,
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
    desc: <Fragment>A SaaS-style helpdesk with Claude integrated at every touchpoint. Built to demonstrate <strong>real LLM wiring</strong> end-to-end — system prompts, streaming, prompt caching, server-side key handling via a Cloudflare Worker proxy, graceful mock fallback when the key isn't set, and cost tracking — not just an OpenAI playground demo. Works offline in deterministic mock mode out of the box.</Fragment>,
    bullets: [
      <Fragment><strong>Agent inbox with AI sidebar</strong>: suggested reply (with KB citations), conversation summary, sentiment, auto-category, EN↔AR translation, AI-drafted quick-action reasons. Click "Insert" to push the AI's draft into the composer.</Fragment>,
      <Fragment><strong>Customer chat widget</strong>: streaming AI replies grounded in the knowledge base with clickable citation chips. "Talk to a human" creates a real ticket in the agent inbox.</Fragment>,
      <Fragment><strong>Knowledge base</strong>: 77 articles in 6 categories, tiny custom markdown renderer, admin-only AI actions per article (<em>Generate FAQ</em>, <em>Suggest improvements</em>, <em>Translate to Arabic</em>), plus a "Find gaps" feature that clusters recent tickets and proposes new articles.</Fragment>,
      <Fragment><strong>11-section admin SPA</strong>: dashboard with sentiment split + hourly heatmap + AI-cost ticker, conversations, KB CRUD, categories, agents with permission matrix, customers, <strong>AI Console</strong> (model selector Haiku 4.5 / Sonnet 4.6 / Opus 4.7, editable system prompt with test-with-sample preview, temperature / max-tokens / cache toggles), analytics (daily volume, by-category, fallback rate, latency, cost, CSV export), integrations, settings, audit log.</Fragment>,
      <Fragment><strong>Live + mock modes</strong>: detects whether a Cloudflare Worker proxy with ANTHROPIC_API_KEY is configured via <code>GET /api/sanad/ai/health</code> and shows a Live/Demo badge in the topbar. Every feature gracefully falls back to a deterministic pattern-matched mock when no key is set — the demo never breaks for visitors.</Fragment>,
    ],
    tags: ['Vanilla JS (ES6+)', 'Claude API', 'CF Worker proxy', 'RAG (lite)', 'Streaming', 'Prompt caching', 'Server-side keys', 'Mock fallback', 'EN/AR i18n', 'localStorage'],
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
    desc: <Fragment>A live operator console for a commercial smart building — the kind of software Imdaad / EFS / Schneider / Honeywell ship to facilities teams. Live SVG floor plan with HVAC, lighting, metering and sensor equipment plotted as icons, a simulated BACnet/Modbus telemetry stream (5-second tick mutating ~200 points plausibly per asset class + outdoor temp + occupancy), severity-sorted alarm queue with audio cues, predictive-maintenance work orders, ASHRAE-overlaid energy curves, and an industrial-AI copilot. The <strong>first portfolio demo with a real-time data shape</strong> — proves I can think beyond REST.</Fragment>,
    bullets: [
      <Fragment><strong>Live SVG floor plan</strong> · 4 floors, 48 assets at absolute pixel coordinates. Equipment icons pulse red when their associated point is in alarm. Click any chiller / AHU / FCU / light / meter to drill into a 24h overlaid trend chart.</Fragment>,
      <Fragment><strong>Real-time telemetry simulator</strong> · ~200 points across the building, 5-second tick, plausible values per asset class (chiller load tracks outdoor temp, FCU zone temp drifts when occupied, sub-meters accumulate kWh), 288-sample history buffer per point regenerated from a seeded RNG so charts always look populated.</Fragment>,
      <Fragment><strong>Alarm management</strong> · severity ranks (info / warning / urgent / critical), audio cue on new urgent/critical, Acknowledge / Create-WO / ✦ AI-explain actions per alarm card. Rule editor in admin.</Fragment>,
      <Fragment><strong>Energy + sustainability</strong> · 30-day daily kWh bar chart with ASHRAE 90.1 reference band overlay, sub-meter breakdown with % of total + trend, DEWA DSM demand-response opt-in panel, kgCO₂ tile using UAE grid factor.</Fragment>,
      <Fragment><strong>10-section admin SPA</strong> · Dashboard (KPIs + 7-day energy bars + alarms-by-hour heatmap + top alarming assets), Assets, Points (with live current value column), Alarms (full audit + filters), Schedules, Work orders, Staff (RBAC), Integrations (BACnet / Modbus / DALI / MQTT / Maximo / ServiceNow), AI Console (model selector + system prompt + test-with-sample), Settings + Audit.</Fragment>,
      <Fragment><strong>3 BMS-tuned AI features</strong> · <em>Explain alarm</em> returns Action + Likely cause grounded in point values; <em>Suggest maintenance</em> proposes preventive tasks ranked by priority with AED estimates; <em>Optimise setpoints</em> reads occupancy + outdoor temp + current setpoints and proposes setpoint/schedule changes with estimated AED savings. Live Claude when a Worker proxy is configured; deterministic mock fallback otherwise.</Fragment>,
    ],
    tags: ['Vanilla JS (ES6+)', 'CSS Grid', 'SVG floor plan', 'Real-time telemetry sim', 'BACnet/Modbus (simulated)', 'Web Audio API', 'Claude API', 'CF Worker proxy', 'ASHRAE 90.1 band', 'localStorage', 'Mock fallback'],
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
      a few sentences, and Claude surfaces the mood + themes + patterns across
      the week — same Cloudflare Worker pattern as the other AI demos.</Fragment>,
    bullets: [
      <Fragment><strong>PWA installable</strong> on iOS, Android, and desktop via "Add to Home Screen". No App Store, no native compilation. Custom service worker scoped to <code>/lahza/</code> only.</Fragment>,
      <Fragment><strong>4 AI features</strong> · <em>Suggest prompt</em> (time-of-day + mood aware), <em>Detect mood</em> (returns structured JSON of mood + emotions from the entry text), <em>Weekly insights</em> (RAG over the last 7 entries, themes + wins + concerns), <em>AI Coach chat</em> (RAG over the last 14 entries, citation chips that open the cited entry in a bottom sheet).</Fragment>,
      <Fragment><strong>7 mobile views</strong> · Onboarding (3-card swipe), Today (AI prompt + streak ring + recent strip), Compose (full-screen modal with mood emoji picker), Journal (chronological feed with mood filter chips), Insights (7-day mood SVG chart + theme tags + AI summary), AI Coach chat, Profile (locale EN/AR, theme, export-JSON, reset).</Fragment>,
      <Fragment><strong>Privacy by default</strong> · entries live in <code>localStorage</code> only. In Live AI mode, only the active question is sent to Claude via the Worker proxy.</Fragment>,
      <Fragment><strong>14-day fabricated seed</strong> from a deterministic RNG so first-time visitors see a populated mood chart, recent feed, and themes without waiting two weeks.</Fragment>,
      <Fragment><strong>Fourth AI demo</strong> in the portfolio after Sanad (helpdesk), Watad (operations) and Ask Saad (recruiter Q&A) — same Worker, same encrypted-secret pattern, four products.</Fragment>,
    ],
    tags: ['Vanilla JS (ES6+)', 'PWA', 'Service Worker', 'Web App Manifest', 'Mobile-first', 'CSS Grid', 'SVG chart', 'Claude API', 'CF Worker proxy', 'RAG', 'localStorage', 'Mock fallback', 'i18n EN/AR'],
    ctas: [
      { label: 'Open app ↗', href: 'lahza/', target: '_blank', primary: true },
      { label: 'AI Coach ↗', href: 'lahza/#coach', target: '_blank' },
      { label: 'Insights ↗', href: 'lahza/#insights', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'Disconnected demo · Portfolio piece', year: '2026',
    title: 'Marsad - fleet / logistics dispatcher console',
    desc: <Fragment>A live <strong>dispatcher console for a Dubai last-mile courier</strong>. 16 drivers, 12 vans + 4 motorbikes, 96 in-flight orders across 6 service zones (Marina, JLT, Downtown, Business Bay, Deira, Sharjah Al Nahda). Real Leaflet map with vehicle pins that tick toward their next drop every 4 seconds. The fleet simulator + AI dispatcher copilot are the technical differentiators — recognisably the same shape Aramex / Noon Express / Talabat run internally.</Fragment>,
    bullets: [
      <Fragment><strong>Live map with real coordinates</strong> · Leaflet + Carto dark tiles, real Dubai lat/lng. Vehicle pins move toward their assigned drop-off · order pins flip green on delivery · audio chime on SLA breach.</Fragment>,
      <Fragment><strong>Real-time fleet simulator</strong> · 4-second tick · 96 orders + 16 vehicles · plausible movement (vehicles head toward their next drop, deliver within 120m, then pick the next assignment). Pure JS, no map provider beyond tiles.</Fragment>,
      <Fragment><strong>4 AI dispatcher features</strong> · <em>Explain delay</em> for any order (cites real cause + recommends action), <em>Suggest reroute</em> to re-sequence a driver's stops by SLA deadline, <em>Batch-assign</em> pending orders across idle drivers, <em>Dispatcher chat</em> conversational copilot grounded in live fleet state.</Fragment>,
      <Fragment><strong>Driver-side view</strong> · simplified mobile-shaped UI for the driver — current job · route · COD pill · complete / handover buttons · today's earnings · streak. Switch drivers via top-right picker.</Fragment>,
      <Fragment><strong>9-section admin SPA</strong> · Dashboard (KPIs + top zones + driver leaderboard), Orders (filter + search), Drivers, Vehicles (with fuel + last-ping), Zones, Integrations (Shopify · Twilio · Google Maps · QuickBooks), AI Console, Settings, Audit log.</Fragment>,
      <Fragment><strong>UAE-shaped business logic</strong> · per-zone SLAs (Marina 90 min · Sharjah 150 min) · COD up to AED 500 · WPS-style driver compensation · Sheikh Mohammed Bin Zayed Road traffic context in the AI replies.</Fragment>,
    ],
    tags: ['Vanilla JS (ES6+)', 'Leaflet + OpenStreetMap', 'Real-time sim', 'CSS Grid', 'Web Audio API', 'Claude API', 'CF Worker proxy', 'Mock fallback', 'RAG', 'localStorage'],
    ctas: [
      { label: 'Open dispatcher ↗', href: 'marsad/console.html', target: '_blank', primary: true },
      { label: 'Driver view ↗', href: 'marsad/driver.html', target: '_blank' },
      { label: 'Open admin ↗', href: 'marsad/admin.html', target: '_blank' },
    ],
  },
  {
    domain: 'code', kind: 'Disconnected demo · Portfolio piece', year: '2026',
    title: 'Nabta - UAE HR + payroll SaaS',
    desc: <Fragment>A modern <strong>UAE-shaped HRIS</strong>: 32 employees across 5 departments, leave management with line-manager + HR approval, <strong>WPS-compliant payroll runs</strong> through Emirates NBD, recruitment kanban, performance review cycle, and a Claude-powered HR policy assistant grounded in the company handbook + UAE Labour Law (Federal Decree-Law No. 33 of 2021). The kind of software every Dubai / Abu Dhabi mid-size company actually runs but typically buys (Bayzat / GulfTalent / Zimyo) rather than builds.</Fragment>,
    bullets: [
      <Fragment><strong>Employees module</strong> · 32 employees with full UAE-specific fields (Emirates ID, passport, visa expiry, IBAN, base + allowances) · filter by department / status · per-employee profile sheet with leave balance.</Fragment>,
      <Fragment><strong>Leave management</strong> · 7 leave types (Annual, Sick, Maternity, Paternity, Unpaid, Compassionate, Hajj/Umrah) · pending → approved / rejected workflow · line-manager + HR sign-off · per-employee balance tracking (30 annual + 15 sick per UAE Labour Law).</Fragment>,
      <Fragment><strong>WPS payroll runs</strong> · 6 months of historical runs + current draft · per-employee breakdown (base + allowances − deductions = net) · "Generate WPS SIF + Finalize" flow · pay-day 28th via Emirates NBD.</Fragment>,
      <Fragment><strong>Recruitment kanban</strong> · 4 open roles · 22 candidates · lead / applied / interview / offer / hired stages · source tracking · rating · expected salary range.</Fragment>,
      <Fragment><strong>Performance reviews</strong> · Q2-2026 cycle in flight · 12 reviews across status (not started / in progress / submitted) · rating + goals-met %.</Fragment>,
      <Fragment><strong>AI policy assistant</strong> · Claude grounded in 6 HR policies (leave, WPS, visa, gratuity, probation, remote) + UAE Labour Law. Every reply cites the specific policy by <code>[pol-xxx]</code>. Click a citation chip → opens the source policy.</Fragment>,
    ],
    tags: ['Vanilla JS (ES6+)', 'CSS Grid', 'Hash-routed SPA', 'localStorage', 'Mock API (fetch shim)', 'Claude API', 'CF Worker proxy', 'RAG (policy KB)', 'Mock fallback', 'UAE WPS', 'UAE Labour Law 2021'],
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

function ProjectCard({ p }) {
  return (
    <TiltCard tag="article" intensity={5} className={'project' + (p.featured ? ' featured' : '')}>
      <div className="project-meta">
        <span className="project-kind">{p.kind}</span>
        <span className="project-year">{p.year}</span>
      </div>
      <h3 className="project-title">{p.title}</h3>
      <p className="project-desc">{p.desc}</p>
      <ul className="project-bullets">{p.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
      <div className="project-tags">{p.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>
      {p.showCode && (
        <div className="project-impl">
          <pre className="mini-code"><code>
            <span className="comment"># core loop - simplified</span>{'\n'}
            <span className="k">def</span> <span className="fn">close_shift</span>(<span className="v">line</span>: <span className="c">str</span>, <span className="v">shift</span>: <span className="c">int</span>):{'\n'}
            {'    '}<span className="v">batches</span> = <span className="fn">collect_batches</span>(<span className="v">line</span>, <span className="v">shift</span>){'\n'}
            {'    '}<span className="v">oee</span> = <span className="fn">compute_oee</span>(<span className="v">batches</span>){'\n'}
            {'    '}<span className="fn">publish</span>(<span className="v">line</span>, <span className="v">shift</span>, <span className="v">oee</span>, <span className="v">batches</span>)
          </code></pre>
        </div>
      )}
      {p.ctas && (
        <div className="project-cta">
          {p.ctas.map((c) => (
            <a key={c.label} href={c.href}
               className={'btn ' + (c.primary ? 'btn-primary' : 'btn-ghost') + (c.prominent ? ' btn-prominent' : '')}
               {...(c.target ? { target: c.target, rel: 'noopener' } : {})}>{c.label}</a>
          ))}
          {p.ctaSubtitle && <div className="cta-subtitle">{p.ctaSubtitle}</div>}
          {p.ctaTip && <div className="cta-tip">{p.ctaTip}</div>}
        </div>
      )}
    </TiltCard>
  );
}

/* What this proves - credibility strip between About and Projects. */
function WhatThisProves() {
  const items = [
    { icon: '⚙', title: 'I understand production-line operations', body: 'Machinery, utilities, shift workflows, downtime causes - not only the code that sits above them.' },
    { icon: '👷', title: 'I design workflows for every role on the plant', body: 'Operators, QC, stores, finance and management each have different friction points and screens.' },
    { icon: '🔗', title: 'I connect the whole stack', body: 'Frontend screens, backend APIs, MongoDB + SQL Server, Sage/ERP data and print-ready PDF reports - end-to-end in one head.' },
    { icon: '📊', title: 'I turn paper + Excel into software', body: 'My job is converting messy spreadsheets and paper logs into structured, audit-able, fast operational tools.' },
  ];
  return (
    <section id="proves" className="section container">
      <Reveal className="section-head">
        <span className="section-tag">What this proves</span>
        <h2><WordReveal>I build operations software because I&rsquo;ve worked operations.</WordReveal></h2>
      </Reveal>
      <Reveal stagger className="proves-grid">
        {items.map((it, i) => (
          <Reveal as="div" key={i} className="proves-card">
            <div className="proves-icon" aria-hidden="true">{it.icon}</div>
            <h3>{it.title}</h3>
            <p>{it.body}</p>
          </Reveal>
        ))}
      </Reveal>
    </section>
  );
}

/* MES thumbnail mockup cards - rendered above the featured MES project card.
   Pure CSS/JSX, no images required. Swap with real Kingsley screenshots
   later by dropping a PNG into site/screenshots/ and replacing one card
   with <img src="…">. */
function MesThumbnails() {
  return (
    <div className="mes-thumbs">
      <div className="mes-thumb">
        <div className="mes-thumb-head">
          <span className="mes-thumb-dot"></span><span className="mes-thumb-dot y"></span><span className="mes-thumb-dot g"></span>
          <span className="mes-thumb-title">Production dashboard</span>
          <span className="mes-thumb-badge">DEMO</span>
        </div>
        <div className="mes-thumb-meta">Line A · Shift A · 14:32</div>
        <div className="mes-thumb-kpis">
          <div><span className="mes-kpi-k">OEE</span><span className="mes-kpi-v">78%</span></div>
          <div><span className="mes-kpi-k">Speed</span><span className="mes-kpi-v">9,600 bph</span></div>
          <div><span className="mes-kpi-k">Output</span><span className="mes-kpi-v">3,847 cs</span></div>
          <div><span className="mes-kpi-k">Rejects</span><span className="mes-kpi-v">42</span></div>
        </div>
        <div className="mes-thumb-bars">
          <div style={{height:'62%'}}></div>
          <div style={{height:'74%'}}></div>
          <div style={{height:'48%'}}></div>
          <div style={{height:'85%'}}></div>
          <div style={{height:'70%'}}></div>
          <div style={{height:'92%'}}></div>
          <div style={{height:'78%'}}></div>
          <div style={{height:'66%'}}></div>
        </div>
      </div>

      <div className="mes-thumb">
        <div className="mes-thumb-head">
          <span className="mes-thumb-dot"></span><span className="mes-thumb-dot y"></span><span className="mes-thumb-dot g"></span>
          <span className="mes-thumb-title">QC batch record</span>
          <span className="mes-thumb-badge">DEMO</span>
        </div>
        <div className="mes-thumb-meta">Batch BR-2026-0418 · 500 ml PET</div>
        <ul className="mes-thumb-checks">
          <li><span>Seam thickness</span><span className="mes-thumb-pass">✓ PASS</span></li>
          <li><span>Drop test</span><span className="mes-thumb-pass">✓ PASS</span></li>
          <li><span>Brix &amp; carbonation</span><span className="mes-thumb-pass">✓ PASS</span></li>
          <li><span>Fill weight</span><span className="mes-thumb-pass">✓ PASS</span></li>
          <li><span>Microbiology</span><span className="mes-thumb-pass">✓ PASS</span></li>
        </ul>
        <div className="mes-thumb-footer">Verdict <strong>PASS</strong> · 36 samples · approved by demo.qc</div>
      </div>

      <div className="mes-thumb">
        <div className="mes-thumb-head">
          <span className="mes-thumb-dot"></span><span className="mes-thumb-dot y"></span><span className="mes-thumb-dot g"></span>
          <span className="mes-thumb-title">Inventory + Sage</span>
          <span className="mes-thumb-badge">DEMO</span>
        </div>
        <div className="mes-thumb-meta">Stock vs Sage reconciliation</div>
        <ul className="mes-thumb-rows">
          <li><span>Sugar</span><span className="mes-thumb-qty">12,500 kg</span><span className="mes-thumb-ok">sync ok</span></li>
          <li><span>Preforms 500 ml</span><span className="mes-thumb-qty">480,000 pcs</span><span className="mes-thumb-ok">sync ok</span></li>
          <li><span>Caps</span><span className="mes-thumb-qty">510,000 pcs</span><span className="mes-thumb-warn">312 short</span></li>
          <li><span>Labels 500 ml</span><span className="mes-thumb-qty">470,000 pcs</span><span className="mes-thumb-ok">sync ok</span></li>
        </ul>
        <div className="mes-thumb-footer">Last Sage sync · 11 minutes ago · 0 errors</div>
      </div>
    </div>
  );
}

function Projects({ view }) {
  const items = PROJECTS.filter((p) => view === 'all' || p.domain === view || p.domain === 'all');
  return (
    <section id="projects" className="section container">
      <Reveal className="section-head">
        <span className="section-tag">03 - Selected Work</span>
        <h2><WordReveal>Software projects built around real workflows.</WordReveal></h2>
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
            {p.featured && <MesThumbnails />}
            <ProjectCard p={p} />
          </Fragment>
        ))}
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
    ['Python', 'FastAPI', 'REST APIs', 'JWT Auth', 'Pydantic', 'Motor', 'pyodbc', 'async I/O'] },
  { domain: 'all', title: 'Manufacturing Systems', items:
    ['MES', 'ERP', 'OEE', 'PPC', 'QC Workflows', 'Batch Tracking', 'Inventory / FIFO', 'Sage Evolution'] },
  { domain: 'code', title: 'Frontend & UI', items:
    ['JavaScript ES6+', 'HTML5 / CSS3', 'Admin Dashboards', 'Multi-step Forms', 'Role-based UI', 'Responsive Design', 'SPA hash routing', 'Mock-driven prototyping'] },
  { domain: 'code', title: 'Data & Reporting', items:
    ['MongoDB', 'SQL Server', 'Pandas', 'OpenPyXL', 'Excel Automation', 'PDF Generation', 'Report Pipelines'] },
  { domain: 'code', title: 'Infrastructure', items:
    ['Docker', 'Docker Compose', 'Linux', 'nginx', 'Cloudflare', 'SSH / Cron', 'Git / GitHub', "Let's Encrypt"] },
  { domain: 'eng', title: 'Industrial Operations', items:
    ['Krones Line Operations', 'Operator Coordination', 'Line Troubleshooting', 'RCA', 'SOPs', 'Commissioning Support', 'GPON / PSTN', 'Oracle CRM'] },
  { domain: 'all', title: 'Learning / Expanding', items:
    ['React', 'Tailwind CSS', 'PLC / Siemens basics', 'scikit-learn', 'GitHub Actions'] },
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
        <span className="section-tag">04 - Skills</span>
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
          <span className="section-tag">05 - Contact</span>
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
          <li><span className="contact-k">LinkedIn</span><a className="contact-v" href="https://www.linkedin.com/in/muhammadsaad435/" target="_blank" rel="noopener">/in/muhammadsaad435</a></li>
          <li><span className="contact-k">Based in</span><span className="contact-v">UAE · Open to relocate worldwide · on-site / hybrid / remote</span></li>
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
        <div className="footer-copy">© {new Date().getFullYear()} Saad. Built with React, vanilla CSS, and a healthy disrespect for manual work.</div>
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
      if (q === 'eng' || q === 'code') return q;
      const stored = localStorage.getItem('portfolio_view');
      return stored === 'eng' || stored === 'code' ? stored : 'code';
    } catch (_) { return 'code'; }
  });
  useEffect(() => {
    try { localStorage.setItem('portfolio_view', view); } catch (_) {}
  }, [view]);

  return (
    <Fragment>
      <a href="#top" className="skip-link">Skip to content</a>
      <ScrollProgress />
      <CursorSpotlight />
      <Nav />
      <main>
        <Hero view={view} setView={setView} />
        <Stats view={view} />
        <MarqueeStrip />
        <StackChips />
        <About />
        <WhatThisProves />
        <Experience view={view} />
        <Projects view={view} />
        <Skills view={view} />
        <FAQ />
        <Contact />
      </main>
      <Footer />
    </Fragment>
  );
}

createRoot(document.getElementById('root')).render(<App />);
