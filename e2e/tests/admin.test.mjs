import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { APP, api, choose, closeBrowser, login, phone, tokenFor, toast, unique, withSession } from '../support/browser.mjs';

let admin;
before(async () => { admin = await tokenFor('admin'); });
after(closeBrowser);

test('destinations: add, deactivate (kept but not offered), delete', async (t) => {
  const name = unique('Ras El Hekma');
  await withSession(t, async ({ page, shot }) => {
    await login(page, 'admin');
    await page.goto(`${APP}/admin/destinations`);
    await page.getByRole('button', { name: 'Add Destination' }).click();
    await page.getByRole('button', { name: 'Create destination' }).click();
    await page.getByText('Name is required').waitFor();
    await page.fill('#crud-name', name);
    await page.fill('#crud-sortOrder', '5');
    await page.getByRole('button', { name: 'Create destination' }).click();
    await toast(page, 'Created destination').waitFor();
    await page.getByRole('cell', { name, exact: true }).waitFor();
    let listed = (await api('GET', 'lead-options', null, admin)).body.destinations.find((d) => d.name === name);
    assert.deepEqual({ isActive: listed.isActive, sortOrder: listed.sortOrder }, { isActive: true, sortOrder: 5 });

    // the new destination is offered in the lead form right away
    await page.goto(`${APP}/leads`);
    await page.getByRole('button', { name: 'Add Lead' }).click();
    await page.getByRole('button', { name, exact: true }).waitFor();
    await page.keyboard.press('Escape');

    await page.goto(`${APP}/admin/destinations`);
    await page.getByRole('button', { name: `Edit ${name}` }).click();
    await page.locator('#crud-isActive').click();
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await toast(page, 'Updated destination').waitFor();
    listed = (await api('GET', 'lead-options', null, admin)).body.destinations.find((d) => d.name === name);
    assert.equal(listed.isActive, false);
    await shot('deactivated');

    await page.getByRole('button', { name: `Delete ${name}` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await toast(page, 'Deleted destination').waitFor();
  });
  assert.equal((await api('GET', 'destinations', null, admin)).body.some((d) => d.name === name), false);
});

test('property types can be added and an in-use status cannot be deleted', async (t) => {
  const typeName = unique('Penthouse');
  await withSession(t, async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`${APP}/admin/property-types`);
    await page.getByRole('button', { name: 'Add Property type' }).click();
    await page.fill('#crud-name', typeName);
    await page.getByRole('button', { name: 'Create property type' }).click();
    await toast(page, 'Created property type').waitFor();

    await page.goto(`${APP}/admin/statuses`);
    const used = (await api('GET', 'leads', null, admin)).body[0].status;
    await page.getByRole('button', { name: `Delete ${used}` }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click();
    await toast(page, 'still used by').waitFor();
  });
  assert.ok((await api('GET', 'property-types', null, admin)).body.some((p) => p.name === typeName));
});

test('projects: destination and details are saved and shown on the developer page', async (t) => {
  const name = unique('E2E Towers');
  await withSession(t, async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`${APP}/admin/projects`);
    await page.getByRole('button', { name: 'Add Project' }).click();
    await page.fill('#crud-name', name);
    await choose(page, 'Developer', 'Ora');
    await choose(page, 'Destination', 'New Capital');
    await page.fill('#crud-location', 'R7 District');
    await page.fill('#crud-startingPrice', '7,250,000');
    await page.getByRole('button', { name: 'Create project' }).click();
    await toast(page, 'Created project').waitFor();
    const project = (await api('GET', 'projects', null, admin)).body.find((p) => p.name === name);
    assert.deepEqual({ d: project.destinationName, l: project.location, s: project.startingPrice }, { d: 'New Capital', l: 'R7 District', s: 7250000 });
    await page.goto(`${APP}/developers/${project.developerId}`);
    await page.getByText(`${name}`).first().waitFor();
    await page.getByText('New Capital - R7 District').first().waitFor();
  });
});

