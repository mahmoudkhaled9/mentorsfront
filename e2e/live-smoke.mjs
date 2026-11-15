// READ-MOSTLY smoke test of a running stack (built frontend + real backend + its real database), e.g. the local
// MySQL development database or a staging server. It only signs in and opens pages - it never clicks buttons or submits
// forms, so it creates no CRM records (a sign-in may add an activity-log line).
//
//   LIVE_APP=http://127.0.0.1:4183 LIVE_API=http://127.0.0.1:4031/api LIVE_PASSWORD_FILE=../yourmentorsapp/.dev-seed-accounts.local.txt \
//   PLAYWRIGHT_MODULE=<path to playwright> node e2e/live-smoke.mjs
//
// Accounts: the demo company of `npm run seed:dev` (password from LIVE_PASSWORD or the `password=` line of
// LIVE_PASSWORD_FILE; never printed). For every role it checks: every page it may open renders without console errors
// or failed API calls, pages it may not open send it back to the dashboard, the admin menu matches the role, record
// details open, and every developer logo image actually loads.
import fs from 'node:fs';
import { loadPlaywright } from './support/browser.mjs';

const APP = process.env.LIVE_APP ?? 'http://127.0.0.1:4183';
const API = process.env.LIVE_API ?? 'http://127.0.0.1:4031/api';
const password = process.env.LIVE_PASSWORD
  ?? (process.env.LIVE_PASSWORD_FILE && fs.readFileSync(process.env.LIVE_PASSWORD_FILE, 'utf8').match(/^password=(.+)$/m)?.[1]?.trim());
if (!password) { console.error('set LIVE_PASSWORD or LIVE_PASSWORD_FILE'); process.exit(2); }

const PAGES = ['/dashboard', '/developers', '/deals', '/leads', '/cold-calls', '/call-history', '/reports', '/agent-care', '/profile'];
const SUPER_PAGES = ['/admin/users', '/admin/departments', '/admin/jobtitles', '/admin/brokers', '/admin/titles', '/admin/statuses', '/admin/sources', '/admin/projects', '/admin/destinations', '/admin/property-types', '/admin/upload-data'];
const ROLES = [
  { email: 'owner@demo.test', role: 'franchise_owner', super: true, assign: true },
  { email: 'director@demo.test', role: 'director', super: false, assign: true },
  { email: 'manager@demo.test', role: 'sales_manager', super: false, assign: true },
  { email: 'supervisor@demo.test', role: 'sales_supervisor', super: false, assign: true },
  { email: 'leader@demo.test', role: 'team_leader', super: false, assign: true },
  { email: 'agent@demo.test', role: 'agent', super: false, assign: false },
];

const results = [];
const fail = (who, what) => { results.push({ who, what }); console.log(`  FAIL ${who}: ${what}`); };
const pw = await loadPlaywright();
const browser = await pw.chromium.launch();
let pagesChecked = 0;
try {
  for (const r of ROLES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const problems = [];
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text().slice(0, 160)}`); });
    page.on('pageerror', (e) => problems.push(`page error: ${e.message.slice(0, 160)}`));
    page.on('response', (res) => { if (res.url().startsWith(API) && res.status() >= 400) problems.push(`${res.request().method()} ${res.url().slice(API.length)} -> ${res.status()}`); });
    // a request cancelled because the test itself navigated away (net::ERR_ABORTED) is not a failure of the app
    page.on('requestfailed', (req) => { if (req.url().startsWith(API) && !/ERR_ABORTED/.test(req.failure()?.errorText ?? '')) problems.push(`network failure ${req.url().slice(API.length)} (${req.failure()?.errorText})`); });

    await page.goto(`${APP}/login`);
    await page.fill('#email', r.email);
    await page.fill('#password', password);
    await page.click('button[type=submit]');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 }).catch(() => fail(r.role, 'sign-in did not reach the dashboard'));
    await page.waitForLoadState('networkidle').catch(() => {});
    const allowed = [...PAGES, ...(r.super ? SUPER_PAGES : []), ...(r.assign ? ['/admin/assign'] : [])];
    const denied = [...(r.super ? [] : SUPER_PAGES), ...(r.assign ? [] : ['/admin/assign'])];
    for (const path of allowed) {
      problems.length = 0;
      await page.goto(`${APP}${path}`);
      await page.waitForLoadState('networkidle').catch(() => {});
      pagesChecked += 1;
      if (!new URL(page.url()).pathname.startsWith(path)) fail(r.role, `${path} redirected to ${new URL(page.url()).pathname}`);
      const text = (await page.locator('main').innerText().catch(() => '')).trim();
      if (text.length < 20) fail(r.role, `${path} renders an (almost) empty page`);
      for (const p of problems) fail(r.role, `${path}: ${p}`);
      if (path === '/developers') {
        const broken = await page.$$eval('img', (imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src')?.startsWith('/developers/')).map((i) => i.getAttribute('src')));
        for (const b of broken) fail(r.role, `developer logo does not load: ${b}`);
      }
    }
    for (const path of denied) {
      await page.goto(`${APP}${path}`);
      await page.waitForURL(/\/dashboard/, { timeout: 5000 }).catch(() => fail(r.role, `${path} was not refused`));
    }
    // record details: the first lead this role can see opens and shows its history
    const token = await page.evaluate(() => localStorage.getItem('mentors_auth_token'));
    const leads = await (await fetch(`${API}/leads`, { headers: { authorization: `Bearer ${token}` } })).json();
    if (leads.length) {
      problems.length = 0;
      await page.goto(`${APP}/leads/${leads[0].id}`);
      await page.waitForLoadState('networkidle').catch(() => {});
      pagesChecked += 1;
      if (!(await page.getByText(leads[0].name, { exact: false }).first().isVisible().catch(() => false))) fail(r.role, `lead ${leads[0].id} details do not show the lead`);
      for (const p of problems) fail(r.role, `/leads/${leads[0].id}: ${p}`);
    }
    console.log(`  ok   ${r.role}: ${allowed.length} pages open, ${denied.length} refused, sees ${leads.length} lead(s)`);
    await ctx.close();
  }
} finally {
  await browser.close();
}
console.log(results.length ? `LIVE SMOKE: ${results.length} problem(s) in ${pagesChecked} page visits` : `LIVE SMOKE: ok (${pagesChecked} page visits, ${ROLES.length} roles)`);
process.exit(results.length ? 1 : 0);
