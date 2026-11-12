// Carapicuíba Royale — inicialização, lobby 3D e laço principal.
import * as THREE from 'three';
import { G } from './state.js';
import { S, applyPreset } from './config.js';
import { initEngine, updateEngine, render, setFov, dynamicResolution, applyQuality } from './engine.js';
import { initFx, updateFx } from './fx.js';
import { initInput, pollKeys, endFrame, I, layout as _l0 } from './input.js';
import * as inputMod from './input.js';
const layoutRef = () => inputMod.layout;
import { buildNav } from './nav.js';
import { initLoot, updateLoot, Loot, buy } from './loot.js';
import { initVehicles, spawnVehicles, updateVehicles } from './vehicles.js';
import { Player } from './player.js';
import { Bot, botsFrame, giveStarter } from './bots.js';
import { Match } from './br.js';
import { playerEquipment, updateNades, updateDrone, Drone } from './equipment.js';
import { Pet } from './pets.js';
import { lookFor, botLook, Humanoid } from './character.js';
import { buildWeapon } from './weaponmodels.js';
import { UI } from './ui.js';
import { WBY, WEAPONS } from './config.js';
import { stopAllLoops, lobbyMusic, snd, initAudio } from './audio.js';
import { $, store, damp } from './util.js';

const profile = () => store.get('profile', { char: 'lukas', outfit: {}, pet: 'belo', owned: ['padrao', 'time'], name: 'Lukas' });
let pet = null, petId = null, last = 0, fpsAcc = 0, fpsN = 0, birdT = 5;
const lobby = { yaw: 0, focusName: null, owner: { pos: new THREE.Vector3(), yaw: 0, speed: 0, crouch: false, prone: false }, off: 0,
  refresh() { G.applyLook(); const p = profile(); if (p.pet !== petId) { if (pet) pet.dispose(); pet = p.pet ? new Pet(p.pet) : null; petId = p.pet; if (pet) pet.pos.set(1, G.terr.height(0, -27), -27); } const lo = store.get('loadout', { p: 'guara', s: 'lambari' }); const pl = G.player; const slot = this.focusName === 'ars' && lobby.slot === 's' ? lo.s : lo.p; const key = slot + (lo.po || '') + (lo.so || ''); pl.model.setWeapon(buildWeapon(WBY[slot], (slot === lo.p ? lo.po : lo.so) || WBY[slot].optic)); this.armed = WBY[slot].cls === 'pistol' ? 'pistol' : 'rifle'; },
  focus(n) { this.focusName = n; },
  petPlay() { if (pet) pet.interact(); },
  update(dt) { const pl = G.player, cam = G.camera, P = G.terr.height(0, -27); this.yaw = damp(this.yaw, -0.5, 1.2, dt) - I.lx * 0.9; const m = pl.model; m.root.visible = true; pl.pos.set(0, P, -27); m.root.position.copy(pl.pos); m.root.rotation.y = this.yaw + Math.sin(G.time * 0.5) * 0.06;
    m.update(dt, { speed: 0, armed: this.armed || 'rifle', pitch: Math.sin(G.time * 0.8) * 0.03 });
    const a = G.aspect, port = a < 1.3; const open = !!this.focusName; this.off = damp(this.off, open ? 1 : 0, 6, dt); const d = port ? 4.3 : 4.4; cam.position.set(port ? 0.5 : 1.2, P + 1.3, -27 - d); cam.lookAt(port ? 0 : 1.15, P + (port ? 1.05 : 0.98), -27); setFov(port ? 34 : 36);
    const w = innerWidth, h = innerHeight; if (this.off > 0.01) cam.setViewOffset(w, h, port ? 0 : w * 0.2 * this.off, port ? h * 0.27 * this.off : 0, w, h); else if (cam.view && cam.view.enabled) cam.clearViewOffset();
    this.owner.pos.copy(pl.pos); this.owner.yaw = this.yaw; if (pet) pet.update(dt, this.owner, true, true); G.vmVisible = false; G.fpsView = false; } };

