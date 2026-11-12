// Testes de interface com toques reais: código do desenvolvedor, menus, loja, pets, editor de HUD, iniciar partida.
module.exports = async ({ p, shot, ev, sleep }) => {
  const tap = async (sel) => { const e = await p.$(sel); if (!e) { console.log('MISSING', sel); return false; } await e.scrollIntoViewIfNeeded(); await sleep(80); const b = await e.boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(250); return true; };
  const out = {};
  for (let i = 0; i < 4; i++) await tap('#logo'); out.after4 = await ev(() => document.getElementById('panel').hidden);
  await tap('#logo'); out.codePrompt = await ev(() => !!document.getElementById('o-code'));
  await p.fill('#o-code', 'Alex'); await tap('[data-a=code]'); out.wrongCode = await ev(() => ({ dev: __G.dev.on, msg: document.getElementById('code-msg').textContent }));
  await p.fill('#o-code', 'alex'); await tap('[data-a=code]'); out.rightCode = await ev(() => ({ dev: __G.dev.on, title: document.querySelector('.sheet h2').textContent }));
  await tap('[data-a=dev][data-v=god]'); out.god = await ev(() => __G.dev.god); await tap('[data-a=dev][data-v=god]'); await tap('.x');
  await tap('#m-nav [data-s=pets]'); await tap('[data-a=pet][data-v=nina]'); out.pet = await ev(() => JSON.parse(localStorage.getItem('cbr_profile')).pet); await shot('u_pets'); await tap('.x');
  await tap('#m-nav [data-s=chars]'); await tap('[data-a=char][data-v=mosquitao]'); out.char = await ev(() => JSON.parse(localStorage.getItem('cbr_profile')).char); await sleep(600); await shot('u_char'); await tap('[data-a=outfit][data-v=tatico]'); await tap('.x');
  await tap('#m-nav [data-s=store]'); await ev(() => localStorage.setItem('cbr_coins', '2000')); await tap('[data-a=buyoutfit][data-v=tatico]'); out.store = await ev(() => ({ coins: localStorage.getItem('cbr_coins'), owned: JSON.parse(localStorage.getItem('cbr_profile')).owned })); await tap('.x');
  await tap('#m-nav [data-s=ars]'); await tap('[data-a=atab][data-v=sniper]'); await tap('[data-a=weapon][data-v=harpia]'); await tap('[data-a=optic][data-v=x8]'); out.loadout = await ev(() => JSON.parse(localStorage.getItem('cbr_loadout'))); await tap('.x');
  await tap('#b-mode'); await tap('[data-a=mode][data-v=treino]'); await tap('.x'); out.modeLabel = await ev(() => document.querySelector('#b-mode b').textContent);
  await tap('#b-play'); await sleep(1500); out.playing = await ev(() => ({ mode: __G.mode, w: __G.player.w && __G.player.w.def.name, optic: __G.player.w && __G.player.w.optic, char: __G.player.model.look.id, hud: !document.getElementById('hud').hidden })); await shot('u_play');
  // botões de toque reais
  await tap('.hb[data-k=run]'); out.runOn = await ev(() => __G.__I.run); const p0 = await ev(() => __G.player.pos.z); await ev(() => { __G.simPause = true; __sim(1.5); __G.simPause = false; }); out.autoRun = +(await ev((z) => Math.abs(__G.player.pos.z - z), p0)).toFixed(1); await tap('.hb[data-k=run]'); out.runOff = !(await ev(() => __G.__I.run));
  await tap('.hb[data-k=crouch]'); await sleep(200); out.crouchBtn = await ev(() => __G.player.crouch); await tap('.hb[data-k=crouch]');
  await tap('.hb[data-k=bag]'); out.bag = await ev(() => document.querySelector('.sheet h2') && document.querySelector('.sheet h2').textContent); await tap('.x');
  await tap('.hb[data-k=pause]'); out.pause = await ev(() => document.querySelector('.sheet h2').textContent); await tap('[data-a=go][data-v=settings]'); await tap('[data-a=hudedit]'); await sleep(300);
  const fb = await (await p.$('.hb[data-k=fire]')).boundingBox(); const before = await ev(() => ({ ...__G.__layout().fire })); await p.touchscreen.tap(fb.x + fb.width / 2, fb.y + fb.height / 2);
  await p.mouse.move(fb.x + 40, fb.y + 40); await p.mouse.down(); await p.mouse.move(fb.x - 20, fb.y - 30, { steps: 4 }); await p.mouse.up(); await sleep(200); out.editMoved = await ev((b) => { const l = __G.__layout().fire; return [l.x - b.x, l.y - b.y]; }, before); await shot('u_edit'); await tap('#edit [data-a=save]'); out.saved = await ev(() => Object.keys(localStorage).filter((k) => k.startsWith('cbr_hud')));
  await ev(() => { __G.ui.open('pause'); }); await tap('[data-a=leave]'); await sleep(500); out.backToMenu = await ev(() => __G.mode);
  console.log(JSON.stringify(out, null, 1));
};
