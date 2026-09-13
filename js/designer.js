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
let currentTab = 0; // 0 = Frente, 1 = Espalda

const shirtTypes = ['regular', 'slim', 'oversized'];
const colorMap = { black: 'negro', white: 'blanco', red: 'rojo', blue: 'azul', emerald: 'verde', violet: 'violeta', amber: 'amarillo', pink: 'rosa' };

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

const designerSizes = ['S', 'M', 'L', 'XL', 'XXL'];
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
  designImg.style.left = `${position.x}%`;
  designImg.style.top = `${position.y}%`;
  designImg.style.transform = `translate(-50%, -50%) scale(${scale})`;
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

const updateMockups = () => {
  const frontImg = document.getElementById('shirt-mockup');
  const backImg = document.getElementById('shirt-mockup-back');
  let loaded = 0;
  const total = (frontImg ? 1 : 0) + (backImg ? 1 : 0);
  const onLoad = () => { 
    loaded++; 
    if (loaded === total) updateDesignSize(); 
  };

  if (frontImg) { 
    frontImg.src = getMockupPath(currentShirtType, currentColor, false); 
    frontImg.onload = onLoad; 
  }
  if (backImg) { 
    backImg.src = getMockupPath(currentShirtType, currentColor, true); 
    backImg.onload = onLoad; 
  }
  setTimeout(updateDesignSize, 100);
};

const selectShirtType = (index) => {
  currentShirtType = index;
  document.querySelectorAll('.shirt-type-btn').forEach((btn, i) => btn.classList.toggle('active', i === index));
  updateMockups();
  saveCurrentDesign();
};

const selectColor = (colorKey, el) => {
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
    currentScaleFront = Math.max(0.3, Math.min(3, currentScaleFront + delta));
  } else if (side === 1) {
    currentScaleBack = Math.max(0.3, Math.min(3, currentScaleBack + delta));
  } else return;
  updateDesignSize();
  saveCurrentDesign();
};

window.scaleActiveDesign = (delta) => window.scaleDesign(currentTab, delta);

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

    showToast(side === 0 ? "✅ Diseño Frente cargado" : "✅ Diseño Espalda cargado");
    saveCurrentDesign();
  };
  reader.readAsDataURL(file);
};

const resetDesign = () => {
  designFront = null;
  designBack = null;
  currentScaleFront = 1;
  currentScaleBack = 1;
  currentPositionFront = { x: 50, y: 50 };
  currentPositionBack = { x: 50, y: 50 };
  ['design-preview', 'design-preview-back'].forEach(id => {
    const preview = document.getElementById(id);
    if (preview) {
      preview.classList.remove('design-loaded');
      preview.innerHTML = `<span class="text-yellow-400 text-center text-base font-medium pointer-events-none">Arrastra tu diseño aquí</span>`;
    }
  });
  localStorage.removeItem('momotusCurrentDesign');
  showToast("Diseño reseteado");
};

const saveCurrentDesign = () => {
  const data = {
    shirtType: currentShirtType,
    color: currentColor,
    size: currentSize,
    frontDesign: designFront,
    backDesign: designBack,
    scaleFront: currentScaleFront,
    scaleBack: currentScaleBack,
    positionFront: currentPositionFront,
    positionBack: currentPositionBack
  };
  try {
    localStorage.setItem('momotusCurrentDesign', JSON.stringify(data));
    return true;
  } catch (error) {
    console.warn('No fue posible guardar el diseño en este dispositivo.', error);
    showToast('⚠️ No se pudo guardar: prueba con imágenes más pequeñas');
    return false;
  }
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
    localStorage.removeItem('momotusCurrentDesign');
    return;
  }
  currentShirtType = Number.isInteger(Number(data.shirtType))
    ? Math.max(0, Math.min(shirtTypes.length - 1, Number(data.shirtType)))
    : 0;
  currentColor = colors.some(color => color.key === data.color) ? data.color : 'black';
  currentSize = designerSizes.includes(data.size) ? data.size : 'M';
  designFront = isSafeDesignSource(data.frontDesign) ? data.frontDesign : null;
  designBack = isSafeDesignSource(data.backDesign) ? data.backDesign : null;
  currentScaleFront = clampNumber(data.scaleFront, 0.3, 3, 1);
  currentScaleBack = clampNumber(data.scaleBack, 0.3, 3, 1);
  currentPositionFront = normalizePosition(data.positionFront);
  currentPositionBack = normalizePosition(data.positionBack);

  document.querySelectorAll('.shirt-type-btn').forEach((btn, i) => btn.classList.toggle('active', i === currentShirtType));

  const currentColorData = colors.find(color => color.key === currentColor);
  const colorBtn = Array.from(document.querySelectorAll('.color-btn')).find(btn =>
    btn.classList.contains(currentColorData.class)
  );
  if (colorBtn) selectColor(currentColor, colorBtn);

  if (designFront) {
    const preview = document.getElementById('design-preview');
    preview.innerHTML = `<img src="${designFront}" id="draggable-design-front" class="max-w-full max-h-full object-contain rounded-3xl" style="${getDesignStyle(currentColor)}">`;
    preview.classList.add('design-loaded');
    makeDraggable(document.getElementById('draggable-design-front'));
    applyDesignLayout(document.getElementById('draggable-design-front'), 0);
  }
  if (designBack) {
    const preview = document.getElementById('design-preview-back');
    preview.innerHTML = `<img src="${designBack}" id="draggable-design-back" class="max-w-full max-h-full object-contain rounded-3xl" style="${getDesignStyle(currentColor)}">`;
    preview.classList.add('design-loaded');
    makeDraggable(document.getElementById('draggable-design-back'));
    applyDesignLayout(document.getElementById('draggable-design-back'), 1);
  }
  updateMockups();
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
  showToast("🎯 Diseño centrado correctamente");
};

const sendToWhatsApp = () => {
  const typeName = ['Regular / Unisex', 'Slim Fit', 'Oversized'][currentShirtType];
  const colorName = colorMap[currentColor] || currentColor;
  const text = `¡Hola Momotus Core! 👋\n\nAcabo de diseñar mi camiseta:\n• Tipo: ${typeName}\n• Talla: ${currentSize}\n• Color: ${colorName.charAt(0).toUpperCase() + colorName.slice(1)}\n• Frente: ${designFront ? 'Sí' : 'No'}\n• Espalda: ${designBack ? 'Sí' : 'No'}\n\nRevisa la captura que adjunto.\nGracias! 🇳🇮`;
  window.open(`https://wa.me/50555010044?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  showToast("📱 WhatsApp abierto");
};

const sendToEmail = () => {
  const typeName = ['Regular / Unisex', 'Slim Fit', 'Oversized'][currentShirtType];
  const colorName = colorMap[currentColor] || currentColor;
  const subject = "Cotización - Camiseta Personalizada Momotus Core";
  const body = `Hola,\n\nQuiero cotizar:\n- Tipo: ${typeName}\n- Talla: ${currentSize}\n- Color: ${colorName}\n- Frente: ${designFront ? 'Sí' : 'No'}\n- Espalda: ${designBack ? 'Sí' : 'No'}\n\nGracias!`;
  window.location.href = `mailto:momotuscore@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
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
  window.addEventListener('resize', () => setTimeout(updateDesignSize, 200));
  console.log("%c✅ Diseñador COMPLETO y sin errores - Margen 90%/88% mantenido", "color:#facc15; font-weight:bold");
};

window.addEventListener('load', initDesigner);
