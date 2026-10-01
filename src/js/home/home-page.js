(() => {
  const home=document.querySelector(".home-page"),editor=document.querySelector(".editor-page"),newButton=document.querySelector(".new-project"),openButton=document.querySelector("#home-open-drawing"),recentList=document.querySelector("#home-recent-list"),recentEmpty=document.querySelector("#home-recent-empty"),templates=Array.from(document.querySelectorAll("[data-home-template]")),nav=Array.from(document.querySelectorAll("[data-home-section]")),recents=window.CaderactHomeRecentState?.create()
  if(!home||!editor||!newButton||!recents)return
  const showEditor=()=>{home.style.display="none";editor.style.display="flex";window.caderactViewport?.requestRender?.()}
  const date=value=>{if(!Number.isFinite(value))return"";try{return new Intl.DateTimeFormat(undefined,{dateStyle:"medium",timeStyle:"short"}).format(new Date(value))}catch{return""}}
  function render(entries=recents.value){recentList.replaceChildren(...entries.map(entry=>{const row=document.createElement("div"),primary=document.createElement("div"),name=document.createElement("strong"),meta=document.createElement("span"),time=document.createElement("span");row.className="home-recent-row";primary.className="home-recent-primary";time.className="home-recent-time";name.textContent=entry.name;meta.textContent=entry.source+(entry.lastModified?` · Modified ${date(entry.lastModified)}`:"");time.textContent=`Opened ${date(entry.lastOpened)}`;primary.append(name,meta);row.append(primary,time);return row}));recentEmpty.hidden=entries.length>0}
  async function run(action){const files=window.caderactFiles;if(!files)return Object.freeze({status:"file-actions-unavailable"});const outcome=await action(files);if(outcome?.status?.endsWith("-completed"))showEditor();return outcome}
  newButton.addEventListener("click",()=>run(files=>files.newProject({template:"metric"})))
  openButton?.addEventListener("click",()=>run(files=>files.openDrawing()))
  for(const button of templates)button.addEventListener("click",()=>run(files=>files.newProject({template:button.dataset.homeTemplate})))
  for(const link of nav)link.addEventListener("click",()=>{for(const item of nav)item.classList.toggle("nav-active",item===link)})
  window.addEventListener?.("caderact:file-result",event=>{const outcome=event.detail;if(outcome?.status==="open-completed")recents.record({name:outcome.filename,source:"Caderact",lastOpened:Date.now(),lastModified:outcome.sourceModifiedAt??null});else if(outcome?.status==="dxf-open-completed")recents.record({name:outcome.sourceFilename||outcome.filename,source:"DXF",lastOpened:Date.now(),lastModified:outcome.sourceModifiedAt??null})})
  recents.subscribe(render)
  window.caderactHome=Object.freeze({showEditor,recents})
})()
