// Mapa de Carapicuíba: relevo real (AWS Terrain Tiles) + ruas, marcos das fotos, parque e bairros.
// Mapa compacto de 560 x 560 m. Norte = -Z, leste = +X.

import { Box3, Color, CylinderGeometry, Group, Material, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { Heightfield } from '../Heightfield';
import { mulberry32 } from '../noise';
import { Grader, Occupancy, type RoadDef } from './grading';
import { Kit } from './kit';
import { buildChurch, buildQuadraJandaia, buildSchool, buildSede, buildShopping } from './landmarks';
import { loadCityMaterials, signMaterial, type CityMats } from './materials';
import { buildPoles, buildStreets } from './streets';

export const CITY_SIZE = 560;

export interface CityLayout {
  heightfield: Heightfield;
  group: Group;
  colliders: Mesh[];
  spawn: Vector3;
  spawnYaw: number;
  points: Record<string, Vector3>;
  /** volumes cobertos: a luz ambiente diminui lá dentro (interiores não ficam "lavados") */
  interiors: Box3[];
  stats: { casas: number; casasComInterior: number; colisores: number };
}

export const ROADS: RoadDef[] = [
  { name: 'Av. Inocêncio Seráfico', pts: [[205, -280], [205, 280]], width: 14, sidewalk: 3.5, maxGrade: 0.1 },
  { name: 'Rua Europa', pts: [[-110, -150], [198, -150]], width: 8, sidewalk: 2.5 },
  { name: 'Estrada Ernestina Vieira', pts: [[198, 108], [92, 108], [40, 118], [-63, 118]], width: 9, sidewalk: 2.5 },
  { name: 'Rua Serra de Mailasqui', pts: [[-70, -36], [-70, 272]], width: 8, sidewalk: 2.5 },
  { name: 'Rua Norte', pts: [[-272, -232], [198, -232]], width: 7, sidewalk: 2 },
  { name: 'Rua Central', pts: [[-272, -36], [198, -36]], width: 8, sidewalk: 2.5 },
  { name: 'Rua Oeste', pts: [[-150, -272], [-150, -43]], width: 7, sidewalk: 2 },
  { name: 'Rua do Centro', pts: [[40, -225], [40, -43]], width: 7, sidewalk: 2 },
  { name: 'Rua do Shopping', pts: [[96, -29], [96, 101]], width: 8, sidewalk: 2.5 },
  { name: 'Rua Sul', pts: [[-63, 205], [198, 205]], width: 7, sidewalk: 2 },
  { name: 'Rua Leste Norte', pts: [[212, -95], [272, -95]], width: 6, sidewalk: 1.8 },
  { name: 'Rua Leste Sul', pts: [[212, 150], [272, 150]], width: 6, sidewalk: 1.8 },
];

/** Relevo real empacotado: Uint16 (cm acima de `min`) em base64 — ver tools/map/pack_heights.py. */
export function decodeHeights(b64: string, min: number, res: number): Float32Array {
  const bin = atob(b64);
  const out = new Float32Array(res * res);
  if (bin.length !== res * res * 2) throw new Error('relevo com tamanho inválido');
  for (let i = 0; i < out.length; i++) out[i] = min + (bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) / 100;
  return out;
}

export async function buildCarapicuiba(assetBase: string, aniso: number, teamLogo: MeshStandardMaterial | null): Promise<CityLayout> {
  const [data, M] = await Promise.all([
    fetch(`${assetBase}maps/carapicuiba.json`).then((r) => {
      if (!r.ok) throw new Error('relevo de Carapicuíba não encontrado');
      return r.json() as Promise<{ res: number; min: number; heights: string }>;
    }),
    loadCityMaterials(`${assetBase}textures/`, aniso),
  ]);
  const res = data.res;
  const heights = decodeHeights(data.heights, data.min, res);
  const hf = new Heightfield(CITY_SIZE, res, heights, -CITY_SIZE / 2, -CITY_SIZE / 2);
  const natural = new Heightfield(CITY_SIZE, res, heights.slice(), -CITY_SIZE / 2, -CITY_SIZE / 2);
  const G = new Grader(hf);
  const occ = new Occupancy(CITY_SIZE);
  const root = new Group();
  root.name = 'Carapicuiba';
  const colliders: Mesh[] = [];
  const points: Record<string, Vector3> = {};

  // ---------------- 1) ruas sobre o relevo ----------------
  for (const r of ROADS) {
    G.gradeRoad(r);
    occ.markRoad(r);
  }

  // ---------------- 2) platôs dos marcos ----------------
  const placeKit = (k: Kit, cx: number, cz: number, w: number, d: number, yOffset = 0, level?: number): number => {
    const h = level ?? G.meanHeight(cx, cz, w, d);
    G.pad(cx, cz, w + 4, d + 4, h + yOffset, 7);
    occ.markRect(cx, cz, w + 6, d + 6);
    k.place(cx, h + yOffset, cz);
    root.add(k.group);
    colliders.push(...k.colliders);
    Object.assign(points, k.points);
    return h + yOffset;
  };

  // Plaza Shopping: piso 0 no nível da avenida (vale); entrada do piso 1 pela Rua do Shopping (alto)
  const mallCx = 145;
  const mallCz = 42;
  const mallLevel = Math.min(G.meanHeight(mallCx + 20, mallCz, 24, 90), hf.heightAt(196, mallCz) + 0.3);
  const shop = buildShopping(M);
  placeKit(shop, mallCx, mallCz, 66, 98, 0, mallLevel);
  const interiors: Box3[] = [new Box3(new Vector3(mallCx - 32, mallLevel - 0.5, mallCz - 48), new Vector3(mallCx + 32, mallLevel + 10.8, mallCz + 48))];
  // praça da entrada norte (1,4 m abaixo) e acesso do piso 1 pelo oeste
  G.pad(mallCx, mallCz - 48 - 15, 30, 14, mallLevel - 1.4, 6);
  occ.markRect(mallCx, mallCz - 63, 32, 18);
  const westStreetH = hf.heightAt(96 + 6.5, mallCz);
  const accessY = mallLevel + 5.5;
  const acc = new Kit(M);
  acc.block(10, 0.4, 9, 0, -0.4, 0, M.concrete);
  acc.railing(-5, -4.5, 5, -4.5, 0, 1.0, M.steel);
  acc.railing(-5, 4.5, 5, 4.5, 0, 1.0, M.steel);
  const diff = westStreetH - accessY;
  const nSteps = Math.round(Math.abs(diff) / 0.18);
  if (nSteps > 0) {
    // escada entre a calçada e a passarela do piso 1
    const dirX = -1;
    const startY = diff < 0 ? diff : 0;
    acc.stairs(new Vector3(diff < 0 ? -5 - nSteps * 0.3 : -5, startY, 0), new Vector3(diff < 0 ? 1 : dirX, 0, 0), 4, nSteps, Math.abs(diff) / nSteps, 0.3, M.concrete);
  }
  acc.place(mallCx - 32 - 5, accessY, mallCz);
  root.add(acc.group);
  colliders.push(...acc.colliders);

  // Escola Basílio Bosniac + Igreja São Lucas (vizinhas na Rua Europa; igreja na esquina da avenida)
  const school = buildSchool(M);
  const sy = placeKit(school, 60, -121.5, 66, 40);
  interiors.push(new Box3(new Vector3(60 - 28, sy - 0.5, -121.5 - 6), new Vector3(60 + 28, sy + 6.8, -121.5 + 8)));
  const church = buildChurch(M);
  // a igreja fica no nível da avenida (esquina); o terreno natural ali é ~7 m mais alto, então o lote é cortado no morro
  const churchLevel = Math.min(G.meanHeight(170, -126, 32, 26), hf.heightAt(205, -126) + 0.2);
  const cy = placeKit(church, 170, -126, 32, 26, 0.8, churchLevel);
  interiors.push(new Box3(new Vector3(170 - 15, cy - 0.5, -126 - 8), new Vector3(170 + 15, cy + 7.4, -126 + 8)));
  // Quadra fechada do Jandaia (noroeste)
  const quadra = buildQuadraJandaia(M);
  placeKit(quadra, -205, -190, 48, 30);
  // Sede do time (centro do mapa)
  const sede = buildSede(M, teamLogo);
  const dy = placeKit(sede, -18, 12, 46, 42);
  interiors.push(new Box3(new Vector3(-18 - 22, dy - 0.5, 12 - 20), new Vector3(-18 + 22, dy + 9, 12 + 20)));

  // ---------------- 3) Parque do Planalto (fotos 9-11): terraços ----------------
  buildPark(M, G, occ, root, colliders, points);

  // ---------------- 4) bairros: casas nos lotes livres ao longo das ruas ----------------
  occ.markRect(-40, -93, 5, 98);
  occ.markRect(122, -191, 5, 66);
  const houses = new Kit(M, 2.5);
  const stats = buildHouses(houses, M, G, natural, occ);
  // vielas com escadaria ligando ruas em níveis diferentes
  viela(houses, M, hf, -40, -44, -142);
  viela(houses, M, hf, 122, -224, -158);
  root.add(houses.group);
  colliders.push(...houses.colliders);

  // ---------------- 5) ruas, calçadas, postes ----------------
  const streets = buildStreets(ROADS, hf, M, { boxAt: [[205, -150]] });
  root.add(streets.group);
  colliders.push(...streets.colliders);
  const poleKit = new Kit(M);
  const poles = buildPoles(ROADS, hf, M, (w, h, d, x, y, z, m: Material, c = true) => poleKit.box(w, h, d, x, y, z, m, 0, c));
  root.add(poleKit.group, poles);
  colliders.push(...poleKit.colliders);
  // placas de rua
  const signs = new Kit(M);
  for (const r of ROADS.slice(0, 4)) {
    const [x, z] = r.pts[0];
    const [x2, z2] = r.pts[1];
    const dx = Math.sign(x2 - x);
    const dz = Math.sign(z2 - z);
    const px = x + dx * 6 + dz * (r.width / 2 + 1.2);
    const pz = z + dz * 6 - dx * (r.width / 2 + 1.2);
    const y = hf.heightAt(px, pz) + 0.17;
    signs.box(0.08, 2.6, 0.08, px, y + 1.3, pz, M.steel, 0, true);
    signs.sign(2.4, 0.5, px, y + 2.7, pz, signMaterial([r.name], { w: 1024, h: 200, bg: '#1d4e89', fg: '#ffffff' }), Math.atan2(dx, dz) + Math.PI / 2);
  }
  root.add(signs.group);

  // limites invisíveis do mapa
  const edge = new Kit(M);
  const half = CITY_SIZE / 2 - 2;
  for (const [x, z, w, d] of [[0, -half, CITY_SIZE, 1], [0, half, CITY_SIZE, 1], [-half, 0, 1, CITY_SIZE], [half, 0, 1, CITY_SIZE]] as const) {
    const m = edge.box(w, 200, d, x, 60, z, M.concrete, 0, true);
    m.visible = false;
  }
  colliders.push(...edge.colliders);

  points.avenida = new Vector3(205, hf.heightAt(205, 0), 0);
  points.ruaEuropa = new Vector3(0, hf.heightAt(0, -150), -150);
  const spawn = points.sede.clone().add(new Vector3(0, 0.3, -6));
  return { heightfield: hf, group: root, colliders, spawn, spawnYaw: Math.PI, points, interiors, stats: { ...stats, colisores: colliders.length } };
}

// ---------------------------------------------------------------------------------------------
function buildPark(M: CityMats, G: Grader, occ: Occupancy, root: Group, colliders: Mesh[], points: Record<string, Vector3>): void {
  const terraces = [
    { name: 'T1', cx: -150, cz: 82, w: 130, d: 56 },
    { name: 'T2', cx: -155, cz: 150, w: 140, d: 64 },
    { name: 'T3', cx: -160, cz: 226, w: 110, d: 56 },
  ];
  const H: number[] = [];
  for (const t of terraces) {
    const h = G.meanHeight(t.cx, t.cz, t.w, t.d);
    H.push(h);
    G.pad(t.cx, t.cz, t.w, t.d, h, 6);
    occ.markRect(t.cx, t.cz, t.w + 4, t.d + 4);
  }
  const add = (k: Kit) => {
    root.add(k.group);
    colliders.push(...k.colliders);
    Object.assign(points, k.points);
  };
  // T1: ginásio coberto (telhado branco em arco, paredes azuis) + administração + parquinho
  const t1 = new Kit(M);
  t1.block(42, 0.3, 26, -40, -0.3, -2, M.concrete);
  for (const sz of [-1, 1]) t1.wallX(-61, -2 + sz * 13, 0, 42, 3.2, 0.3, M.blue, [{ from: 19, to: 23, bottom: 0, top: 2.6 }]);
  for (const sx of [-1, 1]) t1.wallZ(-40 + sx * 21, -15, 0, 26, 3.2, 0.3, M.blue, [{ from: 11, to: 15, bottom: 0, top: 2.6 }]);
  t1.archRoof(43, 27, 4.5, -40, 4.2, -2, M.plasterWhite, 6);
  for (let x = -60; x <= -20; x += 6) for (const z of [-15, 11]) t1.block(0.3, 4.3, 0.3, x, 0, z, M.steel);
  t1.floorDecal(36, 18, -40, 0.012, -2, M.courtBlue);
  t1.goal(-57, -2, 0);
  t1.goal(-23, -2, Math.PI);
  t1.block(12, 3.2, 8, 40, 0, -10, M.plasterWhite);
  t1.box(12.2, 0.6, 8.2, 40, 3.5, -10, M.blue, 0, false);
  t1.sign(8, 1.4, 40, 2.2, -14.1, signMaterial(['PARQUE DO PLANALTO'], { w: 1024, h: 180, bg: '#ffffff', fg: '#1d4e89' }), Math.PI);
  for (const [x, z] of [[30, 12], [36, 16], [42, 10]]) {
    t1.block(0.15, 2.4, 0.15, x, 0, z, M.yellow);
    t1.block(2.4, 0.15, 0.15, x + 1.2, 2.3, z, M.orange, 0, false);
  }
  t1.ramp(30, 0, 20, 1.2, 3, 30, M.blue);
  for (const [x, z] of [[0, -20], [12, 18], [-12, 22], [55, 18], [-62, 20]]) t1.tree(x, 0, z, 1.0, x + z);
  t1.place(terraces[0].cx, H[0], terraces[0].cz);
  add(t1);
  // T2: parque aquático no centro, duas quadras poliesportivas (oeste), pista de skate/pump track (leste)
  const t2 = new Kit(M);
  const t2y = 0;
  t2.block(30, 0.3, 22, 5, -0.3, 0, M.concrete);
  t2.block(26, 0.1, 18, 5, -0.6, 0, M.poolFloor);
  t2.block(26, 0.06, 18, 5, -0.12, 0, M.water, 0, false);
  for (const [x, z, w, d] of [[5, -9.2, 27, 0.6], [5, 9.2, 27, 0.6], [-8.3, 0, 0.6, 18], [18.3, 0, 0.6, 18]] as const) t2.block(w, 0.5, d, x, -0.3, z, M.plasterWhite);
  // torre com balde (laranja) e postes verdes/amarelos (foto 11)
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) t2.cylinder(0.15, 6, 5 + dx, -0.3, dz, dx > 0 ? M.greenSteel : M.yellow);
  t2.block(4.6, 0.25, 4.6, 5, 4.2, 0, M.greenSteel);
  t2.mesh(new CylinderGeometry(1.3, 1.0, 1.6, 16), M.orange, 5, 6.6, 0, false);
  for (const x of [-4, 13]) {
    t2.cylinder(0.12, 3, x, -0.3, -5, M.greenSteel, false);
    t2.box(3, 0.12, 0.12, x + 1.5, 2.6, -5, M.greenSteel, 0, false);
  }
  t2.ramp(16, -0.3, 4, 1.2, 5, 22, M.blue, -Math.PI / 2);
  for (let i = 0; i < 4; i++) t2.railing(-11 + i * 9, -11.5, -2 + i * 9, -11.5, 0, 1.2, M.blackMetal);
  t2.railing(-11, 11.5, 21, 11.5, 0, 1.2, M.blackMetal);
  // quadras poliesportivas com alambrado e postes de luz
  for (const zc of [-16, 16]) {
    const xc = -48;
    t2.block(34, 0.25, 20, xc, -0.25, zc, M.concrete);
    t2.floorDecal(32, 18, xc, 0.01, zc, M.courtBlue);
    t2.fence(xc - 17, zc - 10, xc + 17, zc - 10, 0, 4);
    t2.fence(xc - 17, zc + 10, xc + 17, zc + 10, 0, 4);
    t2.fence(xc - 17, zc - 10, xc - 17, zc + 10, 0, 4);
    t2.fence(xc + 17, zc - 10, xc + 17, zc + 3, 0, 4);
    t2.goal(xc - 14.6, zc, 0);
    t2.goal(xc + 14.6, zc, Math.PI);
    for (const dx of [-17, 17]) {
      t2.block(0.25, 9, 0.25, xc + dx, 0, zc - 10, M.steel);
      t2.box(1.2, 0.3, 0.6, xc + dx, 9, zc - 10, M.lampLight, 0, false);
    }
  }
  // pista de skate / pump track pintada (azul) com ondulações
  t2.floorDecal(26, 22, 50, 0.02, 4, M.blue);
  for (const [x, z, r] of [[44, -2, 0], [56, 8, Math.PI], [50, 12, Math.PI / 2]] as const) t2.ramp(x, 0, z, 4, 3, 18, M.blue, r);
  for (const [x, z] of [[30, -24], [30, 24], [70, -20], [-20, 26], [70, 22], [-75, 0]]) t2.tree(x, 0, z, 1.15, x * z);
  void t2y;
  t2.points.parqueAquatico = new Vector3(5, 0.1, -14);
  t2.place(terraces[1].cx, H[1], terraces[1].cz);
  add(t2);
  // T3: campo de futebol (grama sintética) no fundo do parque, como na foto aérea
  const t3 = new Kit(M);
  t3.block(56, 0.25, 36, 0, -0.25, 0, M.concrete);
  t3.floorDecal(52, 32, 0, 0.012, 0, M.turf);
  t3.fence(-28, -18, 28, -18, 0, 5);
  t3.fence(-28, 18, 28, 18, 0, 5);
  t3.fence(-28, -18, -28, 18, 0, 5);
  t3.fence(28, -18, 28, -2, 0, 5);
  t3.fence(28, 2, 28, 18, 0, 5);
  t3.goal(-25, 0, 0, 5, 2.2);
  t3.goal(25, 0, Math.PI, 5, 2.2);
  for (let i = 0; i < 3; i++) t3.block(30, 0.4 * (i + 1), 0.9, 0, 0, -19.6 - i * 0.9, M.concrete);
  t3.points.campo = new Vector3(0, 0.1, 21);
  t3.place(terraces[2].cx, H[2], terraces[2].cz);
  add(t3);
  // caminhos e escadas entre terraços (lado leste do parque)
  const paths = new Kit(M);
  for (let k = 0; k < 2; k++) {
    const za = terraces[k].cz + terraces[k].d / 2 - 2;
    const zb = terraces[k + 1].cz - terraces[k + 1].d / 2 + 2;
    const ha = H[k];
    const hb = H[k + 1];
    const n = Math.max(1, Math.round(Math.abs(hb - ha) / 0.18));
    const run = Math.max(0.28, (zb - za) / n);
    const up = hb > ha;
    paths.stairs(new Vector3(-95, up ? ha : hb, up ? za : zb), new Vector3(0, 0, up ? 1 : -1), 3, n, Math.abs(hb - ha) / n, run, M.concrete);
  }
  root.add(paths.group);
  colliders.push(...paths.colliders);
}

