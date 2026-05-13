/**
 * Demo Plant LLC - PO Processing Wizard Module
 * 3-step wizard: Customer -> PI Products -> JO Requirements
 * Saves a draft only; allocation + JO creation happen from the Allocation sub-tab.
 */

import { showToast, debounce } from '../utils.js?v=20260125h';
import { authenticatedFetch, hasAnyRole, getCurrentUser } from '../auth.js?v=20260428b';

// ============================================================================
// Pallet Types (4 fixed types - user ticks which apply per product)
// ============================================================================

const PALLET_TYPES = [
    { code: '111-PLT-003', label: '1420\u00d71120' },
    { code: '111-PLT-005', label: '1200\u00d71000' },
    { code: '111-PLT-006', label: 'Red 1200\u00d71000' },
    { code: '111-PLT-007', label: 'Euro 1200\u00d7800' },
];

// Cases-per-pallet lookup: [pallet code][uom][ml].
// null/missing = unsupported (e.g. 1420x1120 does not run PET).
// Object value = brand-dependent (500ml CAN on 1200x1000 family: dragon=80, fritzberg=81).
const PALLET_CAPACITY = {
    '111-PLT-007': { // Euro 1200x800
        CAN: { 300: 100, 500: 81 },
        PET: { 330: 80, 500: 63, 2500: 48 },
    },
    '111-PLT-003': { // 1420x1120 (cans only)
        CAN: { 300: 180, 500: 130 },
        PET: {},
    },
    '111-PLT-005': { // 1200x1000
        CAN: { 300: 130, 500: { dragon: 80, fritzberg: 81 } },
        PET: { 330: 104, 500: 70, 2500: 64 },
    },
    '111-PLT-006': { // Red 1200x1000 (same capacities)
        CAN: { 300: 130, 500: { dragon: 80, fritzberg: 81 } },
        PET: { 330: 104, 500: 70, 2500: 64 },
    },
};

function _detectBrand(description) {
    const s = (description || '').toLowerCase();
    if (s.includes('dragon')) return 'dragon';
    if (s.includes('fritzberg') || s.includes('fritz')) return 'fritzberg';
    return null;
}

function _casesPerPallet(palletCode, uom, ml, description) {
    const cap = PALLET_CAPACITY[palletCode]?.[uom]?.[ml];
    if (cap == null) return null;
    if (typeof cap === 'object') {
        const brand = _detectBrand(description);
        return cap[brand] ?? cap.fritzberg;
    }
    return cap;
}

// Auto-fill pallet_quantities for a JO item. Runs only when exactly one
// pallet type is selected (multi-type rows are manual per user convention).
// Skips codes the user has manually edited (tracked in _user_edited_pallets).
function _autoCalcPallets(jo) {
    if (!jo) return;
    const types = jo.pallet_types || [];
    if (types.length !== 1) return;
    if (!jo.pallet_quantities || typeof jo.pallet_quantities !== 'object') jo.pallet_quantities = {};
    const edited = new Set(jo._user_edited_pallets || []);
    const code = types[0];
    if (edited.has(code)) return;
    const cases = Number(jo.cases) || 0;
    const capPerPal = _casesPerPallet(code, jo.uom, jo.ml, jo.description);
    if (cases <= 0 || !capPerPal) {
        jo.pallet_quantities[code] = 0;
        return;
    }
    jo.pallet_quantities[code] = Math.ceil(cases / capPerPal);
}

function _palletLabels(codes) {
    if (!Array.isArray(codes) || codes.length === 0) return '-';
    return codes.map(c => (PALLET_TYPES.find(p => p.code === c)?.label) || c).join(', ');
}

function _palletQtyInputsHtml(idx, codes, quantities) {
    const types = Array.isArray(codes) ? codes : [];
    if (types.length === 0) return '<span class="text-slate-400 text-xs">-</span>';
    const qmap = (quantities && typeof quantities === 'object') ? quantities : {};
    return `<div class="flex flex-col gap-0.5 text-[11px] leading-tight">
        ${types.map(code => {
            const pt = PALLET_TYPES.find(p => p.code === code);
            const label = pt ? pt.label : code;
            const qty = Number(qmap[code]) || 0;
            return `<label class="flex items-center gap-1 whitespace-nowrap">
                <span class="min-w-[90px]">${label}</span>
                <input type="number" min="0" step="1" value="${qty}"
                    class="w-14 border rounded px-1 py-0.5 text-xs text-right"
                    onchange="updatePalletQuantity(${idx}, '${code}', this.value)">
            </label>`;
        }).join('')}
    </div>`;
}

function _palletCheckboxesHtml(idx, selectedCodes) {
    const sel = Array.isArray(selectedCodes) ? selectedCodes : [];
    return `<div class="flex flex-col gap-0.5 text-[11px] leading-tight">
        ${PALLET_TYPES.map(pt => `
            <label class="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                <input type="checkbox" class="rounded border-slate-300"
                    ${sel.includes(pt.code) ? 'checked' : ''}
                    onchange="togglePIPallet(${idx}, '${pt.code}', this.checked)">
                <span>${pt.label}</span>
            </label>`).join('')}
    </div>`;
}

// ============================================================================
// Module State
// ============================================================================

let currentStep = 1;
let finishedGoodsData = [];
let itemsSearchList = [];
let recipeItemMap = {};
let gtinToItemCode = {};
let customersData = {};
let poFileChangeHandler = null;

// Selected item for PI add-item form (Step 2)
let selectedPIItemCode = '';
let selectedPIItemDesc = '';

// Editing state for PI items table (Step 2) and JO items table (Step 3)
let editingPIItemIndex = -1;
let editingJOItemIndex = -1;

// Wizard state preserved across step navigation
let wizardState = {
    customer: '', address: '', customerRef: '', poNumber: '',
    date: new Date().toISOString().split('T')[0],
    currency: 'AED',
    market: 'ae',
    localExportType: null, // 'local' | 'export' — compulsory pick on Step 1
    uploadedPOFilenames: [],
    draftId: null,
    notes: '',
    piItems: [],     // Step 2 PI product list
    joItems: [],     // Step 3 JO requirements (derived from piItems + recipes)
    allocations: [], // Step 4 inventory allocations
    piItemsHash: '', // track if piItems changed to re-derive joItems
};

function _piHash() {
    return JSON.stringify(wizardState.piItems.map(i => `${i.item_code}:${i.qty_cases}`));
}

// ============================================================================
// Page Initialization
// ============================================================================

export function updateEnteredByField() {
    const user = getCurrentUser();
    const el = document.getElementById('jo-entered-by');
    if (el) el.textContent = user ? (user.full_name || user.username || user.email || 'Unknown User') : '';
}

const MARKET_LS_KEY = 'demoplant_custom_markets';

function _loadCustomMarkets() {
    try {
        const raw = localStorage.getItem(MARKET_LS_KEY);
        const arr = raw ? JSON.parse(raw) : [];
        return Array.isArray(arr) ? arr.filter(x => x && typeof x === 'string') : [];
    } catch { return []; }
}

function _saveCustomMarkets(list) {
    try { localStorage.setItem(MARKET_LS_KEY, JSON.stringify(list)); } catch {}
}

function _applyCustomMarketsToSelect() {
    const sel = document.getElementById('jo-market');
    if (!sel) return;
    const existing = new Set(Array.from(sel.options).map(o => o.value));
    const customSentinel = sel.querySelector('option[value="__custom__"]');
    _loadCustomMarkets().forEach(code => {
        if (existing.has(code)) return;
        const opt = document.createElement('option');
        opt.value = code;
        opt.textContent = code;
        if (customSentinel) sel.insertBefore(opt, customSentinel); else sel.appendChild(opt);
        existing.add(code);
    });
}

function _setupMarketHandler() {
    const sel = document.getElementById('jo-market');
    if (!sel || sel._marketHandlerBound) return;
    sel._marketHandlerBound = true;
    sel.addEventListener('change', () => {
        if (sel.value !== '__custom__') return;
        const raw = window.prompt('Enter new market name:');
        const name = (raw || '').trim();
        if (!name) { sel.value = wizardState.market || 'ae'; return; }
        const code = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        if (!code) { sel.value = wizardState.market || 'ae'; return; }
        const list = _loadCustomMarkets();
        if (!list.includes(code)) { list.push(code); _saveCustomMarkets(list); }
        if (!Array.from(sel.options).some(o => o.value === code)) {
            const opt = document.createElement('option');
            opt.value = code;
            opt.textContent = name;
            const sentinel = sel.querySelector('option[value="__custom__"]');
            if (sentinel) sel.insertBefore(opt, sentinel); else sel.appendChild(opt);
        }
        sel.value = code;
    });
}

export function loadJobOrderPage() {
    loadRecipeItemMapThenDropdown();
    loadCustomersDropdown().then(() => setupCustomerHandlers());
    _applyCustomMarketsToSelect();
    _setupMarketHandler();
    currentStep = 1;
    wizardState.date = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('jo-date');
    if (dateInput) dateInput.value = wizardState.date;
    updateEnteredByField();
    setupPOUploadListener();
    renderSavedJobOrders();
    _showStep(1);
    switchPOTab('po');
}

// ============================================================================
// Wizard Navigation
// ============================================================================

function _showStep(step) {
    currentStep = step;
    for (let i = 1; i <= 3; i++) {
        const panel = document.getElementById(`wizard-step-${i}`);
        if (panel) panel.classList.toggle('hidden', i !== step);
    }
    const step4 = document.getElementById('wizard-step-4');
    if (step4) step4.classList.add('hidden');
    _updateProgressBar(step);
    _updateNavButtons(step);

    if (step === 2) {
        _setupPIItemSearch();
        renderPIItems();
    }
    if (step === 3) {
        _deriveJOItemsFromPI();
        renderJOItems();
    }
}

function _updateProgressBar(step) {
    const fill = document.getElementById('wizard-progress-fill');
    if (fill) fill.style.width = `${((step - 1) / 2) * 100}%`;

    for (let i = 1; i <= 3; i++) {
        const dot = document.getElementById(`wizard-dot-${i}`);
        if (!dot) continue;
        const label = dot.parentElement?.querySelector('span');
        if (i < step) {
            dot.className = 'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 border-green-500 bg-green-500 text-white transition-all';
            dot.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
            if (label) label.className = 'text-xs font-medium mt-2 text-green-600';
        } else if (i === step) {
            dot.className = 'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 border-blue-600 bg-blue-600 text-white transition-all';
            dot.textContent = i;
            if (label) label.className = 'text-xs font-medium mt-2 text-blue-700';
        } else {
            dot.className = 'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 border-slate-300 bg-white text-slate-400 transition-all';
            dot.textContent = i;
            if (label) label.className = 'text-xs font-medium mt-2 text-slate-400';
        }
    }
}

function _updateNavButtons(step) {
    const back = document.getElementById('wizard-btn-back');
    const next = document.getElementById('wizard-btn-next');
    const save = document.getElementById('wizard-btn-save');
    if (back) back.classList.toggle('hidden', step === 1);
    if (next) next.classList.toggle('hidden', step === 3);
    if (save) save.classList.toggle('hidden', step !== 3);
}

function _saveCurrentStepState() {
    if (currentStep === 1) {
        wizardState.customer = document.getElementById('jo-customer')?.value?.trim() || '';
        wizardState.customerRef = document.getElementById('jo-customer-auto-ref')?.value?.trim() || '';
        wizardState.poNumber = document.getElementById('jo-customer-ref')?.value?.trim() || '';
        wizardState.address = document.getElementById('jo-address')?.value?.trim() || '';
        wizardState.date = document.getElementById('jo-date')?.value || wizardState.date;
        wizardState.currency = document.getElementById('jo-currency')?.value || 'AED';
        wizardState.market = document.getElementById('jo-market')?.value || 'ae';
        // localExportType is captured by setOrderType() button handlers, not a normal input
    }
    if (currentStep === 3) {
        wizardState.notes = document.getElementById('jo-notes')?.value?.trim() || '';
    }
}

function _restoreStepState(step) {
    if (step === 1) {
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        setVal('jo-customer', wizardState.customer);
        setVal('jo-customer-auto-ref', wizardState.customerRef);
        setVal('jo-customer-ref', wizardState.poNumber);
        setVal('jo-address', wizardState.address);
        setVal('jo-date', wizardState.date);
        const currEl = document.getElementById('jo-currency');
        if (currEl) currEl.value = wizardState.currency || 'AED';
        const marketEl = document.getElementById('jo-market');
        if (marketEl) marketEl.value = wizardState.market || 'ae';
        _renderOrderTypeButtons();
        updateEnteredByField();
    }
    if (step === 3) {
        const notesEl = document.getElementById('jo-notes');
        if (notesEl) notesEl.value = wizardState.notes || '';
    }
}

