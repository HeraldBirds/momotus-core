/* Movimiento decorativo acotado. Nunca cambia la geometría de los editores. */
(()=>{'use strict';const C=window.MomotusMotionCore;if(!C)return;
const root=document.documentElement,media=matchMedia('(prefers-reduced-motion: reduce)'),small=matchMedia('(max-width: 767px)'),connection=navigator.connection;
let preference='auto';try{if(localStorage.getItem('momotus-motion')==='off')preference='off';}catch{}
let reduced=false,frame=0,observer=null;const active=new Set(),tracked=new WeakSet(),watched=new Set(),revealed=new WeakSet(),animations=new Set();
const toggle=document.createElement('button');toggle.type='button';toggle.className='mc-motion-toggle';
function placeToggle(){const editor=document.querySelector('#mc-preferences>div')||document.querySelector('.designer-hero')||document.querySelector('.tools-mobile-notice>div')||document.querySelector('.tools-hero>div');if(editor){toggle.classList.add('mc-inline');if(toggle.parentElement!==editor)editor.append(toggle);}else if(!toggle.isConnected)document.body.append(toggle);}
placeToggle();
function enter(element,{duration=420,distance=14,delay=0}={}){if(!element?.animate||reduced||document.hidden)return;const a=element.animate([{opacity:.15,transform:`translateY(${distance}px)`},{opacity:1,transform:'translateY(0)'}],{duration,delay,easing:'cubic-bezier(.22,.61,.36,1)',fill:'none'});animations.add(a);a.finished.catch(()=>{}).finally(()=>animations.delete(a));return a;}
function resetScroll(element){element.style.removeProperty('transform');}
function draw(){frame=0;if(reduced||document.hidden)return;const viewport=innerHeight,updates=[];
 for(const element of active){if(!element.isConnected){active.delete(element);continue;}const r=element.getBoundingClientRect();const box=element.parentElement?.getBoundingClientRect()||r;if(box.bottom< -100||box.top>viewport+100)continue;
  const limit=element.hasAttribute('data-mc-scroll-image')?(small.matches?6:12):(small.matches?16:48),speed=small.matches?.08:.2;const y=C.parallax(box.top,box.height,viewport,speed,limit),scale=element.hasAttribute('data-mc-scroll-image')?.96+.04*C.easeOut(C.progress(box.top,viewport,600)):1.12;
  updates.push([element,`translate3d(0,${y.toFixed(2)}px,0) scale(${scale.toFixed(4)})`]);
 }
 for(const [element,transform]of updates)element.style.transform=transform;
}
function schedule(){if(!frame&&!reduced&&!document.hidden&&active.size)frame=requestAnimationFrame(draw);}
function reveal(element,index=0){if(revealed.has(element))return;revealed.add(element);enter(element,{delay:Math.min(index,4)*45});}
function observe(scope=document){
 for(const old of watched){if(!old.isConnected){observer?.unobserve(old);watched.delete(old);active.delete(old);}}
 for(const element of scope.querySelectorAll('[data-mc-reveal],.product-card,.seasonal-card,.benefit-card,.garment-card,.process-card')){
  if(tracked.has(element))continue;tracked.add(element);if(observer){watched.add(element);observer.observe(element);}else reveal(element);
 }
 for(const element of scope.querySelectorAll('[data-mc-parallax],[data-mc-scroll-image]')){if(tracked.has(element))continue;tracked.add(element);if(observer){watched.add(element);observer.observe(element);}else active.add(element);}
 schedule();
}
if('IntersectionObserver'in window)observer=new IntersectionObserver(entries=>{let i=0;for(const entry of entries){const element=entry.target,isScroll=element.matches('[data-mc-parallax],[data-mc-scroll-image]');if(entry.isIntersecting){if(isScroll)active.add(element);else{reveal(element,i++);observer.unobserve(element);watched.delete(element);}}else if(isScroll)active.delete(element);}schedule();},{rootMargin:'40px 0px',threshold:0});
function apply(){reduced=media.matches||preference==='off'||!!connection?.saveData;root.classList.toggle('mc-motion-reduced',reduced);toggle.textContent=reduced?'Movimiento reducido':'Movimiento suave';toggle.setAttribute('aria-pressed',String(reduced));toggle.setAttribute('aria-label',reduced?'Movimiento reducido. Activar movimiento si el dispositivo lo permite.':'Reducir movimiento de la página');toggle.title=media.matches?'Se respeta la preferencia de movimiento reducido de tu dispositivo.':connection?.saveData?'El ahorro de datos mantiene los efectos reducidos.':'Podés reducir las animaciones en cualquier momento.';
 if(reduced){if(frame)cancelAnimationFrame(frame);frame=0;for(const a of animations)a.cancel();for(const element of document.querySelectorAll('[data-mc-parallax],[data-mc-scroll-image]'))resetScroll(element);}else schedule();
 window.dispatchEvent(new CustomEvent('momotus:motion-change',{detail:{reduced}}));
}
toggle.addEventListener('click',()=>{preference=preference==='off'?'auto':'off';try{localStorage.setItem('momotus-motion',preference);}catch{}apply();});
media.addEventListener?.('change',apply);small.addEventListener?.('change',schedule);connection?.addEventListener?.('change',apply);
window.addEventListener('storage',event=>{if(event.key==='momotus-motion'){preference=event.newValue==='off'?'off':'auto';apply();}});
window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});
document.addEventListener('visibilitychange',()=>{root.classList.toggle('mc-page-hidden',document.hidden);if(document.hidden){for(const a of animations)a.cancel();if(frame)cancelAnimationFrame(frame);frame=0;}else schedule();});
const ambientObserver='IntersectionObserver'in window?new IntersectionObserver(entries=>{for(const entry of entries)entry.target.classList.toggle('mc-ambient-idle',!entry.isIntersecting);}):null;
function atmosphere(host){if(!host||host.querySelector('.mc-atmosphere'))return;const layer=document.createElement('div');layer.className='mc-atmosphere';layer.setAttribute('aria-hidden','true');for(let i=0;i<3;i++)layer.append(document.createElement('span'));host.prepend(layer);ambientObserver?.observe(layer);}
atmosphere(document.getElementById('inicio'));atmosphere(document.querySelector('.store-hero'));atmosphere(document.querySelector('.seasonal-heading'));
document.querySelectorAll('.mc-collection-visual').forEach(atmosphere);
const hero=document.getElementById('hero-bg');if(hero)hero.setAttribute('data-mc-parallax','');
function titleEntry(){const title=document.getElementById('hero-title'),subtitle=document.getElementById('hero-subtitle');enter(title,{duration:480,distance:12});enter(subtitle,{duration:480,distance:10,delay:70});}
const title=document.getElementById('hero-title');if(title){new MutationObserver(titleEntry).observe(title,{childList:true});titleEntry();}
function theme(category,season){root.dataset.mcTheme=category==='temporadas'||category==='aguizotes'?season||document.getElementById('seasonal-event')?.dataset.season||'aguizotes':category||'all';}
function enhanceCards(scope=document){
 const catalog=window.MomotusCatalog?.products||[];
 for(const card of scope.querySelectorAll('.product-card[data-product-id]')){
  if(card.dataset.mcPhotos)continue;card.dataset.mcPhotos='1';const product=catalog.find(p=>p.id===Number(card.dataset.productId)),image=card.querySelector('img');if(!product||!image)continue;
  const photos=C.photoList(product.img,product.images),host=image.parentElement;host.classList.add('mc-card-photos');
  if(photos.length<2)continue; // Una sola foto: el botón existente abre sus detalles.
  const alternate=document.createElement('img');alternate.className='mc-card-alternate';alternate.alt='';alternate.setAttribute('aria-hidden','true');alternate.decoding='async';alternate.width=320;alternate.height=320;alternate.loading='lazy';
  const control=document.createElement('button');control.type='button';control.className='mc-card-view';control.textContent='Otra vista';control.setAttribute('aria-label','Mostrar otra foto de '+product.baseName);control.setAttribute('aria-pressed','false');
  let available=false,loading=null,wanted=false;
  const paint=()=>{const showing=wanted&&available;host.classList.toggle('mc-other-view',showing);control.setAttribute('aria-pressed',String(showing));control.textContent=showing?'Foto principal':'Otra vista';control.setAttribute('aria-label',(showing?'Mostrar foto principal de ':'Mostrar otra foto de ')+product.baseName);};
  const load=()=>{if(loading)return loading;loading=(async()=>{for(const path of photos.slice(1)){const probe=new Image();probe.src=window.MomotusPhotoPreviews?.[path]||path;try{await probe.decode();if(!card.isConnected)return;alternate.src=probe.src;host.append(alternate);available=true;paint();return;}catch{}}control.remove();})();return loading;};
  control.addEventListener('click',e=>{e.stopPropagation();wanted=!wanted;load();paint();});
  host.addEventListener('pointerenter',e=>{if(e.pointerType!=='mouse'||!matchMedia('(hover:hover)').matches)return;wanted=true;load();paint();});host.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){wanted=false;paint();}});host.append(control);
 }
}
window.addEventListener('momotus:catalog-updated',event=>{const {category,season}=event.detail||{};if(category)theme(category,season);observe();enhanceCards();});
window.addEventListener('momotus:designer-view',event=>{const {label,element}=event.detail||{};const note=document.getElementById('mc-zone-label');if(note&&label)note.textContent='Estás editando: '+label;enter(element,{duration:220,distance:0});});
const tabs=document.querySelector('.mockup-tabs');if(tabs){const note=document.createElement('p');note.id='mc-zone-label';note.className='mc-zone-label';note.setAttribute('role','status');note.textContent='Estás editando: '+(tabs.querySelector('.tab-active')?.textContent.trim()||'Frente');tabs.after(note);}
const live=document.getElementById('mc-live-state');function status(){const output=document.getElementById('mc-live-state');if(!output)return;const text=output.textContent.toLowerCase();output.dataset.mcState=/procesando|cargando|preparando/.test(text)?'busy':/error|no se pudo|falló/.test(text)?'error':'ready';}
if(live){live.dataset.mcObserved='1';new MutationObserver(status).observe(live,{childList:true,characterData:true,subtree:true});status();}
for(const name of ['momotus:module-loaded','momotus:tool-selected','momotus:extra-tool'])window.addEventListener(name,()=>{placeToggle();observe();status();const output=document.getElementById('mc-live-state');if(output&&!output.dataset.mcObserved){output.dataset.mcObserved='1';new MutationObserver(status).observe(output,{childList:true,characterData:true,subtree:true});}});
document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b||b.disabled||b.classList.contains('sleeve-layer')||b.closest('.tool-preview,.sleeves-stage,.mc-zoom-viewport'))return; // Opacidad, sin mover controles ni superficies de trabajo.
 if(!reduced&&b.animate){const a=b.animate([{opacity:.65},{opacity:1}],{duration:160,easing:'ease-out'});animations.add(a);a.finished.catch(()=>{}).finally(()=>animations.delete(a));}
});
window.MomotusMotion=Object.freeze({enter,refresh:observe,isReduced:()=>reduced});apply();observe();enhanceCards();
if(typeof currentCategory==='string')theme(currentCategory);
window.addEventListener('load',()=>{observe();enhanceCards();schedule();},{once:true});
})();
