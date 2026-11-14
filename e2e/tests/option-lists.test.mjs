import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { APP, API, api, closeBrowser, login, toast, tokenFor, unique, withSession } from '../support/browser.mjs';

let admin;
before(async () => { admin = await tokenFor('admin'); });
after(closeBrowser);

for (const [title, path, endpoint, label, addLabel, createLabel] of [
  ['Property Types', '/admin/property-types', 'property-types', 'property type', 'Add Property type', 'Create property type'],
  ['Destinations', '/admin/destinations', 'destinations', 'destination', 'Add Destination', 'Create destination'],
]) {
  test(`${title}: a failed load shows the real error, Retry really refetches, then create / edit / refresh persist`, async (t) => {
    const name = unique(`E2E ${label}`);
    await withSession(t, { allowErrors: [/Failed to load|ERR_FAILED|503/], expectServerErrors: true }, async ({ page, shot }) => {
      await login(page, 'admin');
      // the first load fails like a stopped / broken backend
      let calls = 0;
      await page.route(`${API}/${endpoint}`, async (route) => {
        calls += 1;
        if (calls === 1) return route.fulfill({ status: 503, json: { error: 'Database temporarily unavailable', code: 'DB_UNAVAILABLE' } });
        return route.continue();
      });
      await page.goto(`${APP}${path}`);
      await page.getByRole('alert').filter({ hasText: 'Database temporarily unavailable' }).waitFor();
      await shot('load-failed');
      await page.getByRole('button', { name: 'Retry' }).click();
      await toast(page, `${title} loaded`).waitFor();
      assert.equal(calls, 2, 'Retry sent a new request');
      const expected = (await api('GET', endpoint, null, admin)).body;
      for (const item of expected.slice(0, 3)) await page.getByRole('cell', { name: item.name, exact: true }).waitFor();

      // create
      await page.getByRole('button', { name: addLabel }).click();
      await page.fill('#crud-name', name);
      await page.getByRole('button', { name: createLabel }).click();
      await toast(page, `Created ${label}`).waitFor();
      await page.getByRole('cell', { name, exact: true }).waitFor();
      // edit
      await page.getByRole('button', { name: `Edit ${name}` }).click();
      await page.fill('#crud-name', `${name} edited`);
      await page.fill('#crud-sortOrder', '7');
      await page.getByRole('button', { name: 'Save Changes' }).click();
      await toast(page, `Updated ${label}`).waitFor();
      // refresh: still there, read back from the server
      await page.reload();
      await page.getByRole('cell', { name: `${name} edited`, exact: true }).waitFor();
      await shot('after-refresh');
    });
    const stored = (await api('GET', endpoint, null, admin)).body.find((x) => x.name === `${name} edited`);
    assert.ok(stored, 'persisted in the database');
    assert.equal(stored.sortOrder, 7);
  });
}

test('when the backend cannot be reached at all, the page says so (and Retry tries again)', async (t) => {
  await withSession(t, { allowErrors: [/Failed to load|ERR_FAILED/] }, async ({ page }) => {
    await login(page, 'admin');
    await page.route(`${API}/destinations`, (route) => route.abort('connectionrefused'));
    await page.goto(`${APP}/admin/destinations`);
    await page.getByRole('alert').filter({ hasText: 'Cannot reach the server at' }).waitFor();
    await page.getByRole('button', { name: 'Retry' }).click();
    await toast(page, 'Still could not load destinations').waitFor();
  });
});
