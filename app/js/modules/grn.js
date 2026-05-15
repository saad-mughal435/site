/**
 * Demo Plant LLC - GRN/Inventory Transactions Module
 * Handles inventory transactions, filtering, and supplier summaries
 */

import { debounce, showToast, formatDate, formatNumber, truncateText } from '../utils.js?v=20260129a';
import { authenticatedFetch } from '../auth.js?v=20260428b';

// ============================================================================
// Module State
// ============================================================================

let allGRNData = [];
let currentCategory = 'All';
let currentPage = 1;
const rowsPerPage = 500;

// GL Sales (AR) state - when non-null, the AR tab is active
let currentGLType = null;   // 'local' | 'export' | null
let allGLSalesData = [];    // full GL dataset for client-side date/search filtering

// ============================================================================
// Data Loading
// ============================================================================

/**
 * Load GRN/Inventory transaction data
 */
export async function loadGRNData() {
    try {
        // Reset GL/AR mode - we are loading regular inventory data
        currentGLType = null;
        allGLSalesData = [];
        restoreStatLabels();
        // Reset tab highlighting to 'All'
        resetTabHighlight('All');
        
        const tbody = document.getElementById('grn-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-12 text-center"><div class="loader mx-auto mb-4" style="display:block;"></div><p class="text-slate-400">Loading inventory transactions...</p></td></tr>';
        }

        const response = await authenticatedFetch('/api/inventory-transactions?limit=20000');
        if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);
        
        const result = await response.json();
        allGRNData = result.data || result;
        const metadata = result.metadata || {};
        
        if (!Array.isArray(allGRNData)) {
            throw new Error('Data is not an array');
        }
        
        console.log(`✅ Loaded ${allGRNData.length} transactions`);
        
        if (allGRNData.length < (metadata.total_records_matching || 0)) {
            showToast(`Loaded ${allGRNData.length.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})} recent records (${metadata.total_records_matching.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})} total)`, 'success');
            const loadAllBtn = document.getElementById('load-all-data-btn');
            if (loadAllBtn) {
                loadAllBtn.style.display = 'inline-flex';
                const span = loadAllBtn.querySelector('span');
                if (span) span.textContent = 'Load All Records';
            }
        } else {
            const loadAllBtn = document.getElementById('load-all-data-btn');
            if (loadAllBtn) loadAllBtn.style.display = 'none';
        }
        
        currentPage = 1;
        displayGRNData(allGRNData);
        updateGRNStats(allGRNData);
        generateSupplierSummary(allGRNData.filter(item => item.Category === 'GRN'));
        
    } catch (error) {
        console.error('Error loading inventory transactions:', error);
        const tbody = document.getElementById('grn-table-body');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-12 text-center text-red-500">Error loading inventory transactions.</td></tr>';
        }
        showToast('Error loading inventory transactions', 'error');
    }
}

// Track if loading is in progress to prevent duplicate requests
let isLoadingAll = false;

/**
 * Load all GRN data (for large datasets)
 * Syncs new transactions from Sage first, then loads ALL records from MongoDB.
 */
export async function loadAllGRNData() {
    if (isLoadingAll) {
        showToast('⏳ Already loading. Please wait...', 'warning');
        return;
    }

    currentGLType = null;
    allGLSalesData = [];
    restoreStatLabels();

    const loadAllBtn = document.getElementById('load-all-data-btn');
    const tbody = document.getElementById('grn-table-body');

    try {
        isLoadingAll = true;

        if (loadAllBtn) {
            loadAllBtn.disabled = true;
            loadAllBtn.innerHTML = `
                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Syncing with Sage...</span>
            `;
        }
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-12 text-center"><div class="loader mx-auto mb-4" style="display:block;"></div><p class="text-slate-400">Syncing new transactions from Sage...</p></td></tr>';
        }
        showToast('🔄 Syncing with Sage...', 'info');

        try {
            const syncResp = await authenticatedFetch('/api/inventory-transactions/sync', { method: 'POST' });
            if (syncResp.ok) {
                const syncResult = await syncResp.json();
                const synced = syncResult.records_synced || 0;
                if (synced > 0) {
                    showToast(`✅ Synced ${synced} new transactions from Sage`, 'success');
                }
            }
        } catch (syncErr) {
            console.warn('Sage sync failed, loading from cache:', syncErr);
        }

        if (loadAllBtn) {
            const span = loadAllBtn.querySelector('span');
            if (span) span.textContent = 'Loading all records...';
        }
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-12 text-center"><div class="loader mx-auto mb-4" style="display:block;"></div><p class="text-slate-400">Loading all transactions...</p></td></tr>';
        }

        const response = await authenticatedFetch('/api/inventory-transactions?limit=0');
        if (!response.ok) throw new Error('Failed to fetch transactions');

        const result = await response.json();
        allGRNData = result.data || result;

        showToast(`✅ Loaded all ${allGRNData.length.toLocaleString()} records`, 'success');

        if (loadAllBtn) {
            loadAllBtn.style.display = 'none';
        }

        currentPage = 1;
        displayGRNData(allGRNData);
        updateGRNStats(allGRNData);
        generateSupplierSummary(allGRNData.filter(item => item.Category === 'GRN'));

    } catch (error) {
        console.error('Error loading all data:', error);
        showToast(`❌ ${error.message || 'Error loading all data'}`, 'error');

        if (loadAllBtn) {
            loadAllBtn.disabled = false;
            loadAllBtn.innerHTML = `
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
                <span>Load All Records</span>
            `;
        }
    } finally {
        isLoadingAll = false;
    }
}

