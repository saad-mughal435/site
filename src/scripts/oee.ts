/* =========================================================
   OEE playground (/oee)
   Ports dev.saadm.shopfloor.service.OeeCalculator exactly:
     runTime      = max(0, planned - downtime)
     availability = clamp01(runTime / planned)
     idealMinutes = rated <= 0 ? 0 : total * 60 / rated
     performance  = clamp01(idealMinutes / runTime)
     quality      = clamp01(good / total)
     oee          = availability * performance * quality
   Every division is guarded (denominator <= 0 => 0), every
   factor clamped to [0, 1]. No Infinity / NaN ever.
   ========================================================= */

// shell.css + oee.css + lib/shell + lib/back-to-top loaded by oee.astro.

/* ---------- inputs ---------- */
interface Inputs {
  planned: number;
  downtime: number;
  rated: number;
  good: number;
  reject: number;
}

interface Result {
  totalUnits: number;
  runTimeMinutes: number;
  idealMinutes: number;
  availability: number; // [0,1]
  performance: number; // [0,1]
  quality: number; // [0,1]
  oee: number; // [0,1]
  rawPerformance: number; // pre-clamp, for the over-speed flag
  performanceCapped: boolean;
}

/* numerator / denominator, clamped to [0, 1]; guards divide-by-zero. */
function ratio(numerator: number, denominator: number): number {
  if (!(denominator > 0)) return 0; // denominator <= 0 (or NaN) => 0
  const r = numerator / denominator;
  if (!isFinite(r) || r < 0) return 0;
  return r > 1 ? 1 : r;
}

function compute(i: Inputs): Result {
  // Coerce to the Java int contract: non-negative integers, default 0.
  const planned = toInt(i.planned);
  const downtime = toInt(i.downtime);
  const rated = toInt(i.rated);
  const good = toInt(i.good);
  const reject = toInt(i.reject);

  const totalUnits = good + reject;
  const runTimeMinutes = Math.max(0, planned - downtime);

  const availability = ratio(runTimeMinutes, planned);

  const idealMinutes = rated <= 0 ? 0 : (totalUnits * 60) / rated;
  const performance = ratio(idealMinutes, runTimeMinutes);

  // raw (un-clamped) performance, purely to surface the over-speed case
  const rawPerformance = runTimeMinutes > 0 ? idealMinutes / runTimeMinutes : 0;
  const performanceCapped = isFinite(rawPerformance) && rawPerformance > 1;

  const quality = ratio(good, totalUnits);

  const oee = availability * performance * quality;

  return {
    totalUnits,
    runTimeMinutes,
    idealMinutes,
    availability,
    performance,
    quality,
    oee,
    rawPerformance,
    performanceCapped,
  };
}

