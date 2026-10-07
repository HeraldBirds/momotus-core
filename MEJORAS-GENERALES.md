# Mejoras generales de Momotus Core

## Instalar

`momotus-core.zip` contiene el proyecto completo actualizado. `mejoras-generales-cambios.zip` contiene los archivos nuevos y modificados respecto a la entrega anterior con exportación grande y subcategorías urbanas. Extraer conservando las rutas. Probar con un servidor HTTP desde la raíz del proyecto (`python3 -m http.server 8000`).

## Tienda

Las fichas ofrecen acercamiento de la foto original, galería de imágenes adicionales, cambio a otras prendas del mismo diseño, disponibilidad por talla, descripción y plazo. Las tallas agotadas están deshabilitadas también para navegación con teclado.

La guía de tallas explica cómo medir una prenda extendida. Las medidas numéricas aparecen únicamente cuando se cargan valores reales desde el panel; mientras tanto se indica que están por confirmar. No se asignaron medidas ni fechas ficticias a los productos.

El carrito añade una revisión con imágenes, talla, cantidad y total antes de abrir WhatsApp. Puede descargarse un resumen PNG para adjuntarlo manualmente. WhatsApp no permite que un enlace de texto adjunte las imágenes de forma automática. El resumen es una referencia del pedido, no un archivo de impresión.

## Pedido personalizado

El personalizador organiza sus controles en cinco pasos: prenda y color, diseño, ubicación, talla y cantidad, y revisión. Se conserva la vista del mockup y se puede regresar a los pasos anteriores. La revisión muestra frente y espalda, posición, escala, giro y datos del pedido antes de abrir WhatsApp o correo. Rechaza cantidades fraccionarias y exige los datos de contacto y al menos un diseño.

La vista de referencia utiliza el generador de mockup que ya tenía el proyecto. El nuevo flujo no reescribe ni recomprime el arte cargado. Los archivos originales deben conservarse para impresión.

## Administración

Abrir `administracion/` desde el servidor del proyecto. Este panel administra un borrador local; no es un servidor con usuarios o escritura remota.

1. Elegir un producto para editar nombre, foto principal, fotos adicionales, precio, stock por talla, categoría, tema urbano, descripción, plazo y publicación.
2. Agregar nuevos productos, inicialmente ocultos como borrador. Su ID comienza en 4000 para conservar los anteriores.
3. Crear o renombrar categorías y cargar guías de tallas confirmadas.
4. Agregar fotos de trabajos reales con autorización. Añadir opiniones solamente después de comprobar la compra y contar con permiso de publicación. La verificación la realiza el administrador; no se inventan opiniones ni se genera una comprobación automática.
5. Pulsar **Exportar configuración de tienda** y reemplazar `tienda/js/configuracion.js` al subir el proyecto. Las imágenes nuevas se colocan en las rutas indicadas dentro de `img/`.
6. Guardar un respaldo JSON antes de cerrar y usar **Importar respaldo** para recuperar el catálogo en otro navegador.

El borrador se guarda en este navegador. Si el almacenamiento falla, permanece en memoria y puede exportarse. Una importación defectuosa conserva los cambios actuales. Las fotos y opiniones autorizadas aparecen en Inicio y Comunidad; ambos espacios mantienen su mensaje de invitación mientras no haya contenido real cargado.

Los visitantes no pueden cambiar el catálogo publicado mediante este editor. Solo la persona que sube el archivo exportado al alojamiento puede actualizarlo. Los plazos permanecen por confirmar hasta que el administrador los configure.

## Móvil y rendimiento

Se adaptaron fichas, controles del pedido, revisión y panel a pantallas pequeñas. Se añadieron estados de foco y controles nativos para facilitar teclado y lectores de pantalla.

Se generaron 33 miniaturas WebP de hasta 512 píxeles para las tarjetas de catálogo, conservando todas las fotos originales. Las tarjetas eligen entre miniatura y original según el tamaño de pantalla. El acercamiento utiliza la foto completa. El conjunto de miniaturas ocupa aproximadamente 23 MB menos que el conjunto de fotos originales; esto no equivale a una medición de tiempo de carga de cada página.

La configuración y el catálogo se consultan primero en red para evitar mostrar stock antiguo después de actualizar el sitio; la caché sigue disponible si no hay conexión.

## Calidad y comprobaciones

49 pruebas automatizadas aprobadas: se mantuvieron las 44 pruebas anteriores y se agregaron cinco para configuración del catálogo, conservación de IDs y datos, productos adicionales y validación de guías.

En Chromium se comprobaron edición de stock y precio, categorías, productos nuevos, exportación, recuperación del borrador, importación defectuosa, aplicación pública de una configuración de prueba, guía de tallas, variantes de prenda, acercamiento, revisión del carrito con descarga de resumen, contenido autorizado y flujo personalizado en una pantalla de 390 píxeles. No se enviaron pedidos reales durante las pruebas.

Se compararon 68 archivos protegidos byte por byte con la entrega anterior: todos los archivos de `herramientas/`, los módulos originales de herramientas del directorio raíz, el diseñador y sus módulos de procesamiento, el almacenamiento y puente de imágenes, las fotos originales de productos y la decoración de Agüizotes. Permanecen idénticos. Los cambios de esta entrega afectan a la interfaz y los datos comerciales, no a la resolución, colores, transparencia o motores de exportación de las herramientas.
