# Parche del Estratega

Add-on para **Minecraft Bedrock 26.60**: un parche 3D con habilidades de portal, señal, escape y sigilo, con efectos especiales y animaciones. Namespace `estr`.

## Instalación

1. Abre `dist/ParcheDelEstratega.mcaddon` en el dispositivo (en Android: ábrelo con Minecraft).
2. En el mundo, activa el **paquete de comportamiento** (se activa el de recursos con él).
3. No hace falta activar experimentos: solo usa Script API estable.

## Cómo se usa

- **Parche del Estratega**: póntelo en el casco. Te da visión nocturna. Receta: `S S / LRL / ␣L␣` (S = cuerda, L = cuero, R = redstone).
- **Transmisor del Parche**: en la mano. **Usar** lanza la habilidad; **agachado + usar** cambia de habilidad. Receta: `␣E␣ / IRI / ␣I␣` (E = perla de ender, I = hierro, R = redstone).
- En creativo están en la pestaña *Equipo*, o con `/give @s estr:parche` y `/give @s estr:transmisor`.

| Habilidad | Efecto | Recarga |
|---|---|---|
| Salto de portal | Te teletransporta al bloque que miras (hasta 32) con portal verde | 3 s |
| Señal del parche | Inmoviliza criaturas cercanas 6 s, sin daño | 20 s |
| Romper la Curva | Te devuelve a tu cama/punto de reaparición, aunque estés en otra dimensión | 30 s |
| Sin rastro | Invisibilidad 20 s con humo | 40 s |

Detalle completo en `docs/FEATURE_SPEC.md`; identificadores en `docs/ASSET_REGISTRY.md`.

## Compatibilidad

| Target Bedrock | Perfil | Script API | Estado |
|---|---|---|---|
| 26.60 | modern-stable | `@minecraft/server` 2.11.0 | validado estáticamente y con tipos oficiales; **no probado en el juego** |
| < 26.60 | — | — | no soportado (no hay perfil legacy) |

`@minecraft/server` 2.11.0 se publicó en npm el 2026-10-27, el mismo día que Bedrock 26.60; la versión beta siguiente se etiqueta `1.26.61`. No se pudo consultar Microsoft Learn desde el entorno de trabajo.

## Sonidos

No se incluyen archivos de sonido. Para añadirlos:
1. Pon tus `.ogg` en `RP/sounds/estr/` y decláralos en `RP/sounds/sound_definitions.json` (por ejemplo `estr.portal`).
2. Escribe esos nombres en `BP/scripts/config.js` → `SOUNDS`.

## Validación

```bash
python tools/validate_addon.py EstrategaAddon
python tools/compatibility_audit.py EstrategaAddon --bedrock-version 26.60 --expected-server-api 2.11.0
```

Resultado: 0 errores y 0 advertencias en ambos. Los scripts además pasan `tsc --checkJs` contra los tipos de `@minecraft/server` 2.11.0. Recomendado: pasar también el Inspector de `mctools.dev`.

## Pruebas dentro del juego (pendientes)

| Prueba | Estado |
|---|---|
| Importar el `.mcaddon` y activar los packs | no probado |
| El parche se ve en la cabeza (ojo derecho) y no se ve doble en la mano | no probado — depende de `context.item_slot` en el render controller |
| Animación del LED y del parche | no probado |
| Las 4 habilidades y la pasiva (tabla de `FEATURE_SPEC.md`) | no probado |
| Animaciones del jugador al lanzar (tercera persona) | no probado |
| Rendimiento en Android | no probado |
| Multijugador (recargas por jugador) | no probado |

## Regenerar el modelo y las texturas

`python source/build_assets.py` (requiere Pillow) reescribe la geometría, las texturas y los iconos.
