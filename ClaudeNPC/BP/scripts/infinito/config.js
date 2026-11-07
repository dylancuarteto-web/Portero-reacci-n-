// Claude Exponencial Infinito (INFINITE DETERMINATION): configuración. Todo se puede ajustar
// aquí sin tocar la lógica. Ver docs/FEATURE_SPEC_INFINITO.md.

export const INFINITO = "claudenpc:exponencial_infinito";
export const NOMBRE_INFINITO = "Claude Exponencial Infinito";

export const INFINITO_CFG = {
  ritmo: 1.5, // multiplicador de toda la determinación que gana (más alto: evoluciona más rápido)
  base: 12, // umbral de la fase n = base × (crecimiento^(n−1) − 1)
  crecimiento: 1.4,
  maxFase: 20,
  maxDeterminacionX: 3, // tope de determinación = 3 × umbral de la fase 20
  maxPorCombate: 900, // determinación máxima que gana en un mismo combate
  danoMax: 1.4, // multiplicador de daño máximo (fase 20)
  topeMaza: 30, // daño máximo de un golpe de maza (que no mate de un golpe)
  vista: 24, // busca objetivos a esta distancia
  persigue: 40, // ya peleando, te sigue hasta aquí
  pve: true, // también pelea con monstruos (si no hay jugadores)
  modificaMundo: true, // cubetas, lava, TNT y bloques (siempre se quitan después)
  lava: true,
  ventanaSello: 600, // ticks derribado (30 s) antes de recuperarse solo si nadie vino
  rescateA: 240, // ticks hasta que llega un Claude a buscarlo (12 s)
  recuperacion: 600, // ticks sentado hasta recuperarse (30 s)
  radioRescatista: 48,
  frases: true,
  maxPensandoPorTick: 3, // cuántos Infinitos piensan en el mismo tick (reparto de carga)
  particulasPorSegundo: 24, // tope de partículas del script por Infinito
};

// Determinación que gana por cada cosa (× ritmo).
export const GANANCIA = {
  golpe: 1, critico: 2, combo: 2, bloqueo: 1.5, esquiva: 1, aguante: 3, patron: 4, estrategia: 4,
  remontada: 10, levantarse: 25, victoria: 20, monstruo: 3,
};

export const TAG_INF = {
  obj: "claudenpc_inf_obj", // sus proyectiles, TNT y cristales
  antiexplosion: "claudenpc_antiexplosion",
};

export const PROP_INF = "claudenpc:infinito";
export const PROP_SELLADOS = "claudenpc:infinitos_sellados";
export const POSE_INF = "claudenpc_infinito_pose"; // nombre del controlador de poses

const A = "animation.claudenpc.";
export const ANIM_INF = {
  espadazo: `${A}espadazo`, espadazo2: `${A}espadazo2`, hachazo: `${A}hachazo`, estocada: `${A}estocada`, bloqueo: `${A}bloqueo`,
  arco: `${A}arco`, lanzar: `${A}lanzar`, beber: `${A}beber`, cubeta: `${A}cubeta`, torre: `${A}torre`, celebrar: `${A}celebrar`,
  preparar: `${A}infinito.preparar`, rapido: `${A}infinito.rapido`, pesado: `${A}infinito.pesado`, esquiva: `${A}infinito.esquiva`,
  cambio: `${A}infinito.cambio`, giro: `${A}infinito.giro`, finta: `${A}infinito.finta`, critico: `${A}infinito.critico`,
  victoria: `${A}infinito.victoria`, evolucion: `${A}infinito.evolucion`,
};

export const PART_INF = {
  evolucion: "claudenpc:infinito_evolucion", anillo: "claudenpc:infinito_anillo", alma: "claudenpc:infinito_alma",
  golpe: "claudenpc:infinito_golpe", cura: "claudenpc:infinito_cura", selloMarca: "claudenpc:sello_marca",
  selloRomper: "claudenpc:sello_romper", critico: "minecraft:critical_hit_emitter",
};

// Bloques del sello: pilares de obsidiana (o llorosa) y fuego de almas encima.
export const SELLO = {
  pilar: ["minecraft:obsidian", "minecraft:crying_obsidian"],
  llama: ["minecraft:soul_torch", "minecraft:soul_lantern", "minecraft:soul_campfire"],
  esquinas: [[2, 2], [2, -2], [-2, 2], [-2, -2]],
};
