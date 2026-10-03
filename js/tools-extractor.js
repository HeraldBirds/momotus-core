(() => {
  'use strict';

  if (!window.MOMOTUS_TOOLS_DESKTOP) return;

  const byId = id => document.getElementById(id);
  const api = () => window.MomotusToolsAPI;
  const MAX_FILE_SIZE = 24 * 1024 * 1024;
  const MAX_PREVIEW_PIXELS = 4200000;
  const MAX_EXPORT_PIXELS = 12000000;
  const MAX_EXPORT_SIDE = 6000;
  const SUPPORTED_EXTENSION = /\.(?:png|jpe?g|webp)$/i;
  const renderControls = [
    'extractor-source-bg', 'extractor-source-color', 'extractor-scope', 'extractor-tolerance',
    'extractor-softness', 'extractor-refine', 'extractor-edge', 'extractor-specks', 'extractor-decontaminate', 'extractor-output-bg', 'extractor-output-color',
    'extractor-adapt', 'extractor-brightness', 'extractor-contrast', 'extractor-saturation',
    'extractor-vibrance', 'extractor-sharpen', 'extractor-outline', 'extractor-outline-color', 'extractor-outline-width'
  ];
  const state = {
    image: null,
    sourceUrl: '',
    filename: 'momotus-diseno-extraido',
    sourceCanvas: null,
    resultCanvas: null,
    maskCanvas: null,
    view: 'result',
    dialogView: 'result',
    fitDesign: true,
    previewRect: null,
    dialogPreviewRect: null,
    pickingMode: '',
    samples: [],
    manualMask: null,
    brushMode: 'remove',
    brushing: false,
    lastBrushPoint: null,
    renderTimer: 0,
    renderToken: 0
  };

  const clamp = (value, minimum = 0, maximum = 255) => Math.max(minimum, Math.min(maximum, value));
  const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
  const setStatus = message => {
    const status = byId('extractor-status');
    if (status) status.textContent = message;
  };
  const setBusy = (busy, message = 'Analizando el diseño…') => {
    const overlay = byId('extractor-busy');
    if (!overlay) return;
    overlay.hidden = !busy;
    const heading = overlay.querySelector('strong');
    if (heading) heading.textContent = message;
    const workspace = byId('editor-workspace-state');
    if (workspace && !byId('extractor-disenos')?.hidden) {
      workspace.className = `tool-workspace-state ${busy ? 'processing' : state.resultCanvas ? 'ready' : 'idle'}`;
      const label = workspace.querySelector('strong');
      if (label) label.textContent = busy ? 'Procesando' : state.resultCanvas ? 'Resultado listo' : 'Sin archivo';
    }
  };
  const safeFilename = value => String(value || 'momotus-diseno').replace(/\.[^.]+$/, '').replace(/[^a-z0-9áéíóúñ_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'momotus-diseno';
  const hexToRgb = hex => {
    const normalized = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#ffffff';
    return [parseInt(normalized.slice(1, 3), 16), parseInt(normalized.slice(3, 5), 16), parseInt(normalized.slice(5, 7), 16)];
  };
  const rgbToHex = (r, g, b) => `#${[r, g, b].map(channel => Math.round(clamp(channel)).toString(16).padStart(2, '0')).join('')}`;
  const colorDistance = (r, g, b, target) => Math.sqrt(2 * (r - target[0]) ** 2 + 4 * (g - target[1]) ** 2 + 3 * (b - target[2]) ** 2) / 3;
  const rgbToHsl = (r, g, b) => {
    r = clamp(r) / 255; g = clamp(g) / 255; b = clamp(b) / 255;
    const maximum = Math.max(r, g, b);
    const minimum = Math.min(r, g, b);
    const lightness = (maximum + minimum) / 2;
    if (maximum === minimum) return [0, 0, lightness];
    const difference = maximum - minimum;
    const saturation = lightness > 0.5 ? difference / (2 - maximum - minimum) : difference / (maximum + minimum);
    let hue = maximum === r ? (g - b) / difference + (g < b ? 6 : 0) : maximum === g ? (b - r) / difference + 2 : (r - g) / difference + 4;
    hue /= 6;
    return [hue, saturation, lightness];
  };
  const hslToRgb = (hue, saturation, lightness) => {
    if (!saturation) return [lightness * 255, lightness * 255, lightness * 255];
    const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation;
    const p = 2 * lightness - q;
    const channel = value => {
      if (value < 0) value += 1;
      if (value > 1) value -= 1;
      if (value < 1 / 6) return p + (q - p) * 6 * value;
      if (value < 1 / 2) return q;
      if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
      return p;
    };
    return [channel(hue + 1 / 3) * 255, channel(hue) * 255, channel(hue - 1 / 3) * 255];
  };

  const isSupported = file => Boolean(file && (
    ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(String(file.type || '').toLowerCase())
    || SUPPORTED_EXTENSION.test(file.name || '')
  ));

  const loadImage = file => new Promise((resolve, reject) => {
    if (!isSupported(file)) return reject(new Error('Escogé una imagen PNG, JPG o WebP.'));
    if (file.size > MAX_FILE_SIZE) return reject(new Error('La imagen debe pesar 24 MB o menos.'));
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve({ image, url });
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer esa imagen.')); };
    image.src = url;
  });

  const canvasFromImage = (image, maximumPixels = MAX_PREVIEW_PIXELS, maximumSide = 3000) => {
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    const scale = Math.min(1, maximumSide / Math.max(naturalWidth, naturalHeight), Math.sqrt(maximumPixels / (naturalWidth * naturalHeight)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(naturalHeight * scale));
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  };

  const detectEdgePalette = canvas => {
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const sampleSize = Math.max(2, Math.min(18, Math.round(Math.min(canvas.width, canvas.height) * 0.025)));
    const right = Math.max(0, canvas.width - sampleSize);
    const bottom = Math.max(0, canvas.height - sampleSize);
    const quarterX = Math.max(0, Math.round((canvas.width - sampleSize) * 0.25));
    const threeQuarterX = Math.max(0, Math.round((canvas.width - sampleSize) * 0.75));
    const quarterY = Math.max(0, Math.round((canvas.height - sampleSize) * 0.25));
    const threeQuarterY = Math.max(0, Math.round((canvas.height - sampleSize) * 0.75));
    const positions = [[0, 0], [right, 0], [0, bottom], [right, bottom], [quarterX, 0], [threeQuarterX, 0], [quarterX, bottom], [threeQuarterX, bottom], [0, quarterY], [0, threeQuarterY], [right, quarterY], [right, threeQuarterY]];
    const averages = positions.map(([x, y]) => {
      const pixels = context.getImageData(Math.max(0, x), Math.max(0, y), sampleSize, sampleSize).data;
      let r = 0, g = 0, b = 0, weight = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const alpha = pixels[index + 3] / 255;
        r += pixels[index] * alpha; g += pixels[index + 1] * alpha; b += pixels[index + 2] * alpha; weight += alpha;
      }
      return weight ? [r / weight, g / weight, b / weight] : [255, 255, 255];
    });
    const palette = [];
    averages.forEach(color => {
      if (!palette.some(existing => colorDistance(color[0], color[1], color[2], existing) < 7)) palette.push(color);
    });
    return palette.slice(0, 8);
  };

  const detectCornerColor = canvas => {
    const averages = detectEdgePalette(canvas);
    let best = averages[0];
    let bestScore = Infinity;
    averages.forEach(candidate => {
      const score = averages.reduce((total, other) => total + colorDistance(candidate[0], candidate[1], candidate[2], other), 0);
      if (score < bestScore) { best = candidate; bestScore = score; }
    });
    return best;
  };

  const getSourcePalette = canvas => {
    const mode = byId('extractor-source-bg').value;
    const base = mode === 'white' ? [[255, 255, 255]]
      : mode === 'black' ? [[0, 0, 0]]
        : mode === 'auto' ? detectEdgePalette(canvas)
          : [hexToRgb(byId('extractor-source-color').value)];
    state.samples.forEach(sample => {
      if (!base.some(existing => colorDistance(sample[0], sample[1], sample[2], existing) < 3)) base.push(sample);
    });
    return base;
  };

  const getOutputBackground = () => {
    const mode = byId('extractor-output-bg').value;
    if (mode === 'black') return [0, 0, 0];
    if (mode === 'white') return [255, 255, 255];
    if (mode === 'custom') return hexToRgb(byId('extractor-output-color').value);
    return null;
  };

  const nearestPaletteColor = (r, g, b, palette) => {
    let selected = palette[0];
    let distance = Infinity;
    palette.forEach(color => {
      const current = colorDistance(r, g, b, color);
      if (current < distance) { selected = color; distance = current; }
    });
    return { color: selected, distance };
  };

  const buildRemovalMask = (source, palette, tolerance, softness, scope) => {
    const { width, height, data } = source;
    const total = width * height;
    const alpha = new Uint8ClampedArray(total);
    const candidate = new Uint8Array(total);
    const maximumDistance = tolerance + Math.max(1, softness);
    for (let pixel = 0; pixel < total; pixel++) {
      const offset = pixel * 4;
      if (!data[offset + 3]) continue;
      const distance = nearestPaletteColor(data[offset], data[offset + 1], data[offset + 2], palette).distance;
      if (distance <= maximumDistance) candidate[pixel] = 1;
      const transition = softness ? clamp((distance - tolerance) / softness, 0, 1) : distance <= tolerance ? 0 : 1;
      alpha[pixel] = Math.round(transition * data[offset + 3]);
    }
    if (scope === 'global') return alpha;

    const connected = new Uint8Array(total);
    const queue = new Uint32Array(total);
    let head = 0, tail = 0;
    const enqueue = index => {
      if (!candidate[index] || connected[index]) return;
      connected[index] = 1;
      queue[tail++] = index;
    };
    for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
    for (let y = 1; y < height - 1; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
    while (head < tail) {
      const index = queue[head++];
      const x = index % width;
      if (x > 0) enqueue(index - 1);
      if (x + 1 < width) enqueue(index + 1);
      if (index >= width) enqueue(index - width);
      if (index + width < total) enqueue(index + width);
      if (x > 0 && index >= width) enqueue(index - width - 1);
      if (x + 1 < width && index >= width) enqueue(index - width + 1);
      if (x > 0 && index + width < total) enqueue(index + width - 1);
      if (x + 1 < width && index + width < total) enqueue(index + width + 1);
    }
    for (let pixel = 0; pixel < total; pixel++) if (!connected[pixel]) alpha[pixel] = data[pixel * 4 + 3];
    return alpha;
  };

  const adjustAlphaEdge = (alpha, width, height, shift) => {
    const radius = Math.min(12, Math.abs(Math.round(shift)));
    if (!radius) return alpha;
    let current = new Uint8ClampedArray(alpha);
    const expand = shift > 0;
    for (let pass = 0; pass < radius; pass++) {
      const next = new Uint8ClampedArray(current);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const index = y * width + x;
        let value = expand ? 0 : 255;
        for (let offsetY = -1; offsetY <= 1; offsetY++) for (let offsetX = -1; offsetX <= 1; offsetX++) {
          const sampleX = Math.max(0, Math.min(width - 1, x + offsetX));
          const sampleY = Math.max(0, Math.min(height - 1, y + offsetY));
          value = expand ? Math.max(value, current[sampleY * width + sampleX]) : Math.min(value, current[sampleY * width + sampleX]);
        }
        next[index] = value;
      }
      current = next;
    }
    return current;
  };

  const refineAlphaMask = (alpha, width, height, passes) => {
    let current = new Uint8ClampedArray(alpha);
    for (let pass = 0; pass < Math.min(2, Math.max(0, Math.round(passes))); pass++) {
      const next = new Uint8ClampedArray(current);
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const index = y * width + x;
        let sum = current[index] * 4;
        let weight = 4;
        if (x > 0) { sum += current[index - 1]; weight++; }
        if (x + 1 < width) { sum += current[index + 1]; weight++; }
        if (y > 0) { sum += current[index - width]; weight++; }
        if (y + 1 < height) { sum += current[index + width]; weight++; }
        const average = sum / weight;
        if (Math.abs(average - current[index]) > 8) next[index] = Math.round(average);
      }
      current = next;
    }
    return current;
  };

  const applyManualMask = (alpha, original, width, height) => {
    if (!state.manualMask || !state.sourceCanvas) return alpha;
    const maskWidth = state.sourceCanvas.width;
    const maskHeight = state.sourceCanvas.height;
    for (let y = 0; y < height; y++) {
      const sourceY = Math.min(maskHeight - 1, Math.floor(y / height * maskHeight));
      for (let x = 0; x < width; x++) {
        const sourceX = Math.min(maskWidth - 1, Math.floor(x / width * maskWidth));
        const correction = state.manualMask[sourceY * maskWidth + sourceX];
        if (correction === 0) alpha[y * width + x] = 0;
        else if (correction === 1) alpha[y * width + x] = original[(y * width + x) * 4 + 3];
      }
    }
    return alpha;
  };

  const removeSmallAlphaRegions = (alpha, width, height, minimumArea) => {
    const threshold = Math.max(0, Math.round(minimumArea));
    if (!threshold) return alpha;
    const total = width * height;
    const visited = new Uint8Array(total);
    const queue = new Uint32Array(total);
    for (let start = 0; start < total; start++) {
      if (visited[start] || alpha[start] < 16) continue;
      let head = 0, tail = 0;
      visited[start] = 1; queue[tail++] = start;
      while (head < tail) {
        const index = queue[head++];
        const x = index % width;
        const visit = neighbor => {
          if (neighbor < 0 || neighbor >= total || visited[neighbor] || alpha[neighbor] < 16) return;
          visited[neighbor] = 1; queue[tail++] = neighbor;
        };
        if (x > 0) visit(index - 1);
        if (x + 1 < width) visit(index + 1);
        if (index >= width) visit(index - width);
        if (index + width < total) visit(index + width);
      }
      if (tail < threshold) for (let index = 0; index < tail; index++) alpha[queue[index]] = 0;
    }
    return alpha;
  };

  const alphaBounds = (alpha, width, height) => {
    let left = width, top = height, right = -1, bottom = -1;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] < 8) continue;
      if (x < left) left = x; if (x > right) right = x; if (y < top) top = y; if (y > bottom) bottom = y;
    }
    return right < left ? null : { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1 };
  };

  const resolveOutlineColor = (output, alpha, background) => {
    const mode = byId('extractor-outline').value;
    if (mode === 'none' || !background) return null;
    if (mode === 'white') return [255, 255, 255];
    if (mode === 'black') return [0, 0, 0];
    if (mode === 'custom') return hexToRgb(byId('extractor-outline-color').value);
    const backgroundLuminance = 0.2126 * background[0] + 0.7152 * background[1] + 0.0722 * background[2];
    let edgeLuminance = 0, samples = 0;
    const { width, height, data } = output;
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const pixel = y * width + x;
      if (alpha[pixel] < 96) continue;
      if (alpha[pixel - 1] >= 16 && alpha[pixel + 1] >= 16 && alpha[pixel - width] >= 16 && alpha[pixel + width] >= 16) continue;
      const offset = pixel * 4;
      edgeLuminance += 0.2126 * data[offset] + 0.7152 * data[offset + 1] + 0.0722 * data[offset + 2];
      samples++;
    }
    if (samples && Math.abs(edgeLuminance / samples - backgroundLuminance) >= 68) return null;
    return backgroundLuminance < 128 ? [255, 255, 255] : [15, 15, 18];
  };

  const applyContrastOutline = (output, alpha, background) => {
    const color = resolveOutlineColor(output, alpha, background);
    if (!color) return;
    const bounds = alphaBounds(alpha, output.width, output.height);
    if (!bounds) return;
    const widthCm = Math.max(2, Number(byId('extractor-width-cm').value) || 28);
    const widthMm = Number(byId('extractor-outline-width').value) || 0.6;
    const radius = Math.max(1, Math.min(14, Math.round((widthMm / 10) / widthCm * bounds.width)));
    let dilated = new Uint8ClampedArray(alpha);
    for (let pass = 0; pass < radius; pass++) {
      const next = new Uint8ClampedArray(dilated);
      for (let y = 0; y < output.height; y++) for (let x = 0; x < output.width; x++) {
        const index = y * output.width + x;
        let value = dilated[index];
        if (x > 0) value = Math.max(value, dilated[index - 1]);
        if (x + 1 < output.width) value = Math.max(value, dilated[index + 1]);
        if (index >= output.width) value = Math.max(value, dilated[index - output.width]);
        if (index + output.width < dilated.length) value = Math.max(value, dilated[index + output.width]);
        next[index] = value;
      }
      dilated = next;
    }
    for (let pixel = 0; pixel < alpha.length; pixel++) {
      const outlineAlpha = Math.max(0, dilated[pixel] - alpha[pixel]) / 255;
      if (!outlineAlpha) continue;
      const offset = pixel * 4;
      const foregroundAlpha = output.data[offset + 3] / 255;
      const underAlpha = outlineAlpha * (1 - foregroundAlpha);
      const finalAlpha = foregroundAlpha + underAlpha;
      if (!finalAlpha) continue;
      output.data[offset] = (output.data[offset] * foregroundAlpha + color[0] * underAlpha) / finalAlpha;
      output.data[offset + 1] = (output.data[offset + 1] * foregroundAlpha + color[1] * underAlpha) / finalAlpha;
      output.data[offset + 2] = (output.data[offset + 2] * foregroundAlpha + color[2] * underAlpha) / finalAlpha;
      output.data[offset + 3] = Math.round(finalAlpha * 255);
    }
  };

  const adaptPixel = (r, g, b, background) => {
    const brightness = Number(byId('extractor-brightness').value) / 100;
    const contrast = Number(byId('extractor-contrast').value) / 100;
    const saturation = Number(byId('extractor-saturation').value) / 100;
    const vibrance = Number(byId('extractor-vibrance').value) / 100;
    const adapt = background ? Number(byId('extractor-adapt').value) / 100 : 0;
    let luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const maximum = Math.max(r, g, b);
    const minimum = Math.min(r, g, b);
    const chroma = maximum ? (maximum - minimum) / maximum : 0;
    const selectiveSaturation = saturation * (1 + vibrance * (1 - chroma) * 0.45);
    r = luminance + (r - luminance) * selectiveSaturation;
    g = luminance + (g - luminance) * selectiveSaturation;
    b = luminance + (b - luminance) * selectiveSaturation;
    const contrastFactor = 1 + contrast;
    r = (r - 128) * contrastFactor + 128 + brightness * 255;
    g = (g - 128) * contrastFactor + 128 + brightness * 255;
    b = (b - 128) * contrastFactor + 128 + brightness * 255;
    if (background && adapt > 0) {
      const backgroundLuminance = (0.2126 * background[0] + 0.7152 * background[1] + 0.0722 * background[2]) / 255;
      const hsl = rgbToHsl(r, g, b);
      if (backgroundLuminance < 0.42 && hsl[2] < 0.36) hsl[2] += (0.36 - hsl[2]) * adapt;
      if (backgroundLuminance > 0.68 && hsl[2] > 0.76) hsl[2] -= (hsl[2] - 0.76) * adapt;
      [r, g, b] = hslToRgb(hsl[0], hsl[1], hsl[2]);
    }
    return [clamp(r), clamp(g), clamp(b)];
  };

  const applySharpen = (imageData, amount) => {
    if (amount <= 0) return;
    const { data, width, height } = imageData;
    const source = new Uint8ClampedArray(data);
    const strength = amount / 100 * 0.42;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const offset = (y * width + x) * 4;
        if (!source[offset + 3]) continue;
        for (let channel = 0; channel < 3; channel++) {
          const center = source[offset + channel];
          const neighbors = source[offset - 4 + channel] + source[offset + 4 + channel] + source[offset - width * 4 + channel] + source[offset + width * 4 + channel];
          data[offset + channel] = clamp(center + (center * 4 - neighbors) * strength);
        }
      }
    }
  };

  const processCanvas = sourceCanvas => {
    const context = sourceCanvas.getContext('2d', { willReadFrequently: true });
    const source = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const palette = getSourcePalette(sourceCanvas);
    const target = palette[0];
    const tolerance = Number(byId('extractor-tolerance').value);
    const softness = Number(byId('extractor-softness').value);
    const scope = byId('extractor-scope').value;
    let alpha = buildRemovalMask(source, palette, tolerance, softness, scope);
    const previewScale = state.sourceCanvas ? source.width / state.sourceCanvas.width : 1;
    alpha = adjustAlphaEdge(alpha, source.width, source.height, Number(byId('extractor-edge').value) * previewScale);
    alpha = refineAlphaMask(alpha, source.width, source.height, Number(byId('extractor-refine').value));
    alpha = removeSmallAlphaRegions(alpha, source.width, source.height, Number(byId('extractor-specks').value) * previewScale ** 2);
    alpha = applyManualMask(alpha, source.data, source.width, source.height);
    const output = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
    const decontaminate = byId('extractor-decontaminate').checked;
    const outputBackground = getOutputBackground();
    for (let pixel = 0; pixel < alpha.length; pixel++) {
      const offset = pixel * 4;
      const originalAlpha = source.data[offset + 3];
      const finalAlpha = Math.min(originalAlpha, alpha[pixel]);
      if (!finalAlpha) { output.data[offset + 3] = 0; continue; }
      let r = source.data[offset], g = source.data[offset + 1], b = source.data[offset + 2];
      if (decontaminate && finalAlpha < originalAlpha && finalAlpha > 16) {
        const normalized = finalAlpha / originalAlpha;
        const nearest = nearestPaletteColor(r, g, b, palette).color;
        r = (r - nearest[0] * (1 - normalized)) / normalized;
        g = (g - nearest[1] * (1 - normalized)) / normalized;
        b = (b - nearest[2] * (1 - normalized)) / normalized;
      }
      [r, g, b] = adaptPixel(r, g, b, outputBackground);
      output.data[offset] = r;
      output.data[offset + 1] = g;
      output.data[offset + 2] = b;
      output.data[offset + 3] = finalAlpha;
    }
    applySharpen(output, Number(byId('extractor-sharpen').value));
    applyContrastOutline(output, alpha, outputBackground);
    const result = document.createElement('canvas');
    result.width = source.width; result.height = source.height;
    result.getContext('2d').putImageData(output, 0, 0);
    const mask = document.createElement('canvas');
    mask.width = source.width; mask.height = source.height;
    const maskImage = new ImageData(source.width, source.height);
    for (let pixel = 0; pixel < alpha.length; pixel++) {
      const offset = pixel * 4;
      maskImage.data[offset] = maskImage.data[offset + 1] = maskImage.data[offset + 2] = alpha[pixel];
      maskImage.data[offset + 3] = 255;
    }
    mask.getContext('2d').putImageData(maskImage, 0, 0);
    return { result, mask, target };
  };

  const updatePreviewBackground = () => {
    const mode = byId('extractor-output-bg').value;
    [byId('extractor-viewport'), byId('extractor-dialog-viewport')].filter(Boolean).forEach(viewport => {
      viewport.dataset.previewBackground = mode;
      viewport.style.setProperty('--extractor-preview-color', byId('extractor-output-color').value);
    });
    byId('extractor-output-color-row').hidden = mode !== 'custom';
    byId('extractor-outline-color-row').hidden = byId('extractor-outline').value !== 'custom';
    const include = byId('extractor-include-bg');
    include.disabled = mode === 'transparent';
    if (include.disabled) include.checked = false;
  };

  const previewRectangle = (source, view) => {
    let rectangle = { left: 0, top: 0, width: source.width, height: source.height };
    if (state.fitDesign && view !== 'original' && state.resultCanvas) {
      const bounds = countVisibleBounds(state.resultCanvas);
      if (bounds) {
        const margin = Math.max(8, Math.round(Math.max(bounds.width, bounds.height) * 0.045));
        const left = Math.max(0, bounds.left - margin);
        const top = Math.max(0, bounds.top - margin);
        const right = Math.min(source.width, bounds.right + margin + 1);
        const bottom = Math.min(source.height, bounds.bottom + margin + 1);
        rectangle = { left, top, width: right - left, height: bottom - top };
      }
    }
    return rectangle;
  };

  const paintPreview = (display, view) => {
    const source = view === 'original' ? state.sourceCanvas : view === 'mask' ? state.maskCanvas : state.resultCanvas;
    if (!display || !source) return null;
    const rectangle = previewRectangle(source, view);
    display.width = rectangle.width;
    display.height = rectangle.height;
    const context = display.getContext('2d');
    context.clearRect(0, 0, display.width, display.height);
    context.drawImage(source, rectangle.left, rectangle.top, rectangle.width, rectangle.height, 0, 0, display.width, display.height);
    return rectangle;
  };

  const drawPreview = () => {
    if (!state.sourceCanvas) return;
    state.previewRect = paintPreview(byId('extractor-canvas'), state.view);
    state.dialogPreviewRect = paintPreview(byId('extractor-dialog-canvas'), state.dialogView);
    const dialogEmpty = byId('extractor-dialog-empty');
    if (dialogEmpty) dialogEmpty.hidden = true;
    document.querySelectorAll('[data-extractor-view]').forEach(button => button.classList.toggle('active', button.dataset.extractorView === state.view));
    document.querySelectorAll('[data-extractor-dialog-view]').forEach(button => button.classList.toggle('active', button.dataset.extractorDialogView === state.dialogView));
  };

  const updateLabels = () => {
    const formats = {
      'extractor-tolerance': value => value,
      'extractor-softness': value => value,
      'extractor-refine': value => `${value} ${Number(value) === 1 ? 'nivel' : 'niveles'}`,
      'extractor-edge': value => `${Number(value) > 0 ? '+' : ''}${value} px`,
      'extractor-specks': value => `${value} px`,
      'extractor-adapt': value => `${value}%`,
      'extractor-brightness': value => Number(value) > 0 ? `+${value}` : value,
      'extractor-contrast': value => Number(value) > 0 ? `+${value}` : value,
      'extractor-saturation': value => `${value}%`,
      'extractor-vibrance': value => `${value}%`,
      'extractor-sharpen': value => `${value}%`,
      'extractor-outline-width': value => `${Number(value).toFixed(1)} mm`
    };
    Object.entries(formats).forEach(([id, formatter]) => {
      const output = byId(`${id}-value`);
      if (output) output.textContent = formatter(byId(id).value);
    });
  };

  const render = async (announce = false) => {
    if (!state.sourceCanvas) return;
    const token = ++state.renderToken;
    setBusy(true, 'Extrayendo y adaptando colores…');
    await nextFrame();
    try {
      const processed = processCanvas(state.sourceCanvas);
      if (token !== state.renderToken) return;
      state.resultCanvas = processed.result;
      state.maskCanvas = processed.mask;
      if (byId('extractor-source-bg').value === 'auto') byId('extractor-source-color').value = rgbToHex(...processed.target);
      drawPreview();
      const visible = countVisibleBounds(state.resultCanvas);
      const hasDesign = Boolean(visible);
      byId('extractor-download').disabled = !hasDesign;
      byId('extractor-send').disabled = !hasDesign;
      if (!visible) {
        byId('extractor-result-info').textContent = 'Sin diseño visible';
        setStatus('La configuración eliminó toda la imagen. Bajá la tolerancia o escogé nuevamente el color del fondo.');
        return;
      }
      const removed = visible ? 100 - visible.coverage : 100;
      const widthCm = Math.max(2, Number(byId('extractor-width-cm').value) || 28);
      const sourceDesignWidth = visible ? state.image.naturalWidth * visible.width / state.resultCanvas.width : state.image.naturalWidth;
      const effectiveDpi = Math.round(sourceDesignWidth / (widthCm / 2.54));
      byId('extractor-result-info').textContent = `${removed.toFixed(1)}% separado · origen ${effectiveDpi} DPI`;
      if (removed < 0.5) setStatus('Casi no se eliminó fondo. Tomá el color con el gotero o aumentá suavemente la tolerancia.');
      else if (effectiveDpi < 150) setStatus(`Diseño separado, pero la fuente aporta solo ${effectiveDpi} DPI al tamaño escogido. Enviarlo a Calidad puede mejorar la presentación, no inventar detalle perdido.`);
      else setStatus(announce ? 'Diseño extraído. Revisá Original, Máscara y Resultado antes de descargar.' : 'Vista actualizada; se conservaron los matices y se adaptó el contraste a la prenda.');
    } catch (error) {
      console.error('No se pudo extraer el diseño:', error);
      setStatus(error.message || 'No se pudo procesar la imagen.');
      api()?.showToast?.('No se pudo extraer el diseño. Revisá la imagen y probá nuevamente.');
    } finally {
      if (token === state.renderToken) setBusy(false);
    }
  };

  const scheduleRender = () => {
    updateLabels();
    updatePreviewBackground();
    clearTimeout(state.renderTimer);
    state.renderTimer = setTimeout(() => render(false), 140);
  };

  const updateSampleCount = () => {
    const count = byId('extractor-sample-count');
    if (count) count.textContent = String(state.samples.length);
    const clear = byId('extractor-clear-samples');
    if (clear) clear.disabled = state.samples.length === 0;
  };

  const countVisibleBounds = canvas => {
    const { data, width, height } = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height);
    let left = width, top = height, right = -1, bottom = -1, visible = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < 8) continue;
      visible++;
      if (x < left) left = x; if (x > right) right = x; if (y < top) top = y; if (y > bottom) bottom = y;
    }
    if (right < left || bottom < top) return null;
    return { left, top, right, bottom, width: right - left + 1, height: bottom - top + 1, coverage: visible / (width * height) * 100 };
  };

  const cropTransparent = canvas => {
    const bounds = countVisibleBounds(canvas);
    if (!bounds) return canvas;
    const cropped = document.createElement('canvas');
    cropped.width = bounds.width; cropped.height = bounds.height;
    cropped.getContext('2d').drawImage(canvas, bounds.left, bounds.top, bounds.width, bounds.height, 0, 0, bounds.width, bounds.height);
    return cropped;
  };

  const resizeCanvas = (source, targetWidth) => {
    const width = Math.max(1, Math.min(MAX_EXPORT_SIDE, Math.round(targetWidth)));
    const height = Math.max(1, Math.round(source.height * width / source.width));
    const safeScale = Math.min(1, MAX_EXPORT_SIDE / Math.max(width, height), Math.sqrt(MAX_EXPORT_PIXELS / (width * height)));
    const output = document.createElement('canvas');
    output.width = Math.max(1, Math.round(width * safeScale));
    output.height = Math.max(1, Math.round(height * safeScale));
    const context = output.getContext('2d');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source, 0, 0, output.width, output.height);
    return output;
  };

  const flattenBackground = canvas => {
    if (!byId('extractor-include-bg').checked) return canvas;
    const background = getOutputBackground();
    if (!background) return canvas;
    const output = document.createElement('canvas');
    output.width = canvas.width; output.height = canvas.height;
    const context = output.getContext('2d');
    context.fillStyle = rgbToHex(...background);
    context.fillRect(0, 0, output.width, output.height);
    context.drawImage(canvas, 0, 0);
    return output;
  };

  const buildExportCanvas = async () => {
    const targetPixels = Math.max(236, Number(byId('extractor-width-cm').value || 28) / 2.54 * 300);
    const previewBounds = countVisibleBounds(state.resultCanvas);
    const cropRatio = previewBounds ? previewBounds.width / state.resultCanvas.width : 1;
    const fullTargetWidth = Math.min(MAX_EXPORT_SIDE, targetPixels / Math.max(0.05, cropRatio));
    const aspect = state.image.naturalHeight / state.image.naturalWidth;
    let width = Math.max(1, Math.round(fullTargetWidth));
    let height = Math.max(1, Math.round(width * aspect));
    const safety = Math.min(1, MAX_EXPORT_SIDE / Math.max(width, height), Math.sqrt(MAX_EXPORT_PIXELS / (width * height)));
    width = Math.max(1, Math.round(width * safety)); height = Math.max(1, Math.round(height * safety));
    const source = document.createElement('canvas');
    source.width = width; source.height = height;
    const context = source.getContext('2d');
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high';
    context.drawImage(state.image, 0, 0, width, height);
    await nextFrame();
    let output = processCanvas(source).result;
    if (byId('extractor-trim').checked) output = cropTransparent(output);
    output = resizeCanvas(output, targetPixels);
    return flattenBackground(output);
  };

  const acceptFile = async file => {
    if (!file) return;
    setBusy(true, 'Cargando la imagen…');
    try {
      const loaded = await loadImage(file);
      if (state.sourceUrl) URL.revokeObjectURL(state.sourceUrl);
      state.image = loaded.image;
      state.sourceUrl = loaded.url;
      state.filename = safeFilename(file.name);
      state.sourceCanvas = canvasFromImage(loaded.image);
      state.manualMask = new Int8Array(state.sourceCanvas.width * state.sourceCanvas.height);
      state.manualMask.fill(-1);
      state.samples = [];
      updateSampleCount();
      state.view = 'result';
      state.dialogView = 'result';
      byId('extractor-empty').hidden = true;
      ['extractor-reset', 'extractor-process'].forEach(id => { byId(id).disabled = false; });
      byId('extractor-document-info').textContent = `${file.name} · ${loaded.image.naturalWidth} × ${loaded.image.naturalHeight} px`;
      const info = byId('editor-image-info');
      if (info) info.textContent = `${file.name} · ${loaded.image.naturalWidth} × ${loaded.image.naturalHeight} px`;
      if (byId('extractor-source-bg').value === 'auto') byId('extractor-source-color').value = rgbToHex(...detectCornerColor(state.sourceCanvas));
      await render(true);
    } catch (error) {
      setStatus(error.message || 'No se pudo abrir la imagen.');
      api()?.showToast?.(error.message || 'No se pudo abrir la imagen.');
    } finally {
      setBusy(false);
      byId('extractor-file').value = '';
    }
  };

  const applyPreset = preset => {
    const values = {
      auto: { source: 'auto', scope: 'connected', tolerance: 42, softness: 18, refine: 1, edge: 0, specks: 4 },
      white: { source: 'white', scope: 'connected', tolerance: 36, softness: 16, refine: 1, edge: -1, specks: 6 },
      black: { source: 'black', scope: 'connected', tolerance: 32, softness: 14, refine: 1, edge: -1, specks: 6 },
      photo: { source: 'auto', scope: 'connected', tolerance: 52, softness: 24, refine: 2, edge: -1, specks: 12 }
    }[preset];
    if (!values) return;
    state.samples = [];
    updateSampleCount();
    byId('extractor-source-bg').value = values.source;
    byId('extractor-scope').value = values.scope;
    byId('extractor-tolerance').value = values.tolerance;
    byId('extractor-softness').value = values.softness;
    byId('extractor-refine').value = values.refine;
    byId('extractor-edge').value = values.edge;
    byId('extractor-specks').value = values.specks;
    byId('extractor-decontaminate').checked = true;
    document.querySelectorAll('[data-extractor-preset]').forEach(button => button.classList.toggle('active', button.dataset.extractorPreset === preset));
    scheduleRender();
  };

  const applyGarmentProfile = () => {
    if (!byId('extractor-auto-profile').checked) return scheduleRender();
    const mode = byId('extractor-output-bg').value;
    const custom = hexToRgb(byId('extractor-output-color').value);
    const customLuminance = 0.2126 * custom[0] + 0.7152 * custom[1] + 0.0722 * custom[2];
    const profile = mode === 'black'
      ? { adapt: 45, brightness: 2, contrast: 10, saturation: 112, vibrance: 22, sharpen: 24 }
      : mode === 'white'
        ? { adapt: 32, brightness: -1, contrast: 12, saturation: 106, vibrance: 16, sharpen: 22 }
        : mode === 'custom'
          ? customLuminance < 128
            ? { adapt: 42, brightness: 1, contrast: 11, saturation: 110, vibrance: 21, sharpen: 24 }
            : { adapt: 34, brightness: -1, contrast: 12, saturation: 107, vibrance: 17, sharpen: 22 }
          : { adapt: 0, brightness: 0, contrast: 6, saturation: 104, vibrance: 10, sharpen: 20 };
    Object.entries(profile).forEach(([name, value]) => { byId(`extractor-${name}`).value = value; });
    updateLabels();
    scheduleRender();
  };

  const reset = () => {
    state.samples = [];
    updateSampleCount();
    if (state.manualMask) state.manualMask.fill(-1);
    byId('extractor-output-bg').value = 'black';
    byId('extractor-output-color').value = '#202020';
    byId('extractor-auto-profile').checked = true;
    byId('extractor-outline').value = 'auto';
    byId('extractor-outline-color').value = '#ffffff';
    byId('extractor-outline-width').value = 0.6;
    byId('extractor-width-cm').value = 28;
    byId('extractor-trim').checked = true;
    byId('extractor-include-bg').checked = false;
    applyPreset('auto');
    applyGarmentProfile();
  };

  byId('extractor-file').addEventListener('change', event => acceptFile(event.target.files?.[0]));
  const drop = document.querySelector('.extractor-drop');
  ['dragenter', 'dragover'].forEach(name => drop.addEventListener(name, event => { event.preventDefault(); drop.classList.add('dragging'); }));
  ['dragleave', 'drop'].forEach(name => drop.addEventListener(name, event => { event.preventDefault(); drop.classList.remove('dragging'); }));
  drop.addEventListener('drop', event => acceptFile([...event.dataTransfer.files].find(isSupported)));

  document.querySelectorAll('[data-extractor-preset]').forEach(button => button.addEventListener('click', () => applyPreset(button.dataset.extractorPreset)));
  document.querySelectorAll('[data-extractor-view]').forEach(button => button.addEventListener('click', () => {
    if (!state.sourceCanvas) return;
    state.view = button.dataset.extractorView;
    drawPreview();
  }));
  document.querySelectorAll('[data-extractor-dialog-view]').forEach(button => button.addEventListener('click', () => {
    if (!state.sourceCanvas) return;
    state.dialogView = button.dataset.extractorDialogView;
    drawPreview();
  }));
  renderControls.forEach(id => byId(id).addEventListener(['checkbox', 'select-one', 'color'].includes(byId(id).type) ? 'change' : 'input', scheduleRender));
  byId('extractor-output-bg').addEventListener('change', () => { updatePreviewBackground(); applyGarmentProfile(); });
  byId('extractor-output-color').addEventListener('input', () => {
    updatePreviewBackground();
    if (byId('extractor-output-bg').value === 'custom' && byId('extractor-auto-profile').checked) applyGarmentProfile();
  });
  byId('extractor-auto-profile').addEventListener('change', applyGarmentProfile);
  byId('extractor-outline').addEventListener('change', updatePreviewBackground);
  byId('extractor-process').addEventListener('click', () => render(true));
  byId('extractor-reset').addEventListener('click', reset);
  byId('extractor-fit-design').addEventListener('click', event => {
    state.fitDesign = !state.fitDesign;
    event.currentTarget.classList.toggle('active', state.fitDesign);
    event.currentTarget.setAttribute('aria-pressed', String(state.fitDesign));
    drawPreview();
  });

  const setPickingMode = mode => {
    if (!state.sourceCanvas) return;
    state.pickingMode = state.pickingMode === mode ? '' : mode;
    byId('extractor-picker').classList.toggle('active', state.pickingMode === 'replace');
    byId('extractor-add-sample').classList.toggle('active', state.pickingMode === 'add');
    [byId('extractor-viewport'), byId('extractor-dialog-viewport')].filter(Boolean).forEach(viewport => viewport.classList.toggle('picking', Boolean(state.pickingMode)));
    setStatus(state.pickingMode === 'add' ? 'Hacé clic sobre otro tono del fondo o de la prenda que también querés quitar.' : state.pickingMode === 'replace' ? 'Hacé clic sobre el color principal del fondo.' : 'Selector de color cancelado.');
  };

  const pickBackgroundColor = (event, preview) => {
    if (!state.pickingMode || !state.sourceCanvas) return false;
    const rect = event.currentTarget.getBoundingClientRect();
    const area = preview || { left: 0, top: 0, width: state.sourceCanvas.width, height: state.sourceCanvas.height };
    const x = clamp(Math.floor(area.left + (event.clientX - rect.left) / rect.width * area.width), 0, state.sourceCanvas.width - 1);
    const y = clamp(Math.floor(area.top + (event.clientY - rect.top) / rect.height * area.height), 0, state.sourceCanvas.height - 1);
    const pixel = state.sourceCanvas.getContext('2d', { willReadFrequently: true }).getImageData(x, y, 1, 1).data;
    const color = [pixel[0], pixel[1], pixel[2]];
    if (state.pickingMode === 'add') {
      if (!state.samples.some(sample => colorDistance(color[0], color[1], color[2], sample) < 3)) state.samples.push(color);
    } else {
      byId('extractor-source-color').value = rgbToHex(...color);
      byId('extractor-source-bg').value = 'custom';
    }
    state.pickingMode = '';
    byId('extractor-picker').classList.remove('active');
    byId('extractor-add-sample').classList.remove('active');
    [byId('extractor-viewport'), byId('extractor-dialog-viewport')].filter(Boolean).forEach(viewport => viewport.classList.remove('picking'));
    updateSampleCount();
    render(true);
    return true;
  };

  byId('extractor-picker').addEventListener('click', () => setPickingMode('replace'));
  byId('extractor-add-sample').addEventListener('click', () => setPickingMode('add'));
  byId('extractor-clear-samples').addEventListener('click', () => {
    state.samples = [];
    updateSampleCount();
    scheduleRender();
  });
  byId('extractor-canvas').addEventListener('pointerdown', event => pickBackgroundColor(event, state.previewRect));

  const dialogCanvas = byId('extractor-dialog-canvas');
  const brushPoint = event => {
    const rect = dialogCanvas.getBoundingClientRect();
    const area = state.dialogPreviewRect || { left: 0, top: 0, width: state.sourceCanvas.width, height: state.sourceCanvas.height };
    return {
      x: clamp(Math.floor(area.left + (event.clientX - rect.left) / rect.width * area.width), 0, state.sourceCanvas.width - 1),
      y: clamp(Math.floor(area.top + (event.clientY - rect.top) / rect.height * area.height), 0, state.sourceCanvas.height - 1),
      radius: Math.max(1, Math.round(Number(byId('extractor-brush-size').value) * 0.5 * area.width / Math.max(1, rect.width)))
    };
  };
  const stampManualMask = point => {
    if (!state.manualMask || !state.sourceCanvas) return;
    const value = state.brushMode === 'keep' ? 1 : 0;
    const width = state.sourceCanvas.width;
    const height = state.sourceCanvas.height;
    const radiusSquared = point.radius ** 2;
    const left = Math.max(0, point.x - point.radius), right = Math.min(width - 1, point.x + point.radius);
    const top = Math.max(0, point.y - point.radius), bottom = Math.min(height - 1, point.y + point.radius);
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      if ((x - point.x) ** 2 + (y - point.y) ** 2 <= radiusSquared) state.manualMask[y * width + x] = value;
    }
  };
  const paintManualLine = point => {
    const previous = state.lastBrushPoint || point;
    const distance = Math.hypot(point.x - previous.x, point.y - previous.y);
    const steps = Math.max(1, Math.ceil(distance / Math.max(1, point.radius * 0.45)));
    for (let step = 0; step <= steps; step++) {
      const ratio = step / steps;
      stampManualMask({ x: Math.round(previous.x + (point.x - previous.x) * ratio), y: Math.round(previous.y + (point.y - previous.y) * ratio), radius: point.radius });
    }
    state.lastBrushPoint = point;
  };
  dialogCanvas?.addEventListener('pointerdown', event => {
    if (pickBackgroundColor(event, state.dialogPreviewRect) || !state.sourceCanvas) return;
    event.preventDefault();
    state.brushing = true;
    state.lastBrushPoint = null;
    dialogCanvas.setPointerCapture?.(event.pointerId);
    paintManualLine(brushPoint(event));
    scheduleRender();
  });
  dialogCanvas?.addEventListener('pointermove', event => {
    if (!state.brushing || !state.sourceCanvas) return;
    event.preventDefault();
    paintManualLine(brushPoint(event));
    scheduleRender();
  });
  const finishBrush = event => {
    if (!state.brushing) return;
    state.brushing = false;
    state.lastBrushPoint = null;
    dialogCanvas.releasePointerCapture?.(event.pointerId);
    render(false);
  };
  dialogCanvas?.addEventListener('pointerup', finishBrush);
  dialogCanvas?.addEventListener('pointercancel', finishBrush);
  document.querySelectorAll('[data-extractor-brush]').forEach(button => button.addEventListener('click', () => {
    state.brushMode = button.dataset.extractorBrush;
    document.querySelectorAll('[data-extractor-brush]').forEach(item => item.classList.toggle('active', item === button));
  }));
  byId('extractor-brush-size')?.addEventListener('input', event => { byId('extractor-brush-size-value').textContent = `${event.target.value} px`; });
  byId('extractor-clear-mask')?.addEventListener('click', () => {
    if (state.manualMask) state.manualMask.fill(-1);
    render(true);
  });

  byId('extractor-download').addEventListener('click', async () => {
    if (!state.resultCanvas) return;
    setBusy(true, 'Preparando PNG a 300 DPI…');
    setStatus('Preparando el archivo final con la medida real escogida…');
    try {
      const output = await buildExportCanvas();
      api()?.reviewAndDownload?.(output, `${state.filename}-extraido-dtf-300dpi.png`, 'extractor');
      setStatus(`${output.width} × ${output.height} px · listo para revisar y descargar a 300 DPI.`);
    } catch (error) {
      console.error('No se pudo preparar la descarga del extractor:', error);
      setStatus('No se pudo preparar el PNG. Reducí el ancho o probá con una imagen más liviana.');
    } finally { setBusy(false); }
  });

  byId('extractor-send').addEventListener('click', async () => {
    if (!state.resultCanvas) return;
    const target = byId('extractor-send-target').value;
    const button = byId('extractor-send');
    button.disabled = true;
    try {
      const sent = await api()?.sendCanvasToTool?.(state.resultCanvas, target, `${state.filename}-extraido.png`);
      if (!sent) throw new Error('No se pudo enviar el resultado.');
      api()?.showToast?.('Diseño enviado. Ya podés continuar trabajándolo.');
    } catch (error) {
      api()?.showToast?.(error.message || 'No se pudo enviar el resultado.');
    } finally { button.disabled = !state.resultCanvas; }
  });

  document.addEventListener('paste', event => {
    if (byId('extractor-disenos').hidden) return;
    const file = [...(event.clipboardData?.items || [])].find(item => item.type.startsWith('image/'))?.getAsFile();
    if (file) acceptFile(file);
  });
  window.addEventListener('beforeunload', () => { if (state.sourceUrl) URL.revokeObjectURL(state.sourceUrl); });
  window.addEventListener('momotus:extra-tool', event => {
    if (event.detail?.target !== 'extractor-disenos') return;
    updatePreviewBackground();
    drawPreview();
  });
  window.addEventListener('momotus:extra-options-open', event => {
    if (event.detail?.panel !== 'extractor-disenos') return;
    updatePreviewBackground();
    requestAnimationFrame(drawPreview);
  });

  updateLabels();
  updateSampleCount();
  updatePreviewBackground();
})();
