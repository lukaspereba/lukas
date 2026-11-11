// Controlador de movimento do jogador (lógica pura, sem renderização — testável em Node).
// Estados: chão/ar/deslize/escalada; posturas: em pé/agachado/deitado.

import { MathUtils, Vector3 } from 'three';
import { CharacterMotor, DEFAULT_MOTOR } from '../physics/CharacterMotor';
import type { CollisionWorld } from '../physics/CollisionWorld';
import type { Stance } from '../anim/CharacterModel';

export interface MoveInput {
  moveX: number; // direita
  moveY: number; // frente
  lookYaw: number;
  lookPitch: number;
  sprint: boolean;
  jump: boolean; // borda
  crouch: boolean; // borda (alternar)
  crouchHeld: boolean;
  prone: boolean; // borda
}

export const MOVE = {
  walk: 2.0,
  run: 4.4,
  sprint: 6.6,
  crouch: 2.1,
  prone: 0.8,
  backMul: 0.72,
  strafeMul: 0.86,
  accel: 26,
  decel: 30,
  airAccel: 3.5,
  jumpSpeed: 5.4,
  slideSpeed: 8.4,
  slideFriction: 6.5,
  slideMinSpeed: 2.6,
  slideCooldown: 0.9,
  standHeight: 1.8,
  crouchHeight: 1.2,
  proneHeight: 0.62,
  eyeStand: 1.64,
  eyeCrouch: 1.14,
  eyeProne: 0.36,
};

export type MoveState = 'ground' | 'air' | 'slide' | 'mantle';

const _wish = new Vector3();
const _fwd = new Vector3();
const _right = new Vector3();
const _tmp = new Vector3();

export class PlayerController {
  readonly motor: CharacterMotor;
  yaw = 0;
  pitch = 0;
  stance: Stance = 'stand';
  state: MoveState = 'ground';
  sprinting = false;
  /** postura suavizada para câmera/animação */
  crouchBlend = 0;
  proneBlend = 0;
  slideBlend = 0;
  mantleT = 0;
  eyeHeight = MOVE.eyeStand;
  readonly prevPosition = new Vector3();
  // eventos do último passo (consumidos pela câmera/animação)
  justJumped = false;
  justLanded = false;
  landImpact = 0;
  private slideTimer = 0;
  private slideCooldown = 0;
  private mantleFrom = new Vector3();
  private mantleTo = new Vector3();
  private mantleDur = 0.5;
  private mantleRise = 0;
  private proneTransition = 0;
  /** distância percorrida no chão (para o balanço de câmera) */
  stride = 0;

  constructor(readonly world: CollisionWorld, spawn: Vector3, yaw = 0) {
    this.motor = new CharacterMotor(world, { ...DEFAULT_MOTOR, height: MOVE.standHeight });
    this.motor.teleport(spawn);
    this.prevPosition.copy(spawn);
    this.yaw = yaw;
  }

  get position(): Vector3 {
    return this.motor.position;
  }

