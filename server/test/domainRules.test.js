const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  canDeleteShelter,
  hasShelterFreeSlot,
  safeDecrementCapacity,
  getShelterCapacityDelta,
  validateTemperamentTraits,
  filterByStatus,
  resolveClientBaseUrl,
} = require('../utils/domainRules');

test('canDeleteShelter: пустой приют можно удалить', () => {
  const r = canDeleteShelter(0);
  assert.equal(r.allowed, true);
  assert.equal(r.message, null);
});

test('canDeleteShelter: заполненный приют удалить нельзя', () => {
  const r = canDeleteShelter(3);
  assert.equal(r.allowed, false);
  assert.match(r.message, /3/);
});

test('hasShelterFreeSlot: есть свободные места', () => {
  assert.equal(hasShelterFreeSlot(2, 10), true);
  assert.equal(hasShelterFreeSlot(10, 10), false);
});

test('safeDecrementCapacity: не уходит ниже нуля', () => {
  assert.equal(safeDecrementCapacity(5), 4);
  assert.equal(safeDecrementCapacity(0), 0);
  assert.equal(safeDecrementCapacity(-1), 0);
});

test('getShelterCapacityDelta: Approved из Pending', () => {
  assert.equal(getShelterCapacityDelta('Pending', 'Approved'), 1);
});

test('getShelterCapacityDelta: Approved из InReview — без изменения', () => {
  assert.equal(getShelterCapacityDelta('InReview', 'Approved'), 0);
});

test('getShelterCapacityDelta: Approved в Adopted — одно уменьшение', () => {
  assert.equal(getShelterCapacityDelta('Approved', 'Adopted'), -1);
});

test('getShelterCapacityDelta: Approved в Rejected', () => {
  assert.equal(getShelterCapacityDelta('Approved', 'Rejected'), -1);
});

test('getShelterCapacityDelta: Adopted в Approved — без изменения', () => {
  assert.equal(getShelterCapacityDelta('Adopted', 'Approved'), 1);
});

test('getShelterCapacityDelta: тот же статус', () => {
  assert.equal(getShelterCapacityDelta('Approved', 'Approved'), 0);
});

test('getShelterCapacityDelta: Pending в InReview — без изменения', () => {
  assert.equal(getShelterCapacityDelta('Pending', 'InReview'), 0);
});

test('validateTemperamentTraits: корректные характеристики', () => {
  const r = validateTemperamentTraits(['дружелюбный', 'милый']);
  assert.equal(r.valid, true);
  assert.deepEqual(r.traits, ['дружелюбный', 'милый']);
});

test('validateTemperamentTraits: неверное окончание', () => {
  const r = validateTemperamentTraits(['активная']);
  assert.equal(r.valid, false);
  assert.match(r.error, /ий|ый/);
});

test('validateTemperamentTraits: дубликат', () => {
  const r = validateTemperamentTraits(['милый', 'Милый']);
  assert.equal(r.valid, false);
  assert.match(r.error, /повторяющаяся/);
});

test('filterByStatus: вкладка «Все»', () => {
  const items = [
    { status: 'Pending' },
    { status: 'Approved' },
  ];
  assert.equal(filterByStatus(items, 'all').length, 2);
  assert.equal(filterByStatus(items, null).length, 2);
});

test('filterByStatus: только Pending', () => {
  const items = [
    { status: 'Pending' },
    { status: 'Approved' },
    { status: 'Pending' },
  ];
  const filtered = filterByStatus(items, 'Pending');
  assert.equal(filtered.length, 2);
  assert.ok(filtered.every((i) => i.status === 'Pending'));
});

test('resolveClientBaseUrl: предпочитает https', () => {
  const url = resolveClientBaseUrl('http://localhost:3000,https://app.example.com');
  assert.equal(url, 'https://app.example.com');
});

test('resolveClientBaseUrl: один http-адрес', () => {
  assert.equal(resolveClientBaseUrl('http://localhost:3000'), 'http://localhost:3000');
});
