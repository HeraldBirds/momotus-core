/* Selección editorial equilibrada, independiente de ventas y stock. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MomotusStoreSelection=api;})(globalThis,()=>{
'use strict';
function groups(products,categories,limit=2){
 const output=[];
 for(const category of Object.keys(categories)){
  const candidates=products.filter(p=>p.category===category&&p.published!==false);
  // Un diseño por tarjeta, aunque se hayan seleccionado todas las prendas.
  const ranked=[...candidates].sort((a,b)=>Number(b.featured===true)-Number(a.featured===true));
  const seen=new Set(),items=[];
  for(const p of ranked){const id=p.baseDesignId??p.id;if(seen.has(id))continue;seen.add(id);items.push(p);if(items.length===limit)break;}
  if(items.length)output.push({category,label:categories[category],products:items});
 }
 return output;
}
function slots(products,topic,garment='camiseta'){
 const order=['camiseta','hoodie','sudadera','crop-top'];
 return products.filter(p=>p.baseDesignId>=79&&p.baseDesignId<=108&&p.category==='urbano'&&p.subcategory===topic&&p.published===false&&(garment==='all'?order.includes(p.garment):p.garment===garment)).filter((p,i,a)=>a.findIndex(x=>x.baseDesignId===p.baseDesignId)===i).slice(0,5);
}
return Object.freeze({groups,slots});
});
