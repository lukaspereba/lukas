# Pipeline de personagens

Gera os soldados (`public/assets/characters/soldier_*.glb`) e as animações (`anims.glb` + `anims.json`)
com Blender headless (`bpy`), usando apenas **dados** CC0 do MakeHuman e mocap da CMU.

## 1. Fontes (uma vez)
```bash
SRC=/caminho/para/assets-src; mkdir -p $SRC && cd $SRC
git clone --depth 1 https://github.com/makehumancommunity/mpfb2           # malha, morphs, rig, pesos
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/dmaugis/makehuman-py3-assets mhassets
(cd mhassets && git sparse-checkout set --no-cone 'base/skins/' 'base/eyes/' 'base/eyebrows/' \
   'base/eyelashes/' 'base/clothes/male_casualsuit01/' 'base/clothes/shoes03/' && git checkout)
# texturas (LFS): baixe cada arquivo .png ponteiro em
#   https://media.githubusercontent.com/media/dmaugis/makehuman-py3-assets/master/<caminho>
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/makehumancommunity/makehuman mh
(cd mh && git sparse-checkout set --no-cone 'makehuman/data/eyes/' && git checkout)
mkdir -p bvh && for c in 82_08 07_01 09_01 102_05 113_01 113_18 16_01; do s=$(printf %03d ${c%%_*}); \
  curl -fsSo bvh/$c.bvh https://raw.githubusercontent.com/una-dinosauria/cmu-mocap/master/data/$s/$c.bvh; done
```

## 2. Gerar
```bash
python3.13 -m venv venv && venv/bin/pip install bpy==5.3.0 pillow
export ZH_ASSET_SRC=$SRC ZH_BVH_DIR=$SRC/bvh
for v in alfa bravo charlie delta; do
  venv/bin/python build_soldier.py --variant $v --out ../../public/assets/characters/soldier_$v.glb
done
venv/bin/python retarget.py --out ../../public/assets/characters/anims.glb
```

## Arquivos
- `mhdata.py`: leitor próprio de OBJ/targets/macros/.mhclo/rig/pesos do MakeHuman.
- `build_soldier.py`: corpo, morphs, esqueleto, roupas, pele (cabelo raspado e luvas pintados), materiais e exportação glTF.
- `gear.py`: equipamento tático procedural ajustado às medidas do corpo (raycast na superfície).
- `texbake.py`: rasterizador em UV, ruído 3D e camuflagens.
- `bvh.py` e `retarget.py`: leitura de BVH, cinemática direta, retarget por T-pose, ciclos e espelhamento.

O addon MPFB2 **não é executado**: só seus arquivos de dados são lidos.
