---
name: bedrock-entity-creator
description: Diseña criaturas, NPC y compañeros pacíficos de Minecraft Bedrock con navegación, memoria limitada, órdenes útiles, modelos, animaciones y VFX.
---

# Bedrock Entity Creator

Crea criaturas originales que ayuden a explorar, construir, organizar y decorar. Este módulo se centra en IA pacífica y de apoyo.

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
- No uses objetivos de daño ni mecánicas de combate.

## Recursos
Usa 3D Creator, Animation Studio y VFX Studio coordinados. Los nombres de geometría, animación, controller y textura deben coincidir con el registro de assets.

Lee `references/peaceful-ai.md`.
