/**
 * Demo Plant LLC - Recipes Module
 * Handles recipe management, validation, and export
 */

import { debounce, showToast, state } from '../utils.js?v=20260125h';
import { authenticatedFetch, hasAnyRole } from '../auth.js?v=20260428b';

// ============================================================================
// RTD Ratio & Volume Helpers
// ============================================================================

/**
 * Determine RTD ratio from recipe name.
 * Returns { ingredient: 1, water: X } where ratio is 1:X
 *   - Frutesca Apple / Spencer's Apple → 1:3
 *   - Frutesca Mango / Guava / Pineapple → 1:1
 *   - Everything else → 1:5
 */
export function getRtdRatio(recipeName) {
    if (!recipeName) return { ingredient: 1, water: 5 };
    const n = recipeName.toLowerCase();

    // 1:1 – Frutesca Mango / Guava / Pineapple (check BEFORE apple, since "pineapple" contains "apple")
    if (n.includes('frutesca') && (n.includes('mango') || n.includes('guava') || n.includes('pineapple'))) {
        return { ingredient: 1, water: 1 };
    }

    // 1:3 – Frutesca Apple or Spencer's Apple
    if ((n.includes('frutesca') && n.includes('apple')) ||
        (n.includes('spencer') && n.includes('apple'))) {
        return { ingredient: 1, water: 3 };
    }

    // Default 1:5
    return { ingredient: 1, water: 5 };
}

/**
 * Extract bottle/can size and bottles-per-case from recipe name.
 * Returns { sizeMl: number, perCase: number } or null if undetectable.
 */
export function getBottleSizeInfo(recipeName) {
    if (!recipeName) return null;
    const n = recipeName.toLowerCase();

    // Match "2.5l" or "2.5 l"
    if (/2[\.\,]5\s*l/i.test(n)) {
        return { sizeMl: 2500, perCase: 6 };
    }
    // Match e.g. "500ml", "300ml", "330ml"
    const mlMatch = n.match(/(\d+)\s*ml/i);
    if (mlMatch) {
        return { sizeMl: parseInt(mlMatch[1], 10), perCase: 24 };
    }
    return null;
}

/**
 * Recalculate volume from cases and update the Volume input + RTD display.
 */
export function updateVolumeFromCases() {
    const recipeName = state.currentRecipeName || '';
    const info = getBottleSizeInfo(recipeName);
    const casesInput = document.getElementById('recipe-base-qty');
    const volInput = document.getElementById('recipe-volume');
    if (!info || !casesInput || !volInput) { updateRtdDisplay(recipeName, null); return; }

    const cases = parseFloat(casesInput.value) || 0;
    const totalVolume = cases * info.perCase * (info.sizeMl / 1000);
    volInput.value = totalVolume ? totalVolume : '';
    updateRtdDisplay(recipeName, totalVolume);
}

/**
 * Recalculate cases from volume and update the Cases input + RTD display.
 */
export function updateCasesFromVolume() {
    const recipeName = state.currentRecipeName || '';
    const info = getBottleSizeInfo(recipeName);
    const casesInput = document.getElementById('recipe-base-qty');
    const volInput = document.getElementById('recipe-volume');
    if (!info || !casesInput || !volInput) { updateRtdDisplay(recipeName, null); return; }

    const totalVolume = parseFloat(volInput.value) || 0;
    const perCaseVolume = info.perCase * (info.sizeMl / 1000);
    const cases = perCaseVolume > 0 ? totalVolume / perCaseVolume : 0;
    casesInput.value = cases ? cases : '';
    // Also mark dirty since cases changed
    if (typeof window.markRecipeDirty === 'function') window.markRecipeDirty();
    updateRtdDisplay(recipeName, totalVolume);
}

/**
 * Update the RTD ratio display panel with ingredient/water volumes.
 */
function updateRtdDisplay(recipeName, totalVolume) {
    const container = document.getElementById('rtd-ratio-display');
    if (!container) return;

    const info = getBottleSizeInfo(recipeName);
    if (!recipeName || !info) {
        container.classList.add('hidden');
        return;
    }

    const ratio = getRtdRatio(recipeName);
    const ratioSum = ratio.ingredient + ratio.water;

    container.classList.remove('hidden');
    document.getElementById('rtd-ratio-label').textContent = `RTD ${ratio.ingredient}:${ratio.water}`;

    if (totalVolume && totalVolume > 0) {
        const ingredientVol = totalVolume / ratioSum;
        const waterVol = totalVolume - ingredientVol;
        document.getElementById('rtd-ingredient-vol').textContent = ingredientVol.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + ' L';
        document.getElementById('rtd-water-vol').textContent = waterVol.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 }) + ' L';
    } else {
        document.getElementById('rtd-ingredient-vol').textContent = '-';
        document.getElementById('rtd-water-vol').textContent = '-';
    }
}

// Expose to window for inline oninput handlers in HTML
window.__recipeUpdateVolumeFromCases = updateVolumeFromCases;
window.__recipeUpdateCasesFromVolume = updateCasesFromVolume;

// ============================================================================
// Recipe Editor Panel Helpers
// ============================================================================

/**
 * Show the recipe editor panel and shrink the list panel
 */
export function showRecipeEditorPanel() {
    const listPanel = document.getElementById('recipe-list-panel');
    const editorPanel = document.getElementById('recipe-editor-panel');
    if (listPanel) {
        listPanel.classList.remove('col-span-12');
        listPanel.classList.add('col-span-4');
    }
    if (editorPanel) {
        editorPanel.classList.remove('hidden');
    }
}

/**
 * Mark the current recipe as dirty (unsaved changes) and enable Save button
 */
export function markRecipeDirty() {
    state.recipeDirty = true;
    const btn = document.getElementById('btn-save-existing');
    if (btn) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}

/**
 * Mark the current recipe as clean (no unsaved changes) and disable Save button
 */
