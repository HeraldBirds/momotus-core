/* Pointer geometry in original 300-DPI pixels. Images are never rewritten by these operations. */
(function(root,factory){const C=typeof module==='object'&&module.exports?require('./core.js'):root.DTFSheet;const api=factory(C);if(typeof module==='object'&&module.exports)module.exports=api;else root.DTFSheetInteraction=api;})(globalThis,C=>{
 'use strict';
 const mirrorHandle=id=>({nw:'ne',n:'n',ne:'nw',e:'w',se:'sw',s:'s',sw:'se',w:'e'}[id]);
 function handles(p,c){const xs=[p.x,p.x+p.width/2,p.x+p.width],ys=[p.y,p.y+p.height/2,p.y+p.height],entries=[['nw',0,0],['n',1,0],['ne',2,0],['e',2,1],['se',2,2],['s',1,2],['sw',0,2],['w',0,1]];return entries.map(([id,x,y])=>({id,x:c.mirror?c.width+c.margins.left-c.margins.right-xs[x]:xs[x],y:ys[y],visual:c.mirror?mirrorHandle(id):id}));}
 const cursors={nw:'nwse-resize',se:'nwse-resize',ne:'nesw-resize',sw:'nesw-resize',n:'ns-resize',s:'ns-resize',e:'ew-resize',w:'ew-resize'};
 function bounds(c){return{left:c.margins.left,right:c.width-c.margins.right,top:c.margins.top,bottom:c.height-c.margins.bottom};}
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function check(p){if(!p||!Number.isInteger(p.x)||!Number.isInteger(p.y))throw Error('Posición de copia inválida.');C.dimensions(p.width,p.height);}
 function fit(p,c){check(p);if(p.locked)throw Error('Desbloqueá la copia para cambiar su tamaño.');const b=bounds(c),ratio=Math.min(1,(b.right-b.left)/p.width,(b.bottom-b.top)/p.height),width=Math.max(1,Math.min(b.right-b.left,Math.round(p.width*ratio))),height=Math.max(1,Math.min(b.bottom-b.top,Math.round(p.height*ratio)));return{...p,width,height,x:Math.round(clamp(p.x,b.left,b.right-width)),y:Math.round(clamp(p.y,b.top,b.bottom-height))};}
 function move(p,x,y,c){check(p);if(p.locked)throw Error('La copia está bloqueada.');const b=bounds(c);if(p.width>b.right-b.left||p.height>b.bottom-b.top)throw Error('La copia no cabe. Usá «Encajar» o ajustá sus medidas.');return{...p,x:Math.round(clamp(x,b.left,b.right-p.width)),y:Math.round(clamp(y,b.top,b.bottom-p.height))};}
 function rotate(p,delta,c){check(p);if(p.locked)throw Error('Desbloqueá la copia para girarla.');if(!Number.isInteger(delta)||delta%90)throw Error('El giro directo utiliza pasos de 90°.');const rotation=((p.rotation||0)+delta%360+360)%360,swap=(Math.abs(delta)/90)%2===1,width=swap?p.height:p.width,height=swap?p.width:p.height,b=bounds(c);if(width>b.right-b.left||height>b.bottom-b.top)throw Error('La copia girada no cabe en el área útil. Ajustá sus medidas o el formato.');return move({...p,width,height,rotation,rotated:rotation%180!==0},Math.round(p.x+(p.width-width)/2),Math.round(p.y+(p.height-height)/2),c);}
 function resize(p,handle,dx,dy,c,options={}){
  check(p);if(p.locked)throw Error('La copia está bloqueada.');if(!cursors[handle]||!Number.isFinite(dx)||!Number.isFinite(dy))throw Error('Tirador o desplazamiento inválido.');
  const west=handle.includes('w'),east=handle.includes('e'),north=handle.includes('n'),south=handle.includes('s'),horizontal=west||east,vertical=north||south,b=bounds(c),cx=p.x+p.width/2,cy=p.y+p.height/2;
  const anchorX=west?p.x+p.width:east?p.x:cx,anchorY=north?p.y+p.height:south?p.y:cy;
  const maxW=Math.floor(horizontal?(west?anchorX-b.left:b.right-anchorX):(options.aspect?b.right-b.left:2*Math.min(cx-b.left,b.right-cx))),maxH=Math.floor(vertical?(north?anchorY-b.top:b.bottom-anchorY):(options.aspect?b.bottom-b.top:2*Math.min(cy-b.top,b.bottom-cy)));
  if(horizontal&&maxW<1||vertical&&maxH<1)throw Error('Mové el anclaje dentro del área útil o usá «Encajar».');
  let width=horizontal?p.width+(east?dx:-dx):p.width,height=vertical?p.height+(south?dy:-dy):p.height;
  const snap=options.snap??c.snap,tolerance=options.tolerance??C.cmToPx(.1),refs=options.neighbours||[];
  const nearest=(v,list)=>{let result=v,distance=tolerance;for(const q of list){const d=Math.abs(q-v);if(d<=distance){result=q;distance=d;}}return result;};
  if(snap){
   const xs=[b.left,b.right],ys=[b.top,b.bottom];for(const q of refs){if(q.id===p.id||q.page!==p.page)continue;if(q.y<p.y+p.height&&q.y+q.height>p.y)xs.push(q.x-c.gap,q.x+q.width+c.gap);if(q.x<p.x+p.width&&q.x+q.width>p.x)ys.push(q.y-c.gap,q.y+q.height+c.gap);}
   if(horizontal){const edge=west?anchorX-width:anchorX+width,at=nearest(edge,xs);width=west?anchorX-at:at-anchorX;}
   if(vertical){const edge=north?anchorY-height:anchorY+height,at=nearest(edge,ys);height=north?anchorY-at:at-anchorY;}
  }
  if(options.aspect){
   if(maxW<1||maxH<1)throw Error('El anclaje no permite conservar la proporción. Mové la copia o usá «Encajar».');
   const desired=horizontal&&vertical?(width*p.width+height*p.height)/(p.width*p.width+p.height*p.height):horizontal?width/p.width:height/p.height;
   const lower=Math.max(1/p.width,1/p.height),upper=Math.min(maxW/p.width,maxH/p.height,C.MAX_SIDE/p.width,C.MAX_SIDE/p.height,Math.sqrt(C.MAX_PIXELS/(p.width*p.height)));
   if(upper<lower)throw Error('No hay espacio para conservar la proporción.');const scale=clamp(desired,lower,upper);width=Math.max(1,Math.min(maxW,Math.round(p.width*scale)));height=Math.max(1,Math.min(maxH,Math.round(p.height*scale)));
  }else{
   width=horizontal?Math.round(clamp(width,1,Math.min(maxW,C.MAX_SIDE))):p.width;height=vertical?Math.round(clamp(height,1,Math.min(maxH,C.MAX_SIDE))):p.height;
   if(width*height>C.MAX_PIXELS){if(horizontal&&(!vertical||Math.abs(dx)>=Math.abs(dy)))width=Math.floor(C.MAX_PIXELS/height);else height=Math.floor(C.MAX_PIXELS/width);}
  }
  C.dimensions(width,height);const x=west?anchorX-width:east?p.x:Math.round(clamp(cx-width/2,b.left,b.right-width)),y=north?anchorY-height:south?p.y:Math.round(clamp(cy-height/2,b.top,b.bottom-height));return{...p,x:Math.round(x),y:Math.round(y),width,height};
 }
 function ruler(pixelsPerCm,minPixels=42){if(!Number.isFinite(pixelsPerCm)||pixelsPerCm<=0)throw Error('Escala de regla inválida.');const target=minPixels/pixelsPerCm,unit=10**Math.floor(Math.log10(target)),fraction=target/unit,major=(fraction<=1?1:fraction<=2?2:fraction<=5?5:10)*unit,minor=major/5*pixelsPerCm>=5?major/5:major/2;return{major,minor,decimals:Math.max(0,-Math.floor(Math.log10(major)))};}
 function mirrorPixels(data,width,rows,left,right){if(!Number.isInteger(width)||!Number.isInteger(rows)||width<1||rows<1||data.length!==width*rows*4||![left,right].every(Number.isInteger)||left<0||right<0||left+right>=width)throw Error('Franja o márgenes de espejo inválidos.');const end=width-right;
  if(data.byteOffset%4===0){const pixels=new Uint32Array(data.buffer,data.byteOffset,data.byteLength/4);for(let y=0;y<rows;y++)for(let x=left;x<left+Math.floor((end-left)/2);x++){const a=y*width+x,b=y*width+left+end-1-x,t=pixels[a];pixels[a]=pixels[b];pixels[b]=t;}}
  else for(let y=0;y<rows;y++)for(let x=left;x<left+Math.floor((end-left)/2);x++)for(let k=0;k<4;k++){const a=(y*width+x)*4+k,b=(y*width+left+end-1-x)*4+k,t=data[a];data[a]=data[b];data[b]=t;}return data;
 }
 return Object.freeze({handles,cursors,bounds,fit,move,rotate,resize,mirrorPixels,ruler});
});
