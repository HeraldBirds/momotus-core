(() => {
  'use strict';

  const optimizeImages = () => {
    const images = document.querySelectorAll('img');
    images.forEach((image, index) => {
      if (!image.hasAttribute('decoding')) image.decoding = 'async';
      const isPriority = image.getAttribute('fetchpriority') === 'high'
        || image.closest('[data-priority-image], .hero-section, .store-hero');
      if (!isPriority && index > 0 && !image.hasAttribute('loading')) image.loading = 'lazy';
    });
  };

  const registerServiceWorker = () => {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    const register = () => navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href, {
      scope: new URL('./', document.baseURI).pathname
    }).catch(error => console.warn('La caché sin conexión no pudo iniciarse.', error));
    if ('requestIdleCallback' in window) window.requestIdleCallback(register, { timeout: 3000 });
    else setTimeout(register, 1200);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', optimizeImages, { once: true });
  else optimizeImages();
  window.addEventListener('load', registerServiceWorker, { once: true });
})();
