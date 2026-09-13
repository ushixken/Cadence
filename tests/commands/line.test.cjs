'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser } = require('../helpers/browser.cjs');

const persistentState = b => b.read(`({
  objects: modelReader.snapshot().geometry.objects,
  revision: documentController.currentRevision,
  stateId: documentController.currentStateId,
  history: documentController.historyInfo,
  savedStateId: documentController.savedStateId,
  savedRevision: documentController.savedRevision,
  dirty: documentController.isDirty
})`);

test('Line start, first point, and accepted draft segments do not mutate persistent state', async () => {
  const b = await browser();
  b.run('window.__lineBaselineToken = documentController.captureStateToken(); documentController.markStateSaved(window.__lineBaselineToken)');
  const before = persistentState(b);
  assert.equal(before.dirty, false);
  b.launch();
  assert.deepEqual(persistentState(b), before);
  b.point(400, 300);
  assert.equal(b.read('window.caderactFeedback.activePrompt'), 'Line: Specify next point');
  assert.deepEqual(persistentState(b), before);
  b.point(450, 300); b.point(450, 250); b.point(500, 250);
  assert.deepEqual(persistentState(b), before);
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.segmentCount'), 3);
  assert.equal(b.read('documentController.hasOpenTransaction'), false);
  assert.equal(b.run('Object.isFrozen(window.caderactCommandRouter.activeSession.draft.draftSegments())'), true);
  assert.equal(b.run('Object.isFrozen(window.caderactCommandRouter.activeSession.draft.draftSegments()[0].start)'), true);
});
test('accepted draft segments and rubber-band preview render only in the transient overlay', async () => {
  const b = await browser(); b.launch(); b.point(400, 300);
  for (const x of [420, 430, 450]) {
    b.point(x, 250, 'pointermove'); b.flush();
    assert.equal(b.renders.at(-1).lineGroups[5].segments.length, 0);
    assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[6].segments), [400, 300, x, 250]);
    assert.equal(b.read('modelReader.lines().length'), 0);
  }
  b.point(450, 250); b.point(500, 200, 'pointermove'); b.flush();
  assert.equal(b.renders.at(-1).lineGroups[4].segments.length, 0);
  assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[5].segments), [400, 300, 450, 250]);
  assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[6].segments), [450, 250, 500, 200]);
  b.emit(b.canvas, 'pointerleave'); b.flush();
  assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[5].segments), [400, 300, 450, 250]);
  assert.equal(b.renders.at(-1).lineGroups[6].segments.length, 0);
  assert.equal(b.read('modelReader.lines().length'), 0);
});

test('Enter publishes a multi-segment Line once and one A4 Undo/Redo restores exact records', async () => {
  const b = await browser();
  b.run('window.__existingLine = recordGateway.createLine({x:-5,y:-6},{x:-7,y:-8}); recordGateway.createAll([window.__existingLine])');
  const beforeStateId = b.read('documentController.currentStateId');
  const historyBefore = b.read('documentController.historyInfo.cursor');
  b.launch();
  for (const point of [[400, 300], [450, 300], [450, 250], [500, 250]]) b.point(...point);
  const draft = b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()');
  assert.equal(draft.length, 3);
  b.key('Enter'); b.flush();
  assert.deepEqual(b.read('modelReader.lines().slice(1)'), draft);
  assert.equal(b.read('documentController.currentRevision'), 2);
  assert.equal(b.read('documentController.historyInfo.cursor'), historyBefore + 1);
  const committedStateId = b.read('documentController.currentStateId');
  assert.notEqual(committedStateId, beforeStateId);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);
  assert.equal(b.renders.at(-1).lineGroups[4].segments.length, 16);
  assert.equal(b.renders.at(-1).lineGroups[5].segments.length, 0);

  assert.equal(b.run('documentController.undo()').status, 'undone');
  assert.deepEqual(b.read('modelReader.lines()'), b.read('[window.__existingLine]'));
  assert.equal(b.read('documentController.currentStateId'), beforeStateId);
  assert.equal(b.run('documentController.redo()').status, 'redone');
  assert.deepEqual(b.read('modelReader.lines().slice(1)'), draft);
  assert.equal(b.read('documentController.currentStateId'), committedStateId);
});

test('Line Close appears at three distinct points and atomically publishes independent closing Lines', async () => {
  const b=await browser();const beforeHistory=b.read('documentController.historyInfo.entryCount');b.launch();typed(b,'0,0');typed(b,'10,0');
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.options'),[]);typed(b,'10,10');assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.options'),[{id:'close',label:'Close',value:'',showValue:false,enabled:true}]);
  const draft=b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()');const close=b.commandPrompt.children.find(child=>child.dataset.optionId==='close');assert.equal(close.textContent,'Close');b.emit(close,'click');
  const records=b.read('modelReader.records()');assert.equal(records.length,3);assert.ok(records.every(record=>record.type==='line'));assert.ok(draft.every(segment=>records.some(record=>record.id===segment.id)));const closing=records.find(record=>!draft.some(segment=>segment.id===record.id));assert.deepEqual({x:closing.start.x,y:closing.start.y},{x:10,y:10});assert.deepEqual({x:closing.end.x,y:closing.end.y},{x:0,y:0});assert.equal(b.read('documentController.historyInfo.entryCount'),beforeHistory+1);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);
  b.run('window.caderactHistory.undo()');assert.equal(b.read('modelReader.records().length'),0);b.run('window.caderactHistory.redo()');assert.deepEqual(b.read('modelReader.records()'),records)
});

