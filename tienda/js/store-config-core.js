/* Configuración pública del catálogo: sin acceso a los motores de imagen. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MomotusStoreConfigCore=api;})(globalThis,()=>{
'use strict';
const imagePaths=globalThis.MomotusProductImages||(typeof require==='function'?require('./product-images.js'):null);
const blank=()=>({version:1,products:{},categories:{},sizeGuides:{},gallery:[],reviews:[],newProducts:[],leadTime:''});
const text=(value,max=160)=>{if(typeof value!=='string'||value.length>max||/[<>"]/.test(value))throw Error('Usá texto simple sin etiquetas HTML ni comillas dobles.');return value;};
const image=value=>{if(typeof value!=='string'||!/^img\/[a-z0-9/_-]+\.(webp|png|jpe?g)$/i.test(value))throw Error('La imagen debe tener una ruta local dentro de img/.');return value;};
function validate(data){
 if(!data||data.version!==1||!data.products||Array.isArray(data.products)||typeof data.products!=='object'||[data.categories,data.sizeGuides].some(v=>v!==undefined&&(!v||Array.isArray(v)||typeof v!=='object')))throw Error('Configuración no compatible.');
 for(const [id,p]of Object.entries(data.products)){
  if(!/^\d+$/.test(id)||!p||typeof p!=='object')throw Error('Producto inválido.');
  if(p.price!==undefined&&(!Number.isFinite(p.price)||p.price<=0))throw Error('Precio inválido.');
  for(const k of ['name','description','leadTime'])if(p[k]!==undefined)text(p[k],k==='description'?800:160);
  if(p.category!==undefined&&!/^[a-z][a-z0-9-]{0,30}$/.test(p.category))throw Error('Categoría inválida.');
  if(p.subcategory!==undefined&&!['musica','motor','cine-terror','streetwear','arte-tipografia','deportes'].includes(p.subcategory))throw Error('Tema urbano inválido.');
  for(const k of ['published','featured'])if(p[k]!==undefined&&typeof p[k]!=='boolean')throw Error('Estado inválido.');
  if(p.stock!==undefined){if(!p.stock||Object.keys(p.stock).some(k=>!['S','M','L'].includes(k)||!Number.isInteger(p.stock[k])||p.stock[k]<0))throw Error('Stock inválido.');}
  if(p.img!==undefined)image(p.img);
  if(p.images!==undefined){if(!Array.isArray(p.images)||p.images.length>6)throw Error('Máximo seis fotos por producto.');p.images.forEach(image);}
 }
 const categories=new Set(['fauna','anime','urbano','games','unica',...Object.keys(data.categories||{})]);
 for(const p of Object.values(data.products))if(p.category&&!categories.has(p.category))throw Error('La categoría del producto no existe.');
 if(!Array.isArray(data.newProducts||[])||(data.newProducts||[]).length>100)throw Error('Máximo 100 productos adicionales.');
 const addedIds=new Set();
 for(const p of data.newProducts||[]){if(!Number.isInteger(p.id)||p.id<4000||addedIds.has(p.id))throw Error('El ID nuevo debe ser único y de 4000 en adelante.');addedIds.add(p.id);if(!p.name?.trim())throw Error('Escribí el nombre del producto.');text(p.name,160);image(p.img);for(const k of ['published','featured'])if(p[k]!==undefined&&typeof p[k]!=='boolean')throw Error('Estado del nuevo producto inválido.');for(const k of ['description','leadTime'])if(p[k]!==undefined)text(p[k],k==='description'?800:160);if(p.images!==undefined){if(!Array.isArray(p.images)||p.images.length>6)throw Error('Máximo seis fotos.');p.images.forEach(image);}if(p.subcategory!==undefined&&!['musica','motor','cine-terror','streetwear','arte-tipografia','deportes'].includes(p.subcategory))throw Error('Tema urbano inválido.');if(!Number.isFinite(p.price)||p.price<=0||!['camiseta','hoodie','sudadera','crop-top'].includes(p.garment)||!categories.has(p.category)||!p.stock||Object.keys(p.stock).length===0||Object.entries(p.stock).some(([k,v])=>!['S','M','L'].includes(k)||!Number.isInteger(v)||v<0))throw Error('Datos del nuevo producto inválidos.');}
 for(const [key,value]of Object.entries(data.categories||{})){if(!/^[a-z][a-z0-9-]{0,30}$/.test(key)||['all','aguizotes'].includes(key))throw Error('Clave de categoría inválida.');text(value,40);}
 for(const [garment,rows]of Object.entries(data.sizeGuides||{})){if(!['camiseta','hoodie','sudadera','crop-top'].includes(garment)||!Array.isArray(rows)||rows.length>3)throw Error('Guía inválida.');const seen=new Set();for(const r of rows){if(!['S','M','L'].includes(r.size)||seen.has(r.size)||![r.widthCm,r.lengthCm].every(v=>Number.isFinite(v)&&v>0&&v<=200))throw Error('Medidas de talla inválidas.');seen.add(r.size);}}
 if(!Array.isArray(data.gallery||[])||(data.gallery||[]).length>40||!Array.isArray(data.reviews||[])||(data.reviews||[]).length>40)throw Error('Máximo 40 trabajos u opiniones.');
 for(const g of data.gallery||[]){text(g.title,100);image(g.image);if(typeof g.consent!=='boolean')throw Error('Indicá el permiso de publicación.');}
 for(const r of data.reviews||[]){text(r.name,60);text(r.text,500);if(typeof r.consent!=='boolean'||typeof r.verified!=='boolean')throw Error('Verificación de opinión inválida.');}
 if(data.leadTime!==undefined)text(data.leadTime,160);
 return true;
}
function apply(products,data){validate(data);const all=[...products,...(data.newProducts||[]).map(p=>({...p,baseDesignId:p.id,baseName:p.name,name:p.name+' — '+({camiseta:'Camiseta',hoodie:'Hoodie',sudadera:'Sudadera','crop-top':'Crop-top'})[p.garment],garmentName:({camiseta:'Camiseta',hoodie:'Hoodie',sudadera:'Sudadera','crop-top':'Crop-top'})[p.garment],sizes:Object.keys(p.stock),fallbackImg:''}))];if(new Set(all.map(p=>p.id)).size!==all.length)throw Error('ID de producto repetido.');return all.map(product=>{const p=data.products[product.id];if(!p)return {...product,img:imagePaths.legacy(product.img),...(product.images?{images:product.images.map(imagePaths.legacy)}:{})};const out={...product};for(const k of ['price','img','category','subcategory','published','featured','description','leadTime','images'])if(p[k]!==undefined)out[k]=p[k];if(p.name){out.baseName=p.name;out.name=`${p.name} — ${product.garmentName}`;}if(p.stock){out.stock={...product.stock,...p.stock};out.sizes=Object.keys(out.stock);}if(out.category==='urbano')out.subcategory=out.subcategory||'streetwear';else delete out.subcategory;out.img=imagePaths.legacy(out.img);if(out.images)out.images=out.images.map(imagePaths.legacy);return out;});}
return Object.freeze({blank,validate,apply});
});
