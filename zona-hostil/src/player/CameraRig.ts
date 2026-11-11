// Câmera em primeira e terceira pessoa: interpolação de física, balanço moderado, mergulho no pouso,
// FOV dinâmico (sprint/deslize) e colisão da câmera em terceira pessoa (não atravessa paredes).

import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { PlayerController } from './PlayerController';
import type { CameraMode, GameplaySettings } from '../core/Settings';

const _pivot = new Vector3();
const _back = new Vector3();
const _right = new Vector3();
const _desired = new Vector3();
const _tmp = new Vector3();

/** FOV horizontal (referência 16:9) -> vertical do three.js. */
export function hfovToVfov(hfovDeg: number, aspectRef = 16 / 9): number {
  const h = MathUtils.degToRad(hfovDeg);
  return MathUtils.radToDeg(2 * Math.atan(Math.tan(h / 2) / aspectRef));
}

export class CameraRig {
  readonly camera: PerspectiveCamera;
  mode: CameraMode = 'fps';
  private tpsDist = 2.5;
  private dip = 0;
  private dipVel = 0;
  private fovExtra = 0;
  private roll = 0;
  readonly eye = new Vector3();
  /** posição interpolada dos pés do jogador neste quadro */
  readonly feet = new Vector3();

  constructor(aspect: number) {
    this.camera = new PerspectiveCamera(60, aspect, 0.04, 4000);
    this.camera.rotation.order = 'YXZ';
  }

  resize(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number, alpha: number, p: PlayerController, g: GameplaySettings, world: CollisionWorld): void {
    this.feet.lerpVectors(p.prevPosition, p.position, alpha);
    if (p.justLanded) this.dipVel -= Math.min(4, p.landImpact) * 0.35;
    // mola criticamente amortecida para o mergulho do pouso
    // (subpassos de 4 ms: integração estável mesmo com quadros lentos)
    const k = 90;
    const c = 2 * Math.sqrt(k);
    const n = Math.max(1, Math.ceil(dt / 0.004));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.dipVel += (-k * this.dip - c * this.dipVel) * h;
      this.dip += this.dipVel * h;
    }
    if (!Number.isFinite(this.dip)) this.dip = this.dipVel = 0;

    const v = p.motor.velocity;
    const speed = Math.hypot(v.x, v.z);
    const targetFov = (p.sprinting ? 7 : 0) + (p.state === 'slide' ? 5 : 0);
    this.fovExtra += (targetFov - this.fovExtra) * Math.min(1, dt * 6);
    const targetRoll = p.state === 'slide' ? -0.05 : 0;
    this.roll += (targetRoll - this.roll) * Math.min(1, dt * 8);
    const vfov = hfovToVfov(g.fov + this.fovExtra);
    if (Math.abs(this.camera.fov - vfov) > 0.01) {
      this.camera.fov = vfov;
      this.camera.updateProjectionMatrix();
    }

    // balanço de cabeça: proporcional à velocidade, sincronizado com a passada
    const bobAmt = g.headBob * MathUtils.smoothstep(speed, 0.3, 6.5) * (p.motor.grounded ? 1 : 0) * (p.stance === 'prone' ? 0.3 : 1);
    const ph = (p.stride / 0.82) * Math.PI;
    const bobY = Math.abs(Math.sin(ph)) * 0.045 * bobAmt - 0.02 * bobAmt;
    const bobX = Math.cos(ph) * 0.025 * bobAmt;

    this.eye.copy(this.feet);
    this.eye.y += p.eyeHeight + this.dip * 0.06 + bobY;
    const cam = this.camera;
    if (this.mode === 'fps') {
      p.right(_right);
      this.eye.addScaledVector(_right, bobX);
      cam.position.copy(this.eye);
      cam.rotation.set(p.pitch, p.yaw, this.roll + bobX * 0.4);
      return;
    }

    // ----- terceira pessoa (sobre o ombro direito) -----
    const stanceDist = p.stance === 'prone' ? 2.9 : p.stance === 'crouch' ? 2.3 : 2.6;
    const want = stanceDist + (p.sprinting ? 0.35 : 0);
    _pivot.copy(this.feet);
    _pivot.y += p.eyeHeight + 0.12 + p.proneBlend * 0.55;
    p.right(_right);
    const shoulder = 0.52;
    // ombro: não deixa o pivô atravessar parede lateral
    const sideHit = world.raycast(_pivot, _right, shoulder + 0.25);
    const sh = sideHit ? Math.max(0, sideHit.distance - 0.25) : shoulder;
    _pivot.addScaledVector(_right, sh);
    const cp = Math.cos(p.pitch);
    _back.set(Math.sin(p.yaw) * cp, -Math.sin(p.pitch), Math.cos(p.yaw) * cp); // oposto do olhar
    const hit = world.raycast(_pivot, _back, want + 0.3);
    const allowed = hit ? Math.max(0.35, hit.distance - 0.3) : want;
    const rate = allowed < this.tpsDist ? 30 : 4;
    this.tpsDist += (allowed - this.tpsDist) * Math.min(1, dt * rate);
    this.tpsDist = Math.min(this.tpsDist, allowed);
    _desired.copy(_pivot).addScaledVector(_back, this.tpsDist);
    // nunca abaixo do terreno
    const gy = world.groundHeight(_desired.x, _desired.z) + 0.25;
    if (_desired.y < gy) _desired.y = gy;
    cam.position.copy(_desired);
    cam.rotation.set(p.pitch, p.yaw, this.roll * 0.5);
    _tmp.set(0, 0, 0);
  }
}
