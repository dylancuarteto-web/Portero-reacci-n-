import { BlockPermutation, GameMode, system, world } from "@minecraft/server";
import { ANIM, DIMENSIONES, FUSION, IQ, NPC, PARTICLES, ROBOT_CFG } from "../config.js";
import { salirDeClase } from "../clase.js";
import { hacha, pala, pico, sostener } from "../equipo.js";
import { estados, obtenerEstado } from "../estado.js";
import { protegido } from "../estructuras.js";
import { ponerHaciendo } from "../iq.js";
import { detener, velocidad } from "../movimiento.js";
import { IRROMPIBLES } from "../obras/excavar.js";
import { terminarObra } from "../obras/index.js";
import { hostil } from "../postura.js";
import {
  animate, avisar, blockAt, distancia, mirarA, now, particleAt, reemplazable, romperDestruyendo, sound, soundAt,
  superficie,
} from "../util.js";
import { DURACION, empezarCinematica, soltarJugadores, tickCinematica } from "./cinematica.js";
import { crearRobot } from "./index.js";
import { planRobot, volumenRobot } from "./plano.js";

// Construcción del robot: cinco Claudes con IQ 500 dejan lo que estaban haciendo
// (clase, obra, mina), se reúnen cerca del jugador, despejan el sitio (talan árboles
// y quitan lo que estorbe) y entonces empieza la cinemática de 10 s (cinematica.js):
// con martillo, destornillador y llave levantan el robot pieza por pieza, lo
// encienden, los bloques se transforman en el robot de verdad y se suben.

let obra;
let buscando = false;
const conteos = new Map(); // dimensión → cuántos Claudes con IQ 500 había (para avisar)

const perm = (id, estados_) => {
  try {
    return BlockPermutation.resolve(id, estados_);
  } catch {
    return id;
  }
};

export function obraRobot() {
  return obra;
}

function promedio(lista) {
  const s = lista.reduce((a, e) => ({ x: a.x + e.location.x, y: a.y + e.location.y, z: a.z + e.location.z }), { x: 0, y: 0, z: 0 });
  return { x: s.x / lista.length, y: s.y / lista.length, z: s.z / lista.length };
}

function frenteHacia(desde, hacia) {
  const dx = hacia.x - desde.x;
  const dz = hacia.z - desde.z;
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? "east" : "west";
  return dz > 0 ? "south" : "north";
}

// Lo que se tala o se quita (árboles, plantas grandes) sin contar como suelo.
const ARBOL = /(_log|log2?|_leaves|leaves2?|_wood|mushroom_block|vine|bamboo|cactus|_stem|_hyphae|azalea|mangrove_roots)$/;

// Suelo firme en (x, z): baja desde lo más alto saltándose árboles.
function sueloEn(dim, x, z) {
  const top = superficie(dim, x, z);
  if (!top) return undefined;
  let y = top.location.y;
  for (let k = 0; k < 28; k++, y--) {
    const b = blockAt(dim, { x, y, z });
    if (!b || b.isLiquid) return undefined;
    if (!b.isAir && !reemplazable(b) && !ARBOL.test(b.typeId)) return y + 1;
  }
  return undefined;
}

// Cuántos bloques hay que quitar (undefined si hay algo que no se puede tocar).
function estorbos(dim, c, frente) {
  let n = 0;
  for (const p of volumenRobot(c, frente)) {
    const b = blockAt(dim, p);
    if (!b) return undefined;
    if (reemplazable(b)) continue;
    if (b.isLiquid || IRROMPIBLES.test(b.typeId) || protegido(p)) return undefined;
    n++;
  }
  return n;
}

