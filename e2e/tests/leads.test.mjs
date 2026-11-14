import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { APP, api, choose, closeBrowser, login, phone, tokenFor, toast, unique, withSession } from '../support/browser.mjs';

const XLSX = createRequire(import.meta.url)('xlsx');
let admin;
let options;
before(async () => {
  admin = await tokenFor('admin');
  options = (await api('GET', 'lead-options', null, admin)).body;
});
after(closeBrowser);

const findLead = async (name, token = admin) => (await api('GET', 'leads', null, token)).body.find((l) => l.name === name);

test('add a lead with client requirements through the form; invalid phone is refused first', async (t) => {
  const name = unique('E2E Client');
  const northCoast = options.destinations.find((d) => d.name === 'North Coast');
  const duplex = options.propertyTypes.find((p) => p.name === 'Duplex');
  await withSession(t, async ({ page, shot }) => {
    await login(page, 'admin');
    await page.goto(`${APP}/leads`);
    await page.getByRole('button', { name: 'Add Lead' }).click();
    await page.fill('#lead-name', name);
    await page.fill('#lead-phone', '0201234');
    await page.getByTestId(`lead-req-destinationIds-${northCoast.id}`).click();
    await page.getByTestId(`lead-req-propertyTypeIds-${duplex.id}`).click();
    await page.fill('#lead-req-budgetMin', '6,000,000');
    await page.fill('#lead-req-budgetMax', '4,000,000');
    await page.getByRole('button', { name: 'Save Lead' }).click();
    await page.getByText(/Egyptian mobile/).first().waitFor();
    await page.getByText('Maximum budget must be at least the minimum budget').waitFor();
    assert.equal(await findLead(name), undefined, 'nothing may be saved while the form is invalid');

    await page.fill('#lead-phone', phone());
    await page.fill('#lead-req-budgetMax', '9,000,000');
    await page.fill('#lead-req-downPayment', '900000');
    await choose(page, 'Purpose of purchase', 'Investment');
    await choose(page, 'Delivery', 'RTM');
    await choose(page, 'Finishing', 'Fully Finished');
    await shot('lead-form-filled');
    await page.getByRole('button', { name: 'Save Lead' }).click();
    await toast(page, 'Lead added').waitFor();
  });
  const stored = await findLead(name);
  assert.ok(stored, 'lead stored on the server');
  assert.deepEqual(stored.requirements.destinationIds, [northCoast.id]);
  assert.deepEqual(stored.requirements.propertyTypeIds, [duplex.id]);
  assert.equal(stored.requirements.budgetMin, 6000000);
  assert.equal(stored.requirements.budgetMax, 9000000);
  assert.equal(stored.requirements.downPayment, 900000);
  assert.equal(stored.requirements.purpose, 'investment');
  assert.equal(stored.requirements.delivery, 'ready_to_move');
  assert.equal(stored.requirements.finishing, 'fully_finished');
});

test('requirement filters, search and the requirements column use the stored data', async (t) => {
  const name = unique('Filter Client');
  const sokhna = options.destinations.find((d) => d.name === 'Ain Sokhna');
  const created = await api('POST', 'leads', { name, phone: phone(), statusId: 1, requirements: { destinationIds: [sokhna.id], budgetMin: 3000000, budgetMax: 5000000, purpose: 'end_user' } }, admin);
  assert.equal(created.status, 200);
  await withSession(t, async ({ page, shot }) => {
    await login(page, 'admin');
    await page.goto(`${APP}/leads`);
    await page.getByRole('button', { name: 'Filters' }).click();
    await choose(page, 'Filter by destination', 'Ain Sokhna');
    await choose(page, 'Filter by purpose', 'End User');
    await page.fill('#leads-budget', '4,000,000');
    await page.getByRole('cell', { name, exact: true }).waitFor();
    await page.getByText(/Ain Sokhna · .*3,000,000 EGP – 5,000,000 EGP · End User/).first().waitFor();
    // a budget outside the client's range hides the lead
    await page.fill('#leads-budget', '7,000,000');
    await page.getByRole('cell', { name, exact: true }).waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Clear all filters' }).click();
    await page.getByLabel('Search leads').fill(name);
    await page.getByRole('cell', { name, exact: true }).waitFor();
    assert.equal(await page.getByTestId('leads-count').innerText(), '1');
    await shot('filtered');
  });
});

