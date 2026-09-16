// js/designer.js - Momotus Core - VERSIÓN FINAL ACTUALIZADA (05 Abril 2026)
// Compatible con margen 90%/88% (más libertad de movimiento)

let currentShirtType = 0;
let currentColor = 'black';
let currentSize = 'M';
let designFront = null;
let designBack = null;
let currentScaleFront = 1;
let currentScaleBack = 1;
let currentPositionFront = { x: 50, y: 50 };
let currentPositionBack = { x: 50, y: 50 };
let currentRotationFront = 0;
let currentRotationBack = 0;
let lastStorageWarningAt = 0;
let currentTab = 0; // 0 = Frente, 1 = Espalda
let designSaveTimer = null;
let designSaveIdleCallback = null;
let mockupRequestId = 0;

const shirtTypes = ['regular', 'sudadera', 'hoodie', 'crop-top'];
const shirtTypeNames = ['Regular / Unisex', 'Sudaderas', 'Hoodie', 'Crop-top'];
const colorMap = { black: 'negro', white: 'blanco', red: 'rojo', blue: 'azul', emerald: 'verde', violet: 'violeta', amber: 'amarillo', pink: 'rosa' };
const whatsappNumber = '50555010044';
const contactEmail = 'momotuscore@gmail.com';

const getMockupPath = (typeIndex, colorKey, isBack = false) => {
  const typeName = shirtTypes[typeIndex];
  const colorName = colorMap[colorKey] || colorKey;
  const side = isBack ? 'espalda' : 'frente';
  return `img/mockups/mockup-${typeName}-${colorName}-${side}.webp`;
};

const colors = [
  { key: 'black', class: 'bg-black', name: 'Negro' },
  { key: 'white', class: 'bg-white', name: 'Blanco' },
  { key: 'red', class: 'bg-red-500', name: 'Rojo' },
  { key: 'blue', class: 'bg-blue-500', name: 'Azul' },
  { key: 'emerald', class: 'bg-emerald-500', name: 'Verde' },
  { key: 'violet', class: 'bg-violet-500', name: 'Violeta' },
  { key: 'amber', class: 'bg-amber-500', name: 'Amarillo' },
  { key: 'pink', class: 'bg-pink-500', name: 'Rosa' }
];

