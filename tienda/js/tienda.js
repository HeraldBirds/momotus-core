'use strict';

function toggleWishlist(id) {
  if (isInWishlist(id)) removeFromWishlist(id);
  else addToWishlist(id);
}

function renderBestSellers() {
  const container = document.getElementById('best-sellers-grid');
  if (!container) return;
  container.innerHTML = '';

  const bestProducts = getFilteredProducts().filter(product => product.featured === true).slice(0, 4);

  bestProducts.forEach(product => {
    const inWishlist = isInWishlist(product.id);
    const card = document.createElement('div');
    card.className = 'product-card bg-zinc-900 rounded-3xl overflow-hidden group relative';
    card.innerHTML = `
      <div class="relative">
        <img src="${product.img}" data-fallback-src="${product.fallbackImg || ''}" data-garment="${product.garment}" width="320" height="320" loading="lazy" decoding="async" alt="${product.name}" onclick="showQuickView(${product.id})" class="w-full aspect-square object-cover transition group-hover:scale-105 cursor-pointer">
        <span class="absolute top-4 left-4 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">🔥</span>
        <button onclick="event.stopImmediatePropagation(); toggleWishlist(${product.id});" aria-label="${inWishlist ? 'Quitar' : 'Añadir'} ${product.name} de favoritos" class="absolute top-4 right-4 text-2xl ${inWishlist ? 'text-red-500' : 'text-white/70 hover:text-red-500'} transition">
          <i class="fa-solid fa-heart"></i>
        </button>
      </div>
      <div class="p-5">
        <h3 onclick="showQuickView(${product.id})" class="font-bold text-lg mb-1 cursor-pointer line-clamp-2">${product.baseName}</h3>
        <p class="text-yellow-400 font-semibold text-xl">C$ ${product.price}</p>
        <p class="text-zinc-400 text-sm mt-1">${product.garmentName} · ${categoryLabels[product.category] || product.category}</p>
        <button onclick="event.stopImmediatePropagation(); showQuickView(${product.id});" class="mt-4 w-full bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-3 rounded-3xl text-sm transition">Ver tallas</button>
      </div>`;
    container.appendChild(card);
  });
}

function resetFilters() {
  currentGarment = 'camiseta';
  currentCategory = 'all';
  currentSearchTerm = '';
  currentMinPrice = 0;
  currentMaxPrice = Number.POSITIVE_INFINITY;
  showWishlistOnly = false;
  document.getElementById('search-input').value = '';
  document.getElementById('sort-select').value = 'default';
  document.querySelectorAll('.garment-filter-btn').forEach(button => button.classList.toggle('active', button.id === 'garment-camiseta'));
  document.querySelectorAll('.filter-btn').forEach(button => button.classList.toggle('active', button.id === 'filter-all'));
  updatePriceFilterUI();
  updateWishlistFilterButton();
  updateStoreURL();
  filterProducts();
  renderBestSellers();
}

window.addEventListener('load', () => {
  renderBestSellers();
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      currentSearchTerm = searchInput.value.toLowerCase().trim();
      updateStoreURL();
      filterProducts();
    });
  }
});
