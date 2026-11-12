// Pets: Belo (gato cinza rajado com peito e patas brancos), Louro (periquito) e Nina (cachorrinha salsicha).
// Acompanham o dono sem colisão, sem som em partida e sem serem percebidos pelos bots.
import * as THREE from 'three';
import { G } from './state.js';
import { part, VMAT } from './mesh.js';
import { snd } from './audio.js';
import { damp, angDiff, clamp } from './util.js';

function quad(o) { // quadrúpede genérico: corpo + cabeça + 4 patas + cauda como grupos animáveis
  const g = new THREE.Group(); const body = new THREE.Mesh(part(o.body), VMAT); body.castShadow = true; g.add(body); const head = new THREE.Group(); head.position.set(0, o.headY, o.headZ); head.add(new THREE.Mesh(part(o.head), VMAT)); g.add(head);
  const legs = o.legs.map(([x, z]) => { const l = new THREE.Group(); l.position.set(x, o.legY, z); l.add(new THREE.Mesh(part(o.leg), VMAT)); g.add(l); return l; });
  const tail = new THREE.Group(); tail.position.set(0, o.tailY, o.tailZ); tail.add(new THREE.Mesh(part(o.tail), VMAT)); g.add(tail); return { g, body, head, legs, tail }; }
function buildBelo() { const GR = 0x8a8a84, DK = 0x4a4a46, WH = 0xf2efe8, PK = 0xe8a8a0; const st = []; for (let i = 0; i < 5; i++) st.push(['box', [0, 0.3, -0.12 + i * 0.075, 0.2, 0.012, 0.022], DK]);
  return quad({ legY: 0.17, headY: 0.3, headZ: -0.2, tailY: 0.27, tailZ: 0.22,
    body: [['sph', [0, 0.22, 0, 0.095, 0.09, 0.23], GR], ['sph', [0, 0.185, -0.02, 0.085, 0.07, 0.2], WH], ['sph', [0, 0.23, -0.15, 0.075, 0.075, 0.08], WH], ...st],
    head: [['sph', [0, 0.02, -0.02, 0.075, 0.068, 0.07], GR], ['sph', [0, -0.005, -0.06, 0.05, 0.04, 0.04], WH], ['box', [0, 0.062, -0.035, 0.1, 0.01, 0.03], DK], ['box', [0, 0.05, -0.05, 0.012, 0.03, 0.02], DK], ['cone', [0.045, 0.085, -0.01, 0.028, 0.06, 0.018, 0, 0, -0.2], GR], ['cone', [-0.045, 0.085, -0.01, 0.028, 0.06, 0.018, 0, 0, 0.2], GR], ['cone', [0.045, 0.08, -0.016, 0.014, 0.036, 0.008, 0, 0, -0.2], PK], ['cone', [-0.045, 0.08, -0.016, 0.014, 0.036, 0.008, 0, 0, 0.2], PK], ['sph', [0.03, 0.022, -0.078, 0.014, 0.014, 0.008], 0xc8d848], ['sph', [-0.03, 0.022, -0.078, 0.014, 0.014, 0.008], 0xc8d848], ['sph', [0.03, 0.022, -0.085, 0.005, 0.011, 0.004], 0x111111], ['sph', [-0.03, 0.022, -0.085, 0.005, 0.011, 0.004], 0x111111], ['sph', [0, -0.002, -0.098, 0.009, 0.007, 0.006], PK], ['box', [0.055, -0.01, -0.085, 0.08, 0.002, 0.002, 0, 0.3, 0.1], WH], ['box', [-0.055, -0.01, -0.085, 0.08, 0.002, 0.002, 0, -0.3, -0.1], WH], ['box', [0.055, -0.02, -0.085, 0.08, 0.002, 0.002, 0, 0.3, -0.1], WH], ['box', [-0.055, -0.02, -0.085, 0.08, 0.002, 0.002, 0, -0.3, 0.1], WH]],
    leg: [['cap', [0, -0.07, 0, 0.026, 0.035, 0.026], GR], ['sph', [0, -0.15, -0.012, 0.03, 0.022, 0.038], WH]], legs: [[0.055, -0.14], [-0.055, -0.14], [0.055, 0.14], [-0.055, 0.14]],
    tail: [['cap', [0, 0.02, 0.1, 0.02, 0.02, 0.055, 0, 0, 0], GR], ['cap', [0, 0.07, 0.2, 0.019, 0.019, 0.05], DK], ['sph', [0, 0.1, 0.27, 0.02, 0.02, 0.03], GR]] }); }
