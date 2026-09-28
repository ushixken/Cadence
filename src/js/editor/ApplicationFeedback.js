// UX12: transient application feedback, separate from command and document state.
(() => {
  const severities=new Set(["status","success","warning","error"])
  function createController({render,schedule=setTimeout,cancel=clearTimeout,limit=3,durations={status:4000,success:4000,warning:6500,error:6500}}={}){
    let nextId=1,entries=[]
    const snapshot=()=>Object.freeze(entries.map(({timer,...entry})=>Object.freeze({...entry})))
    const publish=()=>render?.(snapshot())
    function dismiss(id){const entry=entries.find(value=>value.id===id);if(!entry)return false;if(entry.timer!==null)cancel(entry.timer);entries=entries.filter(value=>value.id!==id);publish();return true}
    function notify(message,{severity="status",duration,action=null}={}){
      if(typeof message!=="string"||!message.trim())return null
      severity=severities.has(severity)?severity:"status"
      const entry={id:nextId++,message:message.trim(),severity,action:action&&typeof action.label==="string"&&typeof action.run==="function"?Object.freeze({label:action.label,run:action.run}):null,timer:null}
      while(entries.length>=Math.max(1,limit))dismiss(entries[0].id)
      entries=[...entries,entry];publish()
      const delay=Number.isFinite(duration)?Math.max(0,duration):durations[severity]
      if(delay>0)entry.timer=schedule(()=>dismiss(entry.id),delay)
      return entry.id
    }
    function presentResult(outcome){
      const status=outcome?.status||""
      if(!status.startsWith("dxf-"))return outcome
      const diagnostics=Array.isArray(outcome.diagnostics)?outcome.diagnostics:[],warnings=diagnostics.filter(value=>value.severity==="warning").reduce((sum,value)=>sum+(value.count||1),0)
      if(status.endsWith("-failed"))notify(outcome.message||status.replaceAll("-"," "),{severity:"error"})
      else if(warnings)notify(`DXF completed with ${warnings} warning${warnings===1?"":"s"}.`,{severity:"warning"})
      else if(status.endsWith("-completed"))notify(status.startsWith("dxf-open")?"DXF import completed.":"DXF export completed.",{severity:"success"})
      else if(status.endsWith("-initiated"))notify("DXF download initiated.",{severity:"status"})
      return outcome
    }
    function clear(){for(const entry of entries)if(entry.timer!==null)cancel(entry.timer);entries=[];publish()}
    publish()
    return Object.freeze({notify,dismiss,presentResult,clear,get entries(){return snapshot()}})
  }
  function bind(root){
    if(!root)return null
    const controller=createController({render(entries){root.replaceChildren(...entries.map(entry=>{const item=document.createElement("section"),label=document.createElement("strong"),message=document.createElement("span"),dismiss=document.createElement("button");item.classList.add("application-notice");item.classList.add(`is-${entry.severity}`);item.dataset.feedbackId=String(entry.id);item.setAttribute("role",entry.severity==="error"?"alert":"status");item.setAttribute("aria-atomic","true");label.classList.add("application-notice-kind");label.textContent=entry.severity==="status"?"Status":entry.severity[0].toUpperCase()+entry.severity.slice(1);message.classList.add("application-notice-message");message.textContent=entry.message;dismiss.type="button";dismiss.classList.add("application-notice-dismiss");dismiss.setAttribute("aria-label","Dismiss notification");dismiss.textContent="×";dismiss.addEventListener("click",()=>controller.dismiss(entry.id));item.appendChild(label);item.appendChild(message);if(entry.action){const action=document.createElement("button");action.type="button";action.classList.add("application-notice-action");action.textContent=entry.action.label;action.addEventListener("click",()=>{entry.action.run();controller.dismiss(entry.id)});item.appendChild(action)}item.appendChild(dismiss);return item}))}})
    return controller
  }
  window.CaderactApplicationFeedback=Object.freeze({createController,bind})
  window.caderactApplicationFeedback=bind(document.querySelector("#application-feedback"))
})()
