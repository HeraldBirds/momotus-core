'use strict';
importScripts('tools-color-zones-core.js?v=20261021-color-polish-1');
self.onmessage=e=>{
 const {task,payload:p}=e.data;
 try{
  const C=self.MomotusColorZonesCore,data=new Uint8ClampedArray(p.data),base=new Uint8Array(p.alpha),allowed=new Uint8Array(p.allowed),protect=new Uint8Array(p.protect);
  if(task==='analyze'){
   const r=C.analyze(data,p.width,p.height,p.options,base,allowed,protect,value=>self.postMessage({type:'progress',value}));
   self.postMessage({type:'result',result:{...r,labels:r.labels.buffer}},[r.labels.buffer]);
  }else if(task==='preview'){
   const selected=new Uint8Array(p.selected),r=C.preview(data,p.width,p.height,p.options,base,selected,allowed,protect),working=p.working?new Uint8ClampedArray(p.working):data;
   const original=base;
   r.alpha=C.finishAlpha(r.alpha,original,p.width,p.height,p.options.finish||'preserve',p.options.threshold??128,p.options.cell??1,allowed,protect);
   r.affected=0;r.partial=0;for(let i=0;i<base.length;i++){if(r.alpha[i]<base[i])r.affected++;if(r.alpha[i]>0&&r.alpha[i]<255)r.partial++;}
   const rgba=p.options.halo?C.cleanHalo(working,p.width,p.height,base,r.alpha,selected,allowed,protect,p.options):null;
   self.postMessage({type:'result',result:{...r,alpha:r.alpha.buffer,rgba:rgba?.buffer||null}},[r.alpha.buffer,...(rgba?[rgba.buffer]:[])]);
  }else if(task==='inspect'){
   const r=C.inspectAlpha(base,p.width,p.height,p.options.islandMax??4,allowed,protect);
   self.postMessage({type:'result',result:{...r,flags:r.flags.buffer}},[r.flags.buffer]);
  }else if(task==='grow'||task==='shrink'){
   const mask=C.morph(new Uint8Array(p.selected),p.width,p.height,p.radius,task,allowed,protect);
   self.postMessage({type:'result',result:{selected:mask.buffer}},[mask.buffer]);
  }else throw Error('Operación desconocida.');
 }catch(error){self.postMessage({type:'error',message:error.message});}
};
