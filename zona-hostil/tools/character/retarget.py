"""Redireciona capturas de movimento CMU (BVH) para o esqueleto game_engine dos soldados.

Uso: python retarget.py --out ../../public/assets/characters/anims.glb

Método: delta de rotação global relativo à T-pose (frame 0 de cada BVH da conversão cgspeed),
com alinhamento dos membros da pose A do MakeHuman para a T-pose da fonte. Ciclos de locomoção
são detectados automaticamente (menor distância de pose), tornados in-place e fechados em loop.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from build_soldier import Builder, reset_scene  # noqa: E402
from bvh import BVH  # noqa: E402

BVH_DIR = os.environ.get("ZH_BVH_DIR", "/tmp/claude-0/assets-src/bvh")
FPS = 30

MAP = {
    "pelvis": "Hips", "spine_01": "LowerBack", "spine_02": "Spine", "spine_03": "Spine1",
    "neck_01": "Neck", "head": "Head",
    "clavicle_l": "LeftShoulder", "upperarm_l": "LeftArm", "lowerarm_l": "LeftForeArm", "hand_l": "LeftHand",
    "clavicle_r": "RightShoulder", "upperarm_r": "RightArm", "lowerarm_r": "RightForeArm", "hand_r": "RightHand",
    "thigh_l": "LeftUpLeg", "calf_l": "LeftLeg", "foot_l": "LeftFoot", "ball_l": "LeftToeBase",
    "thigh_r": "RightUpLeg", "calf_r": "RightLeg", "foot_r": "RightFoot", "ball_r": "RightToeBase",
}
# filho usado para direção do segmento na fonte
SRC_CHILD = {
    "LeftShoulder": "LeftArm", "LeftArm": "LeftForeArm", "LeftForeArm": "LeftHand", "LeftHand": "LeftFingerBase",
    "RightShoulder": "RightArm", "RightArm": "RightForeArm", "RightForeArm": "RightHand", "RightHand": "RightFingerBase",
    "LeftUpLeg": "LeftLeg", "LeftLeg": "LeftFoot", "LeftFoot": "LeftToeBase", "LeftToeBase": None,
    "RightUpLeg": "RightLeg", "RightLeg": "RightFoot", "RightFoot": "RightToeBase", "RightToeBase": None,
}
TORSO = {"pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "head"}

CLIPS = {
    "idle": dict(file="82_08", mode="loop", search=(0.2, 3.6), cycle=(2.2, 3.2), facing=True),
    "walk": dict(file="07_01", mode="loop", search=(0.25, 2.5), cycle=(0.95, 1.35), travel="fwd"),
    "run": dict(file="09_01", mode="loop", search=(0.05, 1.15), cycle=(0.55, 0.85), travel="fwd"),
    "sprint": dict(file="102_05", mode="loop", search=(0.02, 0.88), cycle=(0.5, 0.8), travel="fwd"),
    "walk_back": dict(file="113_01", mode="loop", search=(0.8, 6.5), cycle=(0.9, 1.6), travel="back"),
    "strafe_l": dict(file="113_18", mode="loop", search=(0.5, 18.0), cycle=(0.9, 1.7), travel="left"),
    "strafe_r": dict(file="113_18", mode="loop", mirror_of="strafe_l", travel="right"),
    "jump": dict(file="16_01", mode="once", window=(0.0, 2.7), facing=True, events=True),
}


def log(*a):
    print("[retarget]", *a, flush=True)


def rot_between(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    a = a / np.linalg.norm(a)
    b = b / np.linalg.norm(b)
    v = np.cross(a, b)
    c = float(np.dot(a, b))
    if c < -0.9999:
        axis = np.cross(a, [1, 0, 0])
        if np.linalg.norm(axis) < 1e-6:
            axis = np.cross(a, [0, 1, 0])
        axis /= np.linalg.norm(axis)
        return np.array(Matrix.Rotation(math.pi, 3, Vector(axis)))
    vx = np.array([[0, -v[2], v[1]], [v[2], 0, -v[0]], [-v[1], v[0], 0]])
    return np.eye(3) + vx + vx @ vx * (1 / (1 + c))


def yaw_matrix(angle: float) -> np.ndarray:
    c, s = math.cos(angle), math.sin(angle)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def mirror_motion(pos, rot, names):
    """Espelha a captura no eixo X (troca esquerda/direita)."""
    M = np.diag([-1.0, 1.0, 1.0])
    pos = pos @ M
    rot = np.einsum("ij,fkjl,lm->fkim", M, rot, M)
    idx = {n: i for i, n in enumerate(names)}
    perm = list(range(len(names)))
    for n, i in idx.items():
        for a, b in (("Left", "Right"), ("LThumb", "RThumb"), ("LHip", "RHip")):
            if n.startswith(a):
                o = b + n[len(a):]
                if o in idx:
                    perm[i] = idx[o]
    return pos[:, perm], rot[:, perm]


class Retargeter:
    def __init__(self):
        reset_scene()
        b = Builder("alfa", 256, os.path.join(HERE, "_work"))
        b.load_base()
        b.load_skin_weights()
        b.build_armature()
        self.b = b
        self.arm = b.arm_ob
        self.bones = [bn.name for bn in self.arm.data.bones]
        self.rest = {bn.name: np.array(bn.matrix_local) for bn in self.arm.data.bones}
        self.parent = {bn.name: (bn.parent.name if bn.parent else None) for bn in self.arm.data.bones}
        order = []
        seen = set()

        def visit(n):
            if n in seen:
                return
            p = self.parent[n]
            if p:
                visit(p)
            seen.add(n)
            order.append(n)
        for n in self.bones:
            visit(n)
        self.order = order
        pel = self.rest["pelvis"]
        self.hip_h = pel[2, 3]
        th = self.rest["thigh_l"][:3, 3]
        ca = self.rest["calf_l"][:3, 3]
        ft = self.rest["foot_l"][:3, 3]
        self.leg_len = np.linalg.norm(th - ca) + np.linalg.norm(ca - ft)
        self.meta = {}
        self.windows = {}

    def target_tpose(self, src_dirs):
        """Rotação global de cada osso alvo na T-pose da fonte."""
        RT = {}
        for t, s in MAP.items():
            R = self.rest[t][:3, :3]
            if t in TORSO or s not in src_dirs:
                RT[t] = R
                continue
            head = self.rest[t][:3, 3]
            tail = head + R[:, 1] * 0.1
            d_t = tail - head
            RT[t] = rot_between(d_t, src_dirs[s]) @ R
        return RT

    def process(self, name, spec):
        b = BVH(os.path.join(BVH_DIR, spec["file"] + ".bvh"))
        names = [j.name for j in b.joints]
        pos, rot = b.fk()
        if spec.get("mirror") or spec.get("mirror_of"):
            pos, rot = mirror_motion(pos, rot, names)
        idx = b.index
        step = max(1, int(round(1.0 / (FPS * b.dt))))
        # T-pose
        tpos, trot = pos[0], rot[0]
        src_dirs = {}
        for s, c in SRC_CHILD.items():
            if s not in idx:
                continue
            if c and c in idx:
                d = tpos[idx[c]] - tpos[idx[s]]
            else:
                end = b.joints[idx[s]].end
                d = trot[idx[s]] @ (np.array([end[0], -end[2], end[1]]) if end is not None else np.array([0, -1.0, 0]))
            if np.linalg.norm(d) > 1e-6:
                src_dirs[s] = d / np.linalg.norm(d)
        RT = self.target_tpose(src_dirs)
        src_leg = (np.linalg.norm(tpos[idx["LeftUpLeg"]] - tpos[idx["LeftLeg"]]) +
                   np.linalg.norm(tpos[idx["LeftLeg"]] - tpos[idx["LeftFoot"]]))
        scale = self.leg_len / src_leg
        # amostragem a 30 fps (ignora frame 0 = T-pose)
        frames = np.arange(1, len(pos), step)
        P = pos[frames]
        R = rot[frames]
        hips = P[:, idx["Hips"]] * scale
        dt = step * b.dt

        if spec.get("mirror_of"):
            a, e = self.windows[spec["mirror_of"]]
        elif spec["mode"] == "loop":
            a, e = self.find_cycle(R, hips, idx, spec, dt)
        else:
            if spec.get("fall"):
                hz = hips[:, 2]
                drop = np.where(hz < hz[0] - 0.08)[0]
                st = max(int(drop[0]) - int(0.35 / dt), 0) if len(drop) else 0
                settle = np.where((np.abs(np.gradient(hz)) < 0.002) & (hz < hz.min() + 0.06))[0]
                settle = settle[settle > st + 5]
                en = min(int(settle[0]) + int(0.6 / dt), len(hz) - 1) if len(settle) else len(hz) - 1
                a, e = st, en
            else:
                w0, w1 = spec["window"]
                a, e = int(w0 / dt), min(int(w1 / dt), len(frames) - 1)
        self.windows[name] = (a, e)
        R = R[a:e + 1]
        hips = hips[a:e + 1]
        n = len(R)
        # orientação: direção de deslocamento (locomoção) ou frente do quadril (parado)
        if spec.get("travel"):
            v = hips[-1, :2] - hips[0, :2]
            want = {"fwd": (0, -1), "back": (0, 1)}.get(spec["travel"])
            if want is None:
                # lateral: mantém a frente do quadril para -Y e confere o lado do deslocamento
                fwd0 = (R[0, idx["Hips"]] @ trot[idx["Hips"]].T @ np.array([0, -1.0, 0]))[:2]
                yaw = -math.pi / 2 - math.atan2(fwd0[1], fwd0[0])
                vv = yaw_matrix(yaw)[:2, :2] @ v
                # personagem olha para -Y: esquerda dele = +X
                if (vv[0] > 0) != (spec["travel"] == "left") and not spec.get("mirror_of"):
                    if spec.get("_flipped"):
                        raise RuntimeError("não foi possível orientar o strafe")
                    spec2 = dict(spec, mirror=not spec.get("mirror", False), _flipped=True)
                    return self.process(name, spec2)
            else:
                ang_v = math.atan2(v[1], v[0])
                yaw = math.atan2(want[1], want[0]) - ang_v
        else:
            fwd0 = (R[0, idx["Hips"]] @ trot[idx["Hips"]].T @ np.array([0, -1.0, 0]))[:2]
            yaw = -math.pi / 2 - math.atan2(fwd0[1], fwd0[0])
        Y = yaw_matrix(yaw)
        R = np.einsum("ij,fkjl->fkil", Y, R)
        hips = hips @ Y.T
        dur = n * dt
        travel = hips[-1] - hips[0] if spec["mode"] == "loop" else np.zeros(3)
        speed = float(np.linalg.norm(travel[:2]) / (dur if dur > 0 else 1))
        # in-place: remove tendência linear horizontal (loops) / origem (one-shots)
        t = np.linspace(0, 1, n)[:, None]
        if spec["mode"] == "loop":
            hips[:, :2] -= hips[0, :2] + travel[None, :2] * t
            hips[:, 2] -= (hips[-1, 2] - hips[0, 2]) * t[:, 0]
        else:
            hips[:, :2] -= hips[0, :2]
        src_t_hip = tpos[idx["Hips"]][2] * scale
        hz = self.hip_h + (hips[:, 2] - src_t_hip)
        # rotações globais do alvo
        Rt = {}
        TinvS = {s: trot[idx[s]].T for s in set(MAP.values()) if s in idx}
        for tb, s in MAP.items():
            if s not in idx:
                continue
            Rt[tb] = np.einsum("fij,jk,kl->fil", R[:, idx[s]], TinvS[s], RT[tb])
        events = {}
        if spec.get("events"):
            toes = np.minimum(P[a:e + 1, idx["LeftToeBase"], 2], P[a:e + 1, idx["RightToeBase"], 2]) * scale
            ground = np.percentile(toes, 5)
            air = np.where(toes > ground + 0.06)[0]
            if len(air):
                events = dict(liftoff=round(float(air[0] * dt), 3), land=round(float(air[-1] * dt), 3))
        if spec["mode"] == "loop":
            self.close_loop(Rt)
        self.key_action(name, Rt, hips, hz)
        self.meta[name] = dict(duration=round(dur, 4), speed=round(speed, 3), loop=spec["mode"] == "loop",
                               frames=n, source=f"CMU {spec['file']}", **events)
        log(f"{name:10s} src={spec['file']} frames={n} dur={dur:.2f}s speed={speed:.2f} m/s")

    def find_cycle(self, R, hips, idx, spec, dt):
        s0 = int(spec["search"][0] / dt)
        s1 = min(int(spec["search"][1] / dt), len(R) - 1)
        cmin, cmax = int(spec["cycle"][0] / dt), int(spec["cycle"][1] / dt)
        H = R[:, idx["Hips"]]
        feats = []
        for j in ("LeftUpLeg", "LeftLeg", "RightUpLeg", "RightLeg", "LeftArm", "RightArm", "Spine1", "LeftFoot", "RightFoot"):
            rel = np.einsum("fji,fjk->fik", H, R[:, idx[j]])
            feats.append(rel.reshape(len(R), -1))
        F = np.concatenate(feats, 1)
        hz = hips[:, 2:3] * 4
        F = np.concatenate([F, hz], 1)
        vel = np.gradient(hips[:, :2], axis=0)
        best, ba, bb = 1e9, s0, min(s0 + cmin, s1)
        for a in range(s0, s1):
            for L in range(cmin, cmax + 1):
                e = a + L
                if e > s1:
                    break
                cost = np.sum((F[a] - F[e]) ** 2)
                if spec.get("travel"):
                    v = vel[a:e]
                    mv = v.mean(0)
                    nv = np.linalg.norm(mv)
                    if nv < 1e-5:
                        continue
                    cons = (v @ (mv / nv)) / np.maximum(np.linalg.norm(v, axis=1), 1e-6)
                    cost += 4.0 * np.mean(cons < 0.6)
                    cost += 2.0 * np.sum((vel[a] - vel[e]) ** 2) / (nv * nv + 1e-9) * 0.05
                if cost < best:
                    best, ba, bb = cost, a, e
        log(f"  ciclo {spec['file']}: [{ba*dt:.2f}s, {bb*dt:.2f}s] custo={best:.4f}")
        return ba, bb

    def close_loop(self, Rt):
        """Distribui a diferença entre o último e o primeiro frame ao longo do clipe."""
        for tb, M in Rt.items():
            n = len(M)
            q0 = Quaternion(Matrix(M[0].tolist()).to_quaternion())
            q1 = Quaternion(Matrix(M[-1].tolist()).to_quaternion())
            corr = q0 @ q1.inverted()
            for i in range(n):
                k = i / (n - 1)
                c = Quaternion().slerp(corr, k)
                Rt[tb][i] = np.array((c.to_matrix() @ Matrix(M[i].tolist())))

    def key_action(self, name, Rt, hips, hz):
        arm = self.arm
        n = len(hz)
        arm.animation_data_create()
        act = bpy.data.actions.new(name)
        arm.animation_data.action = act
        for pb in arm.pose.bones:
            pb.rotation_mode = "QUATERNION"
        prevq = {}
        root_rest = self.rest["Root"]
        for i in range(n):
            pose = {}
            for bn in self.order:
                rest = self.rest[bn]
                par = self.parent[bn]
                if par is None:
                    pose[bn] = rest
                    continue
                rest_rel = np.linalg.inv(self.rest[par]) @ rest
                base = pose[par] @ rest_rel
                if bn in Rt:
                    desired = np.eye(4)
                    desired[:3, :3] = Rt[bn][i]
                    desired[:3, 3] = base[:3, 3]
                    if bn == "pelvis":
                        desired[:3, 3] = [rest[0, 3] + hips[i, 0], rest[1, 3] + hips[i, 1], hz[i]]
                else:
                    desired = base.copy()
                pose[bn] = desired
                B = np.linalg.inv(base) @ desired
                pb = arm.pose.bones[bn]
                q = Matrix(B[:3, :3].tolist()).to_quaternion()
                if bn in prevq and prevq[bn].dot(q) < 0:
                    q.negate()
                prevq[bn] = q
                if bn in Rt:
                    pb.rotation_quaternion = q
                    pb.keyframe_insert("rotation_quaternion", frame=i + 1)
                if bn == "pelvis":
                    pb.location = Vector(B[:3, 3].tolist())
                    pb.keyframe_insert("location", frame=i + 1)
        _ = root_rest
        track = arm.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 1, act)
        arm.animation_data.action = None
        for pb in arm.pose.bones:
            pb.rotation_quaternion = (1, 0, 0, 0)
            pb.location = (0, 0, 0)

    def export(self, out):
        bpy.ops.object.select_all(action="DESELECT")
        self.arm.select_set(True)
        bpy.context.view_layer.objects.active = self.arm
        bpy.context.scene.render.fps = FPS
        bpy.ops.export_scene.gltf(
            filepath=out, export_format="GLB", use_selection=True, export_animations=True,
            export_animation_mode="NLA_TRACKS", export_force_sampling=True, export_frame_step=1,
            export_def_bones=False, export_skins=True, export_yup=True, export_optimize_animation_size=True,
            export_anim_slide_to_zero=True, export_bake_animation=False,
        )
        meta = dict(clips=self.meta, hipHeight=round(float(self.hip_h), 4), fps=FPS, rig="game_engine (MakeHuman CC0)")
        with open(out.replace(".glb", ".json"), "w") as fh:
            json.dump(meta, fh, indent=1)
        log("exported", out, os.path.getsize(out) // 1024, "KB")


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--only", default="")
    a = ap.parse_args(argv)
    r = Retargeter()
    for name, spec in CLIPS.items():
        if a.only and name not in a.only.split(","):
            continue
        r.process(name, spec)
    r.export(a.out)


if __name__ == "__main__":
    main()
