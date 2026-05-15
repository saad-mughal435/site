/**
 * Demo Plant LLC - Main Application Module
 * Handles routing, tab switching, sidebar, and module coordination
 */

// Import all modules
import { getElement, showToast, debounce, throttle, formatDate, formatNumber, formatFileSize, truncateText, state } from './utils.js?v=20260129a';
import { initAuth, requireAuth, getCurrentUser, logout, authenticatedFetch, hasRole, hasAnyRole, updateUserDisplay } from './auth.js?v=20260428b';
import { switchInventorySubTab, loadRawMaterialsInventory, syncRawMaterialsInventory, renderRMInventory, setRMInventoryFilter, searchRMInventory, debouncedSearchRM, printRMInventory, loadFinishedGoodsInventory, syncFinishedGoodsInventory, renderFGInventory, setFGInventoryFilter, searchFGInventory, debouncedSearchFG, printFGInventory, loadETInventory, syncETInventory, renderETInventory, setETInventoryFilter, searchETInventory, debouncedSearchET, printETInventory } from './modules/inventory.js?v=20260512d';
import { loadRecipeList, setRecipeView, setRecipeFilter, debouncedRenderRecipeList, renderRecipeList, loadRecipeDetails, renderRecipeItems, updateItem, addItemRow, removeItem, saveRecipe, saveRecipeAs, closeSaveModal, confirmSave, toggleExportButton, validateCurrentRecipe, exportPickingSheet, exportPickingSheetExcel, updateRecipeUIForRole, createNewRecipe, lookupItemCode, saveNewRecipe, showRecipeItemDropdown, filterRecipeDropdown, selectRecipeItem, hideAllRecipeDropdowns, deleteRecipe, showRecipeEditorPanel, markRecipeDirty, markRecipeClean, editRecipeName, cancelRenameRecipe, confirmRenameRecipe } from './modules/recipes.js?v=20260216b';
import { loadCalculatorRecipes, setUnit, calculateMaterials, exportCalculationPDF, exportCalculationPickingSheet, consumePendingJoChildIds, applyCalcEditModeToSuccessPanel } from './modules/calculator.js?v=20260429a';
import { loadJobOrderPage, setupPOUploadListener, extractPOForEditing, loadExtractedDataToForm, loadFinishedGoodsDropdown, addItemToJobOrder, removeJOItem, editJOItem, saveJOItem, cancelEditJOItem, renderJOItems, checkInventoryBeforeAction, displayInventoryCheck, updateProductionNeeded, updateStockFromProduction, hideInventoryCheck, proceedWithExportOrSave, exportJobOrderPDF, saveJobOrder, clearJobOrderForm, renderSavedJobOrders, viewJobOrder, deleteJobOrder, processJobOrder, switchJOSubTab, editReservation, deleteReservation, downloadLinkedPDF, deleteDocumentLinkGroup, resetJOCounter, saveNewCustomerFromPrompt, renderEditItemDropdown, selectEditItem, wizardNext, wizardBack, wizardGoToStep, wizardSave, clearWizard, addPIItem, removePIItem, editPIItem, savePIItemEdit, cancelPIItemEdit, togglePIPallet, updatePalletQuantity, bulkApplyPallet, bulkClearPallets, onPIRecipeChange, onJORecipeChange, switchPOTab, loadJOStatusPage, setJOStatus, downloadPendingJOsPDF, loadDraftsList, editDraft, downloadSummaryPDFByRef, downloadJOSummaryPDF, downloadDraftMergedPDF, toggleDraftItems, setOrderType, editJOType } from './modules/joborder.js?v=20260512c';
import { loadProductionBatches, showPushToProductionModal, pushToProduction, updateBatchField, updateBatchActualQty, updateActualProduced, deleteProductionBatch, sendToSage, yieldResetLinkThenSendToSage, closeQtyReturnedModal, confirmAndSendToSage, onQtyReturnedChange, onQtyAdditionalChange, onQtyUsedChange, downloadStockRequisitionPDF, downloadBatchPDF, downloadPickingSheetPDF, downloadBatchPickingSheet, closeIngredientBatchModal, saveAndDownloadPickingSheet, saveIngredientBatchNumbers, initYieldSearch, downloadIJBatchPDF } from './modules/yield.js?v=20260429a';
import { loadGRNData, loadAllGRNData, refreshGRNData, changePage, goToPage, filterByCategory, debouncedFilterGRN, filterGRNTable, displayGRNData, updateGRNStats, exportGRNToCSV, toggleSupplierSummary, generateSupplierSummary, showSupplierDetails, clearSupplierFilter, backToSupplierSummary, loadGLSalesData } from './modules/grn.js?v=20260217a';
import { loadDocumentsPage, renderDocumentsTable, updateDocumentStats, updatePaginationControls, loadDocumentsPreviousPage, loadDocumentsNextPage, filterDocuments, searchDocuments, downloadPDF, deletePDF, pushToCalculator, toggleGroup, downloadAllJOs, switchDocSubTab, completeJO, uncompleteJO, filterProdType, filterProdVolume, filterProdRM, filterProdSearchInput, savePendingReason, onStatusActiveToggle } from './modules/documents.js?v=20260421j';
import {
    processDraftToAllocation,
    loadAllocationPending,
    onAllocationSearch,
    setAllocType,
    setAllocVolume,
    switchAllocSubTab,
    returnJOToAllocation,
    returnJOItemToAllocation,
    toggleAllocationActive,
    toggleAllocationGroupActive,
    setAllocationPriority,
    updateAllocationFromStock,
    updateAllocationToProduce,
    createJobOrderFromAllocation,
} from './modules/joborders_flow.js?v=20260421f';
import { loadPOStatus, onPOStatusSearch, setPOStatusCustomer, setPOStatusType, setPOStatusVolume } from './modules/po_status.js?v=20260512a';
import { loadUsers, showCreateUserModal, closeUserModal, editUser, resetUserPassword, deleteUser, loadSageDrafts, refreshSageDrafts, loadSagePostedHistory, switchSageTab, viewSageDraftDetails, closeSageDraftModal, approveSageDraft, rejectSageDraft, checkSageAgentHealth, loadAcctDrafts, viewAcctDraftDetails, closeAcctDraftModal, approveAcctDraft, rejectAcctDraft, loadReceptionLogs, switchReceptionTab, refreshReceptionLogs, exportReceptionExcel, viewReceptionPhotos, closeReceptionPhotoModal, deleteReceptionEntry, onSageHistoryMismatchedToggle, adminResetLinkThenRem, loadUntypedJOs, setUntypedJOLocal, setUntypedJOExport } from './modules/admin.js?v=20260512a';
import { loadDashboardStats } from './modules/dashboard.js?v=20260430a';
import { isMenuAllowed } from './modules/menuConfig.js?v=20260504sdcip03';
import { loadAnalytics, updateAnalyticsDateRange, filterAnalyticsByCategory, renderAnalytics } from './modules/analytics.js?v=20260126p';
import { loadQuotationsPage, switchQuotationSubTab, addQuotationItem, removeQuotationItem, updateQuotationItemQty, updateQuotationItemDiscount, updateQuotationTotals, onProductSelect, saveQuotation, saveAndDownloadQuotation, clearQuotationForm, updatePriceListItem, syncPriceList, showAddCustomerModal, editCustomer, closeCustomerModal, saveCustomer, downloadQuotationPDF, convertToInvoice, editQuotationFromHistory, updateQuotationStatus, debouncedPriceListSearch, debouncedCustomerSearch } from './modules/quotations.js?v=20260126b';
import { loadProductionControlPage, switchProductionControlSubTab, togglePackagingType, addDownTimeEntry, addDownTimeEntryAfter, removeDownTimeEntry, updateDownTimeEntry, submitReport, saveReportDraft, downloadReportPdf, deleteProductionReport, addPalletMixRow, removePalletMixRow, downloadCompletedReportPdf, downloadCompletedDayReportById, downloadCombinedReportPdf, showMaterialsUsedById, editReportById, resetPendingReport } from './modules/productioncontrol.js?v=20260323a';
import { loadReportingPage, switchReportingSubMenu, applyReportingFilters, clearReportingFilters } from './modules/reporting.js?v=20260317g';
import { loadForecastProducts, renderForecastTable, updateForecastQty, clearAllForecastQty, toggleForecastGroup, filterForecastProducts, generateForecastPDF, getSelectedProducts, switchForecastSubTab, loadPastForecastData, filterPastForecast, generatePastForecastPDF } from './modules/forecast.js?v=20260511h';
import { loadSageEntriesPage, loadSageDrafts as loadSageEntryDrafts, setEntryType, addLineItem, removeLineItem, submitSageEntry, clearEntryForm, viewSageEntry, editSageEntry, approveSageEntry, deleteSageEntry, closeSageEntryModal, filterSageDrafts, searchSageDrafts, updateEditLineQty, removeEditLine, addEditLineItem, closeAddEditLineModal, confirmAddEditLine, closeSageEditModal, saveSageEntryEdits, showItemDropdown, filterItemDropdown, selectSageItem } from './modules/sageentries.js?v=20260202h';
import { loadRMOrderPage, switchRMOrderTab, loadCriticalMaterials, refreshCriticalMaterials, toggleSelectAllMaterials, toggleMaterialSelection, updateMaterialOrderQty, createRequisition, loadRMOrders, viewRMOrderDetail, closeRMOrderDetail, approveRMOrder, rejectRMOrder, downloadRMOrderPDF, loadReceivableOrders, openReceiveGoodsModal, closeReceiveGoodsModal, confirmReceiveGoods, loadSuppliers, showAddSupplierModal, closeAddSupplierModal, saveNewSupplier, editSupplier, deleteSupplier, searchCriticalMaterials, downloadGRNPDF, loadRMDashboard, loadGRNDocuments, filterGRNDocuments, updateRequisitionLineTotal, approveRMOrderFromDetail, toggleGRNDetail, loadCustomers, showAddCustomerModal as showAddRMCustomerModal, closeAddCustomerModal, saveNewCustomer, editCustomer as editRMCustomer, deleteCustomer, deleteRMOrder } from './modules/rmorder.js?v=20260511rm1';
import { loadAccountingPage, switchAccountingSubTab } from './modules/accounting.js?v=20260329a';
import { loadCustomsPage, switchCustomsSubTab } from './modules/customs.js?v=20260513f';
import { startDemoHideObserver } from './demo_hide.js?v=20260428a';

