(function(root){
 'use strict';
 const valid=n=>Number.isFinite(n)&&n>0;
 function output(naturalWidth,naturalHeight,widthCm,dpi=300,side=Infinity,pixels=Infinity){
  if(![naturalWidth,naturalHeight,widthCm,dpi].every(valid))throw Error('Medidas de impresión no válidas.');
  const w=Math.round(widthCm/2.54*dpi),h=Math.round(w*naturalHeight/naturalWidth),scale=Math.min(1,side/Math.max(w,h),Math.sqrt(pixels/(w*h)));
  const pixelWidth=Math.max(1,Math.round(w*scale)),pixelHeight=Math.max(1,Math.round(h*scale));
  return {widthCm:pixelWidth/dpi*2.54,heightCm:pixelHeight/dpi*2.54,pixelWidth,pixelHeight,limited:scale<1};
 }
 function position(client,origin,displayLength,physicalLength){if(!valid(displayLength)||!valid(physicalLength))return NaN;return (client-origin)/displayLength*physicalLength;}
 function screen(cm,origin,displayLength,physicalLength){return origin+cm/physicalLength*displayLength;}
 function snap(value,anchors,tolerance,maximum){const nearest=anchors.reduce((best,n)=>Math.abs(value-n)<Math.abs(value-best)?n:best,value+tolerance*2);return Math.max(0,Math.min(maximum,Math.abs(value-nearest)<=tolerance?nearest:value));}
 function validateMeasure(d){if(!d||!valid(d.widthCm)||!valid(d.heightCm)||d.widthCm>300||d.heightCm>300||!Number.isInteger(d.quantity)||d.quantity<1||d.quantity>1000)throw Error('Revisá las medidas (hasta 300 cm) y la cantidad entera (1–1000).');return {widthCm:d.widthCm,heightCm:d.heightCm,quantity:d.quantity,label:String(d.label||'Diseño').slice(0,100)};}
 const api=Object.freeze({output,position,screen,snap,validateMeasure});if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MomotusPrecisionCore=api;
})(typeof window!=='undefined'?window:globalThis);
