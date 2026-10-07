> Actualización: los cinco espacios por tema (IDs 79–108) ya están habilitados. Para añadir solo los mockups, consultar ESPACIOS-URBANOS-HABILITADOS.md. Las instrucciones de publicación manual de abajo corresponden a los demás borradores.

# Tienda: destacados, espacios urbanos y carpetas

«Todos» muestra dos destacados por categoría (diez diseños con el catálogo actual), con un botón para explorar cada colección. No repite el mismo diseño al elegir Todas las prendas. No supone ventas: es una selección editorial, editable con Destacado en administracion/. Si se buscan términos, favoritos, precios o un orden específico, se muestran los resultados completos que coincidan. Agüizotes mantiene su decoración y aparece al seleccionar su categoría.

## Espacios nuevos

Se sumaron treinta diseños base, cada uno con camiseta, hoodie, sudadera y crop-top: 120 referencias nuevas, además de los borradores anteriores. Sus nombres, precio inicial y rutas están preparados; permanecen sin stock y en borrador. Al elegir un tema urbano se ven cinco tarjetas Próximamente, sin compra, talla ni precio. Al publicar esa prenda, la tarjeta pasa al catálogo y sale de los espacios pendientes. Los contadores de los filtros indican productos publicados; el texto Espacios nuevos indica los pendientes.

| Tema | Cinco IDs nuevos | Carpeta |
|---|---|---|
| Música | 79–83 | img/products/urbano/musica/ |
| Motor | 84–88 | img/products/urbano/motor/ |
| Cine y terror | 89–93 | img/products/urbano/cine-terror/ |
| Streetwear | 94–98 | img/products/urbano/streetwear/ |
| Arte y tipografía | 99–103 | img/products/urbano/arte-tipografia/ |
| Deportes | 104–108 | img/products/urbano/deportes/ |

## Orden de las imágenes

Cada colección tiene su carpeta: img/products/fauna/, anime/, games/, unica/ y urbano/. Las temporadas tienen aguizotes/aguizotes-2026/ y navidad/navidad-2026/. Urbanas se divide por tema como indica la tabla. Dentro de cada carpeta, variants/ contiene las otras prendas y previews/ las vistas ligeras existentes. Las fotografías originales y las vistas previas se trasladaron sin recomprimirlas.

Las camisetas actuales conservan su nombre de archivo. Para un nuevo diseño urbano ID 79:

- Camiseta: img/products/urbano/musica/urbano-79.webp
- Hoodie: img/products/urbano/musica/variants/79-hoodie.webp
- Sudadera: img/products/urbano/musica/variants/79-sudadera.webp
- Crop-top: img/products/urbano/musica/variants/79-crop-top.webp

MAPA-IMAGENES-TIENDA.csv enumera los 108 diseños base y las cuatro rutas de cada uno; no todas las fotos existen todavía. Los README mantienen visibles las carpetas preparadas.

## Publicar un diseño

1. Colocar los mockups en sus rutas.
2. Abrir administracion/ y buscar el ID (por ejemplo 79; las variantes son 1079, 2079, 3079).
3. Confirmar nombre, precio, tallas, stock e imagen. Activar Publicado en las prendas que estén listas. Activar Destacado para priorizarlo en Todos.
4. Exportar la configuración y reemplazar tienda/js/configuracion.js según la guía de administración existente.

Las configuraciones anteriores que usan rutas antiguas conocidas se adaptan automáticamente a las carpetas nuevas. Las rutas personalizadas se conservan. Los IDs, carrito, favoritos, precios y existencias de los productos anteriores permanecen intactos.

## Instalación

Usar el proyecto completo para sustituir la versión anterior con copia de respaldo. La organización mueve archivos: copiar únicamente el JavaScript sin las imágenes en sus nuevas carpetas dejaría rutas incompletas. Las carpetas vacías antiguas img/products/variants/ y img/products/previews/ ya no se utilizan.

Las herramientas DTF y la estructura de Diseña la tuya se conservaron.
