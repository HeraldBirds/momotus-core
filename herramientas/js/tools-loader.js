(() => {
  'use strict';

  if (!window.MOMOTUS_TOOLS_DESKTOP) return;

  const requestedHash = location.hash.slice(1);
  const version = encodeURIComponent(window.MOMOTUS_TOOLS_VERSION || '1');
  const scripts = new Map();
  const styles = new Map();

  const loadScript = source => {
    if (scripts.has(source)) return scripts.get(source);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `${source}?v=${version}`;
      script.defer = true;
      script.onload = resolve;
      script.onerror = () => {
        scripts.delete(source);
        script.remove();
        reject(new Error(`No se pudo cargar ${source}`));
      };
      document.body.appendChild(script);
    });
    scripts.set(source, promise);
    return promise;
  };

  const loadStyle = source => {
    if (styles.has(source)) return styles.get(source);
    const promise = new Promise((resolve, reject) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${source}?v=${version}`;
      link.media = '(min-width: 1024px)';
      link.onload = resolve;
      link.onerror = () => {
        styles.delete(source);
        link.remove();
        reject(new Error(`No se pudo cargar ${source}`));
      };
      document.head.appendChild(link);
    });
    styles.set(source, promise);
    return promise;
  };

  const reportError = error => {
    console.error('No se pudieron cargar las herramientas:', error);
    const message = document.getElementById('halftone-result-info');
    if (message) message.textContent = 'No se pudo abrir este módulo. Actualizá la página con Ctrl + F5.';
  };

  let extraPromise = null;
  const loadExtra = () => {
    if (!extraPromise) extraPromise = loadScript('herramientas/js/tools-vector-core.js').then(() => loadScript('herramientas/js/tools-extra.js')).catch(error => { extraPromise = null; throw error; });
    return extraPromise;
  };

  let productionPromise = null;
  const loadProduction = async () => {
    if (!productionPromise) {
      productionPromise = Promise.all([
        loadStyle('herramientas/css/tools-production.css'),
        loadScript('herramientas/js/tools-production.js')
      ]).catch(error => { productionPromise = null; throw error; });
    }
    return productionPromise;
  };

  let mockupPromise = null;
  const loadMockup = async () => {
    if (!mockupPromise) {
      mockupPromise = Promise.all([
        loadStyle('herramientas/css/tools-mockup.css'),
        loadScript('herramientas/js/tools-mockup.js')
      ]).catch(error => { mockupPromise = null; throw error; });
    }
    return mockupPromise;
  };

  let teamQuotePromise = null;
  const loadTeamQuote = () => {
    if (!teamQuotePromise) {
      teamQuotePromise = Promise.all([
        loadStyle('herramientas/css/tools-team-quote.css'),
        loadScript('herramientas/js/tools-team-quote.js')
      ]).catch(error => { teamQuotePromise = null; throw error; });
    }
    return teamQuotePromise;
  };

  let effectsPromise = null;
  const loadEffects = () => {
    if (!effectsPromise) effectsPromise = Promise.all([
      loadStyle('herramientas/css/tools-effects.css'),
      loadScript('herramientas/js/tools-effects-core.js').then(() => loadScript('herramientas/js/tools-effects.js'))
    ]).catch(error => { effectsPromise = null; throw error; });
    return effectsPromise;
  };

  window.MomotusOpenEffects = async (canvas, filename) => {
    const from=document.getElementById('production-studio') && !document.getElementById('production-studio').hidden ? 'production' : window.MomotusToolsAPI.getActiveType();
    if (!await window.MomotusReviewTransfer(canvas,'effects',filename,from)) return false;
    await loadExtra(); await loadEffects();
    window.MomotusRememberTransfer(from,'effects');
    document.querySelector('[data-extra-tool="efectos-dtf"]')?.click();
    return window.MomotusEffectsAPI.importCanvas(canvas, filename);
  };
  window.MomotusEffectsToProduction = async (canvas, filename) => {
    if (!await window.MomotusReviewTransfer(canvas,'production',filename,'effects')) return false;
    await loadProduction();
    window.MomotusRememberTransfer('effects','production');
    window.dispatchEvent(new CustomEvent('momotus:production-import-canvas',{detail:{canvas,filename}}));
    return true;
  };
  const installEffectsLauncher = () => {
    const button=document.createElement('button');button.type='button';button.className='effects-apply-launch';button.textContent='Aplicar efectos';
    button.addEventListener('click',async()=>{button.disabled=true;try{const type=window.MomotusToolsAPI.getActiveType();const canvas=await window.MomotusToolsAPI.getResultCanvas(type);if(!canvas)throw Error('Primero cargá una imagen en la herramienta activa.');await window.MomotusOpenEffects(canvas,window.MomotusToolsAPI.getDocumentInfo(type)?.filename);}catch(error){window.showToast?.(error.message);}finally{button.disabled=false;}});
    document.querySelector('.tool-history-actions')?.append(button);
  };

  const installProductionLauncher = () => {
    const actions = document.querySelector('.tool-history-actions');
    if (!actions || actions.querySelector('.production-loader')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'production-loader';
    button.title = 'Abrir preparación avanzada, planchas y proyectos';
    button.innerHTML = '<i class="fa-solid fa-industry" aria-hidden="true"></i><span>Producción DTF</span>';
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.classList.add('is-loading');
      try {
        await loadProduction();
        button.remove();
        document.querySelector('.production-launch')?.click();
      } catch (error) {
        button.disabled = false;
        button.classList.remove('is-loading');
        reportError(error);
      }
    });
    actions.prepend(button);
  };

  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target : null;
    const extraButton = target?.closest('[data-extra-tool]');
    if (extraButton && !scripts.has('herramientas/js/tools-extra.js')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      extraButton.classList.add('is-loading');
      loadExtra().then(() => {
        extraButton.classList.remove('is-loading');
        extraButton.click();
      }).catch(error => {
        extraButton.classList.remove('is-loading');
        reportError(error);
      });
      return;
    }
    const backgroundButton = target?.closest('[data-tool-target="eliminar-fondo"]');
    if (backgroundButton) loadStyle('herramientas/css/tools-background-palette.css').catch(reportError);
  }, true);

  window.addEventListener('momotus:extra-tool', event => {
    if (event.detail?.target === 'calculadora-dtf') loadTeamQuote().catch(reportError);
    if (event.detail?.target === 'efectos-dtf') loadEffects().catch(error => {
      const status = document.getElementById('effects-status');
      if (status) status.textContent = 'No se pudo cargar Efectos. Volvé a pulsar la herramienta para reintentar.';
      reportError(error);
    });
  });

  window.MomotusSendMeasurements=async(detail,mode='team')=>{
    const measures=window.MomotusPrecisionCore.validateMeasure(detail);
    await loadExtra();await loadTeamQuote();
    if(document.body.classList.contains('production-open'))document.getElementById('production-close')?.click();
    document.querySelector('[data-extra-tool="calculadora-dtf"]').click();
    window.dispatchEvent(new CustomEvent('momotus:quote-measurements',{detail:{...measures,mode}}));
  };
  const start = async () => {
    try {
      await loadScript('js/workflow-bridge.js');
      await loadScript('herramientas/js/tools-shell.js');
      await loadScript('herramientas/js/tools-transfer.js');
      await loadScript('herramientas/js/tools.js');
      await loadScript('herramientas/js/tools-studio.js');
      await loadScript('herramientas/js/tools-precision-core.js');
      await loadScript('herramientas/js/tools-precision.js');
      installProductionLauncher();
      installEffectsLauncher();

      const params = new URLSearchParams(location.search);
      if (params.get('importar') === 'disenador') {
        if ((params.get('herramienta') || 'background') === 'background') {
          await loadStyle('herramientas/css/tools-background-palette.css');
        }
        await loadMockup();
      }
      else {
        const idleLoad = () => loadMockup().catch(reportError);
        if ('requestIdleCallback' in window) window.requestIdleCallback(idleLoad, { timeout: 4000 });
        else setTimeout(idleLoad, 2500);
      }

      const hash = requestedHash;
      if (hash === 'vectorizacion' || hash === 'calculadora-dtf' || hash === 'efectos-dtf') {
        await loadExtra();
        document.querySelector(`[data-extra-tool="${hash}"]`)?.click();
      }
    } catch (error) {
      reportError(error);
    }
  };

  start();
})();
