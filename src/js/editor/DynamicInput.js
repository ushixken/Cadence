// P6A: transient dynamic-input state plus a DOM presentation adapter.
(() => {
  const freezeFields = fields => Object.freeze((fields || []).map(field => Object.freeze({ ...field })))
  const hiddenState = () => Object.freeze({ visible:false, screenPoint:null, prompt:"", fields:Object.freeze([]), placement:null, editing:false, activeFieldId:null, invalid:false })
  function place(screenPoint, viewport, size = { width:220, height:58 }, gap = 18) {
    const flipX = screenPoint.x + gap + size.width > viewport.width
    const flipY = screenPoint.y + gap + size.height > viewport.height
    return Object.freeze({ left:Math.max(4,Math.min(viewport.width-size.width-4,screenPoint.x+(flipX?-size.width-gap:gap))), top:Math.max(4,Math.min(viewport.height-size.height-4,screenPoint.y+(flipY?-size.height-gap:gap))), flipX, flipY })
  }
  function createController({ onChange = () => {} } = {}) {
    let state=hiddenState()
    const publish=next=>{state=Object.freeze(next);onChange(state);return state}
    function update({ screenPoint, viewport, prompt="", fields=[] }={}) {
      if(!Number.isFinite(screenPoint?.x)||!Number.isFinite(screenPoint?.y)||!(viewport?.width>0)||!(viewport?.height>0))return clear()
      const active=state.editing?state.fields.find(field=>field.id===state.activeFieldId):null
      const nextFields=fields.map(field=>({ ...field,displayValue:field.displayValue??field.value,text:active?.id===field.id?active.text:"",active:active?.id===field.id }))
      return publish({visible:true,screenPoint:Object.freeze({...screenPoint}),prompt:String(prompt),fields:freezeFields(nextFields),placement:place(screenPoint,viewport),editing:Boolean(active),activeFieldId:active?.id||null,invalid:Boolean(active&&state.invalid)})
    }
    function clear(){return publish(hiddenState())}
    function beginEdit(character){if(!state.visible||state.editing)return false;const field=state.fields.find(item=>item.editable);if(!field)return false;return activate(field.id,character)}
    function activate(id,text=""){const target=state.fields.find(field=>field.id===id&&field.editable);if(!target)return false;return publish({...state,editing:true,invalid:false,activeFieldId:id,fields:freezeFields(state.fields.map(field=>({...field,active:field.id===id,text:field.id===id?String(text):""})))})}
    function append(character){if(!state.editing)return false;return publish({...state,invalid:false,fields:freezeFields(state.fields.map(field=>field.id===state.activeFieldId?{...field,text:field.text+character}:field))})}
    function backspace(){if(!state.editing)return false;return publish({...state,invalid:false,fields:freezeFields(state.fields.map(field=>field.id===state.activeFieldId?{...field,text:field.text.slice(0,-1)}:field))})}
    function cycle(reverse=false){const editable=state.fields.filter(field=>field.editable);if(!state.editing||editable.length<2)return false;const index=editable.findIndex(field=>field.id===state.activeFieldId),next=editable[(index+(reverse?-1:1)+editable.length)%editable.length];return activate(next.id,"")}
    function cancelEdit(){if(!state.editing)return false;return publish({...state,editing:false,invalid:false,activeFieldId:null,fields:freezeFields(state.fields.map(field=>({...field,active:false,text:""})))})}
    function setInvalid(){if(!state.editing)return false;return publish({...state,invalid:true})}
    function activeEdit(){const field=state.fields.find(item=>item.id===state.activeFieldId);return field?Object.freeze({id:field.id,kind:field.kind,text:field.text}):null}
    return Object.freeze({update,clear,beginEdit,activate,append,backspace,cycle,cancelEdit,setInvalid,activeEdit,getState:()=>state})
  }
  function createView({host}) {
    const root=document.createElement("div");root.classList.add("dynamic-input-hud");root.hidden=true;root.setAttribute("aria-live","polite");root.setAttribute("aria-atomic","true")
    const prompt=document.createElement("div");prompt.classList.add("dynamic-input-prompt")
    const fields=document.createElement("div");fields.classList.add("dynamic-input-fields");root.appendChild(prompt);root.appendChild(fields);host.appendChild(root)
    function render(state){root.hidden=!state.visible;if(!state.visible)return;root.style.left=`${state.placement.left}px`;root.style.top=`${state.placement.top}px`;root.classList.toggle("is-flipped-x",state.placement.flipX);root.classList.toggle("is-flipped-y",state.placement.flipY);root.classList.toggle("is-editing",state.editing);root.classList.toggle("is-invalid",state.invalid);prompt.textContent=state.prompt;fields.replaceChildren(...state.fields.map(field=>{const item=document.createElement("span");item.classList.add("dynamic-input-field");if(field.active)item.classList.add("is-active");const label=document.createElement("small");label.textContent=field.label;const value=document.createElement("strong");value.textContent=field.active?field.text:field.displayValue;item.appendChild(label);item.appendChild(value);return item}))}
    return Object.freeze({render,element:root})
  }
  const formatNumber=value=>{if(!Number.isFinite(value))return "";const fixed=value.toFixed(3);return fixed.replace(/\.0+$|(?<=\.[0-9]*?)0+$/g,"").replace(/\.$/,"")}
  const formatAngle=value=>`${Number.isFinite(value)?value.toFixed(2):""}°`
  window.CaderactDynamicInput=Object.freeze({createController,createView,place,formatNumber,formatAngle})
})()