const designerSizes = ['S', 'M', 'L'];
const minDesignScale = 0.05;
const maxDesignScale = 3;
const mockupLoadCache = new Map();
const queuedMockupColors = new Set();
const clampNumber = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};
const normalizePosition = (position) => ({
  x: clampNumber(position?.x, 0, 100, 50),
  y: clampNumber(position?.y, 0, 100, 50)
});
const isSafeDesignSource = (source) => {
  if (typeof source !== 'string' || !source) return false;
  if (/["'<>\s]/.test(source)) return false;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(source)) return true;
  try {
    const url = new URL(source, window.location.href);
    return url.origin === window.location.origin && ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
};

const getDesignStyle = (colorKey) => {
  return colorKey === 'white'
    ? `mix-blend-mode: multiply; filter: brightness(0.95) contrast(1.25) saturate(1.1) opacity(0.92);`
    : `mix-blend-mode: multiply; filter: brightness(1.08) contrast(1.18) saturate(1.25) opacity(0.95);`;
};

const applyDesignAppearance = (designImg) => {
  if (!designImg) return;
  designImg.style.mixBlendMode = 'multiply';
  designImg.style.filter = currentColor === 'white'
    ? 'brightness(0.95) contrast(1.25) saturate(1.1) opacity(0.92)'
    : 'brightness(1.08) contrast(1.18) saturate(1.25) opacity(0.95)';
};

const applyDesignLayout = (designImg, side) => {
  if (!designImg) return;
  const scale = side === 0 ? currentScaleFront : currentScaleBack;
  const position = side === 0 ? currentPositionFront : currentPositionBack;
  const rotation = side === 0 ? currentRotationFront : currentRotationBack;
  designImg.style.left = `${position.x}%`;
  designImg.style.top = `${position.y}%`;
  designImg.style.transform = `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`;
  designImg.style.transformOrigin = 'center center';
};

// ==================== ACTUALIZAR TAMAÑO (SOLO ESCALA DEL DISEÑO) ====================
const updateDesignSize = () => {
  ['design-preview', 'design-preview-back'].forEach((id, index) => {
    const preview = document.getElementById(id);
    if (!preview) return;

    const designImg = preview.querySelector('img');
    if (designImg) {
      applyDesignLayout(designImg, index);
    }
  });
};

const loadMockupImage = (src, priority = 'auto') => {
  if (mockupLoadCache.has(src)) return mockupLoadCache.get(src);

  const loadPromise = new Promise(resolve => {
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = priority;
    image.onload = async () => {
      try {
        if (typeof image.decode === 'function') await image.decode();
      } catch (error) {
        console.debug('El navegador completó la imagen sin decodificación anticipada.', error);
      }
      resolve(src);
    };
    image.onerror = () => resolve(null);
    image.src = src;
  }).then(result => {
    if (!result) mockupLoadCache.delete(src);
    return result;
  });

  mockupLoadCache.set(src, loadPromise);
  return loadPromise;
};

const preloadMockupsForColor = colorKey => {
  if (queuedMockupColors.has(colorKey)) return;
  queuedMockupColors.add(colorKey);

  const preload = () => {
    shirtTypes.forEach((type, typeIndex) => {
      loadMockupImage(getMockupPath(typeIndex, colorKey, false), 'low');
      loadMockupImage(getMockupPath(typeIndex, colorKey, true), 'low');
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(preload, { timeout: 1200 });
  } else {
    setTimeout(preload, 250);
  }
};

const updateMockups = async () => {
  const frontImg = document.getElementById('shirt-mockup');
  const backImg = document.getElementById('shirt-mockup-back');
  if (!frontImg && !backImg) return;

  const requestId = ++mockupRequestId;
  const selectedType = currentShirtType;
  const selectedColor = currentColor;
  const frontPath = getMockupPath(selectedType, selectedColor, false);
  const backPath = getMockupPath(selectedType, selectedColor, true);
  const [loadedFront, loadedBack] = await Promise.all([
    loadMockupImage(frontPath, 'high'),
    loadMockupImage(backPath, 'high')
  ]);

  if (requestId !== mockupRequestId || selectedType !== currentShirtType || selectedColor !== currentColor) return;

  if (frontImg && loadedFront) frontImg.src = loadedFront;
  if (backImg && loadedBack) backImg.src = loadedBack;
  if (!loadedFront || !loadedBack) console.warn('No se encontró uno de los mockups seleccionados.', { frontPath, backPath });

  requestAnimationFrame(updateDesignSize);
  preloadMockupsForColor(selectedColor);
};

const selectShirtType = (index) => {
  if (!Number.isInteger(index) || index < 0 || index >= shirtTypes.length || index === currentShirtType) return;
  currentShirtType = index;
  document.querySelectorAll('.shirt-type-btn').forEach((btn, i) => btn.classList.toggle('active', i === index));
  updateMockups();
  saveCurrentDesign();
};

const selectColor = (colorKey, el) => {
  if (!colors.some(color => color.key === colorKey) || colorKey === currentColor) return;
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  currentColor = colorKey;
  updateMockups();
  document.querySelectorAll('#design-preview img, #design-preview-back img').forEach(applyDesignAppearance);
  saveCurrentDesign();
};

// ==================== ESCALADO (+ / -) ====================
window.scaleDesign = (side, delta) => {
  if (side === 0) {
    currentScaleFront = Math.max(minDesignScale, Math.min(maxDesignScale, currentScaleFront + delta));
  } else if (side === 1) {
    currentScaleBack = Math.max(minDesignScale, Math.min(maxDesignScale, currentScaleBack + delta));
  } else return;
  updateDesignSize();
  saveCurrentDesign();
  updateBoundaryWarning(side);
};

window.scaleActiveDesign = (delta) => window.scaleDesign(currentTab, delta);

window.rotateActiveDesign = (degrees) => {
  if (currentTab === 0) currentRotationFront = (currentRotationFront + degrees) % 360;
  else currentRotationBack = (currentRotationBack + degrees) % 360;
  updateDesignSize();
  saveCurrentDesign();
  updateBoundaryWarning(currentTab);
};

const updateBoundaryWarning = (side) => {
  const preview = document.getElementById(side === 0 ? 'design-preview' : 'design-preview-back');
  const image = preview?.querySelector('img');
  const warning = document.getElementById('design-boundary-warning');
  if (!warning) return;
  if (!image || !preview) {
    warning.classList.add('hidden');
    return;
  }
  const imageRect = image.getBoundingClientRect();
  const previewRect = preview.getBoundingClientRect();
  const outside = imageRect.left < previewRect.left || imageRect.right > previewRect.right
    || imageRect.top < previewRect.top || imageRect.bottom > previewRect.bottom;
  warning.textContent = outside
    ? `⚠️ Parte del diseño ${side === 0 ? 'frontal' : 'trasero'} está fuera del área imprimible.`
    : '';
  warning.classList.toggle('hidden', !outside);
};

// ==================== DRAG & DROP ====================
let isDragging = false;
let currentDraggingDesign = null;
let offsetX = 0, offsetY = 0;

const makeDraggable = (el) => {
  if (!el) return;
  el.style.position = 'absolute';
  el.style.cursor = 'grab';
  el.style.zIndex = '30';
  el.addEventListener('mousedown', startDrag);
  el.addEventListener('touchstart', startDrag, { passive: false });
};

const startDrag = (e) => {
  isDragging = true;
  currentDraggingDesign = e.target || (e.touches && e.touches[0].target);
  const rect = currentDraggingDesign.getBoundingClientRect();
  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);
  offsetX = clientX - (rect.left + rect.width / 2);
  offsetY = clientY - (rect.top + rect.height / 2);
  currentDraggingDesign.style.transition = 'none';
  e.preventDefault();
};

const initDragListeners = () => {
  const moveHandler = (e) => {
    if (!isDragging || !currentDraggingDesign) return;
    const preview = currentDraggingDesign.parentElement;
    const previewRect = preview.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    const x = Math.max(0, Math.min(100, ((clientX - previewRect.left - offsetX) / previewRect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - previewRect.top - offsetY) / previewRect.height) * 100));
    const side = currentDraggingDesign.id === 'draggable-design-back' ? 1 : 0;
    if (side === 0) currentPositionFront = { x, y };
    else currentPositionBack = { x, y };
    applyDesignLayout(currentDraggingDesign, side);
    e.preventDefault();
  };

  const endHandler = () => {
    if (currentDraggingDesign) {
      currentDraggingDesign.style.transition = 'all 0.2s ease';
      saveCurrentDesign();
      updateBoundaryWarning(currentDraggingDesign.id === 'draggable-design-back' ? 1 : 0);
    }
    isDragging = false;
    currentDraggingDesign = null;
  };

  document.addEventListener('mousemove', moveHandler);
  document.addEventListener('touchmove', moveHandler, { passive: false });
  document.addEventListener('mouseup', endHandler);
  document.addEventListener('touchend', endHandler);
};

// ==================== RESTO DE FUNCIONES ====================
const handleDesignUpload = (e, side) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return showToast("❌ Solo imágenes");
  if (file.size > 5 * 1024 * 1024) return showToast("❌ Máximo 5 MB");

  const reader = new FileReader();
  reader.onload = (ev) => {
    const src = ev.target.result;
    const style = getDesignStyle(currentColor);
    const preview = side === 0 ? document.getElementById('design-preview') : document.getElementById('design-preview-back');
    const id = side === 0 ? 'draggable-design-front' : 'draggable-design-back';

    preview.innerHTML = `<img src="${src}" id="${id}" class="max-w-full max-h-full object-contain rounded-3xl" style="${style}">`;
    preview.classList.add('design-loaded');
    makeDraggable(document.getElementById(id));
    applyDesignLayout(document.getElementById(id), side);

    if (side === 0) designFront = src;
    else designBack = src;

    const uploadedImage = document.getElementById(id);
    if (uploadedImage.complete) updateImageQuality(uploadedImage, side);
    else uploadedImage.addEventListener('load', () => updateImageQuality(uploadedImage, side), { once: true });

    showToast(side === 0 ? "✅ Diseño Frente cargado" : "✅ Diseño Espalda cargado");
    saveCurrentDesign();
  };
  reader.readAsDataURL(file);
};

const updateImageQuality = (image, side) => {
  const status = document.getElementById(side === 0 ? 'quality-front' : 'quality-back');
  if (!status || !image) return;
  const shortestSide = Math.min(image.naturalWidth || 0, image.naturalHeight || 0);
  const quality = shortestSide >= 1200
    ? { text: `Alta (${image.naturalWidth}×${image.naturalHeight}px)`, className: 'text-emerald-400' }
    : shortestSide >= 600
      ? { text: `Media (${image.naturalWidth}×${image.naturalHeight}px)`, className: 'text-yellow-400' }
      : { text: `Baja (${image.naturalWidth}×${image.naturalHeight}px)`, className: 'text-red-400' };
  status.textContent = `Calidad: ${quality.text}`;
  status.className = `mt-2 text-xs ${quality.className}`;
};

window.removeActiveDesign = () => {
  const side = currentTab;
  const preview = document.getElementById(side === 0 ? 'design-preview' : 'design-preview-back');
  if (side === 0) {
    designFront = null;
    currentScaleFront = 1;
    currentPositionFront = { x: 50, y: 50 };
    currentRotationFront = 0;
  } else {
    designBack = null;
    currentScaleBack = 1;
    currentPositionBack = { x: 50, y: 50 };
    currentRotationBack = 0;
  }
  if (preview) {
    preview.classList.remove('design-loaded');
    preview.innerHTML = `<span class="text-yellow-400 text-center text-base font-medium pointer-events-none">Arrastra tu diseño aquí</span>`;
  }
  const quality = document.getElementById(side === 0 ? 'quality-front' : 'quality-back');
  if (quality) quality.textContent = 'Calidad: sin imagen';
  saveCurrentDesign();
  showToast(side === 0 ? 'Diseño frontal eliminado' : 'Diseño trasero eliminado');
};

const resetDesign = () => {
  cancelScheduledDesignSave();
  designFront = null;
  designBack = null;
  currentScaleFront = 1;
  currentScaleBack = 1;
  currentPositionFront = { x: 50, y: 50 };
  currentPositionBack = { x: 50, y: 50 };
  currentRotationFront = 0;
  currentRotationBack = 0;
  ['design-preview', 'design-preview-back'].forEach(id => {
    const preview = document.getElementById(id);
    if (preview) {
      preview.classList.remove('design-loaded');
      preview.innerHTML = `<span class="text-yellow-400 text-center text-base font-medium pointer-events-none">Arrastra tu diseño aquí</span>`;
    }
  });
  try {
    localStorage.removeItem('momotusCurrentDesign');
  } catch (error) {
    console.warn('No se pudo limpiar el diseño guardado.', error);
  }
  ['quality-front', 'quality-back'].forEach(id => {
    const status = document.getElementById(id);
    if (status) {
      status.textContent = 'Calidad: sin imagen';
      status.className = 'mt-2 text-xs text-zinc-500';
    }
  });
  showToast("Diseño reseteado");
};

const getCurrentDesignData = () => ({
    shirtType: currentShirtType,
    color: currentColor,
    size: currentSize,
    frontDesign: designFront,
    backDesign: designBack,
    scaleFront: currentScaleFront,
    scaleBack: currentScaleBack,
    positionFront: currentPositionFront,
    positionBack: currentPositionBack,
    rotationFront: currentRotationFront,
    rotationBack: currentRotationBack
});

const saveCurrentDesignNow = () => {
  try {
    localStorage.setItem('momotusCurrentDesign', JSON.stringify(getCurrentDesignData()));
    return true;
  } catch (error) {
    console.warn('No fue posible guardar el diseño en este dispositivo.', error);
    if (Date.now() - lastStorageWarningAt > 5000) {
      showToast('⚠️ No se pudo guardar: prueba con imágenes más pequeñas');
      lastStorageWarningAt = Date.now();
    }
    return false;
  }
};

const cancelScheduledDesignSave = () => {
  if (designSaveTimer !== null) {
    clearTimeout(designSaveTimer);
    designSaveTimer = null;
  }
  if (designSaveIdleCallback !== null && typeof window.cancelIdleCallback === 'function') {
    window.cancelIdleCallback(designSaveIdleCallback);
    designSaveIdleCallback = null;
  }
};

const saveCurrentDesign = () => {
  cancelScheduledDesignSave();
  designSaveTimer = setTimeout(() => {
    designSaveTimer = null;
    if (typeof window.requestIdleCallback === 'function') {
      designSaveIdleCallback = window.requestIdleCallback(() => {
        designSaveIdleCallback = null;
        saveCurrentDesignNow();
      }, { timeout: 1000 });
    } else {
      saveCurrentDesignNow();
    }
  }, 250);
  return true;
};

const flushScheduledDesignSave = () => {
  if (designSaveTimer === null && designSaveIdleCallback === null) return;
  cancelScheduledDesignSave();
  saveCurrentDesignNow();
};

const loadSavedDesign = () => {
  let saved;
  try {
    saved = localStorage.getItem('momotusCurrentDesign');
  } catch (error) {
    console.warn('El navegador bloqueó el acceso al diseño guardado.', error);
    return;
  }
  if (!saved) return;
  let data;
  try {
    data = JSON.parse(saved);
  } catch (error) {
    console.warn('El diseño guardado estaba dañado y fue eliminado.', error);
    try {
      localStorage.removeItem('momotusCurrentDesign');
    } catch (storageError) {
      console.warn('No se pudo limpiar el diseño dañado.', storageError);
    }
    return;
  }
  currentShirtType = Number.isInteger(Number(data.shirtType))
    ? Math.max(0, Math.min(shirtTypes.length - 1, Number(data.shirtType)))
    : 0;
  currentColor = colors.some(color => color.key === data.color) ? data.color : 'black';
  currentSize = designerSizes.includes(data.size) ? data.size : 'M';
  designFront = isSafeDesignSource(data.frontDesign) ? data.frontDesign : null;
  designBack = isSafeDesignSource(data.backDesign) ? data.backDesign : null;
  currentScaleFront = clampNumber(data.scaleFront, minDesignScale, maxDesignScale, 1);
  currentScaleBack = clampNumber(data.scaleBack, minDesignScale, maxDesignScale, 1);
  currentPositionFront = normalizePosition(data.positionFront);
  currentPositionBack = normalizePosition(data.positionBack);
  currentRotationFront = clampNumber(data.rotationFront, -360, 360, 0);
  currentRotationBack = clampNumber(data.rotationBack, -360, 360, 0);

  document.querySelectorAll('.shirt-type-btn').forEach((btn, i) => btn.classList.toggle('active', i === currentShirtType));

  const currentColorData = colors.find(color => color.key === currentColor);
  const colorBtn = Array.from(document.querySelectorAll('.color-btn')).find(btn =>
    btn.classList.contains(currentColorData.class)
  );
  document.querySelectorAll('.color-btn').forEach(btn => btn.classList.toggle('active', btn === colorBtn));

  if (designFront) {
    const preview = document.getElementById('design-preview');
    preview.innerHTML = `<img src="${designFront}" id="draggable-design-front" class="max-w-full max-h-full object-contain rounded-3xl" style="${getDesignStyle(currentColor)}">`;
    preview.classList.add('design-loaded');
    makeDraggable(document.getElementById('draggable-design-front'));
    applyDesignLayout(document.getElementById('draggable-design-front'), 0);
    const frontImage = document.getElementById('draggable-design-front');
    if (frontImage.complete) updateImageQuality(frontImage, 0);
    else frontImage.addEventListener('load', event => updateImageQuality(event.currentTarget, 0), { once: true });
  }
  if (designBack) {
    const preview = document.getElementById('design-preview-back');
    preview.innerHTML = `<img src="${designBack}" id="draggable-design-back" class="max-w-full max-h-full object-contain rounded-3xl" style="${getDesignStyle(currentColor)}">`;
    preview.classList.add('design-loaded');
    makeDraggable(document.getElementById('draggable-design-back'));
    applyDesignLayout(document.getElementById('draggable-design-back'), 1);
    const backImage = document.getElementById('draggable-design-back');
    if (backImage.complete) updateImageQuality(backImage, 1);
    else backImage.addEventListener('load', event => updateImageQuality(event.currentTarget, 1), { once: true });
  }
};

const switchMockup = (tab) => {
  currentTab = tab;
  document.getElementById('tab-frente').classList.toggle('tab-active', tab === 0);
  document.getElementById('tab-espalda').classList.toggle('tab-active', tab === 1);
  document.getElementById('mockup-frente').classList.toggle('hidden', tab === 1);
  document.getElementById('mockup-espalda').classList.toggle('hidden', tab === 0);
};

const renderSizeButtonsDesigner = () => {
  const container = document.getElementById('size-buttons');
  if (!container) return;
  container.innerHTML = '';
  designerSizes.forEach(size => {
    const btn = document.createElement('button');
    btn.textContent = size;
    btn.className = `size-btn px-7 py-4 rounded-3xl font-medium border border-zinc-600 hover:border-yellow-400 transition ${size === currentSize ? 'bg-yellow-400 text-black border-yellow-400' : ''}`;
    btn.onclick = () => {
      currentSize = size;
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('bg-yellow-400', 'text-black', 'border-yellow-400'));
      btn.classList.add('bg-yellow-400', 'text-black', 'border-yellow-400');
      saveCurrentDesign();
    };
    container.appendChild(btn);
  });
};

const renderColorButtons = () => {
  const container = document.getElementById('color-buttons');
  if (!container) return;
  container.innerHTML = '';
  colors.forEach(color => {
    const btn = document.createElement('button');
    btn.onclick = () => selectColor(color.key, btn);
    btn.className = `color-btn w-14 h-14 rounded-2xl shadow-inner border-2 border-transparent active:scale-95 transition-all ${color.class}`;
    if (color.key === 'black') btn.classList.add('active');
    container.appendChild(btn);
  });
};

const mostrarModalEliminarFondo = () => document.getElementById('modal-eliminar-fondo').classList.remove('hidden');
const cerrarModalEliminarFondo = () => document.getElementById('modal-eliminar-fondo').classList.add('hidden');
const abrirRemoveBg = () => {
  cerrarModalEliminarFondo();
  window.open('https://remove.bg', '_blank', 'noopener,noreferrer');
  showToast("🪄 remove.bg abierto");
};

const centerDesign = (side) => {
  const previewId = side === 0 ? 'design-preview' : 'design-preview-back';
  const preview = document.getElementById(previewId);
  const design = preview ? preview.querySelector('img') : null;
  if (!design) return showToast("❌ No hay diseño para centrar");
  if (side === 0) currentPositionFront = { x: 50, y: 50 };
  else currentPositionBack = { x: 50, y: 50 };
  applyDesignLayout(design, side);
  saveCurrentDesign();
  updateBoundaryWarning(side);
  showToast("🎯 Diseño centrado correctamente");
};

const getQuoteDetails = () => ({
  name: document.getElementById('quote-name')?.value.trim() || 'No indicado',
  city: document.getElementById('quote-city')?.value.trim() || 'No indicada',
  quantity: Math.max(1, Math.min(99, Number(document.getElementById('quote-quantity')?.value) || 1)),
  notes: document.getElementById('quote-notes')?.value.trim() || 'Sin observaciones'
});

const waitForImages = async (container) => {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(images.map(image => image.complete
    ? Promise.resolve()
    : new Promise(resolve => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      })));
};

