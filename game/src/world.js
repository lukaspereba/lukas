// Montagem do mundo: contexto, quadras residenciais/comerciais, mobiliário urbano, vidros, portas, placas e minimapa.
import * as THREE from 'three';
import { L, makeWorldMaterial, buildTextureArray, textTexture } from './textures.js';
import { Batcher } from './batcher.js';
import { Physics, F } from './physics.js';
import { Terrain, HALF, CT, blockRange, ROAD0, PITCH, RW, NR, NC, CS } from './terrain.js';
import { Kit } from './kit.js';
import { mulberry, pick, rr } from './util.js';
import { buildPOIs, POI_BLOCKS } from './poi.js';

// Moldura local: u ao longo da rua, v para dentro do lote. Permite casas voltadas a N/S/L/O com o mesmo código.
export class Fr {
  constructor(K, face, front, o) { this.K = K; this.sw = face === 'e' || face === 'w'; this.s = face === 'n' || face === 'w' ? 1 : -1; this.f = front; this.o = o; this.face = face; }
  P(u, v) { return this.sw ? [this.f + this.s * v, this.o + u] : [this.o + u, this.f + this.s * v]; }
  R(u0, v0, u1, v1) { const a = this.P(u0, v0), b = this.P(u1, v1); return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])]; }
  solid(u0, y0, v0, u1, y1, v1, l, c, o) { const r = this.R(u0, v0, u1, v1); this.K.solid(r[0], y0, r[1], r[2], y1, r[3], l, c, o); }
  box(u0, y0, v0, u1, y1, v1, l, c, o) { const r = this.R(u0, v0, u1, v1); this.K.bat.box(r[0], y0, r[1], r[2], y1, r[3], l, c, o); }
  // ax 'u': parede ao longo de u em v=c. ax 'v': ao longo de v em u=c.
  wall(ax, c, a0, a1, y0, y1, th, m, ops = [], o) {
    const mm = { ...m };
    if (ax === 'u') { mm.side = (m.side || 1) * this.s; const wa = this.sw ? 'z' : 'x', wc = this.f + this.s * c; this.K.wall(wa, wc, this.o + a0, this.o + a1, y0, y1, th, mm, ops.map((p) => ({ ...p, a: this.o + p.a, b: this.o + p.b })), o); }
    else { const wa = this.sw ? 'x' : 'z', wc = this.o + c; const A = this.f + this.s * a0, B = this.f + this.s * a1; this.K.wall(wa, wc, Math.min(A, B), Math.max(A, B), y0, y1, th, mm, ops.map((p) => { const pa = this.f + this.s * p.a, pb = this.f + this.s * p.b; return { ...p, a: Math.min(pa, pb), b: Math.max(pa, pb) }; }), o); }
  }
  slab(u0, v0, u1, v1, y0, y1, l, c, holes = [], o) { const r = this.R(u0, v0, u1, v1); this.K.slab(r[0], r[1], r[2], r[3], y0, y1, l, c, holes.map((h) => this.R(h[0], h[1], h[2], h[3])), o); }
  stairs(u0, v0, u1, v1, yLo, yHi, ax, up, l, c, o) { const r = this.R(u0, v0, u1, v1); const wa = ax === 'u' ? (this.sw ? 'z' : 'x') : (this.sw ? 'x' : 'z'); this.K.stairs(r[0], r[1], r[2], r[3], yLo, yHi, wa, ax === 'u' ? up : up * this.s, l, c, o); }
  prop(kind, u, y, v, r = 0, c) { const p = this.P(u, v); this.K.prop(kind, p[0], y, p[1], this.sw ? r + 1 : r, c); }
  gable(u0, v0, u1, v1, y, rise, ax, l, c) { const r = this.R(u0, v0, u1, v1); this.K.gable(r[0], r[1], r[2], r[3], y, rise, ax === 'u' ? (this.sw ? 'z' : 'x') : (this.sw ? 'x' : 'z'), l, c); }
  maxH(u0, v0, u1, v1) { const t = this.K.W.terr, r = this.R(u0, v0, u1, v1); return Math.max(t.height(r[0], r[1]), t.height(r[2], r[1]), t.height(r[0], r[3]), t.height(r[2], r[3]), t.height((r[0] + r[2]) / 2, (r[1] + r[3]) / 2)); }
  minH(u0, v0, u1, v1) { const t = this.K.W.terr, r = this.R(u0, v0, u1, v1); return Math.min(t.height(r[0], r[1]), t.height(r[2], r[1]), t.height(r[0], r[3]), t.height(r[2], r[3])); }
  loot(u, y, v, tier = 0) { const p = this.P(u, v); this.K.W.loot.push({ x: p[0], y, z: p[1], tier }); }
  crate(u, y, v, tier = 0) { const p = this.P(u, v); this.K.W.crates.push({ x: p[0], y, z: p[1], tier }); }
  // Placa na fachada (lado da rua), em v = c.
  sign(text, style, u0, u1, y0, y1, c) { const a = this.P(u0, c - 0.02), b = this.P(u1, c - 0.02); const flip = this.sw ? this.s < 0 : this.s > 0; const A = flip ? b : a, B = flip ? a : b; this.K.W.signs.place(text, style, [A[0], y0, A[1]], [B[0], y0, B[1]], [B[0], y1, B[1]], [A[0], y1, A[1]]); }
}

