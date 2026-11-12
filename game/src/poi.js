// Pontos de interesse reconstruídos a partir das fotos de referência.
// Foto 1: Quadra fechada do Jandaia | Fotos 2-4: Plaza Shopping | Fotos 5-8: EE Basílio Bosniac + Igreja São Lucas | Fotos 9-11: Parque do Planalto
import { L } from './textures.js';
import { F } from './physics.js';
import { CT } from './terrain.js';
import { Batcher } from './batcher.js';

export const POI_BLOCKS = new Set(['3,3', '3,2', '4,2', '4,3', '4,0', '5,0', '4,1', '5,1', '6,0', '6,1', '1,0', '0,4', '1,4', '0,5', '1,5']);
const WHITE = 0xf2f2ee, CLAD = 0xffffff;

function buyStation(W, K, x, z) { const y = W.terr.height(x, z); K.solid(x - 0.6, y, z - 0.45, x + 0.6, y + 2.0, z + 0.45, L.PLAIN, 0x1c2a22); K.bat.box(x - 0.7, y + 2.0, z - 0.55, x + 0.7, y + 2.12, z + 0.55, L.PLAIN, 0x39d98a, { detail: true });
  W.signs.place('LOJA\n$', { bg: '#0d3b26', color: '#5dffa8', size: 0.7 }, [x - 0.5, y + 0.9, z + 0.47], [x + 0.5, y + 0.9, z + 0.47], [x + 0.5, y + 1.8, z + 0.47], [x - 0.5, y + 1.8, z + 0.47]); W.signs.place('LOJA\n$', { bg: '#0d3b26', color: '#5dffa8', size: 0.7 }, [x + 0.5, y + 0.9, z - 0.47], [x - 0.5, y + 0.9, z - 0.47], [x - 0.5, y + 1.8, z - 0.47], [x + 0.5, y + 1.8, z - 0.47]);
  W.buy.push({ x, y, z }); }
function courtLines(K, x0, z0, x1, z1, y, col = 0xffffff) { const b = K.bat, t = 0.08, o = { detail: true, skip: 1 | 2 | 16 | 32 }; const ln = (a, c, d, e) => b.box(a, y, c, d, y + 0.012, e, L.PLAIN, col, o);
  ln(x0, z0, x1, z0 + t); ln(x0, z1 - t, x1, z1); ln(x0, z0, x0 + t, z1); ln(x1 - t, z0, x1, z1); const long = x1 - x0 > z1 - z0; if (long) { const m = (x0 + x1) / 2; ln(m - t / 2, z0, m + t / 2, z1); } else { const m = (z0 + z1) / 2; ln(x0, m - t / 2, x1, m + t / 2); }
  K.shape('cyl12', (x0 + x1) / 2, y + 0.008, (z0 + z1) / 2, 1.8, 0.012, 1.8, L.PLAIN, 0x3fae5a, true); }
function hoop(K, x, y, z, dir, axis = 'x') { // tabela de basquete em pilar de tijolo (foto 1)
  const dx = axis === 'x' ? dir : 0, dz = axis === 'z' ? dir : 0;
  K.solid(x - 0.3, y, z - 0.3, x + 0.3, y + 3.3, z + 0.3, L.BRICK, 0xffffff);
  const bx = x + dx * 0.9, bz = z + dz * 0.9; K.beam([x, y + 3.1, z], [bx, y + 3.2, bz], 0.1, L.PLAIN, 0x6a7076);
  if (axis === 'x') K.bat.box(bx - 0.03, y + 2.75, bz - 0.9, bx + 0.03, y + 3.85, bz + 0.9, L.PLAIN, 0xf4f4f0, { detail: true }); else K.bat.box(bx - 0.9, y + 2.75, bz - 0.03, bx + 0.9, y + 3.85, bz + 0.03, L.PLAIN, 0xf4f4f0, { detail: true });
  K.shape('cyl12', bx + dx * 0.32, y + 3.05, bz + dz * 0.32, 0.25, 0.04, 0.25, L.PLAIN, 0xd9541e, true); K.shape('cyl8', bx + dx * 0.32, y + 2.82, bz + dz * 0.32, 0.2, 0.42, 0.2, L.FENCE, 0xf0e0d0, true); }
function goal(K, x, y, z, axis = 'x', w = 3) { const c = 0xf4f4f0; if (axis === 'x') { K.beam([x, y, z - w / 2], [x, y + 2, z - w / 2], 0.09, L.PLAIN, c); K.beam([x, y, z + w / 2], [x, y + 2, z + w / 2], 0.09, L.PLAIN, c); K.beam([x, y + 2, z - w / 2], [x, y + 2, z + w / 2], 0.09, L.PLAIN, c); } else { K.beam([x - w / 2, y, z], [x - w / 2, y + 2, z], 0.09, L.PLAIN, c); K.beam([x + w / 2, y, z], [x + w / 2, y + 2, z], 0.09, L.PLAIN, c); K.beam([x - w / 2, y + 2, z], [x + w / 2, y + 2, z], 0.09, L.PLAIN, c); } }

