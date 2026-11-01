import { system } from "@minecraft/server";
import { ANIM, ARMAS, NPC, PARTICLES } from "../config.js";
import { sostener } from "../equipo.js";
import { estados } from "../estado.js";
import { nivelHab, practicar } from "../habilidades.js";
import { animate, avisar, distancia, flat, impulse, mirarA, now, particleAt, sound, soundAt } from "../util.js";

// Dúo de viento: cuando un Claude saca las elytras para atacarte, otro Claude cercano
// que sabe hacerlo (Vuelo nivel 2, o IQ 150 o más) se da cuenta y le lanza cargas de
// viento: cada carga estalla bajo el que vuela y lo sube mucho más alto. Desde más
// arriba la picada con la maza pega más fuerte, y en dúo además pega x1,5.

function puedeAyudar(s) {
  return !s.fusion && !s.robot && !s.robotObra && !s.clase && !s.bote && !s.obra && !s.reunion && !s.volando && !s.sentado
    && !s.ayudando;
}

export function buscarCompanero(volador) {
  let mejor;
  let md = 18;
  try {
    for (const n of volador.dimension.getEntities({ type: NPC, location: volador.location, maxDistance: 18 })) {
      if (n.id === volador.id) continue;
      const s = estados.get(n.id);
      if (!s || !puedeAyudar(s) || !(s.iq >= 150 || nivelHab(n, s, "vuelo") >= 2)) continue;
      const d = distancia(n.location, volador.location);
      if (d < md) {
        md = d;
        mejor = { npc: n, s };
      }
    }
  } catch {
    return undefined;
  }
  return mejor;
}

// Estallido de viento bajo los pies: lo lanza hacia arriba (y un poco hacia el jugador).
export function estallidoDeViento(volador, hacia, fuerza = 1) {
  const d = hacia ? flat(volador.location, hacia) : { x: 0, z: 0 };
  impulse(volador, { x: d.x * 0.3 * fuerza, y: 0.95 * fuerza, z: d.z * 0.3 * fuerza });
  const l = volador.location;
  particleAt(volador.dimension, PARTICLES.viento, { x: l.x, y: l.y - 0.2, z: l.z });
  particleAt(volador.dimension, PARTICLES.onda, { x: l.x, y: l.y - 0.1, z: l.z });
  soundAt(volador.dimension, l, "wind_charge.burst", 1, 1);
}

// El compañero lanza una carga de viento que viaja hasta el que vuela.
function lanzarCarga(ayudante, volador, jugador) {
  if (!ayudante.isValid || !volador.isValid) return;
  sostener(ayudante, "minecraft:wind_charge");
  mirarA(ayudante, volador.location);
  animate(ayudante, ANIM.lanzar);
  sound(ayudante, "mob.breeze.shoot", 1.2, 0.8);
  const desde = ayudante.getHeadLocation();
  const vuelo = Math.max(4, Math.min(14, Math.round(distancia(desde, volador.location) / 1.6)));
  for (let t = 1; t <= vuelo; t++) {
    system.runTimeout(() => {
      if (!volador.isValid) return;
      const f = t / vuelo;
      const p = volador.location;
      particleAt(volador.dimension, PARTICLES.viento, {
        x: desde.x + (p.x - desde.x) * f, y: desde.y + (p.y - desde.y) * f, z: desde.z + (p.z - desde.z) * f,
      });
    }, t);
  }
  system.runTimeout(() => volador.isValid && estallidoDeViento(volador, jugador?.isValid ? jugador.location : undefined, 1), vuelo);
}

// Arranca el dúo: tres cargas (al despegar y mientras planea).
export function iniciarDuo(volador, sv, jugador) {
  const ayuda = buscarCompanero(volador);
  if (!ayuda) return false;
  const { npc, s } = ayuda;
  s.ayudando = true;
  s.ocupadoHasta = Math.max(s.ocupadoHasta, now() + 110);
  sv.duo = { ayudante: npc };
  avisar(volador.dimension, volador.location, "§b¡Dúo de viento! §7Un Claude impulsa al otro con cargas de viento", 32);
  for (const t of [8, 42, 78]) {
    system.runTimeout(() => {
      if (sv.volando && sv.duo) lanzarCarga(npc, volador, jugador);
    }, t);
  }
  system.runTimeout(() => {
    s.ayudando = false;
    if (npc.isValid) sostener(npc, (ARMAS[s.arma] ?? ARMAS[0]).id);
  }, 110);
  practicar(npc, s, "vuelo", 0.06);
  return true;
}
