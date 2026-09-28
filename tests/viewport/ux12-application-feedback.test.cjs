'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const {browser}=require('../helpers/browser.cjs')

const state=b=>b.read('({revision:documentController.currentRevision,history:documentController.historyInfo.entryCount,dirty:documentController.isDirty})')

test('UX12 notification severity is explicit, accessible, and does not steal focus',async()=>{
  const b=await browser(),before=state(b);b.input.focus()
  b.run(`window.caderactApplicationFeedback.notify('Saved',{severity:'success'});window.caderactApplicationFeedback.notify('Check geometry',{severity:'warning'});window.caderactApplicationFeedback.notify('Export failed',{severity:'error'})`)
  assert.equal(b.document.activeElement,b.input)
  assert.deepEqual(b.read(`document.querySelector('#application-feedback').children.map(item=>({severity:[...item.classes].find(name=>name.startsWith('is-')),role:item.attributes.role,label:item.children[0].textContent,message:item.children[1].textContent}))`),[
    {severity:'is-success',role:'status',label:'Success',message:'Saved'},
    {severity:'is-warning',role:'status',label:'Warning',message:'Check geometry'},
    {severity:'is-error',role:'alert',label:'Error',message:'Export failed'},
  ])
  assert.deepEqual(state(b),before)
})

test('UX12 stack is bounded and dismissal timers are deterministic',async()=>{
  const b=await browser();b.run(`for(const message of ['one','two','three','four'])window.caderactApplicationFeedback.notify(message,{duration:1000})`)
  assert.deepEqual(b.read(`window.caderactApplicationFeedback.entries.map(entry=>entry.message)`),['two','three','four'])
  const id=b.read('window.caderactApplicationFeedback.entries[1].id');assert.equal(b.run(`window.caderactApplicationFeedback.dismiss(${id})`),true)
  assert.deepEqual(b.read(`window.caderactApplicationFeedback.entries.map(entry=>entry.message)`),['two','four'])
  b.advance(1000);assert.deepEqual(b.read('window.caderactApplicationFeedback.entries'),[])
})

test('UX12 optional action is explicit and notification-only',async()=>{
  const b=await browser(),before=state(b);b.run(`window.__acted=0;window.caderactApplicationFeedback.notify('Retry available',{action:{label:'Retry',run:()=>window.__acted++},duration:0})`)
  b.emit(b.document.querySelector('#application-feedback').children[0].children[2],'click')
  assert.equal(b.read('window.__acted'),1);assert.deepEqual(b.read('window.caderactApplicationFeedback.entries'),[]);assert.deepEqual(state(b),before)
})

test('UX12 DXF results route to application feedback while command prompts stay authoritative',async()=>{
  const b=await browser();b.launch('Line');const prompt=b.read('window.caderactFeedback.activePrompt')
  b.run(`window.caderactApplicationFeedback.presentResult({status:'dxf-open-completed',diagnostics:[{severity:'warning',count:2}]})`)
  assert.equal(b.read('window.caderactApplicationFeedback.entries[0].severity'),'warning')
  assert.match(b.read('window.caderactApplicationFeedback.entries[0].message'),/2 warnings/)
  assert.equal(b.read('window.caderactFeedback.activePrompt'),prompt)
})

test('UX12 visual contract uses theme tokens and responsive containment',()=>{
  const css=fs.readFileSync('src/css/application-shell.css','utf8'),html=fs.readFileSync('index.html','utf8')
  assert.match(html,/id="application-feedback"[^>]*aria-live="polite"/)
  assert.match(css,/\.application-feedback\{[^}]*width:min\(340px,calc\(100vw - 24px\)\)[^}]*max-height:calc\(100vh - 116px\)/s)
  assert.match(css,/\.application-notice\{[^}]*background:var\(--surface-popup\)[^}]*border-left:3px solid var\(--status-info\)/s)
  assert.match(css,/@media\(max-width:800px\)\{\.application-feedback\{/)
})

test('UX12 routing keeps command, inline, dialog, and file-safety authorities specialized',()=>{
  const command=fs.readFileSync('src/js/editor/CommandFeedback.js','utf8'),settings=fs.readFileSync('src/js/editor/settings-panel.js','utf8'),safety=fs.readFileSync('src/js/editor/FileSafetyUx.js','utf8'),files=fs.readFileSync('src/js/editor/file-actions.js','utf8')
  assert.match(command,/invalid-input/);assert.match(settings,/settings-contrast-warning|contrast/);assert.match(safety,/requestUnsaved/);assert.match(files,/caderactFileSafetyUx\?\.presentOutcome/);assert.match(files,/caderactApplicationFeedback\?\.presentResult/)
})