// Track if refresh is in progress
let isRefreshInProgress = false;

/**
 * Refresh GRN data with sync
 */
export async function refreshGRNData() {
    // Prevent double-clicks
    if (isRefreshInProgress) {
        showToast('⏳ Refresh already in progress. Please wait...', 'warning');
        return;
    }
    
    // Reset GL/AR mode - refresh always loads inventory data
    currentGLType = null;
    allGLSalesData = [];
    restoreStatLabels();
    resetTabHighlight('All');
    
    // Get the refresh button and add loading state
    const refreshBtn = document.querySelector('button[onclick="refreshGRNData()"]');
    const originalBtnContent = refreshBtn ? refreshBtn.innerHTML : null;
    
    try {
        isRefreshInProgress = true;
        
        // Show loading state on button
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = `
                <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Syncing with Sage...</span>
            `;
        }
        
        showToast('🔄 Syncing with Sage database...', 'info');
        
        const syncResponse = await authenticatedFetch('/api/inventory-transactions/sync', { method: 'POST' });
        
        // Handle specific error codes
        if (!syncResponse.ok) {
            if (syncResponse.status === 403) {
                throw new Error('Permission denied. Please contact an administrator.');
            } else if (syncResponse.status === 409) {
                const errorData = await syncResponse.json().catch(() => ({}));
                showToast(`⏳ ${errorData.detail || 'Sync in progress. Loading cached data...'}`, 'warning');
                await loadGRNData();
                return;
            } else if (syncResponse.status === 500) {
                const errorData = await syncResponse.json().catch(() => ({}));
                throw new Error(errorData.detail || 'Server error during sync. Please try again.');
            } else {
                throw new Error(`Sync failed (${syncResponse.status})`);
            }
        }
        
        const syncResult = await syncResponse.json();
        await loadGRNData();
        
        const syncStatus = syncResult.sync_status || {};
        const stockStatus = syncResult.stock_status || {};
        const stockRecords = stockStatus.stock_records || 0;
        
        if (syncStatus.synced && syncStatus.records_synced > 0) {
            showToast(`✅ Synced ${syncStatus.records_synced} transactions + ${stockRecords} stock records!`, 'success');
        } else {
            showToast(`✅ Synced with Sage (${stockRecords} stock records updated)`, 'success');
        }
        
    } catch (error) {
        console.error('Error refreshing data:', error);
        showToast(`❌ ${error.message || 'Error refreshing data'}`, 'error');
    } finally {
        isRefreshInProgress = false;
        // Restore button state
        if (refreshBtn && originalBtnContent) {
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = originalBtnContent;
        }
    }
}

// ============================================================================
// Pagination & Filtering
// ============================================================================

/**
 * Change page
 */
export function changePage(direction) {
    currentPage += direction;
    if (currentPage < 1) currentPage = 1;
    filterGRNTable();
}

/**
 * Go to specific page
 */
export function goToPage(page) {
    currentPage = Math.max(1, page);
    filterGRNTable();
}

/**
 * Filter by category
 */
