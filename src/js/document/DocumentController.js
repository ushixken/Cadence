// A4/A7: Document Controller / transaction and exact-value history boundary.
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
  function createController({ getDocument, assembleDocument, getCollections, validate, onPublish, freeze, allocateStateId = defaultStateIdAllocator }, testHooks) {
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
    const historyListeners = new Set()

    function notifyHistory() {
      for (const listener of historyListeners) {
        try { listener() } catch (error) { console.warn("Caderact history observer failed", error) }
      }
    }
    function subscribeHistory(listener) {
      if (typeof listener !== "function") throw new Error("History listener must be a function")
      historyListeners.add(listener)
      listener()
      return () => historyListeners.delete(listener)
    }

    const usesCollections = typeof getCollections === "function"
    function collectionsOf(document) {
      return usesCollections ? getCollections(document) : { records: document.geometry.objects }
    }
    function assemble(baseDocument, collections) {
      return usesCollections ? assembleDocument(baseDocument, collections) : assembleDocument(baseDocument, collections.records)
    }
    function serializeChanges(changes) {
      return Array.from(changes.values(), change => freezeValue({
        collection: change.collection,
        recordId: change.recordId,
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
    function buildCandidateCollections(baseCollections, changes, side) {
      const collections = Object.fromEntries(Object.entries(baseCollections).map(([name, table]) => [name, { ...table }]))
      for (const change of changes) {
        const value = change[side]
        const table = collections[change.collection]
        if (!table) return null
        if (value === null) delete table[change.recordId]
        else table[change.recordId] = copyValue(value)
      }
      return collections
    }
    function integrityFailure(message) {
      return Object.freeze({ status: "integrity-failed", errors: Object.freeze([message]) })
    }
    function applyHistory(entry, expectedSide, applySide, nextStateId, nextCursor, status) {
      if (leaseHolder !== null) return historyBlocked()
      const currentDocument = getDocument()
      const currentCollections = collectionsOf(currentDocument)
      for (const change of entry.changes) {
        const table = currentCollections[change.collection]
        const actual = table && has(table, change.recordId) ? table[change.recordId] : null
        if (!recordsEqual(actual, change[expectedSide])) {
          return integrityFailure(`History ${status} precondition failed for ${change.collection} ${change.recordId}`)
        }
      }
      const candidateCollections = buildCandidateCollections(currentCollections, entry.changes, applySide)
      if (!candidateCollections) return integrityFailure(`History ${status} references an unknown collection`)
      const candidateDocument = assemble(currentDocument, candidateCollections)
      const errors = validate(candidateDocument)
      if (errors.length) return Object.freeze({ status: "integrity-failed", errors: Object.freeze(Array.from(errors)) })
      onPublish(freeze(candidateDocument))
      revision += 1
      currentStateId = nextStateId
      historyCursor = nextCursor
      notifyHistory()
      return Object.freeze({ status, revision, stateId: currentStateId })
    }

    function beginTransaction() {
      if (leaseHolder !== null) throw new Error("Finish or cancel the current command")
      const transactionId = "tx_" + (++transactionSequence)
      leaseHolder = transactionId
      const baseDocument = getDocument()
      const baseRevision = revision
      const baseCollections = collectionsOf(baseDocument)
      const staged = new Map()
      let closed = false

      function ownsLease() { return leaseHolder === transactionId }
      function ensureOpen() { if (closed) throw new Error("Transaction is already closed") }
      function releaseLease() { if (ownsLease()) leaseHolder = null }
      function changeKey(collection, recordId) { return `${collection}\u0000${recordId}` }
      function tableFor(collection) {
        const table = baseCollections[collection]
        if (!table) throw new Error(`Unknown transaction collection ${collection}`)
        return table
      }
      function committedBefore(collection, recordId) {
        const table = tableFor(collection)
        return has(table, recordId) ? table[recordId] : null
      }
      function readIn(collection, recordId) {
        ensureOpen()
        const key = changeKey(collection, recordId)
        return staged.has(key) ? staged.get(key).after : committedBefore(collection, recordId)
      }
      function stageIn(collection, recordId, after) {
        ensureOpen()
        const key = changeKey(collection, recordId), existing = staged.get(key)
        staged.set(key, { collection, recordId, before: existing ? existing.before : committedBefore(collection, recordId), after })
      }
      function createIn(collection, recordId, record) {
        ensureOpen()
        if (readIn(collection, recordId) !== null) throw new Error(`Cannot create ${collection} ${recordId}: it already exists in this transaction's staged view`)
        stageIn(collection, recordId, record)
      }
      function replaceIn(collection, recordId, record) {
        ensureOpen()
        if (readIn(collection, recordId) === null) throw new Error(`Cannot replace ${collection} ${recordId}: it does not exist in this transaction's staged view`)
        stageIn(collection, recordId, record)
      }
      function removeIn(collection, recordId) { stageIn(collection, recordId, null) }
      const read = recordId => readIn("records", recordId)
      const create = (recordId, record) => createIn("records", recordId, record)
      const replace = (recordId, record) => replaceIn("records", recordId, record)
      const remove = recordId => removeIn("records", recordId)
      function coalesce() {
        const net = new Map()
        for (const [key, change] of staged) if (!recordsEqual(change.before, change.after)) net.set(key, change)
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
        const candidateCollections = Object.fromEntries(Object.entries(baseCollections).map(([name, table]) => [name, { ...table }]))
        for (const change of changes.values()) {
          const table = candidateCollections[change.collection]
          if (change.after === null) delete table[change.recordId]
          else table[change.recordId] = change.after
        }
        const candidateDocument = assemble(baseDocument, candidateCollections)
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
        notifyHistory()
        return Object.freeze({ status: "committed", revision, stateId: currentStateId, changes: entry.changes })
      }
      return Object.freeze({
        id: transactionId, baseRevision,
        read, create, replace, remove, readIn, createIn, replaceIn, removeIn, publish, rollback,
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
        const currentDocument = getDocument()
        const collections = collectionsOf(currentDocument)
        const candidateDocument = assemble(currentDocument, { ...collections, records: objects })
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
      beginTransaction, undo, redo, captureStateToken, markStateSaved, subscribeHistory,
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
