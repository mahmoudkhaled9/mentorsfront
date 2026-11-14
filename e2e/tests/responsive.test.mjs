import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { APP, closeBrowser, login, withSession } from '../support/browser.mjs';

after(closeBrowser);

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
];
const PAGES = ['/dashboard', '/leads', '/cold-calls', '/deals', '/developers', '/reports', '/admin/users', '/admin/destinations'];

for (const vp of VIEWPORTS) {
  test(`${vp.name} ${vp.width}x${vp.height}: pages render without page-level horizontal scrolling`, async (t) => {
    await withSession(t, { viewport: { width: vp.width, height: vp.height } }, async ({ page, shot }) => {
      await login(page, 'admin');
      for (const route of PAGES) {
        await page.goto(`${APP}${route}`);
        await page.waitForLoadState('networkidle').catch(() => {});
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        assert.ok(overflow <= 1, `${route} overflows the ${vp.name} screen by ${overflow}px`);
        await shot(`${vp.name}${route.replace(/\//g, '-')}`);
      }
    });
  });
}

test('phone: the navigation menu opens, navigates and closes', async (t) => {
  await withSession(t, { viewport: { width: 390, height: 844 } }, async ({ page }) => {
    await login(page, 'admin');
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    const menu = page.getByRole('dialog');
    await menu.getByRole('link', { name: 'Cold Calls' }).click();
    await page.waitForURL(/\/cold-calls$/);
    await menu.waitFor({ state: 'detached' });
    await page.getByRole('heading', { name: 'Cold Calls List' }).waitFor();
  });
});
