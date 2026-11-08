import { EquipmentSlot, ItemStack, system, world } from "@minecraft/server";
import { desprotegerJugador, protegerJugador } from "../dano.js";
import { BLANCO, bloquear, camara, fundido, NEGRO, particula, soltar, sonar, vivos } from "../golden/final/comun.js";
import { enCinematica } from "../robot/cinematica.js";
import { flat, mirarA, now } from "../util.js";
import { gesto } from "./animacion.js";
import { bajarEscudo } from "./armas.js";
import { terminarCombo } from "./combos.js";
import { PART_INF } from "./config.js";
import { pararTodo } from "./movimiento.js";

// Cinemática de la fase 20 (INFINITE DETERMINATION), inspirada en el meme de la gráfica del
// poder que crece de forma exponencial. El arte es propio (garabatos hechos para el add-on).
//   1. Fundido; Claude Exponencial Infinito pone su cara estilo Saitama y el jugador al que
//      enfrenta, una máscara estilo Garou. Toma por encima del hombro del jugador.
//   2. La gráfica: fondo negro con cuadrícula y ejes PODER (Y) / TIEMPO (X). Se dibujan dos
//      curvas con su cara subiendo por la punta: la del jugador (máscara) crece despacio y la
//      del Infinito (Saitama) va por debajo hasta que se dispara hacia arriba; arriba, un
//      destello blanco y, a su lado, "TOP 1" en letras rojas con borde negro (sin marco).
//   3. Choque de puños de lado, con energía roja, temblor de cámara y otra vez "TOP 1".
//   4. Fundido y vuelve la pelea (el jugador recupera su casco; el Infinito, su cara).
// Mientras dura, el Infinito es intocable y los jugadores no se mueven ni reciben daño.

export const MASCARA = "claudenpc:mascara_garou";
// Medidas de la gráfica (las mismas que CINE en source/v100_assets.py): la cámara mira la
// gráfica a "dg" bloques y el fondo está a "db"; la gráfica mide 2w × 2h bloques.
const CINE = { dg: 20, db: 26, w: 16, h: 9 };
const T = { cara: 4, tomaA: 6, evolucion: 10, flash: 50, grafica: 56, curvas: 60, finCurvas: 140, destello: 140, top1: 148,
  finGrafica: 196, choque: 202, impacto: 210, top1b: 214, fin: 262, salida: 268 };
const N = 40; // segmentos de cada curva

const enCurso = new Map(); // id del Infinito → cinemática

export function enCinematicaInf(s) {
  return !!s.cine;
}

// --- Máscara del jugador ---------------------------------------------------------------
// El casco que tenga se guarda en un hueco libre de su inventario (si se corta la cinemática,
// lo sigue teniendo ahí). Sin hueco libre no se le pone la máscara.
function ponerMascara(p) {
  try {
    const eq = p.getComponent("minecraft:equippable");
    const inv = p.getComponent("minecraft:inventory")?.container;
    if (!eq || !inv) return undefined;
    const casco = eq.getEquipment(EquipmentSlot.Head);
    let hueco;
    if (casco) {
      for (let i = 0; i < inv.size; i++) {
        if (!inv.getItem(i)) {
          hueco = i;
          break;
        }
      }
      if (hueco === undefined) return undefined;
      inv.setItem(hueco, casco);
    }
    eq.setEquipment(EquipmentSlot.Head, new ItemStack(MASCARA, 1));
    return { hueco, tipo: casco?.typeId };
  } catch {
    return undefined;
  }
}

function quitarMascara(p, info) {
  try {
    const eq = p.getComponent("minecraft:equippable");
    if (!eq) return;
    if (eq.getEquipment(EquipmentSlot.Head)?.typeId === MASCARA) eq.setEquipment(EquipmentSlot.Head, undefined);
    if (info?.hueco === undefined) return;
    const inv = p.getComponent("minecraft:inventory")?.container;
    const casco = inv?.getItem(info.hueco);
    if (casco?.typeId === info.tipo) {
      inv.setItem(info.hueco, undefined);
      eq.setEquipment(EquipmentSlot.Head, casco);
    }
  } catch {
    // Jugador no disponible.
  }
}

// --- Geometría de la gráfica --------------------------------------------------------------
const sumar = (a, b, k = 1) => ({ x: a.x + b.x * k, y: a.y + (b.y ?? 0) * k, z: a.z + b.z * k });

