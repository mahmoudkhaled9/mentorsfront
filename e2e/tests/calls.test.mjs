import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { APP, API, api, choose, closeBrowser, login, phone, toast, tokenFor, unique, withSession } from '../support/browser.mjs';

let admin;
let agent;
let statuses;
before(async () => {
  admin = await tokenFor('admin');
  agent = await tokenFor('agent');
  statuses = (await api('GET', 'statuses', null, admin)).body;
});
after(closeBrowser);

test('Call Action: outcome + notes; requirements shown read-only from the lead (no duplicate fields); save; Call History; details', async (t) => {
  // a fresh lead of the agent's own: the demo data already has calls on some leads, and this test counts calls
  const createdLead = await api('POST', 'leads', { name: unique('Call Lead'), phone: phone(), statusId: statuses[0].id }, agent);
  assert.equal(createdLead.status, 200, JSON.stringify(createdLead.body));
  const own = createdLead.body.item;
  // set the lead's requirements the only way that exists: Edit Lead (PUT /leads/:id)
  await api('PUT', `leads/${own.id}`, { requirements: { ...own.requirements, delivery: 'within_3_years', finishing: 'core_and_shell', purpose: 'investment' } }, agent);
  const outcome = statuses[2];
  await withSession(t, async ({ page, shot }) => {
    await login(page, 'agent');
    await page.goto(`${APP}/leads`);
    await page.getByRole('link', { name: own.name, exact: true }).click();
    await page.waitForURL(`**/leads/${own.id}`);
    await page.getByRole('button', { name: 'Log call', exact: true }).click();
    const dialog = page.getByTestId('call-action');
    await dialog.waitFor();

    // the three requirements: shown from the lead, NOT editable here
    const req = dialog.getByTestId('call-lead-requirements');
    await req.getByTestId('req-delivery').getByText('3 Years').waitFor();
    await req.getByTestId('req-finishing').getByText('Core & Shell').waitFor();
    await req.getByTestId('req-purpose').getByText('Investment').waitFor();
    for (const name of ['Delivery', 'Finishing', 'Purpose of purchase']) assert.equal(await dialog.getByRole('combobox', { name }).count(), 0, `${name} is not an editable field in the call`);

    // Cancel does nothing
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await dialog.waitFor({ state: 'detached' });
    assert.equal((await api('GET', `call-actions?leadId=${own.id}`, null, agent)).body.length, 0);

    await page.getByRole('button', { name: 'Log call', exact: true }).click();
    // required outcome; its options are the CRM statuses
    await dialog.getByRole('button', { name: 'Save call' }).click();
    await dialog.getByText('Choose the call outcome').waitFor();
    await page.getByRole('combobox', { name: 'Call outcome' }).click();
    assert.deepEqual((await page.getByRole('option').allInnerTexts()).map((s) => s.trim()), statuses.map((s) => s.name));
    await page.keyboard.press('Escape');
    await page.getByRole('listbox').waitFor({ state: 'detached' });
    await choose(page, 'Call outcome', outcome.name);
    assert.equal(await page.getByRole('combobox', { name: 'Call outcome' }).innerText(), outcome.name);
    await page.fill('#ca-notes', 'E2E: client wants a 3 bedroom unit');
    await shot('call-action-filled');
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/leads/${own.id}/call-actions`) && r.request().method() === 'POST'),
      dialog.getByRole('button', { name: 'Save call' }).click(),
    ]);
    assert.equal(response.status(), 201);
    const saved = (await response.json()).item;
    assert.deepEqual([saved.leadId, saved.statusId, saved.notes], [own.id, outcome.id, 'E2E: client wants a 3 bedroom unit']);
    await toast(page, 'Call saved').waitFor();
    const details = dialog.getByTestId('call-details');
    for (const text of [`#${saved.id}`, outcome.name, 'E2E: client wants a 3 bedroom unit', '3 Years / Core & Shell / Investment']) await details.getByText(text, { exact: false }).first().waitFor();
    await shot('call-saved');
    await dialog.getByRole('button', { name: 'Done' }).click();

    // lead page updates, also after a refresh
    for (let i = 0; i < 2; i += 1) {
      await page.getByTestId('lead-call-history').getByRole('cell', { name: 'E2E: client wants a 3 bedroom unit' }).waitFor();
      await page.getByTestId('activity-timeline').getByText(`Call #${saved.id}`).waitFor();
      if (i === 0) await page.reload();
    }
    // Call History page: the call is listed, its details open
    await page.goto(`${APP}/call-history`);
    const row = page.getByRole('row').filter({ hasText: 'E2E: client wants a 3 bedroom unit' });
    await row.getByRole('cell', { name: outcome.name }).waitFor();
    await row.getByRole('link', { name: own.name }).waitFor();
    await row.getByRole('button', { name: `View call ${saved.id}` }).click();
    const view = page.getByRole('dialog').getByTestId('call-details');
    for (const text of ['Amira Agent', outcome.name, 'E2E: client wants a 3 bedroom unit', '3 Years / Core & Shell / Investment']) await view.getByText(text, { exact: false }).first().waitFor();
  });
  const stored = (await api('GET', `call-actions?leadId=${own.id}`, null, agent)).body;
  assert.equal(stored.length, 1);
  assert.deepEqual([stored[0].status_id ?? stored[0].statusId, stored[0].userName], [outcome.id, 'Amira Agent']);
  assert.equal((await api('GET', `leads/${own.id}`, null, agent)).body.statusId, outcome.id, 'the lead status is the outcome');
});

