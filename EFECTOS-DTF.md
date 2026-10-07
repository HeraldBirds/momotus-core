# Efectos de estampado — Momotus Core

Herramienta disponible en **Herramientas → Efectos** y en `herramientas/#efectos-dtf`.

## Instalar esta actualización

El archivo `momotus-core.zip` contiene el proyecto completo actualizado. El paquete `exportacion-y-urbanas-cambios.zip` incluye únicamente los archivos modificados respecto a la entrega anterior con zonas, máscaras y guardado de proyectos. Extraer conservando las rutas; no copiar el `index.html` de herramientas sobre el de la raíz.

No requiere nuevas dependencias de producción ni recompilar Tailwind. Usar alojamiento HTTP; no abrir con `file://`, porque se utilizan workers y almacenamiento del navegador. Para probar localmente: `python3 -m http.server 8000` desde la raíz y abrir `http://localhost:8000/herramientas/#efectos-dtf`.

## Flujo de trabajo

1. Cargar PNG, JPG o WebP, arrastrar una imagen, pegarla o probar el diseño de ejemplo. **Usar resultado** y **Aplicar efectos** permiten importar el resultado de otras herramientas.
2. Elegir uno de los nueve efectos. Intensidad, dirección, escala en milímetros y selección por color se guardan por zona.
3. **Orientar puntadas por contornos** estima una dirección local para satén, tatami y chenille a partir de los bordes de color y transparencia. El ángulo permite ajustar esa dirección. Desactivar la opción conserva la orientación uniforme manual.
4. La primera zona cubre el diseño completo. **+ Zona** agrega una selección vacía para pintar otra textura. Se admiten hasta ocho zonas con nombre, visibilidad y orden propios. Se aplican de abajo hacia arriba; las zonas que se superponen combinan sus efectos en ese orden.
5. **Pintar** agrega selección y **Borrar** la retira. Si una zona cubre todo, empezar a pintar inicia una máscara vacía; empezar a borrar parte de una máscara completa. **Seleccionar todo** y **Vaciar selección** cambian su cobertura. **Mover vista** deja de pintar. El original permanece intacto.
6. **Deshacer/Rehacer** conserva hasta 30 estados de ajustes, zonas y máscaras. También admite Ctrl/Cmd+Z y Ctrl/Cmd+Mayús+Z fuera de campos de texto. Cargar otra imagen o proyecto inicia un historial nuevo.
7. Negro protegido, color de fondo, eliminación de color y tamaño final son controles del documento. **Hacer transparente ese color** elimina coincidencias también dentro del diseño; preparar el recorte en Rango de color si solo se desea quitar el fondo exterior.
8. Ajustar el ancho en centímetros; el alto conserva la proporción. La salida se calcula a 300 DPI. Una ampliación aumenta píxeles y no recupera detalle original.
9. Comparar con el original y cambiar el fondo de vista previa. **100% vista previa** muestra la versión rápida; **Revisar salida final al 100%** procesa y muestra la resolución real del PNG. Usar las barras de desplazamiento para recorrerla.
10. Exportar PNG o **Enviar resultado**. La revisión de transferencia muestra origen, destino, imagen y medidas antes de continuar. **Paso anterior** vuelve a una herramienta previa sin borrar su documento.

## Proyectos y estilos

- El guardado automático conserva un proyecto activo en IndexedDB de este navegador. **Guardar proyecto** fuerza el guardado y **Recuperar guardado** lo abre después de una recarga. No se sustituye el trabajo abierto automáticamente.
- **Exportar proyecto** descarga un archivo `.efectos` con imagen original, máscaras, zonas y ajustes. Importarlo permite continuar en otro navegador. Cada archivo constituye un proyecto independiente.
- Los archivos defectuosos se rechazan antes de sustituir el documento actual. Si el navegador bloquea el guardado, se muestra el error y se mantiene disponible la exportación como respaldo.
- Se pueden guardar hasta 30 estilos con nombre. Un estilo contiene los ajustes de la zona activa; no incluye imagen ni máscara. Guardar de nuevo con el mismo nombre actualiza ese estilo.
- Borrar los datos del sitio elimina proyectos y estilos locales. Conservar archivos `.efectos` para mantener una copia externa.

## Efectos disponibles

| Efecto | Apariencia |
|---|---|
| Bordado satén | Hilos y variaciones de luz con orientación local opcional |
| Bordado tatami | Filas alternadas y extremos de puntadas sombreados |
| Chenille | Bucles con textura y relieve visual |
| Tintas planas | Cuantización por canal; no separaciones de tinta |
| Trama de puntos | Puntos y huecos según la luminosidad |
| Desgastado | Huecos reproducibles para apariencia vintage |
| Relieve / puff | Sombreado interior del contorno |
| Metálico | Bandas de brillo y textura |
| Glitter | Destellos y sombras de partículas |

Son simulaciones raster propias. El bordado por contornos es una aproximación visual, no un digitalizador de puntadas ni un generador DST/PES. El volumen, glitter o metal físicos requieren materiales específicos; un DTF convencional imprime esta apariencia plana.

## Integración y conservación

