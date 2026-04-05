// js/designer.js - Momotus Core - VERSIÓN FINAL CORREGIDA (04 Abril 2026)
// ✅ Sin borde amarillo en Vista Previa Final + diseño completo visible

let currentShirtType = 0;
let currentColor = 'black';
let currentSize = 'M';
let designFront = null;
let designBack = null;
let currentScaleFront = 1;
let currentScaleBack = 1;

const designSizes = [265, 235, 295];

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

const getDesignStyle = (colorKey) => {
  return colorKey === 'white'
    ? `mix-blend-mode: multiply; filter: brightness(0.95) contrast(1.25) saturate(1.1) opacity(0.92);`
    : `mix-blend-mode: multiply; filter: brightness(1.08) contrast(1.18) saturate(1.25) opacity(0.95);`;
};

// ==================== ACTUALIZAR TAMAÑO ====================
const updateDesignSize = () => {
  const containerSize = designSizes[currentShirtType];
  ['design-preview', 'design-preview-back'].forEach((id, index) => {
    const preview = document.getElementById(id);
    if (!preview) return;
    preview.style.width = `${containerSize}px`;
    preview.style.height = `${containerSize}px`;
    const designImg = preview.querySelector('img');
    if (designImg) {
      const scale = index === 0 ? currentScaleFront : currentScaleBack;
      designImg.style.transform = `scale(${scale})`;
    }
  });
};

const updateMockups = () => {
  const frontImg = document.getElementById('shirt-mockup');
  const backImg = document.getElementById('shirt-mockup-back');
  let loaded = 0;
  const total = (frontImg ? 1 : 0) + (backImg ? 1 : 0);
  const onLoad = () => { loaded++; if (loaded === total) updateDesignSize(); };

  if (frontImg) { frontImg.src = getMockupPath(currentShirtType, currentColor, false); frontImg.onload = onLoad; }
  if (backImg) { backImg.src = getMockupPath(currentShirtType, currentColor, true); backImg.onload = onLoad; }
  setTimeout(updateDesignSize, 100);
};

const selectShirtType = (index) => {
  currentShirtType = index;
  document.querySelectorAll('.shirt-type-btn').forEach((btn, i) => btn.classList.toggle('active', i === index));
  updateMockups();
};

const selectColor = (colorKey, el) => {
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  currentColor = colorKey;
  updateMockups();
};

window.scaleDesign = (side, delta) => {
  if (side === 0) currentScaleFront = Math.max(0.3, Math.min(3, currentScaleFront + delta));
  else currentScaleBack = Math.max(0.3, Math.min(3, currentScaleBack + delta));
  updateDesignSize();
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
  offsetX = clientX - rect.left;
  offsetY = clientY - rect.top;
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
    let newX = clientX - previewRect.left - offsetX;
    let newY = clientY - previewRect.top - offsetY;
    newX = Math.max(-currentDraggingDesign.offsetWidth * 0.8, Math.min(newX, previewRect.width - currentDraggingDesign.offsetWidth * 0.2));
    newY = Math.max(-currentDraggingDesign.offsetHeight * 0.8, Math.min(newY, previewRect.height - currentDraggingDesign.offsetHeight * 0.2));
    currentDraggingDesign.style.left = `${newX}px`;
    currentDraggingDesign.style.top = `${newY}px`;
    e.preventDefault();
  };
  const endHandler = () => {
    if (currentDraggingDesign) currentDraggingDesign.style.transition = 'all 0.2s ease';
    isDragging = false;
    currentDraggingDesign = null;
  };
  document.addEventListener('mousemove', moveHandler);
  document.addEventListener('touchmove', moveHandler, { passive: false });
  document.addEventListener('mouseup', endHandler);
  document.addEventListener('touchend', endHandler);
};

// ==================== SUBIR DISEÑO ====================
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
    scaleBack: currentScaleBack
  };
  localStorage.setItem('momotusCurrentDesign', JSON.stringify(data));
};

