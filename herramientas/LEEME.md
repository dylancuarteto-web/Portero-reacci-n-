# Herramientas del addon

Todo se ejecuta desde la raíz del repo. Python 3 y, para los tipos, Node.js.

| Comando | Qué hace |
|---|---|
| `python3 herramientas/validar.py` | Revisa JSON, manifests, que cada entidad tenga textura, geometría, animaciones, textos y eventos que existan, y que las texturas midan lo que espera la geometría. |
| `cd herramientas && npm ci && npx tsc -p tsconfig.json` | Revisa los scripts con los tipos oficiales de `@minecraft/server` 2.0.0 (la versión del manifest). |
| `python3 herramientas/vista_previa.py` | Dibuja cada zombie de frente, lado y espalda en `dist/vistas.png` (necesita `pip install pillow`). |
| `python3 herramientas/empaquetar.py --subir-version` | Valida y genera `dist/Zombie_Apocalypse.mcaddon`. Sube la versión para que Minecraft reemplace la ya importada. |

`vanilla/` contiene geometrías del juego base, sacadas de
[Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples), para validar y dibujar las
entidades que usan `geometry.zombie`.

El flujo de trabajo completo y las reglas de Bedrock están en `.claude/skills/bedrock-addon/`.
