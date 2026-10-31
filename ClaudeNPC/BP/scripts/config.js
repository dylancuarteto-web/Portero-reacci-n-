// Ajustes del NPC Claude y de Claude Golden. Tiempos en ticks (20 ticks = 1 segundo).

export const NPC = "claudenpc:claude";
export const GOLDEN = "claudenpc:claude_golden";
export const ECO = "claudenpc:eco";
export const AURA = "claudenpc:aura";
export const DIMENSIONES = ["minecraft:overworld", "minecraft:nether", "minecraft:the_end"];

export const PARTICLES = {
  cambio: "claudenpc:cambio",
  onda: "claudenpc:onda",
  teletransporte: "claudenpc:teletransporte",
  crafteo: "claudenpc:crafteo",
  construir: "claudenpc:construir",
  cohete: "claudenpc:cohete",
  idea: "claudenpc:idea",
  remo: "claudenpc:remo",
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
  martillazo: "animation.claudenpc.martillazo",
  escudo: "animation.claudenpc.escudo",
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
  danza: "animation.claudenpc.danza",
  fusion: "animation.claudenpc.fusion",
  goldenPoder: "animation.claudenpc.golden.poder",
  goldenChasquido: "animation.claudenpc.golden.chasquido",
  goldenDirigir: "animation.claudenpc.golden.dirigir",
  goldenPensar: "animation.claudenpc.golden.pensar",
};

// Armas cuerpo a cuerpo que alterna constantemente; arco, maza y escudo
// los saca cuando una táctica los necesita.
export const ARMAS = [
  "minecraft:diamond_sword",
  "minecraft:diamond_axe",
  "minecraft:netherite_sword",
  "minecraft:trident",
  "minecraft:mace",
  "minecraft:shield",
];

export const COMBATE = {
  radio: 32,
  cambioArma: [60, 100],
};

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
  primeraVez: 1200,     // empieza su casa tras ~1 minuto trabajando
  reintento: 1800,
  alcance: 4.6,
  alcanceTecho: 6.4,
};

export const FUSION = { cantidad: 5, iq: 300, radio: 20, busqueda: 64 };

export const PICOS = [
  "minecraft:wooden_pickaxe",
  "minecraft:stone_pickaxe",
  "minecraft:iron_pickaxe",
  "minecraft:diamond_pickaxe",
  "minecraft:netherite_pickaxe",
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
  profundidad: 20,     // bloques que baja en escalera
  tunel: 10,           // bloques de túnel recto
  pasoCada: 24,        // ticks por bloque minado (ritmo humano)
  antorchaCada: 7,
};

export const CRAFTEO = {
  duracion: 180,       // ~9 s mirando la mesa
  espera: [900, 1400], // entre crafteos
  picoCuesta: 12,      // bloques minados para mejorar el pico
  armaduraCuesta: 18,
};

export const ARMADURAS = ["leather", "chainmail", "iron", "diamond", "netherite"];

// Desactiva esto si no quieres que rompa ni coloque bloques en tu mundo.
export const MODIFICA_MUNDO = true;
