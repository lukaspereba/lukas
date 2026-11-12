// Arma e braços em primeira pessoa, com animações procedurais (mira, recuo, recarga, corrida, saque, faca).
import * as THREE from 'three';
import { G } from './state.js';
import { buildWeapon, buildKnife, buildArm } from './weaponmodels.js';
import { lerp, clamp } from './util.js';
import { soft } from './fx.js';

export class ViewModel {
  constructor() { this.root = new THREE.Group(); G.vmScene.add(this.root); this.holder = new THREE.Group(); this.root.add(this.holder); this.key = null; this.kick = 0; this.kickR = 0; this.swayX = 0; this.swayY = 0; this.bob = 0; this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft(), color: 0xffd890, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending })); this.flash.visible = false; this.root.add(this.flash); this.flashT = 0; }
  rebuild(pl) { const h = this.holder; while (h.children.length) { const c = h.children.pop(); c.traverse((o) => o.geometry && o.geometry.dispose()); } const L = pl.model.look; const long = L.shirtKind === 'sweater' || L.shirtKind === 'vest'; const w = pl.w;
    this.gun = w ? buildWeapon(w.def, w.optic) : pl.melee === 'faca' ? buildKnife() : new THREE.Group(); if (!w && pl.melee !== 'faca') this.gun.userData = { muzzle: -0.2, sightY: 0.05, handZ: 0, backZ: 0.05, fist: true };
    h.add(this.gun); this.armR = buildArm(L.gloves || L.skin, long ? L.shirt : null); this.armL = buildArm(L.gloves || L.skin, long ? L.shirt : null); h.add(this.armR); h.add(this.armL); const u = this.gun.userData;
    this.armR.position.set(0.012, -0.055, 0.02); this.armR.rotation.set(0.42, 0.3, 0);
    if (u.fist) { this.armR.position.set(0.1, -0.02, -0.05); this.armR.rotation.set(0.8, 0.15, 0); this.armL.position.set(-0.22, -0.02, -0.08); this.armL.rotation.set(0.8, -0.15, 0); }
    else if (!w) { this.armL.position.set(-0.2, -0.1, 0.1); this.armL.rotation.set(0.7, -0.4, 0); }
    else if (u.pistol) { this.armL.position.set(-0.03, -0.07, 0.03); this.armL.rotation.set(0.5, -0.45, 0); }
    else { this.armL.position.set(-0.01, (w.def.shape.h || 0.07) * 0.3 - 0.035, u.handZ); this.armL.rotation.set(0.42, -0.8, 0); }
    this.mag = u.mag; }
  fire(def) { this.kick = Math.min(1.4, this.kick + (def.cls === 'sniper' || def.cls === 'shotgun' ? 1.2 : def.cls === 'pistol' ? 0.8 : 0.45)); this.kickR = Math.min(1.5, this.kickR + 0.5); this.flashT = 0.04; }
  update(dt, pl, look) {
    const w = pl.w, key = (w ? w.def.id + w.optic : 'm' + pl.melee) + pl.model.look.shirt + pl.model.look.skin; if (key !== this.key) { this.key = key; this.rebuild(pl); }
    const u = this.gun.userData, ads = pl.adsT, pistol = u.pistol, port = G.aspect < 1;
    const hx = port ? (pistol ? 0.06 : 0.075) : (pistol ? 0.14 : 0.17), hy = port ? -0.2 : (pistol ? -0.14 : -0.17), hz = (port ? -0.62 : -0.46) + (pistol ? 0.06 : 0);
    const az = Math.min(port ? -0.5 : -0.32, -(u.scopeBack || 0.05) - 0.14) + (pistol ? -0.04 : 0);
    let x = lerp(hx, 0, ads), y = lerp(hy, -u.sightY, ads), z = lerp(hz, az, ads), rx = 0, ry = 0, rz = 0;
    this.kick = Math.max(0, this.kick - dt * 9 * (0.4 + this.kick)); this.kickR = Math.max(0, this.kickR - dt * 10 * (0.3 + this.kickR)); z += this.kick * 0.05 * (1 - ads * 0.4); rx += this.kickR * 0.05 * (1 - ads * 0.6); y += this.kick * 0.006;
    // balanço ao andar e inércia ao girar a câmera
    const mv = clamp(pl.speed / 5, 0, 1.4) * (pl.onGround ? 1 : 0) * (1 - ads * 0.85); this.bob += dt * (5 + pl.speed * 1.5) * (pl.speed > 0.3 ? 1 : 0); x += Math.sin(this.bob) * 0.006 * mv; y += Math.abs(Math.cos(this.bob)) * -0.008 * mv;
    this.swayX = lerp(this.swayX, clamp(look.x * 4, -0.06, 0.06), 1 - Math.exp(-10 * dt)); this.swayY = lerp(this.swayY, clamp(look.y * 4, -0.05, 0.05), 1 - Math.exp(-10 * dt)); ry += this.swayX * (1 - ads * 0.7); rx += this.swayY * (1 - ads * 0.7);
    const idle = Math.sin(G.time * 1.6) * 0.0016; y += idle * (1 - ads * 0.7);
    // corrida: arma abaixada e de lado
    const spr = pl.sprintVM; ry += spr * 0.55; rx -= spr * 0.3; x -= spr * 0.05; y -= spr * 0.04;
    // saque/troca, colete, arremesso: arma sai de quadro
    const low = Math.max(pl.drawT > 0 ? pl.drawT / 0.35 : 0, pl.busyLow || 0); y -= low * 0.28; rx -= low * 0.5;
    // recarga
    if (pl.reloadT > 0 && w) { const t = 1 - pl.reloadT / pl.reloadDur, s = Math.sin(Math.PI * t); rz += s * 0.4; rx += s * 0.22; y -= s * 0.04; if (this.mag) { const m = t < 0.2 ? 0 : t < 0.45 ? (t - 0.2) / 0.25 : t < 0.7 ? 1 - (t - 0.45) / 0.25 : 0; this.mag.position.y = -m * 0.3; this.mag.visible = !(t > 0.42 && t < 0.48); } this.armL.position.y = this._ly0 != null ? this._ly0 - s * 0.12 : this.armL.position.y; } else if (this.mag) { this.mag.position.y = 0; this.mag.visible = true; }
    // corpo a corpo
    if (pl.swingT > 0) { const t = 1 - pl.swingT / 0.4, s = Math.sin(Math.PI * t); if (!w) { z -= s * 0.28; rx += s * 0.5; ry += s * 0.5; x -= s * 0.1; } else { z -= s * 0.1; rz += s * 0.9; ry += s * 0.6; } }
    if (pl.air) y += clamp(pl.vel.y * 0.004, -0.03, 0.03);
    this.holder.position.set(x, y, z); this.holder.rotation.set(rx, ry, rz);
    const hideForScope = w && (w.optic === 'x8' || w.optic === 'x3') && ads > 0.85; this.holder.visible = !hideForScope;
    if (this.flashT > 0 && !hideForScope) { this.flashT -= dt; this.flash.visible = true; this.flash.position.set(x, y + (w ? (w.def.shape.h || 0.05) * 0.62 : 0), z + u.muzzle - 0.05); const s = (w && (w.def.cls === 'shotgun' || w.def.cls === 'sniper') ? 0.34 : 0.2) * (0.8 + Math.random() * 0.5); this.flash.scale.set(s, s, 1); this.flash.material.rotation = Math.random() * 6; } else this.flash.visible = false;
  }
}
