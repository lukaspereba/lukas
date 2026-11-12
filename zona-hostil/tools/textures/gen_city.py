"""Texturas da cidade (Carapicuíba) — procedurais, baseadas nos materiais vistos nas fotos de referência.

Uso: python3 tools/textures/gen_city.py public/assets/textures/city
"""
from __future__ import annotations

import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

sys.path.insert(0, os.path.dirname(__file__))
from gen_textures import fbm, noise, normal_from_height  # noqa: E402

OUT = sys.argv[1] if len(sys.argv) > 1 else "public/assets/textures/city"
os.makedirs(OUT, exist_ok=True)


def save(arr, name, q=86):
    path = os.path.join(OUT, name)
    img = Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8))
    if name.endswith(".png"):
        img.save(path, optimize=True)
    else:
        img.convert("RGB").save(path, quality=q)
    print("ok", name)


def lerp(a, b, t):
    return a * (1 - t[..., None]) + np.asarray(b) * t[..., None]


def tile_voronoi(S, n, seed):
    """Voronoi tileável: devolve (distância à borda, id da célula)."""
    rng = np.random.default_rng(seed)
    pts = rng.random((n, 2)) * S
    allp = np.concatenate([pts + np.array([dx, dy]) * S for dx in (-1, 0, 1) for dy in (-1, 0, 1)])
    ids = np.tile(np.arange(n), 9)
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    d1 = np.full((S, S), 1e9, np.float32)
    d2 = np.full((S, S), 1e9, np.float32)
    cid = np.zeros((S, S), np.int32)
    for k, (px, py) in enumerate(allp):
        d = np.hypot(xx - px, yy - py)
        closer = d < d1
        d2 = np.where(closer, d1, np.minimum(d2, d))
        cid = np.where(closer, ids[k], cid)
        d1 = np.where(closer, d, d1)
    return d2 - d1, cid


S = 512

# 1) muro da escola: "pedras" azuis pintadas com contorno azul escuro (foto do muro da E.E. Basílio Bosniac)
edge, cid = tile_voronoi(S, 26, 3)
rng = np.random.default_rng(4)
shade = rng.random(26)[cid]
line = np.clip(1 - edge / 5.0, 0, 1)
# cada "pedra": branco no centro, azul claro na borda (pincelada), contorno azul escuro
inner = np.clip(edge / 38.0, 0, 1)
base = lerp(np.full((S, S, 3), (0.38, 0.62, 0.86)), (0.92, 0.94, 0.95), inner ** 0.6 * (0.7 + 0.3 * shade))
brush = fbm(S, 40, 5, 3)
base = base * (0.92 + 0.12 * brush[..., None])
base = lerp(base, (0.12, 0.30, 0.68), line)
save(base, "school_wall_c.jpg")
save(normal_from_height(fbm(S, 120, 6, 3) * 0.6 + line * 0.5, 2.0), "school_wall_n.jpg")

# 2) painel do shopping: faixas horizontais em tons de laranja/terracota com juntas
img = np.zeros((S, S, 3))
rows = 16
cols = 4
for r in range(rows):
    for c in range(cols):
        tone = rng.choice([0, 1, 2], p=[0.45, 0.35, 0.2])
        col = [(0.93, 0.47, 0.36), (0.80, 0.38, 0.28), (0.62, 0.30, 0.24)][tone]
        y0, y1 = r * S // rows, (r + 1) * S // rows
        x0, x1 = c * S // cols, (c + 1) * S // cols
        img[y0:y1, x0:x1] = col
