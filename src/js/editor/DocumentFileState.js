// FS1: runtime-only file metadata, destructive-action guard, and payload fingerprinting.
(() => {
  const OUTPUT_DURABILITY = Object.freeze({ COMMITTED: "committed", INITIATED: "initiated", FAILED: "failed" })
  function bytes(value) {
    if (typeof TextEncoder === "function") return new TextEncoder().encode(value)
    const encoded = unescape(encodeURIComponent(value)), result = new Uint8Array(encoded.length)
    for (let index = 0; index < encoded.length; index += 1) result[index] = encoded.charCodeAt(index)
    return result
  }
  async function fingerprint(serialized) {
    if (typeof serialized !== "string") throw new Error("Fingerprint input must be serialized text")
    if (!crypto?.subtle?.digest) throw new Error("SHA-256 fingerprinting is unavailable")
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes(serialized)))
    return Array.from(digest, value => value.toString(16).padStart(2, "0")).join("")
  }
  function create({ defaultFilename = "Untitled.caderact" } = {}) {
    let value = Object.freeze({ filename: defaultFilename, displayName: defaultFilename, sourceKind: "untitled", fileHandle: null,
      lastManualSaveFingerprint: null, lastSuccessfulSave: null, lastOutputDurability: null })
    const listeners = new Set()
    function update(patch) { value = Object.freeze({ ...value, ...patch }); for (const listener of listeners) listener(value); return value }
    async function guardReplacement({ controller, operation, confirmDiscard }) {
      if (!controller.isDirty) return Object.freeze({ status: "replacement-allowed", operation })
      try { return await confirmDiscard(operation) ? Object.freeze({ status: "replacement-allowed", operation }) : Object.freeze({ status: "replacement-cancelled", operation, reason: "unsaved-changes" }) }
      catch (error) { return Object.freeze({ status: "replacement-failed", operation, reason: "confirmation-failed", message: error.message }) }
    }
    function recordOutput(durability) { return update({ lastOutputDurability: durability }) }
    function manualSave({ filename, fileHandle = value.fileHandle, fingerprint: payloadFingerprint, stateId, revision, durability }) {
      if (durability !== OUTPUT_DURABILITY.COMMITTED) throw new Error("Only committed output may update manual-save metadata")
      return update({ filename, displayName: filename, sourceKind: "native", fileHandle: fileHandle || null,
        lastManualSaveFingerprint: payloadFingerprint || null, lastSuccessfulSave: Object.freeze({ filename, fingerprint: payloadFingerprint || null, stateId, revision, durability, timestamp: Date.now() }), lastOutputDurability: durability })
    }
    const opened = ({ filename, fileHandle = null, fingerprint: payloadFingerprint = null }) => update({ filename, displayName: filename, sourceKind: "native", fileHandle,
      lastManualSaveFingerprint: payloadFingerprint, lastSuccessfulSave: null, lastOutputDurability: null })
    const imported = ({ filename }) => update({ filename, displayName: filename, sourceKind: "dxf-import", fileHandle: null,
      lastManualSaveFingerprint: null, lastSuccessfulSave: null, lastOutputDurability: null })
    const recovered = ({ filename, displayName = filename, sourceKind = "recovered", fingerprint: payloadFingerprint = null }) => update({
      filename, displayName, sourceKind: sourceKind === "untitled" ? "recovered" : sourceKind, fileHandle: null,
      lastManualSaveFingerprint: null, lastSuccessfulSave: null, lastOutputDurability: null })
    const reset = () => update({ filename: defaultFilename, displayName: defaultFilename, sourceKind: "untitled", fileHandle: null,
      lastManualSaveFingerprint: null, lastSuccessfulSave: null, lastOutputDurability: null })
    return Object.freeze({ guardReplacement, recordOutput, manualSave, opened, imported, recovered, reset, get value() { return value },
      subscribe(listener) { listeners.add(listener); listener(value); return () => listeners.delete(listener) } })
  }
  window.CaderactDocumentFileState = Object.freeze({ create, fingerprint, OUTPUT_DURABILITY })
})()
