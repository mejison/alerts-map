import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import { ONESIGNAL_APP_ID, PUSH_SITE_ORIGIN } from '../../lib/onesignal-config.mjs';
import { validOneSignalId } from '../../lib/push-core.mjs';
import regions from '../../lib/regions.json';
import { regionKey, validateAlertSnapshot } from '../../lib/push-core.mjs';
import type { Alerts } from '../../lib/types';

export type PushRecord = {
  subscriptionId?: string;
  region: string;
  tokenHash: string;
  state: string;
  disabled?: boolean;
  leaseUntil?: number;
  lastTestAt?: number;
  pending?: { state: string; id: string };
};

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const subscriptionPrefix = `onesignal/${ONESIGNAL_APP_ID}/`;
export const subscriptionKey = (id: string) => `${subscriptionPrefix}${id}`;
export const store = () => getStore({ name: 'varta-push', consistency: 'strong' });
export const canonicalRegion = (name: string) => regions.find(region => regionKey(region) === regionKey(name));
export const pushConfigured = () => !!process.env.ONESIGNAL_REST_API_KEY;
export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export function authorized(record: PushRecord, token: string) {
  const expected = Buffer.from(record.tokenHash || '', 'hex'), actual = Buffer.from(hash(token), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function input(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new Error('origin');
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Error('input');
  const token = request.headers.get('authorization')?.replace(/^Bearer /, '') || '';
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) throw new Error('token');
  const text = await request.text();
  if (text.length > 8192) throw new Error('input');
  const body = JSON.parse(text);
  if (!validOneSignalId(body.subscriptionId)) throw new Error('input');
  return { body, token, key: subscriptionKey(body.subscriptionId) };
}

// Only freshly fetched, complete alerts can cause a notification. No fallback
// to the map's stale cache, and no all-clear on an upstream error.
export async function freshAlerts(): Promise<Alerts> {
  const response = await fetch('https://neptun.in.ua/api/v1/alerts', {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    cache: 'no-store', signal: AbortSignal.timeout(9000),
  });
  if (!response.ok || Number(response.headers.get('age') || 0) > 30) throw new Error('source');
  const snapshot = validateAlertSnapshot(await response.json()) as Alerts;
  // A provider schema/name change must not silently clear an unmatched region.
  for (const name of [...snapshot.oblasts.map(a => a.name), ...snapshot.raions.map(a => a.oblast)]) {
    if (!canonicalRegion(name)) throw new Error('region');
  }
  return snapshot;
}

type PushMessage = { title: string; body: string; region: string; timestamp: number; expiresAt: number };
export async function sendPush(subscriptionId: string, message: PushMessage, region: string, deliveryId: string = randomUUID()) {
  const url = new URL('/', PUSH_SITE_ORIGIN); url.searchParams.set('region', message.region);
  const response = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Key ${process.env.ONESIGNAL_REST_API_KEY}` },
    signal: AbortSignal.timeout(9000),
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID, target_channel: 'push',
      include_subscription_ids: [subscriptionId],
      headings: { en: message.title, uk: message.title },
      contents: { en: message.body, uk: message.body },
      web_url: url.href, data: { region: message.region, timestamp: message.timestamp, expiresAt: message.expiresAt },
      chrome_web_icon: `${PUSH_SITE_ORIGIN}/icons/icon-192.png`,
      chrome_web_badge: `${PUSH_SITE_ORIGIN}/icons/badge-96.png`,
      web_push_topic: hash(region).slice(0, 32), ttl: 120, priority: 10,
      idempotency_key: deliveryId,
    }),
  });
  const result = await response.json() as { id?: string; errors?: { invalid_player_ids?: string[] } };
  if (result.errors?.invalid_player_ids?.includes(subscriptionId)) throw Object.assign(new Error('Inactive OneSignal subscription'), { statusCode: 410 });
  // A 2xx without a message ID means OneSignal did not send anything.
  if (!response.ok || !result.id) throw new Error('OneSignal did not accept the notification');
  return result.id;
}

export const expiredPush = (error: unknown) => [404, 410].includes((error as {statusCode?: number})?.statusCode || 0);
