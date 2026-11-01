import { world } from "@minecraft/server";
import { MODIFICA_MUNDO, VELOCIDAD } from "../config.js";
import { ponerHaciendo } from "../iq.js";
import { caminarA, caminando, detener, velocidad } from "../movimiento.js";
import { empezarCasa, tickCasa } from "../obras/casa.js";
import { now, rand, sortear } from "../util.js";
import { enSuperficie, minar } from "./minar.js";
import { practica } from "./practicar.js";
import { proyecto } from "./proyecto.js";
import {
  craftear, decorar, descansar, explorar, granja, observar, paseoBote, pescar, talar,
} from "./varias.js";

// Rutina libre: cada Claude decide qué hacer según su personalidad (lo que le gusta),
// lo que tiene cerca y lo que hizo hace poco (no repite lo mismo una y otra vez).
// Entre actividad y actividad pasea un poco a su aire. De noche vuelve a su casa.

const casa = {
  nombre: "construyendo su casa",
  puede: (npc, s) => MODIFICA_MUNDO && !s.hogar && now() >= (s.cd.casaListo ?? 0) && enSuperficie(npc),
  duracion: () => 24000,
  iniciar(npc, s) {
    empezarCasa(npc, s);
    return true;
  },
  tick: (npc, s) => !s.casa,
};

const ACTIVIDADES = {
  minar, talar, explorar, descansar, observar, craftear, pescar, granja, decorar, bote: paseoBote, casa, proyecto, practica,
};

function esDeNoche() {
  const t = world.getTimeOfDay();
  return t > 13000 && t < 23000;
}

function finalizar(npc, s, interrumpida) {
  const a = s.actividad;
  if (!a) return;
  try {
    ACTIVIDADES[a.id]?.fin?.(npc, s, a, interrumpida);
  } catch {
    // Nada que limpiar.
  }
  s.actividad = undefined;
  s.recientes.unshift(a.id);
  s.recientes.length = Math.min(s.recientes.length, 3);
}

// Al empezar a pelear, al ir a clase o al caer al agua: deja lo que hacía.
// La casa y la mina en curso no se pierden: las retoma después.
export function pausarRutina(npc, s) {
  if (!s.actividad) return;
  finalizar(npc, s, true);
  detener(npc);
}

function elegir(npc, s) {
  // Si quedó bajo tierra, lo primero es seguir la mina (y volver a subir).
  if (s.mina) return "minar";
  const lista = [];
  for (const [id, def] of Object.entries(ACTIVIDADES)) {
    let p = def.peso ? def.peso(s) : s.pers?.gustos?.[id] ?? 0.25;
    if (p <= 0) continue;
    const vez = s.recientes.indexOf(id);
    if (vez === 0) p *= 0.12;
    else if (vez > 0) p *= 0.5;
    try {
      if (def.puede && !def.puede(npc, s)) continue;
    } catch {
      continue;
    }
    lista.push({ id, p });
  }
  return lista.length ? sortear(lista).id : undefined;
}

export function tickRutina(npc, s) {
  // La casa en curso tiene prioridad (ya empezó a construirla).
  if (s.casa) {
    velocidad(npc, 0);
    tickCasa(npc, s);
    return;
  }
  if (now() < s.ocupadoHasta) return;
  s.cd.casaListo ??= now() + (s.pers?.casaEn ?? 2400);

  // De noche, a casa a descansar.
  if (s.hogar && esDeNoche() && !s.mina && s.actividad?.id !== "descansar") {
    const d = Math.hypot(s.hogar.x - npc.location.x, s.hogar.z - npc.location.z);
    if (d < 64) {
      if (d > 1.5) {
        if (s.actividad) finalizar(npc, s, true);
        ponerHaciendo(npc, s, "volviendo a casa");
        velocidad(npc, 0);
        if (!caminando(npc)) caminarA(npc, s.hogar, s.pers?.paso ?? 0.22);
        s.ocupadoHasta = now() + 20;
        return;
      }
      const a = { id: "descansar", desde: now(), hasta: now() + 2400, enCasa: true };
      if (descansar.iniciar(npc, s, a)) {
        s.actividad = a;
        ponerHaciendo(npc, s, "durmiendo");
      }
      return;
    }
  }

  const a = s.actividad;
  if (a) {
    const def = ACTIVIDADES[a.id];
    let fin;
    try {
      fin = now() >= a.hasta || def.tick(npc, s, a) === true;
    } catch {
      fin = true;
    }
    if (fin) {
      finalizar(npc, s, false);
      // Un momento libre entre actividades: pasea a su aire.
      velocidad(npc, VELOCIDAD.caminar * 0.8);
      ponerHaciendo(npc, s, "");
      s.ocupadoHasta = now() + Math.round(rand(40, 140) * (s.pers?.ritmo ?? 1));
    }
    return;
  }

  const id = elegir(npc, s);
  if (!id) {
    s.ocupadoHasta = now() + 60;
    return;
  }
  const def = ACTIVIDADES[id];
  const nueva = { id, desde: now(), hasta: now() + def.duracion(s) };
  detener(npc);
  velocidad(npc, 0);
  let ok = false;
  try {
    ok = def.iniciar(npc, s, nueva) !== false;
  } catch {
    ok = false;
  }
  if (!ok) {
    // No se pudo (no hay árboles, agua, sitio...): lo descarta un rato y elige otra cosa.
    s.recientes.unshift(id);
    s.recientes.length = Math.min(s.recientes.length, 3);
    velocidad(npc, VELOCIDAD.caminar * 0.8);
    s.ocupadoHasta = now() + 20;
    return;
  }
  s.actividad = nueva;
  ponerHaciendo(npc, s, def.nombre);
}
