class Canvas2DRenderer extends window.CaderactRenderer {
  constructor(canvas) {
    super()
    this.canvas = canvas
    this.context = canvas.getContext("2d")
    if (!this.context) throw new Error("Canvas2D canvas context unavailable")
    this.kind = "canvas2d"
  }

  resize(width, height, deviceScale) {
    this.canvas.width = Math.max(1, Math.round(width * deviceScale))
    this.canvas.height = Math.max(1, Math.round(height * deviceScale))
  }

  render(scene) {
    const { context } = this
    context.setTransform(scene.deviceScale, 0, 0, scene.deviceScale, 0, 0)
    context.fillStyle = scene.backgroundColor
    context.fillRect(0, 0, scene.width, scene.height)

    for (const group of scene.lineGroups) {
      if (group.segments.length === 0) continue
      context.beginPath()
      context.strokeStyle = group.color
      context.lineWidth = group.lineWidth / scene.deviceScale
      for (let index = 0; index < group.segments.length; index += 4) {
        context.moveTo(group.segments[index], group.segments[index + 1])
        context.lineTo(group.segments[index + 2], group.segments[index + 3])
      }
      context.stroke()
    }
  }
}

window.CaderactCanvas2DRenderer = Canvas2DRenderer
