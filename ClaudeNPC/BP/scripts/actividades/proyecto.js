import { BlockPermutation } from "@minecraft/server";
import { MODIFICA_MUNDO } from "../config.js";
import { ocupado, registrar } from "../estructuras.js";
import { nivelHab, obraHecha, obrasHechas, practicar } from "../habilidades.js";
import { aprender, ponerHaciendo } from "../iq.js";
import { velocidad } from "../movimiento.js";
import { candidatosAlrededor, frenteHacia, sitioPlano } from "../obras/casa.js";
import { ejecutarPlano } from "../obras/plano.js";
import { PLANES, PROYECTOS } from "../planes/proyectos_plano.js";
import { avisar, now } from "../util.js";

// Construcción especial según su nivel de Construcción: cerca de su casa levanta un
// jardín (nivel 2), una torre vigía (3), una estatua de Claude (4) y una fuente (5).
// Cada Claude hace cada obra una vez; si lo interrumpen, la retoma donde la dejó.

const perm = (id, estados) => {
  try {
    return BlockPermutation.resolve(id, estados);
  } catch {
    return id;
  }
};

function siguiente(npc, s) {
  const nivel = nivelHab(npc, s, "construccion");
  const hechas = obrasHechas(npc, s);
  return Object.keys(PROYECTOS).find((tipo) => nivel >= PROYECTOS[tipo].nivel && !hechas.includes(tipo));
}

function pararseFuera(c, r) {
  return (pos) => {
    const dx = pos.x - c.x;
    const dz = pos.z - c.z;
    const d = Math.hypot(dx, dz) || 1;
    return { x: c.x + 0.5 + (dx / d) * (r + 1.5), y: c.y + 1, z: c.z + 0.5 + (dz / d) * (r + 1.5) };
  };
}

function buscarSitio(npc, s, tipo) {
  const r = PROYECTOS[tipo].radio;
  const centro = s.hogar ? { location: s.hogar } : npc;
  for (const cand of candidatosAlrededor(centro, 8, 18)) {
    if (ocupado(cand.x, cand.z, r + 1)) continue;
    const sitio = sitioPlano(npc.dimension, cand.x, cand.z, r, r, 1);
    if (sitio) return sitio;
  }
  return undefined;
}

export const proyecto = {
  nombre: "construyendo una obra especial",
  puede: (npc, s) => MODIFICA_MUNDO && !!s.hogar && now() >= (s.cd.proyecto ?? 0) && (!!s.proyectoEnCurso || !!siguiente(npc, s)),
  peso: (s) => 1.4 + (s.pers?.gustos?.casa ?? 0) * 0.4 + (s.pers?.gustos?.decorar ?? 0) * 0.4,
  duracion: () => 12000,
  iniciar(npc, s, a) {
    if (s.proyectoEnCurso) {
      a.tipo = s.proyectoEnCurso.tipo;
      a.obra = s.proyectoEnCurso.obra;
    } else {
      const tipo = siguiente(npc, s);
      if (!tipo) return false;
      const sitio = buscarSitio(npc, s, tipo);
      if (!sitio) {
        s.cd.proyecto = now() + 3600;
        return false;
      }
      const frente = frenteHacia(sitio, s.hogar ? { location: s.hogar } : npc);
      const placa = `Claude${s.pers ? ` ${s.pers.titulo}` : ""}`;
      a.tipo = tipo;
      a.obra = { c: sitio, plan: PLANES[tipo](sitio, frente, perm, placa), i: 0, pararse: pararseFuera(sitio, PROYECTOS[tipo].radio), lejos: 16 };
      registrar("proyecto", { x: sitio.x, y: sitio.y, z: sitio.z, r: PROYECTOS[tipo].radio + 1 });
      avisar(npc.dimension, npc.location, `§b${placa} va a construir ${PROYECTOS[tipo].nombre} §7(Construcción ${PROYECTOS[tipo].nivel})`, 32);
    }
    s.proyectoEnCurso = undefined;
    ponerHaciendo(npc, s, `construyendo ${PROYECTOS[a.tipo].nombre}`);
    return true;
  },
  tick(npc, s, a) {
    velocidad(npc, 0);
    if (!ejecutarPlano(npc, s, a.obra)) return false;
    obraHecha(npc, s, a.tipo);
    practicar(npc, s, "construccion", 0.2);
    aprender(npc, s, 2);
    s.cd.proyecto = now() + 2400;
    a.terminada = true;
    return true;
  },
  fin(npc, s, a, interrumpida) {
    // Si lo interrumpen (pelea, clase...), la guarda para retomarla.
    if (interrumpida && !a.terminada && a.obra) s.proyectoEnCurso = { tipo: a.tipo, obra: a.obra };
  },
};
