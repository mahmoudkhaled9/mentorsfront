// Full verification of BOTH projects, in order, with a summary at the end (also written to
// test-results/verify-summary.md). Every step runs even if an earlier one failed, so you see the whole picture; the
// exit code is 1 if anything failed. Nothing here touches your MySQL database or your .env files:
//  - backend tests use an in-memory SQLite stand-in (npm run test:mysql is separate and needs a *_test database)
//  - the browser tests start their own demo backend on free ports and stop it afterwards.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACK = path.resolve(process.env.BACKEND_DIR ?? path.join(FRONT, '../yourmentorsapp'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const STEPS = [
  ['Backend: syntax check', BACK, ['run', 'check']],
  ['Backend: unit tests', BACK, ['run', 'test:unit']],
  ['Backend: API integration tests (production table layout)', BACK, ['run', 'test:integration']],
  ['Backend: API integration tests (fresh database from schema.sql)', BACK, ['run', 'test:canonical']],
  ['Frontend: TypeScript', FRONT, ['run', 'typecheck']],
  ['Frontend: ESLint', FRONT, ['run', 'lint']],
  ['Frontend: unit tests', FRONT, ['run', 'test:unit']],
  ['Frontend: production build', FRONT, ['run', 'build:check']],
  ['Browser: end-to-end tests + interaction audit', FRONT, ['run', 'test:e2e:all']],
];

const results = [];
for (const [name, cwd, args] of STEPS) {
  console.log(`\n=== ${name}  (npm ${args.join(' ')} in ${path.basename(cwd)})`);
  const started = Date.now();
  const code = await new Promise((resolve) => {
    const child = spawn(npm, args, { cwd, stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', (c) => resolve(c ?? 1));
    child.on('error', () => resolve(1));
  });
  results.push({ name, ok: code === 0, seconds: Math.round((Date.now() - started) / 1000) });
}

const lines = ['# Your Mentor - full verification', '', `Run at ${new Date().toISOString()}`, '', '| Step | Result | Time |', '|---|---|---|',
  ...results.map((r) => `| ${r.name} | ${r.ok ? 'PASS' : '**FAIL**'} | ${r.seconds}s |`), '',
  'Details: test-results/e2e (screenshots, traces, junit.xml, console errors), test-results/audit/coverage.md (button coverage map).'];
fs.mkdirSync(path.join(FRONT, 'test-results'), { recursive: true });
fs.writeFileSync(path.join(FRONT, 'test-results', 'verify-summary.md'), `${lines.join('\n')}\n`);
console.log(`\n${lines.slice(4, 6 + results.length).join('\n')}`);
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\nFAILED: ${failed.map((r) => r.name).join('; ')}` : '\nALL CHECKS PASSED');
process.exit(failed.length ? 1 : 0);
