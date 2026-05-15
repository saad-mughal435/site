/**
 * Admin Panel Module - User Management & Sage Drafts Approval
 */

import { authenticatedFetch, getCurrentUser } from '../auth.js?v=20260428b';
import { showToast, formatDate } from '../utils.js?v=20260125h';
import { MENU_SECTIONS, ALL_MENU_KEYS, USE_ROLE_DEFAULTS_SENTINEL, getRoleDefaultMenus } from './menuConfig.js?v=20260504sdcip03';

let currentUsers = [];
let currentSageDrafts = [];
let currentSageHistory = [];
let sageHistoryIncludeMismatched = false;

/**
 * Load and render the "Untyped Job Orders" admin panel - every JO whose
 * local_export_type is still null (legacy data). Each row has Local/Export
 * buttons that PATCH the JO via window.editJOType.
 */
export async function loadUntypedJOs() {
    const tbody = document.getElementById('untyped-jos-body');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-slate-500">Loading…</td></tr>`;
    try {
        const resp = await authenticatedFetch('/api/job-orders/untyped');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const jos = await resp.json();
        if (!Array.isArray(jos) || jos.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-emerald-600">All job orders are flagged - nothing to triage.</td></tr>`;
            return;
        }
        tbody.innerHTML = jos.map(jo => {
            const ref = (jo.summary_ref || '').replace(/"/g, '&quot;');
            const date = jo.jo_date ? String(jo.jo_date).slice(0, 10) : '-';
            const customer = (jo.customer_name || '-').replace(/</g, '&lt;');
            const status = (jo.status || '-').replace(/</g, '&lt;');
            return `<tr>
                <td class="px-4 py-2 text-sm font-mono">${ref}</td>
                <td class="px-4 py-2 text-sm">${date}</td>
                <td class="px-4 py-2 text-sm">${customer}</td>
                <td class="px-4 py-2 text-sm">${status}</td>
                <td class="px-4 py-2 text-center">
                    <button onclick="setUntypedJOLocal('${ref}')" class="px-3 py-1 text-xs font-bold rounded bg-amber-100 text-amber-800 border border-amber-200 hover:bg-amber-200 mr-1">LOCAL</button>
                    <button onclick="setUntypedJOExport('${ref}')" class="px-3 py-1 text-xs font-bold rounded bg-blue-100 text-blue-700 border border-blue-200 hover:bg-blue-200">EXPORT</button>
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        console.error('loadUntypedJOs failed:', e);
        tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-8 text-center text-red-500">Error loading: ${e.message}</td></tr>`;
    }
}

async function _setUntypedJOType(summaryRef, value) {
    if (!summaryRef || (value !== 'local' && value !== 'export')) return;
    try {
        const resp = await authenticatedFetch(`/api/job-orders/${encodeURIComponent(summaryRef)}/type`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ local_export_type: value }),
        });
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.detail || `HTTP ${resp.status}`);
        }
        const data = await resp.json();
        showToast(`${summaryRef} → ${value.toUpperCase()} (${data.reservations_updated || 0} reservations updated)`, 'success');
        await loadUntypedJOs();
    } catch (e) {
        console.error('setUntypedJOType failed', e);
        showToast(`Failed: ${e.message}`, 'error');
    }
}

export function setUntypedJOLocal(summaryRef) { return _setUntypedJOType(summaryRef, 'local'); }
export function setUntypedJOExport(summaryRef) { return _setUntypedJOType(summaryRef, 'export'); }

/**
 * Load and display all users
 */
export async function loadUsers() {
    try {
        const response = await authenticatedFetch('/api/auth/users');
        
        if (!response.ok) {
            throw new Error('Failed to load users');
        }
        
        currentUsers = await response.json();
        renderUsersTable();
        
    } catch (error) {
        console.error('Error loading users:', error);
        showToast('Failed to load users', 'error');
    }
}

/**
 * Render users table
 */
