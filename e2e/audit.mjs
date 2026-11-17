// Interaction audit: signs in as each role, opens every page, clicks every visible control once and records what
// observably happened (navigation, dialog, request to the API, download, toast, state change...). Controls with NO
// observable effect are reported - that is how fake / dead buttons are found. Writes:
//   test-results/audit/coverage.json   every control with its outcome
//   test-results/audit/coverage.md     the coverage map (per page and per outcome) + the problems list
// Exit code 1 when a control had no effect, the page threw, or the server answered 5xx.
import fs from 'node:fs';
import path from 'node:path';
import { RESULTS } from './support/stack.mjs';
import { APP, API, browser, closeBrowser, login } from './support/browser.mjs';

const OUT = path.join(RESULTS, 'audit');
const ROLES = {
  admin: ['/dashboard', '/developers', '/developers/1', '/deals', '/leads', '/leads/1', '/cold-calls', '/call-history', '/number-pool', '/reports', '/agent-care', '/profile',
    '/admin/users', '/admin/departments', '/admin/jobtitles', '/admin/brokers', '/admin/titles', '/admin/statuses', '/admin/sources',
    '/admin/projects', '/admin/destinations', '/admin/property-types', '/admin/assign', '/admin/upload-data'],
  team_leader: ['/dashboard', '/leads', '/cold-calls', '/call-history', '/number-pool', '/deals', '/admin/assign'],
  agent: ['/dashboard', '/deals', '/leads', '/cold-calls', '/call-history', '/number-pool', '/reports', '/agent-care', '/profile'],
};
const LOGIN = { admin: 'admin', team_leader: 'leader', agent: 'agent' };
const SELECTOR = 'main button, main a[href], main [role=combobox], main [role=checkbox], main [role=tab], main [role=switch], main input[type=file]';

const results = [];
const problems = [];

async function mark(page) {
  return page.evaluate((selector) => {
    const visible = (el) => {
      const s = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return s.visibility !== 'hidden' && s.display !== 'none' && b.width > 0 && b.height > 0;
    };
    const all = [...document.querySelectorAll(selector)].filter((el) => visible(el) || el.matches('input[type=file]'));
    let n = 0;
    for (const el of all) {
      // controls repeated on every table row are exercised on the first row only
      const row = el.closest('tbody tr');
      if (row && row.parentElement && row !== row.parentElement.querySelector('tr')) continue;
      el.setAttribute('data-audit', String(n));
      n += 1;
    }
    return n;
  }, SELECTOR);
}

async function snapshot(page) {
  return page.evaluate(() => ({
    url: location.pathname + location.search,
    overlays: document.querySelectorAll('[role=dialog],[role=alertdialog],[role=listbox],[role=menu]').length,
    toasts: [...document.querySelectorAll('[data-sonner-toast]')].map((t) => t.textContent?.trim() ?? ''),
    state: [...document.querySelectorAll('main [aria-pressed],main [aria-selected],main [aria-checked],main [data-state],main [aria-expanded]')]
      .map((e) => `${e.getAttribute('aria-pressed')}${e.getAttribute('aria-selected')}${e.getAttribute('aria-checked')}${e.getAttribute('data-state')}${e.getAttribute('aria-expanded')}`).join('|'),
    text: document.querySelector('main')?.innerText.length ?? 0,
  }));
}

