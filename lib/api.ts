import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { PUSH_SITE_ORIGIN } from './onesignal-config.mjs';

/** Bundled mobile assets are local; authenticated API requests use native HTTPS. */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!path.startsWith('/api/') || path.includes('..')) throw new Error('Invalid API path');
  if (!Capacitor.isNativePlatform()) return fetch(path, options);
  options.signal?.throwIfAborted();
  const headers = Object.fromEntries(new Headers(options.headers).entries());
  const result = await CapacitorHttp.request({
    url: new URL(path, PUSH_SITE_ORIGIN).href,
    method: options.method || 'GET',
    headers: { ...headers, Origin: PUSH_SITE_ORIGIN, Accept: 'application/json' },
    data: typeof options.body === 'string' ? options.body : undefined,
    responseType: 'text', connectTimeout: 12_000, readTimeout: 12_000,
  });
  options.signal?.throwIfAborted();
  return new Response(typeof result.data === 'string' ? result.data : JSON.stringify(result.data), {
    status: result.status, headers: result.headers,
  });
}
