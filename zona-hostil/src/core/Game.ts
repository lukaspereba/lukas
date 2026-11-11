// Orquestrador: renderizador, mundo, jogador, câmera, entrada, interface e laço principal.
// Física em passo fixo de 60 Hz com interpolação na renderização.

import {
  ACESFilmicToneMapping,
  AnimationClip,
  Clock,
  Group,
  PCFSoftShadowMap,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CharacterModel, type AnimMeta } from '../anim/CharacterModel';
import { GamepadSource, InputState, KeyboardMouse } from '../input/Input';
import { TouchControls } from '../input/TouchControls';
import { CollisionWorld } from '../physics/CollisionWorld';
import { CameraRig } from '../player/CameraRig';
import { PlayerController, type MoveInput } from '../player/PlayerController';
import { TrainingDummy } from '../player/TrainingDummy';
import { CreditsPanel, Hud, LoadingScreen, PauseMenu, SettingsPanel, TitleScreen } from '../ui/ui';
import { Environment } from '../world/Environment';
import { buildTestRange, loadRangeTextures, type RangeLayout } from '../world/TestRange';
import { createTerrainMaterial, createTerrainMesh, loadTerrainTextures } from '../world/TerrainMesh';
import { SettingsStore, isMobile } from './Settings';

const STEP = 1 / 60;
const ASSET = './assets/';
// extensão dos modelos: .glb (padrão) ou .gltf.json (hospedagens que não servem binários glTF)
const MODEL_EXT: string = import.meta.env.VITE_MODEL_EXT ?? '.glb';
const DOWN = new Vector3(0, -1, 0);
const PLAYER_LAYER = 1;

type Screen = 'loading' | 'title' | 'playing' | 'paused';

export class Game {
  readonly settings = new SettingsStore();
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly rig: CameraRig;
  readonly input = new InputState();
  private env!: Environment;
  private world!: CollisionWorld;
  private layout!: RangeLayout;
  player!: PlayerController;
  private model!: CharacterModel;
  private dummies: TrainingDummy[] = [];
  private kbm: KeyboardMouse;
  private pad: GamepadSource;
  private touch: TouchControls | null = null;
  private hud!: Hud;
  private loading: LoadingScreen;
  private title!: TitleScreen;
  private pause!: PauseMenu;
  private settingsPanel!: SettingsPanel;
  private credits!: CreditsPanel;
  private screen: Screen = 'loading';
  private acc = 0;
  private clock = new Clock();
  private lastRender = 0;
  private fps = 60;
  private crouchHeldPrev = false;
  private hintTimer = 25;
  readonly isTouch: boolean;
  private groundAt = (x: number, z: number, y0: number): number | null => {
    const hit = this.world.raycast(new Vector3(x, y0 + 0.75, z), DOWN, 1.5);
    return hit ? hit.point.y : null;
  };

