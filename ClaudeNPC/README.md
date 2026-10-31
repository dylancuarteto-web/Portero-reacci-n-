# Claude NPC — Bedrock 26.60

NPC con forma de Claude: personaje naranja con ojos que parpadean y un emblema de estrella luminoso, de diseño propio (no es el logo oficial). Pelea, construye como un jugador, rema en bote, hace su propia casa, sube de IQ con la experiencia y, cuando cinco Claudes llegan a IQ 300, se fusionan en **Claude Golden**. Namespace `claudenpc`.

## Instalación

1. Abre `dist/ClaudeNPC.mcaddon` con Minecraft y activa el paquete de comportamiento en el mundo.
2. Genera a Claude con el huevo "Generar a Claude" o `/summon claudenpc:claude`.
3. Para que te ataque: PvP activado y estar en Supervivencia o Aventura.
4. **Probar la fusión rápido** (requiere trucos): genera 5 Claudes juntos y usa `/claudenpc:iq 300`.

## IQ

Encima del nombre lleva su **IQ** (70 a 300). Sube cuando te ve construir, romper o subir en torre, cuando recibe golpes y flechas, cuando una táctica le funciona, cuando mina, craftea o termina su casa, y con el tiempo de pelea. Se guarda: un Claude nuevo hereda gran parte de lo aprendido. Con más IQ piensa más rápido, apunta mejor, bloquea más con el escudo, construye más rápido y desbloquea tácticas (perla 85, water drop 100, clutch 110, torreta 110, trampa 120, elytra + maza 125).

## Construcción humana

- **Torre:** se centra en el bloque, mira hacia abajo, salta y coloca el bloque bajo sus pies en el punto alto del salto; repite hasta tu altura. Si hay algo encima, lo rompe. Con IQ bajo a veces falla un bloque y lo reintenta.
- **Puente:** se agacha en el borde mirando el hueco, coloca y avanza (IQ bajo despacio, IQ medio más ágil). Con IQ alto hace **puentes desde el aire**: salta hacia delante y coloca bajo sus pies en pleno salto. Si estás más alto, sube en escalera.
- **Clutch:** si cae, coloca un bloque bajo sus pies apoyado en otro bloque (IQ 110+). Si la caída es grande, water drop.

## Bote

Si cae a agua profunda, o hay agua entre tú y él, saca un bote, lo pone en el agua, se sube y **rema** (animación de remos y salpicaduras) girando poco a poco hacia su destino. En la orilla se baja y recoge el bote. Sin jugadores cerca, de vez en cuando va hasta un lago o río y da un **paseo en bote**.

## Su casa

Tras un rato trabajando construye su casa, como un jugador y sin prisa (un bloque cada medio segundo, con pausas para mirar alrededor):
1. Tala un árbol cercano y planta un brote.
2. Craftea.
3. Busca un terreno plano.
4. Limpia, pone cimiento y piso, esquinas de tronco, paredes por hileras, puerta y ventanas, vigas.
5. Sube a un andamio para el techo (con alero y chimenea con fogata) y baja quitando el andamio.
6. Pone farol, mesa de crafteo, horno, cofre y alfombra.
7. Sale cerrando la puerta, hace un camino con antorchas y celebra.

De noche vuelve a su casa. Si una pelea lo interrumpe, después retoma la obra.

## Combate (jugador a menos de 32 bloques)

Se mueve como un jugador (camina, corre, salta al correr, se mueve de lado, w-tap), cambia de arma constantemente y elige entre varias alternativas según la situación y lo que aprendió de ti: torre, puente, bote, arco con animación y puntería predictiva, perla de ender, elytra + maza, salto al vacío con water drop, cavar, salto con maza, golpe de escudo, trampas y torretas de redstone.

## Trabajo (sin jugadores cerca)

Mina en escalera hacia abajo, sigue en túnel y vuelve a subir a la superficie, un bloque por golpe, poniendo antorchas y evitando la lava; solo rompe lo que su pico permite. Craftea despacio (mesa, ~9 s, saca el objeto) y mejora pico y armadura con lo minado.

## Fusión y Claude Golden

Cuando hay **cinco Claudes con IQ 300**, dejan de perseguirte y se buscan. Juntos:
1. se colocan en círculo;
2. bailan una danza propia de 8 s con música;
3. los envuelve una esfera de aura dorada;
4. **cinemática de 10 s**: la cámara gira alrededor (se oculta la interfaz y se bloquea el movimiento), los cinco suben en espiral y se funden en un destello;
5. nace **Claude Golden** (sin huevo: solo aparece así).

**Claude Golden** flota en órbita a tu alrededor, brilla (cuerpo luminoso, aura, halo giratorio y orbes), ilumina de verdad lo que tiene cerca y lleva sobre la cabeza **IQ: ???** con letras que rebotan en colores. No ataca como un mob normal: usa poderes creativos.

| Poder | Qué hace |
|---|---|
| Rebobinar | Te devuelve a donde estabas hace 5 s (y a la vida que tenías si era más). |
| Gravedad invertida | Todo lo cercano flota unos segundos y luego baja suave. |
| Arena dorada | Levanta en espiral una arena de oro y cristal a tu alrededor; se desarma sola a los 30 s. |
| Ecos de luz | Tres clones holográficos; si atrapas uno te deja una zanahoria dorada. |
| Toque de Midas | El suelo alrededor se vuelve oro en ondas y luego vuelve a la normalidad. |
| Acertijo | Te hace una pregunta: si aciertas, manzana dorada; si fallas, lección flotante. |
| Concierto | Dirige una melodía y los monstruos cercanos quedan hipnotizados. |
| Chasquido | Cambia el día por la noche (o al revés) y despeja el cielo. |

Absorbe la mayoría de las flechas. Si lo vences, se disuelve en luz y deja una estrella del Nether, manzanas doradas y experiencia.

Para que no toque bloques de tu mundo: `BP/scripts/config.js` → `MODIFICA_MUNDO = false`.

## Estado

Validado con las herramientas del kit (0 errores, 0 advertencias) y con los tipos oficiales de `@minecraft/server` 2.11.0 y `@minecraft/server-ui` 2.3.0. **No probado en el juego.** Puntos a revisar: objetos en la mano del mob, bote moviéndose con un mob como remero, orientación de puerta/horno/cofre, la cámara de la cinemática y el nombre animado de Claude Golden.

## Regenerar arte

`python source/build_assets.py` (Pillow) regenera modelos, skins, animaciones, partículas y entidades de cliente. `python source/preview_render.py salida.png` dibuja una vista previa (numpy).
