# Reglas, guías y cotización de medidas

## Ayudas de trabajo

Las herramientas básicas, vectorización, efectos, los dos esquemas de la calculadora y el documento de Producción DTF tienen acceso a Reglas y guías. Las reglas usan centímetros del tamaño final, con origen en la esquina superior izquierda del documento. La escala acompaña el zoom y el desplazamiento de la vista. Las coordenadas del cursor se muestran sobre el área de trabajo.

En el esquema de pedidos, el origen y la escala corresponden al rollo dibujado, no a los bordes externos del canvas de vista previa. En diseño repetido, corresponden al pliego.

- Arrastrar desde la regla horizontal crea una guía horizontal.
- Arrastrar desde la regla vertical crea una guía vertical.
- Arrastrar una guía cambia su posición.
- Reglas y guías permite escribir posiciones exactas, bloquear, ocultar y eliminar guías, y mostrar centro y márgenes.
- El ajuste opcional aproxima las guías a bordes, centro, márgenes y otras guías de la misma orientación. No mueve ni modifica imágenes.
- Las guías se conservan por herramienta durante la sesión de la pestaña, con un máximo de 40. No se guardan en los proyectos ni en las exportaciones.

La navegación Diseño, Ajustes y Salida facilita acceder a las opciones del inspector. La barra de vista se adapta para que sus botones no queden cubiertos por el estado del resultado.

## Cotizar medidas

1. Cargar el diseño en la herramienta y configurar su tamaño de impresión donde corresponda.
2. Pulsar Cotizar medidas.
3. Revisar ancho y alto en centímetros, nombre y cantidad de copias.
4. Elegir Agregar al pedido por metro para sumar una referencia sin borrar las anteriores. La calculadora combina medidas y copias con el ancho útil, separación y márgenes para estimar el material.
5. Alternativamente, elegir Diseño repetido por pliego para sustituir las medidas y cantidad de ese modo técnico.

La transferencia contiene únicamente ancho, alto, nombre y cantidad. No contiene PNG, SVG, vista previa, canvas, máscara ni archivo. Se pueden editar las medidas en el diálogo para cotizar otro tamaño; esa edición no cambia el archivo de trabajo.

Las medidas son las del lienzo completo, incluidos márgenes transparentes. No se recorta ni analiza el contenido para inventar una superficie imprimible. Los nombres y números de equipos continúan con sus propias medidas editables.

En los editores raster, las medidas se calculan a partir de los píxeles finales y los 300 DPI de salida, respetando los límites existentes. En Rango de color se usa el tamaño del canvas de salida del módulo; en vectorización, las dimensiones físicas del SVG; en efectos, las del PNG final. Por ello una vista previa reducida no se utiliza como tamaño de impresión. Se muestran tres decimales en el diálogo y las referencias admiten esa precisión.

El pedido por metro admite medidas positivas hasta 300 cm y 1–1000 copias por referencia, dentro de los límites existentes del pedido. El modo por pliego conserva su intervalo de ancho 1–150 cm y alto 1–300 cm. Para tamaños menores se puede usar el pedido por metro.

## Calidad y verificación

Las reglas, líneas y coordenadas son elementos de interfaz separados del canvas del arte. No se dibujan en la imagen ni cambian su resolución, colores, transparencia o metadatos. La descarga PNG de efectos fue comparada antes y después de activar las guías: archivos idénticos.

La estructura de Diseña la tuya, la tienda, los productos urbanos y los archivos de imagen se conservan. Se añadieron pruebas de conversión de coordenadas con zoom, medidas a 300 DPI, ajuste de guías y validación de la transferencia sin imágenes, además de comprobaciones en navegador.
