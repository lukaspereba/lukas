"""Leitor próprio dos dados CC0 do MakeHuman (malha base hm08, targets, rig, roupas .mhclo).

Não executa código de terceiros: apenas interpreta arquivos de dados.
Coordenadas MakeHuman: Y para cima, unidade = decímetro.
"""
from __future__ import annotations

import gzip
import json
import os
from dataclasses import dataclass, field

import numpy as np


@dataclass
class ObjMesh:
    v: np.ndarray                 # (N,3)
    vt: np.ndarray                # (M,2)
    faces: list[list[int]]
    fuv: list[list[int]]
    groups: list[str]
    mtl: list[str] = field(default_factory=list)


def load_obj(path: str) -> ObjMesh:
    verts, uvs, faces, fuv, groups, mtls = [], [], [], [], [], []
    group = ""
    mtl = ""
    with open(path, encoding="utf-8", errors="ignore") as fh:
        for line in fh:
            if line.startswith("v "):
                verts.append([float(x) for x in line.split()[1:4]])
            elif line.startswith("vt "):
                uvs.append([float(x) for x in line.split()[1:3]])
            elif line.startswith("g "):
                group = line.split(maxsplit=1)[1].strip()
            elif line.startswith("usemtl "):
                mtl = line.split(maxsplit=1)[1].strip()
            elif line.startswith("f "):
                idx, ti = [], []
                for tok in line.split()[1:]:
                    p = tok.split("/")
                    idx.append(int(p[0]) - 1)
                    ti.append(int(p[1]) - 1 if len(p) > 1 and p[1] else -1)
                faces.append(idx)
                fuv.append(ti)
                groups.append(group)
                mtls.append(mtl)
    return ObjMesh(np.array(verts, dtype=np.float64),
                   np.array(uvs, dtype=np.float64) if uvs else np.zeros((0, 2)),
                   faces, fuv, groups, mtls)


def load_target(path: str) -> tuple[np.ndarray, np.ndarray]:
    opener = gzip.open if path.endswith(".gz") else open
    idx, d = [], []
    with opener(path, "rt", encoding="utf-8", errors="ignore") as fh:
        for line in fh:
            if not line.strip() or line.startswith("#"):
                continue
            p = line.split()
            idx.append(int(p[0]))
            d.append([float(p[1]), float(p[2]), float(p[3])])
    if not idx:
        return np.zeros(0, dtype=np.int64), np.zeros((0, 3))
    return np.array(idx, dtype=np.int64), np.array(d, dtype=np.float64)


def _pair(value: float, low: str, high: str) -> dict[str, float]:
    """Interpolação linear entre dois alvos dentro de [0.5,1] ou [0,0.5]."""
    return {low: 1.0 - value, high: value}


def macro_target_weights(params: dict) -> dict[str, float]:
    """Reproduz o sistema de macros do MakeHuman (gênero, idade, musculatura, peso,
    altura, proporções e etnia) devolvendo {caminho_relativo_do_target: peso}."""
    g = params.get("gender", 1.0)
    a = params.get("age", 0.5)
    m = params.get("muscle", 0.5)
    w = params.get("weight", 0.5)
    h = params.get("height", 0.5)
    p = params.get("proportions", 1.0)
    races = params.get("race", {"caucasian": 1 / 3, "african": 1 / 3, "asian": 1 / 3})

    gender = {"female": 1.0 - g, "male": g}
    if a < 0.1875:
        age = _pair(a / 0.1875, "baby", "child")
    elif a < 0.5:
        age = _pair((a - 0.1875) / (0.5 - 0.1875), "child", "young")
    else:
        age = _pair((a - 0.5) / 0.5, "young", "old")
    muscle = _pair(m / 0.5, "minmuscle", "averagemuscle") if m < 0.5 else _pair((m - 0.5) / 0.5, "averagemuscle", "maxmuscle")
    weight = _pair(w / 0.5, "minweight", "averageweight") if w < 0.5 else _pair((w - 0.5) / 0.5, "averageweight", "maxweight")
    height = {"minheight": (0.5 - h) * 2} if h < 0.5 else {"maxheight": (h - 0.5) * 2}
    prop = {"uncommonproportions": (0.5 - p) * 2} if p < 0.5 else {"idealproportions": (p - 0.5) * 2}

    out: dict[str, float] = {}

    def add(key: str, val: float) -> None:
        if val > 1e-5:
            out[key] = out.get(key, 0.0) + val

    for gk, gv in gender.items():
        for ak, av in age.items():
            for mk, mv in muscle.items():
                for wk, wv in weight.items():
                    base = gv * av * mv * wv
                    add(f"macrodetails/universal-{gk}-{ak}-{mk}-{wk}.target.gz", base)
                    for hk, hv in height.items():
                        add(f"macrodetails/height/{gk}-{ak}-{mk}-{wk}-{hk}.target.gz", base * hv)
                    for pk, pv in prop.items():
                        add(f"macrodetails/proportions/{gk}-{ak}-{mk}-{wk}-{pk}.target.gz", base * pv)
            for rk, rv in races.items():
                add(f"macrodetails/{rk}-{gk}-{ak}.target.gz", rv * gv * av)
    return out