// Busca (en varios ticks) un sitio a unos 13 bloques del jugador, del lado de los
// Claudes, donde se vea bien el robot. Prefiere sitios despejados; si no hay, uno
// con pocos estorbos (que despejan antes de construir).
function* buscarSitio(dim, jugador, centro, listo) {
  let mejor;
  try {
    const base = jugador ? jugador.location : centro;
    const ang0 = Math.atan2(centro.z - base.z, centro.x - base.x);
    const radios = jugador ? [13, 10, 16, 19, 8, 22] : [0, 4, 8, 12];
    const giros = [0, 0.52, -0.52, 1.05, -1.05, 1.57, -1.57, 2.1, -2.1, 2.62, -2.62, Math.PI];
    let revisados = 0;
    for (const r of radios) {
      for (const giro of giros) {
        const x = Math.floor(base.x + Math.cos(ang0 + giro) * r);
        const z = Math.floor(base.z + Math.sin(ang0 + giro) * r);
        const y = sueloEn(dim, x, z);
        yield;
        if (y === undefined || Math.abs(y - base.y) > 8) continue;
        const c = { x, y, z };
        const frente = frenteHacia(c, base);
        const n = estorbos(dim, c, frente);
        yield;
        if (n === undefined) continue;
        if (!mejor || n < mejor.n) mejor = { c, frente, n };
        if (n === 0) break;
        if (++revisados > 30 && mejor.n <= 8) break;
        if (r === 0) break;
      }
      if (mejor && (mejor.n === 0 || revisados > 30)) break;
    }
  } catch {
    // Mundo sin cargar.
  }
  listo(mejor && mejor.n <= 40 ? mejor : undefined);
}

function libreParaRobot(s, forzado) {
  return (forzado || s.iq >= IQ.robot) && !s.fusion && !s.robot && !s.robotObra && !s.reunion && !s.bote
    && (forzado || now() >= (s.cd.robot ?? 0));
}

// Deja lo que estaba haciendo para ir a construir.
function reclutar(n, s) {
  if (s.clase) salirDeClase(n, s, false);
  if (s.obra) terminarObra(n, s);
  s.mina = undefined;
  detener(n);
}

function empezar(dim, grupo, jugador, sitio) {
  obra = {
    dim, ...sitio, grupo, cantidad: grupo.length, fase: "reunion", desde: now(), plano: planRobot(sitio.c, sitio.frente, perm),
    i: 0, puestos: [], jugador, quitar: [], pasadas: 0,
  };
  grupo.forEach((n, k) => {
    const s = obtenerEstado(n);
    reclutar(n, s);
    const a = (k / grupo.length) * Math.PI * 2;
    s.robotObra = obra;
    s.reunion = { x: sitio.c.x + 0.5 + Math.cos(a) * 4, y: sitio.c.y, z: sitio.c.z + 0.5 + Math.sin(a) * 4 };
    s.reunionDesde = now();
    ponerHaciendo(n, s, "§b¡a construir el robot!");
  });
  if (jugador) {
    try {
      jugador.onScreenDisplay.setTitle(`§b§l¡IQ 500 × ${grupo.length}!`, { subtitle: "§fLos Claudes van a construir algo enorme...",
        fadeInDuration: 8, stayDuration: 50, fadeOutDuration: 12 });
    } catch {
      // Sin título.
    }
  }
}

// Avisa cuántos faltan cuando cambia el número de Claudes con IQ 500.
function avisarConteo(dimId, dim, lista) {
  const genios = lista.filter((n) => (estados.get(n.id)?.iq ?? 0) >= IQ.robot);
  const n = genios.length;
  if (conteos.get(dimId) === n) return;
  const antes = conteos.get(dimId) ?? 0;
  conteos.set(dimId, n);
  if (n <= antes || n >= ROBOT_CFG.cantidad || !n) return;
  const donde = promedio(genios);
  avisar(dim, donde, `§c(${n}/${ROBOT_CFG.cantidad}) §fClaudes con IQ 500 para construir el robot`, 64);
}