async function auditRoute(page, role, route) {
  await page.goto(`${APP}${route}`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(250);
  const total = await mark(page);
  for (let i = 0; i < total; i += 1) {
    if (new URL(page.url()).pathname !== route) {
      await page.goto(`${APP}${route}`);
      await page.waitForLoadState('networkidle').catch(() => {});
    }
    await mark(page);
    const el = page.locator(`[data-audit="${i}"]`).first();
    if (!(await el.count())) continue;
    const info = await el.evaluate((e) => ({
      label: (e.getAttribute('aria-label') || e.innerText || e.getAttribute('title') || e.getAttribute('placeholder') || e.getAttribute('role') || e.tagName).trim().replace(/\s+/g, ' ').slice(0, 60),
      kind: e.getAttribute('role') || (e.tagName === 'A' ? 'link' : e.tagName === 'INPUT' ? 'file input' : 'button'),
      href: e.getAttribute('href'),
      disabled: e.disabled || e.getAttribute('aria-disabled') === 'true',
      active: e.getAttribute('aria-selected') === 'true' || e.getAttribute('aria-pressed') === 'true',
    })).catch(() => null);
    if (!info) continue;
    const record = { role, route, control: info.label, kind: info.kind, outcome: '' };
    if (info.disabled) { record.outcome = 'disabled (explained by its state, e.g. no phone number / nothing selected)'; results.push(record); continue; }
    if (info.href && /^(tel:|mailto:|https?:)/.test(info.href)) { record.outcome = `external link ${info.href.split('?')[0].slice(0, 40)}`; results.push(record); continue; }
    if (info.kind === 'file input') { record.outcome = 'file picker (input type=file)'; results.push(record); continue; }

    const before = await snapshot(page);
    const requests = [];
    const onRequest = (r) => { if (r.url().startsWith(API)) requests.push(`${r.method()} ${new URL(r.url()).pathname.replace(/^\/api/, '')}`); };
    page.on('request', onRequest);
    let download = null;
    let chooser = false;
    const onDownload = (d) => { download = d.suggestedFilename(); };
    const onChooser = () => { chooser = true; };
    page.on('download', onDownload);
    page.on('filechooser', onChooser);
    try {
      await el.click({ timeout: 3000 });
    } catch (error) {
      record.outcome = `could not click: ${error.message.split('\n')[0]}`;
    }
    await page.waitForTimeout(450);
    page.off('request', onRequest);
    page.off('download', onDownload);
    page.off('filechooser', onChooser);
    if (!record.outcome) {
      const after = await snapshot(page);
      // a toast counts as new even if an identical one is still on screen (e.g. the same "Nothing to export" twice)
      const remaining = [...before.toasts];
      const newToasts = after.toasts.filter((x) => { const i = remaining.indexOf(x); if (i < 0) return true; remaining.splice(i, 1); return false; });
      const effects = [];
      if (after.url !== before.url) effects.push(`navigates to ${after.url}`);
      if (after.overlays > before.overlays) effects.push('opens a dialog / list');
      if (download) effects.push(`downloads ${download}`);
      if (chooser) effects.push('opens the file picker');
      if (requests.length) effects.push(`API ${[...new Set(requests)].join(', ')}`);
      if (newToasts.length) effects.push(`message "${newToasts[0].slice(0, 70)}"`);
      if (!effects.length && (after.state !== before.state || after.text !== before.text)) effects.push('updates the view');
      if (!effects.length && info.active) effects.push('already active (selected tab / filter)');
      record.outcome = effects.join('; ') || 'NO VISIBLE EFFECT';
    }
    results.push(record);
    for (let k = 0; k < 3; k += 1) await page.keyboard.press('Escape');
    // wait for closing dialogs / lists to finish their exit animation so the next control starts from a clean page
    await page.waitForFunction(() => !document.querySelector('[role=dialog],[role=alertdialog],[role=listbox],[role=menu]'), null, { timeout: 3000 }).catch(() => {});
  }
}

export async function runAudit() {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await browser();
  for (const [role, routes] of Object.entries(ROLES)) {
    const context = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
    await context.route(/^https?:\/\/(?!127\.0\.0\.1|localhost)/, (r) => r.abort());
    const page = await context.newPage();
    page.on('pageerror', (e) => problems.push(`${role} ${page.url()}: page error ${e.message}`));
    page.on('response', (r) => { if (r.url().startsWith(API) && r.status() >= 500) problems.push(`${role} ${page.url()}: server error ${r.status()} ${r.url()}`); });
    page.on('dialog', (d) => { problems.push(`${role} ${page.url()}: native browser dialog "${d.message()}"`); void d.dismiss(); });
    await login(page, LOGIN[role]);
    for (const route of routes) {
      await auditRoute(page, role, route);
      await page.screenshot({ path: path.join(OUT, `${role}${route.replace(/\//g, '_')}.png`), fullPage: true });
    }
    await context.close();
  }
  const dead = results.filter((r) => r.outcome === 'NO VISIBLE EFFECT' || r.outcome.startsWith('could not click'));
  const categories = {};
  for (const r of results) {
    const key = r.outcome.startsWith('API') || r.outcome.includes('; API') ? 'calls the API'
      : r.outcome.startsWith('navigates') ? 'navigates'
      : r.outcome.startsWith('opens') ? 'opens dialog / list / picker'
      : r.outcome.startsWith('downloads') ? 'downloads a file'
      : r.outcome.startsWith('message') ? 'shows a message'
      : r.outcome.startsWith('updates') ? 'updates the view'
      : r.outcome.startsWith('external') ? 'external link (tel / WhatsApp / mail / web)'
      : r.outcome.startsWith('disabled') ? 'disabled' : r.outcome.startsWith('already') ? 'already active'
      : r.outcome.startsWith('file picker') ? 'file picker' : 'NO EFFECT / not clickable';
    categories[key] = (categories[key] ?? 0) + 1;
  }
  const summary = { generatedAt: new Date().toISOString(), controls: results.length, deadControls: dead.length, problems, categories };
  fs.writeFileSync(path.join(OUT, 'coverage.json'), JSON.stringify({ summary, results }, null, 2));
  const md = [
    '# Interaction audit - coverage map', '',
    `Generated ${summary.generatedAt}. Every visible control on every page was clicked once per role (controls repeated on`,
    'each table row were exercised on the first row). Real backend (in-memory demo data), real production build.', '',
    `- Controls exercised: **${results.length}**`, `- Controls with no observable effect: **${dead.length}**`, `- Page errors / 5xx / native dialogs: **${problems.length}**`, '',
    '## By outcome', '', '| Outcome | Controls |', '|---|---|', ...Object.entries(categories).sort((a, b) => b[1] - a[1]).map(([k, v]) => `| ${k} | ${v} |`), '',
    '## By page', '', '| Role | Page | Controls | No effect |', '|---|---|---|---|',
    ...Object.entries(ROLES).flatMap(([role, routes]) => routes.map((route) => {
      const rs = results.filter((r) => r.role === role && r.route === route);
      return `| ${role} | ${route} | ${rs.length} | ${rs.filter((r) => dead.includes(r)).length} |`;
    })), '',
    '## Problems', '', ...(dead.length || problems.length ? [...dead.map((r) => `- ${r.role} ${r.route} "${r.control}" (${r.kind}): ${r.outcome}`), ...problems.map((p) => `- ${p}`)] : ['None.']), '',
    '## Every control', '', '| Role | Page | Control | Kind | Outcome |', '|---|---|---|---|---|',
    ...results.map((r) => `| ${r.role} | ${r.route} | ${r.control.replace(/\|/g, '/')} | ${r.kind} | ${r.outcome.replace(/\|/g, '/')} |`),
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'coverage.md'), `${md}\n`);
  console.log(`audit: ${results.length} controls, ${dead.length} without effect, ${problems.length} problems -> test-results/audit/coverage.md`);
  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const summary = await runAudit().finally(closeBrowser);
  process.exit(summary.deadControls || summary.problems.length ? 1 : 0);
}
