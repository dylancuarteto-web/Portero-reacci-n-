# Arquitectura de un proyecto Bedrock

## Responsabilidades

### Resource Pack (RP)
- `models/`: geometría Bedrock.
- `textures/`: atlas, iconos, texturas de entidades y objetos.
- `animations/`: animaciones exportadas.
- `animation_controllers/`: estados y transiciones.
- `render_controllers/`: selección de geometría/material/textura.
- `particles/`: efectos de partículas.
- `entity/`: definiciones de cliente y renderizado.
- `attachables/`: representación visual equipada/en mano cuando aplique.
- `texts/`: localización si se utiliza.

### Behavior Pack (BP)
- `entities/`: componentes y eventos de entidades.
- `items/`: definición de ítems data-driven.
- `blocks/`: bloques personalizados.
- `recipes/`: recetas.
- `loot_tables/`: loot tables.
- `scripts/`: lógica Script API solo cuando sea necesaria.
- `functions/`: funciones de comandos cuando el proyecto las utilice.

## Convenciones

- Un namespace único del proyecto, por ejemplo `lumenworks`.
- Identifiers con minúsculas y snake_case: `lumenworks:glow_companion`.
- Evita usar `minecraft:` para contenido propio.
- Mantén un registro en `docs/ASSET_REGISTRY.md`.
- Mantén BP/RP en directorios separados y enlaza dependencias por UUID real.
- No dupliques el mismo recurso con distintas mayúsculas/minúsculas.
- Mantén las rutas relativas coherentes con los identifiers.

## Organización de scripts

Si se necesita Script API:
- `scripts/main.js`: bootstrap y suscripciones de eventos.
- `scripts/config.js`: constantes de balance/cooldowns.
- `scripts/features/`: cada habilidad o sistema independiente.
- `scripts/lib/`: utilidades defensivas, validación y cooldowns.

No hagas un `runInterval` por entidad si se puede resolver mediante eventos. Mantén las tareas programadas agrupadas y detén intervalos al terminar.
