const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 412, height: 915 } });
  p.on('console', (m) => console.log('[c]', m.type(), m.text().slice(0, 500))); p.on('pageerror', (e) => console.log('[pageerror]', (e.stack || e.message).slice(0, 900)));
  await p.goto('file:///home/user/lukas/game/dist/index.html');
  for (let i = 0; i < 14; i++) { await p.waitForTimeout(5000); const s = await p.evaluate(() => ({ ready: !!window.__ready, msg: document.getElementById('ld-msg').textContent })); console.log(i * 5 + 5, JSON.stringify(s)); if (s.ready || /Erro/.test(s.msg)) break; }
  await b.close();
})();
