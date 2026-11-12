// Kit de construção para os marcos da cidade (coordenadas locais; base do platô em y = 0).

import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Material,
  Mesh,
  PlaneGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { LevelBuilder, worldUV } from '../Builder';
import type { CityMats } from './materials';

export class Kit extends LevelBuilder {
  readonly points: Record<string, Vector3> = {};

  constructor(readonly M: CityMats, tile = 2.5) {
    super(tile);
  }

  /** Coloca o grupo no mundo (as malhas de colisão herdam a matriz). */
  place(x: number, y: number, z: number, rotY = 0): this {
    this.group.position.set(x, y, z);
    this.group.rotation.y = rotY;
    this.group.updateMatrixWorld(true);
    for (const k of Object.keys(this.points)) this.points[k].applyMatrix4(this.group.matrixWorld);
    return this;
  }

  /** Laje retangular com vãos (escadas, átrios): divide em faixas sem sobreposição. */
  slab(x0: number, x1: number, z0: number, z1: number, y: number, t: number, mat: Material, holes: Array<[number, number, number, number]> = []): void {
    const zs = new Set<number>([z0, z1]);
    for (const h of holes) {
      zs.add(Math.max(z0, Math.min(z1, h[2])));
      zs.add(Math.max(z0, Math.min(z1, h[3])));
    }
    const zl = [...zs].sort((a, b) => a - b);
    for (let i = 0; i < zl.length - 1; i++) {
      const za = zl[i];
      const zb = zl[i + 1];
      if (zb - za < 0.01) continue;
      const zm = (za + zb) / 2;
      // intervalos em x livres nesta faixa
      let segs: Array<[number, number]> = [[x0, x1]];
      for (const h of holes) {
        if (zm <= h[2] || zm >= h[3]) continue;
        const next: Array<[number, number]> = [];
        for (const [a, b] of segs) {
          if (h[1] <= a || h[0] >= b) next.push([a, b]);
          else {
            if (h[0] > a) next.push([a, h[0]]);
            if (h[1] < b) next.push([h[1], b]);
          }
        }
        segs = next;
      }
      for (const [a, b] of segs) if (b - a > 0.01) this.block(b - a, t, zb - za, (a + b) / 2, y - t, zm, mat);
    }
  }

  /** Malha avulsa (sem UV de mundo). */
  mesh(geo: import('three').BufferGeometry, mat: Material, x: number, y: number, z: number, collide = false, rotY = 0, rotX = 0): Mesh {
    const m = new Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.order = 'YXZ'; // inclina no eixo local e depois gira (folhas de palmeira em leque)
    m.rotation.set(rotX, rotY, 0);
    m.castShadow = true;
    m.receiveShadow = true;
    m.updateMatrixWorld(true);
    this.group.add(m);
    if (collide) this.colliders.push(m);
    return m;
  }

  /** Piso com UV 0..1 (quadras com marcações). */
  floorDecal(w: number, d: number, x: number, y: number, z: number, mat: Material, rotY = 0): Mesh {
    const g = new PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    const m = this.mesh(g, mat, x, y, z, false, rotY);
    m.castShadow = false;
    return m;
  }

  /** Placa vertical com UV 0..1 voltada para +Z local (rotY gira). */
  sign(w: number, h: number, x: number, y: number, z: number, mat: Material, rotY = 0): Mesh {
    const m = this.mesh(new PlaneGeometry(w, h), mat, x, y, z, false, rotY);
    m.castShadow = false;
    return m;
  }