def apply_targets(base: np.ndarray, targets_root: str, weights: dict[str, float]) -> np.ndarray:
    v = base.copy()
    for rel, wt in weights.items():
        path = os.path.join(targets_root, rel)
        if not os.path.exists(path):
            continue
        idx, d = load_target(path)
        if len(idx):
            v[idx] += d * wt
    return v


def group_vertex_sets(mesh: ObjMesh) -> dict[str, set[int]]:
    sets: dict[str, set[int]] = {}
    for f, g in zip(mesh.faces, mesh.groups):
        sets.setdefault(g, set()).update(f)
    return sets


@dataclass
class Mhclo:
    name: str
    obj_file: str
    refs: np.ndarray        # (N,3) int
    wts: np.ndarray         # (N,3)
    offs: np.ndarray        # (N,3)
    scales: dict            # axis -> (v1, v2, scale)
    delete_verts: set
    material: str
    z_depth: int
    folder: str


def load_mhclo(path: str) -> Mhclo:
    refs, wts, offs = [], [], []
    scales: dict = {}
    delete: set = set()
    name = obj_file = material = ""
    z_depth = 50
    mode = None
    with open(path, encoding="utf-8", errors="ignore") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            p = line.split()
            key = p[0]
            if key == "verts":
                mode = "verts"
                continue
            if key == "delete_verts":
                mode = "delete"
                continue
            if mode == "verts" and (len(p) in (1, 9)) and p[0].lstrip("-").isdigit():
                if len(p) == 1:
                    refs.append([int(p[0])] * 3)
                    wts.append([1.0, 0.0, 0.0])
                    offs.append([0.0, 0.0, 0.0])
                else:
                    refs.append([int(p[0]), int(p[1]), int(p[2])])
                    wts.append([float(p[3]), float(p[4]), float(p[5])])
                    offs.append([float(p[6]), float(p[7]), float(p[8])])
                continue
            if mode == "delete" and (p[0].isdigit() or p[0] == "-"):
                toks = p
                i = 0
                while i < len(toks):
                    if toks[i] == "-" and i > 0 and i + 1 < len(toks):
                        a, b = int(toks[i - 1]), int(toks[i + 1])
                        delete.update(range(a, b + 1))
                        i += 2
                        continue
                    if toks[i].isdigit():
                        delete.add(int(toks[i]))
                    i += 1
                continue
            mode = None if key not in ("verts", "delete_verts") else mode
            if key == "name":
                name = p[1]
            elif key == "obj_file":
                obj_file = p[1]
            elif key == "material":
                material = p[1]
            elif key == "z_depth":
                z_depth = int(p[1])
            elif key in ("x_scale", "y_scale", "z_scale"):
                scales[key[0]] = (int(p[1]), int(p[2]), float(p[3]))
    return Mhclo(name, obj_file, np.array(refs, dtype=np.int64), np.array(wts), np.array(offs),
                 scales, delete, material, z_depth, os.path.dirname(path))


def fit_mhclo(clo: Mhclo, base: np.ndarray) -> np.ndarray:
    sc = np.ones(3)
    for ax_i, ax in enumerate("xyz"):
        if ax in clo.scales:
            v1, v2, s = clo.scales[ax]
            sc[ax_i] = abs(base[v1, ax_i] - base[v2, ax_i]) / s
    pos = (base[clo.refs] * clo.wts[:, :, None]).sum(axis=1) + clo.offs * sc
    return pos


def load_mhmat(path: str) -> dict:
    out: dict = {}
    if not os.path.exists(path):
        return out
    with open(path, encoding="utf-8", errors="ignore") as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            p = line.split(maxsplit=1)
            if len(p) == 2:
                out[p[0]] = p[1]
    return out


def load_rig(path: str) -> dict:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def load_weights(path: str) -> dict[str, list]:
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)["weights"]


def to_blender(v: np.ndarray) -> np.ndarray:
    """MakeHuman (Y-up, dm) -> Blender (Z-up, m), personagem olhando para -Y."""
    return np.stack([v[:, 0], -v[:, 2], v[:, 1]], axis=1) * 0.1


def refit_needed(clo: Mhclo, base_raw: np.ndarray, mesh_v: np.ndarray, tol_dm: float = 0.05) -> bool:
    """Verifica se as referências do .mhclo reproduzem a malha autorada sobre a base crua."""
    if len(mesh_v) != len(clo.refs):
        return True
    err = np.linalg.norm(fit_mhclo(clo, base_raw) - mesh_v, axis=1).mean()
    return bool(err > tol_dm)


def refit_from_obj(mesh_v: np.ndarray, base_raw: np.ndarray, candidates: np.ndarray, k: int = 4) -> Mhclo:
    """Recalcula referências: k vértices mais próximos da base (pesos por distância inversa) + deslocamento."""
    P = base_raw[candidates]
    refs = np.zeros((len(mesh_v), k), dtype=np.int64)
    wts = np.zeros((len(mesh_v), k))
    for i, v in enumerate(mesh_v):
        d = np.linalg.norm(P - v, axis=1)
        nn = np.argsort(d)[:k]
        w = 1.0 / np.maximum(d[nn], 1e-4) ** 2
        refs[i] = candidates[nn]
        wts[i] = w / w.sum()
    offs = mesh_v - (base_raw[refs] * wts[:, :, None]).sum(axis=1)
    return Mhclo("refit", "", refs, wts, offs, {}, set(), "", 50, "")
