// Loot: caixas de suprimentos, itens no chão, coleta, descarte, inventário e lojas (Buy Stations).
import * as THREE from 'three';
import { G } from './state.js';
import { WBY, WEAPONS, AMMO, ITEMS, RARITY, SHOP } from './config.js';
import { newWeapon, randomWeapon } from './actors.js';
import { buildWeapon } from './weaponmodels.js';
import { part, VMAT } from './mesh.js';
import { snd } from './audio.js';
import { store, mulberry } from './util.js';

export const Loot = { crates: [], items: [], free: [], boxes: [] };
const MAXI = 700; let crateMesh, lidMesh, markMesh; const M4 = new THREE.Matrix4(), C = new THREE.Color(), Z0 = new THREE.Matrix4().makeScale(0, 0, 0), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S1 = new THREE.Vector3(1, 1, 1);
const TIERCOL = [0x5a6b4a, 0x3a6a9a, 0xb07a1a];
export function initLoot() {
  const W = G.world; const body = part([['box', [0, 0.26, 0, 1.0, 0.52, 0.62], 0xffffff], ['box', [0, 0.26, 0, 1.03, 0.08, 0.65], 0x2a2c30], ['box', [-0.42, 0.26, 0, 0.06, 0.54, 0.64], 0x2a2c30], ['box', [0.42, 0.26, 0, 0.06, 0.54, 0.64], 0x2a2c30]]); const lid = part([['box', [0, 0.05, -0.31, 1.02, 0.1, 0.64], 0xffffff], ['box', [0, 0.06, -0.62, 0.16, 0.08, 0.04], 0xd9a520]]);
  crateMesh = new THREE.InstancedMesh(body, VMAT, W.crates.length); lidMesh = new THREE.InstancedMesh(lid, VMAT, W.crates.length); crateMesh.frustumCulled = lidMesh.frustumCulled = false; crateMesh.castShadow = true; G.scene.add(crateMesh, lidMesh);
  markMesh = new THREE.InstancedMesh(part([['box', [0, 0.09, 0, 0.3, 0.16, 0.2], 0xffffff], ['box', [0, 0.18, 0, 0.32, 0.03, 0.22], 0x999999]]), VMAT, MAXI); markMesh.frustumCulled = false; G.scene.add(markMesh);
  Loot.crates = W.crates.map((c, i) => ({ ...c, i, open: false, rot: ((i * 37) % 4) * Math.PI / 2 }));
}
function setCrate(c) { Q.setFromAxisAngle(V.set(0, 1, 0), c.rot); M4.compose(V.set(c.x, c.y, c.z), Q, S1); crateMesh.setMatrixAt(c.i, M4); crateMesh.setColorAt(c.i, C.setHex(TIERCOL[c.tier] || TIERCOL[0])); const e = new THREE.Euler(c.open ? -1.9 : 0, c.rot, 0, 'YXZ'); Q.setFromEuler(e); const off = new THREE.Vector3(0, 0.52, 0.31).applyAxisAngle(new THREE.Vector3(0, 1, 0), c.rot); M4.compose(V.set(c.x + off.x, c.y + off.y, c.z + off.z), Q, S1); lidMesh.setMatrixAt(c.i, M4); lidMesh.setColorAt(c.i, C.setHex(TIERCOL[c.tier] || TIERCOL[0])); }
export function itemName(it) { return it.kind === 'w' ? WBY[it.id].name : it.kind === 'a' ? `Munição ${AMMO[it.id].n} ×${it.n}` : it.kind === 'c' ? `$${it.n}` : ITEMS[it.id].n + (it.n > 1 ? ` ×${it.n}` : ''); }
export function itemRarity(it) { return it.kind === 'w' ? WBY[it.id].rarity : it.kind === 'i' ? ITEMS[it.id].r : it.kind === 'c' ? 1 : 0; }
export function dropItem(kind, id, n, x, y, z, extra) { const it = { kind, id, n, x, y, z, alive: true, slot: -1, mesh: null, ...extra }; if (kind !== 'w') { const s = Loot.free.length ? Loot.free.pop() : Loot.next < MAXI ? Loot.next++ : -1; it.slot = s; if (s >= 0) { M4.makeRotationY(((x * 13 + z * 7) % 6)); M4.setPosition(x, y, z); markMesh.setMatrixAt(s, M4); const col = kind === 'a' ? AMMO[id].col : kind === 'c' ? '#58d878' : RARITY[ITEMS[id].r].c; markMesh.setColorAt(s, C.set(col)); markMesh.instanceMatrix.needsUpdate = true; if (markMesh.instanceColor) markMesh.instanceColor.needsUpdate = true; } } Loot.items.push(it); return it; }
function removeItem(it) { it.alive = false; if (it.slot >= 0) { markMesh.setMatrixAt(it.slot, Z0); markMesh.instanceMatrix.needsUpdate = true; Loot.free.push(it.slot); } if (it.mesh) { G.scene.remove(it.mesh); it.mesh.traverse((o) => o.geometry && o.geometry.dispose()); it.mesh = null; } }
function rollItems(rng, tier, n, x, y, z, spread = 0.9) { const out = []; const put = (kind, id, cnt, extra) => { const a = rng() * 6.283, r = 0.5 + rng() * spread; out.push(dropItem(kind, id, cnt, x + Math.cos(a) * r, y, z + Math.sin(a) * r, extra)); };
  for (let i = 0; i < n; i++) { const r = rng(); if (i === 0 && n > 1 || r < 0.22) { const id = randomWeapon(rng, tier); const d = WBY[id]; put('w', id, 1, { ammo: d.mag, optic: tier > 0 && rng() < 0.35 && d.cls !== 'pistol' ? ['reddot', 'holo', 'x3'][(rng() * 3) | 0] : d.optic }); put('a', d.ammo, Math.round(d.mag * (1.5 + rng() * 1.5))); }
    else if (r < 0.42) { const k = Object.keys(AMMO)[(rng() * 5) | 0]; put('a', k, k === '12g' ? 12 : k === '308' ? 15 : 45 + ((rng() * 3) | 0) * 15); } else if (r < 0.58) put('i', 'plate', 1 + (rng() < 0.3 ? 1 : 0)); else if (r < 0.72) put('c', 'cash', (2 + ((rng() * (6 + tier * 6)) | 0)) * 100);
    else if (r < 0.8) put('i', 'frag', 1); else if (r < 0.86) put('i', ['smoke', 'stun', 'decoy'][(rng() * 3) | 0], 1); else if (r < 0.9) put('i', ['reddot', 'holo', 'x3', 'x8'][Math.min(3, (rng() * (2.4 + tier)) | 0)], 1);
    else if (tier > 0 && r < 0.93) put('i', 'gasmask', 1); else if (tier > 0 && r < 0.955) put('i', rng() < 0.5 ? 'ammobox' : 'drone', 1); else if (tier > 1 && r < 0.975) put('i', 'uav', 1); else if (tier > 1 && r < 0.99) put('i', 'revive', 1); else put('i', rng() < 0.5 ? 'faca' : 'plate', 1); }
  return out; }
