# Testing Your Mentor

Everything runs locally; nothing touches your MySQL database or `.env` files.

## One command (VS Code: Terminal > Run Task > "Your Mentor: Full Verification")

```bash
cd mentorsfront
npm run verify:full
```

Runs, in order, and prints a PASS/FAIL table (also saved to `test-results/verify-summary.md`):

1. backend syntax check, unit tests, API integration tests on the production table layout and on a fresh schema
2. frontend TypeScript, ESLint, unit tests, production build (into `test-results/build-check`, your `dist/` is untouched)
3. browser end-to-end tests + the interaction audit

Exit code is non-zero if anything fails.

## One-time setup for the browser tests

```bash
cd mentorsfront
npm install
npm install --no-save playwright && npx playwright install chromium
```

(`--no-save` keeps `package.json` / the lockfile unchanged.) The backend must be next to this folder
(`../yourmentorsapp`, or set `BACKEND_DIR`) with its `npm install` done.

## Individual commands (in `mentorsfront`)

| Command | |
|---|---|
| `npm run typecheck` | TypeScript, no output files |
| `npm run lint` | ESLint |
| `npm run test:unit` | unit tests of the pure logic (phone rules, requirements, passwords, roles...) - Node 22.18+ |
| `npm run test:e2e` | browser tests: real UI, real backend, real HTTP - no mocked responses |
| `npm run test:audit` | clicks every visible control on every page as admin, team leader and agent |
| `npm run test:e2e:all` | both of the above |
| `npm run test:all` / `verify` | everything for the frontend |

`npm run test:e2e -- leads` runs only the files whose name contains `leads`. `HEADED=1` shows the browser.
`KEEP_TRACES=1` keeps a Playwright trace for every test (otherwise only for failures).

## How the browser tests run

`e2e/run.mjs` picks free ports (it never stops a process that already uses 4011 / 4173), builds the frontend with the
API address of the test backend, starts the real backend in demo mode (in-memory database, demo company with every
role) and a static web server, runs `e2e/tests/*.test.mjs`, then shuts both down.

## Results (`test-results/`, git-ignored)

| Path | |
|---|---|
| `e2e/screenshots/` | screenshots of every responsive page and of every failure |
| `e2e/traces/*.zip` | Playwright traces of failures - open with `npx playwright show-trace <file>` |
| `e2e/console-errors.log` | browser console / page errors and 5xx answers (any of these fails the test) |
| `e2e/junit.xml` | machine-readable results |
| `audit/coverage.md` | **button coverage map**: every control per role and page with what it did |
| `audit/coverage.json` | the same as data |
| `backend.log` | log of the test backend |

A control that does nothing observable (no navigation, dialog, request, download, message or state change) is reported
as **NO VISIBLE EFFECT** and fails the audit - that is how fake buttons are caught.
