// Ajustes del NPC Claude. Tiempos en ticks (20 ticks = 1 segundo).

export const NPC = "claudenpc:claude";

export const PARTICLES = {
  cambio: "claudenpc:cambio",
  onda: "claudenpc:onda",
  teletransporte: "claudenpc:teletransporte",
  crafteo: "claudenpc:crafteo",
  construir: "claudenpc:construir",
  cohete: "claudenpc:cohete",
  idea: "claudenpc:idea",
};

export const ANIM = {
  golpe: "animation.claudenpc.golpe",
  martillazo: "animation.claudenpc.martillazo",
  escudo: "animation.claudenpc.escudo",
  lanzar: "animation.claudenpc.lanzar",
  colocar: "animation.claudenpc.colocar",
  crafteo: "animation.claudenpc.crafteo",
  minar: "animation.claudenpc.minar",
  arco: "animation.claudenpc.arco",
  planeo: "animation.claudenpc.planeo",
  cubeta: "animation.claudenpc.cubeta",
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
  profundidad: 20,     // bloques que baja en escalera antes de cambiar a túnel recto
  tunel: 10,           // bloques de túnel recto antes de empezar otra escalera
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
