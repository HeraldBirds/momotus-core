const test=require('node:test'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const C=require('../herramientas/preparacion/core.js');
const image=(w,h,color=[200,30,40,255])=>{const a=new Uint8ClampedArray(w*h*4);for(let i=0;i<a.length;i+=4)a.set(color,i);return a;};
const full=(w,h)=>[{x:0,y:0},{x:w,y:0},{x:w,y:h},{x:0,y:h}];
test('medidas positivas y límites sin reducción silenciosa',()=>{
 assert.equal(C.cmToPx(2.54),300);assert.equal(C.pxToCm(300),2.54);
 for(const v of ['',null,' ',true,NaN,Infinity])assert.throws(()=>C.number(v,0,10,'Dato'));
 assert.throws(()=>C.dimensions(9000,9000));assert.throws(()=>C.dimensions(16385,1));assert.deepEqual(C.dimensions(9001,2),{width:9001,height:2});
});
test('inspector mide DPI efectivos, márgenes y transparencia al tamaño real',()=>{
 const a=image(10,8,[0,0,0,0]);for(let y=2;y<6;y++)for(let x=3;x<8;x++)a.set([90,80,70,255],(y*10+x)*4);
 const r=C.analyze(a,10,8,{widthCm:2.54,minDpi:300,detailMm:.25});assert.equal(r.effectiveDpi,10);assert.equal(r.heightCm,2.032);assert.equal(r.transparentPixels,60);assert.deepEqual(r.bounds,{x:3,y:2,width:5,height:4});assert.deepEqual(r.margins,{left:3,top:2,right:2,bottom:2});assert.ok(r.warnings.some(s=>s.includes('Resolución')));
});
test('inspector distingue vacío, semitransparencia, píxeles y diagonales conectadas',()=>{
 const a=image(5,5,[0,0,0,0]);a.set([255,255,255,255],0);a.set([10,10,10,100],24*4);let r=C.analyze(a,5,5,{widthCm:.1,minDpi:1,detailMm:.1});assert.equal(r.isolatedPixels,1);assert.equal(r.partialPixels,1);
 a.set([255,255,255,255],6*4);r=C.analyze(a,5,5,{widthCm:.1,minDpi:1,detailMm:.1});assert.equal(r.isolatedPixels,0);
 r=C.analyze(image(2,2,[0,0,0,0]),2,2,{widthCm:1,minDpi:300,detailMm:.25});assert.equal(r.bounds,null);assert.equal(r.transparentPixels,4);
});
function verifyPack(l,count){const placed=l.pages.flatMap(p=>p.placements);assert.equal(placed.length,count);assert.equal(new Set(placed.map(p=>p.source+':'+p.copy)).size,count);for(const page of l.pages)for(let i=0;i<page.placements.length;i++){const a=page.placements[i];assert.ok(a.x>=l.margin&&a.y>=l.margin);assert.ok(a.x+a.width<=l.width-l.margin&&a.y+a.height<=l.height-l.margin);for(const b of page.placements.slice(i+1))assert.ok(a.x+a.width+l.gap<=b.x||b.x+b.width+l.gap<=a.x||a.y+a.height+l.gap<=b.y||b.y+b.height+l.gap<=a.y,'Sin superposición y con separación');}}
test('montaje conserva cantidades, márgenes, separación y determinismo',()=>{
 const items=[{widthCm:4,heightCm:3,quantity:11},{widthCm:6,heightCm:8,quantity:7}],opts={widthCm:20,heightCm:25,marginCm:.5,gapCm:.3,rotate:true};const l=C.pack(items,opts);verifyPack(l,18);assert.deepEqual(C.pack(items,opts),l);assert.equal(l.totalMeters,C.pxToCm(l.height)*l.pages.length/100);
});
test('montaje gira cuando es necesario y rechaza referencias imposibles o cantidades no enteras',()=>{
 const l=C.pack([{widthCm:8,heightCm:4,quantity:1}],{widthCm:5,heightCm:10,marginCm:0,gapCm:0,rotate:true});assert.equal(l.pages[0].placements[0].rotated,true);verifyPack(l,1);
 for(const rotate of [false])assert.throws(()=>C.pack([{widthCm:8,heightCm:4,quantity:1}],{widthCm:5,heightCm:10,marginCm:0,gapCm:0,rotate}));
 for(const q of [0,1.5,501])assert.throws(()=>C.pack([{widthCm:2,heightCm:2,quantity:q}],{widthCm:10,heightCm:10,marginCm:0,gapCm:0}));
 assert.throws(()=>C.pack([{widthCm:2,heightCm:2,quantity:1}],{widthCm:2,heightCm:2,marginCm:1,gapCm:0}));
 assert.throws(()=>C.pack([{widthCm:2,heightCm:2,quantity:1}],{widthCm:58,heightCm:100,marginCm:0,gapCm:0}));
});
test('100 pedidos variados respetan separación y límites en todas las hojas',()=>{
 let seed=12345;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 for(let k=0;k<100;k++){const items=Array.from({length:12},()=>({widthCm:1+random()*8,heightCm:1+random()*12,quantity:1+Math.floor(random()*4)}));const l=C.pack(items,{widthCm:20,heightCm:25,marginCm:.5,gapCm:.3,rotate:k%2===0});verifyPack(l,items.reduce((s,i)=>s+i.quantity,0));}
});
test('extracción de imagen completa a tamaño nativo conserva todos los RGBA',()=>{
 const a=image(8,7);for(let i=0;i<a.length;i++)a[i]=(i*19)%256;
 const b=C.extract(a,8,7,{points:full(8,7),width:8,height:7});assert.deepEqual(b,a);
});
test('recorte y transformación de perspectiva respetan esquinas y muestreo',()=>{
 const a=image(4,4);for(let y=0;y<4;y++)for(let x=0;x<4;x++)a.set([x*50,y*50,10,255],(y*4+x)*4);
 const b=C.extract(a,4,4,{points:[{x:1,y:1},{x:3,y:1},{x:3,y:3},{x:1,y:3}],width:2,height:2});assert.deepEqual([...b.slice(0,4)],[50,50,10,255]);assert.deepEqual([...b.slice(12,16)],[100,100,10,255]);
 const q=[{x:.3,y:.2},{x:3.7,y:.5},{x:3,y:3.8},{x:.1,y:3}],H=C.homography(q);for(const [i,[u,v]]of [[0,[0,0]],[1,[1,0]],[2,[1,1]],[3,[0,1]]]){const d=H[6]*u+H[7]*v+1;assert.ok(Math.abs((H[0]*u+H[1]*v+H[2])/d-q[i].x)<1e-8);assert.ok(Math.abs((H[3]*u+H[4]*v+H[5])/d-q[i].y)<1e-8);}
});
test('selecciones cruzadas, degeneradas y fuera del original se rechazan',()=>{
 assert.throws(()=>C.quad([{x:0,y:0},{x:4,y:4},{x:4,y:0},{x:0,y:4}],4,4));assert.throws(()=>C.quad(full(8,7),4,4));assert.throws(()=>C.quad([{x:1,y:1},{x:1,y:1},{x:2,y:2},{x:2,y:2}],4,4));
});
test('interpolación premultiplicada evita halos negros en transparencia',()=>{
 const a=new Uint8ClampedArray([255,0,0,255,0,0,0,0]),b=new Uint8ClampedArray(4);C.sample(a,2,1,.5,0,b,0);assert.deepEqual([...b],[255,0,0,128]);
});
test('fondo conectado conserva blancos internos y modo global los elimina',()=>{
 const a=image(5,5,[255,255,255,255]);for(let y=1;y<=3;y++)for(let x=1;x<=3;x++)if(x===1||x===3||y===1||y===3)a.set([255,0,0,255],(y*5+x)*4);
 const b=a.slice();C.removeBackground(b,5,5,[255,255,255],0,true);assert.equal(b[3],0);assert.equal(b[(2*5+2)*4+3],255);assert.equal(b[(1*5+1)*4+3],255);
 C.removeBackground(a,5,5,[255,255,255],0,false);assert.equal(a[(2*5+2)*4+3],0);
});
test('exportación por franjas supera 8000 px, conserva alfa y escribe 300 DPI',async()=>{
 const w=9001,h=2;const blob=await C.png(w,h,async(y,rows)=>image(w,rows,[50,100,150,128]));const bytes=Buffer.from(await blob.arrayBuffer());assert.equal(bytes.readUInt32BE(16),w);assert.equal(bytes.readUInt32BE(20),h);let pos=8,phys=null,idat=[];
 while(pos<bytes.length){const n=bytes.readUInt32BE(pos),type=bytes.toString('ascii',pos+4,pos+8),payload=bytes.subarray(pos+8,pos+8+n);assert.equal(C.crc32(bytes.subarray(pos+4,pos+8+n)),bytes.readUInt32BE(pos+8+n));if(type==='pHYs')phys=[payload.readUInt32BE(0),payload.readUInt32BE(4),payload[8]];if(type==='IDAT')idat.push(payload);pos+=12+n;}
 assert.deepEqual(phys,[11811,11811,1]);const raw=zlib.inflateSync(Buffer.concat(idat));assert.equal(raw.length,h*(w*4+1));for(let y=0;y<h;y++){assert.equal(raw[y*(w*4+1)],0);for(const x of [0,w-1])assert.deepEqual([...raw.subarray(y*(w*4+1)+1+x*4,y*(w*4+1)+5+x*4)],[50,100,150,128]);}
});
