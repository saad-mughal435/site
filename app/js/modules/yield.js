/**
 * Demo Plant LLC - Yield & Wastages Module
 * Handles production batch tracking and yield calculations
 */

import { showToast, state } from '../utils.js?v=20260127c';
import { authenticatedFetch, hasAnyRole, getCurrentUser } from '../auth.js?v=20260428b';
import { consumePendingJoChildIds, checkCalcTankCipPreflight } from './calculator.js?v=20260429a';

// ============================================================================
// Module State
// ============================================================================

let currentCalculationData = null;
let sageStatusCache = {};
let allBatches = [];
let gtinLookup = {};
let _searchDebounceTimer = null;

async function fetchGtinLookup() {
    try {
        const resp = await authenticatedFetch('/api/recipe-item-map');
        if (resp.ok) {
            const data = await resp.json();
            gtinLookup = {};
            for (const key in data) {
                const entry = data[key];
                if (entry.recipe_name && entry.gtin) {
                    gtinLookup[entry.recipe_name] = entry.gtin;
                }
            }
        }
    } catch (e) {
        console.warn('Failed to fetch GTIN lookup:', e);
    }
}

function applyYieldSearch() {
    const input = document.getElementById('yield-search-input');
    const term = (input?.value || '').trim().toLowerCase();
    const tbody = document.getElementById('yield-table-body');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr[data-batch-id]');
    let visibleCount = 0;
    rows.forEach(row => {
        if (!term) {
            row.classList.remove('hidden');
            visibleCount++;
            return;
        }
        const searchable = (row.dataset.searchText || '').toLowerCase();
        if (searchable.includes(term)) {
            row.classList.remove('hidden');
            visibleCount++;
        } else {
            row.classList.add('hidden');
        }
    });

    const noResults = tbody.querySelector('tr.no-search-results');
    if (term && visibleCount === 0) {
        if (!noResults) {
            const tr = document.createElement('tr');
            tr.className = 'no-search-results';
            tr.innerHTML = `<td colspan="13" class="px-6 py-12 text-center text-gray-400">No batches match your search.</td>`;
            tbody.appendChild(tr);
        }
    } else if (noResults) {
        noResults.remove();
    }
}

export function initYieldSearch() {
    const input = document.getElementById('yield-search-input');
    if (!input) return;
    input.addEventListener('input', () => {
        clearTimeout(_searchDebounceTimer);
        _searchDebounceTimer = setTimeout(applyYieldSearch, 300);
    });
}

// ============================================================================
// Sage Draft Status Functions
// ============================================================================

/**
 * Get Sage draft status for a batch
 */
async function getSageDraftStatus(batchNo) {
    // Check cache first
    if (sageStatusCache[batchNo]) {
        return sageStatusCache[batchNo];
    }
    
    try {
        const response = await authenticatedFetch(`/api/sage/draft-status/${encodeURIComponent(batchNo)}`);
        if (response.ok) {
            const status = await response.json();
            sageStatusCache[batchNo] = status;
            return status;
        }
    } catch (error) {
        console.error(`Error getting Sage status for ${batchNo}:`, error);
    }
    
    return { has_draft: false, draft_status: null, sage_mismatch_detail: '' };
}

/**
 * Clear Sage status cache (call when status changes)
 */
function clearSageStatusCache(batchNo = null) {
    if (batchNo) {
        delete sageStatusCache[batchNo];
    } else {
        sageStatusCache = {};
    }
}

/**
 * Clear stale sage_outbox link for this batch (app DB only), then open the
 * raw-materials modal and Send to Sage flow — for IJ mismatch rows on Yield.
 */
export async function yieldResetLinkThenSendToSage(batchId, batchNo) {
    if (
        !confirm(
            'Clear the stale Sage link for this batch in the app, then re-enter raw material quantities and create new inventory journal drafts (new IJ numbers)? Existing Sage entries are not removed by this step.'
        )
    ) {
        return;
    }
    try {
        showToast('Resetting link...', 'info');
        const res = await authenticatedFetch('/api/sage/reset-production-batch-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch_no: batchNo, dry_run: false }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            let msg = 'Reset failed';
            const d = data.detail;
            if (typeof d === 'string') msg = d;
            else if (Array.isArray(d)) msg = d.map((x) => x.msg || String(x)).join(' ');
            throw new Error(msg);
        }
        showToast(data.message || 'Link cleared. Enter raw materials next.', 'success');
        clearSageStatusCache(batchNo);
        await sendToSage(batchId, batchNo);
    } catch (e) {
        console.error('yieldResetLinkThenSendToSage:', e);
        showToast(e.message || 'Reset failed', 'error');
    }
}

// ============================================================================
// Qty Returned Modal State
// ============================================================================

let _pendingSageBatchId = null;
let _pendingSageBatchNo = null;
let _pendingSageRecipeName = null;
let _pendingSagePlannedQty = null;
let _pendingRawMaterials = [];

/**
 * Send batch to Sage for approval - now opens Qty Returned modal first
 */
