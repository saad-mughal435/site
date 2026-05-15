/**
 * Mixing Section: CIP records, raw material checklist, filter replacement,
 * mixing area daily checklist, and RO plant weekly checklist.
 */
import { authenticatedFetch } from '../auth.js?v=20260428b';
import { showToast } from '../utils.js?v=20260129a';

const SIGN_NAMES = ['Zeeshan Alam', 'Zeeshan Ahmad', 'Umer', 'Zeeshan Iqbal', 'Usman'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function _monthName(m) {
  const n = parseInt(m, 10);
  if (!n || n < 1 || n > 12) return '';
  return MONTH_NAMES[n - 1];
}
const CIP_TANKS = [
  { key: '1', label: 'Tank 1' },
  { key: '2', label: 'Tank 2' },
  { key: '3', label: 'Tank 3' },
  { key: '4', label: 'Tank 4' },
  { key: '5', label: 'Tank 5' },
  { key: '6', label: 'Tank 6' },
  { key: 'ro-tank-01', label: 'RO Tank 01' },
  { key: 'ro-tank-02', label: 'RO Tank 02' },
  { key: 'ro-tank-mmf-01', label: 'RO Tank MMF 01' },
  { key: 'raw-water-tank-02', label: 'Raw Water Tank 02' },
  { key: 'chemical-tank', label: 'Chemical Tank' },
  { key: 'sugar-tank', label: 'Sugar Syrup Tank' },
  { key: 'dissolver', label: 'Dissolver' },
];
const CIP_TANK_KEYS = CIP_TANKS.map((item) => item.key);
const CIP_TANK_LABELS = Object.fromEntries(CIP_TANKS.map((item) => [item.key, item.label]));
const STANDALONE_CIP_TANK_KEYS = new Set(['sugar-tank', 'dissolver']);
const SOLUTION_OPTIONS = ['Hot Water', 'Caustic 85C 1.7%', 'Topaz MD3 0.2%', 'Acid 1.3%', 'Oxonia 0.2% (80 ppm)', 'RO Water'];
const CIP_TYPE_CONFIG = {
  '3_step': {
    label: '3 Step CIP',
    addLabel: 'Add 3 STEP CIP',
    title: '3 STEP C.I.P PROCEDURE AND CHECKLIST',
    doc_ref: 'KBF/PRD/58',
    issue_no: '01',
    effective_date: '24/11/2014',
    revision_date: '21/08/2019',
    solutionRows: 7,
    procedure_lines: [
      'THIS PROCEDURE IS TO BE FOLLOWED TWICE A WEEK AND BEFORE STARTUP OF A PRODUCTION LINE.',
      'TO BE FOLLOWED ONCE A DAY WITH A TANK CIP.',
      'The three-step cleaning procedure can be used when the more thorough five-step process is not necessary, but sanitizing the equipment is required. The three-step cleaning consists of the following:',
      '1.1 Step 1 - Rinse with treated water for 5-10 minutes (ambient temperature).',
      'The first rinse is important to minimize the soil load. This removes most of the soluble material and increases the effectiveness of the cleaning agent.',
      '1.2 Step 2 - Rinse with 1-1.7% MIP CA ECOLAB at 66-85C.',
      'Allow solution to circulate for 20 to 30 minutes. The cleaning agent loosens residual soil particles from the surface of equipment. The hot water acts as a mild cleaning agent and a sanitizing agent to destroy microbial contamination. Check for color change.',
      '1.3 Step 3 - Rinse with treated water for 10-15 minutes.',
      'Rinse thoroughly until no trace of cleaning agent remains in the final rinse water. Check the final rinse water for caustic using phenolphthalein indicator. Call QC to check biotrace and/or swabs.',
      'Corrective action on biotrace instrument:',
      'If the biotrace result is "Caution", rinse for another 5 minutes with treated water.',
      'If the biotrace result is "Fail", run CIP again and take another biotrace test.',
    ],
  },
  '5_step': {
    label: '5 Step CIP',
    addLabel: 'Add 5 STEP CIP',
    title: '5 STEP C.I.P PROCEDURE AND CHECKLIST',
    doc_ref: 'KBF/PRD/57',
    issue_no: '01',
    effective_date: '24/11/2014',
    revision_date: '21/08/2019',
    solutionRows: 7,
    procedure_lines: [
      'THIS PROCEDURE IS TO BE FOLLOWED ONCE A WEEK.',
      'The five-step cleaning process forms the basis of a deep-cleaning and sanitizing program for all product contact surfaces. The five-step procedure consists of the following:',
      '1.1 Step 1 - Rinse with treated water for 5-10 minutes (ambient temperature).',
      'The first rinse is important to minimize the soil load. This removes most of the soluble material and increases the effectiveness of the cleaning agent.',
      '1.2 Step 2 - Rinse with 1-1.7% MIP CA ECOLAB at 66-85C.',
      'Allow solution to circulate for 20 to 30 minutes. The cleaning agent loosens residual soil particles from the surface of equipment.',
      '1.3 Step 3 - Rinse with treated water for 5-10 minutes.',
      'Rinse until no trace of caustic solution remains. The rinse with treated water removes all traces of cleaning detergents and prevents redeposit of soil upon clean surfaces. Check with phenolphthalein indicator.',
      '1.4 Step 4 - Rinse with 2-4% P3-HOROLITH V at ambient temperature.',
      'Allow solution to circulate for 10 to 20 minutes. The sanitizing agent destroys microbial contamination.',
      '1.5 Step 5 - Rinse with treated water for 5-10 minutes.',
      'Ensure that all acidic residue is completely rinsed out of the system.',
      '1.6 Step 6 - Rinse with P3 OXONIA ACTIV for 10-20 minutes.',
      'Allow 0.5-1% solution to circulate for 10 to 20 minutes. It will disinfect the whole equipment.',
      'Final rinse with treated water for 10-15 minutes.',
      'Call QC to check biotrace and/or swabs. Check rinse water pH. Check manhole seal for deterioration.',
      'Corrective action on biotrace instrument:',
      'If the biotrace result is "Caution", rinse for another 5 minutes with treated water.',
      'If the biotrace result is "Fail", run CIP again and take another biotrace test.',
    ],
  },
  '5_step_foam': {
    label: '5 Step Foam CIP',
    addLabel: 'Add 5 STEP Foam CIP',
    title: '5 STEP Foam C.I.P PROCEDURE AND CHECKLIST',
    doc_ref: 'KBF/PRD/57.1',
    issue_no: '01',
    effective_date: '24/11/2014',
    revision_date: '21/08/2019',
    solutionRows: 7,
    procedure_lines: [
      'THIS PROCEDURE IS TO BE FOLLOWED ONCE A WEEK.',
      'The five-step cleaning process forms the basis of a deep-cleaning and sanitizing program for all product contact surfaces. The five-step procedure consists of the following:',
      '1.1 Step 1 - Rinse with treated water for 5 minutes (ambient temperature).',
      'The first rinse is important to minimize the soil load. This removes most of the soluble material and increases the effectiveness of the cleaning agent.',
      '1.2 Step 2 - Rinse with 2-4% P3-TOPAX MD3 ECOLAB (ambient temperature).',
      'Allow foam to remain on surfaces for 10 to 20 minutes. The cleaning agent loosens residual soil particles from the surface of equipment.',
      '1.3 Step 3 - Rinse with treated water for 5-10 minutes.',
      'Rinse until no trace of caustic foam remains. The rinse with treated water removes all traces of cleaning detergents and prevents redeposit of soil upon clean surfaces. Check with phenolphthalein indicator.',
      '1.4 Step 4 - Rinse with 2-4% P3-TOPAX 56 at ambient temperature.',
      'Allow foam to remain on surfaces for 10 to 20 minutes. The sanitizing agent destroys microbial contamination.',
      '1.5 Step 5 - Rinse with treated water for 5-10 minutes.',
      'Ensure that all acidic foam residue is completely rinsed out of the system.',
      '1.6 Step 6 - Rinse with P3 TOPAX 990 for 10-30 minutes.',
      'Allow 1% foam on surfaces for 10 to 20 minutes. It will disinfect the whole equipment.',
      'Final rinse with treated water for 10-15 minutes.',
      'Call QC to check biotrace and/or swabs. Check rinse water pH. Check manhole seal for deterioration.',
      'Corrective action on biotrace instrument:',
      'If the biotrace result is "Caution", rinse for another 5 minutes with treated water.',
      'If the biotrace result is "Fail", run CIP again and take another biotrace test.',
    ],
  },
};

const SUBTABS = [
  { key: 'cip', label: 'CIP' },
  { key: 'raw-material', label: 'Raw Material Checklist' },
  { key: 'filter-replacement', label: 'Filter Replacement' },
  { key: 'mixing-area', label: 'Mixing Area Checklist' },
  { key: 'ro-weekly', label: 'RO Plant Weekly' },
];

const MS_SUBTAB_ACTIVE_CLASS = 'ms-subtab-btn inline-flex items-center rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors';
const MS_SUBTAB_INACTIVE_CLASS = 'ms-subtab-btn inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50';
const MS_SELECT_BASE_CLASS = 'w-full px-2.5 py-1.5 text-[12px] font-medium text-slate-800 border border-slate-300 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400';

let _activeSubtab = 'cip';
let _cipData = null;
let _cipSelectedTank = '';
let _cipEditingHistoryId = '';
let _cipEditingSummary = '';
let _cipPendingFilterTank = '';
let _cipHistoryFilterTank = '';
let _rmiBatches = [];
let _rmiSelectedBatch = '';
let _rmiData = null;
const _autosaveTimers = {};
let _lastSavedSnapshots = {};

function _esc(s) {
  const t = document.createElement('div');
  t.textContent = s == null ? '' : String(s);
  return t.innerHTML;
}

function _cipTankLabel(tankNo) {
  const key = String(tankNo || '').trim();
  return CIP_TANK_LABELS[key] || key || 'Tank';
}

function _normalizeCipTank(tankNo, fallback = _cipSelectedTank) {
  const key = String(tankNo || '').trim();
  return CIP_TANK_KEYS.includes(key) ? key : fallback;
}

/** Parse fetch body as JSON; avoid opaque JSON.parse errors when server returns HTML (e.g. 500). */
async function _readResponseJson(r) {
  const text = await r.text();
  if (!text || !String(text).trim()) {
    throw new Error(`Empty server response (HTTP ${r.status})`);
  }
  const trimmed = String(text).trim();
  if (trimmed[0] !== '{' && trimmed[0] !== '[') {
    throw new Error(`Server did not return JSON (HTTP ${r.status}). Check the API logs or restart the backend.`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(e.message || 'Invalid JSON from server');
  }
}

async function _jsonOrThrow(r, fallback = 'Request failed') {
  const data = await _readResponseJson(r);
  if (!r.ok) {
    throw new Error(data.detail || data.message || r.statusText || fallback);
  }
  return data;
}

function _formatRmiQty(value, uom = '') {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  const maxDecimals = Math.abs(n - Math.round(n)) < 0.00005 ? 0 : 4;
  const qty = n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals });
  return uom ? `${qty} ${uom}` : qty;
}

function _currentTimeHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function _autoFillTimeInput(inputEl) {
  if (!inputEl || inputEl.tagName !== 'INPUT' || inputEl.type !== 'time') return;
  if (String(inputEl.value || '').trim()) return;
  inputEl.value = _currentTimeHHMM();
  inputEl.dispatchEvent(new Event('change', { bubbles: true }));
}

