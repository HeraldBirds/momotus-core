# Proyecto revisado: conflictos y comprobaciones

Se resolvieron 60 bloques de conflicto en 15 archivos. La comparación de ambos lados mostró que los bloques locales conservaban las mejoras recientes, mientras que el otro lado restauraba código anterior. No hubo cambios automáticos adicionales de contenido fuera de esos bloques.

## Correcciones

- Se conservan la calculadora por referencias y su plantilla de equipos, las carpetas de categorías, el carrusel original y el panel adaptable.
- Se conservan las dependencias locales, el guardado transaccional y los controles que evitan reducir el original automáticamente.
- Efectos vuelve a funcionar de forma independiente: se quitaron la importación y el envío directo de imágenes entre herramientas. Sus reglas, guías, exportación y el envío de medidas a la calculadora continúan disponibles.
- Al cargar una nueva imagen en Diseña la tuya, el guardado comienza inmediatamente; los ajustes continuos conservan su guardado agrupado.
- Se renovó la versión de caché para que se cargue el código corregido.

## Comprobaciones realizadas

- 68 pruebas automáticas aprobadas.
- Sintaxis de 45 archivos JavaScript, 7 scripts internos de HTML y 22 hojas CSS comprobada.
- Páginas sin IDs duplicados ni recursos estáticos enlazados faltantes.
- Navegación por Inicio, Tienda, Diseña la tuya, Comunidad, Administración y Herramientas, sin excepciones de JavaScript. Esto comprueba la carga de Administración, no todas sus operaciones.
- Procesamiento real en Calidad y color, Rango de color y Semitonos.
- Exportación de Efectos a 4488 × 8078 px: PNG con canal alfa y metadatos de 300 DPI; sin el antiguo bloqueo de 8000 px.
- Vectorización y descarga de SVG, plantilla de equipos y transferencia exclusivamente de medidas.
- Guardado y recuperación de una imagen al recargar el diseñador.
- Tienda: 10 destacados, 35 diseños urbanos y 6 de música. Carrusel con sus cinco diapositivas e imagen móvil.

Los espacios nuevos de productos todavía necesitan los mockups que vas a agregar. Sus rutas previstas y el stock cero se conservan; no se inventaron fotos ni existencias.

## Cómo terminar la combinación en tu computadora

1. Extraé `conflictos-resueltos-cambios.zip`.
2. Copiá el contenido de su carpeta `momotus-core` dentro de tu repositorio actual y reemplazá los archivos coincidentes. Usá el parche si querés conservar tus otros archivos locales.
3. Conservá la carpeta `.git` de tu repositorio. Los ZIP entregados contienen el código y los recursos, sin reemplazar tu historial de Git.
4. En GitHub Desktop, abrí **Repository → Open in Command Prompt** (o su opción de terminal) y ejecutá este comando para marcar los archivos como resueltos:

```sh
git add -- _headers comunidad.html disena.html herramientas/css/tools-team-quote.css herramientas/index.html herramientas/js/tools-loader.js herramientas/js/tools-team-quote.js index.html js/designer-auto-tools.js js/designer-storage.js js/designer.js sw.js tienda/index.html tienda/js/temporadas.js tienda/js/tienda.js herramientas/js/tools.js herramientas/js/tools-effects.js
```

5. Volvé a GitHub Desktop y pulsá **Continue merge**. Si solicita el mensaje de confirmación de la combinación, completalo. Después podés hacer Push origin.

La combinación y el envío a GitHub en tu computadora siguen pendientes; editar el ZIP no modifica automáticamente tu repositorio local. En la copia revisada, Git ya no registra archivos sin resolver.

También se entrega el proyecto completo para instalarlo por separado o revisar el resultado.
