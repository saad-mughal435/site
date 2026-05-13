/**
 * Mixing Utilities: CMPD daily log, plant utility shift report, boiler daily checklist.
 * Mirrors the data-entry conventions of mixing_section.js (subtab pills, autosave with status banner,
 * Save/Save-as-PDF buttons, browsable history of past entries).
 */
import { authenticatedFetch } from '../auth.js?v=20260428b';
import { showToast } from '../utils.js?v=20260129a';

const SIGN_NAMES = ['Zeeshan Alam', 'Zeeshan Ahmad', 'Umer', 'Zeeshan Iqbal', 'Usman'];

const SUBTABS = [
  { key: 'aro-log',       label: 'CMPD Daily Log' },
  { key: 'utility-shift', label: 'Plant Utility Shift Report' },
  { key: 'boiler-daily',  label: 'Boiler Daily Checklist' },
];

const DOC_TYPE_BY_TAB = {
  'aro-log':       'aro_cmpd_daily_log',
  'utility-shift': 'plant_utility_shift_report',
  'boiler-daily':  'boiler_daily_checklist',
};

const CMPD_PLANTS = ['480 CMPD', '960 CMPD'];
const BOILER_NUMBERS = ['Boiler 1', 'Boiler 2'];

const MU_SUBTAB_ACTIVE_CLASS = 'mu-subtab-btn inline-flex items-center rounded-full border border-slate-900 bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors';
const MU_SUBTAB_INACTIVE_CLASS = 'mu-subtab-btn inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50';

const CMPD_READING_SLOTS = 7;

const CMPD_ITEMS = [
  { sl: 1,  description: 'MMF INLET PRESSURE',                              unit: 'BAR',   design: '5-6 BAR' },
  { sl: 2,  description: 'MMF OUTLET / ADF INLET PRESSURE',                 unit: 'BAR',   design: '5-6 BAR' },
  { sl: 3,  description: 'ADF OUTLET / CARTRIDGE FILTER INLET PRESSURE',    unit: 'BAR',   design: '5-6 BAR' },
  { sl: 4,  description: 'CARTRIDGE FILTER OUTLET PRESSURE',                unit: 'BAR',   design: '5-6 BAR' },
  { sl: 5,  description: 'HP PUMP INLET PRESSURE',                          unit: 'BAR',   design: '5-6 BAR' },
  { sl: 6,  description: 'RO MEMBRANE INLET PRESSURE',                      unit: 'BAR',   design: '8-14 BAR' },
  { sl: 7,  description: 'RO MEMBRANE INTERMEDIATE PRESSURE',               unit: 'BAR',   design: '8-14 BAR' },
  { sl: 8,  description: 'RO MEMBRANE REJECT PRESSURE',                     unit: 'BAR',   design: '6-12 BAR' },
  { sl: 9,  description: 'RO INLET FLOW',                                   unit: 'M³/H',  design: '28-32 M³/H' },
  { sl: 10, description: 'RO PRODUCT FLOW',                                 unit: 'M³/H',  design: '19-21 M³/H' },
  { sl: 11, description: 'RO REJECT FLOW',                                  unit: 'M³/H',  design: '7-8 M³/H' },
  { sl: 12, description: 'RO FEED CONDUCTIVITY',                            unit: 'µS/cm', design: '1000 µS/cm' },
  { sl: 13, description: 'RO FEED ORP',                                     unit: 'MV',    design: '450 MV' },
  { sl: 14, description: 'RO PRODUCT CONDUCTIVITY',                         unit: 'µS/cm', design: '15-25 µS/cm' },
  { sl: 15, description: 'RO REJECT CONDUCTIVITY',                          unit: 'µS/cm', design: '850-2000 µS/cm' },
  { sl: 16, description: 'RO PRODUCT PH',                                   unit: 'pH',    design: '8 pH' },
  { sl: 17, description: 'REMIN WATER CONDUCTIVITY-1',                      unit: 'µS/cm', design: '25-35 µS/cm' },
  { sl: 18, description: 'REMIN WATER CONDUCTIVITY-2',                      unit: 'µS/cm', design: '215-230 µS/cm' },
  { sl: 19, description: 'REMIN WATER PH',                                  unit: 'pH',    design: '7.5 pH' },
  { sl: 20, description: 'CIRCULATION OZONE',                               unit: 'PPM',   design: '0.4 PPM' },
  { sl: 21, description: 'OZONE INLET WATER TEMPERATURE',                   unit: 'Degree',design: '15-20 Degree' },
  { sl: 22, description: 'OZONE INLET AIR PRESSURE',                        unit: 'BAR',   design: '6-6.5 BAR' },
  { sl: 23, description: 'RO INLET FLOW WATER READING',                     unit: 'M³',    design: '' },
  { sl: 24, description: 'RO PRODUCT FLOW WATER READING',                   unit: 'M³',    design: '' },
  { sl: 25, description: 'RO REJECT FLOW WATER READING',                    unit: 'M³',    design: '' },
  { sl: 26, description: 'PRODUCT WATER TANK PH',                           unit: 'pH',    design: '' },
  { sl: 27, description: 'PRODUCT TANK WATER TASTE',                        unit: 'OK',    design: '' },
  { sl: 28, description: 'TASTE',                                           unit: 'OK',    design: '' },
];

const BOILER_ITEMS = [
  { sl: 1,  label: 'Feed water pump' },
  { sl: 2,  label: 'Feed water pump 02' },
  { sl: 3,  label: 'Burner / Solenoid valve' },
  { sl: 4,  label: 'Solenoid valve 02' },
  { sl: 5,  label: 'Solenoid valve 03' },
  { sl: 6,  label: 'Spark Electrode' },
  { sl: 7,  label: 'Carbon Deposition' },
  { sl: 8,  label: 'Water Gauge glass' },
  { sl: 9,  label: 'High and low pressure switch' },
  { sl: 10, label: 'Water level control switch' },
  { sl: 11, label: 'Steam Safety valve 01' },
  { sl: 12, label: 'Steam Safety valve 02' },
  { sl: 13, label: 'Oil Filter Condition / Cleaning' },
  { sl: 14, label: 'Service Pressure Gauge' },
  { sl: 15, label: 'Steam Pressure Gauge' },
  { sl: 16, label: 'Fuel Filter / Cleaning', sub: ['a) Service', 'b) Chemical'] },
  { sl: 17, label: 'Boiler Water Level Indicator (BWLI)' },
  { sl: 18, label: 'Steam pressure / Sugar Dissolver' },
  { sl: 19, label: 'Blowdown valve maintenance', sub: ['a) Boiler 1', 'b) Boiler 2'] },
];

const CHILLER_UNITS = ['K20', 'K30', 'K40', 'K50'];
const ETP_SOURCES = [
  { key: 'tank_02',         label: 'Tank 02' },
  { key: 'dewa_main_line',  label: 'Dewa Main Line' },
  { key: 'irrigation_tank', label: 'Irrigation Tank' },
];

const WATER_TEST_PARAMS = [
  { key: 'tds',           label: 'TDS' },
  { key: 'hardness',      label: 'Hardness' },
  { key: 'ph',            label: 'pH' },
  { key: 'conductivity',  label: 'Conductivity' },
  { key: 'alkalinity',    label: 'Alkalinity' },
];

let _activeSubtab = 'aro-log';
const _entries = { aro_cmpd_daily_log: [], plant_utility_shift_report: [], boiler_daily_checklist: [] };
const _editing = { 'aro-log': null, 'utility-shift': null, 'boiler-daily': null };
const _autosaveTimers = {};

