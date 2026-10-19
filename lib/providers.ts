import { normalize, parseAlerts, validThreat } from './live-core.mjs';
import type { Alerts, LiveData } from './types';

async function get(url: string, headers: Record<string,string> = {}) {
  const r = await fetch(url, { headers: { Accept:'application/json', ...headers }, signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error(`Джерело відповіло HTTP ${r.status}`);
  return r.json();
}
export function fromAlertsInUa(data: any): Alerts {
  if (!Array.isArray(data.alerts)) throw new Error('Некоректна відповідь alerts.in.ua');
  const result: Alerts = {raions:[],oblasts:[]};
  for (const a of data.alerts) {
    if(a.alert_type !== 'air_raid' || a.finished_at) continue;
    const top = a.location_type === 'oblast';
    // Do not expand a community-only alert into a whole district polygon.
    const name = a.location_title;
    if (!name) continue;
    const alert = {key:(top || a.location_type==='raion') ? normalize(name) : `unmapped:${a.location_uid}`,name,oblast:a.location_oblast || name,since:a.started_at,level:a.alert_level === 'yellow' ? 'yellow' as const : 'red' as const,reasons: a.notes ? [a.notes] : []};
    (top ? result.oblasts : result.raions).push(alert);
  }
  return result;
}
export function fromUkraineAlarm(data: any, catalog: any): Alerts {
  if (!Array.isArray(data)) throw new Error('Некоректна відповідь UkraineAlarm');
  const regions = new Map<string,{name:string;oblast:string;top:boolean;district:boolean}>();
  function walk(list:any[], oblast='',depth=0) { for(const r of list || []) { const name=r.regionName || r.name; const top=!oblast; const parent=oblast || name; regions.set(String(r.regionId || r.id),{name,oblast:parent,top,district:depth===1}); walk(r.regionChildIds || r.children || [],parent,depth+1); } }
  walk(catalog.states || catalog);
  const result:Alerts={raions:[],oblasts:[]};
  for (const region of data) {
    const air = region.activeAlerts?.find((a:any)=>a.type==='AIR' || a.type==='AIR_RAID');
    if(!air) continue;
    const meta=regions.get(String(region.regionId));
    if(!meta?.name) throw new Error('Не вдалося зіставити регіон UkraineAlarm');
    (meta.top ? result.oblasts : result.raions).push({key:(meta.top||meta.district)?normalize(meta.name):`unmapped:${region.regionId}`,name:meta.name,oblast:meta.oblast,since:air.lastUpdate || region.lastUpdate,level:'red'});
  }
  return result;
}

let cache:{at:number;data:LiveData}|null=null;
let pending:Promise<LiveData>|null=null;
export async function loadLive():Promise<LiveData> {
  if(cache && Date.now()-cache.at<15000) return cache.data;
  if(pending) return pending;
  pending = (async()=>{
    const errors:string[]=[];
    const results = await Promise.allSettled(['/threats','/alerts','/messages'].map(p=>get(`https://neptun.in.ua/api/v1${p}`)));
    const value=(i:number)=> results[i].status==='fulfilled' ? (results[i] as PromiseFulfilledResult<any>).value : null;
    const threats=value(0), alertData=value(1), messages=value(2);
    if(!threats || !Array.isArray(threats.threats)) errors.push('Не вдалося оновити загрози');
    if(!alertData || !Array.isArray(alertData.raions) || !Array.isArray(alertData.oblasts)) errors.push('Не вдалося оновити тривоги');
    let alerts=alertData ? parseAlerts(alertData) : cache?.data.alerts || {raions:[],oblasts:[]};
    let provider='NEPTUN';
    const choice=process.env.ALERT_PROVIDER;
    try {
      if(choice==='alerts-in-ua' && process.env.ALERTS_IN_UA_TOKEN) {
        alerts=fromAlertsInUa(await get('https://api.alerts.in.ua/v1/alerts/active.json',{Authorization:`Bearer ${process.env.ALERTS_IN_UA_TOKEN}`})); provider='alerts.in.ua'; const index=errors.indexOf('Не вдалося оновити тривоги'); if(index>=0) errors.splice(index,1);
      } else if(choice==='ukrainealarm' && process.env.UKRAINE_ALARM_TOKEN) {
        const headers={Authorization:process.env.UKRAINE_ALARM_TOKEN};
        const [a,r]=await Promise.all([get('https://api.ukrainealarm.com/api/v3/alerts',headers),get('https://api.ukrainealarm.com/api/v3/regions',headers)]);
        alerts=fromUkraineAlarm(a,r);provider='UkraineAlarm'; const index=errors.indexOf('Не вдалося оновити тривоги'); if(index>=0) errors.splice(index,1);
      }
    }catch { errors.push('Прямий API тривог недоступний; резервне джерело NEPTUN'); }
    if(!threats && !alertData && !cache) throw new Error('Немає зв’язку з джерелом');
    const data:LiveData={threats: threats?.threats?.filter(validThreat) || cache?.data.threats || [], alerts,messages:messages?.messages || [],receivedAt:new Date().toISOString(),provider,providers:{alertsInUa:!!process.env.ALERTS_IN_UA_TOKEN,ukraineAlarm:!!process.env.UKRAINE_ALARM_TOKEN},errors};
    cache={at:Date.now(),data};
    return data;
  })().finally(()=>{pending=null;});
  return pending;
}