// ============================================================================
// Sidebar State
// ============================================================================

let sidebarCollapsed = false;

/**
 * Toggle sidebar collapsed state
 */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebarCollapsed = !sidebarCollapsed;
    
    if (sidebarCollapsed) {
        sidebar.classList.add('collapsed');
        document.body.classList.add('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', 'true');
    } else {
        sidebar.classList.remove('collapsed');
        document.body.classList.remove('sidebar-collapsed');
        localStorage.setItem('sidebarCollapsed', 'false');
    }

    updateMenuVisibility();
}

// ============================================================================
// Mobile Sidebar
// ============================================================================

/**
 * Toggle mobile sidebar open/close
 */
function toggleMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('mobile-backdrop');
    if (sidebar) sidebar.classList.toggle('mobile-open');
    if (backdrop) backdrop.classList.toggle('active');
}

/**
 * Close mobile sidebar
 */
function closeMobileSidebar() {
    const sidebar = document.getElementById('sidebar');
    const backdrop = document.getElementById('mobile-backdrop');
    if (sidebar) sidebar.classList.remove('mobile-open');
    if (backdrop) backdrop.classList.remove('active');
}

/**
 * Show/hide mobile hamburger button based on screen width
 */
function updateMobileUI() {
    const btn = document.getElementById('mobile-menu-btn');
    if (!btn) return;
    if (window.innerWidth < 768) {
        btn.classList.remove('hidden');
    } else {
        btn.classList.add('hidden');
        closeMobileSidebar();
    }
}

