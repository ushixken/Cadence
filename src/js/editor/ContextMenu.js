// C2: reusable semantic context-menu controller and accessible DOM projection.
(() => {
  function create({element,viewport=()=>({width:window.innerWidth||1024,height:window.innerHeight||768}),margin=8}={}){
    if(!element)throw new Error("Context menu element is required")
    let state=Object.freeze({open:false,context:null,actions:Object.freeze([]),x:0,y:0}),returnFocus=null
    const enabledItems=()=>Array.from(element.children).filter(item=>item.getAttribute("role")==="menuitem"&&!item.disabled)
    function close({restoreFocus=true}={}){if(!state.open)return state;element.hidden=true;element.replaceChildren();state=Object.freeze({open:false,context:null,actions:Object.freeze([]),x:0,y:0});if(restoreFocus)returnFocus?.focus?.();returnFocus=null;return state}
    function activate(action){if(!action?.enabled)return false;close({restoreFocus:false});action.execute();return true}
    function open({context,actions,x,y,focusTarget=null}){
      close({restoreFocus:false});returnFocus=focusTarget||document.activeElement
      const normalized=Array.from(actions||[]).filter(action=>action&&action.id&&action.label).map(action=>Object.freeze({...action,enabled:action.enabled!==false}))
      for(const action of normalized){if(action.separatorBefore&&element.children.length){const separator=document.createElement("div");separator.classList.add("context-menu-separator");separator.setAttribute("role","separator");element.appendChild(separator)}const item=document.createElement("button");item.type="button";item.classList.add("context-menu-item");item.setAttribute("role","menuitem");item.dataset.actionId=action.id;item.textContent=action.label;item.disabled=!action.enabled;item.addEventListener("click",()=>activate(action));element.appendChild(item)}
      if(!normalized.length)return close({restoreFocus:false})
      element.hidden=false;const bounds=viewport(),width=Math.min(280,Math.max(150,element.offsetWidth||180)),height=element.offsetHeight||normalized.length*30+8,left=Math.max(margin,Math.min(x,bounds.width-width-margin)),top=Math.max(margin,Math.min(y,bounds.height-height-margin));element.style.left=`${left}px`;element.style.top=`${top}px`;state=Object.freeze({open:true,context,actions:Object.freeze(normalized),x:left,y:top});(enabledItems()[0]||element).focus();return state
    }
    element.addEventListener("keydown",event=>{const items=enabledItems(),current=items.indexOf(document.activeElement);if(event.key==="Escape"){event.preventDefault();close();return}if(!items.length)return;let index=null;if(event.key==="ArrowDown")index=(current+1+items.length)%items.length;else if(event.key==="ArrowUp")index=(current-1+items.length)%items.length;else if(event.key==="Home")index=0;else if(event.key==="End")index=items.length-1;else if((event.key==="Enter"||event.key===" ")&&current>=0){event.preventDefault();const action=state.actions.find(value=>value.id===items[current].dataset.actionId);activate(action);return}if(index!==null){event.preventDefault();items[index].focus()}})
    document.addEventListener("pointerdown",event=>{if(state.open&&!element.contains(event.target))close()})
    window.addEventListener("blur",()=>close({restoreFocus:false}))
    return Object.freeze({open,close,getState:()=>state})
  }
  window.CaderactContextMenu=Object.freeze({create})
})()
