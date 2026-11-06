import { system } from "@minecraft/server";
import { todosLosJugadores } from "./comun.js";
import espadas, { anotarMovimiento } from "./poderes/espadas.js";
import ilusiones from "./poderes/ilusiones.js";
import marionetas, { tickMarionetas } from "./poderes/marionetas.js";
import morada from "./poderes/morada.js";
import pausa from "./poderes/pausa.js";
import relojes, { tickRelojes } from "./poderes/relojes.js";
import volea from "./poderes/volea.js";
import { miras, prisma, relojSol, sinfonia, ultimoAliento } from "./poderes/epicos.js";

// Poderes de la fase final de Claude Golden (cada uno en golden/final/poderes).
// v9.0: miras, reloj de sol, prisma, sinfonía y el último aliento (ver poderes/epicos.js).
export const PODERES_FINALES = [volea, relojes, ilusiones, pausa, marionetas, espadas, morada, miras, relojSol, prisma, sinfonia, ultimoAliento];

function participantes(g) {
  const ids = g.final.jugadores;
  return todosLosJugadores().filter((p) => ids.has(p.id));
}

export function tickPoderes(g) {
  const jugadores = participantes(g);
  tickRelojes(g, jugadores);
  tickMarionetas(g, jugadores);
}

// Posiciones de los jugadores en cada tick (para saber si se mueven cuando cae un rayo).
system.runInterval(() => anotarMovimiento(todosLosJugadores()), 1);
