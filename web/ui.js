/* Menus for Perry Riposte: the one overlay panel (#start-menu) shows a "view" at a time.
 *
 *   main       Start / Resume / Retry, Moves, Items, Overworld, Fullscreen (items come from api.mainItems())
 *   moves      the controls and the unlocked combos (rows come from api.moveRows())
 *   gems       stored gems with a Use button each (api.gemRows(), api.useGem(kind))
 *   message    a title, a line of text and a list of buttons (Game Over, Level Complete)
 *   dev        the Cheats menu: cheat toggles and actions (api.devItems())
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
    if (UI.view !== view) { UI.ridx = 0; UI.showInfo = false; }
    UI.view = view;
    UI.opts = opts || UI.opts || {};
    const keep = UI.opts.keepIdx;
    menu.hidden = false;
    render();
    const bs = UI.buttons();
    UI.idx = keep != null ? Math.min(keep, bs.length - 1) : Math.max(0, bs.findIndex(b => b.classList.contains('primary')));
    if (bs[UI.idx]) bs[UI.idx].focus({ preventScroll: true });
    UI.opts.keepIdx = null;
    if (rowMode()) markRow(false);
  };
  UI.close = function () {
    const menu = $('start-menu');
    if (menu) menu.hidden = true;
    UI.view = null;
  };
  UI.refresh = function () { if (UI.isOpen()) { UI.opts.keepIdx = UI.idx; UI.open(UI.view, UI.opts); } };

  // Items, Moves and the shop have a row cursor: Up and Down walk every row (even one whose button is greyed out), A presses the row's
  // button, and Y (or a tap on the row) shows what the row does. The Back button is the last stop.
  const rowMode = () => UI.view === 'moves' || UI.view === 'gems' || UI.view === 'shop';
  const stops = () => [...document.querySelectorAll('#menu-view [data-info], #menu-view .actions button')];
  function markRow(scroll) {
    const st = stops();
    if (!st.length) return;
    UI.ridx = Math.max(0, Math.min(UI.ridx || 0, st.length - 1));
    st.forEach((e, i) => e.classList.toggle('cur', i === UI.ridx));
    const cur = st[UI.ridx], b = cur.tagName === 'BUTTON' ? cur : cur.querySelector('button:not(:disabled)');
    if (b) b.focus({ preventScroll: true }); else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    if (scroll) cur.scrollIntoView({ block: 'nearest' });
    const box = document.getElementById('info-box');
    if (box) { const t = UI.showInfo ? cur.getAttribute('data-info') : null; box.textContent = t || (UI.showInfo ? 'Nothing to describe here.' : 'Y: what does this do?'); box.classList.toggle('on', !!UI.showInfo); }
  }
  UI.info = function () { if (!rowMode()) return; UI.showInfo = !UI.showInfo; markRow(false); };
  UI.nav = function (d) {
    if (rowMode()) { const n = stops().length; if (n) { UI.ridx = ((UI.ridx || 0) + d + n) % n; markRow(true); } return; }
    const bs = UI.buttons();
    if (!bs.length) return;
    UI.idx = (UI.idx + d + bs.length) % bs.length;
    bs[UI.idx].focus({ preventScroll: true });
    bs[UI.idx].scrollIntoView({ block: 'nearest' });
  };
  UI.activate = function () {
    if (rowMode()) {
      const cur = stops()[UI.ridx || 0];
      const b = cur && (cur.tagName === 'BUTTON' ? cur : cur.querySelector('button'));
      if (b && !b.disabled) b.click();
      return;
    }
    const bs = UI.buttons();
    if (bs[UI.idx]) bs[UI.idx].click();
  };
  // B or Escape: a sub-menu goes back to the main list; the main list closes (only if the game allows it)
  UI.back = function () {
    if (UI.view === 'moves' || UI.view === 'gems' || UI.view === 'shop') {
      if (UI.view === 'shop' && UI.opts.back) { UI.opts.back(); return; } UI.open('main', { msg: UI.opts.msg }); return; }
    if (UI.api && UI.api.closeMenu) UI.api.closeMenu();
  };

  function render() {
    const api = UI.api, box = $('menu-view'), title = $('menu-title'), msg = $('menu-msg');
    if (!box) return;
    box.textContent = '';
    const hero = document.querySelector('#start-menu .hero');
    const smenu = $('start-menu'); if (smenu) smenu.classList.toggle('title', UI.view === 'main' && !!(api.isTitle && api.isTitle()));
    if (smenu) smenu.classList.toggle('story', UI.view === 'message' && !!UI.opts.story);   // story pages sit low so the scene shows
    if (hero) hero.style.display = (UI.view === 'main' && !(api.isTitle && api.isTitle())) || (UI.view === 'message' && !UI.opts.story) ? '' : 'none';
    const o = UI.opts;
    if (UI.view === 'main') {
      title.textContent = o.title || 'Parrying Perry';
      msg.textContent = o.msg != null ? o.msg : 'Defeat the goblins and orcs';
      const list = h('div', 'actions');
      for (const it of api.mainItems()) list.appendChild(button(it.label, it.fn, it.primary ? 'primary' : '', it.id));
      box.appendChild(list);
    } else if (UI.view === 'moves') {
      title.textContent = UI.opts.device === 'keys' ? 'Moves: Keyboard' : 'Moves: Gamepad';
      msg.textContent = UI.opts.device === 'keys' ? '' : (api.padStatus ? api.padStatus() : '');
      box.appendChild(movesView(api));
    } else if (UI.view === 'gems') {
      title.textContent = 'Items';
      msg.textContent = 'Items you collect are stored here. Use one to fill a meter or heal. Press Y on a row to see what it does.';
      box.appendChild(gemsView(api));
    } else if (UI.view === 'shop') {
      title.textContent = 'Bone Merchant';
      msg.textContent = o.msg || '';
      box.appendChild(shopView(api));
    } else if (UI.view === 'message') {
      title.textContent = o.title || '';
      msg.textContent = o.msg || '';
      const list = h('div', 'actions');
      for (const it of o.items || []) list.appendChild(button(it.label, it.fn, it.primary ? 'primary' : '', it.id));
      box.appendChild(list);
    } else if (UI.view === 'dev') {
      title.textContent = 'Cheats';
      msg.textContent = 'Close with B, Escape or the last button.';
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
    const keys = UI.opts.device === 'keys', rows = api.moveRows();
    let section = null, table = null;
    for (const r of rows) {
      if (r.section !== section) {
        section = r.section;
        table = h('table', 'moves-table');
        const head = h('tr');
        for (const t of [keys ? 'Keyboard' : 'Gamepad', 'Move', 'How']) head.appendChild(h('th', '', t));
        table.appendChild(head);
        scroll.appendChild(h('h3', '', section));
        scroll.appendChild(table);
      }
      const tr = h('tr'); tr.setAttribute('data-info', r.info || r.how || ''); tr.addEventListener('click', () => { UI.ridx = stops().indexOf(tr); UI.showInfo = true; markRow(false); });
      tr.appendChild(h('td', keys ? 'keys' : 'pad', keys ? r.keys : r.pad));
      tr.appendChild(h('td', '', r.title));
      tr.appendChild(h('td', 'how', r.how));
      table.appendChild(tr);
    }
    if (api.moveNotes) for (const n of api.moveNotes(keys ? 'keys' : 'pad')) wrap.appendChild(h('p', 'note', n));
    wrap.appendChild(scroll);
    wrap.appendChild(h('p', 'note info-box', 'Y: what does this do?')).id = 'info-box';
    const locked = api.lockedCount ? api.lockedCount() : 0;
    if (locked > 0) wrap.appendChild(h('p', 'note', `${locked} more moves are still locked. Buy Scrolls and Mutagens from the Bone Merchant on the overworld.`));
    const list = h('div', 'actions');
    list.appendChild(button('Back', () => UI.open('main', { msg: UI.opts.msg }), 'primary'));
    wrap.appendChild(list);
    return wrap;
  }

  // a 32px pixel-art icon cut from the item sheets (api.sprite returns css for a name: leaf, bone, powder, quartz, garnet, diamond)
  function icon(api, name) {
    const sp = api.sprite ? api.sprite(name) : null, e = h('span', 'item-icon');
    if (sp) Object.assign(e.style, sp); else e.classList.add('plain');
    return e;
  }
  function shopView(api) {
    const wrap = h('div', 'shop-wrap');
    const bal = h('div', 'shop-balance'); bal.appendChild(icon(api, 'leaf')); bal.appendChild(h('span', '', ' ' + api.leaves() + ' Leaves'));
    wrap.appendChild(bal);
    const scroll = h('div', 'scroll menu-scroll shop-scroll');
    for (const sec of api.shopRows()) {
      scroll.appendChild(h('h3', '', sec.title));
      for (const r of sec.rows) {
        const row = h('div', 'shop-row' + (r.owned ? ' owned' : '')); row.setAttribute('data-info', r.info || r.desc || ''); row.addEventListener('click', ev => { if (ev.target.tagName === 'BUTTON') return; UI.ridx = stops().indexOf(row); UI.showInfo = true; markRow(false); });
        row.appendChild(icon(api, r.sprite));
        const info = h('span', 'shop-info');
        info.appendChild(h('b', '', r.label));
        info.appendChild(h('small', '', r.desc + (r.have ? ' (' + r.have + ')' : '')));
        if (r.note) info.appendChild(h('small', 'shop-note', r.note));
        row.appendChild(info);
        const b = button(r.owned ? 'Owned' : r.price + ' Leaves', () => { const m = api.buy(r.key); UI.opts.msg = m || ''; UI.open('shop', UI.opts); }, '', 'buy-' + r.key);
        b.disabled = !r.canBuy;
        row.appendChild(b);
        scroll.appendChild(row);
      }
    }
    wrap.appendChild(scroll);
    wrap.appendChild(h('p', 'note info-box', 'Y: what does this do?')).id = 'info-box';
    const acts = h('div', 'actions');
    acts.appendChild(button('Leave the shop', () => { if (UI.opts.back) UI.opts.back(); else UI.api.closeMenu(); }, 'primary', 'btn-shop-back'));
    wrap.appendChild(acts);
    return wrap;
  }

  function gemsView(api) {
    const wrap = h('div', 'gems-wrap');
    const list = h('div', 'gem-list');
    for (const r of api.gemRows()) {
      const row = h('div', 'gem-row'); row.setAttribute('data-info', r.info || ''); row.addEventListener('click', ev => { if (ev.target.tagName === 'BUTTON') return; UI.ridx = stops().indexOf(row); UI.showInfo = true; markRow(false); });
      row.appendChild(icon(api, r.sprite));
      const name = h('span', 'gem-name', r.label);
      const cnt = h('span', 'gem-count', 'x ' + r.count);
      const note = h('span', 'gem-note', r.note || '');
      const use = button('Use', () => { api.useGem(r.kind); UI.refresh(); });
      use.disabled = !r.canUse;
      row.append(name, cnt, note, use);
      list.appendChild(row);
    }
    wrap.appendChild(list);
    wrap.appendChild(h('p', 'note info-box', 'Y: what does this do?')).id = 'info-box';
    const acts = h('div', 'actions');
    acts.appendChild(button('Back', () => UI.open('main', { msg: UI.opts.msg }), 'primary'));
    wrap.appendChild(acts);
    return wrap;
  }

  root.BibooUI = UI;
})(window);
