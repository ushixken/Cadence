(() => {
  function bindViewportNavigation({ canvas, camera, viewportSettings, getCanvasPoint, requestRender, onStateChange = () => {} }) {
    let isSpacePressed = false
    let navigationMode = null
    let activePointerId = null
    let previousPointerX = 0, previousPointerY = 0, zoomAnchorX = 0, zoomAnchorY = 0

    function publishState() { onStateChange(Object.freeze({ navigationMode, isSpacePressed })) }

    function stopNavigation(event) {
      if (event && activePointerId !== null && event.pointerId !== activePointerId) return
      navigationMode = null
      activePointerId = null
      canvas.classList.remove("is-navigating")
      publishState()
    }

    function onPointerDown(event) {
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
      publishState()
      event.preventDefault()
    }

    function onPointerMove(event) {
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
    }

    function onWheel(event) {
      const point = getCanvasPoint(event)
      camera.zoomAtScreenPoint(
        camera.state.zoom * Math.exp(-event.deltaY * viewportSettings.wheelZoomSensitivity),
        point.x,
        point.y,
      )
      requestRender()
      event.preventDefault()
    }

    const onPointerEnter = () => canvas.classList.add("is-hovered")
    const onPointerLeave = () => canvas.classList.remove("is-hovered")

    function onKeyDown(event) {
      if (event.code !== "Space" || !canvas.classList.contains("is-hovered")) return
      isSpacePressed = true
      canvas.classList.add("is-navigation-ready")
      publishState()
      event.preventDefault()
    }

    function onKeyUp(event) {
      if (event.code !== "Space") return
      isSpacePressed = false
      canvas.classList.remove("is-navigation-ready")
      stopNavigation()
    }

    function onBlur() {
      isSpacePressed = false
      canvas.classList.remove("is-navigation-ready")
      stopNavigation()
    }

    canvas.addEventListener("pointerdown", onPointerDown)
    canvas.addEventListener("pointermove", onPointerMove)
    canvas.addEventListener("pointerup", stopNavigation)
    canvas.addEventListener("pointercancel", stopNavigation)
    canvas.addEventListener("lostpointercapture", stopNavigation)
    canvas.addEventListener("wheel", onWheel, { passive: false })
    canvas.addEventListener("pointerenter", onPointerEnter)
    canvas.addEventListener("pointerleave", onPointerLeave)
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("keyup", onKeyUp)
    window.addEventListener("blur", onBlur)

    function dispose() {
      stopNavigation()
      canvas.removeEventListener("pointerdown", onPointerDown)
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerup", stopNavigation)
      canvas.removeEventListener("pointercancel", stopNavigation)
      canvas.removeEventListener("lostpointercapture", stopNavigation)
      canvas.removeEventListener("wheel", onWheel)
      canvas.removeEventListener("pointerenter", onPointerEnter)
      canvas.removeEventListener("pointerleave", onPointerLeave)
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("keyup", onKeyUp)
      window.removeEventListener("blur", onBlur)
    }

    return Object.freeze({
      isActive: () => navigationMode !== null,
      getMode: () => navigationMode,
      dispose,
    })
  }

  window.CaderactViewportNavigation = Object.freeze({ bindViewportNavigation })
})()
