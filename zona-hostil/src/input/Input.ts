// Sistema de entrada unificado: teclado/mouse, toque (celular) e gamepad alimentam o mesmo estado.
// O jogo consulta "ações", nunca teclas — assim o layout de controles pode mudar sem tocar na lógica.

export type ButtonAction =
  | 'jump'
  | 'crouch'
  | 'prone'
  | 'sprint'
  | 'fire'
  | 'aim'
  | 'reload'
  | 'interact'
  | 'camera'
  | 'pause';

export const BUTTONS: ButtonAction[] = ['jump', 'crouch', 'prone', 'sprint', 'fire', 'aim', 'reload', 'interact', 'camera', 'pause'];

export interface InputSnapshot {
  moveX: number; // -1..1 direita
  moveY: number; // -1..1 frente
  lookYaw: number; // rad acumulados neste quadro (positivo = girar para a esquerda)
  lookPitch: number; // rad (positivo = olhar para cima)
}

/** Estado compartilhado entre as fontes. */
export class InputState {
  moveX = 0;
  moveY = 0;
  private lookYaw = 0;
  private lookPitch = 0;
  private held = new Map<ButtonAction, Set<string>>();
  private latched = new Set<ButtonAction>();
  /** sprint "travado" (joystick na borda / botão alternável) */
  sprintLatch = false;
  lastSource: 'teclado' | 'toque' | 'gamepad' = 'teclado';

  addLook(yaw: number, pitch: number): void {
    this.lookYaw += yaw;
    this.lookPitch += pitch;
  }

  press(a: ButtonAction, source: string): void {
    let s = this.held.get(a);
    if (!s) this.held.set(a, (s = new Set()));
    if (!s.has(source)) {
      s.add(source);
      this.latched.add(a);
    }
  }

  release(a: ButtonAction, source: string): void {
    this.held.get(a)?.delete(source);
  }

  /** Pressionamento único (borda) — fica guardado até alguém consumir. */
  tap(a: ButtonAction): void {
    this.latched.add(a);
  }

  isDown(a: ButtonAction): boolean {
    return (this.held.get(a)?.size ?? 0) > 0;
  }

  consume(a: ButtonAction): boolean {
    if (this.latched.has(a)) {
      this.latched.delete(a);
      return true;
    }
    return false;
  }

  takeLook(): { yaw: number; pitch: number } {
    const r = { yaw: this.lookYaw, pitch: this.lookPitch };
    this.lookYaw = 0;
    this.lookPitch = 0;
    return r;
  }

  releaseAll(): void {
    this.held.clear();
    this.moveX = 0;
    this.moveY = 0;
  }
}

export interface InputSource {
  update(dt: number): void;
  dispose(): void;
}

// ------------------------------------------------------------------------------------------
// Teclado e mouse
// ------------------------------------------------------------------------------------------

const KEYMAP: Record<string, ButtonAction> = {
  Space: 'jump',
  KeyC: 'crouch',
  ControlLeft: 'crouch',
  KeyZ: 'prone',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
  KeyR: 'reload',
  KeyF: 'interact',
  KeyV: 'camera',
  Escape: 'pause',
  KeyP: 'pause',
};

export class KeyboardMouse implements InputSource {
  private keys = new Set<string>();
  private off: Array<() => void> = [];
  private moving = false;
  locked = false;

