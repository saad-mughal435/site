function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* ============================================================================
   home.app.jsx  -  SOURCE OF TRUTH for the saadm.dev homepage React app.
   The browser loads the compiled home.app.js; there is NO runtime Babel.
   After editing this file, regenerate the shipped JS and commit BOTH:
       npm run build:home
       (= babel home.app.jsx --presets @babel/preset-react -o home.app.js)
   React / ReactDOM are CDN globals (index.html), so this uses the classic
   JSX runtime (React.createElement) - do NOT add ES module imports.
   ============================================================================ */

const {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  Fragment
} = React;
const {
  createRoot
} = ReactDOM;

/* =========================================================
   SINGLE-SOURCE FACTS  -  defined once, referenced everywhere
   ========================================================= */
const KINGSLEY = {
  departments: 5,
  reportingSpeedup: 60
};
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
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    // threshold 0 fires as soon as the element enters the viewport, so it works
    // for any height. (A 0.12 threshold can never be met by a container taller
    // than ~8x the viewport - e.g. the single-column projects grid on mobile -
    // which would leave its cards stuck at opacity:0.)
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        io.disconnect();
      }
    }, {
      threshold: 0,
      rootMargin: '0px 0px -60px 0px',
      ...opts
    });
    io.observe(el);
    // Failsafe: never leave content permanently hidden if the observer never fires.
    const t = setTimeout(() => setInView(true), 1800);
    return () => {
      io.disconnect();
      clearTimeout(t);
    };
  }, []);
  return inView;
}
function useScrollPos() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, {
      passive: true
    });
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
      setP(max > 0 ? h.scrollTop / max * 100 : 0);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, {
      passive: true
    });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return p;
}

/* =========================================================
   PRIMITIVES
   ========================================================= */
function Reveal({
  children,
  className = '',
  stagger = false,
  as: Tag = 'div',
  ...rest
}) {
  const ref = useRef(null);
  const inView = useInView(ref);
  return /*#__PURE__*/React.createElement(Tag, _extends({
    ref: ref,
    className: (stagger ? 'stagger ' : 'reveal ') + (inView ? 'inView ' : '') + className
  }, rest), children);
}
function ScrollProgress() {
  const p = useScrollProgress();
  return /*#__PURE__*/React.createElement("div", {
    className: "scroll-progress",
    style: {
      transform: `scaleX(${p / 100})`
    }
  });
}
function WordReveal({
  children,
  className = '',
  as: Tag = 'span'
}) {
  const ref = useRef(null);
  const inView = useInView(ref, {
    threshold: 0.2
  });
  const text = typeof children === 'string' ? children : '';
  if (!text) return /*#__PURE__*/React.createElement(Tag, {
    className: className,
    ref: ref
  }, children);
  const words = text.split(' ');
  return /*#__PURE__*/React.createElement(Tag, {
    ref: ref,
    className: 'word-reveal ' + className + (inView ? ' inView' : '')
  }, words.map((w, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "wr-word",
    style: {
      transitionDelay: i * 70 + 'ms'
    }
  }, w, i < words.length - 1 ? ' ' : '')));
}

// Static card + button wrappers. Kept as thin components so call sites stay
// unchanged; the 3D-tilt and magnetic-follow effects were removed for a calmer,
// more professional feel. `intensity` is accepted and ignored.
function TiltCard({
  children,
  intensity,
  className = '',
  tag: Tag = 'div',
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: className
  }, rest), children);
}
function MagneticBtn({
  as: Tag = 'a',
  children,
  className = 'btn btn-primary',
  ...rest
}) {
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: className
  }, rest), children);
}

/* =========================================================
   NAV
   ========================================================= */
function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    try {
      return document.documentElement.getAttribute('data-theme') || 'dark';
    } catch (_) {
      return 'dark';
    }
  });
  const apply = t => {
    try {
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('theme', t);
      const m = document.querySelector('meta[name="theme-color"]');
      if (m) m.setAttribute('content', t === 'light' ? '#f5f7fc' : '#07080d');
    } catch (_) {}
    setTheme(t);
  };
  return /*#__PURE__*/React.createElement("button", {
    className: "theme-toggle",
    type: "button",
    "aria-label": "Toggle light or dark theme",
    "aria-pressed": theme === 'light',
    title: "Toggle light / dark",
    onClick: () => apply(theme === 'light' ? 'dark' : 'light')
  }, /*#__PURE__*/React.createElement("svg", {
    className: "icon-moon",
    viewBox: "0 0 24 24",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
  })), /*#__PURE__*/React.createElement("svg", {
    className: "icon-sun",
    viewBox: "0 0 24 24",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4.2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v2.4M12 19.6V22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M2 12h2.4M19.6 12H22M4.9 19.1l1.7-1.7M17.4 6.6l1.7-1.7"
  })));
}
function Nav() {
  const scrolled = useScrollPos();
  const [active, setActive] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const sections = document.querySelectorAll('section[id]');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) setActive(e.target.id);
      });
    }, {
      rootMargin: '-45% 0px -50% 0px',
      threshold: 0.01
    });
    sections.forEach(s => io.observe(s));
    return () => io.disconnect();
  }, []);
  // Close mobile menu when a link is clicked or window resizes wide
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 760) setOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const close = () => setOpen(false);
  return /*#__PURE__*/React.createElement("header", {
    className: 'nav' + (scrolled ? ' scrolled' : '') + (open ? ' menu-open' : '')
  }, /*#__PURE__*/React.createElement("div", {
    className: "container nav-inner"
  }, /*#__PURE__*/React.createElement("a", {
    className: "logo",
    href: "#top",
    onClick: close
  }, /*#__PURE__*/React.createElement("img", {
    className: "logo-photo",
    width: "38",
    height: "38",
    decoding: "async",
    src: "saad.png",
    alt: "Saad - Automation Engineer and ERP Developer in Dubai"
  }), /*#__PURE__*/React.createElement("span", null, "Saad")), /*#__PURE__*/React.createElement("nav", {
    className: 'nav-links' + (open ? ' open' : '')
  }, /*#__PURE__*/React.createElement("a", {
    href: "#about",
    className: active === 'about' ? 'active' : '',
    onClick: close
  }, "About"), /*#__PURE__*/React.createElement("a", {
    href: "#experience",
    className: active === 'experience' ? 'active' : '',
    onClick: close
  }, "Experience"), /*#__PURE__*/React.createElement("a", {
    href: "#projects",
    className: active === 'projects' ? 'active' : '',
    onClick: close
  }, "Projects"), /*#__PURE__*/React.createElement("a", {
    href: "#skills",
    className: active === 'skills' ? 'active' : '',
    onClick: close
  }, "Skills"), /*#__PURE__*/React.createElement("a", {
    href: "demo.html",
    target: "_blank",
    rel: "noopener",
    onClick: close
  }, "Demo \u2197"), /*#__PURE__*/React.createElement("a", {
    href: "contact.html",
    onClick: close
  }, "Contact")), /*#__PURE__*/React.createElement(ThemeToggle, null), /*#__PURE__*/React.createElement("a", {
    className: "nav-cta",
    href: "contact.html"
  }, "Get in touch ", /*#__PURE__*/React.createElement("span", {
    className: "arrow"
  }, "\u2192")), /*#__PURE__*/React.createElement("button", {
    className: 'nav-burger' + (open ? ' open' : ''),
    "aria-label": "Toggle navigation menu",
    "aria-expanded": open,
    onClick: () => setOpen(v => !v)
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null))));
}

/* =========================================================
   VIEW TOGGLE
   ========================================================= */
const VIEWS = [{
  key: 'code',
  label: 'Coding'
}, {
  key: 'eng',
  label: 'Engineering'
}];
function ViewToggle({
  view,
  setView
}) {
  const wrapRef = useRef(null);
  const [indicator, setIndicator] = useState({
    left: 4,
    width: 0
  });
  const recompute = () => {
    if (!wrapRef.current) return;
    const btn = wrapRef.current.querySelector('.vt-pill.active');
    if (!btn) return;
    setIndicator({
      left: btn.offsetLeft,
      width: btn.offsetWidth
    });
  };
  useEffect(() => {
    recompute();
  }, [view]);
  useEffect(() => {
    window.addEventListener('resize', recompute);
    return () => window.removeEventListener('resize', recompute);
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "view-toggle",
    ref: wrapRef,
    role: "group",
    "aria-label": "Switch portfolio view"
  }, /*#__PURE__*/React.createElement("div", {
    className: "vt-indicator",
    style: {
      left: indicator.left + 'px',
      width: indicator.width + 'px'
    }
  }), VIEWS.map(v => /*#__PURE__*/React.createElement("button", {
    key: v.key,
    className: 'vt-pill' + (view === v.key ? ' active' : ''),
    onClick: () => setView(v.key),
    "aria-pressed": view === v.key
  }, v.label)));
}

/* =========================================================
   HERO
   ========================================================= */
