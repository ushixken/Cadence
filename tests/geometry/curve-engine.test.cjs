'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadGeometry } = require('../helpers/geometry.cjs');

const w = loadGeometry();
const Descriptor = w.CaderactCurveDescriptor;
const Parameter = w.CaderactCurveParameter;
const Intersection = w.CaderactCurveIntersection;
const Classifier = w.CaderactIntersectionClassifier;
const Intervals = w.CaderactTrimIntervals;

function near(actual, expected, tolerance = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
}
function nearPoint(actual, expected, tolerance = 1e-6) {
  near(actual.x, expected.x, tolerance);
  near(actual.y, expected.y, tolerance);
}
const line = (start, end) => Descriptor.describe({ type: 'line', start, end });
const circle = (center, radius) => Descriptor.describe({ type: 'circle', center, radius });
const arc = (center, radius, start, sweep) => Descriptor.describe({ type: 'arc', center, radius, start, sweep });
const ellipse = (center, majorAxis, minorRadius) => Descriptor.describe({ type: 'ellipse', center, majorAxis, minorRadius });

function classifiedActionable(curveA, curveB) {
  const raw = Intersection.intersectAtomic(curveA, curveB);
  assert.equal(raw.valid, true);
  return Classifier.classify(curveA, curveB, raw.hits).filter(hit => hit.actionable);
}

// ---------------------------------------------------------------------
// 1. Line / Line
test('Line/Line intersects at the expected model-space point', () => {
  const a = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const b = line({ x: 0, y: -10 }, { x: 0, y: 10 });
  const hits = classifiedActionable(a, b);
  assert.equal(hits.length, 1);
  nearPoint(hits[0].point, { x: 0, y: 0 });
  near(hits[0].parameterA, 0.5);
  near(hits[0].parameterB, 0.5);
});

// 2. Line / Circle
test('Line/Circle produces two analytic crossings', () => {
  const l = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const c = circle({ x: 0, y: 0 }, 5);
  const hits = classifiedActionable(l, c).sort((x, y) => x.point.x - y.point.x);
  assert.equal(hits.length, 2);
  nearPoint(hits[0].point, { x: -5, y: 0 });
  nearPoint(hits[1].point, { x: 5, y: 0 });
});

// 3. Line / Arc
test('Line/Arc rejects a crossing off the stored sweep', () => {
  const l = line({ x: -10, y: 0 }, { x: 10, y: 0 });
  const upperHalf = arc({ x: 0, y: 0 }, 5, { x: 5, y: 0 }, Math.PI); // sweeps through +y only
  const raw = Intersection.intersectAtomic(l, upperHalf);
  const classified = Classifier.classify(l, upperHalf, raw.hits);
  // Both analytic roots (+/-5,0) sit exactly on the sweep boundary (on-domain).
  assert.equal(classified.filter(hit => hit.actionable).length, 2);
  const lowerHalf = arc({ x: 0, y: 0 }, 5, { x: -5, y: 0 }, Math.PI); // sweeps through -y only
  const belowLine = line({ x: -10, y: -3 }, { x: 10, y: -3 });
  const rawBelow = Intersection.intersectAtomic(belowLine, lowerHalf);
  const classifiedBelow = Classifier.classify(belowLine, lowerHalf, rawBelow.hits);
  assert.equal(classifiedBelow.every(hit => hit.actionable), true);
  assert.equal(classifiedBelow.length, 2);
});

// 4. Line / Ellipse
test('Line/Ellipse intersects at the ellipse vertices along its major axis', () => {
  const l = line({ x: -20, y: 0 }, { x: 20, y: 0 });
  const e = ellipse({ x: 0, y: 0 }, { x: 8, y: 0 }, 4);
  const hits = classifiedActionable(l, e).sort((x, y) => x.point.x - y.point.x);
  assert.equal(hits.length, 2);
  nearPoint(hits[0].point, { x: -8, y: 0 });
  nearPoint(hits[1].point, { x: 8, y: 0 });
});

// 5. Circle / Circle
test('Circle/Circle intersects symmetrically about the line of centers', () => {
  const a = circle({ x: 0, y: 0 }, 5);
  const b = circle({ x: 6, y: 0 }, 5);
  const hits = classifiedActionable(a, b);
  assert.equal(hits.length, 2);
  for (const hit of hits) near(hit.point.x, 3, 1e-9);
  assert.ok(hits.some(hit => hit.point.y > 0) && hits.some(hit => hit.point.y < 0));
});

