/**
 * Demo Plant LLC - Calculator Module
 * Handles material calculation for production planning
 */

import { showToast, state } from '../utils.js?v=20260125h';
import { authenticatedFetch } from '../auth.js?v=20260428b';
import { getRtdRatio, getBottleSizeInfo } from './recipes.js?v=20260216b';

let _calcSource = 'qty'; // 'qty' | 'volume' - tracks which field the user last typed in

const _calcTankStorageKey = (batchNo) => `demoplant_calc_tank:${String(batchNo || '').trim()}`;
const _CALC_CIP_RECENT_DAYS = 7;
let _calcCipWarnTimer = null;

async function _checkTankCipAvailability(tankNo) {
    const tank = String(tankNo || '').trim();
    if (!/^[1-6]$/.test(tank)) return { applicable: false, has_recent: true };
    try {
        const r = await authenticatedFetch(`/api/mixing/tanks/${encodeURIComponent(tank)}/cip/history`);
        if (!r.ok) return { applicable: true, has_recent: true, error: true };
        const data = await r.json();
        const entries = Array.isArray(data?.history) ? data.history : [];
        const cutoff = Date.now() - _CALC_CIP_RECENT_DAYS * 86400000;
        const hasRecent = entries.some((e) => {
            const t = Date.parse(String(e?.saved_at || '').trim());
            return Number.isFinite(t) && t >= cutoff;
        });
        return { applicable: true, has_recent: hasRecent, count: entries.length };
    } catch (e) {
        console.error('Tank CIP preflight failed', e);
        return { applicable: true, has_recent: true, error: true };
    }
}

function _renderTankCipWarning(result, tankNo) {
    const el = document.getElementById('calc-tank-cip-warn');
    if (!el) return;
    if (!result?.applicable || result.has_recent) {
        el.classList.add('hidden');
        el.textContent = '';
        return;
    }
    el.textContent = `No mixing CIP found for Tank ${tankNo} in the last ${_CALC_CIP_RECENT_DAYS} days - create one in Mixing Section before pushing to production.`;
    el.classList.remove('hidden');
}

export async function checkCalcTankCipPreflight() {
    const tankNo = document.getElementById('calc-tank-no')?.value?.trim() || '';
    const result = await _checkTankCipAvailability(tankNo);
    return { tankNo, ...result };
}

function _updateCalcBatchDependentButtons() {
    const v = !!document.getElementById('calc-batch-no')?.value?.trim();
    ['push-to-production-btn', 'calc-stock-req-btn', 'calc-picking-btn'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = !v;
    });
}

/**
 * Wire batch + tank fields after calculator success panel is rendered (innerHTML).
 */
function _attachCalcBatchTankListeners() {
    const batchEl = document.getElementById('calc-batch-no');
    const tankEl = document.getElementById('calc-tank-no');
    if (!batchEl || !tankEl) return;

    batchEl.addEventListener('input', () => {
        _updateCalcBatchDependentButtons();
    });
    batchEl.addEventListener('change', () => {
        const b = batchEl.value.trim();
        tankEl.value = b ? (sessionStorage.getItem(_calcTankStorageKey(b)) || '') : '';
        _updateCalcBatchDependentButtons();
    });
    tankEl.addEventListener('input', () => {
        const b = batchEl.value.trim();
        if (b) sessionStorage.setItem(_calcTankStorageKey(b), tankEl.value.trim());
        if (_calcCipWarnTimer) clearTimeout(_calcCipWarnTimer);
        const tankNo = tankEl.value.trim();
        _calcCipWarnTimer = setTimeout(async () => {
            const result = await _checkTankCipAvailability(tankNo);
            _renderTankCipWarning(result, tankNo);
        }, 300);
    });

    _updateCalcBatchDependentButtons();
}

// ============================================================================
// Calculator Volume & RTD Helpers
// ============================================================================

/**
 * Get the currently selected recipe name in the calculator dropdown.
 */
function _getCalcRecipeName() {
    return document.getElementById('calc-recipe-select')?.value || '';
}

/**
 * Recalculate volume from the target quantity and update the RTD display.
 * Called when target qty input changes or when a recipe is selected.
 */
