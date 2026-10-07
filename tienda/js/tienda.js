'use strict';

function toggleWishlist(id) {
  if (isInWishlist(id)) removeFromWishlist(id);
  else addToWishlist(id);
}

function renderBestSellers() {
  if(updateFeaturedProductsVisibility()) renderFeaturedCategories();
}

function resetFilters() {
  currentGarment = 'camiseta';
  currentCategory = 'all';
  currentSubcategory = 'all';
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
    let searchTimer = 0;
    const applySearch = () => {
      currentSearchTerm = searchInput.value.toLowerCase().trim();
      updateStoreURL();
      filterProducts();
    };
    searchInput.addEventListener('input', event => {
      if (event.isComposing) return;
      clearTimeout(searchTimer);
      searchTimer = window.setTimeout(applySearch, 120);
    });
    searchInput.addEventListener('search', () => {
      clearTimeout(searchTimer);
      applySearch();
    });
  }
});