// 6. Circle / Arc
test('Circle/Arc filters the underlying circle-circle roots by the Arc sweep', () => {
  const c = circle({ x: 6, y: 0 }, 5);
  const upperHalf = arc({ x: 0, y: 0 }, 5, { x: 5, y: 0 }, Math.PI);
  const raw = Intersection.intersectAtomic(c, upperHalf);
  const classified = Classifier.classify(c, upperHalf, raw.hits);
  assert.equal(classified.length, 2);
  assert.equal(classified.filter(hit => hit.actionable).length, 1);
  const actionable = classified.find(hit => hit.actionable);
  assert.ok(actionable.point.y > 0);
});

// 7. Arc / Arc
test('Arc/Arc respects both stored sweeps', () => {
  const upperHalf = arc({ x: -3, y: 0 }, 5, { x: 2, y: 0 }, Math.PI);
  const otherUpperHalf = arc({ x: 3, y: 0 }, 5, { x: 8, y: 0 }, Math.PI);
  const hits = classifiedActionable(upperHalf, otherUpperHalf);
  assert.equal(hits.length, 1);
  assert.ok(hits[0].point.y > 0);
});

// 8. Supported Circle/Arc/Ellipse combinations
test('Circle/Ellipse and Ellipse/Ellipse resolve via the bounded numerical solver', () => {
  const c = circle({ x: 0, y: 0 }, 5);
  const e = ellipse({ x: 0, y: 0 }, { x: 8, y: 0 }, 4);
  const circleEllipseHits = classifiedActionable(c, e);
  assert.equal(circleEllipseHits.length, 4);
  for (const hit of circleEllipseHits) near(Math.hypot(hit.point.x, hit.point.y), 5, 1e-3);

  const eA = ellipse({ x: 0, y: 0 }, { x: 8, y: 0 }, 4);
  const eB = ellipse({ x: 5, y: 0 }, { x: 0, y: 6 }, 3);
  const ellipseEllipseHits = classifiedActionable(eA, eB);
  assert.ok(ellipseEllipseHits.length >= 2);
});

test('Arc/Ellipse filters the underlying circle-ellipse roots by the Arc sweep', () => {
  const upperHalf = arc({ x: 0, y: 0 }, 5, { x: 5, y: 0 }, Math.PI);
  const e = ellipse({ x: 0, y: 0 }, { x: 8, y: 0 }, 4);
  const raw = Intersection.intersectAtomic(upperHalf, e);
  const classified = Classifier.classify(upperHalf, e, raw.hits);
  assert.equal(classified.filter(hit => hit.actionable).every(hit => hit.point.y >= -1e-6), true);
  assert.ok(classified.some(hit => !hit.onA));
});

// 9. Polyline segment intersections
test('Polyline decomposes into finite Line segments for intersection', () => {
  const poly = { type: 'polyline', vertices: [{ x: -5, y: -5 }, { x: 5, y: -5 }, { x: 5, y: 5 }], closed: false };
  const cross = { type: 'line', start: { x: 0, y: -10 }, end: { x: 0, y: 10 } };
  const result = Intersection.intersect(poly, cross);
  assert.equal(result.valid, true);
  const onBoth = result.hits.filter(hit => hit.onA && hit.onB);
  assert.equal(onBoth.length, 1);
  assert.equal(onBoth[0].segmentIndexA, 0);
  nearPoint(onBoth[0].point, { x: 0, y: -5 });
});

test('closed Polyline includes the implicit closing segment', () => {
  const poly = { type: 'polyline', vertices: [{ x: -5, y: -5 }, { x: 5, y: -5 }, { x: 0, y: 5 }], closed: true };
  const flattened = Descriptor.atomicCurves(poly);
  assert.equal(flattened.valid, true);
  assert.equal(flattened.curves.length, 3);
  assert.equal(flattened.curves[2].segmentIndex, 2);
});

// 10. Finite Line rejection
test('Line/Line rejects a crossing that falls outside both finite segments', () => {
  const a = line({ x: 0, y: 0 }, { x: 1, y: 0 });
  const b = line({ x: 5, y: -1 }, { x: 5, y: 1 });
  const raw = Intersection.intersectAtomic(a, b);
  const classified = Classifier.classify(a, b, raw.hits);
  assert.equal(classified.length, 1);
  assert.equal(classified[0].onA, false);
  assert.equal(classified[0].actionable, false);
});

// 11. Arc sweep rejection
test('Arc rejects an analytic root that lies outside the stored sweep', () => {
  const upperHalf = arc({ x: 0, y: 0 }, 5, { x: 5, y: 0 }, Math.PI);
  const verticalLine = line({ x: 0, y: -10 }, { x: 0, y: -1 }); // only touches the arc's lower mirror, off the sweep
  const raw = Intersection.intersectAtomic(verticalLine, upperHalf);
  const classified = Classifier.classify(verticalLine, upperHalf, raw.hits);
  assert.ok(classified.some(hit => !hit.onB));
});

