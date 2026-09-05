async function createCaderactRenderer(canvas) {
  const fallback = () => {
    console.info("Caderact renderer: Canvas2D fallback")
    return new window.CaderactCanvas2DRenderer(canvas)
  }
  if (!navigator.gpu) return fallback()
  try {
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) throw new Error("No WebGPU adapter available")
    const device = await adapter.requestDevice()
    const context = canvas.getContext("webgpu")
    if (!context) throw new Error("WebGPU canvas context unavailable")
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
    return fallback()
  }
}

window.createCaderactRenderer = createCaderactRenderer