// ---------------------------------------------------------------------------------------------
function buildHouses(k: Kit, M: CityMats, G: Grader, natural: Heightfield, occ: Occupancy): { casas: number; casasComInterior: number } {
  const rnd = mulberry32(2026);
  let casas = 0;
  let enter = 0;
  const hf = G.hf;
  for (const road of ROADS) {
    for (let s = 0; s < road.pts.length - 1; s++) {
      const [ax, az] = road.pts[s];
      const [bx, bz] = road.pts[s + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const tx = (bx - ax) / len;
      const tz = (bz - az) / len;
      if (Math.abs(tx) > 0.05 && Math.abs(tz) > 0.05) continue; // só trechos alinhados aos eixos
      for (const side of [-1, 1]) {
        const nx = -tz * side;
        const nz = tx * side;
        let d = 4;
        while (d < len - 4) {
          const w = 7 + Math.floor(rnd() * 4);
          const depth = 9 + Math.floor(rnd() * 5);
          const set = road.width / 2 + road.sidewalk + 0.6;
          const cx = ax + tx * (d + w / 2) + nx * (set + depth / 2);
          const cz = az + tz * (d + w / 2) + nz * (set + depth / 2);
          const fw = Math.abs(tx) > 0.5 ? w : depth;
          const fd = Math.abs(tx) > 0.5 ? depth : w;
          // nível: calçada em frente ao lote
          const fx = ax + tx * (d + w / 2) + nx * (set - 0.4);
          const fz = az + tz * (d + w / 2) + nz * (set - 0.4);
          d += w + (rnd() < 0.15 ? 3 : 0.3);
          if (!occ.free(cx, cz, fw, fd)) continue;
          occ.markRect(cx, cz, fw, fd);
          const y0 = hf.heightAt(fx, fz) + 0.2;
          let lo = Infinity;
          for (const [qx, qz] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) lo = Math.min(lo, natural.heightAt(cx + (qx * fw) / 2, cz + (qz * fd) / 2));
          G.pad(cx, cz, fw, fd, y0, 2.5);
          const floors = 1 + Math.floor(rnd() * rnd() * 3.2);
          const enterable = rnd() < 0.25;
          const facing = Math.atan2(-nx, -nz); // frente da casa voltada para a rua
          house(k, M, rnd, cx, y0, cz, fw, fd, floors, facing, enterable, Math.min(lo, y0));
          casas++;
          if (enterable) enter++;
        }
      }
    }
  }
  // preenche o miolo das quadras (casas sem frente para rua, separadas por vielas de ~2 m)
  for (let z = -266; z < 266; z += 10.5) {
    for (let x = -266; x < 266; x += 9.5) {
      const w = 6 + Math.floor(rnd() * 3);
      const depth = 7 + Math.floor(rnd() * 3);
      const cx = x + (rnd() - 0.5) * 2;
      const cz = z + (rnd() - 0.5) * 2;
      if (!occ.free(cx, cz, w + 2.2, depth + 2.2)) continue;
      occ.markRect(cx, cz, w, depth);
      let lo = Infinity;
      let hi = -Infinity;
      for (const [qx, qz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const h = natural.heightAt(cx + (qx * w) / 2, cz + (qz * depth) / 2);
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
      const y0 = hf.heightAt(cx, cz) + 0.15;
      G.pad(cx, cz, w, depth, y0, 1.5);
      const floors = 1 + Math.floor(rnd() * rnd() * 3.4);
      const enterable = rnd() < 0.22;
      const facing = [0, Math.PI / 2, Math.PI, -Math.PI / 2][Math.floor(rnd() * 4)];
      house(k, M, rnd, cx, y0, cz, w, depth, floors, facing, enterable, Math.min(lo, y0));
      casas++;
      if (enterable) enter++;
      void hi;
    }
  }
  return { casas, casasComInterior: enter };
}

function house(k: Kit, M: CityMats, rnd: () => number, cx: number, y0: number, cz: number, fw: number, fd: number, floors: number, facing: number, enterable: boolean, ground: number): void {
  const fh = 2.9;
  const H = floors * fh;
  const brick = rnd() < 0.32;
  const wall = brick ? M.rawBrick : M.plasterTint;
  const tint = new Color(M.houseColors[Math.floor(rnd() * M.houseColors.length)]);
  const first = k.group.children.length;
  // fundação (casas em encosta ficam sobre base de concreto)
  if (y0 - ground > 0.25) k.block(fw, y0 - ground + 0.2, fd, cx, ground - 0.2, cz, M.concreteDark);
  // vetor da frente (para a rua) em X/Z
  const fx = Math.round(Math.sin(facing));
  const fz = Math.round(Math.cos(facing));
  const alongX = fz !== 0; // fachada paralela a X
  const front = alongX ? cz + (fz * fd) / 2 : cx + (fx * fw) / 2;
  const width = alongX ? fw : fd;
  if (!enterable) {
    k.block(fw, H, fd, cx, y0, cz, wall);
  } else {
    // casa com interior: paredes com porta e janelas, lajes com escada até a laje de cobertura
    const t = 0.2;
    for (let f = 0; f < floors; f++) {
      const y = y0 + f * fh;
      const ops = f === 0 ? [{ from: width / 2 - 0.5, to: width / 2 + 0.5, bottom: 0, top: 2.1 }, { from: 1, to: 2.3, bottom: 1.0, top: 2.1 }] : [{ from: 1, to: 2.3, bottom: 1.0, top: 2.1 }, { from: width - 2.3, to: width - 1, bottom: 1.0, top: 2.1 }];
      if (alongX) {
        k.wallX(cx - fw / 2, cz - fd / 2 + t / 2, y, fw, fh, t, wall, fz < 0 ? ops : [{ from: 1, to: 2, bottom: 1.2, top: 2.0 }]);
        k.wallX(cx - fw / 2, cz + fd / 2 - t / 2, y, fw, fh, t, wall, fz > 0 ? ops : [{ from: 1, to: 2, bottom: 1.2, top: 2.0 }]);
        k.wallZ(cx - fw / 2 + t / 2, cz - fd / 2, y, fd, fh, t, wall);
        k.wallZ(cx + fw / 2 - t / 2, cz - fd / 2, y, fd, fh, t, wall);
      } else {
        k.wallZ(cx - fw / 2 + t / 2, cz - fd / 2, y, fd, fh, t, wall, fx < 0 ? ops : [{ from: 1, to: 2, bottom: 1.2, top: 2.0 }]);
        k.wallZ(cx + fw / 2 - t / 2, cz - fd / 2, y, fd, fh, t, wall, fx > 0 ? ops : [{ from: 1, to: 2, bottom: 1.2, top: 2.0 }]);
        k.wallX(cx - fw / 2, cz - fd / 2 + t / 2, y, fw, fh, t, wall);
        k.wallX(cx - fw / 2, cz + fd / 2 - t / 2, y, fw, fh, t, wall);
      }
      // escada encostada na parede do fundo, laje com vão sobre ela
      const sx = cx - fw / 2 + 0.95;
      const sz0 = cz - fd / 2 + 0.4;
      k.stairs(new Vector3(sx, y, sz0), new Vector3(0, 0, 1), 1.0, 16, fh / 16, 0.28, M.concrete);
      k.slab(cx - fw / 2, cx + fw / 2, cz - fd / 2, cz + fd / 2, y + fh, 0.18, M.concrete, [[sx - 0.55, sx + 0.55, sz0 - 0.05, sz0 + 16 * 0.28 + 0.05]]);
    }
  }
  // cobertura: laje com platibanda e caixa d'água (maioria) ou telhado cerâmico
  if (rnd() < 0.72 || enterable) {
    if (!enterable) k.block(fw + 0.1, 0.18, fd + 0.1, cx, y0 + H, cz, M.concrete);
    for (const [px, pz, pw, pd] of [[cx, cz - fd / 2 + 0.08, fw, 0.16], [cx, cz + fd / 2 - 0.08, fw, 0.16], [cx - fw / 2 + 0.08, cz, 0.16, fd], [cx + fw / 2 - 0.08, cz, 0.16, fd]] as const) {
      k.block(pw, 0.7, pd, px, y0 + H + 0.18, pz, wall);
    }
    k.cylinder(0.65, 1.0, cx + fw / 4, y0 + H + 0.18, cz + fd / 4, M.waterTank, true, 10);
  } else {
    const pitch = 0.42;
    const span = alongX ? fd : fw;
    const slant = span / 2 / Math.cos(pitch) + 0.4;
    for (const sd of [-1, 1]) {
      const r = k.box(alongX ? fw + 0.6 : slant, 0.12, alongX ? slant : fd + 0.6, alongX ? cx : cx + (sd * span) / 4, y0 + H + Math.tan(pitch) * span / 4, alongX ? cz + (sd * span) / 4 : cz, M.roofTile, 0, true);
      if (alongX) r.rotation.x = sd * pitch;
      else r.rotation.z = -sd * pitch;
      r.updateMatrixWorld(true);
    }
  }
  // fachada: janelas com grade, portão de garagem, muro frontal baixo
  const winY = [];
  for (let f = 0; f < floors; f++) winY.push(y0 + f * fh + 1.55);
  for (const wy of winY) {
    for (const off of [-width / 4, width / 4]) {
      if (enterable && Math.abs(off) < 1.2) continue;
      const wx = alongX ? cx + off : front + fx * 0.02;
      const wz = alongX ? front + fz * 0.02 : cz + off;
      k.box(alongX ? 1.2 : 0.05, 1.05, alongX ? 0.05 : 1.2, wx, wy, wz, M.darkGlass, 0, false);
      k.box(alongX ? 1.35 : 0.08, 0.08, alongX ? 0.08 : 1.35, wx, wy - 0.6, wz, M.plasterWhite, 0, false);
    }
  }
  if (!enterable && rnd() < 0.45) {
    const gx = alongX ? cx + width / 4 : front + fx * 0.03;
    const gz = alongX ? front + fz * 0.03 : cz + width / 4;
    k.box(alongX ? 2.6 : 0.06, 2.3, alongX ? 0.06 : 2.6, gx, y0 + 1.15, gz, M.shutter, 0, false);
  }
  for (let i = first; i < k.group.children.length; i++) {
    const o = k.group.children[i] as Mesh;
    if (o.material === M.plasterTint) o.userData.tint = tint;
  }
}

/** Viela com escadaria acompanhando o terreno entre (x, z0) e (x, z1). */
function viela(k: Kit, M: CityMats, hf: Heightfield, x: number, z0: number, z1: number): void {
  const dir = Math.sign(z1 - z0);
  let prevY = hf.heightAt(x, z0);
  for (let z = z0; dir > 0 ? z < z1 : z > z1; z += dir * 0.6) {
    const gy = hf.heightAt(x, z);
    // degraus de no máximo 18 cm
    const y = Math.abs(gy - prevY) > 0.18 ? prevY + Math.sign(gy - prevY) * 0.18 : gy;
    k.block(2.6, Math.max(0.2, y - Math.min(y, gy) + 0.2), 0.62, x, Math.min(y, gy) - 0.2 + 0.0, z, M.concrete);
    prevY = y;
  }
  for (const sx of [-1.6, 1.6]) {
    for (let z = z0; dir > 0 ? z < z1 : z > z1; z += dir * 4) k.block(0.2, 1.1, 4, x + sx, hf.heightAt(x, z), z + dir * 2, M.plasterWhite);
  }
}
