/**
 * Demo Plant LLC - Quotations & Invoicing Module
 * Handles quotations, proforma invoices, price list, and customer management
 */

import { showToast, state, debounce } from '../utils.js?v=20260125h';
import { authenticatedFetch, hasAnyRole, getCurrentUser } from '../auth.js?v=20260428b';

// ============================================================================
// Module State
// ============================================================================

let priceListData = [];
let customersData = [];
let finishedGoodsData = [];
let quotationsData = [];
let invoicesData = [];
let companySettings = {};
let currentQuotationItems = [];
let editingQuotation = null;
let currentSubTab = 'create';

// ============================================================================
// Page Initialization
// ============================================================================

/**
 * Initialize the quotations page
 */
export async function loadQuotationsPage() {
    await Promise.all([
        loadCompanySettings(),
        loadFinishedGoods(),
        loadPriceList(),
        loadCustomers()
    ]);
    switchQuotationSubTab('create');
}

/**
 * Switch between quotation sub-tabs
 */
export function switchQuotationSubTab(subTab) {
    currentSubTab = subTab;
    
    // Hide all content
    const tabs = ['create', 'pricelist', 'customers', 'history'];
    tabs.forEach(tab => {
        const el = document.getElementById(`quot-content-${tab}`);
        if (el) el.classList.add('hidden');
        
        const btn = document.getElementById(`quot-subtab-${tab}`);
        if (btn) {
            btn.classList.remove('bg-blue-600', 'text-white');
            btn.classList.add('bg-white', 'text-slate-700', 'border-slate-300');
        }
    });
    
    // Show selected
    const selectedEl = document.getElementById(`quot-content-${subTab}`);
    const selectedBtn = document.getElementById(`quot-subtab-${subTab}`);
    if (selectedEl) selectedEl.classList.remove('hidden');
    if (selectedBtn) {
        selectedBtn.classList.remove('bg-white', 'text-slate-700', 'border-slate-300');
        selectedBtn.classList.add('bg-blue-600', 'text-white');
    }
    
    // Load data for specific tabs
    switch(subTab) {
        case 'create':
            initCreateQuotationForm();
            break;
        case 'pricelist':
            renderPriceList();
            break;
        case 'customers':
            renderCustomers();
            break;
        case 'history':
            loadQuotationHistory();
            break;
    }
}

// ============================================================================
// API Calls
// ============================================================================

async function loadCompanySettings() {
    try {
        const response = await authenticatedFetch('/api/company-settings');
        if (response.ok) {
            companySettings = await response.json();
        }
    } catch (e) {
        console.error('Error loading company settings:', e);
    }
}

async function loadFinishedGoods() {
    try {
        const response = await authenticatedFetch('/api/finished-goods-inventory');
        if (response.ok) {
            finishedGoodsData = await response.json();
        }
    } catch (e) {
        console.error('Error loading finished goods:', e);
    }
}

async function loadPriceList() {
    try {
        const response = await authenticatedFetch('/api/price-list?limit=1000');
        if (response.ok) {
            const data = await response.json();
            priceListData = data.items || [];
        }
    } catch (e) {
        console.error('Error loading price list:', e);
    }
}

async function loadCustomers() {
    try {
        const response = await authenticatedFetch('/api/customers?limit=500');
        if (response.ok) {
            const data = await response.json();
            customersData = data.customers || [];
        }
    } catch (e) {
        console.error('Error loading customers:', e);
    }
}

async function loadQuotationHistory() {
    try {
        const response = await authenticatedFetch('/api/quotations?limit=100');
        if (response.ok) {
            const data = await response.json();
            quotationsData = data.quotations || [];
            renderQuotationHistory();
        }
    } catch (e) {
        console.error('Error loading quotations:', e);
        showToast('Error loading quotations', 'error');
    }
    
    try {
        const response = await authenticatedFetch('/api/proforma-invoices?limit=100');
        if (response.ok) {
            const data = await response.json();
            invoicesData = data.invoices || [];
        }
    } catch (e) {
        console.error('Error loading invoices:', e);
    }
}

