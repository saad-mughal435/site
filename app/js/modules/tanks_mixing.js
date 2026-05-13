/**
 * Tanks / Mixing: tank CIP library, raw material inspection, operational logs.
 */
import { authenticatedFetch } from '../auth.js?v=20260428b';
import { showToast } from '../utils.js?v=20260125h';

const TM_TANKS = [
    { key: '1', label: 'Tank 1' },
    { key: '2', label: 'Tank 2' },
    { key: '3', label: 'Tank 3' },
    { key: '4', label: 'Tank 4' },
    { key: '5', label: 'Tank 5' },
    { key: '6', label: 'Tank 6' },
    { key: 'ro-01', label: 'RO-01' },
    { key: 'ro-02', label: 'RO-02' },
    { key: 'chemical-cip-tanks', label: 'Chemical CIP Tanks' },
];
const TM_TANK_IDS = TM_TANKS.map((item) => item.key);
const TM_TANK_LABEL = Object.fromEntries(TM_TANKS.map((item) => [item.key, item.label]));

const TM_SUBTAB_DEFS = [
    ...TM_TANKS.map((tank) => ({ key: `tank-${tank.key}`, label: tank.label })),
    { key: 'raw-material', label: 'Raw material inspection' },
    { key: 'filter-replacement', label: 'Filter replacement' },
    { key: 'mixing-area', label: 'Mixing area checklist' },
    { key: 'ro-weekly', label: 'RO plant weekly' },
];

const OPS_MAP = {
    'filter-replacement': 'filter_replacement',
    'mixing-area': 'mixing_area',
    'ro-weekly': 'ro_plant_weekly',
};

let _activeKey = 'tank-1';
let _rmiLoaded = null;

function _esc(s) {
    const t = document.createElement('div');
    t.textContent = s == null ? '' : String(s);
    return t.innerHTML;
}

function _formatQty(value, uom = '') {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    const maxDecimals = Math.abs(n - Math.round(n)) < 0.00005 ? 0 : 4;
    const qty = n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: maxDecimals });
    return uom ? `${qty} ${uom}` : qty;
}

async function _readResponseJson(r) {
    const text = await r.text();
    if (!text || !String(text).trim()) {
        throw new Error(`Empty server response (HTTP ${r.status})`);
    }
    const trimmed = String(text).trim();
    if (trimmed[0] !== '{' && trimmed[0] !== '[') {
        throw new Error(`Server did not return JSON (HTTP ${r.status}). Check the API logs or restart the backend.`);
    }
    return JSON.parse(text);
}

async function _jsonOrThrow(r, fallback = 'Request failed') {
    const data = await _readResponseJson(r);
    if (!r.ok) {
        throw new Error(data.detail || data.message || r.statusText || fallback);
    }
    return data;
}

