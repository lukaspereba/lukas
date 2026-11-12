// Configurações, tabela de armas, itens e economia.
import { store } from './util.js';

export const PRESETS = {
  baixo: { scale: 0.6, shadows: 0, dist: 150, detail: 55, particles: 0.5, aa: false, tex: 256 },
  medio: { scale: 0.8, shadows: 1024, dist: 220, detail: 85, particles: 0.8, aa: false, tex: 256 },
  alto: { scale: 1.0, shadows: 2048, dist: 300, detail: 125, particles: 1, aa: true, tex: 512 },
};
const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const DEF = { preset: mobile ? 'medio' : 'alto', ...PRESETS[mobile ? 'medio' : 'alto'], fpsCap: 60, sens: 1, adsSens: 0.7, invertY: false, fov: 75, volume: 0.8, music: 0.5, camera: 'fps', autoFire: false, gyro: false, diag: false, dynRes: true, aimAssist: true, bots: 23, difficulty: 'normal', vibrate: true, leftHanded: false };
export const S = Object.assign({}, DEF, store.get('settings', {}));
export function saveSettings() { store.set('settings', S); }
export function applyPreset(name) { if (PRESETS[name]) Object.assign(S, PRESETS[name]); S.preset = name; saveSettings(); }
export const isMobile = mobile;

export const AMMO = { '9mm': { n: '9 mm', max: 240, col: '#e8c860' }, '556': { n: '5,56', max: 240, col: '#7fd48a' }, '762': { n: '7,62', max: 200, col: '#e08a4a' }, '45': { n: '.45', max: 120, col: '#c9a0e8' }, '12g': { n: 'Cal. 12', max: 48, col: '#e85a4a' }, '308': { n: '.308', max: 60, col: '#6ab8e8' }, '50': { n: '.50', max: 25, col: '#f2f2f2' } };
export const RARITY = [{ n: 'Comum', c: '#b8bcc0' }, { n: 'Incomum', c: '#5fd47a' }, { n: 'Raro', c: '#4aa8f0' }, { n: 'Épico', c: '#b86af0' }, { n: 'Lendário', c: '#f0b030' }];