function buildNina() { const BR = 0x6a3a1e, TN = 0xb8743a, BK = 0x2a1a10;
  return quad({ legY: 0.1, headY: 0.24, headZ: -0.32, tailY: 0.2, tailZ: 0.33,
    body: [['cap', [0, 0.17, 0, 0.085, 0.085, 0.17, Math.PI / 2, 0, 0], BR], ['sph', [0, 0.14, -0.05, 0.075, 0.06, 0.25], TN], ['sph', [0, 0.2, -0.26, 0.075, 0.08, 0.09], BR], ['box', [0, 0.19, -0.2, 0.15, 0.03, 0.035], 0xc0241a]],
    head: [['sph', [0, 0.03, 0, 0.07, 0.065, 0.075], BR], ['cap', [0, 0.005, -0.1, 0.035, 0.03, 0.035, Math.PI / 2, 0, 0], TN], ['sph', [0, 0.012, -0.175, 0.018, 0.015, 0.014], BK], ['box', [0.07, -0.02, 0.01, 0.022, 0.13, 0.07, 0, 0, 0.18], BK], ['box', [-0.07, -0.02, 0.01, 0.022, 0.13, 0.07, 0, 0, -0.18], BK], ['sph', [0.035, 0.045, -0.06, 0.012, 0.012, 0.008], 0x1a1008], ['sph', [-0.035, 0.045, -0.06, 0.012, 0.012, 0.008], 0x1a1008], ['sph', [0.035, 0.062, -0.058, 0.012, 0.006, 0.006], TN], ['sph', [-0.035, 0.062, -0.058, 0.012, 0.006, 0.006], TN]],
    leg: [['cap', [0, -0.04, 0, 0.026, 0.02, 0.026], BR], ['sph', [0, -0.085, -0.014, 0.03, 0.018, 0.04], TN]], legs: [[0.06, -0.22], [-0.06, -0.22], [0.06, 0.24], [-0.06, 0.24]],
    tail: [['cap', [0, 0.05, 0.06, 0.014, 0.014, 0.05, -0.7, 0, 0], BR], ['sph', [0, 0.11, 0.11, 0.012, 0.02, 0.02], BK]] }); }
function buildLouro() { const GN = 0x4ac23a, YL = 0xf2d83a, BL = 0x3a78d0, g = new THREE.Group();
  const body = new THREE.Mesh(part([['sph', [0, 0, 0, 0.038, 0.055, 0.042, 0.35, 0, 0], GN], ['sph', [0, 0.012, -0.022, 0.03, 0.04, 0.026, 0.35, 0, 0], 0x8ee04a], ['box', [0, -0.06, 0.06, 0.016, 0.008, 0.11, -0.5, 0, 0], BL], ['box', [0.008, -0.058, 0.055, 0.012, 0.006, 0.09, -0.5, 0.12, 0], 0x2a58a0], ['box', [0.012, -0.065, -0.005, 0.004, 0.03, 0.004], 0xc8a8a0], ['box', [-0.012, -0.065, -0.005, 0.004, 0.03, 0.004], 0xc8a8a0]]), VMAT); g.add(body);
  const head = new THREE.Group(); head.position.set(0, 0.06, -0.018); head.add(new THREE.Mesh(part([['sph', [0, 0, 0, 0.03, 0.03, 0.03], YL], ['cone', [0, -0.006, -0.03, 0.01, 0.02, 0.012, -2.2, 0, 0], 0xe8a23a], ['sph', [0, 0.004, -0.028, 0.008, 0.006, 0.006], 0x6a8ad8], ['sph', [0.022, 0.006, -0.014, 0.006, 0.006, 0.005], 0x111111], ['sph', [-0.022, 0.006, -0.014, 0.006, 0.006, 0.005], 0x111111], ['sph', [0.02, -0.014, -0.012, 0.006, 0.006, 0.004], 0x4a3ad0], ['sph', [-0.02, -0.014, -0.012, 0.006, 0.006, 0.004], 0x4a3ad0], ['box', [0, 0.012, 0.012, 0.05, 0.003, 0.012], 0x2a2a2a], ['box', [0, 0.002, 0.02, 0.052, 0.003, 0.012], 0x2a2a2a]]), VMAT)); g.add(head);
  const wing = (s) => { const w = new THREE.Group(); w.position.set(s * 0.034, 0.012, 0.004); w.add(new THREE.Mesh(part([['box', [s * 0.045, 0, 0.012, 0.09, 0.006, 0.06], GN], ['box', [s * 0.09, 0, 0.03, 0.06, 0.005, 0.06], 0x2a8a2a], ['box', [s * 0.04, 0.004, 0.014, 0.07, 0.003, 0.012], 0x1a1a1a]]), VMAT)); g.add(w); return w; };
  return { g, body, head, legs: [], tail: null, wings: [wing(1), wing(-1)] }; }
