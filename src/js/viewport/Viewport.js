let canvas = document.querySelector("canvas")
const canvasOwner = window.CaderactViewportCanvas.createOwner(canvas)

const viewportSettings = {
  gridExtent: 1000, baseGridSpacing: 10, minimumGridSpacingPixels: 28,
  initialZoom: 5, wheelZoomSensitivity: 0.0015, dragZoomSensitivity: 0.01,
  backgroundColor: "#182633", gridColor: "rgba(167, 175, 187, 0.28)",
  majorGridColor: "rgba(167, 175, 187, 0.45)", gridBoundaryColor: "rgba(167, 175, 187, 0.55)", xAxisColor: "#984b51",
  yAxisColor: "#3b7658", geometryColor: "#e8edf4", previewColor: "rgba(232, 237, 244, 0.65)", snapMarkerColor: "#f2cf72", selectionColor: "#63b7e6",
  gripColor: "#e8edf4", gripHoverColor: "#f2cf72", gripActiveColor: "#63b7e6",
  selectionWindowColor: "#63b7e6", selectionCrossingColor: "#70c58b",
  selectionWindowFill: "rgba(75, 155, 210, 0.10)", selectionCrossingFill: "rgba(78, 170, 112, 0.10)",
  draftPointColor: "#e8edf4",
  acceptedDraftColor: "#e8edf4",
  moveSourceGhostColor: "rgba(160, 177, 193, 0.35)", moveGuideColor: "rgba(242, 207, 114, 0.72)",
  rotateCenterMarkerColor: "#f2cf72", rotateReferenceMarkerColor: "rgba(157, 200, 239, 0.90)", rotateTargetMarkerColor: "#63b7e6",
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
function resolveTypedPrecisionPoint(input, anchor = null) {
  const candidate = activeSnapResult?.point
  const direction = anchor && candidate ? { x: candidate.x - anchor.x, y: candidate.y - anchor.y } : null
  return window.CaderactPrecisionInput.resolvePoint(input, {
    currentUnit: modelReader.units().length, anchor, direction,
  })
}
const userPreferences = window.CaderactUserPreferences.create()
window.caderactUserPreferences = userPreferences
function preferenceColor(hex, opacity) { if (opacity === 1) return hex; const value = Number.parseInt(hex.slice(1), 16); return `rgba(${value >> 16 & 255}, ${value >> 8 & 255}, ${value & 255}, ${opacity})` }
function applyGridAppearance(value) { viewportSettings.gridVisible=value.gridVisible; viewportSettings.gridColor=preferenceColor(value.gridColor,value.gridOpacity); viewportSettings.majorGridColor=preferenceColor(value.majorGridColor,value.majorGridOpacity); viewportSettings.xAxisColor=preferenceColor(value.xAxisColor,value.xAxisOpacity); viewportSettings.yAxisColor=preferenceColor(value.yAxisColor,value.yAxisOpacity); viewportSettings.majorGridInterval=value.majorGridInterval; requestRender?.() }
applyGridAppearance(userPreferences.value)
userPreferences.subscribe(applyGridAppearance)
let snapModes = Object.freeze({ object: userPreferences.value.objectSnapEnabled, endpoint: userPreferences.value.endpointSnapEnabled, midpoint: userPreferences.value.midpointSnapEnabled, center: userPreferences.value.centerSnapEnabled, intersection: userPreferences.value.intersectionSnapEnabled, quadrant: userPreferences.value.quadrantSnapEnabled, nearest: userPreferences.value.nearestSnapEnabled, perpendicular: userPreferences.value.perpendicularSnapEnabled, tangent: userPreferences.value.tangentSnapEnabled, vertex: userPreferences.value.vertexSnapEnabled, grid: userPreferences.value.gridSnapEnabled })
const snapModeListeners = new Set()
function snapModesFromPreferences(value){return Object.freeze({object:value.objectSnapEnabled,endpoint:value.endpointSnapEnabled,midpoint:value.midpointSnapEnabled,center:value.centerSnapEnabled,intersection:value.intersectionSnapEnabled,quadrant:value.quadrantSnapEnabled,nearest:value.nearestSnapEnabled,perpendicular:value.perpendicularSnapEnabled,tangent:value.tangentSnapEnabled,vertex:value.vertexSnapEnabled,grid:value.gridSnapEnabled})}
userPreferences.subscribe(value=>{const next=snapModesFromPreferences(value);if(Object.keys(next).every(key=>next[key]===snapModes[key]))return;snapModes=next;if(!next.object)objectSnapTracking.clear();for(const listener of snapModeListeners)listener(snapModes);updateSnapAtPointer()})
let orthoEnabled = userPreferences.value.orthoEnabled
const orthoListeners = new Set()
const effectiveOrthoListeners = new Set()
let polarEnabled = userPreferences.value.polarEnabled
let polarIncrementDegrees = userPreferences.value.polarIncrementDegrees
const polarListeners = new Set()
const effectivePolarListeners = new Set()
let polarGuide = null
const viewportHost = canvas.parentElement || canvas.parent
const interactionVisuals = window.CaderactInteractionVisuals.createController({ host: viewportHost })
const dynamicInputView = window.CaderactDynamicInput.createView({ host: viewportHost })
const dynamicInput = window.CaderactDynamicInput.createController({ onChange: dynamicInputView.render })
let dynamicInputEnabled = userPreferences.value.dynamicInputEnabled
userPreferences.subscribe(value => { dynamicInputEnabled=Boolean(value.dynamicInputEnabled);if(!dynamicInputEnabled)dynamicInput.clear() })
const snapResolver = window.CaderactSnapResolver.createResolver()
const objectSnapTracking = window.CaderactObjectSnapTracking.create({ onChange: requestRender })
let objectSnapTrackingEnabled = userPreferences.value.objectSnapTrackingEnabled
const objectSnapTrackingListeners = new Set()
function applyObjectSnapTrackingPreference(preferences) {
  const next = preferences.objectSnapTrackingEnabled
  if (objectSnapTrackingEnabled === next) return
  objectSnapTrackingEnabled = next
  if (!next) objectSnapTracking.clear()
  for (const listener of objectSnapTrackingListeners) listener(next)
  requestRender()
}
userPreferences.subscribe(applyObjectSnapTrackingPreference)
const selection = window.CaderactSelection.createSelection()
const selectionBox = window.CaderactSelectionBox.createInteraction()
const grips = window.CaderactGrips.createManager({
  getRecords: () => modelReader.editableRecords(), getSelectedIds: selection.selectedIds, worldToScreen,
  replaceRecord: (id, record) => recordGateway.replace(id, record), requestRender,
})
let selectionHistoryUnsubscribe = null
window.caderactSelection = selection
window.caderactGrips = grips

function getActiveCommandSession() {
  return window.caderactCommandRouter?.activeSession || null
}
function visibleRecords(){return modelReader.visibleRecords()}
function editableRecords(){return modelReader.editableRecords()}

function dynamicReference(session) {
  return session?.getOrthoReference?.() || session?.draft?.currentPoint || session?.draft?.center || session?.draft?.firstCorner || null
}
function refreshDynamicInput() {
  const session=getActiveCommandSession(),candidate=activeSnapResult?.point
  if(!dynamicInputEnabled||!session||session.isSelectionPhase||session.usesResolvedPoint===false||navigation?.isActive?.()||!lastKnownPointerScreen||!candidate){dynamicInput.clear();return}
  const fields=[],format=window.CaderactDynamicInput.formatNumber,angleFormat=window.CaderactDynamicInput.formatAngle
  const reference=dynamicReference(session)
  if(session.name==="Scale"&&session.phase==="target"&&session.basePoint&&session.referencePoint){const baseLength=Math.hypot(session.referencePoint.x-session.basePoint.x,session.referencePoint.y-session.basePoint.y),targetLength=Math.hypot(candidate.x-session.basePoint.x,candidate.y-session.basePoint.y);if(baseLength>0)fields.push({id:"factor",kind:"scalar",label:"Factor",value:format(targetLength/baseLength),editable:true,active:false})}
  else if(session.name==="Rotate"&&session.phase==="target"){const angle=session.getMovePreview?.()?.angle;if(Number.isFinite(angle))fields.push({id:"angle",kind:"angle",label:"Angle",value:angleFormat(angle*180/Math.PI),editable:true,active:false})}
  else if(reference){const dx=candidate.x-reference.x,dy=candidate.y-reference.y;fields.push({id:session.name==="Circle"?"radius":"distance",kind:"distance",label:session.name==="Circle"?"Radius":"Distance",value:format(Math.hypot(dx,dy)),editable:true,active:false});if(session.name!=="Circle")fields.push({id:"angle",kind:"angle",label:"Angle",value:angleFormat(Math.atan2(dy,dx)*180/Math.PI),editable:false,active:false})}
  else {fields.push({id:"x",kind:"coordinate",label:"X",value:format(candidate.x),editable:false,active:false},{id:"y",kind:"coordinate",label:"Y",value:format(candidate.y),editable:false,active:false})}
  const relationshipLabels={ortho:"OnOrtho",polar:"OnPolar",perpendicular:"OnPerp",tangent:"OnTan",tracking:"OnTrack"},tags=(activeSnapResult?.relationships||[]).map(kind=>relationshipLabels[kind]).filter(Boolean),snapLabel=window.CaderactViewportScene.snapLabel(activeSnapResult)
  if((activeSnapResult?.kinds?.length||activeSnapResult?.kind==="grid")&&snapLabel)tags.push(snapLabel)
  dynamicInput.update({screenPoint:lastKnownPointerScreen,viewport:{width:viewportWidth,height:viewportHeight},prompt:session.prompt,fields,tags:[...new Set(tags)]})
}
function setDynamicInputEnabled(enabled){dynamicInputEnabled=Boolean(enabled);userPreferences.set({dynamicInputEnabled});if(!dynamicInputEnabled)dynamicInput.clear();else refreshDynamicInput();return dynamicInputEnabled}
function cancelDynamicInputEdit(){const cancelled=dynamicInput.cancelEdit();if(cancelled)refreshDynamicInput();return Boolean(cancelled)}
function submitDynamicInputEdit(){const edit=dynamicInput.activeEdit();if(!edit||edit.text.trim()===""){dynamicInput.setInvalid();return false}const outcome=window.caderactCommandRouter?.submitActiveInput(edit.text);if(outcome?.status==="invalid-input"){dynamicInput.setInvalid();return false}dynamicInput.cancelEdit();if(window.caderactCommandRouter?.isActive)updateSnapAtPointer();else dynamicInput.clear();return true}

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
  getRecords: visibleRecords,
  getDraftLines: () => getActiveCommandSession()?.getDraftLines?.() || [],
  getPreviewLines: () => getActiveCommandSession()?.getPreviewLines?.() || [],
  getCirclePreview: () => getActiveCommandSession()?.getCirclePreview?.() || null,
  getArcPreview: () => getActiveCommandSession()?.getArcPreview?.() || null,
  getEllipsePreview: () => getActiveCommandSession()?.getEllipsePreview?.() || null,
  getMovePreview: () => getActiveCommandSession()?.getMovePreview?.() || null,
  getOffsetPreview: () => getActiveCommandSession()?.getOffsetPreview?.() || null,
  getTrimPreview: () => getActiveCommandSession()?.getTrimPreview?.() || null,
  getExtendPreview: () => getActiveCommandSession()?.getExtendPreview?.() || null,
  getDraftPoints: () => getActiveCommandSession()?.getDraftPoints?.() || [],
  getSnapResult: () => activeSnapResult,
  getSelectedIds: selection.selectedIds,
  getGrips: () => getActiveCommandSession() ? [] : grips.displayGrips(),
  getGripPreview: grips.previewRecord,
  getSelectionBox: () => selectionBox.snapshot(),
  getPolarGuide: () => polarGuide,
  getObjectTrackingState: () => objectSnapTracking.getState(),
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

const FINISHING_OBJECT_SNAP_KINDS=new Set(["nearest","endpoint","midpoint","intersection","vertex","perpendicular","tangent"])
function isFinishingObjectSnap(snap){return Boolean(snap?.snapped&&snap.kind!=="grid"&&snap.kind!=="draft-point"&&snap.kind!=="tracking"&&(snap.kinds||[snap.kind]).some(kind=>FINISHING_OBJECT_SNAP_KINDS.has(kind)))}
function createLineCommandSession({ setPrompt = () => {} } = {}) {
  const draft = window.CaderactLineDraftSession.createSession({
    createSegment: recordGateway.createLine,
    commitSegments: recordGateway.createAll,
  })
  let promptPresentation = createCommandPrompt("Line", "Specify first point")
  function updatePrompt(instruction) { promptPresentation = createCommandPrompt("Line", instruction); setPrompt(promptPresentation.text, promptPresentation) }

  function handlePointerDown(point, context = {}) {
    // Pointer routing has already resolved D2A snapping. Compare that accepted
    // model point with P1; never infer closure from marker/proximity metadata.
    const acceptedStartPoint = draft.firstPoint
    if (draft.canClose && acceptedStartPoint
      && point.x === acceptedStartPoint.x && point.y === acceptedStartPoint.y) {
      clearSnap()
      const outcome = draft.close()
      if (outcome.status === "committed") {
        requestRender()
        return Object.freeze({ status: "command-completed", command: "Line", outcome })
      }
      updatePrompt("Unable to commit; draft preserved")
      requestRender()
      return Object.freeze({ status: "invalid-input", reason: "commit-failed", command: "Line", outcome })
    }
    const outcome = draft.acceptPoint(point)
    if (outcome.status === "first-point") updatePrompt("Specify next point")
    if(outcome.status==="segment-added"&&isFinishingObjectSnap(context.snap))return finish()
    requestRender()
    return outcome
  }
  function handlePointerMove(point) { draft.updatePointer(point); requestRender() }
  function handlePointerLeave() {
    if (draft.preview() !== null) { draft.clearPointer(); requestRender() }
  }
  function handleInput(input) {
    const parsed = resolveTypedPrecisionPoint(input, draft.currentPoint)
    clearSnap()
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
  // Snap acquisition is valid before P1; only the rubber-band preview needs P1.
  function hasPointerPreview() { return true }
  function getPreviewLines() { const preview = draft.preview(); return preview ? [preview] : [] }
  function handleOption(optionId) {
    if (optionId !== "close" || !draft.canClose) return Object.freeze({ status: "option-unavailable", reason: "close-unavailable", command: "Line", optionId })
    clearSnap()
    const outcome = draft.close()
    if (outcome.status !== "committed") {
      updatePrompt("Unable to commit; draft preserved")
      requestRender()
      return Object.freeze({ status: "invalid-input", reason: "commit-failed", command: "Line", outcome })
    }
    requestRender()
    return Object.freeze({ status: "command-completed", command: "Line", outcome })
  }
  function options() { return draft.canClose ? Object.freeze([Object.freeze({ id: "close", label: "Close", value: "", showValue: false, enabled: true })]) : Object.freeze([]) }

  requestRender()
  return Object.freeze({
    name: "Line", draft, finish, cancel, stepUndo,
    handlePointerDown, handlePointerMove, handlePointerLeave, handleInput, handleOption,
    getDraftLines: draft.draftSegments, getPreview: draft.preview, getPreviewLines,
    getDraftPoints: draft.acceptedPoints,
    getSnapCandidates, getOrthoReference: () => draft.currentPoint, hasPointerPreview, get options() { return options() },
    get prompt() { return promptPresentation.text }, get promptPresentation() { return promptPresentation },
  })
}

function createMoveCommandSession({ setPrompt = () => {} } = {}) {
  let phase = selection.selectedIds().length ? "base" : "selection"
  let selectedRecordIds = phase === "base" ? selection.selectedIds() : Object.freeze([])
  let basePoint = null, candidatePoint = null
  let promptPresentation = createCommandPrompt("Move", phase === "selection" ? "Select objects" : "Specify base point")
  function updatePrompt(instruction) { promptPresentation=createCommandPrompt("Move",instruction);setPrompt(promptPresentation.text,promptPresentation) }
  function selectedRecords() {
    const selected=new Set(selectedRecordIds)
    return editableRecords().filter(record=>selected.has(record.id))
  }
  function confirmSelection() {
    const ids=selection.selectedIds()
    if(!ids.length)return Object.freeze({status:"invalid-input",reason:"empty-selection",command:"Move",message:"Select at least one object"})
    selectedRecordIds=ids;phase="base";updatePrompt("Specify base point");requestRender()
    return Object.freeze({status:"input-accepted",command:"Move",kind:"selection",recordIds:selectedRecordIds})
  }
  function commitTarget(point) {
    candidatePoint=Object.freeze({x:point.x,y:point.y})
    const dx=candidatePoint.x-basePoint.x,dy=candidatePoint.y-basePoint.y
    if(dx===0&&dy===0){clearSnap();candidatePoint=null;requestRender();return Object.freeze({status:"command-completed",command:"Move",outcome:Object.freeze({status:"no-op"})})}
    let replacements
    try { replacements=selectedRecords().map(record=>window.CaderactGeometryTransform.translateRecord(record,dx,dy)) }
    catch(error){return Object.freeze({status:"invalid-input",reason:"invalid-translation",command:"Move",message:error.message})}
    if(replacements.length!==selectedRecordIds.length)return Object.freeze({status:"invalid-input",reason:"missing-selection",command:"Move",message:"A selected object is no longer available"})
    const outcome=recordGateway.replaceAll(replacements)
    if(outcome.status!=="committed"){requestRender();return Object.freeze({status:"invalid-input",reason:"commit-failed",command:"Move",message:"Unable to move; preview preserved",outcome})}
    clearSnap();candidatePoint=null;requestRender()
    return Object.freeze({status:"command-completed",command:"Move",outcome,dx,dy})
  }
  function acceptPoint(point) {
    if(phase==="selection")return Object.freeze({status:"invalid-input",reason:"selection-not-confirmed",command:"Move"})
    if(phase==="base"){basePoint=Object.freeze({x:point.x,y:point.y});candidatePoint=basePoint;phase="target";updatePrompt("Specify second point");requestRender();return Object.freeze({status:"input-accepted",command:"Move",kind:"base-point",point:basePoint})}
    return commitTarget(point)
  }
  function handlePointerDown(point){return acceptPoint(point)}
  function handlePointerMove(point){if(phase==="target")candidatePoint=Object.freeze({x:point.x,y:point.y});requestRender()}
  function handlePointerLeave(){candidatePoint=null;clearSnap();requestRender()}
  function handleInput(input){
    if(phase==="selection")return Object.freeze({status:"invalid-input",reason:"selection-phase",command:"Move",message:"Press Enter to confirm selection"})
    const parsed=resolveTypedPrecisionPoint(input,phase==="target"?basePoint:null);clearSnap()
    if(parsed.status!=="point-resolved")return Object.freeze({status:"invalid-input",reason:parsed.reason,command:"Move",message:"Enter a point as x,y"})
    return acceptPoint(Object.freeze({x:parsed.x,y:parsed.y}))
  }
  function finish(){if(phase==="selection")return confirmSelection();return Object.freeze({status:"invalid-input",reason:"point-required",command:"Move",message:phase==="base"?"Specify a base point":"Specify a second point"})}
  function cancel(){candidatePoint=null;clearSnap();requestRender();return Object.freeze({status:"command-cancelled",command:"Move"})}
  function getMovePreview(){
    if(phase!=="target"||!candidatePoint)return null
    const dx=candidatePoint.x-basePoint.x,dy=candidatePoint.y-basePoint.y
    const sourceRecords=selectedRecords()
    return Object.freeze({mode:"move",recordIds:selectedRecordIds,basePoint,candidatePoint,dx,dy,sourceRecords:Object.freeze(sourceRecords),
      records:Object.freeze(sourceRecords.map(record=>window.CaderactGeometryTransform.translateRecord(record,dx,dy)))})
  }
  requestRender()
  return Object.freeze({name:"Move",finish,cancel,handlePointerDown,handlePointerMove,handlePointerLeave,handleInput,getMovePreview,
    getOrthoReference:()=>phase==="target"?basePoint:null,
    hasPointerPreview:()=>phase!=="selection",getExcludedSnapRecordIds:()=>phase==="target"?selectedRecordIds:Object.freeze([]),
    get isSelectionPhase(){return phase==="selection"},get phase(){return phase},get selectedRecordIds(){return selectedRecordIds},get basePoint(){return basePoint},get candidatePoint(){return candidatePoint},
    get prompt(){return promptPresentation.text},get promptPresentation(){return promptPresentation}})
}

function createCopyCommandSession({ setPrompt = () => {} } = {}) {
  let phase=selection.selectedIds().length?"base":"selection"
  let selectedRecordIds=phase==="base"?selection.selectedIds():Object.freeze([])
  let basePoint=null,candidatePoint=null
  let promptPresentation=createCommandPrompt("Copy",phase==="selection"?"Select objects":"Specify base point")
  function updatePrompt(instruction){promptPresentation=createCommandPrompt("Copy",instruction);setPrompt(promptPresentation.text,promptPresentation)}
  function selectedRecords(){const selected=new Set(selectedRecordIds);return editableRecords().filter(record=>selected.has(record.id))}
  function confirmSelection(){const ids=selection.selectedIds();if(!ids.length)return Object.freeze({status:"invalid-input",reason:"empty-selection",command:"Copy",message:"Select at least one object"});selectedRecordIds=ids;phase="base";updatePrompt("Specify base point");requestRender();return Object.freeze({status:"input-accepted",command:"Copy",kind:"selection",recordIds:selectedRecordIds})}
  function commitTarget(point){
    candidatePoint=Object.freeze({x:point.x,y:point.y});const dx=candidatePoint.x-basePoint.x,dy=candidatePoint.y-basePoint.y
    if(dx===0&&dy===0){clearSnap();candidatePoint=null;requestRender();return Object.freeze({status:"command-completed",command:"Copy",outcome:Object.freeze({status:"no-op"})})}
    let copies
    try{const source=selectedRecords();if(source.length!==selectedRecordIds.length)return Object.freeze({status:"invalid-input",reason:"missing-selection",command:"Copy",message:"A selected object is no longer available"});copies=source.map(record=>recordGateway.copyWithFreshIdentity(window.CaderactGeometryTransform.translateRecord(record,dx,dy)))}
    catch(error){return Object.freeze({status:"invalid-input",reason:"invalid-copy",command:"Copy",message:error.message})}
    const outcome=recordGateway.createAll(copies)
    if(outcome.status!=="committed"){requestRender();return Object.freeze({status:"invalid-input",reason:"commit-failed",command:"Copy",message:"Unable to copy; preview preserved",outcome})}
    selection.applyRecordIds(copies.map(record=>record.id));clearSnap();candidatePoint=null;requestRender()
    return Object.freeze({status:"command-completed",command:"Copy",outcome,dx,dy,recordIds:Object.freeze(copies.map(record=>record.id))})
  }
  function acceptPoint(point){if(phase==="selection")return Object.freeze({status:"invalid-input",reason:"selection-not-confirmed",command:"Copy"});if(phase==="base"){basePoint=Object.freeze({x:point.x,y:point.y});candidatePoint=basePoint;phase="target";updatePrompt("Specify destination point");requestRender();return Object.freeze({status:"input-accepted",command:"Copy",kind:"base-point",point:basePoint})}return commitTarget(point)}
  function handlePointerDown(point){return acceptPoint(point)}
  function handlePointerMove(point){if(phase==="target")candidatePoint=Object.freeze({x:point.x,y:point.y});requestRender()}
  function handlePointerLeave(){candidatePoint=null;clearSnap();requestRender()}
  function handleInput(input){if(phase==="selection")return Object.freeze({status:"invalid-input",reason:"selection-phase",command:"Copy",message:"Press Enter to confirm selection"});const parsed=resolveTypedPrecisionPoint(input,phase==="target"?basePoint:null);clearSnap();if(parsed.status!=="point-resolved")return Object.freeze({status:"invalid-input",reason:parsed.reason,command:"Copy",message:"Enter a point as x,y"});return acceptPoint(Object.freeze({x:parsed.x,y:parsed.y}))}
  function finish(){if(phase==="selection")return confirmSelection();return Object.freeze({status:"invalid-input",reason:"point-required",command:"Copy",message:phase==="base"?"Specify a base point":"Specify a destination point"})}
  function cancel(){candidatePoint=null;clearSnap();requestRender();return Object.freeze({status:"command-cancelled",command:"Copy"})}
  function getMovePreview(){if(phase!=="target"||!candidatePoint)return null;const dx=candidatePoint.x-basePoint.x,dy=candidatePoint.y-basePoint.y,sourceRecords=selectedRecords();return Object.freeze({mode:"copy",recordIds:selectedRecordIds,basePoint,candidatePoint,dx,dy,sourceRecords:Object.freeze(sourceRecords),records:Object.freeze(sourceRecords.map(record=>window.CaderactGeometryTransform.translateRecord(record,dx,dy)))})}
  requestRender()
  return Object.freeze({name:"Copy",finish,cancel,handlePointerDown,handlePointerMove,handlePointerLeave,handleInput,getMovePreview,getOrthoReference:()=>phase==="target"?basePoint:null,hasPointerPreview:()=>phase!=="selection",getExcludedSnapRecordIds:()=>Object.freeze([]),get isSelectionPhase(){return phase==="selection"},get phase(){return phase},get selectedRecordIds(){return selectedRecordIds},get basePoint(){return basePoint},get candidatePoint(){return candidatePoint},get prompt(){return promptPresentation.text},get promptPresentation(){return promptPresentation}})
}

function createRotateCommandSession({ setPrompt = () => {} } = {}) {
  const ANGLE_EPSILON=1e-12
  let phase=selection.selectedIds().length?"center":"selection"
  let selectedRecordIds=phase==="center"?selection.selectedIds():Object.freeze([])
  let centerPoint=null,referencePoint=null,candidatePoint=null,feedbackVisible=false,copyMode=false
  let promptPresentation=createCommandPrompt("Rotate",phase==="selection"?"Select objects":"Specify center point")
  function updatePrompt(instruction){promptPresentation=createCommandPrompt("Rotate",instruction);setPrompt(promptPresentation.text,promptPresentation)}
  function selectedRecords(){const selected=new Set(selectedRecordIds);return editableRecords().filter(record=>selected.has(record.id))}
  function confirmSelection(){const ids=selection.selectedIds();if(!ids.length)return Object.freeze({status:"invalid-input",reason:"empty-selection",command:"Rotate",message:"Select at least one object"});selectedRecordIds=ids;phase="center";updatePrompt("Specify center point");requestRender();return Object.freeze({status:"input-accepted",command:"Rotate",kind:"selection",recordIds:selectedRecordIds})}
  function angleTo(point){if(!centerPoint||!referencePoint||point.x===centerPoint.x&&point.y===centerPoint.y)return null;const start=Math.atan2(referencePoint.y-centerPoint.y,referencePoint.x-centerPoint.x),target=Math.atan2(point.y-centerPoint.y,point.x-centerPoint.x);return window.CaderactGeometryTransform.normalizeAngle(target-start)}
  function commitTarget(point){candidatePoint=Object.freeze({x:point.x,y:point.y});const angle=angleTo(candidatePoint);if(angle===null)return Object.freeze({status:"invalid-input",reason:"undefined-target-direction",command:"Rotate",message:"Target point must differ from center"});if(Math.abs(angle)<=ANGLE_EPSILON){clearSnap();candidatePoint=null;requestRender();return Object.freeze({status:"command-completed",command:"Rotate",outcome:Object.freeze({status:"no-op"})})}let replacements;try{const source=selectedRecords();if(source.length!==selectedRecordIds.length)return Object.freeze({status:"invalid-input",reason:"missing-selection",command:"Rotate",message:"A selected object is no longer available"});replacements=source.map(record=>window.CaderactGeometryTransform.rotateRecord(record,centerPoint,angle));if(copyMode)replacements=replacements.map(record=>recordGateway.copyWithFreshIdentity(record))}catch(error){return Object.freeze({status:"invalid-input",reason:"invalid-rotation",command:"Rotate",message:error.message})}const outcome=copyMode?recordGateway.createAll(replacements):recordGateway.replaceAll(replacements);if(outcome.status!=="committed"){requestRender();return Object.freeze({status:"invalid-input",reason:"commit-failed",command:"Rotate",message:"Unable to rotate; preview preserved",outcome})}if(copyMode)selection.applyRecordIds(replacements.map(record=>record.id));clearSnap();candidatePoint=null;requestRender();return Object.freeze({status:"command-completed",command:"Rotate",outcome,angle,copyMode,recordIds:Object.freeze(replacements.map(record=>record.id))})}
  function acceptPoint(point){
    if(phase==="selection")return Object.freeze({status:"invalid-input",reason:"selection-not-confirmed",command:"Rotate"})
    if(phase==="center"){centerPoint=Object.freeze({x:point.x,y:point.y});feedbackVisible=true;phase="reference";updatePrompt("Specify reference point");requestRender();return Object.freeze({status:"input-accepted",command:"Rotate",kind:"center-point",point:centerPoint})}
    if(phase==="reference"){if(point.x===centerPoint.x&&point.y===centerPoint.y)return Object.freeze({status:"invalid-input",reason:"undefined-reference-direction",command:"Rotate",message:"Reference point must differ from center"});referencePoint=Object.freeze({x:point.x,y:point.y});candidatePoint=referencePoint;feedbackVisible=true;phase="target";updatePrompt("Specify target point");requestRender();return Object.freeze({status:"input-accepted",command:"Rotate",kind:"reference-point",point:referencePoint})}
    return commitTarget(point)
  }
  function handlePointerDown(point){return acceptPoint(point)}
  function handlePointerMove(point){if(centerPoint)feedbackVisible=true;if(phase==="target")candidatePoint=Object.freeze({x:point.x,y:point.y});requestRender()}
  function handlePointerLeave(){candidatePoint=null;feedbackVisible=false;clearSnap();requestRender()}
  function handleInput(input){if(phase==="selection")return Object.freeze({status:"invalid-input",reason:"selection-phase",command:"Rotate",message:"Press Enter to confirm selection"});const angle=phase==="target"?window.CaderactPrecisionInput.parseAngle(input):null;if(angle?.status==="precision-parsed"){const vector={x:referencePoint.x-centerPoint.x,y:referencePoint.y-centerPoint.y},radians=angle.degrees*Math.PI/180;clearSnap();return acceptPoint(Object.freeze({x:centerPoint.x+vector.x*Math.cos(radians)-vector.y*Math.sin(radians),y:centerPoint.y+vector.x*Math.sin(radians)+vector.y*Math.cos(radians)}))}const anchor=phase==="reference"?centerPoint:phase==="target"?referencePoint:null;const parsed=resolveTypedPrecisionPoint(input,anchor);clearSnap();if(parsed.status!=="point-resolved")return Object.freeze({status:"invalid-input",reason:parsed.reason,command:"Rotate",message:"Enter a point as x,y or an angle"});return acceptPoint(Object.freeze({x:parsed.x,y:parsed.y}))}
  function finish(){if(phase==="selection")return confirmSelection();return Object.freeze({status:"invalid-input",reason:"point-required",command:"Rotate",message:phase==="center"?"Specify a center point":phase==="reference"?"Specify a reference point":"Specify a target point"})}
  function cancel(){candidatePoint=null;feedbackVisible=false;clearSnap();requestRender();return Object.freeze({status:"command-cancelled",command:"Rotate"})}
  function handleOption(optionId){if(optionId!=="copy")return Object.freeze({status:"option-unavailable",reason:"unknown-option",command:"Rotate",optionId});copyMode=!copyMode;requestRender();return Object.freeze({status:"option-updated",command:"Rotate",optionId,value:copyMode?"Yes":"No"})}
  function options(){return Object.freeze([Object.freeze({id:"copy",label:"Copy",value:copyMode?"Yes":"No",enabled:true})])}
  function getMovePreview(){if(!feedbackVisible||!centerPoint)return null;const validTarget=phase==="target"&&candidatePoint&&!(candidatePoint.x===centerPoint.x&&candidatePoint.y===centerPoint.y),angle=validTarget?angleTo(candidatePoint):null,records=angle===null?[]:selectedRecords().map(record=>window.CaderactGeometryTransform.rotateRecord(record,centerPoint,angle));return Object.freeze({mode:"rotate",recordIds:selectedRecordIds,basePoint:centerPoint,centerPoint,referencePoint,candidatePoint:validTarget?candidatePoint:null,angle,copyMode,preserveSourceVisible:copyMode,sourceRecords:Object.freeze(copyMode?[]:angle===null?[]:selectedRecords()),records:Object.freeze(records)})}
  requestRender()
  return Object.freeze({name:"Rotate",finish,cancel,handlePointerDown,handlePointerMove,handlePointerLeave,handleInput,handleOption,getMovePreview,hasPointerPreview:()=>phase!=="selection",getExcludedSnapRecordIds:()=>phase==="target"?selectedRecordIds:Object.freeze([]),get isSelectionPhase(){return phase==="selection"},get phase(){return phase},get selectedRecordIds(){return selectedRecordIds},get copyMode(){return copyMode},get options(){return options()},get centerPoint(){return centerPoint},get referencePoint(){return referencePoint},get candidatePoint(){return candidatePoint},get prompt(){return promptPresentation.text},get promptPresentation(){return promptPresentation}})
}

function createMirrorCommandSession({ setPrompt = () => {} } = {}) {
  let phase=selection.selectedIds().length?"axis-a":"selection",selectedRecordIds=phase==="axis-a"?selection.selectedIds():Object.freeze([]),axisA=null,axisB=null,copyMode=userPreferences.value.mirrorCopyEnabled
  let promptPresentation=createCommandPrompt("Mirror",phase==="selection"?"Select objects":"Specify first mirror-axis point")
  function updatePrompt(instruction){promptPresentation=createCommandPrompt("Mirror",instruction);setPrompt(promptPresentation.text,promptPresentation)}
  function selectedRecords(){const ids=new Set(selectedRecordIds);return editableRecords().filter(record=>ids.has(record.id))}
  function confirmSelection(){const ids=selection.selectedIds();if(!ids.length)return Object.freeze({status:"invalid-input",reason:"empty-selection",command:"Mirror",message:"Select at least one object"});selectedRecordIds=ids;phase="axis-a";updatePrompt("Specify first mirror-axis point");requestRender();return Object.freeze({status:"input-accepted",command:"Mirror",kind:"selection",recordIds:ids})}
  function mirrorRecords(target){const source=selectedRecords();if(source.length!==selectedRecordIds.length)throw new Error("Selected object is no longer available");return source.map(record=>window.CaderactGeometryTransform.mirrorRecord(record,axisA,target))}
  function commit(point){axisB=Object.freeze({x:point.x,y:point.y});let records;try{records=mirrorRecords(axisB);if(copyMode)records=records.map(record=>recordGateway.copyWithFreshIdentity(record))}catch(error){return Object.freeze({status:"invalid-input",reason:"invalid-axis",command:"Mirror",message:error.message})}const outcome=copyMode?recordGateway.createAll(records):recordGateway.replaceAll(records);if(outcome.status!=="committed"){requestRender();return Object.freeze({status:"invalid-input",reason:"commit-failed",command:"Mirror",message:"Unable to mirror; preview preserved",outcome})}if(copyMode)selection.applyRecordIds(records.map(record=>record.id));clearSnap();requestRender();return Object.freeze({status:"command-completed",command:"Mirror",outcome,copyMode,recordIds:Object.freeze(records.map(record=>record.id))})}
  function acceptPoint(point){if(phase==="selection")return Object.freeze({status:"invalid-input",reason:"selection-not-confirmed",command:"Mirror"});if(phase==="axis-a"){axisA=Object.freeze({x:point.x,y:point.y});axisB=axisA;phase="axis-b";updatePrompt("Specify second mirror-axis point");requestRender();return Object.freeze({status:"input-accepted",command:"Mirror",kind:"axis-a",point:axisA})}return commit(point)}
  function handlePointerDown(point){return acceptPoint(point)}
  function handlePointerMove(point){if(phase==="axis-b")axisB=Object.freeze({x:point.x,y:point.y});requestRender()}
  function handlePointerLeave(){if(phase==="axis-b")axisB=null;clearSnap();requestRender()}
  function handleInput(input){if(phase==="selection")return Object.freeze({status:"invalid-input",reason:"selection-phase",command:"Mirror",message:"Press Enter to confirm selection"});const parsed=resolveTypedPrecisionPoint(input,phase==="axis-b"?axisA:null);clearSnap();if(parsed.status!=="point-resolved")return Object.freeze({status:"invalid-input",reason:parsed.reason,command:"Mirror",message:"Enter a point as x,y"});return acceptPoint(Object.freeze({x:parsed.x,y:parsed.y}))}
  function finish(){if(phase==="selection")return confirmSelection();return Object.freeze({status:"invalid-input",reason:"point-required",command:"Mirror",message:phase==="axis-a"?"Specify first mirror-axis point":"Specify second mirror-axis point"})}
  function cancel(){axisA=null;axisB=null;clearSnap();requestRender();return Object.freeze({status:"command-cancelled",command:"Mirror"})}
  function handleOption(optionId){if(optionId!=="copy")return Object.freeze({status:"option-unavailable",reason:"unknown-option",command:"Mirror",optionId});copyMode=!copyMode;userPreferences.set({mirrorCopyEnabled:copyMode});requestRender();return Object.freeze({status:"option-updated",command:"Mirror",optionId,value:copyMode?"Yes":"No"})}
  function options(){return Object.freeze([Object.freeze({id:"copy",label:"Copy",value:copyMode?"Yes":"No",enabled:true})])}
  // The two accepted drafting points are the entire mirror-axis contract.
  // Keep them explicit in the preview too: unlike Rotate, there is no source
  // geometry-derived center, reference vector, or implicit transform origin.
  function getMovePreview(){if(phase!=="axis-b"||!axisA||!axisB)return null;let records=[];try{records=mirrorRecords(axisB)}catch{}return Object.freeze({mode:"mirror",recordIds:selectedRecordIds,basePoint:axisA,candidatePoint:axisB,copyMode,preserveSourceVisible:copyMode,sourceRecords:Object.freeze(copyMode?[]:selectedRecords()),records:Object.freeze(records)})}
  requestRender();return Object.freeze({name:"Mirror",finish,cancel,handlePointerDown,handlePointerMove,handlePointerLeave,handleInput,handleOption,getMovePreview,getOrthoReference:()=>phase==="axis-b"?axisA:null,hasPointerPreview:()=>phase!=="selection",getExcludedSnapRecordIds:()=>phase==="axis-b"?selectedRecordIds:Object.freeze([]),get isSelectionPhase(){return phase==="selection"},get phase(){return phase},get selectedRecordIds(){return selectedRecordIds},get copyMode(){return copyMode},get options(){return options()},get axisA(){return axisA},get axisB(){return axisB},get prompt(){return promptPresentation.text},get promptPresentation(){return promptPresentation}})
}

function createScaleCommandSession({ setPrompt = () => {} } = {}) {
  const FACTOR_EPSILON=1e-12
  let phase=selection.selectedIds().length?"base":"selection"
  let selectedRecordIds=phase==="base"?selection.selectedIds():Object.freeze([])
  let basePoint=null,referencePoint=null,candidatePoint=null,feedbackVisible=false,copyMode=false
  let promptPresentation=createCommandPrompt("Scale",phase==="selection"?"Select objects":"Specify base point")
  function updatePrompt(instruction){promptPresentation=createCommandPrompt("Scale",instruction);setPrompt(promptPresentation.text,promptPresentation)}
  function selectedRecords(){const selected=new Set(selectedRecordIds);return editableRecords().filter(record=>selected.has(record.id))}
  function confirmSelection(){const ids=selection.selectedIds();if(!ids.length)return Object.freeze({status:"invalid-input",reason:"empty-selection",command:"Scale",message:"Select at least one object"});selectedRecordIds=ids;phase="base";updatePrompt("Specify base point");requestRender();return Object.freeze({status:"input-accepted",command:"Scale",kind:"selection",recordIds:selectedRecordIds})}
  function distanceFromBase(point){return Math.hypot(point.x-basePoint.x,point.y-basePoint.y)}
  function factorTo(point){const referenceDistance=distanceFromBase(referencePoint),targetDistance=distanceFromBase(point),factor=targetDistance/referenceDistance;return Number.isFinite(factor)&&factor>0?factor:null}
  function commitTarget(point){candidatePoint=Object.freeze({x:point.x,y:point.y});const factor=factorTo(candidatePoint);if(factor===null){requestRender();return Object.freeze({status:"invalid-input",reason:"invalid-scale-factor",command:"Scale",message:"Scale target must differ from base point"})}if(Math.abs(factor-1)<=FACTOR_EPSILON){clearSnap();candidatePoint=null;feedbackVisible=false;requestRender();return Object.freeze({status:"command-completed",command:"Scale",outcome:Object.freeze({status:"no-op"}),factor})}let replacements;try{const source=selectedRecords();if(source.length!==selectedRecordIds.length)return Object.freeze({status:"invalid-input",reason:"missing-selection",command:"Scale",message:"A selected object is no longer available"});replacements=source.map(record=>window.CaderactGeometryTransform.scaleRecord(record,basePoint,factor));if(copyMode)replacements=replacements.map(record=>recordGateway.copyWithFreshIdentity(record))}catch(error){requestRender();return Object.freeze({status:"invalid-input",reason:"invalid-scale",command:"Scale",message:error.message})}const outcome=copyMode?recordGateway.createAll(replacements):recordGateway.replaceAll(replacements);if(outcome.status!=="committed"){requestRender();return Object.freeze({status:"invalid-input",reason:"commit-failed",command:"Scale",message:"Unable to scale; preview preserved",outcome})}if(copyMode)selection.applyRecordIds(replacements.map(record=>record.id));clearSnap();candidatePoint=null;feedbackVisible=false;requestRender();return Object.freeze({status:"command-completed",command:"Scale",outcome,factor,copyMode,recordIds:Object.freeze(replacements.map(record=>record.id))})}
  function acceptPoint(point){if(phase==="selection")return Object.freeze({status:"invalid-input",reason:"selection-not-confirmed",command:"Scale"});if(phase==="base"){basePoint=Object.freeze({x:point.x,y:point.y});feedbackVisible=true;phase="reference";updatePrompt("Specify reference point");requestRender();return Object.freeze({status:"input-accepted",command:"Scale",kind:"base-point",point:basePoint})}if(phase==="reference"){if(point.x===basePoint.x&&point.y===basePoint.y)return Object.freeze({status:"invalid-input",reason:"zero-reference-distance",command:"Scale",message:"Reference point must differ from base point"});referencePoint=Object.freeze({x:point.x,y:point.y});candidatePoint=referencePoint;feedbackVisible=true;phase="target";updatePrompt("Specify scale target");requestRender();return Object.freeze({status:"input-accepted",command:"Scale",kind:"reference-point",point:referencePoint})}return commitTarget(point)}
  function handlePointerDown(point){return acceptPoint(point)}
  function handlePointerMove(point){if(basePoint)feedbackVisible=true;if(phase==="target")candidatePoint=Object.freeze({x:point.x,y:point.y});requestRender()}
  function handlePointerLeave(){candidatePoint=null;feedbackVisible=false;clearSnap();requestRender()}
  function handleInput(input){if(phase==="selection")return Object.freeze({status:"invalid-input",reason:"selection-phase",command:"Scale",message:"Press Enter to confirm selection"});const scalar=phase==="target"?window.CaderactPrecisionInput.parseScalar(input,modelReader.units().length):null;if(scalar?.status==="precision-parsed"){if(!(scalar.value>0))return Object.freeze({status:"invalid-input",reason:"invalid-scale-factor",command:"Scale",message:"Scale factor must be positive"});clearSnap();return acceptPoint(Object.freeze({x:basePoint.x+(referencePoint.x-basePoint.x)*scalar.value,y:basePoint.y+(referencePoint.y-basePoint.y)*scalar.value}))}const anchor=phase==="reference"?basePoint:phase==="target"?referencePoint:null,parsed=resolveTypedPrecisionPoint(input,anchor);clearSnap();if(parsed.status!=="point-resolved")return Object.freeze({status:"invalid-input",reason:parsed.reason,command:"Scale",message:"Enter a point as x,y or a scale factor"});return acceptPoint(Object.freeze({x:parsed.x,y:parsed.y}))}
  function finish(){if(phase==="selection")return confirmSelection();return Object.freeze({status:"invalid-input",reason:"point-required",command:"Scale",message:phase==="base"?"Specify a base point":phase==="reference"?"Specify a reference point":"Specify a scale target"})}
  function cancel(){candidatePoint=null;feedbackVisible=false;clearSnap();requestRender();return Object.freeze({status:"command-cancelled",command:"Scale"})}
  function handleOption(optionId){if(optionId!=="copy")return Object.freeze({status:"option-unavailable",reason:"unknown-option",command:"Scale",optionId});copyMode=!copyMode;requestRender();return Object.freeze({status:"option-updated",command:"Scale",optionId,value:copyMode?"Yes":"No"})}
  function options(){return Object.freeze([Object.freeze({id:"copy",label:"Copy",value:copyMode?"Yes":"No",enabled:true})])}
  function getMovePreview(){if(!feedbackVisible||!basePoint)return null;const validTarget=phase==="target"&&candidatePoint,factor=validTarget?factorTo(candidatePoint):null,sourceRecords=phase==="target"?selectedRecords():[];let records=[];if(factor!==null){try{records=sourceRecords.map(record=>window.CaderactGeometryTransform.scaleRecord(record,basePoint,factor))}catch{records=[]}}return Object.freeze({mode:"scale",recordIds:selectedRecordIds,basePoint,referencePoint,candidatePoint:validTarget?candidatePoint:null,factor,copyMode,preserveSourceVisible:copyMode,sourceRecords:Object.freeze(copyMode?[]:sourceRecords),records:Object.freeze(records)})}
  requestRender()
  return Object.freeze({name:"Scale",finish,cancel,handlePointerDown,handlePointerMove,handlePointerLeave,handleInput,handleOption,getMovePreview,hasPointerPreview:()=>phase!=="selection",getExcludedSnapRecordIds:()=>phase==="target"?selectedRecordIds:Object.freeze([]),get isSelectionPhase(){return phase==="selection"},get phase(){return phase},get selectedRecordIds(){return selectedRecordIds},get copyMode(){return copyMode},get options(){return options()},get basePoint(){return basePoint},get referencePoint(){return referencePoint},get candidatePoint(){return candidatePoint},get prompt(){return promptPresentation.text},get promptPresentation(){return promptPresentation}})
}

function createDeleteCommandSession({ setPrompt = () => {} } = {}) {
  let promptPresentation=createCommandPrompt("Delete","Select objects to delete, then press Enter")
  function updatePrompt(instruction){promptPresentation=createCommandPrompt("Delete",instruction);setPrompt(promptPresentation.text,promptPresentation)}
  function selectedRecordIds(){return selection.selectedIds()}
  function finish(){const recordIds=selectedRecordIds();if(!recordIds.length)return Object.freeze({status:"command-completed",command:"Delete",outcome:Object.freeze({status:"no-op"}),recordIds:Object.freeze([])});const outcome=recordGateway.removeAll(recordIds);if(outcome.status!=="committed"){updatePrompt("Unable to delete; selection preserved");requestRender();return Object.freeze({status:"invalid-input",reason:"commit-failed",command:"Delete",message:"Unable to delete; selection preserved",outcome})}selection.clear();clearSnap();requestRender();return Object.freeze({status:"command-completed",command:"Delete",outcome,recordIds:Object.freeze(recordIds)})}
  function cancel(){clearSnap();requestRender();return Object.freeze({status:"command-cancelled",command:"Delete"})}
  requestRender()
  return Object.freeze({name:"Delete",finish,cancel,handlePointerLeave:()=>requestRender(),get isSelectionPhase(){return true},get prompt(){return promptPresentation.text},get promptPresentation(){return promptPresentation}})
}

function createTrimCommandSession({ setPrompt = () => {} } = {}) {
  // M6P6-fast-path: mirrors Move/Copy/Rotate/Scale's existing preselection
  // convention (`phase = selection.selectedIds().length ? <post-selection
  // phase> : <selection phase>`). Only IDs that resolve against CURRENT
  // committed records are honored -- stale/missing preselected IDs are
  // dropped, and if nothing valid remains Trim falls back to the normal
  // "cutting-edges" phase exactly as if nothing had been preselected.
  const initialSelectedIds = selection.selectedIds().filter(id => modelReader.isRecordVisible(id))
  let phase = initialSelectedIds.length ? "targets" : "cutting-edges"
  let confirmedCuttingEdgeIds = phase === "targets" ? Object.freeze(initialSelectedIds) : Object.freeze([])
  let hoveredTargetId = null, pendingPlan = null, pointerLocation = null
  let promptPresentation = createCommandPrompt("Trim", phase === "targets" ? "Select object to trim, or press Enter to finish" : "Select cutting edges, then press Enter")
  function updatePrompt(instruction) { promptPresentation = createCommandPrompt("Trim", instruction); setPrompt(promptPresentation.text, promptPresentation) }

  function resolveCuttingEdges() {
    const byId = new Map(visibleRecords().map(record => [record.id, record]))
    const resolved = []
    for (const id of confirmedCuttingEdgeIds) { const record = byId.get(id); if (record) resolved.push(record) }
    return resolved
  }

  function confirmCuttingEdges() {
    const ids = selection.selectedIds()
    if (!ids.length) return Object.freeze({ status: "invalid-input", reason: "empty-selection", command: "Trim", message: "Select at least one cutting edge" })
    confirmedCuttingEdgeIds = ids
    phase = "targets"
    updatePrompt("Select object to trim, or press Enter to finish")
    requestRender()
    return Object.freeze({ status: "input-accepted", command: "Trim", kind: "cutting-edges", recordIds: confirmedCuttingEdgeIds })
  }

  // M6P6: hit-test the hovered target using the RAW/pre-snap screen pointer
  // location -- never the snapped screen position -- exactly as Phase 5
  // established for handlePointerDown. `screenPoint` intentionally ignores
  // `point` (which may be a snapped model-space location); callers that only
  // have a model-space point still fall back to a projection of that point.
  function hitTestTargetAtRawPointer(fallbackModelPoint) {
    const screenPoint = lastKnownPointerScreen || worldToScreen(fallbackModelPoint.x, fallbackModelPoint.y)
    const hit = window.CaderactSelection.hitTestRecords({ screenPoint, records: editableRecords(), worldToScreen })
    if (!hit.hit) return null
    return editableRecords().find(record => record.id === hit.recordId) || null
  }

  // Single source of truth for both preview and commit: always re-resolves
  // cutting edges against current committed geometry (Phase 5 semantics) and
  // always calls TrimPlanner.planTrim -- never independently computes
  // intersections, target side, or resulting topology.
  function planForTarget(targetRecord, modelPoint) {
    const cuttingEdges = resolveCuttingEdges()
    return window.CaderactTrimPlanner.planTrim({ target: targetRecord, cuttingEdges, pickPoint: modelPoint })
  }

  // Maps one TrimPlanner geometry piece into a plain, renderer-neutral,
  // identity-free transient record. No topology/geometry decisions are made
  // here -- only a direct field copy of what TrimPlanner already computed.
  function toPreviewRecord(piece) {
    const geometry = piece?.geometry
    if (!geometry) return null
    if (geometry.type === "line") return Object.freeze({ id: null, type: "line", start: geometry.start, end: geometry.end })
    if (geometry.type === "arc") return Object.freeze({ id: null, type: "arc", center: geometry.center, radius: geometry.radius, start: geometry.start, end: geometry.end, sweep: geometry.sweep })
    if (geometry.type === "polyline") return Object.freeze({ id: null, type: "polyline", vertices: geometry.vertices, closed: Boolean(geometry.closed) })
    return null
  }

  function handlePointerDown(point) {
    hoveredTargetId = null
    pendingPlan = null
    const targetRecord = hitTestTargetAtRawPointer(point)
    if (!targetRecord) { requestRender(); return Object.freeze({ status: "input-accepted", command: "Trim", kind: "target-miss" }) }
    hoveredTargetId = targetRecord.id
    // Correctness over cache reuse: recompute/validate a fresh plan at click
    // time against current committed geometry rather than publishing a
    // possibly-stale hover-time plan.
    const plan = planForTarget(targetRecord, point)
    if (plan.status !== "planned") {
      requestRender()
      return Object.freeze({ status: "input-accepted", command: "Trim", kind: "no-op", planStatus: plan.status, reason: plan.reason })
    }
    pendingPlan = plan
    const outcome = recordGateway.publishTrimPlan(plan)
    if (outcome.status !== "committed") {
      pendingPlan = null
      updatePrompt("Unable to trim; cutting edges preserved")
      requestRender()
      return Object.freeze({ status: "invalid-input", reason: "commit-failed", command: "Trim", message: "Unable to trim; cutting edges preserved", outcome })
    }
    // Successful commit: clear any stale pending plan/hovered target so the
    // next pointer move recomputes strictly from current committed records.
    pendingPlan = null
    hoveredTargetId = null
    updatePrompt("Select object to trim, or press Enter to finish")
    requestRender()
    return Object.freeze({ status: "input-accepted", command: "Trim", kind: "trimmed", outcome, plan })
  }

  function handlePointerMove(point) {
    pointerLocation = Object.freeze({ x: point.x, y: point.y })
    if (phase !== "targets") { hoveredTargetId = null; pendingPlan = null; requestRender(); return }
    const targetRecord = hitTestTargetAtRawPointer(point)
    if (!targetRecord) {
      hoveredTargetId = null
      pendingPlan = null
      requestRender()
      return
    }
    hoveredTargetId = targetRecord.id
    const plan = planForTarget(targetRecord, point)
    pendingPlan = plan.status === "planned" ? plan : null
    requestRender()
  }

  function handlePointerLeave() {
    pointerLocation = null
    hoveredTargetId = null
    pendingPlan = null
    clearSnap()
    requestRender()
  }

  function getTrimPreview() {
    if (phase !== "targets" || !pendingPlan || pendingPlan.status !== "planned") return null
    const pieces = [pendingPlan.replacement, ...pendingPlan.creates]
    const records = Object.freeze(pieces.map(toPreviewRecord).filter(Boolean))
    if (!records.length) return null
    return Object.freeze({ records, sourceRecordId: pendingPlan.targetRecordId, phase: "targets" })
  }

  function finish() {
    if (phase === "cutting-edges") return confirmCuttingEdges()
    clearSnap(); pointerLocation = null; hoveredTargetId = null; pendingPlan = null; requestRender()
    return Object.freeze({ status: "command-completed", command: "Trim" })
  }
  function cancel() {
    clearSnap(); pointerLocation = null; hoveredTargetId = null; pendingPlan = null; requestRender()
    return Object.freeze({ status: "command-cancelled", command: "Trim" })
  }

  requestRender()
  return Object.freeze({
    name: "Trim", finish, cancel, handlePointerDown, handlePointerMove, handlePointerLeave,
    hasPointerPreview: () => phase === "targets",
    getExcludedSnapRecordIds: () => Object.freeze([]),
    getTrimPreview,
    get isSelectionPhase() { return phase === "cutting-edges" },
    get phase() { return phase },
    get confirmedCuttingEdgeIds() { return confirmedCuttingEdgeIds },
    get prompt() { return promptPresentation.text }, get promptPresentation() { return promptPresentation },
  })
}

function createExtendCommandSession({ setPrompt = () => {} } = {}) {
  const initialSelectedIds = selection.selectedIds().filter(id => modelReader.isRecordVisible(id))
  let phase = initialSelectedIds.length ? "targets" : "boundaries"
  let confirmedBoundaryIds = phase === "targets" ? Object.freeze(initialSelectedIds) : Object.freeze([])
  let hoveredTargetId = null, pendingPlan = null, pointerLocation = null
  let promptPresentation = createCommandPrompt("Extend", phase === "targets" ? "Select object endpoint to extend, or press Enter to finish" : "Select boundary objects, then press Enter")
  function updatePrompt(instruction) { promptPresentation = createCommandPrompt("Extend", instruction); setPrompt(promptPresentation.text, promptPresentation) }

  function resolveBoundaries() {
    const byId = new Map(visibleRecords().map(record => [record.id, record]))
    const resolved = []
    for (const id of confirmedBoundaryIds) { const record = byId.get(id); if (record) resolved.push(record) }
    return resolved
  }

  function confirmBoundaries() {
    const ids = selection.selectedIds()
    if (!ids.length) return Object.freeze({ status: "invalid-input", reason: "empty-selection", command: "Extend", message: "Select at least one boundary object" })
    confirmedBoundaryIds = Object.freeze(ids)
    phase = "targets"
    updatePrompt("Select object endpoint to extend, or press Enter to finish")
    requestRender()
    return Object.freeze({ status: "input-accepted", command: "Extend", kind: "boundaries", recordIds: confirmedBoundaryIds })
  }

  function hitTestTargetAtRawPointer(fallbackModelPoint) {
    const screenPoint = lastKnownPointerScreen || worldToScreen(fallbackModelPoint.x, fallbackModelPoint.y)
    const hit = window.CaderactSelection.hitTestRecords({ screenPoint, records: editableRecords(), worldToScreen })
    if (!hit.hit) return null
    return editableRecords().find(record => record.id === hit.recordId) || null
  }

  function planForTarget(targetRecord, modelPoint) {
    return window.CaderactExtendPlanner.planExtend({ target: targetRecord, cuttingEdges: resolveBoundaries(), pickPoint: modelPoint })
  }

  function toPreviewRecord(piece) {
    const geometry = piece?.geometry
    if (!geometry) return null
    if (geometry.type === "line") return Object.freeze({ id: null, type: "line", start: geometry.start, end: geometry.end })
    if (geometry.type === "arc") return Object.freeze({ id: null, type: "arc", center: geometry.center, radius: geometry.radius, start: geometry.start, end: geometry.end, sweep: geometry.sweep })
    if (geometry.type === "polyline") return Object.freeze({ id: null, type: "polyline", vertices: geometry.vertices, closed: Boolean(geometry.closed) })
    return null
  }

  function sourceRecord() {
    return visibleRecords().find(record => record.id === pendingPlan?.targetRecordId) || null
  }

  function handlePointerDown(point) {
    hoveredTargetId = null
    pendingPlan = null
    const targetRecord = hitTestTargetAtRawPointer(point)
    if (!targetRecord) { requestRender(); return Object.freeze({ status: "input-accepted", command: "Extend", kind: "target-miss" }) }
    hoveredTargetId = targetRecord.id
    const plan = planForTarget(targetRecord, point)
    if (plan.status !== "planned") {
      requestRender()
      return Object.freeze({ status: "input-accepted", command: "Extend", kind: "no-op", planStatus: plan.status, reason: plan.reason })
    }
    pendingPlan = plan
    const outcome = recordGateway.publishExtendPlan(plan)
    if (outcome.status !== "committed") {
      updatePrompt("Unable to extend; boundaries preserved")
      requestRender()
      return Object.freeze({ status: "invalid-input", reason: "commit-failed", command: "Extend", message: "Unable to extend; boundaries preserved", outcome })
    }
    pendingPlan = null
    hoveredTargetId = null
    updatePrompt("Select object endpoint to extend, or press Enter to finish")
    requestRender()
    return Object.freeze({ status: "input-accepted", command: "Extend", kind: "extended", outcome, plan })
  }

  function handlePointerMove(point) {
    pointerLocation = Object.freeze({ x: point.x, y: point.y })
    if (phase !== "targets") { hoveredTargetId = null; pendingPlan = null; requestRender(); return }
    const targetRecord = hitTestTargetAtRawPointer(point)
    if (!targetRecord) { hoveredTargetId = null; pendingPlan = null; requestRender(); return }
    hoveredTargetId = targetRecord.id
    const plan = planForTarget(targetRecord, point)
    pendingPlan = plan.status === "planned" ? plan : null
    requestRender()
  }

  function handlePointerLeave() {
    pointerLocation = null
    hoveredTargetId = null
    pendingPlan = null
    clearSnap()
    requestRender()
  }

  function getExtendPreview() {
    if (phase !== "targets" || !pendingPlan || pendingPlan.status !== "planned") return null
    const record = toPreviewRecord(pendingPlan.replacement)
    const source = sourceRecord()
    if (!record || !source) return null
    return Object.freeze({ records: Object.freeze([record]), sourceRecords: Object.freeze([source]), sourceRecordId: pendingPlan.targetRecordId, phase: "targets" })
  }

  function finish() {
    if (phase === "boundaries") return confirmBoundaries()
    clearSnap(); pointerLocation = null; hoveredTargetId = null; pendingPlan = null; requestRender()
    return Object.freeze({ status: "command-completed", command: "Extend" })
  }
  function cancel() {
    clearSnap(); pointerLocation = null; hoveredTargetId = null; pendingPlan = null; requestRender()
    return Object.freeze({ status: "command-cancelled", command: "Extend" })
  }

  requestRender()
  return Object.freeze({
    name: "Extend", finish, cancel, handlePointerDown, handlePointerMove, handlePointerLeave,
    hasPointerPreview: () => phase === "targets",
    getExcludedSnapRecordIds: () => Object.freeze([]),
    getExtendPreview,
    get isSelectionPhase() { return phase === "boundaries" },
    get phase() { return phase },
    get confirmedBoundaryIds() { return confirmedBoundaryIds },
    get prompt() { return promptPresentation.text }, get promptPresentation() { return promptPresentation },
  })
}

function createOffsetCommandSession({ setPrompt = () => {}, preselectionIds = [] } = {}) {
  const preselectedSource = (() => {
    if (!Array.isArray(preselectionIds) || preselectionIds.length !== 1) return null
    const record = editableRecords().find(candidate => candidate.id === preselectionIds[0]) || null
    return ["line", "circle", "arc", "polyline"].includes(record?.type) ? record : null
  })()
  let distance = 1, phase = preselectedSource ? "side" : "select", source = preselectedSource, preview = null
  let promptPresentation = createCommandPrompt("Offset", preselectedSource ? "Move pointer to choose offset side" : "Select object to offset")
  function updatePrompt(instruction) { promptPresentation = createCommandPrompt("Offset", instruction); setPrompt(promptPresentation.text, promptPresentation) }
  function makeRecord(geometry, layerId) {
    let record
    if (geometry.type === "line") record = recordGateway.createLine(geometry.start, geometry.end)
    else if (geometry.type === "circle") record = recordGateway.createCircle(geometry.center, geometry.radius)
    else if (geometry.type === "arc") record = recordGateway.createArc(geometry)
    else if (geometry.type === "polyline") record = recordGateway.createPolyline(geometry.vertices, geometry.closed)
    else return null
    return Object.freeze({ ...record, layerId, ...window.CaderactObjectProperties.recordProperties(source) })
  }
  function hitAt(point) {
    const screenPoint = lastKnownPointerScreen || worldToScreen(point.x, point.y)
    const hit = window.CaderactSelection.hitTestRecords({ screenPoint, records: editableRecords(), worldToScreen })
    return hit.hit ? editableRecords().find(record => record.id === hit.recordId) || null : null
  }
  function updatePreview(point) {
    if (phase !== "side" || !source) return null
    const plan = window.CaderactOffsetGeometry.offset(source, distance, point)
    preview = plan.status === "planned" ? plan.geometry : null
    requestRender()
    return plan
  }
  function handleInput(input) {
    if (phase !== "distance") return Object.freeze({ status: "invalid-input", reason: "distance-not-editing", command: "Offset", message: "Select an object or choose Distance" })
    const text = String(input ?? "").trim()
    const parsed = text === "" ? null : window.CaderactPrecisionInput.parseScalar(text, modelReader.units().length)
    const value = text === "" ? distance : parsed?.value
    if (!(Number.isFinite(value) && value > 0)) return Object.freeze({ status: "invalid-input", reason: "invalid-distance", command: "Offset", message: "Offset distance must be a positive finite number" })
    distance = value
    source = null; preview = null; phase = "select"; updatePrompt("Select object to offset")
    requestRender()
    return Object.freeze({ status: "input-accepted", command: "Offset", kind: "distance", distance })
  }
  function handlePointerDown(point, context = {}) {
    const rawPoint = context.rawPoint || point
    if (phase === "distance") return Object.freeze({ status: "invalid-input", reason: "distance-required", command: "Offset", message: "Enter a positive offset distance" })
    if (phase === "select") {
      const target = hitAt(rawPoint)
      if (!target) return Object.freeze({ status: "input-accepted", command: "Offset", kind: "target-miss" })
      if (target.type === "ellipse") return Object.freeze({ status: "invalid-input", reason: "unsupported-ellipse", command: "Offset", message: "Ellipse offset is not supported" })
      if (!["line", "circle", "arc", "polyline"].includes(target.type)) return Object.freeze({ status: "invalid-input", reason: "unsupported-curve", command: "Offset", message: "Select a supported curve" })
      source = target; phase = "side"; updatePrompt("Move pointer to choose offset side"); updatePreview(rawPoint)
      return Object.freeze({ status: "input-accepted", command: "Offset", kind: "source", recordId: target.id })
    }
    const plan = window.CaderactOffsetGeometry.offset(source, distance, rawPoint)
    if (plan.status !== "planned") { preview = null; updatePrompt("Offset cannot be created here; choose another side"); requestRender(); return Object.freeze({ status: "invalid-input", reason: plan.reason, command: "Offset", message: "Offset result is invalid" }) }
    const record = makeRecord(plan.geometry, source.layerId)
    const outcome = record ? recordGateway.createAll([record]) : Object.freeze({ status: "commit-failed" })
    if (outcome.status !== "committed") { updatePrompt("Unable to create offset; choose another side"); requestRender(); return Object.freeze({ status: "invalid-input", reason: "commit-failed", command: "Offset", outcome }) }
    source = null; preview = null; phase = "select"; clearSnap(); updatePrompt("Select object to offset"); requestRender()
    return Object.freeze({ status: "input-accepted", command: "Offset", kind: "offset-created", outcome, recordId: record.id })
  }
  function handlePointerMove(point, context = {}) { if (phase === "side") updatePreview(context.rawPoint || point) }
  function handlePointerLeave() { preview = null; clearSnap(); requestRender() }
  function finish() {
    if (phase === "distance") return handleInput("")
    clearSnap(); preview = null; source = null; requestRender()
    return Object.freeze({ status: "command-completed", command: "Offset" })
  }
  function cancel() { clearSnap(); preview = null; source = null; requestRender(); return Object.freeze({ status: "command-cancelled", command: "Offset" }) }
  function handleOption(optionId) {
    if (optionId !== "distance") return Object.freeze({ status: "option-unavailable", reason: "unknown-option", command: "Offset", optionId })
    source = null; preview = null; phase = "distance"; updatePrompt(`Enter offset distance <${distance}>`); requestRender()
    return Object.freeze({ status: "option-updated", command: "Offset", optionId, value: distance })
  }
  function options() { return Object.freeze([Object.freeze({ id: "distance", label: "Distance", value: String(distance), enabled: true })]) }
  function getOffsetPreview() { return preview && source ? Object.freeze({ mode: "offset", preserveSourceVisible: true, records: Object.freeze([Object.freeze({ id: null, ...preview })]), sourceRecords: Object.freeze([]), recordIds: Object.freeze([]) }) : null }
  requestRender()
  return Object.freeze({ name: "Offset", finish, cancel, handleInput, handlePointerDown, handlePointerMove, handlePointerLeave, handleOption,
    hasPointerPreview: () => phase === "side", usesResolvedPoint: false, getOffsetPreview, get options() { return options() }, get phase() { return phase }, get distance() { return distance }, get prompt() { return promptPresentation.text }, get promptPresentation() { return promptPresentation } })
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
    const parsed = resolveTypedPrecisionPoint(input, draft.center)
    clearSnap()
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
    hasPointerPreview: () => true,
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
    const parsed=resolveTypedPrecisionPoint(input,draft.currentPoint);clearSnap()
    if(parsed.status!=="point-resolved")return Object.freeze({status:"invalid-input",reason:parsed.reason,command:"Arc",message:"Enter a point as x,y"})
    const point=Object.freeze({x:parsed.x,y:parsed.y});return presentOutcome(draft.acceptPoint(point),point)
  }
  function finish(){clearSnap();draft.finish();requestRender();return Object.freeze({status:"command-completed",command:"Arc"})}
  function cancel(){clearSnap();draft.cancel();requestRender();return Object.freeze({status:"command-cancelled",command:"Arc"})}
  function getSnapCandidates(){return draft.acceptedPoints().map((point,index)=>Object.freeze({kind:"draft-point",point,
    stableKey:`arc-draft:${index}`,reference:Object.freeze({kind:"draft-point",index})}))}
  requestRender()
  return Object.freeze({name:"Arc",draft,finish,cancel,handlePointerDown,handlePointerMove,handlePointerLeave,handleInput,
    getArcPreview:draft.preview,getDraftPoints:draft.acceptedPoints,getSnapCandidates,hasPointerPreview:()=>true,
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
    const parsed=resolveTypedPrecisionPoint(input,draft.currentPoint);clearSnap()
    if(parsed.status!=="point-resolved")return Object.freeze({status:"invalid-input",reason:parsed.reason,command:"Ellipse",message:"Enter a point as x,y"})
    const point=Object.freeze({x:parsed.x,y:parsed.y});return presentOutcome(draft.acceptPoint(point),point)
  }
  function finish(){clearSnap();draft.finish();requestRender();return Object.freeze({status:"command-completed",command:"Ellipse"})}
  function cancel(){clearSnap();draft.cancel();requestRender();return Object.freeze({status:"command-cancelled",command:"Ellipse"})}
  function getSnapCandidates(){return draft.acceptedPoints().map((point,index)=>Object.freeze({kind:"draft-point",point,
    stableKey:`ellipse-draft:${index}`,reference:Object.freeze({kind:"draft-point",index})}))}
  requestRender()
  return Object.freeze({name:"Ellipse",draft,finish,cancel,handlePointerDown,handlePointerMove,handlePointerLeave,handleInput,
    getEllipsePreview:draft.preview,getDraftPoints:draft.acceptedPoints,getSnapCandidates,hasPointerPreview:()=>true,
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
    const parsed=resolveTypedPrecisionPoint(input,draft.center)
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
    getPreviewLines:draft.previewEdges,getDraftPoints:draft.acceptedPoints,getSnapCandidates,hasPointerPreview:()=>!editingSides,
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
    const parsed = resolveTypedPrecisionPoint(input, draft.firstCorner)
    clearSnap()
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
    getOrthoReference: () => draft.firstCorner,
    hasPointerPreview: () => true,
    get prompt() { return promptPresentation.text }, get promptPresentation() { return promptPresentation },
  })
}

function createPolylineCommandSession({ setPrompt = () => {} } = {}) {
  const draft = window.CaderactPolylineDraftSession.createSession({
    createPolyline: recordGateway.createPolyline,
    commitRecords: recordGateway.createAll,
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
      updatePrompt("Close requires at least three vertices")
      return Object.freeze({ status: "invalid-input", reason: "close-unavailable", command: "Polyline",
        message: "Close requires at least three distinct vertices", outcome })
    }
    updatePrompt("Unable to commit; draft preserved")
    return Object.freeze({ status: "invalid-input", reason: "commit-failed", command: "Polyline", outcome })
  }
  function handlePointerDown(point, context = {}) {
    const acceptedStartPoint = draft.firstPoint
    if (draft.canClose && acceptedStartPoint
      && point.x === acceptedStartPoint.x && point.y === acceptedStartPoint.y) return presentPublication(draft.close())
    const outcome=draft.acceptPoint(point)
    if(outcome.status==="segment-added"&&isFinishingObjectSnap(context.snap))return presentPublication(draft.finish())
    return presentPointOutcome(outcome, point)
  }
  function handlePointerMove(point) { draft.updatePointer(point); requestRender() }
  function handlePointerLeave() { draft.clearPointer(); clearSnap(); requestRender() }
  function handleInput(input) {
    if (typeof input === "string" && input.trim().toLowerCase() === "close") return presentPublication(draft.close())
    const parsed = resolveTypedPrecisionPoint(input, draft.currentPoint)
    clearSnap()
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
  function getPreviewLines() { return draft.previewEdges() }
  function handleOption(optionId){
    if(optionId==="persistentClose"){draft.setPersistentClose(!draft.persistentClose);requestRender();return Object.freeze({status:"option-updated",command:"Polyline",optionId})}
    if(optionId==="close")return presentPublication(draft.close())
    return Object.freeze({status:"option-unavailable",reason:"unknown-option",command:"Polyline",optionId})
  }
  function options(){const result=[Object.freeze({id:"persistentClose",label:"PersistentClose",value:draft.persistentClose?"Yes":"No",enabled:true})];if(draft.canClose)result.push(Object.freeze({id:"close",label:"Close",value:"",showValue:false,enabled:true}));return Object.freeze(result)}
  requestRender()
  return Object.freeze({
    name: "Polyline", draft, finish, cancel, stepUndo, handlePointerDown, handlePointerMove, handlePointerLeave, handleInput,handleOption,
    getDraftLines: draft.draftSegments, getPreview: draft.preview, getPreviewLines,
    getDraftPoints: draft.acceptedPoints, getSnapCandidates, getOrthoReference: () => draft.currentPoint, hasPointerPreview: () => true,
    get options(){return options()},get prompt() { return promptPresentation.text }, get promptPresentation() { return promptPresentation },
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
  userPreferences.set({ gridSnapEnabled: next })
  clearSnap()
  requestRender()
  return snapModes
}

function subscribeSnapModes(listener) {
  snapModeListeners.add(listener)
  listener(snapModes)
  return () => snapModeListeners.delete(listener)
}
function setObjectSnapTrackingEnabled(enabled) {
  const next = Boolean(enabled)
  if (objectSnapTrackingEnabled === next) return next
  objectSnapTrackingEnabled = next
  if (!next) objectSnapTracking.clear()
  userPreferences.set({ objectSnapTrackingEnabled: next })
  for (const listener of objectSnapTrackingListeners) listener(next)
  requestRender()
  return next
}
function subscribeObjectSnapTracking(listener) { objectSnapTrackingListeners.add(listener); listener(objectSnapTrackingEnabled); return () => objectSnapTrackingListeners.delete(listener) }
function setObjectSnapMode(mode, enabled) {
  if (!(mode in snapModes) || mode === "grid") throw new Error("Unknown object snap mode")
  const next = Boolean(enabled)
  if (snapModes[mode] === next) return snapModes
  snapModes = Object.freeze({ ...snapModes, [mode]: next })
  if (mode === "object" && !next) { objectSnapTracking.clear(); clearSnap() }
  const preferenceKey = mode === "object" ? "objectSnapEnabled" : `${mode}SnapEnabled`
  userPreferences.set({ [preferenceKey]: next })
  for (const listener of snapModeListeners) listener(snapModes)
  updateSnapAtPointer()
  return snapModes
}

function setOrthoEnabled(enabled) {
  orthoEnabled = Boolean(enabled)
  if (orthoEnabled) polarEnabled = false
  userPreferences.set({ orthoEnabled, polarEnabled })
  for (const listener of orthoListeners) listener(orthoEnabled)
  for (const listener of polarListeners) listener(polarEnabled)
  notifyEffectiveOrtho()
  notifyEffectivePolar()
  updateSnapAtPointer()
  return orthoEnabled
}
function subscribeOrtho(listener) { orthoListeners.add(listener); listener(orthoEnabled); return () => orthoListeners.delete(listener) }
function setPolarEnabled(enabled) {
  polarEnabled = Boolean(enabled)
  if (polarEnabled) orthoEnabled = false
  userPreferences.set({ polarEnabled, orthoEnabled })
  for (const listener of polarListeners) listener(polarEnabled)
  for (const listener of orthoListeners) listener(orthoEnabled)
  notifyEffectiveOrtho(); notifyEffectivePolar(); updateSnapAtPointer(); return polarEnabled
}
function subscribePolar(listener) { polarListeners.add(listener); listener(polarEnabled); return () => polarListeners.delete(listener) }
function setPolarIncrementDegrees(degrees) { if (!Number.isFinite(degrees) || degrees <= 0 || degrees > 180) throw new Error("Invalid Polar increment"); polarIncrementDegrees = degrees; userPreferences.set({ polarIncrementDegrees: degrees }); updateSnapAtPointer(); return polarIncrementDegrees }
function effectiveOrtho() { return !polarEnabled && (orthoEnabled !== shiftHeld) }
function effectivePolar() { return polarEnabled && !shiftHeld }
function notifyEffectiveOrtho() { for (const listener of effectiveOrthoListeners) listener(effectiveOrtho()) }
function subscribeEffectiveOrtho(listener) { effectiveOrthoListeners.add(listener); listener(effectiveOrtho()); return () => effectiveOrthoListeners.delete(listener) }
function notifyEffectivePolar() { for (const listener of effectivePolarListeners) listener(effectivePolar()) }
function subscribeEffectivePolar(listener) { effectivePolarListeners.add(listener); listener(effectivePolar()); return () => effectivePolarListeners.delete(listener) }
function isOrthoActive() { return effectiveOrtho() }
function resolveCommandPointer(rawPoint, session, options = {}) {
  if(session?.usesResolvedPoint===false){clearSnap();objectSnapTracking.clearHover();return Object.freeze({snapped:false,point:Object.freeze({x:rawPoint.x,y:rawPoint.y})})}
  const reference = session?.getOrthoReference?.()
  const orthoActive=isOrthoActive()&&Number.isFinite(reference?.x)&&Number.isFinite(reference?.y)
  let constrained = window.CaderactOrthoConstraint.constrain(rawPoint, reference, orthoActive),polarTracked=false,polarAngle=null
  polarGuide = null
  if (effectivePolar()) {
    const polar = window.CaderactPolarConstraint.constrain(rawPoint, reference, polarIncrementDegrees)
    constrained = polar.point
    if (polar.tracked) {polarTracked=true;polarAngle=polar.angle;polarGuide = Object.freeze({ reference: Object.freeze({ ...reference }), angle: polar.angle })}
  }
  const resolved=resolvePointerSnap(constrained, { ...options, referencePoint: reference, bypass: false }),relationships=[]
  const epsilon=1e-9*Math.max(1,Math.abs(resolved.point.x),Math.abs(resolved.point.y),Math.abs(reference?.x||0),Math.abs(reference?.y||0))
  if(orthoActive&&(Math.abs(resolved.point.x-reference.x)<=epsilon||Math.abs(resolved.point.y-reference.y)<=epsilon))relationships.push("ortho")
  if(polarTracked){const angle=Math.atan2(resolved.point.y-reference.y,resolved.point.x-reference.x),delta=Math.atan2(Math.sin(angle-polarAngle),Math.cos(angle-polarAngle));if(Math.abs(delta)<=1e-9)relationships.push("polar")}
  const trackingState=objectSnapTracking.getState()
  if(resolved.tracking){relationships.push("tracking");if(trackingState.activeGuides.some(guide=>guide.kind==="polar"))relationships.push("polar")}
  if((resolved.kinds||[]).includes("perpendicular")||resolved.kind==="perpendicular")relationships.push("perpendicular")
  if((resolved.kinds||[]).includes("tangent")||resolved.kind==="tangent")relationships.push("tangent")
  activeSnapResult=Object.freeze({...resolved,relationships:Object.freeze([...new Set(relationships)])})
  return activeSnapResult
}

function clearSnap() { activeSnapResult = null; polarGuide = null; interactionVisuals.setSnapAcquired(false) }

function resolvePointerSnap(point, { excludedFeatureIds = [], excludedRecordIds = [], transientCandidates = [], referencePoint = null, bypass = false } = {}) {
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
    records: visibleRecords(),
    transientCandidates,
    gridSpacing: sceneBuilder.getAdaptiveGridSpacing(),
    enabled: snapModes,
    referencePoint,
    excludedFeatureIds,
    excludedRecordIds,
  })
  const semanticObjectSnapsEnabled = snapModes.object !== false
  const direct = semanticObjectSnapsEnabled ? activeSnapResult.objectSnap : null
  if (objectSnapTrackingEnabled && semanticObjectSnapsEnabled) objectSnapTracking.observeSnap(direct ? { snapped:true, ...direct } : activeSnapResult)
  else objectSnapTracking.clear()
  if (direct) activeSnapResult = Object.freeze({ ...activeSnapResult, kind:direct.kind, kinds:direct.kinds, point:direct.point, distancePx:direct.distancePx, reference:direct.reference, references:direct.references, tracking:false })
  else {
    const tracked = objectSnapTrackingEnabled && semanticObjectSnapsEnabled ? objectSnapTracking.project(point, worldToScreen, {
      polarEnabled: effectivePolar(),
      polarIncrementDegrees,
      polarToleranceDegrees: window.CaderactPolarConstraint.ACQUISITION_TOLERANCE_DEGREES,
    }).candidate : null
    if (tracked) activeSnapResult = Object.freeze({ ...activeSnapResult, snapped:true, kind:"tracking", point:tracked, distancePx:0, reference:null, tracking:true })
  }
  return activeSnapResult
}

function resetForDocumentReplacement() {
  objectSnapTracking.clear()
  dynamicInput.clear()
  selectionBox.clear()
  cancelGripEdit()
  interactionVisuals.leave()
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
    selection.pruneAgainstDocument(editableRecords())
    objectSnapTracking.reconcileReferences(reference=>{const ids=reference?.recordIds||[reference?.recordId];return ids.length>0&&ids.every(id=>typeof id==="string"&&modelReader.isRecordVisible(id))})
    grips.reconcile()
    if (!grips.isActive) releaseGripPointerCapture(capturedPointerId)
  })
}
selection.subscribe(requestRender)
bindSelectionDocument()

function setCommandActive(active) {
  if (!active) objectSnapTracking.clear()
  if (!active) dynamicInput.clear()
  if (active) cancelGripEdit()
  interactionVisuals.setMode(active && !getActiveCommandSession()?.isSelectionPhase ? "point" : "select")
}
function getInteractionVisualState() { return interactionVisuals.snapshot() }
function selectAllCommittedGeometry() {
  if (selectionBox.isPending || grips.isActive || getActiveCommandSession()) return Object.freeze({ status: "selection-busy" })
  const selectableTypes = new Set(["line", "circle", "arc", "ellipse", "polyline"])
  return selection.applyRecordIds(editableRecords().filter(record => selectableTypes.has(record.type)).map(record => record.id))
}
function isLayerAssignmentBusy(){return Boolean(getActiveCommandSession()||grips.isActive||selectionBox.isPending)}
function prepareContextSelection(screenPoint){
  if(isLayerAssignmentBusy())return Object.freeze({type:"suppressed"})
  const editableHit=window.CaderactSelection.hitTestRecords({screenPoint,records:editableRecords(),worldToScreen})
  if(editableHit.hit){if(!selection.has(editableHit.recordId))selection.selectOnly(editableHit.recordId);return Object.freeze({type:"selection",recordId:editableHit.recordId,selectedIds:selection.selectedIds()})}
  const visibleHit=window.CaderactSelection.hitTestRecords({screenPoint,records:visibleRecords(),worldToScreen})
  return Object.freeze({type:"canvas",lockedRecordId:visibleHit.hit?visibleHit.recordId:null,selectedIds:selection.selectedIds()})
}
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

window.caderactViewport = { createLineCommandSession, createMoveCommandSession, createCopyCommandSession, createRotateCommandSession, createMirrorCommandSession, createScaleCommandSession, createDeleteCommandSession, createTrimCommandSession, createExtendCommandSession, createOffsetCommandSession, createCircleCommandSession, createArcCommandSession, createEllipseCommandSession, createPolygonCommandSession, createRectangleCommandSession, createPolylineCommandSession, startLineCommand, finishActiveCommand, cancelActiveCommand, stepUndoActiveCommand, cancelGripEdit, selectAllCommittedGeometry, isLayerAssignmentBusy, prepareContextSelection, getRendererState, refreshDocumentView, resetForDocumentReplacement, setCommandActive, getInteractionVisualState, getDynamicInputState:()=>dynamicInput.getState(), setDynamicInputEnabled, cancelDynamicInputEdit, get dynamicInputEnabled(){return dynamicInputEnabled}, getObjectSnapTrackingState:()=>objectSnapTracking.getState(), setObjectSnapTrackingEnabled, subscribeObjectSnapTracking, setGridSnapEnabled, setObjectSnapMode, subscribeSnapModes, setOrthoEnabled, subscribeOrtho, subscribeEffectiveOrtho, setPolarEnabled, subscribePolar, subscribeEffectivePolar, setPolarIncrementDegrees, get orthoEnabled() { return orthoEnabled }, get objectSnapTrackingEnabled() { return objectSnapTrackingEnabled }, get polarEnabled() { return polarEnabled }, get polarIncrementDegrees() { return polarIncrementDegrees }, get effectiveOrtho() { return effectiveOrtho() }, get effectivePolar() { return effectivePolar() }, get snapModes() { return snapModes } }

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
  refreshDynamicInput()
  requestRender()
}

