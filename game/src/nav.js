// Malha de navegação em grade (2,5 m) derivada dos colisores, com A* e busca de cobertura.
import { G } from './state.js';
import { F } from './physics.js';

export const NS = 2.5, NN = 256, NH = 320;
const DX = [1, 1, 0, -1, -1, -1, 0, 1], DZ = [0, 1, 1, 1, 0, -1, -1, -1];
export const nav = { ok: null, y: null, wx: null, wz: null, edge: null, road: null };
const P = { x: 0, z: 0 };
export function buildNav() {
  const ph = G.phys, T = G.terr, n = NN * NN; nav.ok = new Uint8Array(n); nav.y = new Float32Array(n); nav.wx = new Float32Array(n); nav.wz = new Float32Array(n); nav.edge = new Uint8Array(n); nav.road = new Uint8Array(n);
  const doors = G.world.doors; doors.forEach((d) => { ph.b[d.col].on = false; });
  const floor = (x, z) => { let y = T.height(x, z); for (let k = 0; k < 4; k++) { const g = ph.ground(x, z, y + 0.05); if (g > y + 0.01) y = g; else break; } return y; };
  for (let j = 0; j < NN; j++) for (let i = 0; i < NN; i++) { const k = j * NN + i; const x = -NH + (i + 0.5) * NS, z = -NH + (j + 0.5) * NS; if (Math.abs(x) > 308 || Math.abs(z) > 308) continue; let y = floor(x, z); P.x = x; P.z = z; if (ph.resolve(P, 0.4, y, 1.7)) { const d = Math.hypot(P.x - x, P.z - z); if (d > 1.1) continue; y = floor(P.x, P.z); const qx = P.x, qz = P.z; if (ph.resolve(P, 0.36, y, 1.7) && Math.hypot(P.x - qx, P.z - qz) > 0.08) continue; P.x = qx; P.z = qz; }
    if (T.type(P.x, P.z) === 7 && false) continue; nav.ok[k] = 1; nav.y[k] = y; nav.wx[k] = P.x; nav.wz[k] = P.z; nav.road[k] = T.isRoad(P.x, P.z) && y < T.height(P.x, P.z) + 0.1 ? 1 : 0; }
  // arestas: 3 amostras ao longo do segmento garantem que nenhuma parede fina seja atravessada
  for (let j = 1; j < NN - 1; j++) for (let i = 1; i < NN - 1; i++) { const k = j * NN + i; if (!nav.ok[k]) continue; for (let d = 0; d < 4; d++) { const k2 = k + DZ[d] * NN + DX[d]; if (!nav.ok[k2]) continue; const dy = nav.y[k2] - nav.y[k]; if (Math.abs(dy) > 1.25) continue; let free = true; for (let s = 1; s <= 3 && free; s++) { const t = s / 4; const x = nav.wx[k] + (nav.wx[k2] - nav.wx[k]) * t, z = nav.wz[k] + (nav.wz[k2] - nav.wz[k]) * t; P.x = x; P.z = z; const y = nav.y[k] + dy * t; if (ph.resolve(P, 0.3, y, 1.6) && Math.hypot(P.x - x, P.z - z) > 0.06) free = false; }
      if (free) { nav.edge[k] |= 1 << d; nav.edge[k2] |= 1 << (d + 4); } } }
  doors.forEach((d) => { ph.b[d.col].on = !d.open; });
  open = new Int32Array(n); gS = new Float32Array(n); came = new Int32Array(n); stamp = new Int32Array(n); heap = new Int32Array(n); fS = new Float32Array(n);
}
export const cellOf = (x, z) => { const i = Math.floor((x + NH) / NS), j = Math.floor((z + NH) / NS); return i < 0 || j < 0 || i >= NN || j >= NN ? -1 : j * NN + i; };
// Célula caminhável mais próxima de (x,z).
export function nearestCell(x, z, maxR = 6, y = null) { const c = cellOf(x, z); if (c < 0) return -1; if (nav.ok[c] && (y == null || Math.abs(nav.y[c] - y) < 2.2)) return c; const ci = c % NN, cj = (c / NN) | 0; let best = -1, bd = 1e9; for (let r = 1; r <= maxR; r++) { for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const i = ci + di, j = cj + dj; if (i < 0 || j < 0 || i >= NN || j >= NN) continue; const k = j * NN + i; if (!nav.ok[k]) continue; if (y != null && Math.abs(nav.y[k] - y) > 2.2) continue; const d = (nav.wx[k] - x) ** 2 + (nav.wz[k] - z) ** 2; if (d < bd) { bd = d; best = k; } } if (best >= 0) return best; } return best; }
let open, gS, fS, came, stamp, heap, hn = 0, tick = 0;
function push(k) { let i = hn++; heap[i] = k; while (i > 0) { const p = (i - 1) >> 1; if (fS[heap[p]] <= fS[heap[i]]) break; const t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p; } }
function pop() { const top = heap[0]; const last = heap[--hn]; if (hn > 0) { heap[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < hn && fS[heap[l]] < fS[heap[m]]) m = l; if (r < hn && fS[heap[r]] < fS[heap[m]]) m = r; if (m === i) break; const t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m; } } return top; }
// A*. roadOnly restringe a ruas (veículos). Retorna lista de células ou null.
export function findPath(from, to, roadOnly = false, maxExp = 9000) { if (from < 0 || to < 0) return null; if (from === to) return [to]; tick++; hn = 0; const ti = to % NN, tj = (to / NN) | 0; const H = (k) => { const dx = Math.abs((k % NN) - ti), dz = Math.abs(((k / NN) | 0) - tj); return (Math.max(dx, dz) + 0.414 * Math.min(dx, dz)) * 1.05; };
  gS[from] = 0; fS[from] = H(from); came[from] = -1; stamp[from] = tick; open[from] = 1; push(from); let exp = 0, bestK = from, bestH = H(from);
  while (hn > 0 && exp++ < maxExp) { const k = pop(); if (open[k] === 2 && stamp[k] === tick) continue; open[k] = 2; if (k === to) { bestK = k; break; } const hh = fS[k] - gS[k]; if (hh < bestH) { bestH = hh; bestK = k; } const e = nav.edge[k];
    for (let d = 0; d < 8; d++) { if (!(e & (1 << d))) continue; const k2 = k + DZ[d] * NN + DX[d]; if (roadOnly && !nav.road[k2]) continue; const g = gS[k] + (d & 1 ? 1.414 : 1) + (roadOnly ? 0 : nav.road[k2] ? 0 : 0.08); if (stamp[k2] === tick) { if (open[k2] === 2 || g >= gS[k2]) continue; } stamp[k2] = tick; open[k2] = 1; gS[k2] = g; fS[k2] = g + H(k2); came[k2] = k; push(k2); } }
  if (bestK === from) return null; const path = []; let c = bestK; while (c >= 0 && path.length < 2000) { path.push(c); c = came[c]; } path.reverse(); return path; }