  constructor(
    private state: InputState,
    private el: HTMLElement,
    private getSens: () => { sens: number; invertY: boolean },
  ) {
    const on = <K extends keyof WindowEventMap | 'pointerlockchange'>(
      t: K,
      f: (e: K extends keyof WindowEventMap ? WindowEventMap[K] : Event) => void,
      target: Window | Document = window,
    ) => {
      target.addEventListener(t, f as EventListener);
      this.off.push(() => target.removeEventListener(t, f as EventListener));
    };
    on('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      const a = KEYMAP[e.code];
      if (a) {
        this.state.press(a, 'kb:' + e.code);
        this.state.lastSource = 'teclado';
        if (e.code !== 'Escape') e.preventDefault();
      }
    });
    on('keyup', (e) => {
      this.keys.delete(e.code);
      const a = KEYMAP[e.code];
      if (a) this.state.release(a, 'kb:' + e.code);
    });
    on('blur', () => {
      this.keys.clear();
      this.state.releaseAll();
    });
    on('mousemove', (e) => {
      if (!this.locked || (e.movementX === 0 && e.movementY === 0)) return;
      const { sens, invertY } = this.getSens();
      const k = 0.0022 * sens;
      this.state.addLook(-e.movementX * k, -e.movementY * k * (invertY ? -1 : 1));
      this.state.lastSource = 'teclado';
    });
    on('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.state.press('fire', 'mouse0');
      if (e.button === 2) this.state.press('aim', 'mouse2');
    });
    on('mouseup', (e) => {
      if (e.button === 0) this.state.release('fire', 'mouse0');
      if (e.button === 2) this.state.release('aim', 'mouse2');
    });
    on(
      'pointerlockchange',
      () => {
        this.locked = document.pointerLockElement === this.el;
      },
      document,
    );
    const ctx = (e: Event) => e.preventDefault();
    el.addEventListener('contextmenu', ctx);
    this.off.push(() => el.removeEventListener('contextmenu', ctx));
  }

  requestLock(): void {
    try {
      const p = this.el.requestPointerLock() as unknown as Promise<void> | undefined;
      p?.catch?.(() => undefined);
    } catch {
      /* navegador sem pointer lock (ex.: iframe restrito): mouse fica livre */
    }
  }

  update(): void {
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (x !== 0 || y !== 0) {
      const l = Math.hypot(x, y);
      this.state.moveX = x / l;
      this.state.moveY = y / l;
      this.state.lastSource = 'teclado';
      this.moving = true;
    } else if (this.moving) {
      // só zera o movimento que o próprio teclado produziu
      this.moving = false;
      this.state.moveX = 0;
      this.state.moveY = 0;
    }
  }

  dispose(): void {
    for (const f of this.off) f();
  }
}

// ------------------------------------------------------------------------------------------
// Gamepad (mapeamento padrão)
// ------------------------------------------------------------------------------------------

const PAD: Array<[number, ButtonAction]> = [
  [0, 'jump'],
  [1, 'crouch'],
  [10, 'sprint'],
  [3, 'camera'],
  [9, 'pause'],
  [2, 'reload'],
  [7, 'fire'],
  [6, 'aim'],
  [5, 'prone'],
  [4, 'interact'],
];

export class GamepadSource implements InputSource {
  private moving = false;
  constructor(
    private state: InputState,
    private getSens: () => { sens: number; invertY: boolean },
  ) {}

  update(dt: number): void {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = Array.from(pads).find((p) => p && p.connected);
    if (!gp) return;
    const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
    const lx = dz(gp.axes[0] ?? 0);
    const ly = dz(gp.axes[1] ?? 0);
    const rx = dz(gp.axes[2] ?? 0);
    const ry = dz(gp.axes[3] ?? 0);
    if (lx || ly) {
      this.state.moveX = lx;
      this.state.moveY = -ly;
      this.state.lastSource = 'gamepad';
      this.moving = true;
    } else if (this.moving) {
      this.moving = false;
      this.state.moveX = 0;
      this.state.moveY = 0;
    }
    if (rx || ry) {
      const { sens, invertY } = this.getSens();
      const rate = 3.2 * sens * dt;
      this.state.addLook(-Math.sign(rx) * rx * rx * rate, -Math.sign(ry) * ry * ry * rate * (invertY ? -1 : 1));
      this.state.lastSource = 'gamepad';
    }
    for (const [i, a] of PAD) {
      if (gp.buttons[i]?.pressed) this.state.press(a, 'pad' + i);
      else this.state.release(a, 'pad' + i);
    }
  }

  dispose(): void {}
}
