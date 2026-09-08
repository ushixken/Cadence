const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browser, Element } = require('../helpers/browser.cjs');

for (const value of ['Line', 'l', 'L', '  LiNe  ', 'li']) for (const key of ['Enter', ' ']) {
  test(`${JSON.stringify(value)} + ${JSON.stringify(key)} launches exactly once without finishing`, async () => {
    const b = await browser(); let starts = 0;
    const start = b.window.caderactViewport.createLineCommandSession;
    b.window.caderactViewport.createLineCommandSession = () => { starts++; return start(); };
    if (key === ' ') {
      b.input.value=value;b.emit(b.input,'input');b.emit(b.canvas,'pointerenter');b.key(' ',b.input,{code:'Space'});b.emit(b.window,'keyup',{key:' ',code:'Space'});
    } else b.launch(value, key);
    assert.equal(starts, 1); assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Line');
    assert.equal(b.input.value, ''); assert.equal(b.suggestions.hidden, true);
  });
}
test('click suggestion dispatches same launch and Tab only completes spelling', async () => {
  const b = await browser(); let starts = 0;
  const start = b.window.caderactViewport.createLineCommandSession;
  b.window.caderactViewport.createLineCommandSession = () => { starts++; return start(); };
  b.input.value = 'li'; b.emit(b.input, 'input'); b.key('Tab', b.input);
  assert.equal(b.input.value, 'Line'); assert.equal(starts, 0);
  const button = new Element('button'); button.suggestion = true; button.dataset.commandIndex = '0';
  b.emit(b.suggestions, 'click', { target: button });
  assert.equal(starts, 1); assert.equal(b.read('window.caderactCommandRouter.activeCommand'), 'Line');
});
test('unknown command returns deterministic feedback without document mutation', async () => {
  const b = await browser();
  const before = b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo})');
  b.launch('NotACommand');
  assert.deepEqual(b.read('window.caderactCommandRouter.lastResult'), { status: 'unknown-command', input: 'NotACommand' });
  assert.equal(b.commandPrompt.children[0].textContent, 'Unknown command: NotACommand');
  assert.equal(b.read('window.caderactCommandRouter.activeCommand'), null);
  assert.deepEqual(b.read('({document:modelReader.snapshot(),revision:documentController.currentRevision,stateId:documentController.currentStateId,history:documentController.historyInfo})'), before);
});
test('registry is the single deterministic autocomplete and routing source', async () => {
  const b = await browser();
  assert.deepEqual(b.read('window.caderactCommandRegistry.commands().map(command=>({name:command.name,aliases:command.aliases}))'), [
    { name: 'Arc', aliases: ['A'] }, { name: 'Circle', aliases: ['C'] }, { name: 'Copy', aliases: ['CP'] }, { name: 'Delete', aliases: ['DEL', 'E', 'ERASE'] }, { name: 'Ellipse', aliases: ['EL'] }, { name: 'Extend', aliases: ['EX'] }, { name: 'Line', aliases: ['L'] }, { name: 'Move', aliases: ['M'] }, { name: 'Polygon', aliases: ['PG'] }, { name: 'Polyline', aliases: ['Pline', 'PL'] },
    { name: 'Rectangle', aliases: ['Rect'] }, { name: 'Rotate', aliases: ['RO'] }, { name: 'Scale', aliases: ['SC'] }, { name: 'Trim', aliases: ['TR'] },
  ]);
  assert.deepEqual(b.read('window.caderactCommandRegistry.matches("Li").map(command=>command.name)'), ['Line']);
  assert.equal(b.run('window.caderactCommandRegistry.resolve("l").name'), 'Line');
  assert.equal(b.run('window.caderactCommandRegistry.resolve("rect").name'), 'Rectangle');
  assert.equal(b.run('window.caderactCommandRegistry.resolve("pl").name'), 'Polyline');
  assert.equal(b.run('window.caderactCommandRegistry.resolve("c").name'), 'Circle');
  assert.equal(b.run('window.caderactCommandRegistry.resolve("sc").name'), 'Scale');
  assert.equal(b.run('window.caderactCommandRegistry.resolve("erase").name'), 'Delete');
  assert.equal(b.run('window.caderactCommandRegistry.resolve("a").name'), 'Arc');
  assert.equal(b.run('window.caderactCommandRegistry.resolve("el").name'), 'Ellipse');
  assert.equal(b.run('window.caderactCommandRegistry.resolve("pol")'), null);
  assert.equal(b.run('window.caderactCommandRegistry.resolve("poly")'), null);
  assert.equal(b.run('window.caderactCommandRegistry.resolve("pg").name'), 'Polygon');
  for (const token of ['p','po','pol','poly','polyl','polyline']) assert.equal(b.run(`window.caderactCommandRegistry.search(${JSON.stringify(token)})[0].command.name`), 'Polyline');
  for (const token of ['polyg','polygon']) assert.equal(b.run(`window.caderactCommandRegistry.search(${JSON.stringify(token)})[0].command.name`), 'Polygon');
});
test('an active Line cannot be relaunched through command routing', async () => {
  const b = await browser(); b.launch(); b.point(100, 100); b.point(150, 150);
  const draftId = b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()[0].id');
  const outcome = b.window.caderactCommandRouter.execute('Line');
  assert.equal(outcome.status, 'command-active'); assert.equal(outcome.command, 'Line');
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.draftSegments()[0].id'), draftId);
  assert.equal(b.read('window.caderactCommandRouter.activeSession.draft.segmentCount'), 1);
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
