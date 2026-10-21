import { publicHistory, HISTORY_CELL_DEGREES, HISTORY_DELAY_MS, HISTORY_MIN_SAMPLES } from '../../lib/threat-history.mjs';
import { historyStore } from '../lib/threat-history';

export default async function handler(request: Request) {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
  const day = new URL(request.url).searchParams.get('day') || '';
  const now = Date.now();
  const start = Date.parse(`${day}T00:00:00.000Z`);
  const validDay = /^\d{4}-\d{2}-\d{2}$/.test(day) && Number.isFinite(start) && new Date(start).toISOString().slice(0, 10) === day;
  const end = validDay ? Date.parse(`${day}T23:59:59.999Z`) : NaN;
  const oldest = new Date(now);
  oldest.setUTCHours(0, 0, 0, 0);
  oldest.setUTCDate(oldest.getUTCDate() - 30);
  if (!validDay || end > now - HISTORY_DELAY_MS || end < oldest.getTime()) {
    return Response.json({ error: 'Історія доступна із затримкою та зберігається до 30 днів.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const record = await historyStore().get(`days/${day}`, { type: 'json' }) as { day?: string; cells?: Record<string, number> } | null;
  if (!record || record.day !== day) return Response.json({ day, available: false, cells: [], minSamples: HISTORY_MIN_SAMPLES, cellDegrees: HISTORY_CELL_DEGREES, delayHours: 24 }, { headers: { 'Cache-Control': 'public, max-age=900' } });
  return Response.json({
    day,
    available: true,
    cells: publicHistory(record),
    minSamples: HISTORY_MIN_SAMPLES,
    cellDegrees: HISTORY_CELL_DEGREES,
    delayHours: 24,
  }, { headers: { 'Cache-Control': 'public, max-age=900', 'X-Content-Type-Options': 'nosniff' } });
}
