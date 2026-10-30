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

- utilidades de inventario;
- marcadores y teletransporte de apoyo con comprobación del destino;
- estados positivos/efectos de ayuda;
- seguimiento y órdenes a compañeros pacíficos;
- construcción, recolección permitida y tareas del mundo;
- cooldowns, progresión y guardado de preferencias;
- sincronización de partículas y animaciones.

## Calidad
- Añade logs de desarrollo controlados.
- No dejes excepciones sin tratar en tareas recurrentes.
- Documenta límites de ejecución y multiplayer.
- Prueba desconexión, chunk no cargado, inventario lleno, ubicación bloqueada y cambio de dimensión.

Lee `references/stable-api-rules.md`.
