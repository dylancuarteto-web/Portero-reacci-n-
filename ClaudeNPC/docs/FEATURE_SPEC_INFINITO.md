# Claude Exponencial Infinito — INFINITE DETERMINATION

Especificación (v10.0 del add-on Claude NPC). Proyecto fan-made: la DETERMINACIÓN se inspira en una idea de Undertale, pero el modelo, las texturas, las partículas y las animaciones son propias. No es contenido oficial.

## 1. Resultado observable

Un Claude que **no construye** y que solo pelea. No se mide por IQ sino por **DETERMINACIÓN**: empieza como NOOB (espada de madera, golpes lentos, errores) y, peleando contra jugadores y monstruos, sube por **20 fases** hasta **INFINITE DETERMINATION**. Lo que cambia en cada fase es su forma de pensar (cuándo ataca, cómo se mueve, qué arma elige, qué combo usa y cómo se adapta a ti), no solo su vida y su daño. **No muere**: con poca vida queda derribado y **un Claude lo lleva a recuperarse**. La única forma de vencerlo para siempre es **sellarlo** con una estructura mientras está derribado.

## 2. Versiones

| Qué | Valor |
|---|---|
| Juego | Bedrock **1.21.132** en adelante (también 26.x) |
| `min_engine_version` | 1.21.130 |
| `@minecraft/server` | 2.4.0 (estable) |
| `@minecraft/server-ui` | 2.0.0 (estable) |
| Entidades BP | `format_version` 1.21.0 |
| Cliente, animaciones, geometrías, partículas | 1.10.0 / 1.8.0 / 1.16.0 / 1.10.0 |

Todas las funciones de script se cotejaron con los tipos oficiales de la 2.4.0 (`createExplosion` con `breaksBlocks`, `projectileHitBlock`, `projectileHitEntity`, `isSprinting`, `isFalling`, `Player.isJumping`, `isSneaking`, `applyImpulse`, `applyKnockback`, `setRotation`, `optionalParameters` de los comandos). No se usan módulos beta.

## 3. Módulos (`BP/scripts/infinito/`)

| Módulo | Archivo | Responsabilidad |
|---|---|---|
| Configuración | `config.js` | Umbrales, ganancias y límites, identificadores, sello. Todo ajustable. |
| Estado y guardado | `registro.js` | Estado de cada Infinito y su propiedad dinámica. |
| PhaseManager | `fases.js` | Las 20 fases: técnicas que desbloquea cada una, reacción, puntería, armas, vida. Presentación al evolucionar. |
| DeterminationSystem | `determinacion.js` | Determinación, experiencia y niveles (adaptación, reacción, precisión, movimiento, combos, armas, predicción). Umbrales exponenciales con tope. |
| MemorySystem | `memoria.js` | Memoria de combate por oponente (limitada): armas, saltos, distancia, escapes, escudo, ritmo de golpes, secuencias repetidas, estrategias que funcionaron o fallaron. |
| AdaptationEngine | `adaptacion.js` | Lee la memoria y decide el contraataque: estilo, pesos de los combos, combos prohibidos, anticipación. |
| WeaponManager | `armas.js` | Armas con propósito, rango, estrategia, combos y animación; elige con reglas (nunca al azar) y con un tiempo mínimo por arma. Escudo y armadura. |
| Golpe | `golpe.js` | Alcance, escudo del rival, crítico, golpe corriendo, maza, daño y empuje. |
| MovementController | `movimiento.js` | Acercarse, strafe, W-tap, S-tap, sprint reset, jump reset, persecución, retirada, reposicionamiento, cambios de dirección, altura. Con impulsos y la caminata del juego, sin teletransportes. |
| BucketController | `cubetas.js` | Water clutch / MLG, agua táctica, lava de control. Coloca y recoge; limpieza garantizada. |
| ProjectileController | `proyectiles.js` | Arco, ballesta, tridente, perlas, pociones con predicción del movimiento; TNT y cristal con explosiones que no rompen bloques. |
| ComboEngine | `combos.js` | Catálogo de combos como datos (pasos + condiciones) y un ejecutor paso a paso. Se agregan combos sin tocar el resto. |
| CombatBrain | `cerebro.js` | Máquina de estados, objetivo, decisiones por turno. |
| AnimationController | `animacion.js` | Poses sostenidas y gestos (playAnimation). |
| VFXController | `vfx.js` | Partículas con presupuesto por segundo. |
| PerformanceManager | `rendimiento.js` | Frecuencia de decisión según distancia, presupuestos, limpieza de bloques y proyectiles, registro de errores. |
| Rescate y sello | `rescate.js` | Derribo, Claude rescatista, lugar de recuperación, sellado. |
| Personalidad | `personalidad.js` | Frases cortas, actitud, nombre con fase y determinación. |
| Integración | `index.js` | Registro, bucles, eventos, guardado. |

