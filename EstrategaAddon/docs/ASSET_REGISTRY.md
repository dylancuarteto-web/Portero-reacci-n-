# Registro de identificadores

Namespace: `estr`. Todos los identificadores se definen una vez aquí y en `BP/scripts/config.js`.

| Tipo | Identifier | Archivo |
|---|---|---|
| Objeto (casco) | `estr:parche` | `BP/items/estr_parche.item.json` |
| Objeto (mano) | `estr:transmisor` | `BP/items/estr_transmisor.item.json` |
| Receta | `estr:parche_recipe` | `BP/recipes/estr_parche.recipe.json` |
| Receta | `estr:transmisor_recipe` | `BP/recipes/estr_transmisor.recipe.json` |
| Icono | `estr_parche`, `estr_transmisor` | `RP/textures/item_texture.json` |
| Geometría | `geometry.estr.parche` | `RP/models/entity/estr_parche.geo.json` |
| Textura del modelo | `textures/models/estr_parche` | `RP/textures/models/estr_parche.png` |
| Attachable | `estr:parche` | `RP/attachables/estr_parche.attachable.json` |
| Render controller | `controller.render.estr_parche` | `RP/render_controllers/estr_parche.render_controllers.json` |
| Animación (parche) | `animation.estr.parche.idle` | `RP/animations/estr_parche.animation.json` |
| Animación (jugador) | `animation.estr.player.portal_cast` | `RP/animations/estr_player.animation.json` |
| Animación (jugador) | `animation.estr.player.signal_cast` | ídem |
| Animación (jugador) | `animation.estr.player.escape_cast` | ídem |
| Animación (jugador) | `animation.estr.player.stealth_cast` | ídem |
| Partícula | `estr:portal_ring` | `RP/particles/portal_ring.particle.json` |
| Partícula | `estr:portal_spiral` | `RP/particles/portal_spiral.particle.json` |
| Partícula | `estr:mind_wave` | `RP/particles/mind_wave.particle.json` |
| Partícula | `estr:mind_link` | `RP/particles/mind_link.particle.json` |
| Partícula | `estr:stealth_smoke` | `RP/particles/stealth_smoke.particle.json` |
| Partícula | `estr:patch_glint` | `RP/particles/patch_glint.particle.json` |
| Propiedad dinámica | `estr:ability` (número 0-3) | jugador |

Las partículas `estr:portal_ring` y `estr:portal_spiral` leen `variable.dir_x` y `variable.dir_z` (orientación del portal); el script siempre las envía.
