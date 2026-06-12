/* =========================================================
   STATS - verbatim behaviour from home.app.jsx
   ========================================================= */
import { STATS_ALL } from '../data';
import type { Stat as StatData } from '../data';

function Stat({ s }: { s: StatData }) {
  return (
    <div className="stat">
      <div className="stat-num">
        {s.suffix.includes('%') ? '~' : ''}{s.num.toLocaleString()}{s.suffix}
      </div>
      <div className="stat-lbl">{s.label}</div>
    </div>
  );
}

export function Stats({ view }: { view: string }) {
  const list = STATS_ALL.filter((s) => view === 'all' || s.domain === view || s.domain === 'all');
  return (
    <section className="stats container" id="stats">
      {list.map((s) => <Stat key={s.label} s={s} />)}
    </section>
  );
}