## 4. Las 20 fases

| Fase | Nombre | Lo nuevo (se acumula) | Arma base | Reacción (ticks) | Error de puntería |
|---|---|---|---|---|---|
| 1 | NOOB | Camina directo, golpea lento, falla a veces, no esquiva | Espada de madera | 30 | 2,0 |
| 2 | APRENDIZ | Mantiene algo de distancia, bloquea con escudo, salta antes de atacar, críticos | Espada de piedra + escudo | 26 | 1,7 |
| 3 | NOVATO | Corre y golpea, combos simples, arco, sabe si está muy cerca o muy lejos | Piedra, arco | 22 | 1,4 |
| 4 | COMBATIENTE | Espada y escudo, retrocede, cambia de objetivo, come para curarse | Hierro | 19 | 1,2 |
| 5 | GUERRERO | Espada, arco y hacha, cadenas, castiga errores, persigue y se reposiciona | Hierro + hacha | 17 | 1,0 |
| 6 | DUELISTA | Intercambios, control de distancia, fintas y ataques retrasados, alterna ataque y defensa | Hierro | 15 | 0,85 |
| 7 | ESPECIALISTA EN ESPADAS | Combos rápidos, strafe, sprint reset, W-tap, S-tap | Diamante | 13 | 0,75 |
| 8 | ESPECIALISTA EN HACHAS | Hacha y escudo, ataques pesados, rompe defensas | Hacha de diamante | 12 | 0,65 |
| 9 | ESPECIALISTA EN MOVILIDAD | Saltos estratégicos, cambios bruscos, altura, perlas, movimientos impredecibles | Diamante | 11 | 0,6 |
| 10 | MAESTRO DE COMBOS | Combos con varias armas, sin repetir; interrumpe sus combos si viene un contraataque | Diamante | 10 | 0,5 |
| 11 | MAESTRO DE CUBETAS | Water clutch, MLG, agua táctica, lava de control | + cubetas | 9 | 0,45 |
| 12 | MAESTRO DE PROYECTILES | Ballesta, tridente, predicción, alterna distancia y cuerpo a cuerpo | + ballesta, tridente | 8 | 0,38 |
| 13 | MAESTRO DE TNT Y CRISTAL | TNT y cristal con tiempo y distancia; nunca rompen bloques | + TNT, cristal | 8 | 0,34 |
| 14 | MAESTRO DE MACE | Maza, altura, ataque vertical; sube con bloques si le conviene | Netherita + maza | 7 | 0,3 |
| 15 | MAESTRO MULTIMODAL | Estilos: espada, hacha, 1.8, 1.9+, UHC, pociones, SMP, maza, arco, tridente, cubetas, cristal | + pociones | 7 | 0,26 |
| 16 | COMPETIDOR PROFESIONAL | Analiza tus patrones, contrarresta combos, cambia el ritmo | Netherita | 6 | 0,22 |
| 17 | ÉLITE | Usa el terreno, sabe cuándo escapar, perseguir o contraatacar | Netherita | 6 | 0,18 |
| 18 | TOP 10 | Varios estilos de combate y cambio de estrategia; predice patrones | Netherita | 5 | 0,14 |
| 19 | TOP 1 | Anticipa; nunca repite una estrategia que ya le contrarrestaste | Netherita | 5 | 0,10 |
| 20 | INFINITE DETERMINATION | Todo junto, combo adaptativo propio (∞), aura, actitud de leyenda | Netherita | 4 | 0,06 |

