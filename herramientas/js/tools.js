(() => {
  'use strict';

  const EXPORT_DPI = 300;
  const PIXELS_PER_METER_300_DPI = 11811;
  const MAX_FILE_SIZE = 24 * 1024 * 1024;
  const MAX_WORKING_PIXELS = 12000000;
  const MAX_INTERNAL_PIXELS = 18000000;
  const MAX_OUTPUT_SIDE = 6000;
  const MAX_HALFTONE_PIXELS = 18000000;
  const MAX_HALFTONE_SIDE = 6000;
  const MAX_PREVIEW_PIXELS = 3000000;
  const MAX_PREVIEW_SIDE = 2400;
  const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const ALLOWED_IMAGE_EXTENSION = /\.(?:png|jpe?g|webp)$/i;
  const panelByType = Object.freeze({ halftone: 'semitonos', background: 'eliminar-fondo', quality: 'mejorar-calidad' });
  const states = { halftone: null, background: null, quality: null };
  const previewViews = { halftone: 'result', background: 'result', quality: 'result' };
  const renderTimers = {};
  const previewZoomFrames = {};
  const previewCenterFrames = {};
  const previewBoundsCache = {};
  const uploadTokens = { halftone: 0, background: 0, quality: 0 };
  const dirtyStates = { halftone: false, background: false, quality: false };
  const histories = {
    halftone: { entries: [], index: -1 },
    background: { entries: [], index: -1 },
    quality: { entries: [], index: -1 }
  };
  let activeTool = 'halftone';
  let qualityProcessing = false;
  let qualityRevision = 0;
  let halftoneRenderRevision = 0;
  let backgroundRenderRevision = 0;
  let pendingPreflightDownload = null;

  const byId = id => document.getElementById(id);
  const setWorkspaceState = (label, tone = 'idle') => {
    const state = byId('editor-workspace-state');
    if (!state) return;
    state.classList.remove('idle', 'processing', 'ready', 'warning');
    state.classList.add(tone);
    const text = state.querySelector('strong');
    if (text) text.textContent = label;
  };
  const setProcessingProgress = (type, percentage, heading = null, detail = null) => {
    const overlay = document.querySelector(`[data-processing="${type}"]`);
    if (!overlay) return;
    const progress = Math.max(0, Math.min(100, Math.round(Number(percentage) || 0)));
    overlay.hidden = false;
    const bar = overlay.querySelector('[data-progress-bar]');
    const value = overlay.querySelector('[data-progress-value]');
    if (bar) bar.style.width = `${progress}%`;
    if (value) value.textContent = `${progress}%`;
    if (heading) overlay.querySelector('strong').textContent = heading;
    if (detail) overlay.querySelector(':scope > span').textContent = detail;
    if (type === activeTool) setWorkspaceState(`Procesando ${progress}%`, 'processing');
  };
  const markToolDirty = type => {
    if (!states[type]) return;
    dirtyStates[type] = true;
    const panelId = { halftone: 'semitonos', background: 'eliminar-fondo', quality: 'mejorar-calidad' }[type];
    byId(panelId)?.classList.add('has-pending-changes');
    if (type === activeTool) setWorkspaceState('Cambios pendientes', 'warning');
  };
  const markToolClean = type => {
    dirtyStates[type] = false;
    const panelId = { halftone: 'semitonos', background: 'eliminar-fondo', quality: 'mejorar-calidad' }[type];
    byId(panelId)?.classList.remove('has-pending-changes');
  };
  const setStatus = (id, message) => {
    const element = byId(id);
    if (element) element.textContent = message;
    const mirror = id.endsWith('-status') ? byId(id.replace('-status', '-result-info')) : null;
    if (mirror) {
      mirror.textContent = message;
      mirror.title = message;
    }
    if (id.endsWith('-status')) {
      const type = id.replace('-status', '');
      const busy = /^(Cargando|Preparando|Analizando|Procesando|Actualizando)/i.test(message);
      const warning = /(No se pudo|Probá|error|poco detalle|cambiaste los ajustes)/i.test(message);
      const overlay = document.querySelector(`[data-processing="${type}"]`);
      if (overlay) {
        const wasHidden = overlay.hidden;
        overlay.hidden = !busy;
        const heading = overlay.querySelector('strong');
        if (heading && busy) heading.textContent = message.replace(/…+$/, '…');
        if (busy && wasHidden) setProcessingProgress(type, 0, message);
      }
      if (type === activeTool) {
        if (busy) setWorkspaceState('Procesando', 'processing');
        else if (warning) setWorkspaceState('Revisar', 'warning');
        else if (dirtyStates[type]) setWorkspaceState('Cambios pendientes', 'warning');
        else if (states[type]) {
          const resultReady = type === 'quality'
            ? !byId('quality-download')?.disabled
            : !document.querySelector(`[data-preview-compare="${type}"]`)?.disabled;
          setWorkspaceState(resultReady ? 'Resultado listo' : 'Archivo cargado', 'ready');
        }
        else setWorkspaceState('Sin archivo', 'idle');
      }
      window.dispatchEvent(new CustomEvent('momotus:workspace-update', { detail: { type, message } }));
    }
  };
  const hexToRgb = hex => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) });
  const rgbToHex = (r, g, b) => `#${[r, g, b].map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const centimetersAt300Dpi = pixels => (pixels / EXPORT_DPI * 2.54).toFixed(1);
  const clampChannel = value => Math.max(0, Math.min(255, Math.round(value)));
  const adjustAlphaEdge = (data, width, height, shift) => {
    const radius = Math.min(3, Math.abs(Math.round(shift || 0)));
    if (!radius) return;
    const sourceAlpha = new Uint8ClampedArray(width * height);
    for (let pixel = 0; pixel < sourceAlpha.length; pixel++) sourceAlpha[pixel] = data[pixel * 4 + 3];
    const expand = shift > 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let alpha = expand ? 0 : 255;
        for (let offsetY = -radius; offsetY <= radius; offsetY++) {
          const sampleY = Math.max(0, Math.min(height - 1, y + offsetY));
          for (let offsetX = -radius; offsetX <= radius; offsetX++) {
            const sampleX = Math.max(0, Math.min(width - 1, x + offsetX));
            const sample = sourceAlpha[sampleY * width + sampleX];
            alpha = expand ? Math.max(alpha, sample) : Math.min(alpha, sample);
          }
        }
        data[(y * width + x) * 4 + 3] = alpha;
      }
    }
  };
  const perceptualColorDistance = (r, g, b, target) => {
    const redDifference = r - target.r;
    const greenDifference = g - target.g;
    const blueDifference = b - target.b;
    const redMean = (r + target.r) / 2;
    return Math.sqrt(
      (2 + redMean / 256) * redDifference * redDifference
      + 4 * greenDifference * greenDifference
      + (2 + (255 - redMean) / 256) * blueDifference * blueDifference
    ) / 1.5;
  };

  const activeWorkerJobs = new Map();
  const runWorkerTask = (kind, payload, transfer = [], onProgress = null) => new Promise((resolve, reject) => {
    if (!('Worker' in window)) return reject(new Error('WORKER_UNAVAILABLE'));
    const previous = activeWorkerJobs.get(kind);
    if (previous) {
      previous.worker.terminate();
      const error = new Error('WORKER_CANCELLED');
      error.name = 'AbortError';
      previous.reject(error);
    }
    let worker;
    try {
      const workerVersion = encodeURIComponent(window.MOMOTUS_TOOLS_VERSION || '1');
      worker = new Worker(new URL(`herramientas/js/tools-worker.js?v=${workerVersion}`, document.baseURI));
    } catch (error) {
      reject(error);
      return;
    }
    activeWorkerJobs.set(kind, { worker, reject });
    worker.onmessage = event => {
      const message = event.data || {};
      if (message.type === 'progress') {
        onProgress?.(message.value);
        return;
      }
      activeWorkerJobs.delete(kind);
      worker.terminate();
      if (message.type === 'result') resolve(message.result);
      else reject(new Error(message.message || 'No se pudo completar el proceso en segundo plano.'));
    };
    worker.onerror = event => {
      activeWorkerJobs.delete(kind);
      worker.terminate();
      reject(new Error(event.message || 'Falló el procesamiento en segundo plano.'));
    };
    worker.postMessage({ kind, payload }, transfer);
  });

  const isSupportedImageFile = file => Boolean(file && (
    ALLOWED_IMAGE_TYPES.has(String(file.type || '').toLowerCase())
    || String(file.type || '').toLowerCase() === 'image/jpg'
    || ALLOWED_IMAGE_EXTENSION.test(file.name || '')
  ));

  const loadImageFile = (file, maxSide = 4500, internalTransfer = false) => new Promise((resolve, reject) => {
    if (!isSupportedImageFile(file)) return reject(new Error('Escogé una imagen PNG, JPG o WebP.'));
    if (!internalTransfer && file.size > MAX_FILE_SIZE) return reject(new Error('La imagen debe pesar 24 MB o menos.'));
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      const pixelLimit = internalTransfer ? MAX_INTERNAL_PIXELS : MAX_WORKING_PIXELS;
      const effectiveMaxSide = internalTransfer ? MAX_HALFTONE_SIDE : maxSide;
      const sideScale = effectiveMaxSide / Math.max(image.naturalWidth, image.naturalHeight);
      const pixelScale = Math.sqrt(pixelLimit / (image.naturalWidth * image.naturalHeight));
      const scale = Math.min(1, sideScale, pixelScale);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      resolve({
        image,
        width,
        height,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        sourceUrl: url,
        filename: file.name.replace(/\.[^.]+$/, '') || 'momotus'
      });
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer esa imagen.')); };
    image.src = url;
  });

  const drawSource = source => {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(source.image, 0, 0, source.width, source.height);
    return { imageData: context.getImageData(0, 0, source.width, source.height) };
  };

  const getLightweightState = (source, cacheName) => {
    const scale = Math.min(1, MAX_PREVIEW_SIDE / Math.max(source.width, source.height), Math.sqrt(MAX_PREVIEW_PIXELS / (source.width * source.height)));
    if (scale >= 0.999) return source;
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const cacheKey = `${cacheName}:${width}x${height}`;
    if (source.lightweightCache?.key === cacheKey) return source.lightweightCache.state;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source.image, 0, 0, width, height);
    const state = { ...source, width, height, imageData: context.getImageData(0, 0, width, height), isPreview: true };
    source.lightweightCache = { key: cacheKey, state };
    return state;
  };

  const fitPreviewStage = (type, intrinsicWidth, intrinsicHeight) => {
    const preview = byId(`${type}-preview`);
    const shell = preview?.closest('.tool-preview-shell');
    if (!preview || !shell || shell.clientWidth === 0 || shell.clientHeight === 0) return;

    const shellStyles = getComputedStyle(shell);
    const horizontalPadding = parseFloat(shellStyles.paddingLeft) + parseFloat(shellStyles.paddingRight);
    const verticalPadding = parseFloat(shellStyles.paddingTop) + parseFloat(shellStyles.paddingBottom);
    const toolbar = shell.querySelector('.tool-preview-toolbar');
    const transfers = shell.querySelector('.tool-transfer-actions');
    const resultStrip = shell.querySelector('.tool-result-strip');
    const toolbarHeight = Math.max(toolbar?.offsetHeight || 0, transfers?.offsetHeight || 0);
    const toolbarMargin = Math.max(
      toolbar ? parseFloat(getComputedStyle(toolbar).marginBottom) : 0,
      transfers ? parseFloat(getComputedStyle(transfers).marginBottom) : 0
    );
    const resultStripHeight = resultStrip?.offsetHeight || 0;
    const resultStripMargin = resultStrip ? parseFloat(getComputedStyle(resultStrip).marginBottom) || 0 : 0;
    const maximumWidth = Math.max(1, shell.clientWidth - horizontalPadding);
    const maximumHeight = Math.max(1, shell.clientHeight - verticalPadding - toolbarHeight - toolbarMargin - resultStripHeight - resultStripMargin);
    const stageWidth = maximumWidth;
    const stageHeight = maximumHeight;

    preview.style.setProperty('--preview-ratio', `${intrinsicWidth} / ${intrinsicHeight}`);
    preview.style.width = `${Math.max(1, Math.round(stageWidth))}px`;
    preview.style.height = `${Math.max(1, Math.round(stageHeight))}px`;
  };

  const detectPreviewContentBounds = (type, element, intrinsicWidth, intrinsicHeight) => {
    const cached = previewBoundsCache[type];
    const view = previewViews[type];
    if (cached?.element === element && cached.width === intrinsicWidth && cached.height === intrinsicHeight && cached.view === view) {
      return cached.bounds;
    }

    const fullBounds = { x: 0, y: 0, width: intrinsicWidth, height: intrinsicHeight };
    if (!states[type] || intrinsicWidth < 2 || intrinsicHeight < 2) return fullBounds;
    const maximumSampleSide = 420;
    const sampleScale = Math.min(1, maximumSampleSide / Math.max(intrinsicWidth, intrinsicHeight));
    const sampleWidth = Math.max(1, Math.round(intrinsicWidth * sampleScale));
    const sampleHeight = Math.max(1, Math.round(intrinsicHeight * sampleScale));
    const sample = document.createElement('canvas');
    sample.width = sampleWidth;
    sample.height = sampleHeight;
    const context = sample.getContext('2d', { willReadFrequently: true });
    const drawable = element instanceof HTMLImageElement && (!element.complete || !element.naturalWidth)
      ? states[type].image
      : element;

    try {
      context.drawImage(drawable, 0, 0, sampleWidth, sampleHeight);
      const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
      const cornerCoordinates = [
        [1, 1], [sampleWidth - 2, 1], [1, sampleHeight - 2], [sampleWidth - 2, sampleHeight - 2]
      ].map(([x, y]) => [Math.max(0, x), Math.max(0, y)]);
      const corners = cornerCoordinates.map(([x, y]) => {
        const index = (y * sampleWidth + x) * 4;
        return { r: pixels[index], g: pixels[index + 1], b: pixels[index + 2], a: pixels[index + 3] };
      });
      let closestPair = [corners[0], corners[1]];
      let closestDistance = Infinity;
      for (let first = 0; first < corners.length; first++) {
        for (let second = first + 1; second < corners.length; second++) {
          const colorDistance = perceptualColorDistance(corners[first].r, corners[first].g, corners[first].b, corners[second]);
          const alphaDistance = Math.abs(corners[first].a - corners[second].a) * 0.5;
          const distance = colorDistance + alphaDistance;
          if (distance < closestDistance) {
            closestDistance = distance;
            closestPair = [corners[first], corners[second]];
          }
        }
      }
      const background = {
        r: (closestPair[0].r + closestPair[1].r) / 2,
        g: (closestPair[0].g + closestPair[1].g) / 2,
        b: (closestPair[0].b + closestPair[1].b) / 2,
        a: (closestPair[0].a + closestPair[1].a) / 2
      };
      let left = sampleWidth, top = sampleHeight, right = -1, bottom = -1;
      for (let y = 0; y < sampleHeight; y++) {
        for (let x = 0; x < sampleWidth; x++) {
          const index = (y * sampleWidth + x) * 4;
          const alpha = pixels[index + 3];
          const differsFromBackground = background.a < 24
            ? alpha > 24
            : alpha > 18 && (
              Math.abs(alpha - background.a) > 30
              || perceptualColorDistance(pixels[index], pixels[index + 1], pixels[index + 2], background) > 26
            );
          if (!differsFromBackground) continue;
          if (x < left) left = x;
          if (x > right) right = x;
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
      }
      if (right >= left && bottom >= top) {
        const padding = Math.max(2, Math.round(Math.max(sampleWidth, sampleHeight) * 0.018));
        left = Math.max(0, left - padding);
        top = Math.max(0, top - padding);
        right = Math.min(sampleWidth - 1, right + padding);
        bottom = Math.min(sampleHeight - 1, bottom + padding);
        const detectedArea = (right - left + 1) * (bottom - top + 1);
        const fullArea = sampleWidth * sampleHeight;
        if (detectedArea >= fullArea * 0.015) {
          const bounds = {
            x: left / sampleWidth * intrinsicWidth,
            y: top / sampleHeight * intrinsicHeight,
            width: (right - left + 1) / sampleWidth * intrinsicWidth,
            height: (bottom - top + 1) / sampleHeight * intrinsicHeight
          };
          previewBoundsCache[type] = { element, width: intrinsicWidth, height: intrinsicHeight, view, bounds };
          return bounds;
        }
      }
    } catch (error) {
      console.warn('No se pudo calcular el área visible del diseño:', error);
    }

    previewBoundsCache[type] = { element, width: intrinsicWidth, height: intrinsicHeight, view, bounds: fullBounds };
    return fullBounds;
  };

  const applyPreviewZoom = type => {
    cancelAnimationFrame(previewZoomFrames[type]);
    previewZoomFrames[type] = requestAnimationFrame(() => {
      previewZoomFrames[type] = 0;
      const preview = byId(`${type}-preview`);
      const select = document.querySelector(`[data-preview-zoom="${type}"]`);
      const canvas = byId(`${type}-canvas`);
      const image = byId(`${type}-original`);
      if (!preview || !select || preview.clientWidth === 0 || preview.clientHeight === 0) return;

      const visibleElement = canvas && !canvas.hidden ? canvas : image;
      const stageWidth = states[type]
        ? (visibleElement instanceof HTMLCanvasElement ? visibleElement.width : (visibleElement?.naturalWidth || states[type].width))
        : 1320;
      const stageHeight = states[type]
        ? (visibleElement instanceof HTMLCanvasElement ? visibleElement.height : (visibleElement?.naturalHeight || states[type].height))
        : 2868;
      const contentBounds = detectPreviewContentBounds(type, visibleElement, stageWidth || 1320, stageHeight || 2868);
      const canvasBounds = { x: 0, y: 0, width: stageWidth || 1320, height: stageHeight || 2868 };
      const fittingBounds = select.value === 'canvas' ? canvasBounds : contentBounds;
      fitPreviewStage(type, fittingBounds.width, fittingBounds.height);

      const styles = getComputedStyle(preview);
      const availableWidth = Math.max(1, preview.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight));
      const availableHeight = Math.max(1, preview.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom));

      [canvas, image].forEach(element => {
        if (!element) return;
        const intrinsicWidth = element instanceof HTMLCanvasElement ? element.width : (element.naturalWidth || states[type]?.width || 1);
        const intrinsicHeight = element instanceof HTMLCanvasElement ? element.height : (element.naturalHeight || states[type]?.height || 1);
        const bounds = element === visibleElement
          ? fittingBounds
          : { x: 0, y: 0, width: intrinsicWidth, height: intrinsicHeight };
        const fittedScale = Math.min(availableWidth / bounds.width, availableHeight / bounds.height);
        let displayScale = fittedScale;
        if (select.value === 'detail') displayScale *= 1.55;
        else if (select.value === 'width') displayScale = availableWidth / intrinsicWidth;
        else if (select.value !== 'fit') displayScale = Math.max(0.1, Number(select.value) / 100 || 1);

        element.style.width = `${Math.max(1, Math.round(intrinsicWidth * displayScale))}px`;
        element.style.height = 'auto';
        element.style.maxWidth = 'none';
        element.style.maxHeight = 'none';
      });
      requestAnimationFrame(() => {
        const pannable = preview.scrollWidth > preview.clientWidth + 2 || preview.scrollHeight > preview.clientHeight + 2;
        preview.classList.toggle('is-pannable', pannable);
      });
    });
  };

  const showOriginal = type => {
    const state = states[type];
    if (!state) return;
    const image = byId(`${type}-original`);
    const canvas = byId(`${type}-canvas`);
    image.src = state.sourceUrl;
    image.hidden = false;
    canvas.hidden = byId(`${type}-preview`)?.classList.contains('compare-active') ? false : true;
    drawHistogram(type);
    applyPreviewZoom(type);
  };

  const showResult = type => {
    const image = byId(`${type}-original`);
    const canvas = byId(`${type}-canvas`);
    image.hidden = byId(`${type}-preview`)?.classList.contains('compare-active') ? false : true;
    canvas.hidden = false;
    if (canvas.width && canvas.height) drawHistogram(type, canvas);
    applyPreviewZoom(type);
  };

  const setComparePosition = (type, value) => {
    const percentage = `${Math.max(0, Math.min(100, Number(value) || 0))}%`;
    byId(`${type}-preview`)?.style.setProperty('--compare-position', percentage);
    document.querySelector(`[data-compare-control="${type}"]`)?.style.setProperty('--compare-position', percentage);
  };

  const deactivateCompare = type => {
    const preview = byId(`${type}-preview`);
    const control = document.querySelector(`[data-compare-control="${type}"]`);
    const button = document.querySelector(`[data-preview-compare="${type}"]`);
    preview?.classList.remove('compare-active');
    if (control) control.hidden = true;
    button?.classList.remove('active');
    button?.setAttribute('aria-pressed', 'false');
    const image = byId(`${type}-original`);
    const canvas = byId(`${type}-canvas`);
    if (image && canvas) {
      const original = previewViews[type] === 'original';
      image.hidden = !original;
      canvas.hidden = original;
    }
    applyPreviewZoom(type);
  };

  const activateCompare = async type => {
    if (!states[type]) return showToast('Primero subí una imagen.');
    try {
      await prepareTransferCanvas(type);
      previewViews[type] = 'result';
      updatePreviewButtons(type);
      const preview = byId(`${type}-preview`);
      const image = byId(`${type}-original`);
      const canvas = byId(`${type}-canvas`);
      const control = document.querySelector(`[data-compare-control="${type}"]`);
      const button = document.querySelector(`[data-preview-compare="${type}"]`);
      const range = document.querySelector(`[data-compare-range="${type}"]`);
      image.src = states[type].sourceUrl;
      image.hidden = false;
      canvas.hidden = false;
      preview.classList.add('compare-active');
      if (control) control.hidden = false;
      button?.classList.add('active');
      button?.setAttribute('aria-pressed', 'true');
      setComparePosition(type, range?.value || 50);
      applyPreviewZoom(type);
      centerPreview(type);
    } catch (error) {
      showToast(error.message || 'No se pudo preparar la comparación.');
    }
  };

  const setToolResultReady = (type, ready) => {
    document.querySelectorAll(`[data-transfer-from="${type}"]`).forEach(button => { button.disabled = !ready; });
    const compareToggle = document.querySelector(`[data-preview-compare="${type}"]`);
    if (compareToggle) compareToggle.disabled = !ready;
    if (!ready) deactivateCompare(type);
    window.dispatchEvent(new CustomEvent('momotus:result-ready', { detail: { type, ready } }));
  };

  const drawHistogram = (type, renderedCanvas = null) => {
    const state = states[type];
    const canvas = byId('editor-histogram');
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#09090b';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (!state) return;
    let imageData = renderedCanvas ? null : state.imageData;
    if (!imageData) {
      const sample = document.createElement('canvas');
      const sourceWidth = renderedCanvas?.width || state.naturalWidth;
      const sourceHeight = renderedCanvas?.height || state.naturalHeight;
      const scale = Math.min(1, 640 / Math.max(sourceWidth, sourceHeight));
      sample.width = Math.max(1, Math.round(sourceWidth * scale));
      sample.height = Math.max(1, Math.round(sourceHeight * scale));
      const sampleContext = sample.getContext('2d', { willReadFrequently: true });
      sampleContext.drawImage(renderedCanvas || state.image, 0, 0, sample.width, sample.height);
      imageData = sampleContext.getImageData(0, 0, sample.width, sample.height);
    }
    const bins = new Uint32Array(64);
    const data = imageData.data;
    const stride = Math.max(4, Math.floor(data.length / 400000 / 4) * 4);
    for (let index = 0; index < data.length; index += stride) {
      if (data[index + 3] === 0) continue;
      const luminance = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
      bins[Math.min(63, Math.floor(luminance / 4))]++;
    }
    const maximum = Math.max(1, ...bins);
    const barWidth = canvas.width / bins.length;
    context.fillStyle = '#facc15';
    bins.forEach((value, index) => {
      const height = value / maximum * (canvas.height - 4);
      context.fillRect(index * barWidth, canvas.height - height, Math.max(1, barWidth - 0.5), height);
    });
  };

  const updateDocumentInfo = type => {
    const state = states[type];
    const element = byId('editor-image-info');
    if (!element) return;
    if (!state) {
      element.textContent = 'Sin documento abierto';
      drawHistogram(type);
      return;
    }
    const width = state.naturalWidth || state.width;
    const height = state.naturalHeight || state.height;
    element.textContent = `${state.filename} · ${width} × ${height} px · ${(width / EXPORT_DPI * 2.54).toFixed(1)} × ${(height / EXPORT_DPI * 2.54).toFixed(1)} cm a 300 DPI`;
    drawHistogram(type);
  };

  const scheduleRender = (type, callback, delay = 90) => {
    if (!states[type]) return;
    markToolDirty(type);
    const pendingView = type === 'background' && previewViews.background === 'mask' ? 'mask' : 'result';
    clearTimeout(renderTimers[type]);
    setStatus(`${type}-status`, 'Actualizando vista previa…');
    renderTimers[type] = setTimeout(() => {
      previewViews[type] = pendingView;
      updatePreviewButtons(type);
      callback();
    }, delay);
  };

  const copyCanvas = source => {
    const output = document.createElement('canvas');
    output.width = source.width;
    output.height = source.height;
    output.getContext('2d').drawImage(source, 0, 0);
    return output;
  };

  const trimTransparentCanvas = source => {
    const context = source.getContext('2d', { willReadFrequently: true });
    const data = context.getImageData(0, 0, source.width, source.height).data;
    let left = source.width, top = source.height, right = -1, bottom = -1;
    for (let y = 0; y < source.height; y++) {
      for (let x = 0; x < source.width; x++) {
        if (data[(y * source.width + x) * 4 + 3] === 0) continue;
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
    if (right < left || bottom < top) return copyCanvas(source);
    const output = document.createElement('canvas');
    output.width = right - left + 1;
    output.height = bottom - top + 1;
    output.getContext('2d').drawImage(source, left, top, output.width, output.height, 0, 0, output.width, output.height);
    return output;
  };

  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let value = n;
      for (let bit = 0; bit < 8; bit++) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      table[n] = value >>> 0;
    }
    return table;
  })();

  const crc32 = bytes => {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };

  const createPngChunk = (type, data) => {
    const typeBytes = new TextEncoder().encode(type);
    const chunk = new Uint8Array(12 + data.length);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, data.length, false);
    chunk.set(typeBytes, 4);
    chunk.set(data, 8);
    const crcInput = new Uint8Array(typeBytes.length + data.length);
    crcInput.set(typeBytes);
    crcInput.set(data, typeBytes.length);
    view.setUint32(8 + data.length, crc32(crcInput), false);
    return chunk;
  };

  const add300DpiMetadata = pngBytes => {
    const signature = pngBytes.slice(0, 8);
    const density = new Uint8Array(9);
    const densityView = new DataView(density.buffer);
    densityView.setUint32(0, PIXELS_PER_METER_300_DPI, false);
    densityView.setUint32(4, PIXELS_PER_METER_300_DPI, false);
    density[8] = 1;
    const physicalChunk = createPngChunk('pHYs', density);
    const parts = [signature];
    let offset = 8;
    while (offset + 12 <= pngBytes.length) {
      const length = new DataView(pngBytes.buffer, pngBytes.byteOffset + offset, 4).getUint32(0, false);
      const end = offset + 12 + length;
      if (end > pngBytes.length) break;
      const type = String.fromCharCode(...pngBytes.slice(offset + 4, offset + 8));
      if (type !== 'pHYs') parts.push(pngBytes.slice(offset, end));
      if (type === 'IHDR') parts.push(physicalChunk);
      if (type === 'IEND') break;
      offset = end;
    }
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let position = 0;
    for (const part of parts) { output.set(part, position); position += part.length; }
    return output;
  };

  const prepareBinaryAlphaCanvas = async canvas => {
    const sourceContext = canvas.getContext('2d', { willReadFrequently: true });
    const thresholdMatrix = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const tileHeight = 256;
    let output = null;
    let outputContext = null;
    let hasPartialAlpha = false;
    for (let top = 0; top < canvas.height; top += tileHeight) {
      const height = Math.min(tileHeight, canvas.height - top);
      const imageData = sourceContext.getImageData(0, top, canvas.width, height);
      const data = imageData.data;
      let tileChanged = false;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const index = (y * canvas.width + x) * 4;
          const alpha = data[index + 3];
          if (alpha === 0 || alpha === 255) continue;
          hasPartialAlpha = true;
          tileChanged = true;
          const threshold = (thresholdMatrix[((top + y) % 4) * 4 + (x % 4)] + 0.5) / 16 * 255;
          data[index + 3] = alpha >= threshold ? 255 : 0;
          if (data[index + 3] === 0) data[index] = data[index + 1] = data[index + 2] = 0;
        }
      }
      if (tileChanged) {
        if (!output) {
          output = document.createElement('canvas');
          output.width = canvas.width;
          output.height = canvas.height;
          outputContext = output.getContext('2d');
          outputContext.drawImage(canvas, 0, 0);
        }
        outputContext.putImageData(imageData, 0, top);
      }
      if (top > 0 && top % (tileHeight * 4) === 0) await nextFrame();
    }
    if (!hasPartialAlpha) return canvas;
    return output;
  };

  const downloadCanvas = async (canvas, filename) => {
    let exportCanvas;
    try {
      exportCanvas = await prepareBinaryAlphaCanvas(canvas);
    } catch (error) {
      console.error('No se pudo limpiar la transparencia del PNG:', error);
      showToast('No se pudo preparar la transparencia para descargar.');
      return;
    }
    exportCanvas.toBlob(async blob => {
      if (!blob) return showToast('No se pudo preparar la descarga.');
      try {
        const png300Dpi = add300DpiMetadata(new Uint8Array(await blob.arrayBuffer()));
        const outputBlob = new Blob([png300Dpi], { type: 'image/png' });
        const url = URL.createObjectURL(outputBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) {
        console.error('No se pudo preparar el PNG a 300 DPI:', error);
        showToast('No se pudo preparar la descarga.');
      }
    }, 'image/png');
  };

  const analyzeCanvasAlpha = canvas => {
    const sample = document.createElement('canvas');
    const scale = Math.min(1, 420 / Math.max(canvas.width, canvas.height));
    sample.width = Math.max(1, Math.round(canvas.width * scale));
    sample.height = Math.max(1, Math.round(canvas.height * scale));
    const context = sample.getContext('2d', { willReadFrequently: true });
    context.drawImage(canvas, 0, 0, sample.width, sample.height);
    const data = context.getImageData(0, 0, sample.width, sample.height).data;
    let transparent = 0;
    let partial = 0;
    let opaque = 0;
    let edgePixels = 0;
    let lightFringePixels = 0;
    for (let y = 0; y < sample.height; y++) {
      for (let x = 0; x < sample.width; x++) {
        const index = (y * sample.width + x) * 4;
        const alpha = data[index + 3];
        if (alpha === 0) transparent++;
        else if (alpha === 255) opaque++;
        else partial++;
        if (alpha === 0) continue;
        const touchesTransparency = (x > 0 && data[index - 1] === 0)
          || (x + 1 < sample.width && data[index + 7] === 0)
          || (y > 0 && data[index - sample.width * 4 + 3] === 0)
          || (y + 1 < sample.height && data[index + sample.width * 4 + 3] === 0);
        if (!touchesTransparency) continue;
        edgePixels++;
        const maximum = Math.max(data[index], data[index + 1], data[index + 2]);
        const minimum = Math.min(data[index], data[index + 1], data[index + 2]);
        const luminance = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
        if (maximum - minimum < 28 && luminance > 218) lightFringePixels++;
      }
    }
    return { transparent, partial, opaque, edgePixels, lightFringePixels, total: transparent + partial + opaque };
  };

  const buildPreflightChecks = (type, canvas) => {
    const state = states[type];
    const checks = [];
    const widthCm = canvas.width / EXPORT_DPI * 2.54;
    const heightCm = canvas.height / EXPORT_DPI * 2.54;
    checks.push({ level: 'good', message: `${canvas.width} × ${canvas.height} px · ${widthCm.toFixed(1)} × ${heightCm.toFixed(1)} cm al tamaño final.` });
    checks.push({ level: 'good', message: 'El PNG llevará metadatos de 300 DPI compatibles con el flujo DTF.' });
    const alpha = analyzeCanvasAlpha(canvas);
    const transparentPercentage = alpha.total ? alpha.transparent / alpha.total * 100 : 0;
    if (transparentPercentage > 0.05) checks.push({ level: 'good', message: `Fondo transparente detectado (${transparentPercentage.toFixed(1)}% de la muestra).` });
    else if (type === 'background') checks.push({ level: 'warning', message: 'No se detectó transparencia. Revisá el color, la tolerancia y el alcance antes de imprimir.' });
    else checks.push({ level: 'good', message: 'La imagen ocupa todo el lienzo; verificá que ese fondo completo sea intencional.' });
    const partialPercentage = alpha.total ? alpha.partial / alpha.total * 100 : 0;
    if (partialPercentage > 0.3) checks.push({ level: 'warning', message: `${partialPercentage.toFixed(2)}% de píxeles semitransparentes. La descarga los convertirá a transparencia sólida mediante tramado.` });
    else if (alpha.partial > 0) checks.push({ level: 'good', message: 'Las pocas semitransparencias detectadas se convertirán a píxeles sólidos mediante tramado.' });
    else checks.push({ level: 'good', message: 'No se detectaron semitransparencias problemáticas.' });
    const fringePercentage = alpha.edgePixels ? alpha.lightFringePixels / alpha.edgePixels * 100 : 0;
    if (fringePercentage > 18) checks.push({ level: 'warning', message: `Posible borde claro en ${fringePercentage.toFixed(1)}% del contorno. Revisalo sobre una prenda oscura antes de producir.` });
    else checks.push({ level: 'good', message: 'El contorno no muestra contaminación clara importante en la muestra analizada.' });

    let sourceDpi = null;
    let safetyLimited = false;
    if (type === 'halftone') {
      const requestedWidthCm = Number(byId('halftone-width-cm').value) || 28;
      sourceDpi = Math.round(state.naturalWidth / (requestedWidthCm / 2.54));
      safetyLimited = Boolean(state.halftoneOutputCache?.safetyLimited);
      const frequency = Number(byId('halftone-frequency').value);
      const dotSize = Number(byId('halftone-dot-size').value);
      const minimumDot = Number(byId('halftone-min-dot').value);
      const dotGain = Number(byId('halftone-dot-gain').value);
      checks.push({
        level: frequency >= 45 && frequency <= 70 && dotSize >= 0.28 && dotSize <= 0.6 && minimumDot <= dotSize ? 'good' : 'warning',
        message: `${frequency} LPI · punto ${minimumDot.toFixed(2)}–${dotSize.toFixed(2)} mm · ganancia ${dotGain >= 0 ? '+' : ''}${dotGain}%. ${frequency >= 45 && frequency <= 70 && minimumDot <= dotSize ? 'Trama dentro del rango configurado para DTF.' : 'Revisá la frecuencia y los límites del punto antes de producir.'}`
      });
    } else if (type === 'quality') {
      sourceDpi = state.lastOutput?.sourceDpi;
      safetyLimited = Boolean(state.lastOutput?.safetyLimited);
    }
    if (sourceDpi !== null && Number.isFinite(sourceDpi)) {
      const level = sourceDpi >= 300 ? 'good' : sourceDpi >= 180 ? 'warning' : 'error';
      const explanation = sourceDpi >= 300
        ? 'La resolución original alcanza el tamaño escogido.'
        : sourceDpi >= 180 ? 'Puede funcionar, pero revisá texto y bordes al 100%.' : 'La fuente tiene poco detalle real; ampliar no recupera información perdida.';
      checks.push({ level, message: `${sourceDpi} DPI efectivos de origen. ${explanation}` });
    }
    if (safetyLimited) checks.push({ level: 'warning', message: 'El tamaño solicitado fue reducido para proteger la memoria. Confirmá la medida indicada arriba.' });
    return checks;
  };

  const closePreflight = () => {
    byId('dtf-preflight-modal').hidden = true;
    pendingPreflightDownload = null;
  };

  const openPreflight = (type, canvas, filename) => {
    const checks = buildPreflightChecks(type, canvas);
    const errors = checks.filter(check => check.level === 'error').length;
    const warnings = checks.filter(check => check.level === 'warning').length;
    const summary = byId('dtf-preflight-summary');
    summary.className = `dtf-preflight-summary${errors ? ' error' : warnings ? ' warning' : ''}`;
    summary.textContent = errors
      ? `${errors} punto crítico y ${warnings} aviso(s). Podés descargar, pero conviene ajustar primero.`
      : warnings ? `Archivo preparado con ${warnings} aviso(s) para revisar.` : 'Archivo verificado y preparado para continuar al flujo DTF.';
    const list = byId('dtf-preflight-list');
    list.replaceChildren(...checks.map(check => {
      const item = document.createElement('li');
      item.className = check.level;
      const icon = document.createElement('i');
      icon.className = `fa-solid ${check.level === 'good' ? 'fa-circle-check' : check.level === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-xmark'}`;
      const message = document.createElement('span');
      message.textContent = check.message;
      item.append(icon, message);
      return item;
    }));
    pendingPreflightDownload = { canvas, filename };
    const exportName = byId('dtf-export-name');
    if (exportName) exportName.value = filename.replace(/\.png$/i, '');
    const exportPreview = byId('dtf-export-preview-canvas');
    if (exportPreview) {
      const previewContext = exportPreview.getContext('2d');
      previewContext.clearRect(0, 0, exportPreview.width, exportPreview.height);
      const scale = Math.min(exportPreview.width / canvas.width, exportPreview.height / canvas.height);
      const width = Math.max(1, canvas.width * scale);
      const height = Math.max(1, canvas.height * scale);
      previewContext.drawImage(canvas, (exportPreview.width - width) / 2, (exportPreview.height - height) / 2, width, height);
    }
    byId('dtf-preflight-download').innerHTML = `<i class="fa-solid fa-download"></i> ${errors ? 'Descargar de todas formas' : 'Descargar PNG listo'}`;
    byId('dtf-preflight-modal').hidden = false;
    byId('dtf-preflight-close').focus();
  };

  const drawHalftoneShape = (context, shape, x, y, radius, angle) => {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.beginPath();
    if (shape === 'square') context.rect(-radius, -radius, radius * 2, radius * 2);
    else if (shape === 'diamond') {
      context.moveTo(0, -radius * 1.35); context.lineTo(radius * 1.35, 0);
      context.lineTo(0, radius * 1.35); context.lineTo(-radius * 1.35, 0); context.closePath();
    } else if (shape === 'line') context.rect(-radius * 1.45, -Math.max(0.55, radius * 0.38), radius * 2.9, Math.max(1.1, radius * 0.76));
    else if (shape === 'ellipse') context.ellipse(0, 0, radius * 1.2, radius * 0.72, 0, 0, Math.PI * 2);
    else context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  };

  const sampleHalftoneCell = (state, x, y, cellSize) => {
    const data = state.imageData.data;
    const radius = Math.max(1, cellSize * 0.34);
    let red = 0, green = 0, blue = 0;
    let redSquared = 0, greenSquared = 0, blueSquared = 0;
    let alpha = 0, samples = 0;
    for (let row = -1; row <= 1; row++) {
      for (let column = -1; column <= 1; column++) {
        const sampleX = Math.min(state.width - 1, Math.max(0, Math.round(x + column * radius)));
        const sampleY = Math.min(state.height - 1, Math.max(0, Math.round(y + row * radius)));
        const index = (sampleY * state.width + sampleX) * 4;
        const pixelAlpha = data[index + 3] / 255;
        red += data[index] * pixelAlpha;
        green += data[index + 1] * pixelAlpha;
        blue += data[index + 2] * pixelAlpha;
        redSquared += data[index] * data[index] * pixelAlpha;
        greenSquared += data[index + 1] * data[index + 1] * pixelAlpha;
        blueSquared += data[index + 2] * data[index + 2] * pixelAlpha;
        alpha += pixelAlpha;
        samples++;
      }
    }
    const averageRed = alpha > 0 ? red / alpha : 0;
    const averageGreen = alpha > 0 ? green / alpha : 0;
    const averageBlue = alpha > 0 ? blue / alpha : 0;
    const channelVariance = alpha > 0
      ? Math.max(0,
        redSquared / alpha - averageRed * averageRed
        + greenSquared / alpha - averageGreen * averageGreen
        + blueSquared / alpha - averageBlue * averageBlue) / 3
      : 0;
    return {
      r: averageRed,
      g: averageGreen,
      b: averageBlue,
      a: alpha / samples,
      variation: Math.sqrt(channelVariance)
    };
  };

  const clampUnit = value => Math.max(0, Math.min(1, value));
  const clampNumber = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const getHueAndSaturation = (red, green, blue) => {
    const r = red / 255, g = green / 255, b = blue / 255;
    const maximum = Math.max(r, g, b), minimum = Math.min(r, g, b);
    const delta = maximum - minimum;
    let hue = 0;
    if (delta > 0) {
      if (maximum === r) hue = 60 * (((g - b) / delta) % 6);
      else if (maximum === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
    }
    if (hue < 0) hue += 360;
    return { hue, saturation: maximum === 0 ? 0 : delta / maximum };
  };

  const analyzeHalftoneColors = state => {
    if (state.halftoneColorStats) return state.halftoneColorStats;
    const data = state.imageData.data;
    const width = state.imageData.width;
    const height = state.imageData.height;
    const cornerIndexes = [0, width - 1, (height - 1) * width, height * width - 1];
    const corners = cornerIndexes.map(pixel => ({
      r: data[pixel * 4], g: data[pixel * 4 + 1], b: data[pixel * 4 + 2], a: data[pixel * 4 + 3]
    }));
    let background = null;
    let closestDistance = Infinity;
    for (let first = 0; first < corners.length; first++) {
      for (let second = first + 1; second < corners.length; second++) {
        const distance = perceptualColorDistance(corners[first].r, corners[first].g, corners[first].b, corners[second]);
        if (distance < closestDistance && corners[first].a > 32 && corners[second].a > 32) {
          closestDistance = distance;
          background = {
            r: (corners[first].r + corners[second].r) / 2,
            g: (corners[first].g + corners[second].g) / 2,
            b: (corners[first].b + corners[second].b) / 2
          };
        }
      }
    }
    if (closestDistance > 24) background = null;
    const pixelCount = width * height;
    const step = Math.max(1, Math.floor(pixelCount / 60000));
    const collect = excludeBackground => {
      let samples = 0, shadows = 0, midtones = 0, highlights = 0, colorful = 0, neutral = 0;
      let luminanceTotal = 0, luminanceSquared = 0, saturationTotal = 0;
      const hueBins = new Uint32Array(12);
      for (let pixel = 0; pixel < pixelCount; pixel += step) {
        const index = pixel * 4;
        const alpha = data[index + 3];
        if (alpha < 32) continue;
        const red = data[index], green = data[index + 1], blue = data[index + 2];
        if (excludeBackground && background && perceptualColorDistance(red, green, blue, background) < 18) continue;
        const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        const color = getHueAndSaturation(red, green, blue);
        const saturation = color.saturation * 255;
        samples++;
        luminanceTotal += luminance;
        luminanceSquared += luminance * luminance;
        saturationTotal += saturation;
        if (color.saturation >= 0.18) {
          colorful++;
          hueBins[Math.min(11, Math.floor(color.hue / 30))]++;
        } else neutral++;
        if (luminance < 85) shadows++;
        else if (luminance > 180) highlights++;
        else midtones++;
      }
      return { samples, shadows, midtones, highlights, colorful, neutral, luminanceTotal, luminanceSquared, saturationTotal, hueBins };
    };
    const allOpaque = collect(false);
    let analysis = background ? collect(true) : allOpaque;
    if (analysis.samples < Math.max(16, allOpaque.samples * 0.05)) analysis = allOpaque;
    let { samples, shadows, midtones, highlights, colorful, neutral, luminanceTotal, luminanceSquared, saturationTotal, hueBins } = analysis;
    if (!samples) samples = 1;
    const mean = luminanceTotal / samples;
    const spread = Math.sqrt(Math.max(0, luminanceSquared / samples - mean * mean));
    let dominantHueBin = 0;
    for (let index = 1; index < hueBins.length; index++) {
      if (hueBins[index] > hueBins[dominantHueBin]) dominantHueBin = index;
    }
    state.halftoneColorStats = {
      shadows: shadows / samples,
      midtones: midtones / samples,
      highlights: highlights / samples,
      spread,
      saturation: saturationTotal / samples,
      colorful: colorful / samples,
      neutral: neutral / samples,
      dominantHue: dominantHueBin * 30 + 15,
      dominantRatio: colorful ? hueBins[dominantHueBin] / colorful : 0
    };
    return state.halftoneColorStats;
  };

  const buildAutomaticHalftonePreset = (state, requestedRange) => {
    const stats = analyzeHalftoneColors(state);
    let range = requestedRange;
    let hueRange = 'all';
    if (['dominant', 'vivid', 'neutral'].includes(requestedRange)) {
      hueRange = requestedRange;
      range = requestedRange === 'neutral' ? 'transitions' : 'midtones';
    }
    if (requestedRange === 'dominant' && stats.colorful < 0.08) hueRange = 'neutral';
    if (range === 'smart') {
      if (stats.shadows >= 0.46) range = 'shadows';
      else if (stats.highlights >= 0.48) range = 'highlights';
      else if (stats.midtones >= 0.5) range = 'midtones';
      else range = 'transitions';
      if (stats.neutral >= 0.82) hueRange = 'neutral';
    }
    const baseAmount = { shadows: 42, midtones: 48, highlights: 38, transitions: 54 }[range] || 50;
    const frequency = clampNumber(Math.round(48 + stats.spread / 7 + stats.saturation / 30), 45, 70);
    const protection = clampNumber(Math.round(72 + stats.saturation / 3.2), 72, 92);
    const dotSize = frequency >= 64 ? 0.30 : frequency >= 57 ? 0.35 : 0.40;
    return {
      range,
      amount: clampNumber(Math.round(baseAmount + (stats.spread < 42 ? 5 : 0)), 25, 68),
      protection,
      frequency,
      dotSize,
      angle: 45,
      shape: range === 'highlights' ? 'ellipse' : 'circle',
      contrast: clampNumber(Math.round(8 + (stats.spread - 35) / 4), 6, 24),
      keepSolids: true,
      hueRange
    };
  };

  const applyHalftonePreset = (preset, button) => {
    byId('halftone-range').value = preset.range;
    byId('halftone-hue-range').value = preset.hueRange || 'all';
    byId('halftone-amount').value = preset.amount;
    byId('halftone-solid-protection').value = preset.protection;
    if (Number.isFinite(preset.edgeProtection)) byId('halftone-edge-protection').value = preset.edgeProtection;
    byId('halftone-frequency').value = preset.frequency;
    byId('halftone-dot-size').value = preset.dotSize;
    byId('halftone-angle').value = preset.angle;
    byId('halftone-shape').value = preset.shape;
    byId('halftone-contrast').value = preset.contrast;
    if (typeof preset.keepSolids === 'boolean') byId('halftone-keep-solids').checked = preset.keepSolids;
    syncSettingLabels('halftone');
    document.querySelectorAll('[data-halftone-preset], [data-halftone-auto]').forEach(item => item.classList.toggle('active', item === button));
    scheduleRender('halftone', renderHalftone, 0);
    recordHistory('halftone');
  };

  const halftoneColorStrength = (hueRange, red, green, blue, stats) => {
    if (hueRange === 'all') return 1;
    const color = getHueAndSaturation(red, green, blue);
    if (hueRange === 'neutral') return clampUnit((0.32 - color.saturation) / 0.18);
    if (hueRange === 'vivid') return clampUnit((color.saturation - 0.12) / 0.35);
    if (color.saturation < 0.08) return 0;
    const centers = { reds: 0, oranges: 30, yellows: 60, greens: 120, cyans: 180, blues: 225, purples: 300 };
    const targetHue = hueRange === 'dominant' ? stats.dominantHue : centers[hueRange];
    if (!Number.isFinite(targetHue)) return 1;
    const distance = Math.min(Math.abs(color.hue - targetHue), 360 - Math.abs(color.hue - targetHue));
    return clampUnit((65 - distance) / 35) * clampUnit(color.saturation / 0.22);
  };

  const halftoneSelectionStrength = (range, luminance, variation, protection, edgeProtection, amount, colorStrength = 1) => {
    const shadowWeight = clampUnit((175 - luminance) / 145);
    const highlightWeight = clampUnit((luminance - 80) / 155);
    const midtoneWeight = clampUnit(1 - Math.abs(luminance - 128) / 105);
    const detailWeight = clampUnit((variation - 3) / 40);
    let rangeWeight = 1;
    if (range === 'transitions') rangeWeight = Math.max(detailWeight, shadowWeight * 0.35);
    else if (range === 'shadows') rangeWeight = shadowWeight;
    else if (range === 'midtones') rangeWeight = midtoneWeight;
    else if (range === 'highlights') rangeWeight = highlightWeight;
    const solidProtection = (1 - protection) + protection * Math.max(0.15, detailWeight);
    const fineDetailProtection = 1 - edgeProtection * clampUnit((variation - 18) / 55) * 0.72;
    return clampUnit(rangeWeight * solidProtection * fineDetailProtection * amount * colorStrength);
  };

  const halftoneGridThreshold = (gridX, gridY) => {
    const matrix = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const column = ((gridX % 4) + 4) % 4;
    const row = ((gridY % 4) + 4) % 4;
    return (matrix[row * 4 + column] + 0.5) / 16;
  };

  const clearHalftoneCell = (context, x, y, cellSize, angle) => {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    const side = cellSize * 1.035;
    context.clearRect(-side / 2, -side / 2, side, side);
    context.restore();
  };

  const prepareHalftoneOutput = (source, requestedWidthCm, finalOutput = false) => {
    const requestedWidth = Math.round(requestedWidthCm / 2.54 * EXPORT_DPI);
    const requestedHeight = Math.round(requestedWidth * source.naturalHeight / source.naturalWidth);
    const safetyScale = Math.min(
      1,
      MAX_HALFTONE_SIDE / Math.max(requestedWidth, requestedHeight),
      Math.sqrt(MAX_HALFTONE_PIXELS / (requestedWidth * requestedHeight))
    );
    const fullWidth = Math.max(1, Math.round(requestedWidth * safetyScale));
    const fullHeight = Math.max(1, Math.round(requestedHeight * safetyScale));
    const previewScale = finalOutput ? 1 : Math.min(1, MAX_PREVIEW_SIDE / Math.max(fullWidth, fullHeight), Math.sqrt(MAX_PREVIEW_PIXELS / (fullWidth * fullHeight)));
    const width = Math.max(1, Math.round(fullWidth * previewScale));
    const height = Math.max(1, Math.round(fullHeight * previewScale));
    const cacheKey = `${finalOutput ? 'final' : 'preview'}:${width}x${height}`;
    source.halftoneOutputCaches ||= {};
    if (source.halftoneOutputCaches[cacheKey]) return source.halftoneOutputCaches[cacheKey];
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
    sourceContext.imageSmoothingEnabled = true;
    sourceContext.imageSmoothingQuality = 'high';
    sourceContext.drawImage(source.image, 0, 0, width, height);
    const output = {
      key: cacheKey,
      width,
      height,
      actualWidthCm: fullWidth / EXPORT_DPI * 2.54,
      actualHeightCm: fullHeight / EXPORT_DPI * 2.54,
      effectiveDpi: width / (fullWidth / EXPORT_DPI),
      isPreview: !finalOutput && previewScale < 0.999,
      safetyLimited: safetyScale < 0.999,
      imageData: sourceContext.getImageData(0, 0, width, height)
    };
    source.halftoneOutputCaches[cacheKey] = output;
    if (finalOutput) source.halftoneOutputCache = output;
    return output;
  };

  const estimateHalftoneBackground = (state, cellSize) => {
    const margin = Math.max(1, cellSize * 0.55);
    const corners = [
      sampleHalftoneCell(state, margin, margin, cellSize),
      sampleHalftoneCell(state, state.width - margin, margin, cellSize),
      sampleHalftoneCell(state, margin, state.height - margin, cellSize),
      sampleHalftoneCell(state, state.width - margin, state.height - margin, cellSize)
    ].filter(sample => sample.a > 0.25);
    if (corners.length < 2) return null;
    let closestPair = [corners[0], corners[1]];
    let closestDistance = Infinity;
    for (let first = 0; first < corners.length; first++) {
      for (let second = first + 1; second < corners.length; second++) {
        const distance = perceptualColorDistance(corners[first].r, corners[first].g, corners[first].b, corners[second]);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestPair = [corners[first], corners[second]];
        }
      }
    }
    return {
      r: (closestPair[0].r + closestPair[1].r) / 2,
      g: (closestPair[0].g + closestPair[1].g) / 2,
      b: (closestPair[0].b + closestPair[1].b) / 2
    };
  };

  const getHalftoneBackgroundMask = async (state, cellSize, tolerance, mode, isCancelled = () => false) => {
    if (mode !== 'edge') return null;
    const cacheKey = `${cellSize.toFixed(3)}:${tolerance}`;
    if (state.halftoneMaskCache?.key === cacheKey) return state.halftoneMaskCache;
    const columns = Math.ceil(state.width / cellSize);
    const rows = Math.ceil(state.height / cellSize);
    const count = columns * rows;
    const candidates = new Uint8Array(count);
    const background = new Uint8Array(count);
    const target = estimateHalftoneBackground(state, cellSize);

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const sample = sampleHalftoneCell(state, (column + 0.5) * cellSize, (row + 0.5) * cellSize, cellSize);
        const transparent = sample.a < 0.08;
        const matchesEdgeColor = target && sample.a > 0.2
          && perceptualColorDistance(sample.r, sample.g, sample.b, target) <= tolerance;
        candidates[row * columns + column] = transparent || matchesEdgeColor ? 1 : 0;
      }
      if (row > 0 && row % 36 === 0) {
        await nextFrame();
        if (isCancelled()) return null;
      }
    }

    const queue = new Int32Array(count);
    let queueStart = 0;
    let queueEnd = 0;
    const enqueue = index => {
      if (!candidates[index] || background[index]) return;
      background[index] = 1;
      queue[queueEnd++] = index;
    };
    for (let column = 0; column < columns; column++) {
      enqueue(column);
      enqueue((rows - 1) * columns + column);
    }
    for (let row = 1; row < rows - 1; row++) {
      enqueue(row * columns);
      enqueue(row * columns + columns - 1);
    }
    while (queueStart < queueEnd) {
      const index = queue[queueStart++];
      const row = Math.floor(index / columns);
      const column = index - row * columns;
      if (column > 0) enqueue(index - 1);
      if (column + 1 < columns) enqueue(index + 1);
      if (row > 0) enqueue(index - columns);
      if (row + 1 < rows) enqueue(index + columns);
      if (queueStart % 120000 === 0) {
        await nextFrame();
        if (isCancelled()) return null;
      }
    }
    state.halftoneMaskCache = { key: cacheKey, background, columns, rows };
    return state.halftoneMaskCache;
  };

  const renderHalftone = async (finalOutput = false) => {
    const sourceState = states.halftone;
    if (!sourceState) return;
    const renderRevision = ++halftoneRenderRevision;
    previewViews.halftone = 'result';
    updatePreviewButtons('halftone');
    showResult('halftone');
    const canvas = byId('halftone-canvas');
    const context = canvas.getContext('2d');
    const requestedWidthCm = Math.max(8, Math.min(38, Number(byId('halftone-width-cm').value) || 28));
    byId('halftone-width-cm').value = String(requestedWidthCm);
    setStatus('halftone-status', 'Preparando la imagen para el semitono…');
    setProcessingProgress('halftone', 3, finalOutput ? 'Preparando salida completa…' : 'Creando vista rápida…');
    await nextFrame();
    if (renderRevision !== halftoneRenderRevision || sourceState !== states.halftone) return false;
    const state = prepareHalftoneOutput(sourceState, requestedWidthCm, finalOutput);
    const frequency = Number(byId('halftone-frequency').value);
    const cellSize = state.effectiveDpi / frequency;
    const maximumDotMm = Number(byId('halftone-dot-size').value);
    const maximumDotRadius = maximumDotMm / 25.4 * state.effectiveDpi / 2;
    const minimumDotMm = Number(byId('halftone-min-dot').value);
    const minimumDotRadius = minimumDotMm / 25.4 * state.effectiveDpi / 2;
    const dotGain = Number(byId('halftone-dot-gain').value) / 100;
    const angleDegrees = Number(byId('halftone-angle').value);
    const angle = angleDegrees * Math.PI / 180;
    const contrast = Number(byId('halftone-contrast').value);
    const invert = byId('halftone-invert').checked;
    const transparent = byId('halftone-transparent').checked;
    const shape = byId('halftone-shape').value;
    const colorMode = byId('halftone-mode').value;
    const maskMode = byId('halftone-mask-mode').value;
    const maskTolerance = Number(byId('halftone-mask-tolerance').value);
    const tonalRange = byId('halftone-range').value;
    const hueRange = byId('halftone-hue-range').value;
    const amount = Number(byId('halftone-amount').value) / 100;
    const solidProtection = Number(byId('halftone-solid-protection').value) / 100;
    const edgeProtection = Number(byId('halftone-edge-protection').value) / 100;
    const keepSolids = byId('halftone-keep-solids').checked;
    const inkColor = byId('halftone-color').value;
    const backgroundColor = byId('halftone-background-color').value;
    const renderKey = JSON.stringify({
      requestedWidthCm, frequency, maximumDotMm, minimumDotMm, dotGain, angleDegrees, contrast, invert, transparent,
      shape, colorMode, maskMode, maskTolerance, tonalRange, hueRange, amount, solidProtection, edgeProtection,
      keepSolids, inkColor, backgroundColor, finalOutput
    });
    const renderKeyName = finalOutput ? 'halftoneRenderKeyFinal' : 'halftoneRenderKeyPreview';
    const statusName = finalOutput ? 'halftoneStatusFinal' : 'halftoneStatusPreview';
    if (sourceState[renderKeyName] === renderKey && canvas.width === state.width && canvas.height === state.height) {
      setToolResultReady('halftone', true);
      markToolClean('halftone');
      if (sourceState[statusName]) setStatus('halftone-status', sourceState[statusName]);
      applyPreviewZoom('halftone');
      centerPreview('halftone');
      return true;
    }
    setStatus('halftone-status', 'Generando semitono profesional…');
    setProcessingProgress('halftone', 12, 'Analizando color y máscara…');
    await nextFrame();
    if (renderRevision !== halftoneRenderRevision || sourceState !== states.halftone) return false;
    const workCanvas = document.createElement('canvas');
    workCanvas.width = state.width;
    workCanvas.height = state.height;
    const workContext = workCanvas.getContext('2d');
    if (keepSolids) workContext.putImageData(state.imageData, 0, 0);
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const centerX = state.width / 2, centerY = state.height / 2;
    const diagonal = Math.hypot(state.width, state.height);
    const backgroundMask = await getHalftoneBackgroundMask(
      state,
      cellSize,
      maskTolerance,
      maskMode,
      () => renderRevision !== halftoneRenderRevision || sourceState !== states.halftone
    );
    if (renderRevision !== halftoneRenderRevision || sourceState !== states.halftone) return false;
    setProcessingProgress('halftone', 25, 'Construyendo la trama…');
    const colorStats = analyzeHalftoneColors(sourceState);
    let gridRow = 0;
    const totalGridRows = Math.max(1, Math.ceil(diagonal / cellSize) + 1);
    for (let gridY = -diagonal / 2; gridY <= diagonal / 2; gridY += cellSize, gridRow++) {
      let gridColumn = 0;
      for (let gridX = -diagonal / 2; gridX <= diagonal / 2; gridX += cellSize, gridColumn++) {
        const x = centerX + gridX * cosine - gridY * sine;
        const y = centerY + gridX * sine + gridY * cosine;
        if (x < 0 || y < 0 || x >= state.width || y >= state.height) continue;
        if (backgroundMask) {
          const maskColumn = Math.min(backgroundMask.columns - 1, Math.floor(x / cellSize));
          const maskRow = Math.min(backgroundMask.rows - 1, Math.floor(y / cellSize));
          if (backgroundMask.background[maskRow * backgroundMask.columns + maskColumn]) {
            if (keepSolids) clearHalftoneCell(workContext, x, y, cellSize, angle);
            continue;
          }
        }
        const sample = sampleHalftoneCell(state, x, y, cellSize);
        if (sample.a < 0.015) continue;
        const red = Math.max(0, Math.min(255, factor * (sample.r - 128) + 128));
        const green = Math.max(0, Math.min(255, factor * (sample.g - 128) + 128));
        const blue = Math.max(0, Math.min(255, factor * (sample.b - 128) + 128));
        const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
        const colorStrength = halftoneColorStrength(hueRange, red, green, blue, colorStats);
        const selectionStrength = halftoneSelectionStrength(tonalRange, luminance, sample.variation, solidProtection, edgeProtection, amount, colorStrength);
        if (selectionStrength < halftoneGridThreshold(gridColumn, gridRow)) continue;
        const tone = invert ? luminance / 255 : 1 - luminance / 255;
        const baseCoverage = colorMode === 'original' ? Math.max(0.18, tone) : tone;
        const coverage = Math.max(0, Math.min(1, baseCoverage + dotGain));
        const calculatedRadius = cellSize * 0.46 * Math.sqrt(Math.max(0, coverage * sample.a));
        const radius = coverage > 0.005 ? Math.min(maximumDotRadius, Math.max(minimumDotRadius, calculatedRadius)) : 0;
        if (keepSolids) clearHalftoneCell(workContext, x, y, cellSize, angle);
        workContext.fillStyle = colorMode === 'original'
          ? `rgb(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)})`
          : inkColor;
        if (radius >= 0.25) drawHalftoneShape(workContext, shape, x, y, radius, angle);
      }
      if (gridRow > 0 && gridRow % 28 === 0) {
        setProcessingProgress('halftone', 25 + gridRow / totalGridRows * 70, 'Construyendo la trama…');
        await nextFrame();
        if (renderRevision !== halftoneRenderRevision || sourceState !== states.halftone) return false;
      }
    }
    setProcessingProgress('halftone', 100, 'Montando el resultado…');
    canvas.width = state.width;
    canvas.height = state.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!transparent) {
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(workCanvas, 0, 0);
    setToolResultReady('halftone', true);
    const modeLabel = colorMode === 'original' ? 'color conservado' : 'una tinta';
    const maskLabel = maskMode === 'edge' ? 'fondo excluido' : maskMode === 'alpha' ? 'máscara alfa' : 'imagen completa';
    const rangeLabels = { transitions: 'sombras y transiciones', shadows: 'sombras', midtones: 'medios tonos', highlights: 'luces', all: 'imagen completa' };
    const sourceDpi = Math.round(sourceState.naturalWidth / (requestedWidthCm / 2.54));
    const limitedLabel = state.safetyLimited ? ' · medida limitada por seguridad' : '';
    const previewLabel = state.isPreview ? ' · vista rápida; salida completa al descargar' : '';
    sourceState[statusName] = `${state.width} × ${state.height} px · ${state.actualWidthCm.toFixed(1)} × ${state.actualHeightCm.toFixed(1)} cm · ${frequency} LPI · punto máx. ${maximumDotMm.toFixed(2)} mm · origen ${sourceDpi} DPI${limitedLabel}${previewLabel}.`;
    setStatus('halftone-status', sourceState[statusName]);
    sourceState[renderKeyName] = renderKey;
    markToolClean('halftone');
    delete previewBoundsCache.halftone;
    drawHistogram('halftone', canvas);
    applyPreviewZoom('halftone');
    centerPreview('halftone');
    return true;
  };

  const getConnectedBackgroundMask = async (state, color, tolerance, softness, isCancelled) => {
    const cacheKey = `${color.r},${color.g},${color.b}:${tolerance}:${softness}`;
    if (state.connectedMaskKey === cacheKey && state.connectedMask) return state.connectedMask;
    const width = state.width;
    const height = state.height;
    const total = width * height;
    const selected = new Uint8Array(total);
    const queued = new Uint8Array(total);
    const queue = new Uint32Array(total);
    const source = state.imageData.data;
    const maximumDistance = tolerance + softness;
    let head = 0;
    let tail = 0;
    const tryQueue = pixel => {
      if (queued[pixel]) return;
      queued[pixel] = 1;
      const index = pixel * 4;
      if (source[index + 3] === 0 || perceptualColorDistance(source[index], source[index + 1], source[index + 2], color) > maximumDistance) return;
      selected[pixel] = 1;
      queue[tail++] = pixel;
    };
    for (let x = 0; x < width; x++) {
      tryQueue(x);
      if (height > 1) tryQueue((height - 1) * width + x);
    }
    for (let y = 1; y < height - 1; y++) {
      tryQueue(y * width);
      if (width > 1) tryQueue(y * width + width - 1);
    }
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width;
      if (x > 0) tryQueue(pixel - 1);
      if (x + 1 < width) tryQueue(pixel + 1);
      if (pixel >= width) tryQueue(pixel - width);
      if (pixel + width < total) tryQueue(pixel + width);
      if (head % 250000 === 0) {
        await nextFrame();
        if (isCancelled()) return null;
      }
    }
    state.connectedMaskKey = cacheKey;
    state.connectedMask = selected;
    return selected;
  };

  const renderBackground = async (maskPreview = false, finalOutput = false) => {
    const sourceState = states.background;
    if (!sourceState) return;
    const renderRevision = ++backgroundRenderRevision;
    previewViews.background = maskPreview ? 'mask' : 'result';
    updatePreviewButtons('background');
    showResult('background');
    const canvas = byId('background-canvas');
    const context = canvas.getContext('2d');
    setStatus('background-status', 'Preparando la selección de color…');
    await nextFrame();
    if (renderRevision !== backgroundRenderRevision || sourceState !== states.background) return false;
    const state = finalOutput ? sourceState : getLightweightState(sourceState, 'background');
    const key = hexToRgb(byId('background-color').value);
    const tolerance = Number(byId('background-tolerance').value);
    const softness = Number(byId('background-softness').value);
    const mode = byId('background-mode').value;
    const scope = byId('background-scope').value;
    const decontaminate = mode === 'remove' && byId('background-decontaminate').checked;
    const edgeShift = Number(byId('background-edge-shift').value) || 0;
    setStatus('background-status', 'Analizando y limpiando el color…');
    setProcessingProgress('background', 3, finalOutput ? 'Preparando salida completa…' : 'Creando vista rápida…');
    let output;
    let affected = 0;
    try {
      const workerData = new Uint8ClampedArray(state.imageData.data);
      const result = await runWorkerTask('background', {
        buffer: workerData.buffer,
        width: state.width,
        height: state.height,
        target: key,
        tolerance,
        softness,
        mode,
        scope,
        decontaminate,
        maskPreview,
        edgeShift
      }, [workerData.buffer], progress => setProcessingProgress('background', progress, 'Analizando y limpiando el color…'));
      if (renderRevision !== backgroundRenderRevision || sourceState !== states.background) return false;
      output = new ImageData(new Uint8ClampedArray(result.buffer), state.width, state.height);
      affected = result.affected;
    } catch (error) {
      if (error.name === 'AbortError') return false;
      console.warn('Procesamiento en segundo plano no disponible; usando respaldo local.', error);
      output = new ImageData(new Uint8ClampedArray(state.imageData.data), state.width, state.height);
      const data = output.data;
      const connectedMask = mode === 'remove' && scope === 'connected'
        ? await getConnectedBackgroundMask(state, key, tolerance, softness, () => renderRevision !== backgroundRenderRevision || sourceState !== states.background)
        : null;
      if (mode === 'remove' && scope === 'connected' && !connectedMask) return false;
      for (let index = 0; index < data.length; index += 4) {
        const pixel = index / 4;
        const originalAlpha = data[index + 3];
        const distance = perceptualColorDistance(data[index], data[index + 1], data[index + 2], key);
        if (mode === 'keep') {
          if (distance <= tolerance) data[index + 3] = originalAlpha;
          else if (softness > 0 && distance < tolerance + softness) data[index + 3] = Math.round(originalAlpha * (1 - (distance - tolerance) / softness));
          else data[index + 3] = 0;
        } else if (scope === 'global' || connectedMask[pixel]) {
          if (distance <= tolerance) data[index + 3] = 0;
          else if (softness > 0 && distance < tolerance + softness) data[index + 3] = Math.round(originalAlpha * (distance - tolerance) / softness);
        }
        if (decontaminate && data[index + 3] > 0 && data[index + 3] < originalAlpha) {
          const coverage = data[index + 3] / originalAlpha;
          data[index] = clampChannel((data[index] - (1 - coverage) * key.r) / coverage);
          data[index + 1] = clampChannel((data[index + 1] - (1 - coverage) * key.g) / coverage);
          data[index + 2] = clampChannel((data[index + 2] - (1 - coverage) * key.b) / coverage);
        }
        if (data[index + 3] < originalAlpha) affected++;
        if (index > 0 && index % 1000000 === 0) {
          setProcessingProgress('background', 35 + index / data.length * (maskPreview ? 48 : 62), 'Analizando y limpiando el color…');
          await nextFrame();
          if (renderRevision !== backgroundRenderRevision || sourceState !== states.background) return false;
        }
      }
      if (edgeShift) adjustAlphaEdge(data, state.width, state.height, edgeShift);
      if (maskPreview) {
        for (let index = 0; index < data.length; index += 4) {
          const maskValue = data[index + 3];
          data[index] = maskValue;
          data[index + 1] = maskValue;
          data[index + 2] = maskValue;
          data[index + 3] = 255;
        }
      }
    }
    setProcessingProgress('background', 100, 'Montando el resultado…');
    canvas.width = state.width;
    canvas.height = state.height;
    context.putImageData(output, 0, 0);
    setToolResultReady('background', true);
    const percentage = ((affected / (state.width * state.height)) * 100).toFixed(1);
    const action = mode === 'keep'
      ? 'ocultos para conservar el color'
      : scope === 'connected' ? 'afectados únicamente en el fondo exterior' : 'afectados en toda la imagen';
    const previewLabel = maskPreview ? ' · máscara: blanco conserva, negro elimina' : finalOutput ? ' · salida completa a 300 DPI' : ' · vista rápida; salida final al descargar';
    markToolClean('background');
    setStatus('background-status', `${percentage}% de píxeles ${action}${previewLabel}.`);
    delete previewBoundsCache.background;
    drawHistogram('background', canvas);
    applyPreviewZoom('background');
    centerPreview('background');
    return true;
  };

  const renderActiveBackground = () => renderBackground(previewViews.background === 'mask');

  const pickBackgroundColor = (clientX = null, clientY = null, saveHistory = false) => {
    const state = states.background;
    if (!state) return;
    let x = 0, y = 0;
    if (clientX !== null && clientY !== null) {
      const rect = byId('background-canvas').getBoundingClientRect();
      x = Math.max(0, Math.min(state.width - 1, Math.floor((clientX - rect.left) * state.width / rect.width)));
      y = Math.max(0, Math.min(state.height - 1, Math.floor((clientY - rect.top) * state.height / rect.height)));
    }
    const index = (y * state.width + x) * 4;
    const data = state.imageData.data;
    byId('background-color').value = rgbToHex(data[index], data[index + 1], data[index + 2]);
    renderActiveBackground();
    if (saveHistory) recordHistory('background');
  };

  const createProgressiveSource = async (state, targetWidth, targetHeight, smoothing, onProgress = null) => {
    let source = document.createElement('canvas');
    source.width = state.width;
    source.height = state.height;
    source.getContext('2d').drawImage(state.image, 0, 0, state.width, state.height);
    if (smoothing === 'pixel' || (targetWidth <= state.width * 1.35 && targetHeight <= state.height * 1.35)) {
      onProgress?.(100);
      return source;
    }

    while (source.width < targetWidth * 0.82 || source.height < targetHeight * 0.82) {
      const scale = Math.min(1.7, targetWidth / source.width, targetHeight / source.height);
      if (scale <= 1.02) break;
      const next = document.createElement('canvas');
      next.width = Math.min(targetWidth, Math.max(source.width + 1, Math.round(source.width * scale)));
      next.height = Math.min(targetHeight, Math.max(source.height + 1, Math.round(source.height * scale)));
      const context = next.getContext('2d');
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(source, 0, 0, next.width, next.height);
      source.width = 1;
      source.height = 1;
      source = next;
      onProgress?.(Math.min(100, Math.max(source.width / targetWidth, source.height / targetHeight) * 100));
      await nextFrame();
    }
    return source;
  };

  const enhanceCanvasFallback = async (canvas, sharpness, clarity, denoise = 0, onProgress = null) => {
    if (sharpness <= 0 && clarity <= 0 && denoise <= 0) return;
    const context = canvas.getContext('2d');
    const sourceCanvas = copyCanvas(canvas);
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width, height = canvas.height;
    const sharpAmount = Math.min(0.65, sharpness * 0.006);
    const clarityAmount = Math.min(0.32, clarity * 0.0045);
    const denoiseAmount = Math.min(0.55, Math.max(0, denoise) / 100);
    const tileHeight = 192;
    for (let outputTop = 0; outputTop < height; outputTop += tileHeight) {
      const outputBottom = Math.min(height, outputTop + tileHeight);
      const sourceTop = Math.max(0, outputTop - 2);
      const sourceBottom = Math.min(height, outputBottom + 2);
      const source = sourceContext.getImageData(0, sourceTop, width, sourceBottom - sourceTop);
      const output = new ImageData(new Uint8ClampedArray(source.data), width, source.height);
      const src = source.data, dst = output.data, localHeight = source.height;
      const firstRow = Math.max(2, outputTop - sourceTop);
      const lastRow = Math.min(localHeight - 2, outputBottom - sourceTop);
      for (let y = firstRow; y < lastRow; y++) {
        for (let x = 2; x < width - 2; x++) {
          const index = (y * width + x) * 4;
          const alpha = src[index + 3];
        const edgeAlphaDifference = Math.max(
          Math.abs(alpha - src[index - 1]),
          Math.abs(alpha - src[index + 7]),
          Math.abs(alpha - src[index - width * 4 + 3]),
          Math.abs(alpha - src[index + width * 4 + 3])
        );
          if (alpha < 200 || edgeAlphaDifference > 24) continue;
          for (let channel = 0; channel < 3; channel++) {
            const center = src[index + channel];
            const nearAverage = (
              src[index - 4 + channel] + src[index + 4 + channel]
              + src[index - width * 4 + channel] + src[index + width * 4 + channel]
            ) / 4;
            const farAverage = (
              src[index - 8 + channel] + src[index + 8 + channel]
              + src[index - width * 8 + channel] + src[index + width * 8 + channel]
            ) / 4;
            const cleaned = Math.abs(center - nearAverage) < 24 ? center + (nearAverage - center) * denoiseAmount : center;
            const fineDetail = Math.abs(cleaned - nearAverage) >= 2 ? cleaned - nearAverage : 0;
            const localContrast = Math.abs(cleaned - farAverage) >= 4 ? cleaned - farAverage : 0;
            dst[index + channel] = clampChannel(cleaned + fineDetail * sharpAmount + localContrast * clarityAmount);
          }
        }
      }
      const cropTop = outputTop - sourceTop;
      context.putImageData(output, 0, sourceTop, 0, cropTop, width, outputBottom - outputTop);
      onProgress?.(outputBottom / height * 100);
      await nextFrame();
    }
    sourceCanvas.width = 1;
    sourceCanvas.height = 1;
  };

  const enhanceCanvas = async (canvas, sharpness, clarity, denoise = 0, onProgress = null) => {
    if (sharpness <= 0 && clarity <= 0 && denoise <= 0) return;
    try {
      const context = canvas.getContext('2d', { willReadFrequently: true });
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const result = await runWorkerTask('enhance', {
        buffer: imageData.data.buffer,
        width: canvas.width,
        height: canvas.height,
        sharpness,
        clarity,
        denoise
      }, [imageData.data.buffer], onProgress);
      context.putImageData(new ImageData(new Uint8ClampedArray(result.buffer), canvas.width, canvas.height), 0, 0);
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      console.warn('Mejora en segundo plano no disponible; usando respaldo local.', error);
      await enhanceCanvasFallback(canvas, sharpness, clarity, denoise, onProgress);
    }
  };

  const updateQualityAssessment = () => {
    const state = states.quality;
    const assessment = byId('quality-assessment');
    if (!state || !assessment) return;
    const widthCm = Math.max(2, Math.min(45, Number(byId('quality-width-cm').value) || 30));
    const sourceDpi = Math.round(state.naturalWidth / (widthCm / 2.54));
    assessment.classList.remove('good', 'medium', 'low');
    let level = 'low';
    let message = 'Resolución original baja para ese tamaño; el archivo se ampliará, pero no aparecerán detalles nuevos.';
    if (sourceDpi >= 300) {
      level = 'good';
      message = 'Resolución original tuani: alcanza 300 DPI o más para ese ancho.';
    } else if (sourceDpi >= 200) {
      level = 'medium';
      message = 'Resolución original aceptable; revisá bordes y texto antes de imprimir.';
    }
    assessment.classList.add(level);
    assessment.textContent = `${sourceDpi} DPI efectivos antes de ampliar. ${message}`;
    const mirror = byId('quality-result-assessment');
    if (mirror) {
      mirror.classList.remove('good', 'medium', 'low');
      mirror.classList.add(level);
      mirror.textContent = `${sourceDpi} DPI de origen`;
      mirror.title = message;
    }
  };

  const processQuality = async (finalOutput = false) => {
    const state = states.quality;
    if (!state || qualityProcessing) return;
    const sourceToken = uploadTokens.quality;
    const renderRevision = qualityRevision;
    qualityProcessing = true;
    const requestedWidthCm = Math.max(2, Math.min(45, Number(byId('quality-width-cm').value) || 30));
    byId('quality-width-cm').value = String(requestedWidthCm);
    const requestedWidth = Math.round(requestedWidthCm / 2.54 * EXPORT_DPI);
    const requestedHeight = Math.round(requestedWidth * state.naturalHeight / state.naturalWidth);
    const safetyScale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(requestedWidth, requestedHeight), Math.sqrt(MAX_INTERNAL_PIXELS / (requestedWidth * requestedHeight)));
    const fullWidth = Math.max(1, Math.round(requestedWidth * safetyScale));
    const fullHeight = Math.max(1, Math.round(requestedHeight * safetyScale));
    const previewScale = finalOutput ? 1 : Math.min(1, MAX_PREVIEW_SIDE / Math.max(fullWidth, fullHeight), Math.sqrt(MAX_PREVIEW_PIXELS / (fullWidth * fullHeight)));
    const width = Math.max(1, Math.round(fullWidth * previewScale));
    const height = Math.max(1, Math.round(fullHeight * previewScale));
    setStatus('quality-status', 'Procesando imagen…');
    setProcessingProgress('quality', 3, finalOutput ? 'Preparando salida completa…' : 'Creando vista rápida…');
    previewViews.quality = 'result';
    updatePreviewButtons('quality');
    showResult('quality');
    setToolResultReady('quality', false);
    byId('quality-download').disabled = true;
    byId('quality-process').disabled = true;
    try {
      await nextFrame();
      const canvas = byId('quality-canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      const smoothing = byId('quality-smoothing').value;
      const brightness = 100 + Number(byId('quality-brightness').value);
      const contrast = 100 + Number(byId('quality-contrast').value);
      const saturation = 100 + Number(byId('quality-saturation').value);
      const progressiveSource = await createProgressiveSource(state, width, height, smoothing, progress => setProcessingProgress('quality', 5 + progress * 0.25, 'Escalando la imagen…'));
      if (sourceToken !== uploadTokens.quality || renderRevision !== qualityRevision) return false;
      context.imageSmoothingEnabled = smoothing !== 'pixel';
      context.imageSmoothingQuality = smoothing === 'logo' ? 'medium' : 'high';
      context.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      context.drawImage(progressiveSource, 0, 0, width, height);
      setProcessingProgress('quality', 36, 'Ajustando color y contraste…');
      context.filter = 'none';
      progressiveSource.width = 1;
      progressiveSource.height = 1;
      if (smoothing !== 'pixel') {
        await enhanceCanvas(canvas, Number(byId('quality-sharpness').value), Number(byId('quality-clarity').value), Number(byId('quality-denoise').value), progress => setProcessingProgress('quality', 40 + progress * 0.56, 'Protegiendo detalle y bordes…'));
      }
      if (sourceToken !== uploadTokens.quality || renderRevision !== qualityRevision) return false;
      setProcessingProgress('quality', 100, 'Montando el resultado…');
      setToolResultReady('quality', true);
      byId('quality-download').disabled = false;
      drawHistogram('quality', canvas);
      const actualWidthCm = centimetersAt300Dpi(fullWidth);
      const actualHeightCm = centimetersAt300Dpi(fullHeight);
      if (finalOutput) {
        state.lastOutput = {
          width: fullWidth,
          height: fullHeight,
          actualWidthCm: Number(actualWidthCm),
          actualHeightCm: Number(actualHeightCm),
          sourceDpi: Math.round(state.naturalWidth / (requestedWidthCm / 2.54)),
          safetyLimited: safetyScale < 0.999
        };
      }
      state.qualityPreviewOnly = !finalOutput && previewScale < 0.999;
      const limited = safetyScale < 0.999 ? ' · tamaño ajustado para proteger la memoria del dispositivo' : '';
      const previewLabel = state.qualityPreviewOnly ? `Vista rápida ${width} × ${height} px · salida completa ${fullWidth} × ${fullHeight} px al descargar` : `${fullWidth} × ${fullHeight} px`;
      markToolClean('quality');
      setStatus('quality-status', `${previewLabel} · ${actualWidthCm} × ${actualHeightCm} cm a 300 DPI · detalle y bordes protegidos${limited}.`);
      delete previewBoundsCache.quality;
      applyPreviewZoom('quality');
      centerPreview('quality');
      return true;
    } catch (error) {
      if (error.name === 'AbortError') return false;
      if (sourceToken !== uploadTokens.quality || renderRevision !== qualityRevision) return;
      console.error('No se pudo procesar la imagen:', error);
      setToolResultReady('quality', false);
      byId('quality-download').disabled = true;
      setStatus('quality-status', 'El dispositivo no pudo procesar ese tamaño. Probá con un ancho menor.');
      showToast('Probá con un ancho de impresión menor.');
      return false;
    } finally {
      qualityProcessing = false;
      byId('quality-process').disabled = false;
    }
  };

  const bindRange = (inputId, valueId, suffix, callback) => {
    const input = byId(inputId);
    input.addEventListener('input', () => { byId(valueId).textContent = `${input.value}${suffix}`; callback?.(); });
  };

  const settingIds = {
    halftone: ['halftone-range', 'halftone-hue-range', 'halftone-amount', 'halftone-solid-protection', 'halftone-edge-protection', 'halftone-keep-solids', 'halftone-width-cm', 'halftone-frequency', 'halftone-dot-size', 'halftone-min-dot', 'halftone-dot-gain', 'halftone-mode', 'halftone-mask-mode', 'halftone-mask-tolerance', 'halftone-angle', 'halftone-contrast', 'halftone-shape', 'halftone-color', 'halftone-background-color', 'halftone-transparent', 'halftone-invert'],
    background: ['background-mode', 'background-scope', 'background-color', 'background-tolerance', 'background-softness', 'background-edge-shift', 'background-decontaminate', 'background-trim'],
    quality: ['quality-width-cm', 'quality-smoothing', 'quality-brightness', 'quality-contrast', 'quality-saturation', 'quality-clarity', 'quality-sharpness', 'quality-denoise']
  };

  const captureSettings = type => Object.fromEntries(settingIds[type].map(id => {
    const element = byId(id);
    return [id, element.type === 'checkbox' ? element.checked : element.value];
  }));

  const updateHistoryButtons = (changes = null) => {
    const history = histories[activeTool];
    byId('tool-undo').disabled = history.index <= 0;
    byId('tool-redo').disabled = history.index >= history.entries.length - 1;
    window.dispatchEvent(new CustomEvent('momotus:history-update', {
      detail: { type: activeTool, index: history.index, length: history.entries.length, changes }
    }));
  };

  const recordHistory = type => {
    const history = histories[type];
    const snapshot = captureSettings(type);
    const serialized = JSON.stringify(snapshot);
    if (history.index >= 0 && JSON.stringify(history.entries[history.index]) === serialized) return;
    const previous = history.index >= 0 ? history.entries[history.index] : null;
    const changes = previous
      ? Object.keys(snapshot).filter(id => previous[id] !== snapshot[id]).map(id => ({ id, from: previous[id], to: snapshot[id] }))
      : [];
    history.entries = history.entries.slice(0, history.index + 1);
    history.entries.push(snapshot);
    if (history.entries.length > 30) history.entries.shift();
    history.index = history.entries.length - 1;
    if (type === activeTool) updateHistoryButtons(changes);
    else window.dispatchEvent(new CustomEvent('momotus:history-update', {
      detail: { type, index: history.index, length: history.entries.length, changes }
    }));
  };

  const syncHalftoneMode = () => {
    const mono = byId('halftone-mode').value === 'mono';
    const inkControl = byId('halftone-ink-control');
    byId('halftone-color').disabled = !mono;
    inkControl.classList.toggle('is-disabled', !mono);

    const detectsBackground = byId('halftone-mask-mode').value === 'edge';
    const toleranceControl = byId('halftone-mask-tolerance-control');
    byId('halftone-mask-tolerance').disabled = !detectsBackground;
    toleranceControl.classList.toggle('is-disabled', !detectsBackground);
  };

  const syncBackgroundMode = () => {
    const removesColor = byId('background-mode').value === 'remove';
    byId('background-scope').disabled = !removesColor;
    byId('background-scope-control').classList.toggle('is-disabled', !removesColor);
    byId('background-decontaminate').disabled = !removesColor;
  };

  const syncSettingLabels = type => {
    if (type === 'halftone') {
      byId('halftone-frequency-value').textContent = `${byId('halftone-frequency').value} LPI`;
      byId('halftone-angle-value').textContent = `${byId('halftone-angle').value}°`;
      byId('halftone-contrast-value').textContent = byId('halftone-contrast').value;
      byId('halftone-mask-tolerance-value').textContent = byId('halftone-mask-tolerance').value;
      byId('halftone-amount-value').textContent = `${byId('halftone-amount').value}%`;
      byId('halftone-solid-protection-value').textContent = `${byId('halftone-solid-protection').value}%`;
      byId('halftone-edge-protection-value').textContent = `${byId('halftone-edge-protection').value}%`;
      byId('halftone-dot-size-value').textContent = `${Number(byId('halftone-dot-size').value).toFixed(2)} mm`;
      byId('halftone-min-dot-value').textContent = `${Number(byId('halftone-min-dot').value).toFixed(2)} mm`;
      byId('halftone-dot-gain-value').textContent = `${byId('halftone-dot-gain').value}%`;
      syncHalftoneMode();
    } else if (type === 'background') {
      byId('background-tolerance-value').textContent = byId('background-tolerance').value;
      byId('background-softness-value').textContent = byId('background-softness').value;
      byId('background-edge-shift-value').textContent = `${byId('background-edge-shift').value} px`;
      syncBackgroundMode();
    } else {
      ['brightness', 'contrast', 'saturation', 'clarity', 'sharpness', 'denoise'].forEach(name => {
        byId(`quality-${name}-value`).textContent = byId(`quality-${name}`).value;
      });
    }
  };

  const applySettings = (type, snapshot) => {
    Object.entries(snapshot).forEach(([id, value]) => {
      const element = byId(id);
      if (element.type === 'checkbox') element.checked = Boolean(value);
      else element.value = value;
    });
    syncSettingLabels(type);
    if (type === 'halftone') scheduleRender('halftone', renderHalftone, 0);
    else if (type === 'background') scheduleRender('background', renderActiveBackground, 0);
    else invalidateQualityResult();
  };

  const moveHistory = direction => {
    const history = histories[activeTool];
    const nextIndex = history.index + direction;
    if (nextIndex < 0 || nextIndex >= history.entries.length) return;
    history.index = nextIndex;
    applySettings(activeTool, history.entries[nextIndex]);
    updateHistoryButtons();
  };

  const resetHalftone = () => {
    const defaults = { 'halftone-range': 'transitions', 'halftone-hue-range': 'all', 'halftone-amount': '55', 'halftone-solid-protection': '75', 'halftone-edge-protection': '45', 'halftone-keep-solids': true, 'halftone-width-cm': '28', 'halftone-frequency': '55', 'halftone-dot-size': '0.40', 'halftone-min-dot': '0.10', 'halftone-dot-gain': '0', 'halftone-mode': 'original', 'halftone-mask-mode': 'edge', 'halftone-mask-tolerance': '38', 'halftone-angle': '45', 'halftone-contrast': '12', 'halftone-shape': 'circle', 'halftone-color': '#000000', 'halftone-background-color': '#ffffff', 'halftone-transparent': true, 'halftone-invert': false };
    applySettings('halftone', defaults);
    document.querySelectorAll('[data-halftone-preset], [data-halftone-auto]').forEach(item => item.classList.remove('active'));
  };

  const resetQuality = () => {
    const defaults = { 'quality-width-cm': '30', 'quality-smoothing': 'illustration', 'quality-brightness': '0', 'quality-contrast': '6', 'quality-saturation': '8', 'quality-clarity': '24', 'quality-sharpness': '50', 'quality-denoise': '12' };
    applySettings('quality', defaults);
    document.querySelectorAll('[data-quality-preset], [data-quality-width]').forEach(item => item.classList.remove('active'));
    document.querySelector('[data-quality-preset="dtf"]')?.classList.add('active');
  };

  const updatePreviewButtons = type => {
    document.querySelectorAll(`[data-preview-tool="${type}"]`).forEach(button => {
      const active = button.dataset.previewView === previewViews[type];
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  const showPreview = (type, view) => {
    if (!states[type]) return;
    deactivateCompare(type);
    clearTimeout(renderTimers[type]);
    previewViews[type] = view;
    updatePreviewButtons(type);
    if (view === 'original') showOriginal(type);
    else if (type === 'halftone') renderHalftone();
    else if (type === 'background') renderBackground(view === 'mask');
    else if (byId('quality-download').disabled) processQuality();
    else showResult('quality');
    centerPreview(type);
  };

  const centerPreview = type => {
    cancelAnimationFrame(previewCenterFrames[type]);
    previewCenterFrames[type] = requestAnimationFrame(() => {
      previewCenterFrames[type] = 0;
      const preview = byId(`${type}-preview`);
      if (!preview) return;
      const canvas = byId(`${type}-canvas`);
      const image = byId(`${type}-original`);
      const visibleElement = canvas && !canvas.hidden ? canvas : image;
      const cachedBounds = previewBoundsCache[type]?.bounds;
      if (visibleElement && cachedBounds && visibleElement.getBoundingClientRect().width > 0) {
        const intrinsicWidth = visibleElement instanceof HTMLCanvasElement ? visibleElement.width : (visibleElement.naturalWidth || states[type]?.width || 1);
        const intrinsicHeight = visibleElement instanceof HTMLCanvasElement ? visibleElement.height : (visibleElement.naturalHeight || states[type]?.height || 1);
        const previewRect = preview.getBoundingClientRect();
        const elementRect = visibleElement.getBoundingClientRect();
        const elementLeft = elementRect.left - previewRect.left + preview.scrollLeft;
        const elementTop = elementRect.top - previewRect.top + preview.scrollTop;
        const scaleX = elementRect.width / Math.max(1, intrinsicWidth);
        const scaleY = elementRect.height / Math.max(1, intrinsicHeight);
        preview.scrollLeft = Math.max(0, elementLeft + (cachedBounds.x + cachedBounds.width / 2) * scaleX - preview.clientWidth / 2);
        preview.scrollTop = Math.max(0, elementTop + (cachedBounds.y + cachedBounds.height / 2) * scaleY - preview.clientHeight / 2);
        return;
      }
      preview.scrollLeft = Math.max(0, (preview.scrollWidth - preview.clientWidth) / 2);
      preview.scrollTop = Math.max(0, (preview.scrollHeight - preview.clientHeight) / 2);
    });
  };

  const closeExpandedPreview = () => {
    document.querySelectorAll('.tool-preview-shell.preview-expanded').forEach(shell => shell.classList.remove('preview-expanded'));
    document.querySelectorAll('[data-preview-expand]').forEach(button => {
      button.classList.remove('active');
      button.setAttribute('aria-pressed', 'false');
    });
    document.body.classList.remove('tool-preview-is-expanded');
  };

  const switchTool = target => {
    const typeByTarget = { semitonos: 'halftone', 'eliminar-fondo': 'background', 'mejorar-calidad': 'quality' };
    activeTool = typeByTarget[target] || 'halftone';
    closeExpandedPreview();
    document.querySelectorAll('.tool-panel').forEach(panel => { panel.hidden = panel.id !== target; });
    document.querySelectorAll('[data-tool-target]').forEach(button => {
      const selected = button.dataset.toolTarget === target;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    updateDocumentInfo(activeTool);
    updateHistoryButtons();
    const currentStatus = byId(`${activeTool}-status`);
    if (currentStatus) setStatus(`${activeTool}-status`, currentStatus.textContent);
    if (history.replaceState) history.replaceState(null, '', `#${target}`);
    requestAnimationFrame(() => {
      applyPreviewZoom(activeTool);
      centerPreview(activeTool);
    });
  };

  const processFile = async (file, type, input = null, internalTransfer = false) => {
    if (!file) return;
    const token = ++uploadTokens[type];
    let source = null;
    let accepted = false;
    try {
      setStatus(`${type}-status`, 'Cargando imagen…');
      source = await loadImageFile(file, 4500, internalTransfer);
      if (token !== uploadTokens[type]) {
        URL.revokeObjectURL(source.sourceUrl);
        return false;
      }
      setToolResultReady(type, false);
      delete previewBoundsCache[type];
      const previousSourceUrl = states[type]?.sourceUrl;
      const originalImage = byId(`${type}-original`);
      if (originalImage) originalImage.src = source.sourceUrl;
      previewViews[type] = 'result';
      updatePreviewButtons(type);
      if (type === 'halftone') {
        const prepared = drawSource(source);
        states.halftone = { ...source, imageData: prepared.imageData };
        accepted = true;
        byId('halftone-download').disabled = false;
        renderHalftone();
      } else if (type === 'background') {
        const prepared = drawSource(source);
        states.background = { ...source, imageData: prepared.imageData };
        accepted = true;
        byId('background-download').disabled = false;
        byId('background-corner').disabled = false;
        byId('background-reset').disabled = false;
        pickBackgroundColor();
      } else {
        states.quality = source;
        markToolDirty('quality');
        accepted = true;
        byId('quality-process').disabled = qualityProcessing;
        byId('quality-download').disabled = true;
        previewViews.quality = 'original';
        updatePreviewButtons('quality');
        showOriginal('quality');
        updateQualityAssessment();
        setStatus('quality-status', `${source.width} × ${source.height} px · escogé el ancho y procesá a 300 DPI.`);
      }
      if (previousSourceUrl) URL.revokeObjectURL(previousSourceUrl);
      updateDocumentInfo(type);
      if (input) input.value = '';
      requestAnimationFrame(() => {
        applyPreviewZoom(type);
        centerPreview(type);
      });
      return true;
    } catch (error) {
      if (token !== uploadTokens[type]) return false;
      if (source?.sourceUrl && !accepted) URL.revokeObjectURL(source.sourceUrl);
      setStatus(`${type}-status`, error.message);
      showToast(error.message);
      if (input) input.value = '';
      return false;
    }
  };

  const canvasToFile = (canvas, filename) => new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) return reject(new Error('No se pudo preparar el resultado.'));
      resolve(new File([blob], filename, { type: 'image/png' }));
    }, 'image/png');
  });

  const prepareTransferCanvas = async type => {
    if (!states[type]) throw new Error('Primero cargá y procesá una imagen.');
    if (type === 'quality') {
      if (byId('quality-download').disabled || states.quality?.qualityPreviewOnly) await processQuality(true);
      if (byId('quality-download').disabled) throw new Error('No se pudo terminar la mejora de calidad.');
    } else if (type === 'background') {
      if (!await renderBackground(false, true)) throw new Error('El resultado cambió mientras se preparaba. Intentá nuevamente.');
    } else {
      if (!await renderHalftone(true)) throw new Error('El resultado cambió mientras se preparaba. Intentá nuevamente.');
    }
    return byId(`${type}-canvas`);
  };

  const transferResult = async (from, to, button) => {
    if (!states[from]) return;
    const originalContent = button.innerHTML;
    button.disabled = true;
    button.textContent = 'Preparando…';
    try {
      const canvas = await prepareTransferCanvas(from);
      const file = await canvasToFile(canvas, `${states[from].filename}-${from}.png`);
      const loaded = await processFile(file, to, null, true);
      if (!loaded) return;
      switchTool(panelByType[to], true);
      showToast('Resultado enviado a la siguiente herramienta. Ya podés seguir trabajándolo.');
    } catch (error) {
      console.error('No se pudo compartir el resultado entre herramientas:', error);
      showToast(error.message || 'No se pudo compartir el resultado.');
    } finally {
      button.innerHTML = originalContent;
      button.disabled = !states[from] || (from === 'quality' && byId('quality-download').disabled);
    }
  };

  const setupDropUpload = type => {
    const input = byId(`${type}-file`);
    const dropZone = document.querySelector(`[data-drop-type="${type}"]`);
    input?.addEventListener('change', () => processFile(input.files?.[0], type, input));
    if (!dropZone) return;
    ['dragenter', 'dragover'].forEach(eventName => dropZone.addEventListener(eventName, event => {
      event.preventDefault();
      dropZone.classList.add('dragging');
    }));
    ['dragleave', 'drop'].forEach(eventName => dropZone.addEventListener(eventName, event => {
      event.preventDefault();
      dropZone.classList.remove('dragging');
    }));
    dropZone.addEventListener('drop', event => {
      const file = [...(event.dataTransfer?.files || [])].find(isSupportedImageFile);
      if (file) processFile(file, type, input);
      else showToast('Soltá una imagen PNG, JPG o WebP.');
    });
  };

  const resetBackground = () => {
    byId('background-mode').value = 'remove';
    byId('background-scope').value = 'connected';
    byId('background-color').value = '#ffffff';
    byId('background-tolerance').value = '45';
    byId('background-softness').value = '25';
    byId('background-edge-shift').value = '0';
    byId('background-tolerance-value').textContent = '45';
    byId('background-softness-value').textContent = '25';
    byId('background-edge-shift-value').textContent = '0 px';
    byId('background-decontaminate').checked = true;
    byId('background-trim').checked = false;
    syncBackgroundMode();
    pickBackgroundColor();
  };

  const invalidateQualityResult = () => {
    qualityRevision++;
    if (!states.quality) return;
    markToolDirty('quality');
    setToolResultReady('quality', false);
    byId('quality-download').disabled = true;
    updateQualityAssessment();
    setStatus('quality-status', 'Cambiaste los ajustes · procesá nuevamente para actualizar la descarga.');
  };

  const initializeTools = () => {
    document.querySelectorAll('[data-tool-target]').forEach(button => button.addEventListener('click', () => switchTool(button.dataset.toolTarget)));
    document.querySelectorAll('.tool-shortcut[data-tool-target]').forEach(button => button.setAttribute('aria-controls', button.dataset.toolTarget));
    document.querySelectorAll('.tool-panel').forEach(panel => panel.setAttribute('role', 'tabpanel'));
    const initialTarget = ['semitonos', 'eliminar-fondo', 'mejorar-calidad', 'vectorizacion', 'calculadora-dtf'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'semitonos';
    switchTool(initialTarget);

    if ('ResizeObserver' in window) {
      let resizeFrame = 0;
      const previewResizeObserver = new ResizeObserver(entries => {
        const visibleTypes = entries
          .filter(entry => entry.target.clientWidth > 0 && entry.target.clientHeight > 0)
          .map(entry => entry.target.querySelector('.tool-preview')?.id.replace('-preview', ''))
          .filter(type => type && states[type]);
        if (!visibleTypes.length) return;
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(() => {
          [...new Set(visibleTypes)].forEach(type => applyPreviewZoom(type));
        });
      });
      document.querySelectorAll('.tool-preview-shell').forEach(shell => previewResizeObserver.observe(shell));
    }

    ['halftone', 'background', 'quality'].forEach(setupDropUpload);
    document.querySelectorAll('.tool-control-group').forEach(group => {
      const content = group.querySelector('.tool-control-content');
      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'tool-panel-close';
      closeButton.setAttribute('aria-label', 'Cerrar panel de propiedades');
      closeButton.title = 'Cerrar panel';
      closeButton.innerHTML = '<i class="fa-solid fa-xmark" aria-hidden="true"></i>';
      closeButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        group.open = false;
      });
      group.append(closeButton);
      if (content) {
        content.tabIndex = 0;
        content.setAttribute('role', 'region');
      }
      group.addEventListener('toggle', () => {
        const controls = group.closest('.tool-controls');
        const tab = controls?.querySelector(`[data-control-target="${group.id}"]`);
        if (!group.open) {
          tab?.classList.remove('active');
          tab?.setAttribute('aria-selected', 'false');
          tab?.setAttribute('aria-expanded', 'false');
          return;
        }
        controls?.querySelectorAll('.tool-control-group').forEach(sibling => {
          if (sibling !== group) sibling.open = false;
        });
        tab?.classList.add('active');
        tab?.setAttribute('aria-selected', 'true');
        tab?.setAttribute('aria-expanded', 'true');
        if (content) content.scrollTop = 0;
      });
    });
    document.querySelectorAll('[data-control-target]').forEach(button => {
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', button.dataset.controlTarget);
      button.setAttribute('aria-label', button.getAttribute('title') || 'Abrir opciones');
      button.setAttribute('aria-selected', 'false');
      button.setAttribute('aria-expanded', 'false');
      const controlledPanel = byId(button.dataset.controlTarget);
      controlledPanel?.setAttribute('role', 'tabpanel');
      controlledPanel?.querySelector('.tool-control-content')?.setAttribute('aria-label', button.getAttribute('title') || 'Opciones');
      button.addEventListener('click', () => {
        const target = byId(button.dataset.controlTarget);
        const controls = button.closest('.tool-controls');
        if (!target || !controls) return;
        const preview = byId(`${activeTool}-preview`);
        const preservedViewport = preview ? { left: preview.scrollLeft, top: preview.scrollTop } : null;
        const shouldClose = target.open && button.classList.contains('active');
        controls.querySelectorAll('.tool-control-group').forEach(group => { group.open = !shouldClose && group === target; });
        controls.querySelectorAll('[data-control-target]').forEach(tab => {
          const active = !shouldClose && tab === button;
          tab.classList.toggle('active', active);
          tab.setAttribute('aria-selected', String(active));
          tab.setAttribute('aria-expanded', String(active));
        });
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (!preview || !preservedViewport) return;
          preview.scrollLeft = preservedViewport.left;
          preview.scrollTop = preservedViewport.top;
        }));
      });
    });
    document.addEventListener('paste', event => {
      const visiblePanel = document.querySelector('.tool-panel:not([hidden])')?.id;
      if (!['semitonos', 'eliminar-fondo', 'mejorar-calidad'].includes(visiblePanel)) return;
      const image = [...(event.clipboardData?.items || [])].find(item => item.type.startsWith('image/'))?.getAsFile();
      if (image) processFile(image, activeTool, byId(`${activeTool}-file`));
    });

    bindRange('halftone-frequency', 'halftone-frequency-value', ' LPI', () => scheduleRender('halftone', renderHalftone));
    bindRange('halftone-angle', 'halftone-angle-value', '°', () => scheduleRender('halftone', renderHalftone));
    bindRange('halftone-contrast', 'halftone-contrast-value', '', () => scheduleRender('halftone', renderHalftone));
    bindRange('halftone-mask-tolerance', 'halftone-mask-tolerance-value', '', () => scheduleRender('halftone', renderHalftone));
    bindRange('halftone-amount', 'halftone-amount-value', '%', () => scheduleRender('halftone', renderHalftone));
    bindRange('halftone-solid-protection', 'halftone-solid-protection-value', '%', () => scheduleRender('halftone', renderHalftone));
    bindRange('halftone-edge-protection', 'halftone-edge-protection-value', '%', () => scheduleRender('halftone', renderHalftone));
    const halftoneDotSize = byId('halftone-dot-size');
    halftoneDotSize.addEventListener('input', () => {
      byId('halftone-dot-size-value').textContent = `${Number(halftoneDotSize.value).toFixed(2)} mm`;
      scheduleRender('halftone', renderHalftone, 140);
    });
    bindRange('halftone-min-dot', 'halftone-min-dot-value', ' mm', () => scheduleRender('halftone', renderHalftone, 140));
    bindRange('halftone-dot-gain', 'halftone-dot-gain-value', '%', () => scheduleRender('halftone', renderHalftone, 140));
    byId('halftone-width-cm').addEventListener('input', () => scheduleRender('halftone', renderHalftone, 260));
    ['halftone-color', 'halftone-background-color'].forEach(id => byId(id).addEventListener('input', () => scheduleRender('halftone', renderHalftone)));
    ['halftone-range', 'halftone-hue-range', 'halftone-shape', 'halftone-transparent', 'halftone-invert', 'halftone-keep-solids'].forEach(id => byId(id).addEventListener('change', () => scheduleRender('halftone', renderHalftone, 0)));
    ['halftone-mode', 'halftone-mask-mode'].forEach(id => byId(id).addEventListener('change', () => {
      syncHalftoneMode();
      scheduleRender('halftone', renderHalftone, 0);
    }));
    syncHalftoneMode();
    const halftonePresets = {
      suave: { range: 'shadows', amount: 30, protection: 88, edgeProtection: 60, frequency: 48, dotSize: 0.45, angle: 45, shape: 'circle', contrast: 6 },
      balanceado: { range: 'transitions', amount: 52, protection: 78, edgeProtection: 45, frequency: 55, dotSize: 0.40, angle: 45, shape: 'circle', contrast: 12 },
      fino: { range: 'transitions', amount: 42, protection: 86, edgeProtection: 72, frequency: 68, dotSize: 0.30, angle: 45, shape: 'ellipse', contrast: 14 },
      lineas: { range: 'midtones', amount: 35, protection: 76, edgeProtection: 52, frequency: 60, dotSize: 0.35, angle: 45, shape: 'line', contrast: 12 }
    };
    document.querySelectorAll('[data-halftone-preset]').forEach(button => button.addEventListener('click', () => {
      const preset = halftonePresets[button.dataset.halftonePreset];
      if (preset) applyHalftonePreset(preset, button);
    }));
    document.querySelectorAll('[data-halftone-auto]').forEach(button => button.addEventListener('click', () => {
      const state = states.halftone;
      if (!state) return showToast('Primero subí una imagen para analizar sus colores.');
      const requestedRange = button.dataset.halftoneAuto;
      const preset = buildAutomaticHalftonePreset(state, requestedRange);
      applyHalftonePreset(preset, button);
      const labels = { shadows: 'sombras', midtones: 'medios tonos', highlights: 'luces', transitions: 'transiciones', dominant: 'el color dominante', vivid: 'los colores vivos', neutral: 'los colores neutros', smart: 'la imagen' };
      showToast(`Ajuste automático aplicado a ${labels[requestedRange] || 'la imagen'}.`);
    }));
    byId('halftone-download').addEventListener('click', async () => {
      if (!states.halftone) return;
      const rendered = await renderHalftone(true);
      if (rendered) openPreflight('halftone', byId('halftone-canvas'), `${states.halftone.filename}-semitono-300dpi.png`);
    });

    bindRange('background-tolerance', 'background-tolerance-value', '', () => scheduleRender('background', renderActiveBackground));
    bindRange('background-softness', 'background-softness-value', '', () => scheduleRender('background', renderActiveBackground));
    bindRange('background-edge-shift', 'background-edge-shift-value', ' px', () => scheduleRender('background', renderActiveBackground));
    byId('background-color').addEventListener('input', () => scheduleRender('background', renderActiveBackground));
    byId('background-mode').addEventListener('change', () => {
      syncBackgroundMode();
      scheduleRender('background', renderActiveBackground, 0);
    });
    byId('background-scope').addEventListener('change', () => scheduleRender('background', renderActiveBackground, 0));
    byId('background-decontaminate').addEventListener('change', () => scheduleRender('background', renderActiveBackground, 0));
    document.querySelectorAll('[data-background-color]').forEach(button => button.addEventListener('click', () => {
      byId('background-color').value = button.dataset.backgroundColor;
      scheduleRender('background', renderActiveBackground, 0);
      recordHistory('background');
    }));
    byId('background-corner').addEventListener('click', () => pickBackgroundColor(null, null, true));
    byId('background-reset').addEventListener('click', () => { resetBackground(); recordHistory('background'); });
    byId('background-canvas').addEventListener('click', event => pickBackgroundColor(event.clientX, event.clientY, true));
    byId('background-download').addEventListener('click', async () => {
      if (!states.background) return;
      const rendered = await renderBackground(false, true);
      if (!rendered) return;
      const canvas = byId('background-trim').checked ? trimTransparentCanvas(byId('background-canvas')) : byId('background-canvas');
      openPreflight('background', canvas, `${states.background.filename}-sin-color-300dpi.png`);
    });

    bindRange('quality-sharpness', 'quality-sharpness-value', '', invalidateQualityResult);
    bindRange('quality-brightness', 'quality-brightness-value', '', invalidateQualityResult);
    bindRange('quality-contrast', 'quality-contrast-value', '', invalidateQualityResult);
    bindRange('quality-saturation', 'quality-saturation-value', '', invalidateQualityResult);
    bindRange('quality-clarity', 'quality-clarity-value', '', invalidateQualityResult);
    bindRange('quality-denoise', 'quality-denoise-value', '', invalidateQualityResult);
    byId('quality-width-cm').addEventListener('input', invalidateQualityResult);
    byId('quality-smoothing').addEventListener('change', invalidateQualityResult);
    document.querySelectorAll('[data-quality-width]').forEach(button => button.addEventListener('click', () => {
      byId('quality-width-cm').value = button.dataset.qualityWidth;
      document.querySelectorAll('[data-quality-width]').forEach(item => item.classList.toggle('active', item === button));
      invalidateQualityResult();
      recordHistory('quality');
    }));
    const qualityPresets = {
      dtf: { smoothing: 'illustration', brightness: 0, contrast: 6, saturation: 8, clarity: 24, sharpness: 50, denoise: 12 },
      illustration: { smoothing: 'illustration', brightness: 0, contrast: 10, saturation: 14, clarity: 30, sharpness: 58, denoise: 8 },
      photo: { smoothing: 'photo', brightness: 1, contrast: 5, saturation: 6, clarity: 18, sharpness: 42, denoise: 22 },
      logo: { smoothing: 'logo', brightness: 0, contrast: 12, saturation: 6, clarity: 8, sharpness: 68, denoise: 4 }
    };
    document.querySelectorAll('[data-quality-preset]').forEach(button => button.addEventListener('click', () => {
      const preset = qualityPresets[button.dataset.qualityPreset];
      if (!preset) return;
      byId('quality-smoothing').value = preset.smoothing;
      ['brightness', 'contrast', 'saturation', 'clarity', 'sharpness', 'denoise'].forEach(name => {
        byId(`quality-${name}`).value = preset[name];
        byId(`quality-${name}-value`).textContent = String(preset[name]);
      });
      document.querySelectorAll('[data-quality-preset]').forEach(item => item.classList.toggle('active', item === button));
      invalidateQualityResult();
      recordHistory('quality');
    }));
    byId('quality-process').addEventListener('click', () => processQuality(false));
    byId('quality-download').addEventListener('click', async () => {
      if (!states.quality) return;
      if (states.quality.qualityPreviewOnly && !await processQuality(true)) return;
      openPreflight('quality', byId('quality-canvas'), `${states.quality.filename}-300dpi.png`);
    });

    Object.entries(settingIds).forEach(([type, ids]) => ids.forEach(id => {
      const element = byId(id);
      element.addEventListener('change', () => recordHistory(type));
      element.addEventListener('input', () => markToolDirty(type));
      element.addEventListener('change', () => markToolDirty(type));
      const clearPreset = event => {
        if (!event.isTrusted) return;
        if (type === 'halftone') document.querySelectorAll('[data-halftone-preset], [data-halftone-auto]').forEach(item => item.classList.remove('active'));
        if (type === 'quality') {
          document.querySelectorAll('[data-quality-preset]').forEach(item => item.classList.remove('active'));
          if (id === 'quality-width-cm') document.querySelectorAll('[data-quality-width]').forEach(item => item.classList.remove('active'));
        }
      };
      element.addEventListener('input', clearPreset);
      element.addEventListener('change', clearPreset);
    }));
    byId('tool-undo').addEventListener('click', () => moveHistory(-1));
    byId('tool-redo').addEventListener('click', () => moveHistory(1));
    byId('tool-reset-current').addEventListener('click', () => {
      if (activeTool === 'halftone') resetHalftone();
      else if (activeTool === 'background') resetBackground();
      else resetQuality();
      recordHistory(activeTool);
    });
    const closeShortcutPanel = () => { byId('tool-shortcuts-panel').hidden = true; };
    byId('tool-shortcuts-help').addEventListener('click', () => {
      byId('tool-shortcuts-panel').hidden = false;
      byId('tool-shortcuts-close').focus();
    });
    byId('tool-shortcuts-close').addEventListener('click', closeShortcutPanel);
    byId('tool-shortcuts-panel').addEventListener('click', event => {
      if (event.target === byId('tool-shortcuts-panel')) closeShortcutPanel();
    });
    document.addEventListener('keydown', event => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      event.preventDefault();
      moveHistory(event.shiftKey ? 1 : -1);
    });

    document.querySelectorAll('[data-preview-tool]').forEach(button => button.addEventListener('click', () => showPreview(button.dataset.previewTool, button.dataset.previewView)));
    Object.keys(previewViews).forEach(updatePreviewButtons);
    document.querySelectorAll('[data-preview-compare]').forEach(button => button.addEventListener('click', () => {
      const type = button.dataset.previewCompare;
      if (byId(`${type}-preview`).classList.contains('compare-active')) deactivateCompare(type);
      else activateCompare(type);
    }));
    document.querySelectorAll('[data-compare-range]').forEach(range => {
      setComparePosition(range.dataset.compareRange, range.value);
      range.addEventListener('input', () => setComparePosition(range.dataset.compareRange, range.value));
    });
    document.querySelectorAll('[data-preview-expand]').forEach(button => button.addEventListener('click', () => {
      const type = button.dataset.previewExpand;
      const shell = byId(`${type}-preview`)?.closest('.tool-preview-shell');
      if (!shell) return;
      const willExpand = !shell.classList.contains('preview-expanded');
      closeExpandedPreview();
      if (willExpand) {
        shell.classList.add('preview-expanded');
        button.classList.add('active');
        button.setAttribute('aria-pressed', 'true');
        document.body.classList.add('tool-preview-is-expanded');
      }
      applyPreviewZoom(type);
      centerPreview(type);
    }));
    document.querySelectorAll('[data-transfer-from][data-transfer-to]').forEach(button => button.addEventListener('click', () => {
      transferResult(button.dataset.transferFrom, button.dataset.transferTo, button);
    }));
    const zoomSteps = ['fit', 'canvas', '100', '150', '200', '300', '400'];
    const stepPreviewZoom = (type, direction) => {
      const select = document.querySelector(`[data-preview-zoom="${type}"]`);
      if (!select || !states[type]) return;
      let index = zoomSteps.indexOf(select.value);
      if (index < 0) index = direction > 0 ? 0 : 1;
      select.value = zoomSteps[Math.max(0, Math.min(zoomSteps.length - 1, index + direction))];
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };
    document.querySelectorAll('[data-preview-zoom-in]').forEach(button => button.addEventListener('click', () => stepPreviewZoom(button.dataset.previewZoomIn, 1)));
    document.querySelectorAll('[data-preview-zoom-out]').forEach(button => button.addEventListener('click', () => stepPreviewZoom(button.dataset.previewZoomOut, -1)));
    const magnificationLevels = ['200', '300', '400'];
    document.querySelectorAll('[data-preview-zoom]').forEach(select => select.addEventListener('change', () => {
      const type = select.dataset.previewZoom;
      const magnify = document.querySelector(`[data-preview-magnify="${type}"]`);
      if (magnify) {
        const active = magnificationLevels.includes(select.value);
        magnify.classList.toggle('active', active);
        magnify.setAttribute('aria-pressed', String(active));
        const icon = magnify.querySelector('i');
        const label = magnify.querySelector('span');
        if (label) label.textContent = active ? `${Number(select.value) / 100}×` : 'Lupa';
        icon?.classList.toggle('fa-magnifying-glass-plus', select.value !== '400');
        icon?.classList.toggle('fa-magnifying-glass-minus', select.value === '400');
        magnify.title = active
          ? (select.value === '400' ? 'Volver al encuadre anterior' : 'Aumentar el nivel de detalle')
          : 'Examinar detalles al 200%, 300% y 400%';
      }
      applyPreviewZoom(type);
      centerPreview(type);
    }));
    document.querySelectorAll('[data-preview-magnify]').forEach(button => button.addEventListener('click', () => {
      const type = button.dataset.previewMagnify;
      const select = document.querySelector(`[data-preview-zoom="${type}"]`);
      if (!select) return;
      const currentIndex = magnificationLevels.indexOf(select.value);
      if (currentIndex === -1) {
        button.dataset.previousZoom = select.value;
        select.value = '200';
      } else if (currentIndex < magnificationLevels.length - 1) {
        select.value = magnificationLevels[currentIndex + 1];
      } else {
        select.value = button.dataset.previousZoom || 'detail';
      }
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }));
    document.addEventListener('keydown', event => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || !byId('dtf-preflight-modal').hidden || !byId('tool-shortcuts-panel').hidden) return;
      const select = document.querySelector(`[data-preview-zoom="${activeTool}"]`);
      if (!select || !states[activeTool]) return;
      if (event.key === '0') select.value = 'fit';
      else if (event.key === '1') select.value = '100';
      else if (event.key === '2') select.value = 'canvas';
      else if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        stepPreviewZoom(activeTool, 1);
        return;
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        stepPreviewZoom(activeTool, -1);
        return;
      }
      else return;
      event.preventDefault();
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    const releaseSpacePan = () => {
      document.querySelectorAll('.tool-preview.space-pan').forEach(preview => preview.classList.remove('space-pan'));
    };
    document.addEventListener('keydown', event => {
      if (event.code !== 'Space' || event.repeat || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(document.activeElement?.tagName)) return;
      event.preventDefault();
      byId(`${activeTool}-preview`)?.classList.add('space-pan');
    });
    document.addEventListener('keyup', event => { if (event.code === 'Space') releaseSpacePan(); });
    window.addEventListener('blur', releaseSpacePan);
    document.querySelectorAll('.tool-preview').forEach(preview => {
      preview.tabIndex = 0;
      preview.setAttribute('aria-label', `${preview.getAttribute('aria-label') || 'Vista del diseño'}. Usá las flechas o arrastrá para recorrer una imagen ampliada.`);
      let pan = null;
      let moved = false;
      preview.addEventListener('pointerdown', event => {
        if (event.button !== 0 || !preview.classList.contains('is-pannable')) return;
        moved = false;
        pan = { x: event.clientX, y: event.clientY, left: preview.scrollLeft, top: preview.scrollTop };
        preview.setPointerCapture(event.pointerId);
        preview.classList.add('is-panning');
      });
      preview.addEventListener('pointermove', event => {
        if (!pan) return;
        const deltaX = event.clientX - pan.x;
        const deltaY = event.clientY - pan.y;
        if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) moved = true;
        preview.scrollLeft = pan.left - deltaX;
        preview.scrollTop = pan.top - deltaY;
      });
      const stopPanning = event => {
        if (!pan) return;
        if (preview.hasPointerCapture(event.pointerId)) preview.releasePointerCapture(event.pointerId);
        pan = null;
        preview.classList.remove('is-panning');
      };
      preview.addEventListener('pointerup', stopPanning);
      preview.addEventListener('pointercancel', stopPanning);
      preview.addEventListener('click', event => {
        if (!moved) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        moved = false;
      }, true);
      preview.addEventListener('dblclick', event => {
        if (!states[activeTool] || preview.id !== `${activeTool}-preview`) return;
        event.preventDefault();
        const select = document.querySelector(`[data-preview-zoom="${activeTool}"]`);
        if (!select) return;
        select.value = select.value === '100' ? 'fit' : '100';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      preview.addEventListener('keydown', event => {
        const distance = event.shiftKey ? 160 : 60;
        const movements = { ArrowLeft: [-distance, 0], ArrowRight: [distance, 0], ArrowUp: [0, -distance], ArrowDown: [0, distance] };
        if (!movements[event.key]) return;
        event.preventDefault();
        preview.scrollBy({ left: movements[event.key][0], top: movements[event.key][1], behavior: 'smooth' });
      });
    });
    document.querySelectorAll('[data-preview-background]').forEach(select => select.addEventListener('change', () => {
      const preview = byId(`${select.dataset.previewBackground}-preview`);
      preview.classList.toggle('checkerboard', select.value === 'checkerboard');
      preview.classList.toggle('preview-dark', select.value === 'dark');
      preview.classList.toggle('preview-light', select.value === 'light');
    }));
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (!byId('tool-shortcuts-panel').hidden) closeShortcutPanel();
      else if (!byId('dtf-preflight-modal').hidden) closePreflight();
      else if (document.body.classList.contains('tool-preview-is-expanded')) {
        closeExpandedPreview();
        applyPreviewZoom(activeTool);
        centerPreview(activeTool);
      } else {
        const openProperties = document.querySelector('.tool-panel:not([hidden]) .tool-control-group[open]');
        if (openProperties) openProperties.open = false;
      }
    });
    byId('dtf-preflight-close').addEventListener('click', closePreflight);
    byId('dtf-preflight-back').addEventListener('click', closePreflight);
    byId('dtf-preflight-modal').addEventListener('click', event => {
      if (event.target === byId('dtf-preflight-modal')) closePreflight();
    });
    byId('dtf-preflight-download').addEventListener('click', async () => {
      const pending = pendingPreflightDownload;
      if (!pending) return;
      const requestedName = byId('dtf-export-name')?.value
        ?.trim()
        .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/\.png$/i, '')
        .slice(0, 90);
      const filename = `${requestedName || pending.filename.replace(/\.png$/i, '')}.png`;
      closePreflight();
      await downloadCanvas(pending.canvas, filename);
    });
    let previewResizeFrame = 0;
    window.addEventListener('resize', () => {
      cancelAnimationFrame(previewResizeFrame);
      previewResizeFrame = requestAnimationFrame(() => {
        applyPreviewZoom(activeTool);
        centerPreview(activeTool);
      });
    });
    window.addEventListener('beforeunload', () => Object.values(states).forEach(state => {
      if (state?.sourceUrl) URL.revokeObjectURL(state.sourceUrl);
    }));
    window.addEventListener('beforeunload', () => activeWorkerJobs.forEach(job => job.worker.terminate()));
    Object.keys(histories).forEach(recordHistory);
    syncBackgroundMode();
    updateHistoryButtons();
  };

  window.MomotusToolsAPI = Object.freeze({
    getActiveType: () => activeTool,
    hasDocument: type => Boolean(states[type || activeTool]),
    getDocumentInfo: type => {
      const selected = type || activeTool;
      const state = states[selected];
      if (!state) return null;
      return {
        type: selected,
        filename: state.filename || 'momotus',
        naturalWidth: state.naturalWidth || state.width,
        naturalHeight: state.naturalHeight || state.height
      };
    },
    getResultCanvas: async type => {
      const selected = type || activeTool;
      if (!states[selected]) return null;
      if (selected === 'quality' && (byId('quality-download').disabled || states.quality.qualityPreviewOnly)) {
        if (!await processQuality(true)) return null;
      } else if (selected === 'background') {
        if (!await renderBackground(false, true)) return null;
      } else if (selected === 'halftone') {
        if (!await renderHalftone(true)) return null;
      }
      return prepareTransferCanvas(selected);
    },
    sendCanvasToTool: async (canvas, type, filename = 'momotus-produccion.png') => {
      if (!canvas || !['halftone', 'background', 'quality'].includes(type)) return false;
      const file = await canvasToFile(canvas, filename);
      const loaded = await processFile(file, type, null, true);
      if (loaded) switchTool(panelByType[type], true);
      return Boolean(loaded);
    },
    importFileToTool: async (file, type = 'background') => {
      if (!(file instanceof File) || !panelByType[type]) return false;
      const loaded = await processFile(file, type, null, true);
      if (loaded) switchTool(panelByType[type], true);
      return Boolean(loaded);
    },
    reviewAndDownload: (canvas, filename = 'momotus-dtf-300dpi.png', type = activeTool) => {
      if (!canvas?.width || !canvas.height) return false;
      openPreflight(type, canvas, filename);
      return true;
    },
    downloadCanvas,
    showToast,
    constants: Object.freeze({ dpi: EXPORT_DPI, maxOutputSide: MAX_OUTPUT_SIDE })
  });
  window.dispatchEvent(new CustomEvent('momotus:tools-api-ready'));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeTools);
  else initializeTools();
})();
