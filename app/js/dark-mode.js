/* Dark-mode toggle for the MES/ERP demo app.
 *
 * Adds a floating button (bottom-right) that toggles a "dark" class on
 * <html>. Persists choice to localStorage. Initial mode is derived from
 * storage; falls back to the OS preference.
 */
(function () {
  'use strict';
  const KEY = 'demoplant_dark_mode';

  function apply(isDark) {
    document.documentElement.classList.toggle('dark', !!isDark);
    const btn = document.getElementById('dark-mode-toggle');
    if (btn) btn.textContent = isDark ? '☀' : '☾';
    if (btn) btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  }

  // Resolve initial preference
  let stored = null;
  try { stored = localStorage.getItem(KEY); } catch (_) {}
  let isDark;
  if (stored === '1') isDark = true;
  else if (stored === '0') isDark = false;
  else isDark = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) || false;
  apply(isDark);

  function mount() {
    if (document.getElementById('dark-mode-toggle')) return;
    const btn = document.createElement('button');
    btn.id = 'dark-mode-toggle';
    btn.type = 'button';
    btn.textContent = isDark ? '☀' : '☾';
    btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    btn.addEventListener('click', () => {
      isDark = !document.documentElement.classList.contains('dark');
      apply(isDark);
      try { localStorage.setItem(KEY, isDark ? '1' : '0'); } catch (_) {}
    });
    document.body.appendChild(btn);
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
