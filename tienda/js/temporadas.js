// Temporadas Momotus Core.
// enabled: false oculta una temporada o producto.
// forceVisible: true permite revisar una temporada fuera de su fecha.
// Cada temporada usa un rango anual inclusivo. Al terminar una, la siguiente
// se activa automáticamente si su rango ya comenzó.
(() => {
  'use strict';

  const seasonalEvents = Object.freeze([
    Object.freeze({
      id: 'aguizotes',
      enabled: true,
      forceVisible: false,
      kicker: 'TEMPORADA DE LOS AGÜIZOTES',
      title: 'Leyendas que caminan con vos',
      description: 'Una colección bien nica inspirada en los espantos, relatos y personajes que llenan de misterio las calles de Masaya.',
      icon: 'fa-moon',
      decorations: Object.freeze(['fa-bat', 'fa-moon', 'fa-spider']),
      availabilityLabel: 'Disponible todo octubre',
      schedule: Object.freeze({ startMonth: 10, startDay: 1, endMonth: 10, endDay: 31 }),
      theme: Object.freeze({ accent: '#f97316', accent2: '#7c3aed', background: '#110b16', font: 'Georgia, Times New Roman, serif' }),
      items: Object.freeze([
        Object.freeze({ id: 'cadejo-camiseta', enabled: true, category: 'camiseta', name: 'Cadejo Nocturno', type: 'Camiseta', icon: 'fa-shirt', price: 550, image: 'img/products/seasonal/aguizotes-2026/cadejo-camiseta.webp', description: 'El guardián de los caminos en una edición para andar tu leyenda.' }),
        Object.freeze({ id: 'cegua-hoodie', enabled: true, category: 'hoodie', name: 'La Cegua de Monimbó', type: 'Hoodie', icon: 'fa-vest', price: 1050, image: 'img/products/seasonal/aguizotes-2026/cegua-hoodie.webp', description: 'Una pieza oscura y llamativa inspirada en una de nuestras leyendas más conocidas.' }),
        Object.freeze({ id: 'carreta-sudadera', enabled: true, category: 'sudadera', name: 'Carreta Nagua', type: 'Sudadera', icon: 'fa-shirt', price: 590, image: 'img/products/seasonal/aguizotes-2026/carreta-sudadera.webp', description: 'Diseño de temporada con vibra de medianoche y puro folclore nica.' }),
        Object.freeze({ id: 'mocuana-crop', enabled: true, category: 'crop-top', name: 'Mocuana Encantada', type: 'Crop-top', icon: 'fa-shirt', price: 280, image: 'img/products/seasonal/aguizotes-2026/mocuana-crop-top.webp', description: 'Una versión moderna y misteriosa de la leyenda de La Mocuana.' }),
        Object.freeze({ id: 'combo-cadejo', enabled: true, category: 'combo', combo: true, name: 'Combo Leyenda del Cadejo', type: 'Camiseta + Hoodie', includes: Object.freeze(['Camiseta', 'Hoodie']), icon: 'fa-box-open', price: 1450, image: 'img/products/seasonal/aguizotes-2026/combo-cadejo.webp', description: 'Dos prendas con la misma leyenda para compartir o armar tu propio conjunto.' }),
        Object.freeze({ id: 'combo-monimbo', enabled: true, category: 'combo', combo: true, name: 'Combo Noche de Monimbó', type: 'Camiseta + Crop-top', includes: Object.freeze(['Camiseta', 'Crop-top']), icon: 'fa-box-open', price: 750, image: 'img/products/seasonal/aguizotes-2026/combo-monimbo.webp', description: 'Un combo de temporada para salir combinados con un toque bien de aquí.' })
      ])
    }),
    Object.freeze({
      id: 'navidad',
      enabled: true,
      forceVisible: false,
      kicker: 'TEMPORADA NAVIDEÑA',
      title: 'Navidad con tu propio estilo',
      description: 'Diseños navideños para regalar, estrenar y compartir en familia, con ese toque alegre que nos gusta a los nicas.',
      icon: 'fa-snowflake',
      decorations: Object.freeze(['fa-snowflake', 'fa-gift', 'fa-tree']),
      availabilityLabel: 'Disponible en noviembre y diciembre',
      schedule: Object.freeze({ startMonth: 11, startDay: 1, endMonth: 12, endDay: 31 }),
      theme: Object.freeze({ accent: '#ef4444', accent2: '#22c55e', background: '#07150f', font: 'Trebuchet MS, Arial Rounded MT Bold, sans-serif' }),
      items: Object.freeze([
        Object.freeze({ id: 'navidad-camiseta', enabled: true, category: 'camiseta', name: 'Navidad Pinolera', type: 'Camiseta', icon: 'fa-shirt', price: 550, image: 'img/products/seasonal/navidad-2026/navidad-camiseta.webp', description: 'Una camiseta alegre para celebrar diciembre con sabor bien nica.' }),
        Object.freeze({ id: 'nochebuena-hoodie', enabled: true, category: 'hoodie', name: 'Nochebuena Nica', type: 'Hoodie', icon: 'fa-vest', price: 1050, image: 'img/products/seasonal/navidad-2026/nochebuena-hoodie.webp', description: 'Hoodie de temporada para las noches frescas, los brindis y los buenos momentos.' }),
        Object.freeze({ id: 'brillo-sudadera', enabled: true, category: 'sudadera', name: 'Brillo Navideño', type: 'Sudadera', icon: 'fa-shirt', price: 590, image: 'img/products/seasonal/navidad-2026/brillo-sudadera.webp', description: 'Una sudadera cómoda con detalles festivos para andar diciembre con todo.' }),
        Object.freeze({ id: 'navidad-tropical-crop', enabled: true, category: 'crop-top', name: 'Navidad Tropical', type: 'Crop-top', icon: 'fa-shirt', price: 280, image: 'img/products/seasonal/navidad-2026/navidad-tropical-crop-top.webp', description: 'Un crop-top fresco y navideño pensado para celebrar a nuestro estilo.' }),
        Object.freeze({ id: 'combo-nochebuena', enabled: true, category: 'combo', combo: true, name: 'Combo Nochebuena', type: 'Camiseta + Hoodie', includes: Object.freeze(['Camiseta', 'Hoodie']), icon: 'fa-gift', price: 1450, image: 'img/products/seasonal/navidad-2026/combo-nochebuena.webp', description: 'Dos prendas de temporada para regalar o armar un conjunto navideño.' }),
        Object.freeze({ id: 'combo-navidad-pareja', enabled: true, category: 'combo', combo: true, name: 'Combo Navidad en Pareja', type: 'Camiseta + Crop-top', includes: Object.freeze(['Camiseta', 'Crop-top']), icon: 'fa-gift', price: 750, image: 'img/products/seasonal/navidad-2026/combo-navidad-pareja.webp', description: 'Un combo para compartir la Navidad con diseños que hacen juego.' })
      ])
    })
  ]);

  const filters = Object.freeze([
    Object.freeze({ id: 'all', label: 'Todo' }),
    Object.freeze({ id: 'camiseta', label: 'Camisetas' }),
    Object.freeze({ id: 'hoodie', label: 'Hoodies' }),
    Object.freeze({ id: 'sudadera', label: 'Sudaderas' }),
    Object.freeze({ id: 'crop-top', label: 'Crop-tops' }),
    Object.freeze({ id: 'combo', label: 'Combos' })
  ]);
  const validCategories = new Set(filters.slice(1).map(filter => filter.id));
  const MS_PER_DAY = 86400000;
  const currency = new Intl.NumberFormat('es-NI', { style: 'currency', currency: 'NIO', maximumFractionDigits: 0 });
  let activeEvent = null;
  let activeFilter = 'all';

  const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  const atStartOfDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const eventState = (event, now = new Date()) => {
    const year = now.getFullYear();
    const schedule = event.schedule;
    const start = new Date(year, schedule.startMonth - 1, schedule.startDay);
    const end = new Date(year, schedule.endMonth - 1, schedule.endDay, 23, 59, 59, 999);
    const today = atStartOfDay(now);
    const lastDay = atStartOfDay(end);
    const daysRemaining = Math.max(0, Math.floor((lastDay - today) / MS_PER_DAY) + 1);
    const totalDays = Math.floor((lastDay - atStartOfDay(start)) / MS_PER_DAY) + 1;
    const elapsedDays = Math.max(0, totalDays - daysRemaining);
    const progress = Math.max(0, Math.min(100, elapsedDays / Math.max(1, totalDays) * 100));
    return { visible: event.enabled && (event.forceVisible || (now >= start && now <= end)), start, end, daysRemaining, progress };
  };

  const validate = events => {
    const eventIds = new Set();
    const itemIds = new Set();
    events.forEach(event => {
      if (!event.id || eventIds.has(event.id)) throw new Error(`Temporada inválida o repetida: ${event.id || 'sin ID'}`);
      eventIds.add(event.id);
      if (typeof event.enabled !== 'boolean' || typeof event.forceVisible !== 'boolean') throw new Error(`Visibilidad inválida en ${event.id}`);
      if (!event.title || !event.kicker || !event.description || !event.icon || !event.availabilityLabel || !event.theme?.font) throw new Error(`Contenido incompleto en ${event.id}`);
      if (!Array.isArray(event.decorations) || event.decorations.length < 2 || event.decorations.some(icon => !/^fa-[a-z0-9-]+$/i.test(icon))) throw new Error(`Decoración inválida en ${event.id}`);
      const scheduleValues = [event.schedule?.startMonth, event.schedule?.startDay, event.schedule?.endMonth, event.schedule?.endDay];
      if (!scheduleValues.every(Number.isInteger) || event.schedule.startMonth < 1 || event.schedule.startMonth > 12 || event.schedule.endMonth < 1 || event.schedule.endMonth > 12) throw new Error(`Fecha inválida en ${event.id}`);
      const testStart = new Date(2026, event.schedule.startMonth - 1, event.schedule.startDay);
      const testEnd = new Date(2026, event.schedule.endMonth - 1, event.schedule.endDay);
      if (testStart.getMonth() !== event.schedule.startMonth - 1 || testStart.getDate() !== event.schedule.startDay || testEnd.getMonth() !== event.schedule.endMonth - 1 || testEnd.getDate() !== event.schedule.endDay || testEnd < testStart) throw new Error(`Rango de temporada inválido en ${event.id}`);
      if (![event.theme?.accent, event.theme?.accent2, event.theme?.background].every(color => /^#[0-9a-f]{6}$/i.test(color))) throw new Error(`Colores de tema inválidos en ${event.id}`);
      if (!Array.isArray(event.items) || !event.items.length) throw new Error(`La temporada ${event.id} no tiene productos`);
      event.items.forEach(item => {
        if (!item.id || itemIds.has(item.id)) throw new Error(`Producto de temporada repetido: ${item.id || 'sin ID'}`);
        itemIds.add(item.id);
        if (typeof item.enabled !== 'boolean') throw new Error(`Visibilidad inválida en ${item.id}`);
        if (!validCategories.has(item.category)) throw new Error(`Categoría inválida en ${item.id}`);
        if (!item.name || !item.type || !item.description || !Number.isFinite(item.price) || item.price <= 0) throw new Error(`Datos incompletos en ${item.id}`);
        if (!/^img\/products\/seasonal\/[a-z0-9-]+\/[a-z0-9-]+\.webp$/i.test(item.image)) throw new Error(`Ruta de imagen inválida en ${item.id}`);
        if (Boolean(item.combo) !== (item.category === 'combo')) throw new Error(`Tipo de combo inconsistente en ${item.id}`);
        if (item.category === 'combo' && (!Array.isArray(item.includes) || item.includes.length < 2)) throw new Error(`Combo incompleto en ${item.id}`);
        if (item.category === 'hoodie' && (item.price < 800 || item.price > 1300)) throw new Error(`Precio de hoodie fuera de rango en ${item.id}`);
        if (item.category === 'sudadera' && (item.price < 380 || item.price > 660)) throw new Error(`Precio de sudadera fuera de rango en ${item.id}`);
        if (item.category === 'crop-top' && (item.price < 150 || item.price > 300)) throw new Error(`Precio de crop-top fuera de rango en ${item.id}`);
      });
    });
    return true;
  };

  const publishedItems = event => event.items.filter(item => item.enabled);
  const filteredItems = event => publishedItems(event).filter(item => activeFilter === 'all' || item.category === activeFilter);
  const filterIcon = category => ({ all: 'fa-border-all', camiseta: 'fa-shirt', hoodie: 'fa-vest', sudadera: 'fa-shirt', 'crop-top': 'fa-shirt', combo: 'fa-box-open' })[category] || 'fa-tag';
  const garmentPath = category => ({
    camiseta: '<path d="M35 20 49 10h22l14 10 24 17-13 21-13-8v52H37V50l-13 8-13-21z"/><path class="garment-detail" d="M49 10c3 10 19 10 22 0"/>',
    hoodie: '<path d="M39 29 51 19h18l12 10 27 19-12 21-13-9v42H37V60l-13 9-12-21z"/><path d="M46 25C47 8 54 2 60 2s13 6 14 23L65 38H55z"/><path class="garment-detail" d="M48 86h24M60 39v30"/>',
    sudadera: '<path d="M37 18 49 10h22l12 8 32 23-12 21-20-13v53H37V49L17 62 5 41z"/><path class="garment-detail" d="M49 10c3 10 19 10 22 0M38 92h44"/>',
    'crop-top': '<path d="M35 20 49 10h22l14 10 24 17-13 21-13-8v31H37V50l-13 8-13-21z"/><path class="garment-detail" d="M49 10c3 10 19 10 22 0M38 75h44"/>'
  })[category] || '';
  const garmentSilhouette = item => {
    const categoryByLabel = { Camiseta: 'camiseta', Hoodie: 'hoodie', Sudadera: 'sudadera', 'Crop-top': 'crop-top' };
    const categories = item.combo ? item.includes.map(label => categoryByLabel[label]).filter(Boolean) : [item.category];
    return `<div class="seasonal-garments${item.combo ? ' is-combo' : ''}" aria-hidden="true">${categories.map(category => `<svg viewBox="0 0 120 112" focusable="false" data-garment="${escapeHtml(category)}">${garmentPath(category)}</svg>`).join('')}</div>`;
  };

  const renderBadges = event => {
    const badges = document.getElementById('seasonal-badges');
    const categories = [...new Set(publishedItems(event).map(item => item.category))];
    badges.innerHTML = categories.map(category => {
      const filter = filters.find(entry => entry.id === category);
      return `<span><i class="fa-solid ${filterIcon(category)}" aria-hidden="true"></i>${escapeHtml(filter?.label || category)}</span>`;
    }).join('');
  };

  const renderFilters = event => {
    const items = publishedItems(event);
    const container = document.getElementById('seasonal-filters');
    container.innerHTML = filters.map(filter => {
      const count = filter.id === 'all' ? items.length : items.filter(item => item.category === filter.id).length;
      if (!count) return '';
      const active = filter.id === activeFilter;
      return `<button type="button" class="${active ? 'active' : ''}" data-season-filter="${filter.id}" aria-pressed="${active}"><i class="fa-solid ${filterIcon(filter.id)}" aria-hidden="true"></i> ${escapeHtml(filter.label)} <span>${count}</span></button>`;
    }).join('');
  };

  const hydrateImages = container => {
    container.querySelectorAll('img[data-season-src]').forEach(image => {
      const card = image.closest('.seasonal-card');
      image.addEventListener('load', () => card?.classList.add('has-image'), { once: true });
      image.addEventListener('error', () => {
        image.hidden = true;
        card?.classList.add('image-missing');
      }, { once: true });
      image.src = image.dataset.seasonSrc;
      image.removeAttribute('data-season-src');
    });
  };

  const renderCards = () => {
    if (!activeEvent) return;
    const products = document.getElementById('seasonal-products');
    const items = filteredItems(activeEvent);
    products.innerHTML = items.map(item => `
      <article class="seasonal-card${item.combo ? ' combo' : ''}" data-season-item="${escapeHtml(item.id)}" data-season-category="${escapeHtml(item.category)}">
        <div class="seasonal-card-media">
          <div class="seasonal-card-placeholder">${garmentSilhouette(item)}<span>Mockup en preparación · prenda disponible</span></div>
          <img data-season-src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}" width="640" height="480" loading="lazy" decoding="async">
          <span class="seasonal-card-type">${item.combo ? 'COMBO · ' : ''}${escapeHtml(item.type)}</span>
          <span class="seasonal-card-state">EDICIÓN LIMITADA</span>
        </div>
        <div class="seasonal-card-content">
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.description)}</p>
          ${item.includes ? `<div class="seasonal-card-includes">${item.includes.map(included => `<span><i class="fa-solid fa-check" aria-hidden="true"></i> ${escapeHtml(included)}</span>`).join('')}</div>` : ''}
          <div class="seasonal-card-meta"><span class="seasonal-card-price"><small>Desde</small><strong>${currency.format(item.price)}</strong></span><button type="button" data-season-order="${escapeHtml(item.id)}"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i> Consultar</button></div>
        </div>
      </article>`).join('');
    hydrateImages(products);
    const empty = document.getElementById('seasonal-empty');
    empty.hidden = items.length > 0;
    document.getElementById('seasonal-results').textContent = `${items.length} diseño${items.length === 1 ? '' : 's'}`;
  };

  const setFilter = filter => {
    if (!filters.some(entry => entry.id === filter)) return;
    activeFilter = filter;
    renderFilters(activeEvent);
    renderCards();
  };

  const renderSeason = (now = new Date()) => {
    const section = document.getElementById('seasonal-event');
    if (!section) return;
    try {
      validate(seasonalEvents);
    } catch (error) {
      console.error('No se pudo mostrar la temporada:', error);
      section.hidden = true;
      return;
    }
    const matches = seasonalEvents
      .map(event => ({ event, state: eventState(event, now) }))
      .filter(entry => entry.state.visible)
      .sort((left, right) => left.state.end - right.state.end);
    if (!matches.length) {
      activeEvent = null;
      section.hidden = true;
      return;
    }
    const { event, state } = matches[0];
    activeEvent = event;
    activeFilter = 'all';
    section.style.setProperty('--season-accent', event.theme.accent);
    section.style.setProperty('--season-accent-2', event.theme.accent2);
    section.style.setProperty('--season-bg', event.theme.background);
    section.style.setProperty('--season-display-font', event.theme.font);
    section.dataset.season = event.id;
    const atmosphere = section.querySelector('.seasonal-atmosphere');
    if (atmosphere) atmosphere.innerHTML = '<span></span><span></span><span></span>' + event.decorations.map(icon => `<i class="fa-solid ${escapeHtml(icon)}"></i>`).join('');
    document.getElementById('seasonal-emblem').innerHTML = `<i class="fa-solid ${escapeHtml(event.icon)}"></i>`;
    document.getElementById('seasonal-kicker').textContent = event.kicker;
    document.getElementById('seasonal-title').textContent = event.title;
    document.getElementById('seasonal-description').textContent = event.description;
    document.getElementById('seasonal-date-label').textContent = event.availabilityLabel;
    document.getElementById('seasonal-countdown-value').textContent = state.daysRemaining > 1 ? `${state.daysRemaining} días disponibles` : 'Último día disponible';
    document.getElementById('seasonal-progress-fill').style.width = `${state.progress.toFixed(1)}%`;
    renderBadges(event);
    renderFilters(event);
    renderCards();
    section.hidden = false;
  };

  document.getElementById('seasonal-filters')?.addEventListener('click', event => {
    const button = event.target.closest('[data-season-filter]');
    if (button) setFilter(button.dataset.seasonFilter);
  });
  document.getElementById('seasonal-products')?.addEventListener('click', event => {
    const button = event.target.closest('[data-season-order]');
    if (!button || !activeEvent) return;
    const item = activeEvent.items.find(entry => entry.id === button.dataset.seasonOrder && entry.enabled);
    if (!item) return;
    const message = [
      `Hola, quiero consultar por la temporada *${activeEvent.kicker}*:`,
      `Producto: ${item.name}`,
      `Tipo: ${item.type}`,
      `Precio mostrado: ${currency.format(item.price)}`,
      '',
      'Quiero confirmar tallas, colores y disponibilidad.'
    ].join('\n');
    window.open(`https://wa.me/50555010044?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  });
  const scrollProducts = distance => {
    const products = document.getElementById('seasonal-products');
    if (typeof products.scrollBy === 'function') products.scrollBy({ left: distance, behavior: 'smooth' });
    else products.scrollLeft += distance;
  };
  document.getElementById('seasonal-prev')?.addEventListener('click', () => scrollProducts(-360));
  document.getElementById('seasonal-next')?.addEventListener('click', () => scrollProducts(360));
  document.getElementById('seasonal-catalog-link')?.addEventListener('click', () => {
    const catalog = document.getElementById('catalog-grid-title');
    if (!catalog) return;
    catalog.scrollIntoView({ behavior: 'smooth', block: 'start' });
    catalog.focus({ preventScroll: true });
  });

  globalThis.MomotusSeasonal = Object.freeze({ events: seasonalEvents, eventState, validate, render: renderSeason });
  renderSeason();
})();
