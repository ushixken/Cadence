// A3: Transaction Core / Document Controller.
//
// This is the authoritative publication gate for persistent document mutations.
// It owns: current committed document state, a monotonically increasing runtime
// revision, the single foreground editing lease, transaction creation/publication,
// and the candidate validation boundary.
//
// It deliberately knows nothing about renderer behavior, GPU data, command
// parsing, persistence, selection, geometry solving, or (yet) undo/redo history.
// Those remain out of scope until later stages (see docs/architecture/stages).
//
// This module is schema-agnostic: it manages one flat table of records keyed by
// stable record ID, plus a caller-supplied `assembleDocument`/`validate` pair that
// knows how that table fits into the full document shape. Callers (for now,
// CaderactDocument.js) own the schema; this module owns transactional discipline.
(() => {
  const has = (table, key) => Object.prototype.hasOwnProperty.call(table, key)

  // Structural equality for plain JSON-shaped records (or null for absence).
  // Records here never contain functions, DOM nodes, or other non-JSON values.
  function recordsEqual(a, b) {
    if (a === b) return true
    if (a === null || b === null) return false
    if (typeof a !== "object" || typeof b !== "object") return false
    const aKeys = Object.keys(a), bKeys = Object.keys(b)
    if (aKeys.length !== bKeys.length) return false
    for (const key of aKeys) {
      if (!has(b, key)) return false
      if (!recordsEqual(a[key], b[key])) return false
    }
    return true
  }

  // `testHooks`, if supplied, is a plain mutable object owned by the caller.
  // When present, createController populates it with a `forcePublish` escape
  // hatch tied to THIS controller's own revision/document closure. It is never
  // attached to (or reachable from) the returned controller object itself, so
  // a caller that omits the argument — as CaderactDocument.js's production
  // createStore() does — gets a controller with no bypass whatsoever: there is
  // no `.testing` property, and no other path to reach it. Only a caller that
  // explicitly passes its own `testHooks` object (i.e. a test fixture) can
  // ever obtain forcePublish, and only for the specific controller instance
  // it created for that purpose.
  function createController({ getDocument, assembleDocument, validate, onPublish, freeze }, testHooks) {
    let revision = 0
    let leaseHolder = null // transactionId of the single open foreground transaction, or null
    let transactionSequence = 0

    function baseObjectsOf(document) { return document.geometry.objects }

    function beginTransaction() {
      if (leaseHolder !== null) {
        // ADR-001 §5: "Another persistent edit is rejected... do not invisibly queue."
        throw new Error("Finish or cancel the current command")
      }
      const transactionId = "tx_" + (++transactionSequence)
      leaseHolder = transactionId

      const baseDocument = getDocument()
      const baseRevision = revision
      const baseObjects = baseObjectsOf(baseDocument)

      // recordId -> { before, after }. `before` is always derived from the
      // committed base (or from this transaction's own earlier staged change),
      // never supplied by the caller.
      const staged = new Map()
      let closed = false

      function ownsLease() { return leaseHolder === transactionId }
      function ensureOpen() {
        if (closed) throw new Error("Transaction is already closed")
      }
      function releaseLease() {
        // A closed transaction can never release a lease it does not hold,
        // even if called again after another transaction has since begun.
        if (ownsLease()) leaseHolder = null
      }
      function committedBefore(recordId) {
        return has(baseObjects, recordId) ? baseObjects[recordId] : null
      }

      function read(recordId) {
        ensureOpen()
        if (staged.has(recordId)) return staged.get(recordId).after
        return committedBefore(recordId)
      }
      function stage(recordId, after) {
        ensureOpen()
        const existing = staged.get(recordId)
        const before = existing ? existing.before : committedBefore(recordId)
        staged.set(recordId, { before, after })
      }
      // create/replace are meaningful against the transaction's CURRENT STAGED
      // VIEW (this transaction's own staged edits layered over committed
      // state via `read`), not just the committed table. This lets a
      // transaction validate its own internal sequencing (e.g. you cannot
      // create something twice, or replace something you never created and
      // isn't committed) while still allowing the standard coalescing flows:
      // create -> replace (null -> final) and committed replace -> replace
      // (original -> final) both remain valid, since after the first call the
      // staged view reflects the record's existence for the second call.
      function create(recordId, record) {
        ensureOpen()
        if (read(recordId) !== null) {
          throw new Error(`Cannot create record ${recordId}: it already exists in this transaction's staged view`)
        }
        stage(recordId, record)
      }
      function replace(recordId, record) {
        ensureOpen()
        if (read(recordId) === null) {
          throw new Error(`Cannot replace record ${recordId}: it does not exist in this transaction's staged view`)
        }
        stage(recordId, record)
      }
      // remove() has no existence precondition: removing an ID that is absent
      // from the staged view (never created, not committed) simply stages
      // null -> null, which `coalesce()` already drops as a no-op. This keeps
      // remove idempotent and deterministic without inventing new outcome
      // states — a transaction that only removes already-absent records
      // publishes as an ordinary { status: "no-op" }.
      function remove(recordId) { stage(recordId, null) }

      // Coalesce to the net result per record; drop anything that nets to a no-op
      // (including "final state equals original authoritative state").
      function coalesce() {
        const net = new Map()
        for (const [recordId, change] of staged) {
          if (recordsEqual(change.before, change.after)) continue
          net.set(recordId, change)
        }
        return net
      }

      function buildCandidateObjects(changes) {
        const objects = { ...baseObjects }
        for (const [recordId, change] of changes) {
          if (change.after === null) delete objects[recordId]
          else objects[recordId] = change.after
        }
        return objects
      }

      function serializeChanges(changes) {
        return Array.from(changes, ([recordId, change]) => ({
          recordId, before: change.before, after: change.after,
        }))
      }

      function rollback() {
        ensureOpen()
        closed = true
        releaseLease()
        return Object.freeze({ status: "rolled-back" })
      }

      // Publication lifecycle (ADR-001 §5 / A3 spec §8):
      // confirm open -> confirm lease -> confirm revision -> coalesce -> detect
      // no-op -> build candidate -> validate -> atomically publish -> increment
      // revision -> close -> release lease -> return structured outcome.
      // The synchronous critical section (steps 6-7 below) contains no await,
      // solver work, persistence, renderer calls, or arbitrary callbacks.
      function publish() {
        ensureOpen()
        if (!ownsLease()) {
          // Invariant violation: a closed/foreign transaction reached publish.
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
        const candidateObjects = buildCandidateObjects(changes)
        const candidateDocument = assembleDocument(baseDocument, candidateObjects)
        const errors = validate(candidateDocument)
        if (errors.length) {
          closed = true
          releaseLease()
          return Object.freeze({ status: "validation-failed", errors: Array.from(errors) })
        }
        // --- synchronous atomic publication critical section ---
        onPublish(freeze(candidateDocument))
        revision += 1
        // --- end critical section ---
        closed = true
        releaseLease()
        return Object.freeze({ status: "committed", revision, changes: serializeChanges(changes) })
      }

      return Object.freeze({
        id: transactionId,
        baseRevision,
        read, create, replace, remove,
        publish, rollback,
        get isOpen() { return !closed },
      })
    }

    // Only wired up when a caller explicitly supplies its own `testHooks`
    // sink (see comment above createController). Production callers pass
    // none, so this block never runs for the app's real controller and there
    // is nothing to bypass the lease with.
    if (testHooks) {
      testHooks.forcePublish = objects => {
        const candidateDocument = assembleDocument(getDocument(), objects)
        onPublish(freeze(candidateDocument))
        revision += 1
      }
    }

    return Object.freeze({
      beginTransaction,
      get currentRevision() { return revision },
      get hasOpenTransaction() { return leaseHolder !== null },
    })
  }

  window.DocumentController = Object.freeze({ createController, recordsEqual })
})()