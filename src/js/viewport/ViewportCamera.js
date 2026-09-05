(() => {
  function createCamera(initialZoom) {
    const state = { panX: 0, panY: 0, zoom: initialZoom }

    function worldToScreen(x, y) {
      return { x: state.panX + x * state.zoom, y: state.panY - y * state.zoom }
    }

    function screenToWorld(x, y) {
      return { x: (x - state.panX) / state.zoom, y: (state.panY - y) / state.zoom }
    }

    function zoomAtScreenPoint(zoom, x, y) {
      if (!Number.isFinite(zoom) || zoom <= 0) return
      const point = screenToWorld(x, y)
      state.zoom = zoom
      state.panX = x - point.x * zoom
      state.panY = y + point.y * zoom
    }

    return Object.freeze({ state, worldToScreen, screenToWorld, zoomAtScreenPoint })
  }

  window.CaderactViewportCamera = Object.freeze({ createCamera })
})()
