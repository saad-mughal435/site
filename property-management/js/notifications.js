/* notifications.js - Property Management toast stack + Web Audio cues.
 * window.toast(msg, kind, ms) and window.PMAudio for success / alert cues.
 * The persistent bell inbox + email log live in mock-api.js (pm.notifications
 * / pm.email_log) and are rendered by PMUI.wireBell in app.js. */
(function () {
  'use strict';
  var stack;
  function ensure() { if (stack) return stack; stack = document.createElement('div'); stack.className = 'pm-toasts'; document.body.appendChild(stack); return stack; }
  window.toast = function (msg, kind, ms) {
    ensure();
    var t = document.createElement('div');
    t.className = 'pm-toast pm-toast--' + (kind || 'info');
    t.innerHTML = '<span class="pm-toast-dot"></span><span>' + String(msg) + '</span>';
    stack.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); }, ms || 2600);
    setTimeout(function () { t.remove(); }, (ms || 2600) + 260);
  };
  function tone(freq, type, dur, gain) {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination); o.frequency.value = freq; o.type = type || 'sine';
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(gain || 0.1, ctx.currentTime + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.25));
      o.start(); o.stop(ctx.currentTime + (dur || 0.25) + 0.05);
    } catch (e) {}
  }
  window.PMAudio = {
    success: function () { tone(880, 'triangle', 0.18, 0.08); },
    alert: function () { tone(700, 'sine', 0.5, 0.13); }
  };
})();