const HERO_COPY = {
  all: {
    title: ['Software for operations.', 'Automation behind it.'],
    sub: /*#__PURE__*/React.createElement(Fragment, null, "I\u2019m ", /*#__PURE__*/React.createElement("strong", null, "Saad"), " - an ", /*#__PURE__*/React.createElement("strong", null, "Automation & Software Developer"), " focused on ERP systems, dashboards, backend tools, and web applications. I build software that replaces manual work - spreadsheets, paper logs, copy-paste reports, ticket prep, inventory tracking, admin panels, and business workflows. Engineering and IT-infrastructure background, so the systems I build are practical, reliable, and usable by real teams."),
    stack: 'Python · FastAPI · MongoDB · Docker · Linux · React',
    cta: {
      href: 'demo.html',
      label: 'Take demo ↗',
      target: '_blank'
    }
  },
  eng: {
    title: ['Operations on the floor.', 'Engineering behind it.'],
    sub: /*#__PURE__*/React.createElement(Fragment, null, "I\u2019m ", /*#__PURE__*/React.createElement("strong", null, "Saad"), " - ", /*#__PURE__*/React.createElement("strong", null, "Automation Engineer"), " with a software-first approach. I run and support Krones beverage production lines, coordinate operators during shifts, troubleshoot production issues, and build ERP / OEE / reporting tools around the production workflow. My strength is connecting factory operations with practical software systems: dashboards, batch records, downtime tracking, QC workflows, inventory visibility, and management reports."),
    stack: 'Krones line support · RCA · OEE tracking · GPON / PSTN',
    cta: {
      href: '#projects',
      label: 'See work →'
    }
  },
  code: {
    title: ['Software for operations.', 'Automation behind it.'],
    sub: /*#__PURE__*/React.createElement(Fragment, null, "I\u2019m ", /*#__PURE__*/React.createElement("strong", null, "Saad"), " - an ", /*#__PURE__*/React.createElement("strong", null, "Automation & Software Developer"), " focused on ERP systems, dashboards, backend tools, and web applications. I build software that replaces manual work - spreadsheets, paper logs, copy-paste reports, inventory tracking, admin panels, and business workflows - with automation that runs itself."),
    stack: 'Python · FastAPI · Java · Spring Boot · PostgreSQL · Docker · n8n · TypeScript',
    cta: {
      href: 'app/index.html',
      label: 'Launch live app ↗',
      target: '_blank'
    }
  }
};
function Hero({
  view,
  setView
}) {
  const copy = HERO_COPY[view] || HERO_COPY.all;
  return /*#__PURE__*/React.createElement("section", {
    className: "hero container",
    id: "top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hero-left"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, /*#__PURE__*/React.createElement("span", {
    className: "led"
  }), " Currently available in the UAE \xB7 Open to relocate worldwide"), /*#__PURE__*/React.createElement("div", {
    className: "view-toggle-wrap"
  }, /*#__PURE__*/React.createElement("span", {
    className: "view-toggle-hint"
  }, "Tailored for:"), /*#__PURE__*/React.createElement(ViewToggle, {
    view: view,
    setView: setView
  })), /*#__PURE__*/React.createElement("h1", {
    className: "hero-title view-fade",
    key: 't-' + view
  }, copy.title.map((line, i) => /*#__PURE__*/React.createElement("span", {
    className: "line",
    key: i
  }, /*#__PURE__*/React.createElement("span", null, i === copy.title.length - 1 ? /*#__PURE__*/React.createElement("span", {
    className: "grad"
  }, line) : line)))), /*#__PURE__*/React.createElement("p", {
    className: "hero-sub view-fade",
    key: 's-' + view
  }, copy.sub), /*#__PURE__*/React.createElement("div", {
    className: "hero-cta"
  }, /*#__PURE__*/React.createElement(MagneticBtn, {
    as: "a",
    href: "contact.html",
    className: "btn btn-primary"
  }, "Contact me ", /*#__PURE__*/React.createElement("span", {
    className: "arrow"
  }, "\u2192")), /*#__PURE__*/React.createElement("a", _extends({
    className: "btn btn-ghost view-fade",
    key: 'c-' + view,
    href: copy.cta.href
  }, copy.cta.target ? {
    target: copy.cta.target,
    rel: 'noopener'
  } : {}), copy.cta.label)), /*#__PURE__*/React.createElement("div", {
    className: "hero-meta"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "meta-k"
  }, "Currently"), /*#__PURE__*/React.createElement("span", {
    className: "meta-v"
  }, "Kingsley Beverage FZCO \xB7 Dubai")), /*#__PURE__*/React.createElement("div", {
    className: "view-fade",
    key: 'm-' + view
  }, /*#__PURE__*/React.createElement("span", {
    className: "meta-k"
  }, "Stack"), /*#__PURE__*/React.createElement("span", {
    className: "meta-v"
  }, copy.stack)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "meta-k"
  }, "Open to"), /*#__PURE__*/React.createElement("span", {
    className: "meta-v"
  }, "On-site \xB7 Hybrid \xB7 Remote")))), /*#__PURE__*/React.createElement("div", {
    className: "hero-right"
  }, /*#__PURE__*/React.createElement("figure", {
    className: "hero-photo"
  }, /*#__PURE__*/React.createElement("img", {
    src: "saad.png",
    width: "400",
    height: "500",
    loading: "eager",
    decoding: "async",
    alt: "Muhammad Saad - Automation & Software Developer, Dubai"
  }), /*#__PURE__*/React.createElement("figcaption", null, /*#__PURE__*/React.createElement("span", {
    className: "plate-no"
  }, "Plate 01"), " M. Saad \xB7 Automation & Software \xB7 Dubai, UAE"))));
}

/* =========================================================
   STATS
   ========================================================= */
const STATS_ALL = [{
  num: KINGSLEY.reportingSpeedup,
  suffix: '%',
  label: 'reduction in production reporting time',
  domain: 'code'
}, {
  num: KINGSLEY.departments,
  suffix: '',
  label: 'departments digitised through MES/ERP workflows',
  domain: 'code'
}, {
  num: 2,
  suffix: ' yrs',
  label: 'industrial & telecom-ops experience',
  domain: 'all'
}, {
  num: 7,
  suffix: '',
  label: 'Krones subsystems supported in production',
  domain: 'eng'
}, {
  num: 2,
  suffix: ' yrs',
  label: 'GPON / PSTN / broadband NOC operations',
  domain: 'eng'
}, {
  num: 6,
  suffix: '+ yrs',
  label: 'writing Python since university - projects, internships, production',
  domain: 'code'
}];
function Stat({
  s
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-num"
  }, s.suffix.includes('%') ? '~' : '', s.num.toLocaleString(), s.suffix), /*#__PURE__*/React.createElement("div", {
    className: "stat-lbl"
  }, s.label));
}
function Stats({
  view
}) {
  const list = STATS_ALL.filter(s => view === 'all' || s.domain === view || s.domain === 'all');
  return /*#__PURE__*/React.createElement("section", {
    className: "stats container",
    id: "stats"
  }, list.map(s => /*#__PURE__*/React.createElement(Stat, {
    key: s.label,
    s: s
  })));
}

/* =========================================================
   FAQ - long-tail keyword capture + FAQPage rich result
   ========================================================= */
const FAQ_ITEMS = [{
  q: 'Is Saad available for hire?',
  a: /*#__PURE__*/React.createElement(Fragment, null, "Yes - open to automation, backend, full-stack, ERP / MES, IT-operations, and NOC roles. ", AVAILABILITY, ", and available immediately. Reach out via the ", /*#__PURE__*/React.createElement("a", {
    href: "contact.html"
  }, "contact form"), ", email ", /*#__PURE__*/React.createElement("a", {
    href: "mailto:saad@saadm.dev"
  }, "saad@saadm.dev"), ", or WhatsApp ", /*#__PURE__*/React.createElement("a", {
    href: "https://wa.me/971502578065",
    target: "_blank",
    rel: "noopener"
  }, "+971 50 257 8065"), ".")
}, {
  q: 'What does the Kingsley MES / ERP platform do?',
  a: /*#__PURE__*/React.createElement(Fragment, null, "It replaces spreadsheets and paper across ", KINGSLEY.departments, " departments - production planning, QC, batch & expiry tracking, inventory with FIFO, dispatch, accounts, and Sage Evolution integration - with OEE monitoring and print-ready PDF reports generated server-side from live data. Saad designed, built, and runs it end-to-end (Python / FastAPI, MongoDB + SQL Server, Docker, nginx), cutting production reporting time by roughly ", KINGSLEY.reportingSpeedup, "%.")
}, {
  q: 'What is Saad\'s tech stack?',
  a: /*#__PURE__*/React.createElement(Fragment, null, "Python, FastAPI, Java, Spring Boot, MongoDB, PostgreSQL, JavaScript, React, Docker, Linux, nginx, Cloudflare, Git, REST APIs, JWT auth, Pandas, and Sage Evolution integration - comfortable across the full lifecycle from data-model design through deployment and ops.")
}, {
  q: 'Can I see Saad\'s code?',
  a: /*#__PURE__*/React.createElement(Fragment, null, "Yes - try the ", /*#__PURE__*/React.createElement("a", {
    href: "demo.html",
    target: "_blank",
    rel: "noopener"
  }, "interactive MES/ERP demo"), " (all data fabricated for privacy) and the live ", /*#__PURE__*/React.createElement("a", {
    href: "https://shopfloor-api-lvb0.onrender.com/",
    target: "_blank",
    rel: "noopener"
  }, "ShopFloor API"), " in Java / Spring Boot, plus the open-source ", /*#__PURE__*/React.createElement("a", {
    href: "https://github.com/saad-mughal435/n8n-nodes-devtools",
    target: "_blank",
    rel: "noopener"
  }, "n8n-nodes-devtools"), " automation node in TypeScript. Open source is on GitHub at ", /*#__PURE__*/React.createElement("a", {
    href: "https://github.com/saad-mughal435",
    target: "_blank",
    rel: "noopener"
  }, "github.com/saad-mughal435"), ".")
}];
function FAQ() {
  return /*#__PURE__*/React.createElement("section", {
    id: "faq",
    className: "section container"
  }, /*#__PURE__*/React.createElement(Reveal, {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-tag"
  }, "Appendix \u2014 FAQ"), /*#__PURE__*/React.createElement("h2", null, "About Muhammad Saad - engineering background, software delivery focus.")), /*#__PURE__*/React.createElement(Reveal, {
    stagger: true,
    className: "faq-list"
  }, FAQ_ITEMS.map((f, i) => /*#__PURE__*/React.createElement("details", {
    className: "faq-item",
    key: i,
    open: i === 0
  }, /*#__PURE__*/React.createElement("summary", null, f.q), /*#__PURE__*/React.createElement("div", {
    className: "faq-answer"
  }, f.a)))));
}

/* =========================================================
   ABOUT
   ========================================================= */