Vida por tramo (la pone el grupo de componentes de la entidad): 40 (fases 1-5), 52 (6-10), 64 (11-15), 72 (16-19) y 80 (20). Daño: el del arma × (1 + 0,02 por fase), como mucho ×1,4. La fuerza real está en las decisiones.

## 5. Determinación

- **Variables**: `determinacion`, `experiencia` (combatExperience), y los niveles 0-1 `adaptacion`, `reaccion`, `precision`, `movimiento`, `combos`, `armas`, `prediccion` (se calculan de la fase y de lo que aprendió del oponente).
- **Umbral de la fase n**: `12 × (1,4^(n−1) − 1)` → fase 2 con 5, fase 5 con 34, fase 10 con 236, fase 15 con 1 321, fase 20 con 7 160 (tope 21 479).
- **Ganancias**: golpe 1, crítico 2, combo completo 2 (+0,25 por golpe acertado), bloqueo 1,5, esquiva 1, aguantar 10 s contra alguien con mejor equipo 3, patrón nuevo aprendido 4, estrategia nueva que funciona 4, salir de una situación difícil (de menos de 25 % a más de 50 % de vida) 10, levantarse después de un rescate 25, ganar un combate 20 × (1 + fase/10). Todo × `INFINITO_CFG.ritmo` (ajustable) y × 1,5 si pelea con poca vida.
- **Límites**: fase máxima 20, determinación máxima 3 × umbral de la 20, ganancia máxima por combate, vida máxima 80, daño máximo ×1,4.

## 6. Máquina de estados

`IDLE → OBSERVING → APPROACHING → ENGAGING → COMBO → DEFENDING → COUNTERING → RETREATING → RECOVERING → ADAPTING`

| De | A | Condición | Prioridad |
|---|---|---|---|
| IDLE | OBSERVING | Hay un objetivo a 24 bloques | normal |
| OBSERVING | APPROACHING | Terminó de observar (0 ticks en fase 1, hasta 50 en fases altas) o el objetivo se acerca a 4 | normal |
| APPROACHING | ENGAGING | Está en el rango del arma elegida | normal |
| ENGAGING | COMBO | Eligió un combo y se cumplen sus condiciones | normal |
| COMBO | ENGAGING | Terminó el combo | normal |
| COMBO | DEFENDING | (fase 10+) recibe un golpe en medio del combo: lo interrumpe | alta |
| ENGAGING / APPROACHING | DEFENDING | El objetivo está por golpear (cerca, mirándolo y con ritmo de ataque) y tiene escudo o puede esquivar | alta |
| DEFENDING | COUNTERING | Paró o esquivó un golpe | alta |
| COUNTERING | ENGAGING | Terminó el castigo | normal |
| cualquiera | RETREATING | Vida bajo su umbral (fase 4+) o mala posición o hay TNT | muy alta |
| RETREATING | RECOVERING | Lejos del objetivo (8+ bloques) | alta |
| RECOVERING | APPROACHING | Se curó o el objetivo se acerca demasiado | normal |
| cualquiera | ADAPTING | (fase 6+) lo contrarrestaron 3 veces seguidas o aprendió un patrón nuevo | alta |
| ADAPTING | APPROACHING | Pasó el tiempo de reajuste (20 ticks) | normal |

Cada estado dura al menos 8 ticks salvo las emergencias (caída, lava, derribo). Las emergencias no son estados: se atienden antes (water clutch, salir de la lava).

## 7. Combos (`combos.js`)

Cada combo es un objeto `{ id, nombre, fase, peso, rango, armas, si(ctx), pasos }` y cada paso es una acción real (golpe, salto, crítico, sprint reset, W-tap, S-tap, strafe, cambio de arma, disparo, lanzamiento, maza, cubeta, perla, poción, TNT, cristal, pilar, finta, escudo, persecución, retirada). Para agregar uno basta con sumar un objeto a la lista; las acciones también están en un registro (`ACCIONES`).