export function spawnLoot(seed) { for (const it of Loot.items) if (it.alive) removeItem(it); Loot.items = []; Loot.free = []; Loot.next = 0; for (let i = 0; i < MAXI; i++) markMesh.setMatrixAt(i, Z0); Loot.boxes.forEach((b) => G.scene.remove(b.mesh)); Loot.boxes = [];
  const rng = mulberry(seed); Loot.rng = rng; for (const c of Loot.crates) { c.open = false; setCrate(c); } crateMesh.instanceMatrix.needsUpdate = lidMesh.instanceMatrix.needsUpdate = true; if (crateMesh.instanceColor) { crateMesh.instanceColor.needsUpdate = true; lidMesh.instanceColor.needsUpdate = true; }
  for (const s of G.world.loot) { if (rng() > 0.36) continue; rollItems(rng, s.tier, 1, s.x, s.y + 0.02, s.z, 0.2); } markMesh.instanceMatrix.needsUpdate = true; }
export function openCrate(c, actor) { if (c.open) return []; c.open = true; setCrate(c); crateMesh.instanceMatrix.needsUpdate = lidMesh.instanceMatrix.needsUpdate = true; snd.door(c); if (G.match) G.match.onCrate(c, actor); return rollItems(Loot.rng, c.tier, 3 + c.tier, c.x, c.y + 0.02, c.z); }
// Coloca um item no inventário do ator. Retorna a quantidade aceita.
export function addItem(a, id, n = 1) { const it = ITEMS[id]; if (!it) return 0; if (it.optic) { const w = a.w; if (!w || w.def.cls === 'pistol') return 0; w.optic = it.optic; a._wkey = null; return 1; } if (id === 'faca') { if (a.melee === 'faca') return 0; a.melee = 'faca'; return 1; } if (id === 'gasmask') { if (a.maskHp > 50) return 0; a.maskHp = 60; a.inv.gasmask = 1; return 1; } const max = it.max || 1; const add = Math.min(n, max - (a.inv[id] || 0)); if (add > 0) { a.inv[id] = (a.inv[id] || 0) + add; if (it.slot === 'tactical') a.tacSel = id; if (it.slot === 'field') a.fieldSel = id; } return add; }
export function pickup(a, it, manual) { if (!it.alive) return false;
  if (it.kind === 'w') { const old = a.give(it.id, it.optic); a.w.ammo = it.ammo != null ? it.ammo : a.w.def.mag; removeItem(it); if (old) dropItem('w', old.def.id, 1, a.pos.x, a.pos.y + 0.03, a.pos.z, { ammo: old.ammo, optic: old.optic }); if (a.isPlayer) { a.drawT = 0.35; snd.ui('pick'); G.ui.toast('Pegou ' + WBY[it.id].name, RARITY[WBY[it.id].rarity].c); } return true; }
  if (it.kind === 'a') { const add = a.addAmmo(it.id, it.n); if (add <= 0) return false; it.n -= add; if (it.n <= 0) removeItem(it); if (a.isPlayer) { snd.ui('pick'); G.ui.pick(`+${add} ${AMMO[it.id].n}`); } return true; }
  if (it.kind === 'c') { a.cash += it.n; removeItem(it); if (a.isPlayer) { snd.ui('cash'); G.ui.pick(`+$${it.n}`); } return true; }
  const add = addItem(a, it.id, it.n); if (add <= 0) { if (manual && a.isPlayer) G.ui.toast('Inventário cheio para este item'); return false; } it.n -= add; if (it.n <= 0) removeItem(it); if (a.isPlayer) { snd.ui('pick'); G.ui.pick('+ ' + ITEMS[it.id].n); } return true; }
