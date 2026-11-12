// Marcos de Carapicuíba reconstruídos a partir das fotos de referência (coordenadas locais).
// Lojas e marcas dentro do shopping são fictícias (as logomarcas reais das fotos não são reproduzidas).

import { CanvasTexture, ConeGeometry, CylinderGeometry, ExtrudeGeometry, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace, Shape, TorusGeometry, Vector3 } from 'three';
import { Kit } from './kit';
import { schoolGateMaterial, signMaterial, type CityMats } from './materials';

const V = (x: number, y: number, z: number) => new Vector3(x, y, z);

/** Atlas de letreiros (uma textura para todas as placas de loja: mescla em um único draw call). */
class SignAtlas {
  readonly mat: MeshStandardMaterial;
  private cv = document.createElement('canvas');
  private n = 0;
  constructor(private cols = 4, private rows = 8) {
    this.cv.width = 2048;
    this.cv.height = 1024;
    const t = new CanvasTexture(this.cv);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    this.mat = new MeshStandardMaterial({ map: t, roughness: 0.55, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25 });
    this.mat.name = 'LetreirosLojas';
  }
  add(text: string, bg: string, fg: string): PlaneGeometry {
    const i = this.n++;
    const cw = this.cv.width / this.cols;
    const ch = this.cv.height / this.rows;
    const x = (i % this.cols) * cw;
    const y = Math.floor(i / this.cols) * ch;
    const g = this.cv.getContext('2d')!;
    g.fillStyle = bg;
    g.fillRect(x + 2, y + 2, cw - 4, ch - 4);
    g.fillStyle = fg;
    g.font = `700 ${Math.floor(ch * 0.5)}px "Segoe UI", Roboto, Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, x + cw / 2, y + ch / 2 + 2, cw - 20);
    (this.mat.map as CanvasTexture).needsUpdate = true;
    const geo = new PlaneGeometry(1, 1);
    const uv = geo.attributes.uv;
    const u0 = x / this.cv.width;
    const u1 = (x + cw) / this.cv.width;
    const v1 = 1 - y / this.cv.height;
    const v0 = 1 - (y + ch) / this.cv.height;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) ? u1 : u0, uv.getY(k) ? v1 : v0);
    return geo;
  }
}

// ---------------------------------------------------------------------------------------------
// FOTO 1 — Quadra fechada do Jandaia: cobertura em arco metálico, treliças, cobogó nas cabeceiras,
// laterais baixas azuis com alambrado, tabela pendurada e tabela no pilar de tijolo.
// ---------------------------------------------------------------------------------------------
export function buildQuadraJandaia(M: CityMats): Kit {
  const k = new Kit(M);
  const L = 46;
  const W = 28;
  k.block(L, 0.3, W, 0, -0.3, 0, M.concrete);
  k.floorDecal(40, 20, 0, 0.012, 0, M.courtGray);
  // laterais: mureta azul + alambrado + pilares
  for (const sz of [-1, 1]) {
    const z = (sz * W) / 2;
    for (let x = -L / 2; x < L / 2; x += 4.6) {
      const gap = Math.abs(x) < 3 && sz > 0; // entrada lateral
      if (!gap) k.block(4.6, 1.0, 0.25, x + 2.3, 0, z, M.blue);
      k.block(0.35, 5.5, 0.35, x, 0, z, M.steel);
    }
    k.fence(-L / 2, z, L / 2, z, 1.0, 3.2);
  }
  // abóbada metálica com treliças
  k.archRoof(L + 1, W, 6.5, 0, 5.5, 0, M.metal, 4.6);
  // cabeceiras: cobogó (até o arco) sobre base de tela, pilar de tijolo central
  const r = ((W * W) / 4 + 6.5 * 6.5) / (2 * 6.5);
  for (const sx of [-1, 1]) {
    const x = (sx * L) / 2;
    for (let y = 1.2; y < 5.5 + 6.5; y += 1) {
      const top = Math.min(5.5 + 6.5, y + 1);
      const ymid = (y + top) / 2 - 5.5;
      const half = ymid <= 0 ? W / 2 : Math.sqrt(Math.max(0, r * r - (ymid + (r - 6.5)) ** 2));
      if (half < 0.5) continue;
      const g = new PlaneGeometry(half * 2, top - y);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * half * 2) / 1.6, (uv.getY(i) * (top - y)) / 1.6);
      const m = k.mesh(g, M.cobogo, x, (y + top) / 2, 0, true, Math.PI / 2);
      m.castShadow = true;
    }
    k.fence(x, -W / 2, x, -2, 0, 1.2);
    k.fence(x, 2, x, W / 2, 0, 1.2);
    k.block(1.4, 4.2, 1.0, x - sx * 0.3, 0, 0, M.brick); // pilar de tijolo
  }
  // tabelas: uma no pilar (fundo) e outra pendurada na estrutura (como na foto)
  k.hoop(L / 2 - 1.0, 3.05, 0, Math.PI, 'nenhum');
  k.hoop(-L / 2 + 2.6, 3.05, 0, 0, 'nenhum');
  k.box(0.1, 6.5, 0.1, -L / 2 + 2.2, 3.05 + 3.6, 0, M.steel, 0, false);
  k.goal(-19.6, 0, 0);
  k.goal(19.6, 0, Math.PI);
  // arquibancada de 3 degraus
  for (let i = 0; i < 3; i++) k.block(30, 0.45 * (i + 1), 0.8, 0, 0, -W / 2 + 1.2 + i * 0.8, M.concrete);
  // luminárias
  for (let x = -18; x <= 18; x += 9) k.box(1.2, 0.15, 0.4, x, 10.6, 0, M.lampLight, 0, false);
  k.points.quadraJandaia = V(0, 0.2, W / 2 + 3);
  return k;
}

// ---------------------------------------------------------------------------------------------
// FOTOS 2, 3 e 4 — Plaza Shopping Carapicuíba: caixa branca com painel de faixas laranja,
// entrada principal envidraçada com marquise e escadaria. Interior explorável e deteriorado.
// Coordenadas: x [-32,32] (leste = +x, avenida), z [-48,48] (norte = -z). Piso 0 em y=0, piso 1 em 5.5.
// ---------------------------------------------------------------------------------------------
export function buildShopping(M: CityMats): Kit {
  const k = new Kit(M, 3);
  const X = 32;
  const Z = 48;
  const F1 = 5.5;
  const RF = 11;
  const T = 0.4;
  const atlas = new SignAtlas();
  // lajes
  k.block(2 * X, 0.3, 2 * Z, 0, -0.3, 0, M.floorTile);
  const voidX = 4;
  const voidZ = 8;
  k.slab(-X, X, -Z, Z, F1, 0.3, M.floorTile, [[-voidX, voidX, -voidZ, voidZ], [-2.1, 2.1, 29.4, 37.2], [20.2, 22.2, 33.4, 41]]);
  // laje da cobertura com claraboia sobre o vão
  k.block(2 * X, 0.4, Z - voidZ, 0, RF - 0.4, -(Z + voidZ) / 2, M.concrete);
  k.block(2 * X, 0.4, Z - voidZ, 0, RF - 0.4, (Z + voidZ) / 2, M.concrete);
  k.block(X - voidX, 0.4, 2 * voidZ, -(X + voidX) / 2, RF - 0.4, 0, M.concrete);
  k.block(X - voidX, 0.4, 2 * voidZ, (X + voidX) / 2, RF - 0.4, 0, M.concrete);
  k.block(2 * voidX, 0.08, 2 * voidZ, 0, RF - 0.1, 0, M.glass);
  for (let z = -voidZ; z <= voidZ; z += 4) k.box(2 * voidX, 0.15, 0.15, 0, RF, z, M.steel, 0, false);
  // guarda-corpo do vão (piso 1)
  k.railing(-voidX, -voidZ, -2.95, -voidZ, F1, 1.05, M.steel);
  k.railing(-0.65, -voidZ, voidX, -voidZ, F1, 1.05, M.steel);
  k.railing(-voidX, voidZ, 0.65, voidZ, F1, 1.05, M.steel);
  k.railing(2.95, voidZ, voidX, voidZ, F1, 1.05, M.steel);
  k.railing(-voidX, -voidZ, -voidX, voidZ, F1, 1.05, M.steel);
  k.railing(voidX, -voidZ, voidX, voidZ, F1, 1.05, M.steel);

  // ---- paredes externas ----
  const H = RF + 1.3;
  // oeste: entrada do piso 1 pela rua de cima
  k.wallZ(-X + T / 2, -Z, 0, 2 * Z, H, T, M.mallWhite, [{ from: Z - 4, to: Z + 4, bottom: F1, top: F1 + 3.2 }]);
  // leste: entrada do piso 0 pela avenida; painel de faixas laranja na parte alta
  k.wallZ(X - T / 2, -Z, 0, 2 * Z, H, T, M.mallWhite, [{ from: Z - 5, to: Z + 5, bottom: 0, top: 3.6 }]);
  const pan = k.box(0.1, 6.5, 40, X + 0.06, RF - 3.2, -20, M.mallPanel, 0, false);
  pan.castShadow = false;
  // norte: entrada principal (foto 4) com vidro, marquise e escadaria
  k.wallX(-X, -Z + T / 2, 0, 2 * X, H, T, M.mallWhite, [{ from: X - 10, to: X + 10, bottom: 0, top: 4.2 }]);
  // sul: docas de carga com portas de aço
  k.wallX(-X, Z - T / 2, 0, 2 * X, H, T, M.mallGray, [{ from: 46, to: 51, bottom: 0, top: 4 }, { from: 32.2, to: 33.6, bottom: F1, top: F1 + 2.2 }, { from: 40.6, to: 43.2, bottom: RF, top: H }]);
  k.block(5, 4, 0.15, 16.5, 0, Z - 0.1, M.shutter); // doca fechada
  // fachada norte: vidro com caixilhos, marquise, letreiro com traço curvo original
  for (let x = -9.5; x <= 9.5; x += 2) {
    const broken = Math.abs(x - 3.5) < 0.6 || Math.abs(x + 5.5) < 0.6;
    if (!broken) k.box(1.9, 4.0, 0.04, x, 2.1, -Z + 0.2, M.glass, 0, Math.abs(x) > 2);
    k.box(0.08, 4.2, 0.12, x - 1, 2.1, -Z + 0.2, M.steel, 0, false);
  }
  k.box(26, 0.35, 6, 0, 4.6, -Z - 2.8, M.mallWhite, 0, true); // marquise
  for (const x of [-12, 12]) k.box(0.4, 4.6, 0.4, x, 2.3, -Z - 5.4, M.mallWhite, 0, true);
  k.sign(16, 4, 6, 8.2, -Z - 0.25, signMaterial(['PLAZA SHOPPING', 'CARAPICUÍBA'], { w: 1024, h: 256, bg: 'transparent', fg: '#3b3f44', align: 'right', swoosh: true }), Math.PI);
  // escadaria da entrada principal (desce para a calçada) com corrimãos
  k.stairs(V(0, -1.4, -Z - 7.6 - 0.32 * 7), V(0, 0, 1), 18, 7, 0.2, 0.32, M.concrete);
  for (const x of [-6, 0, 6]) k.railing(x, -Z - 7.6 - 2.2, x, -Z - 6.2, -0.4, 0.9, M.steel, false);
  k.block(26, 0.3, 7.7, 0, -0.3, -Z - 3.85, M.concrete); // patamar sob a marquise
  // letreiros externos de lojas fictícias (lado leste, foto 3)
  const ext = [
    ['CINE PLAZA', '#b8263c', '#fff'], ['MODA SILVIÂNIA', '#c0392b', '#fff'], ['LOJAS EUROPA', '#2c3e50', '#fff'],
    ['BURGER 14', '#d32f2f', '#ffd54f'], ['FARMA PLANALTO', '#1565c0', '#fff'], ['ELETRO DIRCE', '#37474f', '#ffca28'],
  ];
  ext.forEach(([t, bg, fg], i) => {
    const g = atlas.add(t, bg, fg);
    g.scale(5.5, 1.6, 1);
    g.rotateY(Math.PI / 2);
    k.mesh(g, atlas.mat, X + 0.15, 4.6 + (i % 3) * 2.1, 6 + Math.floor(i / 3) * 7.5);
  });

  // ---- circulação interna ----
  // escadas rolantes paradas (rampa com degraus visuais) e escada fixa
  const esc = Math.atan(F1 / 10) * (180 / Math.PI);
  k.ramp(-1.8, 0, 2, 2.2, 10, esc, M.steel, Math.PI); // sobe para o norte, sai em z = -8
  k.ramp(1.8, 0, -2, 2.2, 10, esc, M.steel); // sobe para o sul, sai em z = +8
  k.stairs(V(0, 0, 30.6), V(0, 0, 1), 4, 22, F1 / 22, 0.3, M.concreteDark);

  // ---- lojas ----
  type St = 'aberta' | 'fechada' | 'meia';
  const names = ['MERCADO DIRCE', 'LOJAS EUROPA', 'ÓTICA SÃO LUCAS', 'CALÇADOS JANDAIA', 'TECH CARAPI', 'BIJU MODA', 'PAPELARIA PLANALTO', 'ESPORTES 06382',
    'CELULAR & CIA', 'SALÃO ESTRELA', 'GAMES ZONA', 'PERFUMARIA AURORA', 'LOJA DO TIME', 'CAFÉ DA PRAÇA', 'BRINQUEDOS FELIZ', 'CASA & LAR'];
  let si = 0;
  const store = (side: -1 | 1, floorY: number, z0: number, z1: number, depth: number, state: St) => {
    const xf = side * 6; // frente da loja
    const xb = side * (6 + depth);
    const len = z1 - z0;
    const op = { from: 1, to: len - 1, bottom: 0, top: 4.1 };
    k.wallZ(xf, z0, floorY, len, F1 - 0.3, 0.25, M.mallGray, [op]);
    // divisórias
    k.wallX(Math.min(xf, xb), z0, floorY, Math.abs(xb - xf), F1 - 0.3, 0.2, M.plasterWhite);
    const name = names[si++ % names.length];
    const g = atlas.add(name, ['#2e3b4e', '#7b1f2b', '#1e5631', '#4a2c6f', '#8a5a00'][si % 5], '#ffffff');
    g.scale(len - 2, 0.9, 1);
    g.rotateY(side < 0 ? Math.PI / 2 : -Math.PI / 2);
    k.mesh(g, atlas.mat, xf - side * 0.15, floorY + 4.6, (z0 + z1) / 2);
    const cz = (z0 + z1) / 2;
    if (state === 'fechada') k.block(0.12, 4.1, len - 2, xf, floorY, cz, M.shutter);
    else if (state === 'meia') k.block(0.12, 4.1 - 1.3, len - 2, xf, floorY + 1.3, cz, M.shutter);
    else {
      // vitrine parcialmente quebrada
      for (let z = z0 + 1.5; z < z1 - 1.5; z += 2.2) if ((Math.floor(z) + si) % 3 !== 0) k.box(0.04, 3.0, 2.0, xf - side * 0.1, floorY + 1.8, z, M.glass, 0, false);
    }
    // mobiliário: balcão, prateleiras, entulho
    const mid = (xf + xb) / 2;
    k.block(1.0, 1.05, Math.min(5, len - 3), xf + side * 2.2, floorY, cz - 1, M.wood);
    for (let z = z0 + 2; z < z1 - 1.5; z += 3.5) k.block(0.6, 2.1, 2.4, mid + side * 1.5, floorY, z + 1.2, M.steel);
    if (si % 2 === 0) {
      k.block(1.2, 0.6, 1.0, xb - side * 1.5, floorY, cz + 2, M.rubble, 0.6);
      k.block(0.9, 0.9, 0.9, xb - side * 2.4, floorY, cz - 2.5, M.rubble, 0.3);
    }
  };
  // piso 0: âncoras a oeste, lojas pequenas a leste (corredor leste z -5..5 até a entrada)
  store(-1, 0, -44, -5, 26, 'aberta');
  store(-1, 0, 5, 44, 26, 'meia');
  store(1, 0, -44, -32, 14, 'fechada');
  store(1, 0, -32, -18, 14, 'aberta');
  store(1, 0, -18, -5, 14, 'meia');
  store(1, 0, 5, 18, 14, 'aberta');
  store(1, 0, 18, 30, 14, 'fechada');
  // piso 1
  store(-1, F1, -30, -4, 14, 'aberta');
  store(-1, F1, 4, 28, 14, 'fechada');
  store(1, F1, -30, -17, 14, 'aberta');
  store(1, F1, -17, -5, 14, 'meia');
  store(1, F1, 5, 17, 14, 'aberta');
  store(1, F1, 17, 28, 14, 'aberta');
  // corredor de serviço (x 20..24) com depósitos (x 24..32) e escada para a cobertura
  for (const fy of [0, F1]) {
    k.wallZ(20, -44, fy, 88, F1 - 0.3, 0.25, M.concreteDark, [{ from: 39, to: 49, bottom: 0, top: 3.4 }, { from: 76, to: 78.5, bottom: 0, top: 2.2 }]);
    k.wallZ(24, -44, fy, 88, F1 - 0.3, 0.25, M.concreteDark, [
      { from: 6, to: 8, bottom: 0, top: 2.2 }, { from: 38, to: 50, bottom: 0, top: 3.4 }, { from: 72, to: 74, bottom: 0, top: 2.2 },
    ]);
    for (const z of [-24, -6, 6, 24]) k.wallX(24, z, fy, 8, F1 - 0.3, 0.2, M.concreteDark, [{ from: 3, to: 5, bottom: 0, top: 2.2 }]);
    for (let i = 0; i < 9; i++) k.block(1.1, 1.1, 1.1, 26 + (i % 3) * 1.6, fy + Math.floor(i / 6) * 1.1, -40 + i * 3.4, M.rubble, i * 0.4);
  }
  k.stairs(V(21.2, 0, 34.4), V(0, 0, 1), 1.8, 22, F1 / 22, 0.3, M.concreteDark);
  // escada de incêndio externa (fachada sul) até a cobertura
  k.stairs(V(2, F1, Z + 1.2), V(1, 0, 0), 1.6, 22, F1 / 22, 0.3, M.steel);
  k.block(3, 0.25, 2.4, 1, F1 - 0.25, Z + 1.2, M.steel);
  k.block(2.6, 0.25, 2.4, 9.9, RF - 0.25, Z + 1.2, M.steel);
  k.railing(0, Z + 2.4, 11, Z + 2.4, F1, 1.0, M.steel);
  k.stairs(V(-6.6, 0, Z + 1.2), V(1, 0, 0), 1.6, 22, F1 / 22, 0.3, M.steel);
  // praça de alimentação (piso 1, norte)
  for (let x = -26; x <= 14; x += 5) for (let z = -44; z <= -34; z += 5) if ((x + z) % 3 !== 0) k.tableSet(x, F1, z);
  for (let x = -28; x <= 16; x += 7) {
    k.block(5.5, 1.1, 1.2, x, F1, -46.6, M.wood);
    const g = atlas.add(['PASTEL DA FEIRA', 'SUCOS', 'PIZZA', 'AÇAÍ', 'YAKISSOBA', 'CHURRASCO', 'SORVETE'][((x + 28) / 7) | 0] ?? 'LANCHES', '#e65100', '#fff');
    g.scale(5, 0.9, 1);
    k.mesh(g, atlas.mat, x, F1 + 3.6, -Z + 0.3);
  }
  // cinema (piso 1, sul): duas salas escuras
  k.wallX(-X, 30, F1, 26, F1 - 0.3, 0.25, M.darkGlass, [{ from: 10, to: 13, bottom: 0, top: 2.6 }]);
  k.wallZ(-19, 30, F1, 18, F1 - 0.3, 0.25, M.darkGlass, [{ from: 7, to: 9, bottom: 0, top: 2.4 }]);
  for (let i = 0; i < 6; i++) k.block(10, 0.4 + i * 0.35, 1.4, -26, F1, 33 + i * 1.6, M.blackMetal);
  // equipamentos na cobertura (pontos de observação)
  for (const [x, z] of [[-20, -30], [-20, 26], [14, -30], [14, 20], [26, -6]]) k.block(4, 2, 3, x, RF, z, M.steel);
  k.cylinder(1.4, 3, 26, RF, 34, M.waterTank);
  // vegetação externa (palmeiras na entrada)
  for (const [x, z] of [[-15, -Z - 4], [15, -Z - 4], [-26, -Z - 3], [26, -Z - 3]]) k.palm(x, 0, z, 7.5, x);
  k.points.shoppingNorte = V(0, -1.2, -Z - 11);
  k.points.shoppingAtrio = V(0, 0.1, 0);
  k.points.shoppingCobertura = V(0, RF + 0.1, -20);
  return k;
}

// ---------------------------------------------------------------------------------------------
// FOTOS 5 a 8 — Escola Estadual Basílio Bosniac: muro com "pedras" azuis pintadas, alambrado,
// portão com desenho e aviso, placa de concreto, prédio de 2 andares com faixas e janelas em fita.
// Lote x [-35,35], z [-22,22]; a Rua Europa passa ao norte (z = -22).
// ---------------------------------------------------------------------------------------------
export function buildSchool(M: CityMats): Kit {
  const k = new Kit(M);
  k.block(70, 0.3, 44, 0, -0.3, 0, M.concrete);
  // muro da rua com portões e tela acima
  k.wallX(-35, -22, 0, 70, 2.4, 0.35, M.schoolWall, [{ from: 28, to: 33, bottom: 0, top: 2.4 }, { from: 36, to: 37.4, bottom: 0, top: 2.2 }]);
  k.block(5, 2.3, 0.1, -4.5, 0, -21.95, M.blue);
  k.sign(5, 2.3, -4.5, 1.15, -22.02, schoolGateMaterial(), Math.PI);
  k.fence(-35, -22, 35, -22, 2.4, 2.2);
  for (const x of [-35, 35]) k.wallZ(x, -22, 0, 44, 2.4, 0.35, M.schoolWall);
  k.wallX(-35, 22, 0, 70, 2.4, 0.35, M.schoolWall);
  k.block(1.3, 1.7, 0.45, 5.2, 0, -21.4, M.concrete);
  k.sign(1.1, 0.8, 5.2, 1.15, -21.65, signMaterial(['E.BASÍLIO', 'BOSNIAC'], { w: 512, h: 384, bg: '#d7d7d2', fg: '#555' }), Math.PI);
  // prédio principal: 2 pavimentos, corredor ao sul, 6 salas por andar
  const x0 = -28;
  const x1 = 28;
  const zN = -6;
  const zS = 8;
  const fh = 3.4;
  for (let f = 0; f < 2; f++) {
    const y = f * fh;
    const wins = [];
    for (let i = 0; i < 6; i++) wins.push({ from: 1.2 + i * 9.33, to: 8.2 + i * 9.33, bottom: 1.0, top: 2.7 });
    k.wallX(x0, zN, y, x1 - x0, fh, 0.3, M.plasterWhite, wins);
    // janelas (vidro escuro + montantes)
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 4; j++) {
        const wx = x0 + 1.2 + i * 9.33 + 0.875 + j * 1.75;
        k.box(1.6, 1.6, 0.05, wx, y + 1.85, zN, M.darkGlass, 0, j !== 1);
        k.box(0.08, 1.7, 0.12, wx - 0.875, y + 1.85, zN - 0.05, M.schoolBand, 0, false);
      }
    }
    k.wallX(x0, zS, y, x1 - x0, fh, 0.3, M.plasterWhite, [{ from: 4, to: 6, bottom: 0, top: 2.3 }, { from: 40, to: 42, bottom: 0, top: 2.3 }]);
    k.wallZ(x0, zN, y, zS - zN, fh, 0.3, M.plasterWhite);
    k.wallZ(x1, zN, y, zS - zN, fh, 0.3, M.plasterWhite);
    // salas ao longo do corredor (z 4..8)
    const doors = [];
    for (let i = 0; i < 6; i++) doors.push({ from: 6 + i * 9.33, to: 7.2 + i * 9.33, bottom: 0, top: 2.2 });
    k.wallX(x0, 4, y, x1 - x0, fh, 0.2, M.plasterWhite, doors);
    for (let i = 1; i < 6; i++) k.wallZ(x0 + i * 9.33, zN, y, 10, fh, 0.15, M.plasterWhite);
    // carteiras e lousa
    for (let i = 0; i < 6; i++) {
      const cx = x0 + 4.66 + i * 9.33;
      k.box(4, 1.2, 0.05, cx, y + 1.6, zN + 0.2, M.blackMetal, 0, false);
      for (let r = 0; r < 3; r++) for (let c = -1; c <= 1; c++) k.block(0.6, 0.75, 0.5, cx + c * 2, y, -2.5 + r * 1.9, M.wood);
    }
    // faixa cinza-azulada na altura da laje
    k.box(x1 - x0 + 0.4, 0.35, 0.1, 0, y + fh - 0.15, zN - 0.2, M.schoolBand, 0, false);
  }
  // lajes e escada interna (leste do corredor)
  k.slab(x0, x1, zN, zS, fh, 0.25, M.concrete, [[15.9, 21.3, 5.2, 8]]);
  k.stairs(V(21.2, 0, 6.6), V(-1, 0, 0), 2.6, 17, fh / 17, 0.3, M.concreteDark);
  k.block(x1 - x0 + 0.6, 0.35, zS - zN + 0.6, 0, 2 * fh, 1, M.concrete);
  // platibanda com o nome da escola (foto 5)
  k.block(x1 - x0, 1.1, 0.3, 0, 2 * fh + 0.35, zN, M.plasterWhite);
  k.sign(30, 1.0, 0, 2 * fh + 0.9, zN - 0.2, signMaterial(['EE   PROF.  BASÍLIO  BOSNIAC'], { w: 2048, h: 128, bg: '#f3f3f0', fg: '#2a62b4' }), Math.PI);
  // quadra coberta no pátio (fundo)
  k.floorDecal(24, 12, 18, 0.012, 15, M.courtGray);
  k.archRoof(26, 14, 3.5, 18, 4.5, 15, M.metal, 6.5);
  for (const x of [5, 31]) for (const z of [8.2, 21.8]) k.block(0.3, 4.6, 0.3, x, 0, z, M.steel);
  k.hoop(29, 3.05, 15, Math.PI);
  k.hoop(7, 3.05, 15, 0);
  // palmeiras atrás do muro (foto 5)
  for (const [x, z, h] of [[-26, -18, 6], [-12, -18.5, 7], [14, -18, 5.5], [24, -18.2, 6.5]]) k.palm(x, 0, z, h, x);
  k.tree(-18, 0, 16, 1.1, 3);
  k.points.escola = V(-10, 0.1, -12);
  return k;
}

// ---------------------------------------------------------------------------------------------
// FOTOS 7 e 8 — Igreja São Lucas: tijolo aparente com faixas e pilastras brancas, janelas altas,
// telhado cerâmico, torre sineira com aberturas e cruz, pórtico em arco com escadaria e grade verde.
// Nave ao longo de X; torre na ponta leste (+x), junto da Av. Inocêncio Seráfico.
// ---------------------------------------------------------------------------------------------
export function buildChurch(M: CityMats): Kit {
  const k = new Kit(M);
  const L = 30;
  const W = 16;
  const h = 7.5;
  k.block(L + 4, 0.8, W + 4, 0, -0.8, 0, M.concrete); // embasamento
  k.block(L, 0.1, W, 0, 0, 0, M.floorTile);
  const win = (n: number, len: number) => Array.from({ length: n }, (_, i) => ({ from: (len / n) * i + (len / n) / 2 - 0.7, to: (len / n) * i + (len / n) / 2 + 0.7, bottom: 2.0, top: 5.3 }));
  k.wallX(-L / 2, -W / 2, 0, L, h, 0.4, M.brick, win(6, L));
  k.wallX(-L / 2, W / 2, 0, L, h, 0.4, M.brick, [...win(6, L).slice(0, 5), { from: 26, to: 27.6, bottom: 0, top: 2.4 }]);
  k.wallZ(-L / 2, -W / 2, 0, W, h, 0.4, M.brick);
  k.wallZ(L / 2, -W / 2, 0, W, h, 0.4, M.brick, [{ from: W / 2 - 1.3, to: W / 2 + 1.3, bottom: 0, top: 4.2 }]);
  for (const sz of [-1, 1]) {
    for (let i = 0; i < 6; i++) {
      const wx = -L / 2 + (L / 6) * i + L / 12;
      k.box(1.4, 3.3, 0.06, wx, 3.65, (sz * W) / 2, M.darkGlass, 0, false);
      k.box(1.7, 0.18, 0.5, wx, 5.45, (sz * W) / 2 + sz * 0.05, M.plasterWhite, 0, false);
    }
    for (let x = -L / 2; x <= L / 2 + 0.01; x += 5) k.box(0.55, h, 0.6, x, h / 2, (sz * W) / 2, M.plasterWhite, 0, true);
    k.box(L + 0.6, 0.5, 0.6, 0, h - 0.25, (sz * W) / 2, M.plasterWhite, 0, false);
    k.box(L + 0.6, 0.8, 0.55, 0, 0.4, (sz * W) / 2, M.plasterWhite, 0, false);
  }
  // telhado de duas águas + oitões
  const pitch = Math.atan2(3.6, W / 2);
  const slant = Math.hypot(3.6, W / 2) + 0.6;
  for (const sz of [-1, 1]) {
    const r = k.box(L + 1.2, 0.25, slant, 0, h + 1.8, (sz * W) / 4, M.roofTile, 0, true);
    r.rotation.x = sz * pitch;
    r.updateMatrixWorld(true);
  }
  const gable = new Shape();
  gable.moveTo(-W / 2, 0);
  gable.lineTo(W / 2, 0);
  gable.lineTo(0, 3.6);
  gable.lineTo(-W / 2, 0);
  for (const sx of [-1, 1]) {
    const g = new ExtrudeGeometry(gable, { depth: 0.4, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    k.mesh(g, M.brick, sx * (L / 2) - 0.2, h, 0, true);
  }
  // rosácea no oitão leste
  k.mesh(new CylinderGeometry(1.0, 1.0, 0.1, 24), M.darkGlass, L / 2 + 0.25, h + 1.4, 0, false, 0, 0).rotation.set(0, 0, Math.PI / 2);
  k.mesh(new TorusGeometry(1.05, 0.12, 6, 24), M.plasterWhite, L / 2 + 0.3, h + 1.4, 0, false, Math.PI / 2);
  // pórtico em arco e escadaria
  k.block(0.5, 5, 0.6, L / 2 + 1.6, 0, -2.2, M.plasterWhite);
  k.block(0.5, 5, 0.6, L / 2 + 1.6, 0, 2.2, M.plasterWhite);
  k.mesh(new TorusGeometry(2.2, 0.28, 6, 16, Math.PI), M.plasterWhite, L / 2 + 1.6, 5, 0, false, Math.PI / 2);
  k.block(2.0, 0.3, 5.2, L / 2 + 1.2, 5.8, 0, M.roofTile);
  k.stairs(V(L / 2 + 2 + 1.2, -0.8, 0), V(-1, 0, 0), 5, 4, 0.2, 0.3, M.concrete);
  // torre sineira (canto nordeste)
  const tx = L / 2 - 3;
  const tz = -W / 2 - 3;
  k.block(6, 20, 6, tx, 0, tz, M.brick);
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) k.box(0.5, 21, 0.5, tx + dx, 10.5, tz + dz, M.plasterWhite, 0, false);
  for (const yb of [6, 11, 16]) k.box(6.4, 0.35, 6.4, tx, yb, tz, M.plasterWhite, 0, false);
  for (const [dx, dz, ry] of [[3.02, 0, Math.PI / 2], [-3.02, 0, -Math.PI / 2], [0, 3.02, 0], [0, -3.02, Math.PI]]) {
    for (const off of [-1.1, 1.1]) {
      const ox = ry === 0 || ry === Math.PI ? off : 0;
      const oz = ry === 0 || ry === Math.PI ? 0 : off;
      k.sign(0.9, 2.4, tx + dx + ox, 17.6, tz + dz + oz, M.darkGlass, ry);
    }
  }
  k.mesh(new ConeGeometry(4.4, 3.2, 4), M.roofTile, tx, 21.6, tz, false, Math.PI / 4);
  k.box(0.18, 2.4, 0.18, tx, 24.2, tz, M.plasterWhite, 0, false);
  k.box(1.2, 0.18, 0.18, tx, 24.7, tz, M.plasterWhite, 0, false);
  // interior: bancos e altar
  for (let i = 0; i < 8; i++) for (const sz of [-1, 1]) k.block(4.5, 0.85, 0.6, -6 + i * 2.6 - 3, 0.1, sz * 3.6, M.wood);
  k.block(5, 0.4, W - 1, -L / 2 + 3, 0.1, 0, M.wood);
  k.box(0.3, 3.2, 0.3, -L / 2 + 0.5, 3, 0, M.wood, 0, false);
  k.box(0.3, 0.3, 1.8, -L / 2 + 0.5, 3.8, 0, M.wood, 0, false);
  // grade verde da calçada (foto 8)
  k.railing(-L / 2 - 2, -W / 2 - 2, L / 2 - 6.5, -W / 2 - 2, -0.8, 1.8, M.greenSteel);
  k.railing(L / 2 + 0.5, -W / 2 - 2, L / 2 + 2, -W / 2 - 2, -0.8, 1.8, M.greenSteel);
  k.points.igreja = V(L / 2 + 6, -0.6, 0);
  return k;
}

// ---------------------------------------------------------------------------------------------
// SEDE DO TIME (centro do mapa). Estrutura completa; a logo e os uniformes aguardam o arquivo da
// logo (não enviado). Lote x [-22,22], z [-20,20]; entrada ao norte (z = -20).
// ---------------------------------------------------------------------------------------------
export function buildSede(M: CityMats, logo: MeshStandardMaterial | null): Kit {
  const k = new Kit(M);
  k.block(44, 0.3, 40, 0, -0.3, 0, M.concrete);
  const dark = M.concreteDark;
  // bloco administrativo (norte, z -20..-6) com 2 pavimentos
  const fh = 3.6;
  for (let f = 0; f < 2; f++) {
    const y = f * fh;
    k.wallX(-22, -20, y, 44, fh, 0.3, dark, f === 0 ? [{ from: 19, to: 25, bottom: 0, top: 3.0 }, { from: 4, to: 14, bottom: 1.0, top: 2.8 }, { from: 30, to: 40, bottom: 1.0, top: 2.8 }] : [{ from: 4, to: 40, bottom: 0.9, top: 3.0 }]);
    k.wallZ(-22, -20, y, 40, fh, 0.3, dark, [{ from: 16, to: 18, bottom: 0, top: 2.3 }]);
    k.wallZ(22, -20, y, 40, fh, 0.3, dark);
    k.wallX(-22, -6, y, 44, fh, 0.25, M.plasterWhite, [{ from: 6, to: 8, bottom: 0, top: 2.3 }, { from: 20, to: 24, bottom: 0, top: 2.6 }, { from: 34, to: 36, bottom: 0, top: 2.3 }]);
    // salas: recepção | administração | vestiário/banheiros | equipamentos/uniformes
    k.wallZ(-11, -20, y, 14, fh, 0.2, M.plasterWhite, [{ from: 10, to: 11.2, bottom: 0, top: 2.2 }]);
    k.wallZ(11, -20, y, 14, fh, 0.2, M.plasterWhite, [{ from: 10, to: 11.2, bottom: 0, top: 2.2 }]);
  }
  for (let x = -18; x <= 18; x += 2) k.box(1.9, 1.8, 0.05, x, fh + 1.95, -20, M.glass, 0, false);
  for (let x = -17; x <= -9; x += 2) k.box(1.9, 1.8, 0.05, x, 1.9, -20, M.glass, 0, false);
  for (let x = 9; x <= 17; x += 2) k.box(1.9, 1.8, 0.05, x, 1.9, -20, M.glass, 0, false);
  k.slab(-22, 22, -20, -6, fh, 0.25, M.concrete, [[-21.7, -19.3, -11.8, -6]]);
  k.block(44.6, 0.35, 14.6, 0, 2 * fh, -13, M.concrete);
  k.stairs(V(-20.5, 0, -7.4), V(0, 0, -1), 2.2, 14, fh / 14, 0.3, dark);
  // recepção (centro) com balcão; administração (oeste); vestiário (leste, piso 0)
  k.block(4, 1.1, 1.0, 0, 0, -10, M.wood);
  k.block(2.2, 0.75, 1.2, -16, 0, -14, M.wood);
  k.block(1.0, 0.75, 1.0, -14.5, 0, -14, M.blackMetal);
  // vestiário: armários, bancos, chuveiros (azulejo)
  for (let z = -19; z <= -8; z += 1.0) k.block(0.6, 2.0, 0.9, 21.3, 0, z, M.blueSteel);
  k.block(5, 0.45, 0.5, 16, 0, -12, M.wood);
  k.block(0.15, 2.4, 6, 13.2, 0, -16.5, M.wallTile);
  for (let z = -18.5; z <= -14.5; z += 2) k.box(0.1, 0.1, 0.4, 12.9, 2.2, z, M.steel, 0, false);
  // piso 1: convivência (sofás) e sala de uniformes (araras)
  for (const x of [-6, -2, 2]) k.block(2.4, 0.8, 0.9, x, fh, -10, M.blue);
  for (let x = 13; x <= 20; x += 1.6) k.box(0.05, 1.6, 4, x, fh + 1.6, -14, M.steel, 0, false);
  // ginásio (sul, z -6..20): quadra coberta oficial
  k.wallX(-22, 20, 0, 44, 8, 0.3, dark, [{ from: 19, to: 25, bottom: 0, top: 3.4 }]);
  k.wallZ(-22, -6, 0, 26, 8, 0.3, dark, [{ from: 10, to: 12, bottom: 0, top: 2.4 }]);
  k.wallZ(22, -6, 0, 26, 8, 0.3, dark, [{ from: 14, to: 16, bottom: 0, top: 2.4 }]);
  for (let z = -4; z <= 18; z += 3) for (const x of [-22.2, 22.2]) k.box(0.1, 1.2, 2.4, x, 6.3, z, M.glass, 0, false);
  k.floorDecal(36, 18, 0, 0.012, 7, M.courtBlue);
  k.archRoof(44.4, 26.4, 3.0, 0, 8, 7, M.metal, 5.5);
  k.goal(-17.6, 7, 0);
  k.goal(17.6, 7, Math.PI);
  for (let x = -14; x <= 14; x += 7) k.box(1.2, 0.15, 0.4, x, 10.4, 7, M.lampLight, 0, false);
  // fachada: painel da logo (aguardando arquivo) e letreiro
  const panel = logo ?? signMaterial(['LOGO DO TIME', '(aguardando arquivo)'], { w: 512, h: 512, bg: '#1d1f22', fg: '#e8a33d' });
  k.box(6.6, 6.6, 0.3, 0, 2 * fh + 3.6, -20.3, M.blackMetal, 0, false);
  k.sign(6, 6, 0, 2 * fh + 3.6, -20.5, panel, Math.PI);
  k.sign(14, 1.4, 0, 3.6 + 0.2, -20.25, signMaterial(['SEDE'], { w: 1024, h: 128, bg: '#1d1f22', fg: '#f2f2f2' }), Math.PI);
  k.points.sede = V(0, 0.1, -24);
  return k;
}
