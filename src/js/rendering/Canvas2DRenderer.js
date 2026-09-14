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

    const drawGroups = scene.drawGroups || scene.lineGroups.map(lineGroup => ({ lineGroup, circleGroup: null }))
    for (const { lineGroup, circleGroup, arcGroup, ellipseGroup } of drawGroups) {
      context.setLineDash?.(Array.from(lineGroup.dashPattern || []))
      context.lineDashOffset = 0
      if (lineGroup.segments.length > 0) {
        context.beginPath()
        context.strokeStyle = lineGroup.color
        context.lineWidth = lineGroup.lineWidth / scene.deviceScale
        for (let index = 0; index < lineGroup.segments.length; index += 4) {
          context.moveTo(lineGroup.segments[index], lineGroup.segments[index + 1])
          context.lineTo(lineGroup.segments[index + 2], lineGroup.segments[index + 3])
        }
        context.stroke()
      }
      if (circleGroup?.circles.length > 0) {
        context.beginPath()
        context.strokeStyle = circleGroup.color
        context.lineWidth = circleGroup.lineWidth / scene.deviceScale
        for (const circle of circleGroup.circles) {
          context.moveTo(circle.center.x + circle.radius, circle.center.y)
          context.arc(circle.center.x, circle.center.y, circle.radius, 0, Math.PI * 2)
        }
        context.stroke()
      }
      if(arcGroup?.arcs.length>0){
        context.beginPath();context.strokeStyle=arcGroup.color;context.lineWidth=arcGroup.lineWidth/scene.deviceScale
        for(const arc of arcGroup.arcs){
          const end=arc.startAngle+arc.sweep
          context.moveTo(arc.center.x+Math.cos(arc.startAngle)*arc.radius,arc.center.y+Math.sin(arc.startAngle)*arc.radius)
          context.arc(arc.center.x,arc.center.y,arc.radius,arc.startAngle,end,arc.sweep<0)
        }
        context.stroke()
      }
      if(ellipseGroup?.ellipses.length>0){
        context.beginPath();context.strokeStyle=ellipseGroup.color;context.lineWidth=ellipseGroup.lineWidth/scene.deviceScale
        for(const ellipse of ellipseGroup.ellipses){
          context.moveTo(ellipse.center.x+Math.cos(ellipse.rotation)*ellipse.radiusX,ellipse.center.y+Math.sin(ellipse.rotation)*ellipse.radiusX)
          context.ellipse(ellipse.center.x,ellipse.center.y,ellipse.radiusX,ellipse.radiusY,ellipse.rotation,0,Math.PI*2)
        }
        context.stroke()
      }
    }
    context.setLineDash?.([])
    context.lineDashOffset = 0
    context.lineWidth = 1
  }
}

window.CaderactCanvas2DRenderer = Canvas2DRenderer
