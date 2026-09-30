// UX13: editor interaction over the existing PS3 gateway. Model data/cameras are never edited here.
(() => {
  function create({session,context,screenToPaper,paperZoom,onChange=()=>{},onLocked=()=>{}}) {
    let activeId=null,placement=null,preview=null,gesture=false
    const layout=()=>{const current=context.snapshot();return current.kind==='layout'?session.reader.layout(current.layoutId):null}
    const active=()=>layout()?.viewports[activeId]||null
    const changed=()=>onChange(snapshot())
    function snapshot(){const viewport=active();return Object.freeze({activeId:viewport?.id||null,placing:Boolean(placement),viewport:preview||viewport})}
    function clear(){activeId=null;placement=null;preview=null;gesture=false;changed()}
    function reconcile(){if(activeId&&!active())clear()}
    function hit(point){const sheet=layout();return sheet?[...sheet.viewportOrder].reverse().find(id=>{const f=sheet.viewports[id].frame;return point.x>=f.x&&point.x<=f.x+f.width&&point.y>=f.y&&point.y<=f.y+f.height}):null}
    function containsActiveAt(screen){const viewport=active();if(!viewport)return false;const point=screenToPaper(screen),f=viewport.frame;return point.x>=f.x&&point.x<=f.x+f.width&&point.y>=f.y&&point.y<=f.y+f.height}
    function activateAt(screen){if(!layout())return false;placement=null;preview=null;activeId=hit(screenToPaper(screen));changed();return true}
    function beginPlacement(){if(!layout())return false;activeId=null;preview=null;placement={start:null,current:null};changed();return true}
    function frame(){if(!placement?.start||!placement.current)return null;const a=placement.start,b=placement.current;return{x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(b.x-a.x),height:Math.abs(b.y-a.y)}}
    function pointerDown(screen){if(!placement)return Boolean(active());const point=screenToPaper(screen);if(!placement.start){placement.start=point;placement.current=point;changed();return true}placement.current=point;const f=frame();if(f.width*paperZoom()<3||f.height*paperZoom()<3)return true;const fitted=window.CaderactModelExtents.fit(session.reader.snapshot(),f),result=fitted.valid?session.layoutGateway.createViewport(layout().id,{frame:f,viewCenter:fitted.viewCenter,scale:fitted.scale,locked:false}):null;if(result?.viewport){placement=null;changed();return result.viewport.id}return true}
    function pointerMove(screen){if(!placement?.start)return false;placement.current=screenToPaper(screen);changed();return true}
    function projectedViewports(){const sheet=layout();if(!sheet)return[];const result=sheet.viewportOrder.map(id=>({...((preview?.id===id&&activeId===id)?preview:sheet.viewports[id]),active:id===activeId}));const f=frame();if(f?.width>0&&f.height>0)result.push({id:'layout-frame-preview',frame:f,viewCenter:{x:0,y:0},scale:1,locked:false,frameOnly:true,active:true});return result}
    function begin(){gesture=true}
    function commit(){const viewport=active(),sheet=layout(),pending=preview;preview=null;gesture=false;if(viewport&&pending){session.layoutGateway.updateViewport(sheet.id,viewport.id,{viewCenter:pending.viewCenter,scale:pending.scale},{viewChange:true})}changed()}
    function navigate({dx=0,dy=0,factor=1,screen=null}){
      const original=active();if(!original)return false
      if(original.locked){onLocked(original);return true}
      const current=preview||original,mm=window.CaderactUnits.conversionFactor(session.reader.units().length,'mm'),ratio=current.scale/(mm*paperZoom())
      let center={x:current.viewCenter.x-dx*ratio,y:current.viewCenter.y+dy*ratio},scale=current.scale
      if(factor!==1){scale=Math.max(.001,Math.min(1e9,scale/factor));const point=screenToPaper(screen),f=current.frame,px=point.x-f.x-f.width/2,py=point.y-f.y-f.height/2;center={x:center.x+px*(current.scale-scale)/mm,y:center.y+py*(current.scale-scale)/mm}}
      preview={...current,viewCenter:center,scale};changed();if(!gesture)commit();return true
    }
    context.subscribe(clear);session.subscribe(clear)
    let unsubscribe=null;function bind(){unsubscribe?.();unsubscribe=session.controller.subscribeHistory(()=>{reconcile();changed()})}session.subscribe(bind);bind()
    return Object.freeze({snapshot,clear,reconcile,activateAt,containsActiveAt,beginPlacement,pointerDown,pointerMove,projectedViewports,begin,commit,navigate,cancelGesture(){preview=null;gesture=false;changed()}})
  }
  window.CaderactLayoutViewportInteraction=Object.freeze({create})
})()
