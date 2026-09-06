// U1: generic ownership of command activation, active sessions, and outcomes.
(() => {
  const result = (status, details = {}) => Object.freeze({ status, ...details })

  function createRouter({ registry, setPrompt }) {
    if (!registry || typeof registry.resolve !== "function" || typeof registry.matches !== "function") {
      throw new Error("Command router requires a registry")
    }
    let activeSession = null
    let lastRepeatableCommand = null
    let lastResult = result("invalid-input", { reason: "no-command" })
    const listeners = new Set()

    function publish(outcome) {
      lastResult = outcome
      for (const listener of listeners) {
        try { listener(outcome) } catch (error) { console.warn("Caderact command observer failed", error) }
      }
      return outcome
    }
    function subscribe(listener) {
      if (typeof listener !== "function") throw new Error("Command listener must be a function")
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
    function showSessionPrompt() {
      setPrompt(activeSession?.prompt || "Type a command...")
    }
    function acceptSessionOutcome(session, outcome) {
      if (outcome.status === "command-completed" && activeSession === session) {
        activeSession = null
        setPrompt("Type a command...")
      } else showSessionPrompt()
      return publish(outcome)
    }
    function activate(definition) {
      if (activeSession) return publish(result("command-active", { command: activeSession.name }))
      let session
      session = definition.activate({ setPrompt: message => {
        if (activeSession === session) setPrompt(message)
      } })
      if (!session || session.name !== definition.name || typeof session.finish !== "function" || typeof session.cancel !== "function") {
        return publish(result("invalid-input", { reason: "invalid-command-session", command: definition.name }))
      }
      activeSession = session
      if (definition.repeatable) lastRepeatableCommand = definition.name
      showSessionPrompt()
      return publish(result("command-started", { command: definition.name }))
    }
    function execute(input) {
      if (activeSession) return publish(result("command-active", { command: activeSession.name }))
      const entered = typeof input === "string" ? input.trim() : ""
      if (!entered) return publish(result("invalid-input", { reason: "empty-command" }))
      const exact = registry.resolve(entered)
      if (exact) return activate(exact)
      const matches = registry.matches(entered)
      if (matches.length === 1) return activate(matches[0])
      if (matches.length > 1) return publish(result("invalid-input", { reason: "ambiguous-command", input: entered }))
      return publish(result("unknown-command", { input: entered }))
    }
    function finishActive() {
      if (!activeSession) return publish(result("invalid-input", { reason: "no-active-command" }))
      const session = activeSession
      const outcome = session.finish()
      return acceptSessionOutcome(session, outcome)
    }
    function cancelActive() {
      if (!activeSession) return publish(result("invalid-input", { reason: "no-active-command" }))
      const session = activeSession
      const outcome = session.cancel()
      activeSession = null
      setPrompt("Type a command...")
      return publish(outcome.status === "command-cancelled" ? outcome : result("command-cancelled", { command: session.name }))
    }
    function submitActiveInput(input, context = {}) {
      if (!activeSession) return publish(result("invalid-input", { reason: "no-active-command" }))
      if (typeof activeSession.handleInput !== "function") {
        return publish(result("invalid-input", { reason: "command-does-not-accept-input", command: activeSession.name }))
      }
      const session = activeSession
      return acceptSessionOutcome(session, session.handleInput(input, context))
    }
    function submitActivePointer(point, context = {}) {
      if (!activeSession) return publish(result("invalid-input", { reason: "no-active-command" }))
      if (typeof activeSession.handlePointerDown !== "function") {
        return publish(result("invalid-input", { reason: "command-does-not-accept-pointer", command: activeSession.name }))
      }
      const session = activeSession
      return acceptSessionOutcome(session, session.handlePointerDown(point, context))
    }
    function repeatLastCommand() {
      if (activeSession) return publish(result("repeat-unavailable", { reason: "active-command", command: activeSession.name }))
      if (!lastRepeatableCommand) return publish(result("repeat-unavailable", { reason: "no-repeatable-command" }))
      const definition = registry.resolve(lastRepeatableCommand)
      if (!definition || !definition.repeatable) return publish(result("repeat-unavailable", { reason: "command-unavailable" }))
      return activate(definition)
    }

    return Object.freeze({
      execute, activate, finishActive, cancelActive, submitActiveInput, submitActivePointer, repeatLastCommand, subscribe,
      get activeSession() { return activeSession },
      get activeCommand() { return activeSession?.name || null },
      get currentPrompt() { return activeSession?.prompt || "Type a command..." },
      get lastResult() { return lastResult },
      get lastRepeatableCommand() { return lastRepeatableCommand },
      get isActive() { return activeSession !== null },
    })
  }

  window.CaderactCommandRouter = Object.freeze({ createRouter })
})()