function About() {
  return /*#__PURE__*/React.createElement("section", {
    id: "about",
    className: "section container"
  }, /*#__PURE__*/React.createElement(Reveal, {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-tag"
  }, "Fig. 01 \u2014 About"), /*#__PURE__*/React.createElement("h2", null, /*#__PURE__*/React.createElement(WordReveal, null, "I sit between the factory floor and the keyboard."))), /*#__PURE__*/React.createElement("div", {
    className: "about-grid"
  }, /*#__PURE__*/React.createElement(Reveal, {
    className: "about-copy"
  }, /*#__PURE__*/React.createElement("p", null, "I\u2019m an ", /*#__PURE__*/React.createElement("strong", null, "Automation & Software Developer"), " at Kingsley Beverage FZCO in Dubai, where I\u2019m the sole developer of the MES/ERP platform running across the plant - and also work hands-on as", /*#__PURE__*/React.createElement("strong", null, " Automation Engineer"), " and ", /*#__PURE__*/React.createElement("strong", null, "IT Administrator"), ". My engineering background (B.Sc. Electrical / Computer Engineering, COMSATS Islamabad) lets me run and support the Krones beverage lines and troubleshoot production issues, then build the software ", /*#__PURE__*/React.createElement("em", null, "around"), " that workflow - the machine automation is OEM-locked, so my work is the OEE reporting, QC records, inventory, and management dashboards that sit on top of it."), /*#__PURE__*/React.createElement("p", null, "Before Kingsley I spent two years as a ", /*#__PURE__*/React.createElement("strong", null, "NOC Engineer at PTCL"), " on GPON / PSTN / broadband infrastructure, where I shipped a Python tool that auto-generated configuration scripts from tickets and removed hours of manual prep a day. The throughline: I look at slow, manual operational work and rebuild it in code - which is exactly the automation, backend, and ERP/MES work I want to keep doing.")), /*#__PURE__*/React.createElement(Reveal, {
    className: "aside-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "aside-card-head"
  }, "// quick facts"), /*#__PURE__*/React.createElement("dl", null, /*#__PURE__*/React.createElement("dt", null, "Location"), /*#__PURE__*/React.createElement("dd", null, "UAE-based \xB7 Open to relocate worldwide"), /*#__PURE__*/React.createElement("dt", null, "Education"), /*#__PURE__*/React.createElement("dd", null, "B.Sc. Electrical Engineering - Computer Engineering Major - COMSATS Islamabad (2024)"), /*#__PURE__*/React.createElement("dt", null, "Languages"), /*#__PURE__*/React.createElement("dd", null, "English (IELTS) \xB7 Urdu"), /*#__PURE__*/React.createElement("dt", null, "Open to"), /*#__PURE__*/React.createElement("dd", null, "On-site \xB7 Hybrid \xB7 Remote"), /*#__PURE__*/React.createElement("dt", null, "Status"), /*#__PURE__*/React.createElement("dd", null, /*#__PURE__*/React.createElement("span", {
    className: "led",
    style: {
      marginRight: 6
    }
  }), "Open to work")))));
}

/* =========================================================
   EXPERIENCE
   ========================================================= */
const EXPERIENCE = [{
  domain: 'all',
  title: 'Automation & Software Developer · ERP Developer · IT Administrator',
  when: 'Jul 2025 - Present',
  company: 'Kingsley Beverage FZCO · Dubai, UAE',
  points: [/*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Designed and shipped a full MES/ERP platform from scratch"), " across PPC, inventory, QC, accounts, production reporting, and Sage integration - sole developer, currently running in production."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Reduced production reporting time by an estimated ~60%"), " through automated OEE monitoring, batch tracking, PDF reports, and centralised workflows across ", /*#__PURE__*/React.createElement("strong", null, "5 departments"), "."), /*#__PURE__*/React.createElement(Fragment, null, "Administer the underlying stack end-to-end - ", /*#__PURE__*/React.createElement("em", null, "Linux VM, MongoDB, Sage integration, Cloudflare-fronted nginx"), ", user accounts, backups, and deployment."), /*#__PURE__*/React.createElement(Fragment, null, "Run and support the ", /*#__PURE__*/React.createElement("em", null, "Krones"), " beverage production lines, coordinate operators during shifts, and troubleshoot production issues across blow molding, filling, Checkmate inspection, Variopac FS packaging, palletizing, and PET preform handling. The Krones machine automation is OEM-locked; my work focuses on line support and the surrounding ERP / OEE / reporting workflows."), 'Support root-cause analysis and commissioning across interconnected line machines; author SOPs and operator instructions.']
}, {
  domain: 'all',
  title: 'NOC Engineer',
  when: 'Jul 2023 - Jul 2025',
  company: 'PTCL · Rawalpindi, Pakistan',
  points: [/*#__PURE__*/React.createElement(Fragment, null, "Backend operations for ", /*#__PURE__*/React.createElement("em", null, "GPON"), ", ", /*#__PURE__*/React.createElement("em", null, "PSTN"), ", and broadband network infrastructure at telecom scale."), /*#__PURE__*/React.createElement(Fragment, null, "Monitored national network performance via ", /*#__PURE__*/React.createElement("em", null, "SolarWinds NMS"), "; resolved faults using Huawei and Nokia tooling with minimal subscriber downtime."), /*#__PURE__*/React.createElement(Fragment, null, "Managed full incident lifecycle through ", /*#__PURE__*/React.createElement("em", null, "Oracle CRM"), "; partnered with the switching dept on PSTN migrations completed with zero outages."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Built a Python tool"), " that auto-generated PSTN configuration scripts from incoming tickets, removing manual prep work entirely and cutting provisioning time dramatically.")]
}, {
  domain: 'code',
  title: 'Freelance Designer & WordPress Developer',
  when: '2019 - Jul 2025',
  company: 'Fiverr · Remote',
  points: ['Delivered branding, graphics, and custom WordPress builds for international clients.', 'Managed multiple concurrent projects end-to-end - scoping, design, delivery.']
}, {
  domain: 'code',
  title: 'Machine Learning Intern',
  when: '2023',
  company: 'Omdena · Remote',
  points: [/*#__PURE__*/React.createElement(Fragment, null, "Contributed to ML models for ", /*#__PURE__*/React.createElement("em", null, "accessibility (vision-impaired navigation)"), " and ", /*#__PURE__*/React.createElement("em", null, "environmental monitoring (air-quality forecasting)"), " on global Omdena collaborations."), /*#__PURE__*/React.createElement(Fragment, null, "Built Python ML pipelines using ", /*#__PURE__*/React.createElement("em", null, "scikit-learn, NumPy, Pandas, Jupyter"), " as part of a globally distributed ", /*#__PURE__*/React.createElement("strong", null, "50+ contributor team"), " - data cleaning, feature engineering, training, evaluation.")]
}, {
  domain: 'eng',
  title: 'Technical Engineering Intern',
  when: 'Jun - Aug 2023',
  company: 'Kingsley Beverage FZCO · Dubai, UAE',
  points: ['First exposure to Krones machines; authored SOPs, work instructions, and quality manuals.', 'Troubleshot and resolved machine faults under supervision.']
}, {
  domain: 'eng',
  title: 'Network Engineering Intern',
  when: 'Jun - Aug 2022',
  company: 'PTCL · Rawalpindi, Pakistan',
  points: ['Maintained power systems, wireless communication, and switching equipment.', 'Contributed to a data center server migration with minimal disruption.']
}];
function Experience({
  view
}) {
  const items = EXPERIENCE.filter(e => view === 'all' || e.domain === view || e.domain === 'all');
  return /*#__PURE__*/React.createElement("section", {
    id: "experience",
    className: "section container"
  }, /*#__PURE__*/React.createElement(Reveal, {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-tag"
  }, "Fig. 02 \u2014 Experience"), /*#__PURE__*/React.createElement("h2", null, /*#__PURE__*/React.createElement(WordReveal, null, "A short career, but a wide one."))), /*#__PURE__*/React.createElement("ol", {
    className: "timeline"
  }, items.map((e, i) => /*#__PURE__*/React.createElement(Reveal, {
    as: "li",
    key: e.title + i,
    className: "t-item"
  }, /*#__PURE__*/React.createElement("div", {
    className: "t-marker"
  }), /*#__PURE__*/React.createElement("div", {
    className: "t-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "t-head"
  }, /*#__PURE__*/React.createElement("h3", null, e.title), /*#__PURE__*/React.createElement("span", {
    className: "t-when"
  }, e.when)), /*#__PURE__*/React.createElement("div", {
    className: "t-company"
  }, e.company), /*#__PURE__*/React.createElement("ul", {
    className: "t-points"
  }, e.points.map((p, j) => /*#__PURE__*/React.createElement("li", {
    key: j
  }, p))))))));
}

/* =========================================================
   PROJECTS
   ========================================================= */
