"""Gera os soldados de ZONA HOSTIL em Blender headless (módulo bpy).

Uso:
  python build_soldier.py --variant alfa --out ../../public/assets/characters/soldier_alfa.glb

Fontes (CC0): malha/targets/rig do MakeHuman (via repositório MPFB2) e assets de sistema do
MakeHuman (pele, olhos, sobrancelhas, roupas). Todo o código aqui é próprio; o equipamento tático
(colete, capacete, mochila, botas, joelheiras, luvas) é modelado proceduralmente em gear.py.
"""
from __future__ import annotations

import argparse
import math
import os
import sys

import bpy
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from mhdata import (apply_targets, fit_mhclo, group_vertex_sets, load_mhclo, load_mhmat,  # noqa: E402
                    load_obj, load_rig, load_weights, macro_target_weights, refit_from_obj,
                    refit_needed, to_blender)
from texbake import box_blur, camo_colors, fbm3, raster_uv  # noqa: E402
import gear  # noqa: E402

SRC = os.environ.get("ZH_ASSET_SRC", "/tmp/claude-0/assets-src")
MPFB_DATA = os.path.join(SRC, "mpfb2/src/mpfb/data")
MH_ASSETS = os.path.join(SRC, "mhassets/base")
MH_REPO_DATA = os.path.join(SRC, "mh/makehuman/data")

VARIANTS = {
    "alfa": dict(params=dict(gender=1.0, age=0.52, muscle=0.70, weight=0.52, height=0.56, proportions=1.0,
                             race={"caucasian": 0.85, "african": 0.05, "asian": 0.10}),
                 skin="young_lightskinned_male_diffuse.png", camo="floresta", eyes="brownlight",
                 brows="eyebrow001", gear_color="ranger", seed=11),
    "bravo": dict(params=dict(gender=1.0, age=0.55, muscle=0.78, weight=0.58, height=0.38, proportions=1.0,
                              race={"caucasian": 0.05, "african": 0.90, "asian": 0.05}),
                  skin="young_darkskinned_male_diffuse.png", camo="deserto", eyes="brownlight",
                  brows="eyebrow004", gear_color="coyote", seed=23),
    "charlie": dict(params=dict(gender=1.0, age=0.50, muscle=0.64, weight=0.48, height=0.55, proportions=1.0,
                                race={"caucasian": 0.10, "african": 0.05, "asian": 0.85}),
                    skin="young_lightskinned_male_diffuse3.png", camo="urbano", eyes="brownlight",
                    brows="eyebrow001", gear_color="preto", seed=37),
    "delta": dict(params=dict(gender=1.0, age=0.58, muscle=0.72, weight=0.55, height=0.50, proportions=1.0,
                              race={"caucasian": 0.55, "african": 0.35, "asian": 0.10}),
                  skin="young_lightskinned_male_diffuse2.png", camo="serra", eyes="brownlight",
                  brows="eyebrow004", gear_color="oliva", seed=51),
}

CLOTHES = [
    ("clothes", "male_casualsuit01/male_casualsuit01.mhclo"),
    ("clothes", "shoes03/shoes03.mhclo"),
]


def log(*a):
    print("[soldier]", *a, flush=True)


# --------------------------------------------------------------------------------------
# Blender helpers
# --------------------------------------------------------------------------------------

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def make_mesh(name: str, verts: np.ndarray, faces: list, uvs_per_loop: np.ndarray | None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts.tolist(), [], faces)
    me.update()
    if uvs_per_loop is not None:
        uvl = me.uv_layers.new(name="UVMap")
        uvl.data.foreach_set("uv", uvs_per_loop.astype(np.float32).ravel())
    for p in me.polygons:
        p.use_smooth = True
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def save_tex(arr: np.ndarray, path: str, quality: int = 90):
    arr = np.clip(arr, 0, 1)
    img = Image.fromarray((arr * 255 + 0.5).astype(np.uint8))
    if path.endswith(".png"):
        img.save(path, optimize=True)
    else:
        img.convert("RGB").save(path, quality=quality, optimize=True)
    return path


