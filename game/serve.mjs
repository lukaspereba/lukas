import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve('dist'); const port = +process.argv[2] || 8080;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
http.createServer((q, r) => { let p = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith(path.sep) || p === root) p = path.join(root, 'index.html');
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); r.end('404'); return; } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(d); }); }).listen(port, '0.0.0.0', () => console.log('http://localhost:' + port));
