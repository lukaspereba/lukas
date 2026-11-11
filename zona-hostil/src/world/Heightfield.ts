// Campo de alturas regular (terreno). Amostragem bilinear e normais por diferenças centrais.

import { Vector3 } from 'three';

export class Heightfield {
  readonly cell: number;

  /**
   * @param size   lado em metros
   * @param res    amostras por lado (vértices)
   * @param heights alturas (res*res), linha = z
   * @param minX   canto mínimo em X
   * @param minZ   canto mínimo em Z
   */
  constructor(
    readonly size: number,
    readonly res: number,
    readonly heights: Float32Array,
    readonly minX = -size / 2,
    readonly minZ = -size / 2,
  ) {
    this.cell = size / (res - 1);
  }

  static fromFunction(size: number, res: number, fn: (x: number, z: number) => number, minX = -size / 2, minZ = -size / 2): Heightfield {
    const h = new Float32Array(res * res);
    const cell = size / (res - 1);
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) h[j * res + i] = fn(minX + i * cell, minZ + j * cell);
    }
    return new Heightfield(size, res, h, minX, minZ);
  }

  sample(i: number, j: number): number {
    const r = this.res;
    i = i < 0 ? 0 : i >= r ? r - 1 : i;
    j = j < 0 ? 0 : j >= r ? r - 1 : j;
    return this.heights[j * r + i];
  }

  heightAt(x: number, z: number): number {
    const fx = (x - this.minX) / this.cell;
    const fz = (z - this.minZ) / this.cell;
    const i = Math.floor(fx);
    const j = Math.floor(fz);
    const tx = fx - i;
    const tz = fz - j;
    // mesma triangulação da malha (diagonal i,j+1 -> i+1,j) para coincidir com o visual
    const h00 = this.sample(i, j);
    const h10 = this.sample(i + 1, j);
    const h01 = this.sample(i, j + 1);
    const h11 = this.sample(i + 1, j + 1);
    if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
    return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
  }

  normalAt(x: number, z: number, out = new Vector3()): Vector3 {
    const e = this.cell * 0.5;
    const hl = this.heightAt(x - e, z);
    const hr = this.heightAt(x + e, z);
    const hd = this.heightAt(x, z - e);
    const hu = this.heightAt(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }

  contains(x: number, z: number): boolean {
    return x >= this.minX && z >= this.minZ && x <= this.minX + this.size && z <= this.minZ + this.size;
  }
}
