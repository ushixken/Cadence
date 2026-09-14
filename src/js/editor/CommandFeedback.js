// U5: transient command presentation; never document or command lifecycle state.
(() => {
  function createController({ setDisplay, setHistory, schedule = setTimeout, cancel = clearTimeout,
    feedbackDuration = 2000, historyDuration = 4000, historyLimit = 3 } = {}) {
    let activePrompt = "Type a command..."
    let activePromptPresentation = null
    let activeOptions = Object.freeze([])
    let feedbackTimer = null
    let nextEntryId = 1
    let history = []

    function renderPrompt(message = activePrompt, kind = "prompt", options = activeOptions, presentation = activePromptPresentation) { setDisplay?.(message, kind, options, presentation) }
    function renderHistory() { setHistory?.(Object.freeze(history.map(entry => Object.freeze({ ...entry })))) }
    function setActivePrompt(message, options = [], presentation = null) {
      activePrompt = message || "Type a command..."
      activePromptPresentation = presentation ? Object.freeze({ ...presentation }) : null
      activeOptions = Object.freeze(Array.from(options, option => Object.freeze({ ...option })))
      if (feedbackTimer === null) renderPrompt()
    }
    function showTemporary(message, kind = "status") {
      if (!message) return
      if (feedbackTimer !== null) cancel(feedbackTimer)
      let instruction = message
      const commandName = activePromptPresentation?.commandName
      if (commandName && instruction.startsWith(`${commandName}: `)) instruction = instruction.slice(commandName.length + 2)
      else if (commandName && instruction.startsWith(`${commandName} `)) instruction = instruction.slice(commandName.length + 1)
      const presentation = activePromptPresentation ? Object.freeze({ ...activePromptPresentation, instruction }) : null
      renderPrompt(message, kind, Object.freeze([]), presentation)
      feedbackTimer = schedule(() => { feedbackTimer = null; renderPrompt() }, feedbackDuration)
    }
    function addHistory(message, kind = "status") {
      if (!message) return null
      const entry = { id: nextEntryId++, message, kind }
      history = [...history, entry].slice(-historyLimit)
      renderHistory()
      entry.timer = schedule(() => {
        history = history.filter(candidate => candidate.id !== entry.id)
        renderHistory()
      }, historyDuration)
      return entry.id
    }
    function describe(outcome) {
      if (!outcome) return null
      const command = outcome.command || "Command"
      if (outcome.status === "command-started") return { history: command }
      if (outcome.status === "command-completed") return { history: outcome.formattedMeasurement?.summary || `${command} completed` }
      if (outcome.status === "command-cancelled") return { history: `${command} cancelled` }
      if (outcome.status === "unknown-command") return { temporary: `Unknown command: ${outcome.input}`, kind: "error", history: `Unknown command: ${outcome.input}` }
      if (outcome.status === "undo-completed") return { history: "Undo" }
      if (outcome.status === "redo-completed") return { history: "Redo" }
      if (outcome.status === "undo-unavailable") return { temporary: "Nothing to undo", kind: "status" }
      if (outcome.status === "redo-unavailable") return { temporary: "Nothing to redo", kind: "status" }
      if (outcome.status.includes("blocked-active-command")) return { temporary: `${command}: finish or cancel the active command first`, kind: "error" }
      if (outcome.status.endsWith("-completed")) return { history: outcome.status.replaceAll("-", " ") }
      if (outcome.status.endsWith("-failed")) return { temporary: outcome.message || outcome.status.replaceAll("-", " "), kind: "error", history: outcome.status.replaceAll("-", " ") }
      if (outcome.status === "invalid-input" && outcome.reason !== "empty-command") return { temporary: outcome.message || "Invalid command input", kind: "error" }
      return null
    }
    function presentResult(outcome) {
      const presentation = describe(outcome)
      if (!presentation) return outcome
      if (presentation.history) addHistory(presentation.history, presentation.kind)
      if (presentation.temporary) showTemporary(presentation.temporary, presentation.kind)
      return outcome
    }
    function clear() {
      if (feedbackTimer !== null) cancel(feedbackTimer)
      feedbackTimer = null
      for (const entry of history) if (entry.timer !== undefined) cancel(entry.timer)
      history = []; renderHistory(); renderPrompt()
    }
    renderPrompt(); renderHistory()
    return Object.freeze({ setActivePrompt, showTemporary, addHistory, presentResult, clear,
      get activePrompt() { return activePrompt }, get activePromptPresentation() { return activePromptPresentation }, get activeOptions() { return activeOptions }, get history() { return Object.freeze(history.map(({ timer, ...entry }) => Object.freeze(entry))) },
    })
  }
  window.CaderactCommandFeedback = Object.freeze({ createController })
})()
