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
  const MAX_GROUP_NAME_LENGTH=128,MAX_GROUPS=10000,MAX_GROUP_MEMBERS=10000
  const MAX_BLOCK_NAME_LENGTH=128,MAX_BLOCK_DEFINITIONS=5000,MAX_BLOCK_MEMBERS=10000,MAX_BLOCK_INSTANCES=100000,MAX_BLOCK_EDGES=100000,MAX_BLOCK_DEPTH=32
  const V2_FIELDS=Object.freeze({...V1_FIELDS,persistedDocument:fields([...V1_FIELDS.persistedDocument,"dimensionStyle"]),document:fields([...V1_FIELDS.document,"dimensionStyle"]),dimensionStyle:fields(Object.keys(DEFAULT_DIMENSION_STYLE)),dimensionLinear:fields(["id","type","layerId","color","linetype","lineweight","mode","firstPoint","secondPoint","dimensionLinePoint","textOverride"]),dimensionAngular:fields(["id","type","layerId","color","linetype","lineweight","firstRayPoint","vertex","secondRayPoint","dimensionArcPoint","textOverride"]),dimensionRadial:fields(["id","type","layerId","color","linetype","lineweight","mode","centerPoint","dimensionPoint","leaderPoint","textOverride"])})
  const V3_FIELDS=Object.freeze({...V2_FIELDS,persistedDocument:fields([...V1_FIELDS.persistedDocument,"dimensionStyles","currentDimensionStyleId","groups","nextGroupNumber","blockDefinitions"]),document:fields([...V1_FIELDS.document,"dimensionStyles","dimensionStyleOrder","currentDimensionStyleId","groups","nextGroupNumber","blockDefinitions"]),group:fields(["id","name","memberIds"]),blockDefinition:fields(["id","name","basePoint","records","recordOrder"]),blockInstance:fields(["id","type","layerId","color","linetype","lineweight","definitionId","insertionPoint","rotation","scale","mirrored"]),dimensionStyle:fields(["id","name",...Object.keys(DEFAULT_DIMENSION_STYLE)]),dimensionLinear:fields([...V2_FIELDS.dimensionLinear,"dimensionStyleId"]),dimensionAngular:fields([...V2_FIELDS.dimensionAngular,"dimensionStyleId"]),dimensionRadial:fields([...V2_FIELDS.dimensionRadial,"dimensionStyleId"]),dimensionOrdinate:fields(["id","type","layerId","color","linetype","lineweight","axis","datumPoint","featurePoint","leaderPoint","textOverride","dimensionStyleId"]),dimensionArcLength:fields(["id","type","layerId","color","linetype","lineweight","centerPoint","startPoint","endPoint","dimensionArcPoint","sweep","sourceRecordId","textOverride","dimensionStyleId"]),dimensionCenterMark:fields(["id","type","layerId","color","linetype","lineweight","centerPoint","sizePoint","sourceRecordId","dimensionStyleId"]),dimensionCenterLine:fields(["id","type","layerId","color","linetype","lineweight","firstPoint","secondPoint","extension","sourceRecordIds","dimensionStyleId"]),text:fields(["id","type","layerId","color","linetype","lineweight","insertionPoint","text","height","rotation","horizontalAlignment"]),region:fields(["id","type","layerId","color","linetype","lineweight","loops"]),hatch:fields(["id","type","layerId","color","linetype","lineweight","loops","pattern"]),hatchPattern:fields(["kind","name","angle","scale","origin"]),regionLoop:fields(["featureId","depth","parentIndex","edges"]),regionEdge:fields(["kind","featureId","start","end","center","majorAxis","radius","minorRadius","sweep","clockwise"])})
  const normalizeDimensionStyleName=value=>typeof value==="string"?value.trim():""
  function validateDimensionStyle(style){const errors=[];if(!isRecord(style))return["Invalid dimension style"];const name=normalizeDimensionStyleName(style.name);if(typeof style.id!=="string"||!style.id.trim())errors.push("Dimension style: missing ID");if(!name||name!==style.name||name.length>MAX_DIMENSION_STYLE_NAME_LENGTH||/[\u0000-\u001f\u007f]/.test(name))errors.push("Dimension style: invalid name");for(const key of ["textHeight","arrowSize"])if(!Number.isFinite(style[key])||style[key]<=0)errors.push(`Invalid dimension style ${key}`);for(const key of ["extensionGap","extensionBeyond","textGap"])if(!Number.isFinite(style[key])||style[key]<0)errors.push(`Invalid dimension style ${key}`);for(const key of ["linearPrecision","angularPrecision"])if(!Number.isInteger(style[key])||style[key]<0||style[key]>15)errors.push(`Invalid dimension style ${key}`);if(typeof style.showUnit!=="boolean"||typeof style.prefix!=="string"||typeof style.suffix!=="string"||style.arrowStyle!=="closed-filled")errors.push("Invalid dimension style fields");return errors}
  function migrateDocument(document){if(document?.formatVersion===3){const source=copyValue(document);source.groups??={};source.nextGroupNumber??=1;source.blockDefinitions??={};return source}const source=copyValue(document),styleId=`ds_${source.id}_standard`,style={id:styleId,name:"Standard",...(source.dimensionStyle||DEFAULT_DIMENSION_STYLE)},objects={};for(const [id,record] of Object.entries(source.geometry?.objects||{}))objects[id]=record.type?.startsWith("dimension-")?{...record,dimensionStyleId:styleId}:record;delete source.dimensionStyle;return{...source,formatVersion:3,geometry:{objects},dimensionStyles:{[styleId]:style},dimensionStyleOrder:[styleId],currentDimensionStyleId:styleId,groups:{},nextGroupNumber:1,blockDefinitions:{}}}
  function unknownFields(value, allowedFields) {
    if (!isRecord(value)) return []
    const allowed = new Set(allowedFields)
    return Reflect.ownKeys(value)
      .filter(key => Object.prototype.propertyIsEnumerable.call(value, key) && !allowed.has(key))
      .map(String)
      .sort()
  }

  function validateDocument(value,{skipBlocks=false}={}) {
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
      } else if(record.type==="dimension-ordinate"){
        closedShape(record,schema.dimensionOrdinate,"Ordinate dimension");if(!["x","y"].includes(record.axis))errors.push("Ordinate dimension: invalid axis");for(const key of ["datumPoint","featurePoint","leaderPoint"]){point(record[key],`Ordinate dimension ${key}`);closedShape(record[key],schema.endpoint,`Ordinate dimension ${key}`);identity(record[key]?.featureId,`Ordinate dimension ${key} feature`)}if(!has(styles||{},record.dimensionStyleId))errors.push("Ordinate dimension: invalid dimensionStyleId");dimensionTextOverride(record.textOverride,"Ordinate dimension")
      } else if(record.type==="dimension-arc-length"){
        closedShape(record,schema.dimensionArcLength,"Arc-length dimension");for(const key of ["centerPoint","startPoint","endPoint","dimensionArcPoint"]){point(record[key],`Arc-length dimension ${key}`);closedShape(record[key],schema.endpoint,`Arc-length dimension ${key}`);identity(record[key]?.featureId,`Arc-length dimension ${key} feature`)}if(!Number.isFinite(record.sweep)||record.sweep===0)errors.push("Arc-length dimension: invalid sweep");if(typeof record.sourceRecordId!=="string")errors.push("Arc-length dimension: invalid source reference");if(!has(styles||{},record.dimensionStyleId))errors.push("Arc-length dimension: invalid dimensionStyleId");dimensionTextOverride(record.textOverride,"Arc-length dimension")
      } else if(record.type==="dimension-center-mark"){
        closedShape(record,schema.dimensionCenterMark,"Center mark");for(const key of ["centerPoint","sizePoint"]){point(record[key],`Center mark ${key}`);closedShape(record[key],schema.endpoint,`Center mark ${key}`);identity(record[key]?.featureId,`Center mark ${key} feature`)}if(typeof record.sourceRecordId!=="string")errors.push("Center mark: invalid source reference");if(!has(styles||{},record.dimensionStyleId))errors.push("Center mark: invalid dimensionStyleId")
      } else if(record.type==="dimension-center-line"){
        closedShape(record,schema.dimensionCenterLine,"Center line");for(const key of ["firstPoint","secondPoint"]){point(record[key],`Center line ${key}`);closedShape(record[key],schema.endpoint,`Center line ${key}`);identity(record[key]?.featureId,`Center line ${key} feature`)}if(!Number.isFinite(record.extension)||record.extension<0)errors.push("Center line: invalid extension");if(!Array.isArray(record.sourceRecordIds)||record.sourceRecordIds.length!==2||record.sourceRecordIds.some(id=>typeof id!=="string"))errors.push("Center line: invalid source references");if(!has(styles||{},record.dimensionStyleId))errors.push("Center line: invalid dimensionStyleId")
      } else if(record.type==="text"){
        closedShape(record,schema.text,"Text");closedShape(record.insertionPoint,schema.endpoint,"Text insertion point");point(record.insertionPoint,"Text insertion point");identity(record.insertionPoint?.featureId,"Text insertion feature");for(const error of window.CaderactAnnotationGeometry.validate(record))errors.push(`Text: ${error}`)
      } else if(record.type==="block-instance"){
        closedShape(record,schema.blockInstance,"Block Instance");closedShape(record.insertionPoint,schema.endpoint,"Block Instance insertion point");point(record.insertionPoint,"Block Instance insertion point");identity(record.insertionPoint?.featureId,"Block Instance insertion feature");if(!has(value.blockDefinitions||{},record.definitionId))errors.push("Block Instance: missing definition");if(!Number.isFinite(record.rotation)||record.rotation!==canonicalAngle(record.rotation))errors.push("Block Instance: invalid canonical rotation");if(!Number.isFinite(record.scale)||!(record.scale>0))errors.push("Block Instance: invalid scale");if(typeof record.mirrored!=="boolean")errors.push("Block Instance: invalid mirrored state")
      } else if(record.type==="region"||record.type==="hatch"){
        const label=record.type==="hatch"?"Hatch":"Region";closedShape(record,schema[record.type],label)
        if(record.type==="hatch")closedShape(record.pattern,schema.hatchPattern,"Hatch pattern")
        if(!Array.isArray(record.loops))errors.push(`${label}: loops must be an array`)
        else for(const loop of record.loops){closedShape(loop,schema.regionLoop,`${label} loop`);identity(loop?.featureId,`${label} loop feature`);if(!Array.isArray(loop?.edges))errors.push(`${label} loop: edges must be an array`);else for(const edge of loop.edges){closedShape(edge,schema.regionEdge,`${label} edge`);identity(edge?.featureId,`${label} edge feature`);for(const key of ["start","end"])if(edge[key]){point(edge[key],`${label} edge ${key}`);closedShape(edge[key],schema.endpoint,`${label} edge ${key}`);identity(edge[key].featureId,`${label} edge ${key} feature`)}}}
        for(const error of (record.type==="hatch"?window.CaderactHatchGeometry:window.CaderactRegionGeometry).validate(record))errors.push(error)
      } else errors.push("Unsupported object type")
    }
    const groups=value.groups,groupNames=new Set(),memberships=new Set();let highestDefaultGroupNumber=0
    if(!isRecord(groups))errors.push("Invalid Group table")
    else if(Object.keys(groups).length>MAX_GROUPS)errors.push("Group: group limit exceeded")
    else for(const [key,group] of Object.entries(groups)){
      if(!isRecord(group)){errors.push("Invalid Group");continue}
      closedShape(group,V3_FIELDS.group,"Group");identity(group.id,"Group");if(key!==group.id)errors.push("Group key/ID mismatch")
      const name=typeof group.name==="string"?group.name.trim():"";if(!name||name!==group.name||name.length>MAX_GROUP_NAME_LENGTH||/[\u0000-\u001f\u007f]/.test(name))errors.push("Group: invalid name");else{const nameKey=name.toLowerCase();if(groupNames.has(nameKey))errors.push(`Duplicate Group name ${name}`);groupNames.add(nameKey);const numbered=/^Group ([1-9]\d*)$/.exec(name);if(numbered)highestDefaultGroupNumber=Math.max(highestDefaultGroupNumber,Number(numbered[1]))}
      if(!Array.isArray(group.memberIds)||group.memberIds.length<2)errors.push("Group: at least two members are required")
      else if(group.memberIds.length>MAX_GROUP_MEMBERS)errors.push("Group: member limit exceeded")
      else {const local=new Set();for(const memberId of group.memberIds){if(typeof memberId!=="string"||!has(objects||{},memberId))errors.push(`Group: missing member ${String(memberId)}`);if(local.has(memberId))errors.push(`Group: duplicate member ${memberId}`);local.add(memberId);if(memberships.has(memberId))errors.push(`Group: record ${memberId} belongs to multiple Groups`);memberships.add(memberId)}const sorted=[...group.memberIds].sort();if(group.memberIds.some((id,index)=>id!==sorted[index]))errors.push("Group: member order must be canonical")}
    }
    if(!Number.isSafeInteger(value.nextGroupNumber)||value.nextGroupNumber<1||value.nextGroupNumber<=highestDefaultGroupNumber)errors.push("Invalid nextGroupNumber")
    if(!skipBlocks){validateBlocks(value,errors,identity);validateBlockDepth(value.blockDefinitions,errors)}
    return errors
  }

  function canonicalAngle(value){if(!Number.isFinite(value))return NaN;let result=((value+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;if(result<=-Math.PI)result=Math.PI;return Object.is(result,-0)?0:result}
  function recordIdentityValues(record){const values=[record?.id];if(record?.type==="line"||record?.type==="arc")values.push(record.start?.featureId,record.end?.featureId);else if(record?.type==="polyline")for(const vertex of record.vertices||[])values.push(vertex?.featureId);else if(record?.type?.startsWith("dimension-")||record?.type==="text"||record?.type==="block-instance")for(const child of Object.values(record||{}))if(child?.featureId)values.push(child.featureId);else if(record?.type==="region"||record?.type==="hatch")for(const loop of record.loops||[]){values.push(loop?.featureId);for(const edge of loop?.edges||[]){values.push(edge?.featureId);if(edge?.start?.featureId)values.push(edge.start.featureId);if(edge?.end?.featureId)values.push(edge.end.featureId)}}return values}
  function validateBlocks(value,errors,identity){const definitions=value.blockDefinitions,names=new Set();if(!isRecord(definitions)){errors.push("Invalid Block Definition table");return}const entries=Object.entries(definitions);if(entries.length>MAX_BLOCK_DEFINITIONS){errors.push("Block Definition limit exceeded");return}let edges=0,instances=Object.values(value.geometry?.objects||{}).filter(record=>record.type==="block-instance").length;if(instances>MAX_BLOCK_INSTANCES)errors.push("Block Instance limit exceeded");for(const [key,definition] of entries){if(!isRecord(definition)){errors.push("Invalid Block Definition");continue}closedShapeForBlock(definition,V3_FIELDS.blockDefinition,"Block Definition",errors);identity(definition.id,"Block Definition");if(key!==definition.id)errors.push("Block Definition key/ID mismatch");const name=typeof definition.name==="string"?definition.name.trim():"";if(!name||name!==definition.name||name.length>MAX_BLOCK_NAME_LENGTH||/[\u0000-\u001f\u007f]/.test(name))errors.push("Block Definition: invalid name");else{const normalized=name.toLowerCase();if(names.has(normalized))errors.push(`Duplicate Block Definition name ${name}`);names.add(normalized)}if(!isRecord(definition.basePoint)||!Number.isFinite(definition.basePoint.x)||!Number.isFinite(definition.basePoint.y)||unknownFields(definition.basePoint,V3_FIELDS.coordinate).length)errors.push("Block Definition: invalid base point");if(!isRecord(definition.records)||!Array.isArray(definition.recordOrder)){errors.push("Block Definition: invalid records/order");continue}const recordIds=Object.keys(definition.records);if(recordIds.length>MAX_BLOCK_MEMBERS)errors.push("Block Definition member limit exceeded");if(definition.recordOrder.length!==recordIds.length||new Set(definition.recordOrder).size!==definition.recordOrder.length||definition.recordOrder.some(id=>!has(definition.records,id))||recordIds.some(id=>!definition.recordOrder.includes(id)))errors.push("Block Definition: invalid recordOrder");for(const recordId of definition.recordOrder){const record=definition.records[recordId];if(!isRecord(record)||record.id!==recordId){errors.push("Block Definition member key/ID mismatch");continue}for(const id of recordIdentityValues(record))identity(id,"Block Definition member");if(record.type==="block-instance")edges++;const temporary={...value,geometry:{objects:{[record.id]:record}},groups:{},blockDefinitions:definitions};for(const error of validateDocument(temporary,{skipBlocks:true}))if(!error.startsWith("Invalid nextGroupNumber"))errors.push(`Block Definition member: ${error}`)}}if(edges>MAX_BLOCK_EDGES)errors.push("Block Definition edge limit exceeded");const visiting=new Set(),visited=new Set();function dfs(id,depth){if(depth>MAX_BLOCK_DEPTH){errors.push("Block Definition nesting depth exceeded");return}if(visiting.has(id)){errors.push("Block Definition cycle detected");return}if(visited.has(id))return;visiting.add(id);for(const record of Object.values(definitions[id]?.records||{}))if(record?.type==="block-instance"&&has(definitions,record.definitionId))dfs(record.definitionId,depth+1);visiting.delete(id);visited.add(id)}for(const id of Object.keys(definitions).sort())dfs(id,1)}
  function closedShapeForBlock(candidate,allowed,label,errors){const unknown=unknownFields(candidate,allowed);if(unknown.length)errors.push(`${label}: unknown field${unknown.length===1?"":"s"} ${unknown.join(", ")}`)}
  function validateBlockDepth(definitions,errors){if(!isRecord(definitions))return;function visit(id,depth,path){if(depth>MAX_BLOCK_DEPTH){errors.push("Block Definition nesting depth exceeded");return}if(path.has(id))return;const next=new Set(path);next.add(id);for(const record of Object.values(definitions[id]?.records||{}))if(record?.type==="block-instance"&&has(definitions,record.definitionId))visit(record.definitionId,depth+1,next)}for(const id of Object.keys(definitions).sort())visit(id,1,new Set())}

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
      for(const group of Object.values(candidate.groups))allocated.add(group.id)
      for(const definition of Object.values(candidate.blockDefinitions)){allocated.add(definition.id);for(const record of Object.values(definition.records))for(const id of recordIdentityValues(record))allocated.add(id)}
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
      const dimensionStyleId=newId();state = freeze({ id, name: "Untitled", formatVersion: 3, units: { length: "mm" },dimensionStyles:{[dimensionStyleId]:{id:dimensionStyleId,name:"Standard",...DEFAULT_DIMENSION_STYLE}},dimensionStyleOrder:[dimensionStyleId],currentDimensionStyleId:dimensionStyleId,groups:{},nextGroupNumber:1,blockDefinitions:{},
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
      getCollections: document => ({ records: document.geometry.objects, groups:document.groups, blockDefinitions:document.blockDefinitions,layers: document.layers,
        settings: { units: document.units, currentLayerId: document.currentLayerId,dimensionStyles:document.dimensionStyles,dimensionStyleOrder:document.dimensionStyleOrder,currentDimensionStyleId:document.currentDimensionStyleId,nextGroupNumber:document.nextGroupNumber } }),
      assembleDocument: (baseDocument, collections) => ({
        ...baseDocument,
        geometry: { objects: collections.records },
        groups:collections.groups,nextGroupNumber:collections.settings.nextGroupNumber,blockDefinitions:collections.blockDefinitions,
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
      groups:()=>Object.freeze(Object.values(state.groups).sort((a,b)=>a.id.localeCompare(b.id))),
      group:groupId=>state.groups[groupId]||null,
      groupForRecord:recordId=>Object.values(state.groups).find(group=>group.memberIds.includes(recordId))||null,
      blockDefinitions:()=>Object.freeze(Object.values(state.blockDefinitions).sort((a,b)=>a.id.localeCompare(b.id))),
      blockDefinition:definitionId=>state.blockDefinitions[definitionId]||null,
    })
    // Schema-aware, command-agnostic record gateway. Commands may construct
    // immutable records before publication, while atomic creation remains
    // controlled by one short document transaction.
    function layerUsable(layerId) { const layer=state.layers[layerId];return Boolean(layer?.visible&&!layer.locked) }
    function currentDrawingLayerId() { if(!layerUsable(state.currentLayerId))throw new Error("Current layer is hidden or locked");return state.currentLayerId }
    function recordEditable(recordId) { const record=state.geometry.objects[recordId];return Boolean(record&&layerUsable(record.layerId)) }
    const validGroupName=value=>typeof value==="string"&&value.trim()===value&&value.length>0&&value.length<=MAX_GROUP_NAME_LENGTH&&!/[\u0000-\u001f\u007f]/.test(value)
    function cleanupGroupsForRemovedRecords(transaction,recordIds){const removed=new Set(recordIds);for(const group of Object.values(state.groups)){const memberIds=group.memberIds.filter(id=>!removed.has(id));if(memberIds.length===group.memberIds.length)continue;if(memberIds.length<2)transaction.removeIn("groups",group.id);else transaction.replaceIn("groups",group.id,{...group,memberIds})}}
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
      createOrdinateDimension(geometry){const feature=value=>({x:value?.x,y:value?.y,featureId:newId()});return freeze({id:newId(),type:"dimension-ordinate",layerId:currentDrawingLayerId(),...window.CaderactObjectProperties.BY_LAYER_PROPERTIES,axis:geometry.axis,datumPoint:feature(geometry.datumPoint),featurePoint:feature(geometry.featurePoint),leaderPoint:feature(geometry.leaderPoint),textOverride:geometry.textOverride??null,dimensionStyleId:geometry.dimensionStyleId||state.currentDimensionStyleId})},
      createArcLengthDimension(geometry){const feature=value=>({x:value?.x,y:value?.y,featureId:newId()});return freeze({id:newId(),type:"dimension-arc-length",layerId:currentDrawingLayerId(),...window.CaderactObjectProperties.BY_LAYER_PROPERTIES,centerPoint:feature(geometry.centerPoint),startPoint:feature(geometry.startPoint),endPoint:feature(geometry.endPoint),dimensionArcPoint:feature(geometry.dimensionArcPoint),sweep:geometry.sweep,sourceRecordId:geometry.sourceRecordId,textOverride:geometry.textOverride??null,dimensionStyleId:geometry.dimensionStyleId||state.currentDimensionStyleId})},
      createCenterMark(geometry){const feature=value=>({x:value?.x,y:value?.y,featureId:newId()});return freeze({id:newId(),type:"dimension-center-mark",layerId:currentDrawingLayerId(),...window.CaderactObjectProperties.BY_LAYER_PROPERTIES,centerPoint:feature(geometry.centerPoint),sizePoint:feature(geometry.sizePoint),sourceRecordId:geometry.sourceRecordId,dimensionStyleId:geometry.dimensionStyleId||state.currentDimensionStyleId})},
      createCenterLine(geometry){const feature=value=>({x:value?.x,y:value?.y,featureId:newId()});return freeze({id:newId(),type:"dimension-center-line",layerId:currentDrawingLayerId(),...window.CaderactObjectProperties.BY_LAYER_PROPERTIES,firstPoint:feature(geometry.firstPoint),secondPoint:feature(geometry.secondPoint),extension:geometry.extension??0,sourceRecordIds:Object.freeze([...geometry.sourceRecordIds]),dimensionStyleId:geometry.dimensionStyleId||state.currentDimensionStyleId})},
      createText(geometry){return freeze({id:newId(),type:"text",layerId:currentDrawingLayerId(),...window.CaderactObjectProperties.BY_LAYER_PROPERTIES,insertionPoint:{x:geometry.insertionPoint?.x,y:geometry.insertionPoint?.y,featureId:newId()},text:geometry.text,height:geometry.height,rotation:window.CaderactAnnotationGeometry.normalizeRotation(geometry.rotation),horizontalAlignment:geometry.horizontalAlignment||"left"})},
      createBlockInstance({definitionId,insertionPoint,rotation=0,scale=1,mirrored=false,layerId=currentDrawingLayerId()}={}){if(!has(state.blockDefinitions,definitionId))throw new Error("Missing Block Definition");return freeze({id:newId(),type:"block-instance",layerId,...window.CaderactObjectProperties.BY_LAYER_PROPERTIES,definitionId,insertionPoint:{x:insertionPoint?.x,y:insertionPoint?.y,featureId:newId()},rotation:canonicalAngle(rotation),scale,mirrored})},
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
          cleanupGroupsForRemovedRecords(transaction,recordIds)
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
        if(record.type==="block-instance")return freeze({...record,id:newId(),insertionPoint:{...record.insertionPoint,featureId:newId()}})
        throw new Error(`Unsupported geometry type: ${record.type}`)
      },
      explodeBlockInstances(recordIds) {
        const sourceIds=Array.from(new Set(recordIds||[])),sources=sourceIds.map(id=>state.geometry.objects[id]||null)
        if(!sourceIds.length)return Object.freeze({status:"empty-selection",recordIds:Object.freeze([])})
        if(sources.some(record=>!record||record.type!=="block-instance"))return Object.freeze({status:"invalid-selection",recordIds:Object.freeze(sourceIds)})
        if(sources.some(record=>!recordEditable(record.id)))return Object.freeze({status:"record-layer-unavailable",recordIds:Object.freeze(sourceIds)})
        const grouped=sources.find(record=>reader.groupForRecord(record.id))
        if(grouped)return Object.freeze({status:"grouped-instance",recordId:grouped.id})
        let outputs
        try{
          const document=reader.snapshot()
          outputs=sources.flatMap(instance=>window.CaderactBlockTraversal.traverse(document,instance).entries.map(entry=>recordGateway.copyWithFreshIdentity(window.CaderactGeometryTransform.similarityRecord(entry.record,entry.transform))))
          if(!outputs.length)return Object.freeze({status:"empty-definition",recordIds:Object.freeze(sourceIds)})
        }catch(error){return Object.freeze({status:"expansion-failed",message:error.message,recordIds:Object.freeze(sourceIds)})}
        let transaction
        try{
          transaction=controller.beginTransaction()
          for(const record of outputs)transaction.create(record.id,record)
          for(const id of sourceIds)transaction.remove(id)
          const outcome=transaction.publish()
          return Object.freeze({...outcome,sourceRecordIds:Object.freeze(sourceIds),records:Object.freeze(outputs)})
        }catch(error){if(transaction?.isOpen)transaction.rollback();return Object.freeze({status:"commit-failed",message:error.message,recordIds:Object.freeze(sourceIds)})}
      },
      updateProperties(recordId, properties) {
        return updateRecordProperties(recordId, properties)
      },
      setProperties(recordIds,patch){return setRecordProperties(recordIds,patch)},
      assignLayer(recordIds, layerId) { return assignRecordsToLayer(recordIds, layerId) },
      // DC1: atomically applies a pure Fillet/Chamfer corner plan. Geometry
      // planning and pick-side decisions stay outside the document authority.
      publishCornerPlan(plan) {
        if (!plan || plan.status !== "planned" || !["fillet", "chamfer"].includes(plan.operation)) return Object.freeze({ status: "no-op", reason: plan?.reason || "missing-plan" })
        const sourceIds = plan.replacements?.map(value => value.recordId) || []
        if (sourceIds.length !== 2 || new Set(sourceIds).size !== 2) return Object.freeze({ status: "invalid-plan" })
        const sources = sourceIds.map(id => state.geometry.objects[id] || null)
        if (sources.some(record => record?.type !== "line")) return Object.freeze({ status: "missing-record" })
        if (sourceIds.some(id => !recordEditable(id))) return Object.freeze({ status: "record-layer-unavailable" })
        if (sourceIds.some(id => reader.groupForRecord(id))) return Object.freeze({ status: "grouped-record" })
        const snapshot = record => ({ id: record.id, start: { x: record.start.x, y: record.start.y }, end: { x: record.end.x, y: record.end.y } })
        if (JSON.stringify(sources.map(snapshot)) !== JSON.stringify(plan.sourceGeometry)) return Object.freeze({ status: "stale-plan" })
        const featureId = intent => intent?.role === "preserve" ? intent.featureId : intent?.role === "allocate" ? newId() : (() => { throw new Error("Invalid corner feature intent") })()
        const replacements = plan.replacements.map((entry, index) => {
          const source = sources[index], geometry = entry.geometry
          return freeze({ ...source,
            start: { x: geometry.start.x, y: geometry.start.y, featureId: featureId(entry.endpointIntent.start) },
            end: { x: geometry.end.x, y: geometry.end.y, featureId: featureId(entry.endpointIntent.end) } })
        })
        let created = null
        if (plan.createdGeometry) {
          const geometry = plan.createdGeometry, source = sources[0], properties = window.CaderactObjectProperties.recordProperties(source)
          if (geometry.type === "line") created = freeze({ id: newId(), type: "line", layerId: source.layerId, ...properties,
            start: { x: geometry.start.x, y: geometry.start.y, featureId: newId() }, end: { x: geometry.end.x, y: geometry.end.y, featureId: newId() } })
          else if (geometry.type === "arc") created = freeze({ id: newId(), type: "arc", layerId: source.layerId, ...properties,
            center: { x: geometry.center.x, y: geometry.center.y }, radius: geometry.radius,
            start: { x: geometry.start.x, y: geometry.start.y, featureId: newId() }, end: { x: geometry.end.x, y: geometry.end.y, featureId: newId() }, sweep: geometry.sweep })
          else return Object.freeze({ status: "invalid-plan" })
        }
        let transaction
        try {
          transaction = controller.beginTransaction()
          for (const record of replacements) transaction.replace(record.id, record)
          if (created) transaction.create(created.id, created)
          const outcome = transaction.publish()
          return Object.freeze({ ...outcome, recordIds: Object.freeze([...sourceIds, ...(created ? [created.id] : [])]), createdRecord: created })
        } catch (error) {
          if (transaction?.isOpen) transaction.rollback()
          return Object.freeze({ status: "commit-failed", message: error.message })
        }
      },
      publishJoinPlan(plan) {
        if (!plan || plan.status !== "planned" || plan.operation !== "join") return Object.freeze({ status: "no-op", reason: plan?.reason || "missing-plan" })
        const sourceIds = [plan.baseRecordId, ...(plan.removeRecordIds || [])], sources = sourceIds.map(id => state.geometry.objects[id] || null)
        if (sources.some(record => !record)) return Object.freeze({ status: "missing-record" })
        if (sourceIds.some(id => !recordEditable(id))) return Object.freeze({ status: "record-layer-unavailable" })
        if (sourceIds.some(id => reader.groupForRecord(id))) return Object.freeze({ status: "grouped-record" })
        const snapshot = record => record.type === "line" ? { id: record.id, type: "line", start: { x: record.start.x, y: record.start.y, featureId: record.start.featureId }, end: { x: record.end.x, y: record.end.y, featureId: record.end.featureId } }
          : { id: record.id, type: "polyline", closed: Boolean(record.closed), vertices: record.vertices.map(vertex => ({ x: vertex.x, y: vertex.y, featureId: vertex.featureId })) }
        const expectedById = new Map(plan.sourceGeometry.map(value => [value.id, value]))
        if (sources.some(record => JSON.stringify(snapshot(record)) !== JSON.stringify(expectedById.get(record.id)))) return Object.freeze({ status: "stale-plan" })
        const source = sources[0], properties = window.CaderactObjectProperties.recordProperties(source), geometry = plan.geometry
        let replacement
        if (geometry.type === "line") replacement = freeze({ id: source.id, type: "line", layerId: source.layerId, ...properties,
          start: { x: geometry.start.x, y: geometry.start.y, featureId: geometry.start.featureId || newId() }, end: { x: geometry.end.x, y: geometry.end.y, featureId: geometry.end.featureId || newId() } })
        else if (geometry.type === "polyline") replacement = freeze({ id: source.id, type: "polyline", layerId: source.layerId, ...properties, closed: false,
          vertices: geometry.vertices.map(vertex => ({ x: vertex.x, y: vertex.y, featureId: vertex.featureId || newId() })) })
        else return Object.freeze({ status: "invalid-plan" })
        let transaction
        try { transaction = controller.beginTransaction();transaction.replace(source.id, replacement);cleanupGroupsForRemovedRecords(transaction, plan.removeRecordIds);for (const id of plan.removeRecordIds) transaction.remove(id);const outcome = transaction.publish();return Object.freeze({ ...outcome, record: replacement, removedRecordIds: plan.removeRecordIds }) }
        catch (error) { if (transaction?.isOpen) transaction.rollback();return Object.freeze({ status: "commit-failed", message: error.message }) }
      },
      publishSplitBreakPlan(plan) {
        if (!plan || plan.status !== "planned" || !["split", "break"].includes(plan.operation)) return Object.freeze({ status: "no-op", reason: plan?.reason || "missing-plan" })
        const original = state.geometry.objects[plan.targetRecordId]
        if (!original) return Object.freeze({ status: "missing-record" })
        if (!recordEditable(original.id)) return Object.freeze({ status: "record-layer-unavailable" })
        if (reader.groupForRecord(original.id)) return Object.freeze({ status: "grouped-record" })
        const snapshot = original.type === "line" ? { id: original.id, type: "line", start: { x: original.start.x, y: original.start.y, featureId: original.start.featureId }, end: { x: original.end.x, y: original.end.y, featureId: original.end.featureId } }
          : { id: original.id, type: "polyline", closed: Boolean(original.closed), vertices: original.vertices.map(vertex => ({ x: vertex.x, y: vertex.y, featureId: vertex.featureId })) }
        if (JSON.stringify(snapshot) !== JSON.stringify(plan.sourceGeometry)) return Object.freeze({ status: "stale-plan" })
        const properties = window.CaderactObjectProperties.recordProperties(original)
        const featureId = intent => intent?.role === "preserve" ? intent.featureId : intent?.role === "allocate" ? newId() : (() => { throw new Error("Invalid split feature intent") })()
        const build = (id, piece) => piece.geometry.type === "line"
          ? freeze({ id, type: "line", layerId: original.layerId, ...properties, start: { x: piece.geometry.start.x, y: piece.geometry.start.y, featureId: featureId(piece.vertexIntents[0]) }, end: { x: piece.geometry.end.x, y: piece.geometry.end.y, featureId: featureId(piece.vertexIntents[1]) } })
          : freeze({ id, type: "polyline", layerId: original.layerId, ...properties, closed: false, vertices: piece.geometry.vertices.map((vertex, index) => ({ x: vertex.x, y: vertex.y, featureId: featureId(piece.vertexIntents[index]) })) })
        let transaction
        try { const replacement = build(original.id, plan.replacement), creates = plan.creates.map(piece => build(newId(), piece));transaction = controller.beginTransaction();transaction.replace(original.id, replacement);for (const record of creates) transaction.create(record.id, record);const outcome = transaction.publish();return Object.freeze({ ...outcome, records: Object.freeze([replacement, ...creates]) }) }
        catch (error) { if (transaction?.isOpen) transaction.rollback();return Object.freeze({ status: "commit-failed", message: error.message }) }
      },
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
    const groupGateway=Object.freeze({
      createGroup(memberIds,{name}={}){const members=Array.from(memberIds||[]);if(members.length<2)return Object.freeze({status:"insufficient-members"});if(members.length>MAX_GROUP_MEMBERS)return Object.freeze({status:"member-limit"});if(new Set(members).size!==members.length)return Object.freeze({status:"duplicate-member"});if(members.some(id=>typeof id!=="string"||!has(state.geometry.objects,id)))return Object.freeze({status:"missing-member"});if(members.some(id=>reader.groupForRecord(id)))return Object.freeze({status:"already-grouped"});if(Object.keys(state.groups).length>=MAX_GROUPS)return Object.freeze({status:"group-limit"});const defaultName=name===undefined,groupName=defaultName?`Group ${state.nextGroupNumber}`:name;if(!validGroupName(groupName))return Object.freeze({status:"invalid-name"});if(Object.values(state.groups).some(group=>group.name.toLowerCase()===groupName.toLowerCase()))return Object.freeze({status:"duplicate-name"});const numbered=/^Group ([1-9]\d*)$/.exec(groupName),nextGroupNumber=numbered?Math.max(state.nextGroupNumber,Number(numbered[1])+1):state.nextGroupNumber;const group=freeze({id:newId(),name:groupName,memberIds:[...members].sort()}),transaction=controller.beginTransaction();try{transaction.createIn("groups",group.id,group);if(nextGroupNumber!==state.nextGroupNumber)transaction.replaceIn("settings","nextGroupNumber",nextGroupNumber);const outcome=transaction.publish();return Object.freeze({...outcome,group})}catch(error){if(transaction.isOpen)transaction.rollback();return Object.freeze({status:"commit-failed",message:error.message})}},
      ungroup(groupId){if(!has(state.groups,groupId))return Object.freeze({status:"missing-group",groupId});const transaction=controller.beginTransaction();try{const group=state.groups[groupId];transaction.removeIn("groups",groupId);const outcome=transaction.publish();return Object.freeze({...outcome,group})}catch(error){if(transaction.isOpen)transaction.rollback();return Object.freeze({status:"commit-failed",message:error.message})}},
      publishCopies(sourceRecordIds,copies){const sourceIds=Array.from(sourceRecordIds||[]),records=Array.from(copies||[]);if(sourceIds.length!==records.length||new Set(sourceIds).size!==sourceIds.length)return Object.freeze({status:"invalid-copy-set"});if(sourceIds.some(id=>!recordEditable(id))||records.some(record=>!record||!layerUsable(record.layerId)||has(state.geometry.objects,record.id)))return Object.freeze({status:"record-layer-unavailable"});const copiedBySource=new Map(sourceIds.map((id,index)=>[id,records[index].id])),sourceSet=new Set(sourceIds),sourceGroups=new Map();for(const id of sourceIds){const group=reader.groupForRecord(id);if(group)sourceGroups.set(group.id,group)}for(const group of sourceGroups.values())if(group.memberIds.some(id=>!sourceSet.has(id)))return Object.freeze({status:"partial-group-copy",groupId:group.id});if(Object.keys(state.groups).length+sourceGroups.size>MAX_GROUPS)return Object.freeze({status:"group-limit"});let nextGroupNumber=state.nextGroupNumber;const groups=[];for(const source of Array.from(sourceGroups.values()).sort((a,b)=>a.id.localeCompare(b.id))){groups.push(freeze({id:newId(),name:`Group ${nextGroupNumber++}`,memberIds:source.memberIds.map(id=>copiedBySource.get(id)).sort()}))}let transaction;try{transaction=controller.beginTransaction();for(const record of records)transaction.create(record.id,record);for(const group of groups)transaction.createIn("groups",group.id,group);if(groups.length)transaction.replaceIn("settings","nextGroupNumber",nextGroupNumber);const outcome=transaction.publish();return Object.freeze({...outcome,groups:Object.freeze(groups)})}catch(error){if(transaction?.isOpen)transaction.rollback();return Object.freeze({status:"commit-failed",message:error.message})}},
    })
    const blockDefinitionGateway=Object.freeze({
      create({name,basePoint={x:0,y:0},records=[],recordOrder}={}){if(Object.keys(state.blockDefinitions).length>=MAX_BLOCK_DEFINITIONS)return Object.freeze({status:"definition-limit"});const values=Array.from(records),order=recordOrder?Array.from(recordOrder):values.map(record=>record?.id),definition=freeze({id:newId(),name,basePoint:{x:basePoint?.x,y:basePoint?.y},records:Object.fromEntries(values.map(record=>[record.id,copyValue(record)])),recordOrder:order});for(const record of values)for(const id of recordIdentityValues(record))if(typeof id==="string")allocated.add(id);const transaction=controller.beginTransaction();try{transaction.createIn("blockDefinitions",definition.id,definition);const outcome=transaction.publish();return Object.freeze({...outcome,definition})}catch(error){if(transaction.isOpen)transaction.rollback();return Object.freeze({status:"commit-failed",message:error.message})}},
      replace(definitionId,{name,basePoint,records,recordOrder}={}){const current=state.blockDefinitions[definitionId];if(!current)return Object.freeze({status:"missing-definition"});const values=records===undefined?Object.values(current.records):Array.from(records),definition=freeze({id:definitionId,name:name===undefined?current.name:name,basePoint:basePoint===undefined?current.basePoint:{x:basePoint?.x,y:basePoint?.y},records:Object.fromEntries(values.map(record=>[record.id,copyValue(record)])),recordOrder:recordOrder===undefined?(records===undefined?current.recordOrder:values.map(record=>record.id)):Array.from(recordOrder)});for(const record of values)for(const id of recordIdentityValues(record))if(typeof id==="string")allocated.add(id);const transaction=controller.beginTransaction();try{transaction.replaceIn("blockDefinitions",definitionId,definition);const outcome=transaction.publish();return Object.freeze({...outcome,definition})}catch(error){if(transaction.isOpen)transaction.rollback();return Object.freeze({status:"commit-failed",message:error.message})}},
      remove(definitionId){if(!has(state.blockDefinitions,definitionId))return Object.freeze({status:"missing-definition"});const referenced=Object.values(state.geometry.objects).some(record=>record.type==="block-instance"&&record.definitionId===definitionId)||Object.values(state.blockDefinitions).some(definition=>Object.values(definition.records).some(record=>record.type==="block-instance"&&record.definitionId===definitionId));if(referenced)return Object.freeze({status:"definition-in-use"});const transaction=controller.beginTransaction();try{transaction.removeIn("blockDefinitions",definitionId);return transaction.publish()}catch(error){if(transaction.isOpen)transaction.rollback();return Object.freeze({status:"commit-failed",message:error.message})}},
      validateGraph:()=>Object.freeze(validateDocument(state).filter(error=>error.startsWith("Block Definition"))),
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
    return Object.freeze({ reader, recordGateway, groupGateway, blockDefinitionGateway,layerGateway, unitGateway, dimensionStyleGateway, controller })
  }
  window.CaderactDocument = Object.freeze({ createStore, validateDocument,validateDimensionStyle,migrateDocument,V1_FIELDS,V2_FIELDS,V3_FIELDS,DEFAULT_DIMENSION_STYLE,MAX_DIMENSION_TEXT_OVERRIDE_LENGTH,MAX_DIMENSION_STYLE_NAME_LENGTH,MAX_GROUP_NAME_LENGTH,MAX_GROUPS,MAX_GROUP_MEMBERS,MAX_BLOCK_NAME_LENGTH,MAX_BLOCK_DEFINITIONS,MAX_BLOCK_MEMBERS,MAX_BLOCK_INSTANCES,MAX_BLOCK_EDGES,MAX_BLOCK_DEPTH,unknownFields })
})()
