import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyRequirementFilters, emptyRequirements, fromRequirementsForm, matchesRequirementFilters, parseAmount, requirementsSummary, toRequirementsForm,
} from '../../src/lib/requirements.ts';

const options = {
  destinations: [{ id: 1, name: 'New Cairo', isActive: true, sortOrder: 1 }, { id: 5, name: 'North Coast', isActive: true, sortOrder: 5 }],
  propertyTypes: [{ id: 3, name: 'Duplex', isActive: true, sortOrder: 3 }],
  delivery: [{ value: 'ready_to_move', label: 'Ready to Move' }],
  finishing: [{ value: 'fully_finished', label: 'Fully Finished' }],
  purpose: [{ value: 'investment', label: 'Investment' }],
} as const;

test('amounts: commas allowed, junk and negatives refused, empty = not specified', () => {
  assert.equal(parseAmount('1,500,000'), 1500000);
  assert.equal(parseAmount(' 2 000 000 '), 2000000);
  assert.equal(parseAmount('99.5'), 99.5);
  assert.equal(parseAmount(''), null);
  for (const bad of ['-5', '2.5m', '1e9', 'abc', '1.234']) assert.equal(parseAmount(bad), 'invalid', bad);
});

test('form -> API value, with the same cross-field rules as the server', () => {
  const form = { ...toRequirementsForm(null), destinationIds: [5], budgetMin: '6,000,000', budgetMax: '4,000,000', downPayment: '9000000' };
  const r = fromRequirementsForm(form);
  assert.equal(r.errors['requirements.budgetMax'], 'Maximum budget must be at least the minimum budget');
  assert.equal(r.errors['requirements.downPayment'], 'Down payment cannot be higher than the maximum budget');
  const ok = fromRequirementsForm({ ...form, budgetMax: '9,000,000', downPayment: '900000', purpose: 'investment' });
  assert.deepEqual(ok.errors, {});
  assert.deepEqual(ok.value, { ...emptyRequirements(), destinationIds: [5], budgetMin: 6000000, budgetMax: 9000000, downPayment: 900000, purpose: 'investment' });
  assert.deepEqual(toRequirementsForm(ok.value).budgetMax, '9000000', 'round trip');
});

test('filters match the server semantics (budget must fall inside the client range)', () => {
  const req = { ...emptyRequirements(), destinationIds: [1, 5], propertyTypeIds: [3], budgetMin: 3000000, budgetMax: 5000000, purpose: 'investment' as const };
  const f = emptyRequirementFilters();
  assert.equal(matchesRequirementFilters(req, f), true);
  assert.equal(matchesRequirementFilters(req, { ...f, destinationId: '5' }), true);
  assert.equal(matchesRequirementFilters(req, { ...f, destinationId: '2' }), false);
  assert.equal(matchesRequirementFilters(req, { ...f, budget: '4,000,000' }), true);
  assert.equal(matchesRequirementFilters(req, { ...f, budget: '6,000,000' }), false);
  assert.equal(matchesRequirementFilters(req, { ...f, purpose: 'upgrading' }), false);
  assert.equal(matchesRequirementFilters(undefined, { ...f, budget: '1' }), false, 'no budget on file never matches a budget filter');
});

test('one-line summary for the table', () => {
  const req = { ...emptyRequirements(), destinationIds: [1, 5], propertyTypeIds: [3], budgetMax: 5000000, purpose: 'investment' as const };
  assert.equal(requirementsSummary(req, options as never), 'New Cairo, North Coast · Duplex · up to 5,000,000 EGP · Investment');
  assert.equal(requirementsSummary(undefined, options as never), '');
});
