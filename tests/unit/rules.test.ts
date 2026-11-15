import test from 'node:test';
import assert from 'node:assert/strict';
import { passwordProblem } from '../../src/lib/passwords.ts';
import { calculateCommission, earnsCommission } from '../../src/lib/commission.ts';
import { isAssignerRole, isSuperRole, roleLabel } from '../../src/lib/roles.ts';
import { commentsFor, pageCount } from '../../src/lib/table.ts';

test('password rules mirror the server', () => {
  assert.equal(passwordProblem('short', {}), 'Password must be at least 8 characters');
  assert.equal(passwordProblem('aaaaaaaaaa', {}), 'Password is too simple');
  assert.equal(passwordProblem('Me@Corp.test', { email: 'me@corp.test' }), 'Password must not be the same as the email');
  assert.equal(passwordProblem('x'.repeat(40) + 'é'.repeat(20), {}), 'Password is too long', '72-byte bcrypt limit counts bytes');
  assert.equal(passwordProblem('Strong-Pass-2026', { email: 'a@b.co', name: 'Ali' }), '');
});

test('commission: agents only (same rule as the server)', () => {
  assert.equal(calculateCommission(5_000_000, 'agent'), 25_000);
  for (const role of ['team_leader', 'sales_supervisor', 'sales_manager', 'director', 'franchise_owner', 'admin', '', null, undefined]) {
    assert.equal(calculateCommission(5_000_000, role), 0, String(role));
    assert.equal(earnsCommission(role), false, String(role));
  }
});

test('commission: 5,000 EGP per million (same figures as the server)', () => {
  assert.equal(calculateCommission(5_000_000, 'agent'), 25_000);
  assert.equal(calculateCommission(10_000_000, 'agent'), 50_000);
  assert.equal(calculateCommission(1_234_567, 'agent'), 6172.84);
  assert.equal(calculateCommission(5_200_000, 'agent'), 26_000);
  assert.equal(calculateCommission(0, 'agent'), 0);
  assert.equal(calculateCommission(Number.NaN, 'agent'), 0);
  assert.equal(calculateCommission(-5, 'agent'), 0);
});

test('roles match the backend policy', () => {
  assert.equal(isSuperRole('franchise_owner'), true);
  assert.equal(isSuperRole('director'), false);
  assert.equal(isAssignerRole('team_leader'), true);
  assert.equal(isAssignerRole('agent'), false);
  assert.equal(roleLabel('sales_supervisor'), 'Sales Supervisor');
  assert.equal(roleLabel('new_role'), 'new role');
});

test('table helpers', () => {
  assert.equal(pageCount(0, 10), 1);
  assert.equal(pageCount(21, 10), 3);
  const comments = [
    { id: 1, leadId: 7, entityType: 'lead', entityId: 7 }, { id: 2, leadId: 7, entityType: 'cold_call', entityId: 7 }, { id: 3, leadId: 7 },
  ] as never[];
  assert.deepEqual(commentsFor(comments, 'lead', 7).map((c: { id: number }) => c.id), [1, 3]);
  assert.deepEqual(commentsFor(comments, 'cold_call', 7).map((c: { id: number }) => c.id), [2]);
});
