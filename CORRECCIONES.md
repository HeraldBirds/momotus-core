# Momotus Core — revisión del 6 de octubre de 2026

## Cambios

- El carrito continúa hacia WhatsApp en la misma pestaña y conserva sus productos. Ya no confunde la protección `noopener` con un bloqueo de ventanas emergentes.
- El guardado espera la confirmación de la transacción IndexedDB, detecta cancelaciones y serializa guardados y borrados. El respaldo conserva ambas imágenes cuando IndexedDB no está disponible.
- Se guarda el proyecto antes de abrir Herramientas y antes de eliminar una transferencia importada. Si falla el guardado, la transferencia importada sigue disponible.
- La tienda se recupera cuando el almacenamiento local está bloqueado o contiene JSON inválido.
- La vista previa conserva los colores del diseño sobre prendas claras y oscuras, sin multiplicación de colores ni filtros de contraste.
- El indicador muestra los píxeles y las medidas correspondientes a 300 DPI; evita prometer calidad de impresión sin conocer la medida final.
- El ajuste automático exporta PNG sin pérdida. Nunca reduce silenciosamente un original: si supera 8 millones de píxeles o 3600 píxeles por lado, conserva el archivo e indica usar el estudio DTF. La eliminación automática usa los mismos límites de memoria.
- Los diseños listos usan la misma validación y aplicación que los archivos subidos. Su contador refleja las cuatro imágenes disponibles.
- Los cuatro archivos D1–D4 son WebP reales, convertidos sin pérdida; sus píxeles RGBA son idénticos al original. Los PNG originales se mantienen.
- Tailwind se entrega como CSS compilado. Font Awesome 6.6.0 y html2canvas 1.4.1 se incluyen localmente, con sus licencias, para evitar depender de CDNs durante el uso.
- Se corrigió el formato de la cabecera CSP y se actualizaron las versiones de recursos y caché.
- La caché espera a completar sus actualizaciones. Los módulos DTF pueden reintentar su carga tras un fallo de red.

## Uso y mantenimiento

El sitio sigue siendo estático. Publicar el contenido de la carpeta `momotus-core` en el alojamiento habitual; no necesita Node ni un servidor de aplicación. Para probarlo localmente, servir esa carpeta por HTTP, por ejemplo con `python -m http.server 8000`, y abrir `http://localhost:8000/`.

Después de cambiar clases de Tailwind en HTML o JavaScript:

```sh
npm ci
npm run build:css
```

Las dependencias npm son solamente para desarrollo. `node_modules` no forma parte del ZIP.

Las herramientas activas se cargan desde `herramientas/js/`. Las versiones anteriores de `js/tools*.js` se conservan por compatibilidad: no se sustituyeron módulos históricos por otros con interfaces diferentes. El catálogo activo está en `tienda/js/catalogo.js`.

## Verificación

- Pruebas automatizadas de persistencia de frente/espalda, transformaciones, borrado con guardados pendientes, respaldo local, transacción abortada, almacenamiento bloqueado/corrupto, preservación de detalles interiores al eliminar fondo y formato WebP.
- Recorridos en Chromium de escritorio y móvil: tienda, selección de talla, carrito, paso hacia WhatsApp interceptado localmente, recuperación del diseñador, procesamiento con Workers, protección de imágenes grandes, exportación de vista previa, transferencia local de imagen, vectorización, calculadora de equipos, módulo de producción y acceso móvil.
- Comprobación de sintaxis JavaScript y rutas locales de HTML.

Ejecutar las pruebas de regresión con `npm ci` y `npm test`.

## Datos que se conservan

Los precios, stock, fotografías y diseños comerciales se mantienen. Varias imágenes de productos son iguales y faltan fotos de temporadas y de variantes: el sitio conserva sus reemplazos visuales existentes hasta que se añadan imágenes reales. No se inventaron fotografías.

El inventario sigue siendo local al catálogo. No hay un servidor de pedidos ni reserva de stock entre compradores; la disponibilidad y el total se confirman manualmente por WhatsApp. Esta revisión no añade un sistema de pagos ni publica el sitio.
