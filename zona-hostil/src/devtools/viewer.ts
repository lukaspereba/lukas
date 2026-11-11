// Visualizador de assets (uso em desenvolvimento e nos testes automatizados de pipeline).
// Parâmetros: ?file=assets/characters/x.glb&yaw=0&dist=2.6&h=1.0&anim=walk&t=0.3
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const q = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x30343a);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;
const sun = new THREE.DirectionalLight(0xfff1dd, 2.6);
sun.position.set(2, 4, 3);
sun.castShadow = true;
scene.add(sun, new THREE.HemisphereLight(0xbfd4ff, 0x3a3328, 0.6));
const ground = new THREE.Mesh(new THREE.CircleGeometry(4, 48), new THREE.MeshStandardMaterial({ color: 0x55524a, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const cam = new THREE.PerspectiveCamera(Number(q.get('fov') ?? 30), innerWidth / innerHeight, 0.05, 100);
const yaw = (Number(q.get('yaw') ?? 0) * Math.PI) / 180;
const dist = Number(q.get('dist') ?? 5.2);
const h = Number(q.get('h') ?? 1.0);
const pitch = Number(q.get('pitch') ?? 0);
cam.position.set(Math.sin(yaw) * dist, h + pitch, Math.cos(yaw) * dist);
cam.lookAt(0, h, 0);

const files = (q.get('file') ?? 'assets/characters/soldier_alfa.glb').split(',');
const loader = new GLTFLoader();
(async () => {
  let x = -(files.length - 1) * 0.45;
  for (const f of files) {
    const gltf = await loader.loadAsync(f);
    const root = gltf.scene;
    root.position.x = x;
    x += 0.9;
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
        if (q.get('hide') && new RegExp(q.get('hide')!, 'i').test(m.name)) m.visible = false;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (q.get('debug') && new RegExp(q.get('debug')!, 'i').test(mat.name)) {
          mat.map = null;
          mat.color.set(0xff0000);
          mat.side = THREE.DoubleSide;
          mat.depthTest = false;
          mat.alphaTest = 0;
          mat.opacity = 1;
          mat.transparent = false;
          mat.needsUpdate = true;
        }
        if (q.get('opaque') && new RegExp(q.get('opaque')!, 'i').test(mat.name)) {
          mat.alphaTest = 0;
          mat.transparent = false;
          console.log('OPAQUE', mat.name, (mat.map?.image as { width?: number } | undefined)?.width, mat.color.getHexString(), mat.opacity);
        } else if (/Eyebrows|Eyelashes|Hair/i.test(mat.name) && !q.get('debug')) {
          mat.alphaTest = 0.35;
          mat.transparent = false;
          mat.depthWrite = true;
          mat.polygonOffset = true;
          mat.polygonOffsetFactor = -4;
          mat.polygonOffsetUnits = -4;
        }
      }
    });
    scene.add(root);
    if (q.get('log')) {
      root.updateMatrixWorld(true);
      root.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (!m.isMesh) return;
        const bb = new THREE.Box3();
        if (m.isSkinnedMesh) m.computeBoundingBox();
        bb.copy(m.isSkinnedMesh ? m.boundingBox! : new THREE.Box3().setFromObject(m));
        console.log(`MESH ${m.name} skinned=${!!m.isSkinnedMesh} verts=${m.geometry.attributes.position.count} mat=${(m.material as THREE.Material).name} visible=${m.visible} bb=${bb.min.toArray().map((v) => v.toFixed(3))}..${bb.max.toArray().map((v) => v.toFixed(3))}`);
      });
    }
    const animFile = q.get('animfile');
    const animName = q.get('anim');
    if (animFile && animName) {
      const a = await loader.loadAsync(animFile);
      const clip = a.animations.find((c) => c.name === animName) ?? a.animations[0];
      const mixer = new THREE.AnimationMixer(root);
      mixer.clipAction(clip).play();
      mixer.setTime(Number(q.get('t') ?? 0) * clip.duration);
    }
  }
  renderer.render(scene, cam);
  (window as unknown as { __ready: boolean }).__ready = true;
})().catch((e) => {
  document.body.innerHTML = `<pre style="color:#f88">${String(e)}</pre>`;
  (window as unknown as { __ready: boolean }).__ready = true;
});
