---
name: bedrock-entity-creator
description: Diseña criaturas, NPC, enemigos, jefes y compañeros de Minecraft Bedrock con IA, navegación, objetivos, modelos, animaciones y VFX.
---

# Bedrock Entity Creator

Crea criaturas y NPC según el rol solicitado: pacíficos, neutrales, hostiles, jefes, compañeros o ayudantes. Implementa sus estados, objetivos y comportamientos de forma coherente con Minecraft.

## Diseño de comportamiento

Define estados explícitos, por ejemplo:
`idle → follow → assist → wait → recover`.

Cada estado debe tener:
- condición de entrada;
- objetivo observable;
- condición de salida;
- timeout/reintento;
- feedback visual o animación;
- límite de frecuencia.

## IA de compañero

Puede incluir:
- seguir al jugador a distancia ajustable;
- esperar/volver con orden;
- recordar un destino o tarea;
- recoger recursos permitidos dentro de un radio limitado;
- ayudar a colocar estructuras predefinidas si el diseño y la API lo permiten;
- iluminar, marcar rutas, regar cultivos o realizar otras tareas pacíficas;
- evitar obstáculos/agua/zonas inaccesibles;
- recuperar estado tras descarga de chunk cuando sea posible.

## Límites
- No sobrecargues `runInterval` ni consultes todo el mundo constantemente.
- Evita spawn duplicado y fugas de entidades.
- No afirmes que el NPC realiza acciones de jugador si la API no puede reproducirlas. Implementa la acción equivalente mediante un sistema propio y explícitalo.
- Los objetivos de daño y las mecánicas de combate ficticias de Minecraft están permitidos cuando el usuario los solicita. Configura objetivos, alcance, cooldowns, daño y condiciones de forma explícita y prueba su comportamiento en el juego.
- No conviertas una criatura hostil solicitada en pacífica ni elimines sus habilidades sin autorización.
- Respeta el nombre exacto del personaje/entidad que pida el usuario; no lo renombres automáticamente. Para fan-made, crea assets propios y no afirmes que es oficial.

## Recursos
Usa 3D Creator, Animation Studio y VFX Studio coordinados. Los nombres de geometría, animación, controller y textura deben coincidir con el registro de assets.

Lee `references/peaceful-ai.md`.
