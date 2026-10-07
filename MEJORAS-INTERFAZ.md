> Actualización de carpetas: consultar TIENDA-CATEGORIAS-Y-CARPETAS.md y MAPA-IMAGENES-TIENDA.csv. Las rutas genéricas de esta guía anterior se sustituyen por las carpetas de cada categoría y tema.

# Momotus Core · Tienda, personalizador y estudio

## Urbanas

Se conservan Música, Motor, Cine y terror y Streetwear. Se agregan Arte y tipografía (`arte-tipografia`) y Deportes (`deportes`). Los filtros, búsqueda, URLs, edición y validación admiten los seis temas.

El catálogo incorpora 42 diseños en borrador (168 productos al contar las cuatro prendas): los 12 espacios anteriores más 30 nuevos, cinco adicionales por cada subcategoría urbana. No están publicados y su stock es cero. Los 144 productos publicados anteriores mantienen sus datos. La cuadrícula de tienda permite cinco columnas en pantallas amplias y se adapta a tabletas y celulares.

| Tema | IDs base reservados | Imágenes de camiseta |
| --- | --- | --- |
| Música | 37, 38 | `img/products/urbano/musica/urbano-37.webp`, `img/products/urbano/musica/urbano-38.webp` |
| Motor | 39, 40 | `img/products/urbano/motor/urbano-39.webp`, `img/products/urbano/motor/urbano-40.webp` |
| Cine y terror | 41, 42 | `img/products/urbano/cine-terror/urbano-41.webp`, `img/products/urbano/cine-terror/urbano-42.webp` |
| Streetwear | 43, 44 | `img/products/urbano/streetwear/urbano-43.webp`, `img/products/urbano/streetwear/urbano-44.webp` |
| Arte y tipografía | 45, 46 | `img/products/urbano/arte-tipografia/urbano-45.webp`, `img/products/urbano/arte-tipografia/urbano-46.webp` |
| Deportes | 47, 48 | `img/products/urbano/deportes/urbano-47.webp`, `img/products/urbano/deportes/urbano-48.webp` |

Los cinco espacios adicionales de cada tema usan IDs 49–78. La tabla completa y las rutas nuevas están en MEJORAS-HERRAMIENTAS-PRO.md.

Para cada ID base, las variantes usan `img/products/variants/ID-hoodie.webp`, `ID-sudadera.webp` e `ID-crop-top.webp`. Es el ID base, no el ID del producto de la variante. Sus productos tienen IDs base +1000 para hoodie, +2000 para sudadera y +3000 para crop top.

Para publicar: colocar el mockup real, abrir `administracion/`, elegir el producto, actualizar nombre, foto, precio, stock y estado Publicado. Exportar la configuración y sustituir `tienda/js/configuracion.js` al subir el proyecto. Cada prenda se edita por separado. Los borradores no incluyen imágenes inventadas; las dos nuevas subcategorías estarán vacías hasta publicar diseños.

## Diseña la tuya

Se recupera la estructura anterior guardada en el proyecto: vista de prenda a la izquierda y panel continuo de opciones a la derecha con el encabezado Personalizá a tu gusto. Se conservan el mensaje de impresión DTF, los colores, botones y galería originales. No se generan bloques numerados ni pasos. Tamaño del estampado permanece junto a la vista; tipo, talla, color y cargas permanecen en el panel. Centrado y edición preceden a restablecer, y la cotización conserva su ubicación final.

Solo se afinan espacios, alineación y la cuadrícula de selección de prenda. En móvil se conserva la distribución intercalada original y se corrige el orden de las funciones automáticas. Motores, guardado, calidad, procesamiento automático y revisión del pedido siguen presentes.

## Herramientas

Navegación vertical compacta con nombres visibles, fondo oscuro y paneles grafito. Los iconos conservan acentos de amarillo, turquesa, azul, violeta, verde y rosa; los botones y estados activos resaltan con color. La distribución corregida se conserva. Efectos y la calculadora de equipos comparten la nueva estética. La barra superior organiza las acciones en filas cuando no caben. Su altura se adapta dentro de la cuadrícula, conservando el lienzo y los controles sin superposiciones. Se corrigió la altura fija heredada del módulo de mockup.

Los fondos de comprobación del diseño, canvas, máscaras, efectos, motores y exportaciones se conservan. Los cambios visuales están en `herramientas/css/studio-refresh.css`; no aplican filtros CSS a las imágenes ni cambian DPI o límites de exportación. La disponibilidad de herramientas en computadora se conserva.

## Verificación

- 51 pruebas automatizadas aprobadas.
- Recorridos en Chromium: filtros, publicación local de borrador, estructura anterior y opciones visibles del personalizador, carga, resumen, móvil de 390 px, efectos y calculadora de equipos.
- Todos los motores, imágenes y scripts de herramientas comparados byte a byte con la versión anterior, sin cambios.
- Estética y distribución comprobadas en las seis herramientas a 1440, 1280 y 1024 px: sin superposiciones ni desbordamiento horizontal.
