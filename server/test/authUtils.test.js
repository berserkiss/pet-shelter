const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseBearerToken } = require('../utils/authUtils');

test('parseBearerToken: корректный Bearer', () => {
  const r = parseBearerToken('Bearer abc.def.ghi');
  assert.equal(r.ok, true);
  assert.equal(r.token, 'abc.def.ghi');
  assert.equal(r.error, null);
});

test('parseBearerToken: нет заголовка', () => {
  const r = parseBearerToken(undefined);
  assert.equal(r.ok, false);
  assert.equal(r.token, null);
});

test('parseBearerToken: не Bearer', () => {
  const r = parseBearerToken('Basic dXNlcjpwYXNz');
  assert.equal(r.ok, false);
});

test('parseBearerToken: пустой токен после Bearer', () => {
  const r = parseBearerToken('Bearer   ');
  assert.equal(r.ok, false);
});