G.applyLook = () => { const p = profile(); const key = p.char + '|' + (p.outfit[p.char] || 'padrao'); if (G.player._lookKey !== key) { G.player._lookKey = key; G.player.model.setLook(lookFor(p.char, p.outfit[p.char] || 'padrao')); G.player._wkey = null; G.player.vm.key = null; } G.player.name = p.name || 'Você'; };
G.startMatch = (mode, team) => { initAudio(); G.camera.clearViewOffset(); G.applyLook(); G.player._wkey = null; spawnVehicles(); UI.showHud(); G.match.start(mode, team); G.player.camMode = S.camera; if (pet) pet.pos.copy(G.player.pos); try { navigator.wakeLock && navigator.wakeLock.request('screen').catch(() => {}); } catch (e) { /* opcional */ } };
G.endMatch = () => { stopAllLoops(); const M = G.match; M.phase = 'none'; M.result = null; M.gulag = null; G.inGulag = false; G.world.gulagGroup.visible = false; for (const b of G.botPool) { b.alive = false; b.mode = 'gone'; b.model.root.visible = false; } for (const v of G.vehicles) { v.driver = null; } const pl = G.player; pl.reset(); pl.vehicle = null; pl.noTerrain = false; if (Drone.active) { Drone.active = false; Drone.mesh.visible = false; } G.actors = [pl]; G.bots = []; I.ads = false; I.run = false; I.fire = false; lobby.refresh(); UI.showMenu(); };
G.devBots = (v) => { const pl = G.player, M = G.match; if (v === 'freeze') { G.dev.freeze = !G.dev.freeze; return; } if (v === 'kill') { for (const b of G.bots) { b.alive = false; b.mode = 'gone'; b.model.root.visible = false; } UI.toast('Bots removidos'); return; }
  const b = G.botPool.slice(0, G.botPool.length - 1).find((x) => !x.alive); if (!b) { UI.toast('Limite de bots atingido'); return; } b.reset(); b.alive = true; b.deadT = 0; b.mode = 'ground'; b.ally = v === 'ally'; b.team = b.ally ? 0 : 50 + b.idx; if (!b.place(pl.pos.x - Math.sin(pl.yaw) * 7, pl.pos.z - Math.cos(pl.yaw) * 7, pl.pos.y)) { b.alive = false; UI.toast('Sem espaço livre aqui'); return; } giveStarter(b, Math.random); if (!G.bots.includes(b)) G.bots.push(b); if (!G.actors.includes(b)) G.actors.push(b); if (b.ally && M.teamSize < 2) M.teamSize = 2; UI.toast(b.ally ? 'Aliado criado: ' + b.name : 'Bot criado: ' + b.name); };
G.devVehicles = () => { const pl = G.player; for (const v of G.vehicles) { if (v.driver) continue; const k = G.vehicles.indexOf(v); if (k > 4) break; const a = pl.yaw + k * 1.2; v.pos.set(pl.pos.x - Math.sin(a) * (7 + k * 2), 0, pl.pos.z - Math.cos(a) * (7 + k * 2)); v.pos.y = G.terr.height(v.pos.x, v.pos.z); v.speed = 0; v.hp = v.t.hp; v.alive = true; v.sync(); } UI.toast('Veículos trazidos para perto'); };

