// R2: renderer-neutral native Region topology and source-boundary adaptation.
(() => {
  const point = value => ({ x: value.x, y: value.y })
  function sourceLoops(records) {
    const result = [];let chain=[]
    for (const record of records || []) {
      if (record?.type === "polyline") {
        if (!record.closed) throw new Error("Polyline boundary must be closed")
        const adapted=window.CaderactBoundaryGeometry.adaptClosedPolyline(record);if(!adapted.valid)throw new Error(adapted.reason);result.push(adapted.edges)
      } else if (record?.type === "circle") result.push([{ kind:"circle", center:point(record.center), radius:record.radius }])
      else if (record?.type === "ellipse") result.push([{ kind:"ellipse", center:point(record.center), majorAxis:point(record.majorAxis), minorRadius:record.minorRadius }])
      else if (record?.type === "line" || record?.type === "arc") {const adapted=window.CaderactBoundaryGeometry.adaptEdge(record);if(!adapted.valid)throw new Error(adapted.reason);chain.push(adapted.edge);const first=chain[0].start,last=chain.at(-1).end;if(first.x===last.x&&first.y===last.y){result.push(chain);chain=[]}}
      else throw new Error(`Unsupported Region source: ${record?.type || "unknown"}`)
    }
    if (chain.length) result.push(chain)
    if (!result.length) throw new Error("Select closed boundary geometry")
    return result
  }
  function canonicalizeSources(records) {
    const nesting=window.CaderactBoundaryGeometry.classifyNesting(sourceLoops(records))
    if (!nesting.valid) throw new Error(nesting.reason || "Invalid Region boundary")
    return nesting.entries.map(entry=>({depth:entry.depth,parentIndex:entry.parentIndex,edges:entry.loop.edges}))
  }
  function plainLoop(loop){return {kind:"boundary-loop",edges:loop.edges.map(edge=>{const copy={kind:edge.kind};for(const key of ["start","end","center","majorAxis"])if(edge[key])copy[key]=point(edge[key]);for(const key of ["radius","minorRadius","sweep","clockwise"])if(edge[key]!==undefined)copy[key]=edge[key];return copy})}}
  function validate(record) {
    if (!Array.isArray(record?.loops) || !record.loops.length) return ["Region: loops must be non-empty"]
    const nesting=window.CaderactBoundaryGeometry.classifyNesting(record.loops.map(plainLoop))
    if (!nesting.valid) return [`Region: ${nesting.reason}`]
    for(let i=0;i<record.loops.length;i++){const loop=record.loops[i],entry=nesting.entries[i];if(loop.depth!==entry.depth||loop.parentIndex!==entry.parentIndex)return["Region: invalid nesting metadata"]}
    return []
  }
  function bounds(record){const xs=[],ys=[];for(const loop of record.loops)for(const edge of loop.edges){const b=window.CaderactBoundaryGeometry.edgeBounds(edge);xs.push(b.minX,b.maxX);ys.push(b.minY,b.maxY)}return Object.freeze({minX:Math.min(...xs),minY:Math.min(...ys),maxX:Math.max(...xs),maxY:Math.max(...ys)})}
  function classifyPoint(record,value){let deepest=-1,boundary=false;for(const loop of record.loops){const c=window.CaderactBoundaryGeometry.classifyPoint(plainLoop(loop),value);if(c.classification==="boundary")boundary=true;else if(c.classification==="inside")deepest=Math.max(deepest,loop.depth)}return boundary?"boundary":deepest<0?"outside":deepest%2===0?"inside":"hole"}
  function measure(record){
    if(validate(record).length)return null
    let area=0,perimeter=0
    for(const loop of record.loops){const validated=window.CaderactBoundaryGeometry.validateLoop(plainLoop(loop).edges);if(!validated.valid)return null;area+=(loop.depth%2===0?1:-1)*validated.loop.area;perimeter+=validated.loop.perimeter}
    return Object.freeze({type:"region",area,perimeter,loopCount:record.loops.length})
  }
  function centroid(record){let best=null;for(const loop of record.loops.filter(loop=>loop.depth%2===0)){const b=bounds({loops:[loop]}),p={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2};if(classifyPoint(record,p)==="inside")return Object.freeze(p);best ||= p}return Object.freeze(best||{x:0,y:0})}
  function sampleEdge(edge,segments=edge.kind==="line"?1:edge.kind==="arc"?32:64){const points=[];for(let i=0;i<=segments;i++){const parameter=i/segments*(edge.kind==="circle"||edge.kind==="ellipse"?Math.PI*2:1);points.push(window.CaderactBoundaryGeometry.evaluate(edge,parameter))}return Object.freeze(points)}
  window.CaderactRegionGeometry=Object.freeze({sourceLoops,canonicalizeSources,validate,bounds,classifyPoint,measure,centroid,plainLoop,sampleEdge})
})()
