(() => {
  'use strict';

  const MAX_REFERENCES = 100;
  const MAX_PIECES = 5000;
  const EPSILON = 1e-8;
  const currency = new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', minimumFractionDigits: 2 });
  const types = Object.freeze({ logo: 'Logo', texto: 'Texto', foto: 'Foto', diseno: 'Diseño' });
  const garments = Object.freeze({ '': 'Sin especificar', camiseta: 'Camiseta', hoodie: 'Hoodie', sudadera: 'Sudadera', 'crop-top': 'Crop-top' });
  const presets = Object.freeze({ logo: { width: 10, height: 10 }, texto: { width: 24, height: 5 }, foto: { width: 20, height: 25 }, diseno: { width: 25, height: 30 } });
  const normalize = value => String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const number = value => {
    if (value === null || value === undefined || String(value).trim() === '') return NaN;
    return Number(String(value).trim().replace(',', '.'));
  };
  const typeOf = value => ({ logo: 'logo', texto: 'texto', text: 'texto', tipografia: 'texto', typography: 'texto', foto: 'foto', fotografia: 'foto', photo: 'foto', diseno: 'diseno', design: 'diseno' })[normalize(value)];
  const sizeOf = value => {
    const key = normalize(value);
    if (!key) return '';
    if (['inf', 'infantil', 'kids', 'nino', 'nina'].includes(key)) return 'infantil';
    const upper = key.toUpperCase();
    return ['XS', 'S', 'M', 'L', 'XL', 'XXL'].includes(upper) ? upper : null;
  };
  const garmentOf = value => {
    const key = normalize(value).replace(/\s+/g, '-');
    if (!key || key === 'sin-especificar') return '';
    if (['regular', 'unisex'].includes(key)) return 'camiseta';
    return Object.hasOwn(garments, key) ? key : null;
  };

  const validateReferences = references => {
    const errors = [];
    if (!Array.isArray(references) || references.length > MAX_REFERENCES) return ['El pedido admite hasta 100 referencias.'];
    references.forEach((item, index) => {
      const label = `Referencia ${index + 1}`;
      if (!String(item.detail || '').trim() || String(item.detail).length > 100) errors.push(`${label}: escribí un detalle de entre 1 y 100 caracteres.`);
      if (!Object.hasOwn(types, item.type)) errors.push(`${label}: escogé un tipo de diseño válido.`);
      if (!Number.isFinite(item.width) || item.width <= 0 || item.width > 300 || !Number.isFinite(item.height) || item.height <= 0 || item.height > 300) errors.push(`${label}: ancho y alto deben ser mayores que 0 y no superar 300 cm.`);
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 1000) errors.push(`${label}: la cantidad debe ser un entero entre 1 y 1000.`);
      if (item.garment !== undefined && !Object.hasOwn(garments, item.garment)) errors.push(`${label}: la prenda no es válida.`);
      if(item.location!==undefined&&!['','frente','espalda','manga','otro'].includes(item.location))errors.push(`${label}: ubicación no válida.`);
      if (item.size && sizeOf(item.size) === null) errors.push(`${label}: la talla no es válida.`);
    });
    if (references.reduce((sum, item) => sum + (Number.isInteger(item.quantity) ? item.quantity : 0), 0) > MAX_PIECES) errors.push('El pedido admite hasta 5000 estampados. Dividí los pedidos más grandes.');
    return errors;
  };

  // Distribución por franjas. Estimación: no promete el mínimo global de material.
  const packPieces = (pieces, rollWidth, gap, margin, rotate, strategy='longest') => {
    const usableWidth = rollWidth - margin * 2;
    const shelves = [];
    const unplaced = [];
    const sorted = [...pieces].sort((a,b)=>strategy==='area'?b.width*b.height-a.width*a.height:strategy==='height'?b.height-a.height:Math.max(b.width,b.height)-Math.max(a.width,a.height));
    sorted.forEach(piece => {
      const orientations = [{ width: piece.width, height: piece.height, rotated: false }];
      if (rotate && Math.abs(piece.width - piece.height) > EPSILON) orientations.push({ width: piece.height, height: piece.width, rotated: true });
      let best = null;
      shelves.forEach(shelf => orientations.forEach(orientation => {
        const end = shelf.used + (shelf.items.length ? gap : 0) + orientation.width;
        if (orientation.height <= shelf.height + EPSILON && end <= usableWidth + EPSILON) {
          const remaining = usableWidth - end;
          if (!best || remaining < best.remaining) best = { shelf, orientation, remaining };
        }
      }));
      if (!best) {
        const orientation = orientations.filter(item => item.width <= usableWidth + EPSILON).sort((a, b) => a.height - b.height)[0];
        if (!orientation) { unplaced.push(piece); return; }
        const shelf = { height: orientation.height, used: 0, items: [] };
        shelves.push(shelf);
        best = { shelf, orientation };
      }
      const x = margin + best.shelf.used + (best.shelf.items.length ? gap : 0);
      best.shelf.items.push({ ...piece, ...best.orientation, x });
      best.shelf.used = x - margin + best.orientation.width;
    });
    let y = margin;
    const placements = [];
    shelves.forEach((shelf, index) => {
      shelf.items.forEach(item => placements.push({ ...item, y }));
      y += shelf.height + (index < shelves.length - 1 ? gap : 0);
    });
    return { placements, unplaced, rawLength: placements.length ? y + margin : 0, rollWidth };
  };

  const calculate = (references, settings = {}) => {
    const config = { rollWidth: 57, gap: 1, margin: 0.5, rotate: true, meterCost: 0, pressCost: 0, setupCost: 0, profit: 30, ...settings };
    const errors = validateReferences(references);
    for (const [key, minimum, maximum] of [['rollWidth', 10, 200], ['gap', 0, 10], ['margin', 0, 10], ['meterCost', 0, 1000000], ['pressCost', 0, 1000000], ['setupCost', 0, 1000000], ['profit', 0, 90]]) {
      if (!Number.isFinite(config[key]) || config[key] < minimum || config[key] > maximum) errors.push(`Revisá el valor de ${({rollWidth:'ancho del DTF',gap:'separación',margin:'margen exterior',meterCost:'DTF por metro',pressCost:'aplicación por estampado',setupCost:'preparación',profit:'margen comercial'})[key]}.`);
    }
    if (config.rollWidth - config.margin * 2 <= 0) errors.push('El margen exterior deja el rollo sin ancho imprimible.');
    if (errors.length) return { valid: false, errors };
    const pieces = references.flatMap((item, reference) => Array.from({ length: item.quantity }, (_, copy) => ({ reference, copy, width: item.width, height: item.height, label: String(reference + 1), type: item.type })));
    const candidates=['longest','area','height'].map(strategy=>({...packPieces(pieces,config.rollWidth,config.gap,config.margin,config.rotate,strategy),strategy}));
    const layout=candidates.sort((a,b)=>a.unplaced.length-b.unplaced.length||a.rawLength-b.rawLength)[0];
    const baseline=packPieces(pieces,config.rollWidth,config.gap,config.margin,false);
    if (layout.unplaced.length) {
      const failed = [...new Set(layout.unplaced.map(piece => references[piece.reference].detail))];
      return { valid: false, errors: [`No caben ${layout.unplaced.length} estampados en el ancho útil de ${(config.rollWidth - config.margin * 2).toFixed(1)} cm: ${failed.slice(0, 3).join(', ')}. Revisá las medidas o permití la rotación.`], layout };
    }
    const billedMeters = Math.max(0, Math.ceil((layout.rawLength - EPSILON) / 10) / 10);
    const materialCost = billedMeters * config.meterCost;
    const applicationCost = pieces.length * config.pressCost;
    const preparationCost = pieces.length ? config.setupCost : 0;
    const productionCost = materialCost + applicationCost + preparationCost;
    const hasCosts = pieces.length > 0 && productionCost > 0;
    const total = productionCost / (1 - config.profit / 100);
    return { valid: true, errors: [], references, config, layout, alternatives:candidates,baseline, pieces: pieces.length, billedMeters, materialCost, applicationCost, preparationCost, productionCost, total, hasCosts };
  };

  const splitFields = line => {
    const separators = new Set();
    let insideQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (insideQuotes && line[i + 1] === '"') i++;
        else insideQuotes = !insideQuotes;
      } else if (!insideQuotes && [';', '\t', ','].includes(line[i])) separators.add(line[i]);
    }
    const delimiter = separators.has(';') ? ';' : separators.has('\t') ? '\t' : ',';
    const fields = [];
    let field = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') {
        if (quoted && line[i + 1] === '"') { field += '"'; i++; }
        else quoted = !quoted;
      } else if (line[i] === delimiter && !quoted) { fields.push(field.trim()); field = ''; }
      else field += line[i];
    }
    if (quoted) throw new Error('Hay comillas sin cerrar.');
    fields.push(field.trim());
    return fields;
  };

  const teamSizePresets = Object.freeze({
    infantil: { nameWidth: 18, nameHeight: 4, numberHeight: 18 },
    S: { nameWidth: 24, nameHeight: 5, numberHeight: 24 },
    M: { nameWidth: 27, nameHeight: 5.5, numberHeight: 27 },
    L: { nameWidth: 30, nameHeight: 6, numberHeight: 30 }
  });
  const teamMeasurements = (size = 'M', numberText = '') => {
    const preset = teamSizePresets[size] || teamSizePresets.L;
    const digits = Math.max(1, String(numberText).length);
    return { ...preset, numberWidth: Number((digits * preset.numberHeight * 0.55 + Math.max(0, digits - 1) * 0.8).toFixed(1)) };
  };

  const createTeamReferences = members => {
    if (!Array.isArray(members) || members.length > 50) throw new Error('Un equipo admite hasta 50 integrantes.');
    const references = [];
    members.forEach((member, index) => {
      const name = String(member.name || '').trim();
      const numberText = String(member.number ?? '').trim();
      const size = sizeOf(member.size || 'M');
      const garment = garmentOf(member.garment || 'camiseta');
      const quantity = member.quantity === undefined ? 1 : number(member.quantity);
      const label = `Integrante ${index + 1}`;
      if (!name && !numberText) throw new Error(`${label}: ingresá nombre o número.`);
      if (name.length > 60) throw new Error(`${label}: el nombre admite hasta 60 caracteres.`);
      if (numberText && !/^\d{1,3}$/.test(numberText)) throw new Error(`${label}: el número debe tener entre 1 y 3 dígitos.`);
      if (size === null || garment === null) throw new Error(`${label}: revisá la prenda y talla.`);
      const suggested = teamMeasurements(size, numberText);
      const measurements = Object.fromEntries(Object.keys(suggested).map(key => [key, member[key] === undefined ? suggested[key] : number(member[key])]));
      const metadata = { type: 'texto', quantity, garment, size, teamMemberId: String(member.id ?? index + 1), teamLabel: String(member.teamLabel || '') };
      if (name) references.push({ ...metadata, detail: `Nombre: ${name}`, width: measurements.nameWidth, height: measurements.nameHeight });
      if (numberText) references.push({ ...metadata, detail: `Número ${numberText}${name ? ` · ${name}` : ''}`, width: measurements.numberWidth, height: measurements.numberHeight });
    });
    const errors = validateReferences(references);
    if (errors.length) throw new Error(errors.join(' '));
    return references;
  };

  const parseTeamMembers = text => {
    const lines = String(text || '').split(/\r?\n/).map((line,index) => ({ line: line.trim(), index: index + 1 })).filter(item => item.line);
    if (!lines.length) throw new Error('Pegá al menos un integrante.');
    if (lines.length > 50) throw new Error('Un equipo admite hasta 50 integrantes.');
    return lines.map(({line,index}) => {
      try {
        const fields = splitFields(line);
        if (fields.length < 2 || fields.length > 5) throw new Error('Usá nombre; número; talla; prenda; copias. Los últimos tres campos son opcionales.');
        const [name, numberText, size = 'M', garment = 'camiseta', quantity = '1'] = fields;
        const member = { name, number: numberText, size: size || 'M', garment: garment || 'camiseta', quantity: number(quantity || '1') };
        createTeamReferences([member]);
        return member;
      } catch (error) { throw new Error(`Línea ${index}: ${error.message}`); }
    });
  };

  const parseList = (text, format = 'designs') => {
    const lines = String(text || '').split(/\r?\n/).map((line, index) => ({ line: line.trim(), index: index + 1 })).filter(item => item.line);
    if (!lines.length) throw new Error('Pegá al menos una referencia.');
    if (lines.length > MAX_REFERENCES) throw new Error('La lista admite hasta 100 líneas.');
    const result = [];
    lines.forEach(({line, index}) => {
      try {
        const fields = splitFields(line);
        if (format === 'team') {
          if (fields.length < 2 || fields.length > 3) throw new Error('Usá nombre; número; talla.');
          const [name, numberText, sizeText = 'M'] = fields;
          const size = sizeOf(sizeText || 'M');
          if (size === null) throw new Error('La talla no es válida.');
          if (!name && !numberText) throw new Error('Falta el nombre o número.');
          if (numberText && !/^\d{1,3}$/.test(numberText)) throw new Error('El número debe tener entre 1 y 3 dígitos.');
          const preset = ({ infantil: [18,4,18], S: [24,5,24], M: [27,5.5,27], L: [30,6,30] })[size] || [30,6,30];
          if (name) result.push({ detail: `Nombre: ${name}`, type: 'texto', width: preset[0], height: preset[1], quantity: 1, garment: 'camiseta', size: size || 'M' });
          if (numberText) result.push({ detail: `Número ${numberText}${name ? ` · ${name}` : ''}`, type: 'texto', width: Number((Math.max(preset[2] * 0.55, numberText.length * preset[2] * 0.55 + Math.max(0, numberText.length - 1) * 0.8)).toFixed(1)), height: preset[2], quantity: 1, garment: 'camiseta', size: size || 'M' });
        } else {
          if (fields.length < 5 || fields.length > 7) throw new Error('Usá detalle; tipo; ancho; alto; cantidad; prenda; talla.');
          const [detail, type, width, height, quantity, garment = '', size = ''] = fields;
          const reference = { detail, type: typeOf(type), width: number(width), height: number(height), quantity: number(quantity), garment: garmentOf(garment), size: sizeOf(size) };
          const problems = validateReferences([reference]);
          if (sizeOf(size) === null) problems.push('La talla no es válida.');
          if (problems.length) throw new Error(problems.join(' '));
          result.push(reference);
        }
      } catch (error) { throw new Error(`Línea ${index}: ${error.message}`); }
    });
    const errors = validateReferences(result);
    if (errors.length) throw new Error(errors.join(' '));
    return result;
  };

  const quoteText = (summary, customer = '') => {
    if (!summary?.valid || !summary.pieces) throw new Error('El pedido debe tener referencias válidas.');
    return [
      summary.hasCosts ? '*Cotización de impresión DTF · Momotus Core*' : '*Pedido de impresión DTF · Momotus Core*',
      `Cliente/pedido: ${customer.trim() || 'Sin especificar'}`,
      `Referencias: ${summary.references.length} · Estampados: ${summary.pieces}`,
      '',
      ...summary.references.map((item, index) => `${index + 1}. ${item.detail} · ${types[item.type]} · ${item.width} × ${item.height} cm · ${item.quantity} copia${item.quantity === 1 ? '' : 's'}${item.garment ? ` · ${garments[item.garment]}` : ''}${item.size ? ` · ${item.size === 'infantil' ? 'Infantil' : item.size}` : ''}${item.location?` · ${item.location}`:''}${item.teamLabel ? ` · Equipo: ${item.teamLabel}` : ''}`),
      '',
      `DTF estimado: ${summary.billedMeters.toFixed(1)} m de ${summary.config.rollWidth} cm de ancho (redondeo a 10 cm).`,
      `Separación: ${summary.config.gap} cm · Margen exterior: ${summary.config.margin} cm · Rotación: ${summary.config.rotate ? 'permitida' : 'desactivada'}`,
      summary.hasCosts ? `Total de impresión sugerido: ${currency.format(summary.total)}` : 'Precio pendiente: faltan costos de impresión.',
      'Prendas y envío no incluidos. Estimación sujeta a revisión final de medidas y archivos.',
      'Momotus Core · momotuscore@gmail.com · 5501-0044'
    ].join('\n');
  };

  const api = Object.freeze({ calculate, parseList, quoteText, packPieces, createTeamReferences, teamMeasurements, parseTeamMembers });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window === 'undefined' || !window.MOMOTUS_TOOLS_DESKTOP) return;
  const byId = id => document.getElementById(id);
  if (!byId('calc-team-mode')) return;
  window.MomotusQuoteCalculator = api;
  let latestSummary = null;
  let sequence = 0;

  const options = labels => Object.entries(labels).map(([value,label]) => `<option value="${value}">${label}</option>`).join('');
  const sizeOptions = {'':'Sin especificar',infantil:'Infantil',XS:'XS',S:'S',M:'M',L:'L',XL:'XL',XXL:'XXL'};
  const isEmptyCard = card => !card.classList.contains('team-equipment') && card.dataset.touched !== 'true' && !card.querySelector('.team-detail').value.trim();

  const readTeamMembers = card => [...card.querySelectorAll('.team-member')].filter(row => row.dataset.touched === 'true' || row.querySelector('.member-name').value.trim() || row.querySelector('.member-number').value.trim()).map(row => {
    const measures = card.querySelector(`[data-measures-for="${row.dataset.memberId}"]`);
    return {
      id: row.dataset.memberId, teamLabel: card.querySelector('.team-label').value.trim(),
      name: row.querySelector('.member-name').value.trim(), number: row.querySelector('.member-number').value.trim(),
      garment: row.querySelector('.member-garment').value, size: row.querySelector('.member-size').value,
      quantity: number(row.querySelector('.member-quantity').value),
      ...Object.fromEntries(['nameWidth','nameHeight','numberWidth','numberHeight'].map(key => [key,number(measures.querySelector(`[data-measure="${key}"]`).value)]))
    };
  });

  const suggestMemberMeasures = (row, force = false) => {
    const card = row.closest('.team-equipment');
    const measures = card.querySelector(`[data-measures-for="${row.dataset.memberId}"]`);
    const suggested = teamMeasurements(row.querySelector('.member-size').value, row.querySelector('.member-number').value);
    for (const [key,value] of Object.entries(suggested)) {
      const input = measures.querySelector(`[data-measure="${key}"]`);
      if (force || input.dataset.custom !== 'true') { input.value = value; delete input.dataset.custom; }
    }
    row.querySelector('.member-measure-note').textContent = [...measures.querySelectorAll('[data-measure]')].some(input => input.dataset.custom === 'true') ? 'Ajustadas' : 'Sugeridas';
  };

  const addTeamMember = (card, member = {}, focus = false) => {
    if (card.querySelectorAll('.team-member').length >= 50) { card.querySelector('.team-group-error').textContent = 'Un equipo admite hasta 50 integrantes.'; card.querySelector('.team-group-error').hidden = false; return null; }
    const id = `member-${++sequence}`;
    const row = document.createElement('tr'); row.className = 'team-member'; row.dataset.memberId = id;
    row.innerHTML = `<td><input class="member-name" type="text" maxlength="60" aria-label="Nombre del integrante" placeholder="Nombre"></td><td><input class="member-number" type="text" inputmode="numeric" maxlength="3" aria-label="Número del integrante" placeholder="10"></td><td><select class="member-garment" aria-label="Prenda del integrante">${options(garments)}</select></td><td><select class="member-size" aria-label="Talla del integrante">${options(sizeOptions)}</select></td><td><input class="member-quantity" type="number" min="1" max="1000" step="1" aria-label="Copias por integrante"></td><td><button class="member-measures-toggle" type="button" aria-expanded="false" aria-controls="measures-${id}"><i class="fa-solid fa-ruler-combined" aria-hidden="true"></i><span class="member-measure-note">Sugeridas</span></button></td><td><button class="member-remove" type="button" aria-label="Eliminar integrante"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></td>`;
    for (const [key,value] of Object.entries({name:member.name || '',number:member.number ?? '',garment:member.garment || 'camiseta',size:member.size || 'M',quantity:member.quantity ?? 1})) row.querySelector(`.member-${key}`).value = value;
    if (member.name || member.number) row.dataset.touched = 'true';
    const measures = document.createElement('tr'); measures.className = 'team-member-measures'; measures.dataset.measuresFor = id; measures.id = `measures-${id}`; measures.hidden = true;
    measures.innerHTML = `<td colspan="7"><div class="member-measure-grid">${[['nameWidth','Ancho del nombre'],['nameHeight','Alto del nombre'],['numberWidth','Ancho del número'],['numberHeight','Alto del número']].map(([key,label]) => `<label class="team-field"><span>${label}<small>cm</small></span><input data-measure="${key}" type="number" min="0.001" max="300" step="0.001"></label>`).join('')}</div><div class="member-measure-footer"><span>Las medidas son sugeridas. Revisá la tipografía y el archivo antes de imprimir.</span><button class="member-reset-measures" type="button">Restaurar sugeridas</button></div></td>`;
    card.querySelector('.team-members-body').append(row,measures);
    suggestMemberMeasures(row);
    for (const key of ['nameWidth','nameHeight','numberWidth','numberHeight']) if (member[key] !== undefined) { const input = measures.querySelector(`[data-measure="${key}"]`); input.value = member[key]; input.dataset.custom = 'true'; }
    suggestMemberMeasures(row);
    if (focus) row.querySelector('.member-name').focus();
    return row;
  };

  const addTeamCard = () => {
    [...byId('team-roster-body').children].filter(isEmptyCard).forEach(card => card.remove());
    if (byId('team-roster-body').children.length >= MAX_REFERENCES) { byId('team-summary-status').textContent = 'El pedido admite hasta 100 referencias.'; return null; }
    const card = document.createElement('article'); card.className = 'team-reference team-equipment'; card.dataset.referenceId = `team-${++sequence}`;
    card.innerHTML = `<div class="team-reference-heading"><span class="team-reference-index"></span><label class="team-field team-detail-field"><span><strong><i class="fa-solid fa-people-group" aria-hidden="true"></i> Equipo · nombre y número</strong></span><input class="team-label" type="text" maxlength="40" placeholder="Nombre del equipo (opcional)"></label><button class="team-remove" type="button" aria-label="Eliminar equipo"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></div><p class="team-group-help">Agregá los integrantes como antes. Un nombre y un número generan dos estampados por copia; podés usar solo uno de ellos.</p><div class="team-members-wrap"><table class="team-members-table"><thead><tr><th>Nombre</th><th>Número</th><th>Prenda</th><th>Talla</th><th>Copias</th><th>Medidas</th><th><span class="sr-only">Eliminar</span></th></tr></thead><tbody class="team-members-body"></tbody></table></div><div class="team-group-actions"><button class="member-add" type="button"><i class="fa-solid fa-plus" aria-hidden="true"></i> Agregar integrante</button><button class="team-group-example" type="button">Agregar ejemplo de equipo</button></div><details class="team-group-import"><summary>Pegar lista de integrantes</summary><p>Nombre; número; talla; prenda; copias. Talla, prenda y copias son opcionales.</p><textarea class="team-members-paste" rows="3" aria-label="Lista de integrantes" placeholder="Carlos; 10; M; camiseta; 1&#10;María; 7; S; camiseta; 1"></textarea><button class="team-group-import-button" type="button">Agregar integrantes a este equipo</button></details><p class="team-group-error team-roster-error" role="alert" hidden></p>`;
    byId('team-roster-body').append(card); addTeamMember(card); renumber(); card.querySelector('.member-name').focus(); return card;
  };

  const addReference = (item = {}, focus = false) => {
    if (byId('team-roster-body').children.length >= MAX_REFERENCES) { byId('team-summary-status').textContent = 'El pedido admite hasta 100 referencias.'; return null; }
    const type = item.type || 'diseno';
    const preset = presets[type] || presets.diseno;
    const card = document.createElement('article');
    card.className = 'team-reference';
    card.dataset.referenceId = String(++sequence);
    card.innerHTML = `<div class="team-reference-heading"><span class="team-reference-index"></span><label class="team-field team-detail-field"><span>Detalle del diseño</span><input class="team-detail" type="text" maxlength="100" placeholder="Ej. Logo de la academia"></label><button class="team-remove" type="button" aria-label="Eliminar referencia"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></div><div class="team-reference-fields"><label class="team-field"><span>Tipo</span><select class="team-type">${options(types)}</select></label><label class="team-field"><span>Ancho <small>cm</small></span><input class="team-width" type="number" min="0.001" max="300" step="0.001"></label><label class="team-field"><span>Alto <small>cm</small></span><input class="team-height" type="number" min="0.001" max="300" step="0.001"></label><label class="team-field"><span>Copias</span><input class="team-quantity" type="number" min="1" max="1000" step="1"></label></div><details class="team-reference-meta"><summary>Ubicación, prenda y talla <small>Opcional · solo para identificar</small></summary><div><label class="team-field"><span>Ubicación</span><select class="team-location">${options({'':'Sin especificar',frente:'Frente',espalda:'Espalda',manga:'Manga',otro:'Otro'})}</select></label><label class="team-field"><span>Prenda</span><select class="team-garment">${options(garments)}</select></label><label class="team-field"><span>Talla</span><select class="team-size">${options({'':'Sin especificar',infantil:'Infantil',XS:'XS',S:'S',M:'M',L:'L',XL:'XL',XXL:'XXL'})}</select></label></div></details>`;
    for (const [key,value] of Object.entries({detail:item.detail || '',type,width:item.width ?? preset.width,height:item.height ?? preset.height,quantity:item.quantity ?? 1,garment:item.garment || '',size:item.size || '',location:item.location||''})) card.querySelector(`.team-${key}`).value = value;
    if (item.detail) card.dataset.touched = 'true';
    byId('team-roster-body').append(card);
    renumber();
    if (focus) card.querySelector('.team-detail').focus();
    return card;
  };
  const renumber = () => [...byId('team-roster-body').children].forEach((card,index) => {
    card.querySelector('.team-reference-index').textContent = String(index + 1).padStart(2,'0');
    card.querySelector('.team-remove').setAttribute('aria-label',`Eliminar referencia ${index + 1}`);
  });
  const readReferences = () => [...byId('team-roster-body').children].flatMap(card => {
    if (card.classList.contains('team-equipment')) return createTeamReferences(readTeamMembers(card));
    if (isEmptyCard(card)) return [];
    return [{detail:card.querySelector('.team-detail').value.trim(),type:card.querySelector('.team-type').value,width:number(card.querySelector('.team-width').value),height:number(card.querySelector('.team-height').value),quantity:number(card.querySelector('.team-quantity').value),garment:card.querySelector('.team-garment').value,size:card.querySelector('.team-size').value,location:card.querySelector('.team-location').value}];
  });
  const settings = () => Object.fromEntries([['rollWidth','team-roll-width'],['gap','team-gap'],['margin','team-margin'],['meterCost','team-meter-cost'],['pressCost','team-press-cost'],['setupCost','team-setup-cost'],['profit','team-profit']].map(([key,id]) => [key,number(byId(id).value)]).concat([['rotate',byId('team-rotate').checked]]));

  let rollHitboxes=[];
  const drawRoll = layout => {
    rollHitboxes=[];
    const canvas = byId('team-roll-preview'), context = canvas.getContext('2d');
    context.clearRect(0,0,canvas.width,canvas.height);
    delete canvas.dataset.precisionWidth;
    context.fillStyle = '#141820';context.fillRect(0,0,canvas.width,canvas.height);
    if (!layout?.placements.length) {
      context.fillStyle='#a1a1aa';context.font='14px sans-serif';context.textAlign='center';context.fillText('Agregá diseños con medidas válidas',canvas.width/2,canvas.height/2);return;
    }
    const scale = Math.min((canvas.width-32)/layout.rollWidth,(canvas.height-32)/Math.max(10,layout.rawLength));
    const offsetX = (canvas.width-layout.rollWidth*scale)/2, offsetY = 16;
    canvas.dataset.precisionWidth=layout.rollWidth;canvas.dataset.precisionHeight=layout.rawLength;canvas.dataset.precisionX=offsetX;canvas.dataset.precisionY=offsetY;canvas.dataset.precisionScale=scale;
    context.fillStyle='#e4e4e7';context.fillRect(offsetX,offsetY,layout.rollWidth*scale,layout.rawLength*scale);
    const colors={logo:'#facc15',texto:'#93c5fd',foto:'#c4b5fd',diseno:'#86efac'};
    rollHitboxes=[];
    layout.placements.forEach(piece => {
      const x=offsetX+piece.x*scale,y=offsetY+piece.y*scale,w=piece.width*scale,h=piece.height*scale;
      rollHitboxes.push({x,y,w,h,reference:piece.reference,copy:piece.copy});
      context.fillStyle=colors[piece.type];context.fillRect(x,y,w,h);context.strokeStyle='#18181b';context.strokeRect(x,y,w,h);
      if(w>15&&h>12){context.fillStyle='#18181b';context.font='bold 11px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(piece.label,x+w/2,y+h/2,w-4);}
    });
  };

  const update = () => {
    let references = [], summary;
    try { references = readReferences(); summary = calculate(references,settings()); }
    catch (error) { summary = { valid: false, errors: [error.message] }; }
    latestSummary = summary.valid && summary.pieces ? summary : null;
    const error = byId('team-roster-error');error.hidden=summary.valid;error.textContent=summary.errors.join(' ');
    const memberCount = [...document.querySelectorAll('.team-equipment')].reduce((sum,card)=>sum+readTeamMembers(card).length,0);
    byId('team-summary-count').textContent=references.length ? `${references.length} referencia${references.length===1?'':'s'}${memberCount ? ` · ${memberCount} integrante${memberCount===1?'':'s'}` : ''}` : memberCount ? 'Revisá los integrantes del equipo' : 'Sin referencias todavía';
    const ready=Boolean(latestSummary);
    byId('team-summary-pieces').textContent=ready?String(summary.pieces):'0';
    byId('team-summary-length').textContent=ready?`${summary.billedMeters.toFixed(1)} m`:'—';
    byId('team-summary-raw').textContent=ready?`${summary.layout.rawLength.toFixed(1)} cm distribuidos`:'Distribución pendiente';
    byId('team-summary-total').textContent=!summary.valid?'Revisar pedido':!ready?'Agregar diseños':summary.hasCosts?currency.format(summary.total):'Agregar costos';
    byId('team-summary-unit').textContent=ready&&summary.hasCosts?`${currency.format(summary.total/summary.pieces)} promedio por estampado`:'Prendas y envío no incluidos';
    for(const [id,key] of [['team-cost-material','materialCost'],['team-cost-application','applicationCost'],['team-cost-preparation','preparationCost'],['team-cost-base','productionCost']]) byId(id).textContent=ready&&summary.hasCosts?currency.format(summary[key]):'—';
    byId('team-summary-status').textContent=!summary.valid?'Corregí los datos indicados antes de compartir.':!ready?'Agregá el detalle, la medida y la cantidad del primer diseño.':summary.hasCosts?'Precio estimado de impresión. Revisá los archivos y las medidas antes de confirmar.':'Material calculado. Podés compartir el pedido; agregá costos para obtener el precio.';
    byId('team-copy').disabled=!ready;byId('team-whatsapp').disabled=!ready;
    byId('team-whatsapp').lastChild.textContent=ready&&summary.hasCosts?' Compartir cotización':' Compartir pedido';
    drawRoll(ready?summary.layout:null);
    renderQuoteRows(ready?summary:null,references);
    renderLayoutComparison(ready?summary:null);
    for(const id of ['team-save-quote','team-print-client','team-print-internal'])byId(id).disabled=!ready;
  };
  const showMode = mode => {
    const sheet=mode==='sheet';
    for(const [id,key]of [['calc-team-tab','team'],['calc-equipment-tab','equipment'],['calc-sheet-tab','sheet']]){const active=mode===key;byId(id).classList.toggle('active',active);byId(id).setAttribute('aria-selected',String(active));byId(id).tabIndex=active?0:-1;}
    byId('calc-team-mode').hidden=sheet;byId('calc-sheet-mode').hidden=!sheet;
    if(mode==='equipment'&&!document.querySelector('.team-equipment'))addTeamCard();
    if(!sheet)update();
  };
  for(const [id,mode]of [['calc-team-tab','team'],['calc-equipment-tab','equipment'],['calc-sheet-tab','sheet']])byId(id).addEventListener('click',()=>showMode(mode));
  window.addEventListener('momotus:quote-sheet',()=>showMode('sheet'));
  const modeTabs=['calc-equipment-tab','calc-team-tab','calc-sheet-tab'];
  document.querySelector('#calculadora-dtf .calc-mode-switch').addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const current=modeTabs.findIndex(id=>byId(id).getAttribute('aria-selected')==='true'),next=event.key==='Home'?0:event.key==='End'?2:(current+(event.key==='ArrowRight'?1:2))%3;byId(modeTabs[next]).click();byId(modeTabs[next]).focus();});
  byId('team-add-member').addEventListener('click',()=>{addReference({},true);update();});
  document.querySelectorAll('[data-team-template]').forEach(button=>button.addEventListener('click',()=>{if (button.dataset.teamTemplate === 'equipo') addTeamCard(); else addReference({type:button.dataset.teamTemplate},true);update();}));
  byId('team-roster-body').addEventListener('input',event=>{const card=event.target.closest('.team-reference');
    if (card?.classList.contains('team-equipment')) {
      const parentRow=event.target.closest('tr');
      const row=parentRow?.classList.contains('team-member') ? parentRow : parentRow?.dataset.measuresFor ? card.querySelector(`[data-member-id="${parentRow.dataset.measuresFor}"]`) : null;
      if (row) { row.dataset.touched='true'; if(event.target.matches('[data-measure]'))event.target.dataset.custom='true'; suggestMemberMeasures(row); }
    } else if(card)card.dataset.touched='true';
    update();});
  byId('team-roster-body').addEventListener('change',update);
  byId('team-roster-body').addEventListener('click',event=>{
    const button=event.target.closest('button'); if(!button)return;
    const card=button.closest('.team-reference');
    if(button.matches('.team-remove')){card.remove();renumber();update();return;}
    if(!card?.classList.contains('team-equipment'))return;
    const error=card.querySelector('.team-group-error');
    if(button.matches('.member-add')){addTeamMember(card,{},true);update();return;}
    const row=button.closest('.team-member');
    if(button.matches('.member-remove')){card.querySelector(`[data-measures-for="${row.dataset.memberId}"]`).remove();row.remove();update();return;}
    if(button.matches('.member-measures-toggle')){const measures=card.querySelector(`[data-measures-for="${row.dataset.memberId}"]`);measures.hidden=!measures.hidden;button.setAttribute('aria-expanded',String(!measures.hidden));return;}
    if(button.matches('.member-reset-measures')){const measures=button.closest('[data-measures-for]');const memberRow=card.querySelector(`[data-member-id="${measures.dataset.measuresFor}"]`);suggestMemberMeasures(memberRow,true);update();return;}
    if(button.matches('.team-group-import-button')||button.matches('.team-group-example')){
      try{
        const imported=button.matches('.team-group-example')?[{name:'Carlos',number:'10',size:'M'},{name:'María',number:'7',size:'S'}]:parseTeamMembers(card.querySelector('.team-members-paste').value);
        const empty=[...card.querySelectorAll('.team-member')].filter(member=>member.dataset.touched!=='true'&&!member.querySelector('.member-name').value.trim()&&!member.querySelector('.member-number').value.trim());
        const existing=readTeamMembers(card);if(existing.length+imported.length>50)throw new Error('Un equipo admite hasta 50 integrantes.');
        const combined=readReferences().concat(createTeamReferences(imported));const problems=validateReferences(combined);if(problems.length)throw new Error(problems.join(' '));
        empty.forEach(member=>{card.querySelector(`[data-measures-for="${member.dataset.memberId}"]`).remove();member.remove();});
        imported.forEach(member=>addTeamMember(card,member));error.hidden=true;card.querySelector('.team-members-paste').value='';update();
      }catch(problem){error.textContent=problem.message;error.hidden=false;}
    }
  });
  for(const id of ['team-customer','team-roll-width','team-gap','team-margin','team-rotate','team-meter-cost','team-press-cost','team-setup-cost','team-profit']) byId(id).addEventListener('input',update);
  byId('team-import-format').addEventListener('change',()=>{
    const team=byId('team-import-format').value==='team';byId('team-import-help').textContent=team?'Una persona por línea: nombre; número; talla. El nombre y el número se agregan como estampados separados. Las medidas son sugeridas.':'Una línea por diseño: detalle; tipo; ancho; alto; cantidad; prenda; talla. Prenda y talla son opcionales.';
    byId('team-paste-input').placeholder=team?'Carlos; 10; M\nMaría; 7; S':'Logo Academia; logo; 10; 10; 12; camiseta; M\nFoto familiar; foto; 20; 25; 2; hoodie; L';
  });
  byId('team-import-list').addEventListener('click',()=>{
    const error=byId('team-import-error');
    try{
      const imported=parseList(byId('team-paste-input').value,byId('team-import-format').value);
      const cards=[...byId('team-roster-body').children];const empty=cards.filter(card=>isEmptyCard(card));
      if(cards.length-empty.length+imported.length>MAX_REFERENCES)throw new Error('El pedido completo superaría 100 referencias.');
      const combined=readReferences().concat(imported);const problems=validateReferences(combined);if(problems.length)throw new Error(problems.join(' '));
      empty.forEach(card=>card.remove());imported.forEach(item=>addReference(item));error.hidden=true;byId('team-paste-input').value='';update();
    }catch(problem){error.textContent=problem.message;error.hidden=false;}
  });
  byId('team-example').addEventListener('click',()=>{
    const examples=[{detail:'Logo Academia',type:'logo',width:10,height:10,quantity:12,garment:'camiseta',size:'M'},{detail:'Foto familiar',type:'foto',width:20,height:25,quantity:2,garment:'hoodie',size:'L'}];
    const cards=[...byId('team-roster-body').children],empty=cards.filter(card=>isEmptyCard(card));
    if(cards.length-empty.length+examples.length>MAX_REFERENCES){byId('team-summary-status').textContent='No queda espacio para agregar el ejemplo.';return;}
    empty.forEach(card=>card.remove());examples.forEach(item=>addReference(item));update();
  });
  byId('team-copy').addEventListener('click',async()=>{
    update();if(!latestSummary)return;
    try{await navigator.clipboard.writeText(quoteText(latestSummary,byId('team-customer').value));byId('team-summary-status').textContent='Pedido copiado con medidas, cantidades y alcance de la cotización.';}
    catch{byId('team-summary-status').textContent='No se pudo copiar automáticamente. Usá Compartir pedido.';}
  });
  byId('team-whatsapp').addEventListener('click',()=>{update();if(!latestSummary)return;window.open(`https://wa.me/50555010044?text=${encodeURIComponent(quoteText(latestSummary,byId('team-customer').value))}`,'_blank','noopener,noreferrer');});

  const extras=document.createElement('section');extras.className='pro-quote-tools';
  extras.innerHTML=`<details class="pro-detail" open><summary>Detalle y subtotal por referencia</summary><div class="pro-table-wrap"><table class="pro-quote-table"><thead><tr><th>Diseño</th><th>Medidas</th><th>Copias</th><th>Ubicación</th><th>Subtotal estimado</th></tr></thead><tbody id="team-detail-table"></tbody></table></div><small>Subtotal proporcional al área impresa, más aplicación; preparación distribuida por copia. La suma coincide con la cotización.</small></details><details class="pro-detail"><summary>Comparar distribuciones</summary><div id="team-layout-comparison"></div></details><details class="pro-detail"><summary>Guardar y recuperar cotizaciones</summary><div class="pro-actions"><button id="team-save-quote" type="button">Guardar pedido</button><select id="team-quote-history" aria-label="Historial de cotizaciones"><option value="">Elegí una cotización</option></select><button id="team-load-quote" type="button">Recuperar</button></div><p id="team-history-status" role="status">Guardado local en este navegador. Incluye los integrantes y sus medidas.</p></details><div class="pro-actions"><button id="team-print-client" type="button">Informe para cliente</button><button id="team-print-internal" type="button">Desglose interno</button></div>`;
  byId('team-roster-body').closest('.team-section').after(extras);
  const columns=['Detalle','Tipo','Ancho cm','Alto cm','Copias'];
  const tableHeading=document.createElement('div');tableHeading.className='pro-reference-heading';columns.forEach(text=>{const e=document.createElement('span');e.textContent=text;tableHeading.append(e);});byId('team-roster-body').before(tableHeading);
  function subtotals(summary){const area=summary.references.reduce((n,r)=>n+r.width*r.height*r.quantity,0);const raw=summary.references.map(r=>((summary.materialCost*r.width*r.height*r.quantity/(area||1))+summary.applicationCost*r.quantity/summary.pieces+summary.preparationCost*r.quantity/summary.pieces)/(1-summary.config.profit/100)*100);const cents=raw.map(Math.floor),remaining=Math.round(summary.total*100)-cents.reduce((a,b)=>a+b,0),order=raw.map((v,i)=>({i,f:v-cents[i]})).sort((a,b)=>b.f-a.f);for(let n=0;n<remaining;n++)cents[order[n%order.length].i]++;return cents.map(v=>v/100);}
  function renderQuoteRows(summary,references){const body=byId('team-detail-table');body.replaceChildren();const totals=summary?.hasCosts?subtotals(summary):[];references.forEach((ref,i)=>{const row=document.createElement('tr');for(const text of [ref.detail,`${ref.width} × ${ref.height} cm`,ref.quantity,ref.location||'Sin especificar',totals.length?currency.format(totals[i]):'Costos pendientes']){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}row.tabIndex=0;row.addEventListener('click',()=>focusReference(i));body.append(row);});}
  function focusReference(index){const ref=latestSummary?.references[index];if(!ref)return;byId('team-summary-status').textContent=`Referencia ${index+1}: ${ref.detail} · ${ref.width} × ${ref.height} cm · ${ref.quantity} copias.`;const rows=byId('team-detail-table').children;[...rows].forEach((r,i)=>r.classList.toggle('is-selected',i===index));rows[index]?.scrollIntoView({block:'nearest'});}
  byId('team-roll-preview').addEventListener('click',e=>{const c=e.currentTarget,r=c.getBoundingClientRect(),x=(e.clientX-r.left)*c.width/r.width,y=(e.clientY-r.top)*c.height/r.height;const hit=rollHitboxes.find(p=>x>=p.x&&x<=p.x+p.w&&y>=p.y&&y<=p.y+p.h);if(hit)focusReference(hit.reference);});
  function renderLayoutComparison(summary){const box=byId('team-layout-comparison');box.replaceChildren();if(!summary)return;for(const layout of summary.alternatives){const p=document.createElement('p');p.textContent=`${({longest:'Por lado mayor',area:'Por área',height:'Por altura'})[layout.strategy]}: ${layout.rawLength.toFixed(1)} cm${layout===summary.layout?' · elegida':''}`;box.append(p);}const p=document.createElement('p');p.textContent=summary.baseline.unplaced.length?'Sin giro: hay piezas que no caben.':`Sin giro: ${summary.baseline.rawLength.toFixed(1)} cm · Ahorro de largo: ${Math.max(0,summary.baseline.rawLength-summary.layout.rawLength).toFixed(1)} cm.`;box.append(p);}
  let history=[];try{const data=JSON.parse(localStorage.getItem('momotus-quotes-v2')||'[]');if(Array.isArray(data))history=data.slice(0,30);}catch{}
  function historyList(){byId('team-quote-history').replaceChildren(new Option('Elegí una cotización',''),...history.map((h,i)=>new Option(`${h.customer||'Pedido'} · ${new Date(h.time).toLocaleDateString('es-NI')}`,String(i))));}
  const captureOrder=()=>({customer:byId('team-customer').value,settings:settings(),cards:[...byId('team-roster-body').children].filter(c=>!isEmptyCard(c)).map(card=>card.classList.contains('team-equipment')?{team:true,label:card.querySelector('.team-label').value,members:readTeamMembers(card)}:{team:false,...Object.fromEntries(['detail','type','width','height','quantity','garment','size','location'].map(k=>[k,card.querySelector(`.team-${k}`).value]))})});
  byId('team-save-quote').addEventListener('click',()=>{update();if(!latestSummary)return;try{const next=[{...captureOrder(),time:Date.now()},...history].slice(0,30);localStorage.setItem('momotus-quotes-v2',JSON.stringify(next));history=next;historyList();byId('team-history-status').textContent='Pedido guardado con sus costos y medidas.';}catch{byId('team-history-status').textContent='No se pudo guardar el pedido en este navegador.';}});
  byId('team-load-quote').addEventListener('click',()=>{const value=byId('team-quote-history').value;if(value==='')return;const saved=history[Number(value)];try{if(!saved||!Array.isArray(saved.cards)||saved.cards.length>100)throw Error('Pedido guardado no válido.');const refs=saved.cards.flatMap(c=>c.team?createTeamReferences(c.members):[{...c,width:number(c.width),height:number(c.height),quantity:number(c.quantity)}]);const checked=calculate(refs,saved.settings);if(!checked.valid)throw Error(checked.errors.join(' '));byId('team-roster-body').replaceChildren();byId('team-customer').value=saved.customer||'';for(const [key,id]of [['rollWidth','team-roll-width'],['gap','team-gap'],['margin','team-margin'],['meterCost','team-meter-cost'],['pressCost','team-press-cost'],['setupCost','team-setup-cost'],['profit','team-profit']])byId(id).value=saved.settings[key];byId('team-rotate').checked=saved.settings.rotate;saved.cards.forEach(c=>{if(c.team){const card=addTeamCard();card.querySelector('.team-label').value=c.label||'';card.querySelector('.team-members-body').replaceChildren();c.members.forEach(m=>addTeamMember(card,m));}else addReference(c);});update();byId('team-history-status').textContent='Cotización recuperada. Revisá los costos vigentes.';}catch(e){byId('team-history-status').textContent=e.message;}});
  function printQuote(internal){update();if(!latestSummary)return;const summary=latestSummary,report=window.open('','_blank');if(!report){byId('team-summary-status').textContent='Permití la ventana del informe para imprimir.';return;}report.document.write('<!doctype html><html lang="es"><meta charset="utf-8"><title>Cotización DTF</title><style>body{font:14px Arial;color:#222;margin:36px}table{border-collapse:collapse;width:100%;margin:24px 0}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}h1{border-bottom:4px solid #d9b44a;padding-bottom:15px}@media print{button{display:none}}</style><h1>Momotus Core · DTF</h1><p id="client"></p><div id="details"></div><p id="total"></p><p id="scope">Estimación de impresión. Prendas y envío no incluidos. Confirmar archivos y medidas antes de producir.</p><button onclick="print()">Imprimir / guardar PDF</button></html>');report.document.close();report.document.getElementById('client').textContent=`Cliente: ${byId('team-customer').value||'Sin especificar'} · ${new Date().toLocaleDateString('es-NI')}`;report.document.getElementById('details').append(byId('team-detail-table').closest('table').cloneNode(true));report.document.getElementById('total').textContent=summary.hasCosts?`Total: ${currency.format(summary.total)}`:'Precio pendiente';if(internal){const p=report.document.createElement('p');p.textContent=`Material: ${currency.format(summary.materialCost)} · Aplicación: ${currency.format(summary.applicationCost)} · Preparación: ${currency.format(summary.preparationCost)} · Costo: ${currency.format(summary.productionCost)} · Margen: ${summary.config.profit}% · DTF: ${summary.billedMeters} m`;report.document.getElementById('details').append(p);}}
  byId('team-print-client').addEventListener('click',()=>printQuote(false));byId('team-print-internal').addEventListener('click',()=>printQuote(true));historyList();
  window.addEventListener('momotus:quote-measurements',event=>{
    if(event.detail?.mode==='sheet')return;
    try{const d=window.MomotusPrecisionCore.validateMeasure(event.detail),item={detail:d.label,type:'diseno',width:d.widthCm,height:d.heightCm,quantity:d.quantity};
      const cards=[...byId('team-roster-body').children],empty=cards.filter(isEmptyCard);
      if(cards.length-empty.length>=MAX_REFERENCES)throw Error('El pedido ya tiene 100 referencias.');
      const errors=validateReferences([...readReferences(),item]);if(errors.length)throw Error(errors.join(' '));
      empty.forEach(c=>c.remove());addReference(item);showMode('team');byId('team-summary-status').textContent=`Medidas agregadas: ${d.widthCm.toFixed(3)} × ${d.heightCm.toFixed(3)} cm · ${d.quantity} copias. No se importaron imágenes.`;
      byId('calc-team-mode').scrollTop=0;
    }catch(e){byId('team-summary-status').textContent=e.message;window.showToast?.(e.message);}
  });
  addReference();update();showMode('team');
})();
