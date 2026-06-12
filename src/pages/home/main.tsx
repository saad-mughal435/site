/* =========================================================
   Homepage entry - mounts the React app, wires back-to-top,
   then boots the motion layer (fx.ts) after the first render.
   ========================================================= */
import { createRoot } from 'react-dom/client';
import '../../styles/home.css';
import '../../lib/back-to-top';
import { App } from './App';
import { initFx } from './fx';

createRoot(document.getElementById('root')!).render(<App />);

// After the first render is scheduled: fx.ts itself waits for `.hero` to
// exist in the DOM (whenContent) before wiring any ScrollTrigger, so this
// preserves the boot semantics of the retired root home.fx.js.
initFx();
