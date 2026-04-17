// js/script.js - Momotus Core - VERSIÓN FINAL ACTUALIZADA (05 Abril 2026)
// Imágenes organizadas por categoría: nica-1, anime-1, game-1, etc.

let cart = [];
let wishlist = [];
let currentCategory = 'all';
let currentSearchTerm = '';

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
};

const removeFromWishlist = (id) => {
  wishlist = wishlist.filter(item => item.id !== id);
  saveWishlist();
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
          <button onclick="toggleCartModal()" class="relative text-2xl hover:text-yellow-400 transition">
            <i class="fa-solid fa-shopping-cart"></i>
            <span id="cart-count" class="absolute -top-1 -right-1 bg-yellow-400 text-black text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">0</span>
          </button>
          <a href="https://wa.me/50555010044" target="_blank" class="text-3xl text-green-400 hover:scale-110 transition"><i class="fa-brands fa-whatsapp"></i></a>
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

// ==================== CARRITO MODAL ====================
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

const toggleCartModal = () => {
  const modal = document.getElementById('cart-modal');
  if (!modal) return;
  const container = document.getElementById('cart-items');
  const totalEl = document.getElementById('cart-total');
  container.innerHTML = '';

  if (cart.length === 0) {
    container.innerHTML = `<p class="text-center text-zinc-400 py-12">Tu carrito está vacío</p>`;
    totalEl.textContent = 'C$ 0';
    modal.classList.remove('hidden');
    return;
  }

  let total = 0;
  cart.forEach((item, index) => {
    const itemTotal = item.price * (item.quantity || 1);
    total += itemTotal;
    const div = document.createElement('div');
    div.className = 'flex gap-4';
    div.innerHTML = `
      <img src="${item.img}" width="80" height="80" class="w-20 h-20 object-cover rounded-2xl" alt="${item.name}">
      <div class="flex-1">
        <p class="font-bold">${item.name}</p>
        <p class="text-zinc-400 text-sm">Talla: ${item.size} × ${item.quantity || 1}</p>
        <p class="text-yellow-400 font-semibold">C$ ${itemTotal}</p>
      </div>
      <button onclick="removeFromCart(${index});" class="text-red-400 hover:text-red-500 text-xl">×</button>
    `;
    container.appendChild(div);
  });

  totalEl.textContent = `C$ ${total}`;
  modal.classList.remove('hidden');
};

const removeFromCart = (index) => {
  cart.splice(index, 1);
  saveCart();
  updateCartCount();
  toggleCartModal();
};

const updateCartCount = () => {
  const countEl = document.getElementById('cart-count');
  if (countEl) {
    const totalItems = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    countEl.textContent = totalItems;
  }
};

const checkout = () => {
  if (cart.length === 0) return;
  let text = "¡Hola Momotus! Quiero comprar:%0A";
  cart.forEach(item => {
    text += `• ${item.name} - Talla ${item.size} × ${item.quantity || 1}%0A`;
  });
  text += `%0ATotal: C$ ${cart.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0)}`;
  window.open(`https://wa.me/50555010044?text=${text}`, '_blank');
  cart = [];
  saveCart();
  updateCartCount();
  toggleCartModal();
  showToast("✅ Pedido enviado por WhatsApp");
};

// ==================== QUICK VIEW ====================
const showQuickView = (id) => {
  const product = products.find(p => p.id === id);
  if (!product) return;
  const inWishlist = isInWishlist(id);

  let sizesHTML = '';
  product.sizes.forEach(s => {
    const stock = product.stock[s] || 0;
    const stockClass = stock > 8 ? 'text-green-400' : stock > 3 ? 'text-yellow-400' : 'text-red-400';
    sizesHTML += `<button onclick="addToCartWithSize(${product.id}, '${s}'); closeQuickView()" class="px-5 py-3 rounded-2xl border border-zinc-600 hover:border-yellow-400 transition flex items-center gap-2 ${stock === 0 ? 'opacity-40 pointer-events-none' : ''}">
      <span>${s}</span>
      <span class="${stockClass} text-xs font-medium">(${stock})</span>
    </button>`;
  });

  const modalHTML = `
    <div id="quickview-modal" class="fixed inset-0 bg-black/80 flex items-center justify-center z-[10000]">
      <div class="bg-zinc-900 rounded-3xl max-w-2xl w-full mx-4 overflow-hidden">
        <div class="px-8 py-6 border-b border-zinc-700 flex justify-between items-center">
          <h3 class="text-2xl font-bold">${product.name}</h3>
          <button onclick="closeQuickView()" class="text-4xl text-zinc-400 hover:text-white">×</button>
        </div>
        <div class="p-8 flex flex-col md:flex-row gap-8">
          <img src="${product.img}" width="400" height="400" class="w-full md:w-1/2 aspect-square object-cover rounded-3xl" alt="${product.name}">
          <div class="flex-1">
            <p class="text-4xl font-bold text-yellow-400 mb-2">C$ ${product.price}</p>
            <span class="inline-block bg-black/70 text-white text-xs px-4 py-1 rounded-full mb-6">${product.category.toUpperCase()}</span>
            <div class="mb-6">
              <p class="font-medium mb-3">Talla</p>
              <div class="flex flex-wrap gap-2">${sizesHTML}</div>
            </div>
            <p class="text-zinc-400 mb-8">Camiseta premium 100% algodón peinado. Diseño exclusivo de Momotus Core. Edición limitada Nicaragua 2026.</p>
            <div class="flex gap-4">
              <button onclick="closeQuickView()" class="flex-1 border border-zinc-600 hover:bg-zinc-800 py-6 rounded-3xl">Cerrar</button>
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

const addToCartWithSize = (id, size) => {
  const product = products.find(p => p.id === id);
  if (!product || (product.stock[size] || 0) === 0) return showToast("❌ Talla no disponible");
  
  const existing = cart.find(item => item.id === product.id && item.size === size);
  if (existing) existing.quantity = (existing.quantity || 1) + 1;
  else cart.push({ ...product, size, quantity: 1 });
  
  saveCart();
  updateCartCount();
  showToast(`✅ ${product.name} - Talla ${size} agregado`);
};

// ==================== PRODUCTOS - ORGANIZADOS POR CATEGORÍA ====================
const products = [
  // NICAS (4)
  { id: 1, name: "Nica Power", price: 420, category: "nica", img: "img/products/nica-1.webp", sizes: ["S","M","L","XL","XXL"], stock: {S:12, M:25, L:18, XL:8, XXL:5} },
  { id: 2, name: "Asio clamator", price: 480, category: "nica", img: "img/products/nica-2.webp", sizes: ["M","L","XL","XXL"], stock: {S:8, M:15, L:12, XL:9, XXL:4} },
  { id: 3, name: "Nicaragua Forever", price: 470, category: "nica", img: "img/products/nica-3.webp", sizes: ["S","M","L","XL"], stock: {S:20, M:14, L:10, XL:7, XXL:3} },
  { id: 4, name: "Bandera Nica Pride", price: 450, category: "nica", img: "img/products/nica-4.webp", sizes: ["S","M","L","XL","XXL"], stock: {S:10, M:22, L:15, XL:6, XXL:8} },

  // ANIME (10)
  { id: 5, name: "Sasuke Uchiha Edition", price: 550, category: "anime", img: "img/products/anime-1.webp", sizes: ["S","M","L","XL","XXL"], stock: {S:15, M:20, L:12, XL:8, XXL:5} },
  { id: 6, name: "Kento Nanami", price: 550, category: "anime", img: "img/products/anime-2.webp", sizes: ["M","L","XL","XXL"], stock: {S:9, M:18, L:14, XL:10, XXL:6} },
  { id: 7, name: "Satoru Gojō", price: 550, category: "anime", img: "img/products/anime-3.webp", sizes: ["S","M","L","XL","XXL"], stock: {S:11, M:19, L:13, XL:7, XXL:4} },
  { id: 8, name: "Maki Zenin", price: 500, category: "anime", img: "img/products/anime-4.webp", sizes: ["S","M","L","XL","XXL"], stock: {S:14, M:22, L:16, XL:9, XXL:5} },
  { id: 9, name: "Mewtwo", price: 450, category: "anime", img: "img/products/anime-5.webp", sizes: ["S","M","L","XL"], stock: {S:18, M:12, L:15, XL:8, XXL:6} },
  { id: 10, name: "Itachi Uchiha", price: 450, category: "anime", img: "img/products/anime-6.webp", sizes: ["S","M","L","XL","XXL"], stock: {S:13, M:17, L:11, XL:9, XXL:7} },
  { id: 11, name: "Hellsing", price: 500, category: "anime", img: "img/products/anime-7.webp", sizes: ["M","L","XL"], stock: {S:8, M:20, L:14, XL:10, XXL:5} },
  { id: 12, name: "Death Note", price: 450, category: "anime", img: "img/products/anime-8.webp", sizes: ["S","M","L","XL","XXL"], stock: {S:16, M:13, L:19, XL:7, XXL:4} },
  { id: 13, name: "Death Note 2.1", price: 450, category: "anime", img: "img/products/anime-9.webp", sizes: ["S","M","L","XL"], stock: {S:12, M:15, L:10, XL:8, XXL:6} },
  { id: 14, name: "Mob Psycho 100", price: 550, category: "anime", img: "img/products/anime-10.webp", sizes: ["S","M","L","XL","XXL"], stock: {S:14, M:21, L:12, XL:9, XXL:5} },

  // URBANO (4)
  { id: 15, name: "Trueno AE86", price: 400, category: "urbano", img: "img/products/urbano-1.webp", sizes: ["M","L","XL"], stock: {S:11, M:8, L:17, XL:6, XXL:3} },
  { id: 16, name: "Cyber Style", price: 400, category: "urbano", img: "img/products/urbano-2.webp", sizes: ["S","M","L","XL","XXL"], stock: {S:15, M:19, L:12, XL:10, XXL:5} },
  { id: 17, name: "Iron Maiden", price: 450, category: "urbano", img: "img/products/urbano-3.webp", sizes: ["S","M","L","XL"], stock: {S:10, M:14, L:9, XL:7, XXL:4} },
  { id: 18, name: "Ghostface", price: 450, category: "urbano", img: "img/products/urbano-4.webp", sizes: ["S","M","L","XL","XXL"], stock: {S:13, M:16, L:11, XL:8, XXL:6} },
  { id: 19, name: "NFC", price: 450, category: "urbano", img: "img/products/urbano-5.webp", sizes: ["S","M","L","XL","XXL"], stock: {S:13, M:16, L:11, XL:8, XXL:6} },

  // GAMES (6)
  { id: 19, name: "Hollow Knight", price: 500, category: "games", img: "img/products/game-1.webp", sizes: ["S","M","L","XL","XXL"], stock: {S:10, M:16, L:13, XL:9, XXL:5} },
  { id: 20, name: "Silent Hill F", price: 550, category: "games", img: "img/products/game-2.webp", sizes: ["M","L","XL"], stock: {S:8, M:12, L:15, XL:7, XXL:4} },
  { id: 21, name: "Kratos Edition", price: 550, category: "games", img: "img/products/game-3.webp", sizes: ["S","M","L","XL","XXL"], stock: {S:14, M:18, L:10, XL:6, XXL:5} },
  { id: 22, name: "Raccoonn City", price: 500, category: "games", img: "img/products/game-4.webp", sizes: ["S","M","L","XL"], stock: {S:9, M:15, L:12, XL:8, XXL:3} },
  { id: 23, name: "Minecraft Nicaragua", price: 465, category: "games", img: "img/products/game-5.webp", sizes: ["S","M","L","XL","XXL"], stock: {S:11, M:17, L:14, XL:9, XXL:6} },
  { id: 24, name: "Zelda Legend Nica", price: 530, category: "games", img: "img/products/game-6.webp", sizes: ["M","L","XL"], stock: {S:7, M:13, L:16, XL:10, XXL:4} },

  // ÚNICAS (6)
  { id: 25, name: "Limited Edition 001", price: 650, category: "unica", img: "img/products/unica-1.webp", sizes: ["L","XL","XXL"], stock: {S:5, M:8, L:15, XL:4, XXL:9} },
  { id: 26, name: "Limited Edition 002", price: 500, category: "unica", img: "img/products/unica-2.webp", sizes: ["M","L","XL","XXL"], stock: {S:6, M:11, L:20, XL:7, XXL:13} },
  { id: 27, name: "Eclipse Nica", price: 620, category: "unica", img: "img/products/unica-3.webp", sizes: ["S","M","L","XL"], stock: {S:9, M:14, L:8, XL:5, XXL:3} },
  { id: 28, name: "Midnight Warrior", price: 580, category: "unica", img: "img/products/unica-4.webp", sizes: ["S","M","L","XL","XXL"], stock: {S:12, M:10, L:16, XL:8, XXL:6} },
  { id: 29, name: "Fire & Gold", price: 590, category: "unica", img: "img/products/unica-5.webp", sizes: ["M","L","XL"], stock: {S:7, M:15, L:11, XL:9, XXL:4} },
  { id: 30, name: "Legendary Nica", price: 670, category: "unica", img: "img/products/unica-6.webp", sizes: ["S","M","L","XL","XXL"], stock: {S:8, M:12, L:14, XL:6, XXL:5} }
];

const getStockColor = (stock) => stock > 8 ? 'text-green-400' : stock > 3 ? 'text-yellow-400' : 'text-red-400';

// ==================== TESTIMONIALS ====================
const testimonials = [
  { name: "Carlos Mendoza", location: "Managua", text: "La mejor camiseta que he tenido. El diseño se ve increíble y la calidad es premium.", stars: "★★★★★" },
  { name: "María José Ruiz", location: "León", text: "Me encantó el proceso de diseño. Subí mi foto y quedó perfecta. ¡Recomendadísima!", stars: "★★★★★" },
  { name: "José Daniel Ortega", location: "Granada", text: "Envío súper rápido y el mockup 3D me ayudó a ver exactamente cómo quedaría.", stars: "★★★★☆" }
];

const renderTestimonials = () => {
  const homeContainer = document.getElementById('testimonials-home');
  if (homeContainer) homeContainer.innerHTML = testimonials.map(t => `
    <div class="bg-zinc-900 rounded-3xl p-6">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 bg-yellow-400 rounded-2xl flex items-center justify-center text-2xl">👕</div>
        <div><p class="font-bold">${t.name}</p><p class="text-sm text-zinc-400">${t.location}</p></div>
      </div>
      <p class="text-zinc-300 mb-6 leading-relaxed">"${t.text}"</p>
      <div class="text-yellow-400 text-2xl">${t.stars}</div>
    </div>`).join('');

  const communityContainer = document.getElementById('testimonials-container');
  if (communityContainer) communityContainer.innerHTML = testimonials.map(t => `
    <div class="bg-zinc-800 rounded-3xl p-8">
      <div class="flex items-center gap-3 mb-4">
        <div class="w-10 h-10 bg-yellow-400 rounded-2xl flex items-center justify-center text-2xl">👕</div>
        <div><p class="font-bold">${t.name}</p><p class="text-sm text-zinc-400">${t.location}</p></div>
      </div>
      <p class="text-zinc-300 mb-6 leading-relaxed">"${t.text}"</p>
      <div class="text-yellow-400 text-2xl">${t.stars}</div>
    </div>`).join('');
};

// ==================== TIENDA - RENDER Y FILTROS ====================
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
        <img src="${product.img}" width="320" height="320" loading="lazy" onclick="showQuickView(${product.id})" class="w-full aspect-square object-cover transition group-hover:scale-105 cursor-pointer">
        <span class="absolute top-4 left-4 bg-black/70 text-white text-xs font-medium px-3 py-1 rounded-full">${product.category.toUpperCase()}</span>
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

const filterCategory = (cat) => {
  currentCategory = cat;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.toggle('active', btn.id === `filter-${cat}`));
  filterProducts();
};

const filterProducts = () => {
  let filtered = products;
  if (currentCategory !== 'all') filtered = filtered.filter(p => p.category === currentCategory);
  if (currentSearchTerm) filtered = filtered.filter(p => p.name.toLowerCase().includes(currentSearchTerm));
  renderProducts(filtered);
  const countEl = document.getElementById('count-number');
  if (countEl) countEl.textContent = filtered.length;
};

const sortProducts = () => {
  const sortValue = document.getElementById('sort-select').value;
  let filtered = products;
  if (currentCategory !== 'all') filtered = filtered.filter(p => p.category === currentCategory);
  if (currentSearchTerm) filtered = filtered.filter(p => p.name.toLowerCase().includes(currentSearchTerm));

  if (sortValue === 'price-low') filtered.sort((a, b) => a.price - b.price);
  else if (sortValue === 'price-high') filtered.sort((a, b) => b.price - a.price);
  else if (sortValue === 'name') filtered.sort((a, b) => a.name.localeCompare(b.name));

  renderProducts(filtered);
};

// ==================== INICIALIZACIÓN ====================
window.onload = () => {
  loadCart();
  loadWishlist();
  renderCommonNavbar();
  renderCartModal();
  renderTestimonials();

  if (document.getElementById('products-grid')) {
    renderProducts(products);
    filterProducts();
  }

  console.log("%c🚀 Momotus Core - script.js COMPLETO Y ACTUALIZADO (imágenes por categoría)", "color:#facc15; font-weight:bold; font-size:14px");
};