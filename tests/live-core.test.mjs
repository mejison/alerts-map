import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canPlot,canShowHeading,geometryPath,normalize,parseAlerts,project,reduceThreats,validThreat} from '../lib/live-core.mjs';
const t={id:'test',type:'uav',title:'БпЛА',lat:50,lon:30,updatedAt:'2026-10-19T08:00:00Z',status:'active',confidenceLevel:'medium',heading:90};
test('snapshot replaces, upsert deduplicates, remove removes; malformed frames preserve state',()=>{
 let state=reduceThreats([],{type:'snapshot',data:{threats:[t,{...t,id:'second'},null,{...t,id:'bad',lat:300}]}});
 assert.equal(state.length,2);state=reduceThreats(state,{type:'upsert',data:{...t,title:'Оновлено'}});assert.equal(state.length,2);assert.equal(state.find(x=>x.id==='test').title,'Оновлено');
 state=reduceThreats(state,{type:'remove',data:{id:'second'}});assert.equal(state.length,1);
 assert.equal(reduceThreats(state,{type:'snapshot',data:null}),state);
 assert.equal(reduceThreats(state,{type:'upsert',data:{id:'bad'}}),state);
 assert.deepEqual(reduceThreats(state,{type:'snapshot',data:{threats:[]}}),[]);
});
test('area-only notifications never become points or directions',()=>{assert.equal(canPlot({...t,areaOnly:true}),false);assert.equal(canShowHeading({...t,areaOnly:true}),false);assert.equal(canPlot(t),true);});
test('resolved, invalid coordinates and unknown headings do not become directions',()=>{assert.equal(validThreat({...t,lon:Infinity}),false);assert.equal(validThreat({...t,updatedAt:'broken'}),false);assert.equal(canPlot({...t,status:'resolved'}),false);assert.equal(canShowHeading({...t,heading:null}),false);assert.equal(canShowHeading({...t,confidenceLevel:'low'}),false);assert.equal(canShowHeading(t),true);});
test('alert parser preserves warning levels and ignores malformed entries',()=>{const a=parseAlerts({raions:[null,{key:'a',name:'А',level:'yellow'},{key:'b',name:'Б'}]});assert.equal(a.raions.length,2);assert.equal(a.raions[0].level,'yellow');assert.equal(a.raions[1].level,'red');assert.deepEqual(a.oblasts,[]);});
test('all bundled geographic features produce finite SVG paths',()=>{for(const name of ['oblasts','raions']){const j=JSON.parse(readFileSync(new URL(`../public/data/${name}.geojson`,import.meta.url)));assert.equal(j.features.length,name==='oblasts'?27:136);for(const f of j.features){const p=geometryPath(f.geometry);assert.ok(p.startsWith('M'));assert.ok(!/NaN|Infinity/.test(p));}}const [x,y]=project(30.52,50.45);assert.ok(x>0&&x<1100&&y>0&&y<800);});
test('matching normalizes apostrophes and region suffixes',()=>{assert.equal(normalize('Кам’янський район'),normalize("Кам'янський"));assert.equal(normalize('Київська область'),'київська');});
