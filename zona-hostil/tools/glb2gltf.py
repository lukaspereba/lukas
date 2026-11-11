"""Converte .glb em glTF JSON para hospedagens que não servem binários nem permitem `data:` em fetch.

- O buffer de geometria/animação vai em base64 dentro do JSON (o jogo decodifica sem fetch).
- As imagens embutidas viram arquivos .jpg/.png ao lado do JSON (carregados como <img>).

Uso: python3 tools/glb2gltf.py entrada.glb saida.gltf.json
"""
import base64
import json
import os
import struct
import sys


def convert(src: str, dst: str) -> list[str]:
    data = open(src, "rb").read()
    magic, _v, _l = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF":
        raise SystemExit(f"{src}: não é GLB")
    off, doc, binchunk = 12, None, b""
    while off < len(data):
        clen, ctype = struct.unpack_from("<I4s", data, off)
        chunk = data[off + 8: off + 8 + clen]
        if ctype == b"JSON":
            doc = json.loads(chunk.decode("utf-8"))
        elif ctype == b"BIN\x00":
            binchunk = chunk
        off += 8 + clen
    assert doc is not None
    stem = os.path.basename(dst).split(".")[0]
    outdir = os.path.dirname(dst)
    written = []
    image_views = set()
    for i, img in enumerate(doc.get("images", [])):
        if "bufferView" not in img:
            continue
        bv = doc["bufferViews"][img["bufferView"]]
        raw = binchunk[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
        ext = ".png" if img.get("mimeType") == "image/png" else ".jpg"
        name = f"{stem}_img{i}{ext}"
        open(os.path.join(outdir, name), "wb").write(raw)
        written.append(name)
        image_views.add(img["bufferView"])
        del img["bufferView"]
        img.pop("mimeType", None)
        img["uri"] = name
    # reempacota o buffer sem as imagens
    remap, views, newbin = {}, [], bytearray()
    for i, bv in enumerate(doc.get("bufferViews", [])):
        if i in image_views:
            continue
        raw = binchunk[bv.get("byteOffset", 0): bv.get("byteOffset", 0) + bv["byteLength"]]
        while len(newbin) % 4:
            newbin.append(0)
        nb = dict(bv)
        nb["byteOffset"] = len(newbin)
        newbin += raw
        remap[i] = len(views)
        views.append(nb)
    doc["bufferViews"] = views
    for acc in doc.get("accessors", []):
        if "bufferView" in acc:
            acc["bufferView"] = remap[acc["bufferView"]]
    if doc.get("buffers"):
        doc["buffers"][0] = {"byteLength": len(newbin),
                             "uri": "data:application/octet-stream;base64," + base64.b64encode(bytes(newbin)).decode("ascii")}
    with open(dst, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, separators=(",", ":"))
    return written


if __name__ == "__main__":
    for n in convert(sys.argv[1], sys.argv[2]):
        print(n)
