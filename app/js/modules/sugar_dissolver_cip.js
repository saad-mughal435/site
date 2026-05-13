/**
 * Sugar Dissolver — CIP records (full editor with QC-style fields).
 *
 * Two views (in-place panel swap):
 *   LIST    — table of saved records for sugar-tank + dissolver, with New / Edit / Print / Delete.
 *   EDITOR  — full QC-parity form: procedure (date/time/solution rows/sign names) +
 *             swab tests + RO pH table + observations + oxonia strip + rinser filter
 *             change/type + rinsing + comments.
 *
 * Records are persisted via the existing mixing-tank CIP history endpoints:
 *   GET    /api/mixing/tanks/{tank_no}/cip/history          (list)
 *   GET    /api/mixing/tanks/{tank_no}/cip/history/{id}     (load full record)
 *   POST   /api/mixing/tanks/{tank_no}/cip/history          (create)
 *   PUT    /api/mixing/tanks/{tank_no}/cip/history/{id}     (update)
 *   DELETE /api/mixing/tanks/{tank_no}/cip/history/{id}     (admin)
 *   GET    /api/mixing/tanks/{tank_no}/cip/history/{id}/pdf (print)
 *
 * The backend `normalize_tank_cip_data` is symmetric and preserves all QC-only
 * fields, so we just send the full block payload and read it back.
 */

import { authenticatedFetch } from '../auth.js?v=20260428b';
import { showToast } from '../utils.js?v=20260129a';

const SD_CIP_TANKS = [
    { key: 'sugar-tank', label: 'Sugar Syrup Tank' },
    { key: 'dissolver', label: 'Dissolver' },
];

const SOLUTION_OPTIONS = [
    'Hot Water', 'Caustic 85C 1.7%', 'Topaz MD3 0.2%', 'Acid 1.3%',
    'Oxonia 0.2% (80 ppm)', 'Sodium Hypochlorite 10-12% (2-5ppm)', 'RO Water',
];
const SIGN_NAMES = ['Zeeshan Alam', 'Zeeshan Ahmad', 'Umer', 'Zeeshan Iqbal', 'Usman'];
const SWAB_TEMPLATES = [
    { id: 'sugar_syrup_tank_rlu', label: 'Sugar Syrup Tank __ RLU' },
    { id: 'mixer_tank_rlu',       label: 'Mixer Tank __ RLU' },
    { id: 'pasteurizer_tank_rlu', label: 'Pasteurizer Tank __ RLU' },
];
const RINSER_FILTER_OPTIONS = [
    { value: '0_5_micro', label: '0.5 micrometer filter' },
    { value: '1_micro', label: '1 micrometer filter' },
];
const CIP_TYPE_CONFIG = {
    '3_step': {
        label: '3 Step CIP', addLabel: 'Add 3 STEP CIP',
        title: '3 STEP C.I.P PROCEDURE AND CHECKLIST',
        doc_ref: 'KBF/PRD/58',
        solution_row_count: 7, has_ro_ph_table: true,
        has_observations: false, show_oxonia_strip_result: true,
    },
    '5_step': {
        label: '5 Step CIP', addLabel: 'Add 5 STEP CIP',
        title: '5 STEP C.I.P PROCEDURE AND CHECKLIST',
        doc_ref: 'KBF/PRD/57',
        solution_row_count: 7, has_ro_ph_table: true,
        has_observations: false, show_oxonia_strip_result: true,
    },
    '5_step_foam': {
        label: '5 Step Foam CIP', addLabel: 'Add 5 STEP Foam CIP',
        title: '5 STEP Foam C.I.P PROCEDURE AND CHECKLIST',
        doc_ref: 'KBF/PRD/57.1',
        solution_row_count: 7, has_ro_ph_table: false,
        has_observations: true, show_oxonia_strip_result: false,
    },
};

const _state = {
    rootEl: null,
    mode: 'list',          // 'list' | 'editor'
    list: [],              // merged records from both tanks (summary objects)
    listFilter: '',        // tank filter for list view
    editing: null,         // { tank, entry_id (null for new), blocks: [...], saved: bool }
};

