// Texturas procedurais em canvas, empacotadas em um único DataArrayTexture.
// Um único material para todo o cenário = poucas draw calls.
import * as THREE from 'three';
import { mulberry, pfbm, clamp } from './util.js';

export const L = {
  ASPHALT: 0, ASPHALT_LINE: 1, CROSSWALK: 2, SIDEWALK: 3, GRASS: 4, DIRT: 5, BRICK: 6, PLASTER: 7, CONCRETE: 8,
  ROOF_TILE: 9, METAL_ROOF: 10, FLOOR_TILE: 11, WOOD: 12, WINDOW: 13, COBOGO: 14, FENCE: 15, SHUTTER: 16, PLAIN: 17,
  MURAL: 18, CHURCH_BRICK: 19, ORANGE_PANEL: 20, CLADDING: 21, WATER: 22, TURF: 23, FOLIAGE: 24, BARK: 25, WALL_TILE: 26, COURT: 27,
};
export const LAYER_COUNT = 28;
// Tamanho em metros de uma repetição da textura.
export const TILE = [4, 4, 4, 4, 4, 4, 2, 3, 3, 2, 2, 2, 2, 2, 1, 2, 3, 1, 4, 2, 4, 4, 4, 4, 2, 1, 1.5, 4];
export const CUTOUT = new Set([L.COBOGO, L.FENCE, L.FOLIAGE]);

function noiseFill(ctx, S, base, amp, seed, freq = 8, oct = 4) {
  const img = ctx.getImageData(0, 0, S, S), d = img.data;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = pfbm((x / S) * freq, (y / S) * freq, freq, oct, seed) - 0.5;
    const g = (Math.random() - 0.5) * amp * 0.35;
    const i = (y * S + x) * 4;
    d[i] = clamp(base[0] + n * amp * 2 + g, 0, 255); d[i + 1] = clamp(base[1] + n * amp * 2 + g, 0, 255); d[i + 2] = clamp(base[2] + n * amp * 2 + g, 0, 255); d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}
function speckle(ctx, S, n, col, r, rng) { ctx.fillStyle = col; for (let i = 0; i < n; i++) { ctx.globalAlpha = 0.15 + rng() * 0.5; ctx.fillRect(rng() * S, rng() * S, r * (0.5 + rng()), r * (0.5 + rng())); } ctx.globalAlpha = 1; }