function _defaultYm() {
  const d = new Date();
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function _todayIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _ymFromDateString(value) {
  const text = String(value || '').trim();
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = parseInt(m[1], 10);
  const month = parseInt(m[2], 10);
  if (!year || month < 1 || month > 12) return null;
  return { year, month };
}

function _opsDateInputId(panelKey) {
  if (panelKey === 'filter-replacement') return 'ms-fr-date';
  if (panelKey === 'mixing-area') return 'ms-ma-date';
  if (panelKey === 'ro-weekly') return 'ms-ro-date';
  return '';
}

function _bindOpsAutosaveEvents(el, panelKey) {
  if (!el) return;
  const onSave = () => _queueOpsAutosave(panelKey);
  el.addEventListener('input', onSave);
  el.addEventListener('change', onSave);
}

function _defaultWeek() {
  const d = new Date();
  const y = d.getFullYear();
  const oneJan = new Date(y, 0, 1);
  const day = Math.floor((d - oneJan) / 86400000);
  const w = Math.min(53, Math.max(1, Math.ceil((day + oneJan.getDay() + 1) / 7)));
  return { year: y, week: w };
}

function _selectHtml(options, selected, attrs = '') {
  const rawAttrs = String(attrs || '');
  const clsMatch = rawAttrs.match(/\bclass=(["'])(.*?)\1/i);
  const extraCls = clsMatch ? clsMatch[2] : '';
  const cleanedAttrs = rawAttrs.replace(/\s*\bclass=(["']).*?\1/ig, '').trim();
  const cls = extraCls ? `${MS_SELECT_BASE_CLASS} ${extraCls}` : MS_SELECT_BASE_CLASS;
  return `<select ${cleanedAttrs} class="${cls}">${
    options.map(o => `<option value="${_esc(o)}" ${o === selected ? 'selected' : ''}>${_esc(o)}</option>`).join('')
  }</select>`;
}

function _signCheckboxes(selectedNames, prefix, rowIndex) {
  const names = Array.isArray(selectedNames) ? selectedNames : [];
  const isRmi = prefix === 'rmi-sign';
  if (isRmi) {
    return `<div class="flex flex-wrap gap-1.5">${SIGN_NAMES.map((n) =>
      `<label class="inline-flex items-center gap-1.5 cursor-pointer rounded-full border border-slate-200 bg-white px-2.5 py-1 shadow-sm hover:bg-slate-50">
        <input type="checkbox" ${names.includes(n) ? 'checked' : ''}
          data-sign-prefix="${prefix}" data-sign-row="${rowIndex}" data-sign-name="${_esc(n)}"
          class="ms-sign-cb h-3.5 w-3.5 rounded border-slate-400 text-blue-600 focus:ring-blue-500" />
        <span class="text-[11px] font-semibold text-slate-700">${_esc(n)}</span>
      </label>`
    ).join('')}</div>`;
  }
  return `<div class="flex flex-col gap-0.5">${SIGN_NAMES.map(n =>
    `<label class="inline-flex items-center gap-1 text-[10px] whitespace-nowrap cursor-pointer">
      <input type="checkbox" ${names.includes(n) ? 'checked' : ''}
        data-sign-prefix="${prefix}" data-sign-row="${rowIndex}" data-sign-name="${_esc(n)}" class="ms-sign-cb" />
      ${_esc(n)}
    </label>`
  ).join('')}</div>`;
}

function _setStatus(text, type = 'info') {
  const el = document.getElementById('ms-status');
  if (el) {
    el.textContent = text;
    el.className = 'text-xs mb-2 ' + (type === 'error' ? 'text-red-500 font-semibold' : type === 'success' ? 'text-green-600' : 'text-slate-400');
  }
  const pill = document.getElementById('ms-cip-save-indicator');
  if (pill) {
    pill.textContent = text || '';
    pill.className = 'text-[11px] ' + (type === 'error' ? 'text-red-500 font-semibold' : type === 'success' ? 'text-green-600' : 'text-slate-500');
  }
}

// ============================================================================
// Autosave
// ============================================================================

function _queueAutosave(scope, saveFn) {
  if (_autosaveTimers[scope]?.timer) clearTimeout(_autosaveTimers[scope].timer);
  _autosaveTimers[scope] = {
    saveFn,
    timer: setTimeout(async () => {
      const entry = _autosaveTimers[scope];
      if (!entry) return;
      delete _autosaveTimers[scope];
      _setStatus('Saving...', 'info');
      try {
        await entry.saveFn();
        _setStatus('Saved', 'success');
      } catch (e) {
        console.error('Autosave failed:', e);
        _setStatus('Save failed - click to retry', 'error');
      }
    }, 2000),
  };
}

async function _flushAllAutosaves() {
  const entries = Object.entries(_autosaveTimers);
  for (const [scope, entry] of entries) {
    if (entry?.timer) clearTimeout(entry.timer);
    delete _autosaveTimers[scope];
  }
  if (!entries.length) return;
  _setStatus('Saving...', 'info');
  try {
    for (const [, entry] of entries) {
      if (entry?.saveFn) await entry.saveFn();
    }
    _setStatus('Saved', 'success');
  } catch (e) {
    console.error('Autosave flush failed:', e);
    _setStatus('Save failed - click to retry', 'error');
    throw e;
  }
}

function _hasPendingAutosaves() {
  return Object.keys(_autosaveTimers).length > 0;
}

window.addEventListener('beforeunload', (event) => {
  if (!_hasPendingAutosaves()) return;
  void _flushAllAutosaves();
  event.preventDefault();
  event.returnValue = '';
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden' || !_hasPendingAutosaves()) return;
  void _flushAllAutosaves().catch(() => {});
});

// Refresh the CIP form when the user comes back to the tab - picks up
// changes propagated from the QC side without requiring a manual reload.
// Skipped while autosaves are in flight so we never clobber live typing.
function _isMixingSectionVisible() {
  const root = document.getElementById('view-mixing-section');
  return !!root && !root.classList.contains('hidden') && root.offsetParent !== null;
}

async function _refreshCipFromServer() {
  if (_activeSubtab !== 'cip') return;
  if (!_isMixingSectionVisible()) return;
  if (_hasPendingAutosaves()) return;
  if (!_cipSelectedTank) {
    _loadCipHistory();
    _loadCipPendingAssignments();
    return;
  }
  try {
    let nextData = null;
    if (_cipEditingHistoryId) {
      const r = await authenticatedFetch(
        `/api/mixing/tanks/${encodeURIComponent(_cipSelectedTank)}/cip/history/${encodeURIComponent(_cipEditingHistoryId)}`
      );
      const entry = await _jsonOrThrow(r, 'Refresh failed');
      nextData = entry?.data || null;
    } else {
      const r = await authenticatedFetch(`/api/mixing/tanks/${encodeURIComponent(_cipSelectedTank)}/cip`);
      nextData = await _jsonOrThrow(r, 'Refresh failed');
    }
    if (nextData && JSON.stringify(nextData) !== JSON.stringify(_cipData || {})) {
      _cipData = nextData;
      _renderCipBlocks();
    }
  } catch (e) {
    console.warn('CIP focus refresh skipped:', e?.message || e);
  }
  _loadCipHistory();
  _loadCipPendingAssignments();
}

window.addEventListener('focus', () => { void _refreshCipFromServer(); });

// ============================================================================
// Shell / Subtab Switching
// ============================================================================

function _buildShell() {
  const subtabs = document.getElementById('ms-subtabs');
  const root = document.getElementById('ms-panels-root');
  if (!subtabs || !root) return;

  subtabs.innerHTML = SUBTABS.map(d =>
    `<button type="button" data-ms-tab="${d.key}" class="${MS_SUBTAB_INACTIVE_CLASS}">${_esc(d.label)}</button>`
  ).join('');

  root.innerHTML = `
    <div id="ms-panel-cip" class="ms-panel hidden rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm"></div>
    <div id="ms-panel-raw-material" class="ms-panel hidden rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm"></div>
    <div id="ms-panel-filter-replacement" class="ms-panel hidden rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm"></div>
    <div id="ms-panel-mixing-area" class="ms-panel hidden rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm"></div>
    <div id="ms-panel-ro-weekly" class="ms-panel hidden rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm"></div>
  `;

  subtabs.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-ms-tab]');
    if (!btn) return;
    await _flushAllAutosaves();
    _switchSubtab(btn.getAttribute('data-ms-tab'));
  });
}

function _applySubtabStyles(activeKey) {
  document.querySelectorAll('.ms-subtab-btn').forEach((btn) => {
    const on = btn.getAttribute('data-ms-tab') === activeKey;
    btn.className = on ? MS_SUBTAB_ACTIVE_CLASS : MS_SUBTAB_INACTIVE_CLASS;
  });
}

function _switchSubtab(key) {
  _activeSubtab = key;
  _applySubtabStyles(key);
  document.querySelectorAll('.ms-panel').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById(`ms-panel-${key}`);
  if (panel) {
    panel.classList.remove('hidden');
    _setStatus('', 'info');
  }

  switch (key) {
    case 'cip': _renderCipPanel(); _loadCip(); break;
    case 'raw-material': _renderRmiPanel(); _loadBatchOptions().then(() => _loadRmi()); break;
    case 'filter-replacement': _renderFilterPanel(); _loadOps('filter-replacement'); break;
    case 'mixing-area': _renderMixingAreaPanel(); _loadOps('mixing-area'); break;
    case 'ro-weekly': _renderRoPanel(); _loadOps('ro-weekly'); break;
  }
}

// ============================================================================
// CIP Subtab
// ============================================================================

function _renderCipPanel() {
  const panel = document.getElementById('ms-panel-cip');
  if (!panel || panel.dataset.built) return;
  panel.dataset.built = '1';

  const tankFilterOptions = `<option value="">All tanks</option>${CIP_TANKS.map((t) => `<option value="${_esc(t.key)}">${_esc(t.label)}</option>`).join('')}`;

  panel.innerHTML = `
    <div class="ms-cip-editor-header">
      <div class="ms-cip-title-group">
        <h3 class="ms-cip-panel-title">Tank CIP</h3>
        <span id="ms-cip-page-count" class="ms-cip-page-count">0 pages</span>
        <span id="ms-cip-save-indicator" class="text-[11px] text-slate-500"></span>
      </div>
      <div class="ms-cip-inline-actions">
        <button type="button" id="ms-cip-new-btn" class="ms-btn">New CIP</button>
        <button type="button" id="ms-cip-save-btn" class="ms-btn ms-btn-primary">Save CIP</button>
        <button type="button" id="ms-cip-delete-open-btn" class="ms-btn ms-btn-danger hidden">Delete CIP</button>
      </div>
    </div>
    <div class="my-3 flex flex-wrap items-center gap-2">
      <label for="ms-cip-tank-select" class="text-xs font-semibold text-slate-700">Tank</label>
      <select id="ms-cip-tank-select" class="${MS_SELECT_BASE_CLASS} max-w-[220px]">
        <option value="">- Select tank -</option>
        ${CIP_TANKS.map((t) => `<option value="${_esc(t.key)}">${_esc(t.label)}</option>`).join('')}
      </select>
    </div>
    <p id="ms-cip-add-context" class="text-xs text-slate-600 mb-2">Select a tank from the dropdown above to start a CIP.</p>
    <div id="ms-cip-editor-body" class="hidden">
      <div class="ms-cip-add-buttons">
        ${Object.entries(CIP_TYPE_CONFIG).map(([k, v]) => `<button type="button" class="ms-btn ms-cip-add-btn" data-cip-add-type="${k}">${_esc(v.addLabel)}</button>`).join('')}
      </div>
      <div id="ms-cip-editing-note" class="hidden mb-3 text-xs text-slate-600"></div>
      <div id="ms-cip-blocks" class="ms-cip-blocks"></div>
    </div>
    <div class="mt-6 border-t border-slate-200 pt-4">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 class="text-sm font-semibold text-slate-700">Pending CIP</h3>
        <div class="flex items-center gap-2">
          <label for="ms-cip-pending-filter" class="text-xs text-slate-600">Filter</label>
          <select id="ms-cip-pending-filter" class="${MS_SELECT_BASE_CLASS} max-w-[180px]">${tankFilterOptions}</select>
        </div>
      </div>
      <div id="ms-cip-pending" class="text-xs text-slate-500"></div>
    </div>
    <div class="mt-6 border-t border-slate-200 pt-4">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h3 class="text-sm font-semibold text-slate-700">Assigned CIP</h3>
        <div class="flex items-center gap-2">
          <label for="ms-cip-history-filter" class="text-xs text-slate-600">Filter</label>
          <select id="ms-cip-history-filter" class="${MS_SELECT_BASE_CLASS} max-w-[180px]">${tankFilterOptions}</select>
        </div>
      </div>
      <div id="ms-cip-history" class="text-xs text-slate-500"></div>
    </div>
  `;

  panel.querySelectorAll('.ms-cip-add-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const cipType = btn.dataset.cipAddType || '3_step';
      _addCipBlock(cipType);
    });
  });
  panel.querySelector('#ms-cip-save-btn').addEventListener('click', _saveCipHistory);
  panel.querySelector('#ms-cip-delete-open-btn').addEventListener('click', _deleteOpenCipHistory);
  panel.querySelector('#ms-cip-new-btn').addEventListener('click', _newCipForm);
  panel.querySelector('#ms-cip-tank-select').addEventListener('change', (e) => _onCipTankSelectChange(e.target.value));
  panel.querySelector('#ms-cip-history-filter').addEventListener('change', (e) => {
    _cipHistoryFilterTank = _normalizeFilterTank(e.target.value);
    _loadCipHistory();
  });
  panel.querySelector('#ms-cip-pending-filter').addEventListener('change', (e) => {
    _cipPendingFilterTank = _normalizeFilterTank(e.target.value);
    _loadCipPendingAssignments();
  });
  _applyCipEditorVisibility();
  _setCipEditingState('', '');
}

function _normalizeFilterTank(value) {
  const key = String(value || '').trim();
  return CIP_TANK_KEYS.includes(key) ? key : '';
}

function _applyCipEditorVisibility() {
  const body = document.getElementById('ms-cip-editor-body');
  const ctx = document.getElementById('ms-cip-add-context');
  const sel = document.getElementById('ms-cip-tank-select');
  if (sel && sel.value !== _cipSelectedTank) sel.value = _cipSelectedTank;
  if (_cipSelectedTank) {
    if (body) body.classList.remove('hidden');
    if (ctx) ctx.textContent = `Add CIP for ${_cipTankLabel(_cipSelectedTank)}`;
  } else {
    if (body) body.classList.add('hidden');
    if (ctx) ctx.textContent = 'Select a tank from the dropdown above to start a CIP.';
  }
}

async function _onCipTankSelectChange(nextKey) {
  const safe = String(nextKey || '').trim();
  const resolved = safe && CIP_TANK_KEYS.includes(safe) ? safe : '';
  if (resolved === _cipSelectedTank) {
    _applyCipEditorVisibility();
    return;
  }
  await _flushAllAutosaves();
  _cipSelectedTank = resolved;
  _setCipEditingState('', '');
  _cipData = { blocks: [] };
  _applyCipEditorVisibility();
  _renderCipBlocks();
  // Always start with a blank page on tank selection. Wipe any residual
  // server-side draft so a refresh doesn't bring back stale state.
  if (resolved) {
    try {
      await _saveCipDraft();
    } catch (e) {
      console.error('Failed to clear CIP draft on tank switch', e);
    }
  }
  _loadCipHistory();
  _loadCipPendingAssignments();
}

function _buildCipPayload() {
  const blocks = (_cipData?.blocks || []).map(b => {
    const solRows = (b.solution_rows || []).map(r => ({
      time_start: r.time_start || '',
      time_finish: r.time_finish || '',
      solution: r.solution || '',
      sign: r.sign || [],
    }));
    return {
      id: b.id || '',
      cip_type: b.cip_type || '3_step',
      date: b.date || '',
      tank_no: _cipSelectedTank,
      start_time: b.start_time || '',
      finish_time: b.finish_time || '',
      cleaning_sequence: b.cleaning_sequence || '',
      solution_rows: solRows,
      tank_mixing_sign_names: b.tank_mixing_sign_names || [],
      rinsing_done: Boolean(b.rinsing_done),
      rinsing_date: b.rinsing_done ? (b.rinsing_date || '') : '',
      mixing_comments: b.mixing_comments || '',
    };
  });
  return { blocks };
}

function _setCipEditingState(entryId = '', summary = '') {
  _cipEditingHistoryId = entryId || '';
  _cipEditingSummary = summary || '';

  const saveBtn = document.getElementById('ms-cip-save-btn');
  const deleteBtn = document.getElementById('ms-cip-delete-open-btn');
  const note = document.getElementById('ms-cip-editing-note');

  if (saveBtn) {
    saveBtn.textContent = _cipEditingHistoryId ? 'Update CIP' : 'Save CIP';
  }
  if (deleteBtn) {
    deleteBtn.classList.toggle('hidden', !_cipEditingHistoryId);
  }
  if (note) {
    if (_cipEditingHistoryId) {
      note.textContent = _cipEditingSummary
        ? `Editing saved CIP: ${_cipEditingSummary}`
        : `Editing saved CIP: ${_cipEditingHistoryId}`;
      note.classList.remove('hidden');
    } else {
      note.textContent = '';
      note.classList.add('hidden');
    }
  }
}

async function _loadCip() {
  _setCipEditingState('', '');
  if (!_cipSelectedTank) {
    _cipData = { blocks: [] };
    _renderCipBlocks();
    _loadCipHistory();
    _loadCipPendingAssignments();
    return;
  }
  try {
    const r = await authenticatedFetch(`/api/mixing/tanks/${encodeURIComponent(_cipSelectedTank)}/cip`);
    _cipData = await _jsonOrThrow(r, 'Load failed');
  } catch (e) {
    console.error(e);
    _cipData = { blocks: [] };
  }
  _renderCipBlocks();
  _loadCipHistory();
  _loadCipPendingAssignments();
}

function _renderCipBlocks() {
  const host = document.getElementById('ms-cip-blocks');
  if (!host || !_cipData) return;
  const blocks = _cipData.blocks || [];
  const pageCountEl = document.getElementById('ms-cip-page-count');
  if (pageCountEl) {
    pageCountEl.textContent = `${blocks.length} ${blocks.length === 1 ? 'page' : 'pages'}`;
  }
  if (!blocks.length) {
    host.innerHTML = '<p class="text-xs text-slate-400">No CIP blocks. Click "Add Block" to start.</p>';
    return;
  }
  host.innerHTML = blocks.map((block, bi) => {
    const cfg = CIP_TYPE_CONFIG[block.cip_type] || CIP_TYPE_CONFIG['3_step'];
    const rows = block.solution_rows || [];
    const signNames = Array.isArray(block.tank_mixing_sign_names) ? block.tank_mixing_sign_names : [];

    const solutionRowsHtml = rows.map((row, ri) => {
      let signCellHtml = '';
      if (ri === 0) {
        signCellHtml = `<td class="ms-cip-sign-cell" rowspan="${rows.length}" style="vertical-align:top;">
          <div style="display:flex;flex-direction:column;gap:4px;padding:4px 2px;">
            ${SIGN_NAMES.map(name => `
              <label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap;font-size:0.82em;">
                <input type="checkbox" ${signNames.includes(name) ? 'checked' : ''}
                  data-sign-prefix="cip-sign" data-sign-row="${bi}" data-sign-name="${_esc(name)}" class="ms-sign-cb" />
                <span>${_esc(name)}</span>
              </label>
            `).join('')}
          </div>
        </td>`;
      }
      return `
        <tr>
          <td><input type="time" class="ms-cip-input ms-cip-sol" value="${_esc(row.time_start)}" data-bi="${bi}" data-ri="${ri}" data-sf="time_start" /></td>
          <td><input type="time" class="ms-cip-input ms-cip-sol" value="${_esc(row.time_finish)}" data-bi="${bi}" data-ri="${ri}" data-sf="time_finish" /></td>
          <td>${_selectHtml(['', ...SOLUTION_OPTIONS], row.solution || '', `class="ms-cip-sol" data-bi="${bi}" data-ri="${ri}" data-sf="solution"`)}</td>
          ${signCellHtml}
        </tr>`;
    }).join('');

    const isFirst = bi === 0;
    const isLast = bi === blocks.length - 1;
    return `
    <article class="ms-cip-block" data-block-idx="${bi}">
      <div class="ms-cip-block-header">
        <div class="ms-cip-title-wrap">
          <h4 class="ms-cip-title">${_esc(cfg.title || cfg.label)}</h4>
          <span class="ms-cip-doc">Doc.Ref.: ${_esc(cfg.doc_ref || '')} | Issue: ${_esc(cfg.issue_no || '')} | Effective: ${_esc(cfg.effective_date || '')} | Revision: ${_esc(cfg.revision_date || '')}</span>
        </div>
        <div class="ms-cip-controls">
          <span class="ms-cip-order-badge">Order ${bi + 1}</span>
          <button type="button" class="ms-cip-mini-btn ms-cip-move-up" data-block-idx="${bi}" ${isFirst ? 'disabled' : ''} aria-label="Move up">&#8593;</button>
          <button type="button" class="ms-cip-mini-btn ms-cip-move-down" data-block-idx="${bi}" ${isLast ? 'disabled' : ''} aria-label="Move down">&#8595;</button>
          <button type="button" class="ms-cip-mini-btn ms-cip-remove-block" data-block-idx="${bi}" aria-label="Remove block">&times;</button>
        </div>
      </div>

      <details class="ms-cip-procedure" open style="margin:4px 0 10px 0;">
        <summary style="cursor:pointer;font-size:0.82em;font-weight:700;color:#1e293b;padding:4px 0;">Procedure Steps</summary>
        <div style="margin-top:6px;padding:8px 10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:0.78em;line-height:1.45;color:#334155;">
          ${(Array.isArray(cfg.procedure_lines) ? cfg.procedure_lines : []).map(line => `<p style="margin:0 0 4px 0;">${_esc(line)}</p>`).join('')}
        </div>
      </details>

      <div class="ms-cip-grid">
        <label class="ms-cip-field">
          <span>Date</span>
          <input type="date" class="ms-cip-input" data-bi="${bi}" data-field="date" value="${_esc(block.date)}" />
        </label>
        <label class="ms-cip-field">
          <span>Tank No.</span>
          <span class="inline-flex items-center px-2 py-1 rounded-md bg-slate-100 text-slate-700 text-sm font-medium">${_esc(_cipTankLabel(_cipSelectedTank))}</span>
        </label>
        <label class="ms-cip-field">
          <span>Start Time</span>
          <input type="time" class="ms-cip-input" data-bi="${bi}" data-field="start_time" value="${_esc(block.start_time)}" />
        </label>
        <label class="ms-cip-field">
          <span>Finish Time</span>
          <input type="time" class="ms-cip-input" data-bi="${bi}" data-field="finish_time" value="${_esc(block.finish_time)}" />
        </label>
      </div>

      <p class="ms-cip-order-line" style="margin:6px 0 8px 0;font-size:0.85em;color:#334155;"><strong>Order:</strong> ${_esc(block.cleaning_sequence || 'Hot Water - Caustic - Oxonia - RO Water')}</p>

      <table class="ms-cip-table">
        <thead>
          <tr>
            <th>Time Start</th>
            <th>Time Finish</th>
            <th>Solution</th>
            <th>Sign</th>
          </tr>
        </thead>
        <tbody>${solutionRowsHtml}</tbody>
      </table>

      <div class="ms-cip-rinsing" style="margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer;font-size:0.85em;font-weight:600;color:#475569;">
          <input type="checkbox" class="ms-cip-rinsing-cb" data-bi="${bi}" ${block.rinsing_done ? 'checked' : ''} />
          <span>Rinsing${block.rinsing_done ? ` (${_esc(_cipTankLabel(block.tank_no || _cipSelectedTank))})` : ''}</span>
        </label>
        <input type="date" class="ms-cip-rinsing-date" data-bi="${bi}"
          value="${_esc(block.rinsing_date || '')}"
          style="font-size:0.85em;padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;${block.rinsing_done ? '' : 'display:none;'}" />
      </div>

      <div class="ms-cip-comments" style="margin-top:10px;">
        <label style="display:block;font-size:0.78em;font-weight:600;color:#475569;margin-bottom:4px;">Comments</label>
        <textarea class="ms-cip-comments-input" data-bi="${bi}" rows="2"
          placeholder="Notes for QC (auto-shared with QC menu)..."
          style="width:100%;font-size:0.85em;border:1px solid #cbd5e1;border-radius:6px;padding:6px 8px;resize:vertical;">${_esc(block.mixing_comments || '')}</textarea>
      </div>
    </article>`;
  }).join('');

  host.querySelectorAll('.ms-cip-remove-block').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.blockIdx);
      if (_cipData && _cipData.blocks) {
        _cipData.blocks.splice(idx, 1);
        _renderCipBlocks();
        _queueAutosave(`cip-${_cipSelectedTank}`, _saveCipDraft);
      }
    });
  });

  host.querySelectorAll('.ms-cip-move-up').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.blockIdx);
      if (!_cipData?.blocks || idx <= 0) return;
      const arr = _cipData.blocks;
      [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
      _renderCipBlocks();
      _queueAutosave(`cip-${_cipSelectedTank}`, _saveCipDraft);
    });
  });

  host.querySelectorAll('.ms-cip-move-down').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.blockIdx);
      if (!_cipData?.blocks || idx < 0 || idx >= _cipData.blocks.length - 1) return;
      const arr = _cipData.blocks;
      [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
      _renderCipBlocks();
      _queueAutosave(`cip-${_cipSelectedTank}`, _saveCipDraft);
    });
  });

  host.querySelectorAll('.ms-cip-input[data-field]').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const bi = parseInt(e.target.dataset.bi);
      const field = e.target.dataset.field;
      if (_cipData?.blocks?.[bi]) {
        _cipData.blocks[bi][field] = e.target.value;
        _queueAutosave(`cip-${_cipSelectedTank}`, _saveCipDraft);
      }
    });
  });

  host.querySelectorAll('.ms-cip-sol').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const bi = parseInt(e.target.dataset.bi);
      const ri = parseInt(e.target.dataset.ri);
      const sf = e.target.dataset.sf;
      if (_cipData?.blocks?.[bi]?.solution_rows?.[ri]) {
        _cipData.blocks[bi].solution_rows[ri][sf] = e.target.value;
        _queueAutosave(`cip-${_cipSelectedTank}`, _saveCipDraft);
      }
    });
  });

  host.querySelectorAll('input[type="time"].ms-cip-input, input[type="time"].ms-cip-sol').forEach(inp => {
    const onTouchTime = () => _autoFillTimeInput(inp);
    inp.addEventListener('focus', onTouchTime);
    inp.addEventListener('click', onTouchTime);
  });

  host.querySelectorAll('.ms-sign-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const bi = parseInt(e.target.dataset.signRow);
      const name = e.target.dataset.signName;
      if (!_cipData?.blocks?.[bi]) return;
      const block = _cipData.blocks[bi];
      let names = Array.isArray(block.tank_mixing_sign_names) ? [...block.tank_mixing_sign_names] : [];
      if (e.target.checked && !names.includes(name)) names.push(name);
      else names = names.filter(n => n !== name);
      block.tank_mixing_sign_names = names;
      _queueAutosave(`cip-${_cipSelectedTank}`, _saveCipDraft);
    });
  });

  host.querySelectorAll('.ms-cip-comments-input').forEach((ta) => {
    ta.addEventListener('input', (e) => {
      const bi = parseInt(e.target.dataset.bi);
      if (!_cipData?.blocks?.[bi]) return;
      _cipData.blocks[bi].mixing_comments = e.target.value;
      _queueAutosave(`cip-${_cipSelectedTank}`, _saveCipDraft);
    });
  });

  host.querySelectorAll('.ms-cip-rinsing-cb').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const bi = parseInt(e.target.dataset.bi);
      if (!_cipData?.blocks?.[bi]) return;
      _cipData.blocks[bi].rinsing_done = !!e.target.checked;
      if (!e.target.checked) _cipData.blocks[bi].rinsing_date = '';
      _renderCipBlocks();
      _queueAutosave(`cip-${_cipSelectedTank}`, _saveCipDraft);
    });
  });

  host.querySelectorAll('.ms-cip-rinsing-date').forEach((inp) => {
    inp.addEventListener('change', (e) => {
      const bi = parseInt(e.target.dataset.bi);
      if (!_cipData?.blocks?.[bi]) return;
      _cipData.blocks[bi].rinsing_date = e.target.value || '';
      _queueAutosave(`cip-${_cipSelectedTank}`, _saveCipDraft);
    });
  });
}