// ============================================================================
// Helpers
// ============================================================================

function _esc(s) {
  const t = document.createElement('div');
  t.textContent = s == null ? '' : String(s);
  return t.innerHTML;
}

function _todayIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _setStatus(text, type = 'info') {
  const el = document.getElementById('mu-status');
  if (!el) return;
  el.textContent = text;
  el.className = 'text-xs mb-4 min-h-[1rem] ' + (type === 'error' ? 'text-red-500 font-semibold' : type === 'success' ? 'text-green-600' : 'text-slate-400');
}

async function _readResponseJson(r) {
  const text = await r.text();
  if (!text || !text.trim()) throw new Error(`Empty server response (HTTP ${r.status})`);
  const trimmed = text.trim();
  if (trimmed[0] !== '{' && trimmed[0] !== '[') {
    throw new Error(`Server did not return JSON (HTTP ${r.status})`);
  }
  return JSON.parse(text);
}

async function _jsonOrThrow(r, fallback = 'Request failed') {
  const data = await _readResponseJson(r);
  if (!r.ok) throw new Error(data.detail || data.message || r.statusText || fallback);
  return data;
}

function _selectHtml(options, selected, attrs = '') {
  const cls = 'w-full px-2.5 py-1.5 text-[12px] font-medium text-slate-800 border border-slate-300 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400';
  const merged = /class=/.test(attrs) ? attrs : `${attrs} class="${cls}"`;
  return `<select ${merged}>${options
    .map((o) => `<option value="${_esc(o)}" ${o === (selected ?? '') ? 'selected' : ''}>${_esc(o)}</option>`)
    .join('')}</select>`;
}

function _docInfoBoxHtml({ title, docNo, issueNo = '03', issueDate = '24/11/2014', revDate = '03/02/2022' }) {
  return `
    <div class="mb-4 border border-slate-400 rounded-xl overflow-hidden bg-white">
      <div class="grid grid-cols-12 items-stretch">
        <div class="col-span-3 border-r border-slate-400 flex items-center justify-center p-2 bg-slate-50">
          <div class="text-center">
            <div class="text-[10px] font-bold text-slate-800 leading-tight">Demo Plant</div>
            <div class="text-[9px] text-slate-600 leading-tight">LLC</div>
          </div>
        </div>
        <div class="col-span-6 border-r border-slate-400 flex items-center justify-center p-2">
          <div class="text-center font-bold text-slate-900 text-sm md:text-base uppercase tracking-wide">${_esc(title)}</div>
        </div>
        <div class="col-span-3 p-2 text-[10px] text-slate-700 grid grid-cols-2 gap-x-2 gap-y-0.5">
          <div class="font-semibold">Doc No.</div><div>: ${_esc(docNo)}</div>
          <div class="font-semibold">Issue No.</div><div>: ${_esc(issueNo)}</div>
          <div class="font-semibold">Issue Dt.</div><div>: ${_esc(issueDate)}</div>
          <div class="font-semibold">Rev. Dt.</div><div>: ${_esc(revDate)}</div>
        </div>
      </div>
    </div>
  `;
}

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
        console.error('Autosave failed', e);
        _setStatus('Save failed - click Save to retry', 'error');
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
    console.error('Autosave flush failed', e);
    _setStatus('Save failed', 'error');
    throw e;
  }
}

window.addEventListener('beforeunload', (event) => {
  if (!Object.keys(_autosaveTimers).length) return;
  void _flushAllAutosaves();
  event.preventDefault();
  event.returnValue = '';
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden' || !Object.keys(_autosaveTimers).length) return;
  void _flushAllAutosaves().catch(() => {});
});

// ============================================================================
// Shell
// ============================================================================

let _initialized = false;

export function initMixingUtilitiesPage() {
  if (!_initialized) {
    _buildShell();
    _initialized = true;
  }
  _switchSubtab(_activeSubtab);
}

function _buildShell() {
  const subtabs = document.getElementById('mu-subtabs');
  const root = document.getElementById('mu-panels-root');
  if (!subtabs || !root) return;

  subtabs.innerHTML = SUBTABS.map(
    (d) => `<button type="button" data-mu-tab="${d.key}" class="${MU_SUBTAB_INACTIVE_CLASS}">${_esc(d.label)}</button>`
  ).join('');

  root.innerHTML = `
    <div id="mu-panel-aro-log" class="mu-panel hidden rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm"></div>
    <div id="mu-panel-utility-shift" class="mu-panel hidden rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm"></div>
    <div id="mu-panel-boiler-daily" class="mu-panel hidden rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm"></div>
  `;

  subtabs.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-mu-tab]');
    if (!btn) return;
    await _flushAllAutosaves();
    _switchSubtab(btn.getAttribute('data-mu-tab'));
  });
}

function _applySubtabStyles(activeKey) {
  document.querySelectorAll('.mu-subtab-btn').forEach((btn) => {
    const on = btn.getAttribute('data-mu-tab') === activeKey;
    btn.className = on ? MU_SUBTAB_ACTIVE_CLASS : MU_SUBTAB_INACTIVE_CLASS;
  });
}

function _switchSubtab(key) {
  _activeSubtab = key;
  _applySubtabStyles(key);
  document.querySelectorAll('.mu-panel').forEach((p) => p.classList.add('hidden'));
  const panel = document.getElementById(`mu-panel-${key}`);
  if (panel) {
    panel.classList.remove('hidden');
    _setStatus('', 'info');
  }
  if (key === 'aro-log')       { _renderAroPanel();    _loadEntries('aro-log'); }
  if (key === 'utility-shift') { _renderShiftPanel();  _loadEntries('utility-shift'); }
  if (key === 'boiler-daily')  { _renderBoilerPanel(); _loadEntries('boiler-daily'); }
}

// ============================================================================
// Common backend helpers
// ============================================================================

async function _loadEntries(panelKey) {
  const docType = DOC_TYPE_BY_TAB[panelKey];
  try {
    const r = await authenticatedFetch(`/api/mixing-utilities/${docType}`);
    const data = await _jsonOrThrow(r, 'Failed to load history');
    _entries[docType] = Array.isArray(data.entries) ? data.entries : [];
  } catch (e) {
    console.error(e);
    _entries[docType] = [];
  }
  _renderHistory(panelKey);
}

async function _fetchEntry(docType, entryId) {
  const r = await authenticatedFetch(`/api/mixing-utilities/${docType}/${encodeURIComponent(entryId)}`);
  return _jsonOrThrow(r, 'Failed to load entry');
}

async function _saveEntry(panelKey, body) {
  const docType = DOC_TYPE_BY_TAB[panelKey];
  const editing = _editing[panelKey];
  const isUpdate = Boolean(editing?.entry_id);
  const url = isUpdate
    ? `/api/mixing-utilities/${docType}/${encodeURIComponent(editing.entry_id)}`
    : `/api/mixing-utilities/${docType}`;
  const method = isUpdate ? 'PUT' : 'POST';
  const r = await authenticatedFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const res = await _jsonOrThrow(r, 'Save failed');
  const savedId = String(res.id || editing?.entry_id || '').trim();
  _editing[panelKey] = { entry_id: savedId, ...body, saved_at: res.saved_at };
  return res;
}

async function _deleteEntry(panelKey, entryId) {
  if (!confirm('Delete this entry? This cannot be undone.')) return false;
  const docType = DOC_TYPE_BY_TAB[panelKey];
  const r = await authenticatedFetch(`/api/mixing-utilities/${docType}/${encodeURIComponent(entryId)}`, { method: 'DELETE' });
  await _jsonOrThrow(r, 'Delete failed');
  return true;
}

