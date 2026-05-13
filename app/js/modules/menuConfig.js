/**
 * Menu configuration - single source of truth for sidebar menu keys,
 * labels, role defaults, and per-user access evaluation.
 */

export const USE_ROLE_DEFAULTS_SENTINEL = '__USE_ROLE_DEFAULTS__';

export const MENU_SECTIONS = [
    {
        section: 'Overview',
        items: [
            { key: 'home', label: 'Home' },
        ],
    },
    {
        section: 'Inventory & Stock',
        items: [
            { key: 'inventory', label: 'Inventory' },
            { key: 'grn', label: 'Inventory Transactions' },
            { key: 'dispatch', label: 'Dispatch' },
            { key: 'analytics', label: 'Analytics' },
            { key: 'yield', label: 'Sage Batch Draft' },
        ],
    },
    {
        section: 'Production',
        items: [
            { key: 'recipes', label: 'Recipe Validation' },
            { key: 'forecast', label: 'Forecast' },
            { key: 'calculator', label: 'Calculator' },
            { key: 'poprocessing', label: 'PO Processing' },
            { key: 'joborders', label: 'Job Order' },
            { key: 'production-reports', label: 'Production Reports' },
            { key: 'mixing-section', label: 'Mixing Section' },
            { key: 'mixing-utilities', label: 'Mixing Utilities' },
        ],
    },
    {
        section: 'Finance',
        items: [
            { key: 'rmorder', label: 'Raw Material Orders' },
            { key: 'quotations', label: 'Quotations' },
            { key: 'sage-entries', label: 'Sage Entries' },
            { key: 'accounting', label: 'Accounting' },
            { key: 'customs', label: 'FTA & Customs' },
        ],
    },
    {
        section: 'Quality',
        items: [
            { key: 'qc', label: 'QC' },
            { key: 'reporting', label: 'Reporting' },
        ],
    },
    {
        section: 'Sugar Dissolver',
        items: [
            { key: 'sugar-dissolver', label: 'Sugar Dissolver' },
        ],
    },
];

export const ALL_MENU_KEYS = MENU_SECTIONS.flatMap(s => s.items.map(i => i.key));

const QC_DEFAULTS = ['home', 'recipes', 'calculator', 'production-reports', 'reporting', 'qc', 'mixing-section', 'joborders', 'sugar-dissolver'];
const MIXING_DEFAULTS = ['home', 'mixing-section', 'mixing-utilities', 'sugar-dissolver'];

export function getRoleDefaultMenus(role) {
    if (role === 'admin') return ALL_MENU_KEYS.slice();
    if (role === 'quality_control') return QC_DEFAULTS.slice();
    if (role === 'mixing_area') return MIXING_DEFAULTS.slice();
    return ALL_MENU_KEYS.slice();
}

/**
 * Returns an array of menu keys the user is allowed to see.
 * Returns null for admin (unrestricted).
 */
export function getEffectiveAllowedMenus(user) {
    if (!user) return [];
    if (user.role === 'admin') return null;
    if (Array.isArray(user.allowed_menus)) return user.allowed_menus;
    return getRoleDefaultMenus(user.role);
}

/**
 * True if the user can access the given tab key.
 * - home is always allowed
 * - admin panel only allowed for admin role
 * - otherwise, check against effective allowed list
 */
export function isMenuAllowed(user, tab) {
    if (!user) return false;
    if (tab === 'home') return true;
    if (tab === 'admin') return user.role === 'admin';
    if (user.role === 'admin') return true;
    const allowed = getEffectiveAllowedMenus(user);
    if (allowed === null) return true;
    return allowed.includes(tab);
}
