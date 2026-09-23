// P4: pure, bounded, ephemeral object-snap tracking.
(() => {
  const ELIGIBLE = new Set(["endpoint", "vertex", "midpoint", "center", "quadrant", "intersection"])
  const point = value => Object.freeze({ x: value.x, y: value.y })
  const stableReference = reference => reference ? JSON.stringify(reference) : ""
  const radians = degrees => degrees * Math.PI / 180
  const normalizeAngle = angle => Math.atan2(Math.sin(angle), Math.cos(angle))
  const finitePoint = value => Number.isFinite(value?.x) && Number.isFinite(value?.y)
  const samePoint = (a, b) => Math.hypot(a.x-b.x,a.y-b.y) <= 1e-9*Math.max(1,Math.abs(a.x),Math.abs(a.y),Math.abs(b.x),Math.abs(b.y))
  function create({ dwellMs = 500, guideTolerancePx = 8, maxAcquiredPoints = 4, setTimer = setTimeout, clearTimer = clearTimeout, onChange = () => {} } = {}) {
    let hover = null, timer = null, acquired = [], guide = null, candidate = null, candidateKind = null, activeGuides = [], acquisitionOrder = 0
    const acquiredValue = item => Object.freeze({ kind:item.kind, point:item.point, reference:item.reference, acquisitionOrder:item.acquisitionOrder })
    const state = () => Object.freeze({ hovered:hover&&Object.freeze({kind:hover.kind,point:hover.point,reference:hover.reference}), acquired:acquired.length?acquiredValue(acquired.at(-1)):null, acquiredPoints:Object.freeze(acquired.map(acquiredValue)), guide, activeGuides:Object.freeze(activeGuides.map(value=>Object.freeze({...value,origin:point(value.origin)}))), candidate, candidateKind })
    const emit = () => { const value = state(); onChange(value); return value }
    const clearPending = () => { if (timer !== null) clearTimer(timer); timer = null; hover = null }
    const clearProjection = () => { guide=null;candidate=null;candidateKind=null;activeGuides=[] }
    function observeSnap(result) {
      clearProjection()
      const valid = result?.snapped && ELIGIBLE.has(result.kind) && finitePoint(result.point)
      if (!valid) { clearPending(); return emit() }
      const next = { kind:result.kind, point:point(result.point), reference:result.sourceReference || result.reference || null }
      const key = `${next.kind}:${next.point.x}:${next.point.y}:${stableReference(next.reference)}`
      if (hover?.key === key || acquired.some(item=>samePoint(item.point,next.point))) return state()
      clearPending(); hover = { ...next, key }
      timer = setTimer(() => { if (!hover || hover.key !== key) return; acquired.push({...hover,acquisitionOrder:++acquisitionOrder});if(acquired.length>maxAcquiredPoints)acquired=acquired.slice(-maxAcquiredPoints);hover=null;timer=null;emit() }, dwellMs)
      return emit()
    }
    function clearHover() { clearPending(); clearProjection(); return emit() }
    function clear() { clearPending(); acquired=[];clearProjection();return emit() }
    function toggleAcquire(result){
      const valid=result?.snapped&&ELIGIBLE.has(result.kind)&&finitePoint(result.point);if(!valid)return state()
      clearPending();clearProjection();const index=acquired.findIndex(item=>samePoint(item.point,result.point))
      if(index>=0)acquired.splice(index,1)
      else{acquired.push({kind:result.kind,point:point(result.point),reference:result.sourceReference||result.reference||null,acquisitionOrder:++acquisitionOrder});if(acquired.length>maxAcquiredPoints)acquired=acquired.slice(-maxAcquiredPoints)}
      return emit()
    }
    function setCandidate(value,kind,guides,reference=null){if(!finitePoint(value))return state();candidate=point(value);candidateKind=kind;activeGuides=Array.from(guides||[],guide=>Object.freeze({...guide,origin:point(guide.origin)}));guide=activeGuides.length===1?activeGuides[0].kind:"intersection";const next=emit();return Object.freeze({...next,candidateReference:reference})}
    function reconcileReferences(isValid) {
      if(typeof isValid!=="function")return state()
      const hoverInvalid=hover&&!isValid(hover.reference),next=acquired.filter(item=>isValid(item.reference))
      if(hoverInvalid)clearPending()
      if(next.length===acquired.length&&!hoverInvalid)return state()
      acquired=next;clearProjection();return emit()
    }
    function project(pointerWorld, worldToScreen, {polarEnabled=false,polarIncrementDegrees=45,polarToleranceDegrees=10}={}) {
      clearProjection()
      if (!acquired.length || !finitePoint(pointerWorld) || typeof worldToScreen!=="function") return emit()
      const p=worldToScreen(pointerWorld.x,pointerWorld.y);if(!finitePoint(p))return emit()
      const origins=acquired.map(item=>({...item,screen:worldToScreen(item.point.x,item.point.y)})).filter(item=>finitePoint(item.screen)),singles=[],intersections=[]
      const descriptor=(kind,item,angle=null)=>({kind,origin:item.point,acquisitionOrder:item.acquisitionOrder,angle})
      const addIntersection=(value,guides,rank)=>{const screen=worldToScreen(value.x,value.y);if(!finitePoint(screen))return;const distancePx=Math.hypot(p.x-screen.x,p.y-screen.y);if(distancePx<=guideTolerancePx)intersections.push({point:point(value),distancePx,guides,rank})}
      for(const item of origins){const h=Math.abs(p.y-item.screen.y),v=Math.abs(p.x-item.screen.x);if(h<=guideTolerancePx)singles.push({point:point({x:pointerWorld.x,y:item.point.y}),distancePx:h,guides:[descriptor("horizontal",item)],rank:0});if(v<=guideTolerancePx)singles.push({point:point({x:item.point.x,y:pointerWorld.y}),distancePx:v,guides:[descriptor("vertical",item)],rank:1});if(polarEnabled&&polarIncrementDegrees>0){const dx=pointerWorld.x-item.point.x,dy=pointerWorld.y-item.point.y,distance=Math.hypot(dx,dy);if(distance>0){const increment=radians(polarIncrementDegrees),raw=Math.atan2(dy,dx),index=Math.floor(raw/increment+.5),angle=index*increment;if(Math.abs(normalizeAngle(raw-angle))<=radians(polarToleranceDegrees)){const projected=point({x:item.point.x+distance*Math.cos(angle),y:item.point.y+distance*Math.sin(angle)}),screen=worldToScreen(projected.x,projected.y);singles.push({point:projected,distancePx:Math.hypot(p.x-screen.x,p.y-screen.y),guides:[descriptor("polar",item,angle)],rank:2})}}}}
      for(let a=0;a<origins.length;a++)for(let b=a+1;b<origins.length;b++){addIntersection({x:origins[a].point.x,y:origins[b].point.y},[descriptor("vertical",origins[a]),descriptor("horizontal",origins[b])],0);addIntersection({x:origins[b].point.x,y:origins[a].point.y},[descriptor("horizontal",origins[a]),descriptor("vertical",origins[b])],1)}
      if(polarEnabled)for(const ray of singles.filter(value=>value.guides[0].kind==="polar")){const polar=ray.guides[0],dx=Math.cos(polar.angle),dy=Math.sin(polar.angle);for(const other of origins){if(other.acquisitionOrder===polar.acquisitionOrder)continue;if(Math.abs(dy)>1e-12){const t=(other.point.y-polar.origin.y)/dy;if(t>=0)addIntersection({x:polar.origin.x+t*dx,y:other.point.y},[polar,descriptor("horizontal",other)],2)}if(Math.abs(dx)>1e-12){const t=(other.point.x-polar.origin.x)/dx;if(t>=0)addIntersection({x:other.point.x,y:polar.origin.y+t*dy},[polar,descriptor("vertical",other)],3)}}}
      const choose=list=>list.sort((a,b)=>a.distancePx-b.distancePx||a.rank-b.rank||Math.min(...a.guides.map(g=>g.acquisitionOrder))-Math.min(...b.guides.map(g=>g.acquisitionOrder)))[0],winner=choose(intersections)||choose(singles)
      if(winner){candidate=winner.point;candidateKind=intersections.includes(winner)?"intersection":"projection";activeGuides=winner.guides;guide=winner.guides.length===1?winner.guides[0].kind:"intersection"}
      return emit()
    }
    function projectExtension(pointerWorld,worldToScreen,resolveDirection){
      clearProjection();if(!acquired.length||!finitePoint(pointerWorld)||typeof worldToScreen!=="function"||typeof resolveDirection!=="function")return emit()
      const raw=worldToScreen(pointerWorld.x,pointerWorld.y),solutions=[]
      for(const item of acquired){const resolved=resolveDirection(item.reference,item.point);if(!resolved||!finitePoint(resolved.origin)||!finitePoint(resolved.direction))continue;const length=Math.hypot(resolved.direction.x,resolved.direction.y);if(!(length>0))continue;const ux=resolved.direction.x/length,uy=resolved.direction.y/length,t=(pointerWorld.x-resolved.origin.x)*ux+(pointerWorld.y-resolved.origin.y)*uy;if(!(t>0))continue;const projected=point({x:resolved.origin.x+t*ux,y:resolved.origin.y+t*uy}),screen=worldToScreen(projected.x,projected.y);if(!finitePoint(screen)||!finitePoint(raw))continue;const distancePx=Math.hypot(screen.x-raw.x,screen.y-raw.y);if(distancePx<=guideTolerancePx)solutions.push({projected,distancePx,item,angle:Math.atan2(uy,ux)})}
      solutions.sort((a,b)=>a.distancePx-b.distancePx||b.item.acquisitionOrder-a.item.acquisitionOrder);const winner=solutions[0]
      if(winner){candidate=winner.projected;candidateKind="extension";activeGuides=[Object.freeze({kind:"extension",origin:point(winner.item.point),angle:winner.angle,acquisitionOrder:winner.item.acquisitionOrder})];guide="extension"}
      return emit()
    }
    return Object.freeze({observeSnap,toggleAcquire,setCandidate,clearHover,clear,reconcileReferences,project,projectExtension,getState:state,dwellMs,guideTolerancePx,maxAcquiredPoints})
  }
  window.CaderactObjectSnapTracking = Object.freeze({ create, ELIGIBLE })
})()
