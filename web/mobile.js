/* st129: mobile pad — landscape side columns; portrait under-screen layout */
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
    document.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: code, key: code, bubbles: true, cancelable: true }));
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

  const style = document.createElement('style');
  style.textContent = '#biboo-touch{position:absolute;inset:0;pointer-events:none;z-index:10000;display:none}#biboo-touch.on{display:block}#biboo-touch .col{position:absolute;pointer-events:none;display:flex;flex-direction:column;align-items:center;padding:6px;gap:8px;box-sizing:border-box}#biboo-touch .sq{width:100%;aspect-ratio:1;position:relative;border:2px solid rgba(255,255,255,.35);border-radius:10px;background:rgba(20,20,28,.55)}#biboo-touch .tri{position:absolute;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;color:#fff;font:700 16px system-ui,sans-serif;user-select:none}#biboo-touch .tri:active,#biboo-touch .btn:active{background:rgba(240,180,76,.35)}#biboo-touch .tri.u{left:0;right:0;top:0;height:50%;clip-path:polygon(0 0,100% 0,50% 100%)}#biboo-touch .tri.d{left:0;right:0;bottom:0;height:50%;clip-path:polygon(50% 0,100% 100%,0 100%)}#biboo-touch .tri.l{left:0;top:0;bottom:0;width:50%;clip-path:polygon(0 0,100% 50%,0 100%)}#biboo-touch .tri.r{right:0;top:0;bottom:0;width:50%;clip-path:polygon(100% 0,100% 100%,0 50%)}#biboo-touch .face{position:absolute;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;color:#fff;font:700 18px system-ui,sans-serif;user-select:none}#biboo-touch .face.u{left:0;right:0;top:0;height:50%;clip-path:polygon(0 0,100% 0,50% 100%)}#biboo-touch .face.d{left:0;right:0;bottom:0;height:50%;clip-path:polygon(50% 0,100% 100%,0 100%)}#biboo-touch .face.l{left:0;top:0;bottom:0;width:50%;clip-path:polygon(0 0,100% 50%,0 100%)}#biboo-touch .face.r{right:0;top:0;bottom:0;width:50%;clip-path:polygon(100% 0,100% 100%,0 50%)}#biboo-touch .xline{position:absolute;inset:0;pointer-events:none}#biboo-touch .xline::before,#biboo-touch .xline::after{content:"";position:absolute;left:50%;top:0;width:2px;height:100%;background:rgba(255,255,255,.25);transform-origin:center}#biboo-touch .xline::before{transform:translateX(-50%) rotate(45deg)}#biboo-touch .xline::after{transform:translateX(-50%) rotate(-45deg)}#biboo-touch .btn{width:100%;border-radius:12px;border:2px solid rgba(255,255,255,.35);background:rgba(20,20,28,.55);color:#fff;font:700 20px system-ui,sans-serif;pointer-events:auto;touch-action:none;user-select:none;display:flex;align-items:center;justify-content:center}#biboo-touch .stack{width:100%;flex:1;display:flex;flex-direction:column;gap:8px;min-height:0}#biboo-touch .sh{flex:0 0 auto;height:18%;min-height:44px;max-height:72px}#biboo-touch.land .col.left{left:0;top:0;bottom:0;width:18%;max-width:160px;min-width:72px}#biboo-touch.land .col.right{right:0;top:0;bottom:0;width:18%;max-width:160px;min-width:72px}#biboo-touch.land .sq{max-height:42%}#biboo-touch.land .face-wrap{display:none}#biboo-touch.land .stack-abxy{display:flex}#biboo-touch.port .col.left,#biboo-touch.port .col.right{top:auto;bottom:0;height:32%;width:46%;max-width:none;min-width:0;justify-content:flex-end;padding:4px 6px 10px}#biboo-touch.port .col.left{left:2%}#biboo-touch.port .col.right{right:2%}#biboo-touch.port .sq{max-height:none;flex:1 1 auto;width:100%}#biboo-touch.port .sh{order:-1;height:28%;min-height:40px;max-height:56px;margin-bottom:4px}#biboo-touch.port .stack-abxy{display:none}#biboo-touch.port .face-wrap{display:block;flex:1 1 auto;width:100%}';
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'biboo-touch';
  root.innerHTML = '<div class="col left"><div class="btn sh" data-sh="L">L</div><div class="sq" id="dpad"><div class="xline"></div><div class="tri u" data-btn="Up">\u25b2</div><div class="tri d" data-btn="Down">\u25bc</div><div class="tri l" data-btn="Left">\u25c0</div><div class="tri r" data-btn="Right">\u25b6</div></div></div><div class="col right"><div class="btn sh" data-sh="R">R</div><div class="sq face-wrap" id="abxy"><div class="xline"></div><div class="face u" data-btn="Y">Y</div><div class="face d" data-btn="A">A</div><div class="face l" data-btn="X">X</div><div class="face r" data-btn="B">B</div></div><div class="stack stack-abxy"><div class="btn" data-btn="A">A</div><div class="btn" data-btn="B">B</div><div class="btn" data-btn="X">X</div><div class="btn" data-btn="Y">Y</div></div></div>';

  const stage = document.getElementById('stage') || document.body;
  stage.appendChild(root);

  function bind(el, onDown, onUp) {
    el.addEventListener('pointerdown', e => { e.preventDefault(); onDown(e); });
    el.addEventListener('pointerup', e => { e.preventDefault(); onUp(e); });
    el.addEventListener('pointercancel', e => { e.preventDefault(); onUp(e); });
    el.addEventListener('pointerleave', e => { e.preventDefault(); onUp(e); });
  }
  root.querySelectorAll('[data-btn]').forEach(el => {
    const b = el.getAttribute('data-btn');
    bind(el, () => press(b, true), () => press(b, false));
  });
  root.querySelectorAll('[data-sh]').forEach(el => {
    const w = el.getAttribute('data-sh');
    bind(el, () => shoulder(w, true), () => shoulder(w, false));
  });

  function isPortrait() {
    const r = stage.getBoundingClientRect();
    if (r.height > 40 && r.width > 40) return r.height >= r.width;
    return matchMedia('(orientation: portrait)').matches;
  }

  function layout() {
    root.classList.add('on');
    root.classList.toggle('port', isPortrait());
    root.classList.toggle('land', !isPortrait());
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs && root.parentElement !== fs && (fs.id === 'stage' || fs.id === 'view')) {
      (fs.id === 'view' ? (document.getElementById('stage') || fs) : fs).appendChild(root);
    }
  }

  document.addEventListener('fullscreenchange', layout);
  document.addEventListener('webkitfullscreenchange', layout);
  addEventListener('resize', layout);
  addEventListener('orientationchange', () => setTimeout(layout, 100));
  layout();

  window.BibooMobile = {
    labels: {
      note: 'Mobile: portrait = L/R above pads under screen; landscape = side columns. Double-tap L/R for L2/R2. Same-side combos are sequential.',
      map: { L1: 'L', R1: 'R', L2: 'L\u00d72', R2: 'R\u00d72' }
    }
  };
})();
