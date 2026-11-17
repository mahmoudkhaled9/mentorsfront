import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { APP, api, closeBrowser, login, tokenFor, withSession } from '../support/browser.mjs';

after(closeBrowser);

test('branding: UPGRADE CRM SYSTEM on the login page, the browser tab, the sidebar and the dashboard', async (t) => {
  await withSession(t, async ({ page }) => {
    await page.goto(`${APP}/login`);
    assert.equal(await page.title(), 'UPGRADE CRM SYSTEM');
    await page.getByText('Welcome to UPGRADE CRM SYSTEM').waitFor();
    await login(page, 'admin');
    await page.getByRole('heading', { name: 'UPGRADE' }).first().waitFor();
    await page.getByText('CRM SYSTEM', { exact: true }).first().waitFor();
    await page.getByText("Here's what's happening in UPGRADE CRM SYSTEM today").waitFor();
    const text = await page.locator('body').innerText();
    assert.ok(!/\bMentors\b/.test(text), 'the old name is not shown anywhere on the page');
  });
});

test('Developers: agents have no menu entry, no direct URL and get 403 from the API; administrators keep everything', async (t) => {
  const agent = await tokenFor('agent');
  const admin = await tokenFor('admin');
  assert.equal((await api('GET', 'developers', null, agent)).status, 403);
  assert.equal((await api('POST', 'developers', { name: 'Agent attempt' }, agent)).status, 403);
  assert.equal((await api('GET', 'developers', null, admin)).status, 200);
  assert.equal((await api('GET', 'developers', null, await tokenFor('leader'))).status, 200, 'other roles unchanged');

  await withSession(t, async ({ page }) => {
    await login(page, 'agent');
    assert.equal(await page.getByRole('link', { name: 'Developers' }).count(), 0, 'no Developers menu entry for agents');
    for (const url of ['/developers', '/developers/1']) {
      await page.goto(`${APP}${url}`);
      await page.waitForURL(/\/dashboard$/);
    }
    assert.equal(await page.getByText('Some data could not be loaded').count(), 0, 'no error banner for agents');
  });
  await withSession(t, async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('link', { name: 'Developers' }).first().click();
    await page.waitForURL(/\/developers$/);
    await page.getByRole('button', { name: /Add Developer/i }).waitFor();
  });
});

test('Agent Care: the new phone, WhatsApp and e-mail, each one clickable', async (t) => {
  await withSession(t, async ({ page }) => {
    await login(page, 'agent');
    await page.goto(`${APP}/agent-care`);
    await page.getByText('01128641943').first().waitFor();
    await page.getByText('support@upgrade.com').first().waitFor();
    const hrefs = await page.locator('main a[href]').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    assert.ok(hrefs.includes('tel:01128641943'), JSON.stringify(hrefs));
    assert.ok(hrefs.includes('https://wa.me/201128641943'), JSON.stringify(hrefs));
    assert.ok(hrefs.includes('mailto:support@upgrade.com'), JSON.stringify(hrefs));
    const text = await page.locator('main').innerText();
    assert.ok(!text.includes('01100733207') && !/support@mentors/i.test(text), 'old contact details are gone');
  });
});
