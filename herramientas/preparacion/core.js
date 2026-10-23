(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.DTFPreparation=api;})(globalThis,()=>{
 'use strict';
 const DPI=300,MAX_PIXELS=64000000,MAX_SIDE=16384;
 function number(value,min,max,label){const n=Number(value);if(value===null||typeof value==='boolean'||typeof value==='string'&&!value.trim()||!Number.isFinite(n)||n<min||n>max)throw Error(`${label}: usá un valor entre ${min} y ${max}.`);return n;}
 const cmToPx=cm=>Math.max(1,Math.round(number(cm,0.001,10000,'Medida')*DPI/2.54));
 const pxToCm=px=>px*2.54/DPI;
 function dimensions(w,h){if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>MAX_SIDE||h>MAX_SIDE||w*h>MAX_PIXELS)throw Error('La salida supera 16.384 px por lado o 64 megapíxeles. Dividí el montaje en hojas más cortas o ajustá sus medidas. No se reduce la resolución automáticamente.');return {width:w,height:h};}
 function pixels(data,w,h){if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w*h>MAX_PIXELS||data.length!==w*h*4)throw Error('Imagen inválida o mayor de 64 megapíxeles.');}
 function analyze(data,w,h,settings){
  pixels(data,w,h);const widthCm=number(settings.widthCm,0.01,1000,'Ancho'),minDpi=number(settings.minDpi,1,2400,'Resolución de referencia'),detailMm=number(settings.detailMm,0.01,10,'Detalle mínimo');
  const heightCm=settings.heightCm===undefined?h*widthCm/w:number(settings.heightCm,0.01,1000,'Alto'),dpiX=w*2.54/widthCm,dpiY=h*2.54/heightCm,dpi=Math.min(dpiX,dpiY),limitX=Math.max(1,Math.ceil(detailMm*dpiX/25.4)),limitY=Math.max(1,Math.ceil(detailMm*dpiY/25.4));
  let minX=w,minY=h,maxX=-1,maxY=-1,transparent=0,partial=0,isolated=0,shortHorizontal=0,shortVertical=0;
  const solid=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&data[(y*w+x)*4+3]>=128;
  for(let y=0;y<h;y++){let run=0;for(let x=0;x<w;x++){
   const a=data[(y*w+x)*4+3];if(a===0)transparent++;else{if(a<255)partial++;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
   if(a>=128){run++;let neighbor=false;for(let yy=y-1;yy<=y+1&&!neighbor;yy++)for(let xx=x-1;xx<=x+1;xx++)if((xx!==x||yy!==y)&&solid(xx,yy)){neighbor=true;break;}if(!neighbor)isolated++;}
   if((a<128||x===w-1)&&run){if(run<limitX)shortHorizontal++;run=0;}
  }}
  for(let x=0;x<w;x++){let run=0;for(let y=0;y<h;y++){if(solid(x,y))run++;if((!solid(x,y)||y===h-1)&&run){if(run<limitY)shortVertical++;run=0;}}}
  const bounds=maxX<0?null:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1};
  const warnings=[];if(!bounds)warnings.push('La imagen es completamente transparente.');if(dpi<minDpi)warnings.push(`Resolución efectiva inferior a ${minDpi} DPI al tamaño indicado. Cambiar el dato DPI no agrega detalle.`);
  if(!transparent&&!partial)warnings.push('No hay transparencia. Comprobá si el fondo forma parte del diseño.');if(partial)warnings.push('Hay píxeles semitransparentes. Revisá bordes, sombras y degradados sobre el color de la prenda.');if(isolated)warnings.push('Hay píxeles opacos aislados. Pueden ser puntos intencionales o restos de limpieza.');if(shortHorizontal||shortVertical)warnings.push('Hay tramos estrechos para el umbral elegido. El conteo es orientativo: incluye esquinas, diagonales y detalles intencionales.');
  return {width:w,height:h,widthCm,heightCm,effectiveDpi:dpi,effectiveDpiX:dpiX,effectiveDpiY:dpiY,referenceDpi:minDpi,detailMm,transparentPixels:transparent,partialPixels:partial,isolatedPixels:isolated,shortHorizontalRuns:shortHorizontal,shortVerticalRuns:shortVertical,bounds,margins:bounds?{left:bounds.x,top:bounds.y,right:w-bounds.x-bounds.width,bottom:h-bounds.y-bounds.height}:null,warnings};
 }
 function pack(items,settings){
  if(!Array.isArray(items)||!items.length||items.length>40)throw Error('Agregá entre 1 y 40 archivos.');
  const width=cmToPx(number(settings.widthCm,1,150,'Ancho del film')),height=cmToPx(number(settings.heightCm,1,300,'Largo por hoja'));dimensions(width,height);
  const margin=Math.round(number(settings.marginCm,0,10,'Margen')*DPI/2.54),gap=Math.round(number(settings.gapCm,0,10,'Separación')*DPI/2.54);
  const usableW=width-2*margin,usableH=height-2*margin;if(usableW<1||usableH<1)throw Error('Los márgenes ocupan toda la hoja.');
  let count=0;const expanded=[];
  items.forEach((item,i)=>{const w=cmToPx(item.widthCm),h=cmToPx(item.heightCm),q=number(item.quantity,1,500,'Copias');if(!Number.isInteger(q))throw Error('Las copias deben ser enteras.');count+=q;if(count>500)throw Error('El pedido admite hasta 500 copias.');if((w>usableW||h>usableH)&&(!settings.rotate||h>usableW||w>usableH))throw Error(`El archivo ${i+1} no cabe dentro del área útil de la hoja.`);for(let c=0;c<q;c++)expanded.push({source:i,copy:c+1,width:w,height:h});});
  expanded.sort((a,b)=>Math.max(b.width,b.height)-Math.max(a.width,a.height)||b.width*b.height-a.width*a.height||a.source-b.source||a.copy-b.copy);
  const pages=[];
  const split=(free,box)=>{
   const next=[];for(const f of free){if(box.x>=f.x+f.w||box.x+box.w<=f.x||box.y>=f.y+f.h||box.y+box.h<=f.y){next.push(f);continue;}
    if(box.x>f.x)next.push({x:f.x,y:f.y,w:box.x-f.x,h:f.h});if(box.x+box.w<f.x+f.w)next.push({x:box.x+box.w,y:f.y,w:f.x+f.w-box.x-box.w,h:f.h});if(box.y>f.y)next.push({x:f.x,y:f.y,w:f.w,h:box.y-f.y});if(box.y+box.h<f.y+f.h)next.push({x:f.x,y:box.y+box.h,w:f.w,h:f.y+f.h-box.y-box.h});
   }return next.filter((f,i)=>f.w>0&&f.h>0&&!next.some((g,j)=>j!==i&&g.x<=f.x&&g.y<=f.y&&g.x+g.w>=f.x+f.w&&g.y+g.h>=f.y+f.h&&(g.w*g.h>f.w*f.h||j<i)));
  };
  for(const item of expanded){let best=null;
   const find=p=>{for(const f of p.free)for(const rotated of settings.rotate?[false,true]:[false]){const w=(rotated?item.height:item.width)+gap,h=(rotated?item.width:item.height)+gap;if(w<=f.w&&h<=f.h){const score=[Math.min(f.w-w,f.h-h),Math.max(f.w-w,f.h-h)];if(!best||score[0]<best.score[0]||(score[0]===best.score[0]&&score[1]<best.score[1]))best={p,f,w,h,rotated,score};}}};
   pages.forEach(find);if(!best){if(pages.length>=100)throw Error('El pedido supera 100 hojas. Dividilo en pedidos más pequeños.');const p={free:[{x:margin,y:margin,w:usableW+gap,h:usableH+gap}],placements:[]};pages.push(p);find(p);}
   if(!best)throw Error('No se pudo ubicar un diseño.');const {p,f,w,h,rotated}=best,placement={...item,x:f.x,y:f.y,width:w-gap,height:h-gap,rotated};p.placements.push(placement);p.free=split(p.free,{x:f.x,y:f.y,w,h});
  }
  return {dpi:DPI,width,height,margin,gap,count,pages:pages.map(p=>({placements:p.placements})),totalMeters:pxToCm(height)*pages.length/100,occupancy:expanded.reduce((s,i)=>s+i.width*i.height,0)/(width*height*pages.length),method:'Acomodo rectangular heurístico. No garantiza el mínimo global.'};
 }
 function quad(points,w,h){if(!Array.isArray(points)||points.length!==4)throw Error('Seleccioná cuatro esquinas.');let sign=0;for(let i=0;i<4;i++){const p=points[i],q=points[(i+1)%4],r=points[(i+2)%4];if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>w||p.y>h)throw Error('Las esquinas deben quedar dentro de la imagen.');const cross=(q.x-p.x)*(r.y-q.y)-(q.y-p.y)*(r.x-q.x);if(Math.abs(cross)<1e-8||sign&&Math.sign(cross)!==sign)throw Error('Las esquinas deben formar un cuadrilátero convexo, sin cruces.');sign=Math.sign(cross);}if(sign<0)throw Error('Ordená las esquinas: superior izquierda, superior derecha, inferior derecha, inferior izquierda.');return points;}
 function homography(points){const from=[[0,0],[1,0],[1,1],[0,1]],m=[];for(let i=0;i<4;i++){const [u,v]=from[i],{x,y}=points[i];m.push([u,v,1,0,0,0,-u*x,-v*x,x]);m.push([0,0,0,u,v,1,-u*y,-v*y,y]);}
  for(let col=0;col<8;col++){let p=col;for(let i=col+1;i<8;i++)if(Math.abs(m[i][col])>Math.abs(m[p][col]))p=i;if(Math.abs(m[p][col])<1e-10)throw Error('La selección es demasiado estrecha.');[m[col],m[p]]=[m[p],m[col]];const k=m[col][col];for(let j=col;j<=8;j++)m[col][j]/=k;for(let i=0;i<8;i++)if(i!==col){const a=m[i][col];for(let j=col;j<=8;j++)m[i][j]-=a*m[col][j];}}
  return m.map(r=>r[8]);
 }
 function sample(data,w,h,x,y,out,index){x=Math.max(0,Math.min(w-1,x));y=Math.max(0,Math.min(h-1,y));const x0=Math.floor(x),y0=Math.floor(y),dx=x-x0,dy=y-y0;let alpha=0,r=0,g=0,b=0;
  for(const [xx,yy,weight] of [[x0,y0,(1-dx)*(1-dy)],[Math.min(x0+1,w-1),y0,dx*(1-dy)],[x0,Math.min(y0+1,h-1),(1-dx)*dy],[Math.min(x0+1,w-1),Math.min(y0+1,h-1),dx*dy]]){const i=(yy*w+xx)*4,a=data[i+3]*weight;alpha+=a;r+=data[i]*a;g+=data[i+1]*a;b+=data[i+2]*a;}out[index+3]=Math.round(alpha);if(alpha){out[index]=Math.round(r/alpha);out[index+1]=Math.round(g/alpha);out[index+2]=Math.round(b/alpha);}
 }
 function removeBackground(data,w,h,color,tolerance,connected=true){
  const distance=number(tolerance,0,100,'Tolerancia')*Math.sqrt(3*255*255)/100;if(!Array.isArray(color)||color.length!==3||color.some(c=>!Number.isFinite(c)||c<0||c>255))throw Error('Color de fondo inválido.');
  const match=i=>Math.hypot(data[i*4]-color[0],data[i*4+1]-color[1],data[i*4+2]-color[2])<=distance;
  if(!connected){for(let i=0;i<w*h;i++)if(match(i))data[i*4+3]=0;return;}
  // Flood fill with a separate visited mask; transparent pixels connect neighboring areas too.
  const seen=new Uint8Array(w*h),stack=[];const enqueue=(x,y)=>{const i=y*w+x;if(x<0||y<0||x>=w||y>=h||seen[i])return;seen[i]=1;if(data[i*4+3]===0||match(i))stack.push(i);};
  for(let x=0;x<w;x++){enqueue(x,0);enqueue(x,h-1);}for(let y=0;y<h;y++){enqueue(0,y);enqueue(w-1,y);}
  while(stack.length){const i=stack.pop(),y=Math.floor(i/w),x=i%w;data[i*4+3]=0;enqueue(x-1,y);enqueue(x+1,y);enqueue(x,y-1);enqueue(x,y+1);}
 }
 function extract(data,w,h,options){pixels(data,w,h);const points=quad(options.points,w,h),ow=options.width,oh=options.height;dimensions(ow,oh);const H=homography(points),output=new Uint8ClampedArray(ow*oh*4);
  for(let y=0;y<oh;y++)for(let x=0;x<ow;x++){const u=(x+0.5)/ow,v=(y+0.5)/oh,d=H[6]*u+H[7]*v+1;if(Math.abs(d)<1e-10)throw Error('Perspectiva inválida.');sample(data,w,h,(H[0]*u+H[1]*v+H[2])/d-0.5,(H[3]*u+H[4]*v+H[5])/d-0.5,output,(y*ow+x)*4);}
  if(options.removeBackground)removeBackground(output,ow,oh,options.color,options.tolerance,options.connected);
  return output;
 }
 function crc32(bytes){let crc=0xffffffff;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0;}
 function chunk(type,data){const bytes=new Uint8Array(data.length+12),view=new DataView(bytes.buffer);view.setUint32(0,data.length);bytes.set(Array.from(type,c=>c.charCodeAt(0)),4);bytes.set(data,8);view.setUint32(bytes.length-4,crc32(bytes.subarray(4,bytes.length-4)));return bytes;}
 async function png(width,height,drawStripe,onProgress=()=>{}){
  dimensions(width,height);if(typeof CompressionStream==='undefined')throw Error('Este navegador no permite exportar por franjas. Usá una versión reciente de Chrome, Edge o Firefox.');
  const ihdr=new Uint8Array(13),head=new DataView(ihdr.buffer);head.setUint32(0,width);head.setUint32(4,height);ihdr[8]=8;ihdr[9]=6;
  const phys=new Uint8Array(9),pv=new DataView(phys.buffer);pv.setUint32(0,11811);pv.setUint32(4,11811);phys[8]=1;
  const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('pHYs',phys)],stream=new CompressionStream('deflate'),writer=stream.writable.getWriter(),reader=stream.readable.getReader();
  const read=(async()=>{for(;;){const {value,done}=await reader.read();if(done)break;parts.push(chunk('IDAT',value));}})();
  try{for(let y=0;y<height;y+=128){const rows=Math.min(128,height-y),rgba=await drawStripe(y,rows);if(rgba.length!==width*rows*4)throw Error('Franja PNG incompleta.');const raw=new Uint8Array(rows*(width*4+1));for(let r=0;r<rows;r++)raw.set(rgba.subarray(r*width*4,(r+1)*width*4),r*(width*4+1)+1);await writer.write(raw);onProgress(Math.round((y+rows)/height*100));}await writer.close();await read;}catch(e){await writer.abort(e).catch(()=>{});await read.catch(()=>{});throw e;}parts.push(chunk('IEND',new Uint8Array()));return new Blob(parts,{type:'image/png'});
 }
 return Object.freeze({DPI,MAX_PIXELS,MAX_SIDE,number,cmToPx,pxToCm,dimensions,analyze,pack,quad,homography,sample,extract,removeBackground,crc32,png});
});