test('users: Egyptian phone and password rules are enforced; a new user can sign in', async (t) => {
  const email = `${unique('new').replace(/\s/g, '').toLowerCase()}@demo.test`;
  await withSession(t, async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`${APP}/admin/users`);
    await page.getByRole('button', { name: 'Add user' }).click();
    await page.fill('#user-name', 'Nada New');
    await page.fill('#user-email', email);
    await page.fill('#user-phone', '01312345678');
    await page.fill('#user-password', 'short');
    await choose(page, 'Role', 'Agent');
    await page.getByRole('button', { name: 'Add User' }).click();
    await page.getByText(/11 digits starting with 010, 011, 012 or 015/).first().waitFor();
    await page.getByText('Password must be at least 8 characters').waitFor();
    await page.fill('#user-phone', phone());
    await page.fill('#user-password', 'Nada-Pass-2026');
    await choose(page, 'Reports to', 'Tarek Leader (Team Leader)');
    await page.getByRole('button', { name: 'Add User' }).click();
    await toast(page, 'User added').waitFor();
  });
  const login2 = await api('POST', 'auth/login', { email, password: 'Nada-Pass-2026' });
  assert.equal(login2.status, 200);
  const users = (await api('GET', 'users', null, admin)).body;
  const nada = users.find((u) => u.email === email);
  assert.equal(nada.teamLeaderId, users.find((u) => u.name === 'Tarek Leader').id);
  await api('DELETE', `users/${nada.id}`, null, admin);
});

test('cold calls: add with validation, then bulk-assign to an agent', async (t) => {
  const name = unique('Cold E2E');
  await withSession(t, async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`${APP}/cold-calls`);
    await page.getByRole('button', { name: 'Add New Cold Call' }).click();
    await page.fill('#call-name', name);
    await page.fill('#call-phone', phone());
    await page.getByRole('button', { name: 'Save Cold Call' }).click();
    await toast(page, 'Cold call added').waitFor();
    await page.getByLabel('Search cold calls').fill(name);
    await page.getByRole('checkbox', { name: `Select ${name}` }).click();
    await page.getByRole('button', { name: 'Assign (1)' }).click();
    await choose(page, 'Assign to', 'Karim Agent (Agent)');
    await page.getByRole('dialog').getByRole('button', { name: 'Assign', exact: true }).click();
    await toast(page, 'Assigned 1 cold call(s) to Karim Agent').waitFor();
  });
  const call = (await api('GET', 'cold-calls', null, admin)).body.find((c) => c.name === name);
  assert.equal(call.assignedTo, 'Karim Agent');
  assert.equal(call.teamLeader, 'Tarek Leader', 'team leader derived by the server');
});

test('deals: admin changes the status; agents cannot see the admin controls', async (t) => {
  const deals = (await api('GET', 'deals', null, admin)).body;
  const deal = deals.find((d) => d.status === 'pending');
  await withSession(t, async ({ page }) => {
    await login(page, 'admin');
    await page.goto(`${APP}/deals`);
    await page.getByRole('row').filter({ hasText: deal.leadName }).getByRole('button', { name: /view/i }).click();
    await choose(page, 'Deal status', 'Approved');
    await toast(page, 'Deal marked as approved').waitFor();
  });
  assert.equal((await api('GET', 'deals', null, admin)).body.find((d) => d.id === deal.id).status, 'approved');
  await api('PUT', `deals/${deal.id}`, { status: 'pending' }, admin);
  await withSession(t, async ({ page }) => {
    await login(page, 'agent2');
    await page.goto(`${APP}/deals`);
    await page.getByRole('row').filter({ hasText: deal.leadName }).getByRole('button', { name: /view/i }).click();
    await page.getByRole('dialog').getByText('Deal Details').waitFor();
    assert.equal(await page.getByRole('combobox', { name: 'Deal status' }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Delete Deal' }).count(), 0);
  });
});
