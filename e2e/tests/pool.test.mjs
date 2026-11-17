import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { APP, api, choose, closeBrowser, login, toast, tokenFor, withSession } from '../support/browser.mjs';

/*
 * Number Pool in the browser. The demo company holds 40 uploaded pool numbers (scripts/lib/dev-data.mjs).
 * Tree: Tarek Leader -> Amira (agent) + Karim (agent2); Laila Leader -> Youssef (agent3); admin is outside the tree.
 */
let tokens;
let batch;
before(async () => {
  tokens = Object.fromEntries(await Promise.all(['admin', 'agent', 'agent2', 'agent3', 'leader', 'leader2'].map(async (w) => [w, await tokenFor(w)])));
});
after(closeBrowser);

test('agent: requests 5 numbers, sees the full requirements, records a result; nobody outside the tree sees them', async (t) => {
  await withSession(t, async ({ page, shot }) => {
    await login(page, 'agent');
    await page.goto(`${APP}/number-pool`);
    await page.getByRole('heading', { name: 'Number Pool' }).waitFor();
    const me = (await api('GET', 'pool/me', null, tokens.agent)).body;
    if (me.activeBatch && me.activeBatch.counts.open > 0) {
      batch = me.activeBatch; // a re-run against the same database: keep using the open batch
    } else {
      await page.getByRole('button', { name: 'Request 5', exact: true }).click();
      await toast(page, 'numbers assigned to you').waitFor();
      batch = (await api('GET', 'pool/me', null, tokens.agent)).body.activeBatch;
    }
    assert.ok(batch && batch.items.length > 0, 'the agent has an active batch');
    assert.ok(batch.items.every((i) => i.userId === batch.userId));
    const rows = page.getByTestId('pool-item-row');
    await rows.first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Request 5', exact: true }).isDisabled(), true, 'one open batch at a time');
    const first = batch.items.find((i) => i.state === 'open');
    const row = rows.filter({ hasText: first.phone }).first(); // the active batch card (the history tab lists it too)
    await row.getByText(first.requirements.destination).waitFor();
    await shot('pool-agent-batch');

    // record a result and write the client's full request in the same window
    await row.getByRole('button', { name: 'Result' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('heading', { name: 'Client request' }).waitFor();
    const opts = (await api('GET', 'lead-options', null, tokens.agent)).body;
    const dest = opts.destinations.find((d) => d.isActive);
    const type = opts.propertyTypes.find((d) => d.isActive);
    // the upload's destination is pre-selected when it matches the admin list; pick one more explicitly
    if ((await dialog.getByTestId(`pool-req-destinationIds-${dest.id}`).getAttribute('aria-pressed')) !== 'true') await dialog.getByTestId(`pool-req-destinationIds-${dest.id}`).click();
    if ((await dialog.getByTestId(`pool-req-propertyTypeIds-${type.id}`).getAttribute('aria-pressed')) !== 'true') await dialog.getByTestId(`pool-req-propertyTypeIds-${type.id}`).click();
    await dialog.locator('#pool-req-budgetMin').fill('4,000,000');
    await dialog.locator('#pool-req-budgetMax').fill('7,500,000');
    await dialog.locator('#pool-req-downPayment').fill('900000');
    await dialog.locator('#pool-req-installmentPerQuarter').fill('125000');
    await choose(page, 'Delivery', '2 Years');
    await choose(page, 'Finishing', 'Fully Finished');
    await choose(page, 'Purpose of purchase', 'End User');
    await choose(page, 'Result', 'Call back later (cold call created)');
    await dialog.getByLabel('Notes').fill('E2E: call again on Sunday');
    await dialog.getByRole('button', { name: 'Save result' }).click();
    await toast(page, 'cold call was created').waitFor();
    const saved = (await api('GET', `pool/items/${first.id}`, null, tokens.agent)).body;
    assert.equal(saved.outcome, 'cold_call');
    assert.equal(saved.notes, 'E2E: call again on Sunday');
    assert.ok(saved.requirements.destination.includes(dest.name));
    assert.ok(saved.requirements.propertyType.includes(type.name));
    assert.deepEqual([saved.requirements.budgetMin, saved.requirements.budgetMax, saved.requirements.downPayment, saved.requirements.installment], [4000000, 7500000, 900000, 125000]);
    assert.deepEqual([saved.requirements.delivery, saved.requirements.finishing, saved.requirements.purpose], ['within_2_years', 'fully_finished', 'end_user']);
  });

  // privacy, straight against the API the page uses
  const phones = batch.items.map((i) => i.phone);
  for (const who of ['agent2', 'agent3', 'leader2', 'admin']) {
    const list = await api('GET', 'pool/items?pageSize=5000', null, tokens[who]);
    assert.equal(list.status, 200);
    for (const p of phones) assert.ok(!JSON.stringify(list.body).includes(p), `${who} must not see the agent's numbers`);
    assert.equal((await api('GET', `pool/batches/${batch.id}`, null, tokens[who])).status, 404, `${who} batch by id`);
    assert.equal((await api('GET', `pool/items/${batch.items[0].id}`, null, tokens[who])).status, 404, `${who} number by id`);
  }
  const leaderView = await api('GET', `pool/batches/${batch.id}`, null, tokens.leader);
  assert.equal(leaderView.status, 200, 'the agent\'s team leader sees the batch');
});

test('teammate in the browser: Karim sees only his own history, not Amira\'s numbers', async (t) => {
  await withSession(t, async ({ page }) => {
    await login(page, 'agent2');
    await page.goto(`${APP}/number-pool`);
    await page.getByRole('tab', { name: 'My history' }).waitFor();
    await page.getByText(/number\(s\)$/).first().waitFor();
    const text = await page.locator('main').innerText();
    for (const i of batch.items) assert.ok(!text.includes(i.phone), `Amira's ${i.phone} visible to Karim`);
  });
});

test('team leader: sees the team batch with its requirements and hands uncalled numbers back to the pool', async (t) => {
  await withSession(t, async ({ page, shot }) => {
    await login(page, 'leader');
    await page.goto(`${APP}/number-pool`);
    await page.getByRole('tab', { name: 'Batches' }).click();
    const row = page.getByTestId('pool-batch-row').filter({ hasText: `#${batch.id}` });
    await row.getByRole('button', { name: 'Open' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByText(`Batch #${batch.id}`).waitFor();
    await dialog.getByTestId('pool-item-row').first().waitFor();
    await shot('pool-leader-batch');
    page.once('dialog', (d) => d.accept());
    await dialog.getByRole('button', { name: 'Hand back uncalled numbers' }).click();
    await toast(page, 'handed back to the pool').waitFor();
    await page.getByRole('tab', { name: 'Team report' }).click();
    await page.getByTestId('pool-report-row').first().waitFor();
  });
  const after = (await api('GET', `pool/batches/${batch.id}`, null, tokens.leader)).body;
  assert.equal(after.counts.open, 0);
  assert.equal(after.status, 'completed');
  assert.ok(after.items.every((i) => i.userId === batch.userId), 'ownership history kept after the hand-back');
  assert.ok(after.items.some((i) => i.outcome === 'cold_call'), 'the recorded result is kept');
});

test('administrator outside the reporting tree: company totals only, no employee-level numbers', async (t) => {
  await withSession(t, async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`${APP}/number-pool`);
    await page.getByRole('tab', { name: 'Company summary' }).click();
    await page.getByText('Company-wide totals only.', { exact: false }).waitFor();
    await page.getByText('demo-number-pool.xlsx').waitFor();
    const text = await page.locator('main').innerText();
    for (const i of batch.items) assert.ok(!text.includes(i.phone), 'no phone numbers in the admin view');
  });
});

test('daily reset: History, Batches and Report show today and start again from 0 at midnight (local time)', async (t) => {
  await withSession(t, async ({ page }) => {
    // the browser clock is set to 23:59:55 today; the agent's batch was allocated earlier today
    const now = new Date();
    await page.clock.install({ time: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 55) });
    await login(page, 'agent');
    await page.goto(`${APP}/number-pool`);
    const period = page.getByTestId('pool-period');
    await period.getByText('Showing today').waitFor();
    await page.getByText(/^[1-9]\d* number\(s\)$/).waitFor(); // today's history is not empty
    await page.getByRole('tab', { name: 'My report' }).click();
    await page.getByTestId('pool-report-row').first().waitFor();

    await page.clock.runFor(10_000); // past midnight
    await page.getByText('No pool activity in this period.').waitFor();
    await page.getByRole('tab', { name: 'My history' }).click();
    await page.getByText(/^0 number\(s\)$/).waitFor();
    await page.getByRole('tab', { name: 'My batches' }).click();
    await page.getByText('No batches to show.').waitFor();

    // nothing was deleted: picking yesterday shows it again
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    await page.getByLabel('From').fill(day);
    await period.getByText(`Showing ${day} to`).waitFor();
    await page.getByTestId('pool-batch-row').first().waitFor();
    await period.getByRole('button', { name: 'Today' }).click();
    await period.getByText('Showing today').waitFor();
  });
});
