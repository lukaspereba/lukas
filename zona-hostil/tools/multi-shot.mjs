// Várias capturas numa única carga do jogo. Uso: node tools/multi-shot.mjs saida_prefixo specs.json [w] [h]
// specs: [{ "nome": "x", "js": "código com z/g disponíveis", "espera": 1.5 }]
import { readFileSync } from 'node:fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const [prefix, specFile, w = '960', h = '540', base = 'http://localhost:5173'] = process.argv.slice(2);
const specs = JSON.parse(readFileSync(specFile, 'utf8'));
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
await page.addInitScript(() => localStorage.setItem('zona-hostil.settings', JSON.stringify({ version: 1, graphics: { preset: 'medio', renderScale: 1, shadows: 'medio', viewDistance: 700, antialias: false, fpsLimit: 0, dynamicRes: false }, gameplay: { camera: 'tps', fov: 90, showFps: false } })));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${base}/?autoplay`);
await page.waitForFunction(() => window.__zh?.ready === true, null, { timeout: 240000 });
await page.addStyleTag({ content: '.zh-hud{display:none!important}' });
for (const s of specs) {
  const r = await page.evaluate(`(async () => { const z = window.__zh; const g = z.game; ${s.js} })()`);
  if (r !== undefined) console.log(s.nome, JSON.stringify(r));
  await page.waitForTimeout((s.espera ?? 1.5) * 1000);
  await page.screenshot({ path: `${prefix}${s.nome}.png`, timeout: 180000 });
}
await browser.close();
console.log('ok', specs.length);
