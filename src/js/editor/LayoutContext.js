// PS1: editor-owned Model/Layout context. Layout definitions remain document-owned.
(() => {
  function create({ session, onChange = () => {} }) {
    let context = Object.freeze({ kind: "model", layoutId: null })
    const listeners = new Set()
    let unsubscribeHistory = null
    const snapshot = () => context
    function notify(reason) { onChange(context, reason); for (const listener of listeners) listener(context, reason) }
    function validLayout(id) { return Boolean(id && session.reader.layout(id)) }
    function reconcile(reason = "document-change") {
      if (context.kind === "layout" && !validLayout(context.layoutId)) {
        context = Object.freeze({ kind: "model", layoutId: null }); notify(reason); return true
      }
      return false
    }
    function bind() { unsubscribeHistory?.(); unsubscribeHistory = session.controller.subscribeHistory(() => reconcile("history")) }
    function switchToModel() {
      if (context.kind === "model") return Object.freeze({ status: "no-op", context })
      if (window.caderactCommandRouter?.isActive) return Object.freeze({ status: "command-active" })
      context = Object.freeze({ kind: "model", layoutId: null }); notify("switch"); return Object.freeze({ status: "context-switched", context })
    }
    function switchToLayout(layoutId) {
      if (!validLayout(layoutId)) return Object.freeze({ status: "unknown-layout", layoutId })
      if (context.kind === "layout" && context.layoutId === layoutId) return Object.freeze({ status: "no-op", context })
      if (window.caderactCommandRouter?.isActive) return Object.freeze({ status: "command-active" })
      context = Object.freeze({ kind: "layout", layoutId }); notify("switch"); return Object.freeze({ status: "context-switched", context })
    }
    function subscribe(listener) { listeners.add(listener); listener(context, "subscribe"); return () => listeners.delete(listener) }
    session.subscribe(() => { context = Object.freeze({ kind: "model", layoutId: null }); bind(); notify("document-replaced") })
    bind()
    return Object.freeze({ snapshot, switchToModel, switchToLayout, reconcile, subscribe, get isModel() { return context.kind === "model" } })
  }
  window.CaderactLayoutContext = Object.freeze({ create })
})()
