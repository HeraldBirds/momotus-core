(() => {
  'use strict';

  if (!window.MOMOTUS_TOOLS_DESKTOP) return;

  const byId = id => document.getElementById(id);
  const CORE_PANELS = new Set(['semitonos', 'eliminar-fondo', 'mejorar-calidad']);
  const EXTRA_PANELS = new Set(['vectorizacion', 'calculadora-dtf', 'efectos-dtf']);
  const MAX_FILE_SIZE = 24 * 1024 * 1024;
  const SUPPORTED_EXTENSION = /\.(?:png|jpe?g|webp)$/i;
  const currency = new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', minimumFractionDigits: 2 });

  const closeExtraOptions = dialog => {
    if (!dialog) return;
    dialog.hidden = true;
    const controls = dialog.closest('.extra-controls');
    const trigger = controls?.querySelector('.extra-options-trigger');
    const backdrop = controls?.querySelector('.extra-options-backdrop');
    if (backdrop) backdrop.hidden = true;
    trigger?.classList.remove('active');
    trigger?.setAttribute('aria-expanded', 'false');
  };

  const closeAllExtraOptions = () => {
    document.querySelectorAll('.extra-options-dialog').forEach(closeExtraOptions);
  };

  const enableReliableWheelScroll = element => {
    if (!element || element.dataset.wheelScrollReady) return;
    element.dataset.wheelScrollReady = 'true';
    element.addEventListener('wheel', event => {
      if (event.ctrlKey || event.metaKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      const maximum = element.scrollHeight - element.clientHeight;
      const numberInput = event.target instanceof Element && event.target.closest('input[type="number"]');
      if (maximum <= 1) {
        if (numberInput) event.preventDefault();
        return;
      }
      const previous = element.scrollTop;
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 18 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? element.clientHeight : 1;
      element.scrollTop = Math.max(0, Math.min(maximum, previous + event.deltaY * unit));
      if (element.scrollTop !== previous || numberInput) event.preventDefault();
    }, { passive: false });
  };

  document.querySelectorAll('.extra-controls').forEach(controls => {
    controls.classList.add('pro-inspector');
    enableReliableWheelScroll(controls.querySelector('.extra-control-scroll'));
  });
  enableReliableWheelScroll(document.querySelector('.calculator-sheet-wrap'));
  document.querySelectorAll('.calculator-results, .extra-control-scroll').forEach(enableReliableWheelScroll);

  const setStudioState = (name, status = 'Listo') => {
    const info = byId('editor-image-info');
    const state = byId('editor-workspace-state');
    if (info) info.textContent = name;
    if (state) {
      state.className = 'tool-workspace-state ready';
      const label = state.querySelector('strong');
      if (label) label.textContent = status;
    }
  };

  const openExtraTool = target => {
    if (!EXTRA_PANELS.has(target)) return;
    closeAllExtraOptions();
    document.querySelectorAll('.tool-panel').forEach(panel => { panel.hidden = panel.id !== target; });
    document.querySelectorAll('.tool-shortcut').forEach(button => {
      const selected = button.dataset.extraTool === target;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    document.body.classList.add('extra-tool-active');
    const workspaceNames = {
      vectorizacion: 'Vectorización SVG',
      'calculadora-dtf': 'Calculadora de cotizaciones',
      'efectos-dtf': 'Efectos de estampado'
    };
    setStudioState(workspaceNames[target] || 'Herramientas DTF');
    if (history.replaceState) history.replaceState(null, '', `${location.pathname}${location.search}#${target}`);
    window.dispatchEvent(new CustomEvent('momotus:extra-tool', { detail: { target } }));
  };

  document.querySelectorAll('[data-extra-tool]').forEach(button => {
    button.setAttribute('aria-controls', button.dataset.extraTool);
    button.addEventListener('click', () => openExtraTool(button.dataset.extraTool));
  });
  document.querySelectorAll('[data-tool-target]').forEach(button => button.addEventListener('click', () => {
    closeAllExtraOptions();
    document.body.classList.remove('extra-tool-active');
    document.querySelectorAll('.extra-tool-panel').forEach(panel => { panel.hidden = true; });
    document.querySelectorAll('[data-extra-tool]').forEach(item => {
      item.classList.remove('active');
      item.setAttribute('aria-selected', 'false');
    });
  }));

  // ==================== VECTORIZACIÓN ====================
  const vectorState = {
    filename: 'momotus-vector',
    source: null,
    workCanvas: null,
    resultImageData: null,
    svg: '',
    view: 'result',
    colors: 0,
    runs: 0
  };

  const isSupportedImage = file => Boolean(file && (
    ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(String(file.type || '').toLowerCase())
    || SUPPORTED_EXTENSION.test(file.name || '')
  ));

  const loadImage = file => new Promise((resolve, reject) => {
    if (!isSupportedImage(file)) return reject(new Error('Escogé una imagen PNG, JPG o WebP.'));
    if (file.size > MAX_FILE_SIZE) return reject(new Error('La imagen debe pesar 24 MB o menos.'));
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve({ image, url });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer esa imagen.')); };
    image.src = url;
  });

  const updateVectorLabels = () => {
    byId('vector-detail-value').textContent = `${byId('vector-detail').value} px`;
    byId('vector-smoothing-value').textContent = `${Number(byId('vector-smoothing').value).toFixed(2)} px`;
    byId('vector-noise-value').textContent = `${byId('vector-noise').value} px`;
    byId('vector-white-value').textContent = byId('vector-white').value;
  };

  const renderVectorView = () => {
    const canvas = byId('vector-canvas');
    const source = vectorState.workCanvas;
    if (!source) return;
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (vectorState.view === 'original' || !vectorState.resultImageData) context.drawImage(vectorState.source,0,0,canvas.width,canvas.height);
    else if(vectorState.svgCanvas) context.drawImage(vectorState.svgCanvas,0,0);
    else context.putImageData(vectorState.resultImageData, 0, 0);
    if(byId('vector-compare')?.checked && vectorState.svgCanvas){
      const split=canvas.width*Number(byId('vector-divider').value)/100;
      context.save();context.beginPath();context.rect(0,0,split,canvas.height);context.clip();context.drawImage(vectorState.source,0,0,canvas.width,canvas.height);context.restore();
      context.fillStyle='#67e8f9';context.fillRect(split,0,1,canvas.height);
    }
    const viewport=byId('vector-viewport'),zoom=byId('vector-zoom')?.value||'fit';
    const ratio=zoom==='fit'?Math.min(1,(viewport.clientWidth-48)/canvas.width,(viewport.clientHeight-48)/canvas.height):Number(zoom)/100;
    canvas.style.width=`${Math.max(1,Math.round(canvas.width*ratio))}px`;
    canvas.style.height=`${Math.max(1,Math.round(canvas.height*ratio))}px`;
  };

  const samplePixels = (data, ignoreWhite, whiteLimit) => {
    const pixels = [];
    const total = data.length / 4;
    const stride = Math.max(1, Math.floor(total / 14000));
    for (let pixel = 0; pixel < total; pixel += stride) {
      const index = pixel * 4;
      if (data[index + 3] < 48) continue;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      if (ignoreWhite && red >= whiteLimit && green >= whiteLimit && blue >= whiteLimit) continue;
      pixels.push([red, green, blue]);
    }
    return pixels;
  };

  const colorDistance = (a, b) => {
    const red = a[0] - b[0];
    const green = a[1] - b[1];
    const blue = a[2] - b[2];
    return red * red * 0.3 + green * green * 0.59 + blue * blue * 0.11;
  };

  const buildPalette = (samples, count) => {
    if (!samples.length) return [[0, 0, 0]];
    const centroids = [samples.reduce((darkest, color) => color[0] + color[1] + color[2] < darkest[0] + darkest[1] + darkest[2] ? color : darkest, samples[0]).slice()];
    while (centroids.length < count) {
      let candidate = samples[0];
      let distance = -1;
      for (const color of samples) {
        const nearest = Math.min(...centroids.map(centroid => colorDistance(color, centroid)));
        if (nearest > distance) { distance = nearest; candidate = color; }
      }
      centroids.push(candidate.slice());
    }
    for (let iteration = 0; iteration < 7; iteration++) {
      const sums = centroids.map(() => [0, 0, 0, 0]);
      for (const color of samples) {
        let best = 0;
        let bestDistance = Infinity;
        centroids.forEach((centroid, index) => {
          const distance = colorDistance(color, centroid);
          if (distance < bestDistance) { bestDistance = distance; best = index; }
        });
        sums[best][0] += color[0];
        sums[best][1] += color[1];
        sums[best][2] += color[2];
        sums[best][3]++;
      }
      sums.forEach((sum, index) => {
        if (!sum[3]) return;
        centroids[index] = [Math.round(sum[0] / sum[3]), Math.round(sum[1] / sum[3]), Math.round(sum[2] / sum[3])];
      });
    }
    return centroids.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  };

  const removeSmallRegions = (labels, width, height, minimumArea) => {
    if (minimumArea <= 1) return;
    const visited = new Uint8Array(labels.length);
    const queue = new Int32Array(labels.length);
    for (let start = 0; start < labels.length; start++) {
      if (visited[start] || labels[start] < 0) continue;
      const label = labels[start];
      let head = 0;
      let tail = 1;
      queue[0] = start;
      visited[start] = 1;
      while (head < tail) {
        const index = queue[head++];
        const x = index % width;
        const y = Math.floor(index / width);
        const neighbors = [x > 0 ? index - 1 : -1, x + 1 < width ? index + 1 : -1, y > 0 ? index - width : -1, y + 1 < height ? index + width : -1];
        for (const neighbor of neighbors) {
          if (neighbor < 0 || visited[neighbor] || labels[neighbor] !== label) continue;
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
      if (tail < minimumArea) for (let index = 0; index < tail; index++) labels[queue[index]] = -1;
    }
  };

  const rgbHex = color => `#${color.map(value => value.toString(16).padStart(2, '0')).join('')}`;

  const buildSvg = (labels, palette, width, height, widthCm, optimize = true) => {
    const paths = palette.map(() => []);
    let runs = 0;
    if (!optimize) {
      for (let y = 0; y < height; y++) {
        let x = 0;
        while (x < width) {
          const label = labels[y * width + x];
          if (label < 0) { x++; continue; }
          let end = x + 1;
          while (end < width && labels[y * width + end] === label) end++;
          paths[label].push(`M${x} ${y}h${end - x}v1h-${end - x}z`);
          runs++;
          x = end;
        }
      }
    } else {
      const active = palette.map(() => new Map());
      const flush = (label, key) => {
        const rectangle = active[label].get(key);
        if (!rectangle) return;
        paths[label].push(`M${rectangle.x} ${rectangle.y}h${rectangle.width}v${rectangle.height}h-${rectangle.width}z`);
        active[label].delete(key);
        runs++;
      };
      for (let y = 0; y < height; y++) {
        const continued = palette.map(() => new Set());
        let x = 0;
        while (x < width) {
          const label = labels[y * width + x];
          if (label < 0) { x++; continue; }
          let end = x + 1;
          while (end < width && labels[y * width + end] === label) end++;
          const key = `${x}:${end}`;
          const previous = active[label].get(key);
          if (previous) previous.height++;
          else active[label].set(key, { x, y, width: end - x, height: 1 });
          continued[label].add(key);
          x = end;
        }
        active.forEach((rectangles, label) => [...rectangles.keys()].forEach(key => {
          if (!continued[label].has(key)) flush(label, key);
        }));
      }
      active.forEach((rectangles, label) => [...rectangles.keys()].forEach(key => flush(label, key)));
    }
    const heightCm = widthCm * height / width;
    const body = paths.map((commands, index) => commands.length ? `<path fill="${rgbHex(palette[index])}" d="${commands.join('')}"/>` : '').join('');
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${widthCm}cm" height="${heightCm.toFixed(3)}cm" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet"><title>Vector Momotus DTF</title>${body}</svg>`,
      runs,
      heightCm
    };
  };

  let vectorRenderGeneration=0,vectorProcessing=false;
  const vectorHistory=[];let vectorHistoryIndex=-1,restoringVector=false;
  function recordVector(){
    if(restoringVector||!vectorState.labels)return;
    const snapshot={workCanvas:vectorState.workCanvas,resultImageData:vectorState.resultImageData,labels:new Int16Array(vectorState.labels),palette:vectorState.palette.map(c=>[...c]),settings:Object.fromEntries([...document.querySelectorAll('#vectorizacion input,#vectorizacion select')].filter(e=>e.id&&e.type!=='file'&&!e.closest('#vector-palette')).map(e=>[e.id,e.type==='checkbox'?e.checked:e.value]))};
    vectorHistory.splice(vectorHistoryIndex+1);vectorHistory.push(snapshot);if(vectorHistory.length>20)vectorHistory.shift();vectorHistoryIndex=vectorHistory.length-1;updateVectorHistory();
  }
  function updateVectorHistory(){byId('vector-undo').disabled=vectorHistoryIndex<=0||vectorProcessing;byId('vector-redo').disabled=vectorHistoryIndex>=vectorHistory.length-1||vectorProcessing;}
  function traceVector(w,h,cm,options){
    return new Promise((resolve,reject)=>{
      let worker;try{worker=new Worker(`herramientas/js/tools-vector-worker.js?v=${encodeURIComponent(window.MOMOTUS_TOOLS_VERSION)}`);}catch{resolve(window.MomotusVectorCore.build(vectorState.labels,vectorState.palette,w,h,cm,options));return;}
      worker.onmessage=e=>{worker.terminate();if(e.data.error)reject(Error(e.data.error));else resolve(e.data.result);};worker.onerror=()=>{worker.terminate();reject(Error('No se pudo trazar. Reintentá o elegí el método de bloques.'));};
      const labels=new Int16Array(vectorState.labels);worker.postMessage({labels:labels.buffer,palette:vectorState.palette,width:w,height:h,widthCm:cm,options},[labels.buffer]);
    });
  }
  async function refreshVector(){
    const token=++vectorRenderGeneration,w=vectorState.workCanvas.width,h=vectorState.workCanvas.height;
    const widthCm=Math.max(2,Math.min(57,Number(byId('vector-width-cm').value)||30));
    byId('vector-download').disabled=true;byId('vector-status').textContent='Construyendo contornos…';
    const svg=byId('vector-method').value==='blocks'?buildSvg(vectorState.labels,vectorState.palette,w,h,widthCm,byId('vector-optimize').checked):await traceVector(w,h,widthCm,{tolerance:Number(byId('vector-path-tolerance').value),curves:byId('vector-curves').checked});
    if(token!==vectorRenderGeneration)return;
    vectorState.svg=svg.svg;vectorState.runs=svg.runs;vectorState.colors=vectorState.palette.length;
    byId('vector-download').disabled=true;
    const url=URL.createObjectURL(new Blob([svg.svg],{type:'image/svg+xml'}));
    try{const image=new Image();image.src=url;await image.decode();if(token!==vectorRenderGeneration)return;const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(image,0,0,w,h);vectorState.svgCanvas=c;renderVectorView();byId('vector-download').disabled=false;}finally{URL.revokeObjectURL(url);}
    const bytes=new Blob([svg.svg]).size;
    byId('vector-result-info').textContent=`${svg.runs.toLocaleString('es-NI')} contornos · ${(bytes/1024).toFixed(1)} KB`;
    byId('vector-status').textContent=`${widthCm.toFixed(1)} × ${svg.heightCm.toFixed(1)} cm · ${w} × ${h} px de análisis · ${svg.nodes??svg.runs} nodos/formas. SVG escalable.`;
    renderVectorPalette();updateVectorHistory();
  }
  async function safeRefreshVector(){try{await refreshVector();}catch(e){byId('vector-status').textContent=e.message;byId('vector-download').disabled=true;}}
  function renderVectorPalette(){
    const holder=byId('vector-palette');holder.replaceChildren();
    vectorState.palette.forEach((color,index)=>{if(!vectorState.labels.includes(index))return;
      const row=document.createElement('div');row.className='vector-color-row';
      const input=document.createElement('input');input.type='color';input.value=rgbHex(color);input.setAttribute('aria-label',`Editar color ${index+1}`);
      const target=document.createElement('select');target.setAttribute('aria-label',`Unir color ${index+1} con`);target.add(new Option('Unir con…',''));
      vectorState.palette.forEach((c,i)=>{if(i!==index&&vectorState.labels.includes(i))target.add(new Option(`Color ${i+1} · ${rgbHex(c)}`,String(i)));});
      const remove=document.createElement('button');remove.type='button';remove.textContent='Eliminar';remove.setAttribute('aria-label',`Eliminar color ${index+1}`);
      const label=document.createElement('span');label.textContent=String(index+1);
      input.addEventListener('change',async()=>{vectorState.palette[index]=input.value.slice(1).match(/../g).map(v=>parseInt(v,16));recordVector();await safeRefreshVector();});
      target.addEventListener('change',async()=>{if(target.value==='')return;const next=Number(target.value);vectorState.labels=vectorState.labels.map(v=>v===index?next:v);recordVector();await safeRefreshVector();});
      remove.addEventListener('click',async()=>{if(!vectorState.labels.some(v=>v>=0&&v!==index)){byId('vector-status').textContent='Conservá al menos un color visible.';return;}vectorState.labels=vectorState.labels.map(v=>v===index?-1:v);recordVector();await safeRefreshVector();});
      row.append(label,input,target,remove);holder.append(row);
    });
  }
  for(const [id,delta]of [['vector-undo',-1],['vector-redo',1]])byId(id).addEventListener('click',async()=>{const index=vectorHistoryIndex+delta;if(vectorProcessing||index<0||index>=vectorHistory.length)return;const state=vectorHistory[index];restoringVector=true;for(const [key,v]of Object.entries(state.settings)){const e=byId(key);if(e){if(e.type==='checkbox')e.checked=v;else e.value=v;}}vectorState.workCanvas=state.workCanvas;vectorState.resultImageData=state.resultImageData;vectorState.labels=new Int16Array(state.labels);vectorState.palette=state.palette.map(c=>[...c]);vectorHistoryIndex=index;restoringVector=false;updateVectorLabels();await safeRefreshVector();});
  for(const id of ['vector-method','vector-path-tolerance','vector-curves','vector-optimize','vector-width-cm'])byId(id).addEventListener('change',async()=>{if(!vectorState.labels)return;recordVector();await safeRefreshVector();});
  for(const id of ['vector-compare','vector-divider','vector-zoom'])byId(id).addEventListener('input',renderVectorView);
  new ResizeObserver(renderVectorView).observe(byId('vector-viewport'));
  const processVector = async () => {
    if (!vectorState.source || vectorProcessing) return;
    vectorProcessing=true;
    const button = byId('vector-process');
    button.disabled = true;
    byId('vector-download').disabled = true;
    byId('vector-status').textContent = 'Analizando colores y construyendo trazados…';
    await new Promise(resolve => requestAnimationFrame(resolve));
    try {
      const maxSide = Number(byId('vector-detail').value);
      const smoothing = Number(byId('vector-smoothing').value);
      const scale = Math.min(1, maxSide / Math.max(vectorState.source.naturalWidth, vectorState.source.naturalHeight));
      const width = Math.max(1, Math.round(vectorState.source.naturalWidth * scale));
      const height = Math.max(1, Math.round(vectorState.source.naturalHeight * scale));
      const work = document.createElement('canvas');
      work.width = width;
      work.height = height;
      const context = work.getContext('2d', { willReadFrequently: true });
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.filter = smoothing ? `blur(${smoothing}px)` : 'none';
      context.drawImage(vectorState.source, 0, 0, width, height);
      context.filter = 'none';
      const imageData = context.getImageData(0, 0, width, height);
      const data = imageData.data;
      const ignoreWhite = byId('vector-ignore-white').checked;
      const whiteLimit = Number(byId('vector-white').value);
      const requestedColors = Math.max(2, Math.min(16, Number(byId('vector-colors').value) || 4));
      const samples = samplePixels(data, ignoreWhite, whiteLimit);
      if (!samples.length) throw new Error('No quedaron colores visibles con esos ajustes. Bajá “Eliminar blancos”.');
      const palette = buildPalette(samples, Math.min(requestedColors, samples.length));
      const labels = new Int16Array(width * height);
      labels.fill(-1);
      for (let pixel = 0; pixel < width * height; pixel++) {
        const index = pixel * 4;
        const red = data[index];
        const green = data[index + 1];
        const blue = data[index + 2];
        if (data[index + 3] < 48 || (ignoreWhite && red >= whiteLimit && green >= whiteLimit && blue >= whiteLimit)) continue;
        let best = 0;
        let bestDistance = Infinity;
        palette.forEach((color, colorIndex) => {
          const distance = colorDistance([red, green, blue], color);
          if (distance < bestDistance) { bestDistance = distance; best = colorIndex; }
        });
        labels[pixel] = best;
      }
      removeSmallRegions(labels, width, height, Number(byId('vector-noise').value));
      const result = context.createImageData(width, height);
      for (let pixel = 0; pixel < labels.length; pixel++) {
        const index = pixel * 4;
        const label = labels[pixel];
        if (label < 0) continue;
        result.data[index] = palette[label][0];
        result.data[index + 1] = palette[label][1];
        result.data[index + 2] = palette[label][2];
        result.data[index + 3] = 255;
      }
      vectorState.workCanvas = work;
      vectorState.resultImageData = result;
      vectorState.labels=labels;vectorState.palette=palette;vectorState.svgCanvas=null;
      vectorState.view='result';
      document.querySelectorAll('[data-vector-view]').forEach(item=>item.classList.toggle('active',item.dataset.vectorView==='result'));
      recordVector();await safeRefreshVector();
      setStudioState('Vectorización SVG', 'Resultado listo');
    } catch (error) {
      byId('vector-status').textContent = error.message || 'No se pudo vectorizar la imagen.';
    } finally {
      vectorProcessing=false;updateVectorHistory();
      button.disabled = !vectorState.source;
    }
  };

  const acceptVectorFile = async file => {
    if(vectorProcessing){byId('vector-status').textContent='Esperá a que termine el trazado actual.';return;}
    try {
      byId('vector-status').textContent = 'Cargando imagen…';
      const loaded = await loadImage(file);
      if (vectorState.sourceUrl) URL.revokeObjectURL(vectorState.sourceUrl);
      vectorState.source = loaded.image;
      vectorHistory.length=0;vectorHistoryIndex=-1;vectorState.labels=null;vectorState.svgCanvas=null;
      vectorState.sourceUrl = loaded.url;
      vectorState.filename = (file.name || 'momotus-vector').replace(/\.[^.]+$/, '');
      vectorState.workCanvas = document.createElement('canvas');
      const scale = Math.min(1, 1200 / Math.max(loaded.image.naturalWidth, loaded.image.naturalHeight));
      vectorState.workCanvas.width = Math.max(1, Math.round(loaded.image.naturalWidth * scale));
      vectorState.workCanvas.height = Math.max(1, Math.round(loaded.image.naturalHeight * scale));
      vectorState.workCanvas.getContext('2d').drawImage(loaded.image, 0, 0, vectorState.workCanvas.width, vectorState.workCanvas.height);
      vectorState.resultImageData = null;
      byId('vector-empty').hidden = true;
      byId('vector-process').disabled = false;
      byId('vector-download').disabled = true;
      byId('vector-document-info').textContent = `${file.name} · ${loaded.image.naturalWidth} × ${loaded.image.naturalHeight} px`;
      byId('vector-status').textContent = 'Imagen lista. Escogé un perfil y vectorizá.';
      renderVectorView();
      await processVector();
    } catch (error) {
      byId('vector-status').textContent = error.message;
    } finally {
      byId('vector-file').value = '';
    }
  };

  byId('vector-file').addEventListener('change', event => acceptVectorFile(event.target.files?.[0]));
  window.addEventListener('momotus:vector-import', event => {
    const file = event.detail?.file;
    if (!file) return;
    openExtraTool('vectorizacion');
    acceptVectorFile(file);
  });
  byId('vector-process').addEventListener('click', processVector);
  byId('vector-download').addEventListener('click', () => {
    if (!vectorState.svg) return;
    const blob = new Blob([vectorState.svg], { type: 'image/svg+xml;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${vectorState.filename}-vector-dtf.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
  });
  document.querySelectorAll('[data-vector-view]').forEach(button => button.addEventListener('click', () => {
    vectorState.view = button.dataset.vectorView;
    document.querySelectorAll('[data-vector-view]').forEach(item => item.classList.toggle('active', item === button));
    renderVectorView();
  }));
  byId('vector-fit').addEventListener('click',()=>{byId('vector-zoom').value='fit';renderVectorView();});
  ['vector-detail', 'vector-smoothing', 'vector-noise', 'vector-white'].forEach(id => byId(id).addEventListener('input', updateVectorLabels));
  document.querySelectorAll('[data-vector-preset]').forEach(button => button.addEventListener('click', () => {
    const presets = {
      logo: { colors: 4, detail: 420, smoothing: 0.75, noise: 4, white: 245, ignore: true },
      illustration: { colors: 10, detail: 560, smoothing: 1, noise: 3, white: 250, ignore: false },
      mono: { colors: 2, detail: 480, smoothing: 0.5, noise: 6, white: 235, ignore: true }
    };
    const preset = presets[button.dataset.vectorPreset];
    byId('vector-colors').value = preset.colors;
    byId('vector-detail').value = preset.detail;
    byId('vector-smoothing').value = preset.smoothing;
    byId('vector-noise').value = preset.noise;
    byId('vector-white').value = preset.white;
    byId('vector-ignore-white').checked = preset.ignore;
    document.querySelectorAll('[data-vector-preset]').forEach(item => item.classList.toggle('active', item === button));
    updateVectorLabels();
    if (vectorState.source) processVector();
  }));
  updateVectorLabels();

  // ==================== CALCULADORA DE PLIEGOS ====================
  const calcIds = ['calc-sheet-width', 'calc-sheet-height', 'calc-margin', 'calc-gap', 'calc-design-width', 'calc-design-height', 'calc-quantity', 'calc-rotate', 'calc-sheet-cost', 'calc-consumables-cost', 'calc-setup-cost', 'calc-unit-cost', 'calc-waste', 'calc-profit'];
  const costProfileIds = ['calc-sheet-cost', 'calc-consumables-cost', 'calc-setup-cost', 'calc-unit-cost', 'calc-waste', 'calc-profit'];
  const COST_PROFILE_KEY = 'momotusDtfCostProfileV1';
  let latestQuote = null;
  let sheetQuoteOverride = null;

  const numberValue = (id, fallback = 0) => {
    const value = Number(byId(id).value);
    return Number.isFinite(value) ? value : fallback;
  };

  const calculateQuoteCosts = (quantity, sheets) => {
    const sheetCost = Math.max(0, numberValue('calc-sheet-cost'));
    const consumablesCost = Math.max(0, numberValue('calc-consumables-cost'));
    const setupCost = Math.max(0, numberValue('calc-setup-cost'));
    const unitCost = Math.max(0, numberValue('calc-unit-cost'));
    const waste = Math.max(0, numberValue('calc-waste')) / 100;
    const marginRate = Math.min(0.9, Math.max(0, numberValue('calc-profit')) / 100);
    const productionCost = (sheets * (sheetCost + consumablesCost)) * (1 + waste) + setupCost + quantity * unitCost;
    const quoteTotal = marginRate < 1 ? productionCost / (1 - marginRate) : productionCost;
    return { productionCost, quoteTotal, unitQuote: quoteTotal / Math.max(1, quantity) };
  };

  const cleanText = value => String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim();
  const escapeHtml = value => cleanText(value).replace(/[&"']/g, character => ({ '&': '&amp;', '"': '&quot;', "'": '&#39;' }[character]));
  const quoteMetadata = () => {
    const validDays = Math.max(1, Math.min(90, Math.round(numberValue('calc-valid-days', 7))));
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);
    return {
      customer: cleanText(byId('calc-customer').value) || 'Cliente',
      reference: cleanText(byId('calc-reference').value) || `MC-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`,
      validDays,
      validUntil: validUntil.toLocaleDateString('es-NI')
    };
  };

  const optimizeLayout = ({ sheetWidth, sheetHeight, margin, gap, designWidth, designHeight, rotate }) => {
    const usableWidth = sheetWidth - margin * 2;
    const usableHeight = sheetHeight - margin * 2;
    if (usableWidth <= 0 || usableHeight <= 0 || designWidth <= 0 || designHeight <= 0) return null;
    const orientations = [{ width: designWidth, height: designHeight, rotated: false }];
    if (rotate && Math.abs(designWidth - designHeight) > 0.001) orientations.push({ width: designHeight, height: designWidth, rotated: true });
    let best = null;
    const first = orientations[0];
    const second = orientations[1];
    const maxFirstRows = Math.floor((usableHeight + gap) / (first.height + gap));
    const maxSecondRows = second ? Math.floor((usableHeight + gap) / (second.height + gap)) : 0;
    for (let firstRows = 0; firstRows <= maxFirstRows; firstRows++) {
      for (let secondRows = 0; secondRows <= maxSecondRows; secondRows++) {
        const totalRows = firstRows + secondRows;
        if (!totalRows) continue;
        const usedHeight = firstRows * first.height + secondRows * (second?.height || 0) + Math.max(0, totalRows - 1) * gap;
        if (usedHeight > usableHeight + 0.0001) continue;
        const firstColumns = Math.floor((usableWidth + gap) / (first.width + gap));
        const secondColumns = second ? Math.floor((usableWidth + gap) / (second.width + gap)) : 0;
        const capacity = firstRows * firstColumns + secondRows * secondColumns;
        if (!capacity) continue;
        const score = capacity * 100000 - usedHeight;
        if (!best || score > best.score) best = { capacity, score, firstRows, secondRows, firstColumns, secondColumns, usedHeight, usableWidth, usableHeight, orientations };
      }
    }
    if (!best) return null;
    const placements = [];
    let y = margin;
    const addRows = (orientation, rows, columns) => {
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) placements.push({ x: margin + column * (orientation.width + gap), y, width: orientation.width, height: orientation.height, rotated: orientation.rotated });
        y += orientation.height + gap;
      }
    };
    addRows(first, best.firstRows, best.firstColumns);
    if (second) addRows(second, best.secondRows, best.secondColumns);
    best.placements = placements;
    return best;
  };

  const drawSheet = (settings, layout) => {
    const canvas = byId('calc-canvas');
    const maximum = 900;
    const scale = maximum / Math.max(settings.sheetWidth, settings.sheetHeight);
    canvas.width = Math.max(260, Math.round(settings.sheetWidth * scale));
    canvas.height = Math.max(260, Math.round(settings.sheetHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#f4f4f5';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const drawScale = Math.min(canvas.width / settings.sheetWidth, canvas.height / settings.sheetHeight);
    delete canvas.dataset.precisionScaleX;delete canvas.dataset.precisionScaleY;canvas.dataset.precisionScale=drawScale;canvas.dataset.precisionX=0;canvas.dataset.precisionY=0;
    context.save();
    context.scale(drawScale, drawScale);
    context.strokeStyle = '#a1a1aa';
    context.lineWidth = 1 / drawScale;
    context.strokeRect(settings.margin, settings.margin, settings.sheetWidth - settings.margin * 2, settings.sheetHeight - settings.margin * 2);
    if (layout) layout.placements.forEach((placement, index) => {
      context.fillStyle = index % 2 ? '#f59e0b' : '#facc15';
      context.strokeStyle = '#18181b';
      context.lineWidth = 1.2 / drawScale;
      context.fillRect(placement.x, placement.y, placement.width, placement.height);
      context.strokeRect(placement.x, placement.y, placement.width, placement.height);
      context.fillStyle = '#18181b';
      context.font = `900 ${Math.max(2.2, Math.min(5, placement.width / 5))}px sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(String(index + 1), placement.x + placement.width / 2, placement.y + placement.height / 2);
      if (placement.rotated) {
        context.font = `700 ${Math.max(1.5, Math.min(3, placement.width / 8))}px sans-serif`;
        context.fillText('ROTADO', placement.x + placement.width / 2, placement.y + placement.height / 2 + 4);
      }
    });
    context.restore();
  };

  const calculate = () => {
    for(const id of calcIds){const el=byId(id);if(el.type==='checkbox')continue;const n=Number(el.value);if(el.value.trim()===''||!Number.isFinite(n)||(el.min&&n<Number(el.min))||(el.max&&n>Number(el.max))||(el.step==='1'&&!Number.isInteger(n))){latestQuote=null;byId('calc-status').textContent='Revisá las medidas y los costos. La cantidad debe ser un número entero y todos los valores deben estar dentro del rango indicado.';byId('calc-capacity').textContent='0';byId('calc-sheets').textContent='—';for(const key of ['calc-base-cost','calc-quote-total','calc-quote-unit'])byId(key).textContent='—';byId('calc-print').disabled=true;byId('calc-whatsapp').disabled=true;return;}}
    byId('calc-print').disabled=false;byId('calc-whatsapp').disabled=false;
    const settings = {
      sheetWidth: Math.max(1, numberValue('calc-sheet-width', 57)),
      sheetHeight: Math.max(1, numberValue('calc-sheet-height', 100)),
      margin: Math.max(0, numberValue('calc-margin', 0.5)),
      gap: Math.max(0, numberValue('calc-gap', 1)),
      designWidth: Math.max(0.1, numberValue('calc-design-width', 32)),
      designHeight: Math.max(0.1, numberValue('calc-design-height', 32)),
      quantity: Math.max(1, Math.round(numberValue('calc-quantity', 1))),
      rotate: byId('calc-rotate').checked
    };
    if (sheetQuoteOverride) {
      const quantity = sheetQuoteOverride.pieces;
      const sheets = 1;
      const costs = calculateQuoteCosts(quantity, sheets);
      byId('calc-layout-label').textContent = `${sheetQuoteOverride.sheetWidth} × ${sheetQuoteOverride.sheetHeight} cm · multidiseño`;
      byId('calc-capacity').textContent = quantity;
      byId('calc-sheets').textContent = sheets;
      byId('calc-efficiency').textContent = `${sheetQuoteOverride.efficiency.toFixed(1)}%`;
      byId('calc-base-cost').textContent = currency.format(costs.productionCost);
      byId('calc-quote-total').textContent = currency.format(costs.quoteTotal);
      byId('calc-quote-unit').textContent = `${currency.format(costs.unitQuote)} promedio por pieza`;
      byId('calc-arrangement').textContent = `${quantity} piezas distintas en una plancha`;
      byId('calc-status').textContent = 'Cotización vinculada a la plancha multidiseño preparada en Producción DTF.';
      latestQuote = {
        sheetWidth: sheetQuoteOverride.sheetWidth, sheetHeight: sheetQuoteOverride.sheetHeight,
        designWidth: null, designHeight: null, designLabel: 'Plancha multidiseño', quantity,
        capacity: quantity, sheets, efficiency: sheetQuoteOverride.efficiency,
        productionCost: costs.productionCost, quoteTotal: costs.quoteTotal, unitQuote: costs.unitQuote,
        arrangement: `${quantity} piezas distintas`
      };
      return;
    }
    const layout = optimizeLayout(settings);
    const fixed=optimizeLayout({...settings,rotate:false});
    const baselineSheets=fixed?Math.ceil(settings.quantity/fixed.capacity):null;
    byId('calc-layout-comparison').textContent=layout?`Sin giro: ${fixed?.capacity||0} por pliego · Con giro permitido: ${layout.capacity} · ${baselineSheets?Math.max(0,baselineSheets-Math.ceil(settings.quantity/layout.capacity)):0} pliegos ahorrados.`:'No hay distribución válida.';
    drawSheet(settings, layout);
    byId('calc-layout-label').textContent = `${settings.sheetWidth} × ${settings.sheetHeight} cm`;
    if (!layout) {
      byId('calc-capacity').textContent = '0';
      byId('calc-sheets').textContent = '—';
      byId('calc-efficiency').textContent = '0%';
      byId('calc-status').textContent = 'El diseño no cabe dentro del área imprimible con esos márgenes.';
      byId('calc-arrangement').textContent = 'Sin distribución válida';
      for(const id of ['calc-base-cost','calc-quote-total','calc-quote-unit'])byId(id).textContent='—';
      latestQuote = null;byId('calc-print').disabled=true;byId('calc-whatsapp').disabled=true;
      return;
    }
    const sheets = Math.ceil(settings.quantity / layout.capacity);
    const usedArea = layout.capacity * settings.designWidth * settings.designHeight;
    const printableArea = layout.usableWidth * layout.usableHeight;
    const efficiency = printableArea > 0 ? usedArea / printableArea * 100 : 0;
    const { productionCost, quoteTotal, unitQuote } = calculateQuoteCosts(settings.quantity, sheets);
    byId('calc-capacity').textContent = layout.capacity;
    byId('calc-sheets').textContent = sheets;
    byId('calc-efficiency').textContent = `${efficiency.toFixed(1)}%`;
    byId('calc-base-cost').textContent = currency.format(productionCost);
    byId('calc-quote-total').textContent = currency.format(quoteTotal);
    byId('calc-quote-unit').textContent = `${currency.format(unitQuote)} por diseño`;
    const rowParts = [];
    if (layout.firstRows) rowParts.push(`${layout.firstRows} fila${layout.firstRows === 1 ? '' : 's'} normal${layout.firstRows === 1 ? '' : 'es'}`);
    if (layout.secondRows) rowParts.push(`${layout.secondRows} fila${layout.secondRows === 1 ? '' : 's'} rotada${layout.secondRows === 1 ? '' : 's'}`);
    byId('calc-arrangement').textContent = `${layout.capacity} por pliego · ${rowParts.join(' + ')}`;
    byId('calc-status').textContent = `${settings.quantity} diseños requieren ${sheets} pliego${sheets === 1 ? '' : 's'}; el último lleva ${settings.quantity - (sheets - 1) * layout.capacity}.`;
    latestQuote = { ...settings, capacity: layout.capacity, sheets, efficiency, productionCost, quoteTotal, unitQuote, arrangement: rowParts.join(' + ') };
    window.dispatchEvent(new CustomEvent('momotus:sheet-quote-ready',{detail:latestQuote}));
    setStudioState('Calculadora de cotizaciones', 'Cálculo listo');
  };

  const drawSheetQuotePreview = dataUrl => {
    if (!dataUrl) return;
    const image = new Image();
    image.onload = () => {
      const canvas = byId('calc-canvas');
      const scale = Math.min(900 / image.naturalWidth, 600 / image.naturalHeight, 1);
      canvas.width = Math.max(260, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(260, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.dataset.precisionScaleX=canvas.width/Number(byId('calc-sheet-width').value);canvas.dataset.precisionScaleY=canvas.height/Number(byId('calc-sheet-height').value);canvas.dataset.precisionX=0;canvas.dataset.precisionY=0;
    };
    image.src = dataUrl;
  };

  window.addEventListener('momotus:quote-measurements',event=>{
    if(event.detail?.mode!=='sheet')return;
    try{const d=window.MomotusPrecisionCore.validateMeasure(event.detail);if(d.widthCm<1||d.widthCm>150||d.heightCm<1)throw Error('El modo por pliego admite ancho de 1 a 150 cm y alto desde 1 cm. Usá el pedido por metro para otras medidas.');
      sheetQuoteOverride=null;byId('calc-design-width').value=d.widthCm;byId('calc-design-height').value=d.heightCm;byId('calc-quantity').value=d.quantity;calculate();
      window.dispatchEvent(new CustomEvent('momotus:quote-sheet'));byId('calc-status').textContent=`Medidas recibidas: ${d.widthCm.toFixed(3)} × ${d.heightCm.toFixed(3)} cm. Solo medidas y cantidad; sin imágenes.`;
    }catch(e){byId('calc-status').textContent=e.message;}
  });
  window.addEventListener('momotus:quote-sheet', event => {
    const detail = event.detail;
    if (!detail || !Number.isFinite(detail.pieces) || detail.pieces < 1) return;
    sheetQuoteOverride = {
      sheetWidth: Math.max(1, Number(detail.sheetWidth) || 57),
      sheetHeight: Math.max(1, Number(detail.sheetHeight) || 100),
      pieces: Math.max(1, Math.round(detail.pieces)),
      efficiency: Math.max(0, Math.min(100, Number(detail.efficiency) || 0)),
      preview: detail.preview || ''
    };
    byId('calc-sheet-width').value = sheetQuoteOverride.sheetWidth;
    byId('calc-sheet-height').value = sheetQuoteOverride.sheetHeight;
    byId('calc-quantity').value = sheetQuoteOverride.pieces;
    openExtraTool('calculadora-dtf');
    calculate();
    drawSheetQuotePreview(sheetQuoteOverride.preview);
  });

  calcIds.forEach(id => byId(id).addEventListener(id === 'calc-rotate' ? 'change' : 'input', () => {
    if (!costProfileIds.includes(id)) sheetQuoteOverride = null;
    calculate();
  }));
  byId('calc-example').addEventListener('click', () => {
    sheetQuoteOverride = null;
    byId('calc-sheet-width').value = 57;
    byId('calc-sheet-height').value = 100;
    byId('calc-margin').value = 0.5;
    byId('calc-gap').value = 1;
    byId('calc-design-width').value = 32;
    byId('calc-design-height').value = 32;
    byId('calc-rotate').checked = true;
    calculate();
  });
  byId('calc-reset').addEventListener('click', () => {
    sheetQuoteOverride = null;
    const defaults = { 'calc-sheet-width': 57, 'calc-sheet-height': 100, 'calc-margin': 0.5, 'calc-gap': 1, 'calc-design-width': 32, 'calc-design-height': 32, 'calc-quantity': 10, 'calc-sheet-cost': 0, 'calc-consumables-cost': 0, 'calc-setup-cost': 0, 'calc-unit-cost': 0, 'calc-waste': 5, 'calc-profit': 30 };
    Object.entries(defaults).forEach(([id, value]) => { byId(id).value = value; });
    byId('calc-rotate').checked = true;
    calculate();
  });
  let costProfiles={};try{const data=JSON.parse(localStorage.getItem('momotus-cost-profiles-v2')||'{}');if(data&&typeof data==='object'&&!Array.isArray(data))costProfiles=data;}catch{}
  function costProfileList(){byId('calc-profile-list').replaceChildren(new Option('Elegí un perfil',''),...Object.keys(costProfiles).map(name=>new Option(name,name)));}
  byId('calc-save-profile').addEventListener('click',()=>{
    try{const name=byId('calc-profile-name').value.trim()||'Predeterminado',profile=Object.fromEntries(costProfileIds.map(id=>[id,byId(id).value]));if(Object.keys(costProfiles).length>=30&&!Object.hasOwn(costProfiles,name))throw Error('Máximo 30 perfiles.');const next={...costProfiles,[name]:profile};localStorage.setItem('momotus-cost-profiles-v2',JSON.stringify(next));localStorage.setItem(COST_PROFILE_KEY,JSON.stringify(profile));costProfiles=next;costProfileList();byId('calc-profile-list').value=name;byId('calc-status').textContent=`Perfil «${name}» guardado.`;}catch(e){byId('calc-status').textContent=e.message||'No se pudo guardar el perfil.';}
  });
  byId('calc-load-profile').addEventListener('click',()=>{
    try{const name=byId('calc-profile-list').value,profile=name?costProfiles[name]:JSON.parse(localStorage.getItem(COST_PROFILE_KEY)||'null');if(!profile||typeof profile!=='object')throw Error('Elegí un perfil guardado.');for(const id of costProfileIds){const n=Number(profile[id]),el=byId(id);if(!Number.isFinite(n)||n<0||(el.max&&n>Number(el.max)))throw Error('El perfil tiene costos no válidos.');}costProfileIds.forEach(id=>byId(id).value=profile[id]);byId('calc-profile-name').value=name;calculate();byId('calc-status').textContent='Costos recuperados y cotización actualizada.';}catch(e){byId('calc-status').textContent=e.message;}
  });costProfileList();
  const quoteArchive=document.createElement('details');quoteArchive.className='pro-detail';quoteArchive.innerHTML='<summary>Historial de cotizaciones</summary><div class="pro-actions"><button id="calc-save-quote" type="button">Guardar cotización</button><select id="calc-quote-history" aria-label="Cotizaciones guardadas"><option value="">Elegí una cotización</option></select><button id="calc-load-quote" type="button">Recuperar</button></div>';
  byId('calc-save-profile').closest('.extra-control-scroll').append(quoteArchive);
  let sheetHistory=[];try{const saved=JSON.parse(localStorage.getItem('momotus-sheet-quotes-v1')||'[]');if(Array.isArray(saved))sheetHistory=saved.slice(0,30);}catch{}
  function sheetHistoryList(){byId('calc-quote-history').replaceChildren(new Option('Elegí una cotización',''),...sheetHistory.map((q,i)=>new Option(`${q.customer||'Cliente'} · ${q.reference||'DTF'} · ${new Date(q.time).toLocaleDateString('es-NI')}`,String(i))));}
  byId('calc-save-quote').addEventListener('click',()=>{calculate();if(!latestQuote)return;if(sheetQuoteOverride){byId('calc-status').textContent='Guardá la plancha vinculada desde Producción DTF.';return;}try{const ids=[...calcIds,'calc-customer','calc-reference','calc-valid-days'];const next=[{time:Date.now(),customer:byId('calc-customer').value,reference:byId('calc-reference').value,settings:Object.fromEntries(ids.map(id=>[id,byId(id).type==='checkbox'?byId(id).checked:byId(id).value]))},...sheetHistory].slice(0,30);localStorage.setItem('momotus-sheet-quotes-v1',JSON.stringify(next));sheetHistory=next;sheetHistoryList();byId('calc-status').textContent='Cotización guardada en este navegador.';}catch{byId('calc-status').textContent='No se pudo guardar la cotización.';}});
  byId('calc-load-quote').addEventListener('click',()=>{const value=byId('calc-quote-history').value;if(value==='')return;try{const q=sheetHistory[Number(value)];if(!q?.settings)throw Error('Cotización no válida.');for(const id of calcIds){const el=byId(id),v=q.settings[id];if(el.type==='checkbox'){if(typeof v!=='boolean')throw Error('Rotación no válida.');}else{const n=Number(v);if(!Number.isFinite(n)||(el.min&&n<Number(el.min))||(el.max&&n>Number(el.max))||(el.step==='1'&&!Number.isInteger(n)))throw Error('Medidas o costos no válidos.');}}sheetQuoteOverride=null;for(const [id,v]of Object.entries(q.settings)){const el=byId(id);if(!el||!el.closest('#calc-sheet-mode'))continue;if(el.type==='checkbox')el.checked=v;else el.value=v;}calculate();byId('calc-status').textContent='Cotización recuperada. Revisá los costos vigentes.';}catch(e){byId('calc-status').textContent=e.message;}});sheetHistoryList();
  byId('calc-whatsapp').addEventListener('click', () => {
    if (!latestQuote) return;
    const metadata = quoteMetadata();
    const message = [
      `*Cotización DTF ${metadata.reference}*`,
      `Cliente: ${metadata.customer}`,
      `Diseño: ${latestQuote.designLabel || `${latestQuote.designWidth} × ${latestQuote.designHeight} cm`}`,
      `Cantidad: ${latestQuote.quantity}`,
      `Pliegos: ${latestQuote.sheets} de ${latestQuote.sheetWidth} × ${latestQuote.sheetHeight} cm`,
      `Precio unitario: ${currency.format(latestQuote.unitQuote)}`,
      `*Total: ${currency.format(latestQuote.quoteTotal)}*`,
      `Válida hasta: ${metadata.validUntil}`,
      'Momotus Core · momotuscore@gmail.com'
    ].join('\n');
    window.open(`https://wa.me/50555010044?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  });
  byId('calc-print').addEventListener('click', () => {
    if (!latestQuote) return;
    const metadata = quoteMetadata();
    const report = window.open('', '_blank', 'width=820,height=900');
    if (!report) return;
    report.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cotización DTF</title><style>body{font-family:Arial,sans-serif;margin:36px;color:#18181b}h1{margin:0 0 4px}small{color:#71717a}.brand{border-bottom:4px solid #facc15;padding-bottom:16px;margin-bottom:24px}.meta{display:flex;justify-content:space-between;gap:16px;margin-bottom:18px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{border:1px solid #d4d4d8;border-radius:10px;padding:14px}.card b{display:block;font-size:22px;margin-top:6px}.total{background:#facc15;border:0}table{width:100%;border-collapse:collapse;margin:22px 0}td{padding:9px;border-bottom:1px solid #e4e4e7}td:last-child{text-align:right;font-weight:bold}@media print{button{display:none}}</style></head><body><div class="brand"><h1>Momotus Core</h1><small>Cotización de producción DTF · momotuscore@gmail.com · 5501-0044</small></div><div class="meta"><div><b>${escapeHtml(metadata.customer)}</b><br><small>Cliente</small></div><div><b>${escapeHtml(metadata.reference)}</b><br><small>Válida hasta ${escapeHtml(metadata.validUntil)}</small></div></div><div class="grid"><div class="card">Pliego<b>${latestQuote.sheetWidth} × ${latestQuote.sheetHeight} cm</b></div><div class="card">Diseño<b>${escapeHtml(latestQuote.designLabel || `${latestQuote.designWidth} × ${latestQuote.designHeight} cm`)}</b></div><div class="card">Capacidad<b>${latestQuote.capacity} por pliego</b></div><div class="card">Pedido<b>${latestQuote.quantity} diseños · ${latestQuote.sheets} pliegos</b></div></div><table><tr><td>Distribución</td><td>${latestQuote.arrangement}</td></tr><tr><td>Aprovechamiento</td><td>${latestQuote.efficiency.toFixed(1)}%</td></tr>${byId('calc-report-scope').value==='internal'?`<tr><td>Costo calculado</td><td>${currency.format(latestQuote.productionCost)}</td></tr>`:''}<tr><td>Precio por diseño</td><td>${currency.format(latestQuote.unitQuote)}</td></tr></table><div class="card total">Cotización sugerida<b>${currency.format(latestQuote.quoteTotal)}</b></div><p><small>Estimación basada en las medidas, separación, costos, merma y margen ingresados. Confirmar consumos reales antes de producir.</small></p><button onclick="print()">Imprimir</button></body></html>`);
    report.document.close();
  });
  calculate();

  document.addEventListener('paste', event => {
    if (document.querySelector('.tool-panel:not([hidden])')?.id !== 'vectorizacion') return;
    const file = [...(event.clipboardData?.items || [])].find(item => item.type.startsWith('image/'))?.getAsFile();
    if (file) acceptVectorFile(file);
  });

  const initialExtra = document.querySelector('.extra-tool-panel:not([hidden])')?.id;
  if (initialExtra) openExtraTool(initialExtra);
})();
