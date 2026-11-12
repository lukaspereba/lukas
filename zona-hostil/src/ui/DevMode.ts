// Modo desenvolvedor (acesso do Lukas): 5 toques no logo da tela inicial abrem um pedido de código.
// O código não fica em texto no pacote, só o hash SHA-256 dele.
// ATENÇÃO: isto é uma proteção básica de interface. Em multiplayer, privilégios precisam ser
// validados também no servidor.

const CODE_SHA256 = '4135aa9dc1b842a653dea846903ddb95bfb8c5a10c504a7fa16e10bc31d1fdf0';

export interface DevState {
  unlocked: boolean;
  fly: boolean;
  speedMul: number;
  showPerf: boolean;
  infiniteAmmo: boolean;
  godMode: boolean;
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function checkDevCode(code: string): Promise<boolean> {
  if (!globalThis.crypto?.subtle) return false;
  return (await sha256Hex(code)) === CODE_SHA256;
}

export interface DevActions {
  teleport: (name: string) => void;
  places: () => string[];
  skins: () => string[];
  setSkin: (i: number) => void;
  addDummy: () => void;
  removeDummy: () => void;
  dummyCount: () => number;
  onChange: () => void;
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

/** Contador de toques no logo + diálogo de código (senha nunca aparece na tela). */
export function attachLogoTaps(logo: HTMLElement, parent: HTMLElement, onUnlock: () => void): void {
  let taps: number[] = [];
  logo.style.cursor = 'pointer';
  logo.addEventListener('pointerdown', () => {
    const now = performance.now();
    taps = taps.filter((t) => now - t < 3000);
    taps.push(now);
    if (taps.length >= 5) {
      taps = [];
      openCodePrompt(parent, onUnlock);
    }
  });
}

function openCodePrompt(parent: HTMLElement, onUnlock: () => void): void {
  const el = h('div', 'zh-screen zh-settings');
  el.innerHTML = `<form class="zh-panel small zh-code"><h2>ACESSO RESTRITO</h2>
    <label for="zh-dev-code" class="zh-field-label">Código de desenvolvedor</label>
    <input id="zh-dev-code" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" />
    <div class="zh-code-msg" aria-live="polite"></div>
    <div class="zh-panel-foot"><button type="button" data-a="cancel">CANCELAR</button><button type="submit" class="primary">ENTRAR</button></div></form>`;
  parent.appendChild(el);
  const form = el.querySelector('form') as HTMLFormElement;
  const input = el.querySelector('input') as HTMLInputElement;
  const msg = el.querySelector('.zh-code-msg') as HTMLDivElement;
  input.focus();
  el.querySelector('[data-a=cancel]')!.addEventListener('click', () => el.remove());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await checkDevCode(input.value);
    input.value = '';
    if (ok) {
      el.remove();
      onUnlock();
    } else {
      msg.textContent = 'Código incorreto.';
    }
  });
}

export class DevPanel {
  readonly el = h('div', 'zh-screen zh-settings zh-dev');
  private body: HTMLDivElement;

  constructor(parent: HTMLElement, private state: DevState, private actions: DevActions) {
    this.el.innerHTML = `<div class="zh-panel"><div class="zh-panel-head"><h2>PAINEL DO DESENVOLVEDOR</h2><button class="zh-close" aria-label="Fechar">✕</button></div>
      <div class="zh-fields"></div><div class="zh-panel-foot"><button data-a="lock">SAIR DO MODO DEV</button><button data-a="close" class="primary">CONCLUIR</button></div></div>`;
    this.body = this.el.querySelector('.zh-fields') as HTMLDivElement;
    this.el.querySelector('.zh-close')!.addEventListener('click', () => this.close());
    this.el.querySelector('[data-a=close]')!.addEventListener('click', () => this.close());
    this.el.querySelector('[data-a=lock]')!.addEventListener('click', () => {
      Object.assign(this.state, { unlocked: false, fly: false, speedMul: 1, showPerf: false, godMode: false, infiniteAmmo: false });
      this.actions.onChange();
      this.close();
    });
    this.el.style.display = 'none';
    parent.appendChild(this.el);
  }

