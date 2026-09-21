// FS3: untrusted recovery classification, preparation, and explicit application.
(() => {
  const CLASSIFICATION = Object.freeze({
    NEWER: "valid-newer", STALE: "valid-stale", EQUIVALENT: "valid-equivalent", UNRESOLVED: "valid-unresolved",
    CORRUPT: "corrupt-envelope", FINGERPRINT: "fingerprint-mismatch", INVALID: "invalid-document",
    INCOMPATIBLE: "incompatible-version", EXCESSIVE: "excessive-resource-rejected", UNREADABLE: "unreadable-storage-failure",
  })
  const preparedCandidates = new WeakSet()
  const fingerprintPattern = /^[0-9a-f]{64}$/
  const sourceKinds = new Set(["untitled", "native", "dxf-import", "recovered"])
  const plainObject = value => value !== null && typeof value === "object" && !Array.isArray(value)
  const finiteInteger = (value, minimum = 0) => Number.isInteger(value) && value >= minimum
  function frozenCopy(value) {
    if (value === null || typeof value !== "object") return value
    const copy = Array.isArray(value) ? value.map(frozenCopy) : Object.fromEntries(Object.entries(value).map(([key, child]) => [key, frozenCopy(child)]))
    return Object.freeze(copy)
  }
  function outcome(classification, details = {}) { return Object.freeze({ classification, ...details }) }
  function validateEnvelope(record, maxPayloadBytes) {
    if (!plainObject(record)) return outcome(CLASSIFICATION.CORRUPT, { reason: "envelope-not-object" })
    if (record.recoveryRecordVersion !== window.CaderactRecoveryStorage.RECORD_VERSION) {
      return outcome(finiteInteger(record.recoveryRecordVersion, 1) ? CLASSIFICATION.INCOMPATIBLE : CLASSIFICATION.CORRUPT,
        { reason: "unsupported-recovery-version", recoveryRecordVersion: record.recoveryRecordVersion })
    }
    if (typeof record.recoveryKey !== "string" || !/^recovery_[0-9a-f]{32}$/.test(record.recoveryKey)) return outcome(CLASSIFICATION.CORRUPT, { reason: "invalid-recovery-key" })
    if (!finiteInteger(record.sequence, 1)) return outcome(CLASSIFICATION.CORRUPT, { reason: "invalid-sequence" })
    if (typeof record.payload !== "string" || record.payload.length === 0) return outcome(CLASSIFICATION.CORRUPT, { reason: "invalid-payload" })
    const payloadBytes = typeof TextEncoder === "function" ? new TextEncoder().encode(record.payload).byteLength : record.payload.length
    if (payloadBytes > maxPayloadBytes) return outcome(CLASSIFICATION.EXCESSIVE, { reason: "payload-limit", payloadBytes, maxPayloadBytes })
    if (typeof record.payloadFingerprint !== "string" || !fingerprintPattern.test(record.payloadFingerprint)) return outcome(CLASSIFICATION.CORRUPT, { reason: "invalid-fingerprint" })
    if (typeof record.stateId !== "string" || record.stateId.length === 0 || !finiteInteger(record.revision)) return outcome(CLASSIFICATION.CORRUPT, { reason: "invalid-state-metadata" })
    if (!Number.isFinite(record.timestamp) || record.timestamp < 0) return outcome(CLASSIFICATION.CORRUPT, { reason: "invalid-timestamp" })
    if (typeof record.filename !== "string" || record.filename.length === 0 || typeof record.displayName !== "string" || record.displayName.length === 0) return outcome(CLASSIFICATION.CORRUPT, { reason: "invalid-file-metadata" })
    if (!sourceKinds.has(record.sourceKind) || (record.manualSaveFingerprint !== null && !fingerprintPattern.test(record.manualSaveFingerprint))) return outcome(CLASSIFICATION.CORRUPT, { reason: "invalid-file-metadata" })
    if (typeof record.dirty !== "boolean" || !finiteInteger(record.nativePersistenceVersion, 1)) return outcome(CLASSIFICATION.CORRUPT, { reason: "invalid-capture-metadata" })
    return null
  }
  function semanticClassification(record, context) {
    const manualFingerprint = context.manualSaveFingerprint ?? record.manualSaveFingerprint
    if (manualFingerprint && manualFingerprint === record.payloadFingerprint) return CLASSIFICATION.EQUIVALENT
    const saved = context.lastSuccessfulSave
    if (context.currentRecoveryKey === record.recoveryKey && saved?.durability === "committed" &&
      finiteInteger(saved.revision) && saved.revision >= record.revision && manualFingerprint) return CLASSIFICATION.STALE
    if (record.dirty && (!manualFingerprint || manualFingerprint !== record.payloadFingerprint)) return CLASSIFICATION.NEWER
    return CLASSIFICATION.UNRESOLVED
  }
  function create({ storage, persistence = window.CaderactPersistence, fingerprint = window.CaderactDocumentFileState.fingerprint,
    maxPayloadBytes = window.CaderactRecoveryStorage.MAX_PAYLOAD_BYTES } = {}) {
    async function classify(record, context = {}) {
      const envelopeFailure = validateEnvelope(record, maxPayloadBytes)
      if (envelopeFailure) return envelopeFailure
      if (record.nativePersistenceVersion > persistence.FILE_VERSION) return outcome(CLASSIFICATION.INCOMPATIBLE,
        { reason: "unsupported-native-version", recoveryKey: record.recoveryKey, nativeVersion: record.nativePersistenceVersion })
      let actualFingerprint
      try { actualFingerprint = await fingerprint(record.payload) }
      catch (error) { return outcome(CLASSIFICATION.UNREADABLE, { reason: "fingerprint-failed", message: error.message, recoveryKey: record.recoveryKey }) }
      if (actualFingerprint !== record.payloadFingerprint) return outcome(CLASSIFICATION.FINGERPRINT, { reason: "payload-fingerprint-mismatch", recoveryKey: record.recoveryKey, sequence: record.sequence })
      let parsed
      try { parsed = JSON.parse(record.payload) }
      catch { return outcome(CLASSIFICATION.INVALID, { reason: "malformed-json", recoveryKey: record.recoveryKey }) }
      if (plainObject(parsed) && finiteInteger(parsed.fileVersion, 1) && parsed.fileVersion > persistence.FILE_VERSION) {
        return outcome(CLASSIFICATION.INCOMPATIBLE, { reason: "unsupported-native-version", recoveryKey: record.recoveryKey, nativeVersion: parsed.fileVersion })
      }
      if (plainObject(parsed) && finiteInteger(parsed.fileVersion, 1) && parsed.fileVersion !== record.nativePersistenceVersion) {
        return outcome(CLASSIFICATION.CORRUPT, { reason: "native-version-metadata-mismatch", recoveryKey: record.recoveryKey })
      }
      let isolatedStore
      try { isolatedStore = persistence.loadStore(record.payload) }
      catch (error) {
        const excessive = /limit|maximum|too many|excessive|depth/i.test(error.message)
        return outcome(excessive ? CLASSIFICATION.EXCESSIVE : CLASSIFICATION.INVALID,
          { reason: excessive ? "native-resource-limit" : "native-validation-failed", message: error.message, recoveryKey: record.recoveryKey })
      }
      const classification = semanticClassification(record, context)
      const document = frozenCopy(isolatedStore.reader.snapshot())
      const candidate = Object.freeze({ classification, recoveryKey: record.recoveryKey, sequence: record.sequence, timestamp: record.timestamp,
        filename: record.filename, displayName: record.displayName, sourceKind: record.sourceKind, payloadFingerprint: record.payloadFingerprint,
        stateId: record.stateId, revision: record.revision, document,
        summary: Object.freeze({ objectCount: isolatedStore.reader.records().length, documentName: document.name, nativePersistenceVersion: record.nativePersistenceVersion }) })
      preparedCandidates.add(candidate)
      return candidate
    }
    async function classifyAll(context = {}) {
      let listed
      try { listed = await storage.list() } catch (error) { return Object.freeze({ status: "recovery-list-failed", reason: "storage-failure", message: error.message, candidates: Object.freeze([]) }) }
      if (listed.status !== "recovery-list") return Object.freeze({ status: "recovery-list-failed", reason: listed.reason || listed.status, message: listed.message, candidates: Object.freeze([]) })
      const entries = await Promise.all(listed.records.map(async record => ({ record, candidate: await classify(record, context) })))
      entries.sort((a, b) => (Number(b.record?.timestamp) || 0) - (Number(a.record?.timestamp) || 0) || (Number(b.record?.sequence) || 0) - (Number(a.record?.sequence) || 0) || String(a.record?.recoveryKey || "").localeCompare(String(b.record?.recoveryKey || "")))
      const candidates = entries.map(entry => entry.candidate)
      return Object.freeze({ status: "recovery-list-classified", candidates: Object.freeze(candidates) })
    }
    async function dismiss(recoveryKey) {
      if (typeof recoveryKey !== "string" || recoveryKey.length === 0) return Object.freeze({ status: "recovery-delete-failed", reason: "invalid-recovery-key" })
      try { return await storage.delete(recoveryKey) } catch (error) { return Object.freeze({ status: "recovery-delete-failed", reason: "storage-failure", message: error.message }) }
    }
    async function apply(candidate, { session, fileState, autosave, commandRouter, viewport } = {}) {
      if (!preparedCandidates.has(candidate) || !candidate.classification?.startsWith("valid-")) return Object.freeze({ status: "recovery-apply-failed", reason: "unprepared-candidate" })
      if (commandRouter?.isActive) return Object.freeze({ status: "recovery-apply-blocked-active-command", command: commandRouter.activeCommand })
      let recoveredStore
      try { recoveredStore = window.CaderactDocument.createStore({ document: candidate.document, initiallySaved: false }) }
      catch (error) { return Object.freeze({ status: "recovery-apply-failed", reason: "candidate-revalidation-failed", message: error.message }) }
      const replacement = session.replaceStore(recoveredStore, { reason: "recovery-apply", recoveryKey: candidate.recoveryKey })
      if (replacement.status !== "document-replaced") return Object.freeze({ status: "recovery-apply-failed", reason: "replacement-failed" })
      viewport?.resetForDocumentReplacement()
      fileState.recovered({ filename: candidate.filename, displayName: candidate.displayName, sourceKind: candidate.sourceKind, fingerprint: candidate.payloadFingerprint })
      const newRecoveryKey = autosave?.recoveryKey || null
      autosave?.schedule()
      return Object.freeze({ status: "recovery-applied", recoveryKey: candidate.recoveryKey, newRecoveryKey,
        documentId: recoveredStore.reader.snapshot().id, dirty: recoveredStore.controller.isDirty })
    }
    return Object.freeze({ classify, classifyAll, dismiss, apply })
  }
  window.CaderactRecoveryValidation = Object.freeze({ create, validateEnvelope, CLASSIFICATION })
})()
