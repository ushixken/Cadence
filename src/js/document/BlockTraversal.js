// GB3: pure deterministic traversal of semantic Block Definition content.
(() => {
  const MAX_DEPTH=32,MAX_SEMANTIC_RECORDS=100000,MAX_VISITS=1000000
  function traverse(document,instance,{maxDepth=MAX_DEPTH,maxSemanticRecords=MAX_SEMANTIC_RECORDS,maxVisits=MAX_VISITS}={}){
    const definitions=document?.blockDefinitions||{},entries=[],active=new Set();let visits=0
    function visit(current,path,parentTransform,depth){if(++visits>maxVisits)throw new Error("Block traversal visit limit exceeded");if(depth>maxDepth)throw new Error("Block traversal depth exceeded");const definition=definitions[current.definitionId];if(!definition)throw new Error(`Missing Block Definition ${String(current.definitionId)}`);if(active.has(definition.id))throw new Error("Block traversal cycle detected");const local=window.CaderactSimilarityTransform.fromComponents({insertionPoint:current.insertionPoint,basePoint:definition.basePoint,rotation:current.rotation,scale:current.scale,mirrored:current.mirrored}),transform=window.CaderactSimilarityTransform.compose(parentTransform,local),instancePath=Object.freeze([...path,current.id]);active.add(definition.id);for(const recordId of definition.recordOrder){if(++visits>maxVisits)throw new Error("Block traversal visit limit exceeded");const record=definition.records[recordId];if(record.type==="block-instance")visit(record,instancePath,transform,depth+1);else{if(entries.length>=maxSemanticRecords)throw new Error("Block traversal semantic record limit exceeded");entries.push(Object.freeze({record,recordId,definitionId:definition.id,instancePath,semanticId:`${instancePath.join("/")}/${record.id}`,transform}))}}active.delete(definition.id)}
    visit(instance,Object.freeze([]),window.CaderactSimilarityTransform.identity(),1);return Object.freeze({entries:Object.freeze(entries),visits})
  }
  window.CaderactBlockTraversal=Object.freeze({traverse,MAX_DEPTH,MAX_SEMANTIC_RECORDS,MAX_VISITS})
})()
