import { system } from "@minecraft/server";
import { ANIM, CONSTRUCCION } from "../config.js";
import { sostener } from "../equipo.js";
import { protegido } from "../estructuras.js";
import { nivel } from "../iq.js";
import { caminarA, detener, velocidad } from "../movimiento.js";
import { animate, blockAt, centro, colocar, flat, impulse, mirarA, now, piso, rand, reemplazable, sound } from "../util.js";

// Puentes como un jugador:
//  - "agachado" (IQ bajo): se agacha en el borde, mira abajo, coloca y avanza despacio.
//  - "rapido" (IQ medio): el mismo gesto, más ágil.
//  - "salto" (IQ alto): salta hacia delante y coloca el bloque bajo sus pies en el aire.
// Si el destino está más alto, sube en escalera: coloca delante y salta encima.

export function iniciarPuente(npc, state, destino, bloque = CONSTRUCCION.bloque) {
  detener(npc);
  velocidad(npc, 0);
  const n = nivel(state);
  const modo = n > 0.55 ? "salto" : n > 0.2 ? "rapido" : "agachado";
  state.obra = { tipo: "puente", destino: { ...destino }, bloque, modo, puestos: 0, equipado: false };
}

export function tickPuente(npc, state) {
  const o = state.obra;
  if (now() < state.ocupadoHasta) return false;
  const d = flat(npc.location, o.destino);
  if (d.d < 1.5 || o.puestos >= CONSTRUCCION.puenteMax) return true;
  if (!npc.isOnGround && o.modo !== "salto") return false;

  const p = piso(npc.location);
  const eje = Math.abs(d.x) >= Math.abs(d.z) ? { x: Math.sign(d.x), z: 0 } : { x: 0, z: Math.sign(d.z) };
  const sig = { x: p.x + eje.x, y: p.y, z: p.z + eje.z };
  const bajo = { x: sig.x, y: p.y - 1, z: sig.z };
  if (protegido(sig)) return true; // no construye dentro de casas ni del aula
  if (!o.equipado) {
    sostener(npc, o.bloque);
    o.equipado = true;
  }

  // Escalera hacia arriba: coloca delante a la altura de los pies y salta encima.
  if (o.destino.y - npc.location.y >= 1 && npc.isOnGround) {
    const escalon = blockAt(npc.dimension, sig);
    if (reemplazable(escalon)) {
      mirarA(npc, { x: sig.x + 0.5, y: sig.y + 0.5, z: sig.z + 0.5 });
      animate(npc, ANIM.colocar);
      if (colocar(npc.dimension, sig, o.bloque)) {
        o.puestos++;
        sound(npc, "use.stone", 1);
      }
    }
    system.runTimeout(() => npc.isValid && impulse(npc, { x: eje.x * 0.17, y: 0.42, z: eje.z * 0.17 }), 5);
    state.ocupadoHasta = now() + 11 + rand(0, 2);
    return false;
  }

  const suelo = blockAt(npc.dimension, bajo);
  if (suelo && !reemplazable(suelo) && !suelo.isLiquid) {
    // Todavía hay suelo delante: da un paso normal.
    caminarA(npc, centro(sig), 0.16);
    state.ocupadoHasta = now() + 8;
    return false;
  }

  if (o.modo === "salto") {
    // Puente desde el aire: salta hacia delante y coloca bajo sus pies en pleno salto.
    if (npc.isOnGround) {
      animate(npc, ANIM.torre);
      impulse(npc, { x: eje.x * 0.12, y: 0.36, z: eje.z * 0.12 });
    }
    system.runTimeout(() => {
      if (!npc.isValid) return;
      animate(npc, ANIM.colocarAbajo);
      if (colocar(npc.dimension, bajo, o.bloque)) {
        o.puestos++;
        sound(npc, "use.stone", 1.1);
      }
    }, 3);
    system.runTimeout(() => npc.isValid && caminarA(npc, centro(sig), 0.18), 6);
    state.ocupadoHasta = now() + 7 + rand(0, 1);
    return false;
  }

  // Agachado en el borde, mirando el hueco: coloca y avanza.
  const lento = o.modo === "agachado";
  animate(npc, ANIM.agachado);
  mirarA(npc, { x: bajo.x + 0.5, y: bajo.y + 0.5, z: bajo.z + 0.5 });
  system.runTimeout(() => {
    if (!npc.isValid) return;
    animate(npc, ANIM.colocarAbajo);
    if (colocar(npc.dimension, bajo, o.bloque)) {
      o.puestos++;
      sound(npc, "use.stone", 1);
    }
  }, lento ? 4 : 3);
  system.runTimeout(() => npc.isValid && caminarA(npc, centro(sig), lento ? 0.09 : 0.13), lento ? 7 : 5);
  state.ocupadoHasta = now() + (lento ? 12 : 8) + rand(0, 2);
  return false;
}
