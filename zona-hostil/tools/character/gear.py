"""Equipamento tático procedural para os soldados de ZONA HOSTIL.

Cada peça é modelada a partir de medidas reais do corpo gerado (raycast na superfície do
uniforme/corpo), recebe UV por projeção em caixa (texturas de nylon com MOLLE em escala real)
e pesos de esqueleto: rígidos (capacete/mochila) ou transferidos do vértice de pele mais próximo.
"""
from __future__ import annotations

import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
from PIL import Image

GEAR_COLORS = {
    "ranger": {"vest": (0.24, 0.26, 0.19), "helmet": (0.28, 0.30, 0.22), "glove": (0.12, 0.12, 0.10),
               "boot": (0.20, 0.17, 0.12), "pack": (0.22, 0.24, 0.17), "strap": (0.10, 0.10, 0.08)},
    "coyote": {"vest": (0.46, 0.38, 0.27), "helmet": (0.50, 0.43, 0.32), "glove": (0.30, 0.25, 0.18),
               "boot": (0.42, 0.34, 0.24), "pack": (0.44, 0.37, 0.26), "strap": (0.25, 0.20, 0.14)},
    "preto": {"vest": (0.08, 0.085, 0.09), "helmet": (0.10, 0.10, 0.11), "glove": (0.06, 0.06, 0.06),
              "boot": (0.07, 0.07, 0.07), "pack": (0.09, 0.09, 0.10), "strap": (0.04, 0.04, 0.04)},
    "oliva": {"vest": (0.30, 0.30, 0.21), "helmet": (0.33, 0.33, 0.24), "glove": (0.16, 0.15, 0.11),
              "boot": (0.24, 0.20, 0.14), "pack": (0.29, 0.29, 0.20), "strap": (0.14, 0.13, 0.10)},
}

TORSO_BONES = ("pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "clavicle_l", "clavicle_r")
MOLLE_TILE = 0.1524  # 4 fileiras MOLLE (1.5") por repetição da textura


# --------------------------------------------------------------------------------------
# Texturas procedurais (tileáveis via ruído filtrado por FFT)
# --------------------------------------------------------------------------------------

def tile_noise(size: int, freq: float, seed: int) -> np.ndarray:
    rng = np.random.default_rng(seed)
    white = rng.standard_normal((size, size))
    fx = np.fft.fftfreq(size)[:, None]
    fy = np.fft.fftfreq(size)[None, :]
    f = np.sqrt(fx * fx + fy * fy) * size
    filt = np.exp(-(f / freq) ** 2)
    n = np.real(np.fft.ifft2(np.fft.fft2(white) * filt))
    n -= n.min()
    return n / max(n.max(), 1e-9)


def height_to_normal(h: np.ndarray, strength: float) -> np.ndarray:
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    n = np.stack([-dx, dy, np.ones_like(h)], -1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def save(arr, path, q=90):
    Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)).convert("RGB").save(path, quality=q)
    return path