Efectos comparte su resultado y metadatos con Calidad y color, Rango de color, Semitonos, Vectorización, Producción DTF y el personalizador. Producción puede devolver el trabajo a Efectos. La transferencia usa una copia; el documento de origen conserva sus ajustes. El regreso entre herramientas se conserva durante la sesión y no es un historial persistente de todos sus resultados.

La calculadora y su personalización predeterminada Equipo siguen incluidas. Agüizotes continúa como categoría de Tienda: su decoración aparece únicamente al seleccionarla. Esta actualización no modifica su hoja de estilos de temporada.

## Exportación y límites

- PNG con alfa y un único bloque `pHYs` de 11 811 píxeles por metro, aproximadamente 300 DPI. La medida corresponde al lienzo completo, incluidos bordes transparentes. El fondo de vista previa no se exporta.
- Transparencia original conservada salvo eliminación de color y huecos activados. El negro protegido no recibe textura.
- Vista rápida de hasta 960 píxeles por lado. La revisión final usa las dimensiones reales de exportación y se vuelve a generar cuando cambian los ajustes.
- Las salidas grandes se procesan por franjas, conservando las coordenadas globales de la textura y los vecinos que necesita el relieve. El PNG mantiene el tamaño solicitado; no se reduce automáticamente. Cada herramienta de destino conserva sus límites propios.
- Las máscaras y la estimación de contornos tienen hasta 512 píxeles en su lado mayor y se interpolan al tamaño final. Para detalles finos conviene revisar la salida real al 100%.
- Entrada: hasta 24 MB, 16 384 píxeles por lado y 64 millones de píxeles. Salida: ancho entre 1 y 65 cm, máximo 16 384 píxeles por lado y 64 millones de píxeles. Un proyecto importado admite hasta 128 MB.
- Resultados completamente transparentes o dimensiones inválidas bloquean la exportación. No se generan base blanca, separaciones CMYK, archivos de corte ni instrucciones de bordadora.
- Se mantiene el requisito de escritorio del proyecto: Herramientas necesita una pantalla de al menos 1024 píxeles.

## Técnicas investigadas

Se consultaron fuentes de fabricantes y proveedores el 6 de octubre de 2026. Las recomendaciones de un producto no deben tomarse como una especificación universal para todos los DTF.

- **Bordado simulado:** Transfer Express documenta un efecto visual compatible con DTF y recomienda arte sencillo y texto amplio. No agrega puntadas físicas. [Simbroidery](https://www.transferexpress.com/simbroidery).
- **Arte para transfers:** los requisitos de líneas, huecos y color varían por producto. Una textura con elementos pequeños exige revisar el archivo final con el proveedor. [Guías de arte de Transfer Express](https://blog.transferexpress.com/art-guidelines/).
- **Puff físico:** STAHLS describe un vinilo que se expande con calor. El volumen procede del material, no de los píxeles de un PNG. [CAD-CUT Puff](https://espanol.stahls.com/heat-transfer-vinyl-puff).
- **Metálico físico:** existen materiales específicos con acabado metálico. [Metallic Puff de STAHLS](https://espanol.stahls.com/heat-transfer-vinyl-metallic-puff).
- **Glitter y otros acabados:** Siser presenta acabados de vinilo como glitter y flock. La imagen exportada solo imita su apariencia. [Vinilo termotransferible de Siser](https://www.siserna.com/heat-transfer-vinyl/).
- **Sublimación:** Epson indica la necesidad de poliéster o soportes con recubrimiento compatible. No se convierte un diseño DTF en otro proceso mediante un filtro. [Sublimación de Epson](https://epson.com/sublimation-printers-for-makers).

No se incluyen temperaturas o tiempos universales de aplicación. Utilizar las indicaciones del material, tinta, polvo, film y prenda concretos.

## Verificación

**44 pruebas automatizadas aprobadas:** 19 del motor de efectos, 16 de la calculadora, 7 de regresión y 2 del catálogo urbano. Ejecutar `npm ci` y `npm test` desde la raíz.

Pruebas reales en Chromium: nueve efectos, worker bajo la CSP del proyecto, transparencia y negro protegido, PNG con tamaño y resolución verificados, selección por color, pincel y borrador, combinación de zonas, deshacer/rehacer, guardado de estilos, exportación/importación de proyectos y recuperación después de recargar. Se verificó una salida final de 1417 píxeles de ancho para 12 cm, mostrada al 100% real.

También se verificaron la revisión de transferencias, cancelación y regreso al paso anterior, intercambio con Producción, importación en Vectorización y colocación del PNG procesado en el personalizador. Los recorridos de regresión incluyen Equipo, categorías de Tienda, Agüizotes al seleccionar su categoría y las vistas de escritorio y móvil. No se realizó una prueba física de impresión.

## Corrección de exportación grande

Se comprobaron descargas PNG reales de **1200 × 9000** y **4134 × 4134** píxeles con resolución de aproximadamente 300 DPI. También se verificaron alfa, negro protegido y continuidad de textura entre franjas. Los límites actuales son 16 384 píxeles por lado y 64 millones de píxeles; dimensiones superiores muestran una indicación para reducir el ancho final.
