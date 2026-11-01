import { system, world } from "@minecraft/server";
import { ANIM, ARMAS, COMBATE, EXCAVAR, MODIFICA_MUNDO, NPC, VELOCIDAD } from "./config.js";
import { aguaDelante, subirABote } from "./bote.js";
import { cavar, trampa } from "./construccion.js";
import { armaInicial, sostener } from "./equipo.js";
import { bajarEscudo } from "./escudo.js";
import { estados } from "./estado.js";
import { nivelHab } from "./habilidades.js";
import { usarPocion } from "./habilidades/quimica.js";
import { usarRedstone } from "./habilidades/redstone.js";
import { usarReflejo } from "./habilidades/reflejos.js";
import { aprender, nivel } from "./iq.js";
import { caminarA, detener, ritmo, seAtasco } from "./movimiento.js";
import { iniciarExcavar, muroDelante } from "./obras/excavar.js";
import { iniciarPuente } from "./obras/puente.js";
import { iniciarTorre } from "./obras/torre.js";
import {
  arco, bloquePropio, elytraMartillo, hayBorde, martillazo, perla, saltarAlVacio,
} from "./tacticas.js";
import { animate, now, rand, sortear, sound } from "./util.js";

// Nodos de decisión: cada situación tiene varias alternativas. El IQ desbloquea
// nodos, acorta el tiempo de reacción; la memoria de lo que le funcionó (y lo que
// aprendió en clase) y su personalidad cambian la probabilidad de cada una.
// "hab": la habilidad que también lo desbloquea (aunque tenga poco IQ) y que lo hace
// más probable a más nivel. Reflejos y pociones solo se usan si se estudiaron.
const NODOS = [
  // El jugador sube para escapar: construir, disparar, volar o teletransportarse.
  // Construir es lo mejor: la torre gana a casi todo cuando estás arriba y cerca.
  { id: "torre", iq: 70, hab: "torres", cd: 18, si: (c) => c.alto > 1.8 && c.dist < 7 && MODIFICA_MUNDO, peso: (c) => 6 + (c.alto > 3 ? 3 : 0) },
  // Hay un hueco o agua entre los dos: puente o bote.
  { id: "puente", iq: 70, cd: 24, si: (c) => c.borde && c.dist > 2.5 && Math.abs(c.alto) < 4 && MODIFICA_MUNDO, peso: () => 5 },
  { id: "bote", iq: 70, cd: 200, si: (c) => c.agua && c.dist > 4 && MODIFICA_MUNDO, peso: () => 5 },
  { id: "arco", iq: 70, hab: "arco", cd: 50, si: (c) => c.dist > 9 || c.alto > 3, peso: (c) => 2.5 + (c.dist > 15 ? 2 : 0) + c.mem.torres * 0.3 },
  { id: "elytra", iq: 125, hab: "vuelo", cd: 500, si: (c) => (c.alto > 4 || c.dist > 16) && c.cielo, peso: (c) => 1.5 + c.mem.torres * 0.5 },
  { id: "perla", iq: 85, hab: "perlas", cd: 220, si: (c) => c.dist > 14 || c.alto > 5, peso: (c) => 1.2 + c.mem.arco * 0.4 },
  // El jugador está abajo: saltar con water drop o cavar.
  { id: "vacio", iq: 100, cd: 160, si: (c) => c.alto < -5 && c.dist < 10 && c.borde, peso: () => 3 },
  { id: "cavar", iq: 70, cd: 16, si: (c) => c.alto < -3 && c.dist < 4 && MODIFICA_MUNDO, peso: () => 2 },
  // Cerca: salto con maza; con más IQ, trampas y torretas.
  { id: "martillazo", iq: 75, cd: 140, si: (c) => c.dist < 5 && c.alto > -1 && c.alto < 2, peso: () => 1.5 },
  { id: "torreta", iq: 110, hab: "redstone", cd: 1100, si: (c) => c.dist > 7 && c.dist < 18 && MODIFICA_MUNDO, peso: () => 0.8 },
  { id: "trampa", iq: 120, hab: "redstone", cd: 700, si: (c) => c.dist > 4 && c.dist < 12 && MODIFICA_MUNDO, peso: () => 0.8 },
  // Habilidades de clase: reflejos (señuelos de luz) y pociones de química.
  { id: "reflejo", iq: Infinity, hab: "reflejos", cd: 260, si: (c) => c.dist > 2 && c.dist < 12, peso: () => 2.4 },
  { id: "pocion", iq: Infinity, hab: "quimica", cd: 340, si: (c) => c.dist < 18, peso: () => 1.6 },
];

const ACCIONES = {
  torre: (npc, s, j) => iniciarTorre(npc, s, j.location.y, bloquePropio(s)),
  puente: (npc, s, j) => iniciarPuente(npc, s, j.location, bloquePropio(s)),
  bote: (npc, s, j) => subirABote(npc, s, j.location),
  arco, perla, martillazo,
  elytra: elytraMartillo,
  vacio: saltarAlVacio,
  cavar: (npc, s) => cavar(npc, s),
  torreta: (npc, s, j) => usarRedstone(npc, s, j),
  reflejo: (npc, s, j) => usarReflejo(npc, s, j),
  pocion: (npc, s, j) => usarPocion(npc, s, j),
  trampa: (npc, s, j) => trampa(npc, j),
};