const PROJECTS = [{
  domain: 'all',
  featured: true,
  kind: 'Production system · Live interactive demo',
  year: '2025 - Present',
  sectionEyebrow: 'Featured manufacturing system',
  sectionHeading: 'The platform behind the factory floor',
  sectionBlurb: 'Internal operations platform built around the beverage production workflow. Replaces Excel + paper across production planning, QC seam-check, batch tracking + expiry, inventory + FIFO, dispatch, accounts, Sage Evolution integration, OEE monitoring - plus 6 print-ready PDF document templates. Sole developer, end-to-end, running in production today at a beverage plant. The platform does not modify Krones machine automation; it digitises the surrounding work.',
  title: 'Kingsley MES / ERP / OEE Platform',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "An internal full-stack operations platform that ends manual workflows - spreadsheets, paper logs, copy-paste reports, ticket prep - across production planning, QC, batch tracking, inventory, dispatch, accounts, and Sage integration. The platform sits ", /*#__PURE__*/React.createElement("em", null, "around"), " the production line (Krones machine automation is locked OEM; this software digitises the operator-, QC-, stores-, and finance-side workflow).", /*#__PURE__*/React.createElement("strong", null, "Sole developer"), ", end-to-end, currently running in production. The \"Launch live app\" demo is interactive with the same UI and workflows - every value is fabricated for privacy but the structure is faithful to the real system."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "20+ integrated modules"), ": PPC \xB7 job orders \xB7 inventory \xB7 recipes/BOM \xB7 QC seam-check \xB7 batch & expiry tracking \xB7 dispatch \xB7 accounts \xB7 OEE \xB7 GRN \xB7 customs \xB7 Sage Evolution integration"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "6 print-ready PDF templates"), ": proforma invoice, packing list, picking sheet, batch report, GRN, recipe sheet - all generated server-side from live data"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Full stack ownership"), " (data model \u2192 API \u2192 UI \u2192 infra \u2192 deployment): Python/FastAPI service, MongoDB + SQL Server, React/vanilla JS frontends, Docker, Nginx, JWT auth with row-level RBAC"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "~60%"), " faster production reporting \xB7 ", /*#__PURE__*/React.createElement("strong", null, "5 departments"), " on one system \xB7 operators, QC, stores, finance and management each have their own workflow")],
  tags: ['Python', 'FastAPI', 'MongoDB', 'SQL Server', 'Docker', 'Nginx', 'TLS', 'JWT', 'RBAC', 'Sage Evolution', 'pandas', 'openpyxl', 'fpdf', 'OEE', 'Manufacturing'],
  ctaSubtitle: 'Live interactive demo - every value fabricated for privacy, every workflow faithful to the real system',
  ctaTip: /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Best first view:"), " open the ", /*#__PURE__*/React.createElement("em", null, "static walkthrough"), " for the 3-minute tour, then jump into the ", /*#__PURE__*/React.createElement("em", null, "live interactive demo"), "."),
  ctas: [{
    label: 'Launch live interactive demo ↗',
    href: 'app/index.html',
    target: '_blank',
    primary: true,
    prominent: true
  }, {
    label: 'Static walkthrough',
    href: 'demo.html',
    target: '_blank'
  }]
}, {
  domain: 'all',
  kind: 'Backend service · Live API · Open source · Java / Spring Boot',
  year: '2026',
  sectionEyebrow: 'Backend engineering',
  sectionHeading: 'The same operations domain, in Java & Spring Boot',
  sectionBlurb: 'A standalone REST backend that re-implements the manufacturing operations model - OEE, job orders, downtime, QC, FIFO inventory - in the enterprise Java stack. Open source, green CI, and deployed live with interactive Swagger docs you can click through.',
  title: 'ShopFloor API - MES / OEE backend',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A production-floor operations REST API in ", /*#__PURE__*/React.createElement("strong", null, "Spring Boot 3 / Java 21"), ": job orders that ", /*#__PURE__*/React.createElement("strong", null, "compute OEE"), " (Availability \xD7 Performance \xD7 Quality) on close, downtime with root-cause logging, QC holds, and ", /*#__PURE__*/React.createElement("strong", null, "FIFO inventory"), " across stock lots. Layered service architecture, role-based JWT security, and a Flyway-managed PostgreSQL schema validated against the JPA entities - with green CI and interactive Swagger docs."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "OEE engine"), " - unit-tested Availability \xD7 Performance \xD7 Quality, computed end-to-end when a job order closes"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Spring Security (JWT)"), " with operator / QC / manager roles enforced by ", /*#__PURE__*/React.createElement("code", null, "@PreAuthorize"), " method security"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "JPA + PostgreSQL + Flyway"), " (H2 demo profile); Hibernate ", /*#__PURE__*/React.createElement("em", null, "validate"), " keeps schema and entities in lockstep"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Tested + CI"), " - JUnit 5, MockMvc, and a Testcontainers PostgreSQL integration test; GitHub Actions runs ", /*#__PURE__*/React.createElement("code", null, "mvn verify"))],
  tags: ['Java 21', 'Spring Boot 3', 'Spring Data JPA', 'Spring Security', 'PostgreSQL', 'Flyway', 'JWT', 'OpenAPI / Swagger', 'JUnit 5', 'Testcontainers', 'Docker', 'GitHub Actions'],
  ctas: [{
    label: 'Open live demo ↗',
    href: 'https://shopfloor-api-lvb0.onrender.com/',
    target: '_blank',
    primary: true,
    prominent: true
  }, {
    label: 'View source on GitHub ↗',
    href: 'https://github.com/saad-mughal435/shopfloor-api',
    target: '_blank'
  }],
  ctaSubtitle: 'Live on a free instance - the first request after idle can take ~50s to wake. Log in with manager / password.'
}, {
  domain: 'code',
  kind: 'Test automation · Open source · CI',
  year: '2026',
  sectionEyebrow: 'Quality engineering',
  sectionHeading: 'Tested like production software',
  sectionBlurb: 'Automated quality gates for the work above: a Playwright suite drives this very site and the ShopFloor API across real browsers and devices, runs in GitHub Actions on every push and nightly, and doubles as a production uptime check.',
  title: 'playwright-e2e - Cross-browser test automation',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A ", /*#__PURE__*/React.createElement("strong", null, "Playwright + TypeScript"), " end-to-end suite that tests ", /*#__PURE__*/React.createElement("strong", null, "this portfolio"), "and the live ", /*#__PURE__*/React.createElement("strong", null, "ShopFloor API"), ". Browser specs cover load smoke, the React render, SEO / JSON-LD, navigation, the contact form, every project demo, and the Lahza PWA; API specs cover JWT auth and read-only domain endpoints - all green in CI across five browser and device targets."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Cross-browser + mobile"), " - Chromium, Firefox, WebKit, plus Pixel 7 and iPhone 14 emulation"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Browser + API testing"), " - DOM, SEO and PWA checks alongside read-only ShopFloor API auth and endpoint tests"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Accessibility"), " - axe-core WCAG 2.0 / 2.1 A & AA scan, gated on critical + serious issues"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "GitHub Actions CI"), " - every push, a nightly cron, and manual dispatch; uploads the HTML report")],
  tags: ['Playwright', 'TypeScript', 'E2E Testing', 'API Testing', 'axe-core / a11y', 'Cross-browser', 'GitHub Actions', 'CI'],
  ctas: [{
    label: 'View source on GitHub ↗',
    href: 'https://github.com/saad-mughal435/playwright-e2e',
    target: '_blank',
    primary: true,
    prominent: true
  }, {
    label: 'CI runs ↗',
    href: 'https://github.com/saad-mughal435/playwright-e2e/actions',
    target: '_blank'
  }],
  ctaSubtitle: 'Cross-browser E2E + API + accessibility - green in CI, runs nightly against production.'
}, {
  domain: 'all',
  kind: 'Open-source n8n node · TypeScript · CI-tested',
  year: '2026',
  sectionEyebrow: 'Automation & open-source tooling',
  sectionHeading: 'An open-source n8n node for workflow automation',
  sectionBlurb: 'A published n8n community node that packages the developer and crypto primitives workflows keep reaching for - JWT, hashing, IDs, conversions, regex - behind a clean Resource / Operation UI. The logic is kept pure and unit-tested with green CI; the kind of TypeScript tooling that turns up in real automation and integration work.',
  title: 'n8n-nodes-devtools - n8n community node',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A standalone ", /*#__PURE__*/React.createElement("strong", null, "n8n community node"), " in ", /*#__PURE__*/React.createElement("strong", null, "TypeScript"), " that bundles the utilities every real workflow reaches for: ", /*#__PURE__*/React.createElement("strong", null, "JWT sign / verify"), " (HS256/RS256, with", /*#__PURE__*/React.createElement("code", null, "exp"), " / ", /*#__PURE__*/React.createElement("code", null, "nbf"), " checks), hashing and ", /*#__PURE__*/React.createElement("strong", null, "HMAC"), ", UUID / Nano ID, JSON \u2194 CSV and base64, and ", /*#__PURE__*/React.createElement("strong", null, "regex extraction"), " with named groups. A programmatic ", /*#__PURE__*/React.createElement("code", null, "INodeType"), "over a framework-free core, so the behaviour is ", /*#__PURE__*/React.createElement("strong", null, "fully unit-tested"), " with green CI."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "JWT sign / verify"), " - HS256/384/512 + RS256; verification checks the signature and ", /*#__PURE__*/React.createElement("code", null, "exp"), " / ", /*#__PURE__*/React.createElement("code", null, "nbf"), " and lets you pin the accepted algorithms"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Hashing + IDs"), " - SHA-256/512 and keyed HMAC (hex or base64), UUID v4, and an unbiased Nano ID"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Convert + extract"), " - RFC 4180 JSON \u2194 CSV, base64, and regex with named capture groups"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Engineered as a sample"), " - pure logic split from the n8n glue, 20 Jest tests, ESLint (n8n rules), and a lint + build + test GitHub Actions CI")],
  tags: ['n8n', 'TypeScript', 'Node.js', 'n8n community node', 'JWT', 'HMAC / SHA-256', 'Jest', 'ESLint', 'GitHub Actions', 'JSON ↔ CSV', 'Regex'],
  ctas: [{
    label: 'View on npm ↗',
    href: 'https://www.npmjs.com/package/@saadmughal435/n8n-nodes-devtools',
    target: '_blank',
    primary: true,
    prominent: true
  }, {
    label: 'View source on GitHub ↗',
    href: 'https://github.com/saad-mughal435/n8n-nodes-devtools',
    target: '_blank'
  }, {
    label: 'CI runs ↗',
    href: 'https://github.com/saad-mughal435/n8n-nodes-devtools/actions',
    target: '_blank'
  }],
  ctaSubtitle: 'Published on npm · MIT · green CI — npm install @saadmughal435/n8n-nodes-devtools'
}, {
  domain: 'code',
  kind: 'C++17 library + CLI · Open source · CI',
  year: '2026',
  sectionEyebrow: 'Systems & C++',
  sectionHeading: 'Systems programming in C++',
  sectionBlurb: 'Four small, dependency-light C++17 repositories - modern CMake, unit tests (Catch2 fetched by CMake), and green GitHub Actions CI - spanning the operations, systems, networking, and industrial-protocol domains the rest of this portfolio covers.',
  title: 'oee-core - OEE & downtime analytics (C++17)',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "The same manufacturing-operations domain as my ShopFloor API, in modern C++. A library + CLI that computes ", /*#__PURE__*/React.createElement("strong", null, "OEE = Availability \xD7 Performance \xD7 Quality"), " with divide-by-zero guards and factor clamping, grades the result, and builds a ", /*#__PURE__*/React.createElement("strong", null, "Pareto of downtime"), " with MTTR / MTBF."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "OEE engine"), " - availability / performance / quality with over-speed clamping, unit-tested against the classic worked example (87.5% OEE)"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Downtime analytics"), " - reason-coded Pareto with MTTR and MTBF from a CSV of stop events"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Modern C++17 + CMake"), " - library, CLI and Catch2 tests; warnings-clean under ", /*#__PURE__*/React.createElement("code", null, "-Wall -Wextra -Wpedantic")), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Green CI"), " - GitHub Actions builds and runs ", /*#__PURE__*/React.createElement("code", null, "ctest"), " on every push")],
  tags: ['C++17', 'CMake', 'Catch2', 'GitHub Actions', 'OEE', 'Manufacturing', 'CLI'],
  ctas: [{
    label: 'View on GitHub ↗',
    href: 'https://github.com/saad-mughal435/oee-core',
    target: '_blank',
    primary: true,
    prominent: true
  }, {
    label: 'CI runs ↗',
    href: 'https://github.com/saad-mughal435/oee-core/actions',
    target: '_blank'
  }]
}, {
  domain: 'code',
  kind: 'C++17 header-only library · Open source · CI',
  year: '2026',
  title: 'threadpool - header-only C++17 thread pool',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A single-header thread pool: ", /*#__PURE__*/React.createElement("code", null, "submit(fn, args\u2026)"), " returns a ", /*#__PURE__*/React.createElement("code", null, "std::future"), ", exceptions propagate through ", /*#__PURE__*/React.createElement("code", null, "future.get()"), ", and the destructor ", /*#__PURE__*/React.createElement("strong", null, "drains the queue"), " so every submitted task completes. Classic mutex + condition-variable design."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Futures + perfect forwarding"), " - ", /*#__PURE__*/React.createElement("code", null, "submit"), " returns ", /*#__PURE__*/React.createElement("code", null, "std::future<result>"), " via ", /*#__PURE__*/React.createElement("code", null, "packaged_task")), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Exception-safe"), " - a throwing task rethrows from ", /*#__PURE__*/React.createElement("code", null, "get()"), "; copy/assignment disabled"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Graceful shutdown"), " - drain-on-destruct guarantee, covered by a test"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Tested"), " - result delivery, 1000-task throughput, parallel range-sum and exception propagation")],
  tags: ['C++17', 'Concurrency', 'std::future', 'Header-only', 'CMake', 'Catch2', 'GitHub Actions'],
  ctas: [{
    label: 'View on GitHub ↗',
    href: 'https://github.com/saad-mughal435/threadpool',
    target: '_blank',
    primary: true,
    prominent: true
  }, {
    label: 'CI runs ↗',
    href: 'https://github.com/saad-mughal435/threadpool/actions',
    target: '_blank'
  }]
}, {
  domain: 'code',
  kind: 'C++17 CLI + library · Open source · CI',
  year: '2026',
  title: 'netlat - TCP connect-latency probe',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A NOC-style reachability / latency tool from my networking background. It times the TCP handshake to a ", /*#__PURE__*/React.createElement("code", null, "host:port"), " over N samples and reports ", /*#__PURE__*/React.createElement("strong", null, "min / avg / p50 / p95 / p99 / max"), " plus jitter, using a ", /*#__PURE__*/React.createElement("strong", null, "non-blocking connect with a select() timeout"), " so dead hosts fail fast."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Non-blocking connect + select() timeout"), " over POSIX sockets - no hanging on unreachable hosts"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Latency statistics"), " - nearest-rank percentiles (p50 / p95 / p99), mean and jitter (std-dev)"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Tested"), " - the stats maths plus a real probe against a loopback listener and a refused port"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "C++17 + CMake + CI"), " - library, CLI, Catch2 tests, GitHub Actions")],
  tags: ['C++17', 'POSIX sockets', 'TCP', 'Networking', 'CMake', 'Catch2', 'GitHub Actions'],
  ctas: [{
    label: 'View on GitHub ↗',
    href: 'https://github.com/saad-mughal435/netlat',
    target: '_blank',
    primary: true,
    prominent: true
  }, {
    label: 'CI runs ↗',
    href: 'https://github.com/saad-mughal435/netlat/actions',
    target: '_blank'
  }]
}, {
  domain: 'code',
  kind: 'C++17 library + CLI · Open source · CI',
  year: '2026',
  title: 'modbus-codec - Modbus RTU/TCP frame codec',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "An industrial-protocol codec from my automation background. It encodes and decodes ", /*#__PURE__*/React.createElement("strong", null, "Modbus RTU"), " (serial, CRC-16 checked) and ", /*#__PURE__*/React.createElement("strong", null, "Modbus TCP"), " (MBAP header) frames, with helpers for the common function codes and exception responses - the fieldbus behind PLCs, drives and building-automation gear."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "CRC-16/MODBUS"), " - validated against the canonical ", /*#__PURE__*/React.createElement("code", null, "0x4B37"), " check value"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "RTU + TCP framing"), " - encode / decode with CRC and MBAP-length validation"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Function-code helpers"), " - build / parse read requests (0x01-0x04), register responses, and exception detection"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Pure logic, tested"), " - no I/O; Catch2 round-trip and rejection tests, green CI")],
  tags: ['C++17', 'Modbus RTU', 'Modbus TCP', 'CRC-16', 'Industrial', 'CMake', 'Catch2', 'GitHub Actions'],
  ctas: [{
    label: 'View on GitHub ↗',
    href: 'https://github.com/saad-mughal435/modbus-codec',
    target: '_blank',
    primary: true,
    prominent: true
  }, {
    label: 'CI runs ↗',
    href: 'https://github.com/saad-mughal435/modbus-codec/actions',
    target: '_blank'
  }]
}];