test('Line Close availability follows Step Undo and a naturally accepted return to P1 is not duplicated', async () => {
  const b=await browser();b.launch();for(const point of ['0,0','10,0','10,10'])typed(b,point);assert.equal(b.read('window.caderactCommandRouter.activeSession.options.length'),1);b.window.caderactViewport.stepUndoActiveCommand();assert.equal(b.read('window.caderactCommandRouter.activeSession.options.length'),0);typed(b,'10,10');typed(b,'0,0');const count=b.read('window.caderactCommandRouter.activeSession.draft.segmentCount');assert.equal(count,3);b.run('window.caderactCommandRouter.activateOption("close")');assert.equal(b.read('modelReader.lines().length'),3);assert.equal(b.read('modelReader.lines().filter((line,index,all)=>all.findIndex(other=>other.start.x===line.start.x&&other.start.y===line.start.y&&other.end.x===line.end.x&&other.end.y===line.end.y)===index).length'),3)
});

test('clicking the hover-snapped starting draft point closes and completes Line', async () => {
  const b = await browser();
  const historyBefore = b.read('documentController.historyInfo.entryCount');
  b.launch();
  b.point(400, 300); b.point(450, 300); b.point(450, 250);
  b.point(402, 301, 'pointermove');
  assert.equal(b.read('activeSnapResult.kind'), 'draft-point');
  assert.deepEqual(b.read('activeSnapResult.reference'), { kind: 'draft-point', index: 0 });
  b.point(402, 301);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);
  assert.equal(b.read('modelReader.lines().length'), 3);
  assert.deepEqual(b.read('modelReader.lines().map(line => ({ start: { x: line.start.x, y: line.start.y }, end: { x: line.end.x, y: line.end.y }}))'), [
    { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } },
    { start: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
    { start: { x: 10, y: 10 }, end: { x: 0, y: 0 } },
  ]);
  assert.equal(b.read('documentController.historyInfo.entryCount'), historyBefore + 1);
});

test('Line closes from any resolved accepted point equal to P1, while hover does not close', async () => {
  const b = await browser();
  // Endpoint priority beats the draft point at P1; equality of the resolved
  // accepted coordinate, not snap kind, must still trigger closure.
  b.run('recordGateway.createAll([recordGateway.createLine({x:0,y:0},{x:-10,y:0})])');
  b.launch(); b.point(400, 300); b.point(450, 300); b.point(450, 250);
  b.point(402, 301, 'pointermove');
  assert.equal(b.read('activeSnapResult.kind'), 'endpoint');
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Line'); // hover only
  b.point(402, 301);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);
  assert.equal(b.read('modelReader.lines().length'), 4); // existing line + closed chain
});

test('Line Close failure preserves its prepared closing segment and retries without duplication', async () => {
  const b=await browser();b.launch();for(const point of ['0,0','10,0','10,10'])typed(b,point);b.run('window.__conflict=window.caderactCommandRouter.activeSession.draft.draftSegments()[0];recordGateway.createAll([window.__conflict])');const history=b.read('documentController.historyInfo.entryCount');b.run('window.caderactCommandRouter.activateOption("close")');assert.equal(b.read('window.caderactCommandRouter.activeCommand'),'Line');assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.segmentCount'),3);assert.equal(b.read('documentController.historyInfo.entryCount'),history);b.run('documentController.undo()');b.run('window.caderactCommandRouter.activateOption("close")');assert.equal(b.read('modelReader.lines().length'),3);assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null)
});

test('Escape discards several draft segments without changing document or A4 history', async () => {
  const b = await browser(); const before = persistentState(b);
  b.launch(); for (const x of [100, 150, 200, 250]) b.point(x, 100);
  const allocatedIds = b.read('window.caderactCommandRouter.activeSession.draft.draftSegments().map(line => line.id)');
  assert.equal(allocatedIds.length, 3);
  b.key('Escape'); b.flush();
  assert.deepEqual(persistentState(b), before);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);
  assert.equal(b.renders.at(-1).lineGroups[5].segments.length, 0);
});

test('Line Step Undo walks draft segments backward without invoking document Undo', async () => {
  const b = await browser(); const before = persistentState(b);
  b.launch(); for (const x of [400, 450, 500, 550]) b.point(x, 300);
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.segmentCount'), 3);
  for (const [expected, endpointX] of [[2, 20], [1, 10], [0, 0]]) {
    assert.equal(b.window.caderactViewport.stepUndoActiveCommand().status, 'step-undone');
    assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.segmentCount'), expected);
    assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.preview().start.x'), endpointX);
    assert.deepEqual(persistentState(b), before);
    b.flush();
    assert.equal(b.renders.at(-1).lineGroups[5].segments.length, expected * 4);
    assert.equal(b.renders.at(-1).lineGroups[6].segments.length, 4);
  }
  assert.equal(b.window.caderactViewport.stepUndoActiveCommand().status, 'no-step');
  assert.deepEqual(persistentState(b), before);
  b.point(475, 250, 'pointermove'); b.flush();
  assert.equal(b.renders.at(-1).lineGroups[5].segments.length, 0);
  assert.deepEqual(Array.from(b.renders.at(-1).lineGroups[6].segments), [400, 300, 475, 250]);
});