  /** Telhado em arco (abóbada) ao longo de X: vão `span` em Z, flecha `rise`, nascendo em `springY`. */
  archRoof(len: number, span: number, rise: number, x: number, springY: number, z: number, mat: Material, trussEvery = 5): void {
    const r = (span * span / 4 + rise * rise) / (2 * rise);
    const theta = 2 * Math.asin(span / 2 / r);
    const g = new CylinderGeometry(r, r, len, 28, 1, true, -theta / 2, theta);
    g.rotateZ(Math.PI / 2); // eixo do cilindro -> X
    g.rotateX(-Math.PI / 2); // centro do arco (+Z) -> +Y
    // após as rotações o arco fica sobre o eixo X com o topo em +Y
    const cy = springY + rise - r;
    this.mesh(g, mat, x, cy, z, true);
    // treliças metálicas em arco (banzo superior e inferior + diagonais)
    const steel = this.M.steel;
    for (let tx = -len / 2; tx <= len / 2 + 0.01; tx += trussEvery) {
      const N = 14;
      let prevO: Vector3 | null = null;
      let prevI: Vector3 | null = null;
      for (let i = 0; i <= N; i++) {
        const a = -theta / 2 + (theta * i) / N;
        const o = new Vector3(x + tx, cy + Math.cos(a) * (r - 0.12), z + Math.sin(a) * (r - 0.12));
        const inn = new Vector3(x + tx, cy + Math.cos(a) * (r - 0.9), z + Math.sin(a) * (r - 0.9));
        if (prevO && prevI) {
          this.beam(prevO, o, 0.1, steel);
          this.beam(prevI, inn, 0.1, steel);
          this.beam(i % 2 ? prevO : prevI, i % 2 ? inn : o, 0.06, steel);
        }
        prevO = o;
        prevI = inn;
      }
    }
  }

  /** Viga entre dois pontos (caixa alongada). */
  beam(a: Vector3, b: Vector3, t: number, mat: Material, collide = false): Mesh {
    const len = a.distanceTo(b);
    const g = new BoxGeometry(t, t, len);
    const m = new Mesh(g, mat);
    // ainda sem pai: coordenadas locais do grupo valem como mundo para o lookAt
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.lookAt(b);
    m.castShadow = true;
    m.updateMatrixWorld(true);
    this.group.add(m);
    if (collide) this.colliders.push(m);
    return m;
  }

  cylinder(r: number, h: number, x: number, baseY: number, z: number, mat: Material, collide = true, seg = 14): Mesh {
    const g = new CylinderGeometry(r, r, h, seg);
    worldUV(g, 2);
    return this.mesh(g, mat, x, baseY + h / 2, z, collide);
  }

  /** Grade/guarda-corpo de barras verticais entre (x0,z0) e (x1,z1). */
  railing(x0: number, z0: number, x1: number, z1: number, baseY: number, h: number, mat: Material, collide = true): void {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const rot = Math.atan2(x1 - x0, z1 - z0);
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    this.box(0.06, 0.06, len, cx, baseY + h, cz, mat, rot, false);
    this.box(0.05, 0.05, len, cx, baseY + 0.12, cz, mat, rot, false);
    const n = Math.max(1, Math.round(len / 0.14));
    for (let i = 0; i <= n; i += 1) {
      if (i % 2) continue;
      const t = i / n;
      this.box(0.025, h, 0.025, x0 + (x1 - x0) * t, baseY + h / 2, z0 + (z1 - z0) * t, mat, 0, false);
    }
    if (collide) {
      const c = this.box(0.08, h, len, cx, baseY + h / 2, cz, mat, rot, true);
      c.visible = false;
    }
  }

