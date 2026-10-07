(() => {
  'use strict';
  const core=window.MomotusEffectsCore, byId=id=>document.getElementById(id),panel=byId('efectos-dtf');
  if(!core||!panel||panel.dataset.ready)return;
  panel.dataset.ready='true';
  const descriptions={
    satin:['Bordado satén','Hilos paralelos con luz y sombra. Ideal para letras amplias y logos simples. Ajustá la dirección o aplicalo a un color del diseño.'],
    tatami:['Bordado tatami','Puntadas alternadas para áreas amplias. Textura de relleno simulado; no genera archivos para bordadora.'],
    chenille:['Chenille','Textura de bucles inspirada en parches universitarios. El DTF imprime esta apariencia sin fibras ni pelusa reales.'],
    screen:['Tintas planas','Reduce los escalones de color para un estilo gráfico inspirado en serigrafía. No crea vectores ni separaciones por tinta.'],
    halftone:['Trama de puntos','Convierte áreas tonales en puntos y espacios transparentes. La intensidad regula cuánto se abre la trama. Revisá los puntos a tamaño final.'],
    vintage:['Desgastado','Desgaste reproducible con pequeños huecos en el arte. El tamaño depende de la escala de textura; no afecta el fondo protegido.'],
    puff:['Relieve / puff','Luz y sombra en el contorno para sugerir volumen. El archivo DTF sigue siendo plano; el puff real necesita un acabado específico.'],
    metal:['Metálico','Bandas de brillo para un aspecto metálico impreso. No produce reflectividad real ni usa tinta metálica.'],
    glitter:['Glitter','Motas de luz y sombra para simular destellos. El brillo físico requiere material especial; evitá una textura demasiado pequeña.']
  };
  const controls=['strength','angle','pitch','levels','protect','background','remove','tolerance','selective','target','target-tolerance','width','auto-direction'];
  let source=null,filename='momotus',style='satin',generation=0,loadGeneration=0,timer=null,previewResult=null,previewOriginal=null,job=null,busy=false,compare=false;
  const status=(message,error=false)=>{byId('effects-status').textContent=message;byId('effects-status').classList.toggle('is-error',error);};
  const cancel=()=>{if(job){job.worker.terminate();job.reject(Error('Proceso reemplazado.'));job=null;}};
  const ready=value=>{byId('effects-download').disabled=!value||busy;};
  const setBusy=value=>{busy=value;panel.querySelectorAll('button,input,select').forEach(el=>{el.disabled=value;});if(!value){byId('effects-remove').disabled=!byId('effects-protect').checked;ready(Boolean(source&&previewResult));renderZones();}};
  function options(width){
    const widthCm=Number(byId('effects-width').value),pitch=Number(byId('effects-pitch').value),levels=Number(byId('effects-levels').value);
    if(!Number.isFinite(pitch)||pitch<0.2||pitch>3)throw Error('La escala de textura debe estar entre 0.2 y 3 mm.');
    if(!Number.isInteger(levels)||levels<2||levels>8)throw Error('Los escalones por canal deben ser un entero entre 2 y 8.');
    return {style,strength:Number(byId('effects-strength').value),angle:Number(byId('effects-angle').value),pitch,levels,pixelsPerMm:width/(widthCm*10),protect:byId('effects-protect').checked,background:byId('effects-background').value,remove:byId('effects-remove').checked&&byId('effects-protect').checked,tolerance:Number(byId('effects-tolerance').value),autoDirection:byId('effects-auto-direction')?.checked,selective:byId('effects-selective').checked,target:byId('effects-target').value,targetTolerance:Number(byId('effects-target-tolerance').value)};
  }
  const outputSize=()=>core.dimensions(source.width,source.height,Number(byId('effects-width').value));
  const hasInk=c=>{const ctx=c.getContext('2d');for(let y=0;y<c.height;y+=128){const data=ctx.getImageData(0,y,c.width,Math.min(128,c.height-y)).data;for(let i=3;i<data.length;i+=4)if(data[i])return true;}return false;};
  const canvasFrom=(pixels,w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').putImageData(new ImageData(pixels,w,h),0,0);return c;};
  const scaled=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,0,0,w,h);return c;};
  function process(c,opts){
    const layers=buildLayers(c.width,c.height);
    const pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    return new Promise((resolve,reject)=>{
      let worker;
      try {worker=new Worker(`herramientas/js/tools-effects-worker.js?v=${encodeURIComponent(window.MOMOTUS_TOOLS_VERSION)}`);}
      catch {setTimeout(()=>{try{resolve(canvasFrom(core.renderStack(pixels,c.width,c.height,opts,layers),c.width,c.height));}catch(e){reject(e);}},0);return;}
      const entry={worker,reject};job=entry;
      const done=()=>{worker.terminate();if(job===entry)job=null;};
      worker.onmessage=event=>{done();if(event.data.error)reject(Error(event.data.error));else resolve(canvasFrom(new Uint8ClampedArray(event.data.pixels),c.width,c.height));};
      worker.onerror=()=>{done();reject(Error('No se pudo procesar el efecto. Reintentá o recargá la página.'));};
      worker.postMessage({pixels:pixels.buffer,width:c.width,height:c.height,options:opts,layers},[pixels.buffer]);
    });
  }
  // Una sola superficie final; cada zona se procesa en franjas con bordes de lectura.
  // Retrasar la escritura una franja conserva los vecinos originales del relieve.
  async function processLarge(size,opts){
    captureZone();
    const result=scaled(size.width,size.height),ctx=result.getContext('2d',{willReadFrequently:true});
    const masks=document.createElement('canvas');masks.width=size.width;
    let worker=null;
    try{worker=new Worker(`herramientas/js/tools-effects-worker.js?v=${encodeURIComponent(window.MOMOTUS_TOOLS_VERSION)}`);}catch{}
    const run=(pixels,w,h,options,region)=>worker?new Promise((resolve,reject)=>{
      worker.onmessage=e=>e.data.error?reject(Error(e.data.error)):resolve(new Uint8ClampedArray(e.data.pixels));
      worker.onerror=()=>reject(Error('No se pudo procesar la salida grande. Reintentá con un ancho menor.'));
      const transfer=[pixels.buffer];if(region.mask)transfer.push(region.mask.buffer);
      worker.postMessage({pixels:pixels.buffer,width:w,height:h,options,region},transfer);
    }):new Promise((resolve,reject)=>setTimeout(()=>{try{const changed=core.render(pixels,w,h,options,region);if(region.mask)core.blendMask(pixels,changed,region.mask);resolve(changed);}catch(e){reject(e);}},0));
    const passes=[...(opts.remove?[{options:{...opts,style:'original'},mask:null}]:[]),...zones.filter(z=>z.enabled!==false).map(z=>({options:{...z.options,pixelsPerMm:opts.pixelsPerMm,protect:opts.protect,background:opts.background,remove:opts.remove,tolerance:opts.tolerance},mask:z.mask}))];
    const rows=Math.max(64,Math.min(512,Math.floor(1000000/size.width)));
    try{
      for(let pass=0;pass<passes.length;pass++){
        const layer=passes[pass],o=layer.options;
        let direction=null;
        if(o.autoDirection&&['satin','tatami','chenille'].includes(o.style)){
          const map=document.createElement('canvas'),ratio=Math.min(1,512/size.width,512/size.height);map.width=Math.max(1,Math.round(size.width*ratio));map.height=Math.max(1,Math.round(size.height*ratio));map.getContext('2d').drawImage(result,0,0,map.width,map.height);
          direction=core.directionMap(map.getContext('2d').getImageData(0,0,map.width,map.height).data,map.width,map.height,o);
          direction.scaleX=size.width/map.width;direction.scaleY=size.height/map.height;
        }
        const halo=o.style==='puff'?Math.max(1,Math.round(o.pitch*opts.pixelsPerMm*0.8)):0;
        let pending=null;
        for(let y=0;y<size.height;y+=rows){
          const count=Math.min(rows,size.height-y),top=Math.max(0,y-halo),bottom=Math.min(size.height,y+count+halo),height=bottom-top;
          const pixels=ctx.getImageData(0,top,size.width,height).data;
          let mask=null;
          if(layer.mask){masks.height=height;const mc=masks.getContext('2d');mc.drawImage(layer.mask,0,-top,size.width,size.height);const rgba=mc.getImageData(0,0,size.width,height).data;mask=new Uint8ClampedArray(size.width*height);for(let k=0;k<mask.length;k++)mask[k]=rgba[k*4+3];}
          const changed=await run(pixels,size.width,height,o,{x:0,y:top,direction,mask});
          if(pending)ctx.putImageData(pending.image,0,pending.top,0,pending.offset,size.width,pending.count);
          pending={image:new ImageData(changed,size.width,height),top,offset:y-top,count};
          status(`Procesando zona ${pass+1}/${passes.length} · ${Math.round((y+count)/size.height*100)}% · ${size.width} × ${size.height} px`);
        }
        if(pending)ctx.putImageData(pending.image,0,pending.top,0,pending.offset,size.width,pending.count);
      }
      return result;
    }finally{worker?.terminate();masks.width=1;masks.height=1;}
  }
  function fitPreview(){
    const c=byId('effects-preview'),stage=byId('effects-stage');
    if(!c.width||c.hidden)return;
    const ratio=stage.classList.contains('is-zoom')?1:Math.min(1,Math.max(1,stage.clientWidth-36)/c.width,Math.max(1,stage.clientHeight-36)/c.height);
    c.style.width=`${Math.round(c.width*ratio)}px`;c.style.height=`${Math.round(c.height*ratio)}px`;if(typeof drawMask==='function')drawMask();
  }
  function draw(){
    const result=fullView&&fullResult?(compare?scaled(fullResult.width,fullResult.height):fullResult):(compare?previewOriginal:previewResult);if(!result)return;
    const c=byId('effects-preview');c.width=result.width;c.height=result.height;c.getContext('2d').drawImage(result,0,0);c.hidden=false;byId('effects-empty').hidden=true;fitPreview();
  }
  function description(){const [name,text]=descriptions[style];byId('effects-current-name').textContent=name;byId('effects-description').textContent=text;byId('effects-levels-label').hidden=style!=='screen';
    byId('effects-angle').closest('label').hidden=!['satin','tatami','chenille','halftone','metal'].includes(style);
    byId('effects-auto-direction').closest('label').hidden=!['satin','tatami','chenille'].includes(style);
    byId('effects-pitch').closest('label').hidden=style==='screen';panel.querySelectorAll('[data-effect]').forEach(b=>{const active=b.dataset.effect===style;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}
  function labels(){byId('effects-strength-value').textContent=`${byId('effects-strength').value}%`;byId('effects-angle-value').textContent=`${byId('effects-angle').value}°`;byId('effects-selective-fields').hidden=!byId('effects-selective').checked;byId('effects-remove').disabled=!byId('effects-protect').checked||busy;}
  async function preview(token){
    if(!source)return;
    try {
      const size=outputSize(),ratio=Math.min(1,960/size.width,960/size.height),w=Math.max(1,Math.round(size.width*ratio)),h=Math.max(1,Math.round(size.height*ratio)),opts=options(w);
      byId('effects-dimensions').textContent=`${size.width} × ${size.height} px · ${Number(byId('effects-width').value)} × ${size.heightCm.toFixed(1)} cm · 300 DPI`;
      status('Preparando vista previa…');
      const original=scaled(w,h),result=await process(original,opts);
      if(token!==generation)return;
      previewOriginal=original;previewResult=result;draw();if(!hasInk(result)){previewResult=null;ready(false);status('El resultado no tiene píxeles visibles. Revisá el fondo y los ajustes.',true);return;}ready(true);
      const note=size.upscaled?' Se ampliarán los píxeles del original; esto no recupera detalle perdido.':'';
      status(`Vista previa reducida (${w} × ${h} px). La exportación usa el tamaño final.${note}`);
      byId('effects-export-note').textContent=size.upscaled?'Ampliación desde el original. Revisá su nitidez.':'Transparencia conservada. Fondo de vista previa excluido.';
    }catch(e){if(token!==generation)return;previewResult=null;ready(false);status(e.message,true);}
  }
  function schedule(){if(busy)return;captureZone();fullResult=null;generation++;cancel();clearTimeout(timer);fullView=false;if(byId('effects-final-view'))byId('effects-final-view').textContent='Revisar salida final al 100%';previewResult=null;ready(false);labels();const token=generation;timer=setTimeout(()=>preview(token),160);}
  function checkSource(c){if(!c?.width||!c.height||c.width>core.limits.side||c.height>core.limits.side||c.width*c.height>core.limits.pixels)throw Error('La imagen admite hasta 16384 px por lado y 64 millones de píxeles.');}
  function install(c,name){checkSource(c);source=c;resetZones();filename=String(name||'momotus').replace(/\.[^.]+$/,'').replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,70)||'momotus';byId('effects-filename').textContent=`${filename} · ${c.width} × ${c.height} px`;byId('effects-width').value=Math.max(1,Math.min(65,c.width/300*2.54)).toFixed(1);compare=false;byId('effects-compare').textContent='Ver original';byId('effects-compare').setAttribute('aria-pressed','false');schedule();}
  async function loadFile(file){
    if(!file||busy)return;const token=++loadGeneration;generation++;cancel();clearTimeout(timer);ready(false);status('Abriendo imagen…');
    let url;
    try{
      if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>24*1024*1024)throw Error('Usá PNG, JPG o WebP de hasta 24 MB.');
      url=URL.createObjectURL(file);const image=new Image();image.src=url;await image.decode();if(token!==loadGeneration)return;
      checkSource({width:image.naturalWidth,height:image.naturalHeight});const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;c.getContext('2d').drawImage(image,0,0);install(c,file.name);
    }catch(e){if(token!==loadGeneration)return;status(e.message,true);ready(Boolean(source&&previewResult));}
    finally{if(url)URL.revokeObjectURL(url);}
  }
  byId('effects-file').addEventListener('change',e=>{loadFile(e.target.files[0]);e.target.value='';});
  const stage=byId('effects-stage');stage.addEventListener('dragover',e=>e.preventDefault());stage.addEventListener('drop',e=>{e.preventDefault();loadFile(e.dataTransfer.files[0]);});
  document.addEventListener('paste',e=>{if(panel.hidden||busy||['INPUT','TEXTAREA'].includes(e.target.tagName))return;const file=[...e.clipboardData.items].find(i=>i.type.startsWith('image/'))?.getAsFile();if(file){e.preventDefault();loadFile(file);}});
  byId('effects-demo').addEventListener('click',()=>{loadGeneration++;const c=document.createElement('canvas');c.width=1600;c.height=1000;const ctx=c.getContext('2d');ctx.fillStyle='#ffcc00';ctx.beginPath();ctx.arc(800,350,220,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ff5145';ctx.fillRect(430,670,740,170);ctx.fillStyle='#ffffff';ctx.font='bold 110px sans-serif';ctx.textAlign='center';ctx.fillText('MOMOTUS',800,795);ctx.fillStyle='#101010';ctx.font='bold 155px sans-serif';ctx.fillText('M',800,405);install(c,'ejemplo-momotus.png');});
  controls.forEach(key=>byId(`effects-${key}`)?.addEventListener('input',schedule));
  panel.querySelectorAll('[data-effect]').forEach(button=>button.addEventListener('click',()=>{style=button.dataset.effect;description();schedule();}));
  panel.querySelectorAll('[data-effects-bg]').forEach(button=>button.addEventListener('click',()=>{stage.dataset.background=button.dataset.effectsBg;panel.querySelectorAll('[data-effects-bg]').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});}));
  byId('effects-compare').addEventListener('click',()=>{compare=!compare;byId('effects-compare').textContent=compare?'Ver efecto':'Ver original';byId('effects-compare').setAttribute('aria-pressed',String(compare));draw();});
  byId('effects-zoom').addEventListener('click',()=>{stage.classList.toggle('is-zoom');byId('effects-zoom').setAttribute('aria-pressed',String(stage.classList.contains('is-zoom')));fitPreview();});
  byId('effects-fit').addEventListener('click',()=>{stage.classList.remove('is-zoom');byId('effects-zoom').setAttribute('aria-pressed','false');fitPreview();});
  byId('effects-reset').addEventListener('click',()=>{style='satin';for(const [key,value] of Object.entries({strength:65,angle:35,pitch:0.65,levels:4,background:'#000000',tolerance:12,target:'#ffcc00','target-tolerance':40}))byId(`effects-${key}`).value=value;byId('effects-auto-direction').checked=true;byId('effects-protect').checked=true;byId('effects-remove').checked=false;byId('effects-selective').checked=false;description();schedule();});
  const blobOf=c=>new Promise((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('No se pudo crear el PNG.')),'image/png'));
  async function finalOutput(action){
    if(!source||busy)return;clearTimeout(timer);generation++;cancel();setBusy(true);
    try{const size=outputSize(),opts=options(size.width);status('Procesando el estampado a tamaño final…');const result=fullResult||await (size.width*size.height>4000000||Math.max(size.width,size.height)>8000?processLarge(size,opts):process(scaled(size.width,size.height),opts));if(!hasInk(result))throw Error('El resultado está vacío. Revisá el fondo y los ajustes.');const actionResult=await action(result);status('Resultado preparado a tamaño final.');return actionResult;}
    catch(e){status(e.message,true);}
    finally{setBusy(false);}
  }
  const downloadEffect=()=>finalOutput(async c=>{const original=await blobOf(c),bytes=core.png300(new Uint8Array(await original.arrayBuffer())),blob=new Blob([bytes],{type:'image/png'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`${filename}-${style}-300dpi.png`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);});
  // Zonas, máscaras e historial pertenecen a este documento de Efectos.
  let zones=[],activeZone=0,zoneSequence=0,fullResult=null,fullView=false,painting=false,lastPoint=null,paintMode='off';
  let snapshots=[],historyIndex=-1,historyTimer=null,saveTimer=null,restoring=false;
  const copySettings=()=>Object.fromEntries(controls.map(key=>{const input=byId(`effects-${key}`);return [key,input.type==='checkbox'?input.checked:input.value];}));
  const setSettings=settings=>{for(const [key,value]of Object.entries(settings)){const input=byId(`effects-${key}`);if(!input)continue;if(input.type==='checkbox')input.checked=Boolean(value);else input.value=value;}labels();};
  const advanced=document.createElement('section');advanced.className='effects-advanced';
  advanced.innerHTML=`<div class="effects-history"><button id="effects-undo" type="button" disabled>↶ Deshacer</button><button id="effects-redo" type="button" disabled>↷ Rehacer</button></div><fieldset><legend>Zonas y combinación</legend><select id="effects-zones" aria-label="Zona activa"></select><label>Nombre de la zona<input id="effects-zone-name" type="text" maxlength="40" value="Diseño completo"></label><div class="effects-zone-actions"><button id="effects-zone-add" type="button">+ Zona</button><button id="effects-zone-duplicate" type="button">Duplicar</button><button id="effects-zone-delete" type="button">Eliminar</button></div><label class="effects-check"><input id="effects-zone-enabled" type="checkbox" checked> Mostrar esta zona</label><small>De abajo hacia arriba: una zona nueva aplica su textura sobre las anteriores.</small><div class="effects-zone-actions"><button id="effects-zone-down" type="button">Bajar</button><button id="effects-zone-up" type="button">Subir</button></div></fieldset><fieldset><legend>Selección con pincel</legend><div class="effects-zone-actions"><button id="effects-brush" type="button" aria-pressed="false">Pintar</button><button id="effects-eraser" type="button" aria-pressed="false">Borrar</button><button id="effects-pointer" type="button">Mover vista</button></div><label>Tamaño del pincel <small>% del ancho del diseño</small><input id="effects-brush-size" type="range" min="1" max="30" value="8"></label><label class="effects-check"><input id="effects-show-mask" type="checkbox" checked> Ver selección</label><div class="effects-zone-actions"><button id="effects-mask-all" type="button">Seleccionar todo</button><button id="effects-mask-clear" type="button">Vaciar selección</button></div><small>Pintar una zona completa inicia una selección vacía; Borrar parte de la selección actual. El original queda intacto.</small></fieldset>`;
  panel.querySelector('.effects-presets').before(advanced);
  const auto=document.createElement('label');auto.className='effects-check';auto.innerHTML='<input id="effects-auto-direction" type="checkbox" checked> Orientar puntadas por contornos';byId('effects-angle').closest('label').after(auto);byId('effects-auto-direction').addEventListener('input',schedule);
  const projectUI=document.createElement('details');projectUI.className='effects-detail';projectUI.innerHTML=`<summary>Proyectos y estilos guardados</summary><div class="effects-zone-actions"><button id="effects-project-save" type="button">Guardar proyecto</button><button id="effects-project-restore" type="button">Recuperar guardado</button><button id="effects-project-export" type="button">Exportar proyecto</button></div><label class="effects-upload">Importar .efectos<input id="effects-project-import" type="file" accept=".efectos,application/json"></label><p id="effects-save-status" role="status">El guardado automático queda en este navegador.</p><label>Nombre del estilo<input id="effects-style-name" type="text" maxlength="40" placeholder="Mi bordado"></label><button id="effects-style-save" type="button">Guardar estilo de esta zona</button><select id="effects-style-list" aria-label="Estilos guardados"><option value="">Elegí un estilo</option></select><button id="effects-style-apply" type="button">Aplicar estilo</button>`;byId('effects-reset').after(projectUI);
  const reviewButton=document.createElement('button');reviewButton.id='effects-final-view';reviewButton.type='button';reviewButton.textContent='Revisar salida final al 100%';panel.querySelector('.effects-view-buttons').append(reviewButton);
  const maskOverlay=document.createElement('canvas');maskOverlay.id='effects-mask-overlay';maskOverlay.setAttribute('aria-label','Pintar selección en el diseño');maskOverlay.tabIndex=0;stage.append(maskOverlay);
  const rawOptions=()=>({style,strength:Number(byId('effects-strength').value),angle:Number(byId('effects-angle').value),pitch:Number(byId('effects-pitch').value),levels:Number(byId('effects-levels').value),autoDirection:byId('effects-auto-direction').checked,selective:byId('effects-selective').checked,target:byId('effects-target').value,targetTolerance:Number(byId('effects-target-tolerance').value)});
  function captureZone(){if(!zones[activeZone]||restoring)return;zones[activeZone].options=rawOptions();}
  function resetZones(){zones=[{id:++zoneSequence,name:'Diseño completo',enabled:true,options:rawOptions(),mask:null}];activeZone=0;snapshots=[];historyIndex=-1;fullResult=null;fullView=false;paintMode='off';renderZones();setTimeout(()=>{recordHistory();queueSave();},0);}
  const newMask=filled=>{const c=document.createElement('canvas'),ratio=source?source.height/source.width:1;c.width=Math.max(1,Math.round(512/Math.max(1,ratio)));c.height=Math.max(1,Math.min(512,Math.round(c.width*ratio)));if(filled){const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);}return c;};
  function renderZones(){const select=byId('effects-zones');select.replaceChildren(...zones.map((zone,index)=>{const option=document.createElement('option');option.value=index;option.textContent=`${index+1}. ${zone.name}${zone.enabled?'':' (oculta)'}`;return option;}));select.value=activeZone;const z=zones[activeZone];if(z){byId('effects-zone-name').value=z.name;byId('effects-zone-enabled').checked=z.enabled;}byId('effects-zone-delete').disabled=zones.length<=1||busy;byId('effects-zone-add').disabled=zones.length>=8||busy;byId('effects-zone-duplicate').disabled=zones.length>=8||busy;byId('effects-zone-down').disabled=activeZone===0||busy;byId('effects-zone-up').disabled=activeZone===zones.length-1||busy;updateHistoryButtons();}
  function selectZone(index,capture=true){if(capture)captureZone();activeZone=index;const z=zones[index];if(!z)return;style=z.options.style;for(const [key,value]of Object.entries(z.options)){const id=({'autoDirection':'auto-direction','targetTolerance':'target-tolerance'})[key]||key;const el=byId(`effects-${id}`);if(el){if(el.type==='checkbox')el.checked=value;else el.value=value;}}description();labels();renderZones();drawMask();}
  function buildLayers(w,h){captureZone();return zones.map(z=>{let mask=null;if(z.mask){const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(z.mask,0,0,w,h);const data=c.getContext('2d').getImageData(0,0,w,h).data;mask=new Uint8ClampedArray(w*h);for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3];}return {options:z.options,enabled:z.enabled,mask};});}
  function drawMask(){if(paintMode==='off'){maskOverlay.width=1;maskOverlay.height=1;maskOverlay.style.pointerEvents='none';return;}const c=byId('effects-preview');if(!c||c.hidden)return;maskOverlay.width=c.width;maskOverlay.height=c.height;maskOverlay.style.left=`${c.offsetLeft}px`;maskOverlay.style.top=`${c.offsetTop}px`;maskOverlay.style.width=c.style.width;maskOverlay.style.height=c.style.height;maskOverlay.style.pointerEvents=paintMode==='off'?'none':'auto';maskOverlay.style.cursor=paintMode==='off'?'default':'crosshair';const ctx=maskOverlay.getContext('2d'),z=zones[activeZone];if(byId('effects-show-mask').checked&&paintMode!=='off'&&z){if(z.mask)ctx.drawImage(z.mask,0,0,c.width,c.height);else{ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);}ctx.globalCompositeOperation='source-in';ctx.fillStyle='rgba(0,200,255,0.35)';ctx.fillRect(0,0,c.width,c.height);} }
  function setPaint(mode){if(!source||busy)return;paintMode=mode;const z=zones[activeZone];if(!z.mask&&mode!=='off'){z.mask=newMask(mode==='erase');schedule();recordHistory();}byId('effects-brush').setAttribute('aria-pressed',String(mode==='paint'));byId('effects-eraser').setAttribute('aria-pressed',String(mode==='erase'));drawMask();}
  function paint(event){if(!painting)return;const z=zones[activeZone],rect=maskOverlay.getBoundingClientRect(),x=(event.clientX-rect.left)/rect.width*z.mask.width,y=(event.clientY-rect.top)/rect.height*z.mask.height,size=Number(byId('effects-brush-size').value)/100*z.mask.width,ctx=z.mask.getContext('2d');ctx.globalCompositeOperation=paintMode==='erase'?'destination-out':'source-over';ctx.strokeStyle='#fff';ctx.fillStyle='#fff';ctx.lineWidth=size;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(lastPoint?.x??x,lastPoint?.y??y);ctx.lineTo(x,y);ctx.stroke();ctx.beginPath();ctx.arc(x,y,size/2,0,Math.PI*2);ctx.fill();lastPoint={x,y};drawMask();}
  maskOverlay.addEventListener('pointerdown',event=>{if(busy||paintMode==='off'||!source||event.button!==0)return;event.preventDefault();const z=zones[activeZone];if(!z.mask)z.mask=newMask(paintMode==='erase');painting=true;lastPoint=null;maskOverlay.setPointerCapture(event.pointerId);paint(event);});maskOverlay.addEventListener('pointermove',paint);
  const finish=event=>{if(!painting)return;painting=false;lastPoint=null;if(maskOverlay.hasPointerCapture(event.pointerId))maskOverlay.releasePointerCapture(event.pointerId);schedule();recordHistory();};maskOverlay.addEventListener('pointerup',finish);maskOverlay.addEventListener('pointercancel',finish);
  const snapshot=()=>({settings:copySettings(),style,activeZone,layers:zones.map(z=>({id:z.id,name:z.name,enabled:z.enabled,options:{...z.options},mask:z.mask?.toDataURL('image/png')||null}))});
  function recordHistory(){if(!source||restoring)return;captureZone();clearTimeout(historyTimer);const s=JSON.stringify(snapshot());if(snapshots[historyIndex]===s)return;snapshots=snapshots.slice(0,historyIndex+1);snapshots.push(s);if(snapshots.length>30)snapshots.shift();historyIndex=snapshots.length-1;updateHistoryButtons();queueSave();}
  function updateHistoryButtons(){if(!byId('effects-undo'))return;byId('effects-undo').disabled=busy||historyIndex<=0;byId('effects-redo').disabled=busy||historyIndex>=snapshots.length-1;}
  const decodeCanvas=async data=>{if(typeof data!=='string'||!data.startsWith('data:image/png;base64,')||data.length>100000000)throw Error('Imagen del proyecto no válida.');const image=new Image();image.src=data;await image.decode();checkSource({width:image.naturalWidth,height:image.naturalHeight});const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;c.getContext('2d').drawImage(image,0,0);return c;};
  async function restoredZones(layers){return Promise.all(layers.map(async z=>{const mask=z.mask?await decodeCanvas(z.mask):null;if(mask&&(mask.width>512||mask.height>512))throw Error('La máscara supera 512 px.');return {...z,name:String(z.name||'Zona').slice(0,40),options:{...z.options},mask};}));}
  async function restoreState(state){const restored=await restoredZones(state.layers);restoring=true;zones=restored;activeZone=Math.max(0,Math.min(zones.length-1,state.activeZone||0));zoneSequence=Math.max(zoneSequence,...zones.map(z=>Number(z.id)||0));setSettings(state.settings);style=state.style;restoring=false;selectZone(activeZone,false);schedule();}
  async function undo(delta){if(busy)return;clearTimeout(historyTimer);if(delta<0)recordHistory();const index=historyIndex+delta;if(index<0||index>=snapshots.length)return;setBusy(true);try{await restoreState(JSON.parse(snapshots[index]));historyIndex=index;}catch(e){status(e.message,true);}finally{setBusy(false);schedule();updateHistoryButtons();queueSave();}}
  byId('effects-undo').addEventListener('click',()=>undo(-1));byId('effects-redo').addEventListener('click',()=>undo(1));
  controls.forEach(key=>byId(`effects-${key}`).addEventListener('input',()=>{clearTimeout(historyTimer);historyTimer=setTimeout(recordHistory,300);}));
  panel.querySelectorAll('[data-effect]').forEach(button=>button.addEventListener('click',recordHistory));byId('effects-reset').addEventListener('click',recordHistory);
  document.addEventListener('keydown',event=>{if(panel.hidden||busy||['INPUT','TEXTAREA','SELECT'].includes(event.target.tagName))return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.stopImmediatePropagation();undo(event.shiftKey?1:-1);}},true);
  byId('effects-zones').addEventListener('change',event=>{selectZone(Number(event.target.value));recordHistory();});byId('effects-zone-add').addEventListener('click',()=>{if(!source||zones.length>=8)return;captureZone();zones.push({id:++zoneSequence,name:`Zona ${zones.length+1}`,enabled:true,options:rawOptions(),mask:newMask(false)});activeZone=zones.length-1;selectZone(activeZone);setPaint('paint');schedule();recordHistory();});byId('effects-zone-delete').addEventListener('click',()=>{if(zones.length<=1)return;zones.splice(activeZone,1);activeZone=Math.min(activeZone,zones.length-1);selectZone(activeZone,false);schedule();recordHistory();});
  byId('effects-zone-name').addEventListener('input',e=>{zones[activeZone].name=e.target.value;renderZones();clearTimeout(historyTimer);historyTimer=setTimeout(recordHistory,300);});byId('effects-zone-enabled').addEventListener('change',e=>{zones[activeZone].enabled=e.target.checked;schedule();renderZones();recordHistory();});
  for(const [id,delta]of [['effects-zone-down',-1],['effects-zone-up',1]])byId(id).addEventListener('click',()=>{const n=activeZone+delta;if(n<0||n>=zones.length)return;captureZone();[zones[n],zones[activeZone]]=[zones[activeZone],zones[n]];activeZone=n;selectZone(n);schedule();recordHistory();});
  byId('effects-brush').addEventListener('click',()=>setPaint('paint'));byId('effects-eraser').addEventListener('click',()=>setPaint('erase'));byId('effects-pointer').addEventListener('click',()=>setPaint('off'));byId('effects-show-mask').addEventListener('change',drawMask);
  byId('effects-mask-all').addEventListener('click',()=>{zones[activeZone].mask=null;schedule();recordHistory();});byId('effects-mask-clear').addEventListener('click',()=>{zones[activeZone].mask=newMask(false);schedule();recordHistory();});
  reviewButton.addEventListener('click',()=>{if(fullView){fullView=false;reviewButton.textContent='Revisar salida final al 100%';stage.classList.remove('is-zoom');draw();return;}finalOutput(async c=>{fullResult=c;fullView=true;reviewButton.textContent='Volver a vista rápida';stage.classList.add('is-zoom');draw();status('Salida final al 100%: cada píxel del lienzo corresponde a un píxel del PNG. Arrastrá las barras para recorrerla.');});});
  let cachedSource=null,cachedSourceData=null;
  const projectData=()=>{captureZone();const state=snapshot();const meta={format:'momotus-effects-project',version:1,widthCm:Number(byId('effects-width').value),filename,...state};core.validateProject(meta);if(cachedSource!==source){cachedSourceData=source.toDataURL('image/png');cachedSource=source;}return {...meta,source:cachedSourceData};};
  const database=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('momotus-effects',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('El guardado está bloqueado por otra pestaña.'));});
  let saveQueue=Promise.resolve();
  function storeProject(data){const task=async()=>{const db=await database();try{await new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(data,'active');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||Error('Guardado abortado.'));tx.onerror=()=>{};});}finally{db.close();}};const result=saveQueue.catch(()=>{}).then(task);saveQueue=result;return result;}
  function queueSave(){clearTimeout(saveTimer);saveTimer=setTimeout(saveLocal,900);}
  async function saveLocal(){if(!source||restoring)return;try{const data=projectData();await storeProject(data);byId('effects-save-status').textContent='Proyecto guardado en este navegador.';}catch(e){byId('effects-save-status').textContent='No se pudo guardar: '+e.message+' Exportá el proyecto como respaldo.';}}
  async function loadProject(data){core.validateProject(data);const image=await decodeCanvas(data.source),restored=await restoredZones(data.layers);core.dimensions(image.width,image.height,data.widthCm);restoring=true;source=image;filename=String(data.filename||'momotus').slice(0,70);zones=restored;activeZone=Math.max(0,Math.min(zones.length-1,data.activeZone||0));setSettings(data.settings||{});byId('effects-width').value=data.widthCm;style=zones[activeZone].options.style;zoneSequence=Math.max(...zones.map(z=>Number(z.id)||0));restoring=false;fullResult=null;fullView=false;byId('effects-filename').textContent=`${filename} · ${image.width} × ${image.height} px`;snapshots=[];historyIndex=-1;selectZone(activeZone,false);recordHistory();schedule();}
  byId('effects-project-save').addEventListener('click',saveLocal);byId('effects-project-restore').addEventListener('click',async()=>{if(busy)return;setBusy(true);let loaded=false;try{await saveQueue.catch(()=>{});const db=await database();let data;try{data=await new Promise((resolve,reject)=>{const r=db.transaction('projects').objectStore('projects').get('active');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}if(!data)throw Error('Todavía no hay un proyecto guardado.');await loadProject(data);loaded=true;}catch(e){status(e.message,true);}finally{setBusy(false);if(loaded)schedule();}});
  const downloadBlob=(blob,name)=>{const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);};
  byId('effects-project-export').addEventListener('click',()=>{try{if(!source)throw Error('Primero cargá una imagen.');downloadBlob(new Blob([JSON.stringify(projectData())],{type:'application/json'}),`${filename}.efectos`);}catch(e){status(e.message,true);}});
  byId('effects-project-import').addEventListener('change',async e=>{const file=e.target.files[0];e.target.value='';if(!file||busy)return;setBusy(true);let loaded=false;try{if(file.size>128*1024*1024)throw Error('El proyecto supera 128 MB.');const data=JSON.parse(await file.text());await loadProject(data);loaded=true;}catch(error){status(error.message,true);}finally{setBusy(false);if(loaded)schedule();}});
  let savedStyles={};try{savedStyles=JSON.parse(localStorage.getItem('momotus-effects-styles')||'{}');if(!savedStyles||Array.isArray(savedStyles)||typeof savedStyles!=='object')savedStyles={};}catch{}
  function stylesList(){byId('effects-style-list').replaceChildren(new Option('Elegí un estilo',''),...Object.keys(savedStyles).map(key=>new Option(key,key)));}
  byId('effects-style-save').addEventListener('click',()=>{const name=byId('effects-style-name').value.trim();if(!name){status('Escribí un nombre para el estilo.',true);return;}try{const next={...savedStyles,[name]:rawOptions()};if(Object.keys(next).length>30)throw Error('Máximo 30 estilos guardados.');localStorage.setItem('momotus-effects-styles',JSON.stringify(next));savedStyles=next;stylesList();status('Estilo guardado.');}catch(e){status('No se pudo guardar el estilo: '+e.message,true);}});
  byId('effects-style-apply').addEventListener('click',()=>{const value=savedStyles[byId('effects-style-list').value];if(!value)return;try{core.validateProject({format:'momotus-effects-project',version:1,widthCm:28,layers:[{options:value}]});zones[activeZone].options={...value};selectZone(activeZone,false);schedule();recordHistory();}catch(e){status(e.message,true);}});

  // Muestras generadas con el mismo motor; solo las miniaturas tienen tamaño reducido.
  const thumbWidth=104,thumbHeight=58,thumb=document.createElement('canvas');thumb.width=thumbWidth;thumb.height=thumbHeight;
  const tc=thumb.getContext('2d');tc.fillStyle='#d9b44a';tc.fillRect(8,8,88,42);tc.clearRect(38,19,28,20);
  const thumbPixels=tc.getImageData(0,0,thumbWidth,thumbHeight).data;
  panel.querySelectorAll('[data-effect]').forEach(button=>{const c=document.createElement('canvas');c.width=thumbWidth;c.height=thumbHeight;c.setAttribute('aria-hidden','true');const pixels=core.render(thumbPixels,thumbWidth,thumbHeight,{style:button.dataset.effect,strength:75,angle:35,pitch:.65,pixelsPerMm:5,levels:4,protect:false,remove:false,selective:false});c.getContext('2d').putImageData(new ImageData(pixels,thumbWidth,thumbHeight),0,0);button.querySelector('b')?.replaceWith(c);});
  const controlsAside=panel.querySelector('.effects-controls');
  const zoneField=advanced.querySelector('fieldset'),brushField=advanced.querySelectorAll('fieldset')[1];
  const brushDetails=document.createElement('details');brushDetails.className='effects-detail';const brushSummary=document.createElement('summary');brushSummary.textContent='Selección precisa con pincel';brushDetails.append(brushSummary,brushField);zoneField.after(brushDetails);
  const zoneDetails=document.createElement('details');zoneDetails.className='effects-detail';zoneDetails.open=true;const zoneSummary=document.createElement('summary');zoneSummary.textContent='Zonas del diseño';zoneDetails.append(zoneSummary,zoneField);advanced.append(zoneDetails,brushDetails);
  panel.querySelector('.effects-presets').after(byId('effects-description'));
  const effectField=byId('effects-strength').closest('fieldset');effectField.after(advanced);
  panel.querySelector('.effects-view-buttons').prepend(advanced.querySelector('.effects-history'));
  const hint=document.createElement('small');hint.className='pro-help';hint.textContent='Elegí una técnica, ajustá su intensidad y revisá el tamaño final. Zonas y pincel permiten trabajar por partes.';panel.querySelector('.effects-presets').before(hint);
  byId('effects-zone-duplicate').addEventListener('click',()=>{if(!source||busy||zones.length>=8)return;captureZone();const old=zones[activeZone],mask=old.mask?document.createElement('canvas'):null;if(mask){mask.width=old.mask.width;mask.height=old.mask.height;mask.getContext('2d').drawImage(old.mask,0,0);}zones.splice(activeZone+1,0,{id:++zoneSequence,name:(old.name+' · copia').slice(0,40),enabled:old.enabled,options:{...old.options},mask});activeZone++;selectZone(activeZone,false);schedule();recordHistory();});
  const sampleButton=document.createElement('button');sampleButton.type='button';sampleButton.id='effects-final-sample';sampleButton.textContent='Muestra final 512 px';panel.querySelector('.effects-view-buttons').append(sampleButton);
  const sampleDialog=document.createElement('dialog');sampleDialog.className='pro-dialog';sampleDialog.innerHTML='<form method="dialog"><header><h3>Detalle de salida · 100%</h3><button aria-label="Cerrar muestra">×</button></header></form><p>Un píxel de esta muestra equivale a un píxel del PNG final.</p><div class="pro-sample-wrap"><canvas id="effects-sample-canvas"></canvas></div><label>Posición horizontal<input id="effects-sample-x" type="range" min="0" value="0"></label><label>Posición vertical<input id="effects-sample-y" type="range" min="0" value="0"></label>';document.body.append(sampleDialog);
  let sampleResult=null;
  function drawSample(){if(!sampleResult)return;const c=byId('effects-sample-canvas');c.width=Math.min(512,sampleResult.width);c.height=Math.min(512,sampleResult.height);c.getContext('2d').drawImage(sampleResult,Number(byId('effects-sample-x').value),Number(byId('effects-sample-y').value),c.width,c.height,0,0,c.width,c.height);}
  for(const id of ['effects-sample-x','effects-sample-y'])byId(id).addEventListener('input',drawSample);
  sampleDialog.addEventListener('close',()=>{sampleResult=null;});
  sampleButton.addEventListener('click',()=>finalOutput(async c=>{sampleResult=c;byId('effects-sample-x').max=Math.max(0,c.width-512);byId('effects-sample-y').max=Math.max(0,c.height-512);byId('effects-sample-x').value=Math.max(0,Math.floor((c.width-512)/2));byId('effects-sample-y').value=Math.max(0,Math.floor((c.height-512)/2));drawSample();sampleDialog.showModal();}));
  const exportDialog=document.createElement('dialog');exportDialog.className='pro-dialog';exportDialog.innerHTML='<form method="dialog"><header><h3>Exportar estampado</h3><button aria-label="Cerrar revisión">×</button></header></form><p id="effects-export-summary"></p><p>PNG RGB · 300 DPI. El fondo de vista previa no se incluye. Se conserva el canal alfa con las modificaciones elegidas en Fondo y zonas.</p><p>Bordado, puff, metálico y glitter son apariencias impresas.</p><div class="pro-actions"><button id="effects-export-back" type="button">Volver a ajustar</button><button id="effects-export-confirm" type="button">Descargar PNG</button></div>';document.body.append(exportDialog);
  byId('effects-download').addEventListener('click',()=>{if(!source||busy)return;try{const d=outputSize();byId('effects-export-summary').textContent=`${Number(byId('effects-width').value)} × ${d.heightCm.toFixed(1)} cm · ${d.width} × ${d.height} px · ${zones.filter(z=>z.enabled!==false).length} zonas activas`;exportDialog.showModal();}catch(e){status(e.message,true);}});
  byId('effects-export-back').addEventListener('click',()=>exportDialog.close());byId('effects-export-confirm').addEventListener('click',()=>{exportDialog.close();downloadEffect();});
  stylesList();resetZones();

  window.MomotusEffectsAPI=Object.freeze({
    hasDocument:()=>Boolean(source&&previewResult&&!busy),
    getDocumentInfo:()=>{if(!source)return null;try{const d=outputSize();return {type:'effects',filename:`${filename}-${style}`,naturalWidth:d.width,naturalHeight:d.height};}catch{return null;}},
  });
  const notify=()=>window.dispatchEvent(new CustomEvent('momotus:result-ready',{detail:{type:'effects',ready:Boolean(source&&previewResult&&!busy)}}));
  new MutationObserver(notify).observe(byId('effects-download'),{attributes:true,attributeFilter:['disabled']});
  const syncWorkspace=()=>document.body.classList.toggle('effects-tool-active',!panel.hidden);
  new MutationObserver(syncWorkspace).observe(panel,{attributes:true,attributeFilter:['hidden']});
  new ResizeObserver(fitPreview).observe(stage);
  syncWorkspace();
  window.addEventListener('beforeunload',cancel);
  description();labels();
})();
