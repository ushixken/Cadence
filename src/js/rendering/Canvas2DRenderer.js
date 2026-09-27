class Canvas2DRenderer extends window.CaderactRenderer {
  constructor(canvas) {
    super()
    this.canvas = canvas
    this.context = canvas.getContext("2d")
    if (!this.context) throw new Error("Canvas2D canvas context unavailable")
    this.kind = "canvas2d"
    this.supportsWorldGeometry = true
  }

  resize(width, height, deviceScale) {
    this.canvas.width = Math.max(1, Math.round(width * deviceScale))
    this.canvas.height = Math.max(1, Math.round(height * deviceScale))
  }

  render(scene) {
    const { context } = this
    const screenTransform=()=>context.setTransform(scene.deviceScale,0,0,scene.deviceScale,0,0)
    screenTransform()
    context.fillStyle = scene.backgroundColor
    context.fillRect(0, 0, scene.width, scene.height)

    const drawTriangles=groups=>{for(const group of groups)for(const triangle of group.triangles||[]){const [a,b,c]=triangle.points;context.beginPath();context.moveTo(a.x,a.y);context.lineTo(b.x,b.y);context.lineTo(c.x,c.y);context.closePath?.();context.fillStyle=triangle.color;context.fill()}}
    const drawGroups=(groups,{world=false}={})=>{const scale=world?Math.max(Number.EPSILON,Math.abs(scene.cameraTransform.zoom)):1
    for (const { lineGroup, circleGroup, arcGroup, ellipseGroup } of groups) {
      context.setLineDash?.(Array.from(lineGroup.dashPattern || [],value=>value/scale))
      context.lineDashOffset = 0
      if (lineGroup.segments.length > 0) {
        context.beginPath()
        context.strokeStyle = lineGroup.color
        context.lineWidth = lineGroup.lineWidth / scene.deviceScale / scale
        for (let index = 0; index < lineGroup.segments.length; index += 4) {
          context.moveTo(lineGroup.segments[index], lineGroup.segments[index + 1])
          context.lineTo(lineGroup.segments[index + 2], lineGroup.segments[index + 3])
        }
        context.stroke()
      }
      if (circleGroup?.circles.length > 0) {
        context.beginPath()
        context.strokeStyle = circleGroup.color
        context.lineWidth = circleGroup.lineWidth / scene.deviceScale / scale
        for (const circle of circleGroup.circles) {
          context.moveTo(circle.center.x + circle.radius, circle.center.y)
          context.arc(circle.center.x, circle.center.y, circle.radius, 0, Math.PI * 2)
        }
        context.stroke()
      }
      if(arcGroup?.arcs.length>0){
        context.beginPath();context.strokeStyle=arcGroup.color;context.lineWidth=arcGroup.lineWidth/scene.deviceScale/scale
        for(const arc of arcGroup.arcs){
          const end=arc.startAngle+arc.sweep
          context.moveTo(arc.center.x+Math.cos(arc.startAngle)*arc.radius,arc.center.y+Math.sin(arc.startAngle)*arc.radius)
          context.arc(arc.center.x,arc.center.y,arc.radius,arc.startAngle,end,arc.sweep<0)
        }
        context.stroke()
      }
      if(ellipseGroup?.ellipses.length>0){
        context.beginPath();context.strokeStyle=ellipseGroup.color;context.lineWidth=ellipseGroup.lineWidth/scene.deviceScale/scale
        for(const ellipse of ellipseGroup.ellipses){
          context.moveTo(ellipse.center.x+Math.cos(ellipse.rotation)*ellipse.radiusX,ellipse.center.y+Math.sin(ellipse.rotation)*ellipse.radiusX)
          context.ellipse(ellipse.center.x,ellipse.center.y,ellipse.radiusX,ellipse.radiusY,ellipse.rotation,0,Math.PI*2)
        }
        context.stroke()
      }
    }}
    if(scene.worldGeometry){const transform=scene.cameraTransform,scale=scene.deviceScale*transform.zoom;context.setTransform(scale,0,0,scale,scene.deviceScale*transform.panX,scene.deviceScale*transform.panY);drawTriangles(scene.worldGeometry.triangleGroups||[]);drawGroups(scene.worldGeometry.drawGroups||[],{world:true});screenTransform()}
    drawTriangles((scene.triangleGroups||[]).filter(group=>group.role==="solid-hatch"||group.role==="paper"))
    const screenGroups = scene.drawGroups || scene.lineGroups.map(lineGroup => ({ lineGroup, circleGroup: null }))
    drawGroups(screenGroups)
    drawTriangles((scene.triangleGroups||[]).filter(group=>group.role!=="solid-hatch"&&group.role!=="paper"))
    context.setLineDash?.([])
    context.lineDashOffset = 0
    context.lineWidth = 1
  }
}

window.CaderactCanvas2DRenderer = Canvas2DRenderer
