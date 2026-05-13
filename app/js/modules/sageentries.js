/**
 * Demo Plant LLC - Sage Entries Module
 * Handles manual inventory journal entries (GRN, FG-IN, FG-OUT, IS)
 * with lot tracking and FIFO stock allocation
 */

import { debounce, showToast, formatDate, formatNumber } from '../utils.js?v=20260129a';
import { authenticatedFetch, getCurrentUser } from '../auth.js?v=20260428b';

// ============================================================================
// Module State
// ============================================================================

let sageEntries = [];
let sageDrafts = [];
let filteredDrafts = [];
let transactionCodes = [];
let currentEntryType = 'GRN';
let currentDraftFilter = 'ALL';
let currentDraftSearch = '';
let lineItems = [];
let fifoPreview = null;
let editingEntry = null;

// Item dropdown data
let allSageItems = [];
let filteredItems = [];
let activeDropdown = null;

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Load the Sage Entries page
 */
export async function loadSageEntriesPage() {
    try {
        // Load transaction codes, drafts, and items in parallel
        await Promise.all([
            loadTransactionCodes(),
            loadSageDrafts(),
            loadSageEntries(),
            loadSageItems()
        ]);
        
        // Set default date to today
        const dateInput = document.getElementById('sage-entry-date');
        if (dateInput) {
            dateInput.value = new Date().toISOString().split('T')[0];
        }
        
        // Initialize entry type
        setEntryType('GRN');
        
        // Setup dropdown close listeners
        setupDropdownListeners();
        
    } catch (error) {
        console.error('Error loading Sage Entries page:', error);
        showToast('Error loading page', 'error');
    }
}

/**
 * Load available transaction codes from Sage
 */
export async function loadTransactionCodes() {
    try {
        const response = await authenticatedFetch('/api/sage-entries/transaction-codes');
        if (!response.ok) throw new Error('Failed to load transaction codes');
        
        transactionCodes = await response.json();
        
        // Populate dropdown
        const select = document.getElementById('sage-entry-tr-code');
        if (select) {
            if (transactionCodes.length > 0) {
                select.innerHTML = transactionCodes.map(code => 
                    `<option value="${code.id}" data-code="${code.code}">${code.code} - ${code.description}</option>`
                ).join('');
            } else {
                // Fallback TR codes if none returned
                select.innerHTML = `
                    <option value="GRN" data-code="GRN">GRN - Goods Received</option>
                    <option value="FG-IN" data-code="FG-IN">FG-IN - Finished Goods In</option>
                    <option value="FG-OUT" data-code="FG-OUT">FG-OUT - Finished Goods Out</option>
                    <option value="IS" data-code="IS">IS - Issue Stock</option>
                `;
            }
        }
        
        console.log(`✓ Loaded ${transactionCodes.length} transaction codes`);
        
    } catch (error) {
        console.error('Error loading transaction codes:', error);
        // Set fallback transaction codes
        const select = document.getElementById('sage-entry-tr-code');
        if (select) {
            select.innerHTML = `
                <option value="GRN" data-code="GRN">GRN - Goods Received</option>
                <option value="FG-IN" data-code="FG-IN">FG-IN - Finished Goods In</option>
                <option value="FG-OUT" data-code="FG-OUT">FG-OUT - Finished Goods Out</option>
                <option value="IS" data-code="IS">IS - Issue Stock</option>
            `;
        }
    }
}

/**
 * Load unposted drafts from Sage
 */
export async function loadSageDrafts() {
    try {
        const tbody = document.getElementById('sage-drafts-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-8 text-center"><div class="loader mx-auto mb-4"></div><p class="text-slate-400">Loading drafts...</p></td></tr>';
        }
        
        const response = await authenticatedFetch('/api/sage-entries/sage-drafts');
        if (!response.ok) throw new Error('Failed to load drafts');
        
        const data = await response.json();
        sageDrafts = data.drafts || [];
        
        renderSageDrafts();
        updateDraftStats();
        
    } catch (error) {
        console.error('Error loading sage drafts:', error);
        const tbody = document.getElementById('sage-drafts-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-8 text-center text-red-500">Error loading drafts</td></tr>';
        }
    }
}

/**
 * Load sage entries from MongoDB
 */
export async function loadSageEntries() {
    try {
        const response = await authenticatedFetch('/api/sage-entries?limit=100');
        if (!response.ok) throw new Error('Failed to load entries');
        
        const data = await response.json();
        sageEntries = data.entries || [];
        
    } catch (error) {
        console.error('Error loading sage entries:', error);
    }
}

/**
 * Load all Sage items directly from Sage StkItem table for dropdown
 * This ensures exact match with Sage item codes, descriptions, and costs
 */