window.addEventListener('resize', updateMobileUI);

// ============================================================================
// Tab Switching
// ============================================================================

/**
 * Page titles mapping
 */
const pageTitles = {
    'home': 'Home',
    'inventory': 'Inventory Management',
    'recipes': 'Recipe Validation and Formation',
    'forecast': 'Forecast',
    'rmorder': 'Raw Material Orders',
    'calculator': 'Material Calculator',
    'production-reports': 'Production Reports',
    'poprocessing': 'Purchase Order Processing',
    'yield': 'Sage Batch Draft',
    'grn': 'Inventory Transactions',
    'dispatch': 'Dispatch',
    'joborders': 'Job Orders',
    'analytics': 'Analytics Dashboard',
    'quotations': 'Quotations & Invoicing',
    'sage-entries': 'Sage Entries',
    'qc': 'Quality Control',
    'mixing-section': 'Mixing Section',
    'mixing-utilities': 'Mixing Utilities',
    'sugar-dissolver': 'Sugar Dissolver',
    'reporting': 'Reporting',
    'customs': 'FTA & Customs',
    'admin': 'Admin Panel'
};

/**
 * Switch to a specific tab
 * @param {string} tab - Tab name
 * @param {boolean} updateHistory - Whether to update browser history
 */
function switchTab(tab, updateHistory = true) {
    const user = getCurrentUser();
    if (user && !isMenuAllowed(user, tab)) {
        showToast('Access denied', 'error');
        return;
    }

    requestAnimationFrame(() => {
        // Close mobile sidebar when switching tabs
        if (window.innerWidth < 768) {
            closeMobileSidebar();
        }
        
        // Hide all views - use direct DOM lookup to avoid any caching issues
        const views = ['home', 'inventory', 'recipes', 'forecast', 'rmorder', 'calculator', 'production-reports', 'poprocessing', 'quotations', 'yield', 'grn', 'dispatch', 'joborders', 'analytics', 'sage-entries', 'accounting', 'customs', 'qc', 'mixing-section', 'mixing-utilities', 'sugar-dissolver', 'reporting', 'admin'];
        views.forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) {
                el.classList.add('hidden');
                el.style.display = 'none';
            }
        });
        
        // Reset all nav links
        const inactiveClass = "nav-item flex items-center gap-3 mx-3 px-4 py-3 mb-2 rounded-lg text-slate-300";
        const activeClass = "nav-item flex items-center gap-3 mx-3 px-4 py-3 mb-2 rounded-lg bg-slate-800";
        
        views.forEach(v => {
            const nav = document.getElementById(`nav-${v}`);
            if (nav) nav.className = inactiveClass;
        });

        // Show selected view and highlight nav
        const selectedView = document.getElementById(`view-${tab}`);
        const selectedNav = document.getElementById(`nav-${tab}`);
        if (selectedView) {
            selectedView.classList.remove('hidden');
            selectedView.style.display = '';
        }
        if (selectedNav) selectedNav.className = activeClass;

        // Re-apply permission visibility - className assignments above wipe nav-hidden.
        updateMenuVisibility();

        // Update page title
        const titleEl = getElement('page-title');
        if (titleEl) titleEl.textContent = pageTitles[tab] || 'Home';

        // Toggle back-to-home button visibility
        const backBtn = document.getElementById('back-to-home-btn');
        if (backBtn) backBtn.classList.toggle('hidden', tab === 'home');
        
        // Update browser history
        if (updateHistory) {
            const url = tab === 'home' ? '/' : `/${tab}`;
            history.pushState({ tab: tab }, '', url);
        }
        
        // Load data for specific tabs
        switch(tab) {
            case 'home': loadDashboardStats(); break;
            case 'recipes': loadRecipeList(); break;
            case 'forecast': loadForecastProducts(); break;
            case 'rmorder': loadRMOrderPage(); break;
            case 'inventory': switchInventorySubTab(state.currentInventorySubTab); break;
            case 'calculator': loadCalculatorRecipes(); break;
            case 'production-reports': loadProductionControlPage(); break;
            case 'poprocessing': loadJobOrderPage(); break;
            case 'quotations': loadQuotationsPage(); break;
            case 'yield': loadProductionBatches(); break;
            case 'grn': loadGRNData(); break;
            case 'joborders': switchDocSubTab('production', 'main'); break;
            case 'analytics': loadAnalytics(); break;
            case 'sage-entries': loadSageEntriesPage(); break;
            case 'accounting': loadAccountingPage(); break;
            case 'customs': loadCustomsPage(); break;
            case 'qc':
                if (!window.loadQCPage) {
                    import('/app/api/qc/assets/ui_components/qc_menu.js?v=20260508qcpages28').then(mod => {
                        window.loadQCPage = mod.loadQCPage;
                        window.loadQCPage();
                    });
                } else {
                    window.loadQCPage();
                }
                break;
            case 'dispatch':
                if (!window.loadDispatchPage) {
                    import('./modules/dispatch.js?v=20260513disp19').then(mod => {
                        window.loadDispatchPage = mod.loadDispatchPage;
                        window.loadDispatchPage();
                    }).catch(err => {
                        console.error('Failed to load dispatch module:', err);
                        const root = document.getElementById('disp-root');
                        if (root) root.innerHTML = `<div class="text-red-600 text-sm py-8 text-center">Failed to load Dispatch module: ${(err && err.message) || err}. Check the browser console.</div>`;
                    });
                } else {
                    try { window.loadDispatchPage(); } catch (err) {
                        console.error('Dispatch render error:', err);
                        const root = document.getElementById('disp-root');
                        if (root) root.innerHTML = `<div class="text-red-600 text-sm py-8 text-center">Dispatch render error: ${(err && err.message) || err}. Check the browser console.</div>`;
                    }
                }
                break;
            case 'mixing-section':
                if (!window.initMixingSectionPage) {
                    import('./modules/mixing_section.js?v=20260513mix23').then(mod => {
                        window.initMixingSectionPage = mod.initMixingSectionPage;
                        window.initMixingSectionPage();
                    });
                } else {
                    window.initMixingSectionPage();
                }
                break;
            case 'mixing-utilities':
                if (!window.initMixingUtilitiesPage) {
                    import('./modules/mixing_utilities.js?v=20260513mu4').then(mod => {
                        window.initMixingUtilitiesPage = mod.initMixingUtilitiesPage;
                        window.initMixingUtilitiesPage();
                    });
                } else {
                    window.initMixingUtilitiesPage();
                }
                break;
            case 'sugar-dissolver':
                if (!window.initSugarDissolverPage) {
                    import('./modules/sugar_dissolver.js?v=20260506mix21').then(mod => {
                        window.initSugarDissolverPage = mod.initSugarDissolverPage;
                        window.initSugarDissolverPage();
                    });
                } else {
                    window.initSugarDissolverPage();
                }
                break;
            case 'reporting': loadReportingPage(); break;
            case 'admin': loadUsers(); loadUntypedJOs(); loadSageDrafts(); checkSageAgentHealth(); loadAcctDrafts(); loadReceptionLogs(); break;
        }

        updateCostColumnVisibility();
    });
}

