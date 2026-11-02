import { GameMode, system } from "@minecraft/server";
import { ANIM, GOLDEN_FINAL, PARTICLES, PROP, SONIDO } from "../../config.js";
import { now, particleAt, rand, soundAt, sortear } from "../../util.js";
import { animar, jugadoresCerca, musica, pararMusica, pose, prop, todosLosJugadores, vivos } from "./comun.js";
import { PODERES_FINALES, tickPoderes } from "./poderes.js";

// Fase final, parte 2: la batalla. Lo primero que hace Claude Golden es chasquear los
// dedos y curarse de menos de 100 a 1000 (la barra de jefe se llena con su cara). Suena la
// música de combate en bucle. Usa los poderes nuevos (orbes, relojes y orbe definitiva,
// ilusiones, pausa del tiempo, marionetas y, con 500 de vida, las espadas).

export function vidaDe(e) {
  try {
    const h = e.getComponent("minecraft:health");
    return { actual: h?.currentValue ?? 0, max: h?.effectiveMax ?? GOLDEN_FINAL.vida, h };
  } catch {
    return { actual: 0, max: GOLDEN_FINAL.vida, h: undefined };
  }
}

export function guardarFinal(g) {
  const f = g.final;
  try {
    g.entidad.setDynamicProperty("claudenpc:final", JSON.stringify({ etapa: f.etapa === "muerte" ? "muerte" : "pelea",
      espadas: !!f.espadasHechas, centro: f.arena?.centro, yaw: f.yaw }));
  } catch {
    // Sin propiedades dinámicas.
  }
}

export function participantes(g) {
  const f = g.final;
  const lista = [];
  for (const p of todosLosJugadores()) {
    if (f.jugadores.has(p.id)) lista.push(p);
  }
  return lista;
}

export function empezarPelea(g) {
  const f = g.final;
  const e = g.entidad;
  if (!e.isValid) return;
  f.etapa = "pelea";
  f.control = false;
  f.t = 0;
  f.vidaAntes = Math.max(1, Math.min(GOLDEN_FINAL.umbral - 1, vidaDe(e).actual));
  f.curando = 0;
  f.cd = { poder: now() + 70, relojes: now() + 300, pausa: now() + 500, marionetas: now() + 400, ilusiones: now() + 260, espadas: 0 };
  f.ocupadoHasta = now() + 50;
  g.fase = 2;
  g.cd.embestida = now() + 120;
  g.cd.golpe = now() + 40;
  g.ocupadoHasta = now() + 50;
  try {
    e.triggerEvent("claudenpc:fase_final"); // 1000 de vida y barra de jefe
  } catch {
    // Paquete antiguo.
  }
  // Primer movimiento: chasquido y curación.
  animar(e, ANIM.goldenChasquidoDer);
  system.runTimeout(() => {
    if (!e.isValid) return;
    soundAt(e.dimension, e.location, SONIDO.chasquido, 1, 1.4);
    soundAt(e.dimension, e.location, "random.levelup", 0.7, 1);
    particleAt(e.dimension, PARTICLES.curacion, e.location);
    particleAt(e.dimension, PARTICLES.fusionDestello, { x: e.location.x, y: e.location.y + 1.5, z: e.location.z });
    f.curando = 1;
  }, 6);
  musica(participantes(g), SONIDO.combate, true, 1.5);
  f.musica = new Set(participantes(g).map((p) => p.id));
  guardarFinal(g);
}

// Llena la barra de jefe desde la vida que tenía hasta 1000.
function curar(g) {
  const f = g.final;
  const { h, max } = vidaDe(g.entidad);
  if (!h) return;
  if (f.curando === 1) {
    if (max < GOLDEN_FINAL.vida) return; // el grupo de 1000 todavía no se aplicó
    h.setCurrentValue(f.vidaAntes);
    f.curando = 2;
    f.cura = f.vidaAntes;
    return;
  }
  f.cura = Math.min(max, f.cura + 26);
  h.setCurrentValue(f.cura);
  if (f.cura % 104 < 26) particleAt(g.entidad.dimension, PARTICLES.curacion, g.entidad.location);
  if (f.cura >= max) f.curando = 0;
}

// Quiénes pelean: los que están cerca de la arena (y la música para los que llegan).
function revisarJugadores(g) {
  const f = g.final;
  const e = g.entidad;
  const c = f.arena ? { x: f.arena.centro.x + 0.5, y: f.arena.centro.y, z: f.arena.centro.z + 0.5 } : e.location;
  for (const p of jugadoresCerca(e.dimension, c, 48)) {
    if (p.getGameMode() === GameMode.Creative) continue;
    f.jugadores.add(p.id);
    if (!f.musica.has(p.id)) {
      musica([p], SONIDO.combate, true, 1.5);
      f.musica.add(p.id);
    }
  }
  for (const p of participantes(g)) {
    let lejos = true;
    try {
      lejos = p.dimension.id !== e.dimension.id || Math.hypot(p.location.x - c.x, p.location.z - c.z) > 100;
    } catch {
      lejos = true;
    }
    if (lejos && f.musica.has(p.id)) {
      pararMusica([p]);
      f.musica.delete(p.id);
    }
  }
}

export function tickPelea(g) {
  const f = g.final;
  f.t++;
  if (f.curando) curar(g);
  if (f.t % 20 === 0) revisarJugadores(g);
  tickPoderes(g);
}

// Cerebro (cada 4 ticks, desde golden/index.js): elige poderes cuando está libre.
export function cerebroFinal(g, j) {
  const f = g.final;
  if (f.etapa !== "pelea" || f.curando || !j?.isValid) return;
  if (now() < f.ocupadoHasta || now() < f.cd.poder || f.relojes || f.definitiva) return;
  const { actual } = vidaDe(g.entidad);
  const ctx = { g, j, vida: actual, espadas: !!f.espadasHechas, marionetas: (f.marionetas ?? []).length };
  const lista = [];
  for (const p of PODERES_FINALES) {
    if (now() < (f.cd[p.id] ?? 0) || p.id === f.ultimo) continue;
    try {
      if (p.si(ctx)) lista.push({ p: p.peso(ctx), poder: p });
    } catch {
      // No disponible.
    }
  }
  if (!lista.length) return;
  const { poder } = sortear(lista);
  let dura = 0;
  try {
    dura = poder.usar(g, j) || 0;
  } catch {
    dura = 0;
  }
  f.cd[poder.id] = now() + (dura ? poder.cd : 100);
  if (!dura) return;
  f.ultimo = poder.id;
  f.ocupadoHasta = now() + dura;
  g.ocupadoHasta = now() + dura;
  f.cd.poder = now() + dura + rand(...GOLDEN_FINAL.poderCada);
}

export function terminarMusica(g) {
  pararMusica(vivos(participantes(g)));
  g.final.musica?.clear();
}

export function ponerPose(g, n) {
  pose(g, n);
  prop(g.entidad, PROP.orbesManos, false);
}