def load_tex(path: str, size: int | None = None, mode: str = "RGB") -> np.ndarray:
    img = Image.open(path).convert(mode)
    if size and img.size[0] != size:
        img = img.resize((size, size), Image.LANCZOS)
    return np.asarray(img).astype(np.float32) / 255.0


def make_material(name: str, base_tex: str | None, normal_tex: str | None = None, roughness: float = 0.8,
                  color=(0.8, 0.8, 0.8), alpha_clip: bool = False, metallic: float = 0.0,
                  normal_strength: float = 1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    if base_tex:
        tn = nt.nodes.new("ShaderNodeTexImage")
        tn.image = bpy.data.images.load(base_tex)
        nt.links.new(tn.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha_clip:
            nt.links.new(tn.outputs["Alpha"], bsdf.inputs["Alpha"])
            try:
                mat.blend_method = "CLIP"
            except Exception:
                pass
    if normal_tex:
        tn2 = nt.nodes.new("ShaderNodeTexImage")
        tn2.image = bpy.data.images.load(normal_tex)
        tn2.image.colorspace_settings.name = "Non-Color"
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nm.inputs["Strength"].default_value = normal_strength
        nt.links.new(tn2.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


# --------------------------------------------------------------------------------------
# Character
# --------------------------------------------------------------------------------------

class Builder:
    def __init__(self, variant: str, tex_size: int, workdir: str):
        self.vname = variant
        self.cfg = VARIANTS[variant]
        self.tex = tex_size
        self.work = workdir
        os.makedirs(workdir, exist_ok=True)
        self.rng = np.random.default_rng(self.cfg["seed"])

    # ---- base mesh & morphs ----
    def load_base(self):
        self.base = load_obj(os.path.join(MPFB_DATA, "3dobjs/base.obj"))
        weights = macro_target_weights(self.cfg["params"])
        log("macro targets:", len(weights))
        V = apply_targets(self.base.v, os.path.join(MPFB_DATA, "targets"), weights)
        self.V_mh = V
        self.groups = group_vertex_sets(self.base)
        gnd = np.array(sorted(self.groups["joint-ground"]))
        Vb = to_blender(V)
        self.ground_z = Vb[gnd, 2].mean()
        Vb[:, 2] -= self.ground_z
        self.Vb = Vb
        body = np.array(sorted({v for f, g in zip(self.base.faces, self.base.groups) if g == "body" for v in f}))
        log("height (m):", round(float(Vb[body, 2].max()), 3))

    def joint(self, name: str) -> np.ndarray:
        idx = np.array(sorted(self.groups[name]))
        return self.Vb[idx].mean(axis=0)

    # ---- weights ----
    def load_skin_weights(self):
        rig = load_rig(os.path.join(MPFB_DATA, "rigs/standard/rig.game_engine.json"))
        self.rig = rig
        self.bones = list(rig.keys())
        W = load_weights(os.path.join(MPFB_DATA, "rigs/standard/weights.game_engine.json"))
        dense = np.zeros((self.Vb.shape[0], len(self.bones)), dtype=np.float32)
        for bi, b in enumerate(self.bones):
            for vi, w in W.get(b, []):
                if vi < dense.shape[0]:
                    dense[vi, bi] = w
        s = dense.sum(1, keepdims=True)
        # vértices sem peso (raros, em helpers): herdam do vizinho mais próximo com peso
        empty = np.where(s[:, 0] < 1e-6)[0]
        if len(empty):
            have = np.where(s[:, 0] >= 1e-6)[0]
            for vi in empty:
                d = np.linalg.norm(self.Vb[have] - self.Vb[vi], axis=1)
                dense[vi] = dense[have[np.argmin(d)]]
            s = dense.sum(1, keepdims=True)
        self.Wd = dense / np.maximum(s, 1e-6)
        self.bone_index = {b: i for i, b in enumerate(self.bones)}

    def assign_groups(self, ob, weights: np.ndarray):
        """weights: (n_verts, n_bones) normalizados. Mantém as 4 maiores influências."""
        top = np.argsort(-weights, axis=1)[:, :4]
        vg = {b: ob.vertex_groups.new(name=b) for b in self.bones}
        for vi in range(weights.shape[0]):
            ws = weights[vi, top[vi]]
            tot = ws.sum()
            if tot <= 0:
                continue
            for bi, w in zip(top[vi], ws):
                if w > 0.002:
                    vg[self.bones[bi]].add([vi], float(w / tot), "REPLACE")

    # ---- armature ----
    def build_armature(self):
        arm = bpy.data.armatures.new("SoldierRig")
        ob = bpy.data.objects.new("Soldier", arm)
        bpy.context.scene.collection.objects.link(ob)
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.mode_set(mode="EDIT")
        for name, b in self.rig.items():
            eb = arm.edit_bones.new(name)
            eb.head = self._rig_point(b["head"])
            eb.tail = self._rig_point(b["tail"])
            if name == "Root":
                # raiz limpa no chão, apontando para cima: referência idêntica em todas as variantes
                eb.head = (0.0, 0.0, 0.0)
                eb.tail = (0.0, 0.0, 0.2)
            if (eb.tail - eb.head).length < 1e-4:
                eb.tail = eb.head + __import__("mathutils").Vector((0, 0, 0.05))
            eb.roll = float(b.get("roll", 0.0))
            eb.use_deform = name != "Root"
        for name, b in self.rig.items():
            if b.get("parent"):
                arm.edit_bones[name].parent = arm.edit_bones[b["parent"]]
                arm.edit_bones[name].use_connect = False
        bpy.ops.object.mode_set(mode="OBJECT")
        self.arm_ob = ob
        self.joints = {name: (np.array(arm.bones[name].head_local), np.array(arm.bones[name].tail_local))
                       for name in self.rig}

    def _rig_point(self, spec):
        if spec.get("strategy") == "CUBE" and spec.get("cube_name") in self.groups:
            return tuple(self.joint(spec["cube_name"]))
        if spec.get("strategy") == "MEAN" and spec.get("vertex_indices"):
            return tuple(self.Vb[np.array(spec["vertex_indices"])].mean(axis=0))
        return tuple(spec.get("default_position", (0, 0, 0)))

    def parent_to_rig(self, ob):
        ob.parent = self.arm_ob
        mod = ob.modifiers.new("Armature", "ARMATURE")
        mod.object = self.arm_ob

    # ---- clothes ----
    def load_clothes(self):
        self.clothes = []
        delete = set()
        for sub, rel in CLOTHES:
            clo = load_mhclo(os.path.join(MH_ASSETS, sub, rel))
            delete |= clo.delete_verts
            self.clothes.append(clo)
        self.delete = delete

    def fitted(self, clo, allow_refit: bool = False):
        mesh_v = load_obj(os.path.join(clo.folder, clo.obj_file)).v
        # As sobrancelhas do pacote antigo têm referências 2 cm abaixo da posição autorada (que está
        # sobre a malha base crua); para peças faciais justas, recalculamos as referências.
        if allow_refit and refit_needed(clo, self.base.v, mesh_v):
            log("refit (referências inconsistentes):", clo.name)
            body_ids = np.array(sorted({v for f, g in zip(self.base.faces, self.base.groups) if g == "body" for v in f}))
            folder, obj_file = clo.folder, clo.obj_file
            clo = refit_from_obj(mesh_v, self.base.v, body_ids)
            clo.folder, clo.obj_file = folder, obj_file
        pos_mh = fit_mhclo(clo, self.V_mh)
        pos = to_blender(pos_mh)
        pos[:, 2] -= self.ground_z
        mesh = load_obj(os.path.join(clo.folder, clo.obj_file))
        w = (self.Wd[clo.refs] * clo.wts[:, :, None]).sum(axis=1)  # funciona para k refs
        w /= np.maximum(w.sum(1, keepdims=True), 1e-6)
        return pos, mesh, w

    # ---- body ----
    def build_body(self):
        faces, fuv = [], []
        for f, t, g in zip(self.base.faces, self.base.fuv, self.base.groups):
            if g != "body":
                continue
            if any(v in self.delete for v in f):
                continue
            faces.append(f)
            fuv.append(t)
        used = sorted({v for f in faces for v in f})
        remap = {v: i for i, v in enumerate(used)}
        verts = self.Vb[used].copy()
        nf = [[remap[v] for v in f] for f in faces]
        uvs = np.array([self.base.vt[i] for t in fuv for i in t])
        self.body_used = np.array(used)
        self.body_faces_old = faces
        self.body_fuv = fuv
        # luvas: infla levemente a mão
        hand_bones = [self.bone_index[b] for b in self.bones if any(k in b for k in ("hand", "thumb", "index", "middle", "ring", "pinky"))]
        hand_w = self.Wd[self.body_used][:, hand_bones].sum(1)
        self.body_hand_w = hand_w
        ob = make_mesh("Body", verts, nf, uvs)
        me = ob.data
        me.update()
        nrm = np.zeros((len(me.vertices), 3), dtype=np.float32)
        me.vertices.foreach_get("normal", nrm.ravel())
        co = verts + nrm * (0.0022 * np.clip((hand_w - 0.3) / 0.4, 0, 1))[:, None]
        me.vertices.foreach_set("co", co.astype(np.float32).ravel())
        me.update()
        self.assign_groups(ob, self.Wd[self.body_used])
        self.parent_to_rig(ob)
        self.body_ob = ob
        return ob

    def skin_texture(self):
        S = self.tex
        src = os.path.join(MH_ASSETS, "skins/textures", self.cfg["skin"])
        skin = load_tex(src, S)
        # bake de máscaras (cabelo raspado, luvas) no espaço UV da pele
        tris_uv, tris_attr = [], []
        P = self.Vb
        hairm = self.hair_mask(P)
        handw = (self.Wd[:, [self.bone_index[b] for b in self.bones if any(k in b for k in ("hand", "thumb", "index", "middle", "ring", "pinky"))]].sum(1))
        # punho da luva: inclui parte do antebraço perto do pulso
        wrist_l = self.joints["hand_l"][0]
        wrist_r = self.joints["hand_r"][0]
        dwr = np.minimum(np.linalg.norm(P - wrist_l, axis=1), np.linalg.norm(P - wrist_r, axis=1))
        cuff = np.clip((0.075 - dwr) / 0.02, 0, 1)
        glove = np.clip(np.maximum(handw * 1.6 - 0.35, cuff), 0, 1)
        for f, t in zip(self.body_faces_old, self.body_fuv):
            for a, b, c in ((0, 1, 2), (0, 2, 3)) if len(f) == 4 else ((0, 1, 2),):
                tris_uv.append([self.base.vt[t[a]], self.base.vt[t[b]], self.base.vt[t[c]]])
                tris_attr.append([[*P[f[a]], hairm[f[a]], glove[f[a]]],
                                  [*P[f[b]], hairm[f[b]], glove[f[b]]],
                                  [*P[f[c]], hairm[f[c]], glove[f[c]]]])
        img, cov = raster_uv(np.array(tris_uv), np.array(tris_attr, dtype=np.float32), S)
        pos = img[..., :3].reshape(-1, 3)
        hm = img[..., 3]
        gm = img[..., 4]
        # cabelo raspado: pontos escuros curtos sobre o couro cabeludo
        n1 = fbm3(pos * 900.0, 2, 5).reshape(S, S)
        n2 = fbm3(pos * 60.0, 3, 9).reshape(S, S)
        hair_col = np.array(self.cfg.get("hair", (0.07, 0.055, 0.045)), dtype=np.float32)
        dens = np.clip(hm * (0.55 + 0.45 * n2) * (0.6 + 0.6 * n1), 0, 1)[..., None]
        skin = skin * (1 - dens * 0.92) + hair_col * dens * 0.92
        # luvas táticas: tecido escuro com reforço nos nós dos dedos
        gcol = np.array(gear.GEAR_COLORS[self.cfg["gear_color"]]["glove"], dtype=np.float32)
        weave = (fbm3(pos * 700.0, 2, 77).reshape(S, S) - 0.5) * 0.10
        gtex = np.clip(gcol[None, None] * (1 + weave[..., None]) * (0.85 + 0.3 * box_blur(skin.mean(2, keepdims=True), 2)), 0, 1)
        gm3 = np.clip(gm, 0, 1)[..., None]
        skin = skin * (1 - gm3) + gtex * gm3
        out = os.path.join(self.work, f"{self.vname}_skin.jpg")
        save_tex(skin, out, 88)
        return out

    def hair_mask(self, P: np.ndarray) -> np.ndarray:
        head_w = self.Wd[:, self.bone_index["head"]]
        eye_z = 0.5 * (self.joint("joint-l-eye")[2] + self.joint("joint-r-eye")[2])
        eye_y = 0.5 * (self.joint("joint-l-eye")[1] + self.joint("joint-r-eye")[1])
        hc = self.joint("joint-head")
        c = np.array([hc[0], eye_y + 0.075, eye_z])  # centro aproximado do crânio
        rel = P - c
        theta = np.abs(np.arctan2(rel[:, 0], -rel[:, 1]))  # 0 = frente, pi = nuca
        front = eye_z + 0.062
        side = eye_z + 0.012
        back = eye_z - 0.085
        t1 = np.clip((theta - 0.55) / (1.45 - 0.55), 0, 1)
        t2 = np.clip((theta - 1.6) / (2.7 - 1.6), 0, 1)
        h = front * (1 - t1) + side * t1
        h = h * (1 - t2) + back * t2
        m = np.clip((P[:, 2] - h) / 0.012 + 0.5, 0, 1)
        # orelhas não recebem cabelo
        radial = np.abs(rel[:, 0])
        ears = (radial > 0.072) & (P[:, 2] < eye_z + 0.03) & (theta > 1.0) & (theta < 2.3)
        m[ears] = 0
        m *= np.clip((head_w - 0.4) / 0.3, 0, 1)
        return m

    def build_clothes(self):
        palette = self.cfg["camo"]
        for clo in self.clothes:
            pos, mesh, w = self.fitted(clo)
            faces = mesh.faces
            uvs = np.array([mesh.vt[i] for t in mesh.fuv for i in t])
            name = clo.name
            # botas: aperta a barra da calça para dentro do cano da bota
            if "casualsuit" in name:
                pos = self.tuck_pants(pos)
            ob = make_mesh(name, pos, faces, uvs)
            self.assign_groups(ob, w)
            self.parent_to_rig(ob)
            mat = load_mhmat(os.path.join(clo.folder, clo.material))
            dif = os.path.join(clo.folder, mat.get("diffuseTexture", ""))
            nrm = os.path.join(clo.folder, mat["normalmapTexture"]) if "normalmapTexture" in mat else None
            ao = os.path.join(clo.folder, mat["aomapTexture"]) if "aomapTexture" in mat else None
            if "casualsuit" in name:
                tex = self.camo_texture(mesh, pos, dif, ao, palette)
                ntex = None
                if nrm and os.path.exists(nrm):
                    ntex = os.path.join(self.work, f"{self.vname}_uniform_n.jpg")
                    save_tex(load_tex(nrm, self.tex), ntex, 92)
                ob.data.materials.append(make_material(f"Uniform_{palette}", tex, ntex, roughness=0.9))
            elif "shoes" in name:
                tex = self.boot_texture(dif)
                ob.data.materials.append(make_material("BootLeather", tex, None, roughness=0.62))
                self.shoes_ob = ob
            self.uniform_ob = ob if "casualsuit" in name else getattr(self, "uniform_ob", None)

    def tuck_pants(self, pos: np.ndarray) -> np.ndarray:
        """Comprime a barra da calça contra a perna abaixo de ~26 cm (calça 'dentro' da bota)."""
        out = pos.copy()
        for side in ("l", "r"):
            ank = self.joint(f"joint-{side}-ankle")
            knee = self.joint(f"joint-{side}-knee")
            sel = (out[:, 2] < 0.27) & (np.sign(out[:, 0]) == np.sign(ank[0]))
            axis_pt = lambda z: ank + (knee - ank) * ((z - ank[2]) / (knee[2] - ank[2]))  # noqa: E731
            for i in np.where(sel)[0]:
                c = axis_pt(out[i, 2])
                d = out[i, :2] - c[:2]
                r = np.linalg.norm(d)
                rmax = 0.058
                if r > rmax:
                    out[i, :2] = c[:2] + d / r * (rmax + (r - rmax) * 0.15)
        return out

    def camo_texture(self, mesh, pos, dif_path, ao_path, palette):
        S = self.tex
        tris_uv, tris_attr = [], []
        for f, t in zip(mesh.faces, mesh.fuv):
            for a, b, c in ((0, 1, 2), (0, 2, 3)) if len(f) == 4 else ((0, 1, 2),):
                tris_uv.append([mesh.vt[t[a]], mesh.vt[t[b]], mesh.vt[t[c]]])
                tris_attr.append([pos[f[a]], pos[f[b]], pos[f[c]]])
        img, cov = raster_uv(np.array(tris_uv), np.array(tris_attr, dtype=np.float32), S)
        P = img.reshape(-1, 3)
        camo = camo_colors(P, palette, scale=7.5, seed=self.cfg["seed"]).reshape(S, S, 3)
        src = load_tex(dif_path, S, "RGBA")
        rgb = src[..., :3]
        lum = rgb.mean(2)
        detail = lum / np.maximum(box_blur(lum, 12), 0.02)
        detail = np.clip(detail, 0.55, 1.45) ** 0.8
        shade = np.clip(box_blur(lum, 40) / max(np.median(lum[cov]), 1e-3), 0.65, 1.15) ** 0.35
        out = camo * detail[..., None] * shade[..., None]
        if ao_path and os.path.exists(ao_path):
            ao = load_tex(ao_path, S, "L") if False else load_tex(ao_path, S)[..., :1]
            out *= (0.55 + 0.45 * ao)
        # cinto e fivela: preserva peças escuras e pouco saturadas do original
        sat = rgb.max(2) - rgb.min(2)
        belt = (lum < 0.14) & (sat < 0.08) & (img[..., 2] > 0.85) & (img[..., 2] < 1.15)
        belt_col = np.array([0.09, 0.085, 0.075])
        out[belt] = belt_col * detail[belt][:, None] * 1.1
        out[~cov] = camo[~cov] * 0.5
        path = os.path.join(self.work, f"{self.vname}_uniform.jpg")
        save_tex(out, path, 88)
        return path

    def boot_texture(self, dif_path):
        src = load_tex(dif_path, 512)
        col = np.array(gear.GEAR_COLORS[self.cfg["gear_color"]]["boot"], dtype=np.float32)
        lum = src.mean(2, keepdims=True)
        out = col * (0.55 + 1.6 * lum)
        path = os.path.join(self.work, f"{self.vname}_boot.jpg")
        save_tex(out, path, 88)
        return path

    def build_face_parts(self):
        parts = [
            ("eyes", os.path.join(MH_REPO_DATA, "eyes/low-poly/low-poly.mhclo"),
             os.path.join(MH_ASSETS, f"eyes/materials/{self.cfg['eyes']}_eye.png"), False, 0.15),
            ("eyebrows", os.path.join(MH_ASSETS, f"eyebrows/{self.cfg['brows']}/{self.cfg['brows']}.mhclo"),
             os.path.join(MH_ASSETS, f"eyebrows/{self.cfg['brows']}/{self.cfg['brows']}.png"), True, 0.9),
            ("eyelashes", os.path.join(MH_ASSETS, "eyelashes/eyelashes01/eyelashes01.mhclo"),
             os.path.join(MH_ASSETS, "eyelashes/eyelashes01/eyelashes01.png"), True, 0.9),
        ]
        for name, clo_path, tex, alpha, rough in parts:
            clo = load_mhclo(clo_path)
            pos, mesh, w = self.fitted(clo, allow_refit=(name == "eyebrows"))
            uvs = np.array([mesh.vt[i] for t in mesh.fuv for i in t])
            if name == "eyebrows":
                # garante que os pelos fiquem 2 mm acima da pele (evita ficarem ocultos sob a testa)
                c = self.joint("joint-head") + np.array([0.0, -0.01, 0.06])
                d = pos - c
                pos = pos + d / np.linalg.norm(d, axis=1, keepdims=True) * 0.0055
            ob = make_mesh(name.capitalize(), pos, mesh.faces, uvs)
            self.assign_groups(ob, w)
            self.parent_to_rig(ob)
            out = os.path.join(self.work, f"{self.vname}_{name}." + ("png" if alpha else "jpg"))
            im = Image.open(tex).convert("RGBA" if alpha else "RGB")
            im = im.resize((256, 256), Image.LANCZOS)
            if alpha:
                a = np.asarray(im).astype(np.float32) / 255
                # cor dos pelos herdada da variante
                hc = np.array(self.cfg.get("hair", (0.07, 0.055, 0.045)))
                a[..., :3] = hc * (0.6 + 0.8 * a[..., :3].mean(2, keepdims=True))
                # fios finos somem no mipmap com alphaTest: engrossa e reforça a cobertura
                cover = np.clip(box_blur(a[..., 3], 3 if name == "eyebrows" else 1) * (2.6 if name == "eyebrows" else 1.8), 0, 1)
                a[..., 3] = np.maximum(a[..., 3], cover)
                im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
            im.save(out)
            ob.data.materials.append(make_material(f"{name.capitalize()}", out, None, roughness=rough,
                                                   alpha_clip=alpha))

    def build(self):
        reset_scene()
        self.load_base()
        self.load_skin_weights()
        self.load_clothes()
        self.build_armature()
        self.build_body()
        skin_tex = self.skin_texture()
        self.body_ob.data.materials.append(make_material("Skin", skin_tex, None, roughness=0.52))
        self.build_clothes()
        self.build_face_parts()
        gear.build_all(self)

    def export(self, out_path: str):
        os.makedirs(os.path.dirname(out_path), exist_ok=True)
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.export_scene.gltf(
            filepath=out_path, export_format="GLB", use_selection=True,
            export_skins=True, export_animations=False, export_yup=True,
            export_apply=False, export_texcoords=True, export_normals=True,
            export_tangents=False, export_materials="EXPORT", export_image_format="AUTO",
            export_influence_nb=4, export_def_bones=False, export_morph=False,
        )
        log("exported", out_path, os.path.getsize(out_path) // 1024, "KB")

    def save_blend(self, path: str):
        bpy.ops.wm.save_as_mainfile(filepath=path)


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", default="alfa")
    ap.add_argument("--out", required=True)
    ap.add_argument("--tex", type=int, default=1024)
    ap.add_argument("--work", default=os.path.join(HERE, "_work"))
    ap.add_argument("--blend", default="")
    a = ap.parse_args(argv)
    b = Builder(a.variant, a.tex, a.work)
    b.build()
    if a.blend:
        b.save_blend(a.blend)
    b.export(a.out)


if __name__ == "__main__":
    main()
