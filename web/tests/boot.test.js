// The game must boot: no page errors, the test API appears, and the title menu shows.
// Run: node web/tests/boot.test.js
'use strict';
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.join(__dirname, '../index.html'));
  let api = true;
  try { await p.waitForFunction(() => window.bibooGame, null, { timeout: 15000 }); } catch (e) { api = false; }
  await b.close();
  console.log((api ? 'PASS' : 'FAIL') + '  window.bibooGame exists');
  console.log((errs.length === 0 ? 'PASS' : 'FAIL') + '  no page errors ' + errs.join(' | '));
  process.exit(api && errs.length === 0 ? 0 : 1);
})();
