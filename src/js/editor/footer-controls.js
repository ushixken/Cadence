// DUX1: compact drafting status controls over existing viewport/preferences authorities.
(() => {
  const viewport=window.caderactViewport,preferences=window.caderactUserPreferences
  const snapToggle=document.querySelector(".snap-trigger"),snapEnabled=document.querySelector("#snap-enabled")
  const snapDependentOptions=document.querySelectorAll(".snap-dependent input"),snapModeOptions=document.querySelectorAll("[data-snap-mode]"),snapDependentSection=document.querySelector(".snap-dependent")
  const gridVisibleToggle=document.querySelector("#grid-visible-toggle"),gridSnapToggle=document.querySelector("#grid-snap-toggle"),orthoToggle=document.querySelector("#ortho-toggle"),polarToggle=document.querySelector("#polar-toggle"),trackToggle=document.querySelector("#track-toggle"),dynamicInputToggle=document.querySelector("#dynamic-input-toggle")
  const gridVisibleOption=document.querySelector("#grid-visible-option"),gridSnapOption=document.querySelector("#grid-snap-option"),polarEnabledOption=document.querySelector("#polar-enabled-option"),polarIncrementOption=document.querySelector("#polar-increment-option"),trackEnabledOption=document.querySelector("#track-enabled-option"),extensionTrackingCheckbox=document.querySelector("#extension-tracking-enabled"),dynamicInputEnabledOption=document.querySelector("#dynamic-input-enabled-option")
  const flyoutTriggers=Array.from(document.querySelectorAll(".drafting-flyout-trigger")),draftingMenus=Array.from(document.querySelectorAll(".drafting-menu, #snap-menu"))
  const unitsTrigger=document.querySelector(".units-control"),unitsMenu=document.querySelector(".units-menu"),unitValue=document.querySelector("[data-unit-value]"),unitOptions=document.querySelectorAll(".unit-option")
  if(!viewport||!preferences||!gridSnapToggle||!snapToggle)return

  const setActive=(button,enabled)=>{button?.classList.toggle("is-active",Boolean(enabled));button?.setAttribute("aria-pressed",String(Boolean(enabled)))}
  function updateSnapOptions(){const enabled=Boolean(snapEnabled.checked);snapDependentOptions.forEach(option=>{option.disabled=!enabled});snapDependentSection.classList.toggle("is-disabled",!enabled)}
  function menuFor(trigger){return document.querySelector(`#${trigger.getAttribute("aria-controls")}`)}
  function positionMenu(trigger,menu){if(!trigger?.getBoundingClientRect||!menu?.getBoundingClientRect)return;const anchor=trigger.getBoundingClientRect(),box=menu.getBoundingClientRect(),width=box.width||220,height=box.height||180,viewWidth=window.innerWidth||document.documentElement?.clientWidth||1024,viewHeight=window.innerHeight||document.documentElement?.clientHeight||768,margin=8;const above=anchor.top-height-6,top=above>=margin?above:Math.min(viewHeight-height-margin,anchor.bottom+6),left=Math.max(margin,Math.min(viewWidth-width-margin,anchor.right-width));menu.style.left=`${Math.round(left)}px`;menu.style.top=`${Math.round(Math.max(margin,top))}px`}
  function closeDropdownMenus({focus=false}={}){for(const trigger of flyoutTriggers){const menu=menuFor(trigger),open=menu&&!menu.hidden;if(menu)menu.hidden=true;trigger.setAttribute("aria-expanded","false");if(focus&&open)trigger.focus()}if(unitsMenu){unitsMenu.hidden=true;unitsTrigger.setAttribute("aria-expanded","false")}}
  function toggleFlyout(trigger){const menu=menuFor(trigger);if(!menu)return;const opening=menu.hidden;closeDropdownMenus();menu.hidden=!opening;trigger.setAttribute("aria-expanded",String(opening));if(opening){positionMenu(trigger,menu);menu.querySelector?.("input, select, button")?.focus()}}
  for(const trigger of flyoutTriggers)trigger.addEventListener("click",()=>toggleFlyout(trigger))
  for(const menu of draftingMenus)menu.addEventListener("keydown",event=>{if(event.key==="Escape"){event.preventDefault();closeDropdownMenus({focus:true})}})

  gridVisibleToggle.addEventListener("click",()=>preferences.set({gridVisible:!preferences.value.gridVisible}))
  gridVisibleOption.addEventListener("change",()=>preferences.set({gridVisible:gridVisibleOption.checked}))
  gridSnapToggle.addEventListener("mousedown",event=>event.preventDefault())
  gridSnapToggle.addEventListener("click",()=>viewport.setGridSnapEnabled(!viewport.snapModes.grid))
  gridSnapOption.addEventListener("change",()=>viewport.setGridSnapEnabled(gridSnapOption.checked))
  orthoToggle?.addEventListener("mousedown",event=>event.preventDefault())
  orthoToggle?.addEventListener("click",()=>viewport.setOrthoEnabled(!viewport.orthoEnabled))
  polarToggle?.addEventListener("mousedown",event=>event.preventDefault())
  polarToggle?.addEventListener("click",()=>viewport.setPolarEnabled(!viewport.polarEnabled))
  polarEnabledOption.addEventListener("change",()=>viewport.setPolarEnabled(polarEnabledOption.checked))
  polarIncrementOption.addEventListener("change",()=>viewport.setPolarIncrementDegrees(Number(polarIncrementOption.value)))
  snapToggle.addEventListener("click",()=>viewport.setObjectSnapMode("object",!viewport.snapModes.object))
  snapEnabled.addEventListener("change",()=>viewport.setObjectSnapMode("object",snapEnabled.checked))
  snapModeOptions.forEach(option=>{if(option!==snapEnabled)option.addEventListener("change",()=>viewport.setObjectSnapMode(option.dataset.snapMode,option.checked))})
  trackToggle?.addEventListener("mousedown",event=>event.preventDefault())
  trackToggle?.addEventListener("click",()=>viewport.setObjectSnapTrackingEnabled(!viewport.objectSnapTrackingEnabled))
  trackEnabledOption.addEventListener("change",()=>viewport.setObjectSnapTrackingEnabled(trackEnabledOption.checked))
  extensionTrackingCheckbox.addEventListener("change",()=>viewport.setExtensionTrackingEnabled(extensionTrackingCheckbox.checked))
  dynamicInputToggle.addEventListener("click",()=>viewport.setDynamicInputEnabled(!viewport.dynamicInputEnabled))
  dynamicInputEnabledOption.addEventListener("change",()=>viewport.setDynamicInputEnabled(dynamicInputEnabledOption.checked))

  viewport.subscribeSnapModes(modes=>{setActive(gridSnapToggle,modes.grid);gridSnapOption.checked=Boolean(modes.grid);snapModeOptions.forEach(option=>{option.checked=Boolean(modes[option.dataset.snapMode]);option.disabled=option.dataset.snapMode!=="object"&&!modes.object});setActive(snapToggle,modes.object);updateSnapOptions()})
  viewport.subscribeEffectiveOrtho?.(enabled=>setActive(orthoToggle,enabled))
  viewport.subscribeEffectivePolar?.(enabled=>setActive(polarToggle,enabled))
  viewport.subscribeObjectSnapTracking?.(enabled=>setActive(trackToggle,enabled))
  viewport.subscribeExtensionTracking(enabled=>{extensionTrackingCheckbox.checked=enabled})
  preferences.subscribe(value=>{setActive(gridVisibleToggle,value.gridVisible);gridVisibleOption.checked=value.gridVisible;polarEnabledOption.checked=value.polarEnabled;polarIncrementOption.value=String(value.polarIncrementDegrees);trackEnabledOption.checked=value.objectSnapTrackingEnabled;dynamicInputEnabledOption.checked=value.dynamicInputEnabled;setActive(dynamicInputToggle,value.dynamicInputEnabled)})

  unitsTrigger.addEventListener("click",()=>{const opening=unitsMenu.hidden;closeDropdownMenus();unitsMenu.hidden=!opening;unitsTrigger.setAttribute("aria-expanded",String(opening))})
  unitOptions.forEach(option=>option.addEventListener("click",()=>{const outcome=window.caderactDocumentSession.unitGateway.setLengthUnit(option.dataset.unit);if(outcome.status==="committed"||outcome.status==="no-op")viewport.refreshDocumentView();closeDropdownMenus()}))
  let unsubscribeUnitHistory=null
  function refreshUnitControl(){const activeUnit=window.caderactDocumentSession.reader.units().length;unitValue.textContent=activeUnit;unitOptions.forEach(option=>{const selected=option.dataset.unit===activeUnit;option.classList.toggle("is-selected",selected);option.setAttribute("aria-checked",String(selected))});viewport.refreshDocumentView()}
  function bindUnitDocument(){unsubscribeUnitHistory?.();unsubscribeUnitHistory=window.caderactDocumentSession.controller.subscribeHistory(refreshUnitControl)}
  bindUnitDocument();window.caderactDocumentSession.subscribe(bindUnitDocument)
  document.addEventListener("pointerdown",event=>{if(!event.target.closest(".footer-dropdown"))closeDropdownMenus()})
  document.addEventListener("keydown",event=>{if(event.key==="Escape")closeDropdownMenus({focus:true})})
  window.addEventListener("resize",()=>{const trigger=flyoutTriggers.find(item=>item.getAttribute("aria-expanded")==="true");if(trigger)positionMenu(trigger,menuFor(trigger))})
})()
