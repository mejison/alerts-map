import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { BlobsServer } from '@netlify/blobs/server';
import { getStore, setEnvironmentContext } from '@netlify/blobs';
import webpush from 'web-push';

test('Netlify subscriptions and dispatcher use durable state, leases, ownership and safe failure handling', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'varta-push-test-'));
  const output = resolve('.netlify/test-functions');
  await build({ entryPoints: ['push-subscription', 'push-dispatch', 'push-test', 'push-config'].map(name => `netlify/functions/${name}.ts`), outdir: output, bundle: true, platform: 'node', format: 'esm', packages: 'external', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
  const imports = await Promise.all(['push-subscription', 'push-dispatch', 'push-test', 'push-config'].map(name => import(pathToFileURL(resolve(output, `${name}.mjs`)))));
  const [subscription, dispatch, testPush, config] = imports.map(module => module.default);
  assert.equal(imports[1].config.schedule, '* * * * *');
  const server = new BlobsServer({ directory, token: 'test-token', logger: () => {} });
  const address = await server.start(), url = `http://127.0.0.1:${address.port}`;
  setEnvironmentContext({ edgeURL: url, uncachedEdgeURL: url, siteID: 'test-site', token: 'test-token' });
  const originalFetch = globalThis.fetch, originalSend = webpush.sendNotification;
  const env = Object.fromEntries(['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'].map(key => [key, process.env[key]]));
  const keys = webpush.generateVAPIDKeys();
  Object.assign(process.env, { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: 'https://alerts.example' });
  let snapshot = { oblasts: [], raions: [] }, unavailable = false, calls = [], duringSend = null;
  // The filesystem emulator omits ETags on GET and does not atomically check
  // and rename on PUT. Preserve its actual PUT ETags and serialize local I/O
  // to emulate Netlify's documented production atomic-CAS contract.
  let operations = Promise.resolve();
  const etags = new Map();
  globalThis.fetch = (input, init) => {
    if (String(input).startsWith('https://neptun.in.ua/')) return Promise.resolve(unavailable ? new Response('', { status: 503 }) : Response.json(snapshot));
    const key = String(input), method = (input instanceof Request ? input.method : init?.method || 'GET').toUpperCase();
    const next = operations.then(async () => {
      const response = await originalFetch(input, init), headers = new Headers(response.headers);
      if (method === 'PUT' && response.ok) etags.set(key, response.headers.get('etag'));
      if (method === 'GET' && response.ok && etags.has(key)) headers.set('etag', etags.get(key));
      return new Response(await response.arrayBuffer(), { status: response.status, headers });
    });
    operations = next.then(() => new Promise(resolve => setTimeout(resolve, 2)));
    return next;
  };
  webpush.sendNotification = async (_subscription, payload) => { calls.push(JSON.parse(payload)); if (duringSend) await duringSend(); return { statusCode: 201, headers: {}, body: '' }; };
  const token = 'a'.repeat(64), endpoint = 'https://fcm.googleapis.com/fcm/send/test';
  const browserSubscription = { endpoint, keys: { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) } };
  const request = (body = {}, method = 'POST', owner = token, origin = 'https://alerts.example') => new Request('https://alerts.example/api/push/subscription', { method, headers: { Origin: origin, 'Content-Type': 'application/json', Authorization: `Bearer ${owner}` }, body: JSON.stringify({ endpoint, ...body }) });
  const db = getStore({ name: 'varta-push', consistency: 'strong' });
  const record = async () => { const { blobs } = await db.list({ prefix: 'subscriptions/' }); return db.get(blobs[0].key, { type: 'json' }); };
  try {
    assert.equal((await config(new Request('https://alerts.example/api/push/config'))).status, 200);
    assert.equal((await subscription(request({ subscription: browserSubscription, region: 'Рівненська область' }))).status, 200);
    assert.equal((await record()).state, 'clear');
    await dispatch(); assert.equal(calls.length, 0, 'registration does not fabricate a transition');
    assert.equal((await subscription(request({ action: 'status' }, 'POST', 'b'.repeat(64)))).status, 403);
    assert.equal((await subscription(request({}, 'DELETE', 'b'.repeat(64)))).status, 403);
    assert.equal((await subscription(request({ action: 'status' }, 'POST', token, 'https://evil.example'))).status, 400);
    snapshot = { oblasts: [{ name: 'Рівненська область', level: 'yellow' }], raions: [] };
    duringSend = () => new Promise(resolve => setTimeout(resolve, 25));
    await Promise.all([dispatch(), dispatch()]);
    assert.equal(calls.length, 1, 'overlapping runs send only one transition');
    await dispatch(); assert.equal(calls.length, 1);
    snapshot.oblasts[0].level = 'red'; await dispatch(); assert.equal(calls.length, 2);
    unavailable = true;
    await assert.rejects(dispatch); assert.equal(calls.length, 2); assert.equal((await record()).state, 'red');
    unavailable = false; snapshot = { oblasts: [], raions: [] };
    await dispatch(); assert.equal(calls.length, 3); assert.equal(calls[2].title, 'Відбій повітряної тривоги');
    duringSend = null;
    assert.equal((await testPush(request())).status, 200);
    assert.equal((await testPush(request())).status, 429, 'test notifications are rate limited');
    snapshot = { oblasts: [{ name: 'Рівненська область', level: 'red' }], raions: [] };
    duringSend = async () => { assert.equal((await subscription(request({}, 'DELETE'))).status, 200); };
    await dispatch();
    assert.equal((await record()).disabled, true, 'an in-flight dispatch cannot resurrect an unsubscribed endpoint');
    assert.equal((await record()).subscription, undefined, 'unsubscribing removes endpoint and encryption keys');
    const sent = calls.length; await dispatch(); assert.equal(calls.length, sent);
  } finally {
    globalThis.fetch = originalFetch; webpush.sendNotification = originalSend;
    for (const [key, value] of Object.entries(env)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    setEnvironmentContext({}); await server.stop(); await rm(directory, { recursive: true, force: true });
  }
});
