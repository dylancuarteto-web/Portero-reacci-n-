import { BlockPermutation, system } from "@minecraft/server";
import { ANIM, MULTI_CFG, NPC, PARTICLES, PROP } from "../config.js";
import { sostener } from "../equipo.js";
import { estados } from "../estado.js";
import { nivel, ponerHaciendo } from "../iq.js";
import { caminarA, caminando, deslizar, detener, seAtasco, velocidad } from "../movimiento.js";
import { hostil, sentarse } from "../postura.js";
import { perlaHasta } from "../tacticas.js";
import { animate, avisar, blockAt, distancia, ESCALON, nombreDireccion, now, particleAt, reemplazable, sound, soundAt } from "../util.js";
import { encender, guardar, multis, nombrar, poner } from "./index.js";

// Un Claude repara al Robot multi cuando se queda sin batería (o lo dejaste sin energía):
//   1. va hasta el robot, lo levanta y lo lleva a un lugar seguro (lejos de ti, o a su casa);
//   2. se hace una silla y una mesa, se sienta y estudia cómo repararlo (libro, ideas);
//   3. saca su batería 3D, se la mete al robot y el robot se carga (la barra se llena);
//   4. el robot se enciende y vuelve a lo que hacía (o descansa); el Claude recoge sus
//      muebles y sigue con lo suyo.

const reparaciones = new Map(); // id del robot → reparación

function perm(id, estados_) {
  try {
    return BlockPermutation.resolve(id, estados_);
  } catch {
    return id;
  }
}

function libre(b) {
  return !!b && (b.isAir || reemplazable(b));
}

function firme(b) {
  return !!b && !b.isAir && !b.isLiquid && !reemplazable(b);
}

// ¿Este Claude puede dejar lo que hace para reparar el robot?
function disponible(s) {
  return !!s && !s.fusion && !s.robot && !s.robotObra && !s.multiObra && !s.clase && !s.reparacion && !s.reunion && !s.bote
    && !s.casa && !s.obra && !s.mina && !s.sentado;
}

// Suelo firme cerca de (x, z), buscando desde arriba de "y" hacia abajo.
function sueloCerca(dim, x, y, z) {
  for (let h = Math.floor(y) + 10; h >= Math.floor(y) - 14; h--) {
    const b = blockAt(dim, { x, y: h, z });
    if (!firme(b)) continue;
    if (libre(blockAt(dim, { x, y: h + 1, z })) && libre(blockAt(dim, { x, y: h + 2, z }))) return h + 1;
    return undefined; // hay algo encima: no sirve
  }
  return undefined;
}

// Lugar seguro: su casa si la tiene cerca y no hay nadie encima; si no, unos 16 bloques
// en dirección contraria al jugador más cercano; sin jugadores cerca, ahí mismo.
function lugarSeguro(npc) {
  const dim = npc.dimension;
  const l = npc.location;
  let jugadores = [];
  try {
    jugadores = dim.getPlayers({ location: l, maxDistance: 40 });
  } catch {
    jugadores = [];
  }
  const s = estados.get(npc.id);
  if (s?.hogar && distancia(s.hogar, l) < 64 && jugadores.every((j) => distancia(j.location, s.hogar) > 14)) {
    return { x: s.hogar.x + 0.5, y: s.hogar.y, z: s.hogar.z + 2.5, casa: true };
  }
  if (!jugadores.length) return { x: l.x, y: l.y, z: l.z };
  const j = jugadores.sort((a, b) => distancia(a.location, l) - distancia(b.location, l))[0];
  const dx = l.x - j.location.x;
  const dz = l.z - j.location.z;
  const d = Math.hypot(dx, dz) || 1;
  for (const ang of [0, 0.5, -0.5, 1, -1, 1.6, -1.6]) {
    const ux = (dx / d) * Math.cos(ang) - (dz / d) * Math.sin(ang);
    const uz = (dx / d) * Math.sin(ang) + (dz / d) * Math.cos(ang);
    const x = Math.floor(l.x + ux * MULTI_CFG.lejosSeguro);
    const z = Math.floor(l.z + uz * MULTI_CFG.lejosSeguro);
    const y = sueloCerca(dim, x, l.y, z);
    if (y === undefined) continue;
    const bajo = blockAt(dim, { x, y: y - 1, z });
    if (bajo?.isLiquid) continue;
    return { x: x + 0.5, y, z: z + 0.5 };
  }
  return { x: l.x, y: l.y, z: l.z };
}

