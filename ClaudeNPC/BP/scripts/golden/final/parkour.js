import { GameMode, system } from "@minecraft/server";
import { FINAL, GOLDEN_FINAL, PARTICLES, SONIDO } from "../../config.js";
import { blockAt, now, particleAt, soundAt } from "../../util.js";
import { danar } from "../comun.js";
import { NEGRO, cortar, forma, fundido, morada, particula, pose, sonar, vivos, yawHacia } from "./comun.js";
import { guardarFinal, participantes } from "./pelea.js";
import { columna } from "./poderes/espadas.js";
import { cambiarAMorada, sonarRayoMorado } from "./poderes/morada.js";

// Parkour de los 200 de vida (inspirado en Dusttrust): en el centro de la arena se levanta una
// torre CERRADA (pared de vidrio morado, pilar de oro al centro) con una escalera caracol de
// cubos sueltos: hay que saltar de bloque en bloque (a veces para subir, a veces en plano).
// Golden vuelve morada una espada y, desde afuera, con cortes que suenan fuerte, crea una
// INUNDACIÓN DE ENERGÍA morada (v9.0: haces rectos de láser, sin rayos en zigzag) que sube poco a
// poco desde el piso. Si te caes o vas lento, la energía te alcanza y te mata. Arriba de todo (la meta, bajo el techo) estás a salvo. Cuando
// la inundación llega arriba, la torre se deshace (bajas flotando) y sigue la pelea.

const TAU = Math.PI * 2;
const ALTO = 12; // la torre llega hasta el techo de la arena (que está en 13)
const NIVEL_MAX = 10.6; // la meta está en 10 (pisas en 11): la inundación se queda debajo
const T_TORRE = 8; // tick en que empieza a levantarse (una capa por tick)
const T_MORADA = 26;
const T_INUNDA = 48; // aparece la inundación en el piso
const CADA_CORTE = 30;

const angulo = (x, z) => ((Math.atan2(z, x) % TAU) + TAU) % TAU;

// Anillo de celdas a ~4 bloques del centro, en orden (la escalera da vueltas por él).
const ANILLO = (() => {
  const lista = [];
  for (let x = -8; x <= 8; x++) {
    for (let z = -8; z <= 8; z++) {
      const d = Math.hypot(x, z);
      if (d >= 3.4 && d < 4.6) lista.push({ x, z });
    }
  }
  return lista.sort((a, b) => angulo(a.x, a.z) - angulo(b.x, b.z));
})();

// Hueco entre dos bloques (de borde a borde).
export function hueco(a, b) {
  const dx = Math.max(0, Math.abs(a.x - b.x) - 1);
  const dz = Math.max(0, Math.abs(a.z - b.z) - 1);
  return Math.hypot(dx, dz);
}

// Escalera: 24 cubos con 10 subidas de un bloque repartidas; el resto son saltos en plano.
// Subida: hueco de 0,5 a 1 bloque. En plano: hueco de 1 a 1,5 (siempre hay que saltar).
// Arriba, dos cubos más a la misma altura: la meta.
export const ESCALERA = (() => {
  const n = 24;
  const subidas = 10;
  const L = ANILLO.length;
  /** @type {{ x: number, z: number, h: number, meta?: boolean }[]} */
  const pasos = [{ ...ANILLO[0], h: 0 }];
  let i = 0;
  let h = 0;
  for (let k = 0; k < n - 1; k++) {
    const sube = Math.floor(((k + 1) * subidas) / (n - 1)) > Math.floor((k * subidas) / (n - 1)) ? 1 : 0;
    const [lo, hi] = sube ? [0.5, 1.0] : [1.0, 1.5];
    let av = 2;
    for (const prueba of [2, 3, 4]) {
      const g = hueco(ANILLO[i % L], ANILLO[(i + prueba) % L]);
      if (g >= lo && g <= hi) {
        av = prueba;
        break;
      }
    }
    i += av;
    h += sube;
    pasos.push({ ...ANILLO[i % L], h });
  }
  for (const d of [1, 2]) pasos.push({ ...ANILLO[(i + d) % L], h, meta: true });
  return pasos;
})();

