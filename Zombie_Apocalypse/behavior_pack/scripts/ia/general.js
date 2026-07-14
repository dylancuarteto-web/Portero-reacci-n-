// ia/general.js — el "cerebro" de la horda.
//
// Adaptación honesta: no existe coordinación táctica real en Bedrock.
// El General aplica effects (Speed) y dispara el evento za:coordinar en los
// zombies cercanos, que activa un component group con follow_range 48 (el
// doble de lo normal). Resultado: mientras el General vive, la horda corre
// más y te "ve" desde mucho más lejos. Se SIENTE coordinado.
// Al morir el General, combate.js dispara za:descoordinar en los cercanos.
import { system } from "@minecraft/server";
import { entidadesCercaDeJugadores, esValido } from "../util.js";

const RADIO_MANDO = 16;

function pasadaDeMando() {
  const generales = entidadesCercaDeJugadores(48)
    .filter(e => e.typeId === "za:zombie_general");

  for (const g of generales) {
    if (!esValido(g)) continue;
    try {
      const tropa = g.dimension.getEntities({
        location: g.location,
        maxDistance: RADIO_MANDO,
        families: ["za_zombie"]
      });
      for (const z of tropa) {
        if (z.id === g.id) continue;
        try {
          z.addEffect("speed", 200, { amplifier: 0, showParticles: false });
          z.triggerEvent("za:coordinar"); // follow_range 24 → 48
        } catch { }
      }
    } catch { }
  }
}

export function initGeneral() {
  system.runInterval(pasadaDeMando, 80); // cada 4 s, no cada tick
}
