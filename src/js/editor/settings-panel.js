(() => {
  const $ = selector => document.querySelector(selector)
  const trigger=$("#settings-trigger"),panel=$("#settings-panel"),close=$("#settings-close"),grid=$("#settings-grid-visible"),color=$("#settings-grid-color"),opacity=$("#settings-grid-opacity"),opacityValue=$("#settings-grid-opacity-value"),majorColor=$("#settings-major-grid-color"),majorOpacity=$("#settings-major-grid-opacity"),majorOpacityValue=$("#settings-major-grid-opacity-value"),interval=$("#settings-major-grid-interval"),xColor=$("#settings-x-axis-color"),xOpacity=$("#settings-x-axis-opacity"),xOpacityValue=$("#settings-x-axis-opacity-value"),yColor=$("#settings-y-axis-color"),yOpacity=$("#settings-y-axis-opacity"),yOpacityValue=$("#settings-y-axis-opacity-value"),reset=$("#settings-reset")
  if (![trigger,panel,close,grid,color,opacity,opacityValue,majorColor,majorOpacity,majorOpacityValue,interval,xColor,xOpacity,xOpacityValue,yColor,yOpacity,yOpacityValue,reset].every(Boolean)) return
  const preferences=window.caderactUserPreferences, viewport=window.caderactViewport
  let previousFocus=null
  function render(value=preferences.value){grid.checked=value.gridVisible;color.value=value.gridColor;opacity.value=Math.round(value.gridOpacity*100);opacityValue.value=`${opacity.value}%`;majorColor.value=value.majorGridColor;majorOpacity.value=Math.round(value.majorGridOpacity*100);majorOpacityValue.value=`${majorOpacity.value}%`;interval.value=String(value.majorGridInterval);xColor.value=value.xAxisColor;xOpacity.value=Math.round(value.xAxisOpacity*100);xOpacityValue.value=`${xOpacity.value}%`;yColor.value=value.yAxisColor;yOpacity.value=Math.round(value.yAxisOpacity*100);yOpacityValue.value=`${yOpacity.value}%`}
  function open(){previousFocus=document.activeElement;panel.hidden=false;render();close.focus?.()}
  function dismiss(){panel.hidden=true;previousFocus?.focus?.()}
  trigger.addEventListener("click",open);close.addEventListener("click",dismiss)
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&!panel.hidden){event.preventDefault();dismiss()}})
  grid.addEventListener("change",()=>preferences.set({gridVisible:grid.checked}))
  color.addEventListener("change",()=>preferences.set({gridColor:color.value}))
  opacity.addEventListener("input",()=>preferences.set({gridOpacity:Number(opacity.value)/100}))
  majorColor.addEventListener("change",()=>preferences.set({majorGridColor:majorColor.value}))
  majorOpacity.addEventListener("input",()=>preferences.set({majorGridOpacity:Number(majorOpacity.value)/100}))
  interval.addEventListener("change",()=>preferences.set({majorGridInterval:Number(interval.value)}))
  xColor.addEventListener("change",()=>preferences.set({xAxisColor:xColor.value}));xOpacity.addEventListener("input",()=>preferences.set({xAxisOpacity:Number(xOpacity.value)/100}));yColor.addEventListener("change",()=>preferences.set({yAxisColor:yColor.value}));yOpacity.addEventListener("input",()=>preferences.set({yAxisOpacity:Number(yOpacity.value)/100}))
  reset.addEventListener("click",()=>{const value=preferences.reset();viewport.setGridSnapEnabled(value.gridSnapEnabled);viewport.setOrthoEnabled(value.orthoEnabled);viewport.setPolarEnabled(value.polarEnabled);viewport.setPolarIncrementDegrees(value.polarIncrementDegrees);render(value)})
  preferences.subscribe(render)
})()
