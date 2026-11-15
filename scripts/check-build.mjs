// Checks a production build. Usage: node scripts/check-build.mjs [outDir]   (default: dist). Exit 0 = all good.
// Guards against regressions that do not fail `vite build`: heavy libraries pulled into the startup bundle, relative asset
// paths (white page when a nested route is refreshed) and a missing .mjs MIME rule (the PDF import worker would not load).
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const production = args.includes('--production'); // release builds: no local API address may be compiled in
const dist = path.resolve(args.find((a) => !a.startsWith('--')) ?? 'dist');
const problems = [];
const ok = (m) => console.log(`  ok      ${m}`);
const bad = (m) => { problems.push(m); console.log(`  PROBLEM ${m}`); };

const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
for (const f of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', '.htaccess']) {
  if (fs.existsSync(path.join(dist, f))) ok(`${f} present`); else bad(`${f} missing`);
}
const htaccess = fs.existsSync(path.join(dist, '.htaccess')) ? fs.readFileSync(path.join(dist, '.htaccess'), 'utf8') : '';
if (/AddType\s+text\/javascript\s+\.mjs/.test(htaccess)) ok('.htaccess serves .mjs as JavaScript (PDF import worker)');
else bad('.htaccess lacks "AddType text/javascript .mjs"');
if (/FallbackResource|RewriteRule\s+\.\s+\/index\.html|RewriteRule\s+\^.*index\.html/.test(htaccess)) ok('.htaccess has an SPA fallback to index.html');
else bad('.htaccess has no SPA fallback (refreshing /leads/1 would 404)');

if (/X-Frame-Options|frame-ancestors/.test(htaccess)) ok('.htaccess forbids framing (clickjacking)');
else bad('.htaccess does not forbid framing');
const csp = (html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) ?? [])[1];
if (csp && /script-src 'self'(;|$)/.test(csp) && !/unsafe-eval/.test(csp)) ok(`index.html has a Content-Security-Policy (${csp.match(/connect-src [^;]+/)?.[0]})`);
else bad('index.html has no strict Content-Security-Policy');

if (production) {
  const local = /(localhost|127\.0\.0\.1|\[::1\])/;
  const js = fs.readdirSync(path.join(dist, 'assets')).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(dist, 'assets', f), 'utf8')).join('\n');
  const apiMatch = js.match(/https?:\/\/[^"'`\s]+\/api\b/);
  if (csp && local.test(csp)) bad('production build: the Content-Security-Policy allows a local address');
  else if (apiMatch && local.test(apiMatch[0])) bad(`production build calls a local API: ${apiMatch[0]}`);
  else if (csp && !/connect-src 'self' https:\/\//.test(csp) && !/connect-src 'self'(;|$)/.test(csp)) bad('production build: the API is not HTTPS');
  else ok('production build: HTTPS API, no local addresses');
}

const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
const relative = refs.filter((r) => !r.startsWith('/') && !/^https?:/.test(r));
if (relative.length) bad(`relative references in index.html: ${relative.join(', ')}`);
else ok('every index.html reference is absolute (nested routes can be refreshed)');

// Startup = index.html's scripts/preloads plus everything those chunks import statically (transitively).
const assetsDir = path.join(dist, 'assets');
const read = (f) => fs.readFileSync(path.join(assetsDir, f), 'utf8');
const startup = new Set();
const queue = refs.filter((r) => /\/assets\/[^/]+\.js$/.test(r)).map((r) => path.basename(r));
while (queue.length) {
  const f = queue.pop();
  if (startup.has(f) || !fs.existsSync(path.join(assetsDir, f))) continue;
  startup.add(f);
  for (const m of read(f).matchAll(/(?:from|import)\s*["']\.\/([\w.-]+\.js)["']/g)) queue.push(m[1]);
}
const HEAVY = /^(pdfjs|jspdf|pdf|xlsx|charts)-/;
const heavy = [...startup].filter((f) => HEAVY.test(f));
if (heavy.length) bad(`startup loads ${heavy.join(', ')} (must load on demand)`);
else ok(`startup loads ${startup.size} JS files, none of them PDF / Excel / charts`);

const sizes = fs.readdirSync(assetsDir).filter((f) => !f.startsWith('._'))
  .map((f) => ({ f, kb: Math.round(fs.statSync(path.join(assetsDir, f)).size / 1024) })).sort((a, b) => b.kb - a.kb);
const css = sizes.filter((a) => a.f.endsWith('.css') && html.includes(a.f));
const startupKb = sizes.filter((a) => startup.has(a.f)).reduce((s, a) => s + a.kb, 0) + css.reduce((s, a) => s + a.kb, 0);
console.log(`  assets: ${sizes.map((a) => `${a.f} ${a.kb} kB`).join(', ')}`);
console.log(`  startup JS: ${[...startup].join(', ')}`);
console.log(`  loaded at startup (uncompressed JS + CSS): ${startupKb} kB`);
console.log(problems.length ? `BUILD CHECK: ${problems.length} problem(s)` : 'BUILD CHECK: ok');
process.exit(problems.length ? 1 : 0);