test('a failed final commit is atomic and preserves the active draft for retry', async () => {
  const b = await browser(); b.launch(); b.point(400, 300); b.point(450, 250);
  const draft = b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()'); const before = persistentState(b);
  // Publish a conflicting record ID before Line finishes. Line can acquire its
  // short lease, but staging fails and its transaction must roll back cleanly.
  b.run('window.__conflict = window.caderactCommandRouter.activeSession.draft.draftSegments()[0]; recordGateway.createAll([window.__conflict])');
  const beforeFailure = persistentState(b);
  b.key('Enter'); b.flush();
  assert.deepEqual(persistentState(b), beforeFailure);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Line');
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()'), draft);
  assert.equal(b.read('documentController.hasOpenTransaction'), false);
  assert.notDeepEqual(beforeFailure, before);
  b.run('documentController.undo()');
  b.key('Enter');
  assert.deepEqual(b.read('modelReader.lines()'), draft);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);

  // A later failed session can also be cancelled without leaking its draft.
  b.launch(); b.point(500, 300); b.point(550, 250);
  b.run('window.__cancelConflict = window.caderactCommandRouter.activeSession.draft.draftSegments()[0]; recordGateway.createAll([window.__cancelConflict])');
  b.key('Enter');
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Line');
  b.key('Escape');
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);
  b.launch();
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.segmentCount'), 0);
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.hasFirstPoint'), false);
});

test('Step Undo back to the first point then Enter publishes nothing', async () => {
  const b = await browser(); const before = persistentState(b);
  b.launch(); b.point(400, 300); b.point(450, 300);
  assert.equal(b.window.caderactViewport.stepUndoActiveCommand().status, 'step-undone');
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.segmentCount'), 0);
  b.key('Enter');
  assert.deepEqual(persistentState(b), before);
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);
});

test('starting Line while Line is active preserves the current session', async () => {
  const b = await browser(); b.launch(); b.point(100, 100); b.point(150, 150);
  const existingId = b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()[0].id');
  const relaunch = b.window.caderactViewport.startLineCommand();
  assert.equal(relaunch.status, 'command-active'); assert.equal(relaunch.command, 'Line');
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.segmentCount'), 1);
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()[0].id'), existingId);
  assert.equal(b.read('modelReader.lines().length'), 0);
});

for (const key of ['Enter', 'Escape']) for (const firstPoint of [false, true]) {
  test(`${key} with ${firstPoint ? 'first point only' : 'empty session'} exits without publication`, async () => {
    const b = await browser(); const before = persistentState(b); b.launch();
    if (firstPoint) { b.point(100, 200); b.point(150, 250, 'pointermove'); }
    b.key(key); b.flush();
    assert.deepEqual(persistentState(b), before);
    assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);
    assert.equal(b.renders.at(-1).lineGroups[5].segments.length, 0);
  });
}

function typed(b, value) {
  b.input.value = value;
  b.emit(b.input, 'input');
  b.key('Enter', b.input);
}

test('Line draft accepted point markers appear progressively and are immutable', async () => {
  const b = await browser();
  b.launch();
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints()'), []);
  b.flush();
  assert.equal(b.renders.at(-1).draftPointOverlay.points.length, 0);
  assert.equal(b.renders.at(-1).lineGroups[11].segments.length, 0);

  // P1
  b.point(400, 300);
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints()'), [{ x: 0, y: 0 }]);
  assert.equal(b.run('Object.isFrozen(window.caderactCommandRouter.activeSession.draft.acceptedPoints())'), true);
  assert.equal(b.run('Object.isFrozen(window.caderactCommandRouter.activeSession.draft.acceptedPoints()[0])'), true);
  b.flush();
  let overlay = b.renders.at(-1).draftPointOverlay;
  assert.equal(overlay.points.length, 1);
  assert.equal(overlay.points[0].point.x, 400);
  assert.equal(overlay.points[0].point.y, 300);
  assert.equal(b.renders.at(-1).lineGroups[11].segments.length, 16); // 4 segments * 4 coords = 16

  // P2
  b.point(450, 250);
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints()'), [{ x: 0, y: 0 }, { x: 10, y: 10 }]);
  b.flush();
  overlay = b.renders.at(-1).draftPointOverlay;
  assert.equal(overlay.points.length, 2);
  assert.equal(overlay.points[0].point.x, 400);
  assert.equal(overlay.points[0].point.y, 300);
  assert.equal(overlay.points[1].point.x, 450);
  assert.equal(overlay.points[1].point.y, 250);
  assert.equal(b.renders.at(-1).lineGroups[11].segments.length, 32);

  // P3
  b.point(500, 200);
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints()'), [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 }]);
  b.flush();
  overlay = b.renders.at(-1).draftPointOverlay;
  assert.equal(overlay.points.length, 3);
  assert.equal(overlay.points[2].point.x, 500);
  assert.equal(overlay.points[2].point.y, 200);
  assert.equal(b.renders.at(-1).lineGroups[11].segments.length, 48);

  // P4, P5, P6
  b.point(550, 200);
  b.point(550, 250);
  b.point(600, 300);
  b.flush();
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints().length'), 6);
  assert.equal(b.renders.at(-1).draftPointOverlay.points.length, 6);
  assert.equal(b.renders.at(-1).lineGroups[11].segments.length, 96);
});

