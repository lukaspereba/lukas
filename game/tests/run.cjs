// Teste em navegador real (Chromium headless): node tests/run.cjs <script.js> [w] [h]
const { chromium } = require('playwright'); const path = require('path');
const out = '/tmp/claude-0/-home-user/923f2325-a2ca-5cc9-9c8f-71c5ac56d563/scratchpad/shots/';
(async () => {
  const w = +process.argv[3] || 412, h = +process.argv[4] || 915;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--js-flags=--expose-gc'] });
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: w < 1000, deviceScaleFactor: 1 });
  const p = await ctx.newPage(); let errs = 0;
  p.on('console', (m) => { const t = m.text(); if (m.type() === 'error' || process.env.V) console.log('[c]', t.slice(0, 400)); }); p.on('pageerror', (e) => { errs++; if (errs < 12) console.log('[pageerror]', (e.stack || e.message).slice(0, 700)); });
  await p.goto('file:///home/user/lukas/game/dist/index.html'); await p.waitForFunction('window.__ready', null, { timeout: 240000 });
  const shot = (n) => p.screenshot({ path: out + n + '.png' }); const ev = (f, a) => p.evaluate(f, a); const sleep = (ms) => p.waitForTimeout(ms);
  await require(path.resolve(process.argv[2]))({ p, shot, ev, sleep }); console.log('pageerrors:', errs); await b.close();
})();
