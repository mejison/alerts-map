import { getStore } from '@netlify/blobs';
import { aggregateThreatSamples, HISTORY_RETENTION_DAYS, HISTORY_SAMPLE_MS, historyDayAt } from '../../lib/threat-history.mjs';
import { validThreat } from '../../lib/live-core.mjs';

type DailyHistory = {
  day: string;
  lastBucket: number;
  updatedAt: string;
  cells: Record<string, number>;
};

export const historyStore = () => getStore({ name: 'varta-threat-history', consistency: 'strong' });

export async function fetchCurrentThreats(now = Date.now()) {
  const response = await fetch('https://neptun.in.ua/api/v1/threats', {
    headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
    cache: 'no-store', signal: AbortSignal.timeout(9000),
  });
  if (!response.ok || Number(response.headers.get('age') || 0) > 30) throw new Error('source');
  const body = await response.json() as { threats?: unknown };
  if (!Array.isArray(body?.threats)) throw new Error('snapshot');
  return body.threats.filter((threat): threat is Record<string, unknown> => {
    if (!validThreat(threat) || threat.advisory || threat.areaOnly || threat.status === 'resolved') return false;
    const updated = Date.parse(String((threat as { updatedAt: string }).updatedAt));
    return updated <= now + 60_000 && now - updated <= 15 * 60_000;
  });
}

export async function recordThreatSample(now = Date.now(), threats?: unknown[]) {
  const points = threats ?? await fetchCurrentThreats(now);
  const additions = aggregateThreatSamples(points);
  const day = historyDayAt(now), bucket = Math.floor(now / HISTORY_SAMPLE_MS);
  const db = historyStore(), key = `days/${day}`;

  // Scheduled runs can overlap. Compare-and-swap both prevents double samples
  // and avoids losing increments when Netlify starts concurrent invocations.
  for (let attempt = 0; attempt < 4; attempt++) {
    const saved = await db.getWithMetadata(key, { type: 'json' });
    if (saved && !saved.etag) throw new Error('etag');
    const previous = saved?.data as DailyHistory | undefined;
    if (previous && previous.lastBucket >= bucket) return { recorded: false, reason: 'duplicate' as const };
    const cells = { ...(previous?.cells || {}) };
    for (const [cell, count] of Object.entries(additions)) cells[cell] = (cells[cell] || 0) + count;
    const next: DailyHistory = { day, lastBucket: bucket, updatedAt: new Date(now).toISOString(), cells };
    const result = await db.setJSON(key, next, saved ? { onlyIfMatch: saved.etag } : { onlyIfNew: true });
    if (result.modified) return { recorded: true, cells: Object.keys(additions).length };
  }
  throw new Error('conflict');
}

export async function pruneThreatHistory(now = Date.now()) {
  const cutoff = new Date(now);
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() - HISTORY_RETENTION_DAYS);
  const oldest = historyDayAt(cutoff.getTime());
  const db = historyStore();
  let deleted = 0;
  for await (const page of db.list({ prefix: 'days/', paginate: true })) {
    for (const { key } of page.blobs) {
      const day = key.slice('days/'.length);
      if (/^\d{4}-\d{2}-\d{2}$/.test(day) && day < oldest) {
        await db.delete(key);
        deleted++;
      }
    }
  }
  return deleted;
}
