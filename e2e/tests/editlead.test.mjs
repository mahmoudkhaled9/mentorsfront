import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { APP, API, api, choose, closeBrowser, login, toast, tokenFor, withSession } from '../support/browser.mjs';

let agent;
before(async () => { agent = await tokenFor('agent'); });
after(closeBrowser);

const optionsOf = async (page, name) => {
  await page.getByRole('combobox', { name }).click();
  const list = (await page.getByRole('option').allInnerTexts()).map((s) => s.trim());
  await page.keyboard.press('Escape');
  await page.getByRole('listbox').waitFor({ state: 'detached' });
  return list;
};
const shown = (page, name) => page.getByRole('combobox', { name }).innerText();

test('Edit Lead: Delivery / Finishing / Purpose open, list exactly the business options, change, save, persist after refresh', async (t) => {
  const lead = (await api('GET', 'leads', null, agent)).body[1];
  await withSession(t, async ({ page, shot }) => {
    await login(page, 'agent');
    await page.goto(`${APP}/leads/${lead.id}`);
    await page.getByRole('button', { name: 'Edit lead' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('heading', { name: `Edit Lead #${lead.id}` }).waitFor();

    assert.deepEqual(await optionsOf(page, 'Delivery'), ['RTM', '1 Year', '2 Years', '3 Years', '4 Years']);
    assert.deepEqual(await optionsOf(page, 'Finishing'), ['Core & Shell', 'Semi-Finished', 'Fully Finished']);
    assert.deepEqual(await optionsOf(page, 'Purpose of purchase'), ['End User', 'Investment']);

    // select, verify, change, verify - for each field; the form stays responsive between picks
    await choose(page, 'Delivery', 'RTM');
    assert.equal(await shown(page, 'Delivery'), 'RTM');
    await choose(page, 'Delivery', '2 Years');
    assert.equal(await shown(page, 'Delivery'), '2 Years');
    await choose(page, 'Finishing', 'Core & Shell');
    assert.equal(await shown(page, 'Finishing'), 'Core & Shell');
    await choose(page, 'Finishing', 'Semi-Finished');
    assert.equal(await shown(page, 'Finishing'), 'Semi-Finished');
    await choose(page, 'Purpose of purchase', 'Investment');
    assert.equal(await shown(page, 'Purpose of purchase'), 'Investment');
    await choose(page, 'Purpose of purchase', 'End User');
    assert.equal(await shown(page, 'Purpose of purchase'), 'End User');
    await page.fill('#lead-name', `${lead.name}`); // still typeable: no frozen page
    await shot('edit-lead-selected');

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().endsWith(`/leads/${lead.id}`) && r.request().method() === 'PUT'),
      dialog.getByRole('button', { name: 'Save Changes' }).click(),
    ]);
    assert.equal(response.status(), 200);
    const saved = (await response.json()).item;
    assert.deepEqual([saved.requirements.delivery, saved.requirements.finishing, saved.requirements.purpose], ['within_2_years', 'semi_finished', 'end_user'], 'API response');
    await toast(page, 'Lead updated').waitFor();

    // refresh: the details page and a re-opened Edit Lead show the stored values
    await page.reload();
    const req = page.getByTestId('lead-requirements');
    await req.getByText('2 Years').waitFor();
    await req.getByText('Semi-Finished').waitFor();
    await req.getByText('End User').waitFor();
    await page.getByRole('button', { name: 'Edit lead' }).click();
    await page.getByRole('heading', { name: `Edit Lead #${lead.id}` }).waitFor();
    assert.equal(await shown(page, 'Delivery'), '2 Years');
    assert.equal(await shown(page, 'Finishing'), 'Semi-Finished');
    assert.equal(await shown(page, 'Purpose of purchase'), 'End User');
    // Cancel closes without saving
    await page.getByRole('combobox', { name: 'Delivery' }).click();
    await page.getByRole('option', { name: 'RTM', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
  });
  // the database (read back through the API)
  const stored = (await api('GET', `leads/${lead.id}`, null, agent)).body.requirements;
  assert.deepEqual([stored.delivery, stored.finishing, stored.purpose], ['within_2_years', 'semi_finished', 'end_user'], 'Cancel did not save RTM');
});

test('Edit Lead with an older backend (no option lists): a clear message + Retry instead of an empty dropdown', async (t) => {
  await withSession(t, { allowErrors: [/404|Failed to load/] }, async ({ page }) => {
    await login(page, 'agent');
    let missing = true;
    await page.route(`${API}/lead-options`, (route) => (missing
      ? route.fulfill({ status: 404, contentType: 'text/html', body: '<pre>Cannot GET /api/lead-options</pre>' })
      : route.continue()));
    await page.goto(`${APP}/leads`);
    await page.getByRole('alert').filter({ hasText: 'The server does not offer this feature yet' }).first().waitFor();
    await page.getByRole('button', { name: /^Edit / }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#lead-name').waitFor(); // the form has loaded the lead from the server
    await dialog.getByText('Options not available from the server').first().waitFor();
    assert.equal(await dialog.getByText('Options not available from the server').count(), 3);
    assert.equal(await dialog.getByRole('combobox', { name: 'Delivery' }).count(), 0, 'no empty dropdown');
    missing = false;
    await dialog.getByRole('button', { name: 'Retry' }).first().click();
    await dialog.getByRole('combobox', { name: 'Delivery' }).waitFor();
    assert.deepEqual(await optionsOf(page, 'Delivery'), ['RTM', '1 Year', '2 Years', '3 Years', '4 Years']);
  });
});
