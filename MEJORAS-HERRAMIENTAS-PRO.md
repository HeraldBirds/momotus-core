> Actualización de carpetas: consultar TIENDA-CATEGORIAS-Y-CARPETAS.md y MAPA-IMAGENES-TIENDA.csv. Las rutas genéricas de esta guía anterior se sustituyen por las carpetas de cada categoría y tema.

# Herramientas profesionales y nuevos espacios urbanos

## Vectorización

El método predeterminado ahora traza contornos por color, con huecos transparentes y formas SVG editables. El método anterior de bloques sigue disponible. Se puede editar, unir y eliminar colores; deshacer y rehacer; comparar con un deslizador; ampliar la vista; consultar peso del archivo y complejidad. Los contornos se calculan en un proceso de trabajo separado.

El detalle de análisis admite hasta 2000 px por lado. La imagen original cargada se conserva. La simplificación de contornos vale cero por defecto y el redondeo de esquinas está desactivado: ambos controles son opcionales y pueden alterar detalles pequeños. El SVG es escalable; su fidelidad depende de la imagen, los colores y la resolución de análisis elegidos. La vista representa el SVG que se descarga.

## Calculadora DTF

Tres accesos: equipos, pedidos personalizados y diseño repetido. Equipos conserva nombres, números, prendas, tallas, copias y medidas editadas. Las referencias se alinean como filas editables y admiten ubicación del estampado. La tabla de resumen incluye subtotal proporcional al área más aplicación y preparación, con redondeo repartido para que los subtotales sumen el total.

El pedido personalizado compara distribución por lado mayor, área y altura; usa la de menor largo válido y muestra el ahorro respecto a la distribución sin giro. Es una estimación rectangular, no una garantía del mínimo global. Se puede seleccionar una pieza del esquema para identificar su referencia. El modo repetido compara capacidad y pliegos con la distribución sin giro.

Se guardan hasta 30 cotizaciones por modo y 30 perfiles de costos en el navegador. El pedido guardado conserva integrantes, medidas y costos. Las planchas vinculadas desde Producción se guardan en Producción. El cliente recibe un informe sin costos internos; el informe interno incluye costos y margen. Ambos se pueden imprimir o guardar como PDF desde la ventana de impresión.

## Efectos DTF

Miniaturas de las nueve técnicas generadas con el mismo motor. Los controles irrelevantes se ocultan según la técnica. Zonas y pincel están agrupados; se puede duplicar una zona con su máscara, renombrar, reordenar, deshacer y recuperar proyectos.

La muestra de 512 px se toma de la salida final y se recorre con controles horizontal y vertical. No modifica la exportación. Se conserva la revisión completa al 100 %. Antes de descargar se muestran centímetros, píxeles, resolución y zonas activas.

Salida PNG RGB con metadatos de 300 DPI, hasta 16384 px por lado y 64 millones de píxeles. La vista rápida y las miniaturas son reducidas; el archivo final conserva las dimensiones de impresión. El fondo de vista previa no se exporta. Bordado, chenille, puff, glitter y metálico representan apariencias impresas, no materiales o puntadas físicas.

## Interfaz

Se conservan el selector a la izquierda y el lienzo central. Las tres herramientas usan opciones a la derecha. Los controles del editor básico son grupos desplegables en el inspector, sin ventanas sobre el lienzo. Se mantiene el fondo grafito y los acentos de color. La barra técnica muestra los datos de la herramienta activa. La estructura de Diseña la tuya se conserva.

## Cinco espacios adicionales por subcategoría urbana

Cada ID corresponde a un diseño base, con camiseta, hoodie, sudadera y crop top. Se conservan los IDs anteriores. Los nuevos espacios son borradores con stock cero hasta colocar imágenes y publicar cada prenda desde administracion/.

| Subcategoría | IDs nuevos | Camisetas |
| --- | --- | --- |
| Música | 49, 50, 51, 52, 53 | img/products/urbano/musica/urbano-49.webp hasta urbano-53.webp |
| Motor | 54, 55, 56, 57, 58 | img/products/urbano/motor/urbano-54.webp hasta urbano-58.webp |
| Cine y terror | 59, 60, 61, 62, 63 | img/products/urbano/cine-terror/urbano-59.webp hasta urbano-63.webp |
| Streetwear | 64, 65, 66, 67, 68 | img/products/urbano/streetwear/urbano-64.webp hasta urbano-68.webp |
| Arte y tipografía | 69, 70, 71, 72, 73 | img/products/urbano/arte-tipografia/urbano-69.webp hasta urbano-73.webp |
| Deportes | 74, 75, 76, 77, 78 | img/products/urbano/deportes/urbano-74.webp hasta urbano-78.webp |

Para cada ID, las otras prendas usan:

- img/products/variants/ID-hoodie.webp
- img/products/variants/ID-sudadera.webp
- img/products/variants/ID-crop-top.webp

Ejemplo de Música, diseño 49: img/products/urbano/musica/urbano-49.webp, img/products/urbano/musica/variants/49-hoodie.webp, img/products/urbano/musica/variants/49-sudadera.webp y img/products/urbano/musica/variants/49-crop-top.webp. El número del archivo es el ID base, aunque el producto de hoodie tenga ID 1049.

Para publicar: colocar el mockup real, abrir administracion/, elegir la prenda, actualizar nombre, imagen, precio y stock, activar Publicado y exportar tienda/js/configuracion.js. Cada prenda se publica por separado. Los 144 productos publicados anteriores conservan sus datos.