export async function sendToSage(batchId, batchNo) {
    _pendingSageBatchId = batchId;
    _pendingSageBatchNo = batchNo;

    try {
        showToast('Loading raw materials...', 'info');

        const response = await authenticatedFetch(`/api/production-batch/${batchId}/raw-materials`);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to load raw materials');
        }

        const data = await response.json();
        _pendingRawMaterials = data.raw_materials || [];
        _pendingSageRecipeName = data.recipe_name || '';
        _pendingSagePlannedQty = data.planned_qty || 0;

        // Populate modal
        const infoEl = document.getElementById('qty-returned-batch-info');
        if (infoEl) infoEl.textContent = `Batch: ${batchNo}  |  Recipe: ${data.recipe_name}  |  Actual Qty: ${data.actual_qty || 0}`;

        _renderQtyReturnedTable();

        // Show modal
        document.getElementById('qty-returned-modal')?.classList.remove('hidden');

    } catch (error) {
        console.error('Error loading raw materials:', error);
        showToast(error.message, 'error');
    }
}

/**
 * Render the Qty Returned table rows inside the modal.
 * Qty Used is the editable input; Additional and Qty Returned are auto-calculated.
 */
function _renderQtyReturnedTable() {
    const tbody = document.getElementById('qty-returned-tbody');
    if (!tbody) return;

    if (_pendingRawMaterials.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400">No raw materials found for this batch</td></tr>';
        return;
    }

    const fmtQty = (v) => {
        const n = parseFloat(v);
        return n.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4});
    };

    tbody.innerHTML = _pendingRawMaterials.map((mat, idx) => {
        const qtyAdditional = mat.qty_additional || 0;
        const qtyReturned = mat.qty_returned || 0;
        const qtyUsed = mat.qty_issued + qtyAdditional - qtyReturned;
        mat.qty_used = qtyUsed;
        const displayUsed = qtyUsed.toFixed(4);
        return `
            <tr class="hover:bg-slate-50">
                <td class="px-3 py-2 text-sm font-mono text-slate-800">${mat.item_code}</td>
                <td class="px-3 py-2 text-sm text-slate-600">${mat.description || '-'}</td>
                <td class="px-3 py-2 text-sm text-right font-mono text-blue-700 font-semibold">${fmtQty(mat.qty_issued)}</td>
                <td class="px-3 py-2 text-center">
                    <input type="number" step="0.0001" min="0"
                        value="${displayUsed}"
                        onchange="onQtyUsedChange(${idx}, this.value)"
                        oninput="onQtyUsedChange(${idx}, this.value)"
                        class="w-28 text-right rounded-lg border-2 border-green-400 bg-green-50 hover:border-green-500 px-3 py-1.5 text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent" />
                </td>
                <td class="px-3 py-2 text-sm text-right font-mono text-blue-600" id="qty-additional-${idx}">${fmtQty(qtyAdditional)}</td>
                <td class="px-3 py-2 text-sm text-right font-mono text-amber-600" id="qty-returned-${idx}">${fmtQty(qtyReturned)}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Called when the user changes the Qty Used input.
 * Auto-calculates Additional (if used > issued) or Qty Returned (if used < issued).
 */
export function onQtyUsedChange(index, value) {
    let qtyUsed = Math.max(0, parseFloat(value) || 0);
    const mat = _pendingRawMaterials[index];
    if (!mat) return;

    if (qtyUsed > mat.qty_issued) {
        mat.qty_additional = qtyUsed - mat.qty_issued;
        mat.qty_returned = 0;
    } else {
        mat.qty_additional = 0;
        mat.qty_returned = mat.qty_issued - qtyUsed;
    }
    mat.qty_used = qtyUsed;

    const fmtQty = (v) => {
        const n = parseFloat(v);
        return n.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4});
    };
    const addEl = document.getElementById(`qty-additional-${index}`);
    if (addEl) addEl.textContent = fmtQty(mat.qty_additional);
    const retEl = document.getElementById(`qty-returned-${index}`);
    if (retEl) retEl.textContent = fmtQty(mat.qty_returned);
}

/**
 * @deprecated Kept for backwards-compatibility; no longer called from the modal.
 */
export function onQtyReturnedChange(index, value) {
    onQtyUsedChange(index, value);
}

/**
 * @deprecated Kept for backwards-compatibility; no longer called from the modal.
 */
export function onQtyAdditionalChange(index, value) {
    onQtyUsedChange(index, value);
}

/**
 * Close the Qty Returned modal
 */
export function closeQtyReturnedModal() {
    document.getElementById('qty-returned-modal')?.classList.add('hidden');

    // Reset success / download UI
    document.getElementById('qty-returned-success')?.classList.add('hidden');
    const downloadBtn = document.getElementById('btn-download-stock-req');
    if (downloadBtn) { downloadBtn.classList.add('hidden'); downloadBtn.classList.remove('flex'); }
    const psBtn = document.getElementById('btn-download-picking-sheet');
    if (psBtn) { psBtn.classList.add('hidden'); psBtn.classList.remove('flex'); }
    const confirmBtn = document.getElementById('btn-confirm-send-sage');
    if (confirmBtn) { confirmBtn.classList.remove('hidden'); confirmBtn.disabled = false; }

    _pendingSageBatchId = null;
    _pendingSageBatchNo = null;
    _pendingSageRecipeName = null;
    _pendingSagePlannedQty = null;
    _pendingRawMaterials = [];
}

/**
 * Download the filled Stock Requisition PDF for the current batch
 */
export async function downloadStockRequisitionPDF() {
    const batchId = _pendingSageBatchId;
    if (!batchId) {
        showToast('No batch selected for PDF download', 'error');
        return;
    }

    try {
        showToast('Generating PDF...', 'info');
        const response = await authenticatedFetch(`/api/production-batch/${batchId}/stock-requisition-pdf`);

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to generate PDF');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        const disposition = response.headers.get('Content-Disposition');
        const safeName = (_pendingSageRecipeName || '').replace(/ /g, '_');
        let filename = `${_pendingSageBatchNo || batchId}_StockRequisition_${safeName}_${Math.round(_pendingSagePlannedQty || 0)}.pdf`;
        if (disposition) {
            const match = disposition.match(/filename="?(.+?)"?$/);
            if (match) filename = match[1];
        }
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('Stock Requisition PDF downloaded!', 'success');
    } catch (error) {
        console.error('Error downloading PDF:', error);
        showToast(error.message, 'error');
    }
}

/**
 * Download Stock Requisition PDF for any batch (standalone, used from table row)
 */
export async function downloadBatchPDF(batchId, batchNo, recipeName, plannedQty) {
    try {
        showToast('Generating PDF...', 'info');
        const response = await authenticatedFetch(`/api/production-batch/${batchId}/stock-requisition-pdf`);

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to generate PDF');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const disposition = response.headers.get('Content-Disposition');
        const safeName = (recipeName || '').replace(/ /g, '_');
        let filename = `${batchNo || batchId}_StockRequisition_${safeName}_${Math.round(plannedQty || 0)}.pdf`;
        if (disposition) {
            const match = disposition.match(/filename="?(.+?)"?$/);
            if (match) filename = match[1];
        }
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('Stock Requisition PDF downloaded!', 'success');
    } catch (error) {
        console.error('Error downloading PDF:', error);
        showToast(error.message, 'error');
    }
}

/**
 * Download the Picking Sheet PDF (Excel-format) for the current batch in the modal
 */
export async function downloadPickingSheetPDF() {
    const batchId = _pendingSageBatchId;
    if (!batchId) {
        showToast('No batch selected for PDF download', 'error');
        return;
    }

    try {
        showToast('Generating Picking Sheet...', 'info');
        const response = await authenticatedFetch(`/api/production-batch/${batchId}/picking-sheet-pdf`);

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to generate Picking Sheet');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const disposition = response.headers.get('Content-Disposition');
        const safeName = (_pendingSageRecipeName || '').replace(/ /g, '_');
        let psFilename = `${_pendingSageBatchNo || batchId}_PickingSheet_${safeName}_${Math.round(_pendingSagePlannedQty || 0)}.pdf`;
        if (disposition) {
            const match = disposition.match(/filename="?(.+?)"?$/);
            if (match) psFilename = match[1];
        }
        a.download = psFilename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('Picking Sheet PDF downloaded!', 'success');
    } catch (error) {
        console.error('Error downloading Picking Sheet:', error);
        showToast(error.message, 'error');
    }
}

/**
 * Download the Inventory Journal Batch PDF (IS + FG-IN pages) for a production batch.
 */
export async function downloadIJBatchPDF(batchNo) {
    try {
        showToast('Generating IJ Batch PDF...', 'info');
        const response = await authenticatedFetch(`/api/sage/draft-pdf/${encodeURIComponent(batchNo)}`);

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            let msg = 'Failed to generate IJ Batch PDF';
            const d = err.detail;
            if (typeof d === 'string') msg = d;
            else if (Array.isArray(d)) msg = d.map((x) => x.msg || String(x)).join(' ');
            throw new Error(msg);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `IJ_Batch_${batchNo}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('IJ Batch PDF downloaded!', 'success');
    } catch (error) {
        console.error('Error downloading IJ Batch PDF:', error);
        showToast(error.message, 'error');
    }
}

