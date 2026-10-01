// PLOT1: one current-document preparation boundary shared by Preview and PDF.
(() => {
  const session=window.caderactDocumentSession,context=window.caderactLayoutContext
  if(!session||!context||!window.CaderactPlotJob||!window.CaderactPlotScene)return
  function prepare(jobInput=window.CaderactPlotJob.defaults(),options={}){
    const current=context.snapshot()
    if(!options.layout&&current.kind!=="layout")return Object.freeze({status:"no-active-layout"})
    const layout=options.layout||session.reader.layout(current.layoutId)
    if(!layout)return Object.freeze({status:"invalid-layout"})
    const normalized=window.CaderactPlotJob.normalize(jobInput)
    if(normalized.status!=="ready")return normalized
    try{
      const dimensionStyles=Object.fromEntries(session.reader.dimensionStyles().map(style=>[style.id,style]))
      const scene=window.CaderactPlotScene.create({layout,job:normalized.job,records:session.reader.visibleRecords(),layers:session.reader.layers(),document:session.reader.snapshot(),documentUnit:session.reader.units().length,dimensionStyles})
      return Object.freeze({status:"ready",layout,job:normalized.job,scene})
    }catch(error){return Object.freeze({status:"plot-scene-unavailable",error})}
  }
  function prepareBatch(batchInput=window.CaderactPlotBatch.defaults(),jobInput=window.CaderactPlotJob.defaults()){
    const layouts=session.reader.layouts(),current=context.snapshot(),normalized=window.CaderactPlotBatch.normalize(batchInput,layouts,current.kind==="layout"?current.layoutId:null)
    if(normalized.status!=="ready")return normalized
    const pages=[];for(const layoutId of normalized.batch.layoutIds){const layout=session.reader.layout(layoutId),built=prepare(jobInput,{layout});if(built.status!=="ready")return Object.freeze({status:"plot-batch-page-unavailable",layoutId,cause:built});pages.push(Object.freeze({layout,job:built.job,scene:built.scene}))}
    return Object.freeze({status:"ready",batch:normalized.batch,pages:Object.freeze(pages)})
  }
  window.CaderactPlotOutput=Object.freeze({prepare,prepareBatch})
})()
