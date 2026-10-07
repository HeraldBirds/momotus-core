(() => {
  'use strict';

  if (!window.MOMOTUS_TOOLS_DESKTOP) return;

  const DPI = 300;
  const MAX_PIXELS = 36000000;
  const HISTORY_LIMIT = 14;
  const DB_NAME = 'momotus-dtf-studio';
  const DB_VERSION = 1;
  const STORE_NAME = 'projects';
  const byId = id => document.getElementById(id);
  const api = () => window.MomotusToolsAPI;
  const state = {
    canvas: null,
    recovery: null,
    filename: 'momotus-produccion',
    history: [],
    historyIndex: -1,
    zoom: 'fit',
    brushMode: 'erase',
    drawing: false,
    changedDuringStroke: false,
    lastBrushPoint: null,
    maskView: 'result',
    palette: [],
    sheetItems: [],
    batchFiles: [],
    projectId: null,
    profileName: 'Sin perfil asignado',
    autosaveTimer: 0,
    displayFrame: 0
  };

  const cloneCanvas = source => {
    if (!source?.width || !source.height) return null;
    const output = document.createElement('canvas');
    output.width = source.width;
    output.height = source.height;
    output.getContext('2d').drawImage(source, 0, 0);
    return output;
  };

  const createButton = (html, className = '') => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.innerHTML = html;
    return button;
  };

  const toast = message => api()?.showToast?.(message);
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const canvasToBlob = canvas => new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const blobToCanvas = blob => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    image.src = url;
  });

  const fileToCanvas = async file => {
    if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return Promise.reject(new Error('Usá una imagen PNG, JPG o WebP.'));
    if (file.size > 24 * 1024 * 1024) return Promise.reject(new Error('La imagen debe pesar 24 MB o menos.'));
    const source = await blobToCanvas(file);
    const scale = Math.min(1, 8000 / Math.max(source.width, source.height), Math.sqrt(MAX_PIXELS / (source.width * source.height)));
    if (scale >= 0.999) return source;
    const output = document.createElement('canvas');
    output.width = Math.max(1, Math.round(source.width * scale));
    output.height = Math.max(1, Math.round(source.height * scale));
    const context = output.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, output.width, output.height);
    toast(`La imagen se ajustó a ${output.width} × ${output.height} px para proteger la memoria.`);
    return output;
  };

  const setBusy = (busy, message = 'Procesando…', progress = null) => {
    const overlay = byId('production-busy');
    if (!overlay) return;
    overlay.hidden = !busy;
    overlay.querySelector('strong').textContent = message;
    const value = overlay.querySelector('span');
    value.textContent = progress === null ? '' : `${Math.round(progress)}%`;
    const bar = overlay.querySelector('i');
    bar.style.width = progress === null ? '35%' : `${Math.max(0, Math.min(100, progress))}%`;
  };

  const getDisplayCanvas = () => byId('production-canvas');

  const renderWorkingDisplay = () => {
    const display = getDisplayCanvas();
    if (!display || !state.canvas) return;
    const displayContext = display.getContext('2d');
    displayContext.clearRect(0, 0, display.width, display.height);
    if (state.maskView === 'mask') {
      const source = state.canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, state.canvas.width, state.canvas.height);
      const mask = new ImageData(state.canvas.width, state.canvas.height);
      for (let index = 0; index < source.data.length; index += 4) {
        const alpha = source.data[index + 3];
        mask.data[index] = alpha;
        mask.data[index + 1] = alpha;
        mask.data[index + 2] = alpha;
        mask.data[index + 3] = 255;
      }
      displayContext.putImageData(mask, 0, 0);
    } else displayContext.drawImage(state.canvas, 0, 0);
  };

  const queueWorkingDisplay = () => {
    cancelAnimationFrame(state.displayFrame);
    state.displayFrame = requestAnimationFrame(renderWorkingDisplay);
  };

  const drawWorkingCanvas = (runAnalysis = true) => {
    const display = getDisplayCanvas();
    const empty = byId('production-empty');
    if (!display || !empty) return;
    if (!state.canvas) {
      display.width = display.height = 1;
      display.hidden = true;
      empty.hidden = false;
      updateDocumentInfo();
      return;
    }
    display.width = state.canvas.width;
    display.height = state.canvas.height;
    queueWorkingDisplay();
    display.hidden = false;
    empty.hidden = true;
    applyZoom();
    updateDocumentInfo();
    if (runAnalysis) analyzeCurrent();
  };

  const updateDocumentInfo = () => {
    const dimensions = byId('production-document-size');
    const title = byId('production-document-name');
    if (!state.canvas) {
      title.textContent = 'Sin documento';
      dimensions.textContent = 'Importá un resultado o una imagen';
      return;
    }
    title.textContent = state.filename;
    dimensions.textContent = `${state.canvas.width} × ${state.canvas.height} px · ${(state.canvas.width / DPI * 2.54).toFixed(1)} × ${(state.canvas.height / DPI * 2.54).toFixed(1)} cm a 300 DPI`;
  };

  const applyZoom = () => {
    const canvas = getDisplayCanvas();
    const viewport = byId('production-viewport');
    if (!canvas || !viewport || !state.canvas) return;
    const padding = 48;
    const fit = Math.min((viewport.clientWidth - padding) / state.canvas.width, (viewport.clientHeight - padding) / state.canvas.height, 1);
    const value = state.zoom === 'fit' ? fit : Number(state.zoom) / 100;
    canvas.style.width = `${Math.max(1, state.canvas.width * value)}px`;
    canvas.style.height = `${Math.max(1, state.canvas.height * value)}px`;
    byId('production-zoom-label').textContent = state.zoom === 'fit' ? `${Math.round(fit * 100)}%` : `${state.zoom}%`;
  };

  const scheduleAutosave = () => {
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = setTimeout(() => saveProject(true).catch(() => {}), 1200);
  };

  const pushHistory = label => {
    if (!state.canvas) return;
    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push({ label, canvas: cloneCanvas(state.canvas), recovery: cloneCanvas(state.recovery || state.canvas) });
    const safeHistoryLimit = Math.max(2, Math.min(HISTORY_LIMIT, Math.floor(16000000 / Math.max(1, state.canvas.width * state.canvas.height))));
    if (state.history.length > safeHistoryLimit) state.history.splice(0, state.history.length - safeHistoryLimit);
    state.historyIndex = state.history.length - 1;
    renderHistory();
    scheduleAutosave();
  };

  const restoreHistory = index => {
    const entry = state.history[index];
    if (!entry) return;
    state.historyIndex = index;
    state.canvas = cloneCanvas(entry.canvas);
    state.recovery = cloneCanvas(entry.recovery);
    drawWorkingCanvas();
    renderHistory();
  };

  const renderHistory = () => {
    byId('production-undo').disabled = state.historyIndex <= 0;
    byId('production-redo').disabled = state.historyIndex < 0 || state.historyIndex >= state.history.length - 1;
    const list = byId('production-history');
    list.replaceChildren(...state.history.map((entry, index) => {
      const button = createButton(`<span>${index + 1}</span><strong>${entry.label}</strong>`, index === state.historyIndex ? 'active' : '');
      button.disabled = index === state.historyIndex;
      button.addEventListener('click', () => restoreHistory(index));
      return button;
    }));
  };

  const setDocument = (canvas, filename, reset = true) => {
    if (!canvas?.width || !canvas.height) return;
    state.canvas = cloneCanvas(canvas);
    state.recovery = cloneCanvas(canvas);
    state.filename = String(filename || 'momotus-produccion').replace(/\.[^.]+$/, '');
    state.palette = [];
    state.projectId = reset ? null : state.projectId;
    if (reset) {
      state.history = [];
      state.historyIndex = -1;
    }
    drawWorkingCanvas();
    pushHistory(reset ? 'Documento importado' : 'Documento recuperado');
    renderPalette();
  };

  window.addEventListener('momotus:production-import-canvas',event=>{if(!event.detail?.canvas)return;setDocument(event.detail.canvas,event.detail.filename||'efectos');openProduction();});

  const importActiveResult = async () => {
    if (!api()?.hasDocument?.()) return toast('Primero cargá o procesá una imagen en alguna herramienta.');
    setBusy(true, 'Importando resultado completo…');
    try {
      const info = api().getDocumentInfo();
      const canvas = await api().getResultCanvas();
      if (!canvas) throw new Error('No se pudo preparar el resultado activo.');
      if(!await window.MomotusReviewTransfer(canvas,'production',info?.filename,api().getActiveType())) return;
      window.MomotusRememberTransfer(api().getActiveType(),'production');
      setDocument(canvas, `${info?.filename || 'momotus'}-produccion`);
      openProduction();
      toast('Resultado importado sin modificar el original.');
    } catch (error) {
      toast(error.message || 'No se pudo importar el resultado.');
    } finally {
      setBusy(false);
    }
  };

  const switchPanel = panel => {
    const viewport = byId('production-viewport');
    const inspector = document.querySelector('.production-inspector');
    const scrollLeft = viewport?.scrollLeft || 0;
    const scrollTop = viewport?.scrollTop || 0;
    document.querySelectorAll('[data-production-panel]').forEach(section => { section.hidden = section.dataset.productionPanel !== panel; });
    document.querySelectorAll('[data-production-tab]').forEach(button => {
      const active = button.dataset.productionTab === panel;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', String(active));
    });
    if (inspector) inspector.scrollTop = 0;
    requestAnimationFrame(() => {
      if (!viewport) return;
      viewport.scrollLeft = scrollLeft;
      viewport.scrollTop = scrollTop;
    });
  };

  const brushPoint = event => {
    const canvas = getDisplayCanvas();
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width * state.canvas.width,
      y: (event.clientY - rect.top) / rect.height * state.canvas.height,
      scale: state.canvas.width / rect.width
    };
  };

  const stampBrush = ({ x, y, scale, pressure = 1 }) => {
    const size = Number(byId('production-brush-size').value) * scale * Math.max(0.35, pressure || 1);
    const hardness = Number(byId('production-brush-hardness').value) / 100;
    const context = state.canvas.getContext('2d');
    context.save();
    if (state.brushMode === 'erase') {
      context.globalCompositeOperation = 'destination-out';
      const inner = Math.min(size / 2 - 0.01, size * hardness * 0.48);
      const gradient = context.createRadialGradient(x, y, Math.max(0, inner), x, y, size / 2);
      gradient.addColorStop(0, 'rgba(0,0,0,1)');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(x, y, size / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.beginPath();
      context.arc(x, y, size / 2, 0, Math.PI * 2);
      context.clip();
      context.globalAlpha = Math.max(0.12, hardness);
      context.drawImage(state.recovery, 0, 0);
    }
    context.restore();
    return size;
  };

  const paintBrush = event => {
    if (!state.drawing || !state.canvas) return;
    const point = { ...brushPoint(event), pressure: event.pointerType === 'pen' ? event.pressure : 1 };
    const previous = state.lastBrushPoint;
    const estimatedSize = Number(byId('production-brush-size').value) * point.scale;
    const distance = previous ? Math.hypot(point.x - previous.x, point.y - previous.y) : 0;
    const steps = previous ? Math.max(1, Math.ceil(distance / Math.max(1, estimatedSize * 0.18))) : 1;
    for (let step = 1; step <= steps; step++) {
      const ratio = step / steps;
      stampBrush(previous ? {
        x: previous.x + (point.x - previous.x) * ratio,
        y: previous.y + (point.y - previous.y) * ratio,
        scale: point.scale,
        pressure: previous.pressure + (point.pressure - previous.pressure) * ratio
      } : point);
    }
    state.lastBrushPoint = point;
    state.changedDuringStroke = true;
    queueWorkingDisplay();
  };

  const trimCanvas = source => {
    const context = source.getContext('2d', { willReadFrequently: true });
    const data = context.getImageData(0, 0, source.width, source.height).data;
    let left = source.width, top = source.height, right = -1, bottom = -1;
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        if (data[(y * source.width + x) * 4 + 3] < 2) continue;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
    if (right < left || bottom < top) return cloneCanvas(source);
    const output = document.createElement('canvas');
    output.width = right - left + 1;
    output.height = bottom - top + 1;
    output.getContext('2d').drawImage(source, left, top, output.width, output.height, 0, 0, output.width, output.height);
    return output;
  };

  const transformCanvas = (source, action) => {
    if (action === 'trim') return trimCanvas(source);
    const rotated = action === 'left' || action === 'right';
    const output = document.createElement('canvas');
    output.width = rotated ? source.height : source.width;
    output.height = rotated ? source.width : source.height;
    const context = output.getContext('2d');
    context.translate(output.width / 2, output.height / 2);
    if (action === 'left') context.rotate(-Math.PI / 2);
    if (action === 'right') context.rotate(Math.PI / 2);
    if (action === 'flip-x') context.scale(-1, 1);
    if (action === 'flip-y') context.scale(1, -1);
    context.drawImage(source, -source.width / 2, -source.height / 2);
    return output;
  };

  const applyTransform = action => {
    if (!state.canvas) return toast('Importá una imagen primero.');
    state.canvas = transformCanvas(state.canvas, action);
    state.recovery = transformCanvas(state.recovery, action);
    drawWorkingCanvas();
    const labels = { trim: 'Márgenes recortados', left: 'Giro a la izquierda', right: 'Giro a la derecha', 'flip-x': 'Reflejo horizontal', 'flip-y': 'Reflejo vertical' };
    pushHistory(labels[action] || 'Transformación');
  };

  const resizePhysical = async () => {
    if (!state.canvas) return toast('Importá una imagen primero.');
    const widthCm = Math.max(1, Math.min(60, Number(byId('production-width-cm').value) || 30));
    const width = Math.round(widthCm / 2.54 * DPI);
    const height = Math.round(width * state.canvas.height / state.canvas.width);
    if (width * height > MAX_PIXELS || Math.max(width, height) > 8000) return toast('Esa medida supera el límite seguro del navegador. Reducí el ancho.');
    setBusy(true, 'Ajustando medida física…');
    await nextFrame();
    const resize = source => {
      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;
      const context = output.getContext('2d');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(source, 0, 0, width, height);
      return output;
    };
    state.canvas = resize(state.canvas);
    state.recovery = resize(state.recovery);
    drawWorkingCanvas();
    pushHistory(`Medida ${widthCm.toFixed(1)} cm`);
    setBusy(false);
  };

  const colorDistance = (a, b) => {
    const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
    return dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
  };

  const quantizeColors = async () => {
    if (!state.canvas) return toast('Importá una imagen primero.');
    const count = Math.max(2, Math.min(8, Number(byId('production-color-count').value) || 4));
    const preserveAlpha = byId('production-preserve-alpha').checked;
    setBusy(true, 'Analizando colores…', 5);
    await nextFrame();
    const context = state.canvas.getContext('2d', { willReadFrequently: true });
    const imageData = context.getImageData(0, 0, state.canvas.width, state.canvas.height);
    const data = imageData.data;
    const samples = [];
    const stride = Math.max(4, Math.floor(data.length / 4 / 10000) * 4);
    for (let index = 0; index < data.length; index += stride) if (data[index + 3] > 20) samples.push([data[index], data[index + 1], data[index + 2]]);
    if (!samples.length) { setBusy(false); return toast('No hay color visible para separar.'); }
    let centers = Array.from({ length: count }, (_, index) => samples[Math.floor(index * (samples.length - 1) / Math.max(1, count - 1))].slice());
    for (let iteration = 0; iteration < 10; iteration++) {
      const sums = Array.from({ length: count }, () => [0, 0, 0, 0]);
      samples.forEach(sample => {
        let best = 0, distance = Infinity;
        centers.forEach((center, index) => { const value = colorDistance(sample, center); if (value < distance) { distance = value; best = index; } });
        sums[best][0] += sample[0]; sums[best][1] += sample[1]; sums[best][2] += sample[2]; sums[best][3]++;
      });
      centers = centers.map((center, index) => sums[index][3] ? sums[index].slice(0, 3).map(value => Math.round(value / sums[index][3])) : center);
    }
    setBusy(true, 'Creando separación…', 42);
    for (let y = 0; y < state.canvas.height; y++) {
      for (let x = 0; x < state.canvas.width; x++) {
        const index = (y * state.canvas.width + x) * 4;
        if (data[index + 3] === 0) continue;
        const sample = [data[index], data[index + 1], data[index + 2]];
        let best = 0, distance = Infinity;
        centers.forEach((center, paletteIndex) => { const value = colorDistance(sample, center); if (value < distance) { distance = value; best = paletteIndex; } });
        data[index] = centers[best][0]; data[index + 1] = centers[best][1]; data[index + 2] = centers[best][2];
        if (!preserveAlpha) data[index + 3] = data[index + 3] > 127 ? 255 : 0;
      }
      if (y % 160 === 0) { setBusy(true, 'Creando separación…', 42 + y / state.canvas.height * 55); await nextFrame(); }
    }
    context.putImageData(imageData, 0, 0);
    state.palette = centers;
    drawWorkingCanvas();
    renderPalette();
    pushHistory(`Separación de ${count} colores`);
    setBusy(false);
  };

  const renderPalette = () => {
    const container = byId('production-palette');
    if (!container) return;
    if (!state.palette.length) {
      container.innerHTML = '<p>La paleta aparecerá después de separar los colores.</p>';
      return;
    }
    container.replaceChildren(...state.palette.map((color, index) => {
      const row = document.createElement('div');
      const hex = `#${color.map(value => value.toString(16).padStart(2, '0')).join('')}`;
      row.innerHTML = `<span style="--swatch:${hex}"></span><strong>Canal ${index + 1}</strong><code>${hex.toUpperCase()}</code>`;
      const download = createButton('<i class="fa-solid fa-download"></i>', 'production-icon-button');
      download.title = `Descargar canal ${index + 1}`;
      download.addEventListener('click', () => downloadColorChannel(index));
      const halftone = createButton('<i class="fa-solid fa-circle-half-stroke"></i>', 'production-icon-button');
      halftone.title = `Crear semitono del canal ${index + 1}`;
      halftone.addEventListener('click', async () => {
        const sent = await api().sendCanvasToTool(buildColorChannel(index), 'halftone', `${state.filename}-canal-${index + 1}.png`);
        if (sent) { closeProduction(); toast(`Canal ${index + 1} enviado a Semitonos.`); }
      });
      row.append(halftone, download);
      return row;
    }));
  };

  const buildColorChannel = paletteIndex => {
    const color = state.palette[paletteIndex];
    const output = cloneCanvas(state.canvas);
    const context = output.getContext('2d', { willReadFrequently: true });
    const imageData = context.getImageData(0, 0, output.width, output.height);
    const data = imageData.data;
    for (let index = 0; index < data.length; index += 4) {
      const match = data[index] === color[0] && data[index + 1] === color[1] && data[index + 2] === color[2] && data[index + 3] > 0;
      if (!match) data[index + 3] = 0;
      else data[index + 3] = 255;
    }
    context.putImageData(imageData, 0, 0);
    return output;
  };

  const downloadColorChannel = async index => {
    if (!state.palette[index]) return;
    await api().downloadCanvas(buildColorChannel(index), `${state.filename}-canal-${index + 1}-300dpi.png`);
  };

  const analyzeCurrent = () => {
    const target = byId('production-diagnostics');
    if (!target || !state.canvas) {
      if (target) target.innerHTML = '<p>Importá una imagen para ejecutar el diagnóstico.</p>';
      return;
    }
    const sample = document.createElement('canvas');
    const scale = Math.min(1, 500 / Math.max(state.canvas.width, state.canvas.height));
    sample.width = Math.max(1, Math.round(state.canvas.width * scale));
    sample.height = Math.max(1, Math.round(state.canvas.height * scale));
    const context = sample.getContext('2d', { willReadFrequently: true });
    context.drawImage(state.canvas, 0, 0, sample.width, sample.height);
    const data = context.getImageData(0, 0, sample.width, sample.height).data;
    let transparent = 0, partial = 0, opaque = 0, lightEdges = 0, edge = 0, isolated = 0, clipped = 0;
    for (let y = 0; y < sample.height; y++) for (let x = 0; x < sample.width; x++) {
      const i = (y * sample.width + x) * 4;
      const alpha = data[i + 3];
      if (!alpha) transparent++; else if (alpha < 255) partial++; else opaque++;
      if (!alpha) continue;
      if (x === 0 || y === 0 || x === sample.width - 1 || y === sample.height - 1) clipped++;
      let neighbours = 0, touchesClear = false;
      [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dx, dy]) => {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= sample.width || ny >= sample.height) return;
        const neighbourAlpha = data[(ny * sample.width + nx) * 4 + 3];
        if (neighbourAlpha) neighbours++; else touchesClear = true;
      });
      if (neighbours <= 1) isolated++;
      if (touchesClear) {
        edge++;
        const max = Math.max(data[i], data[i + 1], data[i + 2]);
        const min = Math.min(data[i], data[i + 1], data[i + 2]);
        const light = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        if (max - min < 30 && light > 220) lightEdges++;
      }
    }
    const total = transparent + partial + opaque;
    const partialRate = partial / Math.max(1, total);
    const haloRate = edge ? lightEdges / edge : 0;
    const printableWidthCm = state.canvas.width / DPI * 2.54;
    const memoryMb = state.canvas.width * state.canvas.height * 4 / 1024 / 1024;
    const values = [
      ['Resolución', `${state.canvas.width} × ${state.canvas.height} px`, 'good'],
      ['Tamaño a 300 DPI', `${printableWidthCm.toFixed(1)} × ${(state.canvas.height / DPI * 2.54).toFixed(1)} cm`, printableWidthCm <= 60 ? 'good' : 'warning'],
      ['Transparencia', `${(transparent / total * 100).toFixed(1)}% libre`, transparent ? 'good' : 'warning'],
      ['Semitransparencia', `${(partialRate * 100).toFixed(2)}%`, partialRate > 0.003 ? 'warning' : 'good'],
      ['Posible halo claro', `${(haloRate * 100).toFixed(1)}% del borde`, haloRate > 0.18 ? 'warning' : 'good'],
      ['Píxeles aislados', `${isolated} en muestra`, isolated > total * 0.003 ? 'warning' : 'good'],
      ['Contenido cortado', clipped ? `${clipped} puntos tocan el límite` : 'Sin contacto con el límite', clipped ? 'warning' : 'good'],
      ['Memoria estimada', `${memoryMb.toFixed(1)} MB por capa`, memoryMb > 110 ? 'warning' : 'good']
    ];
    target.replaceChildren(...values.map(([label, value, level]) => {
      const row = document.createElement('div');
      row.className = level;
      row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      return row;
    }));
  };

  const addSheetItem = (canvas = state.canvas, name = state.filename) => {
    if (!canvas) return toast('Importá un diseño primero.');
    const widthCm = Math.max(2, Math.min(55, Number(byId('sheet-item-width').value) || 20));
    const quantity = Math.max(1, Math.min(30, Number(byId('sheet-item-quantity').value) || 1));
    state.sheetItems.push({ canvas: cloneCanvas(canvas), name, widthCm, quantity });
    renderSheetItems();
    buildSheetPreview();
  };

  const renderSheetItems = () => {
    const list = byId('sheet-items');
    if (!state.sheetItems.length) {
      list.innerHTML = '<p>No hay diseños agregados.</p>';
      return;
    }
    list.replaceChildren(...state.sheetItems.map((item, index) => {
      const row = document.createElement('div');
      const identity = document.createElement('span');
      const name = document.createElement('strong');
      name.textContent = item.name;
      const dimensions = document.createElement('small');
      dimensions.textContent = `${item.canvas.width} × ${item.canvas.height} px`;
      identity.append(name, dimensions);
      const controls = document.createElement('span');
      controls.className = 'sheet-item-controls';
      const width = document.createElement('input');
      width.type = 'number'; width.min = '2'; width.max = '55'; width.step = '0.5'; width.value = item.widthCm;
      width.title = 'Ancho en centímetros'; width.setAttribute('aria-label', `Ancho de ${item.name} en centímetros`);
      const quantity = document.createElement('input');
      quantity.type = 'number'; quantity.min = '1'; quantity.max = '99'; quantity.step = '1'; quantity.value = item.quantity;
      quantity.title = 'Cantidad'; quantity.setAttribute('aria-label', `Cantidad de ${item.name}`);
      [width, quantity].forEach(input => input.addEventListener('change', () => {
        item.widthCm = Math.max(2, Math.min(55, Number(width.value) || 2));
        item.quantity = Math.max(1, Math.min(99, Math.round(Number(quantity.value) || 1)));
        width.value = item.widthCm; quantity.value = item.quantity;
        buildSheetPreview();
      }));
      controls.append(width, quantity);
      const remove = createButton('<i class="fa-solid fa-xmark"></i>', 'production-icon-button');
      remove.title = 'Quitar de la plancha';
      remove.addEventListener('click', () => { state.sheetItems.splice(index, 1); renderSheetItems(); buildSheetPreview(); });
      row.append(identity, controls, remove);
      return row;
    }));
  };

  const buildSheetCanvas = (preview = false) => {
    const widthCm = Math.max(20, Math.min(60, Number(byId('sheet-width').value) || 56));
    const heightCm = Math.max(10, Math.min(100, Number(byId('sheet-height').value) || 30));
    const marginMm = Math.max(0, Math.min(20, Number(byId('sheet-margin').value) || 5));
    const gapMm = Math.max(0, Math.min(20, Number(byId('sheet-gap').value) || 0));
    const scale = preview ? Math.min(1, 900 / (widthCm / 2.54 * DPI)) : 1;
    const pixelsPerCm = DPI / 2.54 * scale;
    const width = Math.round(widthCm * pixelsPerCm);
    const height = Math.round(heightCm * pixelsPerCm);
    if (!preview && width * height > MAX_PIXELS) throw new Error('La plancha supera el límite seguro. Reducí el largo o el ancho.');
    const output = document.createElement('canvas');
    output.width = width;
    output.height = height;
    const context = output.getContext('2d');
    const edge = marginMm / 10 * pixelsPerCm;
    const gap = gapMm / 10 * pixelsPerCm;
    const freeRectangles = [{ x: edge, y: edge, width: Math.max(0, width - edge * 2), height: Math.max(0, height - edge * 2) }];
    const pieces = state.sheetItems.flatMap((item, itemIndex) => Array.from({ length: item.quantity }, (_, copy) => {
      const pieceWidth = item.widthCm * pixelsPerCm;
      return { item, itemIndex, copy, width: pieceWidth, height: pieceWidth * item.canvas.height / item.canvas.width };
    })).sort((first, second) => Math.max(second.width, second.height) - Math.max(first.width, first.height) || second.width * second.height - first.width * first.height);
    const placements = [];
    const allowRotate = byId('sheet-auto-rotate').checked;
    pieces.forEach(piece => {
      let best = null;
      freeRectangles.forEach((rectangle, rectangleIndex) => {
        const orientations = [{ width: piece.width, height: piece.height, rotated: false }];
        if (allowRotate && Math.abs(piece.width - piece.height) > 0.5) orientations.push({ width: piece.height, height: piece.width, rotated: true });
        orientations.forEach(orientation => {
          if (orientation.width > rectangle.width + 0.01 || orientation.height > rectangle.height + 0.01) return;
          const areaWaste = rectangle.width * rectangle.height - orientation.width * orientation.height;
          const shortWaste = Math.min(rectangle.width - orientation.width, rectangle.height - orientation.height);
          const score = areaWaste + shortWaste * Math.max(width, height);
          if (!best || score < best.score) best = { ...orientation, rectangleIndex, rectangle, score };
        });
      });
      if (!best) return;
      const rectangle = freeRectangles.splice(best.rectangleIndex, 1)[0];
      placements.push({ ...piece, x: rectangle.x, y: rectangle.y, width: best.width, height: best.height, rotated: best.rotated });
      const rightWidth = rectangle.width - best.width - gap;
      const bottomHeight = rectangle.height - best.height - gap;
      if (rightWidth > 1) freeRectangles.push({ x: rectangle.x + best.width + gap, y: rectangle.y, width: rightWidth, height: rectangle.height });
      if (bottomHeight > 1) freeRectangles.push({ x: rectangle.x, y: rectangle.y + best.height + gap, width: best.width, height: bottomHeight });
    });
    placements.forEach(placement => {
      context.save();
      if (placement.rotated) {
        context.translate(placement.x + placement.width, placement.y);
        context.rotate(Math.PI / 2);
        context.drawImage(placement.item.canvas, 0, 0, placement.height, placement.width);
      } else context.drawImage(placement.item.canvas, placement.x, placement.y, placement.width, placement.height);
      context.restore();
    });
    const printableArea = Math.max(1, (width - edge * 2) * (height - edge * 2));
    const usedArea = placements.reduce((sum, placement) => sum + placement.width * placement.height, 0);
    output.dataset.placed = String(placements.length);
    output.dataset.requested = String(pieces.length);
    output.dataset.efficiency = String(usedArea / printableArea * 100);
    return output;
  };

  const buildSheetPreview = () => {
    const canvas = byId('sheet-preview');
    if (!canvas) return;
    try {
      const preview = buildSheetCanvas(true);
      canvas.width = preview.width;
      canvas.height = preview.height;
      canvas.getContext('2d').drawImage(preview, 0, 0);
      const placed = Number(preview.dataset.placed || 0);
      const requested = Number(preview.dataset.requested || 0);
      const efficiency = Number(preview.dataset.efficiency || 0);
      byId('sheet-metrics').innerHTML = `<span>${placed}/${requested} piezas</span><span>${efficiency.toFixed(1)}% aprovechado</span>`;
      byId('sheet-status').textContent = placed < requested
        ? `${requested - placed} pieza(s) no caben. Aumentá el largo, reducí medidas o descargá otra plancha.`
        : `${placed} pieza(s) colocadas con separación segura · vista proporcional.`;
    } catch (error) {
      byId('sheet-status').textContent = error.message;
    }
  };

  const downloadSheet = async () => {
    if (!state.sheetItems.length) return toast('Agregá al menos un diseño a la plancha.');
    setBusy(true, 'Construyendo plancha a 300 DPI…');
    await nextFrame();
    try {
      const sheet = buildSheetCanvas(false);
      if (Number(sheet.dataset.placed || 0) < Number(sheet.dataset.requested || 0)) throw new Error('La plancha no puede descargarse incompleta. Ajustá medidas o cantidades hasta colocar todas las piezas.');
      await api().downloadCanvas(sheet, `plancha-dtf-${byId('sheet-width').value}x${byId('sheet-height').value}cm-300dpi.png`);
    } catch (error) {
      toast(error.message);
    } finally {
      setBusy(false);
    }
  };

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; }
    return table;
  })();
  const crc32 = bytes => { let crc = 0xffffffff; for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; };
  const u16 = value => new Uint8Array([value & 255, value >>> 8 & 255]);
  const u32 = value => new Uint8Array([value & 255, value >>> 8 & 255, value >>> 16 & 255, value >>> 24 & 255]);
  const concatBytes = parts => { const length = parts.reduce((sum, part) => sum + part.length, 0); const output = new Uint8Array(length); let offset = 0; parts.forEach(part => { output.set(part, offset); offset += part.length; }); return output; };

  const createZip = files => {
    const encoder = new TextEncoder();
    const locals = [], centrals = [];
    let offset = 0;
    files.forEach(file => {
      const name = encoder.encode(file.name);
      const data = file.data;
      const crc = crc32(data);
      const local = concatBytes([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), name, data]);
      locals.push(local);
      centrals.push(concatBytes([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
      offset += local.length;
    });
    const central = concatBytes(centrals);
    const end = concatBytes([u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length), u32(central.length), u32(offset), u16(0)]);
    return new Blob([...locals, central, end], { type: 'application/zip' });
  };

  const addPngDpi = bytes => {
    if (bytes.length < 33 || bytes[0] !== 137 || bytes[1] !== 80) return bytes;
    for (let offset = 8; offset + 12 <= bytes.length;) {
      const length = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
      const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
      if (type === 'pHYs') return bytes;
      if (type === 'IDAT') {
        const data = new Uint8Array([0, 0, 46, 35, 0, 0, 46, 35, 1]);
        const typeBytes = new TextEncoder().encode('pHYs');
        const crc = crc32(concatBytes([typeBytes, data]));
        const chunk = concatBytes([new Uint8Array([0, 0, 0, 9]), typeBytes, data, new Uint8Array([crc >>> 24, crc >>> 16 & 255, crc >>> 8 & 255, crc & 255])]);
        return concatBytes([bytes.slice(0, offset), chunk, bytes.slice(offset)]);
      }
      offset += 12 + length;
    }
    return bytes;
  };

  const prepareBatch = async () => {
    if (!state.batchFiles.length) return toast('Seleccioná las imágenes del lote.');
    const widthCm = Math.max(2, Math.min(45, Number(byId('batch-width').value) || 20));
    const targetWidth = Math.round(widthCm / 2.54 * DPI);
    const outputFiles = [];
    setBusy(true, 'Preparando lote…', 0);
    try {
      for (let index = 0; index < state.batchFiles.length; index++) {
        const file = state.batchFiles[index];
        let source = await fileToCanvas(file);
        if (byId('batch-trim').checked) source = trimCanvas(source);
        const targetHeight = Math.round(targetWidth * source.height / source.width);
        if (targetWidth * targetHeight > MAX_PIXELS) throw new Error(`${file.name}: la medida genera demasiados píxeles.`);
        const output = document.createElement('canvas');
        output.width = targetWidth; output.height = targetHeight;
        const context = output.getContext('2d');
        context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
        context.drawImage(source, 0, 0, output.width, output.height);
        if (byId('batch-binary-alpha').checked) {
          const imageData = context.getImageData(0, 0, output.width, output.height);
          for (let p = 3; p < imageData.data.length; p += 4) imageData.data[p] = imageData.data[p] > 127 ? 255 : 0;
          context.putImageData(imageData, 0, 0);
        }
        const blob = await canvasToBlob(output);
        outputFiles.push({ name: `${file.name.replace(/\.[^.]+$/, '')}-${widthCm}cm-300dpi.png`, data: addPngDpi(new Uint8Array(await blob.arrayBuffer())) });
        setBusy(true, `Preparando ${file.name}…`, (index + 1) / state.batchFiles.length * 100);
        await nextFrame();
      }
      const zip = createZip(outputFiles);
      triggerBlob(zip, `momotus-lote-${outputFiles.length}-archivos.zip`);
      toast(`${outputFiles.length} imágenes preparadas en un ZIP.`);
    } catch (error) {
      toast(error.message || 'No se pudo completar el lote.');
    } finally {
      setBusy(false);
    }
  };

  const triggerBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = filename;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const openDatabase = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME, { keyPath: 'id' }); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const databaseAction = async (mode, callback) => {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const result = callback(transaction.objectStore(STORE_NAME));
      transaction.oncomplete = () => { db.close(); resolve(result?.result); };
      transaction.onerror = () => { db.close(); reject(transaction.error); };
    });
  };

  const captureSettings = () => Object.fromEntries([...document.querySelectorAll('.tool-controls input[id], .tool-controls select[id]')]
    .filter(element => element.type !== 'file' && !element.classList.contains('studio-range-number'))
    .map(element => [element.id, element.type === 'checkbox' ? element.checked : element.value]));

  const saveProject = async automatic => {
    if (!state.canvas || !('indexedDB' in window)) return false;
    const id = state.projectId || `project-${Date.now()}`;
    const record = {
      id,
      name: state.filename,
      updatedAt: Date.now(),
      canvas: await canvasToBlob(state.canvas),
      recovery: await canvasToBlob(state.recovery || state.canvas),
      palette: state.palette,
      sheetItems: await Promise.all(state.sheetItems.map(async item => ({ name: item.name, widthCm: item.widthCm, quantity: item.quantity, canvas: await canvasToBlob(item.canvas) }))),
      settings: captureSettings(),
      profileName: state.profileName
    };
    await databaseAction('readwrite', store => store.put(record));
    state.projectId = id;
    if (!automatic) toast('Proyecto guardado en esta computadora.');
    await listProjects();
    return true;
  };

  const listProjects = async () => {
    const list = byId('production-project-list');
    if (!list || !('indexedDB' in window)) return;
    let projects = [];
    try { projects = await databaseAction('readonly', store => store.getAll()) || []; } catch (error) { list.innerHTML = '<p>No se pudo abrir el almacenamiento de proyectos.</p>'; return; }
    projects.sort((a, b) => b.updatedAt - a.updatedAt);
    if (!projects.length) { list.innerHTML = '<p>No hay proyectos guardados todavía.</p>'; return; }
    list.replaceChildren(...projects.map(project => {
      const row = document.createElement('div');
      const identity = document.createElement('span');
      const name = document.createElement('strong'); name.textContent = project.name;
      const date = document.createElement('small'); date.textContent = new Date(project.updatedAt).toLocaleString('es-NI');
      identity.append(name, date); row.append(identity);
      const load = createButton('<i class="fa-solid fa-folder-open"></i>', 'production-icon-button');
      load.title = 'Abrir proyecto';
      load.addEventListener('click', () => loadProject(project));
      const remove = createButton('<i class="fa-regular fa-trash-can"></i>', 'production-icon-button danger');
      remove.title = 'Eliminar proyecto';
      remove.addEventListener('click', async () => { await databaseAction('readwrite', store => store.delete(project.id)); if (state.projectId === project.id) state.projectId = null; listProjects(); });
      row.append(load, remove);
      return row;
    }));
  };

  const loadProject = async project => {
    setBusy(true, 'Abriendo proyecto…');
    try {
      state.canvas = await blobToCanvas(project.canvas);
      state.recovery = project.recovery ? await blobToCanvas(project.recovery) : cloneCanvas(state.canvas);
      state.filename = project.name;
      state.projectId = project.id;
      state.palette = project.palette || [];
      state.sheetItems = await Promise.all((project.sheetItems || []).map(async item => ({ ...item, canvas: await blobToCanvas(item.canvas) })));
      state.profileName = project.profileName || 'Sin perfil asignado';
      Object.entries(project.settings || {}).forEach(([id, value]) => {
        const element = byId(id);
        if (!element) return;
        if (element.type === 'checkbox') element.checked = Boolean(value); else element.value = value;
      });
      state.history = []; state.historyIndex = -1;
      drawWorkingCanvas(); pushHistory('Proyecto recuperado'); renderPalette(); renderSheetItems(); buildSheetPreview();
      byId('production-profile-name').textContent = state.profileName;
      toast('Proyecto recuperado.');
    } catch (error) { toast('No se pudo recuperar el proyecto.'); }
    finally { setBusy(false); }
  };

  const exportProjectFile = async () => {
    if (!state.canvas) return toast('No hay un proyecto para exportar.');
    const toDataUrl = canvas => canvas.toDataURL('image/png');
    const project = {
      format: 'momotus-dtf-project', version: 2, name: state.filename, createdAt: new Date().toISOString(),
      canvas: toDataUrl(state.canvas), recovery: toDataUrl(state.recovery || state.canvas), palette: state.palette,
      sheetItems: state.sheetItems.map(item => ({ name: item.name, widthCm: item.widthCm, quantity: item.quantity, canvas: toDataUrl(item.canvas) })),
      settings: captureSettings(), profileName: state.profileName
    };
    triggerBlob(new Blob([JSON.stringify(project)], { type: 'application/json' }), `${state.filename}.momotus`);
  };

  const dataUrlToBlob = dataUrl => {
    const [header, encoded] = String(dataUrl).split(',');
    const mime = /data:([^;]+)/.exec(header)?.[1] || 'image/png';
    const binary = atob(encoded || '');
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: mime });
  };

  const importProjectFile = async file => {
    try {
      const project = JSON.parse(await file.text());
      if (project.format !== 'momotus-dtf-project' || !project.canvas) throw new Error('Formato no compatible.');
      state.canvas = await blobToCanvas(dataUrlToBlob(project.canvas));
      state.recovery = project.recovery ? await blobToCanvas(dataUrlToBlob(project.recovery)) : cloneCanvas(state.canvas);
      state.filename = project.name || 'momotus-proyecto'; state.palette = project.palette || []; state.projectId = null;
      state.sheetItems = await Promise.all((project.sheetItems || []).map(async item => ({ ...item, canvas: await blobToCanvas(dataUrlToBlob(item.canvas)) })));
      state.profileName = project.profileName || 'Sin perfil asignado'; state.history = []; state.historyIndex = -1;
      Object.entries(project.settings || {}).forEach(([id, value]) => { const element = byId(id); if (!element) return; if (element.type === 'checkbox') element.checked = Boolean(value); else element.value = value; });
      drawWorkingCanvas(); pushHistory('Proyecto importado'); renderPalette(); renderSheetItems(); buildSheetPreview();
      toast('Proyecto importado correctamente.');
    } catch (error) { toast(error.message || 'No se pudo abrir el proyecto.'); }
  };

  const downloadJobTicket = () => {
    if (!state.canvas) return toast('No hay un documento activo.');
    const ticket = {
      cliente: '', pedido: '', archivo: state.filename, generado: new Date().toISOString(),
      pixeles: { ancho: state.canvas.width, alto: state.canvas.height }, dpi: DPI,
      medidaCm: { ancho: Number((state.canvas.width / DPI * 2.54).toFixed(2)), alto: Number((state.canvas.height / DPI * 2.54).toFixed(2)) },
      perfilAsignado: state.profileName, coloresSeparados: state.palette.map(color => `#${color.map(value => value.toString(16).padStart(2, '0')).join('')}`),
      nota: 'Confirmar ajustes finales en el RIP y realizar una prueba antes de producción.'
    };
    triggerBlob(new Blob([JSON.stringify(ticket, null, 2)], { type: 'application/json' }), `${state.filename}-ficha-produccion.json`);
  };

  const setSoftProof = value => {
    const viewport = byId('production-viewport');
    viewport.dataset.softproof = value;
    const notes = {
      none: 'Vista RGB original. La conversión final depende del RIP.',
      balanced: 'Simulación visual balanceada; no sustituye un perfil ICC medido.',
      vivid: 'Simulación de tinta viva para revisar posibles saturaciones.',
      dark: 'Simulación sobre prenda oscura con reducción moderada de luminancia.'
    };
    byId('production-softproof-note').textContent = notes[value] || notes.none;
  };

  const openProduction = () => {
    byId('production-studio').hidden = false;
    document.body.classList.add('production-open');
    applyZoom();
    listProjects();
  };
  const closeProduction = () => {
    byId('production-studio').hidden = true;
    document.body.classList.remove('production-open');
  };

  const buildInterface = () => {
    const toolbar = document.querySelector('.tool-history-actions');
    if (!toolbar) return;
    const launch = createButton('<i class="fa-solid fa-industry"></i><span>Producción DTF</span>', 'production-launch');
    launch.title = 'Abrir preparación avanzada, planchas y proyectos';
    launch.addEventListener('click', openProduction);
    toolbar.prepend(launch);

    const studio = document.createElement('div');
    studio.id = 'production-studio';
    studio.className = 'production-studio';
    studio.hidden = true;
    studio.innerHTML = `
      <header class="production-topbar">
        <div class="production-brand"><i class="fa-solid fa-industry"></i><span><strong>Producción DTF</strong><small>Momotus Studio</small></span></div>
        <div class="production-document"><strong id="production-document-name">Sin documento</strong><span id="production-document-size">Importá un resultado o una imagen</span></div>
        <div class="production-top-actions">
          <button id="production-import-active" type="button"><i class="fa-solid fa-arrow-right-to-bracket"></i><span>Importar resultado activo</span></button>
          <label><i class="fa-solid fa-image"></i><span>Abrir imagen</span><input id="production-file" type="file" accept="image/png,image/jpeg,image/webp" hidden></label>
          <button id="production-save" type="button"><i class="fa-regular fa-floppy-disk"></i><span>Guardar</span></button>
          <button id="production-close" type="button" aria-label="Cerrar Producción DTF"><i class="fa-solid fa-xmark"></i></button>
        </div>
      </header>
      <div class="production-body">
        <nav class="production-tabs" aria-label="Módulos de producción">
          <button type="button" class="active" data-production-tab="mask"><i class="fa-solid fa-paintbrush"></i><span>Máscara</span></button>
          <button type="button" data-production-tab="transform"><i class="fa-solid fa-crop-simple"></i><span>Medidas</span></button>
          <button type="button" data-production-tab="colors"><i class="fa-solid fa-swatchbook"></i><span>Colores</span></button>
          <button type="button" data-production-tab="sheet"><i class="fa-solid fa-table-cells-large"></i><span>Plancha</span></button>
          <button type="button" data-production-tab="batch"><i class="fa-solid fa-layer-group"></i><span>Lotes</span></button>
          <button type="button" data-production-tab="project"><i class="fa-solid fa-box-archive"></i><span>Proyecto</span></button>
        </nav>
        <main class="production-center">
          <div class="production-canvas-toolbar">
            <button id="production-undo" type="button" disabled title="Deshacer"><i class="fa-solid fa-rotate-left"></i></button>
            <button id="production-redo" type="button" disabled title="Rehacer"><i class="fa-solid fa-rotate-right"></i></button>
            <span></span>
            <button type="button" data-production-zoom="fit">Ajustar</button>
            <button type="button" data-production-zoom="100">100%</button>
            <button type="button" data-production-zoom="200">200%</button>
            <strong id="production-zoom-label">100%</strong>
          </div>
          <div id="production-viewport" class="production-viewport checkerboard" data-softproof="none">
            <div id="production-empty" class="production-empty"><i class="fa-solid fa-file-circle-plus"></i><strong>Abrí un documento de producción</strong><span>Importá el resultado activo o seleccioná una imagen.</span></div>
            <canvas id="production-canvas" hidden></canvas>
          </div>
          <div class="production-statusbar"><span>300 DPI</span><span>PNG transparente</span><span id="production-profile-name">Sin perfil asignado</span><label>Continuar en <select id="production-send-target"><option value="quality">Calidad</option><option value="background">Fondo</option><option value="halftone">Semitonos</option><option value="vector">Vectorización</option><option value="effects">Efectos de estampado</option></select></label><button id="production-send" type="button"><i class="fa-solid fa-arrow-up-right-from-square"></i> Enviar</button><button id="production-review" type="button"><i class="fa-solid fa-magnifying-glass-chart"></i> Revisar y exportar</button></div>
          <div id="production-busy" class="production-busy" hidden><div><i></i></div><strong>Procesando…</strong><span></span></div>
        </main>
        <aside class="production-inspector">
          <section data-production-panel="mask">
            <div class="production-panel-heading"><span>MÁSCARA MANUAL</span><h2>Corregir fondo</h2><p>Borrá o recuperá detalles sin modificar el archivo de origen.</p></div>
            <div class="production-toggle production-mask-view"><button type="button" class="active" data-mask-view="result"><i class="fa-solid fa-image"></i> Resultado</button><button type="button" data-mask-view="mask"><i class="fa-solid fa-circle-half-stroke"></i> Máscara</button></div>
            <div class="production-toggle"><button type="button" class="active" data-brush-mode="erase"><i class="fa-solid fa-eraser"></i> Borrar</button><button type="button" data-brush-mode="restore"><i class="fa-solid fa-rotate-left"></i> Recuperar</button></div>
            <label class="production-field">Tamaño del pincel <output id="production-brush-size-value">40 px</output><input id="production-brush-size" type="range" min="4" max="240" value="40"></label>
            <label class="production-field">Dureza <output id="production-brush-hardness-value">80%</output><input id="production-brush-hardness" type="range" min="10" max="100" value="80"></label>
            <p class="production-tip"><i class="fa-solid fa-circle-info"></i> Acercate al 200% para corregir letras, cabello y bordes finos.</p>
            <h3>Historial reversible</h3><div id="production-history" class="production-history"></div>
          </section>
          <section data-production-panel="transform" hidden>
            <div class="production-panel-heading"><span>MEDIDA Y ENCUADRE</span><h2>Transformar</h2><p>Prepará el tamaño físico exacto antes de imprimir.</p></div>
            <div class="production-action-grid"><button data-transform="trim"><i class="fa-solid fa-crop-simple"></i> Recortar vacío</button><button data-transform="left"><i class="fa-solid fa-rotate-left"></i> Girar izquierda</button><button data-transform="right"><i class="fa-solid fa-rotate-right"></i> Girar derecha</button><button data-transform="flip-x"><i class="fa-solid fa-arrows-left-right"></i> Reflejo horizontal</button><button data-transform="flip-y"><i class="fa-solid fa-arrows-up-down"></i> Reflejo vertical</button></div>
            <label class="production-field-row"><span>Ancho final</span><span><input id="production-width-cm" type="number" min="1" max="60" step="0.5" value="30"> cm</span></label>
            <button id="production-resize" type="button" class="production-primary"><i class="fa-solid fa-ruler-combined"></i> Aplicar medida a 300 DPI</button>
            <p class="production-tip"><i class="fa-solid fa-triangle-exclamation"></i> Ampliar cambia el número de píxeles, pero no inventa detalle que no existe.</p>
          </section>
          <section data-production-panel="colors" hidden>
            <div class="production-panel-heading"><span>SEPARACIÓN</span><h2>Colores directos</h2><p>Reducí la paleta y revisá cada canal por separado.</p></div>
            <label class="production-field-row"><span>Cantidad de colores</span><select id="production-color-count"><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option><option>7</option><option>8</option></select></label>
            <label class="production-check"><input id="production-preserve-alpha" type="checkbox" checked><span>Conservar transparencia original</span></label>
            <button id="production-separate" type="button" class="production-primary"><i class="fa-solid fa-wand-magic-sparkles"></i> Crear separación</button>
            <div id="production-palette" class="production-palette"><p>La paleta aparecerá después de separar los colores.</p></div>
            <h3>Prueba visual</h3>
            <label class="production-field-row"><span>Simulación</span><select id="production-softproof"><option value="none">RGB original</option><option value="balanced">DTF balanceado</option><option value="vivid">DTF colores vivos</option><option value="dark">Prenda oscura</option></select></label>
            <label class="production-profile"><i class="fa-solid fa-fingerprint"></i><span><strong>Asignar perfil del taller</strong><small>Se registra en la ficha; la conversión final se hace en el RIP.</small></span><input id="production-profile" type="file" accept=".icc,.icm" hidden></label>
            <p id="production-softproof-note" class="production-tip">Vista RGB original. La conversión final depende del RIP.</p>
          </section>
          <section data-production-panel="sheet" hidden>
            <div class="production-panel-heading"><span>ARMADO DTF</span><h2>Plancha de impresión</h2><p>Organizá diseños con medidas y separación controladas.</p></div>
            <div class="production-inline-fields"><label>Ancho<input id="sheet-width" type="number" min="20" max="60" value="56"><small>cm</small></label><label>Largo<input id="sheet-height" type="number" min="10" max="100" value="30"><small>cm</small></label><label>Margen<input id="sheet-margin" type="number" min="0" max="20" value="5"><small>mm</small></label><label>Separación<input id="sheet-gap" type="number" min="0" max="20" step="0.5" value="5"><small>mm</small></label></div>
            <label class="production-check"><input id="sheet-auto-rotate" type="checkbox" checked><span>Girar automáticamente para aprovechar espacio</span></label>
            <div class="production-inline-fields"><label>Ancho del diseño<input id="sheet-item-width" type="number" min="2" max="55" value="20"><small>cm</small></label><label>Cantidad<input id="sheet-item-quantity" type="number" min="1" max="30" value="1"></label></div>
            <button id="sheet-add-current" type="button" class="production-primary"><i class="fa-solid fa-plus"></i> Agregar diseño actual</button>
            <label class="production-drop production-sheet-drop"><i class="fa-solid fa-images"></i><strong>Agregar varios diseños</strong><span>Cada archivo se agrega como una pieza independiente</span><input id="sheet-files" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></label>
            <div id="sheet-items" class="sheet-items"><p>No hay diseños agregados.</p></div>
            <div class="sheet-preview-wrap checkerboard"><canvas id="sheet-preview"></canvas></div><div id="sheet-metrics" class="sheet-metrics"><span>0 piezas</span><span>0% aprovechado</span></div><p id="sheet-status" class="production-tip">Configurá la plancha y agregá diseños.</p>
            <button id="sheet-quote" type="button" class="production-secondary"><i class="fa-solid fa-calculator"></i> Enviar plancha al cotizador</button>
            <button id="sheet-download" type="button" class="production-primary"><i class="fa-solid fa-download"></i> Descargar plancha 300 DPI</button>
          </section>
          <section data-production-panel="batch" hidden>
            <div class="production-panel-heading"><span>AUTOMATIZACIÓN</span><h2>Procesar por lote</h2><p>Aplicá la misma medida y limpieza a varios archivos.</p></div>
            <label class="production-drop"><i class="fa-solid fa-images"></i><strong>Seleccionar varias imágenes</strong><span>PNG, JPG o WebP</span><input id="batch-files" type="file" accept="image/png,image/jpeg,image/webp" multiple hidden></label>
            <div id="batch-list" class="batch-list"><p>No hay archivos seleccionados.</p></div>
            <label class="production-field-row"><span>Ancho de cada salida</span><span><input id="batch-width" type="number" min="2" max="45" step="0.5" value="20"> cm</span></label>
            <label class="production-check"><input id="batch-trim" type="checkbox" checked><span>Recortar márgenes transparentes</span></label>
            <label class="production-check"><input id="batch-binary-alpha" type="checkbox" checked><span>Eliminar semitransparencias</span></label>
            <button id="batch-process" type="button" class="production-primary"><i class="fa-solid fa-gears"></i> Preparar ZIP del lote</button>
          </section>
          <section data-production-panel="project" hidden>
            <div class="production-panel-heading"><span>CONTINUIDAD</span><h2>Proyectos</h2><p>Guardá el trabajo y continuá después desde esta computadora.</p></div>
            <div class="production-project-actions"><button id="project-save" type="button"><i class="fa-regular fa-floppy-disk"></i> Guardar ahora</button><button id="project-export" type="button"><i class="fa-solid fa-file-export"></i> Exportar .momotus</button><label><i class="fa-solid fa-file-import"></i> Importar proyecto<input id="project-import" type="file" accept=".momotus,application/json" hidden></label></div>
            <div id="production-project-list" class="production-project-list"><p>No hay proyectos guardados todavía.</p></div>
            <h3>Diagnóstico del documento</h3><div id="production-diagnostics" class="production-diagnostics"><p>Importá una imagen para ejecutar el diagnóstico.</p></div>
            <button id="production-ticket" type="button" class="production-secondary"><i class="fa-solid fa-clipboard-list"></i> Descargar ficha de producción</button>
          </section>
        </aside>
      </div>`;
    document.body.append(studio);
  };

  const bindInterface = () => {
    byId('production-close').addEventListener('click', closeProduction);
    byId('production-import-active').addEventListener('click', importActiveResult);
    byId('production-file').addEventListener('change', async event => {
      const file = event.target.files?.[0]; if (!file) return;
      setBusy(true, 'Abriendo imagen…');
      try { setDocument(await fileToCanvas(file), file.name); } catch (error) { toast(error.message); } finally { setBusy(false); event.target.value = ''; }
    });
    document.querySelectorAll('[data-production-tab]').forEach(button => button.addEventListener('click', () => switchPanel(button.dataset.productionTab)));
    document.querySelectorAll('[data-production-zoom]').forEach(button => button.addEventListener('click', () => { state.zoom = button.dataset.productionZoom; applyZoom(); }));
    byId('production-undo').addEventListener('click', () => restoreHistory(state.historyIndex - 1));
    byId('production-redo').addEventListener('click', () => restoreHistory(state.historyIndex + 1));
    document.querySelectorAll('[data-brush-mode]').forEach(button => button.addEventListener('click', () => { state.brushMode = button.dataset.brushMode; document.querySelectorAll('[data-brush-mode]').forEach(item => item.classList.toggle('active', item === button)); }));
    document.querySelectorAll('[data-mask-view]').forEach(button => button.addEventListener('click', () => {
      state.maskView = button.dataset.maskView;
      document.querySelectorAll('[data-mask-view]').forEach(item => item.classList.toggle('active', item === button));
      renderWorkingDisplay();
    }));
    [['production-brush-size', 'production-brush-size-value', ' px'], ['production-brush-hardness', 'production-brush-hardness-value', '%']].forEach(([input, output, suffix]) => byId(input).addEventListener('input', () => { byId(output).textContent = `${byId(input).value}${suffix}`; }));
    const canvas = getDisplayCanvas();
    canvas.addEventListener('pointerdown', event => { if (!state.canvas || event.button !== 0) return; state.drawing = true; state.changedDuringStroke = false; state.lastBrushPoint = null; canvas.setPointerCapture(event.pointerId); paintBrush(event); });
    canvas.addEventListener('pointermove', paintBrush);
    const finishStroke = event => { if (!state.drawing) return; state.drawing = false; state.lastBrushPoint = null; if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); if (state.changedDuringStroke) { analyzeCurrent(); pushHistory(state.brushMode === 'erase' ? 'Máscara borrada' : 'Detalle recuperado'); } };
    canvas.addEventListener('pointerup', finishStroke); canvas.addEventListener('pointercancel', finishStroke);
    document.querySelectorAll('[data-transform]').forEach(button => button.addEventListener('click', () => applyTransform(button.dataset.transform)));
    byId('production-resize').addEventListener('click', resizePhysical);
    byId('production-separate').addEventListener('click', quantizeColors);
    byId('production-softproof').addEventListener('change', event => setSoftProof(event.target.value));
    byId('production-profile').addEventListener('change', event => { const file = event.target.files?.[0]; if (!file) return; state.profileName = file.name; byId('production-profile-name').textContent = file.name; toast('Perfil registrado para la ficha. La conversión se realizará en el RIP.'); });
    ['sheet-width', 'sheet-height', 'sheet-margin', 'sheet-gap', 'sheet-auto-rotate'].forEach(id => byId(id).addEventListener('change', buildSheetPreview));
    byId('sheet-add-current').addEventListener('click', () => addSheetItem());
    byId('sheet-files').addEventListener('change', async event => {
      const files = [...(event.target.files || [])].filter(file => file.type.startsWith('image/')).slice(0, 30);
      if (!files.length) return;
      setBusy(true, 'Agregando diseños a la plancha…', 0);
      try {
        for (let index = 0; index < files.length; index++) {
          const canvas = await fileToCanvas(files[index]);
          addSheetItem(canvas, files[index].name.replace(/\.[^.]+$/, ''));
          setBusy(true, `Agregando ${files[index].name}…`, (index + 1) / files.length * 100);
          await nextFrame();
        }
      } catch (error) { toast(error.message || 'No se pudieron agregar todos los diseños.'); }
      finally { setBusy(false); event.target.value = ''; }
    });
    byId('sheet-download').addEventListener('click', downloadSheet);
    byId('sheet-quote').addEventListener('click', () => {
      if (!state.sheetItems.length) return toast('Agregá diseños antes de cotizar la plancha.');
      const preview = buildSheetCanvas(true);
      const placed = Number(preview.dataset.placed || 0);
      const requested = Number(preview.dataset.requested || 0);
      if (placed < requested) return toast('La plancha está incompleta. Ajustala antes de enviarla al cotizador.');
      window.dispatchEvent(new CustomEvent('momotus:quote-sheet', { detail: {
        sheetWidth: Number(byId('sheet-width').value),
        sheetHeight: Number(byId('sheet-height').value),
        pieces: placed,
        efficiency: Number(preview.dataset.efficiency || 0),
        preview: byId('sheet-preview').toDataURL('image/png')
      } }));
      closeProduction();
    });
    byId('batch-files').addEventListener('change', event => {
      state.batchFiles = [...event.target.files].filter(file => file.type.startsWith('image/')).slice(0, 30);
      const list = byId('batch-list');
      list.replaceChildren(...state.batchFiles.map(file => {
        const row = document.createElement('div');
        const name = document.createElement('strong'); name.textContent = file.name;
        const size = document.createElement('span'); size.textContent = `${(file.size / 1024 / 1024).toFixed(1)} MB`;
        row.append(name, size); return row;
      }));
      if (!state.batchFiles.length) list.innerHTML = '<p>No hay archivos seleccionados.</p>';
    });
    byId('batch-process').addEventListener('click', prepareBatch);
    byId('production-save').addEventListener('click', () => saveProject(false));
    byId('project-save').addEventListener('click', () => saveProject(false));
    byId('project-export').addEventListener('click', exportProjectFile);
    byId('project-import').addEventListener('change', event => { const file = event.target.files?.[0]; if (file) importProjectFile(file); event.target.value = ''; });
    byId('production-ticket').addEventListener('click', downloadJobTicket);
    byId('production-review').addEventListener('click', () => {
      if (!state.canvas) return toast('No hay un documento para revisar.');
      api().reviewAndDownload(state.canvas, `${state.filename}-listo-dtf-300dpi.png`, 'background');
    });
    byId('production-send').addEventListener('click', async () => {
      if (!state.canvas) return toast('No hay un documento para continuar.');
      const target = byId('production-send-target').value;
      setBusy(true, 'Enviando al flujo principal…');
      try {
        let sent;
        if (target === 'vector') {
          if(!await window.MomotusReviewTransfer(state.canvas,'vector',state.filename,'production')) return;
          window.MomotusRememberTransfer('production','vector');
          const blob = await canvasToBlob(state.canvas);
          const file = new File([blob], `${state.filename}.png`, { type: 'image/png' });
          window.dispatchEvent(new CustomEvent('momotus:vector-import', { detail: { file } }));
          sent = true;
        } else sent = await api().sendCanvasToTool(state.canvas, target, `${state.filename}.png`);
        if (!sent) throw new Error('No se pudo enviar el documento.');
        closeProduction();
        toast('Documento enviado sin perder el proyecto de producción.');
      } catch (error) { toast(error.message || 'No se pudo enviar el documento.'); }
      finally { setBusy(false); }
    });
    window.addEventListener('resize', applyZoom);
    document.addEventListener('keydown', event => {
      if (byId('production-studio').hidden) return;
      if (event.key === 'Escape') closeProduction();
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveProject(false); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) { event.preventDefault(); restoreHistory(state.historyIndex + (event.shiftKey ? 1 : -1)); }
    });
  };

  const initialize = () => {
    buildInterface();
    bindInterface();
    switchPanel('mask');
    renderHistory(); renderPalette(); renderSheetItems(); analyzeCurrent(); listProjects();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