async function loadSageItems() {
    try {
        // Fetch items directly from Sage via dedicated endpoint
        const response = await authenticatedFetch('/api/sage-entries/items');
        
        if (!response.ok) {
            throw new Error(`Failed to load items: ${response.status}`);
        }
        
        const items = await response.json();
        
        // Map to consistent format including unit cost
        allSageItems = items
            .filter(item => item.item_code)
            .map(item => ({
                code: item.item_code,
                description: item.description || item.item_code,
                stockLink: item.stock_link,
                unitCost: item.unit_cost || 0
            }));
        
        console.log(`✓ Loaded ${allSageItems.length} items from Sage for dropdown`);
        
        // Update any open dropdowns
        const codeDropdown = document.getElementById('item-code-dropdown');
        const descDropdown = document.getElementById('item-desc-dropdown');
        if (codeDropdown && !codeDropdown.classList.contains('hidden')) {
            filterItemDropdown('code');
        }
        if (descDropdown && !descDropdown.classList.contains('hidden')) {
            filterItemDropdown('desc');
        }
        
    } catch (error) {
        console.error('Error loading items from Sage:', error);
        
        // Try fallback to inventory APIs
        try {
            console.log('Attempting fallback to inventory APIs...');
            const [rmResponse, fgResponse] = await Promise.all([
                authenticatedFetch('/api/inventory'),
                authenticatedFetch('/api/finished-goods-inventory')
            ]);
            
            let items = [];
            
            if (rmResponse.ok) {
                const rmData = await rmResponse.json();
                items = items.concat(rmData.map(item => ({
                    code: item['Item Code'] || item.ItemCode || item.item_code || '',
                    description: item['Item Description'] || item.Description || item.description || '',
                    stockLink: null,
                    unitCost: parseFloat(item['Unit Cost'] || item.unit_cost || item.UnitCost || 0) || 0
                })));
            }
            
            if (fgResponse.ok) {
                const fgData = await fgResponse.json();
                items = items.concat(fgData.map(item => ({
                    code: item['Item Code'] || item.ItemCode || item.item_code || '',
                    description: item['Item Description'] || item.Description || item.description || '',
                    stockLink: null,
                    unitCost: parseFloat(item['Unit Cost'] || item.unit_cost || item.UnitCost || 0) || 0
                })));
            }
            
            // Remove duplicates and sort
            allSageItems = items
                .filter(item => item.code)
                .sort((a, b) => a.code.localeCompare(b.code))
                .filter((item, idx, arr) => idx === 0 || item.code !== arr[idx - 1].code);
            
            console.log(`✓ Loaded ${allSageItems.length} items from fallback APIs`);
            
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            showToast('Failed to load items for dropdown', 'error');
        }
    }
}

/**
 * Setup document click listener to close dropdowns
 */
function setupDropdownListeners() {
    document.addEventListener('click', (e) => {
        const codeInput = document.getElementById('line-item-code');
        const descInput = document.getElementById('line-item-desc');
        const codeDropdown = document.getElementById('item-code-dropdown');
        const descDropdown = document.getElementById('item-desc-dropdown');
        
        // If clicking outside both inputs and dropdowns, hide both
        const isInsideCode = codeInput?.contains(e.target) || codeDropdown?.contains(e.target);
        const isInsideDesc = descInput?.contains(e.target) || descDropdown?.contains(e.target);
        
        if (!isInsideCode && codeDropdown) {
            codeDropdown.classList.add('hidden');
        }
        if (!isInsideDesc && descDropdown) {
            descDropdown.classList.add('hidden');
        }
    });
    
    // Handle keyboard navigation
    document.getElementById('line-item-code')?.addEventListener('keydown', handleDropdownKeyboard);
    document.getElementById('line-item-desc')?.addEventListener('keydown', handleDropdownKeyboard);
}

/**
 * Handle keyboard navigation in dropdowns
 */
function handleDropdownKeyboard(e) {
    const dropdownId = e.target.id === 'line-item-code' ? 'item-code-dropdown-list' : 'item-desc-dropdown-list';
    const listEl = document.getElementById(dropdownId);
    if (!listEl) return;
    
    const items = listEl.querySelectorAll('.dropdown-item');
    const highlighted = listEl.querySelector('.dropdown-item.bg-blue-50');
    let highlightedIdx = -1;
    
    items.forEach((item, idx) => {
        if (item.classList.contains('bg-blue-50')) highlightedIdx = idx;
    });
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIdx = Math.min(highlightedIdx + 1, items.length - 1);
        items.forEach((item, idx) => {
            item.classList.toggle('bg-blue-50', idx === nextIdx);
        });
        items[nextIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIdx = Math.max(highlightedIdx - 1, 0);
        items.forEach((item, idx) => {
            item.classList.toggle('bg-blue-50', idx === prevIdx);
        });
        items[prevIdx]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlighted) {
            highlighted.click();
        }
    } else if (e.key === 'Escape') {
        document.getElementById('item-code-dropdown')?.classList.add('hidden');
        document.getElementById('item-desc-dropdown')?.classList.add('hidden');
    }
}

/**
 * Show item dropdown
 */
export function showItemDropdown(type) {
    activeDropdown = type;
    const dropdownId = type === 'code' ? 'item-code-dropdown' : 'item-desc-dropdown';
    const otherDropdownId = type === 'code' ? 'item-desc-dropdown' : 'item-code-dropdown';
    
    // Hide the other dropdown
    document.getElementById(otherDropdownId)?.classList.add('hidden');
    
    // Show this dropdown with all items
    filterItemDropdown(type);
    document.getElementById(dropdownId)?.classList.remove('hidden');
}

/**
 * Filter item dropdown based on input
 */
export function filterItemDropdown(type) {
    const inputId = type === 'code' ? 'line-item-code' : 'line-item-desc';
    const listId = type === 'code' ? 'item-code-dropdown-list' : 'item-desc-dropdown-list';
    const dropdownId = type === 'code' ? 'item-code-dropdown' : 'item-desc-dropdown';
    
    const input = document.getElementById(inputId);
    const listEl = document.getElementById(listId);
    const dropdown = document.getElementById(dropdownId);
    
    if (!input || !listEl) return;
    
    // Check if items are loaded
    if (allSageItems.length === 0) {
        listEl.innerHTML = `
            <div class="px-3 py-4 text-center text-slate-400 text-sm">
                <svg class="w-5 h-5 animate-spin mx-auto mb-2" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading items from Sage...
            </div>
        `;
        dropdown?.classList.remove('hidden');
        return;
    }
    
    const searchTerm = input.value.toLowerCase().trim();
    
    // Filter items based on search term
    filteredItems = allSageItems.filter(item => {
        if (!searchTerm) return true;
        return item.code.toLowerCase().includes(searchTerm) || 
               item.description.toLowerCase().includes(searchTerm);
    });
    
    // Limit to 100 items for performance
    const displayItems = filteredItems.slice(0, 100);
    
    if (displayItems.length === 0) {
        listEl.innerHTML = `
            <div class="px-3 py-4 text-center text-slate-400 text-sm">
                No items found ${searchTerm ? `matching "${searchTerm}"` : ''}
            </div>
        `;
    } else {
        const totalCount = filteredItems.length;
        const showingCount = displayItems.length;
        const moreMsg = totalCount > showingCount ? `<div class="px-3 py-2 text-xs text-slate-400 text-center border-t border-slate-100">Showing ${showingCount} of ${totalCount} items. Type to filter...</div>` : '';
        
        listEl.innerHTML = displayItems.map(item => `
            <div class="dropdown-item grid grid-cols-2 gap-2 px-3 py-2 cursor-pointer hover:bg-blue-50 transition-colors"
                 onclick="selectSageItem('${escapeHtml(item.code)}', '${escapeHtml(item.description)}', ${item.unitCost || 0})">
                <span class="text-sm font-mono text-slate-700 truncate">${highlightMatch(item.code, searchTerm)}</span>
                <span class="text-sm text-slate-600 truncate">${highlightMatch(item.description, searchTerm)}</span>
            </div>
        `).join('') + moreMsg;
    }
    
    // Show dropdown if not visible
    dropdown?.classList.remove('hidden');
}

