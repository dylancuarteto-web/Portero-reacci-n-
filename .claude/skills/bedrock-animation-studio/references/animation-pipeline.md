# Pipeline de animación

## Plan de movimiento
Para cada animación registra:
- ID único (`animation.namespace.name`).
- Huesos que cambian.
- Duración y loop.
- Estado que la inicia y condición de salida.
- Transición de entrada/salida.
- Puntos de sincronización visual.
- Presupuesto de complejidad.

## Blockbench
1. Abre el modelo Bedrock correspondiente.
2. Revisa nombres/pivotes antes de animar.
3. Crea animación en el timeline.
4. Añade keyframes mínimos pero suficientes.
5. Previsualiza ciclos completos y cambios de dirección.
6. Exporta al directorio `RP/animations/`.

## Blender + MCblend
1. Comprueba versión de Blender y compatibilidad de MCblend instalada.
2. Importa el modelo en el flujo soportado por MCblend.
3. Usa rigs/IK/constraints para facilitar la autoría, no como dependencia runtime.
4. Haz bake de movimientos y comprueba los keyframes resultantes.
5. Exporta y revisa el JSON Bedrock.
6. Reabre/valida el modelo exportado en Blockbench si es posible.

## Controllers
- Evita transiciones ambiguas y estados sin salida.
- Define condiciones de entrada/salida explícitas.
- Mantén la lógica del controller visual; no la uses como sustituto de la lógica de juego.
- Comprueba que las animaciones declaradas existen.

## Referencias
- https://learn.microsoft.com/en-us/minecraft/creator/documents/entitymodelingandanimation?view=minecraft-bedrock-stable
- https://mcblend.readthedocs.io/en/stable/
