// Interface em DOM: carregamento, tela inicial, HUD, pausa e configurações (todas funcionais e salvas).

import type { Settings, SettingsStore, QualityPreset } from '../core/Settings';

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export class LoadingScreen {
  readonly el = h('div', 'zh-screen zh-loading');
  private bar: HTMLDivElement;
  private label: HTMLDivElement;

  constructor(parent: HTMLElement) {
    this.el.innerHTML = `<div class="zh-logo">ZONA <b>HOSTIL</b></div>
      <div class="zh-load-track"><div class="zh-load-bar"></div></div><div class="zh-load-label">Preparando…</div>`;
    this.bar = this.el.querySelector('.zh-load-bar') as HTMLDivElement;
    this.label = this.el.querySelector('.zh-load-label') as HTMLDivElement;
    parent.appendChild(this.el);
  }

  progress(f: number, text: string): void {
    this.bar.style.width = `${Math.round(Math.min(1, Math.max(0, f)) * 100)}%`;
    this.label.textContent = text;
  }

  error(msg: string): void {
    this.label.textContent = msg;
    this.el.classList.add('error');
  }

  hide(): void {
    this.el.remove();
  }
}

export class TitleScreen {
  readonly el = h('div', 'zh-screen zh-title');

  constructor(parent: HTMLElement, actions: { play: () => void; settings: () => void; credits: () => void }) {
    this.el.innerHTML = `
      <div class="zh-title-inner">
        <div class="zh-logo big">ZONA <b>HOSTIL</b></div>
        <div class="zh-sub">BATTLE ROYALE · PROTÓTIPO DA FASE 1</div>
        <div class="zh-menu">
          <button data-a="play" class="primary">CAMPO DE TREINAMENTO</button>
          <button data-a="settings">CONFIGURAÇÕES</button>
          <button data-a="credits">CRÉDITOS E LICENÇAS</button>
        </div>
        <div class="zh-note">Fase 1: personagem, câmera e movimentação. Battle Royale, armas, bots e multiplayer chegam nas próximas fases.</div>
      </div>`;
    this.el.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => {
        const a = (b as HTMLButtonElement).dataset.a as keyof typeof actions;
        actions[a]();
      }),
    );
    parent.appendChild(this.el);
  }

  show(v: boolean): void {
    this.el.style.display = v ? 'flex' : 'none';
  }
}

export class PauseMenu {
  readonly el = h('div', 'zh-screen zh-pause');

  constructor(parent: HTMLElement, actions: { resume: () => void; settings: () => void; respawn: () => void; quit: () => void }) {
    this.el.innerHTML = `<div class="zh-panel small"><h2>PAUSADO</h2>
      <div class="zh-menu">
        <button data-a="resume" class="primary">CONTINUAR</button>
        <button data-a="settings">CONFIGURAÇÕES</button>
        <button data-a="respawn">VOLTAR AO PONTO INICIAL</button>
        <button data-a="quit">SAIR PARA O MENU</button>
      </div></div>`;
    this.el.querySelectorAll('button').forEach((b) =>
      b.addEventListener('click', () => actions[(b as HTMLButtonElement).dataset.a as keyof typeof actions]()),
    );
    this.show(false);
    parent.appendChild(this.el);
  }

  show(v: boolean): void {
    this.el.style.display = v ? 'flex' : 'none';
  }
}

type Field =
  | { kind: 'range'; label: string; get: (s: Settings) => number; set: (s: Settings, v: number) => void; min: number; max: number; step: number; fmt?: (v: number) => string }
  | { kind: 'toggle'; label: string; get: (s: Settings) => boolean; set: (s: Settings, v: boolean) => void; note?: string }
  | { kind: 'select'; label: string; get: (s: Settings) => string; set: (s: Settings, v: string) => void; options: Array<[string, string]>; note?: string };

const pct = (v: number) => `${Math.round(v * 100)}%`;

