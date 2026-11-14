// Starts the REAL stack for end-to-end tests: the actual backend (in-memory SQLite stand-in, demo company, never
// MySQL), a production build of this frontend, and a static web server. Ports are probed, never taken over: if a port
// is busy the next free one is used and nothing else is touched.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from './static-server.mjs';

export const FRONT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const BACKEND_ROOT = path.resolve(process.env.BACKEND_DIR ?? path.join(FRONT_ROOT, '../yourmentorsapp'));
export const RESULTS = path.join(FRONT_ROOT, 'test-results');
export const DEMO_PASSWORD = 'Demo-Pass-2026';
export const ACCOUNTS = {
  admin: 'admin@demo.test', owner: 'owner@demo.test', director: 'director@demo.test', manager: 'manager@demo.test',
  leader: 'leader@demo.test', agent: 'agent@demo.test', agent2: 'agent2@demo.test', leader2: 'leader2@demo.test', agent3: 'agent3@demo.test',
};

const isFree = (port) => new Promise((resolve) => {
  const srv = net.createServer().once('error', () => resolve(false)).once('listening', () => srv.close(() => resolve(true)));
  srv.listen(port, '127.0.0.1');
});

export async function freePort(start, avoid = []) {
  for (let p = start; p < start + 50; p += 1) if (!avoid.includes(p) && (await isFree(p))) return p;
  throw new Error(`no free port between ${start} and ${start + 49}`);
}

/** Production build with the API base pointing at the test backend. Uses Vite (npm run build) unless E2E_DIST is given. */
export async function buildFrontend(apiBase, outDir) {
  const vite = path.join(FRONT_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite');
  if (!fs.existsSync(vite)) throw new Error('Vite is not installed - run "npm install" in mentorsfront first');
  await run(vite, ['build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'warn'], { cwd: FRONT_ROOT, env: { ...process.env, VITE_API_BASE: apiBase } });
}

export function run(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} ${args.join(' ')} exited with ${code}`))));
    child.on('error', reject);
  });
}

/** Starts backend + web server. Returns { app, api, stop }. */
export async function startStack({ dist, apiPort, webPort }) {
  const devServer = path.join(BACKEND_ROOT, 'test', 'support', 'dev-server.js');
  if (!fs.existsSync(devServer)) throw new Error(`backend not found at ${BACKEND_ROOT} (set BACKEND_DIR)`);
  fs.mkdirSync(RESULTS, { recursive: true });
  const log = fs.createWriteStream(path.join(RESULTS, 'backend.log'));
  const origin = `http://127.0.0.1:${webPort}`;
  const backend = spawn(process.execPath, ['--no-warnings', devServer, '--demo', '--port', String(apiPort)], {
    cwd: BACKEND_ROOT,
    env: { ...process.env, CORS_ORIGIN: `${origin},http://localhost:${webPort}`, LOG_LEVEL: 'warn' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  backend.stdout.pipe(log);
  backend.stderr.pipe(log);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('backend did not start within 60 s - see test-results/backend.log')), 60000);
    backend.stdout.on('data', (chunk) => { if (String(chunk).includes('DEMO API ready')) { clearTimeout(timer); resolve(); } });
    backend.on('exit', (code) => { clearTimeout(timer); reject(new Error(`backend exited early (${code}) - see test-results/backend.log`)); });
  });
  const web = await serveStatic(dist, webPort);
  return {
    app: origin,
    api: `http://127.0.0.1:${apiPort}/api`,
    async stop() {
      await new Promise((resolve) => web.close(resolve));
      backend.kill('SIGTERM');
    },
  };
}