// dmg, rpm, mag, reload(s), range[início,fim da queda], minMul, recoil[vertical,horizontal] (graus/tiro), spread[quadril,mira] (graus), ads(s), move(mult), hs(mult cabeça)
const W = (id, name, cls, ammo, dmg, rpm, mag, reload, range, minMul, recoil, spread, ads, move, mode, hs, optic, shape, snd, extra = {}) => ({ id, name, cls, ammo, dmg, rpm, mag, reload, range, minMul, recoil, spread, ads, move, mode, hs, optic, shape, snd, pellets: 1, ...extra });
export const WEAPONS = [
  W('guara', 'Guará AR-5', 'ar', '556', 24, 750, 30, 2.1, [38, 95], 0.62, [0.52, 0.2], [2.4, 0.22], 0.22, 0.94, 'auto', 1.5, 'iron', { len: 0.2, h: 0.07, barrel: 0.3, hand: 0.24, handR: 0.03, stock: 'tele', mag: 'stanag', body: 0x25272b, fur: 0x2e3136, carry: false, sightF: true }, { f: 180, n: 0.9, t: 0.16, p: 1.0 }),
  W('onca', 'Onça 7.62', 'ar', '762', 33, 560, 30, 2.5, [34, 85], 0.66, [0.82, 0.3], [2.8, 0.3], 0.25, 0.92, 'auto', 1.5, 'iron', { len: 0.22, h: 0.075, barrel: 0.34, hand: 0.2, handR: 0.034, stock: 'wood', mag: 'banana', body: 0x2a2a2c, fur: 0x8a5a30, gasTube: true, sightF: true }, { f: 130, n: 1.0, t: 0.2, p: 0.8 }),
  W('carcara', 'Carcará M16', 'ar', '556', 30, 880, 30, 2.3, [48, 120], 0.7, [0.42, 0.14], [2.2, 0.16], 0.26, 0.93, 'burst', 1.6, 'iron', { len: 0.21, h: 0.07, barrel: 0.46, hand: 0.3, handR: 0.036, stock: 'fixed', mag: 'stanag', body: 0x222426, fur: 0x1c1d20, carry: true, sightF: true }, { f: 190, n: 0.85, t: 0.15, p: 1.05 }),
  W('jandaia', 'Jandaia H-17', 'ar', '762', 38, 480, 20, 2.6, [45, 110], 0.7, [0.95, 0.26], [2.9, 0.2], 0.28, 0.9, 'auto', 1.55, 'iron', { len: 0.24, h: 0.085, barrel: 0.36, hand: 0.26, handR: 0.04, stock: 'fold', mag: 'box20', body: 0xa8946a, fur: 0x8a7a55, rail: true }, { f: 115, n: 1.05, t: 0.24, p: 0.72 }),
  W('tatu', 'Tatu BP-9', 'ar', '556', 25, 820, 30, 2.4, [36, 90], 0.6, [0.5, 0.28], [2.0, 0.24], 0.2, 0.96, 'auto', 1.5, 'reddot', { len: 0.34, h: 0.09, barrel: 0.2, hand: 0.12, handR: 0.04, stock: 'bull', mag: 'stanag', body: 0x4a5a3a, fur: 0x3a4830, rail: true }, { f: 200, n: 0.8, t: 0.13, p: 1.1 }),
  W('sucuri', 'Sucuri AX', 'ar', '556', 22, 680, 35, 2.0, [42, 105], 0.64, [0.34, 0.12], [2.1, 0.18], 0.21, 0.95, 'auto', 1.5, 'holo', { len: 0.22, h: 0.075, barrel: 0.3, hand: 0.28, handR: 0.036, stock: 'skel', mag: 'stanag', body: 0x5a5e64, fur: 0x44484e, rail: true, brake: true }, { f: 170, n: 0.75, t: 0.15, p: 1.15 }),
  W('vespa', 'Vespa 9', 'smg', '9mm', 19, 900, 30, 1.8, [16, 42], 0.55, [0.36, 0.2], [1.6, 0.4], 0.16, 1.0, 'auto', 1.4, 'iron', { len: 0.2, h: 0.065, barrel: 0.12, hand: 0.14, handR: 0.038, stock: 'tele', mag: 'curve9', body: 0x232528, fur: 0x2c2e32, sightF: true }, { f: 260, n: 0.6, t: 0.1, p: 1.3 }),
  W('marimbondo', 'Marimbondo', 'smg', '9mm', 16, 1100, 32, 1.7, [12, 34], 0.5, [0.42, 0.32], [1.9, 0.6], 0.14, 1.02, 'auto', 1.35, 'iron', { len: 0.2, h: 0.085, barrel: 0.08, hand: 0, handR: 0.03, stock: 'none', mag: 'grip', body: 0x1f2022, fur: 0x1f2022 }, { f: 300, n: 0.55, t: 0.08, p: 1.5 }),
  W('pardal', 'Pardal PDW', 'smg', '45', 25, 650, 25, 2.0, [18, 46], 0.58, [0.5, 0.18], [1.7, 0.36], 0.17, 0.99, 'auto', 1.4, 'reddot', { len: 0.24, h: 0.1, barrel: 0.1, hand: 0.1, handR: 0.04, stock: 'fold', mag: 'straight', body: 0x3a3d42, fur: 0x2a2c30, rail: true }, { f: 210, n: 0.7, t: 0.12, p: 1.0 }),
  W('beijaflor', 'Beija-Flor P50', 'smg', '9mm', 17, 950, 50, 2.3, [15, 40], 0.52, [0.3, 0.22], [1.5, 0.45], 0.15, 1.0, 'auto', 1.35, 'reddot', { len: 0.36, h: 0.11, barrel: 0.06, hand: 0, handR: 0.03, stock: 'bull', mag: 'top', body: 0x2a2c2f, fur: 0x4a4436, rail: true }, { f: 280, n: 0.5, t: 0.09, p: 1.4 }),
  W('harpia', 'Harpia .308', 'sniper', '308', 62, 220, 10, 2.8, [70, 180], 0.75, [1.5, 0.3], [4.5, 0.05], 0.34, 0.88, 'semi', 2.0, 'x3', { len: 0.26, h: 0.08, barrel: 0.5, hand: 0.3, handR: 0.036, stock: 'fixed', mag: 'box20', body: 0x2a2c2f, fur: 0x3a3d42, rail: true, bipod: true }, { f: 110, n: 1.1, t: 0.3, p: 0.8 }),
  W('gaviao', 'Gavião Bolt', 'sniper', '308', 105, 48, 5, 3.2, [90, 240], 0.8, [3.2, 0.4], [6, 0.02], 0.42, 0.86, 'bolt', 2.2, 'x8', { len: 0.24, h: 0.07, barrel: 0.6, hand: 0.34, handR: 0.034, stock: 'wood', mag: 'none', body: 0x2f2f31, fur: 0x6a4a2a, bolt: true }, { f: 90, n: 1.2, t: 0.42, p: 0.7 }),
  W('urutau', 'Urutau .50', 'sniper', '50', 160, 34, 5, 3.8, [120, 300], 0.85, [4.6, 0.5], [7, 0.02], 0.5, 0.8, 'bolt', 2.0, 'x8', { len: 0.3, h: 0.09, barrel: 0.74, hand: 0.2, handR: 0.04, stock: 'skel', mag: 'box20', body: 0x4a4a40, fur: 0x38382f, bolt: true, bipod: true, brake: true, rail: true }, { f: 70, n: 1.4, t: 0.55, p: 0.55 }),
  W('jararaca', 'Jararaca 12', 'shotgun', '12g', 14, 70, 6, 0.55, [8, 22], 0.3, [2.6, 0.5], [4.2, 3.2], 0.24, 0.94, 'pump', 1.2, 'iron', { len: 0.2, h: 0.075, barrel: 0.46, hand: 0.2, handR: 0.045, stock: 'wood', mag: 'tube', body: 0x2a2a2c, fur: 0x7a4a26, pump: true }, { f: 95, n: 1.3, t: 0.3, p: 0.6 }, { pellets: 8, shellReload: true }),
  W('cascavel', 'Cascavel Auto', 'shotgun', '12g', 11, 220, 8, 2.6, [7, 20], 0.3, [2.0, 0.6], [4.8, 3.6], 0.24, 0.93, 'semi', 1.2, 'iron', { len: 0.24, h: 0.08, barrel: 0.36, hand: 0.24, handR: 0.045, stock: 'fixed', mag: 'box12', body: 0x26282b, fur: 0x26282b, rail: true }, { f: 105, n: 1.2, t: 0.26, p: 0.7 }, { pellets: 8 }),
  W('bufalo', 'Búfalo MG', 'lmg', '762', 32, 650, 100, 5.4, [45, 115], 0.7, [0.6, 0.3], [3.6, 0.36], 0.4, 0.82, 'auto', 1.4, 'iron', { len: 0.3, h: 0.1, barrel: 0.5, hand: 0.2, handR: 0.04, stock: 'fixed', mag: 'belt', body: 0x2a2c2e, fur: 0x3a3a34, bipod: true, carry: true, sightF: true }, { f: 120, n: 1.1, t: 0.22, p: 0.75 }),
  W('anta', 'Anta LMG', 'lmg', '556', 25, 800, 75, 4.2, [40, 100], 0.65, [0.48, 0.26], [3.2, 0.32], 0.34, 0.86, 'auto', 1.4, 'holo', { len: 0.26, h: 0.085, barrel: 0.4, hand: 0.26, handR: 0.04, stock: 'skel', mag: 'drum', body: 0x3a3d40, fur: 0x55584e, bipod: true, rail: true }, { f: 160, n: 0.9, t: 0.17, p: 0.95 }),
  W('lambari', 'Lambari 9', 'pistol', '9mm', 22, 400, 15, 1.4, [14, 36], 0.55, [0.9, 0.25], [1.4, 0.5], 0.12, 1.04, 'semi', 1.5, 'iron', { pistol: 1, len: 0.19, body: 0x25272a, fur: 0x1a1b1d }, { f: 320, n: 0.5, t: 0.09, p: 1.5 }),
  W('piranha', 'Piranha .45', 'pistol', '45', 34, 300, 8, 1.6, [14, 38], 0.6, [1.5, 0.3], [1.5, 0.5], 0.13, 1.03, 'semi', 1.5, 'iron', { pistol: 1, len: 0.22, body: 0x8f9296, fur: 0x4a3a2a }, { f: 240, n: 0.7, t: 0.12, p: 1.1 }),
  W('surubim', 'Surubim Magnum', 'pistol', '45', 62, 150, 6, 2.6, [20, 52], 0.65, [3.4, 0.4], [1.8, 0.35], 0.16, 1.02, 'semi', 1.8, 'iron', { pistol: 2, len: 0.26, body: 0xb8bcc0, fur: 0x5a3a22 }, { f: 150, n: 1.0, t: 0.22, p: 0.8 }),
];
export const WBY = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));
WEAPONS.forEach((w, i) => { w.rarity = { ar: 1, smg: 1, sniper: 2, shotgun: 1, lmg: 2, pistol: 0 }[w.cls]; if (['urutau', 'sucuri', 'bufalo'].includes(w.id)) w.rarity = 3; w.price = 600 + w.rarity * 500; });
export const MELEE = { faca: { id: 'faca', name: 'Faca Tática', dmg: 70, range: 2.1, rate: 0.5 }, punhos: { id: 'punhos', name: 'Punhos', dmg: 28, range: 1.8, rate: 0.42 } };
export const CLS = { ar: 'Fuzil de assalto', smg: 'Submetralhadora', sniper: 'Rifle de precisão', shotgun: 'Escopeta', lmg: 'Metralhadora leve', pistol: 'Pistola' };
export const OPTICS = { iron: { n: 'Mira de ferro', zoom: 1.25 }, reddot: { n: 'Red Dot', zoom: 1.35 }, holo: { n: 'Holográfica', zoom: 1.5 }, x3: { n: 'Mira ampliada 3x', zoom: 3 }, x8: { n: 'Mira de precisão 8x', zoom: 8 } };

