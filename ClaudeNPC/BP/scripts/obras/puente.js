import { system } from "@minecraft/server";
import { ANIM, CONSTRUCCION } from "../config.js";
import { sostener } from "../equipo.js";
import { protegido } from "../estructuras.js";
import { nivelHab, practicar } from "../habilidades.js";
import { nivel } from "../iq.js";
import { deslizar, detener, saltando, saltoGuiado, subirA, velocidad } from "../movimiento.js";
import { animate, blockAt, flat, mirarA, now, piso, rand, reemplazable, sound } from "../util.js";

// Puentes como un jugador, avanzando con pasos guiados (antes dependían de la física y a
// menudo se quedaban en el borde sin poner nada):
//  - "agachado" (IQ bajo): se agacha en el borde, mira el hueco, coloca y avanza despacio.
//  - "rapido" (IQ medio): el mismo gesto, más ágil.
//  - "salto" (IQ alto): salta hacia delante y coloca el bloque bajo sus pies en el aire.
// Primero camina hasta el borde; sirve sobre huecos, agua y lava. Si el destino está más
// alto, sube en escalera: coloca delante a la altura de los pies y salta encima.

function ejeHacia(desde, hacia) {
  const dx = hacia.x - desde.x;
  const dz = hacia.z - desde.z;
  return Math.abs(dx) >= Math.abs(dz) ? { x: Math.sign(dx) || 1, z: 0 } : { x: 0, z: Math.sign(dz) || 1 };
}

// Se puede estar de pie en ese hueco (aire, plantas, cosas finas).
function libre(b) {
  return !b || reemplazable(b) || /(carpet|torch|_sign|rail|_button|pressure_plate)$/.test(b.typeId);
}

// ¿Falta suelo en (x, y, z)? Aire con caída de 2 o más, agua o lava. Un desnivel de un
// solo bloque no cuenta (se baja caminando).
function sinSuelo(dim, x, y, z) {
  const b = blockAt(dim, { x, y, z });
  if (!b) return false;
  if (b.isLiquid) return true;
  if (!b.isAir && !reemplazable(b)) return false;
  const debajo = blockAt(dim, { x, y: y - 1, z });
  return !debajo || debajo.isAir || debajo.isLiquid || reemplazable(debajo);
}

/**
 * ¿Hay un hueco entre el Claude y "destino", en línea recta por el eje? Devuelve
 * { a, largo } (a cuántos bloques empieza y cuánto mide) o undefined.
 * @param {import("@minecraft/server").Entity} npc
 * @param {{x:number,y:number,z:number}} destino
 */
export function huecoHacia(npc, destino, max = 12) {
  const dim = npc.dimension;
  const p = piso(npc.location);
  const e = ejeHacia(npc.location, destino);
  const largo = Math.min(max, Math.round(Math.abs(destino.x - npc.location.x) + Math.abs(destino.z - npc.location.z)));
  let inicio;
  for (let k = 1; k <= largo; k++) {
    const x = p.x + e.x * k;
    const z = p.z + e.z * k;
    // Una pared antes del hueco: no hay puente que hacer (eso se pica).
    if (inicio === undefined && !libre(blockAt(dim, { x, y: p.y, z })) && !libre(blockAt(dim, { x, y: p.y + 1, z }))) return undefined;
    if (sinSuelo(dim, x, p.y - 1, z)) inicio ??= k;
    else if (inicio !== undefined) return { a: inicio, largo: k - inicio };
  }
  return inicio !== undefined ? { a: inicio, largo: largo - inicio + 1 } : undefined;
}

// Pone el bloque del puente sobre aire, plantas, agua o lava.
function ponerPuente(dim, pos, bloque) {
  const b = blockAt(dim, pos);
  if (!b || !(b.isAir || b.isLiquid || reemplazable(b)) || protegido(pos)) return false;
  try {
    b.setType(bloque);
    return true;
  } catch {
    return false;
  }
}

export function iniciarPuente(npc, state, destino, bloque = CONSTRUCCION.bloque) {
  detener(npc);
  velocidad(npc, 0);
  const n = nivel(state);
  const nt = nivelHab(npc, state, "torres"); // Torres y puentes 2: puente rápido; 3: desde el aire
  const modo = n > 0.55 || nt >= 3 ? "salto" : n > 0.2 || nt >= 2 ? "rapido" : "agachado";
  practicar(npc, state, "torres", 0.03);
  state.obra = { tipo: "puente", destino: { ...destino }, eje: ejeHacia(npc.location, destino), bloque, modo, puestos: 0,
    equipado: false, turnos: 0, cruzado: 0 };
}

