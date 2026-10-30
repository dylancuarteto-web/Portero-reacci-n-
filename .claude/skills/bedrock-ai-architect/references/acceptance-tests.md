# Matriz de aceptación y QA

## Importación
- BP y RP importan sin mensajes de contenido.
- UUID son válidos y no están duplicados.
- Las dependencias se resuelven y los packs aparecen con nombres correctos.

## Recursos visuales
- Entidades/objetos cargan geometría y texturas.
- Las UV no tienen islas inesperadas ni caras sin textura.
- La escala/pivote/anclaje es correcto en primera y tercera persona.
- Animaciones no saltan, no se congelan y tienen transición/loop correcto.
- Partículas tienen inicio, continuidad, final y anclaje correctos.

## Comportamiento
- Cada habilidad responde una sola vez por activación válida.
- Cooldowns bloquean repetición sin congelar otros sistemas.
- Los estados se recuperan si el jugador se va, la entidad desaparece o el chunk se descarga.
- El comportamiento conserva datos si el proyecto declara persistencia.
- Ningún sistema de apoyo afecta entidades no previstas.

## Rendimiento
- Prueba con un solo jugador y con el número máximo previsto de compañeros.
- Mide FPS/caídas visibles en Android objetivo.
- Reduce frecuencia de actualización, densidad de partículas y geometría si hay tirones.
- Evita spam de mensajes/sonidos y spawn por tick.

## Multijugador
- Comprueba qué ocurre cuando el propietario se desconecta.
- Confirma que VFX es visible solo a los jugadores previstos.
- Evita duplicar suscripciones o aplicar efectos múltiples a la misma entidad.

## Registro de estado

Usa una de estas etiquetas por función:
- `GENERADO`: archivos creados.
- `STATIC_OK`: validación estática pasó.
- `IMPORTED`: importado en Bedrock.
- `IN_GAME_OK`: verificado dentro del juego.
- `MULTIPLAYER_OK`: probado en multijugador.
- `LIMITED`: funciona con una aproximación documentada.
- `NOT_TESTED`: no se pudo probar.
