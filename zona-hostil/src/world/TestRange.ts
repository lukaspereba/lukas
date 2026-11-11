// Campo de Treinamento (Fase 1): terreno com relevo real (colinas, serra ao norte, vale com leito seco)
// e uma área central plana com construção de dois andares, escadas, rampas e pista de obstáculos.

import {
  Color,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from 'three';
import { LevelBuilder, worldUV } from './Builder';
import { Heightfield } from './Heightfield';
import { Noise2D, mulberry32, smoothstep } from './noise';

export const RANGE_SIZE = 640;
export const RANGE_RES = 321;

export function rangeHeight(noise: Noise2D, x: number, z: number): number {
  const base = noise.fbm(x / 170, z / 170, 5) * 8;
  const ridges = noise.ridged(x / 240 + 3.1, z / 240 - 1.7, 5) * 22;
  // serra ao norte
  const north = smoothstep(-110, -270, z);
  const mountain = north * (30 + noise.ridged(x / 120, z / 120, 6) * 46);
  // vale com leito seco a leste
  const riverX = 175 + Math.sin(z / 55) * 24;
  const dr = Math.abs(x - riverX);
  const carve = (1 - smoothstep(6, 26, dr)) * 7.5;
  let h = base + ridges * 0.55 + mountain - carve;
  // achata a área de treino (raio ~72 m) com transição suave
  const d = Math.hypot(x, z - 5);
  const f = smoothstep(72, 125, d);
  h = h * f + (1 - f) * (noise.fbm(x / 40, z / 40, 2) * 0.12);
  return h;
}

export interface RangeTextures {
  concrete: [Texture, Texture];
  crate: [Texture, Texture];
}

export async function loadRangeTextures(base: string, aniso: number): Promise<RangeTextures> {
  const loader = new TextureLoader();
  const load = async (n: string, color: boolean) => {
    const t = await loader.loadAsync(`${base}${n}.jpg`);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.anisotropy = aniso;
    if (color) t.colorSpace = SRGBColorSpace;
    return t;
  };
  return {
    concrete: [await load('concrete_c', true), await load('concrete_n', false)],
    crate: [await load('crate_c', true), await load('crate_n', false)],
  };
}

export interface RangeLayout {
  heightfield: Heightfield;
  builder: LevelBuilder;
  spawn: Vector3;
  spawnYaw: number;
  /** pontos de interesse para testes e NPCs */
  points: Record<string, Vector3>;
}

export function buildTestRange(tex: RangeTextures, rockTex: [Texture, Texture], seed = 7): RangeLayout {
  const noise = new Noise2D(seed);
  const hf = Heightfield.fromFunction(RANGE_SIZE, RANGE_RES, (x, z) => rangeHeight(noise, x, z));
  const b = new LevelBuilder(2.5);

  const concrete = new MeshStandardMaterial({ map: tex.concrete[0], normalMap: tex.concrete[1], roughness: 0.92, color: new Color(0.47, 0.45, 0.41), name: 'Concreto' });
  const concreteDark = concrete.clone();
  concreteDark.color = new Color(0.44, 0.43, 0.41);
  concreteDark.name = 'ConcretoEscuro';
  const floorMat = concrete.clone();
  floorMat.color = new Color(0.42, 0.41, 0.38);
  floorMat.name = 'Piso';
  const crate = new MeshStandardMaterial({ map: tex.crate[0], normalMap: tex.crate[1], roughness: 0.85, name: 'Caixote' });
  const painted = new MeshStandardMaterial({ map: tex.concrete[0], normalMap: tex.concrete[1], color: new Color(0.42, 0.4, 0.3), roughness: 0.85, name: 'ConcretoPintado' });

  const g = (x: number, z: number) => hf.heightAt(x, z);

  // ---------------- base de spawn ----------------
  b.block(10, 0.25, 10, 0, g(0, 32) - 0.1, 32, floorMat);

  // ---------------- Casa de Treino (2 andares + terraço) ----------------
  const hx = -26;
  const hz = -8;
  const W = 12;
  const D = 9;
  const FH = 3.2;
  const T = 0.25;
  const y0 = g(hx, hz);
  b.block(W + 0.6, 0.3, D + 0.6, hx, y0 - 0.15, hz, floorMat); // fundação
  const x0 = hx - W / 2;
  const z0 = hz - D / 2;
  const win = (from: number) => ({ from, to: from + 1.3, bottom: 1.0, top: 2.2 });
  const door = (from: number) => ({ from, to: from + 1.3, bottom: 0, top: 2.25 });
  for (let floor = 0; floor < 2; floor++) {
    const by = y0 + 0.15 + floor * FH;
    // sul (frente, +Z) com porta no térreo
    b.wallX(x0, hz + D / 2 - T / 2, by, W, FH, T, concrete, floor === 0 ? [door(2.0), win(5.5), win(8.8)] : [win(1.5), win(5.0), win(8.8)]);
    // norte
    b.wallX(x0, hz - D / 2 + T / 2, by, W, FH, T, concrete, [win(2.0), win(6.0), win(9.0)]);
    // oeste e leste
    b.wallZ(x0 + T / 2, z0 + T, by, D - 2 * T, FH, T, concrete, floor === 0 ? [door(3.6)] : [win(3.0)]);
    b.wallZ(x0 + W - T / 2, z0 + T, by, D - 2 * T, FH, T, concrete, [win(2.5)]);
    // parede interna (térreo) com passagem
    if (floor === 0) b.wallX(x0 + T, hz - 0.5, by, 6.5, FH, 0.18, concreteDark, [door(2.5)]);
  }
  // laje do 1º andar com vão da escada (escada encostada na parede leste, subindo para o norte)
  const slabY = y0 + 0.15 + FH;
  const stairW = 1.2;
  const sx = x0 + W - T - stairW / 2;
  const stairRun = 0.28;
  const steps = 16;
  const rise = FH / steps;
  const holeLen = steps * stairRun * 0.62;
  b.block(W - 2 * T - stairW, 0.22, D - 2 * T, hx - stairW / 2, slabY - 0.22, hz, floorMat);
  b.block(stairW, 0.22, D - 2 * T - holeLen - 0.4, sx, slabY - 0.22, z0 + T + (D - 2 * T - holeLen - 0.4) / 2, floorMat);
  b.stairs(new Vector3(sx, y0 + 0.15, hz + D / 2 - T - 0.2), new Vector3(0, 0, -1), stairW, steps, rise, stairRun, concreteDark);
  // guarda-corpo do vão
  b.block(0.08, 1.0, holeLen, sx - stairW / 2 - 0.04, slabY, hz + D / 2 - T - 0.6 - holeLen / 2, painted);
  // laje do terraço com vão para a segunda escada (encostada na parede oeste, subindo para o sul)
  const roofY = y0 + 0.15 + 2 * FH;
  const sx2 = x0 + T + stairW / 2;
  b.block(W - 2 * T - stairW, 0.22, D - 2 * T, hx + stairW / 2, roofY - 0.22, hz, floorMat);
  b.block(stairW, 0.22, D - 2 * T - holeLen - 0.4, sx2, roofY - 0.22, z0 + D - T - (D - 2 * T - holeLen - 0.4) / 2, floorMat);
  b.stairs(new Vector3(sx2, slabY, z0 + T + 0.2), new Vector3(0, 0, 1), stairW, steps, rise, stairRun, concreteDark);
  // parapeito do terraço
  b.block(W, 1.0, T, hx, roofY, z0 + T / 2, concrete);
  b.block(W, 1.0, T, hx, roofY, z0 + D - T / 2, concrete);
  b.block(T, 1.0, D, x0 + T / 2, roofY, hz, concrete);
  b.block(T, 1.0, D, x0 + W - T / 2, roofY, hz, concrete);

  // ---------------- Pista de obstáculos ----------------
  const ox = 22;
  const oy = (x: number, z: number) => g(x, z);
  const lane = (i: number) => -14 + i * 7;
  // muros de altura crescente (escalada): 0.5 / 1.0 / 1.5 / 2.4 m
  [0.5, 1.0, 1.5, 2.4].forEach((h, i) => {
    const z = lane(i);
    b.block(0.4, h, 4.5, ox, oy(ox, z), z, painted);
  });
  // caixotes empilhados
  b.block(1.2, 1.2, 1.2, ox + 8, oy(ox + 8, -14), -14, crate, 0.2);
  b.block(1.2, 1.2, 1.2, ox + 9.3, oy(ox + 9.3, -14), -14.3, crate, -0.1);
  b.block(1.2, 1.2, 1.2, ox + 8.6, oy(ox + 8.6, -14) + 1.2, -14.1, crate, 0.5);
  // túnel agachado (vão 1.3 m) e túnel rasteiro (vão 0.75 m)
  const tunnel = (x: number, z: number, clear: number) => {
    const y = oy(x, z);
    b.block(0.3, clear, 6, x - 1.15, y, z, concreteDark);
    b.block(0.3, clear, 6, x + 1.15, y, z, concreteDark);
    b.block(2.6, 0.3, 6, x, y + clear, z, concreteDark);
  };
  tunnel(ox + 8.5, 0, 1.3);
  tunnel(ox + 8.5, 9, 0.75);
  // rampas 20°, 35° e 52° (a última não é caminhável)
  [20, 35, 52].forEach((deg, i) => {
    const x = ox + 16 + i * 4.5;
    b.ramp(x, oy(x, -12), -12, 3.5, 6, deg, painted);
  });
  // escada externa até plataforma de 1.2 m
  const px = ox + 18;
  const pz = 10;
  const py = oy(px, pz);
  b.stairs(new Vector3(px, py, pz + 3.2), new Vector3(0, 0, -1), 2.4, 6, 0.2, 0.32, concreteDark);
  b.block(4, 1.2, 4, px, py, pz - 0.8, concrete);

  // ---------------- rochas (fora da área plana) ----------------
  const rockMat = new MeshStandardMaterial({ map: rockTex[0], normalMap: rockTex[1], roughness: 0.92, name: 'Rocha' });
  const rnd = mulberry32(seed * 31 + 5);
  const rockNoise = new Noise2D(seed + 101);
  let placed = 0;
  for (let k = 0; k < 400 && placed < 70; k++) {
    const x = (rnd() - 0.5) * RANGE_SIZE * 0.85;
    const z = (rnd() - 0.5) * RANGE_SIZE * 0.85;
    if (Math.hypot(x, z - 5) < 85) continue;
    const s = 0.6 + rnd() * rnd() * 4.5;
    const geo = new IcosahedronGeometry(1, 2);
    const p = geo.attributes.position;
    const v = new Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const d = 1 + rockNoise.fbm(v.x * 1.3 + k, v.y * 1.3 + v.z, 3) * 0.45;
      v.multiplyScalar(d);
      v.y *= 0.62;
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    worldUV(geo, 1.4);
    const m = new Mesh(geo, rockMat);
    m.scale.setScalar(s);
    m.rotation.y = rnd() * Math.PI * 2;
    m.position.set(x, g(x, z) - s * 0.18, z);
    m.castShadow = true;
    m.receiveShadow = true;
    m.updateMatrixWorld(true);
    b.group.add(m);
    if (s > 0.9) b.colliders.push(m);
    placed++;
  }

  const spawn = new Vector3(0, g(0, 32) + 0.2, 32);
  return {
    heightfield: hf,
    builder: b,
    spawn,
    spawnYaw: 0,
    points: {
      casa: new Vector3(hx, y0, hz + D / 2 + 2),
      obstaculos: new Vector3(ox - 4, oy(ox - 4, 0), 0),
      rampas: new Vector3(ox + 20, oy(ox + 20, -18), -18),
      colina: new Vector3(0, g(0, -150), -150),
    },
  };
}
