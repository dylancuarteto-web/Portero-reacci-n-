import { HudVisibility, InputPermissionCategory, Player, system, world } from "@minecraft/server";
import { DIMENSIONES, FINAL, GOLDEN_FINAL } from "../../config.js";
import { enCinematica } from "../../robot/cinematica.js";
import { now } from "../../util.js";
import { ponerVida } from "../../dano.js";
import { goldens } from "../comun.js";
import { arenas, crearArena, ponerArena, revisarArenasHuerfanas, romperArena } from "./arena.js";
import { configurarCaidos, revivirCaidos } from "./caidos.js";
import { iniciarHerido, tickCine, tickHerido } from "./cine.js";
import { forma, pose } from "./comun.js";
import { iniciarMuerte, tickMuerte } from "./muerte.js";
import { orbes } from "./orbes.js";
import { cerebroFinal, empezarPelea, participantes, terminarMusica, tickPelea, vidaDe } from "./pelea.js";
import { iniciarCineEspadas, tickCineEspadas } from "./poderes/espadas.js";
import { iniciarParkour, quitarTorre, tickParkour } from "./parkour.js";
import { limpiarMarionetasHuerfanas, tickMarionetas } from "./poderes/marionetas.js";
import { descongelarTodos } from "./poderes/pausa.js";

// Fase final de Claude Golden: une las partes (herido → cinemática → batalla → espadas →
// muerte), controla su daño y reanuda la batalla si el mundo se cerró a la mitad.

export { cerebroFinal };

system.runInterval(() => {
  for (const g of goldens.values()) {
    const f = g.final;
    if (!f || !g.entidad.isValid) continue;
    try {
      switch (f.etapa) {
        case "herido":
          tickHerido(g);
          break;
        case "cine":
          tickCine(g);
          break;
        case "pelea":
          tickPelea(g);
          if (f.espadasPendiente && !f.curando && !f.definitiva) {
            f.espadasPendiente = false;
            iniciarCineEspadas(g, participantes(g));
          } else if (f.parkourPendiente && !f.curando && !f.definitiva && !f.relojes && now() >= (f.ocupadoHasta ?? 0)) {
            f.parkourPendiente = false;
            iniciarParkour(g);
          }
          break;
        case "parkour":
          tickParkour(g);
          tickMarionetas(g, participantes(g));
          break;
        case "espadas":
          tickCineEspadas(g);
          tickMarionetas(g, participantes(g));
          break;
        case "muerte":
          tickMuerte(g);
          break;
        default:
          break;
      }
    } catch {
      // Descargado a la mitad.
    }
  }
}, 1);

// Daño a Claude Golden (1.21.132: sin evento "antes del golpe"). Su sensor de daño
// (claude_golden.entity.json) lo hace intocable en las cinemáticas y curándose (etiqueta) y
// nunca deja pasar un golpe que lo mataría: avisa con "claudenpc:golpe_fatal" (golpeFatal).
// Los demás golpes ya se aplicaron y aquí se ajusta la vida (despuesDelGolpe).
export function intocable(g) {
  const f = g.final;
  return !!f && (f.etapa !== "pelea" || !!f.curando);
}

// Antes de la fase final: no baja de 10 y empieza la fase final.
function herirAntesDelFinal(g, quien, alHerir) {
  const e = g.entidad;
  if (vidaDe(e).actual < 10) ponerVida(e, 10);
  system.run(() => {
    if (g.final || !e.isValid) return;
    alHerir?.(g);
    iniciarHerido(g, quien instanceof Player ? quien : undefined);
  });
}

// Con 200 de vida, el parkour: no baja de 200 (ni muere) hasta hacerlo.
function frenarEnParkour(g) {
  const f = g.final;
  const e = g.entidad;
  if (vidaDe(e).actual < GOLDEN_FINAL.parkour) ponerVida(e, GOLDEN_FINAL.parkour);
  f.parkourPendiente = true;
  if (!f.espadasHechas) f.espadasPendiente = true;
}

