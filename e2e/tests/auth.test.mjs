import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { APP, api, closeBrowser, login, phone, tokenFor, toast, unique, withSession } from '../support/browser.mjs';

after(closeBrowser);

test('wrong password shows an error and stays on the login page', async (t) => {
  await withSession(t, { allowErrors: [/401/] }, async ({ page }) => {
    await page.goto(`${APP}/login`);
    await page.fill('#email', 'admin@demo.test');
    await page.fill('#password', 'not-the-password');
    await page.click('button[type=submit]');
    await page.getByText(/invalid|incorrect|wrong/i).first().waitFor({ timeout: 10000 });
    assert.match(page.url(), /\/login$/);
  });
});

test('signed-out visitors are sent to the login page for every protected route', async (t) => {
  await withSession(t, async ({ page }) => {
    for (const route of ['/dashboard', '/leads', '/admin/users', '/admin/destinations']) {
      await page.goto(`${APP}${route}`);
      await page.waitForURL(/\/login$/);
    }
  });
});

test('admin signs in, sees the admin menu, and logout really ends the session', async (t) => {
  await withSession(t, async ({ page, shot }) => {
    await login(page, 'admin');
    await page.getByRole('button', { name: 'Admin' }).click();
    for (const item of ['Users', 'Destinations', 'Property Types', 'Assign', 'Upload Data']) {
      await page.getByRole('link', { name: item, exact: true }).first().waitFor();
    }
    await shot('admin-menu');
    await page.getByRole('button', { name: 'Logout' }).click();
    await page.waitForURL(/\/login$/);
    assert.equal(await page.evaluate(() => localStorage.getItem('mentors_auth_token')), null);
    await page.goto(`${APP}/leads`);
    await page.waitForURL(/\/login$/);
  });
});

test('an agent has no admin menu and is turned away from admin pages', async (t) => {
  await withSession(t, async ({ page }) => {
    await login(page, 'agent');
    assert.equal(await page.getByRole('button', { name: 'Admin' }).count(), 0);
    await page.goto(`${APP}/admin/users`);
    await page.waitForURL(/\/dashboard$/);
  });
});

test('a team leader only gets the Assign page under Admin', async (t) => {
  await withSession(t, async ({ page }) => {
    await login(page, 'leader');
    await page.getByRole('button', { name: 'Admin' }).click();
    await page.getByRole('link', { name: 'Assign', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Users', exact: true }).count(), 0);
    await page.getByRole('link', { name: 'Assign', exact: true }).click();
    await page.getByRole('heading', { name: 'Assign Leads & Cold Calls' }).waitFor();
  });
});

test('an invalid / expired token sends the user back to login with a message', async (t) => {
  await withSession(t, { allowErrors: [/401/] }, async ({ page }) => {
    await login(page, 'agent');
    await page.evaluate(() => localStorage.setItem('mentors_auth_token', 'expired.token.value'));
    await page.goto(`${APP}/leads`);
    await page.waitForURL(/\/login$/, { timeout: 15000 });
  });
});

test('changing the password keeps the current session and invalidates the old token', async (t) => {
  const admin = await tokenFor('admin');
  const email = `${unique('pw').replace(/\s/g, '').toLowerCase()}@demo.test`;
  const created = await api('POST', 'users', { name: 'Password Tester', email, phone: phone(), role: 'agent', password: 'First-Pass-2026' }, admin);
  assert.equal(created.status, 200, JSON.stringify(created.body));
  const oldToken = (await api('POST', 'auth/login', { email, password: 'First-Pass-2026' })).body.token;
  try {
    await withSession(t, async ({ page }) => {
      await login(page, email, 'First-Pass-2026');
      await page.goto(`${APP}/profile`);
      await page.fill('#currentPassword', 'First-Pass-2026');
      await page.fill('#newPassword', 'Second-Pass-2026');
      await page.fill('#confirmPassword', 'Second-Pass-2026');
      await page.getByRole('button', { name: /change password/i }).click();
      await toast(page, 'Password changed').waitFor();
      // still signed in: the page switched to the new token
      await page.goto(`${APP}/leads`);
      await page.getByRole('heading', { name: 'My Leads' }).waitFor();
      assert.match(page.url(), /\/leads$/);
    });
    assert.equal((await api('GET', 'auth/me', null, oldToken)).status, 401, 'the old token must stop working');
    assert.equal((await api('POST', 'auth/login', { email, password: 'Second-Pass-2026' })).status, 200);
  } finally {
    await api('DELETE', `users/${created.body.id}`, null, admin);
  }
});
