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
   HOOKS
   ========================================================= */
function useInView(ref, opts = {}) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true);
        io.disconnect();
      }
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -60px 0px',
      ...opts
    });
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
    const tick = now => {
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
function CursorSpotlight() {
  const ref = useRef(null);
  useEffect(() => {
    if (matchMedia('(hover: none)').matches) return;
    let frame;
    const onMove = e => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (ref.current) {
          ref.current.style.transform = `translate(${e.clientX - 200}px, ${e.clientY - 200}px)`;
          ref.current.style.opacity = 1;
        }
      });
    };
    const onLeave = () => {
      if (ref.current) ref.current.style.opacity = 0;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseout', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onLeave);
      cancelAnimationFrame(frame);
    };
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    className: "cursor-spotlight",
    "aria-hidden": "true"
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
const MARQUEE_ITEMS = ['Python', 'Java', 'FastAPI', 'Spring Boot', 'React', 'JavaScript', 'MongoDB', 'PostgreSQL', 'SQL Server', 'Docker', 'Linux', 'nginx', 'Cloudflare', 'Git', 'GitHub', 'Tailwind CSS', 'REST APIs', 'JWT', 'Pandas', 'NumPy', 'OpenAI API', 'LangChain', 'Sage Evolution', 'OEE', 'MES / ERP', 'Production Automation'];
function MarqueeStrip() {
  return /*#__PURE__*/React.createElement("div", {
    className: "marquee",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("div", {
    className: "marquee-track"
  }, [...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => /*#__PURE__*/React.createElement("span", {
    className: "marquee-item",
    key: i
  }, /*#__PURE__*/React.createElement("span", {
    className: "marquee-dot"
  }), item))));
}
function TiltCard({
  children,
  intensity = 6,
  className = '',
  tag: Tag = 'div',
  ...rest
}) {
  const ref = useRef(null);
  const onMove = e => {
    if (!ref.current) return;
    if (matchMedia('(hover: none)').matches) return;
    const r = ref.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width - 0.5) * intensity;
    const y = ((e.clientY - r.top) / r.height - 0.5) * intensity;
    ref.current.style.setProperty('--mx', (e.clientX - r.left) / r.width * 100 + '%');
    ref.current.style.setProperty('--my', (e.clientY - r.top) / r.height * 100 + '%');
    ref.current.style.transform = `perspective(1200px) rotateY(${-x.toFixed(2)}deg) rotateX(${y.toFixed(2)}deg) translateY(-3px)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = '';
  };
  return /*#__PURE__*/React.createElement(Tag, _extends({
    ref: ref,
    onMouseMove: onMove,
    onMouseLeave: reset,
    className: className
  }, rest), children);
}
function MagneticBtn({
  as: Tag = 'a',
  children,
  className = 'btn btn-primary',
  ...rest
}) {
  const ref = useRef(null);
  const [t, setT] = useState({
    x: 0,
    y: 0
  });
  const onMove = e => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) * 0.25;
    const y = (e.clientY - r.top - r.height / 2) * 0.25;
    setT({
      x,
      y
    });
  };
  const reset = () => setT({
    x: 0,
    y: 0
  });
  return /*#__PURE__*/React.createElement(Tag, _extends({
    ref: ref,
    onMouseMove: onMove,
    onMouseLeave: reset,
    className: className,
    style: {
      transform: `translate(${t.x}px, ${t.y}px)`
    }
  }, rest), children);
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
  }, "Contact")), /*#__PURE__*/React.createElement("a", {
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
    stack: 'Python · FastAPI · Java · Spring Boot · PostgreSQL · Docker',
    cta: {
      href: 'app/index.html',
      label: 'Launch live app ↗',
      target: '_blank'
    }
  }
};
const CODE_SNIPPETS = {
  all: {
    title: 'engineer.py',
    body: /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "class"), " ", /*#__PURE__*/React.createElement("span", {
      className: "cls"
    }, "Engineer"), ":", '\n', '    ', /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "name"), "      = ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "\"Saad\""), '\n', '    ', /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "based_in"), "  = ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "\"Dubai, UAE\""), '\n', '    ', /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "open_to"), "   = ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "\"relocate worldwide\""), '\n', '    ', /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "role"), "      = ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "\"Automation Engineer / ERP-OEE Developer / Operations Software Builder\""), '\n', '    ', /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "does"), " = [", '\n', '        ', /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "\"Build MES/ERP from scratch\""), ",", '\n', '        ', /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "\"Replace manual workflows with automation\""), ",", '\n', '        ', /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "\"Ship full-stack apps in Python, FastAPI, and vanilla JavaScript\""), ",", '\n', '        ', /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "\"Own infrastructure end-to-end: db to deployment\""), ",", '\n', '        ', /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "\"Troubleshoot what others escalate\""), ",", '\n', '    ', "]", '\n\n', '    ', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "def"), " ", /*#__PURE__*/React.createElement("span", {
      className: "fn"
    }, "value"), "(", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "self"), ") -> ", /*#__PURE__*/React.createElement("span", {
      className: "c"
    }, "str"), ":", '\n', '        ', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "return"), " ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "\"hardware + software, same engineer\""), '\n\n\n', /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "me"), " = ", /*#__PURE__*/React.createElement("span", {
      className: "cls"
    }, "Engineer"), "()", '\n', /*#__PURE__*/React.createElement("span", {
      className: "b"
    }, "print"), "(", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "me"), ".", /*#__PURE__*/React.createElement("span", {
      className: "fn"
    }, "value"), "())  ", /*#__PURE__*/React.createElement("span", {
      className: "comment"
    }, "# \u2192 hardware + software, same engineer"))
  },
  code: {
    title: 'close_shift.py',
    body: /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "from"), " ", /*#__PURE__*/React.createElement("span", {
      className: "m"
    }, "dataclasses"), " ", /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "import"), " ", /*#__PURE__*/React.createElement("span", {
      className: "c"
    }, "dataclass"), '\n', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "from"), " ", /*#__PURE__*/React.createElement("span", {
      className: "m"
    }, "decimal"), " ", /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "import"), " ", /*#__PURE__*/React.createElement("span", {
      className: "c"
    }, "Decimal"), '\n\n\n', /*#__PURE__*/React.createElement("span", {
      className: "d"
    }, "@dataclass"), '\n', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "class"), " ", /*#__PURE__*/React.createElement("span", {
      className: "cls"
    }, "Batch"), ":", '\n', '    ', /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "line"), ": ", /*#__PURE__*/React.createElement("span", {
      className: "c"
    }, "str"), '\n', '    ', /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "recipe"), ": ", /*#__PURE__*/React.createElement("span", {
      className: "c"
    }, "str"), '\n', '    ', /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "good"), ": ", /*#__PURE__*/React.createElement("span", {
      className: "c"
    }, "int"), '\n', '    ', /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "reject"), ": ", /*#__PURE__*/React.createElement("span", {
      className: "c"
    }, "int"), '\n', '    ', /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "planned"), ": ", /*#__PURE__*/React.createElement("span", {
      className: "c"
    }, "int"), '\n\n', '    ', /*#__PURE__*/React.createElement("span", {
      className: "d"
    }, "@property"), '\n', '    ', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "def"), " ", /*#__PURE__*/React.createElement("span", {
      className: "fn"
    }, "oee"), "(", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "self"), ") -> ", /*#__PURE__*/React.createElement("span", {
      className: "c"
    }, "Decimal"), ":", '\n', '        ', /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "avail"), "   = ", /*#__PURE__*/React.createElement("span", {
      className: "cls"
    }, "Decimal"), "(", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "self"), ".good + ", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "self"), ".reject) / ", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "self"), ".planned", '\n', '        ', /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "quality"), " = ", /*#__PURE__*/React.createElement("span", {
      className: "cls"
    }, "Decimal"), "(", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "self"), ".good) / (", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "self"), ".good + ", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "self"), ".reject)", '\n', '        ', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "return"), " ", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "avail"), " * ", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "quality"), "  ", /*#__PURE__*/React.createElement("span", {
      className: "comment"
    }, "# \xD7 performance"), '\n\n\n', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "def"), " ", /*#__PURE__*/React.createElement("span", {
      className: "fn"
    }, "close_shift"), "(", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "batches"), ": ", /*#__PURE__*/React.createElement("span", {
      className: "c"
    }, "list"), "[", /*#__PURE__*/React.createElement("span", {
      className: "cls"
    }, "Batch"), "]):", '\n', '    ', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "for"), " ", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "b"), " ", /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "in"), " ", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "batches"), ":", '\n', '        ', /*#__PURE__*/React.createElement("span", {
      className: "fn"
    }, "publish_to_mes"), "(", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "b"), ", ", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "b"), ".", /*#__PURE__*/React.createElement("span", {
      className: "fn"
    }, "oee"), ")")
  },
  eng: {
    title: 'shift_report.yaml',
    body: /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("span", {
      className: "comment"
    }, "# shift A \xB7 line A \xB7 2026-05-13"), '\n', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "line_support"), ":   ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "saad"), '\n', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "line"), ":           ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "Line A - Krones"), '\n', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "role"), ":", '\n', '  ', "- ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "line support"), '\n', '  ', "- ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "operator coordination"), '\n', '  ', "- ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "OEE reporting"), '\n', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "subsystems"), ":", '\n', '  ', "- ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "blow_molder"), ":        ", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "\u2713 running"), '\n', '  ', "- ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "filler"), ":             ", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "\u2713 running"), '\n', '  ', "- ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "checkmate_inspection"), ": ", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "sensor flag \xB7 waiting check"), '\n', '  ', "- ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "variopac_fs"), ":        ", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "\u2713 running"), '\n', '  ', "- ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "palletizer"), ":         ", /*#__PURE__*/React.createElement("span", {
      className: "v"
    }, "\u2713 running"), '\n\n', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "recipe"), ":         ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "Demo Beverage 500 mL"), '\n', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "planned_qty"), ":    ", /*#__PURE__*/React.createElement("span", {
      className: "n"
    }, "1000"), " cases", '\n', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "good"), ":           ", /*#__PURE__*/React.createElement("span", {
      className: "n"
    }, "962"), '\n', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "reject"), ":         ", /*#__PURE__*/React.createElement("span", {
      className: "n"
    }, "18"), '\n', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "downtime_min"), ":   ", /*#__PURE__*/React.createElement("span", {
      className: "n"
    }, "12"), '\n', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "downtime_cause"), ": ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "Variopac jam \xB7 cleared in 12 min"), '\n', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "oee_percent"), ":    ", /*#__PURE__*/React.createElement("span", {
      className: "n"
    }, "78"), '\n\n', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "root_cause"), ":", '\n', '  ', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "where"), ":   ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "Variopac infeed"), '\n', '  ', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "why"), ":     ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "torn shrink film"), '\n', '  ', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "fix"), ":     ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "replaced film roll \xB7 tension reset"), '\n', '  ', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "prevent"), ": ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "spec change to film supplier"), '\n\n', /*#__PURE__*/React.createElement("span", {
      className: "k"
    }, "handover_to"), ":    ", /*#__PURE__*/React.createElement("span", {
      className: "s"
    }, "shift B"))
  }
};
function CodeWindow({
  view
}) {
  const ref = useRef(null);
  const onMove = e => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    ref.current.style.transform = `perspective(1400px) rotateY(${(-x * 8).toFixed(2)}deg) rotateX(${(y * 6).toFixed(2)}deg)`;
  };
  const reset = () => {
    if (ref.current) ref.current.style.transform = 'perspective(1400px) rotateY(-3deg) rotateX(2deg)';
  };
  useEffect(() => {
    reset();
  }, [view]);
  const snippet = CODE_SNIPPETS[view] || CODE_SNIPPETS.all;
  return /*#__PURE__*/React.createElement("div", {
    className: "code-window view-fade",
    key: view,
    ref: ref,
    onMouseMove: onMove,
    onMouseLeave: reset,
    style: {
      transform: 'perspective(1400px) rotateY(-3deg) rotateX(2deg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "code-window-bar"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dot red"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dot yellow"
  }), /*#__PURE__*/React.createElement("span", {
    className: "dot green"
  }), /*#__PURE__*/React.createElement("span", {
    className: "code-window-title"
  }, snippet.title)), /*#__PURE__*/React.createElement("pre", {
    className: "code-window-body"
  }, /*#__PURE__*/React.createElement("code", null, snippet.body)));
}
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
  } : {}), copy.cta.label), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "ask-cta-pill",
    title: "Open the Ask Saad chatbot \u2014 AI grounded in his portfolio",
    onClick: () => {
      if (window.AskChat) window.AskChat.open();
    }
  }, /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true"
  }, "\u2726"), " Ask the AI")), /*#__PURE__*/React.createElement("div", {
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
  }, /*#__PURE__*/React.createElement(CodeWindow, {
    view: view
  })));
}

/* =========================================================
   STATS
   ========================================================= */
const STATS_ALL = [{
  num: 60,
  suffix: '%',
  label: 'reduction in production reporting time',
  domain: 'code'
}, {
  num: 5,
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
  s,
  view
}) {
  const ref = useRef(null);
  const inView = useInView(ref);
  const v = useCountUp(s.num, inView);
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    className: "stat"
  }, /*#__PURE__*/React.createElement("div", {
    className: "stat-num"
  }, s.suffix.includes('%') ? '~' : '', Math.round(v).toLocaleString(), s.suffix), /*#__PURE__*/React.createElement("div", {
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
  }, list.map((s, i) => /*#__PURE__*/React.createElement(Stat, {
    key: s.label,
    s: s,
    view: view
  })));
}

/* =========================================================
   STACK CHIPS - visible tag cloud (helps SEO + signals breadth)
   ========================================================= */
const STACK_GROUPS = [{
  label: 'Languages',
  tags: ['Python', 'Java', 'JavaScript', 'HTML5', 'CSS3', 'SQL', 'Bash', 'C++']
}, {
  label: 'Web / Frameworks',
  tags: ['FastAPI', 'Spring Boot', 'Vanilla JS', 'ES Modules', 'React (learning)', 'JSX', 'Babel', 'Tailwind CSS', 'Responsive Design']
}, {
  label: 'Backend / APIs',
  tags: ['REST APIs', 'JSON', 'JWT auth', 'Spring Data JPA', 'Hibernate', 'OpenAPI / Swagger', 'Pydantic', 'Uvicorn', 'Motor', 'pymongo', 'pyodbc', 'asyncio', 'httpx']
}, {
  label: 'Databases',
  tags: ['MongoDB', 'PostgreSQL', 'SQL Server', 'SQLite', 'Flyway', 'Mongo aggregation', 'indexes', 'transactions']
}, {
  label: 'Data / Automation',
  tags: ['Pandas', 'NumPy', 'OpenPyXL', 'Matplotlib', 'Excel automation', 'PDF generation', 'fpdf', 'pdfplumber', 'pypdf']
}, {
  label: 'DevOps / Infra',
  tags: ['Docker', 'Docker Compose', 'Linux', 'Ubuntu', 'nginx', 'systemd', 'Cron', 'SSH', 'Cloudflare', 'Cloudflare Pages', 'Workers', 'Let\'s Encrypt']
}, {
  label: 'Tooling',
  tags: ['Git', 'GitHub', 'GitHub Actions', 'Maven', 'JUnit 5', 'Testcontainers', 'VS Code', 'curl', 'jq', 'Postman']
}, {
  label: 'AI / ML',
  tags: ['OpenAI API', 'LangChain', 'scikit-learn · model training (Omdena internship)']
}, {
  label: 'Industrial',
  tags: ['MES', 'ERP', 'Sage Evolution', 'OEE', 'Production Planning', 'PLC concepts', 'Krones', 'GPON', 'PSTN']
}];
function StackChips() {
  return /*#__PURE__*/React.createElement("section", {
    className: "container stack-chips-section",
    id: "stack"
  }, /*#__PURE__*/React.createElement(Reveal, {
    className: "section-head",
    style: {
      marginBottom: 24
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-tag"
  }, "Tech stack"), /*#__PURE__*/React.createElement("h2", {
    style: {
      fontSize: 'clamp(22px, 3vw, 30px)'
    }
  }, "Tools I use to build, ship, and run things.")), /*#__PURE__*/React.createElement(Reveal, {
    className: "stack-chips-grid"
  }, STACK_GROUPS.map(g => /*#__PURE__*/React.createElement("div", {
    className: "stack-group",
    key: g.label
  }, /*#__PURE__*/React.createElement("div", {
    className: "stack-group-label"
  }, g.label), /*#__PURE__*/React.createElement("div", {
    className: "stack-chip-row"
  }, g.tags.map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    className: "stack-chip"
  }, t)))))));
}

/* =========================================================
   FAQ - long-tail keyword capture + FAQPage rich result
   ========================================================= */
const FAQ_ITEMS = [{
  q: 'Who is Muhammad Saad?',
  a: /*#__PURE__*/React.createElement(Fragment, null, "Muhammad Saad (Saad for short) is an ", /*#__PURE__*/React.createElement("strong", null, "Automation & Software Developer"), " currently based in the UAE and open to relocate worldwide. He builds ERP systems, dashboards, backend tools, admin panels, and web applications in Python, FastAPI, MongoDB, and JavaScript. Engineering background: B.Sc. Electrical Engineering with a Computer Engineering specialization from COMSATS Islamabad. Currently works as Automation Engineer and ERP Developer at Kingsley Beverage FZCO.")
}, {
  q: 'What does Saad work on?',
  a: /*#__PURE__*/React.createElement(Fragment, null, "The pattern is the same regardless of the project: take something a team is still doing by hand - spreadsheets, paper logs, ticket prep, copy-paste reports, manual reconciliations - and rebuild it as automation that runs itself. Most recently that meant designing and shipping a full-stack MES/ERP from scratch covering production planning, inventory, QC, accounts, and live reporting across 5 departments, plus running the Linux VM, MongoDB, Sage integration, and Cloudflare-fronted nginx behind it.")
}, {
  q: 'Is Saad available for hire?',
  a: /*#__PURE__*/React.createElement(Fragment, null, "Yes - open to backend, full-stack, automation, NOC engineering, IT infrastructure, and MES/ERP roles. On-site in the UAE, hybrid, or fully remote. Available immediately. Reach out via the ", /*#__PURE__*/React.createElement("a", {
    href: "contact.html"
  }, "contact form"), ", email ", /*#__PURE__*/React.createElement("a", {
    href: "mailto:saad@saadm.dev"
  }, "saad@saadm.dev"), ", or WhatsApp ", /*#__PURE__*/React.createElement("a", {
    href: "https://wa.me/971502578065",
    target: "_blank",
    rel: "noopener"
  }, "+971 50 257 8065"), ".")
}, {
  q: 'What type of roles is Saad open to?',
  a: /*#__PURE__*/React.createElement(Fragment, null, "Automation, ERP / MES, manufacturing systems, backend engineering, IT operations, NOC engineering, industrial maintenance, and Python-heavy technical roles. Currently UAE-based; open to relocate worldwide. Open to on-site, hybrid, or fully remote.")
}, {
  q: 'What is Saad\'s tech stack?',
  a: /*#__PURE__*/React.createElement(Fragment, null, "Python, FastAPI, Java, Spring Boot, MongoDB, PostgreSQL, React, JavaScript, Docker, Linux, nginx, Cloudflare, Git, REST APIs, JWT auth, Pandas, OpenPyXL, scikit-learn, Sage Evolution integration. Comfortable with the full lifecycle from data model design through deployment and ops.")
}, {
  q: 'Where is Saad based?',
  a: /*#__PURE__*/React.createElement(Fragment, null, "Dubai, United Arab Emirates. Originally from Pakistan; graduated from COMSATS University Islamabad.")
}, {
  q: 'Can I see Saad\'s code?',
  a: /*#__PURE__*/React.createElement(Fragment, null, "Yes - check the ", /*#__PURE__*/React.createElement("a", {
    href: "demo.html",
    target: "_blank",
    rel: "noopener"
  }, "live MES/ERP demo"), " (interactive, all data fabricated for privacy). Source for some open work is on GitHub at ", /*#__PURE__*/React.createElement("a", {
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
  }, "FAQ"), /*#__PURE__*/React.createElement("h2", null, "About Muhammad Saad - engineering background, software delivery focus.")), /*#__PURE__*/React.createElement(Reveal, {
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
  }, "01 - About"), /*#__PURE__*/React.createElement("h2", null, /*#__PURE__*/React.createElement(WordReveal, null, "I sit between the factory floor and the keyboard."))), /*#__PURE__*/React.createElement("div", {
    className: "about-grid"
  }, /*#__PURE__*/React.createElement(Reveal, {
    className: "about-copy"
  }, /*#__PURE__*/React.createElement("p", null, "I\u2019m an ", /*#__PURE__*/React.createElement("strong", null, "Automation & Software Developer"), " focused on ERP systems, dashboards, admin panels, and web applications. At Kingsley Beverage FZCO in Dubai I work as ", /*#__PURE__*/React.createElement("strong", null, "Automation Engineer"), ",", /*#__PURE__*/React.createElement("strong", null, "ERP Developer"), ", and ", /*#__PURE__*/React.createElement("strong", null, "IT Administrator"), ", and I\u2019m the sole developer of the enterprise software running across the plant."), /*#__PURE__*/React.createElement("p", null, "My engineering background (B.Sc. Electrical Engineering / Computer Engineering specialization, COMSATS Islamabad) helps me run and support the Krones beverage production lines, coordinate operators during shifts, and troubleshoot production issues across blow molding, filling, Checkmate inspection, Variopac FS packaging, palletizing, and PET preform handling."), /*#__PURE__*/React.createElement("p", null, "The Krones machine automation is OEM-locked; my software work sits around the production workflow through ERP / MES, OEE reporting, QC records, inventory, and management dashboards."), /*#__PURE__*/React.createElement("p", null, "Before that I spent two years as a ", /*#__PURE__*/React.createElement("strong", null, "NOC Engineer at PTCL"), " running GPON / PSTN / broadband infrastructure, where I shipped a Python tool that auto-generated configuration scripts from tickets, eliminating hours of manual ticket prep every day."), /*#__PURE__*/React.createElement("p", null, "The pattern: I look at slow, manual operational work and rebuild it in code. That\u2019s what I want to do next - build automation, backend, ERP/MES, or technical operations systems for teams where reliability and real workflows matter."), /*#__PURE__*/React.createElement("div", {
    className: "about-tags"
  }, ['Python', 'FastAPI', 'React', 'JavaScript (ES6+)', 'HTML / CSS', 'CSS Grid', 'MongoDB', 'Docker', 'Linux', 'nginx', 'Cloudflare', 'Git', 'REST APIs', 'JWT', 'Pandas', 'Design Systems', 'MES / ERP', 'Sage', 'PLC concepts', 'Krones', 'RCA', 'GPON / PSTN'].map(t => /*#__PURE__*/React.createElement("span", {
    className: "tag",
    key: t
  }, t)))), /*#__PURE__*/React.createElement(Reveal, {
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
  }, "02 - Experience"), /*#__PURE__*/React.createElement("h2", null, /*#__PURE__*/React.createElement(WordReveal, null, "A short career, but a wide one."))), /*#__PURE__*/React.createElement("ol", {
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
  showCode: true,
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
    label: 'Open live API (Swagger) ↗',
    href: 'https://shopfloor-api-lvb0.onrender.com/swagger-ui.html',
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
  kind: 'Disconnected demo · Portfolio piece',
  year: '2026',
  sectionEyebrow: 'Other software demos',
  sectionHeading: 'Product demos built around real workflows',
  sectionBlurb: 'These browser-based demos are not the headline of the portfolio. They show how the same operations-first approach can be applied to B2B portals, marketplaces, booking systems, storefronts, admin panels, approvals, dashboards, and workflow-heavy product software.',
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
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A Dubai real-estate marketplace demo with 65+ listings across Marina, Downtown, Palm Jumeirah, JBR, Business Bay, DIFC, Arabian Ranches and more. Map-and-list search using Leaflet/OpenStreetMap, agent and agency profiles with verified RERA-style permits, mortgage calculator with full amortisation schedule, and a comprehensive 15-section admin panel covering listings CRUD, leads pipeline, viewings calendar, analytics, moderation and audit log."),
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
  desc: /*#__PURE__*/React.createElement(Fragment, null, "A UAE short-stay booking marketplace demo with 55 vacation homes across 10 destinations (Dubai Marina, Palm Jumeirah, Hatta Mountains, RAK Beach, Fujairah, Liwa Desert and more). Hand-rolled date-range picker, availability calendar with conflict-check, per-night pricing with weekend surcharge and 5% VAT breakdown, and a 13-section admin SPA covering listings, bookings, hosts, guests, reviews, payments, promotions, destinations CMS, host/listing approvals, settings and audit."),
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
  p
}) {
  return /*#__PURE__*/React.createElement(TiltCard, {
    tag: "article",
    intensity: 5,
    className: 'project' + (p.featured ? ' featured' : '')
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
  }, p.desc), /*#__PURE__*/React.createElement("ul", {
    className: "project-bullets"
  }, p.bullets.map((b, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, b))), /*#__PURE__*/React.createElement("div", {
    className: "project-tags"
  }, p.tags.map(t => /*#__PURE__*/React.createElement("span", {
    key: t,
    className: "tag"
  }, t))), p.showCode && /*#__PURE__*/React.createElement("div", {
    className: "project-impl"
  }, /*#__PURE__*/React.createElement("pre", {
    className: "mini-code"
  }, /*#__PURE__*/React.createElement("code", null, /*#__PURE__*/React.createElement("span", {
    className: "comment"
  }, "# core loop - simplified"), '\n', /*#__PURE__*/React.createElement("span", {
    className: "k"
  }, "def"), " ", /*#__PURE__*/React.createElement("span", {
    className: "fn"
  }, "close_shift"), "(", /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "line"), ": ", /*#__PURE__*/React.createElement("span", {
    className: "c"
  }, "str"), ", ", /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "shift"), ": ", /*#__PURE__*/React.createElement("span", {
    className: "c"
  }, "int"), "):", '\n', '    ', /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "batches"), " = ", /*#__PURE__*/React.createElement("span", {
    className: "fn"
  }, "collect_batches"), "(", /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "line"), ", ", /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "shift"), ")", '\n', '    ', /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "oee"), " = ", /*#__PURE__*/React.createElement("span", {
    className: "fn"
  }, "compute_oee"), "(", /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "batches"), ")", '\n', '    ', /*#__PURE__*/React.createElement("span", {
    className: "fn"
  }, "publish"), "(", /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "line"), ", ", /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "shift"), ", ", /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "oee"), ", ", /*#__PURE__*/React.createElement("span", {
    className: "v"
  }, "batches"), ")"))), p.ctas && /*#__PURE__*/React.createElement("div", {
    className: "project-cta"
  }, p.ctas.map(c => /*#__PURE__*/React.createElement("a", _extends({
    key: c.label,
    href: c.href,
    className: 'btn ' + (c.primary ? 'btn-primary' : 'btn-ghost') + (c.prominent ? ' btn-prominent' : '')
  }, c.target ? {
    target: c.target,
    rel: 'noopener'
  } : {}), c.label)), p.ctaSubtitle && /*#__PURE__*/React.createElement("div", {
    className: "cta-subtitle"
  }, p.ctaSubtitle), p.ctaTip && /*#__PURE__*/React.createElement("div", {
    className: "cta-tip"
  }, p.ctaTip)));
}

/* What this proves - credibility strip between About and Projects. */
function WhatThisProves() {
  const items = [{
    icon: '⚙',
    title: 'I understand production-line operations',
    body: 'Machinery, utilities, shift workflows, downtime causes - not only the code that sits above them.'
  }, {
    icon: '👷',
    title: 'I design workflows for every role on the plant',
    body: 'Operators, QC, stores, finance and management each have different friction points and screens.'
  }, {
    icon: '🔗',
    title: 'I connect the whole stack',
    body: 'Frontend screens, backend APIs, MongoDB + SQL Server, Sage/ERP data and print-ready PDF reports - end-to-end in one head.'
  }, {
    icon: '📊',
    title: 'I turn paper + Excel into software',
    body: 'My job is converting messy spreadsheets and paper logs into structured, audit-able, fast operational tools.'
  }];
  return /*#__PURE__*/React.createElement("section", {
    id: "proves",
    className: "section container"
  }, /*#__PURE__*/React.createElement(Reveal, {
    className: "section-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-tag"
  }, "What this proves"), /*#__PURE__*/React.createElement("h2", null, /*#__PURE__*/React.createElement(WordReveal, null, "I build operations software because I\u2019ve worked operations."))), /*#__PURE__*/React.createElement(Reveal, {
    stagger: true,
    className: "proves-grid"
  }, items.map((it, i) => /*#__PURE__*/React.createElement(Reveal, {
    as: "div",
    key: i,
    className: "proves-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "proves-icon",
    "aria-hidden": "true"
  }, it.icon), /*#__PURE__*/React.createElement("h3", null, it.title), /*#__PURE__*/React.createElement("p", null, it.body)))));
}

/* MES thumbnail mockup cards - rendered above the featured MES project card.
   Pure CSS/JSX, no images required. Swap with real Kingsley screenshots
   later by dropping a PNG into site/screenshots/ and replacing one card
   with <img src="…">. */
function MesThumbnails() {
  return /*#__PURE__*/React.createElement("div", {
    className: "mes-thumbs"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-thumb"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-thumb-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-dot"
  }), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-dot y"
  }), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-dot g"
  }), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-title"
  }, "Production dashboard"), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-badge"
  }, "DEMO")), /*#__PURE__*/React.createElement("div", {
    className: "mes-thumb-meta"
  }, "Line A \xB7 Shift A \xB7 14:32"), /*#__PURE__*/React.createElement("div", {
    className: "mes-thumb-kpis"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "mes-kpi-k"
  }, "OEE"), /*#__PURE__*/React.createElement("span", {
    className: "mes-kpi-v"
  }, "78%")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "mes-kpi-k"
  }, "Speed"), /*#__PURE__*/React.createElement("span", {
    className: "mes-kpi-v"
  }, "9,600 bph")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "mes-kpi-k"
  }, "Output"), /*#__PURE__*/React.createElement("span", {
    className: "mes-kpi-v"
  }, "3,847 cs")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    className: "mes-kpi-k"
  }, "Rejects"), /*#__PURE__*/React.createElement("span", {
    className: "mes-kpi-v"
  }, "42"))), /*#__PURE__*/React.createElement("div", {
    className: "mes-thumb-bars"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: '62%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '74%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '48%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '85%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '70%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '92%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '78%'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      height: '66%'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    className: "mes-thumb"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-thumb-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-dot"
  }), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-dot y"
  }), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-dot g"
  }), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-title"
  }, "QC batch record"), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-badge"
  }, "DEMO")), /*#__PURE__*/React.createElement("div", {
    className: "mes-thumb-meta"
  }, "Batch BR-2026-0418 \xB7 500 ml PET"), /*#__PURE__*/React.createElement("ul", {
    className: "mes-thumb-checks"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", null, "Seam thickness"), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-pass"
  }, "\u2713 PASS")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", null, "Drop test"), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-pass"
  }, "\u2713 PASS")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", null, "Brix & carbonation"), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-pass"
  }, "\u2713 PASS")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", null, "Fill weight"), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-pass"
  }, "\u2713 PASS")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", null, "Microbiology"), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-pass"
  }, "\u2713 PASS"))), /*#__PURE__*/React.createElement("div", {
    className: "mes-thumb-footer"
  }, "Verdict ", /*#__PURE__*/React.createElement("strong", null, "PASS"), " \xB7 36 samples \xB7 approved by demo.qc")), /*#__PURE__*/React.createElement("div", {
    className: "mes-thumb"
  }, /*#__PURE__*/React.createElement("div", {
    className: "mes-thumb-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-dot"
  }), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-dot y"
  }), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-dot g"
  }), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-title"
  }, "Inventory + Sage"), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-badge"
  }, "DEMO")), /*#__PURE__*/React.createElement("div", {
    className: "mes-thumb-meta"
  }, "Stock vs Sage reconciliation"), /*#__PURE__*/React.createElement("ul", {
    className: "mes-thumb-rows"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", null, "Sugar"), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-qty"
  }, "12,500 kg"), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-ok"
  }, "sync ok")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", null, "Preforms 500 ml"), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-qty"
  }, "480,000 pcs"), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-ok"
  }, "sync ok")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", null, "Caps"), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-qty"
  }, "510,000 pcs"), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-warn"
  }, "312 short")), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("span", null, "Labels 500 ml"), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-qty"
  }, "470,000 pcs"), /*#__PURE__*/React.createElement("span", {
    className: "mes-thumb-ok"
  }, "sync ok"))), /*#__PURE__*/React.createElement("div", {
    className: "mes-thumb-footer"
  }, "Last Sage sync \xB7 11 minutes ago \xB7 0 errors")));
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
  }, "03 - Selected Work"), /*#__PURE__*/React.createElement("h2", null, /*#__PURE__*/React.createElement(WordReveal, null, "Software projects built around real workflows."))), /*#__PURE__*/React.createElement(Reveal, {
    stagger: true,
    className: "projects-grid"
  }, items.map(p => /*#__PURE__*/React.createElement(Fragment, {
    key: p.title
  }, p.sectionHeading && /*#__PURE__*/React.createElement("div", {
    className: "project-section-heading"
  }, /*#__PURE__*/React.createElement("span", {
    className: "section-tag"
  }, p.sectionEyebrow), /*#__PURE__*/React.createElement("h3", null, p.sectionHeading), p.sectionBlurb && /*#__PURE__*/React.createElement("p", null, p.sectionBlurb)), p.featured && /*#__PURE__*/React.createElement(MesThumbnails, null), /*#__PURE__*/React.createElement(ProjectCard, {
    p: p
  })))));
}

/* =========================================================
   SKILLS
   ========================================================= */
// Grouped chip cards - no tier badges, no percentages. Each card shows the
// areas the section title implies. Lets the viewer scan instead of judge.
const SKILLS = [{
  domain: 'code',
  title: 'Backend & APIs',
  items: ['Python', 'FastAPI', 'Java', 'Spring Boot', 'Spring Data JPA', 'REST APIs', 'JWT Auth', 'Pydantic', 'Motor', 'pyodbc', 'async I/O']
}, {
  domain: 'all',
  title: 'Manufacturing Systems',
  items: ['MES', 'ERP', 'OEE', 'PPC', 'QC Workflows', 'Batch Tracking', 'Inventory / FIFO', 'Sage Evolution']
}, {
  domain: 'code',
  title: 'Frontend & UI',
  items: ['JavaScript ES6+', 'HTML5 / CSS3', 'Admin Dashboards', 'Multi-step Forms', 'Role-based UI', 'Responsive Design', 'SPA hash routing', 'Mock-driven prototyping']
}, {
  domain: 'code',
  title: 'Data & Reporting',
  items: ['MongoDB', 'PostgreSQL', 'SQL Server', 'Pandas', 'OpenPyXL', 'Excel Automation', 'PDF Generation', 'Report Pipelines']
}, {
  domain: 'code',
  title: 'Infrastructure',
  items: ['Docker', 'Docker Compose', 'Linux', 'nginx', 'Cloudflare', 'SSH / Cron', 'Git / GitHub', "Let's Encrypt"]
}, {
  domain: 'eng',
  title: 'Industrial Operations',
  items: ['Krones Line Operations', 'Operator Coordination', 'Line Troubleshooting', 'RCA', 'SOPs', 'Commissioning Support', 'GPON / PSTN', 'Oracle CRM']
}, {
  domain: 'all',
  title: 'Learning / Expanding',
  items: ['React', 'Tailwind CSS', 'PLC / Siemens basics', 'scikit-learn', 'GitHub Actions']
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
  }, "04 - Skills"), /*#__PURE__*/React.createElement("h2", null, /*#__PURE__*/React.createElement(WordReveal, null, "Skills I use to build and run operations software."))), /*#__PURE__*/React.createElement(Reveal, {
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
  }, "05 - Contact"), /*#__PURE__*/React.createElement("h2", null, "Let\u2019s build something that ships."), /*#__PURE__*/React.createElement("p", null, "If you\u2019re hiring for automation, ERP/MES, manufacturing systems, backend engineering, IT operations, or Python-heavy technical roles in the UAE or remote, I\u2019d love to talk."), /*#__PURE__*/React.createElement(MagneticBtn, {
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
  }, "UAE \xB7 Open to relocate worldwide \xB7 on-site / hybrid / remote")))));
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
  }, "\xA9 ", new Date().getFullYear(), " Muhammad Saad \u2014 Automation & Software Developer. Built with React and vanilla CSS."), /*#__PURE__*/React.createElement("div", {
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
      if (q === 'eng' || q === 'code') return q;
      const stored = localStorage.getItem('portfolio_view');
      return stored === 'eng' || stored === 'code' ? stored : 'code';
    } catch (_) {
      return 'code';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem('portfolio_view', view);
    } catch (_) {}
  }, [view]);
  return /*#__PURE__*/React.createElement(Fragment, null, /*#__PURE__*/React.createElement("a", {
    href: "#top",
    className: "skip-link"
  }, "Skip to content"), /*#__PURE__*/React.createElement(ScrollProgress, null), /*#__PURE__*/React.createElement(CursorSpotlight, null), /*#__PURE__*/React.createElement(Nav, null), /*#__PURE__*/React.createElement("main", null, /*#__PURE__*/React.createElement(Hero, {
    view: view,
    setView: setView
  }), /*#__PURE__*/React.createElement(Stats, {
    view: view
  }), /*#__PURE__*/React.createElement(MarqueeStrip, null), /*#__PURE__*/React.createElement(StackChips, null), /*#__PURE__*/React.createElement(About, null), /*#__PURE__*/React.createElement(WhatThisProves, null), /*#__PURE__*/React.createElement(Experience, {
    view: view
  }), /*#__PURE__*/React.createElement(Projects, {
    view: view
  }), /*#__PURE__*/React.createElement(Skills, {
    view: view
  }), /*#__PURE__*/React.createElement(FAQ, null), /*#__PURE__*/React.createElement(Contact, null)), /*#__PURE__*/React.createElement(Footer, null));
}
createRoot(document.getElementById('root')).render(/*#__PURE__*/React.createElement(App, null));
