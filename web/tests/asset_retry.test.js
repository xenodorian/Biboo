/* A beam image that fails to load once is retried, and the game still starts.
 * Run: NODE_PATH=$(npm root -g) node web/tests/asset_retry.test.js */
const path = require('path');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(), page = await b.newPage();
  let fails = 0;
  await page.route('**/assets/beams/cloud.png*', route => { if (fails < 2) { fails++; route.abort(); } else route.continue(); });
  await page.goto('file://' + path.resolve(__dirname, '../index.html'));
  const ok = await page.waitForFunction(() => window.bibooGame && document.getElementById('btn-start') && !document.getElementById('loading'), null, { timeout: 20000 }).then(() => true, () => false);
  const txt = await page.evaluate(() => (document.getElementById('loading') || {}).textContent || '');
  console.log(`${ok ? 'PASS' : 'FAIL'}  the game starts after the cloud beam image fails ${fails} times  ${ok ? '' : txt}`);
  await b.close(); process.exit(ok && fails === 2 ? 0 : 1);
})();