async function _downloadEntryPdf(panelKey) {
  const editing = _editing[panelKey];
  if (!editing?.entry_id) {
    showToast('Save the entry before generating PDF.', 'error');
    return;
  }
  const docType = DOC_TYPE_BY_TAB[panelKey];
  const r = await authenticatedFetch(`/api/mixing-utilities/${docType}/${encodeURIComponent(editing.entry_id)}/pdf`);
  if (!r.ok) {
    await _jsonOrThrow(r, 'PDF failed');
    return;
  }
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function _renderHistory(panelKey) {
  const docType = DOC_TYPE_BY_TAB[panelKey];
  const host = document.getElementById(`mu-${panelKey}-history`);
  if (!host) return;
  const entries = _entries[docType] || [];
  if (!entries.length) {
    host.innerHTML = '<p class="text-xs text-slate-400">No saved entries yet.</p>';
    return;
  }
  host.innerHTML = entries
    .map(
      (e) => `
        <div class="flex items-center justify-between px-3 py-2 border border-slate-200 rounded-xl mb-1 bg-slate-50 hover:bg-slate-100 cursor-pointer" data-entry-id="${_esc(e.entry_id)}">
          <div class="flex items-center gap-2 text-xs text-slate-700 flex-1" data-mu-load>
            <span class="font-semibold">${_esc(e.entry_date || '-')}</span>
            <span class="text-slate-500">${_esc(e.summary || '')}</span>
            <span class="ml-auto text-[10px] text-slate-400">${_esc(String(e.saved_at || '').slice(0, 16).replace('T', ' '))}</span>
          </div>
          <button type="button" class="ml-3 px-2 py-0.5 text-[10px] font-semibold text-red-700 border border-red-300 rounded-full hover:bg-red-50" data-mu-delete>Delete</button>
        </div>
      `
    )
    .join('');

  host.querySelectorAll('[data-mu-load]').forEach((row) => {
    row.addEventListener('click', async (ev) => {
      const id = row.parentElement?.dataset?.entryId;
      if (!id) return;
      try {
        await _flushAllAutosaves();
        const docType2 = DOC_TYPE_BY_TAB[panelKey];
        const entry = await _fetchEntry(docType2, id);
        _editing[panelKey] = { entry_id: entry.entry_id, entry_date: entry.entry_date, shift: entry.shift, data: entry.data };
        _renderForm(panelKey);
      } catch (e) {
        showToast(e.message || 'Load failed', 'error');
      }
    });
  });

  host.querySelectorAll('[data-mu-delete]').forEach((btn) => {
    btn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const id = btn.parentElement?.dataset?.entryId;
      if (!id) return;
      const ok = await _deleteEntry(panelKey, id);
      if (!ok) return;
      if (_editing[panelKey]?.entry_id === id) {
        _editing[panelKey] = null;
      }
      await _loadEntries(panelKey);
      _renderForm(panelKey);
      showToast('Deleted', 'success');
    });
  });
}

function _renderForm(panelKey) {
  if (panelKey === 'aro-log') _renderAroForm();
  else if (panelKey === 'utility-shift') _renderShiftForm();
  else if (panelKey === 'boiler-daily') _renderBoilerForm();
}

function _actionBarHtml(panelKey) {
  const editing = _editing[panelKey];
  return `
    <div class="flex flex-wrap gap-2 items-center mb-3">
      <button type="button" data-mu-action="new" class="px-4 py-2 text-sm font-semibold rounded-full border border-slate-300 bg-white hover:bg-slate-50">New</button>
      <button type="button" data-mu-action="save" class="px-4 py-2 text-sm font-semibold rounded-full bg-emerald-600 hover:bg-emerald-700 text-white">${editing?.entry_id ? 'Update' : 'Save'}</button>
      <button type="button" data-mu-action="pdf" class="px-4 py-2 text-sm font-semibold rounded-full bg-slate-900 hover:bg-slate-800 text-white">Save as PDF</button>
      ${editing?.entry_id ? `<span class="text-[11px] text-slate-500">Editing: ${_esc(editing.entry_id)}</span>` : ''}
    </div>
  `;
}

function _bindActionBar(panel, panelKey) {
  panel.querySelector('[data-mu-action="new"]').addEventListener('click', async () => {
    if (_editing[panelKey] && !confirm('Discard the currently open entry and start fresh?')) return;
    _editing[panelKey] = null;
    _renderForm(panelKey);
  });
  panel.querySelector('[data-mu-action="save"]').addEventListener('click', async () => {
    try {
      await _flushAllAutosaves();
      await _persistFromForm(panelKey);
      showToast('Saved', 'success');
      await _loadEntries(panelKey);
      _renderForm(panelKey);
    } catch (e) {
      showToast(e.message || 'Save failed', 'error');
    }
  });
  panel.querySelector('[data-mu-action="pdf"]').addEventListener('click', async () => {
    try {
      await _flushAllAutosaves();
      await _persistFromForm(panelKey);
      await _loadEntries(panelKey);
      await _downloadEntryPdf(panelKey);
    } catch (e) {
      showToast(e.message || 'PDF failed', 'error');
    }
  });
}

async function _persistFromForm(panelKey) {
  const body = _collectFromForm(panelKey);
  await _saveEntry(panelKey, body);
}

function _collectFromForm(panelKey) {
  if (panelKey === 'aro-log')       return _collectAro();
  if (panelKey === 'utility-shift') return _collectShift();
  if (panelKey === 'boiler-daily')  return _collectBoiler();
  return { entry_date: _todayIsoDate(), shift: '', data: {} };
}

// ============================================================================
// Panel A: CMPD Daily Log (REMIN RO Water Plant)
// ============================================================================

function _renderAroPanel() {
  const panel = document.getElementById('mu-panel-aro-log');
  if (!panel || panel.dataset.built) {
    if (panel) _renderAroForm();
    return;
  }
  panel.dataset.built = '1';
  panel.innerHTML = `
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-lg font-bold text-slate-900">CMPD REMIN RO Water Plant — Operation Log Sheet</h3>
      <span class="text-[11px] text-slate-500">Doc.Ref: KBF/PRD/80.1</span>
    </div>
    <div id="mu-aro-form"></div>
    <div class="mt-6 border-t border-slate-200 pt-4">
      <h4 class="text-sm font-semibold text-slate-700 mb-2">Past Entries</h4>
      <div id="mu-aro-log-history" class="text-xs"></div>
    </div>
  `;
  _renderAroForm();
}

function _emptyAroData() {
  return {
    header: { plant: '480 CMPD', batch_no: '' },
    items: CMPD_ITEMS.map((spec) => ({
      sl: spec.sl,
      readings: Array(CMPD_READING_SLOTS).fill(''),
    })),
    footer: {
      total_water_produced: '',
      total_reject: '',
      comments: '',
      prepared_by: '',
      total_running_hours: '',
      filter_change: '',
      mineral_preparation: '',
      received_by: '',
    },
  };
}