function _addCipBlock(cipType) {
  const resolvedType = (typeof cipType === 'string' && CIP_TYPE_CONFIG[cipType]) ? cipType : '3_step';
  const cfg = CIP_TYPE_CONFIG[resolvedType];
  if (!_cipData) _cipData = { blocks: [] };
  const block = {
    id: `${resolvedType}_${Date.now()}`,
    cip_type: resolvedType,
    date: '', tank_no: _cipSelectedTank, start_time: '', finish_time: '',
    cleaning_sequence: '',
    solution_rows: Array.from({ length: cfg.solutionRows }, () => ({ time_start: '', time_finish: '', solution: '', sign: [] })),
    tank_mixing_sign_names: [],
    rinsing_done: false,
    rinsing_date: '',
    mixing_comments: '',
  };
  _cipData.blocks.push(block);
  _renderCipBlocks();
  _queueAutosave(`cip-${_cipSelectedTank}`, _saveCipDraft);
}

async function _saveCipDraft() {
  if (!_cipData) return;
  if (!_cipSelectedTank) return;
  const payload = _buildCipPayload();
  const url = _cipEditingHistoryId
    ? `/api/mixing/tanks/${encodeURIComponent(_cipSelectedTank)}/cip/history/${encodeURIComponent(_cipEditingHistoryId)}`
    : `/api/mixing/tanks/${encodeURIComponent(_cipSelectedTank)}/cip`;
  const r = await authenticatedFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: payload }),
  });
  await _jsonOrThrow(r, 'Save failed');
}

async function _saveCipHistory() {
  if (!_cipSelectedTank) {
    showToast('Pick a tank first', 'error');
    return;
  }
  if (!_cipData?.blocks?.length) {
    showToast('Add at least one CIP block before saving', 'error');
    return;
  }
  try {
    await _flushAllAutosaves();
    const payload = _buildCipPayload();
    const isUpdate = Boolean(_cipEditingHistoryId);
    const url = isUpdate
      ? `/api/mixing/tanks/${encodeURIComponent(_cipSelectedTank)}/cip/history/${encodeURIComponent(_cipEditingHistoryId)}`
      : `/api/mixing/tanks/${encodeURIComponent(_cipSelectedTank)}/cip/history`;
    const method = isUpdate ? 'PUT' : 'POST';
    const r = await authenticatedFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: payload }),
    });
    await _jsonOrThrow(r, 'Save failed');
    showToast(isUpdate ? 'CIP updated' : 'CIP saved', 'success');
    await _resetCipFormSilent();
    _loadCipHistory();
    _loadCipPendingAssignments();
  } catch (e) {
    showToast(e.message || 'Save failed', 'error');
  }
}

async function _resetCipFormSilent() {
  _cipData = { blocks: [] };
  _setCipEditingState('', '');
  _renderCipBlocks();
  try {
    await _saveCipDraft();
  } catch (e) {
    console.error('Failed to clear CIP draft on backend', e);
  }
}

async function _newCipForm() {
  const hasBlocks = Boolean(_cipData?.blocks?.length);
  if (hasBlocks && !confirm('Clear the currently open CIP form? Any unsaved changes will be lost.')) return;
  await _resetCipFormSilent();
}

function _historyFlowText(entry) {
  let flow = Array.isArray(entry?.process_flow) ? entry.process_flow.filter(Boolean) : [];
  if (!flow.length) {
    const blocks = Array.isArray(entry?.data?.blocks) ? entry.data.blocks : [];
    flow = blocks
      .map((b) => (CIP_TYPE_CONFIG[b?.cip_type]?.label || b?.cip_type || ''))
      .filter(Boolean);
  }
  return flow.length ? flow.join(' -> ') : '-';
}

function _historySummary(entry) {
  const blockDate = Array.isArray(entry?.data?.blocks)
    ? String(entry.data.blocks.find((b) => b?.date)?.date || '').slice(0, 10)
    : '';
  const dateText = String(entry?.entry_date || blockDate || entry?.saved_at || '').slice(0, 10) || '-';
  const tankText = String(entry?.tank_name || _cipTankLabel(entry?.tank_no || _cipSelectedTank));
  const batchText = String(entry?.batch_no || entry?.assignment?.batch_no || '').trim();
  return `${dateText} | ${tankText}${batchText ? ` | Batch ${batchText}` : ''} | ${_historyFlowText(entry)}`;
}

