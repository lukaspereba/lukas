// Personagem animado: soldado (malha MakeHuman + equipamento) + clipes de mocap redirecionados.
// Camadas: locomoção (blend 2D com sincronia de fase) -> orientação das pernas -> mira (tronco)
// -> agachar/deslizar (IK de pernas) -> pose deitada procedural -> adaptação dos pés ao terreno.

import {
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Bone,
  Group,
  KeyframeTrack,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SkinnedMesh,
  Vector3,
  VectorKeyframeTrack,
} from 'three';
import { aimBone, rotateBoneWorldAxis, solveTwoBone, translateBoneWorld } from './ik';

export interface ClipMeta {
  duration: number;
  speed: number;
  loop: boolean;
  liftoff?: number;
  land?: number;
}

export interface AnimMeta {
  clips: Record<string, ClipMeta>;
  hipHeight: number;
}

export type Stance = 'stand' | 'crouch' | 'prone';

export interface CharacterAnimInput {
  /** velocidade no espaço do personagem (m/s): x = direita, z = frente */
  velX: number;
  velZ: number;
  crouch: number; // 0..1 suavizado
  prone: number; // 0..1 suavizado
  grounded: boolean;
  airTime: number;
  vy: number;
  slide: number; // 0..1
  mantle: number; // 0..1
  aimPitch: number; // rad (+ = para cima)
  /** diferença entre a direção da câmera e a do corpo (rad, + = esquerda); a cabeça acompanha */
  aimYaw?: number;
  hideHead: boolean;
  justJumped: boolean;
  justLanded: boolean;
  groundAt?: (x: number, z: number, y0: number) => number | null;
}

const ANIMATED = new Set([
  'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'head',
  'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l', 'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r',
  'thigh_l', 'calf_l', 'foot_l', 'ball_l', 'thigh_r', 'calf_r', 'foot_r', 'ball_r',
]);
const LOCO = ['idle', 'walk', 'run', 'sprint', 'walk_back', 'strafe_l', 'strafe_r'] as const;
type Loco = (typeof LOCO)[number];

const UP = new Vector3(0, 1, 0);
const _v = new Vector3();
const _w = new Vector3();
const _f = new Vector3();
const _r = new Vector3();
const _q = new Quaternion();

/** Filtra trilhas: só rotações dos ossos mapeados + translação da pelve (escalada pela altura). */
export function prepareClip(clip: AnimationClip, hipScale: number): AnimationClip {
  const tracks: KeyframeTrack[] = [];
  for (const t of clip.tracks) {
    const [node, prop] = t.name.split('.');
    if (prop === 'quaternion' && ANIMATED.has(node)) tracks.push(t);
    else if (prop === 'position' && node === 'pelvis') {
      const v = (t as VectorKeyframeTrack).values.slice();
      for (let i = 0; i < v.length; i++) v[i] *= hipScale;
      tracks.push(new VectorKeyframeTrack(t.name, Array.from(t.times), Array.from(v)));
    }
  }
  const c = new AnimationClip(clip.name, clip.duration, tracks);
  c.optimize();
  return c;
}

export class CharacterModel {
  readonly root: Group;
  readonly bones = new Map<string, Bone>();
  readonly meshes: SkinnedMesh[] = [];
  readonly mixer: AnimationMixer;
  private actions = new Map<string, AnimationAction>();
  private phase = 0;
  private phaseOffset = new Map<string, number>();
  private legYaw = 0;
  private crawlPhase = 0;
  private headHidden = false;
  /** orientação de bind (relativa à raiz) para estabilizar a cabeça */
  private bindHeadQ = new Quaternion();
  private airW = 0;
  /** pose puramente animada do quadro anterior (o mixer só reescreve ossos cujo valor mudou) */
  private animPose: Array<{ bone: Bone; q: Quaternion; p: Vector3 }> = [];
  private landDip = 0;
  readonly hipHeight: number;

