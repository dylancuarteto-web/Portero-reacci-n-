# Arquitectura de IA pacífica

## Máquina de estados de ejemplo

| Estado | Objetivo | Salida |
|---|---|---|
| `idle` | Esperar sin gastar recursos | Orden recibida o jugador próximo |
| `follow` | Mantener distancia cómoda | Orden wait/assist o bloqueo de ruta |
| `assist` | Ejecutar una tarea permitida | Tarea completa, cancelación o timeout |
| `wait` | Mantener posición | Nueva orden |
| `recover` | Resolver ruta fallida/estado inválido | Reintento limitado o retorno a idle |

## Memoria mínima

Guarda solo lo que el sistema necesita: `ownerId`, `currentTask`, `destination`, `lastKnownDimension`, `cooldownUntil`, `retryCount`. No guardes referencias de objetos de runtime como si fueran persistentes; serializa identificadores/posiciones y vuelve a resolverlos con validaciones.

## Navegación segura

- Comprueba accesibilidad y altura del destino.
- Usa radio de búsqueda limitado.
- No intentes procesar chunks descargados.
- Define reintentos limitados para rutas bloqueadas.
- Permite cancelar el objetivo y volver al seguimiento.

## Rendimiento

- Agrupa el trabajo de todos los companions en una tarea de baja frecuencia si la API lo permite.
- Reduce frecuencia cuando están lejos del jugador.
- Desactiva partículas ambientales cuando no sean visibles.
- Límite explícito de entidades por jugador/mundo.

## Pruebas

- Cambio de dimensión.
- Dueño se desconecta y vuelve.
- Chunk se descarga y recarga.
- Ruta bloqueada.
- Tarea cancelada.
- Dos compañeros próximos.
- Mundo multijugador.