// ───────────────────────────── PLAZA SHOPPING (fotos 2, 3, 4) ─────────────────────────────
function mall(W, K, P) {
  const X0 = 60, Z0 = -236, UL = 96, VL = 56, F1 = P + 1.2, F2 = F1 + 5, R = F2 + 5; const X = (u) => X0 + u, Z = (v) => Z0 + v; const T = W.terr, b = K.bat;
  T.paint(44, -244, 172, -116, CT.CONCRETE); T.paint(44, -176, 172, -120, CT.LOT);
  W.labels.push({ name: 'Plaza Shopping', x: 108, z: -208 }); W.fp.push([X0, Z0, X0 + UL, Z0 + VL, '#d9d9d6']);
  K.solid(X0, P - 1.5, Z0, X0 + UL, F1, Z0 + VL, L.CONCRETE, 0x9a9a98, { top: L.FLOOR_TILE, topColor: 0xffffff });
  const ext = { l: L.CLADDING, c: CLAD, il: L.PLASTER, ic: 0xf0ede6 }, th = 0.4, top = R + 1.2;
  // paredes externas (vãos só no térreo)
  K.wall('x', Z(VL) - th / 2, X(0), X(UL), F1, top, th, { ...ext, side: -1 }, [{ a: X(42), b: X(45), lo: 0, hi: 3.6, k: 'glass' }, { a: X(45), b: X(51), lo: 0, hi: 3.6, k: 'door' }, { a: X(51), b: X(54), lo: 0, hi: 3.6, k: 'glass' }]);
  K.wall('x', Z(0) + th / 2, X(0), X(UL), F1, top, th, { ...ext, side: 1 }, [{ a: X(76), b: X(84), lo: 0, hi: 4, k: 'door' }, { a: X(20), b: X(21.2), lo: 0, hi: 2.2, k: 'leaf', c: 0x6d7378 }]);
  K.wall('z', X(0) + th / 2, Z(th), Z(VL - th), F1, top, th, { ...ext, side: 1 }, [{ a: Z(25), b: Z(31), lo: 0, hi: 3.4, k: 'door' }, { a: Z(5.4), b: Z(7.6), lo: R - F1, hi: R - F1 + 1.3, k: 'door' }]);
  K.wall('z', X(UL) - th / 2, Z(th), Z(VL - th), F1, top, th, { ...ext, side: -1 }, [{ a: Z(26.6), b: Z(28.2), lo: 0, hi: 2.3, k: 'leaf', c: 0x8a2a22 }]);
  // base cinza (foto 3) e painel laranja quadriculado na lateral leste
  K.facePanel('z', X(UL), 0.03, Z(2), Z(VL - 2), F1 + 0.02, F1 + 2.4, L.CONCRETE, 0x8f9396, 14, 1, 1);
  K.facePanel('z', X(UL), 0.05, Z(8), Z(40), F1 + 3.4, R + 0.4, L.ORANGE_PANEL, 0xffffff, 8, 2.2, 1);
  K.facePanel('z', X(0), 0.05, Z(4), Z(16), F1 + 4, R, L.ORANGE_PANEL, 0xffffff, 3, 1.6, -1);
  // letreiros de lojas (nomes fictícios) na fachada oeste, perto da esquina (foto 4)
  const brands = [['LOJAS RIACHO', '#b3261e'], ['CINE CARAPI', '#b0204f'], ['C&D MODAS', '#f2f2f2', '#333'], ['BURGUER BR', '#c22a1e'], ['NIVAL MÓVEIS', '#f6e27a', '#222'], ['POLO SUL', '#3a3d42'], ['MERCADO ROCHA', '#f0f0ec', '#b3261e'], ['MAGAZINE SOL', '#1f5fa8']];
  brands.forEach((br, i) => { const col = i % 2, row = (i / 2) | 0, za = Z(VL - 4 - col * 4.4), y = F1 + 2.2 + row * 2.3; W.signs.place(br[0], { bg: br[1], color: br[2] || '#fff', size: 0.36, border: 'rgba(0,0,0,.35)' }, [X(0) - 0.05, y, za - 3.6], [X(0) - 0.05, y, za], [X(0) - 0.05, y + 1.8, za], [X(0) - 0.05, y + 1.8, za - 3.6]); });
  // pórtico alto da entrada com o letreiro (foto 2)
  K.solid(X(34), F1 + 4.2, Z(VL), X(62), R + 8, Z(VL) + 0.8, L.CLADDING, CLAD);
  W.signs.place('PLAZA SHOPPING\nCARAPICUÍBA', { bg: '#f4f4f2', color: '#4a4e54', size: 0.3, weight: 500, cols: 4, rows: 3, cy: 0.74, draw: (c, w, h) => { const sw = (col, oy, lw) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(w * 0.2, h * (0.34 + oy)); c.quadraticCurveTo(w * 0.42, h * (0.02 + oy), w * 0.86, h * (0.3 + oy)); c.stroke(); }; sw('#e0705a', 0.0, 14); sw('#6aa878', 0.07, 11); sw('#9fb8c8', 0.14, 9); c.lineWidth = 3; for (let i = 0; i < 6; i++) { c.strokeStyle = ['#e0705a', '#6aa878', '#9fb8c8'][i % 3]; c.beginPath(); c.moveTo(w * 0.5, h * (0.2 + i * 0.03)); c.lineTo(w * (0.8 + i * 0.02), h * (0.14 + i * 0.045)); c.stroke(); } } }, [X(38), R - 1, Z(VL) + 0.84], [X(58), R - 1, Z(VL) + 0.84], [X(58), R + 7, Z(VL) + 0.84], [X(38), R - 1 + 8, Z(VL) + 0.84]);
  K.solid(X(38), F1 + 3.8, Z(VL) + 0.8, X(58), F1 + 4.2, Z(VL) + 4.2, L.CONCRETE, 0xe4e4e0, { bottom: true });
  for (const u of [39, 57]) K.solid(X(u) - 0.3, P, Z(VL) + 3.5, X(u) + 0.3, F1 + 3.8, Z(VL) + 4.1, L.CONCRETE, 0xe4e4e0);
  // escadaria frontal com corrimãos
  K.stairs(X(40), Z(VL), X(56), Z(VL) + 2.6, P, F1, 'z', -1, L.CONCRETE, 0xb9b6ae, { structural: true, solidBase: true });
  for (const u of [40, 44, 48, 52, 56]) { K.beam([X(u), F1 + 0.95, Z(VL)], [X(u), P + 0.95, Z(VL) + 2.6], 0.06, L.PLAIN, 0xb8bec2); K.beam([X(u), P, Z(VL) + 2.6], [X(u), P + 0.95, Z(VL) + 2.6], 0.06, L.PLAIN, 0xb8bec2); }
  K.solid(X(36), P - 1, Z(VL), X(40), F1, Z(VL) + 2.6, L.CONCRETE, 0x8f8f8c, { top: L.GRASS, topColor: 0x9fbf7f }); K.solid(X(56), P - 1, Z(VL), X(60), F1, Z(VL) + 2.6, L.CONCRETE, 0x8f8f8c, { top: L.GRASS, topColor: 0x9fbf7f });
  for (const [x, z] of [[X(30), Z(VL) + 4], [X(66), Z(VL) + 4], [X(8), Z(VL) + 5], [X(88), Z(VL) + 5], [X(0) - 6, Z(40)], [X(0) - 6, Z(14)]]) K.tree(x, z, 1.15, 1);
  // acessos laterais: rampa oeste, doca norte, escada leste
  K.stairs(X(0) - 4.8, Z(25), X(0), Z(31), P, F1, 'x', 1, L.CONCRETE, 0xb9b6ae, { structural: true, solidBase: true, rail: true });
  K.stairs(X(76), Z(0) - 5, X(84), Z(0), P, F1, 'z', 1, L.CONCRETE, 0x9a9a98, { structural: true, solidBase: true });
  K.stairs(X(UL), Z(26.4), X(UL) + 3.6, Z(28.4), P, F1, 'x', -1, L.CONCRETE, 0xb9b6ae, { structural: true, solidBase: true, rail: true });
  // lajes: 2º piso (com vazios) e cobertura
  const holes = [[X(30), Z(26), X(66), Z(30)], [X(18), Z(25), X(28), Z(27)], [X(68), Z(29), X(78), Z(31)], [X(42.2), Z(34), X(53.8), Z(VL - th)]];
  K.slab(X(th), Z(th), X(UL - th), Z(VL - th), F2 - 0.3, F2, L.FLOOR_TILE, 0xf2ead8, holes);
  K.slab(X(0), Z(0), X(UL), Z(VL), R - 0.3, R, L.CONCRETE, 0xb0b0ac);
  K.stairs(X(18), Z(25), X(28), Z(27), F1, F2, 'x', 1, L.PLAIN, 0x8d949a, { structural: true, rail: true });
  K.stairs(X(68), Z(29), X(78), Z(31), F1, F2, 'x', -1, L.PLAIN, 0x8d949a, { structural: true, rail: true });
  const rail = (x0, z0, x1, z1) => { K.solid(x0, F2, z0, x1, F2 + 1.05, z1, L.PLAIN, 0x9fb4bd, { detail: true }); };
  rail(X(30), Z(26) - 0.08, X(66), Z(26)); rail(X(30), Z(30), X(66), Z(30) + 0.08); rail(X(30) - 0.08, Z(26), X(30), Z(30)); rail(X(66), Z(26), X(66) + 0.08, Z(30));
  rail(X(18), Z(25) - 0.08, X(28), Z(25)); rail(X(18), Z(27), X(28), Z(27) + 0.08); rail(X(18) - 0.08, Z(25), X(18), Z(27));
  rail(X(68), Z(29) - 0.08, X(78), Z(29)); rail(X(68), Z(31), X(78), Z(31) + 0.08); rail(X(78), Z(29), X(78) + 0.08, Z(31));
  rail(X(42.2), Z(34) - 0.08, X(53.8), Z(34));
  const inn = { l: L.PLASTER, c: 0xece8de }, it = 0.25; const tints = [0xd94f3a, 0x3a78c0, 0x3aa86a, 0xd6a23c, 0x8a4ab0, 0x2e9aa0];
  const front = (a, open, name, i) => open ? [{ a: X(a + 0.7), b: X(a + 4.6), lo: 0.35, hi: 3.1, k: 'glass' }, { a: X(a + 5.2), b: X(a + 8.2), lo: 0, hi: 3.1, k: 'door' }] : [{ a: X(a + 0.7), b: X(a + 9), lo: 0, hi: 3.2, k: 'shut' }];
  const names1 = ['MODA JOVEM', 'ÓTICA', 'CALÇADOS PÉ QUENTE', 'CELULARES', 'JOALHERIA', 'GAMES & CIA', 'DEPÓSITO', 'ADM'];
  const names2 = ['SURF & SKATE', 'PERFUMARIA', 'LIVRARIA', 'BRINQUEDOS', 'ESPORTES', 'ELETRO LAR'];
  for (let fl = 0; fl < 2; fl++) {
    const y0 = fl ? F2 : F1, y1 = fl ? R - 0.3 : F2 - 0.3; const vBack = fl ? th : 4;
    // lojas do lado norte (v 4..24) + corredor de serviço atrás (térreo)
    const openN = fl ? [1, 1, 0, 1, 0, 1, 1] : [1, 0, 1, 1, 0, 1, 0];
    const opsF = []; for (let i = 0; i < 7; i++) { const a = 2 + i * 12; if (i === 6 && !fl) { opsF.push({ a: X(a + 3), b: X(a + 9), lo: 0, hi: 3.4, k: 'door' }); continue; } front(a + 1, openN[i]).forEach((o) => opsF.push(o)); if (openN[i] || 1) W.signs.place((fl ? names2 : names1)[i] || 'LOJA', { bg: ['#262b33', '#b3261e', '#1f5fa8', '#1d7a46', '#6b2a8f', '#c56a12'][(i + fl * 3) % 6], size: 0.5 }, [X(a + 2), y0 + 3.25, Z(24) + it / 2 + 0.02], [X(a + 10), y0 + 3.25, Z(24) + it / 2 + 0.02], [X(a + 10), y0 + 4.1, Z(24) + it / 2 + 0.02], [X(a + 2), y0 + 4.1, Z(24) + it / 2 + 0.02]); }
    K.wall('x', Z(24), X(2), X(94), y0, y1, it, inn, opsF);
    if (!fl) { const opsB = []; for (let i = 0; i < 7; i++) opsB.push({ a: X(2 + i * 12 + 8), b: X(2 + i * 12 + 9.2), lo: 0, hi: 2.2, k: i % 2 ? 'leaf' : 'door', c: 0x6d7378 }); K.wall('x', Z(4), X(2), X(94), y0, y1, it, inn, opsB); }
    for (let i = 0; i <= 7; i++) { const u = 2 + i * 12; if (u > 94) break; K.wall('z', X(u), Z(vBack), Z(24), y0, y1, it, inn, (i > 0 && i < 7 && (i % 3 === 1)) ? [{ a: Z(12), b: Z(13.4), lo: 0, hi: 2.2, k: 'door' }] : []); }
    K.wall('z', X(94), Z(vBack), Z(24), y0, y1, it, inn, [{ a: Z(18), b: Z(19.4), lo: 0, hi: 2.2, k: 'door' }]);
    for (let i = 0; i < 7; i++) { const a = 2 + i * 12, cx = X(a + 6); if (i === 6 && !fl) { K.prop('container', cx, y0, Z(10), 0, 0x8a3a2a); K.prop('crate2', X(a + 2), y0, Z(18)); K.prop('crate2', X(a + 3.4), y0, Z(18)); K.prop('crate', X(a + 10), y0, Z(20)); W.crates.push({ x: cx, y: y0, z: Z(16), tier: 2 }); W.loot.push({ x: X(a + 9), y: y0, z: Z(8), tier: 2 }); continue; }
      if (!openN[i]) { K.prop('crate', cx - 2, y0, Z(18)); K.prop('crate2', cx + 2, y0, Z(10)); W.loot.push({ x: cx, y: y0, z: Z(14), tier: 1 }); continue; }
      K.prop('counter', cx, y0, Z(vBack + 4), 0); K.prop('shelf', X(a + 1.2), y0, Z(14), 1, 0x8d949a); K.prop('shelf', X(a + 10.8), y0, Z(11), 1); K.prop('rack', cx - 1.5, y0, Z(18), 0, tints[i % 6]); K.prop('rack', cx + 2, y0, Z(15), 1, tints[(i + 2) % 6]);
      W.loot.push({ x: cx, y: y0, z: Z(vBack + 2.2), tier: 1 }); W.loot.push({ x: cx + 3, y: y0, z: Z(20), tier: 1 }); if (i % 2 === 0) W.crates.push({ x: cx - 3.5, y: y0, z: Z(vBack + 2), tier: 1 }); }
    // pilares do corredor
    for (let u = 14; u < 94; u += 12) { K.solid(X(u) - 0.35, y0, Z(24.2), X(u) + 0.35, y1, Z(24.9), L.PLASTER, 0xdcd8ce); if (!(u > 40 && u < 56)) K.solid(X(u - 2) - 0.35, y0, Z(31.1), X(u - 2) + 0.35, y1, Z(31.8), L.PLASTER, 0xdcd8ce); }
    if (!fl) {
      // térreo, lado sul: 4 lojas a oeste e 4 a leste do hall de entrada
      const openS = [1, 1, 0, 1, 1, 0, 1, 1]; const namesS = ['CAFÉ DO PLAZA', 'RELOJOARIA', 'TABACARIA', 'DOCERIA', 'LOTÉRICA', 'CHAVEIRO', 'PET SHOP', 'CASA DE SUCOS'];
      const ops = []; for (let i = 0; i < 8; i++) { const a = i < 4 ? 2 + i * 10 : 54 + (i - 4) * 10; front(a, openS[i]).forEach((o) => ops.push(o)); W.signs.place(namesS[i], { bg: ['#c56a12', '#262b33', '#6b2a8f', '#b3261e', '#1d7a46', '#1f5fa8'][i % 6], size: 0.5 }, [X(a + 9), y0 + 3.25, Z(32) - it / 2 - 0.02], [X(a + 1), y0 + 3.25, Z(32) - it / 2 - 0.02], [X(a + 1), y0 + 4.1, Z(32) - it / 2 - 0.02], [X(a + 9), y0 + 4.1, Z(32) - it / 2 - 0.02]); }
      K.wall('x', Z(32), X(2), X(42), y0, y1, it, inn, ops); K.wall('x', Z(32), X(54), X(94), y0, y1, it, inn, ops);
      for (const u of [2, 12, 22, 32, 42, 54, 64, 74, 84, 94]) K.wall('z', X(u), Z(32), Z(VL - th), y0, y1, it, inn, (u === 42 || u === 54) ? [{ a: Z(40), b: Z(42), lo: 0, hi: 2.4, k: 'door' }] : (((u / 10) | 0) % 2 ? [{ a: Z(48), b: Z(49.4), lo: 0, hi: 2.2, k: 'door' }] : []));
      for (let i = 0; i < 8; i++) { const a = i < 4 ? 2 + i * 10 : 54 + (i - 4) * 10, cx = X(a + 5); if (!openS[i]) { K.prop('crate2', cx, y0, Z(44)); W.loot.push({ x: cx + 2, y: y0, z: Z(40), tier: 1 }); continue; } K.prop('counter', cx, y0, Z(50), 0); K.prop('shelf', X(a + 1.1), y0, Z(40), 1); K.prop('table', cx + 1.5, y0, Z(38), 0); K.prop('rack', cx - 2, y0, Z(45), 1, tints[i % 6]); W.loot.push({ x: cx, y: y0, z: Z(52.5), tier: 1 }); W.loot.push({ x: cx - 2, y: y0, z: Z(36), tier: 0 }); if (i % 3 === 0) W.crates.push({ x: cx + 3, y: y0, z: Z(53), tier: 1 }); }
      // corredor: quiosques, bancos e vasos = cobertura
      K.prop('kiosk', X(10), y0, Z(28)); K.prop('kiosk', X(36), y0, Z(28.4), 0, 0x2e9aa0); K.prop('kiosk', X(62), y0, Z(27.2)); K.prop('kiosk', X(88), y0, Z(28), 0, 0x8a4ab0);
      for (const u of [16, 31, 58, 82]) { K.prop('bench', X(u), y0, Z(30.6)); K.prop('planter', X(u + 3), y0, Z(25.6)); }
      K.prop('planter', X(44), y0, Z(46)); K.prop('planter', X(52), y0, Z(46)); K.prop('bench', X(48), y0, Z(38)); K.prop('kiosk', X(48), y0, Z(49), 0, 0xd6a23c);
      W.loot.push({ x: X(48), y: y0, z: Z(28), tier: 1 }); W.loot.push({ x: X(5), y: y0, z: Z(2.2), tier: 2 }); W.loot.push({ x: X(60), y: y0, z: Z(2.2), tier: 2 }); W.crates.push({ x: X(40), y: y0, z: Z(2.2), tier: 2 }); W.crates.push({ x: X(90), y: y0, z: Z(12), tier: 2 });
      for (let u = 8; u < 94; u += 14) K.prop('crate', X(u), y0, Z(1.2));
    } else {
      // 2º piso, sudoeste: praça de alimentação; sudeste: loja âncora
      K.wall('z', X(42), Z(32), Z(VL - th), y0, y1, it, inn, [{ a: Z(36), b: Z(52), lo: 1.1, hi: 3.2, k: 'hole' }]); K.wall('z', X(54), Z(32), Z(VL - th), y0, y1, it, inn, [{ a: Z(36), b: Z(52), lo: 1.1, hi: 3.2, k: 'hole' }]);
      K.wall('z', X(2), Z(32), Z(VL - th), y0, y1, it, inn); K.wall('z', X(94), Z(32), Z(VL - th), y0, y1, it, inn);
      const food = ['X-TUDO DA VILA', 'PASTEL & CALDO', 'AÇAÍ PLANALTO', 'PIZZA NO CONE']; food.forEach((n, i) => { const a = 4 + i * 9.5; K.prop('counter', X(a + 3), y0, Z(52.2), 0, 0xb9b2a4); K.wall('z', X(a + 7.5), Z(51), Z(VL - th), y0, y0 + 3, 0.15, inn); W.signs.place(n, { bg: ['#b3261e', '#c56a12', '#5a2a80', '#1d7a46'][i], size: 0.48 }, [X(a + 6.8), y0 + 3.0, Z(53)], [X(a - 0.4), y0 + 3.0, Z(53)], [X(a - 0.4), y0 + 3.9, Z(53)], [X(a + 6.8), y0 + 3.9, Z(53)]); W.loot.push({ x: X(a + 3), y: y0, z: Z(54), tier: 1 }); });
      K.solid(X(4), y0 + 2.9, Z(52.8), X(41), y0 + 4, Z(53), L.PLASTER, 0xdcd8ce, { detail: true });
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) K.prop('foodtable', X(6 + c * 6.2 + (r % 2) * 2), y0, Z(35.5 + r * 5), r % 2, [0xd9502e, 0xe0a030, 0x3a8a5a][r]);
      W.crates.push({ x: X(22), y: y0, z: Z(47), tier: 1 }); W.loot.push({ x: X(12), y: y0, z: Z(40), tier: 1 }); W.loot.push({ x: X(34), y: y0, z: Z(44), tier: 1 });
      K.wall('x', Z(32), X(54), X(94), y0, y1, it, inn, [{ a: X(60), b: X(66), lo: 0, hi: 3.2, k: 'door' }, { a: X(68), b: X(74), lo: 0.4, hi: 3.1, k: 'glass' }, { a: X(78), b: X(84), lo: 0.4, hi: 3.1, k: 'glass' }]);
      W.signs.place('LOJÃO CARAPICUÍBA', { bg: '#1f5fa8', size: 0.55, cols: 2 }, [X(86), y0 + 3.3, Z(32) - 0.15], [X(58), y0 + 3.3, Z(32) - 0.15], [X(58), y0 + 4.3, Z(32) - 0.15], [X(86), y0 + 4.3, Z(32) - 0.15]);
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) K.prop('shelf', X(60 + c * 9), y0, Z(37 + r * 4.6), 0, [0x8d949a, 0xa0a8ae][c % 2]);
      K.prop('counter', X(90), y0, Z(36), 1); K.prop('counter', X(90), y0, Z(41), 1); W.crates.push({ x: X(91), y: y0, z: Z(52), tier: 2 }); W.crates.push({ x: X(58), y: y0, z: Z(53), tier: 1 }); W.loot.push({ x: X(72), y: y0, z: Z(46), tier: 2 }); W.loot.push({ x: X(82), y: y0, z: Z(35), tier: 1 });
      K.prop('bench', X(24), y0, Z(31)); K.prop('planter', X(72), y0, Z(25.2)); K.prop('bench', X(86), y0, Z(25)); W.loot.push({ x: X(29), y: y0, z: Z(28), tier: 1 });
    }
  }
  // cobertura: casas de máquinas e acesso por escada marinheiro na doca
  K.solid(X(20), R, Z(10), X(30), R + 2.6, Z(18), L.CONCRETE, 0xa8a8a4); K.solid(X(70), R, Z(36), X(76), R + 2.2, Z(44), L.CONCRETE, 0xa8a8a4); W.crates.push({ x: X(48), y: R, z: Z(20), tier: 2 }); W.loot.push({ x: X(25), y: R, z: Z(22), tier: 2 });
  K.stairs(X(0) - 1.4, Z(8), X(0), Z(22), P, R, 'z', -1, L.PLAIN, 0x6d7378, { structural: true, rail: true }); K.solid(X(0) - 1.4, R - 0.3, Z(5), X(0), R, Z(8), L.PLAIN, 0x6d7378); K.solid(X(0) - 1.3, P, Z(5.1), X(0) - 1.1, R - 0.3, Z(5.3), L.PLAIN, 0x4a4f55);
  // estacionamento, silos (foto 4) e loja
  for (let i = 0; i < 9; i++) if (i !== 4) W.parked.push({ x: 60 + i * 11, z: -150 + (i % 2) * 14, rot: 0, col: [0xb8bcc0, 0x2b2d33, 0x8a1f1f, 0xe8e8e4, 0x1f3f7a][i % 5] });
  for (const z of [-232, -220]) { K.shape('cyl12', 50, P + 6, z, 3.4, 12, 3.4, L.CLADDING, 0xf0ece4, false); K.shape('cone', 50, P + 12.8, z, 3.5, 1.6, 3.5, L.PLAIN, 0xd9d5cc, false); W.phys.box(46.8, P, z - 3.2, 53.2, P + 12, z + 3.2); }
  K.fence('z', 57, -240, -212, P, P + 2.4);
  buyStation(W, K, 100, -168); W.vehicleSpots.push({ x: 150, z: -128, rot: Math.PI / 2, type: 'car' }, { x: 64, z: -128, rot: Math.PI / 2, type: 'jeep' });
  for (const x of [70, 108, 146]) K.pole(x, -140, true, 0);
}

