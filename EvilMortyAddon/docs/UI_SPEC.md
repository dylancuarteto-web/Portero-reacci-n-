# UI: Parche de Evil Morty

## Plataforma

Móvil primero (Android, pantallas anchas tipo 20:9), también PC y consola. Bedrock 26.60.

## Identidad visual

- Paleta: ámbar `#FFAA1E`, ámbar brillante `#FFD65A`, ámbar profundo `#C85A0A`, sobre fondos oscuros; rojo `#FF462E` para el láser.
- Estilo: holograma de líneas finas con halo, esquinas de marco, retícula y líneas de escaneo.
- Iconos del menú: insignias 32×32 propias (fondo oscuro redondeado, borde ámbar, glifo con halo) en `RP/textures/ui/evilmorty/`.

## Capas

1. **Interfaz del ojo (HUD)** — `RP/ui/hud_screen.json`, generada por `source/build_assets.py`. Piezas independientes ancladas a la pantalla, para que funcione en cualquier proporción sin deformarse:
   - viñeta ámbar muy suave a pantalla completa (sin conservar proporción, no deja franjas);
   - líneas de escaneo en mosaico;
   - cuatro esquinas de 30×30 en las esquinas de la pantalla;
   - retícula fina de 30×30 en el centro;
   - etiqueta "EVIL MORTY // PARCHE" arriba a la izquierda y barras de señal arriba a la derecha.
   Nada se coloca a media altura de los laterales, donde están la cruceta y los botones de salto/agacharse en móvil.
2. **Barra de acción**: ficha del objetivo que miras o alerta de amenaza que se acerca. Sin objetivos no se muestra nada. Los mensajes de habilidades la reservan 2 s.
3. **Menú integrado** (`@minecraft/server-ui`): compacto, cabe sin desplazarse.

## Mapa de navegación

```
Parche puesto + agacharse mirando arriba   (o /evilmorty:parche)
└── EVIL MORTY // PARCHE   (línea de estado + nivel de la mano láser si la sostienes)
    ├── [escudo]   ESCUDO PROTECTOR · ACTIVO/APAGADO · modo     → activa/desactiva
    ├── [archivos] ARCHIVOS · N objetivos cerca
    │   ├── carpeta por objetivo (máx. 9; icono de jugador, amenaza o carpeta)
    │   │   └── Ficha: tipo, vida, armas, distancia, predicción → Volver
    │   └── Volver
    └── [ajustes]  AJUSTES · escudo, visión e interfaz
        └── Formulario: Modo del escudo (desplegable), Visión predictiva, Visión nocturna,
            Interfaz del ojo (interruptores) → Guardar
```

## Controles

| Acción | Control | Estado / feedback | Repetición |
|---|---|---|---|
| Abrir menú | Con el parche: agacharse mirando arriba (o `/evilmorty:parche`) | Menú con estado y sonido de clic | Se abre 0,4 s después, para distinguirlo de la doble pulsación |
| Escudo on/off rápido | Con el parche: agacharse dos veces seguidas mirando arriba | Burbuja, partículas, animación, sonido, mensaje | Alterna en cada doble pulsación |
| Aviso al equipar | Ponerse el parche | Destello ámbar, anillos, "PARCHE EN LÍNEA" | Una vez por equipamiento |
| Disparar láser | Usar la Mano de Rayo Láser | Rayo 3D, estela, destello, impacto, animación, sonido | Recarga 0,6 s |
| Mejorar láser | Agachado + usar la Mano | Partículas, animación, sonido, mensaje con daño y alcance; error si falta diamante o nivel máximo | Una mejora por pulsación |
| Guardar ajustes | Botón Guardar del formulario | Sonido y mensaje "Ajustes guardados" | — |

## Pruebas de UI

- La interfaz del ojo no deja franjas en pantallas 16:9, 20:9 y 4:3.
- No tapa la barra rápida, la cruceta ni los botones táctiles.
- El menú principal cabe sin desplazarse en un móvil de 6".
- En multijugador, cada jugador ve solo sus marcas de predicción y su propia interfaz.
