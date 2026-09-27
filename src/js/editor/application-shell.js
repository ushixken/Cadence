// ASTRA-1G shell adapter: presentation state only; CAD commands remain owned by CommandRouter.
(() => {
  const root = document.querySelector(".editor-page"), registry = window.caderactCommandRegistry, router = window.caderactCommandRouter
  if (!(root instanceof HTMLElement) || !registry || !router) return
  const categoryTools = document.querySelector("#category-tools"), categoryName = document.querySelector("#active-category-name")
  const utility = document.querySelector(".utility-menu"), utilityTrigger = document.querySelector("#utility-menu-trigger"), utilityMenu = document.querySelector("#utility-menu-actions")
  const edit = document.querySelector(".edit-menu"), editTrigger = document.querySelector(".edit-menu-trigger"), editMenu = document.querySelector("#edit-menu-actions")
  const collection=(commands=[],actions=[])=>Object.freeze({commands:Object.freeze(commands),actions:Object.freeze(actions)})
  const categories = Object.freeze({
    Draw: collection(["Line","Polyline","Rectangle","Polygon","Circle","Arc","Ellipse","Hatch","Region"]),
    Modify: collection(["Move","Copy","Rotate","Scale","Mirror","Trim","Extend","Offset","Fillet","Chamfer","Join","Break","Split","Stretch","Lengthen","Align","RectangularArray","PolarArray","PathArray","Explode","Delete"]),
    Annotate: collection(["Text","Linear","Aligned","Angular","DimRadius","DimDiameter","DimBaseline","DimContinue","Ordinate","ArcLength","CenterMark","CenterLine","Leader","MLeader"]),
    Layers: collection([],[Object.freeze({id:"layers",label:"Open Layers",icon:"Layers",run:()=>window.caderactPropertiesPanel?.showLayers?.()})]),
    Blocks: collection(["Block","Insert","BlockEdit","Explode"]),
    Measure: collection(["Distance","Length","Radius","Diameter","Area","Perimeter","Angle","DistanceObject","MinDist","DistanceSum"]),
    Drafting: collection([],[Object.freeze({id:"drafting-settings",label:"Drafting Settings",icon:"Drafting",run:button=>window.caderactDraftingSettings?.open?.("grid",button)})]),
    Custom: collection(),
  })
  const icons = Object.freeze({
    Delete:"delete",Copy:"copy",Line:"line",Polyline:"polyline",Rectangle:"rectangle",Circle:"circle",Arc:"arc",Ellipse:"ellipse",Polygon:"polygon",Text:"text",Hatch:"hatch",Region:"region",
    Move:"move",Rotate:"rotate",Scale:"scale",Mirror:"mirror",Offset:"offset",Trim:"trim",Extend:"extend",Fillet:"fillet",Chamfer:"chamfer",Join:"polyline",Break:"trim",Split:"trim",Stretch:"scale",Lengthen:"extend",Align:"move",RectangularArray:"copy",PolarArray:"copy",PathArray:"copy",Explode:"explode",Linear:"dimension",Aligned:"dimension",Angular:"dimension",DimRadius:"dimension",DimDiameter:"dimension",DimBaseline:"dimension",DimContinue:"dimension",Ordinate:"dimension",ArcLength:"dimension",CenterMark:"dimension",CenterLine:"dimension",Leader:"dimension",MLeader:"dimension",
    Block:"block",Insert:"insert",BlockEdit:"block",Distance:"measure",Length:"measure",Radius:"measure",Diameter:"measure",Area:"measure",Perimeter:"measure",Angle:"measure",DistanceObject:"measure",MinDist:"measure",DistanceSum:"measure",Layers:"layers",Drafting:"drafting",
  })
  function launch(name) { if (!registry.resolve(name)) return false; router.execute(name); return true }
  function icon(name) {
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg"),use=document.createElementNS("http://www.w3.org/2000/svg","use")
    svg.setAttribute("aria-hidden","true");use.setAttribute("href",`#cad-${icons[name]||"line"}`);svg.appendChild(use);return svg
  }
  function showCategory(name) {
    const category=categories[name]||collection()
    if (!(categoryTools instanceof HTMLElement) || !(categoryName instanceof HTMLElement)) return
    categoryName.textContent=name
    const commandButtons=category.commands.filter(command=>registry.resolve(command)).map(command=>{
      const button=document.createElement("button"),label=document.createElement("span")
      const definition=registry.resolve(command),shortcut=definition?.aliases?.[0]
      button.type="button";button.dataset.shellCommand=command;button.title=shortcut?`${command} · ${shortcut}`:command;button.setAttribute("aria-label",shortcut?`${command}, shortcut ${shortcut}`:command);label.textContent=command;button.append(icon(command),label);button.addEventListener("click",()=>launch(command));return button
    }),actionButtons=category.actions.map(action=>{const button=document.createElement("button"),label=document.createElement("span");button.type="button";button.dataset.collectionAction=action.id;button.title=action.label;button.setAttribute("aria-label",action.label);label.textContent=action.label;button.append(icon(action.icon),label);button.addEventListener("click",()=>action.run(button));return button})
    categoryTools.replaceChildren(...commandButtons,...actionButtons)
    if (!categoryTools.childElementCount) { const empty=document.createElement("span");empty.className="category-empty";empty.textContent=`${name} commands remain available through menus and command input.`;categoryTools.appendChild(empty) }
    root.querySelectorAll(".cad-tool-tabs [data-shell-category]").forEach(button=>{const active=button.getAttribute("data-shell-category")===name;button.classList.toggle("is-active",active);button.setAttribute("aria-selected",String(active));button.tabIndex=active?0:-1})
    syncCommandLaunchers()
  }
  const categoryTabs=Array.from(root.querySelectorAll(".cad-tool-tabs [data-shell-category]"))
  for(const button of categoryTabs){button.addEventListener("click",()=>showCategory(button.getAttribute("data-shell-category")||"Draw"));button.addEventListener("keydown",event=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;event.preventDefault();const current=Math.max(0,categoryTabs.indexOf(button)),next=event.key==="Home"?0:event.key==="End"?categoryTabs.length-1:(current+(event.key==="ArrowRight"?1:-1)+categoryTabs.length)%categoryTabs.length,target=categoryTabs[next];showCategory(target.getAttribute("data-shell-category")||"Draw");target.focus()})}
  const rail=root.querySelector(".quick-tools-rail"),railButtons=Array.from(root.querySelectorAll(".quick-tools-rail [data-shell-command]")),railTriggers=Array.from(root.querySelectorAll(".rail-flyout-trigger")),railMenus=Array.from(root.querySelectorAll(".rail-flyout"))
  function commandLabel(definition){const alias=definition?.aliases?.[0];return alias?`${definition.name} (${alias})`:definition?.name||""}
  function closeRailFlyouts({focus=false}={}){for(const trigger of railTriggers){const menu=root.querySelector(`[data-rail-menu="${trigger.dataset.railFlyout}"]`),wasOpen=menu instanceof HTMLElement&&!menu.hidden;if(menu instanceof HTMLElement)menu.hidden=true;trigger.setAttribute("aria-expanded","false");if(focus&&wasOpen)trigger.focus()}}
  function placeRailFlyout(trigger,menu){const anchor=trigger.closest(".rail-tool-family")?.getBoundingClientRect()||trigger.getBoundingClientRect();menu.hidden=false;const box=menu.getBoundingClientRect(),margin=6,spaceRight=window.innerWidth-anchor.right;const left=spaceRight>=box.width+margin?anchor.right+4:Math.max(margin,anchor.left-box.width-4),top=Math.max(margin,Math.min(anchor.top,window.innerHeight-box.height-margin));menu.style.left=`${Math.round(left)}px`;menu.style.top=`${Math.round(top)}px`}
  function toggleRailFlyout(trigger){const menu=root.querySelector(`[data-rail-menu="${trigger.dataset.railFlyout}"]`);if(!(menu instanceof HTMLElement))return;const opening=menu.hidden;closeRailFlyouts();if(opening){placeRailFlyout(trigger,menu);trigger.setAttribute("aria-expanded","true");menu.querySelector("button:not([hidden]):not(:disabled)")?.focus()}}
  for(const button of railButtons){const name=button.getAttribute("data-shell-command")||"",definition=registry.resolve(name);if(!definition){button.setAttribute("hidden","");continue}const label=commandLabel(definition);if(button.getAttribute("role")!=="menuitem")button.dataset.tooltip=label;button.title=label;button.setAttribute("aria-label",definition.aliases[0]?`${definition.name}, shortcut ${definition.aliases[0]}`:definition.name);button.addEventListener("click",()=>{launch(name);closeRailFlyouts()})}
  for(const trigger of railTriggers){const menu=root.querySelector(`[data-rail-menu="${trigger.dataset.railFlyout}"]`);if(!(menu instanceof HTMLElement)){trigger.hidden=true;continue}if(!menu.querySelector("button:not([hidden])")){trigger.hidden=true;menu.hidden=true;continue}trigger.addEventListener("click",event=>{event.stopPropagation();toggleRailFlyout(trigger)});trigger.addEventListener("keydown",event=>{if(["ArrowRight","Enter"," "].includes(event.key)){event.preventDefault();toggleRailFlyout(trigger)}});menu.addEventListener("keydown",event=>{const items=Array.from(menu.querySelectorAll('button:not([hidden]):not(:disabled)')),current=Math.max(0,items.indexOf(document.activeElement));if(event.key==="Escape"){event.preventDefault();event.stopPropagation();closeRailFlyouts({focus:true})}else if(["ArrowDown","ArrowUp","Home","End"].includes(event.key)){event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?items.length-1:(current+(event.key==="ArrowDown"?1:-1)+items.length)%items.length;items[next]?.focus()}})}
  document.addEventListener("keydown",event=>{if(event.key==="Escape"&&railMenus.some(menu=>!menu.hidden)){event.preventDefault();event.stopPropagation();closeRailFlyouts({focus:true})}},true)
  function syncCommandLaunchers(){const active=router.activeCommand;for(const button of root.querySelectorAll("[data-shell-command]")){const selected=button.getAttribute("data-shell-command")===active;button.classList.toggle("is-active",selected);if(button.closest(".quick-tools-rail")){if(button.getAttribute("role")==="menuitem")button.setAttribute("aria-current",selected?"true":"false");else button.setAttribute("aria-pressed",String(selected))}}}
  router.subscribe(syncCommandLaunchers);syncCommandLaunchers()
  function closeUtility({focus=false}={}) { if (!(utilityMenu instanceof HTMLElement) || !(utilityTrigger instanceof HTMLElement)) return;utilityMenu.hidden=true;utilityTrigger.setAttribute("aria-expanded","false");if(focus)utilityTrigger.focus() }
  function toggleUtility() { if (!(utilityMenu instanceof HTMLElement) || !(utilityTrigger instanceof HTMLElement)) return;const opening=utilityMenu.hidden;utilityMenu.hidden=!opening;utilityTrigger.setAttribute("aria-expanded",String(opening));if(opening)utilityMenu.querySelector("button")?.focus() }
  function closeEdit({focus=false}={}) { if(!(editMenu instanceof HTMLElement)||!(editTrigger instanceof HTMLElement)||!(edit instanceof HTMLElement))return;editMenu.hidden=true;editTrigger.setAttribute("aria-expanded","false");edit.classList.remove("is-open");if(focus)editTrigger.focus() }
  function toggleEdit() { if(!(editMenu instanceof HTMLElement)||!(editTrigger instanceof HTMLElement)||!(edit instanceof HTMLElement))return;const opening=editMenu.hidden;closeUtility();editMenu.hidden=!opening;editTrigger.setAttribute("aria-expanded",String(opening));edit.classList.toggle("is-open",opening);if(opening)editMenu.querySelector("button:not(:disabled)")?.focus() }
  utilityTrigger?.addEventListener("click",toggleUtility)
  utilityMenu?.addEventListener("click",()=>closeUtility())
  editTrigger?.addEventListener("click",toggleEdit)
  editMenu?.addEventListener("keydown",event=>{const items=Array.from(editMenu.querySelectorAll('button:not(:disabled)')),current=Math.max(0,items.indexOf(document.activeElement));if(event.key==="Escape"){event.preventDefault();closeEdit({focus:true})}else if(["ArrowDown","ArrowUp","Home","End"].includes(event.key)){event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?items.length-1:(current+(event.key==="ArrowDown"?1:-1)+items.length)%items.length;items[next]?.focus()}})
  editMenu?.querySelectorAll("[data-edit-command]").forEach(button=>button.addEventListener("click",()=>{launch(button.getAttribute("data-edit-command")||"");closeEdit()}))
  const selectAll=editMenu?.querySelector('[data-edit-action="select-all"]')
  selectAll?.addEventListener("click",()=>{if(!router.isActive)window.caderactViewport.selectAllCommittedGeometry();closeEdit()})
  const refreshEditSafety=()=>{if(selectAll instanceof HTMLButtonElement)selectAll.disabled=router.isActive}
  router.subscribe(refreshEditSafety);refreshEditSafety()
  editMenu?.addEventListener("click",event=>{if(event.target===document.querySelector("#undo-button")||event.target===document.querySelector("#redo-button"))closeEdit()})
  const applicationMenus=Array.from(root.querySelectorAll(".application-menu"))
  function closeApplicationMenus(except=null,{focus=false}={}) { for(const menu of applicationMenus){if(menu===except)continue;const trigger=menu.querySelector(":scope > button"),dropdown=menu.querySelector(":scope > .application-menu-dropdown");if(!(trigger instanceof HTMLButtonElement)||!(dropdown instanceof HTMLElement))continue;const wasOpen=!dropdown.hidden;dropdown.hidden=true;trigger.setAttribute("aria-expanded","false");menu.classList.remove("is-open");if(focus&&wasOpen)trigger.focus()} }
  for(const menu of applicationMenus){
    const trigger=menu.querySelector(":scope > button"),dropdown=menu.querySelector(":scope > .application-menu-dropdown")
    if(!(trigger instanceof HTMLButtonElement)||!(dropdown instanceof HTMLElement))continue
    const items=()=>Array.from(dropdown.querySelectorAll('[role^="menuitem"]')).filter(item=>!item.disabled)
    trigger.addEventListener("click",()=>{const opening=dropdown.hidden;closeApplicationMenus(menu);closeEdit();closeUtility();dropdown.hidden=!opening;trigger.setAttribute("aria-expanded",String(opening));menu.classList.toggle("is-open",opening);if(opening)items()[0]?.focus()})
    dropdown.addEventListener("keydown",event=>{const available=items(),current=Math.max(0,available.indexOf(document.activeElement));if(event.key==="Escape"){event.preventDefault();dropdown.hidden=true;trigger.setAttribute("aria-expanded","false");trigger.focus()}else if(["ArrowDown","ArrowUp","Home","End"].includes(event.key)){event.preventDefault();const next=event.key==="Home"?0:event.key==="End"?available.length-1:(current+(event.key==="ArrowDown"?1:-1)+available.length)%available.length;available[next]?.focus()}})
  }
  const gridAction=root.querySelector('[data-view-action="grid"]')
  function syncGridAction(){if(gridAction instanceof HTMLElement)gridAction.setAttribute("aria-checked",String(window.caderactUserPreferences.value.gridVisible))}
  gridAction?.addEventListener("click",()=>{window.caderactUserPreferences.set({gridVisible:!window.caderactUserPreferences.value.gridVisible});syncGridAction();closeApplicationMenus()})
  window.caderactUserPreferences.subscribe(syncGridAction)
  const windowPanelPreferences=Object.freeze({layers:"rightDockLayersVisible",groups:"rightDockGroupsVisible",blocks:"rightDockBlocksVisible",properties:"rightDockPropertiesVisible"})
  const windowPanelActions=Array.from(root.querySelectorAll("[data-window-panel]"))
  function syncWindowPanels(){for(const action of windowPanelActions){const preference=windowPanelPreferences[action.dataset.windowPanel];if(preference)action.setAttribute("aria-checked",String(window.caderactUserPreferences.value[preference]))}}
  for(const action of windowPanelActions)action.addEventListener("click",()=>{const panel=action.dataset.windowPanel;if(window.caderactPropertiesPanel?.togglePanel)window.caderactPropertiesPanel.togglePanel(panel);else{const preference=windowPanelPreferences[panel];if(preference)window.caderactUserPreferences.set({[preference]:!window.caderactUserPreferences.value[preference]})}syncWindowPanels();closeApplicationMenus()})
  window.caderactUserPreferences.subscribe(syncWindowPanels)
  document.addEventListener("pointerdown",event=>{if(rail instanceof HTMLElement&&!event.composedPath().includes(rail)&&!railMenus.some(menu=>event.composedPath().includes(menu)))closeRailFlyouts();if(utility instanceof HTMLElement&&!event.composedPath().includes(utility))closeUtility();if(edit instanceof HTMLElement&&!event.composedPath().includes(edit))closeEdit();if(!applicationMenus.some(menu=>event.composedPath().includes(menu)))closeApplicationMenus()})
  document.addEventListener("focusin",event=>{if(rail instanceof HTMLElement&&!event.composedPath().includes(rail)&&!railMenus.some(menu=>event.composedPath().includes(menu)))closeRailFlyouts();if(utility instanceof HTMLElement&&!event.composedPath().includes(utility)&&event.target!==utilityTrigger)closeUtility();if(edit instanceof HTMLElement&&!event.composedPath().includes(edit)&&event.target!==editTrigger)closeEdit()})
  document.addEventListener("keydown",event=>{
    if ((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k") { const commandInput=document.querySelector("#command-input");if(commandInput instanceof HTMLInputElement){event.preventDefault();commandInput.focus();commandInput.select()} }
    if(event.key==="Escape"&&!utilityMenu?.hidden){event.preventDefault();closeUtility({focus:true})}
    else if(event.key==="Escape"&&!editMenu?.hidden){event.preventDefault();closeEdit({focus:true})}
    else if(event.key==="Escape")closeApplicationMenus(null,{focus:true})
  })
  showCategory("Draw")
  window.caderactApplicationShell=Object.freeze({launch,showCategory,closeUtility,closeRailFlyouts,syncCommandLaunchers})
})()
