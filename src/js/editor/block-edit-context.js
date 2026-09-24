// GBUX3: contextual controls for the existing BlockEdit command session.
(() => {
  const bar=document.querySelector("#block-edit-context"),name=document.querySelector("#block-edit-name"),save=document.querySelector("#block-edit-save"),discard=document.querySelector("#block-edit-discard"),router=window.caderactCommandRouter
  if(!bar||!name||!save||!discard||!router)return
  function session(){const value=router.activeSession;return value?.name==="BlockEdit"&&value.phase==="edit"?value:null}
  function render(){const active=session();bar.hidden=!active;document.documentElement?.classList.toggle("is-block-editing",Boolean(active));if(active)name.textContent=active.definition?.name||active.workspace?.original?.name||"Block Definition"}
  save.addEventListener("click",()=>{if(session())router.activateOption("apply")})
  discard.addEventListener("click",()=>{if(session())router.cancelActive()})
  router.subscribe(render);window.caderactDocumentSession?.subscribe(render);render()
  window.caderactBlockEditContext=Object.freeze({refresh:render,getState:()=>Object.freeze({visible:!bar.hidden,definitionName:name.textContent})})
})()
