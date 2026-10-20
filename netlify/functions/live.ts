import { liveResponse } from '../../lib/live-response';

export default function handler(request: Request) {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } });
  return liveResponse();
}