const TABS: Record<string, Field[]> = {
  'Gráficos': [
    { kind: 'select', label: 'Qualidade', get: (s) => s.graphics.preset, set: (s, v) => (s.graphics.preset = v as QualityPreset), options: [['baixo', 'Baixo'], ['medio', 'Médio'], ['alto', 'Alto'], ['personalizado', 'Personalizado']] },
    { kind: 'range', label: 'Resolução de renderização', get: (s) => s.graphics.renderScale, set: (s, v) => { s.graphics.renderScale = v; s.graphics.preset = 'personalizado'; }, min: 0.4, max: 1, step: 0.05, fmt: pct },
    { kind: 'select', label: 'Sombras', get: (s) => s.graphics.shadows, set: (s, v) => { s.graphics.shadows = v as Settings['graphics']['shadows']; s.graphics.preset = 'personalizado'; }, options: [['desligado', 'Desligadas'], ['baixo', 'Baixas'], ['medio', 'Médias'], ['alto', 'Altas']] },
    { kind: 'range', label: 'Distância de visão', get: (s) => s.graphics.viewDistance, set: (s, v) => { s.graphics.viewDistance = v; s.graphics.preset = 'personalizado'; }, min: 150, max: 3000, step: 50, fmt: (v) => `${v} m` },
    { kind: 'select', label: 'Limite de FPS', get: (s) => String(s.graphics.fpsLimit), set: (s, v) => (s.graphics.fpsLimit = Number(v)), options: [['30', '30'], ['45', '45'], ['60', '60'], ['90', '90'], ['120', '120'], ['0', 'Sem limite']] },
    { kind: 'toggle', label: 'Antisserrilhado (MSAA)', get: (s) => s.graphics.antialias, set: (s, v) => { s.graphics.antialias = v; s.graphics.preset = 'personalizado'; }, note: 'aplica ao recarregar' },
  ],
  'Controles': [
    { kind: 'range', label: 'Sensibilidade (mouse/controle)', get: (s) => s.controls.sensitivity, set: (s, v) => (s.controls.sensitivity = v), min: 0.1, max: 5, step: 0.05, fmt: (v) => v.toFixed(2) },
    { kind: 'range', label: 'Sensibilidade (toque)', get: (s) => s.controls.touchSensitivity, set: (s, v) => (s.controls.touchSensitivity = v), min: 0.1, max: 5, step: 0.05, fmt: (v) => v.toFixed(2) },
    { kind: 'toggle', label: 'Inverter eixo vertical', get: (s) => s.controls.invertY, set: (s, v) => (s.controls.invertY = v) },
    { kind: 'toggle', label: 'Agachar: alternar (desligado = segurar)', get: (s) => s.controls.toggleCrouch, set: (s, v) => (s.controls.toggleCrouch = v) },
  ],
  'Jogabilidade': [
    { kind: 'select', label: 'Câmera', get: (s) => s.gameplay.camera, set: (s, v) => (s.gameplay.camera = v as Settings['gameplay']['camera']), options: [['fps', 'Primeira pessoa'], ['tps', 'Terceira pessoa']] },
    { kind: 'range', label: 'Campo de visão (horizontal)', get: (s) => s.gameplay.fov, set: (s, v) => (s.gameplay.fov = v), min: 70, max: 115, step: 1, fmt: (v) => `${v}°` },
    { kind: 'range', label: 'Balanço da câmera', get: (s) => s.gameplay.headBob, set: (s, v) => (s.gameplay.headBob = v), min: 0, max: 1, step: 0.05, fmt: pct },
    { kind: 'toggle', label: 'Mostrar FPS', get: (s) => s.gameplay.showFps, set: (s, v) => (s.gameplay.showFps = v) },
    { kind: 'toggle', label: 'Informações de depuração', get: (s) => s.gameplay.showDebug, set: (s, v) => (s.gameplay.showDebug = v) },
  ],
};

export class SettingsPanel {
  readonly el = h('div', 'zh-screen zh-settings');
  private body: HTMLDivElement;
  private tab = 'Gráficos';
  private onClose: () => void = () => undefined;

  constructor(parent: HTMLElement, private store: SettingsStore) {
    this.el.innerHTML = `<div class="zh-panel"><div class="zh-panel-head"><h2>CONFIGURAÇÕES</h2>
      <button class="zh-close" aria-label="Fechar">✕</button></div>
      <div class="zh-tabs"></div><div class="zh-fields"></div>
      <div class="zh-panel-foot"><button data-a="reset">RESTAURAR PADRÃO</button><button data-a="reload">RECARREGAR JOGO</button><button data-a="close" class="primary">CONCLUIR</button></div></div>`;
    this.body = this.el.querySelector('.zh-fields') as HTMLDivElement;
    const tabs = this.el.querySelector('.zh-tabs') as HTMLDivElement;
    for (const t of Object.keys(TABS)) {
      const b = h('button', '', t);
      b.addEventListener('click', () => {
        this.tab = t;
        this.render();
      });
      tabs.appendChild(b);
    }
    this.el.querySelector('.zh-close')!.addEventListener('click', () => this.close());
    this.el.querySelector('[data-a=close]')!.addEventListener('click', () => this.close());
    this.el.querySelector('[data-a=reset]')!.addEventListener('click', () => {
      this.store.reset();
      this.render();
    });
    this.el.querySelector('[data-a=reload]')!.addEventListener('click', () => location.reload());
    this.el.style.display = 'none';
    parent.appendChild(this.el);
  }

  open(onClose: () => void): void {
    this.onClose = onClose;
    this.el.style.display = 'flex';
    this.render();
  }

  close(): void {
    this.el.style.display = 'none';
    this.onClose();
  }

  get isOpen(): boolean {
    return this.el.style.display !== 'none';
  }