function toInt(n: number): number {
  if (!isFinite(n) || isNaN(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

/* ---------- formatting ---------- */
function pct(v01: number): string {
  // factors are scale-4 in the API; show one decimal of percent (i.e. 4 sig figs)
  return `${(v01 * 100).toFixed(1)}%`;
}
function num(n: number, decimals = 2): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}

/* ---------- DOM refs ---------- */
const $ = <T extends HTMLElement>(id: string): T | null => document.getElementById(id) as T | null;

const inEls = {
  planned: $<HTMLInputElement>('oee-planned'),
  downtime: $<HTMLInputElement>('oee-downtime'),
  rated: $<HTMLInputElement>('oee-rated'),
  good: $<HTMLInputElement>('oee-good'),
  reject: $<HTMLInputElement>('oee-reject'),
};

const outEls = {
  value: $<HTMLElement>('oee-value'),
  availPct: $<HTMLElement>('oee-avail-pct'),
  perfPct: $<HTMLElement>('oee-perf-pct'),
  qualPct: $<HTMLElement>('oee-qual-pct'),
  availBar: $<HTMLElement>('oee-avail-bar'),
  perfBar: $<HTMLElement>('oee-perf-bar'),
  qualBar: $<HTMLElement>('oee-qual-bar'),
  flag: $<HTMLElement>('oee-flag'),
  steps: $<HTMLElement>('oee-steps'),
};

function readInputs(): Inputs {
  const read = (el: HTMLInputElement | null): number => {
    if (!el) return 0;
    const v = parseFloat(el.value);
    return isNaN(v) ? 0 : v;
  };
  return {
    planned: read(inEls.planned),
    downtime: read(inEls.downtime),
    rated: read(inEls.rated),
    good: read(inEls.good),
    reject: read(inEls.reject),
  };
}

/* ---------- render ---------- */
function render(): void {
  const i = readInputs();
  const r = compute(i);

  if (outEls.value) outEls.value.textContent = pct(r.oee);

  if (outEls.availPct) outEls.availPct.textContent = pct(r.availability);
  if (outEls.perfPct) outEls.perfPct.textContent = pct(r.performance);
  if (outEls.qualPct) outEls.qualPct.textContent = pct(r.quality);

  if (outEls.availBar) outEls.availBar.style.width = `${(r.availability * 100).toFixed(1)}%`;
  if (outEls.perfBar) outEls.perfBar.style.width = `${(r.performance * 100).toFixed(1)}%`;
  if (outEls.qualBar) outEls.qualBar.style.width = `${(r.quality * 100).toFixed(1)}%`;

  // over-speed / guard flag
  if (outEls.flag) {
    if (r.performanceCapped) {
      outEls.flag.hidden = false;
      outEls.flag.innerHTML =
        '<strong>Performance capped at 100%.</strong> Raw performance is ' +
        `${pct(r.rawPerformance)} - the line produced units faster than its rated speed allows, ` +
        'so the factor is clamped to 1. (Check the rated speed, or the unit count for that window.)';
    } else {
      outEls.flag.hidden = true;
      outEls.flag.textContent = '';
    }
  }

  renderSteps(r);
}

function renderSteps(r: Result): void {
  if (!outEls.steps) return;
  outEls.steps.textContent = '';
  const steps: Array<[string, string]> = [
    ['total units = good + reject', `${num(r.totalUnits, 0)}`],
    ['run time = max(0, planned - downtime)', `${num(r.runTimeMinutes, 0)} min`],
    ['ideal minutes = total x 60 / rated', `${num(r.idealMinutes, 2)} min`],
    ['availability = run time / planned', pct(r.availability)],
    ['performance = ideal / run time', pct(r.performance)],
    ['quality = good / total', pct(r.quality)],
  ];
  steps.forEach(([label, val]) => {
    const li = document.createElement('li');
    const l = document.createElement('span');
    l.className = 'oee-step-label';
    l.textContent = label;
    const v = document.createElement('span');
    v.className = 'oee-step-val';
    v.textContent = val;
    li.appendChild(l);
    li.appendChild(v);
    outEls.steps!.appendChild(li);
  });
  // result line
  const li = document.createElement('li');
  li.className = 'oee-step-result';
  const l = document.createElement('span');
  l.textContent = 'OEE = availability x performance x quality';
  const v = document.createElement('span');
  v.className = 'oee-step-val';
  v.textContent = pct(r.oee);
  li.appendChild(l);
  li.appendChild(v);
  outEls.steps.appendChild(li);
}

/* ---------- presets (each exercises a specific guard) ---------- */
const presets: Record<string, Inputs> = {
  // healthy line, no stoppages -> availability = 100%
  'zero-downtime': { planned: 480, downtime: 0, rated: 1200, good: 8800, reject: 200 },
  // produced more than rated speed allows -> raw perf > 100%, gets clamped
  'over-speed': { planned: 480, downtime: 30, rated: 1000, good: 9500, reject: 100 },
  // every unit is a reject -> quality = 0 -> OEE = 0 (good=0, total>0)
  'all-rejects': { planned: 480, downtime: 60, rated: 1200, good: 0, reject: 5000 },
  // no planned time -> availability guard returns 0, no Infinity/NaN
  'zero-planned': { planned: 0, downtime: 0, rated: 1200, good: 0, reject: 0 },
};

function applyPreset(name: string): void {
  const p = presets[name];
  if (!p) return;
  if (inEls.planned) inEls.planned.value = String(p.planned);
  if (inEls.downtime) inEls.downtime.value = String(p.downtime);
  if (inEls.rated) inEls.rated.value = String(p.rated);
  if (inEls.good) inEls.good.value = String(p.good);
  if (inEls.reject) inEls.reject.value = String(p.reject);
  render();
}

/* ---------- wire ---------- */
Object.values(inEls).forEach((el) => {
  if (el) el.addEventListener('input', render);
});

document.querySelectorAll<HTMLButtonElement>('.oee-preset').forEach((btn) => {
  btn.addEventListener('click', () => {
    const name = btn.dataset.preset;
    if (name) applyPreset(name);
  });
});

/* ---------- init ---------- */
render();
