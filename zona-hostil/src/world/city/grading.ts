// Terraplenagem sobre o relevo real: ruas com perfil longitudinal suave (rampas de até ~16%)
// e platôs para lotes/edifícios, com transição suave para o terreno natural.

import type { Heightfield } from '../Heightfield';

export interface RoadDef {
  name: string;
  /** pontos [x, z] do eixo da rua */
  pts: Array<[number, number]>;
  width: number; // pista (m)
  sidewalk: number; // calçada de cada lado (m)
  maxGrade?: number; // inclinação máxima (0.16 = 16%)
}

export class Grader {
  /** alturas fixadas (NaN = livre) e peso da fixação (para mesclar bordas) */
  constructor(readonly hf: Heightfield) {}

  private cellOf(x: number, z: number): [number, number] {
    return [Math.round((x - this.hf.minX) / this.hf.cell), Math.round((z - this.hf.minZ) / this.hf.cell)];
  }

  /** Aplica `fn(x,z) -> {h, w}` em todas as células dentro do retângulo de busca. */
  private apply(x0: number, z0: number, x1: number, z1: number, fn: (x: number, z: number) => { h: number; w: number } | null): void {
    const hf = this.hf;
    const [i0, j0] = this.cellOf(x0, z0);
    const [i1, j1] = this.cellOf(x1, z1);
    for (let j = Math.max(0, j0); j <= Math.min(hf.res - 1, j1); j++) {
      for (let i = Math.max(0, i0); i <= Math.min(hf.res - 1, i1); i++) {
        const x = hf.minX + i * hf.cell;
        const z = hf.minZ + j * hf.cell;
        const r = fn(x, z);
        if (!r || r.w <= 0) continue;
        const k = j * hf.res + i;
        hf.heights[k] = hf.heights[k] * (1 - r.w) + r.h * r.w;
      }
    }
  }

