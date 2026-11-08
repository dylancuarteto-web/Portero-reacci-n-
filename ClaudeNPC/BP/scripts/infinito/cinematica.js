import { EquipmentSlot, system, world } from "@minecraft/server";
import { desprotegerJugador, protegerJugador } from "../dano.js";
import { BLANCO, bloquear, camara, fundido, NEGRO, particula, soltar, sonar, vivos } from "../golden/final/comun.js";
import { enCinematica } from "../robot/cinematica.js";
import { flat, mirarA, now, run } from "../util.js";
import { gesto } from "./animacion.js";
import { bajarEscudo, vestirFase } from "./armas.js";
import { terminarCombo } from "./combos.js";
import { PART_INF } from "./config.js";
import { pararTodo } from "./movimiento.js";
import { actualizarNombre } from "./personalidad.js";
import { guardar } from "./registro.js";

// Cinemática de la fase 20 (INFINITE DETERMINATION), inspirada en el meme de la gráfica del
// poder que crece de forma exponencial (el arte es propio).
//   1. Fundido y toma por encima del hombro del jugador: el Infinito junta su determinación.
//   2. La gráfica: fondo negro con cuadrícula y ejes PODER (Y) / TIEMPO (X). Se dibujan dos
//      curvas y en la punta de cada una sube una cabeza de verdad: la del jugador, con su
//      propia skin, crece despacio; la de Claude va por debajo hasta que se dispara hacia
//      arriba. Arriba, un destello y, a su lado, "TOP 1" en letras rojas con borde negro (sin
//      marco). Para eso el jugador y el Infinito suben a la gráfica y una animación les agranda
//      la cabeza hasta que encierra el cuerpo: solo se ve la cabeza. Mientras tanto el casco
//      del jugador se guarda en su inventario (para que se vea su cara).
//   3. Fundido: cada uno vuelve a su lugar y chocan los puños, de lado, con energía roja,
//      temblor de cámara y otra vez "TOP 1".
//   4. Fundido y vuelve la pelea.
// Mientras dura, el Infinito es intocable y los jugadores no se mueven ni reciben daño.

// Medidas de la gráfica (las mismas que CINE en source/v100_assets.py): la cámara mira la
// gráfica a "dg" bloques y el fondo está a "db"; la gráfica mide 2w × 2h bloques.
const CINE = { dg: 20, db: 26, w: 16, h: 9 };
const T = { tomaA: 6, evolucion: 10, flash: 50, grafica: 56, curvas: 60, finCurvas: 140, destello: 140, top1: 148,
  finGrafica: 196, vuelta: 200, choque: 202, impacto: 210, top1b: 214, fin: 262, salida: 268 };
const N = 40; // segmentos de cada curva

// Cabezas grandes (RP/animations/cine_cabezas.animation.json, de source/v100_assets.py): la
// cabeza crece y baja hasta que su centro queda a 15 px de los pies, así encierra el cuerpo.
export const CABEZA = {
  ctrl: "claudenpc_cine_cabeza",
  jugador: "animation.claudenpc.cine.cabeza_jugador", // ×5
  claude: "animation.claudenpc.cine.cabeza_claude", // ×5
  claudeTop: "animation.claudenpc.cine.cabeza_claude_top", // ×7, desde el destello
  ninguna: "animation.claudenpc.cine.cabeza_ninguna",
  centro: 15 / 16, // bloques de los pies al centro de la cabeza grande
};
// La cabeza de Claude va 3 bloques más cerca de la cámara: las dos curvas salen del mismo
// punto y así las cabezas no se cruzan al empezar.
const CERCA = { jugador: 0, claude: 3 };
// En el jugador: dónde estaba y dónde quedó su casco, por si sale del mundo a media toma.
export const PROP_VUELTA = "claudenpc:cine_vuelta";

const enCurso = new Map(); // id del Infinito → estado