let _pickingSheetBatchId = null;
let _pickingSheetBatchNo = null;
let _pickingSheetRecipeName = null;
let _pickingSheetPlannedQty = null;
let _pickingSheetIngredients = [];

/**
 * Opens ingredient batch number popup, then downloads Picking Sheet PDF.
 */
export async function downloadBatchPickingSheet(batchId, batchNo, recipeName, plannedQty) {
    _pickingSheetBatchId = batchId;
    _pickingSheetBatchNo = batchNo;
    _pickingSheetRecipeName = recipeName;
    _pickingSheetPlannedQty = plannedQty;

    try {
        showToast('Loading ingredients...', 'info');
        const response = await authenticatedFetch(`/api/production-batch/${batchId}/ingredient-batch-numbers`);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to load ingredient data');
        }

        const data = await response.json();
        _pickingSheetIngredients = data.ingredients || [];

        const infoEl = document.getElementById('ingredient-batch-info');
        if (infoEl) infoEl.textContent = `Batch: ${data.batch_no}  |  Recipe: ${data.recipe_name}`;

        const tbody = document.getElementById('ingredient-batch-tbody');
        if (tbody) {
            if (_pickingSheetIngredients.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-8 text-center text-slate-400">No ingredients found</td></tr>';
            } else {
                tbody.innerHTML = _pickingSheetIngredients.map((ing, idx) => `
                    <tr class="hover:bg-slate-50">
                        <td class="px-3 py-2 text-sm font-mono text-slate-800">${ing.item_code}</td>
                        <td class="px-3 py-2 text-sm text-slate-600">${ing.description || '-'}</td>
                        <td class="px-3 py-2 text-center">
                            <input type="text" id="ing-batch-${idx}"
                                value="${ing.batch_number || ''}"
                                placeholder="Enter batch no..."
                                class="w-48 text-center rounded-lg border-2 border-amber-300 bg-amber-50 hover:border-amber-400 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
                        </td>
                    </tr>
                `).join('');
            }
        }

        document.getElementById('ingredient-batch-modal')?.classList.remove('hidden');
    } catch (error) {
        console.error('Error loading ingredient batch numbers:', error);
        showToast(error.message, 'error');
    }
}

