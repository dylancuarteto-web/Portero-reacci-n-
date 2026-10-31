import { ARMADURAS, PARTICLES, PICOS } from "./config.js";
import { burst, run, sound } from "./util.js";

// Cambia el objeto que sostiene en la mano (o en la otra mano) con un destello.
export function sostener(npc, item, mano = "slot.weapon.mainhand") {
  if (run(npc, `replaceitem entity @s ${mano} 0 ${item}`)) {
    if (item !== "minecraft:air") burst(npc, PARTICLES.cambio, { x: 0, y: 1.2, z: 0 });
    sound(npc, "armor.equip_generic", 1.3);
  }
}

export function pico(state) {
  return PICOS[Math.min(state.nivelPico, PICOS.length - 1)];
}

function material(nivel) {
  return ARMADURAS[Math.min(nivel, ARMADURAS.length - 1)];
}

export function vestir(npc, nivel) {
  const piezas = [["slot.armor.head", "helmet"], ["slot.armor.chest", "chestplate"],
    ["slot.armor.legs", "leggings"], ["slot.armor.feet", "boots"]];
  for (const [slot, pieza] of piezas) run(npc, `replaceitem entity @s ${slot} 0 minecraft:${material(nivel)}_${pieza}`);
}

// Elytra en el pecho mientras vuela; luego vuelve a ponerse la pechera.
export function ponerElytra(npc) {
  run(npc, "replaceitem entity @s slot.armor.chest 0 minecraft:elytra");
}

export function quitarElytra(npc, state) {
  run(npc, `replaceitem entity @s slot.armor.chest 0 minecraft:${material(state.nivelArmadura)}_chestplate`);
}