function _renderOrderTypeButtons() {
    const localBtn = document.getElementById('jo-order-type-local');
    const exportBtn = document.getElementById('jo-order-type-export');
    if (!localBtn || !exportBtn) return;
    const active = 'px-4 py-2.5 font-medium text-sm rounded-lg transition-all bg-blue-600 text-white shadow-sm';
    const inactive = 'px-4 py-2.5 font-medium text-sm rounded-lg transition-all bg-white border border-slate-300 text-slate-700 hover:bg-slate-50';
    localBtn.className = wizardState.localExportType === 'local' ? active : inactive;
    exportBtn.className = wizardState.localExportType === 'export' ? active : inactive;
}

export function setOrderType(value) {
    if (value !== 'local' && value !== 'export') return;
    wizardState.localExportType = value;
    _renderOrderTypeButtons();
}

/**
 * Edit/flag an existing JO's order type (Local/Export) via PATCH.
 * Triggered from row badges in po_status.js, documents.js, and the Admin
 * "Untyped Job Orders" panel. Uses a simple confirm-style flow: clicking a
 * Local badge asks "Switch to Export?"; clicking an Untyped badge asks the
 * user to pick.
 */
export async function editJOType(summaryRef, currentType) {
    if (!summaryRef) return;
    let next;
    if (currentType === 'local') {
        next = window.confirm(`JO ${summaryRef} is currently LOCAL.\n\nOK = switch to EXPORT\nCancel = keep LOCAL`) ? 'export' : null;
    } else if (currentType === 'export') {
        next = window.confirm(`JO ${summaryRef} is currently EXPORT.\n\nOK = switch to LOCAL\nCancel = keep EXPORT`) ? 'local' : null;
    } else {
        const ans = (window.prompt(`JO ${summaryRef} has no order type.\n\nType "local" or "export":`, 'local') || '').trim().toLowerCase();
        if (ans !== 'local' && ans !== 'export') return;
        next = ans;
    }
    if (!next) return;
    try {
        const resp = await authenticatedFetch(`/api/job-orders/${encodeURIComponent(summaryRef)}/type`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ local_export_type: next }),
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.detail || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        showToast(`JO ${summaryRef} → ${next.toUpperCase()} (${data.reservations_updated || 0} reservations updated)`, 'success');
        // Refresh whichever view is open
        if (typeof window.loadPOStatus === 'function') { try { await window.loadPOStatus(); } catch {} }
        if (typeof window.loadUntypedJOs === 'function') { try { await window.loadUntypedJOs(); } catch {} }
    } catch (e) {
        console.error('editJOType failed', e);
        showToast(`Failed to flag JO: ${e.message}`, 'error');
    }
}

export function wizardNext() {
    _saveCurrentStepState();
    if (currentStep === 1) {
        if (!wizardState.customer) { showToast('Please enter a customer name', 'error'); return; }
        if (!wizardState.poNumber) { showToast('Please enter a PO number', 'error'); return; }
        if (!wizardState.date) { showToast('Please select a date', 'error'); return; }
        if (wizardState.localExportType !== 'local' && wizardState.localExportType !== 'export') {
            showToast('Pick Local or Export to continue', 'error'); return;
        }
    }
    if (currentStep === 2 && wizardState.piItems.length === 0) {
        showToast('Please add at least one product', 'error'); return;
    }
    if (currentStep === 3 && wizardState.joItems.length === 0) {
        showToast('No job order items', 'error'); return;
    }
    if (currentStep < 3) {
        const next = currentStep + 1;
        _restoreStepState(next);
        _showStep(next);
    }
}

export function wizardBack() {
    _saveCurrentStepState();
    if (currentStep > 1) {
        const prev = currentStep - 1;
        _restoreStepState(prev);
        _showStep(prev);
    }
}

export function wizardGoToStep(step) {
    if (step === currentStep) return;
    if (step > currentStep + 1) return; // can't skip ahead
    _saveCurrentStepState();
    _restoreStepState(step);
    _showStep(step);
}

export function clearWizard() {
    wizardState = {
        customer: '', address: '', customerRef: '', poNumber: '',
        date: new Date().toISOString().split('T')[0],
        currency: 'AED', market: 'ae', localExportType: null,
        uploadedPOFilenames: [], draftId: null, notes: '',
        piItems: [], joItems: [], allocations: [], piItemsHash: '',
    };
    editingJOItemIndex = -1;
    selectedPIItemCode = '';
    selectedPIItemDesc = '';
    const poInput = document.getElementById('po-upload-input');
    const extractBtn = document.getElementById('btn-extract-po');
    const statusDiv = document.getElementById('jo-po-upload-status');
    if (poInput) poInput.value = '';
    if (extractBtn) { extractBtn.disabled = true; extractBtn.className = 'bg-slate-300 text-slate-500 font-medium py-2.5 px-4 rounded-lg transition-all flex items-center gap-2 cursor-not-allowed'; }
    if (statusDiv) statusDiv.innerHTML = '';
    loadJobOrderPage();
}

// ============================================================================
// Sub-tab Switching (Saved / Reservations / Document Links)
// ============================================================================

export function switchJOSubTab(tab) {
    document.querySelectorAll('.jo-subtab').forEach(btn => {
        btn.classList.remove('border-blue-600', 'text-blue-600');
        btn.classList.add('border-transparent', 'text-slate-500');
    });
    document.querySelectorAll('.jo-panel').forEach(p => p.classList.add('hidden'));
    const btn = document.getElementById(`jo-subtab-${tab}`);
    const panel = document.getElementById(`jo-panel-${tab}`);
    if (btn) { btn.classList.add('border-blue-600', 'text-blue-600'); btn.classList.remove('border-transparent', 'text-slate-500'); }
    if (panel) panel.classList.remove('hidden');
    if (tab === 'saved') renderSavedJobOrders();
    if (tab === 'reservations') loadStockReservations();
    if (tab === 'doclinks') loadDocumentLinksTab();
}

// ============================================================================
// PO Upload & AI Extraction (Step 1)
// ============================================================================

export function setupPOUploadListener() {
    const fileInput = document.getElementById('po-upload-input');
    const extractBtn = document.getElementById('btn-extract-po');
    const statusDiv = document.getElementById('jo-po-upload-status');
    if (!fileInput || !extractBtn || !statusDiv) return;
    if (poFileChangeHandler) fileInput.removeEventListener('change', poFileChangeHandler);
    poFileChangeHandler = function(e) {
        const btn = document.getElementById('btn-extract-po');
        const status = document.getElementById('jo-po-upload-status');
        const files = Array.from(e.target.files || []);
        if (files.length > 0) {
            btn.disabled = false;
            btn.className = 'bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all flex items-center gap-2';
            const pills = files.map(f =>
                `<span class="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full mr-1 mb-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    ${f.name} <span class="text-blue-500">(${(f.size/1024).toFixed(1)} KB)</span>
                </span>`
            ).join('');
            const heading = files.length === 1
                ? '<div class="text-blue-700 font-medium mb-1">Selected 1 file:</div>'
                : `<div class="text-blue-700 font-medium mb-1">Selected ${files.length} files (quantities will be summed per item code):</div>`;
            status.innerHTML = heading + pills;
        } else {
            btn.disabled = true;
            btn.className = 'bg-slate-300 text-slate-500 font-medium py-2.5 px-4 rounded-lg transition-all flex items-center gap-2 cursor-not-allowed';
            status.innerHTML = '';
        }
    };
    fileInput.addEventListener('change', poFileChangeHandler);
}

export async function extractPOForEditing() {
    if (!hasAnyRole(['admin', 'manager', 'employee'])) { showToast('No permission', 'error'); return; }
    const fileInput = document.getElementById('po-upload-input');
    const extractBtn = document.getElementById('btn-extract-po');
    const statusDiv = document.getElementById('jo-po-upload-status');
    if (!fileInput?.files || fileInput.files.length === 0) { alert('Please select a PDF file first'); return; }
    const files = Array.from(fileInput.files);
    for (const f of files) {
        if (!f.name.toLowerCase().endsWith('.pdf')) { alert(`'${f.name}' is not a PDF`); return; }
    }

    if (files.length > 1) {
        const ok = confirm(`You are uploading ${files.length} POs. Ensure they are all from the SAME customer — quantities will be summed per item code. Continue?`);
        if (!ok) return;
    }

    extractBtn.disabled = true;
    extractBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mr-2 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Extracting...';

    const marketVal = document.getElementById('jo-market')?.value || 'ae';
    const results = [];
    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            statusDiv.innerHTML = `<span class="text-blue-700 font-semibold">Processing ${i + 1} of ${files.length}: ${file.name}…</span>`;
            const formData = new FormData();
            formData.append('file', file);
            formData.append('market', marketVal);
            const response = await authenticatedFetch('/api/extract-po-for-editing', { method: 'POST', body: formData });
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(`${file.name}: ${err.detail || 'Failed to extract'}`);
            }
            const data = await response.json();
            if (!data.job_order_data) throw new Error(`${file.name}: No data received`);
            results.push({ filename: data.filename || file.name, job_order_data: data.job_order_data });
        }

        const merged = _mergeExtractedPOs(results);
        _loadExtractedDataToWizard(merged.job_order_data);
        wizardState.uploadedPOFilenames = merged.filenames;

        const totalItems = (merged.job_order_data.items || []).length;
        const filePills = results.map(r => {
            const fn = r.filename;
            const ref = (r.job_order_data && r.job_order_data.customer_ref) || '';
            const refPart = ref ? ` <span class="font-mono opacity-80">(${ref})</span>` : '';
            return `<span class="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs font-medium px-2 py-0.5 rounded-full mr-1 mb-1">${fn}${refPart}</span>`;
        }).join('');
        statusDiv.innerHTML = `<div class="text-green-700 font-semibold mb-1">Extracted ${results.length} PO${results.length>1?'s':''} → ${totalItems} unique item${totalItems===1?'':'s'}. Review data below then click Next.</div>${filePills}`;
    } catch (error) {
        statusDiv.innerHTML = `<span class="text-red-700 font-semibold">Error: ${error.message}</span>`;
    } finally {
        extractBtn.disabled = false;
        extractBtn.innerHTML = 'Extract & Load Data';
        extractBtn.className = 'bg-green-600 hover:bg-green-700 text-white font-medium py-2.5 px-4 rounded-lg transition-all flex items-center gap-2';
    }
}

/**
 * Merge multiple extracted POs into a single job_order_data object.
 * - Customer fields come from the FIRST PO.
 * - Items are merged by item_code: qty_cases and pallets_from_po are SUMMED.
 * - Unit price, description, gtin, weight are KEPT from the first occurrence.
 */
function _mergeExtractedPOs(results) {
    if (!Array.isArray(results) || results.length === 0) {
        return { filenames: [], job_order_data: { items: [] } };
    }

    const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
    const perPOInfo = results.map(r => ({
        filename: r.filename,
        po_number: (r.job_order_data && r.job_order_data.customer_ref) || '',
        requested_date: (r.job_order_data && r.job_order_data.date) || '',
    }));

    if (results.length === 1) {
        const jd = results[0].job_order_data || { items: [] };
        const poNum = perPOInfo[0].po_number;
        const poFn = perPOInfo[0].filename;
        const reqDate = perPOInfo[0].requested_date;
        (jd.items || []).forEach(it => {
            it.source_pos = [{
                po_number: poNum,
                po_filename: poFn,
                requested_date: reqDate,
                cases: num(it.cases),
                pallets: num(it.pallets_from_po),
            }];
        });
        return { filenames: [poFn], job_order_data: jd };
    }

    const first = results[0].job_order_data || {};
    const poRefs = [];
    perPOInfo.forEach(p => {
        const r = (p.po_number || '').trim();
        if (r && !poRefs.includes(r)) poRefs.push(r);
    });

    const merged = {
        customer: first.customer || '',
        customer_ref: poRefs.join(', '),
        address: first.address || '',
        date: first.date || '',
        currency: first.currency || 'AED',
        notes: first.notes || '',
        items: [],
    };

    const itemMap = new Map();

    for (let idx = 0; idx < results.length; idx++) {
        const r = results[idx];
        const info = perPOInfo[idx];
        const items = (r.job_order_data && Array.isArray(r.job_order_data.items)) ? r.job_order_data.items : [];
        for (const it of items) {
            const code = String(it.item_code || '').trim();
            if (!code) continue;
            const perPO = {
                po_number: info.po_number,
                po_filename: info.filename,
                requested_date: info.requested_date,
                cases: num(it.cases),
                pallets: num(it.pallets_from_po),
            };
            if (itemMap.has(code)) {
                const cur = itemMap.get(code);
                cur.cases = num(cur.cases) + num(it.cases);
                cur.pallets_from_po = num(cur.pallets_from_po) + num(it.pallets_from_po);
                cur.source_pos.push(perPO);
            } else {
                itemMap.set(code, {
                    item_code: code,
                    description: it.description || '',
                    gtin: it.gtin || '',
                    weight: it.weight || 0,
                    cases: num(it.cases),
                    pallets_from_po: num(it.pallets_from_po),
                    unit_price: it.unit_price || '',
                    total_amount: it.total_amount || '',
                    source_pos: [perPO],
                });
            }
        }
    }
    merged.items = Array.from(itemMap.values());
    return {
        filenames: results.map(r => r.filename),
        job_order_data: merged,
    };
}

