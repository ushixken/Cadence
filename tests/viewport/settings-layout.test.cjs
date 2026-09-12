'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/css/editor-page.css'), 'utf8');

test('S2A Settings uses one explicit row per setting with associated labels', () => {
  const ids = ['settings-grid-visible','settings-grid-color','settings-grid-opacity','settings-major-grid-color','settings-major-grid-opacity','settings-major-grid-interval','settings-x-axis-color','settings-x-axis-opacity','settings-y-axis-color','settings-y-axis-opacity'];
  for (const id of ids) {
    assert.match(html, new RegExp(`<div class="settings-row"><label for="${id}">[^<]+</label><div class="settings-control`));
    assert.equal((html.match(new RegExp(`id="${id}"`, 'g')) || []).length, 1);
  }
});

test('S2A opacity sliders and values share their row control container', () => {
  for (const stem of ['grid-opacity','major-grid-opacity','x-axis-opacity','y-axis-opacity']) {
    assert.match(html, new RegExp(`class="settings-control settings-range-control"><input id="settings-${stem}"[^>]*><output id="settings-${stem}-value"`));
  }
});

test('S2A modal has stable desktop columns and responsive stacking', () => {
  assert.match(css, /#settings-panel\s*\{[^}]*position:\s*fixed[^}]*width:\s*min\(560px/s);
  assert.match(css, /\.settings-row\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*\.settings-row\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.doesNotMatch(css, /#settings-panel label\s*\{\s*display:\s*contents/);
});
