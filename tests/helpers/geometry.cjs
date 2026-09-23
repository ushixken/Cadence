'use strict';
// Loads only the pure geometry modules (src/js/geometry/*.js) into a bare vm
// sandbox with nothing but a `window` object -- no DOM, Canvas2D, WebGPU,
// Viewport, CommandRouter, or document/transaction machinery of any kind.
// This keeps geometry tests honestly framework-independent instead of
// borrowing the full-app browser() harness used by command/viewport tests.
const fs = require('node:fs');
const path = require('node:path');

const GEOMETRY_DIR = path.join(__dirname, '..', '..', 'src', 'js', 'geometry');
const MODULE_FILES = [
  'ArcGeometry.js',
  'EllipseGeometry.js',
  'PolygonGeometry.js',
  'CurveDescriptor.js',
  'CurveParameter.js',
  'CurveIntersection.js',
  'IntersectionClassifier.js',
  'TrimIntervals.js',
  'TrimPlanner.js',
  'ExtendPlanner.js',
  'CornerModificationPlanner.js',
  'JoinPlanner.js',
  'SplitBreakPlanner.js',
];

// Evaluated with `new Function` (host realm, not vm.createContext) so the
// resulting values (arrays, plain objects, frozen objects) share the same
// intrinsics as the test file itself -- vm.createContext's separate realm
// would otherwise make assert.deepStrictEqual reject structurally-identical
// values as "not reference-equal".
function loadGeometry() {
  const window = {};
  for (const file of MODULE_FILES) {
    const code = fs.readFileSync(path.join(GEOMETRY_DIR, file), 'utf8');
    // eslint-disable-next-line no-new-func
    const run = new Function('window', `${code}\n//# sourceURL=${file}`);
    run(window);
  }
  return window;
}

module.exports = { loadGeometry };