  constructor(scene: Group, rawClips: AnimationClip[], private meta: AnimMeta) {
    this.root = scene;
    scene.traverse((o: Object3D) => {
      if ((o as Bone).isBone) this.bones.set(o.name, o as Bone);
      const sm = o as SkinnedMesh;
      if (sm.isSkinnedMesh || (o as Mesh).isMesh) {
        const m = o as Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        const mat = m.material as MeshStandardMaterial;
        if (/Eyebrows|Eyelashes/i.test(mat.name)) {
          mat.alphaTest = 0.35;
          mat.transparent = false;
          mat.depthWrite = true;
          mat.polygonOffset = true;
          mat.polygonOffsetFactor = -2;
          mat.polygonOffsetUnits = -2;
          m.castShadow = false;
        }
        if (sm.isSkinnedMesh) this.meshes.push(sm);
      }
    });
    scene.updateMatrixWorld(true);
    this.bindHeadQ.copy(scene.getWorldQuaternion(new Quaternion()).invert().multiply(this.bone('head').getWorldQuaternion(new Quaternion())));
    const pelvis = this.bone('pelvis');
    this.hipHeight = pelvis.getWorldPosition(new Vector3()).y - scene.getWorldPosition(new Vector3()).y;
    const hipScale = this.hipHeight / meta.hipHeight;
    this.mixer = new AnimationMixer(scene);
    for (const raw of rawClips) {
      const clip = prepareClip(raw, hipScale);
      const a = this.mixer.clipAction(clip);
      a.enabled = true;
      a.setEffectiveWeight(0);
      a.play();
      a.timeScale = 0; // tempo controlado manualmente
      this.actions.set(clip.name, a);
    }
    this.computePhaseOffsets();
  }

  bone(name: string): Bone {
    const b = this.bones.get(name);
    if (!b) throw new Error(`osso ausente: ${name}`);
    return b;
  }

  /** Fase em que o pé esquerdo está mais à frente na direção de deslocamento de cada ciclo. */
  private computePhaseOffsets(): void {
    const fl = this.bone('foot_l');
    const fr = this.bone('foot_r');
    const axis: Record<string, Vector3> = {
      walk: new Vector3(0, 0, 1), run: new Vector3(0, 0, 1), sprint: new Vector3(0, 0, 1),
      walk_back: new Vector3(0, 0, -1), strafe_l: new Vector3(1, 0, 0), strafe_r: new Vector3(-1, 0, 0),
    };
    for (const [name, ax] of Object.entries(axis)) {
      const a = this.actions.get(name);
      if (!a) continue;
      for (const o of this.actions.values()) o.setEffectiveWeight(0);
      a.setEffectiveWeight(1);
      const dur = a.getClip().duration;
      let best = -Infinity;
      let bestP = 0;
      const N = 40;
      for (let i = 0; i < N; i++) {
        a.time = (i / N) * dur;
        this.mixer.update(0);
        this.root.updateMatrixWorld(true);
        const d = fl.getWorldPosition(_v).sub(fr.getWorldPosition(_w));
        this.root.worldToLocal(_f.copy(d).add(this.root.getWorldPosition(_r)));
        const s = _f.dot(ax);
        if (s > best) {
          best = s;
          bestP = i / N;
        }
      }
      this.phaseOffset.set(name, bestP);
      a.setEffectiveWeight(0);
    }
  }

  private setLoco(name: Loco, weight: number, phase: number): void {
    const a = this.actions.get(name);
    if (!a) return;
    a.setEffectiveWeight(weight);
    // o "parado" tem tempo próprio (respiração), não segue a fase da passada
    if (weight > 0 && name !== 'idle') {
      const dur = a.getClip().duration;
      const off = this.phaseOffset.get(name) ?? 0;
      a.time = (((phase + off) % 1) + 1) % 1 * dur;
    }
  }

  /** Coloca as malhas numa camada de renderização (a sombra continua sendo projetada). */
  setLayer(layer: number): void {
    for (const m of this.meshes) m.layers.set(layer);
  }

  setHeadHidden(hidden: boolean): void {
    this.headHidden = hidden;
  }