function punto(c, u, v, cerca = 0) {
  const d = CINE.dg - cerca;
  const k = d / CINE.dg;
  return { x: c.C.x + c.F.x * d + c.R.x * u * CINE.w * k, y: c.C.y + v * CINE.h * k, z: c.C.z + c.F.z * d + c.R.z * u * CINE.w * k };
}

// Curva del jugador (crece despacio) y del Infinito (va por debajo y se dispara).
function curvaG(k) {
  const t = k / N;
  return { u: -0.92 + 1.77 * t, v: -0.88 + (0.75 * (Math.exp(2.2 * t) - 1)) / (Math.exp(2.2) - 1) };
}

function curvaS(k) {
  const t = k / N;
  return { u: -0.92 + 1.37 * t, v: -0.9 + (1.82 * (Math.exp(5.5 * t) - 1)) / (Math.exp(5.5) - 1) };
}

// Altura para la cámara de la gráfica: cielo libre a lo largo de la vista.
function alturaLibre(dim, M, F) {
  const tope = dim.heightRange.max - 4;
  for (const h of [28, 40, 60, 90]) {
    const y = Math.min(tope, M.y + h);
    let libre = true;
    for (const d of [0, 8, 16, 26]) {
      try {
        const b = dim.getBlock({ x: M.x + F.x * d, y, z: M.z + F.z * d });
        if (b && !b.isAir) {
          libre = false;
          break;
        }
      } catch {
        // Sin cargar: cuenta como aire.
      }
    }
    if (libre) return y;
  }
  return tope;
}

// --- Inicio y fin ----------------------------------------------------------------------------
export function iniciarCinematica(e, s) {
  if (s.cine) return true;
  let jugadores = [];
  try {
    jugadores = e.dimension.getPlayers({ location: e.location, maxDistance: 48 }).filter((p) => !enCinematica.has(p.id));
  } catch {
    jugadores = [];
  }
  if (!jugadores.length) return false;
  let objetivo = s.objetivo?.typeId === "minecraft:player" ? jugadores.find((p) => p.id === s.objetivo.id) : undefined;
  if (!objetivo) {
    objetivo = jugadores.reduce((a, b) => (Math.hypot(b.location.x - e.location.x, b.location.z - e.location.z)
      < Math.hypot(a.location.x - e.location.x, a.location.z - e.location.z) ? b : a));
  }
  if (s.combo) terminarCombo(e, s, false);
  bajarEscudo(e, s);
  pararTodo(e, s);
  s.atacar = false;
  s.comiendo = false;
  const F0 = flat(objetivo.location, e.location);
  const F = { x: F0.x, y: 0, z: F0.z };
  const R = { x: -F.z, y: 0, z: F.x };
  const M = { x: (e.location.x + objetivo.location.x) / 2, y: (e.location.y + objetivo.location.y) / 2, z: (e.location.z + objetivo.location.z) / 2 };
  const C = { x: M.x, y: alturaLibre(e.dimension, M, F), z: M.z };
  s.cine = { t0: now(), jugadores, objetivo, F, R, M, C, mascara: undefined };
  enCurso.set(e.id, s);
  s.presentacionHasta = now() + T.salida + 20;
  bloquear(jugadores);
  fundido(jugadores, NEGRO, 0.2, 0.25, 0.45);
  for (const p of jugadores) protegerJugador(p, 60);
  return true;
}

function terminar(e, s) {
  const c = s.cine;
  if (!c) return;
  s.cine = undefined;
  enCurso.delete(s.id);
  soltar(vivos(c.jugadores));
  for (const p of vivos(c.jugadores)) desprotegerJugador(p); // sin la Resistencia de la cinemática
  if (c.objetivo?.isValid) quitarMascara(c.objetivo, c.mascara);
  try {
    if (e.isValid) e.triggerEvent("claudenpc:cara_0");
  } catch {
    // Entidad descargada.
  }
  s.presentacionHasta = now() + 10;
  for (const p of vivos(c.jugadores)) {
    try {
      p.onScreenDisplay.setTitle("§4§lINFINITE DETERMINATION", { subtitle: "§cFase 20", fadeInDuration: 5, stayDuration: 30, fadeOutDuration: 12 });
    } catch {
      // Jugador no disponible.
    }
  }
}

