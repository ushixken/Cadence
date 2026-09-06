'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {browser}=require('../helpers/browser.cjs');

test('Circle scene keeps exact semantic center/radius across zoom and DPR for preview and committed geometry',async()=>{
  const b=await browser();
  for(const [zoom,dpr] of [[.25,1],[1,1.25],[5,1.5],[100,2]]){
    b.run(`camera.zoom=${zoom};window.devicePixelRatio=${dpr};activeSnapResult=null`);b.launch('Circle');b.input.value='2,3';b.emit(b.input,'input');b.key('Enter',b.input);b.point(450,250,'pointermove');b.flush();
    const preview=b.renders.at(-1).circleOverlay.preview[0];assert.equal(preview.center.x,400+2*zoom);assert.equal(preview.center.y,300-3*zoom);assert.ok(preview.radius>0);
    b.key('Escape');
  }
  b.run('recordGateway.createAll([recordGateway.createCircle({x:2,y:3},7)])');b.flush();const circle=b.renders.at(-1).circleOverlay.committed[0];assert.equal(circle.radius,700);
});

test('Canvas2D uses native arcs and WebGPU uses bounded adaptive shared tessellation',async()=>{
  const b=await browser({realRenderer:true});const lineGroup={color:'#fff',colorData:[1,1,1,1],lineWidth:1,segments:new Float32Array()};
  const circleGroup={color:'#fff',colorData:[1,1,1,1],lineWidth:1,circles:[{center:{x:20,y:25},radius:10}]};
  const scene={width:100,height:50,deviceScale:1,backgroundColor:'#000',backgroundColorData:[0,0,0,1],lineGroups:[lineGroup],drawGroups:[{lineGroup,circleGroup}]};
  new b.window.CaderactCanvas2DRenderer(b.canvas).render(scene);assert.deepEqual(b.drawCalls.find(call=>call[0]==='arc'),['arc',20,25,10,0,Math.PI*2]);

  b.context.GPUBufferUsage={UNIFORM:1,COPY_DST:2,VERTEX:4};b.load('src/js/rendering/WebGPURenderer.js');let drawn=0;
  const pass={setPipeline(){},setBindGroup(){},setVertexBuffer(){},draw(count){drawn=count},end(){}};
  const device={lost:new Promise(()=>{}),createBuffer:()=>({destroy(){}}),createShaderModule:()=>({}),createRenderPipeline:()=>({getBindGroupLayout:()=>({})}),createBindGroup:()=>({}),createCommandEncoder:()=>({beginRenderPass:()=>pass,finish:()=>({})}),queue:{writeBuffer(){},submit(){}}};
  const context={configure(){},getCurrentTexture:()=>({createView:()=>({})})};new b.window.CaderactWebGPURenderer({}, {}, device, context, 'test', ()=>{}).render(scene);
  const count=b.window.CaderactCircleTessellation.segmentCount(10);assert.equal(drawn,count*2);assert.ok(count>=24&&count<=1024);
  assert.ok(b.window.CaderactCircleTessellation.segmentCount(1000)>count);assert.equal(b.window.CaderactCircleTessellation.segmentCount(1e12),1024);
});
