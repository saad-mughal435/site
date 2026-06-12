/* =========================================================
   APP - view state init (?view= -> localStorage 'portfolio_view'
   -> default 'code'), persistence + URL reflection. Verbatim
   behaviour from home.app.jsx.
   ========================================================= */
import { Fragment, useEffect, useState } from 'react';
import { Nav } from './components/Nav';
import { ScrollProgress } from './components/primitives';
import { Hero } from './components/Hero';
import { Stats } from './components/Stats';
import { About } from './components/About';
import { ProofStrip } from './components/ProofStrip';
import { Experience } from './components/Experience';
import { Projects } from './components/Projects';
import { Demos } from './components/Demos';
import { Skills } from './components/Skills';
import { FAQ } from './components/FAQ';
import { Contact } from './components/Contact';
import { Footer } from './components/Footer';

export function App() {
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