img[(np.arange(S) % (S // rows) < 2)] *= 0.55
img[:, (np.arange(S) % (S // cols) < 2)] *= 0.6
img *= (0.94 + 0.08 * fbm(S, 30, 8, 3))[..., None]
save(img, "mall_panel_c.jpg")

# 3) tijolo aparente (igreja e casas)
def brick(S, mortar=(0.72, 0.70, 0.66), cols=((0.55, 0.25, 0.17), (0.62, 0.30, 0.20), (0.48, 0.22, 0.16)), seed=11):
    rng = np.random.default_rng(seed)
    bh, bw = S // 16, S // 4
    out = np.zeros((S, S, 3))
    h = np.zeros((S, S))
    for r in range(16):
        off = (bw // 2) * (r % 2)
        for c in range(-1, 5):
            x0 = c * bw + off
            col = np.array(cols[rng.integers(len(cols))]) * (0.9 + 0.2 * rng.random())
            xs = slice(max(x0, 0), min(x0 + bw, S))
            out[r * bh:(r + 1) * bh, xs] = col
            h[r * bh:(r + 1) * bh, xs] = 1
    m = np.zeros((S, S), bool)
    m[(np.arange(S) % bh) < 3, :] = True
    for r in range(16):
        off = (bw // 2) * (r % 2)
        for c in range(0, 6):
            x = (c * bw + off) % S
            m[r * bh:(r + 1) * bh, max(x - 2, 0):x + 2] = True
    out[m] = mortar
    h[m] = 0
    g = fbm(S, 60, seed + 1, 3)
    out *= (0.88 + 0.2 * g)[..., None]
    return out, normal_from_height(h * 0.7 + g * 0.3, 2.5)


c, n = brick(S)
save(c, "brick_c.jpg")
save(n, "brick_n.jpg")
c, n = brick(S, mortar=(0.60, 0.55, 0.48), cols=((0.72, 0.40, 0.26), (0.66, 0.36, 0.22), (0.78, 0.46, 0.30)), seed=21)
save(c, "brick_raw_c.jpg")  # bloco cerâmico/tijolo baiano das casas sem reboco

# 4) reboco pintado (claro, cor vem do material) com manchas de chuva
g = fbm(S, 8, 31, 4)
streak = noise(S, 60, 32, aniso=(0.05, 1.0))
c = np.repeat((0.88 + 0.1 * g - 0.18 * np.clip(streak - 0.55, 0, 1) * 3)[..., None], 3, -1)
save(c, "plaster_c.jpg")
save(normal_from_height(fbm(S, 200, 33, 2), 1.2), "plaster_n.jpg")

# 5) asfalto e calçada
g = fbm(S, 100, 41, 3)
agg = np.clip((noise(S, 200, 42) - 0.7) * 4, 0, 1)
c = np.repeat((0.24 + 0.08 * g + 0.1 * agg)[..., None], 3, -1) * np.array([1, 1, 1.03])
patch = np.clip((fbm(S, 5, 43, 3) - 0.6) * 5, 0, 1)
c = c * (1 - 0.15 * patch[..., None])
save(c, "asphalt_c.jpg")
side = np.repeat((0.62 + 0.08 * fbm(S, 40, 44, 3))[..., None], 3, -1)
j = (np.arange(S) % (S // 4) < 3)
side[j, :] *= 0.7
side[:, j] *= 0.7
save(side, "sidewalk_c.jpg")

# 6) piso de quadra (cimento queimado) com linhas de futsal + basquete, mapeado 1:1 na quadra (40 x 20 m)
W, H = 1024, 512
im = Image.new("RGB", (W, H), (110, 116, 120))
arr = np.asarray(im).astype(np.float32) / 255
arr *= (0.9 + 0.15 * fbm(512, 20, 51, 3)[np.arange(H)[:, None] % 512, np.arange(W)[None, :] % 512])[..., None]
im = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))
d = ImageDraw.Draw(im)
s = W / 40.0
lw = 3
d.rectangle([2, 2, W - 3, H - 3], outline=(235, 235, 230), width=lw)
d.line([(W / 2, 0), (W / 2, H)], fill=(235, 235, 230), width=lw)
d.ellipse([W / 2 - 3 * s, H / 2 - 3 * s, W / 2 + 3 * s, H / 2 + 3 * s], outline=(235, 235, 230), width=lw)
for side_x in (0, W):
    sgn = 1 if side_x == 0 else -1
    # área de futsal (semicírculo 6 m)
    d.arc([side_x - 6 * s, H / 2 - 6 * s - 1.5 * s, side_x + 6 * s, H / 2 + 6 * s + 1.5 * s], -90 if sgn > 0 else 90, 90 if sgn > 0 else 270, fill=(235, 235, 230), width=lw)
    # garrafão de basquete (amarelo)
    x0 = side_x
    x1 = side_x + sgn * 5.8 * s
    d.rectangle([min(x0, x1), H / 2 - 2.45 * s, max(x0, x1), H / 2 + 2.45 * s], outline=(230, 190, 60), width=lw)
    d.arc([x1 - 1.8 * s, H / 2 - 1.8 * s, x1 + 1.8 * s, H / 2 + 1.8 * s], -90 if sgn > 0 else 90, 90 if sgn > 0 else 270, fill=(230, 190, 60), width=lw)
    d.arc([side_x - 6.75 * s - 1.575 * s * 0, H / 2 - 6.75 * s, side_x + 6.75 * s, H / 2 + 6.75 * s], -90 if sgn > 0 else 90, 90 if sgn > 0 else 270, fill=(230, 190, 60), width=lw)
im.save(os.path.join(OUT, "court_gray.jpg"), quality=88)
print("ok court_gray.jpg")
# versão poliesportiva azul/verde do Parque do Planalto
im2 = Image.new("RGB", (W, H), (38, 120, 170))
d2 = ImageDraw.Draw(im2)
d2.rectangle([int(W * 0.07), int(H * 0.08), int(W * 0.93), int(H * 0.92)], fill=(40, 140, 110))
d2.ellipse([W / 2 - 3 * s, H / 2 - 3 * s, W / 2 + 3 * s, H / 2 + 3 * s], fill=(38, 120, 170), outline=(240, 240, 240), width=lw)
for side_x in (0, W):
    sgn = 1 if side_x == 0 else -1
    x1 = side_x + sgn * 5.8 * s
    d2.rectangle([min(side_x, x1), H / 2 - 2.45 * s, max(side_x, x1), H / 2 + 2.45 * s], fill=(38, 120, 170), outline=(240, 240, 240), width=lw)
d2.rectangle([2, 2, W - 3, H - 3], outline=(240, 240, 240), width=lw)
d2.line([(W / 2, 0), (W / 2, H)], fill=(240, 240, 240), width=lw)
im2.save(os.path.join(OUT, "court_blue.jpg"), quality=88)
print("ok court_blue.jpg")

# 7) telha cerâmica, telha metálica ondulada, chapa de porta de aço
yy = np.arange(S)[:, None]
xx = np.arange(S)[None, :]
wave = (np.sin(xx / S * 2 * math.pi * 10) * 0.5 + 0.5)
rowsh = ((yy % (S // 10)) / (S // 10))
tile = np.stack([0.62 + 0.15 * wave, 0.30 + 0.08 * wave, 0.20 + 0.05 * wave], -1) * (0.75 + 0.25 * rowsh)[..., None]
tile *= (0.9 + 0.15 * fbm(S, 30, 61, 3))[..., None]
save(tile, "roof_tile_c.jpg")
corr = np.sin(xx / S * 2 * math.pi * 24) * 0.5 + 0.5
metal = np.repeat((0.58 + 0.18 * corr + 0.06 * fbm(S, 20, 62, 3))[..., None] * np.ones((S, 1)), 3, -1)[..., :3]
metal = np.broadcast_to(metal, (S, S, 3)).copy()
rust = np.clip((fbm(S, 10, 63, 4) - 0.62) * 4, 0, 1)
metal = lerp(metal, (0.42, 0.28, 0.18), rust * 0.7)
save(metal, "metal_corr_c.jpg")
save(normal_from_height(np.broadcast_to(corr, (S, S)), 6.0), "metal_corr_n.jpg")
shutter = np.repeat(np.repeat((0.55 + 0.25 * (np.sin(yy / S * 2 * math.pi * 40) * 0.5 + 0.5))[..., None], S, 1), 3, -1)
shutter *= (0.9 + 0.1 * fbm(S, 30, 64, 3))[..., None]
graf = np.clip((fbm(S, 6, 65, 3) - 0.6) * 5, 0, 1)
shutter = lerp(shutter, (0.25, 0.45, 0.70), graf * 0.6)
save(shutter, "shutter_c.jpg")

# 8) recortes com transparência: alambrado (tela losangular) e cobogó
A = np.zeros((S, S, 4))
u = (xx + yy) % 32
v = (xx - yy) % 32
wire = ((u < 2) | (v < 2)).astype(float)
A[..., :3] = 0.62
A[..., 3] = wire
save(A, "chainlink.png")
cb = np.zeros((S, S, 4))
cell = S // 8
cx = (xx % cell) / cell
cy = (yy % cell) / cell
hole = (np.abs(cx - 0.5) < 0.32) & (np.abs(cy - 0.5) < 0.32)
diag = np.abs((cx - 0.5) - (cy - 0.5)) < 0.06
solid = (~hole) | diag
cb[..., :3] = 0.80 * (0.9 + 0.1 * fbm(S, 40, 71, 2))[..., None]
cb[..., 3] = solid.astype(float)
save(cb, "cobogo.png")

# 9) porcelanato do shopping (sujo/gasto) e azulejo de vestiário
t = np.full((S, S, 3), (0.80, 0.77, 0.70))
gl = ((xx % (S // 4)) < 2) | ((yy % (S // 4)) < 2)
t[gl] *= 0.75
dirt = np.clip((fbm(S, 7, 81, 4) - 0.5) * 2, 0, 1)
t = lerp(t, (0.45, 0.40, 0.33), dirt * 0.55)
save(t, "floor_tile_c.jpg")
az = np.full((S, S, 3), (0.90, 0.92, 0.93))
gl = ((xx % (S // 8)) < 2) | ((yy % (S // 8)) < 2)
az[gl] = (0.6, 0.62, 0.63)
save(az, "wall_tile_c.jpg")
# grama sintética do campo
gs = np.repeat((0.30 + 0.1 * noise(S, 180, 91, aniso=(0.3, 1)))[..., None], 3, -1) * np.array([0.55, 1.15, 0.45])
stripes = ((xx // (S // 4)) % 2 == 0)
gs[np.broadcast_to(stripes, (S, S))] *= 1.08
save(gs, "turf_c.jpg")
