/* st130: mobile pad — landscape letterbox + portrait under-canvas; ABXY X-square; L1/L2/R1/R2 */
(function () {
  'use strict';
  if (typeof matchMedia === 'undefined' || !matchMedia('(pointer: coarse)').matches) return;

  const KEY = {
    Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft', Right: 'ArrowRight',
    A: 'KeyZ', B: 'KeyX', X: 'KeyA', Y: 'KeyS',
    L1: 'KeyQ', R1: 'KeyW', L2: 'Digit1', R2: 'Digit2'
  };
  const held = new Map();

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

  const style = document.createElement('style');
  style.textContent = '#biboo-touch{position:absolute;inset:0;pointer-events:none;z-index:10000;display:none}#biboo-touch.on{display:block}#biboo-touch .zone{position:absolute;pointer-events:none;display:flex;flex-direction:column;align-items:stretch;gap:6px;box-sizing:border-box;padding:6px}#biboo-touch .sq{position:relative;width:100%;aspect-ratio:1;flex:0 0 auto;border:2px solid rgba(255,255,255,.4);border-radius:10px;background:rgba(12,12,18,.72)}#biboo-touch .cell{position:absolute;pointer-events:auto;touch-action:none;display:flex;align-items:center;justify-content:center;color:#fff;font:700 16px system-ui,sans-serif;user-select:none}#biboo-touch .cell:active,#biboo-touch .btn:active{background:rgba(240,180,76,.4)}#biboo-touch .cell.u{left:0;right:0;top:0;height:50%;clip-path:polygon(0 0,100% 0,50% 100%)}#biboo-touch .cell.d{left:0;right:0;bottom:0;height:50%;clip-path:polygon(50% 0,100% 100%,0 100%)}#biboo-touch .cell.l{left:0;top:0;bottom:0;width:50%;clip-path:polygon(0 0,100% 50%,0 100%)}#biboo-touch .cell.r{right:0;top:0;bottom:0;width:50%;clip-path:polygon(100% 0,100% 100%,0 50%)}#biboo-touch .xline{position:absolute;inset:0;pointer-events:none}#biboo-touch .xline::before,#biboo-touch .xline::after{content:"";position:absolute;left:50%;top:0;width:2px;height:100%;background:rgba(255,255,255,.28);transform-origin:center}#biboo-touch .xline::before{transform:translateX(-50%) rotate(45deg)}#biboo-touch .xline::after{transform:translateX(-50%) rotate(-45deg)}#biboo-touch .btn{flex:1 1 0;min-height:36px;border-radius:10px;border:2px solid rgba(255,255,255,.4);background:rgba(12,12,18,.72);color:#fff;font:700 18px system-ui,sans-serif;pointer-events:auto;touch-action:none;user-select:none;display:flex;align-items:center;justify-content:center}#biboo-touch.land .zone.left{left:0;top:0;bottom:0;width:min(18vw,160px);min-width:72px}#biboo-touch.land .zone.right{right:0;top:0;bottom:0;width:min(18vw,160px);min-width:72px}#biboo-touch.land .sq{flex:0 0 auto;max-height:38%}#biboo-touch.land .btn{flex:1 1 0}#biboo-touch.port .zone.left,#biboo-touch.port .zone.right{top:auto;bottom:0;height:min(36vh,42%);width:48%;padding:4px 4px max(8px,env(safe-area-inset-bottom))}#biboo-touch.port .zone.left{left:1%}#biboo-touch.port .zone.right{right:1%}#biboo-touch.port .sq{flex:1 1 auto;max-height:none}#biboo-touch.port .btn{flex:0 0 22%;min-height:40px}';
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'biboo-touch';
  root.innerHTML = '<div class="zone left"><div class="sq" aria-label="D-pad"><div class="xline"></div><div class="cell u" data-btn="Up">\u25b2</div><div class="cell d" data-btn="Down">\u25bc</div><div class="cell l" data-btn="Left">\u25c0</div><div class="cell r" data-btn="Right">\u25b6</div></div><div class="btn" data-btn="L1">L1</div><div class="btn" data-btn="L2">L2</div></div><div class="zone right"><div class="sq" aria-label="Face buttons"><div class="xline"></div><div class="cell u" data-btn="Y">Y</div><div class="cell d" data-btn="A">A</div><div class="cell l" data-btn="X">X</div><div class="cell r" data-btn="B">B</div></div><div class="btn" data-btn="R1">R1</div><div class="btn" data-btn="R2">R2</div></div>';

  const stage = document.getElementById('stage') || document.body;
  stage.appendChild(root);

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

  function isPortrait() {
    const r = stage.getBoundingClientRect();
    if (r.height > 40 && r.width > 40) return r.height >= r.width * 0.95;
    return matchMedia('(orientation: portrait)').matches;
  }

  function layout() {
    root.classList.add('on');
    const port = isPortrait();
    root.classList.toggle('port', port);
    root.classList.toggle('land', !port);
    const fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs && root.parentElement !== fs && (fs.id === 'stage' || fs.id === 'view')) {
      (fs.id === 'view' ? (document.getElementById('stage') || fs) : fs).appendChild(root);
    }
  }

  document.addEventListener('fullscreenchange', layout);
  document.addEventListener('webkitfullscreenchange', layout);
  addEventListener('resize', layout);
  addEventListener('orientationchange', () => setTimeout(layout, 120));
  layout();

  window.BibooMobile = {
    labels: {
      note: 'Mobile: D-pad + L1/L2 left, ABXY square + R1/R2 right. Portrait: under the screen. Landscape: letterbox sides.',
      map: {}
    }
  };
})();
