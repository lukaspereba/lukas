// Mundo de colisão estático: terreno (heightfield analítico) + malhas estáticas aceleradas por BVH.

import { Box3, BufferGeometry, Float32BufferAttribute, Line3, Matrix4, Mesh, Ray, Vector3, DoubleSide } from 'three';
import { MeshBVH } from 'three-mesh-bvh';
import type { Heightfield } from '../world/Heightfield';

export interface Contact {
  normal: Vector3;
  depth: number;
  /** 'terrain' | 'mesh' */
  kind: 'terrain' | 'mesh';
}

export interface RayHit {
  point: Vector3;
  normal: Vector3;
  distance: number;
  kind: 'terrain' | 'mesh';
}

const _box = new Box3();
const _seg = new Line3();
const _triPt = new Vector3();
const _segPt = new Vector3();
const _v = new Vector3();
const _n = new Vector3();
const _ray = new Ray();

export class CollisionWorld {
  private bvh: MeshBVH | null = null;
  private geometry: BufferGeometry | null = null;
  readonly staticMeshes: Mesh[] = [];

  constructor(readonly terrain: Heightfield | null) {}

  /** Adiciona malhas (em coordenadas de mundo) e reconstrói a BVH. */
  setStatic(meshes: Mesh[]): void {
    this.staticMeshes.length = 0;
    this.staticMeshes.push(...meshes);
    const positions: number[] = [];
    const m = new Matrix4();
    for (const mesh of meshes) {
      mesh.updateWorldMatrix(true, false);
      m.copy(mesh.matrixWorld);
      const g = mesh.geometry;
      const pos = g.attributes.position;
      const idx = g.index;
      const count = idx ? idx.count : pos.count;
      for (let k = 0; k < count; k++) {
        const vi = idx ? idx.getX(k) : k;
        _v.fromBufferAttribute(pos, vi).applyMatrix4(m);
        positions.push(_v.x, _v.y, _v.z);
      }
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.geometry?.dispose();
    this.geometry = geo;
    this.bvh = positions.length ? new MeshBVH(geo) : null;
  }

  get triangleCount(): number {
    return this.geometry ? this.geometry.attributes.position.count / 3 : 0;
  }

  groundHeight(x: number, z: number): number {
    return this.terrain ? this.terrain.heightAt(x, z) : 0;
  }

  /**
   * Contatos da cápsula vertical com base em `feet` (ponto mais baixo), raio r e altura h.
   * As profundidades são relativas ao raio.
   */
  capsuleContacts(feet: Vector3, radius: number, height: number, out: Contact[]): Contact[] {
    out.length = 0;
    const a = _seg.start.set(feet.x, feet.y + radius, feet.z);
    const b = _seg.end.set(feet.x, feet.y + Math.max(height - radius, radius), feet.z);
    if (this.bvh) {
      _box.makeEmpty();
      _box.expandByPoint(a);
      _box.expandByPoint(b);
      _box.expandByScalar(radius);
      this.bvh.shapecast({
        intersectsBounds: (box) => box.intersectsBox(_box),
        intersectsTriangle: (tri) => {
          const d = tri.closestPointToSegment(_seg, _triPt, _segPt);
          if (d < radius) {
            const nrm = new Vector3();
            if (d > 1e-5) nrm.subVectors(_segPt, _triPt).divideScalar(d);
            else tri.getNormal(nrm);
            out.push({ normal: nrm, depth: radius - d, kind: 'mesh' });
          }
          return false;
        },
      });
    }
    if (this.terrain) {
      const t = this.terrain;
      const cx = a.x;
      const cz = a.z;
      const h = t.heightAt(cx, cz);
      t.normalAt(cx, cz, _n);
      const dist = (a.y - h) * _n.y;
      if (dist < radius) out.push({ normal: _n.clone(), depth: radius - dist, kind: 'terrain' });
    }
    return out;
  }

  /** Verdadeiro se a cápsula interpenetra algo além da tolerância. */
  capsuleBlocked(feet: Vector3, radius: number, height: number, tolerance = 0.01): boolean {
    const c: Contact[] = [];
    this.capsuleContacts(feet, radius, height, c);
    return c.some((k) => k.depth > tolerance);
  }

  raycast(origin: Vector3, dir: Vector3, maxDist: number, includeTerrain = true): RayHit | null {
    let best: RayHit | null = null;
    if (this.bvh) {
      _ray.origin.copy(origin);
      _ray.direction.copy(dir);
      const hit = this.bvh.raycastFirst(_ray, DoubleSide);
      if (hit && hit.distance <= maxDist) {
        const nrm = hit.face ? hit.face.normal.clone() : new Vector3(0, 1, 0);
        if (nrm.dot(dir) > 0) nrm.negate();
        best = { point: hit.point.clone(), normal: nrm, distance: hit.distance, kind: 'mesh' };
      }
    }
    if (includeTerrain && this.terrain) {
      const limit = best ? best.distance : maxDist;
      const th = this.raycastTerrain(origin, dir, limit);
      if (th) best = th;
    }
    return best;
  }

  /** Marcha ao longo do raio sobre o heightfield com refinamento binário. */
  raycastTerrain(origin: Vector3, dir: Vector3, maxDist: number): RayHit | null {
    const t = this.terrain;
    if (!t) return null;
    const step = Math.max(t.cell * 0.5, 0.25);
    let prev = 0;
    let prevAbove = origin.y - t.heightAt(origin.x, origin.z);
    if (prevAbove < 0) return null;
    for (let s = step; s <= maxDist + step; s += step) {
      const d = Math.min(s, maxDist);
      const x = origin.x + dir.x * d;
      const y = origin.y + dir.y * d;
      const z = origin.z + dir.z * d;
      const above = y - t.heightAt(x, z);
      if (above <= 0) {
        let lo = prev;
        let hi = d;
        for (let k = 0; k < 10; k++) {
          const mid = (lo + hi) * 0.5;
          const my = origin.y + dir.y * mid - t.heightAt(origin.x + dir.x * mid, origin.z + dir.z * mid);
          if (my > 0) lo = mid;
          else hi = mid;
        }
        const p = new Vector3().copy(origin).addScaledVector(dir, hi);
        return { point: p, normal: t.normalAt(p.x, p.z), distance: hi, kind: 'terrain' };
      }
      prev = d;
      prevAbove = above;
      if (d >= maxDist) break;
    }
    return null;
  }
}