let lastKnownPointerScreen = null
let shiftHeld = false

function setShiftHeld(held) {
  const next = Boolean(held)
  if (shiftHeld === next) return false
  shiftHeld = next
  notifyEffectiveOrtho()
  notifyEffectivePolar()
  updateSnapAtPointer()
  return true
}

function getCommandSnapCandidates(session) {
  return session?.getSnapCandidates?.() || []
}

function hasCommandPointerPreview(session) {
  return session?.hasPointerPreview?.() || false
}

function updateSnapAtPointer() {
  if (!lastKnownPointerScreen) return
  const session = getActiveCommandSession()
  const worldPoint = screenToWorld(lastKnownPointerScreen.x, lastKnownPointerScreen.y)
  if (grips.isActive) {
    const snap = resolvePointerSnap(worldPoint, { excludedFeatureIds: [grips.active.grip.featureId] })
    interactionVisuals.setSnapAcquired(snap.snapped)
    grips.update(snap.point)
    requestRender()
    return
  }
  if (session?.handlePointerMove && hasCommandPointerPreview(session) && !navigation.isActive()) {
    const snap = resolveCommandPointer(worldPoint, session, { transientCandidates: getCommandSnapCandidates(session), excludedRecordIds:session.getExcludedSnapRecordIds?.()||[] })
    interactionVisuals.setSnapAcquired(snap.snapped)
    session.handlePointerMove(snap.point)
    refreshDynamicInput()
    requestRender()
  }
}

