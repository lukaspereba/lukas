// Utilitários para montar estruturas: caixas com UV em escala de mundo, escadas e paredes com vãos.

import { BoxGeometry, BufferAttribute, BufferGeometry, Group, Material, Mesh, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** UV planar por face proporcional ao tamanho real (textura não estica em peças grandes). */
export function worldUV(geo: BufferGeometry, tile: number): BufferGeometry {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const nx = Math.abs(nrm.getX(i));
    const ny = Math.abs(nrm.getY(i));
    const nz = Math.abs(nrm.getZ(i));
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (nx >= ny && nx >= nz) uv.setXY(i, z / tile, y / tile);
    else if (ny >= nz) uv.setXY(i, x / tile, z / tile);
    else uv.setXY(i, x / tile, y / tile);
  }
  uv.needsUpdate = true;
  return geo;
}

/**
 * Junta todas as malhas estáticas de um grupo em uma malha por material (menos chamadas de desenho:
 * o maior gargalo do WebGL em celulares). As malhas originais continuam valendo para a colisão.
 */
export function mergeStatic(group: Group): Group {
  const byMat = new Map<Material, BufferGeometry[]>();
  group.updateMatrixWorld(true);
  group.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    let g = m.geometry.clone();
    if (g.index) g = g.toNonIndexed();
    g.clearGroups();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    g.applyMatrix4(m.matrixWorld);
    const mat = m.material as Material;
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat)!.push(g);
  });
  const out = new Group();
  out.name = 'EstáticoMesclado';
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    geos.forEach((g) => g.dispose());
    if (!merged) continue;
    merged.computeBoundingSphere();
    const mesh = new Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    out.add(mesh);
  }
  return out;
}

export class LevelBuilder {
  readonly group = new Group();
  readonly colliders: Mesh[] = [];

  constructor(private tile = 2.5) {}

  /** Caixa centrada em (x,y,z) — y é o centro vertical. */
  box(w: number, h: number, d: number, x: number, y: number, z: number, mat: Material, rotY = 0, collide = true, tile = this.tile): Mesh {
    const g = new BoxGeometry(w, h, d);
    // UV em coordenadas de mundo do objeto (desloca para evitar repetição idêntica entre peças)
    g.translate(x * 0.37, y * 0.37, z * 0.37);
    worldUV(g, tile);
    g.translate(-x * 0.37, -y * 0.37, -z * 0.37);
    const m = new Mesh(g, mat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    m.castShadow = true;
    m.receiveShadow = true;
    m.updateMatrixWorld(true);
    this.group.add(m);
    if (collide) this.colliders.push(m);
    return m;
  }

  /** Caixa apoiada no chão (base em y). */
  block(w: number, h: number, d: number, x: number, baseY: number, z: number, mat: Material, rotY = 0, collide = true): Mesh {
    return this.box(w, h, d, x, baseY + h / 2, z, mat, rotY, collide);
  }

  /** Escada reta: degraus de `rise` ao longo de `dir` (unitário no plano XZ). */
  stairs(start: Vector3, dir: Vector3, width: number, steps: number, rise: number, run: number, mat: Material): void {
    const rotY = Math.atan2(dir.x, dir.z);
    for (let i = 0; i < steps; i++) {
      const h = rise * (i + 1);
      const c = start.clone().addScaledVector(dir, run * (i + 0.5));
      this.box(width, h, run, c.x, start.y + h / 2, c.z, mat, rotY);
    }
  }

  /**
   * Parede ao longo de X (local) com vãos [{from, to, bottom, top}] (coordenadas ao longo da parede).
   * A parede começa em (x0, baseY, z) e vai até x0+len; espessura t.
   */
  wallX(x0: number, z: number, baseY: number, len: number, height: number, t: number, mat: Material, openings: Array<{ from: number; to: number; bottom: number; top: number }> = []): void {
    const ops = [...openings].sort((a, b) => a.from - b.from);
    let cursor = 0;
    for (const o of ops) {
      if (o.from > cursor) this.block(o.from - cursor, height, t, x0 + (cursor + o.from) / 2, baseY, z, mat);
      if (o.bottom > 0) this.block(o.to - o.from, o.bottom, t, x0 + (o.from + o.to) / 2, baseY, z, mat);
      if (o.top < height) this.block(o.to - o.from, height - o.top, t, x0 + (o.from + o.to) / 2, baseY + o.top, z, mat);
      cursor = o.to;
    }
    if (cursor < len) this.block(len - cursor, height, t, x0 + (cursor + len) / 2, baseY, z, mat);
  }

  /** Mesmo que wallX, mas ao longo de Z. */
  wallZ(x: number, z0: number, baseY: number, len: number, height: number, t: number, mat: Material, openings: Array<{ from: number; to: number; bottom: number; top: number }> = []): void {
    const ops = [...openings].sort((a, b) => a.from - b.from);
    let cursor = 0;
    for (const o of ops) {
      if (o.from > cursor) this.block(t, height, o.from - cursor, x, baseY, z0 + (cursor + o.from) / 2, mat);
      if (o.bottom > 0) this.block(t, o.bottom, o.to - o.from, x, baseY, z0 + (o.from + o.to) / 2, mat);
      if (o.top < height) this.block(t, height - o.top, o.to - o.from, x, baseY + o.top, z0 + (o.from + o.to) / 2, mat);
      cursor = o.to;
    }
    if (cursor < len) this.block(t, height, len - cursor, x, baseY, z0 + (cursor + len) / 2, mat);
  }

  /** Rampa sólida (cunha) com inclinação em graus, subindo ao longo de +Z local a partir de (x, baseY, z). */
  ramp(x: number, baseY: number, z: number, width: number, length: number, deg: number, mat: Material, rotY = 0): Mesh {
    const h = Math.tan((deg * Math.PI) / 180) * length;
    const w = width / 2;
    // prisma triangular: base no chão, face inclinada em cima, parede vertical no fim
    const P = [
      [-w, 0, 0], [w, 0, 0], [w, 0, length], [-w, 0, length], [-w, h, length], [w, h, length],
    ];
    const tri = (a: number, b: number, c: number) => [P[a], P[b], P[c]];
    const faces = [
      ...tri(0, 4, 5), ...tri(0, 5, 1), // rampa
      ...tri(3, 2, 5), ...tri(3, 5, 4), // fundo vertical
      ...tri(0, 1, 2), ...tri(0, 2, 3), // base
      ...tri(0, 3, 4), // lateral esquerda
      ...tri(1, 5, 2), // lateral direita
    ];
    const pos = new Float32Array(faces.flat());
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    g.computeVertexNormals();
    worldUV(g, this.tile);
    const m = new Mesh(g, mat);
    m.position.set(x, baseY, z);
    m.rotation.y = rotY;
    m.castShadow = true;
    m.receiveShadow = true;
    m.updateMatrixWorld(true);
    this.group.add(m);
    this.colliders.push(m);
    return m;
  }
}
