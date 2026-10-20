import { json, pushConfigured } from '../lib/push';
import { ONESIGNAL_APP_ID } from '../../lib/onesignal-config.mjs';

export default function handler(request: Request) {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
  return json({ enabled: pushConfigured(), provider: 'OneSignal', appId: ONESIGNAL_APP_ID, intervalSeconds: 60 });
}
