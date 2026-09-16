// js/script.js - Momotus Core - VERSIÓN FINAL ACTUALIZADA (21 Abril 2026)
// Carrito MEJORADO + Categoría Fauna Nica + IDs corregidos

let cart = [];
let wishlist = [];
let currentCategory = 'all';
let currentSearchTerm = '';
let currentMinPrice = 0;
let currentMaxPrice = Number.POSITIVE_INFINITY;
let showWishlistOnly = false;
let quickViewProductId = null;
let quickViewSelectedSize = null;
const catalogProducts = window.MomotusCatalog?.products;

if (!Array.isArray(catalogProducts)) {
  throw new Error('No fue posible cargar js/products.js antes de js/script.js');
}

const products = catalogProducts.filter(product => product.published !== false);

const categoryLabels = {
  fauna: 'Fauna Nica',
  anime: 'Anime',
  urbano: 'Urbano',
  games: 'Games',
  unica: 'Únicas'
};

const categorySearchTerms = {
  fauna: 'fauna nica ave aves pajaro pajaros buho buhos lechuza naturaleza nicaragua',
  anime: 'anime manga japones japonés',
  urbano: 'urbano carro carros musica música terror calle',
  games: 'games juego juegos videojuego videojuegos gamer',
  unica: 'unica únicas unicas exclusivo limitada limitado nica nicaragua bandera'
};

const normalizeSearchText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

const readStoredJSON = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.warn(`No se pudo recuperar ${key}; se usará un estado limpio.`, error);
    localStorage.removeItem(key);
    return fallback;
  }
};

const writeStoredJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`No se pudo guardar ${key} en este dispositivo.`, error);
    return false;
  }
};

// ==================== TOAST ====================
const showToast = (message) => {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-zinc-800 border-l-4 border-yellow-400 px-8 py-4 rounded-3xl flex items-center gap-4 shadow-2xl z-[200]';
    toast.innerHTML = `<i class="fa-solid fa-check-circle text-green-400 text-2xl"></i><span id="toast-text" class="font-medium"></span>`;
    document.body.appendChild(toast);
  }
  document.getElementById('toast-text').textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3200);
};

const fallbackImage = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
    <rect width="640" height="640" fill="#18181b"/>
    <path d="M245 220h150l55 70-48 42-28-31v159H266V301l-28 31-48-42z" fill="#facc15" opacity=".9"/>
    <text x="320" y="520" text-anchor="middle" fill="#e4e4e7" font-family="Arial,sans-serif" font-size="26">Imagen próximamente</text>
  </svg>`)}`;

document.addEventListener('error', event => {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || image.dataset.fallbackApplied === 'true') return;
  image.dataset.fallbackApplied = 'true';
  image.src = fallbackImage;
  image.alt = image.alt ? `${image.alt} — imagen no disponible` : 'Imagen no disponible';
}, true);

