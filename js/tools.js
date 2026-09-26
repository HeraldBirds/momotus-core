(() => {
  'use strict';

  const EXPORT_DPI = 300;
  const PIXELS_PER_METER_300_DPI = 11811;
  const MAX_FILE_SIZE = 12 * 1024 * 1024;
  const MAX_WORKING_PIXELS = 12000000;
  const MAX_OUTPUT_SIDE = 5000;
  const states = { halftone: null, background: null, quality: null };

  const byId = id => document.getElementById(id);
  const setStatus = (id, message) => { const element = byId(id); if (element) element.textContent = message; };
  const hexToRgb = hex => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) });
  const rgbToHex = (r, g, b) => `#${[r, g, b].map(value => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const centimetersAt300Dpi = pixels => (pixels / EXPORT_DPI * 2.54).toFixed(1);

  const loadImageFile = (file, maxSide = 4500) => new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Escogé una imagen PNG, JPG o WebP.'));
    if (file.size > MAX_FILE_SIZE) return reject(new Error('La imagen debe pesar 12 MB o menos.'));
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const sideScale = maxSide / Math.max(image.naturalWidth, image.naturalHeight);
      const pixelScale = Math.sqrt(MAX_WORKING_PIXELS / (image.naturalWidth * image.naturalHeight));
      const scale = Math.min(1, sideScale, pixelScale);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      URL.revokeObjectURL(url);
      resolve({ image, width, height, filename: file.name.replace(/\.[^.]+$/, '') || 'momotus' });
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

  const renderHalftone = () => {
    const state = states.halftone;
    if (!state) return;
    const canvas = byId('halftone-canvas');
    const context = canvas.getContext('2d');
    const frequency = Number(byId('halftone-frequency').value);
    const cellSize = EXPORT_DPI / frequency;
    const angleDegrees = Number(byId('halftone-angle').value);
    const angle = angleDegrees * Math.PI / 180;
    const contrast = Number(byId('halftone-contrast').value);
    const invert = byId('halftone-invert').checked;
    const transparent = byId('halftone-transparent').checked;
    const shape = byId('halftone-shape').value;
    canvas.width = state.width;
    canvas.height = state.height;
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!transparent) {
      context.fillStyle = byId('halftone-background-color').value;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.fillStyle = byId('halftone-color').value;
    const data = state.imageData.data;
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    const cosine = Math.cos(angle), sine = Math.sin(angle);
    const centerX = state.width / 2, centerY = state.height / 2;
    const diagonal = Math.hypot(state.width, state.height);
    for (let gridY = -diagonal / 2; gridY <= diagonal / 2; gridY += cellSize) {
      for (let gridX = -diagonal / 2; gridX <= diagonal / 2; gridX += cellSize) {
        const x = centerX + gridX * cosine - gridY * sine;
        const y = centerY + gridX * sine + gridY * cosine;
        if (x < 0 || y < 0 || x >= state.width || y >= state.height) continue;
        const sampleX = Math.min(state.width - 1, Math.max(0, Math.round(x)));
        const sampleY = Math.min(state.height - 1, Math.max(0, Math.round(y)));
        const index = (sampleY * state.width + sampleX) * 4;
        const alpha = data[index + 3] / 255;
        const luminance = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
        const adjusted = Math.max(0, Math.min(255, factor * (luminance - 128) + 128));
        const tone = invert ? adjusted / 255 : 1 - adjusted / 255;
        const radius = Math.max(0, tone * alpha * cellSize * 0.52);
        if (radius >= 0.25) drawHalftoneShape(context, shape, x, y, radius, angle);
      }
    }
    setStatus('halftone-status', `${state.width} × ${state.height} px · ${frequency} LPI · ${angleDegrees}° · salida 300 DPI.`);
  };

  const renderBackground = () => {
    const state = states.background;
    if (!state) return;
    const canvas = byId('background-canvas');
    const context = canvas.getContext('2d');
    const output = new ImageData(new Uint8ClampedArray(state.imageData.data), state.width, state.height);
    const key = hexToRgb(byId('background-color').value);
    const tolerance = Number(byId('background-tolerance').value);
    const softness = Number(byId('background-softness').value);
    const data = output.data;
    let affected = 0;
    for (let index = 0; index < data.length; index += 4) {
      const originalAlpha = data[index + 3];
      const distance = Math.hypot(data[index] - key.r, data[index + 1] - key.g, data[index + 2] - key.b);
      if (distance <= tolerance) data[index + 3] = 0;
      else if (softness > 0 && distance < tolerance + softness) data[index + 3] = Math.round(originalAlpha * (distance - tolerance) / softness);
      if (data[index + 3] < originalAlpha) affected++;
    }
    canvas.width = state.width;
    canvas.height = state.height;
    context.putImageData(output, 0, 0);
    const percentage = ((affected / (state.width * state.height)) * 100).toFixed(1);
    setStatus('background-status', `${percentage}% de píxeles afectados en toda la imagen · salida 300 DPI.`);
  };

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
    renderBackground();
  };

  const sharpenCanvas = (canvas, strength) => {
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
        for (let channel = 0; channel < 3; channel++) {
          const center = src[index + channel];
          const neighbors = src[index - 4 + channel] + src[index + 4 + channel] + src[index - width * 4 + channel] + src[index + width * 4 + channel];
          dst[index + channel] = Math.max(0, Math.min(255, center + amount * (4 * center - neighbors)));
        }
        dst[index + 3] = src[index + 3];
      }
    }
    context.putImageData(output, 0, 0);
  };

  const processQuality = async () => {
    const state = states.quality;
    if (!state) return;
    const requestedWidthCm = Math.max(2, Math.min(45, Number(byId('quality-width-cm').value) || 30));
    byId('quality-width-cm').value = String(requestedWidthCm);
    const requestedWidth = Math.round(requestedWidthCm / 2.54 * EXPORT_DPI);
    const requestedHeight = Math.round(requestedWidth * state.height / state.width);
    const safetyScale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(requestedWidth, requestedHeight), Math.sqrt(MAX_WORKING_PIXELS / (requestedWidth * requestedHeight)));
    const width = Math.max(1, Math.round(requestedWidth * safetyScale));
    const height = Math.max(1, Math.round(requestedHeight * safetyScale));
    setStatus('quality-status', 'Procesando imagen…');
    byId('quality-process').disabled = true;
    await nextFrame();
    const canvas = byId('quality-canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(state.image, 0, 0, width, height);
    sharpenCanvas(canvas, Number(byId('quality-sharpness').value));
    byId('quality-process').disabled = false;
    byId('quality-download').disabled = false;
    const actualWidthCm = centimetersAt300Dpi(width);
    const actualHeightCm = centimetersAt300Dpi(height);
    const limited = safetyScale < 0.999 ? ' · tamaño ajustado para proteger la memoria del dispositivo' : '';
    setStatus('quality-status', `${width} × ${height} px · ${actualWidthCm} × ${actualHeightCm} cm a 300 DPI${limited}.`);
  };

  const bindRange = (inputId, valueId, suffix, callback) => {
    const input = byId(inputId);
    input.addEventListener('input', () => { byId(valueId).textContent = `${input.value}${suffix}`; callback?.(); });
  };

  const handleUpload = async (event, type) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setStatus(`${type}-status`, 'Cargando imagen…');
      const source = await loadImageFile(file);
      if (type === 'halftone') {
        const prepared = drawSource(source);
        states.halftone = { ...source, imageData: prepared.imageData };
        byId('halftone-download').disabled = false;
        renderHalftone();
      } else if (type === 'background') {
        const prepared = drawSource(source);
        states.background = { ...source, imageData: prepared.imageData };
        byId('background-download').disabled = false;
        byId('background-corner').disabled = false;
        pickBackgroundColor();
      } else {
        states.quality = source;
        byId('quality-process').disabled = false;
        byId('quality-download').disabled = true;
        const canvas = byId('quality-canvas');
        canvas.width = source.width;
        canvas.height = source.height;
        canvas.getContext('2d').drawImage(source.image, 0, 0, source.width, source.height);
        setStatus('quality-status', `${source.width} × ${source.height} px · escogé el ancho y procesá a 300 DPI.`);
      }
    } catch (error) {
      setStatus(`${type}-status`, error.message);
      showToast(error.message);
      event.target.value = '';
    }
  };

  const initializeTools = () => {
    byId('halftone-file')?.addEventListener('change', event => handleUpload(event, 'halftone'));
    bindRange('halftone-frequency', 'halftone-frequency-value', ' LPI', renderHalftone);
    bindRange('halftone-angle', 'halftone-angle-value', '°', renderHalftone);
    bindRange('halftone-contrast', 'halftone-contrast-value', '', renderHalftone);
    ['halftone-color', 'halftone-background-color'].forEach(id => byId(id).addEventListener('input', renderHalftone));
    ['halftone-shape', 'halftone-transparent', 'halftone-invert'].forEach(id => byId(id).addEventListener('change', renderHalftone));
    byId('halftone-download').addEventListener('click', () => states.halftone && downloadCanvas(byId('halftone-canvas'), `${states.halftone.filename}-semitono-300dpi.png`));

    byId('background-file')?.addEventListener('change', event => handleUpload(event, 'background'));
    bindRange('background-tolerance', 'background-tolerance-value', '', renderBackground);
    bindRange('background-softness', 'background-softness-value', '', renderBackground);
    byId('background-color').addEventListener('input', renderBackground);
    document.querySelectorAll('[data-background-color]').forEach(button => button.addEventListener('click', () => {
      byId('background-color').value = button.dataset.backgroundColor;
      renderBackground();
    }));
    byId('background-corner').addEventListener('click', () => pickBackgroundColor());
    byId('background-canvas').addEventListener('click', event => pickBackgroundColor(event.clientX, event.clientY));
    byId('background-download').addEventListener('click', () => states.background && downloadCanvas(byId('background-canvas'), `${states.background.filename}-sin-color-300dpi.png`));

    byId('quality-file')?.addEventListener('change', event => handleUpload(event, 'quality'));
    bindRange('quality-sharpness', 'quality-sharpness-value', '', null);
    byId('quality-width-cm').addEventListener('change', () => { if (states.quality) byId('quality-download').disabled = true; });
    byId('quality-process').addEventListener('click', processQuality);
    byId('quality-download').addEventListener('click', () => states.quality && downloadCanvas(byId('quality-canvas'), `${states.quality.filename}-300dpi.png`));
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeTools);
  else initializeTools();
})();
