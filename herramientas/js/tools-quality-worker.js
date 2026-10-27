'use strict';
importScripts('tools-quality-core.js'+self.location.search);
self.onmessage=async e=>{try{const p=e.data;p.data=new Uint8ClampedArray(p.data);const r=await self.MomotusQuality.render(p,()=>Promise.resolve(),()=>false,value=>self.postMessage({type:'progress',value}));self.postMessage({type:'result',result:{...r,data:r.data.buffer}},[r.data.buffer]);}catch(e){self.postMessage({type:'error',message:e.message});}};
