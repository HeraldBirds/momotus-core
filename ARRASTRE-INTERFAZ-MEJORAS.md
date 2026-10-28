# Carga por arrastre y espacio de edición

Actualización acumulativa del 21 de octubre de 2026. Se aplica sobre el proyecto original o cualquiera de los parches anteriores.

## Arrastrar imágenes

Podés soltar un archivo de tu equipo sobre el lienzo o el panel de opciones de Semitonos, Rango de color, Calidad y color, Vectorizar, Efectos y Producción DTF. La herramienta activa recibe la imagen usando su carga habitual, con sus decodificadores, límites y comprobaciones existentes. No cambia la resolución ni el motor de procesamiento por usar arrastre.

La interfaz resalta el destino mientras arrastrás y muestra un aviso al recibir el archivo. Se evita que el navegador abra la imagen en lugar de cargarla en la herramienta. Una caída sobre las zonas antiguas de carga también genera una sola carga.

- PNG, JPG y WebP. Los archivos sin tipo MIME reconocido pueden usar la extensión admitida; la herramienta comprueba y decodifica el contenido como antes.
- Una imagen por carga en los editores individuales. Varios archivos no sustituyen silenciosamente el documento por el primero.
- En Producción, la pestaña **Plancha** recibe varios diseños; **Lotes** recibe varios archivos para el procesamiento por lotes. Hasta treinta imágenes por carga. Un arrastre sobre la etiqueta **Abrir imagen** conserva su función de abrir un documento individual, incluso con otra pestaña activa.
- Si hay un proceso activo o una ventana de revisión abierta, se indica que debe terminarse o cerrarse antes de cargar otra imagen. Se conserva el documento existente.
- El Cotizador y Tipografías trabajan con medidas o texto; no importan imágenes por este canal.

El canal recibe archivos locales. No descarga imágenes desde enlaces arrastrados de otras páginas ni convierte archivos de proyecto, perfiles ICC o fuentes en imágenes. Las funciones originales para abrir esos archivos siguen disponibles.

## Vectorizar

El panel pasa de un ancho cercano a 300 px a un ancho adaptable de 360–440 px. **Ampliar panel** permite ensancharlo hasta 620 px según la pantalla y **Reducir panel** devuelve el ancho habitual.

Las nuevas pestañas muestran secciones independientes:

1. **Trazado:** abrir o arrastrar imagen, perfiles, análisis, colores, protección de blancos y paleta.
2. **Edición:** herramienta de selección, nodos y manejadores, coordenadas en milímetros, color de la selección y operaciones booleanas. Los objetos y la limpieza revisable están en un grupo desplegable.
3. **Salida:** guardar/abrir proyectos y descargar por color o PNG.

La cabecera es más corta. La carga y los perfiles forman parte del contenido desplazable; ya no restan altura fija al área de controles. Los botones Vectorizar/Descargar permanecen visibles. Las pestañas también admiten flechas, Inicio y Fin del teclado.

En las pruebas de pantalla, el área desplazable dispone de unos 303 px en 1024 × 600, 471 px en 1366 × 768 y 783 px en 1920 × 1080. No cambia el tamaño del documento ni sus coordenadas, calidad, curvas o exportaciones.

## Comprobaciones

- 300 pruebas automáticas existentes aprobadas.
- Pruebas Chromium de carga por arrastre sobre los cinco editores de imagen, Producción, Plancha y Lotes, incluyendo archivos múltiples y PNG sin MIME.
- Comprobación de una única carga por caída, rechazo de formatos incompatibles y lotes excesivos, conservación del documento al rechazar la caída y bloqueo durante procesamiento.
- Pestañas, ampliación del panel y acceso a los botones comprobados a 1024 × 600, 1366 × 768 y 1920 × 1080, sin desbordamiento horizontal.
- Regresión de Vectorizar: selección, mover, nodos, deshacer/rehacer, curvas, operaciones booleanas, proyectos, comparación, SVG completo/por color y PNG transparente a 300 DPI.
- HTML balanceado con identificadores únicos, JavaScript comprobado y CSS analizado.

Se conservan las mejoras anteriores, las imágenes, fuentes y estructura general de la página. La instalación sigue siendo copiar la carpeta `momotus-core` del ZIP sobre el proyecto y recargar con Ctrl + F5.
