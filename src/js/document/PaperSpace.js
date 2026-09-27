// PS2 physical Paper Space page authority. All dimensions are millimetres.
(() => {
  const SIZES=Object.freeze({A4:Object.freeze({width:210,height:297}),A3:Object.freeze({width:297,height:420}),Letter:Object.freeze({width:215.9,height:279.4}),Legal:Object.freeze({width:215.9,height:355.6})})
  const DEFAULT=Object.freeze({size:"A4",orientation:"landscape",width:297,height:210,units:"mm",margins:Object.freeze({top:10,right:10,bottom:10,left:10})})
  const copy=value=>({size:value.size,orientation:value.orientation,width:value.width,height:value.height,units:"mm",margins:{top:value.margins.top,right:value.margins.right,bottom:value.margins.bottom,left:value.margins.left}})
  function normalize(value,{legacy=false}={}){
    if(!value||legacy||value.size===undefined)return copy(DEFAULT)
    const size=String(value.size),orientation=String(value.orientation),preset=SIZES[size]
    if(![...Object.keys(SIZES),"Custom"].includes(size)||!["portrait","landscape"].includes(orientation))return null
    let width=Number(value.width),height=Number(value.height)
    if(preset){width=orientation==="portrait"?preset.width:preset.height;height=orientation==="portrait"?preset.height:preset.width}
    const margins=value.margins||{},result={size,orientation,width,height,units:"mm",margins:{top:Number(margins.top),right:Number(margins.right),bottom:Number(margins.bottom),left:Number(margins.left)}}
    return validate(result).length?null:result
  }
  function validate(value){const errors=[];if(!value||typeof value!=="object")return["Invalid paper setup"];if(![...Object.keys(SIZES),"Custom"].includes(value.size))errors.push("Invalid paper size");if(!["portrait","landscape"].includes(value.orientation))errors.push("Invalid paper orientation");if(!Number.isFinite(value.width)||value.width<=0||!Number.isFinite(value.height)||value.height<=0)errors.push("Invalid paper dimensions");if(value.units!=="mm")errors.push("Paper units must be mm");for(const key of ["top","right","bottom","left"])if(!Number.isFinite(value.margins?.[key])||value.margins[key]<0)errors.push(`Invalid ${key} margin`);if(Number.isFinite(value.width)&&Number.isFinite(value.height)&&value.margins&&(value.margins.left+value.margins.right>=value.width||value.margins.top+value.margins.bottom>=value.height))errors.push("Margins leave no printable area");return errors}
  function derive(layout){const paper=layout?.paper,errors=validate(paper);if(errors.length)return Object.freeze({valid:false,errors:Object.freeze(errors)});const sheet=Object.freeze({left:0,bottom:0,right:paper.width,top:paper.height,width:paper.width,height:paper.height}),printable=Object.freeze({left:paper.margins.left,bottom:paper.margins.bottom,right:paper.width-paper.margins.right,top:paper.height-paper.margins.top,width:paper.width-paper.margins.left-paper.margins.right,height:paper.height-paper.margins.top-paper.margins.bottom});return Object.freeze({valid:true,unit:"mm",sheet,printable})}
  window.CaderactPaperSpace=Object.freeze({SIZES,DEFAULT,normalize,validate,derive})
})()