// Atlas de placas: um único material/draw call para todos os letreiros do mapa.
class SignAtlas {
  constructor() { this.cv = document.createElement('canvas'); this.cv.width = 2048; this.cv.height = 2048; this.ctx = this.cv.getContext('2d'); this.cw = 256; this.chh = 128; this.next = 0; this.cache = new Map(); this.p = []; this.u = []; this.n = []; this.grid = new Uint8Array(8 * 16); }
  alloc(cols, rows) { for (let r = 0; r + rows <= 16; r++) for (let c = 0; c + cols <= 8; c++) { let ok = true; for (let j = 0; j < rows && ok; j++) for (let i = 0; i < cols; i++) if (this.grid[(r + j) * 8 + c + i]) { ok = false; break; } if (ok) { for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) this.grid[(r + j) * 8 + c + i] = 1; return [c * this.cw, r * this.chh, cols * this.cw, rows * this.chh]; } } return [0, 0, this.cw, this.chh]; }
  region(text, st = {}) { const key = text + '|' + JSON.stringify(st, (k, v) => (typeof v === 'function' ? 'f' : v)); let r = this.cache.get(key); if (r) return r; r = this.alloc(st.cols || 1, st.rows || 1); const c = this.ctx, [x, y, w, h] = r; c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip(); c.translate(x, y); c.fillStyle = st.bg || '#1d2a3a'; c.fillRect(0, 0, w, h); if (st.draw) st.draw(c, w, h); const lines = String(text).split('\n'); c.textAlign = 'center'; c.textBaseline = 'middle'; lines.forEach((ln, i) => { let size = (st.size || 0.5) * h / Math.max(1, lines.length * 0.8); c.font = `${st.weight || 800} ${size}px ${st.font || 'Arial, Helvetica, sans-serif'}`; const tw = c.measureText(ln).width; if (tw > w * 0.92) { size *= (w * 0.92) / tw; c.font = `${st.weight || 800} ${size}px ${st.font || 'Arial, Helvetica, sans-serif'}`; } c.fillStyle = st.color || '#fff'; c.fillText(ln, w * (st.cx || 0.5), h * (st.cy != null ? st.cy : 0.5) + (i - (lines.length - 1) / 2) * size * 1.1); }); if (st.border) { c.strokeStyle = st.border; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6); } c.restore(); this.cache.set(key, r); return r; }
  place(text, st, a, b, c, d) { const [x, y, w, h] = this.region(text, st); const u0 = (x + 1) / 2048, u1 = (x + w - 1) / 2048, v0 = 1 - (y + h - 1) / 2048, v1 = 1 - (y + 1) / 2048; const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]]; let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0]; const m = Math.hypot(nx, ny, nz) || 1; nx /= m; ny /= m; nz /= m; for (const q of [a, b, c, a, c, d]) { this.p.push(q[0] + nx * 0.03, q[1] + ny * 0.03, q[2] + nz * 0.03); this.n.push(nx, ny, nz); } this.u.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1); }
  mesh() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.p), 3)); g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.n), 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(this.u), 2)); const t = new THREE.CanvasTexture(this.cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; this.tex = t; const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide })); m.frustumCulled = false; m.matrixAutoUpdate = false; return m; }
}

const HOUSE_COLORS = [0xe8dcc0, 0xd9c7a0, 0xc9d6c0, 0xe6b8a0, 0xbcd0de, 0xf0e6d2, 0xd8b890, 0xcfcfc8, 0xe2a67c, 0x9fc0b0, 0xf2d48a, 0xb8a8c8];
const SHOP_NAMES = ['PADARIA PÃO QUENTE', 'BAR DO ZÉ', 'MERCADINHO SILVIÂNIA', 'AÇAÍ DA VILA', 'BARBEARIA CORTE FINO', 'LAN HOUSE CONEXÃO', 'FARMÁCIA DO POVO', 'ADEGA 24H', 'OFICINA DO TIÃO', 'PASTELARIA CARAPI', 'CELULAR & CIA', 'LOTÉRICA DA SORTE', 'AÇOUGUE BOI BOM', 'MATERIAIS PLANALTO', 'SALÃO BELEZA PURA', 'ESPETINHO DO COHAB', 'DEPÓSITO DE GÁS', 'PIZZARIA JANDAIA', 'BICICLETARIA', 'ASSISTÊNCIA TÉCNICA'];
const SHOP_BG = ['#b3261e', '#1f5fa8', '#1d7a46', '#6b2a8f', '#c56a12', '#262b33', '#0f7f86', '#a01846'];