export class Pet {
  constructor(id) { this.id = id; const m = id === 'belo' ? buildBelo() : id === 'nina' ? buildNina() : buildLouro(); Object.assign(this, m); this.pos = new THREE.Vector3(); this.yaw = 0; this.phase = 0; this.rest = 0; this.speed = 0; this.t = Math.random() * 9; this.happy = 0; this.fly = 0; G.scene.add(this.g); this.g.scale.setScalar(id === 'louro' ? 1.5 : id === 'belo' ? 1.25 : 1.15); this.sndT = 4; }
  dispose() { G.scene.remove(this.g); this.g.traverse((o) => o.geometry && o.geometry.dispose()); }
  interact() { this.happy = 1.4; snd.pet(this.id, this.pos); }
  // owner: {pos, yaw, speed, crouch, prone}; lobby: fica ao lado e faz graça
  update(dt, owner, lobby, visible) {
    this.g.visible = visible; if (!visible) return; this.t += dt; this.happy = Math.max(0, this.happy - dt); const fx = -Math.sin(owner.yaw), fz = -Math.cos(owner.yaw), rx = Math.cos(owner.yaw), rz = -Math.sin(owner.yaw);
    if (lobby) { this.sndT -= dt; if (this.sndT <= 0) { this.sndT = 9 + Math.random() * 10; snd.pet(this.id, this.pos); this.happy = 0.8; } }
    if (this.id === 'louro') { // pousa no ombro quando o dono está devagar; voa ao lado quando corre
      const perch = owner.speed < 3.2 && !owner.prone; this.fly = damp(this.fly, perch ? 0 : 1, 3, dt); const sh = owner.crouch ? 1.05 : 1.5; const tx = owner.pos.x + rx * (0.24 + this.fly * 0.9) + fx * this.fly * 0.4, tz = owner.pos.z + rz * (0.24 + this.fly * 0.9) + fz * this.fly * 0.4, ty = owner.pos.y + (owner.prone ? 0.5 : sh) + this.fly * (0.5 + Math.sin(this.t * 2.2) * 0.15) + (lobby && this.happy > 0 ? Math.sin(this.happy * 8) * 0.06 : 0);
      if (this.pos.distanceTo(owner.pos) > 20) this.pos.set(tx, ty, tz); const k = perch ? 14 : 5; this.pos.x = damp(this.pos.x, tx, k, dt); this.pos.y = damp(this.pos.y, ty, k, dt); this.pos.z = damp(this.pos.z, tz, k, dt); this.yaw += angDiff(this.yaw, owner.yaw + (perch ? Math.sin(this.t * 0.7) * 0.5 : 0)) * Math.min(1, dt * 6);
      const flap = this.fly > 0.15 || this.happy > 0 ? Math.sin(this.t * 34) * 0.9 : 0.0; const fold = this.fly > 0.15 || this.happy > 0 ? 0 : 1; this.wings[0].rotation.set(0, -1.35 * fold, flap - 0.25 * fold); this.wings[1].rotation.set(0, 1.35 * fold, -flap + 0.25 * fold); this.head.rotation.y = Math.sin(this.t * 1.7) * 0.6 * (1 - this.fly); this.head.rotation.x = Math.max(0, Math.sin(this.t * 3.1)) * 0.3 * (1 - this.fly); this.body.rotation.x = this.fly * 0.9; this.g.position.copy(this.pos); this.g.rotation.set(0, this.yaw, 0); return; }
    // gato e cachorro: seguem atrás/ao lado, param perto e descansam
    const side = this.id === 'belo' ? -0.9 : 0.9; const tx = owner.pos.x + rx * side - fx * 0.9, tz = owner.pos.z + rz * side - fz * 0.9; let dx = tx - this.pos.x, dz = tz - this.pos.z; const d = Math.hypot(dx, dz);
    if (d > 22 || Math.abs(this.pos.y - owner.pos.y) > 4) { this.pos.set(tx, owner.pos.y, tz); }
    const want = d > 0.5 ? Math.min(owner.speed + 2.2, this.id === 'belo' ? 7.5 : 6.5) * clamp(d / 1.6, 0.25, 1) : 0; this.speed = damp(this.speed, want, 8, dt);
    if (this.speed > 0.1 && d > 0.05) { this.pos.x += (dx / d) * this.speed * dt; this.pos.z += (dz / d) * this.speed * dt; this.yaw += angDiff(this.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 9); this.rest = 0; } else { this.rest += dt; this.yaw += angDiff(this.yaw, owner.yaw + (lobby ? Math.PI : 0)) * Math.min(1, dt * 2); }
    const gy = G.phys.ground(this.pos.x, this.pos.z, owner.pos.y + 0.5, owner.noTerrain); this.pos.y = damp(this.pos.y, Math.abs(gy - owner.pos.y) < 1.5 ? gy : owner.pos.y, 12, dt);
    const run = this.speed > 3.2; this.phase += dt * (4 + this.speed * 3.2); const p = this.phase, A = clamp(this.speed / 2.5, 0, 1) * (run ? 0.9 : 0.55);
    const sit = this.rest > 2.5 && !owner.prone ? Math.min(1, (this.rest - 2.5) * 2) : 0, low = owner.crouch || owner.prone ? 1 : 0;
    this.legs[0].rotation.x = Math.sin(p) * A; this.legs[1].rotation.x = Math.sin(p + (run ? 0.4 : Math.PI)) * A; this.legs[2].rotation.x = Math.sin(p + (run ? Math.PI : Math.PI)) * A + sit * 1.3; this.legs[3].rotation.x = Math.sin(p + (run ? Math.PI + 0.4 : 0)) * A + sit * 1.3;
    this.body.rotation.x = sit * -0.45 + (run ? Math.sin(p) * 0.06 : 0); this.body.position.y = -sit * 0.035 - low * 0.03 + Math.abs(Math.sin(p)) * 0.012 * A + (this.happy > 0 ? Math.abs(Math.sin(this.happy * 9)) * 0.06 : 0);
    this.head.rotation.y = Math.sin(this.t * 0.9) * 0.35 * (this.speed < 0.3 ? 1 : 0.2); this.head.rotation.x = -sit * 0.15 + (this.happy > 0 ? -0.3 : 0); this.head.position.y = (this.id === 'belo' ? 0.3 : 0.24) + sit * 0.05;
    this.tail.rotation.y = Math.sin(this.t * (this.id === 'nina' ? 14 : 2.2)) * (this.id === 'nina' ? 0.6 * (this.speed < 0.3 || this.happy > 0 ? 1 : 0.3) : 0.35); this.tail.rotation.x = this.id === 'belo' ? 0.2 + Math.sin(this.t * 1.3) * 0.15 - sit * 0.4 : 0;
    this.g.position.copy(this.pos); this.g.rotation.set(0, this.yaw, 0);
  }
}
