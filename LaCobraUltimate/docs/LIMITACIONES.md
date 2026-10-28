# Limitaciones conocidas y alternativas usadas

## Diferencias con lo pedido, por límites de Bedrock

| Pedido | Limitación de Bedrock | Solución aplicada |
|---|---|---|
| Guantes y amuleto como «accesorio» | Bedrock no tiene huecos de accesorio | Los Guantes funcionan en la **mano secundaria** (pasiva) o en la principal (activa). El Amuleto funciona en la **barra rápida** o en la mano secundaria |
| Menú de habilidades | La interfaz JSON-UI personalizada es frágil entre versiones | Menú con `@minecraft/server-ui` `ActionFormData`, que es estable, táctil y funciona en Android |
| HUD de energía | No se pueden crear barras de interfaz nuevas sin JSON-UI | Barra en la **barra de acción** (texto con colores) que solo aparece cuando es útil |
| Modelo 3D de la espada en la mano | Un attachable con geometría propia necesita ajustar las posiciones de mano probando en el juego | La espada usa el **icono extruido** estándar (como cualquier espada), con brillo de encantamiento. Pendiente: modelo 3D en mano |
| Animación del tótem «tipo vanilla» | La animación del tótem vanilla no se puede invocar con otro objeto | Título, animación propia del jugador, columna de partículas y serpiente guardiana |
| Transformación del jugador | La skin del jugador no se puede cambiar por script | Aparece el **espíritu de La Cobra** (entidad gigante con skin propia) detrás del jugador, más animación del propio jugador y efectos |
| Proyectil del Remate «animado» | Funciona con limitaciones | La esfera gira y deja una estela. La rotación es independiente de la dirección de vuelo |

## Riesgos que solo se pueden confirmar dentro del juego

No tuve acceso a una instalación de Minecraft (ver [REGISTRO_PRUEBAS.md](REGISTRO_PRUEBAS.md)). Estos puntos se escribieron siguiendo los tipos oficiales y los esquemas 1.26, pero su aspecto visual exacto no se ha podido ver:

1. **Brillo emisivo** (`entity_emissive_alpha`): ojos, vetas del jefe, serpientes de energía, esfera del Remate y serpiente suprema. Se usa alfa ≥ 72 para que brillen sin volverse invisibles. Si algún píxel se viera transparente, sube el alfa en `tools/assets/gen_models.py` (`GLOW_A`).
2. **Ángulos de las animaciones**: el signo de las rotaciones (mordida, rugido, brazos del jugador) sigue las convenciones de Bedrock, pero conviene revisarlo en el juego.
3. **Animaciones del jugador** (`playAnimation` sobre el jugador): se suman a la animación vanilla. Con algunas skins o dentro de vehículos pueden verse distintas.
4. **Tamaño del espíritu de La Cobra** (escala 2,4) y de la serpiente suprema: elegidos sobre el papel.
5. **Los proyectiles pueden atravesar entidades de efecto**: no tienen colisión física, a propósito.
6. **Visión nocturna del amuleto**: se renueva cada segundo con 15 s de duración para evitar el parpadeo de aviso. Si se quita el amuleto, la visión dura hasta 15 s más.

## Rendimiento (Android)

- Un único `runInterval` de 1 tick procesa todas las habilidades activas y **no hace nada si no hay ninguna**. Otro bucle cada 10 ticks gestiona el HUD, la regeneración, las pasivas y el jefe.
- Búsquedas de entidades solo con radio y límite (máximo 14 objetivos, 24 para la Suprema).
- Límites: 160 tareas a la vez, 3 serpientes de Veneno por jugador y 4 crías por jefe.
- Las entidades de efecto tienen un **temporizador de autodestrucción** en su JSON (entre 15 y 25 s), así que nunca se quedan en el mundo aunque el script fallara. Además se limpian al cargar el mundo, al morir y al salir el jugador.
- Las estelas de proyectiles se generan **en el cliente** (emisores unidos a la entidad), sin coste para el servidor.

## Otros

- El daño de habilidades a jugadores respeta la regla de mundo **PvP**.
- Ninguna habilidad rompe ni coloca bloques.
- El jefe no aparece en dificultad Pacífica.
- Los textos de los objetos están en español en todos los idiomas (`es_ES`, `es_MX` y también `en_US`).
