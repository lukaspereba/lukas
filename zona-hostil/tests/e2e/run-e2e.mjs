// Teste ponta-a-ponta em navegador real (Chromium headless + WebGL por SwiftShader).
// Uso: npm run build && npm run test:e2e   (sobe `vite preview` automaticamente)
// Saída: capturas em tests/e2e/output/ e resumo no terminal; código de saída != 0 em falha.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let pw;
try {
  pw = require('playwright');
} catch {
  pw = require('/opt/node-tools/node_modules/playwright');
}

const OUT = new URL('./output/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const PORT = 4173 + Math.floor(Math.random() * 500);
const BASE = process.env.ZH_URL ?? `http://localhost:${PORT}`;
const results = [];
const errors = [];

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function startServer() {
  if (process.env.ZH_URL) return null;
  const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'pipe' });
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE);
      if (r.ok) return srv;
    } catch {
      /* aguardando */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('servidor de preview não subiu');
}

const LOW = JSON.stringify({
  version: 1,
  graphics: { preset: 'baixo', renderScale: 0.5, shadows: 'baixo', viewDistance: 400, antialias: false, fpsLimit: 0 },
  gameplay: { camera: 'fps', fov: 90, headBob: 0.6, showFps: true, showDebug: true },
});

async function newGame(browser, opts = {}) {
  const ctx = await browser.newContext(opts.context ?? { viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript((s) => localStorage.setItem('zona-hostil.settings', s), opts.settings ?? LOW);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`);
  });
  await page.goto(`${BASE}/${opts.query ?? ''}`);
  await page.waitForFunction(() => window.__zh?.ready === true, null, { timeout: 180000 });
  return { ctx, page };
}

const state = (page) => page.evaluate(() => window.__zh.state());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** espera tempo de SIMULAÇÃO (o SwiftShader pode rodar a poucos FPS) */
async function simWait(page, seconds) {
  await page.evaluate(
    (s) =>
      new Promise((res) => {
        const g = window.__zh.game;
        let acc = 0;
        let last = performance.now();
        const tick = () => {
          const now = performance.now();
          acc += Math.min(0.1, (now - last) / 1000);
          last = now;
          if (acc >= s) res(null);
          else requestAnimationFrame(tick);
        };
        void g;
        requestAnimationFrame(tick);
      }),
    seconds,
  );
}

/** Lê o canvas WebGL e verifica se há variação de cor (detecta quadros pretos). */
async function notBlack(page) {
  const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 400, height: 300 } });
  const sharp = buf.length;
  return sharp > 8000; // PNG de área uniforme preta é minúsculo
}

async function hold(page, key, seconds) {
  await page.keyboard.down(key);
  await simWait(page, seconds);
  await page.keyboard.up(key);
}

async function main() {
  const srv = await startServer();
  const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    // ------------------------------------------------ desktop
    const { page, ctx } = await newGame(browser);
    await page.screenshot({ path: OUT + '01-tela-inicial.png' });
    check('tela inicial carregada', (await state(page)).screen === 'title');
    // modo desenvolvedor: 5 toques no logo -> código; errado é recusado, "alex" libera
    const tapLogo = async () => {
      for (let i = 0; i < 5; i++) await page.click('.zh-title .zh-logo');
    };
    await tapLogo();
    await page.fill('#zh-dev-code', 'Alex');
    await page.click('.zh-code button[type=submit]');
    await page.waitForTimeout(300);
    const wrongMsg = await page.textContent('.zh-code-msg');
    const devBtnHidden = await page.evaluate(() => getComputedStyle(document.querySelector('button[data-dev]')).display === 'none');
    check('código errado ("Alex") não libera o modo dev', /incorreto/.test(wrongMsg ?? '') && devBtnHidden, wrongMsg ?? '');
    const pwType = await page.getAttribute('#zh-dev-code', 'type');
    check('código não aparece na tela (campo de senha)', pwType === 'password', pwType ?? '');
    await page.fill('#zh-dev-code', 'alex');
    await page.click('.zh-code button[type=submit]');
    await page.waitForTimeout(400);
    check('código "alex" abre o painel do desenvolvedor', await page.isVisible('.zh-dev .zh-fields'), '');
    await page.check('#zh-dev-fly');
    await page.click('.zh-dev [data-a=close]');
    await page.evaluate(() => window.__zh.play());
    await simWait(page, 0.5);
    const fy0 = (await state(page)).pos[1];
    await hold(page, 'Space', 1.0);
    const fy1 = (await state(page)).pos[1];
    check('modo dev: voo livre sobe com Espaço', fy1 - fy0 > 3, `subiu ${(fy1 - fy0).toFixed(1)} m`);
    await page.evaluate(() => {
      const g = window.__zh.game;
      g.dev.fly = false;
      g.applyDev();
      g.player.respawn(g.layout.spawn.clone(), 0);
    });
    await simWait(page, 1.0);
    let s = await state(page);
    check('jogador no chão após spawn', s.grounded && s.screen === 'playing', JSON.stringify(s.pos));
    await page.screenshot({ path: OUT + '02-fps-spawn.png' });

    const p0 = s.pos;
    await hold(page, 'KeyW', 1.5);
    s = await state(page);
    const moved = Math.hypot(s.pos[0] - p0[0], s.pos[2] - p0[2]);
    check('W move para frente (-Z)', moved > 4.0 && s.pos[2] < p0[2] - 3.5, `${moved.toFixed(2)} m`);

    await page.keyboard.down('ShiftLeft');
    await page.keyboard.down('KeyW');
    await simWait(page, 1.0);
    s = await state(page);
    const sp = Math.hypot(s.vel[0], s.vel[2]);
    check('sprint ativo e mais rápido', s.sprinting && sp > 6.0, `${sp.toFixed(2)} m/s`);
    // deslize: agachar durante o sprint
    await page.keyboard.press('KeyC');
    await simWait(page, 0.15);
    s = await state(page);
    check('C durante sprint inicia deslize', s.state === 'slide', s.state);
    await page.keyboard.up('KeyW');
    await page.keyboard.up('ShiftLeft');
    await simWait(page, 1.6);
    s = await state(page);
    check('deslize termina agachado', s.stance === 'crouch' && s.state === 'ground', `${s.stance}/${s.state}`);
    await page.keyboard.press('KeyC');
    await simWait(page, 0.4);
    s = await state(page);
    check('C alterna para em pé', s.stance === 'stand', s.stance);

    const y0 = s.pos[1];
    await page.keyboard.press('Space');
    await simWait(page, 0.25);
    const sj = await state(page);
    check('pulo sobe', sj.pos[1] > y0 + 0.4 && !sj.grounded, `${(sj.pos[1] - y0).toFixed(2)} m`);
    await simWait(page, 1.0);
    s = await state(page);
    check('pouso após pulo', s.grounded, '');

    await page.keyboard.press('KeyC');
    await simWait(page, 0.5);
    s = await state(page);
    check('agachar baixa os olhos', s.stance === 'crouch' && s.eye < 1.3, `olhos ${s.eye.toFixed(2)} m`);
    await page.screenshot({ path: OUT + '03-fps-agachado.png' });
    await page.keyboard.press('KeyZ');
    await simWait(page, 1.0);
    s = await state(page);
    check('Z deita', s.stance === 'prone' && s.eye < 0.6, `olhos ${s.eye.toFixed(2)} m`);
    await page.evaluate(() => window.__zh.setCamera('tps'));
    await simWait(page, 0.6);
    await page.screenshot({ path: OUT + '04-tps-deitado.png' });
    await page.keyboard.press('KeyZ');
    await simWait(page, 0.5);
    await page.keyboard.press('KeyC');
    await simWait(page, 0.6);
    s = await state(page);
    check('volta a ficar em pé', s.stance === 'stand', s.stance);

    // escalada: muro de 1.5 m (pista de obstáculos), olhando para +X
    await page.evaluate(() => {
      window.__zh.teleport('obstaculos');
      window.__zh.setLook(-Math.PI / 2, 0);
    });
    await simWait(page, 0.8);
    await page.evaluate(() => {
      // registra altura máxima e se o estado de escalada ocorreu
      const g = window.__zh.game;
      window.__mantle = { maxY: -1e9, seen: false };
      const orig = g.player.update.bind(g.player);
      g.player.update = (dt, inp) => {
        orig(dt, inp);
        window.__mantle.maxY = Math.max(window.__mantle.maxY, g.player.position.y);
        if (g.player.state === 'mantle') window.__mantle.seen = true;
      };
    });
    await page.keyboard.down('KeyW');
    await simWait(page, 0.6);
    await page.keyboard.press('Space');
    await simWait(page, 0.9);
    await page.keyboard.up('KeyW');
    await page.evaluate(() => window.__zh.setCamera('tps'));
    await simWait(page, 0.3);
    await page.screenshot({ path: OUT + '05-tps-escalada.png' });
    const mt = await page.evaluate(() => window.__mantle);
    const pts = await page.evaluate(() => window.__zh.points());
    check('escala muro de 1.5 m', mt.seen && mt.maxY > pts.obstaculos[1] + 1.4, `altura máx. relativa ${(mt.maxY - pts.obstaculos[1]).toFixed(2)} m`);
    await page.evaluate(() => window.__zh.setCamera('fps'));

    // escada externa até a plataforma de 1.2 m (x=40, degraus a partir de z=13.2 subindo para -Z)
    await page.evaluate(() => {
      const g = window.__zh.game;
      const L = g.layout;
      const p = new L.spawn.constructor(40, L.heightfield.heightAt(40, 16.5) + 0.3, 16.5);
      g.player.respawn(p, 0);
    });
    await simWait(page, 0.6);
    const base = (await state(page)).pos[1];
    await page.evaluate(() => (window.__mantle = { maxY: -1e9, seen: false }));
    await hold(page, 'KeyW', 2.2);
    const st = await page.evaluate(() => window.__mantle);
    check('sobe a escada até a plataforma de 1.2 m', st.maxY > base + 1.1, `subiu ${(st.maxY - base).toFixed(2)} m`);

    // rampas: 20° sobe, 52° bloqueia
    const rampTest = async (x, label, expectUp) => {
      await page.evaluate((x) => {
        const g = window.__zh.game;
        const L = g.layout;
        const z = -16;
        g.player.respawn(new L.spawn.constructor(x, L.heightfield.heightAt(x, z) + 0.3, z), Math.PI);
      }, x);
      await simWait(page, 0.5);
      const b = (await state(page)).pos[1];
      await page.evaluate(() => (window.__mantle = { maxY: -1e9, seen: false }));
      await hold(page, 'KeyW', 2.5);
      const dy = (await page.evaluate(() => window.__mantle.maxY)) - b;
      check(label, expectUp ? dy > 1.2 : dy < 0.8, `Δy ${dy.toFixed(2)} m`);
    };
    await rampTest(38, 'rampa de 20° é caminhável', true);
    await rampTest(47, 'rampa de 52° bloqueia', false);

    // casa de treino: térreo e screenshot TPS
    await page.evaluate(() => {
      window.__zh.teleport('casa');
      window.__zh.setLook(0, -0.05);
    });
    await simWait(page, 0.8);
    await page.screenshot({ path: OUT + '06-tps-casa.png' });
    await page.evaluate(() => {
      window.__zh.setCamera('fps');
      window.__zh.teleport('colina');
      window.__zh.setLook(Math.PI, -0.1);
    });
    await simWait(page, 1.0);
    s = await state(page);
    const relief = await page.evaluate(() => {
      const h = window.__zh.game.layout.heightfield.heights;
      let lo = Infinity;
      let hi = -Infinity;
      for (const v of h) {
        lo = Math.min(lo, v);
        hi = Math.max(hi, v);
      }
      return { lo, hi };
    });
    check('terreno não-plano (desnível > 40 m, colina acima de 8 m)', relief.hi - relief.lo > 40 && s.pos[1] > 8, `desnível ${(relief.hi - relief.lo).toFixed(0)} m · colina y ${s.pos[1].toFixed(1)} m`);
    await page.screenshot({ path: OUT + '07-fps-colina.png' });
    check('quadro renderizado não está preto', await notBlack(page), '');

    // pausa e configurações
    await page.keyboard.press('Escape');
    await simWait(page, 0.2);
    s = await state(page);
    check('Esc pausa', s.screen === 'paused', s.screen);
    await page.click('.zh-pause [data-a=settings]');
    await page.click('.zh-tabs button:nth-child(3)');
    await page.selectOption('.zh-field select', 'tps');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('zona-hostil.settings')).gameplay.camera);
    check('configuração salva no armazenamento', saved === 'tps', saved);
    await page.screenshot({ path: OUT + '08-configuracoes.png' });
    await ctx.close();

    // ------------------------------------------------ celular (toque)
    const phone = pw.devices['Pixel 7'];
    const landscape = { ...phone, viewport: { width: phone.viewport.height, height: phone.viewport.width } };
    const m = await newGame(browser, { context: landscape });
    await m.page.click('.zh-title [data-a=play]');
    await simWait(m.page, 1.0);
    let ms = await state(m.page);
    check('celular: controles de toque visíveis', await m.page.isVisible('.zh-touch .zh-btn[data-id=jump]'), '');
    const mp0 = ms.pos;
    const cdp = await m.ctx.newCDPSession(m.page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    const vw = landscape.viewport.width;
    const vh = landscape.viewport.height;
    const jx = vw * 0.15;
    const jy = vh * 0.7;
    await touch('touchStart', [{ x: jx, y: jy, id: 1 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: jx, y: jy - i * 9, id: 1 }]);
    await simWait(m.page, 1.2);
    ms = await state(m.page);
    const mmove = Math.hypot(ms.pos[0] - mp0[0], ms.pos[2] - mp0[2]);
    check('celular: joystick move o personagem', mmove > 2, `${mmove.toFixed(2)} m`);
    await m.page.screenshot({ path: OUT + '09-celular.png' });
    await touch('touchEnd', []);
    // arrastar à direita gira a câmera
    const yaw0 = (await state(m.page)).yaw;
    await touch('touchStart', [{ x: vw * 0.7, y: vh * 0.45, id: 2 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: vw * 0.7 - i * 15, y: vh * 0.45, id: 2 }]);
    await touch('touchEnd', []);
    await simWait(m.page, 0.2);
    const yaw1 = (await state(m.page)).yaw;
    check('celular: arrastar gira a câmera', Math.abs(yaw1 - yaw0) > 0.2, `Δyaw ${(yaw1 - yaw0).toFixed(2)} rad`);
    // botão agachar
    await m.page.tap('.zh-btn[data-id=crouch]');
    await simWait(m.page, 0.4);
    ms = await state(m.page);
    check('celular: botão AGACHAR funciona', ms.stance === 'crouch', ms.stance);
    await m.ctx.close();
  } finally {
    await browser.close();
    srv?.kill();
  }
  const critical = errors.filter((e) => !/favicon|DevTools|GPU stall|WebGL: INVALID_ENUM/i.test(e));
  check('sem erros de JavaScript no console', critical.length === 0, critical.slice(0, 3).join(' | '));
  writeFileSync(OUT + 'resultado.json', JSON.stringify({ results, errors }, null, 2));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} verificações passaram`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
