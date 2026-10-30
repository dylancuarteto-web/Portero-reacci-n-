---
name: bedrock-3d-creator
description: Diseña geometría 3D Bedrock, modelos de entidades y attachables, UV, texturas, iconos y archivos fuente de Blockbench/Blender.
---

# Bedrock 3D Creator

Crea activos 3D propios que se integren en Minecraft Bedrock y que puedan editarse posteriormente.

## Integración directa con Blockbench
- Si el usuario quiere edición dentro de Blockbench, usa `/bedrock-blockbench-bridge` y confirma primero la conexión MCP real.
- Consulta la lista de formatos devuelta por el servidor; no adivines el identificador del codec.
- Si el puente no está conectado, crea fuentes compatibles y marca la edición visual como pendiente.

## Antes de modelar
- Confirma el destino: entidad, objeto en mano/equipado, bloque, decoración o UI.
- Comprueba formato Bedrock exacto y la versión objetivo.
- Define estilo, silueta, escala, pivotes, límites de geometría y resolución de textura.
- Decide si el modelo se puede resolver con geometría de cubos o si necesita una malla compatible; no asumas que todas las funciones de Blender existen en el runtime.

## Reglas de modelado
- Usa nombres de geometría y huesos consistentes en snake_case.
- Crea un hueso raíz y jerarquía clara; pivotes en articulaciones reales.
- Evita huesos duplicados, geometría interior invisible y caras superpuestas.
- UV sin estiramiento y con padding razonable.
- Mantén densidad de texel coherente.
- Separa icono de inventario, geometría en mano/equipada y representación de entidad si Bedrock las trata de forma distinta.
- Para attachables, comprueba anclaje al jugador, materiales, render controllers, geometría y textura.
- Conserva `.bbmodel`, archivos fuente de textura y exportaciones JSON.

## Calidad
- Revisa frontal, lateral, superior, espalda, primera persona y tercera persona cuando aplique.
- Comprueba clipping y pivotes con animaciones.
- Mantén geometría y texturas ligeras para Android.
- No des por terminado un modelo hasta que cargue en Bedrock o se declare `NOT_TESTED`.

## Entregables
1. Concepto y referencia visual original.
2. `.bbmodel` editable si Blockbench está disponible.
3. `geometry` Bedrock exportada.
4. PNG/atlas y definición UV.
5. Attachables/render controllers si aplican.
6. Registro de IDs/rutas.
7. Capturas de vista previa y checklist de prueba.

Lee `references/geometry-design.md` antes de una tarea compleja.