test('draft point markers stay exactly aligned with world projection across zoom, DPR, and coordinates', async () => {
  const b = await browser();
  b.launch();
  // Points with fractional and negative coordinates
  const worldPoints = [
    { x: -12.375, y: 45.625 },
    { x: 0, y: 0 },
    { x: 78.125, y: -23.875 },
  ];
  for (const wp of worldPoints) {
    typed(b, `${wp.x},${wp.y}`);
  }
  b.flush();

  for (const [zoom, panX, panY, dpr] of [
    [1, 400, 300, 1],
    [2.5, 420.5, 280.25, 1.25],
    [0.5, 100, 50, 1.5],
    [8, -500, 1200, 2],
  ]) {
    b.run(`camera.zoom=${zoom};camera.panX=${panX};camera.panY=${panY};window.devicePixelRatio=${dpr}`);
    const scene = b.run('createScene()');
    const overlay = scene.draftPointOverlay;
    assert.equal(overlay.points.length, 3);

    for (let i = 0; i < worldPoints.length; i++) {
      const wp = worldPoints[i];
      const expectedScreen = { x: panX + wp.x * zoom, y: panY - wp.y * zoom };
      assert.equal(Math.abs(overlay.points[i].point.x - expectedScreen.x) < 1e-4, true);
      assert.equal(Math.abs(overlay.points[i].point.y - expectedScreen.y) < 1e-4, true);

      // Verify the 4 segments forming the marker square (size = 3, 4 segments * 4 coords = 16)
      const baseIdx = i * 16;
      const segs = overlay.segments.slice(baseIdx, baseIdx + 16);
      // seg 0: top edge (x - 3, y - 3) to (x + 3, y - 3)
      assert.equal(Math.abs(segs[0] - (expectedScreen.x - 3)) < 1e-4, true);
      assert.equal(Math.abs(segs[1] - (expectedScreen.y - 3)) < 1e-4, true);
      assert.equal(Math.abs(segs[2] - (expectedScreen.x + 3)) < 1e-4, true);
      assert.equal(Math.abs(segs[3] - (expectedScreen.y - 3)) < 1e-4, true);
    }
  }
});

test('adjacent segment continuity holds at world coordinate level and screen projection', async () => {
  const b = await browser();
  b.launch();
  typed(b, '-10.5,15.25');
  typed(b, '20.75,35.5');
  typed(b, '45.125,-12.375');
  typed(b, '70.0,0.0');

  const draftSegments = b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()');
  assert.equal(draftSegments.length, 3);

  // 1. Structural / Coordinate equality
  for (let i = 0; i < draftSegments.length - 1; i++) {
    const endOfPrev = draftSegments[i].end;
    const startOfNext = draftSegments[i + 1].start;
    assert.equal(endOfPrev.x, startOfNext.x);
    assert.equal(endOfPrev.y, startOfNext.y);
  }

  // 2. Projected screen equality
  b.flush();
  const scene = b.run('createScene()');
  assert.equal(scene.acceptedDraftOverlay.segments.length, 12);
  assert.equal(scene.nextSegmentPreviewOverlay.segments.length, 4);
  const acceptedSegs=Array.from(scene.acceptedDraftOverlay.segments);

  for (let i = 0; i < 2; i++) {
    const endX = acceptedSegs[i * 4 + 2];
    const endY = acceptedSegs[i * 4 + 3];
    const nextStartX = acceptedSegs[(i + 1) * 4];
    const nextStartY = acceptedSegs[(i + 1) * 4 + 1];
    assert.equal(endX, nextStartX);
    assert.equal(endY, nextStartY);
  }

  // 3. Draft point overlay centers match the vertex coordinates
  const overlay = scene.draftPointOverlay;
  assert.equal(overlay.points.length, 4);
  assert.equal(overlay.points[1].point.x, acceptedSegs[2]);
  assert.equal(overlay.points[1].point.y, acceptedSegs[3]);
  assert.equal(overlay.points[2].point.x, acceptedSegs[6]);
  assert.equal(overlay.points[2].point.y, acceptedSegs[7]);
});

test('snapping to grid, endpoint, and midpoint records exact draft point markers', async () => {
  const b = await browser();
  b.emit(b.gridSnapButton, 'click');
  // Create an existing line to snap to: (10, 20) to (30, 20)
  b.run('recordGateway.createAll([recordGateway.createLine({x:10,y:20},{x:30,y:20})])');

  b.launch();
  // 1. Endpoint snap is valid for P1.
  b.point(452, 201);
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints()'), [{ x: 10, y: 20 }]);
  b.flush();
  assert.equal(b.renders.at(-1).draftPointOverlay.points[0].point.x, 450);
  assert.equal(b.renders.at(-1).draftPointOverlay.points[0].point.y, 200);

  // 2. Endpoint snap: point at (10, 20) -> screen (400 + 10 * 5, 300 - 20 * 5) = (450, 200)
  b.point(401, 301);
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints()'), [{ x: 10, y: 20 }, { x: 0, y: 0 }]);
  b.flush();
  assert.equal(b.renders.at(-1).draftPointOverlay.points[1].point.x, 400);
  assert.equal(b.renders.at(-1).draftPointOverlay.points[1].point.y, 300);

  // 3. Midpoint snap: midpoint of (10,20) and (30,20) is (20, 20) -> screen (400 + 20 * 5, 300 - 20 * 5) = (500, 200)
  b.point(499, 201, 'pointermove');
  b.flush();
  assert.equal(b.renders.at(-1).snapOverlay.point.x, 500);
  assert.equal(b.renders.at(-1).snapOverlay.point.y, 200);
  b.point(499,201);
  assert.equal(b.read('window.caderactCommandRouter.activeSession'),null);
});