export function closeIngredientBatchModal() {
    document.getElementById('ingredient-batch-modal')?.classList.add('hidden');
    _pickingSheetBatchId = null;
    _pickingSheetBatchNo = null;
    _pickingSheetRecipeName = null;
    _pickingSheetPlannedQty = null;
    _pickingSheetIngredients = [];
}

function _collectIngredientBatchNumbers() {
    const batchNumbers = {};
    _pickingSheetIngredients.forEach((ing, idx) => {
        const input = document.getElementById(`ing-batch-${idx}`);
        if (input && input.value.trim()) {
            batchNumbers[ing.item_code] = input.value.trim();
        }
    });
    return batchNumbers;
}

export async function saveIngredientBatchNumbers() {
    if (!_pickingSheetBatchId) return;

    const btn = document.getElementById('btn-save-ingredient-batches');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div class="loader w-4 h-4 mr-2"></div> Saving...';
    }

    try {
        const batchNumbers = _collectIngredientBatchNumbers();

        const saveResp = await authenticatedFetch(`/api/production-batch/${_pickingSheetBatchId}/ingredient-batch-numbers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch_numbers: batchNumbers })
        });
        if (!saveResp.ok) {
            const err = await saveResp.json();
            throw new Error(err.detail || 'Failed to save batch numbers');
        }

        showToast('Batch numbers saved!', 'success');
        window.dispatchEvent(
            new CustomEvent('Demo Plant-raw-material-saved', {
                detail: { batch_no: _pickingSheetBatchNo || null },
            })
        );
        closeIngredientBatchModal();
    } catch (error) {
        console.error('Error saving batch numbers:', error);
        showToast(error.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg> Save Batch Numbers`;
        }
    }
}

export async function saveAndDownloadPickingSheet() {
    if (!_pickingSheetBatchId) return;

    const btn = document.getElementById('btn-save-download-picking-sheet');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div class="loader w-4 h-4 mr-2"></div> Generating...';
    }

    try {
        const batchNumbers = _collectIngredientBatchNumbers();

        const saveResp = await authenticatedFetch(`/api/production-batch/${_pickingSheetBatchId}/ingredient-batch-numbers`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch_numbers: batchNumbers })
        });
        if (!saveResp.ok) {
            const err = await saveResp.json();
            throw new Error(err.detail || 'Failed to save batch numbers');
        }

        window.dispatchEvent(
            new CustomEvent('Demo Plant-raw-material-saved', {
                detail: { batch_no: _pickingSheetBatchNo || null },
            })
        );
        showToast('Generating Picking Sheet...', 'info');
        const response = await authenticatedFetch(`/api/production-batch/${_pickingSheetBatchId}/picking-sheet-pdf`);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to generate Picking Sheet');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const disposition = response.headers.get('Content-Disposition');
        const safeName = (_pickingSheetRecipeName || '').replace(/ /g, '_');
        let filename = `${_pickingSheetBatchNo || _pickingSheetBatchId}_PickingSheet_${safeName}_${Math.round(_pickingSheetPlannedQty || 0)}.pdf`;
        if (disposition) {
            const match = disposition.match(/filename="?(.+?)"?$/);
            if (match) filename = match[1];
        }
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        showToast('Picking Sheet PDF downloaded!', 'success');
        closeIngredientBatchModal();
    } catch (error) {
        console.error('Error downloading Picking Sheet:', error);
        showToast(error.message, 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> Save & Download PDF`;
        }
    }
}

/**
 * Confirm & Send to Sage: saves returned qty then creates drafts
 */
export async function confirmAndSendToSage() {
    if (!_pendingSageBatchId || !_pendingSageBatchNo) return;

    const btn = document.getElementById('btn-confirm-send-sage');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<div class="loader w-4 h-4 mr-2"></div> Sending...';
    }

    try {
        // 1. Save qty_returned and qty_additional values
        const items = _pendingRawMaterials.map(mat => ({
            item_code: mat.item_code,
            qty_returned: mat.qty_returned || 0,
            qty_additional: mat.qty_additional || 0
        }));

        const saveResponse = await authenticatedFetch(`/api/production-batch/${_pendingSageBatchId}/raw-materials-returned`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
        });

        if (!saveResponse.ok) {
            const err = await saveResponse.json();
            throw new Error(err.detail || 'Failed to save returned quantities');
        }

        // 2. Create Sage drafts (backend now uses qty_used)
        showToast('Creating Sage drafts...', 'info');

        const draftResponse = await authenticatedFetch(`/api/sage/draft?production_batch_id=${encodeURIComponent(_pendingSageBatchNo)}`, {
            method: 'POST'
        });

        if (!draftResponse.ok) {
            const error = await draftResponse.json();
            throw new Error(error.detail || 'Failed to create Sage drafts');
        }

        const result = await draftResponse.json();

        // Clear cache and refresh batches list
        clearSageStatusCache(_pendingSageBatchNo);
        loadProductionBatches();

        showToast(`Drafts ${result.sage_journal_number} created! Awaiting admin approval.`, 'success');

        // Show success banner and download buttons (don't close modal yet)
        document.getElementById('qty-returned-success')?.classList.remove('hidden');
        const downloadBtn = document.getElementById('btn-download-stock-req');
        if (downloadBtn) {
            downloadBtn.classList.remove('hidden');
            downloadBtn.classList.add('flex');
        }
        const psBtn = document.getElementById('btn-download-picking-sheet');
        if (psBtn) {
            psBtn.classList.remove('hidden');
            psBtn.classList.add('flex');
        }

        // Hide the confirm button since it's already sent
        if (btn) btn.classList.add('hidden');

    } catch (error) {
        console.error('Error sending to Sage:', error);
        showToast(error.message, 'error');
    } finally {
        if (btn && !btn.classList.contains('hidden')) {
            btn.disabled = false;
            btn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg> Confirm & Send to Sage`;
        }
    }
}

