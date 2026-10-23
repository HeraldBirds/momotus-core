const {test}=require('node:test'),assert=require('node:assert/strict'),C=require('../herramientas/js/tools-color-zones-core.js');
const o=(tolerance=0,softness=0)=>({target:{r:0,g:0,b:0},tolerance,softness});
function source(w,h,fn){const a=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)a.set(fn(x,y),(y*w+x)*4);return a;}
const alpha=a=>Uint8Array.from({length:a.length/4},(_,i)=>a[i*4+3]);
test('analizar resalta islas de negro separadas sin eliminar ni alterar la fuente',()=>{const a=source(12,7,(x,y)=>[x<3||x>8?0:230,x<3||x>8?0:40,x<3||x>8?0:20,255]),before=a.slice(),r=C.analyze(a,12,7,o());assert.equal(r.regions.length,2);assert.equal(r.total,42);assert.equal(r.labels[0],1);assert.equal(r.labels[11],2);assert.equal(r.labels[6],0);assert.deepEqual(a,before);assert.equal(r.labels[r.regions[1].seed],2);});
test('conectividad de cuatro vecinos no une píxeles por una esquina',()=>{const a=source(3,3,(x,y)=>[0,0,0,x===y?255:0]),r=C.analyze(a,3,3,o());assert.equal(r.regions.length,3);assert.equal(r.total,3);});
test('seleccionar una isla elimina solo esa isla y conserva todos los canales fuera de ella',()=>{const a=source(8,4,x=>x<2||x>5?[0,0,0,255]:[200,50,80,128]),r=C.analyze(a,8,4,o()),selected=C.selection(r.labels,[1]),result=C.preview(a,8,4,o(),alpha(a),selected),data=C.compose(a,8,4,result.alpha);assert.equal(result.affected,8);for(let i=0;i<32;i++){assert.deepEqual(data.slice(i*4,i*4+3),a.slice(i*4,i*4+3));assert.equal(data[i*4+3],r.labels[i]===1?0:a[i*4+3]);}assert.equal(result.partial,16);});
test('una franja protegida separa dos partes negras que estaban conectadas',()=>{const a=source(9,5,()=>[0,0,0,255]),protect=new Uint8Array(45);for(let y=0;y<5;y++)protect[y*9+4]=255;const r=C.analyze(a,9,5,o(),alpha(a),null,protect);assert.equal(r.regions.length,2);const result=C.preview(a,9,5,o(),alpha(a),C.selection(r.labels,[1,2]),null,protect);for(let y=0;y<5;y++)assert.equal(result.alpha[y*9+4],255);assert.equal(result.affected,40);});
test('el lazo limita el análisis y la eliminación al área encerrada',()=>{const a=source(10,10,()=>[0,0,0,255]),allowed=C.polygon(10,10,[{x:2,y:2},{x:7,y:2},{x:7,y:6},{x:2,y:6}]),r=C.analyze(a,10,10,o(),alpha(a),allowed);assert.equal(r.total,20);const result=C.preview(a,10,10,o(),alpha(a),new Uint8Array(100).fill(255),allowed);assert.equal(result.affected,20);for(let i=0;i<100;i++)assert.equal(result.alpha[i],allowed[i]?0:255);});
test('un lazo cóncavo conserva la escotadura y es independiente de su orientación',()=>{const ps=[{x:1,y:1},{x:6,y:1},{x:6,y:3},{x:3,y:3},{x:3,y:6},{x:1,y:6}],a=C.polygon(8,8,ps),b=C.polygon(8,8,[...ps].reverse());assert.deepEqual(a,b);assert.equal(a[4*8+4],0);assert.equal(a[4*8+2],255);assert.throws(()=>C.polygon(5,5,[{x:1,y:1},{x:2,y:2}]),/tres/);});
test('suavidad cero elimina con alfa sólido sin crear opacidades intermedias',()=>{const a=source(10,3,x=>[x*10,x*10,x*10,255]),r=C.preview(a,10,3,o(45),alpha(a),new Uint8Array(30).fill(255));assert.ok([...r.alpha].every(a=>a===0||a===255));assert.equal(r.partial,0);});
test('suavidad explícita atenúa solo la selección y nunca aumenta el alfa original',()=>{const a=source(10,2,x=>[x*10,x*10,x*10,128]),selected=new Uint8Array(20).fill(255);selected[1]=0;const r=C.preview(a,10,2,o(5,100),alpha(a),selected);assert.equal(r.alpha[1],128);assert.ok([...r.alpha].every(a=>a<=128));assert.ok(r.partial>0);assert.equal(r.alpha[0],0);});
test('el color objetivo puede ser rojo y conserva el negro del diseño',()=>{const a=source(6,2,x=>x<3?[255,0,0,255]:[0,0,0,255]),options={...o(),target:{r:255,g:0,b:0}},r=C.analyze(a,6,2,options);assert.equal(r.total,6);const p=C.preview(a,6,2,options,alpha(a),C.selection(r.labels,[1]));assert.equal(p.alpha[0],0);assert.equal(p.alpha[5],255);});
test('pincel continuo interpola la trayectoria sin huecos y respeta la protección',()=>{const mask=new Uint8Array(50*10);C.stroke(mask,50,10,[{x:2,y:5},{x:48,y:5}],2,255,i=>i%50!==25);for(let x=2;x<48;x++)assert.equal(mask[5*50+x],x===25?0:255);C.stroke(mask,50,10,[{x:10,y:5}],3,0);assert.equal(mask[5*50+10],0);assert.throws(()=>C.stroke(mask,50,10,[{x:NaN,y:1}],2,255));});
test('la transparencia inicial no se convierte en una zona seleccionable',()=>{const a=source(4,3,()=>[0,0,0,0]),r=C.analyze(a,4,3,o());assert.equal(r.total,0);assert.equal(r.regions.length,0);});
test('sin selección o con protección completa no se altera el resultado',()=>{const a=source(6,3,(x,y)=>[0,0,0,(x+y)%2?128:255]),before=a.slice();for(const [selected,protect]of [[new Uint8Array(18),null],[new Uint8Array(18).fill(255),new Uint8Array(18).fill(255)]]){const r=C.preview(a,6,3,o(),alpha(a),selected,null,protect);assert.equal(r.affected,0);assert.deepEqual(C.compose(a,6,3,r.alpha),a);}assert.deepEqual(a,before);});
test('cien imágenes aleatorias coinciden con un recorrido independiente de componentes',()=>{let seed=31;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);for(let run=0;run<100;run++){const w=19,h=13,a=source(w,h,()=>rand()<.45?[0,0,0,255]:[255,255,255,255]),r=C.analyze(a,w,h,o()),seen=new Set(),counts=[];for(let i=0;i<w*h;i++){if(seen.has(i)||a[i*4]!==0)continue;const stack=[i];seen.add(i);let count=0;while(stack.length){const p=stack.pop();count++;const x=p%w,y=Math.floor(p/w);for(const q of [x?p-1:-1,x+1<w?p+1:-1,y?p-w:-1,y+1<h?p+w:-1])if(q>=0&&!seen.has(q)&&a[q*4]===0){seen.add(q);stack.push(q);}}counts.push(count);}assert.deepEqual(r.regions.map(r=>r.count).sort((a,b)=>a-b),counts.sort((a,b)=>a-b));assert.equal(r.total,seen.size);}});
test('límites y máscaras inválidas se rechazan sin reducir dimensiones',()=>{C.dimensions(12000,1500);C.dimensions(16000,1000);assert.throws(()=>C.dimensions(5000,4000),/No se reduce/);assert.throws(()=>C.dimensions(17000,1));assert.throws(()=>C.analyze(new Uint8ClampedArray(4),1,1,o(-1)));assert.throws(()=>C.preview(new Uint8ClampedArray(16),2,2,o(),new Uint8Array(2)));});

