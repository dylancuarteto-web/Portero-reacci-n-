---
name: bedrock-puppet-threads
description: Implementa hilos visuales y control lógico de mobs tipo marioneta.
---
No confundas una partícula suelta con una cuerda funcional. Separa A) render: varios hilos segmentados entre anclaje y objetivo, con curva/sag, tensión, color, pulsos y presupuesto; B) gameplay: selección, vínculo persistente, órdenes, rango, cooldown, rotura, liberación y limpieza. Máquina de estados: IDLE -> AIMING -> ATTACHED -> COMMANDING -> STRAINED -> BROKEN/RELEASED. El mob recibe órdenes explícitas (seguir punto, detenerse, moverse a punto, atacar objetivo marcado) usando componentes/eventos/APIs documentados. Si no hay acceso a huesos, ancla al centro de entidad + offset. Nunca uses `entity.getBone()` como API real sin documentación. Prueba movimiento, giro, salto, ruptura, muerte, despawn y multiplayer.
