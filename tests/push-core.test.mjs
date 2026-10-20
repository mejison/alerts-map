import test from 'node:test';
import assert from 'node:assert/strict';
import { alertMessage, regionKey, stateForRegion, validateAlertSnapshot, validOneSignalId } from '../lib/push-core.mjs';

const empty = () => ({ oblasts: [], raions: [] });
test('district alerts keep their entire parent region subscribed until the last district clears', () => {
  const snapshot = { oblasts: [], raions: [
    { name: 'Бучанський район', oblast: 'Київська область', level: 'yellow' },
    { name: 'Броварський район', oblast: 'Київська область', level: 'red' },
  ] };
  assert.equal(stateForRegion(snapshot, 'Київська область'), 'red');
  snapshot.raions.pop();
  assert.equal(stateForRegion(snapshot, 'Київська область'), 'yellow');
  assert.equal(stateForRegion(snapshot, 'м. Київ'), 'clear');
  snapshot.raions.pop();
  assert.equal(stateForRegion(snapshot, 'Київська область'), 'clear');
});
test('Kyiv city aliases agree, without merging city and oblast', () => {
  assert.equal(regionKey('м. Київ'), regionKey('Київ'));
  assert.notEqual(regionKey('Київ'), regionKey('Київська область'));
  assert.equal(stateForRegion({ oblasts: [{ name: 'Київ', level: 'red' }], raions: [] }, 'м. Київ'), 'red');
});
test('missing arrays, malformed records and unknown levels never become all-clear snapshots', () => {
  for (const value of [null, {}, { oblasts: [] }, { ...empty(), oblasts: [null] }, { ...empty(), oblasts: [{ name: 'Київ', level: 'green' }] }, { ...empty(), raions: [{ name: 'Район', level: 'red' }] }]) {
    assert.throws(() => validateAlertSnapshot(value));
  }
  assert.deepEqual(validateAlertSnapshot(empty()), empty());
});
test('only transitions generate messages, with a short expiry and separate all-clear wording', () => {
  assert.equal(alertMessage('Рівненська область', null, 'red'), null);
  assert.equal(alertMessage('Рівненська область', 'red', 'red'), null);
  assert.equal(alertMessage('Рівненська область', 'clear', 'clear'), null);
  const start = alertMessage('Рівненська область', 'clear', 'yellow', 1000);
  assert.equal(start.title, 'Повітряна тривога');
  assert.equal(start.expiresAt, 121000);
  assert.match(start.body, /жовтий/);
  assert.equal(alertMessage('Рівненська область', 'yellow', 'red').title, 'Зміна рівня тривоги');
  assert.equal(alertMessage('Рівненська область', 'red', 'clear').title, 'Відбій повітряної тривоги');
});
test('only OneSignal UUID identifiers are accepted, never arbitrary push URLs', () => {
  assert.equal(validOneSignalId('7bf96834-2f7d-44ac-b320-b511b0fe2aa9'), true);
  for (const value of [null, {}, '', 'https://fcm.googleapis.com/fcm/send/test', 'http://127.0.0.1', 'not-a-subscription', '3471bd1d-58b7-4529-903a-aca7f27149f5/anything']) assert.equal(validOneSignalId(value), false);
});