export function filterByCategory(category) {
    currentCategory = category;
    currentPage = 1;
    
    // Exit GL/AR mode when switching to a regular inventory tab
    currentGLType = null;
    allGLSalesData = [];
    
    // Restore stat labels that may have been changed by AR tabs
    restoreStatLabels();
    
    // Update tab styles
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.className = 'category-tab px-4 py-2 rounded-lg font-medium text-sm transition-all bg-slate-100 text-slate-700 hover:bg-slate-200';
    });
    
    const categoryIdMap = {
        'All': 'cat-all', 'Production Input': 'cat-production-input', 'Production Output': 'cat-production-output',
        'Local Sales': 'cat-local-sales', 'Stock Transfer': 'cat-stock-transfer', 'Export Sales': 'cat-export-sales',
        'GRN': 'cat-grn', 'Samples': 'cat-samples', 'Adjustment': 'cat-adjustment', 'Returns': 'cat-returns',
        'Expiry': 'cat-expiry', 'Reversal': 'cat-reversal', 'Trial': 'cat-trial', 'Consumables': 'cat-consumables', 'Other': 'cat-other'
    };
    
    const activeTab = document.getElementById(categoryIdMap[category] || 'cat-all');
    if (activeTab) {
        activeTab.className = 'category-tab px-4 py-2 rounded-lg font-medium text-sm transition-all bg-blue-600 text-white';
    }
    
    const tbody = document.getElementById('grn-table-body');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-8 text-center"><div class="loader mx-auto mb-4" style="display:block;"></div><p class="text-slate-400">Filtering...</p></td></tr>';
    }
    
    setTimeout(() => filterGRNTable(), 10);
}

/**
 * Restore original stat label text when switching back from AR tabs
 */
function restoreStatLabels() {
    const statIds = ['grn-total-entries', 'grn-today-count', 'grn-total-qty-in', 'grn-total-qty-out', 'grn-unique-items', 'grn-total-value'];
    statIds.forEach(id => {
        const el = document.getElementById(id);
        if (el && el.nextElementSibling) {
            const original = el.nextElementSibling.getAttribute('data-original-label');
            if (original) {
                el.nextElementSibling.textContent = original;
                el.nextElementSibling.removeAttribute('data-original-label');
            }
        }
    });
}

/**
 * Reset category tab highlighting to the given category name.
 * Used when data is reloaded (Refresh / Load All) so the AR tab doesn't
 * stay highlighted while inventory data is being shown.
 */
function resetTabHighlight(category) {
    currentCategory = category || 'All';
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.className = 'category-tab px-4 py-2 rounded-lg font-medium text-sm transition-all bg-slate-100 text-slate-700 hover:bg-slate-200';
    });
    const categoryIdMap = {
        'All': 'cat-all', 'Production Input': 'cat-production-input', 'Production Output': 'cat-production-output',
        'Local Sales': 'cat-local-sales', 'Stock Transfer': 'cat-stock-transfer', 'Export Sales': 'cat-export-sales',
        'GRN': 'cat-grn', 'Samples': 'cat-samples', 'Adjustment': 'cat-adjustment', 'Returns': 'cat-returns',
        'Expiry': 'cat-expiry', 'Reversal': 'cat-reversal', 'Trial': 'cat-trial', 'Consumables': 'cat-consumables', 'Other': 'cat-other'
    };
    const activeTab = document.getElementById(categoryIdMap[currentCategory] || 'cat-all');
    if (activeTab) {
        activeTab.className = 'category-tab px-4 py-2 rounded-lg font-medium text-sm transition-all bg-blue-600 text-white';
    }
}

// Debounced filter for search input
export const debouncedFilterGRN = debounce(() => filterGRNTable(), 300);

/**
 * Filter GRN table based on current filters.
 * If a GL/AR tab is active, filters the cached GL data instead of inventory data.
 */
export function filterGRNTable() {
    // --- GL / AR mode: filter the GL sales data client-side ---
    if (currentGLType) {
        filterAndDisplayGLSales();
        return;
    }
    
    // --- Normal inventory mode ---
    const searchTerm = document.getElementById('grn-search')?.value.toLowerCase() || '';
    const dateFrom = document.getElementById('grn-date-from')?.value || '';
    const dateTo = document.getElementById('grn-date-to')?.value || '';
    
    const filtered = allGRNData.filter(item => {
        const matchesCategory = currentCategory === 'All' || item['Category'] === currentCategory;
        const matchesSearch = !searchTerm || 
            (item['Reference'] || '').toLowerCase().includes(searchTerm) ||
            (item['Item Code'] || '').toLowerCase().includes(searchTerm) ||
            (item['Item Description'] || '').toLowerCase().includes(searchTerm) ||
            (item['Description'] || '').toLowerCase().includes(searchTerm);
        const itemDate = item['Transaction Date'];
        const matchesDateFrom = !dateFrom || itemDate >= dateFrom;
        const matchesDateTo = !dateTo || itemDate <= dateTo;
        
        return matchesCategory && matchesSearch && matchesDateFrom && matchesDateTo;
    });
    
    displayGRNData(filtered);
    updateGRNStats(filtered);
}

// ============================================================================
// Display Functions
// ============================================================================

/**
 * Display GRN data in table
 */