// --- Cada tick ---------------------------------------------------------------------------
export function tickCinematica(e, s) {
  const c = s.cine;
  if (!c) return false;
  const t = now() - c.t0;
  const jugadores = vivos(c.jugadores);
  if (!e.isValid || !jugadores.length) {
    terminar(e, s);
    return false;
  }
  const dim = e.dimension;
  if (t % 20 === 0) for (const p of jugadores) protegerJugador(p, 40);
  const obj = c.objetivo?.isValid ? c.objetivo : undefined;
  if (obj) mirarA(e, obj.getHeadLocation());

  // 1. Las caras y la toma por encima del hombro.
  if (t === T.cara) {
    try {
      e.triggerEvent("claudenpc:cara_1");
    } catch {
      // Sin cara.
    }
    if (obj) c.mascara = ponerMascara(obj);
  }
  if (t === T.tomaA && obj) {
    const P = obj.getHeadLocation();
    const desde = sumar(sumar(sumar(P, c.F, -2.8), c.R, 0.9), { x: 0, y: 1, z: 0 }, 0.5);
    const hasta = sumar(sumar(sumar(P, c.F, -1.7), c.R, 0.6), { x: 0, y: 1, z: 0 }, 0.3);
    camara(jugadores, desde, e.getHeadLocation(), 2.2, hasta);
  }
  if (t === T.evolucion) {
    gesto(e, s, "evolucion", true);
    particula(dim, PART_INF.evolucion, { x: e.location.x, y: e.location.y + 1, z: e.location.z });
    sonar(jugadores, "beacon.power", 0.8, 1);
  }
  if (t === T.flash) fundido(jugadores, BLANCO, 0.15, 0.1, 0.3);

  // 2. La gráfica.
  if (t === T.grafica) {
    camara(jugadores, c.C, punto(c, 0, 0));
    particula(dim, "claudenpc:cine_fondo", { x: c.C.x + c.F.x * CINE.db, y: c.C.y, z: c.C.z + c.F.z * CINE.db },
      { "variable.vida": (T.finGrafica - T.grafica) / 20 + 0.3 });
    sonar(jugadores, "random.orb", 0.5, 0.8);
  }
  if (t >= T.curvas && t < T.finCurvas) {
    const paso = (t - T.curvas) / 2;
    const vida = (T.finGrafica - t) / 20;
    if (Number.isInteger(paso)) {
      for (const curva of [curvaG, curvaS]) {
        const a = curva(paso);
        const b = curva(paso + 1);
        trazo(dim, punto(c, a.u, a.v), punto(c, b.u, b.v), vida);
      }
    }
    // Las caras suben por la punta de cada curva.
    const g = curvaG(paso + 1);
    const sx = curvaS(paso + 1);
    particula(dim, "claudenpc:cine_cara_g", punto(c, g.u, g.v, 0.3), { "variable.vida": 0.12, "variable.escala": 1.5 });
    particula(dim, "claudenpc:cine_cara_s", punto(c, sx.u, sx.v, 0.3), { "variable.vida": 0.12, "variable.escala": 1.5 });
    if (t % 10 === 0) sonar(jugadores, "note.hat", 0.8 + (t - T.curvas) / 80, 0.5);
  }
  if (t === T.destello) {
    const fin = curvaS(N);
    const g = curvaG(N);
    const vida = (T.finGrafica - t) / 20;
    particula(dim, "claudenpc:cine_destello", punto(c, fin.u, fin.v, 0.6), { "variable.vida": 1.6 });
    particula(dim, "claudenpc:cine_cara_s", punto(c, fin.u, fin.v, 0.8), { "variable.vida": vida, "variable.escala": 2 });
    particula(dim, "claudenpc:cine_cara_g", punto(c, g.u, g.v, 0.3), { "variable.vida": vida, "variable.escala": 1.6 });
    fundido(jugadores, BLANCO, 0.05, 0.05, 0.35);
    sonar(jugadores, "random.explode", 1.3, 0.6);
    sonar(jugadores, "beacon.activate", 1.2, 1);
  }
  if (t === T.top1) {
    const fin = curvaS(N);
    particula(dim, "claudenpc:cine_top1", punto(c, fin.u + 0.42, fin.v - 0.06, 0.8), { "variable.vida": (T.finGrafica - t) / 20, "variable.escala": 2 });
    sonar(jugadores, "random.anvil_land", 0.6, 0.7);
    sonar(jugadores, "mob.enderdragon.growl", 1.3, 0.5);
  }
  if (t === T.finGrafica) fundido(jugadores, NEGRO, 0.2, 0.15, 0.35);

  // 3. El choque de puños, de lado.
  if (t === T.choque && obj) {
    const mid = { x: (e.location.x + obj.location.x) / 2, y: (e.location.y + obj.location.y) / 2 + 1.3, z: (e.location.z + obj.location.z) / 2 };
    camara(jugadores, sumar(sumar(mid, c.R, 5.5), { x: 0, y: 1, z: 0 }, 0.4), mid, 2.4, sumar(sumar(mid, c.R, 4.3), { x: 0, y: 1, z: 0 }, 0.3));
    gesto(e, s, "pesado", true);
    try {
      e.applyImpulse({ x: -c.F.x * 0.35, y: 0, z: -c.F.z * 0.35 });
    } catch {
      // Sin impulso.
    }
  }
  if (t === T.impacto && obj) {
    const E = e.getHeadLocation();
    const P = obj.getHeadLocation();
    const I = { x: E.x + (P.x - E.x) * 0.6, y: (E.y + P.y) / 2 - 0.3, z: E.z + (P.z - E.z) * 0.6 };
    particula(dim, "claudenpc:cine_rojo", I, { "variable.escala": 0.7 });
    particula(dim, PART_INF.golpe, I);
    particula(dim, PART_INF.anillo, I);
    particula(dim, "minecraft:huge_explosion_emitter", I);
    sonar(jugadores, "random.explode", 0.8, 0.8);
    sonar(jugadores, "mob.irongolem.hit", 0.6, 1);
    for (const p of jugadores) {
      try {
        p.runCommand("camerashake add @s 0.6 0.8 positional");
      } catch {
        // Sin temblor.
      }
    }
    try {
      obj.applyKnockback({ x: -c.F.x * 0.9, z: -c.F.z * 0.9 }, 0.3);
    } catch {
      // Sin empuje.
    }
  }
  if (t === T.top1b) {
    // "TOP 1" al lado de su cabeza (a la derecha de la cámara de esta toma).
    const derecha = { x: c.R.z, y: 0, z: -c.R.x };
    const H = e.getHeadLocation();
    particula(dim, "claudenpc:cine_top1", sumar(sumar(H, derecha, 1.25), { x: 0, y: 1, z: 0 }, 0.45),
      { "variable.vida": 2.4, "variable.escala": 0.42 });
    sonar(jugadores, "random.anvil_land", 0.5, 0.6);
  }
  if (t === T.fin) fundido(jugadores, NEGRO, 0.25, 0.2, 0.5);
  if (t >= T.salida) {
    terminar(e, s);
    return false;
  }
  return true;
}