// Todos los bloques de la torre (relativos al centro de la arena; dy 0 = nivel de los pies).
export function bloquesTorre() {
  const lista = [];
  for (let x = -7; x <= 7; x++) {
    for (let z = -7; z <= 7; z++) {
      const d = Math.hypot(x, z);
      if (d >= 6 && d < 7) {
        for (let dy = 0; dy <= ALTO; dy++) {
          lista.push({ x, y: dy, z, id: dy === 0 || dy === ALTO ? "minecraft:gold_block" : "minecraft:purple_stained_glass" });
        }
      } else if (d <= 1.5) {
        for (let dy = 0; dy <= ALTO; dy++) lista.push({ x, y: dy, z, id: dy % 4 === 3 ? "minecraft:ochre_froglight" : "minecraft:gold_block" });
      }
    }
  }
  for (const p of ESCALERA) lista.push({ x: p.x, y: p.h, z: p.z, id: p.meta ? "minecraft:ochre_froglight" : "minecraft:gold_block" });
  return lista;
}

const TORRE = bloquesTorre();
const IDS_TORRE = new Set(TORRE.map((b) => b.id));

function base(f) {
  const c = f.arena?.centro ?? f.suelo ?? { x: 0, y: 0, z: 0 };
  return { x: Math.floor(c.x), y: Math.floor(c.y), z: Math.floor(c.z) };
}

function poner(dim, c, b) {
  const blk = blockAt(dim, { x: c.x + b.x, y: c.y + b.y, z: c.z + b.z });
  if (!blk || !blk.isAir) return false; // solo en aire: nunca pisa nada
  try {
    blk.setType(b.id);
    return true;
  } catch {
    return false;
  }
}

// Quita la torre (solo los bloques que son de la torre). Sirve también al cargar el mundo si
// se cerró a la mitad del parkour.
export function quitarTorre(dim, c, puestos = TORRE) {
  for (const b of puestos) {
    const blk = blockAt(dim, { x: c.x + b.x, y: c.y + b.y, z: c.z + b.z });
    try {
      if (blk && IDS_TORRE.has(blk.typeId)) blk.setType("minecraft:air");
    } catch {
      // Chunk descargado.
    }
  }
}

function enJuego(p) {
  try {
    const m = p.getGameMode();
    return p.isValid && m !== GameMode.Spectator && m !== GameMode.Creative;
  } catch {
    return false;
  }
}

function dentroTorre(c, p) {
  return Math.hypot(p.location.x - (c.x + 0.5), p.location.z - (c.z + 0.5)) < 6.2;
}

export function iniciarParkour(g) {
  const f = g.final;
  const e = g.entidad;
  f.etapa = "parkour";
  f.control = true;
  f.tp = 0;
  f.parkour = { nivel: 0.05, puestos: [], lado: Math.random() < 0.5 ? 1 : 2, fin: 0, sinNadie: 0, golpe: {}, arriba: new Set() };
  guardarFinal(g);
  const v = participantes(g).filter(enJuego);
  fundido(v, NEGRO, 0.25, 0.45, 0.6);
  sonar(v, "mob.wither.spawn", 0.6, 0.6);
  forma(e, 2);
  pose(g, 12);
}

