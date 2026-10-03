/* st127: Moves: Mobile guide in pause menu */
(function () {
  function patch() {
    if (!window.BibooUI) return false;
    const UI = window.BibooUI;
    const _init = UI.init;
    UI.init = function (api) {
      const origMain = api.mainItems;
      const origRows = api.moveRows;
      const origNotes = api.moveNotes;
      api.mainItems = function () {
        const items = origMain();
        const i = items.findIndex(x => /Moves: Keyboard/i.test(x.label));
        const entry = { label: 'Moves: Mobile', fn: () => UI.open('moves', { msg: UI.opts.msg, device: 'mobile' }) };
        if (i >= 0) items.splice(i + 1, 0, entry);
        else items.push(entry);
        return items;
      };
      if (origRows) {
        api.moveRows = function () {
          const rows = origRows();
          if (UI.opts.device !== 'mobile') return rows;
          return rows.map(r => {
            const o = Object.assign({}, r);
            let p = o.pad || '';
            if (o.move === 'meter_charge') p = 'L-R (tap L then R, or hold both)';
            p = p.replace(/L1\+R1/g, 'L-R').replace(/L1/g, 'L').replace(/R1/g, 'R').replace(/L2/g, 'L\u00d72').replace(/R2/g, 'R\u00d72');
            // same-side face chords shown as sequences
            p = p.replace(/X\+A/g, 'X-A').replace(/A\+X/g, 'A-X').replace(/X\+Y/g, 'X-Y').replace(/Y\+X/g, 'Y-X');
            p = p.replace(/A\+B/g, 'A-B').replace(/B\+A/g, 'B-A');
            o.pad = p;
            return o;
          });
        };
      }
      if (origNotes) {
        api.moveNotes = function (dev) {
          if (dev === 'mobile') return [
            'Mobile: left = d-pad + L/R (double-tap L = L2, double-tap R = R2). Right = A, B, X, Y top to bottom. Same-side combos are sequential. Open Fullscreen so the side columns sit in the letterbox.'
          ];
          return origNotes(dev);
        };
      }
      return _init.call(UI, api);
    };
    const _open = UI.open;
    UI.open = function (view, opts) {
      _open.call(UI, view, opts);
      if (view === 'moves' && UI.opts && UI.opts.device === 'mobile') {
        const title = document.getElementById('menu-title');
        const msg = document.getElementById('menu-msg');
        if (title) title.textContent = 'Moves: Mobile';
        if (msg) msg.textContent = 'Touch layout: d-pad+L/R left, A B X Y right (top to bottom). Same-side = sequential.';
        document.querySelectorAll('.moves-table th').forEach(th => {
          if (th.textContent === 'Gamepad' || th.textContent === 'Keyboard') th.textContent = 'Mobile';
        });
      }
    };
    return true;
  }
  if (!patch()) document.addEventListener('DOMContentLoaded', patch);
})();
