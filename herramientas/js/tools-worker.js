(() => {
  'use strict';

  const clampChannel = value => Math.max(0, Math.min(255, Math.round(value)));
  const colorDistance = (red, green, blue, target) => {
    const redDifference = red - target.r;
    const greenDifference = green - target.g;
    const blueDifference = blue - target.b;
    const redMean = (red + target.r) / 2;
    return Math.sqrt(
      (2 + redMean / 256) * redDifference * redDifference
      + 4 * greenDifference * greenDifference
      + (2 + (255 - redMean) / 256) * blueDifference * blueDifference
    ) / 1.5;
  };

  const connectedMask = (source, width, height, target, tolerance, softness) => {
    const total = width * height;
    const selected = new Uint8Array(total);
    const queued = new Uint8Array(total);
    const queue = new Uint32Array(total);
    const maximumDistance = tolerance + softness;
    let head = 0;
    let tail = 0;
    const enqueue = pixel => {
      if (queued[pixel]) return;
      queued[pixel] = 1;
      const index = pixel * 4;
      if (source[index + 3] === 0 || colorDistance(source[index], source[index + 1], source[index + 2], target) > maximumDistance) return;
      selected[pixel] = 1;
      queue[tail++] = pixel;
    };
    for (let x = 0; x < width; x++) {
      enqueue(x);
      if (height > 1) enqueue((height - 1) * width + x);
    }
    for (let y = 1; y < height - 1; y++) {
      enqueue(y * width);
      if (width > 1) enqueue(y * width + width - 1);
    }
    while (head < tail) {
      const pixel = queue[head++];
      const x = pixel % width;
      if (x > 0) enqueue(pixel - 1);
      if (x + 1 < width) enqueue(pixel + 1);
      if (pixel >= width) enqueue(pixel - width);
      if (pixel + width < total) enqueue(pixel + width);
      if (head % 250000 === 0) self.postMessage({ type: 'progress', value: Math.min(35, 5 + head / Math.max(1, total) * 30) });
    }
    return selected;
  };

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

  const removeBackground = payload => {
    const { width, height, target, tolerance, softness, mode, scope, decontaminate, maskPreview, edgeShift = 0 } = payload;
    const data = new Uint8ClampedArray(payload.buffer);
    const original = new Uint8ClampedArray(data);
    const mask = mode === 'remove' && scope === 'connected'
      ? connectedMask(original, width, height, target, tolerance, softness)
      : null;
    let affected = 0;
    const pixels = width * height;
    for (let pixel = 0; pixel < pixels; pixel++) {
      const index = pixel * 4;
      const originalAlpha = data[index + 3];
      const distance = colorDistance(data[index], data[index + 1], data[index + 2], target);
      if (mode === 'keep') {
        if (distance <= tolerance) data[index + 3] = originalAlpha;
        else if (softness > 0 && distance < tolerance + softness) data[index + 3] = Math.round(originalAlpha * (1 - (distance - tolerance) / softness));
        else data[index + 3] = 0;
      } else if (scope === 'global' || mask[pixel]) {
        if (distance <= tolerance) data[index + 3] = 0;
        else if (softness > 0 && distance < tolerance + softness) data[index + 3] = Math.round(originalAlpha * (distance - tolerance) / softness);
      }
      if (decontaminate && data[index + 3] > 0 && data[index + 3] < originalAlpha) {
        const coverage = data[index + 3] / originalAlpha;
        data[index] = clampChannel((data[index] - (1 - coverage) * target.r) / coverage);
        data[index + 1] = clampChannel((data[index + 1] - (1 - coverage) * target.g) / coverage);
        data[index + 2] = clampChannel((data[index + 2] - (1 - coverage) * target.b) / coverage);
      }
      if (data[index + 3] < originalAlpha) affected++;
      if (pixel > 0 && pixel % 250000 === 0) self.postMessage({ type: 'progress', value: 35 + pixel / pixels * (maskPreview ? 48 : 62) });
    }
    adjustAlphaEdge(data, width, height, edgeShift);
    if (maskPreview) {
      for (let pixel = 0; pixel < pixels; pixel++) {
        const index = pixel * 4;
        const value = data[index + 3];
        data[index] = value;
        data[index + 1] = value;
        data[index + 2] = value;
        data[index + 3] = 255;
        if (pixel > 0 && pixel % 300000 === 0) self.postMessage({ type: 'progress', value: 83 + pixel / pixels * 14 });
      }
    }
    return { buffer: data.buffer, affected };
  };

  const enhance = payload => {
    const { width, height, sharpness, clarity, denoise = 0 } = payload;
    const source = new Uint8ClampedArray(payload.buffer);
    const output = new Uint8ClampedArray(source);
    const sharpAmount = Math.min(0.65, sharpness * 0.006);
    const clarityAmount = Math.min(0.32, clarity * 0.0045);
    const denoiseAmount = Math.min(0.55, Math.max(0, denoise) / 100);
    const rowStride = width * 4;
    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const index = (y * width + x) * 4;
        const alpha = source[index + 3];
        const edgeAlphaDifference = Math.max(
          Math.abs(alpha - source[index - 1]),
          Math.abs(alpha - source[index + 7]),
          Math.abs(alpha - source[index - rowStride + 3]),
          Math.abs(alpha - source[index + rowStride + 3])
        );
        if (alpha < 200 || edgeAlphaDifference > 24) continue;
        for (let channel = 0; channel < 3; channel++) {
          const center = source[index + channel];
          const nearAverage = (source[index - 4 + channel] + source[index + 4 + channel] + source[index - rowStride + channel] + source[index + rowStride + channel]) / 4;
          const farAverage = (source[index - 8 + channel] + source[index + 8 + channel] + source[index - rowStride * 2 + channel] + source[index + rowStride * 2 + channel]) / 4;
          const cleaned = Math.abs(center - nearAverage) < 24 ? center + (nearAverage - center) * denoiseAmount : center;
          const fineDetail = Math.abs(cleaned - nearAverage) >= 2 ? cleaned - nearAverage : 0;
          const localContrast = Math.abs(cleaned - farAverage) >= 4 ? cleaned - farAverage : 0;
          output[index + channel] = clampChannel(cleaned + fineDetail * sharpAmount + localContrast * clarityAmount);
        }
      }
      if (y % 48 === 0) self.postMessage({ type: 'progress', value: y / Math.max(1, height - 1) * 100 });
    }
    return { buffer: output.buffer };
  };

  self.onmessage = event => {
    const { kind, payload } = event.data || {};
    try {
      const result = kind === 'background' ? removeBackground(payload) : kind === 'enhance' ? enhance(payload) : null;
      if (!result) throw new Error('Tarea no reconocida.');
      self.postMessage({ type: 'progress', value: 100 });
      self.postMessage({ type: 'result', result }, [result.buffer]);
    } catch (error) {
      self.postMessage({ type: 'error', message: error.message || 'Error de procesamiento.' });
    }
  };
})();