export function markRecipeClean() {
    state.recipeDirty = false;
    const btn = document.getElementById('btn-save-existing');
    if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

// ============================================================================
// Raw Material Items Cache (for dropdown)
// ============================================================================

let allRawMaterialItems = [];
let rawMaterialsLoaded = false;
let rawMaterialsLoading = false;
let activeRecipeDropdownIndex = -1;

/**
 * Load all raw material items from Sage for the item code dropdown.
 * Uses /api/sage-entries/items endpoint (same as sage entries module).
 * Cached after first load.
 */
async function loadRawMaterialItems() {
    if (rawMaterialsLoaded || rawMaterialsLoading) return;
    rawMaterialsLoading = true;
    
    try {
        const response = await authenticatedFetch('/api/sage-entries/items');
        if (!response.ok) throw new Error('Failed to load items');
        
        const items = await response.json();
        allRawMaterialItems = items
            .filter(item => item.item_code)
            .map(item => ({
                code: item.item_code,
                description: item.description || '',
                unitCost: item.unit_cost || 0
            }));
        
        rawMaterialsLoaded = true;
        console.log(`✓ Recipe module: Loaded ${allRawMaterialItems.length} items for dropdown`);
    } catch (error) {
        console.error('Error loading raw materials for recipe dropdown:', error);
        // Fallback to /api/inventory
        try {
            const rmResponse = await authenticatedFetch('/api/inventory');
            if (rmResponse.ok) {
                const rmData = await rmResponse.json();
                allRawMaterialItems = rmData
                    .filter(item => item['Item Code'] || item.item_code)
                    .map(item => ({
                        code: item['Item Code'] || item.item_code || '',
                        description: item['Item Description'] || item.description || '',
                        unitCost: parseFloat(item['Unit Cost'] || item.unit_cost || 0) || 0
                    }))
                    .sort((a, b) => a.code.localeCompare(b.code));
                rawMaterialsLoaded = true;
                console.log(`✓ Recipe module: Loaded ${allRawMaterialItems.length} items (fallback)`);
            }
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
        }
    } finally {
        rawMaterialsLoading = false;
    }
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

/**
 * Escape string for use inside JS single-quoted attribute strings
 */
function escapeAttr(text) {
    return (text || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

/**
 * Highlight matching text in dropdown
 */
function highlightMatch(text, search) {
    if (!search) return escapeHtml(text);
    const escaped = escapeHtml(text);
    const searchLower = search.toLowerCase();
    const textLower = (text || '').toLowerCase();
    const idx = textLower.indexOf(searchLower);
    if (idx === -1) return escaped;
    const before = escapeHtml(text.substring(0, idx));
    const match = escapeHtml(text.substring(idx, idx + search.length));
    const after = escapeHtml(text.substring(idx + search.length));
    return `${before}<mark class="bg-yellow-200 rounded px-0.5">${match}</mark>${after}`;
}

/**
 * Show the item code dropdown for a specific row index
 * @param {number} index - The row index
 */
export function showRecipeItemDropdown(index) {
    // Load items if not yet loaded
    if (!rawMaterialsLoaded) {
        loadRawMaterialItems().then(() => {
            renderRecipeDropdown(index);
        });
    }
    activeRecipeDropdownIndex = index;
    renderRecipeDropdown(index);
}

/**
 * Get or create the floating dropdown element (appended to body, positioned fixed)
 */
function getOrCreateRecipeDropdownEl() {
    let el = document.getElementById('recipe-item-dropdown-floating');
    if (!el) {
        el = document.createElement('div');
        el.id = 'recipe-item-dropdown-floating';
        el.className = 'recipe-item-dropdown hidden';
        el.style.cssText = 'position:fixed;z-index:9999;width:560px;max-height:300px;overflow:hidden;background:#fff;border:1px solid #e2e8f0;border-radius:0.5rem;box-shadow:0 10px 25px -5px rgba(0,0,0,0.15),0 8px 10px -6px rgba(0,0,0,0.1);';
        el.innerHTML = `
            <div style="padding:6px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:grid;grid-template-columns:140px 1fr 80px;gap:8px;">
                <span style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Item Code</span>
                <span style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Description</span>
                <span style="font-size:10px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;text-align:right;">Cost</span>
            </div>
            <div id="recipe-item-dropdown-list" style="overflow-y:auto;max-height:250px;"></div>
        `;
        document.body.appendChild(el);
    }
    return el;
}

/**
 * Render/filter the dropdown for a specific row
 * @param {number} index - The row index
 */
function renderRecipeDropdown(index) {
    const input = document.getElementById(`recipe-item-code-${index}`);
    if (!input) return;
    
    const dropdown = getOrCreateRecipeDropdownEl();
    const listEl = document.getElementById('recipe-item-dropdown-list');
    if (!listEl) return;
    
    // Position dropdown below the input
    const rect = input.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + 4) + 'px';
    dropdown.style.left = rect.left + 'px';
    
    // Show loading if not loaded yet
    if (!rawMaterialsLoaded) {
        listEl.innerHTML = `
            <div class="px-3 py-4 text-center text-slate-400 text-sm">
                <svg class="w-5 h-5 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading items from Sage...
            </div>
        `;
        dropdown.classList.remove('hidden');
        return;
    }
    
    const searchTerm = input.value.toLowerCase().trim();
    
    const filtered = allRawMaterialItems.filter(item => {
        if (!searchTerm) return true;
        return item.code.toLowerCase().includes(searchTerm) || 
               item.description.toLowerCase().includes(searchTerm);
    });
    
    const displayItems = filtered.slice(0, 80);
    
    if (displayItems.length === 0) {
        listEl.innerHTML = `
            <div style="padding:16px;text-align:center;color:#f87171;font-size:0.875rem;font-weight:500;">
                No items found ${searchTerm ? `matching "${escapeHtml(searchTerm)}"` : ''}
            </div>
        `;
    } else {
        const totalCount = filtered.length;
        const showingCount = displayItems.length;
        const moreMsg = totalCount > showingCount 
            ? `<div style="padding:6px 12px;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #f1f5f9;background:#f8fafc;">Showing ${showingCount} of ${totalCount} items. Type to filter...</div>` 
            : '';
        
        listEl.innerHTML = displayItems.map(item => `
            <div class="recipe-dropdown-item" style="display:grid;grid-template-columns:140px 1fr 80px;gap:8px;padding:7px 12px;cursor:pointer;border-bottom:1px solid #f8fafc;transition:background 0.1s;"
                 onmouseover="this.style.background='#eff6ff'" onmouseout="this.style.background=''"
                 onmousedown="selectRecipeItem(${index}, '${escapeAttr(item.code)}', '${escapeAttr(item.description)}', ${item.unitCost || 0})">
                <span style="font-size:12px;font-family:monospace;color:#334155;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;">${highlightMatch(item.code, searchTerm)}</span>
                <span style="font-size:12px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${highlightMatch(item.description, searchTerm)}</span>
                <span style="font-size:12px;font-family:monospace;color:#94a3b8;text-align:right;">${item.unitCost ? item.unitCost : '-'}</span>
            </div>
        `).join('') + moreMsg;
    }
    
    dropdown.classList.remove('hidden');
}

/**
 * Filter the recipe dropdown as user types (called on input)
 * @param {number} index - The row index
 */
export function filterRecipeDropdown(index) {
    activeRecipeDropdownIndex = index;
    renderRecipeDropdown(index);
}

/**
 * Select an item from the recipe dropdown
 * @param {number} index - Row index
 * @param {string} code - Item code
 * @param {string} description - Item description
 * @param {number} unitCost - Unit cost
 */
export function selectRecipeItem(index, code, description, unitCost) {
    // Update item in state
    state.currentRecipeItems[index].item_code = code;
    state.currentRecipeItems[index].description = description;
    state.currentRecipeItems[index].unit_cost = unitCost;
    state.currentRecipeItems[index]._notFound = false;
    
    // Hide dropdown
    hideAllRecipeDropdowns();
    
    // Re-render
    renderRecipeItems();
    
    // Clear validation
    toggleExportButton(false);
    document.getElementById('validation-summary').classList.add('hidden');
}

/**
 * Hide all recipe item dropdowns
 */
export function hideAllRecipeDropdowns() {
    activeRecipeDropdownIndex = -1;
    const floating = document.getElementById('recipe-item-dropdown-floating');
    if (floating) floating.classList.add('hidden');
}

// Global click handler to close dropdown when clicking outside
document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('.recipe-item-code-cell') && !e.target.closest('#recipe-item-dropdown-floating')) {
        hideAllRecipeDropdowns();
    }
});

