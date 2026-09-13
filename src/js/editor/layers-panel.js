// U6: authoritative A7 layer presentation and actions.
(() => {
  const list = document.querySelector("#layers-list")
  const createButton = document.querySelector("#layer-create")
  const assignButton = document.querySelector("#layer-assign")
  if (!list || !createButton || !assignButton || !window.caderactDocumentSession) return

  let unsubscribeHistory = null
  let editingLayerId = null
  const result = (status, details = {}) => Object.freeze({ status, ...details })
  const session = window.caderactDocumentSession

  function feedbackFor(outcome) {
    const messages = {
      "invalid-layer-name": "Layer name cannot be empty",
      "duplicate-layer-name": "A layer with that name already exists",
      "default-layer-required": "The default layer cannot be deleted",
      "layer-in-use": "Layer is not empty.",
      "unknown-layer": "Layer no longer exists",
      "layer-unavailable": "Current layer must be visible and unlocked",
      "no-usable-current-layer": "Another visible, unlocked layer is required",
      "target-layer-hidden": "Target layer is hidden.",
      "target-layer-locked": "Target layer is locked.",
      "selection-not-editable": "Selection contains non-editable objects.",
      "empty-selection": "Select objects to assign to a layer.",
    }
    const message = messages[outcome.status]
    if (message) window.caderactFeedback?.showTemporary(message, "error")
  }
  function guardActive() {
    if (!window.caderactViewport?.isLayerAssignmentBusy?.()) return null
    const outcome = result("layer-action-blocked-active-command", { command: window.caderactCommandRouter.activeCommand })
    window.caderactFeedback?.showTemporary("Finish or cancel the active edit before changing layers", "error")
    return outcome
  }
  function run(action) {
    const blocked = guardActive(); if (blocked) return blocked
    const outcome = action()
    feedbackFor(outcome)
    return outcome
  }
  function nextLayerName() {
    const names = new Set(session.reader.layers().map(layer => layer.name.toLowerCase()))
    for (let index = 1; ; index++) if (!names.has(`layer ${index}`)) return `Layer ${index}`
  }
  function create(name = nextLayerName()) { return run(() => session.layerGateway.create(name, { makeCurrent: true })) }
  function rename(layerId, name) { return run(() => session.layerGateway.rename(layerId, name)) }
  function remove(layerId) { return run(() => session.layerGateway.remove(layerId)) }
  function setCurrent(layerId) { return run(() => session.layerGateway.setCurrent(layerId)) }
  function setVisibility(layerId, visible) { return run(() => session.layerGateway.setVisibility(layerId, visible)) }
  function setLocked(layerId, locked) { return run(() => session.layerGateway.setLocked(layerId, locked)) }
  function assign(layerId = session.reader.snapshot().currentLayerId) {
    const blocked=guardActive();if(blocked)return blocked
    const selectedIds=window.caderactSelection?.selectedIds?.()||[]
    const layer=session.reader.layer(layerId),outcome=session.recordGateway.assignLayer(selectedIds,layerId)
    if(outcome.status==="committed")window.caderactFeedback?.showTemporary(`Moved ${outcome.movedCount} object${outcome.movedCount===1?"":"s"} to ${layer.name}.`)
    else if(outcome.status==="no-op")window.caderactFeedback?.showTemporary(`Selection is already on ${layer.name}.`)
    else feedbackFor(outcome)
    return outcome
  }
  function beginRename(layerId){if(guardActive())return result("layer-action-blocked-active-command");if(!session.reader.layer(layerId))return result("unknown-layer",{layerId});editingLayerId=layerId;render();return result("rename-started",{layerId})}

  function actionButton(label, className, title, handler) {
    const button = document.createElement("button")
    button.type = "button"; button.classList.add(className); button.textContent = label
    button.setAttribute("aria-label", title); button.title = title
    button.disabled = window.caderactCommandRouter.isActive
    button.addEventListener("click", handler)
    return button
  }
  function render() {
    const documentState = session.reader.snapshot()
    const blocked = window.caderactCommandRouter.isActive
    createButton.disabled = blocked
    const currentLayer=session.reader.layer(documentState.currentLayerId),hasSelection=Boolean(window.caderactSelection?.selectedIds?.().length)
    assignButton.disabled=blocked||!hasSelection||!currentLayer?.visible||currentLayer?.locked
    let editInput = null
    const rows = session.reader.layers().map(layer => {
      const row = document.createElement("div")
      row.classList.add("layer-row"); row.setAttribute("role", "listitem"); row.dataset.layerId = layer.id
      if (layer.id === documentState.currentLayerId) { row.classList.add("is-current"); row.setAttribute("aria-current", "true") }
      if (!layer.visible) row.classList.add("is-hidden")
      if (layer.locked) row.classList.add("is-locked")
      const visibilityButton=actionButton(layer.visible?"●":"○","layer-visibility",layer.visible?`Hide ${layer.name}`:`Show ${layer.name}`,()=>setVisibility(layer.id,!layer.visible))
      visibilityButton.setAttribute("aria-pressed",String(layer.visible))
      const lockButton=actionButton(layer.locked?"■":"□","layer-lock",layer.locked?`Unlock ${layer.name}`:`Lock ${layer.name}`,()=>setLocked(layer.id,!layer.locked))
      lockButton.setAttribute("aria-pressed",String(layer.locked))
      let select
      if (editingLayerId === layer.id) {
        select = document.createElement("input"); select.type = "text"; select.value = layer.name; select.maxLength = 128
        select.classList.add("layer-name-input"); select.setAttribute("aria-label", `Rename ${layer.name}`)
        select.addEventListener("keydown", event => {
          if (event.key === "Escape") { event.preventDefault(); editingLayerId = null; render() }
          else if (event.key === "Enter") { event.preventDefault(); const outcome=rename(layer.id,select.value); if(outcome.status==="committed"||outcome.status==="no-op"){editingLayerId=null;render()} }
        })
        editInput = select
      } else {
        select = actionButton(layer.name, "layer-select", `Make ${layer.name} current`, () => setCurrent(layer.id))
        if (layer.id === documentState.currentLayerId) select.setAttribute("aria-pressed", "true")
      }
      const badges = document.createElement("span"); badges.classList.add("layer-badges")
      if (layer.id === documentState.defaultLayerId) { const badge=document.createElement("span"); badge.textContent="Default"; badges.appendChild(badge) }
      const renameButton = actionButton("✎", "layer-rename", `Rename ${layer.name}`, () => beginRename(layer.id))
      const deleteButton = actionButton("×", "layer-delete", `Delete ${layer.name}`, () => remove(layer.id))
      deleteButton.disabled = blocked || layer.id === documentState.defaultLayerId
      row.appendChild(visibilityButton);row.appendChild(lockButton);row.appendChild(select); row.appendChild(badges); row.appendChild(renameButton); row.appendChild(deleteButton)
      return row
    })
    list.replaceChildren(...rows)
    editInput?.focus()
  }
  function bindDocument() {
    unsubscribeHistory?.()
    unsubscribeHistory = session.controller.subscribeHistory(render)
  }

  createButton.addEventListener("click", () => create())
  assignButton.addEventListener("click", () => assign())
  session.subscribe(bindDocument)
  window.caderactCommandRouter.subscribe(render)
  window.caderactSelection?.subscribe(render)
  bindDocument()
  window.caderactLayers = Object.freeze({ create, rename, remove, setCurrent, setVisibility, setLocked, assign, beginRename, refresh: render })
})()