// ============================================================================
// Create Quotation Form
// ============================================================================

function initCreateQuotationForm() {
    currentQuotationItems = [];
    editingQuotation = null;
    
    // Populate customer dropdown
    const customerSelect = document.getElementById('quot-customer-select');
    if (customerSelect) {
        customerSelect.innerHTML = '<option value="">-- Select Customer --</option>';
        customersData.forEach(c => {
            customerSelect.innerHTML += `<option value="${c._id}">${c.name} (${c.customer_code})</option>`;
        });
    }
    
    // Populate product dropdown
    populateProductDropdown();
    
    // Set defaults from company settings
    const vatToggle = document.getElementById('quot-include-vat');
    const vatRate = document.getElementById('quot-vat-rate');
    const validity = document.getElementById('quot-validity-days');
    const paymentTerms = document.getElementById('quot-payment-terms');
    const deliveryTerms = document.getElementById('quot-delivery-terms');
    const currency = document.getElementById('quot-currency');
    
    if (vatToggle) vatToggle.checked = true;
    if (vatRate) vatRate.value = companySettings.default_vat_rate || 5;
    if (validity) validity.value = companySettings.default_validity_days || 30;
    if (paymentTerms) paymentTerms.value = companySettings.default_payment_terms || '';
    if (deliveryTerms) deliveryTerms.value = companySettings.default_delivery_terms || '';
    if (currency) currency.value = 'AED';
    
    renderQuotationItems();
    updateQuotationTotals();
}

function populateProductDropdown() {
    const select = document.getElementById('quot-product-select');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Select Product --</option>';
    
    // Create a map of prices
    const priceMap = {};
    priceListData.forEach(p => {
        priceMap[p.item_code] = p;
    });
    
    // Add finished goods with prices
    finishedGoodsData.forEach(fg => {
        const code = fg['Item Code'] || fg.item_code;
        const desc = fg['Item Description'] || fg.description || '';
        const priceInfo = priceMap[code];
        const price = priceInfo ? priceInfo.base_price : 0;
        
        select.innerHTML += `<option value="${code}" data-description="${desc}" data-price="${price}" data-uom="${priceInfo?.uom || 'Case'}">${code} - ${desc}</option>`;
    });
}

export function addQuotationItem() {
    const select = document.getElementById('quot-product-select');
    const qtyInput = document.getElementById('quot-item-qty');
    const discInput = document.getElementById('quot-item-discount');
    const priceInput = document.getElementById('quot-item-price');
    
    if (!select || !select.value) {
        showToast('Please select a product', 'warning');
        return;
    }
    
    const option = select.options[select.selectedIndex];
    const qty = parseFloat(qtyInput?.value) || 1;
    const discount = parseFloat(discInput?.value) || 0;
    const price = parseFloat(priceInput?.value) || parseFloat(option.dataset.price) || 0;
    
    const item = {
        item_code: select.value,
        description: option.dataset.description || '',
        quantity: qty,
        unit_price: price,
        discount_percent: discount,
        uom: option.dataset.uom || 'Case'
    };
    
    // Calculate line total
    const subtotal = qty * price;
    const discAmount = subtotal * (discount / 100);
    item.discount_amount = discAmount;
    item.line_total = subtotal - discAmount;
    
    currentQuotationItems.push(item);
    
    // Reset form
    select.value = '';
    if (qtyInput) qtyInput.value = '1';
    if (discInput) discInput.value = '0';
    if (priceInput) priceInput.value = '';
    
    renderQuotationItems();
    updateQuotationTotals();
    showToast('Item added', 'success');
}

export function removeQuotationItem(index) {
    currentQuotationItems.splice(index, 1);
    renderQuotationItems();
    updateQuotationTotals();
}

export function updateQuotationItemQty(index, qty) {
    const item = currentQuotationItems[index];
    if (!item) return;
    
    item.quantity = parseFloat(qty) || 1;
    const subtotal = item.quantity * item.unit_price;
    item.discount_amount = subtotal * (item.discount_percent / 100);
    item.line_total = subtotal - item.discount_amount;
    
    renderQuotationItems();
    updateQuotationTotals();
}

