'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGeometry } = require('../helpers/geometry.cjs');

const w = loadGeometry();
const Planner = w.CaderactTrimPlanner;

function near(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}
function nearPoint(actual, expected, tolerance = 1e-6) {
  near(actual.x, expected.x, tolerance);
  near(actual.y, expected.y, tolerance);
}

// Record builders -- plain committed-record shapes, never touched by the
// planner beyond reading geometry + featureId fields.
const line = (start, end, id = 'line-1') =>
  ({ id, type: 'line', layerId: 'layer-1', start: { x: start.x, y: start.y, featureId: 'f-start' }, end: { x: end.x, y: end.y, featureId: 'f-end' } });
const circle = (center, radius, id = 'circle-1') => ({ id, type: 'circle', layerId: 'layer-1', center, radius });
const arcRecord = (center, radius, start, sweep, id = 'arc-1') =>
  ({ id, type: 'arc', layerId: 'layer-1', center, radius, start: { x: start.x, y: start.y, featureId: 'af-start' }, end: { x: 0, y: 0, featureId: 'af-end' }, sweep });
const ellipseRecord = (center, majorAxis, minorRadius, id = 'ellipse-1') =>
  ({ id, type: 'ellipse', layerId: 'layer-1', center, majorAxis, minorRadius });
const polyline = (vertices, closed, id = 'poly-1') =>
  ({ id, type: 'polyline', layerId: 'layer-1', closed, vertices: vertices.map((v, i) => ({ x: v.x, y: v.y, featureId: `v${i}` })) });

function plan(target, cuttingEdges, pickPoint) {
  return Planner.planTrim({ target, cuttingEdges, pickPoint });
}

// ---------------------------------------------------------------------
// 1. Line trimmed by Line -- one cut, click start side
test('Line/Line: one cut, clicking the start side removes it and preserves the end feature', () => {
  const target = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const cutter = line({ x: 0, y: -10 }, { x: 0, y: 10 });
  const result = plan(target, [cutter], { x: -5, y: 0 });
  assert.equal(result.status, 'planned');
  assert.equal(result.creates.length, 0);
  assert.equal(result.replacement.preserveRecordId, true);
  nearPoint(result.replacement.geometry.start, { x: 0, y: 0 });
  nearPoint(result.replacement.geometry.end, { x: 10, y: 0 });
  assert.equal(result.replacement.featureIdentityIntent.start.role, 'allocate-new-feature');
  assert.deepEqual(result.replacement.featureIdentityIntent.end, { role: 'preserve-existing-feature', featureId: 'f-end' });
});

// 2. Line trimmed by Line -- one cut, click end side
test('Line/Line: one cut, clicking the end side removes it and preserves the start feature', () => {
  const target = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const cutter = line({ x: 0, y: -10 }, { x: 0, y: 10 });
  const result = plan(target, [cutter], { x: 5, y: 0 });
  assert.equal(result.status, 'planned');
  nearPoint(result.replacement.geometry.start, { x: -10, y: 0 });
  nearPoint(result.replacement.geometry.end, { x: 0, y: 0 });
  assert.deepEqual(result.replacement.featureIdentityIntent.start, { role: 'preserve-existing-feature', featureId: 'f-start' });
  assert.equal(result.replacement.featureIdentityIntent.end.role, 'allocate-new-feature');
});

// 3. Line with two intersections -- middle interval removed
test('Line/Line: two cuts, clicking the middle removes it and both outer pieces survive', () => {
  const target = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const cutterA = line({ x: -5, y: -10 }, { x: -5, y: 10 });
  const cutterB = line({ x: 5, y: -10 }, { x: 5, y: 10 });
  const result = plan(target, [cutterA, cutterB], { x: 0, y: 0 });
  assert.equal(result.status, 'planned');
  assert.equal(result.creates.length, 1);
  nearPoint(result.replacement.geometry.start, { x: -10, y: 0 });
  nearPoint(result.replacement.geometry.end, { x: -5, y: 0 });
  assert.equal(result.replacement.preserveRecordId, true);
  nearPoint(result.creates[0].geometry.start, { x: 5, y: 0 });
  nearPoint(result.creates[0].geometry.end, { x: 10, y: 0 });
  assert.deepEqual(result.creates[0].featureIdentityIntent.end, { role: 'preserve-existing-feature', featureId: 'f-end' });
});

