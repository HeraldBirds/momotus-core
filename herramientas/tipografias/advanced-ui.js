/* Advanced inspector and handles. All operations use the same validated model/history/export. */
window.MomotusTypeAdvancedUI=function(A){
 'use strict';
 const {C,$,clone}=A,S=A.state,defaults={x:0,y:0,rotation:0,scale:1,scaleX:1,scaleY:1,skew:0,spacing:0,fill:null};
 let mode='text',drag=null,beforeView=null,showBefore=false,node=null,nodePage=0,multi=new Set(),lastSelected=null;
 const fmt=v=>Number(v.toFixed(5)),escape=C.xml,activeItem=()=>S().layout?.layers.find(q=>q.layer.id===S().selected);
 const currentChar=(p=S().active)=>({...defaults,...p?.characters[S().letterIndex]});
 const writable=()=>S().active&&!S().active.locked&&!S().busy&&!S().drag&&!drag&&!showBefore;
 function value(id,v){if(document.activeElement!==$(id))$(id).value=v;}
 function activateMode(next){if(drag)finish(true);mode=next;showBefore=false;if(next!=='text')$('tab-letters').click();A.sync();A.draw();}
 for(const key of ['text','letter','nodes'])$('mode-'+key).onclick=()=>activateMode(key);
 function nodeContext(){const p=S().active,q=p?.vector?.find(q=>q.index===S().letterIndex),command=node&&q?.commands[node.command];return{p,q,command};}
 const nodeMatrix=(p,q)=>C.multiply(C.effectiveMatrix(p),C.vectorMatrix(p,q));
 function nodePosition(p,q,c,part){return C.point(nodeMatrix(p,q),c[part],c[part==='x'?'y':part==='x1'?'y1':'y2']);}
 function editPoint(p,q,index,part,world,linked=true){const c=q.commands[index],m=C.inverse(nodeMatrix(p,q)),pos=C.point(m,world.x,world.y),y=part==='x'?'y':part==='x1'?'y1':'y2',dx=pos.x-c[part],dy=pos.y-c[y];
  c[part]=pos.x;c[y]=pos.y;
  if(part==='x'){
   // Move attached cubic handles with the anchor, including the closing start anchor.
   if(c.type==='C'){c.x2+=dx;c.y2+=dy;}const next=q.commands[index+1];if(next?.type==='C'){next.x1+=dx;next.y1+=dy;}
   if(c.type==='M'){let end=index+1;while(end<q.commands.length&&q.commands[end].type!=='Z')end++;const last=q.commands[end-1];if(last&&last!==c&&Math.abs(last.x-(pos.x-dx))<1e-7&&Math.abs(last.y-(pos.y-dy))<1e-7){last.x+=dx;last.y+=dy;if(last.type==='C'){last.x2+=dx;last.y2+=dy;}}}
  }else if(linked&&c.type==='C'){
   if(part==='x2'){const n=q.commands[index+1];if(n?.type==='C'){n.x1=2*c.x-c.x2;n.y1=2*c.y-c.y2;}}
   else if(part==='x1'){const prev=q.commands[index-1];if(prev?.type==='C'){prev.x2=2*prev.x-c.x1;prev.y2=2*prev.y-c.y1;}}
  }
 }
 function syncNodes(p,editable){
  const oldGlyph=$('node-glyph').value;const glyphs=p?.vector||[];
  const signature=glyphs.map(q=>q.index+':'+q.char).join('|');
  if($('node-glyph').dataset.signature!==signature){$('node-glyph').replaceChildren(...glyphs.map(q=>new Option(`${q.index+1} · ${q.char}`,q.index)));$('node-glyph').dataset.signature=signature;}
  $('node-glyph').value=String(S().letterIndex);const q=glyphs.find(q=>q.index===S().letterIndex);
  if(q){nodePage=Math.max(0,Math.min(Math.ceil(q.commands.length/100)-1,nodePage));if(node&&node.command>=q.commands.length)node=null;
   const start=nodePage*100,end=Math.min(start+100,q.commands.length),options=[];
   for(let i=start;i<end;i++){const c=q.commands[i];for(const part of ['x','x1','x2'])if(c[part]!==undefined)options.push(new Option(`${i+1} · ${c.type} · ${part==='x'?'nodo':part==='x1'?'manejador 1':'manejador 2'}`,i+':'+part));}
   const signature=options.map(o=>o.value).join('|');if($('node-select').dataset.signature!==signature){$('node-select').replaceChildren(...options);$('node-select').dataset.signature=signature;}
   if(!node||node.command<start||node.command>=end){const first=options[0]?.value.split(':');node=first?{command:Number(first[0]),part:first[1]}:null;}
   if(node){$('node-select').value=node.command+':'+node.part;const c=q.commands[node.command],point=nodePosition(p,q,c,node.part);value('node-x',fmt(point.x));value('node-y',fmt(point.y));}
   value('node-page',nodePage+1);$('node-page').max=Math.ceil(q.commands.length/100);$('node-info').textContent=`Copia en curvas · ${q.commands.length} comandos en esta letra · página ${nodePage+1} de ${Math.ceil(q.commands.length/100)}. El texto original se conserva en otra capa.`;
  }else{$('node-select').replaceChildren();node=null;$('node-info').textContent='Creá una copia en curvas para editar nodos y manejadores. El texto original queda protegido en una capa oculta.';}
  for(const id of ['node-glyph','node-select','node-x','node-y','node-page','node-linked','node-split','node-delete'])$(id).disabled=!editable||!q||id!=='node-glyph'&&!node;
  if(node){$('node-split').disabled=!editable||!['L','Q','C'].includes(q.commands[node.command].type);$('node-delete').disabled=!editable||node.part!=='x'||!['L','Q','C'].includes(q.commands[node.command].type);}
  $('convert-curves').disabled=!editable||!!(p?.vector||p?.objects)||!activeItem();
 }
 function sync(){
  refreshStyleSource();
  const {doc,active:p,busy,selected}=S();for(const id of ['add','jersey','save','save-local','restore-local'])$(id).disabled=busy||!!drag||showBefore;const editable=!!p&&!p.locked&&!busy&&!S().drag&&!drag&&!showBefore,character=currentChar(p),item=activeItem();
  for(const id of ['width','height','margin','alpha','mirror','open'])$(id).disabled=busy||!!drag||showBefore;
  $('layer-name').disabled=!editable;for(const id of ['size','tracking','lineHeight','align','kerning','arc'])$(id).disabled=!editable||!!(p?.vector||p?.objects);
  if(lastSelected!==selected){lastSelected=selected;node=null;nodePage=0;multi=new Set(p?.group?doc.layers.filter(q=>q.group===p.group).map(q=>q.id):p?[p.id]:[]);}
  for(const key of ['text','letter','nodes']){$('mode-'+key).setAttribute('aria-pressed',String(key===mode));$('mode-'+key).disabled=busy||!!drag;}
  if(p?.objects){$('mode-letter').disabled=true;$('mode-nodes').disabled=true;}
  $('edit-hint').textContent=showBefore?'ANTES · referencia visual. Volvé a Después para editar o exportar.':mode==='nodes'?(p?.vector?'Contornos · elegí una letra y arrastrá nodos o manejadores.':'Contornos · creá una copia en curvas desde el inspector Letras.'):mode==='letter'?'Letra · clic para seleccionar; tiradores para tamaño, giro e inclinación.':'Texto · mové capas o grupos. Tiradores para tamaño, giro e inclinación.';
  for(const id of ['text','font-open','font-variant','font-import','apply-preset'])$(id).disabled=!editable||!!(p?.vector||p?.objects);
  document.querySelectorAll('[data-case]').forEach(e=>e.disabled=!editable||!!(p?.vector||p?.objects));
  for(const id of ['exact-fields','advanced-letter-fields','finish-fields','composition-fields','group-fields'])$(id).disabled=!editable;
  $('composition-fields').disabled=!editable||!!(p?.vector||p?.objects);
  $('node-fields').hidden=mode!=='nodes';$('letter-properties').hidden=mode==='nodes';$('advanced-letter-fields').hidden=mode==='nodes';const heading=$('pane-letters').querySelector('h2');heading.textContent=mode==='nodes'?'Contornos y nodos':'Editar cada letra';if(p?.vector)$('font-info').textContent='Copia en curvas · para cambiar el texto, seleccioná la capa original.';
  $('letter-properties').disabled=!editable||!p?.text.replace(/\n/g,'');
  for(const key of ['scaleX','scaleY','skew','spacing'])value('char-'+key,character[key]);$('char-spacing').disabled=!editable||!!(p?.vector||p?.objects);
  const fieldMap={'shape-mode':['shapeMode','plain'],'shape-radius':['radius',80],'shape-width':['curveWidth',200],'shape-rise1':['curveRise1',-40],'shape-rise2':['curveRise2',40],'shape-wave':['waveAmplitude',10],'shape-perspective':['perspective',.35],'shadow-mode':['shadowMode','solid'],'extrude-x':['extrudeX',3],'extrude-y':['extrudeY',3],'extrude-color':['extrudeColor','#30465e'],'cut-mode':['cutMode','none'],'cut-width':['cutWidth',.5],'cut-spacing':['cutSpacing',5],'cut-angle':['cutAngle',25],'cut-count':['cutCount',50],'cut-seed':['cutSeed',17]};
  for(const [id,[key,fallback]]of Object.entries(fieldMap))value(id,p?.[key]??fallback);$('extrude').checked=p?.extrude||false;for(const id of ['extrude-x','extrude-y','extrude-color'])$(id).disabled=!editable||!p?.extrude;$('shadow-mode').disabled=!editable||!p?.shadow;const cutMode=p?.cutMode||'none';for(const id of ['cut-width','cut-spacing','cut-angle','cut-count','cut-seed'])$(id).closest('label').hidden=id==='cut-width'?cutMode==='none':['cut-spacing','cut-angle'].includes(id)?cutMode!=='stripes':cutMode!=='distress';
  for(const e of document.querySelectorAll('[data-shape]'))e.hidden=e.dataset.shape!==(p?.shapeMode||'plain');
  if(item){value('exact-width',fmt((item.box.x2-item.box.x1)/10));value('exact-height',fmt((item.box.y2-item.box.y1)/10));$('exact-info').textContent=`Escala impresa X: ${fmt(p.printScaleX??1)} × · Y: ${fmt(p.printScaleY??1)} ×`;}
  const outlines=p?.extraOutlines||[],signature=JSON.stringify(outlines)+'|'+editable;
  if($('outline-list').dataset.signature!==signature){$('outline-list').dataset.signature=signature;$('outline-list').replaceChildren(...outlines.map((q,i)=>{
   const row=document.createElement('div');row.className='outline-row';const input=document.createElement('input');Object.assign(input,{type:'number',min:'.01',max:'30',step:'.1',value:q.width,disabled:!editable});input.setAttribute('aria-label',`Grosor banda ${i+1} en mm`);const color=document.createElement('input');Object.assign(color,{type:'color',value:q.color,disabled:!editable});color.setAttribute('aria-label',`Color banda ${i+1}`);const remove=document.createElement('button');remove.textContent='×';remove.disabled=!editable;remove.setAttribute('aria-label',`Eliminar banda ${i+1}`);
   input.onchange=()=>A.mutate((d,p)=>p.extraOutlines[i].width=Number(input.value),'Contorno actualizado.');color.onchange=()=>A.mutate((d,p)=>p.extraOutlines[i].color=color.value,'Color de contorno actualizado.');remove.onclick=()=>A.mutate((d,p)=>p.extraOutlines.splice(i,1),'Banda eliminada.');row.append(input,color,remove);return row;
  }));}$('outline-add').disabled=!editable||outlines.length>=3;
  const ids=new Set(doc.layers.map(p=>p.id));multi=new Set([...multi].filter(id=>ids.has(id)));const layersSignature=doc.layers.map(p=>p.id+':'+p.name+':'+p.visible+':'+p.locked+':'+(p.group||'')).join('|');
  if($('layer-multi').dataset.signature!==layersSignature){$('layer-multi').dataset.signature=layersSignature;$('layer-multi').replaceChildren(...doc.layers.map(p=>new Option(`${p.visible?'':'Oculta · '}${p.locked?'Bloqueada · ':''}${p.name}${p.group?' · grupo':''}`,p.id)));}
  for(const option of $('layer-multi').options)option.selected=multi.has(option.value);
  syncNodes(p,editable);
  $('comparison-toggle').disabled=!beforeView||busy||!!drag;$('comparison-toggle').textContent=showBefore?'Ver después':'Ver antes';$('comparison-toggle').setAttribute('aria-pressed',String(showBefore));$('comparison-save').disabled=busy||!!drag||showBefore||!S().layout;
  document.querySelectorAll('[data-style]').forEach(e=>e.disabled=!editable||!!(p?.vector||p?.objects));
  // During a gesture or a before view, prevent changes from inspectors and history.
  if(drag||showBefore){$('threshold').disabled=true;for(const id of ['properties','appearance','letter-properties'])$(id).disabled=true;for(const id of ['add','duplicate','delete','back','front','lock','visibility','jersey','undo','redo','save','save-local','restore-local'])$(id).disabled=true;}
 }
 function changeLayer(id,key,kind='number'){$(id).onchange=()=>A.mutate((d,p)=>{if(p&&!p.locked)p[key]=kind==='boolean'?$(id).checked:kind==='string'?$(id).value:Number($(id).value);},'Ajuste actualizado.');}
 for(const [id,key,kind]of [['shape-mode','shapeMode','string'],['shape-radius','radius'],['shape-width','curveWidth'],['shape-rise1','curveRise1'],['shape-rise2','curveRise2'],['shape-wave','waveAmplitude'],['shape-perspective','perspective'],['shadow-mode','shadowMode','string'],['extrude','extrude','boolean'],['extrude-x','extrudeX'],['extrude-y','extrudeY'],['extrude-color','extrudeColor','string'],['cut-mode','cutMode','string'],['cut-width','cutWidth'],['cut-spacing','cutSpacing'],['cut-angle','cutAngle'],['cut-count','cutCount'],['cut-seed','cutSeed']])changeLayer(id,key,kind);
 for(const key of ['scaleX','scaleY','skew','spacing'])$('char-'+key).onchange=()=>A.mutate((d,p)=>{if(p&&!p.locked)p.characters[S().letterIndex]={...currentChar(p),[key]:Number($('char-'+key).value)};},'Forma de letra actualizada.');
 $('outline-add').onclick=()=>A.mutate((d,p)=>{if((p.extraOutlines||[]).length>=3)throw Error('Máximo tres bandas adicionales.');(p.extraOutlines||=[]).push({width:.5,color:'#dec796'});},'Banda de contorno agregada.');
 function exact(axis){const width=Number($('exact-width').value)*10,height=Number($('exact-height').value)*10,lock=$('exact-lock').checked;A.mutate((d,p)=>{const item=activeItem();if(!item)throw Error('Seleccioná texto visible.');if(axis==='height'&&lock){const k=height/(item.box.y2-item.box.y1);C.resizeLayer(p,item,(item.box.x2-item.box.x1)*k,height,true);}else C.resizeLayer(p,item,width,height,lock);},'Medidas impresas actualizadas.');}
 $('exact-apply-width').onclick=()=>exact('width');$('exact-apply-height').onclick=()=>exact('height');
 $('layer-multi').onchange=()=>multi=new Set([...$('layer-multi').selectedOptions].map(o=>o.value));
 $('group-create').onclick=()=>A.mutate(d=>{if(multi.size<2)throw Error('Seleccioná al menos dos capas.');const members=d.layers.filter(p=>multi.has(p.id));if(members.some(p=>p.locked))throw Error('Desbloqueá la selección antes de agrupar.');const group=A.uid();for(const p of members)p.group=group;},'Capas agrupadas. Se mueven juntas en modo Texto.');
 $('group-remove').onclick=()=>A.mutate(d=>{const groups=new Set(d.layers.filter(p=>multi.has(p.id)).map(p=>p.group).filter(Boolean));const members=d.layers.filter(p=>groups.has(p.group)||multi.has(p.id));if(members.some(p=>p.locked))throw Error('Desbloqueá el grupo antes de desagrupar.');for(const p of members)delete p.group;},'Grupo separado.');
 $('group-apply').onclick=()=>A.mutate(d=>C.alignLayers(d,S().layout,[...multi],$('group-action').value),'Selección organizada.');
 $('convert-curves').onclick=()=>{const source=S().active,item=activeItem();if(!source||!item)return;const id=A.uid();A.mutate(d=>{const p=d.layers.find(p=>p.id===source.id);if(p.locked)throw Error('Desbloqueá la capa.');if(d.layers.length>=C.MAX_LAYERS)throw Error('Se necesita una capa libre para conservar el original.');const copy=C.freezeLayer(p,item,id);p.visible=false;d.layers.push(copy);},'Copia en curvas creada; original conservado.');if(S().doc.layers.some(p=>p.id===id)){A.select(id,item.paths[0]?.index);mode='nodes';node=null;sync();A.draw();}};
 $('letter').addEventListener('change',()=>{node=null;nodePage=0;sync();A.draw();});
 $('node-glyph').onchange=()=>{node=null;nodePage=0;A.select(S().selected,Number($('node-glyph').value));};$('node-select').onchange=()=>{const [command,part]=$('node-select').value.split(':');node={command:Number(command),part};sync();A.draw();};
 // Page selector keeps very detailed contours responsive without dropping any nodes.
 const pageLabel=document.createElement('label');pageLabel.textContent='Página de nodos (100 comandos)';const pageInput=document.createElement('input');Object.assign(pageInput,{id:'node-page',type:'number',min:1,step:1,value:1});pageLabel.append(pageInput);$('node-select').parentElement.before(pageLabel);pageInput.onchange=()=>{const q=nodeContext().q,n=Number(pageInput.value);if(!q||!Number.isInteger(n)||n<1||n>Math.ceil(q.commands.length/100)){A.say('Página de nodos fuera de rango.',true);sync();return;}nodePage=n-1;node=null;sync();A.draw();};
 function updateNode(){const target={x:Number($('node-x').value),y:Number($('node-y').value)};A.mutate((d,p)=>{const q=p?.vector?.find(q=>q.index===S().letterIndex);if(!q||!node)throw Error('Seleccioná un nodo.');editPoint(p,q,node.command,node.part,target,$('node-linked').checked);},'Nodo actualizado.');}
 $('node-x').onchange=$('node-y').onchange=updateNode;
 $('node-split').onclick=()=>A.mutate((d,p)=>{const q=p.vector.find(q=>q.index===S().letterIndex);q.commands=C.splitNode(q.commands,node.command);node={command:node.command,part:'x'};},'Segmento dividido sin alterar su curva.');
 $('node-delete').onclick=()=>A.mutate((d,p)=>{const q=p.vector.find(q=>q.index===S().letterIndex);q.commands=C.deleteNode(q.commands,node.command);node=null;},'Nodo eliminado. Revisá el contorno.');
  // Keep only the rendered vector strings; the comparison needs no extra font or node copies.
 $('comparison-save').onclick=()=>{beforeView={doc:{widthCm:S().doc.widthCm,heightCm:S().doc.heightCm},artwork:C.artwork({...S().doc,mirror:false},S().layout)};showBefore=false;sync();A.say('Referencia anterior fijada. Los próximos cambios se comparan con esta vista.');};
 $('comparison-toggle').onclick=()=>{if(!beforeView)return;if(beforeView.doc.widthCm!==S().doc.widthCm||beforeView.doc.heightCm!==S().doc.heightCm){A.say('El lienzo cambió de tamaño. Fijá otra referencia para comparar medidas iguales.',true);return;}showBefore=!showBefore;A.sync();A.draw();};
 function comparisonArtwork(){if(!showBefore)return null;const a=beforeView.artwork;return{defs:a.defs,body:S().doc.mirror?`<g transform="translate(${S().doc.widthCm*10} 0) scale(-1 1)">${a.body}</g>`:a.body};}
 function handles(box,layer,letter){const s=S().scale,unit=1/s,r=5*unit,cx=(box.x1+box.x2)/2,cy=(box.y1+box.y2)/2,kind=letter?'letter':'layer',color=letter?'#8de3df':'#f0d59d';let html=`<rect x="${box.x1}" y="${box.y1}" width="${box.x2-box.x1}" height="${box.y2-box.y1}" fill="none" stroke="${color}" stroke-width="${unit}" pointer-events="none"/>`;
  const dot=(name,x,y,label)=>`<circle data-gesture="${kind}-${name}" data-layer="${layer}" cx="${x}" cy="${y}" r="${r}" fill="#172430" stroke="${color}" stroke-width="${1.5*unit}"><title>${label}</title></circle>`;
  html+=dot('scale',box.x2,box.y2,'Escala proporcional')+dot('width',box.x2,cy,'Ancho independiente')+dot('height',cx,box.y2,'Alto independiente')+dot('rotate',cx,box.y1-18*unit,'Girar')+dot('skew',box.x1-14*unit,box.y1,'Inclinar');return html;
 }
 function overlay(){const {active:p,layout,doc,selected,letterIndex,scale}=S();if(!p||p.locked||showBefore||!layout)return'';const item=activeItem();if(!item)return'';let html='',unit=1/scale;
  if(mode==='nodes'&&p.vector){const {q}=nodeContext();if(q){const mat=nodeMatrix(p,q),start=nodePage*100,end=Math.min(start+100,q.commands.length);for(let i=start;i<end;i++){const c=q.commands[i];for(const part of ['x','x1','x2']){if(c[part]===undefined)continue;const pos=nodePosition(p,q,c,part),selected=node?.command===i&&node.part===part;
    if(part==='x1'||part==='x2'){let anchor;if(part==='x2')anchor=nodePosition(p,q,c,'x');else{const prev=q.commands[i-1];if(prev?.x!==undefined)anchor=nodePosition(p,q,prev,'x');}if(anchor)html+=`<path d="M${anchor.x} ${anchor.y}L${pos.x} ${pos.y}" stroke="#8ba9b7" stroke-width="${unit}" pointer-events="none"/>`;if(c.type==='Q'){const end=nodePosition(p,q,c,'x');html+=`<path d="M${pos.x} ${pos.y}L${end.x} ${end.y}" stroke="#8ba9b7" stroke-width="${unit}" pointer-events="none"/>`;}}
    html+=`<circle data-gesture="node" data-layer="${p.id}" data-command="${i}" data-part="${part}" cx="${pos.x}" cy="${pos.y}" r="${(part==='x'?3.5:2.7)*unit}" fill="${selected?'#f0d59d':part==='x'?'#172430':'#4b8d9c'}" stroke="${selected?'#fff0c5':'#9be4e2'}" stroke-width="${unit}"><title>${i+1} · ${part==='x'?'nodo':'manejador'}</title></circle>`;
   }}}}
  else if(mode==='letter'){const q=item.paths.find(q=>q.index===letterIndex);if(q)html+=handles(q.box,p.id,true);}
  else if(mode==='text'&&!p.group)html+=handles(item.box,p.id,false);
  if(mode==='text'&&p.shapeMode==='curve'&&!p.vector){const points=C.baseline(p).points,mat=C.effectiveMatrix(p),q=points.map(q=>C.point(mat,q.x,q.y));html+=`<path d="M${q[0].x} ${q[0].y}C${q[1].x} ${q[1].y} ${q[2].x} ${q[2].y} ${q[3].x} ${q[3].y}" fill="none" stroke="#71c2d0" stroke-width="${unit}" stroke-dasharray="${4*unit} ${4*unit}" pointer-events="none"/>`;for(const i of [1,2])html+=`<circle data-gesture="curve" data-control="${i}" cx="${q[i].x}" cy="${q[i].y}" r="${5*unit}" fill="#203744" stroke="#88dfe4" stroke-width="${unit}"/>`;}
  return `<g id="advanced-handles"${doc.mirror?` transform="translate(${doc.widthCm*10} 0) scale(-1 1)"`:''}>${html}</g>`;
 }
 function findHit(e){const {layout}=S();const path=e.target.closest?.('[data-edit-layer]');if(path)return{item:layout?.layers.find(q=>q.layer.id===path.dataset.editLayer),index:Number(path.dataset.editLetter)};const v=A.world(e),item=[...(layout?.layers||[])].reverse().find(q=>v.x>=q.box.x1&&v.x<=q.box.x2&&v.y>=q.box.y1&&v.y<=q.box.y2);if(!item)return{};const letter=[...item.paths].reverse().find(q=>v.x>=q.box.x1&&v.x<=q.box.x2&&v.y>=q.box.y1&&v.y<=q.box.y2);return{item,index:letter?.index};}
 const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
 $('view').addEventListener('pointerdown',e=>{
  if(S().busy||S().drag||e.button!==0)return;if(showBefore){stop(e);return;}const control=e.target.closest?.('[data-gesture]'),hit=findHit(e),p=control?S().doc.layers.find(p=>p.id===(control.dataset.layer||S().selected)):hit.item?.layer;
  if(!p)return;if(p.locked){if(mode!=='text'){stop(e);A.select(p.id,hit.index);}return;}
  const custom=!!control||mode!=='text'||!!p.group;if(!custom)return;stop(e);A.finishBase(true);if(control?.dataset.gesture==='node'){node={command:Number(control.dataset.command),part:control.dataset.part};nodePage=Math.floor(node.command/100);}
  A.select(p.id,hit.index??S().letterIndex);if(mode==='nodes'&&!control){A.draw();return;}if(mode==='letter'&&hit.index===undefined&&!control)return;
  const kind=control?.dataset.gesture||(mode==='letter'?'letter-move':'group-move'),group=p.group?S().doc.layers.filter(q=>q.group===p.group):[p];if(kind==='group-move'&&group.some(p=>p.locked)){A.say('Desbloqueá todas las capas del grupo para moverlo.',true);return;}
  const before=clone(S().doc),v=A.world(e),item=activeItem(),letter=item?.paths.find(q=>q.index===S().letterIndex),box=kind.startsWith('letter')?letter?.box:item?.box;
  drag={kind,before,id:p.id,index:S().letterIndex,pointer:e.pointerId,start:v,control:control?.dataset.control,node:node?{...node}:null,box,group:group.map(q=>q.id),center:box?{x:(box.x1+box.x2)/2,y:(box.y1+box.y2)/2}:{x:p.x,y:p.y}};
  e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.focus();A.sync();
 },true);
 function gesture(next,v){const p=next.layers.find(p=>p.id===drag.id),base=drag.before.layers.find(p=>p.id===drag.id),dx=v.x-drag.start.x,dy=v.y-drag.start.y,kind=drag.kind;
  if(kind==='node'){const q=p.vector.find(q=>q.index===drag.index);editPoint(p,q,drag.node.command,drag.node.part,v,$('node-linked').checked);return;}
  if(kind==='curve'){const q=C.point(C.inverse(C.effectiveMatrix(p)),v.x,v.y);p[drag.control==='1'?'curveRise1':'curveRise2']=Math.max(-1500,Math.min(1500,q.y));return;}
  if(kind==='group-move'){for(const q of next.layers)if(drag.group.includes(q.id)){q.x+=dx;q.y+=dy;}return;}
  const letter=kind.startsWith('letter'),target=letter?(p.characters[drag.index]={...defaults,...p.characters[drag.index]}):p,b=drag.box,c=drag.center;
  if(kind==='letter-move'){const m=C.inverse(C.effectiveMatrix(base)),a=C.point(m,drag.start.x,drag.start.y),q=C.point(m,v.x,v.y);target.x+=q.x-a.x;target.y+=q.y-a.y;return;}
  if(kind.endsWith('rotate')){const angle=(Math.atan2(v.y-c.y,v.x-c.x)-Math.atan2(drag.start.y-c.y,drag.start.x-c.x))*180/Math.PI;target.rotation=Math.max(-360,Math.min(360,target.rotation+angle));}
  else if(kind.endsWith('skew'))target.skew=Math.max(-70,Math.min(70,(target.skew||0)+Math.atan2(dx,Math.max(1,b.y2-b.y1))*180/Math.PI));
  else{const ratioX=Math.max(.05,1+dx/Math.max(.1,b.x2-c.x)),ratioY=Math.max(.05,1+dy/Math.max(.1,b.y2-c.y)),ratio=Math.max(.05,Math.hypot(v.x-c.x,v.y-c.y)/Math.max(.1,Math.hypot(drag.start.x-c.x,drag.start.y-c.y)));
   if(letter){if(kind.endsWith('scale'))target.scale=Math.min(10,target.scale*ratio);else if(kind.endsWith('width'))target.scaleX=Math.min(10,target.scaleX*ratioX);else target.scaleY=Math.min(10,target.scaleY*ratioY);}
   else{p.printScaleX=(p.printScaleX??1)*(kind.endsWith('height')?1:kind.endsWith('scale')?ratio:ratioX);p.printScaleY=(p.printScaleY??1)*(kind.endsWith('width')?1:kind.endsWith('scale')?ratio:ratioY);}
  }
  // Keep transformed glyph or layer visually centred while changing its shape.
  const item=C.compose(next,A.fonts()).layers.find(q=>q.layer.id===p.id),newBox=letter?item?.paths.find(q=>q.index===drag.index)?.box:item?.box;
  if(newBox){const delta={x:c.x-(newBox.x1+newBox.x2)/2,y:c.y-(newBox.y1+newBox.y2)/2};if(letter){const m=C.inverse(C.effectiveMatrix(p));target.x+=m.a*delta.x+m.c*delta.y;target.y+=m.b*delta.x+m.d*delta.y;}else{p.x+=delta.x;p.y+=delta.y;}}
 }
 $('view').addEventListener('pointermove',e=>{if(!drag||drag.pointer!==e.pointerId)return;stop(e);try{const next=clone(drag.before);gesture(next,A.world(e));C.validate(next);C.compose(next,A.fonts());A.preview(next);}catch(error){A.say(error.message,true);}},true);
 function finish(cancel=false){if(!drag)return;const state=drag;drag=null;const next=clone(S().doc);A.preview(clone(state.before));if(!cancel)try{A.commit(next,state.before,'Edición directa aplicada.');}catch(e){A.say(e.message,true);}A.sync();}
 for(const type of ['pointerup','pointercancel','lostpointercapture'])$('view').addEventListener(type,e=>{if(drag?.pointer!==e.pointerId)return;stop(e);finish(type!=='pointerup');},true);
 window.addEventListener('blur',()=>finish(true));
 $('view').addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){stop(e);finish(true);return;}if(drag||showBefore||S().busy)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){stop(e);$(e.shiftKey?'redo':'undo').click();return;}
  if(mode==='text'&&!S().active?.group)return;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)||!writable())return;stop(e);const step=e.shiftKey?1:.1,delta={x:e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0,y:e.key==='ArrowUp'?-step:e.key==='ArrowDown'?step:0};if(S().doc.mirror)delta.x*=-1;
  A.mutate((d,p)=>{if(mode==='nodes'){const q=p.vector?.find(q=>q.index===S().letterIndex);if(!q||!node)return;const pos=nodePosition(p,q,q.commands[node.command],node.part);editPoint(p,q,node.command,node.part,{x:pos.x+delta.x,y:pos.y+delta.y},$('node-linked').checked);}
   else if(mode==='letter'){const o=p.characters[S().letterIndex]={...currentChar(p)},m=C.inverse(C.effectiveMatrix(p));o.x+=m.a*delta.x+m.c*delta.y;o.y+=m.b*delta.x+m.d*delta.y;}
   else{const members=d.layers.filter(q=>q.group===p.group);if(members.some(q=>q.locked))throw Error('El grupo contiene capas bloqueadas.');for(const q of members){q.x+=delta.x;q.y+=delta.y;}}
  },'Ajuste preciso aplicado.');
 },true);
 const styleLabel=document.createElement('label');styleLabel.className='check';styleLabel.innerHTML='<input id="preset-keep-letters" type="checkbox"> Conservar ajustes individuales de letras';$('apply-preset').after(styleLabel);
 function refreshStyleSource(){window.dispatchEvent(new CustomEvent('momotus:type-catalog-refresh'));}
 document.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey)return;const input=e.target.closest?.('aside input[type=number]');if(input&&document.activeElement===input){const aside=input.closest('aside');e.preventDefault();aside.scrollTop+=e.deltaY*(e.deltaMode===1?18:e.deltaMode===2?aside.clientHeight:1);}},{passive:false});

 return{sync,overlay,comparisonArtwork,finish,get dragging(){return!!drag;},get comparing(){return showBefore;}};
};