// Solta tudo ao morrer.
export function dropAll(a) { const p = a.pos; for (const w of a.weapons) if (w) dropItem('w', w.def.id, 1, p.x + (Math.random() - 0.5), p.y + 0.03, p.z + (Math.random() - 0.5), { ammo: w.ammo, optic: w.optic }); for (const k in a.ammo) if (a.ammo[k] > 0) dropItem('a', k, a.ammo[k], p.x + (Math.random() - 0.5) * 1.6, p.y + 0.02, p.z + (Math.random() - 0.5) * 1.6); if (a.cash > 0) dropItem('c', 'cash', a.cash, p.x + (Math.random() - 0.5) * 1.4, p.y + 0.02, p.z + (Math.random() - 0.5) * 1.4); for (const k of ['plate', 'frag', 'smoke', 'stun', 'decoy', 'uav', 'drone', 'ammobox', 'revive']) if (a.inv[k] > 0) dropItem('i', k, a.inv[k], p.x + (Math.random() - 0.5) * 1.8, p.y + 0.02, p.z + (Math.random() - 0.5) * 1.8); markMesh.instanceMatrix.needsUpdate = true; a.weapons = [null, null]; a.cur = 2; for (const k in a.ammo) a.ammo[k] = 0; a.cash = 0; for (const k in a.inv) a.inv[k] = 0; }
export function dropFromInv(a, kind, id) { const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw), x = a.pos.x + fx * 1.2, z = a.pos.z + fz * 1.2, y = a.pos.y + 0.03;
  if (kind === 'w') { const s = id; const w = a.weapons[s]; if (!w) return; dropItem('w', w.def.id, 1, x, y, z, { ammo: w.ammo, optic: w.optic, noAuto: G.time + 3 }); a.weapons[s] = null; if (a.cur === s) a.cur = a.weapons[1 - s] ? 1 - s : 2; a._wkey = null; }
  else if (kind === 'a') { const n = Math.min(a.ammo[id], AMMO[id].max / 4 | 0); if (n <= 0) return; a.ammo[id] -= n; dropItem('a', id, n, x, y, z, { noAuto: G.time + 3 }); }
  else if (kind === 'c') { const n = Math.min(a.cash, 500); if (n <= 0) return; a.cash -= n; dropItem('c', 'cash', n, x, y, z, { noAuto: G.time + 3 }); }
  else { if (!(a.inv[id] > 0)) return; a.inv[id]--; if (id === 'gasmask') a.maskHp = 0; dropItem('i', id, 1, x, y, z, { noAuto: G.time + 3 }); } markMesh.instanceMatrix.needsUpdate = true; snd.ui('click'); }
