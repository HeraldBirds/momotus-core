/* Reglas y guías de interfaz. Ningún trazo se escribe en el canvas de trabajo. */
(()=>{
 'use strict';if(!window.MOMOTUS_TOOLS_DESKTOP)return;
 const core=window.MomotusPrecisionCore,$=id=>document.getElementById(id),NS='http://www.w3.org/2000/svg';
 const configs=[
  {id:'halftone',panel:'semitonos',stage:'halftone-preview',canvas:'halftone-canvas',toolbar:'#semitonos .tool-preview-toolbar'},
  {id:'background',panel:'eliminar-fondo',stage:'background-preview',canvas:'background-canvas',toolbar:'#eliminar-fondo .tool-preview-toolbar'},
  {id:'quality',panel:'mejorar-calidad',stage:'quality-preview',canvas:'quality-canvas',toolbar:'#mejorar-calidad .tool-preview-toolbar'},
  {id:'vector',panel:'vectorizacion',stage:'vector-viewport',canvas:'vector-canvas',toolbar:'#vectorizacion .extra-toolbar'},
  {id:'effects',panel:'efectos-dtf',stage:'effects-stage',canvas:'effects-preview',toolbar:'#efectos-dtf .effects-preview-toolbar'},
  {id:'sheet',panel:'calculadora-dtf',stage:'.calculator-sheet-wrap',canvas:'calc-canvas',toolbar:'#calc-sheet-mode .extra-toolbar',scope:'calc-sheet-mode'},
  {id:'roll',panel:'calculadora-dtf',stage:'#team-roll-preview',canvas:'team-roll-preview',toolbar:'.team-layout-details',scope:'calc-team-mode'},
  {id:'production',panel:'production-studio',stage:'production-viewport',canvas:'production-canvas',toolbar:'.production-canvas-toolbar'}
 ];
 const states=new Map(configs.map(c=>[c.id,{show:true,center:false,margin:false,marginCm:.5,locked:false,snap:true,guides:[]}]));
 let active=null,geometry=null,frame=0,sequence=0,drag=null;
 const select=s=>s.startsWith('.')||s.startsWith('#')?document.querySelector(s):$(s);
 const visible=e=>!!(e&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
 const overlay=document.createElement('div');overlay.className='precision-overlay';overlay.hidden=true;
 const horizontal=document.createElementNS(NS,'svg'),vertical=document.createElementNS(NS,'svg');horizontal.classList.add('precision-ruler','precision-horizontal');vertical.classList.add('precision-ruler','precision-vertical');
 horizontal.setAttribute('aria-label','Regla horizontal en centímetros. Arrastrá para crear una guía horizontal.');vertical.setAttribute('aria-label','Regla vertical en centímetros. Arrastrá para crear una guía vertical.');horizontal.tabIndex=0;vertical.tabIndex=0;
 const lines=document.createElement('div');lines.className='precision-lines';const coords=document.createElement('output');coords.className='precision-coordinates';coords.textContent='cm · origen del lienzo';
 const corner=document.createElement('button');corner.className='precision-corner';corner.type='button';corner.textContent='cm';corner.title='Administrar guías';
 overlay.append(horizontal,vertical,corner,lines,coords);document.body.append(overlay);
 const manager=document.createElement('dialog');manager.className='pro-dialog precision-manager';manager.innerHTML='<form method="dialog"><header><h3>Reglas y guías</h3><button aria-label="Cerrar guías">×</button></header></form><p id="precision-document-size"></p><div class="precision-settings"><label><input id="precision-visible" type="checkbox" checked> Mostrar reglas y guías</label><label><input id="precision-center" type="checkbox"> Mostrar centro</label><label><input id="precision-margin" type="checkbox"> Mostrar márgenes</label><label>Margen interior <input id="precision-margin-cm" type="number" min="0" max="100" step="0.1" value="0.5"> cm</label><label><input id="precision-lock" type="checkbox"> Bloquear guías</label><label><input id="precision-snap" type="checkbox" checked> Ajustar guías al centro, bordes y otras guías</label></div><div class="precision-add"><label>Dirección<select id="precision-axis"><option value="x">Vertical</option><option value="y">Horizontal</option></select></label><label>Posición desde el origen <input id="precision-position" type="number" min="0" step="0.01" value="1"> cm</label><button id="precision-add" type="button">Agregar guía</button></div><div id="precision-guide-list"></div><button id="precision-clear" type="button">Eliminar todas las guías</button><p id="precision-message" role="status">Arrastrá desde una regla para crear una guía; arrastrá la guía para moverla. También podés editar su posición aquí. Estas ayudas no se exportan.</p>';
 document.body.append(manager);let managerType=null;
 const quote=document.createElement('dialog');quote.className='pro-dialog precision-quote';quote.innerHTML='<form method="dialog"><header><h3>Cotizar medidas</h3><button aria-label="Cerrar medidas">×</button></header></form><p id="precision-measure-origin"></p><label>Nombre del diseño<input id="precision-label" type="text" maxlength="100"></label><div class="precision-add"><label>Ancho <input id="precision-width" type="number" min="0.001" max="300" step="0.001"> cm</label><label>Alto <input id="precision-height" type="number" min="0.001" max="300" step="0.001"> cm</label><label>Copias <input id="precision-quantity" type="number" min="1" max="1000" step="1" value="1"></label></div><label>Destino<select id="precision-quote-mode"><option value="team">Agregar al pedido por metro</option><option value="sheet">Diseño repetido por pliego</option></select></label><p>Se envían únicamente medidas, nombre y cantidad. Las medidas incluyen todo el lienzo, también los márgenes transparentes. Podés ajustarlas para cotizar otro tamaño; esto no cambia la imagen ni su exportación.</p><p id="precision-quote-error" role="alert"></p><button id="precision-send" type="button">Agregar medidas a la calculadora</button>';
 document.body.append(quote);
 function documentInfo(c){
  const canvas=$(c.canvas);if(!canvas)return null;
  if(['halftone','background','quality'].includes(c.id))return window.MomotusToolsAPI?.getPrintDimensions(c.id);
  if(c.id==='vector'){if(($('vector-empty')&&!$('vector-empty').hidden)||$('vector-download').disabled||Number($('vector-width-cm').value)<2||Number($('vector-width-cm').value)>57)return null;return {filename:$('vector-document-info').textContent.split(' · ')[0],widthCm:Number($('vector-width-cm').value),heightCm:Number($('vector-width-cm').value)*canvas.height/canvas.width};}
  if(c.id==='effects'){const d=window.MomotusEffectsAPI?.getDocumentInfo();return d?{filename:d.filename,widthCm:d.naturalWidth/300*2.54,heightCm:d.naturalHeight/300*2.54}:null;}
  if(c.id==='sheet')return {widthCm:Number($('calc-sheet-width').value),heightCm:Number($('calc-sheet-height').value)};
  if(c.id==='roll'){const w=Number(canvas.dataset.precisionWidth);return w?{widthCm:w,heightCm:Number(canvas.dataset.precisionHeight)}:null;}
  if(c.id==='production'&&!canvas.hidden)return {filename:'Diseño de producción',widthCm:canvas.width/300*2.54,heightCm:canvas.height/300*2.54};
  return null;
 }
 function getGeometry(c,d){
  const stage=select(c.stage),canvas=$(c.canvas);if(!visible(stage)||!d||!Number.isFinite(d.widthCm)||!Number.isFinite(d.heightCm)||d.widthCm<=0||d.heightCm<=0)return null;
  let target=canvas;if(['halftone','background','quality'].includes(c.id)&&!visible(canvas))target=$(c.id+'-original');
  if(!visible(target))return null;let bounds=target.getBoundingClientRect(),view=stage.getBoundingClientRect();
  if(c.id==='roll'||c.id==='sheet'){
   const sx=bounds.width/canvas.width,sy=bounds.height/canvas.height,scale=Number(canvas.dataset.precisionScale)||1,scaleX=Number(canvas.dataset.precisionScaleX)||scale,scaleY=Number(canvas.dataset.precisionScaleY)||scale;bounds={left:bounds.left+Number(canvas.dataset.precisionX||0)*sx,top:bounds.top+Number(canvas.dataset.precisionY||0)*sy,width:d.widthCm*scaleX*sx,height:d.heightCm*scaleY*sy};
  }
  if(view.width<24||view.height<24)return null;
  const clip={left:Math.max(0,view.left),top:Math.max(0,view.top),width:Math.max(0,Math.min(innerWidth,view.right)-Math.max(0,view.left)),height:Math.max(0,Math.min(innerHeight,view.bottom)-Math.max(0,view.top))};
  return {view:clip,bounds,d,x:bounds.left-clip.left,y:bounds.top-clip.top,sx:bounds.width/d.widthCm,sy:bounds.height/d.heightCm};
 }
 function ticks(svg,length,origin,scale,verticalAxis){
  svg.replaceChildren();svg.setAttribute('viewBox',verticalAxis?`0 0 22 ${length}`:`0 0 ${length} 22`);
  const target=60/scale,power=10**Math.floor(Math.log10(target||1)),step=[1,2,5,10].map(n=>n*power).find(n=>n>=target)||power*10,minor=step/5;
  const min=-origin/scale,max=(length-origin)/scale;
  for(let n=Math.ceil(min/minor)*minor;n<=max+minor/10;n+=minor){const value=Math.round(n/minor),major=value%5===0,pos=origin+n*scale;
   const line=document.createElementNS(NS,'line');for(const [key,val]of Object.entries(verticalAxis?{x1:major?3:13,y1:pos,x2:22,y2:pos}:{x1:pos,y1:major?3:13,x2:pos,y2:22}))line.setAttribute(key,val);line.setAttribute('stroke','#73839b');svg.append(line);
   if(major){const text=document.createElementNS(NS,'text');text.textContent=Number(n.toFixed(3)).toLocaleString('es-NI');text.setAttribute('fill','#e1e7f0');text.setAttribute('font-size','9');text.setAttribute('x',verticalAxis?10:pos+3);text.setAttribute('y',verticalAxis?pos-3:10);if(verticalAxis)text.setAttribute('transform',`rotate(-90 10 ${pos-3})`);svg.append(text);}
  }
 }
 function draw(){
  frame=0;discover();active=configs.find(c=>visible($(c.panel))&&(!c.scope||visible($(c.scope)))&&visible(select(c.stage))&&!(document.body.classList.contains('production-open')&&c.id!=='production'));
  if(!active||visible($('dtf-preflight-modal'))||visible($('production-busy'))){overlay.hidden=true;return;}const d=documentInfo(active);geometry=getGeometry(active,d);const s=states.get(active.id);
  const toolbar=document.querySelector(`[data-precision-tool="${active.id}"]`);toolbar?.querySelector('[data-precision-quote]')?.toggleAttribute('disabled',!d);
  if(!geometry||!s.show){overlay.hidden=true;return;}overlay.hidden=false;overlay.style.zIndex=active.id==='production'?'5010':$(''+active.stage)?.closest('.preview-expanded')?'225':'45';const g=geometry;
  Object.assign(overlay.style,{left:g.view.left+'px',top:g.view.top+'px',width:g.view.width+'px',height:g.view.height+'px'});
  ticks(horizontal,g.view.width,g.x,g.sx,false);ticks(vertical,g.view.height,g.y,g.sy,true);lines.replaceChildren();
  const add=(axis,value,kind,guide)=>{const pos=(axis==='x'?g.x:g.y)+value*(axis==='x'?g.sx:g.sy),max=axis==='x'?g.view.width:g.view.height;if(pos<22||pos>max)return;
   const el=document.createElement(guide?'button':'span');el.className=`precision-line precision-${axis} ${kind}`;el.style[axis==='x'?'left':'top']=pos+'px';
   if(guide){el.type='button';el.setAttribute('aria-label',`${axis==='x'?'Guía vertical':'Guía horizontal'}: ${value.toFixed(3)} cm`);el.title=`${value.toFixed(3)} cm${s.locked?' · bloqueada':''}`;el.addEventListener('pointerdown',e=>startDrag(e,axis,guide));el.addEventListener('dblclick',openManager);el.addEventListener('keydown',e=>{if(['Delete','Backspace'].includes(e.key)&&!s.locked){e.preventDefault();s.guides=s.guides.filter(v=>v.id!==guide.id);schedule();}if(e.key==='Enter')openManager();});}
   lines.append(el);
  };
  if(s.center){add('x',d.widthCm/2,'precision-center');add('y',d.heightCm/2,'precision-center');}
  if(s.margin){for(const [axis,length]of [['x',d.widthCm],['y',d.heightCm]]){const m=Math.min(s.marginCm,length/2);add(axis,m,'precision-margin');add(axis,length-m,'precision-margin');}}
  s.guides.forEach(guide=>{if(guide.value<=(guide.axis==='x'?d.widthCm:d.heightCm))add(guide.axis,guide.value,'precision-user',guide);});
 }
 function schedule(){if(!frame)frame=requestAnimationFrame(draw);}
 function startDrag(event,axis,guide){if(!active||!geometry||states.get(active.id).locked||event.button!==0)return;event.preventDefault();event.stopPropagation();const s=states.get(active.id);if(!guide){if(s.guides.length>=40)return;guide={id:++sequence,axis,value:0};s.guides.push(guide);}drag={tool:active.id,guide,geometry};moveDrag(event);}
 function moveDrag(event){if(!drag)return;const {guide,geometry:g}=drag,s=states.get(drag.tool),length=guide.axis==='x'?g.d.widthCm:g.d.heightCm,scale=guide.axis==='x'?g.sx:g.sy;let value=core.position(guide.axis==='x'?event.clientX:event.clientY,guide.axis==='x'?g.bounds.left:g.bounds.top,guide.axis==='x'?g.bounds.width:g.bounds.height,length);
  const anchors=[0,length/2,length,s.marginCm,length-s.marginCm,...s.guides.filter(v=>v.id!==guide.id&&v.axis===guide.axis).map(v=>v.value)];guide.value=s.snap?core.snap(value,anchors,7/scale,length):Math.max(0,Math.min(length,value));coords.textContent=`Guía ${guide.axis.toUpperCase()}: ${guide.value.toFixed(3)} cm`;schedule();
 }
 horizontal.addEventListener('pointerdown',e=>startDrag(e,'y'));vertical.addEventListener('pointerdown',e=>startDrag(e,'x'));
 document.addEventListener('pointermove',e=>{if(drag){moveDrag(e);return;}if(!geometry||overlay.hidden)return;const g=geometry,x=core.position(e.clientX,g.bounds.left,g.bounds.width,g.d.widthCm),y=core.position(e.clientY,g.bounds.top,g.bounds.height,g.d.heightCm);if(x>=0&&y>=0&&x<=g.d.widthCm&&y<=g.d.heightCm)coords.textContent=`X ${x.toFixed(2)} · Y ${y.toFixed(2)} cm`;});
 document.addEventListener('pointerup',()=>{drag=null;});
 horizontal.addEventListener('keydown',e=>{if(e.key==='Enter')openManager();});vertical.addEventListener('keydown',e=>{if(e.key==='Enter')openManager();});document.addEventListener('pointercancel',()=>{drag=null;});
 function openManager(){if(!active)return;managerType=active.id;const s=states.get(managerType),d=documentInfo(active);$('precision-document-size').textContent=d?`Lienzo ${d.widthCm.toFixed(3)} × ${d.heightCm.toFixed(3)} cm · origen en la esquina superior izquierda.`:'Cargá un documento para medir.';
  for(const [id,key]of [['precision-visible','show'],['precision-center','center'],['precision-margin','margin'],['precision-lock','locked'],['precision-snap','snap']])$(id).checked=s[key];$('precision-margin-cm').value=s.marginCm;renderManager();manager.showModal();
 }
 function renderManager(){const s=states.get(managerType),list=$('precision-guide-list');list.replaceChildren();s.guides.forEach(guide=>{const row=document.createElement('div');row.className='precision-guide-row';const label=document.createElement('label');label.textContent=guide.axis==='x'?'Vertical · cm':'Horizontal · cm';const input=document.createElement('input');input.type='number';input.min='0';input.step='.001';input.value=Number(guide.value.toFixed(3));input.disabled=s.locked;input.setAttribute('aria-label',`Posición de guía ${guide.id}`);label.append(input);const remove=document.createElement('button');remove.type='button';remove.textContent='Eliminar';remove.disabled=s.locked;input.addEventListener('change',()=>{const d=documentInfo(configs.find(c=>c.id===managerType)),max=guide.axis==='x'?d?.widthCm:d?.heightCm,n=Number(input.value);if(input.value===''||!Number.isFinite(n)||n<0||n>max){$('precision-message').textContent='La guía debe quedar dentro del lienzo.';input.value=guide.value;return;}guide.value=n;schedule();});remove.addEventListener('click',()=>{s.guides=s.guides.filter(v=>v.id!==guide.id);renderManager();schedule();});row.append(label,remove);list.append(row);});$('precision-add').disabled=s.locked;$('precision-clear').disabled=s.locked;}
 for(const [id,key]of [['precision-visible','show'],['precision-center','center'],['precision-margin','margin'],['precision-lock','locked'],['precision-snap','snap']])$(id).addEventListener('change',()=>{states.get(managerType)[key]=$(id).checked;renderManager();schedule();});
 $('precision-margin-cm').addEventListener('input',()=>{const n=Number($('precision-margin-cm').value);if(Number.isFinite(n)&&n>=0&&n<=100){states.get(managerType).marginCm=n;schedule();}});
 $('precision-add').addEventListener('click',()=>{const c=configs.find(c=>c.id===managerType),d=documentInfo(c),axis=$('precision-axis').value,n=Number($('precision-position').value),s=states.get(managerType);if(!d||$('precision-position').value===''||!Number.isFinite(n)||n<0||n>(axis==='x'?d.widthCm:d.heightCm)){ $('precision-message').textContent='La posición debe quedar dentro del lienzo.';return;}if(s.guides.length>=40){$('precision-message').textContent='Máximo 40 guías por herramienta.';return;}s.guides.push({id:++sequence,axis,value:n});renderManager();schedule();});
 $('precision-clear').addEventListener('click',()=>{states.get(managerType).guides=[];renderManager();schedule();});corner.addEventListener('click',openManager);
 function openQuote(c){const d=documentInfo(c);if(!d)return;const round=n=>Number(n.toFixed(3));$('precision-width').value=round(d.widthCm);$('precision-height').value=round(d.heightCm);$('precision-label').value=d.filename||'Diseño';$('precision-quantity').value=1;$('precision-measure-origin').textContent=`Medidas del tamaño final de impresión${d.limited?' · se aplica el límite de salida existente':''}.`;$('precision-quote-error').textContent='';quote.showModal();}
 $('precision-send').addEventListener('click',async()=>{const button=$('precision-send');try{const d=core.validateMeasure({widthCm:Number($('precision-width').value),heightCm:Number($('precision-height').value),quantity:Number($('precision-quantity').value),label:$('precision-label').value});button.disabled=true;await window.MomotusSendMeasurements(d,$('precision-quote-mode').value);quote.close();}catch(e){$('precision-quote-error').textContent=e.message;}finally{button.disabled=false;schedule();}});
 const watched=new WeakSet(),watchedProduction=new WeakSet(),resize=new ResizeObserver(schedule);
 function inspectorNavigation(){
   document.querySelectorAll('.tool-controls,.extra-controls,.effects-controls').forEach(aside=>{
     if(aside.querySelector('.precision-inspector-nav'))return;const nav=document.createElement('nav');nav.className='precision-inspector-nav';nav.setAttribute('aria-label','Secciones de opciones');
     const targets=[['Diseño',()=>aside.querySelector('input[type=file]')?.closest('label')],['Ajustes',()=>aside.querySelector('.tool-control-panels,.extra-control-scroll,fieldset')],['Salida',()=>aside.querySelector('.tool-action-dock,.extra-action-dock')||$('effects-width')?.closest('fieldset')]];
     targets.forEach(([text,target])=>{const button=document.createElement('button');button.type='button';button.textContent=text;button.addEventListener('click',()=>target()?.scrollIntoView({block:'nearest',behavior:'smooth'}));nav.append(button);});
     const heading=aside.querySelector('.studio-inspector-heading,.extra-inspector-title,header');if(heading)heading.after(nav);else aside.prepend(nav);
   });
 }
 function discover(){const production=$('production-studio');if(production&&!watchedProduction.has(production)){watchedProduction.add(production);new MutationObserver(schedule).observe(production,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','style','width','height','class']});}inspectorNavigation();configs.forEach(c=>{const toolbar=select(c.toolbar);if(!toolbar||toolbar.querySelector(`[data-precision-tool="${c.id}"]`))return;const controls=document.createElement('div');controls.className='precision-toolbar';controls.dataset.precisionTool=c.id;const guides=document.createElement('button');guides.type='button';guides.textContent='Reglas y guías';guides.addEventListener('click',()=>{active=c;openManager();});controls.append(guides);if(!['sheet','roll'].includes(c.id)){const send=document.createElement('button');send.type='button';send.dataset.precisionQuote='';send.textContent='Cotizar medidas';send.disabled=!documentInfo(c);send.addEventListener('click',()=>openQuote(c));controls.append(send);}if(c.id==='roll'){const summary=toolbar.querySelector('summary');summary.after(controls);}else toolbar.append(controls);
  const stage=select(c.stage),canvas=$(c.canvas);for(const el of [stage,canvas])if(el&&!watched.has(el)){watched.add(el);resize.observe(el);}
 });}
 new MutationObserver(schedule).observe(document.body,{childList:true,attributes:true,attributeFilter:['class']});
 const observer=new MutationObserver(schedule);observer.observe(document.querySelector('.tools-editor-grid'),{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','style','width','height','class','data-precision-width','data-precision-height']});
 for(const event of ['resize','scroll','input','change','momotus:result-ready','momotus:extra-tool','momotus:sheet-quote-ready'])window.addEventListener(event,schedule,true);
 document.addEventListener('click',()=>{schedule();setTimeout(schedule,180);});discover();schedule();
 window.MomotusPrecision=Object.freeze({refresh:schedule,getMeasures:id=>{const c=configs.find(c=>c.id===id);return c?documentInfo(c):null;},getGuides:id=>(states.get(id)?.guides||[]).map(g=>({...g}))});
})();