function _loadExtractedDataToWizard(jobOrderData) {
    if (!jobOrderData) return;
    // Fill Step 1 fields
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('jo-customer', jobOrderData.customer);
    setVal('jo-customer-ref', jobOrderData.customer_ref);
    setVal('jo-address', jobOrderData.address);
    setVal('jo-date', jobOrderData.date || wizardState.date);

    const currEl = document.getElementById('jo-currency');
    if (currEl) {
        const cur = (jobOrderData.currency || 'AED').toUpperCase();
        currEl.value = (cur === 'USD') ? 'USD' : 'AED';
    }
    wizardState.customer = jobOrderData.customer || '';
    wizardState.address = jobOrderData.address || '';
    wizardState.poNumber = jobOrderData.customer_ref || '';
    wizardState.date = jobOrderData.date || wizardState.date;
    wizardState.currency = currEl?.value || 'AED';
    wizardState.notes = jobOrderData.notes || '';

    // Auto-detect market from customer name/address
    const detectText = `${wizardState.customer} ${wizardState.address}`.toLowerCase();
    const indiaKeywords = ['india', 'mumbai', 'delhi', 'chennai', 'kolkata', 'bangalore', 'hyderabad'];
    const saKeywords = ['south africa', 'johannesburg', 'cape town', 'durban', 'pretoria'];
    const ksaKeywords = ['ksa', 'saudi', 'riyadh', 'jeddah', 'dammam', 'mecca', 'medina'];
    const omKeywords = ['oman', 'muscat', 'salalah', 'sohar'];
    const soKeywords = ['somalia', 'mogadishu', 'hargeisa'];
    const bhKeywords = ['bahrain', 'manama'];
    let detectedMarket = 'ae';
    if (indiaKeywords.some(k => detectText.includes(k))) detectedMarket = 'india';
    else if (ksaKeywords.some(k => detectText.includes(k))) detectedMarket = 'ksa';
    else if (omKeywords.some(k => detectText.includes(k))) detectedMarket = 'om';
    else if (soKeywords.some(k => detectText.includes(k))) detectedMarket = 'so';
    else if (bhKeywords.some(k => detectText.includes(k))) detectedMarket = 'bh';
    else if (saKeywords.some(k => detectText.includes(k))) detectedMarket = 'sa';
    wizardState.market = detectedMarket;
    const marketEl = document.getElementById('jo-market');
    if (marketEl) marketEl.value = detectedMarket;

    // Build PI items from extracted data
    wizardState.piItems = [];
    if (jobOrderData.items && Array.isArray(jobOrderData.items)) {
        jobOrderData.items.forEach(item => {
            const code = String(item.item_code || '');
            const desc = String(item.description || '');
            const gtin = recipeItemMap[code]?.gtin || '';
            const qty = parseFloat(item.cases) || 0;
            const pallets = parseFloat(item.pallets_from_po) || 0;
            const unitPrice = String(item.unit_price || '');
            const totalAmount = String(item.total_amount || '');
            wizardState.piItems.push({
                item_code: code, description: desc, gtin,
                unit: 'CS', qty_cases: qty, pallets, weight: 0,
                unit_price: unitPrice, total_price: totalAmount,
                source_pos: Array.isArray(item.source_pos) ? item.source_pos : null,
            });
        });
    }
    wizardState.piItemsHash = '';
    updateEnteredByField();
}

// Keep legacy export name for app.js compatibility
export function loadExtractedDataToForm(data) { _loadExtractedDataToWizard(data); }

// ============================================================================
// Finished Goods & Recipe Data Loading
// ============================================================================

async function loadRecipeItemMapThenDropdown() {
    await loadRecipeItemMap();
    await loadFinishedGoodsDropdown();
}

export async function loadFinishedGoodsDropdown() {
    try {
        const response = await authenticatedFetch('/api/finished-goods-inventory');
        const data = await response.json();
        finishedGoodsData = data;
        const hasRecipeFilter = Object.keys(recipeItemMap).length > 0;
        itemsSearchList = [];
        const codesInList = new Set();
        data.forEach(item => {
            const code = item['Item Code'] || item['item_code'] || '';
            if (hasRecipeFilter && !recipeItemMap[code]) return;
            const desc = item['Item Description'] || item['description'] || '';
            const uom = item['UOM'] || item['uom'] || '';
            const gtin = recipeItemMap[code]?.gtin || '';
            itemsSearchList.push({ code, desc, uom, gtin });
            codesInList.add(code);
        });
        if (hasRecipeFilter) {
            Object.values(recipeItemMap).forEach(entry => {
                if (!entry.item_code || codesInList.has(entry.item_code)) return;
                codesInList.add(entry.item_code);
                itemsSearchList.push({ code: entry.item_code, desc: entry.recipe_name || entry.item_code, uom: 'CS', gtin: entry.gtin || '' });
            });
        }
    } catch (error) {
        console.error('Error loading finished goods:', error);
    }
}

async function loadRecipeItemMap() {
    try {
        const response = await authenticatedFetch('/api/recipe-item-map');
        const data = await response.json();
        recipeItemMap = {};
        gtinToItemCode = {};
        data.forEach(entry => {
            const key = `${entry.item_code}_${entry.ml || 0}`;
            recipeItemMap[key] = entry;
            recipeItemMap[entry.item_code] = entry;
            if (entry.gtin) gtinToItemCode[entry.gtin] = entry.item_code;
        });
    } catch (error) {
        console.error('Error loading recipe-item map:', error);
    }
}

// ============================================================================
// Customer Dropdown (Step 1)
// ============================================================================

async function loadCustomersDropdown() {
    try {
        const response = await authenticatedFetch('/api/customers?limit=5000&active_only=true');
        if (!response.ok) throw new Error('Failed');
        const data = await response.json();
        const list = data.customers || data || [];
        customersData = {};
        list.forEach(c => {
            const name = c.name || '';
            if (!name) return;
            customersData[name] = { address: c.address || '', customer_code: c.customer_code || '', customer_ref: c.customer_ref || '', market: c.market || '', _id: c._id || c.id || '' };
        });
    } catch (error) { console.error('Error loading customers:', error); }
}

function _renderCustomerDropdown(filter) {
    const dropdown = document.getElementById('jo-customer-dropdown');
    if (!dropdown) return;
    const lower = (filter || '').toLowerCase();
    const names = Object.keys(customersData).filter(n => !lower || n.toLowerCase().includes(lower));
    if (names.length === 0) { dropdown.classList.add('hidden'); return; }
    dropdown.innerHTML = names.map(n => `<div class="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 text-slate-800" data-name="${n.replace(/"/g, '&quot;')}">${n}</div>`).join('');
    dropdown.classList.remove('hidden');
}

const _debouncedPOCheck = debounce(async (poNumber) => {
    const statusEl = document.getElementById('po-number-status');
    if (!statusEl) return;
    if (!poNumber || poNumber.length < 2) { statusEl.classList.add('hidden'); return; }
    try {
        const resp = await authenticatedFetch(`/api/po-number-check?po_number=${encodeURIComponent(poNumber)}`);
        if (!resp.ok) { statusEl.classList.add('hidden'); return; }
        const data = await resp.json();
        statusEl.classList.remove('hidden');
        if (data.exists) {
            statusEl.textContent = 'This PO number already exists';
            statusEl.className = 'text-xs mt-1 text-red-500 font-medium';
        } else {
            statusEl.textContent = 'PO number available';
            statusEl.className = 'text-xs mt-1 text-green-500 font-medium';
        }
    } catch { statusEl.classList.add('hidden'); }
}, 500);

function setupCustomerHandlers() {
    const custEl = document.getElementById('jo-customer');
    const addrEl = document.getElementById('jo-address');
    const dropdown = document.getElementById('jo-customer-dropdown');
    if (!custEl || custEl._custHandlersBound) return;
    custEl._custHandlersBound = true;

    const poInput = document.getElementById('jo-customer-ref');
    if (poInput && !poInput._poCheckBound) {
        poInput._poCheckBound = true;
        poInput.addEventListener('input', () => _debouncedPOCheck(poInput.value.trim()));
    }

    const applySelection = (name) => {
        custEl.value = name;
        const entry = customersData[name];
        if (entry) {
            if (addrEl) addrEl.value = entry.address;
            const refEl = document.getElementById('jo-customer-auto-ref');
            if (refEl && entry.customer_ref) refEl.value = entry.customer_ref;
            const marketEl = document.getElementById('jo-market');
            if (marketEl && entry.market) {
                const code = entry.market;
                if (!Array.from(marketEl.options).some(o => o.value === code)) {
                    const opt = document.createElement('option');
                    opt.value = code;
                    opt.textContent = code;
                    const sentinel = marketEl.querySelector('option[value="__custom__"]');
                    if (sentinel) marketEl.insertBefore(opt, sentinel); else marketEl.appendChild(opt);
                }
                marketEl.value = code;
            }
        }
        if (dropdown) dropdown.classList.add('hidden');
        const prompt = document.getElementById('jo-new-customer-prompt');
        if (prompt) prompt.classList.toggle('hidden', !name || !!customersData[name]);
    };

    custEl.addEventListener('focus', () => _renderCustomerDropdown(custEl.value));
    custEl.addEventListener('click', () => _renderCustomerDropdown(custEl.value));
    custEl.addEventListener('input', () => {
        _renderCustomerDropdown(custEl.value);
        const prompt = document.getElementById('jo-new-customer-prompt');
        const name = custEl.value.trim();
        if (prompt) prompt.classList.toggle('hidden', !name || !!customersData[name]);
    });

    if (dropdown) {
        dropdown.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const item = e.target.closest('[data-name]');
            if (item) applySelection(item.dataset.name);
        });
    }
    document.addEventListener('click', (e) => {
        if (dropdown && !custEl.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.add('hidden');
    });
}

export async function saveNewCustomerFromPrompt() {
    const name = (document.getElementById('jo-customer')?.value || '').trim();
    const address = (document.getElementById('jo-address')?.value || '').trim();
    const customerRef = (document.getElementById('jo-customer-auto-ref')?.value || '').trim();
    const market = (document.getElementById('jo-market')?.value || '').trim();
    if (!name) { showToast('Please enter a customer name first', 'error'); return; }
    try {
        const existing = customersData[name];
        if (existing && existing._id) {
            await authenticatedFetch(`/api/customers/${existing._id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, address, customer_ref: customerRef, market }) });
            showToast(`Customer "${name}" updated`, 'success');
        } else {
            await authenticatedFetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, address, customer_ref: customerRef, market }) });
            showToast(`Customer "${name}" saved`, 'success');
        }
        await loadCustomersDropdown();
        const prompt = document.getElementById('jo-new-customer-prompt');
        if (prompt) prompt.classList.add('hidden');
    } catch (e) { showToast('Failed to save customer', 'error'); }
}

// ============================================================================
// Step 2: PI Item Search & Management
// ============================================================================

let _piSearchBound = false;

function _setupPIItemSearch() {
    const input = document.getElementById('pi-item-search');
    const dropdown = document.getElementById('pi-item-dropdown');
    if (!input || _piSearchBound) return;
    _piSearchBound = true;

    const renderDropdown = () => {
        if (!dropdown) return;
        const filter = (input.value || '').toLowerCase();
        const matches = itemsSearchList.filter(it =>
            !filter || it.code.toLowerCase().includes(filter) ||
            it.desc.toLowerCase().includes(filter) ||
            (it.gtin && it.gtin.toLowerCase().includes(filter))
        );
        if (matches.length === 0) {
            dropdown.innerHTML = '<div class="px-4 py-2 text-sm text-slate-400">No items found</div>';
            dropdown.classList.remove('hidden');
            return;
        }
        dropdown.innerHTML = matches.map(it => {
            const gtinTag = it.gtin ? ` <span class="text-slate-400">(${it.gtin})</span>` : '';
            return `<div class="px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 text-slate-800 truncate" data-code="${it.code}" data-desc="${it.desc.replace(/"/g, '&quot;')}">${it.code} - ${it.desc}${gtinTag}</div>`;
        }).join('');
        dropdown.classList.remove('hidden');
    };

    input.addEventListener('focus', renderDropdown);
    input.addEventListener('click', renderDropdown);
    input.addEventListener('input', renderDropdown);

    if (dropdown) {
        dropdown.addEventListener('mousedown', (e) => {
            e.preventDefault();
            const item = e.target.closest('[data-code]');
            if (item) {
                selectedPIItemCode = item.dataset.code;
                selectedPIItemDesc = item.dataset.desc;
                input.value = `${selectedPIItemCode} - ${selectedPIItemDesc}`;
                dropdown.classList.add('hidden');
            }
        });
    }
    document.addEventListener('click', (e) => {
        if (dropdown && !input.contains(e.target) && !dropdown.contains(e.target)) dropdown.classList.add('hidden');
    });
}