// Un golpe que no lo mató. "extra": daño de más (aturdido recibe el doble).
export function despuesDelGolpe(g, extra, quien, alHerir) {
  const e = g.entidad;
  let { actual } = vidaDe(e);
  if (extra > 0) {
    if (actual - extra <= 0) {
      golpeFatal(g, quien, alHerir);
      return;
    }
    actual -= extra;
    ponerVida(e, actual);
  }
  const f = g.final;
  if (f) {
    if (intocable(g)) return;
    if (!f.parkourHecho && actual <= GOLDEN_FINAL.parkour) {
      frenarEnParkour(g);
      return;
    }
    if (!f.espadasHechas && actual <= GOLDEN_FINAL.espadas) f.espadasPendiente = true;
    return;
  }
  if (actual >= GOLDEN_FINAL.umbral) return;
  herirAntesDelFinal(g, quien, alHerir);
}

// Un golpe que lo habría matado (no se aplicó).
export function golpeFatal(g, quien, alHerir) {
  const f = g.final;
  if (f) {
    if (intocable(g)) return;
    if (!f.parkourHecho) {
      // El golpe lo habría matado: queda justo en 200 (ni más ni menos) y viene el parkour.
      if (vidaDe(g.entidad).actual > GOLDEN_FINAL.parkour) ponerVida(g.entidad, GOLDEN_FINAL.parkour);
      frenarEnParkour(g);
      return;
    }
    system.run(() => g.final?.etapa === "pelea" && iniciarMuerte(g));
    return;
  }
  ponerVida(g.entidad, Math.min(vidaDe(g.entidad).actual, 10));
  herirAntesDelFinal(g, quien, alHerir);
}

// Por si la vida bajó de 100 sin pasar por el evento (comandos, etc.).
export function revisarUmbral(g, j, alHerir) {
  if (g.final) return false;
  const { actual } = vidaDe(g.entidad);
  if (actual >= GOLDEN_FINAL.umbral || actual <= 0) return false;
  alHerir?.(g);
  iniciarHerido(g, j);
  return true;
}

// Al cargar el mundo: si estaba en la batalla final, sigue en la batalla (sin cinemática).
export function reanudarFinal(g) {
  const e = g.entidad;
  let datos;
  try {
    datos = JSON.parse(String(e.getDynamicProperty("claudenpc:final") ?? "null"));
  } catch {
    datos = null;
  }
  if (!datos) return false;
  g.final = { etapa: "pelea", t: 0, control: false, jugadores: new Set(), musica: new Set(), curando: 0, yaw: datos.yaw ?? 0,
    espadasHechas: !!datos.espadas, parkourHecho: !!datos.parkourHecho, ultimoAliento: !!datos.ultimo, ocupadoHasta: now() + 100,
    cd: { poder: now() + 100, relojes: now() + 400, pausa: now() + 500, marionetas: now() + 400, ilusiones: now() + 300, espadas: 0 } };
  if (datos.centro) {
    const a = crearArena(e.id, e.dimension, datos.centro);
    a.guardada = true;
    a.puesta = true;
    g.final.arena = a;
    g.final.suelo = { x: datos.centro.x + 0.5, y: datos.centro.y, z: datos.centro.z + 0.5 };
  }
  g.fase = 2;
  g.presentado = true;
  forma(e, datos.espadas ? 2 : 1);
  pose(g, 0);
  try {
    e.nameTag = ""; // sin nombre sobre la cabeza (en la v8.0 y v8.1 tenía uno)
  } catch {
    // Sin nombre.
  }
  if (datos.etapa === "muerte") system.run(() => iniciarMuerte(g));
  // Se cerró a la mitad del parkour: se quita la torre y el parkour vuelve a empezar.
  if (datos.parkour && datos.centro) {
    quitarTorre(e.dimension, datos.centro);
    g.final.parkourPendiente = !datos.parkourHecho;
  }
  // Objetos de la cinemática o de poderes que quedaron sueltos al cerrar el mundo.
  try {
    for (const tipo of [FINAL.corazon, FINAL.fondo, FINAL.laser, FINAL.reloj, FINAL.inundacion]) {
      for (const x of e.dimension.getEntities({ type: tipo, location: e.location, maxDistance: 128 })) x.remove();
    }
  } catch {
    // Sin entidades.
  }
  if (datos.etapa === "cine") {
    // Se cortó la cinemática: la arena aparece y empieza la batalla (con su chasquido y cura).
    system.run(() => {
      if (!e.isValid || !g.final) return;
      if (g.final.arena) ponerArena(g.final.arena);
      empezarPelea(g);
    });
  }
  return true;
}