export function displayGRNData(data) {
    const tbody = document.getElementById('grn-table-body');
    if (!tbody) return;
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-12 text-center text-slate-400">No transactions found</td></tr>';
        return;
    }
    
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const displayData = data.slice(startIndex, endIndex);
    const totalPages = Math.ceil(data.length / rowsPerPage);
    
    const categoryColors = {
        'Production Input': 'bg-cyan-100 text-cyan-800', 'Production Output': 'bg-emerald-100 text-emerald-800',
        'Local Sales': 'bg-orange-100 text-orange-800', 'Stock Transfer': 'bg-teal-100 text-teal-800',
        'Export Sales': 'bg-blue-100 text-blue-800', 'Local Sales (AR)': 'bg-orange-100 text-orange-800',
        'Export Sales (AR)': 'bg-blue-100 text-blue-800', 'GRN': 'bg-green-100 text-green-800',
        'Samples': 'bg-lime-100 text-lime-800', 'Adjustment': 'bg-yellow-100 text-yellow-800',
        'Returns': 'bg-indigo-100 text-indigo-800', 'Expiry': 'bg-purple-100 text-purple-800',
        'Reversal': 'bg-pink-100 text-pink-800', 'Trial': 'bg-violet-100 text-violet-800',
        'Consumables': 'bg-sky-100 text-sky-800', 'Other': 'bg-slate-100 text-slate-800'
    };
    
    // Count occurrences of each GRN reference to add sequential numbering
    const grnReferenceCounts = new Map();
    const grnReferenceCurrentIndex = new Map();
    
    // First pass: count how many times each GRN reference appears
    displayData.forEach(item => {
        if (item['Category'] === 'GRN' && item['Reference']) {
            const ref = item['Reference'];
            grnReferenceCounts.set(ref, (grnReferenceCounts.get(ref) || 0) + 1);
        }
    });
    
    const rows = displayData.map(item => {
        const category = item['Category'] || 'Other';
        
        // Build the display reference with sequential numbering for GRN entries
        let displayReference = item['Reference'] || '-';
        if (category === 'GRN' && item['Reference'] && grnReferenceCounts.get(item['Reference']) > 1) {
            const ref = item['Reference'];
            const currentIdx = (grnReferenceCurrentIndex.get(ref) || 0) + 1;
            grnReferenceCurrentIndex.set(ref, currentIdx);
            // Format: GRN-645 becomes GRN-645-1, GRN-645-2, etc.
            displayReference = `${ref}-${currentIdx}`;
        }
        
        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-sm" style="min-width: 140px;">
                    <span class="inline-block px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${categoryColors[category] || categoryColors['Other']}">${category}</span>
                </td>
                <td class="px-4 py-3 text-sm font-medium text-blue-600">${displayReference}</td>
                <td class="px-4 py-3 text-sm text-slate-600">${formatDate(item['Transaction Date']) || '-'}</td>
                <td class="px-4 py-3 text-sm text-slate-600">${truncateText(item['Description'] || '-', 30)}</td>
                <td class="px-4 py-3 text-sm font-mono text-slate-800">${item['Item Code'] || '-'}</td>
                <td class="px-4 py-3 text-sm text-slate-600">${truncateText(item['Item Description'] || '-', 40)}</td>
                <td class="px-4 py-3 text-sm text-right font-medium text-green-600">${formatNumber(item['Quantity In'] || 0)}</td>
                <td class="px-4 py-3 text-sm text-right font-medium text-red-600">${formatNumber(item['Quantity Out'] || 0)}</td>
                <td class="px-4 py-3 text-sm text-right font-semibold text-slate-900">AED ${formatNumber(item['Transaction Value'] || 0, 2)}</td>
                <td class="px-4 py-3 text-sm text-right text-slate-600">${formatNumber(item['Current Stock'] || 0)}</td>
            </tr>
        `;
    });
    
    rows.push(`
        <tr class="bg-slate-50 border-t-2 border-slate-200">
            <td colspan="10" class="px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="text-sm text-slate-600">Showing <span class="font-semibold">${startIndex + 1}</span> to <span class="font-semibold">${Math.min(endIndex, data.length)}</span> of <span class="font-semibold">${data.length.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</span> transactions</div>
                    <div class="flex items-center gap-2">
                        <button onclick="changePage(-1)" ${currentPage === 1 ? 'disabled' : ''} class="px-3 py-1 rounded text-sm font-medium ${currentPage === 1 ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}">← Previous</button>
                        <span class="text-sm text-slate-600">Page <input type="number" value="${currentPage}" min="1" max="${totalPages}" onchange="goToPage(parseInt(this.value))" class="w-16 px-2 py-1 border rounded text-center mx-1" /> of ${totalPages}</span>
                        <button onclick="changePage(1)" ${currentPage === totalPages ? 'disabled' : ''} class="px-3 py-1 rounded text-sm font-medium ${currentPage === totalPages ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}">Next →</button>
                    </div>
                </div>
            </td>
        </tr>
    `);
    
    tbody.innerHTML = rows.join('');
}

/**
 * Update GRN statistics
 */
export function updateGRNStats(data) {
    const totalEntries = data.length;
    const totalQtyIn = data.reduce((sum, item) => sum + (parseFloat(item['Quantity In']) || 0), 0);
    const totalQtyOut = data.reduce((sum, item) => sum + (parseFloat(item['Quantity Out']) || 0), 0);
    const uniqueItems = new Set(data.map(item => item['Item Code'])).size;
    
    // Calculate today's transactions
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    const todayTransactions = data.filter(item => {
        if (!item['Transaction Date']) return false;
        const transactionDate = new Date(item['Transaction Date']);
        const transactionDateStr = transactionDate.toISOString().split('T')[0];
        return transactionDateStr === todayStr;
    }).length;
    
    // Sum of Transaction Value for all filtered rows
    const totalValue = data.reduce((sum, item) => sum + (parseFloat(item['Transaction Value']) || 0), 0);
    
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('grn-total-entries', totalEntries.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}));
    setEl('grn-today-count', todayTransactions.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}));
    setEl('grn-total-qty-in', formatNumber(totalQtyIn));
    setEl('grn-total-qty-out', formatNumber(totalQtyOut));
    setEl('grn-unique-items', uniqueItems.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}));
    setEl('grn-total-value', `AED ${formatNumber(totalValue, 2)}`);
}

// ============================================================================
// GL Sales (Accounts Receivable) Data
// ============================================================================

let glSalesCache = { local: null, export: null };

/**
 * Load GL Sales data from Sage (accounts receivable / sales ledger)
 * Called when "Local Sales (AR)" or "Export Sales (AR)" tabs are clicked
 */
export async function loadGLSalesData(type) {
    // Set GL/AR mode - this tells filterGRNTable to work on GL data
    currentGLType = type;
    currentPage = 1;
    
    // Update tab styles - deactivate all, then activate this one
    document.querySelectorAll('.category-tab').forEach(tab => {
        tab.className = 'category-tab px-4 py-2 rounded-lg font-medium text-sm transition-all bg-slate-100 text-slate-700 hover:bg-slate-200';
    });
    const tabId = type === 'local' ? 'cat-local-sales-ar' : 'cat-export-sales-ar';
    const activeTab = document.getElementById(tabId);
    if (activeTab) {
        activeTab.className = 'category-tab px-4 py-2 rounded-lg font-medium text-sm transition-all bg-blue-600 text-white';
    }
    
    // Show loading
    const tbody = document.getElementById('grn-table-body');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-12 text-center"><div class="loader mx-auto mb-4" style="display:block;"></div><p class="text-slate-400">Loading sales ledger data from Sage...</p></td></tr>';
    }
    
    try {
        const resp = await authenticatedFetch(`/api/gl-sales?type=${type}`);
        if (!resp.ok) throw new Error(`Failed to fetch GL sales: ${resp.status}`);
        const result = await resp.json();
        
        const data = result.data || [];
        const summary = result.summary || {};
        
        // Cache for potential re-use
        glSalesCache[type] = result;
        
        // Store ALL GL data in module state for client-side date/search filtering
        allGLSalesData = data;
        
        // Apply current date/search filters and display
        filterAndDisplayGLSales();
        
        showToast(`Loaded ${data.length} ${type === 'local' ? 'Local' : 'Export'} Sales (AR) entries`, 'success');
    } catch (e) {
        console.error('Error loading GL sales data:', e);
        currentGLType = null;
        allGLSalesData = [];
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="10" class="px-6 py-12 text-center text-red-500">Failed to load sales ledger data: ${e.message}</td></tr>`;
        }
        showToast('Failed to load sales ledger data', 'error');
    }
}