function _cipEntryCardHtml(entry, mode = 'pending') {
  const dateText = _esc(String(entry?.entry_date || entry?.saved_at || '').slice(0, 10) || '-');
  const tankKey = String(entry?.tank_no || _cipSelectedTank);
  const tankText = _esc(entry?.tank_name || _cipTankLabel(tankKey));
  const batchText = String(entry?.batch_no || '').trim();
  const titleSuffix = mode === 'past'
    ? (batchText ? `Batch ${_esc(batchText)}` : (STANDALONE_CIP_TANK_KEYS.has(tankKey) ? 'Standalone' : 'Assigned'))
    : 'Pending';
  const active = Boolean(_cipEditingHistoryId && entry?.id === _cipEditingHistoryId);
  const cardClass = mode === 'past'
    ? (active ? 'border-slate-500 bg-slate-100' : 'border-slate-200 bg-slate-50')
    : (active ? 'border-amber-500 bg-amber-100' : 'border-amber-300 bg-amber-50');

  const safeHid = _esc(entry?.id || '');
  const safeTank = _esc(tankKey);
  const assignForm = mode === 'pending'
    ? `
        <div class="mt-1 flex items-center gap-1">
          <input type="text" class="ms-cip-assign-input border border-slate-300 rounded px-1 py-0.5 text-[11px] w-24" placeholder="Batch no" data-hid="${safeHid}" data-tank="${safeTank}" />
          <button type="button" class="ms-cip-assign-btn px-2 py-0.5 text-[10px] border border-emerald-400 text-emerald-700 rounded hover:bg-emerald-50" data-hid="${safeHid}" data-tank="${safeTank}">Assign</button>
        </div>
      `
    : '';

  return `
    <div class="rounded border ${cardClass} px-2 py-2">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <div class="text-[11px] font-semibold text-slate-700">${dateText} | ${tankText} | ${titleSuffix}</div>
          <div class="text-[11px] text-slate-600 mt-0.5">${_esc(_historyFlowText(entry))}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">Saved by ${_esc(entry?.saved_by || '-')}</div>
          ${assignForm}
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button type="button" class="ms-cip-card-edit px-2 py-1 text-[10px] border border-slate-300 rounded hover:bg-white" data-hid="${safeHid}" data-tank="${safeTank}">Edit</button>
          <button type="button" class="ms-cip-card-delete px-2 py-1 text-[10px] border border-red-300 text-red-700 rounded hover:bg-red-50" data-hid="${safeHid}" data-tank="${safeTank}">Delete</button>
        </div>
      </div>
    </div>
  `;
}

function _bindCipCardActions(container) {
  if (!container) return;
  container.querySelectorAll('.ms-cip-card-edit').forEach((btn) => {
    btn.addEventListener('click', () => _editCipHistory(btn.dataset.hid, btn.dataset.tank));
  });
  container.querySelectorAll('.ms-cip-card-delete').forEach((btn) => {
    btn.addEventListener('click', () => _deleteCipHistory(btn.dataset.hid, btn.dataset.tank));
  });
  container.querySelectorAll('.ms-cip-assign-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = container.querySelector(`.ms-cip-assign-input[data-hid="${btn.dataset.hid}"][data-tank="${btn.dataset.tank}"]`);
      const batchNo = input ? String(input.value || '').trim() : '';
      _assignPendingCipToBatch(btn.dataset.tank, btn.dataset.hid, batchNo);
    });
  });
  container.querySelectorAll('.ms-cip-assign-input').forEach((inp) => {
    inp.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const batchNo = String(inp.value || '').trim();
      _assignPendingCipToBatch(inp.dataset.tank, inp.dataset.hid, batchNo);
    });
  });
}

async function _assignPendingCipToBatch(tankNo, entryId, batchNo) {
  const safeTank = String(tankNo || '').trim();
  const safeEntry = String(entryId || '').trim();
  const safeBatch = String(batchNo || '').trim();
  if (!safeBatch) {
    showToast('Enter a batch number', 'error');
    return;
  }
  if (!safeTank || !safeEntry) {
    showToast('Cannot assign: CIP reference missing', 'error');
    return;
  }
  try {
    const r = await authenticatedFetch(
      `/api/mixing/tanks/${encodeURIComponent(safeTank)}/cip/history/${encodeURIComponent(safeEntry)}/assign`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batch_no: safeBatch }),
      },
    );
    if (!r.ok) {
      let detail = '';
      try {
        const j = await r.json();
        detail = String(j?.detail || '').trim();
      } catch {}
      if (r.status === 404) {
        showToast(detail || 'No batch was found', 'error');
      } else {
        showToast(detail || `Assign failed (${r.status})`, 'error');
      }
      return;
    }
    showToast(`CIP assigned to ${safeBatch}`, 'success');
    _loadCipPendingAssignments();
    _loadCipHistory();
  } catch (err) {
    showToast(`Assign failed: ${err?.message || err}`, 'error');
  }
}

function _entryAssignments(entry) {
  if (!entry) return [];
  if (Array.isArray(entry.assignments) && entry.assignments.length) {
    return entry.assignments.filter((a) => a && String(a.batch_no || '').trim());
  }
  if (entry.is_assigned || String(entry.batch_no || '').trim()) {
    return [{
      batch_no: String(entry.batch_no || '').trim(),
      assigned_at: entry.assigned_at || '',
      assigned_by: entry.assigned_by || '',
      production_batch_id: entry.production_batch_id || null,
      reusable: Boolean(entry.reusable),
    }];
  }
  return [];
}

async function _loadCipHistory() {
  const filterSel = document.getElementById('ms-cip-history-filter');
  const listEl = document.getElementById('ms-cip-history');
  if (!listEl) return;
  if (filterSel && filterSel.value !== _cipHistoryFilterTank) filterSel.value = _cipHistoryFilterTank;
  try {
    const tankRows = await Promise.all(CIP_TANKS.map(async (tank) => {
      try {
        const r = await authenticatedFetch(`/api/mixing/tanks/${encodeURIComponent(tank.key)}/cip/history`);
        const data = await _jsonOrThrow(r, 'Failed to load history');
        const entries = Array.isArray(data.history) ? data.history : [];
        return { tank_no: tank.key, tank_name: tank.label, entries };
      } catch {
        return { tank_no: tank.key, tank_name: tank.label, entries: [] };
      }
    }));

    const cards = [];
    for (const row of tankRows) {
      if (_cipHistoryFilterTank && row.tank_no !== _cipHistoryFilterTank) continue;
      const isStandaloneTank = STANDALONE_CIP_TANK_KEYS.has(row.tank_no);
      for (const entry of row.entries) {
        const assignments = _entryAssignments(entry);
        if (!assignments.length) {
          if (!isStandaloneTank) continue;
          cards.push({
            sortKey: String(entry.saved_at || ''),
            entry: { ...entry, tank_no: row.tank_no, tank_name: row.tank_name, batch_no: '' },
          });
          continue;
        }
        for (const assignment of assignments) {
          cards.push({
            sortKey: String(assignment.assigned_at || entry.saved_at || ''),
            entry: { ...entry, tank_no: row.tank_no, tank_name: row.tank_name, batch_no: assignment.batch_no },
          });
        }
      }
    }
    cards.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

    if (!cards.length) {
      listEl.innerHTML = '<p class="text-slate-400">No assigned CIP records.</p>';
    } else {
      listEl.innerHTML = `<div class="space-y-2 max-h-64 overflow-y-auto">${cards.map(({ entry }) => _cipEntryCardHtml(entry, 'past')).join('')}</div>`;
      _bindCipCardActions(listEl);
    }
  } catch {
    listEl.innerHTML = '<p class="text-slate-400">Could not load history.</p>';
  }
}

async function _loadCipPendingAssignments() {
  const filterSel = document.getElementById('ms-cip-pending-filter');
  const listEl = document.getElementById('ms-cip-pending');
  if (!listEl) return;
  if (filterSel && filterSel.value !== _cipPendingFilterTank) filterSel.value = _cipPendingFilterTank;
  try {
    const r = await authenticatedFetch('/api/mixing/cip/pending');
    const data = await _jsonOrThrow(r, 'Failed to load pending assignments');
    const tankRowsRaw = Array.isArray(data.tanks) ? data.tanks : [];
    const cards = [];
    for (const tank of CIP_TANKS) {
      if (_cipPendingFilterTank && tank.key !== _cipPendingFilterTank) continue;
      const row = tankRowsRaw.find((x) => String(x?.tank_no || '') === String(tank.key));
      const pending = Array.isArray(row?.pending) ? row.pending : [];
      for (const entry of pending) {
        cards.push({
          sortKey: String(entry?.saved_at || ''),
          entry: { ...entry, tank_no: tank.key, tank_name: row?.tank_name || tank.label },
        });
      }
    }
    cards.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

    if (!cards.length) {
      listEl.innerHTML = '<p class="text-slate-400">No pending CIP assignments.</p>';
    } else {
      listEl.innerHTML = `<div class="space-y-2 max-h-64 overflow-y-auto">${cards.map(({ entry }) => _cipEntryCardHtml(entry, 'pending')).join('')}</div>`;
      _bindCipCardActions(listEl);
    }
  } catch {
    listEl.innerHTML = '<p class="text-slate-400">Could not load pending assignments.</p>';
  }
}

async function _editCipHistory(entryId, tankNo = _cipSelectedTank) {
  if (!entryId) return;
  try {
    await _flushAllAutosaves();
    const safeTank = _normalizeCipTank(tankNo, '') || tankNo;
    const finalTank = CIP_TANK_KEYS.includes(safeTank) ? safeTank : _cipSelectedTank;
    if (!finalTank) {
      showToast('Cannot edit: tank unknown', 'error');
      return;
    }
    if (_cipSelectedTank !== finalTank) {
      _cipSelectedTank = finalTank;
      _applyCipEditorVisibility();
    }
    const r = await authenticatedFetch(`/api/mixing/tanks/${encodeURIComponent(finalTank)}/cip/history/${encodeURIComponent(entryId)}`);
    const entry = await _jsonOrThrow(r, 'Failed to open CIP');
    const nextData = entry?.data && typeof entry.data === 'object' ? entry.data : { blocks: [] };
    _cipData = nextData;
    _setCipEditingState(entryId, _historySummary(entry));
    _renderCipBlocks();
    showToast('Saved CIP loaded for editing', 'success');
    _loadCipHistory();
    _loadCipPendingAssignments();
  } catch (e) {
    showToast(e.message || 'Failed to open CIP', 'error');
  }
}

async function _deleteOpenCipHistory() {
  if (!_cipEditingHistoryId) return;
  await _deleteCipHistory(_cipEditingHistoryId, _cipSelectedTank);
}

async function _deleteCipHistory(entryId, tankNo = _cipSelectedTank) {
  if (!entryId || !confirm('Delete this saved CIP record?')) return;
  try {
    const safeTank = _normalizeCipTank(tankNo);
    const r = await authenticatedFetch(`/api/mixing/tanks/${encodeURIComponent(safeTank)}/cip/history/${encodeURIComponent(entryId)}`, { method: 'DELETE' });
    await _jsonOrThrow(r, 'Delete failed');
    if (_cipEditingHistoryId === entryId && _cipSelectedTank === safeTank) {
      _setCipEditingState('', '');
    }
    showToast('CIP history deleted', 'success');
    _loadCipHistory();
    _loadCipPendingAssignments();
  } catch (e) {
    showToast(e.message || 'Delete failed', 'error');
  }
}

// ============================================================================
// Raw Material Checklist
// ============================================================================

