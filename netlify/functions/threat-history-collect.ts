import { pruneThreatHistory, recordThreatSample } from '../lib/threat-history';

export default async function handler() {
  const now = Date.now();
  await recordThreatSample(now);
  const clock = new Date(now);
  if (clock.getUTCHours() === 0 && clock.getUTCMinutes() < 5) await pruneThreatHistory(now);
  return new Response(null, { status: 204 });
}

export const config = { schedule: '*/5 * * * *' };