function onViewportPointerDown(event) {
  const session = getActiveCommandSession()
  if (event.button !== 0 || navigation.isActive() || selectionBox.isPending) return
  const point = getCanvasPoint(event)
  lastKnownPointerScreen = point
  setShiftHeld(event.shiftKey)
  if (session?.handlePointerDown && !session.isSelectionPhase) {
    const snap = resolveCommandPointer(screenToWorld(point.x, point.y), session, {
      transientCandidates: getCommandSnapCandidates(session),
      excludedRecordIds: session.getExcludedSnapRecordIds?.() || [],
    })
    window.caderactCommandRouter.submitActivePointer(snap.point, { snap, rawPoint: screenToWorld(point.x, point.y) })
    refreshDynamicInput()
    return
  }
  if (!session) {
    const gripOutcome = grips.begin(point, event.pointerId)
    if (gripOutcome.status === "grip-edit-started") {
      canvas.setPointerCapture?.(event.pointerId)
      clearSnap()
      return
    }
  }
  const selectionRecords=session?.isSelectionPhase&&(session.name==="Trim"||session.name==="Extend")?visibleRecords():editableRecords()
  const hit = window.CaderactSelection.hitTestRecords({screenPoint:point,records:selectionRecords,worldToScreen})
  const toggle = (event.ctrlKey || event.metaKey) && !(event.ctrlKey && event.metaKey)
  if (hit.hit) toggle ? selection.toggle(hit.recordId) : selection.selectOnly(hit.recordId)
  else {
    selectionBox.begin(point,event.pointerId,toggle)
    canvas.setPointerCapture?.(event.pointerId)
  }
}