export function addPIItem() {
    if (!hasAnyRole(['admin', 'manager', 'employee'])) { showToast('No permission', 'error'); return; }
    if (!selectedPIItemCode) { alert('Please select a product'); return; }
    const qty = parseFloat(document.getElementById('pi-item-qty')?.value);
    if (!qty || qty <= 0) { alert('Please enter valid quantity'); return; }

    const gtin = recipeItemMap[selectedPIItemCode]?.gtin || '';
    const weight = parseFloat(document.getElementById('pi-item-weight')?.value) || 0;
    const unitPrice = document.getElementById('pi-item-unit-price')?.value?.trim() || '';
    const up = parseFloat(unitPrice.replace(/[^0-9.-]/g, '')) || 0;
    const total = up > 0 && qty > 0 ? (up * qty).toFixed(2) : '';

    wizardState.piItems.push({
        item_code: selectedPIItemCode, description: selectedPIItemDesc,
        gtin, unit: 'CS', qty_cases: qty, pallet_types: [], weight,
        unit_price: unitPrice, total_price: total,
    });

    // Clear form
    ['pi-item-search', 'pi-item-qty', 'pi-item-weight', 'pi-item-unit-price'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    selectedPIItemCode = '';
    selectedPIItemDesc = '';
    renderPIItems();
}

export function removePIItem(index) {
    wizardState.piItems.splice(index, 1);
    if (wizardState.joItems.length > index) wizardState.joItems.splice(index, 1);
    editingPIItemIndex = -1;
    renderPIItems();
}

export function editPIItem(index) { editingPIItemIndex = index; renderPIItems(); }
export function cancelPIItemEdit() { editingPIItemIndex = -1; renderPIItems(); }

export function togglePIPallet(index, code, checked) {
    const item = wizardState.piItems[index];
    if (!item) return;
    if (!Array.isArray(item.pallet_types)) item.pallet_types = [];
    const has = item.pallet_types.includes(code);
    if (checked && !has) item.pallet_types.push(code);
    else if (!checked && has) item.pallet_types = item.pallet_types.filter(c => c !== code);
    const jo = wizardState.joItems[index];
    if (jo) {
        jo.pallet_types = [...item.pallet_types];
        if (!jo.pallet_quantities || typeof jo.pallet_quantities !== 'object') jo.pallet_quantities = {};
        if (checked && !(code in jo.pallet_quantities)) jo.pallet_quantities[code] = 0;
        if (!checked && code in jo.pallet_quantities) delete jo.pallet_quantities[code];
        if (!checked && Array.isArray(jo._user_edited_pallets)) {
            jo._user_edited_pallets = jo._user_edited_pallets.filter(c => c !== code);
        }
        _autoCalcPallets(jo);
    }
}

export function updatePalletQuantity(index, code, value) {
    const item = wizardState.joItems[index];
    if (!item) return;
    if (!item.pallet_quantities || typeof item.pallet_quantities !== 'object') item.pallet_quantities = {};
    const n = parseInt(value, 10);
    item.pallet_quantities[code] = (isNaN(n) || n < 0) ? 0 : n;
    if (!Array.isArray(item._user_edited_pallets)) item._user_edited_pallets = [];
    if (!item._user_edited_pallets.includes(code)) item._user_edited_pallets.push(code);
}

// Bulk: replace every PI row's pallet selection with a single type.
// Clears user-edit flags on JO side so auto-calc runs fresh for everyone.
export function bulkApplyPallet(code) {
    if (!PALLET_TYPES.find(p => p.code === code)) return;
    for (const pi of wizardState.piItems) {
        pi.pallet_types = [code];
    }
    for (let i = 0; i < wizardState.piItems.length; i++) {
        const jo = wizardState.joItems[i];
        if (jo) jo._user_edited_pallets = [];
        _syncPIToJO(i);
    }
    renderPIItems();
}

export function bulkClearPallets() {
    for (const pi of wizardState.piItems) pi.pallet_types = [];
    for (let i = 0; i < wizardState.piItems.length; i++) {
        const jo = wizardState.joItems[i];
        if (jo) jo._user_edited_pallets = [];
        _syncPIToJO(i);
    }
    renderPIItems();
}

function _buildRecipeOptions(selectedCode) {
    const seen = new Set();
    let opts = '<option value="">-- Select product --</option>';
    const entries = Object.values(recipeItemMap).filter(e => {
        if (!e.item_code || seen.has(e.item_code)) return false;
        seen.add(e.item_code);
        return true;
    });
    entries.sort((a, b) => (a.item_code || '').localeCompare(b.item_code || ''));
    for (const e of entries) {
        const sel = e.item_code === selectedCode ? ' selected' : '';
        const gtinTag = e.gtin ? ` (${e.gtin})` : '';
        opts += `<option value="${e.item_code}"${sel}>${e.item_code} - ${e.recipe_name || e.item_code}${gtinTag}</option>`;
    }
    return opts;
}

function _getRecipeEntries() {
    const seen = new Set();
    const entries = Object.values(recipeItemMap).filter(e => {
        if (!e.item_code || seen.has(e.item_code)) return false;
        seen.add(e.item_code);
        return true;
    });
    entries.sort((a, b) => (a.item_code || '').localeCompare(b.item_code || ''));
    return entries;
}

function _buildSearchableRecipeWidget(idPrefix, selectedCode) {
    const entries = _getRecipeEntries();
    const selected = entries.find(e => e.item_code === selectedCode);
    const displayText = selected
        ? `${selected.item_code} - ${selected.recipe_name || selected.item_code}`
        : '';
    return `<div class="relative" id="${idPrefix}-wrap">
        <input type="hidden" id="${idPrefix}-value" value="${selectedCode || ''}">
        <input type="text" id="${idPrefix}-search" value="${displayText.replace(/"/g, '&quot;')}"
            class="w-full border rounded px-1 py-1 text-xs" placeholder="Type to search product..."
            autocomplete="off">
        <div id="${idPrefix}-dropdown"
            class="hidden absolute left-0 right-0 bg-white border border-slate-200 rounded shadow-lg max-h-48 overflow-y-auto"
            style="top:100%; z-index:100;"></div>
    </div>`;
}

function _initInlineRecipeSearch(idPrefix, onChange) {
    const searchInput = document.getElementById(`${idPrefix}-search`);
    const hiddenInput = document.getElementById(`${idPrefix}-value`);
    const dropdown = document.getElementById(`${idPrefix}-dropdown`);
    if (!searchInput || !hiddenInput || !dropdown) return;

    const entries = _getRecipeEntries();

    const renderList = () => {
        const filter = (searchInput.value || '').toLowerCase();
        const matches = entries.filter(e =>
            !filter ||
            e.item_code.toLowerCase().includes(filter) ||
            (e.recipe_name || '').toLowerCase().includes(filter) ||
            (e.gtin || '').toLowerCase().includes(filter)
        );
        if (matches.length === 0) {
            dropdown.innerHTML = '<div class="px-3 py-2 text-xs text-slate-400 text-center">No items found</div>';
        } else {
            dropdown.innerHTML = matches.map(e => {
                const gtinTag = e.gtin ? ` <span class="text-slate-400">(${e.gtin})</span>` : '';
                const isActive = e.item_code === hiddenInput.value;
                return `<div class="px-3 py-1.5 text-xs cursor-pointer truncate ${isActive ? 'bg-blue-100 font-semibold' : 'hover:bg-blue-50'} text-slate-800"
                    data-code="${e.item_code}" data-name="${(e.recipe_name || e.item_code).replace(/"/g, '&quot;')}">${e.item_code} - ${e.recipe_name || e.item_code}${gtinTag}</div>`;
            }).join('');
        }
        dropdown.classList.remove('hidden');
    };

    searchInput.addEventListener('focus', () => { searchInput.select(); renderList(); });
    searchInput.addEventListener('input', renderList);

    dropdown.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        const row = ev.target.closest('[data-code]');
        if (!row) return;
        hiddenInput.value = row.dataset.code;
        searchInput.value = `${row.dataset.code} - ${row.dataset.name}`;
        dropdown.classList.add('hidden');
        if (onChange) onChange(row.dataset.code);
    });

    document.addEventListener('click', function _closeDropdown(ev) {
        if (!searchInput.contains(ev.target) && !dropdown.contains(ev.target)) {
            dropdown.classList.add('hidden');
        }
    });
}

function _uomFromCode(code) {
    const prefix = (code || '').substring(0, 3);
    if (['202', '204'].includes(prefix)) return 'CAN';
    if (['301', '302', '303'].includes(prefix)) return 'PET';
    return 'CS';
}

export function savePIItemEdit(index) {
    const item = wizardState.piItems[index];
    if (!item) return;
    const g = (id) => document.getElementById(id)?.value;
    const selCode = g(`edit-pi-recipe-${index}-value`);
    if (selCode) {
        const entry = recipeItemMap[selCode] || {};
        item.item_code = selCode;
        item.description = entry.recipe_name || entry.item_code || selCode;
        item.gtin = entry.gtin || '';
    }
    item.unit = g(`edit-pi-unit-${index}`) || item.unit;
    item.qty_cases = parseFloat(g(`edit-pi-qty-${index}`)) || 0;
    item.weight = parseFloat(g(`edit-pi-weight-${index}`)) || 0;
    item.unit_price = g(`edit-pi-unitprice-${index}`) || '';
    const up = parseFloat(String(item.unit_price).replace(/[^0-9.-]/g, '')) || 0;
    item.total_price = up > 0 && item.qty_cases > 0 ? (up * item.qty_cases).toFixed(2) : g(`edit-pi-total-${index}`) || '';

    // Forward-sync to Step 3 JO item
    _syncPIToJO(index);

    editingPIItemIndex = -1;
    wizardState.piItemsHash = '';
    renderPIItems();
}

function _syncPIToJO(index) {
    const pi = wizardState.piItems[index];
    if (!pi) return;
    const jo = wizardState.joItems[index];
    if (!jo) return;
    const entry = recipeItemMap[pi.item_code] || {};
    jo.item_code = pi.item_code;
    jo.description = pi.description;
    jo.gtin = pi.gtin;
    jo.cases = pi.qty_cases;
    jo.quantity = pi.qty_cases;
    jo.ml = entry.ml || jo.ml || 0;
    jo.pcs = jo.ml === 2500 ? 6 : 24;
    jo.uom = _uomFromCode(pi.item_code);
    jo.rtd = jo.cases > 0 && jo.ml > 0 ? jo.cases * jo.ml : 0;
    jo.pallet_types = [...(pi.pallet_types || [])];
    if (!jo.pallet_quantities || typeof jo.pallet_quantities !== 'object') jo.pallet_quantities = {};
    for (const k of Object.keys(jo.pallet_quantities)) {
        if (!jo.pallet_types.includes(k)) delete jo.pallet_quantities[k];
    }
    for (const c of jo.pallet_types) {
        if (!(c in jo.pallet_quantities)) jo.pallet_quantities[c] = 0;
    }
    if (Array.isArray(jo._user_edited_pallets)) {
        jo._user_edited_pallets = jo._user_edited_pallets.filter(c => jo.pallet_types.includes(c));
    }
    _autoCalcPallets(jo);
}