// 4. Line with multiple cutting edges combined
test('Line/multiple cutting edges: parameters are combined across all cutters', () => {
  const target = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const cutterA = line({ x: -3, y: -10 }, { x: -3, y: 10 });
  const cutterB = circle({ x: 3, y: 0 }, 1);
  const result = plan(target, [cutterA, cutterB], { x: 0, y: 0 });
  assert.equal(result.status, 'planned');
  assert.equal(result.intersectionParameters.length, 3); // -3, 2, 4
});

// 5. Line trimmed by Circle
test('Line/Circle: clicking inside the circle removes the chord', () => {
  const target = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const cutter = circle({ x: 0, y: 0 }, 5);
  const result = plan(target, [cutter], { x: 0, y: 0 });
  assert.equal(result.status, 'planned');
  assert.equal(result.creates.length, 1);
  nearPoint(result.replacement.geometry.end, { x: -5, y: 0 });
  nearPoint(result.creates[0].geometry.start, { x: 5, y: 0 });
});

// 6. Line trimmed by Arc
test('Line/Arc: only the on-sweep crossing is usable', () => {
  const target = line({ x: -10, y: 3 }, { x: 10, y: 3 });
  const upperHalf = arcRecord({ x: 0, y: 0 }, 5, { x: 5, y: 0 }, Math.PI);
  const result = plan(target, [upperHalf], { x: -5, y: 3 });
  assert.equal(result.status, 'planned');
  assert.equal(result.creates.length, 1);
});

// 7. Line trimmed by Ellipse
test('Line/Ellipse: cutting edge participation works for a Line target', () => {
  const target = line({ x: -20, y: 0 }, { x: 20, y: 0 });
  const cutter = ellipseRecord({ x: 0, y: 0 }, { x: 8, y: 0 }, 4);
  const result = plan(target, [cutter], { x: 0, y: 0 });
  assert.equal(result.status, 'planned');
  nearPoint(result.replacement.geometry.end, { x: -8, y: 0 });
  nearPoint(result.creates[0].geometry.start, { x: 8, y: 0 });
});

// 8. Clicked interval selection is independent of screen ordering
test('Interval selection uses curve-native parameter, not screen-space nearest cut', () => {
  const target = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const cutterA = line({ x: -8, y: -10 }, { x: -8, y: 10 });
  const cutterB = line({ x: 8, y: -10 }, { x: 8, y: 10 });
  // Click sits just left of x=-8 (screen-nearest cut is the -8 one), which
  // must remove the [-10,-8] interval, not silently jump to the far cutter.
  const result = plan(target, [cutterA, cutterB], { x: -9, y: 0 });
  assert.equal(result.status, 'planned');
  // The [-10,-8] interval containing the click is removed; both remaining
  // intervals survive regardless of which cutter is screen-nearest to the pick.
  nearPoint(result.replacement.geometry.start, { x: -8, y: 0 });
  nearPoint(result.replacement.geometry.end, { x: 8, y: 0 });
  assert.equal(result.creates.length, 1);
  nearPoint(result.creates[0].geometry.start, { x: 8, y: 0 });
  nearPoint(result.creates[0].geometry.end, { x: 10, y: 0 });
});

// 9. No intersection = no-op
test('No intersection produces a non-mutating no-op', () => {
  const target = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const cutter = line({ x: -10, y: 5 }, { x: 10, y: 5 });
  const result = plan(target, [cutter], { x: 0, y: 0 });
  assert.equal(result.status, 'no-op');
  assert.equal(result.reason, 'no-intersection');
});

