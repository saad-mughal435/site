/* notifications.js - Marsad toast stack + Web Audio cue on SLA breach. */
(function () {
  'use strict';
  var stack;
  function ensure() {
    if (stack) return stack;
    stack = document.createElement('div');
    stack.className = 'mrs-toasts';
    document.body.appendChild(stack);
    return stack;
  }
  window.toast = function (msg, kind, ms) {
    ensure();
    var t = document.createElement('div');
    t.className = 'mrs-toast ' + (kind || '');
    t.textContent = msg;
    stack.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; }, ms || 2500);
    setTimeout(function () { t.remove(); }, (ms || 2500) + 300);
  };
  window.MarsadAudio = {
    sla: function () {
      try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var o = ctx.createOscillator(); var g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 760;
        o.type = 'sine';
        g.gain.setValueAtTime(0.001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.14, ctx.currentTime + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        o.start(); o.stop(ctx.currentTime + 0.55);
      } catch (e) {}
    },
    delivered: function () {
      try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var o = ctx.createOscillator(); var g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 1020;
        o.type = 'triangle';
        g.gain.setValueAtTime(0.001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        o.start(); o.stop(ctx.currentTime + 0.20);
      } catch (e) {}
    }
  };
})();
