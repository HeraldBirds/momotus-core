(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./vendor/opentype.min.js'):root.opentype);if(typeof module==='object'&&module.exports)module.exports=api;else root.MomotusTypeCore=api;})(globalThis,OT=>{
'use strict';
const E=typeof module==='object'&&module.exports?require('./studio-core.js'):globalThis.MomotusTypeStudioCore;
const O=typeof module==='object'&&module.exports?require('./objects-core.js'):globalThis.MomotusTypeObjects;
const MAX_LAYERS=30,MAX_CHARS=2500,MAX_COMMANDS=500000;
const number=(v,min,max,label='Valor')=>{if(v===null||typeof v==='boolean'||typeof v==='string'&&!v.trim()||!Number.isFinite(Number(v))||Number(v)<min||Number(v)>max)throw Error(`${label}: usá un valor entre ${min} y ${max}.`);return Number(v);};
const color=v=>{if(typeof v!=='string'||!/^#[0-9a-f]{6}$/i.test(v))throw Error('Color inválido.');return v;};
const xml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const round=v=>Number(v.toFixed(5));
function layer(id,font){return {id,name:'Texto',text:'MOMOTUS',font,x:150,y:100,size:35,tracking:0,lineHeight:1.2,align:'center',rotation:0,scaleX:1,scaleY:1,skew:0,arc:0,kerning:true,fill:'#e8c777',fill2:'#f36a54',gradient:false,gradientAngle:90,outline:0,outlineColor:'#ffffff',outer:0,outerColor:'#101820',shadow:false,shadowX:2,shadowY:2,shadowColor:'#303f55',opacity:100,hollow:false,banded:false,visible:true,locked:false,characters:{}};}
function validate(doc){if(!doc||doc.version!==1||!Array.isArray(doc.layers)||doc.layers.length>MAX_LAYERS)throw Error('Proyecto tipográfico no compatible o más de 30 capas.');for(const key of ['widthCm','heightCm','marginCm','threshold'])if(typeof doc[key]!=='number')throw Error('Las medidas deben ser numéricas.');number(doc.widthCm,1,150,'Ancho');number(doc.heightCm,1,270,'Alto');const width=Math.round(doc.widthCm*300/2.54),height=Math.round(doc.heightCm*300/2.54);if(width*height>200000000||width>32768||height>32768)throw Error('El documento supera 200 MP o 32.768 px por lado. No se reduce su resolución automáticamente.');number(doc.marginCm,0,20,'Margen');if(doc.marginCm*2>=Math.min(doc.widthCm,doc.heightCm))throw Error('El margen ocupa toda la mesa.');if(!['binary','preserve'].includes(doc.alpha)||typeof doc.mirror!=='boolean')throw Error('Opciones de salida inválidas.');number(doc.threshold,1,255,'Umbral');if(!Number.isInteger(doc.threshold))throw Error('El umbral debe ser entero.');const ids=new Set();let chars=0;
for(const p of doc.layers){if(!p||typeof p.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(p.id)||ids.has(p.id)||typeof p.font!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(p.font)||typeof p.name!=='string'||p.name.length>100||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(p.name)||typeof p.text!=='string'||p.text.length>1500||/[\u0000-\u0009\u000b-\u001f]/.test(p.text))throw Error('Capa inválida.');ids.add(p.id);const letters=Array.from(p.text);chars+=letters.length;if(letters.length>500)throw Error('Máximo 500 caracteres por capa.');for(const [k,min,max]of [['x',-3000,3000],['y',-3000,3000],['size',1,1000],['tracking',-50,100],['lineHeight',.3,5],['rotation',-360,360],['scaleX',.05,10],['scaleY',.05,10],['skew',-70,70],['arc',-300,300],['gradientAngle',-360,360],['outline',0,30],['outer',0,30],['shadowX',-100,100],['shadowY',-100,100],['opacity',1,100]]){if(typeof p[k]!=='number')throw Error('Propiedad numérica inválida.');number(p[k],min,max,k);}if(!['left','center','right'].includes(p.align)||['kerning','gradient','shadow','visible','locked'].some(k=>typeof p[k]!=='boolean'))throw Error('Propiedades de capa inválidas.');for(const k of ['fill','fill2','outlineColor','outerColor','shadowColor'])color(p[k]);if(!p.characters||Array.isArray(p.characters)||typeof p.characters!=='object')throw Error('Ajustes por letra inválidos.');for(const [index,c]of Object.entries(p.characters)){if(!/^\d+$/.test(index)||Number(index)>=letters.length||!c||typeof c!=='object')throw Error('Índice de letra inválido.');for(const [k,min,max]of [['x',-200,200],['y',-200,200],['rotation',-360,360],['scale',.05,10]]){if(typeof c[k]!=='number')throw Error('Ajuste numérico de letra inválido.');number(c[k],min,max,k);}if(c.fill!==null)color(c.fill);for(const [k,lo,hi] of [['scaleX',.05,10],['scaleY',.05,10],['skew',-70,70],['spacing',-50,100]])if(c[k]!==undefined){if(typeof c[k]!=='number')throw Error('Ajuste por letra no numérico.');number(c[k],lo,hi,k);}}}
validateAdvanced(doc);
if(chars>MAX_CHARS)throw Error('Máximo 2.500 caracteres por documento.');return {width,height};}
const matrix=p=>{const a=p.rotation*Math.PI/180,k=Math.tan(p.skew*Math.PI/180),cs=Math.cos(a),sn=Math.sin(a);return {a:cs*p.scaleX,b:sn*p.scaleX,c:(cs*k-sn)*p.scaleY,d:(sn*k+cs)*p.scaleY,e:p.x,f:p.y};};
const point=(m,x,y)=>({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});
function transform(path,m){const out=new OT.Path();out.commands=path.commands.map(c=>{const q={type:c.type};for(const keys of [['x','y'],['x1','y1'],['x2','y2']])if(c[keys[0]]!==undefined){const p=point(m,c[keys[0]],c[keys[1]]);q[keys[0]]=p.x;q[keys[1]]=p.y;}return q;});return out;}
function pathData(path){return path.commands.map(c=>{const values=c.type==='C'?[c.x1,c.y1,c.x2,c.y2,c.x,c.y]:c.type==='Q'?[c.x1,c.y1,c.x,c.y]:c.type==='Z'?[]:[c.x,c.y];if(values.some(v=>!Number.isFinite(v)))throw Error('La fuente generó un trazado inválido.');return c.type+values.map(round).join(' ');}).join('');}
// Stable extrema in world coordinates. Avoid near-linear cubic cancellation in font-library bounds.
function pathBounds(path){let box={x1:Infinity,y1:Infinity,x2:-Infinity,y2:-Infinity},prev,start;
 const add=p=>{box.x1=Math.min(box.x1,p.x);box.y1=Math.min(box.y1,p.y);box.x2=Math.max(box.x2,p.x);box.y2=Math.max(box.y2,p.y);};
 const roots=(a,b,c)=>{const eps=1e-12*Math.max(1,Math.abs(a),Math.abs(b),Math.abs(c));if(Math.abs(a)<eps)return Math.abs(b)<eps?[]:[-c/b];const d=b*b-4*a*c;if(d<0)return[];const q=-.5*(b+(b<0?-1:1)*Math.sqrt(d));return q===0?[-b/(2*a)]:[q/a,c/q];};
 for(const c of path.commands){if(c.type==='M'){prev=start={x:c.x,y:c.y};add(prev);continue;}if(c.type==='Z'){prev=start;continue;}const end={x:c.x,y:c.y};add(end);if(prev&&(c.type==='Q'||c.type==='C')){const points=c.type==='Q'?[prev,{x:c.x1,y:c.y1},end]:[prev,{x:c.x1,y:c.y1},{x:c.x2,y:c.y2},end];for(const key of ['x','y']){const v=points.map(p=>p[key]);const candidates=c.type==='Q'?((v[0]-2*v[1]+v[2])===0?[]:[(v[0]-v[1])/(v[0]-2*v[1]+v[2])]):roots(-v[0]+3*v[1]-3*v[2]+v[3],2*(v[0]-2*v[1]+v[2]),v[1]-v[0]);for(const t of candidates)if(t>0&&t<1)add(bezier(points,t));}}prev=end;}
 return Number.isFinite(box.x1)?box:{x1:0,y1:0,x2:0,y2:0};
}

function optionalNumber(p,key,min,max){if(p[key]===undefined)return;if(typeof p[key]!=='number')throw Error(`${key}: se requiere un número.`);number(p[key],min,max,key);}
function validateAdvanced(doc){let segments=0;for(const p of doc.layers){if(p.autoLayout!==undefined&&typeof p.autoLayout!=='boolean')throw Error('Ajuste automático inválido.');if(p.textFit&&(['maxWidth','centerX'].some(k=>typeof p.textFit[k]!=='number'||!Number.isFinite(p.textFit[k]))||p.textFit.maxWidth<=0||p.textFit.maxWidth>3000||Math.abs(p.textFit.centerX)>30000))throw Error('Ajuste de texto inválido.');segments+=O.validate(p,{color});if(segments>MAX_COMMANDS)throw Error('Máximo 500.000 nodos en objetos.');for(const key of ['hollow','banded'])if(p[key]!==undefined&&typeof p[key]!=='boolean')throw Error('Acabado inválido.');
 for(const [key,min,max]of [['textBoxWidth',0,3000],['paragraphGap',0,5],['printScaleX',.01,100],['printScaleY',.01,100],['radius',5,1500],['curveWidth',1,3000],['curveRise1',-1500,1500],['curveRise2',-1500,1500],['waveAmplitude',-300,300],['perspective',-.8,.8],['extrudeX',-100,100],['extrudeY',-100,100],['cutSpacing',.1,100],['cutWidth',.05,30],['cutAngle',-360,360],['cutCount',1,500],['cutSeed',0,2147483647]])optionalNumber(p,key,min,max);
 if(p.shapeMode!==undefined&&!['plain','circle','curve','flag','perspective'].includes(p.shapeMode))throw Error('Composición desconocida.');
 if(p.shadowMode!==undefined&&!['solid','long'].includes(p.shadowMode))throw Error('Sombra desconocida.');if(p.cutMode!==undefined&&!['none','stripes','distress'].includes(p.cutMode))throw Error('Cortes desconocidos.');
 if(p.extrude!==undefined&&typeof p.extrude!=='boolean')throw Error('Extrusión inválida.');if(p.extrudeColor!==undefined)color(p.extrudeColor);
 if(p.group!==undefined&&(typeof p.group!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(p.group)))throw Error('Grupo inválido.');
 if(p.cutCount!==undefined&&!Number.isInteger(p.cutCount)||p.cutSeed!==undefined&&!Number.isInteger(p.cutSeed))throw Error('Cantidad y semilla deben ser enteras.');
 if(p.cutMode==='stripes'&&(p.cutWidth??.5)>=(p.cutSpacing??5))throw Error('El corte debe ser menor que su separación.');
 if(p.extraOutlines!==undefined){if(!Array.isArray(p.extraOutlines)||p.extraOutlines.length>3)throw Error('Máximo tres contornos adicionales.');for(const q of p.extraOutlines){if(!q||typeof q.width!=='number')throw Error('Contorno inválido.');number(q.width,.01,30,'Contorno');color(q.color);}}
 if(p.vector!==undefined){if(!Array.isArray(p.vector)||p.vector.length>500)throw Error('Contornos no válidos.');const indices=new Set();for(const q of p.vector){if(!q||!Number.isInteger(q.index)||q.index<0||q.index>=Array.from(p.text).length||indices.has(q.index)||typeof q.char!=='string'||Array.from(q.char).length!==1||!Array.isArray(q.commands))throw Error('Glifo vectorial inválido.');indices.add(q.index);if(q.fill!==null)color(q.fill);let open=false;
  for(const c of q.commands){if(!c||!['M','L','Q','C','Z'].includes(c.type))throw Error('Nodo vectorial no compatible.');if(c.type!=='M'&&!open)throw Error('El contorno necesita un punto inicial.');if(c.type==='M')open=true;if(c.type==='Z')open=false;
   const keys=c.type==='C'?['x','y','x1','y1','x2','y2']:c.type==='Q'?['x','y','x1','y1']:c.type==='Z'?[]:['x','y'];if(Object.keys(c).some(k=>k!=='type'&&!keys.includes(k)))throw Error('Propiedad de nodo desconocida.');for(const key of keys){if(typeof c[key]!=='number')throw Error('Coordenada de nodo no numérica.');number(c[key],-100000,100000,'Nodo');}if(++segments>MAX_COMMANDS)throw Error('Máximo 500.000 nodos en contornos.');
  }if(open)throw Error('Los contornos de letras deben estar cerrados.');
 }}
}}
function inverse(m){const d=m.a*m.d-m.b*m.c;const norm=Math.max(Math.abs(m.a),Math.abs(m.b),Math.abs(m.c),Math.abs(m.d));if(!Number.isFinite(d)||Math.abs(d)<=Number.EPSILON*norm*norm)throw Error('Transformación no invertible.');return{a:m.d/d,b:-m.b/d,c:-m.c/d,d:m.a/d,e:(m.c*m.f-m.d*m.e)/d,f:(m.b*m.e-m.a*m.f)/d};}
function printMatrix(p){const x=p.printScaleX??1,y=p.printScaleY??1;return{a:x,b:0,c:0,d:y,e:p.x*(1-x),f:p.y*(1-y)};}
function multiply(a,b){return{a:a.a*b.a+a.c*b.b,b:a.b*b.a+a.d*b.b,c:a.a*b.c+a.c*b.d,d:a.b*b.c+a.d*b.d,e:a.a*b.e+a.c*b.f+a.e,f:a.b*b.e+a.d*b.f+a.f};}
function vectorMatrix(p,q){const o=p.characters[q.index];if(!o)return{a:1,b:0,c:0,d:1,e:0,f:0};const path=new OT.Path();path.commands=q.commands;const b=pathBounds(path),cx=(b.x1+b.x2)/2,cy=(b.y1+b.y2)/2,m=matrix({x:0,y:0,scaleX:o.scale*(o.scaleX??1),scaleY:o.scale*(o.scaleY??1),rotation:o.rotation,skew:o.skew||0});m.e=cx+o.x-m.a*cx-m.c*cy;m.f=cy+o.y-m.b*cx-m.d*cy;return m;}
function effectiveMatrix(p){return multiply(printMatrix(p),matrix(p));}
function extendBox(b,x,y){return{x1:Math.min(b.x1,b.x1+x),y1:Math.min(b.y1,b.y1+y),x2:Math.max(b.x2,b.x2+x),y2:Math.max(b.y2,b.y2+y)};}
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
function bezier(points,t){let p=points.map(q=>({...q}));while(p.length>1)p=p.slice(1).map((q,i)=>mix(p[i],q,t));return p[0];}
function flatten(path,map=(x,y)=>({x,y}),tolerance=.005){
 const out=new OT.Path();let prev,start,count=0;
 const append=c=>{if(++count>MAX_COMMANDS)throw Error('La deformación supera 500.000 segmentos.');out.commands.push(c);};
 for(const c of path.commands){if(c.type==='M'){prev=start={x:c.x,y:c.y};const q=map(c.x,c.y);append({type:'M',...q});continue;}if(c.type==='Z'){append({type:'Z'});prev=start;continue;}
  if(!prev)throw Error('Trazado sin origen.');const end={x:c.x,y:c.y},pts=c.type==='C'?[prev,{x:c.x1,y:c.y1},{x:c.x2,y:c.y2},end]:c.type==='Q'?[prev,{x:c.x1,y:c.y1},end]:[prev,end];
  const evaluate=t=>{const q=bezier(pts,t);return map(q.x,q.y);};
  const recurse=(lo,hi,a,b,depth)=>{let error=0;for(const f of [.25,.5,.75]){const p=evaluate(lo+(hi-lo)*f),chord=mix(a,b,f);error=Math.max(error,Math.hypot(p.x-chord.x,p.y-chord.y));}
   if(depth>=20&&error>tolerance)throw Error('No se pudo mantener la precisión de esta curva.');
   if(error<=tolerance&&Math.hypot(b.x-a.x,b.y-a.y)<=2||depth>=20){append({type:'L',x:b.x,y:b.y});return;}const mid=(lo+hi)/2,m=evaluate(mid);recurse(lo,mid,a,m,depth+1);recurse(mid,hi,m,b,depth+1);
  };recurse(0,1,evaluate(0),evaluate(1),0);prev=end;
 }return out;
}
// Cubic baseline with adaptive Simpson integration and inverse arclength.
function baseline(p){const w=p.curveWidth??200,pts=[{x:-w/2,y:0},{x:-w/6,y:p.curveRise1??-40},{x:w/6,y:p.curveRise2??40},{x:w/2,y:0}];
 const derivative=t=>{const a=mix(pts[0],pts[1],t),b=mix(pts[1],pts[2],t),c=mix(pts[2],pts[3],t),d=mix(a,b,t),e=mix(b,c,t);return{x:3*(e.x-d.x),y:3*(e.y-d.y)};},speed=t=>{const d=derivative(t);return Math.hypot(d.x,d.y);};
 function integral(a,b,eps=1e-7){const f=speed,sim=(a,b)=>{const m=(a+b)/2;return(b-a)/6*(f(a)+4*f(m)+f(b));};function rec(a,b,whole,eps,n){const m=(a+b)/2,l=sim(a,m),r=sim(m,b),delta=l+r-whole;if(n===0||Math.abs(delta)<15*eps)return l+r+delta/15;return rec(a,m,l,eps/2,n-1)+rec(m,b,r,eps/2,n-1);}return rec(a,b,sim(a,b),eps,16);}
 const length=integral(0,1);return{length,points:pts,at:distance=>{let lo=0,hi=1;for(let i=0;i<36;i++){const mid=(lo+hi)/2;if(integral(0,mid)<distance)lo=mid;else hi=mid;}const t=(lo+hi)/2,q=bezier(pts,t),d=derivative(t);return{...q,angle:Math.atan2(d.y,d.x)};}};
}
function freezeLayer(p,item,id){const q=structuredClone(p),inv=inverse(matrix(p));q.id=id;q.name=(p.name.slice(0,80)+' · curvas');q.locked=false;q.shapeMode='plain';q.arc=0;q.characters={};q.vector=(item.sourcePaths||item.paths).map(r=>{const path=new OT.Path();path.commands=r.commands;return{index:r.index,char:r.char,fill:r.fill,commands:transform(path,inv).commands};});return q;}
function previousPoint(commands,index){for(let i=index-1;i>=0;i--){const c=commands[i];if(c.type==='Z')break;if(c.x!==undefined)return{x:c.x,y:c.y};}throw Error('Seleccioná un segmento posterior al punto inicial.');}
function splitNode(commands,index){const out=structuredClone(commands),c=out[index];if(!c||c.type==='M'||c.type==='Z')throw Error('Seleccioná un segmento L, Q o C para dividirlo.');const a=previousPoint(out,index),end={x:c.x,y:c.y};let left,right;
 if(c.type==='L'){const m=mix(a,end,.5);left={type:'L',...m};right=c;}
 else if(c.type==='Q'){const u=mix(a,{x:c.x1,y:c.y1},.5),v=mix({x:c.x1,y:c.y1},end,.5),m=mix(u,v,.5);left={type:'Q',x1:u.x,y1:u.y,...m};right={type:'Q',x1:v.x,y1:v.y,...end};}
 else{const b={x:c.x1,y:c.y1},d={x:c.x2,y:c.y2},u=mix(a,b,.5),v=mix(b,d,.5),w=mix(d,end,.5),j=mix(u,v,.5),k=mix(v,w,.5),m=mix(j,k,.5);left={type:'C',x1:u.x,y1:u.y,x2:j.x,y2:j.y,...m};right={type:'C',x1:k.x,y1:k.y,x2:w.x,y2:w.y,...end};}
 out.splice(index,1,left,right);return out;
}
function deleteNode(commands,index){const out=structuredClone(commands),c=out[index];if(!c||!['L','Q','C'].includes(c.type))throw Error('El punto inicial y el cierre protegen el contorno. Elegí otro nodo.');let a=index;while(a>0&&out[a].type!=='M')a--;let b=index;while(b<out.length&&out[b].type!=='Z')b++;if(b-a<=3)throw Error('El contorno necesita al menos tres segmentos.');out.splice(index,1);return out;}
function resizeLayer(p,item,width,height,lock=true){const b=item.box,w=b.x2-b.x1,h=b.y2-b.y1;if(w<=0||h<=0)throw Error('La capa no tiene medidas válidas.');number(width,.1,3000,'Ancho impreso');number(height,.1,3000,'Alto impreso');const sx=width/w,sy=lock?sx:height/h;
 p.printScaleX=(p.printScaleX??1)*sx;p.printScaleY=(p.printScaleY??1)*sy;
 // Keep the centre of the printed bounds fixed.
 p.x+=(1-sx)*((b.x1+b.x2)/2-p.x);p.y+=(1-sy)*((b.y1+b.y2)/2-p.y);return p;
}
function alignLayers(doc,layout,ids,action){const items=layout.layers.filter(q=>ids.includes(q.layer.id));if(items.length<2)throw Error('Seleccioná al menos dos capas visibles.');if(items.some(q=>q.layer.locked))throw Error('Desbloqueá las capas de la selección.');
 const bounds={x1:Math.min(...items.map(q=>q.box.x1)),x2:Math.max(...items.map(q=>q.box.x2)),y1:Math.min(...items.map(q=>q.box.y1)),y2:Math.max(...items.map(q=>q.box.y2))};
 if(action.startsWith('distribute')){if(items.length<3)throw Error('Seleccioná al menos tres capas para distribuir.');const horizontal=action.endsWith('x'),a=horizontal?'x1':'y1',b=horizontal?'x2':'y2',axis=horizontal?'x':'y',sorted=[...items].sort((p,q)=>p.box[a]-q.box[a]),space=(bounds[b]-bounds[a]-items.reduce((n,q)=>n+q.box[b]-q.box[a],0))/(items.length-1);if(space<0)throw Error('No hay espacio para distribuir sin superposición. Separá primero las capas.');let pos=bounds[a];for(const item of sorted){doc.layers.find(p=>p.id===item.layer.id)[axis]+=pos-item.box[a];pos+=item.box[b]-item.box[a]+space;}}
 else for(const item of items){const p=doc.layers.find(p=>p.id===item.layer.id),b=item.box;if(action==='left')p.x+=bounds.x1-b.x1;else if(action==='right')p.x+=bounds.x2-b.x2;else if(action==='center')p.x+=(bounds.x1+bounds.x2-b.x1-b.x2)/2;else if(action==='top')p.y+=bounds.y1-b.y1;else if(action==='bottom')p.y+=bounds.y2-b.y2;else if(action==='middle')p.y+=(bounds.y1+bounds.y2-b.y1-b.y2)/2;else throw Error('Alineación desconocida.');}
}

function compose(doc,fontMap){
 validate(doc);const result=[],warnings=[];let commands=0;
 for(const p of doc.layers){
  if(!p.visible||!p.text.trim())continue;
  if(p.objects){const item=O.compose(p,{matrix,printMatrix,multiply,point,pathBounds,transform,pathData});if(item){commands+=item.paths.reduce((n,q)=>n+q.commands.length,0);if(commands>MAX_COMMANDS)throw Error('Máximo 500.000 segmentos.');if(item.box.x1<doc.marginCm*10||item.box.y1<doc.marginCm*10||item.box.x2>doc.widthCm*10-doc.marginCm*10||item.box.y2>doc.heightCm*10-doc.marginCm*10)warnings.push(p.name+': invade el margen o sale del documento.');result.push(item);}continue;}
  const global=matrix(p),paths=[],mode=p.shapeMode||'plain';
  const append=(source,index,char,fill)=>{
   const path=transform(source,global);commands+=path.commands.length;
   if(commands>MAX_COMMANDS)throw Error('Los trazados superan 500.000 segmentos. Dividí la composición sin reducir la calidad.');
   if(path.commands.length)paths.push({index,char,d:pathData(path),fill:fill||null,box:pathBounds(path),commands:path.commands});
  };
  if(p.vector){for(const q of p.vector){const path=new OT.Path();path.commands=q.commands;append(transform(path,vectorMatrix(p,q)),q.index,q.char,p.characters[q.index]?.fill||q.fill);}}
  else{
   const font=fontMap.get(p.font)?.font||fontMap.get(p.font);if(!font)throw Error(`Falta la fuente de «${p.name}».`);
   if(/[\u0590-\u109f\u1780-\u17ff\u200e-\u200f\u202a-\u202e\u2066-\u2069]/.test(p.text)||/\p{M}/u.test(p.text))throw Error('Este texto necesita composición contextual o marcas combinadas que esta versión no admite. Usá letras latinas precompuestas para conservar su forma.');
   const unsupported=new Set();for(const ch of Array.from(p.text))if(!/\s/.test(ch)&&!font.charToGlyphIndex(ch))unsupported.add(ch);
   if(unsupported.size)throw Error(`${p.name}: la fuente no contiene ${[...unsupported].slice(0,10).join(' ')}. Elegí otra fuente para esas letras.`);
   let index=0,lineNumber=0;const rows=E.lines(p.text,p,font);
   for(const row of rows){const text=row.text;
    const chars=Array.from(text),glyphs=chars.map(c=>font.charToGlyph(c));
    const advances=glyphs.map((g,i)=>g.advanceWidth/font.unitsPerEm*p.size+(p.kerning&&i+1<glyphs.length?font.getKerningValue(g,glyphs[i+1])/font.unitsPerEm*p.size:0)+(i+1<glyphs.length?p.tracking+(p.characters[row.indices[i]]?.spacing||0):0));
    const total=advances.reduce((a,b)=>a+b,0),align=p.align==='left'?0:p.align==='center'?total/2:total;
    if(['circle','curve','flag','perspective'].includes(mode)&&rows.length>1)throw Error('Esta composición admite una línea por capa. Separá las líneas en capas.');
    if(mode==='circle'&&Math.abs(total)/(p.radius||80)>Math.PI*2)throw Error('El texto supera una vuelta. Aumentá el radio o reducí el cuerpo.');
    const curve=mode==='curve'?baseline(p):null;
    if(curve&&total>curve.length+.01)throw Error('El texto no cabe en la curva. Aumentá su ancho o reducí el cuerpo.');
    let cursor=0;
    for(let i=0;i<chars.length;i++){index=row.indices[i];
     const g=glyphs[i],advance=g.advanceWidth/font.unitsPerEm*p.size,o=p.characters[index]||{x:0,y:0,rotation:0,scale:1,fill:null};
     let x=cursor-align,y=lineNumber*p.size*p.lineHeight,angle=0,shift=0;
     if(mode==='circle'){
      const radius=p.radius||80;angle=(cursor+advance/2-total/2)/radius;shift=advance/2;x=radius*Math.sin(angle)+total/2-align;y+=radius*(1-Math.cos(angle));
     }else if(curve){
      const q=curve.at((curve.length-total)/2+cursor+advance/2);x=q.x;y=q.y;angle=q.angle;shift=advance/2;
     }else if(Math.abs(p.arc)>.001&&Math.abs(total)>.001){
      const radians=p.arc*Math.PI/180,radius=total/radians,t=cursor+advance/2-total/2;angle=t/radius;x=radius*Math.sin(angle)+total/2-align;y+=radius*(1-Math.cos(angle));shift=advance/2;
     }
     const theta=angle+o.rotation*Math.PI/180,co=Math.cos(theta),si=Math.sin(theta),sx=o.scale*(o.scaleX??1),sy=o.scale*(o.scaleY??1),sk=Math.tan((o.skew||0)*Math.PI/180);
     const local={a:co*sx,b:si*sx,c:(co*sk-si)*sy,d:(si*sk+co)*sy,e:x+o.x-co*sx*shift,f:y+o.y-si*sx*shift};
     let source=transform(g.getPath(0,0,p.size),local);
     if(mode==='flag'||mode==='perspective'){
      const center=total/2-align,w=Math.max(Math.abs(total),1),amp=p.waveAmplitude??10,amount=p.perspective??.35;
      const warp=(x,y)=>{if(mode==='flag')return {x,y:y+amp*Math.sin(2*Math.PI*(x+align)/w)};const d=1+amount*(x-center)/w;return{x:center+(x-center)/d,y:y/d};};
      // Flatten only nonlinear deformations, measuring error in final world millimetres.
      const inv=inverse(global);source=flatten(source,(x,y)=>{const q=warp(x,y);return point(global,q.x,q.y);},.0025/Math.max(1,p.printScaleX??1,p.printScaleY??1));source=transform(source,inv);
     }
     append(source,index,chars[i],o.fill);cursor+=advances[i];
    }lineNumber+=1+(row.paragraphAfter?(p.paragraphGap||0):0);
   }
  }
  if(!paths.length)continue;
  const radius=p.outline+p.outer+(p.extraOutlines||[]).reduce((s,q)=>s+q.width,0);
  let box={x1:Math.min(...paths.map(q=>q.box.x1))-radius,y1:Math.min(...paths.map(q=>q.box.y1))-radius,x2:Math.max(...paths.map(q=>q.box.x2))+radius,y2:Math.max(...paths.map(q=>q.box.y2))+radius};
  const inkBox={...box};if(p.extrude)box=extendBox(inkBox,p.extrudeX??3,p.extrudeY??3);
  if(p.shadow){const shadowBox=extendBox(inkBox,p.shadowX,p.shadowY);box={x1:Math.min(box.x1,shadowBox.x1),y1:Math.min(box.y1,shadowBox.y1),x2:Math.max(box.x2,shadowBox.x2),y2:Math.max(box.y2,shadowBox.y2)};}
  const sourceBox={...box},sourcePaths=paths,post=printMatrix(p);
  const finalPaths=(p.printScaleX??1)===1&&(p.printScaleY??1)===1?paths:paths.map(q=>{const path=new OT.Path();path.commands=q.commands;const t=transform(path,post);return{...q,d:pathData(t),box:pathBounds(t),commands:t.commands};});
  box={x1:point(post,box.x1,box.y1).x,y1:point(post,box.x1,box.y1).y,x2:point(post,box.x2,box.y2).x,y2:point(post,box.x2,box.y2).y};
  if(box.x1<doc.marginCm*10||box.y1<doc.marginCm*10||box.x2>doc.widthCm*10-doc.marginCm*10||box.y2>doc.heightCm*10-doc.marginCm*10)warnings.push(`${p.name}: invade el margen o sale del documento.`);
  result.push({layer:p,paths:finalPaths,box,sourcePaths,sourceBox});
 }
 return {layers:result,warnings,commands};
}
function artwork(doc,layout,interactive=false){
 let defs='',body='';
 for(const item of layout.layers){
  if(item.layer.objects){const a=O.artwork(item.layer,{matrix,point,effectiveMatrix,multiply,pathBounds,pathData,transform,xml},interactive);defs+=a.defs;body+=a.body;continue;}
  const p=item.layer,paths=item.sourcePaths||item.paths,box=item.sourceBox||item.box,id='gradient-'+p.id;
  if(p.gradient){const a=p.gradientAngle*Math.PI/180,cx=(box.x1+box.x2)/2,cy=(box.y1+box.y2)/2,dx=Math.cos(a)*(box.x2-box.x1)/2,dy=Math.sin(a)*(box.y2-box.y1)/2;defs+=`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${cx-dx}" y1="${cy-dy}" x2="${cx+dx}" y2="${cy+dy}"><stop stop-color="${p.fill}"/>${p.banded?`<stop offset=".78" stop-color="${p.fill}"/><stop offset=".78" stop-color="${p.fill2}"/>`:''}<stop offset="1" stop-color="${p.fill2}"/></linearGradient>`;}
  const attrs=q=>interactive?` data-edit-layer="${p.id}" data-edit-letter="${q.index}"`:'';
  const shapes=(fill,stroke,width,targets=false)=>paths.map(q=>`<path d="${q.d}" fill="${fill}"${stroke?` stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"`:''}${targets?attrs(q):''}/>`).join('');
  let content='';const total=p.outline+p.outer+(p.extraOutlines||[]).reduce((n,q)=>n+q.width,0);
  const sweep=(dx,dy,color)=>{
   let d='',count=0;
   for(const q of paths){const path=new OT.Path();path.commands=q.commands;const flat=flatten(path,(x,y)=>({x,y}),.0025/Math.max(1,p.printScaleX??1,p.printScaleY??1));let prev,start;
    for(const c of flat.commands){if(c.type==='M'){prev=start={x:c.x,y:c.y};continue;}const end=c.type==='Z'?start:{x:c.x,y:c.y};if(!prev||!end)continue;
     if(++count>100000)throw Error('La extrusión supera 100.000 segmentos. Simplificá las capas o el acabado.');
     const vertices=[prev,end,{x:end.x+dx,y:end.y+dy},{x:prev.x+dx,y:prev.y+dy}];if((end.x-prev.x)*dy-(end.y-prev.y)*dx<0)vertices.reverse();d+=vertices.map((v,i)=>(i?'L':'M')+round(v.x)+' '+round(v.y)).join('')+'Z';prev=end;
    }
   }
   return `<g fill="${color}" stroke="${color}" stroke-width="${total*2}" stroke-linejoin="round"><path d="${d}" fill-rule="nonzero"/><g transform="translate(${dx} ${dy})">${shapes(color,color,total*2)}</g></g>`;
  };
  if(p.shadow){if(p.shadowMode==='long')content+=sweep(p.shadowX,p.shadowY,p.shadowColor);else content+=`<g transform="translate(${p.shadowX} ${p.shadowY})">${shapes(p.shadowColor,p.shadowColor,total*2)}</g>`;}
  if(p.extrude)content+=sweep(p.extrudeX??3,p.extrudeY??3,p.extrudeColor||'#30465e');
  let width=total;for(const q of [...(p.extraOutlines||[])].reverse()){content+=shapes('none',q.color,width*2);width-=q.width;}
  if(p.outer)content+=shapes('none',p.outerColor,(p.outline+p.outer)*2);if(p.outline)content+=shapes('none',p.outlineColor,p.outline*2);
  content+=paths.map(q=>`<path d="${q.d}" fill="${p.hollow?'none':q.fill||(p.gradient?'url(#'+id+')':p.fill)}"${attrs(q)}/>`).join('');
  let mask='';if(p.cutMode&&p.cutMode!=='none'){
   const midX=(box.x1+box.x2)/2,midY=(box.y1+box.y2)/2,span=Math.hypot(box.x2-box.x1,box.y2-box.y1)*2+10,maskId='cut-'+p.id;
   let holes='';if(p.cutMode==='stripes'){
    const spacing=p.cutSpacing??5,size=p.cutWidth??.5,count=Math.floor(span/spacing)+1;if(count>2000)throw Error('Demasiados cortes. Aumentá la separación.');
    for(let i=0;i<count;i++){const x=-span/2+i*spacing;holes+=`<rect x="${x}" y="${-span/2}" width="${size}" height="${span}"/>`;}
    holes=`<g transform="translate(${midX} ${midY}) rotate(${p.cutAngle??25})">${holes}</g>`;
   }else{
    let seed=p.cutSeed??17;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<(p.cutCount??50);i++)holes+=`<circle cx="${box.x1+random()*(box.x2-box.x1)}" cy="${box.y1+random()*(box.y2-box.y1)}" r="${(p.cutWidth??.5)/2}"/>`;
   }
   const clipId='cut-bounds-'+p.id;defs+=`<clipPath id="${clipId}"><rect x="${box.x1+.05}" y="${box.y1+.05}" width="${Math.max(0,box.x2-box.x1-.1)}" height="${Math.max(0,box.y2-box.y1-.1)}"/></clipPath><mask id="${maskId}" maskUnits="userSpaceOnUse" x="${box.x1-1}" y="${box.y1-1}" width="${box.x2-box.x1+2}" height="${box.y2-box.y1+2}"><rect x="${box.x1-1}" y="${box.y1-1}" width="${box.x2-box.x1+2}" height="${box.y2-box.y1+2}" fill="white"/><g fill="black" clip-path="url(#${clipId})">${holes}</g></mask>`;mask=` mask="url(#${maskId})"`;
  }
  const post=printMatrix(p);body+=`<g transform="matrix(${post.a} 0 0 ${post.d} ${post.e} ${post.f})" opacity="${p.opacity/100}"${mask}><title>${xml(p.name)}</title>${content}</g>`;
 }
 if(doc.mirror)body=`<g transform="translate(${doc.widthCm*10} 0) scale(-1 1)">${body}</g>`;
 return {defs,body};
}
function svg(doc,layout,physical=true){const {width,height}=validate(doc),a=artwork(doc,layout);return `<svg xmlns="http://www.w3.org/2000/svg" width="${physical?doc.widthCm+'cm':width}" height="${physical?doc.heightCm+'cm':height}" viewBox="0 0 ${doc.widthCm*10} ${doc.heightCm*10}"><title>Composición tipográfica Momotus Core</title><defs>${a.defs}</defs>${a.body}</svg>`;}
function mirrorPixels(data,width,rows){if(!Number.isInteger(width)||!Number.isInteger(rows)||width<1||rows<1||data.length!==width*rows*4)throw Error('Franja de espejo inválida.');if(data.byteOffset%4===0){const pixels=new Uint32Array(data.buffer,data.byteOffset,data.byteLength/4);for(let y=0;y<rows;y++)for(let x=0;x<Math.floor(width/2);x++){const a=y*width+x,b=y*width+width-1-x,t=pixels[a];pixels[a]=pixels[b];pixels[b]=t;}}else for(let y=0;y<rows;y++)for(let x=0;x<Math.floor(width/2);x++)for(let k=0;k<4;k++){const a=(y*width+x)*4+k,b=(y*width+width-1-x)*4+k,t=data[a];data[a]=data[b];data[b]=t;}return data;}
function physicalBox(box,doc){return doc.mirror?{...box,x1:doc.widthCm*10-box.x2,x2:doc.widthCm*10-box.x1}:box;}
return Object.freeze({MAX_LAYERS,MAX_CHARS,number,color,xml,layer,validate,matrix,point,transform,pathData,compose,artwork,svg,mirrorPixels,physicalBox,inverse,printMatrix,effectiveMatrix,flatten,baseline,freezeLayer,splitNode,deleteNode,resizeLayer,alignLayers,validateAdvanced,multiply,vectorMatrix,pathBounds});
});
