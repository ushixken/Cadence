const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser, Element } = require('../helpers/browser.cjs');

for (const value of ['Line', 'l', 'L', '  LiNe  ', 'li']) for (const key of ['Enter', ' ']) {
  test(`${JSON.stringify(value)} + ${JSON.stringify(key)} launches exactly once without finishing`, async () => {
    const b = await browser(); let starts = 0;
    const start = b.window.caderactViewport.startLineCommand;
    b.window.caderactViewport.startLineCommand = () => { starts++; start(); };
    b.launch(value, key);
    assert.equal(starts, 1); assert.equal(b.read('activeCommand'), 'line');
    assert.equal(b.input.value, ''); assert.equal(b.suggestions.hidden, true);
  });
}
test('click suggestion dispatches same launch and Tab only completes spelling', async () => {
  const b = await browser(); let starts = 0;
  const start = b.window.caderactViewport.startLineCommand;
  b.window.caderactViewport.startLineCommand = () => { starts++; start(); };
  b.input.value = 'li'; b.emit(b.input, 'input'); b.key('Tab', b.input);
  assert.equal(b.input.value, 'Line'); assert.equal(starts, 0);
  const button = new Element('button'); button.suggestion = true; button.dataset.commandIndex = '0';
  b.emit(b.suggestions, 'click', { target: button });
  assert.equal(starts, 1); assert.equal(b.read('activeCommand'), 'line');
});
test('global printable typing focuses command input; Escape clears search', async () => {
  const b = await browser(); b.key('l');
  assert.equal(b.input.value, 'l'); assert.equal(b.document.activeElement, b.input);
  assert.equal(b.suggestions.hidden, false);
  b.key('Escape', b.input);
  assert.equal(b.input.value, ''); assert.equal(b.suggestions.hidden, true);
});
for (const tag of ['input', 'textarea', 'select', 'contenteditable']) {
  test(`printable typing in ${tag} is not hijacked`, async () => {
    const b = await browser(); const field = new Element(tag);
    field.isContentEditable = tag === 'contenteditable'; field.parent = b.document;
    const event = b.key('l', field);
    assert.equal(b.input.value, ''); assert.equal(event.defaultPrevented, false);
  });
}
for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) test(`${modifier} shortcut is not command typing`, async () => {
  const b = await browser(); b.key('l', b.canvas, { [modifier]: true });
  assert.equal(b.input.value, '');
});
