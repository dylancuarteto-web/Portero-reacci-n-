# Objetos, habilidades y jefe

Todos los números se configuran en `packs/LaCobra_BP/scripts/config.js`. 20 ticks = 1 segundo.

## Sistema de energía

- Va de 0 a **100**. Empiezas con 100.
- Se regenera **+2/s**, **+2/s** más con la armadura completa y **+1/s** más con el Amuleto (hasta 5/s).
- Cada golpe con la Espada da **+1**. Acertar con el Balón Dorado da **+3** («¡GOLAZO!»).
- Se guarda en el mundo de cada jugador, así que no se pierde al salir.
- Todo se calcula en el **servidor** (el script): energía, enfriamientos, objetivos y daño. El cliente solo envía el gesto de usar un objeto.

Antes de lanzar, cada habilidad comprueba: jugador vivo, que no haya otra secuencia en curso, runa desbloqueada, enfriamiento, energía y condiciones propias (por ejemplo, que haya un objetivo). Si algo falla **no se gasta energía** y aparece un mensaje claro.

## Habilidades

### A. Instinto de la Cobra — 15 de energía · 12 s de enfriamiento · 8 s de duración
- Aura giratoria negra y dorada (partícula `aura_spiral`), **pequeñas serpientes de energía** que suben en espiral (`mini_snake`) y destellos violetas.
- **Velocidad II** y **Salto I** durante 8 s.
- Cada golpe cuerpo a cuerpo hace **+3 de daño** con escamas, chispas y destello (`scale_shards`, `gold_spark`, `violet_flash`) y un sonido propio. Como máximo un bono por golpe.
- Sonidos de activación y de final. No se puede reactivar mientras está activo.

### B. Remate Legendario — 25 · 6 s
1. **Carga de 1,2 s**: animación de brazos en alto, partículas que convergen delante de ti y sonido creciente.
2. **Lanzamiento** de la esfera-balón `lacobra:esfera_remate`: proyectil real con colisión, sin gravedad, velocidad 2,2.
3. **Estela** de energía durante el vuelo, generada en el cliente.
4. **Impacto** contra una entidad o un bloque: onda expansiva plana, anillo de energía, explosión de partículas doradas y negras, y sonido de impacto.
5. **Daño de área**: 14 en el centro, que baja con la distancia (radio 3,5), más empuje.
- **No destruye bloques.** Si mueres o sales durante la carga, recuperas la energía.

### C. Veneno Serpentino — 20 · 8 s
- Necesita un objetivo hostil: el que miras o el más cercano delante de ti, hasta 24 bloques.
- Crea una **serpiente de energía 3D animada** que gira hacia el objetivo de forma suave (no instantánea) con una ligera ondulación y deja una estela violeta.
- Al alcanzarlo: **6 de daño + Lentitud III 3 s + Veneno 3 s**, salpicadura venenosa.
- Desaparece con su animación si: alcanza al objetivo, el objetivo muere o se va, pasan 6 s, o recorre más de 38 bloques. Máximo 3 serpientes por jugador.

### D. Dominio Absoluto — 40 · 30 s · 10 s de duración
- **Círculo mágico** bajo tus pies (modelo 3D con dos anillos de runas que giran en sentidos opuestos, estrella-pentágono y ouroboros) que **te sigue**.
- Runas que ascienden, aura en espiral y anillos de energía cada segundo.
- Para ti: **Fuerza II, Resistencia II y Regeneración I** durante 10 s. Duran lo que dura la habilidad y no se acumulan.
- Enemigos a menos de 8 bloques: **Debilidad y Lentitud** (2,5 s, renovadas cada segundo, sin acumularse) y **rayos de energía** sobre un máximo de 3 enemigos por segundo (2 de daño).
- Final: **onda expansiva** de 6 de daño con empuje. El círculo desaparece con una animación.

### ★ La Cobra Suprema — 100 · 90 s
Secuencia de 150 ticks (7,5 s):
1. **Carga** (0 s): sonido grave creciente, animación de transformación del jugador, Resistencia IV y Caída lenta para que no te interrumpan.
2. **Círculo mágico gigante** bajo tus pies.
3. **Serpiente gigante** (0,5 s) enroscada en espiral a tu alrededor, girando.
4. **El aura se intensifica**: partículas que convergen, runas, mini serpientes y luego rayos en círculo y chispas, que aumentan con la carga.
5. **Transformación** (2 s): aparece detrás de ti el **espíritu de La Cobra** (modelo humanoide gigante con skin propia), que sube desde el suelo, alza los brazos y **remata con una patada**. Ganas Fuerza III y Velocidad II durante 20 s.
6. **Liberación** (5,5 s): tres ondas expansivas encadenadas, anillo de explosiones, columna dorada y una vibración de cámara suave. **Daño real**: 28 en el centro y 14 en el borde, en un radio de **12** configurable, con empuje fuerte. Afecta a un máximo de 24 objetivos.
7. **Disipación**: la serpiente y el espíritu se desvanecen con su animación, el círculo se pliega y queda un polvo de energía.
8. **Mensaje final**: título «LA COBRA SUPREMA» con el subtítulo «El rey de la serpiente ha hablado».

No hay destellos blancos a pantalla completa. Si te desconectas o mueres antes de la liberación, se limpian todos los efectos y recuperas la energía.

**¿A quién afectan las habilidades de área?** A monstruos (familia `monster`), al jefe y a sus esbirros. A otros jugadores solo si el PvP del mundo está activado y no están en creativo o espectador. Nunca a aldeanos, animales ni mascotas.

## Objetos

