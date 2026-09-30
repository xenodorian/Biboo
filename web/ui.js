/* Menus for Parry Perry: the one overlay panel (#start-menu) shows a "view" at a time.
 *
 *   main       Start / Resume / Retry, Moves, Gems, Overworld, Fullscreen (items come from api.mainItems())
 *   moves      the controls and the unlocked combos (rows come from api.moveRows())
 *   gems       stored gems with a Use button each (api.gemRows(), api.useGem(kind))
 *   message    a title, a line of text and a list of buttons (Game Over, Level Complete)
 *   dev        the Dev Console: cheat toggles and actions (api.devItems())
 *
 * Every view is made of real <button>s, so it works with a mouse, a finger, the keyboard and a pad:
 * game.js reads Up/Down/A/B from the keyboard and pad while a menu is open and calls nav(), activate()
 * and back() here. No game logic lives in this file; it only draws what game.js hands it.
 */
(function (root) {
  'use strict';
  const $ = id => document.getElementById(id);
  const UI = { api: null, view: null, opts: {}, idx: 0 };

  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function button(label, fn, cls, id) {
    const b = h('button', cls || '', label);
    b.type = 'button';
    if (id) b.id = id;
    b.addEventListener('click', ev => { ev.preventDefault(); if (!b.disabled) fn(); });
    return b;
  }

  UI.init = function (api) { UI.api = api; };
  UI.isOpen = () => { const m = $('start-menu'); return !!m && !m.hidden; };
  UI.buttons = () => [...document.querySelectorAll('#menu-view button:not(:disabled)')];

  UI.open = function (view, opts) {
    const menu = $('start-menu');
    if (!menu) return;
    UI.view = view;
    UI.opts = opts || UI.opts || {};
    const keep = UI.opts.keepIdx;
    menu.hidden = false;
    render();
    const bs = UI.buttons();
    UI.idx = keep != null ? Math.min(keep, bs.length - 1) : Math.max(0, bs.findIndex(b => b.classList.contains('primary')));
    if (bs[UI.idx]) bs[UI.idx].focus({ preventScroll: true });
    UI.opts.keepIdx = null;
  };
  UI.close = function () {
    const menu = $('start-menu');
    if (menu) menu.hidden = true;
    UI.view = null;
  };
  UI.refresh = function () { if (UI.isOpen()) { UI.opts.keepIdx = UI.idx; UI.open(UI.view, UI.opts); } };

  UI.nav = function (d) {
    const bs = UI.buttons();
    if (!bs.length) return;
    UI.idx = (UI.idx + d + bs.length) % bs.length;
    bs[UI.idx].focus({ preventScroll: true });
    bs[UI.idx].scrollIntoView({ block: 'nearest' });
  };
  UI.activate = function () {
    const bs = UI.buttons();
    if (bs[UI.idx]) bs[UI.idx].click();
  };
  // B or Escape: a sub-menu goes back to the main list; the main list closes (only if the game allows it)
  UI.back = function () {
    if (UI.view === 'moves' || UI.view === 'gems') { UI.open('main', { msg: UI.opts.msg }); return; }
    if (UI.api && UI.api.closeMenu) UI.api.closeMenu();
  };

  function render() {
    const api = UI.api, box = $('menu-view'), title = $('menu-title'), msg = $('menu-msg');
    if (!box) return;
    box.textContent = '';
    const hero = document.querySelector('#start-menu .hero');
    if (hero) hero.style.display = UI.view === 'main' || UI.view === 'message' ? '' : 'none';
    const o = UI.opts;
    if (UI.view === 'main') {
      title.textContent = o.title || 'Parry Perry';
      msg.textContent = o.msg != null ? o.msg : 'Defeat the goblins and orcs';
      const list = h('div', 'actions');
      for (const it of api.mainItems()) list.appendChild(button(it.label, it.fn, it.primary ? 'primary' : '', it.id));
      box.appendChild(list);
    } else if (UI.view === 'moves') {
      title.textContent = 'Moves';
      msg.textContent = api.padStatus ? api.padStatus() : '';
      box.appendChild(movesView(api));
    } else if (UI.view === 'gems') {
      title.textContent = 'Gems';
      msg.textContent = 'Gems you collect are stored here. Use one to fill a meter or heal.';
      box.appendChild(gemsView(api));
    } else if (UI.view === 'message') {
      title.textContent = o.title || '';
      msg.textContent = o.msg || '';
      const list = h('div', 'actions');
      for (const it of o.items || []) list.appendChild(button(it.label, it.fn, it.primary ? 'primary' : '', it.id));
      box.appendChild(list);
    } else if (UI.view === 'dev') {
      title.textContent = 'Dev Console';
      msg.textContent = 'Cheats for testing. Close with B, Escape or the last button.';
      const list = h('div', 'actions dev');
      for (const it of api.devItems()) {
        const b = button(it.state != null ? `${it.label}: ${it.state}` : it.label, () => { it.fn(); UI.refresh(); }, it.primary ? 'primary' : '');
        list.appendChild(b);
      }
      box.appendChild(list);
    }
  }

  function movesView(api) {
    const wrap = h('div', 'moves-wrap');
    const scroll = h('div', 'scroll menu-scroll');
    const rows = api.moveRows();
    let section = null, table = null;
    for (const r of rows) {
      if (r.section !== section) {
        section = r.section;
        table = h('table', 'moves-table');
        const head = h('tr');
        for (const t of ['Pad', 'Keyboard', 'Move', 'How']) head.appendChild(h('th', '', t));
        table.appendChild(head);
        scroll.appendChild(h('h3', '', section));
        scroll.appendChild(table);
      }
      const tr = h('tr');
      tr.appendChild(h('td', 'pad', r.pad));
      tr.appendChild(h('td', 'keys', r.keys));
      tr.appendChild(h('td', '', r.title));
      tr.appendChild(h('td', 'how', r.how));
      table.appendChild(tr);
    }
    if (api.moveNotes) for (const n of api.moveNotes()) wrap.appendChild(h('p', 'note', n));
    wrap.appendChild(scroll);
    const locked = api.lockedCount ? api.lockedCount() : 0;
    if (locked > 0) wrap.appendChild(h('p', 'note', `${locked} more moves are still locked. Smash the golden crates to find them.`));
    const list = h('div', 'actions');
    list.appendChild(button('Back', () => UI.open('main', { msg: UI.opts.msg }), 'primary'));
    wrap.appendChild(list);
    return wrap;
  }

  function gemsView(api) {
    const wrap = h('div', 'gems-wrap');
    const list = h('div', 'gem-list');
    for (const r of api.gemRows()) {
      const row = h('div', 'gem-row');
      const sw = h('span', 'gem-swatch'); sw.style.background = r.color;
      row.appendChild(sw);
      const name = h('span', 'gem-name', r.label);
      const cnt = h('span', 'gem-count', 'x ' + r.count);
      const note = h('span', 'gem-note', r.note || '');
      const use = button('Use', () => { api.useGem(r.kind); UI.refresh(); });
      use.disabled = !r.canUse;
      row.append(name, cnt, note, use);
      list.appendChild(row);
    }
    wrap.appendChild(list);
    const acts = h('div', 'actions');
    acts.appendChild(button('Back', () => UI.open('main', { msg: UI.opts.msg }), 'primary'));
    wrap.appendChild(acts);
    return wrap;
  }

  root.BibooUI = UI;
})(window);
