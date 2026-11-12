// Ruas sobre o relevo graduado: pista, calçadas com guia (colisão), faixas, faixas de pedestre,
// "box" amarelo de cruzamento, postes com fiação.

import { BufferGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Material, Mesh, Vector3 } from 'three';
import type { Heightfield } from '../Heightfield';
import type { RoadDef } from './grading';
import type { CityMats } from './materials';

interface Strip {
  pos: number[];
  uv: number[];
  idx: number[];
}

const newStrip = (): Strip => ({ pos: [], uv: [], idx: [] });

function toMesh(s: Strip, mat: Material, name: string): Mesh | null {
  if (!s.idx.length) return null;
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(s.pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(s.uv, 2));
  g.setIndex(s.idx);
  g.computeVertexNormals();
  const m = new Mesh(g, mat);
  m.name = name;
  m.receiveShadow = true;
  return m;
}

/** Quad entre duas linhas (a0,a1) e (b0,b1). */
function quad(s: Strip, a0: Vector3, a1: Vector3, b0: Vector3, b1: Vector3, u0: number, u1: number, v0: number, v1: number): void {
  const k = s.pos.length / 3;
  s.pos.push(a0.x, a0.y, a0.z, a1.x, a1.y, a1.z, b0.x, b0.y, b0.z, b1.x, b1.y, b1.z);
  s.uv.push(u0, v0, u1, v0, u0, v1, u1, v1);
  s.idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
}

export interface StreetResult {
  group: Group;
  colliders: Mesh[];
}

