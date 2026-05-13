/**
 * Demo Plant LLC - Analytics Module (Optimized)
 * Uses server-side MongoDB aggregation for fast dashboard loading
 */

import { formatNumber, formatDate, showToast } from '../utils.js';
import { authenticatedFetch } from '../auth.js';

// ============================================================================
// Module State
// ============================================================================

let analyticsData = null; // Stores the aggregated summary from API
let currentDateRange = 30; // Default: Last 30 days
let currentCategoryFilter = 'All'; // Track selected category filter
let charts = {}; // Store chart instances for cleanup

// ============================================================================
// Main Load Function
// ============================================================================

/**
 * Load analytics data and render dashboard
 * Uses optimized /api/analytics/summary endpoint with server-side aggregation
 */
export async function loadAnalytics() {
    try {
        showLoadingOverlay(true);
        
        // Attach event listeners first
        attachEventListeners();
        
        // Fetch aggregated analytics data from optimized endpoint
        await fetchAnalyticsSummary();
        
        showLoadingOverlay(false);
        
    } catch (error) {
        console.error('Error loading analytics:', error);
        showToast('Error loading analytics data', 'error');
        showLoadingOverlay(false);
    }
}

/**
 * Fetch analytics summary from server (with server-side aggregation)
 */
async function fetchAnalyticsSummary() {
    try {
        // Build query parameters
        const days = currentDateRange || 0; // 0 means all time
        const categoryParam = currentCategoryFilter && currentCategoryFilter !== 'All' 
            ? `&category=${encodeURIComponent(currentCategoryFilter)}` 
            : '';
        
        const url = `/api/analytics/summary?days=${days}${categoryParam}`;
        console.log(`📊 Fetching analytics summary: ${url}`);
        
        const response = await authenticatedFetch(url);
        if (!response.ok) throw new Error('Failed to fetch analytics summary');
        
        analyticsData = await response.json();
        
        console.log('✅ Analytics summary loaded:', {
            kpis: analyticsData.kpis,
            categories: Object.keys(analyticsData.categories || {}).length,
            timeSeries: (analyticsData.time_series || []).length,
            topItems: (analyticsData.top_items || []).length,
            productionVsSales: (analyticsData.production_vs_sales || []).length
        });
        
        // Populate category filter dropdown with available categories
        populateCategoryFilter(analyticsData.categories);
        
        // Render all analytics components
        renderAnalytics();
        
    } catch (error) {
        console.error('Error fetching analytics summary:', error);
        throw error;
    }
}

/**
 * Attach event listeners to filter controls
 */
function attachEventListeners() {
    // Category filter
    const categoryFilter = document.getElementById('analytics-category-filter');
    if (categoryFilter) {
        categoryFilter.removeEventListener('change', handleCategoryChange);
        categoryFilter.addEventListener('change', handleCategoryChange);
        console.log('✅ Category filter event listener attached');
    }
    
    // Date range filter
    const dateRangeFilter = document.getElementById('analytics-date-range');
    if (dateRangeFilter) {
        dateRangeFilter.removeEventListener('change', handleDateRangeChange);
        dateRangeFilter.addEventListener('change', handleDateRangeChange);
        console.log('✅ Date range filter event listener attached');
    }
}

/**
 * Populate category filter dropdown with available categories from data
 */
function populateCategoryFilter(categories) {
    const select = document.getElementById('analytics-category-filter');
    if (!select || !categories) return;
    
    // Save current value
    const currentValue = select.value || 'All';
    
    // Clear existing options except "All Categories"
    select.innerHTML = '<option value="All">All Categories</option>';
    
    // Add category options sorted by value (descending)
    const sortedCategories = Object.entries(categories)
        .sort((a, b) => b[1].value - a[1].value)
        .map(([name]) => name);
    
    sortedCategories.forEach(category => {
        if (category) {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            select.appendChild(option);
        }
    });
    
    // Restore selection if still valid
    if (sortedCategories.includes(currentValue) || currentValue === 'All') {
        select.value = currentValue;
    }
}

/**
 * Handle category filter change
 */
function handleCategoryChange(event) {
    const category = event.target.value;
    filterAnalyticsByCategory(category);
}

/**
 * Handle date range filter change
 */
function handleDateRangeChange(event) {
    updateAnalyticsDateRange();
}

/**
 * Update date range and re-fetch data
 */
export function updateAnalyticsDateRange() {
    const select = document.getElementById('analytics-date-range');
    if (!select) return;
    
    const value = select.value;
    if (value === 'all') {
        currentDateRange = 0; // All time (0 tells the API to return all)
    } else {
        currentDateRange = parseInt(value);
    }
    
    console.log(`📅 Date range changed to: ${currentDateRange || 'all time'}`);
    
    // Re-fetch data from server with new date range
    showLoadingOverlay(true);
    fetchAnalyticsSummary()
        .catch(error => {
            console.error('Error updating date range:', error);
            showToast('Error updating analytics', 'error');
        })
        .finally(() => showLoadingOverlay(false));
}

