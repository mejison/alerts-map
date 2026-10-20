import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_VIEW,MAP_CENTER,clientToMap,pinchViewAt,unitsPerPixel,viewToWorld,worldToView,zoomViewAt} from '../lib/map-view.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const samePoint=(a,b)=>{near(a.x,b.x);near(a.y,b.y);};
test('screen/world round trips preserve geographic anchors for every supported zoom',()=>{
 for(const zoom of [.8,1,1.7,4])for(const pan of [{x:0,y:0},{x:-320,y:170}])for(const p of [{x:0,y:0},{x:550,y:400},{x:900,y:650}]){
  const view={zoom,pan};samePoint(viewToWorld(worldToView(p,view),view),p);
 }
});
test('wheel zoom holds the location under an off-center cursor in place',()=>{
 const view={zoom:1.3,pan:{x:120,y:-75}},cursor={x:240,y:180},world=viewToWorld(cursor,view);
 for(const zoom of [.8,2,4])samePoint(worldToView(world,zoomViewAt(view,zoom,cursor)),cursor);
});
test('zoom controls keep the same geographic location at the view center after panning',()=>{
 const view={zoom:2,pan:{x:-300,y:220}},world=viewToWorld(MAP_CENTER,view);
 samePoint(worldToView(world,zoomViewAt(view,3)),MAP_CENTER);
});
test('hitting zoom limits does not shift the view or produce NaN',()=>{
 const view={zoom:4,pan:{x:30,y:40}};
 assert.equal(zoomViewAt(view,20,{x:10,y:10}),view);
 assert.equal(zoomViewAt(DEFAULT_VIEW,.1).zoom,.8);
});
test('pinch follows a moving midpoint while keeping the original geographic anchor',()=>{
 const initial={zoom:1.7,pan:{x:50,y:-120}},start={x:300,y:250},world=viewToWorld(start,initial),mid={x:370,y:285};
 for(const requested of [.1,2.5,8]){
  const next=pinchViewAt(world,requested,mid);samePoint(worldToView(world,next),mid);assert.ok(next.zoom>=.8&&next.zoom<=4);
 }
});
test('client coordinates account for both horizontal and vertical SVG letterboxing',()=>{
 // A wide container leaves horizontal margins around an 1100 × 800 view.
 samePoint(clientToMap({x:710,y:420},{left:10,top:20,width:1400,height:800}),MAP_CENTER);
 samePoint(clientToMap({x:160,y:20},{left:10,top:20,width:1400,height:800}),{x:0,y:0});
 // A narrow mobile container leaves vertical margins.
 samePoint(clientToMap({x:206.5,y:320},{left:10,top:20,width:393,height:600}),MAP_CENTER);
});
test('overlay sizing converts CSS pixels independently of the geographic zoom',()=>{
 for(const [width,height] of [[2200,1600],[393,500],[1400,800]]){
  const scale=Math.min(width/1100,height/800);near(11*unitsPerPixel(width,height)*scale,11);
 }
});
test('zooming in then back out at the same cursor does not drift',()=>{
 const start={zoom:1.2,pan:{x:-73,y:99}},cursor={x:340,y:535};let view=start;
 for(let i=0;i<5;i++)view=zoomViewAt(view,view.zoom*1.1,cursor);
 for(let i=0;i<5;i++)view=zoomViewAt(view,view.zoom/1.1,cursor);
 near(view.zoom,start.zoom);samePoint(view.pan,start.pan);
});