// ───────────────────────────── EE BASÍLIO BOSNIAC (fotos 5, 6, 8) ─────────────────────────────
function school(W, K, P) {
  const T = W.terr, b = K.bat; T.paint(44, -100, 100, -44, CT.CONCRETE); W.labels.push({ name: 'EE Basílio Bosniac', x: 72, z: -72 });
  // muro azul com "pedras" + alambrado em cima; portão azul na R. Europa (lado leste)
  const mur = { l: L.MURAL, c: 0xffffff };
  K.wall('z', 100, -100, -44, P - 0.6, P + 2.4, 0.3, mur, [{ a: -58, b: -54.6, lo: 0.6, hi: 3.2, k: 'door' }]); K.wall('z', 44, -100, -44, P - 0.6, P + 2.4, 0.3, mur);
  K.wall('x', -100, 44, 100, P - 0.6, P + 2.4, 0.3, mur); K.wall('x', -44, 44, 100, P - 0.6, P + 2.4, 0.3, mur, [{ a: 60, b: 61.6, lo: 0.6, hi: 2.8, k: 'leaf', c: 0x3f8fd0 }]);
  K.fence('z', 100, -100, -58, P + 2.4, P + 4.4); K.fence('z', 100, -54.6, -44, P + 2.4, P + 4.4); K.fence('z', 44, -100, -44, P + 2.4, P + 4.4); K.fence('x', -100, 44, 100, P + 2.4, P + 4.4); K.fence('x', -44, 44, 100, P + 2.4, P + 4.4);
  // portão corrediço azul entreaberto, com o desenho das crianças e o aviso (foto 8)
  K.solid(100.2, P, -62.4, 100.32, P + 2.3, -58, L.PLAIN, 0x74bfe8);
  W.signs.place('Proibido estacionar\ndia e noite', { bg: '#74bfe8', color: '#1b2a3a', size: 0.2, weight: 500, font: 'cursive', cy: 0.82, cols: 2, rows: 2, draw: (c, w, h) => { c.fillStyle = '#2f5fae'; for (let i = 0; i < 3; i++) { const x = w * (0.36 + i * 0.14), y = h * 0.3; c.beginPath(); c.arc(x, y - h * 0.12, h * 0.05, 0, 6.3); c.fill(); c.fillRect(x - h * 0.035, y - h * 0.07, h * 0.07, h * 0.2); c.fillRect(x - h * 0.07, y - h * 0.05, h * 0.14, h * 0.03); } c.fillStyle = '#c0392b'; c.fillRect(w * 0.47, h * 0.08, w * 0.05, h * 0.06); c.strokeStyle = '#c0392b'; c.lineWidth = 7; c.beginPath(); c.arc(w * 0.5, h * 0.6, h * 0.1, 0, 6.3); c.stroke(); c.beginPath(); c.moveTo(w * 0.45, h * 0.52); c.lineTo(w * 0.55, h * 0.68); c.stroke(); c.fillStyle = '#222'; c.font = `900 ${h * 0.14}px Arial`; c.fillText('E', w * 0.5, h * 0.6); } }, [100.34, P + 0.2, -58.2], [100.34, P + 0.2, -62.2], [100.34, P + 2.2, -62.2], [100.34, P + 2.2, -58.2]);
  W.signs.place('E.E. BASÍLIO\nBOSNIAC', { bg: '#c9c9c4', color: '#2b3038', size: 0.5 }, [100.16, P + 2.5, -50], [100.16, P + 2.5, -53.4], [100.16, P + 4.2, -53.4], [100.16, P + 4.2, -50]);
  // bloco principal de 2 pavimentos, fachada longa voltada à R. Europa com o letreiro azul (foto 5)
  const X0 = 84, X1 = 96, Z0 = -98, Z1 = -62, Fl = P + 0.15, H = 3.4, F2 = Fl + H + 0.25, top = F2 + H; const m = { l: L.PLASTER, c: 0xdfe3e6, il: L.PLASTER, ic: 0xeeeae0 }, th = 0.25;
  K.solid(X0, P - 0.8, Z0, X1, Fl, Z1, L.CONCRETE, 0xaaa69c, { top: L.FLOOR_TILE, topColor: 0xd9d2c2 }); W.fp.push([X0, Z0, X1, Z1, '#cfd6dc']);
  for (let fl = 0; fl < 2; fl++) { const y0 = fl ? F2 : Fl, y1 = y0 + H;
    const east = [], west = []; for (let r = 0; r < 4; r++) { const za = Z0 + r * 9; for (let k = 0; k < 2; k++) east.push({ a: za + 1 + k * 4, b: za + 4.2 + k * 4, lo: 1.1, hi: 2.7, k: (r + fl) % 3 === 0 && k === 0 ? 'bars' : 'win', c: 0xf0e2a8 }); west.push({ a: za + 1.2, b: za + 2.4, lo: 0, hi: 2.2, k: r % 2 ? 'leaf' : 'door', c: 0x3f8fd0 }); west.push({ a: za + 4, b: za + 7.6, lo: 1.2, hi: 2.4, k: r % 2 ? 'hole' : 'win' }); }
    K.wall('z', X1 - th / 2, Z0, Z1, y0, y1 + (fl ? 1.5 : 0.25), th, { ...m, side: -1 }, east); K.wall('z', 87, Z0, Z1, y0, y1, th, { ...m, side: 1 }, west);
    K.wall('x', Z0 + th / 2, X0, X1, y0, y1, th, { ...m, side: 1 }); K.wall('x', Z1 - th / 2, 87, X1, y0, y1, th, { ...m, side: -1 });
    for (let r = 1; r < 4; r++) K.wall('x', Z0 + r * 9, 87.1, X1 - th, y0, y1, 0.16, { l: L.PLASTER, c: 0xeeeae0 });
    for (let r = 0; r < 4; r++) { const zc = Z0 + r * 9 + 4.5; K.prop('desk', 93.5, y0, zc - 2.6, 1); for (let d = 0; d < 2; d++) K.prop('table', 89.6 + d * 2.3, y0, zc + 1.6, 1, 0xc9b48a); W.loot.push({ x: 91, y: y0, z: zc - 1, tier: fl }); if ((r + fl) % 2) W.crates.push({ x: 94.6, y: y0, z: zc + 3.2, tier: 1 }); }
    for (let z = Z0 + 0.3; z <= Z1; z += 6) K.solid(X0, y0, z - 0.2, X0 + 0.4, y1, z + 0.2, L.PLASTER, 0xdfe3e6);
    if (fl) { K.solid(X0, y0, Z0, X0 + 0.12, y0 + 1.05, Z1, L.PLASTER, 0x3f8fd0, { detail: true }); }
  }
  K.slab(X0, Z0, X1, Z1, F2 - 0.25, F2, L.FLOOR_TILE, 0xd9d2c2); K.slab(X0 - 0.4, Z0 - 0.3, X1 + 0.3, Z1 + 0.3, top, top + 0.25, L.METAL_ROOF, 0xc9cdd0);
  K.stairs(84.2, -62, 86.8, -54, Fl, F2, 'z', -1, L.CONCRETE, 0xb5b1a8, { structural: true, rail: true });
  // faixa branca com letras azuis no alto da fachada leste
  W.signs.place('E.E. BASÍLIO BOSNIAC', { bg: '#eef0f0', color: '#2f6fc0', size: 0.7, cols: 4 }, [X1 + 0.03, top - 0.2, Z1 - 4], [X1 + 0.03, top - 0.2, Z0 + 4], [X1 + 0.03, top + 1.4, Z0 + 4], [X1 + 0.03, top + 1.4, Z1 - 4]);
  for (const z of [-94, -82, -70]) K.tree(98.2, z, 0.7, 1);
  for (const z of [-90, -66, -48]) K.tree(102.6, z, 0.55);
  // bloco administrativo / cantina / banheiros
  { const a0 = 48, a1 = 60, c0 = -98, c1 = -72, y0 = Fl, y1 = Fl + 3.2; const mm = { l: L.PLASTER, c: 0xdfe3e6, il: L.WALL_TILE, ic: 0xffffff };
    K.solid(a0, P - 0.8, c0, a1, Fl, c1, L.CONCRETE, 0xaaa69c, { top: L.FLOOR_TILE, topColor: 0xe6e0d2 }); W.fp.push([a0, c0, a1, c1, '#cfd6dc']);
    K.wall('z', a1 - 0.12, c0, c1, y0, y1, 0.25, { ...mm, side: -1 }, [{ a: -95, b: -93.6, lo: 0, hi: 2.2, k: 'door' }, { a: -90, b: -86, lo: 1, hi: 2.3, k: 'hole' }, { a: -80, b: -78.6, lo: 0, hi: 2.2, k: 'leaf', c: 0x3f8fd0 }]); K.wall('z', a0 + 0.12, c0, c1, y0, y1, 0.25, { ...mm, side: 1 }, [{ a: -92, b: -89, lo: 1.2, hi: 2.3, k: 'win' }]);
    K.wall('x', c0 + 0.12, a0, a1, y0, y1, 0.25, { ...mm, side: 1 }); K.wall('x', c1 - 0.12, a0, a1, y0, y1, 0.25, { ...mm, side: -1 }, [{ a: 53, b: 54.4, lo: 0, hi: 2.2, k: 'door' }]); K.wall('x', -84, a0 + 0.25, a1 - 0.25, y0, y1, 0.16, { l: L.WALL_TILE, c: 0xffffff }, [{ a: 55, b: 56.3, lo: 0, hi: 2.2, k: 'door' }]);
    K.slab(a0 - 0.3, c0 - 0.3, a1 + 0.3, c1 + 0.3, y1, y1 + 0.22, L.METAL_ROOF, 0xc9cdd0);
    K.prop('counter', 56, y0, -88, 1); K.prop('shelf', 49.2, y0, -94, 1); K.prop('toilet', 49.6, y0, -82, 0); K.prop('toilet', 49.6, y0, -79, 0); K.prop('sink', 58, y0, -76, 1); W.loot.push({ x: 53, y: y0, z: -92, tier: 1 }); W.loot.push({ x: 53, y: y0, z: -78, tier: 0 }); W.crates.push({ x: 51, y: y0, z: -96.5, tier: 1 }); }
  // pátio coberto
  K.slab(62, -98, 82, -84, Fl + 3.9, Fl + 4.1, L.METAL_ROOF, 0xb9c0c6); for (const [x, z] of [[62.3, -97.7], [81.7, -97.7], [62.3, -84.3], [81.7, -84.3], [72, -97.7], [72, -84.3]]) K.solid(x - 0.2, P, z - 0.2, x + 0.2, Fl + 3.9, z + 0.2, L.CONCRETE, 0xcfd3d6);
  for (let i = 0; i < 3; i++) { K.prop('table', 66 + i * 5.5, P, -93, 0, 0xc9b48a); K.prop('bench', 66 + i * 5.5, P, -91.6); K.prop('bench', 66 + i * 5.5, P, -88); } W.loot.push({ x: 72, y: P, z: -90, tier: 0 });
  // quadra coberta em arco (visível atrás do portão, foto 8)
  { const x0 = 50, x1 = 78, z0 = -68, z1 = -48; T.paint(x0, z0, x1, z1, CT.COURT); K.arcRoof(x0, z0, x1, z1, P + 5, 3.6, 'x', L.METAL_ROOF, 0xffffff, 0x4a4f55, 7);
    for (let x = x0; x <= x1; x += 7) for (const z of [z0 + 0.25, z1 - 0.25]) K.solid(x - 0.2, P, z - 0.2, x + 0.2, P + 5.1, z + 0.2, L.CONCRETE, 0xcfd3d6);
    courtLines(K, x0 + 1.5, z0 + 1.5, x1 - 1.5, z1 - 1.5, P + 0.01); hoop(K, x0 + 1, P, -58, 1); hoop(K, x1 - 1, P, -58, -1); goal(K, x0 + 2, P, -58); goal(K, x1 - 2, P, -58);
    K.solid(x0, P, z0 - 0.1, x1, P + 1, z0 + 0.1, L.PLASTER, 0x3f8fd0, { detail: true }); W.loot.push({ x: 64, y: P, z: -58, tier: 1 }); W.crates.push({ x: 76, y: P, z: -50, tier: 1 }); }
  // caixa d'água elevada no canto (foto 6)
  { const x = 95, z = -49; for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) K.solid(x + dx - 0.18, P, z + dz - 0.18, x + dx + 0.18, P + 8.5, z + dz + 0.18, L.CONCRETE, 0xc9c6bd); K.solid(x - 1.8, P + 8.5, z - 1.8, x + 1.8, P + 11.2, z + 1.8, L.CONCRETE, 0xd6d3ca); K.solid(x - 1.5, P + 4.2, z - 1.5, x + 1.5, P + 4.4, z + 1.5, L.CONCRETE, 0xc9c6bd); }
  K.tree(66, -78, 1.1); K.tree(79, -74, 0.9); buyStation(W, K, 70, -80);
}

