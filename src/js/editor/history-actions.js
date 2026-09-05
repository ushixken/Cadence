// U2: route document history UI/shortcuts without bypassing active commands.
const undoButton = document.querySelector("#undo-button")
const redoButton = document.querySelector("#redo-button")

const historyActions = (() => {
  let lastResult = Object.freeze({ status: "undo-unavailable" })
  let historyUnsubscribe = null
  const result = (status, details = {}) => Object.freeze({ status, ...details })

  const controller = () => window.caderactDocumentSession?.controller || documentController

  function refresh() {
    const blocked = commandRouter.isActive
    undoButton.disabled = blocked || !controller().canUndo
    redoButton.disabled = blocked || !controller().canRedo
    undoButton.setAttribute("aria-disabled", String(undoButton.disabled))
    redoButton.setAttribute("aria-disabled", String(redoButton.disabled))
  }
  function publish(outcome) { lastResult = outcome; window.caderactFeedback?.presentResult(outcome); refresh(); return outcome }
  function redraw(outcome) {
    if (outcome.status === "undone" || outcome.status === "redone") window.caderactViewport.refreshDocumentView()
  }
  function undo() {
    if (commandRouter.isActive) {
      const session = commandRouter.activeSession
      if (typeof session.stepUndo !== "function") return publish(result("undo-blocked-active-command", { command: session.name }))
      const outcome = session.stepUndo()
      return publish(outcome.status === "step-undone"
        ? result("undo-completed", { scope: "command", command: session.name, outcome })
        : result("undo-unavailable", { scope: "command", command: session.name, outcome }))
    }
    const outcome = controller().undo()
    redraw(outcome)
    if (outcome.status === "undone") return publish(result("undo-completed", { scope: "document", outcome }))
    if (outcome.status === "no-undo") return publish(result("undo-unavailable", { scope: "document" }))
    return publish(result("undo-blocked", { scope: "document", outcome }))
  }
  function redo() {
    if (commandRouter.isActive) return publish(result("redo-blocked-active-command", { command: commandRouter.activeCommand }))
    const outcome = controller().redo()
    redraw(outcome)
    if (outcome.status === "redone") return publish(result("redo-completed", { scope: "document", outcome }))
    if (outcome.status === "no-redo") return publish(result("redo-unavailable", { scope: "document" }))
    return publish(result("redo-blocked", { scope: "document", outcome }))
  }

  function bindController() {
    historyUnsubscribe?.()
    historyUnsubscribe = controller().subscribeHistory(refresh)
    refresh()
  }
  bindController()
  window.caderactDocumentSession?.subscribe(bindController)
  commandRouter.subscribe(refresh)
  return Object.freeze({ undo, redo, refresh, get lastResult() { return lastResult } })
})()
window.caderactHistory = historyActions

undoButton.addEventListener("click", () => { if (!undoButton.disabled) historyActions.undo() })
redoButton.addEventListener("click", () => { if (!redoButton.disabled) historyActions.redo() })

document.addEventListener("keydown", event => {
  const key = event.key.toLowerCase()
  const primaryModifier = (event.ctrlKey || event.metaKey) && !(event.ctrlKey && event.metaKey)
  const undoShortcut = primaryModifier && key === "z" && !event.shiftKey
  const redoShortcut = primaryModifier && (key === "y" || (key === "z" && event.shiftKey))
  if (!undoShortcut && !redoShortcut) return
  if (isTypingInAnotherField(event.target) || event.target === commandInput) return

  const outcome = undoShortcut ? historyActions.undo() : historyActions.redo()
  const handled = outcome.status.endsWith("-completed") || outcome.status.includes("blocked-active-command") || outcome.scope === "command"
  if (handled) event.preventDefault()
})
