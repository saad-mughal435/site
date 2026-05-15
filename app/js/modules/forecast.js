/**
 * Demo Plant LLC - Forecast Module
 * Handles multi-product forecast with grouped display and PDF generation
 * Products are sourced from Recipe Formation (recipes list)
 */

import { showToast, state, formatNumber, formatDate, truncateText } from '../utils.js?v=20260125h';
import { authenticatedFetch } from '../auth.js?v=20260428b';

// ============================================================================
// State
// ============================================================================

let allProducts = [];
let forecastQuantities = {}; // { recipeName: quantity }
let groupedProducts = {};
let collapsedGroups = new Set();

// Packaging type categories for grouping
// Each category can match by item code prefix OR description patterns in the recipe name
const PACKAGING_CATEGORIES = [
    { key: '500ml_can', label: '500ml Can', codePrefixes: ['202-'], patterns: ['500ml can', '500ml-can', '500 ml can'] },
    { key: '300ml_can', label: '300ml Can', codePrefixes: ['204-'], patterns: ['300ml can', '300ml-can', '300 ml can'] },
    { key: '330ml_can', label: '330ml Can', codePrefixes: ['203-'], patterns: ['330ml can', '330ml-can', '330 ml can'] },
    { key: '2500ml_pet', label: '2.5L PET', codePrefixes: ['301-'], patterns: ['2.5l pet', '2500ml pet', '2.5 l pet', '2.5l'] },
    { key: '330ml_pet', label: '330ml PET', codePrefixes: ['303-'], patterns: ['330ml pet', '330ml-pet', '330 ml pet', 'pet 330ml'] },
    { key: '500ml_pet', label: '500ml PET', codePrefixes: ['302-'], patterns: ['500ml pet', '500ml-pet', '500 ml pet', 'pet 500ml'] },
    { key: 'other', label: 'Other Products', codePrefixes: [], patterns: [] }
];

// ============================================================================
// Recipe Name Parsing
// ============================================================================

/**
 * Parse a recipe name into item code and description
 * Recipe names follow the format: "204-EA-DB-11 - Dragon Blueberry 300ml Can AE"
 * @param {string} recipeName - Full recipe name
 * @returns {{ itemCode: string, description: string }}
 */
function parseRecipeName(recipeName) {
    // Split on " - " to separate item code from description
    const separatorIdx = recipeName.indexOf(' - ');
    if (separatorIdx > 0) {
        return {
            itemCode: recipeName.substring(0, separatorIdx).trim(),
            description: recipeName.substring(separatorIdx + 3).trim()
        };
    }
    // Fallback: use the whole name as both
    return { itemCode: recipeName, description: recipeName };
}

// ============================================================================
// Product Loading & Grouping
// ============================================================================

/**
 * Load all recipes from Recipe Formation for forecasting
 */
export async function loadForecastProducts() {
    const container = document.getElementById('forecast-products-container');
    if (!container) return;
    
    // Set default forecast month to next month
    const monthInput = document.getElementById('forecast-month');
    if (monthInput && !monthInput.value) {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        monthInput.value = nextMonth.toISOString().slice(0, 7);
    }
    
    container.innerHTML = `
        <div class="bg-white rounded-xl shadow-lg p-8 text-center text-gray-400">
            <div class="loader border-indigo-600 border-t-transparent w-8 h-8 mx-auto mb-4"></div>
            Loading recipes...
        </div>
    `;
    
    try {
        const response = await authenticatedFetch('/api/recipes');
        if (!response.ok) throw new Error('Failed to load recipes');
        
        const data = await response.json();
        const recipes = data.recipes || [];
        
        // Transform recipes into product-like objects for the forecast table
        allProducts = recipes.map(recipe => {
            const { itemCode, description } = parseRecipeName(recipe.name);
            return {
                recipeName: recipe.name,
                itemCode: itemCode,
                description: description,
                type: recipe.type  // 'template' or 'custom'
            };
        });
        
        // Group products by packaging type
        groupedProducts = groupProductsByPackaging(allProducts);
        
        // Render the grouped table
        renderForecastTable();
        
    } catch (error) {
        console.error('Error loading forecast recipes:', error);
        container.innerHTML = `
            <div class="bg-white rounded-xl shadow-lg p-8 text-center text-red-400">
                <svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                Error loading recipes: ${error.message}
            </div>
        `;
    }
}

/**
 * Group products by packaging type based on item code prefix and recipe name patterns
 */