/* Product demos — shown after Skills as a 3-column grid (compact cards). */
const DEMO_PROJECTS = [{
  domain: 'code',
  kind: 'Disconnected demo · Portfolio piece',
  year: '2026',
  title: 'Anvil Supply Co. - B2B wholesale portal',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A wholesale/industrial portal with tier pricing, MOQs, contract discounts, quote requests, and an approval workflow for large orders. Multi-user accounts with purchaser / approver / viewer roles, recurring orders, statements view, and a data-dense admin panel with quote queue and approval queue."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, "Tier pricing (1/10/50/100), MOQ enforcement, customer contract discounts"), /*#__PURE__*/React.createElement(Fragment, null, "Quote request workflow + approval workflow for orders over $1,000"), /*#__PURE__*/React.createElement(Fragment, null, "Multi-user accounts (purchaser / approver / viewer), bulk SKU paste add"), /*#__PURE__*/React.createElement(Fragment, null, "Admin: order queue, quote queue, approval queue, customers, analytics")],
  tags: ['HTML5', 'CSS Grid', 'Vanilla JS (ES6+)', 'Tier pricing', 'Approval workflow', 'Role-based UI', 'Bulk SKU paste', 'Admin dashboard', 'Mock API'],
  ctas: [{
    label: 'Open portal ↗',
    href: 'b2b/index.html',
    target: '_blank',
    primary: true
  }, {
    label: 'Open admin ↗',
    href: 'b2b/admin.html',
    target: '_blank'
  }]
}, {
  domain: 'code',
  kind: 'Disconnected demo · Portfolio piece',
  year: '2026',
  title: 'Manzil Properties - Dubai marketplace',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A Dubai real-estate marketplace demo: 65+ listings, map-and-list search on Leaflet/OpenStreetMap, agent and agency profiles, a mortgage calculator with full amortisation, and a 15-section admin panel - plus a 6-step owner listing wizard feeding a verification queue."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, "10 customer pages: home, search (list/map), listing detail, agents, agencies, areas, mortgage, compare, account"), /*#__PURE__*/React.createElement(Fragment, null, "Map view with price-labelled pins, hover sync with list, single-pin detail map"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Owner-side: 6-step listing wizard"), " (save-and-resume drafts, map-pin selector, transaction-type branching for buy/rent/off-plan, document upload - Emirates ID + Title Deed + DLD permit + NOC + IBAN) feeding an ", /*#__PURE__*/React.createElement("strong", null, "admin verification queue"), " with approve / request-changes / reject"), /*#__PURE__*/React.createElement(Fragment, null, "15-section admin SPA: dashboard, listings, inquiries pipeline, viewings calendar, agents, agencies, customers, analytics, promotions, content CMS, moderation, settings, audit, ", /*#__PURE__*/React.createElement("strong", null, "owner approvals, listing approvals")), /*#__PURE__*/React.createElement(Fragment, null, "AED/USD/GBP/EUR currency switcher, EN/AR locale toggle with RTL layout")],
  tags: ['HTML5', 'CSS Grid', 'Vanilla JS (ES6+)', 'Owner onboarding wizard', 'Document upload', 'Verification queue', 'Leaflet · OpenStreetMap', 'localStorage', 'Mock API', 'Hash-routed SPA', 'i18n EN/AR', 'Multi-currency'],
  ctas: [{
    label: 'Open marketplace ↗',
    href: 'property/index.html',
    target: '_blank',
    primary: true
  }, {
    label: 'List a property ↗',
    href: 'property/owner-onboard.html',
    target: '_blank'
  }, {
    label: 'Open admin ↗',
    href: 'property/admin.html',
    target: '_blank'
  }]
}, {
  domain: 'code',
  kind: 'Disconnected demo · Portfolio piece',
  year: '2026',
  title: 'Vacation Homes - UAE short-stay booking',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A UAE short-stay booking marketplace demo: 55 homes across 10 destinations, a hand-rolled date-range picker and availability calendar with conflict-check, per-night pricing with weekend surcharge and 5% VAT, and a 13-section admin SPA - plus a host listing wizard with a manual approval queue."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, "Hand-rolled ", /*#__PURE__*/React.createElement("strong", null, "date-range picker"), " + availability calendar (no library) with blocked / booked / available states"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Conflict-check booking flow"), ": POST /bookings returns 409 if dates were just taken; UI bounces back with a toast"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Host-side: 6-step listing wizard"), " (save-and-resume drafts, map-pin selector, document upload - Emirates ID + ownership + DTCM permit + IBAN) feeding an ", /*#__PURE__*/React.createElement("strong", null, "admin verification queue"), " for manual approval; listings stay off-market until live"), /*#__PURE__*/React.createElement(Fragment, null, "9 guest pages + 13-section admin SPA + host dashboard: dashboard, listings (CRUD + bulk + status pipeline + CSV), bookings, hosts (Superhost verify), guests, reviews, payments/payouts, promotions, destinations, ", /*#__PURE__*/React.createElement("strong", null, "host approvals + listing approvals (approve / request-changes / reject)"), ", settings, audit"), /*#__PURE__*/React.createElement(Fragment, null, "Full pricing breakdown: nightly subtotal \xD7 nights + weekend surcharge + cleaning + 10% service fee + 5% VAT")],
  tags: ['HTML5', 'CSS Grid', 'Vanilla JS (ES6+)', 'Multi-step wizard', 'Document upload', 'Verification queue', 'Custom date-range picker', 'Leaflet maps', 'localStorage', 'Mock API', 'Hash-routed SPA'],
  ctas: [{
    label: 'Open marketplace ↗',
    href: 'vacation/index.html',
    target: '_blank',
    primary: true
  }, {
    label: 'List a property ↗',
    href: 'vacation/host-onboard.html',
    target: '_blank'
  }, {
    label: 'Open admin ↗',
    href: 'vacation/admin.html',
    target: '_blank'
  }]
}, {
  domain: 'code',
  kind: 'Disconnected demo · Portfolio piece',
  year: '2026',
  title: 'Qahwa POS - café & quick-service POS',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A caf\xE9 and quick-service point-of-sale demo covering the in-person retail / F&B vertical. Touch cashier terminal with PIN auth, kitchen display system with audio chime on new tickets, and a 14-section admin SPA for the back office. ~5,000 LOC, vanilla JS, all writes in localStorage - reset to seed any time from Settings."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Touch cashier terminal"), ": PIN lock, category grid + product search, modifier modal (size / milk / syrup / extras with per-option price deltas), cart with qty steppers, cash / card / split payment with change calculator"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Kitchen Display System"), ": 5-second polling, big card layout with elapsed-time warnings (amber > 5 min, red > 8 min), per-line ready checkboxes, Web Audio chime when a new ticket arrives"), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "14-section admin SPA"), ": dashboard with hourly heatmap + weekly bars + top products + payment breakdown, live orders pipeline with refund flow, products CRUD + bulk + modifier-group multi-link, categories, modifiers, discounts, tables floor plan, staff RBAC, shifts with cash-denomination count + variance + printable Z-report, reports with CSV export, inventory with recipe-based deduction, receipt template with live preview, settings, audit log"), /*#__PURE__*/React.createElement(Fragment, null, "Full order state machine (open \u2192 kitchen \u2192 ready \u2192 served \u2192 completed, plus refunded / held / voided) over a fetch interceptor serving ", /*#__PURE__*/React.createElement("code", null, "/pos/api/*"))],
  tags: ['HTML5', 'CSS Grid', 'Vanilla JS (ES6+)', 'PIN auth', 'Touch UI', 'KDS polling', 'Web Audio API', 'Mock API (fetch shim)', 'localStorage', 'Hash-routed SPA', 'Cash-drawer Z-report'],
  ctas: [{
    label: 'Open POS ↗',
    href: 'pos/index.html',
    target: '_blank',
    primary: true
  }, {
    label: 'Cashier terminal ↗',
    href: 'pos/terminal.html',
    target: '_blank'
  }, {
    label: 'Kitchen display ↗',
    href: 'pos/kitchen.html',
    target: '_blank'
  }, {
    label: 'Open admin ↗',
    href: 'pos/admin.html',
    target: '_blank'
  }]
}, {
  domain: 'code',
  kind: 'Disconnected demo · Portfolio piece',
  year: '2026',
  title: 'Sanad - AI customer-support copilot',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A SaaS-style helpdesk with Claude integrated at every touchpoint. Built to demonstrate ", /*#__PURE__*/React.createElement("strong", null, "real LLM wiring"), " end-to-end \u2014 system prompts, streaming, prompt caching, server-side key handling via a Cloudflare Worker proxy, graceful mock fallback when the key isn't set, and cost tracking \u2014 not just an OpenAI playground demo. Works offline in deterministic mock mode out of the box."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Agent inbox with AI sidebar"), ": suggested reply (with KB citations), conversation summary, sentiment, auto-category, EN\u2194AR translation, AI-drafted quick-action reasons. Click \"Insert\" to push the AI's draft into the composer."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Customer chat widget"), ": streaming AI replies grounded in the knowledge base with clickable citation chips. \"Talk to a human\" creates a real ticket in the agent inbox."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Knowledge base"), ": 77 articles in 6 categories, tiny custom markdown renderer, admin-only AI actions per article (", /*#__PURE__*/React.createElement("em", null, "Generate FAQ"), ", ", /*#__PURE__*/React.createElement("em", null, "Suggest improvements"), ", ", /*#__PURE__*/React.createElement("em", null, "Translate to Arabic"), "), plus a \"Find gaps\" feature that clusters recent tickets and proposes new articles."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "11-section admin SPA"), ": dashboard with sentiment split + hourly heatmap + AI-cost ticker, conversations, KB CRUD, categories, agents with permission matrix, customers, ", /*#__PURE__*/React.createElement("strong", null, "AI Console"), " (model selector Haiku 4.5 / Sonnet 4.6 / Opus 4.7, editable system prompt with test-with-sample preview, temperature / max-tokens / cache toggles), analytics (daily volume, by-category, fallback rate, latency, cost, CSV export), integrations, settings, audit log."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Live + mock modes"), ": detects whether a Cloudflare Worker proxy with ANTHROPIC_API_KEY is configured via ", /*#__PURE__*/React.createElement("code", null, "GET /api/sanad/ai/health"), " and shows a Live/Demo badge in the topbar. Every feature gracefully falls back to a deterministic pattern-matched mock when no key is set \u2014 the demo never breaks for visitors.")],
  tags: ['Vanilla JS (ES6+)', 'Claude API', 'CF Worker proxy', 'RAG (lite)', 'Streaming', 'Prompt caching', 'Server-side keys', 'Mock fallback', 'EN/AR i18n', 'localStorage'],
  ctas: [{
    label: 'Open inbox ↗',
    href: 'sanad/inbox.html',
    target: '_blank',
    primary: true
  }, {
    label: 'Try chat widget ↗',
    href: 'sanad/chat.html',
    target: '_blank'
  }, {
    label: 'Help centre ↗',
    href: 'sanad/kb.html',
    target: '_blank'
  }, {
    label: 'Open admin ↗',
    href: 'sanad/admin.html',
    target: '_blank'
  }]
}, {
  domain: 'code',
  kind: 'Disconnected demo · Portfolio piece',
  year: '2026',
  title: 'Watad - smart-building / BMS operations console',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A live operator console for a commercial smart building \u2014 the kind of software Imdaad / EFS / Schneider / Honeywell ship to facilities teams. Live SVG floor plan with HVAC, lighting, metering and sensor equipment plotted as icons, a simulated BACnet/Modbus telemetry stream (5-second tick mutating ~200 points plausibly per asset class + outdoor temp + occupancy), severity-sorted alarm queue with audio cues, predictive-maintenance work orders, ASHRAE-overlaid energy curves, and an industrial-AI copilot. The ", /*#__PURE__*/React.createElement("strong", null, "first portfolio demo with a real-time data shape"), " \u2014 proves I can think beyond REST."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Live SVG floor plan"), " \xB7 4 floors, 48 assets at absolute pixel coordinates. Equipment icons pulse red when their associated point is in alarm. Click any chiller / AHU / FCU / light / meter to drill into a 24h overlaid trend chart."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Real-time telemetry simulator"), " \xB7 ~200 points across the building, 5-second tick, plausible values per asset class (chiller load tracks outdoor temp, FCU zone temp drifts when occupied, sub-meters accumulate kWh), 288-sample history buffer per point regenerated from a seeded RNG so charts always look populated."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Alarm management"), " \xB7 severity ranks (info / warning / urgent / critical), audio cue on new urgent/critical, Acknowledge / Create-WO / \u2726 AI-explain actions per alarm card. Rule editor in admin."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Energy + sustainability"), " \xB7 30-day daily kWh bar chart with ASHRAE 90.1 reference band overlay, sub-meter breakdown with % of total + trend, DEWA DSM demand-response opt-in panel, kgCO\u2082 tile using UAE grid factor."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "10-section admin SPA"), " \xB7 Dashboard (KPIs + 7-day energy bars + alarms-by-hour heatmap + top alarming assets), Assets, Points (with live current value column), Alarms (full audit + filters), Schedules, Work orders, Staff (RBAC), Integrations (BACnet / Modbus / DALI / MQTT / Maximo / ServiceNow), AI Console (model selector + system prompt + test-with-sample), Settings + Audit."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "3 BMS-tuned AI features"), " \xB7 ", /*#__PURE__*/React.createElement("em", null, "Explain alarm"), " returns Action + Likely cause grounded in point values; ", /*#__PURE__*/React.createElement("em", null, "Suggest maintenance"), " proposes preventive tasks ranked by priority with AED estimates; ", /*#__PURE__*/React.createElement("em", null, "Optimise setpoints"), " reads occupancy + outdoor temp + current setpoints and proposes setpoint/schedule changes with estimated AED savings. Live Claude when a Worker proxy is configured; deterministic mock fallback otherwise.")],
  tags: ['Vanilla JS (ES6+)', 'CSS Grid', 'SVG floor plan', 'Real-time telemetry sim', 'BACnet/Modbus (simulated)', 'Web Audio API', 'Claude API', 'CF Worker proxy', 'ASHRAE 90.1 band', 'localStorage', 'Mock fallback'],
  ctas: [{
    label: 'Open console ↗',
    href: 'watad/console.html',
    target: '_blank',
    primary: true
  }, {
    label: 'Energy dashboard ↗',
    href: 'watad/energy.html',
    target: '_blank'
  }, {
    label: 'Work orders ↗',
    href: 'watad/workorders.html',
    target: '_blank'
  }, {
    label: 'Open admin ↗',
    href: 'watad/admin.html',
    target: '_blank'
  }]
}, {
  domain: 'code',
  kind: 'Mobile · PWA · Portfolio piece',
  year: '2026',
  title: 'Lahza - AI journaling + mood tracking (mobile-first PWA)',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A mobile-shaped ", /*#__PURE__*/React.createElement("strong", null, "Progressive Web App"), " built to demonstrate mobile-product thinking and a new AI integration domain (consumer wellness). On desktop it renders inside a stylised iPhone frame; on mobile it's fullscreen and edge-to-edge; installed to a home screen it opens as a standalone window with no browser chrome. One AI-suggested prompt a day, a few sentences, and Claude surfaces the mood + themes + patterns across the week \u2014 same Cloudflare Worker pattern as the other AI demos."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "PWA installable"), " on iOS, Android, and desktop via \"Add to Home Screen\". No App Store, no native compilation. Custom service worker scoped to ", /*#__PURE__*/React.createElement("code", null, "/lahza/"), " only."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "4 AI features"), " \xB7 ", /*#__PURE__*/React.createElement("em", null, "Suggest prompt"), " (time-of-day + mood aware), ", /*#__PURE__*/React.createElement("em", null, "Detect mood"), " (returns structured JSON of mood + emotions from the entry text), ", /*#__PURE__*/React.createElement("em", null, "Weekly insights"), " (RAG over the last 7 entries, themes + wins + concerns), ", /*#__PURE__*/React.createElement("em", null, "AI Coach chat"), " (RAG over the last 14 entries, citation chips that open the cited entry in a bottom sheet)."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "7 mobile views"), " \xB7 Onboarding (3-card swipe), Today (AI prompt + streak ring + recent strip), Compose (full-screen modal with mood emoji picker), Journal (chronological feed with mood filter chips), Insights (7-day mood SVG chart + theme tags + AI summary), AI Coach chat, Profile (locale EN/AR, theme, export-JSON, reset)."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Privacy by default"), " \xB7 entries live in ", /*#__PURE__*/React.createElement("code", null, "localStorage"), " only. In Live AI mode, only the active question is sent to Claude via the Worker proxy."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "14-day fabricated seed"), " from a deterministic RNG so first-time visitors see a populated mood chart, recent feed, and themes without waiting two weeks."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Fourth AI demo"), " in the portfolio after Sanad (helpdesk), Watad (operations) and Ask Saad (recruiter Q&A) \u2014 same Worker, same encrypted-secret pattern, four products.")],
  tags: ['Vanilla JS (ES6+)', 'PWA', 'Service Worker', 'Web App Manifest', 'Mobile-first', 'CSS Grid', 'SVG chart', 'Claude API', 'CF Worker proxy', 'RAG', 'localStorage', 'Mock fallback', 'i18n EN/AR'],
  ctas: [{
    label: 'Open app ↗',
    href: 'lahza/',
    target: '_blank',
    primary: true
  }, {
    label: 'AI Coach ↗',
    href: 'lahza/#coach',
    target: '_blank'
  }, {
    label: 'Insights ↗',
    href: 'lahza/#insights',
    target: '_blank'
  }]
}, {
  domain: 'code',
  kind: 'Disconnected demo · Portfolio piece',
  year: '2026',
  title: 'Marsad - fleet / logistics dispatcher console',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A live ", /*#__PURE__*/React.createElement("strong", null, "dispatcher console for a Dubai last-mile courier"), ". 16 drivers, 12 vans + 4 motorbikes, 96 in-flight orders across 6 service zones (Marina, JLT, Downtown, Business Bay, Deira, Sharjah Al Nahda). Real Leaflet map with vehicle pins that tick toward their next drop every 4 seconds. The fleet simulator + AI dispatcher copilot are the technical differentiators \u2014 recognisably the same shape Aramex / Noon Express / Talabat run internally."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Live map with real coordinates"), " \xB7 Leaflet + Carto dark tiles, real Dubai lat/lng. Vehicle pins move toward their assigned drop-off \xB7 order pins flip green on delivery \xB7 audio chime on SLA breach."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Real-time fleet simulator"), " \xB7 4-second tick \xB7 96 orders + 16 vehicles \xB7 plausible movement (vehicles head toward their next drop, deliver within 120m, then pick the next assignment). Pure JS, no map provider beyond tiles."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "4 AI dispatcher features"), " \xB7 ", /*#__PURE__*/React.createElement("em", null, "Explain delay"), " for any order (cites real cause + recommends action), ", /*#__PURE__*/React.createElement("em", null, "Suggest reroute"), " to re-sequence a driver's stops by SLA deadline, ", /*#__PURE__*/React.createElement("em", null, "Batch-assign"), " pending orders across idle drivers, ", /*#__PURE__*/React.createElement("em", null, "Dispatcher chat"), " conversational copilot grounded in live fleet state."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Driver-side view"), " \xB7 simplified mobile-shaped UI for the driver \u2014 current job \xB7 route \xB7 COD pill \xB7 complete / handover buttons \xB7 today's earnings \xB7 streak. Switch drivers via top-right picker."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "9-section admin SPA"), " \xB7 Dashboard (KPIs + top zones + driver leaderboard), Orders (filter + search), Drivers, Vehicles (with fuel + last-ping), Zones, Integrations (Shopify \xB7 Twilio \xB7 Google Maps \xB7 QuickBooks), AI Console, Settings, Audit log."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "UAE-shaped business logic"), " \xB7 per-zone SLAs (Marina 90 min \xB7 Sharjah 150 min) \xB7 COD up to AED 500 \xB7 WPS-style driver compensation \xB7 Sheikh Mohammed Bin Zayed Road traffic context in the AI replies.")],
  tags: ['Vanilla JS (ES6+)', 'Leaflet + OpenStreetMap', 'Real-time sim', 'CSS Grid', 'Web Audio API', 'Claude API', 'CF Worker proxy', 'Mock fallback', 'RAG', 'localStorage'],
  ctas: [{
    label: 'Open dispatcher ↗',
    href: 'marsad/console.html',
    target: '_blank',
    primary: true
  }, {
    label: 'Driver view ↗',
    href: 'marsad/driver.html',
    target: '_blank'
  }, {
    label: 'Open admin ↗',
    href: 'marsad/admin.html',
    target: '_blank'
  }]
}, {
  domain: 'code',
  kind: 'Disconnected demo · Portfolio piece',
  year: '2026',
  title: 'Nabta - UAE HR + payroll SaaS',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A modern ", /*#__PURE__*/React.createElement("strong", null, "UAE-shaped HRIS"), ": 32 employees across 5 departments, leave management with line-manager + HR approval, ", /*#__PURE__*/React.createElement("strong", null, "WPS-compliant payroll runs"), " through Emirates NBD, recruitment kanban, performance review cycle, and a Claude-powered HR policy assistant grounded in the company handbook + UAE Labour Law (Federal Decree-Law No. 33 of 2021). The kind of software every Dubai / Abu Dhabi mid-size company actually runs but typically buys (Bayzat / GulfTalent / Zimyo) rather than builds."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Employees module"), " \xB7 32 employees with full UAE-specific fields (Emirates ID, passport, visa expiry, IBAN, base + allowances) \xB7 filter by department / status \xB7 per-employee profile sheet with leave balance."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Leave management"), " \xB7 7 leave types (Annual, Sick, Maternity, Paternity, Unpaid, Compassionate, Hajj/Umrah) \xB7 pending \u2192 approved / rejected workflow \xB7 line-manager + HR sign-off \xB7 per-employee balance tracking (30 annual + 15 sick per UAE Labour Law)."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "WPS payroll runs"), " \xB7 6 months of historical runs + current draft \xB7 per-employee breakdown (base + allowances \u2212 deductions = net) \xB7 \"Generate WPS SIF + Finalize\" flow \xB7 pay-day 28th via Emirates NBD."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Recruitment kanban"), " \xB7 4 open roles \xB7 22 candidates \xB7 lead / applied / interview / offer / hired stages \xB7 source tracking \xB7 rating \xB7 expected salary range."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "Performance reviews"), " \xB7 Q2-2026 cycle in flight \xB7 12 reviews across status (not started / in progress / submitted) \xB7 rating + goals-met %."), /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("strong", null, "AI policy assistant"), " \xB7 Claude grounded in 6 HR policies (leave, WPS, visa, gratuity, probation, remote) + UAE Labour Law. Every reply cites the specific policy by ", /*#__PURE__*/React.createElement("code", null, "[pol-xxx]"), ". Click a citation chip \u2192 opens the source policy.")],
  tags: ['Vanilla JS (ES6+)', 'CSS Grid', 'Hash-routed SPA', 'localStorage', 'Mock API (fetch shim)', 'Claude API', 'CF Worker proxy', 'RAG (policy KB)', 'Mock fallback', 'UAE WPS', 'UAE Labour Law 2021'],
  ctas: [{
    label: 'Open app ↗',
    href: 'nabta/app.html',
    target: '_blank',
    primary: true
  }, {
    label: 'Run payroll ↗',
    href: 'nabta/app.html#payroll',
    target: '_blank'
  }, {
    label: 'AI policy assistant ↗',
    href: 'nabta/app.html#ai_chat',
    target: '_blank'
  }]
}, {
  domain: 'code',
  kind: 'Disconnected demo · Portfolio piece',
  year: '2026',
  title: 'Pebble & Co. - DTC storefront',
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A full direct-to-consumer storefront built end-to-end as a portfolio piece - storefront, catalog, product detail, cart, multi-step checkout, customer account, and a Shopify-style admin panel with dashboard / orders / products / customers / promotions / analytics. Mock API runs entirely in-browser."),
  bullets: [/*#__PURE__*/React.createElement(Fragment, null, "Storefront + catalog + filters + product detail + cart + multi-step checkout"), /*#__PURE__*/React.createElement(Fragment, null, "Customer account: orders, wishlist, addresses, loyalty points"), /*#__PURE__*/React.createElement(Fragment, null, "Shopify-style admin: dashboard, orders, products, customers, promotions, analytics"), /*#__PURE__*/React.createElement(Fragment, null, "In-browser notifications (toast + bell + email log + demo event ticker)")],
  tags: ['HTML5', 'CSS Grid', 'Vanilla JS (ES6+)', 'localStorage', 'Mock API (fetch+XHR shim)', 'Multi-step checkout', 'Admin dashboard', 'Design system'],
  ctas: [{
    label: 'Open storefront ↗',
    href: 'b2c/index.html',
    target: '_blank',
    primary: true
  }, {
    label: 'Open admin ↗',
    href: 'b2c/admin.html',
    target: '_blank'
  }]
}, {
  domain: 'code',
  kind: 'Internal Tool',
  year: '2023 - 2025',
  title: 'PSTN Config Auto-Generator',
  desc: 'Python tool that ingested PTCL service-tickets and emitted ready-to-run configuration scripts using a structured database of area codes, number ranges, and network parameters.',
  bullets: ['Eliminated manual ticket prep', 'Faster provisioning + lower error rate', 'Zero-outage PSTN migrations'],
  tags: ['Python', 'SQLite', 'Templates', 'Telecom']
}, {
  domain: 'code',
  kind: 'Open Collaboration',
  year: '2023',
  title: 'Omdena - AI for Accessibility',
  desc: 'Contributed to ML models for accessibility applications and environmental monitoring on a global Omdena collaboration - data, training, evaluation, deployment.',
  bullets: ['Hands-on model training & evaluation', 'Worked in a distributed contributor team'],
  tags: ['scikit-learn', 'NumPy', 'Pandas']
}];
function ProjectCard({
  p,
  compact
}) {
  // compact = slider card: summary + tags + links (the bullet detail lives on
  // each demo's own page), so the row of demos stays scannable.
  return /*#__PURE__*/React.createElement(TiltCard, {
    tag: "article",
    intensity: compact ? 4 : 5,
    className: 'project' + (p.featured ? ' featured' : '') + (compact ? ' demo-slide' : '')
  }, /*#__PURE__*/React.createElement("div", {
    className: "project-meta"
  }, /*#__PURE__*/React.createElement("span", {
    className: "project-kind"
  }, p.kind), /*#__PURE__*/React.createElement("span", {
    className: "project-year"
  }, p.year)), /*#__PURE__*/React.createElement("h3", {
    className: "project-title"
  }, p.title), /*#__PURE__*/React.createElement("p", {
    className: "project-desc"
  }, p.desc), !compact && /*#__PURE__*/React.createElement("ul", {
    className: "project-bullets"
  }, p.bullets.map((b, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, b))), /*#__PURE__*/React.createElement("div", {
    className: "project-tags"
  }, p.tags.map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    className: "tag"
  }, t))), p.ctas && /*#__PURE__*/React.createElement("div", {
    className: "project-cta"
  }, p.ctas.map(c => /*#__PURE__*/React.createElement("a", _extends({
    key: c.label,
    href: c.href,
    className: 'btn ' + (c.primary ? 'btn-primary' : 'btn-ghost') + (c.prominent ? ' btn-prominent' : '')
  }, c.target ? {
    target: c.target,
    rel: 'noopener'
  } : {}), c.label)), !compact && p.ctaSubtitle && /*#__PURE__*/React.createElement("div", {
    className: "cta-subtitle"
  }, p.ctaSubtitle), !compact && p.ctaTip && /*#__PURE__*/React.createElement("div", {
    className: "cta-tip"
  }, p.ctaTip)));
}
function Projects({
  view
}) {
  const items = PROJECTS.filter(p => view === 'all' || p.domain === view || p.domain === 'all');
  return /*#__PURE__*/React.createElement("section", {
    id: "projects",
    className: "section container"
  }, /*#__PURE__*/React.createElement(Reveal, {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-tag"
  }, "Fig. 03 \u2014 Selected Work"), /*#__PURE__*/React.createElement("h2", null, /*#__PURE__*/React.createElement(WordReveal, null, "Production software, backends and open source."))), /*#__PURE__*/React.createElement(Reveal, {
    stagger: true,
    className: "projects-grid"
  }, items.map(p => /*#__PURE__*/React.createElement(Fragment, {
    key: p.title
  }, p.sectionHeading && /*#__PURE__*/React.createElement("div", {
    className: "project-section-heading"
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-tag"
  }, p.sectionEyebrow), /*#__PURE__*/React.createElement("h3", null, p.sectionHeading), p.sectionBlurb && /*#__PURE__*/React.createElement("p", null, p.sectionBlurb)), /*#__PURE__*/React.createElement(ProjectCard, {
    p: p
  })))));
}

