// Entrada unificada: toque (analógico + câmera + botões), teclado e mouse. Layout de HUD editável.
import { G } from './state.js';
import { S } from './config.js';
import { store, $, clamp } from './util.js';
import { initAudio } from './audio.js';

export const I = { mx: 0, my: 0, lx: 0, ly: 0, fire: false, ads: false, run: false, up: false, down: false, hits: new Set(), touch: false, locked: false, keys: {} };
export const hit = (k) => { if (I.hits.has(k)) { I.hits.delete(k); return true; } return false; };
export function endFrame() { I.lx = 0; I.ly = 0; I.hits.clear(); }
// Botões do HUD: âncora (l/r/c + t/b), deslocamento em px e tamanho. Editável pelo jogador.
export const DEF_LAYOUT = {
  joy: { ax: 'l', ay: 'b', x: 26, y: 30, s: 150, label: '' }, run: { ax: 'l', ay: 'b', x: 62, y: 206, s: 56, label: 'CORRER' },
  fire: { ax: 'r', ay: 'b', x: 24, y: 92, s: 82, label: '●' }, ads: { ax: 'r', ay: 'b', x: 120, y: 56, s: 58, label: 'MIRA' }, jump: { ax: 'r', ay: 'b', x: 22, y: 194, s: 56, label: 'PULO' },
  crouch: { ax: 'r', ay: 'b', x: 96, y: 168, s: 50, label: 'AGACH' }, prone: { ax: 'r', ay: 'b', x: 156, y: 126, s: 44, label: 'DEITA' }, reload: { ax: 'r', ay: 'b', x: 96, y: 232, s: 46, label: 'REC' },
  lethal: { ax: 'r', ay: 'b', x: 22, y: 264, s: 44, label: '✸' }, tactical: { ax: 'r', ay: 'b', x: 74, y: 292, s: 44, label: '☁' }, plate: { ax: 'r', ay: 'b', x: 156, y: 184, s: 42, label: '▰' },
  field: { ax: 'r', ay: 'b', x: 128, y: 296, s: 42, label: '⌖' }, streak: { ax: 'r', ay: 'b', x: 180, y: 262, s: 42, label: '✈' }, interact: { ax: 'c', ay: 'b', x: 0, y: 250, s: 60, label: 'USAR' },
  bag: { ax: 'r', ay: 't', x: 12, y: 132, s: 38, label: '🎒' }, pause: { ax: 'l', ay: 't', x: 10, y: 8, s: 38, label: '☰' },
};
// Layout padrão para paisagem (tela baixa): o conjunto da direita se espalha na horizontal e fica abaixo do minimapa.
const LAND = { joy: [34, 26, 150], run: [200, 36, 56], fire: [46, 64, 82], ads: [150, 28, 58], jump: [28, 162, 54], crouch: [100, 158, 50], prone: [162, 100, 44], reload: [222, 40, 46], lethal: [166, 164, 44], tactical: [222, 152, 44], plate: [222, 96, 42], field: [280, 40, 42], streak: [280, 96, 42], interact: [0, 30, 58], bag: [130, 10, 38], pause: [10, 8, 38] };
export let layout = {}; let layKey = '';
const orient = () => (innerWidth > innerHeight * 1.15 ? 'l' : 'p');
export function loadLayout() { layKey = orient(); const saved = store.get('hud_' + layKey, {}); layout = {}; for (const k in DEF_LAYOUT) { const d = { ...DEF_LAYOUT[k] }; if (layKey === 'l' && LAND[k]) { d.x = LAND[k][0]; d.y = LAND[k][1]; d.s = LAND[k][2]; } layout[k] = { ...d, o: 0.55, ...(saved[k] || {}) }; } return layout; }
export function saveLayout() { const o = {}; for (const k in layout) { const l = layout[k]; o[k] = { x: l.x, y: l.y, s: l.s, o: l.o }; } store.set('hud_' + layKey, o); }
export function resetLayout() { store.set('hud_' + layKey, {}); loadLayout(); applyLayout(); }
export function applyLayout() { for (const k in layout) { const e = document.querySelector(`.hb[data-k="${k}"]`); if (!e) continue; const l = layout[k]; e.style.width = e.style.height = l.s + 'px'; e.style.left = e.style.right = e.style.top = e.style.bottom = ''; if (l.ax === 'l') e.style.left = `calc(${l.x}px + env(safe-area-inset-left, 0px))`; else if (l.ax === 'r') e.style.right = `calc(${l.x}px + env(safe-area-inset-right, 0px))`; else e.style.left = `calc(50% + ${l.x - l.s / 2}px)`; if (l.ay === 't') e.style.top = `calc(${l.y}px + env(safe-area-inset-top, 0px))`; else e.style.bottom = `calc(${l.y}px + env(safe-area-inset-bottom, 0px))`; e.style.opacity = l.o; e.style.fontSize = Math.max(9, l.s * 0.2) + 'px'; } }

