import * as THREE from 'three';
import { G } from './state.js';
import { initEngine, updateEngine, render } from './engine.js';
const t0 = performance.now();
initEngine(document.getElementById('gl'));
console.log('world built ms', Math.round(performance.now() - t0), 'tris', G.world.worldTris, 'colliders', G.phys.b.length, 'doors', G.world.doors.length, 'glass', G.world.glass.length, 'loot', G.world.loot.length, 'crates', G.world.crates.length);
window.__G = G; window.__THREE = THREE;
window.__shot = (x, y, z, tx, ty, tz) => { G.camera.position.set(x, y, z); G.camera.lookAt(tx, ty, tz); updateEngine(1); updateEngine(1); render(); return G.stats; };
window.__ready = true;
