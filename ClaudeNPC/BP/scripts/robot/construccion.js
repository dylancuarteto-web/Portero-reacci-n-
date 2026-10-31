import { BlockPermutation, GameMode, system, world } from "@minecraft/server";
import { ANIM, DIMENSIONES, FUSION, IQ, NPC, PARTICLES, ROBOT_CFG } from "../config.js";
import { sostener } from "../equipo.js";
import { estados } from "../estado.js";
import { ponerHaciendo } from "../iq.js";
import { detener, velocidad } from "../movimiento.js";
import { hostil } from "../postura.js";
import { animate, blockAt, distancia, mirarA, now, particleAt, reemplazable, sound, soundAt, superficie } from "../util.js";
import { crearRobot } from "./index.js";
import { planRobot, volumenRobot } from "./plano.js";

// Construcción del robot: cinco Claudes con IQ 500 se reúnen cerca del jugador, levantan
// el robot con bloques (piernas, torso, brazos, lanzamisiles y cabina), lo encienden y
// los bloques se transforman en el robot de verdad, al que se suben.

let obra;

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

// Busca un sitio libre y firme a unos 14 bloques del jugador (para que lo vea construirse).
function buscarSitio(dimension, jugador, centro) {
  const base = jugador ? jugador.location : centro;
  const dx = centro.x - base.x;
  const dz = centro.z - base.z;
  const d = Math.hypot(dx, dz) || 1;
  for (const giro of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, Math.PI]) {
    for (const r of [14, 11, 17]) {
      const ang = Math.atan2(dz / d, dx / d) + giro;
      const x = Math.floor(base.x + Math.cos(ang) * (jugador ? r : 0));
      const z = Math.floor(base.z + Math.sin(ang) * (jugador ? r : 0));
      const top = superficie(dimension, x, z);
      if (!top || top.isLiquid || Math.abs(top.location.y + 1 - base.y) > 6) continue;
      const c = { x, y: top.location.y + 1, z };
      const frente = frenteHacia(c, base);
      if (volumenRobot(c, frente).every((p) => reemplazable(blockAt(dimension, p)))) return { c, frente };
      if (!jugador) return undefined;
    }
  }
  return undefined;
}

// Cada 2 s: con cinco Claudes de IQ 500 (y menos de 1000, que esos se fusionan) libres.
export function revisarRobot() {
  if (obra) return;
  for (const id of DIMENSIONES) {
    let lista;
    try {
      lista = world.getDimension(id).getEntities({ type: NPC });
    } catch {
      continue;
    }
    const genios = lista.filter((n) => {
      const s = estados.get(n.id);
      return s && s.iq >= IQ.robot && !s.clase && !s.bote && !s.fusion && !s.robot && !s.reunion && !s.obra
        && now() >= (s.cd.robot ?? 0);
    });
    if (genios.length < ROBOT_CFG.cantidad) continue;
    // Si hay cinco con IQ 1000, la fusión tiene prioridad.
    if (genios.filter((n) => estados.get(n.id).iq >= FUSION.iq).length >= FUSION.cantidad) continue;
    const dim = world.getDimension(id);
    const centro = promedio(genios);
    let jugador;
    try {
      [jugador] = dim.getPlayers({ location: centro, maxDistance: 160, closest: 1, excludeGameModes: [GameMode.Spectator] });
    } catch {
      jugador = undefined;
    }
    const sitio = buscarSitio(dim, jugador, centro);
    if (!sitio) continue;
    const grupo = [...genios].sort((a, b) => distancia(a.location, sitio.c) - distancia(b.location, sitio.c))
      .slice(0, ROBOT_CFG.cantidad).sort((a, b) => (a.id < b.id ? -1 : 1));
    obra = { dim, ...sitio, grupo, fase: "reunion", desde: now(), plano: planRobot(sitio.c, sitio.frente, perm), i: 0, puestos: [], jugador };
    grupo.forEach((n, k) => {
      const s = estados.get(n.id);
      const a = (k / grupo.length) * Math.PI * 2;
      s.robotObra = obra;
      s.reunion = { x: sitio.c.x + 0.5 + Math.cos(a) * 3.5, y: sitio.c.y, z: sitio.c.z + 0.5 + Math.sin(a) * 3.5 };
      s.reunionDesde = now();
      ponerHaciendo(n, s, "§b¡a construir el robot!");
    });
    if (jugador) {
      try {
        jugador.onScreenDisplay.setTitle("§b§l¡IQ 500 × 5!", { subtitle: "§fCinco Claudes van a construir algo enorme...",
          fadeInDuration: 8, stayDuration: 50, fadeOutDuration: 12 });
      } catch {
        // Sin título.
      }
    }
    return;
  }
}

