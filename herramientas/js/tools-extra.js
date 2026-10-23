(() => {
  'use strict';

  if (!window.MOMOTUS_TOOLS_DESKTOP) return;

  const byId = id => document.getElementById(id);
  const CORE_PANELS = new Set(['semitonos', 'eliminar-fondo', 'mejorar-calidad']);
  const EXTRA_PANELS = new Set(['vectorizacion', 'calculadora-dtf', 'efectos-dtf', 'tipografias']);
  const MAX_FILE_SIZE = 24 * 1024 * 1024;
  const SUPPORTED_EXTENSION = /\.(?:png|jpe?g|webp)$/i;
  const currency = new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', minimumFractionDigits: 2 });

  const closeExtraOptions = dialog => {
    if (!dialog) return;
    dialog.hidden = true;
    const controls = dialog.closest('.extra-controls');
    const trigger = controls?.querySelector('.extra-options-trigger');
    const backdrop = controls?.querySelector('.extra-options-backdrop');
    if (backdrop) backdrop.hidden = true;
    trigger?.classList.remove('active');
    trigger?.setAttribute('aria-expanded', 'false');
  };

  const closeAllExtraOptions = () => {
    document.querySelectorAll('.extra-options-dialog').forEach(closeExtraOptions);
  };

  const enableReliableWheelScroll = element => {
    if (!element || element.dataset.wheelScrollReady) return;
    element.dataset.wheelScrollReady = 'true';
    element.addEventListener('wheel', event => {
      if (event.ctrlKey || event.metaKey || Math.abs(event.deltaY) < Math.abs(event.deltaX)) return;
      const maximum = element.scrollHeight - element.clientHeight;
      const numberInput = event.target instanceof Element && event.target.closest('input[type="number"]');
      if (maximum <= 1) {
        if (numberInput) event.preventDefault();
        return;
      }
      const previous = element.scrollTop;
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 18 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? element.clientHeight : 1;
      element.scrollTop = Math.max(0, Math.min(maximum, previous + event.deltaY * unit));
      if (element.scrollTop !== previous || numberInput) event.preventDefault();
    }, { passive: false });
  };

  document.querySelectorAll('.extra-controls').forEach(controls => {
    controls.classList.add('pro-inspector');
    enableReliableWheelScroll(controls.querySelector('.extra-control-scroll'));
  });
  enableReliableWheelScroll(document.querySelector('.calculator-sheet-wrap'));
  document.querySelectorAll('.calculator-results, .extra-control-scroll').forEach(enableReliableWheelScroll);

  const setStudioState = (name, status = 'Listo') => {
    const info = byId('editor-image-info');
    const state = byId('editor-workspace-state');
    if (info) info.textContent = name;
    if (state) {
      state.className = 'tool-workspace-state ready';
      const label = state.querySelector('strong');
      if (label) label.textContent = status;
    }
  };

  const openExtraTool = target => {
    if (!EXTRA_PANELS.has(target)) return;
    closeAllExtraOptions();
    document.querySelectorAll('.tool-panel').forEach(panel => { panel.hidden = panel.id !== target; });
    document.querySelectorAll('.tool-shortcut').forEach(button => {
      const selected = button.dataset.extraTool === target;
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
    });
    document.body.classList.add('extra-tool-active');
    document.body.classList.toggle('typography-tool-active',target==='tipografias');
    const workspaceNames = {
      vectorizacion: 'Vectorización SVG',
      'calculadora-dtf': 'Calculadora de cotizaciones',
      'efectos-dtf': 'Efectos de estampado',
      'tipografias': 'Estudio de tipografías'
    };
    setStudioState(workspaceNames[target] || 'Herramientas DTF');
    if (history.replaceState) history.replaceState(null, '', `${location.pathname}${location.search}#${target}`);
    window.dispatchEvent(new CustomEvent('momotus:extra-tool', { detail: { target } }));
  };

  document.querySelectorAll('[data-extra-tool]').forEach(button => {
    button.setAttribute('aria-controls', button.dataset.extraTool);
    button.addEventListener('click', () => openExtraTool(button.dataset.extraTool));
  });
  document.querySelectorAll('[data-tool-target]').forEach(button => button.addEventListener('click', () => {
    closeAllExtraOptions();
    document.body.classList.remove('extra-tool-active','typography-tool-active');
    document.querySelectorAll('.extra-tool-panel').forEach(panel => { panel.hidden = true; });
    document.querySelectorAll('[data-extra-tool]').forEach(item => {
      item.classList.remove('active');
      item.setAttribute('aria-selected', 'false');
    });
  }));

  // ==================== CALCULADORA DE PLIEGOS ====================
  const calcIds = ['calc-sheet-width', 'calc-sheet-height', 'calc-margin', 'calc-gap', 'calc-design-width', 'calc-design-height', 'calc-quantity', 'calc-rotate', 'calc-sheet-cost', 'calc-consumables-cost', 'calc-setup-cost', 'calc-unit-cost', 'calc-waste', 'calc-profit'];
  const costProfileIds = ['calc-sheet-cost', 'calc-consumables-cost', 'calc-setup-cost', 'calc-unit-cost', 'calc-waste', 'calc-profit'];
  const COST_PROFILE_KEY = 'momotusDtfCostProfileV1';
  let latestQuote = null;
  let sheetQuoteOverride = null;

  const numberValue = (id, fallback = 0) => {
    const value = Number(byId(id).value);
    return Number.isFinite(value) ? value : fallback;
  };

  const calculateQuoteCosts = (quantity, sheets) => {
    const sheetCost = Math.max(0, numberValue('calc-sheet-cost'));
    const consumablesCost = Math.max(0, numberValue('calc-consumables-cost'));
    const setupCost = Math.max(0, numberValue('calc-setup-cost'));
    const unitCost = Math.max(0, numberValue('calc-unit-cost'));
    const waste = Math.max(0, numberValue('calc-waste')) / 100;
    const marginRate = Math.min(0.9, Math.max(0, numberValue('calc-profit')) / 100);
    const productionCost = (sheets * (sheetCost + consumablesCost)) * (1 + waste) + setupCost + quantity * unitCost;
    const quoteTotal = marginRate < 1 ? productionCost / (1 - marginRate) : productionCost;
    return { productionCost, quoteTotal, unitQuote: quoteTotal / Math.max(1, quantity) };
  };

  const cleanText = value => String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim();
  const escapeHtml = value => cleanText(value).replace(/[&"']/g, character => ({ '&': '&amp;', '"': '&quot;', "'": '&#39;' }[character]));
  const quoteMetadata = () => {
    const validDays = Math.max(1, Math.min(90, Math.round(numberValue('calc-valid-days', 7))));
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);
    return {
      customer: cleanText(byId('calc-customer').value) || 'Cliente',
      reference: cleanText(byId('calc-reference').value) || `MC-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`,
      validDays,
      validUntil: validUntil.toLocaleDateString('es-NI')
    };
  };

  const optimizeLayout = ({ sheetWidth, sheetHeight, margin, gap, designWidth, designHeight, rotate }) => {
    const usableWidth = sheetWidth - margin * 2;
    const usableHeight = sheetHeight - margin * 2;
    if (usableWidth <= 0 || usableHeight <= 0 || designWidth <= 0 || designHeight <= 0) return null;
    const orientations = [{ width: designWidth, height: designHeight, rotated: false }];
    if (rotate && Math.abs(designWidth - designHeight) > 0.001) orientations.push({ width: designHeight, height: designWidth, rotated: true });
    let best = null;
    const first = orientations[0];
    const second = orientations[1];
    const maxFirstRows = Math.floor((usableHeight + gap) / (first.height + gap));
    const maxSecondRows = second ? Math.floor((usableHeight + gap) / (second.height + gap)) : 0;
    for (let firstRows = 0; firstRows <= maxFirstRows; firstRows++) {
      for (let secondRows = 0; secondRows <= maxSecondRows; secondRows++) {
        const totalRows = firstRows + secondRows;
        if (!totalRows) continue;
        const usedHeight = firstRows * first.height + secondRows * (second?.height || 0) + Math.max(0, totalRows - 1) * gap;
        if (usedHeight > usableHeight + 0.0001) continue;
        const firstColumns = Math.floor((usableWidth + gap) / (first.width + gap));
        const secondColumns = second ? Math.floor((usableWidth + gap) / (second.width + gap)) : 0;
        const capacity = firstRows * firstColumns + secondRows * secondColumns;
        if (!capacity) continue;
        const score = capacity * 100000 - usedHeight;
        if (!best || score > best.score) best = { capacity, score, firstRows, secondRows, firstColumns, secondColumns, usedHeight, usableWidth, usableHeight, orientations };
      }
    }
    if (!best) return null;
    const placements = [];
    let y = margin;
    const addRows = (orientation, rows, columns) => {
      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) placements.push({ x: margin + column * (orientation.width + gap), y, width: orientation.width, height: orientation.height, rotated: orientation.rotated });
        y += orientation.height + gap;
      }
    };
    addRows(first, best.firstRows, best.firstColumns);
    if (second) addRows(second, best.secondRows, best.secondColumns);
    best.placements = placements;
    return best;
  };

  const drawSheet = (settings, layout) => {
    const canvas = byId('calc-canvas');
    const maximum = 900;
    const scale = maximum / Math.max(settings.sheetWidth, settings.sheetHeight);
    canvas.width = Math.max(260, Math.round(settings.sheetWidth * scale));
    canvas.height = Math.max(260, Math.round(settings.sheetHeight * scale));
    const context = canvas.getContext('2d');
    context.fillStyle = '#f4f4f5';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const drawScale = Math.min(canvas.width / settings.sheetWidth, canvas.height / settings.sheetHeight);
    delete canvas.dataset.precisionScaleX;delete canvas.dataset.precisionScaleY;canvas.dataset.precisionScale=drawScale;canvas.dataset.precisionX=0;canvas.dataset.precisionY=0;
    context.save();
    context.scale(drawScale, drawScale);
    context.strokeStyle = '#a1a1aa';
    context.lineWidth = 1 / drawScale;
    context.strokeRect(settings.margin, settings.margin, settings.sheetWidth - settings.margin * 2, settings.sheetHeight - settings.margin * 2);
    if (layout) layout.placements.forEach((placement, index) => {
      context.fillStyle = index % 2 ? '#f59e0b' : '#facc15';
      context.strokeStyle = '#18181b';
      context.lineWidth = 1.2 / drawScale;
      context.fillRect(placement.x, placement.y, placement.width, placement.height);
      context.strokeRect(placement.x, placement.y, placement.width, placement.height);
      context.fillStyle = '#18181b';
      context.font = `900 ${Math.max(2.2, Math.min(5, placement.width / 5))}px sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(String(index + 1), placement.x + placement.width / 2, placement.y + placement.height / 2);
      if (placement.rotated) {
        context.font = `700 ${Math.max(1.5, Math.min(3, placement.width / 8))}px sans-serif`;
        context.fillText('ROTADO', placement.x + placement.width / 2, placement.y + placement.height / 2 + 4);
      }
    });
    context.restore();
  };

  const calculate = () => {
    for(const id of calcIds){const el=byId(id);if(el.type==='checkbox')continue;const n=Number(el.value);if(el.value.trim()===''||!Number.isFinite(n)||(el.min&&n<Number(el.min))||(el.max&&n>Number(el.max))||(el.step==='1'&&!Number.isInteger(n))){latestQuote=null;byId('calc-status').textContent='Revisá las medidas y los costos. La cantidad debe ser un número entero y todos los valores deben estar dentro del rango indicado.';byId('calc-capacity').textContent='0';byId('calc-sheets').textContent='—';for(const key of ['calc-base-cost','calc-quote-total','calc-quote-unit'])byId(key).textContent='—';byId('calc-print').disabled=true;byId('calc-whatsapp').disabled=true;return;}}
    byId('calc-print').disabled=false;byId('calc-whatsapp').disabled=false;
    const settings = {
      sheetWidth: Math.max(1, numberValue('calc-sheet-width', 57)),
      sheetHeight: Math.max(1, numberValue('calc-sheet-height', 100)),
      margin: Math.max(0, numberValue('calc-margin', 0.5)),
      gap: Math.max(0, numberValue('calc-gap', 1)),
      designWidth: Math.max(0.1, numberValue('calc-design-width', 32)),
      designHeight: Math.max(0.1, numberValue('calc-design-height', 32)),
      quantity: Math.max(1, Math.round(numberValue('calc-quantity', 1))),
      rotate: byId('calc-rotate').checked
    };
    if (sheetQuoteOverride) {
      const quantity = sheetQuoteOverride.pieces;
      const sheets = 1;
      const costs = calculateQuoteCosts(quantity, sheets);
      byId('calc-layout-label').textContent = `${sheetQuoteOverride.sheetWidth} × ${sheetQuoteOverride.sheetHeight} cm · multidiseño`;
      byId('calc-capacity').textContent = quantity;
      byId('calc-sheets').textContent = sheets;
      byId('calc-efficiency').textContent = `${sheetQuoteOverride.efficiency.toFixed(1)}%`;
      byId('calc-base-cost').textContent = currency.format(costs.productionCost);
      byId('calc-quote-total').textContent = currency.format(costs.quoteTotal);
      byId('calc-quote-unit').textContent = `${currency.format(costs.unitQuote)} promedio por pieza`;
      byId('calc-arrangement').textContent = `${quantity} piezas distintas en una plancha`;
      byId('calc-status').textContent = 'Cotización vinculada a la plancha multidiseño preparada en Producción DTF.';
      latestQuote = {
        sheetWidth: sheetQuoteOverride.sheetWidth, sheetHeight: sheetQuoteOverride.sheetHeight,
        designWidth: null, designHeight: null, designLabel: 'Plancha multidiseño', quantity,
        capacity: quantity, sheets, efficiency: sheetQuoteOverride.efficiency,
        productionCost: costs.productionCost, quoteTotal: costs.quoteTotal, unitQuote: costs.unitQuote,
        arrangement: `${quantity} piezas distintas`
      };
      return;
    }
    const layout = optimizeLayout(settings);
    const fixed=optimizeLayout({...settings,rotate:false});
    const baselineSheets=fixed?Math.ceil(settings.quantity/fixed.capacity):null;
    byId('calc-layout-comparison').textContent=layout?`Sin giro: ${fixed?.capacity||0} por pliego · Con giro permitido: ${layout.capacity} · ${baselineSheets?Math.max(0,baselineSheets-Math.ceil(settings.quantity/layout.capacity)):0} pliegos ahorrados.`:'No hay distribución válida.';
    drawSheet(settings, layout);
    byId('calc-layout-label').textContent = `${settings.sheetWidth} × ${settings.sheetHeight} cm`;
    if (!layout) {
      byId('calc-capacity').textContent = '0';
      byId('calc-sheets').textContent = '—';
      byId('calc-efficiency').textContent = '0%';
      byId('calc-status').textContent = 'El diseño no cabe dentro del área imprimible con esos márgenes.';
      byId('calc-arrangement').textContent = 'Sin distribución válida';
      for(const id of ['calc-base-cost','calc-quote-total','calc-quote-unit'])byId(id).textContent='—';
      latestQuote = null;byId('calc-print').disabled=true;byId('calc-whatsapp').disabled=true;
      return;
    }
    const sheets = Math.ceil(settings.quantity / layout.capacity);
    const usedArea = layout.capacity * settings.designWidth * settings.designHeight;
    const printableArea = layout.usableWidth * layout.usableHeight;
    const efficiency = printableArea > 0 ? usedArea / printableArea * 100 : 0;
    const { productionCost, quoteTotal, unitQuote } = calculateQuoteCosts(settings.quantity, sheets);
    byId('calc-capacity').textContent = layout.capacity;
    byId('calc-sheets').textContent = sheets;
    byId('calc-efficiency').textContent = `${efficiency.toFixed(1)}%`;
    byId('calc-base-cost').textContent = currency.format(productionCost);
    byId('calc-quote-total').textContent = currency.format(quoteTotal);
    byId('calc-quote-unit').textContent = `${currency.format(unitQuote)} por diseño`;
    const rowParts = [];
    if (layout.firstRows) rowParts.push(`${layout.firstRows} fila${layout.firstRows === 1 ? '' : 's'} normal${layout.firstRows === 1 ? '' : 'es'}`);
    if (layout.secondRows) rowParts.push(`${layout.secondRows} fila${layout.secondRows === 1 ? '' : 's'} rotada${layout.secondRows === 1 ? '' : 's'}`);
    byId('calc-arrangement').textContent = `${layout.capacity} por pliego · ${rowParts.join(' + ')}`;
    byId('calc-status').textContent = `${settings.quantity} diseños requieren ${sheets} pliego${sheets === 1 ? '' : 's'}; el último lleva ${settings.quantity - (sheets - 1) * layout.capacity}.`;
    latestQuote = { ...settings, capacity: layout.capacity, sheets, efficiency, productionCost, quoteTotal, unitQuote, arrangement: rowParts.join(' + ') };
    window.dispatchEvent(new CustomEvent('momotus:sheet-quote-ready',{detail:latestQuote}));
    setStudioState('Calculadora de cotizaciones', 'Cálculo listo');
  };

  const drawSheetQuotePreview = dataUrl => {
    if (!dataUrl) return;
    const image = new Image();
    image.onload = () => {
      const canvas = byId('calc-canvas');
      const scale = Math.min(900 / image.naturalWidth, 600 / image.naturalHeight, 1);
      canvas.width = Math.max(260, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(260, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.dataset.precisionScaleX=canvas.width/Number(byId('calc-sheet-width').value);canvas.dataset.precisionScaleY=canvas.height/Number(byId('calc-sheet-height').value);canvas.dataset.precisionX=0;canvas.dataset.precisionY=0;
    };
    image.src = dataUrl;
  };

  window.addEventListener('momotus:quote-measurements',event=>{
    if(event.detail?.mode!=='sheet')return;
    try{const d=window.MomotusPrecisionCore.validateMeasure(event.detail);if(d.widthCm<1||d.widthCm>150||d.heightCm<1||d.heightCm>300)throw Error('La calculadora admite ancho de 1 a 150 cm y alto de 1 a 300 cm.');
      sheetQuoteOverride=null;byId('calc-design-width').value=d.widthCm;byId('calc-design-height').value=d.heightCm;byId('calc-quantity').value=d.quantity;calculate();
      window.dispatchEvent(new CustomEvent('momotus:quote-sheet'));byId('calc-status').textContent=`Medidas recibidas: ${d.widthCm.toFixed(3)} × ${d.heightCm.toFixed(3)} cm. Solo medidas y cantidad; sin imágenes.`;
    }catch(e){byId('calc-status').textContent=e.message;}
  });
  window.addEventListener('momotus:quote-sheet', event => {
    const detail = event.detail;
    if (!detail || !Number.isFinite(detail.pieces) || detail.pieces < 1) return;
    sheetQuoteOverride = {
      sheetWidth: Math.max(1, Number(detail.sheetWidth) || 57),
      sheetHeight: Math.max(1, Number(detail.sheetHeight) || 100),
      pieces: Math.max(1, Math.round(detail.pieces)),
      efficiency: Math.max(0, Math.min(100, Number(detail.efficiency) || 0)),
      preview: detail.preview || ''
    };
    byId('calc-sheet-width').value = sheetQuoteOverride.sheetWidth;
    byId('calc-sheet-height').value = sheetQuoteOverride.sheetHeight;
    byId('calc-quantity').value = sheetQuoteOverride.pieces;
    openExtraTool('calculadora-dtf');
    calculate();
    drawSheetQuotePreview(sheetQuoteOverride.preview);
  });

  calcIds.forEach(id => byId(id).addEventListener(id === 'calc-rotate' ? 'change' : 'input', () => {
    if (!costProfileIds.includes(id)) sheetQuoteOverride = null;
    calculate();
  }));
  byId('calc-example').addEventListener('click', () => {
    sheetQuoteOverride = null;
    byId('calc-sheet-width').value = 57;
    byId('calc-sheet-height').value = 100;
    byId('calc-margin').value = 0.5;
    byId('calc-gap').value = 1;
    byId('calc-design-width').value = 32;
    byId('calc-design-height').value = 32;
    byId('calc-rotate').checked = true;
    calculate();
  });
  byId('calc-reset').addEventListener('click', () => {
    sheetQuoteOverride = null;
    const defaults = { 'calc-sheet-width': 57, 'calc-sheet-height': 100, 'calc-margin': 0.5, 'calc-gap': 1, 'calc-design-width': 32, 'calc-design-height': 32, 'calc-quantity': 10, 'calc-sheet-cost': 0, 'calc-consumables-cost': 0, 'calc-setup-cost': 0, 'calc-unit-cost': 0, 'calc-waste': 5, 'calc-profit': 30 };
    Object.entries(defaults).forEach(([id, value]) => { byId(id).value = value; });
    byId('calc-rotate').checked = true;
    calculate();
  });
  let costProfiles={};try{const data=JSON.parse(localStorage.getItem('momotus-cost-profiles-v2')||'{}');if(data&&typeof data==='object'&&!Array.isArray(data))costProfiles=data;}catch{}
  function costProfileList(){byId('calc-profile-list').replaceChildren(new Option('Elegí un perfil',''),...Object.keys(costProfiles).map(name=>new Option(name,name)));}
  byId('calc-save-profile').addEventListener('click',()=>{
    try{const name=byId('calc-profile-name').value.trim()||'Predeterminado',profile=Object.fromEntries(costProfileIds.map(id=>[id,byId(id).value]));if(Object.keys(costProfiles).length>=30&&!Object.hasOwn(costProfiles,name))throw Error('Máximo 30 perfiles.');const next={...costProfiles,[name]:profile};localStorage.setItem('momotus-cost-profiles-v2',JSON.stringify(next));localStorage.setItem(COST_PROFILE_KEY,JSON.stringify(profile));costProfiles=next;costProfileList();byId('calc-profile-list').value=name;byId('calc-status').textContent=`Perfil «${name}» guardado.`;}catch(e){byId('calc-status').textContent=e.message||'No se pudo guardar el perfil.';}
  });
  byId('calc-load-profile').addEventListener('click',()=>{
    try{const name=byId('calc-profile-list').value,profile=name?costProfiles[name]:JSON.parse(localStorage.getItem(COST_PROFILE_KEY)||'null');if(!profile||typeof profile!=='object')throw Error('Elegí un perfil guardado.');for(const id of costProfileIds){const n=Number(profile[id]),el=byId(id);if(!Number.isFinite(n)||n<0||(el.max&&n>Number(el.max)))throw Error('El perfil tiene costos no válidos.');}costProfileIds.forEach(id=>byId(id).value=profile[id]);byId('calc-profile-name').value=name;calculate();byId('calc-status').textContent='Costos recuperados y cotización actualizada.';}catch(e){byId('calc-status').textContent=e.message;}
  });costProfileList();
  const quoteArchive=document.createElement('details');quoteArchive.className='pro-detail';quoteArchive.innerHTML='<summary>Historial de cotizaciones</summary><div class="pro-actions"><button id="calc-save-quote" type="button">Guardar cotización</button><select id="calc-quote-history" aria-label="Cotizaciones guardadas"><option value="">Elegí una cotización</option></select><button id="calc-load-quote" type="button">Recuperar</button></div>';
  byId('calc-save-profile').closest('.extra-control-scroll').append(quoteArchive);
  let sheetHistory=[];try{const saved=JSON.parse(localStorage.getItem('momotus-sheet-quotes-v1')||'[]');if(Array.isArray(saved))sheetHistory=saved.slice(0,30);}catch{}
  function sheetHistoryList(){byId('calc-quote-history').replaceChildren(new Option('Elegí una cotización',''),...sheetHistory.map((q,i)=>new Option(`${q.customer||'Cliente'} · ${q.reference||'DTF'} · ${new Date(q.time).toLocaleDateString('es-NI')}`,String(i))));}
  byId('calc-save-quote').addEventListener('click',()=>{calculate();if(!latestQuote)return;if(sheetQuoteOverride){byId('calc-status').textContent='Guardá la plancha vinculada desde Producción DTF.';return;}try{const ids=[...calcIds,'calc-customer','calc-reference','calc-valid-days'];const next=[{time:Date.now(),customer:byId('calc-customer').value,reference:byId('calc-reference').value,settings:Object.fromEntries(ids.map(id=>[id,byId(id).type==='checkbox'?byId(id).checked:byId(id).value]))},...sheetHistory].slice(0,30);localStorage.setItem('momotus-sheet-quotes-v1',JSON.stringify(next));sheetHistory=next;sheetHistoryList();byId('calc-status').textContent='Cotización guardada en este navegador.';}catch{byId('calc-status').textContent='No se pudo guardar la cotización.';}});
  byId('calc-load-quote').addEventListener('click',()=>{const value=byId('calc-quote-history').value;if(value==='')return;try{const q=sheetHistory[Number(value)];if(!q?.settings)throw Error('Cotización no válida.');for(const id of calcIds){const el=byId(id),v=q.settings[id];if(el.type==='checkbox'){if(typeof v!=='boolean')throw Error('Rotación no válida.');}else{const n=Number(v);if(!Number.isFinite(n)||(el.min&&n<Number(el.min))||(el.max&&n>Number(el.max))||(el.step==='1'&&!Number.isInteger(n)))throw Error('Medidas o costos no válidos.');}}sheetQuoteOverride=null;for(const [id,v]of Object.entries(q.settings)){const el=byId(id);if(!el||!el.closest('#calc-sheet-mode'))continue;if(el.type==='checkbox')el.checked=v;else el.value=v;}calculate();byId('calc-status').textContent='Cotización recuperada. Revisá los costos vigentes.';}catch(e){byId('calc-status').textContent=e.message;}});sheetHistoryList();
  byId('calc-whatsapp').addEventListener('click', () => {
    if (!latestQuote) return;
    const metadata = quoteMetadata();
    const message = [
      `*Cotización DTF ${metadata.reference}*`,
      `Cliente: ${metadata.customer}`,
      `Diseño: ${latestQuote.designLabel || `${latestQuote.designWidth} × ${latestQuote.designHeight} cm`}`,
      `Cantidad: ${latestQuote.quantity}`,
      `Pliegos: ${latestQuote.sheets} de ${latestQuote.sheetWidth} × ${latestQuote.sheetHeight} cm`,
      `Precio unitario: ${currency.format(latestQuote.unitQuote)}`,
      `*Total: ${currency.format(latestQuote.quoteTotal)}*`,
      `Válida hasta: ${metadata.validUntil}`,
      'Momotus Core · momotuscore@gmail.com'
    ].join('\n');
    window.open(`https://wa.me/50555010044?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  });
  byId('calc-print').addEventListener('click', () => {
    if (!latestQuote) return;
    const metadata = quoteMetadata();
    const report = window.open('', '_blank', 'width=820,height=900');
    if (!report) return;
    report.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cotización DTF</title><style>body{font-family:Arial,sans-serif;margin:36px;color:#18181b}h1{margin:0 0 4px}small{color:#71717a}.brand{border-bottom:4px solid #facc15;padding-bottom:16px;margin-bottom:24px}.meta{display:flex;justify-content:space-between;gap:16px;margin-bottom:18px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{border:1px solid #d4d4d8;border-radius:10px;padding:14px}.card b{display:block;font-size:22px;margin-top:6px}.total{background:#facc15;border:0}table{width:100%;border-collapse:collapse;margin:22px 0}td{padding:9px;border-bottom:1px solid #e4e4e7}td:last-child{text-align:right;font-weight:bold}@media print{button{display:none}}</style></head><body><div class="brand"><h1>Momotus Core</h1><small>Cotización de producción DTF · momotuscore@gmail.com · 5501-0044</small></div><div class="meta"><div><b>${escapeHtml(metadata.customer)}</b><br><small>Cliente</small></div><div><b>${escapeHtml(metadata.reference)}</b><br><small>Válida hasta ${escapeHtml(metadata.validUntil)}</small></div></div><div class="grid"><div class="card">Pliego<b>${latestQuote.sheetWidth} × ${latestQuote.sheetHeight} cm</b></div><div class="card">Diseño<b>${escapeHtml(latestQuote.designLabel || `${latestQuote.designWidth} × ${latestQuote.designHeight} cm`)}</b></div><div class="card">Capacidad<b>${latestQuote.capacity} por pliego</b></div><div class="card">Pedido<b>${latestQuote.quantity} diseños · ${latestQuote.sheets} pliegos</b></div></div><table><tr><td>Distribución</td><td>${latestQuote.arrangement}</td></tr><tr><td>Aprovechamiento</td><td>${latestQuote.efficiency.toFixed(1)}%</td></tr>${byId('calc-report-scope').value==='internal'?`<tr><td>Costo calculado</td><td>${currency.format(latestQuote.productionCost)}</td></tr>`:''}<tr><td>Precio por diseño</td><td>${currency.format(latestQuote.unitQuote)}</td></tr></table><div class="card total">Cotización sugerida<b>${currency.format(latestQuote.quoteTotal)}</b></div><p><small>Estimación basada en las medidas, separación, costos, merma y margen ingresados. Confirmar consumos reales antes de producir.</small></p><button onclick="print()">Imprimir</button></body></html>`);
    report.document.close();
  });
  calculate();

  document.addEventListener('paste', event => {
    if (document.querySelector('.tool-panel:not([hidden])')?.id !== 'vectorizacion') return;
    const file = [...(event.clipboardData?.items || [])].find(item => item.type.startsWith('image/'))?.getAsFile();
    if (file) acceptVectorFile(file);
  });

  const initialExtra = document.querySelector('.extra-tool-panel:not([hidden])')?.id;
  if (initialExtra) openExtraTool(initialExtra);
})();