// Vizinho caminhável na direção (dx,dz) — usado para deslocamento lateral em combate.
export function stepToward(k, dx, dz) { let best = -1, bd = 0.2; const e = nav.edge[k]; const m = Math.hypot(dx, dz) || 1; for (let d = 0; d < 8; d++) { if (!(e & (1 << d))) continue; const dot = (DX[d] * dx + DZ[d] * dz) / m / (d & 1 ? 1.414 : 1); if (dot > bd) { bd = dot; best = k + DZ[d] * NN + DX[d]; } } return best; }
// Procura célula próxima sem linha de visão para a ameaça (cobertura).
export function findCover(k, tx, ty, tz, depth = 5) { const q = [k], dist = new Map([[k, 0]]); let qi = 0, best = -1, bd = 99; while (qi < q.length) { const c = q[qi++], d = dist.get(c); if (d > 0) { const blocked = !G.phys.los(nav.wx[c], nav.y[c] + 1.0, nav.wz[c], tx, ty, tz); if (blocked && d < bd) { bd = d; best = c; if (d <= 2) break; } } if (d >= depth) continue; const e = nav.edge[c]; for (let i = 0; i < 8; i += 1) { if (!(e & (1 << i))) continue; const c2 = c + DZ[i] * NN + DX[i]; if (!dist.has(c2)) { dist.set(c2, d + 1); q.push(c2); } } } return best; }
export { F };
