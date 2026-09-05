// U3: single application owner for the active authoritative document store.
(() => {
  function createSession(initialStore = window.CaderactDocument.createStore()) {
    let store = initialStore
    const listeners = new Set()

    function replaceStore(nextStore, details = {}) {
      if (!nextStore?.reader || !nextStore?.controller || !nextStore?.recordGateway) {
        return Object.freeze({ status: "invalid-store" })
      }
      const previousStore = store
      store = nextStore
      window.caderactDocument = store.reader
      const outcome = Object.freeze({ status: "document-replaced", previousStore, store, ...details })
      for (const listener of listeners) {
        try { listener(outcome) } catch (error) { console.warn("Caderact document-session observer failed", error) }
      }
      return outcome
    }
    function subscribe(listener) {
      if (typeof listener !== "function") throw new Error("Document-session listener must be a function")
      listeners.add(listener)
      return () => listeners.delete(listener)
    }

    window.caderactDocument = store.reader
    return Object.freeze({
      replaceStore, subscribe,
      get store() { return store },
      get reader() { return store.reader },
      get controller() { return store.controller },
      get recordGateway() { return store.recordGateway },
      get layerGateway() { return store.layerGateway },
      get unitGateway() { return store.unitGateway },
    })
  }

  window.CaderactDocumentSession = Object.freeze({ createSession })
})()
