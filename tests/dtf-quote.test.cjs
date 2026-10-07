const test = require('node:test');
const assert = require('node:assert/strict');
const {calculate,parseList,quoteText} = require('../herramientas/js/tools-team-quote.js');
const reference = overrides => ({detail:'Logo Academia',type:'logo',width:10,height:10,quantity:12,garment:'camiseta',size:'M',...overrides});

test('logos y fotos usan sus medidas, cantidades y aplicación por estampado',()=>{
 const result=calculate([reference(),reference({detail:'Foto familiar',type:'foto',width:20,height:25,quantity:2})],{meterCost:200,pressCost:5,setupCost:20,profit:20});
 assert.equal(result.valid,true);assert.equal(result.pieces,14);assert.equal(result.layout.placements.length,14);assert.equal(result.applicationCost,70);
 assert.equal(result.productionCost,result.billedMeters*200+70+20);assert.equal(result.total,result.productionCost/0.8);
 assert.match(quoteText(result),/Logo Academia.*10 × 10 cm.*12 copias/);assert.match(quoteText(result),/Prendas y envío no incluidos/);
});

test('se respeta separación cero y se redondea hacia arriba a 10 cm',()=>{
 const zero=calculate([reference({width:10,height:10,quantity:2})],{rollWidth:20,margin:0,gap:0,rotate:false});
 assert.equal(zero.valid,true);assert.equal(zero.layout.rawLength,10);assert.equal(zero.billedMeters,0.1);
 const gap=calculate([reference({width:10,height:10,quantity:2})],{rollWidth:20,margin:0,gap:1,rotate:false});
 assert.equal(gap.layout.rawLength,21);assert.equal(gap.billedMeters,0.3);
});

test('la rotación es opcional y los diseños que no caben invalidan la cotización',()=>{
 const item=reference({width:40,height:10,quantity:1});
 assert.equal(calculate([item],{rollWidth:30,rotate:false}).valid,false);
 const rotated=calculate([item],{rollWidth:30,rotate:true});assert.equal(rotated.valid,true);assert.equal(rotated.layout.placements[0].rotated,true);
 assert.equal(calculate([reference({width:40,height:40,quantity:1})],{rollWidth:30}).valid,false);
});

test('cantidades fraccionarias, dimensiones vacías y costos negativos no se cotizan',()=>{
 for(const item of [reference({quantity:1.5}),reference({quantity:0}),reference({width:NaN}),reference({detail:''})])assert.equal(calculate([item]).valid,false);
 assert.equal(calculate([reference()],{pressCost:-1}).valid,false);
 assert.equal(calculate([reference()],{profit:100}).valid,false);
});

test('sin costos se comparte un pedido con precio pendiente',()=>{
 const result=calculate([reference()]);assert.equal(result.hasCosts,false);
 const message=quoteText(result,'Monimbó');assert.match(message,/Precio pendiente/);assert.doesNotMatch(message,/Total.*C\$/);
});

test('un pedido vacío no cobra preparación',()=>{
 const result=calculate([],{setupCost:100});assert.equal(result.valid,true);assert.equal(result.productionCost,0);assert.equal(result.total,0);assert.equal(result.hasCosts,false);
 assert.throws(()=>quoteText(result));
});

test('importación de referencias admite medidas decimales y texto con separadores',()=>{
 const result=parseList('"Logo; Academia"; logo; 10,5; 10; 12; camiseta; M\nFoto familiar, fotografía, 20, 25, 2, hoodie, L');
 assert.equal(parseList('"Logo; rojo", logo, 10, 10, 1')[0].detail,'Logo; rojo');
 assert.equal(result.length,2);assert.equal(result[0].detail,'Logo; Academia');assert.equal(result[0].width,10.5);assert.equal(result[1].quantity,2);assert.equal(result[1].type,'foto');
});

test('una lista mal formada se rechaza completa e identifica la línea',()=>{
 assert.throws(()=>parseList('Logo; logo; 10; 10; 12\nFoto; foto; 20; 25; 1.5'),/Línea 2/);
 assert.throws(()=>parseList('Logo; desconocido; 10; 10; 1'),/tipo/);
 assert.throws(()=>parseList('Logo; logo; 10; 10; 1; camiseta; ABC'),/talla/);
});

test('importar equipos crea nombre y número como piezas separadas',()=>{
 const result=parseList('Carlos; 10; M\nMaría; 7; S','team');assert.equal(result.length,4);assert.match(result[0].detail,/Carlos/);assert.match(result[1].detail,/Número 10/);assert.equal(result[1].width,30.5);assert.equal(result[3].width,13.2);
 assert.equal(calculate(result).pieces,4);assert.throws(()=>parseList('Carlos; X; M','team'),/número/);
});

test('límites de referencias y copias evitan pedidos incompletos o excesivos',()=>{
 assert.equal(calculate(Array.from({length:101},()=>reference({quantity:1}))).valid,false);
 assert.equal(calculate(Array.from({length:6},()=>reference({quantity:1000}))).valid,false);
});

