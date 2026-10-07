# Panel de opciones adaptable

Se corrigió el panel de Calidad y color, Semitonos y Rango de color en computadoras con poca altura de pantalla.

- Copiar, guardar y recuperar ajustes aparecen en una sola fila.
- La zona de ajustes mantiene al menos 200 px de altura, en lugar de comprimirse.
- En pantallas bajas, el inspector permite desplazarse para acceder a todos sus controles y a la descarga.
- Se reducen únicamente los espacios del panel en pantallas de hasta 700 px de alto.

No se modificaron los motores de procesamiento, la resolución, los DPI ni las exportaciones. Tampoco se cambió el Inicio restaurado o la Tienda.

Validación en navegador: 1920 × 1080, 1366 × 768, 1280 × 600 y 1024 × 500; se abrieron los grupos de opciones y se comprobó el acceso a los campos y la descarga en los tres editores, sin errores de JavaScript.

Archivos modificados: herramientas/css/studio-refresh.css y sw.js. Este documento es nuevo.

Para actualizar, reemplazá esos archivos respetando sus carpetas. El proyecto completo ya contiene el ajuste.
