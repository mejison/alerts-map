import { authorized, expiredPush, input, json, pushConfigured, sendPush, store, type PushRecord } from '../lib/push';

export default async function handler(request: Request) {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  if (!pushConfigured()) return json({ error: 'Сповіщення тимчасово недоступні.' }, 503);
  let data: Awaited<ReturnType<typeof input>>;
  try { data = await input(request); } catch { return json({ error: 'Некоректний запит.' }, 400); }
  try {
    const db = store(), saved = await db.getWithMetadata(data.key, { type: 'json' });
    if (saved && !saved.etag) throw new Error('Missing store ETag');
    const record = saved?.data as PushRecord | undefined;
    if (!record?.subscriptionId || record.disabled || !authorized(record, data.token)) return json({ error: 'Підписку не знайдено.' }, 403);
    if (Date.now() - (record.lastTestAt || 0) < 60_000) return json({ error: 'Наступна перевірка буде доступна за хвилину.' }, 429);
    const updated = await db.setJSON(data.key, { ...record, lastTestAt: Date.now() }, { onlyIfMatch: saved!.etag });
    if (!updated.modified || !updated.etag) return json({ error: 'Спробуйте ще раз.' }, 409);
    const now = Date.now();
    try {
      await sendPush(record.subscriptionId, { title: 'Перевірка сповіщень ВАРТА', body: `${record.region}. Сповіщення на цьому пристрої працюють. Це тест, а не сигнал тривоги.`, region: record.region, timestamp: now, expiresAt: now + 120_000 }, 'test');
    } catch (error) {
      if (expiredPush(error)) await db.setJSON(data.key, { disabled: true, tokenHash: record.tokenHash, region: '', state: 'clear' }, { onlyIfMatch: updated.etag });
      throw error;
    }
    return json({ ok: true });
  } catch { return json({ error: 'Не вдалося доставити тест. Спробуйте поновити підписку.' }, 503); }
}