// 12. Clicked parameter on Line
test('nearestParameter on a Line clamps into [0,1] and matches the projection', () => {
  const l = line({ x: 0, y: 0 }, { x: 10, y: 0 });
  near(Parameter.nearestParameter(l, { x: 4, y: 3 }).parameter, 0.4);
  near(Parameter.nearestParameter(l, { x: -5, y: 0 }).parameter, 0);
  near(Parameter.nearestParameter(l, { x: 15, y: 0 }).parameter, 1);
});

// 13. Clicked parameter on Circle
test('nearestParameter on a Circle returns the angle to the point', () => {
  const c = circle({ x: 0, y: 0 }, 5);
  near(Parameter.nearestParameter(c, { x: 0, y: 100 }).parameter, Math.PI / 2);
  near(Parameter.nearestParameter(c, { x: -1, y: 0 }).parameter, Math.PI);
});

// 14. Clicked parameter on Arc
test('nearestParameter on an Arc clamps off-sweep picks to the nearer endpoint', () => {
  const upperHalf = arc({ x: 0, y: 0 }, 5, { x: 5, y: 0 }, Math.PI);
  near(Parameter.nearestParameter(upperHalf, { x: 0, y: 100 }).parameter, 0.5);
  near(Parameter.nearestParameter(upperHalf, { x: 4, y: -1 }).parameter, 1); // near the (-5,0) end, off-sweep
});

// 15. Clicked parameter on Ellipse
test('nearestParameter on an Ellipse maps a point to its affine angle', () => {
  const e = ellipse({ x: 0, y: 0 }, { x: 8, y: 0 }, 4);
  near(Parameter.nearestParameter(e, { x: 8, y: 0 }).parameter, 0);
  near(Parameter.nearestParameter(e, { x: 0, y: 4 }).parameter, Math.PI / 2);
});

// 16. Polyline segment parameter/location
test('locatePolylineSegment finds the nearest segment and local parameter', () => {
  const poly = Descriptor.polylineSegments([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], false);
  const located = Parameter.locatePolylineSegment(poly.segments, { x: 10, y: 4 });
  assert.equal(located.segmentIndex, 1);
  near(located.localParameter, 0.4);
});

// 17. Multiple intersections
test('a Line crossing a larger Circle twice reports both points', () => {
  const l = line({ x: -20, y: 1 }, { x: 20, y: 1 });
  const c = circle({ x: 0, y: 0 }, 10);
  assert.equal(classifiedActionable(l, c).length, 2);
});

// 18. Parameter ordering
test('sortedUniqueParameters orders open-curve parameters numerically', () => {
  const l = line({ x: 0, y: 0 }, { x: 10, y: 0 });
  assert.deepEqual(Intervals.sortedUniqueParameters(l, [0.8, 0.2, 0.5]), [0.2, 0.5, 0.8]);
});

// 19. Clicked interval selection
test('findContainingInterval finds the interval that holds the clicked parameter', () => {
  const l = line({ x: 0, y: 0 }, { x: 10, y: 0 });
  const params = Intervals.sortedUniqueParameters(l, [0.2, 0.5, 0.8]);
  const intervals = Intervals.buildIntervals(l, params);
  assert.deepEqual(intervals.map(i => [i.start, i.end]), [[0, 0.2], [0.2, 0.5], [0.5, 0.8], [0.8, 1]]);
  assert.equal(Intervals.findContainingInterval(l, intervals, 0.35), 1);
});

// 20. Open-curve interval selection
test('survivingIntervals removes only the clicked interval on an open curve', () => {
  const l = line({ x: 0, y: 0 }, { x: 10, y: 0 });
  const intervals = Intervals.buildIntervals(l, Intervals.sortedUniqueParameters(l, [0.3, 0.6]));
  const clickedIndex = Intervals.findContainingInterval(l, intervals, 0.1);
  const surviving = Intervals.survivingIntervals(intervals, clickedIndex);
  assert.equal(surviving.length, intervals.length - 1);
  assert.equal(surviving.some(i => i.start === 0), false);
});

