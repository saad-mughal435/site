/* =========================================================
   Demo page entry (replaces styles.css + demo.css + script.js + demo.js)
   - Shell CSS + demo CSS + shared shell interactions + back-to-top
   - Sidebar nav for the MES/ERP showcase (port of demo.js)
   ========================================================= */

import '../../styles/shell.css';
import '../../styles/demo.css';
import '../../lib/shell';
import '../../lib/back-to-top';

(function () {
  const links = document.querySelectorAll<HTMLElement>('.app-nav-link[data-view]');
  const views = document.querySelectorAll('.view');
  if (!links.length || !views.length) return;

  function show(viewId: string | undefined) {
    links.forEach(l => l.classList.toggle('active', l.dataset.view === viewId));
    views.forEach(v => v.classList.toggle('active', v.id === 'view-' + viewId));
    // scroll the app-main to top on switch
    const main = document.querySelector('.app-main');
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
  }

  links.forEach(l => {
    l.addEventListener('click', (e) => {
      e.preventDefault();
      show(l.dataset.view);
      history.replaceState(null, '', '#' + l.dataset.view);
    });
  });

  // honor hash on load
  const hash = location.hash.replace('#', '');
  if (hash && document.getElementById('view-' + hash)) show(hash);
})();

// Gallery category filter (progressive enhancement: the chip bar ships with
// [hidden] in the HTML, so without JS every card simply stays visible).
(function () {
  const bar = document.querySelector<HTMLElement>('.demo-filter');
  const cards = document.querySelectorAll<HTMLElement>('.demo-chooser .demo-card');
  if (!bar || !cards.length) return;

  const chips = bar.querySelectorAll<HTMLButtonElement>('.demo-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const filter = chip.dataset.filter || 'all';
      chips.forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
      cards.forEach(card => {
        card.hidden = filter !== 'all' && card.dataset.category !== filter;
      });
    });
  });

  bar.hidden = false;
})();
