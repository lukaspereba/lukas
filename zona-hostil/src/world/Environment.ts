// Céu com dispersão atmosférica, sol com sombras que acompanham o jogador, neblina e luz ambiente (IBL).

import {
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  MathUtils,
  CubeCamera,
  PMREMGenerator,
  WebGLCubeRenderTarget,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import type { GraphicsSettings } from '../core/Settings';

const SHADOW_CFG = {
  desligado: { size: 0, extent: 0 },
  baixo: { size: 1024, extent: 28 },
  medio: { size: 2048, extent: 40 },
  alto: { size: 4096, extent: 55 },
} as const;

export class Environment {
  readonly sun: DirectionalLight;
  readonly hemi: HemisphereLight;
  readonly sky: Sky;
  readonly sunDir = new Vector3();
  private fog: Fog;

  constructor(
    scene: Scene,
    private renderer: WebGLRenderer,
    elevationDeg = 38,
    azimuthDeg = 140,
  ) {
    this.sky = new Sky();
    this.sky.scale.setScalar(4500);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 4.5;
    u.rayleigh.value = 1.4;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.82;
    // o shader de atmosfera é caro por pixel: renderiza uma vez num cubemap e usa como fundo

    const phi = MathUtils.degToRad(90 - elevationDeg);
    const theta = MathUtils.degToRad(azimuthDeg);
    this.sunDir.setFromSphericalCoords(1, phi, theta);
    u.sunPosition.value.copy(this.sunDir);

    this.sun = new DirectionalLight(0xfff0dc, 3.1);
    this.sun.position.copy(this.sunDir).multiplyScalar(120);
    scene.add(this.sun, this.sun.target);

    this.hemi = new HemisphereLight(0xb9d3ff, 0x4d4535, 0.55);
    scene.add(this.hemi);

    this.fog = new Fog(new Color(0xb8c6d3), 120, 900);
    scene.fog = this.fog;

    // iluminação baseada em imagem a partir do próprio céu
    const pmrem = new PMREMGenerator(renderer);
    const envScene = new Scene();
    const skyCopy = new Sky();
    skyCopy.scale.setScalar(1000);
    skyCopy.material.uniforms.sunPosition.value.copy(this.sunDir);
    Object.assign(skyCopy.material.uniforms.turbidity, { value: u.turbidity.value });
    envScene.add(skyCopy);
    scene.environment = pmrem.fromScene(envScene, 0.02).texture;
    scene.environmentIntensity = 0.45;
    pmrem.dispose();
    const bgScene = new Scene();
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);
    bgScene.add(this.sky);
    const cubeRT = new WebGLCubeRenderTarget(512, { generateMipmaps: false });
    const cubeCam = new CubeCamera(1, 5000, cubeRT);
    cubeCam.update(renderer, bgScene);
    scene.background = cubeRT.texture;
  }

  apply(g: GraphicsSettings): void {
    const cfg = SHADOW_CFG[g.shadows];
    this.renderer.shadowMap.enabled = cfg.size > 0;
    this.sun.castShadow = cfg.size > 0;
    if (cfg.size > 0) {
      const s = this.sun.shadow;
      if (s.mapSize.x !== cfg.size) {
        s.mapSize.set(cfg.size, cfg.size);
        s.map?.dispose();
        (s as unknown as { map: null }).map = null;
      }
      const c = s.camera;
      c.left = -cfg.extent;
      c.right = cfg.extent;
      c.top = cfg.extent;
      c.bottom = -cfg.extent;
      c.near = 1;
      c.far = 400;
      c.updateProjectionMatrix();
      s.bias = -0.0004;
      s.normalBias = 0.04;
    }
    this.fog.near = Math.min(140, g.viewDistance * 0.2);
    this.fog.far = g.viewDistance;
  }

  /** Mantém a caixa de sombra centrada no jogador (alinhada a texels para evitar tremulação). */
  follow(target: Vector3): void {
    const s = this.sun.shadow;
    const texel = (2 * (s.camera.right || 40)) / (s.mapSize.x || 1024);
    const tx = Math.round(target.x / texel) * texel;
    const tz = Math.round(target.z / texel) * texel;
    this.sun.target.position.set(tx, target.y, tz);
    this.sun.position.set(tx, target.y, tz).addScaledVector(this.sunDir, 150);
    this.sun.target.updateMatrixWorld();
  }
}
