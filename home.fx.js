/* home.fx.js — the "overkill" animation layer for saadm.dev.
 *
 * Deliberately decoupled from the React app (home.app.js): it only touches the
 * DOM after render and adds a WebGL background, smooth scroll, scroll-driven
 * parallax, a custom cursor and magnetic buttons. Everything is feature-detected
 * and wrapped in try/catch, and the whole layer is skipped under
 * prefers-reduced-motion — so if a CDN lib fails to load or anything throws, the
 * plain (already-working) site is unaffected.
 *
 * Libraries (loaded via CDN in index.html): three (WebGL), gsap + ScrollTrigger,
 * @studio-freight/lenis (smooth scroll).
 */
(function () {
  'use strict';

  var REDUCE = false;
  try { REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var FINE = true;
  try { FINE = window.matchMedia('(pointer: fine)').matches; } catch (e) {}

  /* ============================================================ WebGL bg */
  function initWebGL() {
    var THREE = window.THREE;
    var canvas = document.createElement('canvas');
    canvas.id = 'fx-canvas';
    document.body.insertBefore(canvas, document.body.firstChild);

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 120);
    camera.position.z = 20;

    var COUNT = window.innerWidth < 760 ? 4200 : 9500;
    var positions = new Float32Array(COUNT * 3);
    var scales = new Float32Array(COUNT);
    for (var i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 70;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 46;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 46;
      scales[i] = Math.random();
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

    var mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uSize: { value: (renderer.getPixelRatio ? renderer.getPixelRatio() : 1) * 34 },
        uColorA: { value: new THREE.Color('#5e8eff') },
        uColorB: { value: new THREE.Color('#5eead4') },
      },
      vertexShader: [
        'attribute float aScale;',
        'uniform float uTime;',
        'uniform float uSize;',
        'varying float vA;',
        'void main(){',
        '  vec3 p = position;',
        '  p.y += sin(uTime*0.45 + position.x*0.25) * 0.8;',
        '  p.x += cos(uTime*0.30 + position.y*0.22) * 0.8;',
        '  vec4 mv = modelViewMatrix * vec4(p,1.0);',
        '  gl_Position = projectionMatrix * mv;',
        '  gl_PointSize = uSize * (0.35 + aScale) * (1.0 / -mv.z);',
        '  vA = aScale;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColorA;',
        'uniform vec3 uColorB;',
        'varying float vA;',
        'void main(){',
        '  float d = distance(gl_PointCoord, vec2(0.5));',
        '  if (d > 0.5) discard;',
        '  float a = smoothstep(0.5, 0.0, d);',
        '  vec3 col = mix(uColorA, uColorB, vA);',
        '  gl_FragColor = vec4(col, a * (0.40 + vA*0.55));',
        '}',
      ].join('\n'),
    });

    var points = new THREE.Points(geo, mat);
    scene.add(points);

    // ---- central 3D object: a glowing, breathing fresnel icosahedron ----
    var meshU = {
      uTime: { value: 0 },
      uA: { value: new THREE.Color('#5e8eff') },
      uB: { value: new THREE.Color('#5eead4') },
    };
    var meshMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: meshU,
      vertexShader: [
        'varying vec3 vN;',
        'varying vec3 vView;',
        'uniform float uTime;',
        'void main(){',
        '  vec3 p = position;',
        '  p += normal * sin(uTime*0.7 + position.y*0.6 + position.x*0.4) * 0.14;',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  vN = normalize(normalMatrix * normal);',
        '  vView = normalize(-mv.xyz);',
        '  gl_Position = projectionMatrix * mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uA;',
        'uniform vec3 uB;',
        'varying vec3 vN;',
        'varying vec3 vView;',
        'void main(){',
        '  float f = pow(1.0 - max(dot(normalize(vN), normalize(vView)), 0.0), 2.2);',
        '  vec3 col = mix(uA, uB, f);',
        '  gl_FragColor = vec4(col, f * 0.85 + 0.04);',
        '}',
      ].join('\n'),
    });
    var ICO = new THREE.IcosahedronGeometry(5.5, 1);
    var mesh = new THREE.Mesh(ICO, meshMat);
    scene.add(mesh);
    var wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(ICO),
      new THREE.LineBasicMaterial({ color: new THREE.Color('#7c9cff'), transparent: true, opacity: 0.16 })
    );
    scene.add(wire);
    // Composition: place the object as an off-centre accent (upper right) so the
    // hero copy stays clear, instead of a blob dead-centre behind the text.
    mesh.position.set(7.5, 2.5, -3);
    wire.position.copy(mesh.position);

    // ---- Cinematic bloom (post-processing) for a premium, glowing look ----
    var composer = null, useBloom = false;
    try {
      if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass) {
        renderer.setClearColor(0x06070c, 1); // opaque dark base so bloom reads richly
        composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(scene, camera));
        composer.addPass(new THREE.UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight), 0.9, 0.55, 0.0));
        useBloom = true;
      }
    } catch (e) { useBloom = false; }

    var mx = 0, my = 0, tx = 0, ty = 0, scrollN = 0;
    window.addEventListener('mousemove', function (e) {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    }, { passive: true });
    window.addEventListener('scroll', function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      scrollN = h > 0 ? (window.scrollY || window.pageYOffset || 0) / h : 0;
    }, { passive: true });

    var clock = new THREE.Clock();
    var rafId = 0;
    function tick() {
      var t = clock.getElapsedTime();
      mat.uniforms.uTime.value = t;
      tx += (mx - tx) * 0.04;
      ty += (my - ty) * 0.04;
      points.rotation.y = t * 0.035 + tx * 0.6 + scrollN * 1.4;
      points.rotation.x = ty * 0.4 + scrollN * 0.5;
      meshU.uTime.value = t;
      mesh.rotation.y = t * 0.07 + tx * 0.7;
      mesh.rotation.x = t * 0.05 + ty * 0.5;
      mesh.rotation.z = scrollN * 0.6;
      var ms = 1 + scrollN * 0.5 + Math.sin(t * 0.5) * 0.035;
      mesh.scale.setScalar(ms);
      wire.rotation.copy(mesh.rotation);
      wire.scale.copy(mesh.scale);
      camera.position.x = tx * 4.5;
      camera.position.y = -ty * 3.5;
      camera.position.z = 20 - scrollN * 8.5;
      camera.lookAt(scene.position);
      if (useBloom) composer.render(); else renderer.render(scene, camera);
      rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      if (composer) composer.setSize(window.innerWidth, window.innerHeight);
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { cancelAnimationFrame(rafId); }
      else { rafId = requestAnimationFrame(tick); }
    });
  }

  /* =================================================== Smooth scroll + GSAP */
  function initMotion() {
    var gsap = window.gsap;
    var ST = window.ScrollTrigger;
    var lenis = null;

    if (!REDUCE && window.Lenis) {
      lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true, wheelMultiplier: 1.0 });
      window.__lenis = lenis;
      if (gsap && ST) {
        lenis.on('scroll', ST.update);
        gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
        gsap.ticker.lagSmoothing(0);
      } else {
        var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
        requestAnimationFrame(raf);
      }
      // Anchor links should use Lenis so smooth scroll is consistent.
      document.addEventListener('click', function (e) {
        var a = e.target.closest && e.target.closest('a[href^="#"]');
        if (!a) return;
        var id = a.getAttribute('href');
        if (id && id.length > 1) {
          var el = document.querySelector(id);
          if (el) { e.preventDefault(); lenis.scrollTo(el, { offset: -70 }); }
        }
      });
    }

    if (gsap && ST && !REDUCE) {
      gsap.registerPlugin(ST);
      // Parallax the hero (transform only — the React CSS reveal still owns
      // opacity, so these never fight). The hero is a stable, non-reveal node.
      if (document.querySelector('.hero-photo')) {
        gsap.to('.hero-photo', {
          yPercent: -16, ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        });
      }
      if (document.querySelector('.hero-left')) {
        gsap.to('.hero-left', {
          yPercent: 9, ease: 'none',
          scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
        });
      }
      // Subtle depth parallax on each section's eyebrow tag as it scrolls past.
      gsap.utils.toArray('.section .section-tag').forEach(function (el) {
        gsap.fromTo(el, { y: 26 }, {
          y: -26, ease: 'none',
          scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true },
        });
      });
      // Keep triggers correct as the React app re-renders on view toggle.
      var ro = new MutationObserver(function () { ST.refresh(); });
      var root = document.getElementById('root');
      if (root) ro.observe(root, { childList: true, subtree: true });
    }
  }

  /* ====================================================== Custom cursor */
  function initCursor() {
    var dot = document.createElement('div'); dot.id = 'fx-cursor-dot';
    var ring = document.createElement('div'); ring.id = 'fx-cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);
    document.body.classList.add('fx-cursor-on');

    var mxp = window.innerWidth / 2, myp = window.innerHeight / 2, rx = mxp, ry = myp;
    window.addEventListener('mousemove', function (e) {
      mxp = e.clientX; myp = e.clientY;
      dot.style.transform = 'translate(' + mxp + 'px,' + myp + 'px)';
    }, { passive: true });
    (function loop() {
      rx += (mxp - rx) * 0.18; ry += (myp - ry) * 0.18;
      ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
      requestAnimationFrame(loop);
    })();

    var SEL = 'a, button, .btn, summary, .vt-pill, .project, .skill-chip, .tag';
    document.addEventListener('mouseover', function (e) {
      if (e.target.closest && e.target.closest(SEL)) document.body.classList.add('fx-hover');
    });
    document.addEventListener('mouseout', function (e) {
      if (e.target.closest && e.target.closest(SEL)) document.body.classList.remove('fx-hover');
    });
    window.addEventListener('mousedown', function () { document.body.classList.add('fx-down'); });
    window.addEventListener('mouseup', function () { document.body.classList.remove('fx-down'); });
  }

  /* ===================================================== Magnetic buttons */
  function initMagnetic() {
    var current = null;
    document.addEventListener('mousemove', function (e) {
      var btn = e.target.closest && e.target.closest('.btn');
      if (btn) {
        var r = btn.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.3;
        var y = (e.clientY - r.top - r.height / 2) * 0.45;
        btn.style.transform = 'translate(' + x + 'px,' + y + 'px)';
        if (current && current !== btn) current.style.transform = '';
        current = btn;
      } else if (current) {
        current.style.transform = '';
        current = null;
      }
    }, { passive: true });
  }

  /* ======================================================= 3D tilt cards */
  function initTilt() {
    var SEL = '.project, .skill-card';
    var current = null;
    function reset(el) { el.style.transform = ''; el.classList.remove('fx-tilting'); }
    document.addEventListener('mousemove', function (e) {
      var card = e.target.closest && e.target.closest(SEL);
      if (card) {
        if (current && current !== card) reset(current);
        current = card;
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.classList.add('fx-tilting');
        card.style.transform = 'perspective(900px) rotateX(' + (-py * 7).toFixed(2) +
          'deg) rotateY(' + (px * 9).toFixed(2) + 'deg) translateY(-4px)';
      } else if (current) {
        reset(current);
        current = null;
      }
    }, { passive: true });
  }

  /* ================================================================ boot */
  // React 18 may flush its first render a tick after home.app.js runs, so wait
  // for the hero to exist before wiring GSAP triggers to real DOM nodes.
  function whenContent(cb) {
    var tries = 0;
    (function check() {
      if (document.querySelector('.hero') || tries > 120) { cb(); return; }
      tries++;
      requestAnimationFrame(check);
    })();
  }

  function boot() {
    try { if (!REDUCE && window.THREE) initWebGL(); } catch (e) {}
    try { if (!REDUCE && FINE) initCursor(); } catch (e) {}
    try { if (FINE) initMagnetic(); } catch (e) {}
    try { if (!REDUCE && FINE) initTilt(); } catch (e) {}
    whenContent(function () { try { initMotion(); } catch (e) {} });
    document.documentElement.classList.add('fx-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