function groupProductsByPackaging(products) {
    const groups = {};
    
    // Initialize all groups
    PACKAGING_CATEGORIES.forEach(cat => {
        groups[cat.key] = {
            label: cat.label,
            products: []
        };
    });
    
    products.forEach(product => {
        const code = (product.itemCode || '').toLowerCase();
        const name = (product.recipeName || '').toLowerCase();
        const combined = `${code} ${name}`;
        
        let matched = false;
        
        for (const cat of PACKAGING_CATEGORIES) {
            if (cat.key === 'other') continue;
            
            // Match by item code prefix (e.g. 202- = 500ml Can, 302- = 500ml PET)
            if (cat.codePrefixes && cat.codePrefixes.length > 0) {
                for (const prefix of cat.codePrefixes) {
                    if (code.startsWith(prefix.toLowerCase())) {
                        groups[cat.key].products.push(product);
                        matched = true;
                        break;
                    }
                }
                if (matched) break;
            }
            
            // Match by description patterns
            for (const pattern of cat.patterns) {
                if (combined.includes(pattern)) {
                    groups[cat.key].products.push(product);
                    matched = true;
                    break;
                }
            }
            if (matched) break;
        }
        
        // If no match, put in "Other"
        if (!matched) {
            groups['other'].products.push(product);
        }
    });
    
    // Sort products within each group by item code
    Object.values(groups).forEach(group => {
        group.products.sort((a, b) => 
            (a.itemCode || '').localeCompare(b.itemCode || '')
        );
    });
    
    return groups;
}

// ============================================================================
// Rendering
// ============================================================================

/**
 * Render the forecast table with grouped products
 */
