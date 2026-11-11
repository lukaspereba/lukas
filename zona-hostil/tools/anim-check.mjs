// Folha de contato das animações EM JOGO (entrada injetada, câmera lateral fixa).
// Uso: node tools/anim-check.mjs saida.png
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const out = process.argv[2] ?? 'anim-check.png';
const base = process.argv[3] ?? 'http://localhost:5173';
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 480, height: 400 } });
await page.addInitScript(() => localStorage.setItem('zona-hostil.settings', JSON.stringify({ version: 1, graphics: { preset: 'medio', renderScale: 1, shadows: 'medio', viewDistance: 500, antialias: false, fpsLimit: 0 }, gameplay: { camera: 'tps', fov: 90, headBob: 0.6, showFps: false, showDebug: false } })));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${base}/?autoplay`);
await page.waitForFunction(() => window.__zh?.ready === true, null, { timeout: 180000 });
await page.addStyleTag({ content: '.zh-hud{display:none!important}' });
// câmera lateral que acompanha o jogador
await page.evaluate(() => {
  const g = window.__zh.game;
  g.rig.update = function (dt, alpha, p) {
    this.feet.lerpVectors(p.prevPosition, p.position, alpha);
    const c = this.camera;
    c.position.set(this.feet.x + 3.4, this.feet.y + 1.1, this.feet.z);
    c.lookAt(this.feet.x, this.feet.y + 0.75, this.feet.z);
  };
});
const shots = [];
async function scene(label, setup, seconds, frames = 3) {
  await page.evaluate((code) => new Function(code)(), setup);
  for (let i = 0; i < frames; i++) {
    await page.waitForTimeout((seconds * 1000) / frames);
    shots.push({ label, buf: await page.screenshot() });
  }
}
const reset = `const g=window.__zh.game; const I=g.input; I.lastSource='gamepad'; I.moveX=0; I.moveY=0; I.sprintLatch=false;`;
await scene('idle', `${reset} g.player.respawn(g.layout.spawn.clone(), 0);`, 1.5);
await scene('walk', `${reset} I.moveY=0.4;`, 1.2);
await scene('run', `${reset} I.moveY=1;`, 1.2);
await scene('sprint', `${reset} I.moveY=1; I.sprintLatch=true;`, 1.2);
await scene('slide', `${reset} I.moveY=1; I.sprintLatch=true; I.tap('crouch');`, 0.6);
await scene('crouch idle', `${reset} if (g.player.stance!=='crouch') I.tap('crouch');`, 1.2);
await scene('crouch walk', `${reset} I.moveY=1;`, 1.2);
await scene('strafe', `${reset} I.tap('crouch'); I.moveX=1;`, 1.2);
await scene('back', `${reset} I.moveY=-1;`, 1.2);
await scene('jump', `${reset} I.moveY=1; I.tap('jump');`, 0.6);
await scene('prone crawl', `${reset} I.tap('prone'); setTimeout(()=>{I.moveY=1}, 900);`, 2.4);
await browser.close();
// monta grade com sharp-free: usa canvas do próprio Playwright? -> salva PNGs e monta via Python
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('/tmp/claude-0/animchk', { recursive: true });
shots.forEach((s, i) => writeFileSync(`/tmp/claude-0/animchk/${String(i).padStart(2, '0')}_${s.label.replace(/ /g, '_')}.png`, s.buf));
console.log('ok', shots.length, out);