const painters = {
  [L.ASPHALT](c, S, r) { noiseFill(c, S, [62, 63, 66], 16, 3, 16, 5); speckle(c, S, S * 6, '#8a8a8a', S / 256, r); speckle(c, S, S * 3, '#262626', S / 200, r);
    c.strokeStyle = 'rgba(25,25,25,.55)'; c.lineWidth = S / 256; for (let i = 0; i < 5; i++) { c.beginPath(); let x = r() * S, y = r() * S; c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * S * 0.2; y += (r() - 0.5) * S * 0.2; c.lineTo(x, y); } c.stroke(); } },
  [L.ASPHALT_LINE](c, S, r) { painters[L.ASPHALT](c, S, r); c.fillStyle = 'rgba(214,170,40,.9)'; const w = S * 0.03; for (let k = 0; k < 2; k++) c.fillRect(S - w, k * S * 0.5 + S * 0.08, w, S * 0.3); c.fillStyle = 'rgba(225,225,220,.7)'; c.fillRect(S * 0.06, 0, S * 0.02, S); },
  [L.CROSSWALK](c, S, r) { painters[L.ASPHALT](c, S, r); c.fillStyle = 'rgba(232,232,226,.88)'; for (let k = 0; k < 4; k++) c.fillRect(k * S / 4 + S * 0.045, S * 0.1, S * 0.16, S * 0.8); speckle(c, S, S * 2, '#444', S / 128, r); },
  [L.SIDEWALK](c, S, r) { noiseFill(c, S, [150, 148, 142], 14, 5, 12, 4); c.strokeStyle = 'rgba(70,70,66,.55)'; c.lineWidth = S / 180; const n = 4; for (let i = 0; i <= n; i++) { c.beginPath(); c.moveTo(i * S / n, 0); c.lineTo(i * S / n, S); c.stroke(); c.beginPath(); c.moveTo(0, i * S / n); c.lineTo(S, i * S / n); c.stroke(); } speckle(c, S, S * 2, '#5c5a55', S / 100, r); },
  [L.GRASS](c, S, r) { noiseFill(c, S, [78, 112, 52], 26, 7, 10, 5); c.lineWidth = S / 256; for (let i = 0; i < S * 14; i++) { const x = r() * S, y = r() * S, g = 90 + r() * 70; c.strokeStyle = `rgba(${40 + r() * 50},${g},${30 + r() * 30},.55)`; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * S * 0.02, y - S * 0.02 * r()); c.stroke(); } speckle(c, S, S, '#8b7a4a', S / 128, r); },
  [L.DIRT](c, S, r) { noiseFill(c, S, [146, 116, 92], 26, 9, 8, 5); speckle(c, S, S * 5, '#7a5c46', S / 128, r); speckle(c, S, S * 3, '#c2a68c', S / 160, r); },
  [L.BRICK](c, S, r) { c.fillStyle = '#8f8a82'; c.fillRect(0, 0, S, S); const rows = 8, bh = S / rows, bw = S / 4; for (let y = 0; y < rows; y++) for (let x = -1; x < 5; x++) { const ox = (y % 2) * bw * 0.5; const t = r(); c.fillStyle = `rgb(${168 + t * 40},${84 + t * 30},${56 + t * 22})`; c.fillRect(x * bw + ox + 1.5, y * bh + 1.5, bw - 3, bh - 3); c.fillStyle = 'rgba(60,25,15,.35)'; for (let k = 1; k < 4; k++) c.fillRect(x * bw + ox + 3, y * bh + (k * bh) / 4, bw - 6, 1); } const g = c.getImageData(0, 0, S, S); c.putImageData(g, 0, 0); speckle(c, S, S * 3, '#5a4a40', S / 128, r); },
  [L.PLASTER](c, S, r) { noiseFill(c, S, [228, 226, 220], 12, 11, 6, 5); speckle(c, S, S / 2, '#cfccc4', S / 100, r); const g = c.createLinearGradient(0, 0, 0, S); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, S, S); c.strokeStyle = 'rgba(90,90,85,.2)'; c.lineWidth = 1; for (let i = 0; i < 3; i++) { c.beginPath(); let x = r() * S, y = r() * S; c.moveTo(x, y); for (let k = 0; k < 5; k++) { x += (r() - 0.5) * S * 0.12; y += r() * S * 0.1; c.lineTo(x, y); } c.stroke(); } },
  [L.CONCRETE](c, S, r) { noiseFill(c, S, [150, 150, 148], 22, 13, 6, 5); speckle(c, S, S * 3, '#6d6d6a', S / 100, r); c.strokeStyle = 'rgba(60,60,60,.35)'; c.lineWidth = S / 200; c.strokeRect(0, 0, S, S); c.beginPath(); c.moveTo(0, S / 2); c.lineTo(S, S / 2); c.stroke(); },
  [L.ROOF_TILE](c, S, r) { c.fillStyle = '#8b3f25'; c.fillRect(0, 0, S, S); const cols = 8, rows = 5, w = S / cols, h = S / rows; for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const t = r(); const g = c.createLinearGradient(x * w, 0, x * w + w, 0); g.addColorStop(0, `rgb(${120 + t * 30},${52 + t * 16},${32})`); g.addColorStop(0.5, `rgb(${196 + t * 30},${100 + t * 20},${62})`); g.addColorStop(1, `rgb(${110 + t * 30},${46 + t * 16},${30})`); c.fillStyle = g; c.fillRect(x * w, y * h, w, h); c.fillStyle = 'rgba(40,15,8,.5)'; c.fillRect(x * w, y * h + h - S / 90, w, S / 90); } speckle(c, S, S * 2, '#3a2a22', S / 100, r); },
  [L.METAL_ROOF](c, S, r) { const n = 12, w = S / n; for (let i = 0; i < n; i++) { const g = c.createLinearGradient(i * w, 0, i * w + w, 0); g.addColorStop(0, '#7d8388'); g.addColorStop(0.5, '#c2c7cb'); g.addColorStop(1, '#6f7479'); c.fillStyle = g; c.fillRect(i * w, 0, w + 1, S); } speckle(c, S, S * 3, '#7a5a40', S / 90, r); c.fillStyle = 'rgba(40,40,40,.25)'; c.fillRect(0, S * 0.49, S, S * 0.02); },
  [L.FLOOR_TILE](c, S, r) { noiseFill(c, S, [206, 200, 188], 10, 15, 8, 4); c.strokeStyle = 'rgba(110,104,96,.7)'; c.lineWidth = S / 128; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * S / 4, 0); c.lineTo(i * S / 4, S); c.stroke(); c.beginPath(); c.moveTo(0, i * S / 4); c.lineTo(S, i * S / 4); c.stroke(); } speckle(c, S, S, '#8d877c', S / 80, r); },
  [L.WOOD](c, S, r) { for (let i = 0; i < 4; i++) { const t = r(); c.fillStyle = `rgb(${128 + t * 30},${88 + t * 22},${52 + t * 16})`; c.fillRect(0, i * S / 4, S, S / 4); c.strokeStyle = 'rgba(50,30,15,.35)'; c.lineWidth = 1; for (let k = 0; k < 12; k++) { c.beginPath(); const y = i * S / 4 + r() * S / 4; c.moveTo(0, y); c.bezierCurveTo(S * 0.3, y + r() * 6 - 3, S * 0.6, y + r() * 6 - 3, S, y); c.stroke(); } c.fillStyle = 'rgba(30,18,8,.6)'; c.fillRect(0, i * S / 4, S, S / 128); } },
  [L.WINDOW](c, S, r) { c.fillStyle = '#d7d4cc'; c.fillRect(0, 0, S, S); const m = S * 0.08; const g = c.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#22303c'); g.addColorStop(0.5, '#3c5568'); g.addColorStop(1, '#16212b'); c.fillStyle = g; c.fillRect(m, m, S - 2 * m, S - 2 * m); c.fillStyle = 'rgba(190,220,240,.16)'; c.beginPath(); c.moveTo(m, S * 0.6); c.lineTo(S * 0.6, m); c.lineTo(S * 0.8, m); c.lineTo(m, S * 0.85); c.fill(); c.fillStyle = '#b9b6ad'; c.fillRect(S / 2 - S * 0.02, m, S * 0.04, S - 2 * m); c.fillRect(m, S / 2 - S * 0.02, S - 2 * m, S * 0.04); c.strokeStyle = '#3a3a38'; c.lineWidth = S / 100; c.strokeRect(m, m, S - 2 * m, S - 2 * m); },
  [L.COBOGO](c, S, r) { c.clearRect(0, 0, S, S); const n = 4, w = S / n; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const t = r(); c.fillStyle = `rgb(${176 + t * 28},${108 + t * 20},${82 + t * 14})`; c.fillRect(x * w, y * w, w, w); c.clearRect(x * w + w * 0.2, y * w + w * 0.2, w * 0.6, w * 0.6); c.fillStyle = 'rgba(60,30,20,.5)'; c.fillRect(x * w, y * w, w, 2); } },
  [L.FENCE](c, S, r) { c.clearRect(0, 0, S, S); c.strokeStyle = 'rgba(185,190,192,1)'; c.lineWidth = S / 64; const n = 8, w = S / n; for (let i = -n; i < n * 2; i++) { c.beginPath(); c.moveTo(i * w, 0); c.lineTo(i * w + S, S); c.stroke(); c.beginPath(); c.moveTo(i * w, 0); c.lineTo(i * w - S, S); c.stroke(); } },
  [L.SHUTTER](c, S, r) { const n = 16, h = S / n; for (let i = 0; i < n; i++) { const g = c.createLinearGradient(0, i * h, 0, i * h + h); g.addColorStop(0, '#aab0b4'); g.addColorStop(0.6, '#7d8387'); g.addColorStop(1, '#4e5356'); c.fillStyle = g; c.fillRect(0, i * h, S, h + 1); } speckle(c, S, S * 2, '#6b4f3a', S / 90, r); c.fillStyle = 'rgba(40,40,40,.5)'; c.fillRect(0, 0, S * 0.03, S); c.fillRect(S * 0.97, 0, S * 0.03, S); },
  [L.PLAIN](c, S) { c.fillStyle = '#fff'; c.fillRect(0, 0, S, S); },
  [L.MURAL](c, S, r) { // Muro azul com "pedras" contornadas (referência: muro da EE Basílio Bosniac)
    const g = c.createLinearGradient(0, 0, 0, S); g.addColorStop(0, '#bfe0f2'); g.addColorStop(1, '#9fcfea'); c.fillStyle = g; c.fillRect(0, 0, S, S);
    const pts = []; const n = 4; for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) pts.push([(x + 0.2 + r() * 0.6) * S / n, (y + 0.2 + r() * 0.6) * S / n]);
    const img = c.getImageData(0, 0, S, S), d = img.data;
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { let a = 1e9, b = 1e9; for (const p of pts) { let dx = Math.abs(x - p[0]), dy = Math.abs(y - p[1]); if (dx > S / 2) dx = S - dx; if (dy > S / 2) dy = S - dy; const q = dx * dx + dy * dy; if (q < a) { b = a; a = q; } else if (q < b) b = q; } const e = Math.sqrt(b) - Math.sqrt(a); const i = (y * S + x) * 4; const k = clamp(e / (S * 0.05), 0, 1); const edge = 1 - k; d[i] = d[i] * (1 - edge) + 36 * edge - (1 - k) * 0; d[i + 1] = d[i + 1] * (1 - edge) + 104 * edge; d[i + 2] = d[i + 2] * (1 - edge) + 190 * edge; const inner = clamp(1 - e / (S * 0.14), 0, 1) * 0.35; d[i] -= 60 * inner; d[i + 1] -= 30 * inner; }
    c.putImageData(img, 0, 0); },
  [L.CHURCH_BRICK](c, S, r) { c.fillStyle = '#5c443a'; c.fillRect(0, 0, S, S); const rows = 12, bh = S / rows, bw = S / 6; for (let y = 0; y < rows; y++) for (let x = -1; x < 7; x++) { const ox = (y % 2) * bw * 0.5; const t = r(); c.fillStyle = `rgb(${128 + t * 34},${58 + t * 20},${44 + t * 14})`; c.fillRect(x * bw + ox + 1, y * bh + 1, bw - 2, bh - 2); } speckle(c, S, S * 2, '#3a2620', S / 128, r); },
  [L.ORANGE_PANEL](c, S, r) { const cols = 4, rows = 8, w = S / cols, h = S / rows; const cs = ['#f08a6a', '#e9775a', '#c9785c', '#f39a7c', '#d6866a']; for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { c.fillStyle = cs[(r() * cs.length) | 0]; c.fillRect(x * w, y * h, w, h); } c.strokeStyle = 'rgba(120,60,40,.25)'; c.lineWidth = 1; for (let y = 0; y <= rows; y++) { c.beginPath(); c.moveTo(0, y * h); c.lineTo(S, y * h); c.stroke(); } },
  [L.CLADDING](c, S, r) { noiseFill(c, S, [224, 226, 228], 6, 19, 4, 3); c.strokeStyle = 'rgba(120,125,130,.5)'; c.lineWidth = S / 256; for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(0, i * S / 4); c.lineTo(S, i * S / 4); c.stroke(); } c.beginPath(); c.moveTo(S / 2, 0); c.lineTo(S / 2, S); c.stroke(); const g = c.createLinearGradient(0, 0, 0, S); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(60,60,50,.10)'); c.fillStyle = g; c.fillRect(0, 0, S, S); },
  [L.WATER](c, S, r) { noiseFill(c, S, [196, 226, 236], 22, 21, 6, 4); c.strokeStyle = 'rgba(230,250,255,.35)'; c.lineWidth = S / 128; for (let i = 0; i < 26; i++) { c.beginPath(); const x = r() * S, y = r() * S; c.moveTo(x, y); c.quadraticCurveTo(x + S * 0.05, y + S * 0.03 * (r() - 0.5), x + S * 0.1, y); c.stroke(); } },
  [L.TURF](c, S, r) { noiseFill(c, S, [58, 132, 62], 14, 23, 12, 4); c.fillStyle = 'rgba(40,110,48,.5)'; c.fillRect(0, 0, S / 2, S); for (let i = 0; i < S * 8; i++) { c.fillStyle = `rgba(${30 + r() * 40},${100 + r() * 70},${40 + r() * 30},.4)`; c.fillRect(r() * S, r() * S, 1, 2); } },
  [L.FOLIAGE](c, S, r) { c.clearRect(0, 0, S, S); for (let i = 0; i < 260; i++) { const x = r() * S, y = r() * S, w = S * (0.05 + r() * 0.07); c.fillStyle = `rgb(${34 + r() * 40},${84 + r() * 70},${28 + r() * 30})`; c.beginPath(); c.ellipse(x, y, w, w * 0.55, r() * 6.28, 0, 6.28); c.fill(); if (x < w) { c.beginPath(); c.ellipse(x + S, y, w, w * 0.55, 0, 0, 6.28); c.fill(); } } },
  [L.BARK](c, S, r) { noiseFill(c, S, [92, 72, 54], 26, 27, 6, 4); c.strokeStyle = 'rgba(40,28,18,.6)'; c.lineWidth = S / 128; for (let i = 0; i < 26; i++) { const x = r() * S; c.beginPath(); c.moveTo(x, 0); c.bezierCurveTo(x + 8, S * 0.3, x - 8, S * 0.6, x, S); c.stroke(); } },
  [L.WALL_TILE](c, S, r) { c.fillStyle = '#eef2f2'; c.fillRect(0, 0, S, S); c.strokeStyle = 'rgba(140,150,150,.8)'; c.lineWidth = S / 128; for (let i = 0; i <= 6; i++) { c.beginPath(); c.moveTo(i * S / 6, 0); c.lineTo(i * S / 6, S); c.stroke(); c.beginPath(); c.moveTo(0, i * S / 6); c.lineTo(S, i * S / 6); c.stroke(); } speckle(c, S, S / 2, '#b7c7c7', S / 60, r); },
  [L.COURT](c, S, r) { noiseFill(c, S, [236, 236, 236], 10, 29, 10, 4); speckle(c, S, S * 2, '#bcbcbc', S / 128, r); },
};