export function tickParkour(g) {
  const f = g.final;
  const e = g.entidad;
  const dim = e.dimension;
  const P = f.parkour;
  const c = base(f);
  const t = ++f.tp;
  const v = participantes(g).filter(enJuego);
  const centro = { x: c.x + 0.5, y: c.y, z: c.z + 0.5 };
  // Golden flota afuera de la torre, mirando hacia ella, con la espada morada.
  const lugar = { x: centro.x, y: c.y + 7 + Math.sin(t * 0.08) * 0.25, z: centro.z - 10 };
  try {
    e.teleport(lugar, { rotation: { x: 8, y: yawHacia(lugar, centro) }, keepVelocity: false });
  } catch {
    // Descargado.
  }
  if (t === 6) {
    // Pantalla en negro: todos al pie de la escalera, dentro de la torre.
    v.forEach((p, k) => {
      const a = (k - (v.length - 1) / 2) * 0.35;
      const dest = { x: centro.x + Math.cos(a) * 5.1, y: c.y + 0.05, z: centro.z + Math.sin(a) * 5.1 };
      try {
        p.teleport(dest, { facingLocation: { x: c.x + ESCALERA[1].x + 0.5, y: c.y + 1, z: c.z + ESCALERA[1].z + 0.5 }, keepVelocity: false });
      } catch {
        // Jugador no disponible.
      }
    });
    // Las marionetas que estén donde va la torre salen hacia afuera.
    for (const x of f.marionetas ?? []) {
      try {
        const d = Math.hypot(x.m.location.x - centro.x, x.m.location.z - centro.z);
        if (d < 8) {
          const k = 10 / Math.max(0.5, d);
          x.m.teleport({ x: centro.x + (x.m.location.x - centro.x) * k, y: c.y + 0.1, z: centro.z + (x.m.location.z - centro.z) * k });
        }
      } catch {
        // Ya no existe.
      }
    }
  }
  // La torre se levanta una capa por tick.
  if (t >= T_TORRE && t <= T_TORRE + ALTO) {
    const dy = t - T_TORRE;
    for (const b of TORRE) if (b.y === dy && poner(dim, c, b)) P.puestos.push(b);
    soundAt(dim, { x: centro.x, y: c.y + dy, z: centro.z }, "random.anvil_land", 0.5 + dy * 0.05, 0.4);
    if (dy % 3 === 0) particleAt(dim, PARTICLES.fragmento, { x: centro.x + 6.5, y: c.y + dy, z: centro.z });
  }
  if (t === T_MORADA) cambiarAMorada(g, P.lado);
  if (t === T_INUNDA - 4) cortar(e, 0, P.lado);
  if (t === T_INUNDA) {
    try {
      P.agua = dim.spawnEntity(FINAL.inundacion, { x: centro.x, y: c.y + P.nivel, z: centro.z });
    } catch {
      P.agua = undefined;
    }
    haces(g, c, 4);
    sonarRayoMorado(dim, centro, 48);
  }
  if (t < T_INUNDA) return;
  // La inundación: quieta durante la gracia; después sube poco a poco (más rápido si todos
  // ya llegaron arriba).
  const cfg = GOLDEN_FINAL.parkourCfg;
  const todosArriba = v.length > 0 && v.every((p) => P.arriba.has(p.id));
  if (t > T_INUNDA + cfg.gracia && P.nivel < NIVEL_MAX) P.nivel = Math.min(NIVEL_MAX, P.nivel + cfg.subida * (todosArriba ? 4 : 1));
  try {
    if (P.agua?.isValid) P.agua.teleport({ x: centro.x, y: c.y + P.nivel, z: centro.z }, { keepVelocity: false });
  } catch {
    // Descargado.
  }
  // Golden corta con la espada morada: láseres que caen en la inundación (sonido fuerte).
  if ((t - T_INUNDA) % CADA_CORTE === CADA_CORTE - 4) cortar(e, Math.random() < 0.3 ? 0 : P.lado, P.lado);
  if ((t - T_INUNDA) % CADA_CORTE === 0 && t > T_INUNDA) {
    haces(g, c, 3);
    sonarRayoMorado(dim, { x: centro.x, y: c.y + P.nivel, z: centro.z }, 48);
  }
  if (t % 3 === 0) particula(dim, PARTICLES.impactoMorado, { x: centro.x + (Math.random() - 0.5) * 9, y: c.y + P.nivel, z: centro.z + (Math.random() - 0.5) * 9 });
  // Quien está debajo del nivel de la inundación recibe descargas (mata en un momento).
  for (const p of v) {
    if (!dentroTorre(c, p)) continue;
    const pies = p.location.y - c.y;
    if (pies >= NIVEL_MAX - 0.2 && pies <= ALTO) {
      if (!P.arriba.has(p.id)) {
        P.arriba.add(p.id);
        sonar([p], "random.levelup", 1.2, 1);
        particleAt(dim, PARTICLES.curacion, p.location);
      }
    }
    if (pies < P.nivel - 0.05) {
      if (t >= (P.golpe[p.id] ?? 0)) {
        P.golpe[p.id] = t + 4;
        danar(p, cfg.dano, e);
        particleAt(dim, PARTICLES.descargaMorada, { x: p.location.x, y: p.location.y + 1, z: p.location.z });
        soundAt(dim, p.location, "random.fizz", 1.4, 0.8);
      }
    } else if (pies < P.nivel + 1.5 && t % 8 === 0) {
      sonar([p], "note.bass", 0.6, 1); // aviso: la inundación está cerca
    }
  }
  // Sin nadie jugando (todos cayeron) o la inundación llegó arriba: se termina.
  P.sinNadie = v.some((p) => dentroTorre(c, p)) ? 0 : P.sinNadie + 1;
  if (!P.fin && (P.nivel >= NIVEL_MAX || P.sinNadie > 60)) P.fin = t + 40;
  if (P.fin && t >= P.fin) terminarParkour(g);
}

