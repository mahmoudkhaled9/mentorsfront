import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPhone, normalizeClientPhone, normalizeEgyptianMobile, telHref, whatsappHref } from '../../src/lib/phone.ts';

test('Egyptian mobiles: 11 digits starting 010/011/012/015, common spellings normalised', () => {
  for (const [input, out] of [
    ['01012345678', '01012345678'], ['011 2345 6789', '01123456789'], ['+20 12 3456 7890', '01234567890'],
    ['00201512345678', '01512345678'], ['(015) 1234-5678', '01512345678'],
  ]) assert.equal(normalizeEgyptianMobile(input), out, input);
  for (const bad of ['01312345678', '0101234567', '010123456789', '1012345678', '01O12345678', '', 'abc', '+44 20 7946 0958']) {
    assert.equal(normalizeEgyptianMobile(bad), null, bad);
  }
});

test('client phones also accept international numbers, but not +20 numbers that are not mobiles', () => {
  assert.equal(normalizeClientPhone('+44 20 7946 0958'), '+442079460958');
  assert.equal(normalizeClientPhone('01012345678'), '01012345678');
  assert.equal(normalizeClientPhone('+20 2 1234 5678'), null);
});

test('checkPhone: required / optional / unchanged legacy value / employee rule', () => {
  assert.deepEqual(checkPhone('', { required: false }), { ok: true, value: '' });
  assert.equal(checkPhone('', { required: true }).ok, false);
  assert.deepEqual(checkPhone('12345', { keep: '12345' }), { ok: true, value: '12345' }, 'a stored legacy value may be kept as is');
  assert.equal(checkPhone('+447911123456', { kind: 'employee' }).ok, false, 'employees need an Egyptian mobile');
  assert.equal(checkPhone('+447911123456', { kind: 'client' }).ok, true);
});

test('call and WhatsApp links', () => {
  assert.equal(telHref('010 1234 5678'), 'tel:01012345678');
  assert.equal(telHref(undefined), '');
  assert.equal(whatsappHref('01012345678'), 'https://wa.me/201012345678');
  assert.equal(whatsappHref('+44 7911 123456'), 'https://wa.me/447911123456');
  assert.equal(whatsappHref(''), '');
});
