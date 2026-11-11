// Configurações persistentes (localStorage) com esquema versionado e validação.
// Todos os campos têm limites; valores inválidos ou ausentes voltam ao padrão.

export type QualityPreset = 'baixo' | 'medio' | 'alto' | 'personalizado';
export type CameraMode = 'fps' | 'tps';

export interface GraphicsSettings {
  preset: QualityPreset;
  renderScale: number; // 0.5..1 (multiplica devicePixelRatio)
  shadows: 'desligado' | 'baixo' | 'medio' | 'alto';
  viewDistance: number; // metros
  antialias: boolean;
  fpsLimit: number; // 0 = sem limite
}

export interface ControlSettings {
  sensitivity: number; // multiplicador geral
  aimSensitivity: number; // durante a mira (fase 3)
  touchSensitivity: number;
  invertY: boolean;
  toggleCrouch: boolean;
  gyro: boolean;
}

export interface GameplaySettings {
  camera: CameraMode;
  fov: number; // graus, horizontal (referência 16:9)
  headBob: number; // 0..1
  showFps: boolean;
  showDebug: boolean;
}

export interface AudioSettings {
  master: number;
  music: number;
  effects: number;
  weapons: number;
  ambient: number;
  ui: number;
}

export interface Settings {
  version: number;
  graphics: GraphicsSettings;
  controls: ControlSettings;
  gameplay: GameplaySettings;
  audio: AudioSettings;
}

export const SETTINGS_VERSION = 1;
const KEY = 'zona-hostil.settings';

export const PRESETS: Record<Exclude<QualityPreset, 'personalizado'>, Omit<GraphicsSettings, 'preset' | 'fpsLimit'>> = {
  baixo: { renderScale: 0.6, shadows: 'baixo', viewDistance: 350, antialias: false },
  medio: { renderScale: 0.8, shadows: 'medio', viewDistance: 700, antialias: false },
  alto: { renderScale: 1.0, shadows: 'alto', viewDistance: 1400, antialias: true },
};

export function isMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints ?? 0) > 1;
}

export function defaultSettings(mobile = isMobile()): Settings {
  const preset: QualityPreset = mobile ? 'medio' : 'alto';
  return {
    version: SETTINGS_VERSION,
    graphics: { preset, ...PRESETS[preset], fpsLimit: mobile ? 60 : 0 },
    controls: { sensitivity: 1, aimSensitivity: 0.7, touchSensitivity: 1, invertY: false, toggleCrouch: true, gyro: false },
    gameplay: { camera: 'fps', fov: 90, headBob: 0.6, showFps: true, showDebug: false },
    audio: { master: 0.8, music: 0.5, effects: 0.9, weapons: 0.9, ambient: 0.7, ui: 0.7 },
  };
}

const clamp = (v: unknown, lo: number, hi: number, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const oneOf = <T extends string>(v: unknown, opts: readonly T[], d: T): T => (opts.includes(v as T) ? (v as T) : d);

/** Valida um objeto arbitrário (ex.: vindo do localStorage) contra o esquema. */
export function sanitize(raw: unknown, mobile = isMobile()): Settings {
  const d = defaultSettings(mobile);
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<Record<keyof Settings, Record<string, unknown>>>;
  const g = r.graphics ?? {};
  const c = r.controls ?? {};
  const p = r.gameplay ?? {};
  const a = r.audio ?? {};
  return {
    version: SETTINGS_VERSION,
    graphics: {
      preset: oneOf(g.preset, ['baixo', 'medio', 'alto', 'personalizado'] as const, d.graphics.preset),
      renderScale: clamp(g.renderScale, 0.4, 1.0, d.graphics.renderScale),
      shadows: oneOf(g.shadows, ['desligado', 'baixo', 'medio', 'alto'] as const, d.graphics.shadows),
      viewDistance: clamp(g.viewDistance, 150, 3000, d.graphics.viewDistance),
      antialias: bool(g.antialias, d.graphics.antialias),
      fpsLimit: clamp(g.fpsLimit, 0, 240, d.graphics.fpsLimit),
    },
    controls: {
      sensitivity: clamp(c.sensitivity, 0.1, 5, d.controls.sensitivity),
      aimSensitivity: clamp(c.aimSensitivity, 0.1, 3, d.controls.aimSensitivity),
      touchSensitivity: clamp(c.touchSensitivity, 0.1, 5, d.controls.touchSensitivity),
      invertY: bool(c.invertY, d.controls.invertY),
      toggleCrouch: bool(c.toggleCrouch, d.controls.toggleCrouch),
      gyro: bool(c.gyro, d.controls.gyro),
    },
    gameplay: {
      camera: oneOf(p.camera, ['fps', 'tps'] as const, d.gameplay.camera),
      fov: clamp(p.fov, 70, 115, d.gameplay.fov),
      headBob: clamp(p.headBob, 0, 1, d.gameplay.headBob),
      showFps: bool(p.showFps, d.gameplay.showFps),
      showDebug: bool(p.showDebug, d.gameplay.showDebug),
    },
    audio: {
      master: clamp(a.master, 0, 1, d.audio.master),
      music: clamp(a.music, 0, 1, d.audio.music),
      effects: clamp(a.effects, 0, 1, d.audio.effects),
      weapons: clamp(a.weapons, 0, 1, d.audio.weapons),
      ambient: clamp(a.ambient, 0, 1, d.audio.ambient),
      ui: clamp(a.ui, 0, 1, d.audio.ui),
    },
  };
}

export interface KeyValueStore {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

type Listener = (s: Settings) => void;

/** Armazena, valida e notifica mudanças de configuração. */
export class SettingsStore {
  private value: Settings;
  private listeners = new Set<Listener>();

  constructor(private store: KeyValueStore | null = defaultStore(), mobile = isMobile()) {
    let raw: unknown = null;
    try {
      const txt = this.store?.getItem(KEY);
      raw = txt ? JSON.parse(txt) : null;
    } catch {
      raw = null;
    }
    this.value = sanitize(raw, mobile);
  }

  get(): Settings {
    return this.value;
  }

  update(mut: (s: Settings) => void): void {
    const copy = structuredClone(this.value);
    mut(copy);
    if (copy.graphics.preset !== 'personalizado' && copy.graphics.preset !== this.value.graphics.preset) {
      Object.assign(copy.graphics, PRESETS[copy.graphics.preset]);
    }
    this.value = sanitize(copy);
    this.save();
    for (const l of this.listeners) l(this.value);
  }

  reset(): void {
    this.value = defaultSettings();
    this.save();
    for (const l of this.listeners) l(this.value);
  }

  onChange(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private save(): void {
    try {
      this.store?.setItem(KEY, JSON.stringify(this.value));
    } catch {
      /* armazenamento indisponível (modo privado): mantém em memória */
    }
  }
}
