import { loadLive } from '@/lib/providers';
export async function GET() {
  try { const data=await loadLive(); return Response.json(data,{headers:{'Cache-Control':'public, max-age=10, s-maxage=15','X-Content-Type-Options':'nosniff'}}); }
  catch { return Response.json({error:'Джерело тимчасово недоступне. Спробуйте ще раз.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
}