Incluye los pedidos: espada → sprint reset → espada; espada → salto → crítico; hacha → escudo → espada; arco → persecución → espada; cubeta de agua → reposicionamiento → ataque; persecución → salto → ataque aéreo; tridente → acercamiento → combo; maza → caída → ataque vertical; bloqueo → contraataque → persecución; cambio de arma → ataque sorpresa. Más otros (W-tap en cadena, S-tap, strafe, finta, rompeguardia, ballesta, lava, TNT, cristal, pilar + maza, pociones, estilo 1.8, estilo 1.9+, perla de flanco y el combo ∞ de la fase 20).

## 8. Armas

| Arma | Propósito | Rango | Estrategia | Se elige cuando |
|---|---|---|---|---|
| Espada | Daño constante y combos rápidos | 0-3,2 | Cadenas con W-tap/S-tap | Cuerpo a cuerpo normal |
| Hacha | Golpe pesado, rompe escudos | 0-3 | Castigar la guardia | El objetivo se cubre con escudo o hay una apertura |
| Escudo | Parar golpes y flechas de frente | — | Bloquear y castigar | El objetivo va a golpear o dispara |
| Arco | Presión a distancia, con predicción | 6-30 | Desgastar y forzar acercamiento | Lejos o el objetivo escapa |
| Ballesta | Disparo fuerte y recto | 5-24 | Castigar a quien se queda quieto | Fase 12+, distancia media |
| Tridente | Lanzamiento que abre el combo | 4-20 | Lanzar y entrar | Fase 12+, en el agua o a media distancia |
| Maza | Ataque vertical | 0-4 | Ganar altura y caer encima | Fase 14+, puede saltar o está más alto |
| Cubeta de agua | Salvar caídas, frenar al rival | — | Clutch y control | Cae desde alto, se quema o quiere frenarte |
| Cubeta de lava | Control del terreno | 3-5 | Cortar el paso | Fase 11+, solo si no hay nada inflamable cerca |
| Perla | Reposicionarse | 8-30 | Flanquear o escapar | Fase 9+, lejos o en peligro |
| Poción | Curarse o castigar | 3-8 | Pot PvP | Fase 15+ |
| Comida | Curarse | — | Retirarse y comer | Fase 4+, vida baja |
| TNT | Negar zona | 3-8 | Poner y alejarse | Fase 13+, objetivo quieto o encerrado |
| Cristal | Explosión precisa | 3-6 | Poner y detonar | Fase 13+ |
| Bloques | Altura | — | Pilar para ganar altura o preparar la maza | Fase 9+ (altura) y 14+ (maza) |

Cambiar de arma cuesta tiempo (15 ticks en la fase 1, 3 en la 20) y cada arma se sostiene un mínimo antes de cambiarla, salvo una razón fuerte (cae, va a recibir un golpe, el objetivo se fue lejos).

## 9. Movimiento y diferencias con Java

| Técnica | Cómo se hace en Bedrock |
|---|---|
| Strafe | Pasos laterales con impulsos suaves, cambiando de lado (más seguido en fases altas). |
| W-tap / sprint reset | Bedrock no tiene el "reset" de sprint de Java: frena 2-3 ticks y vuelve a avanzar; el siguiente golpe cuenta como golpe corriendo (más empuje). |
| S-tap | Un pequeño impulso hacia atrás justo después de golpear (evita el cambio de golpes). |
| Jump reset | Al recibir un golpe, salta en ese momento y frena su velocidad horizontal: recibe menos empuje. |
| Críticos | Golpe mientras cae después de un salto: × 1,5 y partículas de crítico. |
| Cooldown 1.9 | Bedrock no tiene recarga de ataque: el estilo "1.9+" espera a propósito entre golpes fuertes; el "1.8" golpea más seguido con W-tap. |
| Crystal PvP | El cristal se pone y se detona con una explosión que no rompe bloques ni prende fuego. |
| Pot PvP | La poción arrojadiza es real; el efecto (curación o daño) lo aplica el script al reventar. |
| Perlas | La perla es real; al caer, el script lo lleva al punto de impacto. |
| Sin teletransportes | Se mueve con la caminata del juego e impulsos; las únicas excepciones son la perla y cuando un Claude lo carga. |

## 10. Personalidad