test('"Edit lead requirements" from the Call Action opens Edit Lead; the call then shows the new saved values', async (t) => {
  const lead = (await api('GET', 'leads', null, agent)).body[2];
  await withSession(t, async ({ page }) => {
    await login(page, 'agent');
    await page.goto(`${APP}/leads`);
    await page.getByRole('button', { name: `Log call with ${lead.name}` }).click();
    const dialog = page.getByTestId('call-action');
    await dialog.getByRole('button', { name: 'Edit lead requirements' }).click();
    await page.getByRole('heading', { name: `Edit Lead #${lead.id}` }).waitFor();
    await choose(page, 'Delivery', '4 Years');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await toast(page, 'Lead updated').waitFor();
    await dialog.getByTestId('req-delivery').getByText('4 Years').waitFor();
  });
  assert.equal((await api('GET', `leads/${lead.id}`, null, agent)).body.requirements.delivery, 'within_4_years');
});

test('a failed save shows the real error and keeps the form; a double-clicked retry saves exactly once', async (t) => {
  const name = unique('Retry Lead');
  const leadId = (await api('POST', 'leads', { name, phone: phone(), statusId: 1 }, admin)).body.id;
  await withSession(t, { allowErrors: [/500|Failed to load|ERR_FAILED/], expectServerErrors: true }, async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`${APP}/leads`);
    await page.getByLabel('Search leads').fill(name);
    let mode = 'down';
    await page.route(`${API}/leads/${leadId}/call-actions`, async (route) => {
      if (mode === 'down') { mode = '500'; return route.abort('connectionrefused'); } // backend unreachable (stopped / restarting)
      if (mode === '500') { mode = 'ok'; return route.fulfill({ status: 500, json: { error: 'The database rejected the write', code: 'DB_ERROR' } }); }
      return route.continue();
    });
    await page.getByRole('button', { name: `Log call with ${name}` }).click();
    await choose(page, 'Call outcome', statuses[1].name);
    await page.fill('#ca-notes', 'retry me');
    await page.getByRole('button', { name: 'Save call' }).click();
    await toast(page, 'The call was NOT saved: Cannot reach the server').waitFor();
    await page.getByRole('button', { name: 'Save call' }).click();
    await toast(page, 'The call was NOT saved: The database rejected the write').waitFor();
    assert.equal(await page.getByText('Call saved').count(), 0, 'no false success');
    assert.equal(await page.inputValue('#ca-notes'), 'retry me', 'what was typed is kept');
    await page.getByRole('button', { name: 'Save call' }).dblclick();
    await toast(page, 'Call saved').waitFor();
  });
  assert.equal((await api('GET', `call-actions?leadId=${leadId}`, null, admin)).body.length, 1, 'exactly one call stored');
});

test('cold calls use the same Call Action (outcome + notes) and show it in their history', async (t) => {
  const name = unique('Cold Action');
  await api('POST', 'cold-calls', { name, phone: phone() }, admin);
  await withSession(t, async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`${APP}/cold-calls`);
    await page.getByLabel('Search cold calls').fill(name);
    await page.getByRole('button', { name: `Log call with ${name}` }).click();
    const dialog = page.getByTestId('call-action');
    assert.equal(await dialog.getByTestId('call-lead-requirements').count(), 0, 'cold calls have no lead requirements');
    await choose(page, 'Call outcome', statuses[1].name);
    await page.fill('#ca-notes', 'cold call note');
    await dialog.getByRole('button', { name: 'Save call' }).click();
    await toast(page, 'Call saved').waitFor();
    await dialog.getByRole('button', { name: 'Done' }).click();
    await page.getByRole('button', { name: `History of ${name}` }).click();
    await page.getByTestId('activity-timeline').getByText('cold call note').waitFor();
  });
});

test('another team cannot open a lead by typing its address', async (t) => {
  const foreign = (await api('GET', 'leads', null, await tokenFor('agent3'))).body[0];
  await withSession(t, { allowErrors: [/404/] }, async ({ page }) => {
    await login(page, 'agent');
    await page.goto(`${APP}/leads/${foreign.id}`);
    await page.getByRole('alert').filter({ hasText: /Could not load this lead: Lead not found/ }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Log call' }).count(), 0);
  });
});