export function buildTextureArray(size) {
  const S = size;
  const data = new Uint8Array(S * S * 4 * LAYER_COUNT);
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const saveRandom = Math.random; const rr = mulberry(1234); Math.random = rr; // determinismo no ruído fino
  for (let i = 0; i < LAYER_COUNT; i++) {
    ctx.globalAlpha = 1; ctx.clearRect(0, 0, S, S);
    const rng = mulberry(100 + i * 7);
    (painters[i] || painters[L.PLAIN])(ctx, S, rng);
    data.set(ctx.getImageData(0, 0, S, S).data, i * S * S * 4);
  }
  Math.random = saveRandom;
  const tex = new THREE.DataArrayTexture(data, S, S, LAYER_COUNT);
  tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType; tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true; tex.needsUpdate = true;
  return tex;
}

// Material do mundo: Lambert + textura em array + cor por vértice.
export function makeWorldMaterial(texArr, cutout) {
  const dummy = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); dummy.needsUpdate = true;
  const m = new THREE.MeshLambertMaterial({ map: dummy, vertexColors: true, alphaTest: cutout ? 0.5 : 0, side: cutout ? THREE.DoubleSide : THREE.FrontSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tArr = { value: texArr };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float layer;\nvarying float vLayer;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLayer = layer;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform highp sampler2DArray tArr;\nvarying float vLayer;').replace('#include <map_fragment>', 'vec4 sampledDiffuseColor = texture( tArr, vec3( vMapUv, floor( vLayer + 0.5 ) ) );\ndiffuseColor *= sampledDiffuseColor;');
  };
  m.customProgramCacheKey = () => 'world' + (cutout ? 'c' : 'o');
  return m;
}

