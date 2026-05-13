/**
 * Demo Plant LLC - Dashboard Module
 * Drives the editorial home dashboard: live clock, greeting, KPI cards.
 */

import { authenticatedFetch, getCurrentUser } from '../auth.js?v=20260428b';
import { formatNumber } from '../utils.js?v=20260125h';

const UAE_TZ = 'Asia/Dubai';

function getShift(hour) {
    if (hour >= 6 && hour < 14) return { greet: 'Good Morning', shift: 'Morning Shift' };
    if (hour >= 14 && hour < 22) return { greet: 'Good Afternoon', shift: 'Afternoon Shift' };
    return { greet: 'Good Evening', shift: 'Night Shift' };
}

function firstName(user) {
    if (!user) return 'Operator';
    const raw = user.full_name || user.username || '';
    const first = raw.trim().split(/\s+/)[0];
    if (!first) return 'Operator';
    return first.charAt(0).toUpperCase() + first.slice(1);
}

let clockTimer = null;

function paintClock() {
    const now = new Date();
    const hour = parseInt(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: UAE_TZ }).format(now), 10);
    const { shift } = getShift(hour);

    const dateEl = document.getElementById('kbe-clock-date');
    const timeEl = document.getElementById('kbe-clock-time');
    const todayEl = document.getElementById('kbe-today-long');
    const shiftEl = document.getElementById('kbe-shift-label');

    if (dateEl) {
        dateEl.textContent = new Intl.DateTimeFormat('en-GB', {
            weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: UAE_TZ,
        }).format(now).toUpperCase();
    }
    if (timeEl) {
        timeEl.textContent = new Intl.DateTimeFormat('en-GB', {
            hour: '2-digit', minute: '2-digit', hour12: false, timeZone: UAE_TZ,
        }).format(now) + ' GST';
    }
    if (todayEl) {
        todayEl.textContent = new Intl.DateTimeFormat('en-GB', {
            weekday: 'long', day: 'numeric', month: 'long', timeZone: UAE_TZ,
        }).format(now);
    }
    if (shiftEl) {
        shiftEl.textContent = `Plant Running · ${shift}`;
    }
}

function paintGreeting() {
    const greetEl = document.getElementById('greeting-text');
    if (!greetEl) return;
    const now = new Date();
    const hour = parseInt(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: UAE_TZ }).format(now), 10);
    const { greet } = getShift(hour);
    const name = firstName(getCurrentUser());
    greetEl.innerHTML = `${greet}, <em>${name}</em>.`;
}

/**
 * Load dashboard statistics and update KPI cards.
 * For users with role `mixing_area`, show a focused two-button landing
 * page (Mixing Section / Mixing Utilities) instead of the KPI dashboard.
 */
export async function loadDashboardStats() {
    const user = getCurrentUser();
    const isMixing = user?.role === 'mixing_area';

    const defaultEl = document.getElementById('kbe-home-default');
    const mixingEl  = document.getElementById('kbe-home-mixing-landing');
    if (defaultEl) defaultEl.classList.toggle('hidden', isMixing);
    if (mixingEl)  mixingEl.classList.toggle('hidden', !isMixing);

    if (isMixing) {
        if (clockTimer) { clearInterval(clockTimer); clockTimer = null; }
        return;
    }

    paintGreeting();
    paintClock();
    if (clockTimer) clearInterval(clockTimer);
    clockTimer = setInterval(paintClock, 30000);

    try {
        const response = await authenticatedFetch('/api/dashboard/stats');
        if (!response.ok) throw new Error(`Failed to fetch dashboard stats: ${response.status}`);

        const stats = await response.json();

        const inventoryValueEl = document.getElementById('kpi-inventory-value');
        const totalItemsEl = document.getElementById('kpi-total-items');
        const lowStockEl = document.getElementById('kpi-low-stock');
        const activeRecipesEl = document.getElementById('kpi-active-recipes');

        if (inventoryValueEl) {
            inventoryValueEl.textContent = 'AED ' + formatNumber(stats.total_inventory_value || 0);
        }
        if (totalItemsEl) {
            totalItemsEl.textContent = formatNumber(stats.total_items || 0);
        }
        if (lowStockEl) {
            lowStockEl.textContent = formatNumber(stats.low_stock_count || 0);
        }
        if (activeRecipesEl) {
            activeRecipesEl.textContent = formatNumber(stats.active_recipes || 0);
        }

        console.log('✅ Dashboard stats loaded:', stats);
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
        ['kpi-inventory-value', 'kpi-total-items', 'kpi-low-stock', 'kpi-active-recipes'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '--';
        });
    }
}
