// Materiais da cidade (texturas geradas por tools/textures/gen_city.py) e placas com texto em canvas.

import {
  CanvasTexture,
  Color,
  DoubleSide,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';

const loader = new TextureLoader();

async function tex(path: string, color: boolean, aniso: number, repeat = true): Promise<Texture> {
  const t = await loader.loadAsync(path);
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping;
  t.anisotropy = aniso;
  if (color) t.colorSpace = SRGBColorSpace;
  return t;
}

export type CityMats = Awaited<ReturnType<typeof loadCityMaterials>>;

export async function loadCityMaterials(base: string, aniso: number) {
  const c = `${base}city/`;
  const w = base;
  const [
    plaster, plasterN, brickC, brickN, rawBrick, schoolC, schoolN, mallPanel, asphalt, sidewalk, courtGray, courtBlue,
    roofTile, metalC, metalN, shutter, chain, cobogo, floorTile, wallTile, turf, concrete, concreteN, grass,
  ] = await Promise.all([
    tex(`${c}plaster_c.jpg`, true, aniso), tex(`${c}plaster_n.jpg`, false, aniso),
    tex(`${c}brick_c.jpg`, true, aniso), tex(`${c}brick_n.jpg`, false, aniso), tex(`${c}brick_raw_c.jpg`, true, aniso),
    tex(`${c}school_wall_c.jpg`, true, aniso), tex(`${c}school_wall_n.jpg`, false, aniso), tex(`${c}mall_panel_c.jpg`, true, aniso),
    tex(`${c}asphalt_c.jpg`, true, aniso), tex(`${c}sidewalk_c.jpg`, true, aniso),
    tex(`${c}court_gray.jpg`, true, aniso, false), tex(`${c}court_blue.jpg`, true, aniso, false),
    tex(`${c}roof_tile_c.jpg`, true, aniso), tex(`${c}metal_corr_c.jpg`, true, aniso), tex(`${c}metal_corr_n.jpg`, false, aniso),
    tex(`${c}shutter_c.jpg`, true, aniso), tex(`${c}chainlink.png`, true, aniso), tex(`${c}cobogo.png`, true, aniso),
    tex(`${c}floor_tile_c.jpg`, true, aniso), tex(`${c}wall_tile_c.jpg`, true, aniso), tex(`${c}turf_c.jpg`, true, aniso),
    tex(`${w}concrete_c.jpg`, true, aniso), tex(`${w}concrete_n.jpg`, false, aniso), tex(`${w}grass_c.jpg`, true, aniso),
  ]);
  const std = (name: string, o: ConstructorParameters<typeof MeshStandardMaterial>[0]) => {
    const m = new MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
    m.name = name;
    return m;
  };
  const tint = (m: MeshStandardMaterial, name: string, col: number) => {
    const k = m.clone();
    k.name = name;
    k.color = new Color(col);
    return k;
  };
  const plasterWhite = std('Reboco', { map: plaster, normalMap: plasterN, color: new Color(0.86, 0.86, 0.84) });
  // paleta das casas vista nas fotos aéreas (rosa, pêssego, amarelo, azul claro, salmão, cinza, terracota)
  const houseColors = [0xd99a9a, 0xe8b48f, 0xe6cf86, 0x9fc0d8, 0xd98a6c, 0xb9b6ae, 0xc97a52, 0xe9e4d6, 0xa7c49b];
  // um único material para todas as casas: a cor vem por vértice (mescla em poucos draw calls)
  const plasterTint = std('RebocoCasas', { map: plaster, normalMap: plasterN, vertexColors: true });
  const chainMat = std('Alambrado', { map: chain, alphaTest: 0.5, side: DoubleSide, metalness: 0.6, roughness: 0.5 });
  const cobogoMat = std('Cobogo', { map: cobogo, alphaTest: 0.5, side: DoubleSide });
  return {
    plasterWhite,
    plasterTint,
    houseColors,
    rawBrick: std('TijoloBaiano', { map: rawBrick, normalMap: brickN }),
    brick: std('Tijolo', { map: brickC, normalMap: brickN }),
    schoolWall: std('MuroEscola', { map: schoolC, normalMap: schoolN }),
    schoolBand: tint(plasterWhite, 'FaixaEscola', 0x9eb4c4),
    mallWhite: tint(plasterWhite, 'ShoppingBranco', 0xeef0f0),
    mallPanel: std('PainelShopping', { map: mallPanel, roughness: 0.7 }),
    mallGray: tint(plasterWhite, 'ShoppingCinza', 0x9aa0a6),
    asphalt: std('Asfalto', { map: asphalt, roughness: 0.95 }),
    sidewalk: std('Calcada', { map: sidewalk }),
    curb: std('Guia', { map: concrete, color: new Color(0.7, 0.7, 0.68) }),
    concrete: std('Concreto', { map: concrete, normalMap: concreteN, color: new Color(0.6, 0.59, 0.56) }),
    concreteDark: std('ConcretoEscuro', { map: concrete, normalMap: concreteN, color: new Color(0.42, 0.42, 0.4) }),
    courtGray: std('QuadraCinza', { map: courtGray, roughness: 0.6 }),
    courtBlue: std('QuadraAzul', { map: courtBlue, roughness: 0.55 }),
    roofTile: std('Telha', { map: roofTile }),
    metal: std('TelhaMetal', { map: metalC, normalMap: metalN, metalness: 0.4, roughness: 0.55, side: DoubleSide }),
    steel: std('Aco', { color: new Color(0.32, 0.34, 0.36), metalness: 0.7, roughness: 0.45 }),
    blueSteel: std('AcoAzul', { color: new Color(0.12, 0.28, 0.55), metalness: 0.5, roughness: 0.5 }),
    greenSteel: std('AcoVerde', { color: new Color(0.13, 0.42, 0.36), metalness: 0.5, roughness: 0.5 }),
    shutter: std('PortaDeAco', { map: shutter, metalness: 0.5, roughness: 0.55 }),
    chain: chainMat,
    cobogo: cobogoMat,
    floorTile: std('Porcelanato', { map: floorTile, roughness: 0.4 }),
    wallTile: std('Azulejo', { map: wallTile, roughness: 0.3 }),
    turf: std('GramaSintetica', { map: turf }),
    grass: std('Grama', { map: grass, color: new Color(0.85, 0.95, 0.8) }),
    glass: std('Vidro', { color: new Color(0.55, 0.7, 0.75), transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.2, depthWrite: false }),
    darkGlass: std('VidroEscuro', { color: new Color(0.08, 0.1, 0.12), roughness: 0.15, metalness: 0.3 }),
    wood: std('Madeira', { color: new Color(0.45, 0.3, 0.18), roughness: 0.75 }),
    blackMetal: std('MetalPreto', { color: new Color(0.06, 0.06, 0.07), metalness: 0.6, roughness: 0.5 }),
    orange: std('Laranja', { color: new Color(0.9, 0.38, 0.12), roughness: 0.6 }),
    yellow: std('Amarelo', { color: new Color(0.95, 0.8, 0.15), roughness: 0.6 }),
    blue: std('AzulPintura', { color: new Color(0.12, 0.38, 0.75), roughness: 0.7 }),
    waterTank: std('CaixaDagua', { color: new Color(0.16, 0.4, 0.7), roughness: 0.5 }),
    water: std('Agua', { color: new Color(0.35, 0.6, 0.7), transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1, depthWrite: false }),
    poolFloor: std('FundoPiscina', { color: new Color(0.93, 0.82, 0.25), roughness: 0.6 }),
    leaves: std('Folhagem', { color: new Color(0.18, 0.32, 0.12), roughness: 0.85 }),
    trunk: std('Tronco', { color: new Color(0.3, 0.22, 0.15), roughness: 0.95 }),
    palm: std('Palmeira', { color: new Color(0.25, 0.4, 0.15), roughness: 0.8, side: DoubleSide }),
    lampLight: std('Lampada', { color: new Color(1, 0.95, 0.8), emissive: new Color(1, 0.92, 0.75), emissiveIntensity: 0.8 }),
    markingWhite: std('FaixaBranca', { color: new Color(0.92, 0.92, 0.88), roughness: 0.6 }),
    markingYellow: std('FaixaAmarela', { color: new Color(0.95, 0.75, 0.15), roughness: 0.6 }),
    rubble: std('Entulho', { map: concrete, color: new Color(0.5, 0.48, 0.45) }),
  };
}

/** Placa com texto (canvas). Retorna material com a textura gerada. */
export function signMaterial(lines: string[], opts: { w?: number; h?: number; bg?: string; fg?: string; font?: string; align?: CanvasTextAlign; swoosh?: boolean } = {}): MeshStandardMaterial {
  const W = opts.w ?? 1024;
  const H = opts.h ?? 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  if (opts.bg !== 'transparent') {
    g.fillStyle = opts.bg ?? '#f2f2ee';
    g.fillRect(0, 0, W, H);
  }
  if (opts.swoosh) {
    // traço curvo original (não reproduz o logotipo real do shopping)
    const cols = ['#d9534f', '#e98b5d', '#7fbf7f', '#8fc7d9'];
    cols.forEach((c, i) => {
      g.strokeStyle = c;
      g.lineWidth = 10 - i * 1.5;
      g.beginPath();
      g.moveTo(W * 0.08, H * (0.42 + i * 0.05));
      g.quadraticCurveTo(W * 0.25, H * (0.05 + i * 0.03), W * 0.95, H * (0.18 + i * 0.07));
      g.stroke();
    });
  }
  g.fillStyle = opts.fg ?? '#222';
  g.textAlign = opts.align ?? 'center';
  g.textBaseline = 'middle';
  const n = lines.length;
  lines.forEach((line, i) => {
    const size = Math.floor((H / (n + 0.6)) * 0.78);
    g.font = opts.font ?? `600 ${size}px "Segoe UI", Roboto, Arial, sans-serif`;
    const x = g.textAlign === 'center' ? W / 2 : g.textAlign === 'right' ? W - 24 : 24;
    g.fillText(line, x, (H / (n + 0.6)) * (i + 0.8));
  });
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  const m = new MeshStandardMaterial({ map: t, roughness: 0.6, transparent: opts.bg === 'transparent', alphaTest: opts.bg === 'transparent' ? 0.3 : 0 });
  m.name = `Placa:${lines.join(' ')}`;
  return m;
}

/** Portão pintado da escola: crianças de mãos dadas e "Proibido estacionar dia e noite" (foto 6). */
export function schoolGateMaterial(): MeshStandardMaterial {
  const W = 512;
  const H = 256;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#7fb3e0';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#1f4f9a';
  g.lineWidth = 5;
  for (let y = 0; y < H; y += 64) g.strokeRect(4, y + 4, W - 8, 60);
  // três figuras de mãos dadas
  g.fillStyle = '#1f4f9a';
  for (let k = 0; k < 3; k++) {
    const x = 170 + k * 60;
    g.beginPath();
    g.arc(x, 50, 13, 0, Math.PI * 2);
    g.fill();
    g.fillRect(x - 9, 64, 18, 40);
    g.fillRect(x - 9, 104, 7, 30);
    g.fillRect(x + 2, 104, 7, 30);
    g.fillRect(x - 32, 70, 64, 6);
  }
  // placa de proibido estacionar
  g.lineWidth = 7;
  g.strokeStyle = '#c62828';
  g.beginPath();
  g.arc(256, 168, 26, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.moveTo(238, 150);
  g.lineTo(274, 186);
  g.stroke();
  g.fillStyle = '#111';
  g.font = 'italic 22px "Comic Sans MS", "Segoe Print", cursive';
  g.textAlign = 'center';
  g.fillText('Proibido estacionar dia e noite', 256, 228);
  const t = new CanvasTexture(cv);
  t.colorSpace = SRGBColorSpace;
  const m = new MeshStandardMaterial({ map: t, roughness: 0.7 });
  m.name = 'PortaoEscola';
  return m;
}
