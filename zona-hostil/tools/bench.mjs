// Medição de desempenho reproduzível (navegador real). Uso: node tools/bench.mjs [url] [rótulo]
// Mede tempo de quadro em cena fixa. ATENÇÃO: neste contêiner o WebGL roda na CPU (SwiftShader),
// então os números servem para COMPARAR versões, não representam um celular com GPU.
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const url = process.argv[2] ?? 'http://localhost:5173/';
const label = process.argv[3] ?? '';
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: Number(process.env.BW ?? 480), height: Number(process.env.BH ?? 270) } });
await page.addInitScript(() => localStorage.setItem('zona-hostil.settings', JSON.stringify({ version: 1, graphics: { preset: 'medio', renderScale: 1, shadows: 'medio', viewDistance: 700, antialias: false, fpsLimit: 0, dynamicRes: false }, gameplay: { camera: 'tps', fov: 90, headBob: 0.6, showFps: false, showDebug: false } })));
await page.goto(url + (url.includes('?') ? '&' : '?') + 'autoplay');
await page.waitForFunction(() => window.__zh?.ready === true, null, { timeout: 240000 });
const res = await page.evaluate(async () => {
  const g = window.__zh.game;
  const views = [['spawn', 0, -0.1], ['norte', Math.PI, -0.05]];
  const out = {};
  for (const [name, yaw, pitch] of views) {
    window.__zh.setLook(yaw, pitch);
    for (let i = 0; i < 20; i++) await new Promise((r) => requestAnimationFrame(r));
    const t = [];
    let last = performance.now();
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      const now = performance.now();
      t.push(now - last);
      last = now;
    }
    t.sort((a, b) => a - b);
    const inf = g.renderer.info;
    out[name] = { mediana_ms: +t[45].toFixed(1), p95_ms: +t[85].toFixed(1), draw_calls: inf.render.calls, triangulos_k: Math.round(inf.render.triangles / 1000) };
  }
  out.geometrias = g.renderer.info.memory.geometries;
  out.texturas = g.renderer.info.memory.textures;
  return out;
});
console.log(JSON.stringify({ label, ...res }));
await browser.close();
