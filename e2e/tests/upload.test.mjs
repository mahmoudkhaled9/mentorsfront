import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { APP, api, closeBrowser, login, phone, toast, tokenFor, unique, withSession } from '../support/browser.mjs';

// Real files, made with the same libraries the app uses (SheetJS, jsPDF), uploaded through the real page.
const require = createRequire(path.join(process.cwd(), 'package.json'));
const XLSX = require('xlsx');
const { jsPDF } = require('jspdf');
let admin;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ym-upload-'));
before(async () => { admin = await tokenFor('admin'); });
after(async () => { await closeBrowser(); fs.rmSync(dir, { recursive: true, force: true }); });

test('Upload Data: an Excel file of leads is imported, shows up after a refresh, and a second upload skips the duplicates', async (t) => {
  const rows = [{ name: unique('Upload A'), phone: phone() }, { name: unique('Upload B'), phone: phone() }];
  const file = path.join(dir, 'leads.xlsx');
  const sheet = XLSX.utils.aoa_to_sheet([['Name', 'Phone'], ...rows.map((r) => [r.name, r.phone])]);
  for (const key of Object.keys(sheet)) if (sheet[key]?.t === 'n') sheet[key] = { t: 's', v: String(sheet[key].v) };
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Leads');
  XLSX.writeFile(book, file);

  await withSession(t, async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`${APP}/admin/upload-data`); // this page is loaded on demand (code splitting): it must still open
    await page.locator('#upload-data-file').setInputFiles(file);
    await page.getByText('leads.xlsx').waitFor();
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    await toast(page, 'Imported 2 record(s).').waitFor();

    const all = (await api('GET', 'leads', null, admin)).body;
    for (const r of rows) assert.ok(all.some((l) => l.name === r.name && l.phone === r.phone), `${r.name} imported`);

    await page.goto(`${APP}/leads`);
    await page.reload();
    for (const r of rows) {
      await page.getByPlaceholder(/Search name, phone/).fill(r.name);
      await page.getByRole('link', { name: r.name, exact: true }).waitFor();
    }

    await page.goto(`${APP}/admin/upload-data`);
    await page.locator('#upload-data-file').setInputFiles(file);
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    await toast(page, 'Nothing was imported').waitFor();
    const again = (await api('GET', 'leads', null, admin)).body.filter((l) => rows.some((r) => r.phone === l.phone));
    assert.equal(again.length, 2, 'no duplicates were created');
  });
});

test('Upload Data: phone numbers are read out of a PDF into Cold Calls', async (t) => {
  const numbers = [phone(), phone(), phone()];
  const file = path.join(dir, 'numbers.pdf');
  const doc = new jsPDF();
  doc.text('Prospects list', 20, 20);
  numbers.forEach((n, i) => doc.text(`Contact ${i + 1}: ${n}`, 20, 40 + i * 12));
  fs.writeFileSync(file, Buffer.from(doc.output('arraybuffer')));

  await withSession(t, async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`${APP}/admin/upload-data`);
    await page.getByRole('combobox').filter({ hasText: 'Leads' }).click();
    await page.getByRole('option', { name: 'Cold Calls', exact: true }).click();
    await page.getByRole('listbox').waitFor({ state: 'detached' });
    await page.locator('#upload-data-file').setInputFiles(file);
    await page.getByRole('button', { name: 'Upload', exact: true }).click();
    await toast(page, 'Imported 3 record(s).').waitFor();
    const cold = (await api('GET', 'cold-calls', null, admin)).body;
    for (const n of numbers) assert.ok(cold.some((c) => c.phone === n), `${n} imported from the PDF`);
  });
});
