# Calculadora DTF — pedidos personalizados

## Cómo instalar estos cambios

Aplicar sobre la versión corregida de Momotus Core entregada anteriormente. El paquete conserva las rutas del proyecto. Copiar y reemplazar:

1. `herramientas/index.html`
2. `herramientas/js/tools-team-quote.js`
3. `herramientas/css/tools-team-quote.css`

No reemplazar el `index.html` de la raíz con el de `herramientas`.

Las tres piezas funcionan juntas: no instalar solamente el HTML o solamente el JavaScript. No necesitan volver a compilar Tailwind; la nueva interfaz utiliza su CSS propio. El HTML cambia la versión de los módulos para cargar los archivos actualizados.

El paquete incluye `tests/dtf-quote.test.cjs`. Es opcional para publicar, pero permite ejecutar las pruebas con `npm ci` y `npm test` desde la raíz del proyecto.

## Problema corregido

La pantalla describía referencias de logos, fotografías y diseños, mientras su JavaScript seguía creando personas con nombre y número. No coincidían el formulario, la importación ni la lógica de cantidades. El cálculo ahora utiliza referencias con detalle, tipo, ancho, alto y cantidad.

## Organización

- **Datos del pedido:** cliente o nombre de la cotización.
- **Diseños del pedido:** tarjetas independientes, cada una con medida y copias. Prenda y talla son opcionales y sirven para identificar el trabajo.
- **Producción y costos:** ancho del rollo, separación, margen exterior, rotación y costos.
- **Resumen:** material facturable, número de estampados, desglose del costo y precio sugerido.

La importación de equipos se conserva: cada nombre y número se convierte en un estampado separado, con las medidas sugeridas anteriores. Se pueden editar después de importar. El ejemplo y la importación agregan referencias sin borrar las existentes.

## Personalización predeterminada de equipos

El botón **Equipo · nombre y número** agrega una lista de integrantes dentro del pedido. Cada integrante tiene nombre, número, prenda, talla y copias. Se puede combinar con logos, fotografías y otros diseños.

El botón de medidas abre los tamaños de nombre y número. Las medidas sugeridas cambian con la talla y los dígitos del número; los ajustes manuales se conservan hasta pulsar **Restaurar sugeridas**. Son orientativas: revisar el arte antes de imprimir. Se puede agregar un ejemplo o pegar una lista sin borrar el pedido existente. Cada equipo admite hasta 50 integrantes.

Formato de la lista del equipo: `Nombre; número; talla; prenda; copias`. Los tres últimos campos son opcionales. Se permite solo nombre o solo número, y se conservan números como `007`.

## Reglas del cálculo

- Una referencia de 12 copias genera 12 estampados.
- La aplicación se cobra por estampado. Una prenda con dos estampados implica dos aplicaciones; este campo no es un costo por prenda.
- El costo base suma material DTF, aplicación de cada estampado y preparación del pedido.
- El precio sugerido aplica un margen sobre el precio de venta: costo dividido entre `1 - margen / 100`.
- El material se redondea hacia arriba en tramos de 10 cm. Se muestra también la longitud distribuida antes del redondeo.
- Sin costos se puede compartir un pedido con precio pendiente; no se presenta una cotización de C$0 como si estuviera terminada.
- Las cantidades deben ser enteras, las medidas positivas y las piezas deben caber en el ancho disponible. Los errores bloquean compartir una cotización incompleta.
- La separación puede ser cero. La rotación se puede desactivar.
- Límites: 100 referencias, 1000 copias por referencia y 5000 estampados por pedido. Los costos admiten hasta C$1 000 000 por campo.

Esta sección cotiza **impresión DTF**: prendas y envío no están incluidos. La distribución por franjas estima el material, sin prometer un aprovechamiento matemáticamente óptimo. No carga archivos de arte ni crea una plancha final.

## Importación

Diseños: una referencia por línea, por ejemplo:

```text
Logo Academia; logo; 10; 10; 12; camiseta; M
Foto familiar; foto; 20; 25; 2; hoodie; L
```

Prenda y talla son opcionales. Se aceptan coma, punto y coma o tabulador como separador. Para decimales con coma, usar punto y coma o tabulador entre campos. Se admiten campos entre comillas.

Equipos: seleccionar ese formato y usar:

```text
Carlos; 10; M
María; 7; S
```

Si una línea es inválida se rechaza la importación completa y se indica la línea; el pedido existente se conserva.

## Verificación

23 pruebas automatizadas pasaron: 16 específicas de la calculadora y las 7 de regresión anteriores. Las nuevas cubren medidas, copias, costos, rotación, separación cero, margen, redondeo, importación y ausencia de solapamientos.

En Chromium se comprobaron pedidos de logos y fotografías, equipos, copia del texto, errores de medidas, importación inválida sin pérdidas, cambio entre modos, escritorio de 1440 y 1024 píxeles y la puerta de escritorio en móvil. No hubo errores de JavaScript en esos recorridos.

Se verificó además la plantilla de equipos en Chromium: medidas manuales conservadas al cambiar talla, restauración de sugerencias, importación atómica, cantidades, mezcla con logos, eliminación de integrantes/equipos y texto copiado. No hubo errores de JavaScript.
