(() => {
  'use strict';
  const C=window.MomotusSleevesCore,$=id=>document.getElementById(id);
  if(!C||!$('mockup-mangas'))return;
  let model=C.blank(),selected='left',restoreView=false,drag=null;
  const revisions={hoodie:{left:0,right:0},sudadera:{left:0,right:0}};
  const context=()=>({garment:shirtTypes[currentShirtType],color:currentColor});
  const current=()=>model.garments[context().garment]?.[selected];
  const asset=()=>C.asset(context().garment,context().color);
  const save=()=>saveCurrentDesign();
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el;};
  const message=text=>{$('sleeves-status').textContent=text;};
  const images=new Map();
  function loadImage(src){if(!images.has(src)){if(images.size>=8)images.delete(images.keys().next().value);const promise=new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('No se pudo abrir la imagen de mangas.'));img.src=src;});images.set(src,promise);promise.catch(()=>images.delete(src));}return images.get(src);}
  $('mockup-mangas').innerHTML=`
    <p class="sleeves-intro">Personalizá cada manga por separado. Izquierda y derecha corresponden a quien viste la prenda.</p>
    <div id="sleeves-unavailable" class="sleeves-message" hidden></div>
    <div id="sleeves-pair" class="sleeves-pair"></div>
    <section id="sleeves-settings" class="sleeves-settings" aria-labelledby="sleeves-selected-title">
      <h3 id="sleeves-selected-title">Manga izquierda</h3>
      <div class="sleeves-upload"><button class="sleeves-upload-main" id="sleeves-upload" type="button">Subir diseño a esta manga</button><button id="sleeves-remove" type="button">Eliminar</button></div>
      <input type="file" id="sleeves-file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" hidden>
      <div class="sleeves-control-grid">
        <label>Tamaño <output id="sleeves-scale-value">100%</output><input id="sleeves-scale" type="range" min="10" max="300" step="1" value="100"></label>
        <label>Giro <output id="sleeves-rotation-value">0°</output><input id="sleeves-rotation" type="range" min="-180" max="180" step="1" value="0"></label>
        <label>Posición horizontal (%)<input id="sleeves-x" type="number" min="0" max="100" step="1" value="50"></label>
        <label>Posición vertical (%)<input id="sleeves-y" type="number" min="0" max="100" step="1" value="50"></label>
        <label>Ancho solicitado (cm, opcional)<input id="sleeves-width-cm" type="number" min="0.5" max="30" step="0.1" placeholder="Por confirmar"></label>
      </div>
      <div class="sleeves-actions"><button id="sleeves-center" type="button">Centrar</button><button id="sleeves-copy" type="button">Copiar a la otra manga</button><button id="sleeves-fit" type="button">Ajustar al área</button></div>
      <div class="sleeves-actions"><button id="sleeves-background" type="button">Eliminar fondo de esta manga</button><button id="sleeves-download" type="button">Descargar vista de mangas</button></div>
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
    const art=node('img');art.className='sleeve-design';art.alt='Estampado de '+C.labels[side].toLowerCase();art.draggable=false;art.hidden=true;
    const empty=node('span','Arrastrá tu diseño aquí');empty.className='sleeve-empty';area.append(art,empty);stage.append(photo,area);card.append(button,stage);$('sleeves-pair').append(card);
    card.addEventListener('click',()=>select(side));
    card.addEventListener('dragover',e=>{e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='copy';});
    card.addEventListener('drop',e=>{e.preventDefault();e.stopPropagation();select(side);const file=e.dataTransfer?.files?.[0];if(file)acceptFile(file,side);});
    area.addEventListener('pointerdown',e=>{if(e.button!==0)return;select(side);const value=current();if(!value?.src)return;const r=area.getBoundingClientRect();drag={id:e.pointerId,garment:context().garment,side,revision:revisions[context().garment][side],x:e.clientX,y:e.clientY,startX:value.x,startY:value.y,width:r.width,height:r.height};area.setPointerCapture(e.pointerId);area.focus();e.preventDefault();});
    area.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const d=drag;if(context().garment!==d.garment||d.revision!==revisions[d.garment][d.side]){drag=null;return;}patch({x:d.startX+(e.clientX-d.x)/d.width*100,y:d.startY+(e.clientY-d.y)/d.height*100},false);});
    const end=e=>{if(drag?.id===e.pointerId){drag=null;save();}};for(const type of ['pointerup','pointercancel','lostpointercapture'])area.addEventListener(type,end);
    area.addEventListener('wheel',e=>{if(!model.garments[context().garment]?.[side]?.src)return;e.preventDefault();select(side);scale(e.deltaY<0?.05:-.05);},{passive:false});
    area.addEventListener('keydown',e=>{select(side);const v=current();if(!v?.src){if(e.key==='Enter')$('sleeves-file').click();return;}const step=e.shiftKey?5:1,delta={ArrowLeft:{x:v.x-step},ArrowRight:{x:v.x+step},ArrowUp:{y:v.y-step},ArrowDown:{y:v.y+step}}[e.key];if(delta){e.preventDefault();patch(delta);}else if(e.key==='Delete'){e.preventDefault();remove();}else if(e.key==='+'||e.key==='='){e.preventDefault();scale(.05);}else if(e.key==='-'){e.preventDefault();scale(-.05);}});
  }
  function select(side){if(!C.sides.includes(side))return;selected=side;render();}
  function render(){
    const {garment,color}=context(),info=C.asset(garment,color);
    $('sleeves-selected-title').textContent=C.labels[selected];
    for(const side of C.sides){
      const card=document.querySelector(`[data-sleeve="${side}"]`),stage=card.querySelector('.sleeve-stage'),print=card.querySelector('.sleeve-print-area'),photo=card.querySelector('.sleeve-photo'),art=card.querySelector('.sleeve-design'),value=model.garments[garment]?.[side]||C.empty();
      card.classList.toggle('is-selected',side===selected);$('sleeve-select-'+side).setAttribute('aria-pressed',String(side===selected));
      if(info){const [x,y,w,h]=info[side];stage.style.aspectRatio=`${w} / ${h}`;stage.style.setProperty('--sleeve-width',`${390*w/h}px`);stage.style.setProperty('--sleeve-mobile-width',`${340*w/h}px`);if(photo.getAttribute('src')!==info.src)photo.src=info.src;photo.style.cssText=`width:${info.width/w*100}%;height:${info.height/h*100}%;left:${-x/w*100}%;top:${-y/h*100}%;`;
        const d=C.fit(value,w*C.area.width,h*C.area.height);if(value.src){if(art.getAttribute('src')!==value.src)art.src=value.src;art.style.cssText=`left:${value.x}%;top:${value.y}%;width:${d.width/(w*C.area.width)*100}%;height:${d.height/(h*C.area.height)*100}%;transform:translate(-50%,-50%) rotate(${value.rotation}deg);`;}
        print.classList.toggle('has-overflow',C.outside(value,w*C.area.width,h*C.area.height));
      }
      art.hidden=!value.src;if(!value.src)art.removeAttribute('src');card.querySelector('.sleeve-empty').hidden=Boolean(value.src);
    }
    const value=current()||C.empty();
    for(const [id,v]of [['sleeves-scale',Math.round(value.scale*100)],['sleeves-rotation',value.rotation],['sleeves-x',Math.round(value.x)],['sleeves-y',Math.round(value.y)],['sleeves-width-cm',value.widthCm??'']])if(document.activeElement!==$(id))$(id).value=v;
    $('sleeves-scale-value').textContent=Math.round(value.scale*100)+'%';$('sleeves-rotation-value').textContent=Math.round(value.rotation)+'°';
    for(const id of ['sleeves-scale','sleeves-rotation','sleeves-x','sleeves-y','sleeves-width-cm','sleeves-remove','sleeves-center','sleeves-copy','sleeves-fit','sleeves-background'])$(id).disabled=!value.src;
    $('sleeves-download').disabled=!info;
    $('sleeves-warning').hidden=!info||!C.outside(value,info[selected][2]*C.area.width,info[selected][3]*C.area.height);
    if(value.src)message(`${value.name} · ${value.width} × ${value.height} px originales${value.widthCm?` · ${value.widthCm} × ${(value.widthCm*value.height/value.width).toFixed(1)} cm solicitados`:''}`);
    else message('PNG, JPG o WebP · hasta 5 MB. Cada manga conserva su diseño por separado.');
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
  function patch(values,persist=true){const {garment}=context();if(!current()?.src)return;model.garments[garment][selected]=C.slot({...current(),...values});render();if(persist)save();}
  function remove(){const {garment}=context();if(!C.supported(garment))return;revisions[garment][selected]++;model.garments[garment][selected]=C.empty();render();save();}
  function scale(delta){const v=current();if(v?.src)patch({scale:v.scale+delta});}
  async function install(src,name,side,garment,revision){
    if(!C.safeSource(src))throw Error('El archivo no es una imagen PNG, JPG o WebP válida.');
    const image=await loadImage(src);
    if(revision!==revisions[garment][side])return false;
    const value=C.slot({...model.garments[garment][side],src,name,width:image.naturalWidth,height:image.naturalHeight});
    if(!value.src)throw Error('La imagen supera 40 MP o 16.384 px por lado. El archivo original se conserva.');
    model.garments[garment][side]=value;render();save();return true;
  }
  async function acceptFile(file,side=selected){
    const {garment}=context();if(!C.supported(garment)||!asset())return;
    const revision=++revisions[garment][side];
    try{
      if(file.size>5*1024*1024)throw Error('Usá una imagen de hasta 5 MB.');
      const header=new Uint8Array(await file.slice(0,12).arrayBuffer());
      const mime=header[0]===137&&header[1]===80&&header[2]===78&&header[3]===71?'image/png':header[0]===255&&header[1]===216?'image/jpeg':String.fromCharCode(...header.slice(0,4))==='RIFF'&&String.fromCharCode(...header.slice(8,12))==='WEBP'?'image/webp':null;
      if(!mime)throw Error('Usá un archivo PNG, JPG o WebP válido.');
      const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('No se pudo leer el archivo. Podés elegirlo otra vez.'));reader.readAsDataURL(new Blob([file],{type:mime}));});
      if(await install(src,file.name,side,garment,revision))showToast('Diseño cargado en '+C.labels[side].toLowerCase());
    }catch(e){if(revision===revisions[garment][side]){message(e.message);showToast(e.message);}}
  }
  $('sleeves-upload').onclick=()=>$('sleeves-file').click();
  $('sleeves-file').onchange=e=>{const file=e.target.files?.[0];e.target.value='';if(file)acceptFile(file);};
  $('sleeves-remove').onclick=remove;$('sleeves-center').onclick=()=>patch({x:50,y:50});$('sleeves-fit').onclick=()=>patch({x:50,y:50,scale:1,rotation:0});
  for(const [id,key,factor]of [['sleeves-scale','scale',.01],['sleeves-rotation','rotation',1],['sleeves-x','x',1],['sleeves-y','y',1],['sleeves-width-cm','widthCm',1]])$(id).addEventListener('input',e=>{if(!e.target.validity.valid)return;patch({[key]:e.target.value===''?null:Number(e.target.value)*factor});});
  $('sleeves-copy').onclick=()=>{const {garment}=context(),other=selected==='left'?'right':'left';if(!current()?.src)return;if(model.garments[garment][other].src&&!confirm('La otra manga ya tiene un diseño. ¿Reemplazarlo con esta copia?'))return;revisions[garment][other]++;model.garments[garment][other]=C.slot(current());render();save();showToast('Copia independiente creada. Las letras conservan su orientación.');};
  $('sleeves-background').onclick=()=>procesarDisenoAutomatico('background');
  async function process(tool){
    const {garment}=context(),side=selected,value=current();if(!value?.src)return showToast('Subí un diseño a la manga seleccionada.');
    if(designerAutoToolBusy)return;const revision=revisions[garment][side];designerAutoToolBusy=true;setDesignerAutoToolState(tool,true,0);$('sleeves-background').disabled=true;
    try{const result=await window.MomotusDesignerAutoTools.process(value.src,tool,p=>setDesignerAutoToolState(tool,true,p));if(revisions[garment][side]!==revision||model.garments[garment][side].src!==value.src)throw Error('La manga cambió durante el proceso. Se conserva el diseño nuevo.');if(await install(result.dataUrl,value.name,side,garment,revision))showToast(result.message);}
    catch(e){showToast(e.message||'No se pudo procesar el diseño.');}finally{designerAutoToolBusy=false;setDesignerAutoToolState(tool,false);render();}
  }
  async function capture(width=1000){
    const {garment,color}=context();if(!C.supported(garment))return null;
    const info=C.asset(garment,color),snapshot=C.restore(model).garments[garment],canvas=document.createElement('canvas');
    canvas.width=Math.max(400,Math.min(2200,Math.round(width)));canvas.height=Math.round(canvas.width*.65);const ctx=canvas.getContext('2d');ctx.fillStyle='#111827';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.textAlign='center';
    const photo=info?await loadImage(info.src):null;
    for(let i=0;i<2;i++){const side=C.sides[i],v=snapshot[side],cell=canvas.width/2,center=cell*(i+.5),top=65,available=canvas.height-top-22;ctx.fillStyle='#facc15';ctx.font=`bold ${Math.max(18,canvas.width*.026)}px system-ui`;ctx.fillText(C.labels[side].toUpperCase(),center,40);
      if(!photo){ctx.fillStyle='#cbd5e1';ctx.font='16px system-ui';ctx.fillText('Mockup de este color pendiente',center,110);ctx.fillText(v.src?'Diseño agregado · adjuntá el original':'Sin diseño agregado',center,140);continue;}
      const crop=info[side],ratio=Math.min((cell-40)/crop[2],available/crop[3]),w=crop[2]*ratio,h=crop[3]*ratio,left=center-w/2;
      ctx.drawImage(photo,...crop,left,top,w,h);
      if(v.src){const image=await loadImage(v.src),a=C.area,x=left+w*a.x,y=top+h*a.y,aw=w*a.width,ah=h*a.height,d=C.fit(v,aw,ah);ctx.save();ctx.beginPath();ctx.rect(x,y,aw,ah);ctx.clip();ctx.translate(x+v.x/100*aw,y+v.y/100*ah);ctx.rotate(v.rotation*Math.PI/180);ctx.drawImage(image,-d.width/2,-d.height/2,d.width,d.height);ctx.restore();}
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
    selectedSide:()=>selected,source:()=>current()?.src||null,scale,rotate:degrees=>patch({rotation:Math.max(-180,Math.min(180,(current()?.rotation||0)+degrees))}),remove,process,capture,
    applyImported:async(src,sideIndex)=>{const {garment}=context(),side=C.sides[sideIndex];if(!C.supported(garment)||!side)return false;selected=side;const revision=++revisions[garment][side];return install(src,'Diseño desde Herramientas',side,garment,revision);}
  });
  sync();
})();