  update(dt: number, s: CharacterAnimInput): void {
    const speed = Math.hypot(s.velX, s.velZ);
    const M = this.meta.clips;
    const walkS = M.walk.speed;
    const runS = M.run.speed;
    const sprintS = M.sprint.speed;

    // ---------------- pesos de locomoção ----------------
    const w: Record<Loco, number> = { idle: 0, walk: 0, run: 0, sprint: 0, walk_back: 0, strafe_l: 0, strafe_r: 0 };
    const rate: Record<Loco, number> = { idle: 1, walk: 1, run: 1, sprint: 1, walk_back: 1, strafe_l: 1, strafe_r: 1 };
    const moving = MathUtils.smoothstep(speed, 0.08, 0.7);
    w.idle = 1 - moving;
    let targetLegYaw = 0;
    if (moving > 0) {
      const theta = Math.atan2(s.velX, s.velZ); // 0 = frente, + = direita
      const absT = Math.abs(theta);
      const slowSide = (1 - MathUtils.smoothstep(speed, 1.0, 1.8)) * MathUtils.smoothstep(Math.abs(Math.sin(theta)), 0.75, 0.95) * (1 - s.crouch);
      if (absT <= 1.95) {
        // frente/diagonais: clipes de frente com as pernas orientadas ao movimento
        targetLegYaw = MathUtils.clamp(theta, -1.2, 1.2) * (1 - slowSide);
        const fw = moving * (1 - slowSide);
        if (speed <= walkS) {
          w.walk = fw;
          rate.walk = Math.max(0.55, speed / walkS);
        } else if (speed <= runS) {
          const k = (speed - walkS) / (runS - walkS);
          w.walk = fw * (1 - k);
          w.run = fw * k;
          rate.walk = rate.run = speed / (walkS * (1 - k) + runS * k);
        } else {
          const k = MathUtils.clamp((speed - runS) / (sprintS - runS), 0, 1);
          w.run = fw * (1 - k);
          w.sprint = fw * k;
          rate.run = rate.sprint = Math.min(1.35, speed / (runS * (1 - k) + sprintS * k));
        }
      } else {
        // para trás: clipe de ré, pernas orientadas ao oposto do movimento
        const back = theta > 0 ? theta - Math.PI : theta + Math.PI;
        targetLegYaw = MathUtils.clamp(back, -1.0, 1.0) * (1 - slowSide);
        w.walk_back = moving * (1 - slowSide);
        rate.walk_back = MathUtils.clamp(speed / M.walk_back.speed, 0.6, 2.4);
      }
      if (slowSide > 0) {
        const side: Loco = s.velX > 0 ? 'strafe_r' : 'strafe_l';
        w[side] = moving * slowSide;
        rate[side] = MathUtils.clamp(speed / M[side].speed, 0.6, 2.2);
      }
    }
    // avanço da fase (ciclo efetivo ponderado)
    let invCycle = 0;
    let totalW = 0;
    for (const n of LOCO) {
      if (n === 'idle' || w[n] <= 0) continue;
      invCycle += (w[n] * rate[n]) / M[n].duration;
      totalW += w[n];
    }
    if (totalW > 0) this.phase = (this.phase + (dt * invCycle * (1 - 0.85 * this.airW)) / totalW) % 1;
    const idleA = this.actions.get('idle');
    if (idleA) idleA.time = (idleA.time + dt) % idleA.getClip().duration;

    // ---------------- pulo / queda ----------------
    // Pose aérea procedural (joelhos dobrados, braços estáveis) + compressão no pouso.
    // O clipe de pulo da captura (salto vertical parado) deixava braços e pernas estranhos.
    const airborne = (!s.grounded && s.airTime > 0.06) || s.justJumped || s.mantle > 0;
    this.airW += ((airborne ? 1 : 0) - this.airW) * Math.min(1, dt * (airborne ? 12 : 9));
    if (s.justLanded) this.landDip = 0.13;
    this.landDip = Math.max(0, this.landDip - dt * 0.6);
    const jumpW = 0;
    this.actions.get('jump')?.setEffectiveWeight(0);
    const locoScale = 1 - jumpW;
    // durante o deslize, congela um quadro de corrida com a perna esquerda à frente
    const phase = s.slide > 0.01 ? 0.0 : this.phase;
    // deslize: parte da pose parada (pés lado a lado) e a IK estica a perna da frente
    const sl = MathUtils.clamp(s.slide, 0, 1);
    for (const n of LOCO) if (n !== 'idle') w[n] *= 1 - sl;
    w.idle = w.idle * (1 - sl) + sl;
    for (const n of LOCO) this.setLoco(n, w[n] * locoScale, n === 'idle' ? 0 : phase);
    if (idleA) idleA.setEffectiveWeight(w.idle * locoScale);

    // restaura a pose animada pura antes do mixer: sem isso, ossos cujo valor animado não mudou
    // manteriam as correções procedurais do quadro anterior e elas se acumulariam
    for (const a of this.animPose) {
      a.bone.quaternion.copy(a.q);
      a.bone.position.copy(a.p);
    }
    this.mixer.update(0);
    if (this.animPose.length === 0) {
      for (const name of ANIMATED) {
        const b = this.bones.get(name);
        if (b) this.animPose.push({ bone: b, q: new Quaternion(), p: new Vector3() });
      }
    }
    for (const a of this.animPose) {
      a.q.copy(a.bone.quaternion);
      a.p.copy(a.bone.position);
    }
    this.root.updateMatrixWorld(true);

    // ---------------- pós-processamento procedural ----------------
    this.root.getWorldDirection(_f); // frente do modelo (+Z local)
    _f.y = 0;
    _f.normalize();
    _r.crossVectors(_f, UP).normalize(); // direita do personagem
    this.legYaw += (targetLegYaw - this.legYaw) * Math.min(1, dt * 8);
    const legYaw = this.legYaw * (1 - s.prone) * (1 - s.slide);

    const pelvis = this.bone('pelvis');
    const sp1 = this.bone('spine_01');
    const sp2 = this.bone('spine_02');
    const sp3 = this.bone('spine_03');
    const neck = this.bone('neck_01');
    const head = this.bone('head');

    if (s.prone < 0.999) {
      // pernas para o movimento, tronco de volta para a mira
      rotateBoneWorldAxis(pelvis, UP, -legYaw);
      rotateBoneWorldAxis(sp1, UP, legYaw * 0.35);
      rotateBoneWorldAxis(sp2, UP, legYaw * 0.3);
      rotateBoneWorldAxis(sp3, UP, legYaw * 0.35);
      // cabeça nivelada: cada ator da captura segurava a cabeça de um jeito (até 38° para cima)
      const hp = this.headPitch();
      rotateBoneWorldAxis(neck, _r, -hp * 0.35);
      rotateBoneWorldAxis(head, _r, -hp * 0.65);
      // cabeça acompanha a direção da câmera quando o corpo está virado para o movimento
      const yaw = MathUtils.clamp(s.aimYaw ?? 0, -1.1, 1.1);
      rotateBoneWorldAxis(neck, UP, yaw * 0.4);
      rotateBoneWorldAxis(head, UP, yaw * 0.6);
      // braços levemente afastados para não atravessar colete e porta-carregadores
      const abd = 0.17 + 0.2 * this.airW;
      rotateBoneWorldAxis(this.bone('upperarm_l'), _f, abd);
      rotateBoneWorldAxis(this.bone('upperarm_r'), _f, -abd);
      if (this.airW > 0.01) {
        // joelhos dobrados no ar (assimétrico, como um salto real)
        const a = this.airW;
        rotateBoneWorldAxis(this.bone('thigh_l'), _r, 0.5 * a);
        rotateBoneWorldAxis(this.bone('thigh_r'), _r, 0.22 * a);
        rotateBoneWorldAxis(this.bone('calf_l'), _r, -0.95 * a);
        rotateBoneWorldAxis(this.bone('calf_r'), _r, -0.55 * a);
      }
      // mira vertical distribuída na coluna
      const pitch = MathUtils.clamp(s.aimPitch, -1.2, 1.2) * (1 - s.prone);
      rotateBoneWorldAxis(sp1, _r, pitch * 0.06);
      rotateBoneWorldAxis(sp2, _r, pitch * 0.08);
      rotateBoneWorldAxis(sp3, _r, pitch * 0.12);
      rotateBoneWorldAxis(neck, _r, pitch * 0.3);
      rotateBoneWorldAxis(head, _r, pitch * 0.4);
    }

    // agachar / deslizar: abaixa a pelve mantendo os pés (IK) e inclina o tronco
    const crouchDrop = 0.36 * s.crouch * (1 - s.prone) + 0.5 * s.slide + this.landDip * (1 - s.prone);
    const footTargets = this.captureFeet();
    let terrainDrop = 0;
    if (s.groundAt && s.prone < 0.5 && s.grounded && this.airW < 0.3) terrainDrop = this.adaptFeetToGround(footTargets, s.groundAt);
    if (s.slide > 0.01) {
      // perna da frente estendida, trás dobrada
      footTargets[0].addScaledVector(_f, 0.55 * s.slide);
      footTargets[1].addScaledVector(_f, -0.1 * s.slide);
      footTargets[1].addScaledVector(_r, 0.08 * s.slide);
    }
    const drop = crouchDrop + terrainDrop;
    if (drop > 1e-3 && s.prone < 0.999) {
      translateBoneWorld(pelvis, _v.set(0, -drop, 0));
      // agachado inclina para frente; no deslize o tronco vai para trás
      rotateBoneWorldAxis(sp1, _r, -0.18 * s.crouch * (1 - sl) + 0.32 * sl);
      rotateBoneWorldAxis(sp2, _r, -0.08 * s.crouch * (1 - sl) + 0.12 * sl);
    }
    if (s.prone < 0.999 && (drop > 1e-3 || terrainDrop !== 0)) {
      const poleL = this.bone('calf_l').getWorldPosition(new Vector3()).addScaledVector(_f, 0.5);
      const poleR = this.bone('calf_r').getWorldPosition(new Vector3()).addScaledVector(_f, 0.5);
      solveTwoBone(this.bone('thigh_l'), this.bone('calf_l'), this.bone('foot_l'), footTargets[0], poleL);
      solveTwoBone(this.bone('thigh_r'), this.bone('calf_r'), this.bone('foot_r'), footTargets[1], poleR);
    }

    if (s.prone > 0.001) this.applyProne(dt, s, speed);

    head.scale.setScalar(this.headHidden || s.hideHead ? 0.001 : 1);
  }

