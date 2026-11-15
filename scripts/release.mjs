// Production release of the frontend:  VITE_API_BASE=https://<api-host>/api npm run release
// (or put VITE_API_BASE in .env.production). Refuses local or non-HTTPS API addresses, builds, runs the build check in
// production mode and packs dist/ into release/mentors-frontend-<UTC timestamp>.tar.gz for upload to the web root.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const fromFile = fs.existsSync('.env.production') ? (fs.readFileSync('.env.production', 'utf8').match(/^VITE_API_BASE=(.*)$/m) ?? [])[1]?.trim() : '';
const api = (process.env.VITE_API_BASE || fromFile || '').trim();
let url;
try { url = new URL(api); } catch { /* reported below */ }
if (!url || url.protocol !== 'https:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname) || url.hostname.includes('<')) {
  console.error(`refusing to build a release: VITE_API_BASE must be the HTTPS address of the production API (got "${api || 'nothing'}").`);
  console.error('Set it in .env.production (see .env.production.example) or the environment. This is a deployment requirement.');
  process.exit(2);
}
const run = (cmd, args, env = {}) => execFileSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...env } });
const stamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
console.log(`building the release for ${url.origin} ...`);
run('npx', ['tsc', '-b']);
run('npx', ['vite', 'build', '--outDir', 'dist', '--emptyOutDir'], { VITE_API_BASE: api });
run(process.execPath, ['scripts/check-build.mjs', 'dist', '--production']);
fs.mkdirSync('release', { recursive: true });
const out = path.join('release', `mentors-frontend-${stamp}.tar.gz`);
run('tar', ['-czf', out, '-C', 'dist', '.']);
console.log(`release package: ${out}  (upload its contents to the web root; .htaccess is included)`);
