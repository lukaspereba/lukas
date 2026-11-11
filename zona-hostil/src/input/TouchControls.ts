// Controles de toque para celular: joystick flutuante, área de câmera e botões de ação.
// O layout é descrito por dados (posição/tamanho/opacidade) para permitir o editor de HUD (fase 7).

import type { ButtonAction, InputSource, InputState } from './Input';

export interface TouchButtonDef {
  id: string;
  action: ButtonAction;
  label: string;
  /** posição do centro em % da largura/altura da tela */
  x: number;
  y: number;
  size: number; // px
  opacity: number;
  visible: boolean;
  /** 'hold' = segurar; 'tap' = toque único */
  mode: 'hold' | 'tap';
}

export const DEFAULT_TOUCH_LAYOUT: TouchButtonDef[] = [
  { id: 'jump', action: 'jump', label: 'PULAR', x: 90, y: 74, size: 76, opacity: 0.75, visible: true, mode: 'hold' },
  { id: 'crouch', action: 'crouch', label: 'AGACHAR', x: 79, y: 86, size: 64, opacity: 0.75, visible: true, mode: 'tap' },
  { id: 'prone', action: 'prone', label: 'DEITAR', x: 68, y: 90, size: 56, opacity: 0.7, visible: true, mode: 'tap' },
  { id: 'sprint', action: 'sprint', label: 'CORRER', x: 9, y: 46, size: 56, opacity: 0.7, visible: true, mode: 'tap' },
  { id: 'camera', action: 'camera', label: 'FPS/TPS', x: 92, y: 12, size: 52, opacity: 0.7, visible: true, mode: 'tap' },
  { id: 'pause', action: 'pause', label: '☰', x: 4.5, y: 8, size: 46, opacity: 0.7, visible: true, mode: 'tap' },
];

export class TouchControls implements InputSource {
  readonly root: HTMLDivElement;
  private joyBase: HTMLDivElement;
  private joyKnob: HTMLDivElement;
  private sprintTag: HTMLDivElement;
  private joyId: number | null = null;
  private joyOrigin = { x: 0, y: 0 };
  private lookId: number | null = null;
  private lookLast = { x: 0, y: 0 };
  private buttons = new Map<string, HTMLDivElement>();
  private readonly radius = 62;

  constructor(
    private state: InputState,
    parent: HTMLElement,
    private getSens: () => { touch: number; invertY: boolean },
    layout: TouchButtonDef[] = DEFAULT_TOUCH_LAYOUT,
  ) {
    const root = document.createElement('div');
    root.className = 'zh-touch';
    root.style.cssText = 'position:absolute;inset:0;touch-action:none;user-select:none;-webkit-user-select:none;z-index:5;';
    parent.appendChild(root);
    this.root = root;

    this.joyBase = document.createElement('div');
    this.joyBase.className = 'zh-joy';
    this.joyKnob = document.createElement('div');
    this.joyKnob.className = 'zh-joy-knob';
    this.sprintTag = document.createElement('div');
    this.sprintTag.className = 'zh-joy-sprint';
    this.sprintTag.textContent = 'SPRINT';
    this.joyBase.append(this.joyKnob, this.sprintTag);
    root.appendChild(this.joyBase);
    this.placeJoyIdle();

    for (const def of layout) this.addButton(def);

    root.addEventListener('pointerdown', this.onDown, { passive: false });
    root.addEventListener('pointermove', this.onMove, { passive: false });
    root.addEventListener('pointerup', this.onUp);
    root.addEventListener('pointercancel', this.onUp);
  }

  private placeJoyIdle(): void {
    const h = this.root.clientHeight || innerHeight;
    this.joyBase.style.left = `${Math.max(90, (this.root.clientWidth || innerWidth) * 0.14)}px`;
    this.joyBase.style.top = `${h * 0.72}px`;
    this.joyBase.classList.remove('active');
    this.joyKnob.style.transform = 'translate(-50%,-50%)';
    this.sprintTag.classList.remove('on');
  }

