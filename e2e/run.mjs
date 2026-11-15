// One command for the browser tests:  node e2e/run.mjs [--audit] [--only-audit] [file filter...]
//  1. picks free ports (never stops anything already running)
//  2. builds the frontend against the test API (skip with E2E_DIST=<built dist>, then also set E2E_API_PORT)
//  3. starts the real backend in demo mode (in-memory SQLite stand-in - your MySQL database is never touched)
//  4. runs e2e/tests/*.test.mjs with node:test (and the interaction audit with --audit)
// Results: test-results/e2e (screenshots, traces of failures, console errors), test-results/audit (coverage map).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { FRONT_ROOT, RESULTS, buildFrontend, freePort, startStack } from './support/stack.mjs';

const args = process.argv.slice(2);
const withAudit = args.includes('--audit') || args.includes('--only-audit');
const onlyAudit = args.includes('--only-audit');
const filters = args.filter((a) => !a.startsWith('--'));

fs.rmSync(path.join(RESULTS, 'e2e'), { recursive: true, force: true });
fs.mkdirSync(path.join(RESULTS, 'e2e'), { recursive: true });

// On GitHub Actions, a startup failure is also printed as an ::error:: annotation (visible in the run summary without
// opening the log), with the end of the test backend's log.
process.on('uncaughtException', reportAndExit);
process.on('unhandledRejection', reportAndExit);
function reportAndExit(err) {
  const message = err?.stack ?? String(err);
  console.error(message);
  if (process.env.GITHUB_ACTIONS) {
    const esc = (t) => String(t).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    let backendLog = '';
    try { backendLog = fs.readFileSync(path.join(RESULTS, 'backend.log'), 'utf8').split('\n').slice(-25).join('\n'); } catch { /* no backend log yet */ }
    console.log(`::error title=e2e startup::${esc(message.slice(0, 1500))}${backendLog ? esc(`\n--- backend.log (end) ---\n${backendLog}`) : ''}`);
  }
  process.exit(1);
}

const apiPort = process.env.E2E_DIST ? Number(process.env.E2E_API_PORT ?? 4011) : await freePort(Number(process.env.E2E_API_PORT ?? 4011));
const webPort = await freePort(Number(process.env.E2E_WEB_PORT ?? 4173), [apiPort]);
let dist = process.env.E2E_DIST;
if (!dist) {
  dist = path.join(RESULTS, '.e2e-dist');
  console.log(`building the frontend for the test API on port ${apiPort} ...`);
  await buildFrontend(`http://127.0.0.1:${apiPort}/api`, dist);
}
const stack = await startStack({ dist, apiPort, webPort });
console.log(`stack ready: web ${stack.app}  api ${stack.api}`);
process.env.E2E_APP = stack.app;
process.env.E2E_API = stack.api;

let code = 0;
try {
  if (!onlyAudit) {
    const testDir = path.join(FRONT_ROOT, 'e2e', 'tests');
    const files = fs.readdirSync(testDir).filter((f) => f.endsWith('.test.mjs') && (!filters.length || filters.some((x) => f.includes(x)))).map((f) => path.join(testDir, f));
    code = await new Promise((resolve) => {
      const child = spawn(process.execPath, ['--test', '--test-concurrency=1', '--test-reporter=spec', '--test-reporter-destination=stdout',
        '--test-reporter=junit', `--test-reporter-destination=${path.join(RESULTS, 'e2e', 'junit.xml')}`, ...files], { stdio: 'inherit', env: process.env });
      child.on('exit', (c) => resolve(c ?? 1));
    });
  }
  if (withAudit) {
    const { runAudit } = await import('./audit.mjs');
    const { closeBrowser } = await import('./support/browser.mjs');
    const summary = await runAudit().finally(closeBrowser);
    if (summary.deadControls || summary.problems.length) code = code || 1;
  }
} finally {
  await stack.stop();
}
process.exit(code);
