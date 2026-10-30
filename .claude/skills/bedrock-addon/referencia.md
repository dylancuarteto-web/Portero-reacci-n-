# Referencia técnica para el addon

Fuentes oficiales (consultarlas antes de asumir algo):
- Ejemplos y archivos vanilla de Mojang: https://github.com/Mojang/bedrock-samples
  (`resource_pack/entity/`, `resource_pack/models/entity/`, `behavior_pack/entities/`).
- Documentación de creadores: https://learn.microsoft.com/minecraft/creator/
- Tipos de la Script API: `herramientas/node_modules/@minecraft/server/index.d.ts` (versión del manifest).

## Texturas con UV de caja (box UV)

Para un cubo de tamaño `[w, h, d]` con `"uv": [u, v]`, la textura se recorta así (en píxeles de la
textura, con origen arriba a la izquierda):

```
            u      u+d     u+d+w   u+2d+w   u+2d+2w
  v         .      [arriba][abajo ]
            .      ( w×d ) ( w×d  )
  v+d       [lado  ][frente][lado   ][espalda]
            [der.  ]       [izq.   ]
            ( d×h ) ( w×h ) ( d×h  ) ( w×h   )
```

- "Derecho" es el lado derecho **de la entidad** (el que el espectador ve a su izquierda si la mira de frente).
- Con `"mirror": true` (brazo y pierna izquierdos de `geometry.zombie`) se reutiliza la misma zona
  volteada: brazo y pierna izquierdos llevan el mismo dibujo que los derechos, en espejo.

Distribución de `geometry.zombie` (64×32), igual que una skin antigua de Steve:

| Parte | uv | tamaño (w, h, d) |
|---|---|---|
| Cabeza | (0, 0) | 8, 8, 8 |
| Capa del sombrero (no se dibuja en el zombie) | (32, 0) | 8, 8, 8 |
| Cuerpo | (16, 16) | 8, 12, 4 |
| Brazos (der.; el izq. es espejo) | (40, 16) | 4, 12, 4 |
| Piernas (der.; la izq. es espejo) | (0, 16) | 4, 12, 4 |

## Client entity (resource pack)

```json
{
  "format_version": "1.10.0",
  "minecraft:client_entity": {
    "description": {
      "identifier": "za:zombie_x",                 // igual que en el BP
      "materials": { "default": "zombie" },
      "textures": { "default": "textures/entity/zombie_apocalypse/zombie_x" },  // sin .png
      "geometry": { "default": "geometry.zombie" },
      "animations": { "nombre_corto": "animation.xxx" },   // el controlador usa los nombres cortos
      "scripts": { "animate": ["nombre_corto"] },
      "render_controllers": ["controller.render.za_zombie"],
      "spawn_egg": { "base_color": "#RRGGBB", "overlay_color": "#RRGGBB" }
    }
  }
}
```

## Animaciones según lo que hace el zombie

Patrón ya usado: el script pone una propiedad entera y el controlador del RP cambia de estado.
1. BP, `description.properties`: `"za:accion": { "type": "int", "range": [0, 4], "default": 0, "client_sync": true }`.
2. Script: `entidad.setProperty("za:accion", 1)` (y volver a 0 al terminar).
3. RP: `controller.animation.za.acciones` con transiciones `q.property('za:accion') == 1`.
4. Client entity: declarar en `animations` el controlador **y** cada animación que use (`za_minar`, …)
   y añadir el controlador a `scripts.animate`.

## Manifests

- `header.version` y `modules[].version`: `[mayor, menor, parche]`. Subirlos al reimportar
  (`empaquetar.py --subir-version` lo hace en los dos packs y en la dependencia BP → RP).
- `dependencies` del BP: los módulos de script (`module_name` + versión en texto, `"2.0.0"`) y el RP
  (`uuid` + versión en lista). Si la versión del RP no coincide, el juego no lo enlaza.
- `min_engine_version`: `[1, 21, 90]`. No bajarlo: los formatos usados lo necesitan.

## Textos (.lang)

```
entity.za:zombie_x.name=Zombie X
item.spawn_egg.entity.za:zombie_x.name=Generar Zombie X
item.za:guia_supervivencia=Guía de Supervivencia
```
Una clave por línea, sin comillas. `##` inicia un comentario. Mantener `en_US.lang` y `es_MX.lang`
con las mismas claves.

## Errores típicos en el Content Log y su causa

| Mensaje (aprox.) | Causa habitual |
|---|---|
| `unknown child schema option` / `unexpected` en una entidad | componente mal escrito o con un formato que no corresponde a su `format_version` |
| `Texture not found` / mob morado y negro | ruta de `textures` mal escrita o PNG que falta |
| `geometry ... not found` / mob invisible | nombre de geometría mal escrito |
| `[Scripting] ... is not a function` | método que no existe en la versión 2.0.0 (revisar con `npx tsc`) |
| `Native function ... cannot be used in early execution` | llamada nativa fuera de `system.run()` |
| `animation ... not found` | nombre corto en `scripts.animate` o en el controlador que no está en `animations` |
