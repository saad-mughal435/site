/* =========================================================
   STATS - verbatim behaviour from home.app.jsx
   ========================================================= */
import { STATS_ALL, matchesView } from '../data';
import type { Stat as StatData } from '../data';

function Stat({ s }: { s: StatData }) {
  return (
    <div className="stat">
      <div className="stat-num">
        {s.display ?? `${s.suffix.includes('%') ? '~' : ''}${s.num.toLocaleString()}${s.suffix}`}
      </div>
      <div className="stat-lbl">{s.label}</div>
    </div>
  );
}

export function Stats({ view }: { view: string }) {
  // Filter only - deliberately NOT viewItems(). The stat row is authored in an
  // order that keeps similar-looking figures apart; hoisting the AI-tagged ones
  // put "5 departments" and "5 LLM demos" side by side in the AI view, which is
  // the exact ambiguity the row is ordered to avoid.
  const list = STATS_ALL.filter((s) => matchesView(s.domain, view));
  return (
    <section className="stats container" id="stats">
      {list.map((s) => <Stat key={s.label} s={s} />)}
    </section>
  );
}