function house(W, K, fr, u0, u1, depth, rng, favela) {
  const two = rng() < (favela ? 0.55 : 0.4), roofKind = favela ? (rng() < 0.75 ? 1 : 2) : (rng() < 0.5 ? 0 : rng() < 0.7 ? 1 : 2);
  const v0 = favela ? rr(rng, 0.6, 2) : rr(rng, 2.5, 4.5), v1 = v0 + depth, wu0 = u0 + 0.6, wu1 = u1 - 1.7; const w = wu1 - wu0;
  const Fy = fr.maxH(wu0, v0, wu1, v1) + 0.14, base = fr.minH(wu0 - 1.5, v0 - 3, wu1 + 1.5, v1) - 0.6, H1 = 2.9;
  const brick = favela ? rng() < 0.8 : rng() < 0.18; const col = brick ? 0xffffff : pick(rng, HOUSE_COLORS);
  const m = { l: brick ? L.BRICK : L.PLASTER, c: col, il: L.PLASTER, ic: 0xf1ede4 }; const th = 0.2;
  fr.solid(wu0 - 0.1, base, v0 - 0.1, wu1 + 0.1, Fy, v1 + 0.1, L.CONCRETE, 0xaaa69c, { top: L.FLOOR_TILE, topColor: [0xe6dccb, 0xc9b79c, 0xd9d9d9][(rng() * 3) | 0] });
  const r = fr.R(wu0, v0, wu1, v1); W.fp.push([r[0], r[1], r[2], r[3], brick ? '#a8674a' : '#c9c0ae']);
  const stories = two ? 2 : 1;
  const doorU = wu0 + rr(rng, 0.8, Math.max(0.9, w - 2.2)), mid = v0 + depth * rr(rng, 0.45, 0.6);
  for (let s = 0; s < stories; s++) {
    const y0 = Fy + s * (H1 + 0.2), y1 = y0 + H1;
    const front = [], back = [], sideA = [], sideB = [];
    if (s === 0) { front.push({ a: doorU, b: doorU + 1.1, lo: 0, hi: 2.15, k: rng() < 0.45 ? 'leaf' : 'door', c: pick(rng, [0x6b4a2e, 0x2f4f6f, 0x7a7a78, 0x3d5a3a]) }); if (favela || rng() < 0.6) back.push({ a: wu1 - 2.2, b: wu1 - 1.2, lo: 0, hi: 2.1, k: 'door' }); }
    // janelas: uma real (abertura para atirar) e as demais falsas
    const wins = (list, a0, a1, real) => { for (let p = a0 + 0.7; p + 1.3 < a1 - 0.5; p += 2.6) { if (list.some((q) => p < q.b + 0.4 && p + 1.3 > q.a - 0.4)) continue; list.push({ a: p, b: p + 1.3, lo: 1.0, hi: 2.1, k: real && rng() < 0.5 ? 'hole' : 'win' }); } };
    wins(front, wu0, wu1, true); wins(back, wu0, wu1, s > 0); wins(sideA, v0, v1, false);
    if (s === 1) sideB.push({ a: v0 + 0.5, b: v0 + 1.5, lo: 0, hi: 2.1, k: 'door' }); else wins(sideB, v0, v1, false);
    fr.wall('u', v0 + th / 2, wu0, wu1, y0, y1, th, { ...m, side: 1 }, front); fr.wall('u', v1 - th / 2, wu0, wu1, y0, y1, th, { ...m, side: -1 }, back);
    fr.wall('v', wu0 + th / 2, v0 + th, v1 - th, y0, y1, th, { ...m, side: 1 }, sideA); fr.wall('v', wu1 - th / 2, v0 + th, v1 - th, y0, y1, th, { ...m, side: -1 }, sideB);
    // divisória interna com vão
    const du = wu0 + rr(rng, 1, w - 2.4); fr.wall('u', mid, wu0 + th, wu1 - th, y0, y1, 0.14, { l: L.PLASTER, c: 0xf1ede4 }, [{ a: du, b: du + 1.1, lo: 0, hi: 2.1, k: 'door' }], { detail: true });
    // laje/forro
    const top = s === stories - 1; const holes = [];
    fr.slab(wu0 - 0.15, v0 - 0.15, wu1 + 0.15, v1 + 0.15, y1, y1 + 0.2, top ? (roofKind === 2 ? L.METAL_ROOF : L.CONCRETE) : L.FLOOR_TILE, top ? 0xb9b6ae : 0xd9cfbd, holes);
    // mobília e loot
    const uA = wu0 + 1.1, uB = wu1 - 1.2;
    if (s === 0) { fr.prop('sofa', uA + 0.3, y0, v0 + 1.2 + (doorU < wu0 + 2.6 ? 0 : 0), 0, pick(rng, [0x5a6b7c, 0x7c4a3a, 0x4a6a4f])); fr.prop('table', uB - 0.4, y0, mid + (v1 - mid) / 2, 1); if (rng() < 0.5) fr.prop('shelf', uA + 0.4, y0, v1 - 0.6, 0); }
    else { fr.prop('bed', uA, y0, v0 + 1.6, 0); if (rng() < 0.6) fr.prop('bed', uB, y0, v1 - 1.5, 0, 0xb8c4a8); }
    fr.loot((wu0 + wu1) / 2 + rr(rng, -1, 1), y0, (v0 + mid) / 2 + 0.6, s); fr.loot((wu0 + wu1) / 2, y0, (mid + v1) / 2, s);
    if (rng() < (s ? 0.5 : 0.22)) fr.crate(wu1 - 1.1, y0, mid + 1.0, s);
  }
  const roofY = Fy + stories * (H1 + 0.2);
  if (roofKind === 0) fr.gable(wu0, v0, wu1, v1, roofY, Math.min(2.2, w * 0.22), 'v');
  else { // laje com mureta e caixa d'água
    const pm = { l: m.l, c: m.c }; fr.wall('u', v0, wu0, wu1, roofY, roofY + 0.7, 0.15, pm); fr.wall('u', v1, wu0, wu1, roofY, roofY + 0.7, 0.15, pm); fr.wall('v', wu0, v0, v1, roofY, roofY + 0.7, 0.15, pm); fr.wall('v', wu1, v0, v1, roofY, roofY + 0.7, 0.15, pm, [{ a: v0 + 0.4, b: v0 + 1.6, lo: 0, hi: 1, k: 'door' }]);
    const p = fr.P(wu0 + 1.4, v1 - 1.4); K.prop('tank', p[0], roofY, p[1]); if (rng() < 0.35) fr.loot((wu0 + wu1) / 2, roofY, (v0 + v1) / 2, 1);
  }
  // escada externa lateral (acesso ao 2º piso / laje)
  if (two || roofKind !== 0) { const topY = two ? Fy + H1 + 0.2 : roofY; const len = Math.min(depth - 1.2, (topY - Fy) * 1.45); const g0 = fr.minH(wu1, v0, wu1 + 1.2, v0 + len + 1.3) - 0.2;
    fr.solid(wu1, g0, v0 + 0.3, wu1 + 1.15, topY, v0 + 1.6, L.CONCRETE, 0xb5b1a8); // patamar
    fr.stairs(wu1 + 0.05, v0 + 1.6, wu1 + 1.15, v0 + 1.6 + len, Math.max(g0, fr.maxH(wu1, v0 + 1.6 + len, wu1 + 1.15, v0 + 1.7 + len) - 0.05), topY, 'v', -1, L.CONCRETE, 0xb5b1a8, { solidBase: true });
    if (two && roofKind !== 0) { /* segundo lance até a laje: escada interna simples */ } }
  // degraus da porta
  { const dy = Fy; let k = 0; for (let stepV = v0 - 0.35; k < 12; k++, stepV -= 0.35) { const p = fr.P(doorU + 0.55, stepV + 0.17), g = W.terr.height(p[0], p[1]); const yT = dy - (k + 1) * 0.2; if (yT <= g + 0.04) break; fr.solid(doorU - 0.3, g - 0.4, stepV, doorU + 1.4, yT, stepV + 0.35, L.CONCRETE, 0xb5b1a8, { detail: true }); } }
  // muro frontal com portão
  if (!favela && rng() < 0.75) { const g0 = fr.minH(u0, 0.3, u1, 0.6), g1 = fr.maxH(u0, 0.3, u1, 0.6); const gate = doorU - 0.4; fr.wall('u', 0.45, u0, u1, g0 - 0.5, g1 + 1.9, 0.16, { l: rng() < 0.3 ? L.BRICK : L.PLASTER, c: pick(rng, HOUSE_COLORS) }, [{ a: gate, b: gate + 2.2, lo: 0.5 + (g1 - g0), hi: 2.4 + (g1 - g0) + 0.5, k: 'door' }]); }
}

