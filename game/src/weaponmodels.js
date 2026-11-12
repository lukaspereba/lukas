// Modelos 3D procedurais das armas. Cada arma tem silhueta própria definida por 'shape' em config.js.
// Convenção: cano aponta para -Z, empunhadura na origem, +Y para cima.
import * as THREE from 'three';
import { part, VMAT, shade } from './mesh.js';

const METAL = 0x1c1d20, STEEL = 0x55585c;
export function buildWeapon(def, optic) {
  const s = def.shape, body = s.body, fur = s.fur; const sp = [], magSp = []; let muzzle, sightY, handZ, backZ = 0.1, optZ = -0.06;
  const B = (x, y, z, w, h, d, c, rx = 0, ry = 0, rz = 0) => sp.push(['box', [x, y, z, w, h, d, rx, ry, rz], c]);
  const Cy = (x, y, z, r, len, c, r2) => sp.push(['cyl', [x, y, z, r, len, r2 || r, Math.PI / 2, 0, 0], c]);
  if (s.pistol) {
    const L = s.len; sightY = 0.062;
    if (s.pistol === 2) { // revólver
      B(0, 0.035, -L * 0.42, 0.03, 0.045, L * 0.36, body); Cy(0, 0.04, -L * 0.2, 0.026, 0.05, shade(body, 0.85)); Cy(0, 0.048, -L * 0.72, 0.011, L * 0.56, body); B(0, 0.028, -L * 0.7, 0.012, 0.014, L * 0.5, body); B(0, 0.062, -L * 0.96, 0.005, 0.012, 0.01, METAL); B(0, 0.06, -L * 0.08, 0.008, 0.02, 0.02, STEEL, 0.5);
      B(0, -0.045, 0.02, 0.03, 0.11, 0.042, fur, 0.32); muzzle = -L; handZ = -0.04;
    } else { B(0, 0.045, -L * 0.42, 0.03, 0.032, L, body); B(0, 0.022, -L * 0.36, 0.028, 0.018, L * 0.82, shade(body, 0.8)); B(0, -0.04, 0.005, 0.029, 0.105, 0.046, fur, 0.2); B(0, 0.005, -0.06, 0.008, 0.03, 0.05, METAL); B(0, 0.064, -L * 0.88, 0.005, 0.008, 0.008, METAL); B(0, 0.064, 0.04, 0.016, 0.008, 0.006, METAL);
      Cy(0, 0.045, -L * 0.93, 0.008, 0.02, METAL); magSp.push(['box', [0, -0.05, 0.008, 0.022, 0.1, 0.034, 0.2, 0, 0], shade(fur, 0.7)]); muzzle = -L * 0.93; handZ = -0.03; }
    backZ = 0.06; optZ = -0.02;
  } else {
    const len = s.len, h = s.h, bull = s.stock === 'bull'; const rz0 = bull ? 0.16 : 0.05; // traseira do receptor
    const front = rz0 - len; sightY = h + 0.045;
    B(0, h / 2, rz0 - len / 2, 0.05, h, len, body); // receptor
    B(0, -0.045, 0.0, 0.032, 0.1, 0.045, fur, 0.28); // empunhadura
    B(0, -0.012, -0.075, 0.006, 0.006, 0.06, METAL); B(0, -0.03, -0.1, 0.006, 0.04, 0.006, METAL); // guarda-mato
    // guarda-mão e cano
    const hgEnd = front - s.hand; if (s.hand > 0) { if (s.pump) { Cy(0, h * 0.72, front - s.hand / 2, 0.02, s.hand, METAL); Cy(0, h * 0.3, front - s.hand * 0.55, s.handR * 0.82, s.hand * 0.7, fur); } else { sp.push(['cyl', [0, h * 0.55, front - s.hand / 2, s.handR, s.hand, s.handR * 1.05, Math.PI / 2, 0, 0], fur]); if (s.rail) for (let i = 0; i < 4; i++) B(0, h * 0.55 + s.handR + 0.004, front - 0.03 - i * (s.hand - 0.04) / 4, 0.022, 0.008, 0.02, METAL); } }
    Cy(0, h * 0.62, hgEnd - s.barrel / 2, 0.011, s.barrel, METAL); muzzle = hgEnd - s.barrel;
    if (s.brake) { Cy(0, h * 0.62, muzzle - 0.03, 0.02, 0.07, STEEL); B(0, h * 0.62, muzzle - 0.03, 0.05, 0.012, 0.03, METAL); muzzle -= 0.065; } else { Cy(0, h * 0.62, muzzle - 0.012, 0.015, 0.035, METAL); muzzle -= 0.03; }
    if (s.gasTube) { Cy(0, h * 0.95, front - s.hand * 0.6, 0.011, s.hand * 1.2, METAL); B(0, h * 0.8, front - s.hand * 1.2, 0.02, 0.05, 0.02, METAL); }
    if (s.mag === 'tube') Cy(0, h * 0.3, hgEnd - s.barrel * 0.42, 0.014, s.barrel * 0.82, METAL);
    if (s.sightF) { B(0, h + 0.03, hgEnd - 0.02, 0.008, 0.06, 0.012, METAL); B(0, h + 0.025, rz0 - 0.03, 0.02, 0.03, 0.01, METAL); }
    if (s.carry) { B(0, h + 0.045, rz0 - len * 0.5, 0.014, 0.012, len * 0.55, body); B(0, h + 0.02, rz0 - len * 0.25, 0.014, 0.04, 0.014, body); B(0, h + 0.02, rz0 - len * 0.75, 0.014, 0.04, 0.014, body); sightY = h + 0.062; }
    if (s.rail) B(0, h + 0.006, rz0 - len * 0.5, 0.024, 0.012, len * 0.86, METAL);
    if (s.bipod) { for (const x of [-0.03, 0.03]) B(x, h * 0.3 - 0.04, hgEnd + 0.06, 0.008, 0.01, 0.2, METAL, 0.12, 0, 0); }
    if (s.bolt) { Cy(0.035, h * 0.75, rz0 - len * 0.35, 0.006, 0.01, STEEL); sp.push(['cyl', [0.05, h * 0.68, rz0 - len * 0.35, 0.006, 0.05, 0.006, 0, 0, 1.1], STEEL]); sp.push(['sph', [0.072, h * 0.6, rz0 - len * 0.35, 0.011, 0.011, 0.011], METAL]); }
    // coronha
    const st = s.stock; if (st === 'tele') { Cy(0, h * 0.6, rz0 + 0.1, 0.014, 0.2, METAL); B(0, h * 0.45, rz0 + 0.2, 0.034, h + 0.05, 0.07, fur); B(0, h * 0.2, rz0 + 0.14, 0.02, 0.03, 0.1, fur); backZ = rz0 + 0.235; }
    else if (st === 'fixed') { B(0, h * 0.42, rz0 + 0.13, 0.04, h * 0.9, 0.26, fur, -0.08); B(0, h * 0.34, rz0 + 0.265, 0.042, h + 0.04, 0.02, METAL); backZ = rz0 + 0.275; }
    else if (st === 'wood') { B(0, h * 0.3, rz0 + 0.13, 0.038, h * 0.85, 0.27, fur, -0.16); B(0, h * 0.14, rz0 + 0.265, 0.04, h + 0.035, 0.02, shade(fur, 0.6)); backZ = rz0 + 0.275; }
    else if (st === 'skel') { B(0, h * 0.82, rz0 + 0.12, 0.016, 0.016, 0.24, METAL); B(0, h * 0.12, rz0 + 0.13, 0.016, 0.016, 0.24, METAL, -0.2); B(0, h * 0.4, rz0 + 0.245, 0.034, h + 0.05, 0.022, fur); B(0, h * 0.95, rz0 + 0.14, 0.03, 0.02, 0.1, fur); backZ = rz0 + 0.256; }
    else if (st === 'fold') { B(0.02, h * 0.7, rz0 + 0.11, 0.012, 0.02, 0.22, METAL); B(0.01, h * 0.45, rz0 + 0.225, 0.03, h + 0.03, 0.018, fur); backZ = rz0 + 0.234; }
    else if (st === 'bull') { B(0, h * 0.45, rz0 + 0.012, 0.052, h + 0.02, 0.025, fur); backZ = rz0 + 0.025; }
    else backZ = rz0;
    // carregador (malha separada para animar a recarga)
    const mz = bull ? 0.1 : rz0 - len * 0.62; const mc = shade(body, 0.75); const Mg = (x, y, z, w, hh, d, c, rx = 0) => magSp.push(['box', [x, y, z, w, hh, d, rx, 0, 0], c]);
    switch (s.mag) { case 'stanag': Mg(0, -0.07, mz, 0.026, 0.12, 0.06, mc, 0.1); Mg(0, -0.155, mz - 0.012, 0.026, 0.07, 0.058, mc, 0.26); break;
      case 'banana': Mg(0, -0.05, mz, 0.028, 0.09, 0.066, mc, 0.12); Mg(0, -0.125, mz - 0.018, 0.028, 0.08, 0.064, mc, 0.36); Mg(0, -0.19, mz - 0.05, 0.028, 0.07, 0.062, mc, 0.62); break;
      case 'box20': Mg(0, -0.06, mz, 0.03, 0.12, 0.075, mc); break; case 'box12': Mg(0, -0.08, mz, 0.046, 0.16, 0.07, mc, 0.05); break;
      case 'curve9': Mg(0, -0.07, mz, 0.022, 0.12, 0.036, mc, 0.06); Mg(0, -0.165, mz - 0.01, 0.022, 0.08, 0.035, mc, 0.2); break; case 'straight': Mg(0, -0.1, mz, 0.03, 0.2, 0.04, mc); break;
      case 'grip': Mg(0, -0.14, 0.012, 0.026, 0.14, 0.036, mc, 0.28); break; case 'top': Mg(0, h + 0.022, rz0 - len * 0.5, 0.05, 0.03, len * 0.6, 0x6a6048); break;
      case 'drum': magSp.push(['cyl', [0, -0.07, mz, 0.062, 0.055, 0.062, 0, 0, Math.PI / 2], mc]); Mg(0, -0.01, mz, 0.03, 0.05, 0.05, mc); break;
      case 'belt': Mg(-0.045, -0.04, mz, 0.075, 0.1, 0.11, 0x4a4f3a); Mg(-0.01, h * 0.5, mz, 0.05, 0.012, 0.03, 0xc9a040); break; default: break; }
    handZ = s.hand > 0 ? front - s.hand * 0.5 : front + 0.06; optZ = rz0 - len * 0.45;
  }
  // mira óptica
  const oy = sightY - 0.035; let lensY = sightY, scopeBack = optZ + 0.04;
  if (optic === 'reddot') { B(0, oy + 0.012, optZ, 0.03, 0.014, 0.05, METAL); B(-0.017, oy + 0.04, optZ - 0.012, 0.004, 0.046, 0.016, METAL); B(0.017, oy + 0.04, optZ - 0.012, 0.004, 0.046, 0.016, METAL); B(0, oy + 0.064, optZ - 0.012, 0.038, 0.004, 0.016, METAL); lensY = oy + 0.04; }
  else if (optic === 'holo') { B(0, oy + 0.014, optZ, 0.036, 0.022, 0.08, METAL); B(-0.02, oy + 0.046, optZ - 0.02, 0.005, 0.05, 0.03, METAL); B(0.02, oy + 0.046, optZ - 0.02, 0.005, 0.05, 0.03, METAL); B(0, oy + 0.072, optZ - 0.02, 0.045, 0.005, 0.03, METAL); lensY = oy + 0.046; }
  else if (optic === 'x3') { Cy(0, oy + 0.042, optZ, 0.02, 0.14, METAL); Cy(0, oy + 0.042, optZ - 0.08, 0.025, 0.03, METAL); B(0, oy + 0.012, optZ, 0.02, 0.022, 0.06, METAL); lensY = oy + 0.042; scopeBack = optZ + 0.07; }
  else if (optic === 'x8') { Cy(0, oy + 0.05, optZ - 0.02, 0.018, 0.3, METAL); Cy(0, oy + 0.05, optZ - 0.18, 0.029, 0.07, METAL); Cy(0, oy + 0.05, optZ + 0.13, 0.024, 0.05, METAL); B(0, oy + 0.076, optZ - 0.02, 0.014, 0.016, 0.02, METAL); B(0, oy + 0.014, optZ - 0.06, 0.02, 0.026, 0.02, METAL); B(0, oy + 0.014, optZ + 0.04, 0.02, 0.026, 0.02, METAL); lensY = oy + 0.05; scopeBack = optZ + 0.155; }
  const g = new THREE.Group(); const m = new THREE.Mesh(part(sp), VMAT); m.castShadow = true; g.add(m);
  let mag = null; if (magSp.length) { mag = new THREE.Mesh(part(magSp), VMAT); g.add(mag); }
  g.userData = { muzzle, sightY: lensY, handZ, backZ, mag, len: backZ - muzzle, pistol: !!s.pistol, scopeBack };
  return g;
}
export function buildKnife() { const g = new THREE.Group(); g.add(new THREE.Mesh(part([['box', [0, 0, 0.0, 0.026, 0.03, 0.11], 0x2a2c30], ['box', [0, 0, -0.06, 0.05, 0.036, 0.012], 0x55585c], ['box', [0, 0.004, -0.15, 0.004, 0.03, 0.17], 0xc9cdd0], ['box', [0, -0.006, -0.25, 0.004, 0.018, 0.04, 0.5, 0, 0], 0xc9cdd0]]), VMAT)); g.userData = { muzzle: -0.25, sightY: 0.05, handZ: 0, backZ: 0.06 }; return g; }
// Mãos/antebraços para a visão em primeira pessoa.
export function buildArm(skin, sleeve) { const sp = [['cap', [0, 0, 0.17, 0.036, 0.036, 0.085, 0, 0, 0], sleeve != null ? sleeve : skin], ['sph', [0, 0, -0.01, 0.036, 0.03, 0.05], skin]]; sp[0][1][6] = Math.PI / 2; return new THREE.Mesh(part(sp), VMAT); }
export function buildGrenade(kind) { const c = { frag: 0x3a4a2e, smoke: 0x8a9096, stun: 0xd9dde0, decoy: 0x2a2c30 }[kind] || 0x3a4a2e; return new THREE.Mesh(part(kind === 'frag' ? [['sph', [0, 0, 0, 0.045, 0.055, 0.045], c], ['cyl', [0, 0.06, 0, 0.015, 0.03, 0.015], 0x8a8a8a]] : [['cyl', [0, 0, 0, 0.035, 0.12, 0.035], c], ['cyl', [0, 0.07, 0, 0.018, 0.03, 0.018], 0x55585c], ['cyl', [0, 0, 0, 0.036, 0.02, 0.036], kind === 'stun' ? 0x2a6fd0 : kind === 'smoke' ? 0x3a8a4a : 0xd9a520]]), VMAT); }
