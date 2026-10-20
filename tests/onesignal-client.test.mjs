import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { ONESIGNAL_APP_ID } from '../lib/onesignal-config.mjs';

test('OneSignal loads once and waits for the SDK subscription after a user-initiated permission request', async () => {
  const output = resolve('.netlify/test-client/onesignal.mjs');
  await build({ entryPoints: ['lib/onesignal.ts'], outfile: output, bundle: true, platform: 'browser', format: 'esm', logLevel: 'silent' });
  const { loadOneSignal, optInOneSignal } = await import(pathToFileURL(output));
  const originals = { window: globalThis.window, document: globalThis.document, Notification: globalThis.Notification };
  let scripts = [], options, prompts = 0;
  const listeners = new Set();
  const subscription = {
    id: null, optedIn: false,
    optIn: async () => { setTimeout(() => { subscription.id = '7bf96834-2f7d-44ac-b320-b511b0fe2aa9'; subscription.optedIn = true; for (const listener of listeners) listener(); }, 5); },
    addEventListener: (_event, listener) => listeners.add(listener),
    removeEventListener: (_event, listener) => listeners.delete(listener),
  };
  const sdk = { init: async value => { options = value; }, User: { PushSubscription: subscription }, Notifications: { requestPermission: async () => { prompts++; } } };
  globalThis.window = {};
  globalThis.document = { getElementById: () => null, createElement: () => ({}), head: { appendChild: script => scripts.push(script) } };
  globalThis.Notification = { permission: 'granted' };
  try {
    const first = loadOneSignal(), second = loadOneSignal();
    assert.equal(first, second);
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].src, 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js');
    assert.equal(scripts[0].defer, true);
    await window.OneSignalDeferred[0](sdk); await first;
    assert.equal(options.appId, ONESIGNAL_APP_ID);
    assert.equal(options.serviceWorkerParam.scope, '/push/onesignal/');
    assert.equal(options.promptOptions.slidedown.prompts[0].autoPrompt, false);
    assert.equal(prompts, 0, 'initialization never requests notification permission');
    const subscribed = optInOneSignal(sdk);
    assert.equal(prompts, 1, 'permission is requested within the button gesture');
    assert.equal(await subscribed, subscription.id);
    assert.equal(listeners.size, 0);
  } finally {
    for (const [key, value] of Object.entries(originals)) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
