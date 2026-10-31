# Parche de Evil Morty — add-on fan-made para Bedrock 26.60

**Proyecto fan-made no oficial.** Sin afiliación con *Rick and Morty*, Adult Swim ni sus propietarios. Todo el arte (modelos, texturas, partículas, interfaz) es original.

## Instalación

1. Abre `dist/EvilMorty.mcaddon` con Minecraft (en Android: tócalo y elige Minecraft).
2. En tu mundo, activa el **paquete de comportamiento** "Evil Morty - Parche" (activa también el de recursos).
3. No necesita experimentos: solo Script API estable.

## Objetos y controles

| Objeto | Receta (mesa de trabajo) | Controles |
|---|---|---|
| **Parche de Evil Morty** | `S S / LRL / ␣L␣` — cuerda, cuero, redstone | Póntelo en el casco · Agáchate **mirando hacia arriba**: menú · Dos veces seguidas: escudo on/off · Comando: `/evilmorty:parche` |
| **Mano de Rayo Láser** | `IRI / IDI / ␣G␣` — hierro, bloque de redstone, diamante, polvo de piedra luminosa | Usar: disparar · Agachado + usar: mejorar con 1 bloque de diamante |

En creativo: pestaña *Equipo*, o `/give @s evilmorty:parche` y `/give @s evilmorty:mano_laser`.

## Habilidades

- **Menú integrado**: el parche lleva el menú dentro (Escudo, Archivos y Ajustes); no hace falta ningún control aparte.
- **Interfaz del ojo**: al ponerte el parche, destello ámbar y una interfaz holográfica anclada a los bordes de la pantalla.
- **Visión nocturna**: activable en Ajustes.
- **Visión predictiva**: ves hacia dónde se moverán criaturas y jugadores cercanos (solo tú); al mirarlos, su vida, sus armas y su intención; y una alerta cuando una amenaza viene hacia ti.
- **Escudo Protector**: burbuja 3D de energía que bloquea todos los ataques, sin pociones. Modo Reflejar o Destruir proyectiles.
- **Mano de Rayo Láser**: rayo 3D con estela de chispas que daña al objetivo. 3 mejoras con bloques de diamante (daño 6→18, alcance 24→48).

Detalle: `docs/FEATURE_SPEC.md` · Interfaz: `docs/UI_SPEC.md` · IDs: `docs/ASSET_REGISTRY.md`.

## Compatibilidad

| Target Bedrock | Perfil | Script API | Estado |
|---|---|---|---|
| 26.60 | modern-stable | `@minecraft/server` 2.11.0, `@minecraft/server-ui` 2.3.0 | validado estáticamente y con tipos oficiales; **no probado en el juego** |
| < 26.60 | — | — | no soportado |

Ambos módulos son las versiones estables publicadas en npm el 2026-10-27, junto a Bedrock 26.60. No se pudo consultar Microsoft Learn desde el entorno de trabajo.

## Sonidos

No se incluye ningún archivo de audio. Como relleno se usan sonidos de Minecraft (faro, escudo, blaze, nivel, clic, orbe, nota). Para usar los tuyos: pon tus `.ogg` en `RP/sounds/`, decláralos en `RP/sounds/sound_definitions.json` y cambia el `id` en `BP/scripts/config.js` → `SOUNDS`. Con `id: ""` ese sonido queda en silencio.

## Validación

```bash
python tools/validate_addon.py EvilMortyAddon
python tools/compatibility_audit.py EvilMortyAddon --bedrock-version 26.60 --expected-server-api 2.11.0
```

Resultado: 0 errores y 0 advertencias. Los scripts pasan `tsc --checkJs` contra los tipos oficiales de ambos módulos.

## Pruebas dentro del juego (pendientes)

| Prueba | Estado | Riesgo |
|---|---|---|
| Importar y activar | no probado | bajo |
| Parche visible en la cabeza en 3.ª persona y en el inventario | no probado (los huesos raíz se llaman `head` / `rightItem`) | bajo |
| Guante visible en el brazo (3.ª persona) | no probado (hueso raíz `rightArm`) | bajo |
| Guante visible en 1.ª persona | no probado (copia interior unida a `rightItem`) | medio |
| Partes luminosas del parche y del guante de noche | no probado | bajo-medio: material emisivo |
| Interfaz del ojo sin franjas en pantalla ancha | no probado | medio: técnica JSON UI |
| Gesto para abrir el menú y `/evilmorty:parche` | no probado | bajo |
| Menú, Ajustes y Archivos | no probado | bajo |
| Rayo 3D orientado, estela y chispas | no probado | medio: orientación por propiedades |
| Burbuja del escudo sigue al jugador sin quedarse atrás | no probado | bajo |
| Escudo bloquea daño; Reflejar/Destruir proyectiles | no probado | bajo-medio |
| Alertas de amenaza y ficha de armas | no probado | bajo |
| Rendimiento en Android y multijugador | no probado | — |

## Regenerar arte

`python source/build_assets.py` (requiere Pillow) regenera modelos, texturas, partículas, interfaz, iconos y los JSON de render. `python source/preview_render.py salida.png` dibuja una vista previa de los modelos sobre un maniquí (requiere numpy).
