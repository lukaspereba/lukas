import { build } from 'esbuild';
import fs from 'fs';
const dev = process.argv.includes('--dev');
await build({ entryPoints: ['src/main.js'], bundle: true, minify: !dev, format: 'iife', target: 'es2020', outfile: 'dist/game.js', legalComments: 'none' });
const shell = fs.readFileSync('src/shell.html', 'utf8');
const js = fs.readFileSync('dist/game.js', 'utf8');
// Página do artefato (sem doctype/head/body, script externo game.js)
fs.writeFileSync('dist/page.html', shell + '\n<script src="game.js"></script>\n');
// Página independente: tudo em um único arquivo
const standalone = '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"></head><body>' + shell + '\n<script>' + js.replace(/<\/script/g, '<\\/script') + '</script></body></html>';
fs.writeFileSync('dist/index.html', standalone);
console.log('ok', (js.length / 1024 | 0) + ' KB');