// --- Casco del jugador -------------------------------------------------------------------
// Se guarda en un hueco libre de su inventario para que se vea su cara (sin hueco libre se
// queda puesto). Si la toma se corta, lo sigue teniendo en el inventario.
function guardarCasco(p) {
  try {
    const eq = p.getComponent("minecraft:equippable");
    const inv = p.getComponent("minecraft:inventory")?.container;
    const casco = eq?.getEquipment(EquipmentSlot.Head);
    if (!casco || !inv) return undefined;
    for (let i = 0; i < inv.size; i++) {
      if (inv.getItem(i)) continue;
      inv.setItem(i, casco);
      eq.setEquipment(EquipmentSlot.Head, undefined);
      return { hueco: i, tipo: casco.typeId };
    }
  } catch {
    // Jugador no disponible.
  }
  return undefined;
}

function devolverCasco(p, info) {
  if (!info) return;
  try {
    const eq = p.getComponent("minecraft:equippable");
    const inv = p.getComponent("minecraft:inventory")?.container;
    if (!eq || !inv || eq.getEquipment(EquipmentSlot.Head)) return;
    const casco = inv.getItem(info.hueco);
    if (casco?.typeId !== info.tipo) return;
    inv.setItem(info.hueco, undefined);
    eq.setEquipment(EquipmentSlot.Head, casco);
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

// Curva del jugador (crece despacio) y de Claude (va por debajo y se dispara).
function curvaG(k) {
  const t = k / N;
  return { u: -0.92 + 1.77 * t, v: -0.88 + (0.75 * (Math.exp(2.2 * t) - 1)) / (Math.exp(2.2) - 1) };
}

function curvaS(k) {
  const t = k / N;
  return { u: -0.92 + 1.37 * t, v: -0.9 + (1.82 * (Math.exp(5.5 * t) - 1)) / (Math.exp(5.5) - 1) };
}

function esAire(dim, q) {
  try {
    const b = dim.getBlock(q);
    return !b || b.isAir;
  } catch {
    return true; // sin cargar o fuera del mundo
  }
}

// Altura para la cámara de la gráfica: cielo libre a lo largo de la vista y donde van las
// cabezas (las esquinas de la gráfica y las puntas de las curvas).
function alturaLibre(dim, M, F, R) {
  const tope = dim.heightRange.max - 4;
  const muestras = [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1], [-0.92, -0.88], [0.85, -0.13], [0.45, 0.92]];
  for (const h of [28, 40, 60, 90]) {
    const y = Math.min(tope, M.y + h);
    const c = { C: { x: M.x, y, z: M.z }, F, R };
    const puntos = [0, 8, 16, 26].map((d) => ({ x: M.x + F.x * d, y, z: M.z + F.z * d }));
    for (const [u, v] of muestras) puntos.push(punto(c, u, v, 0), punto(c, u, v, CERCA.claude));
    if (puntos.every((q) => esAire(dim, q))) return y;
  }
  return tope;
}

// --- Las cabezas en la gráfica --------------------------------------------------------------
function animarCabeza(x, anim) {
  try {
    x.playAnimation(anim, { controller: CABEZA.ctrl, blendOutTime: 0 });
  } catch {
    // Paquete de recursos no activo o entidad descargada.
  }
}

// Pone a alguien con el centro de su cabeza grande en "centro", mirando hacia la cámara.
function aLaGrafica(x, centro, giro) {
  try {
    x.teleport({ x: centro.x, y: centro.y - CABEZA.centro, z: centro.z }, { rotation: { x: 0, y: giro } });
  } catch {
    // Sin teletransporte este tick.
  }
}

// Sube al Infinito y al jugador a la gráfica (sin casco, nombre ni aura, para que se vean las caras).
function subir(e, s, c) {
  const toma = T.vuelta - T.grafica + 40;
  s.vuelta = { x: e.location.x, y: e.location.y, z: e.location.z, ry: e.getRotation().y };
  guardar(s);
  run(e, "replaceitem entity @s slot.armor.head 0 minecraft:air");
  try {
    e.nameTag = "";
    e.triggerEvent("claudenpc:aura_0");
    e.addEffect("slow_falling", toma, { amplifier: 0, showParticles: false });
  } catch {
    // Entidad descargada.
  }
  animarCabeza(e, CABEZA.claude);
  const p = c.objetivo?.isValid ? c.objetivo : undefined;
  if (p) {
    const r = p.getRotation();
    c.vueltaJugador = { dim: p.dimension.id, x: p.location.x, y: p.location.y, z: p.location.z, rx: r.x, ry: r.y };
    c.casco = guardarCasco(p);
    try {
      p.setDynamicProperty(PROP_VUELTA, JSON.stringify({ ...c.vueltaJugador, casco: c.casco }));
      p.addEffect("slow_falling", toma, { amplifier: 0, showParticles: false });
    } catch {
      // Jugador no disponible.
    }
    animarCabeza(p, CABEZA.jugador);
  }
  c.enGrafica = true;
}

// Cada tick: cada cabeza va en la punta de su curva (antes de empezar, en el origen; al
// terminar, arriba de su curva).
function moverCabezas(e, c, t) {
  const k = Math.max(0, Math.min(N, (t - T.curvas) / 2 + 1));
  const sc = curvaS(k);
  aLaGrafica(e, punto(c, sc.u, sc.v, CERCA.claude), c.giro);
  if (c.vueltaJugador && c.objetivo?.isValid) {
    const g = curvaG(k);
    aLaGrafica(c.objetivo, punto(c, g.u, g.v, CERCA.jugador), c.giro);
  }
}

// Cada uno vuelve a su lugar, con su cabeza normal, su casco, su nombre y su aura.
function bajar(e, s, c) {
  if (!c.enGrafica) return;
  c.enGrafica = false;
  if (e.isValid) {
    animarCabeza(e, CABEZA.ninguna);
    const v = s.vuelta;
    try {
      if (v) e.teleport({ x: v.x, y: v.y, z: v.z }, { rotation: { x: 0, y: v.ry ?? 0 } });
      e.removeEffect("slow_falling");
      if (s.fase >= 20) e.triggerEvent("claudenpc:aura_1");
    } catch {
      // Entidad descargada.
    }
    s.armadura = -2; // se vuelve a poner la armadura de su fase (con el casco)
    vestirFase(e, s);
    s.nombre = "";
    actualizarNombre(e, s, true);
  }
  s.vuelta = undefined;
  guardar(s);
  const p = c.objetivo;
  const v = c.vueltaJugador;
  if (!p?.isValid || !v) return;
  animarCabeza(p, CABEZA.ninguna);
  try {
    p.teleport({ x: v.x, y: v.y, z: v.z }, { dimension: world.getDimension(v.dim), rotation: { x: v.rx, y: v.ry } });
    p.removeEffect("slow_falling");
    p.setDynamicProperty(PROP_VUELTA, undefined);
  } catch {
    // Jugador no disponible.
  }
  devolverCasco(p, c.casco);
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
  const C = { x: M.x, y: alturaLibre(e.dimension, M, F, R), z: M.z };
  // Las cabezas miran hacia la cámara (la gráfica está delante de ella, en la dirección F).
  const giro = (Math.atan2(F.x, -F.z) * 180) / Math.PI;
  s.cine = { t0: now(), jugadores, objetivo, F, R, M, C, giro, enGrafica: false };
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
  bajar(e, s, c); // si se cortó con ellos arriba, cada uno vuelve a su lugar
  s.cine = undefined;
  enCurso.delete(s.id);
  soltar(vivos(c.jugadores));
  for (const p of vivos(c.jugadores)) desprotegerJugador(p); // sin la Resistencia de la cinemática
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
  if (obj && !c.enGrafica) mirarA(e, obj.getHeadLocation());

  // 1. Toma por encima del hombro del jugador: junta su determinación.
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

  // 2. La gráfica, con la cabeza de Claude y la del jugador (su skin) en las puntas.
  if (t === T.grafica) {
    camara(jugadores, c.C, punto(c, 0, 0));
    particula(dim, "claudenpc:cine_fondo", { x: c.C.x + c.F.x * CINE.db, y: c.C.y, z: c.C.z + c.F.z * CINE.db },
      { "variable.vida": (T.vuelta - T.grafica) / 20 + 0.3 });
    subir(e, s, c);
    sonar(jugadores, "random.orb", 0.5, 0.8);
  }
  if (c.enGrafica) moverCabezas(e, c, t);
  if (t >= T.curvas && t < T.finCurvas) {
    const paso = (t - T.curvas) / 2;
    const vida = (T.vuelta - t) / 20;
    if (Number.isInteger(paso)) {
      for (const curva of [curvaG, curvaS]) {
        const a = curva(paso);
        const b = curva(paso + 1);
        trazo(dim, punto(c, a.u, a.v), punto(c, b.u, b.v), vida);
      }
    }
    if (t % 10 === 0) sonar(jugadores, "note.hat", 0.8 + (t - T.curvas) / 80, 0.5);
  }
  if (t === T.destello) {
    const fin = curvaS(N);
    // Detrás de la cabeza de Claude (que va más cerca de la cámara): brilla a su alrededor.
    particula(dim, "claudenpc:cine_destello", punto(c, fin.u, fin.v, 0.6), { "variable.vida": 1.6 });
    animarCabeza(e, CABEZA.claudeTop); // llegó arriba: su cabeza crece un poco más
    fundido(jugadores, BLANCO, 0.05, 0.05, 0.35);
    sonar(jugadores, "random.explode", 1.3, 0.6);
    sonar(jugadores, "beacon.activate", 1.2, 1);
  }
  if (t === T.top1) {
    const fin = curvaS(N);
    // A la derecha de la cabeza de Claude (ya agrandada), sin tocarla.
    particula(dim, "claudenpc:cine_top1", punto(c, fin.u + 0.56, fin.v - 0.06, 0.8), { "variable.vida": (T.vuelta - t) / 20, "variable.escala": 2 });
    sonar(jugadores, "random.anvil_land", 0.6, 0.7);
    sonar(jugadores, "mob.enderdragon.growl", 1.3, 0.5);
  }
  if (t === T.finGrafica) fundido(jugadores, NEGRO, 0.2, 0.15, 0.35);
  if (t === T.vuelta) bajar(e, s, c); // con la pantalla en negro

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

// Si el Infinito desaparece a mitad de la cinemática, nadie queda congelado ni en el cielo.
world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
  const s = enCurso.get(removedEntityId);
  if (!s) return;
  system.run(() => terminar(s.e, s));
});