  /** Inclinação vertical do rosto (rad, + = para cima) relativa à pose de bind, no espaço do modelo. */
  private headPitch(): number {
    const rootQ = this.root.getWorldQuaternion(_q).invert();
    const hq = this.bone('head').getWorldQuaternion(new Quaternion()).premultiply(rootQ);
    hq.multiply(this.bindHeadQ.clone().invert());
    const fwd = _v.set(0, 0, 1).applyQuaternion(hq);
    return Math.asin(MathUtils.clamp(fwd.y, -1, 1));
  }

  private captureFeet(): [Vector3, Vector3] {
    return [this.bone('foot_l').getWorldPosition(new Vector3()), this.bone('foot_r').getWorldPosition(new Vector3())];
  }

  /** Ajusta alvos dos pés à altura do chão; devolve quanto a pelve deve descer. */
  private adaptFeetToGround(feet: [Vector3, Vector3], groundAt: (x: number, z: number, y0: number) => number | null): number {
    const base = this.root.getWorldPosition(_w).y;
    const ankle = 0.09;
    let minOff = 0;
    for (const p of feet) {
      const gy = groundAt(p.x, p.z, base);
      if (gy === null) continue;
      const off = MathUtils.clamp(gy - base, -0.45, 0.45);
      // só corrige pés próximos do chão (não mexe no pé que está no ar durante a passada)
      const lift = p.y - base - ankle;
      const k = 1 - MathUtils.smoothstep(lift, 0.05, 0.2);
      p.y += off * k;
      minOff = Math.min(minOff, off * k);
    }
    return -minOff;
  }

