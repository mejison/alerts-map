import test from 'node:test';
import assert from 'node:assert/strict';
import { alertMessage, regionKey, stateForRegion, validateAlertSnapshot, validPushSubscription } from '../lib/push-core.mjs';

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
test('push endpoints are constrained to public browser push gateways', () => {
  const subscription = endpoint => ({ endpoint, keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } });
  for (const endpoint of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/test', 'https://web.push.apple.com/test', 'https://wns2-db5p.notify.windows.com/w/?token=test']) {
    assert.equal(validPushSubscription(subscription(endpoint)), true, endpoint);
  }
  for (const endpoint of ['http://fcm.googleapis.com/test', 'https://127.0.0.1/private', 'https://fcm.googleapis.com.evil.example/test', 'https://evilpush.apple.com/test', 'https://user:pass@fcm.googleapis.com/test', 'https://fcm.googleapis.com:8443/test']) {
    assert.equal(validPushSubscription(subscription(endpoint)), false, endpoint);
  }
  assert.equal(validPushSubscription({ ...subscription('https://fcm.googleapis.com/test'), keys: {} }), false);
});