/**
 * Filter analytics by category (re-fetches from server)
 */
export function filterAnalyticsByCategory(category) {
    console.log('🔍 Category filter changed to:', category);
    
    currentCategoryFilter = category;
    updateCategoryFilterUI(category);
    
    // Re-fetch data from server with category filter
    showLoadingOverlay(true);
    fetchAnalyticsSummary()
        .catch(error => {
            console.error('Error applying category filter:', error);
            showToast('Error filtering analytics', 'error');
        })
        .finally(() => showLoadingOverlay(false));
}

/**
 * Update category filter dropdown UI
 */
function updateCategoryFilterUI(activeCategory) {
    const select = document.getElementById('analytics-category-filter');
    if (select) {
        select.value = activeCategory;
        
        // Add visual indicator when filter is active
        if (activeCategory && activeCategory !== 'All') {
            select.style.borderColor = '#3b82f6';
            select.style.borderWidth = '2px';
            select.style.backgroundColor = '#eff6ff';
        } else {
            select.style.borderColor = '';
            select.style.borderWidth = '';
            select.style.backgroundColor = '';
        }
    }
}

// ============================================================================
// Chart Helpers
// ============================================================================

/**
 * Calculate optimal number of x-axis ticks based on data size
 * Ensures charts remain readable regardless of time range
 */
function getMaxTicksForDataSize(dataLength) {
    if (dataLength <= 15) return dataLength;      // Show all for small datasets
    if (dataLength <= 31) return 15;              // ~2 week intervals for month
    if (dataLength <= 90) return 12;              // Monthly for 3 months
    if (dataLength <= 365) return 12;             // Monthly for year
    if (dataLength <= 730) return 12;             // Bi-monthly for 2 years
    return 10;                                     // 10 labels max for very large datasets
}

// ============================================================================
// Rendering Functions
// ============================================================================

/**
 * Main render function - updates all analytics components using server-aggregated data
 */
export function renderAnalytics() {
    if (!analyticsData) {
        console.warn('⚠️ No analytics data to render');
        return;
    }
    
    console.log('🎨 Rendering analytics dashboard');
    
    // Update KPIs
    renderKPIs(analyticsData.kpis);
    
    // Render all charts
    renderValueTrendChart(analyticsData.time_series);
    renderCategoryChart(analyticsData.categories);
    renderProductionVsSalesChart(analyticsData.production_vs_sales);
    renderTopItemsChart(analyticsData.top_items);
    renderTransactionVolumeChart(analyticsData.time_series);
    
    console.log('✅ All charts rendered');
}

/**
 * Render KPI cards using pre-aggregated data
 */
function renderKPIs(kpis) {
    if (!kpis) return;
    
    const totalValueEl = document.getElementById('kpi-total-value');
    const inboundQtyEl = document.getElementById('kpi-inbound-qty');
    const outboundQtyEl = document.getElementById('kpi-outbound-qty');
    const netChangeEl = document.getElementById('kpi-net-change');
    const transactionCountEl = document.getElementById('kpi-transaction-count');
    
    if (totalValueEl) totalValueEl.textContent = 'AED ' + formatNumber(kpis.total_value || 0);
    if (inboundQtyEl) inboundQtyEl.textContent = formatNumber(kpis.inbound_qty || 0);
    if (outboundQtyEl) outboundQtyEl.textContent = formatNumber(kpis.outbound_qty || 0);
    if (netChangeEl) {
        const netChange = kpis.net_change || 0;
        netChangeEl.textContent = (netChange >= 0 ? '+' : '') + formatNumber(netChange);
        netChangeEl.className = `text-2xl font-bold ${netChange >= 0 ? 'text-green-600' : 'text-red-600'}`;
    }
    if (transactionCountEl) {
        let countText = formatNumber(kpis.transaction_count || 0);
        if (currentCategoryFilter && currentCategoryFilter !== 'All') {
            countText += ` (${currentCategoryFilter})`;
        }
        transactionCountEl.textContent = countText;
    }
}

/**
 * Render transaction value trend chart (Line) using pre-aggregated time series
 */
