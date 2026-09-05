class WebGPURenderer extends window.CaderactRenderer {
  constructor(canvas, adapter, device, context, format, onDeviceLost) {
    super()
    this.canvas = canvas
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
    this.pipeline = this.createPipeline()
    this.bindGroup = device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    })
    device.lost.then(() => onDeviceLost())
  }

  createPipeline() {
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
      primitive: { topology: "line-list" },
    })
  }

  resize(width, height, deviceScale) {
    this.canvas.width = Math.max(1, Math.round(width * deviceScale))
    this.canvas.height = Math.max(1, Math.round(height * deviceScale))
    this.context.configure({ device: this.device, format: this.format, alphaMode: "opaque" })
  }

  render(scene) {
    let vertexCount = 0
    for (const group of scene.lineGroups) vertexCount += (group.segments.length / 4) * 2
    const data = new Float32Array(vertexCount * 6)
    let offset = 0
    for (const group of scene.lineGroups) {
      const color = group.colorData
      for (let index = 0; index < group.segments.length; index += 4) {
        data.set([group.segments[index], group.segments[index + 1], ...color, group.segments[index + 2], group.segments[index + 3], ...color], offset)
        offset += 12
      }
    }
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
    pass.end()
    this.device.queue.submit([encoder.finish()])
  }
}

window.CaderactWebGPURenderer = WebGPURenderer
