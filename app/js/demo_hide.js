/**
 * No-op stub for the demo-mode column hider.
 *
 * Replaced for the standalone demo: the real `demo_hide.js` hid cost/qty
 * columns when the user role was `demo`. Here we run as admin against fully
 * fabricated data, so there is nothing to hide - every export is a no-op.
 *
 * Keeps the import surface in app.js intact so the module graph loads.
 */

export function applyDemoHide(_root = document) { /* no-op */ }
export function startDemoHideObserver() { /* no-op */ }
export function stopDemoHideObserver()  { /* no-op */ }
