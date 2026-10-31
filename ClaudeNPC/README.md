# Claude NPC — Bedrock 26.60

NPCs con forma de Claude: personaje naranja con ojos que parpadean y un emblema de estrella luminoso, de diseño propio (no es el logo oficial). **Cada Claude tiene su propia personalidad** y hace lo que quiere: pelea con espada y escudo, construye, mina, tala, pesca, cultiva, rema en bote, se hace su casa, va a clase con **Claude Maestro**, sube de IQ y, cuando cinco Claudes llegan a IQ 300, se fusionan en **Claude Golden**. Namespace `claudenpc`.

## Instalación

1. Abre `dist/ClaudeNPC.mcaddon` con Minecraft y activa el paquete de comportamiento en el mundo.
2. Genera a Claude con el huevo "Generar a Claude" y al maestro con "Generar a Claude Maestro" (o `/summon claudenpc:claude` y `/summon claudenpc:maestro`).
3. Para que te ataquen: PvP activado y estar en Supervivencia o Aventura.
4. Comandos (operador): `/claudenpc:clase` hace que el maestro más cercano empiece la clase ya; `/claudenpc:iq 300` (con trucos) pone el IQ de los Claudes cercanos, útil para probar la fusión con 5 Claudes.

## Novedades de la v5

| Antes | Ahora |
|---|---|
| Claude Golden no era hostil | Es un **jefe hostil**: te persigue volando, se lanza a golpearte con la palma dorada, te devuelve las flechas y usa 12 poderes creativos (ver abajo). Con la mitad de vida entra en **fase 2 (IQ al 200%)**. |
| Esfera de fusión pálida | **Esfera dorada luminosa**: cáscara de oro translúcida con meridianos y anillos que brillan, chispas doradas y luz real alrededor. |
| Ojo normal | **Su ojo derecho brilla** con un esplendor reluciente: núcleo blanco que late, rayos en cruz que giran y destellos pegados al ojo (más grandes en fase 2). |
| Al pegarte o tirarte flechas retrocedían "temblando" | Sin pasos atrás bruscos ni tirones: para mirarte ya no se teletransportan. A media distancia te rodean con un paso lateral suave y al tensar el arco caminan despacio sin quitarte la vista. |
| La clase no subía el IQ de 280 | Las clases suben el IQ **hasta 300**. |
| Con IQ 300 se transformaban al instante | Los 5 genios te avisan, **te buscan**, se ponen en círculo frente a ti y recién ahí empieza la danza y la cinemática (si alguno se atrasa, llega con una perla). |
| Después de clase se quedaban encerrados picando | Al terminar se levantan y **salen en orden por el pasillo y la puerta**, que el maestro deja abierta hasta que salgan todos. Ya no minan ni rompen bloques dentro o al lado de sus casas y del aula. |

## Novedades de la v4

| Antes | Ahora |
|---|---|
| Tardaba mucho en construir | Construye a ritmo de jugador rápido (4-6 bloques por segundo) y, con más IQ, encadena 2 o 3 bloques seguidos. Puentes, torres, talar y craftear también son más rápidos. |
| En el agua se quedaban tiesos | En el agua nunca se quedan quietos: nadan hacia la orilla (o hacia ti) y salen saltando. El bote comprueba que de verdad va montado; si falla o se atasca, se baja y sigue nadando, sin repetir. |
| Todos minaban y ponían bloques igual | Cada Claude tiene personalidad, gustos, ritmo y bloque propios, y elige qué hacer sin repetirse (ver abajo). |
| No rompían tu pared | Reconocen los bloques que pones y los rompen con la herramienta correcta (pico, hacha, pala, tijeras o la mano) en el tiempo que tardaría un jugador; si se atascan, se abren paso en escalón hacia ti. No rompen bedrock ni bloques de comando, ni obsidiana sin pico de diamante, ni sus propias casas o el aula. |
| Golpes sin animación | Cada golpe cuerpo a cuerpo tiene animación según el arma: espadazo (alterna derecha y revés), hachazo o estocada con tridente. |
| Atacaban con el escudo | El escudo ya no golpea. Atacan con espada (casi siempre). El escudo va en la otra mano y lo **levantan cuando les apuntas con arco, ballesta o tridente** (o ven venir un proyectil): caminan despacio y las flechas que llegan por delante rebotan. Con más IQ reaccionan antes; para atacar lo bajan. |

