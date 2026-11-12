// Utilitários gerais: RNG determinístico, matemática, ruído, armazenamento seguro.
export function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
export const TAU = Math.PI * 2;
export function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
export const dist2 = (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; };
export const pick = (rng, arr) => arr[(rng() * arr.length) | 0];
export const rr = (rng, a, b) => a + rng() * (b - a);

// Ruído de valor 2D com interpolação suave (determinístico).
function h2(x, y, s) { let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041); n = (n ^ (n >>> 13)) * 1274126177; n ^= n >>> 16; return (n >>> 0) / 4294967296; }
export function vnoise(x, y, s = 1) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi, s), b = h2(xi + 1, yi, s), c = h2(xi, yi + 1, s), d = h2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, oct = 4, s = 1) { let a = 0.5, f = 1, t = 0, n = 0; for (let i = 0; i < oct; i++) { t += a * vnoise(x * f, y * f, s + i * 17); n += a; a *= 0.5; f *= 2; } return t / n; }
// Ruído periódico (para texturas que precisam repetir sem emendas).
export function pnoise(x, y, per, s = 1) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const m = (k) => ((k % per) + per) % per;
  const a = h2(m(xi), m(yi), s), b = h2(m(xi + 1), m(yi), s), c = h2(m(xi), m(yi + 1), s), d = h2(m(xi + 1), m(yi + 1), s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function pfbm(x, y, per, oct = 4, s = 1) { let a = 0.5, t = 0, n = 0; for (let i = 0; i < oct; i++) { t += a * pnoise(x, y, per, s + i * 31); n += a; a *= 0.5; x *= 2; y *= 2; per *= 2; } return t / n; }

// localStorage pode falhar (janela privada, pré-visualização): sempre protegido.
const mem = {};
export const store = {
  get(k, def) { try { const v = localStorage.getItem('cbr_' + k); return v == null ? (k in mem ? mem[k] : def) : JSON.parse(v); } catch (e) { return k in mem ? mem[k] : def; } },
  set(k, v) { mem[k] = v; try { localStorage.setItem('cbr_' + k, JSON.stringify(v)); } catch (e) { /* sem persistência */ } },
};
export const $ = (id) => document.getElementById(id);
export function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
export const fmtTime = (s) => { s = Math.max(0, Math.ceil(s)); return ((s / 60) | 0) + ':' + String(s % 60).padStart(2, '0'); };
