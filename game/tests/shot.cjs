// Captura de telas do mundo para validação visual. Uso: node tests/shot.cjs '[["nome",x,y,z,tx,ty,tz],...]' [w] [h]
const { chromium } = require('playwright');
const out = '/tmp/claude-0/-home-user/923f2325-a2ca-5cc9-9c8f-71c5ac56d563/scratchpad/shots/';
(async () => {
  const views = JSON.parse(process.argv[2]); const w = +process.argv[3] || 960, h = +process.argv[4] || 540;
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('console', (m) => console.log('[c]', m.text().slice(0, 300))); p.on('pageerror', (e) => console.log('[err]', e.message.slice(0, 600)));
  await p.goto('file:///home/user/lukas/game/dist/index.html'); await p.waitForFunction('window.__ready', null, { timeout: 180000 });
  for (const [name, ...v] of views) { const st = await p.evaluate((v) => { const G = window.__G; const hh = (x, z) => G.terr.height(x, z); const a = v.slice(); a[1] += hh(a[0], a[2]); a[4] += hh(a[3], a[5]); return window.__shot(...a); }, v); await p.screenshot({ path: out + name + '.png' }); console.log(name, JSON.stringify(st)); }
  await b.close();
})();
