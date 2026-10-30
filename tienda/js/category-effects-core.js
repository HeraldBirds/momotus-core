/* Temas decorativos del catálogo; no modifica productos ni filtros. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MomotusCategoryEffectsCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const themes={
 fauna:{label:'FAUNA NICA',title:'Naturaleza que llevás con vos',description:'Aves, colores y detalles de nuestra tierra.',accent:'#86efac',secondary:'#fbbf24',motif:'bird',particles:{bird:2,leaf:3,firefly:4}},
 anime:{label:'ANIME',title:'Historias con toda la energía',description:'Tinta, movimiento y estilo para tu próxima prenda.',accent:'#c4b5fd',secondary:'#f472b6',motif:'ink',particles:{stroke:3,spark:4}},
 games:{label:'GAMES',title:'Tu estilo sube de nivel',description:'Un universo de píxeles, luces y nuevas partidas.',accent:'#67e8f9',secondary:'#a78bfa',motif:'controller',particles:{pixel:8}},
 urbano:{label:'URBANAS',title:'La calle también tiene tu voz',description:'Encontrá el ritmo, el arte y la actitud que van con vos.',accent:'#fbbf24',secondary:'#fb7185',motif:'graffiti',particles:{stroke:4,spark:3}}
};
const urban={
 musica:{label:'MÚSICA',title:'Llevá tu propio ritmo',description:'Discos, notas y energía de escenario.',accent:'#c4b5fd',secondary:'#f472b6',motif:'vinyl',particles:{note:4}},
 motor:{label:'MOTOR',title:'Diseños con espíritu de ruta',description:'Líneas de velocidad y pasión por los motores.',accent:'#fb923c',secondary:'#fbbf24',motif:'wheel',particles:{speed:5}},
 'cine-terror':{label:'CINE Y TERROR',title:'Una escena para llevar puesta',description:'Sombras, niebla y el misterio de una buena historia.',accent:'#d8b4fe',secondary:'#fb7185',motif:'film',particles:{mist:4,spark:2}},
 streetwear:{label:'STREETWEAR',title:'Tu identidad, sin etiquetas',description:'Trazos de grafiti y actitud de ciudad.',accent:'#fbbf24',secondary:'#f472b6',motif:'graffiti',particles:{stroke:4,spark:3}},
 'arte-tipografia':{label:'ARTE Y TIPOGRAFÍA',title:'Tu voz, en cada trazo',description:'Letras, formas y color para expresarte a tu manera.',accent:'#f9a8d4',secondary:'#67e8f9',motif:'type',particles:{swatch:4,stroke:2}},
 deportes:{label:'DEPORTES',title:'El estilo también se juega',description:'Movimiento, equipo y energía dentro y fuera de la cancha.',accent:'#86efac',secondary:'#38bdf8',motif:'ball',particles:{arc:4,spark:3}}
};
function resolve(category,subcategory='all',compact=false){
 if(typeof category!=='string'||!Object.hasOwn(themes,category))return null;
 const specific=category==='urbano'&&typeof subcategory==='string'&&Object.hasOwn(urban,subcategory),base=specific?urban[subcategory]:themes[category];
 const particles=[];for(const [type,count]of Object.entries(base.particles)){const n=compact?Math.max(1,Math.ceil(count*.5)):count;for(let i=0;i<n;i++)particles.push(type);}
 return {key:specific?'urbano-'+subcategory:category,label:base.label,title:base.title,description:base.description,accent:base.accent,secondary:base.secondary,motif:base.motif,particles};
}
function mode({visible=true,hidden=false,reduced=false}={}){return hidden||!visible?'paused':reduced?'still':'running';}
return Object.freeze({resolve,mode});
});
