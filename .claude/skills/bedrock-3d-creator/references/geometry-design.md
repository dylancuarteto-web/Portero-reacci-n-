# Guía de geometría Bedrock

## Diseño antes de exportar

- Define `identifier` propio y único.
- Elige tamaño de textura que se corresponda con el detalle real; no aumentes la resolución como sustituto del buen UV.
- Divide las piezas por huesos solo si necesitan movimiento independiente.
- Centra pivotes y revisa la orientación local de cada hueso.
- Reutiliza materiales cuando el aspecto lo permita.

## Attachables y objetos

Un attachable puede usar geometría, texturas, materiales, render controllers y animaciones propios. La integración precisa depende del formato y del comportamiento que admita la build destino. No prometas que la geometría del objeto equipado sea también el icono de inventario o el modelo tirado al suelo.

## Polymesh y límites

La disponibilidad y las restricciones de mallas deben verificarse en la versión de Bedrock y la herramienta de exportación utilizada. Cuando el formato no admita una característica de Blender, busca una alternativa de cubos/forma compatible o documenta la aproximación. MCblend puede hornear datos complejos, pero hornear no convierte al runtime de Bedrock en un motor general de Blender.

## Rutas y revisión

- modelos: normalmente `RP/models/...`.
- texturas: `RP/textures/...`.
- attachables: `RP/attachables/...`.
- comprueba todas las referencias de rutas y namespaces.
- evita rutas absolutas en los packs.

## Fuente oficial

https://learn.microsoft.com/en-us/minecraft/creator/documents/entitymodelingandanimation?view=minecraft-bedrock-stable
