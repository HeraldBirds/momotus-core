// js/script.js - Momotus Core - VERSIÓN FINAL OPTIMIZADA (Carga de imágenes ultra-rápida + sin precios)
let cart = [];
let wishlist = [];
let currentSlide = 0;
let carouselInterval = null;
let currentShirtType = 0;
let currentColor = 'black';

// ==================== TAMAÑO DINÁMICO DEL DISEÑO ====================
const designSizes = [265, 235, 295];

const updateDesignSize = () => {
  const size = designSizes[currentShirtType];
  ['design-preview', 'design-preview-back'].forEach(id => {
    const preview = document.getElementById(id);
    if (preview) {
      preview.style.width = `${size}px`;
      preview.style.height = `${size}px`;
    }
  });
};

// ==================== PRODUCTOS ====================
const products = [
  { id: 1, name: "Naruto Hokage Edition", price: 520, category: "anime", img: "img/products/product-1.jpg" },
  { id: 2, name: "Nica Power", price: 420, category: "nica", img: "img/products/product-2.jpg" },
  { id: 3, name: "Volcán Momotombo", price: 480, category: "nica", img: "img/products/product-3.jpg" },
  { id: 4, name: "Anime Warrior", price: 520, category: "anime", img: "img/products/product-4.jpg" },
  { id: 5, name: "Sakura Dreams", price: 490, category: "anime", img: "img/products/product-5.jpg" },
  { id: 6, name: "Urban Graffiti", price: 460, category: "urbano", img: "img/products/product-6.jpg" },
  { id: 7, name: "Street Kings", price: 430, category: "urbano", img: "img/products/product-7.jpg" },
  { id: 8, name: "Abstract Waves", price: 410, category: "abstracta", img: "img/products/product-8.jpg" },
  { id: 9, name: "Golden Flow", price: 500, category: "abstracta", img: "img/products/product-9.jpg" },
  { id: 10, name: "Limited Edition 001", price: 650, category: "unica", img: "img/products/product-10.jpg" },
  { id: 11, name: "Nicaragua Forever", price: 470, category: "nica", img: "img/products/product-11.jpg" },
  { id: 12, name: "Cyber Nica", price: 550, category: "unica", img: "img/products/product-12.jpg" },
  { id: 13, name: "Goku Ultra Instinct", price: 550, category: "anime", img: "img/products/product-13.jpg" },
  { id: 14, name: "Luffy Gear 5", price: 530, category: "anime", img: "img/products/product-14.jpg" }
];

// ==================== MOCKUP Y COLORES ====================
const shirtTypes = ['regular', 'slim', 'oversized'];
const colorMap = { black: 'negro', white: 'blanco', red: 'rojo', blue: 'azul', emerald: 'verde', violet: 'violeta', amber: 'amarillo', pink: 'rosa' };

const getMockupPath = (typeIndex, colorKey, isBack = false) => {
  const typeName = shirtTypes[typeIndex];
  const colorName = colorMap[colorKey] || colorKey;
  const side = isBack ? 'espalda' : 'frente';
  return `img/mockups/mockup-${typeName}-${colorName}-${side}.png`;
};

const colors = [
  { key: 'black', class: 'bg-black', name: 'Negro' },
  { key: 'white', class: 'bg-white', name: 'Blanco' },
  { key: 'red', class: 'bg-red-500', name: 'Rojo' },
  { key: 'blue', class: 'bg-blue-500', name: 'Azul' },
  { key: 'emerald', class: 'bg-emerald-500', name: 'Verde' },
  { key: 'violet', class: 'bg-violet-500', name: 'Violeta' },
  { key: 'amber', class: 'bg-amber-500', name: 'Amarillo' },
  { key: 'pink', class: 'bg-pink-500', name: 'Rosa' }
];

