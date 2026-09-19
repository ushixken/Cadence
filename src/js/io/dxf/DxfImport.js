// DXF1-DXF3: neutral-DXF to isolated canonical Caderact document mapping.
(() => {
  const INSUNITS = Object.freeze({ 1:"in", 2:"ft", 4:"mm", 5:"cm", 6:"m" })
  const DEFAULT_LAYER = Object.freeze({ name:"0",visible:true,locked:false,aci:7,trueColor:null,linetype:"CONTINUOUS",lineweight:-3,sourceIndex:0 })
  class DxfImportError extends Error { constructor(message,diagnostics){super(message);this.name="DxfImportError";this.diagnostics=Object.freeze(diagnostics)} }
  function reject(diagnostics,code,message,section="HEADER"){throw new DxfImportError(message,[...diagnostics,Object.freeze({severity:"error",code,message,section})])}
  function createStore(text,options={}) {
    const parsed=window.CaderactDxfParser.parse(text,options),diagnostics=window.CaderactDxfDiagnostics.createCollector(parsed.limits.maxDiagnostics)
    for(const diagnostic of parsed.diagnostics)for(let count=0;count<(diagnostic.count||1);count++)diagnostics.add(diagnostic)
    const warn=(code,message,details={})=>diagnostics.add({severity:"warning",code,message,...details})
    const fail=(code,message,section)=>reject(diagnostics.snapshot(),code,message,section)
    const code=parsed.source.insertionUnits,unit=INSUNITS[code]
    if(code===null||code===0)fail("DXF_UNITS_REQUIRED","DXF import requires a supported, non-unitless $INSUNITS value.")
    if(!unit||!window.CaderactUnits.isSupportedLengthUnit(unit))fail("DXF_UNITS_UNSUPPORTED",`DXF import does not support $INSUNITS value ${code}.`)
    const draft=window.CaderactDocument.createStore(),unitOutcome=draft.unitGateway.setLengthUnit(unit)
    if(!["committed","no-op"].includes(unitOutcome.status))fail("DXF_UNIT_MAPPING_FAILED","Unable to apply DXF drawing units.")

    const sourceLayers=parsed.layers.length?[...parsed.layers]:[DEFAULT_LAYER]
    if(!parsed.layers.length)warn("DXF_LAYER_TABLE_MISSING","Synthesized Layer 0 because the DXF has no LAYER table.",{section:"TABLES"})
    if(!sourceLayers.some(layer=>layer.name.toLowerCase()==="0")){sourceLayers.unshift(DEFAULT_LAYER);warn("DXF_LAYER_ZERO_SYNTHESIZED","Synthesized required Layer 0.",{section:"TABLES"})}
    const layerZero=sourceLayers.find(layer=>layer.name.toLowerCase()==="0"),orderedLayers=[layerZero,...sourceLayers.filter(layer=>layer!==layerZero)]
    const defaultId=draft.reader.layers()[0].id
    if(!["committed","no-op"].includes(draft.layerGateway.rename(defaultId,"0").status))fail("DXF_LAYER_MAPPING_FAILED","Unable to create DXF Layer 0.","TABLES")
    const layerIds=new Map([["0",defaultId]])
    for(const layer of orderedLayers.slice(1)){const outcome=draft.layerGateway.create(layer.name);if(outcome.status!=="committed")fail("DXF_LAYER_MAPPING_FAILED",`Unable to create DXF layer ${layer.name}.`,"TABLES");const created=draft.reader.layers().find(candidate=>candidate.name.toLowerCase()===layer.name.toLowerCase());layerIds.set(layer.name.toLowerCase(),created.id)}
    function mapLinetype(name,layer,details){const mapped=window.CaderactDxfProperties.linetype(name);if(mapped.loss)warn("DXF_LINETYPE_FALLBACK",`Mapped ${name} linetype to ${layer?"Continuous":"ByLayer"}.`,details);return layer?(mapped.value||"continuous"):mapped.value}
    function mapLineweight(value,layer,details){const mapped=window.CaderactDxfProperties.lineweight(value,{layer});if(mapped.loss)warn("DXF_LINEWEIGHT_FALLBACK",`Mapped DXF lineweight ${value} using Caderact's closest supported value.`,details);return mapped.value}
    function mapLayer(layer){const details={section:"TABLES",entityType:"LAYER",handle:layer.handle,sourceIndex:layer.sourceIndex};const color=layer.trueColor!==null?window.CaderactDxfProperties.trueColorToHex(layer.trueColor):window.CaderactDxfProperties.aciToHex(layer.aci);if(!color)fail("DXF_LAYER_COLOR_UNSUPPORTED",`Unable to map color for layer ${layer.name}.`,"TABLES");return Object.freeze({id:layerIds.get(layer.name.toLowerCase()),name:layer.name,visible:layer.visible,locked:layer.locked,color,linetype:mapLinetype(layer.linetype,true,details),lineweight:mapLineweight(layer.lineweight,true,details)})}
    const nativeLayers=orderedLayers.map(mapLayer),layerTable=Object.fromEntries(nativeLayers.map(layer=>[layer.id,layer]))

    function geometryRecord(entity){
      if(entity.type==="LINE")return draft.recordGateway.createLine(entity.start,entity.end)
      if(entity.type==="LWPOLYLINE"||entity.type==="POLYLINE")return draft.recordGateway.createPolyline(entity.vertices,entity.closed)
      if(entity.type==="CIRCLE")return draft.recordGateway.createCircle(entity.center,entity.radius)
      if(entity.type==="ARC"){const startAngle=window.CaderactArcGeometry.normalizeAngle(entity.startAngleDegrees*Math.PI/180),sweep=window.CaderactArcGeometry.positiveDelta(startAngle,entity.endAngleDegrees*Math.PI/180);return draft.recordGateway.createArc({center:entity.center,radius:entity.radius,sweep,start:{x:entity.center.x+Math.cos(startAngle)*entity.radius,y:entity.center.y+Math.sin(startAngle)*entity.radius},end:{x:entity.center.x+Math.cos(startAngle+sweep)*entity.radius,y:entity.center.y+Math.sin(startAngle+sweep)*entity.radius}})}
      if(entity.type==="ELLIPSE")return draft.recordGateway.createEllipse({center:entity.center,majorAxis:entity.majorAxis,minorRadius:Math.hypot(entity.majorAxis.x,entity.majorAxis.y)*entity.ratio})
      if(entity.type==="TEXT")return draft.recordGateway.createText({insertionPoint:entity.insertionPoint,text:entity.content,height:entity.height,rotation:entity.rotationDegrees*Math.PI/180,horizontalAlignment:entity.horizontalAlignment})
      throw new DxfImportError(`Unsupported neutral DXF entity ${entity.type}.`,diagnostics.snapshot())
    }
    function mapEntity(entity){const details={section:"ENTITIES",entityType:entity.type,sourceIndex:entity.sourceIndex},key=entity.layer?.toLowerCase();let layerId=key&&layerIds.get(key);if(!layerId){warn(entity.layer?"DXF_ENTITY_LAYER_UNKNOWN":"DXF_ENTITY_LAYER_MISSING",entity.layer?`Mapped unknown layer ${entity.layer} to Layer 0.`:"Mapped entity without a layer to Layer 0.",details);layerId=defaultId}let color=null;if(entity.properties.color.mode==="truecolor")color=window.CaderactDxfProperties.trueColorToHex(entity.properties.color.value);else if(entity.properties.color.mode==="aci")color=window.CaderactDxfProperties.aciToHex(entity.properties.color.value);else if(entity.properties.color.mode==="byblock")warn("DXF_BYBLOCK_FALLBACK","Mapped BYBLOCK color to ByLayer because block inheritance is unavailable.",details);return Object.freeze({...geometryRecord(entity),layerId,color,linetype:mapLinetype(entity.properties.linetype,false,details),lineweight:mapLineweight(entity.properties.lineweight,false,details)})}
    const records=parsed.entities.map(mapEntity),recordTable=Object.fromEntries(records.map(record=>[record.id,record]))
    let currentLayerId=parsed.source.currentLayer?layerIds.get(parsed.source.currentLayer.toLowerCase()):defaultId
    if(parsed.source.currentLayer&&!currentLayerId)warn("DXF_CURRENT_LAYER_UNKNOWN",`Mapped unknown current layer ${parsed.source.currentLayer} to a usable layer.`,{section:"HEADER"})
    const usable=layer=>layer.visible&&!layer.locked
    if(!currentLayerId||!usable(layerTable[currentLayerId])){if(currentLayerId)warn("DXF_CURRENT_LAYER_UNAVAILABLE","DXF current layer is hidden or locked; selected a usable current layer.",{section:"HEADER"});currentLayerId=nativeLayers.find(usable)?.id}
    if(!currentLayerId){layerTable[defaultId]=Object.freeze({...layerTable[defaultId],visible:true,locked:false});currentLayerId=defaultId;warn("DXF_CURRENT_LAYER_RECOVERED","Made Layer 0 visible and unlocked so the imported document has a usable current layer.",{section:"HEADER"})}
    const base=draft.reader.snapshot(),candidate={...base,units:{length:unit},layers:layerTable,defaultLayerId:defaultId,currentLayerId,geometry:{objects:recordTable}}
    let store;try{store=window.CaderactDocument.createStore({document:candidate,initiallySaved:false})}catch(error){throw new DxfImportError(`Unable to publish imported DXF: ${error.message}`,diagnostics.snapshot())}
    return Object.freeze({store,parsed,diagnostics:diagnostics.snapshot(),importedCount:records.length,unit})
  }
  window.CaderactDxfImport=Object.freeze({createStore,INSUNITS,DxfImportError})
})()
