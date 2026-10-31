import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePhone } from './phone.js';

test('normalizes valid Egyptian mobile numbers to 01XXXXXXXXX', () => {
  assert.equal(normalizePhone('01012345678'), '01012345678');
  assert.equal(normalizePhone('+20 101 234 5678'), '01012345678');
  assert.equal(normalizePhone('0020-101-234-5678'), '01012345678');
  assert.equal(normalizePhone('(010) 123-45678'), '01012345678');
});

test('rejects invalid Egyptian mobile numbers', () => {
  assert.equal(normalizePhone('010123456'), null);
  assert.equal(normalizePhone('02012345678'), null);
  assert.equal(normalizePhone('0101234567a'), null);
  assert.equal(normalizePhone('not a phone'), null);
});
