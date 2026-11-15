// Dependency security gate for CI and releases:  node scripts/audit-check.mjs
// Fails on any HIGH or CRITICAL advisory in the production dependencies, except the ones listed in ACCEPTED below with
// a reason. An accepted entry also fails the check as soon as a fix becomes available, so it cannot be forgotten.
import { execFileSync } from 'node:child_process';

const ACCEPTED = {
  // SheetJS no longer publishes fixes to npm (0.20.x is distributed from cdn.sheetjs.com). Used only on the
  // administrator-only Upload Data page, parsing a file the administrator picked, inside their own browser.
  // Owner decision pending: switch to the vendor tarball or keep. See FINAL-PRODUCTION-READINESS.md.
  xlsx: 'prototype pollution / ReDoS when parsing a malicious spreadsheet (admin-only upload, client-side)',
};

let raw;
try {
  raw = execFileSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch (err) {
  raw = err.stdout; // npm audit exits non-zero when it finds anything
}
const report = JSON.parse(raw || '{}');
if (report.error) { console.error(`npm audit failed: ${report.error.summary ?? 'unknown error'}`); process.exit(2); }
const problems = [];
for (const [name, v] of Object.entries(report.vulnerabilities ?? {})) {
  if (!['high', 'critical'].includes(v.severity)) continue;
  if (ACCEPTED[name] && !v.fixAvailable) { console.log(`  accepted ${v.severity} ${name}: ${ACCEPTED[name]}`); continue; }
  problems.push(`${v.severity} ${name}${v.fixAvailable ? ' (fix available: npm audit fix)' : ''}`);
}
for (const p of problems) console.log(`  PROBLEM ${p}`);
console.log(problems.length ? `AUDIT: ${problems.length} unaccepted high/critical issue(s)` : 'AUDIT: ok (no unaccepted high/critical issue)');
process.exit(problems.length ? 1 : 0);
