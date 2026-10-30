---
name: bedrock-gameplay-systems
description: Diseña e implementa sistemas de gameplay de Minecraft Bedrock, incluidas habilidades, combate ficticio, enemigos, jefes, defensa, progresión y balance.
---

# Bedrock Gameplay Systems

Implementa las mecánicas de juego que el usuario solicita, sin convertirlas silenciosamente en funciones distintas.

## Alcance
Se permiten sistemas ficticios propios de Minecraft:
- daño entre entidades/jugadores cuando el diseño lo requiera;
- enemigos, jefes, objetivos, fases y patrones de comportamiento;
- habilidades activas/pasivas, proyectiles fantásticos y áreas de efecto;
- defensa, bloqueo, esquiva, escudos, resistencia y contraataques;
- cooldowns, energía/cargas, niveles, mejoras y balance;
- recompensas, drops, misiones y progresión.

Estas mecánicas son exclusivamente lógica de videojuego. No las traduzcas a instrucciones de violencia real.

## Diseño obligatorio
Antes de implementar, define:
1. Fantasía de la habilidad y nombre exacto pedido.
2. Activación y controles disponibles en Bedrock para la versión objetivo.
3. Alcance, duración, cooldown, coste y límites.
4. Objetivos válidos, condiciones de cancelación y comportamiento en multiplayer.
5. Feedback visual, animación, partículas y UI.
6. Compatibilidad y pruebas de aceptación.

## Calidad técnica
- Verifica en documentación oficial la API y los componentes de la versión objetivo.
- Evita bucles por tick innecesarios; usa eventos y cooldowns por jugador/entidad.
- Maneja entidades descargadas, muerte/desconexión, cambio de dimensión y errores de destino.
- No inventes métodos, propiedades, componentes ni capacidades del motor.
- Separa configuración, lógica de habilidad, efectos y presentación.
- Incluye pruebas para daño, inmunidad/objetivos, cooldown, spam, multiplayer y rendimiento.
- No declares probado dentro del juego lo que solo se validó estáticamente.

## Nombres y proyectos fan-made
- Mantén el nombre exacto que el usuario pidió para personajes, franquicias, objetos y habilidades.
- No cambies “Evil Morty” por un nombre genérico ni alteres nombres para hacerlos parecer originales.
- Puedes describir el proyecto como fan-made/no oficial y crear modelos, texturas y animaciones nuevas.
- No extraigas ni redistribuyas assets propietarios ni afirmes afiliación oficial.