function renderPIItems() {
    const tbody = document.getElementById('pi-items-table');
    const countEl = document.getElementById('pi-items-count');
    if (!tbody) return;
    const items = wizardState.piItems;
    const totalCases = items.reduce((s, i) => s + (i.qty_cases || 0), 0);
    if (countEl) countEl.textContent = `${items.length} item${items.length !== 1 ? 's' : ''} | ${totalCases.toLocaleString(undefined, { minimumFractionDigits: 1 })} cases`;
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="px-4 py-8 text-center text-slate-400 text-sm">No products added yet.</td></tr>';
        return;
    }
    const currency = wizardState.currency || 'AED';
    const fp = (v) => {
        if (!v && v !== 0) return '-';
        const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
        if (isNaN(n) || n === 0) return v || '-';
        return currency === 'USD' ? `$${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : `AED ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    };
    tbody.innerHTML = items.map((item, idx) => {
        if (editingPIItemIndex === idx) {
            const rawUp = String(item.unit_price || '').replace(/[^0-9.-]/g, '');
            const rawTp = String(item.total_price || '').replace(/[^0-9.-]/g, '');
            return `<tr class="bg-blue-50">
                <td class="px-3 py-2 text-center">${idx + 1}</td>
                <td class="px-3 py-2">${_buildSearchableRecipeWidget(`edit-pi-recipe-${idx}`, item.item_code)}</td>
                <td class="px-3 py-2"><span id="edit-pi-gtin-${idx}" class="text-xs text-slate-500">${item.gtin || '-'}</span></td>
                <td class="px-3 py-2"><input type="text" id="edit-pi-unit-${idx}" value="${item.unit || 'CS'}" class="w-16 border rounded px-1 py-1 text-xs text-center"></td>
                <td class="px-3 py-2"><input type="number" id="edit-pi-qty-${idx}" value="${item.qty_cases || 0}" class="w-20 border rounded px-1 py-1 text-xs text-right font-bold" min="0" step="any"></td>
                <td class="px-3 py-2">${_palletCheckboxesHtml(idx, item.pallet_types)}</td>
                <td class="px-3 py-2"><input type="number" id="edit-pi-weight-${idx}" value="${item.weight || 0}" class="w-16 border rounded px-1 py-1 text-xs text-right" min="0" step="any"></td>
                <td class="px-3 py-2"><input type="text" id="edit-pi-unitprice-${idx}" value="${rawUp}" class="w-20 border rounded px-1 py-1 text-xs text-right" step="any"></td>
                <td class="px-3 py-2"><input type="text" id="edit-pi-total-${idx}" value="${rawTp}" class="w-20 border rounded px-1 py-1 text-xs text-right" step="any"></td>
                <td class="px-3 py-2 text-center">
                    <button onclick="savePIItemEdit(${idx})" class="text-green-500 hover:text-green-700" title="Save"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></button>
                    <button onclick="cancelPIItemEdit()" class="text-gray-500 hover:text-gray-700 ml-1" title="Cancel"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                </td>
            </tr>`;
        }
        return `<tr class="hover:bg-gray-50">
            <td class="px-3 py-2 text-center">${idx + 1}</td>
            <td class="px-3 py-2 font-medium">${item.item_code} - ${item.description}</td>
            <td class="px-3 py-2 text-center text-slate-500">${item.gtin || '-'}</td>
            <td class="px-3 py-2 text-center">${item.unit}</td>
            <td class="px-3 py-2 text-right font-bold">${(item.qty_cases || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}</td>
            <td class="px-3 py-2">${_palletCheckboxesHtml(idx, item.pallet_types)}</td>
            <td class="px-3 py-2 text-right">${item.weight || '-'}</td>
            <td class="px-3 py-2 text-right">${fp(item.unit_price)}</td>
            <td class="px-3 py-2 text-right font-medium">${fp(item.total_price)}</td>
            <td class="px-3 py-2 text-center">
                <button onclick="editPIItem(${idx})" class="text-blue-500 hover:text-blue-700 mr-1" title="Edit"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                <button onclick="removePIItem(${idx})" class="text-red-500 hover:text-red-700" title="Delete"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            </td>
        </tr>`;
    }).join('');

    if (editingPIItemIndex >= 0) {
        const idx = editingPIItemIndex;
        _initInlineRecipeSearch(`edit-pi-recipe-${idx}`, (code) => {
            const entry = recipeItemMap[code] || {};
            const gtinSpan = document.getElementById(`edit-pi-gtin-${idx}`);
            if (gtinSpan) gtinSpan.textContent = entry.gtin || '-';
        });
    }
}

export function onPIRecipeChange(index) {
    const hiddenInput = document.getElementById(`edit-pi-recipe-${index}-value`);
    const gtinSpan = document.getElementById(`edit-pi-gtin-${index}`);
    if (!hiddenInput) return;
    const entry = recipeItemMap[hiddenInput.value] || {};
    if (gtinSpan) gtinSpan.textContent = entry.gtin || '-';
}

// ============================================================================
// Step 3: JO Requirements (auto-derived from PI items + recipes)
// ============================================================================

function _deriveJOItemsFromPI() {
    const hash = _piHash();
    if (hash === wizardState.piItemsHash && wizardState.joItems.length > 0) return;
    wizardState.piItemsHash = hash;

    const prevByCode = {};
    for (const old of wizardState.joItems) {
        if (old && old.item_code) prevByCode[old.item_code] = old;
    }

    wizardState.joItems = wizardState.piItems.map(pi => {
        const code = pi.item_code;
        const entry = recipeItemMap[code] || {};
        const mlVal = entry.ml || 0;
        const pcs = mlVal === 2500 ? 6 : 24;
        const cases = pi.qty_cases || 0;
        const rtd = cases > 0 && mlVal > 0 ? cases * mlVal : 0;

        let uom = 'CS';
        const prefix = (code || '').substring(0, 3);
        if (['202', '204'].includes(prefix)) uom = 'CAN';
        else if (['301', '302', '303'].includes(prefix)) uom = 'PET';

        const types = [...(pi.pallet_types || [])];
        const prev = prevByCode[code] || {};
        const prevQty = prev.pallet_quantities || {};
        const pallet_quantities = {};
        for (const c of types) pallet_quantities[c] = Number(prevQty[c]) || 0;
        const prevEdited = Array.isArray(prev._user_edited_pallets) ? prev._user_edited_pallets : [];
        const _user_edited_pallets = prevEdited.filter(c => types.includes(c));

        const jo = {
            item_code: code, description: pi.description,
            uom, ml: mlVal, pcs, cases,
            containers: 0, quantity: cases,
            rtd,
            pallet_types: types,
            pallet_quantities,
            _user_edited_pallets,
            gl_number: '', gtin: pi.gtin || entry.gtin || '',
            unit_price: pi.unit_price || '', total_amount: pi.total_price || '',
        };
        _autoCalcPallets(jo);
        return jo;
    });
}

export function renderJOItems() {
    const tbody = document.getElementById('jo-items-table');
    const countEl = document.getElementById('jo-items-count');
    if (!tbody) return;
    const items = wizardState.joItems;
    const totalCases = items.reduce((s, i) => s + (i.cases || 0), 0);
    if (countEl) countEl.textContent = `${items.length} item${items.length !== 1 ? 's' : ''} | ${totalCases.toLocaleString(undefined, { minimumFractionDigits: 1 })} cases`;
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="14" class="px-4 py-8 text-center text-slate-400 text-sm">No items yet.</td></tr>';
        return;
    }
    tbody.innerHTML = items.map((item, idx) => {
        const isEditing = editingJOItemIndex === idx;
        const identityCells = isEditing
            ? `<td class="px-2 py-2" colspan="2">${_buildSearchableRecipeWidget(`edit-jo-recipe-${idx}`, item.item_code)}</td>`
            : `<td class="px-2 py-2 font-medium">${item.item_code || ''}</td>
               <td class="px-2 py-2">${item.description || ''}</td>`;
        const actionCell = isEditing
            ? `<td class="px-2 py-2 text-center">
                    <button onclick="saveJOItem(${idx})" class="text-green-500 hover:text-green-700" title="Save"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg></button>
                    <button onclick="cancelEditJOItem()" class="text-gray-500 hover:text-gray-700 ml-1" title="Cancel"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                </td>`
            : `<td class="px-2 py-2 text-center">
                    <button onclick="editJOItem(${idx})" class="text-blue-500 hover:text-blue-700" title="Change product"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
                    <button onclick="removeJOItem(${idx})" class="text-red-500 hover:text-red-700 ml-1" title="Delete"><svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                </td>`;
        const rowClass = isEditing ? 'bg-blue-50' : 'hover:bg-gray-50';
        return `<tr class="${rowClass}">
            <td class="px-2 py-2 text-center">${idx + 1}</td>
            ${identityCells}
            <td class="px-2 py-2 text-center text-slate-500"><span id="edit-jo-gtin-${idx}">${item.gtin || '-'}</span></td>
            <td class="px-2 py-2 text-center">${item.uom || '-'}</td>
            <td class="px-2 py-2 text-center">${item.ml || 0}</td>
            <td class="px-2 py-2 text-center">${item.pcs || 0}</td>
            <td class="px-2 py-2 text-right font-bold">${(item.cases || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}</td>
            <td class="px-2 py-2 text-center text-slate-600">${item.containers || 0}</td>
            <td class="px-2 py-2 text-right">${(item.quantity || 0).toLocaleString(undefined, { minimumFractionDigits: 1 })}</td>
            <td class="px-2 py-2 text-right">${(item.rtd || 0) > 0 ? Number(item.rtd).toLocaleString(undefined, { minimumFractionDigits: 1 }) : '0.0'}</td>
            <td class="px-2 py-2">${_palletQtyInputsHtml(idx, item.pallet_types, item.pallet_quantities)}</td>
            <td class="px-2 py-2 text-xs text-slate-500">${item.gl_number || ''}</td>
            ${actionCell}
        </tr>`;
    }).join('');

    if (editingJOItemIndex >= 0) {
        const idx = editingJOItemIndex;
        _initInlineRecipeSearch(`edit-jo-recipe-${idx}`, (code) => {
            const entry = recipeItemMap[code] || {};
            const gtinSpan = document.getElementById(`edit-jo-gtin-${idx}`);
            if (gtinSpan) gtinSpan.textContent = entry.gtin || '-';
        });
    }
}

export function editJOItem(index) { editingJOItemIndex = index; renderJOItems(); }
export function cancelEditJOItem() { editingJOItemIndex = -1; renderJOItems(); }

export function saveJOItem(index) {
    const g = (id) => document.getElementById(id)?.value;
    const item = wizardState.joItems[index];
    if (!item) return;

    const selCode = g(`edit-jo-recipe-${index}-value`);
    if (selCode) {
        const entry = recipeItemMap[selCode] || {};
        item.item_code = selCode;
        item.description = entry.recipe_name || entry.item_code || selCode;
        item.gtin = entry.gtin || '';
        item.uom = _uomFromCode(selCode);
        item.ml = entry.ml || 0;
        item.pcs = item.ml === 2500 ? 6 : 24;
        item.rtd = (item.cases > 0 && item.ml > 0) ? item.cases * item.ml : 0;
    }

    _syncJOToPI(index);

    editingJOItemIndex = -1;
    renderJOItems();
}

function _syncJOToPI(index) {
    const jo = wizardState.joItems[index];
    if (!jo) return;
    const pi = wizardState.piItems[index];
    if (!pi) return;
    pi.item_code = jo.item_code;
    pi.description = jo.description;
    pi.gtin = jo.gtin;
}

export function onJORecipeChange(index) {
    const hiddenInput = document.getElementById(`edit-jo-recipe-${index}-value`);
    const gtinSpan = document.getElementById(`edit-jo-gtin-${index}`);
    if (!hiddenInput) return;
    const code = hiddenInput.value;
    const entry = recipeItemMap[code] || {};
    if (gtinSpan) gtinSpan.textContent = entry.gtin || '-';
    const mlInput = document.getElementById(`edit-ml-${index}`);
    const pcsInput = document.getElementById(`edit-pcs-${index}`);
    const uomInput = document.getElementById(`edit-uom-${index}`);
    if (mlInput && entry.ml) mlInput.value = entry.ml;
    if (pcsInput) pcsInput.value = (entry.ml === 2500 ? 6 : 24);
    if (uomInput) uomInput.value = _uomFromCode(code);
}

export function removeJOItem(index) {
    wizardState.joItems.splice(index, 1);
    if (wizardState.piItems.length > index) wizardState.piItems.splice(index, 1);
    editingJOItemIndex = -1;
    renderJOItems();
}

// ============================================================================
// Step 4: Inventory Allocation
// ============================================================================

async function _loadInventoryForAllocation() {
    const container = document.getElementById('inventory-check-items');
    if (!container) return;
    container.innerHTML = '<p class="text-sm text-slate-400 text-center py-8">Loading inventory data...</p>';
    try {
        const [invResp, resResp] = await Promise.all([
            authenticatedFetch('/api/finished-goods-inventory'),
            authenticatedFetch('/api/stock-reservations/totals'),
        ]);
        const inventory = await invResp.json();
        const reservedData = await resResp.json();
        const reservedTotals = reservedData.totals || {};
        const inventoryMap = {};
        inventory.forEach(item => {
            const code = item['Item Code'] || item['item_code'] || '';
            const qty = parseFloat(item['Qty On Hand'] || item['qty_on_hand'] || 0);
            const reserved = reservedTotals[code] || 0;
            inventoryMap[code] = Math.max(0, qty - reserved);
        });
        _displayAllocations(inventoryMap);
    } catch (error) {
        console.error('Inventory check error:', error);
        container.innerHTML = '<p class="text-sm text-red-500 text-center py-8">Error loading inventory data.</p>';
    }
}

function _displayAllocations(inventoryMap) {
    const container = document.getElementById('inventory-check-items');
    if (!container) return;
    container.innerHTML = '';
    wizardState.joItems.forEach((item, index) => {
        const requested = item.cases || 0;
        const available = inventoryMap[item.item_code] || 0;
        const allocateFromStock = Math.min(requested, available);
        const needsProduction = Math.max(0, requested - allocateFromStock);
        const gtin = item.gtin || '';
        const gtinTag = gtin ? `<span class="ml-2 text-xs text-slate-400 font-normal">(${gtin})</span>` : '';
        const div = document.createElement('div');
        div.className = 'bg-white p-4 rounded-lg border border-blue-200';
        div.innerHTML = `<div class="flex items-start justify-between gap-4">
            <div class="flex-1">
                <div class="font-semibold text-slate-800"><span class="text-slate-400 mr-1">${index + 1}.</span>${item.item_code}${gtinTag}</div>
                <div class="text-sm text-slate-600">${item.description}</div>
            </div>
            <div class="flex gap-6 text-sm">
                <div><div class="text-xs text-slate-500 font-medium mb-1">Requested</div><div class="font-bold text-slate-900">${requested.toFixed(4)}</div></div>
                <div><div class="text-xs text-slate-500 font-medium mb-1">Available (net)</div><div class="font-bold ${available > 0 ? 'text-green-600' : 'text-red-600'}">${available.toFixed(4)}</div></div>
                <div><div class="text-xs text-slate-500 font-medium mb-1">Use from Stock</div>
                    <input type="number" id="allocate-${index}" value="${allocateFromStock.toFixed(4)}" max="${available}" min="0" step="0.0001"
                        onchange="updateProductionNeeded(${index}, ${requested}, ${available})"
                        class="w-24 px-2 py-1 border border-slate-300 rounded text-center font-bold text-blue-600"></div>
                <div><div class="text-xs text-slate-500 font-medium mb-1">To Produce</div>
                    <input type="number" id="produce-${index}" value="${needsProduction.toFixed(4)}" min="0" step="0.0001"
                        onchange="updateStockFromProduction(${index}, ${requested}, ${available})"
                        class="w-24 px-2 py-1 border border-slate-300 rounded text-center font-bold ${needsProduction > 0 ? 'text-orange-600' : 'text-green-600'}"></div>
                <div><div class="text-xs text-slate-500 font-medium mb-1">Priority</div>
                    <select id="priority-${index}"
                        class="w-28 px-2 py-1 border border-slate-300 rounded text-center font-semibold text-slate-700">
                        <option value="normal">Normal</option>
                        <option value="urgent">Urgent</option>
                    </select></div>
            </div>
        </div>`;
        container.appendChild(div);
    });
}

