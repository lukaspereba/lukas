// Malha do terreno + material com mistura procedural (grama/terra/rocha) por inclinação, altura e ruído.
// Rocha usa projeção triplanar (sem esticar em encostas); normais com "whiteout blend".

import {
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector3,
} from 'three';
import type { Heightfield } from './Heightfield';

export function buildTerrainGeometry(hf: Heightfield): BufferGeometry {
  const r = hf.res;
  const pos = new Float32Array(r * r * 3);
  const nrm = new Float32Array(r * r * 3);
  const n = new Vector3();
  for (let j = 0; j < r; j++) {
    for (let i = 0; i < r; i++) {
      const k = (j * r + i) * 3;
      const x = hf.minX + i * hf.cell;
      const z = hf.minZ + j * hf.cell;
      pos[k] = x;
      pos[k + 1] = hf.heights[j * r + i];
      pos[k + 2] = z;
      hf.normalAt(x, z, n);
      nrm[k] = n.x;
      nrm[k + 1] = n.y;
      nrm[k + 2] = n.z;
    }
  }
  const idx = new Uint32Array((r - 1) * (r - 1) * 6);
  let t = 0;
  for (let j = 0; j < r - 1; j++) {
    for (let i = 0; i < r - 1; i++) {
      const a = j * r + i;
      const b = (j + 1) * r + i;
      const c = j * r + i + 1;
      const d = (j + 1) * r + i + 1;
      idx[t++] = a;
      idx[t++] = b;
      idx[t++] = c;
      idx[t++] = c;
      idx[t++] = b;
      idx[t++] = d;
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(pos, 3));
  g.setAttribute('normal', new BufferAttribute(nrm, 3));
  g.setIndex(new BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

export interface TerrainTextures {
  grass: [Texture, Texture];
  dirt: [Texture, Texture];
  rock: [Texture, Texture];
}

export async function loadTerrainTextures(base: string, maxAniso: number): Promise<TerrainTextures> {
  const loader = new TextureLoader();
  const load = async (name: string, color: boolean) => {
    const t = await loader.loadAsync(`${base}${name}.jpg`);
    t.wrapS = t.wrapT = RepeatWrapping;
    t.anisotropy = maxAniso;
    if (color) t.colorSpace = SRGBColorSpace;
    return t;
  };
  const pair = async (n: string): Promise<[Texture, Texture]> => [await load(`${n}_c`, true), await load(`${n}_n`, false)];
  return { grass: await pair('grass'), dirt: await pair('dirt'), rock: await pair('rock') };
}

export function createTerrainMaterial(tex: TerrainTextures): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  mat.name = 'Terreno';
  const uniforms = {
    tGrass: { value: tex.grass[0] },
    tGrassN: { value: tex.grass[1] },
    tDirt: { value: tex.dirt[0] },
    tDirtN: { value: tex.dirt[1] },
    tRock: { value: tex.rock[0] },
    tRockN: { value: tex.rock[1] },
  };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNrm = normalize(mat3(modelMatrix) * objectNormal);',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vWPos;
varying vec3 vWNrm;
uniform sampler2D tGrass, tGrassN, tDirt, tDirtN, tRock, tRockN;
vec3 zhWorldN;
float zhHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float zhNoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(zhHash(i), zhHash(i+vec2(1,0)), f.x), mix(zhHash(i+vec2(0,1)), zhHash(i+vec2(1,1)), f.x), f.y); }
// amostragem anti-repetição: duas escalas com rotação
vec4 zhTex(sampler2D t, vec2 uv){
  #ifdef ZH_ANTITILE
  return mix(texture2D(t, uv), texture2D(t, uv*0.31 + vec2(0.37,0.11)), 0.35);
  #else
  return texture2D(t, uv);
  #endif
}
vec3 zhPlanarN(sampler2D t, vec2 uv, vec3 n){ vec3 tn = texture2D(t, uv).xyz*2.0-1.0; tn = vec3(tn.xy + n.xz, abs(tn.z)*n.y); return normalize(tn.xzy); }
`,
      )
      .replace(
        '#include <map_fragment>',
        `
vec3 N = normalize(vWNrm);
vec2 uvG = vWPos.xz / 3.2;
vec2 uvD = vWPos.xz / 4.0;
// 1) pesos primeiro (baratos), 2) só amostra as camadas que aparecem neste pixel
float macro = zhNoise(vWPos.xz * 0.012) * 0.6 + zhNoise(vWPos.xz * 0.05) * 0.4;
float slope = 1.0 - N.y;
float rockW = smoothstep(0.24, 0.36, slope + (macro - 0.5) * 0.12);
float dirtW = smoothstep(0.58, 0.72, macro + zhNoise(vWPos.xz * 0.21) * 0.25) * (1.0 - rockW);
dirtW = max(dirtW, smoothstep(0.14, 0.24, slope) * (1.0 - rockW) * 0.85);
float grassW = max(0.0, 1.0 - rockW - dirtW);
vec3 albedo = vec3(0.0);
zhWorldN = vec3(0.0);
if (grassW > 0.004) {
  albedo += zhTex(tGrass, uvG).rgb * grassW;
  #ifdef ZH_NORMALS
  zhWorldN += zhPlanarN(tGrassN, uvG, N) * grassW;
  #endif
}
if (dirtW > 0.004) {
  albedo += zhTex(tDirt, uvD).rgb * dirtW;
  #ifdef ZH_NORMALS
  zhWorldN += zhPlanarN(tDirtN, uvD, N) * dirtW;
  #endif
}
if (rockW > 0.004) {
  vec3 tw = pow(abs(N), vec3(4.0)); tw /= (tw.x + tw.y + tw.z);
  vec3 p = vWPos / 6.0;
  albedo += (texture2D(tRock, p.zy)*tw.x + texture2D(tRock, p.xz)*tw.y + texture2D(tRock, p.xy)*tw.z).rgb * rockW;
  #ifdef ZH_NORMALS
  vec3 rnX = texture2D(tRockN, p.zy).xyz*2.0-1.0; rnX = vec3(rnX.xy + N.zy, abs(rnX.z)*N.x);
  vec3 rnY = texture2D(tRockN, p.xz).xyz*2.0-1.0; rnY = vec3(rnY.xy + N.xz, abs(rnY.z)*N.y);
  vec3 rnZ = texture2D(tRockN, p.xy).xyz*2.0-1.0; rnZ = vec3(rnZ.xy + N.xy, abs(rnZ.z)*N.z);
  zhWorldN += normalize(rnX.zyx*tw.x + rnY.xzy*tw.y + rnZ.xyz*tw.z) * rockW;
  #endif
}
albedo *= mix(0.82, 1.12, macro);
albedo = mix(albedo, albedo * vec3(1.08, 1.0, 0.82), smoothstep(0.55, 0.8, macro) * grassW);
diffuseColor.rgb *= albedo;
#ifdef ZH_NORMALS
zhWorldN = normalize(zhWorldN);
#else
zhWorldN = N;
#endif
`,
      )
      .replace('#include <normal_fragment_maps>', 'normal = normalize((viewMatrix * vec4(zhWorldN, 0.0)).xyz);');
  };
  mat.customProgramCacheKey = () => `zh-terrain-v2-${Object.keys(mat.defines ?? {}).sort().join(',')}`;
  return mat;
}

/** Qualidade do terreno: normais por camada (médio/alto) e anti-repetição (alto). */
export function setTerrainQuality(mat: MeshStandardMaterial, q: 'baixo' | 'medio' | 'alto' | 'personalizado', shadows: string): void {
  const d: Record<string, string> = {};
  if (q !== 'baixo' && shadows !== 'desligado') d.ZH_NORMALS = '';
  if (q === 'alto') d.ZH_ANTITILE = '';
  const key = Object.keys(d).sort().join(',');
  if (key !== Object.keys(mat.defines ?? {}).sort().join(',')) {
    mat.defines = d;
    mat.needsUpdate = true;
  }
}

export function createTerrainMesh(hf: Heightfield, mat: MeshStandardMaterial): Mesh {
  const m = new Mesh(buildTerrainGeometry(hf), mat);
  m.name = 'Terreno';
  m.receiveShadow = true;
  m.castShadow = false;
  return m;
}
