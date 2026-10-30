---
name: bedrock-item-creator
description: Diseña objetos personalizados Bedrock con identidad propia, componentes, iconos, modelos 3D, animaciones y habilidades utilitarias/de apoyo.
---

# Bedrock Item Creator

Crea objetos originales que encajen en el juego, con una función clara y recursos visuales coherentes. Este módulo está enfocado en herramientas, artefactos decorativos y objetos mágicos de apoyo, no en mecánicas ofensivas.

## Brief del objeto

Antes de crear archivos, define:
- nombre, namespace e identifier;
- fantasía y función central;
- icono del inventario;
- representación en mano/equipado y en el mundo cuando aplique;
- comportamiento de uso y objetivo de la interacción;
- cooldown, límites y condiciones de uso;
- animación y feedback visual;
- dependencias RP/BP/Script API;
- versión mínima y targets realmente probados.

## Pipeline

1. Lee la referencia oficial de items para la versión elegida.
2. Diseña el item JSON con los componentes que existan en ese target.
3. Crea icono PNG y entrada del atlas correspondiente.
4. Si el objeto requiere volumen visible en mano, coordina `bedrock-3d-creator` y crea geometría/attachable compatible.
5. Coordina `bedrock-animation-studio` para animación de uso o de reposo cuando sea viable.
6. Coordina `bedrock-vfx-studio` para feedback por capas.
7. Si hace falta lógica, coordina `bedrock-script-architect`; valida `itemStack.typeId`, cooldown, jugador y estado del mundo.
8. Añade recetas/localización solo cuando formen parte del diseño.
9. Ejecuta los validadores y prepara prueba dentro del juego.

## Habilidades utilitarias de ejemplo

Un artefacto puede ofrecer tres acciones no ofensivas como:
- **Luz guía**: ilumina o ayuda a orientarse.
- **Bendición**: concede un efecto positivo o apoyo temporal al usuario.
- **Regreso seguro**: vuelve a una ubicación guardada, si la API y las reglas de destino lo permiten.

Cada acción debe tener activación inequívoca, cooldown independiente, feedback y manejo de errores. No hagas que una acción ejecute otra accidentalmente.

## Reglas técnicas

- No asumas que el icono de inventario, modelo equipado y entidad dropped son una sola geometría.
- No uses componentes legacy sin confirmar su estado en el target.
- No uses APIs beta en builds estables sin aprobación explícita.
- No copies identificadores de Vanilla para contenido propio.
- Separa cada acción de apoyo en un módulo y una prueba independiente.
- No incluyas archivos de sonido: deja los puntos de integración descritos para que el usuario aporte audio.

## Entrega mínima

- definición del item;
- icono y entrada de atlas;
- modelo 3D/attachable si aplica;
- animación si aplica;
- partículas/referencias VFX si aplica;
- script y dependencia exacta si aplica;
- registro de identifiers;
- checklist de pruebas y límites conocidos.

Lee `references/item-design-checklist.md` antes de un objeto complejo.