export function renderForecastTable() {
    const container = document.getElementById('forecast-products-container');
    if (!container) return;
    
    const searchVal = (document.getElementById('forecast-search')?.value || '').toLowerCase();
    
    let html = '';
    
    for (const cat of PACKAGING_CATEGORIES) {
        const group = groupedProducts[cat.key];
        if (!group || group.products.length === 0) continue;
        
        // Filter products by search
        const filteredProducts = searchVal 
            ? group.products.filter(p => 
                (p.itemCode || '').toLowerCase().includes(searchVal) ||
                (p.description || '').toLowerCase().includes(searchVal) ||
                (p.recipeName || '').toLowerCase().includes(searchVal)
            )
            : group.products;
        
        if (filteredProducts.length === 0) continue;
        
        const isCollapsed = collapsedGroups.has(cat.key);
        const groupTotal = filteredProducts.reduce((sum, p) => 
            sum + (forecastQuantities[p.recipeName] || 0), 0
        );
        
        html += `
            <div class="bg-white rounded-xl shadow-lg overflow-hidden">
                <!-- Group Header -->
                <div class="bg-slate-800 text-white px-6 py-4 flex justify-between items-center cursor-pointer hover:bg-slate-700 transition-colors"
                     onclick="toggleForecastGroup('${cat.key}')">
                    <div class="flex items-center gap-3">
                        <svg class="w-5 h-5 transform transition-transform ${isCollapsed ? '' : 'rotate-90'}" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd"></path>
                        </svg>
                        <span class="font-bold text-lg">${group.label}</span>
                        <span class="bg-slate-600 px-2 py-0.5 rounded text-sm">${filteredProducts.length} recipes</span>
                    </div>
                    <div class="flex items-center gap-4">
                        <span class="text-slate-300 text-sm">Group Total:</span>
                        <span class="font-bold text-lg">${groupTotal.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}</span>
                    </div>
                </div>
                
                <!-- Group Content -->
                <div class="${isCollapsed ? 'hidden' : ''}">
                    <div class="overflow-x-auto">
                        <table class="min-w-full">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-8">#</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Code</th>
                                    <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20">UOM</th>
                                    <th class="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-40">Forecast Qty</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-200">
                                ${filteredProducts.map((product, idx) => renderProductRow(product, idx + 1)).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }
    
    if (!html) {
        html = `
            <div class="bg-white rounded-xl shadow-lg p-8 text-center text-gray-400">
                No recipes found matching your search.
            </div>
        `;
    }
    
    container.innerHTML = html;
    updateForecastSummary();
}

/**
 * Render a single product row
 */
function renderProductRow(product, rowNum) {
    const itemCode = product.itemCode || '';
    const description = product.description || '';
    const recipeName = product.recipeName || '';
    const escapedRecipeName = recipeName.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    const currentQty = forecastQuantities[recipeName] || '';
    
    return `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3 text-sm text-gray-400">${rowNum}</td>
            <td class="px-4 py-3 text-sm font-medium text-gray-900">${itemCode}</td>
            <td class="px-4 py-3 text-sm text-gray-600 truncate max-w-xs" title="${description}">${description}</td>
            <td class="px-4 py-3 text-sm text-center text-gray-600">CASES</td>
            <td class="px-4 py-3">
                <input type="number" 
                    value="${currentQty}" 
                    min="0" 
                    step="1"
                    placeholder="0"
                    onchange="updateForecastQty('${escapedRecipeName}', this.value)"
                    oninput="updateForecastQty('${escapedRecipeName}', this.value)"
                    class="w-full border border-gray-300 rounded px-3 py-1.5 text-right text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all">
            </td>
        </tr>
    `;
}

// ============================================================================
// Quantity Management
// ============================================================================

/**
 * Update forecast quantity for a recipe
 */
export function updateForecastQty(recipeName, value) {
    const qty = parseFloat(value) || 0;
    if (qty > 0) {
        forecastQuantities[recipeName] = qty;
    } else {
        delete forecastQuantities[recipeName];
    }
    updateForecastSummary();
}

/**
 * Update the summary stats
 */
function updateForecastSummary() {
    const summaryEl = document.getElementById('forecast-summary');
    const countEl = document.getElementById('forecast-product-count');
    const totalEl = document.getElementById('forecast-total-qty');
    
    const selectedCount = Object.keys(forecastQuantities).length;
    const totalQty = Object.values(forecastQuantities).reduce((sum, qty) => sum + qty, 0);
    
    if (summaryEl) {
        summaryEl.classList.toggle('hidden', selectedCount === 0);
    }
    if (countEl) countEl.textContent = selectedCount.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4});
    if (totalEl) totalEl.textContent = totalQty.toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4});
}

/**
 * Clear all forecast quantities
 */
export function clearAllForecastQty() {
    forecastQuantities = {};
    renderForecastTable();
    showToast('All quantities cleared', 'info');
}

/**
 * Toggle group collapse state
 */
export function toggleForecastGroup(groupKey) {
    if (collapsedGroups.has(groupKey)) {
        collapsedGroups.delete(groupKey);
    } else {
        collapsedGroups.add(groupKey);
    }
    renderForecastTable();
}

/**
 * Filter products by search term
 */
export function filterForecastProducts() {
    renderForecastTable();
}

// ============================================================================
// PDF Generation
// ============================================================================

/**
 * Get products with non-zero forecast quantities, including recipe name
 */
export function getSelectedProducts() {
    return Object.entries(forecastQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([recipeName, quantity]) => {
            const { itemCode } = parseRecipeName(recipeName);
            return { item_code: itemCode, quantity, recipe_name: recipeName };
        });
}

/**
 * Generate forecast PDF report
 */
export async function generateForecastPDF() {
    const selectedProducts = getSelectedProducts();
    
    if (selectedProducts.length === 0) {
        showToast('Please enter forecast quantities for at least one recipe', 'error');
        return;
    }
    
    const monthInput = document.getElementById('forecast-month');
    const forecastMonth = monthInput?.value || '';
    
    if (!forecastMonth) {
        showToast('Please select a forecast month', 'error');
        return;
    }
    
    // Format month for display (e.g., "2026-02" -> "February 2026")
    const [year, month] = forecastMonth.split('-');
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                        'July', 'August', 'September', 'October', 'November', 'December'];
    const formattedMonth = `${monthNames[parseInt(month) - 1]} ${year}`;
    
    const loader = document.getElementById('loader-forecast');
    if (loader) loader.classList.remove('hidden');
    
    try {
        const response = await authenticatedFetch('/api/forecast-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                forecast_month: formattedMonth,
                products: selectedProducts
            })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to generate PDF');
        }
        
        // Download the PDF
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Forecast_Report_${formattedMonth.replace(' ', '_')}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        
        showToast('Forecast PDF generated successfully!', 'success');

    } catch (error) {
        console.error('Error generating forecast PDF:', error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

// ============================================================================
// Sub-tab switching (Current Forecast vs Past Forecast)
// ============================================================================

/**
 * Switch between Current Forecast and Past Forecast sub-tabs
 * @param {string} subTab - 'current' or 'past'
 */
export function switchForecastSubTab(subTab) {
    const inactive = "px-6 py-2.5 font-medium text-sm rounded-lg transition-all bg-white border border-slate-300 text-slate-700 hover:bg-slate-50";
    const active   = "px-6 py-2.5 font-medium text-sm rounded-lg transition-all bg-blue-600 text-white shadow-sm";

    const currentView = document.getElementById('forecast-subview-current');
    const pastView    = document.getElementById('forecast-subview-past');
    const currentBtn  = document.getElementById('forecast-subtab-current');
    const pastBtn     = document.getElementById('forecast-subtab-past');

    if (!currentView || !pastView || !currentBtn || !pastBtn) return;

    currentView.classList.add('hidden');
    pastView.classList.add('hidden');
    currentBtn.className = inactive;
    pastBtn.className = inactive;

    if (subTab === 'past') {
        pastView.classList.remove('hidden');
        pastBtn.className = active;
    } else {
        currentView.classList.remove('hidden');
        currentBtn.className = active;
    }
}

// ============================================================================
// Past Forecast - aggregated inventory transactions view
// ============================================================================

let pastForecastRows = [];          // server-returned individual transactions

// Same category badge palette used by Inventory Transactions (grn.js).
const PAST_FORECAST_CATEGORY_COLORS = {
    'Production Input': 'bg-cyan-100 text-cyan-800',
    'Production Output': 'bg-emerald-100 text-emerald-800',
    'Local Sales': 'bg-orange-100 text-orange-800',
    'Stock Transfer': 'bg-teal-100 text-teal-800',
    'Export Sales': 'bg-blue-100 text-blue-800',
    'GRN': 'bg-green-100 text-green-800',
    'Samples': 'bg-lime-100 text-lime-800',
    'Adjustment': 'bg-yellow-100 text-yellow-800',
    'Returns': 'bg-indigo-100 text-indigo-800',
    'Expiry': 'bg-purple-100 text-purple-800',
    'Reversal': 'bg-pink-100 text-pink-800',
    'Trial': 'bg-violet-100 text-violet-800',
    'Consumables': 'bg-sky-100 text-sky-800',
    'Other': 'bg-slate-100 text-slate-800',
};

/**
 * Load individual inventory transactions for the chosen date range / search.
 * Calls /api/past-forecast-transactions which server-side filters by date+search.
 */
export async function loadPastForecastData() {
    const dateFrom = document.getElementById('past-forecast-date-from')?.value || '';
    const dateTo   = document.getElementById('past-forecast-date-to')?.value   || '';
    const search   = document.getElementById('past-forecast-search')?.value   || '';

    if (!dateFrom && !dateTo && !search) {
        showToast('Please enter a date range or search term', 'error');
        return;
    }

    const tbody = document.getElementById('past-forecast-table-body');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="11" class="px-6 py-12 text-center"><div class="loader mx-auto mb-4" style="display:block;"></div><p class="text-slate-400">Loading transactions...</p></td></tr>';
    }

    try {
        const params = new URLSearchParams();
        if (dateFrom) params.set('date_from', dateFrom);
        if (dateTo)   params.set('date_to', dateTo);
        if (search)   params.set('search', search);

        const resp = await authenticatedFetch(`/api/past-forecast-transactions?${params.toString()}`);
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.detail || `Request failed (${resp.status})`);
        }
        const result = await resp.json();
        pastForecastRows = result.data || [];

        renderPastForecastTable(pastForecastRows);
    } catch (err) {
        console.error('Error loading past forecast data:', err);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="11" class="px-6 py-12 text-center text-red-500">Error: ${err.message}</td></tr>`;
        }
        showToast(`Error: ${err.message}`, 'error');
    }
}

