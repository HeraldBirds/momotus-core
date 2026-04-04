// js/designer.js - Momotus Core - SOLO DISEÑADOR (COMPLETO + OPTIMIZADO PARA MÓVIL)
// Bug #1 corregido + Mejoras móviles - 04 Abril 2026

let currentShirtType = 0;
let currentColor = 'black';
let currentSize = 'M';
let designFront = null;
let designBack = null;

const designSizes = [265, 235, 295]; // Regular, Slim, Oversized

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

// ==================== ACTUALIZACIÓN DE TAMAÑO (OPTIMIZADO PARA MÓVIL) ====================
const updateDesignSize = () => {
  const containerSize = designSizes[currentShirtType];
  const isMobile = window.innerWidth < 768;
  const scaleFactor = isMobile ? 0.88 : 0.82;

  ['design-preview', 'design-preview-back'].forEach(id => {
    const preview = document.getElementById(id);
    if (!preview) return;

    preview.style.width = `${containerSize}px`;
    preview.style.height = `${containerSize}px`;

    const designImg = preview.querySelector('img');
    if (designImg) {
      designImg.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';

      const targetSize = Math.round(containerSize * scaleFactor);
      const aspect = designImg.naturalWidth / designImg.naturalHeight || 1;

      let newWidth = targetSize;
      let newHeight = Math.round(newWidth / aspect);

      if (newHeight > containerSize * 0.90) {
        newHeight = Math.round(containerSize * 0.90);
        newWidth = Math.round(newHeight * aspect);
      }

      designImg.style.width = `${newWidth}px`;
      designImg.style.height = `${newHeight}px`;

      const centerX = (containerSize - newWidth) / 2;
      const centerY = (containerSize - newHeight) / 2;

      designImg.style.left = `${centerX}px`;
      designImg.style.top = `${centerY}px`;
    }
  });
};

const updateMockups = () => {
  const frontImg = document.getElementById('shirt-mockup');
  const backImg = document.getElementById('shirt-mockup-back');

  let imagesLoaded = 0;
  const totalImages = (frontImg ? 1 : 0) + (backImg ? 1 : 0);

  const onImageLoad = () => {
    imagesLoaded++;
    if (imagesLoaded === totalImages) {
      updateDesignSize();
      saveCurrentDesign();
    }
  };

  if (frontImg) {
    frontImg.src = getMockupPath(currentShirtType, currentColor, false);
    frontImg.onload = onImageLoad;
  }
  if (backImg) {
    backImg.src = getMockupPath(currentShirtType, currentColor, true);
    backImg.onload = onImageLoad;
  }

  setTimeout(() => {
    if (imagesLoaded < totalImages) updateDesignSize();
  }, 150);
};

const selectShirtType = (index) => {
  currentShirtType = index;
  document.querySelectorAll('.shirt-type-btn').forEach((btn, i) => 
    btn.classList.toggle('active', i === index)
  );
  updateMockups();
};

const selectColor = (colorKey, el) => {
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  currentColor = colorKey;
  updateMockups();
};

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
    backDesign: designBack
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