// 10. Tangent-only = safe no-op
test('A single tangent touch alone is a safe no-op', () => {
  const target = line({ x: -10, y: 5 }, { x: 10, y: 5 });
  const cutter = circle({ x: 0, y: 0 }, 5); // tangent at (0,5)
  const result = plan(target, [cutter], { x: -5, y: 5 });
  assert.equal(result.status, 'no-op');
  assert.equal(result.reason, 'tangent-only');
});

// 11. Near-tangent duplicate handling
test('Near-tangent duplicate roots collapse instead of creating a zero-length interval', () => {
  const target = line({ x: -10, y: 5 }, { x: 10, y: 5 });
  const cutter = circle({ x: 0, y: 0.0000001 }, 5);
  const result = plan(target, [cutter], { x: -5, y: 5 });
  // Either collapses to a safe tangent-adjacent no-op or a clean planned
  // result -- what it must never do is throw or fabricate a zero-length piece.
  assert.ok(['no-op', 'planned'].includes(result.status));
  if (result.status === 'planned') {
    for (const piece of [result.replacement, ...result.creates]) {
      const length = Math.hypot(piece.geometry.end.x - piece.geometry.start.x, piece.geometry.end.y - piece.geometry.start.y);
      assert.ok(length > 1e-6);
    }
  }
});

// 12. Coincident Line overlap = safe no-op
test('Coincident overlapping Lines classify as non-actionable and no-op', () => {
  const target = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const cutter = line({ x: -5, y: 0 }, { x: 5, y: 0 });
  const result = plan(target, [cutter], { x: 0, y: 0 });
  assert.equal(result.status, 'no-op');
  assert.equal(result.reason, 'coincident-overlap');
});

// 13. Degenerate zero-length result rejection
test('A click that would leave nothing survives as a safe no-op', () => {
  const target = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  // Cutter sits exactly on the target's own endpoint parameter (t=1): the
  // only interval boundary that exists is the domain edge itself.
  const cutter = line({ x: 10, y: -10 }, { x: 10, y: 10 });
  const result = plan(target, [cutter], { x: 5, y: 0 });
  assert.equal(result.status, 'no-op');
});

// 14. Circle trimmed to Arc
test('Circle/Line: two cuts convert the Circle into a surviving Arc', () => {
  const target = circle({ x: 0, y: 0 }, 5);
  const cutter = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const result = plan(target, [cutter], { x: 0, y: 5 }); // click upper half
  assert.equal(result.status, 'planned');
  assert.equal(result.replacement.geometry.type, 'arc');
  near(result.replacement.geometry.radius, 5);
  assert.ok(result.replacement.geometry.sweep > 0 && result.replacement.geometry.sweep < 2 * Math.PI);
  // Upper half survives: midpoint of remaining arc should be near +y.
  nearPoint(result.replacement.geometry.start, { x: -5, y: 0 });
  nearPoint(result.replacement.geometry.end, { x: 5, y: 0 });
});

// 15. Circle multiple intersections / clicked arc interval
test('Circle with three cuts: the clicked circular interval is removed, complement survives', () => {
  const target = circle({ x: 0, y: 0 }, 5);
  const cutterA = line({ x: -10, y: 0 }, { x: 10, y: 0 }); // cuts at angle 0, PI
  const cutterB = line({ x: 0, y: -10 }, { x: 0, y: 10 }); // cuts at angle PI/2, -PI/2
  const result = plan(target, [cutterA, cutterB], { x: 5 * Math.cos(Math.PI / 4), y: 5 * Math.sin(Math.PI / 4) });
  assert.equal(result.status, 'planned');
  assert.equal(result.intersectionParameters.length, 4);
  assert.equal(result.creates.length, 0);
});

// 16. Circle original record ID preservation intent
test('Circle -> Arc preserves the original Circle record id', () => {
  const target = circle({ x: 0, y: 0 }, 5, 'circle-original');
  const cutter = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const result = plan(target, [cutter], { x: 0, y: 5 });
  assert.equal(result.status, 'planned');
  assert.equal(result.targetRecordId, 'circle-original');
  assert.equal(result.replacement.preserveRecordId, true);
});

