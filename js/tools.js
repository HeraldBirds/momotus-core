(() => {
  'use strict';

  const EXPORT_DPI = 300;
  const PIXELS_PER_METER_300_DPI = 11811;
  const MAX_FILE_SIZE = 12 * 1024 * 1024;
  const MAX_WORKING_PIXELS = 12000000;
  const MAX_OUTPUT_SIDE = 5000;
  const MAX_HALFTONE_PIXELS = 18000000;
  const MAX_HALFTONE_SIDE = 6000;
  const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
  const states = { halftone: null, background: null, quality: null };
  const previewViews = { halftone: 'result', background: 'result', quality: 'result' };
  const renderTimers = {};
  const uploadTokens = { halftone: 0, background: 0, quality: 0 };
  const histories = {
    halftone: { entries: [], index: -1 },
    background: { entries: [], index: -1 },
    quality: { entries: [], index: -1 }
  };
  let activeTool = 'halftone';
  let qualityProcessing = false;

  const byId = id => document.getElementById(id);
  const setStatus = (id, message) => { const element = byId(id); if (element) element.textContent = message; };
  const hexToRgb = hex => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) });
  const rgbToHex = (r, g, b) => `#${[r, g, b].map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const centimetersAt300Dpi = pixels => (pixels / EXPORT_DPI * 2.54).toFixed(1);
  const clampChannel = value => Math.max(0, Math.min(255, Math.round(value)));
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

  const loadImageFile = (file, maxSide = 4500) => new Promise((resolve, reject) => {
    if (!file || !ALLOWED_IMAGE_TYPES.has(file.type)) return reject(new Error('Escogé una imagen PNG, JPG o WebP.'));
    if (file.size > MAX_FILE_SIZE) return reject(new Error('La imagen debe pesar 12 MB o menos.'));
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const sideScale = maxSide / Math.max(image.naturalWidth, image.naturalHeight);
      const pixelScale = Math.sqrt(MAX_WORKING_PIXELS / (image.naturalWidth * image.naturalHeight));
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

  const showOriginal = type => {
    const state = states[type];
    if (!state) return;
    const image = byId(`${type}-original`);
    const canvas = byId(`${type}-canvas`);
    image.src = state.sourceUrl;
    image.hidden = false;
    canvas.hidden = true;
  };

  const showResult = type => {
    const image = byId(`${type}-original`);
    const canvas = byId(`${type}-canvas`);
    image.hidden = true;
    canvas.hidden = false;
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

  const downloadCanvas = (canvas, filename) => {
    canvas.toBlob(async blob => {
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

  const halftoneSelectionStrength = (range, luminance, variation, protection, amount) => {
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
    return clampUnit(rangeWeight * solidProtection * amount);
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

  const prepareHalftoneOutput = (source, requestedWidthCm) => {
    const requestedWidth = Math.round(requestedWidthCm / 2.54 * EXPORT_DPI);
    const requestedHeight = Math.round(requestedWidth * source.naturalHeight / source.naturalWidth);
    const safetyScale = Math.min(
      1,
      MAX_HALFTONE_SIDE / Math.max(requestedWidth, requestedHeight),
      Math.sqrt(MAX_HALFTONE_PIXELS / (requestedWidth * requestedHeight))
    );
    const width = Math.max(1, Math.round(requestedWidth * safetyScale));
    const height = Math.max(1, Math.round(requestedHeight * safetyScale));
    const cacheKey = `${width}x${height}`;
    if (source.halftoneOutputCache?.key === cacheKey) return source.halftoneOutputCache;
    const sourceCanvas = document.createElement('canvas');
    sourceCanvas.width = width;
    sourceCanvas.height = height;
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
    sourceContext.imageSmoothingEnabled = true;
    sourceContext.imageSmoothingQuality = 'high';
    sourceContext.drawImage(source.image, 0, 0, width, height);
    source.halftoneOutputCache = {
      key: cacheKey,
      width,
      height,
      actualWidthCm: width / EXPORT_DPI * 2.54,
      actualHeightCm: height / EXPORT_DPI * 2.54,
      safetyLimited: safetyScale < 0.999,
      imageData: sourceContext.getImageData(0, 0, width, height)
    };
    return source.halftoneOutputCache;
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

  const getHalftoneBackgroundMask = (state, cellSize, tolerance, mode) => {
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
    }
    state.halftoneMaskCache = { key: cacheKey, background, columns, rows };
    return state.halftoneMaskCache;
  };

  const renderHalftone = () => {
    const sourceState = states.halftone;
    if (!sourceState) return;
    previewViews.halftone = 'result';
    updatePreviewButtons('halftone');
    showResult('halftone');
    const canvas = byId('halftone-canvas');
    const context = canvas.getContext('2d');
    const requestedWidthCm = Math.max(8, Math.min(38, Number(byId('halftone-width-cm').value) || 28));
    byId('halftone-width-cm').value = String(requestedWidthCm);
    const state = prepareHalftoneOutput(sourceState, requestedWidthCm);
    const frequency = Number(byId('halftone-frequency').value);
    const cellSize = EXPORT_DPI / frequency;
    const maximumDotMm = Number(byId('halftone-dot-size').value);
    const maximumDotRadius = maximumDotMm / 25.4 * EXPORT_DPI / 2;
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
    const amount = Number(byId('halftone-amount').value) / 100;
    const solidProtection = Number(byId('halftone-solid-protection').value) / 100;
    const keepSolids = byId('halftone-keep-solids').checked;
    canvas.width = state.width;
    canvas.height = state.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const workCanvas = document.createElement('canvas');
    workCanvas.width = state.width;
    workCanvas.height = state.height;
    const workContext = workCanvas.getContext('2d');
    if (keepSolids) workContext.putImageData(state.imageData, 0, 0);
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const centerX = state.width / 2, centerY = state.height / 2;
    const diagonal = Math.hypot(state.width, state.height);
    const backgroundMask = getHalftoneBackgroundMask(state, cellSize, maskTolerance, maskMode);
    const inkColor = byId('halftone-color').value;
    let gridRow = 0;
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
        const selectionStrength = halftoneSelectionStrength(tonalRange, luminance, sample.variation, solidProtection, amount);
        if (selectionStrength < halftoneGridThreshold(gridColumn, gridRow)) continue;
        const tone = invert ? luminance / 255 : 1 - luminance / 255;
        const coverage = colorMode === 'original' ? Math.max(0.18, tone) : tone;
        const radius = Math.min(maximumDotRadius, cellSize * 0.46 * Math.sqrt(Math.max(0, coverage * sample.a)));
        if (keepSolids) clearHalftoneCell(workContext, x, y, cellSize, angle);
        workContext.fillStyle = colorMode === 'original'
          ? `rgb(${Math.round(red)}, ${Math.round(green)}, ${Math.round(blue)})`
          : inkColor;
        if (radius >= 0.25) drawHalftoneShape(workContext, shape, x, y, radius, angle);
      }
    }
    if (!transparent) {
      context.fillStyle = byId('halftone-background-color').value;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(workCanvas, 0, 0);
    const modeLabel = colorMode === 'original' ? 'color conservado' : 'una tinta';
    const maskLabel = maskMode === 'edge' ? 'fondo excluido' : maskMode === 'alpha' ? 'máscara alfa' : 'imagen completa';
    const rangeLabels = { transitions: 'sombras y transiciones', shadows: 'sombras', midtones: 'medios tonos', highlights: 'luces', all: 'imagen completa' };
    const sourceDpi = Math.round(sourceState.naturalWidth / (requestedWidthCm / 2.54));
    const limitedLabel = state.safetyLimited ? ' · medida limitada por seguridad' : '';
    setStatus('halftone-status', `${state.width} × ${state.height} px · ${state.actualWidthCm.toFixed(1)} × ${state.actualHeightCm.toFixed(1)} cm · ${frequency} LPI · punto máx. ${maximumDotMm.toFixed(2)} mm · origen ${sourceDpi} DPI${limitedLabel}.`);
  };

  const renderBackground = (maskPreview = false) => {
    const state = states.background;
    if (!state) return;
    previewViews.background = maskPreview ? 'mask' : 'result';
    updatePreviewButtons('background');
    showResult('background');
    const canvas = byId('background-canvas');
    const context = canvas.getContext('2d');
    const output = new ImageData(new Uint8ClampedArray(state.imageData.data), state.width, state.height);
    const key = hexToRgb(byId('background-color').value);
    const tolerance = Number(byId('background-tolerance').value);
    const softness = Number(byId('background-softness').value);
    const mode = byId('background-mode').value;
    const decontaminate = mode === 'remove' && byId('background-decontaminate').checked;
    const data = output.data;
    let affected = 0;
    for (let index = 0; index < data.length; index += 4) {
      const originalAlpha = data[index + 3];
      const distance = perceptualColorDistance(data[index], data[index + 1], data[index + 2], key);
      if (mode === 'keep') {
        if (distance <= tolerance) data[index + 3] = originalAlpha;
        else if (softness > 0 && distance < tolerance + softness) data[index + 3] = Math.round(originalAlpha * (1 - (distance - tolerance) / softness));
        else data[index + 3] = 0;
      } else {
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
    }
    if (maskPreview) {
      for (let index = 0; index < data.length; index += 4) {
        const maskValue = data[index + 3];
        data[index] = maskValue;
        data[index + 1] = maskValue;
        data[index + 2] = maskValue;
        data[index + 3] = 255;
      }
    }
    canvas.width = state.width;
    canvas.height = state.height;
    context.putImageData(output, 0, 0);
    const percentage = ((affected / (state.width * state.height)) * 100).toFixed(1);
    const action = mode === 'keep' ? 'ocultos para conservar el color' : 'afectados en toda la imagen';
    const previewLabel = maskPreview ? ' · máscara: blanco conserva, negro elimina' : ' · salida 300 DPI';
    setStatus('background-status', `${percentage}% de píxeles ${action}${previewLabel}.`);
  };

  const renderActiveBackground = () => renderBackground(previewViews.background === 'mask');

  const pickBackgroundColor = (clientX = null, clientY = null) => {
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
  };

  const sharpenCanvas = async (canvas, strength) => {
    if (strength <= 0) return;
    const context = canvas.getContext('2d');
    const source = context.getImageData(0, 0, canvas.width, canvas.height);
    const output = context.createImageData(canvas.width, canvas.height);
    const src = source.data, dst = output.data, width = canvas.width, height = canvas.height;
    const amount = Math.min(0.75, strength * 0.0075);
    dst.set(src);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const index = (y * width + x) * 4;
        const alpha = src[index + 3];
        const edgeAlphaDifference = Math.max(
          Math.abs(alpha - src[index - 1]),
          Math.abs(alpha - src[index + 7]),
          Math.abs(alpha - src[index - width * 4 + 3]),
          Math.abs(alpha - src[index + width * 4 + 3])
        );
        if (alpha < 255 || edgeAlphaDifference > 12) continue;
        for (let channel = 0; channel < 3; channel++) {
          const center = src[index + channel];
          const neighbors = src[index - 4 + channel] + src[index + 4 + channel] + src[index - width * 4 + channel] + src[index + width * 4 + channel];
          dst[index + channel] = Math.max(0, Math.min(255, center + amount * (4 * center - neighbors)));
        }
        dst[index + 3] = src[index + 3];
      }
      if (y % 64 === 0) await nextFrame();
    }
    context.putImageData(output, 0, 0);
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
  };

  const processQuality = async () => {
    const state = states.quality;
    if (!state || qualityProcessing) return;
    const sourceToken = uploadTokens.quality;
    qualityProcessing = true;
    const requestedWidthCm = Math.max(2, Math.min(45, Number(byId('quality-width-cm').value) || 30));
    byId('quality-width-cm').value = String(requestedWidthCm);
    const requestedWidth = Math.round(requestedWidthCm / 2.54 * EXPORT_DPI);
    const requestedHeight = Math.round(requestedWidth * state.naturalHeight / state.naturalWidth);
    const safetyScale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(requestedWidth, requestedHeight), Math.sqrt(MAX_WORKING_PIXELS / (requestedWidth * requestedHeight)));
    const width = Math.max(1, Math.round(requestedWidth * safetyScale));
    const height = Math.max(1, Math.round(requestedHeight * safetyScale));
    setStatus('quality-status', 'Procesando imagen…');
    previewViews.quality = 'result';
    updatePreviewButtons('quality');
    showResult('quality');
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
      context.imageSmoothingEnabled = smoothing !== 'pixel';
      context.imageSmoothingQuality = smoothing === 'logo' ? 'medium' : 'high';
      context.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      context.drawImage(state.image, 0, 0, width, height);
      context.filter = 'none';
      if (smoothing !== 'pixel') await sharpenCanvas(canvas, Number(byId('quality-sharpness').value));
      if (sourceToken !== uploadTokens.quality) return;
      byId('quality-download').disabled = false;
      drawHistogram('quality', canvas);
      const actualWidthCm = centimetersAt300Dpi(width);
      const actualHeightCm = centimetersAt300Dpi(height);
      const limited = safetyScale < 0.999 ? ' · tamaño ajustado para proteger la memoria del dispositivo' : '';
      setStatus('quality-status', `${width} × ${height} px · ${actualWidthCm} × ${actualHeightCm} cm a 300 DPI${limited}.`);
    } catch (error) {
      if (sourceToken !== uploadTokens.quality) return;
      console.error('No se pudo procesar la imagen:', error);
      byId('quality-download').disabled = true;
      setStatus('quality-status', 'El dispositivo no pudo procesar ese tamaño. Probá con un ancho menor.');
      showToast('Probá con un ancho de impresión menor.');
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
    halftone: ['halftone-range', 'halftone-amount', 'halftone-solid-protection', 'halftone-keep-solids', 'halftone-width-cm', 'halftone-frequency', 'halftone-dot-size', 'halftone-mode', 'halftone-mask-mode', 'halftone-mask-tolerance', 'halftone-angle', 'halftone-contrast', 'halftone-shape', 'halftone-color', 'halftone-background-color', 'halftone-transparent', 'halftone-invert'],
    background: ['background-mode', 'background-color', 'background-tolerance', 'background-softness', 'background-decontaminate', 'background-trim'],
    quality: ['quality-width-cm', 'quality-smoothing', 'quality-brightness', 'quality-contrast', 'quality-saturation', 'quality-sharpness']
  };

  const captureSettings = type => Object.fromEntries(settingIds[type].map(id => {
    const element = byId(id);
    return [id, element.type === 'checkbox' ? element.checked : element.value];
  }));

  const updateHistoryButtons = () => {
    const history = histories[activeTool];
    byId('tool-undo').disabled = history.index <= 0;
    byId('tool-redo').disabled = history.index >= history.entries.length - 1;
  };

  const recordHistory = type => {
    const history = histories[type];
    const snapshot = captureSettings(type);
    const serialized = JSON.stringify(snapshot);
    if (history.index >= 0 && JSON.stringify(history.entries[history.index]) === serialized) return;
    history.entries = history.entries.slice(0, history.index + 1);
    history.entries.push(snapshot);
    if (history.entries.length > 30) history.entries.shift();
    history.index = history.entries.length - 1;
    if (type === activeTool) updateHistoryButtons();
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

  const syncSettingLabels = type => {
    if (type === 'halftone') {
      byId('halftone-frequency-value').textContent = `${byId('halftone-frequency').value} LPI`;
      byId('halftone-angle-value').textContent = `${byId('halftone-angle').value}°`;
      byId('halftone-contrast-value').textContent = byId('halftone-contrast').value;
      byId('halftone-mask-tolerance-value').textContent = byId('halftone-mask-tolerance').value;
      byId('halftone-amount-value').textContent = `${byId('halftone-amount').value}%`;
      byId('halftone-solid-protection-value').textContent = `${byId('halftone-solid-protection').value}%`;
      byId('halftone-dot-size-value').textContent = `${Number(byId('halftone-dot-size').value).toFixed(2)} mm`;
      syncHalftoneMode();
    } else if (type === 'background') {
      byId('background-tolerance-value').textContent = byId('background-tolerance').value;
      byId('background-softness-value').textContent = byId('background-softness').value;
    } else {
      ['brightness', 'contrast', 'saturation', 'sharpness'].forEach(name => {
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
    const defaults = { 'halftone-range': 'transitions', 'halftone-amount': '55', 'halftone-solid-protection': '75', 'halftone-keep-solids': true, 'halftone-width-cm': '28', 'halftone-frequency': '55', 'halftone-dot-size': '0.40', 'halftone-mode': 'original', 'halftone-mask-mode': 'edge', 'halftone-mask-tolerance': '38', 'halftone-angle': '45', 'halftone-contrast': '12', 'halftone-shape': 'circle', 'halftone-color': '#000000', 'halftone-background-color': '#ffffff', 'halftone-transparent': true, 'halftone-invert': false };
    applySettings('halftone', defaults);
  };

  const resetQuality = () => {
    const defaults = { 'quality-width-cm': '30', 'quality-smoothing': 'illustration', 'quality-brightness': '0', 'quality-contrast': '0', 'quality-saturation': '0', 'quality-sharpness': '35' };
    applySettings('quality', defaults);
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
    clearTimeout(renderTimers[type]);
    previewViews[type] = view;
    updatePreviewButtons(type);
    if (view === 'original') showOriginal(type);
    else if (type === 'halftone') renderHalftone();
    else if (type === 'background') renderBackground(view === 'mask');
    else if (byId('quality-download').disabled) processQuality();
    else showResult('quality');
  };

  const switchTool = target => {
    const typeByTarget = { semitonos: 'halftone', 'eliminar-fondo': 'background', 'mejorar-calidad': 'quality' };
    activeTool = typeByTarget[target] || 'halftone';
    document.querySelectorAll('.tool-panel').forEach(panel => { panel.hidden = panel.id !== target; });
    document.querySelectorAll('[data-tool-target]').forEach(button => {
      const selected = button.dataset.toolTarget === target;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    updateDocumentInfo(activeTool);
    updateHistoryButtons();
    if (history.replaceState) history.replaceState(null, '', `#${target}`);
  };

  const processFile = async (file, type, input = null) => {
    if (!file) return;
    const token = ++uploadTokens[type];
    let source = null;
    let accepted = false;
    try {
      setStatus(`${type}-status`, 'Cargando imagen…');
      source = await loadImageFile(file);
      if (token !== uploadTokens[type]) {
        URL.revokeObjectURL(source.sourceUrl);
        return;
      }
      const previousSourceUrl = states[type]?.sourceUrl;
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
    } catch (error) {
      if (token !== uploadTokens[type]) return;
      if (source?.sourceUrl && !accepted) URL.revokeObjectURL(source.sourceUrl);
      setStatus(`${type}-status`, error.message);
      showToast(error.message);
      if (input) input.value = '';
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
    dropZone.addEventListener('drop', event => processFile([...event.dataTransfer.files].find(file => file.type.startsWith('image/')), type, input));
  };

  const resetBackground = () => {
    byId('background-mode').value = 'remove';
    byId('background-color').value = '#ffffff';
    byId('background-tolerance').value = '45';
    byId('background-softness').value = '25';
    byId('background-tolerance-value').textContent = '45';
    byId('background-softness-value').textContent = '25';
    byId('background-decontaminate').checked = true;
    byId('background-trim').checked = false;
    pickBackgroundColor();
  };

  const invalidateQualityResult = () => {
    if (!states.quality) return;
    byId('quality-download').disabled = true;
    updateQualityAssessment();
    setStatus('quality-status', 'Cambiaste los ajustes · procesá nuevamente para actualizar la descarga.');
  };

  const initializeTools = () => {
    document.querySelectorAll('[data-tool-target]').forEach(button => button.addEventListener('click', () => switchTool(button.dataset.toolTarget)));
    const initialTarget = ['semitonos', 'eliminar-fondo', 'mejorar-calidad'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'semitonos';
    switchTool(initialTarget);

    ['halftone', 'background', 'quality'].forEach(setupDropUpload);
    document.addEventListener('paste', event => {
      const image = [...(event.clipboardData?.items || [])].find(item => item.type.startsWith('image/'))?.getAsFile();
      if (image) processFile(image, activeTool, byId(`${activeTool}-file`));
    });

    bindRange('halftone-frequency', 'halftone-frequency-value', ' LPI', () => scheduleRender('halftone', renderHalftone));
    bindRange('halftone-angle', 'halftone-angle-value', '°', () => scheduleRender('halftone', renderHalftone));
    bindRange('halftone-contrast', 'halftone-contrast-value', '', () => scheduleRender('halftone', renderHalftone));
    bindRange('halftone-mask-tolerance', 'halftone-mask-tolerance-value', '', () => scheduleRender('halftone', renderHalftone));
    bindRange('halftone-amount', 'halftone-amount-value', '%', () => scheduleRender('halftone', renderHalftone));
    bindRange('halftone-solid-protection', 'halftone-solid-protection-value', '%', () => scheduleRender('halftone', renderHalftone));
    const halftoneDotSize = byId('halftone-dot-size');
    halftoneDotSize.addEventListener('input', () => {
      byId('halftone-dot-size-value').textContent = `${Number(halftoneDotSize.value).toFixed(2)} mm`;
      scheduleRender('halftone', renderHalftone, 140);
    });
    byId('halftone-width-cm').addEventListener('input', () => scheduleRender('halftone', renderHalftone, 260));
    ['halftone-color', 'halftone-background-color'].forEach(id => byId(id).addEventListener('input', () => scheduleRender('halftone', renderHalftone)));
    ['halftone-range', 'halftone-shape', 'halftone-transparent', 'halftone-invert', 'halftone-keep-solids'].forEach(id => byId(id).addEventListener('change', () => scheduleRender('halftone', renderHalftone, 0)));
    ['halftone-mode', 'halftone-mask-mode'].forEach(id => byId(id).addEventListener('change', () => {
      syncHalftoneMode();
      scheduleRender('halftone', renderHalftone, 0);
    }));
    syncHalftoneMode();
    const halftonePresets = {
      suave: { range: 'shadows', amount: 30, protection: 88, frequency: 48, dotSize: 0.45, angle: 45, shape: 'circle', contrast: 6 },
      balanceado: { range: 'transitions', amount: 52, protection: 78, frequency: 55, dotSize: 0.40, angle: 45, shape: 'circle', contrast: 12 },
      fino: { range: 'transitions', amount: 42, protection: 86, frequency: 68, dotSize: 0.30, angle: 45, shape: 'ellipse', contrast: 14 },
      lineas: { range: 'midtones', amount: 35, protection: 76, frequency: 60, dotSize: 0.35, angle: 45, shape: 'line', contrast: 12 }
    };
    document.querySelectorAll('[data-halftone-preset]').forEach(button => button.addEventListener('click', () => {
      const preset = halftonePresets[button.dataset.halftonePreset];
      byId('halftone-range').value = preset.range;
      byId('halftone-amount').value = preset.amount;
      byId('halftone-solid-protection').value = preset.protection;
      byId('halftone-frequency').value = preset.frequency;
      byId('halftone-dot-size').value = preset.dotSize;
      byId('halftone-angle').value = preset.angle;
      byId('halftone-shape').value = preset.shape;
      byId('halftone-contrast').value = preset.contrast;
      byId('halftone-frequency-value').textContent = `${preset.frequency} LPI`;
      byId('halftone-angle-value').textContent = `${preset.angle}°`;
      byId('halftone-contrast-value').textContent = String(preset.contrast);
      byId('halftone-amount-value').textContent = `${preset.amount}%`;
      byId('halftone-solid-protection-value').textContent = `${preset.protection}%`;
      byId('halftone-dot-size-value').textContent = `${preset.dotSize.toFixed(2)} mm`;
      document.querySelectorAll('[data-halftone-preset]').forEach(item => item.classList.toggle('active', item === button));
      scheduleRender('halftone', renderHalftone, 0);
      recordHistory('halftone');
    }));
    byId('halftone-download').addEventListener('click', () => {
      if (!states.halftone) return;
      renderHalftone();
      downloadCanvas(byId('halftone-canvas'), `${states.halftone.filename}-semitono-300dpi.png`);
    });

    bindRange('background-tolerance', 'background-tolerance-value', '', () => scheduleRender('background', renderActiveBackground));
    bindRange('background-softness', 'background-softness-value', '', () => scheduleRender('background', renderActiveBackground));
    byId('background-color').addEventListener('input', () => scheduleRender('background', renderActiveBackground));
    byId('background-mode').addEventListener('change', () => scheduleRender('background', renderActiveBackground, 0));
    byId('background-decontaminate').addEventListener('change', () => scheduleRender('background', renderActiveBackground, 0));
    document.querySelectorAll('[data-background-color]').forEach(button => button.addEventListener('click', () => {
      byId('background-color').value = button.dataset.backgroundColor;
      scheduleRender('background', renderActiveBackground, 0);
      recordHistory('background');
    }));
    byId('background-corner').addEventListener('click', () => pickBackgroundColor());
    byId('background-reset').addEventListener('click', () => { resetBackground(); recordHistory('background'); });
    byId('background-canvas').addEventListener('click', event => pickBackgroundColor(event.clientX, event.clientY));
    byId('background-download').addEventListener('click', () => {
      if (!states.background) return;
      renderBackground();
      const canvas = byId('background-trim').checked ? trimTransparentCanvas(byId('background-canvas')) : byId('background-canvas');
      downloadCanvas(canvas, `${states.background.filename}-sin-color-300dpi.png`);
    });

    bindRange('quality-sharpness', 'quality-sharpness-value', '', invalidateQualityResult);
    bindRange('quality-brightness', 'quality-brightness-value', '', invalidateQualityResult);
    bindRange('quality-contrast', 'quality-contrast-value', '', invalidateQualityResult);
    bindRange('quality-saturation', 'quality-saturation-value', '', invalidateQualityResult);
    byId('quality-width-cm').addEventListener('input', invalidateQualityResult);
    byId('quality-smoothing').addEventListener('change', invalidateQualityResult);
    document.querySelectorAll('[data-quality-width]').forEach(button => button.addEventListener('click', () => {
      byId('quality-width-cm').value = button.dataset.qualityWidth;
      document.querySelectorAll('[data-quality-width]').forEach(item => item.classList.toggle('active', item === button));
      invalidateQualityResult();
      recordHistory('quality');
    }));
    byId('quality-process').addEventListener('click', processQuality);
    byId('quality-download').addEventListener('click', () => states.quality && downloadCanvas(byId('quality-canvas'), `${states.quality.filename}-300dpi.png`));

    Object.entries(settingIds).forEach(([type, ids]) => ids.forEach(id => byId(id).addEventListener('change', () => recordHistory(type))));
    byId('tool-undo').addEventListener('click', () => moveHistory(-1));
    byId('tool-redo').addEventListener('click', () => moveHistory(1));
    byId('tool-reset-current').addEventListener('click', () => {
      if (activeTool === 'halftone') resetHalftone();
      else if (activeTool === 'background') resetBackground();
      else resetQuality();
      recordHistory(activeTool);
    });
    document.addEventListener('keydown', event => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      event.preventDefault();
      moveHistory(event.shiftKey ? 1 : -1);
    });

    document.querySelectorAll('[data-preview-tool]').forEach(button => button.addEventListener('click', () => showPreview(button.dataset.previewTool, button.dataset.previewView)));
    document.querySelectorAll('[data-preview-zoom]').forEach(select => select.addEventListener('change', () => {
      const canvas = byId(`${select.dataset.previewZoom}-canvas`);
      const image = byId(`${select.dataset.previewZoom}-original`);
      canvas.style.width = `${select.value}%`;
      canvas.style.maxWidth = 'none';
      canvas.style.maxHeight = 'none';
      image.style.width = `${select.value}%`;
      image.style.maxWidth = 'none';
      image.style.maxHeight = 'none';
    }));
    document.querySelectorAll('[data-preview-background]').forEach(select => select.addEventListener('change', () => {
      const preview = byId(`${select.dataset.previewBackground}-preview`);
      preview.classList.toggle('checkerboard', select.value === 'checkerboard');
      preview.classList.toggle('preview-dark', select.value === 'dark');
      preview.classList.toggle('preview-light', select.value === 'light');
    }));
    window.addEventListener('beforeunload', () => Object.values(states).forEach(state => {
      if (state?.sourceUrl) URL.revokeObjectURL(state.sourceUrl);
    }));
    Object.keys(histories).forEach(recordHistory);
    updateHistoryButtons();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeTools);
  else initializeTools();
})();
