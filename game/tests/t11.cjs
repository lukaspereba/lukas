// Modo Deus (código djalma67) e HUD limpo.
module.exports = async ({ p, shot, ev, sleep }) => {
  const pre = process.env.PRE || 'p';
  const tap = async (sel) => { const e = await p.$(sel); if (!e) { console.log('MISSING', sel); return false; } await e.scrollIntoViewIfNeeded(); await sleep(80); const b = await e.boundingBox(); await p.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await sleep(250); return true; };
  const out = {};
  { const lb = await (await p.$('#logo')).boundingBox(); for (let i = 0; i < 5; i++) { await p.touchscreen.tap(lb.x + 30, lb.y + 20); await sleep(120); } await sleep(400); } await p.fill('#o-code', 'Djalma67'); await tap('[data-a=code]'); out.wrong = await ev(() => ({ god: !!__G.dev.god, msg: document.getElementById('code-msg').textContent }));
  await p.fill('#o-code', 'djalma67'); await tap('[data-a=code]'); out.right = await ev(() => ({ god: __G.dev.god, ghost: __G.dev.ghost, title: document.querySelector('.sheet h2').textContent, dev: __G.dev.on })); await shot(pre + '_god_menu');
  await tap('[data-a=explore]'); await sleep(1500); out.mode = await ev(() => __G.match.mode); await shot(pre + '_hud_clean');
  out.game = await ev(() => { const G = __G, pl = G.player, o = {}; G.simPause = true; __sim(0.5); G.devBots('add'); const b = G.bots.filter((x) => x.alive).sort((a, c) => a.pos.distanceTo(pl.pos) - c.pos.distanceTo(pl.pos))[0]; o.botDist = +b.pos.distanceTo(pl.pos).toFixed(1); __sim(6); o.hp = pl.hp; o.botTarget = b.target ? b.target.name : null; o.dmg = pl.damage(80, b, {}); o.hpAfter = pl.hp; G.simPause = false; return o; });
  await tap('.hb[data-k=pause]'); await shot(pre + '_god_pause'); await tap('[data-a=god][data-v=fly]'); await tap('[data-a=gspeed][data-v="4"]'); out.flyOn = await ev(() => ({ fly: __G.dev.fly, speed: __G.dev.speed })); await tap('.x');
  out.fly = await ev(() => { const G = __G, pl = G.player; G.simPause = true; const y0 = pl.pos.y, z0 = pl.pos.z; G.__I.up = true; G.__keys.KeyW = true; __sim(3); G.__I.up = false; G.__keys.KeyW = false; __sim(0.5); const r = { rose: +(pl.pos.y - y0).toFixed(1), moved: +Math.abs(pl.pos.z - z0).toFixed(1) }; __sim(2); r.hover = +(pl.pos.y - y0).toFixed(1); G.simPause = false; return r; });
  await sleep(700); await shot(pre + '_god_fly');
  await tap('.hb[data-k=pause]'); await tap('[data-a=tp][data-v="1"]'); out.tp = await ev(() => { const pl = __G.player; return [Math.round(pl.pos.x), Math.round(pl.pos.z), __G.world.labels[1].name]; });
  await tap('.hb[data-k=pause]'); await tap('[data-a=god][data-v=on]'); out.off = await ev(() => ({ god: __G.dev.god, fly: __G.dev.fly, speed: __G.dev.speed, saved: localStorage.getItem('cbr_godOn'), unlocked: localStorage.getItem('cbr_godUnlocked') })); await tap('.x');
  out.swap = await ev(() => { const G = __G, pl = G.player; G.simPause = true; __sim(1.5); const a = pl.w && pl.w.def.name; G.simPause = false; return a; }); await tap('#h-slots .ws'); await sleep(700); out.swap2 = await ev(() => __G.player.w && __G.player.w.def.name);
  out.buttons = await ev(() => [...document.querySelectorAll('.hb')].filter((e) => !e.hidden).map((e) => e.dataset.k));
  console.log(JSON.stringify(out, null, 1));
};