// 17. Circle -> Arc two fresh endpoint identity requirements
test('Circle -> Arc requires two fresh endpoint feature identities', () => {
  const target = circle({ x: 0, y: 0 }, 5);
  const cutter = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const result = plan(target, [cutter], { x: 0, y: 5 });
  assert.equal(result.replacement.featureIdentityIntent.start.role, 'allocate-new-feature');
  assert.equal(result.replacement.featureIdentityIntent.end.role, 'allocate-new-feature');
});

// 18. Arc one-side trim
test('Arc: one interior cut, clicking one side removes it and preserves the other endpoint', () => {
  const target = arcRecord({ x: 0, y: 0 }, 5, { x: 5, y: 0 }, Math.PI); // upper half, start=(5,0), end=(-5,0)
  const cutter = line({ x: 0, y: -10 }, { x: 0, y: 10 }); // cuts arc at (0,5)
  const result = plan(target, [cutter], { x: 5 * Math.cos(Math.PI / 6), y: 5 * Math.sin(Math.PI / 6) });
  assert.equal(result.status, 'planned');
  assert.equal(result.creates.length, 0);
  // Click at 30deg falls in [start(0deg), cut(90deg)], which is removed;
  // the surviving [cut(90deg), end(180deg)] piece keeps the original end.
  nearPoint(result.replacement.geometry.start, { x: 0, y: 5 });
  nearPoint(result.replacement.geometry.end, { x: -5, y: 0 });
  assert.equal(result.replacement.featureIdentityIntent.start.role, 'allocate-new-feature');
  assert.deepEqual(result.replacement.featureIdentityIntent.end, { role: 'preserve-existing-feature', featureId: 'af-end' });
});

// 19. Arc middle trim producing two survivors
test('Arc: two interior cuts, clicking the middle produces two survivors', () => {
  const target = arcRecord({ x: 0, y: 0 }, 5, { x: 5, y: 0 }, Math.PI); // 0 .. PI
  const cutterA = line({ x: -10, y: 5 * Math.sin(Math.PI / 4) }, { x: 10, y: 5 * Math.sin(Math.PI / 4) });
  // A horizontal line at y = 5*sin(PI/4) crosses the upper-half arc at two
  // symmetric points, PI/4 and 3PI/4.
  const result = plan(target, [cutterA], { x: 0, y: 5 });
  assert.equal(result.status, 'planned');
  assert.equal(result.creates.length, 1);
  assert.equal(result.replacement.preserveRecordId, true);
});

// 20. Arc existing endpoint feature preservation intent
test('Arc: the survivor touching the original start keeps its start feature id', () => {
  const target = arcRecord({ x: 0, y: 0 }, 5, { x: 5, y: 0 }, Math.PI);
  const cutter = line({ x: 0, y: -10 }, { x: 0, y: 10 });
  const result = plan(target, [cutter], { x: 5 * Math.cos(3 * Math.PI / 4), y: 5 * Math.sin(3 * Math.PI / 4) });
  assert.equal(result.replacement.featureIdentityIntent.start.featureId, 'af-start');
});

// 21. Ellipse target = unsupported persistence result
test('Ellipse target with a real removable interval is an explicit unsupported result', () => {
  const target = ellipseRecord({ x: 0, y: 0 }, { x: 8, y: 0 }, 4);
  const cutter = line({ x: -20, y: 0 }, { x: 20, y: 0 });
  const cutterB = line({ x: 0, y: -20 }, { x: 0, y: 20 });
  const result = plan(target, [cutter, cutterB], { x: 0, y: 4 });
  assert.equal(result.status, 'unsupported-target-result');
  assert.equal(result.reason, 'partial-ellipse-not-persistable');
});

