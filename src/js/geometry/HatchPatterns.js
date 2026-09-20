// R6: pure named-hatch registry and deterministic semantic pattern generation.
(() => {
  const TAU=Math.PI*2,EPS=1e-9
  const LIMITS=Object.freeze({families:16,candidateLines:100000,intersections:1000000,intersectionsPerLine:20000,dashFragments:200000,segments:100000})
  const family=(angle,spacing,dashes=null,phase=0)=>Object.freeze({angle,spacing,dashes:dashes?Object.freeze(dashes):null,phase})
  const definitions=Object.freeze({
    ANSI31:Object.freeze({families:Object.freeze([family(Math.PI/4,5)])}),
    ANSI32:Object.freeze({families:Object.freeze([family(Math.PI/4,3.5)])}),
    ANSI33:Object.freeze({families:Object.freeze([family(Math.PI/4,5,[8,3,2,3])])}),
    GRID:Object.freeze({families:Object.freeze([family(0,5),family(Math.PI/2,5)])}),
    CROSS:Object.freeze({families:Object.freeze([family(0,5,[4,3]),family(Math.PI/2,5,[4,3],3.5)])}),
  })
  const names=Object.freeze(Object.keys(definitions))
  const finitePoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y)
  const point=(x,y)=>Object.freeze({x,y})
  function normalizeAngle(value){let angle=((value+Math.PI)%TAU+TAU)%TAU-Math.PI;if(angle<=-Math.PI)angle=Math.PI;return angle}
  function validate(pattern){
    if(pattern?.kind==="solid")return Reflect.ownKeys(pattern).length===1?[]:["invalid solid pattern"]
    if(pattern?.kind!=="named")return["invalid pattern kind"]
    if(Reflect.ownKeys(pattern).some(key=>!["kind","name","angle","scale","origin"].includes(key)))return["unknown pattern field"]
    if(!Object.hasOwn(definitions,pattern.name))return["unknown pattern name"]
    if(!Number.isFinite(pattern.angle)||!(pattern.angle>-Math.PI&&pattern.angle<=Math.PI))return["invalid pattern angle"]
    if(!Number.isFinite(pattern.scale)||!(pattern.scale>0))return["invalid pattern scale"]
    if(!finitePoint(pattern.origin))return["invalid pattern origin"]
    return[]
  }
  function descriptor(edge){const api=window.CaderactCurveDescriptor;if(edge.kind==="line")return api.describeLine(edge.start,edge.end);if(edge.kind==="arc")return api.describeArc(edge.center,edge.radius,edge.start,edge.sweep);if(edge.kind==="circle")return api.describeCircle(edge.center,edge.radius);if(edge.kind==="ellipse")return api.describeEllipse(edge.center,edge.majorAxis,edge.minorRadius);return null}
  function fail(reason,counts={}){return Object.freeze({valid:false,reason,...counts})}
  function generate(record){
    const errors=validate(record?.pattern);if(errors.length)return fail("invalid-pattern");if(window.CaderactRegionGeometry.validate(record).length)return fail("invalid-boundary")
    if(record.pattern.kind!=="named")return fail("not-named")
    const definition=definitions[record.pattern.name];if(definition.families.length>LIMITS.families)return fail("family-limit")
    const bounds=window.CaderactRegionGeometry.bounds(record),corners=[point(bounds.minX,bounds.minY),point(bounds.maxX,bounds.minY),point(bounds.maxX,bounds.maxY),point(bounds.minX,bounds.maxY)]
    const edges=record.loops.flatMap(loop=>loop.edges.map(descriptor));if(edges.some(edge=>!edge?.valid))return fail("unsupported-boundary")
    const segments=[];let candidateLines=0,intersectionCount=0,dashFragments=0
    for(let familyIndex=0;familyIndex<definition.families.length;familyIndex++){
      const source=definition.families[familyIndex],angle=normalizeAngle(source.angle+record.pattern.angle),d={x:Math.cos(angle),y:Math.sin(angle)},n={x:-d.y,y:d.x},spacing=source.spacing*record.pattern.scale
      if(!Number.isFinite(spacing)||!(spacing>0))return fail("invalid-spacing")
      const normalValues=corners.map(p=>(p.x-record.pattern.origin.x)*n.x+(p.y-record.pattern.origin.y)*n.y),k0=Math.floor(Math.min(...normalValues)/spacing)-1,k1=Math.ceil(Math.max(...normalValues)/spacing)+1
      if(candidateLines+(k1-k0+1)>LIMITS.candidateLines)return fail("candidate-line-limit",{candidateLines})
      const along=corners.map(p=>(p.x-record.pattern.origin.x)*d.x+(p.y-record.pattern.origin.y)*d.y),t0=Math.min(...along)-spacing,t1=Math.max(...along)+spacing
      for(let k=k0;k<=k1;k++){candidateLines++;const base={x:record.pattern.origin.x+n.x*k*spacing,y:record.pattern.origin.y+n.y*k*spacing},a=point(base.x+d.x*t0,base.y+d.y*t0),b=point(base.x+d.x*t1,base.y+d.y*t1),line=window.CaderactCurveDescriptor.describeLine(a,b),cuts=[t0,t1]
        for(const edge of edges){const result=window.CaderactCurveIntersection.intersectAtomic(line,edge);if(!result.valid)continue;for(const hit of result.hits){if(hit.onA&&hit.onB){cuts.push(t0+(t1-t0)*hit.parameterA);intersectionCount++;if(intersectionCount>LIMITS.intersections)return fail("intersection-limit",{candidateLines,intersectionCount})}}}
        cuts.sort((x,y)=>x-y);const unique=[];for(const value of cuts)if(!unique.length||Math.abs(value-unique.at(-1))>EPS*Math.max(1,Math.abs(value)))unique.push(value);if(unique.length>LIMITS.intersectionsPerLine)return fail("intersection-limit",{candidateLines,intersectionCount})
        for(let i=1;i<unique.length;i++){const lo=unique[i-1],hi=unique[i];if(!(hi-lo>EPS))continue;const mid=(lo+hi)/2,classification=window.CaderactRegionGeometry.classifyPoint(record,{x:base.x+d.x*mid,y:base.y+d.y*mid});if(classification!=="inside")continue
          if(!source.dashes){segments.push(Object.freeze({start:point(base.x+d.x*lo,base.y+d.y*lo),end:point(base.x+d.x*hi,base.y+d.y*hi),familyIndex,lineIndex:k}));if(segments.length>LIMITS.segments)return fail("segment-limit",{candidateLines,intersectionCount})}
          else{const pattern=source.dashes.map(value=>value*record.pattern.scale),period=pattern.reduce((sum,value)=>sum+value,0),phase=source.phase*record.pattern.scale;let cursor=lo-Math.max(0,((lo-phase)%period+period)%period),patternIndex=0;while(cursor+pattern[patternIndex]<=lo){cursor+=pattern[patternIndex];patternIndex=(patternIndex+1)%pattern.length}while(cursor<hi){const next=cursor+pattern[patternIndex],start=Math.max(cursor,lo),end=Math.min(next,hi);if(patternIndex%2===0&&end-start>EPS){dashFragments++;if(dashFragments>LIMITS.dashFragments)return fail("dash-limit",{candidateLines,intersectionCount,dashFragments});segments.push(Object.freeze({start:point(base.x+d.x*start,base.y+d.y*start),end:point(base.x+d.x*end,base.y+d.y*end),familyIndex,lineIndex:k}));if(segments.length>LIMITS.segments)return fail("segment-limit",{candidateLines,intersectionCount,dashFragments})}cursor=next;patternIndex=(patternIndex+1)%pattern.length}}
        }
      }
    }
    segments.sort((a,b)=>a.familyIndex-b.familyIndex||a.lineIndex-b.lineIndex||a.start.x-b.start.x||a.start.y-b.start.y||a.end.x-b.end.x||a.end.y-b.end.y)
    return Object.freeze({valid:true,segments:Object.freeze(segments),candidateLines,intersectionCount,dashFragments})
  }
  window.CaderactHatchPatterns=Object.freeze({LIMITS,definitions,names,normalizeAngle,validate,generate})
})()