function shop(W, K, fr, u0, u1, depth, rng, idx) {
  const v0 = 0.5, v1 = v0 + depth, Fy = fr.maxH(u0, v0, u1, v1) + 0.1, base = fr.minH(u0, v0 - 2, u1, v1) - 0.6, H = 3.6, th = 0.25, w = u1 - u0;
  const col = pick(rng, HOUSE_COLORS), m = { l: L.PLASTER, c: col, il: L.PLASTER, ic: 0xefeae0 }; const open = rng() < 0.72; const name = SHOP_NAMES[idx % SHOP_NAMES.length];
  fr.solid(u0, base, v0, u1, Fy, v1, L.CONCRETE, 0xaaa69c, { top: L.FLOOR_TILE, topColor: 0xdad2c2 }); const r = fr.R(u0, v0, u1, v1); W.fp.push([r[0], r[1], r[2], r[3], '#b9a98c']);
  fr.wall('u', v0 + th / 2, u0, u1, Fy, Fy + H, th, { ...m, side: 1 }, [{ a: u0 + 1, b: u1 - 1, lo: 0, hi: 3, k: open ? 'door' : 'shut' }]);
  fr.wall('u', v1 - th / 2, u0, u1, Fy, Fy + H, th, { ...m, side: -1 }, [{ a: u1 - 2.4, b: u1 - 1.3, lo: 0, hi: 2.1, k: rng() < 0.5 ? 'leaf' : 'door', c: 0x5a5d60 }]);
  fr.wall('v', u0 + th / 2, v0 + th, v1 - th, Fy, Fy + H, th, { ...m, side: 1 }); fr.wall('v', u1 - th / 2, v0 + th, v1 - th, Fy, Fy + H, th, { ...m, side: -1 });
  fr.slab(u0, v0, u1, v1, Fy + H, Fy + H + 0.25, L.FLOOR_TILE, 0xcfc8b8);
  // sobrado (2º piso com janelas falsas) e platibanda
  const y2 = Fy + H + 0.25, two = rng() < 0.7, H2 = two ? 3 : 0.9; const m2 = { l: L.PLASTER, c: col };
  const wn = []; if (two) for (let p = u0 + 0.9; p + 1.3 < u1 - 0.6; p += 2.4) wn.push({ a: p, b: p + 1.3, lo: 0.9, hi: 2.1, k: 'win', one: 1 });
  fr.wall('u', v0 + th / 2, u0, u1, y2, y2 + H2, th, { ...m2, side: 1 }, wn); fr.wall('u', v1 - th / 2, u0, u1, y2, y2 + H2, th, m2); fr.wall('v', u0 + th / 2, v0 + th, v1 - th, y2, y2 + H2, th, m2); fr.wall('v', u1 - th / 2, v0 + th, v1 - th, y2, y2 + H2, th, m2);
  if (two) fr.slab(u0, v0, u1, v1, y2 + H2, y2 + H2 + 0.2, L.CONCRETE, 0xb5b1a8);
  fr.sign(name, { bg: SHOP_BG[(idx % SHOP_NAMES.length) % SHOP_BG.length], size: 0.42, border: 'rgba(255,255,255,.7)' }, u0 + 0.4, u1 - 0.4, Fy + 3.05, Fy + 3.05 + Math.min(1.1, (w - 0.8) / 2 * 0.5 + 0.2), v0);
  // toldo
  fr.box(u0 + 0.3, Fy + 2.95, v0 - 1.4, u1 - 0.3, Fy + 3.05, v0, L.PLAIN, [0xb3261e, 0x1f5fa8, 0x1d7a46, 0xc56a12][idx % 4], { detail: true, bottom: true });
  if (open) { fr.prop('counter', u0 + w / 2, Fy, v0 + depth * 0.55, 0); fr.prop('shelf', u0 + 1.6, Fy, v1 - 0.8, 0); if (w > 7) fr.prop('shelf', u1 - 1.8, Fy, v0 + 2.2, 1); fr.prop('crate', u1 - 1.2, Fy, v1 - 1.2); fr.loot(u0 + w / 2, Fy, v0 + depth * 0.3, 1); fr.loot(u0 + w / 2 - 1, Fy, v1 - 2, 1); if (rng() < 0.6) fr.crate(u0 + 1.3, Fy, v0 + depth * 0.7, 1); }
  // degrau até a calçada
  for (let k = 0, sv = v0 - 0.4; k < 8; k++, sv -= 0.4) { const p = fr.P(u0 + w / 2, sv + 0.2), g = W.terr.height(p[0], p[1]), yT = Fy - (k + 1) * 0.2; if (yT <= g + 0.04) break; fr.solid(u0 + 0.6, g - 0.4, sv, u1 - 0.6, yT, sv + 0.4, L.CONCRETE, 0xb5b1a8, { detail: true }); }
}

