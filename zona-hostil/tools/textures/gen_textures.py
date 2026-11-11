"""Gera texturas PBR tileáveis do mundo (albedo + normal) — 100% procedurais (sem copyright).

Uso: python3 tools/textures/gen_textures.py public/assets/textures
"""
from __future__ import annotations

import os
import sys

import numpy as np
from PIL import Image


def noise(size, freq, seed, aniso=(1.0, 1.0)):
    rng = np.random.default_rng(seed)
    w = rng.standard_normal((size, size))
    fx = np.fft.fftfreq(size)[:, None] * size * aniso[0]
    fy = np.fft.fftfreq(size)[None, :] * size * aniso[1]
    f = np.sqrt(fx * fx + fy * fy)
    n = np.real(np.fft.ifft2(np.fft.fft2(w) * np.exp(-(f / freq) ** 2)))
    n -= n.min()
    return n / max(n.max(), 1e-9)


def fbm(size, base, seed, octaves=5, gain=0.5):
    out = np.zeros((size, size))
    amp, tot, f = 1.0, 0.0, base
    for o in range(octaves):
        out += noise(size, f, seed + o * 13) * amp
        tot += amp
        amp *= gain
        f *= 2.1
    return out / tot


def normal_from_height(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    n = np.stack([-dx, dy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def save(arr, path, q=88):
    Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)).convert("RGB").save(path, quality=q)


def lerp(a, b, t):
    return a * (1 - t[..., None]) + b * t[..., None]


def grass(S):
    base = fbm(S, 3, 1)
    blades = noise(S, 160, 2, aniso=(0.25, 1.0)) * 0.6 + noise(S, 220, 3, aniso=(1.0, 0.3)) * 0.4
    patches = fbm(S, 4, 4, 3)
    dry = np.clip((patches - 0.52) * 4, 0, 1)
    c_green = np.array([0.20, 0.30, 0.10])
    c_dark = np.array([0.10, 0.17, 0.06])
    c_dry = np.array([0.42, 0.40, 0.22])
    col = lerp(c_dark, c_green, np.clip(blades * 1.3 - 0.1, 0, 1))
    col = lerp(col, c_dry, dry * 0.7)
    dirt = np.clip((fbm(S, 6, 5, 3) - 0.66) * 6, 0, 1)
    col = lerp(col, np.array([0.30, 0.24, 0.16]), dirt * 0.8)
    col *= (0.85 + 0.3 * base)[..., None]
    h = blades * 0.8 + base * 0.2
    return col, normal_from_height(h, 2.5)


def dirt(S):
    base = fbm(S, 4, 11)
    pebbles = np.clip((noise(S, 90, 12) - 0.62) * 8, 0, 1)
    fine = noise(S, 200, 13)
    col = lerp(np.array([0.33, 0.25, 0.17]), np.array([0.45, 0.36, 0.26]), base)
    col = lerp(col, np.array([0.52, 0.48, 0.42]), pebbles * 0.7)
    col *= (0.9 + 0.2 * fine)[..., None]
    h = base * 0.4 + pebbles * 0.5 + fine * 0.1
    return col, normal_from_height(h, 3.0)


def rock(S):
    big = fbm(S, 3, 21, 6, 0.55)
    ridged = 1 - np.abs(noise(S, 10, 22) * 2 - 1)
    cracks = np.clip((1 - np.abs(noise(S, 30, 23) * 2 - 1) - 0.9) * 10, 0, 1)
    strata = (np.sin(np.linspace(0, 40 * np.pi, S))[:, None] * 0.5 + 0.5) * noise(S, 8, 24)
    col = lerp(np.array([0.30, 0.29, 0.27]), np.array([0.55, 0.52, 0.47]), np.clip(big * 1.2 - 0.1, 0, 1))
    col = lerp(col, np.array([0.40, 0.35, 0.28]), strata * 0.35)
    col *= (1 - 0.55 * cracks)[..., None]
    lich = np.clip((fbm(S, 8, 25, 3) - 0.62) * 5, 0, 1)
    col = lerp(col, np.array([0.38, 0.40, 0.28]), lich * 0.4)
    h = big * 0.6 + ridged * 0.3 - cracks * 0.4 + strata * 0.1
    return col, normal_from_height(h, 4.0)


def concrete(S):
    base = fbm(S, 5, 31)
    fine = noise(S, 220, 32)
    stains = np.clip((fbm(S, 3, 33, 3) - 0.55) * 3, 0, 1)
    pores = np.clip((noise(S, 180, 34) - 0.75) * 10, 0, 1)
    col = lerp(np.array([0.56, 0.55, 0.52]), np.array([0.66, 0.65, 0.62]), base)
    col = lerp(col, np.array([0.40, 0.39, 0.36]), stains * 0.5)
    col *= (0.95 + 0.1 * fine - 0.25 * pores)[..., None]
    h = base * 0.3 + fine * 0.4 - pores * 0.6
    return col, normal_from_height(h, 1.6)


def plywood(S):
    grain = noise(S, 60, 41, aniso=(1.0, 0.06))
    rings = np.sin((np.arange(S)[None, :] * 0.18 + grain * 40)) * 0.5 + 0.5
    col = lerp(np.array([0.30, 0.31, 0.20]), np.array([0.36, 0.37, 0.25]), rings * 0.6 + grain * 0.4)
    edge = np.zeros((S, S))
    b = S // 32
    edge[:b, :] = edge[-b:, :] = edge[:, :b] = edge[:, -b:] = 1
    col = lerp(col, np.array([0.22, 0.22, 0.15]), edge * 0.8)
    wear = np.clip((fbm(S, 8, 42, 3) - 0.7) * 6, 0, 1)
    col = lerp(col, np.array([0.55, 0.46, 0.32]), wear * 0.6)
    h = rings * 0.2 + grain * 0.3 - edge * 0.3
    return col, normal_from_height(h, 2.0)


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "public/assets/textures"
    os.makedirs(out, exist_ok=True)
    S = 1024
    for name, fn in (("grass", grass), ("dirt", dirt), ("rock", rock), ("concrete", concrete), ("crate", plywood)):
        c, n = fn(S if name != "crate" else 512)
        save(c, os.path.join(out, f"{name}_c.jpg"))
        save(n, os.path.join(out, f"{name}_n.jpg"), 90)
        print("ok", name)


if __name__ == "__main__":
    main()
