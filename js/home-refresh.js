(() => {
'use strict';
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
const localImage=p=>typeof p==='string'&&/^img\/(?:[a-z0-9_-]+\/)*[a-z0-9_-]+\.(?:webp|png|jpe?g)$/i.test(p);
function photo(path,caption){const f=el('figure'),img=el('img');img.src=path;img.alt=caption;img.width=900;img.height=900;img.loading='lazy';img.decoding='async';f.append(img,el('figcaption',caption));return f;}
function init(){
 if(!$('home-products-grid'))return;
 const catalog=window.MomotusCatalog,groups=window.MomotusStoreSelection.groups(catalog.products.filter(p=>p.garment==='camiseta'),categoryLabels,2),selected=[];
 for(let position=0;position<2;position++)for(const group of groups)if(group.products[position]&&selected.length<6)selected.push(group.products[position]);
 renderProducts(selected,$('home-products-grid'));
 $('home-products-grid').querySelectorAll('img').forEach(img=>{const preview=window.MomotusPhotoPreviews?.[img.getAttribute('src')];if(preview){img.srcset=`${preview} 512w, ${img.getAttribute('src')} 1024w`;img.sizes='(max-width:640px) 46vw, 400px';}});
 const works=(catalog.settings.gallery||[]).filter(g=>g.consent===true&&localImage(g.image)).slice(0,6);
 if(works.length){$('home-print-title').textContent='Así quedan los trabajos';$('home-print-description').textContent='Una selección de prendas y estampados compartidos con autorización.';$('home-mockup-detail').hidden=true;const grid=$('home-real-gallery');grid.className='home-real-gallery';works.forEach(g=>grid.append(photo(g.image,g.title)));}
 const comparisons=(window.MomotusHomeContent?.comparisons||[]).filter(c=>c.consent===true&&localImage(c.designImage)&&localImage(c.printedImage)).slice(0,3);
 if(comparisons.length){const region=$('home-print-comparisons');region.append(el('h3','Del diseño a la prenda','home-section-title'));comparisons.forEach(c=>{const item=el('article',undefined,'home-print-comparison');item.append(el('h4',c.title||'Trabajo personalizado'));const pair=el('div',undefined,'home-comparison-pair');pair.append(photo(c.designImage,'Diseño original'),photo(c.printedImage,'Prenda terminada'));item.append(pair);region.append(item);});}
 const zoom=$('home-detail-zoom'),update=()=>{$('home-detail-image').style.transform=`scale(${Number(zoom.value)/100})`;$('home-detail-value').textContent=zoom.value+'%';};zoom.addEventListener('input',update);$('home-detail-reset').addEventListener('click',()=>{zoom.value='100';update();});$('home-detail-product').addEventListener('click',()=>showQuickView(17));update();
 // Hover movement is limited to fine pointers and disabled for reduced motion.
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 document.querySelectorAll('.home-collection').forEach(card=>{card.addEventListener('pointermove',event=>{if(media.matches||event.pointerType!=='mouse')return;const box=card.getBoundingClientRect();card.style.setProperty('--pointer-x',`${(event.clientX-box.left)/box.width*100}%`);card.style.setProperty('--pointer-y',`${(event.clientY-box.top)/box.height*100}%`);});});
}
if(document.readyState==='complete')init();else window.addEventListener('load',init,{once:true});
})();