// Itens de inventário (não-armas)
export const ITEMS = {
  cash: { n: 'Dinheiro', d: 'Use nas lojas (Buy Stations).', icon: '$', r: 0 },
  plate: { n: 'Placa de blindagem', d: 'Restaura 50 de colete. Máx. 3 equipadas.', icon: '▰', r: 1, max: 5, price: 400 },
  frag: { n: 'Granada de fragmentação', d: 'Explode após 3,2 s. Dano em área.', icon: '✸', r: 1, max: 2, slot: 'lethal', price: 300 },
  smoke: { n: 'Granada de fumaça', d: 'Cortina de fumaça por 14 s.', icon: '☁', r: 0, max: 2, slot: 'tactical', price: 200 },
  stun: { n: 'Granada de atordoamento', d: 'Cega e desacelera quem estiver por perto.', icon: '✺', r: 1, max: 2, slot: 'tactical', price: 250 },
  decoy: { n: 'Granada de distração', d: 'Simula tiros e atrai os bots.', icon: '♪', r: 0, max: 2, slot: 'tactical', price: 150 },
  uav: { n: 'UAV', d: 'Revela inimigos no minimapa por 30 s.', icon: '✈', r: 3, max: 1, slot: 'streak', price: 1500 },
  drone: { n: 'Drone de reconhecimento', d: 'Drone controlável com câmera. Marca inimigos.', icon: '⌖', r: 2, max: 1, slot: 'field', price: 1200 },
  ammobox: { n: 'Caixa de munição', d: 'Reabastece munição e granadas do esquadrão.', icon: '▣', r: 1, max: 1, slot: 'field', price: 600 },
  gasmask: { n: 'Máscara de gás', d: 'Protege do gás por um tempo.', icon: '☣', r: 2, max: 1, price: 800 },
  revive: { n: 'Kit de autorreanimação', d: 'Levanta sozinho ao ser derrubado.', icon: '✚', r: 3, max: 1, price: 1500 },
  reddot: { n: 'Mira Red Dot', d: 'Acessório de mira.', icon: '◉', r: 1, optic: 'reddot', price: 500 },
  holo: { n: 'Mira Holográfica', d: 'Acessório de mira.', icon: '◎', r: 1, optic: 'holo', price: 600 },
  x3: { n: 'Mira ampliada 3x', d: 'Acessório de mira.', icon: '⊕', r: 2, optic: 'x3', price: 800 },
  x8: { n: 'Mira de precisão 8x', d: 'Acessório de mira.', icon: '⊗', r: 3, optic: 'x8', price: 1200 },
  faca: { n: 'Faca Tática', d: 'Corpo a corpo letal.', icon: '🗡', r: 1, price: 250 },
};
export const SHOP = [['ammo', 'Munição (recarga completa)', 300], ['plate', 'Placa de blindagem', 400], ['plates3', 'Pacote com 3 placas', 1000], ['frag', 'Granada de fragmentação', 300], ['smoke', 'Granada de fumaça', 200], ['stun', 'Granada de atordoamento', 250], ['decoy', 'Granada de distração', 150], ['uav', 'UAV', 1500], ['drone', 'Drone de reconhecimento', 1200], ['ammobox', 'Caixa de munição', 600], ['gasmask', 'Máscara de gás', 800], ['revive', 'Kit de autorreanimação', 1500], ['faca', 'Faca Tática', 250], ['loadout', 'Loadout do Arsenal', 3000], ['buyback', 'Recompra de aliado', 1500]];