let joyId = null, joyX = 0, joyY = 0, lookId = null, lastX = 0, lastY = 0, fireId = null; const btnPtr = new Map();
export function initInput() {
  loadLayout(); const root = $('touch'); root.innerHTML = '';
  for (const k in layout) { const e = document.createElement('div'); e.className = 'hb' + (k === 'joy' ? ' joy' : ''); e.dataset.k = k; e.innerHTML = k === 'joy' ? '<i></i>' : `<span>${layout[k].label}</span><b></b>`; root.appendChild(e); }
  applyLayout();
  const press = (k, on, ev) => { if (G.hudEdit) return; initAudio();
    if (k === 'fire') { I.fire = on; if (on && ev) { fireId = ev.pointerId; lastX = ev.clientX; lastY = ev.clientY; } else fireId = null; }
    else if (k === 'ads') { if (on) I.ads = !I.ads; }
    else if (k === 'run') { if (on) I.run = !I.run; }
    else if (k === 'jump') { I.up = on; if (on) I.hits.add('jump'); }
    else if (k === 'crouch') { I.down = on; if (on) I.hits.add('crouch'); }
    else if (on) I.hits.add(k); };
  root.addEventListener('pointerdown', (ev) => { const b = ev.target.closest('.hb'); if (!b) return; ev.preventDefault(); I.touch = ev.pointerType !== 'mouse' || I.touch; const k = b.dataset.k;
    if (k === 'joy') { if (G.hudEdit) return; joyId = ev.pointerId; const r = b.getBoundingClientRect(); joyX = r.left + r.width / 2; joyY = r.top + r.height / 2; moveJoy(ev, b); b.setPointerCapture(ev.pointerId); return; }
    btnPtr.set(ev.pointerId, k); b.classList.add('on'); try { b.setPointerCapture(ev.pointerId); } catch (e) { /* ok */ } press(k, true, ev); });
  const moveJoy = (ev, b) => { const r = layout.joy.s * 0.42; let dx = (ev.clientX - joyX) / r, dy = (ev.clientY - joyY) / r; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } I.mx = dx; I.my = -dy; const nub = b.firstChild; nub.style.transform = `translate(${dx * r}px, ${dy * r}px)`; };
  root.addEventListener('pointermove', (ev) => { if (ev.pointerId === joyId) { moveJoy(ev, document.querySelector('.hb.joy')); return; } if (ev.pointerId === fireId) { look(ev.clientX - lastX, ev.clientY - lastY); lastX = ev.clientX; lastY = ev.clientY; } });
  const up = (ev) => { if (ev.pointerId === joyId) { joyId = null; I.mx = I.my = 0; const j = document.querySelector('.hb.joy'); j.firstChild.style.transform = ''; return; } const k = btnPtr.get(ev.pointerId); if (k) { btnPtr.delete(ev.pointerId); const b = document.querySelector(`.hb[data-k="${k}"]`); b && b.classList.remove('on'); press(k, false, ev); } };
  root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
  addEventListener('resize', () => { if (orient() !== layKey && !G.hudEdit) { loadLayout(); applyLayout(); } });
  // área de câmera: qualquer toque fora dos botões
  const cv = $('gl'); const look = (dx, dy) => { const z = G.zoomSens || 1; const k = 0.0042 * S.sens * (I.ads ? S.adsSens : 1) * z; I.lx += dx * k; I.ly += dy * k * (S.invertY ? -1 : 1); };
  cv.addEventListener('pointerdown', (ev) => { initAudio(); if (ev.pointerType === 'mouse') { if (G.mode === 'play' && !G.uiOpen) { if (!I.locked) { try { const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* sem pointer lock */ } } if (ev.button === 0 && I.locked) I.fire = true; if (ev.button === 2) I.ads = true; } if (I.locked) return; } else I.touch = true; if (lookId === null) { lookId = ev.pointerId; lastX = ev.clientX; lastY = ev.clientY; try { cv.setPointerCapture(ev.pointerId); } catch (e) { /* ok */ } } });
  cv.addEventListener('pointermove', (ev) => { if (I.locked && ev.pointerType === 'mouse') { look(ev.movementX * 0.6, ev.movementY * 0.6); return; } if (ev.pointerId === lookId) { look(ev.clientX - lastX, ev.clientY - lastY); lastX = ev.clientX; lastY = ev.clientY; } });
  const lu = (ev) => { if (ev.pointerId === lookId) lookId = null; if (ev.pointerType === 'mouse') { if (ev.button === 0) I.fire = false; if (ev.button === 2) I.ads = false; } };
  cv.addEventListener('pointerup', lu); cv.addEventListener('pointercancel', lu); cv.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => { I.locked = document.pointerLockElement === cv; });
  const KEY = { Space: 'jump', KeyC: 'crouch', KeyZ: 'prone', KeyR: 'reload', KeyE: 'interact', KeyF: 'interact', KeyG: 'lethal', KeyQ: 'tactical', KeyV: 'melee', KeyM: 'map', Tab: 'bag', Digit1: 'slot1', Digit2: 'slot2', Digit3: 'slot3', Digit4: 'plate', KeyX: 'field', Digit5: 'streak', KeyT: 'cam', Escape: 'pause', KeyP: 'pause', KeyB: 'firemode' };
  addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT') return; I.keys[e.code] = true; if (KEY[e.code]) { if (!e.repeat) I.hits.add(KEY[e.code]); if (e.code === 'Tab' || e.code === 'Space') e.preventDefault(); } if (e.code === 'Space') I.up = true; if (e.code === 'KeyC') I.down = true; initAudio(); });
  addEventListener('keyup', (e) => { I.keys[e.code] = false; if (e.code === 'Space') I.up = false; if (e.code === 'KeyC') I.down = false; });
  addEventListener('blur', () => { I.keys = {}; I.fire = false; });
}
export function pollKeys() { const k = I.keys; if (joyId === null) { const x = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0), y = (k.KeyW ? 1 : 0) - (k.KeyS ? 1 : 0); if (x || y || I._kb) { const m = Math.hypot(x, y) || 1; I.mx = x / m; I.my = y / m; I._kb = !!(x || y); } } I.shift = !!(k.ShiftLeft || k.ShiftRight); }
export function setBtn(k, visible, label, badge) { const e = document.querySelector(`.hb[data-k="${k}"]`); if (!e) return; if (e._v !== visible) { e._v = visible; e.hidden = !visible; } if (label != null && e._l !== label) { e._l = label; e.children[0].textContent = label; } if (badge !== undefined && e._b !== badge) { e._b = badge; e.children[1].textContent = badge == null ? '' : badge; } }
