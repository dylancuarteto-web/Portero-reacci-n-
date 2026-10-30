# Especificación: Parche de Evil Morty (fan-made)

Proyecto **fan-made no oficial**, sin afiliación con *Rick and Morty* ni sus propietarios. Modelos, texturas, partículas e interfaz están creados desde cero (`source/build_assets.py`); no se usa ningún asset ni fotograma de la serie.

## Objetos

| Objeto | Identifier | Uso |
|---|---|---|
| Parche de Evil Morty | `evilmorty:parche` | Se pone en el casco. Lleva el menú integrado: **agacharse mirando hacia arriba** abre el menú; **dos veces seguidas**, escudo on/off. Respaldo: comando `/evilmorty:parche`. Requisito de todas las habilidades. |
| Mano de Rayo Láser | `evilmorty:mano_laser` | **Usar**: dispara. **Agachado + usar**: mejora con 1 bloque de diamante. |

Modelo 3D del parche: placa de cuero con borde metálico, anillo ámbar giratorio con lente que pulsa, LED rojo que parpadea, correa con luces y hebilla, módulo en la oreja con cable y antena con punta luminosa. Guante 3D: antebrazo blindado, muñequera ámbar, dedos articulados, núcleo de energía, tubos y emisor rojo que pulsa.

## Habilidades (un archivo por habilidad)

| Habilidad | Archivo | Comportamiento | Límites | Prueba de aceptación |
|---|---|---|---|---|
| Menú integrado y gestos | `BP/scripts/core/gestos.js`, `BP/scripts/core/comandos.js`, `BP/scripts/ui/menu.js` | Agacharse mirando arriba (más de 55°) con el parche puesto abre el menú; dos pulsaciones en 0,4 s alternan el escudo. Agacharse mirando al frente o abajo no hace nada (no molesta al construir). `/evilmorty:parche` abre el menú sin trucos. | Solo con el parche puesto | Con el parche, mirar arriba y agacharse: se abre el menú; dos veces rápido: escudo |
| Visión nocturna | `BP/scripts/abilities/vision_nocturna.js` | Visión nocturna mientras llevas el parche; se apaga desde el menú y se quita al quitarte el parche | — | De noche con el parche se ve todo; al desactivarla en el menú, desaparece |
| Interfaz del ojo | `BP/scripts/hud/ojo.js` + `RP/ui/hud_screen.json` | Al ponerte el parche: destello ámbar en la cámara y capa holográfica fija sobre la pantalla. Al quitártelo desaparece. Se puede ocultar en el menú. | Usa un título invisible como señal (ver limitaciones) | Equipar el parche: destello + marco ámbar; quitarlo: el marco desaparece |
| Visión predictiva | `BP/scripts/abilities/prediccion.js` | Cada 0,5 s marca con puntos ámbar la trayectoria prevista de hasta 6 criaturas/jugadores en 24 bloques durante el próximo segundo; **solo tú ves las marcas**. Al mirar a un objetivo (hasta 32 bloques), la barra de acción muestra su nombre, vida, arma de cada mano e intención (viene hacia ti y en cuántos segundos llega, se aleja, te rodea, quieto, agachado) | 6 objetivos, 5 partículas cada uno | Un zombi persiguiéndote: puntos hacia ti y "viene hacia ti (llega en X s)"; un jugador con espada: "Arma: Espada de hierro" |
| Escudo Protector | `BP/scripts/abilities/escudo.js` | Cúpula 3D ámbar que te sigue. Cancela todo daño de ataques: cuerpo a cuerpo, proyectiles, explosiones, magia, rayos, cohetes, maza y embestidas. **Sin efectos de poción.** Modo **Reflejar**: devuelve los proyectiles hacia quien los lanzó. Modo **Destruir**: los desintegra al tocar la cúpula. | No bloquea caídas, fuego, lava, ahogo ni hambre (no son ataques) | Con el escudo, un esqueleto no te hace daño; en Reflejar la flecha vuelve al esqueleto; en Destruir desaparece con chispas |
| Mano de Rayo Láser | `BP/scripts/abilities/laser.js` | Rayo 3D (entidad con modelo propio) desde la mano derecha hasta el primer objetivo o bloque; daña al primer objetivo. Mejoras con 1 bloque de diamante cada una: | Recarga 0,6 s; nivel máx. 3 | Disparar a un cerdo a 10 bloques: rayo visible y el cerdo recibe daño |

Niveles de la mano láser:

| Nivel | Daño | Alcance |
|---|---|---|
| 0 | 6 | 24 |
| 1 | 9 | 32 |
| 2 | 13 | 40 |
| 3 | 18 | 48 |

El nivel se guarda en el propio objeto (propiedad dinámica) y se muestra en su descripción.

## Menú (`BP/scripts/ui/menu.js`)

Ver `docs/UI_SPEC.md`.

## Limitaciones conocidas

- **Interfaz del ojo**: Bedrock no tiene una API estable para dibujar imágenes en el HUD. Se usa la técnica habitual de *JSON UI* que lee el texto del título: el script envía el título `evilmorty:ojo_on` con duración 0 (no se ve) y `RP/ui/hud_screen.json` muestra la capa mientras ese texto esté presente. Si otro add-on o comando muestra un título, la capa puede desaparecer hasta 10 s (se reafirma sola). Si una actualización de Minecraft cambia el HUD vanilla, borra `RP/ui/hud_screen.json` y el resto del add-on sigue funcionando.
- **Armas de criaturas**: la API solo expone el equipo de jugadores y de algunas criaturas. Cuando no se puede leer, se muestra "sin datos".
- **Botones táctiles**: no se pueden añadir botones fijos a la pantalla con la API estable; las acciones van en el menú integrado del parche, que se abre con un gesto.
- **Parche en la mano**: si el motor no expone `context.item_slot`, al sostener el parche en la mano se verá también en la cara (se prefirió que siempre se vea puesto).
- **Habilidades anteriores** (portal, señal, escape, sigilo) se retiraron porque la nueva lista del usuario las sustituye.

## Rendimiento (Android)

- Bucle de la pasiva cada 10 ticks solo sobre jugadores; partículas de predicción privadas (solo las genera el cliente del portador).
- La cúpula se mueve cada tick solo mientras el escudo está activo (una entidad por jugador).
- Proyectiles revisados cada 2 ticks en un radio de 2,6 bloques.
- Cada disparo crea una entidad que se elimina a los 6 ticks.
- Texturas pequeñas (16×16 y 32×32; HUD 640×360).

## Recursos que aporta el usuario

Sonidos opcionales en `BP/scripts/config.js` → `SOUNDS` (escudo on/off/impacto, láser, mejora, ojo).