// ============================================================================
// Browser History Handler
// ============================================================================

window.addEventListener('popstate', (event) => {
    const tab = event.state?.tab || 'home';
    switchTab(tab, false);
});

// ============================================================================
// Initialization
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    const path = window.location.pathname;
    
    // Skip auth check for login page
    if (path === '/login') {
        return;
    }
    
    // Initialize authentication
    try {
        await initAuth();
    } catch (error) {
        console.error('Authentication failed:', error);
        return;
    }
    
    // Update user display in header (also mounts the demo banner if applicable)
    updateUserDisplay();

    // Start demo-mode column hider - no-op for non-demo users.
    startDemoHideObserver();
    
    let initialTab = 'home';
    
    const pathMap = {
        '/recipes': 'recipes', '/inventory': 'inventory', '/forecast': 'forecast',
        '/rmorder': 'rmorder', '/calculator': 'calculator', '/po': 'po', '/poprocessing': 'poprocessing',
        '/production-reports': 'production-reports', '/yield': 'yield', '/grn': 'grn',
        '/dispatch': 'dispatch',
        '/joborders': 'joborders', '/analytics': 'analytics', '/qc': 'qc', '/mixing-section': 'mixing-section', '/tanks-mixing': 'mixing-section', '/mixing-utilities': 'mixing-utilities', '/sugar-dissolver': 'sugar-dissolver',
        '/quotations': 'quotations', '/sage-entries': 'sage-entries', '/reporting': 'reporting',
        '/accounting': 'accounting', '/customs': 'customs', '/admin': 'admin', '/login': 'login'
    };
    
    initialTab = pathMap[path] || 'home';
    
    // Set initial history state
    history.replaceState({ tab: initialTab }, '', path);
    
    // Restore sidebar state
    const savedSidebarState = localStorage.getItem('sidebarCollapsed');
    if (savedSidebarState === 'true') {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.add('collapsed');
            document.body.classList.add('sidebar-collapsed');
            sidebarCollapsed = true;
        }
    }
    
    // Show/hide admin menu based on role
    updateMenuVisibility();
    updateCostColumnVisibility();

    // Initialize mobile UI (hamburger visibility)
    updateMobileUI();

    initYieldSearch();

    switchTab(initialTab, false);
});

