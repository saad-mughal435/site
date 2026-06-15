/* =========================================================
   NAV - ThemeToggle + Nav, verbatim behaviour from home.app.jsx
   ========================================================= */
import { useEffect, useState } from 'react';
import { useScrollPos } from '../hooks';

export function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    try { return document.documentElement.getAttribute('data-theme') || 'dark'; }
    catch (_) { return 'dark'; }
  });
  const apply = (t: string) => {
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

export function Nav() {
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
          <img className="logo-photo" width="38" height="38" decoding="async" src="saad.webp" alt="Saad - Automation Engineer and ERP Developer in Dubai" />
          <span>Saad</span>
        </a>
        <nav className={'nav-links' + (open ? ' open' : '')}>
          <a href="#about" className={active === 'about' ? 'active' : ''} aria-current={active === 'about' ? 'page' : undefined} onClick={close}>About</a>
          <a href="#experience" className={active === 'experience' ? 'active' : ''} aria-current={active === 'experience' ? 'page' : undefined} onClick={close}>Experience</a>
          <a href="#projects" className={active === 'projects' ? 'active' : ''} aria-current={active === 'projects' ? 'page' : undefined} onClick={close}>Projects</a>
          <a href="#skills" className={active === 'skills' ? 'active' : ''} aria-current={active === 'skills' ? 'page' : undefined} onClick={close}>Skills</a>
          <a href="notes/" onClick={close} title="Engineering notes - short technical write-ups">Notes</a>
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
