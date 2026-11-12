// Orquestrador: renderizador, mundo, jogador, câmera, entrada, interface e laço principal.
// Física em passo fixo de 60 Hz com interpolação na renderização.

import {
  ACESFilmicToneMapping,
  AnimationClip,
  Clock,
  Box3,
  Group,
  Mesh,
  MeshStandardMaterial,
  PCFShadowMap,
  PCFSoftShadowMap,
  SRGBColorSpace,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadModel } from './loadModel';
import { CharacterModel, type AnimMeta } from '../anim/CharacterModel';
import { GamepadSource, InputState, KeyboardMouse } from '../input/Input';
import { TouchControls } from '../input/TouchControls';
import { CollisionWorld } from '../physics/CollisionWorld';
import { CameraRig } from '../player/CameraRig';
import { PlayerController, type MoveInput } from '../player/PlayerController';
import { TrainingDummy } from '../player/TrainingDummy';
import { CreditsPanel, Hud, LoadingScreen, PauseMenu, SettingsPanel, TitleScreen } from '../ui/ui';
import { Environment } from '../world/Environment';
import { buildTestRange, loadRangeTextures } from '../world/TestRange';
import { buildCarapicuiba } from '../world/city/CityMap';
import type { Heightfield } from '../world/Heightfield';
import { mergeStatic } from '../world/Builder';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { DevPanel, attachLogoTaps, type DevState } from '../ui/DevMode';
import { createTerrainMaterial, createTerrainMesh, loadTerrainTextures, setTerrainQuality } from '../world/TerrainMesh';
import { SettingsStore, isMobile } from './Settings';

const STEP = 1 / 60;
const ASSET = './assets/';
// extensão dos modelos: .glb (padrão) ou .gltf.json (hospedagens que não servem binários glTF)
const MODEL_EXT: string = import.meta.env.VITE_MODEL_EXT ?? '.glb';
const DOWN = new Vector3(0, -1, 0);
const PLAYER_LAYER = 1;

type MapId = 'carapicuiba' | 'treino';
interface MapLayout {
  id: MapId;
  heightfield: Heightfield;
  group: Group;
  colliders: Mesh[];
  spawn: Vector3;
  spawnYaw: number;
  points: Record<string, Vector3>;
  chunk: number;
  titleFocus: Vector3;
  dummies: Array<{ at: Vector3; route: Vector3[]; speed?: number }>;
  interiors: Box3[];
}

type Screen = 'loading' | 'title' | 'playing' | 'paused';

export class Game {
  readonly settings = new SettingsStore();
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly rig: CameraRig;
  readonly input = new InputState();
  private env!: Environment;
  private world!: CollisionWorld;
  private layout!: MapLayout;
  private mapRoot: Group | null = null;
  private aniso = 4;
  private terrainTex!: Awaited<ReturnType<typeof loadTerrainTextures>>;
  private rangeTex!: Awaited<ReturnType<typeof loadRangeTextures>>;
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
  private fps = 0;
  private frameTimes: number[] = [];
  private crouchHeldPrev = false;
  /** fator da resolução dinâmica (0.5..1) e cronômetro de avaliação */
  private dynScale = 1;
  readonly dev: DevState = { unlocked: false, fly: false, speedMul: 1, showPerf: false, infiniteAmmo: false, godMode: false };
  private devPanel!: DevPanel;
  private assetsChar!: { clips: AnimationClip[]; meta: AnimMeta; scenes: Group[]; variants: string[] };
  private skinSources: Group[] = [];
  private terrainMat?: MeshStandardMaterial;
  /** direção do corpo do jogador (pode diferir da câmera em 3ª pessoa) */
  private bodyYaw = 0;
  private indoor = 0;
  private perfTimer = 0;
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
    this.renderer.toneMappingExposure = 0.88;
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

