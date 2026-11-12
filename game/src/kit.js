// Kit de construção: paredes com aberturas, lajes, escadas, telhados, mobília, vegetação e postes.
import * as THREE from 'three';
import { L } from './textures.js';
import { F } from './physics.js';

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), S = new THREE.Vector3(), E = new THREE.Euler();
const G = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl6: new THREE.CylinderGeometry(1, 1, 1, 6), cyl8: new THREE.CylinderGeometry(1, 1, 1, 8), cyl12: new THREE.CylinderGeometry(1, 1, 1, 12, 1),
  cone: new THREE.ConeGeometry(1, 1, 8), ico: new THREE.IcosahedronGeometry(1, 0), ico1: new THREE.IcosahedronGeometry(1, 1), pyr: new THREE.ConeGeometry(1, 1, 4),
  frond: new THREE.PlaneGeometry(1, 1, 1, 3),
};
export function mat4(x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) { E.set(rx, ry, rz, 'YXZ'); Q.setFromEuler(E); return M.compose(V.set(x, y, z), Q, S.set(sx, sy, sz)); }

export class Kit {
  constructor(W) { this.W = W; this.bat = W.bat; this.ph = W.phys; }
  // Caixa visual + colisor.
  solid(x0, y0, z0, x1, y1, z1, layer, color, o = {}) { this.bat.box(x0, y0, z0, x1, y1, z1, layer, color, o); if (!o.noCol) this.ph.box(x0, y0, z0, x1, y1, z1, o.flags || 0); }
  // Geometria orientada (cilindro, caixa girada...). g: chave de G.
  shape(g, x, y, z, sx, sy, sz, layer, color, detail = true, rx = 0, ry = 0, rz = 0, uvs = 1) { this.bat.geo(G[g], mat4(x, y, z, sx, sy, sz, rx, ry, rz), layer, color, detail, uvs); }
  // Viga/cabo entre dois pontos.
  beam(a, b, th, layer, color, detail = true) { const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz); const ry = Math.atan2(dx, dz), rx = -Math.asin(dy / len); this.bat.geo(G.box, mat4((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, th, th, len, rx, ry, 0), layer, color, detail, len / 2); }
  /* Parede ao longo de um eixo. axis 'x': corre em x no plano z=c. axis 'z': corre em z no plano x=c.
     m: {l,c, il,ic, side} — layer/cor externos e internos; side = +1/-1 indica para que lado fica o interior.
     ops: [{a,b,lo,hi,k}] k: 'door' vão livre | 'leaf' vão com porta interativa | 'win' janela falsa | 'hole' abertura real | 'glass' vidro quebrável | 'shut' porta de enrolar fechada | 'bars' abertura com grade */
  wall(axis, c, a0, a1, y0, y1, th, m, ops = [], o = {}) {
    if (a1 < a0) [a0, a1] = [a1, a0];
    ops = ops.filter((p) => p.b > a0 && p.a < a1).sort((p, q) => p.a - q.a);
    const h = th / 2; const seg = (s0, s1, b0, b1) => {
      if (s1 - s0 < 0.01 || b1 - b0 < 0.01) return;
      const bx = axis === 'x' ? [s0, b0, c - h, s1, b1, c + h] : [c - h, b0, s0, c + h, b1, s1];
      if (m.il != null) { // face interna com outro acabamento
        const pos = (m.side || 1) > 0; const skip = axis === 'x' ? (pos ? 16 : 32) : (pos ? 1 : 2);
        this.bat.box(bx[0], bx[1], bx[2], bx[3], bx[4], bx[5], m.l, m.c, { skip, detail: o.detail });
        const f = pos ? c + h : c - h, t = 3;
        if (axis === 'x') { const A = pos ? [s0, b0, f] : [s1, b0, f], B = pos ? [s1, b0, f] : [s0, b0, f], C = pos ? [s1, b1, f] : [s0, b1, f], D = pos ? [s0, b1, f] : [s1, b1, f]; this.bat.quad(A, B, C, D, 0, 0, pos ? 1 : -1, [A[0] / t, b0 / t, B[0] / t, b0 / t, B[0] / t, b1 / t, A[0] / t, b1 / t], m.il, m.ic, o.detail); }
        else { const A = pos ? [f, b0, s1] : [f, b0, s0], B = pos ? [f, b0, s0] : [f, b0, s1], C = pos ? [f, b1, s0] : [f, b1, s1], D = pos ? [f, b1, s1] : [f, b1, s0]; this.bat.quad(A, B, C, D, pos ? 1 : -1, 0, 0, [A[2] / t, b0 / t, B[2] / t, b0 / t, B[2] / t, b1 / t, A[2] / t, b1 / t], m.il, m.ic, o.detail); }
      } else this.bat.box(bx[0], bx[1], bx[2], bx[3], bx[4], bx[5], m.l, m.c, { detail: o.detail, skip: o.skip });
      if (!o.noCol) this.ph.box(bx[0], bx[1], bx[2], bx[3], bx[4], bx[5], o.flags || 0);
    };
    let cur = a0;
    for (const p of ops) {
      const pa = Math.max(p.a, a0), pb = Math.min(p.b, a1); const lo = y0 + (p.lo || 0), hi = Math.min(y1, y0 + (p.hi || 2.2));
      seg(cur, pa, y0, y1);
      if (p.k === 'win' || p.k === 'shut') { seg(pa, pb, y0, y1); this.facePanel(axis, c, h + 0.03, pa, pb, lo, hi, p.k === 'win' ? L.WINDOW : L.SHUTTER, p.c || 0xffffff, p.k === 'win' ? Math.max(1, Math.round((pb - pa) / 1.4)) : (pb - pa) / 3, p.k === 'win' ? 1 : (hi - lo) / 3, p.one ? (m.side || 1) * -1 : 0); }
      else { seg(pa, pb, y0, lo); seg(pa, pb, hi, y1);
        if (p.k === 'glass') this.W.addGlass(axis, c, pa, pb, lo, hi);
        else if (p.k === 'leaf') this.W.addDoor(axis, c, pa, pb, lo, hi, p.c);
        else if (p.k === 'bars') { const n = Math.round((pb - pa) / 0.18); for (let i = 1; i < n; i++) { const t = pa + ((pb - pa) * i) / n; if (axis === 'x') this.bat.box(t - 0.015, lo, c - 0.015, t + 0.015, hi, c + 0.015, L.PLAIN, 0x2a2d30, { detail: true }); else this.bat.box(c - 0.015, lo, t - 0.015, c + 0.015, hi, t + 0.015, L.PLAIN, 0x2a2d30, { detail: true }); } this.ph.box(axis === 'x' ? pa : c - 0.03, lo, axis === 'x' ? c - 0.03 : pa, axis === 'x' ? pb : c + 0.03, hi, axis === 'x' ? c + 0.03 : pb, F.NOSHOT); }
      }
      cur = pb;
    }
    seg(cur, a1, y0, y1);
  }
  // Painel texturizado (UV 0..1 repetido ur x vr) colado nas duas faces (ou em uma) de uma parede.
  facePanel(axis, c, off, a, b, lo, hi, layer, color, ur = 1, vr = 1, only = 0) {
    for (const s of [1, -1]) { if (only && s !== only) continue; const f = c + s * off;
      if (axis === 'x') { const A = s > 0 ? [a, lo, f] : [b, lo, f], B = s > 0 ? [b, lo, f] : [a, lo, f]; this.bat.quad(A, B, [B[0], hi, f], [A[0], hi, f], 0, 0, s, [0, 0, ur, 0, ur, vr, 0, vr], layer, color, true); }
      else { const A = s > 0 ? [f, lo, b] : [f, lo, a], B = s > 0 ? [f, lo, a] : [f, lo, b]; this.bat.quad(A, B, [f, hi, B[2]], [f, hi, A[2]], s, 0, 0, [0, 0, ur, 0, ur, vr, 0, vr], layer, color, true); } }
  }
  // Laje/piso com aberturas retangulares (holes: [[x0,z0,x1,z1]]). Fatiamento simples em faixas.
  slab(x0, z0, x1, z1, y0, y1, layer, color, holes = [], o = {}) {
    const zs = [z0, z1]; for (const hh of holes) { zs.push(hh[1], hh[3]); } const zz = [...new Set(zs)].filter((v) => v >= z0 && v <= z1).sort((a, b) => a - b);
    for (let i = 0; i < zz.length - 1; i++) { const za = zz[i], zb = zz[i + 1], zm = (za + zb) / 2; const cuts = holes.filter((hh) => zm > hh[1] && zm < hh[3]).sort((a, b) => a[0] - b[0]); let cx = x0; for (const hh of cuts) { if (hh[0] > cx) this._slabPiece(cx, za, hh[0], zb, y0, y1, layer, color, o); cx = Math.max(cx, hh[2]); } if (cx < x1) this._slabPiece(cx, za, x1, zb, y0, y1, layer, color, o); }
  }
  _slabPiece(x0, z0, x1, z1, y0, y1, layer, color, o) { this.bat.box(x0, y0, z0, x1, y1, z1, o.side != null ? o.side : L.CONCRETE, o.sideColor || 0xbdbdb8, { top: layer, topColor: color, bottom: true, bottomColor: o.ceil || 0xd9d9d4, detail: o.detail }); this.ph.box(x0, y0, z0, x1, y1, z1); }
  // Escada: degraus visuais + rampa de colisão. Sobe no sentido +eixo se up>0.
  stairs(x0, z0, x1, z1, yLo, yHi, axis, up = 1, layer = L.CONCRETE, color = 0xb8b8b4, o = {}) {
    const len = axis === 'x' ? x1 - x0 : z1 - z0, n = Math.max(2, Math.round((yHi - yLo) / 0.2)), run = len / n, rise = (yHi - yLo) / n;
    for (let i = 0; i < n; i++) { const k = up > 0 ? i : n - 1 - i; const a = k * run, yT = yLo + (i + 1) * rise, yB = o.solidBase ? yLo : yT - rise - 0.12;
      if (axis === 'x') this.bat.box(x0 + a, yB, z0, x0 + a + run, yT, z1, layer, color, { detail: !o.structural }); else this.bat.box(x0, yB, z0 + a, x1, yT, z0 + a + run, layer, color, { detail: !o.structural }); }
    this.ph.ramp(x0, z0, x1, z1, up > 0 ? yLo : yHi, up > 0 ? yHi : yLo, axis);
    if (o.rail) { if (axis === 'x') { const xa = up > 0 ? x0 : x1, xb = up > 0 ? x1 : x0; for (const zz of [z0, z1]) this.beam([xa, yLo + 0.95, zz], [xb, yHi + 0.95, zz], 0.05, L.PLAIN, 0x8f979c); } else { const za = up > 0 ? z0 : z1, zb = up > 0 ? z1 : z0; for (const xx of [x0, x1]) this.beam([xx, yLo + 0.95, za], [xx, yHi + 0.95, zb], 0.05, L.PLAIN, 0x8f979c); } }
  }
  // Telhado de duas águas (cumeeira ao longo de 'axis').
  gable(x0, z0, x1, z1, y, rise, axis, layer = L.ROOF_TILE, color = 0xffffff, over = 0.4) {
    x0 -= over; x1 += over; z0 -= over; z1 += over; const b = this.bat; const t = 2;
    if (axis === 'x') { const zm = (z0 + z1) / 2, sl = Math.hypot(zm - z0, rise), ny = (zm - z0) / sl, nz = rise / sl;
      b.quad([x0, y, z1], [x1, y, z1], [x1, y + rise, zm], [x0, y + rise, zm], 0, ny, nz, [x0 / t, 0, x1 / t, 0, x1 / t, sl / t, x0 / t, sl / t], layer, color);
      b.quad([x1, y, z0], [x0, y, z0], [x0, y + rise, zm], [x1, y + rise, zm], 0, ny, -nz, [x1 / t, 0, x0 / t, 0, x0 / t, sl / t, x1 / t, sl / t], layer, color);
      b.quad([x1 - over, y, z1 - over], [x1 - over, y, z0 + over], [x1 - over, y + rise, zm], [x1 - over, y + rise, zm], 1, 0, 0, [0, 0, 1, 0, 0.5, 0.5, 0.5, 0.5], L.PLASTER, 0xdcd8cf);
      b.quad([x0 + over, y, z0 + over], [x0 + over, y, z1 - over], [x0 + over, y + rise, zm], [x0 + over, y + rise, zm], -1, 0, 0, [0, 0, 1, 0, 0.5, 0.5, 0.5, 0.5], L.PLASTER, 0xdcd8cf);
      const n = 4; for (let i = 0; i < n; i++) { const f0 = i / n, f1 = (i + 1) / n; this.ph.box(x0, y + rise * f0 - 0.15, z0 + (zm - z0) * f0, x1, y + rise * f1, z1 - (zm - z0) * f0, F.NOSTAND * 0); } }
    else { const xm = (x0 + x1) / 2, sl = Math.hypot(xm - x0, rise), ny = (xm - x0) / sl, nx = rise / sl;
      b.quad([x1, y, z1], [x1, y, z0], [xm, y + rise, z0], [xm, y + rise, z1], nx, ny, 0, [z1 / t, 0, z0 / t, 0, z0 / t, sl / t, z1 / t, sl / t], layer, color);
      b.quad([x0, y, z0], [x0, y, z1], [xm, y + rise, z1], [xm, y + rise, z0], -nx, ny, 0, [z0 / t, 0, z1 / t, 0, z1 / t, sl / t, z0 / t, sl / t], layer, color);
      b.quad([x0 + over, y, z1 - over], [x1 - over, y, z1 - over], [xm, y + rise, z1 - over], [xm, y + rise, z1 - over], 0, 0, 1, [0, 0, 1, 0, 0.5, 0.5, 0.5, 0.5], L.PLASTER, 0xdcd8cf);
      b.quad([x1 - over, y, z0 + over], [x0 + over, y, z0 + over], [xm, y + rise, z0 + over], [xm, y + rise, z0 + over], 0, 0, -1, [0, 0, 1, 0, 0.5, 0.5, 0.5, 0.5], L.PLASTER, 0xdcd8cf);
      const n = 4; for (let i = 0; i < n; i++) { const f0 = i / n, f1 = (i + 1) / n; this.ph.box(x0 + (xm - x0) * f0, y + rise * f0 - 0.15, z0, x1 - (xm - x0) * f0, y + rise * f1, z1); } }
  }
  // Cobertura em arco (galpão/quadra). Arco no plano perpendicular a 'axis'. Faces dupla (dentro e fora).
  arcRoof(x0, z0, x1, z1, ySpring, rise, axis, layer = L.METAL_ROOF, color = 0xffffff, trussColor = 0x4a4f55, trussEvery = 5) {
    const n = 12, b = this.bat; const span = axis === 'x' ? z1 - z0 : x1 - x0, len0 = axis === 'x' ? x0 : z0, len1 = axis === 'x' ? x1 : z1; const t = 2;
    const pt = (i) => { const a = Math.PI * (i / n); return [-Math.cos(a) * span / 2, Math.sin(a) * rise]; };
    let acc = 0;
    for (let i = 0; i < n; i++) { const [u0, h0] = pt(i), [u1, h1] = pt(i + 1); const sl = Math.hypot(u1 - u0, h1 - h0); const nu = -(h1 - h0) / sl, nh = (u1 - u0) / sl; const mid = axis === 'x' ? (z0 + z1) / 2 : (x0 + x1) / 2;
      const P = (l, u, hh) => axis === 'x' ? [l, ySpring + hh, mid - u] : [mid + u, ySpring + hh, l];
      const A = P(len0, u0, h0), B = P(len1, u0, h0), C = P(len1, u1, h1), D = P(len0, u1, h1);
      const N = axis === 'x' ? [0, nh, -nu] : [nu, nh, 0]; const uv = [len0 / t, acc / t, len1 / t, acc / t, len1 / t, (acc + sl) / t, len0 / t, (acc + sl) / t];
      b.quad(A, B, C, D, N[0], N[1], N[2], uv, layer, color); b.quad(B, A, D, C, -N[0], -N[1], -N[2], [uv[2], uv[3], uv[0], uv[1], uv[6], uv[7], uv[4], uv[5]], layer, 0x8a8f94);
      acc += sl;
      const ua = Math.min(u0, u1), ub = Math.max(u0, u1), ha = Math.min(h0, h1), hb = Math.max(h0, h1);
      if (axis === 'x') this.ph.box(x0, ySpring + ha - 0.1, mid - ub, x1, ySpring + hb + 0.05, mid - ua); else this.ph.box(mid + ua, ySpring + ha - 0.1, z0, mid + ub, ySpring + hb + 0.05, z1);
      for (let l = len0; l <= len1 + 0.01; l += trussEvery) { this.beam(P(l, u0 * 0.97, h0 - 0.25), P(l, u1 * 0.97, h1 - 0.25), 0.12, L.PLAIN, trussColor, false); this.beam(P(l, u0 * 0.9, h0 - 0.9), P(l, u1 * 0.9, h1 - 0.9), 0.08, L.PLAIN, trussColor, true); this.beam(P(l, u0 * 0.97, h0 - 0.25), P(l, u1 * 0.9, h1 - 0.9), 0.05, L.PLAIN, trussColor, true); }
    }
    for (let l = len0; l <= len1 + 0.01; l += trussEvery) this.beam(axis === 'x' ? [l, ySpring + 0.2, z0 + 0.2] : [x0 + 0.2, ySpring + 0.2, l], axis === 'x' ? [l, ySpring + 0.2, z1 - 0.2] : [x1 - 0.2, ySpring + 0.2, l], 0.06, L.PLAIN, trussColor, true);
  }
  // Mobília e adereços (todos em 'detalhe'; os altos viram cobertura).
  prop(kind, x, y, z, r = 0, c) {
    const b = this.bat, D = { detail: true }; const rot = (w, d) => (r % 2 ? [d, w] : [w, d]);
    const bx = (w, hh, d, layer, color, y0 = 0, col = true, ox = 0, oz = 0) => { const [ww, dd] = rot(w, d); const [px, pz] = r % 2 ? [oz, ox] : [ox, oz]; b.box(x + px - ww / 2, y + y0, z + pz - dd / 2, x + px + ww / 2, y + y0 + hh, z + pz + dd / 2, layer, color, D); if (col) this.ph.box(x + px - ww / 2, y + y0, z + pz - dd / 2, x + px + ww / 2, y + y0 + hh, z + pz + dd / 2); };
    switch (kind) {
      case 'counter': bx(3, 1.05, 0.7, L.WOOD, c || 0x9a7b5a); bx(3.1, 0.06, 0.8, L.PLAIN, 0x2e2e30, 1.05, false); break;
      case 'shelf': bx(2.4, 1.9, 0.5, L.PLAIN, c || 0x8d949a); for (let i = 0; i < 3; i++) bx(2.2, 0.28, 0.42, L.PLAIN, [0xc0503a, 0x3a78c0, 0xd6b23c][i], 0.35 + i * 0.5, false); break;
      case 'table': bx(1.6, 0.06, 0.9, L.WOOD, c || 0xb08a60, 0.74, false); bx(1.4, 0.74, 0.7, L.PLAIN, 0x3a3a3c, 0, true); break;
      case 'foodtable': bx(1.2, 0.05, 1.2, L.PLAIN, 0xe8e2d6, 0.75, false); bx(0.15, 0.75, 0.15, L.PLAIN, 0x555555, 0, false); bx(0.45, 0.45, 0.45, L.PLAIN, c || 0xd9502e, 0, false, 0.95, 0); bx(0.45, 0.45, 0.45, L.PLAIN, c || 0xd9502e, 0, false, -0.95, 0); this.ph.box(x - 0.6, y, z - 0.6, x + 0.6, y + 0.8, z + 0.6); break;
      case 'sofa': bx(2, 0.45, 0.9, L.PLAIN, c || 0x5a6b7c); bx(2, 0.45, 0.25, L.PLAIN, c || 0x4e5d6c, 0.45, false, 0, -0.33); break;
      case 'bed': bx(1.4, 0.5, 2, L.PLAIN, c || 0xcfd6dc); bx(1.4, 0.35, 0.1, L.WOOD, 0x8a6a4a, 0.5, false, 0, -0.95); break;
      case 'crate': bx(1.1, 1.1, 1.1, L.WOOD, c || 0xb89b6a); break;
      case 'crate2': bx(1.3, 1.9, 1.3, L.WOOD, c || 0xa58858); break;
      case 'locker': bx(2.4, 1.9, 0.5, L.PLAIN, c || 0x3d6fa8); for (let i = 0; i < 4; i++) bx(0.02, 1.8, 0.52, L.PLAIN, 0x24466e, 0.05, false, -1.2 + i * 0.6 + 0.6, 0); break;
      case 'bench': bx(1.8, 0.45, 0.45, L.WOOD, c || 0x9a7b5a); break;
      case 'pew': bx(3, 0.45, 0.5, L.WOOD, 0x7a5a3c); bx(3, 0.5, 0.08, L.WOOD, 0x6e5034, 0.45, false, 0, 0.21); break;
      case 'barrel': this.shape('cyl8', x, y + 0.55, z, 0.38, 1.1, 0.38, L.PLAIN, c || 0x2f6f9f); this.ph.box(x - 0.36, y, z - 0.36, x + 0.36, y + 1.1, z + 0.36); break;
      case 'kiosk': bx(2.6, 1.1, 2.6, L.PLAIN, c || 0xe9e4d8); bx(2.8, 0.1, 2.8, L.PLAIN, 0x2c2c2e, 1.1, false); bx(0.12, 1.4, 0.12, L.PLAIN, 0x777777, 1.2, false, -1.2, -1.2); bx(0.12, 1.4, 0.12, L.PLAIN, 0x777777, 1.2, false, 1.2, 1.2); bx(2.8, 0.25, 2.8, L.PLAIN, c ? 0xffffff : 0xd9502e, 2.6, false); break;
      case 'planter': bx(1.2, 0.6, 1.2, L.CONCRETE, 0xc9c5bb); this.shape('ico', x, y + 1.05, z, 0.7, 0.6, 0.7, L.GRASS, 0xc4ec9c); break;
      case 'rack': bx(1.8, 0.05, 0.05, L.PLAIN, 0x999999, 1.5, false); bx(1.7, 0.9, 0.35, L.PLAIN, c || 0x9c3a4a, 0.55, false); this.ph.box(x - (r % 2 ? 0.2 : 0.9), y, z - (r % 2 ? 0.9 : 0.2), x + (r % 2 ? 0.2 : 0.9), y + 1.5, z + (r % 2 ? 0.9 : 0.2)); break;
      case 'toilet': bx(0.45, 0.42, 0.6, L.PLAIN, 0xf4f4f0); bx(0.45, 0.4, 0.18, L.PLAIN, 0xf4f4f0, 0.42, false, 0, -0.22); break;
      case 'sink': bx(1.6, 0.12, 0.5, L.PLAIN, 0xf0f0ec, 0.8, false); bx(1.5, 0.8, 0.4, L.PLAIN, 0x8d949a); break;
      case 'desk': bx(1.6, 0.75, 0.8, L.WOOD, 0x8a6a48); bx(0.5, 0.35, 0.06, L.PLAIN, 0x15171a, 0.78, false, 0, -0.2); bx(0.5, 0.5, 0.5, L.PLAIN, 0x2a2d33, 0, false, 0, 0.9); break;
      case 'container': bx(6, 2.6, 2.4, L.SHUTTER, c || 0x2f6b8f); break;
      case 'tank': this.shape('cyl8', x, y + 0.55, z, 0.75, 1.1, 0.75, L.PLAIN, 0x2f7fc8, true); this.shape('cyl8', x, y + 1.14, z, 0.8, 0.08, 0.8, L.PLAIN, 0x2567a6, true); break;
    }
  }
  tree(x, z, s = 1, kind = 0) { const y = this.W.terr.height(x, z); const W = this.W;
    if (kind === 1) { // palmeira
      const hgt = 6.5 * s; this.shape('cyl6', x, y + hgt / 2, z, 0.2, hgt, 0.2, L.BARK, 0xc2b8a8, false);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + s; this.bat.geo(G.frond, mat4(x + Math.sin(a) * 1.3 * s, y + hgt - 0.25, z + Math.cos(a) * 1.3 * s, 1.1 * s, 3.2 * s, 1, -Math.PI / 2 + 0.45, a, 0), L.FOLIAGE, 0xb9d98a, true, 1); }
      this.ph.box(x - 0.2, y, z - 0.2, x + 0.2, y + hgt, z + 0.2);
    } else { const hgt = (3.2 + (x * 7 + z * 3) % 2) * s; this.shape('cyl6', x, y + hgt / 2, z, 0.22 * s, hgt, 0.22 * s, L.BARK, 0xffffff, false);
      const cols = [0xc4ec9c, 0xd2f2a8, 0xb2dc8c]; this.shape('ico1', x, y + hgt + 1.2 * s, z, 2.4 * s, 1.9 * s, 2.4 * s, L.GRASS, cols[(Math.abs(x | 0) + Math.abs(z | 0)) % 3], false, 0, x, 0, 3);
      this.shape('ico', x + 1.1 * s, y + hgt + 0.5 * s, z + 0.6 * s, 1.5 * s, 1.2 * s, 1.5 * s, L.GRASS, 0xa8d488, true, 0, z, 0, 2); this.shape('ico', x - 1.0 * s, y + hgt + 0.7 * s, z - 0.7 * s, 1.4 * s, 1.1 * s, 1.4 * s, L.GRASS, 0xcaf0a4, true, 0, z + 1, 0, 2);
      this.ph.box(x - 0.22, y, z - 0.22, x + 0.22, y + hgt, z + 0.22); }
    W.trees.push([x, z]);
  }
  pole(x, z, lamp = true, dir = 0) { const y = this.W.terr.height(x, z); this.shape('cyl6', x, y + 4.5, z, 0.14, 9, 0.14, L.CONCRETE, 0xb5b2aa, false); this.bat.box(x - (dir ? 0.06 : 1.1), y + 8.3, z - (dir ? 1.1 : 0.06), x + (dir ? 0.06 : 1.1), y + 8.42, z + (dir ? 1.1 : 0.06), L.WOOD, 0x6a5540, { detail: true });
    if (lamp) { const lx = dir ? 1.4 : 0, lz = dir ? 0 : 1.4; this.beam([x, y + 7.2, z], [x + lx, y + 7.6, z + lz], 0.07, L.PLAIN, 0x8f979c); this.bat.box(x + lx - 0.22, y + 7.5, z + lz - 0.22, x + lx + 0.22, y + 7.62, z + lz + 0.22, L.PLAIN, 0xf5f0d0, { detail: true, bottom: true, bottomColor: 0xfff6c8 }); }
    this.ph.box(x - 0.14, y, z - 0.14, x + 0.14, y + 9, z + 0.14); return y + 8.42; }
  wire(a, b) { for (const o of [-0.9, 0, 0.9]) { const ox = Math.abs(b[0] - a[0]) > Math.abs(b[2] - a[2]) ? 0 : o, oz = ox === 0 && o !== 0 ? 0 : 0; const A = [a[0] + (ox || 0), a[1], a[2] + (ox === 0 ? o : 0)], B = [b[0] + (ox || 0), b[1], b[2] + (ox === 0 ? o : 0)]; const mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 0.45, (A[2] + B[2]) / 2]; this.beam(A, mid, 0.025, L.PLAIN, 0x1a1a1a); this.beam(mid, B, 0.025, L.PLAIN, 0x1a1a1a); } }
  // Cerca de alambrado sobre o chão ou sobre um muro.
  fence(axis, c, a0, a1, y0, y1, posts = true) { const b = this.bat; const t = 2; if (axis === 'x') { b.quad([a0, y0, c], [a1, y0, c], [a1, y1, c], [a0, y1, c], 0, 0, 1, [a0 / t, y0 / t, a1 / t, y0 / t, a1 / t, y1 / t, a0 / t, y1 / t], L.FENCE, 0xffffff, true); this.ph.box(a0, y0, c - 0.04, a1, y1, c + 0.04, F.NOSHOT); if (posts) for (let p = a0; p <= a1 + 0.01; p += 3) b.box(p - 0.04, y0, c - 0.04, p + 0.04, y1 + 0.05, c + 0.04, L.PLAIN, 0x8f979c, { detail: true }); b.box(a0, y1, c - 0.03, a1, y1 + 0.05, c + 0.03, L.PLAIN, 0x8f979c, { detail: true }); }
    else { b.quad([c, y0, a1], [c, y0, a0], [c, y1, a0], [c, y1, a1], 1, 0, 0, [a1 / t, y0 / t, a0 / t, y0 / t, a0 / t, y1 / t, a1 / t, y1 / t], L.FENCE, 0xffffff, true); this.ph.box(c - 0.04, y0, a0, c + 0.04, y1, a1, F.NOSHOT); if (posts) for (let p = a0; p <= a1 + 0.01; p += 3) b.box(c - 0.04, y0, p - 0.04, c + 0.04, y1 + 0.05, p + 0.04, L.PLAIN, 0x8f979c, { detail: true }); b.box(c - 0.03, y1, a0, c + 0.03, y1 + 0.05, a1, L.PLAIN, 0x8f979c, { detail: true }); } }
}
