import { ItemStack, system } from "@minecraft/server";
import { ITEM_CORAZON, PARTICLES, PROP } from "../../config.js";
import { particleAt, soundAt } from "../../util.js";
import { estallido } from "../comun.js";
import { romperArena } from "./arena.js";
import { revivirCaidos } from "./caidos.js";
import { BLANCO, animar, fundido, jugadoresCerca, pose, prop, sueloBajo, titulo } from "./comun.js";
import { quitarOrbes } from "./orbes.js";
import { participantes, terminarMusica } from "./pelea.js";
import { quitarMarionetas } from "./poderes/marionetas.js";
import { cancelarRelojes } from "./poderes/relojes.js";

// Muerte de Claude Golden: tiembla con grietas de luz, toda su arena se rompe sola (el
// terreno vuelve bloque por bloque), explota en un destello y deja el Corazón dorado (y los
// regalos de siempre). Los que cayeron en la batalla vuelven a jugar.

export function iniciarMuerte(g) {
  const f = g.final;
  const e = g.entidad;
  if (!f || f.etapa === "muerte") return;
  f.etapa = "muerte";
  f.control = true;
  f.tm = 0;
  f.lugarMuerte = { ...e.location };
  cancelarRelojes(g);
  quitarMarionetas(g);
  quitarOrbes((o) => o.dueno?.id === e.id || o.objetivo?.id === e.id);
  for (const m of f.ilusiones ?? []) {
    try {
      if (m.isValid) m.remove();
    } catch {
      // Ya no existe.
    }
  }
  terminarMusica(g);
  pose(g, 0);
  prop(e, PROP.orbesManos, false);
  animar(e, "animation.claudenpc.golden.temblor_final", 0.3);
  try {
    e.getComponent("minecraft:health")?.setCurrentValue(1);
  } catch {
    // Sin vida.
  }
  try {
    e.setDynamicProperty("claudenpc:final", JSON.stringify({ etapa: "muerte", centro: f.arena?.centro }));
  } catch {
    // Sin propiedades.
  }
}

export function tickMuerte(g) {
  const f = g.final;
  const e = g.entidad;
  const dim = e.dimension;
  const t = ++f.tm;
  const L = f.lugarMuerte;
  e.teleport({ x: L.x + (Math.random() - 0.5) * 0.08, y: L.y + (Math.random() - 0.5) * 0.05, z: L.z + (Math.random() - 0.5) * 0.08 }, { keepVelocity: false });
  if (t % 3 === 0) {
    const p = { x: L.x + (Math.random() - 0.5) * 1.4, y: L.y + 0.4 + Math.random() * 1.6, z: L.z + (Math.random() - 0.5) * 1.4 };
    particleAt(dim, PARTICLES.estallido, p);
    soundAt(dim, p, "random.glass", 0.6 + Math.random() * 0.8, 0.6);
  }
  if (t === 10) {
    romperArena(f.arena, 4); // la zona de combate se rompe sola
    f.arena = undefined;
    for (const p of jugadoresCerca(dim, L, 48)) {
      try {
        p.runCommand("camerashake add @s 0.35 3.5 positional");
      } catch {
        // Sin temblor.
      }
    }
  }
  if (t === 40) soundAt(dim, L, "beacon.deactivate", 0.5, 2);
  if (t === 70) explotar(g);
}

function explotar(g) {
  const f = g.final;
  const e = g.entidad;
  const dim = e.dimension;
  const L = { ...f.lugarMuerte };
  const centro = { x: L.x, y: L.y + 1, z: L.z };
  particleAt(dim, PARTICLES.explosionDefinitiva, centro);
  particleAt(dim, PARTICLES.fusionDestello, centro);
  particleAt(dim, PARTICLES.fusionAnillo, L);
  particleAt(dim, PARTICLES.confeti, centro);
  estallido(dim, centro);
  soundAt(dim, L, "random.explode", 0.6, 2);
  soundAt(dim, L, "random.totem", 0.8, 1.2);
  soundAt(dim, L, "mob.enderdragon.death", 1.3, 0.8);
  const cerca = jugadoresCerca(dim, L, 48);
  fundido(cerca, BLANCO, 0.05, 0.25, 1.0);
  // El Corazón dorado y los regalos.
  const suelta = (item, n) => {
    try {
      dim.spawnItem(new ItemStack(item, n), centro);
    } catch {
      // Ítem no disponible.
    }
  };
  suelta(ITEM_CORAZON, 1);
  suelta("minecraft:nether_star", 1);
  suelta("minecraft:golden_apple", 5);
  suelta("minecraft:enchanted_golden_apple", 1);
  suelta("minecraft:experience_bottle", 24);
  const batalla = e.id;
  const todos = participantes(g);
  try {
    e.setDynamicProperty("claudenpc:final", undefined);
    e.remove();
  } catch {
    // Ya no existe.
  }
  f.etapa = "terminada";
  titulo(todos, "§6§l¡VICTORIA!", "§eClaude Golden dejó el Corazón dorado", 10, 80, 20);
  // Los caídos vuelven cuando el terreno ya volvió a su lugar (para no quedar dentro de un bloque).
  system.runTimeout(() => {
    const suelo = sueloBajo(dim, { x: L.x, y: L.y + 24, z: L.z }, 64);
    revivirCaidos(batalla, { ...suelo, dim });
  }, 50);
}