  /** Monta um mapa (Carapicuíba ou Campo de Treinamento), trocando colisão, render e manequins. */
  async setMap(id: MapId): Promise<void> {
    let L: MapLayout;
    if (id === 'treino') {
      const r = buildTestRange(this.rangeTex, this.terrainTex.rock);
      const g = (x: number, z: number) => new Vector3(x, r.heightfield.heightAt(x, z) + 0.05, z);
      L = {
        id, heightfield: r.heightfield, group: r.builder.group, colliders: r.builder.colliders, spawn: r.spawn, spawnYaw: r.spawnYaw, points: r.points,
        chunk: Infinity, titleFocus: new Vector3(0, r.spawn.y + 1.2, 26), interiors: [],
        dummies: [{ at: g(4, 26), route: [] }, { at: g(-8, 12), route: [g(-8, 12), g(8, 12)], speed: 1.5 }, { at: g(-14, 40), route: [g(-14, 40), g(-14, 58), g(14, 58), g(14, 40)], speed: 3.6 }],
      };
    } else {
      const c = await buildCarapicuiba(ASSET, this.aniso, null);
      const hf = c.heightfield;
      const g = (x: number, z: number) => new Vector3(x, hf.heightAt(x, z) + 0.3, z);
      const sp = c.spawn;
      L = {
        id, heightfield: hf, group: c.group, colliders: c.colliders, spawn: sp, spawnYaw: c.spawnYaw, points: c.points, chunk: 140, interiors: c.interiors,
        titleFocus: sp.clone().add(new Vector3(0, 1.2, -3)),
        dummies: [
          { at: g(sp.x + 4, sp.z - 4), route: [] },
          { at: g(-60, -36), route: [g(-60, -36), g(30, -36)], speed: 1.5 },
          { at: g(-44, -30), route: [g(-44, -30), g(8, -30), g(8, -22), g(-44, -22)], speed: 3.6 },
        ],
      };
      console.info('[mapa] Carapicuíba', c.stats);
    }
    if (this.mapRoot) {
      this.scene.remove(this.mapRoot);
      this.mapRoot.traverse((o) => (o as Mesh).geometry?.dispose());
    }
    const root = new Group();
    root.name = `Mapa:${id}`;
    root.add(createTerrainMesh(L.heightfield, this.terrainMat!), mergeStatic(L.group, L.chunk));
    this.scene.add(root);
    this.mapRoot = root;
    this.world = new CollisionWorld(L.heightfield);
    this.world.setStatic(L.colliders);
    this.layout = L;
    if (this.player) {
      this.player.world = this.world;
      this.player.motor.world = this.world;
      this.player.respawn(L.spawn.clone(), L.spawnYaw);
    } else {
      this.player = new PlayerController(this.world, L.spawn.clone(), L.spawnYaw);
    }
    this.bodyYaw = L.spawnYaw;
    for (const d of this.dummies) this.scene.remove(d.model.root);
    this.dummies = [];
    const { clips, meta } = this.assetsChar;
    L.dummies.forEach((d, i) => {
      const m = new CharacterModel(SkeletonUtils.clone(this.skinSources[1 + (i % 3)]) as Group, clips, meta);
      this.scene.add(m.root);
      const t = new TrainingDummy(m, this.world, d.at.clone(), d.route, d.speed ?? 1.5, d.route.length ? 1.0 : 0);
      if (!d.route.length) t.yaw = this.layout.spawnYaw + Math.PI;
      this.dummies.push(t);
    });
  }

