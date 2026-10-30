# Especificación: Parche del Estratega

## Identidad

Un parche negro con correa y un pequeño LED rojo, inspirado en el arquetipo del "estratega del parche". Modelo, texturas, iconos y partículas son de diseño propio: no se copia arte, logos ni texturas de ninguna serie. El nombre visible es original y puede cambiarse en `RP/texts/*.lang`.

## Bucle de uso

1. Fabricas el **Parche del Estratega** y te lo pones en el casco.
2. Mientras lo llevas tienes **Visión del Estratega** (visión nocturna) y el LED del parche parpadea.
3. Fabricas el **Transmisor del Parche** y lo llevas en la mano.
4. **Agachado + usar** cambia de habilidad. **Usar** lanza la habilidad elegida.
5. La barra de acción muestra la habilidad, el resultado y el tiempo de recarga.

## Habilidades

| Habilidad | Inspiración | Comportamiento | Recarga | Responsable | Fallback | Prueba de aceptación |
|---|---|---|---|---|---|---|
| Visión del Estratega (pasiva) | Siempre ve más que los demás | Visión nocturna mientras el parche está en el casco; destello rojo en el ojo cada 2 s | — | `passive.js` | Si falla `getComponent`, no aplica | Ponerse el parche en una cueva oscura: se ve todo; quitarlo: el efecto termina en ≤15 s |
| Salto de portal | Viaja entre realidades con portales | Raycast hasta 32 bloques; abre un portal verde en origen y destino y te teletransporta encima del bloque | 3 s | `abilities.js` → `castPortal` | Sin hueco libre de 2 bloques: mensaje y sin recarga | Mirar a un bloque a 20 bloques y usar: apareces encima tras 0,3 s |
| Señal del parche | El parche es un transmisor de control mental | Onda morada; inmoviliza (lentitud X) hasta 16 criaturas en 12 bloques durante 6 s. **Sin daño** y nunca afecta a jugadores | 20 s | `abilities.js` → `castSignal` | Entidades sin efectos se ignoran | Junto a 3 vacas: las 3 se quedan quietas 6 s y el mensaje dice "3" |
| Romper la Curva | Escapa de la Curva Finita Central | Te eleva 1 s, abre un portal y te lleva a tu punto de reaparición (cama/ancla) aunque estés en otra dimensión; si no tienes, al spawn del mundo | 30 s | `abilities.js` → `castEscape` | Si el spawn no tiene altura, usa el bloque más alto | Desde el Nether con cama en el Overworld: apareces junto a la cama |
| Sin rastro | Elimina el rastreo que lo delataba | Humo oscuro e invisibilidad 20 s | 40 s | `abilities.js` → `castStealth` | — | Usar: el personaje desaparece 20 s |

## Alcance excluido

- **Sin habilidades de daño ni de combate**, por la regla 12 del kit Bedrock AI Architect. La "Señal" inmoviliza, no hiere.
- **Sin control real de criaturas** (hacer que sigan órdenes): no hay API estable que lo permita sin entidades propias.
- **Sin sonidos**: el usuario los añadirá (ver README).
- El Transmisor usa icono 2D; el objeto 3D es el parche.

## Módulos

- **BP**: objetos (`items/`), recetas (`recipes/`), Script API (`scripts/`).
- **RP**: geometría, attachable, render controller, animaciones, partículas, texturas e idiomas.
- **Script**: `main.js` (eventos), `abilities.js`, `passive.js`, `vfx.js`, `config.js` (todos los ajustes).

## Rendimiento (Android)

- Un único `runInterval` cada 40 ticks recorre solo jugadores.
- Ninguna partícula por tick. Máximo por lanzamiento: unas 66 partículas (portal: anillo de 36 y espiral de 30), con vida ≤1,4 s.
- La Señal limita a 16 objetivos y 6 partículas por objetivo.
- Texturas de 16×16 y modelo de 8 cubos.

## Recursos que aporta el usuario

- Sonidos (`portal`, `signal`, `escape`, `stealth`) en `BP/scripts/config.js` → `SOUNDS`.