function _defaultYm() {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function _defaultWeek() {
    const d = new Date();
    const y = d.getFullYear();
    const oneJan = new Date(y, 0, 1);
    const day = Math.floor((d - oneJan) / 86400000);
    const w = Math.min(53, Math.max(1, Math.ceil((day + oneJan.getDay() + 1) / 7)));
    return { year: y, week: w };
}

function _buildShell() {
    const subtabs = document.getElementById('tm-subtabs');
    const panelsRoot = document.getElementById('tm-panels-root');
    if (!subtabs || !panelsRoot) return;

    subtabs.innerHTML = TM_SUBTAB_DEFS.map(
        (d) =>
            `<button type="button" data-tm-tab="${d.key}" class="tm-subtab px-3 py-2 text-sm font-medium border-b-2 border-transparent text-slate-500 hover:text-slate-700 rounded-t">${_esc(d.label)}</button>`
    ).join('');

    const tankPanels = TM_TANK_IDS.map(
        (n) => `
        <div id="tm-panel-tank-${n}" class="tm-panel hidden space-y-3">
            <p class="text-sm text-slate-600">${_esc(TM_TANK_LABEL[n] || n)} CIP library (on disk). Edit JSON and save, or open PDF.</p>
            <textarea id="tm-cip-json-${n}" class="w-full min-h-[280px] font-mono text-xs border border-slate-300 rounded-lg p-3" spellcheck="false"></textarea>
            <div class="flex flex-wrap gap-2">
                <button type="button" id="tm-cip-save-${n}" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">Save library</button>
                <button type="button" id="tm-cip-pdf-${n}" class="px-4 py-2 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50">Open PDF</button>
            </div>
        </div>`
    ).join('');

    const rawPanel = `
        <div id="tm-panel-raw-material" class="tm-panel hidden space-y-4">
            <div class="flex flex-wrap gap-3 items-end">
                <div>
                    <label class="block text-xs font-semibold text-slate-700 mb-1">Production batch</label>
                    <select id="tm-rmi-batch" class="border border-slate-300 rounded-lg text-sm min-w-[220px] px-2 py-2"></select>
                </div>
                <button type="button" id="tm-rmi-load" class="px-4 py-2 border border-slate-300 text-sm rounded-lg hover:bg-slate-50">Reload</button>
                <button type="button" id="tm-rmi-save" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">Save inspection</button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label class="block text-xs font-semibold text-slate-700 mb-1">Doc ref</label><input type="text" id="tm-rmi-doc-ref" class="w-full border border-slate-300 rounded-lg text-sm px-2 py-2"/></div>
                <div><label class="block text-xs font-semibold text-slate-700 mb-1">Issue no.</label><input type="text" id="tm-rmi-issue" class="w-full border border-slate-300 rounded-lg text-sm px-2 py-2"/></div>
                <div><label class="block text-xs font-semibold text-slate-700 mb-1">Effective date</label><input type="text" id="tm-rmi-effective" class="w-full border border-slate-300 rounded-lg text-sm px-2 py-2"/></div>
            </div>
            <p class="text-xs text-slate-500" id="tm-rmi-meta"></p>
            <div class="overflow-x-auto border border-slate-200 rounded-lg">
                <table class="min-w-full text-xs">
                    <thead class="bg-slate-100 text-slate-700">
                        <tr>
                            <th class="text-left px-2 py-2 font-semibold">Item</th>
                            <th class="text-right px-2 py-2 font-semibold">Qty req</th>
                            <th class="text-left px-2 py-2 font-semibold">Ingredient</th>
                            <th class="text-left px-2 py-2 font-semibold">Pest / foreign</th>
                            <th class="text-left px-2 py-2 font-semibold">Wet / dirty</th>
                            <th class="text-left px-2 py-2 font-semibold">Weight / app.</th>
                            <th class="text-left px-2 py-2 font-semibold">Code / batch no.</th>
                            <th class="text-left px-2 py-2 font-semibold">Status</th>
                            <th class="text-left px-2 py-2 font-semibold">Sign</th>
                        </tr>
                    </thead>
                    <tbody id="tm-rmi-tbody"></tbody>
                </table>
            </div>
        </div>`;

    function opsPanel(key, title, docKey) {
        const isRo = docKey === 'ro-weekly';
        const ymw = isRo
            ? `<div class="flex flex-wrap gap-3 items-end">
                 <div><label class="block text-xs font-semibold text-slate-700 mb-1">Year</label><input type="number" id="tm-${key}-year" class="w-28 border border-slate-300 rounded-lg text-sm px-2 py-2"/></div>
                 <div><label class="block text-xs font-semibold text-slate-700 mb-1">Week (1–53)</label><input type="number" id="tm-${key}-week" min="1" max="53" class="w-24 border border-slate-300 rounded-lg text-sm px-2 py-2"/></div>
               </div>`
            : `<div class="flex flex-wrap gap-3 items-end">
                 <div><label class="block text-xs font-semibold text-slate-700 mb-1">Year</label><input type="number" id="tm-${key}-year" class="w-28 border border-slate-300 rounded-lg text-sm px-2 py-2"/></div>
                 <div><label class="block text-xs font-semibold text-slate-700 mb-1">Month</label><input type="number" id="tm-${key}-month" min="1" max="12" class="w-24 border border-slate-300 rounded-lg text-sm px-2 py-2"/></div>
               </div>`;
        return `
        <div id="tm-panel-${key}" class="tm-panel hidden space-y-3">
            <p class="text-sm text-slate-600">${_esc(title)}</p>
            ${ymw}
            <textarea id="tm-${key}-json" class="w-full min-h-[320px] font-mono text-xs border border-slate-300 rounded-lg p-3" spellcheck="false"></textarea>
            <div class="flex flex-wrap gap-2">
                <button type="button" id="tm-${key}-load" class="px-4 py-2 border border-slate-300 text-sm rounded-lg hover:bg-slate-50">Load from server</button>
                <button type="button" id="tm-${key}-save" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">Save</button>
            </div>
            <p class="text-xs text-slate-500" id="tm-${key}-status"></p>
        </div>`;
    }

    panelsRoot.innerHTML =
        tankPanels +
        rawPanel +
        opsPanel('filter-replacement', 'Filter replacement log (monthly).', 'filter-replacement') +
        opsPanel('mixing-area', 'Mixing area checklist (monthly).', 'mixing-area') +
        opsPanel('ro-weekly', 'RO plant weekly checklist.', 'ro-weekly');

    subtabs.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-tm-tab]');
        if (!btn) return;
        switchTmSubtab(btn.getAttribute('data-tm-tab'));
    });

    TM_TANK_IDS.forEach((n) => {
        document.getElementById(`tm-cip-save-${n}`)?.addEventListener('click', () => saveTankCip(n));
        document.getElementById(`tm-cip-pdf-${n}`)?.addEventListener('click', () => openTankPdf(n));
    });

    document.getElementById('tm-rmi-load')?.addEventListener('click', loadRawMaterialInspection);
    document.getElementById('tm-rmi-save')?.addEventListener('click', saveRawMaterialInspection);
    document.getElementById('tm-rmi-batch')?.addEventListener('change', loadRawMaterialInspection);

    ['filter-replacement', 'mixing-area', 'ro-weekly'].forEach((k) => {
        document.getElementById(`tm-${k}-load`)?.addEventListener('click', () => loadOps(k));
        document.getElementById(`tm-${k}-save`)?.addEventListener('click', () => saveOps(k));
    });

    const { year, month } = _defaultYm();
    const { year: wy, week } = _defaultWeek();
    ['filter-replacement', 'mixing-area'].forEach((k) => {
        const yEl = document.getElementById(`tm-${k}-year`);
        const mEl = document.getElementById(`tm-${k}-month`);
        if (yEl) yEl.value = String(year);
        if (mEl) mEl.value = String(month);
    });
    const ry = document.getElementById('tm-ro-weekly-year');
    const rw = document.getElementById('tm-ro-weekly-week');
    if (ry) ry.value = String(wy);
    if (rw) rw.value = String(week);
}