export function updateQuotationItemDiscount(index, discount) {
    const item = currentQuotationItems[index];
    if (!item) return;
    
    item.discount_percent = parseFloat(discount) || 0;
    const subtotal = item.quantity * item.unit_price;
    item.discount_amount = subtotal * (item.discount_percent / 100);
    item.line_total = subtotal - item.discount_amount;
    
    renderQuotationItems();
    updateQuotationTotals();
}

function renderQuotationItems() {
    const tbody = document.getElementById('quot-items-body');
    if (!tbody) return;
    
    if (currentQuotationItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500">No items added yet</td></tr>';
        return;
    }
    
    const currency = document.getElementById('quot-currency')?.value || 'AED';
    const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'AED';
    
    tbody.innerHTML = currentQuotationItems.map((item, idx) => `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="px-3 py-2 text-sm font-medium text-slate-900">${item.item_code}</td>
            <td class="px-3 py-2 text-sm text-slate-600">${item.description.substring(0, 40)}${item.description.length > 40 ? '...' : ''}</td>
            <td class="px-3 py-2">
                <input type="number" min="1" value="${item.quantity}" 
                    onchange="updateQuotationItemQty(${idx}, this.value)"
                    class="w-20 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500">
            </td>
            <td class="px-3 py-2 text-sm text-right">${currencySymbol} ${item.unit_price.toLocaleString(undefined, {minimumFractionDigits: 4})}</td>
            <td class="px-3 py-2">
                <input type="number" min="0" max="100" step="0.5" value="${item.discount_percent}" 
                    onchange="updateQuotationItemDiscount(${idx}, this.value)"
                    class="w-16 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500">%
            </td>
            <td class="px-3 py-2 text-sm text-right font-semibold">${currencySymbol} ${item.line_total.toLocaleString(undefined, {minimumFractionDigits: 4})}</td>
            <td class="px-3 py-2 text-center">
                <button onclick="removeQuotationItem(${idx})" class="text-red-600 hover:text-red-800">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');
}

export function updateQuotationTotals() {
    const currency = document.getElementById('quot-currency')?.value || 'AED';
    const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'AED';
    const includeVat = document.getElementById('quot-include-vat')?.checked ?? true;
    const vatRate = parseFloat(document.getElementById('quot-vat-rate')?.value) || 5;
    const additionalDiscount = parseFloat(document.getElementById('quot-additional-discount')?.value) || 0;
    
    let subtotal = 0;
    let discountTotal = 0;
    
    currentQuotationItems.forEach(item => {
        subtotal += item.quantity * item.unit_price;
        discountTotal += item.discount_amount || 0;
    });
    
    const additionalDiscountAmount = subtotal * (additionalDiscount / 100);
    const taxableAmount = subtotal - discountTotal - additionalDiscountAmount;
    const vatAmount = includeVat ? taxableAmount * (vatRate / 100) : 0;
    const total = taxableAmount + vatAmount;
    
    // Update display
    const els = {
        subtotal: document.getElementById('quot-subtotal'),
        discount: document.getElementById('quot-discount-total'),
        addDiscount: document.getElementById('quot-additional-discount-amount'),
        taxable: document.getElementById('quot-taxable'),
        vat: document.getElementById('quot-vat-amount'),
        total: document.getElementById('quot-total')
    };
    
    if (els.subtotal) els.subtotal.textContent = `${currencySymbol} ${subtotal.toLocaleString(undefined, {minimumFractionDigits: 4})}`;
    if (els.discount) els.discount.textContent = `- ${currencySymbol} ${discountTotal.toLocaleString(undefined, {minimumFractionDigits: 4})}`;
    if (els.addDiscount) els.addDiscount.textContent = `- ${currencySymbol} ${additionalDiscountAmount.toLocaleString(undefined, {minimumFractionDigits: 4})}`;
    if (els.taxable) els.taxable.textContent = `${currencySymbol} ${taxableAmount.toLocaleString(undefined, {minimumFractionDigits: 4})}`;
    if (els.vat) els.vat.textContent = includeVat ? `${currencySymbol} ${vatAmount.toLocaleString(undefined, {minimumFractionDigits: 4})}` : 'Exempt';
    if (els.total) els.total.textContent = `${currencySymbol} ${total.toLocaleString(undefined, {minimumFractionDigits: 4})}`;
}

export function onProductSelect() {
    const select = document.getElementById('quot-product-select');
    const priceInput = document.getElementById('quot-item-price');
    
    if (select && priceInput && select.value) {
        const option = select.options[select.selectedIndex];
        priceInput.value = option.dataset.price || '0';
    }
}

// ============================================================================
// Save/Submit Quotation
// ============================================================================

export async function saveQuotation() {
    const customerId = document.getElementById('quot-customer-select')?.value;
    if (!customerId) {
        showToast('Please select a customer', 'warning');
        return;
    }
    
    if (currentQuotationItems.length === 0) {
        showToast('Please add at least one item', 'warning');
        return;
    }
    
    const data = {
        customer_id: customerId,
        items: currentQuotationItems.map(item => ({
            item_code: item.item_code,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount_percent: item.discount_percent,
            uom: item.uom
        })),
        currency: document.getElementById('quot-currency')?.value || 'AED',
        include_vat: document.getElementById('quot-include-vat')?.checked ?? true,
        vat_rate: parseFloat(document.getElementById('quot-vat-rate')?.value) || 5,
        additional_discount_percent: parseFloat(document.getElementById('quot-additional-discount')?.value) || 0,
        validity_days: parseInt(document.getElementById('quot-validity-days')?.value) || 30,
        payment_terms: document.getElementById('quot-payment-terms')?.value || null,
        delivery_terms: document.getElementById('quot-delivery-terms')?.value || null,
        notes: document.getElementById('quot-notes')?.value || null
    };
    
    try {
        const url = editingQuotation ? `/api/quotations/${editingQuotation._id}` : '/api/quotations';
        const method = editingQuotation ? 'PUT' : 'POST';
        
        const response = await authenticatedFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            const result = await response.json();
            showToast(editingQuotation ? 'Quotation updated!' : 'Quotation saved!', 'success');
            clearQuotationForm();
            return result;
        } else {
            const err = await response.json();
            showToast(err.detail || 'Error saving quotation', 'error');
        }
    } catch (e) {
        console.error('Error saving quotation:', e);
        showToast('Error saving quotation', 'error');
    }
}

export async function saveAndDownloadQuotation() {
    const result = await saveQuotation();
    if (result && result._id) {
        downloadQuotationPDF(result._id);
    }
}

export function clearQuotationForm() {
    currentQuotationItems = [];
    editingQuotation = null;
    
    document.getElementById('quot-customer-select').value = '';
    document.getElementById('quot-additional-discount').value = '0';
    document.getElementById('quot-notes').value = '';
    
    renderQuotationItems();
    updateQuotationTotals();
}

// ============================================================================
// Price List Management
// ============================================================================

function renderPriceList() {
    const tbody = document.getElementById('pricelist-body');
    const searchInput = document.getElementById('pricelist-search');
    const search = searchInput?.value?.toLowerCase() || '';
    
    if (!tbody) return;
    
    let filtered = priceListData;
    if (search) {
        filtered = priceListData.filter(p => 
            p.item_code.toLowerCase().includes(search) ||
            (p.description || '').toLowerCase().includes(search)
        );
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="12" class="px-4 py-8 text-center text-slate-500">No items found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(item => {
        const stdCost = parseFloat(item.standard_cost) || 0;
        const dutyComputed = (stdCost * 0.05).toFixed(4);
        return `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="px-4 py-3 text-sm font-medium text-slate-900">${item.item_code}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${item.description || ''}</td>
            <td class="px-4 py-3">
                <input type="number" step="0.0001" min="0" value="${stdCost}"
                    onchange="updatePriceListItem('${item.item_code}', 'standard_cost', this.value)"
                    class="w-28 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500">
            </td>
            <td class="px-4 py-3">
                <input type="number" step="0.0001" min="0" value="${parseFloat(item.custom_value) || 0}"
                    onchange="updatePriceListItem('${item.item_code}', 'custom_value', this.value)"
                    class="w-28 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500">
            </td>
            <td class="px-4 py-3 text-sm text-slate-600 font-medium" data-duty-cell="${item.item_code}">${dutyComputed}</td>
            <td class="px-4 py-3">
                <input type="number" step="0.0001" min="0" value="${parseFloat(item.selling_price) || 0}"
                    onchange="updatePriceListItem('${item.item_code}', 'selling_price', this.value)"
                    class="w-28 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500">
            </td>
            <td class="px-4 py-3">
                <input type="number" step="0.0001" min="0" value="${parseFloat(item.rsp) || 0}"
                    onchange="updatePriceListItem('${item.item_code}', 'rsp', this.value)"
                    class="w-28 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500">
            </td>
            <td class="px-4 py-3">
                <input type="number" step="0.0001" min="0" value="${parseFloat(item.excise_tax_value) || 0}"
                    onchange="updatePriceListItem('${item.item_code}', 'excise_tax_value', this.value)"
                    class="w-28 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500">
            </td>
            <td class="px-4 py-3">
                <input type="number" step="0.0001" min="0" value="${item.base_price}"
                    onchange="updatePriceListItem('${item.item_code}', 'base_price', this.value)"
                    class="w-28 px-2 py-1 text-sm border border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500">
            </td>
            <td class="px-4 py-3">
                <select onchange="updatePriceListItem('${item.item_code}', 'currency', this.value)"
                    class="px-2 py-1 text-sm border border-slate-300 rounded focus:ring-blue-500 focus:border-blue-500">
                    <option value="AED" ${item.currency === 'AED' ? 'selected' : ''}>AED</option>
                    <option value="USD" ${item.currency === 'USD' ? 'selected' : ''}>USD</option>
                    <option value="EUR" ${item.currency === 'EUR' ? 'selected' : ''}>EUR</option>
                </select>
            </td>
            <td class="px-4 py-3 text-sm text-slate-600">${item.uom || 'Case'}</td>
            <td class="px-4 py-3 text-center">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                    ${item.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
        </tr>
    `}).join('');
}

export async function updatePriceListItem(itemCode, field, value) {
    try {
        const numericFields = ['base_price', 'standard_cost', 'custom_value', 'duty_5_percent', 'selling_price', 'rsp', 'excise_tax_value'];
        const data = {};
        data[field] = numericFields.includes(field) ? parseFloat(value) : value;

        if (field === 'standard_cost') {
            const dutyVal = parseFloat(value) * 0.05;
            data['duty_5_percent'] = dutyVal;
        }

        const response = await authenticatedFetch(`/api/price-list/${encodeURIComponent(itemCode)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            const idx = priceListData.findIndex(p => p.item_code === itemCode);
            if (idx >= 0) {
                Object.keys(data).forEach(k => { priceListData[idx][k] = data[k]; });
            }
            if (field === 'standard_cost') {
                const dutyCell = document.querySelector(`[data-duty-cell="${itemCode}"]`);
                if (dutyCell) dutyCell.textContent = (parseFloat(value) * 0.05).toFixed(4);
            }
            showToast('Price updated', 'success');
        } else {
            showToast('Error updating price', 'error');
        }
    } catch (e) {
        console.error('Error updating price list item:', e);
        showToast('Error updating price', 'error');
    }
}

export async function syncPriceList() {
    try {
        const response = await authenticatedFetch('/api/price-list/sync-from-inventory', {
            method: 'POST'
        });
        
        if (response.ok) {
            const result = await response.json();
            showToast(result.message, 'success');
            await loadPriceList();
            renderPriceList();
        } else {
            showToast('Error syncing price list', 'error');
        }
    } catch (e) {
        console.error('Error syncing price list:', e);
        showToast('Error syncing price list', 'error');
    }
}

export const debouncedPriceListSearch = debounce(renderPriceList, 300);

// ============================================================================
// Customer Management
// ============================================================================

function renderCustomers() {
    const tbody = document.getElementById('customers-body');
    const searchInput = document.getElementById('customers-search');
    const search = searchInput?.value?.toLowerCase() || '';
    
    if (!tbody) return;
    
    let filtered = customersData;
    if (search) {
        filtered = customersData.filter(c => 
            c.name.toLowerCase().includes(search) ||
            c.customer_code.toLowerCase().includes(search) ||
            (c.email || '').toLowerCase().includes(search)
        );
    }
    
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">No customers found</td></tr>';
        return;
    }
    
    tbody.innerHTML = filtered.map(c => `
        <tr class="border-b border-slate-100 hover:bg-slate-50">
            <td class="px-4 py-3 text-sm font-medium text-slate-900">${c.customer_code}</td>
            <td class="px-4 py-3 text-sm text-slate-900">${c.name}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${c.email || '-'}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${c.phone || '-'}</td>
            <td class="px-4 py-3">
                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    ${c.customer_type}
                </span>
            </td>
            <td class="px-4 py-3 text-center">
                <button onclick="editCustomer('${c._id}')" class="text-blue-600 hover:text-blue-800 mr-2" title="Edit">
                    <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                </button>
            </td>
        </tr>
    `).join('');
}