const renderColorButtons = () => {
  const container = document.getElementById('color-buttons');
  if (!container) return;
  container.innerHTML = '';
  colors.forEach(color => {
    const btn = document.createElement('button');
    btn.onclick = () => selectColor(color.key, btn);
    btn.className = `color-btn w-14 h-14 rounded-2xl shadow-inner border-2 border-transparent active:scale-95 transition-all ${color.class}`;
    if (color.key === 'black') btn.classList.add('active');
    container.appendChild(btn);
  });
};

// ==================== BLEND MEJORADO ====================
const getDesignStyle = (colorKey) => {
  if (colorKey === 'white') {
    return `mix-blend-mode: multiply; filter: brightness(0.95) contrast(1.25) saturate(1.1) opacity(0.92);`;
  } else {
    return `mix-blend-mode: multiply; filter: brightness(1.08) contrast(1.18) saturate(1.25) opacity(0.95);`;
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
  document.getElementById('toast-text').innerHTML = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 3200);
};

// ==================== CARRITO Y WISHLIST ====================
const saveCart = () => localStorage.setItem('momotusCart', JSON.stringify(cart));
const loadCart = () => {
  const saved = localStorage.getItem('momotusCart');
  if (saved) cart = JSON.parse(saved);
  updateCartCount();
};

const saveWishlist = () => localStorage.setItem('momotusWishlist', JSON.stringify(wishlist));
const loadWishlist = () => {
  const saved = localStorage.getItem('momotusWishlist');
  if (saved) wishlist = JSON.parse(saved);
};

const isInWishlist = (id) => wishlist.some(item => item.id === id);

const addToWishlist = (id) => {
  const product = products.find(p => p.id === id);
  if (!product || isInWishlist(id)) return;
  wishlist.push(product);
  saveWishlist();
  showToast(`❤️ ${product.name} añadido a favoritos`);
  renderProducts(products);
};