/**
 * Generate action buttons based on Sage draft status
 */
function getSageActionHtml(batch, sageStatus, canSendToSage) {
    const hasActualQty = batch.actual_qty && batch.actual_qty > 0;
    
    console.log(`[Sage] Batch ${batch.batch_no}: actual_qty=${batch.actual_qty}, hasActualQty=${hasActualQty}, sageStatus=`, sageStatus, 'canSendToSage=', canSendToSage);
    
    // If no actual qty, no Sage options
    if (!hasActualQty) {
        console.log(`[Sage] Batch ${batch.batch_no}: No actual qty - hiding Sage button`);
        return '';
    }
    
    // Check draft status
    if (!sageStatus || !sageStatus.has_draft) {
        console.log(`[Sage] Batch ${batch.batch_no}: No draft exists - showing Send to Sage button`);
        // No draft exists - show "Send to Sage" button
        if (canSendToSage) {
            return `
                <button onclick="sendToSage(${batch.id}, '${batch.batch_no}')" 
                    class="w-6 h-6 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors shrink-0"
                    title="Send to Sage"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg></button>
            `;
        }
        return '';
    }
    
    // Draft exists - show status badge
    const status = sageStatus.draft_status;
    const journalNo = sageStatus.sage_journal_number || '';
    
    const ijPdfBtn = `<button onclick="downloadIJBatchPDF('${batch.batch_no}')" class="w-6 h-6 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors shrink-0" title="Download IJ Batch PDF (${journalNo})"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg></button>`;

    if (status === 'draft_created') {
        return `<span class="inline-block px-1.5 py-0.5 text-[9px] font-semibold rounded bg-amber-100 text-amber-800 border border-amber-300" title="Draft ${journalNo} awaiting approval">Pending</span>${ijPdfBtn}`;
    }

    if (status === 'link_mismatch') {
        const tip = (sageStatus.sage_mismatch_detail || 'Sage batch does not match this production batch').replace(/"/g, '&quot;');
        const mismatchSpan = `<span class="inline-block px-1.5 py-0.5 text-[9px] font-semibold rounded bg-rose-100 text-rose-900 border border-rose-300 max-w-[140px] truncate align-middle" title="${tip}">IJ mismatch</span>`;
        if (canSendToSage) {
            const sendBtn = `<button type="button" onclick="yieldResetLinkThenSendToSage(${batch.id}, '${batch.batch_no}')" 
                    class="w-6 h-6 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors shrink-0"
                    title="Reset link and send to Sage (re-enter raw materials)"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg></button>`;
            return `${mismatchSpan}${sendBtn}`;
        }
        return mismatchSpan;
    }
    
    if (status === 'posted') {
        return `<span class="inline-block px-1.5 py-0.5 text-[9px] font-semibold rounded bg-emerald-100 text-emerald-800 border border-emerald-300" title="Posted to Sage: ${journalNo}">Posted</span>${ijPdfBtn}`;
    }
    
    if (status === 'rejected') {
        // Rejected - allow retry
        if (canSendToSage) {
            return `
                <span class="inline-block px-1 py-0.5 text-[9px] rounded bg-red-100 text-red-700 font-semibold" title="Previously rejected">!</span>
                <button onclick="sendToSage(${batch.id}, '${batch.batch_no}')" 
                    class="w-6 h-6 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white rounded transition-colors shrink-0"
                    title="Retry sending to Sage"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></button>
            `;
        }
        return `<span class="inline-block px-1.5 py-0.5 text-[9px] rounded bg-red-100 text-red-700 font-semibold" title="Rejected">Rejected</span>`;
    }
    
    return '';
}

// ============================================================================
// Item Code Extraction
// ============================================================================

/**
 * Extract item code from recipe name / description.
 * Recipe names follow the pattern: "204-DBP-06 - Dragon Blast 500ml CAN"
 * The item code is the part before the first " - " separator.
 */
function extractItemCode(name) {
    if (!name) return '';
    const idx = name.indexOf(' - ');
    if (idx > 0) {
        return name.substring(0, idx).trim();
    }
    return '';
}

// ============================================================================
// Production Batches
// ============================================================================

/**
 * Load production batches from API
 */
export async function loadProductionBatches() {
    try {
        const [batchResp] = await Promise.all([
            authenticatedFetch('/api/production-batches'),
            Object.keys(gtinLookup).length === 0 ? fetchGtinLookup() : Promise.resolve()
        ]);
        const data = await batchResp.json();
        
        const tbody = document.getElementById('yield-table-body');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (!data.batches || data.batches.length === 0) {
            allBatches = [];
            tbody.innerHTML = `<tr><td colspan="13" class="px-6 py-12 text-center text-gray-400">No production batches yet. Use the Calculator to push batches to production.</td></tr>`;
            return;
        }
        
        // Sort by batch_no descending (extract numeric part)
        data.batches.sort((a, b) => {
            const numA = parseInt((a.batch_no || '').replace(/\D/g, ''), 10) || 0;
            const numB = parseInt((b.batch_no || '').replace(/\D/g, ''), 10) || 0;
            return numB - numA;
        });

        // Enrich with GTIN for search
        for (const batch of data.batches) {
            batch._gtin = gtinLookup[batch.recipe_name] || '';
        }

        allBatches = data.batches;
        
        const canEdit = hasAnyRole(['admin', 'manager']);
        const canSendToSage = hasAnyRole(['admin', 'manager', 'employee']);
        const currentUser = getCurrentUser();
        const isViewer = currentUser?.role === 'viewer';
        
        // Fetch Sage status for batches with actual qty (in parallel)
        const batchesWithActualQty = data.batches.filter(b => b.actual_qty && b.actual_qty > 0);
        const statusPromises = batchesWithActualQty.map(b => getSageDraftStatus(b.batch_no));
        await Promise.all(statusPromises);
        
        const batchNumBtnClass = "inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border-2 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:border-amber-400 transition-all cursor-pointer";

        for (const batch of data.batches) {
            if (!batch.item_code) {
                const extracted = extractItemCode(batch.recipe_name) || extractItemCode(batch.description);
                if (extracted) {
                    batch.item_code = extracted;
                    authenticatedFetch(`/api/production-batch/${batch.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ item_code: extracted })
                    }).catch(err => console.warn('Auto-fill item_code save failed:', err));
                }
            }
            
            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100';
            row.dataset.batchId = batch.id;
            row.dataset.searchText = [
                batch.batch_no, batch.item_code, batch.description,
                batch.recipe_name, batch._gtin
            ].filter(Boolean).join(' ').toLowerCase();
            
            const statusClass = batch.status === 'completed' 
                ? 'bg-green-100 text-green-800 border border-green-300' 
                : 'bg-amber-100 text-amber-800 border border-amber-300';
            const yieldClass = batch.yield_percentage 
                ? (batch.yield_percentage >= 100 ? 'text-green-600 font-bold' : batch.yield_percentage >= 95 ? 'text-amber-600 font-bold' : 'text-red-600 font-bold')
                : 'text-gray-400';
            
            const escapedRecipe = (batch.recipe_name || '').replace(/'/g, "\\'");
            const itemCodeTextClass = batch.item_code ? 'text-sm text-slate-800' : 'text-sm text-amber-600 italic';
            const batchNumBtn = `<td class="px-2 py-1.5 text-center"><button onclick="downloadBatchPickingSheet(${batch.id}, '${batch.batch_no}', '${escapedRecipe}', ${batch.planned_qty || 0})" class="${batchNumBtnClass}" title="Enter ingredient batch numbers"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> Enter</button></td>`;

            let displayDescription = batch.description || '-';
            if (batch.description && batch.item_code) {
                const prefix = `${batch.item_code} - `;
                if (displayDescription.startsWith(prefix)) {
                    displayDescription = displayDescription.slice(prefix.length);
                }
            }
            const plannedQtyDisplay = batch.planned_qty != null ? Math.round(batch.planned_qty).toLocaleString() : '-';
            const rawMaterialCostDisplay = batch.raw_material_cost ? batch.raw_material_cost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) : '-';
            const perCaseDisplay = batch.per_case ? batch.per_case.toFixed(2) : '-';
            const yieldDisplay = batch.yield_percentage ? batch.yield_percentage.toFixed(2) + '%' : '-';
            
            const sageStatus = batch.actual_qty && batch.actual_qty > 0 
                ? sageStatusCache[batch.batch_no] || { has_draft: false }
                : { has_draft: false };
            const sageActionHtml = getSageActionHtml(batch, sageStatus, canSendToSage);
            
            if (canEdit) {
                row.innerHTML = `
                    <td class="px-2 py-1.5 text-sm text-slate-700">${batch.date || '-'}</td>
                    <td class="px-2 py-1.5 text-sm font-semibold text-slate-900">${batch.batch_no || '-'}</td>
                    <td class="px-2 py-1.5 ${itemCodeTextClass}">${batch.item_code || '-'}</td>
                    <td class="px-2 py-1.5 text-sm text-slate-700">${displayDescription}</td>
                    ${batchNumBtn}
                    <td class="px-2 py-1.5 text-right text-sm font-mono text-slate-800">${plannedQtyDisplay}</td>
                    <td class="px-2 py-1.5 text-right text-sm font-mono text-slate-800">${batch.actual_qty ?? '-'}</td>
                    <td class="px-2 py-1.5 text-right text-sm font-medium text-slate-700">${rawMaterialCostDisplay}</td>
                    <td class="px-2 py-1.5 text-right text-sm font-medium text-slate-700">${perCaseDisplay}</td>
                    <td class="px-2 py-1.5 text-right text-sm font-mono text-slate-800">${batch.std_uc ?? '-'}</td>
                    <td class="px-2 py-1.5 text-right text-sm font-semibold ${yieldClass}">${yieldDisplay}</td>
                    <td class="px-2 py-1.5 text-center"><span class="px-2 py-1 text-[11px] font-bold rounded-full ${statusClass}">${batch.status.toUpperCase()}</span></td>
                    <td class="px-2 py-1.5 text-center">
                        <div class="flex items-center justify-center gap-1">
                            ${sageActionHtml}
                            <button onclick="downloadBatchPDF(${batch.id}, '${batch.batch_no}', '${escapedRecipe}', ${batch.planned_qty || 0})" class="w-6 h-6 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors shrink-0" title="Download Stock Requisition PDF"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></button>
                            <button onclick="deleteProductionBatch(${batch.id})" class="w-6 h-6 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded transition-colors shrink-0" title="Delete batch"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                        </div>
                    </td>
                `;
            } else {
                row.innerHTML = `
                    <td class="px-2 py-1.5 text-sm text-slate-700">${batch.date || '-'}</td>
                    <td class="px-2 py-1.5 text-sm font-semibold text-slate-900">${batch.batch_no || '-'}</td>
                    <td class="px-2 py-1.5 ${itemCodeTextClass}">${batch.item_code || '-'}</td>
                    <td class="px-2 py-1.5 text-sm text-slate-700">${displayDescription}</td>
                    ${batchNumBtn}
                    <td class="px-2 py-1.5 text-right text-sm font-mono text-slate-800">${plannedQtyDisplay}</td>
                    <td class="px-2 py-1.5 text-right text-sm font-mono text-slate-800">${batch.actual_qty ?? '-'}</td>
                    <td class="px-2 py-1.5 text-right text-sm font-medium text-slate-700">${rawMaterialCostDisplay}</td>
                    <td class="px-2 py-1.5 text-right text-sm font-medium text-slate-700">${perCaseDisplay}</td>
                    <td class="px-2 py-1.5 text-right text-sm font-mono text-slate-800">${batch.std_uc ?? '-'}</td>
                    <td class="px-2 py-1.5 text-right text-sm font-semibold ${yieldClass}">${yieldDisplay}</td>
                    <td class="px-2 py-1.5 text-center"><span class="px-2 py-1 text-[11px] font-bold rounded-full ${statusClass}">${batch.status.toUpperCase()}</span></td>
                    <td class="px-2 py-1.5 text-center">
                        ${isViewer 
                            ? `<span class="text-[10px] text-gray-400">View only</span>` 
                            : `<div class="flex items-center justify-center gap-1">
                                ${sageActionHtml || ''}
                                <button onclick="downloadBatchPDF(${batch.id}, '${batch.batch_no}', '${escapedRecipe}', ${batch.planned_qty || 0})" class="w-6 h-6 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors shrink-0" title="Download Stock Requisition PDF"><svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></button>
                            </div>`
                        }
                    </td>
                `;
            }
            
            tbody.appendChild(row);
        }

        // Re-apply search filter if active
        applyYieldSearch();
    } catch (error) {
        console.error('Error loading production batches:', error);
        showToast('Error loading production batches: ' + error.message, 'error');
    }
}

/**
 * Show push to production modal
 */
export async function showPushToProductionModal() {
    const recipeName = document.getElementById('calc-recipe-select')?.value;
    const targetQty = parseFloat(document.getElementById('calc-target-qty')?.value);

    if (!recipeName || !targetQty) {
        alert('Please select a recipe and calculate first');
        return;
    }

    const batchNo = document.getElementById('calc-batch-no')?.value?.trim();
    if (!batchNo) {
        alert('Please enter a batch number before pushing to production');
        return;
    }

    try {
        const preflight = await checkCalcTankCipPreflight();
        if (preflight.applicable && !preflight.has_recent) {
            const proceed = confirm(`Tank ${preflight.tankNo} has no mixing CIP recorded in the last 7 days. Push to production anyway?`);
            if (!proceed) return;
        }
    } catch (e) {
        console.error('Tank CIP preflight check failed', e);
    }

    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }).replace(/ /g, '-');

    // Auto-extract item code from recipe name (e.g. "204-DBP-06 - Dragon Blast..." → "204-DBP-06")
    const extractedItemCode = extractItemCode(recipeName);

    // Grab JO child IDs before push (consumes them so they aren't re-used)
    const joChildIds = consumePendingJoChildIds();

    pushToProduction(batchNo, recipeName, extractedItemCode, recipeName, '', targetQty, today, joChildIds);
}

/**
 * Push batch to production
 * Creates a production batch AND a pending Process Control Report
 */
export async function pushToProduction(batchNo, recipeName, itemCode, description, language, plannedQty, date, joChildIds) {
    try {
        const response = await authenticatedFetch('/api/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipe_name: recipeName, target_qty: plannedQty })
        });

        const result = await response.json();

        const totalCost = result.items.reduce((sum, item) => sum + (item.calculated_qty * (item.unit_cost || 0)), 0);
        const perCase = totalCost / plannedQty;

        const tankNo = document.getElementById('calc-tank-no')?.value?.trim() || '';

        const editBatchId = window._calcEditBatchId || null;
        if (editBatchId) {
            const patchResp = await authenticatedFetch(`/api/production-batch/${editBatchId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    planned_qty: plannedQty,
                    raw_material_cost: totalCost,
                    per_case: perCase,
                }),
            });
            if (patchResp.ok) {
                window._calcEditBatchId = null;
                window._calcEditBatchNo = '';
                window._calcEditTankNo = '';
                window._calcEditPlannedQty = null;
                showToast(`Batch ${batchNo} updated. Picking sheet regenerated everywhere.`, 'success');
                if (typeof switchTab === 'function') switchTab('qc');
            } else {
                const err = await patchResp.json().catch(() => ({}));
                alert('Failed to update batch: ' + (err.detail || JSON.stringify(err)));
            }
            return;
        }

        const batchData = {
            batch_no: batchNo,
            recipe_name: recipeName,
            item_code: itemCode,
            description: description,
            language: language,
            planned_qty: plannedQty,
            raw_material_cost: totalCost,
            per_case: perCase,
            std_uc: 17.25,
            date: date,
            tank_no: tankNo
        };

        // Step 1: Create production batch
        const pushResponse = await authenticatedFetch('/api/production-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(batchData)
        });
        
        if (pushResponse.ok) {
            const batchResult = await pushResponse.json();
            console.log('Production batch created:', batchResult);
            
            // Step 2: Create pending Process Control Report
            const today = new Date().toISOString().split('T')[0];
            const productName = description || recipeName || 'Unknown Product';
            
            const nameLower = (recipeName || '').toLowerCase();
            let detectedPackaging = 'PET';
            if (nameLower.includes('pet')) {
                detectedPackaging = 'PET';
            } else if (nameLower.includes('can')) {
                detectedPackaging = 'CAN';
            }
            
            const reportData = {
                packaging_type: detectedPackaging,
                product_name: productName,
                batch_no: batchNo,
                production_date: today,
                production_batch_id: batchNo,
                recipe_name: recipeName,
                planned_qty: plannedQty,
                raw_material_cost: totalCost
            };
            
            console.log('Creating Process Control Report with data:', reportData);
            
            const reportResponse = await authenticatedFetch('/api/production-control-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(reportData)
            });
            
            // Step 3: Auto-complete linked job orders if coming from "To Be Produced"
            let joCompletedCount = 0;
            if (Array.isArray(joChildIds) && joChildIds.length > 0) {
                try {
                    const completeResp = await authenticatedFetch('/api/job-orders/bulk-complete', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ child_ids: joChildIds, batch_number: batchNo })
                    });
                    if (completeResp.ok) {
                        const completeResult = await completeResp.json();
                        joCompletedCount = completeResult.completed_count || 0;
                        console.log('Job orders auto-completed:', completeResult);
                    }
                } catch (joErr) {
                    console.error('Failed to auto-complete job orders:', joErr);
                }
            }
            
            if (reportResponse.ok) {
                const reportResult = await reportResponse.json();
                console.log('Process Control Report created:', reportResult);
                const joMsg = joCompletedCount > 0 ? ` ${joCompletedCount} job order(s) marked completed.` : '';
                showToast('Batch pushed to production!' + joMsg + ' Fill out the Production Report.', 'success');
                if (typeof switchTab === 'function') switchTab('production-reports');
            } else {
                const reportError = await reportResponse.json();
                console.error('Failed to create Process Control Report:', reportError);
                showToast('Batch created, but Process Control Report failed: ' + (reportError.detail || 'Unknown error'), 'warning');
                if (typeof switchTab === 'function') switchTab('yield');
            }
        } else {
            const error = await pushResponse.json();
            alert('Error pushing to production: ' + (error.detail || JSON.stringify(error)));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error pushing to production: ' + error.message);
    }
}

