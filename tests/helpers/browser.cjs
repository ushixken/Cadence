const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Deliberately small DOM: listeners bubble target -> document -> window.
// It does not simulate browser default text insertion, layout, or real GPU APIs.
class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.listeners = {}; this.value = ''; this.hidden = true;
    this.disabled = false;
    this.children = []; this.textContent = ''; this.style = {};
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
  appendChild(child) { child.parent = this; child.owner ??= this.owner; this.children.push(child); return child; }
  replaceChildren(...children) { this.children = []; for (const child of children) this.appendChild(child); }
  dispatchEvent(event) {
    event.target ??= this;
    for (const fn of this.listeners[event.type] ?? []) fn(event);
    if (event.bubbles) this.parent?.dispatchEvent(event);
    return !event.defaultPrevented;
  }
  matches() { return ['input', 'textarea', 'select'].includes(this.tag); }
  contains(target) { for (let node = target; node; node = node.parent) if (node === this) return true; return false; }
  closest(selector) {
    if (this.suggestion && selector === '.command-suggestion') return this;
    if (selector === '[data-measure-command]') for (let node = this; node; node = node.parent) if (node.dataset?.measureCommand) return node;
    if (!selector.startsWith('.')) return null;
    const name = selector.slice(1);
    for (let node = this; node; node = node.parent) if (node.classes?.has(name)) return node;
    return null;
  }
  focus() { this.owner.activeElement = this; }
  blur() { this.owner.activeElement = null; }
  setPointerCapture(id) { this.capturedPointer = id; }
  hasPointerCapture(id) { return this.capturedPointer === id; }
  releasePointerCapture(id) { if (this.capturedPointer === id) this.capturedPointer = undefined; }
}

