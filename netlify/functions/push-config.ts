import { json, pushConfigured } from '../lib/push';

export default function handler(request: Request) {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
  return json({ enabled: pushConfigured(), publicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null, intervalSeconds: 60 });
}
