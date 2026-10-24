import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

function worker() {
  const listeners = {}, entries = new Map();
  let online = true;
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    URL, Response,
    self: { location: { origin: 'https://varta.test' }, addEventListener: (name, listener) => { listeners[name] = listener; } },
    caches: {
      open: async () => ({ put: async (key, response) => { entries.set(key, response); } }),
      match: async key => entries.get(key)?.clone(),
    },
    fetch: async request => {
      if (!online) throw new Error('offline');
      return new Response(new URL(request.url).pathname === '/' ? 'map shell' : 'download landing');
    },
  });
  return {
    offline() { online = false; },
    async navigate(path) {
      let response;
      const pending = [];
      listeners.fetch({
        request: { url: `https://varta.test${path}`, method: 'GET', mode: 'navigate' },
        respondWith(value) { response = value; },
        waitUntil(value) { pending.push(value); },
      });
      const result = await response;
      await Promise.all(pending);
      return result;
    },
  };
}

test('visiting the landing never replaces the offline map, including installed PWA start URLs', async () => {
  const app = worker();
  await app.navigate('/?source=pwa');
  await app.navigate('/download/');
  app.offline();
  assert.equal(await (await app.navigate('/?source=pwa&region=kyiv')).text(), 'map shell');
  assert.equal(await (await app.navigate('/download/')).text(), 'download landing');
});

test('the offline shell worker never intercepts live data or notification endpoints', async () => {
  const app = worker();
  for (const path of ['/api/live', '/api/push/config', '/.netlify/functions/live']) {
    assert.equal(await app.navigate(path), undefined);
  }
});