function _setSubtabStyles(activeKey) {
    document.querySelectorAll('.tm-subtab').forEach((btn) => {
        const on = btn.getAttribute('data-tm-tab') === activeKey;
        btn.classList.toggle('border-blue-600', on);
        btn.classList.toggle('text-blue-600', on);
        btn.classList.toggle('border-transparent', !on);
        btn.classList.toggle('text-slate-500', !on);
    });
}

function switchTmSubtab(key) {
    _activeKey = key;
    _setSubtabStyles(key);
    document.querySelectorAll('.tm-panel').forEach((p) => p.classList.add('hidden'));
    if (key.startsWith('tank-')) {
        const n = key.replace('tank-', '');
        const panel = document.getElementById(`tm-panel-tank-${n}`);
        if (panel) {
            panel.classList.remove('hidden');
            loadTankCip(n);
        }
        return;
    }
    const idMap = {
        'raw-material': 'tm-panel-raw-material',
        'filter-replacement': 'tm-panel-filter-replacement',
        'mixing-area': 'tm-panel-mixing-area',
        'ro-weekly': 'tm-panel-ro-weekly',
    };
    const pid = idMap[key];
    const el = pid ? document.getElementById(pid) : null;
    if (el) {
        el.classList.remove('hidden');
        if (key === 'raw-material') {
            loadBatchOptions().then(loadRawMaterialInspection);
        } else if (OPS_MAP[key]) {
            loadOps(key);
        }
    }
}

