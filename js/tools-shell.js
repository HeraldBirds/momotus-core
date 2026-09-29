(() => {
  'use strict';

  const readCartCount = () => {
    try {
      const cart = JSON.parse(localStorage.getItem('momotusCart') || '[]');
      return Array.isArray(cart) ? cart.reduce((total, item) => total + Math.max(1, Number(item.quantity) || 1), 0) : 0;
    } catch (error) {
      console.warn('No se pudo recuperar el contador del carrito.', error);
      return 0;
    }
  };

  window.showToast = message => {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-800 border-l-4 border-yellow-400 px-8 py-4 rounded-3xl flex items-center gap-4 shadow-2xl z-[200]';
      toast.innerHTML = '<i class="fa-solid fa-check-circle text-green-400 text-2xl" aria-hidden="true"></i><span id="toast-text" class="font-medium"></span>';
      document.body.appendChild(toast);
    }
    document.getElementById('toast-text').textContent = String(message);
    toast.classList.remove('hidden');
    clearTimeout(window.momotusToolsToastTimer);
    window.momotusToolsToastTimer = setTimeout(() => toast.classList.add('hidden'), 3200);
  };

  const renderNavbar = () => {
    const placeholder = document.getElementById('navbar-placeholder');
    if (!placeholder) return;
    placeholder.innerHTML = `
      <nav class="bg-black sticky top-0 z-50 border-b border-zinc-800">
        <div class="max-w-7xl mx-auto px-4 md:px-6 py-5 flex items-center justify-between">
          <a href="index.html" class="flex items-center gap-3" aria-label="Momotus Core, volver al inicio"><i class="fa-solid fa-shirt text-4xl text-yellow-400" aria-hidden="true"></i><strong class="text-3xl font-bold tracking-tighter">Momotus Core</strong></a>
          <div class="hidden lg:flex items-center gap-6 text-base font-medium">
            <a href="index.html" class="hover:text-yellow-400 transition">Inicio</a><a href="tienda.html" class="hover:text-yellow-400 transition">Tienda</a><a href="disena.html" class="hover:text-yellow-400 transition">Diseña la Tuya</a><a href="comunidad.html" class="hover:text-yellow-400 transition">Comunidad</a><a href="herramientas.html" class="text-yellow-400 font-bold">Herramientas</a>
          </div>
          <div class="flex items-center gap-6">
            <a href="tienda.html" aria-label="Ir al carrito en la tienda" class="relative text-2xl hover:text-yellow-400 transition"><i class="fa-solid fa-shopping-cart" aria-hidden="true"></i><span class="absolute -top-1 -right-1 bg-yellow-400 text-black text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">${readCartCount()}</span></a>
            <a href="https://wa.me/50555010044" target="_blank" rel="noopener noreferrer" aria-label="Contactar por WhatsApp" class="text-3xl text-green-400 hover:scale-110 transition"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i></a>
          </div>
        </div>
      </nav>`;
  };

  renderNavbar();
})();