test('seleccionar zonas pequeñas mide el área real y nunca incluye transparencia sin analizar',()=>{
 const a=source(10,5,(x,y)=>x===0||x>=5&&y<=1?[0,0,0,255]:[255,255,255,255]),before=a.slice(),r=C.analyze(a,10,5,o());
 assert.deepEqual(r.regions.map(r=>r.count),[5,10]);
 const small=C.smallRegions(r.labels,r.regions,5);
 assert.equal([...small].filter(Boolean).length,5);
 const result=C.preview(a,10,5,o(),alpha(a),small);
 assert.equal(result.affected,5);assert.deepEqual(a,before);
 assert.ok([...C.smallRegions(r.labels,r.regions,4)].every(v=>v===0));
 assert.equal([...C.smallRegions(r.labels,r.regions,10)].filter(Boolean).length,15);
 for(const value of [0,-1,1.2,NaN,Infinity,18000001])assert.throws(()=>C.smallRegions(r.labels,r.regions,value));
});

test('invertir solo alcanza coincidencias editables y conserva protección, lazo y máscaras de entrada',()=>{
 const labels=new Uint32Array([1,1,2,2,0,3]),selected=new Uint8Array([255,0,0,0,255,0]),allowed=new Uint8Array([255,255,255,0,255,255]),protect=new Uint8Array([0,0,255,0,0,0]),before=selected.slice();
 const inverted=C.invertSelection(labels,selected,allowed,protect);
 assert.deepEqual(inverted,new Uint8Array([0,255,0,0,0,255]));assert.deepEqual(selected,before);
 assert.deepEqual(C.invertSelection(labels,inverted,allowed,protect),new Uint8Array([255,0,0,0,0,0]));
 assert.throws(()=>C.invertSelection(labels,new Uint8Array(1)),/Máscara/);
});

