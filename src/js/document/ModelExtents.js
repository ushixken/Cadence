// LAYOUT1: one renderer-neutral visible Model-extents and viewport-fit authority.
(() => {
  const finitePoint=value=>Number.isFinite(value?.x)&&Number.isFinite(value?.y)

  function accumulator(){
    let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity
    const include=(x,y)=>{if(Number.isFinite(x)&&Number.isFinite(y)){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}}
    const includeBounds=value=>{if(value&&!value.empty){include(value.minX??value.x1,value.minY??value.y1);include(value.maxX??value.x2,value.maxY??value.y2)}}
    return Object.freeze({include,includeBounds,result:()=>Number.isFinite(minX)?Object.freeze({empty:false,minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY}):Object.freeze({empty:true})})
  }

  function includeText(bounds,record){
    const width=String(record.text||"").length*record.height*.6,height=record.height*1.1
    const left=record.horizontalAlignment==="right"?-width:record.horizontalAlignment==="center"?-width/2:0
    const angle=record.rotation||0,c=Math.cos(angle),s=Math.sin(angle)
    for(const [x,y] of [[left,-height/2],[left+width,-height/2],[left+width,height/2],[left,height/2]])bounds.include(record.insertionPoint.x+x*c-y*s,record.insertionPoint.y+x*s+y*c)
  }

  function includeArc(bounds,arc){
    bounds.include(arc.center.x-arc.radius,arc.center.y-arc.radius)
    bounds.include(arc.center.x+arc.radius,arc.center.y+arc.radius)
  }

  function includeRecord(bounds,record,document){
    if(record.type==="line"){bounds.include(record.start.x,record.start.y);bounds.include(record.end.x,record.end.y)}
    else if(record.type==="polyline")for(const point of record.vertices)bounds.include(point.x,point.y)
    else if(record.type==="circle"||record.type==="arc")includeArc(bounds,record)
    else if(record.type==="ellipse"){
      const major=Math.hypot(record.majorAxis.x,record.majorAxis.y)
      if(major>0){const minorX=-record.majorAxis.y/major*record.minorRadius,minorY=record.majorAxis.x/major*record.minorRadius,extentX=Math.hypot(record.majorAxis.x,minorX),extentY=Math.hypot(record.majorAxis.y,minorY);bounds.include(record.center.x-extentX,record.center.y-extentY);bounds.include(record.center.x+extentX,record.center.y+extentY)}
    }else if(record.type==="text")includeText(bounds,record)
    else if(record.type==="region"||record.type==="hatch")bounds.includeBounds(window.CaderactRegionGeometry.bounds(record))
    else if(record.type?.startsWith("dimension-")){
      const styles=document.dimensionStyles||{},style=styles[record.dimensionStyleId]||styles[document.currentDimensionStyleId]||window.CaderactDocument?.DEFAULT_DIMENSION_STYLE
      const presentation=window.CaderactDimensionGeometry.derive(record,style,{length:document.units?.length||"mm"})
      if(!presentation.supported)return
      bounds.includeBounds(presentation.bounds)
      for(const arc of presentation.arcs||[])includeArc(bounds,arc)
      if(presentation.text?.value)includeText(bounds,{text:presentation.text.value,height:presentation.text.height,rotation:presentation.text.rotation||0,horizontalAlignment:"center",insertionPoint:presentation.text.point})
    }
  }

  function calculate(document,{records=null}={}){
    const bounds=accumulator(),source=records||Object.values(document?.geometry?.objects||{}),visible=layerId=>document?.layers?.[layerId]?.visible!==false
    try{
      for(const record of source){
        if(!record||!visible(record.layerId))continue
        if(record.type!=="block-instance"){includeRecord(bounds,record,document);continue}
        const traversal=window.CaderactBlockTraversal.traverse(document,record)
        for(const entry of traversal.entries){if(!visible(entry.record.layerId))continue;includeRecord(bounds,window.CaderactGeometryTransform.similarityRecord(entry.record,entry.transform),document)}
      }
      return Object.freeze({valid:true,...bounds.result()})
    }catch(error){return Object.freeze({valid:false,empty:true,reason:"model-extents-unavailable",error})}
  }

  function defaultFrame(paper){
    const page=window.CaderactPaperSpace.derive({paper})
    if(!page.valid)return null
    const frame={x:page.printable.left,y:page.printable.bottom,width:page.printable.width,height:page.printable.height}
    return frame.width>0&&frame.height>0?Object.freeze(frame):null
  }

  function fit(document,frame,{padding=.9}={}){
    if(!frame||![frame.x,frame.y,frame.width,frame.height].every(Number.isFinite)||frame.width<=0||frame.height<=0)return Object.freeze({valid:false,reason:"invalid-frame"})
    const extents=calculate(document)
    if(!extents.valid)return extents
    if(extents.empty)return Object.freeze({valid:true,empty:true,viewCenter:Object.freeze({x:0,y:0}),scale:1})
    const millimeters=window.CaderactUnits.conversionFactor(document.units.length,"mm"),usableWidth=frame.width*padding,usableHeight=frame.height*padding
    const center={x:extents.minX/2+extents.maxX/2,y:extents.minY/2+extents.maxY/2},scale=Math.max(1,(extents.width||1)*millimeters/usableWidth,(extents.height||1)*millimeters/usableHeight)
    if(!finitePoint(center)||!Number.isFinite(scale))return Object.freeze({valid:false,empty:false,reason:"non-finite-fit",extents})
    return Object.freeze({valid:true,empty:false,extents,viewCenter:Object.freeze(center),scale})
  }

  window.CaderactModelExtents=Object.freeze({calculate,defaultFrame,fit})
})()