export function showAddCustomerModal() {
    document.getElementById('customer-modal-title').textContent = 'Add New Customer';
    document.getElementById('customer-form').reset();
    document.getElementById('customer-modal-id').value = '';
    document.getElementById('customer-modal').classList.remove('hidden');
}

export function editCustomer(customerId) {
    const customer = customersData.find(c => c._id === customerId);
    if (!customer) return;
    
    document.getElementById('customer-modal-title').textContent = 'Edit Customer';
    document.getElementById('customer-modal-id').value = customer._id;
    document.getElementById('customer-name').value = customer.name || '';
    document.getElementById('customer-address').value = customer.address || '';
    document.getElementById('customer-city').value = customer.city || '';
    document.getElementById('customer-country').value = customer.country || '';
    document.getElementById('customer-email').value = customer.email || '';
    document.getElementById('customer-phone').value = customer.phone || '';
    document.getElementById('customer-contact').value = customer.contact_person || '';
    document.getElementById('customer-type').value = customer.customer_type || 'retail';
    document.getElementById('customer-currency').value = customer.default_currency || 'AED';
    document.getElementById('customer-terms').value = customer.credit_terms || '';
    document.getElementById('customer-trn').value = customer.tax_number || '';
    
    document.getElementById('customer-modal').classList.remove('hidden');
}

