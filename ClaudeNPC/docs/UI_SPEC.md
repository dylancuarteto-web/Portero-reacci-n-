# Especificación de interfaz: barra de jefe de Claude Golden (v8.1, nombre arreglado en v8.2)

## Usuarios y plataforma
- Minecraft Bedrock 1.21.132 en adelante (también 26.x), pensado primero para **celular** (pantalla horizontal, controles táctiles) y válido en PC y consola.
- Se ve durante la batalla final de Claude Golden (desde el chasquido que lo cura a 1000 hasta su muerte).
- Multijugador: cada jugador en el alcance de la barra de jefe (64 bloques) ve la misma barra.

## Qué cambia
| Antes (v8.0) | Ahora (v8.1) |
| --- | --- |
| Arriba: nombre "Desconocido" y la barra morada de Minecraft | Arriba, **en el mismo lugar**: la barra dorada de Golden con sus alas y su cara (sin letras) |
| En el centro: una barra dorada de dibujos de la fuente, enorme | Se quitó; en el centro solo salen los íconos pequeños de los relojes mientras están activos |

## Esquema (píxeles de interfaz, 232 x 28)
```
            ╭──╮
   <<  ┌───══╡☻ ╞══───┐  >>      fila 1: alas doradas + medallón con su cara y corona
       │ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░ │      fila 2: barra de 182 x 5 (como la vanilla), marcas cada 10 %
       └────────────────────┘
```
- Placa oscura casi opaca con borde dorado; tapa por completo el lugar del nombre y de la barra vanilla.
- Medallón centrado arriba (donde iba el nombre): cara dorada, ojos blancos, ojo derecho con destello y corona con gema roja.
- Barra: oro con brillo arriba y sombra abajo; se vacía de derecha a izquierda con la vida.

## Paleta
| Uso | Color |
| --- | --- |
| Borde y marco | #CE9A36 |
| Brillo del borde | #FFE48C |
| Placa | #2E200E → #140D06 |
| Relleno | #FFF8CC (brillo) → #FFD246 → #DC8C1A → #96520E |
| Ranura vacía | #160E06 |
| Gema de la corona | #E6283C |

## Estados
| Estado | Qué se ve |
| --- | --- |
| Antes de la fase final | Nada (Golden no tiene barra de jefe) |
| Chasquido y curación | La barra se llena de su vida baja hasta 1000 |
| Batalla | La barra baja con cada golpe (ancho = vida / 1000) |
| Relojes activos | Además, abajo, 4 relojes (encendido/apagado) y 10 marcas del tiempo que queda, pequeños |
| Muerte | La barra desaparece con él |
| Otros jefes (robot, Wither, dragón) | Su barra normal, sin cambios |

## Método técnico
- `RP/ui/_ui_defs.json` registra `RP/ui/claudenpc_jefe.json` (espacio de nombres propio `claudenpc_jefe`).
- `RP/ui/hud_screen.json` tiene **un solo punto de entrada**: `modifications` → `insert_back` en `boss_health_panel` (la plantilla de cada barra de jefe) agrega `claudenpc_jefe.barra_golden`.
- Cada barra de jefe lee `#bossName` de la colección `boss_bars`. La barra dorada se muestra solo si el nombre contiene "laude" y "olden" (sirve con el nombre en texto o como clave de idioma). Con la misma condición, invertida, se ocultan `boss_name_panel` y `boss_health_panel/progress_bar_for_collections` (el nombre y la barra morada).
- El relleno usa el mismo enlace que la barra vanilla: `#progress_percentage` → `#clip_ratio` con `clip_direction: left`.
- El nombre de la barra ("Claude Golden") está en la entidad, en el campo `name` de `minecraft:boss` (grupo `claudenpc:final`). Sin ese campo Minecraft mostraba "Desconocido" (v8.0 y v8.1): la barra se agrega a mitad de la partida con un grupo de componentes y no toma ni la etiqueta de nombre ni el nombre del idioma. El Robot de los Claudes sí lo tenía, por eso su barra siempre salió bien. Golden no lleva etiqueta sobre la cabeza.
- Texturas: `RP/textures/ui/claudenpc/jefe_marco.png` (928 x 112) y `jefe_lleno.png` (728 x 20), dibujadas a 4 px por píxel de interfaz para que se vean nítidas en cualquier escala.

## Respaldo y compatibilidad
- JSON UI no tiene versiones: una actualización de Minecraft que renombre `boss_health_panel`, `boss_name_panel` o `progress_bar_for_collections` puede romper la barra. Por eso:
  - si la interfaz no carga, se ve la barra normal de Minecraft con el nombre **Claude Golden**, nunca "Desconocido";
  - si solo fallara ocultar lo vanilla, la placa opaca de la barra dorada lo tapa.
- Otros paquetes de recursos que cambien la barra de jefe pueden chocar con este; el cambio es mínimo (un `insert_back` y dos enlaces de visibilidad).

## Pruebas pendientes en el juego
- [ ] Celular: la barra no tapa los botones de arriba y se lee bien en la escala de interfaz por defecto.
- [ ] La barra baja al pegarle y se llena con el chasquido.
- [ ] El nombre y la barra morada no se ven cuando el jefe es Golden; el robot sigue con su barra normal.
- [ ] Dos jefes a la vez (Golden y el robot): cada uno con su barra.
- [ ] Los íconos de los relojes se ven pequeños (celdas de 16 px).

**No probado en el juego.**