  private addButton(def: TouchButtonDef): void {
    const b = document.createElement('div');
    b.className = 'zh-btn';
    b.dataset.id = def.id;
    b.textContent = def.label;
    b.style.cssText = `left:${def.x}%;top:${def.y}%;width:${def.size}px;height:${def.size}px;opacity:${def.opacity};display:${def.visible ? 'flex' : 'none'};font-size:${Math.max(9, def.size * 0.17)}px`;
    this.buttons.set(def.id, b);
    this.root.appendChild(b);
    const pressed = new Set<number>();
    b.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      pressed.add(e.pointerId);
      b.classList.add('down');
      this.state.lastSource = 'toque';
      if (def.action === 'sprint') {
        this.state.sprintLatch = !this.state.sprintLatch;
        b.classList.toggle('latched', this.state.sprintLatch);
      } else if (def.mode === 'tap') this.state.tap(def.action);
      else this.state.press(def.action, 'touch:' + def.id);
    });
    const up = (e: PointerEvent) => {
      e.stopPropagation();
      pressed.delete(e.pointerId);
      if (pressed.size === 0) {
        b.classList.remove('down');
        if (def.mode === 'hold') this.state.release(def.action, 'touch:' + def.id);
      }
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
  }

  setSprintIndicator(on: boolean): void {
    this.buttons.get('sprint')?.classList.toggle('latched', on);
  }

  private onDown = (e: PointerEvent): void => {
    e.preventDefault();
    const w = this.root.clientWidth || innerWidth;
    this.state.lastSource = 'toque';
    if (e.clientX < w * 0.45 && this.joyId === null) {
      this.joyId = e.pointerId;
      this.joyOrigin = { x: e.clientX, y: e.clientY };
      this.joyBase.style.left = `${e.clientX}px`;
      this.joyBase.style.top = `${e.clientY}px`;
      this.joyBase.classList.add('active');
      this.root.setPointerCapture?.(e.pointerId);
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.lookLast = { x: e.clientX, y: e.clientY };
      this.root.setPointerCapture?.(e.pointerId);
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId === this.joyId) {
      e.preventDefault();
      let dx = e.clientX - this.joyOrigin.x;
      let dy = e.clientY - this.joyOrigin.y;
      const d = Math.hypot(dx, dy);
      const r = this.radius;
      // arrastar além da borda superior trava o sprint (padrão de FPS mobile)
      const sprint = dy < -r * 1.35 && Math.abs(dx) < r * 0.9;
      this.state.sprintLatch = sprint || (this.state.sprintLatch && dy < -r * 0.6);
      this.sprintTag.classList.toggle('on', this.state.sprintLatch);
      if (d > r) {
        dx = (dx / d) * r;
        dy = (dy / d) * r;
      }
      this.joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.state.moveX = dx / r;
      this.state.moveY = -dy / r;
    } else if (e.pointerId === this.lookId) {
      e.preventDefault();
      const { touch, invertY } = this.getSens();
      const k = 0.0052 * touch;
      const dx = e.clientX - this.lookLast.x;
      const dy = e.clientY - this.lookLast.y;
      this.lookLast = { x: e.clientX, y: e.clientY };
      this.state.addLook(-dx * k, -dy * k * (invertY ? -1 : 1));
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.joyId) {
      this.joyId = null;
      this.state.moveX = 0;
      this.state.moveY = 0;
      if (!this.buttons.get('sprint')?.classList.contains('latched')) this.state.sprintLatch = false;
      this.placeJoyIdle();
    }
    if (e.pointerId === this.lookId) this.lookId = null;
  };

  update(): void {}

  setVisible(v: boolean): void {
    this.root.style.display = v ? 'block' : 'none';
  }

  dispose(): void {
    this.root.remove();
  }
}
