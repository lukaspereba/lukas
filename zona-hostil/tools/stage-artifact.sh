#!/bin/bash
# Monta o pacote para hospedagens restritas (sem .glb e sem fetch de data:): tools/stage-artifact.sh <pasta_saida>
set -euo pipefail
OUT=${1:?pasta de saída}
cd "$(dirname "$0")/.."
rm -rf dist "$OUT"
VITE_MODEL_EXT=.gltf.json npx vite build >/dev/null
mkdir -p "$OUT"
cp -r dist/assets "$OUT/"
for f in "$OUT"/assets/characters/*.glb; do
  python3 -I tools/glb2gltf.py "$f" "${f%.glb}.gltf.json" >/dev/null
  rm "$f"
done
JS=$(cd dist/assets && ls *.js)
CSS=$(cd dist/assets && ls *.css)
printf '<title>Zona Hostil</title>\n<meta name="theme-color" content="#14171a">\n<link rel="stylesheet" href="./assets/%s">\n<div id="app"></div>\n<script type="module" src="./assets/%s"></script>\n' "$CSS" "$JS" > "$OUT/index.html"
# página de teste local com CSP restritiva (bloqueia data: em fetch, como a hospedagem)
{
  echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  echo "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; connect-src 'self'\">"
  echo '</head><body>'
  cat "$OUT/index.html"
  echo '</body></html>'
} > "$OUT/csp-test.html"
rm -rf dist
echo "ok: $OUT ($(find "$OUT" -type f | wc -l) arquivos, $(du -sh "$OUT" | cut -f1))"
