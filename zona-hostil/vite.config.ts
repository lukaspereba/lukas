import { defineConfig } from 'vite';

// base relativo: o build funciona em qualquer subpasta (GitHub Pages, artifact, servidor local)
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    assetsInlineLimit: 0,
  },
  server: { host: true },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
} as never);