let lastModalTrigger = null;
const activateModal = modal => {
  if (!modal) return;
  lastModalTrigger = document.activeElement;
  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
  requestAnimationFrame(() => modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')?.focus());
};

const deactivateModal = (modal, remove = false) => {
  if (!modal) return;
  if (remove) modal.remove();
  else modal.classList.add('hidden');
  if (!document.querySelector('[role="dialog"]:not(.hidden)')) document.body.classList.remove('overflow-hidden');
  if (lastModalTrigger instanceof HTMLElement) lastModalTrigger.focus();
  lastModalTrigger = null;
};

// ==================== CARRITO MEJORADO ====================
const saveCart = () => writeStoredJSON(
  'momotusCart',
  cart.map(({ id, size, quantity }) => ({ id, size, quantity }))
);

const validateCartItems = (items) => {
  if (!Array.isArray(items)) return [];
  const groupedItems = new Map();
  items.forEach(item => {
    const product = products.find(candidate => candidate.id === Number(item.id));
    const size = String(item.size || '');
    if (!product || !product.sizes.includes(size)) return;
    const availableStock = Number(product.stock[size]) || 0;
    if (availableStock < 1) return;
    const key = `${product.id}:${size}`;
    const previousQuantity = groupedItems.get(key)?.quantity || 0;
    groupedItems.set(key, {
      ...product,
      size,
      quantity: Math.min(availableStock, previousQuantity + Math.max(1, Number(item.quantity) || 1))
    });
  });
  return Array.from(groupedItems.values());
};

const loadCart = () => {
  const savedCart = readStoredJSON('momotusCart', []);
  cart = validateCartItems(savedCart);
  saveCart();
  updateCartCount();
};

const updateCartCount = () => {
  const countEl = document.getElementById('cart-count');
  if (countEl) {
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    countEl.textContent = totalItems;
  }
};

const changeQuantity = (index, delta) => {
  const item = cart[index];
  if (!item) return;
  const availableStock = Number(item.stock[item.size]) || 0;
  let newQty = Math.max(1, Math.min(availableStock, (item.quantity || 1) + delta));
  if (delta > 0 && newQty === item.quantity) {
    showToast(`⚠️ Solo hay ${availableStock} unidades disponibles en talla ${item.size}`);
    return;
  }
  item.quantity = newQty;
  saveCart();
  toggleCartModal();
};

const removeFromCart = (index) => {
  cart.splice(index, 1);
  saveCart();
  updateCartCount();
  toggleCartModal();
};

const clearCart = () => {
  if (confirm("¿Estás seguro de que quieres vaciar todo el carrito?")) {
    cart = [];
    saveCart();
    updateCartCount();
    toggleCartModal();
    showToast("🗑️ Carrito vaciado");
  }
};

// ==================== RENDER CARRITO (MEJORADO) ====================
const renderCartModal = () => {
  const modalHTML = `
    <div id="cart-modal" role="dialog" aria-modal="true" aria-labelledby="cart-modal-title" class="hidden fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
      <div class="bg-zinc-900 rounded-3xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div class="px-8 py-6 border-b border-zinc-700 flex items-center justify-between">
          <h3 id="cart-modal-title" class="text-2xl font-bold flex items-center gap-3">
            <i class="fa-solid fa-shopping-cart text-yellow-400"></i>
            Tu Carrito
          </h3>
          <button onclick="toggleCartModal()" aria-label="Cerrar carrito" class="text-3xl text-zinc-400 hover:text-white transition">×</button>
        </div>

        <div id="cart-items" class="flex-1 p-6 overflow-y-auto space-y-6"></div>

        <div class="p-6 border-t border-zinc-700">
          <div id="cart-total-container" class="flex justify-between items-baseline mb-6"></div>

          <div class="grid sm:grid-cols-2 gap-3 mb-4">
            <label class="text-sm text-zinc-300">
              Nombre
              <input id="checkout-name" maxlength="80" autocomplete="name" placeholder="Tu nombre" class="mt-2 w-full bg-zinc-800 border border-zinc-700 focus:border-yellow-400 rounded-2xl px-4 py-3 outline-none">
            </label>
            <label class="text-sm text-zinc-300">
              Ciudad o departamento
              <input id="checkout-city" maxlength="80" autocomplete="address-level2" placeholder="Ej. Managua" class="mt-2 w-full bg-zinc-800 border border-zinc-700 focus:border-yellow-400 rounded-2xl px-4 py-3 outline-none">
            </label>
          </div>
          
          <div class="flex gap-3">
            <button onclick="clearCart()" 
                    class="flex-1 border border-red-400/70 hover:bg-red-400/10 text-red-400 font-medium py-4 rounded-3xl transition">
              Vaciar carrito
            </button>
            <button onclick="toggleCartModal()" 
                    class="flex-1 border border-zinc-600 hover:bg-zinc-800 py-4 rounded-3xl font-medium transition">
              Seguir comprando
            </button>
          </div>
          
          <button onclick="checkout()" 
                  class="mt-4 w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-6 rounded-3xl text-lg transition flex items-center justify-center gap-3">
            <i class="fa-brands fa-whatsapp text-2xl"></i>
            Finalizar por WhatsApp
          </button>
        </div>
      </div>
    </div>
  `;

  const placeholder = document.getElementById('cart-modal-placeholder');
  if (placeholder) placeholder.innerHTML = modalHTML;
};

const toggleCartModal = () => {
  const modal = document.getElementById('cart-modal');
  if (!modal) return;
  if (!modal.classList.contains('hidden')) {
    deactivateModal(modal);
    return;
  }

  const container = document.getElementById('cart-items');
  const totalContainer = document.getElementById('cart-total-container');
  container.innerHTML = '';

  if (cart.length === 0) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-16 text-center">
        <i class="fa-solid fa-shopping-bag text-7xl text-zinc-600 mb-6"></i>
        <h4 class="text-2xl font-semibold mb-2">Tu carrito está vacío</h4>
        <p class="text-zinc-400 mb-8 max-w-[240px]">¡Aún no has elegido ninguna camiseta! Explora los diseños más nicas.</p>
        <button onclick="toggleCartModal(); window.location.href='tienda.html'" 
                class="bg-yellow-400 text-black font-bold px-10 py-4 rounded-3xl flex items-center gap-3 hover:scale-105 transition">
          <i class="fa-solid fa-shirt"></i>
          Ir a la tienda
        </button>
      </div>
    `;
    totalContainer.innerHTML = '';
    activateModal(modal);
    return;
  }

  let total = 0;

  cart.forEach((item, index) => {
    const qty = item.quantity || 1;
    const subtotal = item.price * qty;
    total += subtotal;

    const itemHTML = `
      <div class="flex gap-4 bg-zinc-800/50 rounded-3xl p-4">
        <img src="${item.img}" class="w-20 h-20 object-cover rounded-2xl" alt="${item.name}">
        
        <div class="flex-1">
          <div class="flex justify-between">
            <h4 class="font-bold text-base leading-tight">${item.name}</h4>
            <button onclick="removeFromCart(${index});" aria-label="Eliminar ${item.name} del carrito" class="text-red-400 hover:text-red-500 text-xl leading-none">×</button>
          </div>
          
          <p class="text-zinc-400 text-sm mt-1">Talla: <span class="font-medium">${item.size}</span></p>
          
          <div class="flex items-center justify-between mt-4">
            <div class="flex items-center border border-zinc-600 rounded-3xl">
              <button onclick="changeQuantity(${index}, -1)" class="w-8 h-8 flex items-center justify-center text-xl hover:bg-zinc-700 rounded-l-3xl transition">-</button>
              <span class="px-4 font-semibold">${qty}</span>
              <button onclick="changeQuantity(${index}, 1)" class="w-8 h-8 flex items-center justify-center text-xl hover:bg-zinc-700 rounded-r-3xl transition">+</button>
            </div>
            
            <div class="text-right">
              <p class="text-xs text-zinc-400">C$ ${item.price} × ${qty}</p>
              <p class="font-bold text-yellow-400 text-xl">C$ ${subtotal}</p>
            </div>
          </div>
        </div>
      </div>
    `;
    container.innerHTML += itemHTML;
  });

  totalContainer.innerHTML = `
    <span class="text-xl font-medium">Total</span>
    <span class="text-3xl font-black text-yellow-400">C$ ${total}</span>
  `;

  activateModal(modal);
};

const createOrderCode = () => {
  const date = new Date();
  const datePart = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('');
  let randomPart;
  if (window.crypto?.getRandomValues) {
    const values = new Uint32Array(1);
    window.crypto.getRandomValues(values);
    randomPart = values[0].toString(36).slice(-4).padStart(4, '0').toUpperCase();
  } else {
    randomPart = Math.random().toString(36).slice(2, 6).padEnd(4, '0').toUpperCase();
  }
  return `MOM-${datePart}-${randomPart}`;
};

const checkout = () => {
  if (cart.length === 0) return;

  const nameInput = document.getElementById('checkout-name');
  const cityInput = document.getElementById('checkout-city');
  if (!nameInput?.value.trim()) {
    showToast('Escribí tu nombre para continuar');
    nameInput?.focus();
    return;
  }
  if (!cityInput?.value.trim()) {
    showToast('Indicá tu ciudad o departamento');
    cityInput?.focus();
    return;
  }

  const previousCart = JSON.stringify(cart.map(({ id, size, quantity }) => ({ id, size, quantity })));
  cart = validateCartItems(cart);
  const validatedCart = JSON.stringify(cart.map(({ id, size, quantity }) => ({ id, size, quantity })));
  if (previousCart !== validatedCart) {
    saveCart();
    updateCartCount();
    toggleCartModal();
    showToast("⚠️ Actualizamos el carrito según el stock disponible; revísalo antes de continuar");
    return;
  }
  
  const orderCode = createOrderCode();
  const customerName = nameInput.value.trim();
  const customerCity = cityInput.value.trim();
  let text = `¡Hola Momotus Core! 👋\n\nQuiero confirmar este pedido:\n• Código: ${orderCode}\n• Nombre: ${customerName}\n• Ciudad o departamento: ${customerCity}\n\nProductos:\n\n`;
  
  cart.forEach(item => {
    const qty = item.quantity || 1;
    text += `• ${item.name}\n   Talla: ${item.size} × ${qty} = C$ ${item.price * qty}\n\n`;
  });
  
  text += `\nTotal: C$ ${cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0)}\n\n`;
  text += "Total estimado sujeto a confirmación de disponibilidad.\n\nPor favor, confirmame el pedido. ¡Gracias! 🇳🇮";

  const whatsappWindow = window.open(`https://wa.me/50555010044?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  if (!whatsappWindow) return showToast("❌ Permite las ventanas emergentes para abrir WhatsApp");
  showToast("✅ WhatsApp abierto; tu carrito se conserva");
};