// Láseres morados (de adorno) que bajan desde el techo hasta la inundación, lejos de los jugadores.
function haces(g, c, n) {
  const e = g.entidad;
  const dim = e.dimension;
  const P = g.final.parkour;
  const jug = vivos(participantes(g));
  for (let i = 0; i < n; i++) {
    for (let intento = 0; intento < 6; intento++) {
      const a = Math.random() * TAU;
      const r = 1.8 + Math.random() * 3.6;
      const l = { x: c.x + 0.5 + Math.cos(a) * r, y: c.y + P.nivel, z: c.z + 0.5 + Math.sin(a) * r };
      if (jug.some((p) => Math.hypot(p.location.x - l.x, p.location.z - l.z) < 2)) continue;
      columna(dim, l, "morado", e, false, { alto: Math.max(2, 12.5 - P.nivel), grosor: 1, vida: 7 });
      break;
    }
  }
}

export function terminarParkour(g) {
  const f = g.final;
  const e = g.entidad;
  const dim = e.dimension;
  const P = f.parkour;
  const c = base(f);
  const v = participantes(g).filter(enJuego);
  // Bajan flotando: la torre se deshace.
  for (const p of v) {
    try {
      p.addEffect("slow_falling", 200, { amplifier: 0, showParticles: false });
    } catch {
      // Sin efecto.
    }
  }
  try {
    if (P?.agua?.isValid) {
      particleAt(dim, PARTICLES.fusionDestello, P.agua.location);
      P.agua.remove();
    }
  } catch {
    // Ya no existe.
  }
  const puestos = [...(P?.puestos ?? [])].sort((a, b) => b.y - a.y);
  let k = 0;
  const id = system.runInterval(() => {
    const capa = puestos.splice(0, 90);
    if (!capa.length) {
      system.clearRun(id);
      return;
    }
    quitarTorre(dim, c, capa);
    if (k++ % 2 === 0) {
      const b = capa[0];
      particleAt(dim, PARTICLES.fragmento, { x: c.x + b.x + 0.5, y: c.y + b.y, z: c.z + b.z + 0.5 });
      soundAt(dim, { x: c.x + 0.5, y: c.y + b.y, z: c.z + 0.5 }, "random.break", 0.7, 0.6);
    }
  }, 2);
  morada(g, 0);
  pose(g, 0);
  f.parkour = undefined;
  f.etapa = "pelea";
  f.control = false;
  f.parkourHecho = true;
  f.ocupadoHasta = now() + 40;
  f.cd.poder = now() + 60;
  guardarFinal(g);
  sonar(v, SONIDO.chasquido, 1, 1);
}