function onCommandPointerMove(event) {
  const point = getCanvasPoint(event)
  lastKnownPointerScreen = point
  setShiftHeld(event.shiftKey)
  interactionVisuals.setMode(getActiveCommandSession() && !getActiveCommandSession()?.isSelectionPhase ? "point" : "select")
  interactionVisuals.move(getViewportPoint(event))
  if(selectionBox.isPending){selectionBox.update(point);requestRender();return}
  const session = getActiveCommandSession()
  if (grips.isActive) {
    const snap = resolvePointerSnap(screenToWorld(point.x, point.y), {
      excludedFeatureIds: [grips.active.grip.featureId],
    })
    interactionVisuals.setSnapAcquired(snap.snapped)
    grips.update(snap.point)
    return
  }
  if (!session) grips.updateHover(point)
  if (!session?.handlePointerMove || !hasCommandPointerPreview(session) || navigation.isActive()) return
  const snap = resolveCommandPointer(screenToWorld(point.x, point.y), session, {
    transientCandidates: getCommandSnapCandidates(session),
    excludedRecordIds: session.getExcludedSnapRecordIds?.() || [],
  })
  interactionVisuals.setSnapAcquired(snap.snapped)
  session.handlePointerMove(snap.point, { rawPoint: screenToWorld(point.x, point.y) })
  refreshDynamicInput()
}