  /** Pose deitada (procedural) com rastejo alternado proporcional à velocidade. */
  private applyProne(dt: number, s: CharacterAnimInput, speed: number): void {
    const k = MathUtils.smoothstep(s.prone, 0, 1);
    const pelvis = this.bone('pelvis');
    this.crawlPhase = (this.crawlPhase + dt * speed * 2.2) % (Math.PI * 2);
    const c = Math.sin(this.crawlPhase);
    const moveK = MathUtils.smoothstep(speed, 0.05, 0.4);
    const base = this.root.getWorldPosition(new Vector3());
    // inclinação do terreno sob o corpo (peito x pés) para não afundar em rampas
    let slope = 0;
    let groundPelvis = base.y;
    if (s.groundAt) {
      const pc = base.clone().addScaledVector(_f, 0.55);
      const pf = base.clone().addScaledVector(_f, -1.05);
      const pp = base.clone().addScaledVector(_f, -0.35);
      const hc = s.groundAt(pc.x, pc.z, base.y + 0.4) ?? base.y;
      const hf = s.groundAt(pf.x, pf.z, base.y + 0.4) ?? base.y;
      groundPelvis = Math.max(base.y, s.groundAt(pp.x, pp.z, base.y + 0.4) ?? base.y);
      slope = MathUtils.clamp(Math.atan2(hc - hf, 1.6), -0.6, 0.6);
    }
    // gira o corpo inteiro para a horizontal (barriga para baixo), seguindo a rampa
    rotateBoneWorldAxis(pelvis, _r, (-(Math.PI / 2 - 0.08) + slope) * k);
    const pw = pelvis.getWorldPosition(new Vector3());
    const want = base.clone().addScaledVector(_f, -0.35 * k);
    want.y = groundPelvis + 0.23 * k + (pw.y - groundPelvis) * (1 - k);
    want.x = pw.x + (want.x - pw.x) * k;
    want.z = pw.z + (want.z - pw.z) * k;
    translateBoneWorld(pelvis, want.sub(pw));
    // cabeça e pescoço olhando para frente
    rotateBoneWorldAxis(this.bone('spine_03'), _r, 0.18 * k);
    rotateBoneWorldAxis(this.bone('neck_01'), _r, 0.6 * k);
    rotateBoneWorldAxis(this.bone('head'), _r, 0.35 * k + s.aimPitch * 0.3 * k);
    // braços à frente (apoiados nos cotovelos), alternando no rastejo
    for (const side of ['l', 'r'] as const) {
      const sg = side === 'l' ? 1 : -1;
      const reach = moveK * (side === 'l' ? c : -c) * 0.25;
      const ua = this.bone(`upperarm_${side}`);
      const la = this.bone(`lowerarm_${side}`);
      const hand = this.bone(`hand_${side}`);
      const sideV = _r.clone().multiplyScalar(-sg);
      aimBone(ua, la, _v.copy(_f).multiplyScalar(0.55 + reach).add(UP.clone().multiplyScalar(-0.75)).addScaledVector(sideV, 0.35), k);
      aimBone(la, hand, _v.copy(_f).multiplyScalar(0.9).addScaledVector(sideV, -0.45).add(UP.clone().multiplyScalar(-0.05)), k);
      // pernas estendidas para trás, joelho dobrando no rastejo
      const th = this.bone(`thigh_${side}`);
      const cf = this.bone(`calf_${side}`);
      const ft = this.bone(`foot_${side}`);
      const bend = moveK * Math.max(0, side === 'l' ? c : -c);
      aimBone(th, cf, _v.copy(_f).multiplyScalar(-1).addScaledVector(sideV, 0.12 + bend * 0.45).add(UP.clone().multiplyScalar(-0.05)), k);
      aimBone(cf, ft, _v.copy(_f).multiplyScalar(-1).addScaledVector(sideV, 0.05).add(UP.clone().multiplyScalar(0.05 + bend * 0.45)), k);
    }
    _q.identity();
  }
}
