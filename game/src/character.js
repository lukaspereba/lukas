// Personagens humanoides articulados (ossos rígidos) com animação procedural sincronizada à velocidade.
import * as THREE from 'three';
import { part, VMAT, VMAT_DS, shade } from './mesh.js';
import { clamp, lerp, TAU, mulberry } from './util.js';
import { CHARS, OUTFITS } from './config.js';

const LT = 0.43, LS = 0.445, HIP0 = 0.04;
const CANOPY = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthWrite: false });
let chuteGeo = null;
function chute() { if (!chuteGeo) { const sp = [['hemi', [0, 5.0, 0, 2.7, 1.5, 2.7], 0xd9a520]]; for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU, x = Math.cos(a) * 2.5, z = Math.sin(a) * 2.5; const len = Math.hypot(x, 3.5, z); sp.push(['box', [x / 2, 3.25, z / 2, 0.015, len, 0.015, Math.atan2(Math.hypot(x, z), 3.5) * (z >= 0 ? 1 : -1) * Math.abs(Math.sin(a)), 0, -Math.atan2(x, 3.5) * Math.abs(Math.cos(a))], 0x2a2a2a]); if (i % 2) sp.push(['hemi', [x * 0.5, 5.02 + 0.2, z * 0.5, 1.2, 0.9, 1.2], 0x15171b]); } chuteGeo = part(sp); } return chuteGeo; }

function hairSpecs(style, col, rng) {
  const s = [], hi = shade(col, 1.6) || 0x3a2a20; const curl = (x, y, z, r, c = col) => s.push(['ico', [x, y, z, r, r * 0.9, r, rng() * 3, rng() * 3, 0], c]);
  if (style === 'short') { s.push(['hemi', [0, 0.115, 0.008, 0.097, 0.098, 0.106], col]); s.push(['sph', [0, 0.14, 0.04, 0.092, 0.08, 0.075], col]); }
  else if (style === 'cap') { s.push(['hemi', [0, 0.125, 0.004, 0.1, 0.095, 0.108], col]); s.push(['box', [0, 0.135, -0.13, 0.15, 0.012, 0.09], col]); }
  else if (style === 'helmet') { s.push(['hemi', [0, 0.105, 0.004, 0.108, 0.125, 0.116], col]); s.push(['box', [0, 0.1, 0, 0.222, 0.02, 0.236], shade(col, 0.7)]); }
  else if (style === 'balaclava') { s.push(['sph', [0, 0.1, 0.006, 0.098, 0.122, 0.106], col]); }
  else { // cabelos cacheados: aglomerado de pequenos volumes
    const fade = style === 'curlyFade'; const big = style === 'afroFringe'; const top = style === 'curlyTop';
    s.push(['hemi', [0, 0.12, 0.012, 0.094, fade ? 0.085 : 0.1, 0.103], fade ? shade(col, 1.25) : col]);
    const rows = big ? 4 : 3;
    for (let r = 0; r < rows; r++) { const n = [1, 6, 9, 11][r] + (big ? 2 : 0); const rad = [0, 0.045, 0.078, 0.092][r] * (fade ? 0.82 : 1); const y = [0.222, 0.208, 0.183, 0.15][r] + (big ? 0.012 : top ? 0.008 : 0);
      for (let i = 0; i < n; i++) { const a = (i / n) * TAU + r; const x = Math.cos(a) * rad, z = Math.sin(a) * rad + 0.01; if (fade && r === 2 && z > 0.02 && Math.abs(x) > 0.05) continue; if (r === 3 && z < -0.02 && !big) continue; curl(x, y + (rng() - 0.5) * 0.008, z, (big ? 0.036 : 0.031) + rng() * 0.008, top && rng() < 0.3 ? hi : col); } }
    // franja sobre a testa
    const fr = big ? 6 : top ? 5 : 3; for (let i = 0; i < fr; i++) curl((i - (fr - 1) / 2) * 0.03, big ? 0.168 : 0.186, -0.088 - (big ? 0.006 : 0), big ? 0.03 : 0.026, top && i % 2 ? hi : col);
    if (big) for (let i = 0; i < 5; i++) curl((i - 2) * 0.034, 0.148, -0.094, 0.024);
  }
  return s;
}

