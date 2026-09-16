// Catálogo central de Momotus Core.
// Editá productos, precios, tallas y stock únicamente en este archivo.
(() => {
  'use strict';

  /*
    Para preparar un producto sin publicarlo, agregá:
      published: false

    Cuando querás mostrarlo, cambiá esa línea por:
      published: true

    Para mostrarlo también entre los destacados, agregá:
      featured: true
  */

  const products = [
    { id: 1, name: 'Agelaius phoeniceus', price: 550, category: 'fauna', img: 'img/products/nica-1.webp', sizes: ['S','M','L'], stock: {S:12, M:25, L:18}, featured: true },
    { id: 2, name: 'Asio clamator', price: 550, category: 'fauna', img: 'img/products/nica-2.webp', sizes: ['M','L'], stock: {M:15, L:12}, featured: true },
    { id: 3, name: 'Strix virgata', price: 550, category: 'fauna', img: 'img/products/nica-3.webp', sizes: ['S','M','L'], stock: {S:20, M:14, L:10} },
    { id: 4, name: 'Bandera Nica Pride', price: 550, category: 'unica', img: 'img/products/nica-4.webp', sizes: ['S','M','L'], stock: {S:10, M:22, L:15} },
    { id: 5, name: 'Kurama Edition', price: 550, category: 'anime', img: 'img/products/anime-1.webp', sizes: ['S','M','L'], stock: {S:15, M:20, L:12} },
    { id: 6, name: 'Kento Nanami', price: 550, category: 'anime', img: 'img/products/anime-2.webp', sizes: ['M','L'], stock: {M:18, L:14} },
    { id: 7, name: 'Satoru Gojō', price: 550, category: 'anime', img: 'img/products/anime-3.webp', sizes: ['S','M','L'], stock: {S:11, M:19, L:13} },
    { id: 8, name: 'Maki Zenin', price: 500, category: 'anime', img: 'img/products/anime-4.webp', sizes: ['S','M','L'], stock: {S:14, M:22, L:16} },
    { id: 9, name: 'Mewtwo', price: 450, category: 'anime', img: 'img/products/anime-5.webp', sizes: ['S','M','L'], stock: {S:18, M:12, L:15} },
    { id: 10, name: 'Itachi Uchiha', price: 450, category: 'anime', img: 'img/products/anime-6.webp', sizes: ['S','M','L'], stock: {S:13, M:17, L:11} },
    { id: 11, name: 'Hellsing', price: 500, category: 'anime', img: 'img/products/anime-7.webp', sizes: ['M','L'], stock: {M:20, L:14} },
    { id: 12, name: 'Death Note', price: 450, category: 'anime', img: 'img/products/anime-8.webp', sizes: ['S','M','L'], stock: {S:16, M:13, L:19} },
    { id: 13, name: 'Death Note 2.1', price: 450, category: 'anime', img: 'img/products/anime-9.webp', sizes: ['S','M','L'], stock: {S:12, M:15, L:10}, featured: true },
    { id: 14, name: 'Mob Psycho 100', price: 550, category: 'anime', img: 'img/products/anime-10.webp', sizes: ['S','M','L'], stock: {S:14, M:21, L:12}, featured: true },
    { id: 15, name: 'Trueno AE86', price: 400, category: 'urbano', img: 'img/products/urbano-1.webp', sizes: ['M','L'], stock: {M:8, L:17} },
    { id: 16, name: 'Cyber Style', price: 400, category: 'urbano', img: 'img/products/urbano-2.webp', sizes: ['S','M','L'], stock: {S:15, M:19, L:12} },
    { id: 17, name: 'Iron Maiden', price: 450, category: 'urbano', img: 'img/products/urbano-3.webp', sizes: ['S','M','L'], stock: {S:10, M:14, L:9} },
    { id: 18, name: 'Ghostface', price: 450, category: 'urbano', img: 'img/products/urbano-4.webp', sizes: ['S','M','L'], stock: {S:13, M:16, L:11} },
    { id: 19, name: 'NFC', price: 450, category: 'urbano', img: 'img/products/urbano-5.webp', sizes: ['S','M','L'], stock: {S:13, M:16, L:11} },
    { id: 20, name: 'Hollow Knight', price: 500, category: 'games', img: 'img/products/game-1.webp', sizes: ['S','M','L'], stock: {S:10, M:16, L:13} },
    { id: 21, name: 'Silent Hill F', price: 550, category: 'games', img: 'img/products/game-2.webp', sizes: ['M','L'], stock: {M:12, L:15} },
    { id: 22, name: 'Kratos Edition', price: 550, category: 'games', img: 'img/products/game-3.webp', sizes: ['S','M','L'], stock: {S:14, M:18, L:10} },
    { id: 23, name: 'Raccoon City', price: 500, category: 'games', img: 'img/products/game-4.webp', sizes: ['S','M','L'], stock: {S:9, M:15, L:12} },
    { id: 24, name: 'Minecraft Nicaragua', price: 465, category: 'games', img: 'img/products/game-5.webp', sizes: ['S','M','L'], stock: {S:11, M:17, L:14} },
    { id: 25, name: 'Zelda Legend Nica', price: 530, category: 'games', img: 'img/products/game-6.webp', sizes: ['M','L'], stock: {M:13, L:16} },
    { id: 26, name: 'Limited Edition 001', price: 650, category: 'unica', img: 'img/products/unica-1.webp', sizes: ['L'], stock: {L:15} },
    { id: 27, name: 'Limited Edition 002', price: 500, category: 'unica', img: 'img/products/unica-2.webp', sizes: ['M','L'], stock: {M:11, L:20} },
    { id: 28, name: 'Eclipse Nica', price: 620, category: 'unica', img: 'img/products/unica-3.webp', sizes: ['S','M','L'], stock: {S:9, M:14, L:8} },
    { id: 29, name: 'Midnight Warrior', price: 580, category: 'unica', img: 'img/products/unica-4.webp', sizes: ['S','M','L'], stock: {S:12, M:10, L:16} },
    { id: 30, name: 'Fire & Gold', price: 590, category: 'unica', img: 'img/products/unica-5.webp', sizes: ['M','L'], stock: {M:15, L:11} },
    { id: 31, name: 'Legendary Nica', price: 670, category: 'unica', img: 'img/products/unica-6.webp', sizes: ['S','M','L'], stock: {S:8, M:12, L:14} }
  ];

  const validate = catalog => {
    const validCategories = new Set(['fauna', 'anime', 'urbano', 'games', 'unica']);
    const validSizes = new Set(['S', 'M', 'L']);
    const ids = new Set();
    catalog.forEach((product, index) => {
      if (!Number.isInteger(product.id) || ids.has(product.id)) throw new Error(`ID de producto inválido o repetido en la posición ${index + 1}`);
      ids.add(product.id);
      if (!product.name || !Number.isFinite(product.price) || product.price <= 0) throw new Error(`Nombre o precio inválido en el producto ${product.id}`);
      if (!validCategories.has(product.category)) throw new Error(`Categoría inválida en el producto ${product.id}`);
      if (!/^img\/products\/[a-z0-9-]+\.webp$/i.test(product.img)) throw new Error(`Ruta de imagen inválida en el producto ${product.id}`);
      if (!Array.isArray(product.sizes) || product.sizes.length === 0 || product.sizes.some(size => !validSizes.has(size))) throw new Error(`Tallas inválidas en el producto ${product.id}`);
      if (Object.keys(product.stock).some(size => !product.sizes.includes(size)) || product.sizes.some(size => !Number.isInteger(product.stock[size]) || product.stock[size] < 0)) throw new Error(`Stock inválido en el producto ${product.id}`);
      if ('published' in product && typeof product.published !== 'boolean') throw new Error(`Estado de publicación inválido en el producto ${product.id}`);
      if ('featured' in product && typeof product.featured !== 'boolean') throw new Error(`Estado destacado inválido en el producto ${product.id}`);
    });
    return true;
  };

  validate(products);
  const catalog = Object.freeze({ products: Object.freeze(products), validate });
  globalThis.MomotusCatalog = catalog;
  if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
})();