// ==================== VISTA PREVIA FINAL ====================
const showFinalPreview = () => {
  const modalHTML = `
    <div id="final-preview-modal" class="fixed inset-0 bg-black/95 flex items-center justify-center z-[12000] p-4">
      <div class="bg-zinc-900 rounded-3xl max-w-5xl w-full max-h-[95vh] overflow-hidden">
        <div class="px-8 py-6 border-b border-zinc-700 flex justify-between items-center">
          <h3 class="text-3xl font-bold">Vista Previa Final de tu Camiseta</h3>
          <button onclick="closeFinalPreview()" class="text-5xl text-zinc-400 hover:text-white leading-none">×</button>
        </div>
        <div class="p-8 flex flex-col lg:flex-row gap-12">
          <div class="flex-1 flex justify-center">
            <div class="relative max-w-md w-full">
              <img id="preview-shirt-big" src="${getMockupPath(currentShirtType, currentColor, false)}" class="w-full rounded-3xl shadow-2xl" alt="Vista previa final">
              <div id="preview-design-big" class="absolute top-[26%] left-1/2 -translate-x-1/2 pointer-events-none"></div>
            </div>
          </div>
          <div class="flex-1">
            <h4 class="text-2xl font-bold mb-6">Tu diseño personalizado</h4>
            <div class="mb-8">
              <p class="font-medium mb-3">Talla</p>
              <div class="flex flex-wrap gap-3" id="preview-size-buttons"></div>
            </div>
            <div class="bg-gradient-to-r from-yellow-400/10 to-transparent border border-yellow-400/30 rounded-3xl p-6 mb-8">
              <p class="text-yellow-300 font-semibold">¿Listo para pedirla?</p>
              <p class="text-zinc-400 text-sm mt-2">Envíanos esta vista previa por WhatsApp y te damos el precio exacto en menos de 10 minutos.</p>
            </div>
            <button onclick="sendToWhatsAppFromPreview()" class="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-7 rounded-3xl text-xl flex items-center justify-center gap-4 mb-4">
              <i class="fa-brands fa-whatsapp text-3xl"></i>
              ENVIAR POR WHATSAPP
            </button>
            <p class="text-center text-xs text-zinc-500">Toma captura de pantalla de esta vista para guardar tu diseño.</p>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const container = document.getElementById('preview-design-big');
  if (designFront) {
    container.innerHTML = `<img src="${designFront}" class="max-w-full max-h-full object-contain rounded-3xl" style="${getDesignStyle(currentColor)}">`;
  }
  renderPreviewSizeButtons();
};

const closeFinalPreview = () => {
  const modal = document.getElementById('final-preview-modal');
  if (modal) modal.remove();
};

const renderPreviewSizeButtons = () => {
  const container = document.getElementById('preview-size-buttons');
  if (!container) return;
  container.innerHTML = '';
  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  sizes.forEach(size => {
    const btn = document.createElement('button');
    btn.textContent = size;
    btn.className = `px-8 py-4 rounded-3xl font-medium border transition ${size === currentSize ? 'bg-yellow-400 text-black border-yellow-400' : 'border-zinc-600 hover:border-yellow-400'}`;
    btn.onclick = () => {
      currentSize = size;
      renderPreviewSizeButtons();
    };
    container.appendChild(btn);
  });
};

const sendToWhatsAppFromPreview = () => {
  closeFinalPreview();
  sendToWhatsApp();
};

const sendToWhatsApp = () => {
  const typeName = ['Regular / Unisex', 'Slim Fit', 'Oversized'][currentShirtType];
  const colorName = colorMap[currentColor] || currentColor;
  const text = `¡Hola Momotus Core! 👋%0A%0AAcabo de diseñar mi camiseta personalizada:%0A• Tipo de corte: ${typeName}%0A• Talla: ${currentSize}%0A• Color: ${colorName.charAt(0).toUpperCase() + colorName.slice(1)}%0A• Diseño Frente: ${designFront ? 'Sí' : 'No'}%0A• Diseño Espalda: ${designBack ? 'Sí' : 'No'}%0A%0APor favor revisa la vista previa que adjuntaré.%0AGracias! 🇳🇮`;
  window.open(`https://wa.me/50555010044?text=${text}`, '_blank');
  showToast("📱 WhatsApp abierto – adjunta la captura");
};

const sendToEmail = () => {
  const typeName = ['Regular / Unisex', 'Slim Fit', 'Oversized'][currentShirtType];
  const colorName = colorMap[currentColor] || currentColor;
  const subject = "Cotización - Camiseta Personalizada Momotus Core";
  const body = `Hola equipo,%0A%0AQuiero cotizar una camiseta:%0A- Tipo: ${typeName}%0A- Talla: ${currentSize}%0A- Color: ${colorName}%0A- Diseño Frente: ${designFront ? 'Sí' : 'No'}%0A- Diseño Espalda: ${designBack ? 'Sí' : 'No'}%0A%0APor favor revisa las imágenes adjuntas.%0AGracias!`;
  window.location.href = `mailto:momotuscore@gmail.com?subject=${encodeURIComponent(subject)}&body=${body}`;
  showToast("✉️ Email abierto");
};

// ==================== MOCKUP 3D FLIP ====================
let isFlipped = false;
window.flipMockup = () => {
  isFlipped = !isFlipped;
  const container = document.getElementById('mockup-3d');
  const front = document.getElementById('front');
  const back = document.getElementById('back');
  if (!container || !front || !back) return;
  
  if (isFlipped) {
    container.style.transform = 'rotateY(180deg)';
    front.style.opacity = '0';
    back.style.opacity = '1';
  } else {
    container.style.transform = 'rotateY(0deg)';
    front.style.opacity = '1';
    back.style.opacity = '0';
  }
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
    newX = Math.max(0, Math.min(newX, previewRect.width - currentDraggingDesign.offsetWidth));
    newY = Math.max(0, Math.min(newY, previewRect.height - currentDraggingDesign.offsetHeight));
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

const centerDesign = (side) => {
  const previewId = side === 0 ? 'design-preview' : 'design-preview-back';
  const preview = document.getElementById(previewId);
  const design = preview ? preview.querySelector('img') : null;
  if (!design) return showToast("❌ No hay diseño para centrar");
  const previewRect = preview.getBoundingClientRect();
  const designRect = design.getBoundingClientRect();
  const centerX = (previewRect.width - designRect.width) / 2;
  const centerY = (previewRect.height - designRect.height) / 2;
  design.style.left = `${centerX}px`;
  design.style.top = `${centerY}px`;
  showToast("🎯 Diseño centrado correctamente");
};

// ==================== INICIALIZACIÓN ====================
const initDesigner = () => {
  if (document.getElementById('type-0')) {
    selectShirtType(0);
    renderSizeButtonsDesigner();
    renderColorButtons();
  }
  loadSavedDesign();
  initDragListeners();

  window.addEventListener('resize', () => setTimeout(updateDesignSize, 200));

  console.log("%c✅ Diseñador completo y optimizado para móvil cargado", "color:#facc15; font-weight:bold");
};

window.addEventListener('load', initDesigner);