async function browser({ commands = true, realRenderer = false, gpu } = {}) {
  const window = new Element(); const document = new Element();
  document.parent = window;
  let canvas = new Element('canvas'); const viewportHost = new Element(); const input = new Element('input');
  viewportHost.classList.add('viewport'); viewportHost.parent = document; viewportHost.owner = document;
  const undoButton = new Element('button'); const redoButton = new Element('button');
  const fileNewButton = new Element('button'); const fileOpenButton = new Element('button'); const fileSaveButton = new Element('button'); const fileImportDxfButton = new Element('button'); const fileExportDxfButton = new Element('button');
  const fileMenu = new Element('li'); const fileMenuTrigger = new Element('button'); const fileMenuDropdown = new Element(); const editMenuTrigger = new Element('button');
  const toolsMenu = new Element('li'); const toolsMenuTrigger = new Element('button'); const measureMenuDropdown = new Element();
  const measureCommands=['Distance','Length','Radius','Diameter','Area','Perimeter','Angle','DistanceObject','MinDist','DistanceSum'];
  const measureLabels=['Distance','Length','Radius','Diameter','Area','Perimeter','Angle','Distance to Object','Minimum Distance','Cumulative Distance'];
  const measureMenuItems=measureCommands.map((command,index)=>{const item=new Element('button');item.dataset.measureCommand=command;item.textContent=measureLabels[index];return item});
  const snapWrap = new Element(); const snapTrigger = new Element('button'); const snapMenu = new Element(); const snapEnabled = new Element('input'); const snapDependent = new Element();
  const unitsWrap = new Element(); const unitsTrigger = new Element('button'); const unitsMenu = new Element(); const unitValue = new Element('strong');
  const unitOptions = ['mm','cm','m','in','ft'].map(unit => { const option=new Element('button'); option.dataset.unit=unit; return option; });
  const layersList = new Element(); const layerCreateButton = new Element('button'); const layerAssignButton = new Element('button');
  const layersTab=new Element('button'),propertiesTab=new Element('button'),layersView=new Element('section'),propertiesView=new Element('section'),propertiesContent=new Element();
  layersTab.hidden=false;propertiesTab.hidden=false;layersView.hidden=false;propertiesView.hidden=true;propertiesContent.hidden=false;
  const contextMenu = new Element(); contextMenu.hidden = true;
  const gridSnapButton = new Element('button'); gridSnapButton.classList.add('footer-tool'); gridSnapButton.setAttribute('aria-pressed', 'false');
  const orthoButton = new Element('button'); orthoButton.classList.add('footer-tool'); orthoButton.setAttribute('aria-pressed', 'false');
  const polarButton = new Element('button'); polarButton.classList.add('footer-tool'); polarButton.setAttribute('aria-pressed', 'false');
  const trackButton = new Element('button'); trackButton.classList.add('footer-tool'); trackButton.setAttribute('aria-pressed', 'false');
  const commandArea = new Element(); const commandWrap = new Element();
  commandArea.classList.add('command-area'); commandWrap.classList.add('command-input-wrap');
  commandArea.parent=document; commandArea.owner=document; commandWrap.parent=commandArea; commandWrap.owner=document;
  const commandName = new Element('span'); const commandInputArea = new Element();
  commandName.classList.add('command-name'); commandInputArea.classList.add('command-input-area');
  commandName.parent=commandWrap; commandInputArea.parent=commandWrap; commandName.owner=document; commandInputArea.owner=document;
  const suggestions = new Element(); const commandPrompt = new Element();
  const commandHistory = new Element();
  commandHistory.parent=commandWrap;commandHistory.owner=document;
  for (const el of [input, suggestions, commandPrompt]) { el.parent = commandInputArea; el.owner = document; }
  for (const el of [undoButton, redoButton, fileMenu, toolsMenu, editMenuTrigger]) { el.parent = document; el.owner = document; }
  fileMenuTrigger.parent = fileMenu; fileMenuDropdown.parent = fileMenu;
  for (const el of [fileNewButton, fileOpenButton, fileSaveButton, fileImportDxfButton, fileExportDxfButton]) el.parent = fileMenuDropdown;
  for (const el of [fileMenuTrigger, fileMenuDropdown, fileNewButton, fileOpenButton, fileSaveButton, fileImportDxfButton, fileExportDxfButton]) el.owner = document;
  toolsMenuTrigger.parent=toolsMenu;measureMenuDropdown.parent=toolsMenu;measureMenuDropdown.querySelectorAll=selector=>selector==='[data-measure-command]'?measureMenuItems:[];for(const item of measureMenuItems)item.parent=measureMenuDropdown;for(const el of [toolsMenuTrigger,measureMenuDropdown,...measureMenuItems])el.owner=document;
  snapWrap.classList.add('footer-dropdown'); unitsWrap.classList.add('footer-dropdown');
  snapTrigger.parent=snapWrap; snapMenu.parent=snapWrap; snapEnabled.parent=snapMenu; snapDependent.parent=snapMenu;
  unitsTrigger.parent=unitsWrap; unitsMenu.parent=unitsWrap; unitValue.parent=unitsTrigger;
  for(const option of unitOptions) option.parent=unitsMenu;
  for(const el of [snapWrap,snapTrigger,snapMenu,snapEnabled,snapDependent,unitsWrap,unitsTrigger,unitsMenu,unitValue,...unitOptions]) { el.owner=document; if(!el.parent) el.parent=document; }
  snapEnabled.checked=true; snapEnabled.dataset.snapMode='object'; unitValue.textContent='mm'; unitOptions[0].classList.add('is-selected');
  for (const el of [layersList,layerCreateButton,layerAssignButton,layersTab,propertiesTab,layersView,propertiesView,propertiesContent,contextMenu,gridSnapButton,orthoButton,polarButton,trackButton]) { el.parent=document; el.owner=document; }
  propertiesContent.parent=propertiesView;layersList.parent=layersView;
  let bounds = { left: 20, top: 40, width: 800, height: 600 };
  viewportHost.getBoundingClientRect = () => ({ left: 10, top: 30, width: bounds.width + 10, height: bounds.height + 10 });
  const drawCalls = [];
  const context2d = Object.fromEntries(['setTransform', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'arc', 'ellipse', 'stroke', 'fill', 'closePath', 'setLineDash'].map(name => [name, (...args) => drawCalls.push([name, ...args])]));
  function configureCanvas(target) {
    target.parent = viewportHost; target.owner = document;
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
  document.querySelector = selector => ({ canvas, '.viewport': viewportHost, '#grid-snap-toggle': gridSnapButton, '#ortho-toggle': orthoButton, '#polar-toggle': polarButton, '#track-toggle': trackButton, '#command-input': input, '#command-suggestions': suggestions, '#command-history': commandHistory, '#command-prompt': commandPrompt, '#command-name': commandName, '#undo-button': undoButton, '#redo-button': redoButton, '#file-new': fileNewButton, '#file-open': fileOpenButton, '#file-save': fileSaveButton, '#file-import-dxf': fileImportDxfButton, '#file-export-dxf': fileExportDxfButton, '.file-menu': fileMenu, '.file-menu-trigger': fileMenuTrigger, '#file-menu-actions': fileMenuDropdown, '.tools-menu':toolsMenu,'.tools-menu-trigger':toolsMenuTrigger,'#measure-menu-actions':measureMenuDropdown, '.snap-trigger': snapTrigger, '.snap-menu': snapMenu, '#snap-enabled': snapEnabled, '.snap-dependent': snapDependent, '.units-control': unitsTrigger, '.units-menu': unitsMenu, '[data-unit-value]': unitValue, '#layers-list': layersList, '#layer-create': layerCreateButton, '#layer-assign': layerAssignButton, '#sidebar-layers-tab':layersTab, '#sidebar-properties-tab':propertiesTab, '#layers-panel-view':layersView, '#properties-panel-view':propertiesView, '#properties-content':propertiesContent, '#editor-context-menu': contextMenu })[selector];
  document.querySelectorAll = selector => ({ '.menu-items > li > button':[fileMenuTrigger,toolsMenuTrigger,editMenuTrigger], '.snap-dependent input':[], '[data-snap-mode]':[snapEnabled], '.footer-tool':[gridSnapButton,orthoButton,polarButton,trackButton], '.unit-option':unitOptions })[selector] || [];
  document.createElement = tag => { const element = new Element(tag); element.owner = document; return element; };
  window.devicePixelRatio = 1;
  const frames = []; const renders = []; const sizes = [];
  let clock = 0, nextTimerId = 1; const timers = new Map();
  const setTimer = (fn, delay = 0) => { const id = nextTimerId++; timers.set(id, { fn, at: clock + delay }); return id; };
  const clearTimer = id => timers.delete(id);
  const fakeRenderer = { render: scene => renders.push(scene), resize: (...args) => sizes.push(args) };
  window.createCaderactRenderer = async () => fakeRenderer;
  let observedResize;
  const observerStats = { observeCount: 0, disconnectCount: 0 };
  const context = vm.createContext({ window, document, crypto: require('node:crypto').webcrypto, navigator: { gpu }, HTMLElement: Element,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    ResizeObserver: class { constructor(fn) { this.fn = fn; } observe() { observerStats.observeCount += 1; observedResize = this.fn; } disconnect() { observerStats.disconnectCount += 1; if (observedResize === this.fn) observedResize = undefined; } },
    requestAnimationFrame: fn => frames.push(fn), setTimeout: setTimer, clearTimeout: clearTimer, console: { info() {}, warn() {} },
  });
  const run = expression => vm.runInContext(expression, context);
  const load = file => vm.runInContext(fs.readFileSync(path.join(__dirname, '../../', file), 'utf8'), context, { filename: file });
  load('src/js/geometry/ArcGeometry.js');
  load('src/js/geometry/EllipseGeometry.js');
  load('src/js/geometry/PolygonGeometry.js');
  load('src/js/geometry/CurveDescriptor.js');
  load('src/js/geometry/BoundaryTolerance.js');
  load('src/js/geometry/BoundaryGeometry.js');
  load('src/js/geometry/RegionGeometry.js');
  load('src/js/geometry/HatchGeometry.js');
  load('src/js/geometry/BoundaryDiscovery.js');
  load('src/js/geometry/CurveParameter.js');
  load('src/js/geometry/CurveIntersection.js');
  load('src/js/geometry/IntersectionClassifier.js');
  load('src/js/geometry/TrimIntervals.js');
  load('src/js/geometry/TrimPlanner.js');
  load('src/js/geometry/ExtendPlanner.js');
  load('src/js/geometry/OffsetGeometry.js');
  load('src/js/geometry/Measurement.js');
  load('src/js/geometry/DimensionFormatter.js');
  load('src/js/geometry/DimensionGeometry.js');
  load('src/js/geometry/AnnotationGeometry.js');
  load('src/js/rendering/StrokeStyle.js');
  load('src/js/rendering/CircleTessellation.js');
  load('src/js/rendering/EllipseTessellation.js');
  if (realRenderer) {
    for (const name of ['Renderer', 'Canvas2DRenderer', 'createCaderactRenderer']) load(`src/js/rendering/${name}.js`);
  }
  load('src/js/document/DocumentController.js');
  load('src/js/document/CaderactUnits.js');
  load('src/js/document/ObjectProperties.js');
  load('src/js/document/CaderactDocument.js');
  load('src/js/document/CaderactReferences.js');
  load('src/js/document/CaderactPersistence.js');
  load('src/js/io/dxf/DxfLimits.js');
  load('src/js/io/dxf/DxfDiagnostics.js');
  load('src/js/io/dxf/DxfProperties.js');
  load('src/js/io/dxf/DxfText.js');
  load('src/js/io/dxf/DxfParser.js');
  load('src/js/io/dxf/DxfImport.js');
  load('src/js/io/dxf/DxfExport.js');
  load('src/js/editor/DocumentSession.js');
  load('src/js/viewport/ViewportCamera.js');
  load('src/js/viewport/GridPolicy.js');
  load('src/js/viewport/ViewportScene.js');
  load('src/js/viewport/ViewportCanvas.js');
  load('src/js/viewport/ViewportNavigation.js');
  load('src/js/viewport/InteractionVisuals.js');
  load('src/js/viewport/AnnotationOverlay.js');
  load('src/js/editor/LineDraftSession.js');
  load('src/js/editor/LinearDimensionDraftSession.js');
  load('src/js/editor/AngularDimensionDraftSession.js');
  load('src/js/editor/GeometryTransform.js');
  load('src/js/editor/RectangleDraftSession.js');
  load('src/js/editor/PolylineDraftSession.js');
  load('src/js/editor/CircleDraftSession.js');
  load('src/js/editor/ArcDraftSession.js');
  load('src/js/editor/EllipseDraftSession.js');
  load('src/js/editor/PolygonDraftSession.js');
  load('src/js/editor/PointInput.js');
  load('src/js/editor/PrecisionInput.js');
  load('src/js/editor/DynamicInput.js');
  load('src/js/editor/OrthoConstraint.js');
  load('src/js/editor/UserPreferences.js');
  load('src/js/editor/PolarConstraint.js');
  load('src/js/editor/SnapResolver.js');
  load('src/js/editor/ObjectSnapTracking.js');
  load('src/js/editor/SelectionManager.js');
  load('src/js/editor/SelectionBox.js');
  load('src/js/editor/GripManager.js');
  load('src/js/editor/CommandRegistry.js');
  load('src/js/editor/CommandRouter.js');
  load('src/js/editor/CommandFeedback.js');
  load('src/js/viewport/Viewport.js');
  load('src/js/editor/footer-controls.js');
  if (commands) load('src/js/editor/command-input.js');
  if (commands) load('src/js/editor/measure-menu.js');
  if (commands) load('src/js/editor/history-actions.js');
  if (commands) load('src/js/editor/file-actions.js');
  if (commands) load('src/js/editor/layers-panel.js');
  if (commands) load('src/js/editor/properties-panel.js');
  if (commands) load('src/js/editor/ContextMenu.js');
  if (commands) load('src/js/editor/context-menu.js');
  await settle();
  const emit = (target, type, props = {}) => {
    const event = { type, bubbles: true, button: 0, pointerId: 1, ctrlKey: false, altKey: false, metaKey: false,
      defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...props };
    target.dispatchEvent(event); return event;
  };
  return { window, document, viewportHost, contextMenu, gridSnapButton, orthoButton, polarButton, trackButton, snapTrigger, snapEnabled, get canvas() { return canvas; }, input, suggestions, commandHistory, commandPrompt, undoButton, redoButton, fileNewButton, fileOpenButton, fileSaveButton, fileImportDxfButton, fileExportDxfButton, fileMenu, fileMenuTrigger, fileMenuDropdown, toolsMenu,toolsMenuTrigger,measureMenuDropdown,measureMenuItems, editMenuTrigger, unitsTrigger, unitsMenu, unitValue, unitOptions, layersList, layerCreateButton, layerAssignButton, layersTab,propertiesTab,layersView,propertiesView,propertiesContent,context, run, load, emit, renders, sizes, fakeRenderer, drawCalls, observerStats,
    advance(milliseconds) { clock += milliseconds; let ran; do { ran = false; for (const [id,timer] of [...timers].sort((a,b)=>a[1].at-b[1].at)) if (timer.at <= clock) { timers.delete(id); timer.fn(); ran = true; } } while (ran); },
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
