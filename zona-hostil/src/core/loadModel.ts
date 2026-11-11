// Carregamento de modelos glTF compatível com páginas de segurança restrita (CSP que bloqueia `data:`).
// Formatos aceitos:
//  - .glb: carregamento normal
//  - .gltf.json: JSON com o buffer em base64 e imagens em arquivos .jpg/.png separados.
//    O buffer é decodificado aqui (sem fetch de `data:`) e montado como GLB em memória.

import { TextureLoader } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Monta um GLB (cabeçalho + chunk JSON + chunk BIN) em memória. */
export function buildGlb(json: unknown, bin: Uint8Array): ArrayBuffer {
  const enc = new TextEncoder();
  let jsonBytes = enc.encode(JSON.stringify(json));
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4;
  if (jsonPad) {
    const p = new Uint8Array(jsonBytes.length + jsonPad);
    p.set(jsonBytes);
    p.fill(0x20, jsonBytes.length);
    jsonBytes = p;
  }
  const binPad = (4 - (bin.length % 4)) % 4;
  const binLen = bin.length + binPad;
  const total = 12 + 8 + jsonBytes.length + (bin.length ? 8 + binLen : 0);
  const buf = new ArrayBuffer(total);
  const dv = new DataView(buf);
  const u8 = new Uint8Array(buf);
  dv.setUint32(0, 0x46546c67, true); // 'glTF'
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonBytes.length, true);
  dv.setUint32(16, 0x4e4f534a, true); // 'JSON'
  u8.set(jsonBytes, 20);
  if (bin.length) {
    const o = 20 + jsonBytes.length;
    dv.setUint32(o, binLen, true);
    dv.setUint32(o + 4, 0x004e4942, true); // 'BIN\0'
    u8.set(bin, o + 8);
  }
  return buf;
}

export async function loadModel(loader: GLTFLoader, url: string): Promise<GLTF> {
  if (!url.endsWith('.gltf.json')) return loader.loadAsync(url);
  const base = url.slice(0, url.lastIndexOf('/') + 1);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const json = (await res.json()) as { buffers?: Array<{ uri?: string; byteLength: number }> };
  let bin: Uint8Array = new Uint8Array(0);
  const uri = json.buffers?.[0]?.uri;
  if (uri && uri.startsWith('data:')) {
    bin = base64ToBytes(uri.slice(uri.indexOf(',') + 1));
    delete json.buffers![0].uri;
  }
  // imagens externas via <img> (mesmo caminho das texturas do mundo, comprovadamente permitido)
  const l = new GLTFLoader(loader.manager);
  l.register((parser) => {
    const p = parser as unknown as { textureLoader: TextureLoader; options: { manager: never; crossOrigin: string } };
    p.textureLoader = new TextureLoader(p.options.manager);
    p.textureLoader.setCrossOrigin(p.options.crossOrigin);
    return { name: 'ZH_texture_loader' } as never;
  });
  return l.parseAsync(buildGlb(json, bin), base);
}