function residentialBlock(W, K, bx, bz, rng, kind) {
  const [x0, x1] = blockRange(bx), [z0, z1] = blockRange(bz); const ix0 = x0 + 4, ix1 = x1 - 4, iz0 = z0 + 4, iz1 = z1 - 4; // 56 x 56
  W.terr.paint(ix0, iz0, ix1, iz1, kind === 'favela' ? CT.DIRT : rng() < 0.45 ? CT.CONCRETE : rng() < 0.5 ? CT.GRASS : CT.DIRT);
  const ew = rng() < 0.35; // fileiras voltadas a leste/oeste em algumas quadras
  const rows = ew ? [['w', ix0], ['e', ix1]] : [['n', iz0], ['s', iz1]]; const o0 = ew ? iz0 : ix0;
  let si = (bx * 7 + bz * 3) | 0;
  rows.forEach(([face, front], ri) => {
    const fr = new Fr(K, face, front, o0); let u = 0.5;
    const commercial = kind === 'com' && ri === 0;
    while (u < 55) { let lw = commercial ? rr(rng, 8, 11) : kind === 'favela' ? rr(rng, 7.5, 10) : rr(rng, 10.5, 14); if (u + lw > 55.5) lw = 55.5 - u; if (lw < 7) break;
      if (commercial) shop(W, K, fr, u, u + lw - 0.3, rr(rng, 12, 16), rng, si++);
      else if (rng() < 0.9) house(W, K, fr, u, u + lw, kind === 'favela' ? rr(rng, 8, 10.5) : rr(rng, 9, 12), rng, kind === 'favela');
      else { const p = fr.P(u + lw / 2, 8); K.tree(p[0], p[1], 1.1); fr.loot(u + lw / 2, W.terr.height(...fr.P(u + lw / 2, 5)), 5, 0); }
      u += lw; }
  });
  // árvores e muro no miolo da quadra
  for (let i = 0; i < 3; i++) { const tx = rr(rng, ix0 + 6, ix1 - 6), tz = ew ? rr(rng, iz0 + 6, iz1 - 6) : (iz0 + iz1) / 2 + rr(rng, -3, 3); const xx = ew ? (ix0 + ix1) / 2 + rr(rng, -3, 3) : tx; if (rng() < 0.7) K.tree(xx, tz, rr(rng, 0.8, 1.2)); }
}

