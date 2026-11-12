// Equipamentos: granadas (frag, fumaça, atordoamento, distração), placas, UAV, drone controlável, caixa de munição, máscara de gás.
import * as THREE from 'three';
import { G } from './state.js';
import { I, hit } from './input.js';
import { explode, canSee } from './actors.js';
import { buildGrenade } from './weaponmodels.js';
import { smokeCloud, burst } from './fx.js';
import { snd, loop } from './audio.js';
import { placeAmmoBox } from './loot.js';
import { part, VMAT } from './mesh.js';
import { clamp, damp } from './util.js';
import { setFov } from './engine.js';
import { S } from './config.js';

const nades = []; const V = new THREE.Vector3(), V2 = new THREE.Vector3(); export const decoys = [];
export const Drone = { active: false, mesh: null, pos: new THREE.Vector3(), yaw: 0, pitch: 0, battery: 0, hp: 30, vel: new THREE.Vector3() };
export function throwNade(a, kind, dirOverride) { if (!(a.inv[kind] > 0)) return false; a.inv[kind]--; const m = buildGrenade(kind); const o = a.eye(V), d = dirOverride || a.fwd(V2); m.position.set(o.x + d.x * 0.5, o.y - 0.1 + d.y * 0.5, o.z + d.z * 0.5); G.scene.add(m); nades.push({ kind, m, vel: new THREE.Vector3(d.x * 17, d.y * 17 + 4.5, d.z * 17), t: kind === 'frag' ? 3.2 : kind === 'stun' ? 1.8 : 99, owner: a, rest: 0, bounced: false }); snd.throw_(); return true; }
function detonate(n) { const p = n.m.position; if (n.kind === 'frag') explode(p, 7.5, 150, n.owner); else if (n.kind === 'stun') { snd.stun(p); burst(p, 14, { color: [1, 1, 0.9], speed: 6, size: 0.3, life: 0.25, grav: 0 }); for (const a of G.actors) { if (!a.alive) continue; const d = a.pos.distanceTo(p); if (d > 11) continue; if (!G.phys.los(p.x, p.y + 0.4, p.z, a.pos.x, a.pos.y + 1.2, a.pos.z)) continue; const k = 1 - d / 13; a.stunT = Math.max(a.stunT, 4.5 * k); if (a.isPlayer) G.flash = Math.max(G.flash, k); } } G.scene.remove(n.m); n.m.geometry.dispose(); }
export function updateNades(dt) {
  for (let i = nades.length - 1; i >= 0; i--) { const n = nades[i], p = n.m.position; n.t -= dt;
    if (n.rest < 1) { n.vel.y -= 15 * dt; const sp = n.vel.length(); const step = sp * dt; if (sp > 0.01) { const dx = n.vel.x / sp, dy = n.vel.y / sp, dz = n.vel.z / sp; const r = G.phys.ray(p.x, p.y, p.z, dx, dy, dz, step + 0.06); if (r) { // quique
            p.x += dx * Math.max(0, r.t - 0.05); p.y += dy * Math.max(0, r.t - 0.05); p.z += dz * Math.max(0, r.t - 0.05); const dot = n.vel.x * r.nx + n.vel.y * r.ny + n.vel.z * r.nz; n.vel.x -= 1.5 * dot * r.nx; n.vel.y -= 1.5 * dot * r.ny; n.vel.z -= 1.5 * dot * r.nz; n.vel.multiplyScalar(0.55); if (!n.bounced) { n.bounced = true; if (n.kind === 'smoke') n.t = 0.7; if (n.kind === 'decoy') n.t = 0.5; } if (n.vel.length() < 1.2 && r.ny > 0.5) { n.rest = 1; n.vel.set(0, 0, 0); } snd.impact(p, 'wall'); } else p.addScaledVector(n.vel, dt); } n.m.rotation.x += dt * 9; n.m.rotation.z += dt * 6; const gy = G.terr.height(p.x, p.z); if (p.y < gy + 0.04) { p.y = gy + 0.04; n.vel.y = Math.abs(n.vel.y) * 0.3; n.vel.x *= 0.6; n.vel.z *= 0.6; if (!n.bounced) { n.bounced = true; if (n.kind === 'smoke') n.t = 0.7; if (n.kind === 'decoy') n.t = 0.5; } if (n.vel.length() < 1.5) n.rest = 1; } }
    if (n.t <= 0) { if (n.kind === 'smoke') { smokeCloud(p, 14); snd.smoke(p); G.scene.remove(n.m); n.m.geometry.dispose(); } else if (n.kind === 'decoy') { decoys.push({ p: p.clone(), t: 10, next: 0, owner: n.owner, m: n.m }); } else detonate(n); nades.splice(i, 1); } }
  for (let i = decoys.length - 1; i >= 0; i--) { const d = decoys[i]; d.t -= dt; d.next -= dt; if (d.next <= 0) { d.next = 0.09 + (Math.random() < 0.25 ? 0.5 + Math.random() : 0); snd.shot({ f: 170, n: 0.8, t: 0.14, p: 1.0 }, d.p, false); burst(d.p, 1, { color: [1, 0.8, 0.4], speed: 1, size: 0.12, life: 0.1, grav: 0 }); } if (d.t <= 0) { G.scene.remove(d.m); d.m.geometry.dispose(); decoys.splice(i, 1); } }
}
export function clearEquipment() { for (const n of nades) { G.scene.remove(n.m); } nades.length = 0; for (const d of decoys) G.scene.remove(d.m); decoys.length = 0; if (Drone.active) endDrone(G.player); }
// Uso pelo jogador (botões de granada, placa, upgrade de campo e UAV).
export function playerEquipment(dt, pl) {
  pl.busyLow = Math.max(0, pl.busyLow - dt * 2.4);
  if (pl.plateT > 0) { pl.plateT -= dt; pl.busyLow = 1; if (pl.plateT <= 0) { pl.armor = Math.min(150, pl.armor + 50); pl.inv.plate--; snd.ui('plate'); if (pl.armor < 150 && pl.inv.plate > 0 && I.keys.Digit4) pl.plateT = 1.2; } }
  if (pl.mode !== 'ground' || !pl.alive || pl.downed) return;
  const free = pl.busyLow < 0.3 && pl.reloadT <= 0 && !pl.mantle;
  if (hit('lethal')) { if (pl.inv.frag > 0 && free) { snd.pin(); pl.busyLow = 1; const d = new THREE.Vector3(); G.camera.getWorldDirection(d); throwNade(pl, 'frag', d); } else if (!(pl.inv.frag > 0)) G.ui.toast('Sem granadas'); }
  if (hit('tactical')) { let k = pl.tacSel; if (!(pl.inv[k] > 0)) k = ['smoke', 'stun', 'decoy'].find((x) => pl.inv[x] > 0); if (k && free) { pl.tacSel = k; snd.pin(); pl.busyLow = 1; const d = new THREE.Vector3(); G.camera.getWorldDirection(d); throwNade(pl, k, d); } else if (!k) G.ui.toast('Sem granada tática'); }
  if (hit('plate')) { if (pl.armor >= 150) G.ui.toast('Colete completo'); else if (!(pl.inv.plate > 0)) G.ui.toast('Sem placas'); else if (free && !(pl.plateT > 0)) { pl.plateT = 1.3; I.ads = false; } }
  if (hit('streak')) { if (pl.inv.uav > 0) { pl.inv.uav--; G.match.uav(pl.team, 30); snd.ui('ok'); G.ui.toast('UAV ativo: inimigos revelados no minimapa', '#f2c230'); } else G.ui.toast('Sem UAV'); }
  if (hit('field')) { let k = pl.fieldSel; if (!(pl.inv[k] > 0)) k = ['drone', 'ammobox'].find((x) => pl.inv[x] > 0); if (!k) G.ui.toast('Sem equipamento de campo'); else if (k === 'ammobox') { pl.inv.ammobox--; placeAmmoBox(pl); snd.ui('ok'); G.ui.toast('Caixa de munição posicionada'); } else if (pl.onGround) startDrone(pl); }
}
function droneMesh() { const sp = [['box', [0, 0, 0, 0.26, 0.07, 0.34], 0x2a2c30], ['box', [0, -0.05, -0.14, 0.08, 0.06, 0.08], 0x15171a], ['sph', [0, -0.05, -0.19, 0.03, 0.03, 0.02], 0x3fa0ff]]; for (const [x, z] of [[-0.24, -0.2], [0.24, -0.2], [-0.24, 0.2], [0.24, 0.2]]) { sp.push(['box', [x / 2, 0, z / 2, 0.03, 0.02, 0.3, 0, Math.atan2(x, z), 0], 0x3a3d42]); sp.push(['cyl', [x, 0.04, z, 0.13, 0.008, 0.13], 0x8a9096]); sp.push(['cyl', [x, 0.01, z, 0.025, 0.05, 0.025], 0x15171a]); } return new THREE.Mesh(part(sp), VMAT); }
export function startDrone(pl) { if (Drone.active) return; pl.inv.drone--; if (!Drone.mesh) { Drone.mesh = droneMesh(); G.scene.add(Drone.mesh); } Drone.active = true; Drone.mesh.visible = true; Drone.pos.set(pl.pos.x, pl.pos.y + 1.9, pl.pos.z); Drone.yaw = pl.yaw; Drone.pitch = -0.2; Drone.battery = 45; Drone.hp = 30; Drone.vel.set(0, 0, 0); pl.mode = 'drone'; I.ads = false; I.fire = false; snd.ui('ok'); G.ui.toast('Drone no ar — USAR para voltar'); }
export function endDrone(pl) { if (!Drone.active) return; Drone.active = false; Drone.mesh.visible = false; if (pl.mode === 'drone') pl.mode = 'ground'; loop('drone', false); }
export function updateDrone(dt, pl) {
  if (!Drone.active) return; Drone.battery -= dt; Drone.yaw -= I.lx; Drone.pitch = clamp(Drone.pitch - I.ly, -1.3, 0.6);
  const sy = Math.sin(Drone.yaw), cy = Math.cos(Drone.yaw), sp = 11; const tx = (-sy * I.my + cy * I.mx) * sp, tz = (-cy * I.my - sy * I.mx) * sp, ty = ((I.up ? 1 : 0) - (I.down ? 1 : 0)) * 6;
  Drone.vel.x = damp(Drone.vel.x, tx, 4, dt); Drone.vel.z = damp(Drone.vel.z, tz, 4, dt); Drone.vel.y = damp(Drone.vel.y, ty, 5, dt); const p = Drone.pos; const P2 = { x: p.x + Drone.vel.x * dt, z: p.z + Drone.vel.z * dt }; G.phys.resolve(P2, 0.35, p.y - 0.3, 0.6); p.x = clamp(P2.x, -314, 314); p.z = clamp(P2.z, -314, 314); let ny = p.y + Drone.vel.y * dt; const g = G.phys.ground(p.x, p.z, p.y) + 0.5, c = G.phys.ceiling(p.x, p.z, p.y) - 0.3; ny = clamp(ny, g, Math.min(c, G.terr.height(p.x, p.z) + 70)); p.y = ny;
  Drone.mesh.position.copy(p); Drone.mesh.rotation.set(clamp(-Drone.vel.length() * 0.02, -0.3, 0) * Math.sign(I.my || 0), Drone.yaw, clamp(-I.mx * 0.25, -0.3, 0.3)); const cam = G.camera; cam.position.set(p.x, p.y - 0.06, p.z); cam.rotation.set(Drone.pitch, Drone.yaw, 0); setFov(I.ads ? S.fov / 2.5 : S.fov); G.zoomSens = I.ads ? 0.5 : 1; G.vmVisible = false; G.fpsView = false; Drone.mesh.visible = false;
  loop('drone', true, { osc: [['square', 150], ['sawtooth', 302]], cut: 1400, vol: 0.05, pitch: 1 + Drone.vel.length() * 0.02 });
  // marca inimigos visíveis pela câmera
  Drone.scanT = (Drone.scanT || 0) - dt; if (Drone.scanT <= 0) { Drone.scanT = 0.3; cam.getWorldDirection(V); for (const a of G.actors) { if (!a.alive || a.team === pl.team) continue; V2.set(a.pos.x - p.x, a.pos.y + 1 - p.y, a.pos.z - p.z); const d = V2.length(); if (d > 110) continue; if (V2.dot(V) / d < 0.82) continue; if (G.phys.los(p.x, p.y, p.z, a.pos.x, a.pos.y + 1.2, a.pos.z)) a.revealT = G.time + 6; } }
  pl.syncModel(dt, true);
  if (hit('interact') || Drone.battery <= 0 || Drone.hp <= 0 || !pl.alive || pl.downed || G.time - pl.lastDmgT < 0.1) { if (Drone.battery <= 0) G.ui.toast('Bateria do drone esgotada'); endDrone(pl); }
}
export { canSee };
