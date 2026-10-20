import { alertMessage, stateForRegion } from '../../lib/push-core.mjs';
import { randomUUID } from 'node:crypto';
import { expiredPush, freshAlerts, pushConfigured, sendPush, store, subscriptionPrefix, type PushRecord } from '../lib/push';

export default async function handler() {
  if (!pushConfigured()) return new Response(null, { status: 204 });
  const db = store();
  // Fetch before any state writes. Failed/malformed snapshots abort the run.
  const alerts = await freshAlerts();
  let sent = 0, failed = 0;
  for await (const page of db.list({ prefix: subscriptionPrefix, paginate: true })) {
    // Bounded concurrency keeps push gateways and the store from being flooded.
    for (let i = 0; i < page.blobs.length; i += 8) {
      await Promise.all(page.blobs.slice(i, i + 8).map(async ({ key }) => {
        const saved = await db.getWithMetadata(key, { type: 'json' });
        if (saved && !saved.etag) throw new Error('Missing store ETag');
        const record = saved?.data as PushRecord | undefined;
        if (!record?.subscriptionId || record.disabled || (record.leaseUntil || 0) > Date.now()) return;
        const state = stateForRegion(alerts, record.region), message = alertMessage(record.region, record.state, state);
        if (!message) return;
        // Compare-and-swap lease prevents duplicate sends from overlapping runs.
        const pending = record.pending?.state === state ? record.pending : { state, id: randomUUID() };
        const lease = await db.setJSON(key, { ...record, pending, leaseUntil: Date.now() + 45_000 }, { onlyIfMatch: saved!.etag });
        if (!lease.modified || !lease.etag) return;
        try {
          await sendPush(record.subscriptionId, message, record.region, pending.id);
          await db.setJSON(key, { ...record, state, pending: undefined, leaseUntil: 0 }, { onlyIfMatch: lease.etag });
          sent++;
        } catch (error) {
          const next = expiredPush(error) ? { disabled: true, tokenHash: record.tokenHash, region: '', state: 'clear' } : { ...record, pending, leaseUntil: 0 };
          await db.setJSON(key, next, { onlyIfMatch: lease.etag });
          failed++;
        }
      }));
    }
  }
  // Never log device identifiers, API keys, or private alert preferences.
  console.log('Push dispatch completed', { sent, failed });
  return new Response(null, { status: 204 });
}

export const config = { schedule: '* * * * *' };