async function loadTankCip(n) {
    const ta = document.getElementById(`tm-cip-json-${n}`);
    if (!ta) return;
    try {
        const r = await authenticatedFetch(`/api/mixing/tanks/${n}/cip`);
        const data = await _jsonOrThrow(r, 'Failed to load tank CIP');
        ta.value = JSON.stringify(data, null, 2);
    } catch (e) {
        console.error(e);
        showToast(e.message || 'Failed to load tank CIP', 'error');
    }
}

async function saveTankCip(n) {
    const ta = document.getElementById(`tm-cip-json-${n}`);
    if (!ta) return;
    let parsed;
    try {
        parsed = JSON.parse(ta.value || '{}');
    } catch {
        showToast('Invalid JSON', 'error');
        return;
    }
    try {
        const r = await authenticatedFetch(`/api/mixing/tanks/${n}/cip`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: parsed }),
        });
        const out = await _jsonOrThrow(r, 'Save failed');
        if (out.data) ta.value = JSON.stringify(out.data, null, 2);
        showToast('Tank library saved', 'success');
    } catch (e) {
        console.error(e);
        showToast(e.message || 'Save failed', 'error');
    }
}

async function openTankPdf(n) {
    try {
        const r = await authenticatedFetch(`/api/mixing/tanks/${n}/cip/pdf`);
        if (!r.ok) {
            await _jsonOrThrow(r, 'PDF failed');
        }
        const blob = await r.blob();
        const url = window.URL.createObjectURL(blob);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
    } catch (e) {
        console.error(e);
        showToast(e.message || 'PDF failed', 'error');
    }
}

async function loadBatchOptions() {
    const sel = document.getElementById('tm-rmi-batch');
    if (!sel) return;
    const prev = sel.value;
    try {
        const r = await authenticatedFetch('/api/production-batches');
        const data = await _jsonOrThrow(r, 'Failed to load batches');
        const batches = (data.batches || []).slice();
        batches.sort((a, b) => {
            const na = parseInt((a.batch_no || '').replace(/\D/g, ''), 10) || 0;
            const nb = parseInt((b.batch_no || '').replace(/\D/g, ''), 10) || 0;
            return nb - na;
        });
        sel.innerHTML =
            '<option value="">— Select batch —</option>' +
            batches
                .map((b) => {
                    const label = `${_esc(b.batch_no || '')} — ${_esc(b.recipe_name || b.description || '')}`;
                    return `<option value="${_esc(b.batch_no || '')}">${label}</option>`;
                })
                .join('');
        if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
    } catch (e) {
        console.error(e);
        showToast(e.message || 'Batch list failed', 'error');
    }
}

