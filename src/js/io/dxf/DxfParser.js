// DXF1/DXF2: bounded ASCII group-code parser producing neutral ParsedDxf values.
(() => {
  const BINARY_SENTINEL = "AutoCAD Binary DXF", NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/
  const TAU = Math.PI * 2, ANGULAR_TOLERANCE = 1e-12
  class DxfParseError extends Error { constructor(message, diagnostics) { super(message); this.name = "DxfParseError"; this.diagnostics = diagnostics } }
  function fail(collector, code, message, detail = {}) { collector.add({ severity: "error", code, message, ...detail }); throw new DxfParseError(message, collector.snapshot()) }
  const details = entity => ({ section: "ENTITIES", entityType: entity.type, handle: entity.handle, sourceIndex: entity.sourceIndex })
  function warn(collector, entity, code, message) { collector.add({ severity: "warning", code, message, ...details(entity) }) }
  function finiteNumber(pair, collector, label, entity = null) {
    const value = pair?.value?.trim()
    if (!value || !NUMBER.test(value) || !Number.isFinite(Number(value))) fail(collector, "DXF_INVALID_NUMBER", `${label} must be a finite number.`, { ...(entity ? details(entity) : {}), sourceIndex: pair?.sourceIndex ?? entity?.sourceIndex })
    return Number(value)
  }
  function integer(pair, collector, label, entity = null) {
    const value = finiteNumber(pair, collector, label, entity)
    if (!Number.isInteger(value)) fail(collector, "DXF_INVALID_INTEGER", `${label} must be an integer.`, { ...(entity ? details(entity) : {}), sourceIndex: pair?.sourceIndex ?? entity?.sourceIndex })
    return value
  }
  function tokenize(text, limits, collector) {
    if (typeof text !== "string") fail(collector, "DXF_INVALID_TEXT", "DXF input must be text.")
    if (text.startsWith(BINARY_SENTINEL) || text.includes("\u0000")) fail(collector, "DXF_BINARY_UNSUPPORTED", "Binary DXF is not supported in DXF1.")
    if (text.length > limits.maxTextLength) fail(collector, "DXF_TEXT_LIMIT", "DXF text exceeds the configured size limit.")
    const lines = text.split(/\r\n|\n|\r/); if (lines.at(-1) === "") lines.pop()
    if (lines.length % 2) fail(collector, "DXF_MALFORMED_PAIR", "DXF input contains an incomplete group-code pair.", { sourceIndex: lines.length })
    if (lines.length / 2 > limits.maxGroupPairs) fail(collector, "DXF_GROUP_PAIR_LIMIT", "DXF group-pair limit exceeded.")
    const pairs = []
    for (let index = 0; index < lines.length; index += 2) {
      const codeText = lines[index].trim()
      if (!/^\d+$/.test(codeText)) fail(collector, "DXF_INVALID_GROUP_CODE", "DXF group code must be a non-negative integer.", { sourceIndex: index + 1 })
      const code = Number(codeText)
      if (!Number.isSafeInteger(code) || code > 1071) fail(collector, "DXF_INVALID_GROUP_CODE", "DXF group code is outside the supported range.", { sourceIndex: index + 1 })
      const value = lines[index + 1]
      if (value.length > limits.maxStringLength) fail(collector, "DXF_STRING_LIMIT", "DXF value exceeds the configured string limit.", { sourceIndex: index + 2 })
      pairs.push(Object.freeze({ code, value, sourceIndex: index + 1 }))
    }
    return Object.freeze(pairs)
  }
  const all = (entity, code) => entity.pairs.filter(pair => pair.code === code)
  const first = (entity, code) => entity.pairs.find(pair => pair.code === code)
  function one(entity, code, collector, label, errorCode = "DXF_MALFORMED_ENTITY") {
    const pairs = all(entity, code)
    if (pairs.length !== 1) fail(collector, errorCode, `${entity.type} requires exactly one ${label} value.`, details(entity))
    return pairs[0]
  }
  function optionalNumber(entity, code, collector, label, fallback = 0) {
    const pairs = all(entity, code)
    if (pairs.length > 1) fail(collector, "DXF_MALFORMED_ENTITY", `${entity.type} has duplicate ${label} values.`, details(entity))
    return pairs.length ? finiteNumber(pairs[0], collector, `${entity.type} ${label}`, entity) : fallback
  }
  function optionalInteger(entity, code, collector, label, fallback = 0) {
    const pairs = all(entity, code)
    if (pairs.length > 1) fail(collector, "DXF_MALFORMED_ENTITY", `${entity.type} has duplicate ${label} values.`, details(entity))
    return pairs.length ? integer(pairs[0], collector, `${entity.type} ${label}`, entity) : fallback
  }
  const extrusion = (entity, collector) => Object.freeze({ x: optionalNumber(entity, 210, collector, "extrusion X", 0), y: optionalNumber(entity, 220, collector, "extrusion Y", 0), z: optionalNumber(entity, 230, collector, "extrusion Z", 1) })
  const defaultExtrusion = value => value.x === 0 && value.y === 0 && value.z === 1
  function entityProperties(entity, collector) {
    const colorPairs=all(entity,62),trueColorPairs=all(entity,420),linetypePairs=all(entity,6),lineweightPairs=all(entity,370)
    if(colorPairs.length>1||trueColorPairs.length>1||linetypePairs.length>1||lineweightPairs.length>1)fail(collector,"DXF_MALFORMED_PROPERTY",`${entity.type} has duplicate common property values.`,details(entity))
    const aci=colorPairs.length?integer(colorPairs[0],collector,`${entity.type} color`,entity):256
    if(aci < -255 || aci > 256)fail(collector,"DXF_INVALID_COLOR",`${entity.type} has an invalid ACI color.`,details(entity))
    let color
    if(trueColorPairs.length){const value=integer(trueColorPairs[0],collector,`${entity.type} true color`,entity);if(value<0||value>0xffffff)fail(collector,"DXF_INVALID_TRUE_COLOR",`${entity.type} true color is outside 24-bit RGB.`,details(entity));color=Object.freeze({mode:"truecolor",value})}
    else if(aci===256)color=Object.freeze({mode:"bylayer"})
    else if(aci===0)color=Object.freeze({mode:"byblock"})
    else {if(aci<0)warn(collector,entity,"DXF_ENTITY_NEGATIVE_ACI","Mapped a negative entity ACI by its absolute color index; per-object off state is unsupported.");color=Object.freeze({mode:"aci",value:Math.abs(aci)})}
    const linetype=linetypePairs.length?linetypePairs[0].value.trim():"BYLAYER"
    if(!linetype)fail(collector,"DXF_INVALID_LINETYPE",`${entity.type} has an empty linetype name.`,details(entity))
    const lineweight=lineweightPairs.length?integer(lineweightPairs[0],collector,`${entity.type} lineweight`,entity):-1
    if(!window.CaderactDxfProperties.DXF_LINEWEIGHTS.has(lineweight))fail(collector,"DXF_INVALID_LINEWEIGHT",`${entity.type} has an invalid DXF lineweight enum.`,details(entity))
    return Object.freeze({color,linetype,lineweight})
  }
  const neutralBase = (entity,collector) => ({ type: entity.type, handle: entity.handle || null,
    layer: first(entity, 8)?.value?.trim() || null, properties:entityProperties(entity,collector),sourceIndex: entity.sourceIndex })
  function parseLine(entity, collector) {
    const x1 = finiteNumber(one(entity, 10, collector, "start X", "DXF_MALFORMED_LINE"), collector, "LINE start X", entity), y1 = finiteNumber(one(entity, 20, collector, "start Y", "DXF_MALFORMED_LINE"), collector, "LINE start Y", entity)
    const x2 = finiteNumber(one(entity, 11, collector, "end X", "DXF_MALFORMED_LINE"), collector, "LINE end X", entity), y2 = finiteNumber(one(entity, 21, collector, "end Y", "DXF_MALFORMED_LINE"), collector, "LINE end Y", entity)
    if (optionalNumber(entity, 30, collector, "start Z") !== 0 || optionalNumber(entity, 31, collector, "end Z") !== 0 || optionalNumber(entity, 39, collector, "thickness") !== 0 || !defaultExtrusion(extrusion(entity, collector))) { warn(collector, entity, "DXF_LINE_NON_PLANAR", "Skipped a non-planar or non-default-extrusion LINE."); return null }
    return Object.freeze({ ...neutralBase(entity,collector), start: Object.freeze({ x: x1, y: y1 }), end: Object.freeze({ x: x2, y: y2 }) })
  }
  function parseLwPolyline(entity, collector) {
    const expected = integer(one(entity, 90, collector, "vertex count"), collector, "LWPOLYLINE vertex count", entity), flags = optionalInteger(entity, 70, collector, "flags"), closed = Boolean(flags & 1)
    if (flags & ~129) { warn(collector, entity, "DXF_LWPOLYLINE_UNSUPPORTED_FLAGS", "Skipped an LWPOLYLINE with unsupported flags."); return null }
    const vertices = []; let current = null
    for (const pair of entity.pairs) {
      if (pair.code === 10) {
        if (current && current.y === undefined) fail(collector, "DXF_MALFORMED_LWPOLYLINE", "LWPOLYLINE vertex is missing Y.", details(entity))
        current = { x: finiteNumber(pair, collector, "LWPOLYLINE vertex X", entity), y: undefined, bulge: 0, startWidth: 0, endWidth: 0 }; vertices.push(current)
      } else if ([20, 40, 41, 42].includes(pair.code)) {
        if (!current) fail(collector, "DXF_MALFORMED_LWPOLYLINE", "LWPOLYLINE vertex data appears before vertex X.", details(entity))
        const key = pair.code === 20 ? "y" : pair.code === 40 ? "startWidth" : pair.code === 41 ? "endWidth" : "bulge"
        if (key === "y" && current.y !== undefined) fail(collector, "DXF_MALFORMED_LWPOLYLINE", "LWPOLYLINE vertex has duplicate Y.", details(entity))
        current[key] = finiteNumber(pair, collector, `LWPOLYLINE vertex ${key}`, entity)
      }
    }
    if (current && current.y === undefined) fail(collector, "DXF_MALFORMED_LWPOLYLINE", "LWPOLYLINE vertex is missing Y.", details(entity))
    if (expected !== vertices.length || expected < (closed ? 3 : 2)) fail(collector, "DXF_MALFORMED_LWPOLYLINE", "LWPOLYLINE vertex count is invalid or does not match group 90.", details(entity))
    const width = optionalNumber(entity, 43, collector, "constant width"), elevation = optionalNumber(entity, 38, collector, "elevation"), thickness = optionalNumber(entity, 39, collector, "thickness")
    if (elevation !== 0 || thickness !== 0 || !defaultExtrusion(extrusion(entity, collector))) { warn(collector, entity, "DXF_LWPOLYLINE_NON_PLANAR", "Skipped a non-planar or non-default-extrusion LWPOLYLINE."); return null }
    if (width !== 0 || vertices.some(vertex => vertex.startWidth !== 0 || vertex.endWidth !== 0)) { warn(collector, entity, "DXF_LWPOLYLINE_WIDTH_UNSUPPORTED", "Skipped an LWPOLYLINE with nonzero width."); return null }
    if (vertices.some(vertex => vertex.bulge !== 0)) { warn(collector, entity, "DXF_POLYLINE_BULGE_UNSUPPORTED", "Skipped an LWPOLYLINE containing curved bulge segments."); return null }
    return Object.freeze({ ...neutralBase(entity,collector), closed, vertices: Object.freeze(vertices.map(vertex => Object.freeze({ x: vertex.x, y: vertex.y }))) })
  }
  function parseLegacyPolyline(entity, vertices, collector) {
    const flags = optionalInteger(entity, 70, collector, "flags"), closed = Boolean(flags & 1)
    if (flags & (2 | 4 | 8 | 16 | 32 | 64)) { warn(collector, entity, "DXF_POLYLINE_VARIANT_UNSUPPORTED", "Skipped a fitted, 3D, mesh, or polyface POLYLINE."); return null }
    const elevation = optionalNumber(entity, 30, collector, "elevation"), thickness = optionalNumber(entity, 39, collector, "thickness"), headerStartWidth = optionalNumber(entity, 40, collector, "default start width"), headerEndWidth = optionalNumber(entity, 41, collector, "default end width")
    if (elevation !== 0 || thickness !== 0 || !defaultExtrusion(extrusion(entity, collector))) { warn(collector, entity, "DXF_POLYLINE_NON_PLANAR", "Skipped a non-planar or non-default-extrusion POLYLINE."); return null }
    const points = [], unsupported = { variant: false, width: headerStartWidth !== 0 || headerEndWidth !== 0, bulge: false, nonPlanar: false }
    for (const vertex of vertices) {
      const vertexFlags = optionalInteger(vertex, 70, collector, "flags")
      if (vertexFlags & (1 | 2 | 8 | 16 | 32 | 64 | 128)) unsupported.variant = true
      const x = finiteNumber(one(vertex, 10, collector, "X", "DXF_MALFORMED_POLYLINE"), collector, "VERTEX X", vertex), y = finiteNumber(one(vertex, 20, collector, "Y", "DXF_MALFORMED_POLYLINE"), collector, "VERTEX Y", vertex)
      if (optionalNumber(vertex, 30, collector, "Z") !== 0) unsupported.nonPlanar = true
      if (optionalNumber(vertex, 40, collector, "start width") !== 0 || optionalNumber(vertex, 41, collector, "end width") !== 0) unsupported.width = true
      if (optionalNumber(vertex, 42, collector, "bulge") !== 0) unsupported.bulge = true
      points.push(Object.freeze({ x, y }))
    }
    if (unsupported.variant) { warn(collector, entity, "DXF_POLYLINE_VARIANT_UNSUPPORTED", "Skipped a fitted, 3D, mesh, or polyface POLYLINE."); return null }
    if (unsupported.nonPlanar) { warn(collector, entity, "DXF_POLYLINE_NON_PLANAR", "Skipped a non-planar POLYLINE."); return null }
    if (unsupported.width) { warn(collector, entity, "DXF_POLYLINE_WIDTH_UNSUPPORTED", "Skipped a POLYLINE with nonzero width."); return null }
    if (unsupported.bulge) { warn(collector, entity, "DXF_POLYLINE_BULGE_UNSUPPORTED", "Skipped a POLYLINE containing curved bulge segments."); return null }
    if (points.length < (closed ? 3 : 2)) fail(collector, "DXF_MALFORMED_POLYLINE", "POLYLINE has too few vertices.", details(entity))
    return Object.freeze({ ...neutralBase(entity,collector), closed, vertices: Object.freeze(points) })
  }
  function parseCircle(entity, collector) {
    const x = finiteNumber(one(entity, 10, collector, "center X"), collector, "CIRCLE center X", entity), y = finiteNumber(one(entity, 20, collector, "center Y"), collector, "CIRCLE center Y", entity), radius = finiteNumber(one(entity, 40, collector, "radius"), collector, "CIRCLE radius", entity)
    if (!(radius > 0)) fail(collector, "DXF_INVALID_CIRCLE", "CIRCLE radius must be greater than zero.", details(entity))
    if (optionalNumber(entity, 30, collector, "center Z") !== 0 || optionalNumber(entity, 39, collector, "thickness") !== 0 || !defaultExtrusion(extrusion(entity, collector))) { warn(collector, entity, "DXF_CIRCLE_NON_PLANAR", "Skipped a non-planar or non-default-extrusion CIRCLE."); return null }
    return Object.freeze({ ...neutralBase(entity,collector), center: Object.freeze({ x, y }), radius })
  }
  function parseArc(entity, collector) {
    const x = finiteNumber(one(entity, 10, collector, "center X"), collector, "ARC center X", entity), y = finiteNumber(one(entity, 20, collector, "center Y"), collector, "ARC center Y", entity), radius = finiteNumber(one(entity, 40, collector, "radius"), collector, "ARC radius", entity)
    const startAngleDegrees = finiteNumber(one(entity, 50, collector, "start angle"), collector, "ARC start angle", entity), endAngleDegrees = finiteNumber(one(entity, 51, collector, "end angle"), collector, "ARC end angle", entity)
    if (!(radius > 0)) fail(collector, "DXF_INVALID_ARC", "ARC radius must be greater than zero.", details(entity))
    const sweepRadians = (((endAngleDegrees - startAngleDegrees) % 360 + 360) % 360) * Math.PI / 180
    if (!(sweepRadians > ANGULAR_TOLERANCE)) fail(collector, "DXF_INVALID_ARC", "ARC sweep is zero or degenerate.", details(entity))
    if (optionalNumber(entity, 30, collector, "center Z") !== 0 || optionalNumber(entity, 39, collector, "thickness") !== 0 || !defaultExtrusion(extrusion(entity, collector))) { warn(collector, entity, "DXF_ARC_NON_PLANAR", "Skipped a non-planar or non-default-extrusion ARC."); return null }
    return Object.freeze({ ...neutralBase(entity,collector), center: Object.freeze({ x, y }), radius, startAngleDegrees, endAngleDegrees })
  }
  function parseEllipse(entity, collector) {
    const x = finiteNumber(one(entity, 10, collector, "center X"), collector, "ELLIPSE center X", entity), y = finiteNumber(one(entity, 20, collector, "center Y"), collector, "ELLIPSE center Y", entity)
    const majorX = finiteNumber(one(entity, 11, collector, "major-axis X"), collector, "ELLIPSE major-axis X", entity), majorY = finiteNumber(one(entity, 21, collector, "major-axis Y"), collector, "ELLIPSE major-axis Y", entity)
    const ratio = finiteNumber(one(entity, 40, collector, "axis ratio"), collector, "ELLIPSE axis ratio", entity), startParameter = finiteNumber(one(entity, 41, collector, "start parameter"), collector, "ELLIPSE start parameter", entity), endParameter = finiteNumber(one(entity, 42, collector, "end parameter"), collector, "ELLIPSE end parameter", entity)
    const majorRadius = Math.hypot(majorX, majorY)
    if (!(majorRadius > 0) || !(ratio > 0 && ratio <= 1)) fail(collector, "DXF_INVALID_ELLIPSE", "ELLIPSE requires a nonzero major axis and ratio in (0, 1].", details(entity))
    if (optionalNumber(entity, 30, collector, "center Z") !== 0 || optionalNumber(entity, 31, collector, "major-axis Z") !== 0 || !defaultExtrusion(extrusion(entity, collector))) { warn(collector, entity, "DXF_ELLIPSE_NON_PLANAR", "Skipped a non-planar or non-default-extrusion ELLIPSE."); return null }
    if (Math.abs((endParameter - startParameter) - TAU) > ANGULAR_TOLERANCE * Math.max(1, Math.abs(startParameter), Math.abs(endParameter))) { warn(collector, entity, "DXF_ELLIPSE_PARTIAL_UNSUPPORTED", "Skipped a partial elliptical arc."); return null }
    return Object.freeze({ ...neutralBase(entity,collector), center: Object.freeze({ x, y }), majorAxis: Object.freeze({ x: majorX, y: majorY }), ratio, startParameter, endParameter })
  }
  function rawEntities(pairs, limits, collector) {
    const entities = []; let index = 0
    while (index < pairs.length) {
      const start = pairs[index]
      if (start.code !== 0) fail(collector, "DXF_MALFORMED_ENTITIES", "ENTITIES data must begin with an entity type.", { section: "ENTITIES", sourceIndex: start.sourceIndex })
      const type = start.value.trim().toUpperCase(); index += 1; const body = []
      while (index < pairs.length && pairs[index].code !== 0) body.push(pairs[index++])
      if (entities.length >= limits.maxEntities) fail(collector, "DXF_ENTITY_LIMIT", "DXF entity limit exceeded.", { section: "ENTITIES", entityType: type, sourceIndex: start.sourceIndex })
      entities.push({ type, pairs: body, handle: body.find(pair => pair.code === 5)?.value?.trim() || null, sourceIndex: start.sourceIndex })
    }
    return entities
  }
  function parseEntities(pairs, limits, collector) {
    const raw = rawEntities(pairs, limits, collector), entities = []
    for (let index = 0; index < raw.length; index += 1) {
      const entity = raw[index]; let parsed = null
      if (entity.type === "POLYLINE") {
        const vertices = []; let cursor = index + 1
        while (cursor < raw.length && raw[cursor].type === "VERTEX") vertices.push(raw[cursor++])
        if (cursor >= raw.length || raw[cursor].type !== "SEQEND") fail(collector, "DXF_MALFORMED_POLYLINE_SEQUENCE", "POLYLINE sequence must terminate with SEQEND.", details(entity))
        parsed = parseLegacyPolyline(entity, vertices, collector); index = cursor
      } else if (entity.type === "VERTEX" || entity.type === "SEQEND") fail(collector, "DXF_MALFORMED_POLYLINE_SEQUENCE", `${entity.type} appears outside a POLYLINE sequence.`, details(entity))
      else if (entity.type === "LINE") parsed = parseLine(entity, collector)
      else if (entity.type === "LWPOLYLINE") parsed = parseLwPolyline(entity, collector)
      else if (entity.type === "CIRCLE") parsed = parseCircle(entity, collector)
      else if (entity.type === "ARC") parsed = parseArc(entity, collector)
      else if (entity.type === "ELLIPSE") parsed = parseEllipse(entity, collector)
      else warn(collector, entity, "DXF_UNSUPPORTED_ENTITY", `Skipped unsupported ${entity.type || "unnamed"} entity.`)
      if (parsed) entities.push(parsed)
    }
    return entities
  }
  function parseTables(pairs,limits,collector){
    const layers=[],linetypes=[];let index=0,entryCount=0
    const tableFail=(code,message,pair,table)=>fail(collector,code,message,{section:"TABLES",entityType:table,sourceIndex:pair?.sourceIndex})
    while(index<pairs.length){
      const start=pairs[index]
      if(start.code!==0||start.value.trim().toUpperCase()!=="TABLE")tableFail("DXF_MALFORMED_TABLES","TABLES section must contain TABLE blocks.",start)
      index+=1;const header=[];while(index<pairs.length&&pairs[index].code!==0)header.push(pairs[index++])
      const names=header.filter(pair=>pair.code===2)
      if(names.length!==1||!names[0].value.trim())tableFail("DXF_MALFORMED_TABLE","TABLE is missing one valid name.",start)
      const table=names[0].value.trim().toUpperCase()
      while(index<pairs.length&&!(pairs[index].code===0&&pairs[index].value.trim().toUpperCase()==="ENDTAB")){
        const entryStart=pairs[index]
        if(entryStart.code!==0)tableFail("DXF_MALFORMED_TABLE",`${table} table entry is malformed.`,entryStart,table)
        const type=entryStart.value.trim().toUpperCase();index+=1;const body=[]
        while(index<pairs.length&&pairs[index].code!==0)body.push(pairs[index++])
        entryCount+=1;if(entryCount>limits.maxTableEntries)tableFail("DXF_TABLE_ENTRY_LIMIT","DXF table-entry limit exceeded.",entryStart,table)
        if(table==="LAYER"&&type!=="LAYER")tableFail("DXF_MALFORMED_LAYER_TABLE","LAYER table contains a non-LAYER entry.",entryStart,table)
        if(table==="LTYPE"&&type!=="LTYPE")tableFail("DXF_MALFORMED_LTYPE_TABLE","LTYPE table contains a non-LTYPE entry.",entryStart,table)
        if(table==="LAYER"){
          const entity={type:"LAYER",pairs:body,handle:body.find(pair=>pair.code===5)?.value?.trim()||null,sourceIndex:entryStart.sourceIndex}
          const namePairs=all(entity,2),flagPairs=all(entity,70),aciPairs=all(entity,62),linetypePairs=all(entity,6),weightPairs=all(entity,370),truePairs=all(entity,420)
          if(namePairs.length!==1||!namePairs[0].value.trim()||namePairs[0].value!==namePairs[0].value.trim()||namePairs[0].value.length>128||/[\u0000-\u001f\u007f]/.test(namePairs[0].value))tableFail("DXF_INVALID_LAYER_NAME","LAYER has an invalid name.",entryStart,table)
          if(flagPairs.length>1||aciPairs.length!==1||linetypePairs.length!==1||weightPairs.length>1||truePairs.length>1)tableFail("DXF_MALFORMED_LAYER","LAYER has missing or duplicate property values.",entryStart,table)
          const flags=flagPairs.length?integer(flagPairs[0],collector,"LAYER flags",entity):0,aci=integer(aciPairs[0],collector,"LAYER color",entity)
          if(aci===0||Math.abs(aci)>255)tableFail("DXF_INVALID_LAYER_COLOR","LAYER ACI must be from 1 through 255, optionally negative for off.",aciPairs[0],table)
          const linetype=linetypePairs[0].value.trim();if(!linetype)tableFail("DXF_INVALID_LAYER_LINETYPE","LAYER has an empty linetype.",linetypePairs[0],table)
          const lineweight=weightPairs.length?integer(weightPairs[0],collector,"LAYER lineweight",entity):-3
          if(!window.CaderactDxfProperties.DXF_LINEWEIGHTS.has(lineweight))tableFail("DXF_INVALID_LAYER_LINEWEIGHT","LAYER has an invalid lineweight enum.",weightPairs[0],table)
          let trueColor=null;if(truePairs.length){trueColor=integer(truePairs[0],collector,"LAYER true color",entity);if(trueColor<0||trueColor>0xffffff)tableFail("DXF_INVALID_LAYER_TRUE_COLOR","LAYER true color is outside 24-bit RGB.",truePairs[0],table)}
          if(flags&1)collector.add({severity:"warning",code:"DXF_LAYER_FROZEN_COLLAPSED",message:"Mapped frozen layer state to Caderact visibility.",section:"TABLES",entityType:"LAYER",handle:entity.handle,sourceIndex:entryStart.sourceIndex})
          if(flags&2)collector.add({severity:"warning",code:"DXF_LAYER_VIEWPORT_FREEZE_DEFERRED",message:"Ignored new-viewport frozen state; viewport-specific layer state is unsupported.",section:"TABLES",entityType:"LAYER",handle:entity.handle,sourceIndex:entryStart.sourceIndex})
          layers.push(Object.freeze({name:namePairs[0].value,handle:entity.handle,visible:aci>0&&!(flags&1),locked:Boolean(flags&4),aci:Math.abs(aci),trueColor,linetype,lineweight,sourceIndex:entryStart.sourceIndex}))
        }else if(table==="LTYPE"){
          const entity={type:"LTYPE",pairs:body,sourceIndex:entryStart.sourceIndex},namePairs=all(entity,2)
          if(namePairs.length!==1||!namePairs[0].value.trim())tableFail("DXF_INVALID_LTYPE","LTYPE has an invalid name.",entryStart,table)
          const pattern=[];for(const pair of all(entity,49))pattern.push(finiteNumber(pair,collector,"LTYPE pattern element",entity))
          const complex=all(entity,74).some(pair=>integer(pair,collector,"LTYPE complex flag",entity)!==0)
          linetypes.push(Object.freeze({name:namePairs[0].value.trim(),pattern:Object.freeze(pattern),complex,sourceIndex:entryStart.sourceIndex}))
        }
      }
      if(index>=pairs.length)tableFail("DXF_UNTERMINATED_TABLE",`${table} table is missing ENDTAB.`,start,table)
      index+=1
    }
    const names=new Set();for(const layer of layers){const key=layer.name.toLowerCase();if(names.has(key))tableFail("DXF_DUPLICATE_LAYER",`Duplicate layer name ${layer.name}.`,{sourceIndex:layer.sourceIndex},"LAYER");names.add(key)}
    return Object.freeze({layers:Object.freeze(layers),linetypes:Object.freeze(linetypes)})
  }
  function parseHeader(pairs, collector) {
    let acadVersion = null, insertionUnits = null, currentLayer = null
    for (let index = 0; index < pairs.length; index += 1) {
      const pair = pairs[index]; if (pair.code !== 9) continue
      const name = pair.value.trim().toUpperCase(); let end = index + 1
      while (end < pairs.length && pairs[end].code !== 9) end += 1
      const values = pairs.slice(index + 1, end)
      if (name === "$ACADVER") acadVersion = values.find(value => value.code === 1)?.value?.trim() || null
      if(name==="$CLAYER")currentLayer=values.find(value=>value.code===8)?.value?.trim()||null
      if (name === "$INSUNITS") { const unitPair = values.find(value => value.code === 70); if (!unitPair) fail(collector, "DXF_INVALID_INSUNITS", "$INSUNITS is missing its integer value.", { section: "HEADER", sourceIndex: pair.sourceIndex }); insertionUnits = integer(unitPair, collector, "$INSUNITS") }
      index = end - 1
    }
    if (!acadVersion) collector.add({ severity: "warning", code: "DXF_ACADVER_MISSING", message: "$ACADVER is missing; DXF1 will parse only its version-neutral subset.", section: "HEADER" })
    return Object.freeze({ acadVersion, insertionUnits, currentLayer })
  }
  function parse(text, options = {}) {
    const limits = window.CaderactDxfLimits.resolve(options.limits), collector = window.CaderactDxfDiagnostics.createCollector(limits.maxDiagnostics), pairs = tokenize(text, limits, collector), sections = new Map()
    let index = 0, sawEof = false
    while (index < pairs.length) {
      const pair = pairs[index]
      if (pair.code === 0 && pair.value.trim().toUpperCase() === "EOF") { sawEof = true; index += 1; break }
      if (pair.code !== 0 || pair.value.trim().toUpperCase() !== "SECTION") fail(collector, "DXF_INVALID_STRUCTURE", "Expected SECTION or EOF.", { sourceIndex: pair.sourceIndex })
      const namePair = pairs[index + 1]
      if (!namePair || namePair.code !== 2 || !namePair.value.trim()) fail(collector, "DXF_INVALID_SECTION", "SECTION is missing its name.", { sourceIndex: pair.sourceIndex })
      const name = namePair.value.trim().toUpperCase(); index += 2; const content = []
      while (index < pairs.length && !(pairs[index].code === 0 && pairs[index].value.trim().toUpperCase() === "ENDSEC")) content.push(pairs[index++])
      if (index >= pairs.length) fail(collector, "DXF_UNTERMINATED_SECTION", `${name} section is not terminated.`, { section: name, sourceIndex: pair.sourceIndex })
      index += 1
      if (sections.has(name)) fail(collector, "DXF_DUPLICATE_SECTION", `Duplicate ${name} section.`, { section: name, sourceIndex: pair.sourceIndex })
      sections.set(name, Object.freeze(content))
      if (!["HEADER", "TABLES", "ENTITIES"].includes(name)) collector.add({ severity: "warning", code: "DXF_UNSUPPORTED_SECTION", message: `Skipped unsupported ${name} section.`, section: name, sourceIndex: pair.sourceIndex })
    }
    if (!sawEof) fail(collector, "DXF_EOF_MISSING", "DXF input is missing EOF.")
    if (index !== pairs.length) fail(collector, "DXF_TRAILING_DATA", "DXF input contains data after EOF.", { sourceIndex: pairs[index].sourceIndex })
    if (!sections.has("ENTITIES")) fail(collector, "DXF_ENTITIES_MISSING", "DXF input is missing the ENTITIES section.")
    const source = sections.has("HEADER") ? parseHeader(sections.get("HEADER"), collector) : Object.freeze({ acadVersion: null, insertionUnits: null, currentLayer:null })
    if (!sections.has("HEADER")) collector.add({ severity: "warning", code: "DXF_HEADER_MISSING", message: "DXF input has no HEADER section." })
    const tables=sections.has("TABLES")?parseTables(sections.get("TABLES"),limits,collector):Object.freeze({layers:Object.freeze([]),linetypes:Object.freeze([])})
    const entities = parseEntities(sections.get("ENTITIES"), limits, collector)
    return Object.freeze({ kind: "ParsedDxf", source, layers:tables.layers,linetypes:tables.linetypes,
      entities: Object.freeze(entities), diagnostics: collector.snapshot(), limits })
  }
  window.CaderactDxfParser = Object.freeze({ parse, DxfParseError })
})()
