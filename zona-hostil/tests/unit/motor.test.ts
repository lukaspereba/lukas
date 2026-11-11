import { describe, expect, it } from 'vitest';
import { BoxGeometry, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { CollisionWorld } from '../../src/physics/CollisionWorld';
import { CharacterMotor, DEFAULT_MOTOR } from '../../src/physics/CharacterMotor';
import { Heightfield } from '../../src/world/Heightfield';

const DT = 1 / 60;

function flatWorld(meshes: Mesh[] = []): CollisionWorld {
  const hf = Heightfield.fromFunction(200, 101, () => 0);
  const w = new CollisionWorld(hf);
  w.setStatic(meshes);
  return w;
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), new MeshBasicMaterial());
  m.position.set(x, y, z);
  m.updateMatrixWorld(true);
  return m;
}

function run(m: CharacterMotor, seconds: number, vx = 0, vz = 0): void {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) {
    m.velocity.x = vx;
    m.velocity.z = vz;
    m.step(DT);
  }
}

describe('CharacterMotor', () => {
  it('cai e repousa sobre o terreno plano', () => {
    const m = new CharacterMotor(flatWorld());
    m.teleport(new Vector3(0, 5, 0));
    run(m, 2);
    expect(m.grounded).toBe(true);
    expect(Math.abs(m.position.y)).toBeLessThan(0.02);
    expect(m.lastImpactSpeed).toBeGreaterThan(8);
  });

  it('anda a distância esperada no plano', () => {
    const m = new CharacterMotor(flatWorld());
    m.teleport(new Vector3(0, 0.01, 0));
    run(m, 0.2);
    const x0 = m.position.x;
    run(m, 1, 4, 0);
    expect(m.position.x - x0).toBeGreaterThan(3.9);
    expect(m.position.x - x0).toBeLessThan(4.1);
    expect(m.grounded).toBe(true);
  });

  it('sobe rampa de 30° e não sobe rampa de 60°', () => {
    const slope = (deg: number) => Heightfield.fromFunction(200, 401, (x) => Math.max(0, x) * Math.tan((deg * Math.PI) / 180));
    const easy = new CharacterMotor(new CollisionWorld(slope(30)));
    easy.teleport(new Vector3(-2, 0.05, 0));
    run(easy, 0.2);
    run(easy, 2.5, 4, 0);
    expect(easy.position.y).toBeGreaterThan(3);

    const steep = new CharacterMotor(new CollisionWorld(slope(60)));
    steep.teleport(new Vector3(-2, 0.05, 0));
    run(steep, 0.2);
    run(steep, 2.5, 4, 0);
    expect(steep.position.y).toBeLessThan(1.0);
  });

  it('para ao encontrar uma parede', () => {
    const m = new CharacterMotor(flatWorld([box(1, 3, 10, 5, 1.5, 0)]));
    m.teleport(new Vector3(0, 0.01, 0));
    run(m, 0.1);
    run(m, 3, 5, 0);
    // face da parede em x = 4.5; centro da cápsula fica a ~raio dela
    expect(m.position.x).toBeLessThan(4.5 - DEFAULT_MOTOR.radius + 0.03);
    expect(m.position.x).toBeGreaterThan(4.5 - DEFAULT_MOTOR.radius - 0.05);
  });

  it('desliza ao longo de parede diagonal', () => {
    const wall = box(0.5, 3, 20, 4, 1.5, 0);
    wall.rotation.y = Math.PI / 4;
    wall.updateMatrixWorld(true);
    const m = new CharacterMotor(flatWorld([wall]));
    m.teleport(new Vector3(0, 0.01, 0));
    run(m, 0.1);
    run(m, 2, 5, 0);
    expect(Math.abs(m.position.z)).toBeGreaterThan(1.0);
  });

  it('sobe degrau de 30 cm mas não um bloco de 70 cm', () => {
    const low = new CharacterMotor(flatWorld([box(4, 0.3, 4, 4, 0.15, 0)]));
    low.teleport(new Vector3(0, 0.01, 0));
    run(low, 0.1);
    run(low, 1.5, 3, 0);
    expect(low.position.y).toBeGreaterThan(0.28);
    expect(low.position.x).toBeGreaterThan(2.5);

    const high = new CharacterMotor(flatWorld([box(4, 0.7, 4, 4, 0.35, 0)]));
    high.teleport(new Vector3(0, 0.01, 0));
    run(high, 0.1);
    run(high, 1.5, 3, 0);
    expect(high.position.y).toBeLessThan(0.1);
    expect(high.position.x).toBeLessThan(2.0);
  });

  it('pulo atinge a altura balística esperada', () => {
    const m = new CharacterMotor(flatWorld());
    m.teleport(new Vector3(0, 0.01, 0));
    run(m, 0.2);
    m.velocity.y = 5.6;
    m.grounded = false;
    let apex = 0;
    for (let i = 0; i < 120; i++) {
      m.step(DT);
      apex = Math.max(apex, m.position.y);
    }
    const expected = (5.6 * 5.6) / (2 * DEFAULT_MOTOR.gravity);
    expect(apex).toBeGreaterThan(expected * 0.9);
    expect(apex).toBeLessThan(expected * 1.1);
    expect(m.grounded).toBe(true);
  });

  it('não levanta sob teto baixo', () => {
    const m = new CharacterMotor(flatWorld([box(6, 0.3, 6, 0, 1.45, 0)]));
    m.teleport(new Vector3(0, 0.01, 0));
    m.setHeight(1.1);
    run(m, 0.2);
    expect(m.setHeight(1.8)).toBe(false);
    expect(m.height).toBeCloseTo(1.1);
  });

  it('permanece apoiado ao descer rampa de 25°', () => {
    const hf = Heightfield.fromFunction(200, 401, (x) => -Math.max(0, x) * Math.tan((25 * Math.PI) / 180));
    const m = new CharacterMotor(new CollisionWorld(hf));
    m.teleport(new Vector3(-1, 0.05, 0));
    run(m, 0.2);
    let airborne = 0;
    for (let i = 0; i < 120; i++) {
      m.velocity.x = 4;
      m.velocity.z = 0;
      m.step(DT);
      if (!m.grounded) airborne++;
    }
    expect(airborne).toBeLessThan(3);
    expect(m.position.y).toBeLessThan(-2);
  });
});
