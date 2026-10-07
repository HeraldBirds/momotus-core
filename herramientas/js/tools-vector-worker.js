'use strict';
importScripts('tools-vector-core.js'+self.location.search);
self.onmessage=event=>{try{const {labels,palette,width,height,widthCm,options}=event.data;self.postMessage({result:self.MomotusVectorCore.build(new Int16Array(labels),palette,width,height,widthCm,options)});}catch(error){self.postMessage({error:error.message||'No se pudo trazar el SVG.'});}};
