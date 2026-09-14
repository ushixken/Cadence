class WebGPURenderer extends window.CaderactRenderer {
  constructor(canvas, adapter, device, context, format, onDeviceLost) {
    super()
    this.canvas = canvas
    this.kind = "webgpu"
    this.adapter = adapter
    this.device = device
    this.context = context
    this.format = format
    this.vertexBuffer = null
    this.vertexCapacity = 0
    this.uniformBuffer = device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    this.pipeline = this.createPipeline("line-list")
    this.trianglePipeline=this.createPipeline("triangle-list")
    this.bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    })
    this.triangleBindGroup=device.createBindGroup({layout:this.trianglePipeline.getBindGroupLayout(0),entries:[{binding:0,resource:{buffer:this.uniformBuffer}}]})
    device.lost.then(onDeviceLost, onDeviceLost).catch(error => {
      console.warn("Caderact renderer recovery callback failed", error)
    })
  }

  createPipeline(topology) {
    const shader = this.device.createShaderModule({
      code: `struct Viewport { size: vec2f, _padding: vec2f };
@group(0) @binding(0) var<uniform> viewport: Viewport;
struct VertexInput { @location(0) position: vec2f, @location(1) color: vec4f };
struct VertexOutput { @builtin(position) position: vec4f, @location(0) color: vec4f };
@vertex fn vertexMain(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = vec4f((input.position.x / viewport.size.x) * 2.0 - 1.0, 1.0 - (input.position.y / viewport.size.y) * 2.0, 0.0, 1.0);
  output.color = input.color;
  return output;
}
@fragment fn fragmentMain(input: VertexOutput) -> @location(0) vec4f { return input.color; }`,
    })
    return this.device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: shader,
        entryPoint: "vertexMain",
        buffers: [{ arrayStride: 24, attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x2" },
          { shaderLocation: 1, offset: 8, format: "float32x4" },
        ] }],
      },
      fragment: {
        module: shader,
        entryPoint: "fragmentMain",
        targets: [{ format: this.format, blend: {
          color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
          alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" },
        } }],
      },
      primitive: { topology },
    })
  }

  resize(width, height, deviceScale) {
    this.canvas.width = Math.max(1, Math.round(width * deviceScale))
    this.canvas.height = Math.max(1, Math.round(height * deviceScale))
    this.context.configure({ device: this.device, format: this.format, alphaMode: "opaque" })
  }

  render(scene) {
    const drawGroups = scene.drawGroups || scene.lineGroups.map(lineGroup => ({ lineGroup, circleGroup: null }))
    const batches = []
    let vertexCount = 0
    for (const { lineGroup, circleGroup, arcGroup, ellipseGroup } of drawGroups) {
      const prepare=segments=>window.CaderactStrokeStyle.expandSegments(window.CaderactStrokeStyle.dashSegments(segments,lineGroup.dashPattern),lineGroup.lineWidth||1)
      const lineSegments=prepare(lineGroup.segments)
      batches.push({ segments: lineSegments, color: lineGroup.colorData })
      vertexCount += (lineSegments.length / 4) * 2
      for (const circle of circleGroup?.circles || []) {
        const segments = prepare(window.CaderactCircleTessellation.createSegments(circle))
        batches.push({ segments, color: circleGroup.colorData })
        vertexCount += (segments.length / 4) * 2
      }
      for(const arc of arcGroup?.arcs||[]){
        const segments=prepare(window.CaderactCircleTessellation.createArcSegments(arc))
        batches.push({segments,color:arcGroup.colorData});vertexCount+=(segments.length/4)*2
      }
      for(const ellipse of ellipseGroup?.ellipses||[]){
        const segments=prepare(window.CaderactEllipseTessellation.createSegments(ellipse))
        batches.push({segments,color:ellipseGroup.colorData});vertexCount+=(segments.length/4)*2
      }
    }
    const triangles=(scene.triangleGroups||[]).flatMap(group=>group.triangles||[]),triangleVertexCount=triangles.length*3
    const data = new Float32Array((vertexCount+triangleVertexCount) * 6)
    let offset = 0
    for (const batch of batches) {
      for (let index = 0; index < batch.segments.length; index += 4) {
        data.set([batch.segments[index], batch.segments[index + 1], ...batch.color,
          batch.segments[index + 2], batch.segments[index + 3], ...batch.color], offset)
        offset += 12
      }
    }
    for(const triangle of triangles)for(const point of triangle.points){data.set([point.x,point.y,...triangle.colorData],offset);offset+=6}
    const bytes = Math.max(24, data.byteLength)
    if (bytes > this.vertexCapacity) {
      this.vertexBuffer?.destroy()
      this.vertexBuffer = this.device.createBuffer({ usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, size: bytes })
      this.vertexCapacity = bytes
    }
    if (data.byteLength) this.device.queue.writeBuffer(this.vertexBuffer, 0, data)
    this.device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array([scene.width, scene.height, 0, 0]))
    const encoder = this.device.createCommandEncoder()
    const pass = encoder.beginRenderPass({ colorAttachments: [{ view: this.context.getCurrentTexture().createView(), clearValue: scene.backgroundColorData, loadOp: "clear", storeOp: "store" }] })
    pass.setPipeline(this.pipeline)
    pass.setBindGroup(0, this.bindGroup)
    if (vertexCount) {
      pass.setVertexBuffer(0, this.vertexBuffer)
      pass.draw(vertexCount)
    }
    if(triangleVertexCount){pass.setPipeline(this.trianglePipeline);pass.setBindGroup(0,this.triangleBindGroup);pass.setVertexBuffer(0,this.vertexBuffer);pass.draw(triangleVertexCount,1,vertexCount)}
    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  destroy() {
    this.vertexBuffer?.destroy()
    this.uniformBuffer?.destroy()
    this.context.unconfigure?.()
    this.device.destroy?.()
  }
}

window.CaderactWebGPURenderer = WebGPURenderer