let scanT = 0;
// Coleta automática (munição, dinheiro, placas) e detecção do alvo de interação.
export function updateLoot(dt, pl) {
  scanT -= dt; if (scanT > 0) return; scanT = 0.1; if (!pl.alive || pl.mode !== 'ground' || pl.downed) { G.interact = null; return; }
  const px = pl.pos.x, py = pl.pos.y, pz = pl.pos.z; let best = null, bd = 2.4 * 2.4; const fx = -Math.sin(pl.yaw), fz = -Math.cos(pl.yaw); const cam = G.camera.position;
  for (const it of Loot.items) { if (!it.alive) continue; const dx = it.x - px, dz = it.z - pz, d2 = dx * dx + dz * dz;
    if (it.kind === 'w') { const cd = (it.x - cam.x) ** 2 + (it.z - cam.z) ** 2; if (cd < 45 * 45 && !it.mesh) { const m = buildWeapon(WBY[it.id], it.optic); m.rotation.set(0, (it.x * 7) % 6, Math.PI / 2); m.position.set(it.x, it.y + 0.04, it.z); G.scene.add(m); it.mesh = m; } else if (cd > 55 * 55 && it.mesh) { G.scene.remove(it.mesh); it.mesh.traverse((o) => o.geometry && o.geometry.dispose()); it.mesh = null; } }
    if (d2 > 6 || Math.abs(it.y - py) > 1.6) continue;
    if (it.kind !== 'w' && d2 < 1.7 && !(it.noAuto > G.time)) { if (pickup(pl, it)) continue; }
    if (it.kind === 'w' && !pl.weapons[0] !== !pl.weapons[1] && d2 < 1.5 && !(it.noAuto > G.time) && !pl.weapons.some((w) => w && w.def.id === it.id)) { pickup(pl, it); continue; }
    if (it.kind === 'w' && !pl.weapons[0] && !pl.weapons[1] && d2 < 1.7 && !(it.noAuto > G.time)) { pickup(pl, it); continue; }
    if (d2 < bd && (d2 < 1.2 || (dx * fx + dz * fz) > 0)) { bd = d2; best = { type: 'item', ref: it, label: 'Pegar ' + itemName(it) }; } }
  for (const c of Loot.crates) { if (c.open) continue; const dx = c.x - px, dz = c.z - pz, d2 = dx * dx + dz * dz; if (d2 < bd && Math.abs(c.y - py) < 1.5) { bd = d2; best = { type: 'crate', ref: c, label: 'Abrir caixa de suprimentos' }; } }
  for (const d of G.world.doors) { const dx = d.x - px, dz = d.z - pz, d2 = dx * dx + dz * dz; if (d2 < bd * 0.8 && py > d.lo - 1 && py < d.hi) { bd = d2; best = { type: 'door', ref: d, label: d.open ? 'Fechar porta' : 'Abrir porta' }; } }
  for (const b of G.world.buy) { const d2 = (b.x - px) ** 2 + (b.z - pz) ** 2; if (d2 < 7 && Math.abs(b.y - py) < 2) { bd = 0; best = { type: 'buy', ref: b, label: 'Abrir loja' }; } }
  for (const b of Loot.boxes) { const d2 = (b.x - px) ** 2 + (b.z - pz) ** 2; if (d2 < 5 && !b.used.has(pl.id)) { best = { type: 'ammobox', ref: b, label: 'Reabastecer munição' }; bd = 0; } }
  if (G.extraInteract) { const e = G.extraInteract(pl, bd); if (e) best = e; }
  G.interact = best;
}
export function doInteract(pl) { const t = G.interact; if (!t) return; if (t.type === 'item') pickup(pl, t.ref, true); else if (t.type === 'crate') { openCrate(t.ref, pl); snd.ui('ok'); } else if (t.type === 'door') { G.world.setDoor(t.ref, !t.ref.open); snd.door(t.ref); } else if (t.type === 'buy') G.ui.openBuy(); else if (t.type === 'ammobox') useAmmoBox(t.ref, pl); else if (t.fn) t.fn(); G.interact = null; scanT = 0; }
export function refillAmmo(a) { for (const w of a.weapons) if (w) { a.ammo[w.def.ammo] = AMMO[w.def.ammo].max; } }
export function placeAmmoBox(a) { const fx = -Math.sin(a.yaw), fz = -Math.cos(a.yaw); const x = a.pos.x + fx * 1.1, z = a.pos.z + fz * 1.1, y = G.phys.ground(x, z, a.pos.y + 0.3); const mesh = new THREE.Mesh(part([['box', [0, 0.2, 0, 0.6, 0.4, 0.4], 0x4a5a3a], ['box', [0, 0.41, 0, 0.62, 0.03, 0.42], 0x2a3020], ['box', [0, 0.2, 0.201, 0.3, 0.16, 0.01], 0xd9a520]]), VMAT); mesh.position.set(x, y, z); mesh.rotation.y = a.yaw; G.scene.add(mesh); Loot.boxes.push({ x, y, z, mesh, used: new Set(), team: a.team }); }
function useAmmoBox(b, a) { b.used.add(a.id); refillAmmo(a); a.inv.frag = Math.max(a.inv.frag, 1); snd.ui('ok'); if (a.isPlayer) G.ui.toast('Munição reabastecida'); }
// Compras na loja.
export function buy(pl, id) { const row = SHOP.find((s) => s[0] === id); if (!row) return false; const price = row[2]; if (pl.cash < price && !G.dev.on) { snd.ui('err'); G.ui.toast('Dinheiro insuficiente'); return false; } let ok = false;
  if (id === 'ammo') { if (!pl.weapons[0] && !pl.weapons[1]) { G.ui.toast('Você não tem arma'); snd.ui('err'); return false; } refillAmmo(pl); ok = true; } else if (id === 'plates3') ok = addItem(pl, 'plate', 3) > 0; else if (id === 'loadout') { const lo = store.get('loadout', { p: 'guara', s: 'lambari', po: null, so: null, m: 'faca' }); const p = pl.pos; for (const w of pl.weapons) if (w) dropItem('w', w.def.id, 1, p.x + Math.random() - 0.5, p.y + 0.03, p.z + Math.random() - 0.5, { ammo: w.ammo, optic: w.optic, noAuto: G.time + 5 }); pl.weapons = [newWeapon(lo.p, lo.po), newWeapon(lo.s, lo.so)]; pl.cur = 0; pl.melee = lo.m || 'faca'; pl._wkey = null; refillAmmo(pl); ok = true; }
  else if (id === 'buyback') { ok = G.match && G.match.buyback(pl); if (!ok) G.ui.toast('Nenhum aliado para recomprar'); } else ok = addItem(pl, id, 1) > 0;
  if (!ok) { snd.ui('err'); if (id !== 'buyback') G.ui.toast('Você já tem o máximo'); return false; } if (!G.dev.on) pl.cash -= price; snd.ui('cash'); G.ui.toast('Comprou: ' + row[1], '#58d878'); return true; }
export { WEAPONS };
