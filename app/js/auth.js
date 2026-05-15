/**
 * Authentication utilities for JWT token management
 */

const AUTH_TOKEN_KEY = 'demoplant_auth_token';
const AUTH_USER_KEY = 'demoplant_current_user';

/**
 * Store authentication token in localStorage
 * @param {string} token - JWT token
 */
export function setToken(token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/**
 * Get authentication token from localStorage
 * @returns {string|null} JWT token or null if not found
 */
export function getToken() {
    return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Remove authentication token from localStorage
 */
export function removeToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
}

/**
 * Store current user information
 * @param {Object} user - User object
 */
export function setCurrentUser(user) {
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

/**
 * Get current user information
 * @returns {Object|null} User object or null if not found
 */
export function getCurrentUser() {
    const userStr = localStorage.getItem(AUTH_USER_KEY);
    if (!userStr) return null;
    
    try {
        return JSON.parse(userStr);
    } catch (e) {
        console.error('Failed to parse user data:', e);
        return null;
    }
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated, false otherwise
 */
export function isAuthenticated() {
    const token = getToken();
    const user = getCurrentUser();
    return !!(token && user);
}

/**
 * Check if current user has a specific role
 * @param {string} role - Role to check (admin, manager, employee, viewer)
 * @returns {boolean} True if user has the role
 */
export function hasRole(role) {
    const user = getCurrentUser();
    if (!user) return false;
    // Demo bypasses every role check so all action buttons are clickable.
    // Any actual write is intercepted server-side by DemoModeMiddleware.
    if (user.role === 'demo') return true;
    return user.role === role;
}

/**
 * Check if current user has one of the specified roles
 * @param {Array<string>} roles - Array of roles to check
 * @returns {boolean} True if user has any of the roles
 */
export function hasAnyRole(roles) {
    const user = getCurrentUser();
    if (!user) return false;
    // See hasRole - demo passes every role check; writes are blocked server-side.
    if (user.role === 'demo') return true;
    return roles.includes(user.role);
}

/**
 * True if the current user is the demo presentation account.
 * Demo users see no costs and any write action returns a fake-success toast.
 */
export function isDemo() {
    const user = getCurrentUser();
    return !!(user && user.role === 'demo');
}

/**
 * Login user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} User object if successful
 * @throws {Error} If login fails
 */
export async function login(email, password) {
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Login failed');
        }
        
        const data = await response.json();
        
        // Store token and user info
        setToken(data.access_token);
        setCurrentUser(data.user);
        
        return data.user;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

/**
 * Logout user and clear stored data
 */
export function logout() {
    removeToken();
    window.location.href = '/login';
}

/**
 * Make authenticated API request
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>} Fetch response
 */
export async function authenticatedFetch(url, options = {}) {
    const token = getToken();
    
    if (!token) {
        logout();
        throw new Error('Not authenticated');
    }
    
    // Add authorization header
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };
    
    const response = await fetch(url, {
        ...options,
        headers
    });
    
    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
        console.warn('Authentication failed, logging out...');
        logout();
        throw new Error('Session expired. Please login again.');
    }
    
    return response;
}

/**
 * Get current user info from API
 * @returns {Promise<Object>} User object
 */
export async function fetchCurrentUser() {
    try {
        const response = await authenticatedFetch('/api/auth/me');
        
        if (!response.ok) {
            throw new Error('Failed to fetch user info');
        }
        
        const user = await response.json();
        setCurrentUser(user);
        return user;
    } catch (error) {
        console.error('Error fetching current user:', error);
        throw error;
    }
}

/**
 * Check authentication status and redirect to login if not authenticated
 * Call this on page load for protected pages
 */
export function requireAuth() {
    if (!isAuthenticated()) {
        const currentPath = window.location.pathname;
        if (currentPath !== '/login') {
            window.location.href = '/login';
        }
        return false;
    }
    return true;
}

/**
 * Initialize authentication on page load
 * Checks if user is authenticated and fetches fresh user data
 */
export async function initAuth() {
    const currentPath = window.location.pathname;
    
    // Skip auth check on login page
    if (currentPath === '/login') {
        return;
    }
    
    // Check if authenticated
    if (!isAuthenticated()) {
        window.location.href = '/login';
        return;
    }
    
    // Fetch fresh user data to ensure token is still valid
    try {
        await fetchCurrentUser();
    } catch (error) {
        console.error('Auth initialization failed:', error);
        logout();
    }
}

/**
 * Update user display in UI
 */
export function updateUserDisplay() {
    const user = getCurrentUser();
    if (!user) return;

    // Toggle body.demo-mode for global CSS hide rules.
    if (user.role === 'demo') {
        document.body.classList.add('demo-mode');
        mountDemoBanner();
    } else {
        document.body.classList.remove('demo-mode');
        unmountDemoBanner();
    }

    // Update user name display
    const userNameEl = document.getElementById('user-name-display');
    if (userNameEl) {
        userNameEl.textContent = user.full_name || user.username;
    }

    // Update user role badge (pill style)
    const userRoleEl = document.getElementById('user-role-display');
    if (userRoleEl) {
        userRoleEl.textContent = user.role.toUpperCase();
        userRoleEl.className = `text-xs px-2 py-0.5 rounded-full font-medium ${getRoleBadgeClass(user.role)}`;
    }
    
    // Show/hide admin dropdown item (admin panel only accessible via dropdown)
    const isAdmin = user.role === 'admin';
    const dropdownAdmin = document.getElementById('dropdown-admin');
    const adminDivider = document.querySelector('.admin-divider');
    
    if (dropdownAdmin) {
        dropdownAdmin.classList.toggle('hidden', !isAdmin);
        dropdownAdmin.style.display = isAdmin ? 'flex' : 'none';
    }
    if (adminDivider) {
        adminDivider.classList.toggle('hidden', !isAdmin);
    }
}

const DEMO_BANNER_ID = 'Demo Plant-demo-banner';

function mountDemoBanner() {
    if (document.getElementById(DEMO_BANNER_ID)) return;
    const banner = document.createElement('div');
    banner.id = DEMO_BANNER_ID;
    banner.textContent = 'DEMO MODE - All actions are simulated. No data is saved. Costs are hidden.';
    banner.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:9999',
        'background:#f59e0b', 'color:#1f2937',
        'padding:6px 16px', 'font-weight:600', 'font-size:13px',
        'text-align:center', 'box-shadow:0 1px 3px rgba(0,0,0,0.2)',
        'letter-spacing:0.02em',
    ].join(';');
    document.body.appendChild(banner);
    document.body.style.paddingTop = '32px';
}

function unmountDemoBanner() {
    const existing = document.getElementById(DEMO_BANNER_ID);
    if (existing) existing.remove();
    document.body.style.paddingTop = '';
}

/**
 * Get CSS class for role badge
 * @param {string} role - User role
 * @returns {string} CSS class
 */
function getRoleBadgeClass(role) {
    switch (role) {
        case 'admin':
            return 'bg-slate-900 text-white';
        case 'manager':
            return 'bg-blue-600 text-white';
        case 'employee':
            return 'bg-emerald-600 text-white';
        case 'viewer':
            return 'bg-slate-500 text-white';
        case 'demo':
            return 'bg-amber-500 text-white';
        default:
            return 'bg-slate-500 text-white';
    }
}

