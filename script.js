/* =========================================================
   Saad - Portfolio interactions
   ========================================================= */

/* ---------- year in footer ---------- */
(function setYear() {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
})();

/* ---------- View toggle (All / Engineering / Coding) ---------- */
(function viewToggle() {
  const pills = document.querySelectorAll('.vt-pill');
  if (!pills.length) return;
  const KEY = 'portfolio_view';
  const valid = new Set(['all', 'eng', 'code']);

  function setView(view) {
    if (!valid.has(view)) view = 'all';
    document.body.classList.remove('view-all', 'view-eng', 'view-code');
    document.body.classList.add('view-' + view);
    pills.forEach(p => p.setAttribute('aria-selected', p.dataset.view === view ? 'true' : 'false'));
    try { localStorage.setItem(KEY, view); } catch (_) {}
  }

  pills.forEach(p => p.addEventListener('click', () => setView(p.dataset.view)));

  let initial = 'all';
  try { initial = localStorage.getItem(KEY) || 'all'; } catch (_) {}
  // honor ?view=eng / ?view=code if present
  try {
    const q = new URLSearchParams(window.location.search).get('view');
    if (valid.has(q)) initial = q;
  } catch (_) {}
  setView(initial);
})();

/* ---------- reveal on scroll ---------- */
(function reveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));
})();

/* ---------- scroll-spy: highlight current section in nav ---------- */
(function scrollSpy() {
  const sections = document.querySelectorAll('main section[id]');
  const links = document.querySelectorAll('.nav-links a');
  if (!sections.length || !links.length) return;

  const map = new Map();
  links.forEach(a => {
    const id = a.getAttribute('href').replace('#', '');
    map.set(id, a);
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const link = map.get(entry.target.id);
      if (!link) return;
      if (entry.isIntersecting) {
        links.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0.01 });

  sections.forEach(s => io.observe(s));
})();

/* ---------- subtle parallax on hero code window ---------- */
(function heroTilt() {
  const win = document.querySelector('.code-window');
  const hero = document.querySelector('.hero');
  if (!win || !hero) return;

  let frame;
  hero.addEventListener('mousemove', (e) => {
    const r = hero.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      win.style.transform =
        `perspective(1400px) rotateY(${(-x * 6).toFixed(2)}deg) rotateX(${(y * 5).toFixed(2)}deg)`;
    });
  });
  hero.addEventListener('mouseleave', () => {
    win.style.transform = 'perspective(1400px) rotateY(-3deg) rotateX(2deg)';
  });
})();

/* ---------- copy email on click in contact list ---------- */
(function copyEmail() {
  const links = document.querySelectorAll('a.contact-v[href^="mailto:"]');
  links.forEach(a => {
    a.addEventListener('click', (e) => {
      // let default mailto happen; also copy to clipboard quietly
      const email = a.textContent.trim();
      if (navigator.clipboard) navigator.clipboard.writeText(email).catch(() => {});
    });
  });
})();
