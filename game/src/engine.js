// Motor: renderizador, céu, luzes, sombras, culling por distância e controle de qualidade.
import * as THREE from 'three';
import { G } from './state.js';
import { S } from './config.js';
import { buildSkyTexture } from './textures.js';
import { buildWorld } from './world.js';
import { clamp } from './util.js';

const _v = new THREE.Vector3();
export function initEngine(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !!S.aa, powerPreference: 'high-performance', stencil: false });
  renderer.autoClear = false; renderer.shadowMap.enabled = S.shadows > 0; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.info.autoReset = false;
  const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xc6d6de, 60, 300);
  const camera = new THREE.PerspectiveCamera(S.fov, 1, 0.08, 1400); camera.rotation.order = 'YXZ'; scene.add(camera);
  // céu
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1000, 24, 12), new THREE.MeshBasicMaterial({ map: buildSkyTexture(), side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false })); sky.frustumCulled = false; sky.renderOrder = -10; scene.add(sky);
  // luzes
  const hemi = new THREE.HemisphereLight(0xd6e6ff, 0x8f8672, 1.55); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.5); const sunDir = new THREE.Vector3(0.55, 0.78, 0.3).normalize(); sun.position.copy(sunDir).multiplyScalar(120); scene.add(sun); scene.add(sun.target);
  sun.castShadow = S.shadows > 0; const sc = sun.shadow.camera; sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 10; sc.far = 320; sun.shadow.mapSize.set(S.shadows || 1024, S.shadows || 1024); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.05;
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xfff6d8, fog: false, depthWrite: false, depthTest: true, transparent: true, opacity: 0.95, map: glowTex(), toneMapped: false })); sunSprite.scale.set(160, 160, 1); scene.add(sunSprite);
  // segunda cena para a arma em primeira pessoa (não atravessa paredes)
  const vmScene = new THREE.Scene(); const vmCam = new THREE.PerspectiveCamera(58, 1, 0.01, 10); vmScene.add(new THREE.HemisphereLight(0xe6eeff, 0xa09886, 2.6)); const vl = new THREE.DirectionalLight(0xfff1dc, 3.4); vl.position.set(0.6, 1, 0.5); vmScene.add(vl);
  const world = buildWorld({ texSize: S.tex }); scene.add(world.group);
  if (world.gulagBat) { const gm = world.gulagBat.build(world.matO, world.matC); world.gulagGroup = new THREE.Group(); gm.forEach((m) => { m.frustumCulled = false; world.gulagGroup.add(m); }); world.gulagGroup.visible = false; scene.add(world.gulagGroup); }
  Object.assign(G, { renderer, scene, camera, sky, sun, sunDir, hemi, sunSprite, vmScene, vmCam, world, phys: world.phys, terr: world.terr });
  G.stats = { fps: 0, ms: 0, calls: 0, tris: 0, chunks: 0 };
  resize(); addEventListener('resize', resize); applyQuality();
}
function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const g = x.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.12, 'rgba(255,250,225,.95)'); g.addColorStop(0.3, 'rgba(255,240,200,.25)'); g.addColorStop(1, 'rgba(255,240,200,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); }
export function resize() {
  const { renderer, camera, vmCam } = G; const w = innerWidth, h = innerHeight; const pr = Math.min(devicePixelRatio || 1, 2) * S.scale;
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false); const a = w / h; camera.aspect = a; vmCam.aspect = a; G.aspect = a; G.resW = Math.round(w * pr); G.resH = Math.round(h * pr); setFov(S.fov); vmCam.fov = a < 1 ? 80 : 55; vmCam.updateProjectionMatrix();
}
// FOV base é horizontal em 16:9; em telas estreitas (retrato) preserva um campo horizontal mínimo.
export function setFov(f) { const { camera } = G; const a = G.aspect || 1.78; const hf = 2 * Math.atan(Math.tan((f * Math.PI) / 360) * 1.78); let v = (2 * Math.atan(Math.tan(hf / 2) / Math.max(a, 0.9)) * 180) / Math.PI; if (a > 1.78) v = f; v = clamp(v, 2, 100); if (Math.abs(camera.fov - v) > 0.01) { camera.fov = v; camera.updateProjectionMatrix(); } }
export function applyQuality() {
  const { renderer, sun, scene } = G; renderer.shadowMap.enabled = S.shadows > 0; sun.castShadow = S.shadows > 0;
  if (S.shadows > 0 && sun.shadow.mapSize.x !== S.shadows) { sun.shadow.mapSize.set(S.shadows, S.shadows); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  scene.fog.near = S.dist * 0.42; scene.fog.far = S.dist * 0.99; resize(); G.world.matO.needsUpdate = true; G.world.matC.needsUpdate = true;
}
let cullT = 0;
export function updateEngine(dt) {
  const { camera, sky, sun, sunDir, sunSprite, world } = G; const cp = camera.position;
  sky.position.copy(cp); sunSprite.position.copy(cp).addScaledVector(sunDir, 900);
  // sombra segue a câmera (ajustada à grade de texels para não tremer)
  if (S.shadows > 0) { const texel = 110 / S.shadows; const tx = Math.round(cp.x / texel) * texel, tz = Math.round(cp.z / texel) * texel; sun.target.position.set(tx, cp.y - 2, tz); sun.position.set(tx + sunDir.x * 150, cp.y - 2 + sunDir.y * 150, tz + sunDir.z * 150); sun.target.updateMatrixWorld(); }
  // culling por distância (LOD simples: detalhes somem antes das estruturas)
  cullT -= dt; if (cullT <= 0) { cullT = 0.12; const alt = Math.max(0, cp.y - G.terr.height(cp.x, cp.z)); const high = alt > 45; const dS = S.dist + (high ? alt * 1.2 : 0), dD = high ? 0 : S.detail; let vis = 0; if (G.scene.fog) { G.scene.fog.far = (S.dist + (high ? alt * 1.4 : 0)) * 0.99; G.scene.fog.near = G.scene.fog.far * 0.42; }
    for (const m of world.meshes) { const bs = m.geometry.boundingSphere; const d = _v.copy(bs.center).sub(cp).length() - bs.radius; const k = m.userData.kind; const v = G.inGulag ? false : k === 3 ? d < dS * 1.15 : k === 0 ? d < dS : k === 1 ? d < dD : d < dD * 1.4; m.visible = v; if (v) vis++; } G.stats.chunks = vis;
    world.glassMesh.visible = !high; world.doorMesh.visible = !high; }
}
export function render() {
  const { renderer, scene, camera, vmScene, vmCam } = G; renderer.info.reset(); renderer.clear(); renderer.render(scene, camera);
  if (G.vmVisible) { renderer.clearDepth(); const sh = renderer.shadowMap.autoUpdate; renderer.shadowMap.autoUpdate = false; renderer.render(vmScene, vmCam); renderer.shadowMap.autoUpdate = sh; }
  G.stats.calls = renderer.info.render.calls; G.stats.tris = renderer.info.render.triangles;
}
