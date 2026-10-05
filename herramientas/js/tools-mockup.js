(() => {
  'use strict';

  const bridge = window.MomotusWorkflowBridge;
  const api = window.MomotusToolsAPI;
  if (!bridge || !api) return;

  const garments = [
    { key: 'regular', label: 'Camiseta', icon: 'fa-shirt' },
    { key: 'hoodie', label: 'Hoodie', icon: 'fa-person' },
    { key: 'sudadera', label: 'Sudadera', icon: 'fa-vest' },
    { key: 'crop-top', label: 'Crop-top', icon: 'fa-shirt' }
  ];
  let selectedGarment = 'regular';
  let selectedSide = 0;
  let transferBusy = false;
  const designerImportTools = Object.freeze({
    background: Object.freeze({ panel: 'eliminar-fondo', label: 'eliminador de fondo' }),
    quality: Object.freeze({ panel: 'mejorar-calidad', label: 'mejora de calidad' })
  });

  const showToast = message => api.showToast?.(message);
  const modalMarkup = `
    <div id="mockup-transfer-modal" class="mockup-transfer-modal" role="dialog" aria-modal="true" aria-labelledby="mockup-transfer-title" hidden>
      <button type="button" class="mockup-transfer-backdrop" data-mockup-close aria-label="Cerrar envío a mockup"></button>
      <section class="mockup-transfer-card">
        <header>
          <div><small>CONTINUAR EN DISEÑÁ LA TUYA</small><h2 id="mockup-transfer-title">Colocar diseño en un mockup</h2></div>
          <button type="button" class="mockup-transfer-close" data-mockup-close aria-label="Cerrar"><i class="fa-solid fa-xmark"></i></button>
        </header>
        <div class="mockup-transfer-body">
          <p>El resultado activo se preparará como vista para el mockup. El archivo original de impresión seguirá disponible en Herramientas.</p>
          <fieldset><legend>1. Escogé la prenda</legend><div class="mockup-garment-grid">
            ${garments.map((garment, index) => `<button type="button" data-mockup-garment="${garment.key}" class="${index === 0 ? 'active' : ''}"><i class="fa-solid ${garment.icon}"></i><span>${garment.label}</span></button>`).join('')}
          </div></fieldset>
          <fieldset><legend>2. Escogé el lado</legend><div class="mockup-side-grid">
            <button type="button" data-mockup-side="0" class="active"><i class="fa-solid fa-person"></i> Frente</button>
            <button type="button" data-mockup-side="1"><i class="fa-solid fa-person-rays"></i> Espalda</button>
          </div></fieldset>
          <div class="mockup-transfer-summary"><i class="fa-solid fa-lock"></i><span><strong>Transferencia local</strong><small id="mockup-transfer-document">El diseño no sale de esta computadora.</small></span></div>
        </div>
        <footer><button type="button" data-mockup-close class="mockup-transfer-secondary">Cancelar</button><button id="mockup-transfer-confirm" type="button" class="mockup-transfer-primary"><i class="fa-solid fa-arrow-right"></i> Colocar en mockup</button></footer>
      </section>
    </div>`;

  const installInterface = () => {
    const toolbar = document.querySelector('.tool-probar');
    const actions = toolbar?.querySelector('.tool-history-actions');
    if (!actions || document.getElementById('mockup-transfer-open')) return;
    const button = document.createElement('button');
    button.id = 'mockup-transfer-open';
    button.type = 'button';
    button.className = 'mockup-transfer-open';
    button.disabled = true;
    button.title = 'Colocar el resultado activo en una prenda';
    button.innerHTML = '<i class="fa-solid fa-shirt"></i><span>Usar en mockup</span>';
    const shortcutsButton = actions.querySelector('#tool-shortcuts-help');
    if (shortcutsButton) shortcutsButton.before(button);
    else actions.appendChild(button);
    document.body.insertAdjacentHTML('beforeend', modalMarkup);

    button.addEventListener('click', openModal);
    document.querySelectorAll('[data-mockup-close]').forEach(element => element.addEventListener('click', closeModal));
    document.querySelectorAll('[data-mockup-garment]').forEach(element => element.addEventListener('click', () => selectGarment(element.dataset.mockupGarment)));
    document.querySelectorAll('[data-mockup-side]').forEach(element => element.addEventListener('click', () => selectSide(Number(element.dataset.mockupSide))));
    document.getElementById('mockup-transfer-confirm')?.addEventListener('click', sendToDesigner);
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !document.getElementById('mockup-transfer-modal')?.hidden) closeModal();
    });
    window.addEventListener('momotus:workspace-update', updateButtonState);
    window.addEventListener('momotus:result-ready', updateButtonState);
    updateButtonState();
  };

  const updateButtonState = () => {
    const button = document.getElementById('mockup-transfer-open');
    if (!button) return;
    const type = api.getActiveType();
    button.disabled = transferBusy || !api.hasDocument(type);
  };

  const selectGarment = garment => {
    if (!garments.some(item => item.key === garment)) return;
    selectedGarment = garment;
    document.querySelectorAll('[data-mockup-garment]').forEach(button => button.classList.toggle('active', button.dataset.mockupGarment === garment));
  };

  const selectSide = side => {
    selectedSide = side === 1 ? 1 : 0;
    document.querySelectorAll('[data-mockup-side]').forEach(button => button.classList.toggle('active', Number(button.dataset.mockupSide) === selectedSide));
  };

  const openModal = () => {
    const modal = document.getElementById('mockup-transfer-modal');
    if (!modal || document.getElementById('mockup-transfer-open')?.disabled) return;
    const info = api.getDocumentInfo();
    const detail = document.getElementById('mockup-transfer-document');
    if (detail && info) detail.textContent = `${info.filename} · ${info.naturalWidth} × ${info.naturalHeight} px`;
    modal.hidden = false;
    document.body.classList.add('mockup-transfer-active');
    requestAnimationFrame(() => modal.querySelector('[data-mockup-garment].active')?.focus());
  };

  const closeModal = () => {
    if (transferBusy) return;
    const modal = document.getElementById('mockup-transfer-modal');
    if (modal) modal.hidden = true;
    document.body.classList.remove('mockup-transfer-active');
    document.getElementById('mockup-transfer-open')?.focus();
  };

  const canvasToBlob = canvas => new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se pudo preparar la vista del mockup.')), 'image/png');
  });

  const createMockupBlob = async source => {
    const limits = [1800, 1500, 1200, 960];
    let lastBlob = null;
    for (const limit of limits) {
      const scale = Math.min(1, limit / Math.max(source.width, source.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      const context = canvas.getContext('2d', { alpha: true });
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      lastBlob = await canvasToBlob(canvas);
      if (lastBlob.size <= 2.5 * 1024 * 1024 || limit === limits.at(-1)) return lastBlob;
    }
    return lastBlob;
  };

  const sendToDesigner = async () => {
    if (transferBusy) return;
    const confirmButton = document.getElementById('mockup-transfer-confirm');
    const originalContent = confirmButton.innerHTML;
    transferBusy = true;
    confirmButton.disabled = true;
    confirmButton.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Preparando…';
    updateButtonState();
    try {
      const type = api.getActiveType();
      const canvas = await api.getResultCanvas(type);
      if (!canvas?.width || !canvas.height) throw new Error('Primero procesá una imagen en la herramienta activa.');
      const blob = await createMockupBlob(canvas);
      const info = api.getDocumentInfo(type);
      await bridge.put(bridge.keys.toolsToDesigner, blob, {
        garment: selectedGarment,
        side: selectedSide,
        sourceTool: type,
        filename: `${info?.filename || 'momotus'}-mockup.png`
      });
      showToast('Diseño listo. Abriendo el mockup…');
      window.location.href = `disena.html?importar=herramientas&prenda=${encodeURIComponent(selectedGarment)}&lado=${selectedSide}`;
    } catch (error) {
      console.error('No se pudo enviar el diseño al mockup:', error);
      showToast(error.message || 'No se pudo enviar el diseño al mockup.');
      transferBusy = false;
      confirmButton.disabled = false;
      confirmButton.innerHTML = originalContent;
      updateButtonState();
    }
  };

  const importFromDesigner = async () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('importar') !== 'disenador') return;
    try {
      const key = bridge.keys.designerToTools;
      let record = null;
      for (let attempt = 0; attempt < 5 && !record; attempt++) {
        record = await bridge.get(key);
        if (!record && attempt < 4) await new Promise(resolve => setTimeout(resolve, 120));
      }
      if (!record?.blob) {
        showToast('No se pudo recuperar la imagen. Volvé a Diseñá la tuya e intentá nuevamente.');
        return;
      }
      const queryTool = String(params.get('herramienta') || '').toLowerCase();
      const metadataTool = String(record.metadata?.requestedTool || '').toLowerCase();
      const selectedTool = designerImportTools[queryTool]
        ? queryTool
        : designerImportTools[metadataTool] ? metadataTool : 'background';
      const toolConfig = designerImportTools[selectedTool];
      const filename = String(record.metadata?.filename || 'momotus-diseno.png').replace(/[^a-z0-9._-]/gi, '-');
      const file = new File([record.blob], filename, { type: record.blob.type || 'image/png' });
      const loaded = await api.importFileToTool(file, selectedTool);
      if (!loaded) throw new Error(`No se pudo cargar el diseño en ${toolConfig.label}.`);
      if (garments.some(item => item.key === record.metadata?.garment)) selectGarment(record.metadata.garment);
      selectSide(Number(record.metadata?.side));
      await bridge.remove(key);
      params.delete('importar');
      params.delete('herramienta');
      const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ''}#${toolConfig.panel}`;
      history.replaceState(null, '', cleanUrl);
      showToast(`Diseño cargado en ${toolConfig.label}.`);
    } catch (error) {
      console.error('No se pudo recibir el diseño del personalizador:', error);
      showToast(error.message || 'No se pudo recibir el diseño.');
    }
  };

  installInterface();
  importFromDesigner();
})();
