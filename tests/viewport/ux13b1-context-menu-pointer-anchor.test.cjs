'use strict'
const test=require('node:test')
const assert=require('node:assert/strict')
const fs=require('node:fs')
const vm=require('node:vm')

const source=fs.readFileSync('src/js/editor/ContextMenu.js','utf8')
const editorCss=fs.readFileSync('src/css/editor-page.css','utf8')
const W=192,H=170,VIEW={width:1280,height:800},M=8

function node(){const n={children:[],style:{},dataset:{},attrs:{},hidden:true,listeners:{},classList:{add(){}},
  setAttribute(k,v){n.attrs[k]=v},getAttribute(k){return n.attrs[k]??null},addEventListener(t,f){(n.listeners[t]??=[]).push(f)},
  appendChild(c){n.children.push(c);return c},replaceChildren(){n.children=[]},contains(){return false},focus(){},
  getBoundingClientRect(){return {width:W,height:H}},offsetWidth:W,offsetHeight:H};return n}
function load(){
  const document={createElement:node,addEventListener(){},activeElement:null},window={addEventListener(){}}
  vm.runInNewContext(source,{window,document})
  return window.CaderactContextMenu
}
const actions=[{id:'a',label:'A',enabled:true,execute(){}}]
function openAt(x,y){const api=load(),el=node(),menu=api.create({element:el,viewport:()=>VIEW,margin:M})
  const state=menu.open({context:{},actions,x,y});return {left:parseFloat(el.style.left),top:parseFloat(el.style.top),state,el}}

test('UX13-B1 ordinary right-click: menu top-left equals pointer',()=>{
  const r=openAt(300,200);assert.equal(r.left,300);assert.equal(r.top,200)
  assert.equal(r.state.x,300);assert.equal(r.state.y,200)
})
test('UX13-B1 sufficient space never alters pointer alignment (incl. exact-fit edge)',()=>{
  const fit=openAt(VIEW.width-W-M,VIEW.height-H-M);assert.equal(fit.left,VIEW.width-W-M);assert.equal(fit.top,VIEW.height-H-M)
  const near=openAt(M,M);assert.equal(near.left,M);assert.equal(near.top,M)
})
test('UX13-B1 near right edge flips horizontally and stays visible',()=>{
  const r=openAt(VIEW.width-20,200);assert.equal(r.left,VIEW.width-20-W);assert.equal(r.top,200)
  assert.ok(r.left>=M&&r.left+W<=VIEW.width-M)
})
test('UX13-B1 near bottom edge flips vertically and stays visible',()=>{
  const r=openAt(300,VIEW.height-20);assert.equal(r.top,VIEW.height-20-H);assert.equal(r.left,300)
  assert.ok(r.top>=M&&r.top+H<=VIEW.height-M)
})
test('UX13-B1 bottom-right corner handles both axes',()=>{
  const r=openAt(VIEW.width-5,VIEW.height-5);assert.equal(r.left,VIEW.width-W-M);assert.equal(r.top,VIEW.height-H-M)
  const wide=openAt(VIEW.width-30,VIEW.height-30);assert.equal(wide.left,VIEW.width-30-W);assert.equal(wide.top,VIEW.height-30-H)
  assert.ok(r.left+W<=VIEW.width-M&&r.top+H<=VIEW.height-M)
})
test('UX13-B1 tiny viewport still clamps into the safety margin',()=>{
  const a=load().anchor(50,50,W,H,{width:150,height:100},M);assert.equal(a.left,M);assert.equal(a.top,M)
})
test('UX13-B1 positioning writes only left/top on the fixed menu (zero layout shift)',()=>{
  const r=openAt(300,200);assert.deepEqual(Object.keys(r.el.style).sort(),['left','top'])
  assert.match(editorCss,/\.editor-context-menu \{ position: fixed;/)
  assert.doesNotMatch(source,/getBoundingClientRect\(\)\.(left|top)[^;]*x/)
})