function _renderAroForm() {
  const formHost = document.getElementById('mu-aro-form');
  if (!formHost) return;
  const editing = _editing['aro-log'] || { entry_date: _todayIsoDate(), shift: '', data: _emptyAroData() };
  const data = editing.data || _emptyAroData();
  const header = data.header || {};
  const footer = data.footer || {};
  const itemsBySl = {};
  for (const it of (Array.isArray(data.items) ? data.items : [])) {
    const slNum = parseInt(it && it.sl, 10);
    if (Number.isFinite(slNum)) itemsBySl[slNum] = it;
  }

  const readingHeaders = Array.from({ length: CMPD_READING_SLOTS }, (_, i) => `Reading ${i + 1}`);

  formHost.innerHTML = `
    ${_actionBarHtml('aro-log')}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Date</label><input type="date" id="mu-aro-date" value="${_esc(editing.entry_date || _todayIsoDate())}" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-xl bg-white" /></div>
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Plant</label>${_selectHtml(CMPD_PLANTS, CMPD_PLANTS.includes(header.plant) ? header.plant : '480 CMPD', 'id="mu-aro-plant"')}</div>
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Batch No of Product</label><input type="text" id="mu-aro-batch-no" value="${_esc(header.batch_no || '')}" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-xl bg-white" /></div>
    </div>
    <div class="overflow-x-auto border border-slate-300 rounded-xl bg-white">
      <table class="min-w-[1200px] w-full text-[11px] border-collapse">
        <thead class="bg-slate-100 text-slate-800">
          <tr>
            <th class="border border-slate-300 px-1 py-1 font-bold w-[40px]">Sl. No</th>
            <th class="border border-slate-300 px-1 py-1 font-bold text-left">Description</th>
            <th class="border border-slate-300 px-1 py-1 font-bold w-[70px]">Unit</th>
            <th class="border border-slate-300 px-1 py-1 font-bold w-[110px]">Design Parameters</th>
            <th class="border border-slate-300 px-1 py-1 font-bold" colspan="${CMPD_READING_SLOTS}">Actual Running Parameters</th>
          </tr>
          <tr>
            <th class="border border-slate-300 bg-slate-50"></th>
            <th class="border border-slate-300 bg-slate-50"></th>
            <th class="border border-slate-300 bg-slate-50"></th>
            <th class="border border-slate-300 bg-slate-50"></th>
            ${readingHeaders.map((h) => `<th class="border border-slate-300 px-1 py-0.5 font-semibold text-[10px] bg-slate-50">${_esc(h)}</th>`).join('')}
          </tr>
        </thead>
        <tbody id="mu-aro-tbody">
          ${CMPD_ITEMS.map((spec, idx) => {
            const item = itemsBySl[spec.sl] || {};
            const readings = Array.isArray(item.readings) ? item.readings : [];
            return `
              <tr class="${idx % 2 ? 'bg-slate-50' : 'bg-white'}">
                <td class="border border-slate-300 px-1 py-0.5 font-bold text-center">${spec.sl}</td>
                <td class="border border-slate-300 px-1 py-0.5">${_esc(spec.description)}</td>
                <td class="border border-slate-300 px-1 py-0.5 text-center">${_esc(spec.unit)}</td>
                <td class="border border-slate-300 px-1 py-0.5 text-center">${_esc(spec.design)}</td>
                ${Array.from({ length: CMPD_READING_SLOTS }, (_, ri) => `<td class="border border-slate-300 px-0.5 py-0.5"><input class="mu-aro-cell w-full px-1 py-1 text-[11px] border border-slate-300 rounded bg-white" data-sl="${spec.sl}" data-ri="${ri}" value="${_esc(readings[ri] || '')}" /></td>`).join('')}
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Total Water Produced Per Day</label><input type="text" id="mu-aro-foot-water" value="${_esc(footer.total_water_produced || '')}" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-xl bg-white" /></div>
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Total Running Hours</label><input type="text" id="mu-aro-foot-hours" value="${_esc(footer.total_running_hours || '')}" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-xl bg-white" /></div>
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Total Reject</label><input type="text" id="mu-aro-foot-reject" value="${_esc(footer.total_reject || '')}" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-xl bg-white" /></div>
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Filter Change (if any)</label><input type="text" id="mu-aro-foot-filter" value="${_esc(footer.filter_change || '')}" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-xl bg-white" /></div>
      <div class="md:col-span-2"><label class="block text-xs font-semibold text-slate-700 mb-1">Comments</label><input type="text" id="mu-aro-foot-comments" value="${_esc(footer.comments || '')}" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-xl bg-white" /></div>
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Mineral Preparation (Quantity)</label><input type="text" id="mu-aro-foot-mineral" value="${_esc(footer.mineral_preparation || '')}" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-xl bg-white" /></div>
      <div></div>
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Prepared By</label>${_selectHtml(['', ...SIGN_NAMES], footer.prepared_by || '', 'id="mu-aro-foot-prepared"')}</div>
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Received By</label>${_selectHtml(['', ...SIGN_NAMES], footer.received_by || '', 'id="mu-aro-foot-received"')}</div>
    </div>
  `;

  const panel = document.getElementById('mu-panel-aro-log');
  _bindActionBar(panel, 'aro-log');
  formHost.querySelectorAll('input, select').forEach((el) => {
    el.addEventListener('change', () => _queueAutosave('aro-log', () => _persistFromForm('aro-log')));
    el.addEventListener('input',  () => _queueAutosave('aro-log', () => _persistFromForm('aro-log')));
  });
}

function _collectAro() {
  const date = document.getElementById('mu-aro-date')?.value || _todayIsoDate();
  const plantVal = document.getElementById('mu-aro-plant')?.value || '480 CMPD';
  const header = {
    plant: CMPD_PLANTS.includes(plantVal) ? plantVal : '480 CMPD',
    batch_no: document.getElementById('mu-aro-batch-no')?.value || '',
  };
  const footer = {
    total_water_produced: document.getElementById('mu-aro-foot-water')?.value || '',
    total_reject: document.getElementById('mu-aro-foot-reject')?.value || '',
    comments: document.getElementById('mu-aro-foot-comments')?.value || '',
    prepared_by: document.getElementById('mu-aro-foot-prepared')?.value || '',
    total_running_hours: document.getElementById('mu-aro-foot-hours')?.value || '',
    filter_change: document.getElementById('mu-aro-foot-filter')?.value || '',
    mineral_preparation: document.getElementById('mu-aro-foot-mineral')?.value || '',
    received_by: document.getElementById('mu-aro-foot-received')?.value || '',
  };
  const itemsBySl = {};
  for (const spec of CMPD_ITEMS) {
    itemsBySl[spec.sl] = { sl: spec.sl, readings: Array(CMPD_READING_SLOTS).fill('') };
  }
  document.querySelectorAll('#mu-aro-tbody .mu-aro-cell').forEach((el) => {
    const sl = parseInt(el.dataset.sl, 10);
    const ri = parseInt(el.dataset.ri, 10);
    if (!Number.isFinite(sl) || !Number.isFinite(ri) || !itemsBySl[sl]) return;
    if (ri < 0 || ri >= CMPD_READING_SLOTS) return;
    itemsBySl[sl].readings[ri] = el.value || '';
  });
  const items = CMPD_ITEMS.map((spec) => itemsBySl[spec.sl]);
  return { entry_date: date, shift: '', data: { header, items, footer } };
}

// ============================================================================
// Panel B: Plant Utility Shift Report
// ============================================================================

function _renderShiftPanel() {
  const panel = document.getElementById('mu-panel-utility-shift');
  if (!panel || panel.dataset.built) {
    if (panel) _renderShiftForm();
    return;
  }
  panel.dataset.built = '1';
  panel.innerHTML = `
    ${_docInfoBoxHtml({ title: 'Plant Utility Shift Report', docNo: 'KBF/PRD/75' })}
    <div id="mu-shift-form"></div>
    <div class="mt-6 border-t border-slate-200 pt-4">
      <h4 class="text-sm font-semibold text-slate-700 mb-2">Past Entries</h4>
      <div id="mu-utility-shift-history" class="text-xs"></div>
    </div>
  `;
  _renderShiftForm();
}

function _emptyShiftData() {
  return {
    liquefied_gases: [{ tank: 'CO2 Tank 1', start_vol: '', end_vol: '', vol_used: '', comments: '' }],
    argon_cylinders: { total_issued: '', total_in_stock: '', total_empty_bottles: '', comments: '' },
    forklift: {
      lifter_1: { total_hours: '', on_time: '', off_time: '', run_time: '' },
      lifter_2: { total_hours: '', on_time: '', off_time: '', run_time: '' },
      lifter_3: { total_hours: '', on_time: '', off_time: '', run_time: '' },
      lifter_4: { total_hours: '', on_time: '', off_time: '', run_time: '' },
      lifter_5: { total_hours: '', on_time: '', off_time: '', run_time: '' },
    },
    boiler: { on_time: '', off_time: '', run_time: '', total_water_used: '', comments: '' },
    diesel_feed: { start: '', end: '', used: '' },
    water_used: [
      { pump: 'Condenser', start: '', end: '', used: '' },
      { pump: 'Boiler', start: '', end: '', used: '' },
    ],
    chemical_feed: [{ name: '', quantity: '' }],
    chiller_plant_1: Object.fromEntries(CHILLER_UNITS.map((u) => [u, { start_hours: '', end_hours: '', run_hours: '', alarm: '' }])),
    chiller_plant_2: Object.fromEntries(CHILLER_UNITS.map((u) => [u, { start_hours: '', end_hours: '', run_hours: '', alarm: '' }])),
    etp: Object.fromEntries(ETP_SOURCES.map((s) => [s.key, { start_hours: '', end_hours: '', total_runtime: '', total_used: '' }])),
    utility_incharge_sign: '',
    production_manager_sign: '',
  };
}

function _shiftSection(title, bodyHtml) {
  return `
    <details class="border border-slate-300 rounded-xl mb-3 overflow-hidden" open>
      <summary class="cursor-pointer bg-slate-100 px-3 py-2 text-sm font-bold text-slate-800">${_esc(title)}</summary>
      <div class="p-3 bg-white">${bodyHtml}</div>
    </details>
  `;
}

function _txtCell(attrs, value, extraCls = '') {
  return `<input class="mu-shift-cell w-full px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white ${extraCls}" ${attrs} value="${_esc(value || '')}" />`;
}

function _renderShiftForm() {
  const formHost = document.getElementById('mu-shift-form');
  if (!formHost) return;
  const editing = _editing['utility-shift'] || { entry_date: _todayIsoDate(), shift: '', data: _emptyShiftData() };
  const d = editing.data || _emptyShiftData();

  // Liquefied Gases
  const liquefied = Array.isArray(d.liquefied_gases) && d.liquefied_gases.length ? d.liquefied_gases : [{}];
  const liquefiedHtml = `
    <table class="w-full text-[11px] border-collapse"><thead class="bg-slate-50 text-slate-700">
      <tr>${['Tank', 'Start Vol %', 'End Vol %', 'Vol Used %', 'Comments'].map((h) => `<th class="border border-slate-300 px-1 py-1 font-bold">${h}</th>`).join('')}</tr>
    </thead><tbody id="mu-shift-liquefied-tbody">
      ${liquefied.map((row, i) => `
        <tr>
          <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="liquefied_gases" data-ri="${i}" data-rf="tank"`, row.tank)}</td>
          <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="liquefied_gases" data-ri="${i}" data-rf="start_vol"`, row.start_vol)}</td>
          <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="liquefied_gases" data-ri="${i}" data-rf="end_vol"`, row.end_vol)}</td>
          <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="liquefied_gases" data-ri="${i}" data-rf="vol_used"`, row.vol_used)}</td>
          <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="liquefied_gases" data-ri="${i}" data-rf="comments"`, row.comments)}</td>
        </tr>
      `).join('')}
    </tbody></table>
    <button type="button" class="mt-2 text-[11px] font-semibold text-emerald-700 hover:underline" data-mu-add-row="liquefied_gases">+ Add tank row</button>
  `;

  // Argon
  const a = d.argon_cylinders || {};
  const argonHtml = `
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
      <div><label class="block text-[11px] font-semibold text-slate-700 mb-1">Total Issued</label>${_txtCell('data-section="argon_cylinders" data-rf="total_issued"', a.total_issued)}</div>
      <div><label class="block text-[11px] font-semibold text-slate-700 mb-1">Total in Stock</label>${_txtCell('data-section="argon_cylinders" data-rf="total_in_stock"', a.total_in_stock)}</div>
      <div><label class="block text-[11px] font-semibold text-slate-700 mb-1">Total Empty Bottles</label>${_txtCell('data-section="argon_cylinders" data-rf="total_empty_bottles"', a.total_empty_bottles)}</div>
      <div><label class="block text-[11px] font-semibold text-slate-700 mb-1">Comments</label>${_txtCell('data-section="argon_cylinders" data-rf="comments"', a.comments)}</div>
    </div>
  `;

  // Forklift
  const f = d.forklift || {};
  const forkliftHeaderRow = ['Metric', ...[1, 2, 3, 4, 5].map((i) => `Lifter ${i}`)];
  const forkliftMetrics = [
    ['total_hours', 'Total Hours'],
    ['on_time', 'On Time'],
    ['off_time', 'Off Time'],
    ['run_time', 'Run Time'],
  ];
  const forkliftHtml = `
    <table class="w-full text-[11px] border-collapse"><thead class="bg-slate-50">
      <tr>${forkliftHeaderRow.map((h) => `<th class="border border-slate-300 px-1 py-1 font-bold">${h}</th>`).join('')}</tr>
    </thead><tbody>
      ${forkliftMetrics.map(([key, label]) => `
        <tr>
          <td class="border border-slate-300 px-1 py-0.5 font-semibold">${label}</td>
          ${[1, 2, 3, 4, 5].map((i) => `<td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="forklift" data-ri="lifter_${i}" data-rf="${key}"`, (f[`lifter_${i}`] || {})[key])}</td>`).join('')}
        </tr>
      `).join('')}
    </tbody></table>
  `;

  // Boiler
  const b = d.boiler || {};
  const boilerHtml = `
    <div class="grid grid-cols-2 md:grid-cols-5 gap-2">
      <div><label class="block text-[11px] font-semibold mb-1">On Time</label>${_txtCell('data-section="boiler" data-rf="on_time"', b.on_time)}</div>
      <div><label class="block text-[11px] font-semibold mb-1">Off Time</label>${_txtCell('data-section="boiler" data-rf="off_time"', b.off_time)}</div>
      <div><label class="block text-[11px] font-semibold mb-1">Run Time</label>${_txtCell('data-section="boiler" data-rf="run_time"', b.run_time)}</div>
      <div><label class="block text-[11px] font-semibold mb-1">Total Water Used</label>${_txtCell('data-section="boiler" data-rf="total_water_used"', b.total_water_used)}</div>
      <div><label class="block text-[11px] font-semibold mb-1">Comments</label>${_txtCell('data-section="boiler" data-rf="comments"', b.comments)}</div>
    </div>
  `;

  // Diesel
  const ds = d.diesel_feed || {};
  const dieselHtml = `
    <div class="grid grid-cols-3 gap-2">
      <div><label class="block text-[11px] font-semibold mb-1">Start</label>${_txtCell('data-section="diesel_feed" data-rf="start"', ds.start)}</div>
      <div><label class="block text-[11px] font-semibold mb-1">End</label>${_txtCell('data-section="diesel_feed" data-rf="end"', ds.end)}</div>
      <div><label class="block text-[11px] font-semibold mb-1">Used</label>${_txtCell('data-section="diesel_feed" data-rf="used"', ds.used)}</div>
    </div>
  `;

  // Water Used
  const wRows = Array.isArray(d.water_used) && d.water_used.length ? d.water_used : [{ pump: 'Condenser' }, { pump: 'Boiler' }];
  const waterHtml = `
    <table class="w-full text-[11px] border-collapse"><thead class="bg-slate-50">
      <tr>${['Pump', 'Start', 'End', 'Used'].map((h) => `<th class="border border-slate-300 px-1 py-1 font-bold">${h}</th>`).join('')}</tr>
    </thead><tbody>
      ${wRows.map((row, i) => `
        <tr>
          <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="water_used" data-ri="${i}" data-rf="pump"`, row.pump)}</td>
          <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="water_used" data-ri="${i}" data-rf="start"`, row.start)}</td>
          <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="water_used" data-ri="${i}" data-rf="end"`, row.end)}</td>
          <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="water_used" data-ri="${i}" data-rf="used"`, row.used)}</td>
        </tr>
      `).join('')}
    </tbody></table>
  `;

  // Chemical Feed
  const cfRows = Array.isArray(d.chemical_feed) && d.chemical_feed.length ? d.chemical_feed : [{}];
  const chemicalHtml = `
    <table class="w-full text-[11px] border-collapse"><thead class="bg-slate-50">
      <tr><th class="border border-slate-300 px-1 py-1 font-bold w-2/3">Chemical</th><th class="border border-slate-300 px-1 py-1 font-bold">Quantity</th></tr>
    </thead><tbody id="mu-shift-chemical-tbody">
      ${cfRows.map((row, i) => `
        <tr>
          <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="chemical_feed" data-ri="${i}" data-rf="name"`, row.name)}</td>
          <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="chemical_feed" data-ri="${i}" data-rf="quantity"`, row.quantity)}</td>
        </tr>
      `).join('')}
    </tbody></table>
    <button type="button" class="mt-2 text-[11px] font-semibold text-emerald-700 hover:underline" data-mu-add-row="chemical_feed">+ Add chemical</button>
  `;

  function _chillerHtml(plantKey, plantData) {
    return `
      <table class="w-full text-[11px] border-collapse"><thead class="bg-slate-50">
        <tr>${['Unit', 'Start Hours', 'End Hours', 'Run Hours', 'Alarm'].map((h) => `<th class="border border-slate-300 px-1 py-1 font-bold">${h}</th>`).join('')}</tr>
      </thead><tbody>
        ${CHILLER_UNITS.map((u) => {
          const r = plantData[u] || {};
          return `<tr>
            <td class="border border-slate-300 px-1 py-0.5 font-semibold">${u}</td>
            <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="${plantKey}" data-ri="${u}" data-rf="start_hours"`, r.start_hours)}</td>
            <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="${plantKey}" data-ri="${u}" data-rf="end_hours"`, r.end_hours)}</td>
            <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="${plantKey}" data-ri="${u}" data-rf="run_hours"`, r.run_hours)}</td>
            <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="${plantKey}" data-ri="${u}" data-rf="alarm"`, r.alarm)}</td>
          </tr>`;
        }).join('')}
      </tbody></table>
    `;
  }

  // ETP
  const etp = d.etp || {};
  const etpHtml = `
    <table class="w-full text-[11px] border-collapse"><thead class="bg-slate-50">
      <tr>${['Source', 'Start Hours', 'End Hours', 'Total Runtime', 'Total Used'].map((h) => `<th class="border border-slate-300 px-1 py-1 font-bold">${h}</th>`).join('')}</tr>
    </thead><tbody>
      ${ETP_SOURCES.map((s) => {
        const r = etp[s.key] || {};
        return `<tr>
          <td class="border border-slate-300 px-1 py-0.5 font-semibold">${_esc(s.label)}</td>
          <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="etp" data-ri="${s.key}" data-rf="start_hours"`, r.start_hours)}</td>
          <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="etp" data-ri="${s.key}" data-rf="end_hours"`, r.end_hours)}</td>
          <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="etp" data-ri="${s.key}" data-rf="total_runtime"`, r.total_runtime)}</td>
          <td class="border border-slate-300 px-0.5 py-0.5">${_txtCell(`data-section="etp" data-ri="${s.key}" data-rf="total_used"`, r.total_used)}</td>
        </tr>`;
      }).join('')}
    </tbody></table>
  `;

  formHost.innerHTML = `
    ${_actionBarHtml('utility-shift')}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Date</label><input type="date" id="mu-shift-date" value="${_esc(editing.entry_date || _todayIsoDate())}" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-xl bg-white" /></div>
    </div>
    ${_shiftSection('Liquefied Gases (CO2 Supply)', liquefiedHtml)}
    ${_shiftSection('Forklift Running Hours', forkliftHtml)}
    ${_shiftSection('Boiler', boilerHtml)}
    ${_shiftSection('Water Used in Condenser', waterHtml)}
    ${_shiftSection('Argon Gas Cylinders', argonHtml)}
    ${_shiftSection('Diesel Feed', dieselHtml)}
    ${_shiftSection('Chemical Feed in Condenser', chemicalHtml)}
    ${_shiftSection('Chiller Plant-1', _chillerHtml('chiller_plant_1', d.chiller_plant_1 || {}))}
    ${_shiftSection('Chiller Plant-2', _chillerHtml('chiller_plant_2', d.chiller_plant_2 || {}))}
    ${_shiftSection('Effluent Treatment Plant', etpHtml)}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Utility Incharge</label>${_selectHtml(['', ...SIGN_NAMES], d.utility_incharge_sign || d.area_incharge_sign || '', 'id="mu-shift-utility-incharge"')}</div>
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Production Manager</label>${_selectHtml(['', ...SIGN_NAMES], d.production_manager_sign || '', 'id="mu-shift-production-manager"')}</div>
    </div>
  `;

  const panel = document.getElementById('mu-panel-utility-shift');
  _bindActionBar(panel, 'utility-shift');

  formHost.querySelectorAll('input, select').forEach((el) => {
    const fire = () => _queueAutosave('utility-shift', () => _persistFromForm('utility-shift'));
    el.addEventListener('change', fire);
    el.addEventListener('input',  fire);
  });

  formHost.querySelectorAll('[data-mu-add-row]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.muAddRow;
      const collected = _collectShift();
      const arr = collected.data[section] || [];
      arr.push({});
      collected.data[section] = arr;
      _editing['utility-shift'] = collected;
      _renderShiftForm();
    });
  });
}

