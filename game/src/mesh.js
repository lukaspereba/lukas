// Montagem de modelos procedurais: funde primitivas transformadas em uma única malha com cor por vértice.
import * as THREE from 'three';

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 8), cyl12: new THREE.CylinderGeometry(1, 1, 1, 14), cylT: new THREE.CylinderGeometry(0.8, 1, 1, 8),
  sph: new THREE.SphereGeometry(1, 10, 8), sphHi: new THREE.SphereGeometry(1, 16, 12), ico: new THREE.IcosahedronGeometry(1, 0), ico1: new THREE.IcosahedronGeometry(1, 1), cone: new THREE.ConeGeometry(1, 1, 8),
  cap: new THREE.CapsuleGeometry(1, 2, 3, 8), hemi: new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), tor: new THREE.TorusGeometry(1, 0.12, 5, 12), wedge: null,
};
export const VMAT = new THREE.MeshLambertMaterial({ vertexColors: true });
export const VMAT_DS = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), Sc = new THREE.Vector3(), V = new THREE.Vector3(), N = new THREE.Vector3(), NM = new THREE.Matrix3(), C = new THREE.Color();
// specs: [geoKey, [x,y,z, sx,sy,sz, rx,ry,rz], corHex]
export function part(specs) {
  let nv = 0, ni = 0; for (const s of specs) { const g = GEO[s[0]]; if (!g) throw new Error('geo ' + s[0]); nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni); let vo = 0, io = 0;
  for (const s of specs) { const g = GEO[s[0]], t = s[1]; E.set(t[6] || 0, t[7] || 0, t[8] || 0, 'YXZ'); Q.setFromEuler(E); M.compose(P.set(t[0], t[1], t[2]), Q, Sc.set(t[3], t[4], t[5])); NM.getNormalMatrix(M); C.setHex(s[2]);
    const gp = g.attributes.position, gn = g.attributes.normal;
    for (let i = 0; i < gp.count; i++) { V.fromBufferAttribute(gp, i).applyMatrix4(M); N.fromBufferAttribute(gn, i).applyMatrix3(NM).normalize(); const k = (vo + i) * 3; pos[k] = V.x; pos[k + 1] = V.y; pos[k + 2] = V.z; nor[k] = N.x; nor[k + 1] = N.y; nor[k + 2] = N.z; col[k] = C.r; col[k + 1] = C.g; col[k + 2] = C.b; }
    if (g.index) { const gi = g.index.array; for (let i = 0; i < gi.length; i++) idx[io + i] = gi[i] + vo; io += gi.length; } else { for (let i = 0; i < gp.count; i++) idx[io + i] = vo + i; io += gp.count; } vo += gp.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere(); return out;
}
export function mesh(specs, mat = VMAT) { const m = new THREE.Mesh(part(specs), mat); return m; }
export const shade = (hex, f) => { C.setHex(hex); C.multiplyScalar(f); return C.getHex(); };
