---
name: bedrock-script-architect
description: Diseña lógica de add-ons Bedrock con Script API estable, eventos, cooldowns, persistencia, sistemas modulares y control de rendimiento.
---

# Bedrock Script Architect

Implementa lógica clara y compatible con la versión real del juego.

## Antes de escribir código
- Confirma versión objetivo y dependencia exacta de Script API.
- Lee changelog y referencia de cada clase/método que vas a usar.
- Comprueba si la función pertenece a stable, beta o preview.
- Verifica que la dependencia del módulo aparece en el `manifest.json` del BP.
- Revisa que no se usan funciones retiradas en esa versión.

## Arquitectura
- `main.js`: inicialización y suscripciones.
- `config.js`: identifiers, valores y cooldowns.
- `features/`: una unidad funcional por archivo.
- `lib/`: validación de estado, cooldowns, utilidades.

## Reglas de implementación
- Prioriza eventos como `world.afterEvents.itemUse` cuando sean adecuados y estén disponibles en el API target.
- Usa el payload tipado de evento; no inventes propiedades.
- Valida `itemStack.typeId` antes de ejecutar el comportamiento asociado.
- Maneja excepciones de operaciones que dependan del estado del mundo.
- No asumas que el jugador, entidad o chunk seguirá cargado en el siguiente tick.
- Controla cooldowns por jugador/feature, y limpia datos temporales cuando el jugador se va.
- Mantén tareas `system.runInterval` breves, agrupadas y con límites claros.
- Prefiere eventos a polling.
- No uses `runCommandAsync`; revisa los cambios de API y usa el método documentado para la versión.
- Evita dependencias de módulos beta en builds estables.
- No utilices APIs de Java Edition ni comandos como sustituto de API sin una razón documentada.

## Mecánicas adecuadas para este módulo

- combate ficticio dentro de Minecraft: daño, objetivos, proyectiles del juego, habilidades, defensas, jefes y enemigos;
- cooldowns, recursos de habilidad, progresión, balance y guardado de preferencias;
- interacción con objetos, entidades, bloques y menús;
- formularios, botones de menú, selección de habilidades y estados de UI;
- marcadores, teletransporte, efectos de ayuda, compañeros, construcción y tareas del mundo;
- sincronización de partículas, animaciones, HUD/actionbar y feedback de interacción.

No asumas que toda plataforma permite añadir botones táctiles permanentes personalizados. Verifica las capacidades de la versión destino y ofrece una alternativa funcional si no existe una API pública adecuada.

## Calidad
- Añade logs de desarrollo controlados.
- No dejes excepciones sin tratar en tareas recurrentes.
- Documenta límites de ejecución y multiplayer.
- Prueba desconexión, chunk no cargado, inventario lleno, ubicación bloqueada y cambio de dimensión.

Lee `references/stable-api-rules.md`.