function _renderRmiPanel() {
  const panel = document.getElementById('ms-panel-raw-material');
  if (!panel || panel.dataset.built) return;
  panel.dataset.built = '1';

  panel.innerHTML = `
    <div class="rounded-2xl border border-slate-300 bg-gradient-to-b from-white via-slate-50 to-slate-100 p-3 md:p-4 mb-3 shadow-sm">
      <div class="flex flex-wrap items-end gap-3 mb-3">
        <div class="flex-1 min-w-[220px]">
          <label class="block text-xs font-semibold text-slate-700 mb-1">Search / Select Batch</label>
          <input type="text" id="ms-rmi-search" class="w-full border border-slate-300 rounded-2xl text-sm px-3 py-2.5 mb-2 bg-white shadow-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400" placeholder="Type to filter..." />
          <select id="ms-rmi-batch" class="w-full border border-slate-300 rounded-2xl text-sm px-3 py-2.5 bg-white shadow-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400"></select>
        </div>
        <button type="button" id="ms-rmi-save" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full shadow-sm">Save</button>
        <button type="button" id="ms-rmi-pdf" class="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-full shadow-sm">Save as PDF</button>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-3 gap-2" id="ms-rmi-header">
        <div><label class="block text-xs font-semibold text-slate-700">Date</label><input type="date" id="ms-rmi-date" class="w-full px-2.5 py-1.5 text-[12px] font-semibold border border-slate-300 rounded-xl bg-white shadow-sm text-slate-900 ms-rmi-hdr focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400" data-hf="date" /></div>
        <div><label class="block text-xs font-semibold text-slate-700">Batch No</label><input type="text" id="ms-rmi-batchno" class="w-full px-2.5 py-1.5 text-[12px] font-semibold border border-slate-300 rounded-xl bg-slate-100 text-slate-700" readonly /></div>
        <div><label class="block text-xs font-semibold text-slate-700">Inspector Name</label>
          <select id="ms-rmi-inspector" class="w-full px-2.5 py-1.5 text-[12px] font-semibold border border-slate-300 rounded-xl bg-white shadow-sm text-slate-900 ms-rmi-hdr focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400" data-hf="inspector">
            <option value="">-</option>
            ${SIGN_NAMES.map(n => `<option value="${_esc(n)}">${_esc(n)}</option>`).join('')}
          </select>
        </div>
        <div class="md:col-span-3"><label class="block text-xs font-semibold text-slate-700">Recipe</label><input type="text" id="ms-rmi-recipe" class="w-full px-2.5 py-1.5 text-[12px] font-semibold border border-slate-300 rounded-xl bg-slate-100 text-slate-700" readonly /></div>
        <div class="md:col-span-3">
          <label class="block text-xs font-semibold text-slate-700 mb-1">Inspector Sign</label>
          <div id="ms-rmi-sheet-sign">${_signCheckboxes([], 'rmi-sign', 0)}</div>
        </div>
      </div>
    </div>
    <div class="overflow-x-auto border border-slate-300 rounded-2xl bg-white mb-4 shadow-sm">
      <table class="min-w-[1020px] w-full text-sm border-collapse">
        <thead class="text-slate-800 bg-slate-100">
          <tr>
            <th class="border border-slate-300 text-left px-2 py-2 text-[12px] font-bold">Raw Material / Ingredient</th>
            <th class="border border-slate-300 text-left px-2 py-2 text-[12px] font-bold">Weight</th>
            <th class="border border-slate-300 text-left px-2 py-2 text-[12px] font-bold">
              <div class="flex items-center justify-between gap-2">
                <span>Pest / Foreign Matter</span>
                <div class="flex gap-1">
                  <button type="button" class="px-2 py-0.5 text-[10px] font-semibold rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" data-rmi-bulk="pest_foreign" data-val="Yes">All Yes</button>
                  <button type="button" class="px-2 py-0.5 text-[10px] font-semibold rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100" data-rmi-bulk="pest_foreign" data-val="No">All No</button>
                </div>
              </div>
            </th>
            <th class="border border-slate-300 text-left px-2 py-2 text-[12px] font-bold">
              <div class="flex items-center justify-between gap-2">
                <span>Wet / Dirty</span>
                <div class="flex gap-1">
                  <button type="button" class="px-2 py-0.5 text-[10px] font-semibold rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" data-rmi-bulk="wet_dirty" data-val="Yes">All Yes</button>
                  <button type="button" class="px-2 py-0.5 text-[10px] font-semibold rounded-full border border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100" data-rmi-bulk="wet_dirty" data-val="No">All No</button>
                </div>
              </div>
            </th>
            <th class="border border-slate-300 text-left px-2 py-2 text-[12px] font-bold">Weight / Appearance</th>
            <th class="border border-slate-300 text-left px-2 py-2 text-[12px] font-bold">Code Comparison (Old/New)</th>
            <th class="border border-slate-300 text-left px-2 py-2 text-[12px] font-bold">
              <div class="flex items-center justify-between gap-2">
                <span>Status Pass/Fail</span>
                <div class="flex gap-1">
                  <button type="button" class="px-2 py-0.5 text-[10px] font-semibold rounded-full border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" data-rmi-bulk="status" data-val="Pass">All Pass</button>
                  <button type="button" class="px-2 py-0.5 text-[10px] font-semibold rounded-full border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100" data-rmi-bulk="status" data-val="Fail">All Fail</button>
                </div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody id="ms-rmi-tbody"></tbody>
      </table>
    </div>
  `;

  panel.querySelector('#ms-rmi-batch').addEventListener('change', async () => {
    await _flushAllAutosaves();
    _rmiSelectedBatch = panel.querySelector('#ms-rmi-batch').value;
    _loadRmi();
  });
  panel.querySelector('#ms-rmi-search').addEventListener('input', _filterBatchDropdown);
  panel.querySelector('#ms-rmi-pdf').addEventListener('click', _downloadRmiPdf);
  panel.querySelector('#ms-rmi-save')?.addEventListener('click', async () => {
    if (!_rmiSelectedBatch) { showToast('Select a batch first', 'error'); return; }
    try {
      await _flushAllAutosaves();
      await _saveRmi();
      showToast('Saved', 'success');
    } catch (e) {
      showToast(e.message || 'Save failed', 'error');
    }
  });

  panel.querySelectorAll('.ms-rmi-hdr').forEach(inp => {
    inp.addEventListener('change', () => _queueAutosave(`rmi-${_rmiSelectedBatch}`, _saveRmi));
  });
  panel.querySelectorAll('#ms-rmi-sheet-sign .ms-sign-cb').forEach(cb => {
    cb.addEventListener('change', () => _queueAutosave(`rmi-${_rmiSelectedBatch}`, _saveRmi));
  });

  panel.querySelectorAll('[data-rmi-bulk]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.rmiBulk;
      const val = btn.dataset.val;
      const tbody = document.getElementById('ms-rmi-tbody');
      if (!tbody) return;
      tbody.querySelectorAll(`select[data-rf="${field}"]`).forEach((sel) => {
        sel.value = val;
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  });
}

async function _loadBatchOptions() {
  const sel = document.getElementById('ms-rmi-batch');
  if (!sel) return;
  try {
    const r = await authenticatedFetch('/api/production-batches');
    const data = await _jsonOrThrow(r, 'Failed to load batches');
    _rmiBatches = (data.batches || []).slice().sort((a, b) => {
      const na = parseInt((a.batch_no || '').replace(/\D/g, ''), 10) || 0;
      const nb = parseInt((b.batch_no || '').replace(/\D/g, ''), 10) || 0;
      return nb - na;
    });
    _populateBatchSelect('');
  } catch (e) {
    console.error(e);
  }
}

function _populateBatchSelect(filter) {
  const sel = document.getElementById('ms-rmi-batch');
  if (!sel) return;
  const prev = sel.value || _rmiSelectedBatch;
  const fLower = (filter || '').toLowerCase();
  const filtered = fLower ? _rmiBatches.filter(b => {
    const text = `${b.batch_no || ''} ${b.recipe_name || ''} ${b.description || ''}`.toLowerCase();
    return text.includes(fLower);
  }) : _rmiBatches;
  sel.innerHTML = '<option value="">- Select batch -</option>' + filtered.map(b =>
    `<option value="${_esc(b.batch_no || '')}">${_esc(b.batch_no || '')} - ${_esc(b.recipe_name || b.description || '')}</option>`
  ).join('');
  if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
}

function _filterBatchDropdown() {
  const search = document.getElementById('ms-rmi-search');
  _populateBatchSelect(search?.value || '');
}

async function _loadRmi() {
  const batchNo = _rmiSelectedBatch || document.getElementById('ms-rmi-batch')?.value;
  if (!batchNo) { document.getElementById('ms-rmi-tbody').innerHTML = ''; return; }
  _rmiSelectedBatch = batchNo;
  try {
    const r = await authenticatedFetch(`/api/mixing/raw-material-inspection/${encodeURIComponent(batchNo)}`);
    const data = await _jsonOrThrow(r, 'Load failed');
    _rmiData = data;
    document.getElementById('ms-rmi-batchno').value = _rmiData.batch_no || batchNo;
    document.getElementById('ms-rmi-recipe').value = _rmiData.recipe_name || '';
    const hdr = _rmiData.header || {};
    document.getElementById('ms-rmi-date').value = hdr.date || '';
    document.getElementById('ms-rmi-inspector').value = hdr.inspector || '';
    const sheetSignWrap = document.getElementById('ms-rmi-sheet-sign');
    if (sheetSignWrap) {
      sheetSignWrap.innerHTML = _signCheckboxes(Array.isArray(hdr.sign_names) ? hdr.sign_names : [], 'rmi-sign', 0);
      sheetSignWrap.querySelectorAll('.ms-sign-cb').forEach(cb => {
        cb.addEventListener('change', () => _queueAutosave(`rmi-${_rmiSelectedBatch}`, _saveRmi));
      });
    }

    _renderRmiRows(_rmiData.rows || []);
  } catch (e) {
    console.error(e);
    showToast(e.message || 'Load failed', 'error');
  }
}

function _renderRmiRows(rows) {
  const tbody = document.getElementById('ms-rmi-tbody');
  if (!tbody) return;
  tbody.innerHTML = rows.map((row, idx) => `
    <tr class="align-top bg-white" data-rmi-idx="${idx}">
      <td class="border border-slate-300 px-2 py-2">
        <div class="text-[12px] font-semibold text-slate-900">${_esc(row.ingredient_label || '-')}</div>
        <div class="mt-1 flex flex-wrap gap-1">
          <span class="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700">${_esc(row.item_code || '-')}</span>
        </div>
      </td>
      <td class="border border-slate-300 px-2 py-2">
        <span class="text-[12px] font-semibold text-slate-900">${_esc(_formatRmiQty(row.qty_required, row.uom) || '-')}</span>
      </td>
      <td class="border border-slate-300 px-2 py-2">${_selectHtml(['', 'Yes', 'No'], row.pest_foreign || '', `data-rf="pest_foreign" data-ri="${idx}" class="ms-rmi-cell"`)}</td>
      <td class="border border-slate-300 px-2 py-2">${_selectHtml(['', 'Yes', 'No'], row.wet_dirty || '', `data-rf="wet_dirty" data-ri="${idx}" class="ms-rmi-cell"`)}</td>
      <td class="border border-slate-300 px-2 py-2 text-center">
        <label class="inline-flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" ${['1', 'true', 'yes', 'y', 'ok', 'pass', 'checked'].includes(String(row.weight_appearance || '').toLowerCase()) ? 'checked' : ''} class="ms-rmi-cell h-4 w-4 accent-slate-700" data-rf="weight_appearance" data-ri="${idx}" />
          <span class="text-[11px] font-semibold text-slate-700">OK</span>
        </label>
      </td>
      <td class="border border-slate-300 px-2 py-2"><input class="w-full px-2.5 py-1.5 text-[12px] font-semibold text-slate-900 border border-slate-300 rounded-xl bg-white shadow-sm ms-rmi-cell focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400" data-rf="code_comparison" data-ri="${idx}" value="${_esc(row.code_comparison)}" /></td>
      <td class="border border-slate-300 px-2 py-2">${_selectHtml(['', 'Pass', 'Fail'], row.status || '', `data-rf="status" data-ri="${idx}" class="ms-rmi-cell"`)}</td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.ms-rmi-cell').forEach(el => {
    el.addEventListener('change', () => _queueAutosave(`rmi-${_rmiSelectedBatch}`, _saveRmi));
  });
}

function _collectRmiRows() {
  const tbody = document.getElementById('ms-rmi-tbody');
  if (!tbody) return [];
  return [...tbody.querySelectorAll('tr[data-rmi-idx]')].map(tr => {
    const idx = parseInt(tr.dataset.rmiIdx);
    const orig = (_rmiData?.rows || [])[idx] || {};
    const get = (f) => {
      const el = tr.querySelector(`[data-rf="${f}"]`);
      if (!el) return '';
      if (el.type === 'checkbox') return el.checked ? 'Yes' : '';
      return el.value || '';
    };
    return {
      item_code: orig.item_code || '',
      ingredient_label: orig.ingredient_label || '',
      pest_foreign: get('pest_foreign'),
      wet_dirty: get('wet_dirty'),
      weight_appearance: get('weight_appearance'),
      code_comparison: get('code_comparison'),
      status: get('status'),
    };
  });
}

function _collectRmiSheetSignNames() {
  const wrap = document.getElementById('ms-rmi-sheet-sign');
  if (!wrap) return [];
  return [...wrap.querySelectorAll('.ms-sign-cb')].filter(c => c.checked).map(c => c.dataset.signName);
}

async function _saveRmi() {
  if (!_rmiSelectedBatch) return;
  const payload = {
    doc_ref: _rmiData?.doc_ref || '',
    issue_no: _rmiData?.issue_no || '',
    effective_date: _rmiData?.effective_date || '',
    header: {
      date: document.getElementById('ms-rmi-date')?.value || '',
      inspector: document.getElementById('ms-rmi-inspector')?.value || '',
      sign_names: _collectRmiSheetSignNames(),
    },
    rows: _collectRmiRows(),
  };
  const r = await authenticatedFetch(`/api/mixing/raw-material-inspection/${encodeURIComponent(_rmiSelectedBatch)}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: payload }),
  });
  await _jsonOrThrow(r, 'Save failed');
}

async function _downloadRmiPdf() {
  if (!_rmiSelectedBatch) { showToast('Select a batch first', 'error'); return; }
  try {
    await _saveRmi();
    const r = await authenticatedFetch(`/api/mixing/raw-material-inspection/${encodeURIComponent(_rmiSelectedBatch)}/pdf`);
    if (!r.ok) await _jsonOrThrow(r, 'PDF failed');
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    showToast(e.message || 'PDF failed', 'error');
  }
}

// ============================================================================
// Filter Replacement
// ============================================================================

function _renderFilterPanel() {
  const panel = document.getElementById('ms-panel-filter-replacement');
  if (!panel || panel.dataset.built) return;
  panel.dataset.built = '1';
  const today = _todayIsoDate();
  const ym = _ymFromDateString(today) || _defaultYm();

  panel.innerHTML = `
    <div class="flex flex-wrap gap-3 items-end mb-4">
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Date</label><input type="date" id="ms-fr-date" value="${today}" class="w-44 border border-slate-300 rounded-xl text-sm px-2.5 py-2 bg-white text-slate-900 font-semibold" /></div>
      <button type="button" id="ms-fr-save" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full">Save</button>
      <button type="button" id="ms-fr-pdf" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-full">Save as PDF</button>
    </div>
    <div class="rounded-2xl border border-slate-300 bg-gradient-to-b from-white via-slate-50 to-slate-100 p-2 md:p-3 shadow-sm">
      <div class="text-center text-[18px] font-bold tracking-wide text-slate-900 py-1">FILTER REPLACEMENT CHECKLIST</div>
      <div class="text-center text-sm font-semibold text-slate-700 pb-2 border-b border-slate-300">Working Instruction: Filter Replacement</div>
      <div class="flex flex-wrap gap-3 items-center text-sm font-semibold text-slate-800 px-2 py-2">
        <span>Month: <span id="ms-fr-month-text" class="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-300 bg-white">${_monthName(ym.month)}</span></span>
        <span>Year: <span id="ms-fr-year-text" class="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-300 bg-white">${ym.year}</span></span>
      </div>
      <div class="overflow-x-auto border border-slate-300 rounded-xl bg-white mb-3">
        <table class="min-w-[1000px] w-full text-xs border-collapse">
          <thead class="bg-slate-100 text-slate-800">
            <tr>
              <th class="border border-slate-300 px-2 py-2 text-left font-bold">Date</th>
              <th class="border border-slate-300 px-2 py-2 text-left font-bold">Filter Replacement</th>
              <th class="border border-slate-300 px-2 py-2 text-left font-bold">Filter Identification</th>
              <th class="border border-slate-300 px-2 py-2 text-left font-bold">Quantity Replaced</th>
              <th class="border border-slate-300 px-2 py-2 text-left font-bold">Filter Location</th>
              <th class="border border-slate-300 px-2 py-2 text-left font-bold">Filter Specification</th>
              <th class="border border-slate-300 px-2 py-2 text-left font-bold">Physical Condition</th>
              <th class="border border-slate-300 px-2 py-2 text-left font-bold">Checked by</th>
              <th class="border border-slate-300 px-2 py-2 text-left font-bold">Comments</th>
            </tr>
          </thead>
          <tbody id="ms-fr-tbody"></tbody>
        </table>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div><label class="block text-[11px] font-bold text-slate-700">Controlled by</label><input type="text" class="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-fr-ftr" data-ff="controlled_by" /></div>
        <div><label class="block text-[11px] font-bold text-slate-700">Verified by</label><input type="text" class="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-fr-ftr" data-ff="verified_by" /></div>
        <div><label class="block text-[11px] font-bold text-slate-700">Production Manager</label><input type="text" class="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-fr-ftr" data-ff="production_manager" /></div>
      </div>
    </div>
    <div id="ms-fr-history-wrap" class="mt-4"></div>
  `;

  const syncPeriodPills = () => {
    const monthText = document.getElementById('ms-fr-month-text');
    const yearText = document.getElementById('ms-fr-year-text');
    const picked = _ymFromDateString(document.getElementById('ms-fr-date')?.value || '') || ym;
    if (monthText) monthText.textContent = _monthName(picked.month);
    if (yearText) yearText.textContent = String(picked.year);
  };
  syncPeriodPills();

  panel.querySelector('#ms-fr-pdf').addEventListener('click', () => _downloadOpsPdf('filter_replacement'));
  panel.querySelector('#ms-fr-save')?.addEventListener('click', () => _saveCurrentOps('filter-replacement'));
  panel.querySelector('#ms-fr-date')?.addEventListener('input', () => {
    syncPeriodPills();
  });
  panel.querySelector('#ms-fr-date')?.addEventListener('change', () => {
    syncPeriodPills();
    _queueOpsAutosave('filter-replacement');
  });
  panel.querySelectorAll('.ms-fr-ftr').forEach(el => {
    _bindOpsAutosaveEvents(el, 'filter-replacement');
  });
}