  forward(out = new Vector3()): Vector3 {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  right(out = new Vector3()): Vector3 {
    return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  /** Velocidade horizontal no espaço do personagem (x = direita, z = frente). */
  localVelocity(): { x: number; z: number } {
    const v = this.motor.velocity;
    this.forward(_fwd);
    this.right(_right);
    return { x: v.x * _right.x + v.z * _right.z, z: v.x * _fwd.x + v.z * _fwd.z };
  }

  respawn(p: Vector3, yaw: number): void {
    this.motor.teleport(p);
    this.prevPosition.copy(p);
    this.yaw = yaw;
    this.pitch = 0;
    this.stance = 'stand';
    this.motor.setHeight(MOVE.standHeight);
    this.state = 'ground';
  }

  look(dYaw: number, dPitch: number): void {
    this.yaw = (this.yaw + dYaw) % (Math.PI * 2);
    const lim = this.stance === 'prone' ? 0.9 : 1.45;
    this.pitch = MathUtils.clamp(this.pitch + dPitch, -lim, lim);
  }

  private setStance(next: Stance): boolean {
    if (next === this.stance) return true;
    const h = next === 'stand' ? MOVE.standHeight : next === 'crouch' ? MOVE.crouchHeight : MOVE.proneHeight;
    if (next === 'prone' && !this.proneFits()) return false;
    if (!this.motor.setHeight(h)) return false;
    this.stance = next;
    if (next === 'prone' || this.proneBlend > 0.5) this.proneTransition = 0.55;
    return true;
  }

  /** Deitar exige espaço livre à frente e atrás (o corpo tem ~1.8 m de comprimento). */
  private proneFits(): boolean {
    const p = this.motor.position;
    this.forward(_fwd);
    for (const s of [0.95, -0.95]) {
      const from = _tmp.set(p.x, p.y + 0.3, p.z);
      const dir = _fwd.clone().multiplyScalar(Math.sign(s));
      const hit = this.world.raycast(from, dir, Math.abs(s), false);
      if (hit) return false;
    }
    return true;
  }

  /** Procura um obstáculo escalável à frente; devolve verdadeiro se iniciou a escalada. */
  tryMantle(): boolean {
    const p = this.motor.position;
    this.forward(_fwd);
    const r = this.motor.radius;
    let wallHit = null;
    for (const h of [0.55, 0.95, 1.4]) {
      const hit = this.world.raycast(_tmp.set(p.x, p.y + h, p.z), _fwd, r + 0.65, false);
      if (hit && Math.abs(hit.normal.y) < 0.5) {
        wallHit = hit;
        break;
      }
    }
    if (!wallHit) return false;
    const probe = wallHit.point.clone().addScaledVector(_fwd, 0.3);
    probe.y = p.y + 2.35;
    const down = this.world.raycast(probe, new Vector3(0, -1, 0), 2.3);
    if (!down || down.normal.y < 0.7) return false;
    const rise = down.point.y - p.y;
    if (rise < 0.45 || rise > 2.05) return false;
    const target = down.point.clone();
    target.y += 0.02;
    const h = this.motor.canFit(MOVE.standHeight, target) ? MOVE.standHeight : MOVE.crouchHeight;
    if (!this.motor.canFit(h, target)) return false;
    this.state = 'mantle';
    this.mantleFrom.copy(p);
    this.mantleTo.copy(target);
    this.mantleRise = rise;
    this.mantleDur = 0.32 + rise * 0.22;
    this.mantleT = 0;
    this.motor.velocity.set(0, 0, 0);
    if (h === MOVE.crouchHeight) this.stance = 'crouch';
    this.motor.height = Math.min(this.motor.height, h);
    return true;
  }

  update(dt: number, inp: MoveInput): void {
    this.prevPosition.copy(this.motor.position);
    this.justJumped = false;
    this.justLanded = false;
    this.look(inp.lookYaw, inp.lookPitch);
    this.slideCooldown = Math.max(0, this.slideCooldown - dt);
    this.proneTransition = Math.max(0, this.proneTransition - dt);

    if (this.state === 'mantle') {
      this.updateMantle(dt);
      this.blendStances(dt);
      return;
    }

    const m = this.motor;
    const moving = Math.hypot(inp.moveX, inp.moveY);
    const horizSpeed = Math.hypot(m.velocity.x, m.velocity.z);

    // ----- posturas -----
    if (inp.prone) {
      if (this.stance === 'prone') this.setStance('crouch');
      else if (m.grounded) this.setStance('prone');
    }
    if (inp.crouch) {
      if (this.state === 'ground' && this.sprinting && horizSpeed > 5 && this.slideCooldown <= 0 && this.stance === 'stand') {
        this.startSlide();
      } else if (this.state === 'slide') {
        this.endSlide();
      } else if (this.stance === 'prone') this.setStance('crouch');
      else if (this.stance === 'crouch') this.setStance('stand');
      else this.setStance('crouch');
    }
    if (inp.jump) {
      if (this.stance === 'prone') this.setStance('crouch');
      else if (this.state === 'slide') {
        this.endSlide();
        if (this.setStance('stand')) this.jump();
      } else if (this.stance === 'crouch' && m.grounded) {
        if (!this.tryMantle()) this.setStance('stand');
      } else if (m.grounded || m.airTime < 0.12) {
        if (!this.tryMantle()) this.jump();
      } else if (!this.tryMantle()) {
        /* no ar sem borda próxima: nada */
      }
    }

    // ----- sprint -----
    const wantsSprint = inp.sprint && inp.moveY > 0.55 && Math.abs(inp.moveX) < 0.75;
    if (wantsSprint && this.stance !== 'stand' && this.state !== 'slide' && this.proneTransition <= 0) this.setStance('stand');
    this.sprinting = wantsSprint && this.stance === 'stand' && this.state !== 'slide';

    // ----- velocidade desejada -----
    this.forward(_fwd);
    this.right(_right);
    let maxSpeed: number;
    if (this.stance === 'prone') maxSpeed = this.proneTransition > 0 ? 0 : MOVE.prone;
    else if (this.stance === 'crouch') maxSpeed = MOVE.crouch;
    else if (this.sprinting) maxSpeed = MOVE.sprint;
    else maxSpeed = moving < 0.55 ? MOVE.walk : MOVE.run;
    const fwdMul = inp.moveY < 0 ? MOVE.backMul : 1;
    _wish.set(0, 0, 0)
      .addScaledVector(_fwd, inp.moveY * fwdMul)
      .addScaledVector(_right, inp.moveX * MOVE.strafeMul);
    const wl = _wish.length();
    if (wl < 1e-4) _wish.set(0, 0, 0);
    else {
      const mulMag = Math.min(1, wl / Math.max(moving, 1e-6)); // efeito dos multiplicadores de ré/lateral
      const inputMag = moving < 0.55 ? moving / 0.55 : 1; // analógico parcial = andar
      _wish.normalize().multiplyScalar(maxSpeed * Math.min(1, inputMag) * mulMag);
    }

    if (this.state === 'slide') {
      this.updateSlide(dt);
    } else if (m.grounded) {
      const vx = m.velocity.x;
      const vz = m.velocity.z;
      const accel = _wish.lengthSq() > vx * vx + vz * vz ? MOVE.accel : MOVE.decel;
      const dvx = _wish.x - vx;
      const dvz = _wish.z - vz;
      const dl = Math.hypot(dvx, dvz);
      const maxDv = accel * dt;
      const k = dl > maxDv ? maxDv / dl : 1;
      m.velocity.x = vx + dvx * k;
      m.velocity.z = vz + dvz * k;
    } else {
      m.velocity.x += MathUtils.clamp(_wish.x - m.velocity.x, -MOVE.airAccel * dt, MOVE.airAccel * dt);
      m.velocity.z += MathUtils.clamp(_wish.z - m.velocity.z, -MOVE.airAccel * dt, MOVE.airAccel * dt);
    }

    const wasGrounded = m.grounded;
    m.step(dt);
    if (!wasGrounded && m.grounded) {
      this.justLanded = true;
      this.landImpact = m.lastImpactSpeed;
    }
    if (m.grounded && this.state === 'air') this.state = 'ground';
    if (!m.grounded && this.state === 'ground' && m.airTime > 0.1) this.state = 'air';
    // segurar pulo no ar contra uma borda escala
    if (!m.grounded && this.state === 'air' && inp.moveY > 0.5 && m.velocity.y < 1.5 && m.airTime > 0.15) this.tryMantle();
    if (m.grounded) this.stride += Math.hypot(m.position.x - this.prevPosition.x, m.position.z - this.prevPosition.z);
    this.blendStances(dt);
  }

  private jump(): void {
    this.motor.velocity.y = MOVE.jumpSpeed;
    this.motor.grounded = false;
    this.state = 'air';
    this.justJumped = true;
  }

  private startSlide(): void {
    if (!this.motor.setHeight(MOVE.crouchHeight)) return;
    this.state = 'slide';
    this.stance = 'crouch';
    this.slideTimer = 0;
    const v = this.motor.velocity;
    const sp = Math.hypot(v.x, v.z);
    const boost = Math.max(sp, MOVE.slideSpeed) / Math.max(sp, 1e-3);
    v.x *= boost;
    v.z *= boost;
  }

  private endSlide(): void {
    this.state = this.motor.grounded ? 'ground' : 'air';
    this.slideCooldown = MOVE.slideCooldown;
  }

  private updateSlide(dt: number): void {
    const m = this.motor;
    this.slideTimer += dt;
    const v = m.velocity;
    const sp = Math.hypot(v.x, v.z);
    // gravidade ajuda em descidas
    const n = m.groundNormal;
    const downhill = sp > 0 ? -(v.x * n.x + v.z * n.z) / sp : 0;
    const decel = MOVE.slideFriction + downhill * 9;
    const ns = Math.max(0, sp - decel * dt);
    if (sp > 1e-3) {
      v.x *= ns / sp;
      v.z *= ns / sp;
    }
    if (ns < MOVE.slideMinSpeed || this.slideTimer > 1.4 || !m.grounded) this.endSlide();
  }

  private updateMantle(dt: number): void {
    this.mantleT += dt / this.mantleDur;
    const t = Math.min(1, this.mantleT);
    // sobe primeiro (60%), depois avança
    const up = MathUtils.smootherstep(t, 0, 0.6);
    const fw = MathUtils.smootherstep(t, 0.35, 1);
    const p = this.motor.position;
    p.x = MathUtils.lerp(this.mantleFrom.x, this.mantleTo.x, fw);
    p.z = MathUtils.lerp(this.mantleFrom.z, this.mantleTo.z, fw);
    p.y = MathUtils.lerp(this.mantleFrom.y, this.mantleTo.y + 0.05, up);
    if (t >= 1) {
      this.state = 'ground';
      this.motor.grounded = true;
      this.motor.velocity.set(0, 0, 0);
      if (this.stance === 'stand') this.motor.setHeight(MOVE.standHeight);
      this.justLanded = true;
      this.landImpact = Math.min(3, this.mantleRise * 2);
    }
  }

  private blendStances(dt: number): void {
    const k = Math.min(1, dt * 9);
    const cTarget = this.stance === 'crouch' ? 1 : 0;
    const pTarget = this.stance === 'prone' ? 1 : 0;
    this.crouchBlend += (cTarget - this.crouchBlend) * k;
    this.proneBlend += (pTarget - this.proneBlend) * Math.min(1, dt * 5);
    this.slideBlend += ((this.state === 'slide' ? 1 : 0) - this.slideBlend) * Math.min(1, dt * 10);
    const eye =
      this.stance === 'prone' ? MOVE.eyeProne : this.stance === 'crouch' ? MOVE.eyeCrouch : MOVE.eyeStand;
    const target = this.state === 'slide' ? MOVE.eyeCrouch - 0.25 : eye;
    this.eyeHeight += (target - this.eyeHeight) * Math.min(1, dt * (this.stance === 'prone' ? 5 : 10));
  }

  get mantleProgress(): number {
    return this.state === 'mantle' ? Math.min(1, this.mantleT) : 0;
  }
}
