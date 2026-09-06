(() => {
  const MODES = new Set(["select", "point"])

  function createController({ host }) {
    if (!host) throw new Error("CAD interaction visuals require a viewport host")
    const root = document.createElement("div")
    root.classList.add("cad-cursor-overlay")
    root.setAttribute("aria-hidden", "true")
    for (const names of [
      ["cad-cursor-arm", "is-left"], ["cad-cursor-arm", "is-right"],
      ["cad-cursor-arm", "is-top"], ["cad-cursor-arm", "is-bottom"],
      ["cad-cursor-pickbox"], ["cad-cursor-center"],
    ]) {
      const part = document.createElement("span")
      for (const name of names) part.classList.add(name)
      root.appendChild(part)
    }
    host.appendChild(root)
    host.classList.add("cad-cursor-enabled")

    let visible = false, available = true, navigating = false, snapAcquired = false
    let mode = "select", x = 0, y = 0
    function refresh() {
      root.classList.toggle("is-visible", visible && available && !navigating)
      root.classList.toggle("is-snap-acquired", snapAcquired)
      root.classList.toggle("is-point-command", mode === "point")
      root.setAttribute("data-cursor-mode", mode)
      host.classList.toggle("cad-cursor-enabled", available)
    }
    function move(point) {
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return
      x = point.x; y = point.y; visible = true
      root.style.left = `${x}px`
      root.style.top = `${y}px`
      refresh()
    }
    function leave() { visible = false; snapAcquired = false; refresh() }
    function setMode(value) { mode = MODES.has(value) ? value : "select"; refresh() }
    function setSnapAcquired(value) { snapAcquired = Boolean(value); refresh() }
    function setNavigating(value) { navigating = Boolean(value); refresh() }
    function setAvailable(value) { available = Boolean(value); if (!available) visible = false; refresh() }
    function snapshot() { return Object.freeze({ visible: visible && available && !navigating, x, y, mode, snapAcquired, available, navigating }) }
    refresh()
    return Object.freeze({ move, leave, setMode, setSnapAcquired, setNavigating, setAvailable, snapshot, element: root })
  }
  window.CaderactInteractionVisuals = Object.freeze({ createController })
})()
