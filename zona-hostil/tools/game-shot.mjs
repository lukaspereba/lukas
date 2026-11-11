// Captura do jogo com ações scriptadas (depuração visual).
// Uso: node tools/game-shot.mjs saida.png "<js executado com __zh disponível>" [espera_s] [w] [h]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const [out, script = '', wait = '1.0', w = '1280', h = '720', base = 'http://localhost:5173'] = process.argv.slice(2);
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: Number(w), height: Number(h) } });
await ctx.addInitScript(() => localStorage.setItem('zona-hostil.settings', JSON.stringify({ version: 1, graphics: { preset: 'medio', renderScale: 0.8, shadows: 'medio', viewDistance: 700, antialias: false, fpsLimit: 0 }, gameplay: { camera: 'fps', fov: 90, headBob: 0.6, showFps: true, showDebug: false } })));
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error' || process.env.LOG) console.log('console:', m.text()); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${base}/?autoplay`);
await page.waitForFunction(() => window.__zh?.ready === true, null, { timeout: 180000 });
if (script) {
  const r = await page.evaluate(`(async () => { const z = window.__zh; const g = z.game; ${script} })()`);
  if (r !== undefined) console.log('result:', JSON.stringify(r));
}
await page.waitForTimeout(Number(wait) * 1000);
await page.screenshot({ path: out });
await browser.close();
console.log('ok', out);