const loadSavedDesign = () => {
  const saved = localStorage.getItem('momotusCurrentDesign');
  if (!saved) return;
  const data = JSON.parse(saved);
  currentShirtType = data.shirtType || 0;
  currentColor = data.color || 'black';
  currentSize = data.size || 'M';
  designFront = data.frontDesign;
  designBack = data.backDesign;
  currentScaleFront = data.scaleFront || 1;
  currentScaleBack = data.scaleBack || 1;

  document.querySelectorAll('.shirt-type-btn').forEach((btn, i) => btn.classList.toggle('active', i === currentShirtType));

  const colorBtn = Array.from(document.querySelectorAll('.color-btn')).find(btn => 
    btn.classList.contains(colors.find(c => c.key === currentColor).class)
  );
  if (colorBtn) selectColor(currentColor, colorBtn);

  if (designFront) {
    const preview = document.getElementById('design-preview');
    preview.innerHTML = `<img src="${designFront}" id="draggable-design-front" class="max-w-full max-h-full object-contain rounded-3xl" style="${getDesignStyle(currentColor)}">`;
    preview.classList.add('design-loaded');
    makeDraggable(document.getElementById('draggable-design-front'));
  }
  if (designBack) {
    const preview = document.getElementById('design-preview-back');
    preview.innerHTML = `<img src="${designBack}" id="draggable-design-back" class="max-w-full max-h-full object-contain rounded-3xl" style="${getDesignStyle(currentColor)}">`;
    preview.classList.add('design-loaded');
    makeDraggable(document.getElementById('draggable-design-back'));
  }
  updateMockups();
};

const switchMockup = (tab) => {
  document.getElementById('tab-frente').classList.toggle('tab-active', tab === 0);
  document.getElementById('tab-espalda').classList.toggle('tab-active', tab === 1);
  document.getElementById('mockup-frente').classList.toggle('hidden', tab === 1);
  document.getElementById('mockup-espalda').classList.toggle('hidden', tab === 0);
};