const captureMockupSide = async (side) => {
  const target = document.getElementById(side === 0 ? 'mockup-frente' : 'mockup-espalda');
  const preview = document.getElementById(side === 0 ? 'design-preview' : 'design-preview-back');
  if (!target || !preview || typeof html2canvas !== 'function') throw new Error('Captura no disponible');
  const wasHidden = target.classList.contains('hidden');
  const previousPreviewStyle = preview.getAttribute('style');
  target.classList.remove('hidden');
  preview.style.setProperty('border-color', 'transparent', 'important');
  preview.style.setProperty('background', 'transparent', 'important');
  try {
    await waitForImages(target);
    return await html2canvas(target, {
      backgroundColor: '#111827',
      scale: 2,
      useCORS: true,
      logging: false
    });
  } finally {
    if (wasHidden) target.classList.add('hidden');
    if (previousPreviewStyle === null) preview.removeAttribute('style');
    else preview.setAttribute('style', previousPreviewStyle);
    updateDesignSize();
  }
};

window.createDesignPreview = async (shouldDownload = true) => {
  const originalTab = currentTab;
  const frontCanvas = await captureMockupSide(0);
  const backCanvas = await captureMockupSide(1);
  const gap = 32;
  const labelHeight = 64;
  const result = document.createElement('canvas');
  result.width = frontCanvas.width + backCanvas.width + gap * 3;
  result.height = Math.max(frontCanvas.height, backCanvas.height) + labelHeight + gap * 2;
  const context = result.getContext('2d');
  context.fillStyle = '#111827';
  context.fillRect(0, 0, result.width, result.height);
  context.fillStyle = '#facc15';
  context.font = 'bold 34px system-ui, sans-serif';
  context.textAlign = 'center';
  context.fillText('FRENTE', gap + frontCanvas.width / 2, 44);
  context.fillText('ESPALDA', gap * 2 + frontCanvas.width + backCanvas.width / 2, 44);
  context.drawImage(frontCanvas, gap, labelHeight);
  context.drawImage(backCanvas, gap * 2 + frontCanvas.width, labelHeight);
  switchMockup(originalTab);
  if (shouldDownload) {
    const link = document.createElement('a');
    link.download = `momotus-diseno-${Date.now()}.png`;
    link.href = result.toDataURL('image/png', 1);
    link.click();
    showToast('✅ Vista previa descargada; adjúntala en tu mensaje');
  }
  return result;
};

