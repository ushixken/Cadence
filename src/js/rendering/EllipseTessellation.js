// D9: bounded adaptive screen-space Ellipse tessellation shared by rendering and hit testing.
(() => {
  const MAX_ERROR_PX = 0.25, MAX_DEPTH = 12, MAX_SEGMENTS = 4096
  function pointAt(ellipse, angle) {
    const cosine = Math.cos(angle), sine = Math.sin(angle), rotation = ellipse.rotation || 0
    const cr = Math.cos(rotation), sr = Math.sin(rotation)
    return { x: ellipse.center.x + ellipse.radiusX*cosine*cr - ellipse.radiusY*sine*sr,
      y: ellipse.center.y + ellipse.radiusX*cosine*sr + ellipse.radiusY*sine*cr }
  }
  function createSegments(ellipse, maxErrorPx = MAX_ERROR_PX) {
    if (![ellipse?.center?.x, ellipse?.center?.y, ellipse?.radiusX, ellipse?.radiusY, ellipse?.rotation || 0, maxErrorPx].every(Number.isFinite)
        || ellipse.radiusX <= 0 || ellipse.radiusY <= 0 || maxErrorPx <= 0) return new Float32Array()
    const output = []
    function subdivide(a0, p0, a1, p1, depth) {
      const am = (a0+a1)/2, pm = pointAt(ellipse, am)
      const chordMidX=(p0.x+p1.x)/2, chordMidY=(p0.y+p1.y)/2
      if (depth < MAX_DEPTH && output.length/4 < MAX_SEGMENTS-1 && Math.hypot(pm.x-chordMidX,pm.y-chordMidY)>maxErrorPx) {
        subdivide(a0,p0,am,pm,depth+1); subdivide(am,pm,a1,p1,depth+1)
      } else output.push(p0.x,p0.y,p1.x,p1.y)
    }
    for(let quadrant=0;quadrant<4;quadrant++){
      const a0=quadrant*Math.PI/2,a1=(quadrant+1)*Math.PI/2
      subdivide(a0,pointAt(ellipse,a0),a1,pointAt(ellipse,a1),0)
    }
    return new Float32Array(output)
  }
  window.CaderactEllipseTessellation = Object.freeze({ createSegments, pointAt, MAX_ERROR_PX, MAX_DEPTH, MAX_SEGMENTS })
})()
