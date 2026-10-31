// Ajustes del NPC Claude, Claude Maestro y Claude Golden. Tiempos en ticks (20 ticks = 1 segundo).

export const NPC = "claudenpc:claude";
export const MAESTRO = "claudenpc:maestro";
export const GOLDEN = "claudenpc:claude_golden";
export const ESPEJISMO = "claudenpc:espejismo";
export const ECO = "claudenpc:eco";
export const AURA = "claudenpc:aura";
export const DIMENSIONES = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

// Propiedades de entidad (las ve el paquete de recursos para las posturas).
export const PROP = { escudo: "claudenpc:escudo", sentado: "claudenpc:sentado", furia: "claudenpc:furia" };

// Eventos de la entidad: perseguir o no al jugador, sentarse o levantarse.
export const EVENTO = {
  hostil: "claudenpc:volverse_hostil",
  calmar: "claudenpc:calmarse",
  sentar: "claudenpc:sentarse",
  levantar: "claudenpc:levantarse",
};

export const PARTICLES = {
  cambio: "claudenpc:cambio",
  onda: "claudenpc:onda",
  teletransporte: "claudenpc:teletransporte",
  crafteo: "claudenpc:crafteo",
  construir: "claudenpc:construir",
  cohete: "claudenpc:cohete",
  idea: "claudenpc:idea",
  remo: "claudenpc:remo",
  bloqueo: "claudenpc:bloqueo",
  tiza: "claudenpc:tiza",
  polvo: "claudenpc:polvo",
  zzz: "claudenpc:zzz",
  aviso: "claudenpc:aviso",
  estallido: "claudenpc:estallido",
  chispaCae: "claudenpc:chispa_cae",
  ondaChispa: "claudenpc:onda_chispa",
  sol: "claudenpc:sol",
  solRayo: "claudenpc:sol_rayo",
  agujero: "claudenpc:agujero",
  nota: "claudenpc:nota",
  espejo: "claudenpc:espejo",
  auraDorada: "claudenpc:aura_dorada",
  fusionAnillo: "claudenpc:fusion_anillo",
  fusionDestello: "claudenpc:fusion_destello",
  fusionEspiral: "claudenpc:fusion_espiral",
  reloj: "claudenpc:reloj",
  gravedad: "claudenpc:gravedad",
  confeti: "claudenpc:confeti",
  midas: "claudenpc:midas",
  notas: "claudenpc:notas",
};

export const ANIM = {
  golpe: "animation.claudenpc.golpe",
  espadazo: "animation.claudenpc.espadazo",
  espadazo2: "animation.claudenpc.espadazo2",
  hachazo: "animation.claudenpc.hachazo",
  estocada: "animation.claudenpc.estocada",
  bloqueo: "animation.claudenpc.bloqueo",
  martillazo: "animation.claudenpc.martillazo",
  lanzar: "animation.claudenpc.lanzar",
  colocar: "animation.claudenpc.colocar",
  colocarAbajo: "animation.claudenpc.colocar_abajo",
  crafteo: "animation.claudenpc.crafteo",
  minar: "animation.claudenpc.minar",
  arco: "animation.claudenpc.arco",
  planeo: "animation.claudenpc.planeo",
  cubeta: "animation.claudenpc.cubeta",
  agachado: "animation.claudenpc.agachado",
  torre: "animation.claudenpc.torre",
  remar: "animation.claudenpc.remar",
  celebrar: "animation.claudenpc.celebrar",
  tomarNotas: "animation.claudenpc.tomar_notas",
  levantarMano: "animation.claudenpc.levantar_mano",
  aplaudir: "animation.claudenpc.aplaudir",
  pescar: "animation.claudenpc.pescar",
  pescarEspera: "animation.claudenpc.pescar_espera",
  recoger: "animation.claudenpc.recoger",
  mirarAlrededor: "animation.claudenpc.mirar_alrededor",
  danza: "animation.claudenpc.danza",
  fusion: "animation.claudenpc.fusion",
  goldenPoder: "animation.claudenpc.golden.poder",
  goldenChasquido: "animation.claudenpc.golden.chasquido",
  goldenDirigir: "animation.claudenpc.golden.dirigir",
  goldenPensar: "animation.claudenpc.golden.pensar",
  goldenGolpe: "animation.claudenpc.golden.golpe",
  goldenAturdido: "animation.claudenpc.golden.aturdido",
  goldenRisa: "animation.claudenpc.golden.risa",
  goldenPicada: "animation.claudenpc.golden.picada",
  maestroLeer: "animation.claudenpc.maestro.leer",
  maestroExplicar: "animation.claudenpc.maestro.explicar",
  maestroEscribir: "animation.claudenpc.maestro.escribir",
  maestroSenalar: "animation.claudenpc.maestro.senalar",
  maestroLentes: "animation.claudenpc.maestro.lentes",
  maestroCampana: "animation.claudenpc.maestro.campana",
  maestroAplaudir: "animation.claudenpc.maestro.aplaudir",
  maestroPensar: "animation.claudenpc.maestro.pensar",
  maestroSaludar: "animation.claudenpc.maestro.saludar",
};

