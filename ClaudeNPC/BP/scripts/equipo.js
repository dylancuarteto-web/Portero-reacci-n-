import { ARMADURAS, ARMAS, HACHAS, PALAS, PARTICLES, PICOS } from "./config.js";
import { burst, now, run, sound } from "./util.js";

// Lo último que se le puso en cada mano (para no repetir el cambio ni el sonido).
const enMano = new Map();

// Cambia el objeto que sostiene en la mano (o en la otra mano) con un destello.
export function sostener(npc, item, mano = "slot.weapon.mainhand") {
  const k = `${npc.id}|${mano}`;
  const antes = enMano.get(k);
  if (antes && antes.item === item && now() - antes.t < 200) return;
  if (run(npc, `replaceitem entity @s ${mano} 0 ${item}`)) {
    enMano.set(k, { item, t: now() });
    if (enMano.size > 600) enMano.delete(enMano.keys().next().value);
    if (item !== "minecraft:air") burst(npc, PARTICLES.cambio, { x: 0, y: 1.2, z: 0 });
    sound(npc, "armor.equip_generic", 1.3, 0.6);
  }
}

export function pico(state) {
  return PICOS[Math.min(state.nivelPico, PICOS.length - 1)];
}

export function hacha(state) {
  return HACHAS[Math.min(state.nivelPico, HACHAS.length - 1)];
}

export function pala(state) {
  return PALAS[Math.min(state.nivelPico, PALAS.length - 1)];
}

// Índice de arma al azar según su peso (casi siempre una espada).
export function armaInicial(excepto = -1) {
  const lista = ARMAS.map((a, i) => ({ i, p: i === excepto ? 0 : a.peso }));
  const total = lista.reduce((t, a) => t + a.p, 0);
  let r = Math.random() * total;
  for (const a of lista) {
    r -= a.p;
    if (r <= 0) return a.i;
  }
  return 0;
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
