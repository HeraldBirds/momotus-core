/* Galería de fotos reales: ampliación local y navegación accesible. */
(()=>{'use strict';
const C=window.MomotusMotionCore;if(!C)return;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};
function clearFallback(image){for(const key of ['fallbackApplied','fullFallbackApplied','variantFallbackApplied','failedSources'])delete image.dataset[key];}
function animatePhoto(image){window.MomotusMotion?.enter(image,{duration:200,distance:0});}
function openZoom(image,title){
 if(!image?.naturalWidth||image.hidden)return false;
 const previous=document.activeElement,dialog=el('dialog',undefined,'store-dialog mc-photo-dialog');dialog.setAttribute('aria-label','Ampliar '+title);
 const header=el('header'),heading=el('h2',title),close=button('Cerrar',()=>dialog.close());header.append(heading,close);
 const body=el('div',undefined,'store-dialog-body'),controls=el('div',undefined,'mc-zoom-controls'),view=el('div',undefined,'mc-zoom-viewport'),photo=el('img');
 photo.src=image.currentSrc||image.src;photo.alt=title;photo.draggable=false;photo.decoding='async';
 view.tabIndex=0;view.setAttribute('role','region');view.setAttribute('aria-label','Imagen ampliada. Usá las flechas, el desplazamiento o arrastrá para recorrerla.');view.append(photo);
 const label=el('label','Ampliación'),range=el('input'),value=el('output');range.type='range';range.min='100';range.max='300';range.step='10';range.value='100';range.setAttribute('aria-label','Ampliación de la fotografía');value.setAttribute('aria-live','off');label.append(range);
 let level=100,drag=null;
 const setZoom=next=>{const old=level,cx=view.scrollLeft+view.clientWidth/2,cy=view.scrollTop+view.clientHeight/2;level=C.clamp(Math.round(next/10)*10,100,300);range.value=String(level);value.value=level+'%';value.textContent=level+'%';const fit=Math.min(view.clientWidth,view.clientHeight*(image.naturalWidth/image.naturalHeight));photo.style.width=Math.max(1,Math.round(fit*level/100))+'px';if(old!==level){view.scrollLeft=cx*level/old-view.clientWidth/2;view.scrollTop=cy*level/old-view.clientHeight/2;}};
 controls.append(button('−',()=>setZoom(level-25)),label,value,button('+',()=>setZoom(level+25)),button('Ajustar',()=>{setZoom(100);view.scrollTo(0,0);}));
 controls.querySelector('button').setAttribute('aria-label','Alejar fotografía');controls.querySelectorAll('button')[1].setAttribute('aria-label','Acercar fotografía');
 range.addEventListener('input',()=>setZoom(Number(range.value)));
 view.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();setZoom(level+(e.deltaY<0?10:-10));},{passive:false});
 view.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||level===100)return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:view.scrollLeft,top:view.scrollTop};view.setPointerCapture(e.pointerId);e.preventDefault();});
 view.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;view.scrollLeft=drag.left+drag.x-e.clientX;view.scrollTop=drag.top+drag.y-e.clientY;});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])view.addEventListener(name,()=>{drag=null;});
 view.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='='){e.preventDefault();setZoom(level+10);}if(e.key==='-'){e.preventDefault();setZoom(level-10);}if(e.key==='0'){e.preventDefault();setZoom(100);}});
 body.append(controls,el('p','Acercá con + o con Ctrl + rueda. Para recorrer la imagen usá las barras, las flechas o arrastrá con el ratón; en celular, deslizá con el dedo.','store-note'),view,el('p','Fotografía de referencia. La ampliación no modifica el archivo ni su resolución.','store-note'));dialog.append(header,body);document.body.append(dialog);
 const resize=typeof ResizeObserver==='function'?new ResizeObserver(()=>setZoom(level)):null;resize?.observe(view);
 dialog.addEventListener('keydown',e=>e.stopPropagation());dialog.addEventListener('close',()=>{resize?.disconnect();dialog.remove();if(previous?.isConnected)previous.focus({preventScroll:true});},{once:true});dialog.showModal();setZoom(100);close.focus();return true;
}
function mount({image,container,title,photos}){
 if(!image||!container||container.dataset.mcGallery)return;
 container.dataset.mcGallery='1';const list=C.photoList(photos?.[0],photos?.slice(1));if(!list.length)return;
 const actions=el('div',undefined,'product-photo-actions'),zoom=button('Acercar estampado',()=>openZoom(image,title));actions.append(zoom);container.append(actions);
 const thumbs=el('div',undefined,'mc-gallery-thumbs'),counter=el('p',undefined,'mc-gallery-counter');thumbs.setAttribute('role','group');thumbs.setAttribute('aria-label','Fotografías de '+title);
 let selected=0,request=0;const choices=[];
 const refresh=()=>{counter.textContent=list.length===1?'1 fotografía disponible':`Foto ${selected+1} de ${list.length}`;choices.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selected)));zoom.disabled=!image.naturalWidth||image.hidden;};
 async function choose(index){
  const token=++request,probe=new Image();probe.decoding='async';probe.src=list[index];
  try{await probe.decode();}catch{if(token===request&&container.isConnected){counter.textContent='Esta fotografía no está disponible. Elegí otra vista.';choices[index]?.setAttribute('disabled','');}return;}
  if(token!==request||!container.isConnected)return;selected=index;clearFallback(image);image.removeAttribute('srcset');image.removeAttribute('sizes');image.src=list[index];image.alt=title+' · foto '+(index+1);image.hidden=false;refresh();animatePhoto(image);
 }
 if(list.length>1){list.forEach((src,i)=>{const b=button('',()=>choose(i),'mc-gallery-thumb'),preview=el('img');preview.alt='';preview.loading='lazy';preview.decoding='async';preview.width=72;preview.height=72;preview.src=window.MomotusPhotoPreviews?.[src]||src;preview.addEventListener('error',()=>{preview.hidden=true;});b.setAttribute('aria-label','Ver foto '+(i+1)+' de '+title);b.append(preview,el('span','Foto '+(i+1)));choices.push(b);thumbs.append(b);});container.append(thumbs);}
 container.append(counter);image.addEventListener('load',refresh);image.addEventListener('error',()=>{zoom.disabled=true;});image.addEventListener('click',()=>openZoom(image,title));image.style.cursor='zoom-in';refresh();
}
window.MomotusGallery=Object.freeze({mount,openZoom});
})();
