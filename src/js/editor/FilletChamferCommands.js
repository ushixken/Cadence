// DC1 command sessions. Geometry stays in CornerModificationPlanner and all
// persistent writes go through the injected document gateway.
(() => {
  let currentFilletRadius = 0
  let currentChamferDistances = Object.freeze([1, 1])
  const prompt = (commandName, instruction) => Object.freeze({ commandName, instruction, text: `${commandName}: ${instruction}` })
  const point = value => Object.freeze({ x: value.x, y: value.y })

  function createCornerSession({ name, planner, reader, recordGateway, hitTestEditableLine, requestRender, clearSnap, activation }) {
    const isFillet = name === "Fillet"
    let radius = currentFilletRadius
    let distances = currentChamferDistances
    let first = null, firstPick = null, pendingPlan = null
    let phase = "first", resumePhase = "first"
    let presentation = prompt(name, "Select first Line")
    const updatePrompt = instruction => { presentation = prompt(name, instruction); activation.setPrompt?.(presentation.text, presentation) }
    const currentRecords = () => new Map(reader.records().map(record => [record.id, record]))
    const optionLabel = () => isFillet ? `Radius <${radius}>` : `Distances <${distances[0]}, ${distances[1]}>`
    const selectionInstruction = () => phase === "second" ? `Select second Line or choose ${optionLabel()}` : `Select first Line or choose ${optionLabel()}`
    const clearPreview = () => { pendingPlan = null; requestRender() }

    function planWith(second, secondPick) {
      const records = currentRecords(), liveFirst = records.get(first?.id), liveSecond = records.get(second?.id)
      if (!liveFirst || !liveSecond || !reader.isRecordEditable(liveFirst.id) || !reader.isRecordEditable(liveSecond.id)) return Object.freeze({ status: "invalid", reason: "record-unavailable" })
      const input = { first: liveFirst, firstPick, second: liveSecond, secondPick }
      return isFillet ? planner.plan({ ...input, radius }) : planner.plan({ ...input, firstDistance: distances[0], secondDistance: distances[1] })
    }

    function previewRecord(geometry, source, id) {
      return Object.freeze({ id, ...geometry, layerId: source.layerId, ...window.CaderactObjectProperties.recordProperties(source) })
    }

    function getMovePreview() {
      if (pendingPlan?.status !== "planned") return null
      const recordsById = currentRecords(), records = []
      for (const replacement of pendingPlan.replacements) {
        const source = recordsById.get(replacement.recordId)
        if (source) records.push(previewRecord(replacement.geometry, source, source.id))
      }
      if (pendingPlan.createdGeometry) {
        const source = recordsById.get(pendingPlan.replacements[0].recordId)
        if (source) records.push(previewRecord(pendingPlan.createdGeometry, source, null))
      }
      return Object.freeze({ mode: name.toLowerCase(), preserveSourceVisible: false,
        recordIds: Object.freeze(pendingPlan.replacements.map(value => value.recordId)), records: Object.freeze(records), sourceRecords: Object.freeze([]) })
    }

    function failureMessage(reason) {
      const messages = {
        "same-line": "Select a different second Line.", "parallel-lines": "Parallel Lines cannot form this corner.",
        "impossible-radius": "The radius is too large for the selected Line portions.", "distance-exceeds-line": "The distance is too large for the selected Line portion.",
        "degenerate-result": "The values would create degenerate geometry.", "record-unavailable": "A selected Line is no longer editable.",
      }
      return messages[reason] || "The selected Lines cannot form this corner."
    }

    function handlePointerDown(value) {
      if (phase === "value") return Object.freeze({ status: "invalid-input", reason: "value-required", command: name, message: isFillet ? "Enter a non-negative radius." : "Enter one or two non-negative distances." })
      const picked = hitTestEditableLine(value)
      if (!picked) return Object.freeze({ status: "input-accepted", command: name, kind: "target-miss" })
      if (phase === "first") {
        first = picked; firstPick = point(value); phase = "second"; pendingPlan = null
        updatePrompt(selectionInstruction()); requestRender()
        return Object.freeze({ status: "input-accepted", command: name, kind: "first-line", recordId: picked.id })
      }
      const plan = planWith(picked, point(value))
      if (plan.status !== "planned") { pendingPlan = null; requestRender(); return Object.freeze({ status: "invalid-input", reason: plan.reason, command: name, message: failureMessage(plan.reason), plan }) }
      pendingPlan = plan
      const outcome = recordGateway.publishCornerPlan(plan)
      if (outcome.status !== "committed") { requestRender(); return Object.freeze({ status: "invalid-input", reason: outcome.status, command: name, message: "Unable to publish; selected Lines are preserved.", outcome }) }
      pendingPlan = null; first = null; firstPick = null; clearSnap(); requestRender()
      return Object.freeze({ status: "command-completed", command: name, outcome, plan })
    }

    function handlePointerMove(value) {
      if (phase !== "second") return
      const picked = hitTestEditableLine(value)
      pendingPlan = picked ? planWith(picked, point(value)) : null
      if (pendingPlan?.status !== "planned") pendingPlan = null
      requestRender()
    }

    function editValue() {
      resumePhase = first ? "second" : "first"; phase = "value"; pendingPlan = null
      updatePrompt(isFillet ? `Enter radius <${radius}>` : `Enter first and second distances <${distances[0]}, ${distances[1]}>`)
      requestRender()
      return Object.freeze({ status: "option-updated", command: name, optionId: isFillet ? "radius" : "distance" })
    }

    function parseDistance(value) {
      const parsed = window.CaderactPrecisionInput.parseScalar(value, reader.units().length)
      return parsed.status === "precision-parsed" && Number.isFinite(parsed.value) && parsed.value >= 0 ? parsed.value : null
    }

    function handleInput(input) {
      const text = String(input ?? "").trim()
      if (phase !== "value") {
        const option = text.toLowerCase()
        if ((isFillet && (option === "r" || option === "radius")) || (!isFillet && (option === "d" || option === "distance" || option === "distances"))) return editValue()
        return Object.freeze({ status: "invalid-input", reason: "object-required", command: name, message: `Select a Line or type ${isFillet ? "Radius" : "Distance"}.` })
      }
      if (isFillet) {
        const value = text === "" ? radius : parseDistance(text)
        if (value === null) return Object.freeze({ status: "invalid-input", reason: "invalid-radius", command: name, message: "Radius must be a non-negative finite distance." })
        radius = value; currentFilletRadius = value
      } else {
        let values
        if (text === "") values = distances
        else {
          const tokens = text.split(",").map(value => value.trim())
          if (tokens.length < 1 || tokens.length > 2 || tokens.some(value => value === "")) values = null
          else {
            const parsed = tokens.map(parseDistance)
            values = parsed.some(value => value === null) ? null : Object.freeze(tokens.length === 1 ? [parsed[0], parsed[0]] : parsed)
          }
        }
        if (!values) return Object.freeze({ status: "invalid-input", reason: "invalid-distance", command: name, message: "Enter one distance or two non-negative distances separated by a comma." })
        distances = values; currentChamferDistances = values
      }
      phase = resumePhase; updatePrompt(selectionInstruction()); requestRender()
      return Object.freeze({ status: "input-accepted", command: name, kind: "value", value: isFillet ? radius : distances })
    }

    function handleOption(optionId) {
      const expected = isFillet ? "radius" : "distance"
      return optionId === expected ? editValue() : Object.freeze({ status: "option-unavailable", reason: "unknown-option", command: name, optionId })
    }
    function cancel() { first = null; firstPick = null; pendingPlan = null; clearSnap(); requestRender(); return Object.freeze({ status: "command-cancelled", command: name }) }
    function finish() { return Object.freeze({ status: "invalid-input", reason: phase === "value" ? "value-required" : "object-required", command: name, message: phase === "value" ? "Enter the requested value." : "Select two Lines." }) }

    requestRender()
    return Object.freeze({ name, finish, cancel, handlePointerDown, handlePointerMove, handlePointerLeave: clearPreview, handleInput, handleOption,
      getMovePreview, usesResolvedPoint: false, hasPointerPreview: () => phase === "second", get acceptsEmptyInput() { return phase === "value" },
      get options() { return Object.freeze([Object.freeze({ id: isFillet ? "radius" : "distance", label: isFillet ? "Radius" : "Distance", value: isFillet ? String(radius) : `${distances[0]},${distances[1]}`, enabled: true })]) },
      get phase() { return phase }, get firstRecordId() { return first?.id ?? null }, get prompt() { return presentation.text }, get promptPresentation() { return presentation } })
  }

  const registrations = Object.freeze([
    Object.freeze({ name: "Fillet", aliases: Object.freeze(["F"]), planner: Object.freeze({ plan: window.CaderactCornerModificationPlanner.planFillet }), createSession: services => createCornerSession({ ...services, name: "Fillet" }) }),
    Object.freeze({ name: "Chamfer", aliases: Object.freeze(["CHA"]), planner: Object.freeze({ plan: window.CaderactCornerModificationPlanner.planChamfer }), createSession: services => createCornerSession({ ...services, name: "Chamfer" }) }),
  ])
  window.CaderactFilletChamferCommands = Object.freeze({ registrations, createCornerSession })
})()