/**
 * Filter the cached GL sales data by the current date range and search box,
 * then display it and update the stats.  Called from filterGRNTable() when
 * currentGLType is set, and also directly after the initial load.
 */
function filterAndDisplayGLSales() {
    const searchTerm = document.getElementById('grn-search')?.value.toLowerCase() || '';
    const dateFrom = document.getElementById('grn-date-from')?.value || '';
    const dateTo = document.getElementById('grn-date-to')?.value || '';
    
    const filtered = allGLSalesData.filter(item => {
        const itemDate = item['Date'] || '';
        const matchesDateFrom = !dateFrom || itemDate >= dateFrom;
        const matchesDateTo   = !dateTo   || itemDate <= dateTo;
        const matchesSearch   = !searchTerm ||
            (item['Reference'] || '').toLowerCase().includes(searchTerm) ||
            (item['Description'] || '').toLowerCase().includes(searchTerm) ||
            (item['Account'] || '').toLowerCase().includes(searchTerm) ||
            (item['Account Description'] || '').toLowerCase().includes(searchTerm);
        return matchesDateFrom && matchesDateTo && matchesSearch;
    });
    
    // Display filtered data in the table
    displayGLSalesData(filtered, currentGLType);
    
    // Update stats for the filtered dataset
    const totalEntries = filtered.length;
    const totalDebit  = filtered.reduce((sum, item) => sum + (parseFloat(item['Debit']) || 0), 0);
    const totalCredit = filtered.reduce((sum, item) => sum + (parseFloat(item['Credit']) || 0), 0);
    const closingBalance = totalCredit - totalDebit;
    const uniqueRefs = new Set(filtered.map(item => item['Reference'])).size;
    
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('grn-total-entries', totalEntries.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}));
    setEl('grn-today-count', uniqueRefs.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}));
    setEl('grn-total-qty-in', totalCredit.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4}));
    setEl('grn-total-qty-out', totalDebit.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4}));
    setEl('grn-unique-items', uniqueRefs.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}));
    setEl('grn-total-value', `AED ${formatNumber(closingBalance, 2)}`);
    
    // Update stat labels for AR context
    const labelMap = {
        'grn-total-entries': 'Total Entries',
        'grn-today-count': 'Unique Invoices',
        'grn-total-qty-in': 'Total Credits',
        'grn-total-qty-out': 'Total Debits',
        'grn-unique-items': 'Unique Refs',
        'grn-total-value': 'Closing Balance'
    };
    Object.entries(labelMap).forEach(([id, label]) => {
        const el = document.getElementById(id);
        if (el && el.nextElementSibling) {
            if (!el.nextElementSibling.getAttribute('data-original-label')) {
                el.nextElementSibling.setAttribute('data-original-label', el.nextElementSibling.textContent);
            }
            el.nextElementSibling.textContent = label;
        }
    });
}

