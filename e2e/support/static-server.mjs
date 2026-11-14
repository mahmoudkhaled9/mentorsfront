// Serves a built frontend (dist/) with single-page-app fallback, like a production web server would.
//   node e2e/support/static-server.mjs [dist] [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.map': 'application/json', '.woff2': 'font/woff2' };

export function serveStatic(dir, port, host = '127.0.0.1') {
  const root = path.resolve(dir);
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.resolve(root, `.${url}`);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      if (path.extname(url)) { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); return; }
      file = path.join(root, 'index.html'); // SPA fallback for client-side routes
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => resolve(server)); });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [dir = 'dist', port = '4173'] = process.argv.slice(2);
  await serveStatic(dir, Number(port));
  console.log(`serving ${dir} on http://127.0.0.1:${port}`);
}