function _collectShift() {
  const date = document.getElementById('mu-shift-date')?.value || _todayIsoDate();
  const data = _emptyShiftData();
  const utilityIncharge = document.getElementById('mu-shift-utility-incharge')?.value || '';
  data.utility_incharge_sign = utilityIncharge;
  data.area_incharge_sign = utilityIncharge; // back-compat for legacy reads
  data.production_manager_sign = document.getElementById('mu-shift-production-manager')?.value || '';

  // Reset list-shaped sections to empty so we collect from DOM
  data.liquefied_gases = [];
  data.water_used = [];
  data.chemical_feed = [];

  const liquefiedRows = {};
  const waterRows = {};
  const chemicalRows = {};

  document.querySelectorAll('#mu-panel-utility-shift .mu-shift-cell').forEach((el) => {
    const section = el.dataset.section;
    const rf = el.dataset.rf;
    const ri = el.dataset.ri;
    const value = el.value || '';
    if (!section || !rf) return;
    if (section === 'liquefied_gases') {
      const idx = parseInt(ri, 10);
      if (!Number.isFinite(idx)) return;
      if (!liquefiedRows[idx]) liquefiedRows[idx] = {};
      liquefiedRows[idx][rf] = value;
    } else if (section === 'water_used') {
      const idx = parseInt(ri, 10);
      if (!Number.isFinite(idx)) return;
      if (!waterRows[idx]) waterRows[idx] = {};
      waterRows[idx][rf] = value;
    } else if (section === 'chemical_feed') {
      const idx = parseInt(ri, 10);
      if (!Number.isFinite(idx)) return;
      if (!chemicalRows[idx]) chemicalRows[idx] = {};
      chemicalRows[idx][rf] = value;
    } else if (section === 'argon_cylinders' || section === 'boiler' || section === 'diesel_feed') {
      data[section][rf] = value;
    } else if (section === 'forklift' || section === 'chiller_plant_1' || section === 'chiller_plant_2' || section === 'etp') {
      const key = String(ri || '');
      if (!key) return;
      if (!data[section][key]) data[section][key] = {};
      data[section][key][rf] = value;
    }
  });

  data.liquefied_gases = Object.keys(liquefiedRows).sort((a, b) => Number(a) - Number(b)).map((k) => liquefiedRows[k]);
  data.water_used      = Object.keys(waterRows).sort((a, b) => Number(a) - Number(b)).map((k) => waterRows[k]);
  data.chemical_feed   = Object.keys(chemicalRows).sort((a, b) => Number(a) - Number(b)).map((k) => chemicalRows[k]);

  return { entry_date: date, shift: '', data };
}

