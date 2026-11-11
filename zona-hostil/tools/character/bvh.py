"""Leitor de BVH + cinemática direta (numpy). Converte para o espaço do Blender (Z para cima)."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

# BVH (Y up, +Z frente) -> Blender (Z up, -Y frente)
C = np.array([[1.0, 0, 0], [0, 0, -1.0], [0, 1.0, 0]])


@dataclass
class Joint:
    name: str
    parent: int
    offset: np.ndarray
    channels: list
    end: np.ndarray | None = None


def _rot(axis: str, deg: np.ndarray) -> np.ndarray:
    r = np.radians(deg)
    c, s = np.cos(r), np.sin(r)
    n = len(r)
    m = np.zeros((n, 3, 3))
    if axis == "X":
        m[:, 0, 0] = 1
        m[:, 1, 1] = c
        m[:, 1, 2] = -s
        m[:, 2, 1] = s
        m[:, 2, 2] = c
    elif axis == "Y":
        m[:, 1, 1] = 1
        m[:, 0, 0] = c
        m[:, 0, 2] = s
        m[:, 2, 0] = -s
        m[:, 2, 2] = c
    else:
        m[:, 2, 2] = 1
        m[:, 0, 0] = c
        m[:, 0, 1] = -s
        m[:, 1, 0] = s
        m[:, 1, 1] = c
    return m


class BVH:
    def __init__(self, path: str):
        self.joints: list[Joint] = []
        with open(path, encoding="utf-8", errors="ignore") as fh:
            lines = fh.read().split("\n")
        i = 0
        stack: list[int] = []
        while i < len(lines):
            t = lines[i].strip().split()
            i += 1
            if not t:
                continue
            if t[0] in ("ROOT", "JOINT"):
                self.joints.append(Joint(t[1], stack[-1] if stack else -1, np.zeros(3), []))
                stack.append(len(self.joints) - 1)
            elif t[0] == "End":
                # End Site { OFFSET ... }
                while "OFFSET" not in lines[i]:
                    i += 1
                self.joints[stack[-1]].end = np.array([float(x) for x in lines[i].split()[1:4]])
                while "}" not in lines[i]:
                    i += 1
                i += 1
            elif t[0] == "OFFSET":
                self.joints[stack[-1]].offset = np.array([float(x) for x in t[1:4]])
            elif t[0] == "CHANNELS":
                self.joints[stack[-1]].channels = t[2:]
            elif t[0] == "}":
                stack.pop()
            elif t[0] == "MOTION":
                break
        nframes = int(lines[i].split()[1])
        self.dt = float(lines[i + 1].split()[2])
        data = []
        for ln in lines[i + 2: i + 2 + nframes]:
            if ln.strip():
                data.append([float(x) for x in ln.split()])
        self.data = np.array(data)
        self.index = {j.name: k for k, j in enumerate(self.joints)}

    def fk(self, frames: np.ndarray | None = None):
        """Retorna (pos (F,J,3), rot (F,J,3,3)) globais no espaço do Blender, unidades do arquivo."""
        D = self.data if frames is None else self.data[frames]
        F = D.shape[0]
        J = len(self.joints)
        pos = np.zeros((F, J, 3))
        rot = np.zeros((F, J, 3, 3))
        col = 0
        for k, j in enumerate(self.joints):
            local = np.repeat(np.eye(3)[None], F, 0)
            trans = np.zeros((F, 3))
            for ch in j.channels:
                v = D[:, col]
                col += 1
                if ch.endswith("position"):
                    trans[:, "XYZ".index(ch[0])] = v
                else:
                    local = local @ _rot(ch[0], v)
            if j.parent < 0:
                rot[:, k] = local
                pos[:, k] = trans + j.offset
            else:
                pr = rot[:, j.parent]
                rot[:, k] = pr @ local
                pos[:, k] = pos[:, j.parent] + np.einsum("fij,j->fi", pr, j.offset)
        # converte para Blender
        pos = pos @ C.T
        rot = np.einsum("ij,fkjl,ml->fkim", C, rot, C)
        return pos, rot