Encima de la cabeza: nombre, fase y determinación, y una frase corta de vez en cuando (observa, celebra un buen combo, se frustra cuando pierde, se vuelve más serio y callado en fases altas). Al evolucionar: título con el nombre de la fase para los jugadores cercanos.

## 11. Derribo, rescate y sello

1. **Derribo**: el golpe que lo mataría no se aplica (sensor de daño). Queda de rodillas, intocable, con su alma roja flotando, durante **30 s**.
2. **Sello** (durante esos 30 s, a la altura de sus pies): cuatro **pilares de obsidiana** (o llorosa) de **2 bloques**, uno en cada esquina a 2 bloques de él en diagonal, y encima de cada pilar una **antorcha, linterna o fogata de almas**. Las marcas rojas muestran dónde va cada bloque. Al completarlo: se rompe su alma y desaparece para siempre.

```
 vista desde arriba (I = él, O = pilar)      de lado (cada pilar)
  O . . . O                                    llama de almas
  . . . . .                                    obsidiana
  . . I . .                                    obsidiana  ← a la altura de sus pies
  . . . . .
  O . . . O
```

3. **Rescate**: a los 12 s, el Claude más cercano (o uno que llega corriendo si no hay ninguno a 48 bloques) va hacia él (si no encuentra camino, llega con una perla), lo carga en el hombro y lo lleva a su casa o a un lugar tranquilo lejos de los jugadores. Si golpeas al rescatista fuerte (5 o más de un golpe, u 8 en total), lo suelta (y vuelve a correr el tiempo del sello). Si nadie llega en 30 s, se recupera ahí mismo.
4. **Recuperación**: sentado 30 s (también se puede sellar mientras tanto), vuelve a tener toda su vida y gana determinación (+25 × ritmo). Sigue peleando.

## 12. Rendimiento (Android)

- Decide cada 4-30 ticks según la fase; si no hay nadie a 32 bloques, cada 40.
- Partículas del script con tope por segundo; el aura de la fase 20 la dibuja el cliente (no cuesta script).
- Memoria limitada (24 acciones y 60 secuencias por oponente, 6 oponentes a la vez, 12 guardados por nombre) y se olvida con el tiempo.
- Todo bloque o proyectil que pone queda registrado y se quita (agua y lava en 1-2 s, pilares al terminar la pelea, proyectiles a los 5 s).
- Errores capturados y registrados (últimos 20) sin detener el juego.

## 13. Pruebas de aceptación

| Prueba | Cómo |
|---|---|
| Cada fase | Con `/claudenpc:fase N` usa solo lo de su fase y anteriores (sin arco antes de la 3, sin cubetas antes de la 11, sin maza antes de la 14). |
| Evolución | Peleando sube la determinación; al pasar el umbral cambia la fase, el aspecto (6, 11, 16, 20) y sale el título. |
| Combos | Cada combo ejecuta sus pasos (daño real, cambios de arma, agua puesta y quitada). |
| Cubetas | Cayendo desde 20 bloques pone agua antes de tocar el suelo, no recibe daño y la quita. |
| Memoria | Si saltas todo el tiempo o repites el mismo combo, lo detecta y cambia su respuesta. |
| Multijugador | Con dos jugadores elige objetivo y cambia (fase 4+). |
| Rescate | Derribado, un Claude lo carga y se recupera con toda la vida. |
| Sello | Con el sello completo desaparece y no vuelve. |
| Limpieza | No quedan agua, lava, bloques ni proyectiles al terminar. |

Estado: GENERATED + STATICALLY_VALIDATED (tipos oficiales 2.4.0 sin errores; validador y auditoría 1.21.132 con 0 errores y 0 advertencias) + simulación fuera del juego con física (`tests/simulador`, 95 comprobaciones: todas las de esta tabla, más combos con acciones reales, comandos, monstruos, guardado y rendimiento; 60 corridas seguidas sin fallas con la versión final). **No probado en el juego (IN_GAME_TESTED: no; MULTIPLAYER_TESTED: no).**

## 14. Recursos del usuario

Ninguno obligatorio. Usa sonidos de Minecraft. Si quieres sonidos propios (por ejemplo, para evolucionar), se pueden agregar después.