// 22. Ellipse remains valid as cutting edge
test('Ellipse participates fully as a cutting edge against a Line target', () => {
  const target = line({ x: -20, y: 0 }, { x: 20, y: 0 });
  const cutter = ellipseRecord({ x: 0, y: 0 }, { x: 8, y: 0 }, 4);
  const result = plan(target, [cutter], { x: 0, y: 0 });
  assert.equal(result.status, 'planned');
});

// 23. Polyline affected-segment trim
test('Polyline: only the clicked segment is cut, other vertices are untouched', () => {
  const target = polyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], false);
  const cutter = line({ x: 5, y: -10 }, { x: 5, y: 10 });
  // Clicking the far side of the affected segment orphans the rest of the
  // polyline (v1, v2) into its own untouched sibling.
  const result = plan(target, [cutter], { x: 8, y: 0 });
  assert.equal(result.status, 'planned');
  assert.equal(result.affectedSegmentIndex, 0);
  assert.equal(result.creates.length, 1);
  nearPoint(result.creates[0].geometry.vertices[0], { x: 10, y: 0 });
  nearPoint(result.creates[0].geometry.vertices[1], { x: 10, y: 10 });
});

// 24. Polyline unaffected vertex feature preservation intent
test('Polyline: vertices on the untouched side of the affected segment preserve feature ids', () => {
  const target = polyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], false);
  const cutter = line({ x: 5, y: -10 }, { x: 5, y: 10 });
  const result = plan(target, [cutter], { x: 8, y: 0 });
  assert.equal(result.status, 'planned');
  assert.equal(result.creates.length, 1);
  const createdVertexIntents = result.creates[0].featureIdentityIntent.vertices;
  assert.deepEqual(createdVertexIntents[0], { role: 'preserve-existing-feature', featureId: 'v1' });
  assert.deepEqual(createdVertexIntents[1], { role: 'preserve-existing-feature', featureId: 'v2' });
});

// 25. Polyline new cut vertex identity intent
test('Polyline: a genuinely new cut point requires a fresh feature id', () => {
  const target = polyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], false);
  const cutter = line({ x: 5, y: -10 }, { x: 5, y: 10 });
  const result = plan(target, [cutter], { x: 8, y: 0 });
  // Replacement is [v0, cutPoint]: v0 preserved, the new cut point is fresh.
  const replacementIntents = result.replacement.featureIdentityIntent.vertices;
  assert.deepEqual(replacementIntents[0], { role: 'preserve-existing-feature', featureId: 'v0' });
  assert.equal(replacementIntents[1].role, 'allocate-new-feature');
});

// 26. Polyline middle removal requiring multiple survivors
test('Polyline: two cuts on the same segment removing the middle yields two survivors', () => {
  const target = polyline([{ x: 0, y: 0 }, { x: 10, y: 0 }], false);
  const cutterA = line({ x: 3, y: -10 }, { x: 3, y: 10 });
  const cutterB = line({ x: 7, y: -10 }, { x: 7, y: 10 });
  const result = plan(target, [cutterA, cutterB], { x: 5, y: 0 });
  assert.equal(result.status, 'planned');
  assert.equal(result.creates.length, 1);
  const replacementVertices = result.replacement.geometry.vertices;
  nearPoint(replacementVertices[0], { x: 0, y: 0 });
  nearPoint(replacementVertices[replacementVertices.length - 1], { x: 3, y: 0 });
  const createdVertices = result.creates[0].geometry.vertices;
  nearPoint(createdVertices[0], { x: 7, y: 0 });
  nearPoint(createdVertices[createdVertices.length - 1], { x: 10, y: 0 });
});

// 27. Closed Polyline seam handling
test('Closed Polyline: cutting one segment opens the ring into a single survivor', () => {
  const target = polyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], true);
  const cutter = line({ x: 5, y: -10 }, { x: 5, y: 10 });
  const result = plan(target, [cutter], { x: 2, y: 0 });
  assert.equal(result.status, 'planned');
  assert.equal(result.creates.length, 0);
  assert.equal(result.replacement.preserveRecordId, true);
  assert.equal(result.replacement.geometry.closed, false);
});

