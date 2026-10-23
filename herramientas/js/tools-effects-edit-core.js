/* Edición de Efectos: unidades físicas, validación y proyectos portátiles. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MomotusEffectsEdit=api;})(globalThis,()=>{
'use strict';
const schema={
 threadWidth:[.1,2,1,'Grosor del hilo','satin tatami'],stitchLength:[1,12,5,'Longitud de puntada (× escala)','satin tatami'],density:[.25,4,1,'Densidad','satin tatami chenille glitter'],loopSize:[.25,3,1,'Tamaño del bucle','chenille'],
 depth:[0,2,1,'Profundidad visual','puff'],softness:[.2,2,1,'Suavidad del relieve','puff'],lightAngle:[-180,180,45,'Dirección de luz (°)','puff'],shine:[0,2,1,'Brillo','metal glitter'],roughness:[0,1,.35,'Rugosidad','metal'],reflection:[.2,4,1,'Amplitud del reflejo','metal'],particleSize:[.2,3,1,'Tamaño de partícula','glitter'],wearSize:[.2,4,1,'Tamaño del desgaste','vintage'],wearCoverage:[0,1,.24,'Cobertura de desgaste','vintage'],seed:[0,999999,0,'Semilla de textura','vintage glitter chenille'],
 frequency:[10,120,50,'Frecuencia (LPI)','halftone'],minimumDot:[0,.6,.05,'Punto mínimo (mm)','halftone'],maximumDot:[.05,2,.5,'Punto máximo (mm)','halftone'],gap:[0,1,0,'Separación mínima (mm)','halftone'],gain:[-.2,.2,0,'Compensación tonal','halftone'],
 colorPreserve:[0,1,0,'Conservar tono y saturación','satin tatami chenille puff metal glitter'],opacity:[0,100,100,'Opacidad de zona (%)','all']
};
const defaults=()=>Object.fromEntries(Object.entries(schema).map(([key,s])=>[key,s[2]]));
function validate(options){if(!options||typeof options!=='object')throw Error('Ajustes no válidos.');for(const [k,s]of Object.entries(schema))if(options[k]!==undefined&&(!Number.isFinite(options[k])||options[k]<s[0]||options[k]>s[1]||(k==='seed'&&!Number.isInteger(options[k]))))throw Error('Revisá '+s[3]+'.');if(options.minimumDot!==undefined&&options.maximumDot!==undefined&&options.minimumDot>options.maximumDot)throw Error('El punto mínimo supera el máximo.');if(options.blend!==undefined&&!['normal','multiply','screen','overlay'].includes(options.blend))throw Error('Modo de mezcla no válido.');if(options.alphaMode!==undefined&&!['effect','preserve'].includes(options.alphaMode))throw Error('Transparencia de zona no válida.');if(options.targets!==undefined&&(!Array.isArray(options.targets)||options.targets.length>8||options.targets.some(x=>!/^#[\da-f]{6}$/i.test(x))))throw Error('Seleccioná hasta ocho colores válidos.');return true;}
function brushDiameter(value,unit,maskWidth,outputWidth,widthCm){if(!Number.isFinite(value)||value<=0)throw Error('El diámetro debe ser positivo.');return value*(unit==='mm'?maskWidth/(widthCm*10):unit==='px'?maskWidth/outputWidth:maskWidth/100);}
function backgroundMask(data,w,h,color,tolerance,exterior=true){
 if(data.length!==w*h*4)throw Error('Imagen no válida.');const c=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)),mask=new Uint8ClampedArray(w*h),matches=k=>!data[k*4+3]||Math.max(Math.abs(data[k*4]-c[0]),Math.abs(data[k*4+1]-c[1]),Math.abs(data[k*4+2]-c[2]))<=tolerance;
 if(!exterior){for(let k=0;k<mask.length;k++)if(matches(k))mask[k]=255;return mask;}
 // Cola acotada a un índice por píxel. Cada píxel se visita una sola vez.
 const queue=new Uint32Array(w*h);let head=0,tail=0;const add=k=>{if(!mask[k]&&matches(k)){mask[k]=255;queue[tail++]=k;}};
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x);}for(let y=1;y<h-1;y++){add(y*w);add(y*w+w-1);}
 while(head<tail){const k=queue[head++],x=k%w;if(x)add(k-1);if(x<w-1)add(k+1);if(k>=w)add(k-w);if(k+w<mask.length)add(k+w);}return mask;
}
const crcTable=Uint32Array.from({length:256},(_,n)=>{let c=n;for(let j=0;j<8;j++)c=(c>>>1)^((c&1)?0xedb88320:0);return c>>>0;});
function checksum(bytes){let c=0xffffffff;for(const b of bytes)c=(c>>>8)^crcTable[(c^b)&255];return(c^0xffffffff)>>>0;}
function pack(data){const payload=JSON.stringify(data);return JSON.stringify({container:'momotus-effects',version:1,crc:checksum(new TextEncoder().encode(payload)),payload});}
function unpack(text){if(typeof text!=='string'||text.length>128*1024*1024)throw Error('El proyecto supera 128 MB.');const p=JSON.parse(text);if(p.container!=='momotus-effects')return p;if(p.version!==1||typeof p.payload!=='string'||checksum(new TextEncoder().encode(p.payload))!==p.crc)throw Error('Proyecto incompleto o alterado: no coincide su comprobación de integridad.');return JSON.parse(p.payload);}
return Object.freeze({schema,defaults,validate,brushDiameter,backgroundMask,pack,unpack,checksum});
});