function _renderFilterRows(rows) {
  const tbody = document.getElementById('ms-fr-tbody');
  if (!tbody) return;
  const data = Array.isArray(rows) ? rows : [];
  while (data.length < 12) data.push({});
  tbody.innerHTML = data.map((row, i) => {
    const physCond = String(row.physical_condition || '');
    const isDirty = physCond.trim().toLowerCase() === 'dirty';
    return `
    <tr class="bg-white">
      <td class="border border-slate-300 px-1 py-1"><input type="date" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-fr-cell" data-fi="${i}" data-ff="date" value="${_esc(row.date)}" /></td>
      <td class="border border-slate-300 px-1 py-1">${_selectHtml(['', 'Product Cartridge Filter', 'RO Cartridge Filter', 'RO Back Filter'], row.filter_replacement || '', `data-fi="${i}" data-ff="filter_replacement" class="ms-fr-cell w-full"`)}</td>
      <td class="border border-slate-300 px-1 py-1"><input class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-fr-cell" data-fi="${i}" data-ff="filter_identification" value="${_esc(row.filter_identification)}" /></td>
      <td class="border border-slate-300 px-1 py-1"><input type="number" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-fr-cell" data-fi="${i}" data-ff="quantity_replaced" value="${_esc(row.quantity_replaced)}" /></td>
      <td class="border border-slate-300 px-1 py-1">${_selectHtml(['', 'RO1', 'RO2'], row.filter_location || '', `data-fi="${i}" data-ff="filter_location" class="ms-fr-cell w-full"`)}</td>
      <td class="border border-slate-300 px-1 py-1">${_selectHtml(['', '0.5 micron', '1 micron', '5 micron'], row.filter_specification || '', `data-fi="${i}" data-ff="filter_specification" class="ms-fr-cell w-full"`)}</td>
      <td class="border border-slate-300 px-1 py-1">
        <div class="flex items-center gap-1">
          <input class="flex-1 min-w-0 px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-fr-cell" data-fi="${i}" data-ff="physical_condition" value="${_esc(row.physical_condition)}" />
          <label class="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-700 whitespace-nowrap"><input type="checkbox" class="ms-fr-dirty h-3.5 w-3.5" data-fi="${i}" ${isDirty ? 'checked' : ''} />Dirty</label>
        </div>
      </td>
      <td class="border border-slate-300 px-1 py-1">${_selectHtml(['', ...SIGN_NAMES], row.checked_by || '', `data-fi="${i}" data-ff="checked_by" class="ms-fr-cell w-full"`)}</td>
      <td class="border border-slate-300 px-1 py-1"><input class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-fr-cell" data-fi="${i}" data-ff="comments" value="${_esc(row.comments)}" /></td>
    </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.ms-fr-cell').forEach(el => {
    _bindOpsAutosaveEvents(el, 'filter-replacement');
  });

  tbody.querySelectorAll('.ms-fr-dirty').forEach((cb) => {
    cb.addEventListener('change', () => {
      const i = cb.dataset.fi;
      const textInput = tbody.querySelector(`input[data-ff="physical_condition"][data-fi="${i}"]`);
      if (!textInput) return;
      if (cb.checked) {
        textInput.value = 'Dirty';
      } else if (textInput.value.trim().toLowerCase() === 'dirty') {
        textInput.value = '';
      }
      textInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  tbody.querySelectorAll('input[data-ff="physical_condition"]').forEach((input) => {
    input.addEventListener('input', () => {
      const i = input.dataset.fi;
      const cb = tbody.querySelector(`.ms-fr-dirty[data-fi="${i}"]`);
      if (cb) cb.checked = input.value.trim().toLowerCase() === 'dirty';
    });
  });
}

// ============================================================================
// Mixing Area Checklist
// ============================================================================

const MA_CHECKBOX_COLS = ['floor', 'tank', 'control_cabinet', 'mixing_hopper', 'cip_platform', 'pump_seal', 'cooling_water_flow', 'final_syrup_filter', 'oxonia', 'conc_mipca', 'p3_horolith'];
const MA_YESNO_COLS = ['water_leakage', 'steamline_leakage'];

function _renderMixingAreaPanel() {
  const panel = document.getElementById('ms-panel-mixing-area');
  if (!panel || panel.dataset.built) return;
  panel.dataset.built = '1';
  const today = _todayIsoDate();
  const ym = _ymFromDateString(today) || _defaultYm();

  panel.innerHTML = `
    <div class="flex flex-wrap gap-3 items-end mb-4">
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Date</label><input type="date" id="ms-ma-date" value="${today}" class="w-44 border border-slate-300 rounded-xl text-sm px-2.5 py-2 bg-white text-slate-900 font-semibold" /></div>
      <button type="button" id="ms-ma-save" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full">Save</button>
      <button type="button" id="ms-ma-pdf" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-full">Save as PDF</button>
    </div>
    <div class="rounded-2xl border border-slate-300 bg-gradient-to-b from-white via-slate-50 to-slate-100 p-2 md:p-3 shadow-sm">
      <div class="text-center text-[18px] font-bold tracking-wide text-slate-900 py-1">MIXING AREA CHECKLIST</div>
      <div class="flex flex-wrap gap-3 items-center text-sm font-semibold text-slate-800 px-1 pb-2">
        <span>Month: <span id="ms-ma-month-text" class="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-300 bg-white">${_monthName(ym.month)}</span></span>
        <span>Year: <span id="ms-ma-year-text" class="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-300 bg-white">${ym.year}</span></span>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
        <div><label class="block text-[11px] font-bold text-slate-700">Area</label><input type="text" id="ms-ma-area" value="Mixing" class="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900" /></div>
        <div><label class="block text-[11px] font-bold text-slate-700">Person Incharge</label><input type="text" id="ms-ma-pic" class="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ma-meta" /></div>
      </div>
      <div class="overflow-x-auto border border-slate-300 rounded-xl bg-white mb-3">
        <table class="min-w-[1320px] w-full text-[11px] border-collapse">
          <thead class="bg-slate-100 text-slate-800">
            <tr>
              <th rowspan="2" class="border border-slate-300 px-1 py-1 font-bold">Date</th>
              <th colspan="5" class="border border-slate-300 px-1 py-1 font-bold">Cleaning</th>
              <th colspan="5" class="border border-slate-300 px-1 py-1 font-bold">Check whether it is OK or not</th>
              <th colspan="3" class="border border-slate-300 px-1 py-1 font-bold">CIP Chemicals OK or Not</th>
              <th rowspan="2" class="border border-slate-300 px-1 py-1 font-bold">Checked by</th>
              <th rowspan="2" class="border border-slate-300 px-1 py-1 font-bold">Comments</th>
            </tr>
            <tr>
              <th class="border border-slate-300 px-1 py-1 font-bold">Floor</th>
              <th class="border border-slate-300 px-1 py-1 font-bold">Tank</th>
              <th class="border border-slate-300 px-1 py-1 font-bold">Control Cabinet</th>
              <th class="border border-slate-300 px-1 py-1 font-bold">Mixing Hopper</th>
              <th class="border border-slate-300 px-1 py-1 font-bold">CIP Platform</th>
              <th class="border border-slate-300 px-1 py-1 font-bold">Pump Seal</th>
              <th class="border border-slate-300 px-1 py-1 font-bold">Cooling water flow</th>
              <th class="border border-slate-300 px-1 py-1 font-bold">Water Leakage</th>
              <th class="border border-slate-300 px-1 py-1 font-bold">Final Syrup Filter</th>
              <th class="border border-slate-300 px-1 py-1 font-bold">Steamline leakage YES/NO</th>
              <th class="border border-slate-300 px-1 py-1 font-bold">Oxonia</th>
              <th class="border border-slate-300 px-1 py-1 font-bold">Conc. MIPCA</th>
              <th class="border border-slate-300 px-1 py-1 font-bold">P-3 Horolith Acid</th>
            </tr>
          </thead>
          <tbody id="ms-ma-tbody"></tbody>
        </table>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label class="block text-[11px] font-bold text-slate-700">Verified by</label><input type="text" id="ms-ma-verified" class="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ma-meta" /></div>
      </div>
    </div>
    <div id="ms-ma-history-wrap" class="mt-4"></div>
  `;

  const syncPeriodPills = () => {
    const picked = _ymFromDateString(document.getElementById('ms-ma-date')?.value || '') || ym;
    const monthText = document.getElementById('ms-ma-month-text');
    const yearText = document.getElementById('ms-ma-year-text');
    if (monthText) monthText.textContent = _monthName(picked.month);
    if (yearText) yearText.textContent = String(picked.year);
  };
  syncPeriodPills();

  panel.querySelector('#ms-ma-pdf').addEventListener('click', () => _downloadOpsPdf('mixing_area'));
  panel.querySelector('#ms-ma-save')?.addEventListener('click', () => _saveCurrentOps('mixing-area'));
  panel.querySelector('#ms-ma-date')?.addEventListener('input', () => {
    syncPeriodPills();
  });
  panel.querySelector('#ms-ma-date')?.addEventListener('change', async () => {
    syncPeriodPills();
    const currentDays = _collectMixingAreaDays();
    _renderMixingAreaRows(currentDays);
    _queueOpsAutosave('mixing-area');
  });
  panel.querySelectorAll('.ms-ma-meta').forEach(el => _bindOpsAutosaveEvents(el, 'mixing-area'));
  _bindOpsAutosaveEvents(panel.querySelector('#ms-ma-area'), 'mixing-area');
}

function _collectMixingAreaDays() {
  const days = [];
  document.querySelectorAll('#ms-ma-tbody tr').forEach((tr, i) => {
    const day = { day: i + 1 };
    tr.querySelectorAll('.ms-ma-cb').forEach(cb => { day[cb.dataset.col] = cb.checked; });
    tr.querySelectorAll('.ms-ma-yn').forEach(sel => { day[sel.dataset.col] = sel.value || ''; });
    tr.querySelectorAll('.ms-ma-sel').forEach(sel => { day[sel.dataset.col] = sel.value || ''; });
    tr.querySelectorAll('.ms-ma-txt').forEach(inp => { day[inp.dataset.col] = inp.value || ''; });
    days.push(day);
  });
  return days;
}

function _daysInMonthFromInput(inputId) {
  const ym = _ymFromDateString(document.getElementById(inputId)?.value || '') || _defaultYm();
  return new Date(ym.year, ym.month, 0).getDate();
}

function _renderMixingAreaRows(days) {
  const tbody = document.getElementById('ms-ma-tbody');
  if (!tbody) return;
  const total = _daysInMonthFromInput('ms-ma-date');
  const data = Array.isArray(days) ? days.slice(0, total) : [];
  while (data.length < total) data.push({ day: data.length + 1 });
  // Weekend rows (Sat/Sun) get an orange tint to flag overtime - Mon-Fri get green.
  const ym = _ymFromDateString(document.getElementById('ms-ma-date')?.value || '') || _defaultYm();
  tbody.innerHTML = data.map((day, i) => {
    const cbCell = (col) => `<td class="border border-slate-300 px-0.5 py-0.5 text-center"><input type="checkbox" ${day[col] ? 'checked' : ''} class="ms-ma-cb h-4 w-4 accent-slate-700" data-di="${i}" data-col="${col}" /></td>`;
    const ynCell = (col) => `<td class="border border-slate-300 px-0.5 py-0.5">${_selectHtml(['', 'Yes', 'No'], day[col] || '', `class="ms-ma-yn text-[10px] w-[110px]" data-di="${i}" data-col="${col}"`)}</td>`;
    const dow = new Date(ym.year, ym.month - 1, i + 1).getDay();
    const isWeekend = dow === 0 || dow === 6;
    const rowBg = isWeekend ? 'bg-orange-50' : 'bg-emerald-50';
    const dowLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow];
    const dowPillCls = isWeekend
      ? 'text-orange-700 bg-orange-100 border-orange-300'
      : 'text-emerald-700 bg-emerald-100 border-emerald-300';
    return `<tr class="${rowBg}" title="${dowLabel}${isWeekend ? ' (weekend - overtime)' : ''}">
      <td class="border border-slate-300 px-1 py-0.5 font-bold text-center">
        <div class="flex flex-col items-center gap-0.5">
          <span>${day.day || i + 1}</span>
          <span class="inline-flex items-center justify-center px-1.5 py-0 text-[9px] font-semibold rounded-full border ${dowPillCls}">${dowLabel}</span>
        </div>
      </td>
      ${cbCell('floor')}${cbCell('tank')}${cbCell('control_cabinet')}${cbCell('mixing_hopper')}${cbCell('cip_platform')}
      ${cbCell('pump_seal')}${cbCell('cooling_water_flow')}${ynCell('water_leakage')}${cbCell('final_syrup_filter')}${ynCell('steamline_leakage')}
      ${cbCell('oxonia')}${cbCell('conc_mipca')}${cbCell('p3_horolith')}
      <td class="border border-slate-300 px-0.5 py-0.5">${_selectHtml(['', ...SIGN_NAMES], day.checked_by || '', `class="ms-ma-sel text-[10px] w-[130px]" data-di="${i}" data-col="checked_by"`)}</td>
      <td class="border border-slate-300 px-0.5 py-0.5"><input class="w-full min-w-[150px] px-2 py-1 text-[11px] font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ma-txt" data-di="${i}" data-col="comments" value="${_esc(day.comments)}" /></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.ms-ma-cb, .ms-ma-yn, .ms-ma-sel, .ms-ma-txt').forEach(el => {
    _bindOpsAutosaveEvents(el, 'mixing-area');
  });
}

