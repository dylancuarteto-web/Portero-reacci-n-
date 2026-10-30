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

- **Menú integrado**: el parche lleva el menú dentro; no hace falta ningún control aparte.
- **Interfaz del ojo**: al ponerte el parche, destello ámbar y una capa holográfica en pantalla.
- **Visión nocturna**: activable desde el menú.
- **Visión predictiva**: ves hacia dónde se moverán criaturas y jugadores cercanos (solo tú), y al mirarlos, su vida, sus armas y su intención.
- **Escudo Protector**: cúpula 3D que bloquea todos los ataques, sin pociones. Modo Reflejar o Destruir proyectiles.
- **Mano de Rayo Láser**: rayo 3D que daña al objetivo. 3 mejoras con bloques de diamante (daño 6→18, alcance 24→48).

Detalle: `docs/FEATURE_SPEC.md` · Interfaz: `docs/UI_SPEC.md` · IDs: `docs/ASSET_REGISTRY.md`.

## Compatibilidad

| Target Bedrock | Perfil | Script API | Estado |
|---|---|---|---|
| 26.60 | modern-stable | `@minecraft/server` 2.11.0, `@minecraft/server-ui` 2.3.0 | validado estáticamente y con tipos oficiales; **no probado en el juego** |
| < 26.60 | — | — | no soportado |

Ambos módulos son las versiones estables publicadas en npm el 2026-10-27, junto a Bedrock 26.60. No se pudo consultar Microsoft Learn desde el entorno de trabajo.

## Sonidos

No se incluyen. Pon tus `.ogg` en `RP/sounds/`, decláralos en `RP/sounds/sound_definitions.json` y escribe sus nombres en `BP/scripts/config.js` → `SOUNDS`.

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
| Parche visible en la cabeza en 3.ª persona | no probado (corregido: los huesos raíz ahora se llaman `head` / `rightItem`) | bajo |
| Guante visible en el brazo | no probado (corregido: hueso raíz `rightArm`) | bajo-medio en 1.ª persona |
| Gesto para abrir el menú y `/evilmorty:parche` | no probado | bajo |
| Capa del ojo aparece/desaparece al poner/quitar el parche | no probado | **medio-alto**: técnica JSON UI (ver limitaciones en FEATURE_SPEC) |
| Rayo 3D orientado hacia donde apuntas y con brillo | no probado | medio: orientación por propiedades y material emisivo |
| Cúpula 3D sigue al jugador | no probado | bajo |
| Escudo bloquea daño; Reflejar/Destruir proyectiles | no probado | bajo-medio |
| Visión predictiva y ficha de armas | no probado | bajo |
| Menú y Archivos | no probado | bajo |
| Rendimiento en Android y multijugador | no probado | — |

## Regenerar arte

`python source/build_assets.py` (requiere Pillow).