// Mesa (valla con placa de presión encima) delante, silla (escalón) donde se sienta y el
// robot al otro lado de la mesa. Busca una orientación con sitio.
const DIRS = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
function disposicion(dim, base) {
  for (let intento = 0; intento < 3; intento++) {
    const S = { x: base.x + (intento === 1 ? 1 : intento === 2 ? -1 : 0), y: base.y, z: base.z };
    for (const F of DIRS) {
      const celdas = [0, 1, 2].map((k) => ({ x: S.x + F.x * k, y: S.y, z: S.z + F.z * k }));
      const ok = celdas.every((c) => libre(blockAt(dim, c)) && libre(blockAt(dim, { x: c.x, y: c.y + 1, z: c.z }))
        && firme(blockAt(dim, { x: c.x, y: c.y - 1, z: c.z })));
      if (ok) return { silla: celdas[0], mesa: celdas[1], robot: celdas[2], F };
    }
  }
  return undefined;
}

function poner_(dim, pos, bloque) {
  const b = blockAt(dim, pos);
  if (!libre(b)) return false;
  try {
    if (typeof bloque === "string") b.setType(bloque);
    else b.setPermutation(bloque);
    return true;
  } catch {
    return false;
  }
}

function herramienta(npc, v) {
  try {
    npc.setProperty(PROP.herramienta, v);
  } catch {
    // Sin propiedad.
  }
}

function soltarRobot(rep) {
  const r = rep.r;
  r.cargadoPor = undefined;
  r.reparacion = undefined;
}

function quitarMuebles(rep) {
  for (const p of rep.muebles.splice(0).reverse()) {
    try {
      const b = blockAt(rep.npc.dimension, p);
      if (b && !b.isAir) b.setType("minecraft:air");
    } catch {
      // Chunk descargado.
    }
  }
}

function terminar(rep, motivo) {
  reparaciones.delete(rep.r.e.id);
  const { npc, r } = rep;
  const s = estados.get(npc.id);
  if (rep.fase !== "fin") quitarMuebles(rep);
  if (npc.isValid) {
    herramienta(npc, 0);
    if (s?.sentado) sentarse(npc, s, false);
  }
  if (s?.reparacion === rep) {
    s.reparacion = undefined;
    if (npc.isValid) ponerHaciendo(npc, s, "");
  }
  if (r.e.isValid) {
    soltarRobot(rep);
    if (r.cargando && r.bateria < 100) {
      poner(r, "cargando", false);
      if (r.bateria >= 30) encender(r);
    }
    if (motivo) r.reparaEn = now() + 200; // otro Claude lo intentará después
    nombrar(r);
  }
}

// --- Fases ----------------------------------------------------------------------------------

function ir(rep, s) {
  const { npc, r } = rep;
  ponerHaciendo(npc, s, "§b¡voy a reparar el robot multi!");
  if (distancia(npc.location, r.e.location) < 2.2) {
    detener(npc);
    rep.fase = "levantar";
    rep.t = 0;
    return;
  }
  if (rep.t > 500) {
    perlaHasta(npc, { x: r.e.location.x + 1, y: r.e.location.y, z: r.e.location.z }); // tarda mucho: llega con una perla
    rep.t = 0;
    return;
  }
  if (!caminando(npc)) {
    velocidad(npc, 0);
    if (!caminarA(npc, r.e.location, 0.27) && rep.t > 120) rep.t = 501;
  }
}

function levantar(rep) {
  const { npc, r } = rep;
  animate(npc, ANIM.levantarBloque);
  sound(npc, "random.anvil_use", 1.6, 0.5);
  r.cargadoPor = npc;
  r.texto = "un Claude me lleva a un lugar seguro";
  nombrar(r);
  rep.seguro = lugarSeguro(npc);
  rep.fase = "llevar";
  rep.t = 0;
  avisar(npc.dimension, npc.location, "§bUn Claude levanta al Robot multi apagado: ¡lo lleva a un lugar seguro para repararlo!", 32);
}

