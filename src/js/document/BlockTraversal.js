// GB3: pure deterministic traversal of semantic Block Definition content.
(() => {
  const MAX_DEPTH=32,MAX_SEMANTIC_RECORDS=100000,MAX_VISITS=1000000
  function traverse(document,instance,{maxDepth=MAX_DEPTH,maxSemanticRecords=MAX_SEMANTIC_RECORDS,maxVisits=MAX_VISITS}={}){
    const definitions=document?.blockDefinitions||{},entries=[],active=new Set();let visits=0
    function visit(current,path,parentTransform,depth){if(++visits>maxVisits)throw new Error("Block traversal visit limit exceeded");if(depth>maxDepth)throw new Error("Block traversal depth exceeded");const definition=definitions[current.definitionId];if(!definition)throw new Error(`Missing Block Definition ${String(current.definitionId)}`);if(active.has(definition.id))throw new Error("Block traversal cycle detected");const local=window.CaderactSimilarityTransform.fromComponents({insertionPoint:current.insertionPoint,basePoint:definition.basePoint,rotation:current.rotation,scale:current.scale,mirrored:current.mirrored}),transform=window.CaderactSimilarityTransform.compose(parentTransform,local),instancePath=Object.freeze([...path,current.id]);active.add(definition.id);for(const recordId of definition.recordOrder){if(++visits>maxVisits)throw new Error("Block traversal visit limit exceeded");const record=definition.records[recordId];if(record.type==="block-instance")visit(record,instancePath,transform,depth+1);else{if(entries.length>=maxSemanticRecords)throw new Error("Block traversal semantic record limit exceeded");entries.push(Object.freeze({record,recordId,definitionId:definition.id,instancePath,semanticId:`${instancePath.join("/")}/${record.id}`,transform}))}}active.delete(definition.id)}
    visit(instance,Object.freeze([]),window.CaderactSimilarityTransform.identity(),1);return Object.freeze({entries:Object.freeze(entries),visits})
  }
  function bounds(document,instance,{isLayerVisible=()=>true,...limits}={}){
    const traversal=traverse(document,instance,limits),points=[],include=(x,y)=>{if(Number.isFinite(x)&&Number.isFinite(y))points.push({x,y})}
    for(const entry of traversal.entries){if(!isLayerVisible(entry.record.layerId))continue;const record=window.CaderactGeometryTransform.similarityRecord(entry.record,entry.transform)
      if(record.type==="line"){include(record.start.x,record.start.y);include(record.end.x,record.end.y)}
      else if(record.type==="polyline")for(const value of record.vertices)include(value.x,value.y)
      else if(record.type==="circle"||record.type==="arc"){include(record.center.x-record.radius,record.center.y-record.radius);include(record.center.x+record.radius,record.center.y+record.radius)}
      else if(record.type==="ellipse"){const ax=Math.hypot(record.majorAxis.x,record.majorAxis.y),ex=Math.hypot(record.majorAxis.x,record.majorAxis.y/ax*record.minorRadius),ey=Math.hypot(record.majorAxis.y,record.majorAxis.x/ax*record.minorRadius);include(record.center.x-ex,record.center.y-ey);include(record.center.x+ex,record.center.y+ey)}
      else if(record.type==="region"||record.type==="hatch")for(const loop of record.loops)for(const edge of loop.edges){for(const key of ["start","end"])if(edge[key])include(edge[key].x,edge[key].y);if(edge.center){const radius=edge.radius??Math.max(Math.hypot(edge.majorAxis?.x||0,edge.majorAxis?.y||0),edge.minorRadius||0);include(edge.center.x-radius,edge.center.y-radius);include(edge.center.x+radius,edge.center.y+radius)}}
      else if(record.type==="text"){const radius=Math.hypot(record.text.length*record.height*.6,record.height);include(record.insertionPoint.x-radius,record.insertionPoint.y-radius);include(record.insertionPoint.x+radius,record.insertionPoint.y+radius)}
      else if(record.type.startsWith("dimension-"))for(const value of Object.values(record))if(value&&Number.isFinite(value.x)&&Number.isFinite(value.y))include(value.x,value.y)
    }
    if(!points.length)return Object.freeze({empty:true,visits:traversal.visits,leafCount:traversal.entries.length})
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const point of points){minX=Math.min(minX,point.x);minY=Math.min(minY,point.y);maxX=Math.max(maxX,point.x);maxY=Math.max(maxY,point.y)}
    return Object.freeze({empty:false,minX,minY,maxX,maxY,visits:traversal.visits,leafCount:traversal.entries.length})
  }
  window.CaderactBlockTraversal=Object.freeze({traverse,bounds,MAX_DEPTH,MAX_SEMANTIC_RECORDS,MAX_VISITS})
})()