// ============================================================================
// RO Plant Weekly
// ============================================================================

const RO_P1_CONSUMABLES = ['Sodium Hypochlorite', 'Anti scalant', 'SMBS Dosing', 'Post Caustic'];
const RO_P1_FILTERS = ['Bag Filters', 'RO Cartridge filters', 'Product water filter', 'CIP cartridge filter'];
const RO_P2_CONSUMABLES = ['Sodium Metabisulphate', 'Hydrex 1401'];
const RO_P2_FILTERS = ['RO Product water Cartridge filters', 'Membrane', 'UV Lamps'];

function _roChecklistRows(items, plantKey, data) {
  const pd = (data || {})[plantKey] || {};
  return items.map((label, idx) => {
    const key = label.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 30);
    const row = pd[key] || {};
    return `<tr class="bg-white">
      <td class="border border-slate-300 px-1 py-1 text-center text-xs font-bold text-slate-800">${idx + 1}</td>
      <td class="border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-900">${_esc(label)}</td>
      <td class="border border-slate-300 px-1 py-0.5 text-center"><input type="checkbox" ${row.ok ? 'checked' : ''} class="ms-ro-chk h-4 w-4 accent-slate-700" data-plant="${plantKey}" data-rk="${key}" data-rf="ok" /></td>
      <td class="border border-slate-300 px-1 py-0.5 text-center"><input type="checkbox" ${row.fault ? 'checked' : ''} class="ms-ro-chk h-4 w-4 accent-slate-700" data-plant="${plantKey}" data-rk="${key}" data-rf="fault" /></td>
      <td class="border border-slate-300 px-1 py-0.5"><input class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ro-txt" data-plant="${plantKey}" data-rk="${key}" data-rf="comments" value="${_esc(row.comments)}" /></td>
    </tr>`;
  }).join('');
}

function _renderRoPanel() {
  const panel = document.getElementById('ms-panel-ro-weekly');
  if (!panel || panel.dataset.built) return;
  panel.dataset.built = '1';
  const today = _todayIsoDate();
  const ym = _ymFromDateString(today) || _defaultYm();

  panel.innerHTML = `
    <div class="flex flex-wrap gap-3 items-end mb-4">
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Date</label><input type="date" id="ms-ro-date" value="${today}" class="w-44 border border-slate-300 rounded-xl text-sm px-2.5 py-2 bg-white text-slate-900 font-semibold" /></div>
      <button type="button" id="ms-ro-save" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-full">Save</button>
      <button type="button" id="ms-ro-pdf" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-full">Save as PDF</button>
    </div>
    <div class="rounded-2xl border border-slate-300 bg-gradient-to-b from-white via-slate-50 to-slate-100 p-2 md:p-3 shadow-sm">
      <div class="text-center text-[18px] font-bold tracking-wide text-slate-900 py-1">RO PLANT WEEKLY CHECKLIST</div>
      <div class="mb-2 text-sm font-semibold text-slate-800">
        <span>Month: <span id="ms-ro-month-text" class="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-300 bg-white">${_monthName(ym.month)}</span></span>
        <span class="ml-3">Year: <span id="ms-ro-year-text" class="inline-flex items-center px-2 py-0.5 rounded-full border border-slate-300 bg-white">${ym.year}</span></span>
      </div>
      <div id="ms-ro-body" class="space-y-3"></div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
        <div><label class="block text-[11px] font-bold text-slate-700">Area in charge</label>
          ${_selectHtml(['', ...SIGN_NAMES], '', 'id="ms-ro-area-incharge" class="ms-ro-meta w-full"')}</div>
      </div>
    </div>
    <div id="ms-ro-history-wrap" class="mt-4"></div>
  `;

  const syncPeriodPills = () => {
    const picked = _ymFromDateString(document.getElementById('ms-ro-date')?.value || '') || ym;
    const monthText = document.getElementById('ms-ro-month-text');
    const yearText = document.getElementById('ms-ro-year-text');
    if (monthText) monthText.textContent = _monthName(picked.month);
    if (yearText) yearText.textContent = String(picked.year);
  };
  syncPeriodPills();

  panel.querySelector('#ms-ro-pdf').addEventListener('click', () => _downloadOpsPdf('ro_plant_weekly'));
  panel.querySelector('#ms-ro-save')?.addEventListener('click', () => _saveCurrentOps('ro-weekly'));
  panel.querySelector('#ms-ro-date')?.addEventListener('input', () => {
    syncPeriodPills();
  });
  panel.querySelector('#ms-ro-date')?.addEventListener('change', () => {
    syncPeriodPills();
    _queueOpsAutosave('ro-weekly');
  });
  panel.querySelectorAll('.ms-ro-meta').forEach(el => _bindOpsAutosaveEvents(el, 'ro-weekly'));
}

function _renderRoBody(data) {
  const body = document.getElementById('ms-ro-body');
  if (!body) return;
  const p1 = data.plant1 || {};
  const p2 = data.plant2 || {};

  const roDateEl = document.getElementById('ms-ro-date');
  const selectedDate = roDateEl?.value || _todayIsoDate();
  if (roDateEl) {
    roDateEl.value = data.header_date || selectedDate;
    roDateEl.dispatchEvent(new Event('input'));
  }
  document.getElementById('ms-ro-area-incharge').value = data.area_incharge_sign || '';

  const tblColgroup = `<colgroup><col style="width:6%" /><col style="width:44%" /><col style="width:10%" /><col style="width:10%" /><col style="width:30%" /></colgroup>`;
  const tblHdr = `${tblColgroup}<thead class="bg-slate-100"><tr><th class="border border-slate-300 px-1 py-1 text-xs font-bold text-center">Sl. No</th><th class="border border-slate-300 px-2 py-1 text-left text-xs font-bold">Description / Condition</th><th class="border border-slate-300 px-1 py-1 text-xs font-bold text-center">OK</th><th class="border border-slate-300 px-1 py-1 text-xs font-bold text-center">Fault</th><th class="border border-slate-300 px-2 py-1 text-left text-xs font-bold">Comments</th></tr></thead>`;

  body.innerHTML = `
    <div class="rounded-xl border border-slate-300 bg-white p-2">
      <h4 class="text-sm font-bold text-slate-800 mb-1">RO PLANT-1</h4>
      <p class="text-[11px] font-semibold text-slate-700 mb-1">Consumables</p>
      <div class="overflow-x-auto">
        <table class="min-w-[760px] w-full text-xs border-collapse mb-2 table-fixed">${tblHdr}<tbody>${_roChecklistRows(RO_P1_CONSUMABLES, 'plant1', data)}</tbody></table>
      </div>
      <p class="text-[11px] font-semibold text-slate-700 mb-1">Filters</p>
      <div class="overflow-x-auto">
        <table class="min-w-[760px] w-full text-xs border-collapse mb-2 table-fixed">${tblHdr}<tbody>${_roChecklistRows(RO_P1_FILTERS, 'plant1', data)}</tbody></table>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <div><label class="text-[11px] font-bold text-slate-700">Running hours (RO Panel)</label><input type="text" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ro-p1" data-pk="running_hours" value="${_esc(p1.running_hours)}" /></div>
        <div><label class="text-[11px] font-bold text-slate-700">Last CIP of RO Plant (Date)</label><input type="text" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ro-p1" data-pk="last_cip_date" value="${_esc(p1.last_cip_date)}" /></div>
        <div><label class="text-[11px] font-bold text-slate-700">Last backwash done (Date)</label><input type="text" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ro-p1" data-pk="last_backwash_date" value="${_esc(p1.last_backwash_date)}" /></div>
      </div>
    </div>
    <div class="rounded-xl border border-slate-300 bg-white p-2">
      <h4 class="text-sm font-bold text-slate-800 mb-1">RO PLANT-2</h4>
      <p class="text-[11px] font-semibold text-slate-700 mb-1">Consumables</p>
      <div class="overflow-x-auto">
        <table class="min-w-[760px] w-full text-xs border-collapse mb-2 table-fixed">${tblHdr}<tbody>${_roChecklistRows(RO_P2_CONSUMABLES, 'plant2', data)}</tbody></table>
      </div>
      <p class="text-[11px] font-semibold text-slate-700 mb-1">Filters / Membrane / U.V. Lamps</p>
      <div class="overflow-x-auto">
        <table class="min-w-[760px] w-full text-xs border-collapse mb-2 table-fixed">${tblHdr}<tbody>${_roChecklistRows(RO_P2_FILTERS, 'plant2', data)}</tbody></table>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
        <div><label class="text-[11px] font-bold text-slate-700">20 CMPD Control Panel (Running Hours)</label><input type="text" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ro-p2" data-pk="running_hours_cmpd" value="${_esc(p2.running_hours_cmpd)}" /></div>
        <div><label class="text-[11px] font-bold text-slate-700">OZONE Monitor (Running Hours)</label><input type="text" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ro-p2" data-pk="running_hours_ozone" value="${_esc(p2.running_hours_ozone)}" /></div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
        <div><label class="text-[11px] font-bold text-slate-700">Last External CIP of RO Plant (Date)</label><input type="text" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ro-p2" data-pk="last_external_cip" value="${_esc(p2.last_external_cip)}" /></div>
        <div><label class="text-[11px] font-bold text-slate-700">Last Internal CIP of RO Plant (Date)</label><input type="text" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ro-p2" data-pk="last_internal_cip" value="${_esc(p2.last_internal_cip)}" /></div>
        <div><label class="text-[11px] font-bold text-slate-700">Last backwash done (Date)</label><input type="text" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ro-p2" data-pk="last_backwash" value="${_esc(p2.last_backwash)}" /></div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
        <div><label class="text-[11px] font-bold text-slate-700">Leakage is present or not</label>${_selectHtml(['', 'Yes', 'No'], p2.leakage_present || '', 'class="ms-ro-p2 w-full" data-pk="leakage_present"')}</div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div><label class="text-[11px] font-bold text-slate-700">Total runtime of plant</label><input type="text" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ro-p2" data-pk="total_runtime" value="${_esc(p2.total_runtime)}" /></div>
        <div><label class="text-[11px] font-bold text-slate-700">Total product quantity (m3)</label><input type="text" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ro-p2" data-pk="total_product_qty" value="${_esc(p2.total_product_qty)}" /></div>
        <div><label class="text-[11px] font-bold text-slate-700">Total processed quantity (m3)</label><input type="text" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ro-p2" data-pk="total_processed_qty" value="${_esc(p2.total_processed_qty)}" /></div>
        <div><label class="text-[11px] font-bold text-slate-700">Rejection (m3)</label><input type="text" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ro-p2" data-pk="rejection" value="${_esc(p2.rejection)}" /></div>
        <div><label class="text-[11px] font-bold text-slate-700">Water Efficiency (%)</label><input type="text" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded-xl bg-white text-slate-900 ms-ro-p2" data-pk="water_efficiency" value="${_esc(p2.water_efficiency)}" /></div>
      </div>
    </div>
  `;

  body.querySelectorAll('.ms-ro-chk, .ms-ro-txt, .ms-ro-p1, .ms-ro-p2').forEach(el => {
    _bindOpsAutosaveEvents(el, 'ro-weekly');
  });
}

// ============================================================================
// Shared Ops Load/Save
// ============================================================================

const OPS_TYPE_MAP = {
  'filter-replacement': 'filter_replacement',
  'mixing-area': 'mixing_area',
  'ro-weekly': 'ro_plant_weekly',
};

const OPS_HISTORY_WRAP_ID = {
  'filter-replacement': 'ms-fr-history-wrap',
  'mixing-area': 'ms-ma-history-wrap',
  'ro-weekly': 'ms-ro-history-wrap',
};

const OPS_LABEL = {
  'filter-replacement': 'Filter Replacement',
  'mixing-area': 'Mixing Area Checklist',
  'ro-weekly': 'RO Plant Weekly',
};

const _opsState = {
  'filter-replacement': { entryId: null, readOnly: false },
  'mixing-area': { entryId: null, readOnly: false },
  'ro-weekly': { entryId: null, readOnly: false },
};

function _getOpsParams(panelKey) {
  const apiType = OPS_TYPE_MAP[panelKey];
  if (!apiType) return null;
  const dateInputId = _opsDateInputId(panelKey);
  const dateValue = document.getElementById(dateInputId)?.value || '';
  const ym = _ymFromDateString(dateValue);
  if (!ym) return null;
  return { year: ym.year, month: ym.month, week: 0, apiType };
}

function _opsScope(panelKey) {
  return `ops:${panelKey}`;
}

function _queueOpsAutosave(panelKey) {
  const p = _getOpsParams(panelKey);
  if (!p) return;
  const state = _opsState[panelKey];
  if (state?.readOnly) return;
  _queueAutosave(_opsScope(panelKey), () => _saveOps(panelKey, p));
}

async function _loadOps(panelKey) {
  // Opening the tab: render history list and show a blank form.
  _resetOpsForm(panelKey);
  await _loadOpsHistory(panelKey);
}

function _resetOpsForm(panelKey) {
  const state = _opsState[panelKey];
  if (state) { state.entryId = null; state.readOnly = false; }
  if (panelKey === 'filter-replacement') {
    _renderFilterRows([]);
    const panel = document.getElementById('ms-panel-filter-replacement');
    panel?.querySelectorAll('.ms-fr-ftr').forEach(el => { el.value = ''; });
  } else if (panelKey === 'mixing-area') {
    _renderMixingAreaRows([]);
    const area = document.getElementById('ms-ma-area'); if (area) area.value = 'Mixing';
    const pic = document.getElementById('ms-ma-pic'); if (pic) pic.value = '';
    const ver = document.getElementById('ms-ma-verified'); if (ver) ver.value = '';
  } else if (panelKey === 'ro-weekly') {
    _renderRoBody({});
  }
  _applyOpsReadOnly(panelKey, false);
}

function _populateOpsForm(panelKey, entry) {
  const data = entry?.data || {};
  if (entry?.header_date) {
    const dateId = _opsDateInputId(panelKey);
    const dateEl = document.getElementById(dateId);
    if (dateEl) { dateEl.value = entry.header_date; dateEl.dispatchEvent(new Event('input')); }
  }
  if (panelKey === 'filter-replacement') {
    _renderFilterRows(data.rows || []);
    const panel = document.getElementById('ms-panel-filter-replacement');
    const ftr = data.footer || {};
    panel?.querySelectorAll('.ms-fr-ftr').forEach(el => { el.value = ftr[el.dataset.ff] || ''; });
  } else if (panelKey === 'mixing-area') {
    _renderMixingAreaRows(data.days || []);
    const area = document.getElementById('ms-ma-area'); if (area) area.value = data.area || 'Mixing';
    const pic = document.getElementById('ms-ma-pic'); if (pic) pic.value = data.person_incharge || '';
    const ver = document.getElementById('ms-ma-verified'); if (ver) ver.value = data.verified_by || '';
  } else if (panelKey === 'ro-weekly') {
    _renderRoBody(data);
  }
}

