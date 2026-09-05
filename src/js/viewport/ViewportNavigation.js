(() => {
  function bindViewportNavigation({ canvas, camera, viewportSettings, getCanvasPoint, requestRender }) {
    let isSpacePressed = false
    let navigationMode = null
    let activePointerId = null
    let previousPointerX = 0, previousPointerY = 0, zoomAnchorX = 0, zoomAnchorY = 0

    function stopNavigation(event) {
      if (event && activePointerId !== null && event.pointerId !== activePointerId) return
      navigationMode = null
      activePointerId = null
      canvas.classList.remove("is-navigating")
    }

    canvas.addEventListener("pointerdown", (event) => {
      const isSpaceDrag = event.button === 0 && isSpacePressed
      const isMiddleMouseDrag = event.button === 1
      if (!isSpaceDrag && !isMiddleMouseDrag) return
      const point = getCanvasPoint(event)
      navigationMode = event.ctrlKey ? "zoom" : "pan"
      activePointerId = event.pointerId
      previousPointerX = point.x
      previousPointerY = point.y
      zoomAnchorX = point.x
      zoomAnchorY = point.y
      canvas.setPointerCapture(event.pointerId)
      canvas.classList.add("is-navigating")
      event.preventDefault()
    })

    canvas.addEventListener("pointermove", (event) => {
      if (event.pointerId !== activePointerId || navigationMode === null) return
      const point = getCanvasPoint(event)
      if (navigationMode === "pan") {
        camera.state.panX += point.x - previousPointerX
        camera.state.panY += point.y - previousPointerY
      } else {
        camera.zoomAtScreenPoint(
          camera.state.zoom * Math.exp((point.x - previousPointerX) * viewportSettings.dragZoomSensitivity),
          zoomAnchorX,
          zoomAnchorY,
        )
      }
      previousPointerX = point.x
      previousPointerY = point.y
      requestRender()
      event.preventDefault()
    })

    canvas.addEventListener("pointerup", stopNavigation)
    canvas.addEventListener("pointercancel", stopNavigation)
    canvas.addEventListener("lostpointercapture", stopNavigation)

    canvas.addEventListener("wheel", (event) => {
      const point = getCanvasPoint(event)
      camera.zoomAtScreenPoint(
        camera.state.zoom * Math.exp(-event.deltaY * viewportSettings.wheelZoomSensitivity),
        point.x,
        point.y,
      )
      requestRender()
      event.preventDefault()
    }, { passive: false })

    canvas.addEventListener("pointerenter", () => canvas.classList.add("is-hovered"))
    canvas.addEventListener("pointerleave", () => canvas.classList.remove("is-hovered"))

    window.addEventListener("keydown", (event) => {
      if (event.code !== "Space" || !canvas.classList.contains("is-hovered")) return
      isSpacePressed = true
      canvas.classList.add("is-navigation-ready")
      event.preventDefault()
    })

    window.addEventListener("keyup", (event) => {
      if (event.code !== "Space") return
      isSpacePressed = false
      canvas.classList.remove("is-navigation-ready")
      stopNavigation()
    })

    window.addEventListener("blur", () => {
      isSpacePressed = false
      canvas.classList.remove("is-navigation-ready")
      stopNavigation()
    })

    return Object.freeze({
      isActive: () => navigationMode !== null,
      getMode: () => navigationMode,
    })
  }

  window.CaderactViewportNavigation = Object.freeze({ bindViewportNavigation })
})()