function renderValueTrendChart(timeSeries) {
    const canvas = document.getElementById('chart-value-trend');
    if (!canvas) return;
    
    if (charts.valueTrend) {
        charts.valueTrend.destroy();
    }
    
    const data = timeSeries || [];
    
    // Calculate max ticks based on data size for readability
    const maxTicks = getMaxTicksForDataSize(data.length);
    
    const ctx = canvas.getContext('2d');
    charts.valueTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date),
            datasets: [{
                label: 'Transaction Value',
                data: data.map(d => d.value),
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: data.length > 100 ? 0 : 3, // Hide points when too many
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'AED ' + formatNumber(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: maxTicks,
                        maxRotation: 45,
                        minRotation: 0,
                        autoSkip: true
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'AED ' + formatNumber(value);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Render category distribution chart (Donut) using pre-aggregated categories
 */
function renderCategoryChart(categories) {
    const canvas = document.getElementById('chart-category-distribution');
    if (!canvas) return;
    
    if (charts.category) {
        charts.category.destroy();
    }
    
    if (!categories || Object.keys(categories).length === 0) {
        return;
    }
    
    const labels = Object.keys(categories);
    const values = labels.map(cat => categories[cat].value);
    
    const colors = [
        'rgb(59, 130, 246)',   // Blue
        'rgb(16, 185, 129)',   // Green
        'rgb(251, 146, 60)',   // Orange
        'rgb(239, 68, 68)',    // Red
        'rgb(139, 92, 246)',   // Purple
        'rgb(236, 72, 153)',   // Pink
        'rgb(245, 158, 11)',   // Amber
        'rgb(6, 182, 212)',    // Cyan
        'rgb(168, 85, 247)',   // Violet
        'rgb(34, 197, 94)',    // Emerald
    ];
    
    const ctx = canvas.getContext('2d');
    charts.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors.slice(0, labels.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.label + ': AED ' + formatNumber(context.parsed);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Render production output vs sales chart (Bar) using pre-aggregated data
 * This chart always shows production vs sales regardless of category filter
 */
function renderProductionVsSalesChart(productionVsSales) {
    const canvas = document.getElementById('chart-inbound-outbound');
    if (!canvas) return;
    
    if (charts.inboundOutbound) {
        charts.inboundOutbound.destroy();
    }
    
    const data = productionVsSales || [];
    console.log('📊 Rendering Production vs Sales chart with', data.length, 'data points');
    
    // Calculate max ticks based on data size for readability
    const maxTicks = getMaxTicksForDataSize(data.length);
    
    const ctx = canvas.getContext('2d');
    charts.inboundOutbound = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.date),
            datasets: [
                {
                    label: 'Production Output',
                    data: data.map(d => d.production),
                    backgroundColor: 'rgba(16, 185, 129, 0.8)',
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 1
                },
                {
                    label: 'Sales',
                    data: data.map(d => d.sales),
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: 'rgb(239, 68, 68)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatNumber(context.parsed.y) + ' units';
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: maxTicks,
                        maxRotation: 45,
                        minRotation: 0,
                        autoSkip: true
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Render top items chart (Horizontal bar) using pre-aggregated data
 */
function renderTopItemsChart(topItems) {
    const canvas = document.getElementById('chart-top-items');
    if (!canvas) return;
    
    if (charts.topItems) {
        charts.topItems.destroy();
    }
    
    const data = topItems || [];
    
    const ctx = canvas.getContext('2d');
    charts.topItems = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.item),
            datasets: [{
                label: 'Transaction Value',
                data: data.map(item => item.value),
                backgroundColor: 'rgba(139, 92, 246, 0.8)',
                borderColor: 'rgb(139, 92, 246)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'AED ' + formatNumber(context.parsed.x);
                        }
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return 'AED ' + formatNumber(value);
                        }
                    }
                }
            }
        }
    });
}

/**
 * Render transaction volume chart (Area) using pre-aggregated time series
 */
function renderTransactionVolumeChart(timeSeries) {
    const canvas = document.getElementById('chart-transaction-volume');
    if (!canvas) return;
    
    if (charts.volume) {
        charts.volume.destroy();
    }
    
    const data = timeSeries || [];
    
    // Calculate max ticks based on data size for readability
    const maxTicks = getMaxTicksForDataSize(data.length);
    
    const ctx = canvas.getContext('2d');
    charts.volume = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date),
            datasets: [{
                label: 'Number of Transactions',
                data: data.map(d => d.count),
                borderColor: 'rgb(236, 72, 153)',
                backgroundColor: 'rgba(236, 72, 153, 0.2)',
                tension: 0.4,
                fill: true,
                pointRadius: data.length > 100 ? 0 : 3, // Hide points when too many
                pointHoverRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return formatNumber(context.parsed.y) + ' transactions';
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxTicksLimit: maxTicks,
                        maxRotation: 45,
                        minRotation: 0,
                        autoSkip: true
                    }
                },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatNumber(value);
                        }
                    }
                }
            }
        }
    });
}

// ============================================================================
// UI Helpers
// ============================================================================

/**
 * Show/hide loading overlay
 */
function showLoadingOverlay(show) {
    const overlay = document.getElementById('analytics-loading');
    if (overlay) {
        overlay.classList.toggle('hidden', !show);
    }
}