  /** Alambrado (tela) entre dois pontos, com postes. */
  fence(x0: number, z0: number, x1: number, z1: number, baseY: number, h: number): void {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const rot = Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2;
    const g = new PlaneGeometry(len, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * len / 1.2, uv.getY(i) * h / 1.2);
    const m = this.mesh(g, this.M.chain, (x0 + x1) / 2, baseY + h / 2, (z0 + z1) / 2, true, rot);
    m.castShadow = false;
    const n = Math.max(1, Math.round(len / 3));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.box(0.07, h, 0.07, x0 + (x1 - x0) * t, baseY + h / 2, z0 + (z1 - z0) * t, this.M.steel, 0, false);
    }
    this.box(0.05, 0.05, len, (x0 + x1) / 2, baseY + h, (z0 + z1) / 2, this.M.steel, rot - Math.PI / 2, false);
  }

  /** Tabela de basquete (tabela + aro + rede) voltada para +X local (rotY gira). */
  hoop(x: number, y: number, z: number, rotY: number, post: 'poste' | 'nenhum' = 'poste'): void {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const fx = (d: number) => x + c * d;
    const fz = (d: number) => z - s * d;
    if (post === 'poste') this.box(0.18, y + 0.3, 0.18, fx(-1.2), (y + 0.3) / 2, fz(-1.2), this.M.blueSteel, rotY, true);
    if (post === 'poste') this.box(1.2, 0.12, 0.12, fx(-0.6), y + 0.2, fz(-0.6), this.M.blueSteel, rotY, false);
    this.box(0.06, 1.05, 1.8, fx(0), y + 0.4, fz(0), this.M.plasterWhite, rotY, true);
    const rim = this.mesh(new TorusGeometry(0.23, 0.018, 6, 20), this.M.orange, fx(0.38), y, fz(0.38), false, 0, Math.PI / 2);
    rim.castShadow = false;
    const net = this.mesh(new CylinderGeometry(0.23, 0.15, 0.45, 12, 1, true), this.M.chain, fx(0.38), y - 0.23, fz(0.38));
    net.castShadow = false;
  }

  /** Trave de futsal (3 x 2 m) com a boca para +X local. */
  goal(x: number, z: number, rotY: number, w = 3, h = 2): void {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    const P = (dx: number, dz: number) => [x + c * dx + s * dz, z - s * dx + c * dz] as const;
    const white = this.M.plasterWhite;
    for (const dz of [-w / 2, w / 2]) {
      const [px, pz] = P(0, dz);
      this.box(0.08, h, 0.08, px, h / 2, pz, white, 0, true);
    }
    const [tx, tz] = P(0, 0);
    this.box(0.08, 0.08, w, tx, h, tz, white, rotY, false);
    const [bx, bz] = P(-1, 0);
    const back = this.mesh(new PlaneGeometry(w, h), this.M.chain, bx, h / 2, bz, false, rotY + Math.PI / 2);
    back.castShadow = false;
  }

  /** Árvore de copa arredondada (folhagem em blocos orgânicos). */
  tree(x: number, y: number, z: number, s = 1, seed = 1): void {
    this.cylinder(0.18 * s, 3.2 * s, x, y, z, this.M.trunk, true, 8);
    const rnd = (k: number) => {
      const v = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
      return v - Math.floor(v);
    };
    for (let k = 0; k < 5; k++) {
      const g = new IcosahedronGeometry((1.3 + rnd(k) * 0.9) * s, 1);
      const m = this.mesh(g, this.M.leaves, x + (rnd(k + 10) - 0.5) * 2.2 * s, y + (3.6 + rnd(k + 20) * 1.6) * s, z + (rnd(k + 30) - 0.5) * 2.2 * s);
      m.scale.y = 0.75;
      m.updateMatrixWorld(true);
    }
  }

  /** Palmeira (tronco anelado + folhas em leque). */
  palm(x: number, y: number, z: number, h = 7, seed = 1): void {
    this.cylinder(0.2, h, x, y, z, this.M.trunk, true, 8);
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2 + seed;
      const g = new PlaneGeometry(0.7, 3.4, 1, 3);
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const yy = pos.getY(i) + 1.7;
        pos.setZ(i, -0.1 * yy * yy); // folha caindo
      }
      g.translate(0, 1.7, 0);
      g.computeVertexNormals();
      const m = this.mesh(g, this.M.palm, x, y + h - 0.1, z, false, a, -1.0);
      m.castShadow = true;
    }
  }

  /** Mesa com 4 cadeiras (praça de alimentação, refeitório). */
  tableSet(x: number, y: number, z: number): void {
    this.box(1.1, 0.06, 1.1, x, y + 0.74, z, this.M.plasterWhite, 0, false);
    this.box(0.1, 0.72, 0.1, x, y + 0.36, z, this.M.steel, 0, true);
    for (const [dx, dz] of [[0.85, 0], [-0.85, 0], [0, 0.85], [0, -0.85]]) {
      this.box(0.45, 0.45, 0.45, x + dx, y + 0.225, z + dz, this.M.orange, 0, true);
    }
  }
}

export function boxGeo(w: number, h: number, d: number): BoxGeometry {
  const g = new BoxGeometry(w, h, d);
  worldUV(g, 2.5);
  return g;
}

export type { Group };