function onViewportPointerEnter(event) {
  interactionVisuals.setMode(getActiveCommandSession() && !getActiveCommandSession()?.isSelectionPhase ? "point" : "select")
  interactionVisuals.move(getViewportPoint(event))
}

function onCommandPointerLeave() {
  objectSnapTracking.clearHover()
  dynamicInput.clear()
  interactionVisuals.leave()
  clearSnap()
  lastKnownPointerScreen = null
  if (grips.isActive) cancelGripEdit()
  else grips.updateHover({ x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY })
  getActiveCommandSession()?.handlePointerLeave?.()
}

function onViewportPointerUp(event) {
  if(selectionBox.isPending&&selectionBox.snapshot().pointerId===event.pointerId){
    const box=selectionBox.update(getCanvasPoint(event))
    if(box.active){const session=getActiveCommandSession(),selectionRecords=session?.isSelectionPhase&&(session.name==="Trim"||session.name==="Extend")?visibleRecords():editableRecords(),outcome=window.CaderactSelectionBox.query({start:box.start,current:box.current,records:selectionRecords,worldToScreen})
      selection.applyRecordIds(outcome.recordIds,{toggle:box.modifier})
    }else if(!box.modifier)selection.clear()
    selectionBox.clear();releaseGripPointerCapture(event.pointerId);requestRender();return
  }
  if (!grips.isActive || grips.active.pointerId !== event.pointerId) return
  const point = getCanvasPoint(event)
  lastKnownPointerScreen = point
  const snap = resolvePointerSnap(screenToWorld(point.x, point.y), {
    excludedFeatureIds: [grips.active.grip.featureId],
  })
  grips.update(snap.point)
  grips.finish()
  clearSnap()
  releaseGripPointerCapture(event.pointerId)
}

