'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGeometry } = require('../helpers/geometry.cjs');

const w = loadGeometry();
const Planner = w.CaderactExtendPlanner;
const line = (start, end, id = 'line-1') =>
  ({ id, type: 'line', layerId: 'layer-1', start: { x: start.x, y: start.y, featureId: `${id}-s` }, end: { x: end.x, y: end.y, featureId: `${id}-e` } });
const circle = (center, radius, id = 'circle-1') => ({ id, type: 'circle', layerId: 'layer-1', center, radius });
const arc = (center, radius, start, sweep, id = 'arc-1') => {
  const end = w.CaderactArcGeometry.pointAt({ center, radius, startAngle: Math.atan2(start.y - center.y, start.x - center.x), sweep }, 1);
  return { id, type: 'arc', layerId: 'layer-1', center, radius, start: { x: start.x, y: start.y, featureId: `${id}-s` }, end: { x: end.x, y: end.y, featureId: `${id}-e` }, sweep };
};
const ellipse = (center, majorAxis, minorRadius, id = 'ellipse-1') => ({ id, type: 'ellipse', layerId: 'layer-1', center, majorAxis, minorRadius });
const polyline = (vertices, closed = false, id = 'poly-1') =>
  ({ id, type: 'polyline', layerId: 'layer-1', closed, vertices: vertices.map((v, i) => ({ x: v.x, y: v.y, featureId: `${id}-v${i}` })) });
function nearPoint(actual, expected, tolerance = 1e-6) {
  assert.ok(Math.abs(actual.x - expected.x) <= tolerance, `${actual.x} != ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) <= tolerance, `${actual.y} != ${expected.y}`);
}
function plan(target, boundaries, pickPoint) {
  return Planner.planExtend({ target, cuttingEdges: boundaries, pickPoint });
}

test('Line endpoint extends to nearest valid Line boundary in the picked direction', () => {
  const target = line({ x: 0, y: 0 }, { x: 10, y: 0 });
  const boundary = line({ x: 20, y: -10 }, { x: 20, y: 10 }, 'boundary');
  const result = plan(target, [boundary], { x: 9, y: 0 });
  assert.equal(result.status, 'planned');
  assert.equal(result.side, 'end');
  nearPoint(result.replacement.geometry.start, { x: 0, y: 0 });
  nearPoint(result.replacement.geometry.end, { x: 20, y: 0 });
  assert.deepEqual(result.replacement.featureIdentityIntent.start, { role: 'preserve-existing-feature', featureId: target.start.featureId });
  assert.deepEqual(result.replacement.featureIdentityIntent.end, { role: 'preserve-existing-feature', featureId: target.end.featureId });
});

test('Line start extends toward Circle, Arc, and Ellipse boundaries using unbounded target support', () => {
  const target = line({ x: 0, y: 0 }, { x: 10, y: 0 });
  const circlePlan = plan(target, [circle({ x: -10, y: 0 }, 5)], { x: 1, y: 0 });
  assert.equal(circlePlan.status, 'planned');
  nearPoint(circlePlan.replacement.geometry.start, { x: -5, y: 0 });
  const arcBoundary = arc({ x: -10, y: 0 }, 5, { x: -5, y: 0 }, Math.PI);
  const arcPlan = plan(target, [arcBoundary], { x: 1, y: 0 });
  assert.equal(arcPlan.status, 'planned');
  nearPoint(arcPlan.replacement.geometry.start, { x: -5, y: 0 });
  const ellipsePlan = plan(target, [ellipse({ x: -10, y: 0 }, { x: 6, y: 0 }, 3)], { x: 1, y: 0 });
  assert.equal(ellipsePlan.status, 'planned');
  nearPoint(ellipsePlan.replacement.geometry.start, { x: -4, y: 0 });
});

test('Nearest boundary intersection in extension direction wins deterministically', () => {
  const target = line({ x: 0, y: 0 }, { x: 10, y: 0 });
  const far = line({ x: 30, y: -10 }, { x: 30, y: 10 }, 'far');
  const near = line({ x: 20, y: -10 }, { x: 20, y: 10 }, 'near');
  const result = plan(target, [far, near], { x: 9, y: 0 });
  assert.equal(result.status, 'planned');
  assert.equal(result.boundaryRecordId, 'near');
  nearPoint(result.replacement.geometry.end, { x: 20, y: 0 });
});

test('Invalid/no-op Extend cases are explicit and history-free at planner boundary', () => {
  const target = line({ x: 0, y: 0 }, { x: 10, y: 0 });
  assert.equal(plan(target, [], { x: 9, y: 0 }).reason, 'no-boundaries');
  assert.equal(plan(target, [line({ x: 10, y: -10 }, { x: 10, y: 10 }, 'touching')], { x: 9, y: 0 }).reason, 'endpoint-already-on-boundary');
  assert.equal(plan(target, [line({ x: 0, y: 5 }, { x: 10, y: 5 }, 'parallel')], { x: 9, y: 0 }).reason, 'no-valid-extension');
  assert.equal(plan(target, [line({ x: -5, y: 0 }, { x: 15, y: 0 }, 'coincident')], { x: 9, y: 0 }).reason, 'coincident-overlap');
  assert.equal(plan(circle({ x: 0, y: 0 }, 5), [target], { x: 5, y: 0 }).reason, 'closed-curve-not-extendable');
  assert.equal(plan(ellipse({ x: 0, y: 0 }, { x: 5, y: 0 }, 2), [target], { x: 5, y: 0 }).reason, 'closed-curve-not-extendable');
});

test('Arc endpoint can extend along its native sweep support while preserving endpoint identities', () => {
  const target = arc({ x: 0, y: 0 }, 5, { x: 5, y: 0 }, Math.PI / 2, 'arc-target');
  const boundary = line({ x: -10, y: 0 }, { x: 10, y: 0 }, 'x-axis');
  const result = plan(target, [boundary], { x: 0, y: 5 });
  assert.equal(result.status, 'planned');
  assert.equal(result.side, 'end');
  nearPoint(result.replacement.geometry.end, { x: -5, y: 0 });
  assert.ok(result.replacement.geometry.sweep > Math.PI / 2);
  assert.deepEqual(result.replacement.featureIdentityIntent.start, { role: 'preserve-existing-feature', featureId: target.start.featureId });
  assert.deepEqual(result.replacement.featureIdentityIntent.end, { role: 'preserve-existing-feature', featureId: target.end.featureId });
});

test('Open Polyline extends only the picked endpoint and preserves vertex feature IDs', () => {
  const target = polyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }]);
  const boundary = line({ x: 10, y: 12 }, { x: 20, y: 12 }, 'boundary');
  const result = plan(target, [boundary], { x: 10, y: 5 });
  assert.equal(result.status, 'planned');
  assert.equal(result.targetType, 'polyline');
  assert.equal(result.side, 'end');
  nearPoint(result.replacement.geometry.vertices[2], { x: 10, y: 12 });
  assert.deepEqual(result.replacement.featureIdentityIntent.vertices.map(v => v.featureId), target.vertices.map(v => v.featureId));
  assert.equal(plan({ ...target, closed: true }, [boundary], { x: 10, y: 5 }).reason, 'closed-polyline-not-extendable');
});
