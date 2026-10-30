# UI: Parche de Evil Morty

## Plataforma

Móvil primero (Android, pantallas de 5-7"), también funciona en PC y consola. Bedrock 26.60.

## Identidad visual

- Paleta: ámbar `#FFAA1E`, ámbar brillante `#FFD65A`, ámbar profundo `#C85A0A`, sobre fondos oscuros.
- Estilo: holograma de líneas finas con brillo, esquinas de marco, retícula y líneas de escaneo.
- Iconos 32×32 propios en `RP/textures/ui/evilmorty/`.

## Capas

1. **Interfaz del ojo (HUD)**: `ojo_hud.png` a pantalla completa con el centro transparente para no tapar el juego: esquinas, barra superior con marcas, barras de datos laterales y retícula central.
2. **Barra de acción**: ficha del objetivo que miras (nombre, vida, armas, intención) o "Objetivos en seguimiento: N". Los mensajes de habilidades la reservan 2 s.
3. **Menú del Control del Parche** (ActionForm de `@minecraft/server-ui`).

## Mapa de navegación

```
Control del Parche (usar)
└── PARCHE // EVIL MORTY  (estado: parche, escudo + modo, visión, nivel láser)
    ├── Activar/Desactivar escudo        [escudo]
    ├── Cambiar modo del escudo          [modo]    Reflejar ⇄ Destruir
    ├── Activar/Desactivar visión        [vision]
    ├── Archivos                         [archivos]
    │   ├── carpeta por objetivo (máx. 9) [carpeta] → Ficha (tipo, vida, armas, distancia, predicción) → Volver
    │   └── Volver                       [volver]
    ├── Mostrar/Ocultar interfaz del ojo [ojo]
    └── Cerrar                           [cerrar]
```

## Controles

| Acción | Control | Estado / feedback | Repetición |
|---|---|---|---|
| Abrir menú | Usar el Control del Parche | Menú con estado actual | — |
| Escudo on/off rápido | Agachado + usar el Control | Cúpula, partículas, animación, mensaje | Alterna en cada pulsación |
| Disparar láser | Usar la Mano de Rayo Láser | Rayo 3D, destello, impacto, animación | Recarga 0,6 s; las pulsaciones durante la recarga se ignoran |
| Mejorar láser | Agachado + usar la Mano | Partículas, animación, mensaje con nuevo daño y alcance; error si falta diamante o nivel máximo | Una mejora por pulsación |

Los botones táctiles fijos en pantalla no son viables con la API estable; el menú y "agachado + usar" son la alternativa.

## Pruebas de UI

- Legibilidad del texto del menú y de la barra de acción en un móvil de 6".
- La capa del ojo no tapa la barra rápida ni el chat.
- En multijugador, cada jugador ve solo sus marcas de predicción y su propia capa.