const renderSizeButtonsDesigner = () => {
  const container = document.getElementById('size-buttons');
  if (!container) return;
  container.innerHTML = '';
  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  sizes.forEach(size => {
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
  window.open('https://remove.bg', '_blank');
  showToast("🪄 remove.bg abierto");
};

// ==================== VISTA PREVIA FINAL (SIN BORDE AMARILLO) ====================
const showFinalPreview = async () => {
  const modalHTML = `
    <div id="final-preview-modal" class="fixed inset-0 bg-black/95 flex items-center justify-center z-[12000] p-4">
      <div class="bg-zinc-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl">
        <div class="px-6 py-5 border-b border-zinc-700 flex justify-between items-center">
          <h3 class="text-2xl font-bold">Vista Previa Final</h3>
          <button onclick="closeFinalPreview()" class="text-4xl text-zinc-400 hover:text-white">×</button>
        </div>
        <div class="p-6" id="preview-content">
          <div class="flex justify-center items-center py-12">
            <div class="text-center">
              <i class="fa-solid fa-spinner animate-spin text-5xl text-yellow-400 mb-4"></i>
              <p class="text-zinc-300">Generando vista limpia...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  const contentContainer = document.getElementById('preview-content');

  try {
    // Clonamos para no modificar el editor
    const originalFront = document.getElementById('mockup-frente');
    const cloneFront = originalFront.cloneNode(true);
    const designPreviewClone = cloneFront.querySelector('#design-preview');
    if (designPreviewClone) {
      designPreviewClone.style.border = 'none';
      designPreviewClone.style.background = 'transparent';
    }

    const canvasFront = await html2canvas(cloneFront, {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
      logging: false,
      allowTaint: true
    });

    let backSection = '';
    if (designBack) {
      const originalBack = document.getElementById('mockup-espalda');
      const cloneBack = originalBack.cloneNode(true);
      const designPreviewBackClone = cloneBack.querySelector('#design-preview-back');
      if (designPreviewBackClone) {
        designPreviewBackClone.style.border = 'none';
        designPreviewBackClone.style.background = 'transparent';
      }
      const canvasBack = await html2canvas(cloneBack, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        allowTaint: true
      });
      backSection = `
        <div class="mt-8">
          <h4 class="text-xl font-semibold text-center mb-4 text-yellow-300">Vista Espalda</h4>
          <img src="${canvasBack.toDataURL('image/png')}" class="mx-auto rounded-3xl shadow-xl w-full max-w-[420px]">
        </div>`;
    }

    contentContainer.innerHTML = `
      <div class="space-y-8">
        <div>
          <h4 class="text-xl font-semibold text-center mb-4 text-yellow-300">Vista Frente</h4>
          <img src="${canvasFront.toDataURL('image/png')}" class="mx-auto rounded-3xl shadow-xl w-full max-w-[420px]">
        </div>
        ${backSection}
        <div class="pt-6 border-t border-zinc-700 flex gap-3">
          <button onclick="sendToWhatsAppFromPreview()" class="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold py-6 rounded-3xl text-lg flex items-center justify-center gap-3">
            <i class="fa-brands fa-whatsapp text-2xl"></i> WhatsApp
          </button>
          <button onclick="closeFinalPreview()" class="flex-1 border border-zinc-600 hover:bg-zinc-800 py-6 rounded-3xl font-bold text-lg">Cerrar</button>
        </div>
      </div>
    `;
  } catch (err) {
    console.error(err);
    contentContainer.innerHTML = `<p class="text-red-400 text-center py-8">Error al generar la vista previa.</p>`;
  }
};

const closeFinalPreview = () => {
  const modal = document.getElementById('final-preview-modal');
  if (modal) modal.remove();
};

const sendToWhatsAppFromPreview = () => {
  closeFinalPreview();
  sendToWhatsApp();
};

const sendToWhatsApp = () => {
  const typeName = ['Regular / Unisex', 'Slim Fit', 'Oversized'][currentShirtType];
  const colorName = colorMap[currentColor] || currentColor;
  const text = `¡Hola Momotus Core! 👋%0A%0AAcabo de diseñar mi camiseta:%0A• Tipo: ${typeName}%0A• Talla: ${currentSize}%0A• Color: ${colorName.charAt(0).toUpperCase() + colorName.slice(1)}%0A• Frente: ${designFront ? 'Sí' : 'No'}%0A• Espalda: ${designBack ? 'Sí' : 'No'}%0A%0ARevisa la vista previa adjunta.%0AGracias! 🇳🇮`;
  window.open(`https://wa.me/50555010044?text=${text}`, '_blank');
  showToast("📱 WhatsApp abierto");
};

const sendToEmail = () => {
  const typeName = ['Regular / Unisex', 'Slim Fit', 'Oversized'][currentShirtType];
  const colorName = colorMap[currentColor] || currentColor;
  const subject = "Cotización - Camiseta Personalizada Momotus Core";
  const body = `Hola,%0A%0AQuiero cotizar:%0A- Tipo: ${typeName}%0A- Talla: ${currentSize}%0A- Color: ${colorName}%0A- Frente: ${designFront ? 'Sí' : 'No'}%0A- Espalda: ${designBack ? 'Sí' : 'No'}%0A%0AGracias!`;
  window.location.href = `mailto:momotuscore@gmail.com?subject=${encodeURIComponent(subject)}&body=${body}`;
  showToast("✉️ Email abierto");
};

const centerDesign = (side) => {
  const previewId = side === 0 ? 'design-preview' : 'design-preview-back';
  const preview = document.getElementById(previewId);
  const design = preview ? preview.querySelector('img') : null;
  if (!design) return showToast("❌ No hay diseño para centrar");
  const previewRect = preview.getBoundingClientRect();
  const designRect = design.getBoundingClientRect();
  design.style.left = `${(previewRect.width - designRect.width) / 2}px`;
  design.style.top = `${(previewRect.height - designRect.height) / 2}px`;
  showToast("🎯 Diseño centrado");
};

const initDesigner = () => {
  if (document.getElementById('type-0')) {
    selectShirtType(0);
    renderSizeButtonsDesigner();
    renderColorButtons();
  }
  loadSavedDesign();
  initDragListeners();
  window.addEventListener('resize', () => setTimeout(updateDesignSize, 200));
  console.log("%c✅ Diseñador COMPLETO y corregido cargado", "color:#facc15; font-weight:bold");
};

window.addEventListener('load', initDesigner);