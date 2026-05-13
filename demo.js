/* =========================================================
   Demo page — sidebar nav for the MES/ERP showcase
   ========================================================= */

(function () {
  const links = document.querySelectorAll('.app-nav-link[data-view]');
  const views = document.querySelectorAll('.view');
  if (!links.length || !views.length) return;

  function show(viewId) {
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