function _applyOpsReadOnly(panelKey, readOnly) {
  const panelId = {
    'filter-replacement': 'ms-panel-filter-replacement',
    'mixing-area': 'ms-panel-mixing-area',
    'ro-weekly': 'ms-panel-ro-weekly',
  }[panelKey];
  const panel = document.getElementById(panelId);
  if (!panel) return;
  // Scope to inputs inside the form card (not the history list).
  const historyWrap = panel.querySelector(`#${OPS_HISTORY_WRAP_ID[panelKey]}`);
  const all = panel.querySelectorAll('input, select, textarea, button');
  all.forEach(el => {
    if (historyWrap && historyWrap.contains(el)) return;
    if (el.id && el.id.endsWith('-pdf')) return; // keep Save-as-PDF always enabled
    if (el.tagName === 'BUTTON') {
      // Only the Save buttons (id ends in '-save') should follow the read-only state.
      if (el.id && el.id.endsWith('-save')) el.disabled = !!readOnly;
      return;
    }
    if ('disabled' in el) el.disabled = !!readOnly;
  });
  const state = _opsState[panelKey];
  if (state) state.readOnly = !!readOnly;
}

async function _loadOpsHistory(panelKey) {
  const apiType = OPS_TYPE_MAP[panelKey];
  const wrap = document.getElementById(OPS_HISTORY_WRAP_ID[panelKey]);
  if (!apiType || !wrap) return;
  try {
    const r = await authenticatedFetch(`/api/mixing/ops/${apiType}/history`);
    const doc = await _jsonOrThrow(r, 'Load history failed');
    _renderOpsHistoryList(panelKey, doc.history || []);
  } catch (e) {
    console.error(e);
    wrap.innerHTML = `<div class="text-xs text-rose-700">History unavailable: ${_esc(e.message || 'error')}</div>`;
  }
}

function _renderOpsHistoryList(panelKey, history) {
  const wrap = document.getElementById(OPS_HISTORY_WRAP_ID[panelKey]);
  if (!wrap) return;
  const state = _opsState[panelKey];
  const activeId = state?.entryId || '';
  const rowsHtml = (history || []).map(h => {
    const saved = h.saved_at ? new Date(h.saved_at).toLocaleString() : '';
    const summary = _opsSummaryCells(panelKey, h);
    const isActive = h.entry_id === activeId;
    return `<tr class="${isActive ? 'bg-amber-50' : 'bg-white'}">
      <td class="border border-slate-300 px-2 py-1 text-xs font-mono">${_esc(saved)}</td>
      <td class="border border-slate-300 px-2 py-1 text-xs">${_esc(_monthName(h.month))} ${_esc(h.year || '')}</td>
      ${summary}
      <td class="border border-slate-300 px-2 py-1 text-xs">${_esc(h.saved_by || '')}</td>
      <td class="border border-slate-300 px-2 py-1">
        <div class="flex flex-wrap gap-1">
          <button type="button" class="ms-ops-hist-view px-2 py-1 text-[11px] font-semibold rounded-full border border-slate-300 bg-white hover:bg-slate-50" data-id="${_esc(h.entry_id)}">View</button>
          <button type="button" class="ms-ops-hist-edit px-2 py-1 text-[11px] font-semibold rounded-full border border-slate-900 bg-slate-900 text-white hover:bg-slate-800" data-id="${_esc(h.entry_id)}">Edit</button>
          <button type="button" class="ms-ops-hist-print px-2 py-1 text-[11px] font-semibold rounded-full border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100" data-id="${_esc(h.entry_id)}">Print</button>
          <button type="button" class="ms-ops-hist-del px-2 py-1 text-[11px] font-semibold rounded-full border border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100" data-id="${_esc(h.entry_id)}">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  wrap.innerHTML = `
    <div class="rounded-2xl border border-slate-300 bg-white p-3 shadow-sm">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-sm font-bold text-slate-800">Saved ${_esc(OPS_LABEL[panelKey] || 'Records')}</h3>
        <button type="button" class="ms-ops-new px-3 py-1.5 text-xs font-semibold rounded-full border border-slate-900 bg-white text-slate-900 hover:bg-slate-50" data-panel="${panelKey}">+ New</button>
      </div>
      ${history && history.length ? `
      <div class="overflow-x-auto">
        <table class="w-full text-xs border-collapse">
          <thead class="bg-slate-100 text-slate-800"><tr>
            <th class="border border-slate-300 px-2 py-1 text-left">Saved At</th>
            <th class="border border-slate-300 px-2 py-1 text-left">Y/M</th>
            ${_opsSummaryHeaders(panelKey)}
            <th class="border border-slate-300 px-2 py-1 text-left">Saved By</th>
            <th class="border border-slate-300 px-2 py-1 text-left">Actions</th>
          </tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>` : `<div class="text-xs text-slate-500">No saved records yet. Fill the form above and it will be saved automatically as a new record.</div>`}
    </div>
  `;

  wrap.querySelector('.ms-ops-new')?.addEventListener('click', async () => {
    await _flushAllAutosaves();
    _resetOpsForm(panelKey);
    await _loadOpsHistory(panelKey);
  });
  wrap.querySelectorAll('.ms-ops-hist-view').forEach(btn => {
    btn.addEventListener('click', () => _viewOpsEntry(panelKey, btn.dataset.id, true));
  });
  wrap.querySelectorAll('.ms-ops-hist-edit').forEach(btn => {
    btn.addEventListener('click', () => _viewOpsEntry(panelKey, btn.dataset.id, false));
  });
  wrap.querySelectorAll('.ms-ops-hist-print').forEach(btn => {
    btn.addEventListener('click', () => _printOpsEntry(panelKey, btn.dataset.id));
  });
  wrap.querySelectorAll('.ms-ops-hist-del').forEach(btn => {
    btn.addEventListener('click', () => _deleteOpsEntry(panelKey, btn.dataset.id));
  });
}

function _opsSummaryHeaders(panelKey) {
  if (panelKey === 'filter-replacement') return '<th class="border border-slate-300 px-2 py-1 text-left">Controlled</th><th class="border border-slate-300 px-2 py-1 text-left">Verified</th>';
  if (panelKey === 'mixing-area') return '<th class="border border-slate-300 px-2 py-1 text-left">Incharge</th><th class="border border-slate-300 px-2 py-1 text-left">Verified</th>';
  if (panelKey === 'ro-weekly') return '<th class="border border-slate-300 px-2 py-1 text-left">Date</th><th class="border border-slate-300 px-2 py-1 text-left">Area Incharge</th>';
  return '';
}

function _opsSummaryCells(panelKey, h) {
  if (panelKey === 'filter-replacement') {
    return `<td class="border border-slate-300 px-2 py-1 text-xs">${_esc(h.controlled_by || '')}</td><td class="border border-slate-300 px-2 py-1 text-xs">${_esc(h.verified_by || '')}</td>`;
  }
  if (panelKey === 'mixing-area') {
    return `<td class="border border-slate-300 px-2 py-1 text-xs">${_esc(h.person_incharge || '')}</td><td class="border border-slate-300 px-2 py-1 text-xs">${_esc(h.verified_by || '')}</td>`;
  }
  if (panelKey === 'ro-weekly') {
    return `<td class="border border-slate-300 px-2 py-1 text-xs">${_esc(h.header_date || '')}</td><td class="border border-slate-300 px-2 py-1 text-xs">${_esc(h.area_incharge_sign || '')}</td>`;
  }
  return '';
}

async function _viewOpsEntry(panelKey, entryId, readOnly) {
  const apiType = OPS_TYPE_MAP[panelKey];
  if (!apiType || !entryId) return;
  await _flushAllAutosaves();
  try {
    const r = await authenticatedFetch(`/api/mixing/ops/${apiType}/history/${encodeURIComponent(entryId)}`);
    const entry = await _jsonOrThrow(r, 'Load failed');
    const state = _opsState[panelKey];
    if (state) state.entryId = entryId;
    _populateOpsForm(panelKey, entry);
    _applyOpsReadOnly(panelKey, readOnly);
    await _loadOpsHistory(panelKey);
  } catch (e) {
    showToast(e.message || 'Load failed', 'error');
  }
}

async function _deleteOpsEntry(panelKey, entryId) {
  const apiType = OPS_TYPE_MAP[panelKey];
  if (!apiType || !entryId) return;
  if (!confirm('Delete this saved record? This cannot be undone.')) return;
  try {
    const r = await authenticatedFetch(`/api/mixing/ops/${apiType}/history/${encodeURIComponent(entryId)}`, { method: 'DELETE' });
    await _jsonOrThrow(r, 'Delete failed');
    const state = _opsState[panelKey];
    if (state && state.entryId === entryId) { state.entryId = null; _resetOpsForm(panelKey); }
    await _loadOpsHistory(panelKey);
    showToast('Deleted', 'success');
  } catch (e) {
    showToast(e.message || 'Delete failed', 'error');
  }
}

async function _printOpsEntry(panelKey, entryId) {
  const apiType = OPS_TYPE_MAP[panelKey];
  if (!apiType || !entryId) return;
  try {
    const r = await authenticatedFetch(`/api/mixing/ops/${apiType}/history/${encodeURIComponent(entryId)}/pdf`);
    if (!r.ok) await _jsonOrThrow(r, 'PDF failed');
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    showToast(e.message || 'PDF failed', 'error');
  }
}

function _collectOpsData(panelKey) {
  if (panelKey === 'filter-replacement') {
    const rows = [];
    document.querySelectorAll('#ms-fr-tbody tr').forEach(tr => {
      const row = {};
      tr.querySelectorAll('[data-ff]').forEach(el => { row[el.dataset.ff] = el.value || ''; });
      rows.push(row);
    });
    const footer = {};
    document.querySelectorAll('.ms-fr-ftr').forEach(el => { footer[el.dataset.ff] = el.value || ''; });
    return { rows, footer };
  }
  if (panelKey === 'mixing-area') {
    return {
      area: document.getElementById('ms-ma-area')?.value || 'Mixing',
      person_incharge: document.getElementById('ms-ma-pic')?.value || '',
      days: _collectMixingAreaDays(),
      verified_by: document.getElementById('ms-ma-verified')?.value || '',
    };
  }
  if (panelKey === 'ro-weekly') {
    const body = document.getElementById('ms-ro-body');
    const data = {
      header_date: document.getElementById('ms-ro-date')?.value || '',
      plant1: {}, plant2: {},
      area_incharge_sign: document.getElementById('ms-ro-area-incharge')?.value || '',
    };
    body?.querySelectorAll('.ms-ro-chk').forEach(cb => {
      const pk = cb.dataset.plant;
      const rk = cb.dataset.rk;
      const rf = cb.dataset.rf;
      if (!data[pk][rk]) data[pk][rk] = {};
      data[pk][rk][rf] = cb.checked;
    });
    body?.querySelectorAll('.ms-ro-txt').forEach(inp => {
      const pk = inp.dataset.plant;
      const rk = inp.dataset.rk;
      const rf = inp.dataset.rf;
      if (!data[pk][rk]) data[pk][rk] = {};
      data[pk][rk][rf] = inp.value || '';
    });
    body?.querySelectorAll('.ms-ro-p1').forEach(el => { data.plant1[el.dataset.pk] = el.value || ''; });
    body?.querySelectorAll('.ms-ro-p2').forEach(el => { data.plant2[el.dataset.pk] = el.value || ''; });
    return data;
  }
  return {};
}

async function _saveOps(panelKey, paramsOverride = null) {
  const state = _opsState[panelKey];
  if (state?.readOnly) return;
  const p = paramsOverride || _getOpsParams(panelKey);
  if (!p) return;
  const data = _collectOpsData(panelKey);
  const headerDate = document.getElementById(_opsDateInputId(panelKey))?.value || '';
  const payload = { year: p.year, month: p.month, header_date: headerDate, data };
  const apiType = p.apiType;
  try {
    if (state && state.entryId) {
      const r = await authenticatedFetch(`/api/mixing/ops/${apiType}/history/${encodeURIComponent(state.entryId)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      await _jsonOrThrow(r, 'Save failed');
    } else {
      const r = await authenticatedFetch(`/api/mixing/ops/${apiType}/history`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const resp = await _jsonOrThrow(r, 'Save failed');
      if (state) state.entryId = resp.entry_id;
    }
    await _loadOpsHistory(panelKey);
  } catch (e) {
    showToast(e.message || 'Save failed', 'error');
    throw e;
  }
}

async function _saveCurrentOps(panelKey) {
  try {
    await _flushAllAutosaves();
    await _saveOps(panelKey);
    showToast('Saved', 'success');
  } catch (e) {
    /* _saveOps already toasted */
  }
}

async function _saveAndPrintCurrentOps(panelKey) {
  try {
    await _saveOps(panelKey);
    const state = _opsState[panelKey];
    const entryId = state?.entryId;
    if (!entryId) { showToast('Nothing to print yet', 'error'); return; }
    await _printOpsEntry(panelKey, entryId);
  } catch (e) {
    /* save already toasted */
  }
}

async function _downloadOpsPdf(docType) {
  const panelKey = Object.entries(OPS_TYPE_MAP).find(([, v]) => v === docType)?.[0];
  if (panelKey) await _saveAndPrintCurrentOps(panelKey);
}

// ============================================================================
// Entry point
// ============================================================================

export function initMixingSectionPage() {
  const root = document.getElementById('view-mixing-section');
  if (!root) return;
  if (!root.dataset.msBuilt) {
    _buildShell();
    root.dataset.msBuilt = '1';
  }
  let deepLinkTank = '';
  let deepLinkEntry = '';
  try {
    const raw = sessionStorage.getItem('ms_cip_deeplink');
    if (raw) {
      const parsed = JSON.parse(raw);
      deepLinkTank = String(parsed?.tank || '').trim();
      deepLinkEntry = String(parsed?.entry || '').trim();
      sessionStorage.removeItem('ms_cip_deeplink');
    }
  } catch {}
  if (deepLinkTank && deepLinkEntry && CIP_TANK_KEYS.includes(deepLinkTank)) {
    _activeSubtab = 'cip';
    _cipSelectedTank = deepLinkTank;
    _applySubtabStyles('cip');
    document.querySelectorAll('.ms-panel').forEach(p => p.classList.add('hidden'));
    const cipPanel = document.getElementById('ms-panel-cip');
    if (cipPanel) cipPanel.classList.remove('hidden');
    _renderCipPanel();
    _editCipHistory(deepLinkEntry, deepLinkTank);
    return;
  }
  _switchSubtab(_activeSubtab);
}


