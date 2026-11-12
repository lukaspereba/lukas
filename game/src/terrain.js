// Terreno de Carapicuíba: relevo com morros, malha viária alinhada à grade e tipos de piso por célula.
import * as THREE from 'three';
import { L } from './textures.js';
import { fbm, smooth, clamp } from './util.js';
import { freeArray } from './batcher.js';

export const HALF = 320, CS = 4, NC = 160, NV = NC + 1;
export const CT = { GRASS: 0, ASPHALT: 1, SIDEWALK: 2, DIRT: 3, TURF: 4, COURT: 5, CONCRETE: 6, WATER: 7, LOT: 8, FLOOR: 9 };
export const SURF = ['grama', 'asfalto', 'concreto', 'terra', 'grama', 'concreto', 'concreto', 'agua', 'asfalto', 'piso'];
// Ruas: asfalto começa em -256 + 72k e tem 8 m de largura. Quadras (lote útil) entre elas.
export const ROAD0 = -256, PITCH = 72, RW = 8, NR = 8;
export const blockRange = (b) => [ROAD0 + RW + PITCH * b, ROAD0 + PITCH * (b + 1)]; // [início, fim] entre asfaltos (64 m)
const removedV = { 5: [-248, -112], 1: [40, 176] }; // k: intervalo de z removido
const removedH = { 1: [40, 176], 5: [-248, -112] }; // k: intervalo de x removido

const gauss = (x, z, cx, cz, s) => Math.exp(-((x - cx) * (x - cx) + (z - cz) * (z - cz)) / (2 * s * s));
function baseHeight(x, z) {
  let h = 8;
  h += 20 * gauss(x, z, -250, -250, 125); // morro noroeste
  h += 24 * gauss(x, z, 250, 240, 135); // morro sudeste
  h += 9 * gauss(x, z, 290, -70, 95); // elevação leste
  h += 7 * gauss(x, z, -70, 300, 110); // sul
  h -= 4 * gauss(x, z, -30, -150, 110); // baixada central-norte
  h += (fbm(x / 95 + 7, z / 95 + 3, 3, 5) - 0.5) * 6;
  const e = Math.max(Math.abs(x), Math.abs(z)); if (e > 286) { const t = smooth((e - 286) / 34); h += t * t * 16; }
  return h;
}

