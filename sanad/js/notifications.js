/* notifications.js - toast stack for Sanad. Exposes window.toast(msg, kind, ms) */
(function () {
  'use strict';
  var stack;
  function ensure() {
    if (stack) return stack;
    stack = document.createElement('div');
    stack.className = 'snd-toast-stack';
    document.body.appendChild(stack);
    return stack;
  }
  window.toast = function (msg, kind, ms) {
    ensure();
    var t = document.createElement('div');
    t.className = 'snd-toast ' + (kind || '');
    t.textContent = msg;
    stack.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateY(10px)'; t.style.transition = 'all .25s ease'; }, ms || 2400);
    setTimeout(function () { t.remove(); }, (ms || 2400) + 300);
  };
})();
