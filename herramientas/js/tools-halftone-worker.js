'use strict';
importScripts('tools-halftone-core.js'+self.location.search);
self.onmessage=async e=>{try{const p=e.data;p.data=new Uint8ClampedArray(p.data);if(p.manual)for(const key of ['apply','protect'])if(p.manual[key])p.manual[key]=new Uint8Array(p.manual[key]);const r=await self.MomotusHalftone.render(p,null,()=>Promise.resolve(),()=>false,value=>self.postMessage({type:'progress',value}));self.postMessage({type:'result',result:{...r,data:r.data.buffer}},[r.data.buffer]);}catch(e){self.postMessage({type:'error',message:e.message});}};