function llevar(rep, s) {
  const { npc } = rep;
  ponerHaciendo(npc, s, "§bllevando el robot a un lugar seguro");
  const lejos = Math.hypot(npc.location.x - rep.seguro.x, npc.location.z - rep.seguro.z);
  if (lejos < 1.5 || rep.t > 600 || (seAtasco(npc) && rep.t > 60)) {
    detener(npc);
    rep.fase = "taller";
    rep.t = 0;
    return;
  }
  if (!caminando(npc)) {
    velocidad(npc, 0);
    if (!caminarA(npc, rep.seguro, 0.24)) rep.t += 40; // no puede ir: al rato se queda donde está
  }
}

function taller(rep, s) {
  const { npc, r } = rep;
  const dim = npc.dimension;
  if (rep.t === 2) {
    const base = { x: Math.floor(npc.location.x), y: Math.floor(npc.location.y), z: Math.floor(npc.location.z) };
    rep.lugar = disposicion(dim, base);
    // Deja el robot en el suelo (al otro lado de la mesa, o a su lado si no hay sitio).
    const dest = rep.lugar ? rep.lugar.robot : { x: base.x + 2, y: base.y, z: base.z };
    r.cargadoPor = undefined;
    try {
      r.e.teleport({ x: dest.x + 0.5, y: dest.y, z: dest.z + 0.5 }, { keepVelocity: false, facingLocation: { x: base.x + 0.5, y: base.y + 1, z: base.z + 0.5 } });
    } catch {
      // Sin teletransporte.
    }
    soundAt(dim, r.e.location, "random.anvil_land", 1.3, 0.4);
    r.texto = "un Claude prepara su taller";
    nombrar(r);
    ponerHaciendo(npc, s, "§bhaciendo una silla y una mesa");
  }
  const L = rep.lugar;
  if (!L) {
    if (rep.t >= 6) {
      rep.fase = "estudiar";
      rep.t = 0;
    }
    return;
  }
  const atras = nombreDireccion(-L.F.x, -L.F.z);
  const piezas = [
    { pos: L.mesa, bloque: "minecraft:oak_fence" },
    { pos: { x: L.mesa.x, y: L.mesa.y + 1, z: L.mesa.z }, bloque: "minecraft:wooden_pressure_plate" },
    { pos: L.silla, bloque: perm("minecraft:oak_stairs", { weirdo_direction: ESCALON[atras], upside_down_bit: false }) },
  ];
  const k = [6, 14, 22].indexOf(rep.t);
  if (k >= 0) {
    const p = piezas[k];
    try {
      npc.teleport(npc.location, { facingLocation: { x: p.pos.x + 0.5, y: p.pos.y + 0.5, z: p.pos.z + 0.5 } });
    } catch {
      // Sin giro.
    }
    animate(npc, ANIM.colocar);
    if (poner_(dim, p.pos, p.bloque)) {
      rep.muebles.push(p.pos);
      sound(npc, "use.wood", 1, 0.8);
      particleAt(dim, PARTICLES.construir, { x: p.pos.x + 0.5, y: p.pos.y + 0.5, z: p.pos.z + 0.5 });
    }
  }
  if (rep.t >= 28) {
    rep.fase = "estudiar";
    rep.t = 0;
  }
}

