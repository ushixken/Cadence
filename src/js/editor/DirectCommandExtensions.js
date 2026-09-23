// DC2 AF1 sessions for Join, Split, Break, and generic Explode dispatch.
(() => {
  const prompt = (commandName, instruction) => Object.freeze({ commandName, instruction, text: `${commandName}: ${instruction}` })
  const point = value => Object.freeze({ x: value.x, y: value.y })
  const findRecord = (reader, id) => reader.records().find(record => record.id === id) || null
  const explodePlanner = Object.freeze({ plan({ records } = {}) {
    if (!Array.isArray(records) || !records.length) return Object.freeze({ status: "invalid", reason: "empty-selection" })
    if (records.every(record => record?.type === "block-instance")) return Object.freeze({ status: "planned", delegate: "block-instances", recordIds: Object.freeze(records.map(record => record.id)) })
    return Object.freeze({ status: "invalid", reason: "unsupported-explode-entity" })
  } })

  function createJoinSession({ planner, reader, recordGateway, selection, requestRender, clearSnap, activation }) {
    let presentation = prompt("Join", "Select connected Lines or open Polylines, then press Enter")
    function finish() {
      const ids = selection.orderedIds(), byId = new Map(reader.editableRecords().map(record => [record.id, record])), records = ids.map(id => byId.get(id)).filter(Boolean)
      if (records.length !== ids.length) return Object.freeze({ status: "invalid-input", reason: "selection-not-editable", command: "Join", message: "Selection contains hidden, locked, grouped, or unavailable objects." })
      const plan = planner.plan({ records })
      if (plan.status !== "planned") return Object.freeze({ status: "invalid-input", reason: plan.reason, command: "Join", message: ({"insufficient-selection":"Select at least two objects.","non-collinear-lines":"Selected Lines must be collinear.","disconnected-gap":"Selected objects must connect within Join tolerance.","ambiguous-branch":"The selected objects form an ambiguous branch.","incompatible-properties":"Selected objects must share layer and properties."}[plan.reason] || "The selected objects cannot be joined."), plan })
      const outcome = recordGateway.publishJoinPlan(plan)
      if (outcome.status !== "committed") return Object.freeze({ status: "invalid-input", reason: outcome.status, command: "Join", message: "Unable to join; selection preserved.", outcome })
      selection.applyRecordIds([outcome.record.id]);clearSnap();requestRender()
      return Object.freeze({ status: "command-completed", command: "Join", outcome, plan })
    }
    function cancel(){clearSnap();requestRender();return Object.freeze({status:"command-cancelled",command:"Join"})}
    requestRender();return Object.freeze({name:"Join",finish,cancel,handlePointerLeave:()=>requestRender(),get isSelectionPhase(){return true},get prompt(){return presentation.text},get promptPresentation(){return presentation}})
  }

  function createSplitBreakSession({ name, planner, reader, recordGateway, hitTestEditableSplitTarget, resolveTypedPoint, requestRender, clearSnap, activation }) {
    const isBreak = name === "Break"
    let sourceId = null, firstPoint = null, pendingPlan = null, phase = "target"
    let presentation = prompt(name, "Select a Line" + (isBreak ? " to break" : " or open Polyline to split"))
    const update = instruction => { presentation = prompt(name, instruction);activation.setPrompt?.(presentation.text, presentation) }
    const source = () => findRecord(reader, sourceId)
    function planAt(candidate) {
      const record = source()
      if (!record || !reader.isRecordEditable(record.id)) return Object.freeze({ status:"invalid",reason:"record-unavailable" })
      return isBreak ? planner.plan({ record, firstPoint, secondPoint:candidate }) : planner.plan({ record, point:candidate })
    }
    function previewRecord(piece, id) {
      const record = source();return Object.freeze({id,...piece.geometry,layerId:record.layerId,...window.CaderactObjectProperties.recordProperties(record)})
    }
    function getMovePreview(){if(pendingPlan?.status!=="planned")return null;return Object.freeze({mode:name.toLowerCase(),preserveSourceVisible:false,recordIds:Object.freeze([sourceId]),sourceRecords:Object.freeze([]),records:Object.freeze([previewRecord(pendingPlan.replacement,sourceId),...pendingPlan.creates.map(piece=>previewRecord(piece,null))])})}
    function presentFailure(plan){return Object.freeze({status:"invalid-input",reason:plan.reason,command:name,message:({"point-off-entity":"Point must lie exactly on the selected object.","endpoint-split":"Choose an interior point, not an endpoint.","vertex-split":"Choose an interior segment point, not a Polyline vertex.","endpoint-break":"Both break points must be interior.","degenerate-break":"Break points must be distinct.","unsupported-break-geometry":"Two-point Break currently supports Lines only."}[plan.reason]||"The object cannot be modified at that point."),plan})}
    function commit(plan){pendingPlan=plan;const outcome=recordGateway.publishSplitBreakPlan(plan);if(outcome.status!=="committed"){requestRender();return Object.freeze({status:"invalid-input",reason:outcome.status,command:name,message:"Unable to publish; source geometry is preserved.",outcome})}pendingPlan=null;sourceId=null;firstPoint=null;clearSnap();requestRender();return Object.freeze({status:"command-completed",command:name,outcome,plan})}
    function acceptPoint(candidate){
      const accepted=point(candidate)
      if(isBreak&&phase==="first-point"){const record=source(),probe=window.CaderactSplitBreakPlanner.planSplit({record,point:accepted});if(probe.status!=="planned")return presentFailure(probe);firstPoint=accepted;phase="second-point";update("Specify second break point");requestRender();return Object.freeze({status:"input-accepted",command:name,kind:"first-break-point",point:accepted})}
      const plan=planAt(accepted);return plan.status==="planned"?commit(plan):presentFailure(plan)
    }
    function handlePointerDown(candidate,context={}){
      if(phase==="target"){
        const record=hitTestEditableSplitTarget(context.rawPoint||candidate)
        if(!record)return Object.freeze({status:"input-accepted",command:name,kind:"target-miss"})
        if(isBreak&&record.type!=="line")return presentFailure(Object.freeze({status:"invalid",reason:"unsupported-break-geometry"}))
        sourceId=record.id;phase=isBreak?"first-point":"point";update(isBreak?"Specify first break point":"Specify split point");requestRender();return Object.freeze({status:"input-accepted",command:name,kind:"target",recordId:record.id})
      }
      return acceptPoint(candidate)
    }
    function handlePointerMove(candidate){if(phase==="point"||phase==="second-point"){pendingPlan=planAt(candidate);if(pendingPlan.status!=="planned")pendingPlan=null;requestRender()}}
    function handleInput(input){if(phase==="target")return Object.freeze({status:"invalid-input",reason:"object-required",command:name,message:"Select an editable object."});const parsed=resolveTypedPoint(input,firstPoint);if(parsed.status!=="point-resolved")return Object.freeze({status:"invalid-input",reason:parsed.reason,command:name,message:"Enter a point as x,y."});return acceptPoint(parsed)}
    function cancel(){sourceId=null;firstPoint=null;pendingPlan=null;clearSnap();requestRender();return Object.freeze({status:"command-cancelled",command:name})}
    function finish(){return Object.freeze({status:"invalid-input",reason:"point-required",command:name,message:phase==="target"?"Select an editable object.":"Specify the required point."})}
    requestRender();return Object.freeze({name,finish,cancel,handlePointerDown,handlePointerMove,handlePointerLeave:()=>{pendingPlan=null;clearSnap();requestRender()},handleInput,getMovePreview,getOrthoReference:()=>firstPoint,
      get usesResolvedPoint(){return phase!=="target"},hasPointerPreview:()=>phase==="point"||phase==="second-point",get phase(){return phase},get sourceRecordId(){return sourceId},get prompt(){return presentation.text},get promptPresentation(){return presentation}})
  }

  function createExplodeSession({ planner, reader, recordGateway, selection, requestRender, clearSnap }) {
    const presentation=prompt("Explode","Select supported objects, then press Enter")
    function finish(){const ids=selection.orderedIds(),records=ids.map(id=>findRecord(reader,id)).filter(Boolean);if(records.length!==ids.length)return Object.freeze({status:"invalid-input",reason:"selection-not-editable",command:"Explode",message:"Selection contains unavailable objects."});const plan=planner.plan({records});if(plan.status!=="planned")return Object.freeze({status:"invalid-input",reason:plan.reason,command:"Explode",message:plan.reason==="empty-selection"?"Select at least one supported object.":"The selection has no defined Explode behavior."});let outcome;if(plan.delegate==="block-instances")outcome=recordGateway.explodeBlockInstances(plan.recordIds);else return Object.freeze({status:"invalid-input",reason:"unsupported-delegate",command:"Explode"});if(outcome.status!=="committed")return Object.freeze({status:"invalid-input",reason:outcome.status,command:"Explode",message:outcome.message||"Unable to explode; selection preserved.",outcome});selection.applyRecordIds(outcome.records.map(record=>record.id));clearSnap();requestRender();return Object.freeze({status:"command-completed",command:"Explode",outcome,recordIds:Object.freeze(outcome.records.map(record=>record.id))})}
    function cancel(){clearSnap();requestRender();return Object.freeze({status:"command-cancelled",command:"Explode"})}
    requestRender();return Object.freeze({name:"Explode",finish,cancel,handlePointerLeave:()=>requestRender(),get isSelectionPhase(){return true},get prompt(){return presentation.text},get promptPresentation(){return presentation}})
  }

  const registrations=Object.freeze([
    Object.freeze({name:"Join",aliases:Object.freeze(["J"]),planner:Object.freeze({plan:window.CaderactJoinPlanner.plan}),createSession:createJoinSession}),
    Object.freeze({name:"Split",aliases:Object.freeze(["SPL"]),planner:Object.freeze({plan:window.CaderactSplitBreakPlanner.planSplit}),createSession:services=>createSplitBreakSession({...services,name:"Split"})}),
    Object.freeze({name:"Break",aliases:Object.freeze(["BR"]),planner:Object.freeze({plan:window.CaderactSplitBreakPlanner.planBreak}),createSession:services=>createSplitBreakSession({...services,name:"Break"})}),
    Object.freeze({name:"Explode",aliases:Object.freeze(["X"]),planner:explodePlanner,createSession:createExplodeSession}),
  ])
  window.CaderactDirectCommandExtensions=Object.freeze({registrations,explodePlanner})
})()
