// Jogador: movimentação de FPS moderno (corrida, sprint, agachar, deitar, pulo, deslize, escalada), câmera FPS/TPS e uso de armas.
import * as THREE from 'three';
import { G } from './state.js';
import { S, OPTICS, MELEE } from './config.js';
import { I, hit } from './input.js';
import { Actor, shoot, meleeAttack, rayActors } from './actors.js';
import { ViewModel } from './viewmodel.js';
import { setFov } from './engine.js';
import { snd, loop } from './audio.js';
import { SURF } from './terrain.js';
import { clamp, lerp, damp } from './util.js';
import { STEP } from './physics.js';

const V = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), P2 = { x: 0, z: 0 };
const H_STAND = 1.75, H_CROUCH = 1.15, H_PRONE = 0.55, RAD = 0.35, GRAV = 17;
export class Player extends Actor {
  constructor(look) { super({ name: 'Você', team: 0, isPlayer: true, look }); this.vm = new ViewModel(); this.camMode = S.camera; this.adsT = 0; this.drawT = 0; this.camY = 0; this.eyeS = 1.6; this.recoilP = 0; this.recoilY = 0; this.stepD = 0; this.sprintVM = 0; this.busyLow = 0; this.burst = 0; this.slideT = 0; this.mantle = null; this.lookD = { x: 0, y: 0 }; this.aaT = 0; this.aaTarget = null; this.prevFire = false; this.noTerrain = false; this.fallStart = 0; }
  height() { return this.prone ? H_PRONE : this.crouch || this.sliding ? H_CROUCH : H_STAND; }
  canStand(h) { return G.phys.ceiling(this.pos.x, this.pos.z, this.pos.y + this.height()) >= this.pos.y + h - 0.02; }
  teleport(x, y, z) { this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.camY = y; this.onGround = false; }
  switchTo(n) { if (n === this.cur || (n < 2 && !this.weapons[n])) return; this.cur = n; this.drawT = 0.35; this.reloadT = 0; this.burst = 0; I.ads = false; snd.reload(0); }
  startReload() { const w = this.w; if (!w || this.reloadT > 0 || w.ammo >= w.def.mag) return; if (this.ammo[w.def.ammo] <= 0 && !G.dev.ammo) { if (G.ui) G.ui.toast('Sem munição ' + w.def.ammo); return; } this.reloadDur = w.def.reload; this.reloadT = this.reloadDur; I.ads = false; snd.reload(0); }
  look(dt) { const lx = I.lx, ly = I.ly; this.lookD.x = lx; this.lookD.y = ly; this.yaw -= lx; this.pitch = clamp(this.pitch - ly, -1.5, 1.5);
    // assistência de mira leve para toque: puxa em direção ao alvo próximo da mira
    if (I.touch && S.aimAssist !== false && (I.fire || this.adsT > 0.5) && this.w) { this.aaT -= dt; if (this.aaT <= 0) { this.aaT = 0.12; this.aaTarget = null; let best = 0.07; const e = this.eye(V), f = this.fwd(V2); for (const a of G.actors) { if (a === this || !a.alive || a.team === this.team) continue; V3.set(a.pos.x, a.pos.y + a.eyeH() * 0.75, a.pos.z).sub(e); const d = V3.length(); if (d > 70) continue; V3.multiplyScalar(1 / d); const ang = Math.acos(clamp(V3.dot(f), -1, 1)); if (ang < best && G.phys.los(e.x, e.y, e.z, a.pos.x, a.pos.y + 1.1, a.pos.z)) { best = ang; this.aaTarget = a; } } }
      const t = this.aaTarget; if (t && t.alive) { const e = this.eye(V); const dx = t.pos.x - e.x, dy = t.pos.y + t.eyeH() * 0.78 - e.y, dz = t.pos.z - e.z; const ty = Math.atan2(-dx, -dz), tp = Math.atan2(dy, Math.hypot(dx, dz)); let dyaw = ty - this.yaw; while (dyaw > Math.PI) dyaw -= Math.PI * 2; while (dyaw < -Math.PI) dyaw += Math.PI * 2; const k = Math.min(1, dt * 3.2); this.yaw += dyaw * k; this.pitch += (tp - this.pitch) * k; } } }
  update(dt) {
    this.spawnProt = Math.max(0, this.spawnProt - dt); this.stunT = Math.max(0, this.stunT - dt); this.cool -= dt; this.swingT = Math.max(0, this.swingT - dt); this.drawT = Math.max(0, this.drawT - dt); this.bloom = Math.max(0, this.bloom - dt * 5);
    if (this.alive && !this.downed && G.time - this.lastDmgT > 6 && this.hp < 100) this.hp = Math.min(100, this.hp + 14 * dt);
    this.air = !this.onGround;
    if (this.mode === 'ground') { this.look(dt); if (this.alive) { this.move(dt); if (!this.downed) this.weaponUpdate(dt); else this.adsT = 0; } }
    else if (this.mode === 'fall' || this.mode === 'chute') { this.look(dt); this.drop(dt); this.adsT = 0; }
    else if (this.mode === 'vehicle' || this.mode === 'plane') { this.look(dt); this.adsT = 0; this.reloadT = 0; }
    const rk = 1 - Math.exp(-7 * dt); this.recoilP -= this.recoilP * rk; this.recoilY -= this.recoilY * rk;
  }
  move(dt) {
    const ph = G.phys, nt = this.noTerrain; const fly = G.dev.fly;
    if (hit('prone') && !this.downed) { if (this.prone) { if (this.canStand(H_CROUCH)) { this.prone = false; this.crouch = true; } } else { this.prone = true; this.crouch = false; this.sliding = false; I.run = false; } }
    if (hit('crouch') && !this.downed) { if (this.prone) { if (this.canStand(H_CROUCH)) { this.prone = false; this.crouch = true; } } else if (this.sprinting && this.onGround && this.speed > 5.6 && !this.sliding) { this.sliding = true; this.slideT = 0.85; this.slideDir = Math.atan2(this.vel.x, this.vel.z); this.crouch = true; snd.step('terra', this.pos, true, true); } else if (this.crouch) { if (this.canStand(H_STAND)) this.crouch = false; } else this.crouch = true; }
    if (hit('jump') && !this.downed) { if (this.prone) { if (this.canStand(H_CROUCH)) { this.prone = false; this.crouch = true; } } else if (this.crouch && !this.sliding) { if (this.canStand(H_STAND)) this.crouch = false; } else if (this.onGround || fly) { if (this.sliding) { this.sliding = false; this.crouch = false; } this.vel.y = 5.6; this.onGround = false; } else this.tryMantle(true); }
    if (this.downed) { this.prone = true; this.crouch = false; }
    let mx = I.mx, my = I.my; let mag = Math.min(1, Math.hypot(mx, my)); if (I.run && !this.prone && !this.downed) { if (mag < 0.15) { mx = 0; my = 1; mag = 1; } } if (mag < 0.08) { mx = my = 0; mag = 0; }
    const wantSprint = (I.run || I.shift) && my > 0.25 && !this.crouch && !this.prone && this.adsT < 0.2 && !this.downed; this.sprinting = wantSprint && !I.fire && this.reloadT <= 0 && this.busyLow < 0.1;
    const w = this.w; let sp = this.downed ? 0.9 : this.prone ? 1.1 : this.crouch ? 2.4 : this.sprinting ? 7.0 : 4.7; sp *= (w ? w.def.move : 1.03) * lerp(1, 0.62, this.adsT) * (this.stunT > 0 ? 0.45 : 1) * (G.dev.on ? G.dev.speed : 1); if (my < -0.3) sp *= 0.8;
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw); let wx = (-sy * my + cy * mx) * sp * mag, wz = (-cy * my - sy * mx) * sp * mag;
    if (this.sliding) { this.slideT -= dt; const ss = 4 + 5.5 * Math.max(0, this.slideT / 0.85); wx = Math.sin(this.slideDir) * ss; wz = Math.cos(this.slideDir) * ss; if (this.slideT <= 0) { this.sliding = false; if (!this.canStand(H_STAND)) this.crouch = true; else this.crouch = I.down; } }
    const acc = this.onGround ? (this.sliding ? 30 : 13) : 2.6; const k = 1 - Math.exp(-acc * dt); this.vel.x += (wx - this.vel.x) * k; this.vel.z += (wz - this.vel.z) * k;
    this.moveF = my * mag; this.moveS = mx * mag;
    if (this.mantle) { const m = this.mantle; m.t += dt / 0.32; const t = Math.min(1, m.t); this.pos.y = lerp(m.y0, m.y1, Math.min(1, t * 1.4)); this.pos.x = lerp(m.x0, m.x1, t * t); this.pos.z = lerp(m.z0, m.z1, t * t); if (t >= 1) { this.mantle = null; this.onGround = true; this.vel.set(0, 0, 0); } this.speed = 1; return; }
    const h = this.height(), r = this.prone ? 0.42 : RAD; const hs = Math.hypot(this.vel.x, this.vel.z); const n = Math.max(1, Math.ceil((hs * dt) / 0.22)); let blocked = false; const ox = this.pos.x, oz = this.pos.z;
    for (let i = 0; i < n; i++) { this.pos.x += (this.vel.x * dt) / n; this.pos.z += (this.vel.z * dt) / n; P2.x = this.pos.x; P2.z = this.pos.z; if (ph.resolve(P2, r, this.pos.y, h)) blocked = true; this.pos.x = P2.x; this.pos.z = P2.z; }
    this.pos.x = clamp(this.pos.x, -316, 316); this.pos.z = clamp(this.pos.z, -316, 316);
    this.speed = Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 1e-4);
    if (fly) { this.vel.y = (I.up ? 7 : 0) - (I.down ? 7 : 0); this.pos.y += this.vel.y * dt; this.onGround = false; const g0 = ph.ground(this.pos.x, this.pos.z, this.pos.y, nt); if (this.pos.y < g0) this.pos.y = g0; return; }
    const g = ph.ground(this.pos.x, this.pos.z, this.pos.y, nt);
    if (this.onGround) { if (this.pos.y - g > STEP + 0.1) { this.onGround = false; this.vel.y = 0; this.fallStart = this.pos.y; } else this.pos.y = g; }
    else { this.vel.y -= GRAV * dt; const ny = this.pos.y + this.vel.y * dt; if (this.vel.y > 0) { const c = ph.ceiling(this.pos.x, this.pos.z, this.pos.y + h); if (ny + h > c) { this.vel.y = 0; } else this.pos.y = ny; if (blocked) this.tryMantle(false); } else this.pos.y = ny;
      if (this.pos.y <= g && this.vel.y <= 0) { const v = -this.vel.y; this.pos.y = g; this.onGround = true; this.vel.y = 0; if (v > 13.5) this.damage((v - 13.5) * 7, null, { fall: true }); if (v > 4) { snd.step(this.surface(), this.pos, true, true); G.shake = Math.max(G.shake, Math.min(0.5, v * 0.02)); } } }
    // passos
    if (this.onGround && this.speed > 0.6 && !this.sliding) { this.stepD += this.speed * dt; const st = this.prone ? 1.4 : this.sprinting ? 2.5 : this.crouch ? 1.5 : 2.0; if (this.stepD > st) { this.stepD = 0; snd.step(this.surface(), this.pos, this.sprinting, true); } }
  }
  surface() { const t = G.terr.height(this.pos.x, this.pos.z); if (this.noTerrain || this.pos.y > t + 0.08) return 'piso'; return SURF[G.terr.type(this.pos.x, this.pos.z)]; }
  // Escalada/salto de obstáculos: se há uma borda alcançável à frente e espaço em cima, sobe.
  tryMantle(force) { if (this.mantle || this.prone) return; const ph = G.phys; const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); const tx = this.pos.x + fx * 0.75, tz = this.pos.z + fz * 0.75; const top = ph.ground(tx, tz, this.pos.y + 1.75, this.noTerrain); const dh = top - this.pos.y; if (dh < 0.5 || dh > 2.0) return; if (!force && I.my < 0.3 && !I.run) return; if (ph.ceiling(tx, tz, top + 0.3) < top + H_CROUCH) return; if (ph.ceiling(this.pos.x, this.pos.z, this.pos.y + 1) < top + 1.2) return; this.mantle = { t: 0, x0: this.pos.x, z0: this.pos.z, y0: this.pos.y, x1: tx, z1: tz, y1: top }; this.vel.set(0, 0, 0); if (ph.ceiling(tx, tz, top + 0.3) < top + H_STAND) this.crouch = true; snd.step('piso', this.pos, false, true); }
  // Queda livre e paraquedas.
  drop(dt) { const terrY = G.phys.ground(this.pos.x, this.pos.z, this.pos.y + 0.6, false); const agl = this.pos.y - terrY; const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw); let mx = I.mx, my = I.my;
    if (this.mode === 'fall') { const dive = clamp(-this.pitch, -0.2, 1.3); const vy = -(34 + dive * 26), hs = 16 + dive * 6 + (my > 0 ? my * 14 : 0); this.vel.y = damp(this.vel.y, vy, 2, dt); const tx = (-sy * Math.max(my, 0.25) + cy * mx * 0.6) * hs, tz = (-cy * Math.max(my, 0.25) - sy * mx * 0.6) * hs; this.vel.x = damp(this.vel.x, tx, 1.6, dt); this.vel.z = damp(this.vel.z, tz, 1.6, dt); loop('wind', true, { noise: true, filter: 'bandpass', cut: 700, vol: 0.32 });
      if (hit('jump') || agl < 55) { this.mode = 'chute'; snd.chute(); if (G.ui) G.ui.toast('Paraquedas aberto'); } }
    else { const vy = -(6.5 + clamp(-this.pitch, 0, 1) * 5), hs = 11; this.vel.y = damp(this.vel.y, vy, 3, dt); this.vel.x = damp(this.vel.x, (-sy * (0.45 + Math.max(0, my) * 0.75) + cy * mx * 0.5) * hs, 2, dt); this.vel.z = damp(this.vel.z, (-cy * (0.45 + Math.max(0, my) * 0.75) - sy * mx * 0.5) * hs, 2, dt); loop('wind', true, { noise: true, filter: 'bandpass', cut: 400, vol: 0.14 }); if (hit('crouch') && agl > 70) { this.mode = 'fall'; } }
    this.pos.addScaledVector(this.vel, dt); P2.x = this.pos.x; P2.z = this.pos.z; G.phys.resolve(P2, 0.4, this.pos.y, 1.7); this.pos.x = clamp(P2.x, -316, 316); this.pos.z = clamp(P2.z, -316, 316); this.speed = Math.hypot(this.vel.x, this.vel.z);
    const g = G.phys.ground(this.pos.x, this.pos.z, this.pos.y + 0.5, false); if (this.pos.y <= g + 0.05) { this.pos.y = g; const hard = this.mode === 'fall'; this.mode = 'ground'; this.onGround = true; this.vel.set(0, 0, 0); loop('wind', false); snd.step(this.surface(), this.pos, true, true); G.shake = 0.35; if (hard) this.damage(60, null, { fall: true }); if (G.match) G.match.onLand(this); if (this.weapons[0] || this.weapons[1]) this.cur = this.weapons[0] ? 0 : 1; this.drawT = 0.35; }
  }
  weaponUpdate(dt) {
    if (hit('slot1')) this.switchTo(0); if (hit('slot2')) this.switchTo(1); if (hit('slot3')) this.switchTo(2); if (hit('swap')) this.switchTo(this.cur === 0 && this.weapons[1] ? 1 : this.weapons[0] ? 0 : this.weapons[1] ? 1 : 2);
    if (hit('melee') && this.cool <= 0 && this.swingT <= 0 && this.busyLow < 0.1) { meleeAttack(this); this.cool = Math.max(this.cool, 0.5); }
    const w = this.w; const fire = I.fire || (S.autoFire && this.autoTarget()); const pressed = fire && !this.prevFire; this.prevFire = fire; const busy = this.drawT > 0 || this.busyLow > 0.1 || this.mantle;
    if (!w) { this.adsT = Math.max(0, this.adsT - dt * 6); if (fire && this.cool <= 0 && !busy) meleeAttack(this); this.sprintVM = damp(this.sprintVM, this.sprinting ? 1 : 0, 10, dt); setFov(S.fov); G.zoomSens = 1; return; }
    const d = w.def;
    if (hit('reload')) this.startReload();
    if (this.reloadT > 0) { const before = this.reloadT; this.reloadT -= dt; if (d.shellReload) { // escopeta: um cartucho por vez
        if (this.reloadT <= 0) { if (G.dev.ammo || this.ammo[d.ammo] > 0) { w.ammo++; if (!G.dev.ammo) this.ammo[d.ammo]--; snd.reload(1); } if (w.ammo < d.mag && (G.dev.ammo || this.ammo[d.ammo] > 0) && !fire) { this.reloadT = this.reloadDur; } else { this.reloadT = 0; snd.reload(2); } } }
      else { const half = this.reloadDur * 0.5; if (before > half && this.reloadT <= half) snd.reload(1); if (this.reloadT <= 0) { const need = d.mag - w.ammo; const take = G.dev.ammo ? need : Math.min(need, this.ammo[d.ammo]); w.ammo += take; if (!G.dev.ammo) this.ammo[d.ammo] -= take; this.reloadT = 0; snd.reload(2); } } }
    // mira
    const wantAds = I.ads && this.reloadT <= 0 && !this.sprinting && !busy; this.adsT = clamp(this.adsT + (wantAds ? dt : -dt) / d.ads, 0, 1); const zoom = OPTICS[w.optic].zoom; const e = this.adsT * this.adsT * (3 - 2 * this.adsT); setFov(S.fov / lerp(1, zoom, e)); G.zoomSens = 1 / lerp(1, Math.pow(zoom, 0.85), e);
    this.sprintVM = damp(this.sprintVM, this.sprinting && this.adsT < 0.1 ? 1 : 0, 10, dt);
    // disparo
    const canFire = this.cool <= 0 && !busy && (this.reloadT <= 0 || d.shellReload) && this.sprintVM < 0.5;
    let trigger = false; if (d.mode === 'burst') { if (this.burst > 0) trigger = true; else if (pressed || (fire && this.cool <= -0.12)) { this.burst = 3; trigger = true; } } else trigger = fire;
    if (trigger && canFire) { if (w.ammo <= 0) { if (pressed) snd.dry(); this.burst = 0; if (this.ammo[d.ammo] > 0 || G.dev.ammo) this.startReload(); else if (pressed && G.ui) G.ui.toast('Sem munição'); }
      else { if (this.reloadT > 0) this.reloadT = 0; if (!G.dev.ammo) w.ammo--; const moving = clamp(this.speed / 5, 0, 1.4); const sp = lerp(d.spread[0] * (1 + moving * 0.6) * (this.onGround ? 1 : 1.8) * (this.crouch ? 0.8 : 1) * (this.prone ? 0.65 : 1), d.spread[1], e) + this.bloom * (1 - e * 0.6);
        const cam = G.camera; cam.getWorldDirection(V2); const eye = this.eye(V); let dir = V2;
        if (!G.fpsView) { const r = G.phys.ray(cam.position.x, cam.position.y, cam.position.z, V2.x, V2.y, V2.z, 300); const ha = rayActors(cam.position.x, cam.position.y, cam.position.z, V2.x, V2.y, V2.z, r ? r.t : 300, this); const t = ha ? ha.t : r ? r.t : 300; V3.copy(cam.position).addScaledVector(V2, Math.max(t, 4)).sub(eye).normalize(); dir = V3.clone(); }
        const mz = G.fpsView ? new THREE.Vector3().copy(cam.position).addScaledVector(dir, 0.7).add(V3.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(0.13 * (1 - e))).setY(cam.position.y + dir.y * 0.7 - 0.1 * (1 - e) - 0.02) : new THREE.Vector3(eye.x + dir.x * 0.9, eye.y - 0.15 + dir.y * 0.9, eye.z + dir.z * 0.9);
        shoot(this, w, eye, dir, sp, mz); this.vm.fire(d);
        const rm = (this.crouch ? 0.82 : 1) * (this.prone ? 0.6 : 1) * lerp(1, 0.78, e) * (d.bipod && this.prone ? 0.6 : 1); const rv = (d.recoil[0] * rm * Math.PI) / 180, rh = ((Math.random() - 0.5) * 2 * d.recoil[1] * rm * Math.PI) / 180; this.pitch = clamp(this.pitch + rv * 0.62, -1.5, 1.5); this.yaw += rh; this.recoilP += rv * 0.38; this.recoilY += rh * 0.3; this.bloom = Math.min(3, this.bloom + d.recoil[0] * 0.28);
        this.cool = 60 / d.rpm; if (d.mode === 'burst') { this.burst--; if (this.burst <= 0) this.cool = 0.26; } if (d.mode === 'bolt' || d.mode === 'pump') { setTimeout(() => snd.reload(1), 260); }
        if (w.ammo <= 0) this.burst = 0; G.shake = Math.max(G.shake, d.cls === 'sniper' ? 0.22 : d.cls === 'shotgun' ? 0.18 : 0.04); if (S.vibrate && I.touch && navigator.vibrate && (d.cls === 'sniper' || d.cls === 'shotgun')) { try { navigator.vibrate(18); } catch (er) { /* sem vibração */ } } } }
    if (w.ammo <= 0 && this.reloadT <= 0 && this.cool < -0.25 && (this.ammo[d.ammo] > 0 || G.dev.ammo) && !fire) this.startReload();
  }
  autoTarget() { const w = this.w; if (!w) return false; const cam = G.camera; cam.getWorldDirection(V2); const e = this.eye(V); const r = G.phys.ray(e.x, e.y, e.z, V2.x, V2.y, V2.z, w.def.range[1]); const h = rayActors(e.x, e.y, e.z, V2.x, V2.y, V2.z, r ? r.t : w.def.range[1], this); return !!(h && h.actor.team !== this.team); }
  // Câmera em primeira ou terceira pessoa (com colisão para não atravessar paredes).
  updateCamera(dt) {
    const sp = !this.alive && G.match && G.match.result && G.match.spec && G.match.spec.alive ? G.match.spec : null; if (sp) { const cam = G.camera; const pitch = this.pitch, yaw = this.yaw, cp = Math.cos(pitch); const bx = Math.sin(yaw) * cp, by = -Math.sin(pitch), bz = Math.cos(yaw) * cp; const py = sp.pos.y + 1.7; let d = 4.2; const r = G.phys.ray(sp.pos.x, py, sp.pos.z, bx, by, bz, d + 0.3); if (r) d = Math.max(0.6, r.t - 0.25); cam.position.set(sp.pos.x + bx * d, py + by * d, sp.pos.z + bz * d); cam.rotation.set(pitch, yaw, 0); G.vmVisible = false; G.fpsView = false; setFov(S.fov); this.syncModel(dt, true); return; }
    const cam = G.camera; const te = this.eyeH(); this.eyeS = damp(this.eyeS, te, 12, dt); const dy = this.pos.y - this.camY; this.camY = Math.abs(dy) > 1.2 || !this.onGround ? this.pos.y : damp(this.camY, this.pos.y, 18, dt);
    const sh = G.shake; const shx = sh ? (Math.random() - 0.5) * sh * 0.05 : 0, shy = sh ? (Math.random() - 0.5) * sh * 0.05 : 0; const stun = this.stunT > 0 ? Math.sin(G.time * 9) * 0.03 * Math.min(1, this.stunT) : 0;
    const tps = (this.camMode === 'tps' && this.adsT < 0.5) || this.mode === 'fall' || this.mode === 'chute' || !this.alive || this.downed; G.fpsView = !tps && this.mode === 'ground'; const pitch = this.pitch + this.recoilP + shy, yaw = this.yaw + this.recoilY + shx + stun;
    if (!tps) { const bob = this.onGround && this.speed > 0.5 ? Math.sin(this.vm.bob) * 0.012 * clamp(this.speed / 5, 0, 1.3) * (1 - this.adsT) : 0; cam.position.set(this.pos.x, this.camY + this.eyeS + bob, this.pos.z); cam.rotation.set(pitch, yaw, this.sliding ? 0.05 : 0); }
    else { const chute = this.mode === 'fall' || this.mode === 'chute'; const dist = chute ? 6.5 : this.downed || !this.alive ? 3.6 : 2.7, side = chute ? 0 : 0.5, up = chute ? 1.2 : 0.25; const py = this.camY + this.eyeS + up; const cp = Math.cos(pitch); const bx = Math.sin(yaw) * cp, by = -Math.sin(pitch), bz = Math.cos(yaw) * cp; const rx = Math.cos(yaw), rz = -Math.sin(yaw); const ox = this.pos.x + rx * side, oz = this.pos.z + rz * side; let d = dist; const r = G.phys.ray(ox, py, oz, bx, by, bz, dist + 0.3, { skipGlass: false }); if (r) d = Math.max(0.5, r.t - 0.25); cam.position.set(ox + bx * d, py + by * d, oz + bz * d); cam.rotation.set(pitch, yaw, 0); }
    G.vmVisible = G.fpsView && this.alive && !this.downed; if (G.vmVisible) this.vm.update(dt, this, this.lookD);
    this.syncModel(dt, tps || !this.alive);
  }
}