/**
 * Update batch field
 */
export async function updateBatchField(batchId, fieldName, value) {
    try {
        const updateData = {};
        updateData[fieldName] = value;
        
        const response = await authenticatedFetch(`/api/production-batch/${batchId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            alert('Error updating field: ' + (error.detail || 'Unknown error'));
            loadProductionBatches();
        }
    } catch (error) {
        console.error('Error updating field:', error);
        alert('Error updating field: ' + error.message);
        loadProductionBatches();
    }
}

/**
 * Update batch actual quantity
 */
export async function updateBatchActualQty(batchId, actualQty) {
    if (isNaN(actualQty) || actualQty < 0) return;
    updateActualProduced(batchId, actualQty);
}

/**
 * Update actual produced quantity
 */
export async function updateActualProduced(batchId, actualQty) {
    try {
        const response = await authenticatedFetch(`/api/production-batch/${batchId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ actual_qty: actualQty })
        });
        
        if (response.ok) {
            showToast('Actual quantity updated successfully!', 'success');
            loadProductionBatches();
        } else {
            const error = await response.json();
            alert('Error updating batch: ' + (error.detail || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error updating batch: ' + error.message);
    }
}

/**
 * Delete production batch
 */
export async function deleteProductionBatch(batchId) {
    const confirmed = confirm(
        'Delete this batch?\n\n' +
        'This will:\n' +
        '  • Remove the QC record, PPCR, and production batch\n' +
        '  • Return the linked job orders to Pending\n' +
        '  • Free the batch number for reuse\n' +
        '  • Send the Stock Requisition / Picking Sheet / PPCR PDFs to the OneDrive recycle bin\n\n' +
        'Refuses if Sage drafts exist or the PCR has already been submitted.\n' +
        'This cannot be undone.'
    );
    if (!confirmed) return;

    try {
        const response = await authenticatedFetch(`/api/production-batch/${batchId}`, { method: 'DELETE' });

        if (response.ok) {
            showToast('Batch deleted successfully!', 'success');
            loadProductionBatches();
        } else {
            const error = await response.json();
            alert('Error deleting batch: ' + (error.detail || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error deleting batch: ' + error.message);
    }
}
