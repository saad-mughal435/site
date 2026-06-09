/* notifications.js - toast stack + audio cue. Exposes window.toast and window.WatadAudio. */
(function () {
  'use strict';
  var stack;
  function ensure() {
    if (stack) return stack;
    stack = document.createElement('div');
    stack.className = 'wtd-toast-stack';
    document.body.appendChild(stack);
    return stack;
  }
  window.toast = function (msg, kind, ms) {
    ensure();
    var t = document.createElement('div');
    t.className = 'wtd-toast ' + (kind || '');
    t.textContent = msg;
    stack.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; t.style.transition = 'all .25s ease'; }, ms || 2800);
    setTimeout(function () { t.remove(); }, (ms || 2800) + 300);
  };

  // Web Audio chime for new alarms - lifted from pos/js/kitchen.js
  window.WatadAudio = {
    alarm: function (severity) {
      try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var o = ctx.createOscillator(); var g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = severity === 'critical' ? 1100 : severity === 'urgent' ? 880 : 660;
        o.type = severity === 'critical' ? 'square' : 'sine';
        g.gain.setValueAtTime(0.001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (severity === 'critical' ? 0.55 : 0.35));
        o.start(); o.stop(ctx.currentTime + (severity === 'critical' ? 0.6 : 0.4));
        // double-pulse for critical
        if (severity === 'critical') setTimeout(function () { window.WatadAudio.alarm('urgent'); }, 250);
      } catch (e) { /* ignore */ }
    }
  };
})();