export function buildStreets(roads: RoadDef[], hf: Heightfield, M: CityMats, opts: { boxAt?: Array<[number, number]> } = {}): StreetResult {
  const group = new Group();
  group.name = 'Ruas';
  const colliders: Mesh[] = [];
  const asphalt = newStrip();
  const walk = newStrip();
  const curb = newStrip();
  const white = newStrip();
  const yellow = newStrip();
  const H = (x: number, z: number) => hf.heightAt(x, z);

  // está dentro da pista de OUTRA rua? (para cortar calçadas nos cruzamentos)
  const inOtherRoad = (x: number, z: number, self: RoadDef, margin: number) => {
    for (const r of roads) {
      if (r === self) continue;
      for (let k = 0; k < r.pts.length - 1; k++) {
        const [ax, az] = r.pts[k];
        const [bx, bz] = r.pts[k + 1];
        const dx = bx - ax;
        const dz = bz - az;
        const l2 = dx * dx + dz * dz;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
        if (Math.hypot(x - (ax + dx * t), z - (az + dz * t)) < r.width / 2 + r.sidewalk + margin) return true;
      }
    }
    return false;
  };

  roads.forEach((road, ri) => {
    const lift = 0.025 + (ri % 4) * 0.004; // evita z-fighting entre ruas sobrepostas
    let along = 0;
    for (let k = 0; k < road.pts.length - 1; k++) {
      const [ax, az] = road.pts[k];
      const [bx, bz] = road.pts[k + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const tx = (bx - ax) / len;
      const tz = (bz - az) / len;
      const nx = -tz;
      const nz = tx;
      const step = 2;
      const n = Math.max(1, Math.ceil(len / step));
      const hw = road.width / 2;
      for (let i = 0; i < n; i++) {
        const d0 = (len * i) / n;
        const d1 = (len * (i + 1)) / n;
        const p0x = ax + tx * d0;
        const p0z = az + tz * d0;
        const p1x = ax + tx * d1;
        const p1z = az + tz * d1;
        const at = (px: number, pz: number, off: number, up: number) => {
          const x = px + nx * off;
          const z = pz + nz * off;
          return new Vector3(x, H(x, z) + up, z);
        };
        const u0 = (along + d0) / 6;
        const u1 = (along + d1) / 6;
        quad(asphalt, at(p0x, p0z, -hw, lift), at(p1x, p1z, -hw, lift), at(p0x, p0z, hw, lift), at(p1x, p1z, hw, lift), u0, u1, 0, road.width / 6);
        // calçadas e guias dos dois lados (cortadas nos cruzamentos)
        for (const side of [-1, 1]) {
          const mx = (p0x + p1x) / 2 + nx * side * (hw + road.sidewalk / 2);
          const mz = (p0z + p1z) / 2 + nz * side * (hw + road.sidewalk / 2);
          if (inOtherRoad(mx, mz, road, -road.sidewalk * 0.3)) continue;
          const o0 = side * hw;
          const o1 = side * (hw + road.sidewalk);
          const top = 0.17;
          const a0 = at(p0x, p0z, o0, top);
          const a1 = at(p1x, p1z, o0, top);
          const b0 = at(p0x, p0z, o1, top);
          const b1 = at(p1x, p1z, o1, top);
          if (side < 0) quad(walk, b0, b1, a0, a1, u0, u1, 0, road.sidewalk / 2);
          else quad(walk, a0, a1, b0, b1, u0, u1, 0, road.sidewalk / 2);
          const c0 = at(p0x, p0z, o0, lift);
          const c1 = at(p1x, p1z, o0, lift);
          if (side < 0) quad(curb, c0, c1, a0, a1, u0, u1, 0, 0.1);
          else quad(curb, a0, a1, c0, c1, u0, u1, 0, 0.1);
        }
        // faixa central tracejada (avenida: dupla amarela contínua)
        if (road.width >= 7) {
          const mid = (along + (d0 + d1) / 2) % 6;
          const isAve = road.width >= 12;
          if (isAve || mid < 3) {
            const offs = isAve ? [-0.12, 0.12] : [0];
            for (const o of offs) {
              if (inOtherRoad((p0x + p1x) / 2, (p0z + p1z) / 2, road, 0)) continue;
              quad(isAve ? yellow : white, at(p0x, p0z, o - 0.06, lift + 0.01), at(p1x, p1z, o - 0.06, lift + 0.01), at(p0x, p0z, o + 0.06, lift + 0.01), at(p1x, p1z, o + 0.06, lift + 0.01), 0, 1, 0, 1);
            }
          }
        }
      }
      along += len;
    }
  });

  // faixas de pedestre perto dos cruzamentos (avenida e rua Europa)
  const zebra = (cx: number, cz: number, alongX: boolean, width: number) => {
    for (let k = -width / 2 + 0.4; k < width / 2; k += 0.9) {
      const x0 = alongX ? cx - 1.5 : cx + k;
      const z0 = alongX ? cz + k : cz - 1.5;
      const x1 = alongX ? cx + 1.5 : cx + k + 0.5;
      const z1 = alongX ? cz + k + 0.5 : cz + 1.5;
      const y = (x: number, z: number) => H(x, z) + 0.045;
      quad(white, new Vector3(x0, y(x0, z0), z0), new Vector3(x1, y(x1, z0), z0), new Vector3(x0, y(x0, z1), z1), new Vector3(x1, y(x1, z1), z1), 0, 1, 0, 1);
    }
  };
  for (const [bx, bz] of opts.boxAt ?? []) {
    // "box" amarelo com X (foto da igreja na esquina da Av. Inocêncio Seráfico)
    const s = 6.5;
    const ln = (ax: number, az: number, cx: number, cz: number) => {
      const len = Math.hypot(cx - ax, cz - az);
      const nx = -(cz - az) / len;
      const nz = (cx - ax) / len;
      const w = 0.12;
      const y = (x: number, z: number) => H(x, z) + 0.05;
      const A = new Vector3(ax - nx * w, 0, az - nz * w);
      const B = new Vector3(cx - nx * w, 0, cz - nz * w);
      const C = new Vector3(ax + nx * w, 0, az + nz * w);
      const D = new Vector3(cx + nx * w, 0, cz + nz * w);
      for (const v of [A, B, C, D]) v.y = y(v.x, v.z);
      quad(yellow, A, B, C, D, 0, 1, 0, 1);
    };
    ln(bx - s, bz - s, bx + s, bz + s);
    ln(bx - s, bz + s, bx + s, bz - s);
    ln(bx - s, bz - s, bx + s, bz - s);
    ln(bx + s, bz - s, bx + s, bz + s);
    ln(bx + s, bz + s, bx - s, bz + s);
    ln(bx - s, bz + s, bx - s, bz - s);
    zebra(bx - s - 2, bz, true, 12);
    zebra(bx, bz - s - 2, false, 8);
  }

  const meshes: Array<[Strip, Material, string]> = [
    [asphalt, M.asphalt, 'Asfalto'],
    [walk, M.sidewalk, 'Calcadas'],
    [curb, M.curb, 'Guias'],
    [white, M.markingWhite, 'FaixasBrancas'],
    [yellow, M.markingYellow, 'FaixasAmarelas'],
  ];
  for (const [s, m, n] of meshes) {
    const mesh = toMesh(s, m, n);
    if (!mesh) continue;
    if (n === 'FaixasBrancas' || n === 'FaixasAmarelas' || n === 'Asfalto') {
      const mat = mesh.material as Material;
      mat.polygonOffset = true;
      mat.polygonOffsetFactor = -1;
      mat.polygonOffsetUnits = -1;
    }
    group.add(mesh);
    if (n === 'Calcadas' || n === 'Guias') colliders.push(mesh);
  }
  return { group, colliders };
}

/** Postes de concreto ao longo das ruas, com fiação (marca forte das ruas de Carapicuíba). */
export function buildPoles(roads: RoadDef[], hf: Heightfield, M: CityMats, addBox: (w: number, h: number, d: number, x: number, y: number, z: number, m: Material, collide?: boolean) => void): Group {
  const wires: number[] = [];
  for (const road of roads) {
    if (road.width < 6) continue;
    const off = road.width / 2 + road.sidewalk - 0.4;
    let prev: Vector3 | null = null;
    let acc = 0;
    for (let k = 0; k < road.pts.length - 1; k++) {
      const [ax, az] = road.pts[k];
      const [bx, bz] = road.pts[k + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      for (let d = 12 - acc; d < len; d += 32) {
        const x = ax + ((bx - ax) * d) / len + nx * off;
        const z = az + ((bz - az) * d) / len + nz * off;
        const y = hf.heightAt(x, z) + 0.17;
        addBox(0.26, 9, 0.26, x, y + 4.5, z, M.concrete, true);
        addBox(1.6, 0.12, 0.12, x, y + 8.4, z, M.concrete, false);
        addBox(0.35, 0.5, 0.35, x + nx * 0.3, y + 7.6, z + nz * 0.3, M.concreteDark, false);
        const top = new Vector3(x, y + 8.45, z);
        if (prev) {
          for (const dy of [0, -0.25, -0.6]) {
            wires.push(prev.x, prev.y + dy, prev.z, top.x, top.y + dy - 0.35, top.z);
          }
        }
        prev = top;
        acc = len - d;
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(wires, 3));
  const lines = new LineSegments(g, new LineBasicMaterial({ color: 0x3a3a3a, transparent: true, opacity: 0.6 }));
  lines.name = 'Fiacao';
  const grp = new Group();
  grp.add(lines);
  return grp;
}
