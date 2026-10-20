import { loadLive } from './providers';

export async function liveResponse() {
  try {
    return Response.json(await loadLive(), { headers: {
      'Cache-Control': 'public, max-age=10, s-maxage=15',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch {
    return Response.json({ error: 'Джерело тимчасово недоступне. Спробуйте ще раз.' }, {
      status: 503, headers: { 'Cache-Control': 'no-store' },
    });
  }
}
