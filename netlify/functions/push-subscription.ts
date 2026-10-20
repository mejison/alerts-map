import { authorized, canonicalRegion, freshAlerts, hash, input, json, pushConfigured, store, type PushRecord } from '../lib/push';
import { stateForRegion, validPushSubscription } from '../../lib/push-core.mjs';

export default async function handler(request: Request) {
  if (!['POST', 'DELETE'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'POST, DELETE' } });
  if (!pushConfigured()) return json({ error: 'Сповіщення тимчасово недоступні.' }, 503);
  let data: Awaited<ReturnType<typeof input>>;
  try { data = await input(request); } catch { return json({ error: 'Некоректний запит.' }, 400); }
  const { body, token, key } = data, db = store();
  try {
    const existing = await db.getWithMetadata(key, { type: 'json' });
    if (existing && !existing.etag) throw new Error('Missing store ETag');
    const record = existing?.data as PushRecord | undefined;
    if (record && !record.disabled && !authorized(record, token)) return json({ error: 'Не вдалося підтвердити підписку на цьому пристрої.' }, 403);
    if (request.method === 'DELETE') {
      if (!record || record.disabled) return json({ ok: true });
      // Conditional tombstones prevent a running dispatcher resurrecting an
      // unsubscribed endpoint. Remove the endpoint and encryption keys.
      const result = await db.setJSON(key, { disabled: true, tokenHash: hash(token), region: '', state: 'clear' }, { onlyIfMatch: existing!.etag });
      return result.modified ? json({ ok: true }) : json({ error: 'Спробуйте ще раз.' }, 409);
    }
    if (body.action === 'status') return record && !record.disabled ? json({ region: record.region }) : json({ region: null }, 404);
    const region = typeof body.region === 'string' && canonicalRegion(body.region);
    if (!region || !validPushSubscription(body.subscription) || body.subscription.endpoint !== body.endpoint) return json({ error: 'Оберіть область і дозвольте сповіщення.' }, 400);
    const state = stateForRegion(await freshAlerts(), region);
    const subscription = { endpoint: body.endpoint, keys: { p256dh: body.subscription.keys.p256dh, auth: body.subscription.keys.auth } };
    const result = await db.setJSON(key, { subscription, region, tokenHash: hash(token), state, lastTestAt: record?.lastTestAt || 0 } satisfies PushRecord, existing ? { onlyIfMatch: existing.etag } : { onlyIfNew: true });
    return result.modified ? json({ ok: true, region, state }) : json({ error: 'Підписка оновлюється. Спробуйте ще раз.' }, 409);
  } catch { return json({ error: 'Не вдалося зберегти підписку. Спробуйте пізніше.' }, 503); }
}