function estudiar(rep, s) {
  const { npc, r } = rep;
  const dim = npc.dimension;
  const L = rep.lugar;
  if (rep.t === 2) {
    rep.dur = Math.round(MULTI_CFG.estudio * (1 - nivel(s) * 0.4));
    sostener(npc, "minecraft:book");
    if (L) {
      // Se sienta en la silla mirando la mesa y el robot.
      const asiento = { x: L.silla.x + 0.5 - L.F.x * 0.18, y: L.silla.y + 0.5, z: L.silla.z + 0.5 - L.F.z * 0.18 };
      try {
        npc.teleport(asiento, { facingLocation: { x: L.robot.x + 0.5, y: asiento.y + 1.2, z: L.robot.z + 0.5 }, checkForBlocks: false });
      } catch {
        // Sin teletransporte.
      }
      sentarse(npc, s, true);
    }
    r.texto = "un Claude estudia cómo repararme";
    nombrar(r);
    avisar(dim, npc.location, "§bEl Claude se sienta a estudiar cómo reparar el Robot multi...", 32);
  }
  const pct = Math.min(99, Math.floor((rep.t / Math.max(1, rep.dur ?? 1)) * 100));
  if (rep.t % 20 === 0) ponerHaciendo(npc, s, `§bestudiando cómo reparar el robot ${pct}%`);
  if (rep.t % 12 === 0) {
    animate(npc, ANIM.tomarNotas);
    // Glifos que van del robot al libro, como cuando se encanta algo.
    const o = { x: r.e.location.x, y: r.e.location.y + 1.4, z: r.e.location.z };
    const c = { x: npc.location.x, y: npc.location.y + 1.1, z: npc.location.z };
    for (let k = 1; k <= 4; k++) {
      const f = k / 5;
      particleAt(dim, "minecraft:enchanting_table_particle", { x: o.x + (c.x - o.x) * f, y: o.y + (c.y - o.y) * f, z: o.z + (c.z - o.z) * f });
    }
  }
  if (rep.t % 40 === 0) {
    particleAt(dim, PARTICLES.idea, { x: npc.location.x, y: npc.location.y + 2.2, z: npc.location.z });
    sound(npc, "item.book.page_turn", 1, 0.8);
  }
  if (rep.t >= (rep.dur ?? 200)) {
    sentarse(npc, s, false);
    avisar(dim, npc.location, "§bEl Claude: ¡ya sé cómo repararlo! Le hace falta una batería nueva.", 32);
    particleAt(dim, PARTICLES.idea, { x: npc.location.x, y: npc.location.y + 2.2, z: npc.location.z });
    sound(npc, "random.levelup", 1.6, 0.6);
    rep.fase = "bateria";
    rep.t = 0;
  }
}

function bateria(rep, s) {
  const { npc, r } = rep;
  if (rep.t === 2) {
    // Saca la batería 3D y va hasta el robot.
    sostener(npc, "minecraft:air");
    herramienta(npc, 4);
    ponerHaciendo(npc, s, "§b¡a meterle la batería!");
    const rl = r.e.location;
    const dx = npc.location.x - rl.x;
    const dz = npc.location.z - rl.z;
    const d = Math.hypot(dx, dz) || 1;
    deslizar(npc, { x: rl.x + (dx / d) * 1.3 + (-dz / d) * 0.9, y: rl.y, z: rl.z + (dz / d) * 1.3 + (dx / d) * 0.9 }, 10);
  }
  if (rep.t === 14) {
    try {
      npc.teleport(npc.location, { facingLocation: { x: r.e.location.x, y: r.e.location.y + 1.2, z: r.e.location.z } });
    } catch {
      // Sin giro.
    }
    animate(npc, ANIM.apretar);
    soundAt(npc.dimension, r.e.location, "random.anvil_use", 1.8, 0.6);
  }
  if (rep.t === 24) {
    herramienta(npc, 0);
    poner(r, "cargando", true);
    soundAt(npc.dimension, r.e.location, "beacon.power_select", 1.2, 1);
    particleAt(npc.dimension, PARTICLES.chispaElectrica, { x: r.e.location.x, y: r.e.location.y + 1.4, z: r.e.location.z });
    avisar(npc.dimension, npc.location, "§bEl Claude le mete una batería nueva al Robot multi: ¡se está cargando!", 32);
    rep.fase = "cargar";
    rep.t = 0;
  }
}

function cargar(rep, s) {
  const { npc, r } = rep;
  const dim = npc.dimension;
  r.bateria = Math.min(100, r.bateria + (100 / MULTI_CFG.carga) * 2);
  if (rep.t % 4 === 0) {
    const l = r.e.location;
    particleAt(dim, PARTICLES.chispaElectrica, { x: l.x + (Math.random() - 0.5), y: l.y + 0.6 + Math.random() * 1.4, z: l.z + (Math.random() - 0.5) });
    nombrar(r);
  }
  if (rep.t % 8 === 0) soundAt(dim, r.e.location, "note.pling", 0.6 + (r.bateria / 100) * 1.4, 0.7);
  if (rep.t % 20 === 0) ponerHaciendo(npc, s, `§bcargando el robot ${Math.floor(r.bateria)}%`);
  if (r.bateria < 100) return;
  soundAt(dim, r.e.location, "beacon.activate", 1.2, 1);
  sound(npc, "random.levelup", 1.2, 0.8);
  animate(npc, ANIM.celebrar);
  encender(r);
  guardar(r);
  avisar(dim, r.e.location, "§bRobot multi:§r ¡batería cargada al 100%! ¡Gracias, Claude!", 32);
  rep.fase = "recoger";
  rep.t = 0;
}

