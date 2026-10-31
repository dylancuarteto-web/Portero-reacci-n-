import { ARMADURAS, PARTICLES, PICOS } from "./config.js";
import { burst, run, sound } from "./util.js";

// Cambia el objeto que sostiene en la mano (o en la otra mano) con un destello.
export function sostener(npc, item, mano = "slot.weapon.mainhand") {
  if (run(npc, `replaceitem entity @s ${mano} 0 ${item}`)) {
    burst(npc, PARTICLES.cambio, { x: 0, y: 1.2, z: 0 });
    sound(npc, "armor.equip_generic", 1.3);
  }
}

export function soltarOtraMano(npc) {
  run(npc, "replaceitem entity @s slot.weapon.offhand 0 air");
}

export function pico(state) {
  return PICOS[Math.min(state.nivelPico, PICOS.length - 1)];
}

export function vestir(npc, nivel) {
  const material = ARMADURAS[Math.min(nivel, ARMADURAS.length - 1)];
  const piezas = [["slot.armor.head", "helmet"], ["slot.armor.chest", "chestplate"],
    ["slot.armor.legs", "leggings"], ["slot.armor.feet", "boots"]];
  for (const [slot, pieza] of piezas) run(npc, `replaceitem entity @s ${slot} 0 minecraft:${material}_${pieza}`);
}
