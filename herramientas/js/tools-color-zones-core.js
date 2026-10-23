(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.MomotusColorZonesCore=api;})(globalThis,()=>{
 'use strict';const MAX_PIXELS=18000000,MAX_SIDE=16384;
 function dimensions(w,h){if(!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1||w>MAX_SIDE||h>MAX_SIDE||w*h>MAX_PIXELS)throw Error('La selección por zonas admite hasta 18 MP y 16.384 px por lado. No se reduce la resolución automáticamente.');}
 function validate(data,w,h,planes=[]){dimensions(w,h);if(!(data instanceof Uint8ClampedArray)||data.length!==w*h*4)throw Error('Datos de imagen inválidos.');for(const a of planes)if(a&&(!(a instanceof Uint8Array)||a.length!==w*h))throw Error('Máscara inválida.');}
 function distance(r,g,b,t){const dr=r-t.r,dg=g-t.g,db=b-t.b,m=(r+t.r)/2;return Math.sqrt((2+m/256)*dr*dr+4*dg*dg+(2+(255-m)/256)*db*db)/1.5;}
 function settings(o){if(!o||!o.target||!['r','g','b'].every(k=>Number.isInteger(o.target[k])&&o.target[k]>=0&&o.target[k]<=255)||!Number.isFinite(o.tolerance)||o.tolerance<0||o.tolerance>220||!Number.isFinite(o.softness)||o.softness<0||o.softness>100)throw Error('Color o tolerancia inválidos.');for(const key of ['include','exclude'])if(o[key]!==undefined&&(!Array.isArray(o[key])||o[key].length>12||o[key].some(t=>!t||!['r','g','b'].every(k=>Number.isInteger(t[k])&&t[k]>=0&&t[k]<=255))))throw Error('Máximo 12 muestras válidas por grupo.');}

 function matcher(o){settings(o);const includes=[o.target,...(o.include||[])],excludes=o.exclude||[];return {distance:(r,g,b)=>{let best=Infinity;for(const t of includes)best=Math.min(best,distance(r,g,b,t));return best;},excluded:(r,g,b)=>excludes.some(t=>distance(r,g,b,t)<=o.tolerance+o.softness),nearest:(r,g,b)=>includes.reduce((best,t)=>distance(r,g,b,t)<distance(r,g,b,best)?t:best,includes[0])};}
 function morph(mask,w,h,radius,mode,allowed,protect){
  dimensions(w,h);if(!(mask instanceof Uint8Array)||mask.length!==w*h||!Number.isInteger(radius)||radius<1||radius>20||!['grow','shrink'].includes(mode)||[allowed,protect].some(a=>a&&(!(a instanceof Uint8Array)||a.length!==w*h)))throw Error('Ajuste de selección inválido (1–20 px).');
  const input=mask.slice();for(let i=0;i<input.length;i++)if(protect?.[i]||allowed&&!allowed[i])input[i]=0;
  const tmp=new Uint8Array(w*h),out=new Uint8Array(w*h),idx=new Int32Array(Math.max(w,h)+2*radius+2),values=new Uint8Array(idx.length),max=mode==='grow';
  function line(n,get,set){let head=0,tail=0;for(let x=-radius;x<n+radius;x++){const value=x>=0&&x<n?get(x):0;while(tail>head&&(max?values[tail-1]<=value:values[tail-1]>=value))tail--;idx[tail]=x;values[tail++]=value;while(head<tail&&idx[head]<x-2*radius)head++;const at=x-radius;if(at>=0&&at<n)set(at,values[head]);}}
  for(let y=0;y<h;y++)line(w,x=>input[y*w+x],(x,v)=>tmp[y*w+x]=v);
  for(let x=0;x<w;x++)line(h,y=>tmp[y*w+x],(y,v)=>out[y*w+x]=v);
  for(let i=0;i<out.length;i++)if(protect?.[i]||allowed&&!allowed[i])out[i]=0;
  return out;
 }
 function featherStroke(mask,w,h,points,radius,mode,hardness=100,predicate=null,original=null,onRestore=null){
  dimensions(w,h);if(!(mask instanceof Uint8Array)||mask.length!==w*h||!Array.isArray(points)||!points.length||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>w||p.y>h)||!Number.isFinite(radius)||radius<.5||radius>1000||!Number.isFinite(hardness)||hardness<0||hardness>100||!['paint','erase','restore'].includes(mode)||mode==='restore'&&(!(original instanceof Uint8Array)||original.length!==mask.length))throw Error('Pincel inválido.');
  const inner=radius*hardness/100;const stamp=p=>{for(let y=Math.max(0,Math.floor(p.y-radius));y<Math.min(h,Math.ceil(p.y+radius+1));y++)for(let x=Math.max(0,Math.floor(p.x-radius));x<Math.min(w,Math.ceil(p.x+radius+1));x++){const i=y*w+x,d=Math.hypot(x+.5-p.x,y+.5-p.y);if(d>radius||predicate&&!predicate(i))continue;const amount=d<=inner||inner===radius?1:Math.max(0,(radius-d)/(radius-inner)),v=Math.round(amount*255);if(mode==='paint')mask[i]=Math.max(mask[i],v);else if(mode==='erase')mask[i]=Math.min(mask[i],255-v);else{mask[i]=Math.min(original[i],Math.round(mask[i]+(original[i]-mask[i])*amount));if(onRestore)onRestore(i,amount);}}};
  let prev=null;for(const p of points){if(prev){const n=Math.max(1,Math.ceil(Math.hypot(p.x-prev.x,p.y-prev.y)/Math.max(.5,radius/3)));for(let i=1;i<=n;i++)stamp({x:prev.x+(p.x-prev.x)*i/n,y:prev.y+(p.y-prev.y)*i/n});}else stamp(p);prev=p;}return mask;
 }
 function cleanHalo(data,w,h,base,alpha,selected,allowed,protect,o){
  validate(data,w,h,[base,alpha,selected,allowed,protect]);const match=matcher(o),out=data.slice();
  for(let i=0;i<w*h;i++){const a=base[i],next=alpha[i],j=i*4;if(!next||next>=a||!selected[i]||protect?.[i]||allowed&&!allowed[i]||match.excluded(data[j],data[j+1],data[j+2]))continue;const key=match.nearest(data[j],data[j+1],data[j+2]),coverage=next/a;for(const [c,k] of [[0,'r'],[1,'g'],[2,'b']])out[j+c]=Math.max(0,Math.min(255,Math.round((data[j+c]-key[k]*(1-coverage))/Math.max(.02,coverage))));}
  return out;
 }
 function blendLocal(base,adjusted,mask){if(!(base instanceof Uint8ClampedArray)||!(adjusted instanceof Uint8ClampedArray)||!(mask instanceof Uint8Array)||base.length!==adjusted.length||mask.length*4!==base.length)throw Error('Ajuste local inválido.');const out=base.slice();for(let i=0;i<mask.length;i++){const m=mask[i]/255,j=i*4;if(!m||!base[j+3])continue;for(let c=0;c<3;c++)out[j+c]=Math.round(base[j+c]*(1-m)+adjusted[j+c]*m);}return out;}
 function analyze(data,w,h,o,alpha,allowed,protect,progress=()=>{}){validate(data,w,h,[alpha,allowed,protect]);const match=matcher(o);const n=w*h,labels=new Uint32Array(n),queue=new Uint32Array(n),regions=[];let total=0;const candidate=i=>(alpha?alpha[i]:data[i*4+3])>0&&(!allowed||allowed[i])&&(!protect||!protect[i])&&!match.excluded(data[i*4],data[i*4+1],data[i*4+2])&&match.distance(data[i*4],data[i*4+1],data[i*4+2])<=o.tolerance+o.softness;
  for(let i=0;i<n;i++){if(labels[i]||!candidate(i))continue;if(regions.length>=20000)throw Error('El análisis supera 20.000 zonas. Limitá el área con el lazo o ajustá la tolerancia para reducir el ruido.');const id=regions.length+1;let head=0,tail=0,minX=w,minY=h,maxX=0,maxY=0;queue[tail++]=i;labels[i]=id;const add=j=>{if(!labels[j]&&candidate(j)){labels[j]=id;queue[tail++]=j;}};while(head<tail){const at=queue[head++],x=at%w,y=Math.floor(at/w);minX=Math.min(x,minX);minY=Math.min(y,minY);maxX=Math.max(x,maxX);maxY=Math.max(y,maxY);if(x)add(at-1);if(x+1<w)add(at+1);if(y)add(at-w);if(y+1<h)add(at+w);if(head%250000===0)progress(Math.round(i/n*100));}regions.push({id,seed:i,count:tail,x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1});total+=tail;if(i%100000===0)progress(Math.round(i/n*100));}progress(100);return{labels,regions,total};}
 function selection(labels,ids){if(!(labels instanceof Uint32Array)||!Array.isArray(ids))throw Error('Selección inválida.');const set=new Set(ids),mask=new Uint8Array(labels.length);for(let i=0;i<labels.length;i++)if(set.has(labels[i]))mask[i]=255;return mask;}
 function smallRegions(labels,regions,maxPixels){
  if(!(labels instanceof Uint32Array)||!Array.isArray(regions)||!Number.isInteger(maxPixels)||maxPixels<1||maxPixels>MAX_PIXELS)throw Error('El tamaño máximo debe ser un número entero entre 1 y 18.000.000 píxeles.');
  return selection(labels,regions.filter(r=>r.id>0&&r.count>0&&r.count<=maxPixels).map(r=>r.id));
 }
 function invertSelection(labels,selected,allowed,protect){
  if(!(labels instanceof Uint32Array)||!(selected instanceof Uint8Array)||selected.length!==labels.length||[allowed,protect].some(a=>a&&(!(a instanceof Uint8Array)||a.length!==labels.length)))throw Error('Máscara inválida.');
  const result=new Uint8Array(labels.length);
  for(let i=0;i<result.length;i++)if(labels[i]&&(!allowed||allowed[i])&&!protect?.[i])result[i]=255-selected[i];
  return result;
 }
 function maskSummary(selected,allowed,protect){
  if(!(selected instanceof Uint8Array)||[allowed,protect].some(a=>a&&(!(a instanceof Uint8Array)||a.length!==selected.length)))throw Error('Máscara inválida.');
  let count=0,protectedPixels=0;
  for(let i=0;i<selected.length;i++){if(protect?.[i])protectedPixels++;if(selected[i]&&(!allowed||allowed[i])&&!protect?.[i])count++;}
  return {selected:count,protected:protectedPixels};
 }
 function preview(data,w,h,o,base,selected,allowed,protect){validate(data,w,h,[base,selected,allowed,protect]);const match=matcher(o);const alpha=new Uint8Array(w*h);let affected=0,partial=0;for(let i=0;i<alpha.length;i++){const original=data[i*4+3],a=base?Math.min(base[i],original):original;let next=a;if(selected?.[i]&&(!allowed||allowed[i])&&!protect?.[i]&&a){const r=data[i*4],g=data[i*4+1],b=data[i*4+2],d=match.distance(r,g,b);if(!match.excluded(r,g,b)){let removed=0;if(o.selectionOnly||d<=o.tolerance)removed=a;else if(o.softness>0&&d<o.tolerance+o.softness)removed=a*(1-(d-o.tolerance)/o.softness);next=Math.max(0,Math.round(a-removed*selected[i]/255));}}alpha[i]=next;if(next<a)affected++;if(next>0&&next<255)partial++;}return{alpha,affected,partial};}
 function compose(data,w,h,alpha){validate(data,w,h,[alpha]);const result=data.slice();for(let i=0;i<w*h;i++)result[i*4+3]=Math.min(data[i*4+3],alpha[i]);return result;}
 function stroke(mask,w,h,points,radius,value,predicate=null){dimensions(w,h);if(!(mask instanceof Uint8Array)||mask.length!==w*h||!Array.isArray(points)||!points.length||!Number.isFinite(radius)||radius<.5||radius>1000||![0,255].includes(value)||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>w||p.y>h))throw Error('Trazo inválido.');const paint=p=>{for(let y=Math.max(0,Math.floor(p.y-radius));y<Math.min(h,Math.ceil(p.y+radius+1));y++)for(let x=Math.max(0,Math.floor(p.x-radius));x<Math.min(w,Math.ceil(p.x+radius+1));x++)if((x+.5-p.x)**2+(y+.5-p.y)**2<=radius**2&&(!predicate||predicate(y*w+x)))mask[y*w+x]=value;};let previous=null;for(const p of points){if(previous){const d=Math.hypot(p.x-previous.x,p.y-previous.y),steps=Math.max(1,Math.ceil(d/Math.max(.5,radius/2)));for(let s=1;s<=steps;s++)paint({x:previous.x+(p.x-previous.x)*s/steps,y:previous.y+(p.y-previous.y)*s/steps});}else paint(p);previous=p;}return mask;}
 function polygon(w,h,points){dimensions(w,h);if(!Array.isArray(points)||points.length<3||points.length>3000||points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>w||p.y>h))throw Error('Cerrá un lazo con al menos tres puntos dentro de la imagen.');const mask=new Uint8Array(w*h),y0=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y)))),y1=Math.min(h-1,Math.ceil(Math.max(...points.map(p=>p.y))));for(let y=y0;y<=y1;y++){const intersections=[],cy=y+.5;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[j],b=points[i];if((a.y>cy)!==(b.y>cy))intersections.push(a.x+(cy-a.y)*(b.x-a.x)/(b.y-a.y));}intersections.sort((a,b)=>a-b);for(let k=0;k+1<intersections.length;k+=2){const start=Math.max(0,Math.ceil(intersections[k]-.5)),end=Math.min(w,Math.ceil(intersections[k+1]-.5));mask.fill(255,y*w+start,y*w+end);}}if(!mask.some(Boolean))throw Error('El lazo no encierra ningún píxel.');return mask;}

 // Acabado de la cobertura eliminada: nunca añade opacidad al original.
 function finishAlpha(alpha,original,w,h,mode='preserve',threshold=128,cell=1,allowed=null,protect=null){
  dimensions(w,h);
  if(!(alpha instanceof Uint8Array)||!(original instanceof Uint8Array)||alpha.length!==w*h||original.length!==alpha.length||!['preserve','hard','dither'].includes(mode)||!Number.isInteger(threshold)||threshold<1||threshold>254||!Number.isInteger(cell)||cell<1||cell>8||[allowed,protect].some(a=>a&&(!(a instanceof Uint8Array)||a.length!==alpha.length)))throw Error('Acabado de transparencia inválido.');
  const out=alpha.slice(),bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  for(let i=0;i<out.length;i++){
   if(alpha[i]>original[i])throw Error('El acabado no puede aumentar el alfa original.');
   if(mode==='preserve'||!alpha[i]||alpha[i]===original[i]||protect?.[i]||allowed&&!allowed[i])continue;
   const cutoff=mode==='hard'?threshold:(bayer[(Math.floor(Math.floor(i/w)/cell)%4)*4+Math.floor((i%w)/cell)%4]+.5)*16;
   out[i]=alpha[i]/original[i]*255>=cutoff?original[i]:0;
  }
  return out;
 }
 function inspectAlpha(alpha,w,h,maxIsland=4,allowed=null,protect=null){
  dimensions(w,h);if(!(alpha instanceof Uint8Array)||alpha.length!==w*h||!Number.isInteger(maxIsland)||maxIsland<1||maxIsland>64||[allowed,protect].some(a=>a&&(!(a instanceof Uint8Array)||a.length!==alpha.length)))throw Error('Revisión de bordes inválida.');
  const flags=new Uint8Array(alpha.length),seen=new Uint8Array(alpha.length),queue=new Uint32Array(alpha.length);let partial=0,edgePartial=0,islands=0,islandPixels=0,editableIslandPixels=0;
  for(let i=0;i<alpha.length;i++){
   if(!alpha[i])continue;const x=i%w,y=Math.floor(i/w);
   if(alpha[i]<255){flags[i]|=1;partial++;if(!x||!y||x===w-1||y===h-1||!alpha[i-1]||!alpha[i+1]||!alpha[i-w]||!alpha[i+w]){flags[i]|=4;edgePartial++;}}
   if(seen[i])continue;let head=0,tail=1;queue[0]=i;seen[i]=1;
   const add=j=>{if(alpha[j]&&!seen[j]){seen[j]=1;queue[tail++]=j;}};
   // Ocho vecinos: las diagonales finas siguen siendo parte del diseño.
   while(head<tail){const at=queue[head++],xx=at%w,yy=Math.floor(at/w);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if((dx||dy)&&xx+dx>=0&&xx+dx<w&&yy+dy>=0&&yy+dy<h)add(at+dy*w+dx);}
   if(tail<=maxIsland){islands++;islandPixels+=tail;for(let j=0;j<tail;j++){const at=queue[j];flags[at]|=2;if((!allowed||allowed[at])&&!protect?.[at])editableIslandPixels++;}}
  }
  return {flags,partial,edgePartial,islands,islandPixels,editableIslandPixels};
 }
 return Object.freeze({finishAlpha,inspectAlpha,MAX_PIXELS,MAX_SIDE,dimensions,distance,matcher,morph,featherStroke,cleanHalo,blendLocal,analyze,selection,smallRegions,invertSelection,maskSummary,preview,compose,stroke,polygon});
});
