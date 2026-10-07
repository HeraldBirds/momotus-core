# Corrección de exportación y subcategorías Urbanas

El proyecto completo está en `momotus-core.zip`. Para actualizar la entrega anterior con zonas e historial de Efectos, extraer `exportacion-y-urbanas-cambios.zip` en la raíz conservando las rutas.

## Efectos

Se reemplazó el límite de 8000 píxeles por lado / 16 millones de píxeles por **16 384 píxeles por lado / 64 millones de píxeles**. Se conservan el ancho solicitado, la proporción y los 300 DPI. Las salidas grandes se procesan por franjas con coordenadas globales, protección de negro, máscaras y lectura de vecinos para el relieve. No se disminuye la resolución en silencio.

Descargas comprobadas: 1200 × 9000 y 4134 × 4134 píxeles, ambas con alfa y aproximadamente 300 DPI. El límite restante protege la memoria del navegador. Otras herramientas mantienen sus propias restricciones al importar un resultado.

## Urbano → temas

Las subcategorías aparecen únicamente al seleccionar Urbano:

| Tema | Diseños actuales |
|---|---|
| Música | Iron Maiden y sus variantes de prenda |
| Motor | Trueno AE86 y sus variantes |
| Cine y terror | Ghostface y sus variantes |
| Streetwear | Cyber Style, NFC y sus variantes |

Los filtros se combinan con prenda, búsqueda, precio y favoritos. El tema seleccionado queda en la URL, por ejemplo `tienda/?categoria=urbano&subcategoria=musica`, y se recupera al recargar. Cambiar de categoría o limpiar filtros restablece Todos los urbanos.

Para clasificar un nuevo producto, editar el diseño base en `tienda/js/catalogo.js` y agregar `subcategory: 'musica'`, `'motor'`, `'cine-terror'` o `'streetwear'`. Las cuatro prendas heredan ese tema. Los diseños urbanos sin clasificación explícita usan Streetwear. Los precios, stock e identificadores anteriores se conservan.

## Verificación

44 pruebas automatizadas aprobadas. Navegador: exportación grande, transparencia, negro protegido, continuidad de franjas, subcategorías, herencia de tema por prenda, búsqueda, URL y recarga, limpiar filtros, temas inválidos y vista móvil. También se verificaron zonas, pincel, historial, proyectos y transferencias entre herramientas. La decoración de Agüizotes permanece intacta.