// ───────────────────────────── IGREJA SÃO LUCAS (fotos 6 e 7) ─────────────────────────────
function church(W, K, P) {
  const T = W.terr; T.paint(44, -28, 100, 28, CT.CONCRETE); T.paint(46, 0, 78, 26, CT.LOT); W.labels.push({ name: 'Igreja São Lucas', x: 78, z: -18 });
  const X0 = 58, X1 = 98, Z0 = -28, Z1 = -8, Fc = P + 1.5, Hh = 9, top = Fc + Hh, th = 0.4; const m = { l: L.CHURCH_BRICK, c: 0xffffff, il: L.PLASTER, ic: 0xf3efe4 };
  K.solid(X0 - 0.3, P - 1, Z0 - 0.3, X1 + 0.3, Fc, Z1 + 0.3, L.PLASTER, 0xe8e6e0, { top: L.FLOOR_TILE, topColor: 0xe9dcc4 }); W.fp.push([X0, Z0, X1, Z1, '#9a5a48']);
  const TX0 = 93.5, TZ1 = -23.5; // torre no canto nordeste (frente)
  const winRow = (a0, a1) => { const o = []; for (let p = a0 + 2; p + 2 < a1 - 1; p += 5) { o.push({ a: p, b: p + 2, lo: 1.6, hi: 3.6, k: 'win', c: 0x9fc0ff }); o.push({ a: p, b: p + 2, lo: 5.2, hi: 7.4, k: 'win', c: 0x9fc0ff }); } return o; };
  K.wall('x', Z0 + th / 2, X0, TX0, Fc, top, th, { ...m, side: 1 }, [{ a: 62, b: 64.4, lo: 0, hi: 2.8, k: 'door' }, ...winRow(65, TX0)]);
  K.wall('x', Z1 - th / 2, X0, X1, Fc, top, th, { ...m, side: -1 }, [{ a: 70, b: 72, lo: 0, hi: 2.6, k: 'leaf', c: 0x5a3a26 }, ...winRow(58, 69), ...winRow(73, 98)]);
  K.wall('z', X0 + th / 2, Z0, Z1, Fc, top, th, { ...m, side: 1 }); K.wall('z', X1 - th / 2, TZ1, Z1, Fc, top, th, { ...m, side: -1 }, [{ a: -20, b: -16, lo: 0, hi: 3.6, k: 'door' }]);
  // pilastras e faixas brancas
  for (let x = X0; x <= X1 + 0.1; x += 5) { K.bat.box(x - 0.28, Fc, Z0 - 0.14, x + 0.28, top, Z0, L.PLASTER, WHITE, { detail: true }); K.bat.box(x - 0.28, Fc, Z1, x + 0.28, top, Z1 + 0.14, L.PLASTER, WHITE, { detail: true }); }
  for (const y of [Fc + 4.4, top - 0.4]) { K.bat.box(X0, y, Z0 - 0.1, X1, y + 0.35, Z0, L.PLASTER, WHITE, { detail: true }); K.bat.box(X0, y, Z1, X1, y + 0.35, Z1 + 0.1, L.PLASTER, WHITE, { detail: true }); K.bat.box(X1, y, Z0, X1 + 0.1, y + 0.35, Z1, L.PLASTER, WHITE, { detail: true }); }
  K.gable(X0, Z0, X1, Z1, top, 3.6, 'x', L.ROOF_TILE, 0xb9a090, 0.5);
  K.slab(X0 + th, Z0 + th, TX0, Z1 - th, top - 0.2, top, L.WOOD, 0x8a6a4a); K.slab(TX0, TZ1, X1 - th, Z1 - th, top - 0.2, top, L.WOOD, 0x8a6a4a);
  // pórtico branco da entrada principal + escadaria (frente leste) e rosácea oval
  K.stairs(X1, -21.5, X1 + 3.4, -14.5, P, Fc, 'x', -1, L.CONCRETE, 0xd9d6cc, { structural: true, solidBase: true, rail: true });
  for (const z of [-20.6, -15.4]) K.solid(X1 + 0.1, Fc, z - 0.3, X1 + 0.7, Fc + 4, z + 0.3, L.PLASTER, WHITE); K.solid(X1 + 0.1, Fc + 4, -21.2, X1 + 0.8, Fc + 5.2, -14.8, L.PLASTER, WHITE);
  W.signs.place('', { bg: '#7a3a2c', draw: (c, w, h) => { c.fillStyle = '#f2f2ee'; c.beginPath(); c.ellipse(w / 2, h / 2, w * 0.3, h * 0.46, 0, 0, 6.3); c.fill(); c.fillStyle = '#5f86c8'; c.beginPath(); c.ellipse(w / 2, h / 2, w * 0.22, h * 0.36, 0, 0, 6.3); c.fill(); c.strokeStyle = '#f2f2ee'; c.lineWidth = 5; c.beginPath(); c.moveTo(w / 2, h * 0.14); c.lineTo(w / 2, h * 0.86); c.moveTo(w * 0.28, h / 2); c.lineTo(w * 0.72, h / 2); c.stroke(); }, rows: 2 }, [X1 + 0.02, Fc + 6, -16.6], [X1 + 0.02, Fc + 6, -19.4], [X1 + 0.02, Fc + 8.8, -19.4], [X1 + 0.02, Fc + 8.8, -16.6]);
  // entrada lateral com pórtico (lado norte)
  K.stairs(61.4, Z0 - 3.2, 65, Z0, P, Fc, 'z', 1, L.CONCRETE, 0xd9d6cc, { structural: true, solidBase: true }); K.solid(61.2, Fc + 3, Z0 - 1.2, 65.2, Fc + 3.8, Z0, L.PLASTER, WHITE); for (const x of [61.5, 64.9]) K.solid(x - 0.2, Fc, Z0 - 1.1, x + 0.2, Fc + 3, Z0 - 0.7, L.PLASTER, WHITE);
  // torre sineira: tijolo com cunhais brancos, dois níveis de aberturas, telhado piramidal e cruz
  { const y0 = P - 1, yT = Fc + 15.5, tm = { l: L.CHURCH_BRICK, c: 0xffffff, il: L.PLASTER, ic: 0xe9e4d8 }, t2 = 0.35; const lv = (y) => y - y0; const bell = (a, bb) => [{ a, b: bb, lo: lv(Fc + 11), hi: lv(Fc + 12.6), k: 'hole' }, { a, b: bb, lo: lv(Fc + 7), hi: lv(Fc + 8.6), k: 'win', c: 0x2a2f38 }];
    K.wall('x', Z0 + t2 / 2, TX0, X1, y0, yT, t2, { ...tm, side: 1 }, bell(95, 96.6)); K.wall('z', X1 - t2 / 2, Z0, TZ1, y0, yT, t2, { ...tm, side: -1 }, bell(-26.6, -25));
    K.wall('x', TZ1 - t2 / 2, TX0, X1, Fc, yT, t2, { ...tm, side: -1 }, [{ a: 96, b: 97.2, lo: 4.5, hi: 6.7, k: 'door' }, { a: 95, b: 96.6, lo: 11, hi: 12.6, k: 'hole' }]); K.wall('z', TX0 + t2 / 2, Z0, TZ1, Fc, yT, t2, { ...tm, side: 1 }, [{ a: -26.6, b: -25, lo: 11, hi: 12.6, k: 'hole' }]);
    for (const [x, z] of [[TX0, Z0], [X1, Z0], [TX0, TZ1], [X1, TZ1]]) K.bat.box(x - 0.22, Fc, z - 0.22, x + 0.22, yT, z + 0.22, L.PLASTER, WHITE, { detail: false });
    for (const y of [Fc + 6.2, Fc + 10, yT - 0.4]) K.bat.box(TX0 - 0.15, y, Z0 - 0.15, X1 + 0.15, y + 0.4, TZ1 + 0.15, L.PLASTER, WHITE);
    K.slab(TX0 + t2, Z0 + t2, X1 - t2, TZ1 - t2, Fc + 4.3, Fc + 4.5, L.WOOD, 0x8a6a4a); K.slab(TX0 + t2, Z0 + t2, X1 - t2, TZ1 - t2, Fc + 9.8, Fc + 10, L.WOOD, 0x8a6a4a, [[TX0 + t2, Z0 + t2, X1 - t2, Z0 + t2 + 1.3]]);
    K.stairs(TX0 + t2, Z0 + t2, X1 - t2 - 0.2, Z0 + t2 + 1.3, Fc + 4.5, Fc + 10, 'x', 1, L.WOOD, 0x7a5a3c, { structural: true });
    K.shape('pyr', (TX0 + X1) / 2, yT + 1.6, (Z0 + TZ1) / 2, 3.7, 3.2, 3.7, L.ROOF_TILE, 0xb9a090, false, 0, Math.PI / 4, 0, 2); W.phys.box(TX0, yT, Z0, X1, yT + 1.2, TZ1);
    const cx = (TX0 + X1) / 2, cz = (Z0 + TZ1) / 2; K.bat.box(cx - 0.07, yT + 3, cz - 0.07, cx + 0.07, yT + 5, cz + 0.07, L.PLAIN, 0x4a3a30); K.bat.box(cx - 0.07, yT + 4.2, cz - 0.6, cx + 0.07, yT + 4.36, cz + 0.6, L.PLAIN, 0x4a3a30);
    W.loot.push({ x: 96, y: Fc + 10, z: -25, tier: 2 }); }
  // interior: nave com bancos, altar, colunas e mezanino do coro (acesso à torre)
  for (let r = 0; r < 8; r++) for (const z of [-22.6, -13.4]) K.prop('pew', 68 + r * 2.4, Fc, z, 1);
  K.solid(X0 + th, Fc, Z0 + 3, X0 + 7, Fc + 0.45, Z1 - 3, L.WOOD, 0x8a6a4a); K.prop('table', 62, Fc + 0.45, -18, 1, 0xe8e2d0);
  W.signs.place('', { bg: '#f3efe4', draw: (c, w, h) => { c.fillStyle = '#6a4a2e'; c.fillRect(w * 0.46, h * 0.08, w * 0.08, h * 0.84); c.fillRect(w * 0.3, h * 0.28, w * 0.4, h * 0.12); }, rows: 2 }, [X0 + th + 0.03, Fc + 2.4, -19.4], [X0 + th + 0.03, Fc + 2.4, -16.6], [X0 + th + 0.03, Fc + 6.4, -16.6], [X0 + th + 0.03, Fc + 6.4, -19.4]);
  for (let x = 66; x < 90; x += 6) for (const z of [-25, -11]) K.solid(x - 0.25, Fc, z - 0.25, x + 0.25, top - 0.2, z + 0.25, L.PLASTER, 0xe9e4d8);
  K.slab(88, TZ1, X1 - th, Z1 - th, Fc + 4.3, Fc + 4.5, L.WOOD, 0x8a6a4a); K.solid(88, Fc + 4.5, TZ1, 88.12, Fc + 5.5, Z1 - th - 1.9, L.WOOD, 0x6e5034, { detail: true });
  K.stairs(79.6, Z1 - th - 1.8, 88, Z1 - th, Fc, Fc + 4.5, 'x', 1, L.WOOD, 0x7a5a3c, { structural: true, rail: true });
  W.loot.push({ x: 62, y: Fc + 0.45, z: -14, tier: 1 }); W.loot.push({ x: 80, y: Fc, z: -18, tier: 0 }); W.crates.push({ x: 92, y: Fc + 4.5, z: -12, tier: 2 }); W.crates.push({ x: 60, y: Fc, z: -26, tier: 1 });
  // semáforos da esquina (foto 7) e gradil verde
  for (const [x, z, dx, dz] of [[103, -31, 0, -1], [113, -41, 0, 1]]) { const y = T.height(x, z); K.shape('cyl6', x, y + 3, z, 0.09, 6, 0.09, L.PLAIN, 0x3a3d40, false); K.beam([x, y + 5.8, z], [x + (dz ? 0 : 3), y + 5.9, z + dz * 3.4], 0.09, L.PLAIN, 0x3a3d40); K.bat.box(x - 0.2, y + 5.1, z + dz * 3.4 - 0.2, x + 0.2, y + 6.2, z + dz * 3.4 + 0.2, L.PLAIN, 0x15171a, { detail: true }); K.bat.box(x - 0.1, y + 5.8, z + dz * 3.4 + dz * 0.21 - 0.02, x + 0.1, y + 6.0, z + dz * 3.4 + dz * 0.21 + 0.02, L.PLAIN, 0xd22a1e, { detail: true }); K.bat.box(x - 0.1, y + 5.25, z + dz * 3.4 + dz * 0.21 - 0.02, x + 0.1, y + 5.45, z + dz * 3.4 + dz * 0.21 + 0.02, L.PLAIN, 0x2ad26a, { detail: true }); }
  K.fence('x', Z0 - 3.6, 66, 99, P, P + 1.8); K.fence('z', 101.6, -14, -4, P, P + 1.8);
  // salão paroquial nos fundos do terreno
  { const a0 = 48, a1 = 70, c0 = 6, c1 = 24, y0 = P + 0.12, y1 = y0 + 3.4, mm = { l: L.PLASTER, c: 0xe9dcc0, il: L.PLASTER, ic: 0xf1ede4 }; K.solid(a0, P - 0.8, c0, a1, y0, c1, L.CONCRETE, 0xaaa69c, { top: L.FLOOR_TILE, topColor: 0xd9d2c2 }); W.fp.push([a0, c0, a1, c1, '#c9c0ae']);
    K.wall('x', c0 + 0.12, a0, a1, y0, y1, 0.25, { ...mm, side: 1 }, [{ a: 57, b: 60, lo: 0, hi: 2.5, k: 'door' }, { a: 50, b: 54, lo: 1, hi: 2.3, k: 'hole' }, { a: 63, b: 67, lo: 1, hi: 2.3, k: 'win' }]); K.wall('x', c1 - 0.12, a0, a1, y0, y1, 0.25, { ...mm, side: -1 }, [{ a: 66, b: 67.2, lo: 0, hi: 2.2, k: 'door' }]); K.wall('z', a0 + 0.12, c0, c1, y0, y1, 0.25, { ...mm, side: 1 }); K.wall('z', a1 - 0.12, c0, c1, y0, y1, 0.25, { ...mm, side: -1 }, [{ a: 14, b: 15.4, lo: 0, hi: 2.2, k: 'leaf' }]);
    K.slab(a0, c0, a1, c1, y1, y1 + 0.2, L.CONCRETE, 0xb5b1a8); K.gable(a0, c0, a1, c1, y1 + 0.2, 2.2, 'x'); for (let i = 0; i < 3; i++) K.prop('table', 53 + i * 5, y0, 15, 0); K.prop('counter', 66, y0, 21, 0); W.loot.push({ x: 59, y: y0, z: 18, tier: 1 }); W.crates.push({ x: 50, y: y0, z: 22, tier: 1 }); }
  W.parked.push({ x: 84, z: 12, rot: 0, col: 0xe8e8e4 }, { x: 90, z: 20, rot: 0, col: 0x2b2d33 }); K.tree(80, 2, 1); K.tree(96, 24, 1.1); W.vehicleSpots.push({ x: 76, z: 20, rot: 0, type: 'pickup' });
}