// ============================================================================
// Recipe List
// ============================================================================

/**
 * Load recipe list from API
 */
export async function loadRecipeList() {
    const listEl = document.getElementById('recipe-list');
    if (!listEl) return;
    
    listEl.innerHTML = '<div class="text-center p-4 text-gray-400">Loading...</div>';
    
    // Update UI based on user role
    updateRecipeUIForRole();
    
    // Pre-load raw materials for the item dropdown (in background)
    if (!rawMaterialsLoaded && !rawMaterialsLoading) {
        loadRawMaterialItems();
    }
    
    try {
        const response = await authenticatedFetch('/api/recipes');
        const data = await response.json();
        state.allRecipes = data.recipes;
        renderRecipeList();
    } catch (error) {
        listEl.innerHTML = '<div class="text-center p-4 text-red-400">Error loading list</div>';
    }
}

/**
 * Set recipe view mode (list or grid)
 * @param {string} mode - 'list' or 'grid'
 */
export function setRecipeView(mode) {
    state.currentViewMode = mode;
    const btnList = document.getElementById('btn-view-list');
    const btnGrid = document.getElementById('btn-view-grid');
    
    if (mode === 'list') {
        btnList.className = "p-1 rounded bg-white shadow-sm text-blue-600";
        btnGrid.className = "p-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-50";
    } else {
        btnList.className = "p-1 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-50";
        btnGrid.className = "p-1 rounded bg-white shadow-sm text-blue-600";
    }
    renderRecipeList();
}

/**
 * Set recipe filter
 * @param {string} filter - 'all', 'can', 'bottle', or 'other'
 */
export function setRecipeFilter(filter) {
    state.currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.className = "filter-btn shrink-0 text-xs font-medium px-5 py-2 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-blue-600 shadow-sm transition-all";
    });
    const activeBtn = document.getElementById(`filter-${filter}`);
    if (activeBtn) {
        activeBtn.className = "filter-btn shrink-0 text-xs font-semibold px-5 py-2 rounded-full bg-blue-600 text-white shadow-md transition-all";
    }
    renderRecipeList();
}

// PERFORMANCE: Debounced version for search input
export const debouncedRenderRecipeList = debounce(() => renderRecipeList(), 300);

/**
 * Render recipe list based on current filters
 */
