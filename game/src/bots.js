// Bots: máquina de estados (queda, loot, patrulha, combate, cobertura, zona, perseguição, aliado), com navegação em grade.
import * as THREE from 'three';
import { G } from './state.js';
import { S, DIFF, AMMO, WBY } from './config.js';
import { Actor, shoot, canSee, meleeAttack, newWeapon } from './actors.js';
import { nav, cellOf, nearestCell, findPath, stepToward, findCover, NN } from './nav.js';
import { Loot, openCrate, pickup, addItem } from './loot.js';
import { throwNade, decoys } from './equipment.js';
import { botLook } from './character.js';
import { snd } from './audio.js';
import { clamp, angDiff, rr } from './util.js';
import { SURF } from './terrain.js';

const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
const NAMES = ['Zé Droguinha', 'Tubarão', 'Cabeção', 'Fumaça', 'Neguinho', 'Pezão', 'Magrão', 'Coringa', 'Alemão', 'Baiano', 'Gordão', 'Fininho', 'Russo', 'Chapolin', 'Tiziu', 'Biro', 'Cascão', 'Madruga', 'Faísca', 'Pingo', 'Tatu', 'Jacaré', 'Bolacha', 'Zoio', 'Paçoca', 'Ligeirinho', 'Trovão', 'Sombra'];
let pathBudget = 0;
export class Bot extends Actor {
  constructor(i, team) { super({ name: NAMES[i % NAMES.length], team, look: botLook(i) }); this.idx = i; this.thinkT = Math.random() * 0.4; this.state = 'idle'; this.path = null; this.pi = 0; this.cell = -1; this.target = null; this.aimErr = 1; this.seenT = 0; this.strafe = 1; this.strafeT = 0; this.burstN = 0; this.pauseT = 0; this.destCell = -1; this.repathT = 0; this.lastKnown = null; this.stuckT = 0; this.goalT = 0; this.stepD = 0; this.hideT = 0; this.diff = DIFF[S.difficulty] || DIFF.normal; this.skill = 0.75 + Math.random() * 0.5; this.ally = false; }
  place(x, z, y) { const c = nearestCell(x, z, 10, y); if (c < 0) return false; this.cell = c; this.pos.set(nav.wx[c], nav.y[c], nav.wz[c]); this.path = null; return true; }
  goTo(c) { if (c < 0 || c === this.destCell && this.path) return; if (pathBudget <= 0) return; pathBudget--; const p = findPath(this.cell, c, false, 7000); this.destCell = c; if (p && p.length > 1) { this.path = p; this.pi = 1; } else { this.path = null; this.goalT = 0; } }
  bestWeaponScore(def) { return def ? def.rarity * 2 + ({ ar: 5, lmg: 5, smg: 4, sniper: 3, shotgun: 3, pistol: 1 })[def.cls] : 0; }
  lootHere(items) { for (const it of items) { if (!it.alive) continue; if (it.kind === 'w') { const d = WBY[it.id]; const sc = this.bestWeaponScore(d); const s0 = this.bestWeaponScore(this.weapons[0] && this.weapons[0].def), s1 = this.bestWeaponScore(this.weapons[1] && this.weapons[1].def); if (!this.weapons[0] || !this.weapons[1] || sc > Math.min(s0, s1)) { this.cur = !this.weapons[0] ? 0 : !this.weapons[1] ? 1 : s0 <= s1 ? 0 : 1; if (this.weapons[this.cur]) this.weapons[this.cur] = null; pickup(this, it); this.addAmmo(d.ammo, d.mag * 3); } } else if (it.kind === 'a') { if (this.weapons.some((w) => w && w.def.ammo === it.id)) pickup(this, it); } else if (it.kind === 'c') pickup(this, it); else if (it.kind === 'i' && ['plate', 'frag', 'smoke', 'revive'].includes(it.id)) pickup(this, it); }
    const s0 = this.bestWeaponScore(this.weapons[0] && this.weapons[0].def), s1 = this.bestWeaponScore(this.weapons[1] && this.weapons[1].def); this.cur = this.weapons[0] && (!this.weapons[1] || s0 >= s1) ? 0 : this.weapons[1] ? 1 : 2; while (this.armor < 150 && this.inv.plate > 0) { this.armor = Math.min(150, this.armor + 50); this.inv.plate--; } }
  think() {
    const M = G.match, pl = G.player; this.diff = DIFF[S.difficulty] || DIFF.normal;
    // percepção: inimigo visível mais "barato" (distância + penalidade se muitos já miram o jogador)
    let best = null, bs = 1e9; const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); const alert = G.time - (this.threatT || -9) < 4;
    if (this.stunT <= 0) for (const a of G.actors) { if (a === this || !a.alive || a.team === this.team || a.mode === 'plane' || a.mode === 'gone' || a.downed && a !== this.target) continue; const dx = a.pos.x - this.pos.x, dz = a.pos.z - this.pos.z, d = Math.hypot(dx, dz); const loud = a.revealT > G.time || (M.uavT[this.team] || 0) > 0; const range = (a.crouch || a.prone ? 55 : 85) + (loud ? 50 : 0); if (d > range) continue; const dot = (dx * fx + dz * fz) / (d || 1); if (dot < -0.2 && d > 12 && !alert && !loud && a !== this.threat) continue; let sc = d + (a.isPlayer && M.aimingAtPlayer >= 2 && this.target !== a ? 45 : 0) + (a === this.target ? -10 : 0) + (a === this.threat && alert ? -20 : 0); if (sc < bs && canSee(this, a)) { bs = sc; best = a; } }
    if (best) { if (this.target !== best) { this.seenT = G.time + this.diff.react * (0.7 + Math.random() * 0.6) / this.skill; this.aimErr = 1; } this.target = best; this.lastKnown = { x: best.pos.x, y: best.pos.y, z: best.pos.z, t: G.time }; } else if (this.target) { this.target = null; }
    const w = this.w; const hasGun = !!w; const lowHp = this.hp + this.armor < 60;
    const zone = M.zone; const dzx = this.pos.x - zone.x, dzz = this.pos.z - zone.z, dZone = Math.hypot(dzx, dzz); const outside = zone.active && dZone > zone.r - 4; const dNext = Math.hypot(this.pos.x - zone.nx, this.pos.z - zone.nz) - (zone.nextR - 8); const mustMove = zone.active && dNext > 0 && (zone.shrinking || zone.shrinkIn < dNext / 5 + 10); const gasHurt = outside && this.hp + this.armor < 90;
    if (this.ally && pl.alive && pl.downed && !pl.selfRev && this.pos.distanceTo(pl.pos) < 80 && !(this.target && this.pos.distanceTo(this.target.pos) < 12)) { this.state = 'revive'; this.goTo(nearestCell(pl.pos.x, pl.pos.z, 4, pl.pos.y)); }
    else if (this.target && hasGun && !gasHurt) { this.state = lowHp && this.hideT <= G.time && Math.random() < 0.5 ? 'cover' : this.state === 'cover' && this.hideT > G.time ? 'cover' : 'fight'; if (this.state === 'cover' && !(this.hideT > G.time)) { const t = this.target; const c = findCover(this.cell, t.pos.x, t.pos.y + t.eyeH(), t.pos.z); if (c >= 0) { this.hideT = G.time + 4 + Math.random() * 3; this.goTo(c); } else this.state = 'fight'; } }
    else if (this.target && !hasGun && !gasHurt) { const d = this.pos.distanceTo(this.target.pos); if (d < 14) { this.state = 'rush'; this.goTo(nearestCell(this.target.pos.x, this.target.pos.z, 4, this.target.pos.y)); } else this.state = 'loot'; }
    else if (outside || mustMove) { this.state = 'zone'; if (!this.path || this.goalT < G.time) { this.goalT = G.time + 6; const a = Math.atan2(this.pos.z - zone.nz, this.pos.x - zone.nx) + rr(Math.random, -0.5, 0.5), r = zone.nextR * rr(Math.random, 0.2, 0.75); this.goTo(nearestCell(zone.nx + Math.cos(a) * r, zone.nz + Math.sin(a) * r, 12)); } }
    else if (this.ally && pl.alive) { const d = this.pos.distanceTo(pl.pos); if (pl.downed && d < 60) { this.state = 'revive'; this.goTo(nearestCell(pl.pos.x, pl.pos.z, 4, pl.pos.y)); } else if (d > 16 || (d > 8 && !this.path && this.goalT < G.time)) { this.state = 'follow'; this.goalT = G.time + 2; const a = Math.random() * 6.28; this.goTo(nearestCell(pl.pos.x + Math.cos(a) * 5, pl.pos.z + Math.sin(a) * 5, 5, pl.pos.y)); } else if (!hasGun || this.needsLoot()) this.findLoot(30); else this.state = 'idle'; }
    else if (this.lastKnown && G.time - this.lastKnown.t < 7 && hasGun) { this.state = 'hunt'; this.goTo(nearestCell(this.lastKnown.x, this.lastKnown.z, 5, this.lastKnown.y)); }
    else if (decoys.length && hasGun && !this.path) { const d = decoys[0]; if (d.owner.team !== this.team && this.pos.distanceTo(d.p) < 70) { this.state = 'hunt'; this.goTo(nearestCell(d.p.x, d.p.z, 5)); } }
    else if (!hasGun || this.needsLoot() || this.state === 'loot') { if (!this.path || this.goalT < G.time) this.findLoot(90); }
    else if (!this.path || this.goalT < G.time) { this.state = 'roam'; this.goalT = G.time + 14 + Math.random() * 10; const a = Math.random() * 6.28, r = (zone.active ? zone.r : 280) * Math.sqrt(Math.random()) * 0.85; const c = nearestCell(clamp(zone.x + Math.cos(a) * r, -300, 300), clamp(zone.z + Math.sin(a) * r, -300, 300), 10); if (c >= 0 && Math.hypot(nav.wx[c] - this.pos.x, nav.wz[c] - this.pos.z) < 160) this.goTo(c); }
    // recarrega fora de combate, usa placas
    if (w && !this.target && w.ammo < w.def.mag * 0.5 && this.reloadT <= 0 && this.ammo[w.def.ammo] > 0) this.reload();
    if (!this.target && this.armor < 150 && this.inv.plate > 0) { this.armor = Math.min(150, this.armor + 50); this.inv.plate--; }
    if (w && w.ammo <= 0 && this.ammo[w.def.ammo] <= 0) { const o = this.weapons[1 - this.cur]; if (o && (o.ammo > 0 || this.ammo[o.def.ammo] > 0)) this.cur = 1 - this.cur; else { this.weapons[this.cur] = null; this.cur = o ? 1 - this.cur : 2; } }
  }
  needsLoot() { const w = this.w; return !w || this.bestWeaponScore(w.def) < 4 || this.ammo[w.def.ammo] + w.ammo < w.def.mag || (this.armor < 50 && this.inv.plate <= 0 && G.time < 150); }
  findLoot(maxD) { let best = null, bd = maxD * maxD; for (const c of Loot.crates) { if (c.open || c.claim && c.claim !== this && c.claimT > G.time) continue; const d = (c.x - this.pos.x) ** 2 + (c.z - this.pos.z) ** 2 + Math.abs(c.y - this.pos.y) * 400; if (d < bd && G.match.inZone(c.x, c.z, -5)) { bd = d; best = c; } }
    if (!this.w) for (const it of Loot.items) { if (!it.alive || it.kind !== 'w') continue; const d = (it.x - this.pos.x) ** 2 + (it.z - this.pos.z) ** 2 + Math.abs(it.y - this.pos.y) * 300; if (d < bd * 0.7) { bd = d; best = it; } }
    if (best) { this.state = 'loot'; this.lootT = best; this.goalT = G.time + 12; if (best.claim !== undefined || best.tier !== undefined) { best.claim = this; best.claimT = G.time + 15; } this.goTo(nearestCell(best.x, best.z, 5, best.y)); } else { this.state = 'roam'; this.lootT = null; } }
  reload() { const w = this.w; if (!w || this.reloadT > 0) return; this.reloadDur = w.def.reload * 1.1; this.reloadT = this.reloadDur; }
  update(dt, lod) {
    this.model.setShadow(lod === 0);
    this.spawnProt = Math.max(0, this.spawnProt - dt); this.stunT = Math.max(0, this.stunT - dt); this.cool -= dt; this.swingT = Math.max(0, this.swingT - dt);
    if (!this.alive) { this.deadT = (this.deadT || 0) + dt; this.syncModel(dt, lod < 2 && this.deadT < 12); return; }
    if (this.mode === 'gone') { this.model.root.visible = false; return; }
    if (this.mode === 'chute' || this.mode === 'fall') { const tx = this.dropX - this.pos.x, tz = this.dropZ - this.pos.z, d = Math.hypot(tx, tz) || 1; const hs = Math.min(13, d * 0.6); this.pos.x += (tx / d) * hs * dt; this.pos.z += (tz / d) * hs * dt; const gy = nav.y[this.cell >= 0 ? this.cell : 0] || G.terr.height(this.pos.x, this.pos.z); const agl = this.pos.y - G.terr.height(this.pos.x, this.pos.z); this.mode = agl > 70 ? 'fall' : 'chute'; this.pos.y -= (this.mode === 'fall' ? 42 : 9) * dt; this.yaw = Math.atan2(-tx, -tz); this.speed = hs; const c = cellOf(this.pos.x, this.pos.z); const fy = c >= 0 && nav.ok[c] ? nav.y[c] : G.terr.height(this.pos.x, this.pos.z); if (this.pos.y <= fy + 0.05 && d < 6 || this.pos.y <= G.terr.height(this.pos.x, this.pos.z)) { this.mode = 'ground'; this.place(this.pos.x, this.pos.z); this.onGround = true; } this.syncModel(dt, lod < 2); return; }
    if (this.downed) { this.downT -= dt; this.speed = 0; if (this.downT <= 0) G.match.kill(this, this.lastHitBy, {}); this.syncModel(dt, lod < 2); return; }
    if (G.time - this.lastDmgT > 7 && this.hp < 100) this.hp = Math.min(100, this.hp + 10 * dt);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { const w = this.w; if (w) { const need = w.def.mag - w.ammo, take = Math.min(need, this.ammo[w.def.ammo]); w.ammo += take; this.ammo[w.def.ammo] -= take; } } }
    this.thinkT -= dt; if (this.thinkT <= 0) { this.thinkT = (this.target ? 0.22 : 0.45) + Math.random() * 0.12; if (this.vehicle) { if (G.botVehicleThink) G.botVehicleThink(this); } else this.think(); }
    if (this.vehicle) { this.pos.copy(this.vehicle.pos); this.yaw = this.vehicle.yaw; this.speed = 0; this.syncModel(dt, lod < 2); return; }
    const t = this.target; let moveSp = 0, wantYaw = this.yaw; this.sprinting = false; this.crouch = false;
    // movimento ao longo do caminho
    const follow = (sp) => { if (!this.path || this.pi >= this.path.length) { this.path = null; return false; } const c = this.path[this.pi]; const tx = nav.wx[c] - this.pos.x, tz = nav.wz[c] - this.pos.z, d = Math.hypot(tx, tz); const stp = sp * dt; if (d <= stp + 0.05) { this.pos.x = nav.wx[c]; this.pos.z = nav.wz[c]; this.cell = c; this.pi++; if (this.pi >= this.path.length) this.path = null; } else { this.pos.x += (tx / d) * stp; this.pos.z += (tz / d) * stp; if (d > 0.3) wantYaw = Math.atan2(-tx, -tz); } moveSp = sp; this.moveF = 1; this.moveS = 0; return true; };
    if (this.stunT > 0) { /* atordoado: parado */ }
    else if (this.state === 'fight' && t) {
      const dx = t.pos.x - this.pos.x, dz = t.pos.z - this.pos.z, d = Math.hypot(dx, dz); wantYaw = Math.atan2(-dx, -dz); const w = this.w, ideal = w ? Math.min(w.def.range[0] * 0.9, 38) : 2;
      this.strafeT -= dt; if (this.strafeT <= 0) { this.strafeT = 0.7 + Math.random() * 1.2; this.strafe = Math.random() < 0.5 ? -1 : 1; this.fightMove = d > ideal * 1.5 ? 1 : d < ideal * 0.35 ? -1 : 0; if (Math.random() < 0.25) this.fightMove = 0; this.crouchF = Math.random() < 0.3 && d > 12; }
      if (!this.path) { const px = -dz / (d || 1) * this.strafe + (dx / (d || 1)) * this.fightMove, pz = dx / (d || 1) * this.strafe + (dz / (d || 1)) * this.fightMove; const n = stepToward(this.cell, px, pz); if (n >= 0) { this.path = [this.cell, n]; this.pi = 1; } else this.strafe *= -1; }
      const yw = this.yaw; if (!this.crouchF) follow(3.1); wantYaw = Math.atan2(-dx, -dz); this.moveF = this.fightMove; this.moveS = this.strafe; this.crouch = !!this.crouchF; if (this.crouchF) this.path = null;
      this.combat(dt, t, d);
    }
    else if (this.state === 'cover') { if (!follow(5.6)) { this.crouch = true; if (t) { wantYaw = Math.atan2(-(t.pos.x - this.pos.x), -(t.pos.z - this.pos.z)); } if (this.w && this.w.ammo < this.w.def.mag && this.reloadT <= 0) this.reload(); if (this.inv.plate > 0 && this.armor < 150) { this.armor += 50; this.inv.plate--; } } else this.sprinting = true; }
    else if (this.state === 'rush' && t) { follow(6.2); this.sprinting = true; const d = this.pos.distanceTo(t.pos); if (d < 1.9) { wantYaw = Math.atan2(-(t.pos.x - this.pos.x), -(t.pos.z - this.pos.z)); this.yaw = wantYaw; this.pitch = 0; if (this.cool <= 0) meleeAttack(this); } }
    else if (this.state === 'revive') { const pl = G.player; if (!follow(6)) { /* chegou */ } if (pl.downed && this.pos.distanceTo(pl.pos) < 2.2) { this.crouch = true; pl.reviveP = (pl.reviveP || 0) + dt; if (pl.reviveP > 3.5) G.match.revive(pl); } }
    else { const run = this.state === 'zone' || this.state === 'hunt' || this.state === 'follow'; if (follow(run ? 6.0 : this.state === 'loot' ? 5.2 : 3.6)) this.sprinting = run; else if (this.state === 'loot' && this.lootT) { const L = this.lootT; this.lootT = null; if (Math.hypot(L.x - this.pos.x, L.z - this.pos.z) < 4.5) { if (L.tier !== undefined && !L.kind) { if (!L.open) this.lootHere(openCrate(L, this)); } else if (L.alive) this.lootHere([L]); // itens próximos também
            const near = Loot.items.filter((it) => it.alive && (it.x - this.pos.x) ** 2 + (it.z - this.pos.z) ** 2 < 16 && Math.abs(it.y - this.pos.y) < 1.5); this.lootHere(near); } this.goalT = 0; this.state = 'idle'; } }
    // portas no caminho: abre
    if (moveSp > 0) { this.doorT = (this.doorT || 0) - dt; if (this.doorT <= 0) { this.doorT = 0.3; for (const d of G.world.doors) { if (!d.open && Math.abs(d.x - this.pos.x) < 1.8 && Math.abs(d.z - this.pos.z) < 1.8 && this.pos.y > d.lo - 1 && this.pos.y < d.hi) { G.world.setDoor(d, true); snd.door(d); } } } }
    // altura: interpola no piso da navegação
    if (this.cell >= 0) { let ty = nav.y[this.cell]; if (this.path && this.pi < this.path.length) { const c = this.path[this.pi], p = this.path[this.pi - 1] !== undefined ? this.path[this.pi - 1] : this.cell; const seg = Math.hypot(nav.wx[c] - nav.wx[p], nav.wz[c] - nav.wz[p]) || 1; const k = clamp(1 - Math.hypot(nav.wx[c] - this.pos.x, nav.wz[c] - this.pos.z) / seg, 0, 1); ty = nav.y[p] + (nav.y[c] - nav.y[p]) * k; } this.pos.y += (ty - this.pos.y) * Math.min(1, dt * 14); }
    this.speed = moveSp; const dyaw = angDiff(this.yaw, wantYaw); this.yaw += dyaw * Math.min(1, dt * (t ? 9 : 7)); if (!t) this.pitch *= 1 - Math.min(1, dt * 4);
    if (moveSp > 0.5 && lod < 2) { this.stepD += moveSp * dt; if (this.stepD > 2.2) { this.stepD = 0; snd.step(this.pos.y > G.terr.height(this.pos.x, this.pos.z) + 0.1 ? 'piso' : SURF[G.terr.type(this.pos.x, this.pos.z)], this.pos, this.sprinting, false); } }
    this.syncModel(dt, lod < 2);
  }
  combat(dt, t, d) {
    const w = this.w; if (!w) return; const def = w.def; const ey = this.pos.y + this.eyeH(), ty = t.pos.y + t.eyeH() * (def.cls === 'sniper' ? 0.95 : 0.72); const wantP = Math.atan2(ty - ey, d); this.pitch += (wantP - this.pitch) * Math.min(1, dt * 8);
    this.aimErr = Math.max(0, this.aimErr - dt * (0.9 + this.skill * 0.6) * (0.6 + this.diff.acc)); if (t.speed > 5) this.aimErr = Math.max(this.aimErr, 0.25); if (t.isPlayer) G.match.aimingNow++;
    if (G.time < this.seenT || this.reloadT > 0) return; if (w.ammo <= 0) { if (this.ammo[def.ammo] > 0) this.reload(); return; }
    const facing = Math.abs(angDiff(this.yaw, Math.atan2(-(t.pos.x - this.pos.x), -(t.pos.z - this.pos.z)))) < 0.2; if (!facing || this.cool > 0) return; if (d > def.range[1] * 1.3 && def.cls !== 'sniper') { if (this.fightMove !== 1) this.fightMove = 1; return; }
    if (this.pauseT > 0) { this.pauseT -= dt; return; } if (this.burstN <= 0) { this.burstN = def.mode === 'auto' ? 3 + ((Math.random() * 5) | 0) : def.mode === 'burst' ? 3 : 1; }
    // erro de mira: cresce com distância, cai com habilidade e tempo mirando
    const base = (1.6 + d * 0.035) * (1.25 - this.diff.acc * 0.6) / this.skill + this.aimErr * 5 + (this.speed > 1 ? 0.8 : 0) + (t.crouch ? 0.4 : 0) + (t.prone ? 0.8 : 0);
    const e = this.eye(V); V2.set(t.pos.x - e.x, ty - e.y, t.pos.z - e.z).normalize(); const mz = V3.set(e.x + V2.x * 0.8, e.y - 0.12 + V2.y * 0.8, e.z + V2.z * 0.8);
    w.ammo--; shoot(this, w, e, V2, base + def.spread[1], mz, this.diff.dmg * (t.isPlayer ? 1 : 0.55)); this.cool = 60 / def.rpm * (def.mode === 'semi' ? 1.6 : 1); this.burstN--; if (this.burstN <= 0) this.pauseT = (def.mode === 'bolt' || def.mode === 'pump' ? 0.2 : 0.35) + Math.random() * 0.6 * (1.4 - this.diff.acc * 0.5);
    if (this.inv.frag > 0 && d > 9 && d < 26 && Math.random() < 0.004) { V2.y += 0.25; V2.normalize(); throwNade(this, 'frag', V2.clone()); }
  }
}
export function botsFrame() { pathBudget = 3; if (G.match) { G.match.aimingAtPlayer = G.match.aimingNow; G.match.aimingNow = 0; } }
export function giveStarter(b, rngF) { const ids = ['lambari', 'piranha', 'vespa', 'marimbondo', 'guara', 'onca', 'jararaca']; const id = ids[(rngF() * (b.ally ? ids.length : 4)) | 0]; b.weapons[0] = newWeapon(id); b.cur = 0; b.addAmmo(WBY[id].ammo, WBY[id].mag * 3); }
export { AMMO, addItem, NN };