export const CHARS = [
  { id: 'lukas', name: 'Lukas', tag: 'DONO • DEV', skin: 0xb57a52, hair: 'curlyFade', hairCol: 0x1a1512, shirt: 0xc6c9cc, shirtKind: 'tee', trim: 0x2e3136, pants: 0x18191b, pantsKind: 'short', shoes: 0xe8e8e8, h: 1.0, earring: true },
  { id: 'bahia', name: 'Bahia', tag: 'TANQUE', skin: 0x7a5236, hair: 'short', hairCol: 0x14110f, shirt: 0x17181a, shirtKind: 'polo', trim: 0xe8e8e8, pants: 0xcfc6b0, pantsKind: 'short', shoes: null, h: 1.03, build: 1.1 },
  { id: 'kaique', name: 'Kaique', tag: 'ASSALTO', skin: 0x9a6238, hair: 'curlyTop', hairCol: 0x241712, shirt: 0x15171b, shirtKind: 'jersey', trim: 0xd9a520, pants: 0x15171b, pantsKind: 'short', shoes: 0x2a2c30, h: 0.98 },
  { id: 'mosquitao', name: 'Mosquitão', tag: 'BATEDOR', skin: 0xa8744e, hair: 'afroFringe', hairCol: 0x1c1512, shirt: 0x1f2c3a, shirtKind: 'sweater', trim: 0x1a2531, pants: 0x23262b, pantsKind: 'long', shoes: 0x3a3d42, h: 1.02, build: 0.92, mustache: true },
];
export const PETS = [{ id: 'belo', name: 'Belo', kind: 'Gato cinza' }, { id: 'louro', name: 'Louro', kind: 'Periquito' }, { id: 'nina', name: 'Nina', kind: 'Cachorrinha salsicha' }];
export const OUTFITS = [{ id: 'padrao', n: 'Roupa da foto', price: 0 }, { id: 'time', n: 'Uniforme do Time', price: 0, shirt: 0x15171b, trim: 0xd9a520, pants: 0x15171b, shirtKind: 'jersey', pantsKind: 'short', shoes: 0xd9a520 }, { id: 'tatico', n: 'Tático Urbano', price: 1500, shirt: 0x4a4f44, trim: 0x2a2d26, pants: 0x3a3d34, shirtKind: 'vest', pantsKind: 'long', shoes: 0x1a1b1d }, { id: 'quebrada', n: 'Estilo Quebrada', price: 2500, shirt: 0xd9402a, trim: 0xffffff, pants: 0x2a4a8a, shirtKind: 'tee', pantsKind: 'long', shoes: 0xffffff }];
export const DIFF = { facil: { acc: 0.42, react: 1.0, dmg: 0.5 }, normal: { acc: 0.68, react: 0.7, dmg: 0.7 }, dificil: { acc: 1.0, react: 0.3, dmg: 1.0 } };
