#!/bin/bash
# Gera folha de contato de animações: tools/montage.sh saida.png clip1,clip2 [yaw] [variante]
OUT=$1; CLIPS=$2; YAW=${3:-90}; VAR=${4:-alfa}
TMP=$(mktemp -d)
for c in ${CLIPS//,/ }; do for t in 0 0.25 0.5 0.75; do
  node tools/shot.mjs "file=assets/characters/soldier_$VAR.glb&animfile=assets/characters/anims.glb&anim=$c&t=$t&yaw=$YAW&dist=5.5&h=0.95" $TMP/${c}_$t.png 260 360 >/dev/null
done; done
python3 -I - "$TMP" "$OUT" "$CLIPS" <<'PY'
import sys
from PIL import Image, ImageDraw
tmp, out, clips = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
W, H = 260, 360
o = Image.new("RGB", (W * 4, H * len(clips)))
d = ImageDraw.Draw(o)
for r, c in enumerate(clips):
    for k, t in enumerate(("0", "0.25", "0.5", "0.75")):
        o.paste(Image.open(f"{tmp}/{c}_{t}.png"), (k * W, r * H))
    d.text((6, r * H + 6), c, fill=(255, 255, 0))
o.save(out)
PY
rm -rf $TMP