test('typed coordinates create markers at exact points without snapping interference', async () => {
  const b = await browser();
  b.launch();
  // Typed absolute coordinate
  typed(b, '12.345,67.890');
  // Typed relative coordinate
  typed(b, '@10,-20');

  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints()'), [
    { x: 12.345, y: 67.89 },
    { x: 22.345, y: 47.89 },
  ]);
  b.flush();
  const pts = b.renders.at(-1).draftPointOverlay.points;
  assert.equal(pts.length, 2);
  assert.equal(pts[0].point.x, 400 + 12.345 * 5);
  assert.equal(pts[0].point.y, 300 - 67.89 * 5);
  assert.equal(pts[1].point.x, 400 + 22.345 * 5);
  assert.equal(pts[1].point.y, 300 - 47.89 * 5);
});

test('Step Undo updates accepted points and markers step-by-step', async () => {
  const b = await browser();
  b.launch();
  b.point(400, 300); // P1
  b.point(450, 300); // P2
  b.point(450, 250); // P3
  b.point(500, 250); // P4
  b.flush();
  assert.equal(b.renders.at(-1).draftPointOverlay.points.length, 4);

  // Undo P4
  assert.equal(b.window.caderactViewport.stepUndoActiveCommand().status, 'step-undone');
  b.flush();
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints().length'), 3);
  assert.equal(b.renders.at(-1).draftPointOverlay.points.length, 3);

  // Undo P3
  assert.equal(b.window.caderactViewport.stepUndoActiveCommand().status, 'step-undone');
  b.flush();
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints().length'), 2);
  assert.equal(b.renders.at(-1).draftPointOverlay.points.length, 2);

  // Undo P2 -> back to first point
  assert.equal(b.window.caderactViewport.stepUndoActiveCommand().status, 'step-undone');
  b.flush();
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints().length'), 1);
  assert.equal(b.renders.at(-1).draftPointOverlay.points.length, 1);

  // Further step undo is no-op
  assert.equal(b.window.caderactViewport.stepUndoActiveCommand().status, 'no-step');
  b.flush();
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints().length'), 1);
  assert.equal(b.renders.at(-1).draftPointOverlay.points.length, 1);
});

test('Enter clears markers on success; failed commit preserves markers for retry', async () => {
  const b = await browser();
  b.launch();
  b.point(400, 300);
  b.point(450, 300);
  b.flush();
  assert.equal(b.renders.at(-1).draftPointOverlay.points.length, 2);

  // Inject conflict to fail commit
  b.run('window.__conflict = window.caderactCommandRouter.activeSession.draft.draftSegments()[0]; recordGateway.createAll([window.__conflict])');
  b.key('Enter');
  b.flush();
  // Commit failed -> draft and markers preserved
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Line');
  assert.equal(b.renders.at(-1).draftPointOverlay.points.length, 2);

  // Clear conflict and succeed
  b.run('documentController.undo()');
  b.key('Enter');
  b.flush();
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);
  assert.equal(b.renders.at(-1).draftPointOverlay.points.length, 0);
  assert.equal(b.renders.at(-1).lineGroups[11].segments.length, 0);
});

test('Escape clears markers immediately and fresh Line session starts empty', async () => {
  const b = await browser();
  b.launch();
  b.point(400, 300);
  b.point(450, 300);
  b.point(450, 250);
  b.flush();
  assert.equal(b.renders.at(-1).draftPointOverlay.points.length, 3);

  b.key('Escape');
  b.flush();
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);
  assert.equal(b.renders.at(-1).draftPointOverlay.points.length, 0);
  assert.equal(b.renders.at(-1).lineGroups[11].segments.length, 0);

  // Fresh Line session
  b.launch();
  b.flush();
  assert.equal(b.renders.at(-1).draftPointOverlay.points.length, 0);
  assert.equal(b.renders.at(-1).lineGroups[11].segments.length, 0);
});

test('active Line preview originates strictly at latest accepted point and updates across step undo', async () => {
  const b = await browser();
  b.launch();
  b.point(400, 300); // P1 (0, 0)
  b.point(450, 300); // P2 (10, 0)
  b.point(450, 250); // P3 (10, 10)
  b.point(480, 200, 'pointermove');
  b.flush();

  // Preview start is P3
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().start'), { x: 10, y: 10 });
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.currentPoint'), { x: 10, y: 10 });

  // Step undo back to P2
  b.window.caderactViewport.stepUndoActiveCommand();
  b.point(480, 200, 'pointermove');
  b.flush();

  // Preview start is now P2
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().start'), { x: 10, y: 0 });
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.currentPoint'), { x: 10, y: 0 });
});