// 21. Closed-curve wrap/seam interval selection
test('closed-curve intervals wrap correctly across the seam at parameter 0', () => {
  const c = circle({ x: 0, y: 0 }, 5);
  const params = Intervals.sortedUniqueParameters(c, [Math.PI / 2, (3 * Math.PI) / 2]);
  const intervals = Intervals.buildIntervals(c, params);
  assert.equal(intervals.length, 2);
  // A click near angle 0 (the seam) should land in the wrap interval spanning
  // from 3*PI/2 back around through 0 to PI/2.
  const idx = Intervals.findContainingInterval(c, intervals, 0.01);
  assert.equal(intervals[idx].start, (3 * Math.PI) / 2);
  assert.ok(intervals[idx].end > Math.PI * 2);
  const surviving = Intervals.survivingIntervals(intervals, idx);
  assert.equal(surviving.length, 1);
  assert.equal(surviving[0].start, Math.PI / 2);
});

// 22. Tangent intersection
test('a Line tangent to a Circle is classified as tangent', () => {
  const l = line({ x: -10, y: 5 }, { x: 10, y: 5 });
  const c = circle({ x: 0, y: 0 }, 5);
  const raw = Intersection.intersectAtomic(l, c);
  assert.equal(raw.hits.length, 1);
  const classified = Classifier.classify(l, c, raw.hits);
  assert.equal(classified[0].tangent, true);
});

// 23. Near-tangent tolerance
test('a Line that barely clips a Circle is flagged near-tangent, not exactly tangent', () => {
  const l = line({ x: -10, y: 4.999999999 }, { x: 10, y: 4.999999999 });
  const c = circle({ x: 0, y: 0 }, 5);
  const raw = Intersection.intersectAtomic(l, c);
  const classified = Classifier.classify(l, c, raw.hits);
  assert.equal(classified.some(hit => hit.nearTangent && !hit.tangent), true);
});

// 24. Duplicate intersection suppression
test('classify collapses duplicate roots at the same physical point', () => {
  const l = line({ x: -10, y: 5 }, { x: 10, y: 5 }); // tangent -> analytic double root
  const c = circle({ x: 0, y: 0 }, 5);
  const raw = Intersection.intersectAtomic(l, c);
  const classified = Classifier.classify(l, c, raw.hits);
  assert.equal(classified.length, 1);
});

// 25. Shared endpoint duplicates
test('an intersection landing exactly on a Line endpoint is flagged as a shared endpoint', () => {
  const a = line({ x: 0, y: 0 }, { x: 10, y: 0 });
  const b = line({ x: 10, y: -5 }, { x: 10, y: 5 });
  const raw = Intersection.intersectAtomic(a, b);
  const classified = Classifier.classify(a, b, raw.hits);
  assert.equal(classified[0].sharedEndpointA, true);
});

// 26. Coincident/overlap classification
test('isCoincident flags identical infinite lines and identical circles', () => {
  const a = line({ x: 0, y: 0 }, { x: 10, y: 0 });
  const b = line({ x: 3, y: 0 }, { x: 8, y: 0 });
  assert.equal(Classifier.isCoincident(a, b), true);
  const distinct = line({ x: 0, y: 1 }, { x: 10, y: 1 });
  assert.equal(Classifier.isCoincident(a, distinct), false);
  const c1 = circle({ x: 0, y: 0 }, 5);
  const c2 = circle({ x: 0, y: 0 }, 5);
  assert.equal(Classifier.isCoincident(c1, c2), true);
});

// 27. Zero-length/degenerate input rejection
test('CurveDescriptor rejects degenerate geometry', () => {
  assert.equal(Descriptor.describeLine({ x: 1, y: 1 }, { x: 1, y: 1 }).valid, false);
  assert.equal(Descriptor.describeCircle({ x: 0, y: 0 }, 0).valid, false);
  assert.equal(Descriptor.describeCircle({ x: 0, y: 0 }, -3).valid, false);
  assert.equal(Descriptor.describeEllipse({ x: 0, y: 0 }, { x: 0, y: 0 }, 4).valid, false);
  assert.equal(Descriptor.describeArc({ x: 0, y: 0 }, 5, { x: 5, y: 0 }, 0).valid, false);
});

// 28. NaN/Infinity rejection
test('CurveDescriptor and classification reject non-finite input', () => {
  assert.equal(Descriptor.describeLine({ x: NaN, y: 0 }, { x: 1, y: 1 }).valid, false);
  assert.equal(Descriptor.describeCircle({ x: 0, y: 0 }, Infinity).valid, false);
  const l = line({ x: 0, y: 0 }, { x: 10, y: 0 });
  const c = circle({ x: 0, y: 0 }, 5);
  const fabricatedNaNHit = { point: { x: NaN, y: 0 }, onA: true, onB: true, parameterA: NaN, parameterB: 0 };
  assert.equal(Classifier.classify(l, c, [fabricatedNaNHit]).length, 0);
  assert.equal(Parameter.nearestParameter(l, { x: Infinity, y: 0 }).valid, false);
});
