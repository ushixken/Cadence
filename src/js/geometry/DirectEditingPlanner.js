// DC4: pure plans for partial stretch, lengthen, and 2D alignment.
(() => {
  const EPS=1e-9,TAU=Math.PI*2
  const invalid=reason=>Object.freeze({status:"invalid",reason})
  const planned=details=>Object.freeze({status:"planned",...details})
  const point=value=>Object.freeze({...value,x:value.x,y:value.y})
  function stretch({records,captures,dx,dy}={}){
    if(!Array.isArray(records)||!records.length)return invalid("empty-selection")
    if(!Array.isArray(captures)||!captures.length)return invalid("empty-capture")
    if(!Number.isFinite(dx)||!Number.isFinite(dy))return invalid("invalid-displacement")
    const captured=new Map(captures.map(item=>[item.recordId,new Set(item.featureIds||[])])),replacements=[]
    for(const record of records){const ids=captured.get(record.id);if(!ids?.size)continue
      if(record.type==="line"){const count=Number(ids.has(record.start.featureId))+Number(ids.has(record.end.featureId));if(count!==1)return invalid(count?"whole-record-capture":"empty-capture");replacements.push(Object.freeze({...record,start:ids.has(record.start.featureId)?point({...record.start,x:record.start.x+dx,y:record.start.y+dy}):record.start,end:ids.has(record.end.featureId)?point({...record.end,x:record.end.x+dx,y:record.end.y+dy}):record.end}))}
      else if(record.type==="polyline"&&!record.closed){const count=record.vertices.filter(vertex=>ids.has(vertex.featureId)).length;if(!count)return invalid("empty-capture");if(count===record.vertices.length)return invalid("whole-record-capture");replacements.push(Object.freeze({...record,vertices:Object.freeze(record.vertices.map(vertex=>ids.has(vertex.featureId)?point({...vertex,x:vertex.x+dx,y:vertex.y+dy}):vertex))}))}
      else return invalid("unsupported-geometry")
    }
    if(!replacements.length)return invalid("empty-capture")
    return planned({replacements:Object.freeze(replacements)})
  }
  function lengthen({record,pickPoint,mode="delta",value}={}){
    if(!record||!Number.isFinite(pickPoint?.x)||!Number.isFinite(pickPoint?.y))return invalid("invalid-target")
    if(!Number.isFinite(value))return invalid("invalid-value")
    const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)
    if(record.type==="line"){
      const length=distance(record.start,record.end),next=mode==="total"?value:length+value
      if(!(next>EPS))return invalid("non-positive-length")
      const changeStart=distance(pickPoint,record.start)<=distance(pickPoint,record.end),fixed=changeStart?record.end:record.start,moving=changeStart?record.start:record.end,scale=next/length
      if(!(length>EPS))return invalid("degenerate-source")
      const changed=point({...moving,x:fixed.x+(moving.x-fixed.x)*scale,y:fixed.y+(moving.y-fixed.y)*scale})
      return planned({replacement:Object.freeze({...record,start:changeStart?changed:record.start,end:changeStart?record.end:changed}),endpoint:changeStart?"start":"end",total:next})
    }
    if(record.type==="arc"){
      const current=Math.abs(record.sweep)*record.radius,next=mode==="total"?value:current+value
      if(!(next>EPS)||!(next<record.radius*TAU-EPS))return invalid("invalid-arc-length")
      const sign=Math.sign(record.sweep)||1,sweep=sign*next/record.radius,changeStart=distance(pickPoint,record.start)<=distance(pickPoint,record.end)
      const fixed=changeStart?record.end:record.start,fixedAngle=Math.atan2(fixed.y-record.center.y,fixed.x-record.center.x),angle=changeStart?fixedAngle-sweep:fixedAngle+sweep,moving=changeStart?record.start:record.end,changed=point({...moving,x:record.center.x+record.radius*Math.cos(angle),y:record.center.y+record.radius*Math.sin(angle)})
      return planned({replacement:Object.freeze({...record,start:changeStart?changed:record.start,end:changeStart?record.end:changed,sweep}),endpoint:changeStart?"start":"end",total:next})
    }
    return invalid("unsupported-geometry")
  }
  function align({records,source1,destination1,source2,destination2,scale=false}={}){
    if(!Array.isArray(records)||!records.length)return invalid("empty-selection")
    if(![source1,destination1,source2,destination2].every(value=>Number.isFinite(value?.x)&&Number.isFinite(value?.y)))return invalid("invalid-point")
    const sx=source2.x-source1.x,sy=source2.y-source1.y,dx=destination2.x-destination1.x,dy=destination2.y-destination1.y,sourceLength=Math.hypot(sx,sy),destinationLength=Math.hypot(dx,dy)
    if(!(sourceLength>EPS)||!(destinationLength>EPS))return invalid("degenerate-point-pair")
    const factor=scale?destinationLength/sourceLength:1,angle=Math.atan2(dy,dx)-Math.atan2(sy,sx)
    return planned({transform:Object.freeze({source:Object.freeze({x:source1.x,y:source1.y}),destination:Object.freeze({x:destination1.x,y:destination1.y}),angle,factor})})
  }
  window.CaderactDirectEditingPlanner=Object.freeze({stretch,lengthen,align})
})()
