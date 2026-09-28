'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const {browser}=require('../helpers/browser.cjs')

const camera=b=>b.read('({zoom:camera.zoom,panX:camera.panX,panY:camera.panY})')
const firstLayout=b=>b.read('modelReader.layouts()[0].id')
const switchTo=(b,id)=>b.run(id==='model'?'window.caderactLayoutContext.switchToModel()':`window.caderactLayoutContext.switchToLayout(${JSON.stringify(id)})`)

test('PSR1 Model default camera survives Layout auto-fit without horizontal origin drift',async()=>{
  const b=await browser();b.resize(800,600);const before=camera(b),id=firstLayout(b)
  switchTo(b,id);assert.notDeepEqual(camera(b),before);switchTo(b,'model')
  assert.deepEqual(camera(b),before);assert.equal(camera(b).panX,400)
})

test('PSR1 Model pan zoom and their combination restore exactly',async()=>{
  for(const expected of [{zoom:5,panX:173.25,panY:411.5},{zoom:12.5,panX:400,panY:300},{zoom:2.75,panX:-812.125,panY:947.5}]){
    const b=await browser(),id=firstLayout(b);b.run(`camera.zoom=${expected.zoom};camera.panX=${expected.panX};camera.panY=${expected.panY}`)
    switchTo(b,id);switchTo(b,'model');assert.deepEqual(camera(b),expected)
  }
})

test('PSR1 Model Layout1 and Layout2 own isolated editor cameras',async()=>{
  const b=await browser(),layout1=firstLayout(b),created=b.read('window.caderactDocumentSession.layoutGateway.create("Layout2").layout.id')
  const model={zoom:7.25,panX:117,panY:283},one={zoom:1.2,panX:31,panY:492},two={zoom:3.4,panX:-88,panY:205}
  b.run(`camera.zoom=${model.zoom};camera.panX=${model.panX};camera.panY=${model.panY}`);switchTo(b,layout1)
  b.run(`camera.zoom=${one.zoom};camera.panX=${one.panX};camera.panY=${one.panY}`);switchTo(b,created)
  b.run(`camera.zoom=${two.zoom};camera.panX=${two.panX};camera.panY=${two.panY}`);switchTo(b,layout1);assert.deepEqual(camera(b),one)
  switchTo(b,created);assert.deepEqual(camera(b),two);switchTo(b,'model');assert.deepEqual(camera(b),model)
})

test('PSR1 repeated switching produces no camera drift',async()=>{
  const b=await browser(),id=firstLayout(b),expected={zoom:9.125,panX:333.25,panY:-71.75}
  b.run(`camera.zoom=${expected.zoom};camera.panX=${expected.panX};camera.panY=${expected.panY}`)
  for(let index=0;index<20;index++){switchTo(b,id);switchTo(b,'model');assert.deepEqual(camera(b),expected)}
})

test('PSR1 document replacement discards every prior document camera',async()=>{
  const b=await browser();b.resize(800,600);const id=firstLayout(b);b.run('camera.zoom=18;camera.panX=-900;camera.panY=1200');switchTo(b,id);b.run('camera.zoom=.7;camera.panX=12;camera.panY=14')
  b.run('window.caderactDocumentSession.replaceStore(window.CaderactDocument.createStore({initiallySaved:true}),{reason:"psr1"})')
  assert.deepEqual(camera(b),{zoom:5,panX:400,panY:300});assert.equal(b.read('window.caderactLayoutContext.snapshot().kind'),'model')
})

test('PSR1 context navigation is editor-only and leaves history revision and dirty state unchanged',async()=>{
  const b=await browser(),id=firstLayout(b),before=b.read('({revision:documentController.currentRevision,history:documentController.historyInfo,dirty:documentController.isDirty})')
  b.run('camera.zoom=6.5;camera.panX=231;camera.panY=119');switchTo(b,id);switchTo(b,'model')
  assert.deepEqual(b.read('({revision:documentController.currentRevision,history:documentController.historyInfo,dirty:documentController.isDirty})'),before)
})