  private async load(): Promise<void> {
    const r = this.renderer;
    const aniso = Math.min(8, r.capabilities.getMaxAnisotropy());
    this.aniso = aniso;
    this.loading.progress(0.05, 'Texturas do terreno…');
    const [terrainTex, rangeTex] = await Promise.all([
      loadTerrainTextures(`${ASSET}textures/`, aniso),
      loadRangeTextures(`${ASSET}textures/`, aniso),
    ]);
    this.terrainTex = terrainTex;
    this.rangeTex = rangeTex;
    this.terrainMat = createTerrainMaterial(terrainTex);
    this.env = new Environment(this.scene, r);
    this.loading.progress(0.35, 'Soldados e animações…');
    const loader = new GLTFLoader();
    const [anims, meta] = await Promise.all([
      loadModel(loader, `${ASSET}characters/anims${MODEL_EXT}`),
      fetch(`${ASSET}characters/anims.json`).then((x) => x.json() as Promise<AnimMeta>),
    ]);
    const clips: AnimationClip[] = anims.animations;
    const variants = ['alfa', 'bravo', 'charlie', 'delta'];
    const scenes: Group[] = [];
    this.assetsChar = { clips, meta, scenes, variants };
    for (let i = 0; i < variants.length; i++) {
      this.loading.progress(0.4 + (i / variants.length) * 0.5, `Soldado ${variants[i].toUpperCase()}…`);
      scenes.push((await loadModel(loader, `${ASSET}characters/soldier_${variants[i]}${MODEL_EXT}`)).scene);
    }
    // cópias em pose de bind (antes de qualquer animação) para manequins extras e troca de personagem
    for (let i = 0; i < scenes.length; i++) this.skinSources.push(SkeletonUtils.clone(scenes[i]) as Group);
    this.model = new CharacterModel(scenes[0], clips, meta);
    // corpo do jogador na camada 1: a câmera em 1ª pessoa não o desenha, mas a sombra continua
    this.model.setLayer(PLAYER_LAYER);
    this.env.sun.shadow.camera.layers.enable(PLAYER_LAYER);
    this.scene.add(this.model.root);
    const initial = new URLSearchParams(location.search).get('mapa') === 'treino' ? 'treino' : 'carapicuiba';
    this.loading.progress(0.9, initial === 'treino' ? 'Gerando o Campo de Treinamento…' : 'Construindo Carapicuíba…');
    await this.setMap(initial);

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
      play: () => void this.playMap('carapicuiba'),
      train: () => void this.playMap('treino'),
      settings: () => this.settingsPanel.open(() => undefined),
      credits: () => this.credits.open(),
    });
    this.devPanel = new DevPanel(c, this.dev, {
      teleport: (n) => {
        this.teleport(n);
        if (this.screen === 'paused') this.resume();
      },
      places: () => Object.keys(this.layout.points),
      skins: () => this.assetsChar.variants.map((v) => v.toUpperCase()),
      setSkin: (i) => this.setPlayerSkin(i),
      addDummy: () => this.addDummy(),
      removeDummy: () => this.removeDummy(),
      dummyCount: () => this.dummies.length,
      onChange: () => this.applyDev(),
    });
    attachLogoTaps(this.title.el.querySelector('.zh-logo') as HTMLElement, c, () => {
      this.dev.unlocked = true;
      this.applyDev();
      this.devPanel.open();
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
    for (const menu of [this.title.el, this.pause.el]) {
      const b = document.createElement('button');
      b.className = 'dev';
      b.textContent = 'DESENVOLVEDOR';
      b.dataset.dev = '1';
      b.style.display = 'none';
      b.addEventListener('click', () => this.devPanel.open());
      menu.querySelector('.zh-menu')?.appendChild(b);
    }
    this.renderer.domElement.addEventListener('click', () => {
      if (this.screen === 'playing' && !this.isTouch && !this.kbm.locked) this.kbm.requestLock();
    });
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && this.screen === 'playing' && !this.isTouch) this.setScreen('paused');
    });
  }

  /** Aplica o estado do modo desenvolvedor (só tem efeito com o acesso liberado). */
  private applyDev(): void {
    const d = this.dev;
    const on = d.unlocked;
    this.player.fly = on && d.fly;
    this.player.speedMul = on ? d.speedMul : 1;
    this.container.querySelectorAll<HTMLButtonElement>('button[data-dev]').forEach((b) => (b.style.display = on ? 'block' : 'none'));
    if (!on || !d.showPerf) this.hud?.setPerf(null);
  }

  private setPlayerSkin(i: number): void {
    const src = this.skinSources[i];
    if (!src) return;
    this.scene.remove(this.model.root);
    const { clips, meta } = this.assetsChar;
    this.model = new CharacterModel(SkeletonUtils.clone(src) as Group, clips, meta);
    this.model.setLayer(PLAYER_LAYER);
    this.scene.add(this.model.root);
    this.hud?.toast(`Personagem: ${this.assetsChar.variants[i].toUpperCase()}`, 1.5);
  }

  private addDummy(): void {
    const { clips, meta } = this.assetsChar;
    const i = 1 + (this.dummies.length % 3);
    const m = new CharacterModel(SkeletonUtils.clone(this.skinSources[i]) as Group, clips, meta);
    this.scene.add(m.root);
    const p = this.player.position;
    const f = this.player.forward(new Vector3());
    const a = p.clone().addScaledVector(f, 6);
    const b = a.clone().add(new Vector3(f.z * 6, 0, -f.x * 6));
    for (const q of [a, b]) q.y = this.world.groundHeight(q.x, q.z) + 0.1;
    this.dummies.push(new TrainingDummy(m, this.world, a.clone(), [a, b], 1.5 + Math.random() * 2, 0.8));
  }

  private removeDummy(): void {
    const d = this.dummies.pop();
    if (d) this.scene.remove(d.model.root);
  }

  /** Inicia o jogo no mapa pedido (monta o mapa se ainda não estiver carregado). */
  async playMap(id: MapId): Promise<void> {
    if (this.layout.id !== id) {
      const ls = new LoadingScreen(this.container);
      ls.progress(0.5, id === 'treino' ? 'Gerando o Campo de Treinamento…' : 'Construindo Carapicuíba…');
      await new Promise((r) => setTimeout(r, 30));
      await this.setMap(id);
      ls.hide();
    }
    this.play();
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
    const dpr = Math.min(devicePixelRatio || 1, 2) * s.graphics.renderScale * (s.graphics.dynamicRes ? this.dynScale : 1);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(innerWidth, innerHeight);
    this.rig.resize(innerWidth / innerHeight);
  }

  /** Resolução dinâmica: reduz/aumenta a escala de renderização para manter o FPS-alvo. */
  private adaptResolution(dt: number): void {
    const g = this.settings.get().graphics;
    if (!g.dynamicRes || this.screen !== 'playing') return;
    this.perfTimer += dt;
    if (this.perfTimer < 1.5) return;
    this.perfTimer = 0;
    const target = g.fpsLimit > 0 ? Math.min(g.fpsLimit, 60) : 60;
    if (this.fps < target * 0.85 && this.dynScale > 0.5) {
      this.dynScale = Math.max(0.5, this.dynScale - 0.1);
      this.resize();
    } else if (this.fps > target * 0.97 && this.dynScale < 1) {
      this.dynScale = Math.min(1, this.dynScale + 0.05);
      this.resize();
    }
  }

  private applySettings(): void {
    const s = this.settings.get();
    this.resize();
    this.env?.apply(s.graphics);
    if (this.terrainMat) setTerrainQuality(this.terrainMat, s.graphics.preset, s.graphics.shadows);
    // filtro de sombra suave só no perfil alto (PCF simples é bem mais barato em GPUs de celular)
    this.renderer.shadowMap.type = s.graphics.shadows === 'alto' ? PCFSoftShadowMap : PCFShadowMap;
    this.rig.camera.far = s.graphics.viewDistance + 500;
    this.rig.camera.updateProjectionMatrix();
    this.rig.mode = s.gameplay.camera;
  }

  private frame(nowMs: number): void {
    const s = this.settings.get();
    if (s.graphics.fpsLimit > 0 && nowMs - this.lastRender < 1000 / s.graphics.fpsLimit - 1.5) return;
    const dt = Math.min(0.1, this.clock.getDelta() + 0);
    this.lastRender = nowMs;
    // FPS real: quadros renderizados no último segundo (a média exponencial anterior enganava com quadros lentos)
    this.frameTimes.push(nowMs);
    while (this.frameTimes.length && nowMs - this.frameTimes[0] > 1000) this.frameTimes.shift();
    this.fps = this.frameTimes.length > 1 ? ((this.frameTimes.length - 1) * 1000) / (nowMs - this.frameTimes[0]) : 0;
    this.adaptResolution(dt);
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
    // luz ambiente menor dentro de construções cobertas
    const inside = this.layout.interiors.some((b) => b.containsPoint(this.rig.camera.position));
    this.indoor += ((inside ? 1 : 0) - this.indoor) * Math.min(1, dt * 3);
    this.env.setIndoor(this.indoor);
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
      jumpHeld: inp.isDown('jump'),
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
    // Orientação do corpo: em 1ª pessoa (ou mirando/deitado) segue a câmera; em 3ª pessoa o corpo
    // vira para a direção do movimento e a cabeça acompanha a câmera (sem torcer quadril e pernas).
    const v = p.motor.velocity;
    const speed = Math.hypot(v.x, v.z);
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
    const followCam = fps || p.stance === 'prone' || this.input.isDown('aim') || p.state === 'mantle';
    if (followCam) this.bodyYaw = p.yaw;
    else if (speed > 0.4) {
      const moveYaw = Math.atan2(-v.x, -v.z);
      // andando de ré em relação à câmera: mantém o corpo de frente e usa a animação de ré
      const back = Math.abs(wrap(moveYaw - p.yaw)) > 2.0;
      const target = back ? p.yaw : moveYaw;
      this.bodyYaw += wrap(target - this.bodyYaw) * Math.min(1, dt * 10);
    } else if (Math.abs(wrap(p.yaw - this.bodyYaw)) > 1.6) {
      // parado: só gira o corpo quando a câmera passa muito do limite da cabeça
      this.bodyYaw += wrap(p.yaw - this.bodyYaw) * Math.min(1, dt * 4);
    }
    this.bodyYaw = wrap(this.bodyYaw);
    root.rotation.y = this.bodyYaw + Math.PI;
    // 1ª pessoa: o corpo completo atrapalharia a visão (braços de "viewmodel" chegam com as armas)
    if (fps) this.rig.camera.layers.disable(PLAYER_LAYER);
    else this.rig.camera.layers.enable(PLAYER_LAYER);
    const fx = -Math.sin(this.bodyYaw);
    const fz = -Math.cos(this.bodyYaw);
    this.model.update(dt, {
      velX: v.x * -fz + v.z * fx,
      velZ: v.x * fx + v.z * fz,
      crouch: p.crouchBlend,
      prone: p.proneBlend,
      grounded: p.motor.grounded,
      airTime: p.motor.airTime,
      vy: p.motor.velocity.y,
      slide: p.slideBlend,
      mantle: p.mantleProgress,
      aimPitch: p.pitch,
      aimYaw: wrap(p.yaw - this.bodyYaw),
      hideHead: fps,
      justJumped: p.justJumped,
      justLanded: p.justLanded,
      groundAt: this.groundAt,
    });
    const cam = this.rig.camera.position;
    for (const d of this.dummies) {
      const dist = d.model.root.position.distanceTo(cam);
      // longe: sem sombra; muito longe: sem atualizar animação nem desenhar
      d.model.setCastShadow(dist < 30);
      const vis = dist < this.settings.get().graphics.viewDistance * 0.5;
      d.model.root.visible = vis;
      if (vis) d.frameUpdate(dt, alpha, this.groundAt);
    }
  }

  private titleCamera(now: number): void {
    // câmera cinematográfica orbitando o esquadrão na tela inicial
    const t = now * 0.00006;
    const c = this.rig.camera;
    const center = this.layout.titleFocus;
    c.position.set(center.x + Math.sin(t) * 7.5, center.y + 0.6, center.z + Math.cos(t) * 7.5);
    c.lookAt(center);
  }

  private perfSamples: number[] = [];

  private updatePerf(dt: number): void {
    if (!this.dev.unlocked || !this.dev.showPerf) return;
    this.perfSamples.push(dt * 1000);
    if (this.perfSamples.length > 60) this.perfSamples.shift();
    const avg = this.perfSamples.reduce((a, b) => a + b, 0) / this.perfSamples.length;
    const worst = Math.max(...this.perfSamples);
    const inf = this.renderer.info;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    this.hud.setPerf(
      `${avg.toFixed(1)} ms (pior ${worst.toFixed(0)}) · ${(1000 / avg).toFixed(0)} FPS\n` +
        `draw calls ${inf.render.calls} · ${(inf.render.triangles / 1000).toFixed(0)}k tri\n` +
        `geometrias ${inf.memory.geometries} · texturas ${inf.memory.textures}\n` +
        `resolução ${(this.renderer.getPixelRatio() * 100).toFixed(0)}% · ${this.renderer.domElement.width}×${this.renderer.domElement.height}` +
        (mem ? `\nJS ${(mem.usedJSHeapSize / 1048576).toFixed(0)} MB` : ''),
    );
  }

  private updateHud(dt: number): void {
    this.updatePerf(dt);
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