function recoger(rep, s) {
  const { npc } = rep;
  ponerHaciendo(npc, s, "§brecogiendo la silla y la mesa");
  if (rep.t % 6 !== 0) return;
  const p = rep.muebles.pop();
  if (!p) {
    rep.fase = "fin";
    terminar(rep);
    return;
  }
  animate(npc, ANIM.recoger);
  try {
    const b = blockAt(npc.dimension, p);
    if (b && !b.isAir) b.setType("minecraft:air");
  } catch {
    // Chunk descargado.
  }
  sound(npc, "dig.wood", 1, 0.8);
}

const FASES = { ir, levantar, llevar, taller, estudiar, bateria, cargar, recoger };

function tickReparacion(rep) {
  const { npc, r } = rep;
  const s = estados.get(npc.id);
  if (!npc.isValid || !r.e.isValid || !s || s.reparacion !== rep) {
    terminar(rep, "interrumpida");
    return;
  }
  rep.t += 2;
  FASES[rep.fase]?.(rep, s);
}

// Cada 2 s: a cada robot apagado le busca un Claude libre que lo repare (el más listo cerca;
// si todos pelean, el que esté más lejos de ti deja la pelea para repararlo).
function asignar() {
  for (const r of multis.values()) {
    if (!r.e.isValid || !r.apagado || r.cargando || reparaciones.has(r.e.id) || now() < (r.reparaEn ?? 0)) continue;
    let lista = [];
    try {
      lista = r.e.dimension.getEntities({ type: NPC, location: r.e.location, maxDistance: MULTI_CFG.reparaRadio });
    } catch {
      lista = [];
    }
    const libres = lista.filter((n) => disponible(estados.get(n.id)));
    if (!libres.length) continue;
    const tranquilos = libres.filter((n) => now() > (estados.get(n.id)?.combateHasta ?? 0) + 40);
    const elegido = (tranquilos.length ? tranquilos : libres).sort((a, b) => (estados.get(b.id)?.iq ?? 0) - (estados.get(a.id)?.iq ?? 0))[0];
    const s = estados.get(elegido.id);
    const rep = { r, npc: elegido, fase: "ir", t: 0, muebles: [] };
    s.reparacion = rep;
    r.reparacion = rep;
    reparaciones.set(r.e.id, rep);
    r.texto = "un Claude viene a repararme";
    nombrar(r);
    avisar(r.e.dimension, elegido.location, "§bUn Claude va a reparar el Robot multi.", 32);
  }
}

// Mientras repara, el Claude no pelea ni hace otra cosa (lo llama el cerebro).
export function tickReparador(npc, s) {
  hostil(npc, s, false);
  if (!caminando(npc)) velocidad(npc, 0);
}

// Mientras lo lleva, el robot va encima de la cabeza del Claude (cada tick, para que se vea fluido).
system.runInterval(() => {
  for (const rep of reparaciones.values()) {
    const { r, npc } = rep;
    if (r.cargadoPor !== npc || !npc.isValid || !r.e.isValid) continue;
    try {
      const l = npc.location;
      r.e.teleport({ x: l.x, y: l.y + 2.05 + Math.sin(now() / 4) * 0.04, z: l.z }, { keepVelocity: false, rotation: npc.getRotation() });
    } catch {
      // Sin teletransporte.
    }
  }
}, 1);

system.runInterval(() => {
  for (const rep of [...reparaciones.values()]) {
    try {
      tickReparacion(rep);
    } catch {
      terminar(rep, "error");
    }
  }
}, 2);

system.runInterval(asignar, 40);