export function closeCustomerModal() {
    document.getElementById('customer-modal').classList.add('hidden');
}

export async function saveCustomer() {
    const customerId = document.getElementById('customer-modal-id').value;
    const data = {
        name: document.getElementById('customer-name').value,
        address: document.getElementById('customer-address').value || null,
        city: document.getElementById('customer-city').value || null,
        country: document.getElementById('customer-country').value || null,
        email: document.getElementById('customer-email').value || null,
        phone: document.getElementById('customer-phone').value || null,
        contact_person: document.getElementById('customer-contact').value || null,
        customer_type: document.getElementById('customer-type').value,
        default_currency: document.getElementById('customer-currency').value,
        credit_terms: document.getElementById('customer-terms').value || null,
        tax_number: document.getElementById('customer-trn').value || null
    };
    
    if (!data.name) {
        showToast('Customer name is required', 'warning');
        return;
    }
    
    try {
        const url = customerId ? `/api/customers/${customerId}` : '/api/customers';
        const method = customerId ? 'PUT' : 'POST';
        
        const response = await authenticatedFetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showToast(customerId ? 'Customer updated!' : 'Customer created!', 'success');
            closeCustomerModal();
            await loadCustomers();
            renderCustomers();
            
            // Also update the dropdown in create form
            populateCustomerDropdown();
        } else {
            const err = await response.json();
            showToast(err.detail || 'Error saving customer', 'error');
        }
    } catch (e) {
        console.error('Error saving customer:', e);
        showToast('Error saving customer', 'error');
    }
}