/* =========================================================
   DEMOS — product demos as a horizontal slider (after Skills)
   ========================================================= */
function Demos({
  view
}) {
  const items = DEMO_PROJECTS.filter(p => view === 'all' || p.domain === view || p.domain === 'all');
  if (!items.length) return null;
  return /*#__PURE__*/React.createElement("section", {
    id: "demos",
    className: "section container"
  }, /*#__PURE__*/React.createElement(Reveal, {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-tag"
  }, "Fig. 05 \u2014 Demos"), /*#__PURE__*/React.createElement("h2", null, /*#__PURE__*/React.createElement(WordReveal, null, "Product demos built around real workflows.")), /*#__PURE__*/React.createElement("p", {
    className: "demos-sub"
  }, "Browser-based demos - B2B portals, marketplaces, booking, POS, AI copilots and dashboards. Open any to explore the full build. ", /*#__PURE__*/React.createElement("a", {
    href: "demo.html",
    target: "_blank",
    rel: "noopener"
  }, "Full gallery \u2197"))), /*#__PURE__*/React.createElement(Reveal, {
    stagger: true,
    className: "demos-grid"
  }, items.map(p => /*#__PURE__*/React.createElement(ProjectCard, {
    key: p.title,
    p: p,
    compact: true
  }))));
}

