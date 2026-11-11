"""Converte .glb em glTF JSON autocontido (buffer em data URI), para hospedagens que não servem binários.

Uso: python3 tools/glb2gltf.py entrada.glb saida.gltf.json
"""
import base64
import json
import struct
import sys


def convert(src: str, dst: str) -> None:
    data = open(src, "rb").read()
    magic, _version, _length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF":
        raise SystemExit(f"{src}: não é GLB")
    off = 12
    doc = None
    binchunk = b""
    while off < len(data):
        clen, ctype = struct.unpack_from("<I4s", data, off)
        chunk = data[off + 8: off + 8 + clen]
        if ctype == b"JSON":
            doc = json.loads(chunk.decode("utf-8"))
        elif ctype == b"BIN\x00":
            binchunk = chunk
        off += 8 + clen
    if doc is None:
        raise SystemExit("GLB sem JSON")
    if binchunk:
        doc["buffers"][0]["uri"] = "data:application/octet-stream;base64," + base64.b64encode(binchunk).decode("ascii")
    with open(dst, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, separators=(",", ":"))


if __name__ == "__main__":
    convert(sys.argv[1], sys.argv[2])
