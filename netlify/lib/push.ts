import { createHash, timingSafeEqual } from 'node:crypto';
import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
import regions from '../../lib/regions.json';
import { regionKey, validateAlertSnapshot } from '../../lib/push-core.mjs';
import type { Alerts } from '../../lib/types';

export type PushRecord = {
  subscription?: webpush.PushSubscription;
  region: string;
  tokenHash: string;
  state: string;
  disabled?: boolean;
  leaseUntil?: number;
  lastTestAt?: number;
};

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const subscriptionKey = (endpoint: string) => `subscriptions/${hash(endpoint)}`;
export const store = () => getStore({ name: 'varta-push', consistency: 'strong' });
export const canonicalRegion = (name: string) => regions.find(region => regionKey(region) === regionKey(name));
export const pushConfigured = () => !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
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
  if (typeof body.endpoint !== 'string' || body.endpoint.length > 2048) throw new Error('input');
  return { body, token, key: subscriptionKey(body.endpoint) };
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

export async function sendPush(subscription: webpush.PushSubscription, message: unknown, region: string) {
  return webpush.sendNotification(subscription, JSON.stringify(message), {
    vapidDetails: { subject: process.env.VAPID_SUBJECT!, publicKey: process.env.VAPID_PUBLIC_KEY!, privateKey: process.env.VAPID_PRIVATE_KEY! },
    TTL: 120, urgency: 'high', timeout: 5000,
    topic: hash(region).slice(0, 32),
  });
}

export const expiredPush = (error: unknown) => [404, 410].includes((error as {statusCode?: number})?.statusCode || 0);
