// Atores (jogador e bots): vida, colete, armas, inventário e combate por traçado de raio.
import * as THREE from 'three';
import { G } from './state.js';
import { WBY, WEAPONS, AMMO, MELEE, ITEMS } from './config.js';
import { Humanoid } from './character.js';
import { buildWeapon } from './weaponmodels.js';
import { F } from './physics.js';
import { tracer, impact, muzzleFlash, explosionFx, glassFx, burst, inSmoke } from './fx.js';
import { snd } from './audio.js';
import { clamp } from './util.js';
import { SURF } from './terrain.js';

const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3();
let nextId = 1;
export const newWeapon = (id, optic) => { const d = WBY[id]; return { def: d, ammo: d.mag, optic: optic || d.optic }; };
export class Actor {
  constructor(o) { this.id = nextId++; this.name = o.name; this.team = o.team; this.isPlayer = !!o.isPlayer; this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.model = new Humanoid(o.look); this.model.root.visible = false; G.scene.add(this.model.root); this.anim = {}; this.reset(); }
  reset() { this.hp = 100; this.armor = 0; this.alive = true; this.downed = false; this.downT = 0; this.weapons = [null, null]; this.cur = 2; this.melee = 'punhos'; this.ammo = {}; for (const k in AMMO) this.ammo[k] = 0; this.inv = { plate: 0, frag: 0, smoke: 0, stun: 0, decoy: 0, uav: 0, drone: 0, ammobox: 0, gasmask: 0, revive: 0 }; this.tacSel = 'smoke'; this.cash = 0; this.kills = 0; this.dmgDone = 0; this.crouch = false; this.prone = false; this.sliding = false; this.onGround = true; this.vehicle = null; this.mode = 'ground'; this.cool = 0; this.reloadT = 0; this.reloadDur = 0; this.swingT = 0; this.bloom = 0; this.lastDmgT = -99; this.lastShotT = -99; this.fireFlag = false; this.stunT = 0; this.spawnProt = 0; this.gulagUsed = false; this.speed = 0; this.revealT = 0; this.maskHp = 0; this._wkey = null; }
  get w() { return this.cur < 2 ? this.weapons[this.cur] : null; }
  eyeH() { return (this.prone ? 0.34 : this.crouch || this.sliding ? 1.02 : 1.6) * (this.model.look.h || 1); }
  eye(out) { return out.set(this.pos.x, this.pos.y + this.eyeH(), this.pos.z); }
  fwd(out) { const cp = Math.cos(this.pitch); return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp); }
  give(id, optic) { const w = newWeapon(id, optic); const s = !this.weapons[0] ? 0 : !this.weapons[1] ? 1 : this.cur < 2 ? this.cur : 0; const old = this.weapons[s]; this.weapons[s] = w; this.cur = s; this.reloadT = 0; return old; }
  addAmmo(type, n) { const m = AMMO[type].max; const add = Math.min(n, m - this.ammo[type]); this.ammo[type] += add; return add; }
  // Esferas de acerto conforme a postura (cabeça, tronco, pernas).
  hitSpheres(out) { const p = this.pos, h = this.model.look.h || 1; let n = 0; const put = (x, y, z, r, zone) => { const o = out[n] || (out[n] = {}); o.x = x; o.y = y; o.z = z; o.r = r; o.zone = zone; n++; };
    if (this.prone) { const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); put(p.x + fx * 0.72, p.y + 0.3, p.z + fz * 0.72, 0.16, 0); put(p.x + fx * 0.3, p.y + 0.22, p.z + fz * 0.3, 0.27, 1); put(p.x - fx * 0.3, p.y + 0.2, p.z - fz * 0.3, 0.26, 2); put(p.x - fx * 0.8, p.y + 0.16, p.z - fz * 0.8, 0.2, 2); }
    else if (this.crouch || this.sliding || this.vehicle) { put(p.x, p.y + 1.04 * h, p.z, 0.16, 0); put(p.x, p.y + 0.72 * h, p.z, 0.3, 1); put(p.x, p.y + 0.3, p.z, 0.3, 2); }
    else { put(p.x, p.y + 1.62 * h, p.z, 0.155, 0); put(p.x, p.y + 1.2 * h, p.z, 0.3, 1); put(p.x, p.y + 0.82 * h, p.z, 0.29, 1); put(p.x, p.y + 0.38, p.z, 0.26, 2); }
    return n; }
  damage(dmg, from, o = {}) {
    if (!this.alive || this.spawnProt > 0 || this.mode === 'plane') return 0; if (this.isPlayer && G.dev.god) return 0; if (from && from !== this && from.team === this.team && G.match && G.match.teamSize > 1) return 0;
    let d = dmg; if (!o.zone && !o.fall && this.armor > 0) { const a = Math.min(this.armor, d); this.armor -= a; d -= a; if (this.armor <= 0) { if (this.isPlayer || (from && from.isPlayer)) snd.ui('armorbreak'); if (from && from.isPlayer) G.ui && G.ui.hitmark('break'); } }
    this.hp -= d; this.lastDmgT = G.time; if (from && from !== this) { this.lastHitBy = from; from.dmgDone += dmg; this.threat = from; this.threatT = G.time; }
    if (this.isPlayer && G.ui) G.ui.hurt(from, o);
    if (this.hp <= 0) { this.hp = 0; G.match && G.match.onDown(this, from, o); }
    return dmg;
  }
  // Atualiza o modelo 3D em terceira pessoa.
  syncModel(dt, visible) { const m = this.model, r = m.root; r.visible = visible; if (!visible) return; r.position.copy(this.pos); if (this.vehicle) r.position.y += 0.0; r.rotation.y = this.yaw; const w = this.w; const key = w ? w.def.id + w.optic : this.cur === 2 ? 'melee' : ''; if (key !== this._wkey) { this._wkey = key; m.setWeapon(w ? buildWeapon(w.def, w.optic) : null); }
    const a = this.anim; a.speed = this.speed; a.fwd = this.moveF || 0; a.strafe = this.moveS || 0; a.crouch = this.crouch; a.prone = this.prone || this.downed; a.slide = this.sliding; a.air = !this.onGround && this.mode === 'ground' && !this.vehicle; a.pitch = this.pitch; a.armed = this.downed ? null : w ? (w.def.cls === 'pistol' ? 'pistol' : 'rifle') : this.melee ? 'melee' : null; a.sprint = this.sprinting; a.dead = !this.alive; a.chute = this.mode === 'chute'; a.fall = this.mode === 'fall'; a.drive = !!this.vehicle; a.reload = this.reloadT > 0 ? 1 - this.reloadT / this.reloadDur : 0; a.swing = this.swingT > 0 ? 1 - this.swingT / 0.4 : 0; a.fire = this.fireFlag; this.fireFlag = false; m.update(dt, a); }
}

