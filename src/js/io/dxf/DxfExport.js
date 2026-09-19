// DXF5: deterministic, renderer-neutral ASCII DXF export for the native interoperability subset.
(() => {
  const VERSION="AC1018",UNITS=Object.freeze({in:1,ft:2,mm:4,cm:5,m:6})
  const LTYPE=Object.freeze({continuous:"CONTINUOUS",dashed:"DASHED",dotted:"DOTTED","dash-dot":"DASHDOT"})
  const LTYPE_PATTERNS=Object.freeze({CONTINUOUS:Object.freeze({length:0,values:[]}),DASHED:Object.freeze({length:.75,values:[.5,-.25]}),DOTTED:Object.freeze({length:.25,values:[0,-.25]}),DASHDOT:Object.freeze({length:.9,values:[.5,-.2,0,-.2]})})
  class DxfExportError extends Error{constructor(message,diagnostics){super(message);this.name="DxfExportError";this.diagnostics=Object.freeze(diagnostics)}}
  function number(value){if(!Number.isFinite(value))throw new Error("DXF export requires finite numbers.");return Object.is(value,-0)?"0":String(value)}
  function integer(value){if(!Number.isSafeInteger(value))throw new Error("DXF export requires safe integers.");return String(value)}
  function trueColor(color){return Number.parseInt(color.slice(1),16)}
  function encodeText(value){let output="";for(let index=0;index<value.length;index++){const code=value.charCodeAt(index),character=value[index];output+=code>=32&&code<=126&&character!=="\\"?character:`\\U+${code.toString(16).toUpperCase().padStart(4,"0")}`}return output}
  function exportDocument(document){
    const validation=window.CaderactDocument.validateDocument(document)
    if(validation.length)throw new DxfExportError(`Cannot export invalid document: ${validation.join("; ")}`,[])
    const unitCode=UNITS[document.units.length]
    if(!unitCode)throw new DxfExportError(`Unsupported DXF export unit ${document.units.length}.`,[])
    const collector=window.CaderactDxfDiagnostics.createCollector(window.CaderactDxfLimits.DEFAULTS.maxDiagnostics)
    const layers=Object.values(document.layers).sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base"})||a.name.localeCompare(b.name))
    const layerNames=new Map(layers.map(layer=>[layer.id,layer.name])),current=layerNames.get(document.currentLayerId)
    const supported=new Set(["line","polyline","circle","arc","ellipse","text"])
    const unsupported=Object.values(document.geometry.objects).filter(record=>!supported.has(record.type))
    if(unsupported.length){for(const record of unsupported)collector.add({severity:"error",code:"DXF_EXPORT_UNSUPPORTED_RECORD",message:`DXF5 cannot export native ${record.type} records.`,entityType:record.type});throw new DxfExportError("DXF export contains unsupported native records.",collector.snapshot())}
    const semanticKey=record=>JSON.stringify({...record,id:undefined,layerId:layerNames.get(record.layerId)},(key,value)=>key==="featureId"?undefined:value)
    const records=Object.values(document.geometry.objects).sort((a,b)=>{const ak=`${a.type}\0${semanticKey(a)}`,bk=`${b.type}\0${semanticKey(b)}`;return ak.localeCompare(bk)})
    const pairs=[],add=(code,value)=>{pairs.push(String(code),String(value))}
    const common=record=>{const layer=layerNames.get(record.layerId);if(!layer)throw new DxfExportError(`Record ${record.type} has an invalid layer reference.`,collector.snapshot());add(8,layer);if(record.color===null)add(62,256);else{add(62,7);add(420,integer(trueColor(record.color)))}add(6,record.linetype===null?"BYLAYER":LTYPE[record.linetype]);add(370,record.lineweight===null?-1:Math.round(record.lineweight*100))}
    add(0,"SECTION");add(2,"HEADER");add(9,"$ACADVER");add(1,VERSION);add(9,"$INSUNITS");add(70,unitCode);add(9,"$CLAYER");add(8,current);add(0,"ENDSEC")
    add(0,"SECTION");add(2,"TABLES");add(0,"TABLE");add(2,"LTYPE");add(70,Object.keys(LTYPE_PATTERNS).length)
    for(const [name,pattern] of Object.entries(LTYPE_PATTERNS)){add(0,"LTYPE");add(2,name);add(70,0);add(3,name);add(72,65);add(73,pattern.values.length);add(40,number(pattern.length));for(const value of pattern.values)add(49,number(value))}add(0,"ENDTAB")
    add(0,"TABLE");add(2,"LAYER");add(70,layers.length)
    for(const layer of layers){add(0,"LAYER");add(2,layer.name);add(70,layer.locked?4:0);add(62,layer.visible?7:-7);add(420,integer(trueColor(layer.color)));add(6,LTYPE[layer.linetype]);add(370,Math.round(layer.lineweight*100))}add(0,"ENDTAB");add(0,"ENDSEC")
    add(0,"SECTION");add(2,"ENTITIES")
    for(const record of records){
      add(0,record.type==="line"?"LINE":record.type==="polyline"?"LWPOLYLINE":record.type.toUpperCase());common(record)
      if(record.type==="line"){add(10,number(record.start.x));add(20,number(record.start.y));add(30,0);add(11,number(record.end.x));add(21,number(record.end.y));add(31,0)}
      else if(record.type==="polyline"){add(90,record.vertices.length);add(70,record.closed?1:0);for(const vertex of record.vertices){add(10,number(vertex.x));add(20,number(vertex.y))}}
      else if(record.type==="circle"){add(10,number(record.center.x));add(20,number(record.center.y));add(30,0);add(40,number(record.radius))}
      else if(record.type==="arc"){let start=Math.atan2(record.start.y-record.center.y,record.start.x-record.center.x),end=start+record.sweep;if(record.sweep<0){start=Math.atan2(record.end.y-record.center.y,record.end.x-record.center.x);end=start-record.sweep;collector.add({severity:"warning",code:"DXF_ARC_DIRECTION_CANONICALIZED",message:"Exported a clockwise native Arc as the equivalent counterclockwise DXF ARC locus.",entityType:"ARC"})}add(10,number(record.center.x));add(20,number(record.center.y));add(30,0);add(40,number(record.radius));add(50,number(start*180/Math.PI));add(51,number(end*180/Math.PI))}
      else if(record.type==="ellipse"){const major=Math.hypot(record.majorAxis.x,record.majorAxis.y),ratio=record.minorRadius/major;if(ratio>1)throw new DxfExportError("DXF ELLIPSE requires the stored major axis to be at least the minor radius.",[{severity:"error",code:"DXF_EXPORT_ELLIPSE_RATIO_UNSUPPORTED",message:"Cannot export an Ellipse whose native minor radius exceeds its stored major-axis length.",entityType:"ELLIPSE"}]);add(10,number(record.center.x));add(20,number(record.center.y));add(30,0);add(11,number(record.majorAxis.x));add(21,number(record.majorAxis.y));add(31,0);add(40,number(ratio));add(41,0);add(42,number(Math.PI*2))}
      else if(record.type==="text"){const degrees=record.rotation*180/Math.PI,justification={left:0,center:1,right:2}[record.horizontalAlignment];add(10,number(record.insertionPoint.x));add(20,number(record.insertionPoint.y));add(30,0);add(40,number(record.height));add(1,encodeText(record.text));add(50,number(degrees));add(72,justification);add(73,0);if(justification!==0){add(11,number(record.insertionPoint.x));add(21,number(record.insertionPoint.y));add(31,0)}}
    }
    add(0,"ENDSEC");add(0,"EOF")
    return Object.freeze({text:`${pairs.join("\n")}\n`,diagnostics:collector.snapshot(),exportedCount:records.length,version:VERSION,unit:document.units.length})
  }
  window.CaderactDxfExport=Object.freeze({exportDocument,number,encodeText,VERSION,DxfExportError})
})()