// Cada 2 s: con cinco Claudes de IQ 500 libres (y que no sean cinco de IQ 1000, que
// esos se fusionan).
export function revisarRobot() {
  if (obra || buscando) return;
  for (const id of DIMENSIONES) {
    let lista;
    const dim = world.getDimension(id);
    try {
      lista = dim.getEntities({ type: NPC });
    } catch {
      continue;
    }
    avisarConteo(id, dim, lista);
    const genios = lista.filter((n) => {
      const s = estados.get(n.id);
      return s && libreParaRobot(s, false);
    });
    if (genios.length < ROBOT_CFG.cantidad) continue;
    if (genios.filter((n) => estados.get(n.id).iq >= FUSION.iq).length >= FUSION.cantidad) continue;
    const centro = promedio(genios);
    let jugador;
    try {
      [jugador] = dim.getPlayers({ location: centro, maxDistance: 160, closest: 1, excludeGameModes: [GameMode.Spectator] });
    } catch {
      jugador = undefined;
    }
    buscando = true;
    system.runJob(buscarSitio(dim, jugador, centro, (sitio) => {
      buscando = false;
      if (!sitio || obra) return;
      const grupo = genios.filter((n) => n.isValid && estados.get(n.id) && libreParaRobot(estados.get(n.id), false))
        .sort((a, b) => distancia(a.location, sitio.c) - distancia(b.location, sitio.c)).slice(0, ROBOT_CFG.cantidad);
      if (grupo.length >= ROBOT_CFG.cantidad) empezar(dim, grupo, jugador, sitio);
    }));
    return;
  }
}

// /claudenpc:robot: los Claudes más cercanos (hasta cinco, con cualquier IQ) lo
// construyen ahora mismo. Devuelve el mensaje para el jugador.
export function forzarRobot(jugador) {
  if (obra || buscando) return "§eYa están construyendo un robot.";
  let lista = [];
  try {
    lista = jugador.dimension.getEntities({ type: NPC, location: jugador.location, maxDistance: 48 });
  } catch {
    lista = [];
  }
  const grupo = lista.filter((n) => libreParaRobot(obtenerEstado(n), true))
    .sort((a, b) => distancia(a.location, jugador.location) - distancia(b.location, jugador.location)).slice(0, ROBOT_CFG.cantidad);
  if (!grupo.length) return "§cNo hay Claudes libres cerca (a 48 bloques).";
  buscando = true;
  system.runJob(buscarSitio(jugador.dimension, jugador, promedio(grupo), (sitio) => {
    buscando = false;
    if (obra) return;
    if (!sitio) {
      try {
        jugador.sendMessage("§cNo encontraron sitio para el robot (necesita suelo firme sin agua).");
      } catch {
        // Jugador desconectado.
      }
      return;
    }
    empezar(jugador.dimension, grupo.filter((n) => n.isValid), jugador, sitio);
  }));
  return `§b${grupo.length} Claude(s) van a construir el robot.`;
}

function liberar(o) {
  for (const n of o.grupo) {
    const s = estados.get(n.id);
    if (!s || s.robotObra !== o) continue;
    s.robotObra = undefined;
    s.reunion = undefined;
    s.reunionDesde = undefined;
    if (n.isValid) ponerHaciendo(n, s, "");
  }
}

function cancelar(o) {
  if (o.cine) soltarJugadores(o);
  // Deshace lo que alcanzaron a poner.
  for (const p of o.puestos) {
    try {
      const b = blockAt(o.dim, p);
      if (b && !b.isAir) b.setType("minecraft:air");
    } catch {
      // Chunk descargado.
    }
  }
  liberar(o);
  obra = undefined;
}

const idDe = (b) => (typeof b === "string" ? b : b.type.id);

// Lista de lo que hay que quitar, de arriba abajo (así la arena o la grava no caen encima).
function listarEstorbos(o) {
  return volumenRobot(o.c, o.frente).filter((p) => {
    const b = blockAt(o.dim, p);
    return b && !reemplazable(b) && !b.isLiquid && !IRROMPIBLES.test(b.typeId) && !protegido(p);
  }).sort((a, b) => b.y - a.y);
}

