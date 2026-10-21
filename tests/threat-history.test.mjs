import test from 'node:test';
import assert from 'node:assert/strict';
import { aggregateThreatSamples, cellKey, decodeCell, eligibleHistoryDay, publicHistory, HISTORY_MIN_SAMPLES } from '../lib/threat-history.mjs';

const base = { id: 'ephemeral-source-id', type: 'uav', lat: 50.42, lon: 30.63, status: 'active' };

test('history aggregates current UAV observations into coarse cells without retaining identities', () => {
  const cells = aggregateThreatSamples([
    base,
    { ...base, id: 'another-id', lat: 50.8, lon: 30.9 },
    { ...base, type: 'fpv' },
    { ...base, type: 'recon' },
    { ...base, type: 'missile' },
    { ...base, advisory: true },
    { ...base, areaOnly: true },
    { ...base, status: 'resolved' },
    { ...base, lon: 80 },
  ]);
  assert.deepEqual(cells, { '50:30': 4 });
  assert.equal(Object.values(cells).some(value => typeof value === 'string'), false);
  assert.equal(cellKey(50.2, 30.4), '50:30');
  assert.deepEqual(decodeCell('50:30'), { lat: 50, lon: 30 });
  assert.equal(decodeCell('50:80'), null);
});

test('public archive hides sparse cells and exposes only day-level coarse counts', () => {
  const cells = publicHistory({ day: '2026-10-19', cells: { '50:30': HISTORY_MIN_SAMPLES, '50:31': 3, '50:80': 100, 'bad': 40 } });
  assert.deepEqual(cells, [{ lat: 50, lon: 30, samples: HISTORY_MIN_SAMPLES }]);
  assert.equal(JSON.stringify(cells).includes('ephemeral-source-id'), false);
  assert.equal(JSON.stringify(cells).includes('lat":50.42'), false);
});

test('history remains hidden until a full UTC day is closed for 24 hours and expires after retention', () => {
  const now = Date.parse('2026-10-21T12:00:00.000Z');
  assert.equal(eligibleHistoryDay('2026-10-20', now), false);
  assert.equal(eligibleHistoryDay('2026-10-19', now), true);
  assert.equal(eligibleHistoryDay('2026-09-20', now), false);
  assert.equal(eligibleHistoryDay('2026-02-30', now), false);
  assert.equal(eligibleHistoryDay('not-a-day', now), false);
});
