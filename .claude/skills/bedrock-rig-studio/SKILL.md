---
name: bedrock-rig-studio
description: Diseña rigs y proporciones de entidades Bedrock.
---
Usa `tools/rig-studio.html` y sus JSON exportados. Para un zombi gordo ensancha torso/cadera y ajusta brazos para evitar intersecciones; para uno flaco reduce anchura y profundidad conservando pivotes. Mantén nombres de huesos que dependan de animaciones y attachables. Distingue pivote, origen del cubo, tamaño, rotación e inflate. Ajusta animaciones tras cambiar proporciones. La geometría visual no cambia automáticamente la hitbox. No inventes acceso a huesos desde Script API en runtime. Valida `.geo.json`, UV, pivotes y límites en Blockbench.