function populateCustomerDropdown() {
    const customerSelect = document.getElementById('quot-customer-select');
    if (customerSelect) {
        const currentVal = customerSelect.value;
        customerSelect.innerHTML = '<option value="">-- Select Customer --</option>';
        customersData.forEach(c => {
            customerSelect.innerHTML += `<option value="${c._id}">${c.name} (${c.customer_code})</option>`;
        });
        customerSelect.value = currentVal;
    }
}

export const debouncedCustomerSearch = debounce(renderCustomers, 300);

// ============================================================================
// Quotation History
// ============================================================================

function renderQuotationHistory() {
    const tbody = document.getElementById('quotation-history-body');
    if (!tbody) return;
    
    const allDocs = [
        ...quotationsData.map(q => ({ ...q, docType: 'quotation' })),
        ...invoicesData.map(i => ({ ...i, docType: 'invoice' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    if (allDocs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-4 py-8 text-center text-slate-500">No quotations or invoices found</td></tr>';
        return;
    }
    
    tbody.innerHTML = allDocs.map(doc => {
        const docNumber = doc.docType === 'invoice' ? doc.invoice_number : doc.quotation_number;
        const customer = doc.customer_snapshot?.name || 'Unknown';
        const date = new Date(doc.created_at).toLocaleDateString();
        const status = doc.status;
        const total = doc.total || 0;
        const currency = doc.currency || 'AED';
        
        const statusColors = {
            draft: 'bg-gray-100 text-gray-800',
            sent: 'bg-blue-100 text-blue-800',
            approved: 'bg-green-100 text-green-800',
            rejected: 'bg-red-100 text-red-800',
            converted: 'bg-purple-100 text-purple-800',
            issued: 'bg-indigo-100 text-indigo-800',
            paid: 'bg-emerald-100 text-emerald-800'
        };
        
        return `
            <tr class="border-b border-slate-100 hover:bg-slate-50">
                <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${doc.docType === 'invoice' ? 'bg-indigo-100 text-indigo-800' : 'bg-blue-100 text-blue-800'}">
                        ${doc.docType === 'invoice' ? 'PI' : 'QUO'}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm font-medium text-slate-900">${docNumber}</td>
                <td class="px-4 py-3 text-sm text-slate-600">${customer}</td>
                <td class="px-4 py-3 text-sm text-slate-600">${date}</td>
                <td class="px-4 py-3 text-sm font-semibold text-slate-900">${currency} ${total.toLocaleString(undefined, {minimumFractionDigits: 4})}</td>
                <td class="px-4 py-3">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColors[status] || 'bg-gray-100 text-gray-800'}">
                        ${status}
                    </span>
                </td>
                <td class="px-4 py-3 text-center">
                    <button onclick="downloadQuotationPDF('${doc._id}', '${doc.docType}')" class="text-blue-600 hover:text-blue-800 mr-2" title="Download PDF">
                        <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </button>
                    ${doc.docType === 'quotation' && doc.status !== 'converted' ? `
                        <button onclick="convertToInvoice('${doc._id}')" class="text-green-600 hover:text-green-800 mr-2" title="Convert to Invoice">
                            <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </button>
                    ` : ''}
                    ${doc.docType === 'quotation' && ['draft', 'sent'].includes(doc.status) ? `
                        <button onclick="editQuotationFromHistory('${doc._id}')" class="text-yellow-600 hover:text-yellow-800 mr-2" title="Edit">
                            <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                            </svg>
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

export async function downloadQuotationPDF(id, docType = 'quotation') {
    try {
        const url = docType === 'invoice' 
            ? `/api/proforma-invoices/${id}/pdf`
            : `/api/quotations/${id}/pdf`;
        
        const response = await authenticatedFetch(url);
        if (response.ok) {
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `${docType === 'invoice' ? 'PI' : 'QUO'}-${id}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(downloadUrl);
            a.remove();
        } else {
            showToast('Error downloading PDF', 'error');
        }
    } catch (e) {
        console.error('Error downloading PDF:', e);
        showToast('Error downloading PDF', 'error');
    }
}

export async function convertToInvoice(quotationId) {
    if (!confirm('Convert this quotation to a proforma invoice?')) return;
    
    try {
        const response = await authenticatedFetch(`/api/quotations/${quotationId}/convert`, {
            method: 'POST'
        });
        
        if (response.ok) {
            const invoice = await response.json();
            showToast('Quotation converted to Proforma Invoice!', 'success');
            await loadQuotationHistory();
            
            // Offer to download the invoice
            if (confirm('Download the proforma invoice PDF?')) {
                downloadQuotationPDF(invoice._id, 'invoice');
            }
        } else {
            const err = await response.json();
            showToast(err.detail || 'Error converting quotation', 'error');
        }
    } catch (e) {
        console.error('Error converting quotation:', e);
        showToast('Error converting quotation', 'error');
    }
}

export async function editQuotationFromHistory(quotationId) {
    const quotation = quotationsData.find(q => q._id === quotationId);
    if (!quotation) {
        showToast('Quotation not found', 'error');
        return;
    }
    
    // Switch to create tab
    switchQuotationSubTab('create');
    
    // Load quotation data into form
    editingQuotation = quotation;
    
    document.getElementById('quot-customer-select').value = quotation.customer_id;
    document.getElementById('quot-currency').value = quotation.currency || 'AED';
    document.getElementById('quot-include-vat').checked = quotation.include_vat ?? true;
    document.getElementById('quot-vat-rate').value = quotation.vat_rate || 5;
    document.getElementById('quot-additional-discount').value = quotation.additional_discount_percent || 0;
    document.getElementById('quot-validity-days').value = quotation.validity_days || 30;
    document.getElementById('quot-payment-terms').value = quotation.payment_terms || '';
    document.getElementById('quot-delivery-terms').value = quotation.delivery_terms || '';
    document.getElementById('quot-notes').value = quotation.notes || '';
    
    // Load items
    currentQuotationItems = quotation.items.map(item => ({
        ...item,
        discount_amount: item.discount_amount || 0,
        line_total: item.line_total || (item.quantity * item.unit_price)
    }));
    
    renderQuotationItems();
    updateQuotationTotals();
    
    showToast('Quotation loaded for editing', 'info');
}

export async function updateQuotationStatus(quotationId, newStatus) {
    try {
        const response = await authenticatedFetch(`/api/quotations/${quotationId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            showToast(`Quotation marked as ${newStatus}`, 'success');
            await loadQuotationHistory();
        } else {
            showToast('Error updating status', 'error');
        }
    } catch (e) {
        console.error('Error updating quotation status:', e);
        showToast('Error updating status', 'error');
    }
}

// Export functions to window for inline handlers
if (typeof window !== 'undefined') {
    window.switchQuotationSubTab = switchQuotationSubTab;
    window.addQuotationItem = addQuotationItem;
    window.removeQuotationItem = removeQuotationItem;
    window.updateQuotationItemQty = updateQuotationItemQty;
    window.updateQuotationItemDiscount = updateQuotationItemDiscount;
    window.updateQuotationTotals = updateQuotationTotals;
    window.onProductSelect = onProductSelect;
    window.saveQuotation = saveQuotation;
    window.saveAndDownloadQuotation = saveAndDownloadQuotation;
    window.clearQuotationForm = clearQuotationForm;
    window.updatePriceListItem = updatePriceListItem;
    window.syncPriceList = syncPriceList;
    window.showAddCustomerModal = showAddCustomerModal;
    window.editCustomer = editCustomer;
    window.closeCustomerModal = closeCustomerModal;
    window.saveCustomer = saveCustomer;
    window.downloadQuotationPDF = downloadQuotationPDF;
    window.convertToInvoice = convertToInvoice;
    window.editQuotationFromHistory = editQuotationFromHistory;
    window.updateQuotationStatus = updateQuotationStatus;
    window.debouncedPriceListSearch = debouncedPriceListSearch;
    window.debouncedCustomerSearch = debouncedCustomerSearch;
}


