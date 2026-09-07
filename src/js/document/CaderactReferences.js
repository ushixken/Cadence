// A10: stable document object/feature reference values and current-state resolution.
(() => {
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value)
  const hasText = value => typeof value === "string" && value.trim() !== ""
  const keysMatch = (value, expected) => {
    const keys = Object.keys(value).sort()
    return keys.length === expected.length && keys.every((key, index) => key === expected[index])
  }

  function isReference(reference) {
    if (!isRecord(reference)) return false
    if (reference.kind === "object") {
      return keysMatch(reference, ["kind", "recordId"]) && hasText(reference.recordId)
    }
    if (reference.kind === "feature") {
      return keysMatch(reference, ["featureId", "kind", "recordId"]) && hasText(reference.recordId) && hasText(reference.featureId)
    }
    return false
  }
  function createObjectReference(recordId) {
    const reference = { kind: "object", recordId }
    if (!isReference(reference)) throw new Error("Invalid object reference ID")
    return Object.freeze(reference)
  }
  function createEndpointReference(recordId, featureId) {
    const reference = { kind: "feature", recordId, featureId }
    if (!isReference(reference)) throw new Error("Invalid endpoint reference IDs")
    return Object.freeze(reference)
  }
  function result(status, details = {}) { return Object.freeze({ status, ...details }) }
  function createResolver(reader) {
    if (!reader || typeof reader.snapshot !== "function") throw new Error("Reference resolver requires a document reader")
    function resolve(reference) {
      if (!isReference(reference)) return result("invalid-reference")
      const objects = reader.snapshot().geometry.objects
      if (!Object.hasOwn(objects, reference.recordId)) return result("unresolved", { reason: "missing-record" })
      const record = objects[reference.recordId]
      if (reference.kind === "object") return result("resolved", { kind: "object", record })
      if(record.type==="polyline"){
        const index=record.vertices.findIndex(vertex=>vertex.featureId===reference.featureId)
        return index>=0?result("resolved",{kind:"feature",role:"vertex",index,record,feature:record.vertices[index]}):result("unresolved",{reason:"feature-not-in-record"})
      }
      if (record.type !== "line" && record.type !== "arc") return result("unresolved", { reason: "unsupported-record-type" })
      if (record.start.featureId === reference.featureId) {
        return result("resolved", { kind: "feature", role: "start", record, feature: record.start })
      }
      if (record.end.featureId === reference.featureId) {
        return result("resolved", { kind: "feature", role: "end", record, feature: record.end })
      }
      return result("unresolved", { reason: "feature-not-in-record" })
    }
    return Object.freeze({ resolve })
  }

  window.CaderactReferences = Object.freeze({
    isReference, createObjectReference, createEndpointReference, createResolver,
  })
})()