/**
 * Update menu visibility based on user role
 */
function updateMenuVisibility() {
    const user = getCurrentUser();
    if (!user) return;

    const adminNav = document.getElementById('nav-admin');
    if (adminNav) {
        adminNav.classList.toggle('nav-hidden', user.role !== 'admin');
    }

    const allNavItems = document.querySelectorAll('#sidebar-nav > a[id^="nav-"]');
    allNavItems.forEach(item => {
        const tab = item.id.replace(/^nav-/, '');
        if (tab === 'admin') return;
        item.classList.toggle('nav-hidden', !isMenuAllowed(user, tab));
    });

    // Hide section headers when every nav item under them is hidden.
    const sidebarChildren = Array.from(document.querySelectorAll('#sidebar-nav > *'));
    let currentSection = null;
    let currentSectionHasVisible = false;
    const finalize = () => {
        if (currentSection) {
            currentSection.classList.toggle('nav-hidden', !currentSectionHasVisible);
        }
    };
    sidebarChildren.forEach(el => {
        if (el.classList && el.classList.contains('sb-section')) {
            finalize();
            currentSection = el;
            currentSectionHasVisible = false;
        } else if (el.tagName === 'A' && el.id && el.id.startsWith('nav-')) {
            if (!el.classList.contains('nav-hidden')) currentSectionHasVisible = true;
        }
    });
    finalize();

    // Hide home dashboard module cards pointing at disallowed tabs.
    // Tab is parsed from the inline onclick="switchTab('key')" handler.
    document.querySelectorAll('.kbe-mod').forEach(card => {
        const match = (card.getAttribute('onclick') || '').match(/switchTab\(['"]([^'"]+)['"]\)/);
        if (!match) return;
        card.classList.toggle('nav-hidden', !isMenuAllowed(user, match[1]));
    });
}

/**
 * Hide cost columns (Unit Cost, Actual Cost, % of Total) for non-admin/non-manager roles
 */
function updateCostColumnVisibility() {
    const user = getCurrentUser();
    if (!user) return;
    const canSeeCosts = ['admin', 'manager'].includes(user.role);
    document.querySelectorAll('.cost-column').forEach(el => {
        el.style.display = canSeeCosts ? '' : 'none';
    });
}

// ============================================================================
// Global Exports (for inline onclick handlers)
// ============================================================================

// Make all functions available globally for onclick handlers in HTML
window.switchTab = switchTab;
window.toggleSidebar = toggleSidebar;
window.toggleMobileSidebar = toggleMobileSidebar;
window.closeMobileSidebar = closeMobileSidebar;
window.showToast = showToast;
window.updateCostColumnVisibility = updateCostColumnVisibility;

// Auth functions
window.logout = logout;
window.getCurrentUser = getCurrentUser;
window.hasRole = hasRole;
window.hasAnyRole = hasAnyRole;
window.authenticatedFetch = authenticatedFetch;

// User menu dropdown functions
window.toggleUserMenu = function() {
    const dropdown = document.getElementById('user-dropdown');
    dropdown.classList.toggle('hidden');
};

window.closeUserMenu = function() {
    const dropdown = document.getElementById('user-dropdown');
    dropdown.classList.add('hidden');
};

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
    const container = document.getElementById('user-menu-container');
    if (container && !container.contains(e.target)) {
        window.closeUserMenu();
    }
});

// Inventory
window.switchInventorySubTab = switchInventorySubTab;
window.loadRawMaterialsInventory = loadRawMaterialsInventory;
window.syncRawMaterialsInventory = syncRawMaterialsInventory;
window.loadFinishedGoodsInventory = loadFinishedGoodsInventory;
window.syncFinishedGoodsInventory = syncFinishedGoodsInventory;
window.setRMInventoryFilter = setRMInventoryFilter;
window.searchRMInventory = searchRMInventory;
window.debouncedSearchRM = debouncedSearchRM;
window.setFGInventoryFilter = setFGInventoryFilter;
window.searchFGInventory = searchFGInventory;
window.debouncedSearchFG = debouncedSearchFG;
window.printRMInventory = printRMInventory;
window.printFGInventory = printFGInventory;
window.loadETInventory = loadETInventory;
window.syncETInventory = syncETInventory;
window.setETInventoryFilter = setETInventoryFilter;
window.searchETInventory = searchETInventory;
window.debouncedSearchET = debouncedSearchET;
window.printETInventory = printETInventory;