function liberar(o) {
  for (const n of o.grupo) {
    const s = estados.get(n.id);
    if (!s) continue;
    s.robotObra = undefined;
    s.reunion = undefined;
    s.reunionDesde = undefined;
  }
}

function cancelar(o) {
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

system.runInterval(() => {
  const o = obra;
  if (!o) return;
  try {
    const vivos = o.grupo.filter((n) => n.isValid && estados.get(n.id)?.robotObra === o);
    if (vivos.length < ROBOT_CFG.cantidad) return cancelar(o);
    const t = now() - o.desde;
    if (o.fase === "reunion") {
      const listos = vivos.filter((n) => {
        const s = estados.get(n.id);
        return s.reunion && Math.hypot(n.location.x - s.reunion.x, n.location.z - s.reunion.z) < 2.5;
      }).length;
      if (listos >= ROBOT_CFG.cantidad || t > 900) {
        o.fase = "construir";
        o.desde = now();
        for (const n of vivos) {
          const s = estados.get(n.id);
          s.reunion = undefined;
          detener(n);
          velocidad(n, 0);
          hostil(n, s, false);
          ponerHaciendo(n, s, "§bconstruyendo el robot");
        }
        soundAt(o.dim, o.c, "random.anvil_use", 1, 1);
      }
      return;
    }
    if (o.fase === "construir") {
      // Un bloque cada 8 ticks, por turnos: cada Claude pone el suyo con su animación.
      if (t % 8 !== 0) return;
      const paso = o.plano[o.i];
      if (!paso) {
        o.fase = "encender";
        o.desde = now();
        soundAt(o.dim, o.c, "beacon.activate", 0.8, 1);
        return;
      }
      const n = vivos[o.i % vivos.length];
      const centro = { x: paso.pos.x + 0.5, y: paso.pos.y + 0.5, z: paso.pos.z + 0.5 };
      sostener(n, idDe(paso.bloque));
      mirarA(n, centro);
      animate(n, ANIM.colocar);
      const b = blockAt(o.dim, paso.pos);
      if (b && reemplazable(b)) {
        if (typeof paso.bloque === "string") b.setType(paso.bloque);
        else b.setPermutation(paso.bloque);
        o.puestos.push(paso.pos);
        particleAt(o.dim, PARTICLES.construir, centro);
        sound(n, /glass/.test(idDe(paso.bloque)) ? "random.glass" : "random.anvil_land", 1.6, 0.35);
      }
      o.i++;
      return;
    }
    if (o.fase === "encender") {
      // Se enciende: chispas, el núcleo brilla y los bloques se transforman en el robot.
      if (t % 4 === 0) {
        for (const p of o.puestos) if (Math.random() < 0.3) particleAt(o.dim, PARTICLES.chispaElectrica, { x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 });
      }
      if (t === 20) for (const n of vivos) animate(n, ANIM.celebrar);
      if (t < 40) return;
      for (const p of o.puestos) {
        try {
          const b = blockAt(o.dim, p);
          if (b && !b.isAir) b.setType("minecraft:air");
        } catch {
          // Chunk descargado.
        }
      }
      particleAt(o.dim, PARTICLES.fusionDestello, { x: o.c.x + 0.5, y: o.c.y + 3, z: o.c.z + 0.5 });
      soundAt(o.dim, o.c, "random.explode", 1.4, 0.6);
      const mira = o.jugador?.isValid ? o.jugador.location : undefined;
      crearRobot(o.dim, { x: o.c.x + 0.5, y: o.c.y, z: o.c.z + 0.5 }, mira, vivos);
      liberar(o);
      obra = undefined;
    }
  } catch {
    cancelar(o);
  }
}, 1);
