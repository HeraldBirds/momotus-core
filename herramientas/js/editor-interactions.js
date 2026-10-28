/* Shared view-only interactions. Hosts retain ownership of document gestures. */
(function(root){
'use strict';const frames=new WeakMap();
const editable=target=>!!target?.closest?.('input,select,textarea,button,a,summary,[contenteditable="true"]');
function cursor(el,value){if(!el)return;if(value){if(el.dataset.mcCursor!==value)el.dataset.mcCursor=value;}else if(el.dataset.mcCursor)delete el.dataset.mcCursor;}
function zoomAt(view,surface,apply,clientX,clientY){if(!view||!surface)return;const r=surface.getBoundingClientRect(),v=view.getBoundingClientRect();if(!r.width||!r.height)return;const x=clientX??v.left+v.width/2,y=clientY??v.top+v.height/2,u=(x-r.left)/r.width,t=(y-r.top)/r.height;apply();cancelAnimationFrame(frames.get(view));frames.set(view,requestAnimationFrame(()=>{if(!view.isConnected||!surface.checkVisibility())return;const after=surface.getBoundingClientRect();view.scrollLeft+=after.left+u*after.width-x;view.scrollTop+=after.top+t*after.height-y;}));}
function factor(e){const unit=e.deltaMode===1?16:e.deltaMode===2?600:1;return Math.exp(-Math.max(-300,Math.min(300,e.deltaY*unit))*.0015);}
function bind({view,surface,scope=view,ready=()=>true,busy=()=>false,getCursor=()=>null,zoom,onEscape,pan=true,onPan=()=>{}}){
 let space=false,gesture=null,suppress=false,clearClick=0;const listeners=[];
 const on=(el,type,fn,options)=>{el.addEventListener(type,fn,options);listeners.push(()=>el.removeEventListener(type,fn,options));};
 function active(){return view.isConnected&&view.checkVisibility()&&ready()&&!busy();}
 function refresh(){cursor(surface,gesture?'grabbing':space?'grab':getCursor());}
 function finish(cancel=false){if(!gesture)return;const g=gesture;gesture=null;if(cancel){view.scrollLeft=g.left;view.scrollTop=g.top;}if(view.hasPointerCapture(g.id))view.releasePointerCapture(g.id);onPan(false);refresh();clearTimeout(clearClick);clearClick=setTimeout(()=>suppress=false,0);}
 function reset(){space=false;finish(true);suppress=false;refresh();}
 if(!surface.hasAttribute('tabindex'))surface.tabIndex=0;view.classList.add('mc-viewport');if(!view.hasAttribute('tabindex'))view.tabIndex=0;
 on(view,'pointerdown',e=>{suppress=false;if(!pan||!active()||editable(e.target)||!(e.button===1||e.button===0&&space))return;e.preventDefault();e.stopImmediatePropagation();view.focus({preventScroll:true});gesture={id:e.pointerId,x:e.clientX,y:e.clientY,left:view.scrollLeft,top:view.scrollTop};suppress=true;view.setPointerCapture(e.pointerId);onPan(true);refresh();},true);
 on(view,'pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();view.scrollLeft=gesture.left+gesture.x-e.clientX;view.scrollTop=gesture.top+gesture.y-e.clientY;},true);
 on(view,'pointerup',e=>{if(gesture?.id!==e.pointerId)return;e.preventDefault();e.stopImmediatePropagation();finish();},true);
 for(const type of ['pointercancel','lostpointercapture'])on(view,type,e=>{if(gesture?.id===e.pointerId)finish(true);},true);
 on(view,'click',e=>{if(!suppress)return;e.preventDefault();e.stopImmediatePropagation();suppress=false;},true);
 on(view,'auxclick',e=>{if(e.button===1)e.preventDefault();});
 on(scope,'keydown',e=>{if(!active()||editable(e.target)&&e.key!=='Escape')return;if(e.code==='Space'){space=true;e.preventDefault();refresh();}if(e.key==='Escape'){if(gesture){e.preventDefault();e.stopImmediatePropagation();finish(true);space=false;refresh();}else if(onEscape?.()){e.preventDefault();e.stopImmediatePropagation();refresh();}}},true);
 on(window,'keyup',e=>{if(e.code==='Space'){space=false;refresh();}});on(window,'blur',reset);on(document,'visibilitychange',()=>{if(document.hidden)reset();});if(scope.tagName==='DIALOG')on(scope,'close',reset);
 if(zoom)on(view,'wheel',e=>{if(!active()||editable(e.target)||gesture||!e.deltaY&&!e.deltaX)return;e.preventDefault();e.stopImmediatePropagation();if(e.shiftKey){view.scrollLeft+=e.deltaY+e.deltaX;return;}zoom(e,factor(e));},{passive:false,capture:true});
 on(surface,'pointerenter',refresh);on(scope,'change',()=>queueMicrotask(refresh));on(scope,'click',()=>queueMicrotask(refresh));
 refresh();return{refresh,reset,finish,get panning(){return!!gesture;},get space(){return space;},destroy(){reset();for(const stop of listeners)stop();cancelAnimationFrame(frames.get(view));view.classList.remove('mc-viewport');cursor(surface,null);}};
}
function cssView({view,surface,scope=view,ready=()=>surface.width>0,busy=()=>false,getCursor=()=>null,onEscape,controls}){
 if(!surface.hasAttribute('tabindex'))surface.tabIndex=0;
 let scale=null;const initial={width:surface.style.width,height:surface.style.height};
 const reset=()=>{scale=null;surface.classList.remove('mc-css-zoom');surface.style.width=initial.width;surface.style.height=initial.height;};
 const binding=bind({view,surface,scope,ready,busy,getCursor,onEscape,zoom:(e,f)=>zoomAt(view,surface,()=>{scale=Math.max(.025,Math.min(16,surface.getBoundingClientRect().width/surface.width*f));surface.classList.add('mc-css-zoom');surface.style.width=surface.width*scale+'px';surface.style.height=surface.height*scale+'px';},e.clientX,e.clientY)});
 let dimensions=surface.width+':'+surface.height;const observer=new MutationObserver(()=>{const next=surface.width+':'+surface.height;if(next!==dimensions){dimensions=next;reset();}});observer.observe(surface,{attributes:true,attributeFilter:['width','height']});
 if(controls){const fit=document.createElement('button');fit.type='button';fit.className='mc-fit-view';fit.textContent='Ajustar vista';fit.onclick=()=>{reset();view.scrollLeft=view.scrollTop=0;};controls.append(fit);}
 view.title='Rueda: zoom bajo el puntero · Mayús + rueda: desplazar · Espacio + arrastrar o botón central: mover';
 return{reset:()=>{binding.reset();reset();},refresh:binding.refresh,get panning(){return binding.panning;},get space(){return binding.space;}};
}
function sampler({surface,scope=surface.closest('dialog')||document.body,enabled=()=>true,sample}){
 const tip=document.createElement('output'),swatch=document.createElement('i'),text=document.createElement('span');tip.className='mc-sample-tip';tip.hidden=true;tip.setAttribute('aria-hidden','true');tip.append(swatch,text);scope.append(tip);let frame=0;
 const hide=()=>{cancelAnimationFrame(frame);tip.hidden=true;};surface.addEventListener('pointermove',e=>{cancelAnimationFrame(frame);if(!enabled()){hide();return;}const x=e.clientX,y=e.clientY;frame=requestAnimationFrame(()=>{const r=surface.getBoundingClientRect();if(!r.width||!r.height)return;try{const hex=sample((x-r.left)/r.width,(y-r.top)/r.height);if(!hex){hide();return;}swatch.style.background=hex;text.textContent=hex;tip.style.left=Math.max(4,Math.min(innerWidth-150,x+18))+'px';tip.style.top=Math.max(4,Math.min(innerHeight-45,y+18))+'px';tip.hidden=false;}catch{hide();}});});surface.addEventListener('pointerleave',hide);surface.addEventListener('pointerdown',hide);window.addEventListener('blur',hide);if(scope.tagName==='DIALOG')scope.addEventListener('close',hide);return{hide};
}
function feedback({surface,scope=surface.closest('dialog')||surface,getCursor}){const refresh=()=>cursor(surface,getCursor());const later=()=>queueMicrotask(refresh);for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])surface.addEventListener(type,later,true);for(const type of ['change','input','keydown','keyup','close'])scope.addEventListener(type,later,true);window.addEventListener('keyup',later);window.addEventListener('blur',later);refresh();return{refresh};}
root.MomotusInteraction=Object.freeze({editable,cursor,feedback,zoomAt,factor,bind,cssView,sampler});
})(globalThis);