// Recipes
window.loadRecipeList = loadRecipeList;
window.setRecipeView = setRecipeView;
window.setRecipeFilter = setRecipeFilter;
window.debouncedRenderRecipeList = debouncedRenderRecipeList;
window.loadRecipeDetails = loadRecipeDetails;
window.updateItem = updateItem;
window.addItemRow = addItemRow;
window.removeItem = removeItem;
window.saveRecipe = saveRecipe;
window.saveRecipeAs = saveRecipeAs;
window.closeSaveModal = closeSaveModal;
window.confirmSave = confirmSave;
window.validateCurrentRecipe = validateCurrentRecipe;
window.exportPickingSheet = exportPickingSheet;
window.exportPickingSheetExcel = exportPickingSheetExcel;
window.createNewRecipe = createNewRecipe;
window.lookupItemCode = lookupItemCode;
window.saveNewRecipe = saveNewRecipe;
window.showRecipeItemDropdown = showRecipeItemDropdown;
window.filterRecipeDropdown = filterRecipeDropdown;
window.selectRecipeItem = selectRecipeItem;
window.hideAllRecipeDropdowns = hideAllRecipeDropdowns;
window.deleteRecipe = deleteRecipe;
window.markRecipeDirty = markRecipeDirty;
window.markRecipeClean = markRecipeClean;
window.editRecipeName = editRecipeName;
window.cancelRenameRecipe = cancelRenameRecipe;
window.confirmRenameRecipe = confirmRenameRecipe;

// Forecast
window.loadForecastProducts = loadForecastProducts;
window.renderForecastTable = renderForecastTable;
window.updateForecastQty = updateForecastQty;
window.clearAllForecastQty = clearAllForecastQty;
window.toggleForecastGroup = toggleForecastGroup;
window.filterForecastProducts = filterForecastProducts;
window.generateForecastPDF = generateForecastPDF;
window.getSelectedProducts = getSelectedProducts;
window.switchForecastSubTab = switchForecastSubTab;
window.loadPastForecastData = loadPastForecastData;
window.filterPastForecast = filterPastForecast;
window.generatePastForecastPDF = generatePastForecastPDF;

// Raw Material Orders
window.loadRMOrderPage = loadRMOrderPage;
window.switchRMOrderTab = switchRMOrderTab;
window.loadCriticalMaterials = loadCriticalMaterials;
window.refreshCriticalMaterials = refreshCriticalMaterials;
window.toggleSelectAllMaterials = toggleSelectAllMaterials;
window.toggleMaterialSelection = toggleMaterialSelection;
window.updateMaterialOrderQty = updateMaterialOrderQty;
window.createRequisition = createRequisition;
window.loadRMOrders = loadRMOrders;
window.viewRMOrderDetail = viewRMOrderDetail;
window.closeRMOrderDetail = closeRMOrderDetail;
window.approveRMOrder = approveRMOrder;
window.rejectRMOrder = rejectRMOrder;
window.downloadRMOrderPDF = downloadRMOrderPDF;
window.loadReceivableOrders = loadReceivableOrders;
window.openReceiveGoodsModal = openReceiveGoodsModal;
window.closeReceiveGoodsModal = closeReceiveGoodsModal;
window.confirmReceiveGoods = confirmReceiveGoods;
window.downloadGRNPDF = downloadGRNPDF;
window.loadRMDashboard = loadRMDashboard;
window.loadGRNDocuments = loadGRNDocuments;
window.filterGRNDocuments = filterGRNDocuments;
window.toggleGRNDetail = toggleGRNDetail;
window.updateRequisitionLineTotal = updateRequisitionLineTotal;
window.approveRMOrderFromDetail = approveRMOrderFromDetail;
window.loadSuppliers = loadSuppliers;
window.showAddSupplierModal = showAddSupplierModal;
window.closeAddSupplierModal = closeAddSupplierModal;
window.saveNewSupplier = saveNewSupplier;
window.editSupplier = editSupplier;
window.deleteSupplier = deleteSupplier;
window.loadCustomers = loadCustomers;
window.showAddRMCustomerModal = showAddRMCustomerModal;
window.closeAddCustomerModal = closeAddCustomerModal;
window.saveNewCustomer = saveNewCustomer;
window.editRMCustomer = editRMCustomer;
window.deleteCustomer = deleteCustomer;
window.deleteRMOrder = deleteRMOrder;
window.searchCriticalMaterials = searchCriticalMaterials;

// Calculator
window.loadCalculatorRecipes = loadCalculatorRecipes;
window.setUnit = setUnit;
window.calculateMaterials = calculateMaterials;
window.exportCalculationPDF = exportCalculationPDF;
window.exportCalculationPickingSheet = exportCalculationPickingSheet;

