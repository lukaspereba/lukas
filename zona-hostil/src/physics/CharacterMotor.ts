// Motor cinemático de cápsula para personagens: gravidade, deslizamento em paredes,
// subida de degraus, limite de inclinação, encaixe no chão em descidas e detecção de teto.

import { Vector3 } from 'three';
import type { CollisionWorld, Contact } from './CollisionWorld';

export interface MotorConfig {
  radius: number;
  height: number;
  stepHeight: number;
  maxSlopeDeg: number;
  snapDistance: number;
  gravity: number;
  terminalSpeed: number;
}

export const DEFAULT_MOTOR: MotorConfig = {
  radius: 0.32,
  height: 1.8,
  stepHeight: 0.42,
  maxSlopeDeg: 46,
  snapDistance: 0.45,
  gravity: 17,
  terminalSpeed: 55,
};

interface MoveResult {
  pos: Vector3;
  grounded: boolean;
  groundNormal: Vector3;
  wall: boolean;
  ceiling: boolean;
  normals: Vector3[];
}

const _d = new Vector3();
const _cn = new Vector3();

/** Normal usada para recorte: paredes/rampas íngremes viram horizontais; tetos ficam como estão. */
function clipNormal(n: Vector3): Vector3 {
  if (n.y <= 0) return n;
  _cn.set(n.x, 0, n.z);
  const l = _cn.length();
  return l > 1e-4 ? _cn.divideScalar(l) : _cn.set(0, 1, 0);
}
const _h = new Vector3();

export class CharacterMotor {
  readonly position = new Vector3();
  readonly velocity = new Vector3();
  grounded = false;
  readonly groundNormal = new Vector3(0, 1, 0);
  hitWall = false;
  hitCeiling = false;
  /** velocidade vertical no último pouso (m/s, positiva) */
  lastImpactSpeed = 0;
  /** tempo no ar (s) */
  airTime = 0;
  radius: number;
  height: number;
  private slopeCos: number;
  private contacts: Contact[] = [];

  constructor(
    public world: CollisionWorld,
    public cfg: MotorConfig = DEFAULT_MOTOR,
  ) {
    this.radius = cfg.radius;
    this.height = cfg.height;
    this.slopeCos = Math.cos((cfg.maxSlopeDeg * Math.PI) / 180);
  }

  /** Tenta mudar a altura da cápsula (ex.: levantar). Retorna falso se não houver espaço. */
  setHeight(h: number): boolean {
    if (h > this.height + 1e-3 && this.world.capsuleBlocked(this.position, this.radius * 0.95, h, 0.02)) return false;
    this.height = h;
    return true;
  }

  canFit(h: number, at: Vector3 = this.position): boolean {
    return !this.world.capsuleBlocked(at, this.radius * 0.95, h, 0.02);
  }

  isWalkable(n: Vector3): boolean {
    return n.y >= this.slopeCos;
  }

  teleport(p: Vector3): void {
    this.position.copy(p);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
  }

