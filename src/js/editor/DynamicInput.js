// P6A: transient dynamic-input state plus a DOM presentation adapter.
(() => {
  const freezeFields = fields => Object.freeze((fields || []).map(field => Object.freeze({ ...field })))
  const hiddenState = () => Object.freeze({ visible:false, screenPoint:null, prompt:"", fields:Object.freeze([]), placement:null })
  function place(screenPoint, viewport, size = { width:220, height:58 }, gap = 18) {
    const flipX = screenPoint.x + gap + size.width > viewport.width
    const flipY = screenPoint.y + gap + size.height > viewport.height
    return Object.freeze({ left:Math.max(4,Math.min(viewport.width-size.width-4,screenPoint.x+(flipX?-size.width-gap:gap))), top:Math.max(4,Math.min(viewport.height-size.height-4,screenPoint.y+(flipY?-size.height-gap:gap))), flipX, flipY })
  }
  function createController({ onChange = () => {} } = {}) {
    let state=hiddenState()
    function update({ screenPoint, viewport, prompt="", fields=[] }={}) {
      if(!Number.isFinite(screenPoint?.x)||!Number.isFinite(screenPoint?.y)||!(viewport?.width>0)||!(viewport?.height>0))return clear()
      state=Object.freeze({visible:true,screenPoint:Object.freeze({...screenPoint}),prompt:String(prompt),fields:freezeFields(fields),placement:place(screenPoint,viewport)})
      onChange(state);return state
    }
    function clear(){state=hiddenState();onChange(state);return state}
    return Object.freeze({update,clear,getState:()=>state})
  }
  function createView({host}) {
    const root=document.createElement("div");root.classList.add("dynamic-input-hud");root.hidden=true;root.setAttribute("aria-live","polite");root.setAttribute("aria-atomic","true")
    const prompt=document.createElement("div");prompt.classList.add("dynamic-input-prompt")
    const fields=document.createElement("div");fields.classList.add("dynamic-input-fields");root.appendChild(prompt);root.appendChild(fields);host.appendChild(root)
    function render(state){root.hidden=!state.visible;if(!state.visible)return;root.style.left=`${state.placement.left}px`;root.style.top=`${state.placement.top}px`;root.classList.toggle("is-flipped-x",state.placement.flipX);root.classList.toggle("is-flipped-y",state.placement.flipY);prompt.textContent=state.prompt;fields.replaceChildren(...state.fields.map(field=>{const item=document.createElement("span");item.classList.add("dynamic-input-field");if(field.active)item.classList.add("is-active");const label=document.createElement("small");label.textContent=field.label;const value=document.createElement("strong");value.textContent=field.value;item.appendChild(label);item.appendChild(value);return item}))}
    return Object.freeze({render,element:root})
  }
  const formatNumber=value=>{if(!Number.isFinite(value))return "";const fixed=value.toFixed(3);return fixed.replace(/\.0+$|(?<=\.[0-9]*?)0+$/g,"").replace(/\.$/,"")}
  const formatAngle=value=>`${Number.isFinite(value)?value.toFixed(2):""}°`
  window.CaderactDynamicInput=Object.freeze({createController,createView,place,formatNumber,formatAngle})
})()