test('rubber-band snaps to accepted draft points, including preview origin, and completes when clicking P1', async () => {
  const b = await browser();
  b.launch();
  b.point(400, 300); // P1: (0, 0)
  b.point(450, 300); // P2: (10, 0)
  b.point(450, 250); // P3: (10, 10)
  b.flush();

  // Hover near P3 (the preview origin) -> snaps to P3 with zero-length preview
  b.point(452, 252, 'pointermove');
  b.flush();
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');
  assert.deepEqual(b.read('activeSnapResult?.point'), { x: 10, y: 10 });
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().start'), { x: 10, y: 10 });
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().end'), { x: 10, y: 10 });

  // Hover near P1 (400, 300) -> snaps to draft-point P1
  b.point(403, 302, 'pointermove');
  b.flush();
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');
  assert.deepEqual(b.read('activeSnapResult?.point'), { x: 0, y: 0 });
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().end'), { x: 0, y: 0 });
  assert.equal(b.renders.at(-1).snapOverlay.kind, 'draft-point');
  assert.equal(b.renders.at(-1).snapOverlay.label, 'Draft Point');

  // Hover near P2 (450, 300) -> snaps to draft-point P2
  b.point(448, 298, 'pointermove');
  b.flush();
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');
  assert.deepEqual(b.read('activeSnapResult?.point'), { x: 10, y: 0 });

  // Click while snapped to P1 (400, 300) -> closes and completes the Line command.
  b.point(403, 302, 'pointerdown');
  b.flush();
  const segments = b.read('modelReader.lines()');
  assert.equal(segments.length, 3);
  assert.deepEqual({ x: segments[2].start.x, y: segments[2].start.y }, { x: 10, y: 10 });
  assert.deepEqual({ x: segments[2].end.x, y: segments[2].end.y }, { x: 0, y: 0 });
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);
});

test('Shift preserves snapping while Ortho is off and does not alter Grid toggle', async () => {
  const b = await browser();
  // Create committed line for endpoint/midpoint snap
  b.run('recordGateway.createAll([recordGateway.createLine({ x: 100, y: 100 }, { x: 200, y: 100 })])');
  b.launch();
  b.point(400, 300); // P1 (0, 0)
  b.point(450, 300); // P2 (10, 0)

  // 1. Without shift near P1 -> snaps to draft-point
  b.point(403, 302, 'pointermove');
  b.flush();
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');

  // 2. With shift near P1 -> snap remains active; Shift is reserved for Ortho inversion.
  b.point(403, 302, 'pointermove', { shiftKey: true });
  b.flush();
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');
  // Grid snap button and persistent state unchanged
  assert.equal(b.gridSnapButton.getAttribute('aria-pressed'), 'false');

  // 3. Release shift -> snap restored immediately
  b.point(403, 302, 'pointermove', { shiftKey: false });
  b.flush();
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');

  // 4. Shift also preserves endpoint snap.
  b.point(403, 302, 'pointermove', { shiftKey: true });
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');

  assert.equal(b.gridSnapButton.getAttribute('aria-pressed'), 'false');
});

test('Stationary Shift keydown and keyup triggers dynamic snap re-evaluation and rerender', async () => {
  const b = await browser();
  b.launch();
  b.point(400, 300); // P1 (0, 0)
  b.point(450, 300); // P2 (10, 0)

  // Move pointer near P1 without shift -> snapped
  b.point(402, 302, 'pointermove');
  b.flush();
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');
  assert.notEqual(b.renders.at(-1).snapOverlay, null);

  // Press Shift while pointer is stationary
  b.key('Shift', b.document, { code: 'ShiftLeft' });
  b.flush();
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');
  assert.notEqual(b.renders.at(-1).snapOverlay, null);

  // Release Shift while pointer is stationary
  b.emit(b.document, 'keyup', { key: 'Shift', code: 'ShiftLeft' });
  b.flush();
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');
  assert.notEqual(b.renders.at(-1).snapOverlay, null);
});

test('Real UI case: Line acquires older draft points and completes when P1 is clicked', async () => {
  const b = await browser();
  b.launch();
  // Click P1, P2, P3, P4
  b.point(400, 300); // P1 (0, 0)
  b.point(450, 300); // P2 (10, 0)
  b.point(450, 250); // P3 (10, 10)
  b.point(400, 250); // P4 (0, 10)
  b.flush();

  const accepted = b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints()');
  assert.equal(accepted.length, 4);

  // 1. Move pointer near P2 (450, 300) -> acquires P2
  b.point(452, 301, 'pointermove');
  b.flush();
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');
  assert.deepEqual(b.read('activeSnapResult?.point'), { x: 10, y: 0 });
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().end'), { x: 10, y: 0 });
  assert.equal(b.renders.at(-1).snapOverlay.kind, 'draft-point');

  // Click on P2 -> creates segment P4 -> P2
  b.point(452, 301, 'pointerdown');
  b.flush();
  let segments = b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()');
  assert.equal(segments.length, 4);
  assert.deepEqual({ x: segments[3].end.x, y: segments[3].end.y }, { x: 10, y: 0 });

  // 2. Move pointer near P3 (450, 250) -> acquires P3
  b.point(449, 251, 'pointermove');
  b.flush();
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');
  assert.deepEqual(b.read('activeSnapResult?.point'), { x: 10, y: 10 });
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().end'), { x: 10, y: 10 });

  // Click on P3 -> creates segment P2 -> P3
  b.point(449, 251, 'pointerdown');
  b.flush();
  segments = b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()');
  assert.equal(segments.length, 5);
  assert.deepEqual({ x: segments[4].end.x, y: segments[4].end.y }, { x: 10, y: 10 });

  // 3. Move pointer near P1 (400, 300) -> acquires P1
  b.point(401, 299, 'pointermove');
  b.flush();
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');
  assert.deepEqual(b.read('activeSnapResult?.point'), { x: 0, y: 0 });
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().end'), { x: 0, y: 0 });

  // Click on P1 -> closes and completes.
  b.point(401, 299, 'pointerdown');
  b.flush();
  segments = b.read('modelReader.lines()');
  assert.equal(segments.length, 6);
  assert.deepEqual({ x: segments[5].end.x, y: segments[5].end.y }, { x: 0, y: 0 });
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);
});

