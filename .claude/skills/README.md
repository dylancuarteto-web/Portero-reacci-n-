# Skills incluidas

- `/bedrock-ai-architect`: coordinación global.
- `/bedrock-blockbench-bridge`: conexión real con Blockbench Desktop mediante MCP, diagnóstico y flujo visual.
- `/bedrock-3d-creator`: modelado 3D y attachables.
- `/bedrock-item-creator`: objetos personalizados con funciones de apoyo.
- `/bedrock-animation-studio`: animaciones y rigs.
- `/bedrock-vfx-studio`: partículas y VFX.
- `/bedrock-script-architect`: Script API.
- `/bedrock-entity-creator`: compañeros/entidades pacíficas.
- `/bedrock-mobile-optimizer`: optimización para Android.
- `/bedrock-validator`: validación y empaquetado.

Las Skills pueden usarse individualmente o coordinadas desde `/bedrock-ai-architect`.

- `/bedrock-gameplay-systems`: habilidades, combate ficticio, enemigos, jefes, defensa y progresión.
- `/bedrock-ui-studio`: UI/UX profesional, HUD, menús, botones y controles alternativos.

## V8 — Mobile Creator Kit

- `/bedrock-rig-studio`: proporciones, huesos, pivotes y escala (por ejemplo, un zombi gordo o flaco) con `tools/rig-studio.html`.
- `/bedrock-gameplay-catalog`: elige y combina recetas del catálogo de 500 mecánicas (`catalog/mechanics-500.json` y `.csv`).
- `/bedrock-puppet-threads`: hilos tipo marioneta (render segmentado y control del mob con máquina de estados).
- `/bedrock-visual-studio` (V7): convierte diseños del panel visual (`tools/studio/index.html`: texturas, VFX, animación y generador de prompts).

Herramientas en el navegador (funcionan sin conexión, también en Android): `tools/rig-studio.html`, `tools/voxel-simulator.html` y `tools/studio/index.html`. Exportan diseños JSON/PNG para pasarlos a Claude Code; no son archivos nativos de Bedrock ni ejecutan el motor del juego.

Límites: el catálogo son patrones combinables, no componentes nativos; cambiar la geometría no cambia la hitbox; la Script API no escala huesos en tiempo real; Blockbench MCP necesita PC. Prompts de ejemplo en `docs/PROMPTS.md`.