const removeFromWishlist = (id) => {
  wishlist = wishlist.filter(item => item.id !== id);
  saveWishlist();
  showToast("💔 Eliminado de favoritos");
  renderProducts(products);
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
          <button onclick="toggleCartModal()" class="relative text-2xl hover:text-yellow-400 transition">
            <i class="fa-solid fa-shopping-cart"></i>
            <span id="cart-count" class="absolute -top-1 -right-1 bg-yellow-400 text-black text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">0</span>
          </button>
          <a href="https://wa.me/50512345678" target="_blank" class="text-3xl text-green-400 hover:scale-110 transition"><i class="fa-brands fa-whatsapp"></i></a>
          <button onclick="toggleMobileMenu()" class="md:hidden text-3xl"><i class="fa-solid fa-bars"></i></button>
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

const renderCartModal = () => {
  const modalHTML = `
    <div id="cart-modal" class="hidden fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
      <div class="bg-zinc-900 rounded-3xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden">
        <div class="px-8 py-6 border-b border-zinc-700 flex items-center justify-between">
          <h3 class="text-2xl font-bold">Tu Carrito</h3>
          <button onclick="toggleCartModal()" class="text-3xl text-zinc-400 hover:text-white">×</button>
        </div>
        <div id="cart-items" class="p-8 max-h-[60vh] overflow-y-auto space-y-8"></div>
        <div class="p-8 border-t border-zinc-700">
          <div class="flex justify-between text-xl mb-6">
            <span class="font-medium">Total</span>
            <span id="cart-total" class="font-bold text-yellow-400"></span>
          </div>
          <button onclick="checkout()" class="w-full bg-yellow-400 text-black font-bold py-6 rounded-3xl text-lg hover:bg-yellow-300 transition">Ir a pagar por WhatsApp</button>
        </div>
      </div>
    </div>
  `;
  const placeholder = document.getElementById('cart-modal-placeholder');
  if (placeholder) placeholder.innerHTML = modalHTML;
};

// ==================== QUICK VIEW (imágenes optimizadas) ====================
const showQuickView = (id) => {
  const product = products.find(p => p.id === id);
  if (!product) return;
  const inWishlist = isInWishlist(id);
  const modalHTML = `
    <div id="quickview-modal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-[10000]">
      <div class="bg-zinc-900 rounded-3xl max-w-2xl w-full mx-4 overflow-hidden">
        <div class="px-8 py-6 border-b border-zinc-700 flex justify-between items-center">
          <h3 class="text-2xl font-bold">${product.name}</h3>
          <button onclick="closeQuickView()" class="text-4xl text-zinc-400 hover:text-white">×</button>
        </div>
        <div class="p-8 flex flex-col md:flex-row gap-8">
          <img loading="eager" decoding="async" width="400" height="400" src="${product.img}" class="w-full md:w-1/2 aspect-square object-cover rounded-3xl" alt="${product.name}">
          <div class="flex-1">
            <p class="text-4xl font-bold text-yellow-400 mb-2">C$ ${product.price}</p>
            <span class="inline-block bg-black/70 text-white text-xs px-4 py-1 rounded-full mb-6">${product.category.toUpperCase()}</span>
            <p class="text-zinc-400 mb-8">Camiseta premium 100% algodón peinado. Diseño exclusivo de Momotus Core. Edición limitada Nicaragua 2026.</p>
            <div class="flex gap-4">
              <button onclick="addToCartFromStore(${product.id}); closeQuickView()" class="flex-1 bg-yellow-400 text-black font-bold py-6 rounded-3xl">Agregar al carrito</button>
              <button onclick="${inWishlist ? `removeFromWishlist(${product.id})` : `addToWishlist(${product.id})`}; closeQuickView()" class="flex-1 border border-zinc-600 hover:bg-zinc-800 py-6 rounded-3xl flex items-center justify-center gap-2">
                <i class="fa-solid fa-heart ${inWishlist ? 'text-red-500' : 'text-zinc-400'}"></i> ${inWishlist ? 'Quitar de favoritos' : 'Añadir a favoritos'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  const existing = document.getElementById('quickview-modal');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', modalHTML);
};

const closeQuickView = () => {
  const modal = document.getElementById('quickview-modal');
  if (modal) modal.remove();
};

// ==================== TIENDA (imágenes optimizadas) ====================
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
        <img loading="lazy" decoding="async" width="320" height="320" onclick="showQuickView(${product.id})" src="${product.img}" alt="${product.name}" class="w-full aspect-square object-cover transition group-hover:scale-105 cursor-pointer">
        <span class="absolute top-4 left-4 bg-black/70 text-white text-xs font-medium px-3 py-1 rounded-full">${product.category.toUpperCase()}</span>
        <button onclick="event.stopImmediatePropagation(); ${inWishlist ? `removeFromWishlist(${product.id})` : `addToWishlist(${product.id})`}" class="absolute top-4 right-4 text-2xl ${inWishlist ? 'text-red-500' : 'text-white/70 hover:text-red-500'} transition">
          <i class="fa-solid fa-heart"></i>
        </button>
      </div>
      <div class="p-5">
        <h3 onclick="showQuickView(${product.id})" class="font-bold text-lg mb-1 cursor-pointer">${product.name}</h3>
        <p class="text-yellow-400 font-semibold text-xl">C$ ${product.price}</p>
        <div class="flex gap-3 mt-4">
          <button onclick="addToCartFromStore(${product.id}); event.stopImmediatePropagation()" class="flex-1 bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 rounded-2xl transition flex items-center justify-center gap-2">
            <i class="fa-solid fa-cart-plus"></i> Carrito
          </button>
          <button onclick="showQuickView(${product.id}); event.stopImmediatePropagation()" class="flex-1 border border-zinc-600 hover:bg-zinc-800 py-3 rounded-2xl transition">Ver rápido</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
};

const renderBestSellers = () => {
  const grid = document.getElementById('best-sellers-grid');
  if (!grid) return;
  const best = [...products].sort((a, b) => b.price - a.price).slice(0, 4);
  grid.innerHTML = '';
  best.forEach(product => {
    const inWishlist = isInWishlist(product.id);
    const card = document.createElement('div');
    card.className = 'product-card bg-zinc-900 rounded-3xl overflow-hidden group relative';
    card.innerHTML = `
      <div class="relative">
        <img loading="lazy" decoding="async" width="320" height="320" onclick="showQuickView(${product.id})" src="${product.img}" alt="${product.name}" class="w-full aspect-square object-cover transition group-hover:scale-105 cursor-pointer">
        <span class="absolute top-4 left-4 bg-orange-500 text-white text-xs font-medium px-3 py-1 rounded-full">TOP</span>
        <button onclick="event.stopImmediatePropagation(); ${inWishlist ? `removeFromWishlist(${product.id})` : `addToWishlist(${product.id})`}" class="absolute top-4 right-4 text-2xl ${inWishlist ? 'text-red-500' : 'text-white/70 hover:text-red-500'} transition">
          <i class="fa-solid fa-heart"></i>
        </button>
      </div>
      <div class="p-5">
        <h3 onclick="showQuickView(${product.id})" class="font-bold text-lg mb-1 cursor-pointer">${product.name}</h3>
        <p class="text-yellow-400 font-semibold text-xl">C$ ${product.price}</p>
      </div>
    `;
    grid.appendChild(card);
  });
};

// ==================== CARRITO (imágenes optimizadas) ====================
const toggleCartModal = () => {
  const modal = document.getElementById('cart-modal');
  if (!modal) return;
  const itemsContainer = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  if (modal.classList.contains('hidden')) {
    itemsContainer.innerHTML = '';
    let subtotal = 0;
    cart.forEach((item, index) => {
      const qty = item.quantity || 1;
      subtotal += item.price * qty;
      itemsContainer.innerHTML += `
        <div class="flex items-center justify-between border-b border-zinc-700 pb-6">
          <div class="flex items-center gap-4">
            <img loading="lazy" decoding="async" width="80" height="80" src="${item.img}" class="w-20 h-20 object-cover rounded-2xl" alt="${item.name}">
            <div>
              <p class="font-medium">${item.name}</p>
              <p class="text-sm text-zinc-400">C$ ${item.price}</p>
            </div>
          </div>
          <div class="flex items-center gap-5">
            <button onclick="updateCartQuantity(${index}, -1)" class="w-8 h-8 hover:bg-zinc-700 rounded">-</button>
            <span class="w-6 text-center">${qty}</span>
            <button onclick="updateCartQuantity(${index}, 1)" class="w-8 h-8 hover:bg-zinc-700 rounded">+</button>
            <button onclick="removeFromCart(${index})" class="text-red-400 hover:text-red-500 ml-4"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>`;
    });
    totalEl.textContent = `C$ ${subtotal.toFixed(0)}`;
    modal.classList.remove('hidden');
  } else {
    modal.classList.add('hidden');
  }
};

const addToCartFromStore = (id) => {
  const product = products.find(p => p.id === id);
  if (!product) return;
  const existing = cart.find(item => item.id === product.id);
  if (existing) existing.quantity = (existing.quantity || 1) + 1;
  else cart.push({ ...product, quantity: 1 });
  saveCart();
  updateCartCount();
  showToast(`✅ ${product.name} agregado al carrito`);
};

const updateCartCount = () => {
  const countEl = document.getElementById('cart-count');
  if (countEl) {
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    countEl.textContent = totalItems;
  }
};

const updateCartQuantity = (index, change) => {
  const item = cart[index];
  if (!item) return;
  const newQty = (item.quantity || 1) + change;
  if (newQty < 1) return removeFromCart(index);
  item.quantity = newQty;
  saveCart();
  updateCartCount();
  toggleCartModal();
};

const removeFromCart = (index) => {
  cart.splice(index, 1);
  saveCart();
  updateCartCount();
  toggleCartModal();
};

const checkout = () => {
  if (cart.length === 0) return;
  showToast("¡Redirigiendo a WhatsApp para pagar!");
  setTimeout(() => window.open("https://wa.me/50512345678", "_blank"), 1500);
};

// ==================== FILTROS Y BÚSQUEDA ====================
let currentCategory = 'all';
let currentSearchTerm = '';

const filterCategory = (category) => {
  currentCategory = category;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.id === `filter-${category}`);
  });
  filterProducts();
};

const filterProducts = () => {
  currentSearchTerm = document.getElementById('search-input')?.value.toLowerCase().trim() || '';
  let filtered = products;
  if (currentCategory !== 'all') filtered = filtered.filter(p => p.category === currentCategory);
  if (currentSearchTerm) filtered = filtered.filter(p => p.name.toLowerCase().includes(currentSearchTerm));
  renderProducts(filtered);
  const countEl = document.getElementById('count-number');
  if (countEl) countEl.textContent = filtered.length;
};

let searchTimeout;
const debouncedSearch = () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(filterProducts, 250);
};

// ==================== TESTIMONIALS ====================
const testimonials = [
  { name: "Carlos Mejía", location: "Managua", text: "La calidad de la tela es brutal. Mi Volcán Momotombo es la favorita de toda la familia. ¡100% recomendado!", rating: 5, avatar: "🇳🇮" },
  { name: "María José López", location: "León", text: "Compré la de Naruto y me llegó en 2 días. El diseño es nítido y no se decolora después de lavarla. ¡Gracias Momotus!", rating: 5, avatar: "👩🏻" },
  { name: "Roberto Sánchez", location: "Granada", text: "La herramienta de diseño es súper fácil. Subí mi logo y quedó perfecto. Ya pedí 3 camisetas más.", rating: 4, avatar: "🧔" }
];

const renderTestimonials = () => {
  const container = document.getElementById('testimonials-container');
  if (!container) return;
  container.innerHTML = '';
  testimonials.forEach(t => {
    const stars = '★'.repeat(t.rating) + '☆'.repeat(5 - t.rating);
    const card = document.createElement('div');
    card.className = 'bg-zinc-900 rounded-3xl p-8 hover:scale-105 transition-all';
    card.innerHTML = `
      <div class="flex items-center gap-4 mb-6">
        <div class="w-12 h-12 bg-yellow-400/10 text-4xl flex items-center justify-center rounded-2xl">${t.avatar}</div>
        <div>
          <h4 class="font-bold">${t.name}</h4>
          <p class="text-sm text-zinc-400">${t.location}</p>
        </div>
      </div>
      <p class="text-zinc-300 mb-6 leading-relaxed">"${t.text}"</p>
      <div class="text-yellow-400 text-2xl">${stars}</div>
    `;
    container.appendChild(card);
  });
};

// ==================== SKELETONS ====================
const showProductsSkeleton = () => {
  const grid = document.getElementById('products-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < 8; i++) {
    const skeleton = document.createElement('div');
    skeleton.className = 'bg-zinc-900 rounded-3xl overflow-hidden animate-pulse';
    skeleton.innerHTML = `
      <div class="aspect-square bg-zinc-800"></div>
      <div class="p-5 space-y-3">
        <div class="h-5 bg-zinc-800 rounded w-3/4"></div>
        <div class="h-4 bg-zinc-800 rounded w-1/2"></div>
        <div class="h-10 bg-zinc-800 rounded-2xl"></div>
      </div>`;
    grid.appendChild(skeleton);
  }
};

// ==================== DRAG & DROP ====================
let isDragging = false;
let currentDraggingDesign = null;
let offsetX = 0, offsetY = 0;

const makeDraggable = (el) => {
  if (!el) return;
  el.style.position = 'absolute';
  el.style.cursor = 'move';
  el.style.zIndex = '30';
  el.addEventListener('mousedown', startDrag);
  el.addEventListener('touchstart', startDrag, { passive: true });
};

const startDrag = (e) => {
  isDragging = true;
  currentDraggingDesign = e.target || (e.touches && e.touches[0].target);
  const rect = currentDraggingDesign.getBoundingClientRect();
  const clientX = e.clientX || (e.touches && e.touches[0].clientX);
  const clientY = e.clientY || (e.touches && e.touches[0].clientY);
  offsetX = clientX - rect.left;
  offsetY = clientY - rect.top;
  currentDraggingDesign.style.transition = 'none';
};

const initDragListeners = () => {
  const moveHandler = (e) => {
    if (!isDragging || !currentDraggingDesign) return;
    const preview = currentDraggingDesign.parentElement;
    const previewRect = preview.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);
    let newX = clientX - previewRect.left - offsetX;
    let newY = clientY - previewRect.top - offsetY;
    newX = Math.max(0, Math.min(newX, previewRect.width - currentDraggingDesign.offsetWidth));
    newY = Math.max(0, Math.min(newY, previewRect.height - currentDraggingDesign.offsetHeight));
    currentDraggingDesign.style.left = `${newX}px`;
    currentDraggingDesign.style.top = `${newY}px`;
  };
  const endHandler = () => {
    if (currentDraggingDesign) currentDraggingDesign.style.transition = 'all 0.2s ease';
    isDragging = false;
    currentDraggingDesign = null;
  };
  document.addEventListener('mousemove', moveHandler);
  document.addEventListener('touchmove', moveHandler, { passive: true });
  document.addEventListener('mouseup', endHandler);
  document.addEventListener('touchend', endHandler);
};

// ==================== DISEÑA ====================
const updateMockups = () => {
  const frontImg = document.getElementById('shirt-mockup');
  if (frontImg) frontImg.src = getMockupPath(currentShirtType, currentColor, false);
  const backImg = document.getElementById('shirt-mockup-back');
  if (backImg) backImg.src = getMockupPath(currentShirtType, currentColor, true);
  
  updateDesignSize();
  saveCurrentDesign();

  const frontDesign = document.getElementById('draggable-design-front');
  const backDesign = document.getElementById('draggable-design-back');
  if (frontDesign) frontDesign.style.cssText += getDesignStyle(currentColor);
  if (backDesign) backDesign.style.cssText += getDesignStyle(currentColor);
};

const selectShirtType = (index) => {
  currentShirtType = index;
  document.querySelectorAll('.shirt-type-btn').forEach((btn, i) => btn.classList.toggle('active', i === index));
  updateMockups();
};

const selectColor = (colorKey, el) => {
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  currentColor = colorKey;
  updateMockups();
};

const handleDesignUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast("❌ Solo se permiten imágenes"); return; }
  if (file.size > 5 * 1024 * 1024) { showToast("❌ Máximo 5 MB por imagen"); return; }

  const reader = new FileReader();
  reader.onload = (ev) => {
    const imageSrc = ev.target.result;
    const style = getDesignStyle(currentColor);

    const previewFront = document.getElementById('design-preview');
    if (previewFront) {
      previewFront.innerHTML = `<img src="${imageSrc}" id="draggable-design-front" class="max-w-full max-h-full object-contain rounded-3xl" style="${style}">`;
      previewFront.classList.add('design-loaded');
      makeDraggable(document.getElementById('draggable-design-front'));
    }
    const previewBack = document.getElementById('design-preview-back');
    if (previewBack) {
      previewBack.innerHTML = `<img src="${imageSrc}" id="draggable-design-back" class="max-w-full max-h-full object-contain rounded-3xl" style="${style}">`;
      previewBack.classList.add('design-loaded');
      makeDraggable(document.getElementById('draggable-design-back'));
    }
    showToast("✅ Diseño integrado correctamente en la tela");
    saveCurrentDesign();
  };
  reader.readAsDataURL(file);
};

const resetDesign = () => {
  ['design-preview', 'design-preview-back'].forEach(id => {
    const preview = document.getElementById(id);
    if (preview) {
      preview.classList.remove('design-loaded');
      preview.style.border = '4px dashed #facc15';
      preview.style.background = 'rgba(250, 204, 21, 0.12)';
      preview.innerHTML = `<span class="text-yellow-400 text-center text-base font-medium pointer-events-none">Arrastra tu diseño aquí</span>`;
    }
  });
  localStorage.removeItem('momotusCurrentDesign');
  showToast("Diseño reseteado");
};

const saveCurrentDesign = () => {
  const designData = {
    shirtType: currentShirtType,
    color: currentColor,
    frontDesign: document.getElementById('draggable-design-front') ? document.getElementById('draggable-design-front').src : null,
    backDesign: document.getElementById('draggable-design-back') ? document.getElementById('draggable-design-back').src : null
  };
  localStorage.setItem('momotusCurrentDesign', JSON.stringify(designData));
};

const loadSavedDesign = () => {
  const saved = localStorage.getItem('momotusCurrentDesign');
  if (!saved) return;
  const data = JSON.parse(saved);
  currentShirtType = data.shirtType || 0;
  currentColor = data.color || 'black';

  document.querySelectorAll('.shirt-type-btn').forEach((btn, i) => btn.classList.toggle('active', i === currentShirtType));

  const colorBtn = Array.from(document.querySelectorAll('.color-btn')).find(btn => 
    btn.classList.contains(colors.find(c => c.key === currentColor).class)
  );
  if (colorBtn) selectColor(currentColor, colorBtn);

  if (data.frontDesign) {
    const previewFront = document.getElementById('design-preview');
    previewFront.innerHTML = `<img src="${data.frontDesign}" id="draggable-design-front" class="max-w-full max-h-full object-contain rounded-3xl" style="${getDesignStyle(currentColor)}">`;
    previewFront.classList.add('design-loaded');
    makeDraggable(document.getElementById('draggable-design-front'));
  }
  if (data.backDesign) {
    const previewBack = document.getElementById('design-preview-back');
    previewBack.innerHTML = `<img src="${data.backDesign}" id="draggable-design-back" class="max-w-full max-h-full object-contain rounded-3xl" style="${getDesignStyle(currentColor)}">`;
    previewBack.classList.add('design-loaded');
    makeDraggable(document.getElementById('draggable-design-back'));
  }
  updateMockups();
};

// ==================== MODAL ELIMINAR FONDO ====================
const switchMockup = (tab) => {
  document.getElementById('tab-frente').classList.toggle('tab-active', tab === 0);
  document.getElementById('tab-espalda').classList.toggle('tab-active', tab === 1);
  document.getElementById('mockup-frente').classList.toggle('hidden', tab === 1);
  document.getElementById('mockup-espalda').classList.toggle('hidden', tab === 0);
};

const mostrarModalEliminarFondo = () => document.getElementById('modal-eliminar-fondo').classList.remove('hidden');
const cerrarModalEliminarFondo = () => document.getElementById('modal-eliminar-fondo').classList.add('hidden');
const abrirRemoveBg = () => {
  cerrarModalEliminarFondo();
  window.open('https://remove.bg', '_blank');
  showToast("🪄 remove.bg abierto. Descarga la imagen sin fondo y súbela aquí.");
};

// ==================== COTIZACIÓN ====================
const sendToWhatsApp = () => {
  const typeName = ['Regular / Unisex', 'Slim Fit', 'Oversized'][currentShirtType];
  const colorName = colorMap[currentColor] || currentColor;
  const text = `¡Hola Momotus Core!%0A%0AQuiero cotizar una camiseta personalizada:%0A• Tipo de corte: ${typeName}%0A• Color: ${colorName.charAt(0).toUpperCase() + colorName.slice(1)}%0A• Incluye diseño personalizado%0A%0A¿Me pueden dar precio y tiempo de entrega? Gracias!`;
  window.open(`https://wa.me/50512345678?text=${text}`, '_blank');
  showToast("📱 Abriendo WhatsApp con tu cotización...");
};

const sendToEmail = () => {
  const typeName = ['Regular / Unisex', 'Slim Fit', 'Oversized'][currentShirtType];
  const colorName = colorMap[currentColor] || currentColor;
  const subject = "Cotización - Camiseta Personalizada Momotus Core";
  const body = `Hola equipo de Momotus Core,%0A%0AQuiero cotizar una camiseta:%0A- Tipo de corte: ${typeName}%0A- Color: ${colorName.charAt(0).toUpperCase() + colorName.slice(1)}%0A- Diseño: Personalizado%0A%0AGracias!`;
  window.location.href = `mailto:info@momotuscore.com?subject=${encodeURIComponent(subject)}&body=${body}`;
  showToast("✉️ Abriendo tu cliente de correo...");
};

// ==================== CARRUSEL ====================
const initCarousel = () => {
  const slides = document.querySelectorAll('.carousel-slide');
  if (slides.length === 0) return;
  const indicators = document.getElementById('carousel-indicators');
  if (!indicators) return;
  indicators.innerHTML = '';
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = `w-3 h-3 rounded-full transition-all ${i === 0 ? 'bg-yellow-400 scale-125' : 'bg-white/50'}`;
    dot.onclick = () => goToSlide(i);
    indicators.appendChild(dot);
  });
  startAutoPlay();
};