## Personalidades

Al nacer, cada Claude recibe una personalidad (se evita repetir la de los Claudes cercanos) con valores variados al azar. Se ve sobre su cabeza junto a lo que está haciendo.

| Personalidad | Le gusta | Al pelear prefiere |
|---|---|---|
| Minero | Minar en escalera y túnel, craftear | Cavar, trampas |
| Constructor | Hacer su casa enseguida, decorar (faroles, flores, bancos) | Torres y puentes, torretas |
| Explorador | Recorrer el terreno, mirar el paisaje, pasear en bote | Perlas, elytra, arco |
| Leñador | Talar árboles y replantar | Salto con maza |
| Granjero | Huerto 3x3 con agua y trigo: ara, siembra, cosecha y usa polvo de hueso | Arco, trampas |
| Pescador | Pescar en la orilla (bacalao, salmón, a veces un tesoro) y remar | Bote, arco |
| Arquero | Explorar y observar | Arco (mucho) |
| Inventor | Craftear y decorar | Torretas y trampas de redstone |
| Dormilón | Sentarse a descansar (zzz) | Poco: solo si te acercas mucho |
| Guerrero | Explorar y minar | Maza, elytra, salto al vacío |

Además: cada uno tiene su radio para fijarse en ti (de 12 a 32 bloques), su velocidad, su profundidad de mina, el bloque de sus torres y puentes (piedra, roble, ladrillo de piedra, arenisca...) y el estilo de su casa (roble, abeto, abedul, piedra o ladrillo). Si lo golpeas, pelea aunque estuviera tranquilo. De noche vuelve a su casa a dormir.

## Claude Maestro (IQ 280)

No ataca. Lleva lentes, cabello formal peinado de lado, saco de tweed con coderas, camisa, corbata, una insignia luminosa y un libro.

1. **Construye un aula** como un jugador: piso de abedul, paredes blancas con ventanales, techo con luces, pizarra negra con marco y tres carteles, mesa con campana, atril, estanterías, 12 pupitres con su silla, pasillo con alfombra, puerta, cartel "AULA", camino y faroles. Si no puede construir, da la clase al aire libre.
2. **Toca la campana** (la primera clase a los ~30 s, luego cada 2-3 minutos). Los Claudes a menos de 64 bloques **dejan de perseguirte** y de hacer lo que hacían, van a clase por la puerta y el pasillo y se sientan mirando la pizarra (si alguno se atasca, llega con una perla de ender).
3. **La clase dura ~75 s**: escribe el tema en la pizarra letra por letra, explica tres ideas (las ves en la barra de acción), señala alumnos, escribe los apuntes, hace una pregunta (un alumno levanta la mano y, si acierta, aplausos) y deja tarea. Los alumnos toman apuntes y suben de IQ todo el rato (hasta 300).
4. Al terminar, se levantan y salen en orden por la puerta con **bono x2: aprenden el doble durante 5 minutos** (sale "x2" junto a su IQ) y usan más la táctica de la lección (torres, puentes, arco, escudo, water drop, redstone, trampas, perlas, elytra, construcción, minería o matemáticas).

**Tócalo** (botón "Hablar") para ver su estado y la próxima lección, o para empezar la clase en ese momento. Si lo golpeas suspende la clase y los Claudes cercanos lo defienden.

## IQ

Encima del nombre lleva su **IQ** (70 a 300). Sube cuando te ve construir, romper o subir en torre, cuando recibe golpes y flechas, cuando bloquea una flecha, cuando una táctica le funciona, al minar, talar, pescar, cultivar, explorar o terminar su casa, y en clase (hasta 300). Se guarda: un Claude nuevo hereda gran parte de lo aprendido. Con más IQ piensa más rápido, apunta mejor, levanta antes el escudo, construye más rápido y desbloquea tácticas (perla 85, water drop 100, clutch 110, torreta 110, trampa 120, elytra + maza 125).