// PO Processing Wizard
window.loadJobOrderPage = loadJobOrderPage;
window.extractPOForEditing = extractPOForEditing;
window.addItemToJobOrder = addItemToJobOrder;
window.removeJOItem = removeJOItem;
window.editJOItem = editJOItem;
window.saveJOItem = saveJOItem;
window.cancelEditJOItem = cancelEditJOItem;
window.checkInventoryBeforeAction = checkInventoryBeforeAction;
window.updateProductionNeeded = updateProductionNeeded;
window.updateStockFromProduction = updateStockFromProduction;
window.renderEditItemDropdown = renderEditItemDropdown;
window.selectEditItem = selectEditItem;
window.hideInventoryCheck = hideInventoryCheck;
window.proceedWithExportOrSave = proceedWithExportOrSave;
window.exportJobOrderPDF = exportJobOrderPDF;
window.saveJobOrder = saveJobOrder;
window.clearJobOrderForm = clearJobOrderForm;
window.resetJOCounter = resetJOCounter;
window.saveNewCustomerFromPrompt = saveNewCustomerFromPrompt;
window.viewJobOrder = viewJobOrder;
window.deleteJobOrder = deleteJobOrder;
window.processJobOrder = processJobOrder;
window.switchJOSubTab = switchJOSubTab;
window.renderSavedJobOrders = renderSavedJobOrders;
window.editReservation = editReservation;
window.deleteReservation = deleteReservation;
window.downloadLinkedPDF = downloadLinkedPDF;
window.deleteDocumentLinkGroup = deleteDocumentLinkGroup;
window.wizardNext = wizardNext;
window.wizardBack = wizardBack;
window.wizardGoToStep = wizardGoToStep;
window.wizardSave = wizardSave;
window.clearWizard = clearWizard;
window.setOrderType = setOrderType;
window.editJOType = editJOType;
window.addPIItem = addPIItem;
window.removePIItem = removePIItem;
window.editPIItem = editPIItem;
window.savePIItemEdit = savePIItemEdit;
window.cancelPIItemEdit = cancelPIItemEdit;
window.togglePIPallet = togglePIPallet;
window.updatePalletQuantity = updatePalletQuantity;
window.bulkApplyPallet = bulkApplyPallet;
window.bulkClearPallets = bulkClearPallets;
window.onPIRecipeChange = onPIRecipeChange;
window.onJORecipeChange = onJORecipeChange;
window.switchPOTab = switchPOTab;
window.loadJOStatusPage = loadJOStatusPage;
window.setJOStatus = setJOStatus;
window.downloadPendingJOsPDF = downloadPendingJOsPDF;
window.loadDraftsList = loadDraftsList;
window.editDraft = editDraft;
window.downloadSummaryPDFByRef = downloadSummaryPDFByRef;
window.downloadJOSummaryPDF = downloadJOSummaryPDF;
window.downloadDraftMergedPDF = downloadDraftMergedPDF;
window.toggleDraftItems = toggleDraftItems;
window.savePendingReason = savePendingReason;

// Yield
window.loadProductionBatches = loadProductionBatches;
window.showPushToProductionModal = showPushToProductionModal;
window.updateBatchField = updateBatchField;
window.updateBatchActualQty = updateBatchActualQty;
window.deleteProductionBatch = deleteProductionBatch;
window.sendToSage = sendToSage;
window.yieldResetLinkThenSendToSage = yieldResetLinkThenSendToSage;
window.closeQtyReturnedModal = closeQtyReturnedModal;
window.confirmAndSendToSage = confirmAndSendToSage;
window.onQtyReturnedChange = onQtyReturnedChange;
window.onQtyAdditionalChange = onQtyAdditionalChange;
window.onQtyUsedChange = onQtyUsedChange;
window.downloadStockRequisitionPDF = downloadStockRequisitionPDF;
window.downloadBatchPDF = downloadBatchPDF;
window.downloadPickingSheetPDF = downloadPickingSheetPDF;
window.downloadBatchPickingSheet = downloadBatchPickingSheet;
window.closeIngredientBatchModal = closeIngredientBatchModal;
window.saveAndDownloadPickingSheet = saveAndDownloadPickingSheet;
window.saveIngredientBatchNumbers = saveIngredientBatchNumbers;
window.downloadIJBatchPDF = downloadIJBatchPDF;

// GRN
window.loadGRNData = loadGRNData;
window.loadAllGRNData = loadAllGRNData;
window.refreshGRNData = refreshGRNData;
window.changePage = changePage;
window.goToPage = goToPage;
window.filterByCategory = filterByCategory;
window.loadGLSalesData = loadGLSalesData;
window.debouncedFilterGRN = debouncedFilterGRN;
window.filterGRNTable = filterGRNTable;
window.exportGRNToCSV = exportGRNToCSV;
window.toggleSupplierSummary = toggleSupplierSummary;
window.showSupplierDetails = showSupplierDetails;
window.clearSupplierFilter = clearSupplierFilter;
window.backToSupplierSummary = backToSupplierSummary;

// Job Order (formerly Documents)
window.loadDocumentsPage = loadDocumentsPage;
window.loadDocumentsPreviousPage = loadDocumentsPreviousPage;
window.loadDocumentsNextPage = loadDocumentsNextPage;
window.filterDocuments = filterDocuments;
window.searchDocuments = searchDocuments;
window.downloadPDF = downloadPDF;
window.deletePDF = deletePDF;
window.pushToCalculator = pushToCalculator;
window.toggleGroup = toggleGroup;
window.downloadAllJOs = downloadAllJOs;
window.switchDocSubTab = switchDocSubTab;
window.completeJO = completeJO;
window.uncompleteJO = uncompleteJO;
window.filterProdType = filterProdType;
window.filterProdVolume = filterProdVolume;
window.filterProdRM = filterProdRM;
window.filterProdSearchInput = filterProdSearchInput;

// PO Processing Flow (PO -> Draft -> Allocation -> JO Allocation -> Status -> Docs)
window.processDraftToAllocation = processDraftToAllocation;
window.loadAllocationPending = loadAllocationPending;
window.onAllocationSearch = onAllocationSearch;
window.setAllocType = setAllocType;
window.setAllocVolume = setAllocVolume;
window.toggleAllocationActive = toggleAllocationActive;
window.toggleAllocationGroupActive = toggleAllocationGroupActive;
window.setAllocationPriority = setAllocationPriority;
window.updateAllocationFromStock = updateAllocationFromStock;
window.updateAllocationToProduce = updateAllocationToProduce;
window.createJobOrderFromAllocation = createJobOrderFromAllocation;
window.switchAllocSubTab = switchAllocSubTab;
window.returnJOToAllocation = returnJOToAllocation;
window.returnJOItemToAllocation = returnJOItemToAllocation;
window.onStatusActiveToggle = onStatusActiveToggle;
window.loadPOStatus = loadPOStatus;
window.onPOStatusSearch = onPOStatusSearch;
window.setPOStatusCustomer = setPOStatusCustomer;
window.setPOStatusType = setPOStatusType;
window.setPOStatusVolume = setPOStatusVolume;

