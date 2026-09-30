// L5: shared viewport display mapping for semantic document strokes.
(() => {
  const DASH_PATTERNS=Object.freeze({continuous:Object.freeze([]),dashed:Object.freeze([8,4]),dotted:Object.freeze([1,3]),"dash-dot":Object.freeze([8,3,1,3])})
  function lineweightToCssPixels(lineweight){return Math.max(.75,Math.min(4,lineweight/.25))}
  function dashPattern(linetype){return DASH_PATTERNS[linetype]||DASH_PATTERNS.continuous}
  function dashSegments(source,pattern){
    if(!pattern?.length)return source instanceof Float32Array?source:new Float32Array(source)
    const output=[]
    let patternIndex=0,remaining=pattern[0]
    for(let index=0;index<source.length;index+=4){const x1=source[index],y1=source[index+1],x2=source[index+2],y2=source[index+3],dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy);if(!(length>0))continue;let distance=0;while(distance<length){const step=Math.min(length-distance,remaining),next=distance+step;if(patternIndex%2===0)output.push(x1+dx*distance/length,y1+dy*distance/length,x1+dx*next/length,y1+dy*next/length);distance=next;remaining-=step;if(remaining<=1e-9){patternIndex=(patternIndex+1)%pattern.length;remaining=pattern[patternIndex]}}}
    return new Float32Array(output)
  }
  function strokeTriangles(source,width){
    const halfWidth=Math.max(Number.EPSILON,Number(width)||1)/2,output=[]
    for(let index=0;index<source.length;index+=4){
      const x1=source[index],y1=source[index+1],x2=source[index+2],y2=source[index+3],dx=x2-x1,dy=y2-y1,length=Math.hypot(dx,dy)
      if(!(length>0))continue
      const nx=-dy/length*halfWidth,ny=dx/length*halfWidth
      const ax=x1+nx,ay=y1+ny,bx=x1-nx,by=y1-ny,cx=x2+nx,cy=y2+ny,dx2=x2-nx,dy2=y2-ny
      // One semantic segment becomes one solid quad (two triangles). It is
      // never approximated by several parallel line primitives.
      output.push(ax,ay,bx,by,cx,cy,cx,cy,bx,by,dx2,dy2)
    }
    return new Float32Array(output)
  }
  window.CaderactStrokeStyle=Object.freeze({DASH_PATTERNS,dashPattern,lineweightToCssPixels,dashSegments,strokeTriangles})
})()