// Al volver a entrar al mundo (o reaparecer) después de una toma cortada: cabeza normal,
// casco en su sitio y, si entró arriba en la gráfica, de vuelta adonde estaba.
function volverDeLaGrafica(p, entro) {
  if (!p.isValid) return;
  for (const s of enCurso.values()) if (s.cine?.objetivo?.id === p.id) return; // sigue en la cinemática
  let d;
  try {
    const raw = p.getDynamicProperty(PROP_VUELTA);
    if (typeof raw === "string") d = JSON.parse(raw);
  } catch {
    d = undefined;
  }
  if (!d) return;
  try {
    p.setDynamicProperty(PROP_VUELTA, undefined);
  } catch {
    // Jugador no disponible.
  }
  animarCabeza(p, CABEZA.ninguna);
  if (entro && [d.x, d.y, d.z].every(Number.isFinite)) {
    try {
      p.teleport({ x: d.x, y: d.y, z: d.z }, { dimension: world.getDimension(d.dim), rotation: { x: d.rx ?? 0, y: d.ry ?? 0 } });
    } catch {
      // Se queda donde está.
    }
    protegerJugador(p, 60);
  }
  try {
    p.removeEffect("slow_falling");
  } catch {
    // Sin efecto.
  }
  devolverCasco(p, d.casco);
}

world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  system.run(() => volverDeLaGrafica(player, initialSpawn));
});

// Para las pruebas.
export const TIEMPOS_CINE = T;