// Si muere sin pasar por su final (por ejemplo con /kill): la arena se rompe igual y los
// caídos vuelven.
export function finalInterrumpido(g) {
  const f = g?.final;
  if (!f || f.etapa === "terminada") return;
  f.etapa = "terminada";
  if (f.arena) romperArena(f.arena, 3);
  terminarMusica(g);
  const c = f.arena?.centro ?? g.entidad.location;
  revivirCaidos(g.entidad.id, { x: c.x + 0.5, y: c.y, z: c.z + 0.5, dim: g.entidad.dimension });
}

function hayBatalla(id) {
  const g = goldens.get(id);
  return !!g?.final && g.final.etapa !== "terminada" && g.entidad.isValid;
}

configurarCaidos(
  (p) => {
    for (const g of goldens.values()) {
      if (g.final && ["pelea", "espadas", "parkour", "muerte"].includes(g.final.etapa) && g.final.jugadores.has(p.id)) return g.entidad.id;
    }
    return undefined;
  },
  (batalla) => {
    const g = goldens.get(batalla);
    if (!g || !hayBatalla(batalla)) return undefined;
    const c = g.final.arena?.centro ?? g.entidad.location;
    return { x: c.x + 0.5, y: c.y, z: c.z + 0.5, dim: g.entidad.dimension };
  },
);

// Al entrar al mundo nadie queda congelado, con niebla gris o sin poder moverse por una
// cinemática que se cortó.
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  system.runTimeout(() => {
    if (!player.isValid || enCinematica.has(player.id)) return;
    descongelarTodos([player]);
    try {
      player.camera.clear();
      player.onScreenDisplay.setHudVisibility(HudVisibility.Reset);
      for (const c of [InputPermissionCategory.Movement, InputPermissionCategory.Camera, InputPermissionCategory.Jump]) {
        player.inputPermissions.setPermissionCategory(c, true);
      }
    } catch {
      // Jugador no disponible.
    }
  }, 30);
});

// Limpieza: objetos de la fase final que quedaron sueltos (mundo cerrado a la mitad) y
// arenas sin su Golden.
const SUELTOS = [FINAL.corazon, FINAL.fondo, FINAL.reloj, FINAL.laser, FINAL.inundacion];
let revisiones = 0;
system.runInterval(() => {
  revisiones++;
  const enCurso = [...goldens.values()].some((g) => g.final && g.final.etapa !== "terminada");
  const vigentes = new Set();
  for (const g of goldens.values()) {
    for (const x of g.final?.marionetas ?? []) vigentes.add(x.m.id);
  }
  for (const id of DIMENSIONES) {
    try {
      const dim = world.getDimension(id);
      if (!enCurso) {
        for (const tipo of SUELTOS) for (const e of dim.getEntities({ type: tipo })) e.remove();
      }
      for (const e of dim.getEntities({ type: FINAL.orbe })) if (!orbes.has(e.id)) e.remove();
      limpiarMarionetasHuerfanas(dim, vigentes);
    } catch {
      // Dimensión sin cargar.
    }
  }
  if (revisiones >= 2) revisarArenasHuerfanas((id) => hayBatalla(id) || arenas.has(id));
}, 200);
