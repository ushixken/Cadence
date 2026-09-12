(() => {
  const $ = selector => document.querySelector(selector)
  const trigger=$("#settings-trigger"),panel=$("#settings-panel"),close=$("#settings-close"),grid=$("#settings-grid-visible"),reset=$("#settings-reset")
  if (![trigger,panel,close,grid,reset].every(Boolean)) return
  const preferences=window.caderactUserPreferences, viewport=window.caderactViewport
  let previousFocus=null
  function render(value=preferences.value){grid.checked=value.gridVisible}
  function open(){previousFocus=document.activeElement;panel.hidden=false;render();close.focus?.()}
  function dismiss(){panel.hidden=true;previousFocus?.focus?.()}
  trigger.addEventListener("click",open);close.addEventListener("click",dismiss)
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!panel.hidden){event.preventDefault();dismiss()}})
  grid.addEventListener("change",()=>preferences.set({gridVisible:grid.checked}))
  reset.addEventListener("click",()=>{const value=preferences.reset();viewport.setGridSnapEnabled(value.gridSnapEnabled);viewport.setOrthoEnabled(value.orthoEnabled);viewport.setPolarEnabled(value.polarEnabled);viewport.setPolarIncrementDegrees(value.polarIncrementDegrees);render(value)})
  preferences.subscribe(render)
})()
