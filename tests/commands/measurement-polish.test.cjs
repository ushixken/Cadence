const test=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('../helpers/browser.cjs');

const inventory={Distance:['DI','DIST'],Length:['LEN'],Radius:['RAD'],Diameter:['DIA'],Area:[],Perimeter:['PERIM'],Angle:['ANG'],DistanceObject:['DOBJ'],MinDist:[],DistanceSum:['DSUM']};

test('ME5 measurement command inventory is conflict-free and canonical',async()=>{
  const b=await browser();
  for(const [name,aliases] of Object.entries(inventory))for(const token of [name,...aliases])assert.equal(b.read(`window.caderactCommandRegistry.resolve(${JSON.stringify(token)}).name`),name);
  assert.equal(b.read(`new Set(window.caderactCommandRegistry.commands().flatMap(command=>[command.name,...command.aliases].map(value=>value.toLowerCase()))).size`),b.read(`window.caderactCommandRegistry.commands().reduce((count,command)=>count+1+command.aliases.length,0)`));
});

test('Tools exposes one accessible Measure group routed through the command router',async()=>{
  const b=await browser(),trigger=b.toolsMenuTrigger,dropdown=b.measureMenuDropdown;
  b.emit(trigger,'click');assert.equal(dropdown.hidden,false);assert.equal(trigger.getAttribute('aria-expanded'),'true');
  const items=dropdown.querySelectorAll('[data-measure-command]');assert.deepEqual(items.map(item=>item.textContent),['Distance','Length','Radius','Diameter','Area','Perimeter','Angle','Distance to Object','Minimum Distance','Cumulative Distance']);
  b.emit(items[0],'click');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Distance');assert.equal(dropdown.hidden,true);
});

test('ME5 format authority distinguishes linear, squared, and angular results',async()=>{
  const b=await browser();
  const values=b.read(`(()=>{const circle=window.CaderactMeasurement.measureRecord(recordGateway.createCircle({x:0,y:0},2));return {area:window.CaderactMeasurement.formatObject(circle,'area','mm').summary,length:window.CaderactMeasurement.formatObject(circle,'circumference','mm').summary,angle:window.CaderactMeasurement.measureIncludedAngle({x:1,y:0},{x:0,y:0},{x:0,y:1}).angleDegrees}})()`);
  assert.match(values.area,/mm²/);assert.doesNotMatch(values.length,/mm²/);assert.equal(values.angle,90);
});

test('ME5 moderate Polyline distance sanity remains finite and document-free',async()=>{
  const b=await browser(),before=b.read('({revision:documentController.currentRevision,history:documentController.historyInfo,dirty:documentController.isDirty,count:modelReader.records().length})');
  const result=b.read(`(()=>{const vertices=Array.from({length:120},(_,index)=>({x:index,y:Math.sin(index/8)*10})),a=recordGateway.createPolyline(vertices,false),c=recordGateway.createPolyline(vertices.map(point=>({x:point.x,y:point.y+20})),false);return window.CaderactMeasurement.measureRecordToRecord(a,c)})()`);
  assert.equal(result.valid,true);assert.equal(Number.isFinite(result.distance),true);assert.deepEqual(b.read('({revision:documentController.currentRevision,history:documentController.historyInfo,dirty:documentController.isDirty,count:modelReader.records().length})'),before);
});
