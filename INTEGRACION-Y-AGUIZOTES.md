# Integración de Efectos y categoría Agüizotes

Aplicar el paquete en la raíz del proyecto conservando sus rutas. Incluye únicamente archivos modificados respecto a la versión anterior con Efectos. El ZIP completo ya contiene todos los cambios.

- Efectos se identifica como documento activo para las transferencias.
- Acceso Aplicar efectos desde las herramientas de imagen.
- Envío a Calidad, Rango de color, Semitonos, Vectorización, Producción DTF y mockup.
- Producción DTF puede devolver el resultado a Efectos.
- Agüizotes aparece en el selector de categorías durante su disponibilidad estacional. Su sección decorada se muestra solo cuando se selecciona esa categoría.
- Cambiar de categoría, limpiar filtros o volver al catálogo permanente oculta la sección y recupera el catálogo.
- Se conservan tema, colores, decoraciones, productos, precios, consulta por WhatsApp y filtros internos de temporada. No se modificó temporadas.css.

Verificación: 33 pruebas automatizadas aprobadas; prueba de exportación anterior y recorridos de integración en Chromium. Se comprobó la transferencia real del PNG de Efectos al personalizador, Producción en ambos sentidos, importación de Vectorización, enlace directo de categoría, recarga, filtros, regreso al catálogo y pantalla móvil sin desbordamiento. No se enviaron mensajes a WhatsApp.
