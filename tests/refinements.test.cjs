const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../herramientas/js/tools-color-zones-core.js'),P=require('../herramientas/js/tools-raster-project.js'),Preparation=require('../herramientas/preparacion/core.js'),D=require('../herramientas/pliegos/diagnostics-core.js');
const {IDBFactory}=require('fake-indexeddb');
const options={target:{r:0,g:0,b:0},tolerance:0,softness:0};
const pixels=colors=>new Uint8ClampedArray(colors.flat()),plane=(n,v=255)=>new Uint8Array(n).fill(v);

test('muestras múltiples suman colores y las exclusiones tienen prioridad sin alterar el original',()=>{
 const data=pixels([[0,0,0,255],[255,0,0,255],[255,255,255,255],[0,0,0,128]]),before=data.slice(),o={...options,include:[{r:255,g:0,b:0}],exclude:[{r:0,g:0,b:0}]},r=C.analyze(data,4,1,o),alpha=Uint8Array.from([255,255,255,128]);
 assert.equal(r.total,1);assert.equal(r.labels[1],1);const result=C.preview(data,4,1,o,alpha,plane(4));assert.deepEqual(result.alpha,new Uint8Array([255,0,255,128]));assert.deepEqual(data,before);
});
test('muestras inválidas y grupos excesivos se rechazan',()=>{for(const extra of [{include:Array(13).fill(options.target)},{exclude:[{r:-1,g:0,b:0}]},{include:'negro'}])assert.throws(()=>C.matcher({...options,...extra}));});
test('el pincel suave mezcla solo alfa seleccionado y no modifica RGB ni protección',()=>{
 const data=pixels(Array.from({length:25},()=>[0,0,0,200])),selected=plane(25,0),protect=plane(25,0);protect[12]=255;
 C.featherStroke(selected,5,5,[{x:2.5,y:2.5}],2,'paint',0);
 assert.equal(selected[12],255);assert.ok(selected.some(v=>v>0&&v<255));const r=C.preview(data,5,5,options,plane(25,200),selected,null,protect);assert.equal(r.alpha[12],200);assert.ok(r.alpha.some(v=>v>0&&v<200));assert.deepEqual(data,pixels(Array.from({length:25},()=>[0,0,0,200])));
});
test('la dureza total conserva selección binaria y la recuperación nunca supera el alfa original',()=>{
 const m=plane(49,0);C.featherStroke(m,7,7,[{x:3.5,y:3.5}],3,'paint',100);assert.ok(m.every(v=>v===0||v===255));C.featherStroke(m,7,7,[{x:3.5,y:3.5}],2,'erase',0);assert.equal(m[24],0);const original=plane(49,123),a=plane(49,0);C.featherStroke(a,7,7,[{x:3.5,y:3.5}],3,'restore',0,null,original);assert.equal(a[24],123);assert.ok(a.every(v=>v<=123));
});
test('expandir y contraer coinciden con un filtro independiente y respetan lazos y protección',()=>{
 let seed=77;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let run=0;run<60;run++){const w=7,h=6,r=1+run%3,m=Uint8Array.from({length:w*h},()=>Math.floor(rand()*256)),allowed=Uint8Array.from({length:w*h},()=>rand()<.8?255:0),protect=Uint8Array.from({length:w*h},()=>rand()<.15?255:0),before=m.slice();
  for(const mode of ['grow','shrink']){const actual=C.morph(m,w,h,r,mode,allowed,protect),expected=plane(w*h,0);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!allowed[i]||protect[i])continue;let v=mode==='grow'?0:255;for(let yy=y-r;yy<=y+r;yy++)for(let xx=x-r;xx<=x+r;xx++){const j=yy*w+xx,b=xx>=0&&xx<w&&yy>=0&&yy<h&&allowed[j]&&!protect[j]?m[j]:0;v=mode==='grow'?Math.max(v,b):Math.min(v,b);}expected[i]=v;}assert.deepEqual(actual,expected);}
  assert.deepEqual(m,before);
 }
});
test('expandir requiere selección explícita para eliminar los colores vecinos',()=>{const data=pixels([[0,0,0,255],[255,0,0,255],[255,255,255,255]]),selected=C.morph(new Uint8Array([255,0,0]),3,1,1,'grow');assert.deepEqual(C.preview(data,3,1,options,plane(3),selected).alpha,new Uint8Array([0,255,255]));assert.deepEqual(C.preview(data,3,1,{...options,selectionOnly:true},plane(3),selected).alpha,new Uint8Array([0,0,255]));});
test('limpieza de halos cambia solo RGB de píxeles seleccionados afectados y respeta protección',()=>{
 const data=pixels([[200,150,150,255],[200,150,150,255],[200,150,150,255],[10,20,30,128]]),before=data.slice(),alpha=new Uint8Array([128,128,255,128]),selected=plane(4),protect=new Uint8Array([0,255,0,0]),o={...options,target:{r:255,g:255,b:255}};
 const cleaned=C.cleanHalo(data,4,1,new Uint8Array([255,255,255,128]),alpha,selected,null,protect,o);
 assert.notDeepEqual(cleaned.slice(0,3),data.slice(0,3));assert.deepEqual(cleaned.slice(4),data.slice(4));assert.deepEqual(data,before);for(let i=3;i<data.length;i+=4)assert.equal(cleaned[i],data[i]);
});
test('la mezcla de Calidad mantiene el origen fuera de la máscara y conserva todo el alfa',()=>{
 const base=pixels([[20,40,60,128],[10,20,30,255],[2,4,6,0]]),adjusted=pixels([[220,240,160,0],[110,120,130,0],[200,200,200,255]]),before=base.slice();
 assert.deepEqual(C.blendLocal(base,adjusted,new Uint8Array([0,255,255])),pixels([[20,40,60,128],[110,120,130,255],[2,4,6,0]]));const half=C.blendLocal(base,adjusted,new Uint8Array([128,0,0]));assert.equal(half[3],128);assert.deepEqual(half.slice(4),base.slice(4));assert.deepEqual(base,before);
});
function project(){return{width:2,height:2,filename:'original-prueba',sourceFile:new File([new Uint8Array([137,80,78,71])],'exacto.png',{type:'image/png'}),originalData:pixels([[0,0,0,255],[200,100,100,128],[255,255,255,255],[10,20,30,0]]),rgba:null,alpha:new Uint8Array([255,64,0,0]),selected:new Uint8Array([0,128,255,0]),allowed:plane(4),protect:new Uint8Array([255,0,0,0]),settings:{color:'#000000',tolerance:'35',softness:'0',scope:'selected',include:[{r:30,g:30,b:30}],exclude:[{r:200,g:100,b:100}],hardness:75,halo:true,selectionOnly:false},protections:[{name:'Cara',mask:new Uint8Array([255,0,0,0])}]};}
test('el proyecto recupera bytes originales, selección suave, exclusiones y protecciones sin recomprimir',async()=>{const p=project(),blob=await P.pack(p),loaded=await P.open(blob);assert.deepEqual(new Uint8Array(await loaded.sourceFile.arrayBuffer()),new Uint8Array(await p.sourceFile.arrayBuffer()));for(const key of ['originalData','alpha','selected','allowed','protect'])assert.deepEqual(loaded[key],p[key]);assert.deepEqual(loaded.protections,p.protections);assert.deepEqual(loaded.settings,p.settings);assert.equal(loaded.sourceName,'exacto.png');});
test('un CRC incorrecto o un proyecto truncado se rechaza sin modificar los datos anteriores',async()=>{const p=project(),before=p.originalData.slice(),blob=await P.pack(p),bytes=new Uint8Array(await blob.arrayBuffer());bytes[bytes.length-1]^=255;await assert.rejects(P.open(new Blob([bytes])),/CRC/);await assert.rejects(P.open(blob.slice(0,blob.size-1)),/inválido|incompleto/);assert.deepEqual(p.originalData,before);});
test('el proyecto rechaza alfa aumentado, protecciones grises y muestras defectuosas',()=>{for(const change of [p=>p.alpha[3]=255,p=>p.protect[0]=128,p=>p.settings.include=[{r:999,g:0,b:0}],p=>p.protections.push({name:'Cara',mask:plane(4)})]){const p=project();change(p);assert.throws(()=>P.validate(p));}});
test('el guardado local confirma transacciones completas y recupera el último proyecto',async()=>{global.indexedDB=new IDBFactory();const blob=await P.pack(project());await P.local('save',blob);const result=await P.local('load');assert.deepEqual(new Uint8Array(await result.arrayBuffer()),new Uint8Array(await blob.arrayBuffer()));delete global.indexedDB;});
test('una transacción abortada no sobrescribe el proyecto anterior y la cola permite seguir',async()=>{
 const factory=new IDBFactory();global.indexedDB=factory;const previous=new Blob(['anterior']);await P.local('save',previous);const open=factory.open.bind(factory);factory.open=(...args)=>{const r=open(...args);r.addEventListener('success',()=>{const db=r.result,transaction=db.transaction.bind(db);db.transaction=(...args)=>{const tx=transaction(...args),store=tx.objectStore.bind(tx);tx.objectStore=(...args)=>{const s=store(...args),put=s.put.bind(s);s.put=(...args)=>{const req=put(...args);req.addEventListener('success',()=>tx.abort());return req;};return s;};return tx;};});return r;};await assert.rejects(P.local('save',new Blob(['no guardar'])));factory.open=open;assert.equal(await (await P.local('load')).text(),'anterior');await P.local('save',new Blob(['recuperado']));assert.equal(await (await P.local('load')).text(),'recuperado');delete global.indexedDB;
});
test('la inspección de Pliegos considera los dos ejes al cambiar proporciones',()=>{const data=pixels(Array.from({length:100},()=>[30,40,50,255]));const report=Preparation.analyze(data,10,10,{widthCm:2.54,heightCm:5.08,minDpi:300,detailMm:.25});assert.equal(report.effectiveDpiX,10);assert.equal(report.effectiveDpiY,5);assert.equal(report.effectiveDpi,5);assert.equal(report.heightCm,5.08);});
test('los avisos por referencia distinguen baja resolución, alfa y detalles sin corregirlos automáticamente',()=>{const report={partialPixels:3,isolatedPixels:1,shortHorizontalRuns:2,shortVerticalRuns:0,bounds:{x:0,y:0,width:2,height:2}},before=structuredClone(report),summary=D.summarize(report,180);assert.equal(summary.lowResolution,true);assert.equal(summary.partial,true);assert.equal(summary.thin,true);assert.equal(summary.empty,false);assert.equal(summary.messages.length,4);assert.deepEqual(report,before);});