test('Offset viewport bounding rect and varied zoom, pan, and DPR preserves draft-point acquisition', async () => {
  const b = await browser();

  for (const [zoom, panX, panY, dpr, left, top] of [
    [0.5, 200, 150, 1, 50, 75],
    [1, 400, 300, 1.25, 30, 45],
    [5, -50, 120, 1.5, 100, 20],
    [10, 80, -40, 2, 0, 80],
  ]) {
    // Override canvas and host bounds in context
    b.run(`canvas.getBoundingClientRect = () => ({ left: ${left}, top: ${top}, width: 800, height: 600 })`);
    b.run(`viewportHost.getBoundingClientRect = () => ({ left: ${left - 10}, top: ${top - 10}, width: 810, height: 610 })`);
    b.resize(800, 600, dpr);
    b.run(`camera.zoom=${zoom};camera.panX=${panX};camera.panY=${panY}`);

    b.launch();
    // P1 at (15, 25), P2 at (35, 25), P3 at (35, 45)
    const p1 = { x: 15, y: 25 };
    const p2 = { x: 35, y: 25 };
    const p3 = { x: 35, y: 45 };
    const p1Screen = b.run(`worldToScreen(${p1.x}, ${p1.y})`);
    const p2Screen = b.run(`worldToScreen(${p2.x}, ${p2.y})`);
    const p3Screen = b.run(`worldToScreen(${p3.x}, ${p3.y})`);

    b.emit(b.canvas, 'pointerdown', { clientX: left + p1Screen.x, clientY: top + p1Screen.y });
    b.emit(b.canvas, 'pointerdown', { clientX: left + p2Screen.x, clientY: top + p2Screen.y });
    b.emit(b.canvas, 'pointerdown', { clientX: left + p3Screen.x, clientY: top + p3Screen.y });
    b.flush();

    // Hover 3 CSS pixels away from P1 screen position
    b.emit(b.canvas, 'pointermove', { clientX: left + p1Screen.x + 3, clientY: top + p1Screen.y - 2 });
    b.flush();
    const snap = b.read('activeSnapResult');
    assert.equal(snap?.snapped, true);
    assert.equal(snap?.kind, 'draft-point');
    assert.ok(Math.abs(snap.point.x - 15) < 1e-4);
    assert.ok(Math.abs(snap.point.y - 25) < 1e-4);

    // Cancel active command for next iteration
    b.key('Escape');
    b.flush();
  }
});

test('Draft-point snap wins over closer Grid candidate within priority window or when draft point is closer', async () => {
  const b = await browser();
  b.run('camera.zoom=1;camera.panX=400;camera.panY=300');
  b.launch();
  // Draft point at (10.4, 10.4) -> near grid line at (10, 10)
  b.point(400 + 10.4, 300 - 10.4); // P1
  b.point(400 + 50, 300 - 10);     // P2
  b.flush();

  // Pointer at (411, 289): distance to draft point is 0.85px, distance to grid is 1.41px
  b.point(411, 289, 'pointermove');
  b.flush();
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');

  // Pointer directly on grid intersection at (410, 290): distance to grid is 0, distance to draft is 0.57px (within 0.75px priority window)
  b.point(410, 290, 'pointermove');
  b.flush();
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');
});

test('Snapping to current/latest draft point P4 collapses preview to zero-length and clicking P4 preserves draft integrity', async () => {
  const b = await browser();
  b.launch();
  b.point(400, 300); // P1 (0, 0)
  b.point(450, 300); // P2 (10, 0)
  b.point(450, 250); // P3 (10, 10)
  b.point(400, 250); // P4 (0, 10)
  b.flush();

  // 1. Move away from P4
  b.point(500, 200, 'pointermove');
  b.flush();
  assert.notEqual(b.read('activeSnapResult?.kind ?? null'), 'draft-point');
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().start'), { x: 0, y: 10 });
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().end'), { x: 20, y: 20 });

  // 2. Move pointer back within 1-3 CSS px of P4 (400, 250)
  b.point(402, 251, 'pointermove');
  b.flush();
  assert.equal(b.read('activeSnapResult?.snapped'), true);
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');
  assert.deepEqual(b.read('activeSnapResult?.point'), { x: 0, y: 10 });
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().start'), { x: 0, y: 10 });
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().end'), { x: 0, y: 10 });
  assert.equal(b.renders.at(-1).snapOverlay.kind, 'draft-point');
  assert.deepEqual({ x: b.renders.at(-1).snapOverlay.point.x, y: b.renders.at(-1).snapOverlay.point.y }, { x: 400, y: 250 });

  // 3. Move away again -> preview extends normally
  b.point(500, 200, 'pointermove');
  b.flush();
  assert.notEqual(b.read('activeSnapResult?.kind ?? null'), 'draft-point');
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().start'), { x: 0, y: 10 });
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().end'), { x: 20, y: 20 });

  // 4. Move back to P4 and click
  b.point(402, 251, 'pointermove');
  b.flush();
  b.point(402, 251, 'pointerdown');
  b.flush();
  // Line command stays active and draft remains valid
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Line');
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.segmentCount'), 4);

  // 5. Step undo reverts back to P3; P3 is now the latest point and must be acquirable
  b.window.caderactViewport.stepUndoActiveCommand();
  b.window.caderactViewport.stepUndoActiveCommand(); // back to 3 accepted points P1, P2, P3
  b.flush();
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.acceptedPoints().length'), 3);
  b.point(451, 249, 'pointermove'); // near P3 (450, 250)
  b.flush();
  assert.equal(b.read('activeSnapResult?.kind'), 'draft-point');
  assert.deepEqual(b.read('activeSnapResult?.point'), { x: 10, y: 10 });
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().start'), { x: 10, y: 10 });
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().end'), { x: 10, y: 10 });
});