function streetFurniture(W, K, rng) {
  const T = W.terr; const end = ROAD0 + PITCH * (NR - 1) + RW;
  for (let k = 0; k < NR; k++) { const c = ROAD0 + PITCH * k; let prevV = null, prevH = null;
    for (let t = ROAD0 + 14; t < end; t += 36) {
      // postes na calçada das ruas verticais (lado oeste) e horizontais (lado norte)
      const px = c - 2.2, pz = t; if (T.isRoad(c + 2, pz) && T.type(px, pz) === CT.SIDEWALK) { const y = K.pole(px, pz, true, 1); if (prevV && Math.abs(prevV[2] - pz) < 40) K.wire(prevV, [px, y - 0.1, pz]); prevV = [px, y - 0.1, pz]; } else prevV = null;
      const qx = t, qz = c - 2.2; if (T.isRoad(qx, c + 2) && T.type(qx, qz) === CT.SIDEWALK) { const y = K.pole(qx, qz, true, 0); if (prevH && Math.abs(prevH[0] - qx) < 40) K.wire(prevH, [qx, y - 0.1, qz]); prevH = [qx, y - 0.1, qz]; } else prevH = null;
    }
  }
  // árvores de calçada, lixeiras e carros estacionados (cobertura)
  for (let i = 0; i < 70; i++) { const k = (rng() * NR) | 0, c = ROAD0 + PITCH * k, t = rr(rng, ROAD0 + 20, end - 20); const v = rng() < 0.5; const x = v ? c + RW + 2 : t, z = v ? t : c + RW + 2; if (T.type(x, z) !== CT.SIDEWALK) continue; if (((t - ROAD0) % PITCH) < 16) continue; K.tree(x, z, rr(rng, 0.7, 1), rng() < 0.15 ? 1 : 0); }
  for (let i = 0; i < 46; i++) { const k = (rng() * NR) | 0, c = ROAD0 + PITCH * k, t = rr(rng, ROAD0 + 20, end - 20); if (((t - ROAD0) % PITCH) < 18) continue; const v = rng() < 0.5; const x = v ? c + 6.6 : t, z = v ? t : c + 6.6; if (!T.isRoad(x, z)) continue; W.parked.push({ x, z, rot: v ? 0 : Math.PI / 2, col: pick(rng, [0xb8bcc0, 0x2b2d33, 0x8a1f1f, 0xe8e8e4, 0x1f3f7a, 0x6b6f72, 0xb07a2a]) }); }
}

