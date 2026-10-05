(() => {
  'use strict';

  if (!window.MOMOTUS_TOOLS_DESKTOP) return;

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
    if (!extraPromise) extraPromise = loadScript('herramientas/js/tools-extra.js');
    return extraPromise;
  };

  let productionPromise = null;
  const loadProduction = async () => {
    if (!productionPromise) {
      productionPromise = Promise.all([
        loadStyle('herramientas/css/tools-production.css'),
        loadScript('herramientas/js/tools-production.js')
      ]);
    }
    return productionPromise;
  };

  let mockupPromise = null;
  const loadMockup = async () => {
    if (!mockupPromise) {
      mockupPromise = Promise.all([
        loadStyle('herramientas/css/tools-mockup.css'),
        loadScript('herramientas/js/tools-mockup.js')
      ]);
    }
    return mockupPromise;
  };

  let teamQuotePromise = null;
  const loadTeamQuote = () => {
    if (!teamQuotePromise) {
      teamQuotePromise = Promise.all([
        loadStyle('herramientas/css/tools-team-quote.css'),
        loadScript('herramientas/js/tools-team-quote.js')
      ]);
    }
    return teamQuotePromise;
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
      }).catch(reportError);
      return;
    }
    const backgroundButton = target?.closest('[data-tool-target="eliminar-fondo"]');
    if (backgroundButton) loadStyle('herramientas/css/tools-background-palette.css').catch(reportError);
  }, true);

  window.addEventListener('momotus:extra-tool', event => {
    if (event.detail?.target === 'calculadora-dtf') loadTeamQuote().catch(reportError);
  });

  const start = async () => {
    try {
      await loadScript('js/workflow-bridge.js');
      await loadScript('herramientas/js/tools-shell.js');
      await loadScript('herramientas/js/tools.js');
      await loadScript('herramientas/js/tools-studio.js');
      installProductionLauncher();

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

      const hash = location.hash.slice(1);
      if (hash === 'vectorizacion' || hash === 'calculadora-dtf') {
        await loadExtra();
        document.querySelector(`[data-extra-tool="${hash}"]`)?.click();
      }
    } catch (error) {
      reportError(error);
    }
  };

  start();
})();
