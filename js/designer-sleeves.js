(() => {
  'use strict';
  const C=window.MomotusSleevesCore,$=id=>document.getElementById(id);
  if(!C||!$('mockup-mangas'))return;
  let model=C.blank(),selected='left',restoreView=false,drag=null,uploadQueue=Promise.resolve(),inputRequest=null;
  const revisions={hoodie:{left:0,right:0},sudadera:{left:0,right:0}};
  const context=()=>({garment:shirtTypes[currentShirtType],color:currentColor});
  const sideState=(garment=context().garment,side=selected)=>model.garments[garment]?.[side];
  const current=()=>C.selectedLayer(sideState());
  const asset=()=>C.asset(context().garment,context().color);
  const save=()=>saveCurrentDesign();
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const message=text=>{$('sleeves-status').textContent=text;};
  const images=new Map();
  function loadImage(src){if(!images.has(src)){if(images.size>=8)images.delete(images.keys().next().value);const promise=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('No se pudo abrir la imagen de mangas.'));img.src=src;});images.set(src,promise);promise.catch(()=>images.delete(src));}return images.get(src);}
  $('mockup-mangas').innerHTML=`
    <p class="sleeves-intro">Agregá varios diseños a cada manga y seleccioná cada uno para editarlo. Izquierda y derecha corresponden a quien viste la prenda.</p>
    <div id="sleeves-unavailable" class="sleeves-message" hidden></div>
    <div id="sleeves-pair" class="sleeves-pair"></div>
    <section id="sleeves-settings" class="sleeves-settings" aria-labelledby="sleeves-selected-title">
      <h3 id="sleeves-selected-title">Manga izquierda</h3>
      <div class="sleeves-upload"><button class="sleeves-upload-main" id="sleeves-upload" type="button">Agregar diseños a esta manga</button><button id="sleeves-remove" type="button">Eliminar seleccionado</button></div>
      <input type="file" id="sleeves-file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" multiple hidden>
      <p id="sleeves-count" class="sleeves-status"></p>
      <nav id="sleeves-layers" class="sleeves-layers" aria-label="Diseños de la manga"></nav>
      <p class="sleeves-note">Seleccioná en la imagen o en la lista. El último diseño de la lista queda por encima.</p>
      <div class="sleeves-actions"><button id="sleeves-replace" type="button">Reemplazar imagen seleccionada</button><button id="sleeves-duplicate" type="button">Duplicar seleccionado</button><button id="sleeves-backward" type="button">Bajar capa</button><button id="sleeves-forward" type="button">Subir capa</button></div>
      <label class="sleeves-name-label" for="sleeves-name">Nombre del diseño seleccionado</label><input id="sleeves-name" class="sleeves-name" type="text" maxlength="120">
      <div class="sleeves-control-grid">
        <label>Tamaño <output id="sleeves-scale-value">100%</output><input id="sleeves-scale" type="range" min="10" max="300" step="1" value="100"></label>
        <label>Giro <output id="sleeves-rotation-value">0°</output><input id="sleeves-rotation" type="range" min="-180" max="180" step="1" value="0"></label>
        <label>Posición horizontal (%)<input id="sleeves-x" type="number" min="0" max="100" step="1" value="50"></label>
        <label>Posición vertical (%)<input id="sleeves-y" type="number" min="0" max="100" step="1" value="50"></label>
        <label>Ancho solicitado (cm, opcional)<input id="sleeves-width-cm" type="number" min="0.5" max="30" step="0.1" placeholder="Por confirmar"></label>
      </div>
      <div class="sleeves-actions"><button id="sleeves-center" type="button">Centrar</button><button id="sleeves-copy" type="button">Copiar seleccionado a la otra manga</button><button id="sleeves-fit" type="button">Ajustar al área</button></div>
      <div class="sleeves-actions"><button id="sleeves-background" type="button">Eliminar fondo del seleccionado</button><button id="sleeves-download" type="button">Descargar vista de mangas</button></div>
      <p id="sleeves-status" class="sleeves-status" role="status"></p>
      <p id="sleeves-warning" class="sleeves-status sleeves-warning" role="status" hidden>El diseño rebasa el área de referencia. Ajustalo para evitar cortes en la vista previa.</p>
      <p class="sleeves-note">Arrastrá o usá las flechas para mover; la rueda sobre el diseño cambia su tamaño. El área punteada es una guía visual: el ancho solicitado, la posición y la impresión se confirman antes de producir. La vista descargada no reemplaza los archivos originales.</p>
    </section>`;
  for(const side of C.sides){
    const card=node('div');card.className='sleeve-card';card.dataset.sleeve=side;
    const button=node('button',C.labels[side]);button.type='button';button.className='sleeve-select';button.id='sleeve-select-'+side;button.addEventListener('click',()=>select(side));
    const stage=node('div');stage.className='sleeve-stage';stage.id='sleeve-stage-'+side;
    const photo=node('img');photo.className='sleeve-photo';photo.alt='';photo.draggable=false;photo.decoding='async';
    const area=node('div');area.className='sleeve-print-area';area.tabIndex=0;area.setAttribute('role','group');area.setAttribute('aria-label','Editar '+C.labels[side].toLowerCase());
    const empty=node('span','Arrastrá uno o varios diseños aquí');empty.className='sleeve-empty';area.append(empty);stage.append(photo,area);card.append(button,stage);$('sleeves-pair').append(card);
    card.addEventListener('click',e=>{const layer=e.target.closest('[data-layer-id]');select(side,layer?.dataset.layerId);});
    card.addEventListener('dragover',e=>{e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';});
    card.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();select(side);const files=[...(e.dataTransfer?.files||[])];if(files.length)enqueue(files,{garment:context().garment,side});});
    area.addEventListener('pointerdown',e=>{if(e.button!==0)return;const hit=e.target.closest('[data-layer-id]');select(side,hit?.dataset.layerId);const value=current();if(!value?.src||!hit)return;const r=area.getBoundingClientRect();drag={id:e.pointerId,garment:context().garment,side,layerId:value.id,revision:value.revision,x:e.clientX,y:e.clientY,startX:value.x,startY:value.y,width:r.width,height:r.height};area.setPointerCapture(e.pointerId);area.focus();e.preventDefault();});
    area.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const d=drag,value=sideState(d.garment,d.side)?.layers.find(v=>v.id===d.layerId);if(context().garment!==d.garment||!value||value.revision!==d.revision){drag=null;return;}selected=d.side;sideState().activeId=d.layerId;patch({x:d.startX+(e.clientX-d.x)/d.width*100,y:d.startY+(e.clientY-d.y)/d.height*100},false);});
    const end=e=>{if(drag?.id===e.pointerId){drag=null;save();}};for(const type of ['pointerup','pointercancel','lostpointercapture'])area.addEventListener(type,end);
    area.addEventListener('wheel',e=>{if(!C.selectedLayer(sideState(context().garment,side)))return;e.preventDefault();select(side,e.target.closest('[data-layer-id]')?.dataset.layerId);scale(e.deltaY<0?.05:-.05);},{passive:false});
    area.addEventListener('keydown',e=>{select(side);const v=current();if(!v?.src){if(e.key==='Enter')$('sleeves-file').click();return;}const step=e.shiftKey?5:1,delta={ArrowLeft:{x:v.x-step},ArrowRight:{x:v.x+step},ArrowUp:{y:v.y-step},ArrowDown:{y:v.y+step}}[e.key];if(delta){e.preventDefault();patch(delta);}else if(e.key==='Delete'){e.preventDefault();remove();}else if(e.key==='+'||e.key==='='){e.preventDefault();scale(.05);}else if(e.key==='-'){e.preventDefault();scale(-.05);}});
  }
  function select(side,id){if(!C.sides.includes(side))return;selected=side;const record=sideState();if(record?.layers.some(v=>v.id===id))record.activeId=id;render();}
  function render(){
    const {garment,color}=context(),info=C.asset(garment,color);
    $('sleeves-selected-title').textContent=C.labels[selected];
    for(const side of C.sides){
      const card=document.querySelector(`[data-sleeve="${side}"]`),stage=card.querySelector('.sleeve-stage'),print=card.querySelector('.sleeve-print-area'),photo=card.querySelector('.sleeve-photo'),record=sideState(garment,side)||C.emptySide();
      card.classList.toggle('is-selected',side===selected);const title=$('sleeve-select-'+side);title.textContent=C.labels[side]+' · '+record.layers.length;title.setAttribute('aria-pressed',String(side===selected));
      if(info){const [x,y,w,h]=info[side];stage.style.aspectRatio=`${w} / ${h}`;stage.style.setProperty('--sleeve-width',`${390*w/h}px`);stage.style.setProperty('--sleeve-mobile-width',`${340*w/h}px`);if(photo.getAttribute('src')!==info.src)photo.src=info.src;photo.style.cssText=`width:${info.width/w*100}%;height:${info.height/h*100}%;left:${-x/w*100}%;top:${-y/h*100}%;`;
        const existing=new Map([...print.querySelectorAll('[data-layer-id]')].map(el=>[el.dataset.layerId,el]));
        for(const [index,value]of record.layers.entries()){
          let art=existing.get(value.id);if(!art){art=node('button');art.type='button';art.className='sleeve-layer';art.dataset.layerId=value.id;const image=node('img');image.className='sleeve-design';image.alt='';image.draggable=false;art.append(image);print.append(art);}existing.delete(value.id);
          const image=art.querySelector('img');if(image.getAttribute('src')!==value.src)image.src=value.src;
          art.setAttribute('aria-label',`Seleccionar diseño ${index+1}: ${value.name}`);const active=side===selected&&value.id===record.activeId;art.classList.toggle('is-selected',active);art.setAttribute('aria-pressed',String(active));
          const d=C.fit(value,w*C.area.width,h*C.area.height);art.style.cssText=`left:${value.x}%;top:${value.y}%;width:${d.width/(w*C.area.width)*100}%;height:${d.height/(h*C.area.height)*100}%;transform:translate(-50%,-50%) rotate(${value.rotation}deg);z-index:${index+1};`;
        }
        for(const el of existing.values())el.remove();print.classList.toggle('has-overflow',record.layers.some(v=>C.outside(v,w*C.area.width,h*C.area.height)));
      }
      card.querySelector('.sleeve-empty').hidden=record.layers.length>0;
    }
    const record=sideState()||C.emptySide(),value=current()||C.empty(),list=$('sleeves-layers'),signature=record.layers.map(v=>v.id+':'+v.name).join('|');
    list.setAttribute('aria-label','Diseños de '+C.labels[selected].toLowerCase());
    if(list.dataset.signature!==signature){list.replaceChildren();for(const [index,v]of record.layers.entries()){const b=node('button',`${index+1} · ${v.name}`);b.type='button';b.dataset.layerId=v.id;b.onclick=()=>select(selected,v.id);list.append(b);}list.dataset.signature=signature;}
    for(const b of list.children){const active=b.dataset.layerId===record.activeId;b.setAttribute('aria-pressed',String(active));b.classList.toggle('is-selected',active);}
    $('sleeves-count').textContent=`${record.layers.length} diseño${record.layers.length===1?'':'s'} en esta manga · podés seguir agregando`;
    for(const [id,v]of [['sleeves-name',value.name],['sleeves-scale',Math.round(value.scale*100)],['sleeves-rotation',value.rotation],['sleeves-x',Math.round(value.x)],['sleeves-y',Math.round(value.y)],['sleeves-width-cm',value.widthCm??'']])if(document.activeElement!==$(id))$(id).value=v;
    $('sleeves-scale-value').textContent=Math.round(value.scale*100)+'%';$('sleeves-rotation-value').textContent=Math.round(value.rotation)+'°';
    for(const id of ['sleeves-name','sleeves-replace','sleeves-duplicate','sleeves-scale','sleeves-rotation','sleeves-x','sleeves-y','sleeves-width-cm','sleeves-remove','sleeves-center','sleeves-copy','sleeves-fit','sleeves-background'])$(id).disabled=!value.src;
    const index=record.layers.findIndex(v=>v.id===record.activeId);$('sleeves-backward').disabled=index<=0;$('sleeves-forward').disabled=index<0||index>=record.layers.length-1;
    $('sleeves-download').disabled=!info;
    $('sleeves-warning').hidden=!info||!C.outside(value,info[selected][2]*C.area.width,info[selected][3]*C.area.height);
    if(value.src)message(`${value.name} · ${value.width} × ${value.height} px originales${value.widthCm?` · ${value.widthCm} × ${(value.widthCm*value.height/value.width).toFixed(1)} cm solicitados`:''}`);
    else message('Agregá uno o varios PNG, JPG o WebP · hasta 5 MB por archivo.');
  }
  function sync(){
    const {garment,color}=context(),supported=C.supported(garment),info=C.asset(garment,color);
    $('tab-mangas').hidden=!supported;
    if(!supported&&currentTab===2)switchMockup(0);
    $('sleeves-pair').hidden=$('sleeves-settings').hidden=!info;
    const notice=$('sleeves-unavailable');notice.hidden=Boolean(info);notice.replaceChildren();
    if(supported&&!info){notice.append(node('p','Todavía no hay mockup de mangas para este color. Tus diseños se conservan. Podés continuar con:'));for(const key of Object.keys(C.manifest[garment])){const b=node('button',key==='black'?'Usar negro':'Usar blanco');b.type='button';b.onclick=()=>selectColor(key,document.querySelectorAll('.color-btn')[colors.findIndex(c=>c.key===key)]);notice.append(b);}}
    render();
    if(restoreView&&supported){restoreView=false;switchMockup(2);}
  }
  function patch(values,persist=true){const record=sideState(),value=current();if(!value)return;record.layers[record.layers.findIndex(v=>v.id===value.id)]=C.layer({...value,...values},value.id);render();if(persist)save();}
  function remove(){const record=sideState(),value=current();if(!value)return;C.remove(record,value.id);drag=null;render();save();}
  function scale(delta){const v=current();if(v)patch({scale:v.scale+delta});}
  async function install(src,name,request){
    const {side,garment,generation,layerId,revision}=request;
    if(!C.safeSource(src))throw Error('El archivo no es una imagen PNG, JPG o WebP válida.');
    const image=await loadImage(src);if(generation!==revisions[garment][side])return false;
    const data={src,name,width:image.naturalWidth,height:image.naturalHeight};
    if(!C.slot(data).src)throw Error('La imagen supera 40 MP o 16.384 px por lado. El archivo original se conserva.');
    const record=sideState(garment,side);
    if(layerId){if(!C.replace(record,layerId,data,revision))throw Error('El diseño seleccionado cambió o fue eliminado. No se reemplazó otro diseño.');}
    else { const info=C.asset(garment,context().color)||Object.values(C.manifest[garment])[0],crop=info[side],aw=crop[2]*C.area.width,ah=crop[3]*C.area.height,fit=C.fit({...data,scale:1},aw,ah);C.append(record,{...data,scale:Math.max(.1,Math.min(1,ah*.2/fit.height)),x:50,y:15+(record.layers.length%4)*22}); }
    render();save();return true;
  }
  async function acceptFile(file,request){
    try{
      if(file.size>5*1024*1024)throw Error('Usá una imagen de hasta 5 MB por archivo.');
      const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
      const mime=header[0]===137&&header[1]===80&&header[2]===78&&header[3]===71?'image/png':header[0]===255&&header[1]===216?'image/jpeg':String.fromCharCode(...header.slice(0,4))==='RIFF'&&String.fromCharCode(...header.slice(8,12))==='WEBP'?'image/webp':null;
      if(!mime)throw Error('Usá un archivo PNG, JPG o WebP válido.');
      const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('No se pudo leer el archivo. Podés elegirlo otra vez.'));reader.readAsDataURL(new Blob([file],{type:mime}));});
      return await install(src,file.name,request);
    }catch(e){if(request.generation===revisions[request.garment][request.side]){message(e.message);showToast(e.message);}return false;}
  }
  function enqueue(files,request){
    if(!C.supported(request.garment)||!C.asset(request.garment,context().color))return;
    const captured={...request,generation:revisions[request.garment][request.side]};
    const task=async()=>{let count=0;for(const file of files){if(captured.generation!==revisions[captured.garment][captured.side])break;if(await acceptFile(file,captured))count++;}if(count)showToast(`${count} diseño${count===1?'':'s'} ${captured.layerId?'actualizado':'agregado'}${count===1?'':'s'} en ${C.labels[captured.side].toLowerCase()}.`);};
    uploadQueue=uploadQueue.then(task,task);return uploadQueue;
  }
  function choose(replace=false){const {garment}=context(),value=current();if(replace&&!value)return;inputRequest={garment,side:selected,...(replace?{layerId:value.id,revision:value.revision}:{})};$('sleeves-file').multiple=!replace;$('sleeves-file').click();}
  $('sleeves-upload').onclick=()=>choose();$('sleeves-replace').onclick=()=>choose(true);
  $('sleeves-file').onchange=e=>{const files=[...(e.target.files||[])],request=inputRequest||{garment:context().garment,side:selected};e.target.value='';if(files.length)enqueue(files,request);};
  $('sleeves-remove').onclick=remove;$('sleeves-center').onclick=()=>patch({x:50,y:50});$('sleeves-fit').onclick=()=>patch({x:50,y:50,scale:1,rotation:0});
  $('sleeves-name').addEventListener('input',e=>patch({name:e.target.value}));
  for(const [id,key,factor]of [['sleeves-scale','scale',.01],['sleeves-rotation','rotation',1],['sleeves-x','x',1],['sleeves-y','y',1],['sleeves-width-cm','widthCm',1]])$(id).addEventListener('input',e=>{if(!e.target.validity.valid)return;patch({[key]:e.target.value===''?null:Number(e.target.value)*factor});});
  $('sleeves-duplicate').onclick=()=>{const value=current();if(!value)return;C.append(sideState(),{...value,name:value.name+' · copia',x:Math.min(100,value.x+5),y:Math.min(100,value.y+5),revision:0});render();save();};
  for(const [id,delta]of [['sleeves-backward',-1],['sleeves-forward',1]])$(id).onclick=()=>{if(C.move(sideState(),current()?.id,delta)){render();save();}};
  $('sleeves-copy').onclick=()=>{const {garment}=context(),other=selected==='left'?'right':'left';if(!current())return;C.append(sideState(garment,other),{...current(),revision:0});render();save();showToast('Diseño agregado a la otra manga sin reemplazar los existentes ni reflejar las letras.');};
  $('sleeves-background').onclick=()=>procesarDisenoAutomatico('background');
  async function process(tool){
    const {garment}=context(),side=selected,value=current();if(!value)return showToast('Seleccioná un diseño para procesar.');
    if(designerAutoToolBusy)return;const request={garment,side,generation:revisions[garment][side],layerId:value.id,revision:value.revision};designerAutoToolBusy=true;setDesignerAutoToolState(tool,true,0);$('sleeves-background').disabled=true;
    try{const result=await window.MomotusDesignerAutoTools.process(value.src,tool,p=>setDesignerAutoToolState(tool,true,p));if(await install(result.dataUrl,value.name,request))showToast(result.message);}
    catch(e){showToast(e.message||'No se pudo procesar el diseño.');}finally{designerAutoToolBusy=false;setDesignerAutoToolState(tool,false);render();}
  }
  async function capture(width=1000){
    const {garment,color}=context();if(!C.supported(garment))return null;
    const info=C.asset(garment,color),snapshot=C.restore(model).garments[garment],canvas=document.createElement('canvas');
    canvas.width=Math.max(400,Math.min(2200,Math.round(width)));canvas.height=Math.round(canvas.width*.65);const ctx=canvas.getContext('2d');ctx.fillStyle='#111827';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.textAlign='center';
    const photo=info?await loadImage(info.src):null;
    for(let i=0;i<2;i++){const side=C.sides[i],rows=snapshot[side].layers,cell=canvas.width/2,center=cell*(i+.5),top=65,available=canvas.height-top-22;ctx.fillStyle='#facc15';ctx.font=`bold ${Math.max(18,canvas.width*.026)}px system-ui`;ctx.fillText(C.labels[side].toUpperCase(),center,40);
      if(!photo){ctx.fillStyle='#cbd5e1';ctx.font='16px system-ui';ctx.fillText('Mockup de este color pendiente',center,110);ctx.fillText(rows.length?`${rows.length} diseños · adjuntá los originales`:'Sin diseño agregado',center,140);continue;}
      const crop=info[side],ratio=Math.min((cell-40)/crop[2],available/crop[3]),w=crop[2]*ratio,h=crop[3]*ratio,left=center-w/2;
      ctx.drawImage(photo,...crop,left,top,w,h);
      for(const v of rows){const image=await loadImage(v.src),a=C.area,x=left+w*a.x,y=top+h*a.y,aw=w*a.width,ah=h*a.height,d=C.fit(v,aw,ah);ctx.save();ctx.beginPath();ctx.rect(x,y,aw,ah);ctx.clip();ctx.translate(x+v.x/100*aw,y+v.y/100*ah);ctx.rotate(v.rotation*Math.PI/180);ctx.drawImage(image,-d.width/2,-d.height/2,d.width,d.height);ctx.restore();}
    }
    return canvas;
  }
  $('sleeves-download').onclick=async()=>{try{const canvas=await capture();if(!canvas)return;canvas.toBlob(blob=>{if(!blob)return showToast('No se pudo generar la vista.');const a=node('a');a.href=URL.createObjectURL(blob);a.download='momotus-vista-mangas.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),30000);},'image/png');}catch(e){showToast(e.message);}};
  window.MomotusSleeves=Object.freeze({
    sync,setVisible:visible=>{$('mockup-mangas').hidden=!visible;if(visible)sync();},
    serialize:()=>({...C.restore(model),selected,view:currentTab===2?'sleeves':'body'}),
    restore:value=>{for(const g of C.garments)for(const side of C.sides)revisions[g][side]++;model=C.restore(value);selected=C.sides.includes(value?.selected)?value.selected:'left';restoreView=value?.view==='sleeves';sync();},
    reset:()=>{for(const g of C.garments)for(const side of C.sides)revisions[g][side]++;model=C.blank();drag=null;render();},
    hasDesign:()=>C.hasDesign(model,context().garment),summary:()=>C.summary(model,context().garment),
    selectedSide:()=>selected,source:()=>current()?.src||null,selectedId:()=>current()?.id||null,selectedRevision:()=>current()?.revision,scale,rotate:degrees=>patch({rotation:Math.max(-180,Math.min(180,(current()?.rotation||0)+degrees))}),remove,process,capture,
    applyImported:async(src,sideIndex,layerId,revision)=>{const {garment}=context(),side=C.sides[sideIndex];if(!C.supported(garment)||!side)return false;selected=side;const record=sideState(garment,side);const target=record.layers.find(v=>v.id===layerId);if(target)record.activeId=layerId;return install(src,target?.name||'Diseño desde Herramientas',{garment,side,generation:revisions[garment][side],layerId,revision});}
  });
  sync();
})();
