// A4: Document Controller / transaction and exact-value history boundary.
//
// This module owns persistent publication, the foreground edit lease, linear
// history, content-state identity, and save-state markers. It remains schema
// agnostic: callers supply the document/table assembly and validation rules.
(() => {
  const has = (table, key) => Object.prototype.hasOwnProperty.call(table, key)
  const CHANGE_SET_VERSION = 1

  function recordsEqual(a, b) {
    if (a === b) return true
    if (a === null || b === null) return false
    if (typeof a !== "object" || typeof b !== "object") return false
    const aKeys = Object.keys(a), bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) return false
    for (const key of aKeys) {
      if (!has(b, key) || !recordsEqual(a[key], b[key])) return false
    }
    return true
  }

  // History keeps immutable copies. Transactions may stage caller-owned values
  // before validation, so retaining those references could corrupt Undo/Redo.
  function copyValue(value) {
    if (value === null || typeof value !== "object") return value
    if (Array.isArray(value)) return value.map(copyValue)
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copyValue(child)]))
  }
  function freezeValue(value) {
    if (value && typeof value === "object") {
      for (const child of Object.values(value)) freezeValue(child)
      Object.freeze(value)
    }
    return value
  }
  function frozenCopy(value) { return freezeValue(copyValue(value)) }

  function defaultStateIdAllocator() {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return "state_" + Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")
  }

  // `testHooks` is an explicitly supplied test-fixture capability. Production
  // CaderactDocument stores do not pass it and receive no bypass surface.
  function createController({ getDocument, assembleDocument, validate, onPublish, freeze, allocateStateId = defaultStateIdAllocator }, testHooks) {
    let revision = 0
    let leaseHolder = null
    let transactionSequence = 0
    let currentStateId = allocateStateId()
    let savedStateId = null
    let savedRevision = null
    // Save tokens are controller-issued immutable capabilities. A matching
    // stateId/revision pair copied from another controller or fabricated by a
    // caller is not enough to mark a state saved.
    const issuedStateTokens = new WeakSet()
    const historyEntries = []
    let historyCursor = 0 // number of applied entries; 0 is the initial state

    function baseObjectsOf(document) { return document.geometry.objects }
    function serializeChanges(changes) {
      return Array.from(changes, ([recordId, change]) => freezeValue({
        recordId,
        before: frozenCopy(change.before),
        after: frozenCopy(change.after),
      }))
    }
    function historyInfo() {
      return Object.freeze({ entryCount: historyEntries.length, cursor: historyCursor })
    }
    function historyBlocked() {
      return Object.freeze({ status: "blocked-by-active-transaction" })
    }
    function buildCandidateObjects(baseObjects, changes, side) {
      const objects = { ...baseObjects }
      for (const change of changes) {
        const value = change[side]
        if (value === null) delete objects[change.recordId]
        else objects[change.recordId] = copyValue(value)
      }
      return objects
    }
    function integrityFailure(message) {
      return Object.freeze({ status: "integrity-failed", errors: Object.freeze([message]) })
    }
    function applyHistory(entry, expectedSide, applySide, nextStateId, nextCursor, status) {
      if (leaseHolder !== null) return historyBlocked()
      const currentDocument = getDocument()
      const currentObjects = baseObjectsOf(currentDocument)
      for (const change of entry.changes) {
        const actual = has(currentObjects, change.recordId) ? currentObjects[change.recordId] : null
        if (!recordsEqual(actual, change[expectedSide])) {
          return integrityFailure(`History ${status} precondition failed for record ${change.recordId}`)
        }
      }
      const candidateObjects = buildCandidateObjects(currentObjects, entry.changes, applySide)
      const candidateDocument = assembleDocument(currentDocument, candidateObjects)
      const errors = validate(candidateDocument)
      if (errors.length) return Object.freeze({ status: "integrity-failed", errors: Object.freeze(Array.from(errors)) })
      onPublish(freeze(candidateDocument))
      revision += 1
      currentStateId = nextStateId
      historyCursor = nextCursor
      return Object.freeze({ status, revision, stateId: currentStateId })
    }

    function beginTransaction() {
      if (leaseHolder !== null) throw new Error("Finish or cancel the current command")
      const transactionId = "tx_" + (++transactionSequence)
      leaseHolder = transactionId
      const baseDocument = getDocument()
      const baseRevision = revision
      const baseObjects = baseObjectsOf(baseDocument)
      const staged = new Map()
      let closed = false

      function ownsLease() { return leaseHolder === transactionId }
      function ensureOpen() { if (closed) throw new Error("Transaction is already closed") }
      function releaseLease() { if (ownsLease()) leaseHolder = null }
      function committedBefore(recordId) { return has(baseObjects, recordId) ? baseObjects[recordId] : null }
      function read(recordId) {
        ensureOpen()
        return staged.has(recordId) ? staged.get(recordId).after : committedBefore(recordId)
      }
      function stage(recordId, after) {
        ensureOpen()
        const existing = staged.get(recordId)
        staged.set(recordId, { before: existing ? existing.before : committedBefore(recordId), after })
      }
      function create(recordId, record) {
        ensureOpen()
        if (read(recordId) !== null) throw new Error(`Cannot create record ${recordId}: it already exists in this transaction's staged view`)
        stage(recordId, record)
      }
      function replace(recordId, record) {
        ensureOpen()
        if (read(recordId) === null) throw new Error(`Cannot replace record ${recordId}: it does not exist in this transaction's staged view`)
        stage(recordId, record)
      }
      function remove(recordId) { stage(recordId, null) }
      function coalesce() {
        const net = new Map()
        for (const [recordId, change] of staged) if (!recordsEqual(change.before, change.after)) net.set(recordId, change)
        return net
      }
      function rollback() {
        ensureOpen()
        closed = true
        releaseLease()
        return Object.freeze({ status: "rolled-back" })
      }
      function publish() {
        ensureOpen()
        if (!ownsLease()) {
          closed = true
          throw new Error("Transaction does not hold the foreground lease")
        }
        if (baseRevision !== revision) {
          closed = true
          releaseLease()
          return Object.freeze({ status: "stale", baseRevision, currentRevision: revision })
        }
        const changes = coalesce()
        if (changes.size === 0) {
          closed = true
          releaseLease()
          return Object.freeze({ status: "no-op", changes: [] })
        }
        const candidateObjects = { ...baseObjects }
        for (const [recordId, change] of changes) {
          if (change.after === null) delete candidateObjects[recordId]
          else candidateObjects[recordId] = change.after
        }
        const candidateDocument = assembleDocument(baseDocument, candidateObjects)
        const errors = validate(candidateDocument)
        if (errors.length) {
          closed = true
          releaseLease()
          return Object.freeze({ status: "validation-failed", errors: Array.from(errors) })
        }
        const beforeStateId = currentStateId
        const afterStateId = allocateStateId()
        const publishedRevision = revision + 1
        const entry = freezeValue({
          transactionId, documentId: baseDocument.id, changeSetVersion: CHANGE_SET_VERSION,
          beforeStateId, afterStateId, baseRevision, publishedRevision,
          changes: serializeChanges(changes),
        })
        onPublish(freeze(candidateDocument))
        revision = publishedRevision
        // Redo disappears only after this successful non-no-op publication.
        historyEntries.splice(historyCursor)
        historyEntries.push(entry)
        historyCursor = historyEntries.length
        currentStateId = afterStateId
        closed = true
        releaseLease()
        return Object.freeze({ status: "committed", revision, stateId: currentStateId, changes: entry.changes })
      }
      return Object.freeze({
        id: transactionId, baseRevision,
        read, create, replace, remove, publish, rollback,
        get isOpen() { return !closed },
      })
    }

    function undo() {
      if (leaseHolder !== null) return historyBlocked()
      if (historyCursor === 0) return Object.freeze({ status: "no-undo" })
      const entry = historyEntries[historyCursor - 1]
      return applyHistory(entry, "after", "before", entry.beforeStateId, historyCursor - 1, "undone")
    }
    function redo() {
      if (leaseHolder !== null) return historyBlocked()
      if (historyCursor === historyEntries.length) return Object.freeze({ status: "no-redo" })
      const entry = historyEntries[historyCursor]
      return applyHistory(entry, "before", "after", entry.afterStateId, historyCursor + 1, "redone")
    }
    function captureStateToken() {
      const token = Object.freeze({ stateId: currentStateId, revision })
      issuedStateTokens.add(token)
      return token
    }
    function markStateSaved(token) {
      if (!token || typeof token !== "object" || !issuedStateTokens.has(token)) return Object.freeze({ status: "invalid-save-state-token" })
      savedStateId = token.stateId
      savedRevision = token.revision
      return Object.freeze({ status: "saved", stateId: savedStateId, revision: savedRevision })
    }

    if (testHooks) {
      // Revision-only advancement is another test-fixture tool: it creates no
      // state, history, or document mutation, and lets tests exercise stale
      // transaction outcomes without weakening production's edit lease.
      testHooks.forceRevision = () => { revision += 1 }
      testHooks.forcePublish = objects => {
        const candidateDocument = assembleDocument(getDocument(), objects)
        onPublish(freeze(candidateDocument))
        revision += 1
        // This test-only external transition has no exact record set, so it
        // establishes a fresh history root instead of forging an entry.
        historyEntries.length = 0
        historyCursor = 0
        currentStateId = allocateStateId()
      }
    }

    return Object.freeze({
      beginTransaction, undo, redo, captureStateToken, markStateSaved,
      get currentRevision() { return revision },
      get currentStateId() { return currentStateId },
      get savedStateId() { return savedStateId },
      get savedRevision() { return savedRevision },
      get isDirty() { return savedStateId === null || currentStateId !== savedStateId },
      get canUndo() { return historyCursor > 0 },
      get canRedo() { return historyCursor < historyEntries.length },
      get historyInfo() { return historyInfo() },
      get hasOpenTransaction() { return leaseHolder !== null },
    })
  }

  window.DocumentController = Object.freeze({ createController, recordsEqual })
})()