// ==================== WISHLIST ====================
const saveWishlist = () => writeStoredJSON(
  'momotusWishlist',
  wishlist.map(({ id }) => ({ id }))
);
const loadWishlist = () => {
  const savedWishlist = readStoredJSON('momotusWishlist', []);
  wishlist = Array.isArray(savedWishlist)
    ? savedWishlist.map(item => products.find(product => product.id === Number(item.id))).filter(Boolean)
    : [];
  saveWishlist();
  updateWishlistFilterButton();
};

const isInWishlist = (id) => wishlist.some(item => item.id === id);

const updateWishlistFilterButton = () => {
  const button = document.getElementById('wishlist-filter');
  const count = document.getElementById('wishlist-filter-count');
  if (count) count.textContent = `(${wishlist.length})`;
  if (button) {
    button.classList.toggle('active', showWishlistOnly);
    button.setAttribute('aria-pressed', String(showWishlistOnly));
  }
};

const updatePriceFilterButtons = () => {
  const activeId = currentMinPrice === 0 && currentMaxPrice === 450
    ? 'price-low'
    : currentMinPrice === 451 && currentMaxPrice === 550
      ? 'price-mid'
      : currentMinPrice === 551 && currentMaxPrice === Number.POSITIVE_INFINITY
        ? 'price-high'
        : 'price-all';
  document.querySelectorAll('.price-btn').forEach(button => button.classList.toggle('active', button.id === activeId));
};