export function updateCalcVolumeFromQty() {
    _calcSource = 'qty';
    const recipeName = _getCalcRecipeName();
    const info = getBottleSizeInfo(recipeName);
    const qtyInput = document.getElementById('calc-target-qty');
    const volInput = document.getElementById('calc-volume');
    if (!info || !qtyInput || !volInput) { _updateCalcRtdDisplay(recipeName, null); return; }

    const qty = parseFloat(qtyInput.value) || 0;
    // If unit is cans, convert to cases first: 1 case = perCase cans
    const cases = state.selectedUnit === 'cans' ? qty / info.perCase : qty;
    const totalVolume = cases * info.perCase * (info.sizeMl / 1000);
    volInput.value = totalVolume ? totalVolume : '';
    _updateCalcRtdDisplay(recipeName, totalVolume);
}

/**
 * Recalculate target quantity from volume and update the RTD display.
 * Called when volume input changes.
 */
export function updateCalcQtyFromVolume() {
    _calcSource = 'volume';
    const recipeName = _getCalcRecipeName();
    const info = getBottleSizeInfo(recipeName);
    const qtyInput = document.getElementById('calc-target-qty');
    const volInput = document.getElementById('calc-volume');
    if (!info || !qtyInput || !volInput) { _updateCalcRtdDisplay(recipeName, null); return; }

    const totalVolume = parseFloat(volInput.value) || 0;
    const perCaseVolume = info.perCase * (info.sizeMl / 1000);
    const cases = perCaseVolume > 0 ? totalVolume / perCaseVolume : 0;
    // Convert to the active unit
    const qty = state.selectedUnit === 'cans' ? cases * info.perCase : cases;
    qtyInput.value = qty ? qty : '';
    _updateCalcRtdDisplay(recipeName, totalVolume);
}

/**
 * Update the RTD ratio display panel in the calculator.
 */
function _updateCalcRtdDisplay(recipeName, totalVolume) {
    const container = document.getElementById('calc-rtd-info');
    if (!container) return;

    const info = getBottleSizeInfo(recipeName);
    if (!recipeName || !info) {
        container.classList.add('hidden');
        return;
    }

    const ratio = getRtdRatio(recipeName);
    const ratioSum = ratio.ingredient + ratio.water;

    container.classList.remove('hidden');
    document.getElementById('calc-rtd-label').textContent = `RTD ${ratio.ingredient}:${ratio.water}`;

    if (totalVolume && totalVolume > 0) {
        const ingredientVol = totalVolume / ratioSum;
        const waterVol = totalVolume - ingredientVol;
        document.getElementById('calc-rtd-ingredient').textContent = ingredientVol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L';
        document.getElementById('calc-rtd-water').textContent = waterVol.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' L';
    } else {
        document.getElementById('calc-rtd-ingredient').textContent = '-';
        document.getElementById('calc-rtd-water').textContent = '-';
    }
}

// Expose to window for inline oninput handlers in HTML
window.__calcUpdateVolumeFromQty = updateCalcVolumeFromQty;
window.__calcUpdateQtyFromVolume = updateCalcQtyFromVolume;

// ============================================================================
// Searchable Recipe Dropdown
// ============================================================================

let _calcRecipes = [];      // full list of recipe names
let _calcDropdownReady = false;
let _pendingJoChildIds = []; // child IDs from "To Be Produced" view for auto-completion

/**
 * Load recipes into the searchable calculator dropdown.
 * Always fetches the latest list so renames/additions are reflected immediately.
 */
export async function loadCalculatorRecipes() {
    const hiddenInput = document.getElementById('calc-recipe-select');
    const list = document.getElementById('calc-recipe-list');
    if (!hiddenInput || !list) return;

    try {
        const response = await authenticatedFetch('/api/recipes');
        const data = await response.json();

        _calcRecipes = data.recipes.map(r => r.name);
        _renderRecipeList(_calcRecipes);

        // Wire-up dropdown events only once
        if (!_calcDropdownReady) {
            _initSearchableDropdown();
            _calcDropdownReady = true;
        }

        _applyPendingPrefill();
    } catch (error) {
        console.error("Failed to load recipes", error);
        const list = document.getElementById('calc-recipe-list');
        if (list) list.innerHTML = '<li class="no-results">Error loading recipes</li>';
    }
}

/* ---- helpers ---- */

