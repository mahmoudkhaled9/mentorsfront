// Browser helpers shared by the E2E tests and the interaction audit. Every test page records console errors, page
// errors and failed API calls; on failure a screenshot + Playwright trace are written to test-results/e2e/.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ACCOUNTS, DEMO_PASSWORD, RESULTS } from './stack.mjs';

export const APP = process.env.E2E_APP ?? 'http://127.0.0.1:4173';
export const API = process.env.E2E_API ?? 'http://127.0.0.1:4011/api';
const OUT = path.join(RESULTS, 'e2e');

/** Finds Playwright: the project's node_modules first, then PLAYWRIGHT_MODULE (path to an installed copy). */
export async function loadPlaywright() {
  const require = createRequire(path.join(process.cwd(), 'package.json'));
  for (const name of ['playwright', '@playwright/test', 'playwright-core', process.env.PLAYWRIGHT_MODULE].filter(Boolean)) {
    try {
      const mod = require(name);
      if (mod.chromium) return mod;
    } catch { /* try the next one */ }
  }
  throw new Error('Playwright is not installed. Run: npm install --no-save playwright && npx playwright install chromium');
}

let browserPromise;
export async function browser() {
  browserPromise ??= loadPlaywright().then((pw) => pw.chromium.launch({ headless: process.env.HEADED !== '1' }));
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) await (await browserPromise).close();
  browserPromise = undefined;
}

const slug = (s) => s.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 80);

/**
 * Opens a fresh browser context (own storage = own session) and tracks problems.
 * Use: const s = await session(t); ... await s.done(); (done() fails the test on console/page errors).
 */
/** `expectServerErrors`: the test itself injects 5xx answers (page.route) to check the UI's error handling. */
export async function session(t, { viewport = { width: 1440, height: 900 }, allowErrors = [], expectServerErrors = false } = {}) {
  const b = await browser();
  const context = await b.newContext({ viewport, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  await context.tracing.start({ screenshots: true, snapshots: true });
  // third-party images are never needed by the app; blocking them keeps tests offline-safe
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (route) => route.abort());
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`page error: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/net::ERR_FAILED|ERR_BLOCKED|ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(text)) return; // blocked third-party
    if (allowErrors.some((re) => re.test(text))) return;
    problems.push(`console error: ${text.slice(0, 300)}`);
  });
  page.on('response', (r) => {
    if (!expectServerErrors && r.url().startsWith(API) && r.status() >= 500) problems.push(`server error ${r.status()} ${r.request().method()} ${r.url()}`);
  });
  const name = slug(t.fullName ?? t.name ?? 'test');
  return {
    page,
    context,
    problems,
    async shot(label) {
      fs.mkdirSync(path.join(OUT, 'screenshots'), { recursive: true });
      const file = path.join(OUT, 'screenshots', `${name}--${slug(label)}.png`);
      await page.screenshot({ path: file, fullPage: true });
      return file;
    },
    /** Ends the session. Keeps the trace + a screenshot when the test failed (or KEEP_TRACES=1). */
    async done(failed = false) {
      const keep = failed || problems.length > 0 || process.env.KEEP_TRACES === '1';
      if (keep) {
        fs.mkdirSync(path.join(OUT, 'traces'), { recursive: true });
        await this.shot('final').catch(() => {});
        await context.tracing.stop({ path: path.join(OUT, 'traces', `${name}.zip`) });
      } else {
        await context.tracing.stop();
      }
      if (problems.length) fs.appendFileSync(path.join(OUT, 'console-errors.log'), `${t.name}\n  ${problems.join('\n  ')}\n`);
      await context.close();
      if (problems.length && !failed) throw new Error(`browser problems during "${t.name}":\n  ${problems.join('\n  ')}`);
    },
  };
}

/** Runs body(s) inside a session and always cleans up; console/page errors fail the test. */
export async function withSession(t, opts, body) {
  if (typeof opts === 'function') { body = opts; opts = {}; }
  const s = await session(t, opts);
  let failed = false;
  try {
    await body(s);
  } catch (error) {
    failed = true;
    await s.done(true).catch(() => {});
    throw error;
  }
  await s.done(false);
}

export async function login(page, who = 'admin', password = DEMO_PASSWORD) {
  await page.goto(`${APP}/login`);
  await page.fill('#email', ACCOUNTS[who] ?? who);
  await page.fill('#password', password);
  await page.click('button[type=submit]');
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await page.waitForLoadState('networkidle').catch(() => {});
}

/** Talks to the API directly (to check what the UI really stored, or to prepare data). */
export async function api(method, route, body, token) {
  const res = await fetch(`${API}/${route.replace(/^\//, '')}`, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, body: data };
}

const tokens = new Map();
export async function tokenFor(who) {
  if (!tokens.has(who)) {
    const r = await api('POST', 'auth/login', { email: ACCOUNTS[who] ?? who, password: DEMO_PASSWORD });
    if (r.status !== 200) throw new Error(`login ${who} failed: ${r.status}`);
    tokens.set(who, r.body.token);
  }
  return tokens.get(who);
}

/** Picks an option of a Radix <Select> found by its accessible name. */
export async function choose(page, comboboxName, optionName) {
  await page.getByRole('combobox', { name: comboboxName }).click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
  // wait until the list has closed so the next click is not swallowed by its closing overlay
  await page.getByRole('listbox').waitFor({ state: 'detached' });
}

export const toast = (page, text) => page.locator('[data-sonner-toast]').filter({ hasText: text }).first();
export const unique = (prefix) => `${prefix} ${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
/** A valid, unused Egyptian mobile number. */
export const phone = () => `015${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