const toggleWishlistFilter = () => {
  showWishlistOnly = !showWishlistOnly;
  updateWishlistFilterButton();
  updateStoreURL();
  filterProducts();
};

const addToWishlist = (id) => {
  const product = products.find(p => p.id === id);
  if (!product || isInWishlist(id)) return;
  wishlist.push(product);
  saveWishlist();
  updateWishlistFilterButton();
  refreshStoreProductViews();
  showToast(`❤️ ${product.name} añadido a favoritos`);
};

const removeFromWishlist = (id) => {
  wishlist = wishlist.filter(item => item.id !== id);
  saveWishlist();
  updateWishlistFilterButton();
  refreshStoreProductViews();
  showToast("💔 Eliminado de favoritos");
};

// ==================== NAVBAR ====================
const renderCommonNavbar = () => {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const navbarHTML = `
    <nav class="bg-black sticky top-0 z-50 border-b border-zinc-800">
      <div class="max-w-7xl mx-auto px-4 md:px-6 py-5 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <i class="fa-solid fa-shirt text-4xl text-yellow-400"></i>
          <h1 class="text-3xl font-bold tracking-tighter">Momotus Core</h1>
        </div>
        <div class="hidden md:flex items-center gap-8 text-base font-medium">
          <a href="index.html" class="${currentPage === 'index.html' ? 'text-yellow-400 font-bold' : 'hover:text-yellow-400 transition'}">Inicio</a>
          <a href="tienda.html" class="${currentPage === 'tienda.html' ? 'text-yellow-400 font-bold' : 'hover:text-yellow-400 transition'}">Tienda</a>
          <a href="disena.html" class="${currentPage === 'disena.html' ? 'text-yellow-400 font-bold' : 'hover:text-yellow-400 transition'}">Diseña la Tuya</a>
          <a href="comunidad.html" class="${currentPage === 'comunidad.html' ? 'text-yellow-400 font-bold' : 'hover:text-yellow-400 transition'}">Comunidad</a>
        </div>
        <div class="flex items-center gap-6">
          <button onclick="toggleCartModal()" aria-label="Abrir carrito" class="relative text-2xl hover:text-yellow-400 transition">
            <i class="fa-solid fa-shopping-cart"></i>
            <span id="cart-count" class="absolute -top-1 -right-1 bg-yellow-400 text-black text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">0</span>
          </button>
          <a href="https://wa.me/50555010044" target="_blank" rel="noopener noreferrer" aria-label="Contactar por WhatsApp" class="text-3xl text-green-400 hover:scale-110 transition"><i class="fa-brands fa-whatsapp"></i></a>
          <button onclick="toggleMobileMenu()" aria-label="Abrir menú" class="md:hidden text-3xl"><i class="fa-solid fa-bars"></i></button>
        </div>
      </div>
      <div id="mobile-menu" class="hidden md:hidden bg-black border-t border-zinc-800 py-4">
        <div class="flex flex-col items-center gap-6 text-lg font-medium">
          <a href="index.html" class="hover:text-yellow-400">Inicio</a>
          <a href="tienda.html" class="hover:text-yellow-400">Tienda</a>
          <a href="disena.html" class="hover:text-yellow-400">Diseña la Tuya</a>
          <a href="comunidad.html" class="hover:text-yellow-400">Comunidad</a>
        </div>
      </div>
    </nav>
  `;
  const placeholder = document.getElementById('navbar-placeholder');
  if (placeholder) placeholder.innerHTML = navbarHTML;
};

