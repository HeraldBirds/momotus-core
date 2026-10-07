'use strict';
importScripts(`tools-effects-core.js${self.location.search}`);
self.onmessage = event => {
  const {pixels,width,height,options,layers,region}=event.data;
  try {
    const source=new Uint8ClampedArray(pixels),core=self.MomotusEffectsCore;
    const result=layers?core.renderStack(source,width,height,options,layers.map(layer=>({...layer,mask:layer.mask?new Uint8ClampedArray(layer.mask):null}))):core.render(source,width,height,options,region);
    if(region?.mask)core.blendMask(source,result,new Uint8ClampedArray(region.mask));
    self.postMessage({pixels:result.buffer},[result.buffer]);
  }catch(error){self.postMessage({error:error.message});}
};