def make_textures(work: str, tag: str) -> dict:
    S = 512
    os.makedirs(work, exist_ok=True)
    # nylon cordura: trama fina + fileiras de fita MOLLE horizontais
    weave_x = (np.sin(np.arange(S) * 2 * math.pi * 96 / S)[None, :] * 0.5 + 0.5)
    weave_y = (np.sin(np.arange(S) * 2 * math.pi * 96 / S)[:, None] * 0.5 + 0.5)
    weave = (weave_x * 0.5 + weave_y * 0.5)
    rows = np.zeros((S, S))
    row_h = S // 4
    yy = np.arange(S) % row_h
    band = ((yy > row_h * 0.18) & (yy < row_h * 0.82)).astype(float)[:, None]
    # costuras verticais da fita a cada 1" (aprox.)
    xx = np.arange(S) % (S // 6)
    stitch = (xx < 3).astype(float)[None, :]
    rows = band * (1 - 0.6 * stitch)
    stains = tile_noise(S, 6, 3)
    grain = tile_noise(S, 90, 4)
    h = rows * 0.55 + weave * 0.12 + grain * 0.15
    alb = 0.80 + 0.12 * stains[..., None] + 0.08 * grain[..., None] - 0.10 * (rows[..., None] * 0.3)
    alb = np.repeat(alb, 3, -1)
    nylon_c = save(alb, os.path.join(work, f"{tag}_nylon_c.jpg"))
    nylon_n = save(height_to_normal(h, 3.0), os.path.join(work, f"{tag}_nylon_n.jpg"), 92)
    # pintura do capacete: textura granulada fosca
    paint = tile_noise(S, 140, 8) * 0.5 + tile_noise(S, 12, 9) * 0.5
    h_alb = np.repeat((0.95 + 0.05 * paint)[..., None], 3, -1)
    helmet_c = save(h_alb, os.path.join(work, f"{tag}_helmet_c.jpg"))
    helmet_n = save(height_to_normal(tile_noise(S, 160, 10), 1.2), os.path.join(work, f"{tag}_helmet_n.jpg"), 92)
    # couro/tecido de bota
    lea = tile_noise(S, 70, 12) * 0.6 + tile_noise(S, 8, 13) * 0.4
    boot_c = save(np.repeat((0.8 + 0.2 * lea)[..., None], 3, -1), os.path.join(work, f"{tag}_bootup_c.jpg"))
    boot_n = save(height_to_normal(tile_noise(S, 110, 14) + weave * 0.2, 2.0), os.path.join(work, f"{tag}_bootup_n.jpg"), 92)
    return dict(nylon=(nylon_c, nylon_n), helmet=(helmet_c, helmet_n), boot=(boot_c, boot_n))


def material(name, tex_c, tex_n, color, rough, normal_strength=1.0):
    """Material PBR; a cor é aplicada direto na textura (o exportador glTF ignora nós de mistura)."""
    src = np.asarray(Image.open(tex_c).convert("RGB")).astype(np.float32) / 255.0
    col = np.array(color, dtype=np.float32)
    colored = os.path.join(os.path.dirname(tex_c), os.path.basename(tex_c).replace("_c.jpg", f"_{name}.jpg"))
    save(src * col[None, None] * 1.12, colored)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = rough
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(colored)
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    tn = nt.nodes.new("ShaderNodeTexImage")
    tn.image = bpy.data.images.load(tex_n)
    tn.image.colorspace_settings.name = "Non-Color"
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nm.inputs["Strength"].default_value = normal_strength
    nt.links.new(tn.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


# --------------------------------------------------------------------------------------
# Geometria
# --------------------------------------------------------------------------------------

class Piece:
    """Acumula geometria (bmesh) com destino de pesos: osso rígido ou 'transfer'."""

    def __init__(self, bm: bmesh.types.BMesh, weight_mode: str, mat_slot: int):
        self.bm = bm
        self.weight_mode = weight_mode
        self.mat = mat_slot


def rounded_box(sx, sy, sz, bevel=0.006, segs=2) -> bmesh.types.BMesh:
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * sx, v.co.y * sy, v.co.z * sz))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(sx, sy, sz) * 0.45), segments=segs,
                        affect="EDGES", profile=0.5)
    return bm


def transform(bm, mat: Matrix):
    bmesh.ops.transform(bm, matrix=mat, verts=list(bm.verts))
    return bm


def sweep_strip(points, normals, width, thick, closed=False) -> bmesh.types.BMesh:
    """Fita (seção retangular) ao longo de uma curva; normals = direção 'para fora'."""
    bm = bmesh.new()
    rings = []
    n = len(points)
    for i in range(n):
        p = Vector(points[i])
        nrm = Vector(normals[i]).normalized()
        if closed:
            t = Vector(points[(i + 1) % n]) - Vector(points[i - 1])
        else:
            t = Vector(points[min(i + 1, n - 1)]) - Vector(points[max(i - 1, 0)])
        t.normalize()
        side = t.cross(nrm).normalized()
        hw = width * 0.5
        ring = [bm.verts.new(p + side * hw), bm.verts.new(p + side * hw + nrm * thick),
                bm.verts.new(p - side * hw + nrm * thick), bm.verts.new(p - side * hw)]
        rings.append(ring)
    seg = n if closed else n - 1
    for i in range(seg):
        a, b = rings[i], rings[(i + 1) % n]
        for k in range(4):
            bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
    if not closed:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bm.normal_update()
    return bm