// ───────────────────────────── QUADRA FECHADA DO JANDAIA (foto 1) ─────────────────────────────
function jandaia(W, K, P) {
  const T = W.terr; T.paint(-172, -244, -116, -188, CT.DIRT); T.paint(-168, -234, -120, -202, CT.CONCRETE); W.labels.push({ name: 'Quadra do Jandaia', x: -144, z: -218 });
  const x0 = -164, x1 = -124, z0 = -230, z1 = -206, sp = P + 6, rise = 5; W.fp.push([x0, z0, x1, z1, '#8d949a']);
  K.solid(x0, P - 0.6, z0, x1, P + 0.04, z1, L.CONCRETE, 0x6f777c, { top: L.PLAIN, topColor: 0x4f5a62 });
  K.arcRoof(x0 - 0.5, z0 - 0.6, x1 + 0.5, z1 + 0.6, sp, rise, 'x', L.METAL_ROOF, 0x9aa0a6, 0x2e3338, 5);
  // laterais: mureta + pilares, abertas em cima (treliças e vegetação aparecem, como na foto)
  const lw = { l: L.PLASTER, c: 0xdfe0dc };
  K.wall('x', z0, x0, x1, P, P + 2.6, 0.25, lw, [{ a: -150, b: -147, lo: 0, hi: 2.6, k: 'door' }]); K.wall('x', z1, x0, x1, P, P + 2.6, 0.25, lw, [{ a: -141, b: -138, lo: 0, hi: 2.6, k: 'door' }]);
  K.facePanel('x', z0, 0.14, x0, x1, P, P + 1.1, L.PLAIN, 0x1f3f7a, 1, 1); K.facePanel('x', z1, 0.14, x0, x1, P, P + 1.1, L.PLAIN, 0x1f3f7a, 1, 1);
  for (let x = x0; x <= x1; x += 5) for (const z of [z0, z1]) K.solid(x - 0.22, P, z - 0.22, x + 0.22, sp + 0.3, z + 0.22, L.CONCRETE, 0xb9b6ae);
  K.fence('x', z0, x0, x1, P + 2.6, sp); K.fence('x', z1, x0, x1, P + 2.6, sp);
  // oitões: parede baixa com painéis azul-escuros e, acima, cobogó vazado até o arco com fresta de luz no topo
  for (const [x, dir] of [[x0, 1], [x1, -1]]) {
    K.wall('z', x, z0, z1, P, P + 3, 0.3, { l: L.PLASTER, c: 0xe6e4dc }, [{ a: -212.6, b: -209.8, lo: 0, hi: 2.6, k: 'door' }]);
    K.facePanel('z', x, 0.17, z0 + 1, -213.4, P + 0.2, P + 2.6, L.PLAIN, 0x16284a, 1, 1); K.facePanel('z', x, 0.17, -209, z1 - 1, P + 0.2, P + 2.6, L.PLAIN, 0x16284a, 1, 1);
    const n = 12, w = (z1 - z0) / n; for (let i = 0; i < n; i++) { const za = z0 + i * w, zm = za + w / 2, t = (zm - z0) / (z1 - z0); const hTop = sp + Math.sin(Math.PI * t) * rise - 1.1; if (hTop <= P + 3.2) continue; const u0 = za, u1 = za + w; K.bat.quad([x, P + 3, u1], [x, P + 3, u0], [x, hTop, u0], [x, hTop, u1], 1, 0, 0, [u1, P + 3, u0, P + 3, u0, hTop, u1, hTop], L.COBOGO, 0xffffff, false); W.phys.box(x - 0.1, P + 3, u0, x + 0.1, hTop, u1); }
    hoop(K, x + dir * 0.9, P, -223.5, dir); goal(K, x + dir * 2.2, P, -218);
  }
  courtLines(K, x0 + 3, z0 + 3, x1 - 3, z1 - 3, P + 0.05, 0xd8dde0);
  // arquibancada (lado norte) e refletores
  for (let s = 0; s < 3; s++) K.solid(x0 + 6, P, z0 + 0.3 + s * 0.6, x1 - 16, P + 0.45 * (3 - s), z0 + 0.9 + s * 0.6, L.CONCRETE, 0xa8a8a4);
  for (let x = x0 + 5; x < x1; x += 10) for (const z of [-224, -212]) { K.bat.box(x - 0.25, sp + 2.6, z - 0.25, x + 0.25, sp + 2.8, z + 0.25, L.PLAIN, 0xfff3c0, { detail: true, bottom: true, bottomColor: 0xffffff }); }
  W.loot.push({ x: -144, y: P + 0.05, z: -218, tier: 1 }); W.loot.push({ x: -158, y: P + 0.05, z: -210, tier: 1 }); W.crates.push({ x: -128, y: P + 0.05, z: -227, tier: 2 }); W.crates.push({ x: -160, y: P + 0.05, z: -227.4, tier: 1 });
  // vestiário anexo e árvores
  { const a0 = -160, a1 = -148, c0 = -200, c1 = -192, y0 = P + 0.12, y1 = y0 + 3, mm = { l: L.PLASTER, c: 0xdfe0dc, il: L.WALL_TILE, ic: 0xffffff }; K.solid(a0, P - 0.8, c0, a1, y0, c1, L.CONCRETE, 0xaaa69c, { top: L.FLOOR_TILE, topColor: 0xd9d2c2 }); W.fp.push([a0, c0, a1, c1, '#c9c0ae']);
    K.wall('x', c0, a0, a1, y0, y1, 0.22, { ...mm, side: 1 }, [{ a: -155, b: -153.6, lo: 0, hi: 2.2, k: 'door' }]); K.wall('x', c1, a0, a1, y0, y1, 0.22, { ...mm, side: -1 }); K.wall('z', a0, c0, c1, y0, y1, 0.22, { ...mm, side: 1 }); K.wall('z', a1, c0, c1, y0, y1, 0.22, { ...mm, side: -1 }, [{ a: -197, b: -195.6, lo: 0, hi: 2.2, k: 'leaf', c: 0x1f3f7a }]);
    K.slab(a0 - 0.2, c0 - 0.2, a1 + 0.2, c1 + 0.2, y1, y1 + 0.2, L.CONCRETE, 0xb5b1a8); K.prop('locker', -157, y0, -193, 0); K.prop('bench', -152, y0, -196); W.loot.push({ x: -154, y: y0, z: -196, tier: 1 }); }
  for (const [x, z] of [[-170, -240], [-118, -240], [-170, -196], [-120, -194], [-136, -196]]) K.tree(x, z, 1.2);
  buyStation(W, K, -132, -198); W.vehicleSpots.push({ x: -120, z: -214, rot: 0, type: 'jeep' });
}