// ============================================================================
// Panel C: Boiler Daily Checklist
// ============================================================================

function _renderBoilerPanel() {
  const panel = document.getElementById('mu-panel-boiler-daily');
  if (!panel || panel.dataset.built) {
    if (panel) _renderBoilerForm();
    return;
  }
  panel.dataset.built = '1';
  panel.innerHTML = `
    ${_docInfoBoxHtml({ title: 'Boiler Daily Checklist / Maintenance Report', docNo: 'KBF/PRD/81' })}
    <div id="mu-boiler-form"></div>
    <div class="mt-6 border-t border-slate-200 pt-4">
      <h4 class="text-sm font-semibold text-slate-700 mb-2">Past Entries</h4>
      <div id="mu-boiler-daily-history" class="text-xs"></div>
    </div>
  `;
  _renderBoilerForm();
}

function _emptyBoilerData() {
  return {
    header: { time: '', boiler_no: 'Boiler 1' },
    items: BOILER_ITEMS.map((spec) => {
      const item = { sl: spec.sl, ok: false, fault: false, comments: '' };
      if (spec.sub) {
        const sub = {};
        spec.sub.forEach((s) => {
          const letter = s.charAt(0);
          sub[letter] = false;
        });
        item.sub = sub;
      }
      return item;
    }),
    alarm_leakages: { pt_5kw: '', sugar_dissolver: '' },
    fuel_water_uses: { total_water_used: '', total_fuel_used: '', chemical_bull_used: '', total_mother_generation: '' },
    full_water_test: Object.fromEntries(WATER_TEST_PARAMS.map((p) => [p.key, { boiler: '', soft: '' }])),
    done_by_sign: '',
    production_manager_sign: '',
  };
}