  /** Perfil longitudinal: amostra o terreno ao longo do eixo, suaviza e limita a inclinação. */
  roadProfile(road: RoadDef, step = 2): { s: number[]; h: number[]; seg: Array<{ a: [number, number]; b: [number, number]; s0: number; len: number }> } {
    const seg: Array<{ a: [number, number]; b: [number, number]; s0: number; len: number }> = [];
    let total = 0;
    for (let k = 0; k < road.pts.length - 1; k++) {
      const a = road.pts[k];
      const b = road.pts[k + 1];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      seg.push({ a, b, s0: total, len });
      total += len;
    }
    const n = Math.max(2, Math.ceil(total / step) + 1);
    const s: number[] = [];
    const h: number[] = [];
    for (let i = 0; i < n; i++) {
      const d = (total * i) / (n - 1);
      const p = this.pointAt(seg, d);
      s.push(d);
      h.push(this.hf.heightAt(p[0], p[1]));
    }
    // suavização (média móvel ~24 m) e limite de inclinação nos dois sentidos
    const win = Math.max(1, Math.round(12 / step));
    let sm = h.map((_, i) => {
      let acc = 0;
      let c = 0;
      for (let k = -win; k <= win; k++) {
        const q = h[Math.min(n - 1, Math.max(0, i + k))];
        acc += q;
        c++;
      }
      return acc / c;
    });
    const g = (road.maxGrade ?? 0.16) * step;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < n; i++) sm[i] = Math.min(Math.max(sm[i], sm[i - 1] - g), sm[i - 1] + g);
      for (let i = n - 2; i >= 0; i--) sm[i] = Math.min(Math.max(sm[i], sm[i + 1] - g), sm[i + 1] + g);
    }
    sm = sm.map((v) => v);
    return { s, h: sm, seg };
  }

  pointAt(seg: Array<{ a: [number, number]; b: [number, number]; s0: number; len: number }>, d: number): [number, number] {
    for (const q of seg) {
      if (d <= q.s0 + q.len + 1e-6) {
        const t = Math.max(0, Math.min(1, (d - q.s0) / q.len));
        return [q.a[0] + (q.b[0] - q.a[0]) * t, q.a[1] + (q.b[1] - q.a[1]) * t];
      }
    }
    const last = seg[seg.length - 1];
    return last.b;
  }

  /** Rebaixa/aterra o terreno sob a rua inteira (pista + calçadas) com transição lateral. */
  gradeRoad(road: RoadDef, blend = 6): ReturnType<Grader['roadProfile']> {
    const prof = this.roadProfile(road);
    const half = road.width / 2 + road.sidewalk + 0.5;
    const xs = road.pts.map((p) => p[0]);
    const zs = road.pts.map((p) => p[1]);
    const pad = half + blend;
    const profH = (d: number) => {
      const t = (d / prof.s[prof.s.length - 1]) * (prof.s.length - 1);
      const i = Math.max(0, Math.min(prof.s.length - 2, Math.floor(t)));
      const f = t - i;
      return prof.h[i] * (1 - f) + prof.h[i + 1] * f;
    };
    this.apply(Math.min(...xs) - pad, Math.min(...zs) - pad, Math.max(...xs) + pad, Math.max(...zs) + pad, (x, z) => {
      // projeção no eixo
      let best = Infinity;
      let bestD = 0;
      for (const q of prof.seg) {
        const dx = q.b[0] - q.a[0];
        const dz = q.b[1] - q.a[1];
        const t = Math.max(0, Math.min(1, ((x - q.a[0]) * dx + (z - q.a[1]) * dz) / (q.len * q.len)));
        const px = q.a[0] + dx * t;
        const pz = q.a[1] + dz * t;
        const dist = Math.hypot(x - px, z - pz);
        if (dist < best) {
          best = dist;
          bestD = q.s0 + q.len * t;
        }
      }
      if (best > half + blend) return null;
      const w = best <= half ? 1 : 1 - (best - half) / blend;
      return { h: profH(bestD), w: w * w * (3 - 2 * w) };
    });
    return prof;
  }

  /** Platô retangular (alinhado aos eixos) na altura h, com transição `blend`. */
  pad(cx: number, cz: number, w: number, d: number, h: number, blend = 5): void {
    this.apply(cx - w / 2 - blend, cz - d / 2 - blend, cx + w / 2 + blend, cz + d / 2 + blend, (x, z) => {
      const dx = Math.max(0, Math.abs(x - cx) - w / 2);
      const dz = Math.max(0, Math.abs(z - cz) - d / 2);
      const dist = Math.hypot(dx, dz);
      if (dist > blend) return null;
      const t = 1 - dist / blend;
      return { h, w: dist === 0 ? 1 : t * t * (3 - 2 * t) };
    });
  }

  /** Altura média do terreno num retângulo (para escolher o nível do platô). */
  meanHeight(cx: number, cz: number, w: number, d: number): number {
    let acc = 0;
    let c = 0;
    for (let z = cz - d / 2; z <= cz + d / 2; z += 2) {
      for (let x = cx - w / 2; x <= cx + w / 2; x += 2) {
        acc += this.hf.heightAt(x, z);
        c++;
      }
    }
    return acc / Math.max(c, 1);
  }
}

/** Grade de ocupação (2 m) para não sobrepor ruas, marcos e casas. */
export class Occupancy {
  private grid: Uint8Array;
  readonly n: number;
  constructor(readonly size: number, readonly cell = 2) {
    this.n = Math.ceil(size / cell);
    this.grid = new Uint8Array(this.n * this.n);
  }
  private idx(x: number, z: number): number {
    const i = Math.floor((x + this.size / 2) / this.cell);
    const j = Math.floor((z + this.size / 2) / this.cell);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
    return j * this.n + i;
  }
  markRect(cx: number, cz: number, w: number, d: number): void {
    for (let z = cz - d / 2; z < cz + d / 2; z += this.cell) for (let x = cx - w / 2; x < cx + w / 2; x += this.cell) {
      const k = this.idx(x, z);
      if (k >= 0) this.grid[k] = 1;
    }
  }
  markRoad(road: RoadDef, extra = 1): void {
    const half = road.width / 2 + road.sidewalk + extra;
    for (let k = 0; k < road.pts.length - 1; k++) {
      const [ax, az] = road.pts[k];
      const [bx, bz] = road.pts[k + 1];
      const len = Math.hypot(bx - ax, bz - az);
      for (let s = 0; s <= len; s += 1) {
        const t = s / len;
        const px = ax + (bx - ax) * t;
        const pz = az + (bz - az) * t;
        this.markRect(px, pz, half * 2, half * 2);
      }
    }
  }
  free(cx: number, cz: number, w: number, d: number): boolean {
    for (let z = cz - d / 2; z < cz + d / 2; z += this.cell) for (let x = cx - w / 2; x < cx + w / 2; x += this.cell) {
      const k = this.idx(x, z);
      if (k < 0 || this.grid[k]) return false;
    }
    return true;
  }
}