function tick(dt) {
  pollKeys(); const pl = G.player;
  if (G.mode === 'menu') lobby.update(dt);
  else if (G.mode === 'play') { const M = G.match; UI.keys(); if (G.uiOpen) { I.lx = I.ly = 0; I.fire = false; if (!G.hudEdit) { I.mx = I.my = 0; } }
    M.update(dt); if (G.mode !== 'play') return;
    playerEquipment(dt, pl); if (pl.mode === 'drone') updateDrone(dt, pl); pl.update(dt);
    botsFrame(); if (!G.dev.freeze) { const cp = G.camera.position; for (const b of G.bots) { if (M.gulag && b === M.gulag.bot) continue; const d = (b.pos.x - cp.x) ** 2 + (b.pos.z - cp.z) ** 2; b.update(dt, d < 4900 ? 0 : d < S.dist * S.dist ? 1 : 2); } } else for (const b of G.bots) b.syncModel(dt, b.alive);
    updateVehicles(dt); if (pl.mode === 'ground' || pl.mode === 'fall' || pl.mode === 'chute') pl.updateCamera(dt);
    updateNades(dt); updateLoot(dt, pl);
    if (pet) { const vis = pl.alive && (pl.mode === 'ground' || pl.mode === 'drone') && !G.inGulag; pet.update(dt, pl, false, vis); }
    birdT -= dt; if (birdT <= 0) { birdT = 6 + Math.random() * 14; if (!G.inGulag) snd.bird(); } }
  updateFx(dt); updateEngine(dt);
}
function frame(t) {
  requestAnimationFrame(frame); const cap = S.fpsCap; if (cap && t - last < 1000 / cap - 1.2) return;
  const raw = (t - last) / 1000; last = t; const dt = Math.min(0.05, Math.max(0.001, raw)); G.dt = dt; G.time += dt; G.frame++; fpsAcc += raw; fpsN++; if (fpsAcc >= 0.5) { G.stats.fps = fpsN / fpsAcc; G.stats.ms = (fpsAcc / fpsN) * 1000; fpsAcc = 0; fpsN = 0; }
  if (G.simPause) return; tick(dt); render(); UI.update(dt); endFrame(); if (G.mode === 'play') dynamicResolution(raw);
}
// Avanço rápido sem renderizar (usado pelos testes automatizados e para medir o custo de simulação).
window.__sim = (seconds, step = 1 / 30, each) => { const n = Math.round(seconds / step); const t0 = performance.now(); for (let i = 0; i < n; i++) { G.dt = step; G.time += step; G.frame++; tick(step); if (each) each(i); UI.update(step); endFrame(); if (G.mode !== 'play' && !each) break; } return (performance.now() - t0) / n; };
function boot() { const msg = $('ld-msg'); const step = (txt, fn) => new Promise((res, rej) => { msg.textContent = txt; setTimeout(() => { try { fn(); res(); } catch (e) { rej(e); } }, 30); });
  step('Construindo Carapicuíba…', () => { initEngine($('gl')); initFx(); })
    .then(() => step('Mapeando ruas, vielas e escadarias…', () => { buildNav(); initLoot(); initVehicles(); }))
    .then(() => step('Chamando a rapaziada…', () => { const p = profile(); G.player = new Player(lookFor(p.char, p.outfit[p.char] || 'padrao')); G.player._lookKey = p.char + '|' + (p.outfit[p.char] || 'padrao'); G.botPool = []; for (let i = 0; i < 24; i++) G.botPool.push(new Bot(i, i + 1)); G.actors = [G.player]; G.bots = []; G.vehicles = []; G.match = new Match(); G.lobby = lobby; initInput(); UI.init(); lobby.refresh(); UI.showMenu(); }))
    .then(() => { $('loading').hidden = true; last = performance.now(); requestAnimationFrame(frame); window.__G = G; window.__ready = true; })
    .catch((e) => { console.error(e); msg.textContent = 'Erro ao iniciar: ' + e.message; });
}
window.__THREE = THREE; G.__W = WEAPONS; G.__S = S; G.__applyPreset = applyPreset; G.__applyQuality = applyQuality; G.__layout = () => layoutRef(); G.__mods = { Humanoid, lookFor, botLook, Pet, buildWeapon }; G.__render = render; G.__I = I; G.__keys = I.keys; G.__hits = I.hits; G.__Loot = Loot; G.__buy = buy;
if (window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(boot); else boot();