  private render(): void {
    const s = this.store.get();
    this.el.querySelectorAll('.zh-tabs button').forEach((b) => b.classList.toggle('on', b.textContent === this.tab));
    this.body.innerHTML = '';
    for (const f of TABS[this.tab]) {
      const row = h('label', 'zh-field');
      const name = h('span', 'zh-field-label', f.label + ('note' in f && f.note ? ` <em>(${f.note})</em>` : ''));
      row.appendChild(name);
      if (f.kind === 'range') {
        const val = h('span', 'zh-field-val', f.fmt ? f.fmt(f.get(s)) : String(f.get(s)));
        const inp = h('input');
        inp.type = 'range';
        inp.min = String(f.min);
        inp.max = String(f.max);
        inp.step = String(f.step);
        inp.value = String(f.get(s));
        inp.addEventListener('input', () => {
          this.store.update((x) => f.set(x, Number(inp.value)));
          val.textContent = f.fmt ? f.fmt(Number(inp.value)) : inp.value;
        });
        inp.addEventListener('change', () => this.render());
        row.append(inp, val);
      } else if (f.kind === 'toggle') {
        const inp = h('input');
        inp.type = 'checkbox';
        inp.checked = f.get(s);
        inp.addEventListener('change', () => this.store.update((x) => f.set(x, inp.checked)));
        row.appendChild(inp);
      } else {
        const sel = h('select');
        for (const [v, l] of f.options) {
          const o = h('option', '', l);
          o.value = v;
          sel.appendChild(o);
        }
        sel.value = f.get(s);
        sel.addEventListener('change', () => {
          this.store.update((x) => f.set(x, sel.value));
          this.render();
        });
        row.appendChild(sel);
      }
      this.body.appendChild(row);
    }
  }
}

export class CreditsPanel {
  readonly el = h('div', 'zh-screen zh-settings');
  constructor(parent: HTMLElement) {
    this.el.innerHTML = `<div class="zh-panel"><div class="zh-panel-head"><h2>CRÉDITOS E LICENÇAS</h2><button class="zh-close">✕</button></div>
      <div class="zh-credits">
      <p><b>ZONA HOSTIL</b> — código, modelagem do equipamento tático, texturas do mundo, camuflagens e mapa: originais deste projeto.</p>
      <p><b>Corpos humanos, pele, olhos, sobrancelhas, roupas-base e esqueleto:</b> MakeHuman / MPFB2 (CC0 1.0). Gerados e modificados por script próprio.</p>
      <p><b>Animações:</b> Carnegie Mellon University Motion Capture Database (mocap.cs.cmu.edu), conversão BVH de B. Hahne (cgspeed). Uso livre; redirecionadas para o esqueleto por script próprio.</p>
      <p><b>Motor:</b> three.js (MIT) e three-mesh-bvh (MIT).</p>
      <p>Nenhum asset de jogos comerciais foi utilizado.</p></div></div>`;
    this.el.style.display = 'none';
    this.el.querySelector('.zh-close')!.addEventListener('click', () => (this.el.style.display = 'none'));
    parent.appendChild(this.el);
  }
  open(): void {
    this.el.style.display = 'flex';
  }
}

export interface HudState {
  stance: string;
  state: string;
  speed: number;
  sprint: boolean;
  fps: number;
  showFps: boolean;
  debug: string | null;
  camera: string;
  hint: string;
}

export class Hud {
  readonly el = h('div', 'zh-hud');
  private fpsEl: HTMLDivElement;
  private stanceEl: HTMLDivElement;
  private debugEl: HTMLPreElement;
  private hintEl: HTMLDivElement;
  private toastEl: HTMLDivElement;
  private toastT = 0;

  constructor(parent: HTMLElement, touch: boolean) {
    this.el.innerHTML = `<div class="zh-cross"><i></i><i></i><i></i><i></i></div>
      <div class="zh-fps"></div><div class="zh-stance"></div><pre class="zh-debug"></pre>
      <div class="zh-hint"></div><div class="zh-toast"></div>`;
    this.fpsEl = this.el.querySelector('.zh-fps') as HTMLDivElement;
    this.stanceEl = this.el.querySelector('.zh-stance') as HTMLDivElement;
    this.debugEl = this.el.querySelector('.zh-debug') as HTMLPreElement;
    this.hintEl = this.el.querySelector('.zh-hint') as HTMLDivElement;
    this.toastEl = this.el.querySelector('.zh-toast') as HTMLDivElement;
    if (touch) this.el.classList.add('touch');
    parent.appendChild(this.el);
  }

  toast(msg: string, secs = 2.5): void {
    this.toastEl.textContent = msg;
    this.toastEl.style.opacity = '1';
    this.toastT = secs;
  }

  update(dt: number, s: HudState): void {
    this.fpsEl.style.display = s.showFps ? 'block' : 'none';
    this.fpsEl.textContent = `${Math.round(s.fps)} FPS`;
    const stanceName = { stand: 'EM PÉ', crouch: 'AGACHADO', prone: 'DEITADO' }[s.stance] ?? s.stance;
    const stateName = { ground: '', air: ' · NO AR', slide: ' · DESLIZANDO', mantle: ' · ESCALANDO' }[s.state] ?? '';
    this.stanceEl.innerHTML = `<b>${stanceName}</b>${stateName}${s.sprint ? ' · SPRINT' : ''}<span>${s.speed.toFixed(1)} m/s · ${s.camera}</span>`;
    this.debugEl.style.display = s.debug ? 'block' : 'none';
    if (s.debug) this.debugEl.textContent = s.debug;
    this.hintEl.innerHTML = s.hint;
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.style.opacity = '0';
    }
  }

  show(v: boolean): void {
    this.el.style.display = v ? 'block' : 'none';
  }
}
