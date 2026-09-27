// PERF2: lightweight renderer-neutral screen-space candidate index.
(() => {
  const finite=value=>Number.isFinite(value)
  function worldBounds(record){
    if(record?.type==="line")return{x1:Math.min(record.start.x,record.end.x),y1:Math.min(record.start.y,record.end.y),x2:Math.max(record.start.x,record.end.x),y2:Math.max(record.start.y,record.end.y),exact:true}
    if(record?.type==="polyline"&&record.vertices?.length){let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;for(const vertex of record.vertices){x1=Math.min(x1,vertex.x);y1=Math.min(y1,vertex.y);x2=Math.max(x2,vertex.x);y2=Math.max(y2,vertex.y)}return{x1,y1,x2,y2,exact:true}}
    if(record?.type==="circle"||record?.type==="arc"){const r=record.radius;return{x1:record.center.x-r,y1:record.center.y-r,x2:record.center.x+r,y2:record.center.y+r,exact:record.type==="circle"}}
    if(record?.type==="ellipse"){const length=Math.hypot(record.majorAxis.x,record.majorAxis.y);if(!length)return null;const nx=-record.majorAxis.y/length*record.minorRadius,ny=record.majorAxis.x/length*record.minorRadius,ex=Math.hypot(record.majorAxis.x,nx),ey=Math.hypot(record.majorAxis.y,ny);return{x1:record.center.x-ex,y1:record.center.y-ey,x2:record.center.x+ex,y2:record.center.y+ey,exact:true}}
    // Text extents and transformed Block contents are owned by their presentation
    // systems. Keep them in the conservative overflow set rather than risk a
    // false-negative selection or snap query from an insertion-point-only bound.
    return null
  }
  function screenBounds(record,worldToScreen){const bounds=worldBounds(record);if(!bounds)return null;const corners=[[bounds.x1,bounds.y1],[bounds.x2,bounds.y1],[bounds.x2,bounds.y2],[bounds.x1,bounds.y2]].map(([x,y])=>worldToScreen(x,y));if(corners.some(point=>!finite(point?.x)||!finite(point?.y)))return null;const xs=corners.map(point=>point.x),ys=corners.map(point=>point.y);return Object.freeze({left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys),exact:bounds.exact})}
  function createScreenIndex(records,worldToScreen,{cellSize=64,maxCellsPerRecord=256}={}){
    const source=Array.from(records||[]),cells=new Map(),overflow=[],entries=new Map(),extent={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity},key=(x,y)=>`${x}:${y}`
    for(const record of source){const bounds=screenBounds(record,worldToScreen),entry={record,bounds};entries.set(record,entry);if(!bounds){overflow.push(record);continue}extent.left=Math.min(extent.left,bounds.left);extent.top=Math.min(extent.top,bounds.top);extent.right=Math.max(extent.right,bounds.right);extent.bottom=Math.max(extent.bottom,bounds.bottom);const x1=Math.floor(bounds.left/cellSize),x2=Math.floor(bounds.right/cellSize),y1=Math.floor(bounds.top/cellSize),y2=Math.floor(bounds.bottom/cellSize),count=(x2-x1+1)*(y2-y1+1);if(count>maxCellsPerRecord){overflow.push(record);continue}for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++){const bucketKey=key(x,y),bucket=cells.get(bucketKey);if(bucket)bucket.push(record);else cells.set(bucketKey,[record])}}
    function collect(left,top,right,bottom){const found=new Set(overflow),x1=Math.floor(left/cellSize),x2=Math.floor(right/cellSize),y1=Math.floor(top/cellSize),y2=Math.floor(bottom/cellSize);for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++)for(const record of cells.get(key(x,y))||[])found.add(record);return found}
    function queryPoint(point,tolerance=0){return Object.freeze(Array.from(collect(point.x-tolerance,point.y-tolerance,point.x+tolerance,point.y+tolerance)))}
    function queryRect(rect,{mode="crossing"}={}){const candidates=collect(rect.left,rect.top,rect.right,rect.bottom),result=[];for(const record of candidates){const bounds=entries.get(record)?.bounds;if(!bounds){result.push(record);continue}const intersects=bounds.right>=rect.left&&bounds.left<=rect.right&&bounds.bottom>=rect.top&&bounds.top<=rect.bottom;if(mode==="crossing"){if(intersects)result.push(record);continue}const contained=bounds.left>=rect.left&&bounds.right<=rect.right&&bounds.top>=rect.top&&bounds.bottom<=rect.bottom;if(contained||!bounds.exact)result.push(record)}return Object.freeze(result)}
    const indexExtent=finite(extent.left)?Object.freeze({...extent}):null
    return Object.freeze({queryPoint,queryRect,size:source.length,extent:indexExtent})
  }
  function createWorldIndex(records,{cellSize=64,maxCellsPerRecord=256}={}){
    const source=Array.from(records||[]),cells=new Map(),overflow=[],entries=new Map(),key=(x,y)=>`${x}:${y}`
    for(const record of source){const bounds=worldBounds(record);entries.set(record,bounds);if(!bounds){overflow.push(record);continue}const x1=Math.floor(bounds.x1/cellSize),x2=Math.floor(bounds.x2/cellSize),y1=Math.floor(bounds.y1/cellSize),y2=Math.floor(bounds.y2/cellSize),count=(x2-x1+1)*(y2-y1+1);if(count>maxCellsPerRecord){overflow.push(record);continue}for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++){const bucketKey=key(x,y),bucket=cells.get(bucketKey);if(bucket)bucket.push(record);else cells.set(bucketKey,[record])}}
    function queryRect(rect){const found=new Set(overflow),x1=Math.floor(rect.x1/cellSize),x2=Math.floor(rect.x2/cellSize),y1=Math.floor(rect.y1/cellSize),y2=Math.floor(rect.y2/cellSize);for(let x=x1;x<=x2;x++)for(let y=y1;y<=y2;y++)for(const record of cells.get(key(x,y))||[])found.add(record);const result=[];for(const record of found){const bounds=entries.get(record);if(!bounds||bounds.x2>=rect.x1&&bounds.x1<=rect.x2&&bounds.y2>=rect.y1&&bounds.y1<=rect.y2)result.push(record)}return Object.freeze(result)}
    return Object.freeze({queryRect,size:source.length})
  }
  window.CaderactSpatialQuery=Object.freeze({worldBounds,screenBounds,createScreenIndex,createWorldIndex})
})()
