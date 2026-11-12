"""Empacota o relevo (Float32 res×res) em JSON servível: alturas em centímetros (Uint16, base64)
somadas a um mínimo. Uso: python3 tools/map/pack_heights.py entrada.bin meta.json saida.json"""
import base64, json, struct, sys

src, meta_path, out = sys.argv[1:4]
meta = json.load(open(meta_path))
raw = open(src, 'rb').read()
n = len(raw) // 4
h = struct.unpack(f'<{n}f', raw)
assert n == meta['res'] ** 2, (n, meta['res'])
lo = min(h)
cm = [round((v - lo) * 100) for v in h]
assert max(cm) < 65536
meta['min'] = lo
meta['encoding'] = 'uint16 little-endian, centimetros acima de min, base64'
meta['heights'] = base64.b64encode(struct.pack(f'<{n}H', *cm)).decode()
json.dump(meta, open(out, 'w'), ensure_ascii=False)
print('min', lo, 'max', max(h), 'bytes', len(meta['heights']))
