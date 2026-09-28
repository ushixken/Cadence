// UX13: temporary dialog placement. No preference or document dependencies.
(() => {
  function bind(panel, header) {
    let drag = null
    const bounds = () => ({ width: window.innerWidth || 1024, height: window.innerHeight || 768 })
    function place(x, y) {
      const rect = panel.getBoundingClientRect(), viewport = bounds()
      panel.style.left = `${Math.max(8, Math.min(x, viewport.width - rect.width - 8))}px`
      panel.style.top = `${Math.max(8, Math.min(y, viewport.height - rect.height - 8))}px`
      panel.style.margin = '0'; panel.style.transform = 'none'
    }
    function center() {
      drag = null
      const rect = panel.getBoundingClientRect(), viewport = bounds()
      place((viewport.width - rect.width) / 2, (viewport.height - rect.height) / 2)
    }
    header?.addEventListener('pointerdown', event => {
      if (event.button !== 0 || event.target.closest?.('button,input,select,a')) return
      const rect = panel.getBoundingClientRect()
      drag = { id: event.pointerId, x: event.clientX - rect.left, y: event.clientY - rect.top }
      header.setPointerCapture?.(event.pointerId); event.preventDefault()
    })
    header?.addEventListener('pointermove', event => {
      if (drag?.id === event.pointerId) place(event.clientX - drag.x, event.clientY - drag.y)
    })
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) header?.addEventListener(name, () => { drag = null })
    window.addEventListener('resize', () => {
      if (panel.hidden || (panel.tagName === 'DIALOG' && !panel.open)) return
      const rect = panel.getBoundingClientRect(); place(rect.left, rect.top)
    })
    return Object.freeze({ center })
  }
  window.CaderactFloatingDialog = Object.freeze({ bind })
})()
