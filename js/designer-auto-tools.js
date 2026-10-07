(() => {
  'use strict';

  const WORKER_PATH = 'herramientas/js/tools-worker.js?v=20261006-1';
  const MAX_OUTPUT_PIXELS = 8_000_000;
  const MAX_OUTPUT_SIDE = 3600;
  const QUALITY_MIN_SIDE = 1600;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const loadImage = source => new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('No se pudo abrir el diseño activo.'));
    image.src = source;
  });

  const createCanvas = (width, height) => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width));
    canvas.height = Math.max(1, Math.round(height));
    return canvas;
  };

  const runWorker = (kind, payload, onProgress) => new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(WORKER_PATH);
    } catch (error) {
      reject(new Error('El navegador no pudo iniciar el procesamiento local.'));
      return;
    }
    const finish = callback => value => {
      worker.terminate();
      callback(value);
    };
    worker.onmessage = event => {
      if (event.data?.type === 'progress') {
        onProgress?.(clamp(Math.round(Number(event.data.value) || 0), 0, 100));
        return;
      }
      if (event.data?.type === 'result') finish(resolve)(event.data.result);
      if (event.data?.type === 'error') finish(reject)(new Error(event.data.message || 'No se pudo procesar la imagen.'));
    };
    worker.onerror = finish(reject);
    worker.postMessage({ kind, payload }, [payload.buffer]);
  });

  const sampleBackground = imageData => {
    const { data, width, height } = imageData;
    const samples = [];
    const step = Math.max(1, Math.floor((width * 2 + height * 2) / 2400));
    const add = (x, y) => {
      const index = (y * width + x) * 4;
      samples.push({ r: data[index], g: data[index + 1], b: data[index + 2], a: data[index + 3] });
    };
    for (let x = 0; x < width; x += step) {
      add(x, 0);
      if (height > 1) add(x, height - 1);
    }
    for (let y = step; y < height - 1; y += step) {
      add(0, y);
      if (width > 1) add(width - 1, y);
    }

    const opaque = samples.filter(sample => sample.a >= 40);
    const transparentShare = 1 - opaque.length / Math.max(1, samples.length);
    if (transparentShare >= 0.72) return { alreadyTransparent: true };
    if (opaque.length < 12) throw new Error('No se pudo identificar un fondo uniforme.');

    const groups = new Map();
    opaque.forEach(sample => {
      const key = `${sample.r >> 5}-${sample.g >> 5}-${sample.b >> 5}`;
      const group = groups.get(key) || { count: 0, r: 0, g: 0, b: 0, samples: [] };
      group.count += 1;
      group.r += sample.r;
      group.g += sample.g;
      group.b += sample.b;
      group.samples.push(sample);
      groups.set(key, group);
    });
    const dominant = Array.from(groups.values()).sort((left, right) => right.count - left.count)[0];
    const confidence = dominant.count / opaque.length;
    if (confidence < 0.22) {
      throw new Error('El fondo tiene muchos colores. Abrí Herramientas DTF para ajustarlo manualmente.');
    }
    const target = {
      r: Math.round(dominant.r / dominant.count),
      g: Math.round(dominant.g / dominant.count),
      b: Math.round(dominant.b / dominant.count)
    };
    const spread = dominant.samples.reduce((total, sample) => total + Math.hypot(
      sample.r - target.r,
      sample.g - target.g,
      sample.b - target.b
    ), 0) / dominant.count;
    return {
      alreadyTransparent: false,
      target,
      tolerance: clamp(Math.round(32 + spread * 1.15), 32, 68),
      softness: clamp(Math.round(22 + spread * 0.55), 22, 42)
    };
  };

  const canvasToDataURL = (canvas, type = 'image/png', quality) => {
    const result = canvas.toDataURL(type, quality);
    if (type === 'image/webp' && !result.startsWith('data:image/webp')) return canvas.toDataURL('image/png');
    return result;
  };

  const removeBackground = async (source, onProgress) => {
    onProgress?.(5);
    const image = await loadImage(source);
    if (image.naturalWidth * image.naturalHeight > MAX_OUTPUT_PIXELS || Math.max(image.naturalWidth, image.naturalHeight) > MAX_OUTPUT_SIDE) {
      throw new Error('Esta imagen necesita el eliminador de fondo de Herramientas DTF. El original se conserva sin reducir su resolución.');
    }
    const canvas = createCanvas(image.naturalWidth, image.naturalHeight);
    const context = canvas.getContext('2d', { willReadFrequently: true, alpha: true });
    context.drawImage(image, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const analysis = sampleBackground(imageData);
    if (analysis.alreadyTransparent) {
      throw new Error('Este diseño ya tiene el fondo transparente.');
    }
    onProgress?.(12);
    const result = await runWorker('background', {
      buffer: imageData.data.buffer,
      width: canvas.width,
      height: canvas.height,
      target: analysis.target,
      tolerance: analysis.tolerance,
      softness: analysis.softness,
      mode: 'remove',
      scope: 'connected',
      decontaminate: true,
      maskPreview: false,
      edgeShift: 0
    }, progress => onProgress?.(12 + Math.round(progress * 0.82)));
    const affectedShare = Number(result.affected || 0) / Math.max(1, canvas.width * canvas.height);
    if (affectedShare < 0.003) throw new Error('No se detectó un fondo que se pueda eliminar automáticamente.');
    if (affectedShare > 0.96) throw new Error('La detección abarcaría casi toda la imagen y se canceló para proteger el diseño.');
    context.putImageData(new ImageData(new Uint8ClampedArray(result.buffer), canvas.width, canvas.height), 0, 0);
    onProgress?.(100);
    return {
      dataUrl: canvasToDataURL(canvas, 'image/png'),
      width: canvas.width,
      height: canvas.height,
      message: 'Fondo eliminado automáticamente'
    };
  };

  const improveQuality = async (source, onProgress) => {
    onProgress?.(5);
    const image = await loadImage(source);
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    const shortestSide = Math.max(1, Math.min(sourceWidth, sourceHeight));
    const longestSide = Math.max(sourceWidth, sourceHeight);
    const desiredScale = shortestSide < QUALITY_MIN_SIDE ? Math.min(3, QUALITY_MIN_SIDE / shortestSide) : 1;
    const resourceScale = Math.min(MAX_OUTPUT_SIDE / longestSide, Math.sqrt(MAX_OUTPUT_PIXELS / (sourceWidth * sourceHeight)));
    if (resourceScale < 1) {
      throw new Error('La imagen supera el límite del ajuste automático. Se conserva el original; usá Herramientas DTF para preparar una copia con el tamaño de impresión deseado.');
    }
    const scale = Math.max(1, Math.min(desiredScale, resourceScale));
    const canvas = createCanvas(sourceWidth * scale, sourceHeight * scale);
    const context = canvas.getContext('2d', { willReadFrequently: true, alpha: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    onProgress?.(18);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = await runWorker('enhance', {
      buffer: imageData.data.buffer,
      width: canvas.width,
      height: canvas.height,
      sharpness: 46,
      clarity: 24,
      denoise: 12,
      recovery: 24
    }, progress => onProgress?.(18 + Math.round(progress * 0.76)));
    context.putImageData(new ImageData(new Uint8ClampedArray(result.buffer), canvas.width, canvas.height), 0, 0);
    onProgress?.(100);
    return {
      dataUrl: canvasToDataURL(canvas, 'image/png'),
      width: canvas.width,
      height: canvas.height,
      message: `Calidad mejorada a ${canvas.width}×${canvas.height} px`
    };
  };

  const process = (source, tool, onProgress) => {
    if (typeof source !== 'string' || !source) return Promise.reject(new Error('No hay un diseño activo.'));
    if (tool === 'background') return removeBackground(source, onProgress);
    if (tool === 'quality') return improveQuality(source, onProgress);
    return Promise.reject(new Error('La acción seleccionada no es válida.'));
  };

  window.MomotusDesignerAutoTools = Object.freeze({ process });
})();