// ---------- helpers ----------
function _esc(s) {
    const t = document.createElement('div');
    t.textContent = s == null ? '' : String(s);
    return t.innerHTML;
}
function _fmtDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return _esc(iso);
    return d.toISOString().slice(0, 10);
}
function _genBlockId(cipType) {
    return `${cipType}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function _blankSwabItems() {
    return SWAB_TEMPLATES.map(t => ({
        id: t.id, label: t.label, values: [], selected: false,
    }));
}
function _blankSolutionRows(count) {
    return Array.from({ length: count }, () => ({
        time_start: '', time_finish: '', solution: '', sign_names: [],
    }));
}
function _blankRoPhRows() {
    return Array.from({ length: 4 }, () => ({
        standard_ro_water_ph: '', verification_of_tested_ph: '',
    }));
}
function _blankObservations() {
    return Array.from({ length: 4 }, () => '');
}
function _newBlock(cipType) {
    const cfg = CIP_TYPE_CONFIG[cipType] || CIP_TYPE_CONFIG['3_step'];
    return {
        id: _genBlockId(cipType),
        cip_type: cipType,
        date: '',
        tank_no: _state.editing?.tank || '',
        batch_no: '',
        start_time: '',
        finish_time: '',
        rinsing_done: false,
        rinsing_date: '',
        mixing_comments: '',
        tank_mixing_sign_names: [],
        solution_rows: _blankSolutionRows(cfg.solution_row_count),
        swab_items: _blankSwabItems(),
        ro_ph_rows: _blankRoPhRows(),
        observations: _blankObservations(),
        oxonia_strip_result: '',
        rinser_filter_change: '',
        rinser_filter_type: '',
    };
}
// Coerce a fetched block into the editor's expected shape, filling missing fields with blanks.
function _hydrateBlock(b) {
    const cipType = (b && b.cip_type) || '3_step';
    const blank = _newBlock(cipType);
    const out = { ...blank, ...b };
    out.cip_type = cipType;
    // Ensure shapes for arrays even if backend returned different lengths/missing.
    if (!Array.isArray(out.solution_rows) || !out.solution_rows.length) {
        out.solution_rows = blank.solution_rows;
    } else {
        out.solution_rows = out.solution_rows.map(r => ({
            time_start: r?.time_start || '',
            time_finish: r?.time_finish || '',
            solution: r?.solution || '',
            sign_names: Array.isArray(r?.sign_names) ? r.sign_names : [],
        }));
    }
    // Swab items: merge backend list with template defaults so all templates are pickable.
    const fromServer = Array.isArray(out.swab_items) ? out.swab_items : [];
    out.swab_items = SWAB_TEMPLATES.map(t => {
        const found = fromServer.find(s => s && s.id === t.id);
        if (found) {
            return {
                id: t.id, label: t.label,
                values: Array.isArray(found.values) ? found.values : [],
                selected: found.selected === true || found.selected === 'yes',
            };
        }
        return { id: t.id, label: t.label, values: [], selected: false };
    });
    if (!Array.isArray(out.ro_ph_rows) || out.ro_ph_rows.length < 4) out.ro_ph_rows = _blankRoPhRows();
    if (!Array.isArray(out.observations) || out.observations.length < 4) out.observations = _blankObservations();
    if (!Array.isArray(out.tank_mixing_sign_names)) out.tank_mixing_sign_names = [];
    return out;
}

// ---------- LIST view ----------
async function _fetchHistory(tankKey) {
    try {
        const r = await authenticatedFetch(`/api/mixing/tanks/${encodeURIComponent(tankKey)}/cip/history`);
        if (!r.ok) return [];
        const data = await r.json();
        const list = Array.isArray(data?.history) ? data.history : [];
        return list.map(item => ({ ...item, tank_no: tankKey }));
    } catch { return []; }
}

async function _loadList() {
    const tanks = _state.listFilter ? SD_CIP_TANKS.filter(t => t.key === _state.listFilter) : SD_CIP_TANKS;
    const lists = await Promise.all(tanks.map(t => _fetchHistory(t.key)));
    const rows = lists.flat();
    rows.sort((a, b) => {
        const ad = String(a.entry_date || a.saved_at || '');
        const bd = String(b.entry_date || b.saved_at || '');
        return bd.localeCompare(ad);
    });
    _state.list = rows;
    _renderListBody();
}

function _renderListShell() {
    const root = _state.rootEl;
    root.innerHTML = `
        <div class="mb-4 flex items-end justify-between gap-3 flex-wrap">
            <div>
                <h2 class="text-2xl font-bold text-slate-900">Sugar Dissolver — CIP</h2>
                <p class="text-slate-500 text-sm mt-1">
                    Sugar Tank and Dissolver CIP records with full QC-style detail
                    (procedure, swab tests, pH, oxonia, rinser filter, observations).
                    These records do not flow into the QC menu.
                </p>
            </div>
            <div class="flex gap-2">
                <select id="sdcip-tank-filter" class="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white">
                    <option value="">All tanks</option>
                    ${SD_CIP_TANKS.map(t => `<option value="${_esc(t.key)}" ${_state.listFilter === t.key ? 'selected' : ''}>${_esc(t.label)}</option>`).join('')}
                </select>
                <button id="sdcip-new" class="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold">+ New CIP</button>
                <button id="sdcip-refresh" class="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Refresh</button>
            </div>
        </div>

        <div class="bg-white rounded-xl shadow border border-slate-200">
            <div id="sdcip-table-wrap" class="overflow-x-auto">
                <div class="p-8 text-center text-slate-400 text-sm">Loading...</div>
            </div>
        </div>
    `;
    root.querySelector('#sdcip-tank-filter')?.addEventListener('change', (e) => {
        _state.listFilter = e.target.value;
        _loadList();
    });
    root.querySelector('#sdcip-refresh')?.addEventListener('click', () => _loadList());
    root.querySelector('#sdcip-new')?.addEventListener('click', _onNewClick);
}

function _renderListBody() {
    const wrap = _state.rootEl?.querySelector('#sdcip-table-wrap');
    if (!wrap) return;
    const rows = _state.list;
    if (!rows.length) {
        wrap.innerHTML = '<div class="p-8 text-center text-slate-400 text-sm">No CIP records yet. Click "+ New CIP" to add one.</div>';
        return;
    }
    wrap.innerHTML = `
        <table class="w-full text-sm">
            <thead class="bg-slate-50 border-b border-slate-200">
                <tr class="text-left text-xs uppercase text-slate-500">
                    <th class="px-4 py-2 font-semibold">Date</th>
                    <th class="px-4 py-2 font-semibold">Tank</th>
                    <th class="px-4 py-2 font-semibold">Process flow</th>
                    <th class="px-4 py-2 font-semibold">Saved by</th>
                    <th class="px-4 py-2 font-semibold">Saved at</th>
                    <th class="px-4 py-2 font-semibold text-right">Actions</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(r => {
                    const flow = Array.isArray(r.process_flow) && r.process_flow.length
                        ? r.process_flow.map(s => _esc(s)).join(', ')
                        : '<span class="text-slate-400">—</span>';
                    return `
                        <tr class="border-b border-slate-100 hover:bg-slate-50">
                            <td class="px-4 py-2 font-medium text-slate-800">${_esc(_fmtDate(r.entry_date))}</td>
                            <td class="px-4 py-2 text-slate-700">${_esc(r.tank_name || r.tank_no)}</td>
                            <td class="px-4 py-2 text-slate-600">${flow}</td>
                            <td class="px-4 py-2 text-slate-600">${_esc(r.saved_by || '—')}</td>
                            <td class="px-4 py-2 text-slate-500 text-xs">${_esc(r.saved_at ? _fmtDate(r.saved_at) : '—')}</td>
                            <td class="px-4 py-2 text-right whitespace-nowrap">
                                <button class="sdcip-print px-2 py-1 text-xs font-semibold rounded-full border border-blue-300 bg-blue-50 text-blue-800 hover:bg-blue-100"
                                        data-tank="${_esc(r.tank_no)}" data-id="${_esc(r.id)}">Print</button>
                                <button class="sdcip-edit ml-1 px-2 py-1 text-xs font-semibold rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
                                        data-tank="${_esc(r.tank_no)}" data-id="${_esc(r.id)}">Edit</button>
                            </td>
                        </tr>`;
                }).join('')}
            </tbody>
        </table>
    `;
    wrap.querySelectorAll('.sdcip-print').forEach(btn => {
        btn.addEventListener('click', () => _printRecord(btn.dataset.tank, btn.dataset.id));
    });
    wrap.querySelectorAll('.sdcip-edit').forEach(btn => {
        btn.addEventListener('click', () => _onEditClick(btn.dataset.tank, btn.dataset.id));
    });
}

async function _printRecord(tankKey, entryId) {
    if (!tankKey || !entryId) return;
    try {
        const r = await authenticatedFetch(`/api/mixing/tanks/${encodeURIComponent(tankKey)}/cip/history/${encodeURIComponent(entryId)}/pdf`);
        if (!r.ok) {
            let msg = 'PDF failed';
            try { const j = await r.json(); msg = j.detail || msg; } catch {}
            showToast(msg, 'error');
            return;
        }
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
        showToast(e.message || 'PDF failed', 'error');
    }
}

// ---------- EDITOR view ----------
function _onNewClick() {
    _state.editing = { tank: '', entry_id: null, blocks: [], saved: false };
    _state.mode = 'editor';
    _renderEditorShell();
}

async function _onEditClick(tankKey, entryId) {
    if (!tankKey || !entryId) return;
    try {
        const r = await authenticatedFetch(`/api/mixing/tanks/${encodeURIComponent(tankKey)}/cip/history/${encodeURIComponent(entryId)}`);
        if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.detail || 'Load failed');
        }
        const entry = await r.json();
        const data = entry?.data && typeof entry.data === 'object' ? entry.data : { blocks: [] };
        const blocks = (Array.isArray(data.blocks) ? data.blocks : []).map(_hydrateBlock);
        _state.editing = { tank: tankKey, entry_id: entryId, blocks, saved: true };
        _state.mode = 'editor';
        _renderEditorShell();
    } catch (e) {
        showToast(e.message || 'Failed to open CIP', 'error');
    }
}

function _renderEditorShell() {
    const e = _state.editing;
    const root = _state.rootEl;
    const tankLabel = SD_CIP_TANKS.find(t => t.key === e.tank)?.label || '';
    const isNew = !e.entry_id;
    const showAddButtons = !!e.tank;
    root.innerHTML = `
        <div class="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
                <h2 class="text-2xl font-bold text-slate-900">${isNew ? 'New CIP Record' : 'Edit CIP Record'}</h2>
                <p class="text-slate-500 text-sm mt-1">${isNew ? 'Pick a tank, then add one or more CIP blocks.' : `Editing record for ${_esc(tankLabel)}.`}</p>
            </div>
            <div class="flex gap-2 flex-wrap">
                <button id="sdcip-back" class="px-3 py-2 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">← Back to list</button>
                ${e.entry_id ? `<button id="sdcip-print-edit" class="px-3 py-2 text-sm border border-blue-300 bg-blue-50 text-blue-800 rounded-lg hover:bg-blue-100 font-semibold">Print PDF</button>` : ''}
                ${e.entry_id ? `<button id="sdcip-delete" class="px-3 py-2 text-sm border border-red-300 bg-red-50 text-red-700 rounded-lg hover:bg-red-100">Delete</button>` : ''}
                <button id="sdcip-save" class="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold">${isNew ? 'Save' : 'Save changes'}</button>
            </div>
        </div>

        <div class="bg-white rounded-xl shadow border border-slate-200 p-4 mb-4">
            <div class="flex flex-wrap items-center gap-2">
                <label class="text-xs font-semibold text-slate-700">Tank</label>
                <select id="sdcip-edit-tank" class="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white max-w-[220px]" ${e.entry_id ? 'disabled' : ''}>
                    <option value="">— Select tank —</option>
                    ${SD_CIP_TANKS.map(t => `<option value="${_esc(t.key)}" ${e.tank === t.key ? 'selected' : ''}>${_esc(t.label)}</option>`).join('')}
                </select>
                ${showAddButtons ? `<div class="flex gap-2 ml-auto flex-wrap">
                    ${Object.entries(CIP_TYPE_CONFIG).map(([k, v]) =>
                        `<button type="button" class="sdcip-add-block px-3 py-2 text-sm border border-slate-300 bg-white rounded-lg hover:bg-slate-50" data-cip-type="${k}">${_esc(v.addLabel)}</button>`
                    ).join('')}
                </div>` : ''}
            </div>
            ${!showAddButtons ? `<p class="text-xs text-slate-500 mt-2">Select a tank above to start adding CIP blocks.</p>` : ''}
        </div>

        <div id="sdcip-blocks-wrap" class="space-y-4"></div>
    `;
    root.querySelector('#sdcip-back')?.addEventListener('click', _onBackToList);
    root.querySelector('#sdcip-save')?.addEventListener('click', _onSaveClick);
    root.querySelector('#sdcip-delete')?.addEventListener('click', _onDeleteClick);
    root.querySelector('#sdcip-print-edit')?.addEventListener('click', () => {
        if (e.entry_id) _printRecord(e.tank, e.entry_id);
    });
    root.querySelector('#sdcip-edit-tank')?.addEventListener('change', (ev) => {
        _state.editing.tank = ev.target.value;
        // Apply tank to existing blocks (new only).
        _state.editing.blocks.forEach(b => { b.tank_no = _state.editing.tank; });
        _renderEditorShell();
    });
    root.querySelectorAll('.sdcip-add-block').forEach(btn => {
        btn.addEventListener('click', () => {
            const blk = _newBlock(btn.dataset.cipType);
            blk.tank_no = _state.editing.tank;
            _state.editing.blocks.push(blk);
            _renderBlocks();
        });
    });
    _renderBlocks();
}

function _onBackToList() {
    if (_state.editing && _state.editing.blocks.length && !confirm('Discard unsaved changes?')) {
        // user wants to stay
        return;
    }
    _state.editing = null;
    _state.mode = 'list';
    _renderListShell();
    _loadList();
}

function _renderBlocks() {
    const wrap = _state.rootEl?.querySelector('#sdcip-blocks-wrap');
    if (!wrap) return;
    const blocks = _state.editing.blocks;
    if (!blocks.length) {
        wrap.innerHTML = `<div class="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center text-slate-500 text-sm">
            ${_state.editing.tank ? 'No blocks yet — click an "Add ... CIP" button above to start.' : 'Pick a tank above to begin.'}
        </div>`;
        return;
    }
    wrap.innerHTML = blocks.map((b, i) => _blockHtml(b, i)).join('');
    blocks.forEach((b, i) => _bindBlockHandlers(b, i));
}

function _blockHtml(b, idx) {
    const cfg = CIP_TYPE_CONFIG[b.cip_type] || CIP_TYPE_CONFIG['3_step'];
    return `
    <article class="bg-white rounded-xl shadow border border-slate-200 p-4" data-block-index="${idx}">
        <div class="flex items-start justify-between gap-3 mb-3">
            <div>
                <h3 class="text-base font-bold text-slate-900">${_esc(cfg.title)}</h3>
                <p class="text-[11px] text-slate-500">Doc.Ref: ${_esc(cfg.doc_ref)} · ${_esc(cfg.label)}</p>
            </div>
            <button type="button" class="sdcip-remove-block px-2 py-1 text-xs border border-red-300 text-red-700 rounded hover:bg-red-50">Remove block</button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
            <label class="block text-xs font-semibold text-slate-700">
                Date
                <input type="date" data-field="date" value="${_esc(b.date)}" class="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm">
            </label>
            <label class="block text-xs font-semibold text-slate-700">
                Start Time
                <input type="time" data-field="start_time" value="${_esc(b.start_time)}" class="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm">
            </label>
            <label class="block text-xs font-semibold text-slate-700">
                Finish Time
                <input type="time" data-field="finish_time" value="${_esc(b.finish_time)}" class="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm">
            </label>
            <label class="block text-xs font-semibold text-slate-700">
                Tank
                <input type="text" value="${_esc((SD_CIP_TANKS.find(t => t.key === (b.tank_no || _state.editing.tank))?.label) || b.tank_no || _state.editing.tank || '')}" disabled class="mt-1 w-full px-2 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-sm text-slate-600">
            </label>
            <label class="block text-xs font-semibold text-slate-700">
                Batch No.
                <input type="text" data-field="batch_no" value="${_esc(b.batch_no || '')}" placeholder="Enter batch no." class="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm">
            </label>
        </div>

        <div class="mb-3">
            <div class="text-xs font-semibold text-slate-700 mb-1">Mixing sign names</div>
            <div class="flex flex-wrap gap-3">
                ${SIGN_NAMES.map(name => `
                    <label class="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                        <input type="checkbox" data-field="tank_mixing_sign_names" data-name="${_esc(name)}" ${b.tank_mixing_sign_names.includes(name) ? 'checked' : ''}>
                        <span>${_esc(name)}</span>
                    </label>
                `).join('')}
            </div>
        </div>

        <div class="mb-3">
            <div class="text-xs font-semibold text-slate-700 mb-1">Solution rows</div>
            <div class="overflow-x-auto">
                <table class="min-w-full text-xs border border-slate-200">
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="px-2 py-1 text-left font-semibold border-b">Time Start</th>
                            <th class="px-2 py-1 text-left font-semibold border-b">Time Finish</th>
                            <th class="px-2 py-1 text-left font-semibold border-b">Solution</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${b.solution_rows.map((r, ri) => `
                            <tr class="border-b border-slate-100">
                                <td class="px-1 py-1"><input type="time" data-field="solution_rows" data-row="${ri}" data-key="time_start" value="${_esc(r.time_start)}" class="w-full px-1 py-1 border border-slate-200 rounded text-xs"></td>
                                <td class="px-1 py-1"><input type="time" data-field="solution_rows" data-row="${ri}" data-key="time_finish" value="${_esc(r.time_finish)}" class="w-full px-1 py-1 border border-slate-200 rounded text-xs"></td>
                                <td class="px-1 py-1">
                                    <select data-field="solution_rows" data-row="${ri}" data-key="solution" class="w-full px-1 py-1 border border-slate-200 rounded text-xs">
                                        <option value="">Select</option>
                                        ${SOLUTION_OPTIONS.map(opt => `<option value="${_esc(opt)}" ${r.solution === opt ? 'selected' : ''}>${_esc(opt)}</option>`).join('')}
                                    </select>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>

        <div class="mb-3">
            <div class="text-xs font-semibold text-slate-700 mb-1">Swab tests</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 border border-slate-200 rounded-lg p-2 bg-slate-50">
                ${b.swab_items.map((sw, si) => `
                    <div class="flex flex-col gap-1 bg-white rounded p-2 border border-slate-200" data-swab-row="${si}">
                        <label class="inline-flex items-center gap-1.5 text-xs cursor-pointer">
                            <input type="checkbox" data-field="swab_items" data-row="${si}" data-key="selected" ${sw.selected ? 'checked' : ''}>
                            <span class="text-slate-700">${_esc(sw.label)}</span>
                        </label>
                        ${sw.selected ? _swabValuesHtml(sw, si) : ''}
                    </div>
                `).join('')}
            </div>
        </div>

        ${cfg.has_ro_ph_table ? _roPhHtml(b) : ''}
        ${cfg.has_observations ? _observationsHtml(b) : ''}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            ${cfg.show_oxonia_strip_result ? `
                <label class="block text-xs font-semibold text-slate-700">
                    Oxonia Strip Result
                    <select data-field="oxonia_strip_result" class="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm">
                        <option value="">Select</option>
                        <option value="yes" ${b.oxonia_strip_result === 'yes' ? 'selected' : ''}>OK</option>
                        <option value="no" ${b.oxonia_strip_result === 'no' ? 'selected' : ''}>NOT OK</option>
                    </select>
                </label>` : ''}
            <label class="block text-xs font-semibold text-slate-700">
                Rinser Filter Change
                <select data-field="rinser_filter_change" class="mt-1 w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm">
                    <option value="">Select</option>
                    <option value="yes" ${b.rinser_filter_change === 'yes' ? 'selected' : ''}>YES</option>
                    <option value="no" ${b.rinser_filter_change === 'no' ? 'selected' : ''}>NO</option>
                </select>
            </label>
            ${b.rinser_filter_change === 'yes' ? `
                <div class="md:col-span-2">
                    <div class="text-xs font-semibold text-slate-700 mb-1">Rinser Filter Type</div>
                    <div class="flex gap-4 flex-wrap">
                        ${RINSER_FILTER_OPTIONS.map(opt => `
                            <label class="inline-flex items-center gap-1.5 text-sm text-slate-700 cursor-pointer">
                                <input type="checkbox" data-field="rinser_filter_type" data-option="${_esc(opt.value)}" ${b.rinser_filter_type === opt.value ? 'checked' : ''}>
                                <span>${_esc(opt.label)}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>` : ''}
        </div>

        <div class="mb-3 flex flex-wrap items-center gap-3">
            <label class="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" data-field="rinsing_done" ${b.rinsing_done ? 'checked' : ''}>
                <span>Rinsing done</span>
            </label>
            ${b.rinsing_done ? `<input type="date" data-field="rinsing_date" value="${_esc(b.rinsing_date)}" class="px-2 py-1 text-xs border border-slate-300 rounded">` : ''}
        </div>

        <div>
            <label class="block text-xs font-semibold text-slate-700 mb-1">Comments</label>
            <textarea rows="2" data-field="mixing_comments" class="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-sm">${_esc(b.mixing_comments)}</textarea>
        </div>
    </article>
    `;
}

function _swabValuesHtml(sw, si) {
    const parts = sw.label.split('__');
    if (parts.length <= 1) return '';
    const inputs = [];
    for (let i = 0; i < parts.length - 1; i++) {
        inputs.push(`<input type="text" data-field="swab_items" data-row="${si}" data-key="value" data-value-index="${i}" value="${_esc(sw.values[i] || '')}" class="px-1.5 py-0.5 border border-slate-300 rounded text-xs w-20" placeholder="...">`);
    }
    return `<div class="flex flex-wrap items-center gap-1 text-xs text-slate-600 ml-5">
        ${parts.map((p, i) => `<span>${_esc(p)}</span>${i < inputs.length ? inputs[i] : ''}`).join('')}
    </div>`;
}

function _roPhHtml(b) {
    return `
    <div class="mb-3">
        <div class="text-xs font-semibold text-slate-700 mb-1">Standard RO Water pH Verification</div>
        <table class="min-w-full text-xs border border-slate-200">
            <thead class="bg-slate-50">
                <tr>
                    <th class="px-2 py-1 text-left font-semibold border-b">Standard RO Water pH</th>
                    <th class="px-2 py-1 text-left font-semibold border-b">Verification of Tested pH</th>
                </tr>
            </thead>
            <tbody>
                ${b.ro_ph_rows.map((r, ri) => `
                    <tr class="border-b border-slate-100">
                        <td class="px-1 py-1"><input type="text" data-field="ro_ph_rows" data-row="${ri}" data-key="standard_ro_water_ph" value="${_esc(r.standard_ro_water_ph)}" class="w-full px-1 py-1 border border-slate-200 rounded text-xs"></td>
                        <td class="px-1 py-1"><input type="text" data-field="ro_ph_rows" data-row="${ri}" data-key="verification_of_tested_ph" value="${_esc(r.verification_of_tested_ph)}" class="w-full px-1 py-1 border border-slate-200 rounded text-xs"></td>
                    </tr>`).join('')}
            </tbody>
        </table>
    </div>`;
}

function _observationsHtml(b) {
    return `
    <div class="mb-3">
        <div class="text-xs font-semibold text-slate-700 mb-1">Observations</div>
        <table class="min-w-full text-xs border border-slate-200">
            <tbody>
                ${b.observations.map((v, ri) => `
                    <tr class="border-b border-slate-100">
                        <td class="px-1 py-1"><input type="text" data-field="observations" data-row="${ri}" value="${_esc(v)}" class="w-full px-1 py-1 border border-slate-200 rounded text-xs"></td>
                    </tr>`).join('')}
            </tbody>
        </table>
    </div>`;
}

function _bindBlockHandlers(block, blockIdx) {
    const article = _state.rootEl?.querySelector(`article[data-block-index="${blockIdx}"]`);
    if (!article) return;

    article.querySelector('.sdcip-remove-block')?.addEventListener('click', () => {
        if (!confirm('Remove this CIP block?')) return;
        _state.editing.blocks.splice(blockIdx, 1);
        _renderBlocks();
    });

    article.querySelectorAll('[data-field]').forEach(el => {
        const field = el.dataset.field;
        const isCheckbox = el.type === 'checkbox';
        const evtName = (isCheckbox || el.tagName === 'SELECT') ? 'change' : 'input';
        el.addEventListener(evtName, () => _onBlockFieldChange(blockIdx, field, el));
    });
}

function _onBlockFieldChange(blockIdx, field, el) {
    const b = _state.editing.blocks[blockIdx];
    if (!b) return;
    let needsReRender = false;

    if (field === 'tank_mixing_sign_names') {
        const name = el.dataset.name;
        if (el.checked) {
            if (!b.tank_mixing_sign_names.includes(name)) b.tank_mixing_sign_names.push(name);
        } else {
            b.tank_mixing_sign_names = b.tank_mixing_sign_names.filter(n => n !== name);
        }
    } else if (field === 'solution_rows') {
        const ri = Number(el.dataset.row);
        const key = el.dataset.key;
        b.solution_rows[ri][key] = el.value;
    } else if (field === 'swab_items') {
        const ri = Number(el.dataset.row);
        const key = el.dataset.key;
        if (key === 'selected') {
            b.swab_items[ri].selected = el.checked;
            needsReRender = true; // show/hide value inputs
        } else if (key === 'value') {
            const vi = Number(el.dataset.valueIndex);
            const arr = b.swab_items[ri].values || [];
            while (arr.length <= vi) arr.push('');
            arr[vi] = el.value;
            b.swab_items[ri].values = arr;
        }
    } else if (field === 'ro_ph_rows') {
        const ri = Number(el.dataset.row);
        const key = el.dataset.key;
        b.ro_ph_rows[ri][key] = el.value;
    } else if (field === 'observations') {
        const ri = Number(el.dataset.row);
        b.observations[ri] = el.value;
    } else if (field === 'oxonia_strip_result') {
        b.oxonia_strip_result = el.value;
    } else if (field === 'rinser_filter_change') {
        b.rinser_filter_change = el.value;
        if (b.rinser_filter_change !== 'yes') b.rinser_filter_type = '';
        needsReRender = true; // reveal/hide filter type row
    } else if (field === 'rinser_filter_type') {
        const opt = el.dataset.option;
        // Exclusive checkbox behaviour: clicking sets/unsets to that option only.
        b.rinser_filter_type = el.checked ? opt : '';
        needsReRender = true;
    } else if (field === 'rinsing_done') {
        b.rinsing_done = el.checked;
        if (!b.rinsing_done) b.rinsing_date = '';
        needsReRender = true;
    } else if (field === 'rinsing_date') {
        b.rinsing_date = el.value;
    } else if (field === 'mixing_comments') {
        b.mixing_comments = el.value;
    } else if (field === 'date' || field === 'start_time' || field === 'finish_time' || field === 'batch_no') {
        b[field] = el.value;
    }

    if (needsReRender) _renderBlocks();
}

async function _onSaveClick() {
    const e = _state.editing;
    if (!e.tank) { showToast('Select a tank first', 'error'); return; }
    if (!e.blocks.length) { showToast('Add at least one CIP block', 'error'); return; }

    const payload = { data: { blocks: e.blocks } };
    const url = e.entry_id
        ? `/api/mixing/tanks/${encodeURIComponent(e.tank)}/cip/history/${encodeURIComponent(e.entry_id)}`
        : `/api/mixing/tanks/${encodeURIComponent(e.tank)}/cip/history`;
    const method = e.entry_id ? 'PUT' : 'POST';

    try {
        const r = await authenticatedFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.detail || `Save failed (HTTP ${r.status})`);
        }
        const data = await r.json();
        showToast(e.entry_id ? 'CIP record updated' : 'CIP record created', 'success');
        // For new records, server returns the assigned id — switch to edit mode for that id
        // so subsequent saves use PUT.
        if (!e.entry_id && data?.id) {
            e.entry_id = data.id;
            e.saved = true;
            _renderEditorShell();
        }
    } catch (err) {
        showToast(err.message || 'Save failed', 'error');
    }
}

async function _onDeleteClick() {
    const e = _state.editing;
    if (!e.entry_id) return;
    if (!confirm('Delete this CIP record permanently? This cannot be undone.')) return;
    try {
        const r = await authenticatedFetch(
            `/api/mixing/tanks/${encodeURIComponent(e.tank)}/cip/history/${encodeURIComponent(e.entry_id)}`,
            { method: 'DELETE' }
        );
        if (!r.ok) {
            const j = await r.json().catch(() => ({}));
            throw new Error(j.detail || `Delete failed (HTTP ${r.status})`);
        }
        showToast('Record deleted', 'success');
        _state.editing = null;
        _state.mode = 'list';
        _renderListShell();
        _loadList();
    } catch (err) {
        showToast(err.message || 'Delete failed', 'error');
    }
}

// ---------- Public entry ----------
export function renderSugarDissolverCip(root) {
    if (!root) return;
    _state.rootEl = root;
    _state.mode = 'list';
    _state.editing = null;
    _state.list = [];
    _state.listFilter = '';
    _renderListShell();
    _loadList();
}
