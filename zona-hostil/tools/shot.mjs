// Captura de tela do visualizador: node tools/shot.mjs "<query>" saida.png [w] [h]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const [query, out, w = '900', h = '900', base = 'http://localhost:5173'] = process.argv.slice(2);
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
page.on('console', (m) => { if (m.type() === 'error' || process.env.LOG) console.log('console:', m.text()); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${base}/viewer.html?${query}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
await page.screenshot({ path: out });
await browser.close();
console.log('ok', out);
