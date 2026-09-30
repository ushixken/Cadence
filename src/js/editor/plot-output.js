// PLOT1: one current-document preparation boundary shared by Preview and PDF.
(() => {
  const session=window.caderactDocumentSession,context=window.caderactLayoutContext
  if(!session||!context||!window.CaderactPlotJob||!window.CaderactPlotScene)return
  function prepare(jobInput=window.CaderactPlotJob.defaults(),options={}){
    const current=context.snapshot()
    if(current.kind!=="layout")return Object.freeze({status:"no-active-layout"})
    const layout=options.layout||session.reader.layout(current.layoutId)
    if(!layout)return Object.freeze({status:"invalid-layout"})
    const normalized=window.CaderactPlotJob.normalize(jobInput)
    if(normalized.status!=="ready")return normalized
    try{
      const dimensionStyles=Object.fromEntries(session.reader.dimensionStyles().map(style=>[style.id,style]))
      const scene=window.CaderactPlotScene.create({layout,job:normalized.job,records:session.reader.visibleRecords(),layers:session.reader.layers(),documentUnit:session.reader.units().length,dimensionStyles})
      return Object.freeze({status:"ready",layout,job:normalized.job,scene})
    }catch(error){return Object.freeze({status:"plot-scene-unavailable",error})}
  }
  window.CaderactPlotOutput=Object.freeze({prepare})
})()
