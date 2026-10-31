import { system } from "@minecraft/server";
import { ANIM, CONSTRUCCION } from "../config.js";
import { romper } from "../construccion.js";
import { sostener } from "../equipo.js";
import { nivel } from "../iq.js";
import { detener, velocidad } from "../movimiento.js";
import { animate, blockAt, colocar, impulse, now, piso, rand, sound } from "../util.js";

// Torre como la hace un jugador: se centra en el bloque, mira hacia abajo, salta y
// coloca el bloque bajo sus pies en el punto más alto del salto. Repite hasta llegar
// a la altura que quiere. Con IQ bajo a veces falla un bloque y lo vuelve a intentar.

export function iniciarTorre(npc, state, hastaY, bloque = CONSTRUCCION.bloque) {
  detener(npc);
  velocidad(npc, 0);
  state.obra = { tipo: "torre", hasta: hastaY, bloque, puestos: 0, equipado: false };
}

export function tickTorre(npc, state) {
  const o = state.obra;
  if (now() < state.ocupadoHasta) return false;
  if (npc.location.y >= o.hasta - 0.3 || o.puestos >= CONSTRUCCION.torreMax) return true;
  if (!npc.isOnGround) return false;

  const p = piso(npc.location);
  const techo = blockAt(npc.dimension, { x: p.x, y: p.y + 2, z: p.z });
  if (techo && !techo.isAir && !techo.isLiquid) {
    // Algo encima de la cabeza: lo rompe primero, como haría un jugador.
    if (!romper(npc, state, techo)) return true;
    animate(npc, ANIM.minar);
    state.ocupadoHasta = now() + 16;
    return false;
  }
  // Se centra en el bloque antes de saltar.
  const cx = p.x + 0.5 - npc.location.x;
  const cz = p.z + 0.5 - npc.location.z;
  if (Math.abs(cx) > 0.2 || Math.abs(cz) > 0.2) {
    impulse(npc, { x: cx * 0.35, y: 0, z: cz * 0.35 });
    state.ocupadoHasta = now() + 2;
    return false;
  }
  if (!o.equipado) {
    sostener(npc, o.bloque);
    o.equipado = true;
  }
  animate(npc, ANIM.torre);
  impulse(npc, { x: 0, y: 0.42, z: 0 });
  const falla = Math.random() < 0.1 * (1 - nivel(state));
  system.runTimeout(() => {
    if (!npc.isValid || falla) return;
    if (colocar(npc.dimension, p, o.bloque)) {
      o.puestos++;
      sound(npc, "use.stone", 1);
    }
  }, 5 + rand(0, 1));
  state.ocupadoHasta = now() + 9 + rand(0, 2) - Math.round(nivel(state) * 3);
  return false;
}