export class Humanoid {
  constructor(look) { this.root = new THREE.Group(); this.phase = 0; this.a = { crouch: 0, prone: 0, slide: 0, air: 0, dead: 0, chute: 0, fall: 0, drive: 0, sprint: 0, armed: 0, move: 0, lean: 0, kick: 0 }; this.hipY = 0.9; this.setLook(look); }
  setLook(L0) {
    const L = { ...L0 }; this.look = L; const r = this.root; while (r.children.length) { const c = r.children.pop(); c.traverse((o) => { if (o.geometry && o.geometry !== chuteGeo) o.geometry.dispose(); }); }
    const b = L.build || 1, skin = L.skin, sh = L.shirt, tr = L.trim != null ? L.trim : shade(sh, 0.7), pa = L.pants, shoes = L.shoes, rng = mulberry(L.seed || 7);
    const long = L.shirtKind === 'sweater' || L.shirtKind === 'vest', sleeveless = L.shirtKind === 'tank', longP = L.pantsKind === 'long';
    const G = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
    const add = (bone, specs, mat) => { const m = new THREE.Mesh(part(specs), mat || VMAT); m.castShadow = true; bone.add(m); return m; };
    const hip = this.hip = G(r, 0, 0.9, 0); const spine = this.spine = G(hip, 0, 0.08, 0); const head = this.head = G(spine, 0, 0.6, 0);
    add(hip, [['sph', [0, -0.02, 0, 0.168 * b, 0.125, 0.118], pa], ['cyl', [0, 0.065, 0, 0.158 * b, 0.035, 0.108], L.belt || shade(pa, 0.6)]]);
    const chest = [['cap', [0, 0.27, 0, 0.178 * b, 0.132, 0.112], sh], ['sph', [0.17 * b, 0.445, 0, 0.078, 0.07, 0.078], sleeveless ? skin : sh], ['sph', [-0.17 * b, 0.445, 0, 0.078, 0.07, 0.078], sleeveless ? skin : sh], ['cyl', [0, 0.545, 0, 0.046, 0.09, 0.048], skin]];
    if (L.shirtKind === 'polo') { chest.push(['box', [0, 0.5, -0.045, 0.13, 0.03, 0.07, 0.5, 0, 0], tr]); chest.push(['box', [0, 0.44, -0.108, 0.012, 0.09, 0.01], tr]); chest.push(['cyl', [-0.07 * b, 0.4, -0.103, 0.022, 0.012, 0.022, Math.PI / 2, 0, 0], 0xd8d8d8]); }
    if (L.shirtKind === 'tee') { chest.push(['box', [0.085 * b, 0.33, -0.104, 0.008, 0.2, 0.008, 0, 0, 0.32], tr]); chest.push(['box', [-0.085 * b, 0.33, -0.104, 0.008, 0.2, 0.008, 0, 0, -0.32], tr]); chest.push(['box', [0.03 * b, 0.4, -0.112, 0.07, 0.01, 0.006, 0, 0, 0.2], tr]); }
    if (L.shirtKind === 'jersey') { chest.push(['box', [0, 0.36, -0.113, 0.1, 0.09, 0.008], tr]); chest.push(['box', [0, 0.36, 0.113, 0.11, 0.12, 0.008], tr]); chest.push(['box', [0.176 * b, 0.26, 0, 0.01, 0.3, 0.06], tr]); chest.push(['box', [-0.176 * b, 0.26, 0, 0.01, 0.3, 0.06], tr]); }
    if (L.shirtKind === 'vest') { chest.push(['box', [0, 0.3, -0.1, 0.3 * b, 0.3, 0.07], tr]); chest.push(['box', [0, 0.3, 0.1, 0.3 * b, 0.32, 0.06], tr]); for (const x of [-0.09, 0, 0.09]) chest.push(['box', [x * b, 0.2, -0.145, 0.07, 0.1, 0.04], shade(tr, 0.8)]); }
    if (L.shirtKind === 'sweater') for (let i = 0; i < 5; i++) chest.push(['cyl', [0, 0.1 + i * 0.075, 0, 0.18 * b - Math.abs(i - 2) * 0.004, 0.006, 0.114], shade(sh, 0.82)]);
    if (L.pack) chest.push(['box', [0, 0.3, 0.16, 0.24, 0.32, 0.12], L.pack]);
    add(spine, chest);
    // cabeça com rosto em geometria
    const hs = [['sphHi', [0, 0.1, 0, 0.092, 0.116, 0.1], skin], ['sph', [0, 0.045, -0.014, 0.074, 0.066, 0.08], skin], ['box', [0, 0.085, -0.1, 0.02, 0.042, 0.03, -0.25, 0, 0], shade(skin, 0.92)], ['sph', [0.093, 0.095, 0.004, 0.014, 0.028, 0.02], shade(skin, 0.9)], ['sph', [-0.093, 0.095, 0.004, 0.014, 0.028, 0.02], shade(skin, 0.9)]];
    if (L.hair !== 'balaclava') { for (const x of [0.034, -0.034]) { hs.push(['sph', [x, 0.116, -0.086, 0.017, 0.011, 0.008], 0xf2f0ea]); hs.push(['sph', [x, 0.116, -0.092, 0.0085, 0.0085, 0.004], L.eye || 0x3a2416]); hs.push(['box', [x, 0.138, -0.09, 0.03, 0.007, 0.01, 0, 0, x > 0 ? -0.12 : 0.12], L.hairCol]); } hs.push(['box', [0, 0.04, -0.091, 0.03, 0.006, 0.008], 0x7a3a34]); }
    else { hs.push(['box', [0, 0.116, -0.094, 0.11, 0.022, 0.012], skin]); for (const x of [0.03, -0.03]) hs.push(['sph', [x, 0.116, -0.099, 0.012, 0.009, 0.005], 0x1a1a1a]); }
    if (L.mustache) hs.push(['box', [0, 0.055, -0.094, 0.044, 0.006, 0.008], shade(L.hairCol, 1.3)]);
    if (L.earring) hs.push(['sph', [-0.097, 0.07, 0.002, 0.007, 0.007, 0.007], 0xf4f4f4]);
    if (L.mask) hs.push(['box', [0, 0.06, -0.085, 0.13, 0.07, 0.07], L.mask]);
    hairSpecs(L.hair, L.hairCol, rng).forEach((q) => hs.push(q));
    this.headMesh = add(head, hs);
    // braços
    const arm = (sx) => { const up = G(spine, sx * 0.21 * b, 0.44, 0), fo = G(up, 0, -0.28, 0); const upCol = sleeveless ? skin : sh, half = !long && !sleeveless;
      add(up, half ? [['cap', [0, -0.075, 0, 0.052, 0.045, 0.052], sh], ['cap', [0, -0.185, 0, 0.043, 0.048, 0.043], skin], ['cyl', [0, -0.135, 0, 0.053, 0.012, 0.053], tr]] : [['cap', [0, -0.14, 0, 0.048, 0.07, 0.048], upCol]]);
      add(fo, [['cap', [0, -0.12, 0, long ? 0.042 : 0.037, 0.06, long ? 0.042 : 0.037], long ? sh : skin], ['sph', [0, -0.275, 0, 0.036, 0.05, 0.028], L.gloves || skin]]); return [up, fo]; };
    [this.armR, this.foreR] = arm(1); [this.armL, this.foreL] = arm(-1);
    const leg = (sx) => { const th = G(hip, sx * 0.092 * b, -HIP0, 0), sn = G(th, 0, -LT, 0);
      add(th, longP ? [['cap', [0, -0.21, 0, 0.074, 0.108, 0.078], pa]] : [['cap', [0, -0.17, 0, 0.082, 0.09, 0.086], pa], ['cap', [0, -0.33, 0, 0.056, 0.05, 0.058], skin], ['cyl', [0, -0.3, 0, 0.083, 0.01, 0.087], shade(pa, 0.8)]]);
      const sp = [['cap', [0, -0.2, 0, longP ? 0.058 : 0.049, 0.098, longP ? 0.06 : 0.052], longP ? pa : skin]];
      if (shoes != null) { sp.push(['sph', [0, -0.405, -0.045, 0.05, 0.042, 0.125], shoes]); sp.push(['box', [0, -0.437, -0.04, 0.094, 0.018, 0.25], shade(shoes, 0.5)]); } else { sp.push(['sph', [0, -0.415, -0.05, 0.043, 0.03, 0.115], skin]); }
      add(sn, sp); return [th, sn]; };
    [this.thR, this.snR] = leg(1); [this.thL, this.snL] = leg(-1);
    this.gun = G(spine, 0.1, 0.33, -0.26); this.canopy = new THREE.Mesh(chute(), CANOPY); this.canopy.visible = false; r.add(this.canopy);
    r.scale.setScalar((L.h || 1) * 0.975);
  }
  setShadow(on) { if (this._sh === on) return; this._sh = on; this.root.traverse((o) => { if (o.isMesh && o !== this.canopy) o.castShadow = on; }); }
  setWeapon(obj) { while (this.gun.children.length) this.gun.remove(this.gun.children[0]); if (obj) this.gun.add(obj); }
  // s: {speed, fwd, crouch, prone, slide, air, pitch, armed:'rifle'|'pistol'|'melee'|null, sprint, dead, chute, fall, drive, reload(0..1|0), swing(0..1|0), fire}
  update(dt, s) {
    const a = this.a, k = 1 - Math.exp(-11 * dt), k2 = 1 - Math.exp(-6 * dt);
    a.crouch += ((s.crouch ? 1 : 0) - a.crouch) * k; a.prone += ((s.prone ? 1 : 0) - a.prone) * k2; a.slide += ((s.slide ? 1 : 0) - a.slide) * k; a.air += ((s.air ? 1 : 0) - a.air) * k; a.dead += ((s.dead ? 1 : 0) - a.dead) * (1 - Math.exp(-5 * dt)); a.chute += ((s.chute ? 1 : 0) - a.chute) * k2; a.fall += ((s.fall ? 1 : 0) - a.fall) * k2; a.drive += ((s.drive ? 1 : 0) - a.drive) * k; a.sprint += ((s.sprint && !s.fire ? 1 : 0) - a.sprint) * k; a.kick = Math.max(0, a.kick - dt * 9) + (s.fire ? 0.5 : 0); if (a.kick > 1) a.kick = 1;
    const sp = s.speed || 0, w = clamp(sp / 1.4, 0, 1) * (1 - a.air) * (1 - a.slide); a.move += (w - a.move) * k;
    const stride = (1.25 + Math.min(sp, 8) * 0.2) * (1 - a.crouch * 0.35) * (1 - a.prone * 0.5);
    this.phase += ((sp * dt) / stride) * TAU * ((s.fwd || 0) < -0.3 ? -1 : 1); const p = this.phase;
    const A = (0.3 + Math.min(sp, 7.5) * 0.075) * a.move;
    const cyc = (ph) => [A * Math.sin(ph), (0.12 + 1.35 * A * Math.pow(0.5 + 0.5 * Math.cos(ph), 2)) * a.move];
    let [tL, kL] = cyc(p), [tR, kR] = cyc(p + Math.PI);
    const c = a.crouch * (1 - a.prone), ws = 1 - c * 0.45; tL = tL * ws + 1.0 * c; tR = tR * ws + 0.72 * c; kL = kL * ws + 2.0 * c; kR = kR * ws + 1.95 * c;
    // deslize
    const sl = a.slide; tL = lerp(tL, 1.25, sl); kL = lerp(kL, 0.25, sl); tR = lerp(tR, 1.1, sl); kR = lerp(kR, 1.9, sl);
    // ar / queda livre / paraquedas / dirigindo
    const air = a.air * (1 - a.fall) * (1 - a.chute); tL = lerp(tL, 0.5, air); kL = lerp(kL, 0.9, air); tR = lerp(tR, 0.15, air); kR = lerp(kR, 0.5, air);
    const fl = a.fall; tL = lerp(tL, -0.35, fl); tR = lerp(tR, -0.35, fl); kL = lerp(kL, 0.9 + Math.sin(p * 0 + performance.now() * 0.006) * 0.08, fl); kR = lerp(kR, 0.9, fl);
    const ch = a.chute; tL = lerp(tL, 0.25, ch); tR = lerp(tR, 0.1, ch); kL = lerp(kL, 0.45, ch); kR = lerp(kR, 0.3, ch);
    const dr = a.drive; tL = lerp(tL, 1.45, dr); tR = lerp(tR, 1.45, dr); kL = lerp(kL, 1.35, dr); kR = lerp(kR, 1.35, dr);
    const pr = a.prone, dd = a.dead; if (pr > 0.01) { const cr = Math.sin(p) * 0.25 * a.move; tL = lerp(tL, cr, pr); tR = lerp(tR, -cr, pr); kL = lerp(kL, Math.max(0, cr) * 1.5, pr); kR = lerp(kR, Math.max(0, -cr) * 1.5, pr); }
    if (dd > 0.01) { tL = lerp(tL, 0.15, dd); tR = lerp(tR, -0.1, dd); kL = lerp(kL, 0.5, dd); kR = lerp(kR, 0.1, dd); }
    this.thL.rotation.x = tL; this.snL.rotation.x = -kL; this.thR.rotation.x = tR; this.snR.rotation.x = -kR; this.thL.rotation.z = -(0.04 + fl * 0.5 + pr * 0.18 + dd * 0.2); this.thR.rotation.z = 0.04 + fl * 0.5 + pr * 0.18 + dd * 0.2;
    // altura do quadril: a perna de apoio sempre toca o chão (sem pés deslizando ou afundando)
    const ext = Math.max(LT * Math.cos(tL) + LS * Math.cos(tL - kL), LT * Math.cos(tR) + LS * Math.cos(tR - kR)); let hy = ext + HIP0 - Math.abs(Math.sin(p)) * 0.012 * a.move;
    hy = lerp(hy, 0.3, sl); hy = lerp(hy, 0.62, dr); hy = lerp(hy, 0.17, pr); hy = lerp(hy, 0.15, dd); hy = lerp(hy, 1.0, Math.max(fl, ch)); this.hip.position.y = hy; this.hipY = hy;
    const hipPitch = -Math.PI / 2 * pr + (Math.PI / 2) * dd * (1 - pr) + sl * 0.55 - fl * 1.25 * (1 - dd) + a.sprint * a.move * -0.16 * (1 - c);
    this.hip.rotation.x = hipPitch; this.hip.rotation.y = (s.strafe || 0) * -0.35 * a.move; this.hip.rotation.z = Math.sin(p) * 0.03 * a.move;
    const pitch = (s.pitch || 0) * (1 - dd) * (1 - fl);
    this.spine.rotation.x = pitch * 0.5 + c * -0.42 + pr * 0.22 - sl * 0.75 + dr * 0.1 + a.kick * 0.03; this.spine.rotation.y = -this.hip.rotation.y + Math.sin(p) * 0.07 * a.move * (1 - (s.armed ? 0.6 : 0)); this.spine.rotation.z = -this.hip.rotation.z;
    this.head.rotation.x = pitch * 0.4 + pr * 1.05 * (1 - dd) + c * 0.3 + fl * 0.8 + a.sprint * a.move * 0.12 - dd * 0.2; this.head.rotation.y = dd * 0.5;
    // braços
    const armed = s.armed, sw = Math.sin(p) * A; let RX, RZ, RF, LX, LZ, LF, gx = 0, gy = 0, gpx = 0.1, gpy = 0.33, gpz = -0.26;
    if (armed === 'rifle') { RX = 0.72; RZ = -0.3; RF = 1.38; LX = 1.18; LZ = 0.46; LF = 0.62; }
    else if (armed === 'pistol') { RX = 1.32; RZ = -0.42; RF = 0.3; LX = 1.3; LZ = 0.5; LF = 0.34; gpx = 0.02; gpy = 0.36; gpz = -0.52; }
    else if (armed === 'melee') { RX = 0.75; RZ = -0.2; RF = 1.7; LX = 0.9; LZ = 0.3; LF = 1.7; }
    else { RX = -sw * 0.9; RZ = 0.1; RF = 0.25 + a.move * 0.7; LX = sw * 0.9; LZ = -0.1; LF = 0.25 + a.move * 0.7; }
    const spr = a.sprint * a.move * (armed === 'rifle' ? 1 : 0); RX = lerp(RX, 0.35 - sw * 0.25, spr); RF = lerp(RF, 1.55, spr); LX = lerp(LX, 0.95 + sw * 0.25, spr); LF = lerp(LF, 1.1, spr); gy = spr * 0.75; gx = -spr * 0.4;
    if (s.reload > 0 && armed) { const t = Math.sin(Math.min(1, s.reload) * Math.PI); LX = lerp(LX, 0.55, t); LF = lerp(LF, 1.3, t); gx -= t * 0.25; }
    if (s.swing > 0) { const t = Math.sin(Math.min(1, s.swing) * Math.PI); RX = lerp(RX, 1.7, t); RF = lerp(RF, 0.3, t); RZ = lerp(RZ, -0.6, t); this.spine.rotation.y -= t * 0.5; }
    RX -= a.kick * 0.05; LX -= a.kick * 0.05;
    if (pr > 0.01) { RX = lerp(RX, 2.5, pr); LX = lerp(LX, 2.6, pr); RF = lerp(RF, 0.55, pr); LF = lerp(LF, 0.35, pr); RZ = lerp(RZ, -0.25, pr); LZ = lerp(LZ, 0.3, pr); }
    if (fl > 0.01) { RX = lerp(RX, 2.2, fl); LX = lerp(LX, 2.2, fl); RZ = lerp(RZ, 1.1, fl); LZ = lerp(LZ, -1.1, fl); RF = lerp(RF, 0.5, fl); LF = lerp(LF, 0.5, fl); }
    if (ch > 0.01) { RX = lerp(RX, 2.85, ch); LX = lerp(LX, 2.85, ch); RZ = lerp(RZ, 0.28, ch); LZ = lerp(LZ, -0.28, ch); RF = lerp(RF, 0.25, ch); LF = lerp(LF, 0.25, ch); }
    if (dr > 0.01) { RX = lerp(RX, 1.15, dr); LX = lerp(LX, 1.15, dr); RZ = lerp(RZ, -0.15, dr); LZ = lerp(LZ, 0.15, dr); RF = lerp(RF, 0.45, dr); LF = lerp(LF, 0.45, dr); }
    if (dd > 0.01) { RX = lerp(RX, 0.2, dd); LX = lerp(LX, -0.1, dd); RZ = lerp(RZ, 1.0, dd); LZ = lerp(LZ, -0.8, dd); RF = lerp(RF, 0.4, dd); LF = lerp(LF, 0.2, dd); }
    this.armR.rotation.set(RX, 0, RZ); this.foreR.rotation.x = RF; this.armL.rotation.set(LX, 0, LZ); this.foreL.rotation.x = LF;
    const g = this.gun; g.visible = !!armed && armed !== 'melee' && dd < 0.5 && fl < 0.5 && ch < 0.5 && dr < 0.5;
    if (g.visible) { g.position.set(gpx - spr * 0.06, lerp(gpy, 0.66, pr) - spr * 0.1, lerp(gpz, -0.1, pr) + a.kick * 0.02); g.rotation.set(pitch * 0.45 + gx + (Math.PI / 2) * pr - pr * 0.22 - c * -0.42 * 0 + (c * 0.42), gy, 0); }
    const cn = this.canopy; cn.visible = ch > 0.3; if (cn.visible) { cn.scale.setScalar(Math.min(1, (ch - 0.3) * 2.2)); cn.rotation.z = Math.sin(performance.now() * 0.0012) * 0.05; }
  }
}

