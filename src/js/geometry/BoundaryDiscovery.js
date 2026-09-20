// R3: bounded, deterministic semantic boundary discovery. Pure planning only.
(() => {
  const LIMITS=Object.freeze({curves:10000,intersectionTests:250000,intersections:50000,nodes:50000,halfEdges:100000,loops:1000})
  const ok=details=>Object.freeze({valid:true,...details}),bad=(reason,details={})=>Object.freeze({valid:false,reason,...details})
  const point=value=>Object.freeze({x:value.x,y:value.y})
  function atomicCurves(records){
    const curves=[],seen=new Set()
    for(const record of records||[]){
      if(!record||seen.has(record.id))continue
      seen.add(record.id)
      if(record.type==="ellipse"||record.type==="circle")return bad(record.type==="ellipse"?"unsupported-ellipse-discovery":"unsupported-curve-type",{recordId:record.id})
      if(record.type==="line"||record.type==="arc"){const value=window.CaderactBoundaryGeometry.adaptEdge(record);if(!value.valid)return bad(value.reason,{recordId:record.id});curves.push(Object.freeze({...value.edge,sourceRecordId:record.id}))}
      else if(record.type==="polyline"){const descriptor=window.CaderactCurveDescriptor.describe(record);if(!descriptor.valid)return bad(descriptor.reason,{recordId:record.id});for(let index=0;index<descriptor.segments.length;index++)curves.push(Object.freeze({kind:"line",start:point(descriptor.segments[index].start),end:point(descriptor.segments[index].end),sourceRecordId:record.id,sourceSegmentIndex:index}))}
      else return bad("unsupported-curve-type",{recordId:record.id,type:record.type})
      if(curves.length>LIMITS.curves)return bad("complexity-limit-exceeded",{limit:"curves",maximum:LIMITS.curves})
    }
    return curves.length?ok({curves:Object.freeze(curves)}):bad("no-eligible-geometry")
  }
  function candidatePairs(curves){
    const ordered=curves.map((edge,index)=>({index,bounds:window.CaderactBoundaryGeometry.edgeBounds(edge)})).sort((a,b)=>a.bounds.minX-b.bounds.minX||a.bounds.minY-b.bounds.minY||a.index-b.index),pairs=[],active=[]
    for(const item of ordered){for(let i=active.length-1;i>=0;i--)if(active[i].bounds.maxX<item.bounds.minX)active.splice(i,1);for(const other of active)if(other.bounds.maxY>=item.bounds.minY&&item.bounds.maxY>=other.bounds.minY){pairs.push(other.index<item.index?[other.index,item.index]:[item.index,other.index]);if(pairs.length>LIMITS.intersectionTests)return bad("complexity-limit-exceeded",{limit:"intersection-tests",maximum:LIMITS.intersectionTests})}active.push(item)}
    pairs.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);return ok({pairs:Object.freeze(pairs.map(Object.freeze))})
  }
  function splitCurves(curves,tolerance){
    const broad=candidatePairs(curves);if(!broad.valid)return broad
    const parameters=curves.map(()=>[]);let accepted=0
    for(const [a,b] of broad.pairs){const hit=window.CaderactBoundaryGeometry.intersections(curves[a],curves[b],tolerance);if(!hit.valid)return bad(hit.reason==="overlapping-edges"?"overlapping-or-coincident-geometry":hit.reason,{pair:Object.freeze([a,b])});for(const value of hit.hits){const ta=window.CaderactBoundaryGeometry.tangent(curves[a],value.parameterA),tb=window.CaderactBoundaryGeometry.tangent(curves[b],value.parameterB),cross=ta.x*tb.y-ta.y*tb.x,interior=value.parameterA>tolerance.parameter&&value.parameterA<1-tolerance.parameter||value.parameterB>tolerance.parameter&&value.parameterB<1-tolerance.parameter;if(interior&&Math.abs(cross)<=tolerance.parameter)return bad("ambiguous-tangent-contact",{pair:Object.freeze([a,b]),point:value.point});parameters[a].push(value.parameterA);parameters[b].push(value.parameterB);if(++accepted>LIMITS.intersections)return bad("complexity-limit-exceeded",{limit:"intersections",maximum:LIMITS.intersections})}}
    const pieces=[];for(let index=0;index<curves.length;index++){const split=window.CaderactBoundaryGeometry.splitEdge(curves[index],parameters[index],tolerance);if(!split.valid)return bad(split.reason,{curveIndex:index});for(const edge of split.edges){pieces.push(Object.freeze({...edge,sourceRecordId:curves[index].sourceRecordId,sourceSegmentIndex:curves[index].sourceSegmentIndex??null}));if(pieces.length*2>LIMITS.halfEdges)return bad("complexity-limit-exceeded",{limit:"half-edges",maximum:LIMITS.halfEdges})}}
    return ok({pieces:Object.freeze(pieces),candidatePairCount:broad.pairs.length,intersectionCount:accepted})
  }
  function graphFromPieces(pieces,tolerance){
    const endpoints=[];for(const edge of pieces)endpoints.push(edge.start,edge.end)
    const clustered=window.CaderactBoundaryGeometry.clusterEndpoints(endpoints,tolerance,LIMITS.halfEdges);if(!clustered.valid)return bad(clustered.reason==="node-limit"?"complexity-limit-exceeded":clustered.reason,{limit:"endpoint-scale"});if(clustered.clusters.length>LIMITS.nodes)return bad("complexity-limit-exceeded",{limit:"nodes",maximum:LIMITS.nodes})
    const nodeFor=new Array(endpoints.length);clustered.clusters.forEach((cluster,node)=>cluster.indices.forEach(index=>nodeFor[index]=node))
    const nodes=clustered.clusters.map((cluster,id)=>({id,point:cluster.representative,outgoing:[]})),halfEdges=[]
    for(let index=0;index<pieces.length;index++){const edge=pieces[index],u=nodeFor[index*2],v=nodeFor[index*2+1];if(u===v)continue;const forward=halfEdges.length,backward=forward+1;halfEdges.push({id:forward,from:u,to:v,twin:backward,edge},{id:backward,from:v,to:u,twin:forward,edge:window.CaderactBoundaryGeometry.reverseEdge(edge)});nodes[u].outgoing.push(forward);nodes[v].outgoing.push(backward)}
    const active=new Set(halfEdges.map(edge=>edge.id)),degree=nodes.map(node=>node.outgoing.length),queue=nodes.filter(node=>degree[node.id]<=1).map(node=>node.id);while(queue.length){const nodeId=queue.shift();for(const edgeId of nodes[nodeId].outgoing){if(!active.has(edgeId))continue;const half=halfEdges[edgeId];active.delete(edgeId);active.delete(half.twin);for(const endpoint of [half.from,half.to]){degree[endpoint]--;if(degree[endpoint]===1)queue.push(endpoint)}}}for(const node of nodes)node.outgoing=node.outgoing.filter(id=>active.has(id));const retained=halfEdges.filter(edge=>active.has(edge.id))
    const angle=id=>{const half=halfEdges[id],tangent=window.CaderactBoundaryGeometry.tangent(half.edge,0);return Math.atan2(tangent.y,tangent.x)}
    for(const node of nodes)node.outgoing.sort((a,b)=>angle(a)-angle(b)||halfEdges[a].to-halfEdges[b].to||a-b)
    for(const half of halfEdges){const outgoing=nodes[half.to].outgoing,index=outgoing.indexOf(half.twin);half.next=outgoing[(index-1+outgoing.length)%outgoing.length]}
    for(const half of halfEdges)half.active=active.has(half.id)
    return ok({nodes:Object.freeze(nodes),halfEdges:Object.freeze(halfEdges),tolerance:clustered.tolerance})
  }
  function loopKey(loop,tolerance){const scale=1/tolerance.linear,q=value=>Math.round(value*scale),edgeKey=edge=>edge.kind==="line"?`L${q(edge.start.x)},${q(edge.start.y)}>${q(edge.end.x)},${q(edge.end.y)}`:`A${q(edge.start.x)},${q(edge.start.y)}>${q(edge.end.x)},${q(edge.end.y)}@${q(edge.center.x)},${q(edge.center.y)}:${q(edge.sweep)}`;return loop.edges.map(edgeKey).join("|")}
  function extractFaces(graph){
    const visited=new Set(),faces=[],keys=new Set()
    for(const start of graph.halfEdges){if(!start.active||visited.has(start.id))continue;const edges=[];let current=start.id,steps=0;while(!visited.has(current)){visited.add(current);edges.push(graph.halfEdges[current].edge);current=graph.halfEdges[current].next;if(++steps>LIMITS.halfEdges)return bad("complexity-limit-exceeded",{limit:"face-traversal"})}if(current!==start.id)continue
      const validated=window.CaderactBoundaryGeometry.validateLoop(edges,graph.tolerance);if(!validated.valid)continue
      if(validated.loop.signedArea<=graph.tolerance.area)continue
      const canonical=window.CaderactBoundaryGeometry.canonicalizeLoop(validated.loop,{orientation:"ccw",tolerance:graph.tolerance}),key=loopKey(canonical.loop,graph.tolerance);if(keys.has(key))continue;keys.add(key);faces.push(canonical.loop);if(faces.length>LIMITS.loops)return bad("complexity-limit-exceeded",{limit:"loops",maximum:LIMITS.loops})
    }
    faces.sort((a,b)=>a.area-b.area||a.bounds.minX-b.bounds.minX||a.bounds.minY-b.bounds.minY||loopKey(a,graph.tolerance).localeCompare(loopKey(b,graph.tolerance)))
    return faces.length?ok({faces:Object.freeze(faces)}):bad("no-bounded-face")
  }
  function proposalsFromFaces(faces,tolerance){
    const nesting=window.CaderactBoundaryGeometry.classifyNesting(faces,tolerance)
    if(nesting.valid){const roots=[];for(let i=0;i<nesting.entries.length;i++)if(nesting.entries[i].parentIndex===null)roots.push(i);return Object.freeze(roots.map(root=>Object.freeze(nesting.entries.filter((entry,index)=>index===root||ancestorOf(index,root,nesting.entries)).map(entry=>Object.freeze({depth:entry.depth-nesting.entries[root].depth,parentIndex:entry.parentIndex===null?null:entry.parentIndex,edges:entry.loop.edges,area:entry.loop.area,loop:entry.loop})))))}
    return Object.freeze(faces.map(loop=>Object.freeze([Object.freeze({depth:0,parentIndex:null,edges:loop.edges,area:loop.area,loop})])))
  }
  function ancestorOf(index,root,entries){let parent=entries[index].parentIndex;while(parent!==null){if(parent===root)return true;parent=entries[parent].parentIndex}return false}
  function discover(records){const atomic=atomicCurves(records);if(!atomic.valid)return atomic;const tolerance=window.CaderactBoundaryTolerance.create(atomic.curves.flatMap(edge=>[edge.start,edge.end,edge.center].filter(Boolean)));const split=splitCurves(atomic.curves,tolerance);if(!split.valid)return split;const graph=graphFromPieces(split.pieces,tolerance);if(!graph.valid)return graph;const extracted=extractFaces(graph);if(!extracted.valid)return extracted;return ok({faces:extracted.faces,proposals:proposalsFromFaces(extracted.faces,tolerance),stats:Object.freeze({curves:atomic.curves.length,candidatePairs:split.candidatePairCount,intersections:split.intersectionCount,nodes:graph.nodes.length,halfEdges:graph.halfEdges.length,faces:extracted.faces.length}),tolerance})}
  function chooseAtPoint(plan,pick){if(!plan?.valid)return plan||bad("no-eligible-geometry");for(const face of plan.faces)if(window.CaderactBoundaryGeometry.classifyPoint(face,pick,plan.tolerance).classification==="boundary")return bad("point-on-boundary");const nesting=window.CaderactBoundaryGeometry.classifyNesting(plan.faces,plan.tolerance);if(nesting.valid){const candidates=nesting.entries.map((entry,index)=>({entry,index})).filter(value=>window.CaderactBoundaryGeometry.classifyPoint(value.entry.loop,pick,plan.tolerance).classification==="inside").sort((a,b)=>b.entry.depth-a.entry.depth||a.entry.loop.area-b.entry.loop.area||a.index-b.index);if(!candidates.length||candidates[0].entry.depth%2)return bad("no-enclosing-boundary");const chosen=candidates[0],included=nesting.entries.filter((entry,index)=>index===chosen.index||ancestorOf(index,chosen.index,nesting.entries));return ok({face:chosen.entry.loop,proposal:Object.freeze(included.map(entry=>Object.freeze({depth:entry.depth-chosen.entry.depth,parentIndex:null,edges:entry.loop.edges,area:entry.loop.area,loop:entry.loop})))})}const containing=plan.faces.filter(face=>window.CaderactBoundaryGeometry.classifyPoint(face,pick,plan.tolerance).classification==="inside").sort((a,b)=>a.area-b.area||a.bounds.minX-b.bounds.minX||a.bounds.minY-b.bounds.minY);if(!containing.length)return bad("no-enclosing-boundary");const chosen=containing[0];return ok({face:chosen,proposal:Object.freeze([Object.freeze({depth:0,parentIndex:null,edges:chosen.edges,area:chosen.area,loop:chosen})])})}
  window.CaderactBoundaryDiscovery=Object.freeze({LIMITS,atomicCurves,candidatePairs,splitCurves,graphFromPieces,extractFaces,discover,chooseAtPoint})
})()