  private onClose: () => void = () => undefined;

  open(onClose: () => void = () => undefined): void {
    this.onClose = onClose;
    this.render();
    this.el.style.display = 'flex';
  }

  close(): void {
    this.el.style.display = 'none';
    this.onClose();
  }

  private toggle(label: string, key: 'fly' | 'showPerf' | 'godMode' | 'infiniteAmmo', note = ''): HTMLElement {
    const row = h('label', 'zh-field');
    row.appendChild(h('span', 'zh-field-label', label + (note ? ` <em>(${note})</em>` : '')));
    const inp = h('input');
    inp.type = 'checkbox';
    inp.id = `zh-dev-${key}`;
    inp.checked = this.state[key];
    inp.addEventListener('change', () => {
      this.state[key] = inp.checked;
      this.actions.onChange();
    });
    row.appendChild(inp);
    return row;
  }

  private render(): void {
    const b = this.body;
    b.innerHTML = '';
    b.appendChild(this.toggle('Voo livre (atravessa paredes)', 'fly', 'Espaço sobe, C desce'));
    b.appendChild(this.toggle('Desempenho na tela (ms, draw calls, triângulos)', 'showPerf'));
    b.appendChild(this.toggle('Modo Deus / invencível', 'godMode', 'vale quando o dano existir'));
    b.appendChild(this.toggle('Munição infinita', 'infiniteAmmo', 'vale quando as armas existirem'));
    // velocidade
    const sp = h('label', 'zh-field');
    sp.appendChild(h('span', 'zh-field-label', 'Velocidade'));
    const r = h('input');
    r.type = 'range';
    r.id = 'zh-dev-speed';
    r.min = '0.5';
    r.max = '6';
    r.step = '0.25';
    r.value = String(this.state.speedMul);
    const val = h('span', 'zh-field-val', `${this.state.speedMul.toFixed(2)}×`);
    r.addEventListener('input', () => {
      this.state.speedMul = Number(r.value);
      val.textContent = `${this.state.speedMul.toFixed(2)}×`;
      this.actions.onChange();
    });
    sp.append(r, val);
    b.appendChild(sp);
    // teleporte
    const tp = h('div', 'zh-field zh-dev-row');
    tp.appendChild(h('span', 'zh-field-label', 'Teletransporte'));
    const tpBtns = h('div', 'zh-dev-btns');
    for (const p of this.actions.places()) {
      const btn = h('button', '', p);
      btn.addEventListener('click', () => {
        this.actions.teleport(p);
        this.close();
      });
      tpBtns.appendChild(btn);
    }
    tp.appendChild(tpBtns);
    b.appendChild(tp);
    // personagens
    const sk = h('div', 'zh-field zh-dev-row');
    sk.appendChild(h('span', 'zh-field-label', 'Testar personagem'));
    const skBtns = h('div', 'zh-dev-btns');
    this.actions.skins().forEach((n, i) => {
      const btn = h('button', '', n);
      btn.addEventListener('click', () => this.actions.setSkin(i));
      skBtns.appendChild(btn);
    });
    sk.appendChild(skBtns);
    b.appendChild(sk);
    // bots / manequins
    const bt = h('div', 'zh-field zh-dev-row');
    bt.appendChild(h('span', 'zh-field-label', `Manequins no mapa: <b>${this.actions.dummyCount()}</b>`));
    const btBtns = h('div', 'zh-dev-btns');
    const add = h('button', '', '+ ADICIONAR');
    add.addEventListener('click', () => {
      this.actions.addDummy();
      this.render();
    });
    const rem = h('button', '', '− REMOVER');
    rem.addEventListener('click', () => {
      this.actions.removeDummy();
      this.render();
    });
    btBtns.append(add, rem);
    bt.appendChild(btBtns);
    b.appendChild(bt);
  }
}
