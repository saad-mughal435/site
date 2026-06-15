/* =========================================================
   Decode-to-book latency explorer (/hft-latency)
   Renders an interactive SVG bar chart + table from a real CI
   benchmark artifact. Shell (theme + back-to-top + year) is
   reused from src/lib.
   ========================================================= */

import '../../styles/shell.css';
import '../../styles/hft-latency.css';
import '../../lib/shell';
import '../../lib/back-to-top';

import data from './data.json';

/* ---------- types (mirror data.json; defensive about extra fields) ---------- */
type Pct = 'p50_ns' | 'p95_ns' | 'p99_ns' | 'max_ns';

interface Row {
  type: string;
  code?: string;
  count: number;
  p50_ns: number;
  p95_ns: number;
  p99_ns: number;
  max_ns: number;
}

interface LatencyData {
  generated_at: string;
  environment: string;
  method: string;
  sample_messages: number;
  per_type: Row[];
  overall: Omit<Row, 'type' | 'code'> & { type?: string; code?: string };
}

const d = data as LatencyData;

/* ---------- helpers ---------- */
const SVG_NS = 'http://www.w3.org/2000/svg';
const fmt = (n: number): string => n.toLocaleString('en-US');

function pctValue(row: { [k in Pct]?: number }, pct: Pct): number {
  const v = row[pct];
  return typeof v === 'number' && isFinite(v) && v > 0 ? v : 0;
}

/* The "Overall" row is appended to the charted/tabled set, emphasized. */
const overallRow: Row = {
  type: 'Overall',
  code: '*',
  count: d.overall.count,
  p50_ns: d.overall.p50_ns,
  p95_ns: d.overall.p95_ns,
  p99_ns: d.overall.p99_ns,
  max_ns: d.overall.max_ns,
};

const perType: Row[] = Array.isArray(d.per_type) ? d.per_type : [];
const chartRows: Row[] = [...perType, overallRow];

/* ---------- state ---------- */
let currentPct: Pct = 'p99_ns';

/* ---------- chart ---------- */
const chartEl = document.getElementById('lat-chart');
const maxNoteEl = document.getElementById('lat-max-note') as HTMLElement | null;
const capEl = document.getElementById('lat-cap');

function pctLabel(pct: Pct): string {
  return pct === 'max_ns' ? 'max' : pct.replace('_ns', '');
}

function renderChart(): void {
  if (!chartEl) return;
  chartEl.textContent = '';

  // Scale to the largest selected value across all charted rows.
  const maxVal = chartRows.reduce((m, r) => Math.max(m, pctValue(r, currentPct)), 0) || 1;

  chartRows.forEach((row, i) => {
    const isOverall = row.type === 'Overall';
    const val = pctValue(row, currentPct);
    const widthPct = (val / maxVal) * 100;

    const rowEl = document.createElement('div');
    rowEl.className = 'lat-row' + (isOverall ? ' lat-row-overall' : '');

    // label + count
    const label = document.createElement('div');
    label.className = 'lat-row-label';
    label.textContent = row.code ? `${row.type} (${row.code})` : row.type;
    const count = document.createElement('span');
    count.className = 'lat-row-count';
    count.textContent = `${fmt(row.count)} msg`;
    label.appendChild(count);

    // bar (SVG so the value label can sit at the bar end without overflow math)
    const track = document.createElement('div');
    track.className = 'lat-bar-track';
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'lat-bar-svg');
    svg.setAttribute('viewBox', '0 0 100 30');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('role', 'img');
    svg.setAttribute(
      'aria-label',
      `${row.type}: ${pctLabel(currentPct)} ${fmt(val)} nanoseconds, ${fmt(row.count)} messages`
    );

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('class', 'lat-bar-rect');
    rect.setAttribute('x', '0');
    rect.setAttribute('y', '4');
    rect.setAttribute('height', '22');
    rect.setAttribute('rx', '4');
    // viewBox is unitless 0..100; preserveAspectRatio:none stretches to px.
    rect.setAttribute('width', String(Math.max(widthPct, val > 0 ? 0.6 : 0)));
    svg.appendChild(rect);
    track.appendChild(svg);

    // value label sits in normal flow over the track end, in px, so it stays crisp
    const valLabel = document.createElement('span');
    valLabel.className = 'lat-bar-value-html';
    track.appendChild(valLabel);

    rowEl.appendChild(label);
    rowEl.appendChild(track);
    chartEl.appendChild(rowEl);

    // Position the ns value just past the bar end (clamped so it stays visible).
    const place = (): void => {
      const trackW = track.clientWidth || 1;
      const barW = (widthPct / 100) * trackW;
      const text = `${fmt(val)} ns`;
      valLabel.textContent = text;
      const approx = text.length * 7 + 8;
      let left = barW + 8;
      if (left + approx > trackW) left = Math.max(0, trackW - approx);
      valLabel.style.left = `${left}px`;
    };
    place();
    // reflow value labels on resize (single shared handler added once below)
    resizePlacers.push(place);

    void i;
  });

  // max-only caveat
  if (maxNoteEl) maxNoteEl.hidden = currentPct !== 'max_ns';
  if (capEl) capEl.textContent = `Charted by ${pctLabel(currentPct)} latency (ns).`;
}

/* resize handling for value-label placement */
const resizePlacers: Array<() => void> = [];
let resizeTick = false;
function onResize(): void {
  if (resizeTick) return;
  resizeTick = true;
  requestAnimationFrame(() => {
    resizePlacers.forEach((p) => p());
    resizeTick = false;
  });
}
window.addEventListener('resize', onResize, { passive: true });

/* ---------- controls ---------- */
function wireControls(): void {
  const btns = Array.from(document.querySelectorAll<HTMLButtonElement>('.lat-pct'));
  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const pct = btn.dataset.pct as Pct | undefined;
      if (!pct) return;
      currentPct = pct;
      btns.forEach((b) => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
      resizePlacers.length = 0;
      renderChart();
    });
  });
}

/* ---------- table ---------- */
function renderTable(): void {
  const tbody = document.getElementById('lat-tbody');
  if (!tbody) return;
  tbody.textContent = '';
  chartRows.forEach((row) => {
    const isOverall = row.type === 'Overall';
    const tr = document.createElement('tr');
    if (isOverall) tr.className = 'lat-tr-overall';

    const th = document.createElement('th');
    th.setAttribute('scope', 'row');
    th.textContent = row.code ? `${row.type} (${row.code})` : row.type;
    tr.appendChild(th);

    ([row.count, row.p50_ns, row.p95_ns, row.p99_ns, row.max_ns] as number[]).forEach((n) => {
      const td = document.createElement('td');
      td.className = 'lat-num';
      td.textContent = fmt(n);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

/* ---------- provenance line ---------- */
function renderProvenance(): void {
  const el = document.getElementById('lat-prov');
  if (!el) return;
  el.textContent =
    `Generated ${d.generated_at} · ${fmt(d.sample_messages)} messages · ${d.environment} · ${d.method}`;
}

/* ---------- init ---------- */
renderTable();
renderProvenance();
wireControls();
renderChart();