// Aparências dos 4 personagens (ordem das fotos: Lukas, Bahia, Kaique, Mosquitão) + trajes.
export function lookFor(charId, outfitId) { const c = CHARS.find((x) => x.id === charId) || CHARS[0]; const o = OUTFITS.find((x) => x.id === outfitId); const L = { ...c, seed: c.id.length * 13 + 3 }; if (o && o.id !== 'padrao') { Object.assign(L, { shirt: o.shirt, trim: o.trim, pants: o.pants, shirtKind: o.shirtKind, pantsKind: o.pantsKind, shoes: o.shoes }); } return L; }
const SKINS = [0xe0b090, 0xc68e62, 0xa8744e, 0x8a5a38, 0x6a4228, 0x4e3020], SHIRTS = [0x4a5a3a, 0x5a5e64, 0x6b4a2e, 0x2e3e52, 0x7a3a2a, 0x3a3d42, 0x8a8f6a, 0x2a4a3a, 0x9a8a6a, 0x44382c], PANTS = [0x2a2c30, 0x3a3d34, 0x4a4436, 0x23303e, 0x55503e];
export function botLook(i) { const r = mulberry(1000 + i * 77); const hair = ['cap', 'helmet', 'balaclava', 'short', 'cap', 'helmet'][(r() * 6) | 0]; const sh = SHIRTS[(r() * SHIRTS.length) | 0];
  return { seed: i + 50, skin: SKINS[(r() * SKINS.length) | 0], hair, hairCol: hair === 'short' ? 0x1a1512 : hair === 'balaclava' ? 0x1c1d20 : [0x3a4a2e, 0x2a2c30, 0x6a5a3a, 0x7a2a22, 0x23303e][(r() * 5) | 0], shirt: sh, shirtKind: r() < 0.6 ? 'vest' : 'sweater', trim: shade(sh, 0.6), pants: PANTS[(r() * PANTS.length) | 0], pantsKind: 'long', shoes: 0x1a1b1d, gloves: r() < 0.5 ? 0x1a1b1d : null, h: 0.96 + r() * 0.08, build: 0.94 + r() * 0.16, pack: r() < 0.4 ? 0x3a3d34 : null };
}