function renderUsersTable() {
    const tbody = document.getElementById('users-table-body');
    
    if (!tbody) return;
    
    if (currentUsers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-8 text-center text-slate-500">
                    No users found
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = currentUsers.map(user => `
        <tr class="hover:bg-slate-50">
            <td class="px-4 py-3 text-sm font-medium text-slate-900">${user.full_name}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${user.email}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${user.username}</td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 text-xs font-semibold rounded ${getRoleBadgeClass(user.role)}">
                    ${formatRoleDisplay(user.role)}
                </span>
            </td>
            <td class="px-4 py-3">
                <span class="px-2 py-1 text-xs font-semibold rounded ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                    ${user.is_active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td class="px-4 py-3 text-sm text-slate-600">${formatDate(user.created_at)}</td>
            <td class="px-4 py-3">
                <div class="flex gap-2">
                    <button 
                        onclick="editUser('${user._id}')" 
                        class="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition"
                        title="Edit User"
                    >
                        Edit
                    </button>
                    <button 
                        onclick="resetUserPassword('${user._id}')" 
                        class="px-3 py-1 text-xs bg-yellow-600 hover:bg-yellow-700 text-white rounded transition"
                        title="Reset Password"
                    >
                        Reset PW
                    </button>
                    <button 
                        onclick="deleteUser('${user._id}')" 
                        class="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition"
                        title="Delete User"
                    >
                        Delete
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * Get CSS class for role badge
 */
function getRoleBadgeClass(role) {
    switch (role) {
        case 'admin':
            return 'bg-red-100 text-red-800';
        case 'manager':
            return 'bg-blue-100 text-blue-800';
        case 'employee':
            return 'bg-green-100 text-green-800';
        case 'quality_control':
            return 'bg-purple-100 text-purple-800';
        case 'mixing_area':
            return 'bg-teal-100 text-teal-800';
        case 'viewer':
            return 'bg-gray-100 text-gray-800';
        default:
            return 'bg-gray-100 text-gray-800';
    }
}

function formatRoleDisplay(role) {
    if (role === 'quality_control') return 'QUALITY CONTROL';
    if (role === 'mixing_area') return 'MIXING AREA';
    return role.toUpperCase();
}

/**
 * Render the Menu Access checkbox block.
 * @param {string[]|null} selectedKeys - keys to pre-check; null means "use role defaults"
 * @param {boolean} showResetToggle - show the "Use role defaults" checkbox (edit mode)
 */
function renderMenuAccessBlock(selectedKeys, showResetToggle) {
    const useDefaults = showResetToggle && selectedKeys === null;
    const effectiveSelected = Array.isArray(selectedKeys) ? selectedKeys : ALL_MENU_KEYS;
    const disabledAttr = useDefaults ? 'disabled' : '';

    const sectionsHtml = MENU_SECTIONS.map(section => {
        const itemsHtml = section.items.map(item => {
            const checked = effectiveSelected.includes(item.key) ? 'checked' : '';
            return `
                <label class="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" class="menu-access-checkbox rounded" data-menu-key="${item.key}" ${checked} ${disabledAttr}>
                    <span>${item.label}</span>
                </label>
            `;
        }).join('');
        return `
            <div class="border border-gray-200 rounded p-3">
                <div class="flex items-center justify-between mb-2">
                    <div class="text-xs font-semibold text-gray-500 uppercase tracking-wide">${section.section}</div>
                    <button type="button" class="menu-section-toggle text-xs text-blue-600 hover:underline" data-section="${section.section}">Toggle</button>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    ${itemsHtml}
                </div>
            </div>
        `;
    }).join('');

    const resetToggleHtml = showResetToggle ? `
        <label class="flex items-center gap-2 mb-3">
            <input type="checkbox" id="menu-access-use-defaults" ${useDefaults ? 'checked' : ''} class="rounded">
            <span class="text-sm font-medium text-gray-700">Use role defaults (clear custom menu access)</span>
        </label>
    ` : '';

    return `
        <div id="menu-access-block">
            <label class="block text-sm font-medium text-gray-700 mb-2">Menu Access</label>
            ${resetToggleHtml}
            <div class="flex gap-2 mb-3">
                <button type="button" id="menu-access-select-all" class="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded">Select All</button>
                <button type="button" id="menu-access-clear-all" class="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded">Clear All</button>
            </div>
            <div class="space-y-2 max-h-80 overflow-y-auto pr-1">
                ${sectionsHtml}
            </div>
        </div>
    `;
}

/**
 * Wire up Menu Access block interactivity: select-all / clear / section-toggle / use-defaults.
 * Also hides the block when role === admin.
 */
function wireMenuAccessBlock(roleSelectId) {
    const block = document.getElementById('menu-access-block');
    const roleSelect = document.getElementById(roleSelectId);
    if (!block || !roleSelect) return;

    const getCheckboxes = () => block.querySelectorAll('.menu-access-checkbox');
    const useDefaultsCheckbox = document.getElementById('menu-access-use-defaults');

    const syncDisabled = () => {
        const disabled = useDefaultsCheckbox && useDefaultsCheckbox.checked;
        getCheckboxes().forEach(cb => { cb.disabled = disabled; });
    };

    const syncBlockVisibility = () => {
        block.style.display = roleSelect.value === 'admin' ? 'none' : '';
    };

    syncBlockVisibility();
    syncDisabled();

    roleSelect.addEventListener('change', syncBlockVisibility);

    if (useDefaultsCheckbox) {
        useDefaultsCheckbox.addEventListener('change', () => {
            if (useDefaultsCheckbox.checked) {
                const defaults = getRoleDefaultMenus(roleSelect.value);
                getCheckboxes().forEach(cb => {
                    cb.checked = defaults.includes(cb.dataset.menuKey);
                });
            }
            syncDisabled();
        });
    }

    const selectAllBtn = document.getElementById('menu-access-select-all');
    const clearAllBtn = document.getElementById('menu-access-clear-all');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            if (useDefaultsCheckbox) useDefaultsCheckbox.checked = false;
            getCheckboxes().forEach(cb => { cb.checked = true; });
            syncDisabled();
        });
    }
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', () => {
            if (useDefaultsCheckbox) useDefaultsCheckbox.checked = false;
            getCheckboxes().forEach(cb => { cb.checked = false; });
            syncDisabled();
        });
    }

    block.querySelectorAll('.menu-section-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            if (useDefaultsCheckbox) useDefaultsCheckbox.checked = false;
            const parent = btn.closest('.border');
            const checkboxes = parent.querySelectorAll('.menu-access-checkbox');
            const anyUnchecked = Array.from(checkboxes).some(cb => !cb.checked);
            checkboxes.forEach(cb => { cb.checked = anyUnchecked; });
            syncDisabled();
        });
    });
}

/**
 * Read the current Menu Access selection from the DOM.
 * @returns {{ useDefaults: boolean, keys: string[] }}
 */
function readMenuAccessSelection() {
    const useDefaultsCheckbox = document.getElementById('menu-access-use-defaults');
    if (useDefaultsCheckbox && useDefaultsCheckbox.checked) {
        return { useDefaults: true, keys: [] };
    }
    const block = document.getElementById('menu-access-block');
    if (!block) return { useDefaults: false, keys: ALL_MENU_KEYS.slice() };
    const keys = Array.from(block.querySelectorAll('.menu-access-checkbox'))
        .filter(cb => cb.checked)
        .map(cb => cb.dataset.menuKey);
    return { useDefaults: false, keys };
}

/**
 * Show create user modal
 */
export function showCreateUserModal() {
    const menuAccessHtml = renderMenuAccessBlock(null, false);
    const modal = `
        <div id="user-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                <h3 class="text-xl font-bold mb-4">Create New User</h3>

                <form id="create-user-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input type="text" id="user-full-name" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" id="user-email" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <input type="text" id="user-username" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <input type="password" id="user-password" required minlength="8" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        <p class="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select id="user-role" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                            <option value="viewer">Viewer</option>
                            <option value="employee">Employee</option>
                            <option value="quality_control">Quality Control</option>
                            <option value="mixing_area">Mixing Area</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>

                    ${menuAccessHtml}

                    <div class="flex gap-3 mt-6">
                        <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                            Create User
                        </button>
                        <button type="button" onclick="closeUserModal()" class="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);

    wireMenuAccessBlock('user-role');

    // Add form submit handler
    document.getElementById('create-user-form').addEventListener('submit', handleCreateUser);
}

/**
 * Handle create user form submission
 */
async function handleCreateUser(e) {
    e.preventDefault();

    const role = document.getElementById('user-role').value;
    const userData = {
        full_name: document.getElementById('user-full-name').value,
        email: document.getElementById('user-email').value,
        username: document.getElementById('user-username').value,
        password: document.getElementById('user-password').value,
        role: role,
        is_active: true
    };

    if (role !== 'admin') {
        const { keys } = readMenuAccessSelection();
        userData.allowed_menus = keys;
    }
    
    try {
        const response = await authenticatedFetch('/api/auth/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to create user');
        }
        
        showToast('User created successfully', 'success');
        closeUserModal();
        loadUsers();
        
    } catch (error) {
        console.error('Error creating user:', error);
        showToast(error.message, 'error');
    }
}

/**
 * Close user modal
 */
export function closeUserModal() {
    const modal = document.getElementById('user-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Edit user
 */
export async function editUser(userId) {
    const user = currentUsers.find(u => u._id === userId);
    if (!user) return;

    const selected = Array.isArray(user.allowed_menus) ? user.allowed_menus : null;
    const menuAccessHtml = renderMenuAccessBlock(selected, true);

    const modal = `
        <div id="user-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                <h3 class="text-xl font-bold mb-4">Edit User</h3>

                <form id="edit-user-form" class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <input type="text" id="edit-full-name" value="${user.full_name}" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input type="email" id="edit-email" value="${user.email}" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <input type="text" id="edit-username" value="${user.username}" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                    </div>

                    <div>
                        <label class="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <select id="edit-role" required class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                            <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                            <option value="employee" ${user.role === 'employee' ? 'selected' : ''}>Employee</option>
                            <option value="quality_control" ${user.role === 'quality_control' ? 'selected' : ''}>Quality Control</option>
                            <option value="mixing_area" ${user.role === 'mixing_area' ? 'selected' : ''}>Mixing Area</option>
                            <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Manager</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </div>

                    <div>
                        <label class="flex items-center gap-2">
                            <input type="checkbox" id="edit-is-active" ${user.is_active ? 'checked' : ''} class="rounded">
                            <span class="text-sm font-medium text-gray-700">Active</span>
                        </label>
                    </div>

                    ${menuAccessHtml}

                    <div class="flex gap-3 mt-6">
                        <button type="submit" class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition">
                            Update User
                        </button>
                        <button type="button" onclick="closeUserModal()" class="flex-1 px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-lg transition">
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modal);

    wireMenuAccessBlock('edit-role');

    // Add form submit handler
    document.getElementById('edit-user-form').addEventListener('submit', (e) => handleEditUser(e, userId));
}

/**
 * Handle edit user form submission
 */
async function handleEditUser(e, userId) {
    e.preventDefault();

    const role = document.getElementById('edit-role').value;
    const userData = {
        full_name: document.getElementById('edit-full-name').value,
        email: document.getElementById('edit-email').value,
        username: document.getElementById('edit-username').value,
        role: role,
        is_active: document.getElementById('edit-is-active').checked
    };

    if (role !== 'admin') {
        const { useDefaults, keys } = readMenuAccessSelection();
        userData.allowed_menus = useDefaults ? [USE_ROLE_DEFAULTS_SENTINEL] : keys;
    }
    
    try {
        const response = await authenticatedFetch(`/api/auth/users/${userId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            const detail = error.detail;
            const msg = typeof detail === 'string'
                ? detail
                : Array.isArray(detail)
                    ? detail.map(d => d.msg || JSON.stringify(d)).join('; ')
                    : (detail ? JSON.stringify(detail) : 'Failed to update user');
            throw new Error(msg);
        }

        showToast('User updated successfully', 'success');
        closeUserModal();
        loadUsers();

    } catch (error) {
        console.error('Error updating user:', error);
        showToast(error.message || String(error), 'error');
    }
}

/**
 * Reset user password
 */
export async function resetUserPassword(userId) {
    const newPassword = prompt('Enter new password (minimum 8 characters):');
    
    if (!newPassword || newPassword.length < 8) {
        showToast('Password must be at least 8 characters', 'error');
        return;
    }
    
    try {
        const response = await authenticatedFetch(`/api/auth/users/${userId}/reset-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_password: newPassword })
        });
        
        if (!response.ok) {
            throw new Error('Failed to reset password');
        }
        
        showToast('Password reset successfully', 'success');
        
    } catch (error) {
        console.error('Error resetting password:', error);
        showToast('Failed to reset password', 'error');
    }
}

/**
 * Delete user
 */
export async function deleteUser(userId) {
    const user = currentUsers.find(u => u._id === userId);
    if (!user) return;
    
    if (!confirm(`Are you sure you want to delete user "${user.full_name}"? This action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await authenticatedFetch(`/api/auth/users/${userId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to delete user');
        }
        
        showToast('User deleted successfully', 'success');
        loadUsers();
        
    } catch (error) {
        console.error('Error deleting user:', error);
        showToast(error.message, 'error');
    }
}


// =============================================================================
// SAGE DRAFTS APPROVAL FUNCTIONS
// =============================================================================

/**
 * Switch between Sage tabs
 */
export function switchSageTab(tab) {
    const pendingTab = document.getElementById('sage-pending-tab');
    const historyTab = document.getElementById('sage-history-tab');
    const pendingBtn = document.getElementById('sage-tab-pending');
    const historyBtn = document.getElementById('sage-tab-history');
    
    if (tab === 'pending') {
        pendingTab.classList.remove('hidden');
        historyTab.classList.add('hidden');
        pendingBtn.classList.add('text-emerald-600', 'border-b-2', 'border-emerald-600', '-mb-px');
        pendingBtn.classList.remove('text-slate-500');
        historyBtn.classList.remove('text-emerald-600', 'border-b-2', 'border-emerald-600', '-mb-px');
        historyBtn.classList.add('text-slate-500');
        loadSageDrafts();
    } else {
        pendingTab.classList.add('hidden');
        historyTab.classList.remove('hidden');
        historyBtn.classList.add('text-emerald-600', 'border-b-2', 'border-emerald-600', '-mb-px');
        historyBtn.classList.remove('text-slate-500');
        pendingBtn.classList.remove('text-emerald-600', 'border-b-2', 'border-emerald-600', '-mb-px');
        pendingBtn.classList.add('text-slate-500');
        loadSagePostedHistory();
    }
}

/**
 * Poll Sage for newly-posted batches, then reload the drafts list
 */
export async function refreshSageDrafts() {
    const btn = document.getElementById('refresh-sage-drafts-btn');
    const btnLabel = btn ? btn.querySelector('span') : null;
    if (btn) btn.disabled = true;
    if (btnLabel) btnLabel.textContent = 'Checking Sage...';

    try {
        const res = await authenticatedFetch('/api/sage/poll', { method: 'POST' });
        if (res.ok) {
            const data = await res.json();
            const n = data.updated ?? 0;
            showToast(n > 0 ? `${n} draft(s) marked as posted in Sage` : 'All drafts up to date', 'success');
        } else {
            showToast('Could not reach Sage - draft list may be stale', 'warning');
        }
    } catch (e) {
        showToast('Sage connection unavailable - draft list may be stale', 'warning');
    } finally {
        if (btn) btn.disabled = false;
        if (btnLabel) btnLabel.textContent = 'Refresh';
    }

    await loadSageDrafts();
}

/**
 * Load pending Sage drafts
 */
export async function loadSageDrafts() {
    try {
        const response = await authenticatedFetch('/api/sage/drafts');
        
        if (!response.ok) {
            throw new Error('Failed to load Sage drafts');
        }
        
        const data = await response.json();
        currentSageDrafts = data.drafts || [];
        
        // Update badge count
        const badge = document.getElementById('pending-count-badge');
        if (badge) {
            badge.textContent = currentSageDrafts.length;
        }
        
        renderSageDraftsTable();
        
    } catch (error) {
        console.error('Error loading Sage drafts:', error);
        showToast('Failed to load Sage drafts', 'error');
    }
}

/**
 * Render Sage drafts table (handles both production batch and RM Order GRN drafts)
 */
function renderSageDraftsTable() {
    const tbody = document.getElementById('sage-drafts-table-body');
    
    if (!tbody) return;
    
    if (currentSageDrafts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="px-4 py-8 text-center text-slate-500">
                    <div class="flex flex-col items-center">
                        <svg class="w-12 h-12 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p class="font-medium">No pending drafts</p>
                        <p class="text-sm">All batches have been processed</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = currentSageDrafts.map(draft => {
        const isRM = draft.draft_source === 'rm_order';
        const typeBadge = isRM
            ? '<span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">RM ORDER GRN</span>'
            : '<span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">PRODUCTION</span>';
        const refLabel = isRM
            ? `${draft.rm_order_number || draft.production_batch_no || '-'}<br><span class="text-xs text-slate-400">${draft.recipe_name || ''}</span>`
            : `${draft.production_batch_no || '-'}<br><span class="text-xs text-slate-400">${draft.recipe_name || ''}</span>`;

        let linkCell = '<span class="text-xs text-slate-400">-</span>';
        if (!isRM) {
            if (draft.sage_product_match === false) {
                linkCell = `<span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200" title="${(draft.sage_mismatch_reason || '').replace(/"/g, '&quot;')}">Mismatch</span>`;
            } else if (draft.sage_product_match === null) {
                linkCell = '<span class="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">Unverified</span>';
            } else {
                linkCell = '<span class="inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-800">OK</span>';
            }
        }

        const mismatchProd = !isRM && draft.sage_product_match === false;
        const pid = draft.production_batch_id != null ? Number(draft.production_batch_id) : '';
        const bno = (draft.production_batch_no || '').replace(/'/g, "\\'");
        const resetRemBtn = mismatchProd && pid !== '' && !Number.isNaN(pid)
            ? `<button type="button" onclick="adminResetLinkThenRem('${bno}', ${pid})" class="px-2 py-1 text-[10px] bg-violet-600 hover:bg-violet-700 text-white rounded" title="Clear stale link and open raw-materials to create new IJ drafts">Reset &amp; RM</button>`
            : '';

        const rnEsc = String(draft.recipe_name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const aqForPdf = Number(draft.actual_qty) || 0;
        const stockReqBtn = !isRM && draft.operation === 'PRODUCTION_BATCH_IS' && pid !== '' && !Number.isNaN(pid)
            ? `<button type="button" onclick="downloadBatchPDF(${pid}, '${bno}', '${rnEsc}', ${aqForPdf})" class="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition" title="Download Stock Requisition PDF (PPC pallet quantities)">Stock Req</button>`
            : '';

        const approveTitle = mismatchProd
            ? `Blocked: ${draft.sage_mismatch_reason || 'Sage batch does not match this product'} - use Reset & RM or Reject`
            : 'Approve & Post to Sage';
        const approveCls = mismatchProd
            ? 'px-3 py-1 text-xs bg-slate-300 text-slate-500 rounded cursor-not-allowed'
            : 'px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded transition';
        const approveDisabled = mismatchProd ? 'disabled' : '';
        const approveOnclick = mismatchProd ? '' : ` onclick="approveSageDraft('${draft.id}')"`;

        return `
        <tr class="hover:bg-slate-50 group ${isRM ? 'bg-amber-50/40' : ''}">
            <td class="px-4 py-3">
                <span class="font-mono text-sm font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                    ${draft.sage_journal_number || 'N/A'}
                </span>
            </td>
            <td class="px-4 py-3 text-sm">${typeBadge}</td>
            <td class="px-4 py-3 text-sm font-medium text-slate-900">${refLabel}</td>
            <td class="px-4 py-3 text-sm">${linkCell}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${formatNumber(draft.actual_qty)}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${draft.line_count || 0}</td>
            <td class="px-4 py-3 text-sm font-medium text-slate-900">AED ${formatNumber(draft.total_value)}</td>
            <td class="px-4 py-3 text-sm text-slate-500">
                ${draft.created_at ? formatDate(draft.created_at) : '-'}
                <br><span class="text-xs text-slate-400">by ${draft.created_by || 'Unknown'}</span>
            </td>
            <td class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                    <button 
                        onclick="viewSageDraftDetails('${draft.id}')"
                        class="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition"
                        title="View Details"
                    >
                        View
                    </button>
                    <button 
                        type="button"
                        ${approveDisabled}
                        ${approveOnclick}
                        class="${approveCls}"
                        title="${String(approveTitle).replace(/"/g, '&quot;')}"
                    >
                        Approve
                    </button>
                    <button 
                        onclick="rejectSageDraft('${draft.id}')"
                        class="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition"
                        title="${isRM ? 'Reject & Revert RM Order' : 'Reject & Delete from Sage'}"
                    >
                        Reject
                    </button>
                    ${stockReqBtn}
                    ${resetRemBtn}
                </div>
            </td>
        </tr>
    `}).join('');
}

/**
 * Load Sage posted/rejected history
 */
export async function loadSagePostedHistory() {
    try {
        const inc = sageHistoryIncludeMismatched ? '&include_mismatched=true' : '';
        const response = await authenticatedFetch(`/api/sage/posted?limit=50${inc}`);

        if (!response.ok) {
            throw new Error('Failed to load Sage history');
        }

        const data = await response.json();
        currentSageHistory = data.batches || [];

        const note = document.getElementById('sage-history-excluded-note');
        if (note) {
            const n = data.excluded_mismatch_count;
            if (n > 0 && !sageHistoryIncludeMismatched) {
                note.textContent = `${n} posted row(s) hidden - Sage link does not match product. Enable “Show mismatched” to audit.`;
                note.classList.remove('hidden');
            } else {
                note.textContent = '';
                note.classList.add('hidden');
            }
        }

        renderSageHistoryTable();
    } catch (error) {
        console.error('Error loading Sage history:', error);
        showToast('Failed to load Sage history', 'error');
    }
}

/**
 * Toggle posted-history audit mode (include rows that fail Sage link verification)
 */
export function onSageHistoryMismatchedToggle() {
    const el = document.getElementById('sage-history-include-mismatched');
    sageHistoryIncludeMismatched = !!(el && el.checked);
    loadSagePostedHistory();
}

/**
 * Render Sage history table
 */
function renderSageHistoryTable() {
    const tbody = document.getElementById('sage-history-table-body');
    
    if (!tbody) return;
    
    if (currentSageHistory.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-4 py-8 text-center text-slate-500">
                    No posted or rejected batches found
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = currentSageHistory.map(batch => {
        const isPosted = batch.status === 'posted';
        const processedBy = isPosted ? batch.approved_by : batch.rejected_by;
        const processedAt = isPosted ? batch.posted_at : batch.rejected_at;
        const op = batch.operation || '';
        const isProd = op === 'PRODUCTION_BATCH_IS' || op === 'PRODUCTION_BATCH_FGIN';
        let linkCol = '-';
        if (isProd) {
            if (batch.sage_product_match === false) {
                linkCol = `<span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800" title="${(batch.sage_mismatch_reason || '').replace(/"/g, '&quot;')}">Mismatch</span>`;
            } else if (batch.sage_product_match === null) {
                linkCol = '<span class="text-[10px] text-slate-500">Unverified</span>';
            } else {
                linkCol = '<span class="text-[10px] text-emerald-700">OK</span>';
            }
        }

        return `
            <tr class="hover:bg-slate-50">
                <td class="px-4 py-3">
                    <span class="font-mono text-sm font-semibold ${isPosted ? 'text-emerald-700 bg-emerald-50' : 'text-red-700 bg-red-50'} px-2 py-1 rounded">
                        ${batch.sage_journal_number || 'N/A'}
                    </span>
                </td>
                <td class="px-4 py-3 text-sm font-medium text-slate-900">${batch.production_batch_no || '-'}</td>
                <td class="px-4 py-3 text-sm text-slate-600">${batch.recipe_name || '-'}</td>
                <td class="px-4 py-3 text-sm">${linkCol}</td>
                <td class="px-4 py-3">
                    <span class="px-2 py-1 text-xs font-semibold rounded ${isPosted ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}">
                        ${isPosted ? 'POSTED' : 'REJECTED'}
                    </span>
                    ${batch.rejection_reason ? `<br><span class="text-xs text-slate-500">${batch.rejection_reason}</span>` : ''}
                </td>
                <td class="px-4 py-3 text-sm font-medium text-slate-900">AED ${formatNumber(batch.total_value)}</td>
                <td class="px-4 py-3 text-sm text-slate-600">${processedBy || '-'}</td>
                <td class="px-4 py-3 text-sm text-slate-500">${processedAt ? formatDate(processedAt) : '-'}</td>
            </tr>
        `;
    }).join('');
}

/**
 * View Sage draft details (handles both production and RM Order drafts)
 */
export async function viewSageDraftDetails(draftId) {
    try {
        const draft = currentSageDrafts.find(d => d.id === draftId);
        const isRM = draft?.draft_source === 'rm_order';
        
        let data;
        let linesHtml = '<p class="text-slate-500">No line items available</p>';
        
        if (isRM) {
            // RM Order GRN: fetch details from sage-entries endpoint (by Sage batch_id)
            const response = await authenticatedFetch(`/api/sage-entries/${draft.sage_batch_id}`);
            if (!response.ok) throw new Error('Failed to load draft details');
            data = await response.json();
            
            // Build lines from Sage batch details or from the header data
            const lines = data.lines || [];
            if (lines.length > 0) {
                linesHtml = `
                    <table class="w-full text-sm">
                        <thead class="bg-slate-50">
                            <tr>
                                <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600">Item Code</th>
                                <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600">Description</th>
                                <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600">Qty In</th>
                                <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600">Unit Cost</th>
                                <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600">Value</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200">
                            ${lines.map(line => `
                                <tr class="bg-emerald-50">
                                    <td class="px-3 py-2 font-mono text-xs">${line.item_code || '-'}</td>
                                    <td class="px-3 py-2">${line.item_description || line.description || '-'}</td>
                                    <td class="px-3 py-2 text-right text-emerald-700 font-semibold">${formatNumber(line.qty_in || line.fQtyIn || 0)}</td>
                                    <td class="px-3 py-2 text-right">${formatNumber(line.unit_cost || line.fNewCost || 0)}</td>
                                    <td class="px-3 py-2 text-right font-medium">${formatNumber((line.qty_in || line.fQtyIn || 0) * (line.unit_cost || line.fNewCost || 0))}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot class="bg-slate-100 font-semibold">
                            <tr>
                                <td colspan="4" class="px-3 py-2 text-right">Total Value:</td>
                                <td class="px-3 py-2 text-right">AED ${formatNumber(data.total_value || draft.total_value || 0)}</td>
                            </tr>
                        </tfoot>
                    </table>
                `;
            }
        } else {
            // Production batch: use existing endpoint
            const response = await authenticatedFetch(`/api/sage/draft/${draftId}`);
            if (!response.ok) throw new Error('Failed to load draft details');
            data = await response.json();
            
            if (data.batch_details && data.batch_details.lines && data.batch_details.lines.length > 0) {
                linesHtml = `
                    <table class="w-full text-sm">
                        <thead class="bg-slate-50">
                            <tr>
                                <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600">Item Code</th>
                                <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600">Description</th>
                                <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600">Qty In</th>
                                <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600">Qty Out</th>
                                <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600">Unit Cost</th>
                                <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600">Value</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200">
                            ${data.batch_details.lines.map(line => `
                                <tr class="${line.qty_in > 0 ? 'bg-emerald-50' : 'bg-orange-50'}">
                                    <td class="px-3 py-2 font-mono text-xs">${line.item_code || '-'}</td>
                                    <td class="px-3 py-2">${line.item_description || line.description || '-'}</td>
                                    <td class="px-3 py-2 text-right ${line.qty_in > 0 ? 'text-emerald-700 font-semibold' : ''}">${line.qty_in > 0 ? formatNumber(line.qty_in) : '-'}</td>
                                    <td class="px-3 py-2 text-right ${line.qty_out > 0 ? 'text-orange-700 font-semibold' : ''}">${line.qty_out > 0 ? formatNumber(line.qty_out) : '-'}</td>
                                    <td class="px-3 py-2 text-right">${formatNumber(line.unit_cost)}</td>
                                    <td class="px-3 py-2 text-right font-medium">${formatNumber(line.line_value)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                        <tfoot class="bg-slate-100 font-semibold">
                            <tr>
                                <td colspan="5" class="px-3 py-2 text-right">Total Value:</td>
                                <td class="px-3 py-2 text-right">AED ${formatNumber(data.batch_details.total_value)}</td>
                            </tr>
                        </tfoot>
                    </table>
                `;
            }
        }
        
        const headerSubtitle = isRM
            ? `RM Order: ${draft?.rm_order_number || 'N/A'} | Supplier: ${draft?.recipe_name || 'N/A'}`
            : `Production Batch: ${data.payload?.production_batch_no || 'N/A'} | Recipe: ${data.payload?.recipe_name || 'N/A'}`;
        
        const headerBgClass = isRM ? 'bg-gradient-to-r from-amber-50 to-white' : 'bg-gradient-to-r from-emerald-50 to-white';

        const prodPidModal = draft?.production_batch_id != null ? Number(draft.production_batch_id) : NaN;
        const showProdStockReq = !isRM && draft?.operation === 'PRODUCTION_BATCH_IS' && !Number.isNaN(prodPidModal);
        const modalBno = String(draft?.production_batch_no || data.payload?.production_batch_no || '').replace(/'/g, "\\'");
        const modalRn = String(draft?.recipe_name || data.payload?.recipe_name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
        const modalAq = Number(draft?.actual_qty ?? data.payload?.actual_qty) || 0;
        
        const modal = `
            <div id="sage-draft-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <div class="p-6 border-b border-slate-200 ${headerBgClass}">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="text-xl font-bold text-slate-900">
                                    ${isRM ? 'RM Order GRN' : 'Draft'} Details: <span class="${isRM ? 'text-amber-700' : 'text-emerald-700'}">${data.sage_journal_number || data.journal_number || draft?.sage_journal_number || 'N/A'}</span>
                                </h3>
                                <p class="text-slate-600 mt-1">${headerSubtitle}</p>
                            </div>
                            <button onclick="closeSageDraftModal()" class="text-slate-400 hover:text-slate-600">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    
                    <div class="p-6 overflow-y-auto flex-1">
                        <!-- Summary Cards -->
                        <div class="grid grid-cols-4 gap-4 mb-6">
                            <div class="bg-slate-50 rounded-lg p-4">
                                <p class="text-xs text-slate-500 uppercase">Sage Batch ID</p>
                                <p class="text-lg font-bold text-slate-900">${data.sage_batch_id || data.batch_id || draft?.sage_batch_id || 'N/A'}</p>
                            </div>
                            <div class="bg-slate-50 rounded-lg p-4">
                                <p class="text-xs text-slate-500 uppercase">Line Items</p>
                                <p class="text-lg font-bold text-slate-900">${data.line_count || draft?.line_count || 0}</p>
                            </div>
                            <div class="bg-emerald-50 rounded-lg p-4">
                                <p class="text-xs text-emerald-600 uppercase">Total Value</p>
                                <p class="text-lg font-bold text-emerald-700">AED ${formatNumber(data.total_value || draft?.total_value || 0)}</p>
                            </div>
                            <div class="bg-slate-50 rounded-lg p-4">
                                <p class="text-xs text-slate-500 uppercase">Created By</p>
                                <p class="text-lg font-bold text-slate-900">${data.created_by || draft?.created_by || 'N/A'}</p>
                            </div>
                        </div>
                        
                        <!-- Legend -->
                        <div class="flex gap-4 mb-4 text-sm">
                            <div class="flex items-center gap-2">
                                <span class="w-4 h-4 bg-emerald-50 border border-emerald-200 rounded"></span>
                                <span class="text-slate-600">${isRM ? 'Receipt (Qty In) - Raw Materials' : 'Receipt (Qty In) - Finished Goods'}</span>
                            </div>
                            ${!isRM ? `<div class="flex items-center gap-2">
                                <span class="w-4 h-4 bg-orange-50 border border-orange-200 rounded"></span>
                                <span class="text-slate-600">Issue (Qty Out) - Raw Materials</span>
                            </div>` : ''}
                        </div>
                        
                        <!-- Line Items -->
                        <div class="border border-slate-200 rounded-lg overflow-hidden">
                            ${linesHtml}
                        </div>
                    </div>
                    
                    <div class="p-6 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
                        <div class="flex flex-wrap gap-2">
                            <button onclick="closeSageDraftModal()" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition">
                                Close
                            </button>
                            ${showProdStockReq ? `<button type="button" onclick="downloadBatchPDF(${prodPidModal}, '${modalBno}', '${modalRn}', ${modalAq})" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition" title="Filled stock requisition with PPC pallet quantities">Stock Requisition PDF</button>` : ''}
                        </div>
                        <div class="flex gap-3">
                            <button onclick="closeSageDraftModal(); rejectSageDraft('${draftId}')" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition">
                                Reject
                            </button>
                            <button onclick="closeSageDraftModal(); approveSageDraft('${draftId}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition">
                                Approve & Post
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modal);
        
    } catch (error) {
        console.error('Error viewing draft details:', error);
        showToast('Failed to load draft details', 'error');
    }
}

/**
 * Reset stale sage_outbox link for a production batch, then open the Yield
 * raw-material modal to create new IJ drafts (requires modal in index.html).
 */
export async function adminResetLinkThenRem(batchNo, productionBatchId) {
    if (!batchNo || productionBatchId == null || Number.isNaN(Number(productionBatchId))) {
        showToast('Missing batch or production id', 'error');
        return;
    }
    if (!confirm(`Reset the app Sage link for ${batchNo} and open raw-material quantities to create new IJ drafts?`)) {
        return;
    }
    try {
        const res = await authenticatedFetch('/api/sage/reset-production-batch-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batch_no: batchNo, dry_run: false }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            const d = data.detail;
            showToast(typeof d === 'string' ? d : 'Reset failed', 'error');
            return;
        }
        showToast(data.message || 'Link reset', 'success');
        await loadSageDrafts();
        if (typeof window.sendToSage === 'function') {
            window.sendToSage(Number(productionBatchId), batchNo);
        } else {
            showToast('Open Yield and use Send to Sage for this batch.', 'info');
        }
    } catch (e) {
        showToast(e.message || 'Reset failed', 'error');
    }
}

/**
 * Close Sage draft modal
 */
export function closeSageDraftModal() {
    const modal = document.getElementById('sage-draft-modal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Check Sage Agent health and update status indicator
 */
export async function checkSageAgentHealth() {
    const statusEl = document.getElementById('sage-agent-status');
    const dotEl = document.getElementById('sage-agent-dot');
    const labelEl = document.getElementById('sage-agent-label');
    
    if (!statusEl || !dotEl || !labelEl) return;
    
    // Set checking state
    dotEl.className = 'w-2.5 h-2.5 rounded-full bg-slate-400 animate-pulse';
    labelEl.textContent = 'Checking...';
    statusEl.className = 'flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-500 text-sm cursor-pointer hover:bg-slate-200 transition';
    
    try {
        const response = await authenticatedFetch('/api/sage/agent-health');
        if (!response.ok) throw new Error('Health check failed');
        
        const data = await response.json();
        
        if (data.status === 'ok') {
            dotEl.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500';
            labelEl.textContent = 'Agent connected';
            statusEl.className = 'flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-sm cursor-pointer hover:bg-emerald-100 transition';
            statusEl.title = `Agent: ${data.url || 'Connected'} | DB: ${data.database_connected ? 'OK' : 'N/A'}`;
        } else if (data.status === 'unreachable') {
            dotEl.className = 'w-2.5 h-2.5 rounded-full bg-amber-500';
            labelEl.textContent = 'Agent offline (ODBC fallback)';
            statusEl.className = 'flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-700 text-sm cursor-pointer hover:bg-amber-100 transition';
            statusEl.title = 'Agent is not reachable. Posting will use direct ODBC connection as fallback.';
        } else if (data.status === 'not_configured') {
            dotEl.className = 'w-2.5 h-2.5 rounded-full bg-slate-400';
            labelEl.textContent = 'Direct ODBC mode';
            statusEl.className = 'flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm cursor-pointer hover:bg-slate-200 transition';
            statusEl.title = 'No Sage Agent configured. Posting uses direct ODBC connection.';
        } else {
            dotEl.className = 'w-2.5 h-2.5 rounded-full bg-red-500';
            labelEl.textContent = 'Agent error';
            statusEl.className = 'flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm cursor-pointer hover:bg-red-100 transition';
            statusEl.title = data.message || 'Agent health check returned an error.';
        }
    } catch (error) {
        dotEl.className = 'w-2.5 h-2.5 rounded-full bg-amber-500';
        labelEl.textContent = 'Direct ODBC mode';
        statusEl.className = 'flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-sm cursor-pointer hover:bg-slate-200 transition';
        statusEl.title = 'Could not check agent status. Posting will use direct ODBC.';
    }
}

/**
 * Approve a Sage draft (production batch or RM Order GRN)
 */
export async function approveSageDraft(draftId) {
    const draft = currentSageDrafts.find(d => d.id === draftId);
    const isRM = draft?.draft_source === 'rm_order';
    
    const confirmMsg = isRM
        ? `Are you sure you want to APPROVE and POST RM Order GRN "${draft?.sage_journal_number || draftId}" (${draft?.rm_order_number || ''})?\n\nThis will update stock quantities in Sage and mark the RM order as received.`
        : `Are you sure you want to APPROVE and POST batch "${draft?.sage_journal_number || draftId}"?\n\nThis will update stock quantities in Sage.`;
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    // Disable all approve/reject buttons to prevent double-clicks
    _setDraftButtonsDisabled(true);
    
    // Show posting indicator
    showToast('Posting batch to Sage... Please wait.', 'info');
    
    try {
        let response;
        if (isRM) {
            // RM Order GRN: use sage-entries approve endpoint (by Sage batch_id)
            response = await authenticatedFetch(`/api/sage-entries/${draft.sage_batch_id}/approve`, {
                method: 'POST'
            });
        } else {
            // Production batch: use existing sage/draft approve endpoint (by MongoDB _id)
            response = await authenticatedFetch(`/api/sage/draft/${draftId}/approve`, {
                method: 'POST'
            });
        }
        
        if (!response.ok) {
            const error = await response.json();
            const errorDetail = error.detail || 'Failed to approve draft';
            
            // Provide actionable guidance based on error type
            if (errorDetail.includes('not reachable') || errorDetail.includes('Agent')) {
                throw new Error(`${errorDetail}\n\nTip: Start the Sage Posting Agent on the Sage PC, or the system will use direct ODBC as fallback.`);
            } else if (errorDetail.includes('not found')) {
                throw new Error(`${errorDetail}\n\nThe batch may have been deleted from Sage desktop.`);
            } else if (errorDetail.includes('already posted')) {
                showToast('This batch has already been posted in Sage.', 'info');
                loadSageDrafts();
                return;
            }
            throw new Error(errorDetail);
        }
        
        const result = await response.json();
        const method = result.posted_via === 'agent' ? ' (via Agent)' : '';
        const msg = isRM
            ? `RM Order GRN ${draft?.sage_journal_number} approved and posted to Sage${method}!`
            : `Batch ${result.sage_journal_number || draft?.sage_journal_number} approved and posted to Sage${method}!`;
        showToast(msg, 'success');
        loadSageDrafts();
        
    } catch (error) {
        console.error('Error approving draft:', error);
        showToast(error.message, 'error');
    } finally {
        _setDraftButtonsDisabled(false);
    }
}

/**
 * Reject a Sage draft (production batch or RM Order GRN)
 */
export async function rejectSageDraft(draftId) {
    const draft = currentSageDrafts.find(d => d.id === draftId);
    const isRM = draft?.draft_source === 'rm_order';
    
    const promptMsg = isRM
        ? `Rejecting RM Order GRN "${draft?.sage_journal_number || draftId}" (${draft?.rm_order_number || ''}).\nThis will delete the Sage draft and revert the RM order to LPO status.\n\nEnter reason:`
        : `Enter reason for rejecting batch "${draft?.sage_journal_number || draftId}":`;
    
    const reason = prompt(promptMsg);
    
    if (reason === null) {
        return; // User cancelled
    }
    
    // Disable buttons during operation
    _setDraftButtonsDisabled(true);
    
    try {
        let response;
        if (isRM) {
            // RM Order GRN: use sage-entries delete endpoint (by Sage batch_id)
            response = await authenticatedFetch(`/api/sage-entries/${draft.sage_batch_id}`, {
                method: 'DELETE'
            });
        } else {
            // Production batch: use existing sage/draft reject endpoint (by MongoDB _id)
            response = await authenticatedFetch(`/api/sage/draft/${draftId}/reject?reason=${encodeURIComponent(reason)}`, {
                method: 'POST'
            });
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to reject draft');
        }
        
        const result = await response.json();
        const msg = isRM
            ? `RM Order GRN deleted from Sage. ${result.rm_order_reverted ? 'RM Order reverted to LPO status.' : ''}`
            : `Batch ${result.sage_journal_number || draft?.sage_journal_number} rejected and deleted from Sage`;
        showToast(msg, 'success');
        loadSageDrafts();
        
    } catch (error) {
        console.error('Error rejecting draft:', error);
        showToast(error.message, 'error');
    } finally {
        _setDraftButtonsDisabled(false);
    }
}

/**
 * Helper: disable/enable all approve/reject buttons in the drafts table
 * to prevent double-click issues during posting
 */
function _setDraftButtonsDisabled(disabled) {
    const tbody = document.getElementById('sage-drafts-table-body');
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
 * Format number for display
 */
function formatNumber(value) {
    if (value === null || value === undefined) return '0';
    return Number(value).toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

// =============================================================================
// DATABASE MAINTENANCE - FORCE FULL SYNC
// =============================================================================

/**
 * Force a full re-sync of inventory transactions from Sage.
 * Drops the entire MongoDB cache and re-fetches all records from scratch.
 */
export async function forceFullSync() {
    if (!confirm(
        'WARNING: This will DELETE all cached inventory transactions from MongoDB and re-fetch every record from Sage.\n\n' +
        'This may take 30–60 seconds. The inventory transactions page will be empty until the sync completes.\n\n' +
        'Are you sure you want to proceed?'
    )) {
        return;
    }

    const btn = document.getElementById('force-full-sync-btn');
    const icon = document.getElementById('force-sync-icon');
    const label = document.getElementById('force-sync-label');
    const statusEl = document.getElementById('force-sync-status');

    // Enter loading state
    if (btn) btn.disabled = true;
    if (icon) icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" class="animate-spin origin-center"/>';
    if (label) label.textContent = 'Syncing…';
    if (statusEl) {
        statusEl.textContent = 'Dropping cache and fetching from Sage…';
        statusEl.classList.remove('hidden');
    }

    try {
        const response = await authenticatedFetch('/api/inventory-transactions/force-full-sync', {
            method: 'POST'
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            if (response.status === 403) {
                throw new Error('Permission denied. Admin access required.');
            } else if (response.status === 409) {
                throw new Error(err.detail || 'A sync is already in progress. Please wait and try again.');
            } else {
                throw new Error(err.detail || `Sync failed (${response.status})`);
            }
        }

        if (statusEl) statusEl.textContent = 'Sync started - fetching from Sage...';

        const pollUntilDone = () => new Promise((resolve, reject) => {
            const interval = setInterval(async () => {
                try {
                    const statusRes = await authenticatedFetch('/api/inventory-transactions/sync-status');
                    if (!statusRes.ok) return;
                    const statusData = await statusRes.json();
                    if (statusData.progress && statusEl) {
                        statusEl.textContent = statusData.progress;
                    }
                    if (!statusData.sync_in_progress) {
                        clearInterval(interval);
                        resolve(statusData.progress || 'Sync complete');
                    }
                } catch (_) { /* ignore poll errors */ }
            }, 2000);
            setTimeout(() => { clearInterval(interval); reject(new Error('Sync timed out after 5 minutes')); }, 300000);
        });

        const finalMsg = await pollUntilDone();

        if (finalMsg && finalMsg.startsWith('Error:')) {
            throw new Error(finalMsg);
        }

        showToast(`Full re-sync complete`, 'success');
        if (statusEl) statusEl.textContent = `${finalMsg} - ${new Date().toLocaleTimeString()}`;

    } catch (error) {
        console.error('Force full sync error:', error);
        showToast(error.message, 'error');
        if (statusEl) statusEl.textContent = `Error: ${error.message}`;
    } finally {
        if (btn) btn.disabled = false;
        if (icon) icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>';
        if (label) label.textContent = 'Force Full Re-Sync from Sage';
    }
}


// =============================================================================
// ACCOUNTING DRAFTS - Cashbook / AR / AP Batch Approval
// =============================================================================

let currentAcctDrafts = [];

export async function loadAcctDrafts() {
    try {
        const response = await authenticatedFetch('/api/accounting/pending-drafts');
        if (!response.ok) throw new Error('Failed to load accounting drafts');
        const data = await response.json();
        currentAcctDrafts = data.drafts || [];

        const badge = document.getElementById('acct-pending-count-badge');
        if (badge) badge.textContent = currentAcctDrafts.length;

        renderAcctDraftsTable();
    } catch (error) {
        console.error('Error loading accounting drafts:', error);
    }
}

function renderAcctDraftsTable() {
    const tbody = document.getElementById('acct-drafts-table-body');
    if (!tbody) return;

    if (currentAcctDrafts.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="px-4 py-8 text-center text-slate-500">
                    <div class="flex flex-col items-center">
                        <svg class="w-12 h-12 text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p class="font-medium">No pending accounting drafts</p>
                        <p class="text-sm">All vouchers have been processed</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    const typeColors = {
        BPV: 'bg-blue-100 text-blue-700',
        CPV: 'bg-green-100 text-green-700',
        TTPV: 'bg-purple-100 text-purple-700',
        BRV: 'bg-amber-100 text-amber-700',
    };

    tbody.innerHTML = currentAcctDrafts.map(d => {
        const vt = d.voucher_type || '';
        const badge = typeColors[vt] || 'bg-slate-100 text-slate-700';
        const amt = Number(d.total_debit || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const sageBadge = d.sage_batch_id
            ? `<span class="font-mono text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">${d.sage_batch_no || d.sage_batch_id}</span>`
            : '<span class="text-xs text-red-500">No Sage</span>';

        return `
        <tr class="hover:bg-slate-50 group">
            <td class="px-4 py-3">${sageBadge}</td>
            <td class="px-4 py-3 text-sm">
                <span class="inline-block px-2 py-0.5 rounded text-[10px] font-bold ${badge}">${vt}</span>
            </td>
            <td class="px-4 py-3 text-sm font-medium text-slate-900">${d.voucher_no || '-'}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${d.date || '-'}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${d.being || d.paid_to_or_received_from || '-'}</td>
            <td class="px-4 py-3 text-sm font-medium text-slate-900">AED ${amt}</td>
            <td class="px-4 py-3 text-sm text-slate-500">
                ${d.created_at ? formatDate(d.created_at) : '-'}
                <br><span class="text-xs text-slate-400">by ${d.prepared_by || 'Unknown'}</span>
            </td>
            <td class="px-4 py-3">
                <div class="flex gap-2">
                    <button onclick="viewAcctDraftDetails('${d._id}')"
                        class="px-3 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition">View</button>
                    <button onclick="approveAcctDraft('${d._id}')"
                        class="px-3 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded transition">Approve</button>
                    <button onclick="rejectAcctDraft('${d._id}')"
                        class="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition">Reject</button>
                </div>
            </td>
        </tr>
        `;
    }).join('');
}

export async function viewAcctDraftDetails(draftId) {
    try {
        const response = await authenticatedFetch(`/api/accounting/drafts/${draftId}`);
        if (!response.ok) throw new Error('Failed to load draft');
        const data = await response.json();
        const d = data.draft;

        const typeLabels = { BPV: 'Bank Payment Voucher', CPV: 'Cash Payment Voucher', TTPV: 'TT Payment Voucher', BRV: 'Bank Receipt Voucher' };
        const lines = d.lines || [];
        const linesHtml = lines.length === 0
            ? '<p class="text-slate-500 p-4">No line items</p>'
            : `<table class="w-full text-sm">
                <thead class="bg-slate-50">
                    <tr>
                        <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600">Account</th>
                        <th class="px-3 py-2 text-left text-xs font-semibold text-slate-600">Description</th>
                        <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600">Debit</th>
                        <th class="px-3 py-2 text-right text-xs font-semibold text-slate-600">Credit</th>
                        <th class="px-3 py-2 text-center text-xs font-semibold text-slate-600">VAT</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-200">
                    ${lines.map(l => `
                        <tr class="${(l.debit || 0) > 0 ? 'bg-red-50/40' : 'bg-emerald-50/40'}">
                            <td class="px-3 py-2 font-mono text-xs">${l.account_code || ''}<br><span class="text-slate-400">${l.account_name || ''}</span></td>
                            <td class="px-3 py-2">${l.description || '-'}</td>
                            <td class="px-3 py-2 text-right ${(l.debit||0) > 0 ? 'text-red-700 font-semibold' : ''}">${(l.debit||0) > 0 ? Number(l.debit).toLocaleString('en-US',{minimumFractionDigits:2}) : '-'}</td>
                            <td class="px-3 py-2 text-right ${(l.credit||0) > 0 ? 'text-emerald-700 font-semibold' : ''}">${(l.credit||0) > 0 ? Number(l.credit).toLocaleString('en-US',{minimumFractionDigits:2}) : '-'}</td>
                            <td class="px-3 py-2 text-center">${l.is_vat ? '<span class="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">VAT</span>' : ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot class="bg-slate-100 font-semibold">
                    <tr>
                        <td colspan="2" class="px-3 py-2 text-right">Totals:</td>
                        <td class="px-3 py-2 text-right text-red-700">${Number(d.total_debit||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                        <td class="px-3 py-2 text-right text-emerald-700">${Number(d.total_credit||0).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>`;

        const modal = `
            <div id="acct-draft-modal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                    <div class="p-6 border-b border-slate-200 bg-gradient-to-r from-blue-50 to-white">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="text-xl font-bold text-slate-900">
                                    ${typeLabels[d.voucher_type] || d.voucher_type}: <span class="text-blue-700">${d.voucher_no || 'N/A'}</span>
                                </h3>
                                <p class="text-slate-600 mt-1">${d.being || d.paid_to_or_received_from || ''}</p>
                            </div>
                            <button onclick="closeAcctDraftModal()" class="text-slate-400 hover:text-slate-600">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="p-6 overflow-y-auto flex-1">
                        <div class="grid grid-cols-4 gap-4 mb-6">
                            <div class="bg-slate-50 rounded-lg p-4">
                                <p class="text-xs text-slate-500 uppercase">Sage Batch</p>
                                <p class="text-lg font-bold text-slate-900">${d.sage_batch_no || d.sage_batch_id || 'N/A'}</p>
                            </div>
                            <div class="bg-slate-50 rounded-lg p-4">
                                <p class="text-xs text-slate-500 uppercase">Date</p>
                                <p class="text-lg font-bold text-slate-900">${d.date || '-'}</p>
                            </div>
                            <div class="bg-blue-50 rounded-lg p-4">
                                <p class="text-xs text-blue-600 uppercase">Total</p>
                                <p class="text-lg font-bold text-blue-700">AED ${Number(d.total_debit||0).toLocaleString('en-US',{minimumFractionDigits:2})}</p>
                            </div>
                            <div class="bg-slate-50 rounded-lg p-4">
                                <p class="text-xs text-slate-500 uppercase">Bank Account</p>
                                <p class="text-sm font-bold text-slate-900">${d.bank_account_name || '-'}</p>
                            </div>
                        </div>
                        <div class="grid grid-cols-3 gap-4 mb-6 text-sm">
                            <div><span class="text-slate-500">Invoice #:</span> ${d.invoice_no || '-'}</div>
                            <div><span class="text-slate-500">GRN #:</span> ${d.grn_no || '-'}</div>
                            <div><span class="text-slate-500">PO #:</span> ${d.po_no || '-'}</div>
                        </div>
                        <div class="border border-slate-200 rounded-lg overflow-hidden">${linesHtml}</div>
                    </div>
                    <div class="p-6 border-t border-slate-200 bg-slate-50 flex justify-between">
                        <button onclick="closeAcctDraftModal()" class="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition">Close</button>
                        <div class="flex gap-3">
                            <button onclick="closeAcctDraftModal(); rejectAcctDraft('${draftId}')" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition">Reject</button>
                            <button onclick="closeAcctDraftModal(); approveAcctDraft('${draftId}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition">Approve & Post</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modal);
    } catch (error) {
        console.error('Error viewing accounting draft:', error);
        showToast('Failed to load draft details', 'error');
    }
}

export function closeAcctDraftModal() {
    const el = document.getElementById('acct-draft-modal');
    if (el) el.remove();
}

export async function approveAcctDraft(draftId) {
    const draft = currentAcctDrafts.find(d => d._id === draftId);
    if (!confirm(`Approve and POST voucher "${draft?.voucher_no || draftId}" to Sage?\n\nThis will create GL transactions in Sage.`)) return;

    _setAcctButtonsDisabled(true);
    showToast('Posting to Sage... Please wait.', 'info');

    try {
        const response = await authenticatedFetch(`/api/accounting/drafts/${draftId}/post`, { method: 'POST' });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to post draft');
        }
        showToast(`Voucher ${draft?.voucher_no || ''} posted to Sage`, 'success');
        loadAcctDrafts();
    } catch (error) {
        console.error('Error posting accounting draft:', error);
        showToast(error.message, 'error');
    } finally {
        _setAcctButtonsDisabled(false);
    }
}

export async function rejectAcctDraft(draftId) {
    const draft = currentAcctDrafts.find(d => d._id === draftId);
    const reason = prompt(`Rejecting voucher "${draft?.voucher_no || draftId}".\nThis will delete the Sage draft.\n\nEnter reason:`);
    if (reason === null) return;

    _setAcctButtonsDisabled(true);

    try {
        const response = await authenticatedFetch(`/api/accounting/drafts/${draftId}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason }),
        });
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || 'Failed to reject draft');
        }
        showToast(`Voucher ${draft?.voucher_no || ''} rejected`, 'success');
        loadAcctDrafts();
    } catch (error) {
        console.error('Error rejecting accounting draft:', error);
        showToast(error.message, 'error');
    } finally {
        _setAcctButtonsDisabled(false);
    }
}

function _setAcctButtonsDisabled(disabled) {
    const tbody = document.getElementById('acct-drafts-table-body');
    if (!tbody) return;
    tbody.querySelectorAll('button').forEach(btn => {
        btn.disabled = disabled;
        if (disabled) btn.classList.add('opacity-50', 'cursor-not-allowed');
        else btn.classList.remove('opacity-50', 'cursor-not-allowed');
    });
}


// =============================================================================
// RECEPTION DESK LOGS
// =============================================================================

let receptionVisitors = [];
let receptionCouriers = [];
let activeReceptionTab = 'visitors';

export async function loadReceptionLogs() {
    try {
        const [vRes, cRes] = await Promise.all([
            authenticatedFetch('/api/reception/visitors'),
            authenticatedFetch('/api/reception/couriers'),
        ]);
        if (vRes.ok) {
            const vData = await vRes.json();
            receptionVisitors = vData.entries || [];
        }
        if (cRes.ok) {
            const cData = await cRes.json();
            receptionCouriers = cData.entries || [];
        }
        const vc = document.getElementById('reception-visitors-count');
        const cc = document.getElementById('reception-couriers-count');
        if (vc) vc.textContent = receptionVisitors.length;
        if (cc) cc.textContent = receptionCouriers.length;
        renderReceptionVisitors();
        renderReceptionCouriers();
    } catch (err) {
        console.error('Error loading reception logs:', err);
    }
}

function _fmtDt(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `${date}<br><span class="text-xs text-slate-400">${time}</span>`;
}

function renderReceptionVisitors() {
    const tbody = document.getElementById('reception-visitors-body');
    if (!tbody) return;
    if (receptionVisitors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-slate-500">No visitor records</td></tr>';
        return;
    }
    tbody.innerHTML = receptionVisitors.map(v => `
        <tr class="hover:bg-slate-50">
            <td class="px-4 py-3 text-sm text-slate-700">${_fmtDt(v.submitted_at)}</td>
            <td class="px-4 py-3 text-sm font-medium text-slate-900">${v.full_name || ''}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${v.company || ''}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${v.designation || ''}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${v.purpose_of_visit || ''}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${v.contact_number || ''}</td>
            <td class="px-4 py-3">
                <button onclick="viewReceptionPhotos('${v.id_front_photo_id}','${v.id_back_photo_id}','${(v.full_name||'').replace(/'/g,'\\\'')}')"
                    class="px-3 py-1 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded transition">View ID</button>
            </td>
            <td class="px-4 py-3">
                <button onclick="deleteReceptionEntry('visitors','${v._id}')"
                    class="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition">Delete</button>
            </td>
        </tr>
    `).join('');
}

function renderReceptionCouriers() {
    const tbody = document.getElementById('reception-couriers-body');
    if (!tbody) return;
    if (receptionCouriers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-4 py-8 text-center text-slate-500">No courier records</td></tr>';
        return;
    }
    tbody.innerHTML = receptionCouriers.map(c => `
        <tr class="hover:bg-slate-50">
            <td class="px-4 py-3 text-sm text-slate-700">${_fmtDt(c.submitted_at)}</td>
            <td class="px-4 py-3 text-sm font-medium text-slate-900">${c.recipient_name || ''}</td>
            <td class="px-4 py-3"><span class="px-2 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-800">${c.courier_type || ''}</span></td>
            <td class="px-4 py-3 text-sm text-slate-600">${c.courier_company || ''}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${c.representative_name || ''}</td>
            <td class="px-4 py-3 text-sm text-slate-600">${c.representative_contact || ''}</td>
            <td class="px-4 py-3">
                <button onclick="viewReceptionPhotos('${c.id_front_photo_id}','${c.id_back_photo_id}','${(c.representative_name||'').replace(/'/g,'\\\'')}')"
                    class="px-3 py-1 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded transition">View ID</button>
            </td>
            <td class="px-4 py-3">
                <button onclick="deleteReceptionEntry('couriers','${c._id}')"
                    class="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition">Delete</button>
            </td>
        </tr>
    `).join('');
}

export function switchReceptionTab(tab) {
    activeReceptionTab = tab;
    const vTab = document.getElementById('reception-tab-visitors');
    const cTab = document.getElementById('reception-tab-couriers');
    const vPanel = document.getElementById('reception-visitors-tab');
    const cPanel = document.getElementById('reception-couriers-tab');

    if (tab === 'visitors') {
        vTab.className = 'px-4 py-2 font-medium text-violet-600 border-b-2 border-violet-600 -mb-px';
        cTab.className = 'px-4 py-2 font-medium text-slate-500 hover:text-slate-700';
        vPanel.classList.remove('hidden');
        cPanel.classList.add('hidden');
    } else {
        cTab.className = 'px-4 py-2 font-medium text-violet-600 border-b-2 border-violet-600 -mb-px';
        vTab.className = 'px-4 py-2 font-medium text-slate-500 hover:text-slate-700';
        cPanel.classList.remove('hidden');
        vPanel.classList.add('hidden');
    }
}

export function refreshReceptionLogs() {
    loadReceptionLogs();
}

export function exportReceptionExcel() {
    const type = activeReceptionTab;
    window.open(`/api/reception/export/${type}`, '_blank');
}

export function viewReceptionPhotos(frontId, backId, name) {
    const modal = document.getElementById('reception-photo-modal');
    const title = document.getElementById('reception-photo-title');
    const frontImg = document.getElementById('reception-photo-front');
    const backImg = document.getElementById('reception-photo-back');
    const frontDl = document.getElementById('reception-photo-front-dl');
    const backDl = document.getElementById('reception-photo-back-dl');

    title.textContent = `ID Document - ${name}`;
    frontImg.src = `/api/reception/photos/${frontId}`;
    backImg.src = `/api/reception/photos/${backId}`;
    frontDl.href = `/api/reception/photos/${frontId}`;
    backDl.href = `/api/reception/photos/${backId}`;
    modal.classList.remove('hidden');
}

export function closeReceptionPhotoModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('reception-photo-modal').classList.add('hidden');
}

export async function deleteReceptionEntry(type, id) {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    try {
        const res = await authenticatedFetch(`/api/reception/${type}/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        showToast('Entry deleted', 'success');
        loadReceptionLogs();
    } catch (err) {
        showToast('Failed to delete entry', 'error');
    }
}


// Make functions globally available
window.switchSageTab = switchSageTab;
window.loadSageDrafts = loadSageDrafts;
window.loadSagePostedHistory = loadSagePostedHistory;
window.viewSageDraftDetails = viewSageDraftDetails;
window.closeSageDraftModal = closeSageDraftModal;
window.approveSageDraft = approveSageDraft;
window.rejectSageDraft = rejectSageDraft;
window.checkSageAgentHealth = checkSageAgentHealth;
window.forceFullSync = forceFullSync;
window.loadAcctDrafts = loadAcctDrafts;
window.viewAcctDraftDetails = viewAcctDraftDetails;
window.closeAcctDraftModal = closeAcctDraftModal;
window.approveAcctDraft = approveAcctDraft;
window.rejectAcctDraft = rejectAcctDraft;
window.switchReceptionTab = switchReceptionTab;
window.refreshReceptionLogs = refreshReceptionLogs;
window.exportReceptionExcel = exportReceptionExcel;
window.viewReceptionPhotos = viewReceptionPhotos;
window.closeReceptionPhotoModal = closeReceptionPhotoModal;
window.deleteReceptionEntry = deleteReceptionEntry;

