import { describe, expect, it } from 'vitest';
import { Bone, Vector3 } from 'three';
import { SettingsStore, defaultSettings, sanitize, type KeyValueStore } from '../../src/core/Settings';
import { solveTwoBone } from '../../src/anim/ik';
import { Heightfield } from '../../src/world/Heightfield';

class MemStore implements KeyValueStore {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('Settings', () => {
  it('valores inválidos voltam ao padrão e limites são respeitados', () => {
    const s = sanitize({ graphics: { renderScale: 99, shadows: 'ultra' }, controls: { sensitivity: -3 }, gameplay: { camera: 'drone', fov: 200 } }, false);
    const d = defaultSettings(false);
    expect(s.graphics.renderScale).toBe(1);
    expect(s.graphics.shadows).toBe(d.graphics.shadows);
    expect(s.controls.sensitivity).toBe(0.1);
    expect(s.gameplay.camera).toBe('fps');
    expect(s.gameplay.fov).toBe(115);
  });

  it('persiste entre sessões e aplica presets', () => {
    const mem = new MemStore();
    const a = new SettingsStore(mem, false);
    a.update((s) => {
      s.gameplay.camera = 'tps';
      s.graphics.preset = 'baixo';
    });
    const b = new SettingsStore(mem, false);
    expect(b.get().gameplay.camera).toBe('tps');
    expect(b.get().graphics.preset).toBe('baixo');
    expect(b.get().graphics.renderScale).toBeCloseTo(0.6);
  });

  it('JSON corrompido não quebra o jogo', () => {
    const mem = new MemStore();
    mem.setItem('zona-hostil.settings', '{nope');
    expect(new SettingsStore(mem, true).get().graphics.preset).toBe('medio');
  });
});

describe('IK de duas articulações', () => {
  it('leva a extremidade até o alvo alcançável mantendo os comprimentos', () => {
    const hip = new Bone();
    const knee = new Bone();
    const foot = new Bone();
    const root = new Bone();
    root.add(hip);
    hip.add(knee);
    knee.add(foot);
    hip.position.set(0, 1, 0);
    knee.position.set(0, -0.45, 0.02);
    foot.position.set(0, -0.45, -0.02);
    root.updateMatrixWorld(true);
    const target = new Vector3(0.1, 0.35, 0.15);
    solveTwoBone(hip, knee, foot, target, new Vector3(0, 0.6, 1));
    const p = foot.getWorldPosition(new Vector3());
    expect(p.distanceTo(target)).toBeLessThan(1e-3);
    const k = knee.getWorldPosition(new Vector3());
    expect(k.distanceTo(hip.getWorldPosition(new Vector3()))).toBeCloseTo(Math.hypot(0.45, 0.02), 4);
    expect(k.z).toBeGreaterThan(0.1); // dobra para o lado do polo (joelho à frente)
  });
});

describe('Heightfield', () => {
  it('interpolação coincide com os vértices e é contínua', () => {
    const hf = Heightfield.fromFunction(10, 11, (x, z) => x * 0.5 + z * z * 0.1);
    expect(hf.heightAt(2, 3)).toBeCloseTo(2 * 0.5 + 0.9, 5);
    const a = hf.heightAt(1.999, 1.5);
    const b = hf.heightAt(2.001, 1.5);
    expect(Math.abs(a - b)).toBeLessThan(0.01);
    expect(hf.normalAt(0, 0).y).toBeGreaterThan(0.8);
  });
});
