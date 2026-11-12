// Batcher: acumula caixas/quads/malhas e gera poucas malhas fundidas por região (chunk).
// Reduz draw calls: cada chunk tem no máximo 3 malhas (estrutura, detalhe, recorte alfa).
import * as THREE from 'three';
import { TILE, CUTOUT } from './textures.js';

const _c = new THREE.Color(); const colorCache = new Map();
function lin(hex) { let v = colorCache.get(hex); if (!v) { _c.setHex(hex); v = [_c.r, _c.g, _c.b]; colorCache.set(hex, v); } return v; }
const _v = new THREE.Vector3(), _n = new THREE.Vector3(), _nm = new THREE.Matrix3();

class Bucket { constructor() { this.p = []; this.n = []; this.u = []; this.c = []; this.l = []; this.i = []; this.count = 0; } }

export class Batcher {
  constructor(chunk = 80, half = 320) { this.chunk = chunk; this.half = half; this.n = Math.ceil((half * 2) / chunk); this.buckets = new Map(); }
  bucket(x, z, kind) {
    const cx = Math.min(this.n - 1, Math.max(0, Math.floor((x + this.half) / this.chunk))), cz = Math.min(this.n - 1, Math.max(0, Math.floor((z + this.half) / this.chunk)));
    const k = (cz * this.n + cx) * 3 + kind; let b = this.buckets.get(k); if (!b) { b = new Bucket(); b.kind = kind; this.buckets.set(k, b); } return b;
  }
  kindOf(layer, detail) { return CUTOUT.has(layer) ? 2 : detail ? 1 : 0; }
  // Quad a,b,c,d em sentido anti-horário visto de fora. uv = [ua,va, ub,vb, uc,vc, ud,vd]
  quad(a, b, c, d, nx, ny, nz, uv, layer, color, detail) {
    const B = this.bucket((a[0] + c[0]) * 0.5, (a[2] + c[2]) * 0.5, this.kindOf(layer, detail)); const col = lin(color); const s = B.count;
    B.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    for (let k = 0; k < 4; k++) { B.n.push(nx, ny, nz); B.c.push(col[0], col[1], col[2]); B.l.push(layer); }
    B.u.push(uv[0], uv[1], uv[2], uv[3], uv[4], uv[5], uv[6], uv[7]); B.i.push(s, s + 1, s + 2, s, s + 2, s + 3); B.count += 4;
  }
  // Caixa alinhada aos eixos. o: {detail, top, topColor, bottom, skip (bitmask +x1 -x2 +y4 -y8 +z16 -z32), tile}
  box(x0, y0, z0, x1, y1, z1, layer, color = 0xffffff, o = {}) {
    if (x1 < x0) [x0, x1] = [x1, x0]; if (y1 < y0) [y0, y1] = [y1, y0]; if (z1 < z0) [z0, z1] = [z1, z0];
    const t = o.tile || TILE[layer], d = o.detail, sk = o.skip || 0;
    const u0 = x0 / t, u1 = x1 / t, w0 = z0 / t, w1 = z1 / t, v0 = y0 / t, v1 = y1 / t;
    if (!(sk & 1)) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], 1, 0, 0, [-w1, v0, -w0, v0, -w0, v1, -w1, v1], layer, color, d);
    if (!(sk & 2)) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], -1, 0, 0, [w0, v0, w1, v0, w1, v1, w0, v1], layer, color, d);
    if (!(sk & 16)) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0, 0, 1, [u0, v0, u1, v0, u1, v1, u0, v1], layer, color, d);
    if (!(sk & 32)) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], 0, 0, -1, [-u1, v0, -u0, v0, -u0, v1, -u1, v1], layer, color, d);
    if (!(sk & 4)) { const tl = o.top != null ? o.top : layer, tt = o.tile || TILE[tl]; this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], 0, 1, 0, [x0 / tt, -z1 / tt, x1 / tt, -z1 / tt, x1 / tt, -z0 / tt, x0 / tt, -z0 / tt], tl, o.topColor != null ? o.topColor : color, d); }
    if (o.bottom && !(sk & 8)) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0, -1, 0, [u0, w0, u1, w0, u1, w1, u0, w1], layer, o.bottomColor != null ? o.bottomColor : color, d);
  }
  // Quad vertical/horizontal texturizado com UV 0..1 (placas, janelas falsas, portas).
  panel(a, b, c, d, layer, color, detail, ur = 1, vr = 1) {
    _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]); _n.set(d[0] - a[0], d[1] - a[1], d[2] - a[2]); _v.cross(_n).normalize();
    this.quad(a, b, c, d, _v.x, _v.y, _v.z, [0, 0, ur, 0, ur, vr, 0, vr], layer, color, detail);
  }
  // Funde uma BufferGeometry arbitrária (cilindros, esferas etc.).
  geo(g, m, layer, color, detail, uvScale = 1) {
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, idx = g.index; const col = lin(color);
    _nm.getNormalMatrix(m); const e = m.elements;
    const B = this.bucket(e[12], e[14], this.kindOf(layer, detail)); const s = B.count;
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(m); B.p.push(_v.x, _v.y, _v.z);
      _n.fromBufferAttribute(nor, i).applyMatrix3(_nm).normalize(); B.n.push(_n.x, _n.y, _n.z);
      B.u.push(uv ? uv.getX(i) * uvScale : 0, uv ? uv.getY(i) * uvScale : 0); B.c.push(col[0], col[1], col[2]); B.l.push(layer);
    }
    if (idx) for (let i = 0; i < idx.count; i++) B.i.push(s + idx.getX(i)); else for (let i = 0; i < pos.count; i++) B.i.push(s + i);
    B.count += pos.count;
  }
  build(matOpaque, matCutout) {
    const out = []; let tris = 0;
    for (const B of this.buckets.values()) {
      if (!B.count) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(B.p), 3));
      g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(B.n), 3));
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(B.u), 2));
      g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(B.c), 3));
      g.setAttribute('layer', new THREE.BufferAttribute(new Float32Array(B.l), 1));
      g.setIndex(B.count > 65535 ? new THREE.BufferAttribute(new Uint32Array(B.i), 1) : new THREE.BufferAttribute(new Uint16Array(B.i), 1));
      g.computeBoundingSphere(); tris += B.i.length / 3;
      const mesh = new THREE.Mesh(g, B.kind === 2 ? matCutout : matOpaque);
      mesh.matrixAutoUpdate = false; mesh.userData.kind = B.kind; mesh.receiveShadow = true; mesh.castShadow = B.kind === 0;
      out.push(mesh);
    }
    this.buckets.clear(); this.tris = tris; return out;
  }
}
