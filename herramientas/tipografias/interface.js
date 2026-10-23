/* UI composition only: rendering and production export stay in app.js/core.js. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 if(new URLSearchParams(location.search).get('integrado')==='1'&&window.parent!==window)document.body.classList.add('embedded');
 function activate(button,focus=false){
  const tabs=button.closest('.inspector-tabs');
  for(const tab of tabs.querySelectorAll('[role=tab]')){
   const selected=tab===button;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;$(tab.getAttribute('aria-controls')).hidden=!selected;
  }
  if(focus)button.focus();
 }
 for(const tabs of document.querySelectorAll('.inspector-tabs')){
  for(const button of tabs.querySelectorAll('button')){button.tabIndex=button.getAttribute('aria-selected')==='true'?0:-1;button.onclick=()=>activate(button);}
  tabs.addEventListener('keydown',event=>{
   const buttons=[...tabs.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);
   if(index<0)return;
   let next;if(event.key==='ArrowRight')next=(index+1)%buttons.length;else if(event.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;else return;
   event.preventDefault();activate(buttons[next],true);
  });
 }
 $('export-open').onclick=()=>{activate($('tab-export'));$('pane-export').scrollIntoView({block:'nearest'});$('alpha').focus();};
 const references=window.MomotusTypeReferences||[],names=[...new Set(references.map(r=>r.category))];
 for(const name of names)$('reference-category').append(new Option(name,name));
 function gallery(){
  const category=$('reference-category').value,fragment=document.createDocumentFragment();
  references.forEach((r,index)=>{
   if(category!=='all'&&r.category!==category)return;
   const card=document.createElement('article');card.className='reference-card';
   const img=document.createElement('img');img.src=r.file;img.loading='lazy';img.decoding='async';img.alt=`Referencia ${index+1} · ${r.category}`;img.width=400;img.height=260;
   const caption=document.createElement('p');caption.textContent=`${String(index+1).padStart(2,'0')} · ${r.category}`;
   const action=document.createElement('button');action.type='button';action.textContent='Usar estilo afín';action.onclick=()=>{$('preset').value=r.preset;$('references').close();$('apply-preset').click();};
   card.append(img,caption,action);fragment.append(card);
  });
  $('reference-grid').replaceChildren(fragment);
 }
 $('references-open').onclick=()=>{gallery();$('references').showModal();};$('reference-category').onchange=gallery;$('references-close').onclick=()=>$('references').close();
})();