/**
 * Render the individual transactions table into #past-forecast-table-body.
 * Columns mirror Inventory Transactions: Category | Reference | Date |
 * Description | Item Code | Item Description | Qty In | Qty Out | Value | Stock.
 * Always updates the summary stat tiles at the top.
 */
function renderPastForecastTable(rows) {
    const tbody = document.getElementById('past-forecast-table-body');
    if (!tbody) return;

    const totalIn       = (rows || []).reduce((s, r) => s + (parseFloat(r['Quantity In'])  || 0), 0);
    const totalOut      = (rows || []).reduce((s, r) => s + (parseFloat(r['Quantity Out']) || 0), 0);
    const totalEtStock  = (rows || []).reduce((s, r) => s + (parseFloat(r['ET Stock'])     || 0), 0);
    const totalSageStock = (rows || []).reduce((s, r) => s + (parseFloat(r['Sage Stock'])  || 0), 0);
    const totalStock    = totalEtStock + totalSageStock;
    const uniqueItems = new Set((rows || []).map(r => r['Item Code']).filter(Boolean)).size;

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('past-forecast-item-count', uniqueItems.toLocaleString());
    setEl('past-forecast-total-in', formatNumber(totalIn));
    setEl('past-forecast-total-out', formatNumber(totalOut));
    setEl('past-forecast-total-et-stock', formatNumber(totalEtStock));
    setEl('past-forecast-total-sage-stock', formatNumber(totalSageStock));
    setEl('past-forecast-total-stock', formatNumber(totalStock));

    if (!rows || rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="px-6 py-12 text-center text-slate-400">No transactions found for these filters.</td></tr>';
        return;
    }

    const rowsHtml = rows.map(r => {
        const category = r['Category'] || 'Other';
        const badge = PAST_FORECAST_CATEGORY_COLORS[category] || PAST_FORECAST_CATEGORY_COLORS['Other'];
        const etStock = parseFloat(r['ET Stock']) || 0;
        const sageStock = parseFloat(r['Sage Stock']) || 0;
        const total = etStock + sageStock;
        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-4 py-3 text-sm" style="min-width: 140px;">
                    <span class="inline-block px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap ${badge}">${category}</span>
                </td>
                <td class="px-4 py-3 text-sm font-medium text-blue-600">${r['Reference'] || '-'}</td>
                <td class="px-4 py-3 text-sm text-slate-600">${formatDate(r['Transaction Date']) || '-'}</td>
                <td class="px-4 py-3 text-sm text-slate-600">${truncateText(r['Description'] || '-', 30)}</td>
                <td class="px-4 py-3 text-sm font-mono text-slate-800">${r['Item Code'] || '-'}</td>
                <td class="px-4 py-3 text-sm text-slate-600">${truncateText(r['Item Description'] || '-', 40)}</td>
                <td class="px-4 py-3 text-sm text-right font-medium text-green-600">${formatNumber(r['Quantity In'] || 0)}</td>
                <td class="px-4 py-3 text-sm text-right font-medium text-red-600">${formatNumber(r['Quantity Out'] || 0)}</td>
                <td class="px-4 py-3 text-sm text-right text-amber-700">${formatNumber(etStock)}</td>
                <td class="px-4 py-3 text-sm text-right text-blue-700">${formatNumber(sageStock)}</td>
                <td class="px-4 py-3 text-sm text-right font-semibold text-slate-900">${formatNumber(total)}</td>
            </tr>
        `;
    }).join('');

    tbody.innerHTML = rowsHtml;
}

/**
 * Client-side filter over the already-loaded rows (no re-fetch).
 * Returns early if no data has been loaded yet.
 */
export function filterPastForecast() {
    if (!pastForecastRows || pastForecastRows.length === 0) return;
    const search = (document.getElementById('past-forecast-search')?.value || '').toLowerCase();
    if (!search) {
        renderPastForecastTable(pastForecastRows);
        return;
    }
    const filtered = pastForecastRows.filter(r =>
        (r['Item Code'] || '').toLowerCase().includes(search) ||
        (r['Item Description'] || '').toLowerCase().includes(search) ||
        (r['Reference'] || '').toLowerCase().includes(search) ||
        (r['Description'] || '').toLowerCase().includes(search)
    );
    renderPastForecastTable(filtered);
}

/**
 * Generate the aggregated PDF report.
 * Always uses current input values so the PDF reflects exactly the filters
 * the user has set (predictable: click Load to refresh the on-screen table
 * to match, or click Download PDF to fetch a PDF for whatever's in the inputs).
 */
export async function generatePastForecastPDF() {
    const dateFrom = document.getElementById('past-forecast-date-from')?.value || '';
    const dateTo   = document.getElementById('past-forecast-date-to')?.value   || '';
    const search   = document.getElementById('past-forecast-search')?.value   || '';

    if (!dateFrom && !dateTo && !search) {
        showToast('Please enter a date range or search term first', 'error');
        return;
    }

    const loader = document.getElementById('loader-past-forecast');
    if (loader) loader.classList.remove('hidden');

    try {
        const resp = await authenticatedFetch('/api/past-forecast-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date_from: dateFrom || null,
                date_to: dateTo || null,
                search: search || null,
            })
        });

        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.detail || `Request failed (${resp.status})`);
        }

        const blob = await resp.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileStamp = [dateFrom || 'all', dateTo || 'all'].join('_to_');
        a.download = `Past_Forecast_${fileStamp}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        showToast('Past Forecast PDF downloaded', 'success');
    } catch (err) {
        console.error('Error generating past forecast PDF:', err);
        showToast(`Error: ${err.message}`, 'error');
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}
