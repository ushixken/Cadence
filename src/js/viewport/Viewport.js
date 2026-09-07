let canvas = document.querySelector("canvas")
const canvasOwner = window.CaderactViewportCanvas.createOwner(canvas)

const viewportSettings = {
  gridExtent: 1000, baseGridSpacing: 10, minimumGridSpacingPixels: 28,
  initialZoom: 5, wheelZoomSensitivity: 0.0015, dragZoomSensitivity: 0.01,
  backgroundColor: "#182633", gridColor: "rgba(167, 175, 187, 0.28)",
  majorGridColor: "rgba(167, 175, 187, 0.45)", gridBoundaryColor: "rgba(167, 175, 187, 0.55)", xAxisColor: "#984b51",
  yAxisColor: "#3b7658", geometryColor: "#e8edf4", previewColor: "rgba(232, 237, 244, 0.65)", snapMarkerColor: "#f2cf72", selectionColor: "#63b7e6",
  gripColor: "#e8edf4", gripHoverColor: "#f2cf72", gripActiveColor: "#63b7e6",
  draftPointColor: "#e8edf4",
  acceptedDraftColor: "#e8edf4",
}

const viewportCamera = window.CaderactViewportCamera.createCamera(viewportSettings.initialZoom)
const camera = viewportCamera.state
const documentSession = window.CaderactDocumentSession.createSession()
window.caderactDocumentSession = documentSession
let { reader: modelReader, recordGateway, layerGateway, unitGateway, controller: documentController } = documentSession.store

let viewportWidth = 0, viewportHeight = 0
let renderer = null, isInitialized = false, isRenderScheduled = false
let rendererStatus = "initializing", rendererError = null, recoveryPromise = null
let navigation = null, resizeObserver = null
let activeSnapResult = null
let snapModes = Object.freeze({ endpoint: true, midpoint: true, grid: true })
const snapModeListeners = new Set()
const viewportHost = canvas.parentElement || canvas.parent
const interactionVisuals = window.CaderactInteractionVisuals.createController({ host: viewportHost })
const snapResolver = window.CaderactSnapResolver.createResolver()
const selection = window.CaderactSelection.createSelection()
const grips = window.CaderactGrips.createManager({
  getRecords: () => modelReader.records(), getSelectedIds: selection.selectedIds, worldToScreen,
  replaceRecord: (id, record) => recordGateway.replace(id, record), requestRender,
})
let selectionHistoryUnsubscribe = null
window.caderactSelection = selection
window.caderactGrips = grips

function getActiveCommandSession() {
  return window.caderactCommandRouter?.activeSession || null
}

function worldToScreen(x, y) {
  return viewportCamera.worldToScreen(x, y)
}

function screenToWorld(x, y) {
  return viewportCamera.screenToWorld(x, y)
}

function zoomAtScreenPoint(zoom, x, y) {
  viewportCamera.zoomAtScreenPoint(zoom, x, y)
}