// ───────────────────────────── PARQUE DO PLANALTO (fotos 9, 10, 11) ─────────────────────────────
function park(W, K, hU, hL) {
  const T = W.terr, PX = (u) => -248 + u, PZ = (v) => 40 + v; W.labels.push({ name: 'Parque do Planalto', x: -180, z: 108 });
  T.paint(PX(0), PZ(0), PX(136), PZ(136), CT.GRASS);
  // caminhos: pista de caminhada asfaltada e passeios de concreto
  T.paint(PX(28), PZ(0), PX(32), PZ(136), CT.LOT); T.paint(PX(0), PZ(68), PX(92), PZ(72), CT.LOT); T.paint(PX(84), PZ(0), PX(88), PZ(136), CT.CONCRETE); T.paint(PX(32), PZ(20), PX(84), PZ(24), CT.CONCRETE); T.paint(PX(88), PZ(120), PX(136), PZ(124), CT.CONCRETE);
  // ginásio/galpão de cobertura em arco cinza com base azul (foto 9)
  { const x0 = PX(8), x1 = PX(48), z0 = PZ(4), z1 = PZ(20); T.paint(x0, z0, x1, z1, CT.COURT); W.fp.push([x0, z0, x1, z1, '#aab0b6']); K.arcRoof(x0 - 0.6, z0 - 0.8, x1 + 0.6, z1 + 0.8, hU + 4.2, 4.2, 'x', L.METAL_ROOF, 0xdfe3e6, 0x5a6066, 8);
    const bw = { l: L.PLASTER, c: 0x2f7fd0 }; K.wall('x', z0, x0, x1, hU, hU + 1.2, 0.25, bw, [{ a: x0 + 10, b: x0 + 13, lo: 0, hi: 1.2, k: 'door' }, { a: x0 + 28, b: x0 + 31, lo: 0, hi: 1.2, k: 'door' }]); K.wall('x', z1, x0, x1, hU, hU + 1.2, 0.25, bw, [{ a: x0 + 18, b: x0 + 22, lo: 0, hi: 1.2, k: 'door' }]); K.wall('z', x0, z0, z1, hU, hU + 4.2, 0.25, { l: L.PLASTER, c: 0xe9eef2 }, [{ a: z0 + 6, b: z0 + 9, lo: 0, hi: 2.6, k: 'door' }]); K.wall('z', x1, z0, z1, hU, hU + 4.2, 0.25, { l: L.PLASTER, c: 0xe9eef2 }, [{ a: z0 + 6, b: z0 + 9, lo: 0, hi: 2.6, k: 'door' }]);
    for (let x = x0; x <= x1; x += 8) for (const z of [z0, z1]) K.solid(x - 0.2, hU, z - 0.2, x + 0.2, hU + 4.3, z + 0.2, L.CONCRETE, 0xcfd3d6);
    courtLines(K, x0 + 2, z0 + 2, x1 - 2, z1 - 2, hU + 0.01); goal(K, x0 + 2.5, hU, (z0 + z1) / 2); goal(K, x1 - 2.5, hU, (z0 + z1) / 2); W.loot.push({ x: x0 + 20, y: hU, z: z0 + 8, tier: 1 }); W.crates.push({ x: x1 - 3, y: hU, z: z1 - 3, tier: 1 }); }
  // prédio azul da administração com a placa (foto 11)
  { const a0 = PX(56), a1 = PX(72), c0 = PZ(4), c1 = PZ(14), y0 = hU + 0.12, y1 = y0 + 3.4, mm = { l: L.PLASTER, c: 0x4a86c8, il: L.PLASTER, ic: 0xf1ede4 }; K.solid(a0, hU - 0.8, c0, a1, y0, c1, L.CONCRETE, 0xaaa69c, { top: L.FLOOR_TILE, topColor: 0xd9d2c2 }); W.fp.push([a0, c0, a1, c1, '#4a86c8']);
    K.wall('x', c1, a0, a1, y0, y1, 0.25, { ...mm, side: -1 }, [{ a: a0 + 6, b: a0 + 8, lo: 0, hi: 2.3, k: 'door' }, { a: a0 + 10, b: a0 + 14, lo: 1, hi: 2.3, k: 'hole' }, { a: a0 + 1.5, b: a0 + 4.5, lo: 1, hi: 2.3, k: 'win' }]); K.wall('x', c0, a0, a1, y0, y1, 0.25, { ...mm, side: 1 }, [{ a: a0 + 2, b: a0 + 3.2, lo: 0, hi: 2.2, k: 'leaf', c: 0xf0f0ec }]); K.wall('z', a0, c0, c1, y0, y1, 0.25, { ...mm, side: 1 }); K.wall('z', a1, c0, c1, y0, y1, 0.25, { ...mm, side: -1 });
    K.slab(a0 - 0.3, c0 - 0.3, a1 + 0.3, c1 + 0.3, y1, y1 + 0.25, L.CONCRETE, 0xe9eef2); W.signs.place('PARQUE DO\nPLANALTO', { bg: '#3f78b8', size: 0.5, cols: 2, rows: 2 }, [a0 + 4, y1 + 0.3, c1 + 0.3], [a0 + 12, y1 + 0.3, c1 + 0.3], [a0 + 12, y1 + 2.5, c1 + 0.3], [a0 + 4, y1 + 2.5, c1 + 0.3]); K.solid(a0 + 4, y1 + 0.25, c1 + 0.1, a0 + 12, y1 + 2.5, c1 + 0.28, L.PLASTER, 0x3f78b8);
    K.prop('desk', a0 + 12, y0, c0 + 3, 0); K.prop('locker', a0 + 3, y0, c0 + 1.2, 0); W.loot.push({ x: a0 + 8, y: y0, z: c0 + 5, tier: 1 }); W.crates.push({ x: a0 + 14.5, y: y0, z: c0 + 8, tier: 1 }); }
  // playground
  { const x0 = PX(6), z0 = PZ(40); T.paint(x0, z0, x0 + 20, z0 + 20, CT.DIRT); const y = hU; const A = (dx, dz, c) => { K.beam([x0 + dx - 1.4, y, z0 + dz - 0.9], [x0 + dx, y + 2.6, z0 + dz], 0.09, L.PLAIN, c); K.beam([x0 + dx + 1.4, y, z0 + dz - 0.9], [x0 + dx, y + 2.6, z0 + dz], 0.09, L.PLAIN, c); };
    A(4, 5, 0xe8c02a); A(4, 9, 0xe8c02a); K.beam([x0 + 4, y + 2.6, z0 + 5], [x0 + 4, y + 2.6, z0 + 9], 0.09, L.PLAIN, 0xd9402a); for (const dz of [6, 7.4]) { K.beam([x0 + 4, y + 2.6, z0 + dz], [x0 + 4, y + 0.6, z0 + dz], 0.03, L.PLAIN, 0x555555); K.bat.box(x0 + 3.75, y + 0.55, z0 + dz - 0.25, x0 + 4.25, y + 0.6, z0 + dz + 0.25, L.PLAIN, 0x2a6fd0, { detail: true, bottom: true }); }
    K.solid(x0 + 11, y + 1.5, z0 + 4, x0 + 14, y + 1.65, z0 + 7, L.WOOD, 0xd9402a); for (const [dx, dz] of [[11.1, 4.1], [13.9, 4.1], [11.1, 6.9], [13.9, 6.9]]) K.solid(x0 + dx - 0.08, y, z0 + dz - 0.08, x0 + dx + 0.08, y + 2.8, z0 + dz + 0.08, L.PLAIN, 0x2a9a4a, { detail: true });
    K.stairs(x0 + 14, z0 + 4.8, x0 + 18, z0 + 6.2, y, y + 1.65, 'x', -1, L.PLAIN, 0x2a6fd0, { solidBase: false }); K.stairs(x0 + 8.5, z0 + 4.8, x0 + 11, z0 + 6.2, y, y + 1.65, 'x', 1, L.WOOD, 0xb08a60);
    K.shape('pyr', x0 + 12.5, y + 3.5, z0 + 5.5, 2.4, 1.2, 2.4, L.PLAIN, 0xe8c02a, true, 0, Math.PI / 4); K.prop('bench', x0 + 9, y, z0 + 16); K.prop('bench', x0 + 14, y, z0 + 16); }
  // parque aquático no centro: piscina rasa amarela, balde laranja em postes verdes, gradil (foto 11)
  { const x0 = PX(44), x1 = PX(80), z0 = PZ(28), z1 = PZ(64), y = hU; T.paint(x0, z0, x1, z1, CT.CONCRETE); T.paint(x0 + 4, z0 + 4, x1 - 4, z1 - 4, CT.WATER);
    K.fence('x', z0, x0, x1, y, y + 1.7); K.fence('x', z1, x0, x1 - 6, y, y + 1.7); K.fence('z', x0, z0, z1 - 5, y, y + 1.7); K.fence('z', x1, z0 + 5, z1, y, y + 1.7);
    const rim = (a, bq, c, d) => K.solid(a, y - 0.2, bq, c, y + 0.35, d, L.PLASTER, 0xf2f4f6, { top: L.PLAIN, topColor: 0x3f8fd0 }); rim(x0 + 3.4, z0 + 3.4, x1 - 3.4, z0 + 4); rim(x0 + 3.4, z1 - 4, x1 - 3.4, z1 - 3.4); rim(x0 + 3.4, z0 + 4, x0 + 4, z1 - 4); rim(x1 - 4, z0 + 4, x1 - 3.4, z1 - 4);
    const cx = (x0 + x1) / 2 + 2, cz = (z0 + z1) / 2; const post = (dx, dz, hgt, c = 0x1f9a6a) => { K.shape('cyl8', cx + dx, y + hgt / 2, cz + dz, 0.11, hgt, 0.11, L.PLAIN, c, false); W.phys.box(cx + dx - 0.12, y, cz + dz - 0.12, cx + dx + 0.12, y + hgt, cz + dz + 0.12); };
    post(-2.2, -1.6, 5); post(2.2, -1.6, 6.4); post(-2.2, 1.6, 5); post(2.2, 1.6, 6.4); post(-5.5, 0.5, 3.4, 0xe8c02a); post(-7.2, 0.5, 3.4, 0x1f9a6a);
    K.beam([cx - 2.2, y + 5, cz - 1.6], [cx + 2.2, y + 5, cz - 1.6], 0.1, L.PLAIN, 0x1f9a6a); K.beam([cx - 2.2, y + 5, cz + 1.6], [cx + 2.2, y + 5, cz + 1.6], 0.1, L.PLAIN, 0x1f9a6a); K.beam([cx - 5.5, y + 3.4, cz + 0.5], [cx - 7.2, y + 3.4, cz + 0.5], 0.1, L.PLAIN, 0xe8c02a);
    K.shape('pyr', cx - 0.8, y + 4.4, cz, 2.6, 1.0, 2.6, L.PLAIN, 0xe2622a, false, Math.PI, Math.PI / 4); for (const [dx, dz] of [[-2.2, -1.6], [-2.2, 1.6], [0.2, -1.6]]) K.shape('ico', cx + dx, y + 5.15, cz + dz, 0.22, 0.22, 0.22, L.PLAIN, 0xe2622a, true);
    K.shape('cyl12', cx + 2.2, y + 7.2, cz, 1.0, 1.9, 1.0, L.PLAIN, 0xe2622a, false, 0.25, 0, 0); K.beam([cx + 2.2, y + 6.3, cz - 1.6], [cx + 2.2, y + 6.3, cz + 1.6], 0.1, L.PLAIN, 0x1f9a6a);
    K.stairs(cx - 9.5, cz - 5, cx - 6.5, cz - 4, y + 0.1, y + 1.4, 'x', 1, L.PLAIN, 0x2a6fd0); post(-6.4, -4.5, 1.4, 0x2a6fd0);
    W.loot.push({ x: cx, y, z: cz + 5, tier: 1 }); W.loot.push({ x: x0 + 2, y, z: z0 + 2, tier: 0 }); W.crates.push({ x: x1 - 2, y, z: z0 + 2, tier: 1 }); }
  // quatro quadras azuis e verdes em fila, em dois patamares (foto 10)
  { const x0 = PX(92), x1 = PX(120); const cs = [[44, 59, hU], [61, 76, hU], [84, 99, hL], [101, 116, hL]];
    cs.forEach(([a, c, y], i) => { const z0 = PZ(a), z1 = PZ(c); T.paint(x0 - 2, z0 - 2, x1 + 2, z1 + 2, CT.COURT); courtLines(K, x0, z0, x1, z1, y + 0.01);
      for (const [gx, d] of [[x0 + 0.4, 1], [x1 - 0.4, -1]]) { K.bat.box(Math.min(gx, gx + d * 5.6), y + 0.006, (z0 + z1) / 2 - 2.6, Math.max(gx, gx + d * 5.6), y + 0.012, (z0 + z1) / 2 + 2.6, L.PLAIN, 0x3fae5a, { detail: true, skip: 1 | 2 | 16 | 32 }); goal(K, gx + d * 0.3, y, (z0 + z1) / 2); hoop(K, gx - d * 0.2, y, (z0 + z1) / 2 + (i % 2 ? 4 : -4), d); }
      if (i % 2 === 0) W.loot.push({ x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, tier: 0 }); });
    for (const [a, c, y] of [[42, 78, hU], [82, 118, hL]]) { K.fence('z', x0 - 2, PZ(a), PZ(c) - 5, y, y + 4); K.fence('z', x1 + 2, PZ(a) + 5, PZ(c), y, y + 4); K.fence('x', PZ(a), x0 - 2, x1 - 4, y, y + 4); K.fence('x', PZ(c), x0 + 4, x1 + 2, y, y + 4); }
    for (const [x, z] of [[x0 - 3, PZ(60)], [x1 + 3, PZ(60)], [x0 - 3, PZ(100)], [x1 + 3, PZ(100)]]) { const y = T.height(x, z); K.shape('cyl6', x, y + 5, z, 0.1, 10, 0.1, L.PLAIN, 0x9aa0a6, false); K.bat.box(x - 0.5, y + 9.8, z - 0.2, x + 0.5, y + 10.1, z + 0.2, L.PLAIN, 0xfff3c0, { detail: true }); W.phys.box(x - 0.1, y, z - 0.1, x + 0.1, y + 10, z + 0.1); }
    // escadas no barranco entre os patamares
    for (const x of [PX(88.5), PX(124)]) for (let s = 0; s < 8; s++) { const z = PZ(77) + s * 0.8, y = T.height(x, z + 0.4); K.bat.box(x - 1.2, y - 0.3, z, x + 1.2, y + 0.06, z + 0.8, L.CONCRETE, 0xb9b6ae, { detail: true }); } }
  // entrada nordeste: pracinha, loja e vagas
  T.paint(PX(92), PZ(4), PX(128), PZ(36), CT.CONCRETE); for (const [u, v] of [[98, 10], [110, 10], [122, 10], [104, 30], [118, 30]]) K.tree(PX(u), PZ(v), 1); K.prop('bench', PX(104), hU, PZ(18)); K.prop('bench', PX(116), hU, PZ(18)); buyStation(W, K, PX(110), PZ(24));
  // campo sintético, mais afastado (sudoeste) (foto 10 ao fundo)
  { const x0 = PX(6), x1 = PX(62), z0 = PZ(92), z1 = PZ(130), y = hL; T.paint(x0 - 2, z0 - 2, x1 + 2, z1 + 2, CT.TURF); courtLines(K, x0, z0, x1, z1, y + 0.015); goal(K, x0 + 0.3, y, (z0 + z1) / 2, 'x', 5); goal(K, x1 - 0.3, y, (z0 + z1) / 2, 'x', 5);
    K.fence('x', z0 - 2, x0 - 2, x1 - 6, y, y + 4); K.fence('x', z1 + 2, x0 + 6, x1 + 2, y, y + 4); K.fence('z', x0 - 2, z0 - 2, z1 + 2, y, y + 4); K.fence('z', x1 + 2, z0 + 4, z1 - 4, y, y + 4);
    for (let s = 0; s < 3; s++) K.solid(x0 + 10, y, z0 - 4.6 + s * 0.7, x1 - 10, y + 0.4 * (3 - s), z0 - 3.9 + s * 0.7, L.CONCRETE, 0x3f8fd0); W.loot.push({ x: (x0 + x1) / 2, y, z: (z0 + z1) / 2, tier: 1 }); W.crates.push({ x: x0 + 1, y, z: z1 - 1, tier: 1 }); W.vehicleSpots.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2 + 8, rot: 0, type: 'heli' }); }
  // pista de skate azul com a pintura circular colorida (foto 9, embaixo)
  { const x0 = PX(66), x1 = PX(86), z0 = PZ(86), z1 = PZ(106), y = hL; T.paint(x0, z0, x1 - 2, z1, CT.COURT); const cx = x0 + 9, cz = z0 + 10; [[6, 0x2f7fd0], [4.6, 0xd9402a], [3.6, 0xf08a2a], [2.7, 0xf2d43a], [1.8, 0x4aa84a], [0.9, 0x222428]].forEach(([r, c], i) => K.shape('cyl12', cx, y + 0.012 + i * 0.004, cz, r, 0.01, r, L.PLAIN, c, true));
    K.stairs(x0 + 0.5, z0 + 1, x0 + 3.5, z0 + 5, y, y + 1.2, 'x', -1, L.PLAIN, 0x3f8fd0, { solidBase: true }); K.stairs(x1 - 5.5, z1 - 5, x1 - 2.5, z1 - 1, y, y + 1.2, 'x', 1, L.PLAIN, 0x3f8fd0, { solidBase: true }); K.solid(x0 + 12, y, z0 + 16, x0 + 16, y + 0.45, z0 + 17, L.CONCRETE, 0xb9b6ae); W.loot.push({ x: cx, y, z: cz, tier: 1 }); }
  // campinho de terra (foto 10, à direita)
  { const x0 = PX(66), x1 = PX(126), z0 = PZ(112), z1 = PZ(132); T.paint(x0, z0, x1, z1, CT.DIRT); goal(K, x0 + 1, hL, (z0 + z1) / 2, 'x', 4); goal(K, x1 - 1, hL, (z0 + z1) / 2, 'x', 4); W.vehicleSpots.push({ x: x1 - 8, z: z1 - 4, rot: Math.PI / 2, type: 'jeep' }); }
  // mureta azul e branca no perímetro, com entradas
  const yw = (x, z) => T.height(x, z); for (let u = 2; u < 134; u += 8) { for (const [x, z, ax] of [[PX(u), PZ(1), 'x'], [PX(u), PZ(135), 'x'], [PX(1), PZ(u), 'z'], [PX(135), PZ(u), 'z']]) { if ((u > 26 && u < 36) || (u > 82 && u < 92) || (u > 64 && u < 74)) continue; const y = yw(x + (ax === 'x' ? 4 : 0), z + (ax === 'z' ? 4 : 0)); if (ax === 'x') K.solid(x, y - 0.6, z - 0.12, x + 8, y + 0.9, z + 0.12, L.PLASTER, (u / 8) % 2 ? 0x3f8fd0 : 0xf2f4f6, { detail: true }); else K.solid(x - 0.12, y - 0.6, z, x + 0.12, y + 0.9, z + 8, L.PLASTER, (u / 8) % 2 ? 0x3f8fd0 : 0xf2f4f6, { detail: true }); } }
  const rng = W.rng; for (let i = 0; i < 46; i++) { const u = 3 + rng() * 130, v = 3 + rng() * 130, x = PX(u), z = PZ(v); if (T.type(x, z) !== CT.GRASS || T.type(x + 3, z) !== CT.GRASS || T.type(x - 3, z - 3) !== CT.GRASS) continue; K.tree(x, z, 0.9 + rng() * 0.6, rng() < 0.12 ? 1 : 0); }
  for (const [u, v] of [[30, 34], [30, 60], [30, 100], [60, 70], [86, 40], [86, 110]]) K.pole(PX(u) + 2.6, PZ(v), true, 1);
  for (const [u, v] of [[36, 74], [50, 74], [70, 74], [24, 30]]) K.prop('bench', PX(u), T.height(PX(u), PZ(v)), PZ(v));
}

