// FS2: durable, renderer-independent recovery records and autosave coordination.
(() => {
  const RECORD_VERSION = 1
  const DATABASE_NAME = "caderact-recovery"
  const DATABASE_VERSION = 1
  const STORE_NAME = "recoveries"
  const MAX_PAYLOAD_BYTES = 16 * 1024 * 1024
  const DEFAULT_DEBOUNCE_MS = 1500

  function failure(operation, error) {
    return Object.freeze({ status: "storage-failed", operation, reason: error?.name || "storage-error", message: error?.message || String(error) })
  }
  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error || new Error("IndexedDB request failed"))
    })
  }
  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"))
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"))
    })
  }
  function createStorage({ indexedDB = window.indexedDB, databaseName = DATABASE_NAME } = {}) {
    let databasePromise = null
    async function open() {
      if (!indexedDB?.open) return Object.freeze({ status: "storage-unavailable", reason: "indexeddb-unavailable" })
      if (!databasePromise) databasePromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, DATABASE_VERSION)
        request.onupgradeneeded = () => {
          const database = request.result
          if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "recoveryKey" })
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error || new Error("IndexedDB open failed"))
        request.onblocked = () => reject(new Error("IndexedDB open blocked"))
      })
      try { return Object.freeze({ status: "storage-ready", database: await databasePromise }) }
      catch (error) { databasePromise = null; return failure("open", error) }
    }
    async function withStore(mode, operation, callback) {
      const opened = await open()
      if (opened.status !== "storage-ready") return opened
      try {
        const transaction = opened.database.transaction(STORE_NAME, mode), store = transaction.objectStore(STORE_NAME)
        const value = await callback(store, transaction)
        await transactionDone(transaction)
        return value
      } catch (error) { return failure(operation, error) }
    }
    async function put(record) {
      return withStore("readwrite", "put", async store => {
        const existing = await requestResult(store.get(record.recoveryKey))
        if (existing && Number(existing.sequence) > record.sequence) return Object.freeze({ status: "recovery-stale", record: existing })
        await requestResult(store.put(record))
        return Object.freeze({ status: "recovery-stored", record })
      })
    }
    async function get(recoveryKey) {
      return withStore("readonly", "get", async store => Object.freeze({ status: "recovery-read", record: await requestResult(store.get(recoveryKey)) || null }))
    }
    async function list() {
      return withStore("readonly", "list", async store => Object.freeze({ status: "recovery-list", records: Object.freeze(await requestResult(store.getAll())) }))
    }
    async function remove(recoveryKey) {
      return withStore("readwrite", "delete", async store => { await requestResult(store.delete(recoveryKey)); return Object.freeze({ status: "recovery-deleted", recoveryKey }) })
    }
    function close() { if (databasePromise) databasePromise.then(database => database.close?.()).catch(() => {}); databasePromise = null }
    return Object.freeze({ open, put, get, list, delete: remove, clearSession: remove, close })
  }

  // Deterministic storage used by unit tests and non-browser hosts. It preserves
  // the same compare-before-publish rule as the IndexedDB transaction.
  function createMemoryStorage() {
    const records = new Map()
    return Object.freeze({
      async open() { return Object.freeze({ status: "storage-ready" }) },
      async put(record) { const current = records.get(record.recoveryKey); if (current && current.sequence > record.sequence) return Object.freeze({ status: "recovery-stale", record: current }); records.set(record.recoveryKey, record); return Object.freeze({ status: "recovery-stored", record }) },
      async get(key) { return Object.freeze({ status: "recovery-read", record: records.get(key) || null }) },
      async list() { return Object.freeze({ status: "recovery-list", records: Object.freeze(Array.from(records.values())) }) },
      async delete(key) { records.delete(key); return Object.freeze({ status: "recovery-deleted", recoveryKey: key }) },
      async clearSession(key) { return this.delete(key) }, close() {},
    })
  }
  function recoveryKey() {
    const bytes = new Uint8Array(16); crypto.getRandomValues(bytes)
    return "recovery_" + Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("")
  }
  function createAutosave({ session, fileState, storage = createStorage(), persistence = window.CaderactPersistence,
    fingerprint = window.CaderactDocumentFileState.fingerprint, debounceMs = DEFAULT_DEBOUNCE_MS,
    setTimer = globalThis.setTimeout.bind(globalThis), clearTimer = globalThis.clearTimeout.bind(globalThis), now = () => Date.now(), maxPayloadBytes = MAX_PAYLOAD_BYTES } = {}) {
    let key = recoveryKey(), sequence = 0, timer = null, unsubscribeHistory = null, unsubscribeSession = null
    let lastScheduledStateId = null, lastStoredStateId = null, lastResult = Object.freeze({ status: "autosave-idle" }), stopped = false
    function cancelTimer() { if (timer !== null) clearTimer(timer); timer = null }
    function bindController() {
      unsubscribeHistory?.(); unsubscribeHistory = session.controller.subscribeHistory(schedule)
    }
    function rotate() {
      cancelTimer(); key = recoveryKey(); sequence = 0; lastScheduledStateId = null; lastStoredStateId = null
      lastResult = Object.freeze({ status: "autosave-session-rotated", recoveryKey: key }); bindController(); return lastResult
    }
    function schedule() {
      if (stopped || !session.controller.isDirty) { cancelTimer(); return Object.freeze({ status: "autosave-not-scheduled", reason: "clean" }) }
      const stateId = session.controller.currentStateId
      if (stateId === lastScheduledStateId && timer !== null) return Object.freeze({ status: "autosave-coalesced", stateId })
      lastScheduledStateId = stateId; cancelTimer(); timer = setTimer(() => { timer = null; capture().catch(() => {}) }, debounceMs)
      return Object.freeze({ status: "autosave-scheduled", stateId })
    }
    async function capture() {
      cancelTimer()
      const controller = session.controller, capturedKey = key
      if (!controller.isDirty) return (lastResult = Object.freeze({ status: "autosave-skipped", reason: "clean" }))
      const capturedSequence = ++sequence
      const stateId = controller.currentStateId, revision = controller.currentRevision
      if (stateId === lastStoredStateId) return (lastResult = Object.freeze({ status: "autosave-skipped", reason: "unchanged", stateId }))
      let payload, payloadFingerprint
      try { payload = persistence.serializeDocument(session.reader.snapshot()) }
      catch (error) { return (lastResult = Object.freeze({ status: "autosave-failed", reason: "serialization-failed", message: error.message })) }
      const payloadBytes = typeof TextEncoder === "function" ? new TextEncoder().encode(payload).byteLength : payload.length
      if (!payload || payloadBytes > maxPayloadBytes) return (lastResult = Object.freeze({ status: "autosave-failed", reason: "payload-limit", payloadBytes, maxPayloadBytes }))
      try { payloadFingerprint = await fingerprint(payload) }
      catch (error) { return (lastResult = Object.freeze({ status: "autosave-failed", reason: "fingerprint-failed", message: error.message })) }
      const metadata = fileState.value
      const record = Object.freeze({ recoveryRecordVersion: RECORD_VERSION, recoveryKey: capturedKey, sequence: capturedSequence,
        payload, payloadFingerprint, stateId, revision, timestamp: now(), filename: metadata.filename, displayName: metadata.displayName,
        sourceKind: metadata.sourceKind, manualSaveFingerprint: metadata.lastManualSaveFingerprint, dirty: true,
        nativePersistenceVersion: persistence.FILE_VERSION })
      let stored
      try { stored = await storage.put(record) }
      catch (error) { stored = failure("put", error) }
      if (capturedKey !== key) return (lastResult = Object.freeze({ status: "autosave-stale-session", recoveryKey: capturedKey }))
      if (stored.status !== "recovery-stored") return (lastResult = Object.freeze({ status: "autosave-failed", reason: stored.reason || stored.status, message: stored.message }))
      let verified
      try { verified = await storage.get(capturedKey) }
      catch (error) { verified = failure("get", error) }
      if (verified.status !== "recovery-read" || verified.record?.sequence !== capturedSequence || verified.record?.payloadFingerprint !== payloadFingerprint) {
        return (lastResult = Object.freeze({ status: "autosave-failed", reason: "verification-failed" }))
      }
      lastStoredStateId = stateId
      lastResult = Object.freeze({ status: "autosave-completed", recoveryKey: capturedKey, sequence: capturedSequence, stateId, revision, payloadFingerprint })
      if (controller.isDirty && controller.currentStateId !== stateId) schedule()
      return lastResult
    }
    async function manualSaveCommitted(captured) {
      if (captured?.stateId !== session.controller.currentStateId || session.controller.isDirty) return Object.freeze({ status: "recovery-preserved", reason: "newer-dirty-state" })
      let read
      try { read = await storage.get(key) } catch (error) { return failure("get", error) }
      if (read.status !== "recovery-read" || !read.record || read.record.stateId !== captured.stateId) return Object.freeze({ status: "recovery-preserved", reason: "no-matching-recovery" })
      try { return await storage.delete(key) } catch (error) { return failure("delete", error) }
    }
    async function read() { try { return await storage.get(key) } catch (error) { return failure("get", error) } }
    async function clear() { cancelTimer(); try { return await storage.clearSession(key) } catch (error) { return failure("delete", error) } }
    function start() { if (unsubscribeSession || stopped) return; bindController(); unsubscribeSession = session.subscribe(() => rotate()) }
    function stop() { stopped = true; cancelTimer(); unsubscribeHistory?.(); unsubscribeSession?.(); unsubscribeHistory = null; unsubscribeSession = null }
    return Object.freeze({ start, stop, schedule, flush: capture, rotate, read, clear, manualSaveCommitted,
      get recoveryKey() { return key }, get lastResult() { return lastResult }, get hasPendingAutosave() { return timer !== null } })
  }

  window.CaderactRecoveryStorage = Object.freeze({ createStorage, createMemoryStorage, createAutosave, RECORD_VERSION, DATABASE_NAME, STORE_NAME, MAX_PAYLOAD_BYTES, DEFAULT_DEBOUNCE_MS })
})()