// Céu: gradiente + nuvens pintadas uma única vez (custo zero por frame).
export function buildSkyTexture() {
  const W = 1024, H = 512; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2f6fb8'); g.addColorStop(0.3, '#5d9bd6'); g.addColorStop(0.46, '#a9cde8'); g.addColorStop(0.5, '#d5e3ea'); g.addColorStop(0.52, '#c9d3d6'); g.addColorStop(1, '#8f9aa0');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const img = c.getImageData(0, 0, W, H), d = img.data;
  for (let y = 0; y < H * 0.5; y++) for (let x = 0; x < W; x++) {
    const v = y / (H * 0.5); // 0 zênite, 1 horizonte
    const sc = 1 / (0.25 + (1 - v) * 0.9); // perspectiva: nuvens se comprimem no horizonte
    const n = pfbm((x / W) * 10, v * 3.2 * sc + 3, 10, 5, 41);
    const n2 = pfbm((x / W) * 20, v * 6 * sc, 20, 3, 77);
    let a = clamp((n * 0.8 + n2 * 0.2 - 0.5) * 4.2, 0, 1); a *= clamp(v * 3, 0, 1) * clamp((1.02 - v) * 9, 0, 1);
    const shade = clamp(0.78 + (n2 - 0.4) * 0.6, 0.6, 1);
    const i = (y * W + x) * 4;
    d[i] = d[i] * (1 - a) + 255 * shade * a; d[i + 1] = d[i + 1] * (1 - a) + 255 * shade * a; d[i + 2] = d[i + 2] * (1 - a) + (250 * shade + 5) * a;
  }
  c.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}

// Textura de canvas para placas/letreiros.
export function textTexture(lines, opts = {}) {
  const W = opts.w || 512, H = opts.h || 128; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  if (opts.bg) { c.fillStyle = opts.bg; c.fillRect(0, 0, W, H); }
  if (opts.draw) opts.draw(c, W, H);
  c.textAlign = opts.align || 'center'; c.textBaseline = 'middle';
  lines = Array.isArray(lines) ? lines : [lines];
  lines.forEach((ln, i) => { const o = typeof ln === 'string' ? { t: ln } : ln; const size = o.size || H * 0.5; c.font = `${o.weight || 800} ${size}px ${o.font || 'Arial, Helvetica, sans-serif'}`; c.fillStyle = o.color || opts.color || '#fff'; const x = o.x != null ? o.x * W : (opts.align === 'left' ? W * 0.05 : W / 2); const y = o.y != null ? o.y * H : (H * (i + 0.5)) / lines.length; if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = size * 0.12; c.strokeText(o.t, x, y); } c.fillText(o.t, x, y); });
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
