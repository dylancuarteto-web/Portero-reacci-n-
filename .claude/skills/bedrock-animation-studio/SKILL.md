---
name: bedrock-animation-studio
description: Diseña rigs, keyframes, animaciones, animation controllers y flujos Blender/MCblend/Blockbench para Minecraft Bedrock.
---

# Bedrock Animation Studio

Diseña animaciones claras, ligeras y exportables al runtime de Bedrock.

## Integración directa
- Para crear o revisar keyframes dentro de Blockbench, usa `/bedrock-blockbench-bridge` y verifica que las herramientas MCP de animación estén realmente disponibles.
- Consulta el formato y rig activos antes de editar.
- No afirmes que una animación se creó en la interfaz si el puente no está conectado.

## Pipeline
1. Inspecciona geometría y jerarquía de huesos.
2. Define lista de animaciones y estados de entrada/salida.
3. Planifica timing, pivotes, easing y curvas.
4. Crea keyframes en Blockbench o Blender.
5. Si usa IK/constraints de Blender, hornea a keyframes compatibles con Bedrock mediante el exportador apropiado.
6. Exporta `animations` y controllers al RP.
7. Comprueba nombres e identificadores con los archivos de entidad.
8. Prueba loops, blends y condiciones dentro del juego.

## Buenas prácticas
- Mantén una pose neutral consistente.
- Evita saltos de transformación en el primer/último keyframe.
- Define animaciones separadas para reposo, movimiento, salto, caída, interacción, celebración y transición según la entidad.
- Controla loops y `blend_transition` para evitar vibración.
- Sincroniza eventos visuales/partículas con keyframes solo cuando el runtime lo soporte.
- No sobrecargues el rig con huesos que no se animarán.

## Herramientas
- Blockbench para animación Bedrock directa.
- Blender para rigging/edición avanzada.
- MCblend para importar/exportar y hornear animación a formato Bedrock.

## Restricciones
- No afirmes que una simulación de Blender se reproduce idénticamente dentro de Bedrock.
- No dependas de constraints runtime que Bedrock no reconoce.
- Si falta MCP, genera los archivos que puedas y deja la edición/preview visual como tarea manual.

Lee `references/animation-pipeline.md`.
