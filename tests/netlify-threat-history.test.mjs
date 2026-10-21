import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { BlobsServer } from '@netlify/blobs/server';
import { setEnvironmentContext } from '@netlify/blobs';

test('collector, archive API and retention use coarse delayed Netlify Blobs', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'varta-history-test-'));
  const output = resolve('.netlify/test-functions');
  await build({ entryPoints: { 'threat-history': 'netlify/lib/threat-history.ts', 'threat-history-route': 'netlify/functions/threat-history.ts', 'threat-history-collect': 'netlify/functions/threat-history-collect.ts' }, outdir: output, bundle: true, platform: 'node', format: 'esm', packages: 'external', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
  const [{ recordThreatSample, historyStore, pruneThreatHistory }, route, collector] = await Promise.all([
    import(pathToFileURL(resolve(output, 'threat-history.mjs'))),
    import(pathToFileURL(resolve(output, 'threat-history-route.mjs'))),
    import(pathToFileURL(resolve(output, 'threat-history-collect.mjs'))),
  ]);
  const server = new BlobsServer({ directory, token: 'test-token', logger: () => {} });
  const address = await server.start(), url = `http://127.0.0.1:${address.port}`;
  setEnvironmentContext({ edgeURL: url, uncachedEdgeURL: url, siteID: 'test-site', token: 'test-token' });
  try {
    const now = Date.now();
    const threats = Array.from({ length: 12 }, (_, index) => ({ id: `sensitive-id-${index}`, type: 'uav', lat: 50.2, lon: 30.6 }));
    const result = await recordThreatSample(now, threats);
    assert.equal(result.recorded, true);
    const currentDay = new Date(now).toISOString().slice(0, 10);
    const saved = await historyStore().get(`days/${currentDay}`, { type: 'json' });
    assert.deepEqual(saved.cells, { '50:30': 12 });
    assert.equal(JSON.stringify(saved).includes('sensitive-id'), false);
    assert.equal(JSON.stringify(saved).includes('50.2'), false);

    assert.equal(collector.config.schedule, '*/5 * * * *');
    const archiveDay = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await historyStore().setJSON(`days/${archiveDay}`, { day: archiveDay, cells: { '50:30': 12, '50:31': 2 } });
    const response = await route.default(new Request(`https://alerts.example/api/threat-history?day=${archiveDay}`));
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).cells, [{ lat: 50, lon: 30, samples: 12 }]);
    const fresh = await route.default(new Request(`https://alerts.example/api/threat-history?day=${currentDay}`));
    assert.equal(fresh.status, 400, 'same-day data cannot be read from the archive');

    const expiredDay = new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await historyStore().setJSON(`days/${expiredDay}`, { day: expiredDay, cells: {} });
    await pruneThreatHistory(now);
    assert.equal(await historyStore().get(`days/${expiredDay}`, { type: 'json' }), null);
  } finally {
    setEnvironmentContext({});
    await server.stop();
    await rm(directory, { recursive: true, force: true });
  }
});
