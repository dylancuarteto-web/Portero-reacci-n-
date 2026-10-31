# Especificación: Parche de Evil Morty (fan-made)

Proyecto **fan-made no oficial**, sin afiliación con *Rick and Morty* ni sus propietarios. Modelos, texturas, partículas, interfaz e iconos están creados desde cero (`source/build_assets.py`); no se usa ningún asset ni fotograma de la serie.

## Objetos

| Objeto | Identifier | Uso |
|---|---|---|
| Parche de Evil Morty | `evilmorty:parche` | Se pone en el casco. Lleva el menú integrado: **agacharse mirando hacia arriba** abre el menú; **dos veces seguidas**, escudo on/off. Respaldo: comando `/evilmorty:parche`. Requisito de todas las habilidades. |
| Mano de Rayo Láser | `evilmorty:mano_laser` | **Usar**: dispara. **Agachado + usar**: mejora con 1 bloque de diamante. |

**Modelo 3D del parche** (textura 64×64): placa de cuero redondeada con borde metálico, costura y tornillos; carcasa de lente con lente ámbar luminosa que pulsa y una retícula que gira; LED rojo; correa por fuera de la capa del sombrero de la skin con tres luces en secuencia y hebilla; módulo en la oreja con rejillas y franja luminosa; cable hasta la placa; antena con punta que parpadea. Las piezas luminosas usan un material emisivo, así que se ven también de noche y sobre skins oscuras.

**Modelo 3D del guante** (textura 64×64): antebrazo blindado con paneles y remaches, placas exteriores con galones ámbar, muñequera ámbar, mano con nudillera, cuatro dedos con falange y punta, pulgar, emisor rojo en la palma, núcleo de energía en el dorso, tubos en la espalda y dos franjas luminosas. En primera persona se añade una copia interior unida a la mano para que el guante se vea al sostenerlo.

## Habilidades (un archivo por habilidad)

| Habilidad | Archivo | Comportamiento | Límites | Prueba de aceptación |
|---|---|---|---|---|
| Menú integrado y gestos | `core/gestos.js`, `core/comandos.js`, `ui/menu.js` | Agacharse mirando arriba (más de 55°) con el parche puesto abre el menú; dos pulsaciones en 0,4 s alternan el escudo. Agacharse mirando al frente o abajo no hace nada (no molesta al construir). `/evilmorty:parche` abre el menú sin trucos. | Solo con el parche puesto | Mirar arriba y agacharse: menú; dos veces rápido: escudo |
| Interfaz del ojo | `hud/ojo.js` + `RP/ui/hud_screen.json` | Al ponerte el parche: destello ámbar, anillos de partículas y la interfaz holográfica (esquinas, retícula, etiqueta, señal, líneas de escaneo y viñeta suave). Las piezas van ancladas a los bordes: no se deforman ni dejan franjas en pantallas anchas. | Usa un título invisible como señal (ver limitaciones) | Equipar el parche: aparece la interfaz; quitarlo: desaparece |
| Visión nocturna | `abilities/vision_nocturna.js` | Activa mientras llevas el parche; se desactiva en Ajustes | — | De noche se ve todo; al desactivarla, desaparece |
| Visión predictiva | `abilities/prediccion.js` | Cada 0,5 s marca la trayectoria prevista (próximo segundo) de hasta 6 criaturas o jugadores en 24 bloques; **solo tú ves las marcas**. Al mirar a un objetivo (32 bloques), ficha en la barra de acción: nombre, vida, armas e intención. Si no miras a nada y una criatura hostil o un jugador viene hacia ti (12 bloques, llega en menos de 3 s), alerta "[!] Zombi llega en 1.8 s" con un aviso sonoro. Sin objetivos no se muestra nada. | 6 objetivos, 4 marcas cada uno | Un zombi persiguiéndote: marcas hacia ti y alerta; al mirarlo, su ficha |
| Escudo Protector | `abilities/escudo.js` | Burbuja esférica 3D de energía (rejilla geodésica, anillo de escaneo que sube y baja, anillo en el suelo) que te sigue adelantándose a tu velocidad. Cancela el daño de ataques: cuerpo a cuerpo, proyectiles, explosiones, magia, rayos, cohetes, maza y embestidas. **Sin efectos de poción.** Modo **Reflejar**: devuelve los proyectiles a quien los lanzó. Modo **Destruir**: los desintegra al tocar la burbuja. | No bloquea caídas, fuego, lava, ahogo ni hambre | Un esqueleto no te hace daño; en Reflejar la flecha vuelve; en Destruir se desintegra |
| Mano de Rayo Láser | `abilities/laser.js` | Rayo 3D de tres capas (núcleo emisivo, dos halos y una espiral que gira) desde la mano hasta el primer objetivo o bloque, con estela de chispas, destello en la mano e impacto con chispas. Daña al primer objetivo. | Recarga 0,6 s; nivel máx. 3 | Disparar a un cerdo a 10 bloques: rayo, chispas y daño |

Niveles de la mano láser (cada mejora consume 1 bloque de diamante; el rayo se ensancha con el nivel):

| Nivel | Daño | Alcance |
|---|---|---|
| 0 | 6 | 24 |
| 1 | 9 | 32 |
| 2 | 13 | 40 |
| 3 | 18 | 48 |

El nivel se guarda en el propio objeto (propiedad dinámica) y se muestra en su descripción.

## Menú

Ver `docs/UI_SPEC.md`.

## Sonidos

Se usan sonidos de Minecraft como relleno (no se incluye ningún archivo de audio): `BP/scripts/config.js` → `SOUNDS`. Cada entrada tiene `id`, `pitch` y `volume`; para usar tus propios sonidos, declara su nombre en `RP/sounds/sound_definitions.json` y cámbialo en `id`, o deja `id: ""` para silenciarlo.

## Limitaciones conocidas

- **Interfaz del ojo**: Bedrock no tiene una API estable para dibujar imágenes en el HUD. Se usa la técnica habitual de *JSON UI* que lee el texto del título: el script envía el título `evilmorty:ojo_on` con duración 0 (no se ve) y `RP/ui/hud_screen.json` muestra la interfaz mientras ese texto esté presente. Si otro add-on o comando muestra un título, la interfaz puede desaparecer hasta 10 s (se reafirma sola). Si una actualización cambia el HUD vanilla, borra `RP/ui/hud_screen.json` y el resto sigue funcionando.
- **Armas de criaturas**: la API solo expone el equipo de jugadores y de algunas criaturas; si no se puede leer, se muestra "sin datos".
- **Botones táctiles**: no se pueden añadir botones fijos a la pantalla con la API estable; las acciones van en el menú integrado, que se abre con un gesto.
- **Parche en la mano**: si el motor no expone `context.item_slot`, al sostener el parche en la mano también se verá en la cara (se prefirió que siempre se vea puesto).
- **Guante en primera persona**: depende de cómo coloque Bedrock el brazo al sostener un objeto; la copia interior unida a la mano lo cubre si el brazo no se dibuja.

## Rendimiento (Android)

- Bucle de la pasiva cada 10 ticks solo sobre jugadores; partículas de predicción privadas.
- La burbuja se mueve cada tick solo mientras el escudo está activo (una entidad por jugador, ~150 caras).
- Proyectiles revisados cada 2 ticks en un radio de 2,6 bloques.
- Cada disparo crea una entidad que se elimina a los 6 ticks y una sola llamada de partículas para toda la estela (máx. 100 chispas).
- Texturas: modelos 64×64, iconos 32×32, atlas de partículas 64×64, piezas de interfaz ≤128×72.
