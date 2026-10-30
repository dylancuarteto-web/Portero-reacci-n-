# Registro de identificadores

Namespace: `evilmorty`. Los IDs usados por scripts están también en `BP/scripts/config.js`.

| Tipo | Identifier | Archivo |
|---|---|---|
| Objeto (casco) | `evilmorty:parche` | `BP/items/parche.item.json` |
| Objeto | `evilmorty:mano_laser` | `BP/items/mano_laser.item.json` |
| Recetas | `evilmorty:parche_receta`, `evilmorty:mano_laser_receta` | `BP/recipes/` |
| Comando | `/evilmorty:parche` (abre el menú) | `BP/scripts/core/comandos.js` |
| Entidad | `evilmorty:escudo_domo` | `BP/entities/escudo_domo.entity.json`, `RP/entity/escudo_domo.entity.json` |
| Entidad | `evilmorty:rayo_laser` (propiedades `evilmorty:longitud`, `evilmorty:nivel`, `evilmorty:yaw`, `evilmorty:pitch`) | `BP/entities/rayo_laser.entity.json`, `RP/entity/rayo_laser.entity.json` |
| Geometrías | `geometry.evilmorty.parche`, `.mano_laser`, `.escudo_domo`, `.rayo_laser` | `RP/models/entity/` |
| Attachables | `evilmorty:parche`, `evilmorty:mano_laser` | `RP/attachables/` |
| Render controllers | `controller.render.evilmorty_parche`, `controller.render.evilmorty_rayo` | `RP/render_controllers/evilmorty.render_controllers.json` |
| Animaciones | `animation.evilmorty.parche.idle`, `animation.evilmorty.mano_laser.idle`, `animation.evilmorty.escudo_domo.idle`, `animation.evilmorty.rayo_laser.idle` | `RP/animations/` |
| Animaciones del jugador | `animation.evilmorty.player.laser_disparo`, `.escudo_activar`, `.mejora` | `RP/animations/player.animation.json` |
| Partículas | `evilmorty:prediccion_punto`, `prediccion_fin`, `escudo_activar`, `escudo_impacto`, `proyectil_destruido`, `proyectil_reflejado`, `laser_destello`, `laser_impacto`, `mejora`, `parche_destello` | `RP/particles/` |
| HUD | elemento `hud.evilmorty_ojo`, título marcador `evilmorty:ojo_on` / `evilmorty:ojo_off` | `RP/ui/hud_screen.json` |
| Propiedades dinámicas | jugador: `evilmorty:vision`, `evilmorty:ojo`, `evilmorty:nocturna`, `evilmorty:modo_escudo`; objeto: `evilmorty:nivel`; cúpula: `evilmorty:dueno` | scripts |
