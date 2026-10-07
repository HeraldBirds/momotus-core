# Inicio y tienda: presentación visual

## Qué cambió

- Banner dividido en texto e imagen: las colecciones usan mockups originales, con el estampado completo y controles de carrusel conservados. La altura se ajusta para escritorio y móvil.
- Cinco tarjetas de colección con acentos suaves: Fauna Nica, Anime, Urbanas, Games y Únicas.
- Seis productos seleccionados del catálogo actual: representación por categoría, nombres, precios, tallas, favoritos y carrito del mismo sistema de tienda. No se generan productos ni precios nuevos.
- Acceso a cotizar DTF por metro y consulta por WhatsApp. La calculadora conserva su uso en computadora.
- Fondos negro y grafito, tipografía consistente, espacios más compactos, botones y tarjetas con bordes menos redondeados, beneficios resumidos y cierre con un color menos intenso.
- Tarjetas de tienda con imagen completa, títulos de hasta dos líneas, precios y botones alineados. El modo Todos mantiene diez destacados; Urbanas mantiene sus cinco espacios habilitados por tema.
- Vista ampliable del mockup de catálogo, con control 100–200%, restablecimiento y acceso al producto.
- Galería real y pares diseño/prenda terminada configurables. Se muestran únicamente con contenido autorizado, y no se presentan mockups como fotografías de trabajos terminados.
- Móvil revisado desde 320 px, foco visible y animaciones desactivadas con la preferencia de movimiento reducido.

## Fotografías de trabajos reales

1. Guardar las fotos en img/portfolio/ conservando su calidad.
2. En tienda/js/configuracion.js, agregar entradas a gallery:

```js
gallery: [
  {title: 'Nombre del trabajo', image: 'img/portfolio/prenda-01.webp', consent: true}
]
```

Esto sustituye la vista de detalle de catálogo de Inicio por una galería de hasta seis fotografías. Se conserva la galería de Comunidad. También se pueden preparar estas entradas en administración y exportar la configuración.

Para el bloque Así queda impreso, editar js/home-content.js:

```js
globalThis.MomotusHomeContent = {
  comparisons: [
    {
      title: 'Nombre del mismo trabajo',
      designImage: 'img/portfolio/diseno-01.webp',
      printedImage: 'img/portfolio/prenda-01.webp',
      consent: true
    }
  ]
};
```

Usar fotos y arte del mismo trabajo y rutas existentes. Sin fotos reales configuradas, Inicio muestra el detalle ampliable identificado como mockup. Los nombres de los ejemplos son rutas preparadas, no archivos incluidos.

## Calidad y compatibilidad

No se recomprimió, recortó ni reemplazó ningún archivo de imagen. El encuadre y el acercamiento se hacen solo en la presentación del navegador. Se mantienen las fotos originales y sus vistas previas existentes con elección según el tamaño de pantalla.

Los motores, los DPI y las exportaciones de herramientas permanecen intactos. Diseña la tuya conserva su estructura y su código. Las hojas nuevas solo se cargan en Inicio y Tienda; las reglas visuales están limitadas a sus clases de página.

## Comprobaciones

Las 68 pruebas automatizadas del proyecto pasaron. Se revisaron en navegador el carrusel, seis productos de Inicio, colecciones, tallas, carrito, favoritos, zoom, vista frente/espalda, tamaños 320–1440 px, movimiento reducido, conteos de tienda y galerías configuradas con consentimiento.

## Instalar

El ZIP completo reúne estas mejoras y las entregas anteriores. El ZIP de cambios contiene únicamente archivos nuevos o modificados respecto a la versión anterior. Conservar una copia del proyecto publicado y colocar la nueva versión en el mismo directorio; no mezclar configuraciones de pruebas con las reales.
