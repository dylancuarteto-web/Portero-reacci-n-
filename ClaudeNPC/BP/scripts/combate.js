import { ARMAS, COMBATE, MODIFICA_MUNDO } from "./config.js";
import { aguaDelante, subirABote } from "./bote.js";
import { cavar, torreta, trampa } from "./construccion.js";
import { sostener } from "./equipo.js";
import { aprender, nivel } from "./iq.js";
import { ritmo } from "./movimiento.js";
import { iniciarPuente } from "./obras/puente.js";
import { iniciarTorre } from "./obras/torre.js";
import {
  arco, elytraMartillo, golpeEscudo, hayBorde, martillazo, perla, saltarAlVacio,
} from "./tacticas.js";
import { now, rand } from "./util.js";

// Nodos de decisión: cada situación tiene varias alternativas. El IQ desbloquea
// nodos, acorta el tiempo de reacción y la memoria de lo que le funcionó (y de lo
// que suele hacer el jugador) cambia la probabilidad de cada una.
const NODOS = [
  // El jugador sube para escapar: construir, disparar, volar o teletransportarse.
  { id: "torre", iq: 70, cd: 40, si: (c) => c.alto > 2 && c.dist < 6 && MODIFICA_MUNDO, peso: () => 3 },
  // Hay un hueco o agua entre los dos: puente o bote.
  { id: "puente", iq: 70, cd: 40, si: (c) => c.borde && c.dist > 2.5 && Math.abs(c.alto) < 4 && MODIFICA_MUNDO, peso: () => 3.5 },
  { id: "bote", iq: 70, cd: 200, si: (c) => c.agua && c.dist > 4 && MODIFICA_MUNDO, peso: () => 5 },
  { id: "arco", iq: 70, cd: 50, si: (c) => c.dist > 9 || c.alto > 3, peso: (c) => 2.5 + (c.dist > 15 ? 2 : 0) + c.mem.torres * 0.3 },
  { id: "elytra", iq: 125, cd: 500, si: (c) => (c.alto > 4 || c.dist > 16) && c.cielo, peso: (c) => 1.5 + c.mem.torres * 0.5 },
  { id: "perla", iq: 85, cd: 220, si: (c) => c.dist > 14 || c.alto > 5, peso: (c) => 1.2 + c.mem.arco * 0.4 },
  // El jugador está abajo: saltar con water drop o cavar.
  { id: "vacio", iq: 100, cd: 160, si: (c) => c.alto < -5 && c.dist < 10 && c.borde, peso: () => 3 },
  { id: "cavar", iq: 70, cd: 16, si: (c) => c.alto < -3 && c.dist < 4 && MODIFICA_MUNDO, peso: () => 2 },
  // Cerca: maza, escudo; con más IQ, trampas y torretas.
  { id: "martillazo", iq: 75, cd: 140, si: (c) => c.dist < 5 && c.alto > -1 && c.alto < 2, peso: () => 1.5 },
  { id: "escudo", iq: 70, cd: 70, si: (c) => c.dist < 3, peso: (c) => 1 + c.mem.golpes * 0.1 },
  { id: "torreta", iq: 110, cd: 1100, si: (c) => c.dist > 7 && c.dist < 18 && MODIFICA_MUNDO, peso: () => 0.8 },
  { id: "trampa", iq: 120, cd: 700, si: (c) => c.dist > 4 && c.dist < 12 && MODIFICA_MUNDO, peso: () => 0.8 },
];

const ACCIONES = {
  torre: (npc, s, j) => iniciarTorre(npc, s, j.location.y),
  puente: (npc, s, j) => iniciarPuente(npc, s, j.location),
  bote: (npc, s, j) => subirABote(npc, s, j.location),
  arco, perla, martillazo,
  elytra: elytraMartillo,
  vacio: saltarAlVacio,
  cavar: (npc, s) => cavar(npc, s),
  escudo: golpeEscudo,
  torreta: (npc, s, j) => torreta(npc, j),
  trampa: (npc, s, j) => trampa(npc, j),
};

function cambiarArma(npc, state) {
  state.arma = (state.arma + 1) % 4; // espadas, hacha y tridente; el resto lo usan las tácticas
  sostener(npc, ARMAS[state.arma]);
  sostener(npc, "minecraft:shield", "slot.weapon.offhand");
  state.cd.arma = now() + rand(...COMBATE.cambioArma);
}

// Para volar con elytra necesita espacio libre encima.
function cieloLibre(npc) {
  try {
    return !npc.dimension.getBlockFromRay(npc.getHeadLocation(), { x: 0, y: 1, z: 0 }, { maxDistance: 8 });
  } catch {
    return false;
  }
}

function contexto(npc, state, jugador) {
  const dist = Math.hypot(jugador.location.x - npc.location.x, jugador.location.z - npc.location.z);
  return {
    dist,
    alto: jugador.location.y - npc.location.y,
    mem: state.memoria,
    borde: hayBorde(npc, jugador),
    agua: aguaDelante(npc, jugador.location),
    cielo: cieloLibre(npc),
  };
}

function elegir(candidatos, state) {
  const total = candidatos.reduce((t, c) => t + c.p, 0);
  let r = Math.random() * total;
  for (const c of candidatos) {
    r -= c.p;
    if (r <= 0) return c.nodo;
  }
  return candidatos[0]?.nodo;
}

export function tickCombate(npc, state, jugador) {
  const c = contexto(npc, state, jugador);
  if (now() >= (state.cd.arma ?? 0) && now() >= state.ocupadoHasta) cambiarArma(npc, state);
  if (now() < state.ocupadoHasta) return;
  ritmo(npc, state, jugador, c.dist);

  // Reacción: con IQ bajo piensa cada 1,5 s; con IQ máximo, cada 0,5 s.
  const n = nivel(state);
  if (now() < (state.cd.pensar ?? 0)) return;
  state.cd.pensar = now() + Math.round(30 - n * 20);

  const candidatos = [];
  for (const nodo of NODOS) {
    if (state.iq < nodo.iq || now() < (state.cd[nodo.id] ?? 0) || !nodo.si(c)) continue;
    const exito = state.memoria.exitos[nodo.id] ?? 0;
    candidatos.push({ nodo, p: nodo.peso(c) * (1 + exito * 0.2) });
  }
  // Cerca, a menudo lo mejor es seguir peleando cuerpo a cuerpo.
  if (c.dist < 4) candidatos.push({ nodo: null, p: 4 - n * 2 });
  const nodo = elegir(candidatos, state);
  if (!nodo) return;
  state.cd[nodo.id] = now() + Math.round(nodo.cd * (1 - n * 0.4));
  state.ultima = nodo.id;
  ACCIONES[nodo.id](npc, state, jugador);
  aprender(npc, state, 0.05);
}
