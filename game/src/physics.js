// Colisão leve própria: AABBs em grade espacial + rampas + terreno em heightmap.
// Sem motor de física: custo previsível em celular.
export const F = { GLASS: 1, DOOR: 2, NOSTAND: 4, THIN: 8, NOSHOT: 16 };
const CELL = 8, HALF = 320, N = (HALF * 2) / CELL;
export const STEP = 0.55;

export class Physics {
  constructor(heightFn) { this.h = heightFn; this.b = []; this.grid = new Array(N * N); this.stamp = new Int32Array(0); this.tick = 1; }
  _insert(i, x0, z0, x1, z1) {
    const a = Math.max(0, Math.floor((x0 + HALF) / CELL)), b = Math.min(N - 1, Math.floor((x1 + HALF) / CELL)), c = Math.max(0, Math.floor((z0 + HALF) / CELL)), d = Math.min(N - 1, Math.floor((z1 + HALF) / CELL));
    for (let z = c; z <= d; z++) for (let x = a; x <= b; x++) { const k = z * N + x; (this.grid[k] || (this.grid[k] = [])).push(i); }
  }
  box(x0, y0, z0, x1, y1, z1, flags = 0, ref = null) {
    if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0]; if (z1 < z0) [z0, z1] = [z1, z0];
    const i = this.b.length; this.b.push({ x0, y0, z0, x1, y1, z1, f: flags, on: true, ref, ramp: 0 }); this._insert(i, x0, z0, x1, z1); return i;
  }
  // Rampa/escada: altura varia de ya (no lado "a") até yb ao longo do eixo. axis 'x' ou 'z'.
  ramp(x0, z0, x1, z1, ya, yb, axis) { const i = this.b.length; this.b.push({ x0, y0: Math.min(ya, yb) - 0.3, z0, x1, y1: Math.max(ya, yb), z1, f: 0, on: true, ramp: axis === 'x' ? 1 : 2, ya, yb }); this._insert(i, x0, z0, x1, z1); return i; }
  finalize() { this.stamp = new Int32Array(this.b.length + 4096); }
  rampY(c, x, z) { const t = c.ramp === 1 ? (x - c.x0) / (c.x1 - c.x0) : (z - c.z0) / (c.z1 - c.z0); return c.ya + (c.yb - c.ya) * (t < 0 ? 0 : t > 1 ? 1 : t); }
  cellAt(x, z) { const cx = Math.floor((x + HALF) / CELL), cz = Math.floor((z + HALF) / CELL); if (cx < 0 || cz < 0 || cx >= N || cz >= N) return null; return this.grid[cz * N + cx]; }
  // Maior superfície pisável em (x,z) que não exceda feetY + STEP.
  ground(x, z, feetY, noTerrain) {
    let g = noTerrain ? -1e9 : this.h(x, z); if (g > feetY + STEP + 0.6 && !noTerrain) { /* abaixo do terreno: corrige */ }
    const list = this.cellAt(x, z); if (list) for (let k = 0; k < list.length; k++) { const c = this.b[list[k]]; if (!c.on || x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) continue; if (c.f & 4) continue; const top = c.ramp ? this.rampY(c, x, z) : c.y1; if (top <= feetY + STEP && top > g) g = top; }
    return g;
  }
  // Teto mais baixo acima da cabeça.
  ceiling(x, z, headY) { let cy = 1e9; const list = this.cellAt(x, z); if (list) for (let k = 0; k < list.length; k++) { const c = this.b[list[k]]; if (!c.on || c.ramp || x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) continue; if (c.y0 >= headY - 0.2 && c.y0 < cy) cy = c.y0; } return cy; }
  // Resolve um círculo (raio r) contra caixas que cruzam [feetY+STEP, feetY+height]. Modifica pos {x,z}.
  resolve(pos, r, feetY, height) {
    let hit = false; const lo = feetY + STEP, hi = feetY + height;
    for (let it = 0; it < 3; it++) {
      let moved = false; const t = ++this.tick;
      const a = Math.max(0, Math.floor((pos.x - r + HALF) / CELL)), b = Math.min(N - 1, Math.floor((pos.x + r + HALF) / CELL)), c0 = Math.max(0, Math.floor((pos.z - r + HALF) / CELL)), d = Math.min(N - 1, Math.floor((pos.z + r + HALF) / CELL));
      for (let gz = c0; gz <= d; gz++) for (let gx = a; gx <= b; gx++) {
        const list = this.grid[gz * N + gx]; if (!list) continue;
        for (let k = 0; k < list.length; k++) {
          const i = list[k]; if (this.stamp[i] === t) continue; this.stamp[i] = t; const c = this.b[i];
          if (!c.on || c.ramp || c.y1 <= lo || c.y0 >= hi) continue;
          const nx = pos.x < c.x0 ? c.x0 : pos.x > c.x1 ? c.x1 : pos.x, nz = pos.z < c.z0 ? c.z0 : pos.z > c.z1 ? c.z1 : pos.z;
          let dx = pos.x - nx, dz = pos.z - nz; const d2 = dx * dx + dz * dz;
          if (d2 >= r * r) continue;
          if (d2 > 1e-8) { const dd = Math.sqrt(d2), p = (r - dd) / dd; pos.x += dx * p; pos.z += dz * p; }
          else { // centro dentro da caixa: empurra pelo lado mais próximo
            const l = pos.x - c.x0, rr2 = c.x1 - pos.x, f = pos.z - c.z0, bk = c.z1 - pos.z; const m = Math.min(l, rr2, f, bk);
            if (m === l) pos.x = c.x0 - r; else if (m === rr2) pos.x = c.x1 + r; else if (m === f) pos.z = c.z0 - r; else pos.z = c.z1 + r;
          }
          moved = true; hit = true;
        }
      }
      if (!moved) break;
    }
    return hit;
  }
  // Raio contra caixas (DDA na grade) e terreno. Retorna {t, i, nx, ny, nz} ou null.
  ray(ox, oy, oz, dx, dy, dz, max, opt) {
    const res = this._r || (this._r = { t: 0, i: -1, nx: 0, ny: 1, nz: 0 }); let best = max, bi = -1, bnx = 0, bny = 0, bnz = 0;
    if (!dx) dx = 1e-9; if (!dy) dy = 1e-9; if (!dz) dz = 1e-9;
    const tk = ++this.tick; const skipGlass = opt && opt.skipGlass;
    let cx = Math.floor((ox + HALF) / CELL), cz = Math.floor((oz + HALF) / CELL);
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(CELL / dx) : 1e9, tdz = dz !== 0 ? Math.abs(CELL / dz) : 1e9;
    let tmx = dx !== 0 ? (((cx + (sx > 0 ? 1 : 0)) * CELL - HALF - ox) / dx) : 1e9, tmz = dz !== 0 ? (((cz + (sz > 0 ? 1 : 0)) * CELL - HALF - oz) / dz) : 1e9;
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    for (let s = 0; s < 96; s++) {
      if (cx >= 0 && cz >= 0 && cx < N && cz < N) {
        const list = this.grid[cz * N + cx];
        if (list) for (let k = 0; k < list.length; k++) {
          const i = list[k]; if (this.stamp[i] === tk) continue; this.stamp[i] = tk; const c = this.b[i];
          if (!c.on || c.ramp || (c.f & 16) || (skipGlass && (c.f & 1))) continue;
          let t0 = (c.x0 - ox) * ix, t1 = (c.x1 - ox) * ix, n = 0; if (t0 > t1) { const q = t0; t0 = t1; t1 = q; }
          let a0 = (c.y0 - oy) * iy, a1 = (c.y1 - oy) * iy; if (a0 > a1) { const q = a0; a0 = a1; a1 = q; }
          if (a0 > t0) { t0 = a0; n = 1; } if (a1 < t1) t1 = a1; if (t0 > t1) continue;
          a0 = (c.z0 - oz) * iz; a1 = (c.z1 - oz) * iz; if (a0 > a1) { const q = a0; a0 = a1; a1 = q; }
          if (a0 > t0) { t0 = a0; n = 2; } if (a1 < t1) t1 = a1; if (t0 > t1 || t0 < 0 || t0 >= best) continue;
          best = t0; bi = i; bnx = n === 0 ? -sx : 0; bny = n === 1 ? (dy > 0 ? -1 : 1) : 0; bnz = n === 2 ? -sz : 0;
        }
      }
      const tn = Math.min(tmx, tmz); if (tn > best) break;
      if (tmx < tmz) { cx += sx; tmx += tdx; } else { cz += sz; tmz += tdz; }
    }
    // Terreno: marcha com passo e refino.
    if (!(opt && opt.noTerrain)) {
      const step = (opt && opt.step) || 1.5; let pt = 0, py = oy - this.h(ox, oz);
      for (let t = step; t < best + step; t += step) {
        const tt = Math.min(t, best); const y = oy + dy * tt - this.h(ox + dx * tt, oz + dz * tt);
        if (y < 0) { let lo = pt, hi = tt; for (let k = 0; k < 5; k++) { const m = (lo + hi) * 0.5; if (oy + dy * m - this.h(ox + dx * m, oz + dz * m) < 0) hi = m; else lo = m; } if (py >= 0 && hi < best) { best = hi; bi = -2; bnx = 0; bny = 1; bnz = 0; } break; }
        pt = tt; py = y; if (tt >= best) break;
      }
    }
    if (bi === -1) return null;
    res.t = best; res.i = bi; res.nx = bnx; res.ny = bny; res.nz = bnz; return res;
  }
  // Linha de visão livre entre dois pontos?
  los(ax, ay, az, bx, by, bz) { let dx = bx - ax, dy = by - ay, dz = bz - az; const d = Math.sqrt(dx * dx + dy * dy + dz * dz); if (d < 0.01) return true; dx /= d; dy /= d; dz /= d; return !this.ray(ax, ay, az, dx || 1e-6, dy || 1e-6, dz || 1e-6, d - 0.2, { step: 3 }); }
}