async function loadRawMaterialInspection() {
    const sel = document.getElementById('tm-rmi-batch');
    const tbody = document.getElementById('tm-rmi-tbody');
    const metaEl = document.getElementById('tm-rmi-meta');
    if (!sel || !tbody) return;
    const batchNo = sel.value.trim();
    if (!batchNo) {
        tbody.innerHTML = '';
        _rmiLoaded = null;
        if (metaEl) metaEl.textContent = '';
        return;
    }
    try {
        const r = await authenticatedFetch(`/api/mixing/raw-material-inspection/${encodeURIComponent(batchNo)}`);
        const data = await _jsonOrThrow(r, 'Load failed');
        _rmiLoaded = data;
        document.getElementById('tm-rmi-doc-ref').value = data.doc_ref || '';
        document.getElementById('tm-rmi-issue').value = data.issue_no || '';
        document.getElementById('tm-rmi-effective').value = data.effective_date || '';
        if (metaEl) {
            metaEl.textContent = `Recipe: ${data.recipe_name || '—'}`;
        }
        const rows = data.rows || [];
        tbody.innerHTML = rows
            .map((row, idx) => {
                const code = row.item_code || '';
                return `
                <tr class="border-t border-slate-100" data-rmi-idx="${idx}" data-item-code="${_esc(code)}">
                    <td class="px-2 py-1 font-mono">${_esc(code)}</td>
                    <td class="px-2 py-1 text-right font-mono whitespace-nowrap">${_esc(_formatQty(row.qty_required, row.uom))}</td>
                    <td class="px-2 py-1">${_esc(row.ingredient_label)}</td>
                    <td class="px-2 py-1"><input class="w-full border border-slate-200 rounded px-1 py-0.5" data-f="pest_foreign" value="${_esc(row.pest_foreign)}"/></td>
                    <td class="px-2 py-1"><input class="w-full border border-slate-200 rounded px-1 py-0.5" data-f="wet_dirty" value="${_esc(row.wet_dirty)}"/></td>
                    <td class="px-2 py-1"><input class="w-full border border-slate-200 rounded px-1 py-0.5" data-f="weight_appearance" value="${_esc(row.weight_appearance)}"/></td>
                    <td class="px-2 py-1"><input class="w-full border border-slate-200 rounded px-1 py-0.5" data-f="code_comparison" value="${_esc(row.code_comparison)}"/></td>
                    <td class="px-2 py-1"><input class="w-full border border-slate-200 rounded px-1 py-0.5" data-f="status" value="${_esc(row.status)}"/></td>
                    <td class="px-2 py-1"><input class="w-full border border-slate-200 rounded px-1 py-0.5" data-f="sign" value="${_esc(row.sign)}"/></td>
                </tr>`;
            })
            .join('');
    } catch (e) {
        console.error(e);
        showToast(e.message || 'Load failed', 'error');
        tbody.innerHTML = '';
        _rmiLoaded = null;
    }
}

function _collectRmiRowsFromDom() {
    const tbody = document.getElementById('tm-rmi-tbody');
    if (!tbody) return [];
    const fields = ['pest_foreign', 'wet_dirty', 'weight_appearance', 'code_comparison', 'status', 'sign'];
    return [...tbody.querySelectorAll('tr[data-item-code]')].map((tr) => {
        const code = tr.getAttribute('data-item-code') || '';
        const cells = tr.querySelectorAll('input[data-f]');
        const row = {
            item_code: code,
            ingredient_label: '',
            pest_foreign: '',
            wet_dirty: '',
            weight_appearance: '',
            code_comparison: '',
            status: '',
            sign: '',
        };
        cells.forEach((inp) => {
            const f = inp.getAttribute('data-f');
            if (fields.includes(f)) row[f] = inp.value;
        });
        const tds = tr.querySelectorAll('td');
        if (tds[2]) row.ingredient_label = tds[2].textContent.trim();
        return row;
    });
}

