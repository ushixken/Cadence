// Caderact's validated document schema and document-specific record gateway.
(() => {
  const isRecord = value => value !== null && typeof value === "object" && !Array.isArray(value)
  const has = (table, key) => Object.prototype.hasOwnProperty.call(table, key)
  const normalizeLayerName = value => typeof value === "string" ? value.trim() : ""
  const layerNameKey = value => normalizeLayerName(value).toLowerCase()
  const validLayerName = value => value.length <= 128 && !/[\u0000-\u001f\u007f]/.test(value)
  const fields = values => Object.freeze(values)
  const V1_FIELDS = Object.freeze({
    fileEnvelope: fields(["fileVersion", "document"]),
    persistedDocument: fields(["id", "name", "formatVersion", "units", "defaultLayerId", "currentLayerId", "layers", "records"]),
    document: fields(["id", "name", "formatVersion", "units", "geometry", "layers", "defaultLayerId", "currentLayerId"]),
    geometry: fields(["objects"]),
    units: fields(["length"]),
    layer: fields(["id", "name", "visible", "locked", "color", "linetype", "lineweight"]),
    line: fields(["id", "type", "layerId", "color", "linetype", "lineweight", "start", "end"]),
    polyline: fields(["id", "type", "layerId", "color", "linetype", "lineweight", "vertices", "closed"]),
    vertex: fields(["x", "y", "featureId"]),
    endpoint: fields(["x", "y", "featureId"]),
    circle: fields(["id", "type", "layerId", "color", "linetype", "lineweight", "center", "radius"]),
    arc: fields(["id", "type", "layerId", "color", "linetype", "lineweight", "center", "radius", "start", "end", "sweep"]),
    ellipse: fields(["id", "type", "layerId", "color", "linetype", "lineweight", "center", "majorAxis", "minorRadius"]),
    coordinate: fields(["x", "y"]),
  })
  const DEFAULT_DIMENSION_STYLE=Object.freeze({textHeight:2.5,arrowSize:2.5,extensionGap:1,extensionBeyond:1,textGap:.75,linearPrecision:3,angularPrecision:2,showUnit:true,prefix:"",suffix:"",arrowStyle:"closed-filled"})
  const MAX_DIMENSION_TEXT_OVERRIDE_LENGTH=256
  const MAX_DIMENSION_STYLE_NAME_LENGTH=64
  const V2_FIELDS=Object.freeze({...V1_FIELDS,persistedDocument:fields([...V1_FIELDS.persistedDocument,"dimensionStyle"]),document:fields([...V1_FIELDS.document,"dimensionStyle"]),dimensionStyle:fields(Object.keys(DEFAULT_DIMENSION_STYLE)),dimensionLinear:fields(["id","type","layerId","color","linetype","lineweight","mode","firstPoint","secondPoint","dimensionLinePoint","textOverride"]),dimensionAngular:fields(["id","type","layerId","color","linetype","lineweight","firstRayPoint","vertex","secondRayPoint","dimensionArcPoint","textOverride"]),dimensionRadial:fields(["id","type","layerId","color","linetype","lineweight","mode","centerPoint","dimensionPoint","leaderPoint","textOverride"])})
  const V3_FIELDS=Object.freeze({...V2_FIELDS,persistedDocument:fields([...V1_FIELDS.persistedDocument,"dimensionStyles","currentDimensionStyleId"]),document:fields([...V1_FIELDS.document,"dimensionStyles","dimensionStyleOrder","currentDimensionStyleId"]),dimensionStyle:fields(["id","name",...Object.keys(DEFAULT_DIMENSION_STYLE)]),dimensionLinear:fields([...V2_FIELDS.dimensionLinear,"dimensionStyleId"]),dimensionAngular:fields([...V2_FIELDS.dimensionAngular,"dimensionStyleId"]),dimensionRadial:fields([...V2_FIELDS.dimensionRadial,"dimensionStyleId"]),text:fields(["id","type","layerId","color","linetype","lineweight","insertionPoint","text","height","rotation","horizontalAlignment"]),region:fields(["id","type","layerId","color","linetype","lineweight","loops"]),hatch:fields(["id","type","layerId","color","linetype","lineweight","loops","pattern"]),hatchPattern:fields(["kind","name","angle","scale","origin"]),regionLoop:fields(["featureId","depth","parentIndex","edges"]),regionEdge:fields(["kind","featureId","start","end","center","majorAxis","radius","minorRadius","sweep","clockwise"])})
  const normalizeDimensionStyleName=value=>typeof value==="string"?value.trim():""
  function validateDimensionStyle(style){const errors=[];if(!isRecord(style))return["Invalid dimension style"];const name=normalizeDimensionStyleName(style.name);if(typeof style.id!=="string"||!style.id.trim())errors.push("Dimension style: missing ID");if(!name||name!==style.name||name.length>MAX_DIMENSION_STYLE_NAME_LENGTH||/[\u0000-\u001f\u007f]/.test(name))errors.push("Dimension style: invalid name");for(const key of ["textHeight","arrowSize"])if(!Number.isFinite(style[key])||style[key]<=0)errors.push(`Invalid dimension style ${key}`);for(const key of ["extensionGap","extensionBeyond","textGap"])if(!Number.isFinite(style[key])||style[key]<0)errors.push(`Invalid dimension style ${key}`);for(const key of ["linearPrecision","angularPrecision"])if(!Number.isInteger(style[key])||style[key]<0||style[key]>15)errors.push(`Invalid dimension style ${key}`);if(typeof style.showUnit!=="boolean"||typeof style.prefix!=="string"||typeof style.suffix!=="string"||style.arrowStyle!=="closed-filled")errors.push("Invalid dimension style fields");return errors}
  function migrateDocument(document){if(document?.formatVersion===3)return copyValue(document);const source=copyValue(document),styleId=`ds_${source.id}_standard`,style={id:styleId,name:"Standard",...(source.dimensionStyle||DEFAULT_DIMENSION_STYLE)},objects={};for(const [id,record] of Object.entries(source.geometry?.objects||{}))objects[id]=record.type?.startsWith("dimension-")?{...record,dimensionStyleId:styleId}:record;delete source.dimensionStyle;return{...source,formatVersion:3,geometry:{objects},dimensionStyles:{[styleId]:style},dimensionStyleOrder:[styleId],currentDimensionStyleId:styleId}}
  function unknownFields(value, allowedFields) {
    if (!isRecord(value)) return []
    const allowed = new Set(allowedFields)
    return Reflect.ownKeys(value)
      .filter(key => Object.prototype.propertyIsEnumerable.call(value, key) && !allowed.has(key))
      .map(String)
      .sort()
  }

  function validateDocument(value) {
    const errors = [], ids = new Set()
    function closedShape(candidate, allowedFields, label) {
      const unknown = unknownFields(candidate, allowedFields)
      if (unknown.length) errors.push(`${label}: unknown field${unknown.length === 1 ? "" : "s"} ${unknown.join(", ")}`)
    }
    function identity(id, label) {
      if (typeof id !== "string" || id.trim() === "") errors.push(`${label}: missing ID`)
      else if (ids.has(id)) errors.push(`${label}: duplicate ID ${id}`)
      else ids.add(id)
    }
    function point(value, label) {
      if (!isRecord(value) || !Number.isFinite(value.x) || !Number.isFinite(value.y)) errors.push(`${label}: invalid finite point`)
    }
    function dimensionTextOverride(value,label){if(value!==null&&(typeof value!=="string"||value.length>MAX_DIMENSION_TEXT_OVERRIDE_LENGTH||/[\u0000-\u001f\u007f]/.test(value)))errors.push(`${label}: invalid textOverride`)}
    function objectProperties(value,label){const properties=window.CaderactObjectProperties;for(const key of properties.PROPERTY_KEYS)if(Object.prototype.hasOwnProperty.call(value,key)&&value[key]!==null){const valid=key==="color"?properties.validColor(value[key]):key==="linetype"?properties.validLinetype(value[key]):properties.validLineweight(value[key]);if(!valid)errors.push(`${label}: invalid ${key}`)}}
    function layerProperties(value,label){const properties=window.CaderactObjectProperties;for(const key of properties.PROPERTY_KEYS)if(Object.prototype.hasOwnProperty.call(value,key)){const valid=key==="color"?properties.validColor(value[key]):key==="linetype"?properties.validLinetype(value[key]):properties.validLineweight(value[key]);if(!valid)errors.push(`${label}: invalid ${key}`)}}
    if (!isRecord(value)) return ["Invalid document"]
    const schema=value.formatVersion===3?V3_FIELDS:value.formatVersion===2?V2_FIELDS:V1_FIELDS
    closedShape(value, schema.document, "document")
    identity(value.id, "document")
    if (value.formatVersion !== 3) errors.push("Unsupported formatVersion")
    if (typeof value.name !== "string") errors.push("Invalid document name")
    closedShape(value.units, V1_FIELDS.units, "document units")
    if (!isRecord(value.units) || !window.CaderactUnits.isSupportedLengthUnit(value.units.length)) errors.push("Invalid document length unit")
    const styles=value.dimensionStyles,styleNames=new Set();if(!isRecord(styles)||Object.keys(styles).length===0)errors.push("Document must contain a dimension style");else for(const [key,style] of Object.entries(styles)){closedShape(style,schema.dimensionStyle,"dimension style");for(const error of validateDimensionStyle(style))errors.push(error);identity(style?.id,"dimension style");if(key!==style?.id)errors.push("Dimension style key/ID mismatch");const nameKey=normalizeDimensionStyleName(style?.name).toLowerCase();if(styleNames.has(nameKey))errors.push(`Duplicate dimension style name ${style?.name}`);styleNames.add(nameKey)}
    if(!Array.isArray(value.dimensionStyleOrder)||value.dimensionStyleOrder.length!==Object.keys(styles||{}).length||new Set(value.dimensionStyleOrder).size!==value.dimensionStyleOrder.length||value.dimensionStyleOrder.some(id=>!has(styles,id)))errors.push("Invalid dimension style order")
    if(typeof value.currentDimensionStyleId!=="string"||!isRecord(styles)||!has(styles,value.currentDimensionStyleId))errors.push("Invalid currentDimensionStyleId")
    closedShape(value.geometry, V1_FIELDS.geometry, "document geometry")
    const layers = value.layers, objects = value.geometry?.objects
    const layerNames = new Set()
    if (!isRecord(layers)) errors.push("Invalid layer table")
    else for (const [key, layer] of Object.entries(layers)) {
      if (!isRecord(layer)) { errors.push("Invalid layer"); continue }
      closedShape(layer, V1_FIELDS.layer, "layer")
      layerProperties(layer,"layer")
      identity(layer.id, "layer")
      if (key !== layer.id) errors.push("Layer key/ID mismatch")
      const normalizedName = normalizeLayerName(layer.name), nameKey = layerNameKey(layer.name)
      if (!normalizedName || !validLayerName(normalizedName) || normalizedName !== layer.name || typeof layer.visible !== "boolean" || typeof layer.locked !== "boolean") errors.push("Invalid layer fields")
      else if (layerNames.has(nameKey)) errors.push(`Duplicate layer name ${layer.name}`)
      else layerNames.add(nameKey)
    }
    if (typeof value.defaultLayerId !== "string" || !isRecord(layers) || !has(layers, value.defaultLayerId)) errors.push("Invalid defaultLayerId")
    if (typeof value.currentLayerId !== "string" || !isRecord(layers) || !has(layers, value.currentLayerId)) errors.push("Invalid currentLayerId")
    else if (!layers[value.currentLayerId].visible || layers[value.currentLayerId].locked) errors.push("Current layer must be visible and unlocked")
    if (!isRecord(objects)) errors.push("Invalid object table")
    else for (const [key, record] of Object.entries(objects)) {
      if (!isRecord(record)) { errors.push("Invalid object"); continue }
      identity(record.id, "object")
      if (key !== record.id) errors.push("Object key/ID mismatch")
      if (typeof record.layerId !== "string" || !isRecord(layers) || !has(layers, record.layerId)) errors.push("Invalid layer reference")
      objectProperties(record,"object")
      if (record.type === "line") {
        closedShape(record, V1_FIELDS.line, "Line")
        point(record.start, "Line start"); point(record.end, "Line end")
        closedShape(record.start, V1_FIELDS.endpoint, "Line start")
        closedShape(record.end, V1_FIELDS.endpoint, "Line end")
        identity(record.start?.featureId, "start feature")
        identity(record.end?.featureId, "end feature")
      } else if(record.type === "polyline") {
        closedShape(record,V1_FIELDS.polyline,"Polyline")
        if(!Array.isArray(record.vertices)||(record.closed?record.vertices.length<3:record.vertices.length<2))errors.push("Polyline: invalid vertex count")
        else for(const vertex of record.vertices){point(vertex,"Polyline vertex");closedShape(vertex,V1_FIELDS.vertex,"Polyline vertex");identity(vertex?.featureId,"Polyline vertex feature")}
        if(typeof record.closed!=="boolean")errors.push("Polyline: closed must be boolean")
        if(Array.isArray(record.vertices)&&record.vertices.length>1){for(let i=1;i<record.vertices.length;i++)if(record.vertices[i-1].x===record.vertices[i].x&&record.vertices[i-1].y===record.vertices[i].y)errors.push("Polyline: adjacent vertices must differ");if(record.closed&&record.vertices[0].x===record.vertices.at(-1).x&&record.vertices[0].y===record.vertices.at(-1).y)errors.push("Polyline: closed path must not duplicate its first vertex")}
      } else if (record.type === "circle") {
        closedShape(record, V1_FIELDS.circle, "Circle")
        point(record.center, "Circle center")
        closedShape(record.center, V1_FIELDS.coordinate, "Circle center")
        if (!Number.isFinite(record.radius) || record.radius <= 0) errors.push("Circle: radius must be finite and greater than zero")
      } else if (record.type === "arc") {
        closedShape(record, V1_FIELDS.arc, "Arc")
        point(record.center, "Arc center"); point(record.start, "Arc start"); point(record.end, "Arc end")
        closedShape(record.center, V1_FIELDS.coordinate, "Arc center")
        closedShape(record.start, V1_FIELDS.endpoint, "Arc start")
        closedShape(record.end, V1_FIELDS.endpoint, "Arc end")
        identity(record.start?.featureId, "start feature"); identity(record.end?.featureId, "end feature")
        if (!Number.isFinite(record.radius) || record.radius <= 0) errors.push("Arc: radius must be finite and greater than zero")
        if (!Number.isFinite(record.sweep) || record.sweep === 0 || Math.abs(record.sweep) >= Math.PI*2) errors.push("Arc: sweep must be finite, non-zero, and less than one turn")
        if (Number.isFinite(record.radius) && record.radius > 0 && isRecord(record.center)) {
          for (const [role, endpoint] of [["start",record.start],["end",record.end]]) if (isRecord(endpoint)) {
            const radialError=Math.abs(Math.hypot(endpoint.x-record.center.x,endpoint.y-record.center.y)-record.radius)
            if (!Number.isFinite(radialError) || radialError > 1e-9*Math.max(1,record.radius)) errors.push(`Arc ${role}: endpoint is not on radius`)
          }
          if (isRecord(record.start) && isRecord(record.end) && Number.isFinite(record.sweep)) {
            const startAngle=Math.atan2(record.start.y-record.center.y,record.start.x-record.center.x)
            const expected={x:record.center.x+Math.cos(startAngle+record.sweep)*record.radius,
              y:record.center.y+Math.sin(startAngle+record.sweep)*record.radius}
            if (Math.hypot(expected.x-record.end.x,expected.y-record.end.y)>1e-9*Math.max(1,record.radius)) errors.push("Arc end: endpoint does not match sweep")
          }
        }
      } else if (record.type === "ellipse") {
        closedShape(record, V1_FIELDS.ellipse, "Ellipse")
        point(record.center, "Ellipse center"); point(record.majorAxis, "Ellipse major axis")
        closedShape(record.center, V1_FIELDS.coordinate, "Ellipse center")
        closedShape(record.majorAxis, V1_FIELDS.coordinate, "Ellipse major axis")
        if (!(Math.hypot(record.majorAxis?.x, record.majorAxis?.y) > 0)) errors.push("Ellipse: major axis must be finite and greater than zero")
        if (!Number.isFinite(record.minorRadius) || record.minorRadius <= 0) errors.push("Ellipse: minor radius must be finite and greater than zero")
      } else if(record.type==="dimension-linear"){
        closedShape(record,schema.dimensionLinear,"Linear dimension");if(!["horizontal","vertical","aligned"].includes(record.mode))errors.push("Linear dimension: invalid mode");for(const key of ["firstPoint","secondPoint","dimensionLinePoint"]){point(record[key],`Linear dimension ${key}`);closedShape(record[key],schema.endpoint,`Linear dimension ${key}`);identity(record[key]?.featureId,`Linear dimension ${key} feature`)}if(record.firstPoint?.x===record.secondPoint?.x&&record.firstPoint?.y===record.secondPoint?.y)errors.push("Linear dimension: definition points must differ");if(!has(styles||{},record.dimensionStyleId))errors.push("Linear dimension: invalid dimensionStyleId");dimensionTextOverride(record.textOverride,"Linear dimension")
      } else if(record.type==="dimension-angular"){
        closedShape(record,schema.dimensionAngular,"Angular dimension");for(const key of ["firstRayPoint","vertex","secondRayPoint","dimensionArcPoint"]){point(record[key],`Angular dimension ${key}`);closedShape(record[key],schema.endpoint,`Angular dimension ${key}`);identity(record[key]?.featureId,`Angular dimension ${key} feature`)}if(Math.hypot(record.firstRayPoint?.x-record.vertex?.x,record.firstRayPoint?.y-record.vertex?.y)===0||Math.hypot(record.secondRayPoint?.x-record.vertex?.x,record.secondRayPoint?.y-record.vertex?.y)===0)errors.push("Angular dimension: rays must have non-zero length");if(!has(styles||{},record.dimensionStyleId))errors.push("Angular dimension: invalid dimensionStyleId");dimensionTextOverride(record.textOverride,"Angular dimension")
      } else if(record.type==="dimension-radial"){
        closedShape(record,schema.dimensionRadial,"Radial dimension");if(!["radius","diameter"].includes(record.mode))errors.push("Radial dimension: invalid mode");for(const key of ["centerPoint","dimensionPoint","leaderPoint"]){point(record[key],`Radial dimension ${key}`);closedShape(record[key],schema.endpoint,`Radial dimension ${key}`);identity(record[key]?.featureId,`Radial dimension ${key} feature`)}if(record.centerPoint?.x===record.dimensionPoint?.x&&record.centerPoint?.y===record.dimensionPoint?.y)errors.push("Radial dimension: radius must be non-zero");if(!has(styles||{},record.dimensionStyleId))errors.push("Radial dimension: invalid dimensionStyleId");dimensionTextOverride(record.textOverride,"Radial dimension")
      } else if(record.type==="text"){
        closedShape(record,schema.text,"Text");closedShape(record.insertionPoint,schema.endpoint,"Text insertion point");point(record.insertionPoint,"Text insertion point");identity(record.insertionPoint?.featureId,"Text insertion feature");for(const error of window.CaderactAnnotationGeometry.validate(record))errors.push(`Text: ${error}`)
      } else if(record.type==="region"||record.type==="hatch"){
        const label=record.type==="hatch"?"Hatch":"Region";closedShape(record,schema[record.type],label)
        if(record.type==="hatch")closedShape(record.pattern,schema.hatchPattern,"Hatch pattern")
        if(!Array.isArray(record.loops))errors.push(`${label}: loops must be an array`)
        else for(const loop of record.loops){closedShape(loop,schema.regionLoop,`${label} loop`);identity(loop?.featureId,`${label} loop feature`);if(!Array.isArray(loop?.edges))errors.push(`${label} loop: edges must be an array`);else for(const edge of loop.edges){closedShape(edge,schema.regionEdge,`${label} edge`);identity(edge?.featureId,`${label} edge feature`);for(const key of ["start","end"])if(edge[key]){point(edge[key],`${label} edge ${key}`);closedShape(edge[key],schema.endpoint,`${label} edge ${key}`);identity(edge[key].featureId,`${label} edge ${key} feature`)}}}
        for(const error of (record.type==="hatch"?window.CaderactHatchGeometry:window.CaderactRegionGeometry).validate(record))errors.push(error)
      } else errors.push("Unsupported object type")
    }
    return errors
  }

  function freeze(value) {
    for (const child of Object.values(value)) if (child !== null && typeof child === "object") freeze(child)
    return Object.freeze(value)
  }

  function copyValue(value) {
    if (value === null || typeof value !== "object") return value
    if (Array.isArray(value)) return value.map(copyValue)
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copyValue(child)]))
  }

  function createStore({ document: initialDocument, initiallySaved = false } = {}) {
    // Retain allocated identities after cancellation. Random IDs do not encode order.
    const allocated = new Set()
    function newId() {
      const bytes = new Uint8Array(16)
      for (let attempt = 0; attempt < 8; attempt++) {
        crypto.getRandomValues(bytes)
        const id = "id_" + Array.from(bytes, byte => byte.toString(16).padStart(2, "0")).join("")
        if (!allocated.has(id)) { allocated.add(id); return id }
      }
      throw new Error("Unable to allocate a unique ID")
    }
    let state
    if (initialDocument !== undefined) {
      const candidate = migrateDocument(initialDocument), errors = validateDocument(candidate)
      if (errors.length) throw new Error(`Invalid initial document: ${errors.join("; ")}`)
      allocated.add(candidate.id)
      for (const layer of Object.values(candidate.layers)) allocated.add(layer.id)
      for(const style of Object.values(candidate.dimensionStyles))allocated.add(style.id)
      for (const record of Object.values(candidate.geometry.objects)) {
        allocated.add(record.id)
        if (record.type === "line" || record.type === "arc") {
          allocated.add(record.start.featureId)
          allocated.add(record.end.featureId)
        } else if(record.type === "polyline")for(const vertex of record.vertices)allocated.add(vertex.featureId)
        else if(record.type.startsWith("dimension-")||record.type==="text")for(const child of Object.values(record))if(child?.featureId)allocated.add(child.featureId)
        else if(record.type==="region"||record.type==="hatch")for(const loop of record.loops){allocated.add(loop.featureId);for(const edge of loop.edges){allocated.add(edge.featureId);if(edge.start?.featureId)allocated.add(edge.start.featureId);if(edge.end?.featureId)allocated.add(edge.end.featureId)}}
      }
      state = freeze(candidate)
    } else {
      const id = newId(), layerId = newId()
      const dimensionStyleId=newId();state = freeze({ id, name: "Untitled", formatVersion: 3, units: { length: "mm" },dimensionStyles:{[dimensionStyleId]:{id:dimensionStyleId,name:"Standard",...DEFAULT_DIMENSION_STYLE}},dimensionStyleOrder:[dimensionStyleId],currentDimensionStyleId:dimensionStyleId,
        geometry: { objects: {} },
        layers: { [layerId]: { id: layerId, name: "Default", visible: true, locked: false, ...window.CaderactObjectProperties.DEFAULT_LAYER_PROPERTIES } },
        defaultLayerId: layerId,
        currentLayerId: layerId,
      })
    }
    // A3: persistent document mutation is now gated by the Document Controller's
    // transaction core. This closure no longer publishes state directly; it hands
    // the controller a way to read/replace `state` and the existing A2 validator.
    const controller = window.DocumentController.createController({
      getDocument: () => state,
      getCollections: document => ({ records: document.geometry.objects, layers: document.layers,
        settings: { units: document.units, currentLayerId: document.currentLayerId,dimensionStyles:document.dimensionStyles,dimensionStyleOrder:document.dimensionStyleOrder,currentDimensionStyleId:document.currentDimensionStyleId } }),
      assembleDocument: (baseDocument, collections) => ({
        ...baseDocument,
        geometry: { objects: collections.records },
        layers: collections.layers,
        units: collections.settings.units,
        currentLayerId: collections.settings.currentLayerId,
        dimensionStyles:collections.settings.dimensionStyles,dimensionStyleOrder:collections.settings.dimensionStyleOrder,currentDimensionStyleId:collections.settings.currentDimensionStyleId,
      }),
      validate: validateDocument,
      onPublish: (newDocument) => { state = newDocument },
      freeze,
      // A4 state identities use the same opaque, non-recycling allocator as
      // document/geometry identities while remaining a separate ID namespace.
      allocateStateId: newId,
    })
    if (initiallySaved) controller.markStateSaved(controller.captureStateToken())
    const reader = Object.freeze({
      snapshot: () => state,
      // A6 command-agnostic committed-record view. Sorting by stable ID makes
      // enumeration independent of object-table insertion/reconstruction order.
      records: () => Object.freeze(Object.values(state.geometry.objects).sort((a, b) => a.id.localeCompare(b.id))),
      layers: () => Object.freeze(Object.values(state.layers).sort((a, b) => a.id.localeCompare(b.id))),
      layer: layerId => state.layers[layerId] || null,
      visibleRecords: () => Object.freeze(Object.values(state.geometry.objects).filter(record => state.layers[record.layerId]?.visible).sort((a,b)=>a.id.localeCompare(b.id))),
      editableRecords: () => Object.freeze(Object.values(state.geometry.objects).filter(record => { const layer=state.layers[record.layerId];return layer?.visible&&!layer.locked }).sort((a,b)=>a.id.localeCompare(b.id))),
      isRecordVisible: recordId => Boolean(state.layers[state.geometry.objects[recordId]?.layerId]?.visible),
      isRecordEditable: recordId => { const layer=state.layers[state.geometry.objects[recordId]?.layerId];return Boolean(layer?.visible&&!layer.locked) },
      aggregateRecordProperties: recordIds => window.CaderactObjectProperties.aggregate(Array.from(recordIds||[],id=>state.geometry.objects[id]).filter(Boolean)),
      units: () => state.units,
      dimensionStyles:()=>Object.freeze(state.dimensionStyleOrder.map(id=>state.dimensionStyles[id])),dimensionStyle:id=>state.dimensionStyles[id||state.currentDimensionStyleId]||state.dimensionStyles[state.currentDimensionStyleId]||state.dimensionStyles[state.dimensionStyleOrder[0]],resolveDimensionStyle:record=>state.dimensionStyles[record?.dimensionStyleId]||state.dimensionStyles[state.currentDimensionStyleId]||state.dimensionStyles[state.dimensionStyleOrder[0]],currentDimensionStyleId:()=>state.currentDimensionStyleId,
      // Compatibility query for current Line-oriented callers; render code uses
      // records() and performs its own supported-type projection.
      lines: () => Object.freeze(Object.values(state.geometry.objects).filter(record => record.type === "line")),
    })
    // Schema-aware, command-agnostic record gateway. Commands may construct
    // immutable records before publication, while atomic creation remains
    // controlled by one short document transaction.
    function layerUsable(layerId) { const layer=state.layers[layerId];return Boolean(layer?.visible&&!layer.locked) }
    function currentDrawingLayerId() { if(!layerUsable(state.currentLayerId))throw new Error("Current layer is hidden or locked");return state.currentLayerId }
    function recordEditable(recordId) { const record=state.geometry.objects[recordId];return Boolean(record&&layerUsable(record.layerId)) }
    function updateRecordProperties(recordId, properties) {
      if (!recordEditable(recordId)) return Object.freeze({ status: "record-layer-unavailable", recordId })
      const transaction = controller.beginTransaction()
      try {
        const record = transaction.read(recordId)
        if (record === null) { transaction.rollback(); return Object.freeze({ status: "missing-record", recordId }) }
        transaction.replace(recordId, { ...record, ...properties, id: record.id })
        return transaction.publish()
      } catch (error) { if (transaction.isOpen) transaction.rollback(); throw error }
    }
    function assignRecordsToLayer(recordIds, layerId) {
      const target=state.layers[layerId]
      if(!target)return Object.freeze({status:"unknown-layer",layerId})
      if(!target.visible)return Object.freeze({status:"target-layer-hidden",layerId})
      if(target.locked)return Object.freeze({status:"target-layer-locked",layerId})
      const ids=Array.from(new Set(recordIds||[]))
      if(!ids.length)return Object.freeze({status:"empty-selection",recordIds:Object.freeze([])})
      const records=ids.map(id=>state.geometry.objects[id]||null)
      if(records.some(record=>!record))return Object.freeze({status:"selection-not-editable",recordIds:Object.freeze(ids)})
      if(records.some(record=>!recordEditable(record.id)))return Object.freeze({status:"selection-not-editable",recordIds:Object.freeze(ids)})
      const changes=records.filter(record=>record.layerId!==layerId)
      if(!changes.length)return Object.freeze({status:"no-op",changes:Object.freeze([]),recordIds:Object.freeze(ids),layerId})
      const transaction=controller.beginTransaction()
      try{for(const record of changes)transaction.replace(record.id,{...record,layerId});const outcome=transaction.publish();return Object.freeze({...outcome,movedCount:changes.length,recordIds:Object.freeze(ids),layerId})}
      catch(error){if(transaction.isOpen)transaction.rollback();return Object.freeze({status:"commit-failed",message:error.message})}
    }
    function setRecordProperties(recordIds,patch){
      const validated=window.CaderactObjectProperties.validatePatch(patch)
      if(!validated.valid)return Object.freeze({status:validated.reason})
      const ids=Array.from(new Set(recordIds||[]))
      if(!ids.length)return Object.freeze({status:"empty-selection",recordIds:Object.freeze([])})
      const records=ids.map(id=>state.geometry.objects[id]||null)
      if(records.some(record=>!record)||records.some(record=>!recordEditable(record.id)))return Object.freeze({status:"selection-not-editable",recordIds:Object.freeze(ids)})
      const changes=records.filter(record=>Object.entries(validated.patch).some(([key,value])=>(Object.prototype.hasOwnProperty.call(record,key)?record[key]:null)!==value))
      if(!changes.length)return Object.freeze({status:"no-op",changes:Object.freeze([]),recordIds:Object.freeze(ids)})
      const transaction=controller.beginTransaction()
      try{for(const record of changes)transaction.replace(record.id,{...record,...validated.patch});const outcome=transaction.publish();return Object.freeze({...outcome,recordIds:Object.freeze(ids),updatedCount:changes.length})}
      catch(error){if(transaction.isOpen)transaction.rollback();return Object.freeze({status:"commit-failed",message:error.message})}
    }
    const recordGateway = Object.freeze({
      createRegionFromLoops(inputs){
        const nesting=window.CaderactBoundaryGeometry.classifyNesting(inputs);if(!nesting.valid)throw new Error(nesting.reason||"Invalid Region boundary")
        const loops=nesting.entries.map(entry=>({featureId:newId(),depth:entry.depth,parentIndex:entry.parentIndex,edges:entry.loop.edges.map(edge=>{const copy={kind:edge.kind,featureId:newId()};for(const key of ["start","end"])if(edge[key])copy[key]={x:edge[key].x,y:edge[key].y,featureId:newId()};for(const key of ["center","majorAxis"])if(edge[key])copy[key]={x:edge[key].x,y:edge[key].y};for(const key of ["radius","minorRadius","sweep","clockwise"])if(edge[key]!==undefined)copy[key]=edge[key];return copy})}))
        return freeze({id:newId(),type:"region",layerId:currentDrawingLayerId(),...window.CaderactObjectProperties.BY_LAYER_PROPERTIES,loops})
      },
      createHatchFromLoops(inputs,pattern={kind:"solid"}){const region=this.createRegionFromLoops(inputs),copy=pattern.kind==="named"?{kind:"named",name:pattern.name,angle:pattern.angle,scale:pattern.scale,origin:{x:pattern.origin?.x,y:pattern.origin?.y}}:{kind:pattern.kind};const hatch=freeze({...region,type:"hatch",pattern:copy});const errors=window.CaderactHatchGeometry.validate(hatch);if(errors.length)throw new Error(errors.join("; "));return hatch},
      createHatch(boundaries,pattern={kind:"solid"}){if(boundaries.length&&boundaries.every(record=>record?.type==="region"||record?.type==="hatch")){if(boundaries.length!==1)throw new Error("Create one Hatch per semantic Region");return this.createHatchFromLoops(boundaries[0].loops.map(loop=>loop.edges),pattern)}return this.createHatchFromLoops(window.CaderactRegionGeometry.canonicalizeSources(boundaries).map(loop=>loop.edges),pattern)},
      createLine(start, end) {
        return freeze({ id: newId(), type: "line", layerId: currentDrawingLayerId(), ...window.CaderactObjectProperties.BY_LAYER_PROPERTIES,
          start: { x: start?.x, y: start?.y, featureId: newId() },
          end: { x: end?.x, y: end?.y, featureId: newId() },
        })
      },
      createPolyline(vertices,closed=false) {
        return freeze({id:newId(),type:"polyline",layerId:currentDrawingLayerId(),...window.CaderactObjectProperties.BY_LAYER_PROPERTIES,
          vertices:Array.from(vertices,vertex=>({x:vertex?.x,y:vertex?.y,featureId:newId()})),closed:Boolean(closed)})
      },
      createCircle(center, radius) {
        return freeze({ id: newId(), type: "circle", layerId: currentDrawingLayerId(), ...window.CaderactObjectProperties.BY_LAYER_PROPERTIES,
          center: { x: center?.x, y: center?.y }, radius,
        })
      },
      createArc(geometry) {
        return freeze({ id: newId(), type: "arc", layerId: currentDrawingLayerId(), ...window.CaderactObjectProperties.BY_LAYER_PROPERTIES,
          center: { x: geometry.center?.x, y: geometry.center?.y }, radius: geometry.radius,
          start: { x: geometry.start?.x, y: geometry.start?.y, featureId: newId() },
          end: { x: geometry.end?.x, y: geometry.end?.y, featureId: newId() }, sweep: geometry.sweep,
        })
      },
      createEllipse(geometry) {
        return freeze({ id: newId(), type: "ellipse", layerId: currentDrawingLayerId(), ...window.CaderactObjectProperties.BY_LAYER_PROPERTIES,
          center: { x: geometry.center?.x, y: geometry.center?.y },
          majorAxis: { x: geometry.majorAxis?.x, y: geometry.majorAxis?.y }, minorRadius: geometry.minorRadius,
        })
      },
      createLinearDimension(geometry){const feature=value=>({x:value?.x,y:value?.y,featureId:newId()});return freeze({id:newId(),type:"dimension-linear",layerId:currentDrawingLayerId(),...window.CaderactObjectProperties.BY_LAYER_PROPERTIES,mode:geometry.mode,firstPoint:feature(geometry.firstPoint),secondPoint:feature(geometry.secondPoint),dimensionLinePoint:feature(geometry.dimensionLinePoint),textOverride:geometry.textOverride??null,dimensionStyleId:geometry.dimensionStyleId||state.currentDimensionStyleId})},
      createAngularDimension(geometry){const feature=value=>({x:value?.x,y:value?.y,featureId:newId()});return freeze({id:newId(),type:"dimension-angular",layerId:currentDrawingLayerId(),...window.CaderactObjectProperties.BY_LAYER_PROPERTIES,firstRayPoint:feature(geometry.firstRayPoint),vertex:feature(geometry.vertex),secondRayPoint:feature(geometry.secondRayPoint),dimensionArcPoint:feature(geometry.dimensionArcPoint),textOverride:geometry.textOverride??null,dimensionStyleId:geometry.dimensionStyleId||state.currentDimensionStyleId})},
      createRadialDimension(geometry){const feature=value=>({x:value?.x,y:value?.y,featureId:newId()});return freeze({id:newId(),type:"dimension-radial",layerId:currentDrawingLayerId(),...window.CaderactObjectProperties.BY_LAYER_PROPERTIES,mode:geometry.mode,centerPoint:feature(geometry.centerPoint),dimensionPoint:feature(geometry.dimensionPoint),leaderPoint:feature(geometry.leaderPoint),textOverride:geometry.textOverride??null,dimensionStyleId:geometry.dimensionStyleId||state.currentDimensionStyleId})},
      createText(geometry){return freeze({id:newId(),type:"text",layerId:currentDrawingLayerId(),...window.CaderactObjectProperties.BY_LAYER_PROPERTIES,insertionPoint:{x:geometry.insertionPoint?.x,y:geometry.insertionPoint?.y,featureId:newId()},text:geometry.text,height:geometry.height,rotation:window.CaderactAnnotationGeometry.normalizeRotation(geometry.rotation),horizontalAlignment:geometry.horizontalAlignment||"left"})},
      createRegion(boundaries){
        return this.createRegionFromLoops(window.CaderactRegionGeometry.canonicalizeSources(boundaries).map(loop=>loop.edges))
      },
      createAll(records) {
        if (records.some(record => !layerUsable(record.layerId))) return Object.freeze({ status: "record-layer-unavailable" })
        let transaction
        try {
          transaction = controller.beginTransaction()
          for (const record of records) transaction.create(record.id, record)
          return transaction.publish()
        } catch (error) {
          if (transaction?.isOpen) transaction.rollback()
          return Object.freeze({ status: "commit-failed", message: error.message })
        }
      },
      replace(recordId, record) {
        if (!recordEditable(recordId)) return Object.freeze({ status: "record-layer-unavailable", recordId })
        const transaction = controller.beginTransaction()
        try { transaction.replace(recordId, record); return transaction.publish() }
        catch (error) { if (transaction.isOpen) transaction.rollback(); throw error }
      },
      replaceAll(records) {
        if (records.some(record => !recordEditable(record.id))) return Object.freeze({ status: "record-layer-unavailable" })
        let transaction
        try {
          transaction = controller.beginTransaction()
          for (const record of records) transaction.replace(record.id, record)
          return transaction.publish()
        } catch (error) {
          if (transaction?.isOpen) transaction.rollback()
          return Object.freeze({ status: "commit-failed", message: error.message })
        }
      },
      removeAll(recordIds) {
        if (recordIds.some(recordId => !recordEditable(recordId))) return Object.freeze({ status: "record-layer-unavailable" })
        let transaction
        try {
          transaction = controller.beginTransaction()
          for (const recordId of recordIds) transaction.remove(recordId)
          return transaction.publish()
        } catch (error) {
          if (transaction?.isOpen) transaction.rollback()
          return Object.freeze({ status: "commit-failed", message: error.message })
        }
      },
      copyWithFreshIdentity(record) {
        if(record.type==="line")return freeze({...record,id:newId(),start:{...record.start,featureId:newId()},end:{...record.end,featureId:newId()}})
        if(record.type==="arc")return freeze({...record,id:newId(),start:{...record.start,featureId:newId()},end:{...record.end,featureId:newId()}})
        if(record.type==="polyline")return freeze({...record,id:newId(),vertices:record.vertices.map(vertex=>({...vertex,featureId:newId()}))})
        if(record.type==="circle"||record.type==="ellipse")return freeze({...record,id:newId()})
        if(record.type==="region"||record.type==="hatch")return freeze({...record,id:newId(),loops:record.loops.map(loop=>({...loop,featureId:newId(),edges:loop.edges.map(edge=>({...edge,featureId:newId(),...(edge.start?{start:{...edge.start,featureId:newId()}}:{}),...(edge.end?{end:{...edge.end,featureId:newId()}}:{})}))}))})
        if(record.type.startsWith("dimension-")||record.type==="text"){const copy={...record,id:newId()};for(const [key,value] of Object.entries(copy))if(value?.featureId)copy[key]={...value,featureId:newId()};return freeze(copy)}
        throw new Error(`Unsupported geometry type: ${record.type}`)
      },
      updateProperties(recordId, properties) {
        return updateRecordProperties(recordId, properties)
      },
      setProperties(recordIds,patch){return setRecordProperties(recordIds,patch)},
      assignLayer(recordIds, layerId) { return assignRecordsToLayer(recordIds, layerId) },
      // M6P4: publishes an already-computed CaderactTrimPlanner result
      // (`{ target, cuttingEdges, pickPoint } -> plan`) as exactly one atomic
      // document transaction. Pure translation: TrimPlan -> allocate required
      // persistent identities (via the same `newId()` allocator every other
      // record/feature ID in this store goes through) -> construct valid
      // persistent records -> one transaction -> publish. Contains no curve
      // intersection/tolerance math, no pointer/interval logic, no renderer
      // logic -- the plan is trusted as-is.
      publishTrimPlan(plan) {
        if (!plan || plan.status !== "planned") {
          // Any non-"planned" Phase 3 result (no-op, invalid-target,
          // unsupported-target-result, or a missing/malformed plan) is a
          // pure no-op here: no transaction begins, no ID is allocated, no
          // revision/history changes.
          return Object.freeze({ status: "no-op", planStatus: plan?.status ?? null, reason: plan?.reason ?? "missing-plan" })
        }
        const original = state.geometry.objects[plan.targetRecordId]
        if (!original) return Object.freeze({ status: "missing-record", recordId: plan.targetRecordId })
        if (!recordEditable(plan.targetRecordId)) return Object.freeze({ status: "record-layer-unavailable", recordId: plan.targetRecordId })
        const layerId = original.layerId

        function resolveFeatureId(intent) {
          if (!intent || typeof intent !== "object") throw new Error("Invalid feature identity intent")
          if (intent.role === "preserve-existing-feature") return intent.featureId
          if (intent.role === "allocate-new-feature") return newId()
          throw new Error(`Unknown feature identity intent role: ${intent.role}`)
        }
        function buildEndpoint(point, intent) {
          return { x: point.x, y: point.y, featureId: resolveFeatureId(intent) }
        }
        // Translates one planner "piece" (the replacement or one create) into
        // a persistent record under `recordId`, resolving every identity
        // intent it carries at this moment -- never earlier, never reused.
        function buildRecord(recordId, piece) {
          const geometry = piece.geometry
          if (geometry.type === "line") {
            return freeze({ id: recordId, type: "line", layerId, ...window.CaderactObjectProperties.recordProperties(original),
              start: buildEndpoint(geometry.start, piece.featureIdentityIntent.start),
              end: buildEndpoint(geometry.end, piece.featureIdentityIntent.end) })
          }
          if (geometry.type === "arc") {
            return freeze({ id: recordId, type: "arc", layerId, ...window.CaderactObjectProperties.recordProperties(original),
              center: { x: geometry.center.x, y: geometry.center.y }, radius: geometry.radius,
              start: buildEndpoint(geometry.start, piece.featureIdentityIntent.start),
              end: buildEndpoint(geometry.end, piece.featureIdentityIntent.end),
              sweep: geometry.sweep })
          }
          if (geometry.type === "polyline") {
            return freeze({ id: recordId, type: "polyline", layerId, ...window.CaderactObjectProperties.recordProperties(original),
              vertices: geometry.vertices.map((vertex, index) => buildEndpoint(vertex, piece.featureIdentityIntent.vertices[index])),
              closed: Boolean(geometry.closed) })
          }
          throw new Error(`Unsupported trim replacement geometry type: ${geometry.type}`)
        }

        let transaction
        try {
          // Replacement first, reusing the original record ID exactly (never
          // allocated); sibling creates get fresh record IDs in the exact
          // deterministic order TrimPlanner supplied them in.
          const replacementRecord = buildRecord(plan.targetRecordId, plan.replacement)
          const createRecords = plan.creates.map(piece => buildRecord(newId(), piece))
          transaction = controller.beginTransaction()
          transaction.replace(plan.targetRecordId, replacementRecord)
          for (const record of createRecords) transaction.create(record.id, record)
          return transaction.publish()
        } catch (error) {
          if (transaction?.isOpen) transaction.rollback()
          return Object.freeze({ status: "commit-failed", message: error.message })
        }
      },
      publishExtendPlan(plan) {
        if (!plan || plan.status !== "planned" || plan.kind !== "extend") {
          return Object.freeze({ status: "no-op", planStatus: plan?.status ?? null, reason: plan?.reason ?? "missing-plan" })
        }
        const original = state.geometry.objects[plan.targetRecordId]
        if (!original) return Object.freeze({ status: "missing-record", recordId: plan.targetRecordId })
        if (!recordEditable(plan.targetRecordId)) return Object.freeze({ status: "record-layer-unavailable", recordId: plan.targetRecordId })
        const layerId = original.layerId

        function geometrySnapshot(record) {
          if (record?.type === "line") return { type: "line", start: { x: record.start.x, y: record.start.y }, end: { x: record.end.x, y: record.end.y } }
          if (record?.type === "arc") return { type: "arc", center: { x: record.center.x, y: record.center.y }, radius: record.radius, start: { x: record.start.x, y: record.start.y }, end: { x: record.end.x, y: record.end.y }, sweep: record.sweep }
          if (record?.type === "polyline") return { type: "polyline", closed: Boolean(record.closed), vertices: record.vertices.map(vertex => ({ x: vertex.x, y: vertex.y })) }
          if (record?.type === "circle") return { type: "circle", center: { x: record.center.x, y: record.center.y }, radius: record.radius }
          if (record?.type === "ellipse") return { type: "ellipse", center: { x: record.center.x, y: record.center.y }, majorAxis: { x: record.majorAxis.x, y: record.majorAxis.y }, minorRadius: record.minorRadius }
          return null
        }
        if (JSON.stringify(geometrySnapshot(original)) !== JSON.stringify(plan.sourceGeometry)) {
          return Object.freeze({ status: "stale-plan", recordId: plan.targetRecordId })
        }

        function resolveFeatureId(intent) {
          if (!intent || typeof intent !== "object") throw new Error("Invalid feature identity intent")
          if (intent.role === "preserve-existing-feature") return intent.featureId
          if (intent.role === "allocate-new-feature") return newId()
          throw new Error(`Unknown feature identity intent role: ${intent.role}`)
        }
        function buildEndpoint(point, intent) {
          return { x: point.x, y: point.y, featureId: resolveFeatureId(intent) }
        }
        function buildRecord(recordId, piece) {
          const geometry = piece.geometry
          if (geometry.type === "line") {
            return freeze({ id: recordId, type: "line", layerId, ...window.CaderactObjectProperties.recordProperties(original),
              start: buildEndpoint(geometry.start, piece.featureIdentityIntent.start),
              end: buildEndpoint(geometry.end, piece.featureIdentityIntent.end) })
          }
          if (geometry.type === "arc") {
            return freeze({ id: recordId, type: "arc", layerId, ...window.CaderactObjectProperties.recordProperties(original),
              center: { x: geometry.center.x, y: geometry.center.y }, radius: geometry.radius,
              start: buildEndpoint(geometry.start, piece.featureIdentityIntent.start),
              end: buildEndpoint(geometry.end, piece.featureIdentityIntent.end),
              sweep: geometry.sweep })
          }
          if (geometry.type === "polyline") {
            return freeze({ id: recordId, type: "polyline", layerId, ...window.CaderactObjectProperties.recordProperties(original),
              vertices: geometry.vertices.map((vertex, index) => buildEndpoint(vertex, piece.featureIdentityIntent.vertices[index])),
              closed: Boolean(geometry.closed) })
          }
          throw new Error(`Unsupported extend replacement geometry type: ${geometry.type}`)
        }

        let transaction
        try {
          const replacementRecord = buildRecord(plan.targetRecordId, plan.replacement)
          transaction = controller.beginTransaction()
          transaction.replace(plan.targetRecordId, replacementRecord)
          return transaction.publish()
        } catch (error) {
          if (transaction?.isOpen) transaction.rollback()
          return Object.freeze({ status: "commit-failed", message: error.message })
        }
      },
      setLayer(recordId, layerId) {
        return assignRecordsToLayer([recordId], layerId)
      },
    })
    function layerByName(name) {
      const key = layerNameKey(name)
      return Object.values(state.layers).find(layer => layerNameKey(layer.name) === key) || null
    }
    const layerGateway = Object.freeze({
      setCurrent(layerId) {
        if (!has(state.layers, layerId)) return Object.freeze({ status: "unknown-layer", layerId })
        if (!layerUsable(layerId)) return Object.freeze({ status: "layer-unavailable", layerId })
        if (state.currentLayerId === layerId) return Object.freeze({ status: "no-op", changes: Object.freeze([]) })
        const transaction = controller.beginTransaction()
        transaction.replaceIn("settings", "currentLayerId", layerId)
        return transaction.publish()
      },
      create(name, { makeCurrent = false } = {}) {
        const normalizedName = normalizeLayerName(name)
        if (!normalizedName || !validLayerName(normalizedName)) return Object.freeze({ status: "invalid-layer-name" })
        if (layerByName(normalizedName)) return Object.freeze({ status: "duplicate-layer-name", name: normalizedName })
        const layer = freeze({ id: newId(), name: normalizedName, visible: true, locked: false, ...window.CaderactObjectProperties.DEFAULT_LAYER_PROPERTIES })
        const transaction = controller.beginTransaction()
        transaction.createIn("layers", layer.id, layer)
        if (makeCurrent) transaction.replaceIn("settings", "currentLayerId", layer.id)
        return transaction.publish()
      },
      rename(layerId, name) {
        const layer = state.layers[layerId], normalizedName = normalizeLayerName(name)
        if (!layer) return Object.freeze({ status: "unknown-layer", layerId })
        if (!normalizedName || !validLayerName(normalizedName)) return Object.freeze({ status: "invalid-layer-name" })
        if (layerNameKey(layer.name) === layerNameKey(normalizedName)) return Object.freeze({ status: "no-op", changes: Object.freeze([]) })
        if (layerByName(normalizedName)) return Object.freeze({ status: "duplicate-layer-name", name: normalizedName })
        const transaction = controller.beginTransaction()
        transaction.replaceIn("layers", layerId, { ...layer, name: normalizedName })
        return transaction.publish()
      },
      remove(layerId) {
        const layer = state.layers[layerId]
        if (!layer) return Object.freeze({ status: "unknown-layer", layerId })
        if (layerId === state.defaultLayerId) return Object.freeze({ status: "default-layer-required", layerId })
        if (Object.values(state.geometry.objects).some(record => record.layerId === layerId)) {
          return Object.freeze({ status: "layer-in-use", layerId })
        }
        const transaction = controller.beginTransaction()
        if (layerId === state.currentLayerId) transaction.replaceIn("settings", "currentLayerId", state.defaultLayerId)
        transaction.removeIn("layers", layerId)
        return transaction.publish()
      },
      setVisibility(layerId, visible) {
        const layer=state.layers[layerId],next=Boolean(visible)
        if(!layer)return Object.freeze({status:"unknown-layer",layerId})
        if(layer.visible===next)return Object.freeze({status:"no-op",changes:Object.freeze([])})
        let replacement=null
        if(!next&&state.currentLayerId===layerId){replacement=Object.values(state.layers).filter(candidate=>candidate.id!==layerId&&candidate.visible&&!candidate.locked).sort((a,b)=>a.id.localeCompare(b.id));replacement=replacement.find(candidate=>candidate.id===state.defaultLayerId)||replacement[0]||null;if(!replacement)return Object.freeze({status:"no-usable-current-layer",layerId})}
        const transaction=controller.beginTransaction();transaction.replaceIn("layers",layerId,{...layer,visible:next});if(replacement)transaction.replaceIn("settings","currentLayerId",replacement.id);return transaction.publish()
      },
      setLocked(layerId, locked) {
        const layer=state.layers[layerId],next=Boolean(locked)
        if(!layer)return Object.freeze({status:"unknown-layer",layerId})
        if(layer.locked===next)return Object.freeze({status:"no-op",changes:Object.freeze([])})
        let replacement=null
        if(next&&state.currentLayerId===layerId){replacement=Object.values(state.layers).filter(candidate=>candidate.id!==layerId&&candidate.visible&&!candidate.locked).sort((a,b)=>a.id.localeCompare(b.id));replacement=replacement.find(candidate=>candidate.id===state.defaultLayerId)||replacement[0]||null;if(!replacement)return Object.freeze({status:"no-usable-current-layer",layerId})}
        const transaction=controller.beginTransaction();transaction.replaceIn("layers",layerId,{...layer,locked:next});if(replacement)transaction.replaceIn("settings","currentLayerId",replacement.id);return transaction.publish()
      },
    })
    const unitGateway = Object.freeze({
      setLengthUnit(unit) {
        if (!window.CaderactUnits.isSupportedLengthUnit(unit)) return Object.freeze({ status: "unsupported-unit", unit })
        if (state.units.length === unit) return Object.freeze({ status: "no-op", changes: Object.freeze([]) })
        const transaction = controller.beginTransaction()
        transaction.replaceIn("settings", "units", { ...state.units, length: unit })
        return transaction.publish()
      },
    })
    function uniqueStyleName(base){const names=new Set(Object.values(state.dimensionStyles).map(style=>style.name.toLowerCase()));if(!names.has(base.toLowerCase()))return base;for(let index=2;;index++){const candidate=`${base} ${index}`;if(!names.has(candidate.toLowerCase()))return candidate}}
    function publishStyleSettings(patches){const transaction=controller.beginTransaction();for(const [key,value] of Object.entries(patches))transaction.replaceIn("settings",key,value);return transaction.publish()}
    const dimensionStyleGateway=Object.freeze({
      set(patch){return this.update(state.currentDimensionStyleId,patch)},
      create(name){const normalized=normalizeDimensionStyleName(name||uniqueStyleName("Dimension Style 1"));if(Object.values(state.dimensionStyles).some(style=>style.name.toLowerCase()===normalized.toLowerCase()))return Object.freeze({status:"duplicate-name"});const source=state.dimensionStyles[state.currentDimensionStyleId],style={...DEFAULT_DIMENSION_STYLE,...source,id:newId(),name:normalized};const errors=validateDimensionStyle(style);if(errors.length)return Object.freeze({status:"invalid-style",errors:Object.freeze(errors)});const outcome=publishStyleSettings({dimensionStyles:{...state.dimensionStyles,[style.id]:style},dimensionStyleOrder:[...state.dimensionStyleOrder,style.id]});return Object.freeze({...outcome,style})},
      duplicate(styleId){const source=state.dimensionStyles[styleId];if(!source)return Object.freeze({status:"unknown-style"});const name=uniqueStyleName(`${source.name} Copy`),style={...source,id:newId(),name};const outcome=publishStyleSettings({dimensionStyles:{...state.dimensionStyles,[style.id]:style},dimensionStyleOrder:[...state.dimensionStyleOrder,style.id]});return Object.freeze({...outcome,style})},
      rename(styleId,name){return this.update(styleId,{name:normalizeDimensionStyleName(name)})},
      update(styleId,patch){const source=state.dimensionStyles[styleId];if(!source)return Object.freeze({status:"unknown-style"});const next={...source,...patch,id:source.id},errors=validateDimensionStyle(next);if(errors.length)return Object.freeze({status:"invalid-style",errors:Object.freeze(errors)});if(Object.values(state.dimensionStyles).some(style=>style.id!==styleId&&style.name.toLowerCase()===next.name.toLowerCase()))return Object.freeze({status:"duplicate-name"});if(JSON.stringify(next)===JSON.stringify(source))return Object.freeze({status:"no-op",changes:Object.freeze([])});return publishStyleSettings({dimensionStyles:{...state.dimensionStyles,[styleId]:next}})},
      setCurrent(styleId){if(!state.dimensionStyles[styleId])return Object.freeze({status:"unknown-style"});if(styleId===state.currentDimensionStyleId)return Object.freeze({status:"no-op",changes:Object.freeze([])});return publishStyleSettings({currentDimensionStyleId:styleId})},
      delete(styleId){if(!state.dimensionStyles[styleId])return Object.freeze({status:"unknown-style"});if(styleId===state.currentDimensionStyleId)return Object.freeze({status:"current-style"});const referenceCount=Object.values(state.geometry.objects).filter(record=>record.dimensionStyleId===styleId).length;if(referenceCount)return Object.freeze({status:"style-in-use",referenceCount});if(state.dimensionStyleOrder.length<=1)return Object.freeze({status:"last-style"});const styles={...state.dimensionStyles};delete styles[styleId];return publishStyleSettings({dimensionStyles:styles,dimensionStyleOrder:state.dimensionStyleOrder.filter(id=>id!==styleId)})},
      assign(recordIds,styleId){if(!state.dimensionStyles[styleId])return Object.freeze({status:"unknown-style"});const ids=Array.from(new Set(recordIds||[])),records=ids.map(id=>state.geometry.objects[id]);if(records.some(record=>!record?.type?.startsWith("dimension-")||!recordEditable(record.id)))return Object.freeze({status:"invalid-selection"});const changes=records.filter(record=>record.dimensionStyleId!==styleId);if(!changes.length)return Object.freeze({status:"no-op",changes:Object.freeze([])});const transaction=controller.beginTransaction();for(const record of changes)transaction.replace(record.id,{...record,dimensionStyleId:styleId});return transaction.publish()}
    })
    return Object.freeze({ reader, recordGateway, layerGateway, unitGateway, dimensionStyleGateway, controller })
  }
  window.CaderactDocument = Object.freeze({ createStore, validateDocument,validateDimensionStyle,migrateDocument,V1_FIELDS,V2_FIELDS,V3_FIELDS,DEFAULT_DIMENSION_STYLE,MAX_DIMENSION_TEXT_OVERRIDE_LENGTH,MAX_DIMENSION_STYLE_NAME_LENGTH, unknownFields })
})()
