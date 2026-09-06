// D6: deterministic renderer utility for backends without a native circle path.
(() => {
  const MIN_SEGMENTS = 24
  const MAX_SEGMENTS = 1024
  const MAX_SAGITTA_PX = 0.25

  function segmentCount(radiusPx) {
    if (!Number.isFinite(radiusPx) || radiusPx <= 0) return 0
    if (radiusPx <= MAX_SAGITTA_PX) return MIN_SEGMENTS
    const angle = Math.acos(Math.max(-1, Math.min(1, 1 - MAX_SAGITTA_PX / radiusPx)))
    if (!Number.isFinite(angle) || angle <= 0) return MAX_SEGMENTS
    return Math.max(MIN_SEGMENTS, Math.min(MAX_SEGMENTS, Math.ceil(Math.PI / angle)))
  }

  function createSegments(circle) {
    const count = segmentCount(circle?.radius)
    if (!count || !Number.isFinite(circle?.center?.x) || !Number.isFinite(circle?.center?.y)) return new Float32Array()
    const segments = new Float32Array(count * 4)
    for (let index = 0; index < count; index++) {
      const first = index * Math.PI * 2 / count, second = (index + 1) * Math.PI * 2 / count
      segments.set([
        circle.center.x + Math.cos(first) * circle.radius, circle.center.y + Math.sin(first) * circle.radius,
        circle.center.x + Math.cos(second) * circle.radius, circle.center.y + Math.sin(second) * circle.radius,
      ], index * 4)
    }
    return segments
  }

  function arcSegmentCount(radiusPx,sweep){
    const full=segmentCount(radiusPx)
    if(!full||!Number.isFinite(sweep)||sweep===0||Math.abs(sweep)>=Math.PI*2)return 0
    return Math.max(1,Math.min(MAX_SEGMENTS,Math.ceil(full*Math.abs(sweep)/(Math.PI*2))))
  }
  function createArcSegments(arc){
    const count=arcSegmentCount(arc?.radius,arc?.sweep)
    if(!count||!Number.isFinite(arc?.center?.x)||!Number.isFinite(arc?.center?.y)||!Number.isFinite(arc?.startAngle))return new Float32Array()
    const segments=new Float32Array(count*4)
    for(let index=0;index<count;index++){
      const first=arc.startAngle+arc.sweep*index/count,second=arc.startAngle+arc.sweep*(index+1)/count
      segments.set([arc.center.x+Math.cos(first)*arc.radius,arc.center.y+Math.sin(first)*arc.radius,
        arc.center.x+Math.cos(second)*arc.radius,arc.center.y+Math.sin(second)*arc.radius],index*4)
    }
    return segments
  }

  window.CaderactCircleTessellation = Object.freeze({ createSegments, segmentCount, createArcSegments, arcSegmentCount, MIN_SEGMENTS, MAX_SEGMENTS, MAX_SAGITTA_PX })
})()
