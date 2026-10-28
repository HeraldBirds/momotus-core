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
      const now=()=>globalThis.performance?.now?.()||Date.now(),started=now();
      script.onload = () => { if(typeof CustomEvent==='function')window.dispatchEvent?.(new CustomEvent('momotus:module-loaded',{detail:{source,ms:now()-started}}));resolve(); };
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
    window.MomotusToolsAPI?.showToast('No se pudo abrir el módulo. Volvé a pulsar su botón para reintentar.');
    const message = document.getElementById('halftone-result-info');
    if (message) message.textContent = 'No se pudo abrir este módulo. Actualizá la página con Ctrl + F5.';
  };

  let halftoneAdvanced=null,advancedPromise=null;
  const loadHalftoneAdvanced=()=>halftoneAdvanced||(halftoneAdvanced=Promise.all([loadStyle('herramientas/css/tools-halftone.css'),loadScript('herramientas/js/tools-recovery.js').then(()=>loadScript('herramientas/js/tools-halftone-project.js')),loadScript('herramientas/js/tools-halftone-edit-core.js')]).then(()=>loadScript('herramientas/js/tools-halftone-ui.js')).then(()=>loadScript('herramientas/js/tools-halftone-colors-ui.js')).catch(e=>{halftoneAdvanced=null;throw e;}));
  const loadAdvanced=()=>advancedPromise||(advancedPromise=loadHalftoneAdvanced().then(()=>Promise.all([loadStyle('herramientas/css/tools-quality-studio.css'),loadScript('herramientas/js/tools-quality-project.js')])).then(()=>loadScript('herramientas/js/tools-quality-ui.js')).then(()=>loadScript('herramientas/js/tools-color-zones-core.js')).then(()=>loadStyle('herramientas/css/tools-refinement.css')).then(()=>loadScript('herramientas/js/tools-refinement.js')).catch(e=>{advancedPromise=null;throw e;}));
  let refinementPromise=null;const loadRefinement=()=>refinementPromise||(refinementPromise=loadScript('herramientas/js/tools-color-zones-core.js').then(()=>loadStyle('herramientas/css/tools-refinement.css')).then(()=>loadScript('herramientas/js/tools-refinement.js')).catch(e=>{refinementPromise=null;throw e;}));
  const loadForTool=target=>target==='mejorar-calidad'?loadAdvanced():target==='semitonos'?loadHalftoneAdvanced().then(()=>loadRefinement().catch(e=>console.warn('Las ayudas opcionales pueden reintentarse al abrir la herramienta.',e))):Promise.resolve();
  window.MomotusEnsureTool=loadForTool;
  window.addEventListener('momotus:tool-selected',e=>loadForTool(e.detail.target).catch(reportError));

  let zonesPromise = null, zonesReady = false;
  const loadColorZones = () => {
    if (!zonesPromise) zonesPromise = Promise.all([
      loadStyle('herramientas/css/tools-color-zones.css'),
      loadStyle('herramientas/css/tools-refinement.css'),
      loadScript('herramientas/js/tools-recovery.js').then(()=>loadScript('herramientas/js/tools-color-zones-core.js')).then(() => loadScript('herramientas/js/tools-raster-project.js')).then(() => loadScript('herramientas/js/tools-color-zones.js'))
    ]).then(() => { zonesReady = true; }).catch(error => { zonesPromise = null; throw error; });
    return zonesPromise;
  };

  let extraPromise = null;
  let extraReady = false, extraRequest = 0;
  const loadExtra = () => {
    if (!extraPromise) extraPromise = loadScript('herramientas/js/tools-extra.js').then(() => { extraReady = true; }).catch(error => { extraPromise = null; throw error; });
    return extraPromise;
  };

  let vectorPromise = null, vectorReady = false;
  const loadVector = () => {
    if (!vectorPromise) vectorPromise = Promise.all([loadStyle('herramientas/css/tools-vector-pro.css'), loadScript('herramientas/vendor/paper/paper-core.min.js').then(() => loadScript('herramientas/js/tools-vector-pro-core.js')).then(() => loadScript('herramientas/js/tools-vector-edit-core.js')).then(() => loadScript('herramientas/js/tools-vector-advanced.js'))]).then(() => loadScript('herramientas/js/tools-vector-pro.js')).then(() => { vectorReady = true; }).catch(error => { vectorPromise = null; throw error; });
    return vectorPromise;
  };
  window.addEventListener('momotus:vector-import', event => {
    const file = event.detail?.file;
    if (!file) return;
    loadExtra().then(loadVector).then(async () => {
      document.querySelector('[data-extra-tool="vectorizacion"]').click();
      await window.MomotusVectorAPI.acceptFile(file);
    }).catch(reportError);
  });

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

  let effectsPromise = null;
  const loadEffects = () => {
    if (!effectsPromise) effectsPromise = Promise.all([
      loadStyle('herramientas/css/tools-effects.css'),
      loadScript('herramientas/js/tools-halftone-core.js').then(()=>loadScript('herramientas/js/tools-effects-edit-core.js')).then(()=>loadScript('herramientas/js/tools-effects-core.js')).then(() => loadScript('herramientas/js/tools-effects.js'))
    ]).catch(error => { effectsPromise = null; throw error; });
    return effectsPromise;
  };

  const installMockupLauncher=()=>{const actions=document.querySelector('.tool-history-actions');if(!actions)return;const b=document.createElement('button');b.type='button';b.className='mockup-loader';b.textContent='Colocar en mockup';b.onclick=async()=>{const request=extraRequest;b.disabled=true;try{await loadMockup();b.remove();if(request===extraRequest)document.getElementById('mockup-transfer-open')?.click();}catch(e){b.disabled=false;reportError(e);}};actions.append(b);};

  const installProductionLauncher = () => {
    const actions = document.querySelector('.tool-history-actions');
    if (!actions || actions.querySelector('.production-loader')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'production-loader';
    button.title = 'Abrir preparación avanzada, planchas y proyectos';
    button.innerHTML = '<i class="fa-solid fa-industry" aria-hidden="true"></i><span>Producción DTF</span>';
    button.addEventListener('click', async () => {
      const request=extraRequest;
      button.disabled = true;
      button.classList.add('is-loading');
      try {
        await loadProduction();
        button.remove();
        if(request===extraRequest)document.querySelector('.production-launch')?.click();
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
    const navigation=target?.closest('[data-extra-tool], [data-tool-target]');
    if(navigation)extraRequest++;
    const zonesButton = target?.closest('#background-zones-open');
    if (zonesButton && !zonesReady) {
      const request=extraRequest;
      event.preventDefault();
      event.stopImmediatePropagation();
      zonesButton.disabled = true;
      zonesButton.classList.add('is-loading');
      loadColorZones().then(() => {
        zonesButton.disabled = false;
        zonesButton.classList.remove('is-loading');
        if(request===extraRequest)zonesButton.click();
      }).catch(error => {
        zonesButton.disabled = false;
        zonesButton.classList.remove('is-loading');
        console.error('No se pudo cargar el editor por zonas:', error);
        const status = document.getElementById('background-status');
        if (status) status.textContent = 'No se pudo abrir Zonas. Volvé a pulsar Editar color por zonas para reintentar.';
      });
      return;
    }
    const extraButton = target?.closest('[data-extra-tool]');
    if (extraButton && (!extraReady || extraButton.dataset.extraTool === 'vectorizacion' && !vectorReady)) {
      const request = extraRequest;
      event.preventDefault();
      event.stopImmediatePropagation();
      extraButton.classList.add('is-loading');
      loadExtra().then(() => extraButton.dataset.extraTool === 'vectorizacion' ? loadVector() : undefined).then(() => {
        extraButton.classList.remove('is-loading');
        if (request === extraRequest) extraButton.click();
      }).catch(error => {
        extraButton.classList.remove('is-loading');
        reportError(error);
      });
      return;
    }
    const backgroundButton = target?.closest('[data-tool-target="eliminar-fondo"]');
    if (backgroundButton) loadStyle('herramientas/css/tools-background-palette.css').catch(reportError);
  }, true);

  let calculatorPromise=null;const loadCalculator=()=>calculatorPromise||(calculatorPromise=Promise.all([loadStyle('herramientas/css/tools-calculator.css'),loadScript('herramientas/js/tools-calculator-core.js')]).then(()=>loadScript('herramientas/js/tools-calculator-ui.js')).catch(e=>{calculatorPromise=null;throw e;}));
  window.addEventListener('momotus:extra-tool', event => {
    if(event.detail?.target==='calculadora-dtf')loadCalculator().catch(reportError);
    if (event.detail?.target === 'tipografias') {
      const frame=document.getElementById('typography-frame');
      if(!frame.hasAttribute('src')) frame.src=frame.dataset.src;
    }
    if (event.detail?.target === 'efectos-dtf') loadEffects().catch(error => {
      const status = document.getElementById('effects-status');
      if (status) status.textContent = 'No se pudo cargar Efectos. Volvé a pulsar la herramienta para reintentar.';
      reportError(error);
    });
  });

  window.addEventListener('momotus:quote-sheet',event=>{if(event.detail?.references)loadExtra().then(()=>loadCalculator()).then(()=>{document.querySelector('[data-extra-tool="calculadora-dtf"]').click();return window.MomotusCalculatorAPI.importSheet(event.detail);}).catch(reportError);});
  window.MomotusSendMeasurements=async(detail,mode='sheet')=>{
    const measures=window.MomotusPrecisionCore.validateMeasure(detail);
    await loadExtra();await loadCalculator();
    if(document.body.classList.contains('production-open'))document.getElementById('production-close')?.click();
    document.querySelector('[data-extra-tool="calculadora-dtf"]').click();
    window.dispatchEvent(new CustomEvent('momotus:quote-measurements',{detail:{...measures,mode:'sheet'}}));
  };
  window.MomotusReceiveTypography=async(detail,target)=>{
    if(!['effects','production','calculator'].includes(target)||Object.prototype.toString.call(detail?.blob)!=='[object Blob]'||detail.blob.type!=='image/png'||detail.blob.size>24*1024*1024)throw Error('PNG de transferencia no válido o superior a 24 MB.');
    const {widthCm,heightCm}=detail;if(!Number.isFinite(widthCm)||!Number.isFinite(heightCm)||widthCm<=0||heightCm<=0)throw Error('Medidas no válidas.');
    const image=await createImageBitmap(detail.blob);try{
      if(image.width*image.height>64000000||Math.max(image.width,image.height)>16384)throw Error('La herramienta de destino admite hasta 64 MP y 16384 px por lado. Reducí las medidas o enviá una parte del diseño.');
      if(Math.abs(image.width-Math.round(widthCm/2.54*300))>1||Math.abs(image.height-Math.round(heightCm/2.54*300))>1)throw Error('Las medidas no coinciden con el PNG de 300 DPI.');
      const file=new File([detail.blob],'momotus-tipografia.png',{type:'image/png'});
      await loadExtra();
      if(target==='calculator'){await loadCalculator();await window.MomotusCalculatorAPI.acceptComposition(file,widthCm,heightCm);document.querySelector('[data-extra-tool="calculadora-dtf"]').click();}
      else if(target==='effects'){
        if(widthCm<1||widthCm>65)throw Error('Efectos admite anchos de 1 a 65 cm.');
        await loadEffects();if(window.MomotusEffectsAPI.isBusy())throw Error('Esperá el proceso actual de Efectos.');
        await window.MomotusEffectsAPI.acceptFile(file);
        const field=document.getElementById('effects-width');field.value=widthCm;field.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-extra-tool="efectos-dtf"]').click();
      }else{if(image.width*image.height>36000000||Math.max(image.width,image.height)>8000)throw Error('Producción admite hasta 36 MP y 8000 px por lado. El diseño no se ha reducido.');await loadProduction();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;canvas.getContext('2d').drawImage(image,0,0);window.dispatchEvent(new CustomEvent('momotus:production-import-canvas',{detail:{canvas,filename:'momotus-tipografia'}}));}
      return true;
    }finally{image.close();}
  };
  const openHashTool = async hash => {
    if (!['vectorizacion','calculadora-dtf','efectos-dtf','tipografias'].includes(hash)) return;
    const request=++extraRequest;
    await loadExtra();
    if (hash === 'vectorizacion') await loadVector();
    if(request===extraRequest)document.querySelector(`[data-extra-tool="${hash}"]`)?.click();
  };
  window.addEventListener('hashchange',()=>openHashTool(location.hash.slice(1)).catch(reportError));
  const startupSources = [
    'js/workflow-bridge.js', 'herramientas/js/tools-shell.js',
    'herramientas/js/tools-transfer.js', 'herramientas/js/tools-halftone-core.js', 'herramientas/js/tools-quality-core.js', 'herramientas/js/tools.js',
    'herramientas/js/tools-studio.js', 'herramientas/js/tools-precision-core.js',
    'herramientas/js/tools-precision.js'
  ];
  for (const source of startupSources) {
    const hint = document.createElement('link');
    hint.rel = 'preload';hint.as = 'script';hint.href = `${source}?v=${version}`;
    document.head.appendChild(hint);
  }
  const start = async () => {
    try {
      await loadScript('js/workflow-bridge.js');
      await loadScript('herramientas/js/tools-shell.js');
      await loadScript('herramientas/js/tools-transfer.js');
      await loadScript('herramientas/js/tools-halftone-core.js').catch(error=>console.warn('Semitonos podrá reintentarse al recargar.',error));
      await loadScript('herramientas/js/tools-quality-core.js').catch(error=>console.warn('Calidad podrá reintentarse al recargar.',error));
      await loadScript('herramientas/js/editor-interactions.js');
      await loadScript('herramientas/js/tools.js');
      await loadScript('herramientas/js/tools-drop-upload.js').catch(error => console.warn('No se activó la carga por arrastre.', error));
      await loadScript('herramientas/js/tools-studio.js');
      await loadScript('herramientas/js/tools-precision-core.js');
      await loadScript('herramientas/js/tools-precision.js');
      installProductionLauncher();
      await loadScript('herramientas/js/tools-recovery.js');
      await loadScript('herramientas/js/tools-support.js');
      try {
        await loadScript('herramientas/js/selection-core.js');
        await loadStyle('herramientas/css/tools-workbench.css');
        await loadScript('herramientas/js/selection-studio.js');
        if(!window.MomotusSelectionStudio)throw Error('La selección compartida no inició.');
        await loadScript('herramientas/js/tools-workbench.js');
      } catch(error) {
        console.warn('Las ayudas de manejo no se cargaron; los editores siguen disponibles.',error);
        window.MomotusToolsAPI?.showToast('Las ayudas de selección no se cargaron. Recargá para reintentar.');
      }
      await loadForTool(['semitonos','mejorar-calidad','eliminar-fondo'].includes(requestedHash)?requestedHash:'semitonos').catch(reportError);

      const params = new URLSearchParams(location.search);
      if (params.get('importar') === 'disenador') {
        if ((params.get('herramienta') || 'background') === 'background') {
          await loadStyle('herramientas/css/tools-background-palette.css');
        }
        await loadMockup();
      }
      else installMockupLauncher();

      await openHashTool(requestedHash);
    } catch (error) {
      reportError(error);
    }
  };

  start();
})();
