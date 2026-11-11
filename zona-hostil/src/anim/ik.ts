// Utilidades de pose: rotações em espaço de mundo e IK analítico de duas articulações.

import { Bone, Object3D, Quaternion, Vector3 } from 'three';

const _q = new Quaternion();
const _pq = new Quaternion();
const _wq = new Quaternion();
const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _t = new Vector3();
const _v1 = new Vector3();
const _v2 = new Vector3();
const _axis = new Vector3();

/** Aplica rotação `q` (espaço de mundo) ao osso, preservando a hierarquia. */
export function rotateBoneWorld(bone: Object3D, q: Quaternion): void {
  const parent = bone.parent;
  if (!parent) return;
  parent.getWorldQuaternion(_pq);
  bone.getWorldQuaternion(_wq);
  _wq.premultiply(q);
  bone.quaternion.copy(_pq.invert().multiply(_wq));
  bone.updateMatrixWorld(true);
}

export function rotateBoneWorldAxis(bone: Object3D, axis: Vector3, angle: number): void {
  if (Math.abs(angle) < 1e-6) return;
  _q.setFromAxisAngle(axis, angle);
  rotateBoneWorld(bone, _q);
}

/** Define a orientação de mundo do osso (mantendo-a mesmo após mexer nos pais). */
export function setBoneWorldQuaternion(bone: Object3D, worldQ: Quaternion): void {
  const parent = bone.parent;
  if (!parent) return;
  parent.getWorldQuaternion(_pq);
  bone.quaternion.copy(_pq.invert().multiply(worldQ));
  bone.updateMatrixWorld(true);
}

/** Gira o osso para que o segmento osso->filho aponte para `dir` (mundo). */
export function aimBone(bone: Bone, child: Object3D, dir: Vector3, weight = 1): void {
  bone.getWorldPosition(_a);
  child.getWorldPosition(_b);
  _v1.subVectors(_b, _a).normalize();
  _v2.copy(dir).normalize();
  _q.setFromUnitVectors(_v1, _v2);
  if (weight < 1) _q.slerp(new Quaternion(), 1 - weight);
  rotateBoneWorld(bone, _q);
}

/** Desloca um osso em espaço de mundo (via posição local do pai). */
export function translateBoneWorld(bone: Object3D, delta: Vector3): void {
  const parent = bone.parent;
  if (!parent) return;
  parent.getWorldQuaternion(_pq);
  parent.getWorldScale(_t);
  _v1.copy(delta).applyQuaternion(_pq.invert()).divide(_t);
  bone.position.add(_v1);
  bone.updateMatrixWorld(true);
}

/**
 * IK de duas articulações (coxa-canela-pé ou braço-antebraço-mão).
 * Mantém o plano de dobra atual (ou o polo indicado) e preserva a orientação de mundo da extremidade.
 */
export function solveTwoBone(upper: Bone, lower: Bone, end: Bone, target: Vector3, pole?: Vector3): void {
  end.getWorldQuaternion(_wq);
  const endQ = _wq.clone();
  upper.getWorldPosition(_a);
  lower.getWorldPosition(_b);
  end.getWorldPosition(_c);
  const l1 = _a.distanceTo(_b);
  const l2 = _b.distanceTo(_c);
  _t.copy(target);
  const toT = _v1.subVectors(_t, _a);
  let dist = toT.length();
  const maxReach = (l1 + l2) * 0.9995;
  const minReach = Math.abs(l1 - l2) + 1e-3;
  if (dist > maxReach) {
    toT.multiplyScalar(maxReach / dist);
    dist = maxReach;
  } else if (dist < minReach) {
    toT.multiplyScalar(minReach / Math.max(dist, 1e-6));
    dist = minReach;
  }
  const dirT = toT.clone().normalize();
  // direção de dobra: componente do joelho atual (ou polo) perpendicular ao eixo quadril-alvo
  const bendRef = pole ? _v2.copy(pole).sub(_a) : _v2.subVectors(_b, _a);
  bendRef.addScaledVector(dirT, -bendRef.dot(dirT));
  if (bendRef.lengthSq() < 1e-8) bendRef.set(0, 0, 1).addScaledVector(dirT, -dirT.z);
  bendRef.normalize();
  // lei dos cossenos
  const cosA = Math.min(1, Math.max(-1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist)));
  const angA = Math.acos(cosA);
  const kneeNew = _a.clone().addScaledVector(dirT, Math.cos(angA) * l1).addScaledVector(bendRef, Math.sin(angA) * l1);
  // gira o segmento superior
  _q.setFromUnitVectors(_axis.subVectors(_b, _a).normalize(), kneeNew.clone().sub(_a).normalize());
  rotateBoneWorld(upper, _q);
  // gira o segmento inferior
  lower.getWorldPosition(_b);
  end.getWorldPosition(_c);
  const endTarget = _a.clone().add(toT);
  _q.setFromUnitVectors(_axis.subVectors(_c, _b).normalize(), endTarget.sub(_b).normalize());
  rotateBoneWorld(lower, _q);
  setBoneWorldQuaternion(end, endQ);
}