const sph = []; const hitRes = { actor: null, t: 0, zone: 1 };
// Raio contra todos os atores vivos (exceto 'self'). Retorna o mais próximo antes de maxT.
export function rayActors(ox, oy, oz, dx, dy, dz, maxT, self) { let best = maxT, hitA = null, zone = 1;
  for (const a of G.actors) { if (a === self || !a.alive || a.mode === 'plane' || a.mode === 'gone') continue; const ax = a.pos.x - ox, az = a.pos.z - oz, ay = a.pos.y + 1 - oy; const tc = ax * dx + ay * dy + az * dz; if (tc < -2 || tc > best + 2) continue; const d2 = ax * ax + ay * ay + az * az - tc * tc; if (d2 > 3.2) continue;
    const n = a.hitSpheres(sph); for (let i = 0; i < n; i++) { const s = sph[i]; const lx = s.x - ox, ly = s.y - oy, lz = s.z - oz; const t = lx * dx + ly * dy + lz * dz; if (t < 0) continue; const q = lx * lx + ly * ly + lz * lz - t * t; if (q > s.r * s.r) continue; const th = t - Math.sqrt(s.r * s.r - q); if (th < best) { best = th; hitA = a; zone = s.zone; } } }
  if (!hitA) return null; hitRes.actor = hitA; hitRes.t = best; hitRes.zone = zone; return hitRes; }
export function dmgAt(def, dist) { const [a, b] = def.range; const k = dist <= a ? 1 : dist >= b ? def.minMul : 1 - ((dist - a) / (b - a)) * (1 - def.minMul); return def.dmg * k; }