function _renderRecipeList(recipes) {
    const list = document.getElementById('calc-recipe-list');
    if (!list) return;

    if (recipes.length === 0) {
        list.innerHTML = '<li class="no-results">No recipes found</li>';
        return;
    }

    const selectedValue = document.getElementById('calc-recipe-select')?.value || '';
    list.innerHTML = '';
    recipes.forEach(name => {
        const li = document.createElement('li');
        li.textContent = name;
        li.dataset.value = name;
        if (name === selectedValue) li.classList.add('active');
        li.addEventListener('click', () => _selectRecipe(name));
        list.appendChild(li);
    });
}

function _selectRecipe(name) {
    const hiddenInput = document.getElementById('calc-recipe-select');
    const displayText = document.getElementById('calc-recipe-text');
    if (hiddenInput) hiddenInput.value = name;
    if (displayText) {
        displayText.textContent = name;
        displayText.classList.remove('placeholder');
    }
    _closeDropdown();
    _renderRecipeList(_calcRecipes); // refresh active highlight
    // Update the unit toggle button text and note (e.g. "Cans" vs "Bottles")
    _refreshUnitButtonLabels();
    _updateUnitDescription();
    // Update volume & RTD for the newly selected recipe
    updateCalcVolumeFromQty();
}

function _applyPendingPrefill() {
    const pending = window._pendingCalcPrefill;
    if (!pending) {
        _pendingJoChildIds = [];
        return;
    }
    window._pendingCalcPrefill = null;

    const { itemCode, cases, childIds, recipeName, batchNo, tankNo, editBatchId } = pending;
    _pendingJoChildIds = Array.isArray(childIds) ? childIds : [];

    if (!_calcRecipes || _calcRecipes.length === 0) return;

    let match = null;
    if (recipeName && _calcRecipes.includes(recipeName)) {
        match = recipeName;
    } else if (itemCode) {
        match = _calcRecipes.find(r => r.startsWith(itemCode)) || null;
    }
    if (match) {
        _selectRecipe(match);
    }

    if (cases) {
        const qtyInput = document.getElementById('calc-target-qty');
        if (qtyInput) {
            qtyInput.value = cases;
            updateCalcVolumeFromQty();
        }
    }

    if (editBatchId) {
        window._calcEditBatchId = editBatchId;
        window._calcEditBatchNo = batchNo || '';
        window._calcEditTankNo = tankNo || '';
        window._calcEditPlannedQty = cases || null;
        setTimeout(() => { void calculateMaterials(); }, 100);
    } else {
        window._calcEditBatchId = null;
        window._calcEditBatchNo = '';
        window._calcEditTankNo = '';
        window._calcEditPlannedQty = null;
    }
}

/**
 * After the calculator renders the success panel (which creates calc-batch-no /
 * calc-tank-no inputs), apply edit-mode values and lock fields if we're editing.
 */
