'use client';
import { useEffect, useRef, useState } from 'react';
import { parseAlerts, reduceThreats } from './live-core.mjs';
import type { LiveData } from './types';

export function useLive() {
 const [data,setData]=useState<LiveData>({threats:[],alerts:{raions:[],oblasts:[]},messages:[],receivedAt:'',provider:'NEPTUN',providers:{alertsInUa:false,ukraineAlarm:false},errors:[]});
 const [connection,setConnection]=useState('connecting'),[ready,setReady]=useState({threats:false,alerts:false}),[now,setNow]=useState(0),[contacts,setContacts]=useState({threats:0,alerts:0});
 const retryRef=useRef(()=>{});
 useEffect(()=>{
  let stopped=false,ws:WebSocket|null=null,reconnect:ReturnType<typeof setTimeout>|undefined,attempt=0,lastFrame=0,lastAlertFrame=0,inFlight=false,controller:AbortController|undefined,activeProvider='NEPTUN';
  async function rest(){
   if(stopped||inFlight||!navigator.onLine)return;
   inFlight=true;controller=new AbortController();const started=Date.now();const timeout=setTimeout(()=>controller?.abort(),12000);
   try{
    const r=await fetch('/api/live',{signal:controller.signal,cache:'no-store'});if(!r.ok)throw new Error();
    const snap:LiveData=await r.json();if(stopped)return;activeProvider=snap.provider;
    const threatOk=!snap.errors.includes('Не вдалося оновити загрози'),alertOk=!snap.errors.includes('Не вдалося оновити тривоги');
    setData(prev=>({...snap,threats:threatOk&&lastFrame<=started?snap.threats:prev.threats,alerts:alertOk&&(activeProvider!=='NEPTUN'||lastAlertFrame<=started)?snap.alerts:prev.alerts}));
    setReady(p=>({threats:p.threats||threatOk,alerts:p.alerts||alertOk}));setContacts(p=>({threats:threatOk?Date.now():p.threats,alerts:alertOk?Date.now():p.alerts}));
    if(ws?.readyState!==WebSocket.OPEN)setConnection('polling');
   }catch{if(!stopped&&ws?.readyState!==WebSocket.OPEN)setConnection(navigator.onLine?'reconnecting':'offline');}
   finally{clearTimeout(timeout);inFlight=false;}
  }
  function connect(){
   if(stopped||!navigator.onLine||(ws&&ws.readyState<2))return;
   setConnection(attempt?'reconnecting':'connecting');ws=new WebSocket('wss://neptun.in.ua/api/v1/stream');
   ws.onopen=()=>{attempt=0;lastFrame=Date.now();};
   ws.onmessage=e=>{
    let f:any;try{f=JSON.parse(String(e.data));}catch{return;}
    if(!['snapshot','upsert','remove','heartbeat','alerts'].includes(f.type))return;
    lastFrame=Date.now();setConnection('live');setContacts(p=>({...p,threats:lastFrame}));
    if(['snapshot','upsert','remove'].includes(f.type)){setData(p=>({...p,threats:reduceThreats(p.threats,f)}));if(f.type==='snapshot'&&Array.isArray(f.data?.threats))setReady(p=>({...p,threats:true}));}
    if(f.type==='alerts'&&activeProvider==='NEPTUN'&&Array.isArray(f.data?.raions)&&Array.isArray(f.data?.oblasts)){lastAlertFrame=Date.now();setData(p=>({...p,alerts:parseAlerts(f.data)}));setReady(p=>({...p,alerts:true}));setContacts(p=>({...p,alerts:lastAlertFrame}));}
   };
   ws.onerror=()=>ws?.close();ws.onclose=()=>{ws=null;if(stopped)return;setConnection(navigator.onLine?'reconnecting':'offline');void rest();reconnect=setTimeout(connect,Math.min(30000,1000*2**Math.min(attempt++,5))+Math.random()*500);};
  }
  const retry=()=>{clearTimeout(reconnect);attempt=0;void rest();connect();};retryRef.current=retry;
  const offline=()=>{setConnection('offline');ws?.close();};
  window.addEventListener('online',retry);window.addEventListener('offline',offline);void rest();connect();setNow(Date.now());
  const poll=setInterval(rest,15000),tick=setInterval(()=>{setNow(Date.now());if(ws?.readyState===WebSocket.OPEN&&Date.now()-lastFrame>45000)ws.close();},1000);
  return()=>{stopped=true;clearInterval(poll);clearInterval(tick);clearTimeout(reconnect);controller?.abort();if(ws){ws.onclose=null;ws.close();}window.removeEventListener('online',retry);window.removeEventListener('offline',offline);};
 },[]);
 return {data,ready,connection,now,contacts,alertsStale:connection==='offline'||!ready.alerts||(now>0&&now-contacts.alerts>60000),threatsStale:connection==='offline'||!ready.threats||(now>0&&now-contacts.threats>45000),retry:()=>retryRef.current()};
}
