import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { APP, API, choose, closeBrowser, login, toast, withSession } from '../support/browser.mjs';

after(closeBrowser);

// An older backend answers PUT /api/leads/:id with the bare row (no { item }). The page must not crash (white page);
// it reloads the list from the server instead.
test('saving a lead never blanks the page, whatever shape the update response has', async (t) => {
  await withSession(t, async ({ page, shot }) => {
    await login(page, 'admin');
    await page.route(new RegExp(`${API.replace(/[.]/g, '\\.')}/leads/\\d+$`), async (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      const real = await route.fetch();
      const body = await real.json();
      await route.fulfill({ response: real, json: body.item ?? body }); // old shape: the row itself
    });
    await page.goto(`${APP}/leads`);
    const first = page.getByRole('button', { name: /^Edit / }).first();
    const name = (await first.getAttribute('aria-label')).replace(/^Edit /, '');
    await first.click();
    await page.fill('#lead-email', 'client@example.com');
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await toast(page, 'Lead updated').waitFor();
    await page.getByRole('heading', { name: 'My Leads' }).waitFor();
    await page.getByText(name, { exact: true }).first().waitFor();
    // the inline project change uses the same response
    await choose(page, `Project of ${name}`, 'No project');
    await page.getByRole('heading', { name: 'My Leads' }).waitFor();
    assert.ok(await page.getByRole('row').count() > 2, 'the table is still rendered');
    await shot('after-save');
  });
});
