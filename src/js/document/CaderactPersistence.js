// A8: deterministic, versioned serialization for durable document content.
(() => {
  const FILE_VERSION = 3
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value)

  function invalid(message) { throw new Error(`Invalid Caderact file: ${message}`) }
  function rejectUnknown(value, allowedFields, label) {
    const unknown = window.CaderactDocument.unknownFields(value, allowedFields)
    if (unknown.length) invalid(`${label} contains unknown field${unknown.length === 1 ? "" : "s"} ${unknown.join(", ")}`)
  }
  function sortById(values) { return Array.from(values).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0) }
  function canonicalLayer(layer) {
    return { id: layer.id, name: layer.name, visible: layer.visible, locked: layer.locked, ...window.CaderactObjectProperties.layerProperties(layer) }
  }
  const canonicalGroup=group=>({id:group.id,name:group.name,memberIds:Array.from(group.memberIds)})
  const canonicalDefinition=definition=>({id:definition.id,name:definition.name,basePoint:{x:definition.basePoint.x,y:definition.basePoint.y},records:definition.recordOrder.map(id=>canonicalRecord(definition.records[id])),recordOrder:Array.from(definition.recordOrder)})
  const properties=record=>window.CaderactObjectProperties.recordProperties(record)
  function canonicalRecord(record) {
    if (record.type === "line") return {
      id: record.id, type: record.type, layerId: record.layerId, ...properties(record),
      start: { x: record.start?.x, y: record.start?.y, featureId: record.start?.featureId },
      end: { x: record.end?.x, y: record.end?.y, featureId: record.end?.featureId },
    }
    if(record.type === "polyline")return {id:record.id,type:record.type,layerId:record.layerId,...properties(record),
      vertices:record.vertices.map(vertex=>({x:vertex?.x,y:vertex?.y,featureId:vertex?.featureId})),closed:record.closed}
    if (record.type === "circle") return {
      id: record.id, type: record.type, layerId: record.layerId, ...properties(record),
      center: { x: record.center?.x, y: record.center?.y }, radius: record.radius,
    }
    if (record.type === "arc") return {
      id: record.id, type: record.type, layerId: record.layerId, ...properties(record),
      center: { x: record.center?.x, y: record.center?.y }, radius: record.radius,
      start: { x: record.start?.x, y: record.start?.y, featureId: record.start?.featureId },
      end: { x: record.end?.x, y: record.end?.y, featureId: record.end?.featureId }, sweep: record.sweep,
    }
    if (record.type === "ellipse") return {
      id: record.id, type: record.type, layerId: record.layerId, ...properties(record),
      center: { x: record.center?.x, y: record.center?.y },
      majorAxis: { x: record.majorAxis?.x, y: record.majorAxis?.y }, minorRadius: record.minorRadius,
    }
    const feature=value=>({x:value?.x,y:value?.y,featureId:value?.featureId})
    if(record.type==="dimension-linear")return {id:record.id,type:record.type,layerId:record.layerId,...properties(record),mode:record.mode,firstPoint:feature(record.firstPoint),secondPoint:feature(record.secondPoint),dimensionLinePoint:feature(record.dimensionLinePoint),textOverride:record.textOverride,dimensionStyleId:record.dimensionStyleId}
    if(record.type==="dimension-angular")return {id:record.id,type:record.type,layerId:record.layerId,...properties(record),firstRayPoint:feature(record.firstRayPoint),vertex:feature(record.vertex),secondRayPoint:feature(record.secondRayPoint),dimensionArcPoint:feature(record.dimensionArcPoint),textOverride:record.textOverride,dimensionStyleId:record.dimensionStyleId}
    if(record.type==="dimension-radial")return {id:record.id,type:record.type,layerId:record.layerId,...properties(record),mode:record.mode,centerPoint:feature(record.centerPoint),dimensionPoint:feature(record.dimensionPoint),leaderPoint:feature(record.leaderPoint),textOverride:record.textOverride,dimensionStyleId:record.dimensionStyleId}
    if(record.type==="text")return{id:record.id,type:record.type,layerId:record.layerId,...properties(record),insertionPoint:feature(record.insertionPoint),text:record.text,height:record.height,rotation:record.rotation,horizontalAlignment:record.horizontalAlignment}
    if(record.type==="block-instance")return{id:record.id,type:record.type,layerId:record.layerId,...properties(record),definitionId:record.definitionId,insertionPoint:feature(record.insertionPoint),rotation:record.rotation,scale:record.scale,mirrored:record.mirrored}
    if(record.type==="region"||record.type==="hatch")return{id:record.id,type:record.type,layerId:record.layerId,...properties(record),loops:record.loops.map(loop=>({featureId:loop.featureId,depth:loop.depth,parentIndex:loop.parentIndex,edges:loop.edges.map(edge=>{const result={kind:edge.kind,featureId:edge.featureId};for(const key of ["start","end"])if(edge[key])result[key]=feature(edge[key]);for(const key of ["center","majorAxis"])if(edge[key])result[key]={x:edge[key].x,y:edge[key].y};for(const key of ["radius","minorRadius","sweep","clockwise"])if(edge[key]!==undefined)result[key]=edge[key];return result})})),...(record.type==="hatch"?{pattern:record.pattern.kind==="named"?{kind:"named",name:record.pattern.name,angle:record.pattern.angle,scale:record.pattern.scale,origin:{x:record.pattern.origin.x,y:record.pattern.origin.y}}:{kind:"solid"}}:{})}
    return { id: record.id, type: record.type }
  }
  function payloadFor(document) {
    const errors = window.CaderactDocument.validateDocument(document)
    if (errors.length) invalid(errors.join("; "))
    return {
      fileVersion: FILE_VERSION,
      document: {
        id: document.id,
        name: document.name,
        formatVersion: document.formatVersion,
        units: { length: document.units.length },
        dimensionStyles:document.dimensionStyleOrder.map(id=>({...document.dimensionStyles[id]})),currentDimensionStyleId:document.currentDimensionStyleId,
        defaultLayerId: document.defaultLayerId,
        currentLayerId: document.currentLayerId,
        layers: sortById(Object.values(document.layers)).map(canonicalLayer),
        records: sortById(Object.values(document.geometry.objects)).map(canonicalRecord),
        groups:sortById(Object.values(document.groups)).map(canonicalGroup),nextGroupNumber:document.nextGroupNumber,blockDefinitions:sortById(Object.values(document.blockDefinitions)).map(canonicalDefinition),
      },
    }
  }
  function serializeDocument(document) { return JSON.stringify(payloadFor(document)) }

  function parsePayload(serialized) {
    if (typeof serialized !== "string") invalid("serialized input must be a JSON string")
    let payload
    try { payload = JSON.parse(serialized) } catch { invalid("malformed JSON") }
    if (!isRecord(payload)) invalid("root must be an object")
    if (![1,2,FILE_VERSION].includes(payload.fileVersion)) invalid(`unsupported fileVersion ${String(payload.fileVersion)}`)
    const legacy=payload.fileVersion===1,version2=payload.fileVersion===2
    const fields = legacy?window.CaderactDocument.V1_FIELDS:version2?window.CaderactDocument.V2_FIELDS:window.CaderactDocument.V3_FIELDS
    rejectUnknown(payload, fields.fileEnvelope, "root")
    const source = payload.document
    if (!isRecord(source)) invalid("missing document")
    rejectUnknown(source, fields.persistedDocument, "document")
    if (!isRecord(source.units)) invalid("units must be an object")
    rejectUnknown(source.units, fields.units, "units")
    if(version2){if(!isRecord(source.dimensionStyle))invalid("dimensionStyle must be an object");rejectUnknown(source.dimensionStyle,fields.dimensionStyle,"dimensionStyle")}
    if(!legacy&&!version2){if(!Array.isArray(source.dimensionStyles)||!source.dimensionStyles.length)invalid("dimensionStyles must be a non-empty array");for(const style of source.dimensionStyles){if(!isRecord(style))invalid("dimension style entry must be an object");rejectUnknown(style,fields.dimensionStyle,"dimension style entry")}}
    if(source.formatVersion!==payload.fileVersion)invalid(`document formatVersion does not match fileVersion ${payload.fileVersion}`)
    if (!Array.isArray(source.layers)) invalid("layers must be an array")
    if (!Array.isArray(source.records)) invalid("records must be an array")
    if(!legacy&&!version2&&source.groups!==undefined&&!Array.isArray(source.groups))invalid("groups must be an array")
    if(!legacy&&!version2&&source.blockDefinitions!==undefined&&!Array.isArray(source.blockDefinitions))invalid("blockDefinitions must be an array")

    function tableFrom(items, label, canonicalize) {
      const entries = [], ids = new Set()
      for (const item of items) {
        if (!isRecord(item)) invalid(`${label} entry must be an object`)
        if (label === "layer") rejectUnknown(item, fields.layer, "layer entry")
        if (label === "record"||label==="definition record") {
          if (item.type === "line") {
            rejectUnknown(item, fields.line, "Line record")
            if (!isRecord(item.start) || !isRecord(item.end)) invalid("Line endpoints must be objects")
            rejectUnknown(item.start, fields.endpoint, "Line start")
            rejectUnknown(item.end, fields.endpoint, "Line end")
          } else if(item.type === "polyline") {
            rejectUnknown(item,fields.polyline,"Polyline record")
            if(!Array.isArray(item.vertices))invalid("Polyline vertices must be an array")
            for(const vertex of item.vertices){if(!isRecord(vertex))invalid("Polyline vertex must be an object");rejectUnknown(vertex,fields.vertex,"Polyline vertex")}
          } else if (item.type === "circle") {
            rejectUnknown(item, fields.circle, "Circle record")
            if (!isRecord(item.center)) invalid("Circle center must be an object")
            rejectUnknown(item.center, fields.coordinate, "Circle center")
          } else if (item.type === "arc") {
            rejectUnknown(item, fields.arc, "Arc record")
            if (!isRecord(item.center) || !isRecord(item.start) || !isRecord(item.end)) invalid("Arc center and endpoints must be objects")
            rejectUnknown(item.center, fields.coordinate, "Arc center")
            rejectUnknown(item.start, fields.endpoint, "Arc start")
            rejectUnknown(item.end, fields.endpoint, "Arc end")
          } else if (item.type === "ellipse") {
            rejectUnknown(item, fields.ellipse, "Ellipse record")
            if (!isRecord(item.center) || !isRecord(item.majorAxis)) invalid("Ellipse center and major axis must be objects")
            rejectUnknown(item.center, fields.coordinate, "Ellipse center")
            rejectUnknown(item.majorAxis, fields.coordinate, "Ellipse major axis")
          } else if(!legacy&&item.type==="dimension-linear"){
            rejectUnknown(item,fields.dimensionLinear,"Linear dimension record");for(const key of ["firstPoint","secondPoint","dimensionLinePoint"]){if(!isRecord(item[key]))invalid(`Linear dimension ${key} must be an object`);rejectUnknown(item[key],fields.endpoint,`Linear dimension ${key}`)}
          } else if(!legacy&&item.type==="dimension-angular"){
            rejectUnknown(item,fields.dimensionAngular,"Angular dimension record");for(const key of ["firstRayPoint","vertex","secondRayPoint","dimensionArcPoint"]){if(!isRecord(item[key]))invalid(`Angular dimension ${key} must be an object`);rejectUnknown(item[key],fields.endpoint,`Angular dimension ${key}`)}
          } else if(!legacy&&item.type==="dimension-radial"){
            rejectUnknown(item,fields.dimensionRadial,"Radial dimension record");for(const key of ["centerPoint","dimensionPoint","leaderPoint"]){if(!isRecord(item[key]))invalid(`Radial dimension ${key} must be an object`);rejectUnknown(item[key],fields.endpoint,`Radial dimension ${key}`)}
          } else if(!legacy&&!version2&&item.type==="text"){
            rejectUnknown(item,fields.text,"Text record");if(!isRecord(item.insertionPoint))invalid("Text insertion point must be an object");rejectUnknown(item.insertionPoint,fields.endpoint,"Text insertion point")
          } else if(!legacy&&!version2&&item.type==="block-instance"){
            rejectUnknown(item,fields.blockInstance,"Block Instance record");if(!isRecord(item.insertionPoint))invalid("Block Instance insertion point must be an object");rejectUnknown(item.insertionPoint,fields.endpoint,"Block Instance insertion point")
          } else if(!legacy&&!version2&&(item.type==="region"||item.type==="hatch")){
            const label=item.type==="hatch"?"Hatch":"Region";rejectUnknown(item,fields[item.type],`${label} record`);if(item.type==="hatch"){if(!isRecord(item.pattern))invalid("Hatch pattern must be an object");rejectUnknown(item.pattern,fields.hatchPattern,"Hatch pattern");if(item.pattern.origin){if(!isRecord(item.pattern.origin))invalid("Hatch pattern origin must be an object");rejectUnknown(item.pattern.origin,fields.coordinate,"Hatch pattern origin")}}if(!Array.isArray(item.loops))invalid(`${label} loops must be an array`);for(const loop of item.loops){if(!isRecord(loop))invalid(`${label} loop must be an object`);rejectUnknown(loop,fields.regionLoop,`${label} loop`);if(!Array.isArray(loop.edges))invalid(`${label} edges must be an array`);for(const edge of loop.edges){if(!isRecord(edge))invalid(`${label} edge must be an object`);rejectUnknown(edge,fields.regionEdge,`${label} edge`);for(const key of ["start","end"])if(edge[key])rejectUnknown(edge[key],fields.endpoint,`${label} edge ${key}`);for(const key of ["center","majorAxis"])if(edge[key])rejectUnknown(edge[key],fields.coordinate,`${label} edge ${key}`)}}
          } else invalid(`unsupported record type ${String(item.type)}`)
        }
        if (typeof item.id !== "string" || item.id.trim() === "") invalid(`${label} entry is missing an ID`)
        if (ids.has(item.id)) invalid(`duplicate ${label} ID ${item.id}`)
        ids.add(item.id); entries.push([item.id, canonicalize(item)])
      }
      return Object.fromEntries(entries)
    }

    const layers = tableFrom(source.layers, "layer", canonicalLayer)
    const objects = tableFrom(source.records, "record", canonicalRecord)
    const groups=legacy||version2||source.groups===undefined?{}:tableFrom(source.groups,"group",group=>{rejectUnknown(group,fields.group,"Group entry");if(!Array.isArray(group.memberIds))invalid("Group memberIds must be an array");return canonicalGroup(group)})
    const blockDefinitions={}
    if(!legacy&&!version2)for(const definition of source.blockDefinitions||[]){if(!isRecord(definition))invalid("Block Definition entry must be an object");rejectUnknown(definition,fields.blockDefinition,"Block Definition entry");if(!isRecord(definition.basePoint))invalid("Block Definition basePoint must be an object");rejectUnknown(definition.basePoint,fields.coordinate,"Block Definition basePoint");if(!Array.isArray(definition.records)||!Array.isArray(definition.recordOrder))invalid("Block Definition records/order must be arrays");if(blockDefinitions[definition.id])invalid(`duplicate Block Definition ID ${definition.id}`);const records=tableFrom(definition.records,"definition record",canonicalRecord);blockDefinitions[definition.id]={id:definition.id,name:definition.name,basePoint:{x:definition.basePoint.x,y:definition.basePoint.y},records,recordOrder:Array.from(definition.recordOrder)}}
    let styleId,dimensionStyles,dimensionStyleOrder,currentDimensionStyleId
    if(legacy||version2){styleId=`ds_${source.id}_standard`;dimensionStyles={[styleId]:{id:styleId,name:"Standard",...(version2?source.dimensionStyle:window.CaderactDocument.DEFAULT_DIMENSION_STYLE)}};dimensionStyleOrder=[styleId];currentDimensionStyleId=styleId;for(const record of Object.values(objects))if(record.type.startsWith("dimension-"))record.dimensionStyleId=styleId}
    else {dimensionStyles=tableFrom(source.dimensionStyles,"dimension style",style=>({...style}));dimensionStyleOrder=source.dimensionStyles.map(style=>style.id);currentDimensionStyleId=source.currentDimensionStyleId}
    const candidate = {
      id: source.id,
      name: source.name,
      formatVersion: 3,
      units: { length: source.units?.length },
      dimensionStyles,dimensionStyleOrder,currentDimensionStyleId,
      geometry: { objects },
      groups,nextGroupNumber:legacy||version2||source.nextGroupNumber===undefined?1:source.nextGroupNumber,blockDefinitions,
      layers,
      defaultLayerId: source.defaultLayerId,
      currentLayerId: source.currentLayerId,
    }
    const errors = window.CaderactDocument.validateDocument(candidate)
    if (errors.length) invalid(errors.join("; "))
    return candidate
  }

  function deserializeDocument(serialized) { return parsePayload(serialized) }
  function loadStore(serialized) {
    return window.CaderactDocument.createStore({ document: parsePayload(serialized), initiallySaved: true })
  }
  function captureSave(reader, controller) {
    const token = controller.captureStateToken()
    const serialized = serializeDocument(reader.snapshot())
    return Object.freeze({
      serialized, stateId: token.stateId, revision: token.revision,
      acknowledge: () => controller.markStateSaved(token),
    })
  }

  window.CaderactPersistence = Object.freeze({
    FILE_VERSION, serializeDocument, deserializeDocument, loadStore, captureSave,
  })
})()
