// ASTRA-1G shell adapter: presentation state only; CAD commands remain owned by CommandRouter.
(() => {
  const root = document.querySelector(".editor-page"), registry = window.caderactCommandRegistry, router = window.caderactCommandRouter
  if (!(root instanceof HTMLElement) || !registry || !router) return
  const categoryTools = document.querySelector("#category-tools"), categoryName = document.querySelector("#active-category-name")
  const utility = document.querySelector(".utility-menu"), utilityTrigger = document.querySelector("#utility-menu-trigger"), utilityMenu = document.querySelector("#utility-menu-actions")
  const edit = document.querySelector(".edit-menu"), editTrigger = document.querySelector(".edit-menu-trigger"), editMenu = document.querySelector("#edit-menu-actions")
  const categories = Object.freeze({
    Draw: ["Line", "Polyline", "Rectangle", "Circle", "Arc", "Ellipse", "Polygon", "Text", "Hatch", "Region"],
    Modify: ["Move", "Copy", "Rotate", "Scale", "Mirror", "Offset", "Trim", "Extend", "Explode"], Annotate: ["Linear", "Aligned", "Angular", "DimRadius", "DimDiameter", "Text"],
    Layers: [], Blocks: ["Block", "Insert", "BlockEdit", "Explode"], Measure: ["Distance", "Length", "Radius", "Diameter", "Area", "Perimeter", "Angle", "DistanceObject", "MinDist", "DistanceSum"], Drafting: [], Custom: [],
  })
  const icons = Object.freeze({
    Delete:"delete",Copy:"copy",Line:"line",Polyline:"polyline",Rectangle:"rectangle",Circle:"circle",Arc:"arc",Ellipse:"ellipse",Polygon:"polygon",Text:"text",Hatch:"hatch",Region:"region",
    Move:"move",Rotate:"rotate",Scale:"scale",Mirror:"mirror",Offset:"offset",Trim:"trim",Extend:"extend",Explode:"explode",Linear:"dimension",Aligned:"dimension",Angular:"dimension",DimRadius:"dimension",DimDiameter:"dimension",
    Block:"block",Insert:"insert",BlockEdit:"block",Distance:"measure",Length:"measure",Radius:"measure",Diameter:"measure",Area:"measure",Perimeter:"measure",Angle:"measure",DistanceObject:"measure",MinDist:"measure",DistanceSum:"measure",
  })
  function launch(name) { if (!registry.resolve(name)) return false; router.execute(name); return true }
  function icon(name) {
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg"),use=document.createElementNS("http://www.w3.org/2000/svg","use")
    svg.setAttribute("aria-hidden","true");use.setAttribute("href",`#cad-${icons[name]||"line"}`);svg.appendChild(use);return svg
  }
  function showCategory(name) {
    const commands=categories[name]||[]
    if (!(categoryTools instanceof HTMLElement) || !(categoryName instanceof HTMLElement)) return
    categoryName.textContent=name
    categoryTools.replaceChildren(...commands.filter(command=>registry.resolve(command)).map(command=>{
      const button=document.createElement("button"),label=document.createElement("span")
      button.type="button";button.dataset.shellCommand=command;label.textContent=command;button.append(icon(command),label);button.addEventListener("click",()=>launch(command));return button
    }))
    if (!categoryTools.childElementCount) { const empty=document.createElement("span");empty.className="category-empty";empty.textContent=`${name} commands remain available through menus and command input.`;categoryTools.appendChild(empty) }
    root.querySelectorAll(".cad-tool-tabs [data-shell-category]").forEach(button=>{const active=button.getAttribute("data-shell-category")===name;button.classList.toggle("is-active",active);button.setAttribute("aria-selected",String(active))})
  }
  root.querySelectorAll(".cad-tool-tabs [data-shell-category]").forEach(button=>button.addEventListener("click",()=>showCategory(button.getAttribute("data-shell-category")||"Draw")))
  root.querySelectorAll(".quick-tools-rail [data-shell-command]").forEach(button=>{const name=button.getAttribute("data-shell-command")||"";if(!registry.resolve(name)){button.setAttribute("hidden","");return}button.addEventListener("click",()=>launch(name))})
  function closeUtility({focus=false}={}) { if (!(utilityMenu instanceof HTMLElement) || !(utilityTrigger instanceof HTMLElement)) return;utilityMenu.hidden=true;utilityTrigger.setAttribute("aria-expanded","false");if(focus)utilityTrigger.focus() }
  function toggleUtility() { if (!(utilityMenu instanceof HTMLElement) || !(utilityTrigger instanceof HTMLElement)) return;const opening=utilityMenu.hidden;utilityMenu.hidden=!opening;utilityTrigger.setAttribute("aria-expanded",String(opening));if(opening)utilityMenu.querySelector("button")?.focus() }
  function closeEdit({focus=false}={}) { if(!(editMenu instanceof HTMLElement)||!(editTrigger instanceof HTMLElement)||!(edit instanceof HTMLElement))return;editMenu.hidden=true;editTrigger.setAttribute("aria-expanded","false");edit.classList.remove("is-open");if(focus)editTrigger.focus() }
  function toggleEdit() { if(!(editMenu instanceof HTMLElement)||!(editTrigger instanceof HTMLElement)||!(edit instanceof HTMLElement))return;const opening=editMenu.hidden;closeUtility();editMenu.hidden=!opening;editTrigger.setAttribute("aria-expanded",String(opening));edit.classList.toggle("is-open",opening);if(opening)editMenu.querySelector("button:not(:disabled)")?.focus() }
  utilityTrigger?.addEventListener("click",toggleUtility)
  utilityMenu?.addEventListener("click",()=>closeUtility())
  editTrigger?.addEventListener("click",toggleEdit)
  editMenu?.querySelectorAll("[data-edit-command]").forEach(button=>button.addEventListener("click",()=>{launch(button.getAttribute("data-edit-command")||"");closeEdit()}))
  editMenu?.addEventListener("click",event=>{if(event.target===document.querySelector("#undo-button")||event.target===document.querySelector("#redo-button"))closeEdit()})
  document.addEventListener("pointerdown",event=>{if(utility instanceof HTMLElement&&!event.composedPath().includes(utility))closeUtility();if(edit instanceof HTMLElement&&!event.composedPath().includes(edit))closeEdit()})
  document.addEventListener("focusin",event=>{if(utility instanceof HTMLElement&&!event.composedPath().includes(utility)&&event.target!==utilityTrigger)closeUtility();if(edit instanceof HTMLElement&&!event.composedPath().includes(edit)&&event.target!==editTrigger)closeEdit()})
  document.addEventListener("keydown",event=>{
    if ((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k") { const commandInput=document.querySelector("#command-input");if(commandInput instanceof HTMLInputElement){event.preventDefault();commandInput.focus();commandInput.select()} }
    if(event.key==="Escape"&&!utilityMenu?.hidden){event.preventDefault();closeUtility({focus:true})}
    else if(event.key==="Escape"&&!editMenu?.hidden){event.preventDefault();closeEdit({focus:true})}
  })
  showCategory("Draw")
  window.caderactApplicationShell=Object.freeze({launch,showCategory,closeUtility})
})()