// Un trazo blanco de la curva (una partícula estirada entre dos puntos).
function trazo(dim, a, b, vida) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const largo = Math.hypot(dx, dy, dz);
  if (largo < 0.01) return;
  particula(dim, "claudenpc:cine_trazo", { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 },
    { "variable.dir": { x: dx / largo, y: dy / largo, z: dz / largo }, "variable.largo": largo, "variable.vida": vida, "variable.grosor": 0.1 });
}

// Si el Infinito desaparece a mitad de la cinemática, nadie queda congelado ni con la máscara.
world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
  const s = enCurso.get(removedEntityId);
  if (!s) return;
  system.run(() => terminar(s.e, s));
});

// Al entrar al mundo: si quedó con la máscara de una cinemática que se cortó, se la quita (su
// casco está en su inventario).
world.afterEvents.playerSpawn.subscribe(({ player }) => {
  system.runTimeout(() => {
    if (!player.isValid || enCinematica.has(player.id)) return;
    for (const s of enCurso.values()) if (s.cine?.objetivo?.id === player.id) return;
    try {
      const eq = player.getComponent("minecraft:equippable");
      if (eq?.getEquipment(EquipmentSlot.Head)?.typeId === MASCARA) eq.setEquipment(EquipmentSlot.Head, undefined);
    } catch {
      // Jugador no disponible.
    }
  }, 40);
});

// Para las pruebas y /claudenpc:infinito_info.
export const TIEMPOS_CINE = T;
