// Shared DOM text layer used above either graphics renderer.
(() => {
  function create({host}) {
    const root=document.createElement("div");root.className="annotation-overlay";root.setAttribute("aria-hidden","true");host.appendChild(root)
    function render(items=[]) { root.replaceChildren(...items.map(item=>{const node=document.createElement("span");node.className="dimension-annotation";if(item.role==="text")node.classList.add("text-annotation");if(item.selected)node.classList.add("selected");node.textContent=item.text;node.style.left=`${item.x}px`;node.style.top=`${item.y}px`;node.style.fontSize=`${item.fontSize}px`;node.style.color=item.color;const align=item.horizontalAlignment==="left"?"0%":item.horizontalAlignment==="right"?"-100%":"-50%";node.style.transform=`translate(${align}, -50%) rotate(${item.rotation}rad)`;node.style.transformOrigin=item.horizontalAlignment==="right"?"100% 50%":item.horizontalAlignment==="left"?"0% 50%":"50% 50%";return node})) }
    return Object.freeze({root,render,clear:()=>root.replaceChildren()})
  }
  window.CaderactAnnotationOverlay=Object.freeze({create})
})()