function _renderBoilerForm() {
  const formHost = document.getElementById('mu-boiler-form');
  if (!formHost) return;
  const editing = _editing['boiler-daily'] || { entry_date: _todayIsoDate(), shift: '', data: _emptyBoilerData() };
  const d = editing.data || _emptyBoilerData();
  const itemsBySl = {};
  for (const it of (d.items || [])) {
    const slNum = parseInt(it.sl, 10);
    if (Number.isFinite(slNum)) itemsBySl[slNum] = it;
  }
  const header = d.header || {};
  const al = d.alarm_leakages || {};
  const fw = d.fuel_water_uses || {};
  const wt = d.full_water_test || {};

  formHost.innerHTML = `
    ${_actionBarHtml('boiler-daily')}
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Date</label><input type="date" id="mu-boiler-date" value="${_esc(editing.entry_date || _todayIsoDate())}" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-xl bg-white" /></div>
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Time</label><input type="time" id="mu-boiler-time" value="${_esc(header.time || '')}" class="w-full px-2.5 py-1.5 text-sm border border-slate-300 rounded-xl bg-white" /></div>
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Boiler</label>${_selectHtml(BOILER_NUMBERS, BOILER_NUMBERS.includes(header.boiler_no) ? header.boiler_no : 'Boiler 1', 'id="mu-boiler-no"')}</div>
    </div>
    <div class="overflow-x-auto border border-slate-300 rounded-xl bg-white">
      <table class="w-full text-[12px] border-collapse">
        <thead class="bg-slate-100 text-slate-800">
          <tr>
            <th class="border border-slate-300 px-1 py-1 font-bold w-[40px]">Sl.No</th>
            <th class="border border-slate-300 px-1 py-1 font-bold text-left">Description / Condition</th>
            <th class="border border-slate-300 px-1 py-1 font-bold w-[60px]">OK</th>
            <th class="border border-slate-300 px-1 py-1 font-bold w-[60px]">Not OK</th>
            <th class="border border-slate-300 px-1 py-1 font-bold">Comments</th>
          </tr>
        </thead>
        <tbody>
          ${BOILER_ITEMS.map((spec) => {
            const item = itemsBySl[spec.sl] || { sl: spec.sl, ok: false, fault: false, comments: '', sub: {} };
            const sub = item.sub || {};
            const subHtml = (spec.sub || []).map((s) => {
              const letter = s.charAt(0);
              return `<label class="inline-flex items-center gap-1 mr-3 text-[11px] font-semibold"><input type="checkbox" class="mu-boiler-sub" data-sl="${spec.sl}" data-letter="${letter}" ${sub[letter] ? 'checked' : ''} />${_esc(s)}</label>`;
            }).join('');
            return `
              <tr>
                <td class="border border-slate-300 px-1 py-1 font-bold text-center">${spec.sl}</td>
                <td class="border border-slate-300 px-1 py-1">
                  <div>${_esc(spec.label)}</div>
                  ${subHtml ? `<div class="mt-1">${subHtml}</div>` : ''}
                </td>
                <td class="border border-slate-300 px-0.5 py-0.5 text-center"><input type="checkbox" class="mu-boiler-ok h-4 w-4" data-sl="${spec.sl}" ${item.ok ? 'checked' : ''} /></td>
                <td class="border border-slate-300 px-0.5 py-0.5 text-center"><input type="checkbox" class="mu-boiler-fault h-4 w-4" data-sl="${spec.sl}" ${item.fault ? 'checked' : ''} /></td>
                <td class="border border-slate-300 px-0.5 py-0.5"><input class="mu-boiler-comments w-full px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white" data-sl="${spec.sl}" value="${_esc(item.comments || '')}" /></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    <div class="mt-4">
      <h5 class="text-sm font-bold text-slate-800 mb-1">Any alarm leakages</h5>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label class="block text-[11px] font-semibold mb-1">a) PT 5KW</label>${_selectHtml(['', 'Yes', 'No'], al.pt_5kw || '', 'id="mu-boiler-pt-5kw"')}</div>
        <div><label class="block text-[11px] font-semibold mb-1">b) Sugar Dissolver</label>${_selectHtml(['', 'Yes', 'No'], al.sugar_dissolver || '', 'id="mu-boiler-sugar-dissolver"')}</div>
      </div>
    </div>
    <div class="mt-4">
      <h5 class="text-sm font-bold text-slate-800 mb-1">Fuel / Water Uses (fill every end of week)</h5>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div><label class="block text-[11px] font-semibold mb-1">Total Water Used</label><input type="text" id="mu-boiler-fw-water" value="${_esc(fw.total_water_used || '')}" class="w-full px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white" /></div>
        <div><label class="block text-[11px] font-semibold mb-1">Total Fuel Used</label><input type="text" id="mu-boiler-fw-fuel" value="${_esc(fw.total_fuel_used || '')}" class="w-full px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white" /></div>
        <div><label class="block text-[11px] font-semibold mb-1">Chemical/Bull Used</label><input type="text" id="mu-boiler-fw-chemical" value="${_esc(fw.chemical_bull_used || '')}" class="w-full px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white" /></div>
        <div><label class="block text-[11px] font-semibold mb-1">Total Mother Generation</label><input type="text" id="mu-boiler-fw-mother" value="${_esc(fw.total_mother_generation || '')}" class="w-full px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white" /></div>
      </div>
    </div>
    <div class="mt-4">
      <h5 class="text-sm font-bold text-slate-800 mb-1">Full Water Test (Boiler &amp; Soft Water)</h5>
      <div class="overflow-x-auto border border-slate-300 rounded-xl bg-white">
        <table class="w-full text-[11px] border-collapse">
          <thead class="bg-slate-100 text-slate-800">
            <tr>
              <th class="border border-slate-300 px-1 py-1 font-bold text-left">Parameter</th>
              <th class="border border-slate-300 px-1 py-1 font-bold">Boiler Water</th>
              <th class="border border-slate-300 px-1 py-1 font-bold">Soft Water</th>
            </tr>
          </thead>
          <tbody>
            ${WATER_TEST_PARAMS.map((p) => {
              const row = wt[p.key] || {};
              return `
                <tr>
                  <td class="border border-slate-300 px-2 py-1 font-semibold">${_esc(p.label)}</td>
                  <td class="border border-slate-300 px-0.5 py-0.5"><input class="mu-boiler-water-test w-full px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white" data-param="${_esc(p.key)}" data-source="boiler" value="${_esc(row.boiler || '')}" /></td>
                  <td class="border border-slate-300 px-0.5 py-0.5"><input class="mu-boiler-water-test w-full px-1.5 py-1 text-[11px] border border-slate-300 rounded bg-white" data-param="${_esc(p.key)}" data-source="soft" value="${_esc(row.soft || '')}" /></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Done by</label>${_selectHtml(['', ...SIGN_NAMES], d.done_by_sign || d.area_incharge_sign || '', 'id="mu-boiler-done-by"')}</div>
      <div><label class="block text-xs font-semibold text-slate-700 mb-1">Production Manager</label>${_selectHtml(['', ...SIGN_NAMES], d.production_manager_sign || '', 'id="mu-boiler-production-manager"')}</div>
    </div>
  `;

  const panel = document.getElementById('mu-panel-boiler-daily');
  _bindActionBar(panel, 'boiler-daily');

  // OK/Fault mutual exclusion
  formHost.querySelectorAll('.mu-boiler-ok').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        const sl = cb.dataset.sl;
        const fault = formHost.querySelector(`.mu-boiler-fault[data-sl="${sl}"]`);
        if (fault) fault.checked = false;
      }
    });
  });
  formHost.querySelectorAll('.mu-boiler-fault').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        const sl = cb.dataset.sl;
        const ok = formHost.querySelector(`.mu-boiler-ok[data-sl="${sl}"]`);
        if (ok) ok.checked = false;
      }
    });
  });

  formHost.querySelectorAll('input, select').forEach((el) => {
    const fire = () => _queueAutosave('boiler-daily', () => _persistFromForm('boiler-daily'));
    el.addEventListener('change', fire);
    el.addEventListener('input',  fire);
  });
}