function getCanvasPoint(event) {
  const bounds = canvas.getBoundingClientRect()
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

function getViewportPoint(event) {
  const bounds = viewportHost.getBoundingClientRect()
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}

const sceneBuilder = window.CaderactViewportScene.createSceneBuilder({
  viewportSettings,
  camera: viewportCamera,
  getViewportSize: () => ({ width: viewportWidth, height: viewportHeight }),
  getDocumentUnit: () => modelReader.units().length,
  getRecords: () => modelReader.records(),
  getDraftLines: () => getActiveCommandSession()?.getDraftLines?.() || [],
  getPreviewLines: () => getActiveCommandSession()?.getPreviewLines?.() || [],
  getCirclePreview: () => getActiveCommandSession()?.getCirclePreview?.() || null,
  getArcPreview: () => getActiveCommandSession()?.getArcPreview?.() || null,
  getEllipsePreview: () => getActiveCommandSession()?.getEllipsePreview?.() || null,
  getDraftPoints: () => getActiveCommandSession()?.getDraftPoints?.() || [],
  getSnapResult: () => activeSnapResult,
  getSelectedIds: selection.selectedIds,
  getGrips: () => getActiveCommandSession() ? [] : grips.displayGrips(),
  getGripPreview: grips.previewRecord,
})

function createScene() {
  return sceneBuilder.createScene()
}

function requestRender() {
  if (!renderer || isRenderScheduled || viewportWidth <= 0 || viewportHeight <= 0) return
  isRenderScheduled = true
  requestAnimationFrame(() => {
    isRenderScheduled = false
    const activeRenderer = renderer
    if (!activeRenderer) return
    try { activeRenderer.render(createScene()) }
    catch (error) {
      if (rendererStatus === "fallback-active" || activeRenderer.kind === "canvas2d") {
        console.warn("Caderact Canvas2D fallback failed; rendering disabled", error)
        failRenderer(error, activeRenderer)
      } else {
        console.warn("Caderact renderer failed; attempting recovery", error)
        recoverRenderer(activeRenderer)
      }
    }
  })
}

function createCommandPrompt(commandName, instruction) {
  return Object.freeze({ commandName, instruction, text: `${commandName}: ${instruction}` })
}

function createLineCommandSession({ setPrompt = () => {} } = {}) {
  const draft = window.CaderactLineDraftSession.createSession({
    createSegment: recordGateway.createLine,
    commitSegments: recordGateway.createAll,
  })
  let promptPresentation = createCommandPrompt("Line", "Specify first point")
  function updatePrompt(instruction) { promptPresentation = createCommandPrompt("Line", instruction); setPrompt(promptPresentation.text, promptPresentation) }

  function handlePointerDown(point) {
    const outcome = draft.acceptPoint(point)
    if (outcome.status === "first-point") updatePrompt("Specify next point")
    requestRender()
    return outcome
  }
  function handlePointerMove(point) { draft.updatePointer(point); requestRender() }
  function handlePointerLeave() {
    if (draft.preview() !== null) { draft.clearPointer(); requestRender() }
  }
  function handleInput(input) {
    clearSnap()
    const parsed = window.CaderactPointInput.parseAndResolve(input, {
      currentUnit: modelReader.units().length,
      anchor: draft.currentPoint,
    })
    if (parsed.status !== "point-resolved") {
      const messages = {
        "invalid-coordinate": "Enter a point as x,y",
        "invalid-number": "Coordinate values must be finite numbers",
        "unsupported-unit": `Unsupported unit${parsed.unit ? `: ${parsed.unit}` : ""}`,
        "relative-point-without-anchor": "Relative point requires a previous point",
      }
      return Object.freeze({ status: "invalid-input", reason: parsed.reason, command: "Line",
        message: messages[parsed.reason] || "Invalid coordinate" })
    }
    const point = Object.freeze({ x: parsed.x, y: parsed.y })
    const outcome = draft.acceptPoint(point)
    if (outcome.status === "first-point") updatePrompt("Specify next point")
    requestRender()
    return Object.freeze({ status: "input-accepted", command: "Line", kind: "point", point, outcome })
  }
  function finish() {
    clearSnap()
    const outcome = draft.finish()
    if (outcome.status !== "committed" && outcome.status !== "no-op") {
      updatePrompt("Unable to commit; draft preserved")
      requestRender()
      return Object.freeze({ status: "invalid-input", reason: "commit-failed", command: "Line", outcome })
    }
    requestRender()
    return Object.freeze({ status: "command-completed", command: "Line", outcome })
  }
  function cancel() {
    clearSnap(); draft.cancel(); requestRender()
    return Object.freeze({ status: "command-cancelled", command: "Line" })
  }
  function stepUndo() {
    clearSnap()
    const outcome = draft.stepUndo()
    if (outcome.status === "step-undone") updatePrompt("Specify next point")
    requestRender()
    return outcome
  }
  function getSnapCandidates() {
    return draft.acceptedPoints().map((point, index) => Object.freeze({
      kind: "draft-point", point, stableKey: `line-draft:${index}`,
      reference: Object.freeze({ kind: "draft-point", index }),
    }))
  }
  function hasPointerPreview() { return draft.hasFirstPoint }
  function getPreviewLines() { const preview = draft.preview(); return preview ? [preview] : [] }

  requestRender()
  return Object.freeze({
    name: "Line", draft, finish, cancel, stepUndo,
    handlePointerDown, handlePointerMove, handlePointerLeave, handleInput,
    getDraftLines: draft.draftSegments, getPreview: draft.preview, getPreviewLines,
    getDraftPoints: draft.acceptedPoints,
    getSnapCandidates, hasPointerPreview,
    get prompt() { return promptPresentation.text }, get promptPresentation() { return promptPresentation },
  })
}

function createCircleCommandSession({ setPrompt = () => {} } = {}) {
  const draft = window.CaderactCircleDraftSession.createSession({
    createCircle: recordGateway.createCircle,
    commitRecords: recordGateway.createAll,
  })
  let promptPresentation = createCommandPrompt("Circle", "Specify center point")
  function updatePrompt(instruction) { promptPresentation = createCommandPrompt("Circle", instruction); setPrompt(promptPresentation.text, promptPresentation) }
  function presentOutcome(outcome, point = null) {
    requestRender()
    if (outcome.status === "center-accepted") {
      updatePrompt("Specify radius point")
      return Object.freeze({ status: "input-accepted", command: "Circle", kind: "point", point, outcome })
    }
    if (outcome.status === "circle-committed") {
      clearSnap()
      return Object.freeze({ status: "command-completed", command: "Circle", outcome })
    }
    if (outcome.status === "zero-radius") {
      updatePrompt("Radius point must differ from center")
      return Object.freeze({ status: "invalid-input", reason: "zero-radius", command: "Circle",
        message: "Circle radius must be greater than zero", outcome })
    }
    updatePrompt("Unable to commit; draft preserved")
    return Object.freeze({ status: "invalid-input", reason: "commit-failed", command: "Circle", outcome })
  }
  function handlePointerDown(point) { return presentOutcome(draft.acceptPoint(point), point) }
  function handlePointerMove(point) { draft.updatePointer(point); requestRender() }
  function handlePointerLeave() { draft.clearPointer(); clearSnap(); requestRender() }
  function handleInput(input) {
    clearSnap()
    const parsed = window.CaderactPointInput.parseAndResolve(input, {
      currentUnit: modelReader.units().length,
      anchor: draft.center,
    })
    if (parsed.status !== "point-resolved") {
      const messages = {
        "invalid-coordinate": "Enter a point as x,y", "invalid-number": "Coordinate values must be finite numbers",
        "unsupported-unit": `Unsupported unit${parsed.unit ? `: ${parsed.unit}` : ""}`,
        "relative-point-without-anchor": "Relative point requires a previous point",
      }
      return Object.freeze({ status: "invalid-input", reason: parsed.reason, command: "Circle",
        message: messages[parsed.reason] || "Invalid coordinate" })
    }
    const point = Object.freeze({ x: parsed.x, y: parsed.y })
    return presentOutcome(draft.acceptPoint(point), point)
  }
  function finish() {
    clearSnap(); draft.finish(); requestRender()
    return Object.freeze({ status: "command-completed", command: "Circle" })
  }
  function cancel() {
    clearSnap(); draft.cancel(); requestRender()
    return Object.freeze({ status: "command-cancelled", command: "Circle" })
  }
  function getSnapCandidates() {
    return draft.acceptedPoints().map((point, index) => Object.freeze({
      kind: "draft-point", point, stableKey: `circle-draft:${index}`,
      reference: Object.freeze({ kind: "draft-point", index }),
    }))
  }
  requestRender()
  return Object.freeze({
    name: "Circle", draft, finish, cancel, handlePointerDown, handlePointerMove, handlePointerLeave, handleInput,
    getCirclePreview: draft.preview, getDraftPoints: draft.acceptedPoints, getSnapCandidates,
    hasPointerPreview: () => draft.hasCenter,
    get prompt() { return promptPresentation.text }, get promptPresentation() { return promptPresentation },
  })
}

function createArcCommandSession({setPrompt=()=>{}}={}){
  const draft=window.CaderactArcDraftSession.createSession({createArc:recordGateway.createArc,commitRecords:recordGateway.createAll})
  let promptPresentation=createCommandPrompt("Arc","Specify start point")
  function updatePrompt(instruction){promptPresentation=createCommandPrompt("Arc",instruction);setPrompt(promptPresentation.text,promptPresentation)}
  function presentOutcome(outcome,point=null){
    requestRender()
    if(outcome.status==="start-accepted"){updatePrompt("Specify second point");return Object.freeze({status:"input-accepted",command:"Arc",kind:"point",point,outcome})}
    if(outcome.status==="second-accepted"){updatePrompt("Specify end point");return Object.freeze({status:"input-accepted",command:"Arc",kind:"point",point,outcome})}
    if(outcome.status==="arc-committed"){clearSnap();return Object.freeze({status:"command-completed",command:"Arc",outcome})}
    if(outcome.status==="repeated-point"||outcome.status==="invalid-arc"){
      updatePrompt(outcome.status==="repeated-point"?"Second point must differ from start":"End point must form a stable non-collinear arc")
      return Object.freeze({status:"invalid-input",reason:outcome.reason||outcome.status,command:"Arc",message:"Arc requires three distinct, non-collinear points",outcome})
    }
    updatePrompt("Unable to commit; draft preserved")
    return Object.freeze({status:"invalid-input",reason:"commit-failed",command:"Arc",outcome})
  }
  function handlePointerDown(point){return presentOutcome(draft.acceptPoint(point),point)}
  function handlePointerMove(point){draft.updatePointer(point);requestRender()}
  function handlePointerLeave(){draft.clearPointer();clearSnap();requestRender()}
  function handleInput(input){
    clearSnap()
    const parsed=window.CaderactPointInput.parseAndResolve(input,{currentUnit:modelReader.units().length,anchor:draft.currentPoint})
    if(parsed.status!=="point-resolved")return Object.freeze({status:"invalid-input",reason:parsed.reason,command:"Arc",message:"Enter a point as x,y"})
    const point=Object.freeze({x:parsed.x,y:parsed.y});return presentOutcome(draft.acceptPoint(point),point)
  }
  function finish(){clearSnap();draft.finish();requestRender();return Object.freeze({status:"command-completed",command:"Arc"})}
  function cancel(){clearSnap();draft.cancel();requestRender();return Object.freeze({status:"command-cancelled",command:"Arc"})}
  function getSnapCandidates(){return draft.acceptedPoints().map((point,index)=>Object.freeze({kind:"draft-point",point,
    stableKey:`arc-draft:${index}`,reference:Object.freeze({kind:"draft-point",index})}))}
  requestRender()
  return Object.freeze({name:"Arc",draft,finish,cancel,handlePointerDown,handlePointerMove,handlePointerLeave,handleInput,
    getArcPreview:draft.preview,getDraftPoints:draft.acceptedPoints,getSnapCandidates,hasPointerPreview:()=>draft.hasFirstPoint,
    get prompt(){return promptPresentation.text},get promptPresentation(){return promptPresentation}})
}

function createEllipseCommandSession({setPrompt=()=>{}}={}){
  const draft=window.CaderactEllipseDraftSession.createSession({createEllipse:recordGateway.createEllipse,commitRecords:recordGateway.createAll})
  let promptPresentation=createCommandPrompt("Ellipse","Specify first axis endpoint")
  function updatePrompt(instruction){promptPresentation=createCommandPrompt("Ellipse",instruction);setPrompt(promptPresentation.text,promptPresentation)}
  function presentOutcome(outcome,point=null){
    requestRender()
    if(outcome.status==="first-axis-point-accepted"){updatePrompt("Specify second axis endpoint");return Object.freeze({status:"input-accepted",command:"Ellipse",kind:"point",point,outcome})}
    if(outcome.status==="second-axis-point-accepted"){updatePrompt("Specify second-axis distance");return Object.freeze({status:"input-accepted",command:"Ellipse",kind:"point",point,outcome})}
    if(outcome.status==="ellipse-committed"){clearSnap();return Object.freeze({status:"command-completed",command:"Ellipse",outcome})}
    if(outcome.status==="invalid-first-axis")return Object.freeze({status:"invalid-input",reason:outcome.reason,command:"Ellipse",message:"First axis endpoints must differ",outcome})
    if(outcome.status==="invalid-second-axis")return Object.freeze({status:"invalid-input",reason:outcome.reason,command:"Ellipse",message:"Second-axis distance must be greater than zero",outcome})
    updatePrompt("Unable to commit; draft preserved")
    return Object.freeze({status:"invalid-input",reason:"commit-failed",command:"Ellipse",outcome})
  }
  function handlePointerDown(point){return presentOutcome(draft.acceptPoint(point),point)}
  function handlePointerMove(point){draft.updatePointer(point);requestRender()}
  function handlePointerLeave(){draft.clearPointer();clearSnap();requestRender()}
  function handleInput(input){
    clearSnap()
    const parsed=window.CaderactPointInput.parseAndResolve(input,{currentUnit:modelReader.units().length,anchor:draft.currentPoint})
    if(parsed.status!=="point-resolved")return Object.freeze({status:"invalid-input",reason:parsed.reason,command:"Ellipse",message:"Enter a point as x,y"})
    const point=Object.freeze({x:parsed.x,y:parsed.y});return presentOutcome(draft.acceptPoint(point),point)
  }
  function finish(){clearSnap();draft.finish();requestRender();return Object.freeze({status:"command-completed",command:"Ellipse"})}
  function cancel(){clearSnap();draft.cancel();requestRender();return Object.freeze({status:"command-cancelled",command:"Ellipse"})}
  function getSnapCandidates(){return draft.acceptedPoints().map((point,index)=>Object.freeze({kind:"draft-point",point,
    stableKey:`ellipse-draft:${index}`,reference:Object.freeze({kind:"draft-point",index})}))}
  requestRender()
  return Object.freeze({name:"Ellipse",draft,finish,cancel,handlePointerDown,handlePointerMove,handlePointerLeave,handleInput,
    getEllipsePreview:draft.preview,getDraftPoints:draft.acceptedPoints,getSnapCandidates,hasPointerPreview:()=>draft.hasFirstPoint,
    get prompt(){return promptPresentation.text},get promptPresentation(){return promptPresentation}})
}

function createPolygonCommandSession({setPrompt=()=>{}}={}){
  const draft=window.CaderactPolygonDraftSession.createSession({createSegment:recordGateway.createLine,commitSegments:recordGateway.createAll})
  let editingSides=true
  let promptPresentation=createCommandPrompt("Polygon","Enter number of sides <4>")
  function updatePrompt(instruction){promptPresentation=createCommandPrompt("Polygon",instruction);setPrompt(promptPresentation.text,promptPresentation)}
  function presentPoint(outcome,point=null){
    requestRender()
    if(outcome.status==="center-accepted"){updatePrompt("Specify radius point");return Object.freeze({status:"input-accepted",command:"Polygon",kind:"point",point,outcome})}
    if(outcome.status==="polygon-committed"){clearSnap();return Object.freeze({status:"command-completed",command:"Polygon",outcome})}
    if(outcome.status==="zero-radius"){updatePrompt("Radius point must differ from center");return Object.freeze({status:"invalid-input",reason:"zero-radius",command:"Polygon",message:"Polygon radius must be greater than zero",outcome})}
    if(outcome.status==="commit-failed"){updatePrompt("Unable to commit; draft preserved");return Object.freeze({status:"invalid-input",reason:"commit-failed",command:"Polygon",outcome})}
    return Object.freeze({status:"invalid-input",reason:"side-count-required",command:"Polygon",message:"Enter the number of sides first",outcome})
  }
  function handlePointerDown(point){return presentPoint(draft.acceptPoint(point),point)}
  function handlePointerMove(point){draft.updatePointer(point);requestRender()}
  function handlePointerLeave(){draft.clearPointer();clearSnap();requestRender()}
  function handleInput(input){
    clearSnap()
    if(editingSides){
      const retainedDefault=draft.sideCount??window.CaderactPolygonGeometry.DEFAULT_SIDES
      const usedDefault=String(input??"").trim()===""
      const parsed=draft.acceptSideCount(usedDefault?String(retainedDefault):input)
      if(!parsed.valid)return Object.freeze({status:"invalid-input",reason:parsed.reason,command:"Polygon",message:"Polygon side count must be an integer from 3 to 1024"})
      editingSides=false
      updatePrompt(draft.hasCenter?"Specify radius point":"Specify center of polygon");requestRender()
      return Object.freeze({status:"input-accepted",command:"Polygon",kind:"option",sideCount:parsed.value,usedDefault})
    }
    const parsed=window.CaderactPointInput.parseAndResolve(input,{currentUnit:modelReader.units().length,anchor:draft.center})
    if(parsed.status!=="point-resolved")return Object.freeze({status:"invalid-input",reason:parsed.reason,command:"Polygon",message:"Enter a point as x,y"})
    const point=Object.freeze({x:parsed.x,y:parsed.y});return presentPoint(draft.acceptPoint(point),point)
  }
  function finish(){clearSnap();draft.finish();requestRender();return Object.freeze({status:"command-completed",command:"Polygon"})}
  function cancel(){clearSnap();draft.cancel();requestRender();return Object.freeze({status:"command-cancelled",command:"Polygon"})}
  function getSnapCandidates(){return draft.acceptedPoints().map((point,index)=>Object.freeze({kind:"draft-point",point,
    stableKey:`polygon-draft:${index}`,reference:Object.freeze({kind:"draft-point",index})}))}
  function handleOption(optionId){
    if(optionId!=="numSides")return Object.freeze({status:"option-unavailable",reason:"unknown-option",command:"Polygon",optionId})
    editingSides=true;clearSnap();updatePrompt(`Enter number of sides <${draft.sideCount}>`)
    return Object.freeze({status:"option-activated",command:"Polygon",optionId})
  }
  function options(){return !editingSides&&draft.hasSideCount?Object.freeze([Object.freeze({id:"numSides",label:"NumSides",value:String(draft.sideCount),enabled:true})]):Object.freeze([])}
  requestRender()
  return Object.freeze({name:"Polygon",draft,finish,cancel,handlePointerDown,handlePointerMove,handlePointerLeave,handleInput,handleOption,
    getPreviewLines:draft.previewEdges,getDraftPoints:draft.acceptedPoints,getSnapCandidates,hasPointerPreview:()=>draft.hasCenter,
    get acceptsEmptyInput(){return editingSides},get options(){return options()},get prompt(){return promptPresentation.text},get promptPresentation(){return promptPresentation}})
}

function createRectangleCommandSession({ setPrompt = () => {} } = {}) {
  const draft = window.CaderactRectangleDraftSession.createSession({
    createSegment: recordGateway.createLine,
    commitSegments: recordGateway.createAll,
  })
  let promptPresentation = createCommandPrompt("Rectangle", "Specify first corner")
  function updatePrompt(instruction) { promptPresentation = createCommandPrompt("Rectangle", instruction); setPrompt(promptPresentation.text, promptPresentation) }
  function presentOutcome(outcome) {
    requestRender()
    if (outcome.status === "first-corner") {
      updatePrompt("Specify opposite corner")
      return Object.freeze({ status: "input-accepted", command: "Rectangle", kind: "point", outcome })
    }
    if (outcome.status === "rectangle-committed") {
      clearSnap()
      return Object.freeze({ status: "command-completed", command: "Rectangle", outcome })
    }
    if (outcome.status === "degenerate-rectangle") {
      updatePrompt("Opposite corner must change both X and Y")
      return Object.freeze({ status: "invalid-input", reason: "degenerate-rectangle", command: "Rectangle",
        message: "Rectangle requires non-zero width and height", outcome })
    }
    updatePrompt("Unable to commit; draft preserved")
    return Object.freeze({ status: "invalid-input", reason: "commit-failed", command: "Rectangle", outcome })
  }
  function handlePointerDown(point) { return presentOutcome(draft.acceptPoint(point)) }
  function handlePointerMove(point) { draft.updatePointer(point); requestRender() }
  function handlePointerLeave() { draft.clearPointer(); clearSnap(); requestRender() }
  function handleInput(input) {
    clearSnap()
    const parsed = window.CaderactPointInput.parseAndResolve(input, {
      currentUnit: modelReader.units().length,
      anchor: draft.firstCorner,
    })
    if (parsed.status !== "point-resolved") {
      const messages = {
        "invalid-coordinate": "Enter a point as x,y", "invalid-number": "Coordinate values must be finite numbers",
        "unsupported-unit": `Unsupported unit${parsed.unit ? `: ${parsed.unit}` : ""}`,
        "relative-point-without-anchor": "Relative point requires a previous point",
      }
      return Object.freeze({ status: "invalid-input", reason: parsed.reason, command: "Rectangle",
        message: messages[parsed.reason] || "Invalid coordinate" })
    }
    const point = Object.freeze({ x: parsed.x, y: parsed.y })
    return presentOutcome(draft.acceptPoint(point))
  }
  function finish() {
    clearSnap(); draft.finish(); requestRender()
    return Object.freeze({ status: "command-completed", command: "Rectangle" })
  }
  function cancel() {
    clearSnap(); draft.cancel(); requestRender()
    return Object.freeze({ status: "command-cancelled", command: "Rectangle" })
  }
  function getSnapCandidates() {
    return draft.acceptedPoints().map((point, index) => Object.freeze({
      kind: "draft-point", point, stableKey: `rectangle-draft:${index}`,
      reference: Object.freeze({ kind: "draft-point", index }),
    }))
  }
  requestRender()
  return Object.freeze({
    name: "Rectangle", draft, finish, cancel, handlePointerDown, handlePointerMove, handlePointerLeave, handleInput,
    getPreviewLines: draft.previewEdges, getDraftPoints: draft.acceptedPoints, getSnapCandidates,
    hasPointerPreview: () => draft.hasFirstCorner,
    get prompt() { return promptPresentation.text }, get promptPresentation() { return promptPresentation },
  })
}

function createPolylineCommandSession({ setPrompt = () => {} } = {}) {
  const draft = window.CaderactPolylineDraftSession.createSession({
    createSegment: recordGateway.createLine,
    commitSegments: recordGateway.createAll,
  })
  let promptPresentation = createCommandPrompt("Polyline", "Specify first point")
  function updatePrompt(instruction) { promptPresentation = createCommandPrompt("Polyline", instruction); setPrompt(promptPresentation.text, promptPresentation) }
  function presentPointOutcome(outcome, point = null) {
    requestRender()
    if (outcome.status === "first-point" || outcome.status === "segment-added") {
      updatePrompt("Specify next point or Close")
      return Object.freeze({ status: "input-accepted", command: "Polyline", kind: "point", point, outcome })
    }
    updatePrompt("Next point must differ from the current point")
    return Object.freeze({ status: "invalid-input", reason: "repeated-point", command: "Polyline",
      message: "Polyline cannot create a zero-length segment", outcome })
  }
  function presentPublication(outcome) {
    requestRender()
    if (outcome.status === "polyline-committed" || outcome.status === "polyline-closed" || outcome.status === "no-op") {
      clearSnap()
      return Object.freeze({ status: "command-completed", command: "Polyline", outcome })
    }
    if (outcome.status === "close-unavailable") {
      updatePrompt("Close requires at least one segment")
      return Object.freeze({ status: "invalid-input", reason: "close-unavailable", command: "Polyline",
        message: "Close requires at least two accepted points", outcome })
    }
    updatePrompt("Unable to commit; draft preserved")
    return Object.freeze({ status: "invalid-input", reason: "commit-failed", command: "Polyline", outcome })
  }
  function handlePointerDown(point) { return presentPointOutcome(draft.acceptPoint(point), point) }
  function handlePointerMove(point) { draft.updatePointer(point); requestRender() }
  function handlePointerLeave() { draft.clearPointer(); clearSnap(); requestRender() }
  function handleInput(input) {
    clearSnap()
    if (typeof input === "string" && input.trim().toLowerCase() === "close") return presentPublication(draft.close())
    const parsed = window.CaderactPointInput.parseAndResolve(input, {
      currentUnit: modelReader.units().length,
      anchor: draft.currentPoint,
    })
    if (parsed.status !== "point-resolved") {
      const messages = {
        "invalid-coordinate": "Enter a point as x,y or Close", "invalid-number": "Coordinate values must be finite numbers",
        "unsupported-unit": `Unsupported unit${parsed.unit ? `: ${parsed.unit}` : ""}`,
        "relative-point-without-anchor": "Relative point requires a previous point",
      }
      return Object.freeze({ status: "invalid-input", reason: parsed.reason, command: "Polyline",
        message: messages[parsed.reason] || "Invalid coordinate" })
    }
    const point = Object.freeze({ x: parsed.x, y: parsed.y })
    return presentPointOutcome(draft.acceptPoint(point), point)
  }
  function finish() { return presentPublication(draft.finish()) }
  function cancel() {
    clearSnap(); draft.cancel(); requestRender()
    return Object.freeze({ status: "command-cancelled", command: "Polyline" })
  }
  function stepUndo() {
    clearSnap()
    const outcome = draft.stepUndo()
    updatePrompt(draft.hasFirstPoint ? "Specify next point or Close" : "Specify first point")
    requestRender()
    return outcome
  }
  function getSnapCandidates() {
    return draft.acceptedPoints().map((point, index) => Object.freeze({
      kind: "draft-point", point, stableKey: `polyline-draft:${index}`,
      reference: Object.freeze({ kind: "draft-point", index }),
    }))
  }
  function getPreviewLines() { const preview = draft.preview(); return preview ? [preview] : [] }
  requestRender()
  return Object.freeze({
    name: "Polyline", draft, finish, cancel, stepUndo, handlePointerDown, handlePointerMove, handlePointerLeave, handleInput,
    getDraftLines: draft.draftSegments, getPreview: draft.preview, getPreviewLines,
    getDraftPoints: draft.acceptedPoints, getSnapCandidates, hasPointerPreview: () => draft.hasFirstPoint,
    get prompt() { return promptPresentation.text }, get promptPresentation() { return promptPresentation },
  })
}

function startLineCommand() {
  return window.caderactCommandRouter?.execute("Line") || Object.freeze({ status: "invalid-input", reason: "router-unavailable" })
}

function finishActiveCommand() {
  return window.caderactCommandRouter?.finishActive() || Object.freeze({ status: "invalid-input", reason: "router-unavailable" })
}

function cancelActiveCommand() {
  return window.caderactCommandRouter?.cancelActive() || Object.freeze({ status: "invalid-input", reason: "router-unavailable" })
}

function stepUndoActiveCommand() {
  return getActiveCommandSession()?.stepUndo?.() || Object.freeze({ status: "no-active-command" })
}

function getRendererState() {
  return Object.freeze({ status: rendererStatus, error: rendererError, canvasReplacements: canvasOwner.replacementCount })
}

function refreshDocumentView() { requestRender() }

function setGridSnapEnabled(enabled) {
  const next = Boolean(enabled)
  if (snapModes.grid === next) return snapModes
  snapModes = Object.freeze({ ...snapModes, grid: next })
  for (const listener of snapModeListeners) listener(snapModes)
  clearSnap()
  requestRender()
  return snapModes
}

function subscribeSnapModes(listener) {
  snapModeListeners.add(listener)
  listener(snapModes)
  return () => snapModeListeners.delete(listener)
}

function clearSnap() { activeSnapResult = null; interactionVisuals.setSnapAcquired(false) }

function resolvePointerSnap(point, { excludedFeatureIds = [], transientCandidates = [], bypass = false } = {}) {
  if (Array.isArray(arguments[1])) {
    excludedFeatureIds = arguments[1]
    transientCandidates = (arguments[2] || []).map((candidate, index) => ({
      kind: "draft-point", point: candidate, stableKey: `legacy-draft:${index}`,
    }))
    bypass = Boolean(arguments[3])
  }
  if (bypass) {
    clearSnap()
    const rawPoint = Object.freeze({ x: point.x, y: point.y })
    activeSnapResult = Object.freeze({ snapped: false, point: rawPoint })
    return activeSnapResult
  }
  activeSnapResult = snapResolver.resolve({
    rawWorldPoint: point,
    worldToScreen,
    records: modelReader.records(),
    transientCandidates,
    gridSpacing: sceneBuilder.getAdaptiveGridSpacing(),
    enabled: snapModes,
    excludedFeatureIds,
  })
  return activeSnapResult
}

function resetForDocumentReplacement() {
  cancelGripEdit()
  interactionVisuals.leave()
  setGridSnapEnabled(true)
  camera.zoom = viewportSettings.initialZoom
  camera.panX = viewportWidth / 2
  camera.panY = viewportHeight / 2
  requestRender()
  return Object.freeze({ status: "viewport-document-reset" })
}

documentSession.subscribe(({ store }) => {
  modelReader = store.reader
  recordGateway = store.recordGateway
  layerGateway = store.layerGateway
  unitGateway = store.unitGateway
  documentController = store.controller
  selection.clear()
  cancelGripEdit()
  bindSelectionDocument()
})

function bindSelectionDocument() {
  selectionHistoryUnsubscribe?.()
  selectionHistoryUnsubscribe = documentController.subscribeHistory(() => {
    const capturedPointerId = grips.active?.pointerId
    selection.pruneAgainstDocument(modelReader.records())
    grips.reconcile()
    if (!grips.isActive) releaseGripPointerCapture(capturedPointerId)
  })
}
selection.subscribe(requestRender)
bindSelectionDocument()

function setCommandActive(active) {
  if (active) cancelGripEdit()
  interactionVisuals.setMode(active ? "point" : "select")
}
function getInteractionVisualState() { return interactionVisuals.snapshot() }
function releaseGripPointerCapture(pointerId) {
  if (pointerId === undefined) return
  if (typeof canvas.hasPointerCapture === "function" && !canvas.hasPointerCapture(pointerId)) return
  canvas.releasePointerCapture?.(pointerId)
}
function cancelGripEdit() {
  const pointerId = grips.active?.pointerId
  clearSnap()
  const outcome = grips.cancel()
  releaseGripPointerCapture(pointerId)
  return outcome
}

window.caderactViewport = { createLineCommandSession, createCircleCommandSession, createArcCommandSession, createEllipseCommandSession, createPolygonCommandSession, createRectangleCommandSession, createPolylineCommandSession, startLineCommand, finishActiveCommand, cancelActiveCommand, stepUndoActiveCommand, cancelGripEdit, getRendererState, refreshDocumentView, resetForDocumentReplacement, setCommandActive, getInteractionVisualState, setGridSnapEnabled, subscribeSnapModes, get snapModes() { return snapModes } }

function resizeCanvas() {
  interactionVisuals.leave()
  const bounds = canvas.getBoundingClientRect()
  const width = bounds.width, height = bounds.height
  if (!isInitialized) {
    camera.panX = width / 2
    camera.panY = height / 2
    isInitialized = true
  } else {
    camera.panX += (width - viewportWidth) / 2
    camera.panY += (height - viewportHeight) / 2
  }
  viewportWidth = width
  viewportHeight = height
  renderer?.resize(width, height, window.devicePixelRatio || 1)
  requestRender()
}

let lastKnownPointerScreen = null
let isShiftBypassed = false

function getCommandSnapCandidates(session) {
  return session?.getSnapCandidates?.() || []
}

function hasCommandPointerPreview(session) {
  return session?.hasPointerPreview?.() || false
}

function updateSnapAtPointer({ bypass = isShiftBypassed } = {}) {
  if (!lastKnownPointerScreen) return
  const session = getActiveCommandSession()
  const worldPoint = screenToWorld(lastKnownPointerScreen.x, lastKnownPointerScreen.y)
  if (grips.isActive) {
    const snap = resolvePointerSnap(worldPoint, { excludedFeatureIds: [grips.active.grip.featureId], bypass })
    interactionVisuals.setSnapAcquired(snap.snapped)
    grips.update(snap.point)
    requestRender()
    return
  }
  if (session?.handlePointerMove && hasCommandPointerPreview(session) && !navigation.isActive()) {
    const snap = resolvePointerSnap(worldPoint, { transientCandidates: getCommandSnapCandidates(session), bypass })
    interactionVisuals.setSnapAcquired(snap.snapped)
    session.handlePointerMove(snap.point)
    requestRender()
  }
}

function onViewportPointerDown(event) {
  const session = getActiveCommandSession()
  if (event.button !== 0 || navigation.isActive()) return
  const point = getCanvasPoint(event)
  lastKnownPointerScreen = point
  const bypass = Boolean(event.shiftKey)
  if (session?.handlePointerDown) {
    const snap = resolvePointerSnap(screenToWorld(point.x, point.y), {
      transientCandidates: getCommandSnapCandidates(session),
      bypass,
    })
    window.caderactCommandRouter.submitActivePointer(snap.point)
    return
  }
  const gripOutcome = grips.begin(point, event.pointerId)
  if (gripOutcome.status === "grip-edit-started") {
    canvas.setPointerCapture?.(event.pointerId)
    clearSnap()
    return
  }
  const hit = window.CaderactSelection.hitTestRecords({screenPoint:point,records:modelReader.records(),worldToScreen})
  const toggle = (event.ctrlKey || event.metaKey) && !(event.ctrlKey && event.metaKey)
  if (hit.hit) toggle ? selection.toggle(hit.recordId) : selection.selectOnly(hit.recordId)
  else if (!toggle) selection.clear()
}

function onCommandPointerMove(event) {
  const point = getCanvasPoint(event)
  lastKnownPointerScreen = point
  const bypass = Boolean(event.shiftKey)
  isShiftBypassed = bypass
  interactionVisuals.setMode(getActiveCommandSession() ? "point" : "select")
  interactionVisuals.move(getViewportPoint(event))
  const session = getActiveCommandSession()
  if (grips.isActive) {
    const snap = resolvePointerSnap(screenToWorld(point.x, point.y), {
      excludedFeatureIds: [grips.active.grip.featureId],
      bypass,
    })
    interactionVisuals.setSnapAcquired(snap.snapped)
    grips.update(snap.point)
    return
  }
  if (!session) grips.updateHover(point)
  if (!session?.handlePointerMove || !hasCommandPointerPreview(session) || navigation.isActive()) return
  const snap = resolvePointerSnap(screenToWorld(point.x, point.y), {
    transientCandidates: getCommandSnapCandidates(session),
    bypass,
  })
  interactionVisuals.setSnapAcquired(snap.snapped)
  session.handlePointerMove(snap.point)
}

function onViewportPointerEnter(event) {
  interactionVisuals.setMode(getActiveCommandSession() ? "point" : "select")
  interactionVisuals.move(getViewportPoint(event))
}

function onCommandPointerLeave() {
  interactionVisuals.leave()
  clearSnap()
  lastKnownPointerScreen = null
  if (grips.isActive) cancelGripEdit()
  else grips.updateHover({ x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY })
  getActiveCommandSession()?.handlePointerLeave?.()
}

function onViewportPointerUp(event) {
  if (!grips.isActive || grips.active.pointerId !== event.pointerId) return
  const point = getCanvasPoint(event)
  lastKnownPointerScreen = point
  const snap = resolvePointerSnap(screenToWorld(point.x, point.y), {
    excludedFeatureIds: [grips.active.grip.featureId],
    bypass: Boolean(event.shiftKey),
  })
  grips.update(snap.point)
  grips.finish()
  clearSnap()
  releaseGripPointerCapture(event.pointerId)
}

function onViewportPointerCancel(event) {
  if (!grips.isActive || grips.active.pointerId !== event.pointerId) return
  grips.cancel(); clearSnap(); releaseGripPointerCapture(event.pointerId)
}

function onDocumentKeyDown(event) {
  if (event.key === "Shift" && !isShiftBypassed) {
    isShiftBypassed = true
    updateSnapAtPointer({ bypass: true })
  }
}

function onDocumentKeyUp(event) {
  if (event.key === "Shift" && isShiftBypassed) {
    isShiftBypassed = false
    updateSnapAtPointer({ bypass: false })
  }
}

document.addEventListener("keydown", onDocumentKeyDown)
document.addEventListener("keyup", onDocumentKeyUp)

function bindCanvas(nextCanvas) {
  navigation?.dispose()
  resizeObserver?.disconnect()
  canvas = nextCanvas
  navigation = window.CaderactViewportNavigation.bindViewportNavigation({
    canvas, camera: viewportCamera, viewportSettings, getCanvasPoint, requestRender,
    onStateChange: state => interactionVisuals.setNavigating(state.navigationMode !== null || state.isSpacePressed),
    isSpaceEditableTarget: target => target === document.querySelector("#command-input"),
    onSpaceTap: () => {
      const router = window.caderactCommandRouter
      if (!router) return
      if (!window.caderactCommandInput?.submitCurrentInput()) router.repeatLastCommand()
    },
  })
  canvas.addEventListener("pointerdown", onViewportPointerDown)
  canvas.addEventListener("pointerenter", onViewportPointerEnter)
  canvas.addEventListener("pointermove", onCommandPointerMove)
  canvas.addEventListener("pointerleave", onCommandPointerLeave)
  canvas.addEventListener("pointerup", onViewportPointerUp)
  canvas.addEventListener("pointercancel", onViewportPointerCancel)
  canvas.addEventListener("lostpointercapture", onViewportPointerCancel)
  resizeObserver = new ResizeObserver(resizeCanvas)
  resizeObserver.observe(canvas)
}

function replaceCanvas() {
  const replacement = canvasOwner.replace()
  bindCanvas(replacement)
  return replacement
}

function installRenderer(createdRenderer) {
  renderer = createdRenderer
  rendererStatus = createdRenderer.kind === "canvas2d" ? "fallback-active" : "ready"
  rendererError = null
  interactionVisuals.setAvailable(true)
  createdRenderer.onDeviceLost = () => recoverRenderer(createdRenderer)
  resizeCanvas()
}

function failRenderer(error, failedRenderer = null) {
  if (failedRenderer && renderer === failedRenderer) {
    renderer = null
    failedRenderer.destroy?.()
  } else if (!failedRenderer) renderer = null
  cancelGripEdit()
  rendererStatus = "failed"
  interactionVisuals.setAvailable(false)
  rendererError = error?.message || String(error)
  console.warn("Caderact renderer unavailable", error)
  return Object.freeze({ status: "failed", error: rendererError })
}

function recoverRenderer(failedRenderer) {
  if (failedRenderer !== renderer) return Promise.resolve(Object.freeze({ status: "stale-recovery" }))
  if (recoveryPromise) return recoveryPromise
  renderer = null
  cancelGripEdit()
  rendererStatus = "recovering"
  failedRenderer.destroy?.()
  recoveryPromise = (async () => {
    try {
      const recoveryCanvas = replaceCanvas()
      const recoveredRenderer = await window.createCaderactRenderer(recoveryCanvas, { preferCanvas2D: true })
      installRenderer(recoveredRenderer)
      return Object.freeze({ status: "recovered" })
    } catch (error) {
      return failRenderer(error)
    } finally {
      recoveryPromise = null
    }
  })()
  return recoveryPromise
}

bindCanvas(canvas)
window.addEventListener("resize", resizeCanvas)

window.createCaderactRenderer(canvas, { replaceCanvasForFallback: replaceCanvas })
  .then(installRenderer)
  .catch(failRenderer)