export function updateProductionNeeded(index, requested, available) {
    const input = document.getElementById(`allocate-${index}`);
    const produceInput = document.getElementById(`produce-${index}`);
    if (!input || !produceInput) return;
    let allocate = parseFloat(input.value) || 0;
    if (allocate > available) { allocate = available; input.value = available.toFixed(4); }
    if (allocate > requested) { allocate = requested; input.value = requested.toFixed(4); }
    const needs = Math.max(0, requested - allocate);
    produceInput.value = needs.toFixed(4);
    produceInput.className = `w-24 px-2 py-1 border border-slate-300 rounded text-center font-bold ${needs > 0 ? 'text-orange-600' : 'text-green-600'}`;
}

export function updateStockFromProduction(index, requested, available) {
    const allocateInput = document.getElementById(`allocate-${index}`);
    const produceInput = document.getElementById(`produce-${index}`);
    if (!allocateInput || !produceInput) return;
    let toProduce = parseFloat(produceInput.value) || 0;
    if (toProduce < 0) { toProduce = 0; produceInput.value = '0.0000'; }
    let fromStock = Math.max(0, requested - toProduce);
    if (fromStock > available) fromStock = available;
    allocateInput.value = fromStock.toFixed(4);
    produceInput.className = `w-24 px-2 py-1 border border-slate-300 rounded text-center font-bold ${toProduce > 0 ? 'text-orange-600' : 'text-green-600'}`;
}

// ============================================================================
// Final Save (Step 3 Confirm) — persists draft only; allocation & processing
// happen downstream from the Allocation sub-tab.
// ============================================================================

export async function wizardSave() {
    if (!hasAnyRole(['admin', 'manager', 'employee'])) { showToast('No permission', 'error'); return; }
    _saveCurrentStepState();

    // New flow: drafts are saved without allocation. The Allocation sub-tab
    // collects from_stock / to_produce per item and creates the JO from there.
    // Preserve any allocation data carried over from an edited draft so we
    // don't silently wipe pre-existing entries during a draft edit.
    const inventoryAllocations = (wizardState.allocations && wizardState.allocations.length)
        ? wizardState.allocations.map(a => ({ ...a }))
        : [];

    const saveBtn = document.getElementById('wizard-btn-save');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<svg class="animate-spin h-5 w-5 mr-2 inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>Saving...'; }

    try {
        // Save draft only — no PI, no Summary, no JO PDFs, no document_links, no reservations.
        // All PDFs + side effects are deferred to Process (approve draft).
        const payload = {
            jo_number: '', date: wizardState.date, customer: wizardState.customer,
            address: wizardState.address, customer_ref: wizardState.poNumber,
            customer_auto_ref: wizardState.customerRef,
            total_pallets: 0, total_containers: 0,
            notes: wizardState.notes,
            entered_by: document.getElementById('jo-entered-by')?.textContent || '',
            currency: wizardState.currency,
            local_export_type: wizardState.localExportType,
            items: wizardState.joItems.map(i => ({ ...i, rtd: String(i.rtd || '') })),
            inventory_allocations: inventoryAllocations,
            po_filename: (wizardState.uploadedPOFilenames && wizardState.uploadedPOFilenames[0]) || null,
            po_filenames: wizardState.uploadedPOFilenames || [],
            pi_items: wizardState.piItems,
            source: 'po_processing',
        };

        const isDraftEdit = !!wizardState.draftId;
        const saveUrl = isDraftEdit ? `/api/job-orders/${wizardState.draftId}` : '/api/job-orders';
        const saveMethod = isDraftEdit ? 'PUT' : 'POST';
        const saveResp = await authenticatedFetch(saveUrl, {
            method: saveMethod, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        });
        if (!saveResp.ok) { const err = await saveResp.json().catch(() => ({})); throw new Error(err.detail || 'Failed to save'); }
        showToast('Draft saved. Open the Draft tab, then Process to move items into Allocation.', 'success');

        // 4) Auto-create customer if new
        if (!customersData[wizardState.customer]) {
            try {
                await authenticatedFetch('/api/customers', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: wizardState.customer, address: wizardState.address, customer_ref: wizardState.customerRef, market: wizardState.market }),
                });
                await loadCustomersDropdown();
            } catch (e) { console.error('Auto-create customer failed:', e); }
        }

        clearWizard();
    } catch (error) {
        console.error('Save error:', error);
        alert('Error: ' + error.message);
    } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Confirm & Save'; }
    }
}

// ============================================================================
// Saved Summary Sheets Sub-Tab
// ============================================================================

const _ICON_BTN_CLS = 'p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition inline-flex items-center justify-center';
const _ICON_BTN_DANGER = 'p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 transition inline-flex items-center justify-center';
const _ICON_BTN_PRIMARY = 'p-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition inline-flex items-center justify-center';
const _ICON_BTN_SUCCESS = 'p-1.5 rounded-lg border border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 transition inline-flex items-center justify-center';

const _SVG = {
    chevronDown: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>',
    eye: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>',
    docText: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>',
    docDuplicate: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>',
    pencil: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>',
    play: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
    trash: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>',
};

export function toggleDraftItems(rowId, btn) {
    const el = document.getElementById(rowId);
    if (!el) return;
    const isHidden = el.classList.toggle('hidden');
    if (btn) {
        btn.classList.toggle('rotate-180', !isHidden);
    }
}

function _buildItemsRow(jo, rowId, colspan) {
    const items = jo.items || [];
    const rows = items.map((it, idx) => {
        const gtin = it.gtin || recipeItemMap[it.item_code]?.gtin || '';
        const cases = (it.cases || 0).toLocaleString(undefined, { minimumFractionDigits: 2 });
        return `<tr class="border-b border-slate-100 last:border-0">
            <td class="py-1 pr-2 text-slate-400 w-8">${idx + 1}.</td>
            <td class="py-1 pr-2 font-mono text-slate-700">${it.item_code || ''}</td>
            <td class="py-1 pr-2 text-slate-400 font-mono text-[11px]">${gtin || '-'}</td>
            <td class="py-1 pr-2 text-slate-600">${it.description || ''}</td>
            <td class="py-1 text-right font-medium text-slate-700 whitespace-nowrap">${cases} cs</td>
        </tr>`;
    }).join('');
    return `<tr id="${rowId}" class="hidden bg-slate-50">
        <td colspan="${colspan}" class="px-4 py-3">
            <table class="w-full text-xs">
                <thead><tr class="text-slate-500 text-[10px] uppercase tracking-wider">
                    <th class="text-left pb-1 pr-2 w-8">#</th>
                    <th class="text-left pb-1 pr-2">Item Code</th>
                    <th class="text-left pb-1 pr-2">GTIN</th>
                    <th class="text-left pb-1 pr-2">Description</th>
                    <th class="text-right pb-1">Cases</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </td>
    </tr>`;
}

function _buildActionToolbar(jo, { includeEdit }) {
    const id = jo.id;
    const summaryRef = jo.summary_ref || '';
    const isDraft = jo.status === 'draft';
    const viewBtn = isDraft ? '' : `<button onclick="downloadSummaryPDFByRef('${summaryRef}')" class="${_ICON_BTN_CLS}" title="View Summary PDF">${_SVG.eye}</button>`;
    const joSummaryBtn = `<button onclick="downloadJOSummaryPDF('${id}')" class="${_ICON_BTN_CLS}" title="Download JO Summary (per-PO breakdown)">${_SVG.docText}</button>`;
    const mergedBtn = isDraft ? '' : `<button onclick="downloadDraftMergedPDF('${id}')" class="${_ICON_BTN_CLS}" title="Download All (merged PDF)">${_SVG.docDuplicate}</button>`;
    const editBtn = includeEdit ? `<button onclick="editDraft('${id}')" class="${_ICON_BTN_PRIMARY}" title="Edit in wizard">${_SVG.pencil}</button>` : '';
    const processBtn = isDraft ? `<button onclick="processDraftToAllocation('${id}')" class="${_ICON_BTN_SUCCESS}" title="Process Draft — move to Allocation">${_SVG.play}</button>` : '';
    const deleteBtn = hasAnyRole(['admin', 'manager']) ? `<button onclick="deleteJobOrder('${id}')" class="${_ICON_BTN_DANGER}" title="Delete">${_SVG.trash}</button>` : '';
    return `<div class="flex items-center justify-center gap-1 flex-wrap">${viewBtn}${joSummaryBtn}${mergedBtn}${editBtn}${processBtn}${deleteBtn}</div>`;
}

