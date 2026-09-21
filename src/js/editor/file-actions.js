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
      async pickDxfFile() {
        return new Promise(resolve => {
          const input = document.createElement("input")
          input.type = "file"
          input.accept = ".dxf,application/dxf,application/x-dxf"
          input.addEventListener("change", () => resolve(input.files?.[0] || null), { once: true })
          input.addEventListener("cancel", () => resolve(null), { once: true })
          input.click()
        })
      },
      async pickSaveFile({ suggestedName }) {
        if (typeof window.showSaveFilePicker !== "function") return Object.freeze({ status: "unsupported" })
        try {
          const handle = await window.showSaveFilePicker({ suggestedName, types: [{ description: "Caderact drawing", accept: { "application/json": [".caderact"] } }] })
          return Object.freeze({ status: "selected", handle, filename: normalizeFilename(handle?.name || suggestedName) })
        } catch (error) {
          if (error?.name === "AbortError") return Object.freeze({ status: "cancelled" })
          throw error
        }
      },
      async writeFile({ serialized, filename, mimeType = "application/json", fileHandle = null }) {
        if (fileHandle) {
          const writable = await fileHandle.createWritable()
          try { await writable.write(serialized); await writable.close() }
          catch (error) { try { await writable.abort?.() } catch {} throw error }
          return Object.freeze({ status: "committed" })
        }
        const blob = new Blob([serialized], { type: mimeType })
        const url = URL.createObjectURL(blob)
        try {
          const anchor = document.createElement("a")
          anchor.href = url; anchor.download = filename; anchor.click()
        } finally { URL.revokeObjectURL(url) }
        return Object.freeze({ status: "initiated" })
      },
    }
  }

  function createActions({ session, commandRouter, viewport, persistence = window.CaderactPersistence,
    dxfImporter = window.CaderactDxfImport, dxfExporter = window.CaderactDxfExport, adapters = browserAdapters(),
    fileState = window.CaderactDocumentFileState.create({ defaultFilename: DEFAULT_FILENAME }), recovery = null }) {
    let lastResult = result("file-idle")
    const publish = outcome => { lastResult = outcome; window.caderactFeedback?.presentResult(outcome); return outcome }
    const activeBlocked = operation => commandRouter.isActive
      ? publish(result(`${operation}-blocked-active-command`, { command: commandRouter.activeCommand })) : null
    async function confirmReplacement(operation) {
      const guarded = await fileState.guardReplacement({ controller: session.controller, operation, confirmDiscard: adapters.confirmDiscard })
      if (guarded.status === "replacement-allowed") return null
      return publish(result(guarded.status === "replacement-cancelled" ? `${operation}-cancelled` : `${operation}-failed`, { reason: guarded.reason, message: guarded.message }))
    }
    function normalizeOutput(value) {
      if (value === undefined) return Object.freeze({ status: "committed" }) // Legacy/injected adapters completed when their promise resolves.
      if (["committed", "initiated", "failed"].includes(value?.status)) return value
      return Object.freeze({ status: "failed", message: "Output adapter returned an invalid durability result" })
    }
    async function fingerprint(serialized) { try { return Object.freeze({ status: "computed", value: await window.CaderactDocumentFileState.fingerprint(serialized) }) } catch (error) { return Object.freeze({ status: "failed", value: null, message: error.message }) } }
    async function writeCaptured(captured, { targetName, fileHandle = null, operation = "save" }) {
      let output
      try { output = normalizeOutput(await adapters.writeFile({ serialized: captured.serialized, filename: targetName, fileHandle })) }
      catch (error) { output = Object.freeze({ status: "failed", message: error.message }) }
      fileState.recordOutput(output.status)
      if (output.status === "failed") return publish(result(`${operation}-failed`, { reason: "write-failed", message: output.message || "File output failed", durability: "failed" }))
      if (output.status === "initiated") return publish(result(`${operation}-initiated`, { filename: targetName, serialized: captured.serialized, stateId: captured.stateId, revision: captured.revision, durability: "initiated" }))
      const payloadFingerprint = await fingerprint(captured.serialized), acknowledgement = captured.acknowledge()
      fileState.manualSave({ filename: targetName, fileHandle, fingerprint: payloadFingerprint.value, stateId: captured.stateId, revision: captured.revision, durability: "committed" })
      try { await recovery?.manualSaveCommitted(captured) } catch {}
      return publish(result(`${operation}-completed`, { filename: targetName, serialized: captured.serialized, stateId: captured.stateId,
        revision: captured.revision, acknowledgement, durability: "committed", fingerprint: payloadFingerprint.value, fingerprintStatus: payloadFingerprint.status,
        ...(payloadFingerprint.message ? { fingerprintMessage: payloadFingerprint.message } : {}) }))
    }
    async function capture(operation) {
      let captured
      try { captured = persistence.captureSave(session.reader, session.controller) }
      catch (error) { return { failure: publish(result(`${operation}-failed`, { reason: "serialization-failed", message: error.message, durability: "failed" })) } }
      return { captured }
    }
    async function save() {
      if (!fileState.value.fileHandle && typeof adapters.pickSaveFile === "function") return saveAs("save")
      const prepared = await capture("save"); if (prepared.failure) return prepared.failure
      return writeCaptured(prepared.captured, { targetName: normalizeFilename(fileState.value.filename), fileHandle: fileState.value.fileHandle, operation: "save" })
    }
    async function saveAs(operation = "save-as") {
      const targetName = normalizeFilename(fileState.value.filename)
      let selection
      if (typeof adapters.pickSaveFile === "function") {
        try { selection = await adapters.pickSaveFile({ suggestedName: targetName }) }
        catch (error) { return publish(result(`${operation}-failed`, { reason: "picker-failed", message: error.message, durability: "failed" })) }
        if (selection?.status === "cancelled" || selection === null) return publish(result(`${operation}-cancelled`, { reason: "picker-cancelled" }))
        if (selection?.status !== "selected" && selection?.status !== "unsupported") return publish(result(`${operation}-failed`, { reason: "picker-failed", message: "Save As picker returned an invalid result", durability: "failed" }))
      } else selection = Object.freeze({ status: "unsupported" })
      const prepared = await capture(operation); if (prepared.failure) return prepared.failure
      return writeCaptured(prepared.captured, { targetName: selection.status === "selected" ? normalizeFilename(selection.filename || selection.handle?.name) : targetName,
        fileHandle: selection.status === "selected" ? selection.handle : null, operation })
    }
    function replaceDocument(store, details) { const replacement = session.replaceStore(store, details); if (replacement.status !== "document-replaced") return replacement; viewport.resetForDocumentReplacement(); return replacement }
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
      const filename = normalizeFilename(file.name), payloadFingerprint = await fingerprint(persistence.serializeDocument(store.reader.snapshot()))
      const replacement=replaceDocument(store,{reason:"open"});if(replacement.status!=="document-replaced")return publish(result("open-failed",{reason:"replacement-failed"}))
      fileState.opened({filename,fileHandle:file.handle||null,fingerprint:payloadFingerprint.value})
      return publish(result("open-completed", { filename, documentId: store.reader.snapshot().id, fingerprint: payloadFingerprint.value, fingerprintStatus: payloadFingerprint.status }))
    }
    async function openDxf() {
      const blocked = activeBlocked("dxf-open"); if (blocked) return blocked
      const guard = await confirmReplacement("dxf-open"); if (guard) return guard
      let file
      try { file = await (adapters.pickDxfFile || adapters.pickOpenFile)() }
      catch (error) { return publish(result("dxf-open-failed", { reason: "picker-failed", message: error.message })) }
      if (!file) return publish(result("dxf-open-cancelled", { reason: "picker-cancelled" }))
      let imported
      try {
        const text = typeof file.text === "function" ? await file.text() : file.serialized
        imported = dxfImporter.createStore(text)
      } catch (error) {
        return publish(result("dxf-open-failed", { reason: "invalid-dxf", message: error.message, diagnostics: error.diagnostics || [] }))
      }
      const sourceName = typeof file.name === "string" ? file.name.replace(/\.dxf$/i, "") : "Untitled"
      const filename = normalizeFilename(sourceName),replacement=replaceDocument(imported.store,{reason:"dxf-open"});if(replacement.status!=="document-replaced")return publish(result("dxf-open-failed",{reason:"replacement-failed"}))
      fileState.imported({filename})
      const outcome = publish(result("dxf-open-completed", { filename, documentId: imported.store.reader.snapshot().id,
        importedCount: imported.importedCount, diagnostics: imported.diagnostics, unit: imported.unit }))
      const warningCount = imported.diagnostics.filter(value => value.severity === "warning")
        .reduce((count, value) => count + (value.count || 1), 0)
      if (warningCount) window.caderactFeedback?.showTemporary(`DXF opened with ${warningCount} warning${warningCount === 1 ? "" : "s"}.`, "status")
      return outcome
    }
    async function exportDxf() {
      let exported
      try { exported = dxfExporter.exportDocument(session.reader.snapshot()) }
      catch (error) { return publish(result("dxf-export-failed", { reason:"unsupported-document", message:error.message, diagnostics:error.diagnostics||[] })) }
      const targetName=fileState.value.filename.replace(/\.caderact$/i,"")+".dxf"
      try { await adapters.writeFile({serialized:exported.text,filename:targetName,mimeType:"application/dxf"}) }
      catch(error){return publish(result("dxf-export-failed",{reason:"write-failed",message:error.message,diagnostics:exported.diagnostics}))}
      return publish(result("dxf-export-completed",{filename:targetName,serialized:exported.text,exportedCount:exported.exportedCount,diagnostics:exported.diagnostics,unit:exported.unit,version:exported.version}))
    }
    async function newProject() {
      const blocked = activeBlocked("new"); if (blocked) return blocked
      const guard = await confirmReplacement("new"); if (guard) return guard
      let store
      try { store = window.CaderactDocument.createStore({ initiallySaved: true }) }
      catch (error) { return publish(result("new-failed", { message: error.message })) }
      const replacement=replaceDocument(store,{reason:"new"});if(replacement.status!=="document-replaced")return publish(result("new-failed",{reason:"replacement-failed"}))
      fileState.reset()
      return publish(result("new-completed", { filename: fileState.value.filename, documentId: store.reader.snapshot().id }))
    }
    return Object.freeze({ save, saveAs:()=>saveAs("save-as"), open, openDxf, exportDxf, newProject, fileState, recovery, get filename() { return fileState.value.filename }, get lastResult() { return lastResult } })
  }

  window.CaderactFileActions = Object.freeze({ createActions, DEFAULT_FILENAME, normalizeFilename })

  const newButton = document.querySelector("#file-new")
  const openButton = document.querySelector("#file-open")
  const saveButton = document.querySelector("#file-save")
  const saveAsButton = document.querySelector("#file-save-as")
  const importDxfButton = document.querySelector("#file-import-dxf")
  const exportDxfButton = document.querySelector("#file-export-dxf")
  const fileMenu = document.querySelector(".file-menu")
  const fileMenuTrigger = document.querySelector(".file-menu-trigger")
  const fileMenuDropdown = document.querySelector("#file-menu-actions")
  if (!newButton || !openButton || !saveButton || !fileMenu || !fileMenuTrigger || !fileMenuDropdown || !window.caderactDocumentSession) return
  const fileState = window.CaderactDocumentFileState.create({ defaultFilename: DEFAULT_FILENAME })
  const recovery = window.CaderactRecoveryStorage?.createAutosave({ session: window.caderactDocumentSession, fileState }) || null
  const actions = createActions({
    session: window.caderactDocumentSession,
    commandRouter: window.caderactCommandRouter,
    viewport: window.caderactViewport,
    fileState,
    recovery,
  })
  recovery?.start()
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
  saveAsButton?.addEventListener("click", () => { closeFileMenu(); actions.saveAs() })
  importDxfButton?.addEventListener("click", () => { closeFileMenu(); actions.openDxf() })
  exportDxfButton?.addEventListener("click", () => { closeFileMenu(); actions.exportDxf() })
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