export function applyCalcEditModeToSuccessPanel() {
    if (!window._calcEditBatchId) return;
    const batchEl = document.getElementById('calc-batch-no');
    const tankEl = document.getElementById('calc-tank-no');
    const pushBtn = document.getElementById('push-to-production-btn');
    if (batchEl) {
        batchEl.value = window._calcEditBatchNo || '';
        batchEl.readOnly = true;
        batchEl.classList.add('bg-slate-100', 'cursor-not-allowed');
    }
    if (tankEl) {
        tankEl.value = window._calcEditTankNo || '';
        tankEl.readOnly = true;
        tankEl.classList.add('bg-slate-100', 'cursor-not-allowed');
    }
    if (pushBtn) {
        pushBtn.disabled = false;
        pushBtn.textContent = '';
        pushBtn.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Update Batch & Regenerate`;
    }
    const sumDiv = document.getElementById('calc-validation-summary');
    if (sumDiv && !document.getElementById('calc-edit-banner')) {
        const banner = document.createElement('div');
        banner.id = 'calc-edit-banner';
        banner.className = 'mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800';
        banner.textContent = `Editing batch ${window._calcEditBatchNo || ''} - change volume/cases only; same batch number and tank will be reused.`;
        sumDiv.prepend(banner);
    }
}

/**
 * Return the pending JO child IDs (set when coming from "To Be Produced") and clear them.
 */
export function consumePendingJoChildIds() {
    const ids = _pendingJoChildIds;
    _pendingJoChildIds = [];
    return ids;
}

/**
 * Refresh the unit toggle button text and label based on the selected recipe.
 * E.g. PET recipes show "Bottles", CAN recipes show "Cans".
 */
function _refreshUnitButtonLabels() {
    const { unitName } = _getRecipeUnitInfo();
    const cansBtn = document.getElementById('unit-cans-btn');
    const unitLabel = document.getElementById('unit-label');
    if (cansBtn) cansBtn.textContent = unitName;
    // If currently on the non-cases unit, update the label too
    if (unitLabel && state.selectedUnit !== 'cases') {
        unitLabel.textContent = unitName;
    }
}

function _openDropdown() {
    const wrapper = document.getElementById('calc-recipe-dropdown');
    const menu = document.getElementById('calc-recipe-menu');
    const searchInput = document.getElementById('calc-recipe-search');
    if (!wrapper || !menu) return;

    wrapper.classList.add('open');
    menu.classList.remove('hidden');

    // Reset search & show all
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    _renderRecipeList(_calcRecipes);
}

function _closeDropdown() {
    const wrapper = document.getElementById('calc-recipe-dropdown');
    const menu = document.getElementById('calc-recipe-menu');
    if (!wrapper || !menu) return;
    wrapper.classList.remove('open');
    menu.classList.add('hidden');
}

function _initSearchableDropdown() {
    const trigger = document.getElementById('calc-recipe-trigger');
    const searchInput = document.getElementById('calc-recipe-search');
    const wrapper = document.getElementById('calc-recipe-dropdown');

    if (!trigger || !searchInput || !wrapper) return;

    // Toggle on click
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        if (wrapper.classList.contains('open')) {
            _closeDropdown();
        } else {
            _openDropdown();
        }
    });

    // Filter as you type
    searchInput.addEventListener('input', () => {
        const q = searchInput.value.toLowerCase().trim();
        const filtered = q
            ? _calcRecipes.filter(n => n.toLowerCase().includes(q))
            : _calcRecipes;
        _renderRecipeList(filtered);
    });

    // Prevent closing when interacting inside the menu
    const menu = document.getElementById('calc-recipe-menu');
    if (menu) menu.addEventListener('click', e => e.stopPropagation());

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            _closeDropdown();
        }
    });

    // Keyboard: Escape closes
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            _closeDropdown();
        }
    });
}

// ============================================================================
// Unit Selection
// ============================================================================

/**
 * Get the per-case count and unit label based on the currently selected recipe.
 * Returns { perCase: number, unitName: string }
 * - PET 2.5L:  { perCase: 6,  unitName: 'Bottles' }
 * - PET other: { perCase: 24, unitName: 'Bottles' }
 * - CAN/default: { perCase: 24, unitName: 'Cans' }
 */
function _getRecipeUnitInfo() {
    const recipeName = _getCalcRecipeName();
    const info = getBottleSizeInfo(recipeName);
    const isPet = recipeName && /pet/i.test(recipeName);

    if (isPet) {
        const perCase = (info && info.perCase === 6) ? 6 : 24;
        return { perCase, unitName: 'Bottles' };
    }
    return { perCase: 24, unitName: 'Cans' };
}

/**
 * Update the note/description under the Target Quantity input
 * based on the selected recipe type and current unit.
 */
function _updateUnitDescription() {
    const unitDescription = document.getElementById('unit-description');
    if (!unitDescription) return;
    const { perCase, unitName } = _getRecipeUnitInfo();

    if (state.selectedUnit === 'cases') {
        unitDescription.innerHTML = `<span class="font-medium">Note:</span> 1 Case = ${perCase} ${unitName}`;
    } else {
        unitDescription.innerHTML = `<span class="font-medium">Note:</span> 1 Case = ${perCase} ${unitName}`;
    }
}

/**
 * Set calculation unit (cases or cans)
 * @param {string} unit - 'cases' or 'cans'
 */
export function setUnit(unit) {
    state.selectedUnit = unit;
    console.log('Unit changed to:', unit);
    
    const casesBtn = document.getElementById('unit-cases-btn');
    const cansBtn = document.getElementById('unit-cans-btn');
    const unitLabel = document.getElementById('unit-label');
    
    const { unitName } = _getRecipeUnitInfo();

    if (unit === 'cases') {
        if (casesBtn) casesBtn.className = 'flex-1 py-2 px-4 rounded-lg font-semibold transition-all duration-200 bg-blue-600 text-white shadow-md';
        if (cansBtn) cansBtn.className = 'flex-1 py-2 px-4 rounded-lg font-semibold transition-all duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300';
        if (unitLabel) unitLabel.textContent = 'Cases';
    } else {
        if (casesBtn) casesBtn.className = 'flex-1 py-2 px-4 rounded-lg font-semibold transition-all duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300';
        if (cansBtn) cansBtn.className = 'flex-1 py-2 px-4 rounded-lg font-semibold transition-all duration-200 bg-blue-600 text-white shadow-md';
        if (unitLabel) unitLabel.textContent = unitName;
    }

    // Keep the toggle button label in sync with the recipe type
    if (cansBtn) cansBtn.textContent = unitName;

    _updateUnitDescription();

    // Recalculate volume for the new unit
    updateCalcVolumeFromQty();
}

// ============================================================================
// Material Calculation
// ============================================================================

/**
 * Calculate materials required for production
 */
export async function calculateMaterials() {
    const name = document.getElementById('calc-recipe-select')?.value;
    let targetQty, calcUnit;
    if (_calcSource === 'volume') {
        const volInput = document.getElementById('calc-volume');
        const info = getBottleSizeInfo(name);
        const totalVolume = parseFloat(volInput?.value) || 0;
        const perCaseVolume = info ? info.perCase * (info.sizeMl / 1000) : 1;
        targetQty = perCaseVolume > 0 ? totalVolume / perCaseVolume : 0;
        calcUnit = 'cases';
    } else {
        targetQty = parseFloat(document.getElementById('calc-target-qty')?.value);
        calcUnit = state.selectedUnit;
    }
    const loader = document.getElementById('loader-calc');
    const tbody = document.getElementById('calc-results-body');

    if (!name) return alert("Please select a recipe");
    if (!targetQty || targetQty <= 0) return alert("Please enter a valid target quantity");

    console.log('Calculating with:', { recipe: name, qty: targetQty, unit: calcUnit, source: _calcSource });

    if (loader) loader.style.display = 'block';

    try {
        const requestBody = {
            recipe_name: name,
            target_qty: targetQty,
            unit: calcUnit
        };
        console.log('Sending request:', requestBody);
        
        const response = await authenticatedFetch('/api/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Calculation failed");
        }

        const result = await response.json();
        console.log('Received result:', result);
        
        // Render results
        if (tbody) {
            tbody.innerHTML = '';
            
            if (result.items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-8 text-center text-gray-500">No items found in this recipe</td></tr>';
            }

            // First pass: Calculate total cost
            let totalActualCost = 0;
            const itemsData = [];

            result.items.forEach(item => {
                const sageQty = item.sage_qty !== undefined ? item.sage_qty : 0;
                const toOrder = item.to_order !== undefined ? item.to_order : 0;
                const remaining = item.remaining !== undefined ? item.remaining : 0;
                const unitCost = item.unit_cost !== undefined ? item.unit_cost : 0;
                const actualCost = unitCost * item.calculated_qty;
                
                totalActualCost += actualCost;
                
                itemsData.push({ item, sageQty, toOrder, remaining, unitCost, actualCost });
            });

            // Second pass: Render rows with percentages
            itemsData.forEach(data => {
                const { item, sageQty, toOrder, remaining, unitCost, actualCost } = data;
                const row = document.createElement('tr');
                row.className = 'hover:bg-gray-50 transition-colors';
                
                const isShort = toOrder > 0;
                const sageClass = isShort ? "text-red-600 font-bold" : "text-green-600 font-bold";
                const toOrderClass = isShort ? "text-red-600 font-bold" : "text-gray-400";
                
                // Calculate percentage
                const percentage = totalActualCost > 0 ? (actualCost / totalActualCost * 100) : 0;

                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${item.item_code}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${item.description || '-'}</td>
                    <td class="cost-column px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-700"><span class="whitespace-nowrap">AED ${unitCost.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</span></td>
                    <td class="px-6 py-4 whitespace-nowrap text-base text-blue-700 font-bold text-right font-mono">${item.calculated_qty.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                    <td class="cost-column px-6 py-4 whitespace-nowrap text-base text-purple-700 font-bold text-right font-mono"><span class="whitespace-nowrap">AED ${actualCost.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</span></td>
                    <td class="cost-column px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-orange-600 font-semibold">${percentage.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}%</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-mono ${sageClass}">${sageQty.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-mono ${toOrderClass}">${toOrder > 0 ? toOrder.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4}) : '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-gray-700">${remaining.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                `;
                tbody.appendChild(row);
            });
            
            // Add total row
            if (result.items.length > 0) {
                const totalRow = document.createElement('tr');
                totalRow.className = 'bg-purple-50 border-t-2 border-purple-300';
                totalRow.className = 'cost-column bg-purple-50 border-t-2 border-purple-300';
                totalRow.innerHTML = `
                    <td colspan="4" class="px-6 py-4 text-right font-bold text-gray-900 text-lg">TOTAL ACTUAL COST:</td>
                    <td class="px-6 py-4 whitespace-nowrap text-xl text-purple-700 font-bold text-right font-mono"><span class="whitespace-nowrap">AED ${totalActualCost.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</span></td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-right font-mono text-orange-600 font-bold">100.00%</td>
                    <td colspan="3"></td>
                `;
                tbody.appendChild(totalRow);
            }

            if (window.updateCostColumnVisibility) window.updateCostColumnVisibility();
        }

        // Update Meta
        const metaDiv = document.getElementById('calc-result-meta');
        if (metaDiv) metaDiv.classList.remove('hidden');
        
        // Validation Summary
        const sumDiv = document.getElementById('calc-validation-summary');
        if (sumDiv) {
            const itemsToOrder = result.items.filter(i => i.to_order > 0);
            const allAvailable = itemsToOrder.length === 0;
            
            // Show conversion info
            let conversionInfo = '';
            const { perCase, unitName } = _getRecipeUnitInfo();
            
            if (state.selectedUnit === 'cases') {
                const totalUnits = targetQty * perCase;
                conversionInfo = `<div class="bg-blue-50 border border-blue-300 rounded-lg p-4 mb-4">
                    <div class="text-sm text-blue-600 font-semibold mb-1">📦 CALCULATION MODE: CASES</div>
                    <div class="flex items-center gap-2">
                        <span class="text-blue-900 font-bold text-xl">${targetQty.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})} Cases</span>
                        <span class="text-blue-600 text-sm">(${totalUnits.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})} ${unitName})</span>
                    </div>
                    <div class="text-xs text-blue-600 mt-1">Materials calculated as-is</div>
                </div>`;
            } else {
                conversionInfo = `<div class="bg-green-50 border border-green-300 rounded-lg p-4 mb-4">
                    <div class="text-sm text-green-600 font-semibold mb-1">🥫 CALCULATION MODE: ${unitName.toUpperCase()}</div>
                    <div class="flex items-center gap-2">
                        <span class="text-green-900 font-bold text-xl">${targetQty.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})} ${unitName}</span>
                    </div>
                    <div class="text-xs text-green-700 mt-1 font-semibold">⚠️ Materials divided by ${perCase} (1 ${unitName.toLowerCase().slice(0, -1)} = 1/${perCase} of case materials)</div>
                </div>`;
            }
            
            let summaryHtml = conversionInfo + `
                <div class="flex gap-8 text-gray-700 mb-4">
                    <span>Total Items: <b>${result.items.length}</b></span>
                    <span class="text-green-600">Available: <b>${result.items.length - itemsToOrder.length}</b></span>
                    <span class="text-red-600">Shortage: <b>${itemsToOrder.length}</b></span>
                </div>
            `;

            if (!allAvailable) {
                summaryHtml += `
                    <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                        <h4 class="font-bold text-red-700 mb-2">❌ RAW MATERIALS NOT AVAILABLE - ORDER MORE</h4>
                        <p class="text-sm text-red-600 mb-2">Items needing attention: ${itemsToOrder.length}</p>
                        <ul class="space-y-1">
                `;
                
                itemsToOrder.forEach(item => {
                    const desc = (item.description && String(item.description).trim())
                        ? item.description
                        : '(no description in inventory)';
                    summaryHtml += `
                        <li class="text-sm text-red-700 flex justify-between gap-4 border-b border-red-100 py-1">
                            <span>• <b>${item.item_code}</b> - <span class="font-normal text-red-600">${desc}</span></span>
                            <span class="shrink-0">Need <b>${item.to_order.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</b> more units</span>
                        </li>
                    `;
                });
                
                summaryHtml += `</ul></div>`;
            } else {
                summaryHtml += `
                    <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h4 class="font-bold text-green-700">✓ ALL MATERIALS AVAILABLE FOR PRODUCTION</h4>
                        <p class="text-sm text-green-600 mb-3">You can proceed with production!</p>
                        <div class="mb-3">
                            <label for="calc-batch-no" class="block text-sm font-semibold text-slate-700 mb-1">Batch Number</label>
                            <input type="text" id="calc-batch-no" placeholder="Enter batch number (e.g. D12345)"
                                class="w-full rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm px-4 py-2.5">
                        </div>
                        <div class="mb-3">
                            <label for="calc-tank-no" class="block text-sm font-semibold text-slate-700 mb-1">Tank No</label>
                            <input type="text" id="calc-tank-no" placeholder="Enter tank number"
                                class="w-full rounded-lg border border-slate-300 focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-sm px-4 py-2.5">
                            <p id="calc-tank-cip-warn" class="hidden mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1"></p>
                        </div>
                        <button id="push-to-production-btn" onclick="showPushToProductionModal()" disabled
                            class="bg-black hover:bg-gray-800 text-white font-medium py-2 px-4 rounded-lg transition-all flex items-center gap-2 border-2 border-black hover:border-red-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-black">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            Push to Production
                        </button>
                    </div>
                `;
            }

            sumDiv.innerHTML = summaryHtml;
            sumDiv.classList.remove('hidden');
            if (allAvailable) {
                _attachCalcBatchTankListeners();
                applyCalcEditModeToSuccessPanel();
            }
        }

    } catch (error) {
        console.error(error);
        const sumDiv = document.getElementById('calc-validation-summary');
        if (sumDiv) {
            sumDiv.innerHTML = `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                    <h4 class="font-bold">Error</h4>
                    <p class="text-sm">${error.message}</p>
                </div>
            `;
            sumDiv.classList.remove('hidden');
        } else {
            alert("Error calculating materials: " + error.message);
        }
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

// ============================================================================
// PDF Export
// ============================================================================

/**
 * Export calculation results as PDF
 */
export async function exportCalculationPDF() {
    const name = document.getElementById('calc-recipe-select')?.value;
    const targetQty = parseFloat(document.getElementById('calc-target-qty')?.value);
    const loader = document.getElementById('loader-calc-pdf');
    
    if (!name || !targetQty) return;
    if (!document.getElementById('calc-batch-no')?.value?.trim()) { alert('Please enter a batch number first'); return; }
    
    if (loader) loader.style.display = 'block';
    
    try {
        const batchNo = document.getElementById('calc-batch-no')?.value?.trim() || '';
        const response = await authenticatedFetch('/api/calculate-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipe_name: name,
                target_qty: targetQty,
                unit: state.selectedUnit,
                batch_no: batchNo
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to generate PDF");
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${batchNo}_StockRequisition_${name.replace(/ /g, '_')}_${Math.round(targetQty)}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        
    } catch (e) {
        alert("Error exporting PDF: " + e.message);
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

/**
 * Export picking sheet (Excel-format) PDF from calculator
 */
export async function exportCalculationPickingSheet() {
    const name = document.getElementById('calc-recipe-select')?.value;
    const targetQty = parseFloat(document.getElementById('calc-target-qty')?.value);
    const loader = document.getElementById('loader-calc-ps');

    if (!name || !targetQty) return;
    if (!document.getElementById('calc-batch-no')?.value?.trim()) { alert('Please enter a batch number first'); return; }

    if (loader) loader.style.display = 'block';

    try {
        const batchNo = document.getElementById('calc-batch-no')?.value?.trim() || '';
        const tankNo = document.getElementById('calc-tank-no')?.value?.trim() || '';
        const response = await authenticatedFetch('/api/calculate-picking-sheet', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipe_name: name,
                target_qty: targetQty,
                unit: state.selectedUnit,
                batch_no: batchNo,
                tank_no: tankNo
            })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to generate Picking Sheet");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${batchNo}_PickingSheet_${name.replace(/ /g, '_')}_${Math.round(targetQty)}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    } catch (e) {
        alert("Error exporting Picking Sheet: " + e.message);
    } finally {
        if (loader) loader.style.display = 'none';
    }
}
