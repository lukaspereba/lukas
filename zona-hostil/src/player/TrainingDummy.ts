// Manequim de treinamento: soldado animado que fica parado ou percorre uma rota fixa.
// (Não é IA — os bots com percepção e decisão são a Fase 6.)

import { Vector3 } from 'three';
import type { CharacterModel } from '../anim/CharacterModel';
import { CharacterMotor, DEFAULT_MOTOR } from '../physics/CharacterMotor';
import type { CollisionWorld } from '../physics/CollisionWorld';

export class TrainingDummy {
  readonly motor: CharacterMotor;
  yaw = 0;
  private idx = 0;
  private prev = new Vector3();
  private wait = 0;
  private wasGrounded = true;
  justLanded = false;

  constructor(
    readonly model: CharacterModel,
    world: CollisionWorld,
    start: Vector3,
    private path: Vector3[] = [],
    private speed = 1.5,
    private pause = 1.5,
  ) {
    this.motor = new CharacterMotor(world, { ...DEFAULT_MOTOR });
    this.motor.teleport(start);
    this.prev.copy(start);
  }

  fixedUpdate(dt: number): void {
    this.prev.copy(this.motor.position);
    const v = this.motor.velocity;
    let wx = 0;
    let wz = 0;
    if (this.path.length > 0) {
      if (this.wait > 0) this.wait -= dt;
      else {
        const t = this.path[this.idx];
        const dx = t.x - this.motor.position.x;
        const dz = t.z - this.motor.position.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.4) {
          this.idx = (this.idx + 1) % this.path.length;
          this.wait = this.pause;
        } else {
          wx = (dx / d) * this.speed;
          wz = (dz / d) * this.speed;
          const want = Math.atan2(-dx, -dz);
          let dy = want - this.yaw;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          this.yaw += dy * Math.min(1, dt * 5);
        }
      }
    }
    const k = Math.min(1, dt * 8);
    v.x += (wx - v.x) * k;
    v.z += (wz - v.z) * k;
    this.motor.step(dt);
    this.justLanded = !this.wasGrounded && this.motor.grounded;
    this.wasGrounded = this.motor.grounded;
  }

  frameUpdate(dt: number, alpha: number, groundAt: (x: number, z: number, y0: number) => number | null): void {
    const root = this.model.root;
    root.position.lerpVectors(this.prev, this.motor.position, alpha);
    root.rotation.y = this.yaw + Math.PI;
    const v = this.motor.velocity;
    const fx = -Math.sin(this.yaw);
    const fz = -Math.cos(this.yaw);
    const rx = Math.cos(this.yaw);
    const rz = -Math.sin(this.yaw);
    this.model.update(dt, {
      velX: v.x * rx + v.z * rz,
      velZ: v.x * fx + v.z * fz,
      crouch: 0,
      prone: 0,
      grounded: this.motor.grounded,
      airTime: this.motor.airTime,
      vy: v.y,
      slide: 0,
      mantle: 0,
      aimPitch: 0,
      hideHead: false,
      justJumped: false,
      justLanded: this.justLanded,
      groundAt,
    });
  }
}