test('las piezas nunca se solapan y respetan ancho, margen y separación',()=>{
 const result=calculate([reference({width:13,height:8,quantity:11}),reference({width:21,height:17,quantity:5})],{rollWidth:57,gap:1,margin:0.5});
 assert.equal(result.valid,true);
 for(const piece of result.layout.placements){assert.ok(piece.x>=0.5);assert.ok(piece.y>=0.5);assert.ok(piece.x+piece.width<=56.5+1e-8);assert.ok(piece.y+piece.height<=result.layout.rawLength-0.5+1e-8);}
 const pieces=result.layout.placements;
 for(let i=0;i<pieces.length;i++)for(let j=i+1;j<pieces.length;j++){
  const a=pieces[i],b=pieces[j];assert.ok(a.x+a.width+1<=b.x+1e-8||b.x+b.width+1<=a.x+1e-8||a.y+a.height+1<=b.y+1e-8||b.y+b.height+1<=a.y+1e-8);
 }
});

const {createTeamReferences,teamMeasurements,parseTeamMembers} = require('../herramientas/js/tools-team-quote.js');

test('plantilla Equipo calcula nombres y números por integrante y copias',()=>{
 const refs=createTeamReferences([{id:'a',name:'Carlos',number:'10',size:'M',garment:'camiseta',quantity:2},{id:'b',name:'María',number:'7',size:'S',garment:'hoodie'}]);
 assert.equal(refs.length,4);assert.equal(refs[1].width,30.5);assert.equal(refs[3].width,13.2);
 const result=calculate(refs,{pressCost:5});assert.equal(result.valid,true);assert.equal(result.pieces,6);assert.equal(result.applicationCost,30);
});

test('un integrante puede llevar solo nombre o solo número y conserva ceros iniciales',()=>{
 const refs=createTeamReferences([{name:'Carlos',number:''},{name:'',number:'007'}]);
 assert.equal(refs.length,2);assert.match(refs[1].detail,/007/);assert.equal(calculate(refs).pieces,2);
 assert.throws(()=>createTeamReferences([{name:'',number:''}]),/nombre o número/);
 assert.throws(()=>createTeamReferences([{name:'Carlos',number:'A7'}]),/dígitos/);
});

test('medidas editadas de un equipo se aplican al cálculo sin alterar las sugeridas',()=>{
 const suggested=teamMeasurements('M','10');assert.equal(suggested.nameWidth,27);
 const refs=createTeamReferences([{name:'Carlos',number:'10',size:'M',nameWidth:23,nameHeight:4,numberWidth:18,numberHeight:22}]);
 assert.equal(refs[0].width,23);assert.equal(refs[1].height,22);assert.equal(refs[1].width,18);
 assert.equal(teamMeasurements('S','7').numberHeight,24);
 assert.throws(()=>createTeamReferences([{name:'Carlos',nameWidth:NaN}]),/ancho y alto/);
});

test('lista de integrantes admite prenda y copias y rechaza errores sin truncar',()=>{
 const members=parseTeamMembers('Carlos; 10; M; hoodie; 2\nMaría; 7; S');
 assert.equal(members[0].garment,'hoodie');assert.equal(members[0].quantity,2);assert.equal(calculate(createTeamReferences(members)).pieces,6);
 assert.throws(()=>parseTeamMembers('Carlos; 10; M\nMaría; X; S'),/Línea 2/);
 assert.throws(()=>parseTeamMembers('Carlos; 10; M; camiseta; 1.5'),/entero/);
});

test('pedido mixto de equipo y logos comparte todos los estampados y el nombre del equipo',()=>{
 const refs=createTeamReferences([{name:'Carlos',number:'10',teamLabel:'Academia Monimbó'}]);
 const result=calculate([reference({quantity:12}),...refs]);assert.equal(result.valid,true);assert.equal(result.pieces,14);
 assert.match(quoteText(result),/Equipo: Academia Monimbó/);
 assert.throws(()=>createTeamReferences(Array.from({length:51},()=>({name:'Carlos'}))),/50 integrantes/);
});

test('comparar tres distribuciones elige el menor largo válido sin solapar piezas',()=>{
 const refs=[reference({width:11,height:23,quantity:3}),reference({detail:'Texto',type:'texto',width:30,height:5,quantity:5}),reference({detail:'Foto',type:'foto',width:17,height:19,quantity:2})];
 const result=calculate(refs,{rollWidth:57,gap:1,margin:.5,rotate:true});assert.equal(result.valid,true);assert.equal(result.alternatives.length,3);assert.equal(result.layout.rawLength,Math.min(...result.alternatives.filter(l=>!l.unplaced.length).map(l=>l.rawLength)));
 for(const layout of result.alternatives){assert.equal(layout.placements.length,10);for(let i=0;i<layout.placements.length;i++){const a=layout.placements[i];assert.ok(a.x>=.5&&a.x+a.width<=56.5+1e-8);for(let j=i+1;j<layout.placements.length;j++){const b=layout.placements[j];assert.ok(a.x+a.width<=b.x+1e-8||b.x+b.width<=a.x+1e-8||a.y+a.height<=b.y+1e-8||b.y+b.height<=a.y+1e-8);}}}
});
test('ubicación identifica la referencia y valores desconocidos se rechazan',()=>{const result=calculate([reference({location:'espalda'})]);assert.equal(result.valid,true);assert.match(quoteText(result),/espalda/);assert.equal(calculate([reference({location:'desconocida'})]).valid,false);});