async function saveRawMaterialInspection() {
    const sel = document.getElementById('tm-rmi-batch');
    if (!sel?.value?.trim()) {
        showToast('Select a batch', 'error');
        return;
    }
    const batchNo = sel.value.trim();
    const payload = {
        doc_ref: document.getElementById('tm-rmi-doc-ref')?.value || '',
        issue_no: document.getElementById('tm-rmi-issue')?.value || '',
        effective_date: document.getElementById('tm-rmi-effective')?.value || '',
        header: (_rmiLoaded && _rmiLoaded.header) || {},
        footer: (_rmiLoaded && _rmiLoaded.footer) || {},
        rows: _collectRmiRowsFromDom(),
    };
    try {
        const r = await authenticatedFetch(`/api/mixing/raw-material-inspection/${encodeURIComponent(batchNo)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: payload }),
        });
        await _jsonOrThrow(r, 'Save failed');
        showToast('Raw material inspection saved', 'success');
        await loadRawMaterialInspection();
    } catch (e) {
        console.error(e);
        showToast(e.message || 'Save failed', 'error');
    }
}

function _opsQueryParams(panelKey) {
    const apiType = OPS_MAP[panelKey];
    const yEl = document.getElementById(`tm-${panelKey}-year`);
    const year = parseInt(yEl?.value, 10);
    if (!Number.isFinite(year) || year < 2000) {
        showToast('Enter a valid year', 'error');
        return null;
    }
    if (apiType === 'ro_plant_weekly') {
        const wEl = document.getElementById(`tm-${panelKey}-week`);
        const week = parseInt(wEl?.value, 10);
        if (!Number.isFinite(week) || week < 1 || week > 53) {
            showToast('Week must be 1–53', 'error');
            return null;
        }
        return { year, month: 0, week, apiType };
    }
    const mEl = document.getElementById(`tm-${panelKey}-month`);
    const month = parseInt(mEl?.value, 10);
    if (!Number.isFinite(month) || month < 1 || month > 12) {
        showToast('Month must be 1–12', 'error');
        return null;
    }
    return { year, month, week: 0, apiType };
}

async function loadOps(panelKey) {
    const q = _opsQueryParams(panelKey);
    if (!q) return;
    const ta = document.getElementById(`tm-${panelKey}-json`);
    const st = document.getElementById(`tm-${panelKey}-status`);
    if (!ta) return;
    const url =
        q.apiType === 'ro_plant_weekly'
            ? `/api/mixing/ops/${q.apiType}?year=${q.year}&week=${q.week}`
            : `/api/mixing/ops/${q.apiType}?year=${q.year}&month=${q.month}`;
    try {
        const r = await authenticatedFetch(url);
        const doc = await _jsonOrThrow(r, 'Load failed');
        ta.value = JSON.stringify(doc.data || {}, null, 2);
        if (st) {
            const u = doc.updated_at ? new Date(doc.updated_at).toLocaleString() : '—';
            st.textContent = `Last updated: ${u}  ·  ${doc.updated_by || '—'}`;
        }
    } catch (e) {
        console.error(e);
        showToast(e.message || 'Load failed', 'error');
    }
}

async function saveOps(panelKey) {
    const q = _opsQueryParams(panelKey);
    if (!q) return;
    const ta = document.getElementById(`tm-${panelKey}-json`);
    if (!ta) return;
    let data;
    try {
        data = JSON.parse(ta.value || '{}');
    } catch {
        showToast('Invalid JSON', 'error');
        return;
    }
    const url =
        q.apiType === 'ro_plant_weekly'
            ? `/api/mixing/ops/${q.apiType}?year=${q.year}&week=${q.week}`
            : `/api/mixing/ops/${q.apiType}?year=${q.year}&month=${q.month}`;
    try {
        const r = await authenticatedFetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data }),
        });
        await _jsonOrThrow(r, 'Save failed');
        showToast('Operational log saved', 'success');
        await loadOps(panelKey);
    } catch (e) {
        console.error(e);
        showToast(e.message || 'Save failed', 'error');
    }
}

export function initTanksMixingPage() {
    const root = document.getElementById('view-tanks-mixing');
    if (!root) return;

    if (!root.dataset.tmBuilt) {
        _buildShell();
        root.dataset.tmBuilt = '1';
        window.addEventListener('Demo Plant-raw-material-saved', (ev) => {
            const bn = ev.detail?.batch_no;
            const sel = document.getElementById('tm-rmi-batch');
            if (bn && sel && sel.value === bn && _activeKey === 'raw-material') {
                loadRawMaterialInspection();
            }
        });
    }

    switchTmSubtab(_activeKey);
}
