'use strict';
importScripts(`tools-halftone-core.js${self.location.search}`,`tools-effects-edit-core.js${self.location.search}`,`tools-effects-core.js${self.location.search}`);
self.onmessage = event => {
  const {pixels,width,height,options,layers,region}=event.data;
  if(event.data.background){try{const mask=self.MomotusEffectsEdit.backgroundMask(new Uint8ClampedArray(pixels),width,height,options.background,options.tolerance,true);self.postMessage({mask:mask.buffer},[mask.buffer]);}catch(e){self.postMessage({error:e.message});}return;}
  try {
    const source=new Uint8ClampedArray(pixels),core=self.MomotusEffectsCore;
    // La salida grande se almacena en Canvas entre zonas. Reproducir ese paso
    // también en la vista rápida evita divergencias de alfa premultiplicado.
    if(layers&&typeof OffscreenCanvas!=='undefined'){
      let canvas=null,ctx=null;
      options.roundTrip=(rgba,w,h)=>{if(!canvas){canvas=new OffscreenCanvas(w,h);ctx=canvas.getContext('2d',{willReadFrequently:false});}ctx.putImageData(new ImageData(rgba,w,h),0,0);return ctx.getImageData(0,0,w,h).data;};
    }
    const result=layers?core.renderStack(source,width,height,options,layers.map(layer=>({...layer,mask:layer.mask?new Uint8ClampedArray(layer.mask):null}))):core.render(source,width,height,options,region);
    if(region?.layer)core.blendLayer(source,result,region.mask?new Uint8ClampedArray(region.mask):null,options);
    self.postMessage({pixels:result.buffer},[result.buffer]);
  }catch(error){self.postMessage({error:error.message});}
};