// Armas cuerpo a cuerpo. Casi siempre ataca con espada; a veces cambia a hacha o
// tridente. La maza, el arco y el escudo los usan las tácticas (el escudo solo
// sirve para cubrirse de flechas, nunca para golpear).
export const ARMAS = [
  { id: "minecraft:diamond_sword", tipo: "espada", peso: 5 },
  { id: "minecraft:netherite_sword", tipo: "espada", peso: 4 },
  { id: "minecraft:iron_sword", tipo: "espada", peso: 2 },
  { id: "minecraft:diamond_axe", tipo: "hacha", peso: 1.2 },
  { id: "minecraft:trident", tipo: "tridente", peso: 0.8 },
];

export const COMBATE = {
  radio: 32,              // a qué distancia mira si hay jugadores
  cambioArma: [90, 170],
};

// Escudo contra flechas: reacción (ticks) con IQ mínimo y máximo, cuánto lo
// mantiene arriba, velocidad mientras se cubre y desde qué distancia ve un arco.
export const ESCUDO = { reaccion: [14, 3], duracion: 70, lento: 0.12, vista: 40 };

// Abrirse paso: rompe paredes y bloques que pone el jugador para esconderse.
export const EXCAVAR = { maxBloques: 14, atascado: 40, maxPasos: 18 };

// Velocidad de movimiento: caminar y correr como un jugador.
export const VELOCIDAD = { caminar: 0.25, correr: 0.33 };

// IQ: empieza en 70 y sube con la experiencia hasta 300.
export const IQ = { inicial: 70, maximo: 300, propiedad: "claudenpc:iq", global: "claudenpc:iq_global" };

export const CONSTRUCCION = {
  bloque: "minecraft:cobblestone",
  torreMax: 16,
  puenteMax: 24,
};

export const BOTE = {
  velocidad: 0.34,
  paseoCada: [1800, 3200],
};

export const CASA = {
  reintento: 1800,
  alcance: 4.6,
  alcanceTecho: 6.4,
};

export const FUSION = { cantidad: 5, iq: 300, radio: 20, busqueda: 160 };

// Claude Golden (jefe hostil): a qué distancia te ve, cada cuánto usa un poder
// (fase 1 y fase 2, con la mitad de vida), golpe cuerpo a cuerpo y flechas que devuelve.
export const GOLDEN_CFG = {
  vista: 48,
  poderCada: [[110, 170], [60, 105]],
  golpe: { dano: [6, 8], cada: 30, alcance: 2.8 },
  reflejo: [0.7, 0.85],
};

// Claude Maestro: IQ fijo, alcance de la campana, cada cuánto da clase, cuánto
// dura, IQ que gana cada alumno cada 2 s y el bono de aprendizaje después.
export const MAESTRO_CFG = {
  iq: 280,
  llamada: 64,
  primeraClase: 600,
  cadaClase: [2400, 3600],
  espera: 700,
  duracion: 1500,
  puntos: 0.5,
  bono: { x: 2, duracion: 6000 },
  maxAlumnos: 16,
};

export const PICOS = [
  "minecraft:wooden_pickaxe",
  "minecraft:stone_pickaxe",
  "minecraft:iron_pickaxe",
  "minecraft:diamond_pickaxe",
  "minecraft:netherite_pickaxe",
];

export const HACHAS = [
  "minecraft:wooden_axe",
  "minecraft:stone_axe",
  "minecraft:iron_axe",
  "minecraft:diamond_axe",
  "minecraft:netherite_axe",
];

export const PALAS = [
  "minecraft:wooden_shovel",
  "minecraft:stone_shovel",
  "minecraft:iron_shovel",
  "minecraft:diamond_shovel",
  "minecraft:netherite_shovel",
];

export const NIVEL_BLOQUE = {
  "minecraft:dirt": 0, "minecraft:grass_block": 0, "minecraft:sand": 0, "minecraft:gravel": 0,
  "minecraft:clay": 0, "minecraft:oak_log": 0, "minecraft:birch_log": 0, "minecraft:spruce_log": 0,
  "minecraft:stone": 0, "minecraft:cobblestone": 0, "minecraft:coal_ore": 0, "minecraft:andesite": 0,
  "minecraft:diorite": 0, "minecraft:granite": 0, "minecraft:tuff": 0, "minecraft:deepslate": 0,
  "minecraft:cobbled_deepslate": 0, "minecraft:deepslate_coal_ore": 0,
  "minecraft:copper_ore": 1, "minecraft:iron_ore": 1, "minecraft:lapis_ore": 1,
  "minecraft:deepslate_iron_ore": 1, "minecraft:deepslate_copper_ore": 1, "minecraft:deepslate_lapis_ore": 1,
  "minecraft:gold_ore": 2, "minecraft:diamond_ore": 2, "minecraft:redstone_ore": 2, "minecraft:emerald_ore": 2,
  "minecraft:deepslate_gold_ore": 2, "minecraft:deepslate_diamond_ore": 2, "minecraft:deepslate_redstone_ore": 2,
  "minecraft:obsidian": 3, "minecraft:ancient_debris": 3,
};

export const MINERIA = {
  profundidad: [12, 24], // bloques que baja en escalera (cada Claude elige)
  tunel: [6, 14],        // bloques de túnel recto
  pasoCada: 16,          // ticks por bloque minado
  antorchaCada: 7,
};

export const CRAFTEO = {
  duracion: 140,
  picoCuesta: 12,        // bloques minados para mejorar el pico
  armaduraCuesta: 18,
};

export const ARMADURAS = ["leather", "chainmail", "iron", "diamond", "netherite"];

// Desactiva esto si no quieres que rompan ni coloquen bloques en tu mundo.
export const MODIFICA_MUNDO = true;