/**
 * Display GL Sales data in the transactions table
 */
function displayGLSalesData(data, type) {
    const tbody = document.getElementById('grn-table-body');
    if (!tbody) return;
    
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="px-6 py-12 text-center text-slate-400">No sales ledger entries found</td></tr>';
        return;
    }
    
    const typeBadge = type === 'local'
        ? 'bg-orange-100 text-orange-800'
        : 'bg-blue-100 text-blue-800';
    const typeLabel = type === 'local' ? 'Local Sales' : 'Export Sales';
    
    // Calculate running balance
    let runningBalance = 0;
    // Data comes sorted DESC from backend, reverse for running balance calc then re-reverse
    const sortedData = [...data].reverse();
    const balances = [];
    sortedData.forEach(item => {
        runningBalance += (parseFloat(item['Credit']) || 0) - (parseFloat(item['Debit']) || 0);
        balances.push(runningBalance);
    });
    balances.reverse();
    
    const rows = data.map((item, idx) => {
        const debit = parseFloat(item['Debit']) || 0;
        const credit = parseFloat(item['Credit']) || 0;
        const balance = balances[idx] || 0;
        
        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-sm" style="min-width: 140px;">
                    <span class="inline-block px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${typeBadge}">${typeLabel}</span>
                </td>
                <td class="px-4 py-3 text-sm font-medium text-blue-600">${item['Reference'] || '-'}</td>
                <td class="px-4 py-3 text-sm text-slate-600">${formatDate(item['Date']) || '-'}</td>
                <td class="px-4 py-3 text-sm text-slate-600">${item['Description'] || '-'}</td>
                <td class="px-4 py-3 text-sm font-mono text-slate-800">${item['Account'] || '-'}</td>
                <td class="px-4 py-3 text-sm text-slate-600">${item['Account Description'] || '-'}</td>
                <td class="px-4 py-3 text-sm text-right font-medium text-red-600">${debit > 0 ? 'AED ' + formatNumber(debit, 2) : '-'}</td>
                <td class="px-4 py-3 text-sm text-right font-medium text-green-600">${credit > 0 ? 'AED ' + formatNumber(credit, 2) : '-'}</td>
                <td class="px-4 py-3 text-sm text-right font-semibold text-slate-900">AED ${formatNumber(balance, 2)}</td>
                <td class="px-4 py-3 text-sm text-right text-slate-600">-</td>
            </tr>
        `;
    });
    
    // Add summary row
    const totalDebit = data.reduce((sum, item) => sum + (parseFloat(item['Debit']) || 0), 0);
    const totalCredit = data.reduce((sum, item) => sum + (parseFloat(item['Credit']) || 0), 0);
    const closingBalance = totalCredit - totalDebit;
    
    rows.push(`
        <tr class="bg-slate-50 border-t-2 border-slate-200">
            <td colspan="10" class="px-6 py-4">
                <div class="flex items-center justify-between">
                    <div class="text-sm text-slate-600">
                        Showing <span class="font-semibold">${data.length.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</span> ${typeLabel} entries 
                        | Total Credits: <span class="font-semibold text-green-600">AED ${formatNumber(totalCredit, 2)}</span>
                        | Total Debits: <span class="font-semibold text-red-600">AED ${formatNumber(totalDebit, 2)}</span>
                        | Closing Balance: <span class="font-bold text-slate-900">AED ${formatNumber(closingBalance, 2)}</span>
                    </div>
                </div>
            </td>
        </tr>
    `);
    
    tbody.innerHTML = rows.join('');
}

// ============================================================================
// Export & Supplier Summary
// ============================================================================

/**
 * Export GRN data to CSV
 */
export function exportGRNToCSV() {
    // --- GL / AR mode export ---
    if (currentGLType && allGLSalesData.length > 0) {
        const searchTerm = document.getElementById('grn-search')?.value.toLowerCase() || '';
        const dateFrom = document.getElementById('grn-date-from')?.value || '';
        const dateTo = document.getElementById('grn-date-to')?.value || '';
        
        const dataToExport = allGLSalesData.filter(item => {
            const itemDate = item['Date'] || '';
            const matchesDateFrom = !dateFrom || itemDate >= dateFrom;
            const matchesDateTo   = !dateTo   || itemDate <= dateTo;
            const matchesSearch   = !searchTerm ||
                (item['Reference'] || '').toLowerCase().includes(searchTerm) ||
                (item['Description'] || '').toLowerCase().includes(searchTerm);
            return matchesDateFrom && matchesDateTo && matchesSearch;
        });
        
        if (dataToExport.length === 0) { showToast('No GL sales data to export', 'error'); return; }
        
        const headers = ['Date', 'Reference', 'Description', 'Account', 'Account Description', 'Debit', 'Credit'];
        const csvContent = [
            headers.join(','),
            ...dataToExport.map(item => [
                `"${item['Date'] || ''}"`, `"${item['Reference'] || ''}"`,
                `"${(item['Description'] || '').replace(/"/g, '""')}"`,
                `"${item['Account'] || ''}"`, `"${(item['Account Description'] || '').replace(/"/g, '""')}"`,
                item['Debit'] || 0, item['Credit'] || 0
            ].join(','))
        ].join('\n');
        
        const typeLabel = currentGLType === 'local' ? 'Local_Sales_AR' : 'Export_Sales_AR';
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.setAttribute('href', URL.createObjectURL(blob));
        link.setAttribute('download', `GL_${typeLabel}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Exported ${dataToExport.length} GL sales entries`, 'success');
        return;
    }
    
    // --- Normal inventory export ---
    if (!allGRNData || allGRNData.length === 0) {
        showToast('No data to export', 'error');
        return;
    }
    
    const searchTerm = document.getElementById('grn-search')?.value.toLowerCase() || '';
    const dateFrom = document.getElementById('grn-date-from')?.value || '';
    const dateTo = document.getElementById('grn-date-to')?.value || '';
    
    const dataToExport = allGRNData.filter(item => {
        const matchesCategory = currentCategory === 'All' || item['Category'] === currentCategory;
        const matchesSearch = !searchTerm || 
            (item['Reference'] || '').toLowerCase().includes(searchTerm) ||
            (item['Item Code'] || '').toLowerCase().includes(searchTerm) ||
            (item['Item Description'] || '').toLowerCase().includes(searchTerm) ||
            (item['Description'] || '').toLowerCase().includes(searchTerm);
        const itemDate = item['Transaction Date'];
        const matchesDateFrom = !dateFrom || itemDate >= dateFrom;
        const matchesDateTo = !dateTo || itemDate <= dateTo;
        return matchesCategory && matchesSearch && matchesDateFrom && matchesDateTo;
    });
    
    const headers = ['Category', 'Reference', 'Transaction Date', 'Description', 'Item Code', 'Item Description', 'Quantity In', 'Quantity Out', 'Unit Cost', 'Transaction Value', 'Current Stock'];
    const csvContent = [
        headers.join(','),
        ...dataToExport.map(item => [
            `"${item['Category'] || ''}"`, `"${item['Reference'] || ''}"`, `"${item['Transaction Date'] || ''}"`,
            `"${(item['Description'] || '').replace(/"/g, '""')}"`, `"${item['Item Code'] || ''}"`,
            `"${(item['Item Description'] || '').replace(/"/g, '""')}"`,
            item['Quantity In'] || 0, item['Quantity Out'] || 0, item['Unit Cost'] || 0,
            item['Transaction Value'] || 0, item['Current Stock'] || 0
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `Inventory_Transactions_${currentCategory.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast('Data exported to CSV successfully', 'success');
}

/**
 * Toggle supplier summary section
 */
export function toggleSupplierSummary() {
    const section = document.getElementById('supplier-summary-section');
    const icon = document.getElementById('supplier-summary-icon');
    if (section && icon) {
        section.classList.toggle('hidden');
        icon.style.transform = section.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
    }
}

/**
 * Generate supplier summary from GRN data
 */
export function generateSupplierSummary(grnData) {
    const supplierMap = new Map();
    
    grnData.forEach(item => {
        // For GRN transactions, the Description field contains the supplier name directly
        const supplierName = (item['Description'] || 'Unknown Supplier').trim();
        
        // Skip empty or very short supplier names
        if (!supplierName || supplierName.length < 2) return;
        
        if (!supplierMap.has(supplierName)) {
            supplierMap.set(supplierName, { 
                uniqueItems: new Set(), 
                totalQtyReceived: 0, 
                items: new Map(), // itemCode -> { currentStock, unitCost }
                totalValue: 0 
            });
        }
        
        const supplier = supplierMap.get(supplierName);
        const itemCode = item['Item Code'];
        
        // Track unique items
        if (itemCode) {
            supplier.uniqueItems.add(itemCode);
            
            // Store latest stock info for each item
            supplier.items.set(itemCode, {
                currentStock: parseFloat(item['Current Stock']) || 0,
                unitCost: parseFloat(item['Unit Cost']) || 0
            });
        }
        
        // Sum up quantities received
        supplier.totalQtyReceived += parseFloat(item['Quantity In']) || 0;
        
        // Sum up transaction values
        supplier.totalValue += parseFloat(item['Transaction Value']) || 0;
    });
    
    // Convert to array and calculate current stock
    const suppliers = Array.from(supplierMap.entries())
        .map(([name, data]) => {
            let currentStock = 0;
            data.items.forEach(itemInfo => {
                currentStock += itemInfo.currentStock;
            });
            
            return {
                name,
                uniqueItems: data.uniqueItems.size,
                totalQtyReceived: data.totalQtyReceived,
                currentStock: currentStock,
                totalValue: data.totalValue
            };
        })
        .sort((a, b) => b.totalValue - a.totalValue);
    
    const tbody = document.getElementById('supplier-summary-tbody');
    if (tbody) {
        if (suppliers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="px-6 py-8 text-center text-slate-400">
                        No supplier data available
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = suppliers.slice(0, 20).map((supplier) => `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-4 py-3 text-sm font-medium text-slate-900">${supplier.name}</td>
                    <td class="px-4 py-3 text-sm text-center text-slate-600">${supplier.uniqueItems.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</td>
                    <td class="px-4 py-3 text-sm text-right text-green-600 font-medium">${formatNumber(supplier.totalQtyReceived)}</td>
                    <td class="px-4 py-3 text-sm text-right text-slate-600">${formatNumber(supplier.currentStock)}</td>
                    <td class="px-4 py-3 text-sm text-right font-semibold text-slate-900">AED ${formatNumber(supplier.totalValue, 2)}</td>
                    <td class="px-4 py-3 text-center">
                        <button onclick="showSupplierDetails('${supplier.name.replace(/'/g, "\\'")}'); event.stopPropagation();" class="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors">
                            View Details
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    }
}

/**
 * Show supplier details
 */
export function showSupplierDetails(supplierName) {
    document.getElementById('grn-search').value = supplierName;
    filterByCategory('GRN');
    
    const banner = document.getElementById('active-filter-banner');
    if (banner) {
        banner.classList.remove('hidden');
        const text = banner.querySelector('span');
        if (text) text.textContent = `Showing GRN entries for: ${supplierName}`;
    }
}

/**
 * Clear supplier filter
 */
export function clearSupplierFilter() {
    document.getElementById('grn-search').value = '';
    filterByCategory('All');
    
    const banner = document.getElementById('active-filter-banner');
    if (banner) banner.classList.add('hidden');
    
    showToast('Filter cleared - showing all transactions', 'success');
}

/**
 * Back to supplier summary
 */
export function backToSupplierSummary() {
    const banner = document.getElementById('active-filter-banner');
    if (banner) banner.classList.add('hidden');
    
    document.getElementById('grn-search').value = '';
    
    const section = document.getElementById('supplier-summary-section');
    const icon = document.getElementById('supplier-summary-icon');
    if (section) section.classList.remove('hidden');
    if (icon) icon.style.transform = 'rotate(180deg)';
    
    filterGRNTable();
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    showToast('Back to supplier summary', 'info');
}
