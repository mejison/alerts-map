import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fromAlertsInUa,fromUkraineAlarm} from '../lib/providers.ts';
test('alerts.in.ua adapter preserves yellow, excludes finished/non-air, and never expands community polygons',()=>{
 const a=fromAlertsInUa({alerts:[{location_title:'Київська область',location_type:'oblast',location_oblast:'Київська область',alert_type:'air_raid',alert_level:'yellow'}, {location_title:'Бучанський район',location_type:'raion',location_oblast:'Київська область',alert_type:'air_raid'}, {location_title:'Тестова громада',location_type:'hromada',location_uid:'99',location_raion:'Бучанський район',location_oblast:'Київська область',alert_type:'air_raid'}, {alert_type:'air_raid',finished_at:'2026-01-01'}, {alert_type:'artillery_shelling'}]});
 assert.equal(a.oblasts.length,1);assert.equal(a.oblasts[0].level,'yellow');assert.equal(a.raions.length,2);assert.equal(a.raions[0].key,'бучанський');assert.equal(a.raions[1].key,'unmapped:99');
});
test('UkraineAlarm adapter resolves parent state and does not treat artillery as air raid',()=>{
 const catalog={states:[{regionId:'14',regionName:'Київська область',regionChildIds:[{regionId:'1401',regionName:'Бучанський район',regionChildIds:[{regionId:'140101',regionName:'Тестова громада'}]}]}]};
 const a=fromUkraineAlarm([{regionId:'1401',activeAlerts:[{type:'AIR',lastUpdate:'2026-10-19'}]},{regionId:'140101',activeAlerts:[{type:'AIR'}]},{regionId:'14',activeAlerts:[{type:'ARTILLERY'}]}],catalog);
 assert.equal(a.oblasts.length,0);assert.equal(a.raions.length,2);assert.equal(a.raions[0].oblast,'Київська область');assert.equal(a.raions[1].key,'unmapped:140101');
 assert.throws(()=>fromUkraineAlarm([{regionId:'missing',activeAlerts:[{type:'AIR'}]}],catalog));
});
