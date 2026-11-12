// Partida: lobby, avião, salto, zona segura, contratos, Gulag, Ressurgência, eliminações, vitória e derrota.
import * as THREE from 'three';
import { G } from './state.js';
import { S, WBY } from './config.js';
import { I, hit } from './input.js';
import { Bot, giveStarter } from './bots.js';
import { newWeapon } from './actors.js';
import { Loot, spawnLoot, dropAll, addItem, refillAmmo } from './loot.js';
import { clearEquipment } from './equipment.js';
import { clearFx, burst } from './fx.js';
import { part, VMAT } from './mesh.js';
import { snd, loop, lobbyMusic, stopAllLoops } from './audio.js';
import { nav, nearestCell } from './nav.js';
import { mulberry, clamp, store, fmtTime } from './util.js';
import { setFov } from './engine.js';

const V = new THREE.Vector3(), P2 = { x: 0, z: 0 };
const STAGES = [[430, 55, 0, 0], [190, 45, 45, 2], [110, 35, 38, 4], [55, 28, 30, 7], [22, 18, 24, 10], [0, 12, 22, 14]]; // [raio final, espera, duração do fechamento, dano/s]
const CTYPES = [['bounty', 'Eliminação de alvo', '#e85a4a'], ['recon', 'Reconhecimento', '#4aa8f0'], ['scav', 'Busca de suprimentos', '#f0b030'], ['capture', 'Captura de área', '#5fd47a']];
let planeMesh, zoneMesh, contractGroup;
function buildPlane() { const sp = [['cyl', [0, 0, 0, 2.2, 22, 2.2, Math.PI / 2, 0, 0], 0x6a7078], ['sph', [0, 0, -11, 2.2, 2.2, 4], 0x6a7078], ['cone', [0, 0.6, 12.5, 2.2, 5, 1.6, -Math.PI / 2, 0, 0], 0x5a6068], ['box', [0, 1.2, -1, 34, 0.5, 5.5], 0x5a6068], ['box', [0, 4.2, 13.5, 0.4, 6, 3.6, 0.3, 0, 0], 0x5a6068], ['box', [0, 6.6, 14.6, 11, 0.3, 2.6], 0x5a6068]]; for (const x of [-11, -5.5, 5.5, 11]) { sp.push(['cyl', [x, 0.5, -2.6, 0.75, 3.4, 0.75, Math.PI / 2, 0, 0], 0x3a3d42]); sp.push(['box', [x, 0.5, -4.5, 3.6, 0.12, 0.2], 0x15171a]); } return new THREE.Mesh(part(sp), VMAT); }
export class Match {
  constructor() { this.zone = { x: 0, z: 0, r: 430, nx: 0, nz: 0, nextR: 430, shrinkIn: 99, active: false, stage: 0, shrinking: false, dps: 0 }; this.uavT = {}; this.feed = []; this.aimingAtPlayer = 0; this.aimingNow = 0; this.phase = 'none'; this.contracts = []; this.contract = null; this.teamSize = 1;
    if (!planeMesh) { planeMesh = buildPlane(); planeMesh.visible = false; G.scene.add(planeMesh); zoneMesh = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 260, 64, 1, true), new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, fog: false })); zoneMesh.visible = false; zoneMesh.renderOrder = 4; G.scene.add(zoneMesh); contractGroup = new THREE.Group(); G.scene.add(contractGroup); }
    G.extraInteract = (pl, bd) => this.extraInteract(pl, bd); }
  start(mode, teamSize) {
    this.mode = mode; this.teamSize = mode === 'gulag' || mode === 'treino' ? 1 : teamSize; this.seed = (Date.now() & 0xffffff) | 1; const rng = this.rng = mulberry(this.seed); this.time = 0; this.feed = []; this.uavT = {}; this.contract = null; this.result = null; this.endT = 0; this.respawnT = 0; this.gulag = null; this.spec = null; this.deathPos = null; this.resurge = mode === 'res';
    G.world.resetDynamic(); clearFx(); clearEquipment(); spawnLoot(this.seed); stopAllLoops(); lobbyMusic(false); G.inGulag = false; G.world.gulagGroup.visible = false;
    const pl = G.player; pl.reset(); pl.model.root.visible = false; pl.noTerrain = false; pl.adsT = 0; I.ads = false; I.run = false; I.fire = false;
    const total = mode === 'gulag' ? 1 : mode === 'treino' ? Math.min(10, S.bots) : S.bots; G.actors = [pl]; G.bots = [];
    for (let i = 0; i < G.botPool.length; i++) { const b = G.botPool[i]; b.reset(); b.model.root.visible = false; b.mode = 'gone'; b.alive = false; b.deadT = 99; b.ally = false; b.path = null; b.target = null; b.state = 'idle'; b.vehicle = null; if (i < total) { b.alive = true; G.actors.push(b); G.bots.push(b); } }
    // times
    pl.team = 0; let team = 0, cnt = 1; for (const b of G.bots) { if (cnt >= this.teamSize) { team++; cnt = 0; } b.team = team; b.ally = team === 0; cnt++; } this.teams = team + 1;
    const z = this.zone; z.x = z.nx = 0; z.z = z.nz = 0; z.r = z.nextR = 430; z.stage = 0; z.shrinking = false; z.active = mode === 'br' || mode === 'res'; z.shrinkIn = STAGES[0][1]; z.dps = 0; z.started = false; if (mode === 'res') { z.started = true; z.stage = 1; z.r = 230; this.pickNext(); z.shrinkIn = 60; }
    zoneMesh.visible = z.active; this.spawnContracts(rng); this.respawns = {};
    if (mode === 'treino') { this.phase = 'play'; const P = G.terr.height(0, -34); pl.teleport(0, P + 0.2, -36); pl.mode = 'ground'; pl.yaw = Math.PI; this.loadout(pl); pl.armor = 150; pl.inv.plate = 5; pl.inv.frag = 2; pl.inv.smoke = 2; pl.inv.uav = 1; pl.inv.drone = 1; pl.cash = 5000; for (const b of G.bots) { this.spawnBotGround(b, rng); giveStarter(b, rng); } }
    else if (mode === 'gulag') { this.phase = 'play'; this.startGulag(true); }
    else { this.phase = 'count'; this.countT = 4; const a = rng() * 6.283; this.pd = { x: Math.cos(a), z: Math.sin(a) }; this.planeT = 0; this.planeDur = 26; pl.mode = 'plane'; pl.weapons = [newWeapon('lambari'), null]; pl.cur = 0; pl.ammo['9mm'] = 45; pl.spawnProt = 0; const off = (rng() - 0.5) * 160; this.pOff = { x: -this.pd.z * off, z: this.pd.x * off };
      for (const b of G.bots) { b.mode = 'plane'; b.jumpT = 3 + rng() * (this.planeDur - 6); if (b.ally) b.jumpT = 999; giveStarter(b, rng); } }
    G.mode = 'play'; snd.ui('ok');
  }
  loadout(a) { const lo = store.get('loadout', { p: 'guara', s: 'lambari', po: null, so: null, m: 'faca' }); a.weapons = [newWeapon(lo.p, lo.po), newWeapon(lo.s, lo.so)]; a.cur = 0; a.melee = lo.m || 'faca'; refillAmmo(a); a._wkey = null; }
  spawnBotGround(b, rng) { for (let k = 0; k < 20; k++) { const a = rng() * 6.283, r = 40 + rng() * 240; if (b.place(Math.cos(a) * r, Math.sin(a) * r)) break; } b.mode = 'ground'; b.alive = true; b.yaw = rng() * 6.28; }
  planePos(out, t) { const k = t / this.planeDur; return out.set(this.pOff.x + this.pd.x * (-430 + 860 * k), 205, this.pOff.z + this.pd.z * (-430 + 860 * k)); }
  pickNext() { const z = this.zone, st = STAGES[Math.min(z.stage, STAGES.length - 1)]; z.nextR = st[0]; const a = this.rng() * 6.283, d = this.rng() * Math.max(0, z.r - z.nextR) * 0.8; z.nx = clamp(z.x + Math.cos(a) * d, -230, 230); z.nz = clamp(z.z + Math.sin(a) * d, -230, 230); z.shrinkIn = st[1]; z.shrinking = false; }
  inZone(x, z, m = 0) { const Z = this.zone; return !Z.active || Math.hypot(x - Z.x, z - Z.z) < Z.r + m; }
  uav(team, t) { this.uavT[team] = Math.max(this.uavT[team] || 0, t); }
  log(html) { this.feed.push({ html, t: G.time }); if (this.feed.length > 5) this.feed.shift(); if (G.ui) G.ui.feed(); }
  aliveTeams() { const s = new Set(); for (const a of G.actors) if (a.alive || (this.respawns[a.id] > 0)) s.add(a.team); return s; }
  aliveCount() { let n = 0; for (const a of G.actors) if (a.alive) n++; return n; }
  teamHasOthers(a) { return G.actors.some((x) => x !== a && x.team === a.team && x.alive && !x.downed); }
  // ── dano fatal ──
  onDown(a, from, o) {
    if (a.downed) { this.kill(a, from || a.lastHitBy, o); return; }
    if (this.gulag && (a === this.gulag.bot || a.isPlayer && G.inGulag)) { this.kill(a, from, o); return; }
    const selfRev = a.inv.revive > 0; const teamRev = a.team === 0 && this.teamSize > 1 && this.teamHasOthers(a);
    if (selfRev || teamRev) { a.downed = true; a.hp = 35; a.downT = selfRev ? 6 : 28; a.selfRev = selfRev; a.reviveP = 0; a.reloadT = 0; if (selfRev) a.inv.revive--; if (a.isPlayer) { I.ads = false; G.ui.toast(selfRev ? 'Derrubado! Autorreanimando…' : 'Derrubado! Aguarde um aliado', '#e85a4a'); snd.ui('warn'); } this.log(`<b>${from ? from.name : 'Zona'}</b> derrubou <b>${a.name}</b>`); if (from && from.isPlayer) snd.ui('kill'); return; }
    this.kill(a, from, o);
  }
  revive(a) { a.downed = false; a.hp = 40; a.prone = false; a.reviveP = 0; a.lastDmgT = G.time - 3; if (a.isPlayer) { G.ui.toast('Você foi reanimado', '#5fd47a'); snd.ui('ok'); } }
  kill(a, killer, o = {}) {
    if (!a.alive) return; a.alive = false; a.downed = false; a.deadT = 0; a.vehicle && G.exitVehicle && G.exitVehicle(a, true); const inGulag = this.gulag && (a === this.gulag.bot || (a.isPlayer && G.inGulag));
    if (!inGulag) { dropAll(a); } if (killer && killer !== a && killer.alive !== undefined) { killer.kills++; killer.cash += 300; }
    const wn = killer && killer.w ? killer.w.def.name : o.zone ? 'gás' : o.fall ? 'queda' : o.explosive ? 'explosão' : 'corpo a corpo';
    this.log(killer && killer !== a ? `<b class="${killer.team === 0 ? 'ally' : ''}">${killer.name}</b> <i>${wn}${o.head ? ' ◎' : ''}</i> <b class="${a.team === 0 ? 'ally' : ''}">${a.name}</b>` : `<b>${a.name}</b> morreu (${wn})`);
    if (killer && killer.isPlayer && !a.isPlayer) { snd.ui('kill'); G.ui.killPop(a.name, o.head); if (this.contract && this.contract.type === 'bounty' && this.contract.target === a) this.finishContract(2500); }
    else if (this.contract && this.contract.type === 'bounty' && this.contract.target === a) this.finishContract(800, 'Alvo eliminado por outro');
    if (inGulag) { this.endGulag(!a.isPlayer); return; }
    if (a.isPlayer) { snd.ui('lose'); loop('wind', false); const stage = this.zone.stage; this.deathPos = a.pos.clone(); this.spec = killer && killer !== a && killer.alive ? killer : null;
      if (this.mode === 'treino') { this.respawnT = 3; this.respawnKind = 'treino'; }
      else if (this.mode === 'br' && !a.gulagUsed && stage < 3 && this.aliveCount() > 2) { a.gulagUsed = true; this.respawnT = 2.2; this.respawnKind = 'gulag'; G.ui.toast('Você vai para o GULAG', '#f2c230'); }
      else if (this.resurge && stage < 4 && (this.teamSize === 1 || this.teamHasOthers(a))) { this.respawnT = 10; this.respawnKind = 'res'; this.respawns[a.id] = 1; }
      else this.finish(false); }
    else if (this.resurge && this.zone.stage < 3 && !(a.resUsed) && this.mode === 'res') { a.resUsed = true; this.respawns[a.id] = 14; }
    if (this.phase === 'play') this.checkWin();
  }
  checkWin() { if (this.mode === 'treino' || this.mode === 'gulag' || this.result) return; const t = this.aliveTeams(); const pl = G.player; const mine = pl.alive || this.respawnT > 0 || this.gulag || G.actors.some((x) => x.team === 0 && x.alive); if (mine && t.size <= 1) this.finish(true); else if (!mine && !this.result) this.finish(false); }
  finish(win) { if (this.result) return; const pl = G.player; const place = win ? 1 : this.aliveTeams().size + (this.aliveTeams().has(0) ? 0 : 1); this.result = { win, place: Math.max(1, place), kills: pl.kills, dmg: Math.round(pl.dmgDone), time: this.time, coins: 50 + pl.kills * 25 + (win ? 300 : Math.max(0, 120 - place * 6)) }; this.endT = win ? 2.5 : 2.2; if (win) snd.ui('win');
    const st = store.get('stats', { games: 0, wins: 0, kills: 0, best: 99 }); st.games++; if (win) st.wins++; st.kills += pl.kills; st.best = Math.min(st.best || 99, this.result.place); store.set('stats', st); store.set('coins', store.get('coins', 500) + this.result.coins); }
  // ── Gulag ──
  startGulag(standalone) { const pl = G.player, g = G.world.gulag; const bot = G.botPool[G.botPool.length - 1]; bot.reset(); bot.name = 'Carcereiro'; bot.team = 99; bot.alive = true; bot.mode = 'ground'; bot.ally = false; bot.pos.set(g.b.x, g.y, g.b.z); bot.yaw = Math.PI * 0.75; if (!G.actors.includes(bot)) G.actors.push(bot); const ids = ['lambari', 'piranha', 'vespa', 'jararaca', 'guara']; const id = ids[(this.rng() * ids.length) | 0];
    pl.alive = true; pl.downed = false; pl.hp = 100; pl.armor = 0; pl.mode = 'ground'; pl.prone = pl.crouch = false; pl.weapons = [newWeapon(id), null]; pl.cur = 0; pl.melee = 'punhos'; pl.ammo[WBY[id].ammo] = WBY[id].mag * 3; pl._wkey = null; pl.teleport(g.a.x, g.y, g.a.z); pl.onGround = true; pl.yaw = -Math.PI * 0.25; pl.pitch = 0; pl.noTerrain = true; pl.spawnProt = 2.5; pl.vel.set(0, 0, 0);
    bot.weapons = [newWeapon(id), null]; bot.cur = 0; bot.ammo[WBY[id].ammo] = 999; bot.spawnProt = 2.5; this.gulag = { bot, t: 45, standalone, think: 0, vis: false, sx: 1, st: 0 }; G.inGulag = true; G.world.gulagGroup.visible = true; G.ui.banner('GULAG', 'Vença o duelo para voltar à partida'); snd.ui('warn'); }
  updateGulag(dt) { const g = this.gulag, b = g.bot, pl = G.player; g.t -= dt; if (!b.alive || !pl.alive) return; b.spawnProt = Math.max(0, b.spawnProt - dt); b.cool -= dt; b.stunT = Math.max(0, b.stunT - dt);
    g.think -= dt; if (g.think <= 0) { g.think = 0.2; g.vis = G.phys.los(b.pos.x, b.pos.y + 1.5, b.pos.z, pl.pos.x, pl.pos.y + 1.2, pl.pos.z); if (g.vis && !g.was) b.seenT = G.time + 0.6; g.was = g.vis; }
    g.st -= dt; if (g.st <= 0) { g.st = 0.8 + Math.random(); g.sx = Math.random() < 0.5 ? -1 : 1; }
    const dx = pl.pos.x - b.pos.x, dz = pl.pos.z - b.pos.z, d = Math.hypot(dx, dz) || 1; const wantYaw = Math.atan2(-dx, -dz); let dy = wantYaw - b.yaw; while (dy > Math.PI) dy -= 6.283; while (dy < -Math.PI) dy += 6.283; b.yaw += dy * Math.min(1, dt * 8);
    const fwd = g.vis ? (d > 9 ? 0.6 : d < 4 ? -0.5 : 0) : 1, sp = b.spawnProt > 0 ? 0 : 3.2; const mx = (dx / d) * fwd + (-dz / d) * g.sx * (g.vis ? 0.9 : 0.5), mz = (dz / d) * fwd + (dx / d) * g.sx * (g.vis ? 0.9 : 0.5); P2.x = b.pos.x + mx * sp * dt; P2.z = b.pos.z + mz * sp * dt; if (G.phys.resolve(P2, 0.38, b.pos.y, 1.7)) g.st = Math.min(g.st, 0.15); b.pos.x = clamp(P2.x, -15, 15); b.pos.z = clamp(P2.z, -15, 15); b.speed = sp; b.moveF = fwd; b.moveS = g.sx;
    if (b.reloadT > 0) { b.reloadT -= dt; if (b.reloadT <= 0) b.w.ammo = b.w.def.mag; } if (g.vis && b.spawnProt <= 0 && b.stunT <= 0) b.combat(dt, pl, d); b.syncModel(dt, true);
    if (g.t <= 0) { if (pl.hp >= b.hp) this.kill(b, pl, {}); else this.kill(pl, b, {}); } }
  endGulag(won) { const g = this.gulag; if (!g) return; this.gulag = null; const pl = G.player; g.bot.mode = 'gone'; setTimeout(() => { g.bot.model.root.visible = false; const i = G.actors.indexOf(g.bot); if (i >= 0 && !G.bots.includes(g.bot)) G.actors.splice(i, 1); }, 50);
    if (g.standalone) { G.inGulag = false; G.world.gulagGroup.visible = false; pl.noTerrain = false; this.result = { win: won, place: won ? 1 : 2, kills: pl.kills, dmg: Math.round(pl.dmgDone), time: this.time, coins: won ? 80 : 20, gulag: true }; store.set('coins', store.get('coins', 500) + this.result.coins); this.endT = 1.5; snd.ui(won ? 'win' : 'lose'); return; }
    if (won) { G.ui.banner('VOCÊ VENCEU O GULAG', 'Voltando ao combate'); snd.ui('win'); this.respawnT = 1.6; this.respawnKind = 'redeploy'; } else { G.inGulag = false; G.world.gulagGroup.visible = false; pl.noTerrain = false; if (this.deathPos) { pl.pos.copy(this.deathPos); pl.camY = pl.pos.y; } this.spec = null; this.finish(false); } }
  redeploy(a, keep) { const z = this.zone; let x = z.x, zz = z.z; const mate = G.actors.find((m) => m !== a && m.team === a.team && m.alive); if (mate) { x = mate.pos.x; zz = mate.pos.z; } else { const an = this.rng() * 6.283, r = Math.min(z.r * 0.5, 120) * this.rng(); x = clamp(z.x + Math.cos(an) * r, -280, 280); zz = clamp(z.z + Math.sin(an) * r, -280, 280); }
    a.alive = true; a.downed = false; a.hp = 100; a.prone = a.crouch = false; a.deadT = 0; a.spawnProt = 3; a.reloadT = 0; if (!keep) { a.weapons = [newWeapon('lambari'), null]; a.cur = 0; a.ammo['9mm'] = 60; a.armor = 50; a._wkey = null; }
    if (a.isPlayer) { G.inGulag = false; G.world.gulagGroup.visible = false; a.noTerrain = false; a.teleport(x, G.terr.height(x, zz) + 170, zz); a.mode = 'fall'; a.pitch = -0.6; G.ui.toast('Reimplantado — abra o paraquedas', '#5fd47a'); } else { a.pos.set(x, G.terr.height(x, zz) + 150, zz); a.mode = 'fall'; a.dropX = x + (this.rng() - 0.5) * 30; a.dropZ = zz + (this.rng() - 0.5) * 30; a.cell = nearestCell(a.dropX, a.dropZ, 10); if (a.cell >= 0) { a.dropX = nav.wx[a.cell]; a.dropZ = nav.wz[a.cell]; } } }
  buyback(pl) { const d = G.bots.find((b) => b.ally && !b.alive); if (!d) return false; this.redeploy(d, false); this.log(`<b class="ally">${d.name}</b> foi recomprado`); return true; }
  onLand(a) { if (a.isPlayer) { for (const b of G.bots) if (b.ally && (b.mode === 'fall' || b.mode === 'chute')) { b.dropX = a.pos.x + (Math.random() - 0.5) * 14; b.dropZ = a.pos.z + (Math.random() - 0.5) * 14; } } }
  onCrate(c, a) { const k = this.contract; if (k && k.type === 'scav' && a.team === 0) { const i = k.crates.indexOf(c); if (i >= 0) { k.crates.splice(i, 1); k.done++; if (k.done >= 3) this.finishContract(2000, null, 'plate'); else G.ui.toast(`Suprimentos: ${k.done}/3`, '#f0b030'); } } }
  // ── Contratos ──
  spawnContracts(rng) { while (contractGroup.children.length) contractGroup.remove(contractGroup.children[0]); this.contracts = []; if (this.mode === 'gulag') return; const spots = G.world.buy.map((b) => ({ x: b.x + 2.2, z: b.z + 1.5 })).concat(G.world.labels.map((l) => ({ x: l.x + 6, z: l.z - 9 })));
    spots.slice(0, 10).forEach((s, i) => { const c = nearestCell(s.x, s.z, 8); if (c < 0) return; const t = CTYPES[i % 4]; const x = nav.wx[c], z = nav.wz[c], y = nav.y[c]; const m = new THREE.Mesh(part([['box', [0, 0.55, 0, 0.3, 0.42, 0.04, -0.3, 0, 0], 0x15171a], ['box', [0, 0.57, 0.02, 0.24, 0.32, 0.01, -0.3, 0, 0], new THREE.Color(t[2]).getHex()], ['cyl', [0, 0.2, 0.05, 0.03, 0.4, 0.03], 0x55585c], ['cyl', [0, 0.02, 0.05, 0.16, 0.04, 0.16], 0x3a3d42]]), VMAT); m.position.set(x, y, z); const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 14, 6, 1, true), new THREE.MeshBasicMaterial({ color: t[2], transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = 7.5; m.add(beam); contractGroup.add(m); this.contracts.push({ type: t[0], name: t[1], col: t[2], x, y, z, mesh: m, taken: false }); }); }
  extraInteract(pl, bd) {
    for (const c of this.contracts) { if (c.taken) continue; const d2 = (c.x - pl.pos.x) ** 2 + (c.z - pl.pos.z) ** 2; if (d2 < 6 && Math.abs(c.y - pl.pos.y) < 2) return { type: 'contract', label: this.contract ? 'Já existe um contrato ativo' : 'Aceitar contrato: ' + c.name, fn: () => this.takeContract(c) }; }
    for (const a of G.actors) { if (a === pl || a.team !== pl.team || !a.downed) continue; if (a.pos.distanceTo(pl.pos) < 2.4) return { type: 'revive', label: 'Reanimar ' + a.name, fn: () => { a.reviveP = (a.reviveP || 0) + 1.2; if (a.reviveP >= 3) this.revive(a); else G.ui.toast(`Reanimando… ${Math.round(a.reviveP / 3 * 100)}%`); } }; }
    return G.vehicleInteract ? G.vehicleInteract(pl, bd) : null; }
  takeContract(c) { if (this.contract) { snd.ui('err'); return; } const pl = G.player; const k = { type: c.type, name: c.name, col: c.col, t: 180, done: 0 };
    if (c.type === 'bounty') { let best = null, bd = 1e9; for (const a of G.actors) { if (!a.alive || a.team === pl.team) continue; const d = a.pos.distanceTo(pl.pos); if (d > 35 && d < bd) { bd = d; best = a; } } if (!best) { G.ui.toast('Nenhum alvo disponível'); return; } k.target = best; k.text = 'Elimine ' + best.name; }
    else if (c.type === 'recon' || c.type === 'capture') { const L = G.world.labels.filter((l) => Math.hypot(l.x - pl.pos.x, l.z - pl.pos.z) > 60 && this.inZone(l.x, l.z, -15)); const l = L.length ? L[(this.rng() * L.length) | 0] : G.world.labels[0]; const cell = nearestCell(l.x + 8, l.z + 10, 10); k.x = nav.wx[cell]; k.z = nav.wz[cell]; k.need = c.type === 'recon' ? 10 : 22; k.r = c.type === 'recon' ? 7 : 12; k.text = (c.type === 'recon' ? 'Faça o reconhecimento em ' : 'Capture a área em ') + l.name; }
    else { k.crates = Loot.crates.filter((x) => !x.open && this.inZone(x.x, x.z, -10)).sort((a, b) => ((a.x - pl.pos.x) ** 2 + (a.z - pl.pos.z) ** 2) - ((b.x - pl.pos.x) ** 2 + (b.z - pl.pos.z) ** 2)).slice(0, 3); if (k.crates.length < 3) { G.ui.toast('Sem caixas suficientes'); return; } k.text = 'Abra 3 caixas marcadas'; }
    c.taken = true; c.mesh.visible = false; this.contract = k; snd.ui('ok'); G.ui.banner('CONTRATO: ' + c.name.toUpperCase(), k.text); }
  finishContract(cash, note, item) { const k = this.contract; if (!k) return; this.contract = null; const pl = G.player; pl.cash += cash; if (k.type === 'recon') this.uav(0, 18); if (k.type === 'capture') addItem(pl, 'uav', 1); if (item) addItem(pl, item, 2); snd.ui('cash'); G.ui.banner(note || 'CONTRATO CONCLUÍDO', `+$${cash}`); }
  updateContract(dt) { const k = this.contract; if (!k) return; const pl = G.player; k.t -= dt; if (k.type === 'bounty') { if (k.target.alive) k.target.revealT = G.time + 1; } else if (k.type === 'recon' || k.type === 'capture') { if (pl.alive && Math.hypot(pl.pos.x - k.x, pl.pos.z - k.z) < k.r) { k.done += dt; if (k.done >= k.need) this.finishContract(k.type === 'recon' ? 1800 : 2200); } }
    if (this.contract && k.t <= 0) { this.contract = null; G.ui.toast('Contrato expirou', '#e85a4a'); } }
  // ── laço principal ──
  update(dt) {
    const pl = G.player, z = this.zone; this.time += dt; for (const k in this.uavT) if (this.uavT[k] > 0) this.uavT[k] -= dt;
    if (this.phase === 'count') { this.countT -= dt; this.planePos(planeMesh.position, 0); planeMesh.visible = true; planeMesh.rotation.y = Math.atan2(-this.pd.x, -this.pd.z); this.planeCam(dt); if (this.countT <= 0) { this.phase = 'plane'; G.ui.banner('SALTE QUANDO QUISER', 'Toque em SALTAR'); } return; }
    if (this.phase === 'plane') { this.planeT += dt; this.planePos(planeMesh.position, this.planeT); loop('plane', true, { osc: [['sawtooth', 62], ['sawtooth', 93]], noise: true, cut: 420, vol: pl.mode === 'plane' ? 0.22 : 0.08 });
      for (const b of G.bots) if (b.mode === 'plane' && this.planeT > b.jumpT) this.botJump(b);
      if (pl.mode === 'plane') { this.planeCam(dt); const over = Math.abs(planeMesh.position.x) < 300 && Math.abs(planeMesh.position.z) < 300; if ((over && (hit('jump') || hit('interact'))) || this.planeT > this.planeDur - 3.5) { pl.pos.copy(planeMesh.position); pl.pos.y -= 4; pl.camY = pl.pos.y; pl.vel.set(this.pd.x * 20, -8, this.pd.z * 20); pl.mode = 'fall'; pl.yaw = Math.atan2(-this.pd.x, -this.pd.z); pl.pitch = -0.7; for (const b of G.bots) if (b.ally && b.mode === 'plane') { b.dropX = pl.pos.x; b.dropZ = pl.pos.z; this.botJump(b, true); } } }
      if (this.planeT >= this.planeDur) { this.phase = 'play'; planeMesh.visible = false; loop('plane', false); } }
    if (this.phase !== 'play' && this.phase !== 'plane') return;
    // zona
    if (z.active) { if (z.stage === 0 && !z.started) { z.started = true; z.stage = 1; this.pickNext(); z.shrinkIn = 75; } if (!z.shrinking) { z.shrinkIn -= dt; if (z.shrinkIn <= 0) { z.shrinking = true; z.t = 0; z.fx = z.x; z.fz = z.z; z.fr = z.r; z.dur = STAGES[Math.min(z.stage, STAGES.length - 1)][2]; z.dps = STAGES[Math.min(z.stage, STAGES.length - 1)][3]; G.ui.banner('A ZONA ESTÁ FECHANDO', ''); snd.ui('warn'); } }
      else { z.t += dt / z.dur; const k = Math.min(1, z.t); z.x = z.fx + (z.nx - z.fx) * k; z.z = z.fz + (z.nz - z.fz) * k; z.r = z.fr + (z.nextR - z.fr) * k; if (k >= 1) { z.stage++; if (z.stage < STAGES.length) this.pickNext(); else { z.shrinking = false; z.shrinkIn = 999; } } }
      zoneMesh.position.set(z.x, 60, z.z); zoneMesh.scale.set(Math.max(0.5, z.r), 1, Math.max(0.5, z.r));
      this.gasT = (this.gasT || 0) - dt; if (this.gasT <= 0) { this.gasT = 1; const dps = Math.max(2, z.dps); for (const a of G.actors) { if (!a.alive || a.mode === 'plane' || a.mode === 'gone' || (a.isPlayer && G.inGulag) || (this.gulag && a === this.gulag.bot)) continue; if (Math.hypot(a.pos.x - z.x, a.pos.z - z.z) > z.r) { if (a.maskHp > 0) { a.maskHp -= 1; if (a.maskHp <= 0) { a.inv.gasmask = 0; if (a.isPlayer) G.ui.toast('Máscara de gás quebrou', '#e85a4a'); } } else a.damage(dps, null, { zone: true }); } } } }
    if (this.gulag) this.updateGulag(dt);
    if (!pl.alive && this.result && (!this.spec || !this.spec.alive)) { this.spec = G.actors.find((a) => a.alive && a.team === 0) || G.actors.find((a) => a.alive && a.mode === 'ground') || null; }
    this.updateContract(dt);
    // jogador derrubado
    if (pl.alive && pl.downed) { pl.downT -= dt; if (pl.selfRev) { if (pl.downT <= 0) this.revive(pl); } else if (pl.downT <= 0) this.kill(pl, pl.lastHitBy, {}); }
    // respawns
    if (this.respawnT > 0) { this.respawnT -= dt; if (this.respawnT <= 0) { const k = this.respawnKind; if (k === 'gulag') this.startGulag(false); else if (k === 'redeploy') this.redeploy(pl, true); else if (k === 'res') { this.respawns[pl.id] = 0; this.redeploy(pl, false); } else if (k === 'treino') { pl.reset(); this.loadout(pl); pl.armor = 150; pl.cash = 5000; pl.inv.plate = 5; pl.inv.frag = 2; pl.teleport(0, G.terr.height(0, -36) + 0.2, -36); pl.mode = 'ground'; } } }
    for (const b of G.bots) { const r = this.respawns[b.id]; if (r > 0 && !b.alive) { this.respawns[b.id] = r - dt; if (this.respawns[b.id] <= 0) { this.respawns[b.id] = 0; if (this.zone.stage < 4) this.redeploy(b, false); else this.checkWin(); } } }
    if (this.mode === 'treino') { for (const b of G.bots) if (!b.alive && b.deadT > 8) { b.reset(); this.spawnBotGround(b, this.rng); giveStarter(b, this.rng); } }
    if (this.result && this.endT > 0) { this.endT -= dt; if (this.endT <= 0) { G.ui.showEnd(this.result); } }
  }
  botJump(b, withPlayer) { b.pos.copy(planeMesh.position); b.pos.y -= 4; b.mode = 'fall'; if (!withPlayer) { let best = -1; for (let k = 0; k < 8 && best < 0; k++) { const c = Loot.crates[(this.rng() * Loot.crates.length) | 0]; if (Math.hypot(c.x - b.pos.x, c.z - b.pos.z) < 200) best = nearestCell(c.x, c.z, 6, c.y > G.terr.height(c.x, c.z) + 2 ? null : c.y); } if (best < 0) best = nearestCell(clamp(b.pos.x, -280, 280) + (this.rng() - 0.5) * 80, clamp(b.pos.z, -280, 280) + (this.rng() - 0.5) * 80, 14); if (best < 0) best = nearestCell(0, -40, 10); b.cell = best; b.dropX = nav.wx[best]; b.dropZ = nav.wz[best]; } else { b.cell = nearestCell(b.dropX, b.dropZ, 12); } }
  planeCam(dt) { const pl = G.player, cam = G.camera; pl.pos.copy(planeMesh.position); const yaw = pl.yaw, pitch = clamp(pl.pitch, -1.2, 0.3); const cp = Math.cos(pitch); cam.position.set(planeMesh.position.x + Math.sin(yaw) * cp * 46, planeMesh.position.y + 10 - Math.sin(pitch) * 46, planeMesh.position.z + Math.cos(yaw) * cp * 46); cam.rotation.set(pitch, yaw, 0); setFov(S.fov); G.vmVisible = false; G.fpsView = false; pl.model.root.visible = false; }
  timerText() { const z = this.zone; if (!z.active) return this.mode === 'treino' ? 'TREINO' : this.gulag ? 'GULAG ' + fmtTime(this.gulag.t) : ''; return z.shrinking ? 'FECHANDO' : z.shrinkIn > 900 ? 'FINAL' : fmtTime(z.shrinkIn); }
}
export { burst };
