(() => {
  'use strict';

  if (!window.MOMOTUS_TOOLS_DESKTOP) return;

  const byId = id => document.getElementById(id);
  if (!byId('calc-team-mode')) return;

  const currency = new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', minimumFractionDigits: 2 });
  const sizePresets = Object.freeze({
    infantil: Object.freeze({ nameWidth: 18, nameHeight: 4, numberHeight: 18 }),
    S: Object.freeze({ nameWidth: 24, nameHeight: 5, numberHeight: 24 }),
    M: Object.freeze({ nameWidth: 27, nameHeight: 5.5, numberHeight: 27 }),
    L: Object.freeze({ nameWidth: 30, nameHeight: 6, numberHeight: 30 })
  });
  const garmentLabels = Object.freeze({ camiseta: 'Camiseta', hoodie: 'Hoodie', sudadera: 'Sudadera', 'crop-top': 'Crop-top' });
  let memberSequence = 0;
  let latestSummary = null;

  const showMode = mode => {
    const team = mode === 'team';
    byId('calc-team-mode').hidden = !team;
    byId('calc-sheet-mode').hidden = team;
    byId('calc-team-tab').classList.toggle('active', team);
    byId('calc-sheet-tab').classList.toggle('active', !team);
    byId('calc-team-tab').setAttribute('aria-selected', String(team));
    byId('calc-sheet-tab').setAttribute('aria-selected', String(!team));
    if (team) calculateTeamQuote();
  };

  const normalizedSize = value => {
    const size = String(value || '').trim().toUpperCase();
    if (['INF', 'INFANTIL', 'NIÑO', 'NIÑA', 'KIDS'].includes(size)) return 'infantil';
    return ['S', 'M', 'L'].includes(size) ? size : 'M';
  };

  const createMemberRow = (member = {}) => {
    const size = normalizedSize(member.size);
    const preset = sizePresets[size];
    const garment = member.garment && garmentLabels[member.garment] ? member.garment : 'camiseta';
    const row = document.createElement('tr');
    row.dataset.memberId = String(++memberSequence);
    row.innerHTML = `
      <td><input class="team-name" type="text" maxlength="24" aria-label="Nombre del integrante" placeholder="Nombre" value=""></td>
      <td><input class="team-number" type="text" inputmode="numeric" maxlength="3" aria-label="Número del integrante" placeholder="00" value=""></td>
      <td><select class="team-garment" aria-label="Prenda"><option value="camiseta"${garment === 'camiseta' ? ' selected' : ''}>Camiseta</option><option value="hoodie"${garment === 'hoodie' ? ' selected' : ''}>Hoodie</option><option value="sudadera"${garment === 'sudadera' ? ' selected' : ''}>Sudadera</option><option value="crop-top"${garment === 'crop-top' ? ' selected' : ''}>Crop-top</option></select></td>
      <td><select class="team-size" aria-label="Talla"><option value="infantil"${size === 'infantil' ? ' selected' : ''}>Infantil</option><option value="S"${size === 'S' ? ' selected' : ''}>S</option><option value="M"${size === 'M' ? ' selected' : ''}>M</option><option value="L"${size === 'L' ? ' selected' : ''}>L</option></select></td>
      <td><input class="team-measure team-name-width" type="number" min="5" max="55" step="0.5" aria-label="Ancho del nombre en centímetros"><span class="sr-only">cm</span></td>
      <td><input class="team-measure team-number-height" type="number" min="5" max="55" step="0.5" aria-label="Alto del número en centímetros"><span class="sr-only">cm</span></td>
      <td><button class="team-remove" type="button" aria-label="Eliminar integrante"><i class="fa-solid fa-trash-can"></i></button></td>`;
    row.querySelector('.team-name').value = String(member.name || '').slice(0, 24);
    row.querySelector('.team-number').value = String(member.number || '').replace(/\D/g, '').slice(0, 3);
    row.querySelector('.team-name-width').value = Number(member.nameWidth) || preset.nameWidth;
    row.querySelector('.team-number-height').value = Number(member.numberHeight) || preset.numberHeight;
    byId('team-roster-body').append(row);
    return row;
  };

  const readMembers = () => [...byId('team-roster-body').querySelectorAll('tr')].map(row => {
    const size = row.querySelector('.team-size').value;
    const preset = sizePresets[size];
    return {
      id: row.dataset.memberId,
      name: row.querySelector('.team-name').value.trim(),
      number: row.querySelector('.team-number').value.trim(),
      garment: row.querySelector('.team-garment').value,
      size,
      nameWidth: Math.max(5, Number(row.querySelector('.team-name-width').value) || preset.nameWidth),
      nameHeight: preset.nameHeight,
      numberHeight: Math.max(5, Number(row.querySelector('.team-number-height').value) || preset.numberHeight)
    };
  });

  const createPieces = members => members.flatMap(member => {
    const pieces = [];
    if (member.name) pieces.push({ label: member.name.toUpperCase(), width: member.nameWidth, height: member.nameHeight, kind: 'name' });
    if (member.number) {
      const digits = member.number.length;
      const width = Math.max(member.numberHeight * 0.55, digits * member.numberHeight * 0.55 + Math.max(0, digits - 1) * 0.8);
      pieces.push({ label: member.number, width, height: member.numberHeight, kind: 'number' });
    }
    return pieces;
  });

  const packPieces = (pieces, rollWidth, gap) => {
    const margin = 0.5;
    const usableWidth = Math.max(1, rollWidth - margin * 2);
    const shelves = [];
    const unplaced = [];
    const sorted = [...pieces].sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height));
    sorted.forEach(piece => {
      const orientations = [{ width: piece.width, height: piece.height, rotated: false }];
      if (Math.abs(piece.width - piece.height) > 0.1) orientations.push({ width: piece.height, height: piece.width, rotated: true });
      let best = null;
      shelves.forEach((shelf, shelfIndex) => orientations.forEach(orientation => {
        if (orientation.height <= shelf.height && shelf.used + (shelf.items.length ? gap : 0) + orientation.width <= usableWidth) {
          const remaining = usableWidth - shelf.used - orientation.width;
          if (!best || remaining < best.remaining) best = { shelf, shelfIndex, orientation, remaining };
        }
      }));
      if (!best) {
        const orientation = orientations.filter(item => item.width <= usableWidth).sort((a, b) => a.height - b.height)[0];
        if (!orientation) {
          unplaced.push(piece);
          return;
        }
        const shelf = { height: orientation.height, used: 0, items: [] };
        shelves.push(shelf);
        best = { shelf, shelfIndex: shelves.length - 1, orientation };
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

  const drawTeamRoll = layout => {
    const canvas = byId('team-roll-preview');
    const context = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#24252a';
    context.fillRect(0, 0, width, height);
    if (!layout.placements.length) {
      context.fillStyle = '#71717a';
      context.font = '700 15px sans-serif';
      context.textAlign = 'center';
      context.fillText('La distribución aparecerá aquí', width / 2, height / 2);
      return;
    }
    const scale = Math.min((width - 24) / layout.rollWidth, (height - 24) / Math.max(10, layout.rawLength));
    const offsetX = (width - layout.rollWidth * scale) / 2;
    const offsetY = 12;
    context.fillStyle = '#f4f4f5';
    context.fillRect(offsetX, offsetY, layout.rollWidth * scale, layout.rawLength * scale);
    layout.placements.forEach((piece, index) => {
      const x = offsetX + piece.x * scale;
      const y = offsetY + piece.y * scale;
      const pieceWidth = piece.width * scale;
      const pieceHeight = piece.height * scale;
      context.fillStyle = piece.kind === 'number' ? '#facc15' : '#fb923c';
      context.fillRect(x, y, pieceWidth, pieceHeight);
      context.strokeStyle = '#18181b';
      context.lineWidth = 1;
      context.strokeRect(x, y, pieceWidth, pieceHeight);
      if (pieceWidth > 24 && pieceHeight > 12) {
        context.save();
        context.translate(x + pieceWidth / 2, y + pieceHeight / 2);
        if (piece.rotated) context.rotate(Math.PI / 2);
        context.fillStyle = '#18181b';
        context.font = `900 ${Math.max(8, Math.min(18, Math.min(pieceWidth, pieceHeight) * 0.45))}px sans-serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(piece.label || String(index + 1), 0, 0, Math.max(pieceWidth, pieceHeight) - 6);
        context.restore();
      }
    });
  };

  const quoteText = summary => {
    const lines = summary.members.map((member, index) => `${index + 1}. ${member.name || 'Sin nombre'} · #${member.number || '—'} · ${garmentLabels[member.garment]} ${member.size === 'infantil' ? 'Infantil' : member.size} · nombre ${member.nameWidth} cm · número ${member.numberHeight} cm`);
    return [
      `*Cotización de equipo · Momotus Core*`,
      `Cliente/equipo: ${summary.customer || 'Sin especificar'}`,
      `Integrantes: ${summary.members.length}`,
      `Piezas DTF: ${summary.pieces}`,
      `Material estimado: ${summary.billedMeters.toFixed(1)} m de ${summary.rollWidth} cm de ancho`,
      `Total sugerido: ${currency.format(summary.total)}`,
      '',
      '*Lista:*',
      ...lines,
      '',
      'Estimación sujeta a revisión final de medidas y archivos.',
      'Momotus Core · momotuscore@gmail.com · 5501-0044'
    ].join('\n');
  };

  function calculateTeamQuote() {
    const members = readMembers();
    const validMembers = members.filter(member => member.name || member.number);
    const pieces = createPieces(validMembers);
    const rollWidth = Math.max(10, Number(byId('team-roll-width').value) || 57);
    const gap = Math.max(0, Number(byId('team-gap').value) || 1);
    const layout = packPieces(pieces, rollWidth, gap);
    const billedMeters = layout.rawLength > 0 ? Math.ceil(layout.rawLength / 10) / 10 : 0;
    const meterCost = Math.max(0, Number(byId('team-meter-cost').value) || 0);
    const pressCost = Math.max(0, Number(byId('team-press-cost').value) || 0);
    const setupCost = Math.max(0, Number(byId('team-setup-cost').value) || 0);
    const profit = Math.min(90, Math.max(0, Number(byId('team-profit').value) || 0)) / 100;
    const productionCost = billedMeters * meterCost + validMembers.length * pressCost + setupCost;
    const total = productionCost > 0 ? productionCost / Math.max(0.1, 1 - profit) : 0;
    const error = byId('team-roster-error');
    if (layout.unplaced.length) {
      const labels = layout.unplaced.slice(0, 3).map(piece => piece.label).join(', ');
      error.textContent = `${layout.unplaced.length} pieza${layout.unplaced.length === 1 ? '' : 's'} no cabe${layout.unplaced.length === 1 ? '' : 'n'} en el rollo de ${rollWidth} cm (${labels}${layout.unplaced.length > 3 ? '…' : ''}). Reducí la medida o escogé un rollo más ancho.`;
      error.hidden = false;
    } else {
      error.hidden = true;
    }
    byId('team-summary-count').textContent = `${validMembers.length} persona${validMembers.length === 1 ? '' : 's'}`;
    byId('team-summary-length').textContent = `${billedMeters.toFixed(1)} m`;
    byId('team-summary-raw').textContent = `${layout.rawLength.toFixed(1)} cm ocupados`;
    byId('team-summary-pieces').textContent = String(pieces.length);
    byId('team-summary-total').textContent = layout.unplaced.length ? 'Revisar medidas' : currency.format(total);
    byId('team-summary-unit').textContent = layout.unplaced.length ? 'Hay piezas que no caben' : validMembers.length && total ? `${currency.format(total / validMembers.length)} por persona` : 'Ingresá tus costos';
    byId('team-summary-status').textContent = layout.unplaced.length
      ? 'La cotización está pausada para evitar calcular menos material del necesario.'
      : validMembers.length
      ? `${pieces.length} piezas organizadas en ${billedMeters.toFixed(1)} metro${billedMeters === 1 ? '' : 's'} facturable${billedMeters === 1 ? '' : 's'} de DTF. Revisá las medidas antes de imprimir.`
      : 'Agregá nombre o número a cada integrante para calcular el pedido.';
    byId('team-copy').disabled = !validMembers.length || layout.unplaced.length > 0;
    byId('team-whatsapp').disabled = !validMembers.length || layout.unplaced.length > 0;
    latestSummary = layout.unplaced.length ? null : { customer: byId('team-customer').value.trim(), members: validMembers, pieces: pieces.length, rawLength: layout.rawLength, billedMeters, rollWidth, productionCost, total };
    drawTeamRoll(layout);
  }

  byId('calc-team-tab').addEventListener('click', () => showMode('team'));
  byId('calc-sheet-tab').addEventListener('click', () => showMode('sheet'));
  window.addEventListener('momotus:quote-sheet', () => showMode('sheet'));

  byId('team-add-member').addEventListener('click', () => {
    const row = createMemberRow({ size: 'M' });
    row.querySelector('.team-name').focus();
    calculateTeamQuote();
  });
  byId('team-roster-body').addEventListener('input', event => {
    if (event.target.matches('.team-number')) event.target.value = event.target.value.replace(/\D/g, '').slice(0, 3);
    calculateTeamQuote();
  });
  byId('team-roster-body').addEventListener('change', event => {
    if (event.target.matches('.team-size')) {
      const row = event.target.closest('tr');
      const preset = sizePresets[event.target.value];
      row.querySelector('.team-name-width').value = preset.nameWidth;
      row.querySelector('.team-number-height').value = preset.numberHeight;
    }
    calculateTeamQuote();
  });
  byId('team-roster-body').addEventListener('click', event => {
    const button = event.target.closest('.team-remove');
    if (!button) return;
    button.closest('tr').remove();
    if (!byId('team-roster-body').querySelector('tr')) createMemberRow({ size: 'M' });
    calculateTeamQuote();
  });
  ['team-customer', 'team-roll-width', 'team-gap', 'team-meter-cost', 'team-press-cost', 'team-setup-cost', 'team-profit'].forEach(id => byId(id).addEventListener('input', calculateTeamQuote));

  byId('team-import-list').addEventListener('click', () => {
    const lines = byId('team-paste-input').value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const error = byId('team-roster-error');
    if (!lines.length) {
      error.textContent = 'Pegá al menos una persona antes de cargar la lista.';
      error.hidden = false;
      return;
    }
    byId('team-roster-body').replaceChildren();
    lines.slice(0, 60).forEach(line => {
      const [name = '', number = '', size = 'M'] = line.split(/[,;\t]/).map(value => value.trim());
      createMemberRow({ name, number, size });
    });
    error.hidden = true;
    byId('team-paste-input').value = '';
    byId('team-paste-input').closest('details').open = false;
    calculateTeamQuote();
  });

  byId('team-example').addEventListener('click', () => {
    byId('team-roster-body').replaceChildren();
    createMemberRow({ name: 'Carlos', number: '10', size: 'M' });
    createMemberRow({ name: 'Luis', number: '7', size: 'S' });
    createMemberRow({ name: 'María', number: '12', size: 'L', garment: 'crop-top' });
    calculateTeamQuote();
  });

  byId('team-copy').addEventListener('click', async () => {
    if (!latestSummary?.members.length) return;
    try {
      await navigator.clipboard.writeText(quoteText(latestSummary));
      byId('team-summary-status').textContent = 'Lista y cotización copiadas. Ya podés pegarlas donde querás.';
    } catch (error) {
      byId('team-summary-status').textContent = 'No se pudo copiar automáticamente. Usá Compartir cotización.';
    }
  });
  byId('team-whatsapp').addEventListener('click', () => {
    if (!latestSummary?.members.length) return;
    window.open(`https://wa.me/50555010044?text=${encodeURIComponent(quoteText(latestSummary))}`, '_blank', 'noopener,noreferrer');
  });

  createMemberRow({ size: 'M' });
  calculateTeamQuote();
  showMode('team');
})();