// Disparo de um ator. origin/dir = olhos e direção de mira; muzzle = ponto visual da boca do cano.
export function shoot(actor, w, origin, dir, spreadDeg, muzzle, dmgMul = 1) {
  const def = w.def, ph = G.phys; actor.lastShotT = G.time; actor.fireFlag = true; actor.revealT = G.time + 2.5; snd.shot(def.snd, actor.pos, actor.isPlayer); if (muzzle && !(actor.isPlayer && G.fpsView)) muzzleFlash(muzzle, def.cls === 'sniper' || def.cls === 'shotgun' ? 0.9 : 0.55);
  let hitSomeone = false;
  for (let p = 0; p < def.pellets; p++) {
    const sp = (spreadDeg * Math.PI) / 180; const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * sp;
    V.set(dir.x, dir.y, dir.z); V2.set(-dir.z, 0, dir.x).normalize(); V3.crossVectors(V2, V).normalize(); V.addScaledVector(V2, Math.cos(a) * Math.tan(r)).addScaledVector(V3, Math.sin(a) * Math.tan(r)).normalize();
    const max = def.range[1] * 1.6 + 40; let wall = ph.ray(origin.x, origin.y, origin.z, V.x, V.y, V.z, max); let wt = wall ? wall.t : max;
    // vidro: quebra e continua
    if (wall && wall.i >= 0 && (ph.b[wall.i].f & F.GLASS)) { const g = ph.b[wall.i].ref; if (G.world.breakGlass(g)) glassFx(g); wall = ph.ray(origin.x, origin.y, origin.z, V.x, V.y, V.z, max); wt = wall ? wall.t : max; }
    const h = rayActors(origin.x, origin.y, origin.z, V.x, V.y, V.z, wt, actor); const vh = G.rayVehicles ? G.rayVehicles(origin, V, h ? h.t : wt, actor.vehicle) : null;
    const endT = vh ? vh.t : h ? h.t : wt; const end = V3.set(origin.x + V.x * endT, origin.y + V.y * endT, origin.z + V.z * endT);
    if (muzzle && (p === 0 || def.pellets > 1) && (actor.isPlayer || Math.random() < 0.7)) tracer(muzzle, end);
    if (vh) { vh.v.damage(dmgAt(def, endT) * dmgMul * 0.6, actor); impact(end, -V.x, 0.3, -V.z, 'metal'); }
    else if (h) { const base = dmgAt(def, h.t) * dmgMul; const mul = h.zone === 0 ? def.hs : h.zone === 2 ? 0.85 : 1; const had = h.actor.armor > 0; const done = h.actor.damage(base * mul, actor, { head: h.zone === 0 }); impact(end, -V.x, 0.2, -V.z, 'flesh'); if (done && actor.isPlayer) { hitSomeone = true; G.ui && G.ui.hitmark(h.zone === 0 ? 'head' : had ? 'armor' : 'hit', !h.actor.alive || h.actor.downed); } }
    else if (wall) { const surf = wall.i === -2 ? SURF[G.terr.type(end.x, end.z)] : 'wall'; impact(end, wall.nx, wall.ny, wall.nz, surf); }
  }
  return hitSomeone;
}
// Explosão com dano em área e bloqueio por paredes.
export function explode(pos, radius, dmg, owner) { explosionFx(pos, radius); const ph = G.phys;
  for (const a of G.actors) { if (!a.alive) continue; const dx = a.pos.x - pos.x, dy = a.pos.y + 1 - pos.y, dz = a.pos.z - pos.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d > radius) continue; if (!ph.los(pos.x, pos.y + 0.3, pos.z, a.pos.x, a.pos.y + 1, a.pos.z)) continue; const k = 1 - (d / radius) * 0.85; a.damage(dmg * k * (a.prone ? 0.7 : 1), owner, { explosive: true }); }
  for (const v of G.vehicles) { const d = v.pos.distanceTo(pos); if (d < radius + 2) v.damage(dmg * 1.5 * (1 - d / (radius + 2)), owner); }
  for (const g of G.world.glass) { if (!g.on) continue; const gx = g.axis === 'x' ? (g.a + g.b) / 2 : g.c, gz = g.axis === 'x' ? g.c : (g.a + g.b) / 2; if ((gx - pos.x) ** 2 + (gz - pos.z) ** 2 + ((g.lo + g.hi) / 2 - pos.y) ** 2 < radius * radius) { G.world.breakGlass(g); glassFx(g); } } }
export function meleeAttack(actor) { const m = MELEE[actor.melee] || MELEE.punhos; actor.swingT = 0.4; actor.cool = m.rate; const o = actor.eye(V), d = actor.fwd(V2); const wall = G.phys.ray(o.x, o.y, o.z, d.x, d.y, d.z, m.range); const h = rayActors(o.x, o.y, o.z, d.x, d.y, d.z, wall ? wall.t : m.range, actor); let hitA = h && h.actor;
  if (!hitA) for (const a of G.actors) { if (a === actor || !a.alive) continue; const dx = a.pos.x - actor.pos.x, dz = a.pos.z - actor.pos.z, dd = Math.hypot(dx, dz); if (dd < m.range && Math.abs(a.pos.y - actor.pos.y) < 1.6 && (dx * d.x + dz * d.z) / (dd || 1) > 0.6) { hitA = a; break; } }
  if (hitA) { hitA.damage(m.dmg, actor, {}); V3.set(hitA.pos.x, hitA.pos.y + 1.2, hitA.pos.z); burst(V3, 5, { color: [0.55, 0.08, 0.06], speed: 2, size: 0.07, life: 0.4 }); if (actor.isPlayer && G.ui) G.ui.hitmark('hit', !hitA.alive); } else if (wall && wall.i >= 0 && (G.phys.b[wall.i].f & F.GLASS)) { const g = G.phys.b[wall.i].ref; if (G.world.breakGlass(g)) glassFx(g); }
  snd.melee(!!hitA); return !!hitA; }
// Visão entre dois atores (paredes + fumaça).
export function canSee(a, b) { const ax = a.pos.x, ay = a.pos.y + a.eyeH(), az = a.pos.z, bx = b.pos.x, by = b.pos.y + b.eyeH() * 0.8, bz = b.pos.z; if (inSmoke(ax, ay, az, bx, by, bz)) return false; return G.phys.los(ax, ay, az, bx, by, bz); }
export function randomWeapon(rng, tier = 0) { const pool = WEAPONS.filter((w) => w.rarity <= tier + 1 && (tier > 0 || w.rarity < 2)); return pool[(rng() * pool.length) | 0].id; }
export { ITEMS };