const toggleMobileMenu = () => {
  const menu = document.getElementById('mobile-menu');
  if (menu) menu.classList.toggle('hidden');
};

// ==================== QUICK VIEW ====================
const showQuickView = (id, updateURL = true) => {
  const product = products.find(p => p.id === id);
  if (!product) return;
  quickViewProductId = product.id;
  quickViewSelectedSize = null;
  const inWishlist = isInWishlist(id);

  let sizesHTML = '';
  product.sizes.forEach(s => {
    const stock = product.stock[s] || 0;
    const stockClass = stock > 8 ? 'text-green-400' : stock > 3 ? 'text-yellow-400' : 'text-red-400';
    const stockText = stock > 8 ? 'Disponible' : stock > 0 ? 'Pocas unidades' : 'Agotado';
    sizesHTML += `<button type="button" data-quick-size="${s}" onclick="selectQuickViewSize('${s}')" aria-pressed="false" aria-label="Seleccionar talla ${s}, ${stockText}" class="quick-size-btn px-5 py-3 rounded-2xl border border-zinc-600 hover:border-yellow-400 transition flex flex-col items-center ${stock === 0 ? 'opacity-40 pointer-events-none' : ''}">
      <span>${s}</span>
      <span class="${stockClass} text-xs font-medium">${stockText}</span>
    </button>`;
  });

  const modalHTML = `
    <div id="quickview-modal" role="dialog" aria-modal="true" aria-labelledby="quickview-title" onclick="if(event.target.id === 'quickview-modal') closeQuickView()" class="fixed inset-0 bg-black/80 flex items-center justify-center z-[10000]">
      <div class="bg-zinc-900 rounded-3xl max-w-2xl w-full mx-4 max-h-[92vh] overflow-y-auto">
        <div class="px-8 py-6 border-b border-zinc-700 flex justify-between items-center">
          <h3 id="quickview-title" class="text-2xl font-bold">${product.name}</h3>
          <button onclick="closeQuickView()" aria-label="Cerrar vista del producto" class="text-4xl text-zinc-400 hover:text-white">×</button>
        </div>
        <div class="p-8 flex flex-col md:flex-row gap-8">
          <img src="${product.img}" width="400" height="400" decoding="async" class="w-full md:w-1/2 aspect-square object-cover rounded-3xl" alt="${product.name}">
          <div class="flex-1">
            <p class="text-4xl font-bold text-yellow-400 mb-2">C$ ${product.price}</p>
            <span class="inline-block bg-black/70 text-white text-xs px-4 py-1 rounded-full mb-6">${categoryLabels[product.category] || product.category}</span>
            <div class="mb-6">
              <p class="font-medium mb-3">Talla</p>
              <div class="flex flex-wrap gap-2">${sizesHTML}</div>
            </div>
            <p class="text-zinc-400 mb-6">Escogé tu talla y agregá el diseño al carrito. La disponibilidad se confirma al finalizar el pedido.</p>
            <button id="quickview-add-button" type="button" onclick="addSelectedQuickViewProduct()" disabled class="mb-4 w-full bg-yellow-400 disabled:bg-zinc-700 disabled:text-zinc-400 hover:bg-yellow-300 text-black font-bold py-4 rounded-3xl transition">
              Escogé una talla
            </button>
            <div class="flex gap-4">
              <button onclick="closeQuickView()" class="flex-1 border border-zinc-600 hover:bg-zinc-800 py-6 rounded-3xl">Cerrar</button>
              <button onclick="${inWishlist ? `removeFromWishlist(${product.id})` : `addToWishlist(${product.id})`}; closeQuickView()" class="flex-1 border border-zinc-600 hover:bg-zinc-800 py-6 rounded-3xl flex items-center justify-center gap-2">
                <i class="fa-solid fa-heart ${inWishlist ? 'text-red-500' : 'text-zinc-400'}"></i> ${inWishlist ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              </button>
            </div>
            <button onclick="shareProduct(${product.id})" class="mt-4 w-full border border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black py-3 rounded-3xl font-medium transition">
              <i class="fa-solid fa-share-nodes"></i> Compartir producto
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  const existing = document.getElementById('quickview-modal');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  activateModal(document.getElementById('quickview-modal'));
  if (updateURL && document.getElementById('products-grid')) {
    const url = new URL(window.location.href);
    url.searchParams.set('producto', product.id);
    history.replaceState(null, '', url);
  }
};

const selectQuickViewSize = size => {
  const product = products.find(item => item.id === quickViewProductId);
  if (!product || !product.sizes.includes(size) || Number(product.stock[size]) < 1) return;
  quickViewSelectedSize = size;
  document.querySelectorAll('.quick-size-btn').forEach(button => {
    const isSelected = button.dataset.quickSize === size;
    button.classList.toggle('active', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });
  const addButton = document.getElementById('quickview-add-button');
  if (addButton) {
    addButton.disabled = false;
    addButton.textContent = `Agregar talla ${size} al carrito`;
  }
};

const addSelectedQuickViewProduct = () => {
  if (!quickViewProductId || !quickViewSelectedSize) return showToast('Escogé una talla primero');
  addToCartWithSize(quickViewProductId, quickViewSelectedSize);
  closeQuickView();
};

const closeQuickView = (updateURL = true) => {
  const modal = document.getElementById('quickview-modal');
  if (modal) deactivateModal(modal, true);
  quickViewProductId = null;
  quickViewSelectedSize = null;
  if (updateURL && document.getElementById('products-grid')) {
    const url = new URL(window.location.href);
    url.searchParams.delete('producto');
    history.replaceState(null, '', url);
  }
};

const shareProduct = async (id) => {
  const product = products.find(item => item.id === id);
  if (!product) return;
  const url = new URL('tienda.html', window.location.href);
  url.searchParams.set('producto', id);
  const shareData = { title: product.name, text: `${product.name} - Momotus Core`, url: url.href };
  try {
    if (navigator.share) await navigator.share(shareData);
    else {
      await navigator.clipboard.writeText(url.href);
      showToast('🔗 Enlace del producto copiado');
    }
  } catch (error) {
    if (error?.name !== 'AbortError') showToast('❌ No se pudo compartir el producto');
  }
};

const addToCartWithSize = (id, size) => {
  const product = products.find(p => p.id === id);
  if (!product || (product.stock[size] || 0) === 0) return showToast("❌ Talla no disponible");
  
  const existing = cart.find(item => item.id === product.id && item.size === size);
  if (existing && existing.quantity >= product.stock[size]) {
    return showToast(`⚠️ Solo hay ${product.stock[size]} unidades disponibles en talla ${size}`);
  }
  if (existing) existing.quantity = (existing.quantity || 1) + 1;
  else cart.push({ ...product, size, quantity: 1 });
  
  saveCart();
  updateCartCount();
  showToast(`✅ ${product.name} - Talla ${size} agregado`);
};

// ==================== TESTIMONIOS / COMUNIDAD ====================
const renderTestimonials = () => {
  const homeContainer = document.getElementById('testimonials-home');
  if (homeContainer) homeContainer.innerHTML = `
    <div class="md:col-span-3 bg-zinc-900 border border-zinc-800 rounded-3xl p-8 text-center">
      <i class="fa-solid fa-camera text-4xl text-yellow-400 mb-4" aria-hidden="true"></i>
      <h4 class="text-2xl font-bold mb-3">Compartí tu creación Momotus</h4>
      <p class="text-zinc-400 max-w-2xl mx-auto">Mandanos una foto de tu prenda. Solo publicaremos imágenes u opiniones con tu autorización.</p>
    </div>`;

  const communityContainer = document.getElementById('testimonials-container');
  if (communityContainer) communityContainer.innerHTML = `
    <div class="md:col-span-3 bg-zinc-800 rounded-3xl p-8 text-center">
      <h3 class="text-2xl font-bold mb-3">Este espacio es para trabajos reales</h3>
      <p class="text-zinc-300">Las fotos y opiniones se agregarán únicamente después de recibir el permiso de cada cliente.</p>
    </div>`;
};

// ==================== TIENDA - RENDER Y FILTROS ====================
const featuredProductIds = products.filter(product => product.featured === true).map(product => product.id);

const getFilteredProducts = () => {
  let filtered = [...products];
  if (currentCategory !== 'all') filtered = filtered.filter(p => p.category === currentCategory);
  if (showWishlistOnly) filtered = filtered.filter(p => isInWishlist(p.id));
  if (currentSearchTerm) {
    const searchTerm = normalizeSearchText(currentSearchTerm);
    filtered = filtered.filter(product => normalizeSearchText([
      product.name,
      categoryLabels[product.category],
      categorySearchTerms[product.category]
    ].join(' ')).includes(searchTerm));
  }
  return filtered.filter(p => p.price >= currentMinPrice && p.price <= currentMaxPrice);
};

const applyCurrentSort = (items) => {
  const sortValue = document.getElementById('sort-select')?.value || 'default';
  const sorted = [...items];
  if (sortValue === 'price-low') sorted.sort((a, b) => a.price - b.price);
  else if (sortValue === 'price-high') sorted.sort((a, b) => b.price - a.price);
  else if (sortValue === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
  return sorted;
};

const refreshStoreProductViews = () => {
  if (typeof filterProducts === 'function') filterProducts();
  if (typeof renderBestSellers === 'function') renderBestSellers();
};

const updateFeaturedProductsVisibility = () => {
  const section = document.getElementById('featured-products-section');
  const showFeatured = currentCategory === 'all' && !currentSearchTerm
    && !showWishlistOnly && currentMinPrice === 0 && currentMaxPrice === Number.POSITIVE_INFINITY;
  if (section) section.classList.toggle('hidden', !showFeatured);
  return showFeatured;
};

const renderProducts = (filteredProducts) => {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  grid.innerHTML = '';
  if (filteredProducts.length === 0) {
    grid.innerHTML = `<p class="col-span-full text-center text-zinc-400 py-12 text-xl">No encontramos diseños 😔</p>`;
    return;
  }
  filteredProducts.forEach(product => {
    const inWishlist = isInWishlist(product.id);
    const card = document.createElement('div');
    card.className = 'product-card bg-zinc-900 rounded-3xl overflow-hidden group relative';
    card.innerHTML = `
      <div class="relative">
        <img src="${product.img}" width="320" height="320" loading="lazy" decoding="async" alt="${product.name}" onclick="showQuickView(${product.id})" class="w-full aspect-square object-cover transition group-hover:scale-105 cursor-pointer">
        <span class="absolute top-4 left-4 bg-black/70 text-white text-xs font-medium px-3 py-1 rounded-full">${categoryLabels[product.category] || product.category}</span>
        <button onclick="event.stopImmediatePropagation(); ${inWishlist ? `removeFromWishlist(${product.id})` : `addToWishlist(${product.id})`}" aria-label="${inWishlist ? 'Quitar' : 'Añadir'} ${product.name} de favoritos" class="absolute top-4 right-4 text-2xl ${inWishlist ? 'text-red-500' : 'text-white/70 hover:text-red-500'} transition">
          <i class="fa-solid fa-heart"></i>
        </button>
      </div>
      <div class="p-5">
        <h3 onclick="showQuickView(${product.id})" class="font-bold text-lg mb-1 cursor-pointer">${product.name}</h3>
        <p class="text-yellow-400 font-semibold text-xl">C$ ${product.price}</p>
        <button type="button" onclick="showQuickView(${product.id})" class="mt-4 w-full border border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black font-bold py-3 rounded-3xl text-sm transition">Ver tallas</button>
      </div>
    `;
    grid.appendChild(card);
  });
};

const filterCategory = (cat) => {
  currentCategory = cat;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.toggle('active', btn.id === `filter-${cat}`));
  updateStoreURL();
  filterProducts();
};

const updateStoreURL = () => {
  if (!document.getElementById('products-grid')) return;
  const url = new URL(window.location.href);
  currentCategory === 'all' ? url.searchParams.delete('categoria') : url.searchParams.set('categoria', currentCategory);
  currentSearchTerm ? url.searchParams.set('buscar', currentSearchTerm) : url.searchParams.delete('buscar');
  const sortValue = document.getElementById('sort-select')?.value || 'default';
  sortValue === 'default' ? url.searchParams.delete('orden') : url.searchParams.set('orden', sortValue);
  currentMinPrice === 0 ? url.searchParams.delete('precioMin') : url.searchParams.set('precioMin', currentMinPrice);
  currentMaxPrice === Number.POSITIVE_INFINITY ? url.searchParams.delete('precioMax') : url.searchParams.set('precioMax', currentMaxPrice);
  showWishlistOnly ? url.searchParams.set('favoritos', '1') : url.searchParams.delete('favoritos');
  url.searchParams.delete('producto');
  history.replaceState(null, '', url);
};

const filterProducts = () => {
  const filtered = getFilteredProducts();
  const showFeatured = updateFeaturedProductsVisibility();
  const productsForGrid = applyCurrentSort(showFeatured
    ? filtered.filter(product => !featuredProductIds.includes(product.id))
    : filtered);
  renderProducts(productsForGrid);
  const gridTitle = document.getElementById('catalog-grid-title');
  if (gridTitle) gridTitle.textContent = showFeatured ? 'Más diseños' : 'Resultados';
  const countEl = document.getElementById('count-number');
  if (countEl) countEl.textContent = filtered.length;
};

const sortProducts = () => {
  updateStoreURL();
  filterProducts();
};

const injectStoreStructuredData = () => {
  if (!document.getElementById('products-grid') || document.getElementById('store-products-schema')) return;
  const baseUrl = new URL('tienda.html', window.location.href);
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Catálogo Momotus Core',
    itemListElement: products.map((product, index) => {
      const productUrl = new URL(baseUrl.href);
      productUrl.searchParams.set('producto', product.id);
      const available = product.sizes.some(size => Number(product.stock[size]) > 0);
      return {
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Product',
          name: product.name,
          image: new URL(product.img, window.location.href).href,
          category: categoryLabels[product.category] || product.category,
          url: productUrl.href,
          offers: {
            '@type': 'Offer',
            priceCurrency: 'NIO',
            price: product.price,
            availability: available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'
          }
        }
      };
    })
  };
  const element = document.createElement('script');
  element.id = 'store-products-schema';
  element.type = 'application/ld+json';
  element.textContent = JSON.stringify(schema);
  document.head.appendChild(element);
};

// ==================== INICIALIZACIÓN ====================
window.onload = () => {
  loadCart();
  loadWishlist();
  renderCommonNavbar();
  renderCartModal();
  renderTestimonials();

  if (document.getElementById('products-grid')) {
    const params = new URLSearchParams(window.location.search);
    const category = params.get('categoria');
    if (['fauna', 'anime', 'urbano', 'games', 'unica'].includes(category)) currentCategory = category;
    currentSearchTerm = (params.get('buscar') || '').toLowerCase().trim();
    const minPrice = Number(params.get('precioMin'));
    const maxPrice = Number(params.get('precioMax'));
    if (Number.isFinite(minPrice) && minPrice >= 0) currentMinPrice = minPrice;
    if (Number.isFinite(maxPrice) && maxPrice >= currentMinPrice) currentMaxPrice = maxPrice;
    showWishlistOnly = params.get('favoritos') === '1';
    const sortValue = params.get('orden');
    if (['price-low', 'price-high', 'name'].includes(sortValue)) document.getElementById('sort-select').value = sortValue;
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = currentSearchTerm;
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.toggle('active', btn.id === `filter-${currentCategory}`));
    updateWishlistFilterButton();
    updatePriceFilterButtons();
    filterProducts();
    injectStoreStructuredData();
    const productId = Number(params.get('producto'));
    if (Number.isInteger(productId)) showQuickView(productId, false);
  }

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (document.getElementById('quickview-modal')) closeQuickView();
      const cartModal = document.getElementById('cart-modal');
      if (cartModal && !cartModal.classList.contains('hidden')) deactivateModal(cartModal);
      return;
    }
    if (event.key === 'Tab') {
      const openModals = Array.from(document.querySelectorAll('[role="dialog"]:not(.hidden)'));
      const modal = openModals.at(-1);
      if (!modal) return;
      const focusable = Array.from(modal.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });

  console.log("%c🚀 Momotus Core - script.js COMPLETO (Carrito MEJORADO + Fauna Nica)", "color:#facc15; font-weight:bold; font-size:14px");
};