function border(W, K, rng) { // mata e morros nas bordas escondem o limite do mapa
  for (let i = 0; i < 150; i++) { const side = (rng() * 4) | 0, t = rr(rng, -310, 310), d = rr(rng, 270, 312); const x = side === 0 ? -d : side === 1 ? d : t, z = side === 2 ? -d : side === 3 ? d : t; if (W.terr.type(x, z) !== CT.GRASS) continue; K.tree(x, z, rr(rng, 1.1, 1.9)); }
  for (const [x0, z0, x1, z1] of [[-HALF, -HALF, HALF, -HALF + 2], [-HALF, HALF - 2, HALF, HALF], [-HALF, -HALF, -HALF + 2, HALF], [HALF - 2, -HALF, HALF, HALF]]) W.phys.box(x0, -50, z0, x1, 400, z1, F.NOSHOT);
}

export function buildWorld(opts = {}) {
  const terr = new Terrain(); const phys = new Physics((x, z) => terr.height(x, z));
  const W = { terr, phys, bat: new Batcher(80, HALF), rng: mulberry(20240611), trees: [], loot: [], crates: [], doors: [], glass: [], signs: new SignAtlas(), fp: [], buy: [], vehicleSpots: [], parked: [], labels: [], contracts: [], lights: [], spawns: [] };
  W.addGlass = (axis, c, a, b, lo, hi) => { const g = { axis, c, a, b, lo, hi, on: true }; g.col = axis === 'x' ? phys.box(a, lo, c - 0.04, b, hi, c + 0.04, F.GLASS, g) : phys.box(c - 0.04, lo, a, c + 0.04, hi, b, F.GLASS, g); g.id = W.glass.length; W.glass.push(g); };
  W.addDoor = (axis, c, a, b, lo, hi, color = 0x6b4a2e) => { const d = { axis, c, a, b, lo, hi, open: false, t: 0, color }; d.col = axis === 'x' ? phys.box(a, lo, c - 0.05, b, hi, c + 0.05, F.DOOR, d) : phys.box(c - 0.05, lo, a, c + 0.05, hi, b, F.DOOR, d); d.id = W.doors.length; d.x = axis === 'x' ? (a + b) / 2 : c; d.z = axis === 'x' ? c : (a + b) / 2; W.doors.push(d); };
  const K = new Kit(W); W.K = K;
  buildPOIs(W, K, Fr);
  const rng = W.rng;
  const favela = new Set(['5,4', '6,4', '5,5', '6,5', '4,6', '5,6', '6,6', '0,0', '0,1']);
  const com = new Set(['2,2', '2,3', '5,2', '5,3', '3,4', '4,4', '2,1', '3,1']);
  for (let bz = 0; bz < 7; bz++) for (let bx = 0; bx < 7; bx++) { const key = bx + ',' + bz; if (POI_BLOCKS.has(key)) continue; residentialBlock(W, K, bx, bz, rng, favela.has(key) ? 'favela' : com.has(key) ? 'com' : 'res'); }
  streetFurniture(W, K, rng); border(W, K, rng);
  for (const c of W.parked) { c.y = terr.height(c.x, c.z); const v = Math.abs(Math.sin(c.rot)) < 0.5; if (v) phys.box(c.x - 0.9, c.y, c.z - 2.1, c.x + 0.9, c.y + 1.4, c.z + 2.1); else phys.box(c.x - 2.1, c.y, c.z - 0.9, c.x + 2.1, c.y + 1.4, c.z + 0.9); }
  phys.finalize();
  // Malhas
  const texArr = buildTextureArray(opts.texSize || 256); const matO = makeWorldMaterial(texArr, false), matC = makeWorldMaterial(texArr, true);
  const meshes = terr.buildMeshes(matO).concat(W.bat.build(matO, matC)); W.worldTris = W.bat.tris + NC * NC * 2;
  const group = new THREE.Group(); meshes.forEach((m) => group.add(m)); group.add(W.signs.mesh());
  // Vidros (instanciados)
  const gm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0x9fd0e0, transparent: true, opacity: 0.32, depthWrite: false }), Math.max(1, W.glass.length)); const M4 = new THREE.Matrix4();
  W.glass.forEach((g, i) => { const w = g.b - g.a, h = g.hi - g.lo, mx = (g.a + g.b) / 2, my = (g.lo + g.hi) / 2; if (g.axis === 'x') M4.makeScale(w, h, 0.05).setPosition(mx, my, g.c); else M4.makeScale(0.05, h, w).setPosition(g.c, my, mx); gm.setMatrixAt(i, M4); }); gm.count = W.glass.length; gm.frustumCulled = false; group.add(gm); W.glassMesh = gm;
  // Portas (instanciadas)
  const dm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, W.doors.length)); const col = new THREE.Color();
  W.setDoor = (d, open) => { d.open = open; phys.b[d.col].on = !open; const w = d.b - d.a, h = d.hi - d.lo, my = (d.lo + d.hi) / 2; if (!open) { if (d.axis === 'x') M4.makeScale(w, h, 0.07).setPosition((d.a + d.b) / 2, my, d.c); else M4.makeScale(0.07, h, w).setPosition(d.c, my, (d.a + d.b) / 2); } else { if (d.axis === 'x') M4.makeScale(0.07, h, w).setPosition(d.a + 0.04, my, d.c + w / 2); else M4.makeScale(w, h, 0.07).setPosition(d.c + w / 2, my, d.a + 0.04); } dm.setMatrixAt(d.id, M4); dm.instanceMatrix.needsUpdate = true; };
  W.doors.forEach((d) => { W.setDoor(d, false); dm.setColorAt(d.id, col.setHex(d.color)); }); dm.count = W.doors.length; dm.frustumCulled = false; group.add(dm); W.doorMesh = dm;
  W.breakGlass = (g) => { if (!g.on) return false; g.on = false; phys.b[g.col].on = false; M4.makeScale(0, 0, 0); gm.setMatrixAt(g.id, M4); gm.instanceMatrix.needsUpdate = true; return true; };
  W.resetDynamic = () => { W.glass.forEach((g) => { if (!g.on) { g.on = true; phys.b[g.col].on = true; const w = g.b - g.a, h = g.hi - g.lo, mx = (g.a + g.b) / 2, my = (g.lo + g.hi) / 2; if (g.axis === 'x') M4.makeScale(w, h, 0.05).setPosition(mx, my, g.c); else M4.makeScale(0.05, h, w).setPosition(g.c, my, mx); gm.setMatrixAt(g.id, M4); } }); gm.instanceMatrix.needsUpdate = true; W.doors.forEach((d) => W.setDoor(d, false)); };
  W.group = group; W.meshes = meshes; W.matO = matO; W.matC = matC;
  W.minimap = drawMinimap(W);
  return W;
}

