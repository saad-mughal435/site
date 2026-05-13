/**
 * Demo Plant LLC - Shared Utilities Module
 * Contains performance utilities, DOM helpers, and common functions
 */

// ============================================================================
// DOM Element Cache
// ============================================================================

const cachedElements = {};

/**
 * Get DOM element by ID with caching to avoid repeated lookups
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
export function getElement(id) {
    if (!cachedElements[id]) {
        cachedElements[id] = document.getElementById(id);
    }
    return cachedElements[id];
}

/**
 * Clear cached element (useful after dynamic DOM changes)
 * @param {string} id - Element ID to clear from cache
 */
export function clearElementCache(id) {
    delete cachedElements[id];
}

// ============================================================================
// Performance Utilities
// ============================================================================

/**
 * Debounce function - delays execution until after wait period of inactivity
 * Prevents excessive function calls during rapid events (typing, scrolling)
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function}
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

/**
 * Throttle function - ensures function runs at most once per frame
 * Good for scroll handlers and resize events
 * @param {Function} func - Function to throttle
 * @returns {Function}
 */
export function throttle(func) {
    let waiting = false;
    return function(...args) {
        if (!waiting) {
            waiting = true;
            requestAnimationFrame(() => {
                func.apply(this, args);
                waiting = false;
            });
        }
    };
}

// ============================================================================
// Toast Notifications
// ============================================================================

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - 'success', 'error', or 'info'
 */
export function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) {
        console.warn('Toast container not found!');
        return;
    }
    
    const toast = document.createElement('div');
    const bgColor = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-blue-600';
    const icon = type === 'success' 
        ? 'M5 13l4 4L19 7' 
        : type === 'error' 
            ? 'M6 18L18 6M6 6l12 12'
            : 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    
    toast.className = `toast ${bgColor} text-white px-5 py-3 rounded-lg flex items-center gap-3`;
    toast.innerHTML = `
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${icon}"></path>
        </svg>
        <span class="text-sm font-medium">${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto-remove after 4 seconds (longer for readability)
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(400px)';
        toast.style.transition = 'all 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ============================================================================
// Formatters
// ============================================================================

/**
 * Format date string to DD/MM/YYYY
 * @param {string} dateString - Date string to format
 * @returns {string}
 */
export function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    } catch (e) {
        return dateString;
    }
}

/**
 * Format number with locale formatting
 * @param {number|string} num - Number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string}
 */
export function formatNumber(num, decimals = 2) {
    if (num === null || num === undefined) return '0';
    const parsed = parseFloat(num);
    if (isNaN(parsed)) return '0';
    return parsed.toLocaleString('en-US', { 
        minimumFractionDigits: decimals, 
        maximumFractionDigits: decimals 
    });
}

/**
 * Format file size in human-readable format
 * @param {number} bytes - Size in bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(4)) + ' ' + sizes[i];
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string}
 */
export function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// ============================================================================
// Global State Store
// ============================================================================

/**
 * Global application state
 * Centralized state management for the application
 */
export const state = {
    // Recipe state
    currentRecipeItems: [],
    currentRecipeName: "",
    currentRecipeBaseQty: 1,
    allRecipes: [],
    currentViewMode: 'list',
    currentFilter: 'all',
    isNewRecipeMode: false,
    recipeDirty: false,
    
    // Inventory state
    currentInventorySubTab: 'rm',
    rmInventoryFilter: 'all',
    fgInventoryFilter: 'all',
    etInventoryFilter: 'all',
    rmInventoryData: [],
    fgInventoryData: [],
    etInventoryData: [],
    
    // Calculator state
    selectedUnit: 'cases',
    
    // Job order state
    currentJOItems: [],
    savedJobOrders: [],
    
    // Yield state
    productionBatches: [],
    
    // GRN state
    grnData: [],
    grnCurrentPage: 0,
    grnItemsPerPage: 100,
    grnTotalItems: 0,
    grnCurrentCategory: 'all',
    
    // Documents state
    allDocuments: [],
    currentDocPage: 0,
    docsPerPage: 50,
    totalDocuments: 0
};

// ============================================================================
// API Configuration
// ============================================================================

/**
 * API base URL - empty for same-origin requests
 */
export const API_BASE = '';

/**
 * Make an API request with error handling
 * @param {string} endpoint - API endpoint
 * @param {object} options - Fetch options
 * @returns {Promise<any>}
 */
export async function apiRequest(endpoint, options = {}) {
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        throw error;
    }
}
