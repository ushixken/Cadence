// U3: browser file workflows around the existing A8 persistence contract.
(() => {
  const result = (status, details = {}) => Object.freeze({ status, ...details })
  const DEFAULT_FILENAME = "Untitled.caderact"

  function normalizeFilename(name) {
    const base = typeof name === "string" && name.trim() ? name.trim() : DEFAULT_FILENAME
    return base.toLowerCase().endsWith(".caderact") ? base : `${base}.caderact`
  }
  function browserAdapters() {
    return {
      confirmDiscard: () => window.confirm("Discard unsaved changes?"),
      async pickOpenFile() {
        return new Promise(resolve => {
          const input = document.createElement("input")
          input.type = "file"
          input.accept = ".caderact,application/json"
          input.addEventListener("change", () => resolve(input.files?.[0] || null), { once: true })
          input.addEventListener("cancel", () => resolve(null), { once: true })
          input.click()
        })
      },
      async writeFile({ serialized, filename }) {
        const blob = new Blob([serialized], { type: "application/json" })
        const url = URL.createObjectURL(blob)
        try {
          const anchor = document.createElement("a")
          anchor.href = url; anchor.download = filename; anchor.click()
        } finally { URL.revokeObjectURL(url) }
      },
    }
  }

  function createActions({ session, commandRouter, viewport, persistence = window.CaderactPersistence, adapters = browserAdapters() }) {
    let filename = DEFAULT_FILENAME
    let lastResult = result("file-idle")
    const publish = outcome => { lastResult = outcome; window.caderactFeedback?.presentResult(outcome); return outcome }
    const activeBlocked = operation => commandRouter.isActive
      ? publish(result(`${operation}-blocked-active-command`, { command: commandRouter.activeCommand })) : null
    async function confirmReplacement(operation) {
      if (!session.controller.isDirty) return null
      let confirmed
      try { confirmed = await adapters.confirmDiscard(operation) }
      catch (error) { return publish(result(`${operation}-failed`, { reason: "confirmation-failed", message: error.message })) }
      return confirmed ? null : publish(result(`${operation}-cancelled`, { reason: "unsaved-changes" }))
    }
    async function save() {
      let captured
      try { captured = persistence.captureSave(session.reader, session.controller) }
      catch (error) { return publish(result("save-failed", { reason: "serialization-failed", message: error.message })) }
      const targetName = normalizeFilename(filename)
      try { await adapters.writeFile({ serialized: captured.serialized, filename: targetName }) }
      catch (error) { return publish(result("save-failed", { reason: "write-failed", message: error.message })) }
      const acknowledgement = captured.acknowledge()
      filename = targetName
      return publish(result("save-completed", {
        filename, serialized: captured.serialized, stateId: captured.stateId,
        revision: captured.revision, acknowledgement,
      }))
    }
    async function open() {
      const blocked = activeBlocked("open"); if (blocked) return blocked
      const guard = await confirmReplacement("open"); if (guard) return guard
      let file
      try { file = await adapters.pickOpenFile() }
      catch (error) { return publish(result("open-failed", { reason: "picker-failed", message: error.message })) }
      if (!file) return publish(result("open-cancelled", { reason: "picker-cancelled" }))
      let serialized, store
      try {
        serialized = typeof file.text === "function" ? await file.text() : file.serialized
        store = persistence.loadStore(serialized)
      } catch (error) { return publish(result("open-failed", { reason: "invalid-file", message: error.message })) }
      filename = normalizeFilename(file.name)
      session.replaceStore(store, { reason: "open" })
      viewport.resetForDocumentReplacement()
      return publish(result("open-completed", { filename, documentId: store.reader.snapshot().id }))
    }
    async function newProject() {
      const blocked = activeBlocked("new"); if (blocked) return blocked
      const guard = await confirmReplacement("new"); if (guard) return guard
      let store
      try { store = window.CaderactDocument.createStore({ initiallySaved: true }) }
      catch (error) { return publish(result("new-failed", { message: error.message })) }
      filename = DEFAULT_FILENAME
      session.replaceStore(store, { reason: "new" })
      viewport.resetForDocumentReplacement()
      return publish(result("new-completed", { filename, documentId: store.reader.snapshot().id }))
    }
    return Object.freeze({ save, open, newProject, get filename() { return filename }, get lastResult() { return lastResult } })
  }

  window.CaderactFileActions = Object.freeze({ createActions, DEFAULT_FILENAME, normalizeFilename })

  const newButton = document.querySelector("#file-new")
  const openButton = document.querySelector("#file-open")
  const saveButton = document.querySelector("#file-save")
  const fileMenu = document.querySelector(".file-menu")
  const fileMenuTrigger = document.querySelector(".file-menu-trigger")
  const fileMenuDropdown = document.querySelector("#file-menu-actions")
  if (!newButton || !openButton || !saveButton || !fileMenu || !fileMenuTrigger || !fileMenuDropdown || !window.caderactDocumentSession) return
  const actions = createActions({
    session: window.caderactDocumentSession,
    commandRouter: window.caderactCommandRouter,
    viewport: window.caderactViewport,
  })
  window.caderactFiles = actions
  function setFileMenuOpen(open) {
    fileMenu.classList.toggle("is-open", open)
    fileMenuDropdown.hidden = !open
    fileMenuTrigger.setAttribute("aria-expanded", String(open))
  }
  function closeFileMenu() { setFileMenuOpen(false) }
  fileMenuTrigger.addEventListener("click", () => setFileMenuOpen(fileMenuDropdown.hidden))
  for (const trigger of document.querySelectorAll(".menu-items > li > button")) {
    if (trigger !== fileMenuTrigger) trigger.addEventListener("click", closeFileMenu)
  }
  newButton.addEventListener("click", () => { closeFileMenu(); actions.newProject() })
  openButton.addEventListener("click", () => { closeFileMenu(); actions.open() })
  saveButton.addEventListener("click", () => { closeFileMenu(); actions.save() })
  document.addEventListener("click", event => { if (!fileMenu.contains(event.target)) closeFileMenu() })
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !fileMenuDropdown.hidden) {
      closeFileMenu()
      event.preventDefault()
      return
    }
    const primary = (event.ctrlKey || event.metaKey) && !(event.ctrlKey && event.metaKey)
    if (!primary || event.shiftKey || event.altKey || isTypingInAnotherField(event.target) || event.target === commandInput) return
    const key = event.key.toLowerCase()
    let operation
    if (key === "s") operation = actions.save()
    else if (key === "o") operation = actions.open()
    else if (key === "n") operation = actions.newProject()
    else return
    event.preventDefault()
    return operation
  })
})()
