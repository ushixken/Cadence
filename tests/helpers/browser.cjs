const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Deliberately small DOM: listeners bubble target -> document -> window.
// It does not simulate browser default text insertion, layout, or real GPU APIs.
class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.listeners = {}; this.value = ''; this.hidden = true;
    this.dataset = {}; this.attributes = {}; this.isContentEditable = false;
    const classes = this.classes = new Set();
    this.classList = {
      add: x => classes.add(x), remove: x => classes.delete(x),
      contains: x => classes.has(x),
      toggle: (x, on) => on ? classes.add(x) : classes.delete(x),
    };
  }
  addEventListener(type, fn) { (this.listeners[type] ??= []).push(fn); }
  removeEventListener(type, fn) { this.listeners[type] = (this.listeners[type] ?? []).filter(listener => listener !== fn); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  cloneNode() {
    const clone = new Element(this.tag); clone.hidden = this.hidden; clone.dataset = { ...this.dataset }; clone.attributes = { ...this.attributes };
    for (const name of this.classes) clone.classList.add(name);
    clone.width = this.width; clone.height = this.height; clone._configure = this._configure; clone._replace = this._replace;
    clone._configure?.(clone); return clone;
  }
  replaceWith(replacement) { this._replace?.(replacement); }
  dispatchEvent(event) {
    event.target ??= this;
    for (const fn of this.listeners[event.type] ?? []) fn(event);
    if (event.bubbles) this.parent?.dispatchEvent(event);
    return !event.defaultPrevented;
  }
  matches() { return ['input', 'textarea', 'select'].includes(this.tag); }
  closest() { return this.suggestion ? this : null; }
  focus() { this.owner.activeElement = this; }
  blur() { this.owner.activeElement = null; }
  setPointerCapture(id) { this.capturedPointer = id; }
}

async function browser({ commands = true, realRenderer = false, gpu } = {}) {
  const window = new Element(); const document = new Element();
  document.parent = window;
  let canvas = new Element('canvas'); const input = new Element('input');
  const suggestions = new Element();
  for (const el of [canvas, input, suggestions]) { el.parent = document; el.owner = document; }
  let bounds = { left: 20, top: 40, width: 800, height: 600 };
  const drawCalls = [];
  const context2d = Object.fromEntries(['setTransform', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'stroke'].map(name => [name, (...args) => drawCalls.push([name, ...args])]));
  function configureCanvas(target) {
    target.parent = document; target.owner = document;
    target.getBoundingClientRect = () => ({ ...bounds });
    Object.defineProperties(target, { clientWidth: { configurable: true, get: () => bounds.width }, clientHeight: { configurable: true, get: () => bounds.height } });
    let contextType;
    target.getContext = type => {
      if (contextType && contextType !== type) return null;
      contextType = type;
      return type === '2d' ? context2d : { configure() {} };
    };
  }
  canvas._configure = configureCanvas; canvas._replace = replacement => { canvas = replacement; }; configureCanvas(canvas);
  document.querySelector = selector => ({ canvas, '#command-input': input, '#command-suggestions': suggestions })[selector];
  window.devicePixelRatio = 1;
  const frames = []; const renders = []; const sizes = [];
  const fakeRenderer = { render: scene => renders.push(scene), resize: (...args) => sizes.push(args) };
  window.createCaderactRenderer = async () => fakeRenderer;
  let observedResize;
  const observerStats = { observeCount: 0, disconnectCount: 0 };
  const context = vm.createContext({ window, document, crypto: require('node:crypto').webcrypto, navigator: { gpu }, HTMLElement: Element,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    ResizeObserver: class { constructor(fn) { this.fn = fn; } observe() { observerStats.observeCount += 1; observedResize = this.fn; } disconnect() { observerStats.disconnectCount += 1; if (observedResize === this.fn) observedResize = undefined; } },
    requestAnimationFrame: fn => frames.push(fn), console: { info() {}, warn() {} },
  });
  const run = expression => vm.runInContext(expression, context);
  const load = file => vm.runInContext(fs.readFileSync(path.join(__dirname, '../../', file), 'utf8'), context, { filename: file });
  if (realRenderer) {
    for (const name of ['Renderer', 'Canvas2DRenderer', 'createCaderactRenderer']) load(`src/js/rendering/${name}.js`);
  }
  load('src/js/document/DocumentController.js');
  load('src/js/document/CaderactUnits.js');
  load('src/js/document/CaderactDocument.js');
  load('src/js/document/CaderactReferences.js');
  load('src/js/document/CaderactPersistence.js');
  load('src/js/viewport/ViewportCamera.js');
  load('src/js/viewport/ViewportScene.js');
  load('src/js/viewport/ViewportCanvas.js');
  load('src/js/viewport/ViewportNavigation.js');
  load('src/js/editor/LineDraftSession.js');
  load('src/js/editor/CommandRegistry.js');
  load('src/js/editor/CommandRouter.js');
  load('src/js/viewport/Viewport.js');
  if (commands) load('src/js/editor/command-input.js');
  await settle();
  const emit = (target, type, props = {}) => {
    const event = { type, bubbles: true, button: 0, pointerId: 1, ctrlKey: false, altKey: false, metaKey: false,
      defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...props };
    target.dispatchEvent(event); return event;
  };
  return { window, document, get canvas() { return canvas; }, input, suggestions, context, run, load, emit, renders, sizes, fakeRenderer, drawCalls, observerStats,
    flushOne() { const frame = frames.shift(); if (frame) frame(); return Boolean(frame); },
    flush() { while (frames.length) frames.shift()(); },
    read(expression) { return JSON.parse(run(`JSON.stringify(${expression})`)); },
    resize(width, height, dpr = 1) { bounds = { ...bounds, width, height }; window.devicePixelRatio = dpr; observedResize?.(); },
    key(key, target = canvas, props = {}) { return emit(target, 'keydown', { key, code: key === ' ' ? 'Space' : key, ...props }); },
    point(x, y, type = 'pointerdown', props = {}) { return emit(canvas, type, { clientX: bounds.left + x, clientY: bounds.top + y, ...props }); },
    launch(value = 'Line', key = 'Enter') { input.value = value; emit(input, 'input'); return emit(input, 'keydown', { key, code: key === ' ' ? 'Space' : key }); },
  };
}
async function settle() { for (let i = 0; i < 10; i++) await Promise.resolve(); }
module.exports = { browser, Element, settle };