  step(dt: number): void {
    const wasGrounded = this.grounded;
    if (wasGrounded && this.velocity.y <= 0) this.velocity.y = 0;
    else this.velocity.y = Math.max(this.velocity.y - this.cfg.gravity * dt, -this.cfg.terminalSpeed);

    _d.copy(this.velocity).multiplyScalar(dt);
    const start = this.position.clone();
    let res = this.slideMove(start, _d);

    // subida de degrau: sobe, anda, desce — aceita se avançou mais e terminou apoiado
    const hl = Math.hypot(_d.x, _d.z);
    if (wasGrounded && hl > 1e-4 && res.wall && this.velocity.y <= 0) {
      const up = start.clone();
      up.y += this.cfg.stepHeight;
      if (!this.world.capsuleBlocked(up, this.radius, this.height, 0.005)) {
        // avança no mínimo ~meio raio para que a base arredondada saia da quina do degrau
        _h.set(_d.x, 0, _d.z).multiplyScalar(Math.max(1, (this.radius * 0.55) / hl));
        const r1 = this.slideMove(up, _h);
        const r2 = this.slideMove(r1.pos, new Vector3(0, -(this.cfg.stepHeight + 0.05), 0));
        const progA = Math.hypot(res.pos.x - start.x, res.pos.z - start.z);
        const progB = Math.hypot(r2.pos.x - start.x, r2.pos.z - start.z);
        if (r2.grounded && progB > progA + 0.002) {
          res = r2;
          res.normals.push(...r1.normals);
        }
      }
    }

    this.position.copy(res.pos);
    this.grounded = res.grounded;
    this.groundNormal.copy(res.groundNormal);
    this.hitWall = res.wall;
    this.hitCeiling = res.ceiling;

    // remove componentes de velocidade contra as superfícies tocadas
    // (superfícies íngremes contam como paredes: nunca convertem velocidade horizontal em subida)
    for (const n of res.normals) {
      if (this.isWalkable(n)) continue;
      const cn = clipNormal(n);
      const vn = this.velocity.dot(cn);
      if (vn < 0) this.velocity.addScaledVector(cn, -vn);
    }
    if (res.ceiling && this.velocity.y > 0) this.velocity.y = 0;

    // encaixe no chão ao descer rampas/degraus
    if (!this.grounded && wasGrounded && this.velocity.y <= 0) this.snapDown();

    if (this.grounded) {
      if (!wasGrounded) this.lastImpactSpeed = Math.max(0, -this.velocity.y);
      if (this.velocity.y < 0) this.velocity.y = 0;
      this.airTime = 0;
    } else {
      this.airTime += dt;
    }
  }

  private snapDown(): void {
    const r = this.slideMove(this.position, new Vector3(0, -this.cfg.snapDistance, 0));
    if (r.grounded) {
      this.position.copy(r.pos);
      this.grounded = true;
      this.groundNormal.copy(r.groundNormal);
    }
  }

  /** Move a cápsula por `disp` em subpassos, resolvendo penetrações. Sem efeitos colaterais. */
  slideMove(from: Vector3, disp: Vector3): MoveResult {
    const res: MoveResult = {
      pos: from.clone(),
      grounded: false,
      groundNormal: new Vector3(0, 1, 0),
      wall: false,
      ceiling: false,
      normals: [],
    };
    const len = disp.length();
    const maxStep = this.radius * 0.4;
    const n = Math.max(1, Math.ceil(len / maxStep));
    const sub = disp.clone().divideScalar(n);
    for (let i = 0; i < n; i++) {
      res.pos.add(sub);
      this.resolve(res);
      // remove o componente do subpasso que vai contra paredes já encontradas
      for (const nn of res.normals) {
        if (this.isWalkable(nn)) continue;
        const cn = clipNormal(nn);
        const k = sub.dot(cn);
        if (k < 0) sub.addScaledVector(cn, -k);
      }
    }
    return res;
  }

  private resolve(res: MoveResult): void {
    for (let it = 0; it < 6; it++) {
      this.world.capsuleContacts(res.pos, this.radius, this.height, this.contacts);
      if (this.contacts.length === 0) return;
      let deepest: Contact | null = null;
      for (const c of this.contacts) if (!deepest || c.depth > deepest.depth) deepest = c;
      if (!deepest || deepest.depth < 1e-5) {
        // apenas encostando: registra apoio sem empurrar
        for (const c of this.contacts) this.classify(c, res);
        return;
      }
      const c = deepest;
      if (this.isWalkable(c.normal)) {
        res.pos.y += c.depth / Math.max(c.normal.y, 0.35);
      } else if (c.normal.y > 0 && c.kind === 'terrain') {
        // encosta íngreme do terreno: empurra só na horizontal (gravidade faz escorregar, nunca subir).
        // Em malhas, quinas de degraus precisam do empurrão inclinado para a subida de degrau.
        const hn = clipNormal(c.normal);
        res.pos.addScaledVector(hn, (c.depth + 1e-4) / Math.max(hn.dot(c.normal), 0.2));
      } else {
        res.pos.addScaledVector(c.normal, c.depth + 1e-4);
      }
      this.classify(c, res);
    }
  }

  private classify(c: Contact, res: MoveResult): void {
    if (this.isWalkable(c.normal)) {
      res.grounded = true;
      res.groundNormal.copy(c.normal);
    } else if (c.normal.y < -0.5) {
      res.ceiling = true;
    } else {
      res.wall = true;
    }
    res.normals.push(c.normal);
  }
}
