/* Matemática compartida de presentación; no procesa archivos de impresión. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MomotusMotionCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number.isFinite(value)?value:min));
const easeOut=value=>1-Math.pow(1-clamp(value,0,1),3);
function progress(top,viewport,distance=600){return clamp((viewport-top)/Math.max(1,distance),0,1);}
function parallax(top,height,viewport,speed=.2,limit=48){return clamp((viewport/2-top-height/2)*clamp(speed,0,.2),-limit,limit);}
function photoList(primary,additional=[]){return [...new Set([primary,...(Array.isArray(additional)?additional:[])].filter(src=>typeof src==='string'&&/^img\/[a-z0-9_./-]+\.(?:webp|png|jpe?g)$/i.test(src)&&!src.includes('..')))];}
return Object.freeze({clamp,easeOut,progress,parallax,photoList});
});