function drawMinimap(W) {
  const S = 640, cv = document.createElement('canvas'); cv.width = cv.height = S; const c = cv.getContext('2d'); const T = W.terr;
  const cols = ['#5d7f48', '#4b4d52', '#9c9a93', '#a87a56', '#3f8a48', '#3f8fd0', '#b5b3aa', '#e8d84a', '#55585e', '#c9c2b2'];
  for (let j = 0; j < NC; j++) for (let i = 0; i < NC; i++) { c.fillStyle = cols[T.T[j * NC + i]]; c.fillRect(i * CS, j * CS, CS, CS); }
  // sombreamento do relevo
  const img = c.getImageData(0, 0, S, S), d = img.data; for (let y = 0; y < S; y += 2) for (let x = 0; x < S; x += 2) { const hx = T.height(x - HALF + 3, y - HALF) - T.height(x - HALF - 3, y - HALF), hz = T.height(x - HALF, y - HALF + 3) - T.height(x - HALF, y - HALF - 3); const s = 1 + (hx + hz) * 0.12; for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const k = ((y + dy) * S + x + dx) * 4; d[k] *= s; d[k + 1] *= s; d[k + 2] *= s; } } c.putImageData(img, 0, 0);
  for (const f of W.fp) { c.fillStyle = f[4] || '#c9c0ae'; c.fillRect(f[0] + HALF, f[1] + HALF, f[2] - f[0], f[3] - f[1]); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 0.6; c.strokeRect(f[0] + HALF, f[1] + HALF, f[2] - f[0], f[3] - f[1]); }
  c.fillStyle = '#2f5f2c'; for (const t of W.trees) { c.beginPath(); c.arc(t[0] + HALF, t[1] + HALF, 1.6, 0, 6.3); c.fill(); }
  return cv;
}