export class Terrain {
  constructor() {
    this.H = new Float32Array(NV * NV); this.T = new Uint8Array(NC * NC); this.O = new Uint8Array(NC * NC); // O: orientação/tipo de textura de rua
    this.pads = [];
    for (let j = 0; j < NV; j++) for (let i = 0; i < NV; i++) this.H[j * NV + i] = baseHeight(-HALF + i * CS, -HALF + j * CS);
    this._roads();
  }
  _roads() {
    const T = this.T, isV = new Uint8Array(NC * NC), isH = new Uint8Array(NC * NC);
    for (let k = 0; k < NR; k++) {
      const s = (ROAD0 + PITCH * k + HALF) / CS; // índice da célula inicial
      for (let t = (ROAD0 + HALF) / CS; t < (ROAD0 + PITCH * (NR - 1) + RW + HALF) / CS; t++) {
        const w = -HALF + t * CS + 2; const rv = removedV[k], rh = removedH[k];
        if (!(rv && w > rv[0] && w < rv[1])) { isV[t * NC + s] = 1; isV[t * NC + s + 1] = 2; }
        if (!(rh && w > rh[0] && w < rh[1])) { isH[s * NC + t] = 1; isH[(s + 1) * NC + t] = 2; }
      }
    }
    for (let i = 0; i < NC * NC; i++) { if (isV[i] && isH[i]) { T[i] = CT.ASPHALT; this.O[i] = 9; } else if (isV[i]) { T[i] = CT.ASPHALT; this.O[i] = isV[i]; } else if (isH[i]) { T[i] = CT.ASPHALT; this.O[i] = isH[i] + 2; } }
    // faixas de pedestre: célula de rua vizinha a um cruzamento
    for (let j = 1; j < NC - 1; j++) for (let i = 1; i < NC - 1; i++) { const k = j * NC + i, o = this.O[k]; if (o === 1 || o === 2) { if (this.O[k - NC] === 9 || this.O[k + NC] === 9) this.O[k] = 5; } else if (o === 3 || o === 4) { if (this.O[k - 1] === 9 || this.O[k + 1] === 9) this.O[k] = 6; } }
    // calçadas
    for (let j = 1; j < NC - 1; j++) for (let i = 1; i < NC - 1; i++) { const k = j * NC + i; if (T[k] !== CT.GRASS) continue; let near = false; for (let dj = -1; dj <= 1 && !near; dj++) for (let di = -1; di <= 1; di++) if (T[k + dj * NC + di] === CT.ASPHALT) { near = true; break; } if (near) T[k] = CT.SIDEWALK; }
  }
  // Aplana uma área (pad) na altura média, com transição suave de m metros.
  flatten(x0, z0, x1, z1, m = 8, h = null) {
    if (h == null) { let s = 0, n = 0; for (let z = z0; z <= z1; z += 8) for (let x = x0; x <= x1; x += 8) { s += this.height(x, z); n++; } h = s / n; }
    const i0 = Math.max(0, Math.floor((x0 - m + HALF) / CS)), i1 = Math.min(NV - 1, Math.ceil((x1 + m + HALF) / CS)), j0 = Math.max(0, Math.floor((z0 - m + HALF) / CS)), j1 = Math.min(NV - 1, Math.ceil((z1 + m + HALF) / CS));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = -HALF + i * CS, z = -HALF + j * CS; const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1); const d = Math.sqrt(dx * dx + dz * dz); const w = 1 - smooth(d / m); const k = j * NV + i; this.H[k] = this.H[k] * (1 - w) + h * w; }
    return h;
  }
  paint(x0, z0, x1, z1, type, keepRoad = true) { const i0 = Math.max(0, Math.round((x0 + HALF) / CS)), i1 = Math.min(NC, Math.round((x1 + HALF) / CS)), j0 = Math.max(0, Math.round((z0 + HALF) / CS)), j1 = Math.min(NC, Math.round((z1 + HALF) / CS)); for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const k = j * NC + i; if (keepRoad && this.O[k]) continue; this.T[k] = type; } }
  height(x, z) {
    let fx = (x + HALF) / CS, fz = (z + HALF) / CS; fx = fx < 0 ? 0 : fx > NC - 0.001 ? NC - 0.001 : fx; fz = fz < 0 ? 0 : fz > NC - 0.001 ? NC - 0.001 : fz;
    const i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * NV + i, H = this.H;
    // mesma triangulação da malha (diagonal a-c) para o pé não flutuar
    const a = H[k], b = H[k + 1], c = H[k + NV + 1], d = H[k + NV];
    return u >= v ? a + (b - a) * u + (c - b) * v : a + (c - d) * u + (d - a) * v;
  }
  type(x, z) { const i = clamp(Math.floor((x + HALF) / CS), 0, NC - 1), j = clamp(Math.floor((z + HALF) / CS), 0, NC - 1); return this.T[j * NC + i]; }
  isRoad(x, z) { const i = clamp(Math.floor((x + HALF) / CS), 0, NC - 1), j = clamp(Math.floor((z + HALF) / CS), 0, NC - 1); return this.O[j * NC + i] > 0; }
  buildMeshes(material) {
    const meshes = [], CH = 40, H = this.H; const col = new THREE.Color();
    const layerOf = [L.GRASS, L.ASPHALT, L.SIDEWALK, L.DIRT, L.TURF, L.COURT, L.CONCRETE, L.WATER, L.ASPHALT, L.FLOOR_TILE];
    const tint = [0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0x3f8fd0, 0xd8d8d2, 0xf2dc3a, 0xe6e6e6, 0xffffff];
    const nrm = (i, j, out, o) => { const l = H[j * NV + Math.max(0, i - 1)], r = H[j * NV + Math.min(NC, i + 1)], u = H[Math.max(0, j - 1) * NV + i], d = H[Math.min(NC, j + 1) * NV + i]; let nx = l - r, nz = u - d, ny = 2 * CS; const m = Math.hypot(nx, ny, nz); out[o] = nx / m; out[o + 1] = ny / m; out[o + 2] = nz / m; };
    for (let cj = 0; cj < NC; cj += CH) for (let ci = 0; ci < NC; ci += CH) {
      const n = CH * CH, P = new Float32Array(n * 12), Nn = new Float32Array(n * 12), U = new Float32Array(n * 8), C = new Float32Array(n * 12), Ly = new Float32Array(n * 4), I = new Uint16Array(n * 6); let q = 0;
      for (let j = cj; j < cj + CH; j++) for (let i = ci; i < ci + CH; i++) {
        const k = j * NC + i, t = this.T[k], o = this.O[k]; const x = -HALF + i * CS, z = -HALF + j * CS;
        let layer = layerOf[t]; let uv;
        if (o === 1) { layer = L.ASPHALT_LINE; uv = [0, 0, 1, 0, 1, 1, 0, 1]; } else if (o === 2) { layer = L.ASPHALT_LINE; uv = [1, 0, 0, 0, 0, 1, 1, 1]; }
        else if (o === 3) { layer = L.ASPHALT_LINE; uv = [0, 0, 0, 1, 1, 1, 1, 0]; } else if (o === 4) { layer = L.ASPHALT_LINE; uv = [1, 0, 1, 1, 0, 1, 0, 0]; }
        else if (o === 5) { layer = L.CROSSWALK; uv = [0, 0, 1, 0, 1, 1, 0, 1]; } else if (o === 6) { layer = L.CROSSWALK; uv = [0, 0, 0, 1, 1, 1, 1, 0]; }
        else { const a = i % 8, b = j % 8; uv = [a, b, a + 1, b, a + 1, b + 1, a, b + 1]; }
        // vértices: a(x,z) b(x+4,z) c(x+4,z+4) d(x,z+4)
        const hs = [H[j * NV + i], H[j * NV + i + 1], H[(j + 1) * NV + i + 1], H[(j + 1) * NV + i]]; const xs = [x, x + CS, x + CS, x], zs = [z, z, z + CS, z + CS], is = [i, i + 1, i + 1, i], js = [j, j, j + 1, j + 1];
        col.setHex(tint[t]);
        for (let v = 0; v < 4; v++) { const p = q * 4 + v; P[p * 3] = xs[v]; P[p * 3 + 1] = hs[v]; P[p * 3 + 2] = zs[v]; nrm(is[v], js[v], Nn, p * 3); U[p * 2] = uv[v * 2]; U[p * 2 + 1] = uv[v * 2 + 1]; let s = 1; if (t === CT.GRASS || t === CT.DIRT) s = 0.78 + fbm(xs[v] / 23, zs[v] / 23, 2, 9) * 0.44; C[p * 3] = col.r * s; C[p * 3 + 1] = col.g * s; C[p * 3 + 2] = col.b * s; Ly[p] = layer; }
        const s4 = q * 4; I.set([s4, s4 + 2, s4 + 1, s4, s4 + 3, s4 + 2], q * 6); q++;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setAttribute('layer', new THREE.BufferAttribute(Ly, 1)); g.setIndex(new THREE.BufferAttribute(I, 1)); g.computeBoundingSphere(); for (const k in g.attributes) g.attributes[k].onUpload(freeArray); g.index.onUpload(freeArray);
      const m = new THREE.Mesh(g, material); m.matrixAutoUpdate = false; m.receiveShadow = true; m.userData.kind = 3; meshes.push(m);
    }
    return meshes;
  }
}
