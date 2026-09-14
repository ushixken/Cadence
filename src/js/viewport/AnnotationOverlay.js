// Shared DOM text layer used above either graphics renderer.
(() => {
  function create({host}) {
    const root=document.createElement("div");root.className="annotation-overlay";root.setAttribute("aria-hidden","true");host.appendChild(root)
    function render(items=[]) { root.replaceChildren(...items.map(item=>{const node=document.createElement("span");node.className="dimension-annotation";node.textContent=item.text;node.style.left=`${item.x}px`;node.style.top=`${item.y}px`;node.style.fontSize=`${item.fontSize}px`;node.style.color=item.color;node.style.transform=`translate(-50%, -50%) rotate(${item.rotation}rad)`;return node})) }
    return Object.freeze({root,render,clear:()=>root.replaceChildren()})
  }
  window.CaderactAnnotationOverlay=Object.freeze({create})
})()
