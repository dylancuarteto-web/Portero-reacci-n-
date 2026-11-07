# Registro de identificadores — Claude Exponencial Infinito (v10.0)

Todo bajo el namespace `claudenpc`. Se definen aquí una sola vez y se reutilizan en BP, RP y scripts (`BP/scripts/infinito/config.js`).

## Entidad
| Uso | Identificador |
|---|---|
| Entidad | `claudenpc:exponencial_infinito` |
| Familias | `claudenpc`, `claudenpc_infinito`, `mob` |
| Nombre (idioma) | `entity.claudenpc:exponencial_infinito.name` = Claude Exponencial Infinito |
| Huevo | `item.spawn_egg.entity.claudenpc:exponencial_infinito.name` = Generar a Claude Exponencial Infinito |

## Eventos de la entidad
| Evento | Qué hace |
|---|---|
| `claudenpc:nivel_0` … `claudenpc:nivel_4` | Aspecto y vida máxima por tramo de fases (1-5, 6-10, 11-15, 16-19, 20): `minecraft:variant` 0-4 |
| `claudenpc:aura_0` / `claudenpc:aura_1` | Aura de la fase 20 apagada / encendida: `minecraft:mark_variant` 0/1 |
| `claudenpc:bloqueo` | Lo lanza su sensor al parar un golpe o una flecha con el escudo |
| `claudenpc:golpe_fatal` | Lo lanza su sensor ante el golpe que lo mataría (no se aplica: queda derribado) |

## Etiquetas (las pone el script; las leen los sensores de daño)
`claudenpc_intocable`, `claudenpc_sin_caida`, `claudenpc_escudo`, `claudenpc_escudo_flechas`, `claudenpc_antiexplosion`; en sus proyectiles y explosivos: `claudenpc_inf_obj`; al sellarlo: `claudenpc_sellado` (no se vuelve a registrar).

## Propiedades dinámicas
| Dónde | Clave | Contenido |
|---|---|---|
| Entidad | `claudenpc:infinito` | Determinación, experiencia, estadísticas, etapa (pelea, derribado, cargado, recuperando) y resumen de la memoria |
| Mundo | `claudenpc:infinitos_sellados` | Cuántos se sellaron |
| Mundo | `claudenpc:inf_temporales` | Bloques temporales que puso (agua, lava, obsidiana, pilares) para quitarlos si se cerró el mundo |

## Recursos (RP)
| Tipo | Identificador / ruta |
|---|---|
| Geometría base | `geometry.claudenpc.claude` (la de los Claudes) |
| Geometría extra | `geometry.claudenpc.infinito_extra` (cinta, bufanda, hombreras) |
| Texturas | `textures/entity/claudenpc/infinito_0` … `infinito_4`, `infinito_extra` |
| Controladores de render | `controller.render.claudenpc_infinito`, `controller.render.claudenpc_infinito_extra` |
| Animaciones | `animation.claudenpc.infinito.base`, `.pose_ninguna`, `.pose_guardia`, `.pose_observar`, `.pose_cubrirse`, `.pose_derrota`, `.pose_cargado`, `.pose_recuperar`, `.preparar`, `.rapido`, `.pesado`, `.esquiva`, `.cambio`, `.giro`, `.finta`, `.critico`, `.victoria`, `.evolucion` |
| Controlador de poses | `claudenpc_infinito_pose` (nombre del controlador en `playAnimation`) |
| Controlador del aura | `controller.animation.claudenpc.infinito.aura` |
| Partículas | `claudenpc:infinito_aura`, `claudenpc:infinito_chispas`, `claudenpc:infinito_evolucion`, `claudenpc:infinito_anillo`, `claudenpc:infinito_alma`, `claudenpc:infinito_golpe`, `claudenpc:infinito_cura`, `claudenpc:sello_marca`, `claudenpc:sello_romper` |
| Textura de partículas | `textures/particle/claudenpc_alma` |

## Comandos (con trucos)
| Comando | Qué hace |
|---|---|
| `/claudenpc:infinito [fase]` | Lo genera delante de ti (en la fase indicada, o en la 1) |
| `/claudenpc:fase <1-20>` | Pone esa fase al más cercano (32 bloques) |
| `/claudenpc:determinacion <valor>` | Pone esa determinación (y la fase que le corresponde) al más cercano |
| `/claudenpc:infinito_info` | Muestra fase, determinación, estado, arma, estilo, niveles, estrategias, bloques temporales y errores del más cercano (sin trucos) |

## Sonidos
Solo de Minecraft (no se agregan archivos de audio).
