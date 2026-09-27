// TH1: live UI theme projection over the WS3 workspace-preference authority.
(() => {
  const preferences=window.caderactWorkspacePreferences,root=document.documentElement
  if(!preferences||!root)return
  const customTokens=Object.freeze({background:"--surface-viewport",grip:"--cad-grip",gripHover:"--cad-grip-hover",osnap:"--cad-osnap",tracking:"--cad-track",crosshair:"--cad-crosshair",dynamicSurface:"--surface-viewport-hud",dynamicText:"--cad-hud-text"})
  function luminance(hex){const values=[1,3,5].map(index=>Number.parseInt(hex.slice(index,index+2),16)/255).map(value=>value<=.03928?value/12.92:((value+.055)/1.055)**2.4);return .2126*values[0]+.7152*values[1]+.0722*values[2]}
  function contrast(a,b){const values=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (values[0]+.05)/(values[1]+.05)}
  function warning(colors){const low=[];if(contrast(colors.background,colors.geometry)<3)low.push("default geometry");if(contrast(colors.background,colors.crosshair)<3)low.push("crosshair");if(contrast(colors.dynamicSurface,colors.dynamicText)<3)low.push("Dynamic Input");return low.length?`Low contrast: ${low.join(", ")}.`:""}
  function apply(value=preferences.value){root.dataset.uiTheme=value.uiTheme;root.dataset.canvasTheme=value.canvasTheme;root.style.colorScheme=value.uiTheme;for(const [key,token] of Object.entries(customTokens))root.style.setProperty(token,value.canvasTheme==="custom"?value.customCanvasColors[key]:"");root.style.setProperty("--surface-viewport-field",value.canvasTheme==="custom"?value.customCanvasColors.dynamicSurface:"");root.style.setProperty("--cad-hud-muted",value.canvasTheme==="custom"?value.customCanvasColors.dynamicText:"")}
  preferences.subscribe(apply)
  window.caderactThemes=Object.freeze({apply,contrastWarning:warning,getState:()=>Object.freeze({uiTheme:preferences.value.uiTheme,canvasTheme:preferences.value.canvasTheme,customCanvasTemplate:preferences.value.customCanvasTemplate,customCanvasColors:preferences.value.customCanvasColors})})
})()