window.sendToWhatsApp = async () => {
  const typeName = shirtTypeNames[currentShirtType];
  const colorName = colorMap[currentColor] || currentColor;
  const quote = getQuoteDetails();
  const text = `¡Hola Momotus Core! 👋\n\nAcabo de diseñar mi camiseta:\n• Nombre: ${quote.name}\n• Ciudad: ${quote.city}\n• Cantidad: ${quote.quantity}\n• Tipo: ${typeName}\n• Talla: ${currentSize}\n• Color: ${colorName.charAt(0).toUpperCase() + colorName.slice(1)}\n• Frente: ${designFront ? 'Sí' : 'No'}\n• Espalda: ${designBack ? 'Sí' : 'No'}\n• Observaciones: ${quote.notes}\n\nAdjuntaré la vista previa descargada.\nGracias! 🇳🇮`;
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`;
  const whatsappWindow = window.open(whatsappUrl, '_blank');
  if (whatsappWindow) whatsappWindow.opener = null;
  try {
    await window.createDesignPreview(true);
  } catch (error) {
    console.warn('No se pudo generar la vista previa automáticamente.', error);
    showToast('⚠️ No se pudo descargar la vista previa; puedes enviar una captura manual');
  }
  if (!whatsappWindow) {
    showToast('ℹ️ WhatsApp se abrirá en esta misma pestaña');
    window.location.assign(whatsappUrl);
  }
};

window.sendToEmail = () => {
  const typeName = shirtTypeNames[currentShirtType];
  const colorName = colorMap[currentColor] || currentColor;
  const quote = getQuoteDetails();
  const subject = "Cotización - Camiseta Personalizada Momotus Core";
  const body = `Hola,\n\nQuiero cotizar:\n- Nombre: ${quote.name}\n- Ciudad: ${quote.city}\n- Cantidad: ${quote.quantity}\n- Tipo: ${typeName}\n- Talla: ${currentSize}\n- Color: ${colorName}\n- Frente: ${designFront ? 'Sí' : 'No'}\n- Espalda: ${designBack ? 'Sí' : 'No'}\n- Observaciones: ${quote.notes}\n\nGracias!`;
  window.location.href = `mailto:${contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  showToast("✉️ Email abierto");
};

const initDesigner = () => {
  if (document.getElementById('type-0')) {
    renderSizeButtonsDesigner();
    renderColorButtons();
  }
  loadSavedDesign();
  updateMockups();
  initDragListeners();
  window.addEventListener('pagehide', flushScheduledDesignSave);
  document.querySelectorAll('.ready-designs img').forEach((image, index) => {
    image.tabIndex = 0;
    image.setAttribute('role', 'button');
    image.setAttribute('aria-label', `Abrir diseño listo ${index + 1}`);
    image.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showPreviewModal(image.src);
      }
    });
  });
  window.addEventListener('resize', () => setTimeout(updateDesignSize, 200));
  console.log("%c✅ Diseñador COMPLETO y sin errores - Margen 90%/88% mantenido", "color:#facc15; font-weight:bold");
};

window.addEventListener('load', initDesigner);
