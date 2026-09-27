// TH1: live UI theme projection over the WS3 workspace-preference authority.
(() => {
  const preferences=window.caderactWorkspacePreferences,root=document.documentElement
  if(!preferences||!root)return
  function apply(value=preferences.value){root.dataset.uiTheme=value.uiTheme;root.dataset.canvasTheme=value.canvasTheme;root.style.colorScheme=value.uiTheme}
  preferences.subscribe(apply)
  window.caderactThemes=Object.freeze({apply,getState:()=>Object.freeze({uiTheme:preferences.value.uiTheme,canvasTheme:preferences.value.canvasTheme})})
})()
