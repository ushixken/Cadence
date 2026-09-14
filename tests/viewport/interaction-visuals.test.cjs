const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { browser, settle } = require('../helpers/browser.cjs');

test('CAD cursor enters, follows raw CSS-pixel pointer position, and leaves the viewport', async () => {
  const b = await browser();
  assert.equal(b.viewportHost.children.filter(child => child.classList.contains('cad-cursor-overlay')).length, 1);
  assert.deepEqual(b.read('window.caderactViewport.getInteractionVisualState()'), {
    visible:false,x:0,y:0,mode:'select',snapAcquired:false,available:true,navigating:false,
  });
  b.point(123.25, 234.5, 'pointerenter');
  assert.deepEqual(b.read('window.caderactViewport.getInteractionVisualState()'), {
    visible:true,x:133.25,y:244.5,mode:'select',snapAcquired:false,available:true,navigating:false,
  });
  assert.equal(b.viewportHost.children[0].style.left, '133.25px');
  assert.equal(b.viewportHost.children[0].style.top, '244.5px');
  b.point(123.25, 234.5, 'pointerleave');
  assert.equal(b.read('window.caderactViewport.getInteractionVisualState().visible'), false);
});

test('point-command CAD crosshair joins D2 preview and marker at the snapped point', async () => {
  const b = await browser();
  b.launch(); b.point(400, 300);
  b.point(403, 303, 'pointermove');
  const state = b.read('window.caderactViewport.getInteractionVisualState()');
  assert.deepEqual({x:state.x,y:state.y,mode:state.mode,snapAcquired:state.snapAcquired}, {x:410,y:310,mode:'point',snapAcquired:true});
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().end'), {x:0,y:0});
  assert.deepEqual(b.read('activeSnapResult.point'), {x:0,y:0});
});

test('navigation uses its system cursor state without changing command or selection ownership', async () => {
  const b = await browser();
  b.point(100, 100, 'pointerenter');
  b.key(' ', b.canvas);
  assert.equal(b.read('window.caderactViewport.getInteractionVisualState().visible'), false);
  b.emit(b.window, 'keyup', {key:' ', code:'Space'});
  assert.equal(b.read('window.caderactViewport.getInteractionVisualState().visible'), true);
  b.point(100, 100, 'pointerdown', {button:1});
  b.point(110, 100, 'pointermove', {button:1});
  assert.equal(b.read('window.caderactViewport.getInteractionVisualState().visible'), false);
  b.point(110, 100, 'pointerup', {button:1});
  assert.equal(b.read('window.caderactViewport.getInteractionVisualState().visible'), true);
  assert.equal(b.read('window.caderactCommandRouter.isActive'), false);
  assert.deepEqual(b.read('window.caderactSelection.selectedIds()'), []);
});

test('cursor has fixed CSS geometry across DPR/resize and document replacement clears stale state', async () => {
  const css = fs.readFileSync('src/css/editor-page.css', 'utf8');
  assert.match(css, /\.cad-cursor-overlay[\s\S]*?width: 32px; height: 32px;/);
  assert.match(css, /transform: translate\(-50%, -50%\)/);
  assert.match(css, /\.cad-cursor-pickbox[^}]*box-sizing: border-box;[^}]*width: 7px;[^}]*height: 7px;/);
  const b = await browser();
  for (const [dpr, point] of [[1,[200,150]],[1.25,[200.25,150.75]],[1.5,[201,151]],[2,[201.5,151.5]]]) {
    b.resize(640, 480, dpr);
    assert.equal(b.read('window.caderactViewport.getInteractionVisualState().visible'), false);
    b.point(point[0], point[1], 'pointermove');
    assert.deepEqual(b.read('(({x,y})=>({x,y}))(window.caderactViewport.getInteractionVisualState())'), {x:point[0]+10,y:point[1]+10});
  }
  b.run('window.caderactViewport.resetForDocumentReplacement()');
  assert.equal(b.read('window.caderactViewport.getInteractionVisualState().visible'), false);
});

test('crosshair, bordered pickbox, and center point are symmetric around the exact overlay origin', () => {
  const css = fs.readFileSync('src/css/editor-page.css', 'utf8');
  function rule(selector) { return css.match(new RegExp(`${selector} \\{([^}]*)\\}`))[1]; }
  function px(body, property) { return Number(body.match(new RegExp(`${property}: ([\\d.]+)px`))[1]); }
  const root = rule('\\.cad-cursor-overlay');
  const left = rule('\\.cad-cursor-arm\\.is-left');
  const right = rule('\\.cad-cursor-arm\\.is-right');
  const top = rule('\\.cad-cursor-arm\\.is-top');
  const bottom = rule('\\.cad-cursor-arm\\.is-bottom');
  const pickbox = rule('\\.cad-cursor-pickbox');
  const center = rule('\\.cad-cursor-center');
  const rootCenter = px(root, 'width') / 2;
  assert.equal(px(root, 'height') / 2, rootCenter);
  assert.equal(px(left, 'top') + px(left, 'height') / 2, rootCenter);
  assert.equal(px(right, 'top') + px(right, 'height') / 2, rootCenter);
  assert.equal(px(top, 'left') + px(top, 'width') / 2, rootCenter);
  assert.equal(px(bottom, 'left') + px(bottom, 'width') / 2, rootCenter);
  assert.equal(px(left, 'left') + px(left, 'width'), px(pickbox, 'left'));
  assert.equal(px(right, 'left'), px(pickbox, 'left') + px(pickbox, 'width'));
  assert.equal(px(top, 'top') + px(top, 'height'), px(pickbox, 'top'));
  assert.equal(px(bottom, 'top'), px(pickbox, 'top') + px(pickbox, 'height'));
  assert.equal(px(left, 'width'), px(right, 'width'));
  assert.equal(px(top, 'height'), px(bottom, 'height'));
  assert.equal(px(pickbox, 'left') + px(pickbox, 'width') / 2, rootCenter);
  assert.equal(px(pickbox, 'top') + px(pickbox, 'height') / 2, rootCenter);
  assert.equal(px(center, 'left') + px(center, 'width') / 2, rootCenter);
  assert.equal(px(center, 'top') + px(center, 'height') / 2, rootCenter);
});

test('renderer replacement reuses one overlay and terminal failure restores system fallback', async () => {
  const b = await browser();
  b.window.createCaderactRenderer = async () => ({kind:'canvas2d',render(){},resize(){}});
  b.fakeRenderer.onDeviceLost(); await settle();
  assert.equal(b.viewportHost.children.filter(child => child.classList.contains('cad-cursor-overlay')).length, 1);
  b.point(80, 90, 'pointermove');
  b.run('failRenderer(new Error("terminal"), renderer)');
  assert.deepEqual(b.read('(({visible,available})=>({visible,available}))(window.caderactViewport.getInteractionVisualState())'), {visible:false,available:false});
  assert.equal(b.viewportHost.classList.contains('cad-cursor-enabled'), false);
});
