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

    Imágenes de las prendas (reemplazá ID por el número del diseño base):
      img/products/CATEGORIA/variants/ID-hoodie.webp
      img/products/CATEGORIA/variants/ID-sudadera.webp
      img/products/CATEGORIA/variants/ID-crop-top.webp

    Mientras agregás esas imágenes, la tienda muestra un ícono de la prenda.
    Nunca usa la fotografía de la camiseta como reemplazo de otra prenda.
    El stock inicial de cada prenda conserva las tallas y cantidades del diseño base.

    Para un diseño Urbano, agregá subcategory: 'musica', 'motor',
    'cine-terror', 'streetwear', 'arte-tipografia' o 'deportes'. El tema se aplica a las cuatro prendas.

    Los nombres temporales independientes se editan en garmentProductNames.
    Fauna Nica conserva el mismo nombre en las cuatro prendas.
  */

  // Cada diseño urbano conserva su tema en todas las prendas.
  const urbanSubcategories = Object.freeze({
    musica: Object.freeze({label:'Música',icon:'fa-music',search:'bandas rock metal conciertos'}),
    motor: Object.freeze({label:'Motor',icon:'fa-car',search:'autos carros coches carreras drift'}),
    'cine-terror': Object.freeze({label:'Cine y terror',icon:'fa-film',search:'peliculas películas horror cine terror'}),
    streetwear: Object.freeze({label:'Streetwear',icon:'fa-shirt',search:'estilo callejero cyber urbano streetwear'}),
    'arte-tipografia': Object.freeze({label:'Arte y tipografía',icon:'fa-pen-nib',search:'arte ilustracion ilustración graffiti letras frases tipografia tipografía'}),
    deportes: Object.freeze({label:'Deportes',icon:'fa-basketball',search:'deporte deportes basketball basquet fútbol futbol skate'})
  });

  const imagePaths = globalThis.MomotusProductImages || (typeof require === 'function' ? require('./product-images.js') : null);

  const baseProducts = [
    { id: 1, name: 'Agelaius phoeniceus', price: 550, category: 'fauna', img: 'img/products/fauna/nica-1.webp', sizes: ['S','M','L'], stock: {S:12, M:25, L:18}, featured: true },
    { id: 2, name: 'Asio clamator', price: 550, category: 'fauna', img: 'img/products/fauna/nica-2.webp', sizes: ['M','L'], stock: {M:15, L:12}, featured: true },
    { id: 3, name: 'Strix virgata', price: 550, category: 'fauna', img: 'img/products/fauna/nica-3.webp', sizes: ['S','M','L'], stock: {S:20, M:14, L:10} },
    { id: 4, name: 'Bandera Nica Pride', price: 550, category: 'unica', img: 'img/products/unica/nica-4.webp', sizes: ['S','M','L'], stock: {S:10, M:22, L:15} },
    { id: 5, name: 'Sasuke Uchiha Edition', price: 550, category: 'anime', img: 'img/products/anime/anime-1.webp', sizes: ['S','M','L'], stock: {S:15, M:20, L:12} },
    { id: 6, name: 'Kento Nanami', price: 550, category: 'anime', img: 'img/products/anime/anime-2.webp', sizes: ['M','L'], stock: {M:18, L:14} },
    { id: 7, name: 'Satoru Gojō', price: 550, category: 'anime', img: 'img/products/anime/anime-3.webp', sizes: ['S','M','L'], stock: {S:11, M:19, L:13} },
    { id: 8, name: 'Maki Zenin', price: 500, category: 'anime', img: 'img/products/anime/anime-4.webp', sizes: ['S','M','L'], stock: {S:14, M:22, L:16} },
    { id: 9, name: 'Mewtwo', price: 450, category: 'anime', img: 'img/products/anime/anime-5.webp', sizes: ['S','M','L'], stock: {S:18, M:12, L:15} },
    { id: 10, name: 'Itachi Uchiha', price: 450, category: 'anime', img: 'img/products/anime/anime-6.webp', sizes: ['S','M','L'], stock: {S:13, M:17, L:11} },
    { id: 11, name: 'Hellsing', price: 500, category: 'anime', img: 'img/products/anime/anime-7.webp', sizes: ['M','L'], stock: {M:20, L:14} },
    { id: 12, name: 'Death Note', price: 450, category: 'anime', img: 'img/products/anime/anime-8.webp', sizes: ['S','M','L'], stock: {S:16, M:13, L:19} },
    { id: 13, name: 'Death Note 2.1', price: 450, category: 'anime', img: 'img/products/anime/anime-9.webp', sizes: ['S','M','L'], stock: {S:12, M:15, L:10}, featured: true },
    { id: 14, name: 'Mob Psycho 100', price: 550, category: 'anime', img: 'img/products/anime/anime-10.webp', sizes: ['S','M','L'], stock: {S:14, M:21, L:12}, featured: true },
    { id: 15, name: 'Trueno AE86', subcategory: 'motor', price: 400, category: 'urbano', img: 'img/products/urbano/motor/urbano-1.webp', sizes: ['M','L'], stock: {M:8, L:17} },
    { id: 16, name: 'Cyber Style', subcategory: 'streetwear', price: 400, category: 'urbano', img: 'img/products/urbano/streetwear/urbano-2.webp', sizes: ['S','M','L'], stock: {S:15, M:19, L:12} },
    { id: 17, name: 'Iron Maiden', subcategory: 'musica', price: 450, category: 'urbano', img: 'img/products/urbano/musica/urbano-3.webp', sizes: ['S','M','L'], stock: {S:10, M:14, L:9}, featured: true },
    { id: 18, name: 'Ghostface', subcategory: 'cine-terror', price: 450, category: 'urbano', img: 'img/products/urbano/cine-terror/urbano-4.webp', sizes: ['S','M','L'], stock: {S:13, M:16, L:11}, featured: true },
    { id: 19, name: 'NFC', subcategory: 'streetwear', price: 450, category: 'urbano', img: 'img/products/urbano/streetwear/urbano-5.webp', sizes: ['S','M','L'], stock: {S:13, M:16, L:11} },
    { id: 20, name: 'Hollow Knight', price: 500, category: 'games', img: 'img/products/games/game-1.webp', sizes: ['S','M','L'], stock: {S:10, M:16, L:13}, featured: true },
    { id: 21, name: 'Silent Hill F', price: 550, category: 'games', img: 'img/products/games/game-2.webp', sizes: ['M','L'], stock: {M:12, L:15}, featured: true },
    { id: 22, name: 'Kratos Edition', price: 550, category: 'games', img: 'img/products/games/game-3.webp', sizes: ['S','M','L'], stock: {S:14, M:18, L:10} },
    { id: 23, name: 'Raccoon City', price: 500, category: 'games', img: 'img/products/games/game-4.webp', sizes: ['S','M','L'], stock: {S:9, M:15, L:12} },
    { id: 24, name: 'Minecraft Nicaragua', price: 465, category: 'games', img: 'img/products/games/game-5.webp', sizes: ['S','M','L'], stock: {S:11, M:17, L:14} },
    { id: 25, name: 'Zelda Legend Nica', price: 530, category: 'games', img: 'img/products/games/game-6.webp', sizes: ['M','L'], stock: {M:13, L:16} },
    { id: 26, name: 'Limited Edition 001', price: 650, category: 'unica', img: 'img/products/unica/unica-1.webp', sizes: ['L'], stock: {L:15}, featured: true },
    { id: 27, name: 'Limited Edition 002', price: 500, category: 'unica', img: 'img/products/unica/unica-2.webp', sizes: ['M','L'], stock: {M:11, L:20} },
    { id: 28, name: 'Eclipse Nica', price: 620, category: 'unica', img: 'img/products/unica/unica-3.webp', sizes: ['S','M','L'], stock: {S:9, M:14, L:8}, featured: true },
    { id: 29, name: 'Midnight Warrior', price: 580, category: 'unica', img: 'img/products/unica/unica-4.webp', sizes: ['S','M','L'], stock: {S:12, M:10, L:16} },
    { id: 30, name: 'Fire & Gold', price: 590, category: 'unica', img: 'img/products/unica/unica-5.webp', sizes: ['M','L'], stock: {M:15, L:11} },
    { id: 31, name: 'Legendary Nica', price: 670, category: 'unica', img: 'img/products/unica/unica-6.webp', sizes: ['S','M','L'], stock: {S:8, M:12, L:14} },

    // Cinco diseños adicionales de Fauna Nica, visibles mientras se agregan sus imágenes.
    { id: 32, name: 'Eumomota superciliosa', price: 550, category: 'fauna', img: 'img/products/fauna/fauna-32.webp', sizes: ['S','M','L'], stock: {S:10, M:10, L:10} },
    { id: 33, name: 'Ramphastos sulfuratus', price: 550, category: 'fauna', img: 'img/products/fauna/fauna-33.webp', sizes: ['S','M','L'], stock: {S:10, M:10, L:10} },
    { id: 34, name: 'Amazilia cyanura', price: 550, category: 'fauna', img: 'img/products/fauna/fauna-34.webp', sizes: ['S','M','L'], stock: {S:10, M:10, L:10} },
    { id: 35, name: 'Trogon melanocephalus', price: 550, category: 'fauna', img: 'img/products/fauna/fauna-35.webp', sizes: ['S','M','L'], stock: {S:10, M:10, L:10} },
    { id: 36, name: 'Calocitta formosa', price: 550, category: 'fauna', img: 'img/products/fauna/fauna-36.webp', sizes: ['S','M','L'], stock: {S:10, M:10, L:10} }
  ];

  Object.keys(urbanSubcategories).forEach((topic, index) => {
    for (let slot = 0; slot < 2; slot++) {
      const id = 37 + index * 2 + slot;
      baseProducts.push({id, name: `${urbanSubcategories[topic].label} · diseño ${slot + 1}`, category:'urbano', subcategory:topic, price:450, img:`img/products/urbano/${topic}/urbano-${id}.webp`, sizes:['S','M','L'], stock:{S:0,M:0,L:0}, published:false});
    }
  });

  // Cinco espacios adicionales por subcategoría. Cada diseño incluye cuatro prendas.
  Object.keys(urbanSubcategories).forEach((topic,index)=>{
    for(let slot=0;slot<5;slot++){
      const id=49+index*5+slot;
      baseProducts.push({id,name:`${urbanSubcategories[topic].label} · diseño ${slot+3}`,category:'urbano',subcategory:topic,price:450,img:`img/products/urbano/${topic}/urbano-${id}.webp`,sizes:['S','M','L'],stock:{S:0,M:0,L:0},published:false});
    }
  });

  // Cinco nuevos espacios por tema, habilitados para agregar sus mockups.
  Object.keys(urbanSubcategories).forEach((topic,index)=>{
    for(let slot=0;slot<5;slot++){
      const id=79+index*5+slot;
      baseProducts.push({id,name:`${urbanSubcategories[topic].label} · diseño ${slot+8}`,category:'urbano',subcategory:topic,price:450,img:`img/products/urbano/${topic}/urbano-${id}.webp`,sizes:['S','M','L'],stock:{S:0,M:0,L:0},published:true});
    }
  });
  baseProducts.forEach(product=>{product.img=imagePaths.legacy(product.img);});

  const garmentProductNames = Object.freeze({
    hoodie: Object.freeze({
      4: 'Orgullo Pinolero', 5: 'Sombra Shinobi', 6: 'Tiempo Dorado', 7: 'Infinito Azul',
      8: 'Filo Carmesí', 9: 'Aura Psíquica', 10: 'Luna Escarlata', 11: 'Noche Inmortal',
      12: 'Cuaderno Oscuro', 13: 'Juicio Nocturno', 14: 'Poder Interior', 15: 'Ruta Hachiroku',
      16: 'Neón Digital', 17: 'Acero Rebelde', 18: 'Grito de Medianoche', 19: 'Frecuencia Callejera',
      20: 'Reino Vacío', 21: 'Niebla Carmesí', 22: 'Furia del Norte', 23: 'Zona Cero',
      24: 'Bloques del Lago', 25: 'Leyenda del Reino', 26: 'Serie Negra 001', 27: 'Serie Negra 002',
      28: 'Eclipse Dorado', 29: 'Guardián Nocturno', 30: 'Fuego Imperial', 31: 'Alma Legendaria'
    }),
    sudadera: Object.freeze({
      4: 'Raíces de Nicaragua', 5: 'Heredero de la Sombra', 6: 'Ejecutivo Maldito', 7: 'Dominio Infinito',
      8: 'Guerrera Zen', 9: 'Génesis Psíquico', 10: 'Cuervo Carmesí', 11: 'Sello Ancestral',
      12: 'Última Sentencia', 13: 'Justicia Oscura', 14: 'Energía al Cien', 15: 'Leyenda del Asfalto',
      16: 'Distrito Cibernético', 17: 'Metal Eterno', 18: 'Máscara Urbana', 19: 'Conexión Nica',
      20: 'Caballero del Abismo', 21: 'Pueblo de la Niebla', 22: 'Guerrero de Ceniza', 23: 'Ciudad Perdida',
      24: 'Mundo en Bloques', 25: 'Trifuerza Ancestral', 26: 'Edición Reserva 01', 27: 'Edición Reserva 02',
      28: 'Sol Negro Nica', 29: 'Centinela de Medianoche', 30: 'Brasas de Oro', 31: 'Mito Nicaragüense'
    }),
    'crop-top': Object.freeze({
      4: 'Corazón Pinolero', 5: 'Relámpago Ninja', 6: 'Hora Exacta', 7: 'Azul Infinito',
      8: 'Rosa de Acero', 9: 'Poder Mental', 10: 'Nube Roja', 11: 'Luna Carmesí',
      12: 'Nota Final', 13: 'Sombra 2.1', 14: 'Espíritu Cien', 15: 'Calle 86',
      16: 'Chica Cyber', 17: 'Rock de Acero', 18: 'Noche de Máscaras', 19: 'Señal Urbana',
      20: 'Pequeño Caballero', 21: 'Flor de Niebla', 22: 'Fuerza del Olimpo', 23: 'Último Refugio',
      24: 'Bloques Nicas', 25: 'Reino Dorado', 26: 'Única 001', 27: 'Única 002',
      28: 'Eclipse Tropical', 29: 'Guerrera de Medianoche', 30: 'Llama Dorada', 31: 'Leyenda Viva'
    })
  });

  const garmentPriceRanges = Object.freeze({
    hoodie: Object.freeze({ min: 800, max: 1300 }),
    sudadera: Object.freeze({ min: 380, max: 660 }),
    'crop-top': Object.freeze({ min: 150, max: 300 })
  });

  const garmentDefinitions = Object.freeze({
    camiseta: Object.freeze({ name: 'Camiseta', idOffset: 0 }),
    hoodie: Object.freeze({ name: 'Hoodie', idOffset: 1000 }),
    sudadera: Object.freeze({ name: 'Sudadera', idOffset: 2000 }),
    'crop-top': Object.freeze({ name: 'Crop-top', idOffset: 3000 })
  });
  const garmentOrder = ['camiseta', 'hoodie', 'sudadera', 'crop-top'];
  const basePriceMin = Math.min(...baseProducts.map(product => product.price));
  const basePriceMax = Math.max(...baseProducts.map(product => product.price));
  const calculateVariantPrice = (basePrice, range) => {
    const ratio = basePriceMax === basePriceMin ? 0 : (basePrice - basePriceMin) / (basePriceMax - basePriceMin);
    return Math.round((range.min + ratio * (range.max - range.min)) / 10) * 10;
  };
  const copyStock = product => Object.fromEntries(product.sizes.map(size => [size, product.stock[size]]));
  const getGarmentPrice = (product, garmentKey) => garmentKey === 'camiseta'
    ? product.price
    : calculateVariantPrice(product.price, garmentPriceRanges[garmentKey]);
  const getGarmentImage = (product, garmentKey) => garmentKey === 'camiseta'
    ? product.img
    : `${imagePaths.folder(product)}/variants/${product.id}-${garmentKey}.webp`;
  const getProductDisplayName = (product, garmentKey) => product.category === 'fauna'
    ? product.name
    : garmentProductNames[garmentKey]?.[product.id] || (product.id >= 37 && garmentKey !== 'camiseta' ? product.name.replace('diseño', garmentDefinitions[garmentKey].name) : product.name);

  const products = garmentOrder.flatMap(garmentKey => baseProducts.map(product => {
    const garment = garmentDefinitions[garmentKey];
    const displayName = getProductDisplayName(product, garmentKey);
    return {
      id: garment.idOffset + product.id,
      baseDesignId: product.id,
      baseName: displayName,
      name: `${displayName} — ${garment.name}`,
      price: getGarmentPrice(product, garmentKey),
      category: product.category,
      ...(product.category === 'urbano' ? {subcategory:product.subcategory || 'streetwear'} : {}),
      garment: garmentKey,
      garmentName: garment.name,
      img: getGarmentImage(product, garmentKey),
      fallbackImg: '',
      sizes: [...product.sizes],
      stock: copyStock(product),
      ...(typeof product.published === 'boolean' ? { published: product.published } : {}),
      ...(product.featured === true ? { featured: true } : {})
    };
  }));

  const validate = catalog => {
    const validCategories = new Set(['fauna', 'anime', 'urbano', 'games', 'unica']);
    const validSizes = new Set(['S', 'M', 'L']);
    const validGarments = new Set(['camiseta', 'hoodie', 'sudadera', 'crop-top']);
    const ids = new Set();
    catalog.forEach((product, index) => {
      if (!Number.isInteger(product.id) || ids.has(product.id)) throw new Error(`ID de producto inválido o repetido en la posición ${index + 1}`);
      ids.add(product.id);
      if (!product.name || !Number.isFinite(product.price) || product.price <= 0) throw new Error(`Nombre o precio inválido en el producto ${product.id}`);
      if (product.category === 'urbano' && !Object.hasOwn(urbanSubcategories,product.subcategory)) throw new Error(`Subcategoría urbana inválida en el producto ${product.id}`);
      if (!validCategories.has(product.category)) throw new Error(`Categoría inválida en el producto ${product.id}`);
      if (!/^img\/products\/(?:[a-z0-9-]+\/)*[a-z0-9-]+\.webp$/i.test(product.img)) throw new Error(`Ruta de imagen inválida en el producto ${product.id}`);
      if (!Array.isArray(product.sizes) || product.sizes.length === 0 || product.sizes.some(size => !validSizes.has(size))) throw new Error(`Tallas inválidas en el producto ${product.id}`);
      if (Object.keys(product.stock).some(size => !product.sizes.includes(size)) || product.sizes.some(size => !Number.isInteger(product.stock[size]) || product.stock[size] < 0)) throw new Error(`Stock inválido en el producto ${product.id}`);
      if (!validGarments.has(product.garment) || !product.garmentName) throw new Error(`Prenda inválida en el producto ${product.id}`);
      if (!Number.isInteger(product.baseDesignId) || product.baseDesignId < 1 || product.baseDesignId > baseProducts.length) throw new Error(`Diseño base inválido en el producto ${product.id}`);
      if (product.garment === 'hoodie' && (product.price < 800 || product.price > 1300)) throw new Error(`Precio de hoodie fuera de rango en el producto ${product.id}`);
      if (product.garment === 'sudadera' && (product.price < 380 || product.price > 660)) throw new Error(`Precio de sudadera fuera de rango en el producto ${product.id}`);
      if (product.garment === 'crop-top' && (product.price < 150 || product.price > 300)) throw new Error(`Precio de crop-top fuera de rango en el producto ${product.id}`);
      if ('published' in product && typeof product.published !== 'boolean') throw new Error(`Estado de publicación inválido en el producto ${product.id}`);
      if ('featured' in product && typeof product.featured !== 'boolean') throw new Error(`Estado destacado inválido en el producto ${product.id}`);
    });
    baseProducts.forEach(baseProduct => {
      const names = new Set(catalog.filter(product => product.baseDesignId === baseProduct.id).map(product => product.baseName));
      if (baseProduct.category === 'fauna' && names.size !== 1) throw new Error(`Fauna Nica debe conservar el mismo nombre en el diseño ${baseProduct.id}`);
      if (baseProduct.category !== 'fauna' && names.size !== garmentOrder.length) throw new Error(`Los nombres deben ser independientes en el diseño ${baseProduct.id}`);
    });
    return true;
  };

  let settings = globalThis.MomotusStoreConfig || {version:1,products:{}};
  let configured = products;
  try { if(globalThis.MomotusStoreConfigCore) configured=globalThis.MomotusStoreConfigCore.apply(products,settings); } catch(error) { console.warn('Configuración inválida; se conserva el catálogo original.',error.message); settings=globalThis.MomotusStoreConfigCore.blank(); }
  validate(products);
  const catalog = Object.freeze({ urbanSubcategories, products: Object.freeze(configured), originalProducts: Object.freeze(products), settings, validate, garmentOrder: Object.freeze([...garmentOrder]) });
  globalThis.MomotusCatalog = catalog;
  if (typeof module !== 'undefined' && module.exports) module.exports = catalog;
})();
