/* Momotus: motor determinista de efectos raster. No produce archivos de bordado. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MomotusEffectsCore = api;
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';
  const styles = ['original','satin','tatami','chenille','screen','halftone','vintage','puff','metal','glitter'];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const finite = (v, fallback) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  const rgb = hex => /^#[0-9a-f]{6}$/i.test(hex || '') ? [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)) : [0,0,0];
  const distance = (r,g,b,c) => Math.max(Math.abs(r-c[0]),Math.abs(g-c[1]),Math.abs(b-c[2]));
  const hash = (x,y) => { let n = Math.imul(x|0,374761393) ^ Math.imul(y|0,668265263); n = Math.imul(n ^ (n>>>13),1274126177); return ((n ^ (n>>>16))>>>0)/4294967295; };
  const limits = Object.freeze({side:16384,pixels:64000000});
  const dimensions = (width,height,widthCm) => {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width<1 || height<1) throw Error('La imagen no tiene dimensiones válidas.');
    if (!Number.isFinite(Number(widthCm)) || widthCm<1 || widthCm>65) throw Error('El ancho final debe estar entre 1 y 65 cm.');
    const w = Math.round(widthCm/2.54*300), h = Math.max(1,Math.round(w*height/width));
    if (w>limits.side || h>limits.side || w*h>limits.pixels) throw Error('La salida supera 16384 px por lado o 64 millones de píxeles. Reducí el ancho final.');
    return {width:w,height:h,dpi:300,heightCm:h/300*2.54,upscaled:w>width};
  };
  const normalize = opts => ({
    style:styles.includes(opts.style) ? opts.style : 'satin',
    strength:clamp(finite(opts.strength,65),0,100)/100,
    angle:clamp(finite(opts.angle,35),-180,180)*Math.PI/180,
    pitch:clamp(finite(opts.pitch,0.65),0.2,3),
    pixelsPerMm:clamp(finite(opts.pixelsPerMm,300/25.4),0.1,400),
    protect:opts.protect === true, background:rgb(opts.background || '#000000'),
    remove:opts.remove === true, tolerance:clamp(finite(opts.tolerance,12),0,100),
    selective:opts.selective === true,target:rgb(opts.target || '#ffcc00'),targetTolerance:clamp(finite(opts.targetTolerance,40),0,255),
    autoDirection:opts.autoDirection === true,
    levels:clamp(Math.round(finite(opts.levels,4)),2,8)
  });
  function orientation(data,width,height,o) {
    const scale=Math.max(1,Math.ceil(Math.max(width,height)/512)),w=Math.ceil(width/scale),h=Math.ceil(height/scale),count=w*h;
    const colors=new Uint8ClampedArray(count*4),nx=new Int16Array(count),ny=new Int16Array(count),dist=new Float32Array(count);dist.fill(1e6);nx.fill(-1);ny.fill(-1);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,j=(Math.min(height-1,y*scale)*width+Math.min(width-1,x*scale))*4;colors.set(data.subarray(j,j+4),i);if(o.protect&&distance(colors[i],colors[i+1],colors[i+2],o.background)<=o.tolerance)colors[i+3]=0;}
    const different=(i,j)=>Math.abs(colors[i+3]-colors[j+3])>70 || Math.max(Math.abs(colors[i]-colors[j]),Math.abs(colors[i+1]-colors[j+1]),Math.abs(colors[i+2]-colors[j+2]))>50;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=y*w+x,i=k*4;if(!colors[i+3])continue;if(!x||!y||x===w-1||y===h-1||different(i,i-4)||different(i,i+4)||different(i,i-w*4)||different(i,i+w*4)){nx[k]=x;ny[k]=y;dist[k]=0;}}
    const pass=forward=>{for(let q=0;q<count;q++){const k=forward?q:count-q-1,x=k%w,y=Math.floor(k/w);const candidates=forward?[[x-1,y],[x,y-1],[x-1,y-1],[x+1,y-1]]:[[x+1,y],[x,y+1],[x+1,y+1],[x-1,y+1]];for(const [a,b]of candidates){if(a<0||b<0||a>=w||b>=h)continue;const j=b*w+a;if(nx[j]<0)continue;const d=(x-nx[j])**2+(y-ny[j])**2;if(d<dist[k]){dist[k]=d;nx[k]=nx[j];ny[k]=ny[j];}}}};
    pass(true);pass(false);
    const field=new Float32Array(count);
    for(let k=0;k<count;k++){const x=k%w,y=Math.floor(k/w);field[k]=nx[k]>=0&&dist[k]>0?Math.atan2(y-ny[k],x-nx[k]):0;}
    return {field,width:w,scale};
  }
  function render(data,width,height,opts={},region={}) {
    if (!(data instanceof Uint8ClampedArray) || data.length!==width*height*4 || !Number.isInteger(width) || !Number.isInteger(height) || width<1 || height<1 || width*height>limits.pixels) throw Error('Datos de imagen no válidos.');
    const o=normalize(opts),out=new Uint8ClampedArray(data),cos=Math.cos(o.angle),sin=Math.sin(o.angle),step=o.pitch*o.pixelsPerMm;
    const direction=o.autoDirection&&['satin','tatami','chenille'].includes(o.style)?(region.direction||orientation(data,width,height,o)):null;
    const offsetX=region.x||0,offsetY=region.y||0;
    // Un mapa de cobertura mantiene el relieve dentro del arte y fuera del fondo protegido.
    const cover=(x,y)=>{if(x<0||y<0||x>=width||y>=height)return 0;const i=(y*width+x)*4;if(o.protect&&distance(data[i],data[i+1],data[i+2],o.background)<=o.tolerance)return 0;return data[i+3]/255;};
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=(y*width+x)*4,r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
      if(!a)continue;
      if(o.protect&&distance(r,g,b,o.background)<=o.tolerance){if(o.remove)out[i+3]=0;continue;}
      if(o.selective&&distance(r,g,b,o.target)>o.targetTolerance)continue;
      if(o.style==='original'||o.strength===0)continue;
      const gx=x+offsetX,gy=y+offsetY;
      const theta=direction?direction.field[Math.floor(gy/(direction.scaleY||direction.scale))*direction.width+Math.floor(gx/(direction.scaleX||direction.scale))]+o.angle:0;
      const cx=direction?Math.cos(theta):cos,sy=direction?Math.sin(theta):sin;
      const u=(gx*cx+gy*sy)/step,v=(-gx*sy+gy*cx)/step;
      let light=0,base=[r,g,b];
      if(o.style==='satin'){
        const rib=Math.cos(2*Math.PI*v), stitch=Math.cos(2*Math.PI*(u/5+Math.floor(v)*0.37));
        light=0.31*rib+0.09*stitch+0.045*Math.sin(v*2*Math.PI*5);
      }else if(o.style==='tatami'){
        const rib=Math.cos(v*2*Math.PI),segment=Math.cos((u+((Math.floor(v)&1)*2))/4*2*Math.PI);
        const end=Math.abs(Math.sin((u+((Math.floor(v)&1)*2))/4*Math.PI));
        light=0.23*rib+0.14*segment+0.04*Math.sin(v*2*Math.PI*6)-0.13*(end<0.16?1:0);
      }else if(o.style==='chenille'){
        const cell=hash(Math.floor(u*2),Math.floor(v*2));
        const fu=u-Math.floor(u)-0.5,fv=v-Math.floor(v)-0.5,ring=Math.hypot(fu,fv);
        light=0.23*Math.cos((ring-0.3)*18)+0.18*(cell-0.5)-0.12*(ring<0.15?1:0);
      }else if(o.style==='screen'){
        base=base.map(c=>Math.round(c/255*(o.levels-1))/(o.levels-1)*255);
      }else if(o.style==='halftone'){
        const lum=(0.2126*r+0.7152*g+0.0722*b)/255;
        const fu=u-Math.floor(u)-0.5,fv=v-Math.floor(v)-0.5;
        // Mayor luminosidad = mayor superficie de tinta; agujeros transparentes, sin base blanca artificial.
        if(Math.hypot(fu,fv)>Math.sqrt(clamp(lum,0.08,1)/Math.PI)){out[i+3]=Math.round(a*(1-o.strength));}
      }else if(o.style==='vintage'){
        const patch=hash(Math.floor(u),Math.floor(v)),grain=hash(Math.floor(u*4),Math.floor(v*4));
        if(patch<0.12+o.strength*0.12&&grain<0.62)out[i+3]=Math.round(a*(1-o.strength));
      }else if(o.style==='puff'){
        const offset=Math.max(1,Math.round(step*0.8));
        light=(cover(x-offset,y-offset)-cover(x+offset,y+offset))*0.65+0.06*Math.sin((u+v)*0.6);
      }else if(o.style==='metal'){
        light=0.38*Math.sin((u+v)*0.7)+0.11*Math.sin(v*2*Math.PI)+0.15*Math.sin((u+v)*1.5);
      }else if(o.style==='glitter'){
        const grain=hash(Math.floor(u*3),Math.floor(v*3));light=(grain>0.86?0.8:grain<0.16?-0.38:(grain-0.5)*0.25);
      }
      for(let c=0;c<3;c++){
        const value=light>=0?base[c]+(255-base[c])*light:base[c]*(1+light);
        out[i+c]=clamp(Math.round(data[i+c]+(value-data[i+c])*o.strength),0,255);
      }
    }
    return out;
  }
  function blendMask(base,changed,mask){
    if(!(mask instanceof Uint8ClampedArray)||mask.length*4!==base.length||changed.length!==base.length)throw Error('Máscara de zona no válida.');
    for(let k=0;k<mask.length;k++){const m=mask[k]/255,i=k*4;if(m===1)continue;if(!m){changed.set(base.subarray(i,i+4),i);continue;}const a=base[i+3]/255,b=changed[i+3]/255,alpha=a*(1-m)+b*m;for(let c=0;c<3;c++)changed[i+c]=alpha?Math.round((base[i+c]*a*(1-m)+changed[i+c]*b*m)/alpha):0;changed[i+3]=Math.round(alpha*255);}
    return changed;
  }
  function renderStack(data,width,height,options,layers=[]) {
    if(!Array.isArray(layers)||layers.length>8)throw Error('El proyecto admite hasta 8 zonas.');
    let result=render(data,width,height,{...options,style:'original'});
    for(const layer of layers){
      if(layer.enabled===false)continue;
      const mask=layer.mask;if(mask&&(!(mask instanceof Uint8ClampedArray)||mask.length!==width*height))throw Error('Máscara de zona no válida.');
      const changed=render(result,width,height,{...layer.options,pixelsPerMm:options.pixelsPerMm,protect:options.protect,background:options.background,remove:options.remove,tolerance:options.tolerance});
      if(!mask){result=changed;continue;}
      result=blendMask(result,changed,mask);
    }
    return result;
  }
  function validateProject(meta){
    if(!meta||meta.format!=='momotus-effects-project'||meta.version!==1)throw Error('Proyecto de Efectos no compatible.');
    if(!Array.isArray(meta.layers)||!meta.layers.length||meta.layers.length>8)throw Error('Cantidad de zonas no válida.');
    dimensions(100,100,meta.widthCm);
    for(const layer of meta.layers){if(!styles.includes(layer.options?.style)||!Number.isFinite(layer.options.strength)||layer.options.strength<0||layer.options.strength>100||!Number.isFinite(layer.options.pitch)||layer.options.pitch<0.2||layer.options.pitch>3)throw Error('Ajustes de zona no válidos.');if(layer.options.angle!==undefined&&(!Number.isFinite(layer.options.angle)||Math.abs(layer.options.angle)>180))throw Error('Dirección de puntadas no válida.');if(layer.options.levels!==undefined&&(!Number.isInteger(layer.options.levels)||layer.options.levels<2||layer.options.levels>8))throw Error('Escalones de color no válidos.');}
    return true;
  }
  function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
  function png300(bytes){
    if(!(bytes instanceof Uint8Array)||bytes.length<33||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))throw Error('Archivo PNG no válido.');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),chunks=[];let pos=8;
    const phys=new Uint8Array(21),pv=new DataView(phys.buffer);pv.setUint32(0,9);phys.set([112,72,89,115],4);pv.setUint32(8,11811);pv.setUint32(12,11811);phys[16]=1;pv.setUint32(17,crc32(phys.subarray(4,17)));
    let inserted=false;
    while(pos<bytes.length){if(pos+12>bytes.length)throw Error('PNG incompleto.');const n=view.getUint32(pos);if(n>bytes.length-pos-12)throw Error('PNG incompleto.');const type=String.fromCharCode(...bytes.subarray(pos+4,pos+8));if(type!=='pHYs')chunks.push(bytes.subarray(pos,pos+n+12));if(type==='IHDR'){chunks.push(phys);inserted=true;}pos+=n+12;}
    if(!inserted)throw Error('PNG sin cabecera.');const result=new Uint8Array(8+chunks.reduce((s,c)=>s+c.length,0));result.set(bytes.subarray(0,8));let offset=8;for(const c of chunks){result.set(c,offset);offset+=c.length;}return result;
  }
  return Object.freeze({styles,limits,render,renderStack,blendMask,directionMap:(data,width,height,opts)=>orientation(data,width,height,normalize(opts)),validateProject,normalize,dimensions,png300,crc32});
});