const goToSlide = (index) => {
  const slides = document.querySelectorAll('.carousel-slide');
  slides.forEach((slide, i) => slide.style.opacity = i === index ? '1' : '0');
  currentSlide = index;
  updateIndicators();
};

const updateIndicators = () => {
  const dots = document.getElementById('carousel-indicators')?.children;
  if (!dots) return;
  Array.from(dots).forEach((dot, i) => {
    dot.className = `w-3 h-3 rounded-full transition-all ${i === currentSlide ? 'bg-yellow-400 scale-125' : 'bg-white/50'}`;
  });
};

const nextSlide = () => {
  const slides = document.querySelectorAll('.carousel-slide');
  currentSlide = (currentSlide + 1) % slides.length;
  goToSlide(currentSlide);
};

const prevSlide = () => {
  const slides = document.querySelectorAll('.carousel-slide');
  currentSlide = (currentSlide - 1 + slides.length) % slides.length;
  goToSlide(currentSlide);
};

const startAutoPlay = () => carouselInterval = setInterval(nextSlide, 4800);

// ==================== PWA ====================
const registerPWA = () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('%c✅ PWA registrado', 'color:#facc15'));
  }
};

// ==================== INICIALIZACIÓN ====================
window.onload = () => {
  loadCart();
  loadWishlist();
  renderCommonNavbar();
  renderCartModal();

  if (document.getElementById('products-grid')) {
    showProductsSkeleton();
    setTimeout(() => {
      renderProducts(products);
      if (document.getElementById('best-sellers-grid')) renderBestSellers();
    }, 380);
  }

  const searchInput = document.getElementById('search-input');
  if (searchInput) searchInput.addEventListener('input', debouncedSearch);

  initCarousel();
  if (document.getElementById('type-0')) selectShirtType(0);
  if (document.getElementById('testimonials-container')) renderTestimonials();
  if (document.getElementById('color-buttons')) renderColorButtons();

  loadSavedDesign();
  initDragListeners();
  registerPWA();

  console.log("%c🚀 Momotus Core - JS FINAL OPTIMIZADO (carga de imágenes ultra-rápida)", "color:#facc15; font-weight:bold; font-size:16px");
};