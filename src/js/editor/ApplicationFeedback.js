// UX12: transient application feedback, separate from command and document state.
(() => {
  const severities=new Set(["status","success","warning","error"])
  function createController({render,schedule=setTimeout,cancel=clearTimeout,limit=3,durations={status:4000,success:4000,warning:6500,error:6500}}={}){
    let nextId=1,entries=[]
    const snapshot=()=>Object.freeze(entries.map(({timer,anchor,placementTarget,...entry})=>Object.freeze({...entry,local:Boolean(anchor)})))
    const presentation=()=>Object.freeze(entries.map(({timer,...entry})=>Object.freeze({...entry})))
    const publish=()=>render?.(presentation())
    function dismiss(id){const entry=entries.find(value=>value.id===id);if(!entry)return false;if(entry.timer!==null)cancel(entry.timer);entries=entries.filter(value=>value.id!==id);publish();return true}
    function arm(entry,duration){const delay=Number.isFinite(duration)?Math.max(0,duration):durations[entry.severity];if(delay>0)entry.timer=schedule(()=>dismiss(entry.id),delay)}
    function notify(message,{severity="status",duration,action=null,anchor=null,placementTarget=null,source="application"}={}){
      if(typeof message!=="string"||!message.trim())return null
      severity=severities.has(severity)?severity:"status"
      message=message.trim();source=typeof source==="string"&&source.trim()?source.trim():"application"
      const identity=`${severity}\u0000${message}\u0000${source}`,normalizedAction=action&&typeof action.label==="string"&&typeof action.run==="function"?Object.freeze({label:action.label,run:action.run}):null
      const existing=entries.find(value=>value.identity===identity)
      if(existing){if(existing.timer!==null)cancel(existing.timer);existing.action=normalizedAction;existing.anchor=anchor;existing.placementTarget=placementTarget||anchor;existing.timer=null;publish();arm(existing,duration);return existing.id}
      const entry={id:nextId++,identity,message,severity,source,action:normalizedAction,anchor,placementTarget:placementTarget||anchor,timer:null}
      while(entries.length>=Math.max(1,limit))dismiss(entries[0].id)
      entries=[...entries,entry];publish()
      arm(entry,duration)
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
    const localRoot=document.createElement("aside");localRoot.id="application-feedback-local";localRoot.classList.add("application-feedback-local");localRoot.setAttribute("aria-label","Local application notifications");localRoot.setAttribute("aria-live","polite");localRoot.setAttribute("aria-relevant","additions text");(document.body||document).appendChild(localRoot)
    const notice=entry=>{const item=document.createElement("section"),label=document.createElement("strong"),message=document.createElement("span"),dismiss=document.createElement("button");item.classList.add("application-notice");item.classList.add(`is-${entry.severity}`);item.dataset.feedbackId=String(entry.id);item.dataset.feedbackSource=entry.source;item.setAttribute("role",entry.severity==="error"?"alert":"status");item.setAttribute("aria-atomic","true");label.classList.add("application-notice-kind");label.textContent=entry.severity==="status"?"Status":entry.severity[0].toUpperCase()+entry.severity.slice(1);message.classList.add("application-notice-message");message.textContent=entry.message;dismiss.type="button";dismiss.classList.add("application-notice-dismiss");dismiss.setAttribute("aria-label","Dismiss notification");dismiss.textContent="×";dismiss.addEventListener("click",()=>controller.dismiss(entry.id));item.appendChild(label);item.appendChild(message);if(entry.action){const action=document.createElement("button");action.type="button";action.classList.add("application-notice-action");action.textContent=entry.action.label;action.addEventListener("click",()=>{entry.action.run();controller.dismiss(entry.id)});item.appendChild(action)}item.appendChild(dismiss);return item}
    const controller=createController({render(entries){const global=[],local=[];let localIndex=0;for(const entry of entries){const item=notice(entry);if(!entry.anchor?.getBoundingClientRect){global.push(item);continue}const anchor=entry.anchor.getBoundingClientRect(),target=(entry.placementTarget?.getBoundingClientRect?.()||anchor),viewportWidth=window.innerWidth||document.documentElement?.clientWidth||1024,viewportHeight=window.innerHeight||document.documentElement?.clientHeight||768,width=Math.min(340,viewportWidth-16),left=Math.max(8,Math.min(viewportWidth-width-8,anchor.left+anchor.width/2-width/2)),bottom=Math.max(8,Math.min(viewportHeight-50,viewportHeight-target.top+8+localIndex*50));item.classList.add("is-local");item.style.width=`${width}px`;item.style.left=`${left}px`;item.style.bottom=`${bottom}px`;local.push(item);localIndex++}root.replaceChildren(...global);localRoot.replaceChildren(...local)}})
    return controller
  }
  window.CaderactApplicationFeedback=Object.freeze({createController,bind})
  window.caderactApplicationFeedback=bind(document.querySelector("#application-feedback"))
})()