// ───────────────────────────── SEDE OFICIAL DO TIME ─────────────────────────────
function hq(W, K, P) {
  const T = W.terr; T.paint(-28, -28, 28, 28, CT.CONCRETE); W.labels.push({ name: 'Sede do Time', x: 0, z: 2 });
  const X0 = -24, X1 = 24, Z0 = -18, Z1 = 24, F = P + 0.2, H = 3.6, F2 = F + H + 0.25, top = F2 + H; W.fp.push([X0, Z0, X1, Z1, '#2b2f36']);
  const ext = { l: L.PLASTER, c: 0x2b2f36, il: L.PLASTER, ic: 0xecebe6 }, inn = { l: L.PLASTER, c: 0xecebe6 }, th = 0.3, it = 0.18; const GOLD = 0xd9a520;
  K.solid(X0, P - 1, Z0, X1, F, Z1, L.CONCRETE, 0x8f8f8c, { top: L.FLOOR_TILE, topColor: 0xe9e4d8 });
  // bloco frontal (2 pavimentos): equipamentos | recepção | administração; em cima: convivência
  K.wall('x', Z0 + th / 2, X0, X1, F, top + 0.9, th, { ...ext, side: 1 }, [{ a: -3, b: 1, lo: 0, hi: 2.8, k: 'door' }, { a: -9, b: -4, lo: 0.9, hi: 2.6, k: 'glass' }, { a: 2, b: 7, lo: 0.9, hi: 2.6, k: 'glass' }, { a: 11, b: 15, lo: 1, hi: 2.4, k: 'win', one: 1 }, { a: 17, b: 21, lo: 1, hi: 2.4, k: 'hole' }, { a: -21, b: -17, lo: 1.4, hi: 2.4, k: 'bars' }, { a: -20, b: -12, lo: 4.9, hi: 6.5, k: 'hole' }, { a: -6, b: 6, lo: 4.9, hi: 6.5, k: 'glass' }, { a: 12, b: 20, lo: 4.9, hi: 6.5, k: 'win', one: 1 }]);
  K.wall('z', X0 + th / 2, Z0, Z1, F, top + 0.9, th, { ...ext, side: 1 }, [{ a: 8, b: 10, lo: 1.6, hi: 2.4, k: 'win', one: 1 }, { a: 14, b: 16, lo: 1.6, hi: 2.4, k: 'win', one: 1 }, { a: -0.5, b: 1, lo: 0, hi: 2.2, k: 'leaf', c: 0x8a6d1a }]);
  K.wall('z', X1 - th / 2, Z0, Z1, F, top + 0.9, th, { ...ext, side: -1 }, [{ a: 9, b: 12, lo: 0, hi: 2.8, k: 'door' }, { a: -14, b: -10, lo: 1, hi: 2.4, k: 'win', one: 1 }]);
  K.wall('x', Z1 - th / 2, X0, X1, F, top + 0.9, th, { ...ext, side: -1 }, [{ a: 6, b: 9, lo: 0, hi: 2.6, k: 'door' }, { a: -20, b: -18.6, lo: 0, hi: 2.2, k: 'leaf', c: 0x8a6d1a }]);
  // faixa dourada e letreiro (espaço reservado para a logo oficial)
  K.facePanel('x', Z0, 0.02, X0, X1, F + 3.3, F + 3.75, L.PLAIN, GOLD, 1, 1, -1); K.facePanel('x', Z0, 0.02, X0, X1, top + 0.3, top + 0.6, L.PLAIN, GOLD, 1, 1, -1);
  K.solid(-9.2, F + 3.9, Z0 - 0.45, 9.2, top + 2.4, Z0, L.PLASTER, 0x15171b);
  W.signs.place('SEDE OFICIAL', { bg: '#15171b', color: '#e8b830', size: 0.2, cy: 0.86, cols: 4, rows: 3, draw: (c, w, h) => { c.save(); c.translate(w / 2, h * 0.4); const s = h * 0.33; c.fillStyle = '#e8b830'; c.beginPath(); c.moveTo(-s * 0.8, -s); c.lineTo(s * 0.8, -s); c.lineTo(s * 0.8, s * 0.2); c.quadraticCurveTo(s * 0.7, s * 0.9, 0, s * 1.1); c.quadraticCurveTo(-s * 0.7, s * 0.9, -s * 0.8, s * 0.2); c.closePath(); c.fill(); c.fillStyle = '#15171b'; c.beginPath(); c.moveTo(-s * 0.66, -s * 0.86); c.lineTo(s * 0.66, -s * 0.86); c.lineTo(s * 0.66, s * 0.16); c.quadraticCurveTo(s * 0.58, s * 0.76, 0, s * 0.94); c.quadraticCurveTo(-s * 0.58, s * 0.76, -s * 0.66, s * 0.16); c.closePath(); c.fill(); c.fillStyle = '#e8b830'; c.font = `900 ${s * 0.3}px Arial`; c.textAlign = 'center'; c.fillText('SUA LOGO', 0, -s * 0.2); c.fillText('AQUI', 0, s * 0.2); c.restore(); } }, [9, F + 4, Z0 - 0.47], [-9, F + 4, Z0 - 0.47], [-9, top + 2.3, Z0 - 0.47], [9, top + 2.3, Z0 - 0.47]);
  K.solid(-5, F + 2.9, Z0 - 3, 3, F + 3.1, Z0, L.PLAIN, 0x15171b, { bottom: true, bottomColor: GOLD }); for (const x of [-4.7, 2.7]) K.solid(x - 0.12, P, Z0 - 2.9, x + 0.12, F + 2.9, Z0 - 2.66, L.PLAIN, GOLD);
  // divisórias do térreo
  K.wall('x', -6, X0 + th, X1 - th, F, F2 - 0.25, it, inn, [{ a: -18, b: -16.6, lo: 0, hi: 2.2, k: 'leaf', c: 0x3a3d42 }, { a: -2, b: 0.4, lo: 0, hi: 2.4, k: 'door' }, { a: 12, b: 13.4, lo: 0, hi: 2.2, k: 'door' }]);
  K.wall('z', -10, Z0 + th, -6, F, F2 - 0.25, it, inn); K.wall('z', 8, Z0 + th, -6, F, F2 - 0.25, it, inn, [{ a: -12, b: -10.6, lo: 0, hi: 2.2, k: 'door' }]);
  K.wall('x', -3, X0 + th, 14, F, F2 - 0.25, it, inn, [{ a: -16, b: -14.6, lo: 0, hi: 2.2, k: 'door' }, { a: -1, b: 3, lo: 0, hi: 2.6, k: 'door' }, { a: 5, b: 11, lo: 1, hi: 2.5, k: 'glass' }]);
  // ala oeste: vestiário (armários) | banheiros | chuveiros | uniformes
  const tile = { l: L.WALL_TILE, c: 0xffffff }; K.wall('z', -8, -3, Z1 - th, F, F + 3.4, it, tile, [{ a: 1, b: 2.4, lo: 0, hi: 2.2, k: 'door' }, { a: 16, b: 17.4, lo: 0, hi: 2.2, k: 'door' }, { a: 21, b: 22.4, lo: 0, hi: 2.2, k: 'leaf', c: 0x8a6d1a }]);
  K.wall('x', 6, X0 + th, -8, F, F + 3.4, it, tile, [{ a: -12, b: -10.6, lo: 0, hi: 2.2, k: 'door' }]); K.wall('x', 13, X0 + th, -8, F, F + 3.4, it, tile, [{ a: -22, b: -20.6, lo: 0, hi: 2.2, k: 'door' }]); K.wall('x', 20, X0 + th, -8, F, F + 3.4, it, tile, [{ a: -14, b: -12.6, lo: 0, hi: 2.2, k: 'door' }]);
  K.slab(X0 + th, -3, -8, Z1 - th, F + 3.4, F + 3.6, L.CONCRETE, 0xb5b1a8);
  K.prop('locker', -21, F, -2.4, 0, GOLD); K.prop('locker', -18.4, F, -2.4, 0, 0x2b2f36); K.prop('locker', -15.8, F, -2.4, 0, GOLD); K.prop('locker', -23.4, F, 2.5, 1, 0x2b2f36); K.prop('bench', -16, F, 2.5); K.prop('bench', -12, F, 2.5);
  for (let i = 0; i < 3; i++) { K.prop('toilet', -23, F, 7 + i * 1.8, 1); if (i) K.wall('x', 6.1 + i * 1.8, X0 + th, -21.6, F, F + 2, 0.06, tile, [], { detail: true }); } K.prop('sink', -10, F, 9.5, 1); K.prop('sink', -10, F, 11.5, 1);
  for (let i = 0; i < 4; i++) { K.wall('z', -21.5 + i * 3, 16.5, 20, F, F + 2.1, 0.08, tile, [], { detail: true }); K.bat.box(-23 + i * 3 - 0.06, F + 2.1, 19.6, -23 + i * 3 + 0.06, F + 2.2, 19.9, L.PLAIN, 0xb8bec2, { detail: true }); }
  K.prop('rack', -20, F, 22, 0, GOLD); K.prop('rack', -16, F, 22, 0, 0x2b2f36); K.prop('rack', -12, F, 22, 0, 0xf2f2ee); K.prop('shelf', -10.2, F, 22.6, 0);
  // equipamentos (arsenal) | recepção | administração
  K.prop('locker', -22.6, F, -14, 1, 0x3a3d42); K.prop('shelf', -17, F, -17, 0); K.prop('crate2', -12, F, -8); K.prop('crate', -12, F, -16.6); K.prop('table', -17, F, -11, 0);
  K.prop('counter', -1, F, -11, 0, 0x2b2f36); K.prop('sofa', 5, F, -8, 0, 0x2b2f36); K.prop('sofa', -7.5, F, -9, 1, GOLD); K.prop('planter', 6.6, F, -16.6); K.prop('shelf', -8.6, F, -15, 1, GOLD);
  K.prop('desk', 12, F, -14, 0); K.prop('desk', 18, F, -14, 0); K.prop('desk', 15, F, -9, 0); K.prop('shelf', 22.6, F, -11, 1);
  W.crates.push({ x: -20, y: F, z: -9, tier: 2 }, { x: -14, y: F, z: -14, tier: 2 }, { x: 21, y: F, z: -16.5, tier: 1 }, { x: -22, y: F, z: 22.6, tier: 1 });
  W.loot.push({ x: -17, y: F, z: -13.5, tier: 2 }, { x: -1, y: F, z: -8, tier: 1 }, { x: 15, y: F, z: -12, tier: 1 }, { x: -18, y: F, z: 0, tier: 1 }, { x: -14, y: F, z: 16, tier: 0 }, { x: -16, y: F, z: 9, tier: 0 });
  // 2º piso: área de convivência com vista para a quadra
  K.slab(X0 + th, Z0 + th, X1 - th, -3, F2 - 0.25, F2, L.WOOD, 0xa88a66, [[14, -5.9, 22, -3.3]]);
  K.stairs(14, -5.9, 22, -3.3, F, F2, 'x', 1, L.CONCRETE, 0xb5b1a8, { structural: true, rail: true });
  K.wall('x', -3, X0 + th, X1 - th, F2, top, it, inn, [{ a: -6, b: 10, lo: 1, hi: 2.6, k: 'hole' }]); K.solid(14, F2, -3.4, 22, F2 + 1.0, -3.3, L.PLAIN, 0x8f979c, { detail: true }); K.solid(14, F2, -6.0, 22, F2 + 1.0, -5.9, L.PLAIN, 0x8f979c, { detail: true }); K.solid(13.9, F2, -5.9, 14, F2 + 1.0, -3.3, L.PLAIN, 0x8f979c, { detail: true });
  K.wall('z', -8, Z0 + th, -3, F2, top, it, inn, [{ a: -9, b: -7.4, lo: 0, hi: 2.2, k: 'door' }]);
  K.slab(X0, Z0, X1, -3 + it, top, top + 0.25, L.CONCRETE, 0x9a9a98);
  K.prop('sofa', -2, F2, -15, 0, GOLD); K.prop('sofa', 4, F2, -15, 0, 0x2b2f36); K.prop('table', 1, F2, -11, 0); K.prop('foodtable', 8, F2, -8, 0, GOLD); K.prop('foodtable', -4, F2, -7.5, 1, GOLD); K.prop('counter', -16, F2, -8, 0, 0x2b2f36); K.prop('shelf', -22.8, F2, -12, 1, GOLD); K.prop('bed', -12, F2, -15.5, 0);
  W.signs.place('RESENHA', { bg: '#15171b', color: '#e8b830', size: 0.6 }, [-3, F2 + 2.2, Z0 + th + 0.02], [3, F2 + 2.2, Z0 + th + 0.02], [3, F2 + 3.2, Z0 + th + 0.02], [-3, F2 + 3.2, Z0 + th + 0.02]);
  W.crates.push({ x: 20, y: F2, z: -15, tier: 2 }, { x: -20, y: F2, z: -6, tier: 2 }); W.loot.push({ x: 0, y: F2, z: -8, tier: 1 }, { x: -15, y: F2, z: -12, tier: 2 });
  // quadra interna (pé-direito duplo) com cobertura em arco e arquibancada
  { const x0 = -8, x1 = X1, z0 = -3, z1 = Z1; K.bat.box(x0 + 0.1, F, z0 + 0.1, x1 - th, F + 0.02, z1 - th, L.PLAIN, 0x2f6f9f, { detail: false, skip: 1 | 2 | 16 | 32 }); K.arcRoof(x0 - 0.2, z0, x1 + 0.2, z1 + 0.2, top + 0.6, 3.2, 'z', L.METAL_ROOF, 0xd9dde0, 0x15171b, 6.5);
    courtLines(K, x0 + 2.2, z0 + 2, x1 - 5, z1 - 2, F + 0.03, 0xf2f2ee); hoop(K, (x0 + x1) / 2 - 1.5, F, z0 + 1.2, 1, 'z'); hoop(K, (x0 + x1) / 2 - 1.5, F, z1 - 1.2, -1, 'z'); goal(K, (x0 + x1) / 2 - 1.5, F, z0 + 2.4, 'z'); goal(K, (x0 + x1) / 2 - 1.5, F, z1 - 2.4, 'z');
    for (let s = 0; s < 3; s++) K.solid(x1 - th - 0.9 * (s + 1) - 0.2, F, z0 + 1, x1 - th - 0.9 * s - 0.2, F + 0.45 * (3 - s) - (s === 0 ? 0 : 0), 8, L.CONCRETE, s % 2 ? GOLD : 0x2b2f36);
    W.signs.place('RAÇA • UNIÃO • QUEBRADA', { bg: '#15171b', color: '#e8b830', size: 0.5, cols: 4 }, [x0 + 0.12, F + 4.6, z1 - 3], [x0 + 0.12, F + 4.6, z0 + 6], [x0 + 0.12, F + 6, z0 + 6], [x0 + 0.12, F + 6, z1 - 3]);
    K.wall('z', x0, 0, Z1 - th, F + 3.6, top + 0.6, 0.2, inn); W.loot.push({ x: 6, y: F, z: 10, tier: 1 }, { x: 18, y: F, z: 20, tier: 1 }); W.crates.push({ x: -5, y: F, z: 21.5, tier: 1 }); }
  // área externa: escada, mastros, bancos, vagas e loja
  K.stairs(-4, Z0 - 0.8, 2, Z0, P, F, 'z', 1, L.CONCRETE, 0xb5b1a8, { solidBase: true }); K.stairs(X1, 9, X1 + 0.8, 12, P, F, 'x', -1, L.CONCRETE, 0xb5b1a8, { solidBase: true }); K.stairs(6, Z1, 9, Z1 + 0.8, P, F, 'z', -1, L.CONCRETE, 0xb5b1a8, { solidBase: true });
  for (const [x, c] of [[-14, GOLD], [-11.5, 0x15171b], [11.5, 0x15171b], [14, GOLD]]) { K.shape('cyl6', x, P + 4.5, Z0 - 6, 0.06, 9, 0.06, L.PLAIN, 0xb8bec2, false); K.bat.box(x + 0.06, P + 7.6, Z0 - 6.02, x + 1.5, P + 8.6, Z0 - 5.98, L.PLAIN, c, { detail: true }); }
  K.prop('bench', -18, P, Z0 - 4); K.prop('bench', 18, P, Z0 - 4); K.prop('planter', -8, P, Z0 - 5); K.prop('planter', 6, P, Z0 - 5); K.tree(-25, -25, 0.9, 1); K.tree(25, -25, 0.9, 1); K.tree(26, 26, 1);
  buyStation(W, K, 22, Z0 - 5); W.vehicleSpots.push({ x: -26.5, z: 10, rot: 0, type: 'armored' }); W.parked.push({ x: 26.6, z: -6, rot: 0, col: 0x15171b });
}

