'use strict';
importScripts('tools-halftone-core.js'+self.location.search);
let histogram=null,paletteWidth=0,paletteHeight=0,paletteRow=0,paletteDetail=16;
self.onmessage=async e=>{try{
 const p=e.data,H=self.MomotusHalftone;
 if(p.task==='palette-start'){
  if(!Number.isInteger(p.width)||!Number.isInteger(p.height)||p.width<1||p.height<1||p.width*p.height>100000000||Math.max(p.width,p.height)>16384||![8,16,32].includes(p.detail))throw Error('Original de paleta inválido.');
  histogram=H.paletteHistogram();paletteWidth=p.width;paletteHeight=p.height;paletteRow=0;paletteDetail=p.detail;self.postMessage({type:'palette-next',row:0});return;
 }
 if(p.task==='palette-tile'){
  if(!histogram||p.width!==paletteWidth||p.y!==paletteRow||!Number.isInteger(p.height)||p.height<1||p.height*paletteWidth>1048576||p.height+paletteRow>paletteHeight||!(p.data instanceof ArrayBuffer)||p.data.byteLength!==paletteWidth*p.height*4)throw Error('Bloque de paleta inválido.');
  H.paletteAccumulate(histogram,new Uint8ClampedArray(p.data));paletteRow+=p.height;self.postMessage({type:'progress',value:Math.round(paletteRow/paletteHeight*100)});
  self.postMessage(paletteRow===paletteHeight?{type:'palette',colors:H.paletteFromHistogram(histogram,paletteDetail)}:{type:'palette-next',row:paletteRow});return;
 }
 if(p.task==='palette-detail'){if(!histogram||paletteRow!==paletteHeight)throw Error('Volvé a analizar el diseño.');self.postMessage({type:'palette',colors:H.paletteFromHistogram(histogram,p.detail)});return;}
 p.data=new Uint8ClampedArray(p.data);if(p.manual)for(const key of ['apply','protect'])if(p.manual[key])p.manual[key]=new Uint8Array(p.manual[key]);
 const r=await H.render(p,null,()=>Promise.resolve(),()=>false,value=>self.postMessage({type:'progress',value}));self.postMessage({type:'result',result:{...r,data:r.data.buffer}},[r.data.buffer]);
}catch(e){self.postMessage({type:'error',message:e.message});}};
