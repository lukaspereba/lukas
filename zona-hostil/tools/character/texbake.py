"""Ferramentas de textura: rasterizador em espaço UV, ruído 3D e camuflagem procedural."""
from __future__ import annotations

import numpy as np


def raster_uv(uv_tris: np.ndarray, attr_tris: np.ndarray, size: int, pad: int = 4):
    """Rasteriza triângulos no espaço UV interpolando atributos por vértice.

    uv_tris: (T,3,2) em [0,1]; attr_tris: (T,3,K). Retorna (img (H,W,K), cobertura (H,W) bool).
    A borda é dilatada `pad` pixels para evitar costuras no mipmapping.
    """
    K = attr_tris.shape[2]
    img = np.zeros((size, size, K), dtype=np.float32)
    cov = np.zeros((size, size), dtype=bool)
    px = uv_tris.copy()
    px[..., 0] = px[..., 0] * size - 0.5
    px[..., 1] = (1.0 - px[..., 1]) * size - 0.5
    for t in range(px.shape[0]):
        p = px[t]
        x0 = max(int(np.floor(p[:, 0].min())), 0)
        x1 = min(int(np.ceil(p[:, 0].max())), size - 1)
        y0 = max(int(np.floor(p[:, 1].min())), 0)
        y1 = min(int(np.ceil(p[:, 1].max())), size - 1)
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1), np.arange(y0, y1 + 1))
        (ax, ay), (bx, by), (cx, cy) = p
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-12:
            continue
        w0 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
        w1 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
        w2 = 1.0 - w0 - w1
        eps = -0.02
        m = (w0 >= eps) & (w1 >= eps) & (w2 >= eps)
        if not m.any():
            continue
        a = attr_tris[t]
        vals = w0[m, None] * a[0] + w1[m, None] * a[1] + w2[m, None] * a[2]
        img[ys[m], xs[m]] = vals
        cov[ys[m], xs[m]] = True
    # dilatação simples das bordas
    for _ in range(pad):
        grown = cov.copy()
        acc = np.zeros_like(img)
        cnt = np.zeros(cov.shape, dtype=np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            sc = np.roll(cov, (dy, dx), axis=(0, 1))
            si = np.roll(img, (dy, dx), axis=(0, 1))
            add = sc & ~cov
            acc[add] += si[add]
            cnt[add] += 1
            grown |= sc
        newpx = grown & ~cov
        img[newpx] = acc[newpx] / np.maximum(cnt[newpx, None], 1)
        cov = grown
    return img, cov


def _hash3(ix, iy, iz, seed):
    h = (ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 144269504) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h = h ^ (h >> 16)
    return (h & 0xFFFF).astype(np.float32) / 65535.0


def value_noise3(p: np.ndarray, seed: int = 0) -> np.ndarray:
    """Ruído de valor 3D suave (p: (N,3)). Retorna [0,1]."""
    pf = np.floor(p)
    f = p - pf
    i = pf.astype(np.int64)
    u = f * f * (3 - 2 * f)
    out = np.zeros(p.shape[0], dtype=np.float32)
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                h = _hash3(i[:, 0] + dx, i[:, 1] + dy, i[:, 2] + dz, seed)
                wx = u[:, 0] if dx else 1 - u[:, 0]
                wy = u[:, 1] if dy else 1 - u[:, 1]
                wz = u[:, 2] if dz else 1 - u[:, 2]
                out += h * wx * wy * wz
    return out


def fbm3(p: np.ndarray, octaves: int = 4, seed: int = 0, lac: float = 2.03, gain: float = 0.5) -> np.ndarray:
    amp, tot, norm = 1.0, np.zeros(p.shape[0], dtype=np.float32), 0.0
    q = p.copy()
    for o in range(octaves):
        tot += amp * value_noise3(q, seed + o * 17)
        norm += amp
        amp *= gain
        q = q * lac + 3.17
    return tot / norm


CAMO_PALETTES = {
    # cores originais (sRGB 0-1): base, mancha 1, mancha 2, mancha 3
    "floresta": [(0.36, 0.38, 0.27), (0.21, 0.26, 0.17), (0.34, 0.28, 0.20), (0.15, 0.15, 0.12)],
    "deserto": [(0.66, 0.58, 0.44), (0.55, 0.47, 0.34), (0.45, 0.38, 0.27), (0.70, 0.65, 0.53)],
    "urbano": [(0.42, 0.43, 0.44), (0.27, 0.28, 0.30), (0.56, 0.57, 0.57), (0.14, 0.14, 0.15)],
    "serra": [(0.47, 0.44, 0.33), (0.31, 0.34, 0.23), (0.40, 0.31, 0.21), (0.58, 0.54, 0.42)],
}


def camo_colors(pos: np.ndarray, palette: str, scale: float = 9.0, seed: int = 7) -> np.ndarray:
    """Camuflagem por manchas orgânicas em espaço 3D (sem costuras de UV dentro das peças)."""
    cols = np.array(CAMO_PALETTES[palette], dtype=np.float32)
    p = pos * scale
    # distorção de domínio para manchas irregulares
    warp = np.stack([fbm3(p * 0.7, 3, seed + 1), fbm3(p * 0.7, 3, seed + 2), fbm3(p * 0.7, 3, seed + 3)], 1) - 0.5
    q = p + warp * 1.6
    out = np.repeat(cols[0][None], pos.shape[0], 0)
    for k, thr in ((1, 0.52), (2, 0.56), (3, 0.63)):
        n = fbm3(q * (1.0 + 0.25 * k), 4, seed + 31 * k)
        m = np.clip((n - thr) / 0.012, 0, 1)
        out = out * (1 - m[:, None]) + cols[k][None] * m[:, None]
    # leve variação de tingimento
    tint = (fbm3(p * 4.0, 2, seed + 99) - 0.5) * 0.06
    return np.clip(out + tint[:, None], 0, 1)


def box_blur(img: np.ndarray, r: int) -> np.ndarray:
    out = img.astype(np.float32)
    for axis in (0, 1):
        c = np.cumsum(np.pad(out, [(r + 1, r) if a == axis else (0, 0) for a in range(out.ndim)], mode="edge"), axis=axis)
        sl_hi = [slice(None)] * out.ndim
        sl_lo = [slice(None)] * out.ndim
        sl_hi[axis] = slice(2 * r + 1, None)
        sl_lo[axis] = slice(0, -2 * r - 1)
        out = (c[tuple(sl_hi)] - c[tuple(sl_lo)]) / (2 * r + 1)
    return out


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)