test('la inversión conserva transiciones suaves y recupera la máscara al invertir dos veces',()=>{const labels=new Uint32Array([1,1,1,1]),mask=new Uint8Array([0,64,128,255]);const inverted=C.invertSelection(labels,mask);assert.deepEqual(inverted,new Uint8Array([255,191,127,0]));assert.deepEqual(C.invertSelection(labels,inverted),mask);});
test('un proyecto con limpieza de color conserva RGB corregido y alfa independiente',async()=>{const p=project();p.rgba=p.originalData.slice();p.rgba[4]=50;const loaded=await P.open(await P.pack(p));assert.deepEqual(loaded.rgba,p.rgba);assert.deepEqual(loaded.alpha,p.alpha);assert.deepEqual(loaded.originalData,p.originalData);});
test('las dimensiones imposibles se rechazan antes de leer o reservar los segmentos',async()=>{const meta=new TextEncoder().encode(JSON.stringify({format:'momotus-color-range',version:1,width:16384,height:16384,segments:Array(6).fill({}),protections:[]})),prefix=new Uint8Array([77,67,82,65,78,71,79,49,0,0,0,0]);new DataView(prefix.buffer).setUint32(8,meta.length);await assert.rejects(P.open(new Blob([prefix,meta])),/18 MP/);});
