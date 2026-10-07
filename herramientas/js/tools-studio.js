(() => {
  'use strict';

  if (!window.MOMOTUS_TOOLS_DESKTOP) return;

  const toolMeta = {
    halftone: { panel: 'semitonos', name: 'Semitonos', icon: 'fa-circle-half-stroke', download: 'halftone-download' },
    background: { panel: 'eliminar-fondo', name: 'Rango de color', icon: 'fa-eraser', download: 'background-download' },
    quality: { panel: 'mejorar-calidad', name: 'Calidad y color', icon: 'fa-sliders', download: 'quality-download' }
  };
  const panelToType = Object.fromEntries(Object.entries(toolMeta).map(([type, meta]) => [meta.panel, type]));
  const histories = Object.fromEntries(Object.keys(toolMeta).map(type => [type, { entries: ['Estado inicial'], index: 0 }]));
  let activeType = 'halftone';
  let historyTimer = 0;
  let technicalFrame = 0;

  const byId = id => document.getElementById(id);
  const getActiveType = () => {
    const panel = [...document.querySelectorAll('.tool-panel')].find(item => !item.hidden);
    return panelToType[panel?.id] || activeType;
  };
  const cleanLabel = value => String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\s*\d+(?:\.\d+)?(?:%|°|\sLPI|\smm)?\s*$/, '')
    .trim()
    .slice(0, 42);

  const readStorage = (key, fallback = null) => {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  };

  const writeStorage = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  };

  const captureToolSettings = type => {
    const controls = byId(toolMeta[type].panel)?.querySelector('.tool-controls');
    if (!controls) return {};
    return Object.fromEntries([...controls.querySelectorAll('input[id], select[id]')]
      .filter(element => element.type !== 'file' && !element.classList.contains('studio-range-number'))
      .map(element => [element.id, element.type === 'checkbox' ? element.checked : element.value]));
  };

  const applyToolSettings = (type, settings) => {
    Object.entries(settings || {}).forEach(([id, value]) => {
      const element = byId(id);
      if (!element || !element.closest(`#${toolMeta[type].panel}`)) return;
      if (element.type === 'checkbox') element.checked = Boolean(value);
      else element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    });
  };

  const addInspectorChrome = () => {
    Object.entries(toolMeta).forEach(([type, meta]) => {
      const panel = byId(meta.panel);
      const controls = panel?.querySelector('.tool-controls');
      if (!controls) return;
      controls.dataset.toolType = type;
      const propertyTabs = [...controls.querySelectorAll('.tool-control-tabs button')];
      propertyTabs.forEach((button, index) => {
        const level = document.createElement('small');
        level.className = 'studio-tab-level';
        level.textContent = index === 0 ? 'Básico' : index === propertyTabs.length - 1 ? 'Salida' : 'Avanzado';
        button.append(level);
      });

      const tabs = controls.querySelector('.tool-control-tabs');
      const groups = [...controls.querySelectorAll(':scope > .tool-control-group')];
      if(tabs&&groups.length){
        tabs.hidden=true;
        const panels=document.createElement('div');panels.className='tool-control-panels pro-control-panels';
        tabs.after(panels);groups.forEach((group,index)=>{panels.append(group);group.open=index===0;});
      }

      const heading = document.createElement('div');
      heading.className = 'studio-inspector-heading';
      heading.innerHTML = `
        <div><small>PROPIEDADES</small><strong><i class="fa-solid ${meta.icon}" aria-hidden="true"></i>${meta.name}</strong></div>
        <div class="studio-inspector-actions">
          <span data-inspector-state>Salida DTF</span>
          <button type="button" data-copy-settings="${type}" title="Copiar ajustes"><i class="fa-regular fa-copy" aria-hidden="true"></i></button>
          <button type="button" data-save-settings="${type}" title="Guardar preset personal"><i class="fa-regular fa-floppy-disk" aria-hidden="true"></i></button>
          <button type="button" data-load-settings="${type}" title="Recuperar preset personal"><i class="fa-solid fa-box-archive" aria-hidden="true"></i></button>
        </div>`;
      controls.prepend(heading);

      heading.querySelector('[data-copy-settings]').addEventListener('click', async () => {
        const text = JSON.stringify(captureToolSettings(type), null, 2);
        try {
          await navigator.clipboard.writeText(text);
          showToast('Ajustes copiados.');
        } catch (error) {
          showToast('No se pudo copiar; podés guardar el preset en este navegador.');
        }
      });
      heading.querySelector('[data-save-settings]').addEventListener('click', () => {
        showToast(writeStorage(`momotusToolsPreset:${type}`, captureToolSettings(type)) ? 'Preset personal guardado.' : 'No se pudo guardar el preset.');
      });
      heading.querySelector('[data-load-settings]').addEventListener('click', () => {
        const preset = readStorage(`momotusToolsPreset:${type}`);
        if (!preset) return showToast('Todavía no hay un preset personal guardado.');
        applyToolSettings(type, preset);
        showToast('Preset personal recuperado.');
      });

      const history = document.createElement('section');
      history.className = 'studio-history-panel';
      history.dataset.historyType = type;
      history.innerHTML = `
        <button type="button" class="studio-history-toggle" aria-expanded="false">
          <span><i class="fa-solid fa-clock-rotate-left" aria-hidden="true"></i> Historial</span>
          <small data-history-count>1 estado</small>
          <i class="fa-solid fa-chevron-up" aria-hidden="true"></i>
        </button>
        <ol class="studio-history-list" aria-label="Historial de ajustes"></ol>`;
      controls.querySelector('.tool-action-dock')?.before(history);
      history.querySelector('.studio-history-toggle').addEventListener('click', event => {
        const open = !history.classList.contains('open');
        history.classList.toggle('open', open);
        event.currentTarget.setAttribute('aria-expanded', String(open));
      });
    });
  };

  const addWorkflowPipeline = () => {
    const toolbar = document.querySelector('.tool-probar');
    const historyActions = toolbar?.querySelector('.tool-history-actions');
    if (!toolbar || !historyActions) return;
    const pipeline = document.createElement('div');
    pipeline.className = 'studio-pipeline';
    pipeline.setAttribute('aria-label', 'Flujo recomendado de preparación DTF');
    pipeline.innerHTML = `
      <button type="button" data-studio-pipeline="mejorar-calidad"><b>1</b><span>Calidad</span></button>
      <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
      <button type="button" data-studio-pipeline="eliminar-fondo"><b>2</b><span>Fondo</span></button>
      <i class="fa-solid fa-chevron-right" aria-hidden="true"></i>
      <button type="button" data-studio-pipeline="semitonos"><b>3</b><span>Semitono</span></button>`;
    historyActions.before(pipeline);
    pipeline.querySelectorAll('[data-studio-pipeline]').forEach(button => button.addEventListener('click', () => {
      document.querySelector(`.tool-shortcut[data-tool-target="${button.dataset.studioPipeline}"]`)?.click();
    }));
  };

  const addPrecisionControls = () => {
    document.querySelectorAll('.tool-controls input[type="range"]').forEach(range => {
      if (range.dataset.precisionReady) return;
      range.dataset.precisionReady = 'true';
      const number = document.createElement('input');
      number.type = 'number';
      number.className = 'studio-range-number';
      number.min = range.min;
      number.max = range.max;
      number.step = range.step || '1';
      number.value = range.value;
      number.setAttribute('aria-label', `Valor exacto de ${cleanLabel(range.closest('label')?.textContent || range.id)}`);
      range.after(number);
      range.addEventListener('input', () => { number.value = range.value; });
      number.addEventListener('change', () => {
        const minimum = Number(range.min);
        const maximum = Number(range.max);
        const value = Math.max(minimum, Math.min(maximum, Number(number.value)));
        range.value = String(Number.isFinite(value) ? value : Number(range.defaultValue));
        number.value = range.value;
        range.dispatchEvent(new Event('input', { bubbles: true }));
        range.dispatchEvent(new Event('change', { bubbles: true }));
      });
      range.addEventListener('dblclick', event => {
        event.preventDefault();
        range.value = range.defaultValue;
        number.value = range.value;
        range.dispatchEvent(new Event('input', { bubbles: true }));
        range.dispatchEvent(new Event('change', { bubbles: true }));
        showToast('Ajuste restablecido.');
      });
    });
    document.querySelectorAll('.tool-controls select[id], .tool-controls input[type="number"][id], .tool-controls input[type="color"][id]').forEach(control => {
      control.addEventListener('dblclick', event => {
        event.preventDefault();
        control.value = control instanceof HTMLSelectElement
          ? ([...control.options].find(option => option.defaultSelected)?.value || control.options[0]?.value || '')
          : control.defaultValue;
        control.dispatchEvent(new Event('input', { bubbles: true }));
        control.dispatchEvent(new Event('change', { bubbles: true }));
        showToast('Ajuste restablecido.');
      });
    });
  };

  const addCanvasChrome = () => {
    Object.keys(toolMeta).forEach(type => {
      const preview = byId(`${type}-preview`);
      const shell = preview?.closest('.tool-preview-shell');
      const toolbar = shell?.querySelector('.tool-preview-toolbar');
      if (!preview || !shell || !toolbar) return;

      const viewControls = document.createElement('div');
      viewControls.className = 'studio-view-controls';
      viewControls.innerHTML = `
        <button type="button" data-studio-guides="${type}" aria-pressed="true" title="Mostrar u ocultar reglas y guías"><i class="fa-solid fa-ruler-combined" aria-hidden="true"></i><span>Guías</span></button>
        <label title="Escoger modo de comparación"><i class="fa-solid fa-code-compare" aria-hidden="true"></i><span>Comparar</span>
          <select data-studio-compare-mode="${type}" aria-label="Modo de comparación">
            <option value="split-v">División vertical</option>
            <option value="split-h">División horizontal</option>
            <option value="side">Lado a lado</option>
          </select>
        </label>
        <button type="button" data-studio-before-after="${type}" title="Mantener presionado para ver el original"><i class="fa-solid fa-eye" aria-hidden="true"></i><span>Antes</span></button>
        <label title="Simular el resultado sobre una prenda"><i class="fa-solid fa-shirt" aria-hidden="true"></i><span>Prenda</span>
          <select data-studio-garment="${type}" aria-label="Tipo de prenda">
            <option value="none">Sin prenda</option>
            <option value="tshirt">Camiseta</option>
            <option value="hoodie">Hoodie</option>
            <option value="sweatshirt">Sudadera</option>
            <option value="crop">Crop-top</option>
          </select>
          <input type="color" data-studio-garment-color="${type}" value="#111111" aria-label="Color de la prenda">
        </label>
        <label title="Inspeccionar transparencia o base blanca"><i class="fa-solid fa-layer-group" aria-hidden="true"></i><span>Canal</span>
          <select data-studio-inspection="${type}" aria-label="Canal de inspección">
            <option value="normal">Color normal</option>
            <option value="alpha">Canal alfa</option>
            <option value="underbase">Base blanca DTF</option>
          </select>
        </label>`;
      toolbar.append(viewControls);

      const rulers = document.createElement('div');
      rulers.className = 'studio-rulers';
      rulers.setAttribute('aria-hidden', 'true');
      rulers.innerHTML = '<span class="studio-ruler-corner"></span><span class="studio-ruler-horizontal"></span><span class="studio-ruler-vertical"></span><span class="studio-guide-h"></span><span class="studio-guide-v"></span>';
      preview.before(rulers);
      const garmentSurface = document.createElement('div');
      garmentSurface.className = 'studio-garment-surface';
      garmentSurface.setAttribute('aria-hidden', 'true');
      preview.prepend(garmentSurface);
      const minimap = document.createElement('div');
      minimap.className = 'studio-minimap';
      minimap.dataset.minimap = type;
      minimap.innerHTML = `<canvas width="150" height="100" aria-label="Minimapa del diseño"></canvas><span aria-hidden="true"></span>`;
      preview.after(minimap);
      shell.classList.add('studio-guides-visible');

      viewControls.querySelector('[data-studio-guides]').addEventListener('click', event => {
        const visible = !shell.classList.contains('studio-guides-visible');
        shell.classList.toggle('studio-guides-visible', visible);
        event.currentTarget.classList.toggle('active', visible);
        event.currentTarget.setAttribute('aria-pressed', String(visible));
      });
      viewControls.querySelector('[data-studio-garment]').addEventListener('change', event => {
        preview.dataset.garment = event.currentTarget.value;
        if (event.currentTarget.value !== 'none') {
          const analysis = sampleAlpha(byId(`${type}-canvas`));
          if (analysis && analysis.transparent < 0.1) showToast('La imagen no tiene fondo transparente; la prenda puede quedar cubierta por el fondo del diseño.');
        }
        scheduleTechnicalUpdate();
      });
      viewControls.querySelector('[data-studio-garment-color]').addEventListener('input', event => {
        preview.style.setProperty('--garment', event.currentTarget.value);
      });
      viewControls.querySelector('[data-studio-inspection]').addEventListener('change', event => {
        preview.dataset.inspection = event.currentTarget.value;
        scheduleTechnicalUpdate();
      });
      preview.dataset.garment = 'none';
      preview.dataset.inspection = 'normal';
    });
  };

  const exitSideBySide = type => {
    const preview = byId(`${type}-preview`);
    if (!preview?.classList.contains('studio-side-by-side')) return;
    preview.classList.remove('studio-side-by-side');
    const resultButton = document.querySelector(`[data-preview-tool="${type}"][data-preview-view="result"]`);
    resultButton?.click();
  };

  const setComparisonMode = (type, mode) => {
    const preview = byId(`${type}-preview`);
    const compareButton = document.querySelector(`[data-preview-compare="${type}"]`);
    if (!preview || !compareButton || compareButton.disabled) return;
    if (mode === 'side') {
      if (preview.classList.contains('compare-active')) compareButton.click();
      preview.classList.add('studio-side-by-side');
      const image = byId(`${type}-original`);
      const canvas = byId(`${type}-canvas`);
      if (image?.src) image.hidden = false;
      if (canvas) canvas.hidden = false;
      return;
    }
    exitSideBySide(type);
    preview.dataset.compareOrientation = mode === 'split-h' ? 'horizontal' : 'vertical';
    if (!preview.classList.contains('compare-active')) compareButton.click();
  };

  const updateMinimap = type => {
    const preview = byId(`${type}-preview`);
    const minimap = document.querySelector(`[data-minimap="${type}"]`);
    const canvas = minimap?.querySelector('canvas');
    const viewport = minimap?.querySelector('span');
    const sourceCanvas = byId(`${type}-canvas`);
    const sourceImage = byId(`${type}-original`);
    const source = sourceCanvas && !sourceCanvas.hidden ? sourceCanvas : sourceImage;
    if (!preview || !canvas || !viewport || !source || (source instanceof HTMLImageElement && !source.complete)) {
      minimap?.classList.remove('visible');
      return;
    }
    try {
      const sourceWidth = source instanceof HTMLCanvasElement ? source.width : source.naturalWidth;
      const sourceHeight = source instanceof HTMLCanvasElement ? source.height : source.naturalHeight;
      if (!sourceWidth || !sourceHeight) return minimap.classList.remove('visible');
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);
      const width = sourceWidth * scale;
      const height = sourceHeight * scale;
      context.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      const horizontalRatio = Math.min(1, preview.clientWidth / Math.max(1, preview.scrollWidth));
      const verticalRatio = Math.min(1, preview.clientHeight / Math.max(1, preview.scrollHeight));
      viewport.style.width = `${Math.max(12, horizontalRatio * 100)}%`;
      viewport.style.height = `${Math.max(12, verticalRatio * 100)}%`;
      viewport.style.left = `${(preview.scrollLeft / Math.max(1, preview.scrollWidth - preview.clientWidth)) * (100 - Math.max(12, horizontalRatio * 100))}%`;
      viewport.style.top = `${(preview.scrollTop / Math.max(1, preview.scrollHeight - preview.clientHeight)) * (100 - Math.max(12, verticalRatio * 100))}%`;
      minimap.classList.toggle('visible', horizontalRatio < 0.98 || verticalRatio < 0.98);
    } catch (error) {
      minimap.classList.remove('visible');
    }
  };

  const bindCanvasInteractions = () => {
    const zoomNumbers = [25, 50, 75, 100, 125, 150, 200, 300, 400];
    Object.keys(toolMeta).forEach(type => {
      const preview = byId(`${type}-preview`);
      const select = document.querySelector(`[data-preview-zoom="${type}"]`);
      const minimap = document.querySelector(`[data-minimap="${type}"]`);
      if (!preview || !select) return;

      preview.addEventListener('wheel', event => {
        if (!event.ctrlKey) return;
        event.preventDefault();
        const rect = preview.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        const oldWidth = Math.max(1, preview.scrollWidth);
        const oldHeight = Math.max(1, preview.scrollHeight);
        const anchorX = (preview.scrollLeft + offsetX) / oldWidth;
        const anchorY = (preview.scrollTop + offsetY) / oldHeight;
        const current = Number(select.value);
        let index = Number.isFinite(current) ? zoomNumbers.findIndex(value => value >= current) : 3;
        if (index < 0) index = 3;
        index = Math.max(0, Math.min(zoomNumbers.length - 1, index + (event.deltaY < 0 ? 1 : -1)));
        select.value = String(zoomNumbers[index]);
        select.dispatchEvent(new Event('change', { bubbles: true }));
        requestAnimationFrame(() => {
          preview.scrollLeft = anchorX * preview.scrollWidth - offsetX;
          preview.scrollTop = anchorY * preview.scrollHeight - offsetY;
          updateMinimap(type);
        });
      }, { passive: false });
      preview.addEventListener('scroll', () => updateMinimap(type), { passive: true });
      minimap?.addEventListener('pointerdown', event => {
        const rect = minimap.getBoundingClientRect();
        preview.scrollLeft = (event.clientX - rect.left) / rect.width * Math.max(0, preview.scrollWidth - preview.clientWidth);
        preview.scrollTop = (event.clientY - rect.top) / rect.height * Math.max(0, preview.scrollHeight - preview.clientHeight);
        updateMinimap(type);
      });

      const compareMode = document.querySelector(`[data-studio-compare-mode="${type}"]`);
      compareMode?.addEventListener('change', event => setComparisonMode(type, event.currentTarget.value));
      document.querySelector(`[data-studio-before-after="${type}"]`)?.addEventListener('pointerdown', () => {
        exitSideBySide(type);
        document.querySelector(`[data-preview-tool="${type}"][data-preview-view="original"]`)?.click();
      });
      const restoreResult = () => document.querySelector(`[data-preview-tool="${type}"][data-preview-view="result"]`)?.click();
      document.querySelector(`[data-studio-before-after="${type}"]`)?.addEventListener('pointerup', restoreResult);
      document.querySelector(`[data-studio-before-after="${type}"]`)?.addEventListener('pointercancel', restoreResult);
      document.querySelectorAll(`[data-preview-tool="${type}"]`).forEach(button => button.addEventListener('click', () => {
        const horizontal = preview.scrollWidth > preview.clientWidth ? preview.scrollLeft / Math.max(1, preview.scrollWidth - preview.clientWidth) : 0.5;
        const vertical = preview.scrollHeight > preview.clientHeight ? preview.scrollTop / Math.max(1, preview.scrollHeight - preview.clientHeight) : 0.5;
        preview.classList.remove('studio-side-by-side');
        requestAnimationFrame(() => requestAnimationFrame(() => {
          preview.scrollLeft = horizontal * Math.max(0, preview.scrollWidth - preview.clientWidth);
          preview.scrollTop = vertical * Math.max(0, preview.scrollHeight - preview.clientHeight);
          updateMinimap(type);
        }));
      }, true));

      const compareControl = document.querySelector(`[data-compare-control="${type}"]`);
      const moveHorizontalComparison = event => {
        if (preview.dataset.compareOrientation !== 'horizontal' || (event.type === 'pointermove' && !(event.buttons & 1))) return;
        const range = compareControl.querySelector('input');
        const rect = compareControl.getBoundingClientRect();
        range.value = String(Math.max(0, Math.min(100, (event.clientY - rect.top) / rect.height * 100)));
        range.dispatchEvent(new Event('input', { bubbles: true }));
      };
      compareControl?.addEventListener('pointerdown', moveHorizontalComparison, true);
      compareControl?.addEventListener('pointermove', moveHorizontalComparison, true);
    });
  };

  const renderHistory = type => {
    const history = histories[type];
    const panel = document.querySelector(`[data-history-type="${type}"]`);
    if (!panel) return;
    const list = panel.querySelector('.studio-history-list');
    const start = Math.max(0, history.entries.length - 8);
    list.replaceChildren(...history.entries.slice(start).map((label, offset) => {
      const index = start + offset;
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = index === history.index ? 'current' : '';
      button.disabled = index === history.index;
      button.innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><strong>${label}</strong>${index === history.index ? '<small>Actual</small>' : ''}`;
      button.addEventListener('click', () => moveVisualHistory(type, index));
      item.append(button);
      return item;
    }));
    panel.querySelector('[data-history-count]').textContent = `${history.entries.length} ${history.entries.length === 1 ? 'estado' : 'estados'}`;
  };

  const moveVisualHistory = (type, targetIndex) => {
    if (type !== getActiveType()) return;
    const history = histories[type];
    const buttonId = targetIndex < history.index ? 'tool-undo' : 'tool-redo';
    const steps = Math.abs(targetIndex - history.index);
    for (let step = 0; step < steps; step++) byId(buttonId)?.click();
    scheduleTechnicalUpdate();
  };

  const labelCurrentHistory = (type, label) => {
    const history = histories[type];
    const normalized = cleanLabel(label) || 'Ajuste actualizado';
    if (history.index < 0) return;
    history.entries[history.index] = normalized;
    renderHistory(type);
  };

  const formatHistoryChanges = changes => {
    if (!Array.isArray(changes) || !changes.length) return null;
    if (changes.length > 1) return `${changes.length} ajustes actualizados`;
    const change = changes[0];
    const control = byId(change.id);
    const label = cleanLabel(control?.closest('label')?.querySelector('span')?.textContent || change.id.replace(/^(halftone|background|quality)-/, '').replaceAll('-', ' '));
    const format = value => typeof value === 'boolean' ? (value ? 'Sí' : 'No') : String(value);
    return `${label}: ${format(change.from)} → ${format(change.to)}`;
  };

  const syncHistory = (type, index, length, changes = null) => {
    const history = histories[type];
    if (!history || !Number.isInteger(index) || !Number.isInteger(length) || length < 1) return;
    if (history.entries.length > length) history.entries.length = length;
    while (history.entries.length < length) history.entries.push('Ajuste actualizado');
    history.index = Math.max(0, Math.min(length - 1, index));
    const exactLabel = formatHistoryChanges(changes);
    if (exactLabel) history.entries[history.index] = exactLabel;
    renderHistory(type);
  };

  const labelForControl = element => {
    if (element.matches('[data-halftone-preset], [data-halftone-auto], [data-quality-preset], [data-quality-width]')) return element.textContent;
    const label = element.closest('label');
    if (label) return `Ajustar ${label.querySelector('span')?.textContent || label.childNodes[0]?.textContent || element.id}`;
    return element.title || element.textContent || 'Ajuste actualizado';
  };

  const bindHistory = () => {
    Object.keys(toolMeta).forEach(renderHistory);
    document.addEventListener('change', event => {
      const controls = event.target.closest('.tool-controls');
      if (!controls || event.target.type === 'file') return;
      window.clearTimeout(historyTimer);
      historyTimer = window.setTimeout(() => labelCurrentHistory(controls.dataset.toolType, labelForControl(event.target)), 20);
    });
    document.addEventListener('click', event => {
      const preset = event.target.closest('[data-halftone-preset], [data-halftone-auto], [data-quality-preset], [data-quality-width], [data-color-preset]');
      const controls = preset?.closest('.tool-controls');
      if (preset && controls) window.setTimeout(() => labelCurrentHistory(controls.dataset.toolType, labelForControl(preset)), 20);
    });
    window.addEventListener('momotus:history-update', event => {
      const { type, index, length, changes } = event.detail || {};
      syncHistory(type, index, length, changes);
    });
  };

  const sampleAlpha = canvas => {
    if (!canvas?.width || !canvas.height) return null;
    try {
      const sample = document.createElement('canvas');
      const scale = Math.min(1, 220 / Math.max(canvas.width, canvas.height));
      sample.width = Math.max(1, Math.round(canvas.width * scale));
      sample.height = Math.max(1, Math.round(canvas.height * scale));
      const context = sample.getContext('2d', { willReadFrequently: true });
      context.drawImage(canvas, 0, 0, sample.width, sample.height);
      const data = context.getImageData(0, 0, sample.width, sample.height).data;
      let transparent = 0;
      let partial = 0;
      let edge = 0;
      let lightFringe = 0;
      for (let y = 0; y < sample.height; y++) {
        for (let x = 0; x < sample.width; x++) {
          const index = (y * sample.width + x) * 4;
          const alpha = data[index + 3];
          if (alpha === 0) transparent++;
          else if (alpha < 255) partial++;
          if (alpha === 0) continue;
          const touchesTransparency = (x > 0 && data[index - 1] === 0)
            || (x + 1 < sample.width && data[index + 7] === 0)
            || (y > 0 && data[index - sample.width * 4 + 3] === 0)
            || (y + 1 < sample.height && data[index + sample.width * 4 + 3] === 0);
          if (!touchesTransparency) continue;
          edge++;
          const maximum = Math.max(data[index], data[index + 1], data[index + 2]);
          const minimum = Math.min(data[index], data[index + 1], data[index + 2]);
          const luminance = 0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2];
          if (maximum - minimum < 28 && luminance > 218) lightFringe++;
        }
      }
      const total = data.length / 4;
      return { transparent: transparent / total * 100, partial: partial / total * 100, fringe: edge ? lightFringe / edge * 100 : 0 };
    } catch (error) {
      return null;
    }
  };

  const updateTechnicalBar = () => {
    technicalFrame = 0;
    const extra=document.querySelector('.extra-tool-panel:not([hidden])');
    if(extra){
      let name='Cotización DTF',pixels='Esquema',size='—',dpi='No aplica',alpha='No aplica',zoom='Ajustar',ready=false;
      if(extra.id==='vectorizacion'){
        name='Vectorización SVG';const c=byId('vector-canvas');ready=!byId('vector-download').disabled;
        pixels=ready?`${c.width} × ${c.height} px de análisis`:'—';
        const cm=Number(byId('vector-width-cm').value);size=ready?`${cm.toFixed(1)} × ${(cm*c.height/c.width).toFixed(1)} cm`:'—';dpi='SVG escalable';alpha=ready?'Según paleta':'—';zoom=byId('vector-zoom').value==='fit'?'Ajustar':byId('vector-zoom').value+'%';
      }else if(extra.id==='efectos-dtf'){
        name='Efectos DTF';const info=window.MomotusEffectsAPI?.getDocumentInfo();ready=window.MomotusEffectsAPI?.hasDocument();
        pixels=info?`${info.naturalWidth} × ${info.naturalHeight} px`:'—';const cm=Number(byId('effects-width').value);size=info?`${cm.toFixed(1)} × ${(cm*info.naturalHeight/info.naturalWidth).toFixed(1)} cm`:'—';dpi='300 DPI';alpha='Según fondo y zonas';zoom=byId('effects-stage').classList.contains('is-zoom')?'100%':'Ajustar';
      }else{ready=byId('calc-sheet-mode').hidden?!byId('team-copy')?.disabled:Boolean(byId('calc-sheets').textContent!=='—');size=byId('calc-sheet-mode').hidden?byId('team-summary-length').textContent:byId('calc-layout-label').textContent;}
      for(const [id,value]of [['studio-tech-document',name],['studio-tech-pixels',pixels],['studio-tech-size',size],['studio-tech-dpi',dpi],['studio-tech-alpha',alpha],['studio-tech-zoom',zoom]])byId(id).textContent=value;
      byId('studio-tech-alpha').classList.remove('warning');byId('studio-tech-alpha').title='';byId('studio-inspect-output').disabled=true;
      byId('editor-image-info').textContent=name;byId('editor-workspace-state').querySelector('strong').textContent=ready?'Resultado listo':'Listo';
      return;
    }
    activeType = getActiveType();
    const meta = toolMeta[activeType];
    const canvas = byId(`${activeType}-canvas`);
    const image = byId(`${activeType}-original`);
    const info = byId('editor-image-info')?.textContent || 'Sin archivo';
    const hasDocument = info !== 'Sin documento abierto';
    const hasCanvas = Boolean(hasDocument && canvas?.width && canvas.height && !canvas.hidden);
    const width = hasDocument ? (hasCanvas ? canvas.width : (image?.naturalWidth || 0)) : 0;
    const height = hasDocument ? (hasCanvas ? canvas.height : (image?.naturalHeight || 0)) : 0;
    const zoom = document.querySelector(`[data-preview-zoom="${activeType}"]`)?.value || 'fit';
    const alpha = hasCanvas ? sampleAlpha(canvas) : null;
    const requestedWidth = activeType === 'halftone'
      ? Number(byId('halftone-width-cm')?.value)
      : activeType === 'quality' ? Number(byId('quality-width-cm')?.value) : 0;
    const widthCm = width ? (requestedWidth || width / 300 * 2.54) : 0;
    const heightCm = width ? widthCm * height / width : 0;
    const outputWidth = width ? Math.round(widthCm / 2.54 * 300) : 0;
    const outputHeight = width ? Math.round(heightCm / 2.54 * 300) : 0;

    byId('studio-tech-document').textContent = info === 'Sin documento abierto' ? 'Sin archivo' : meta.name;
    byId('studio-tech-document').title = info;
    byId('studio-tech-pixels').textContent = width ? `${outputWidth} × ${outputHeight} px` : '—';
    byId('studio-tech-size').textContent = width ? `${widthCm.toFixed(1)} × ${heightCm.toFixed(1)} cm` : '—';
    byId('studio-tech-dpi').textContent = activeType === 'halftone'
      ? `300 DPI · ${byId('halftone-frequency')?.value || 55} LPI`
      : '300 DPI';
    byId('studio-tech-alpha').textContent = alpha
      ? `${alpha.transparent.toFixed(1)}% libre${alpha.partial > 0.05 ? ` · ${alpha.partial.toFixed(1)}% parcial` : ''}`
      : '—';
    byId('studio-tech-alpha').classList.toggle('warning', Boolean(alpha && (alpha.partial > 0.3 || alpha.fringe > 18)));
    byId('studio-tech-alpha').title = alpha ? `Semitransparencia ${alpha.partial.toFixed(2)}% · posible borde claro ${alpha.fringe.toFixed(1)}%` : '';
    byId('studio-tech-zoom').textContent = zoom === 'fit' ? 'Diseño' : zoom === 'canvas' ? 'Lienzo' : zoom === 'detail' ? 'Detalle' : zoom === 'width' ? 'Ancho' : `${zoom}%`;
    const download = byId(meta.download);
    byId('studio-inspect-output').disabled = !download || download.disabled;
    const inspectorState = byId(meta.panel)?.querySelector('[data-inspector-state]');
    if (inspectorState) {
      const pending = byId(meta.panel).classList.contains('has-pending-changes');
      inspectorState.textContent = pending ? 'Sin aplicar' : download && !download.disabled ? 'Salida lista' : 'Sin archivo';
      inspectorState.className = pending ? 'warning' : download && !download.disabled ? 'ready' : '';
    }
    updateMinimap(activeType);
  };

  function scheduleTechnicalUpdate() {
    cancelAnimationFrame(technicalFrame);
    technicalFrame = requestAnimationFrame(updateTechnicalBar);
  }

  const bindExportPreview = () => {
    const stage = document.querySelector('.dtf-export-preview-stage');
    const remembered = readStorage('momotusExportPreviewBackground', 'checkerboard');
    const applyBackground = value => {
      if (!stage) return;
      stage.classList.toggle('checkerboard', value === 'checkerboard');
      stage.classList.toggle('preview-dark', value === 'dark');
      stage.classList.toggle('preview-light', value === 'light');
      document.querySelectorAll('[data-export-preview-bg]').forEach(button => button.classList.toggle('active', button.dataset.exportPreviewBg === value));
      writeStorage('momotusExportPreviewBackground', value);
    };
    document.querySelectorAll('[data-export-preview-bg]').forEach(button => button.addEventListener('click', () => applyBackground(button.dataset.exportPreviewBg)));
    applyBackground(remembered);
  };

  const bindInspectorScrolling = () => {
    document.querySelectorAll('.tool-control-content').forEach(content => {
      /* Conserva el desplazamiento nativo. Solo evita que la rueda llegue al lienzo. */
      content.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
      content.addEventListener('keydown', event => {
        if (event.target !== content) return;
        const steps = {
          ArrowUp: -48,
          ArrowDown: 48,
          PageUp: -content.clientHeight * 0.8,
          PageDown: content.clientHeight * 0.8,
          Home: -content.scrollHeight,
          End: content.scrollHeight
        };
        if (!(event.key in steps)) return;
        content.scrollBy({ top: steps[event.key], behavior: 'auto' });
        event.preventDefault();
      });
    });
  };

  const bindStudioControls = () => {
    document.querySelectorAll('[data-tool-target]').forEach(button => button.addEventListener('click', () => {
      window.setTimeout(() => {
        activeType = getActiveType();
        document.querySelectorAll('[data-studio-pipeline]').forEach(step => step.classList.toggle('active', step.dataset.studioPipeline === toolMeta[activeType].panel));
        const controls = byId(toolMeta[activeType].panel)?.querySelector('.tool-controls');
        controls?.querySelectorAll('.tool-control-group[open]').forEach(group => { group.open = false; });
        const menu = controls?.querySelector('.tool-options-menu');
        const trigger = controls?.querySelector('.tool-options-trigger');
        if (menu) menu.hidden = true;
        trigger?.classList.remove('active');
        trigger?.setAttribute('aria-expanded', 'false');
        scheduleTechnicalUpdate();
      }, 0);
    }));
    document.querySelectorAll('[data-preview-zoom], .tool-segmented button, input, select').forEach(control => {
      control.addEventListener('change', scheduleTechnicalUpdate);
    });
    byId('studio-inspect-output')?.addEventListener('click', () => byId(toolMeta[getActiveType()].download)?.click());
    window.addEventListener('momotus:workspace-update', scheduleTechnicalUpdate);
    window.addEventListener('momotus:result-ready', scheduleTechnicalUpdate);
    window.addEventListener('momotus:extra-tool',scheduleTechnicalUpdate);
    window.addEventListener('momotus:sheet-quote-ready',scheduleTechnicalUpdate);
    document.querySelectorAll('.extra-tool-panel').forEach(panel=>{panel.addEventListener('input',scheduleTechnicalUpdate);panel.addEventListener('click',()=>setTimeout(scheduleTechnicalUpdate,200));new MutationObserver(scheduleTechnicalUpdate).observe(panel,{attributes:true,attributeFilter:['hidden']});});
    const observer = new MutationObserver(scheduleTechnicalUpdate);
    document.querySelectorAll('.tool-preview canvas, #editor-image-info').forEach(element => observer.observe(element, { attributes: true, childList: true, characterData: true, subtree: true }));
  };

  const initializeStudio = () => {
    document.body.classList.add('momotus-studio');
    addWorkflowPipeline();
    addInspectorChrome();
    addPrecisionControls();
    addCanvasChrome();
    bindHistory();
    bindCanvasInteractions();
    bindExportPreview();
    bindInspectorScrolling();
    bindStudioControls();
    document.querySelector(`[data-studio-pipeline="${toolMeta[getActiveType()].panel}"]`)?.classList.add('active');
    scheduleTechnicalUpdate();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializeStudio, { once: true });
  else initializeStudio();
})();