// Cambia de arma de vez en cuando; casi siempre vuelve a una espada.
function cambiarArma(npc, state) {
  state.arma = armaInicial(state.arma);
  sostener(npc, ARMAS[state.arma].id);
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

// ¿Avanza hacia el jugador? Si lleva un rato sin acercarse, está atascado.
function atascado(state, c) {
  const p = state.progreso;
  if (!p || c.dist < p.d - 0.7 || c.dist > p.d + 3) {
    state.progreso = { d: c.dist, t: now() };
    return false;
  }
  return now() - p.t > EXCAVAR.atascado && c.dist > 2.2 && Math.abs(c.alto) < 2.5;
}

// Va directo hacia ti: si la IA del juego no lo acerca (o perdió tu rastro), corre con su
// propio paso (abre puertas, sube escalones y busca rodeos). De cerca pelea normal.
function perseguir(npc, state, jugador, c) {
  if (c.dist < 4.5) {
    if (state.persigue) {
      state.persigue = false;
      detener(npc);
    }
    return;
  }
  const a = state.acerca;
  if (!a || c.dist < a.d - 0.6 || c.dist > a.d + 4) {
    state.acerca = { d: c.dist, t: now() };
    if (!state.persigue && c.dist < 14) return; // la IA lo está acercando: la deja
  } else if (!state.persigue && now() - a.t < 12 && c.dist < 14) return;
  if (now() < (state.cd.perseguir ?? 0)) return;
  state.cd.perseguir = now() + 8;
  state.persigue = true;
  const l = jugador.location;
  caminarA(npc, { x: l.x, y: l.y, z: l.z }, VELOCIDAD.correr);
}

export function tickCombate(npc, state, jugador) {
  const c = contexto(npc, state, jugador);
  // Para el Robot multi: cuánto lleva sin poder alcanzarte (estás arriba) o atascado.
  if (c.alto > 2.5 && c.dist < 18) state.sinAlcanceDesde ??= now();
  else state.sinAlcanceDesde = undefined;
  if (c.dist < 4) state.atascadoDesde = undefined;
  if (now() >= (state.cd.arma ?? 0) && now() >= state.ocupadoHasta && !state.escudoArriba) cambiarArma(npc, state);
  if (now() < state.ocupadoHasta) return;
  ritmo(npc, state, jugador, c.dist);
  if (state.escudoArriba) return; // cubriéndose: avanza despacio, sin otras tácticas

  // Pared del jugador delante (o lleva rato atascado): la rompe con la herramienta adecuada.
  if (MODIFICA_MUNDO) {
    const muro = muroDelante(npc, jugador);
    const at = muro !== "jugador" && atascado(state, c);
    if (at || seAtasco(npc)) state.atascadoDesde ??= now();
    if (muro === "jugador" || (at && c.dist < 24)) {
      state.progreso = undefined;
      state.persigue = false;
      iniciarExcavar(npc, state, jugador);
      return;
    }
  }
  perseguir(npc, state, jugador, c);

  // Reacción rápida: con IQ bajo piensa cada 0,7 s; con IQ máximo, cada 0,3 s.
  const n = nivel(state);
  if (now() < (state.cd.pensar ?? 0)) return;
  // Cálculo 3: reacción todavía más veloz.
  state.cd.pensar = now() + Math.round((14 - n * 8) * (nivelHab(npc, state, "calculo") >= 3 ? 0.7 : 1));

  const candidatos = [];
  const estilo = state.pers?.estilo ?? {};
  for (const nodo of NODOS) {
    const nh = nodo.hab ? nivelHab(npc, state, nodo.hab) : 0;
    if ((state.iq < nodo.iq && nh <= 0) || now() < (state.cd[nodo.id] ?? 0) || !nodo.si(c)) continue;
    const exito = state.memoria.exitos[nodo.id] ?? 0;
    candidatos.push({ nodo, p: nodo.peso(c) * (1 + exito * 0.2) * (estilo[nodo.id] ?? 1) * (1 + nh * 0.25) });
  }
  // Cerca, a menudo lo mejor es seguir peleando con la espada.
  if (c.dist < 4) candidatos.push({ nodo: null, p: 4 - n * 2 });
  if (!candidatos.length) return;
  const { nodo } = sortear(candidatos);
  if (!nodo) return;
  state.cd[nodo.id] = now() + Math.round(nodo.cd * (1 - n * 0.4));
  state.ultima = nodo.id;
  ACCIONES[nodo.id](npc, state, jugador);
  aprender(npc, state, 0.05);
}

// Animación de ataque según el arma: espadazo (alternando derecha e izquierda),
// hachazo o estocada con el tridente. Baja el escudo para golpear.
function animacionGolpe(state) {
  const tipo = (ARMAS[state.arma] ?? ARMAS[0]).tipo;
  if (tipo === "hacha") return ANIM.hachazo;
  if (tipo === "tridente") return ANIM.estocada;
  state.reves = !state.reves;
  return state.reves ? ANIM.espadazo2 : ANIM.espadazo;
}

export function animarGolpe(npc) {
  const s = estados.get(npc.id);
  if (!s || now() - (s.ultimoGolpe ?? -100) < 6) return;
  s.ultimoGolpe = now();
  bajarEscudo(npc, s, 12);
  animate(npc, animacionGolpe(s));
  sound(npc, "game.player.attack.strong", 0.9 + Math.random() * 0.2, 0.7);
}

// Cada golpe cuerpo a cuerpo del Claude (la IA del juego decide cuándo) se anima.
world.afterEvents.entityHitEntity.subscribe(({ damagingEntity }) => {
  if (damagingEntity?.typeId !== NPC) return;
  system.run(() => damagingEntity.isValid && animarGolpe(damagingEntity));
});
