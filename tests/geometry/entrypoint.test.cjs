'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('Production entrypoint index.html loads all M6/M7 geometry modules in correct dependency order', () => {
  const indexPath = path.join(__dirname, '../../index.html');
  const html = fs.readFileSync(indexPath, 'utf8');

  // Extract all script src attributes in document order
  const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const scriptSources = [];
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    scriptSources.push(match[1].replace(/^\//, ''));
  }

  const requiredModules = [
    'src/js/geometry/CurveDescriptor.js',
    'src/js/geometry/CurveParameter.js',
    'src/js/geometry/CurveIntersection.js',
    'src/js/geometry/IntersectionClassifier.js',
    'src/js/geometry/TrimIntervals.js',
    'src/js/geometry/TrimPlanner.js',
    'src/js/geometry/ExtendPlanner.js',
  ];

  // 1. Assert all 6 modules are present in index.html
  for (const mod of requiredModules) {
    assert.ok(
      scriptSources.includes(mod),
      `index.html must load ${mod}`
    );
  }

  // 2. Assert dependency ordering:
  // Pre-requisites must appear before TrimPlanner.js
  const trimPlannerIndex = scriptSources.indexOf('src/js/geometry/TrimPlanner.js');
  const extendPlannerIndex = scriptSources.indexOf('src/js/geometry/ExtendPlanner.js');
  assert.ok(trimPlannerIndex !== -1, 'TrimPlanner.js must be present in index.html');
  assert.ok(extendPlannerIndex !== -1, 'ExtendPlanner.js must be present in index.html');

  for (const dep of [
    'src/js/geometry/CurveDescriptor.js',
    'src/js/geometry/CurveParameter.js',
    'src/js/geometry/CurveIntersection.js',
    'src/js/geometry/IntersectionClassifier.js',
    'src/js/geometry/TrimIntervals.js',
  ]) {
    const depIndex = scriptSources.indexOf(dep);
    assert.ok(
      depIndex < trimPlannerIndex,
      `${dep} (index ${depIndex}) must be loaded before TrimPlanner.js (index ${trimPlannerIndex}) in index.html`
    );
    assert.ok(
      depIndex < extendPlannerIndex,
      `${dep} (index ${depIndex}) must be loaded before ExtendPlanner.js (index ${extendPlannerIndex}) in index.html`
    );
  }

  // TrimPlanner.js must appear before Viewport.js which relies on window.CaderactTrimPlanner
  const viewportIndex = scriptSources.indexOf('src/js/viewport/Viewport.js');
  assert.ok(viewportIndex !== -1, 'Viewport.js must be present in index.html');
  assert.ok(
    trimPlannerIndex < viewportIndex,
    `TrimPlanner.js (index ${trimPlannerIndex}) must be loaded before Viewport.js (index ${viewportIndex}) in index.html`
  );
  assert.ok(
    extendPlannerIndex < viewportIndex,
    `ExtendPlanner.js (index ${extendPlannerIndex}) must be loaded before Viewport.js (index ${viewportIndex}) in index.html`
  );

  // 3. Execution verification in clean VM context following index.html order up to Viewport.js
  const context = vm.createContext({
    window: {},
    console: { warn() {}, info() {}, error() {} },
    Math,
    Number,
    Object,
    Array,
    Map,
    Set,
  });
  context.window = context;

  for (const src of scriptSources) {
    if (src === 'src/js/viewport/Viewport.js') {
      // Prior to Viewport.js executing, CaderactTrimPlanner must be available on window
      assert.ok(
        context.CaderactTrimPlanner,
        'window.CaderactTrimPlanner must exist on window before Viewport.js is executed'
      );
      assert.ok(
        context.CaderactExtendPlanner,
        'window.CaderactExtendPlanner must exist on window before Viewport.js is executed'
      );
      assert.equal(typeof context.CaderactTrimPlanner.planTrim, 'function');
      assert.equal(typeof context.CaderactTrimPlanner.planExtend, 'undefined');
      assert.equal(typeof context.CaderactExtendPlanner.planExtend, 'function');
      break;
    }
    const fullPath = path.join(__dirname, '../../', src);
    if (fs.existsSync(fullPath)) {
      try {
        const code = fs.readFileSync(fullPath, 'utf8');
        vm.runInContext(code, context);
      } catch {
        // Some DOM-dependent scripts may fail without full browser stubs;
        // geometry scripts are pure and must run cleanly
      }
    }
  }
});