function herramienta(n, s, b) {
  if (ARBOL.test(b.typeId) || /planks|fence|wood/.test(b.typeId)) return hacha(s);
  if (/dirt|grass|sand|gravel|clay|mud|snow|podzol|mycelium/.test(b.typeId)) return pala(s);
  return pico(s);
}

function empezarConstruccion(o) {
  o.fase = "cinematica";
  o.desde = now();
  for (const n of o.grupo) {
    const s = estados.get(n.id);
    if (s) ponerHaciendo(n, s, "§bconstruyendo el robot");
  }
  // La ven todos los jugadores, estén donde estén (los que están lejos se llevan un
  // momento al sitio y al terminar vuelven a donde estaban).
  let jugadores = [];
  try {
    jugadores = world.getPlayers();
  } catch {
    jugadores = [];
  }
  empezarCinematica(o, jugadores);
}

// Los bloques se transforman en el robot de verdad y los cinco se suben.
function transformar(o, vivos) {
  for (const p of o.puestos) {
    try {
      const b = blockAt(o.dim, p);
      if (b && !b.isAir) b.setType("minecraft:air");
    } catch {
      // Chunk descargado.
    }
  }
  const mira = o.jugador?.isValid ? o.jugador.location : undefined;
  crearRobot(o.dim, { x: o.c.x + 0.5, y: o.c.y, z: o.c.z + 0.5 }, mira, vivos, { cinematica: true });
}

system.runInterval(() => {
  const o = obra;
  if (!o) return;
  try {
    const vivos = o.grupo.filter((n) => n.isValid && estados.get(n.id)?.robotObra === o);
    if (vivos.length < o.cantidad) return cancelar(o);
    const t = now() - o.desde;
    if (o.fase === "reunion") {
      const listos = vivos.filter((n) => {
        const s = estados.get(n.id);
        return s.reunion && Math.hypot(n.location.x - s.reunion.x, n.location.z - s.reunion.z) < 3;
      }).length;
      if (listos >= o.cantidad || t > 700) {
        o.desde = now();
        for (const n of vivos) {
          const s = estados.get(n.id);
          s.reunion = undefined;
          detener(n);
          velocidad(n, 0);
          hostil(n, s, false);
        }
        o.quitar = listarEstorbos(o);
        if (o.quitar.length) {
          o.fase = "despejar";
          for (const n of vivos) ponerHaciendo(n, estados.get(n.id), "§bdespejando el sitio");
        } else empezarConstruccion(o);
      }
      return;
    }
    if (o.fase === "despejar") {
      // Talan y quitan lo que estorba, un bloque cada 4 ticks, por turnos.
      if (t % 4 !== 0) return;
      const p = o.quitar.shift();
      if (!p) {
        o.quitar = o.pasadas++ < 1 ? listarEstorbos(o) : [];
        if (!o.quitar.length) empezarConstruccion(o);
        return;
      }
      const b = blockAt(o.dim, p);
      if (!b || reemplazable(b) || b.isLiquid) return;
      const n = vivos[o.quitar.length % vivos.length];
      const s = estados.get(n.id);
      sostener(n, herramienta(n, s, b));
      mirarA(n, { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 });
      animate(n, ANIM.minar);
      romperDestruyendo(o.dim, p);
      return;
    }
    if (o.fase === "cinematica") {
      // 10 s: piezas con herramientas, efectos, cámaras y transformación (cinematica.js).
      if (tickCinematica(o, vivos, () => transformar(o, vivos)) || now() - o.desde > DURACION + 40) {
        if (o.cine?.t < DURACION) soltarJugadores(o);
        liberar(o);
        obra = undefined;
      }
    }
  } catch {
    cancelar(o);
  }
}, 1);
