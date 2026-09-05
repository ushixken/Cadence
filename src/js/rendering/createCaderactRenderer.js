async function createCaderactRenderer(canvas, { preferCanvas2D = false, replaceCanvasForFallback } = {}) {
  const fallback = (fallbackCanvas = canvas) => {
    console.info("Caderact renderer: Canvas2D fallback")
    return new window.CaderactCanvas2DRenderer(fallbackCanvas)
  }
  if (preferCanvas2D || !navigator.gpu) return fallback()
  let acquiredWebGPUContext = false
  try {
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) throw new Error("No WebGPU adapter available")
    const device = await adapter.requestDevice()
    const context = canvas.getContext("webgpu")
    if (!context) throw new Error("WebGPU canvas context unavailable")
    acquiredWebGPUContext = true
    const format = navigator.gpu.getPreferredCanvasFormat()
    let renderer
    renderer = new window.CaderactWebGPURenderer(canvas, adapter, device, context, format, () => {
      console.warn("Caderact WebGPU device lost; attempting renderer recovery")
      renderer.onDeviceLost?.()
    })
    renderer.resize(
      canvas.clientWidth,
      canvas.clientHeight,
      window.devicePixelRatio || 1,
    )
    console.info("Caderact renderer: WebGPU")
    return renderer
  } catch (error) {
    console.warn("Caderact WebGPU unavailable; using Canvas2D fallback", error)
    const fallbackCanvas = acquiredWebGPUContext && replaceCanvasForFallback
      ? replaceCanvasForFallback(canvas)
      : canvas
    return fallback(fallbackCanvas)
  }
}

window.createCaderactRenderer = createCaderactRenderer