/* =========================================================
   SKILLS
   ========================================================= */
// Grouped chip cards - no tier badges, no percentages. Each card shows the
// areas the section title implies. Lets the viewer scan instead of judge.
const SKILLS = [{
  domain: 'code',
  title: 'Backend & APIs',
  items: ['Python', 'FastAPI', 'Java', 'Spring Boot', 'Spring Data JPA', 'C++17', 'TypeScript', 'Node.js', 'REST APIs', 'JWT Auth', 'OpenAPI / Swagger', 'Pydantic', 'async I/O']
}, {
  domain: 'all',
  title: 'Manufacturing Systems',
  items: ['MES', 'ERP', 'OEE', 'PPC', 'QC Workflows', 'Batch Tracking', 'Inventory / FIFO', 'Sage Evolution']
}, {
  domain: 'code',
  title: 'Frontend & UI',
  items: ['JavaScript ES6+', 'HTML5 / CSS3', 'Admin Dashboards', 'Multi-step Forms', 'Role-based UI', 'Responsive Design', 'SPA hash routing']
}, {
  domain: 'code',
  title: 'Data & Reporting',
  items: ['MongoDB', 'PostgreSQL', 'SQL Server', 'Flyway', 'Pandas', 'OpenPyXL', 'Excel Automation', 'PDF Generation']
}, {
  domain: 'code',
  title: 'Infrastructure & CI',
  items: ['Docker', 'Docker Compose', 'Linux', 'nginx', 'Cloudflare', 'Git / GitHub', 'GitHub Actions', 'CMake', 'n8n', 'Workflow Automation', "Let's Encrypt"]
}, {
  domain: 'eng',
  title: 'Industrial Operations',
  items: ['Krones Line Operations', 'Operator Coordination', 'Line Troubleshooting', 'RCA', 'SOPs', 'Commissioning Support', 'GPON / PSTN', 'Oracle CRM']
}, {
  domain: 'all',
  title: 'Learning / Expanding',
  items: ['React', 'Tailwind CSS', 'PLC / Siemens basics', 'scikit-learn']
}];
function SkillCard({
  s
}) {
  const ref = useRef(null);
  const inView = useInView(ref);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    className: 'skill-card' + (inView ? ' inView' : '')
  }, /*#__PURE__*/React.createElement("h3", null, s.title), /*#__PURE__*/React.createElement("div", {
    className: "skill-chips"
  }, s.items.map(name => /*#__PURE__*/React.createElement("span", {
    className: "skill-chip",
    key: name
  }, name))));
}
function Skills({
  view
}) {
  const items = SKILLS.filter(s => view === 'all' || s.domain === view || s.domain === 'all');
  return /*#__PURE__*/React.createElement("section", {
    id: "skills",
    className: "section container"
  }, /*#__PURE__*/React.createElement(Reveal, {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-tag"
  }, "Fig. 04 \u2014 Skills"), /*#__PURE__*/React.createElement("h2", null, /*#__PURE__*/React.createElement(WordReveal, null, "Skills I use to build and run operations software."))), /*#__PURE__*/React.createElement(Reveal, {
    stagger: true,
    className: "skills-grid"
  }, items.map(s => /*#__PURE__*/React.createElement(SkillCard, {
    key: s.title,
    s: s
  }))));
}

