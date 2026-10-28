# Registro de pruebas

> **Importante:** en este entorno **no había instalación de Minecraft**. Ninguna prueba se ha ejecutado dentro del juego. Abajo se separa lo verificado automáticamente de lo que queda por comprobar en el juego.

## 1. Verificado automáticamente (ejecutado y en verde)

| # | Prueba | Herramienta | Resultado |
|---|---|---|---|
| 1 | Sintaxis de los 104 JSON | `tools/validate.mjs` | OK |
| 2 | Texturas referenciadas (objetos, entidades, partículas, armadura) existen | `validate.mjs` | OK |
| 3 | Geometrías, animaciones, controladores y render controllers referenciados existen | `validate.mjs` | OK |
| 4 | **Cada hueso animado existe en la geometría** de la entidad que usa la animación (y los del jugador son estándar) | `validate.mjs` | OK |
| 5 | Identificadores coinciden: entidad BP ↔ entidad de cliente, objeto ↔ icono ↔ traducción, `projectile_entity`, tablas de botín, eventos y grupos de componentes, propiedades con `client_sync` | `validate.mjs` | OK |
| 6 | Manifiestos: UUID v4 válidos y únicos, dependencias BP↔RP, entrada del script y versiones de módulos iguales a los tipos usados | `validate.mjs` | OK |
| 7 | Imports del Script API: rutas relativas existen y solo se usan módulos declarados en el manifest | `validate.mjs` | OK |
| 8 | Recetas: claves del patrón, tamaño 3×3, objetos existentes, identificadores únicos | `validate.mjs` | OK |
| 9 | Partículas, sonidos, animaciones e IDs usados en los scripts existen en los packs | `validate.mjs` | OK (594 comprobaciones) |
| 10 | **Esquemas JSON de Bedrock 1.26** (Blockception) para objetos, entidades, recetas, botín, entidades de cliente, attachables, partículas, animaciones, controladores, render controllers, modelos, sonidos y manifiestos | `tools/schema-check.mjs` | 102/102 OK |
| 11 | **Tipos del Script API**: todos los scripts comprobados contra `@minecraft/server` 2.10.0 y `server-ui` 2.2.0 oficiales | `npm run typecheck` (tsc, checkJs) | OK |
| 12 | Lógica de cada habilidad, objeto y jefe en un **simulador del Script API** | `npm test` | **117/117 OK** |
| 13 | Generación del `.mcaddon`, estructura interna (2 carpetas con manifest) e integridad CRC | `tools/build.mjs` + `zipfile.testzip()` | OK (194 archivos) |
| 14 | El validador detecta errores reales (prueba negativa: textura borrada y partícula inexistente) | manual | Detectó los 2 errores |
| 15 | Revisión visual de modelos con textura (render ortográfico propio) | `tools/assets/preview_geo.py` | Ver `docs/img/` |

### Qué cubren las 117 pruebas del simulador

El simulador (`tools/test/mock-server.mjs`) imita la parte de `@minecraft/server` que usa el addon. **Además, falla si un script usa una partícula, sonido, animación, entidad o evento que no exista en los packs reales.** Cubre:

- Registro de los 7 componentes personalizados y los 6 comandos.
- **Instinto**: consume 15, no se reactiva estando activo, genera aura, +3 de daño una vez por golpe, termina a los 8 s y limpia su tarea.
- **Remate**: carga de 1,2 s, proyectil real con propietario y velocidad, bloquea otras habilidades durante la carga, daño de área solo a hostiles (no aldeanos ni jugadores sin PvP, sí con PvP), empuje, onda con radio y **devolución de la energía si mueres cargando**.
- **Veneno**: sin objetivo no gasta nada, persecución (alcanza en ~12 ticks a 9 bloques), 6 de daño + Lentitud + Veneno, desaparece al terminar y si el objetivo desaparece.
- **Dominio**: círculo que sigue al jugador, mejoras, debilitamiento solo de hostiles (no de vacas), no se acumula, onda final y limpieza.
- **Suprema**: exige 100, cada fase de la secuencia (serpiente, espíritu, animación), daño dentro del radio y no fuera, vibración, mensaje final, **cero entidades de efecto al terminar** y limpieza total si el jugador sale a mitad.
- Regeneración (~2/s), guardado de energía al salir.
- Progresión: el Libro abre 6 botones, bloquea habilidades sin runa, las lanza con runa. La espada lanza la habilidad elegida.
- Tótem: consumo, efectos, guardiana que ataca, no se reactiva, enfriamiento de 60 s, **salvación automática de un golpe mortal**.
- Guantes: −40 % de daño de proyectiles, la Atajada elimina flechas e inmuniza 3 s, enfriamiento.
- Balón: 5 de daño, +3 de energía, se recupera y no se duplica en creativo. Escupitajo: daño y Lentitud, reducido por los guantes.
- Jefe: no aparece en Pacífico, el ídolo se consume, ritual, no permite un segundo jefe, fase 2 al 66 % y fase 3 al 33 % con rugido, máximo de 4 crías, ataques especiales que dañan, mordida animada, las crías desaparecen al morir y título de victoria.
- Comandos `/lacobra:energia`, `/lacobra:kit` y `/lacobra:estado`.
- Una tarea con error se cierra (no repite el error cada tick). Al final no quedan tareas ni entidades de efecto.

El resultado completo de la última ejecución está en [REGISTRO_PRUEBAS_AUTOMATICAS.txt](REGISTRO_PRUEBAS_AUTOMATICAS.txt).

## 2. NO verificado (requiere probar en Minecraft)

El simulador no ejecuta el motor real: **no confirma** físicas, renderizado, animaciones, partículas visibles, sonidos audibles, IA del jefe ni la importación real. Lista de comprobación para hacer en el juego:

- [ ] El `.mcaddon` se importa sin errores en Android (26.50 / 26.60).
- [ ] Content Log sin errores al crear un mundo con el addon.
- [ ] Los 20 objetos aparecen en el inventario creativo con icono y nombre.
- [ ] Las recetas aparecen en el libro de recetas y fabrican el objeto correcto.
- [ ] La armadura se ve puesta sobre el jugador (capas 1 y 2).
- [ ] Cada runa lanza su habilidad y se ven sus partículas y se oyen sus sonidos.
- [ ] Remate: la esfera vuela recta, choca con bloques y mobs y explota.
- [ ] Veneno: la serpiente se mueve con suavidad y mira hacia delante.
- [ ] Dominio: el círculo gira a ras de suelo y sigue al jugador.
- [ ] Suprema: la serpiente enroscada, el espíritu de La Cobra (tamaño y orientación) y las ondas.
- [ ] Las partes emisivas brillan y ninguna se ve transparente.
- [ ] Jefe: anda, persigue, muerde, cambia de textura en cada fase, barra de jefe, animación de muerte y botín.
- [ ] Libro Táctico: el formulario se abre y se puede tocar en Android.
- [ ] Multijugador: dos jugadores con energía y enfriamientos independientes.
- [ ] Rendimiento en un teléfono de gama media durante la Suprema y la fase 3 del jefe.