def merge_into(dst: bmesh.types.BMesh, src: bmesh.types.BMesh):
    me = bpy.data.meshes.new("_tmp")
    src.to_mesh(me)
    dst.from_mesh(me)
    bpy.data.meshes.remove(me)


def box_uv(bm: bmesh.types.BMesh, tile: float):
    uv = bm.loops.layers.uv.verify()
    bm.normal_update()
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for loop in f.loops:
            c = loop.vert.co
            if ax == 0:
                u, v = c.y, c.z
            elif ax == 1:
                u, v = c.x, c.z
            else:
                u, v = c.x, c.y
            loop[uv].uv = (u / tile, v / tile)


# --------------------------------------------------------------------------------------
# Construção
# --------------------------------------------------------------------------------------

class GearBuilder:
    def __init__(self, b):
        self.b = b
        self.col = GEAR_COLORS[b.cfg["gear_color"]]
        self.pieces: list[Piece] = []
        Vb = b.Vb
        self.Vb = Vb
        # superfícies de referência
        self.torso_bvh = self._bvh_from(b.uniform_ob, TORSO_BONES, 0.6)
        self.leg_bvh = {s: self._bvh_from(b.uniform_ob, (f"thigh_{s}", f"calf_{s}", f"foot_{s}", f"ball_{s}"), 0.5,
                                          extra=[b.shoes_ob], side=(1 if s == "l" else -1)) for s in ("l", "r")}
        # pesos transferidos da malha corporal COMPLETA (inclui a pele oculta sob a roupa)
        self.body_all = np.array(sorted({v for f, g in zip(b.base.faces, b.base.groups) if g == "body" for v in f}))
        self.body_kd = KDTree(len(self.body_all))
        for i, vi in enumerate(self.body_all):
            self.body_kd.insert(Vector(Vb[vi]), i)
        self.body_kd.balance()
        J = b.joints
        self.neck = Vector(J["neck_01"][0])
        self.head = Vector(J["head"][0])
        self.sp3 = Vector(J["spine_03"][0])
        self.sp2 = Vector(J["spine_02"][0])
        self.sp1 = Vector(J["spine_01"][0])
        self.pelvis = Vector(J["pelvis"][0])
        self.clav_l = Vector(J["clavicle_l"][1])
        self.clav_r = Vector(J["clavicle_r"][1])

    def _bvh_from(self, ob, bones, thr, extra=(), side=0):
        b = self.b
        vg_idx = {g.name: g.index for g in ob.vertex_groups}
        wsum = np.zeros(len(ob.data.vertices))
        for v in ob.data.vertices:
            s = 0.0
            for g in v.groups:
                name = ob.vertex_groups[g.group].name
                if name in bones:
                    s += g.weight
            wsum[v.index] = s
        verts = [tuple(v.co) for v in ob.data.vertices]
        polys = [list(p.vertices) for p in ob.data.polygons if all(wsum[i] > thr for i in p.vertices)]
        for e in extra:
            off = len(verts)
            verts += [tuple(v.co) for v in e.data.vertices]
            polys += [[off + i for i in p.vertices] for p in e.data.polygons
                      if side == 0 or all(e.data.vertices[i].co.x * side > 0 for i in p.vertices)]
        # o corpo também conta (pescoço/ombros expostos)
        off = len(verts)
        verts += [tuple(c) for c in b.Vb[b.body_used]]
        bw = b.Wd[b.body_used][:, [b.bone_index[x] for x in bones]].sum(1)
        remap = {vi: i for i, vi in enumerate(b.body_used)}
        for f in b.body_faces_old:
            if all(bw[remap[v]] > thr for v in f):
                polys.append([off + remap[v] for v in f])
        _ = vg_idx
        return BVHTree.FromPolygons(verts, polys)

    def surf(self, bvh, center: Vector, direction: Vector, offset: float, fallback: float = 0.15):
        d = direction.normalized()
        origin = center + d * 0.8
        hit = bvh.ray_cast(origin, -d, 1.6)
        if hit[0] is None:
            return center + d * (fallback + offset), d
        return hit[0] + d * offset, hit[1]

    def torso_ring(self, z, offset, n=48, center_y=None):
        c = Vector((0.0, self.sp2.y if center_y is None else center_y, z))
        pts, nrms = [], []
        for i in range(n):
            a = 2 * math.pi * i / n
            d = Vector((math.sin(a), -math.cos(a), 0.0))
            p, _ = self.surf(self.torso_bvh, c, d, offset)
            pts.append(p)
            nrms.append(d)
        # suaviza o perfil (remove saliências anatômicas)
        P = np.array([tuple(p) for p in pts])
        for _ in range(3):
            P = (np.roll(P, 1, 0) + 2 * P + np.roll(P, -1, 0)) / 4
        return [Vector(p) for p in P], nrms

    def add(self, bm, mode, slot):
        self.pieces.append(Piece(bm, mode, slot))

    # ---------------- colete (plate carrier) ----------------
    def vest(self):
        chest_top = self.clav_l.z - 0.035
        z_low = self.sp1.z - 0.015
        # faixa abdominal (cummerbund)
        rings_z = np.linspace(z_low, self.sp3.z - 0.02, 4)
        rings = [self.torso_ring(z, 0.028)[0] for z in rings_z]
        bm = bmesh.new()
        vr = [[bm.verts.new(p) for p in r] for r in rings]
        n = len(rings[0])
        for j in range(len(vr) - 1):
            for i in range(n):
                bm.faces.new((vr[j][i], vr[j][(i + 1) % n], vr[j + 1][(i + 1) % n], vr[j + 1][i]))
        bm.normal_update()
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        self._solidify(bm, 0.014)
        self.add(bm, "transfer", 0)

        # placas frontal e traseira (levemente curvas)
        for side in (-1, 1):  # -1 frente (-Y), +1 costas
            zc = (chest_top + z_low + 0.06) * 0.5
            hgt = chest_top - (z_low + 0.04)
            pts = []
            front_y = None
            for zz in np.linspace(z_low + 0.04, chest_top, 7):
                p, _ = self.surf(self.torso_bvh, Vector((0, self.sp2.y, zz)), Vector((0, side, 0)), 0.0)
                front_y = p.y if front_y is None else (min(front_y, p.y) if side < 0 else max(front_y, p.y))
                pts.append(p)
            y0 = front_y + side * 0.032
            plate = self._curved_plate(0.27, hgt, 0.028, 0.55, side)
            transform(plate, Matrix.Translation((0, y0, zc)))
            self.add(plate, "transfer", 0)
            # bolsa de carregadores (3x) e painel administrativo na frente
            if side < 0:
                for k in (-1, 0, 1):
                    pouch = rounded_box(0.074, 0.044, 0.115, 0.008)
                    flap = rounded_box(0.078, 0.05, 0.03, 0.006)
                    transform(flap, Matrix.Translation((0, -0.004, 0.06)))
                    merge_into(pouch, flap)
                    transform(pouch, Matrix.Translation((k * 0.082, y0 - 0.014 - 0.022, z_low + 0.12)))
                    self.add(pouch, "transfer", 0)
                admin = rounded_box(0.17, 0.026, 0.095, 0.007)
                transform(admin, Matrix.Translation((0, y0 - 0.014 - 0.013, chest_top - 0.075)))
                self.add(admin, "transfer", 0)
            else:
                # painel de hidratação nas costas
                hyd = rounded_box(0.22, 0.03, 0.25, 0.01)
                transform(hyd, Matrix.Translation((0, y0 + 0.014 + 0.015, zc + 0.01)))
                self.add(hyd, "transfer", 0)

        # alças de ombro
        for sx in (-1, 1):
            pts, nrms = [], []
            sh = self.clav_l if sx > 0 else self.clav_r
            cx = sx * 0.095
            center = Vector((cx, self.sp3.y, sh.z - 0.08))
            for t in np.linspace(-1.25, 1.25, 15):
                p, _ = self.surf(self.torso_bvh, center, Vector((0.0, math.sin(t), math.cos(t))), 0.024)
                pts.append(p)
                nrms.append(Vector((0.0, math.sin(t), math.cos(t))))
            self.add(sweep_strip(pts, nrms, 0.055, 0.012), "transfer", 0)
        # rádio (lado esquerdo) e bolsa de granada (direito)
        zr = self.sp2.z - 0.02
        for sx, size in ((1, (0.045, 0.065, 0.14)), (-1, (0.05, 0.05, 0.09))):
            p, _ = self.surf(self.torso_bvh, Vector((0, self.sp2.y, zr)), Vector((sx, 0.15, 0)), 0.045)
            box = rounded_box(*size, 0.008)
            transform(box, Matrix.Translation(p + Vector((sx * size[0] * 0.5, 0, 0))))
            self.add(box, "transfer", 0)
            if sx > 0:
                ant = rounded_box(0.006, 0.006, 0.16, 0.002, 1)
                transform(ant, Matrix.Translation(p + Vector((sx * 0.03, 0.02, 0.14))))
                self.add(ant, "transfer", 2)

    def _curved_plate(self, w, h, t, radius, side) -> bmesh.types.BMesh:
        bm = bmesh.new()
        nx, nz = 12, 10
        grid = []
        for j in range(nz + 1):
            row = []
            zz = -h / 2 + h * j / nz
            for i in range(nx + 1):
                xx = -w / 2 + w * i / nx
                # cantos superiores chanfrados (corte "shooter")
                top_cut = max(0.0, abs(xx) - (w / 2 - 0.055)) * 1.1 if zz > h / 2 - 0.06 else 0
                zc = min(zz, h / 2 - top_cut)
                row.append((xx, -side * (radius - math.sqrt(max(radius * radius - xx * xx, 0))), zc))
            grid.append(row)
        vf = [[bm.verts.new(Vector(p)) for p in row] for row in grid]
        for j in range(nz):
            for i in range(nx):
                bm.faces.new((vf[j][i], vf[j][i + 1], vf[j + 1][i + 1], vf[j + 1][i]))
        bm.normal_update()
        bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
        self._solidify(bm, t, outward=Vector((0, side, 0)))
        return bm

    def _solidify(self, bm, thick, outward: Vector | None = None):
        ret = bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=thick)
        _ = ret
        bm.normal_update()
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))

    # ---------------- capacete ----------------
    def helmet(self):
        b = self.b
        head_w = b.Wd[:, b.bone_index["head"]]
        eye_z = 0.5 * (b.joint("joint-l-eye")[2] + b.joint("joint-r-eye")[2])
        sel = (head_w > 0.6) & (self.Vb[:, 2] > eye_z - 0.01)
        sel &= np.isin(np.arange(len(self.Vb)), b.body_used)
        P = self.Vb[sel]
        top = P[:, 2].max()
        band = P[(P[:, 2] > eye_z + 0.025) & (P[:, 2] < eye_z + 0.09)]
        cx = 0.0
        cy = (band[:, 1].min() + band[:, 1].max()) * 0.5 + 0.006
        rx = np.abs(band[:, 0]).max() + 0.030
        ry = (band[:, 1].max() - band[:, 1].min()) * 0.5 + 0.032
        cz = eye_z - 0.005
        rz = top - cz + 0.028
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=1.0)
        for v in bm.verts:
            v.co = Vector((cx + v.co.x * rx, cy + v.co.y * ry, cz + v.co.z * rz))
        # recorte "high cut": frente na sobrancelha, laterais altas (orelhas), nuca mais baixa
        kill = []
        for v in bm.verts:
            rel = v.co - Vector((cx, cy, cz))
            th = abs(math.atan2(rel.x, -rel.y))
            front = 0.042
            side = 0.030
            back = -0.030
            if th < 0.9:
                lim = front
            elif th < 1.9:
                k = (th - 0.9) / 1.0
                lim = front * (1 - k) + side * k
                # recorte alto sobre a orelha
                if 1.25 < th < 2.05:
                    lim = max(lim, 0.052)
            else:
                k = min((th - 1.9) / 0.9, 1)
                lim = side * (1 - k) + back * k
            if rel.z < lim:
                kill.append(v)
        bmesh.ops.delete(bm, geom=kill, context="VERTS")
        bm.normal_update()
        bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
        self._solidify(bm, 0.011)
        self.add(bm, "head", 1)
        # trilhos laterais, suporte de visão noturna e velcro superior
        for sx in (-1, 1):
            rail = rounded_box(0.012, 0.095, 0.022, 0.004)
            transform(rail, Matrix.Rotation(math.radians(-8), 4, "X"))
            transform(rail, Matrix.Translation((sx * (rx - 0.004), cy + 0.008, cz + 0.058)))
            self.add(rail, "head", 1)
        shroud = rounded_box(0.05, 0.016, 0.032, 0.005)
        transform(shroud, Matrix.Translation((0, cy - ry - 0.002, cz + 0.07)))
        self.add(shroud, "head", 2)
        # jugular: fitas finas até sob o queixo
        chin_y = self.head.y - 0.075
        chin_z = eye_z - 0.105
        for sx in (-1, 1):
            pts = [Vector((sx * (rx - 0.012), cy + 0.01, cz + 0.035)),
                   Vector((sx * (rx - 0.022), cy - 0.01, cz - 0.03)),
                   Vector((sx * 0.06, chin_y + 0.035, chin_z + 0.01)),
                   Vector((sx * 0.02, chin_y + 0.012, chin_z - 0.006))]
            nrms = [Vector((sx, 0, 0)), Vector((sx, -0.3, 0)), Vector((sx * 0.5, -0.5, -0.5)), Vector((0, -0.6, -0.8))]
            self.add(sweep_strip(pts, nrms, 0.016, 0.003), "head", 3)

    # ---------------- mochila ----------------
    def backpack(self):
        z_top = self.clav_l.z - 0.05
        z_bot = self.sp1.z + 0.0
        back_y = None
        for zz in np.linspace(z_bot, z_top, 6):
            p, _ = self.surf(self.torso_bvh, Vector((0, self.sp2.y, zz)), Vector((0, 1, 0)), 0.0)
            back_y = p.y if back_y is None else max(back_y, p.y)
        y0 = back_y + 0.032 + 0.028 + 0.004  # sobre placa traseira
        h = z_top - z_bot
        main = rounded_box(0.30, 0.15, h, 0.035, 3)
        transform(main, Matrix.Translation((0, y0 + 0.075, z_bot + h / 2)))
        self.add(main, "spine_03", 0)
        front = rounded_box(0.24, 0.06, h * 0.5, 0.02, 2)
        transform(front, Matrix.Translation((0, y0 + 0.15 + 0.022, z_bot + h * 0.3)))
        self.add(front, "spine_03", 0)
        lid = rounded_box(0.28, 0.13, 0.05, 0.02, 2)
        transform(lid, Matrix.Translation((0, y0 + 0.08, z_top + 0.012)))
        self.add(lid, "spine_03", 0)
        for sx in (-1, 1):
            side = rounded_box(0.05, 0.10, h * 0.42, 0.016, 2)
            transform(side, Matrix.Translation((sx * 0.172, y0 + 0.08, z_bot + h * 0.32)))
            self.add(side, "spine_03", 0)
            # compressão
            for zz in (0.3, 0.7):
                strap = rounded_box(0.31, 0.155, 0.018, 0.004, 1)
                transform(strap, Matrix.Translation((0, y0 + 0.076, z_bot + h * zz)))
                self.add(strap, "spine_03", 3)
                break

    # ---------------- botas (cano) e joelheiras ----------------
    def boots_and_pads(self):
        b = self.b
        for s in ("l", "r"):
            ank = Vector(b.joint(f"joint-{s}-ankle"))
            knee = Vector(b.joint(f"joint-{s}-knee"))
            rings = []
            for zz in np.linspace(0.07, 0.235, 5):
                k = (zz - ank.z) / (knee.z - ank.z)
                c = ank + (knee - ank) * k
                c.z = zz
                pts = []
                for i in range(32):
                    a = 2 * math.pi * i / 32
                    d = Vector((math.sin(a), -math.cos(a), 0))
                    p, _ = self.surf(self.leg_bvh[s], c, d, 0.006, 0.05)
                    if (p - c).length > 0.085:
                        p = c + d * 0.07
                    pts.append(p)
                P = np.array([tuple(p) for p in pts])
                for _ in range(2):
                    P = (np.roll(P, 1, 0) + 2 * P + np.roll(P, -1, 0)) / 4
                rings.append([Vector(p) for p in P])
            bm = bmesh.new()
            vr = [[bm.verts.new(p) for p in r] for r in rings]
            for j in range(len(vr) - 1):
                for i in range(32):
                    bm.faces.new((vr[j][i], vr[j][(i + 1) % 32], vr[j + 1][(i + 1) % 32], vr[j + 1][i]))
            bm.normal_update()
            bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
            self._solidify(bm, 0.008)
            self.add(bm, "transfer", 4)
            # joelheira
            kd = Vector((0, -1, 0.05))
            p, nrm = self.surf(self.leg_bvh[s], knee + Vector((0, -0.02, 0.0)), kd, 0.016, 0.06)
            pad = rounded_box(0.10, 0.03, 0.13, 0.014, 3)
            transform(pad, Matrix.Translation(p))
            self.add(pad, "transfer", 1)
            ring = []
            nr = []
            for i in range(24):
                a = 2 * math.pi * i / 24
                d = Vector((math.sin(a), -math.cos(a), 0))
                q, _ = self.surf(self.leg_bvh[s], knee + Vector((0, 0, -0.045)), d, 0.006, 0.06)
                ring.append(q)
                nr.append(d)
            self.add(sweep_strip(ring, nr, 0.025, 0.004, closed=True), "transfer", 3)

    # ---------------- montagem ----------------
    def finalize(self):
        b = self.b
        tex = make_textures(b.work, b.vname)
        mats = [
            material("GearNylon", *tex["nylon"], self.col["vest"], 0.92, 0.9),
            material("GearHard", *tex["helmet"], self.col["helmet"], 0.68, 0.5),
            material("GearMetal", *tex["helmet"], (0.09, 0.09, 0.09), 0.45, 0.3),
            material("GearStrap", *tex["nylon"], self.col["strap"], 0.9, 0.6),
            material("BootUpper", *tex["boot"], self.col["boot"], 0.75, 0.8),
        ]
        groups: dict[int, list[Piece]] = {}
        for p in self.pieces:
            groups.setdefault(p.mat, []).append(p)
        for slot, plist in groups.items():
            bm_all = bmesh.new()
            modes = []
            for p in plist:
                n0 = len(bm_all.verts)
                merge_into(bm_all, p.bm)
                bm_all.verts.ensure_lookup_table()
                modes.append((n0, len(bm_all.verts), p.weight_mode))
            box_uv(bm_all, MOLLE_TILE if slot in (0, 3) else 0.12)
            me = bpy.data.meshes.new(f"Gear_{mats[slot].name}")
            bm_all.to_mesh(me)
            for poly in me.polygons:
                poly.use_smooth = True
            ob = bpy.data.objects.new(me.name, me)
            bpy.context.scene.collection.objects.link(ob)
            me.materials.append(mats[slot])
            W = np.zeros((len(me.vertices), len(b.bones)), dtype=np.float32)
            co = np.zeros(len(me.vertices) * 3, dtype=np.float32)
            me.vertices.foreach_get("co", co)
            co = co.reshape(-1, 3)
            for n0, n1, mode in modes:
                if mode == "transfer":
                    for vi in range(n0, n1):
                        res = self.body_kd.find_n(Vector(co[vi]), 6)
                        acc = np.zeros(len(b.bones), dtype=np.float32)
                        tot = 0.0
                        for _co, idx, dist in res:
                            w = 1.0 / max(dist, 1e-3) ** 2
                            acc += b.Wd[self.body_all[idx]] * w
                            tot += w
                        W[vi] = acc / tot
                else:
                    W[n0:n1, b.bone_index[mode]] = 1.0
            b.assign_groups(ob, W)
            b.parent_to_rig(ob)


def build_all(builder) -> None:
    g = GearBuilder(builder)
    g.vest()
    g.helmet()
    g.backpack()
    g.boots_and_pads()
    g.finalize()