/* =========================================================
   CONTACT
   ========================================================= */
function Contact() {
  return /*#__PURE__*/React.createElement("section", {
    id: "contact",
    className: "section container"
  }, /*#__PURE__*/React.createElement(Reveal, {
    className: "contact-box"
  }, /*#__PURE__*/React.createElement("div", {
    className: "contact-left"
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-tag"
  }, "Fig. 06 \u2014 Contact"), /*#__PURE__*/React.createElement("h2", null, "Let\u2019s build something that ships."), /*#__PURE__*/React.createElement("p", null, "If you\u2019re hiring for automation, ERP/MES, manufacturing systems, backend engineering, IT operations, or Python-heavy technical roles in the UAE or remote, I\u2019d love to talk."), /*#__PURE__*/React.createElement(MagneticBtn, {
    as: "a",
    href: "contact.html",
    className: "btn btn-primary"
  }, "Open contact form ", /*#__PURE__*/React.createElement("span", {
    className: "arrow"
  }, "\u2192"))), /*#__PURE__*/React.createElement("ul", {
    className: "contact-list"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", {
    className: "contact-k"
  }, "Email"), /*#__PURE__*/React.createElement("a", {
    className: "contact-v",
    href: "mailto:saad@saadm.dev"
  }, "saad@saadm.dev")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", {
    className: "contact-k"
  }, "Phone"), /*#__PURE__*/React.createElement("a", {
    className: "contact-v",
    href: "tel:+971502578065"
  }, "+971 50 257 8065")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", {
    className: "contact-k"
  }, "LinkedIn"), /*#__PURE__*/React.createElement("a", {
    className: "contact-v",
    href: "https://www.linkedin.com/in/muhammadsaad435/",
    target: "_blank",
    rel: "noopener"
  }, "/in/muhammadsaad435")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", {
    className: "contact-k"
  }, "Based in"), /*#__PURE__*/React.createElement("span", {
    className: "contact-v"
  }, AVAILABILITY)))));
}

/* =========================================================
   FOOTER
   ========================================================= */
function Footer() {
  return /*#__PURE__*/React.createElement("footer", {
    className: "footer"
  }, /*#__PURE__*/React.createElement("div", {
    className: "container footer-inner"
  }, /*#__PURE__*/React.createElement("div", {
    className: "footer-copy"
  }, "\xA9 ", new Date().getFullYear(), " Muhammad Saad \u2014 Automation & Software Developer. Hand-built with vanilla CSS.", /*#__PURE__*/React.createElement("span", {
    className: "react-badge",
    title: "This homepage is a React 18 single-page app (precompiled JSX, no build-time framework)"
  }, "\u269B Built with React 18")), /*#__PURE__*/React.createElement("div", {
    className: "footer-links"
  }, /*#__PURE__*/React.createElement("a", {
    href: "mailto:saad@saadm.dev"
  }, "Email"), /*#__PURE__*/React.createElement("a", {
    href: "https://www.linkedin.com/in/muhammadsaad435/",
    target: "_blank",
    rel: "noopener"
  }, "LinkedIn"), /*#__PURE__*/React.createElement("a", {
    href: "https://github.com/saad-mughal435",
    target: "_blank",
    rel: "noopener"
  }, "GitHub"), /*#__PURE__*/React.createElement("a", {
    href: "#top"
  }, "Back to top \u2191"))));
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
    } catch (_) {
      return 'code';
    }
  });
  // Persist the active view and reflect it in the URL (?view=) so the page is
  // deep-linkable / shareable in a given mode. replaceState keeps it out of the
  // back-button history.
  useEffect(() => {
    try {
      localStorage.setItem('portfolio_view', view);
    } catch (_) {}
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('view') !== view) {
        url.searchParams.set('view', view);
        window.history.replaceState(null, '', url);
      }
    } catch (_) {}
  }, [view]);
  return /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("a", {
    href: "#top",
    className: "skip-link"
  }, "Skip to content"), /*#__PURE__*/React.createElement(ScrollProgress, null), /*#__PURE__*/React.createElement(Nav, null), /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(Hero, {
    view: view,
    setView: setView
  }), /*#__PURE__*/React.createElement(Stats, {
    view: view
  }), /*#__PURE__*/React.createElement(About, null), /*#__PURE__*/React.createElement(Experience, {
    view: view
  }), /*#__PURE__*/React.createElement(Projects, {
    view: view
  }), /*#__PURE__*/React.createElement(Skills, {
    view: view
  }), /*#__PURE__*/React.createElement(Demos, {
    view: view
  }), /*#__PURE__*/React.createElement(FAQ, null), /*#__PURE__*/React.createElement(Contact, null)), /*#__PURE__*/React.createElement(Footer, null));
}
createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