/**
 * Highlight matching text in dropdown
 */
function highlightMatch(text, search) {
    if (!search) return escapeHtml(text);
    
    const escaped = escapeHtml(text);
    const searchLower = search.toLowerCase();
    const textLower = text.toLowerCase();
    const idx = textLower.indexOf(searchLower);
    
    if (idx === -1) return escaped;
    
    const before = escapeHtml(text.substring(0, idx));
    const match = escapeHtml(text.substring(idx, idx + search.length));
    const after = escapeHtml(text.substring(idx + search.length));
    
    return `${before}<mark class="bg-yellow-200 rounded px-0.5">${match}</mark>${after}`;
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
 * Select an item from the dropdown
 * Auto-fills item code, description, and unit cost from Sage
 */
export function selectSageItem(code, description, unitCost = 0) {
    const codeInput = document.getElementById('line-item-code');
    const descInput = document.getElementById('line-item-desc');
    const costInput = document.getElementById('line-unit-cost');
    
    if (codeInput) codeInput.value = code;
    if (descInput) descInput.value = description;
    
    // Auto-fill unit cost from Sage
    if (costInput && unitCost > 0) {
        costInput.value = unitCost.toFixed(4);
    }
    
    // Hide both dropdowns
    document.getElementById('item-code-dropdown')?.classList.add('hidden');
    document.getElementById('item-desc-dropdown')?.classList.add('hidden');
    
    // Focus on quantity field
    const qtyIn = document.getElementById('line-qty-in');
    const qtyOut = document.getElementById('line-qty-out');
    const qtyInCol = document.getElementById('qty-in-col');
    const qtyOutCol = document.getElementById('qty-out-col');
    
    if (qtyInCol && !qtyInCol.classList.contains('hidden') && qtyIn) {
        qtyIn.focus();
    } else if (qtyOutCol && !qtyOutCol.classList.contains('hidden') && qtyOut) {
        qtyOut.focus();
    }
}


// ============================================================================
// Rendering
// ============================================================================

/**
 * Render the drafts table
 */
function renderSageDrafts(draftsToRender = null) {
    const tbody = document.getElementById('sage-drafts-tbody');
    if (!tbody) return;
    
    // Use provided drafts or default to all drafts
    const drafts = draftsToRender !== null ? draftsToRender : sageDrafts;
    
    if (!drafts || drafts.length === 0) {
        const isFiltered = currentDraftFilter !== 'ALL' || currentDraftSearch;
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-6 py-12 text-center">
                    <svg class="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                    <p class="text-gray-500 text-lg font-medium mb-2">${isFiltered ? 'No matching drafts' : 'No pending drafts'}</p>
                    <p class="text-gray-400 text-sm">${isFiltered ? 'Try adjusting your filters' : 'Create a new entry using the form above'}</p>
                </td>
            </tr>
        `;
        return;
    }
    
    const typeColors = {
        'GRN': 'bg-green-100 text-green-800',
        'FG-IN': 'bg-blue-100 text-blue-800',
        'FG-OUT': 'bg-orange-100 text-orange-800',
        'IS': 'bg-purple-100 text-purple-800'
    };
    
    const rows = drafts.map(draft => {
        const trCode = draft.tr_code || 'N/A';
        const colorClass = typeColors[trCode] || 'bg-slate-100 text-slate-800';
        
        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-sm font-medium text-blue-600">${draft.journal_number || '-'}</td>
                <td class="px-4 py-3 text-sm">
                    <span class="inline-block px-2 py-1 rounded-full text-xs font-medium ${colorClass}">${trCode}</span>
                </td>
                <td class="px-4 py-3 text-sm text-slate-600">
                    ${draft.reference || '-'}
                    ${draft.rm_order_number ? `<span class="ml-1 inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700" title="Linked to RM Order">${draft.rm_order_number}</span>` : ''}
                </td>
                <td class="px-4 py-3 text-sm text-slate-600">${draft.description || '-'}</td>
                <td class="px-4 py-3 text-sm text-slate-600">${formatDate(draft.created_date)}</td>
                <td class="px-4 py-3 text-sm text-center text-slate-600">${draft.line_count || 0}</td>
                <td class="px-4 py-3 text-sm text-right font-medium text-slate-900">AED ${formatNumber(draft.total_value || 0, 2)}</td>
                <td class="px-4 py-3 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="viewSageEntry(${draft.batch_id})" class="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition-colors" title="View Details">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                        </button>
                        <button onclick="editSageEntry(${draft.batch_id})" class="p-1.5 text-amber-600 hover:bg-amber-100 rounded transition-colors" title="Edit">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                        </button>
                        <button onclick="deleteSageEntry(${draft.batch_id})" class="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors" title="Delete">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = rows.join('');
}

/**
 * Update draft statistics
 */
function updateDraftStats() {
    const countEl = document.getElementById('sage-drafts-count');
    const valueEl = document.getElementById('sage-drafts-value');
    
    const draftsToCount = filteredDrafts.length > 0 || currentDraftFilter !== 'ALL' || currentDraftSearch ? filteredDrafts : sageDrafts;
    
    if (countEl) countEl.textContent = draftsToCount.length;
    if (valueEl) {
        const totalValue = draftsToCount.reduce((sum, d) => sum + (d.total_value || 0), 0);
        valueEl.textContent = `AED ${formatNumber(totalValue, 2)}`;
    }
}

/**
 * Filter sage drafts by type
 */
export function filterSageDrafts(type) {
    currentDraftFilter = type;
    
    // Update filter button styles
    document.querySelectorAll('.sage-draft-filter-btn').forEach(btn => {
        const btnFilter = btn.dataset.filter;
        // Remove all possible active/inactive classes
        btn.classList.remove('bg-slate-900', 'text-white', 'bg-white', 'text-slate-600', 'hover:bg-slate-100', 'border', 'border-slate-200', 'text-amber-700', 'hover:bg-amber-50', 'border-amber-200');
        if (btnFilter === type) {
            btn.classList.add('bg-slate-900', 'text-white');
        } else {
            if (btnFilter === 'RM_ORDER') {
                btn.classList.add('bg-white', 'text-amber-700', 'hover:bg-amber-50', 'border', 'border-amber-200');
            } else {
                btn.classList.add('bg-white', 'text-slate-600', 'hover:bg-slate-100', 'border', 'border-slate-200');
            }
        }
    });
    
    applyDraftFilters();
}

/**
 * Search sage drafts
 */
export function searchSageDrafts(searchTerm) {
    currentDraftSearch = searchTerm.toLowerCase().trim();
    applyDraftFilters();
}

/**
 * Apply all filters and search to drafts
 */
function applyDraftFilters() {
    filteredDrafts = sageDrafts.filter(draft => {
        // Type filter
        if (currentDraftFilter !== 'ALL') {
            if (currentDraftFilter === 'RM_ORDER') {
                // Show only drafts linked to an RM order
                if (!draft.rm_order_number) {
                    return false;
                }
            } else {
                const trCode = draft.tr_code || '';
                if (trCode !== currentDraftFilter) {
                    return false;
                }
            }
        }
        
        // Search filter
        if (currentDraftSearch) {
            const searchableText = [
                draft.journal_number || '',
                draft.reference || '',
                draft.description || '',
                draft.tr_code || '',
                draft.rm_order_number || ''
            ].join(' ').toLowerCase();
            
            if (!searchableText.includes(currentDraftSearch)) {
                return false;
            }
        }
        
        return true;
    });
    
    renderSageDrafts(filteredDrafts);
    updateDraftStats();
}

// ============================================================================
// Entry Type Handling
// ============================================================================

/**
 * Set the entry type and update form visibility
 */
export function setEntryType(type) {
    currentEntryType = type.toUpperCase();
    
    // Update type buttons
    document.querySelectorAll('.entry-type-btn').forEach(btn => {
        const btnType = btn.dataset.type;
        if (btnType === currentEntryType) {
            btn.classList.remove('bg-slate-100', 'text-slate-700');
            btn.classList.add('bg-blue-600', 'text-white');
        } else {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-slate-100', 'text-slate-700');
        }
    });
    
    // Show/hide lot information fields
    const lotInfoSection = document.getElementById('lot-info-section');
    const fifoPreviewSection = document.getElementById('fifo-preview-section');
    
    if (lotInfoSection) {
        lotInfoSection.classList.toggle('hidden', !['GRN', 'FG-IN'].includes(currentEntryType));
    }
    
    if (fifoPreviewSection) {
        fifoPreviewSection.classList.toggle('hidden', !['IS', 'FG-OUT'].includes(currentEntryType));
    }
    
    // Update quantity labels
    const qtyInLabel = document.getElementById('qty-in-label');
    const qtyOutLabel = document.getElementById('qty-out-label');
    const qtyInCol = document.getElementById('qty-in-col');
    const qtyOutCol = document.getElementById('qty-out-col');
    
    if (['GRN', 'FG-IN'].includes(currentEntryType)) {
        if (qtyInCol) qtyInCol.classList.remove('hidden');
        if (qtyOutCol) qtyOutCol.classList.add('hidden');
    } else {
        if (qtyInCol) qtyInCol.classList.add('hidden');
        if (qtyOutCol) qtyOutCol.classList.remove('hidden');
    }
    
    // Update TR code selection
    const trCodeSelect = document.getElementById('sage-entry-tr-code');
    if (trCodeSelect) {
        const option = Array.from(trCodeSelect.options).find(o => o.dataset.code === currentEntryType);
        if (option) {
            trCodeSelect.value = option.value;
        }
    }
    
    // Clear line items
    lineItems = [];
    renderLineItems();
    
    // Clear FIFO preview
    fifoPreview = null;
    renderFIFOPreview();
}

// ============================================================================
// Line Items Management
// ============================================================================

/**
 * Add a line item to the entry
 */
export function addLineItem() {
    const itemCode = document.getElementById('line-item-code')?.value?.trim();
    const itemDesc = document.getElementById('line-item-desc')?.value?.trim();
    const qtyIn = parseFloat(document.getElementById('line-qty-in')?.value) || 0;
    const qtyOut = parseFloat(document.getElementById('line-qty-out')?.value) || 0;
    const unitCost = parseFloat(document.getElementById('line-unit-cost')?.value) || 0;
    
    // Lot info
    const batchNo = document.getElementById('line-batch-no')?.value?.trim();
    const barcode = document.getElementById('line-barcode')?.value?.trim();
    const prodDate = document.getElementById('line-prod-date')?.value;
    const expDate = document.getElementById('line-exp-date')?.value;
    
    if (!itemCode) {
        showToast('Please enter an item code', 'error');
        return;
    }
    
    const qty = ['GRN', 'FG-IN'].includes(currentEntryType) ? qtyIn : qtyOut;
    if (qty <= 0) {
        showToast('Please enter a valid quantity', 'error');
        return;
    }
    
    const line = {
        item_code: itemCode,
        item_description: itemDesc || itemCode,
        qty_in: ['GRN', 'FG-IN'].includes(currentEntryType) ? qty : 0,
        qty_out: ['IS', 'FG-OUT'].includes(currentEntryType) ? qty : 0,
        unit_cost: unitCost,
        batch_no: batchNo,
        item_barcode: barcode,
        production_date: prodDate,
        expiry_date: expDate
    };
    
    lineItems.push(line);
    renderLineItems();
    clearLineInputs();
    
    // If IS or FG-OUT, update FIFO preview
    if (['IS', 'FG-OUT'].includes(currentEntryType)) {
        calculateFIFOPreviewForAll();
    }
    
    showToast('Line item added', 'success');
}

/**
 * Remove a line item
 */
export function removeLineItem(index) {
    lineItems.splice(index, 1);
    renderLineItems();
    
    if (['IS', 'FG-OUT'].includes(currentEntryType)) {
        calculateFIFOPreviewForAll();
    }
}

/**
 * Render line items table
 */
function renderLineItems() {
    const tbody = document.getElementById('line-items-tbody');
    if (!tbody) return;
    
    if (lineItems.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-8 text-center text-slate-400">
                    No line items added yet
                </td>
            </tr>
        `;
        return;
    }
    
    const isInbound = ['GRN', 'FG-IN'].includes(currentEntryType);
    
    const rows = lineItems.map((line, idx) => {
        const qty = isInbound ? line.qty_in : line.qty_out;
        const value = qty * line.unit_cost;
        
        return `
            <tr class="hover:bg-slate-50">
                <td class="px-3 py-2 text-sm font-mono">${line.item_code}</td>
                <td class="px-3 py-2 text-sm">${line.item_description || '-'}</td>
                <td class="px-3 py-2 text-sm text-right">${formatNumber(qty)}</td>
                <td class="px-3 py-2 text-sm text-right">${formatNumber(line.unit_cost, 2)}</td>
                <td class="px-3 py-2 text-sm text-right font-medium">${formatNumber(value, 2)}</td>
                <td class="px-3 py-2 text-sm">${line.batch_no || '-'}</td>
                <td class="px-3 py-2 text-center">
                    <button onclick="removeLineItem(${idx})" class="p-1 text-red-600 hover:bg-red-100 rounded">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = rows.join('');
    
    // Update totals
    const totalQty = lineItems.reduce((sum, l) => sum + (isInbound ? l.qty_in : l.qty_out), 0);
    const totalValue = lineItems.reduce((sum, l) => sum + ((isInbound ? l.qty_in : l.qty_out) * l.unit_cost), 0);
    
    document.getElementById('line-items-total-qty').textContent = formatNumber(totalQty);
    document.getElementById('line-items-total-value').textContent = formatNumber(totalValue, 2);
}

/**
 * Clear line item inputs
 */
function clearLineInputs() {
    ['line-item-code', 'line-item-desc', 'line-item-code-selected', 'line-qty-in', 'line-qty-out', 'line-unit-cost',
     'line-batch-no', 'line-barcode', 'line-prod-date', 'line-exp-date'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    // Hide dropdowns
    document.getElementById('item-code-dropdown')?.classList.add('hidden');
    document.getElementById('item-desc-dropdown')?.classList.add('hidden');
}

// ============================================================================
// FIFO Preview
// ============================================================================

/**
 * Calculate FIFO preview for all line items
 */
async function calculateFIFOPreviewForAll() {
    if (!['IS', 'FG-OUT'].includes(currentEntryType) || lineItems.length === 0) {
        fifoPreview = null;
        renderFIFOPreview();
        return;
    }
    
    const lotType = currentEntryType === 'IS' ? 'GRN' : 'FG-IN';
    fifoPreview = { items: [], hasShortfall: false };
    
    for (const line of lineItems) {
        const qty = line.qty_out;
        if (qty <= 0) continue;
        
        try {
            const response = await authenticatedFetch(
                `/api/sage-entries/fifo-preview?item_code=${encodeURIComponent(line.item_code)}&qty=${qty}&lot_type=${lotType}`
            );
            
            if (response.ok) {
                const result = await response.json();
                fifoPreview.items.push({
                    item_code: line.item_code,
                    ...result
                });
                if (result.shortfall > 0) {
                    fifoPreview.hasShortfall = true;
                }
            }
        } catch (error) {
            console.error('FIFO preview error:', error);
        }
    }
    
    renderFIFOPreview();
}

/**
 * Render FIFO preview section
 */
function renderFIFOPreview() {
    const container = document.getElementById('fifo-preview-content');
    if (!container) return;
    
    if (!fifoPreview || fifoPreview.items.length === 0) {
        container.innerHTML = '<p class="text-slate-400 text-sm">Add line items to see FIFO allocation</p>';
        return;
    }
    
    let html = '';
    
    for (const item of fifoPreview.items) {
        const statusClass = item.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50';
        const statusIcon = item.success 
            ? '<svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>'
            : '<svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
        
        html += `
            <div class="border rounded-lg p-3 mb-3 ${statusClass}">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                        ${statusIcon}
                        <span class="font-medium">${item.item_code}</span>
                    </div>
                    <div class="text-sm">
                        <span class="font-medium">${formatNumber(item.allocated_qty)}</span> / ${formatNumber(item.requested_qty)} allocated
                    </div>
                </div>
        `;
        
        if (item.picks && item.picks.length > 0) {
            html += '<div class="text-xs space-y-1 ml-7">';
            for (const pick of item.picks) {
                html += `
                    <div class="flex justify-between text-slate-600">
                        <span>${pick.lot_batch_no} (${formatDate(pick.lot_entry_date)})</span>
                        <span>Pick: <strong>${formatNumber(pick.qty_to_pick)}</strong> of ${formatNumber(pick.lot_remaining_before)}</span>
                    </div>
                `;
            }
            html += '</div>';
        }
        
        if (item.shortfall > 0) {
            html += `<p class="text-xs text-red-600 mt-2 ml-7">⚠ Shortfall: ${formatNumber(item.shortfall)} units</p>`;
        }
        
        html += '</div>';
    }
    
    container.innerHTML = html;
}

// ============================================================================
// Entry CRUD Operations
// ============================================================================

/**
 * Submit the entry form
 */
export async function submitSageEntry() {
    const reference = document.getElementById('sage-entry-reference')?.value?.trim();
    const description = document.getElementById('sage-entry-description')?.value?.trim();
    const entryDate = document.getElementById('sage-entry-date')?.value;
    const trCodeId = document.getElementById('sage-entry-tr-code')?.value;
    
    if (!reference) {
        showToast('Please enter a reference', 'error');
        return;
    }
    
    if (lineItems.length === 0) {
        showToast('Please add at least one line item', 'error');
        return;
    }
    
    // Check FIFO shortfall for IS/FG-OUT
    if (fifoPreview?.hasShortfall) {
        if (!confirm('There is insufficient stock for some items. Do you want to continue anyway?')) {
            return;
        }
    }
    
    const submitBtn = document.getElementById('sage-entry-submit-btn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="loader w-4 h-4 mr-2"></div> Creating...';
    }
    
    try {
        // Build payload - tr_code_id is optional, backend resolves by entry_type
        const parsedTrCodeId = parseInt(trCodeId);
        const payload = {
            entry_type: currentEntryType,
            entry_date: entryDate || new Date().toISOString().split('T')[0],
            reference: reference,
            description: description,
            line_items: lineItems,
            warehouse_id: 1
        };
        // Only include tr_code_id if it's a valid number (not NaN from fallback string values)
        if (!isNaN(parsedTrCodeId) && parsedTrCodeId > 0) {
            payload.tr_code_id = parsedTrCodeId;
        }
        
        const response = await authenticatedFetch('/api/sage-entries', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            // Handle Pydantic validation errors (detail is an array) and string errors
            let errorMsg = 'Failed to create entry';
            if (typeof errorData.detail === 'string') {
                errorMsg = errorData.detail;
            } else if (Array.isArray(errorData.detail)) {
                errorMsg = errorData.detail.map(e => e.msg || JSON.stringify(e)).join('; ');
            } else if (errorData.detail) {
                errorMsg = JSON.stringify(errorData.detail);
            }
            throw new Error(errorMsg);
        }
        
        const result = await response.json();
        
        showToast(`${currentEntryType} entry created: ${result.sage_journal_number}`, 'success');
        
        // Reset form
        clearEntryForm();
        
        // Reload drafts
        await loadSageDrafts();
        
    } catch (error) {
        console.error('Error creating entry:', error);
        showToast(error.message || 'Error creating entry', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Create Entry';
        }
    }
}

/**
 * Clear the entry form
 */
export function clearEntryForm() {
    document.getElementById('sage-entry-reference').value = '';
    document.getElementById('sage-entry-description').value = '';
    document.getElementById('sage-entry-date').value = new Date().toISOString().split('T')[0];
    
    lineItems = [];
    fifoPreview = null;
    
    renderLineItems();
    renderFIFOPreview();
    clearLineInputs();
}

/**
 * View entry details
 */
export async function viewSageEntry(batchId) {
    try {
        const response = await authenticatedFetch(`/api/sage-entries/${batchId}`);
        if (!response.ok) throw new Error('Failed to load entry');
        
        const details = await response.json();
        
        // Show in modal
        const modal = document.getElementById('sage-entry-modal');
        const content = document.getElementById('sage-entry-modal-content');
        
        if (modal && content) {
            let linesHtml = '';
            if (details.lines && details.lines.length > 0) {
                linesHtml = `
                    <table class="min-w-full divide-y divide-gray-200 mt-4">
                        <thead class="bg-slate-50">
                            <tr>
                                <th class="px-3 py-2 text-left text-xs font-medium text-slate-500">Item Code</th>
                                <th class="px-3 py-2 text-left text-xs font-medium text-slate-500">Description</th>
                                <th class="px-3 py-2 text-right text-xs font-medium text-slate-500">Qty In</th>
                                <th class="px-3 py-2 text-right text-xs font-medium text-slate-500">Qty Out</th>
                                <th class="px-3 py-2 text-right text-xs font-medium text-slate-500">Unit Cost</th>
                                <th class="px-3 py-2 text-right text-xs font-medium text-slate-500">Value</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-200">
                            ${details.lines.map(line => `
                                <tr>
                                    <td class="px-3 py-2 text-sm font-mono">${line.item_code || '-'}</td>
                                    <td class="px-3 py-2 text-sm">${line.item_description || '-'}</td>
                                    <td class="px-3 py-2 text-sm text-right">${formatNumber(line.qty_in)}</td>
                                    <td class="px-3 py-2 text-sm text-right">${formatNumber(line.qty_out)}</td>
                                    <td class="px-3 py-2 text-sm text-right">${formatNumber(line.unit_cost, 2)}</td>
                                    <td class="px-3 py-2 text-sm text-right font-medium">${formatNumber(line.line_value, 2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
            
            content.innerHTML = `
                <div class="space-y-4">
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-sm text-slate-500">Journal Number</p>
                            <p class="font-medium">${details.journal_number}</p>
                        </div>
                        <div>
                            <p class="text-sm text-slate-500">Reference</p>
                            <p class="font-medium">${details.reference || '-'}</p>
                        </div>
                        <div>
                            <p class="text-sm text-slate-500">Description</p>
                            <p class="font-medium">${details.description || '-'}</p>
                        </div>
                        <div>
                            <p class="text-sm text-slate-500">Status</p>
                            <p class="font-medium">${details.is_posted ? 'Posted' : 'Draft'}</p>
                        </div>
                        <div>
                            <p class="text-sm text-slate-500">Lines</p>
                            <p class="font-medium">${details.line_count}</p>
                        </div>
                        <div>
                            <p class="text-sm text-slate-500">Total Value</p>
                            <p class="font-medium">AED ${formatNumber(details.total_value, 2)}</p>
                        </div>
                    </div>
                    ${linesHtml}
                </div>
            `;
            
            modal.classList.remove('hidden');
        }
        
    } catch (error) {
        console.error('Error viewing entry:', error);
        showToast('Error loading entry details', 'error');
    }
}

/**
 * Edit entry (opens edit modal with editable fields)
 */
export async function editSageEntry(batchId) {
    try {
        const response = await authenticatedFetch(`/api/sage-entries/${batchId}`);
        if (!response.ok) throw new Error('Failed to load entry');
        
        const details = await response.json();
        
        // Store for later use
        editingEntry = {
            batchId: batchId,
            details: details,
            lines: details.lines || [],
            modifiedLines: [],
            deletedLineIds: [],
            newLines: []
        };
        
        // Populate edit modal
        document.getElementById('edit-batch-id').value = batchId;
        document.getElementById('edit-modal-journal-no').textContent = `Journal: ${details.journal_number || '-'}`;
        document.getElementById('edit-reference').value = details.reference || '';
        document.getElementById('edit-description').value = details.description || '';
        document.getElementById('edit-tr-code').value = details.tr_code || 'N/A';
        
        // Render editable lines
        renderEditableLines();
        
        // Show modal
        document.getElementById('sage-entry-edit-modal').classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading entry for edit:', error);
        showToast('Error loading entry details', 'error');
    }
}

/**
 * Render editable line items in the edit modal
 */
function renderEditableLines() {
    const tbody = document.getElementById('edit-lines-tbody');
    if (!tbody || !editingEntry) return;
    
    const allLines = [...editingEntry.lines, ...editingEntry.newLines];
    
    if (allLines.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-8 text-center text-slate-400">
                    No line items. Click "Add Line" to add items.
                </td>
            </tr>
        `;
        document.getElementById('edit-total-value').textContent = '0.00';
        return;
    }
    
    let totalValue = 0;
    
    const rows = allLines.map((line, idx) => {
        const isNew = idx >= editingEntry.lines.length;
        const lineId = isNew ? `new-${idx - editingEntry.lines.length}` : line.line_id;
        const qtyIn = line.qty_in || 0;
        const qtyOut = line.qty_out || 0;
        const unitCost = line.unit_cost || 0;
        const lineValue = (qtyIn > 0 ? qtyIn : qtyOut) * unitCost;
        totalValue += lineValue;
        
        return `
            <tr class="hover:bg-slate-50 ${isNew ? 'bg-green-50' : ''}" data-line-id="${lineId}">
                <td class="px-3 py-2 text-sm font-mono">${line.item_code || '-'}</td>
                <td class="px-3 py-2 text-sm">${line.item_description || '-'}</td>
                <td class="px-3 py-2">
                    <input type="number" step="0.0001" value="${qtyIn}" 
                           onchange="updateEditLineQty('${lineId}', 'qty_in', this.value)"
                           class="w-20 text-right rounded border-slate-300 text-sm">
                </td>
                <td class="px-3 py-2">
                    <input type="number" step="0.0001" value="${qtyOut}" 
                           onchange="updateEditLineQty('${lineId}', 'qty_out', this.value)"
                           class="w-20 text-right rounded border-slate-300 text-sm">
                </td>
                <td class="px-3 py-2">
                    <input type="number" step="0.0001" value="${unitCost.toFixed(4)}" 
                           onchange="updateEditLineQty('${lineId}', 'unit_cost', this.value)"
                           class="w-24 text-right rounded border-slate-300 text-sm">
                </td>
                <td class="px-3 py-2 text-sm text-right font-medium">${formatNumber(lineValue, 2)}</td>
                <td class="px-3 py-2 text-center">
                    <button onclick="removeEditLine('${lineId}')" class="p-1.5 text-red-600 hover:bg-red-100 rounded transition-colors" title="Remove">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = rows.join('');
    document.getElementById('edit-total-value').textContent = formatNumber(totalValue, 2);
}

/**
 * Update a line item quantity/cost in edit mode
 */
export function updateEditLineQty(lineId, field, value) {
    if (!editingEntry) return;
    
    const numValue = parseFloat(value) || 0;
    
    // Check if it's a new line
    if (lineId.startsWith('new-')) {
        const newIdx = parseInt(lineId.replace('new-', ''));
        if (editingEntry.newLines[newIdx]) {
            editingEntry.newLines[newIdx][field] = numValue;
        }
    } else {
        // Find in existing lines
        const lineIdx = editingEntry.lines.findIndex(l => l.line_id == lineId);
        if (lineIdx !== -1) {
            editingEntry.lines[lineIdx][field] = numValue;
            
            // Track modified lines
            if (!editingEntry.modifiedLines.includes(lineId)) {
                editingEntry.modifiedLines.push(lineId);
            }
        }
    }
    
    // Recalculate total
    recalculateEditTotal();
}

/**
 * Recalculate total value in edit modal
 */
function recalculateEditTotal() {
    if (!editingEntry) return;
    
    const allLines = [...editingEntry.lines, ...editingEntry.newLines];
    let totalValue = 0;
    
    allLines.forEach(line => {
        const qty = (line.qty_in || 0) > 0 ? (line.qty_in || 0) : (line.qty_out || 0);
        totalValue += qty * (line.unit_cost || 0);
    });
    
    document.getElementById('edit-total-value').textContent = formatNumber(totalValue, 2);
}

/**
 * Remove a line from edit mode
 */
export function removeEditLine(lineId) {
    if (!editingEntry) return;
    
    if (!confirm('Are you sure you want to remove this line?')) return;
    
    if (lineId.startsWith('new-')) {
        // Remove from new lines
        const newIdx = parseInt(lineId.replace('new-', ''));
        editingEntry.newLines.splice(newIdx, 1);
    } else {
        // Mark for deletion
        editingEntry.deletedLineIds.push(lineId);
        editingEntry.lines = editingEntry.lines.filter(l => l.line_id != lineId);
    }
    
    renderEditableLines();
}

/**
 * Open add line modal for edit mode
 */
export function addEditLineItem() {
    document.getElementById('new-line-item-code').value = '';
    document.getElementById('new-line-qty-in').value = '';
    document.getElementById('new-line-qty-out').value = '';
    document.getElementById('new-line-unit-cost').value = '';
    document.getElementById('add-edit-line-modal').classList.remove('hidden');
}

/**
 * Close add line modal
 */
export function closeAddEditLineModal() {
    document.getElementById('add-edit-line-modal').classList.add('hidden');
}

/**
 * Confirm adding a new line in edit mode
 */
export function confirmAddEditLine() {
    const itemCode = document.getElementById('new-line-item-code').value.trim();
    const qtyIn = parseFloat(document.getElementById('new-line-qty-in').value) || 0;
    const qtyOut = parseFloat(document.getElementById('new-line-qty-out').value) || 0;
    const unitCost = parseFloat(document.getElementById('new-line-unit-cost').value) || 0;
    
    if (!itemCode) {
        showToast('Please enter an item code', 'error');
        return;
    }
    
    if (qtyIn === 0 && qtyOut === 0) {
        showToast('Please enter a quantity', 'error');
        return;
    }
    
    editingEntry.newLines.push({
        item_code: itemCode,
        item_description: itemCode,
        qty_in: qtyIn,
        qty_out: qtyOut,
        unit_cost: unitCost
    });
    
    closeAddEditLineModal();
    renderEditableLines();
    showToast('Line added', 'success');
}

/**
 * Close edit modal
 */
export function closeSageEditModal() {
    document.getElementById('sage-entry-edit-modal').classList.add('hidden');
    editingEntry = null;
}

/**
 * Save all edits to the Sage entry
 */
export async function saveSageEntryEdits() {
    if (!editingEntry) return;
    
    const batchId = editingEntry.batchId;
    const reference = document.getElementById('edit-reference').value.trim();
    const description = document.getElementById('edit-description').value.trim();
    
    const saveBtn = document.getElementById('save-edit-btn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<div class="loader w-4 h-4 mr-2"></div> Saving...';
    }
    
    try {
        // Prepare payload
        const payload = {
            reference: reference,
            description: description,
            modified_lines: editingEntry.lines.filter(l => editingEntry.modifiedLines.includes(String(l.line_id))),
            deleted_line_ids: editingEntry.deletedLineIds.map(id => parseInt(id)),
            new_lines: editingEntry.newLines
        };
        
        const response = await authenticatedFetch(`/api/sage-entries/${batchId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to save changes');
        }
        
        showToast('Changes saved successfully', 'success');
        closeSageEditModal();
        
        // Reload drafts
        await loadSageDrafts();
        
    } catch (error) {
        console.error('Error saving edits:', error);
        showToast(error.message || 'Error saving changes', 'error');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg> Save Changes';
        }
    }
}

/**
 * Approve and post entry
 */
export async function approveSageEntry(batchId) {
    const user = getCurrentUser();
    if (user?.role !== 'admin') {
        showToast('Only admins can approve entries', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to approve and post this entry?\n\nThis will update stock quantities in Sage.')) {
        return;
    }
    
    // Disable action buttons in the drafts table to prevent double-clicks
    _setSageEntryButtonsDisabled(true);
    
    // Show posting indicator
    showToast('Posting entry to Sage... Please wait.', 'info');
    
    try {
        const response = await authenticatedFetch(`/api/sage-entries/${batchId}/approve`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            const error = await response.json();
            const errorDetail = error.detail || 'Failed to approve entry';
            
            // Provide actionable guidance
            if (errorDetail.includes('not reachable') || errorDetail.includes('Agent')) {
                throw new Error(`${errorDetail}\n\nTip: Start the Sage Posting Agent on the Sage PC.`);
            } else if (errorDetail.includes('not found')) {
                throw new Error(`${errorDetail}\n\nThe batch may have been deleted from Sage.`);
            } else if (errorDetail.includes('already posted')) {
                showToast('This batch has already been posted in Sage', 'info');
                await loadSageDrafts();
                return;
            }
            throw new Error(errorDetail);
        }
        
        showToast('Entry approved and posted to Sage successfully!', 'success');
        await loadSageDrafts();
        
    } catch (error) {
        console.error('Error approving entry:', error);
        showToast(error.message || 'Error approving entry', 'error');
    } finally {
        _setSageEntryButtonsDisabled(false);
    }
}

/**
 * Helper: disable/enable action buttons in the sage drafts table
 */
function _setSageEntryButtonsDisabled(disabled) {
    const tbody = document.getElementById('sage-drafts-tbody');
    if (!tbody) return;
    
    const buttons = tbody.querySelectorAll('button');
    buttons.forEach(btn => {
        btn.disabled = disabled;
        if (disabled) {
            btn.classList.add('opacity-50', 'cursor-not-allowed');
        } else {
            btn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });
}

/**
 * Delete draft entry
 */
export async function deleteSageEntry(batchId) {
    const user = getCurrentUser();
    if (user?.role !== 'admin') {
        showToast('Only admins can delete entries', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this draft entry?')) {
        return;
    }
    
    _setSageEntryButtonsDisabled(true);
    
    try {
        const response = await authenticatedFetch(`/api/sage-entries/${batchId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete entry');
        }
        
        showToast('Entry deleted successfully', 'success');
        await loadSageDrafts();
        
    } catch (error) {
        console.error('Error deleting entry:', error);
        showToast(error.message || 'Error deleting entry', 'error');
    } finally {
        _setSageEntryButtonsDisabled(false);
    }
}

/**
 * Close modal
 */
export function closeSageEntryModal() {
    const modal = document.getElementById('sage-entry-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}
