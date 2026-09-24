// UX9C: workspace-owned right dock sizing, independent of drawing state.
(() => {
  const MIN=230,DEFAULT=288,MAX_FRACTION=.45
  function create({dock,handle,workspace,preferences,onResize=()=>{}}={}){
    if(!dock||!handle||!workspace)throw new Error("Right dock elements are required")
    let drag=null,width=DEFAULT,resizeFrame=0,visible=true
    const available=()=>Math.max(MIN,workspace.getBoundingClientRect?.().width||window.innerWidth||1024)
    const maximum=()=>Math.max(MIN,Math.floor(available()*MAX_FRACTION))
    const clamp=value=>Math.max(MIN,Math.min(maximum(),Math.round(Number(value)||DEFAULT)))
    function scheduleResize(){if(resizeFrame)return;const schedule=window.requestAnimationFrame||typeof requestAnimationFrame==="function"&&requestAnimationFrame;if(schedule)resizeFrame=schedule(()=>{resizeFrame=0;onResize(visible?width:0)});else onResize(visible?width:0)}
    function apply(value,{persist=false,immediate=false}={}){width=clamp(value);dock.style.width=`${width}px`;dock.style.flexBasis=`${width}px`;if(visible)workspace.style.setProperty?.("--right-dock-width",`${width}px`);handle.setAttribute("aria-valuenow",String(width));handle.setAttribute("aria-valuemax",String(maximum()));if(persist)preferences?.set?.({rightDockWidth:width});if(immediate)onResize(width);else scheduleResize();return width}
    function setVisible(next,{immediate=false}={}){const show=Boolean(next);if(show===visible)return visible;visible=show;dock.hidden=!visible;workspace.classList?.toggle("is-right-dock-collapsed",!visible);workspace.style.setProperty?.("--right-dock-width",visible?`${width}px`:"0px");if(immediate)onResize(visible?width:0);else scheduleResize();return visible}
    function down(event){if(event.button!==undefined&&event.button!==0)return;drag={pointerId:event.pointerId,startX:event.clientX,startWidth:width};handle.setPointerCapture?.(event.pointerId);handle.classList.add("is-dragging");document.documentElement?.classList.add("is-resizing-dock");event.preventDefault?.()}
    function move(event){if(!drag||event.pointerId!==drag.pointerId)return;apply(drag.startWidth+drag.startX-event.clientX);event.preventDefault?.()}
    function finish(event,{cancel=false}={}){if(!drag||event.pointerId!==undefined&&event.pointerId!==drag.pointerId)return;const original=drag.startWidth;handle.releasePointerCapture?.(drag.pointerId);drag=null;handle.classList.remove("is-dragging");document.documentElement?.classList.remove("is-resizing-dock");apply(cancel?original:width,{persist:!cancel})}
    function keydown(event){let next=null;if(event.key==="ArrowLeft")next=width+(event.shiftKey?32:8);else if(event.key==="ArrowRight")next=width-(event.shiftKey?32:8);else if(event.key==="Home")next=MIN;else if(event.key==="End")next=maximum();if(next===null)return;event.preventDefault();apply(next,{persist:true})}
    handle.addEventListener("pointerdown",down);handle.addEventListener("pointermove",move);handle.addEventListener("pointerup",event=>finish(event));handle.addEventListener("pointercancel",event=>finish(event,{cancel:true}));handle.addEventListener("lostpointercapture",event=>finish(event));handle.addEventListener("keydown",keydown);handle.addEventListener("dblclick",()=>apply(DEFAULT,{persist:true}));window.addEventListener("resize",()=>apply(width))
    const initial=preferences?.value?.rightDockWidth??DEFAULT;apply(initial,{immediate:true})
    return Object.freeze({get width(){return width},get visible(){return visible},minimum:MIN,maximum,apply,setVisible,clamp,get dragging(){return Boolean(drag)}})
  }
  window.CaderactRightDock=Object.freeze({MIN,DEFAULT,MAX_FRACTION,create})
  const dock=document.querySelector(".layers-panel"),handle=document.querySelector("#right-dock-resize"),workspace=document.querySelector(".editor-workspace")
  // Production canvas sizing is owned solely by Viewport's ResizeObserver.
  if(dock&&handle&&workspace&&window.caderactUserPreferences)window.caderactRightDock=create({dock,handle,workspace,preferences:window.caderactUserPreferences})
})()