function _collectBoiler() {
  const date = document.getElementById('mu-boiler-date')?.value || _todayIsoDate();
  const time = document.getElementById('mu-boiler-time')?.value || '';
  const boilerNoVal = document.getElementById('mu-boiler-no')?.value || 'Boiler 1';
  const data = _emptyBoilerData();
  data.header.time = time;
  data.header.boiler_no = BOILER_NUMBERS.includes(boilerNoVal) ? boilerNoVal : 'Boiler 1';

  // Reset items to ensure sub structure is preserved per spec
  const itemMap = {};
  data.items.forEach((it) => { itemMap[it.sl] = it; });

  document.querySelectorAll('.mu-boiler-ok').forEach((cb) => {
    const sl = parseInt(cb.dataset.sl, 10);
    if (Number.isFinite(sl) && itemMap[sl]) itemMap[sl].ok = !!cb.checked;
  });
  document.querySelectorAll('.mu-boiler-fault').forEach((cb) => {
    const sl = parseInt(cb.dataset.sl, 10);
    if (Number.isFinite(sl) && itemMap[sl]) itemMap[sl].fault = !!cb.checked;
  });
  document.querySelectorAll('.mu-boiler-comments').forEach((inp) => {
    const sl = parseInt(inp.dataset.sl, 10);
    if (Number.isFinite(sl) && itemMap[sl]) itemMap[sl].comments = inp.value || '';
  });
  document.querySelectorAll('.mu-boiler-sub').forEach((cb) => {
    const sl = parseInt(cb.dataset.sl, 10);
    const letter = cb.dataset.letter;
    if (Number.isFinite(sl) && itemMap[sl] && letter) {
      if (!itemMap[sl].sub) itemMap[sl].sub = {};
      itemMap[sl].sub[letter] = !!cb.checked;
    }
  });

  data.alarm_leakages.pt_5kw = document.getElementById('mu-boiler-pt-5kw')?.value || '';
  data.alarm_leakages.sugar_dissolver = document.getElementById('mu-boiler-sugar-dissolver')?.value || '';
  data.fuel_water_uses.total_water_used = document.getElementById('mu-boiler-fw-water')?.value || '';
  data.fuel_water_uses.total_fuel_used = document.getElementById('mu-boiler-fw-fuel')?.value || '';
  data.fuel_water_uses.chemical_bull_used = document.getElementById('mu-boiler-fw-chemical')?.value || '';
  data.fuel_water_uses.total_mother_generation = document.getElementById('mu-boiler-fw-mother')?.value || '';

  document.querySelectorAll('.mu-boiler-water-test').forEach((inp) => {
    const param = inp.dataset.param;
    const source = inp.dataset.source;
    if (!param || !source || !data.full_water_test[param]) return;
    data.full_water_test[param][source] = inp.value || '';
  });

  const doneBy = document.getElementById('mu-boiler-done-by')?.value || '';
  data.done_by_sign = doneBy;
  data.area_incharge_sign = doneBy; // back-compat
  data.production_manager_sign = document.getElementById('mu-boiler-production-manager')?.value || '';

  return { entry_date: date, shift: '', data };
}