// ───────────────────────────── PRAÇA CENTRAL ─────────────────────────────
function praca(W, K, P) {
  const T = W.terr; T.paint(-28, -100, 28, -44, CT.GRASS); T.paint(-4, -100, 4, -44, CT.CONCRETE); T.paint(-28, -76, 28, -68, CT.CONCRETE); T.paint(-12, -84, 12, -60, CT.CONCRETE); W.labels.push({ name: 'Praça', x: 0, z: -72 });
  K.shape('cyl12', 0, P + 0.35, -72, 4.2, 0.7, 4.2, L.CONCRETE, 0xc9c5bb, false); K.shape('cyl12', 0, P + 0.72, -72, 3.8, 0.04, 3.8, L.WATER, 0x7fc4e0, true); K.shape('cyl8', 0, P + 1.4, -72, 0.5, 1.6, 0.5, L.CONCRETE, 0xc9c5bb, false); K.shape('cyl12', 0, P + 2.2, -72, 1.4, 0.2, 1.4, L.CONCRETE, 0xc9c5bb, false); W.phys.box(-3.8, P, -75.8, 3.8, P + 0.7, -68.2); W.phys.box(-0.6, P, -72.6, 0.6, P + 2.3, -71.4);
  // coreto
  { const cx = -18, cz = -90; K.shape('cyl8', cx, P + 0.4, cz, 4, 0.8, 4, L.CONCRETE, 0xd9d5cc, false); W.phys.box(cx - 3.4, P, cz - 3.4, cx + 3.4, P + 0.8, cz + 3.4); for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283; K.shape('cyl6', cx + Math.cos(a) * 3.3, P + 2.3, cz + Math.sin(a) * 3.3, 0.1, 3, 0.1, L.PLAIN, 0x2a6f4a, false); } K.shape('cone', cx, P + 4.6, cz, 4.4, 1.6, 4.4, L.ROOF_TILE, 0xffffff, false, 0, 0, 0, 3); W.phys.box(cx - 3, P + 3.8, cz - 3, cx + 3, P + 4.4, cz + 3); K.stairs(cx + 3.4, cz - 1, cx + 5, cz + 1, P, P + 0.8, 'x', -1); W.loot.push({ x: cx, y: P + 0.8, z: cz, tier: 1 }); }
  // barracas de feira (cobertura)
  [[14, -92, 0xd9402a], [20, -92, 0x2a6fd0], [14, -54, 0xe8c02a], [-18, -54, 0x2a9a4a], [-12, -54, 0xd9402a]].forEach(([x, z, c]) => { K.prop('counter', x, P, z, 0, 0xb08a60); for (const dx of [-1.5, 1.5]) K.solid(x + dx - 0.05, P, z - 1.05, x + dx + 0.05, P + 2.3, z - 0.95, L.PLAIN, 0x8f979c, { detail: true }); K.bat.box(x - 1.8, P + 2.3, z - 1.4, x + 1.8, P + 2.4, z + 1, L.PLAIN, c, { detail: true, bottom: true }); W.loot.push({ x, y: P, z: z + 1.4, tier: 0 }); });
  for (const [x, z] of [[-6, -80], [6, -80], [-6, -64], [6, -64]]) K.prop('bench', x, P, z, 1); for (const [x, z] of [[-22, -62], [22, -62], [22, -82], [-10, -96], [10, -48], [-24, -48], [24, -96]]) K.tree(x, z, 1.25);
  K.solid(11, P, -73, 12.2, P + 1.3, -71, L.CONCRETE, 0xb9b6ae); K.shape('ico1', 11.6, P + 1.9, -72, 0.45, 0.6, 0.45, L.PLAIN, 0x6a5a40, true);
  buyStation(W, K, -8, -58); W.crates.push({ x: 8, y: P, z: -90, tier: 1 }); W.vehicleSpots.push({ x: 25, z: -72, rot: 0, type: 'car' });
}

// ───────────────────────────── GALPÕES ─────────────────────────────
function galpoes(W, K, P) {
  const T = W.terr; T.paint(188, -244, 244, -116, CT.LOT); W.labels.push({ name: 'Galpões', x: 216, z: -180 });
  { const x0 = 192, x1 = 240, z0 = -240, z1 = -208; W.fp.push([x0, z0, x1, z1, '#8d949a']); const m = { l: L.SHUTTER, c: 0xbfc6cb, il: L.SHUTTER, ic: 0x9aa0a6 };
    K.wall('x', z1, x0, x1, P, P + 7, 0.3, { ...m, side: -1 }, [{ a: 204, b: 212, lo: 0, hi: 5, k: 'door' }, { a: 226, b: 232, lo: 0, hi: 5, k: 'shut' }]); K.wall('x', z0, x0, x1, P, P + 7, 0.3, { ...m, side: 1 }, [{ a: 234, b: 235.4, lo: 0, hi: 2.2, k: 'leaf', c: 0x6d7378 }]); K.wall('z', x0, z0, z1, P, P + 7, 0.3, { ...m, side: 1 }, [{ a: -226, b: -222, lo: 0, hi: 4, k: 'door' }]); K.wall('z', x1, z0, z1, P, P + 7, 0.3, { ...m, side: -1 });
    K.arcRoof(x0 - 0.4, z0 - 0.4, x1 + 0.4, z1 + 0.4, P + 7, 5, 'x', L.METAL_ROOF, 0xc9cdd0, 0x4a4f55, 8);
    K.prop('container', 200, P, -234, 0, 0x8a3a2a); K.prop('container', 200, P, -230.6, 0, 0x2f6b8f); K.prop('container', 228, P, -236, 0, 0x3a7a4a); for (let i = 0; i < 4; i++) K.prop('shelf', 216 + i * 3, P, -226, 1); K.prop('crate2', 236, P, -214); K.prop('crate2', 234.4, P, -214); K.prop('crate', 196, P, -212); K.prop('barrel', 197.6, P, -214); K.prop('barrel', 222, P, -212);
    // mezanino metálico
    K.slab(x0 + 0.3, z0 + 0.3, 212, -230, P + 3.4, P + 3.6, L.PLAIN, 0x6d7378, [], { side: L.PLAIN, sideColor: 0x4a4f55 }); for (const [x, z] of [[211.6, -230.4], [202, -230.4]]) K.solid(x - 0.12, P, z - 0.12, x + 0.12, P + 3.4, z + 0.12, L.PLAIN, 0x4a4f55); K.stairs(212, -233, 219, -231.4, P, P + 3.6, 'x', -1, L.PLAIN, 0x6d7378, { rail: true });
    W.crates.push({ x: 196, y: P + 3.6, z: -236, tier: 2 }, { x: 236, y: P, z: -228, tier: 2 }, { x: 214, y: P, z: -236, tier: 2 }); W.loot.push({ x: 208, y: P, z: -218, tier: 2 }, { x: 224, y: P, z: -220, tier: 1 }, { x: 204, y: P + 3.6, z: -235, tier: 2 }); }
  { const x0 = 192, x1 = 240, z0 = -192, z1 = -164; W.fp.push([x0, z0, x1, z1, '#8d949a']); const m = { l: L.BRICK, c: 0xffffff, il: L.PLASTER, ic: 0xdcd8ce };
    K.wall('x', z0, x0, x1, P, P + 6, 0.3, { ...m, side: 1 }, [{ a: 212, b: 220, lo: 0, hi: 4.6, k: 'door' }]); K.wall('x', z1, x0, x1, P, P + 6, 0.3, { ...m, side: -1 }, [{ a: 196, b: 202, lo: 0, hi: 4.4, k: 'shut' }, { a: 228, b: 234, lo: 0, hi: 4.4, k: 'door' }]); K.wall('z', x0, z0, z1, P, P + 6, 0.3, { ...m, side: 1 }, [{ a: -180, b: -176, lo: 1.4, hi: 3, k: 'hole' }]); K.wall('z', x1, z0, z1, P, P + 6, 0.3, { ...m, side: -1 }, [{ a: -186, b: -184.6, lo: 0, hi: 2.2, k: 'door' }]);
    K.gable(x0, z0, x1, z1, P + 6, 3.4, 'x', L.METAL_ROOF, 0xb9bdc0, 0.5); K.wall('x', -178, 216, x1 - 0.3, P, P + 3.2, 0.2, { l: L.PLASTER, c: 0xdcd8ce }, [{ a: 222, b: 223.4, lo: 0, hi: 2.2, k: 'door' }]); K.wall('z', 216, -178, z1 - 0.3, P, P + 3.2, 0.2, { l: L.PLASTER, c: 0xdcd8ce }); K.slab(216, -178, x1 - 0.3, z1 - 0.3, P + 3.2, P + 3.4, L.CONCRETE, 0xb5b1a8);
    for (let i = 0; i < 5; i++) K.prop('crate2', 196 + i * 3.4, P, -186 + (i % 2) * 5); K.prop('container', 204, P, -170, 0, 0xb07a2a); K.prop('desk', 232, P, -172, 0); K.prop('shelf', 238.6, P, -170, 1); K.prop('barrel', 210, P, -188); K.prop('barrel', 211, P, -187);
    W.crates.push({ x: 236, y: P, z: -175, tier: 2 }, { x: 195, y: P, z: -168, tier: 1 }); W.loot.push({ x: 224, y: P, z: -186, tier: 1 }, { x: 206, y: P, z: -180, tier: 2 }, { x: 228, y: P + 3.4, z: -170, tier: 2 }); }
  for (const [x, z, r, c] of [[196, -200, 0, 0x2f6b8f], [226, -200, 0, 0x8a3a2a], [238, -150, 1, 0x3a7a4a], [196, -140, 0, 0xb07a2a], [196, -137.4, 0, 0x6d7378]]) K.prop('container', x, P, z, r, c);
  for (const z of [-150, -136]) { K.shape('cyl12', 222, P + 6, z, 3.2, 12, 3.2, L.CLADDING, 0xf0ece4, false); K.shape('cone', 222, P + 12.7, z, 3.3, 1.4, 3.3, L.PLAIN, 0xd9d5cc, false); W.phys.box(219, P, z - 3, 225, P + 12, z + 3); }
  K.fence('x', -246, 188, 244, P, P + 2.6); K.fence('z', 246, -246, -118, P, P + 2.6); W.crates.push({ x: 210, y: P, z: -144, tier: 1 }); W.loot.push({ x: 232, y: P, z: -128, tier: 1 });
  buyStation(W, K, 206, -156); W.vehicleSpots.push({ x: 232, z: -200, rot: Math.PI / 2, type: 'pickup' }, { x: 206, z: -124, rot: Math.PI / 2, type: 'armored' });
}

// Arena do Gulag: construída no céu (y=400), fora da vista da partida.
function gulag(W, K) {
  const saved = K.bat; const gb = new Batcher(640, 320); K.bat = gb; const Y = 400, s = 16;
  K.solid(-s, Y - 1, -s, s, Y, s, L.CONCRETE, 0x7a7d80, { top: L.CONCRETE, topColor: 0x9a9a98 }); const m = { l: L.CONCRETE, c: 0x6f7376 };
  K.wall('x', -s, -s, s, Y, Y + 7, 0.5, m); K.wall('x', s, -s, s, Y, Y + 7, 0.5, m); K.wall('z', -s, -s, s, Y, Y + 7, 0.5, m); K.wall('z', s, -s, s, Y, Y + 7, 0.5, m);
  K.slab(-s, -s, s, s, Y + 7, Y + 7.3, L.CONCRETE, 0x55585c);
  K.solid(-1, Y, -5, 1, Y + 2.2, 5, L.WALL_TILE, 0xdfe6e6); K.solid(-9, Y, -1, -5, Y + 1.2, 1, L.CONCRETE, 0x8f9396); K.solid(5, Y, -1, 9, Y + 1.2, 1, L.CONCRETE, 0x8f9396); K.solid(-8, Y, 8, -6, Y + 2.2, 10, L.WALL_TILE, 0xdfe6e6); K.solid(6, Y, -10, 8, Y + 2.2, -8, L.WALL_TILE, 0xdfe6e6); K.prop('crate', -4, Y, -10); K.prop('crate', 4, Y, 10); K.prop('barrel', 11, Y, 5); K.prop('barrel', -11, Y, -5);
  W.signs.place('GULAG', { bg: '#55585c', color: '#e8b830', size: 0.7 }, [-4, Y + 4, -s + 0.3], [4, Y + 4, -s + 0.3], [4, Y + 6, -s + 0.3], [-4, Y + 6, -s + 0.3]);
  K.bat = saved; W.gulagBat = gb; W.gulag = { y: Y, a: { x: -12, z: 12 }, b: { x: 12, z: -12 } };
}

export function buildPOIs(W, K) {
  const T = W.terr;
  // aplainar terrenos primeiro (antes de qualquer consulta de altura)
  const pM = T.flatten(44, -244, 172, -116, 10), pS = T.flatten(44, -100, 100, -44, 6), pC = T.flatten(44, -28, 100, 28, 6), pH = T.flatten(-28, -28, 28, 28, 6), pP = T.flatten(-28, -100, 28, -44, 6), pG = T.flatten(188, -244, 244, -116, 8), pJ = T.flatten(-172, -244, -116, -188, 6);
  const hU = T.flatten(-244, 44, -116, 116, 4), hL = T.flatten(-244, 124, -116, 172, 4, hU - 2.6);
  mall(W, K, pM); school(W, K, pS); church(W, K, pC); jandaia(W, K, pJ); park(W, K, hU, hL); hq(W, K, pH); praca(W, K, pP); galpoes(W, K, pG); gulag(W, K);
}