export async function renderSavedJobOrders() {
    const tbody = document.getElementById('saved-job-orders-list');
    if (!tbody) return;
    try {
        const resp = await authenticatedFetch('/api/job-orders?limit=100&source=po_processing');
        if (!resp.ok) {
            const errText = await resp.text().catch(() => '');
            throw new Error(errText || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        const orders = (data.orders || []).filter(jo => jo.status !== 'draft');
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-12 text-center text-slate-400">No summary sheets saved yet</td></tr>';
            return;
        }
        tbody.innerHTML = orders.map(jo => {
            const items = jo.items || [];
            const allocs = jo.inventory_allocations || [];
            const totalCases = items.reduce((s, i) => s + (i.cases || 0), 0);
            const totalToProduce = allocs.reduce((s, a) => s + (a.to_produce || 0), 0);
            const statusColors = { draft: 'bg-slate-100 text-slate-700', processed: 'bg-green-100 text-green-800', dispatching: 'bg-amber-100 text-amber-800', completed: 'bg-blue-100 text-blue-800', cancelled: 'bg-red-100 text-red-700' };
            const statusCls = statusColors[jo.status] || statusColors.draft;
            const closedTitle = jo.closed_at ? ` title="Closed at ${new Date(jo.closed_at).toLocaleString('en-GB', { hour12: false })}"` : '';
            const date = jo.jo_date ? new Date(jo.jo_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
            const produceColor = totalToProduce > 0 ? 'text-orange-600' : 'text-green-600';
            const itemsRowId = `saved-items-${jo.id}`;
            const expandBtn = `<button onclick="toggleDraftItems('${itemsRowId}', this)" class="${_ICON_BTN_CLS} transition-transform" title="Expand items">${_SVG.chevronDown}</button>`;
            const toolbar = _buildActionToolbar(jo, { includeEdit: false });
            return `<tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">
                    <div class="flex items-center gap-2">${expandBtn}<span>${jo.summary_ref || '-'}</span></div>
                </td>
                <td class="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">${date}</td>
                <td class="px-4 py-3 text-sm text-slate-500">${jo.customer_name || '-'}</td>
                <td class="px-4 py-3 text-sm text-slate-700 font-semibold">${items.length} items (${totalCases.toLocaleString(undefined, { minimumFractionDigits: 2 })} cs)</td>
                <td class="px-4 py-3 text-center text-sm font-bold ${produceColor}">${totalToProduce > 0 ? totalToProduce.toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' cs' : '—'}</td>
                <td class="px-4 py-3 text-center"><span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusCls}"${closedTitle}>${jo.status}</span></td>
                <td class="px-4 py-3 text-center text-sm">${toolbar}</td>
            </tr>` + _buildItemsRow(jo, itemsRowId, 7);
        }).join('');
    } catch (error) {
        console.error('Error loading saved orders:', error);
        const msg = (error?.message || 'unknown').replace(/</g, '&lt;');
        tbody.innerHTML = `<tr><td colspan="7" class="px-6 py-8 text-center text-red-500">Error loading saved orders: ${msg}</td></tr>`;
    }
}

export async function loadDraftsList() {
    const tbody = document.getElementById('drafts-list');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-slate-400">Loading…</td></tr>';
    try {
        const resp = await authenticatedFetch('/api/job-orders?limit=100&source=po_processing&status=draft');
        if (!resp.ok) throw new Error('Failed to fetch');
        const data = await resp.json();
        const orders = data.orders || [];
        if (orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-12 text-center text-slate-400">No drafts yet</td></tr>';
            return;
        }
        tbody.innerHTML = orders.map(jo => {
            const items = jo.items || [];
            const allocs = jo.inventory_allocations || [];
            const totalCases = items.reduce((s, i) => s + (i.cases || 0), 0);
            const totalToProduce = allocs.reduce((s, a) => s + (a.to_produce || 0), 0);
            const date = jo.jo_date ? new Date(jo.jo_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
            const produceColor = totalToProduce > 0 ? 'text-orange-600' : 'text-green-600';
            const itemsRowId = `drafts-items-${jo.id}`;
            const expandBtn = `<button onclick="toggleDraftItems('${itemsRowId}', this)" class="${_ICON_BTN_CLS} transition-transform" title="Expand items">${_SVG.chevronDown}</button>`;
            const toolbar = _buildActionToolbar(jo, { includeEdit: true });
            return `<tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">
                    <div class="flex items-center gap-2">${expandBtn}<span>${jo.summary_ref || '-'}</span></div>
                </td>
                <td class="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">${date}</td>
                <td class="px-4 py-3 text-sm text-slate-500">${jo.customer_name || '-'}</td>
                <td class="px-4 py-3 text-sm text-slate-700 font-semibold">${items.length} items (${totalCases.toLocaleString(undefined, { minimumFractionDigits: 2 })} cs)</td>
                <td class="px-4 py-3 text-center text-sm font-bold ${produceColor}">${totalToProduce > 0 ? totalToProduce.toLocaleString(undefined, { minimumFractionDigits: 2 }) + ' cs' : '—'}</td>
                <td class="px-4 py-3 text-center text-sm">${toolbar}</td>
            </tr>` + _buildItemsRow(jo, itemsRowId, 6);
        }).join('');
    } catch (error) {
        console.error('Error loading drafts:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-red-500">Error loading drafts</td></tr>';
    }
}

export async function editDraft(id) {
    try {
        const resp = await authenticatedFetch(`/api/job-orders/${id}`);
        if (!resp.ok) throw new Error('Failed to load draft');
        const jo = await resp.json();

        clearWizard();
        await new Promise(r => setTimeout(r, 50));

        wizardState.draftId = id;
        wizardState.customer = jo.customer_name || '';
        wizardState.address = jo.address || '';
        wizardState.customerRef = jo.customer_ref || '';
        wizardState.poNumber = jo.customer_ref || '';
        wizardState.date = jo.jo_date || new Date().toISOString().split('T')[0];
        wizardState.currency = jo.currency || 'AED';
        wizardState.market = jo.market || 'ae';
        wizardState.localExportType = (jo.local_export_type === 'local' || jo.local_export_type === 'export') ? jo.local_export_type : null;
        wizardState.notes = jo.notes || '';
        wizardState.uploadedPOFilenames = Array.isArray(jo.po_filenames) && jo.po_filenames.length
            ? jo.po_filenames
            : (jo.po_filename ? [jo.po_filename] : []);
        wizardState.piItems = jo.pi_items || [];
        wizardState.joItems = (jo.items || []).map(i => ({ ...i }));
        wizardState.allocations = (jo.inventory_allocations || []).map(a => ({ ...a }));
        wizardState.piItemsHash = _piHash();

        switchPOTab('po');
        setTimeout(() => {
            const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
            setVal('jo-customer', wizardState.customer);
            setVal('jo-address', wizardState.address);
            setVal('jo-customer-ref', wizardState.customerRef);
            setVal('jo-po-number', wizardState.poNumber);
            setVal('jo-date', wizardState.date);
            setVal('jo-currency', wizardState.currency);
            setVal('jo-market', wizardState.market);
            setVal('jo-notes', wizardState.notes);
            const statusDiv = document.getElementById('jo-po-upload-status');
            if (statusDiv && wizardState.uploadedPOFilenames.length) {
                statusDiv.innerHTML = `<div class="text-xs text-slate-600">Previously uploaded: ${wizardState.uploadedPOFilenames.map(n => `<span class="inline-block bg-slate-100 border border-slate-300 rounded px-2 py-0.5 mr-1 mb-1">${n}</span>`).join('')}</div>`;
            }
            currentStep = 1;
            _showStep(1);
        }, 100);
    } catch (error) {
        console.error('Error editing draft:', error);
        showToast('Error: ' + error.message, 'error');
    }
}

export async function deleteJobOrder(id) {
    if (!hasAnyRole(['admin', 'manager'])) { showToast('No permission', 'error'); return; }
    if (!confirm('Delete this draft/summary sheet, all linked PDFs, and reservations?')) return;
    try {
        const resp = await authenticatedFetch(`/api/job-orders/${id}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error('Failed');
        showToast('Deleted successfully', 'success');
        loadDraftsList();
        renderSavedJobOrders();
    } catch (error) { showToast('Error deleting', 'error'); }
}

export async function processJobOrder(id) {
    if (!confirm('Approve this draft? This will generate the Proforma Invoice, Summary Sheet, and JO PDFs, and create stock reservations.')) return;
    try {
        const resp = await authenticatedFetch(`/api/job-orders/${id}/process`, { method: 'POST' });
        if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.detail || 'Failed to process'); }
        const result = await resp.json();
        showToast(`Approved! Summary + ${result.individual_pdfs || 0} JO PDFs generated, ${result.reservations_created || 0} reservation(s) created.`, 'success');
        if (result.download_url) {
            try {
                const dlResp = await authenticatedFetch(result.download_url);
                if (dlResp.ok) {
                    const blob = await dlResp.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = result.summary_filename || 'Summary.pdf';
                    document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); a.remove();
                }
            } catch (e) { console.error('Summary download failed:', e); }
        }
        loadDraftsList();
        renderSavedJobOrders();
    } catch (error) { showToast('Error: ' + error.message, 'error'); }
}

// ============================================================================
// Stock Reservations Sub-Tab
// ============================================================================

async function loadStockReservations() {
    const tbody = document.getElementById('stock-reservations-list');
    if (!tbody) return;
    try {
        const [resResp, invResp, totResp] = await Promise.all([
            authenticatedFetch('/api/stock-reservations?status=active'),
            authenticatedFetch('/api/finished-goods-inventory'),
            authenticatedFetch('/api/stock-reservations/totals'),
        ]);
        if (!resResp.ok) throw new Error('Failed');
        const reservations = (await resResp.json()).reservations || [];
        const inventory = invResp.ok ? await invResp.json() : [];
        const totals = totResp.ok ? (await totResp.json()).totals || {} : {};
        const sageMap = {};
        inventory.forEach(item => {
            const code = item['Item Code'] || item['item_code'] || '';
            const qty = parseFloat(item['Qty On Hand'] || item['qty_on_hand'] || 0);
            sageMap[code] = (sageMap[code] || 0) + qty;
        });
        if (reservations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-12 text-center text-slate-400">No active reservations</td></tr>';
            return;
        }
        tbody.innerHTML = reservations.map(r => {
            const sageQty = sageMap[r.item_code] || 0;
            const totalReserved = totals[r.item_code] || 0;
            const remaining = Math.max(0, sageQty - totalReserved);
            const remClass = remaining <= 0 ? 'text-red-600' : 'text-green-600';
            return `<tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm font-medium">${r.jo_number || '-'}</td>
                <td class="px-4 py-3 text-sm">${r.summary_ref || '-'}</td>
                <td class="px-4 py-3 text-sm font-mono">${r.item_code || '-'}</td>
                <td class="px-4 py-3 text-sm text-slate-600">${r.item_description || '-'}</td>
                <td class="px-4 py-3 text-sm">${r.customer || '-'}</td>
                <td class="px-4 py-3 text-sm text-right font-bold">${parseFloat(r.reserved_qty || 0).toLocaleString(undefined, { minimumFractionDigits: 4 })}</td>
                <td class="px-4 py-3 text-sm text-right">${sageQty.toLocaleString(undefined, { minimumFractionDigits: 4 })}</td>
                <td class="px-4 py-3 text-sm text-right font-bold ${remClass}">${remaining.toLocaleString(undefined, { minimumFractionDigits: 4 })}</td>
                <td class="px-4 py-3 text-center"><span class="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">${r.status}</span></td>
                <td class="px-4 py-3 text-center text-sm">
                    <button onclick="editReservation('${r.id}', ${r.reserved_qty})" class="text-blue-600 hover:text-blue-800 font-medium mr-2">Edit</button>
                    <button onclick="deleteReservation('${r.id}')" class="text-red-600 hover:text-red-800 font-medium">Delete</button>
                </td>
            </tr>`;
        }).join('');
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-8 text-center text-red-500">Error loading reservations</td></tr>';
    }
}

export async function editReservation(id, currentQty) {
    const newQty = prompt('Enter new reserved quantity:', currentQty);
    if (newQty === null) return;
    const qty = parseFloat(newQty);
    if (isNaN(qty) || qty < 0) { alert('Invalid quantity'); return; }
    try {
        const resp = await authenticatedFetch(`/api/stock-reservations/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reserved_qty: qty }),
        });
        if (!resp.ok) throw new Error('Failed');
        showToast('Reservation updated', 'success');
        loadStockReservations();
    } catch (error) { showToast('Error updating', 'error'); }
}

export async function deleteReservation(id) {
    if (!confirm('Delete this reservation?')) return;
    try {
        const resp = await authenticatedFetch(`/api/stock-reservations/${id}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error('Failed');
        showToast('Reservation deleted', 'success');
        loadStockReservations();
    } catch (error) { showToast('Error deleting', 'error'); }
}

// ============================================================================
// Document Links Sub-Tab (with PI badge support)
// ============================================================================

async function loadDocumentLinksTab() {
    const container = document.getElementById('document-links-tree');
    if (!container) return;
    try {
        const resp = await authenticatedFetch('/api/document-links?parent_type=summary_sheet');
        if (!resp.ok) throw new Error('Failed');
        const data = await resp.json();
        const links = data.links || [];
        if (links.length === 0) {
            container.innerHTML = '<p class="text-sm text-slate-400 text-center py-8">No document links yet. Save a summary sheet to create links.</p>';
            return;
        }
        const canDelete = hasAnyRole(['admin', 'manager']);
        const canViewConfidential = hasAnyRole(['admin', 'manager']);
        container.innerHTML = links.map(link => {
            const allChildren = link.children || [];
            const children = canViewConfidential ? allChildren : allChildren.filter(c => c.child_type !== 'purchase_order' && c.child_type !== 'proforma_invoice');
            const childrenHtml = children.length > 0 ? children.map(c => {
                let badgeCls = 'bg-purple-100 text-purple-800';
                let badgeLabel = 'DOC';
                if (c.child_type === 'job_order') { badgeCls = 'bg-green-100 text-green-800'; badgeLabel = 'JO'; }
                else if (c.child_type === 'purchase_order') { badgeCls = 'bg-blue-100 text-blue-800'; badgeLabel = 'PO'; }
                else if (c.child_type === 'proforma_invoice') { badgeCls = 'bg-purple-100 text-purple-800'; badgeLabel = 'PI'; }
                else if (c.child_type === 'jo_summary') { badgeCls = 'bg-amber-100 text-amber-800'; badgeLabel = 'JOS'; }
                else if (c.child_type === 'picking_sheet') { badgeCls = 'bg-indigo-100 text-indigo-800'; badgeLabel = 'PS'; }
                return `<div class="ml-6 flex items-center gap-2 py-1">
                    <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                    <span class="px-2 py-0.5 rounded text-xs font-medium ${badgeCls}">${badgeLabel}</span>
                    <span class="text-sm font-medium">${c.child_reference}</span>
                    ${c.item_code ? `<span class="text-xs text-slate-500">(${c.item_code})</span>` : ''}
                    <button onclick="downloadLinkedPDF('${c.child_id}')" class="text-blue-500 hover:text-blue-700 ml-auto"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg></button>
                </div>`;
            }).join('') : '<div class="ml-6 text-xs text-slate-400 py-1">No linked documents</div>';

            return `<div class="border border-slate-200 rounded-lg mb-3 overflow-hidden">
                <div class="bg-slate-50 px-4 py-3 flex items-center gap-3">
                    <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <span class="font-semibold text-slate-800">Summary Sheet: ${link.parent_reference}</span>
                    <span class="text-xs text-slate-500 ml-auto">${children.length} linked document${children.length !== 1 ? 's' : ''}</span>
                    <button onclick="downloadLinkedPDF('${link.parent_id}')" class="text-blue-600 hover:text-blue-800 ml-2" title="Download Summary Sheet"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg></button>
                    ${canDelete ? `<button onclick="deleteDocumentLinkGroup('${link.id}')" class="text-red-500 hover:text-red-700 ml-1" title="Delete all"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>` : ''}
                </div>
                <div class="px-4 py-2">${childrenHtml}</div>
            </div>`;
        }).join('');
    } catch (error) {
        container.innerHTML = '<p class="text-sm text-red-500 text-center py-8">Error loading document links</p>';
    }
}

export async function downloadPendingJOsPDF() {
    try {
        const resp = await authenticatedFetch('/api/job-orders/pending-pdf');
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed to generate PDF');
        }
        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const disposition = resp.headers.get('Content-Disposition') || '';
        let filename = 'Pending_Job_Orders.pdf';
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match) filename = match[1];
        const a = document.createElement('a'); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); a.remove();
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

export async function downloadLinkedPDF(docId) {
    try {
        const resp = await authenticatedFetch(`/api/pdf-documents/${docId}/download`);
        if (!resp.ok) throw new Error('Download failed');
        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const disposition = resp.headers.get('Content-Disposition');
        let dlFilename = 'document.pdf';
        if (disposition) { const match = disposition.match(/filename="?([^";\n]+)"?/); if (match) dlFilename = match[1]; }
        const a = document.createElement('a'); a.href = url; a.download = dlFilename;
        document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); a.remove();
    } catch (error) { showToast('Error downloading', 'error'); }
}

async function _downloadBlobFromEndpoint(endpoint, fallbackName) {
    const resp = await authenticatedFetch(endpoint);
    if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.detail || 'Download failed');
    }
    const blob = await resp.blob();
    const url = window.URL.createObjectURL(blob);
    const disposition = resp.headers.get('Content-Disposition') || '';
    let filename = fallbackName;
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    if (match) filename = match[1];
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); a.remove();
}

export async function downloadSummaryPDFByRef(summaryRef) {
    if (!summaryRef) { showToast('No summary reference', 'error'); return; }
    try {
        const resp = await authenticatedFetch('/api/document-links?parent_type=summary_sheet');
        if (!resp.ok) throw new Error('Lookup failed');
        const data = await resp.json();
        const link = (data.links || []).find(l => l.parent_reference === summaryRef);
        if (!link || !link.parent_id) { showToast('Summary PDF not found', 'error'); return; }
        await downloadLinkedPDF(link.parent_id);
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

export async function downloadJOSummaryPDF(id) {
    try {
        await _downloadBlobFromEndpoint(`/api/job-orders/${id}/summary-pdf`, `JO_Summary_${id}.pdf`);
    } catch (error) { showToast('Error: ' + error.message, 'error'); }
}

export async function downloadDraftMergedPDF(id) {
    try {
        await _downloadBlobFromEndpoint(`/api/job-orders/${id}/merged-pdf`, `Draft_Bundle_${id}.pdf`);
    } catch (error) { showToast('Error: ' + error.message, 'error'); }
}

export async function deleteDocumentLinkGroup(linkId) {
    if (!hasAnyRole(['admin', 'manager'])) { showToast('No permission', 'error'); return; }
    if (!confirm('Delete this Job Order? Its items will be returned to Allocation under the original PO so you can re-create the JO with different quantities.')) return;
    try {
        const resp = await authenticatedFetch(`/api/document-links/${linkId}`, { method: 'DELETE' });
        if (!resp.ok) throw new Error('Failed');
        showToast('Items returned to Allocation.', 'success');
        loadDocumentLinksTab();
        if (typeof window.loadAllocationPending === 'function') {
            try { await window.loadAllocationPending(); } catch (_) {}
        }
        if (typeof window.loadPOStatus === 'function') {
            try { await window.loadPOStatus(); } catch (_) {}
        }
    } catch (error) { showToast('Error: ' + error.message, 'error'); }
}

// ============================================================================
// Reset JO Counter
// ============================================================================

export async function resetJOCounter() {
    if (!confirm('Reset the JO counter back to JO-0001?')) return;
    try {
        const resp = await authenticatedFetch('/api/admin/reset-jo-counter', { method: 'POST' });
        if (!resp.ok) throw new Error('Failed');
        showToast('JO counter reset. Next JO will be JO-0001.', 'success');
    } catch (error) { showToast('Error: ' + error.message, 'error'); }
}

// Legacy exports for backward compatibility (unused functions are no-ops)
export function addItemToJobOrder() {}
export function checkInventoryBeforeAction() {}
export function displayInventoryCheck() {}
export function hideInventoryCheck() {}
export function proceedWithExportOrSave() {}
export function exportJobOrderPDF() {}
export function saveJobOrder() { wizardSave(); }
export function clearJobOrderForm() { clearWizard(); }
export function viewJobOrder() {}
export function renderEditItemDropdown() {}
export function selectEditItem() {}

export { wizardState as currentJOItems };

// ============================================================================
// PO Processing Sub-tabs: Create Job Order / JO Status
// ============================================================================

export function switchPOTab(tab) {
    const panels = {
        po: document.getElementById('po-wizard-panel'),
        draft: document.getElementById('po-drafts-panel'),
        allocation: document.getElementById('po-allocation-panel'),
        status: document.getElementById('po-status-panel'),
        docs: document.getElementById('po-documents-panel'),
    };
    const buttons = {
        po: document.getElementById('po-subtab-po'),
        draft: document.getElementById('po-subtab-draft'),
        allocation: document.getElementById('po-subtab-allocation'),
        status: document.getElementById('po-subtab-status'),
        docs: document.getElementById('po-subtab-docs'),
    };

    const activeCls = 'bg-blue-600 text-white shadow-sm border border-slate-300';
    const inactiveCls = 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50';
    const baseCls = 'px-6 py-2.5 font-medium text-sm rounded-lg transition-all';

    const target = ['po', 'draft', 'allocation', 'status', 'docs'].includes(tab) ? tab : 'po';

    Object.entries(panels).forEach(([k, el]) => {
        if (!el) return;
        if (k === target) el.classList.remove('hidden'); else el.classList.add('hidden');
    });
    Object.entries(buttons).forEach(([k, el]) => {
        if (!el) return;
        el.className = `${baseCls} ${k === target ? activeCls : inactiveCls}`;
    });

    if (target === 'draft') loadDraftsList();
    else if (target === 'allocation') {
        if (typeof window.switchAllocSubTab === 'function') window.switchAllocSubTab('pending');
        if (typeof window.loadAllocationPending === 'function') window.loadAllocationPending();
    }
    else if (target === 'status') { if (typeof window.loadPOStatus === 'function') window.loadPOStatus(); }
    else if (target === 'docs') switchJOSubTab('saved');
}

export async function loadJOStatusPage() {
    const tbody = document.getElementById('jostatus-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-12 text-center text-slate-400">Loading…</td></tr>';
    try {
        const resp = await authenticatedFetch('/api/job-orders/status-list');
        if (!resp.ok) throw new Error('Failed to fetch');
        const data = await resp.json();
        const rows = data.rows || [];

        const searchTerm = (document.getElementById('jostatus-search')?.value || '').toLowerCase().trim();
        const filtered = searchTerm
            ? rows.filter(r =>
                (r.jo_reference || '').toLowerCase().includes(searchTerm) ||
                (r.summary_ref || '').toLowerCase().includes(searchTerm) ||
                (r.customer_name || '').toLowerCase().includes(searchTerm) ||
                (r.item_code || '').toLowerCase().includes(searchTerm) ||
                (r.description || '').toLowerCase().includes(searchTerm))
            : rows;

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-12 text-center text-slate-400">No job orders found</td></tr>';
            return;
        }

        const renderRow = (r) => {
            const dateStr = r.date ? new Date(r.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
            const cases = r.cases != null ? Number(r.cases).toLocaleString() : '-';
            const rowCls = r.is_active ? '' : 'opacity-50 bg-slate-50';
            const textCls = r.is_active ? 'text-slate-700' : 'text-slate-400 italic';
            const checked = r.is_active ? 'checked' : '';
            const prioNormal = r.priority === 'normal' ? 'selected' : '';
            const prioUrgent = r.priority === 'urgent' ? 'selected' : '';
            const isLocked = !!r.completed;
            const statusBadge = r.completed
                ? '<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-700">Completed</span>'
                : '<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">Pending</span>';
            const cid = String(r.child_id).replace(/'/g, "\\'");
            const activeCell = isLocked
                ? `<input type="checkbox" ${checked} disabled
                        title="Completed job orders cannot be deactivated"
                        class="w-4 h-4 rounded border-slate-300 text-slate-400 cursor-not-allowed">`
                : `<input type="checkbox" ${checked}
                        onchange="setJOStatus('${cid}', 'is_active', this.checked)"
                        class="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer">`;
            const priorityCell = isLocked
                ? `<select disabled title="Completed job orders cannot change priority"
                        class="px-2 py-1 border border-slate-200 rounded text-xs font-semibold text-slate-400 bg-slate-50 cursor-not-allowed">
                        <option value="normal" ${prioNormal}>Normal</option>
                        <option value="urgent" ${prioUrgent}>Urgent</option>
                    </select>`
                : `<select onchange="setJOStatus('${cid}', 'priority', this.value)"
                        class="px-2 py-1 border border-slate-300 rounded text-xs font-semibold ${r.priority === 'urgent' ? 'text-red-600 bg-red-50 border-red-300' : 'text-slate-700 bg-white'}">
                        <option value="normal" ${prioNormal}>Normal</option>
                        <option value="urgent" ${prioUrgent}>Urgent</option>
                    </select>`;
            const showReason = !r.completed && r.is_active;
            const autoReason = (r.pending_reason_auto || '').trim();
            const manualReason = (r.pending_reason_manual || '').trim();
            const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const reasonRow = (showReason && (autoReason || manualReason))
                ? `<tr class="bg-rose-50/30 border-b border-slate-100">
                        <td colspan="10" class="px-4 pb-2 pt-0">
                            ${autoReason ? `<div class="text-xs text-red-600 font-medium flex items-start gap-1">
                                <svg class="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                                <span>${escapeHtml(autoReason)}</span>
                            </div>` : ''}
                            ${manualReason ? `<div class="text-xs text-red-500 italic mt-0.5">Note: ${escapeHtml(manualReason)}</div>` : ''}
                        </td>
                    </tr>`
                : '';
            return `<tr class="border-b border-slate-100 ${rowCls}">
                <td class="px-4 py-3 whitespace-nowrap text-xs ${textCls}">${dateStr}</td>
                <td class="px-4 py-3 whitespace-nowrap text-xs font-semibold ${textCls}">${r.summary_ref || '-'}</td>
                <td class="px-4 py-3 whitespace-nowrap text-xs font-mono ${textCls}">${r.jo_reference || '-'}</td>
                <td class="px-4 py-3 text-sm ${textCls}">${r.customer_name || '-'}</td>
                <td class="px-4 py-3 whitespace-nowrap text-xs font-mono ${textCls}">${r.item_code || '-'}</td>
                <td class="px-4 py-3 text-sm ${textCls}">${r.description || '-'}</td>
                <td class="px-4 py-3 whitespace-nowrap text-right text-sm ${textCls}">${cases}</td>
                <td class="px-4 py-3 whitespace-nowrap text-center">${activeCell}</td>
                <td class="px-4 py-3 whitespace-nowrap text-center">${priorityCell}</td>
                <td class="px-4 py-3 whitespace-nowrap text-center">${statusBadge}</td>
            </tr>${reasonRow}`;
        };

        const pending = filtered.filter(r => !r.completed);
        const completed = filtered.filter(r => r.completed);

        const pendingHeader = `<tr class="bg-amber-50/60 border-t border-b border-amber-200">
            <td colspan="10" class="px-4 py-2 text-xs font-bold uppercase tracking-wider text-amber-800">
                Pending <span class="font-medium text-amber-600">(${pending.length})</span>
            </td>
        </tr>`;
        const completedHeader = `<tr class="bg-green-50/60 border-t border-b border-green-200">
            <td colspan="10" class="px-4 py-2 text-xs font-bold uppercase tracking-wider text-green-800">
                Completed <span class="font-medium text-green-600">(${completed.length})</span>
            </td>
        </tr>`;
        const emptyRow = (msg) => `<tr><td colspan="10" class="px-4 py-4 text-center text-xs text-slate-400 italic">${msg}</td></tr>`;

        tbody.innerHTML =
            pendingHeader +
            (pending.length ? pending.map(renderRow).join('') : emptyRow('No pending job orders')) +
            completedHeader +
            (completed.length ? completed.map(renderRow).join('') : emptyRow('No completed job orders'));
    } catch (err) {
        console.error('Error loading JO status list:', err);
        tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-12 text-center text-red-500">Error loading job order status. Please try again.</td></tr>';
    }
}

export async function setJOStatus(childId, field, value) {
    const body = {};
    if (field === 'is_active') body.is_active = !!value;
    else if (field === 'priority') body.priority = value;
    else return;
    try {
        const resp = await authenticatedFetch(`/api/job-orders/${childId}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.detail || 'Update failed');
        }
        showToast(field === 'is_active' ? (value ? 'Job order activated' : 'Job order deactivated') : `Priority set to ${value}`, 'success');
        if (typeof window.loadDocumentsPage === 'function') window.loadDocumentsPage();
        if (document.getElementById('jostatus-table-body')) loadJOStatusPage();
    } catch (e) {
        console.error('Status update failed:', e);
        showToast('Failed to update: ' + e.message, 'error');
        if (typeof window.loadDocumentsPage === 'function') window.loadDocumentsPage();
        if (document.getElementById('jostatus-table-body')) loadJOStatusPage();
    }
}
