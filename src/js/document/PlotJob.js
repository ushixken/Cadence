// PLOT1: validated ephemeral output choices. Plot jobs are never document state.
(() => {
  const DEFAULT=Object.freeze({
    destination:"pdf",
    outputType:"vector",
    colorMode:"plot-color",
    area:"layout",
    scale:Object.freeze({mode:"one-to-one",paper:1,model:1}),
    position:"center",
    offset:Object.freeze({x:0,y:0}),
  })
  const COLOR_MODES=Object.freeze(["plot-color","display-color","grayscale","monochrome"])
  const clone=value=>({destination:value.destination,outputType:value.outputType,colorMode:value.colorMode,area:value.area,scale:{mode:value.scale.mode,paper:value.scale.paper,model:value.scale.model},position:value.position,offset:{x:value.offset.x,y:value.offset.y}})
  function normalize(value={}){
    const source={...clone(DEFAULT),...value,scale:{...DEFAULT.scale,...value.scale},offset:{...DEFAULT.offset,...value.offset}}
    const result={destination:String(source.destination),outputType:String(source.outputType),colorMode:String(source.colorMode),area:String(source.area),scale:{mode:String(source.scale.mode),paper:Number(source.scale.paper),model:Number(source.scale.model)},position:String(source.position),offset:{x:Number(source.offset.x),y:Number(source.offset.y)}}
    const errors=validate(result)
    return errors.length?Object.freeze({status:"invalid-plot-job",errors:Object.freeze(errors)}):Object.freeze({status:"ready",job:freeze(result)})
  }
  function validate(value){
    const errors=[]
    if(value?.destination!=="pdf")errors.push("Unsupported destination")
    if(value?.outputType!=="vector")errors.push("Raster output is not available")
    if(!COLOR_MODES.includes(value?.colorMode))errors.push("Invalid output color")
    if(value?.area!=="layout")errors.push("Plot area is not available")
    if(value?.scale?.mode!=="one-to-one"||value.scale.paper!==1||value.scale.model!==1)errors.push("Layout output must remain 1:1")
    if(!["center","offset"].includes(value?.position)||![value?.offset?.x,value?.offset?.y].every(Number.isFinite))errors.push("Invalid output position")
    return errors
  }
  function freeze(value){return Object.freeze({...value,scale:Object.freeze({...value.scale}),offset:Object.freeze({...value.offset})})}
  const defaults=()=>freeze(clone(DEFAULT))
  const sceneColorMode=job=>job.colorMode==="grayscale"?"grayscale":job.colorMode==="monochrome"?"monochrome":"color"
  window.CaderactPlotJob=Object.freeze({DEFAULT,COLOR_MODES,defaults,normalize,validate,sceneColorMode})
})()