// 28. Closed Polyline no duplicate seam vertex
test('Closed Polyline: the resulting open chain never duplicates a seam vertex', () => {
  const target = polyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], true);
  const cutter = line({ x: 5, y: -10 }, { x: 5, y: 10 });
  const result = plan(target, [cutter], { x: 2, y: 0 });
  const vertices = result.replacement.geometry.vertices;
  const keys = vertices.map(v => `${v.x.toFixed(6)},${v.y.toFixed(6)}`);
  assert.equal(new Set(keys).size, keys.length);
});

// 29. Original record id retained on start-side survivor
test('Original record id policy: the start-side survivor keeps the original id (Line)', () => {
  const target = line({ x: -10, y: 0 }, { x: 10, y: 0 }, 'line-original');
  const cutterA = line({ x: -5, y: -10 }, { x: -5, y: 10 });
  const cutterB = line({ x: 5, y: -10 }, { x: 5, y: 10 });
  const result = plan(target, [cutterA, cutterB], { x: 0, y: 0 });
  assert.equal(result.targetRecordId, 'line-original');
  assert.equal(result.replacement.preserveRecordId, true);
  nearPoint(result.replacement.geometry.start, { x: -10, y: 0 });
});

// 30. End-side sibling marked for new record identity
test('Original record id policy: the end-side sibling is marked as a new record (no preserveRecordId)', () => {
  const target = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const cutterA = line({ x: -5, y: -10 }, { x: -5, y: 10 });
  const cutterB = line({ x: 5, y: -10 }, { x: 5, y: 10 });
  const result = plan(target, [cutterA, cutterB], { x: 0, y: 0 });
  assert.equal(result.creates.length, 1);
  assert.equal('preserveRecordId' in result.creates[0], false);
});

// 30b. Same policy holds even when the start-side survivor was removed.
test('Original record id policy: if the start-side survivor is removed, the remaining survivor keeps the id', () => {
  const target = line({ x: -10, y: 0 }, { x: 10, y: 0 }, 'line-original');
  const cutter = line({ x: -5, y: -10 }, { x: -5, y: 10 });
  const result = plan(target, [cutter], { x: -8, y: 0 }); // click the start side, it's removed
  assert.equal(result.status, 'planned');
  assert.equal(result.creates.length, 0);
  assert.equal(result.replacement.preserveRecordId, true);
  nearPoint(result.replacement.geometry.start, { x: -5, y: 0 });
  nearPoint(result.replacement.geometry.end, { x: 10, y: 0 });
});

// 31. Exact deterministic sibling ordering
test('Deterministic sibling ordering: creates are always ordered start-to-end along the curve', () => {
  const target = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const cutterA = line({ x: -5, y: -10 }, { x: -5, y: 10 });
  const cutterB = line({ x: 5, y: -10 }, { x: 5, y: 10 });
  const resultA = plan(target, [cutterA, cutterB], { x: 0, y: 0 });
  const resultB = plan(target, [cutterB, cutterA], { x: 0, y: 0 }); // reversed cutting-edge order
  assert.deepEqual(resultA.creates[0].geometry, resultB.creates[0].geometry);
  assert.deepEqual(resultA.replacement.geometry, resultB.replacement.geometry);
});

// 32. Invalid numeric/intersection result = no-op
test('Invalid target geometry yields an explicit invalid-target result, never a throw', () => {
  const target = { id: 'bad-line', type: 'line', start: { x: 0, y: 0 }, end: { x: 0, y: 0 } };
  const cutter = circle({ x: 0, y: 0 }, 5);
  const result = plan(target, [cutter], { x: 1, y: 0 });
  assert.equal(result.status, 'invalid-target');
});

test('Unresolvable pick point yields a safe no-op', () => {
  const target = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const cutter = line({ x: 0, y: -10 }, { x: 0, y: 10 });
  const result = plan(target, [cutter], { x: NaN, y: NaN });
  assert.equal(result.status, 'invalid-target');
});