function onViewportPointerCancel(event) {
  dynamicInput.clear()
  getActiveCommandSession()?.handlePointerLeave?.()
  if(selectionBox.isPending&&selectionBox.snapshot().pointerId===event.pointerId){selectionBox.clear();releaseGripPointerCapture(event.pointerId);requestRender();return}
  if (!grips.isActive || grips.active.pointerId !== event.pointerId) return
  grips.cancel(); clearSnap(); releaseGripPointerCapture(event.pointerId)
}

function onDocumentKeyDown(event) {
  if(event.key==="Escape"&&selectionBox.isPending){const pointerId=selectionBox.snapshot().pointerId;selectionBox.clear();releaseGripPointerCapture(pointerId);requestRender();event.caderactSelectionBoxHandled=true;event.preventDefault();return}
  const commandInput=document.querySelector("#command-input"),commandBarOwns=event.target===commandInput||document.activeElement===commandInput
  if(commandBarOwns){cancelDynamicInputEdit();return}
  if(!event.ctrlKey&&!event.altKey&&!event.metaKey){
    if(dynamicInput.getState().editing){
      if(event.key==="Escape"){cancelDynamicInputEdit();event.caderactDynamicInputHandled=true;event.preventDefault();return}
      if(event.key==="Enter"){submitDynamicInputEdit();event.caderactDynamicInputHandled=true;event.preventDefault();return}
      if(event.key==="Tab"&&dynamicInput.cycle(event.shiftKey)){event.caderactDynamicInputHandled=true;event.preventDefault();return}
      if(event.key==="Backspace"){dynamicInput.backspace();event.caderactDynamicInputHandled=true;event.preventDefault();return}
      if(/^[0-9.@,+<\-]$/.test(event.key)){dynamicInput.append(event.key);event.caderactDynamicInputHandled=true;event.preventDefault();return}
    }else if(/^[0-9.@,+<\-]$/.test(event.key)&&dynamicInput.beginEdit(event.key)){event.caderactDynamicInputHandled=true;event.preventDefault();return}
  }
  if (event.key === "Shift") setShiftHeld(true)
}

function onDocumentKeyUp(event) {
  if (event.key === "Shift") setShiftHeld(false)
}

document.addEventListener("keydown", onDocumentKeyDown)
document.addEventListener("keyup", onDocumentKeyUp)
window.addEventListener("blur", () => { setShiftHeld(false); objectSnapTracking.clearHover() })
document.addEventListener("visibilitychange", () => { if (document.hidden) { setShiftHeld(false); objectSnapTracking.clearHover() } })

function bindCanvas(nextCanvas) {
  navigation?.dispose()
  resizeObserver?.disconnect()
  canvas = nextCanvas
  navigation = window.CaderactViewportNavigation.bindViewportNavigation({
    canvas, camera: viewportCamera, viewportSettings, getCanvasPoint, requestRender,
    onStateChange: state => { const active=state.navigationMode!==null||state.isSpacePressed;interactionVisuals.setNavigating(active);if(active)dynamicInput.clear() },
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
  selectionBox.clear()
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
  selectionBox.clear()
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
