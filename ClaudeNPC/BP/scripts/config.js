// Ajustes del NPC Claude. Tiempos en ticks (20 ticks = 1 segundo).

export const NPC = "claudenpc:claude";

export const PARTICLES = {
  cambio: "claudenpc:cambio",
  onda: "claudenpc:onda",
  teletransporte: "claudenpc:teletransporte",
  crafteo: "claudenpc:crafteo",
  construir: "claudenpc:construir",
};

export const ANIM = {
  golpe: "animation.claudenpc.golpe",
  martillazo: "animation.claudenpc.martillazo",
  escudo: "animation.claudenpc.escudo",
  lanzar: "animation.claudenpc.lanzar",
  colocar: "animation.claudenpc.colocar",
  crafteo: "animation.claudenpc.crafteo",
  minar: "animation.claudenpc.minar",
};

// Armas que va alternando en combate (constantemente).
export const ARMAS = [
  "minecraft:diamond_sword",
  "minecraft:mace",
  "minecraft:diamond_axe",
  "minecraft:trident",
  "minecraft:netherite_sword",
  "minecraft:shield",
];

export const COMBATE = {
  radio: 20,
  cambioArma: [50, 80],
  movimiento: 16,
  perlaDistancia: 10,
  perlaCooldown: 160,
  martilloCooldown: 120,
  escudoCooldown: 50,
  torretaCooldown: 900,
  trampaCooldown: 600,
};

// Picos por nivel y los bloques que puede romper cada nivel.
export const PICOS = [
  "minecraft:wooden_pickaxe",
  "minecraft:stone_pickaxe",
  "minecraft:iron_pickaxe",
  "minecraft:diamond_pickaxe",
  "minecraft:netherite_pickaxe",
];

export const NIVEL_BLOQUE = {
  "minecraft:dirt": 0, "minecraft:grass_block": 0, "minecraft:sand": 0, "minecraft:gravel": 0,
  "minecraft:oak_log": 0, "minecraft:birch_log": 0, "minecraft:spruce_log": 0,
  "minecraft:stone": 0, "minecraft:cobblestone": 0, "minecraft:coal_ore": 0, "minecraft:deepslate": 0,
  "minecraft:copper_ore": 1, "minecraft:iron_ore": 1, "minecraft:lapis_ore": 1,
  "minecraft:deepslate_iron_ore": 1,
  "minecraft:gold_ore": 2, "minecraft:diamond_ore": 2, "minecraft:redstone_ore": 2,
  "minecraft:emerald_ore": 2, "minecraft:deepslate_diamond_ore": 2,
  "minecraft:obsidian": 3, "minecraft:ancient_debris": 3,
};

// Mejora que "craftea" según lo que lleva minado (bloques rotos acumulados).
export const ARMADURAS = ["leather", "chainmail", "iron", "diamond", "netherite"];

// Desactiva esto si no quieres que rompa ni coloque bloques en tu mundo.
export const MODIFICA_MUNDO = true;