test('editing a status requires a comment; the comment lands in the lead history', async (t) => {
  const name = unique('Edit Client');
  await api('POST', 'leads', { name, phone: phone(), statusId: 1 }, admin);
  const statuses = (await api('GET', 'statuses', null, admin)).body;
  const target = statuses[2];
  await withSession(t, async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`${APP}/leads`);
    await page.getByLabel('Search leads').fill(name);
    await page.getByRole('button', { name: `Edit ${name}` }).click();
    await choose(page, 'Status', target.name);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await page.getByText('Add a comment explaining the status / project change').waitFor();
    await page.fill('#lead-comment', 'Client asked for a site visit');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await toast(page, 'Lead updated').waitFor();
    await page.getByRole('button', { name: `Comments of ${name}` }).click();
    await page.getByRole('dialog').getByText('Client asked for a site visit').waitFor();
  });
  const stored = await findLead(name);
  assert.equal(stored.statusId, target.id);
  const comments = (await api('GET', 'comments', null, admin)).body.filter((c) => c.entityType === 'lead' && c.entityId === stored.id);
  assert.ok(comments.some((c) => c.content === 'Client asked for a site visit' && c.createdBy === 'Demo Admin'));
});

test('Copy, Excel and PDF export the rows on screen (not placeholders)', async (t) => {
  const name = unique('Export Client');
  await api('POST', 'leads', { name, phone: phone(), statusId: 1 }, admin);
  await withSession(t, async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`${APP}/leads`);
    await page.getByLabel('Search leads').fill(name);
    await page.getByRole('cell', { name, exact: true }).waitFor();

    await page.getByRole('button', { name: 'Copy' }).click();
    await toast(page, 'Copied 1 lead(s)').waitFor();
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    assert.match(clip, /^ID\tName\tPhone/);
    assert.ok(clip.includes(name));

    const [excel] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Excel' }).click()]);
    const xlsxFile = path.join(os.tmpdir(), excel.suggestedFilename());
    await excel.saveAs(xlsxFile);
    const rows = XLSX.utils.sheet_to_json(XLSX.readFile(xlsxFile).Sheets.Leads);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].Name, name);
    fs.rmSync(xlsxFile, { force: true });

    const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'PDF' }).click()]);
    const pdfFile = path.join(os.tmpdir(), pdf.suggestedFilename());
    await pdf.saveAs(pdfFile);
    assert.equal(fs.readFileSync(pdfFile).subarray(0, 4).toString(), '%PDF');
    fs.rmSync(pdfFile, { force: true });
  });
});

test('bulk delete asks for confirmation and removes the leads on the server', async (t) => {
  const names = [unique('Delete A'), unique('Delete B')];
  for (const n of names) await api('POST', 'leads', { name: n, phone: phone(), statusId: 1 }, admin);
  await withSession(t, async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`${APP}/leads`);
    await page.getByLabel('Search leads').fill('Delete ');
    for (const n of names) await page.getByRole('checkbox', { name: `Select ${n}` }).click();
    await page.getByRole('button', { name: 'Delete Selected (2)' }).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.getByText('Delete 2 lead(s)?').waitFor();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    assert.ok(await findLead(names[0]), 'cancel keeps the leads');
    await page.getByRole('button', { name: 'Delete Selected (2)' }).click();
    await dialog.getByRole('button', { name: 'Delete' }).click();
    await toast(page, 'Deleted 2 lead(s)').waitFor();
  });
  for (const n of names) assert.equal(await findLead(n), undefined);
});

test('an agent only sees the leads the server gives them, and the numbers match', async (t) => {
  const agentToken = await tokenFor('agent');
  const own = (await api('GET', 'leads', null, agentToken)).body;
  const all = (await api('GET', 'leads', null, admin)).body;
  assert.ok(own.length > 0 && own.length < all.length, 'demo data: the agent has some but not all leads');
  await withSession(t, async ({ page }) => {
    await login(page, 'agent');
    await page.goto(`${APP}/leads`);
    await page.getByRole('cell', { name: own[0].name, exact: true }).first().waitFor();
    assert.equal(Number(await page.getByTestId('leads-count').innerText()), own.length);
    const foreign = all.find((l) => !own.some((o) => o.id === l.id));
    assert.equal(await page.getByRole('cell', { name: foreign.name, exact: true }).count(), 0);
  });
});