test('latest draft point lock is radial at 10 CSS pixels across camera zoom and DPR', async () => {
  const directions = [[1,0],[-1,0],[0,1],[0,-1],[Math.SQRT1_2,Math.SQRT1_2]];
  for (const [zoom,dpr] of [[.5,1],[1,1.25],[5,1.5],[10,2]]) {
    const b = await browser();
    b.resize(800,600,dpr);b.run(`camera.zoom=${zoom};camera.panX=400;camera.panY=300`);
    b.launch();
    const p1=b.run('worldToScreen(0,0)'),p2=b.run('worldToScreen(100,100)');
    b.point(p1.x,p1.y);typed(b,'100,100');
    for (const [dx,dy] of directions) {
      b.point(p2.x+dx*14,p2.y+dy*14,'pointermove');
      assert.notEqual(b.run('activeSnapResult?.kind'),'draft-point');
      for (const distance of [9,6,3,1,0]) {
        b.point(p2.x+dx*distance,p2.y+dy*distance,'pointermove');b.flush();
        assert.equal(b.read('activeSnapResult?.kind'),'draft-point');
        assert.deepEqual(b.read('activeSnapResult.point'),{x:100,y:100});
        assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview().end'),{x:100,y:100});
        const scene=b.renders.at(-1),marker=scene.draftPointOverlay.points.at(-1).point;
        assert.equal(scene.snapOverlay.point.x,marker.x);assert.equal(scene.snapOverlay.point.y,marker.y);
      }
      b.point(p2.x+dx*11,p2.y+dy*11,'pointermove');
      assert.notEqual(b.run('activeSnapResult?.kind'),'draft-point');
    }
    b.key('Escape');
  }
});

test('Rhino-style Line keeps accepted segments fixed while only the next-segment preview moves', async () => {
  const b=await browser();const baseline=persistentState(b);b.launch();
  b.point(400,300);b.point(450,300);b.flush();
  let scene=b.renders.at(-1);
  assert.deepEqual(Array.from(scene.acceptedDraftOverlay.segments),[400,300,450,300]);
  assert.deepEqual(Array.from(scene.nextSegmentPreviewOverlay.segments),[450,300,450,300]);
  assert.equal(scene.draftPointOverlay.points.length,2);
  const acceptedBefore=b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()');
  for(let index=0;index<120;index++){
    b.point(520+(index%17),180+(index%23),'pointermove');
    assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()'),acceptedBefore);
    assert.deepEqual(persistentState(b),baseline);
  }
  b.flush();scene=b.renders.at(-1);
  assert.deepEqual(Array.from(scene.acceptedDraftOverlay.segments),[400,300,450,300]);
  assert.deepEqual(Array.from(scene.nextSegmentPreviewOverlay.segments).slice(0,2),[450,300]);
  b.point(452,301,'pointermove');b.flush();scene=b.renders.at(-1);
  assert.equal(b.read('activeSnapResult.kind'),'draft-point');
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview()'),{start:{x:10,y:0},end:{x:10,y:0}});
  assert.deepEqual(Array.from(scene.acceptedDraftOverlay.segments),[400,300,450,300]);
  assert.deepEqual(Array.from(scene.nextSegmentPreviewOverlay.segments),[450,300,450,300]);
  assert.equal(scene.draftPointOverlay.points.length,2);
  b.point(500,250);b.flush();scene=b.renders.at(-1);
  assert.deepEqual(Array.from(scene.acceptedDraftOverlay.segments),[400,300,450,300,450,300,500,250]);
  assert.deepEqual(Array.from(scene.nextSegmentPreviewOverlay.segments),[500,250,500,250]);
  assert.equal(scene.draftPointOverlay.points.length,3);
});

test('snapping the next segment to the starting accepted point closes and completes',async()=>{
  const b=await browser();b.launch();b.point(400,300);b.point(450,300);b.point(450,250);
  const before=b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()');
  b.point(402,301,'pointermove');
  assert.equal(b.read('activeSnapResult.kind'),'draft-point');
  assert.deepEqual(b.read('window.caderactCommandRouter.activeSession.draft.preview()'),{start:{x:10,y:10},end:{x:0,y:0}});
  b.point(402,301);const after=b.read('modelReader.lines()');
  assert.deepEqual(after.slice(0,2),before);assert.deepEqual({start:after[2].start,end:after[2].end},{start:{x:10,y:10,featureId:after[2].start.featureId},end:{x:0,y:0,featureId:after[2].end.featureId}});
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'),null);
});
