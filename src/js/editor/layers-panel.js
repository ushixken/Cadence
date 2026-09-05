// U6: authoritative A7 layer presentation and actions.
(() => {
  const list = document.querySelector("#layers-list")
  const createButton = document.querySelector("#layer-create")
  if (!list || !createButton || !window.caderactDocumentSession) return

  let unsubscribeHistory = null
  const result = (status, details = {}) => Object.freeze({ status, ...details })
  const session = window.caderactDocumentSession

  function feedbackFor(outcome) {
    const messages = {
      "invalid-layer-name": "Layer name cannot be empty",
      "duplicate-layer-name": "A layer with that name already exists",
      "default-layer-required": "The default layer cannot be deleted",
      "layer-in-use": "Layer cannot be deleted while objects use it",
      "unknown-layer": "Layer no longer exists",
      "validation-failed": "The current layer cannot be deleted",
    }
    const message = messages[outcome.status]
    if (message) window.caderactFeedback?.showTemporary(message, "error")
  }
  function guardActive() {
    if (!window.caderactCommandRouter.isActive) return null
    const outcome = result("layer-action-blocked-active-command", { command: window.caderactCommandRouter.activeCommand })
    window.caderactFeedback?.showTemporary("Finish or cancel the active command before changing layers", "error")
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
  function create(name = nextLayerName()) { return run(() => session.layerGateway.create(name)) }
  function rename(layerId, name) { return run(() => session.layerGateway.rename(layerId, name)) }
  function remove(layerId) { return run(() => session.layerGateway.remove(layerId)) }
  function setCurrent(layerId) { return run(() => session.layerGateway.setCurrent(layerId)) }

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
    const rows = session.reader.layers().map(layer => {
      const row = document.createElement("div")
      row.classList.add("layer-row"); row.setAttribute("role", "listitem"); row.dataset.layerId = layer.id
      if (layer.id === documentState.currentLayerId) { row.classList.add("is-current"); row.setAttribute("aria-current", "true") }
      const select = actionButton(layer.name, "layer-select", `Make ${layer.name} current`, () => setCurrent(layer.id))
      if (layer.id === documentState.currentLayerId) select.setAttribute("aria-pressed", "true")
      const badges = document.createElement("span"); badges.classList.add("layer-badges")
      if (layer.id === documentState.defaultLayerId) { const badge=document.createElement("span"); badge.textContent="Default"; badges.appendChild(badge) }
      const renameButton = actionButton("✎", "layer-rename", `Rename ${layer.name}`, () => {
        const proposed = window.prompt("Rename layer", layer.name)
        if (proposed !== null) rename(layer.id, proposed)
      })
      const deleteButton = actionButton("×", "layer-delete", `Delete ${layer.name}`, () => remove(layer.id))
      deleteButton.disabled = blocked || layer.id === documentState.defaultLayerId
      row.appendChild(select); row.appendChild(badges); row.appendChild(renameButton); row.appendChild(deleteButton)
      return row
    })
    list.replaceChildren(...rows)
  }
  function bindDocument() {
    unsubscribeHistory?.()
    unsubscribeHistory = session.controller.subscribeHistory(render)
  }

  createButton.addEventListener("click", () => create())
  session.subscribe(bindDocument)
  window.caderactCommandRouter.subscribe(render)
  bindDocument()
  window.caderactLayers = Object.freeze({ create, rename, remove, setCurrent, refresh: render })
})()