| Objeto | Tipo | Detalles |
|---|---|---|
| **Espada de La Cobra** | Arma | 10 de daño, 2200 de durabilidad, encantable (15), se repara con Escamas. Al golpear: escamas y chispas, +1 de energía y un 20 % de probabilidad de **Mordida de Cobra** (Veneno 3 s). Usar = habilidad asignada |
| **Balón Dorado** | Arrojadizo (16) | Proyectil propio con modelo de balón y estela dorada. 5 de daño a enemigos, empuje, onda dorada y +3 de energía. **Se recupera** donde cae (en creativo no se duplica) |
| **Guantes del GOAT** | Mano secundaria | Pasiva: **−40 % de daño de proyectiles** y Prisa I. Activa (usar): **Atajada del GOAT**, por 15 de energía y 20 s de enfriamiento. Elimina los proyectiles enemigos a menos de 6 bloques, empuja a los enemigos cercanos y da Resistencia III. Durante 3 s eres inmune a proyectiles |
| **Amuleto Cobra** | Raro (necesita Colmillos del jefe) | En la barra rápida o la mano secundaria: Visión nocturna, +1 de energía por segundo y un aura violeta visible |
| **Núcleo de Energía** | Material especial | Brillo encantado. Hace falta para runas, armadura, espada, guantes, tótem e ídolo |
| **Tótem de La Cobra** | Consumible (4) | Usar o golpe mortal (si lo llevas en una mano): Resistencia III, Regeneración II, Absorción III y Resistencia al fuego durante 15 s, más una **serpiente guardiana dorada** que gira a tu alrededor y lanza rayos (4 de daño cada 1,5 s) a enemigos a menos de 6 bloques. Enfriamiento de 60 s |
| **Armadura de La Cobra** | 4 piezas | Protección 4/9/7/4 (más que la netherita). Casco: Respiración acuática. Botas: Salto I. **Conjunto completo**: Velocidad I, Fuerza I, +2 de energía por segundo y aura periódica |
| **Libro Táctico** | Menú | Menú táctil de habilidades (ver CONTROLES.md) |
| **Runas ×5** | Desbloqueo y lanzamiento | Cada una lanza su habilidad y la desbloquea para el Libro y la Espada |
| **Escama de Cobra** | Material común | Material base y reparación |
| **Colmillo Legendario** | Botín del jefe | Amuleto y Runa Suprema |
| **Esencia Suprema** | Botín del jefe | Runa de La Cobra Suprema |
| **Ídolo de la Serpiente** | Invocación | Ritual de 3 s que invoca al jefe |

## Jefe: LA SERPIENTE LEGENDARIA

- **500 de vida**, barra de jefe, inmune al fuego, a caídas y a asfixia, resistencia al empuje de 0,85. No desaparece sola.
- Modelo 3D propio de unos 3,7 bloques: cobra erguida con **capucha** (con un «anteojo» dorado en la parte de atrás), **corona dorada**, mandíbula articulada, colmillos, lengua bífida y una cola de 6 segmentos.
- **Texturas por fase**: la 1 es negra y dorada. La 2 añade vetas violetas **emisivas**. La 3 añade grietas doradas brillantes y ojos dorados. Los ojos y las gemas brillan en la oscuridad.
- **Animaciones**: reposo (cuello, capucha que respira, lengua), movimiento (la cola ondula), **mordida**, ataque especial, **rugido** al cambiar de fase, **daño recibido** y **muerte** (se desploma y se hunde).
- **Sonidos propios**: siseo de ambiente, rugido, daño recibido, mordida y muerte.
- **Aura** de partículas violetas permanente, que se intensifica en la fase 3.

| Fase | Vida | Comportamiento |
|---|---|---|
| 1 | 100-66 % | Persigue y muerde (10 de daño). Cada 8 s alterna **escupitajo venenoso** y **embestida** (salta hacia ti y crea una onda al caer) |
| 2 | 66-33 % | Más rápida, mordida de 13. Cada 6 s: **invoca Crías de Serpiente** (máximo 4, con mordida venenosa), **triple escupitajo** y **onda expansiva** |
| 3 | < 33 % | Crece un 15 %, mordida de 16 y más rápida aún. Cada 5 s: onda, **lluvia de veneno** (marca con runas el suelo bajo hasta 3 jugadores y 1 s después cae un rayo de 8 de daño), escupitajo de 5 proyectiles e invocación de crías |

- **Al cambiar de fase**: rugido, onda, humo y un título en pantalla para todos los jugadores cercanos.
- **Al morir**: gran explosión de energía, título de **¡VICTORIA!**, sus crías desaparecen y suelta su botín (ver RECETAS.md) y 600 de experiencia.
- **Invocación y reaparición**: fabrica un **Ídolo de la Serpiente** (4 Núcleos + 4 bloques de oro + Ojo de ender) y úsalo. No funciona en Pacífico ni si ya hay un jefe a menos de 96 bloques. Para volver a luchar, fabrica otro Ídolo.

## Partículas propias (24)

`gold_spark`, `dark_smoke` (animado de 8 fotogramas), `violet_flash`, `energy_ring`, `shockwave`, `aura_spiral`, `mini_snake`, `orb_trail`, `ball_trail`, `serpent_trail`, `guard_trail`, `venom_trail`, `impact_burst`, `rune_rise` (8 runas), `energy_beam`, `charge_in`, `venom_splash`, `amulet_aura`, `guard_shield`, `supreme_pillar`, `fade_dust`, `scale_shards`, `boss_aura`, `avatar_glow`. Todas usan un atlas propio de 128×128 en escala de grises, teñido por degradados negro/dorado/blanco/violeta, con recuentos bajos (entre 1 y 36 partículas por ráfaga).
