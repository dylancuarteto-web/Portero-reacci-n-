import { NPC } from "./config.js";
import { vida } from "./dano.js";
import { estados } from "./estado.js";
import { ponerHaciendo } from "./iq.js";
import { now, particleAt, sound } from "./util.js";

// Los Claudes se ayudan (v9.0):
//  - Nunca se hacen daño entre ellos (sensores de daño, ver dano.js) ni se vengan de otro
//    Claude que les pegó sin querer.
//  - Si un jugador golpea a un Claude, los Claudes que están cerca (28 bloques) y no están
//    ocupados (fusión, clase, robot, obras del Robot multi...) vienen a pelear con él.
//  - En la pelea, un Claude con IQ 120 o más cura a un compañero muy herido (menos de 45 %
//    de vida) que tenga cerca: regeneración II por 6 s. Cada Claude, una vez cada 30 s.

const RADIO = 28;

function ocupado(s) {
  return !!(s.fusion || s.clase || s.robot || s.multiObra || s.reparacion || s.plataforma || s.bote || s.reunion
    || (s.robotObra && s.robotObra.fase !== "reunion"));
}

export function pedirAyuda(npc, s, jugador) {
  if (!jugador?.isValid || now() < (s.cd.pedirAyuda ?? 0)) return;
  s.cd.pedirAyuda = now() + 40;
  let otros = [];
  try {
    otros = npc.dimension.getEntities({ type: NPC, location: npc.location, maxDistance: RADIO });
  } catch {
    return;
  }
  for (const o of otros) {
    if (o.id === npc.id) continue;
    const so = estados.get(o.id);
    if (!so || ocupado(so)) continue;
    const yaPeleaba = now() < (so.provocadoHasta ?? 0);
    so.provocadoHasta = Math.max(so.provocadoHasta ?? 0, now() + 900);
    so.ayudando = { id: npc.id, hasta: now() + 900 };
    if (!yaPeleaba) {
      ponerHaciendo(o, so, "§a¡voy a ayudarte!");
      sound(o, "mob.villager.yes", 1.1, 0.8);
    }
  }
}

export function ayudarse(npc, s) {
  if ((s.iq ?? 0) < 120 || now() < (s.cd.curarAliado ?? 0)) return;
  let otros = [];
  try {
    otros = npc.dimension.getEntities({ type: NPC, location: npc.location, maxDistance: 9 });
  } catch {
    return;
  }
  const herido = otros.find((o) => {
    if (o.id === npc.id) return false;
    const v = vida(o);
    return v.actual > 0 && v.actual < v.max * 0.45;
  });
  if (!herido) return;
  s.cd.curarAliado = now() + 600;
  try {
    herido.addEffect("regeneration", 120, { amplifier: 1, showParticles: true });
  } catch {
    // Sin efecto.
  }
  const p = { x: herido.location.x, y: herido.location.y + 1.2, z: herido.location.z };
  particleAt(herido.dimension, "minecraft:heart_particle", p);
  particleAt(herido.dimension, "minecraft:villager_happy", p);
  sound(herido, "random.levelup", 1.6, 0.6);
  ponerHaciendo(npc, s, "§a¡te curo!");
  const sh = estados.get(herido.id);
  if (sh) ponerHaciendo(herido, sh, "§a¡gracias!");
}