export function renderRecipeList() {
    const listEl = document.getElementById('recipe-list');
    if (!listEl) return;
    
    const searchInput = document.getElementById('recipe-search');
    const searchVal = searchInput ? searchInput.value.toLowerCase() : '';
    
    // Filter
    const filtered = state.allRecipes.filter(r => {
        const name = r.name.toLowerCase();
        const matchesSearch = name.includes(searchVal);
        
        let matchesFilter = true;
        if (state.currentFilter !== 'all') {
            if (state.currentFilter === 'can') matchesFilter = name.includes('can');
            else if (state.currentFilter === 'bottle') matchesFilter = name.includes('bottle') || name.includes('pet');
            else if (state.currentFilter === 'other') matchesFilter = !name.includes('can') && !name.includes('bottle') && !name.includes('pet');
        }
        
        return matchesSearch && matchesFilter;
    });

    if (filtered.length === 0) {
        listEl.innerHTML = '<div class="text-center p-8 text-gray-400 text-sm">No recipes found</div>';
        return;
    }

    if (state.currentViewMode === 'list') {
        listEl.className = "overflow-y-auto flex-1 p-2 space-y-1";
        listEl.innerHTML = filtered.map((recipe, idx) => {
            const badge = recipe.type === 'template' 
                ? '<span class="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded border border-gray-300">Tpl</span>'
                : '<span class="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded border border-green-200">User</span>';
            
            const isActive = state.currentRecipeName === recipe.name ? 'active' : '';
            const escapedName = recipe.name.replace(/'/g, "\\'");
            
            return `
                <div onclick="loadRecipeDetails('${escapedName}')" 
                     class="recipe-item p-3 border rounded-lg cursor-pointer flex justify-between items-center transition-all ${isActive}">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-gray-400 w-6 text-center shrink-0">${idx + 1}</span>
                        <span class="recipe-item-text font-medium text-sm">${recipe.name}</span>
                    </div>
                    <div class="flex items-center gap-2">
                        ${badge}
                        <button onclick="event.stopPropagation(); deleteRecipe('${escapedName}')" 
                            class="text-gray-300 hover:text-red-500 transition-colors p-0.5 rounded" title="Delete recipe">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        // Grid View
        listEl.className = "overflow-y-auto flex-1 p-2 grid grid-cols-2 gap-2 content-start";
        listEl.innerHTML = filtered.map((recipe, idx) => {
            const badge = recipe.type === 'template' 
                 ? 'bg-gray-100 text-gray-600'
                 : 'bg-green-50 text-green-700';

            const isActive = state.currentRecipeName === recipe.name ? 'active' : '';
            const escapedName = recipe.name.replace(/'/g, "\\'");
            
            // Try to guess icon based on name
            let icon = '📄';
            const n = recipe.name.toLowerCase();
            if (n.includes('can')) icon = '🥫';
            else if (n.includes('bottle') || n.includes('pet')) icon = '🍾';

            return `
                <div onclick="loadRecipeDetails('${escapedName}')" 
                     class="recipe-item p-3 border rounded-xl cursor-pointer flex flex-col items-center justify-center text-center gap-2 transition-all ${isActive} relative">
                    <span class="absolute top-1 left-2 text-[10px] font-bold text-gray-400">${idx + 1}</span>
                    <button onclick="event.stopPropagation(); deleteRecipe('${escapedName}')" 
                        class="absolute top-1 right-1 text-gray-300 hover:text-red-500 transition-colors p-0.5 rounded" title="Delete recipe">
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                    <div class="text-2xl">${icon}</div>
                    <span class="recipe-item-text font-medium text-xs line-clamp-2 h-8 flex items-center justify-center">${recipe.name}</span>
                    <span class="text-[10px] px-2 py-0.5 rounded-full ${badge} border border-opacity-20 uppercase tracking-wide font-bold">${recipe.type === 'template' ? 'Template' : 'User'}</span>
                </div>
            `;
        }).join('');
    }
}

// ============================================================================
// Recipe Details
// ============================================================================

/**
 * Load recipe details from API
 * @param {string} name - Recipe name
 */
export async function loadRecipeDetails(name) {
    // Exit new recipe mode if active
    if (state.isNewRecipeMode) {
        state.isNewRecipeMode = false;
        document.getElementById('current-recipe-name').classList.remove('hidden');
        document.getElementById('new-recipe-name-input').classList.add('hidden');
        document.getElementById('new-recipe-badge').classList.add('hidden');
    }
    
    // Always show Save / Save As buttons, hide Save New Recipe button
    document.getElementById('btn-save-new-recipe').style.display = 'none';
    document.getElementById('btn-save-existing').style.display = '';
    document.getElementById('btn-save-recipe').style.display = '';
    
    // Exit rename mode if active
    cancelRenameRecipe();
    
    // Show the editor panel
    showRecipeEditorPanel();
    
    state.currentRecipeName = name;
    renderRecipeList(); // Re-render list to update selection highlight
    document.getElementById('current-recipe-name').textContent = name;
    document.getElementById('validation-summary').classList.add('hidden');
    toggleExportButton(false);
    
    // Show the edit-name pencil button for existing recipes
    const editNameBtn = document.getElementById('btn-edit-recipe-name');
    if (editNameBtn) {
        editNameBtn.classList.remove('hidden');
        editNameBtn.style.display = hasAnyRole(['admin', 'manager']) ? '' : 'none';
    }
    
    try {
        const response = await authenticatedFetch(`/api/recipes/${encodeURIComponent(name)}`);
        if (!response.ok) throw new Error("Failed to load");
        const data = await response.json();
        
        state.currentRecipeItems = data.items || [];
        state.currentRecipeBaseQty = data.base_qty || 1;
        
        // Populate the cases input and compute volume/RTD
        const baseQtyInput = document.getElementById('recipe-base-qty');
        if (baseQtyInput) baseQtyInput.value = state.currentRecipeBaseQty;
        updateVolumeFromCases();

        // Populate GTIN input
        const gtinInput = document.getElementById('recipe-gtin');
        if (gtinInput) gtinInput.value = data.gtin || '';
        
        renderRecipeItems();
        
        // Freshly loaded = clean
        markRecipeClean();
    } catch (error) {
        alert("Error loading recipe details");
    }
}

/**
 * Render recipe items table
 * @param {Array|null} validationResults - Validation results if available
 */
export function renderRecipeItems(validationResults = null) {
    const tbody = document.getElementById('recipe-items-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    const canEdit = hasAnyRole(['admin', 'manager']);
    
    state.currentRecipeItems.forEach((item, index) => {
        const row = document.createElement('tr');
        
        // If we have validation results, match them by item code
        let validationHtml = '<span class="text-gray-400 text-sm">-</span>';
        let rowClass = "";
        
        if (validationResults) {
            const res = validationResults.find(r => r.item_code === item.item_code);
            if (res) {
                // Update description from validation result
                if (res.description) item.description = res.description;
                
                const color = res.status.includes('AVAILABLE') ? 'text-green-600' : 'text-red-600';
                const extra = res.shortage > 0 ? `(Short: ${res.shortage.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})})` : '';
                validationHtml = `<span class="${color} font-medium">${res.status} ${extra}</span>`;
                rowClass = res.shortage > 0 ? "bg-red-50" : "";
            }
        }
        
        if (rowClass) row.className = rowClass;
        
        const unitCost = item.unit_cost !== undefined ? item.unit_cost : 0;
        const actualCost = unitCost * item.required_qty;
        
        if (canEdit) {
            const descClass = item._notFound ? 'text-red-500 font-medium' : 'text-gray-600';
            const isDropdownOpen = activeRecipeDropdownIndex === index;
            row.innerHTML = `
                <td class="px-3 py-2 text-center">
                    <span class="text-xs font-bold text-gray-400">${index + 1}</span>
                </td>
                <td class="px-6 py-2 recipe-item-code-cell">
                    <input type="text" value="${item.item_code}" 
                        id="recipe-item-code-${index}"
                        onfocus="showRecipeItemDropdown(${index})"
                        oninput="filterRecipeDropdown(${index}); updateItem(${index}, 'item_code', this.value)"
                        onkeydown="if(event.key==='Escape'){hideAllRecipeDropdowns();this.blur();} if(event.key==='Enter'){hideAllRecipeDropdowns();lookupItemCode(${index}, this.value);this.blur();}"
                        onblur="setTimeout(()=>lookupItemCode(${index}, document.getElementById('recipe-item-code-${index}')?.value), 200)"
                        placeholder="Search item code..."
                        autocomplete="off"
                        class="w-full border rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none bg-transparent text-sm">
                </td>
                <td class="px-6 py-2">
                     <span class="text-sm ${descClass} block truncate w-64" title="${item.description || ''}">${item.description || '-'}</span>
                </td>
                <td class="cost-column px-6 py-2 text-right">
                     <span class="text-sm text-gray-600 font-mono whitespace-nowrap">AED ${unitCost.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</span>
                </td>
                <td class="px-6 py-2">
                    <input type="number" step="0.0001" value="${item.required_qty}" 
                         onchange="updateItem(${index}, 'required_qty', this.value)"
                        class="w-full border rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 outline-none bg-transparent">
                </td>
                <td class="cost-column px-6 py-2 text-right">
                     <span class="text-sm text-purple-700 font-bold font-mono whitespace-nowrap">AED ${actualCost.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</span>
                </td>
                <td class="px-6 py-2 text-sm">
                    ${validationHtml}
                </td>
                <td class="px-6 py-2 text-right">
                    <button onclick="removeItem(${index})" class="text-red-400 hover:text-red-600">×</button>
                </td>
            `;
        } else {
            // Read-only view for employees/viewers
            row.innerHTML = `
                <td class="px-3 py-2 text-center">
                    <span class="text-xs font-bold text-gray-400">${index + 1}</span>
                </td>
                <td class="px-6 py-2">
                    <span class="text-sm text-gray-800">${item.item_code}</span>
                </td>
                <td class="px-6 py-2">
                     <span class="text-sm text-gray-600 block truncate w-64" title="${item.description || ''}">${item.description || '-'}</span>
                </td>
                <td class="cost-column px-6 py-2 text-right">
                     <span class="text-sm text-gray-600 font-mono whitespace-nowrap">AED ${unitCost.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</span>
                </td>
                <td class="px-6 py-2 text-right">
                    <span class="text-sm text-gray-800 font-mono">${item.required_qty}</span>
                </td>
                <td class="cost-column px-6 py-2 text-right">
                     <span class="text-sm text-purple-700 font-bold font-mono whitespace-nowrap">AED ${actualCost.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</span>
                </td>
                <td class="px-6 py-2 text-sm">
                    ${validationHtml}
                </td>
                <td class="px-6 py-2 text-right">
                    <span class="text-xs text-gray-400">-</span>
                </td>
            `;
        }
        tbody.appendChild(row);
    });

    if (window.updateCostColumnVisibility) window.updateCostColumnVisibility();
}

/**
 * Update recipe item field
 * @param {number} index - Item index
 * @param {string} field - Field name
 * @param {any} value - New value
 */
export function updateItem(index, field, value) {
    if (!hasAnyRole(['admin', 'manager'])) {
        showToast('You do not have permission to edit recipes', 'error');
        return;
    }
    if (field === 'required_qty') value = parseFloat(value);
    state.currentRecipeItems[index][field] = value;
    
    // If item_code changed, clear the old description/cost until lookup completes
    if (field === 'item_code') {
        state.currentRecipeItems[index].description = '';
        state.currentRecipeItems[index].unit_cost = 0;
        state.currentRecipeItems[index]._notFound = false;
    }
    
    // Recalculate actual cost if qty changes
    if (field === 'required_qty') {
        renderRecipeItems();
    }
    
    // Mark as dirty
    markRecipeDirty();
    
    // Clear validation when edited
    toggleExportButton(false);
    document.getElementById('validation-summary').classList.add('hidden');
}

/**
 * Add new item row to recipe
 */
export function addItemRow() {
    if (!hasAnyRole(['admin', 'manager'])) {
        showToast('You do not have permission to edit recipes', 'error');
        return;
    }
    state.currentRecipeItems.push({ item_code: "", description: "", required_qty: 0, unit_cost: 0 });
    renderRecipeItems();
    markRecipeDirty();
    toggleExportButton(false);
}

/**
 * Remove item from recipe
 * @param {number} index - Item index
 */
export function removeItem(index) {
    if (!hasAnyRole(['admin', 'manager'])) {
        showToast('You do not have permission to edit recipes', 'error');
        return;
    }
    state.currentRecipeItems.splice(index, 1);
    renderRecipeItems();
    markRecipeDirty();
    toggleExportButton(false);
}

// ============================================================================
// Recipe Actions
// ============================================================================

/**
 * Save the current recipe in place (overwrite existing)
 */
export async function saveRecipe() {
    if (!hasAnyRole(['admin', 'manager'])) {
        showToast('You do not have permission to save recipes', 'error');
        return;
    }
    
    if (!state.currentRecipeName) {
        showToast('No recipe selected. Use "Save As..." to save a new recipe.', 'error');
        return;
    }
    
    if (state.currentRecipeItems.length === 0) {
        showToast('Recipe is empty. Add at least one item.', 'error');
        return;
    }
    
    try {
        const baseQtyInput = document.getElementById('recipe-base-qty');
        const baseQty = parseFloat(baseQtyInput?.value) || 1;
        const gtinInput = document.getElementById('recipe-gtin');
        const gtin = gtinInput ? gtinInput.value.trim() || null : null;
        
        const payload = {
            name: state.currentRecipeName,
            base_qty: baseQty,
            gtin,
            items: state.currentRecipeItems.map(item => ({
                item_code: item.item_code,
                required_qty: item.required_qty || 0
            }))
        };
        
        const response = await authenticatedFetch('/api/recipes', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error("Failed to save");
        
        showToast('Recipe saved successfully!', 'success');
        markRecipeClean();
        
    } catch (e) {
        showToast('Error saving recipe: ' + e.message, 'error');
    }
}

/**
 * Open save modal
 */
export function saveRecipeAs() {
    if (!hasAnyRole(['admin', 'manager'])) {
        showToast('You do not have permission to save recipes', 'error');
        return;
    }
    if (state.currentRecipeItems.length === 0) return alert("Recipe is empty");
    document.getElementById('save-modal').classList.remove('hidden');
    document.getElementById('new-recipe-name').value = state.currentRecipeName + " Copy";
    document.getElementById('new-recipe-name').focus();
}

/**
 * Close save modal
 */
export function closeSaveModal() {
    document.getElementById('save-modal').classList.add('hidden');
}

/**
 * Confirm and save recipe
 */
export async function confirmSave() {
    const name = document.getElementById('new-recipe-name').value.trim();
    if (!name) return;
    
    try {
        // Read base_qty from the cases input
        const baseQtyInput = document.getElementById('recipe-base-qty');
        const baseQty = parseFloat(baseQtyInput?.value) || 1;
        const gtinInput = document.getElementById('recipe-gtin');
        const gtin = gtinInput ? gtinInput.value.trim() || null : null;
        
        const payload = {
            name: name,
            base_qty: baseQty,
            gtin,
            items: state.currentRecipeItems
        };
        
        const response = await authenticatedFetch('/api/recipes', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error("Failed to save");
        
        closeSaveModal();
        loadRecipeList();
        state.currentRecipeName = name;
        document.getElementById('current-recipe-name').textContent = name;
        alert("Recipe saved successfully!");
        
    } catch (e) {
        alert("Error saving recipe: " + e.message);
    }
}

/**
 * Toggle export button enabled state
 * @param {boolean} enable - Whether to enable the button
 */
export function toggleExportButton(enable) {
    const btns = [
        document.getElementById('btn-export-pdf'),
        document.getElementById('btn-export-picking-sheet'),
    ];
    for (const btn of btns) {
        if (!btn) continue;
        if (enable) {
            btn.disabled = false;
            btn.classList.remove('bg-gray-100', 'text-gray-400', 'border-gray-200', 'cursor-not-allowed');
            btn.classList.add('bg-black', 'text-white', 'border-black', 'hover:border-red-600');
        } else {
            btn.disabled = true;
            btn.classList.remove('bg-black', 'text-white', 'border-black', 'hover:border-red-600');
            btn.classList.add('bg-gray-100', 'text-gray-400', 'border-gray-200', 'cursor-not-allowed');
        }
    }
}

/**
 * Validate current recipe against inventory
 */
export async function validateCurrentRecipe() {
    if (state.currentRecipeItems.length === 0) return;
    const loader = document.getElementById('loader-val');
    if (loader) loader.style.display = 'block';
    document.getElementById('validation-summary').classList.add('hidden');
    toggleExportButton(false);
    
    // Get recipe name - from input if in new recipe mode
    let recipeName = state.currentRecipeName;
    if (state.isNewRecipeMode) {
        const nameInput = document.getElementById('new-recipe-name-input');
        recipeName = nameInput ? nameInput.value.trim() : 'New Recipe';
        if (!recipeName) recipeName = 'New Recipe';
    }
    
    try {
        const payload = {
            name: recipeName,
            items: state.currentRecipeItems
        };
        
        const response = await authenticatedFetch('/api/validate-custom', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Validation request failed");
        }
        
        const result = await response.json();
        
        // Re-render with validation results
        renderRecipeItems(result.items);
        
        // Show summary
        const sumDiv = document.getElementById('validation-summary');
        
        let summaryHtml = `
            <div class="flex gap-8 text-gray-700 mb-4">
                <span>Total Items: <b>${result.summary.total_items}</b></span>
                <span class="text-green-600">Available: <b>${result.summary.available}</b></span>
                <span class="text-red-600">Shortage: <b>${result.summary.not_available}</b></span>
            </div>
        `;

        if (!result.all_available && result.items_to_order && result.items_to_order.length > 0) {
             summaryHtml += `
                <div class="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 class="font-bold text-red-700 mb-2">❌ RAW MATERIALS NOT AVAILABLE - ORDER MORE</h4>
                    <p class="text-sm text-red-600 mb-2">Items needing attention: ${result.items_to_order.length}</p>
                    <ul class="space-y-1">
             `;
             
             result.items_to_order.forEach(item => {
                 summaryHtml += `
                    <li class="text-sm text-red-700 flex justify-between border-b border-red-100 py-1">
                        <span>• <b>${item.item_code}</b></span>
                        <span>Need <b>${item.order_qty.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</b> more units</span>
                    </li>
                 `;
             });
             
             summaryHtml += `</ul></div>`;
        } else if (result.all_available) {
            summaryHtml += `
                <div class="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 class="font-bold text-green-700">✓ ALL MATERIALS AVAILABLE FOR PRODUCTION</h4>
                    <p class="text-sm text-green-600">You can proceed with production!</p>
                </div>
            `;
            // Enable Export Button
            toggleExportButton(true);
        }

        sumDiv.innerHTML = summaryHtml;
        sumDiv.classList.remove('hidden');
        
    } catch (e) {
        // Show error in the summary box instead of alert
        const sumDiv = document.getElementById('validation-summary');
        sumDiv.innerHTML = `
            <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                <h4 class="font-bold flex items-center gap-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    Validation Error
                </h4>
                <p class="mt-1 text-sm">${e.message}</p>
                <p class="mt-2 text-xs text-red-500">Try refreshing the page or checking your connection.</p>
            </div>
        `;
        sumDiv.classList.remove('hidden');
    } finally {
        if (loader) loader.style.display = 'none';
    }
}

/**
 * Export picking sheet as PDF
 */
export async function exportPickingSheet() {
    if (!hasAnyRole(['admin', 'manager', 'employee'])) {
        showToast('You do not have permission to export picking sheets', 'error');
        return;
    }
    
    const loader = document.getElementById('loader-pdf');
    if (loader) loader.style.display = 'block';
    
    // Get recipe name - from input if in new recipe mode
    let recipeName = state.currentRecipeName;
    if (state.isNewRecipeMode) {
        const nameInput = document.getElementById('new-recipe-name-input');
        recipeName = nameInput ? nameInput.value.trim() : 'New Recipe';
        if (!recipeName) recipeName = 'New Recipe';
    }
    
    try {
        const payload = {
            name: recipeName,
            items: state.currentRecipeItems
        };
        
        const response = await authenticatedFetch('/api/picking-sheet', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to generate PDF");
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Picking_Sheet_${recipeName.replace(/ /g, '_')}.pdf`;
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
 * Export picking sheet (Excel-format) as PDF
 */
export async function exportPickingSheetExcel() {
    if (!hasAnyRole(['admin', 'manager', 'employee'])) {
        showToast('You do not have permission to export picking sheets', 'error');
        return;
    }

    const loader = document.getElementById('loader-picking-sheet');
    if (loader) loader.style.display = 'block';

    let recipeName = state.currentRecipeName;
    if (state.isNewRecipeMode) {
        const nameInput = document.getElementById('new-recipe-name-input');
        recipeName = nameInput ? nameInput.value.trim() : 'New Recipe';
        if (!recipeName) recipeName = 'New Recipe';
    }

    try {
        const payload = {
            name: recipeName,
            items: state.currentRecipeItems,
            base_qty: parseFloat(document.getElementById('recipe-base-qty')?.value) || 1
        };

        const response = await authenticatedFetch('/api/picking-sheet-excel', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to generate Picking Sheet");
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Picking_Sheet_${recipeName.replace(/ /g, '_')}.pdf`;
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

// ============================================================================
// Create New Recipe
// ============================================================================

/**
 * Start creating a new recipe from scratch (admin/manager only)
 */
export function createNewRecipe() {
    if (!hasAnyRole(['admin', 'manager'])) {
        showToast('You do not have permission to create recipes', 'error');
        return;
    }

    // Show the editor panel
    showRecipeEditorPanel();

    // Enter new recipe mode
    state.isNewRecipeMode = true;
    state.currentRecipeName = '';
    state.currentRecipeItems = [];
    state.currentRecipeBaseQty = 1;
    
    // Reset cases, volume, and GTIN inputs to default
    const baseQtyInput = document.getElementById('recipe-base-qty');
    if (baseQtyInput) baseQtyInput.value = 1;
    const volInput = document.getElementById('recipe-volume');
    if (volInput) volInput.value = '';
    const gtinInput = document.getElementById('recipe-gtin');
    if (gtinInput) gtinInput.value = '';
    // Hide RTD display (no recipe selected yet)
    const rtdDisplay = document.getElementById('rtd-ratio-display');
    if (rtdDisplay) rtdDisplay.classList.add('hidden');
    
    // Show name input, hide static name
    document.getElementById('current-recipe-name').classList.add('hidden');
    const nameInput = document.getElementById('new-recipe-name-input');
    nameInput.classList.remove('hidden');
    nameInput.value = '';
    nameInput.focus();
    
    // Hide edit-name button & rename controls
    const editNameBtn = document.getElementById('btn-edit-recipe-name');
    if (editNameBtn) { editNameBtn.classList.add('hidden'); editNameBtn.style.display = 'none'; }
    document.getElementById('rename-recipe-input').classList.add('hidden');
    document.getElementById('btn-confirm-rename').classList.add('hidden');
    document.getElementById('btn-cancel-rename').classList.add('hidden');
    
    // Show new recipe badge
    document.getElementById('recipe-badge').classList.add('hidden');
    document.getElementById('new-recipe-badge').classList.remove('hidden');
    
    // Show save new recipe button, hide save/save-as buttons
    document.getElementById('btn-save-new-recipe').style.display = '';
    document.getElementById('btn-save-existing').style.display = 'none';
    document.getElementById('btn-save-recipe').style.display = 'none';
    
    // Clear validation
    document.getElementById('validation-summary').classList.add('hidden');
    toggleExportButton(false);
    
    // Render empty table with instruction
    const tbody = document.getElementById('recipe-items-body');
    tbody.innerHTML = `
        <tr>
            <td colspan="8" class="px-6 py-12 text-center text-gray-400">
                <div class="flex flex-col items-center gap-3">
                    <svg class="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4"></path>
                    </svg>
                    <p class="text-sm">Click <b>+ Add Item</b> to start building your recipe</p>
                    <p class="text-xs text-gray-400">Enter item codes and they will be validated against the Sage raw material list</p>
                </div>
            </td>
        </tr>
    `;
    
    // Deselect any recipe in the list
    document.querySelectorAll('.recipe-item').forEach(el => el.classList.remove('active'));
}

/**
 * Delete a recipe (soft-delete: archived to MongoDB, removed from Excel listing)
 * @param {string} name - Recipe name to delete
 */
export async function deleteRecipe(name) {
    if (!confirm(`Are you sure you want to delete the recipe "${name}"?\n\nThis will remove it from the list. The data will be archived in the database.`)) {
        return;
    }
    
    try {
        const response = await authenticatedFetch(`/api/recipes/${encodeURIComponent(name)}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to delete recipe');
        }
        
        showToast(`Recipe "${name}" deleted successfully`, 'success');
        
        // If the deleted recipe was currently selected, hide the editor panel
        if (state.currentRecipeName === name) {
            state.currentRecipeName = '';
            state.currentRecipeItems = [];
            state.currentRecipeBaseQty = 1;
            document.getElementById('current-recipe-name').textContent = 'Select a recipe';
            document.getElementById('recipe-base-qty').value = 1;
            const volInputDel = document.getElementById('recipe-volume');
            if (volInputDel) volInputDel.value = '';
            const rtdDisplayDel = document.getElementById('rtd-ratio-display');
            if (rtdDisplayDel) rtdDisplayDel.classList.add('hidden');
            document.getElementById('validation-summary').classList.add('hidden');
            const editBtn = document.getElementById('btn-edit-recipe-name');
            if (editBtn) { editBtn.classList.add('hidden'); editBtn.style.display = 'none'; }
            toggleExportButton(false);
            
            // Hide editor panel and expand list
            const listPanel = document.getElementById('recipe-list-panel');
            const editorPanel = document.getElementById('recipe-editor-panel');
            if (listPanel) {
                listPanel.classList.remove('col-span-4');
                listPanel.classList.add('col-span-12');
            }
            if (editorPanel) {
                editorPanel.classList.add('hidden');
            }
        }
        
        // Reload the recipe list (serial numbers auto-update)
        await loadRecipeList();
        
    } catch (e) {
        showToast('Error deleting recipe: ' + e.message, 'error');
    }
}

// ============================================================================
// Recipe Rename
// ============================================================================

/**
 * Enter rename mode for the currently loaded recipe
 */
export function editRecipeName() {
    if (!hasAnyRole(['admin', 'manager'])) {
        showToast('You do not have permission to rename recipes', 'error');
        return;
    }
    if (!state.currentRecipeName) return;
    
    // Hide static name & edit button, show rename input + confirm/cancel
    document.getElementById('current-recipe-name').classList.add('hidden');
    const editBtn = document.getElementById('btn-edit-recipe-name');
    if (editBtn) { editBtn.classList.add('hidden'); editBtn.style.display = 'none'; }
    
    const renameInput = document.getElementById('rename-recipe-input');
    renameInput.classList.remove('hidden');
    renameInput.value = state.currentRecipeName;
    renameInput.focus();
    renameInput.select();
    
    document.getElementById('btn-confirm-rename').classList.remove('hidden');
    document.getElementById('btn-cancel-rename').classList.remove('hidden');
}

/**
 * Cancel rename and restore static name display
 */
export function cancelRenameRecipe() {
    const renameInput = document.getElementById('rename-recipe-input');
    const nameEl = document.getElementById('current-recipe-name');
    
    if (renameInput) renameInput.classList.add('hidden');
    if (nameEl) nameEl.classList.remove('hidden');
    
    const confirmBtn = document.getElementById('btn-confirm-rename');
    const cancelBtn = document.getElementById('btn-cancel-rename');
    if (confirmBtn) confirmBtn.classList.add('hidden');
    if (cancelBtn) cancelBtn.classList.add('hidden');
    
    // Re-show edit button if a recipe is loaded
    const editBtn = document.getElementById('btn-edit-recipe-name');
    if (editBtn) {
        const show = state.currentRecipeName && hasAnyRole(['admin', 'manager']);
        editBtn.classList.remove('hidden');
        editBtn.style.display = show ? '' : 'none';
    }
}

/**
 * Confirm rename: call backend PATCH and update UI
 */
export async function confirmRenameRecipe() {
    const renameInput = document.getElementById('rename-recipe-input');
    const newName = renameInput ? renameInput.value.trim() : '';
    
    if (!newName) {
        showToast('Recipe name cannot be empty', 'error');
        return;
    }
    
    if (newName === state.currentRecipeName) {
        cancelRenameRecipe();
        return;
    }
    
    try {
        const response = await authenticatedFetch(`/api/recipes/${encodeURIComponent(state.currentRecipeName)}/rename`, {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ new_name: newName })
        });
        
        if (!response.ok) {
            const err = await response.json().catch(() => ({ detail: 'Failed to rename recipe' }));
            throw new Error(err.detail || 'Failed to rename recipe');
        }
        
        const result = await response.json();
        const finalName = result.new_name || newName;
        
        showToast(`Recipe renamed to "${finalName}"`, 'success');
        
        // Update state and UI
        state.currentRecipeName = finalName;
        document.getElementById('current-recipe-name').textContent = finalName;
        cancelRenameRecipe();
        
        // Reload the list to reflect the new name
        await loadRecipeList();
        
    } catch (e) {
        showToast('Error renaming recipe: ' + e.message, 'error');
    }
}

/**
 * Look up an item code from Sage raw materials.
 * First checks the already-loaded dropdown cache (sourced from Sage SQL directly),
 * then falls back to the API endpoint.
 * @param {number} index - The row index of the item being looked up
 * @param {string} itemCode - The item code to look up
 */
export async function lookupItemCode(index, itemCode) {
    if (!itemCode || !itemCode.trim()) return;
    
    const trimmedCode = itemCode.trim();
    
    // Skip lookup if description is already loaded for this exact code
    const currentItem = state.currentRecipeItems[index];
    if (currentItem && currentItem.item_code === trimmedCode && currentItem.description && !currentItem._notFound) {
        return;
    }
    
    // --- Check local dropdown cache first (loaded from Sage SQL via /api/sage-entries/items) ---
    if (allRawMaterialItems.length > 0) {
        const cached = allRawMaterialItems.find(i => i.code.toLowerCase() === trimmedCode.toLowerCase());
        if (cached) {
            state.currentRecipeItems[index].item_code = cached.code;
            state.currentRecipeItems[index].description = cached.description;
            state.currentRecipeItems[index].unit_cost = cached.unitCost || 0;
            state.currentRecipeItems[index]._notFound = false;
            renderRecipeItems();
            return;
        }
    }
    
    // --- Fall back to API lookup ---
    try {
        const response = await authenticatedFetch(`/api/item-lookup/${encodeURIComponent(trimmedCode)}`);
        
        if (response.ok) {
            const data = await response.json();
            // Update the item in state
            state.currentRecipeItems[index].item_code = data.item_code;
            state.currentRecipeItems[index].description = data.description;
            state.currentRecipeItems[index].unit_cost = data.unit_cost;
            state.currentRecipeItems[index]._notFound = false;
            // Re-render to show the updated info
            renderRecipeItems();
        } else if (response.status === 404) {
            // Item not found - show inline error
            state.currentRecipeItems[index].description = '⚠ NOT FOUND in Sage';
            state.currentRecipeItems[index].unit_cost = 0;
            state.currentRecipeItems[index]._notFound = true;
            renderRecipeItems();
            showToast(`Item code "${trimmedCode}" not found in Sage raw material list`, 'error');
        }
    } catch (error) {
        console.error('Item lookup error:', error);
        showToast('Error looking up item code', 'error');
    }
}

/**
 * Save a new recipe that was created from scratch
 */
export async function saveNewRecipe() {
    if (!hasAnyRole(['admin', 'manager'])) {
        showToast('You do not have permission to save recipes', 'error');
        return;
    }
    
    const nameInput = document.getElementById('new-recipe-name-input');
    const name = nameInput.value.trim();
    
    if (!name) {
        showToast('Please enter a recipe name', 'error');
        nameInput.focus();
        return;
    }
    
    if (state.currentRecipeItems.length === 0) {
        showToast('Recipe is empty. Add at least one item.', 'error');
        return;
    }
    
    // Check if any items are not found
    const notFoundItems = state.currentRecipeItems.filter(item => item._notFound);
    if (notFoundItems.length > 0) {
        showToast('Some item codes are not found in Sage. Please correct them before saving.', 'error');
        return;
    }
    
    // Check for empty item codes
    const emptyItems = state.currentRecipeItems.filter(item => !item.item_code || !item.item_code.trim());
    if (emptyItems.length > 0) {
        showToast('Some items have empty item codes. Please fill them in or remove those rows.', 'error');
        return;
    }
    
    try {
        // Read base_qty from the cases input
        const baseQtyInput = document.getElementById('recipe-base-qty');
        const baseQty = parseFloat(baseQtyInput?.value) || 1;
        const gtinInput = document.getElementById('recipe-gtin');
        const gtin = gtinInput ? gtinInput.value.trim() || null : null;
        
        const payload = {
            name: name,
            base_qty: baseQty,
            gtin,
            items: state.currentRecipeItems.map(item => ({
                item_code: item.item_code,
                required_qty: item.required_qty || 0
            }))
        };
        
        const response = await authenticatedFetch('/api/recipes', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) throw new Error("Failed to save");
        
        // Exit new recipe mode
        exitNewRecipeMode();
        
        // Reload the recipe list and select the new recipe
        state.currentRecipeName = name;
        document.getElementById('current-recipe-name').textContent = name;
        loadRecipeList();
        showToast('Recipe saved successfully!', 'success');
        
    } catch (e) {
        showToast('Error saving recipe: ' + e.message, 'error');
    }
}

/**
 * Exit new recipe creation mode and restore normal UI
 */
function exitNewRecipeMode() {
    state.isNewRecipeMode = false;
    
    // Show static name, hide input
    document.getElementById('current-recipe-name').classList.remove('hidden');
    document.getElementById('new-recipe-name-input').classList.add('hidden');
    
    // Hide new recipe badge
    document.getElementById('new-recipe-badge').classList.add('hidden');
    
    // Hide save new recipe button, show save/save-as buttons
    document.getElementById('btn-save-new-recipe').style.display = 'none';
    document.getElementById('btn-save-existing').style.display = '';
    document.getElementById('btn-save-recipe').style.display = '';
    
    // Show the edit-name button if a recipe is now selected
    const editNameBtn = document.getElementById('btn-edit-recipe-name');
    if (editNameBtn) {
        const show = state.currentRecipeName && hasAnyRole(['admin', 'manager']);
        editNameBtn.classList.remove('hidden');
        editNameBtn.style.display = show ? '' : 'none';
    }
}

// ============================================================================
// Role-Based UI Updates
// ============================================================================

/**
 * Update recipe UI elements based on user role
 * - Admin/Manager: Full access to all buttons
 * - Employee: Can only validate and export PDF
 * - Viewer: Can only view (no buttons)
 */
export function updateRecipeUIForRole() {
    const canEdit = hasAnyRole(['admin', 'manager']);
    const canExport = hasAnyRole(['admin', 'manager', 'employee']);
    
    // Hide/show Add Item button
    const addItemBtn = document.getElementById('btn-add-item');
    if (addItemBtn) {
        addItemBtn.style.display = canEdit ? '' : 'none';
    }
    
    // Hide/show Save button
    const saveExistingBtn = document.getElementById('btn-save-existing');
    if (saveExistingBtn) {
        saveExistingBtn.style.display = canEdit ? '' : 'none';
    }
    
    // Hide/show Save As button
    const saveBtn = document.getElementById('btn-save-recipe');
    if (saveBtn) {
        saveBtn.style.display = canEdit ? '' : 'none';
    }
    
    // Hide/show Export PDF button (visible for admin, manager, employee - not viewer)
    const exportBtn = document.getElementById('btn-export-pdf');
    if (exportBtn) {
        exportBtn.style.display = canExport ? '' : 'none';
    }

    const pickingSheetBtn = document.getElementById('btn-export-picking-sheet');
    if (pickingSheetBtn) {
        pickingSheetBtn.style.display = canExport ? '' : 'none';
    }
    
    // Hide/show Edit Name button (admin/manager only, when a recipe is loaded)
    const editNameBtn = document.getElementById('btn-edit-recipe-name');
    if (editNameBtn) {
        editNameBtn.style.display = (canEdit && state.currentRecipeName) ? '' : 'none';
    }
    
    // Hide/show Create New Recipe button (admin/manager only)
    const newRecipeBtn = document.getElementById('new-recipe-btn-container');
    if (newRecipeBtn) {
        newRecipeBtn.style.display = canEdit ? '' : 'none';
    }
}