// Admin
window.loadUsers = loadUsers;
window.showCreateUserModal = showCreateUserModal;
window.closeUserModal = closeUserModal;
window.editUser = editUser;
window.resetUserPassword = resetUserPassword;
window.deleteUser = deleteUser;
window.loadUntypedJOs = loadUntypedJOs;
window.setUntypedJOLocal = setUntypedJOLocal;
window.setUntypedJOExport = setUntypedJOExport;

// Sage Drafts Approval
window.loadSageDrafts = loadSageDrafts;
window.refreshSageDrafts = refreshSageDrafts;
window.loadSagePostedHistory = loadSagePostedHistory;
window.switchSageTab = switchSageTab;
window.viewSageDraftDetails = viewSageDraftDetails;
window.closeSageDraftModal = closeSageDraftModal;
window.approveSageDraft = approveSageDraft;
window.rejectSageDraft = rejectSageDraft;
window.onSageHistoryMismatchedToggle = onSageHistoryMismatchedToggle;
window.adminResetLinkThenRem = adminResetLinkThenRem;

// Accounting Drafts Approval
window.loadAcctDrafts = loadAcctDrafts;
window.viewAcctDraftDetails = viewAcctDraftDetails;
window.closeAcctDraftModal = closeAcctDraftModal;
window.approveAcctDraft = approveAcctDraft;
window.rejectAcctDraft = rejectAcctDraft;

// Quotations
window.loadQuotationsPage = loadQuotationsPage;
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

// Dashboard
window.loadDashboardStats = loadDashboardStats;

// Analytics
window.loadAnalytics = loadAnalytics;
window.updateAnalyticsDateRange = updateAnalyticsDateRange;
window.filterAnalyticsByCategory = filterAnalyticsByCategory;

// Production Reports
window.loadProductionControlPage = loadProductionControlPage;
window.switchProductionControlSubTab = switchProductionControlSubTab;
window.togglePackagingType = togglePackagingType;
window.addDownTimeEntry = addDownTimeEntry;
window.removeDownTimeEntry = removeDownTimeEntry;
window.updateDownTimeEntry = updateDownTimeEntry;
window.submitReport = submitReport;
window.saveReportDraft = saveReportDraft;
window.downloadReportPdf = downloadReportPdf;
window.deleteProductionReport = deleteProductionReport;
window.addDownTimeEntryAfter = addDownTimeEntryAfter;
window.addPalletMixRow = addPalletMixRow;
window.removePalletMixRow = removePalletMixRow;
window.downloadCompletedReportPdf = downloadCompletedReportPdf;
window.downloadCompletedDayReportById = downloadCompletedDayReportById;
window.downloadCombinedReportPdf = downloadCombinedReportPdf;
window.showMaterialsUsedById = showMaterialsUsedById;
window.editReportById = editReportById;
window.resetPendingReport = resetPendingReport;

// Reporting
window.loadReportingPage = loadReportingPage;
window.switchReportingSubMenu = switchReportingSubMenu;
window.applyReportingFilters = applyReportingFilters;
window.clearReportingFilters = clearReportingFilters;

// Sage Entries
window.loadSageEntriesPage = loadSageEntriesPage;
window.loadSageEntryDrafts = loadSageEntryDrafts;
window.setEntryType = setEntryType;
window.addLineItem = addLineItem;
window.removeLineItem = removeLineItem;
window.submitSageEntry = submitSageEntry;
window.clearEntryForm = clearEntryForm;
window.viewSageEntry = viewSageEntry;
window.editSageEntry = editSageEntry;
window.approveSageEntry = approveSageEntry;
window.deleteSageEntry = deleteSageEntry;
window.closeSageEntryModal = closeSageEntryModal;
window.filterSageDrafts = filterSageDrafts;
window.searchSageDrafts = searchSageDrafts;
window.updateEditLineQty = updateEditLineQty;
window.removeEditLine = removeEditLine;
window.addEditLineItem = addEditLineItem;
window.closeAddEditLineModal = closeAddEditLineModal;
window.confirmAddEditLine = confirmAddEditLine;
window.closeSageEditModal = closeSageEditModal;
window.saveSageEntryEdits = saveSageEntryEdits;
window.showItemDropdown = showItemDropdown;
window.filterItemDropdown = filterItemDropdown;
window.selectSageItem = selectSageItem;

// Accounting
window.loadAccountingPage = loadAccountingPage;
window.switchAccountingSubTab = switchAccountingSubTab;

// FTA & Customs
window.loadCustomsPage = loadCustomsPage;
window.switchCustomsSubTab = switchCustomsSubTab;

// Utilities
window.formatDate = formatDate;
window.formatNumber = formatNumber;
window.formatFileSize = formatFileSize;
window.truncateText = truncateText;
window.debounce = debounce;
window.throttle = throttle;
