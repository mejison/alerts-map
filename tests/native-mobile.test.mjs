import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { ONESIGNAL_APP_ID, PUSH_SITE_ORIGIN } from '../lib/onesignal-config.mjs';

test('native push waits for permission, subscription ID and token; clicks stay in the app', async () => {
  const directory = resolve('.netlify/test-native');
  await build({ entryPoints: ['lib/native-onesignal.ts', 'lib/onesignal.ts'], outdir: directory, bundle: true, format: 'esm', platform: 'browser', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
  const { createNativePushAdapter } = await import(pathToFileURL(resolve(directory, 'native-onesignal.mjs')));
  const { optInOneSignal } = await import(pathToFileURL(resolve(directory, 'onesignal.mjs')));
  const listeners = new Map(), state = { id: null, token: null, optedIn: false };
  let granted = false, prompts = 0, initialized, opened;
  const subscription = {
    getIdAsync: async () => state.id, getTokenAsync: async () => state.token, getOptedInAsync: async () => state.optedIn,
    optIn: async () => { state.optedIn = true; }, optOut: async () => { state.optedIn = false; },
    addEventListener: (_name, callback) => listeners.set('subscription', callback),
  };
  const native = {
    initialize: async appId => { initialized = appId; },
    Notifications: {
      hasPermission: async () => granted, canRequestPermission: async () => !granted,
      requestPermission: async () => { prompts++; granted = true; return true; },
      addEventListener: (name, callback) => listeners.set(name, callback),
    },
    User: { pushSubscription: subscription, addTags: async () => {}, removeTags: async () => {} },
  };
  const sdk = await createNativePushAdapter(native, region => { opened = region; });
  assert.equal(initialized, ONESIGNAL_APP_ID);
  assert.equal(prompts, 0, 'initializing the app must not prompt');
  assert.equal(sdk.getPermission(), 'default');
  let resolved = false;
  const pending = optInOneSignal(sdk).then(id => { resolved = true; return id; });
  const flush = async () => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
  await flush();
  assert.equal(prompts, 1);
  state.id = '7bf96834-2f7d-44ac-b320-b511b0fe2aa9';
  listeners.get('subscription')(); await flush();
  assert.equal(resolved, false, 'ID and opt-in without an APNs/FCM token are not deliverable');
  state.token = 'native-device-token';
  listeners.get('subscription')();
  assert.equal(await pending, state.id);
  assert.equal(sdk.getPermission(), 'granted');
  listeners.get('click')({ notification: { additionalData: { region: 'Рівненська область' } } });
  assert.equal(opened, 'Рівненська область');
  await sdk.User.PushSubscription.optOut();
  assert.equal(sdk.User.PushSubscription.optedIn, false);
});

test('bundled native API uses fixed HTTPS origin and preserves subscription ownership', async () => {
  const output = resolve('.netlify/test-native/api.mjs');
  await build({ entryPoints: ['lib/api.ts'], outfile: output, bundle: true, format: 'esm', platform: 'browser', logLevel: 'silent',
    plugins: [{ name: 'native-test-runtime', setup(builder) {
      builder.onResolve({ filter: /^@capacitor\/core$/ }, () => ({ path: 'native', namespace: 'test' }));
      builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const Capacitor={isNativePlatform:()=>globalThis.__native}; export const CapacitorHttp={request:options=>globalThis.__http(options)};' }));
    } }],
  });
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.__native = true;
  globalThis.__http = async options => { calls.push(options); return { status: 200, headers: { 'Content-Type': 'application/json' }, data: '{"ok":true}' }; };
  try {
    const { apiFetch } = await import(pathToFileURL(output));
    const response = await apiFetch('/api/push/subscription', { method: 'POST', headers: { Authorization: 'Bearer ownership-token', 'Content-Type': 'application/json' }, body: '{"region":"Рівненська область"}' });
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(calls[0].url, `${PUSH_SITE_ORIGIN}/api/push/subscription`);
    assert.equal(calls[0].headers.authorization, 'Bearer ownership-token');
    assert.equal(calls[0].headers.Origin, PUSH_SITE_ORIGIN);
    assert.equal(calls[0].data, '{"region":"Рівненська область"}');
    await assert.rejects(apiFetch('https://evil.example/api/live'), /Invalid API path/);
    await assert.rejects(apiFetch('/api/../secret'), /Invalid API path/);
    globalThis.__native = false;
    globalThis.fetch = async (path, options) => { assert.equal(path, '/api/live'); assert.equal(options.cache, 'no-store'); return Response.json({ web: true }); };
    assert.deepEqual(await (await apiFetch('/api/live', { cache: 'no-store' })).json(), { web: true });
    assert.equal(calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__native; delete globalThis.__http;
  }
});