## Combate

Se mueve como un jugador (camina, corre, salta al correr y te rodea con pasos laterales suaves, sin tirones), cambia de arma de vez en cuando (casi siempre una espada) y elige entre alternativas según la situación, lo que aprendió de ti y su personalidad: torre, puente, bote, arco con puntería predictiva, perla de ender, elytra + maza, salto al vacío con water drop, cavar, salto con maza, trampas, torretas de redstone y abrirse paso rompiendo tu pared.

## Fusión y Claude Golden

Cuando hay **cinco Claudes con IQ 300** (y no están en clase), dejan lo que hacían y **te buscan**. Se colocan en círculo frente a ti, bailan una danza propia, los envuelve una **esfera dorada luminosa** y, tras una **cinemática de 10 s**, nace **Claude Golden**.

**Claude Golden** (300 de vida, jefe hostil) brilla entero, su **ojo derecho** despide un destello que gira y late, y lleva **IQ: ???** con letras que rebotan en colores. Al verte chasquea los dedos: se hace de noche y empieza la pelea. Verás su vida en la barra de acción.

| Poder | Qué hace | Cómo salvarte |
|---|---|---|
| Lluvia de ideas | Caen bombillas de luz donde estás y donde vas a estar | Sal de los círculos del suelo |
| Estrella fugaz | Sube brillando, cae en picada y salen dos ondas de luz por el suelo | Salta cuando pase la onda |
| Ascensor dorado | Una columna de oro te sube 12 bloques y luego se deshace | Sal del círculo dorado (o haz water drop) |
| Tu reflejo | Un espejo de luz y tu reflejo, que copia tus pasos al revés | Pégale tú primero y se rompe |
| Ctrl + Z | Deshace los bloques que pusiste en los últimos 30 s y te devuelve 3 s atrás | No confíes en tu torre |
| Sol de bolsillo | Un sol pequeño te persigue y te quema al aire libre | Escóndete bajo un techo |
| Agujero de oro | Una singularidad que lo atrae todo y al cerrarse explota | Corre en dirección contraria |
| Partitura | Notas musicales que te persiguen, girando despacio | Muévete de lado en el último momento |
| Jaque | El suelo se vuelve un tablero de oro y negro; estalla un color | Cámbiate de color o salta |
| ¿Cuál soy yo? | Se divide en tres que cambian de lugar | Encuentra al verdadero (los falsos te ciegan) |
| Gravedad al revés | Todos flotan... y caen de golpe | Water drop o caer en agua |
| Duelo de IQ | Te hace una pregunta | Si aciertas queda aturdido y recibe el doble de daño; si fallas, rayo |

Además se lanza cada tanto a golpearte (ese es el momento de devolverle el golpe), quieto mientras dirige o lee es más fácil de alcanzar, y devuelve la mayoría de las flechas. Los bloques del tablero y del ascensor vuelven a ser como eran. Si lo vences: estrella del Nether, manzanas doradas (una encantada) y experiencia.

Para que no toquen bloques de tu mundo: `BP/scripts/config.js` → `MODIFICA_MUNDO = false` (el maestro dará la clase al aire libre).

## Estado

Validado con las herramientas del kit (0 errores, 0 advertencias) y con los tipos oficiales de `@minecraft/server` 2.11.0 y `@minecraft/server-ui` 2.3.0. El plano del aula y de las casas se revisó con una vista 3D generada desde el mismo código (`source/vista_aula.png`) y los modelos con `source/vista_previa.png`. **No probado en el juego.** Puntos a revisar: postura sentada sobre las sillas, el escudo en la mano al levantarlo, que las flechas reboten, el bote con un mob como remero, las partículas del ojo de Claude Golden (van pegadas al ojo) y el brillo de la esfera de fusión.

## Regenerar arte

`python source/build_assets.py` (Pillow) regenera modelos, skins, animaciones, partículas y entidades de cliente. `python source/preview_render.py salida.png` dibuja la vista previa de los personajes (numpy).