test('el recuento distingue selección efectiva de áreas protegidas o excluidas',()=>{
 const selected=new Uint8Array([255,255,255,0]),allowed=new Uint8Array([255,255,0,255]),protect=new Uint8Array([0,255,0,255]);
 assert.deepEqual(C.maskSummary(selected,allowed,protect),{selected:1,protected:2});
 assert.deepEqual(C.maskSummary(selected),{selected:3,protected:0});
 assert.throws(()=>C.maskSummary(selected,new Uint8Array(1)),/Máscara/);
});

test('cien inversiones aleatorias respetan el análisis sin cambiar RGB ni recuperar opacidad',()=>{
 let seed=97;const rand=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let run=0;run<100;run++){
  const w=13,h=9,n=w*h,a=source(w,h,()=>rand()<.6?[0,0,0,Math.floor(rand()*255)+1]:[255,255,255,255]),base=alpha(a),protect=Uint8Array.from({length:n},()=>rand()<.1?255:0),allowed=Uint8Array.from({length:n},()=>rand()<.9?255:0),r=C.analyze(a,w,h,o(),base,allowed,protect),selected=Uint8Array.from({length:n},()=>rand()<.5?255:0),before=a.slice(),inverse=C.invertSelection(r.labels,selected,allowed,protect),result=C.compose(a,w,h,C.preview(a,w,h,o(),base,inverse,allowed,protect).alpha);
  for(let i=0;i<n;i++){assert.equal(inverse[i],r.labels[i]&&!selected[i]&&allowed[i]&&!protect[i]?255:0);assert.deepEqual(result.slice(i*4,i*4+3),a.slice(i*4,i*4+3));assert.ok(result[i*4+3]<=a[i*4+3]);if(protect[i]||!allowed[i]||!r.labels[i])assert.equal(result[i*4+3],a[i*4+3]);}
  assert.deepEqual(a,before);
 }
});

test('el filtro de zonas pequeñas usa píxeles de tinta, no el rectángulo que los contiene',()=>{
 const a=source(5,5,(x,y)=>x===0||y===0?[0,0,0,255]:[255,255,255,255]),r=C.analyze(a,5,5,o());
 assert.equal(r.regions[0].count,9);assert.equal(r.regions[0].width*r.regions[0].height,25);
 assert.equal([...C.smallRegions(r.labels,r.regions,9)].filter(Boolean).length,9);
 assert.equal([...C.smallRegions(r.labels,r.regions,8)].filter(Boolean).length,0);
});
