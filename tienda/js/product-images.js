/* Rutas de fotografías por categoría. No modifica los archivos de imagen. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MomotusProductImages=api;})(globalThis,()=>{
'use strict';
const topics=['musica','motor','cine-terror','streetwear','arte-tipografia','deportes'];
function design(id){
 if([1,2,3,32,33,34,35,36].includes(id))return {category:'fauna'};
 if(id===4||(id>=26&&id<=31))return {category:'unica'};
 if(id>=5&&id<=14)return {category:'anime'};
 if(id>=20&&id<=25)return {category:'games'};
 const existing={15:'motor',16:'streetwear',17:'musica',18:'cine-terror',19:'streetwear'};
 const topic=existing[id]||(id>=37&&id<=48?topics[Math.floor((id-37)/2)]:id>=49&&id<=78?topics[Math.floor((id-49)/5)]:id>=79&&id<=108?topics[Math.floor((id-79)/5)]:null);
 return topic?{category:'urbano',subcategory:topic}:null;
}
const folder=product=>`img/products/${product.category}${product.category==='urbano'?'/'+(product.subcategory||design(product.id)?.subcategory||'streetwear'):''}`;
function legacy(path){
 if(typeof path!=='string')return path;
 const variant=path.match(/^img\/products\/(previews\/)?variants\/(\d+)-(hoodie|sudadera|crop-top)\.webp$/);
 if(variant){const product=design(Number(variant[2]));return product?`${folder(product)}/${variant[1]?'previews/':''}variants/${variant[2]}-${variant[3]}.webp`:path;}
 const photo=path.match(/^img\/products\/(previews\/)?(nica|anime|urbano|game|unica|fauna)-(\d+)\.webp$/);
 if(photo){const n=Number(photo[3]),id=photo[2]==='nica'?n:photo[2]==='anime'?n+4:photo[2]==='game'?n+19:photo[2]==='unica'?n+25:photo[2]==='urbano'&&n<=5?n+14:n,product=design(id);return product?`${folder(product)}/${photo[1]?'previews/':''}${photo[2]}-${n}.webp`:path;}
 return path.replace(/^img\/products\/seasonal\//,'img/products/aguizotes/').replace('img/products/aguizotes/navidad-2026/','img/products/navidad/navidad-2026/');
}
return Object.freeze({folder,legacy,design});
});