export function tickPuente(npc, state) {
  const o = state.obra;
  if (saltando(npc) || now() < state.ocupadoHasta) return false;
  // Si lleva muchos turnos sin terminar, lo deja (no se queda trabado en el borde).
  o.turnos++;
  if (o.turnos > 140 || (o.turnos > 40 && o.puestos === 0)) return true;
  const d = flat(npc.location, o.destino);
  if (d.d < 1.5 || o.puestos >= CONSTRUCCION.puenteMax) return true;
  const dim = npc.dimension;
  const p = piso(npc.location);
  const e = o.eje;
  const sig = { x: p.x + e.x, y: p.y, z: p.z + e.z };
  const bajo = { x: sig.x, y: p.y - 1, z: sig.z };
  if (protegido(sig)) return true; // no construye dentro de casas ni del aula
  const pie = blockAt(dim, sig);
  const cabeza = blockAt(dim, { x: sig.x, y: sig.y + 1, z: sig.z });
  if (!libre(pie) && !libre(cabeza)) return true; // pared: el puente termina (se pica aparte)
  if (!o.equipado) {
    sostener(npc, o.bloque);
    o.equipado = true;
  }
  const centroSig = { x: sig.x + 0.5, y: p.y, z: sig.z + 0.5 };

  // Un escalón natural delante: lo sube de un salto.
  if (!libre(pie)) {
    if (!libre(blockAt(dim, { x: sig.x, y: sig.y + 2, z: sig.z }))) return true;
    subirA(npc, sig);
    state.ocupadoHasta = now() + 8;
    return false;
  }

  // Escalera hacia arriba: coloca delante a la altura de los pies y sube encima.
  if (o.destino.y - npc.location.y >= 1) {
    mirarA(npc, { x: sig.x + 0.5, y: sig.y + 0.5, z: sig.z + 0.5 });
    animate(npc, ANIM.colocar);
    if (ponerPuente(dim, sig, o.bloque)) {
      o.puestos++;
      sound(npc, "use.stone", 1);
      system.runTimeout(() => npc.isValid && subirA(npc, sig), 2);
    } else return true;
    state.ocupadoHasta = now() + 10 + rand(0, 2);
    return false;
  }

  // Todavía hay suelo delante: avanza un bloque. Ya cruzado el hueco, a los 2 pasos termina.
  if (!sinSuelo(dim, bajo.x, bajo.y, bajo.z)) {
    if (o.puestos > 0 && ++o.cruzado >= 2) return true;
    deslizar(npc, centroSig, 5);
    state.ocupadoHasta = now() + 5;
    return false;
  }
  o.cruzado = 0;

  if (o.modo === "salto") {
    // Puente desde el aire: salta hacia delante y coloca bajo sus pies en pleno salto. Si no
    // puede colocarlo, vuelve a caer donde estaba (nunca se tira al hueco).
    animate(npc, ANIM.torre);
    let puesto = false;
    saltoGuiado(npc, centroSig, {
      ticks: 7, alto: 0.45, retraso: 0,
      enTick(j) {
        if (puesto || j.t < 3) return;
        puesto = true;
        animate(npc, ANIM.colocarAbajo);
        if (ponerPuente(dim, bajo, o.bloque)) {
          o.puestos++;
          sound(npc, "use.stone", 1.1);
        } else {
          j.destino = { ...j.desde };
        }
      },
    });
    state.ocupadoHasta = now() + 7 + rand(0, 1);
    return false;
  }

  // Agachado en el borde, mirando el hueco: coloca y avanza (si no pudo colocar, no avanza).
  const lento = o.modo === "agachado";
  animate(npc, ANIM.agachado);
  mirarA(npc, { x: bajo.x + 0.5, y: bajo.y + 0.5, z: bajo.z + 0.5 });
  system.runTimeout(() => {
    if (!npc.isValid || state.obra !== o) return;
    animate(npc, ANIM.colocarAbajo);
    if (ponerPuente(dim, bajo, o.bloque)) {
      o.puestos++;
      sound(npc, "use.stone", 1);
      system.runTimeout(() => npc.isValid && state.obra === o && deslizar(npc, centroSig, lento ? 6 : 4), 2);
    } else o.turnos += 10;
  }, lento ? 4 : 2);
  state.ocupadoHasta = now() + (lento ? 13 : 8) + rand(0, 2);
  return false;
}
