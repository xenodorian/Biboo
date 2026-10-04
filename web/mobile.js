/* st132: mobile pad below the canvas; same clusters; no side overlay */
(function () {
  'use strict';
  if (typeof matchMedia === 'undefined' || !matchMedia('(pointer: coarse)').matches) return;

  const KEY = {
    Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft', Right: 'ArrowRight',
    A: 'KeyZ', B: 'KeyX', X: 'KeyA', Y: 'KeyS',
    L1: 'KeyQ', R1: 'KeyW', L2: 'Digit1', R2: 'Digit2'
  };
  const held = new Map();
  let lastL = 0, lastR = 0;
  const DBL = 320;

  function fire(code, down) {
    document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', {
      code: code, key: code, bubbles: true, cancelable: true
    }));
  }
  function press(btn, on) {
    const n = (held.get(btn) || 0) + (on ? 1 : -1);
    if (n > 0) held.set(btn, n); else held.delete(btn);
    if (on && n === 1) fire(KEY[btn], true);
    if (!on && n <= 0) fire(KEY[btn], false);
  }
  function shoulder(which, on) {
    if (!on) {
      press(which === 'L' ? 'L1' : 'R1', false);
      press(which === 'L' ? 'L2' : 'R2', false);
      return;
    }
    const now = performance.now();
    if (which === 'L') {
      if (now - lastL < DBL) { press('L2', true); lastL = 0; }
      else { press('L1', true); lastL = now; }
    } else {
      if (now - lastR < DBL) { press('R2', true); lastR = 0; }
      else { press('R1', true); lastR = now; }
    }
  }

  const hide = document.createElement('style');
  hide.textContent = '@media (pointer: coarse) { main > h1, main > .row, #inputmon { display: none !important; } main { padding: 0; max-width: none; margin: 0; } #stage { border: none; width: 100%; } }';
  document.head.appendChild(hide);

  const style = document.createElement('style');
  style.textContent = '#biboo-touch{position:relative;width:100%;box-sizing:border-box;pointer-events:none;z-index:20;display:none;background:#0c0c12;padding:8px 8px max(10px, env(safe-area-inset-bottom))}#biboo-touch.on{display:flex;flex-direction:row;align-items:stretch;gap:10px;min-height:min(42vh, 320px);height:min(42vh, 42dvh)}#biboo-touch .col{flex:1 1 0;min-width:0;pointer-events:none;display:flex;flex-direction:column;align-items:stretch;gap:8px}#biboo-touch .sq{position:relative;width:100%;flex:1 1 auto;min-height:0;border:2px solid rgba(255,255,255,.35);border-radius:12px;background:rgba(28,28,36,.9)}#biboo-touch .tri{position:absolute;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;color:#fff;font:700 20px system-ui,sans-serif;user-select:none}#biboo-touch .tri:active,#biboo-touch .btn:active{background:rgba(240,180,76,.4)}#biboo-touch .tri.u{left:0;right:0;top:0;height:50%;clip-path:polygon(0 0,100% 0,50% 100%)}#biboo-touch .tri.d{left:0;right:0;bottom:0;height:50%;clip-path:polygon(50% 0,100% 100%,0 100%)}#biboo-touch .tri.l{left:0;top:0;bottom:0;width:50%;clip-path:polygon(0 0,100% 50%,0 100%)}#biboo-touch .tri.r{right:0;top:0;bottom:0;width:50%;clip-path:polygon(100% 0,100% 100%,0 50%)}#biboo-touch .xline{position:absolute;inset:0;pointer-events:none}#biboo-touch .xline::before,#biboo-touch .xline::after{content:"";position:absolute;left:50%;top:0;width:2px;height:100%;background:rgba(255,255,255,.25);transform-origin:center}#biboo-touch .xline::before{transform:translateX(-50%) rotate(45deg)}#biboo-touch .xline::after{transform:translateX(-50%) rotate(-45deg)}#biboo-touch .stack{flex:1 1 auto;min-height:0;display:flex;flex-direction:column;gap:8px}#biboo-touch .btn{flex:1 1 0;min-height:0;border-radius:12px;border:2px solid rgba(255,255,255,.35);background:rgba(28,28,36,.9);color:#fff;font:700 22px system-ui,sans-serif;pointer-events:auto;touch-action:none;user-select:none;display:flex;align-items:center;justify-content:center}#biboo-touch .sh{flex:0.55 1 0}#stage:fullscreen,#stage:-webkit-full-screen{flex-direction:column !important;justify-content:flex-start !important}#stage:fullscreen #biboo-touch,#stage:-webkit-full-screen #biboo-touch{flex:1 1 auto;min-height:0;height:auto}#stage:fullscreen canvas,#stage:-webkit-full-screen canvas{flex:0 0 auto;width:min(100vw, calc(100vh * 4 / 3 * 0.58)) !important;height:auto !important;max-height:58vh !important}';
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'biboo-touch';
  root.innerHTML = '<div class="col left"><div class="sq"><div class="xline"></div><div class="tri u" data-btn="Up">\u25b2</div><div class="tri d" data-btn="Down">\u25bc</div><div class="tri l" data-btn="Left">\u25c0</div><div class="tri r" data-btn="Right">\u25b6</div></div><div class="btn sh" data-sh="L">L</div><div class="btn sh" data-sh="R">R</div></div><div class="col right"><div class="stack"><div class="btn" data-btn="A">A</div><div class="btn" data-btn="B">B</div><div class="btn" data-btn="X">X</div><div class="btn" data-btn="Y">Y</div></div></div>';

  const stage = document.getElementById('stage') || document.body;
  stage.appendChild(root);
  stage.style.display = 'flex';
  stage.style.flexDirection = 'column';

  function bind(el, onDown, onUp) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (_) {} onDown(e); });
    el.addEventListener('pointerup', e => { e.preventDefault(); onUp(e); });
    el.addEventListener('pointercancel', e => { e.preventDefault(); onUp(e); });
    el.addEventListener('lostpointercapture', e => { onUp(e); });
  }
  root.querySelectorAll('[data-btn]').forEach(el => {
    const b = el.getAttribute('data-btn');
    bind(el, () => press(b, true), () => press(b, false));
  });
  root.querySelectorAll('[data-sh]').forEach(el => {
    const w = el.getAttribute('data-sh');
    bind(el, () => shoulder(w, true), () => shoulder(w, false));
  });

  root.classList.add('on');

  function syncFs() {
    root.classList.add('on');
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs && root.parentElement !== fs && (fs.id === 'stage' || fs.id === 'view')) {
      (fs.id === 'view' ? (document.getElementById('stage') || fs) : fs).appendChild(root);
    }
  }
  document.addEventListener('fullscreenchange', syncFs);
  document.addEventListener('webkitfullscreenchange', syncFs);

  window.BibooMobile = {
    labels: {
      note: 'Mobile: pad below the screen. Left d-pad + L/R (double-tap L/R for L2/R2). Right A,B,X,Y top to bottom.',
      map: { L1: 'L', R1: 'R', L2: 'L\u00d72', R2: 'R\u00d72' }
    }
  };
})();
