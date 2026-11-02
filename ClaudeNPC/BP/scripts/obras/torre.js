import { ANIM, CONSTRUCCION } from "../config.js";
import { romper } from "../construccion.js";
import { sostener } from "../equipo.js";
import { protegido } from "../estructuras.js";
import { nivelHab, practicar } from "../habilidades.js";
import { nivel } from "../iq.js";
import { detener, saltando, saltoGuiado, velocidad } from "../movimiento.js";
import { animate, blockAt, colocar, now, piso, rand, reemplazable, solido, sound } from "../util.js";

// Torre como la hace un jugador: se centra en el bloque, mira hacia abajo, salta y
// coloca el bloque bajo sus pies en lo alto del salto. El salto es guiado, así que
// siempre llega arriba (antes el impulso a veces no lo levantaba y se quedaba mirando
// hacia arriba). Con IQ bajo a veces falla un bloque, cae y lo vuelve a intentar.

// "libre": el andamio de su propia obra (casa o aula) sí puede levantarse dentro de ella.
export function iniciarTorre(npc, state, hastaY, bloque = CONSTRUCCION.bloque, libre = false) {
  detener(npc);
  velocidad(npc, 0);
  state.obra = { tipo: "torre", hasta: hastaY, bloque, puestos: 0, equipado: false, libre, desde: now(), fallos: 0 };
}

export function tickTorre(npc, state) {
  const o = state.obra;
  if (saltando(npc) || now() < state.ocupadoHasta) return false;
  const nt = o.libre ? 0 : nivelHab(npc, state, "torres"); // Torres y puentes: 1 rápida, 3 sin fallar y más alta
  if (npc.location.y >= o.hasta - 0.3 || o.puestos >= CONSTRUCCION.torreMax + (nt >= 3 ? 8 : 0)) return true;
  if (o.fallos > 4 || now() - o.desde > 900) return true; // no puede: deja de intentarlo
  const dim = npc.dimension;
  const p = piso(npc.location);
  if (!o.libre && protegido(p)) return true; // no construye dentro de casas ni del aula

  // Tiene que estar parado sobre algo (si va cayendo, espera a tocar el suelo).
  const pie = blockAt(dim, p);
  const base = reemplazable(pie) ? p.y : p.y + 1; // sobre una losa, el bloque va encima
  if (!solido(blockAt(dim, { x: p.x, y: base - 1, z: p.z })) && !solido(pie)) {
    if (!npc.isOnGround) return false;
    return true;
  }
  const techo = blockAt(dim, { x: p.x, y: base + 2, z: p.z });
  if (techo && !techo.isAir && !reemplazable(techo)) {
    if (techo.isLiquid) return true;
    // Algo encima de la cabeza: lo rompe primero, como haría un jugador.
    if (!romper(npc, state, techo)) return true;
    animate(npc, ANIM.minar);
    state.ocupadoHasta = now() + 16;
    return false;
  }
  // Se centra en el bloque con un paso corto antes de saltar (dos intentos como mucho:
  // si otro Claude lo empuja, salta desde donde está en vez de temblar recentrándose).
  const cx = p.x + 0.5;
  const cz = p.z + 0.5;
  if (Math.hypot(cx - npc.location.x, cz - npc.location.z) > 0.12 && (o.centrados ?? 0) < 2) {
    o.centrados = (o.centrados ?? 0) + 1;
    saltoGuiado(npc, { x: cx, y: npc.location.y, z: cz }, { ticks: 3, alto: 0, retraso: 0 });
    return false;
  }
  o.centrados = 0;
  if (!o.equipado) {
    sostener(npc, o.bloque);
    o.equipado = true;
  }
  animate(npc, ANIM.torre);
  const yaw = npc.getRotation().y;
  const falla = nt < 3 && Math.random() < 0.1 * (1 - nivel(state));
  const celda = { x: p.x, y: base, z: p.z };
  let puesto = false;
  saltoGuiado(npc, { x: cx, y: base + 1, z: cz }, {
    ticks: 5, alto: 0.2, retraso: 0, mirar: { x: 80, y: yaw },
    enTick(j, pos) {
      if (puesto || j.t < 2 || pos.y < base + 1) return;
      puesto = true;
      if (!falla && colocar(dim, celda, o.bloque)) {
        o.puestos++;
        o.fallos = 0;
        sound(npc, "use.stone", 1);
        if (!o.libre && o.puestos % 4 === 0) practicar(npc, state, "torres", 0.03);
      } else {
        o.fallos++;
        j.destino.y = j.desde.y; // no puso el bloque: vuelve a caer donde estaba
      }
    },
    alTerminar() {
      try {
        npc.setRotation({ x: 70, y: yaw });
      } catch {
        // Sin giro.
      }
    },
  });
  // Rápido, como un jugador que hace "pillar up": unos 3 bloques por segundo.
  state.ocupadoHasta = now() + Math.max(4, 5 + rand(0, 2) - Math.round(nivel(state) * 2) - (nt >= 1 ? 1 : 0));
  return false;
}