  constructor(private container: HTMLElement) {
    const s = this.settings.get();
    this.isTouch = isMobile() || new URLSearchParams(location.search).has('touch');
    this.renderer = new WebGLRenderer({ antialias: s.graphics.antialias, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.type = PCFSoftShadowMap;
    this.renderer.domElement.className = 'zh-canvas';
    container.appendChild(this.renderer.domElement);
    this.rig = new CameraRig(innerWidth / innerHeight);
    this.loading = new LoadingScreen(container);

    const sens = () => ({ sens: this.settings.get().controls.sensitivity, invertY: this.settings.get().controls.invertY });
    this.kbm = new KeyboardMouse(this.input, this.renderer.domElement, sens);
    this.pad = new GamepadSource(this.input, sens);

    addEventListener('resize', () => this.resize());
    this.settings.onChange(() => this.applySettings());
    this.resize();
  }

  async start(): Promise<void> {
    try {
      await this.load();
    } catch (e) {
      console.error(e);
      this.loading.error(`Falha ao carregar: ${(e as Error).message}`);
      return;
    }
    this.loading.hide();
    this.buildUi();
    this.setScreen('title');
    const params = new URLSearchParams(location.search);
    if (params.has('autoplay')) this.play();
    this.clock.start();
    this.renderer.setAnimationLoop((t) => this.frame(t));
    (window as unknown as { __zh: unknown }).__zh = this.debugApi();
  }

  private async load(): Promise<void> {
    const r = this.renderer;
    const aniso = Math.min(8, r.capabilities.getMaxAnisotropy());
    this.loading.progress(0.05, 'Texturas do terreno…');
    const [terrainTex, rangeTex] = await Promise.all([
      loadTerrainTextures(`${ASSET}textures/`, aniso),
      loadRangeTextures(`${ASSET}textures/`, aniso),
    ]);
    this.loading.progress(0.2, 'Gerando o Campo de Treinamento…');
    await new Promise((res) => setTimeout(res, 0));
    this.layout = buildTestRange(rangeTex, terrainTex.rock);
    const L = this.layout;
    this.world = new CollisionWorld(L.heightfield);
    this.world.setStatic(L.builder.colliders);
    const terrain = createTerrainMesh(L.heightfield, createTerrainMaterial(terrainTex));
    this.scene.add(terrain, L.builder.group);
    this.env = new Environment(this.scene, r);

    this.loading.progress(0.35, 'Soldados e animações…');
    const loader = new GLTFLoader();
    const [anims, meta] = await Promise.all([
      loader.loadAsync(`${ASSET}characters/anims${MODEL_EXT}`),
      fetch(`${ASSET}characters/anims.json`).then((x) => x.json() as Promise<AnimMeta>),
    ]);
    const clips: AnimationClip[] = anims.animations;
    const variants = ['alfa', 'bravo', 'charlie', 'delta'];
    const scenes: Group[] = [];
    for (let i = 0; i < variants.length; i++) {
      this.loading.progress(0.4 + (i / variants.length) * 0.5, `Soldado ${variants[i].toUpperCase()}…`);
      scenes.push((await loader.loadAsync(`${ASSET}characters/soldier_${variants[i]}${MODEL_EXT}`)).scene);
    }
    this.model = new CharacterModel(scenes[0], clips, meta);
    // corpo do jogador na camada 1: a câmera em 1ª pessoa não o desenha, mas a sombra continua
    this.model.setLayer(PLAYER_LAYER);
    this.env.sun.shadow.camera.layers.enable(PLAYER_LAYER);
    this.scene.add(this.model.root);
    this.player = new PlayerController(this.world, L.spawn.clone(), L.spawnYaw);

    // manequins de treinamento: parado, patrulha (andando) e corrida em circuito
    const g = (x: number, z: number) => new Vector3(x, L.heightfield.heightAt(x, z) + 0.05, z);
    const mk = (i: number) => {
      const m = new CharacterModel(scenes[i], clips, meta);
      this.scene.add(m.root);
      return m;
    };
    const idle = new TrainingDummy(mk(1), this.world, g(4, 26));
    idle.yaw = Math.PI * 0.8;
    const patrol = new TrainingDummy(mk(2), this.world, g(-8, 12), [g(-8, 12), g(8, 12)], 1.5, 2.0);
    const jog = new TrainingDummy(mk(3), this.world, g(-14, 40), [g(-14, 40), g(-14, 58), g(14, 58), g(14, 40)], 3.6, 0.2);
    this.dummies.push(idle, patrol, jog);

    this.loading.progress(0.95, 'Compilando shaders…');
    this.applySettings();
    this.updateModels(0, 1);
    this.rig.update(0, 1, this.player, this.settings.get().gameplay, this.world);
    r.compile(this.scene, this.rig.camera);
    this.loading.progress(1, 'Pronto');
  }

  private buildUi(): void {
    const c = this.container;
    this.hud = new Hud(c, this.isTouch);
    this.hud.show(false);
    if (this.isTouch) {
      this.touch = new TouchControls(this.input, c, () => ({ touch: this.settings.get().controls.touchSensitivity, invertY: this.settings.get().controls.invertY }));
      this.touch.setVisible(false);
    }
    this.settingsPanel = new SettingsPanel(c, this.settings);
    this.credits = new CreditsPanel(c);
    this.title = new TitleScreen(c, {
      play: () => this.play(),
      settings: () => this.settingsPanel.open(() => undefined),
      credits: () => this.credits.open(),
    });
    this.pause = new PauseMenu(c, {
      resume: () => this.resume(),
      settings: () => this.settingsPanel.open(() => undefined),
      respawn: () => {
        this.player.respawn(this.layout.spawn.clone(), this.layout.spawnYaw);
        this.resume();
      },
      quit: () => this.setScreen('title'),
    });
    this.renderer.domElement.addEventListener('click', () => {
      if (this.screen === 'playing' && !this.isTouch && !this.kbm.locked) this.kbm.requestLock();
    });
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.screen === 'playing' && !this.isTouch) this.setScreen('paused');
    });
  }

  play(): void {
    this.setScreen('playing');
    if (!this.isTouch) this.kbm.requestLock();
    this.hud.toast(this.isTouch ? 'Joystick à esquerda · arraste à direita para olhar' : 'Clique para capturar o mouse', 3);
  }

  resume(): void {
    this.setScreen('playing');
    if (!this.isTouch) this.kbm.requestLock();
  }

  private setScreen(s: Screen): void {
    this.screen = s;
    this.title?.show(s === 'title');
    this.pause?.show(s === 'paused');
    this.hud?.show(s === 'playing');
    this.touch?.setVisible(s === 'playing');
    if (s !== 'playing') {
      this.input.releaseAll();
      if (document.pointerLockElement) document.exitPointerLock();
    }
    this.acc = 0;
  }

  private resize(): void {
    const s = this.settings.get();
    const dpr = Math.min(devicePixelRatio || 1, 2) * s.graphics.renderScale;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(innerWidth, innerHeight);
    this.rig.resize(innerWidth / innerHeight);
  }

  private applySettings(): void {
    const s = this.settings.get();
    this.resize();
    this.env?.apply(s.graphics);
    this.rig.camera.far = s.graphics.viewDistance + 500;
    this.rig.camera.updateProjectionMatrix();
    this.rig.mode = s.gameplay.camera;
  }

  private frame(nowMs: number): void {
    const s = this.settings.get();
    if (s.graphics.fpsLimit > 0 && nowMs - this.lastRender < 1000 / s.graphics.fpsLimit - 1.5) return;
    const dt = Math.min(0.1, this.clock.getDelta() + 0);
    this.lastRender = nowMs;
    this.fps += (1 / Math.max(dt, 1e-3) - this.fps) * 0.05;
    this.pad.update(dt);
    this.kbm.update();

    if (this.screen === 'playing') {
      if (this.input.consume('pause')) {
        this.setScreen('paused');
      } else {
        if (this.input.consume('camera')) {
          this.settings.update((x) => (x.gameplay.camera = x.gameplay.camera === 'fps' ? 'tps' : 'fps'));
          this.hud.toast(this.settings.get().gameplay.camera === 'fps' ? 'Primeira pessoa' : 'Terceira pessoa', 1.2);
        }
        const look = this.input.takeLook();
        this.player.look(look.yaw, look.pitch);
        this.acc += dt;
        let steps = 0;
        while (this.acc >= STEP && steps < 6) {
          this.fixedUpdate(STEP);
          this.acc -= STEP;
          steps++;
        }
        if (steps === 6) this.acc = 0;
      }
    } else {
      this.input.takeLook();
      this.input.consume('pause');
      // menus: personagens continuam animando ao fundo
      for (const d of this.dummies) d.fixedUpdate(dt);
    }
    const alpha = this.screen === 'playing' ? this.acc / STEP : 1;
    this.updateModels(dt, alpha);
    this.rig.update(dt, alpha, this.player, s.gameplay, this.world);
    this.env.follow(this.rig.feet);
    this.player.justLanded = false;
    this.player.justJumped = false;
    if (this.screen === 'playing') this.updateHud(dt);
    if (this.screen === 'title') this.titleCamera(nowMs);
    this.renderer.render(this.scene, this.rig.camera);
  }

  private fixedUpdate(dt: number): void {
    const s = this.settings.get();
    const inp = this.input;
    let crouch = inp.consume('crouch');
    if (!s.controls.toggleCrouch) {
      const held = inp.isDown('crouch');
      crouch = held !== this.crouchHeldPrev && (held ? this.player.stance !== 'crouch' : this.player.stance === 'crouch');
      this.crouchHeldPrev = held;
    }
    const mi: MoveInput = {
      moveX: inp.moveX,
      moveY: inp.moveY,
      lookYaw: 0,
      lookPitch: 0,
      sprint: inp.isDown('sprint') || inp.sprintLatch,
      jump: inp.consume('jump'),
      crouch,
      crouchHeld: inp.isDown('crouch'),
      prone: inp.consume('prone'),
    };
    const wasJ = this.player.justJumped;
    const wasL = this.player.justLanded;
    this.player.update(dt, mi);
    // eventos de um passo ficam válidos até o próximo quadro renderizado
    this.player.justJumped ||= wasJ;
    this.player.justLanded ||= wasL;
    if (this.touch && this.player.stance !== 'stand' && inp.sprintLatch && !this.player.sprinting && mi.moveY < 0.3) {
      inp.sprintLatch = false;
      this.touch.setSprintIndicator(false);
    }
    for (const d of this.dummies) d.fixedUpdate(dt);
    // caiu para fora do mapa: volta ao início
    if (this.player.position.y < -60) this.player.respawn(this.layout.spawn.clone(), this.layout.spawnYaw);
  }

  private updateModels(dt: number, alpha: number): void {
    const p = this.player;
    const fps = this.rig.mode === 'fps';
    const root = this.model.root;
    root.position.lerpVectors(p.prevPosition, p.position, alpha);
    root.rotation.y = p.yaw + Math.PI;
    // 1ª pessoa: o corpo completo atrapalharia a visão (braços de "viewmodel" chegam com as armas, fase 3)
    if (fps) this.rig.camera.layers.disable(PLAYER_LAYER);
    else this.rig.camera.layers.enable(PLAYER_LAYER);
    const lv = p.localVelocity();
    this.model.update(dt, {
      velX: lv.x,
      velZ: lv.z,
      crouch: p.crouchBlend,
      prone: p.proneBlend,
      grounded: p.motor.grounded,
      airTime: p.motor.airTime,
      vy: p.motor.velocity.y,
      slide: p.slideBlend,
      mantle: p.mantleProgress,
      aimPitch: p.pitch,
      hideHead: fps,
      justJumped: p.justJumped,
      justLanded: p.justLanded,
      groundAt: this.groundAt,
    });
    for (const d of this.dummies) d.frameUpdate(dt, alpha, this.groundAt);
  }

  private titleCamera(now: number): void {
    // câmera cinematográfica orbitando o esquadrão na tela inicial
    const t = now * 0.00006;
    const c = this.rig.camera;
    const center = new Vector3(0, this.layout.spawn.y + 1.2, 26);
    c.position.set(center.x + Math.sin(t) * 7.5, center.y + 0.6, center.z + Math.cos(t) * 7.5);
    c.lookAt(center);
  }

  private updateHud(dt: number): void {
    const p = this.player;
    const s = this.settings.get();
    const v = p.motor.velocity;
    this.hintTimer -= dt;
    const hint =
      this.hintTimer > 0 && !this.isTouch
        ? 'WASD mover · Mouse olhar · Shift sprint · Espaço pular/escalar · C agachar (em sprint: deslizar) · Z deitar · V câmera · Esc pausa · 1-4 locais de teste'
        : '';
    this.hud.update(dt, {
      stance: p.stance,
      state: p.state,
      speed: Math.hypot(v.x, v.z),
      sprint: p.sprinting,
      fps: this.fps,
      showFps: s.gameplay.showFps,
      camera: this.rig.mode.toUpperCase(),
      hint,
      debug: s.gameplay.showDebug
        ? `pos ${p.position.x.toFixed(1)} ${p.position.y.toFixed(2)} ${p.position.z.toFixed(1)}\n` +
          `chão ${p.motor.grounded ? 'sim' : 'não'} · normal.y ${p.motor.groundNormal.y.toFixed(2)}\n` +
          `yaw ${(p.yaw * 57.3).toFixed(0)}° pitch ${(p.pitch * 57.3).toFixed(0)}°\n` +
          `triângulos de colisão ${this.world.triangleCount}\n` +
          `draw calls ${this.renderer.info.render.calls} · tris ${(this.renderer.info.render.triangles / 1000).toFixed(0)}k`
        : null,
    });
  }

  teleport(name: string): void {
    const pt = this.layout.points[name];
    if (pt) this.player.respawn(pt.clone().add(new Vector3(0, 0.3, 0)), this.player.yaw);
  }

  /** API para testes automatizados e depuração no console. */
  private debugApi() {
    return {
      ready: true,
      game: this,
      state: () => ({
        screen: this.screen,
        pos: this.player.position.toArray(),
        vel: this.player.motor.velocity.toArray(),
        grounded: this.player.motor.grounded,
        stance: this.player.stance,
        state: this.player.state,
        sprinting: this.player.sprinting,
        yaw: this.player.yaw,
        pitch: this.player.pitch,
        camera: this.rig.mode,
        eye: this.player.eyeHeight,
      }),
      play: () => this.play(),
      teleport: (n: string) => this.teleport(n),
      setLook: (yaw: number, pitch: number) => {
        this.player.yaw = yaw;
        this.player.pitch = pitch;
      },
      setCamera: (m: 'fps' | 'tps') => this.settings.update((x) => (x.gameplay.camera = m)),
      points: () => Object.fromEntries(Object.entries(this.layout.points).map(([k, v]) => [k, v.toArray()])),
    };
  }
}

// teclas 1-4: atalhos de teste do campo de treinamento
addEventListener('keydown', (e) => {
  const api = (window as unknown as { __zh?: { teleport: (n: string) => void } }).__zh;
  const map: Record<string, string> = { Digit1: 'casa', Digit2: 'obstaculos', Digit3: 'rampas', Digit4: 'colina' };
  if (api && map[e.code]) api.teleport(map[e.code]);
});
