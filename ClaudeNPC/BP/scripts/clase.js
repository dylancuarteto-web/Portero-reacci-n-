import { world } from "@minecraft/server";
import { ANIM, IQ, MAESTRO_CFG, NPC, PARTICLES, VELOCIDAD } from "./config.js";
import { pausarRutina } from "./actividades/index.js";
import { bajar } from "./bote.js";
import { pico, sostener } from "./equipo.js";
import { bajarEscudo } from "./escudo.js";
import { obtenerEstado, estados } from "./estado.js";
import { estudiar } from "./habilidades.js";
import { aprender, nivel, ponerHaciendo } from "./iq.js";
import { caminarA, caminando, detener, seAtasco, velocidad } from "./movimiento.js";
import { terminarObra } from "./obras/index.js";
import { hostil, sentarse } from "./postura.js";
import { perlaHasta } from "./tacticas.js";
import { animate, burst, distancia, distancia2D, FRENTES, now, rand, sound } from "./util.js";

// Lado de los alumnos. Cuando Claude Maestro toca la campana, los Claudes cercanos
// dejan lo que hacían (también dejan de perseguirte), van al aula por la puerta y el
// pasillo, se sientan en su silla mirando la pizarra y atienden: toman apuntes,
// levantan la mano y suben de IQ. Si alguno se queda atascado, llega con una perla.
//
// sesion = { maestro, aula: { c, frente, puntos, aire }, alumnos: Map(id → asiento), activa, leccion }

const centro = (p) => ({ x: p.x + 0.5, y: p.y, z: p.z + 0.5 });

function local(aula, p) {
  const f = FRENTES[aula.frente];
  const dx = p.x - aula.c.x;
  const dz = p.z - aula.c.z;
  return { a: dx * f.x + dz * f.z, b: dx * -f.z + dz * f.x };
}

function dentroDelAula(aula, p) {
  if (aula.aire) return true;
  const l = local(aula, p);
  return Math.abs(l.a) <= 6.2 && Math.abs(l.b) <= 5.2 && Math.abs(p.y - (aula.c.y + 1)) < 3;
}

// Dónde queda el alumno sentado: sobre el escalón de la silla, un poco hacia la pizarra.
function posicionAsiento(aula, asiento) {
  if (asiento.silla) {
    const f = FRENTES[aula.frente];
    return { x: asiento.silla.x + 0.5 - f.x * 0.18, y: asiento.silla.y + 0.5, z: asiento.silla.z + 0.5 - f.z * 0.18 };
  }
  const p = asiento.dePie ?? asiento.suelo;
  return centro(p);
}

function miraHacia(aula) {
  const t = aula.puntos.tablero;
  return { x: t.x + 0.5, y: t.y + 0.5, z: t.z + 0.5 };
}

function asientosOcupados(sesion) {
  return new Set(sesion.alumnos.values());
}

// Llama a los Claudes cercanos que estén libres. Devuelve cuántos alumnos hay.
export function convocar(sesion) {
  const { maestro, aula } = sesion;
  const c = aula.puntos.centro;
  let lista = [];
  try {
    lista = maestro.dimension.getEntities({ type: NPC, location: c, maxDistance: MAESTRO_CFG.llamada });
  } catch {
    return sesion.alumnos.size;
  }
  lista.sort((x, y) => distancia(x.location, c) - distancia(y.location, c));
  const ocupados = asientosOcupados(sesion);
  const libres = aula.puntos.asientos.map((_, i) => i).filter((i) => !ocupados.has(i));
  for (const npc of lista) {
    if (!libres.length || sesion.alumnos.size >= MAESTRO_CFG.maxAlumnos) break;
    const s = obtenerEstado(npc);
    if (s.fusion || s.clase || s.reunion || s.robot || s.robotObra) continue;
    unirse(npc, s, sesion, libres.shift());
  }
  return sesion.alumnos.size;
}

function unirse(npc, s, sesion, idx) {
  pausarRutina(npc, s);
  if (s.obra) terminarObra(npc, s);
  if (s.bote) bajar(npc, s);
  bajarEscudo(npc, s);
  hostil(npc, s, false);
  detener(npc);
  velocidad(npc, 0);
  const asiento = sesion.aula.puntos.asientos[idx];
  const ruta = dentroDelAula(sesion.aula, npc.location) ? asiento.ruta.slice(1) : [...asiento.ruta];
  s.clase = { sesion, idx, asiento, ruta, paso: 0, fase: "yendo", desde: now() };
  sesion.alumnos.set(npc.id, idx);
  ponerHaciendo(npc, s, "§e¡a clase!");
  burst(npc, PARTICLES.idea, { x: 0, y: 2.3, z: 0 });
}

function sentar(npc, s, c) {
  const aula = c.sesion.aula;
  detener(npc);
  velocidad(npc, 0);
  sostener(npc, "minecraft:air");
  sostener(npc, "minecraft:air", "slot.weapon.offhand");
  const pos = posicionAsiento(aula, c.asiento);
  const mira = miraHacia(aula);
  try {
    npc.teleport(pos, { facingLocation: { x: mira.x, y: pos.y + 1.4, z: mira.z }, checkForBlocks: false });
  } catch {
    // Sin teletransporte.
  }
  if (c.asiento.silla || c.asiento.suelo) sentarse(npc, s, true);
  c.fase = "sentado";
  c.pos = pos;
  sound(npc, "use.wood", 1.2, 0.5);
}

// Cada turno del bucle principal mientras está en clase.
export function tickAlumno(npc, s) {
  const c = s.clase;
  const ses = c.sesion;
  if (c.fase === "saliendo") return tickSalida(npc, s, c);
  if (!ses.activa || !ses.maestro?.isValid) return empezarSalida(npc, s, false);
  hostil(npc, s, false);
  if (c.fase === "yendo") {
    ponerHaciendo(npc, s, "yendo a clase");
    if (now() - c.desde > 900) return sentar(npc, s, c); // ya no espera más
    if (!c.perla && now() - c.desde > 500) {
      // Llega tarde: con una perla de ender aparece en la puerta del aula.
      c.perla = true;
      perlaHasta(npc, centro(ses.aula.puntos.puertaDentro));
      c.ruta = c.asiento.ruta.slice(2);
      c.paso = 0;
      return;
    }
    if (caminando(npc)) return;
    const wp = c.ruta[c.paso];
    if (!wp) {
      const destino = posicionAsiento(ses.aula, c.asiento);
      const d = distancia2D(npc.location, destino);
      if (d > 4 && !c.perla && !ses.aula.aire) {
        // Se perdió por el camino: perla a la puerta y sigue por el pasillo.
        c.perla = true;
        perlaHasta(npc, centro(ses.aula.puntos.puertaDentro));
        c.ruta = c.asiento.ruta.slice(2);
        c.paso = 0;
        return;
      }
      if (d > 1.4 && !c.ultimoTramo) {
        c.ultimoTramo = true;
        caminarA(npc, destino, s.pers?.paso ?? 0.22);
        return;
      }
      return sentar(npc, s, c);
    }
    if (distancia2D(npc.location, centro(wp)) < 0.9 || seAtasco(npc)) {
      c.paso++;
      return;
    }
    caminarA(npc, centro(wp), (s.pers?.paso ?? 0.22) * 1.1);
    return;
  }
  // Sentado (o de pie al fondo): quieto, mirando la pizarra.
  ponerHaciendo(npc, s, "en clase");
  if (c.pos && distancia(npc.location, c.pos) > 0.5 && now() - (c.reubicado ?? 0) > 20) {
    c.reubicado = now();
    const mira = miraHacia(ses.aula);
    try {
      npc.teleport(c.pos, { facingLocation: { x: mira.x, y: c.pos.y + 1.4, z: mira.z }, checkForBlocks: false });
    } catch {
      // Sin teletransporte.
    }
  }
}

// Al terminar la clase: se levanta y sale por el pasillo y la puerta (que el maestro
// deja abierta) hasta quedar fuera del aula; recién ahí vuelve a lo suyo.
function rutaSalida(c) {
  const aula = c.sesion.aula;
  const P = aula.puntos;
  const fuera = P.puertaFuera;
  const dentro = P.puertaDentro;
  const fx = Math.sign(fuera.x - dentro.x);
  const fz = Math.sign(fuera.z - dentro.z);
  const lado = rand(-3, 3);
  const lejos = rand(3, 5);
  const afuera = { x: fuera.x + 0.5 + fx * lejos - fz * lado, y: fuera.y, z: fuera.z + 0.5 + fz * lejos + fx * lado };
  const interior = c.asiento.silla ? c.asiento.ruta.slice(2).reverse() : [];
  return [...interior.map(centro), centro(dentro), centro(fuera), afuera];
}

function empezarSalida(npc, s, conBono) {
  const c = s.clase;
  if (!c || c.fase === "saliendo") return;
  if (s.sentado) sentarse(npc, s, false);
  if (c.fase !== "sentado" || c.sesion.aula.aire) return salirDeClase(npc, s, conBono);
  c.fase = "saliendo";
  c.conBono = conBono;
  c.salida = rutaSalida(c);
  c.paso = 0;
  c.desdeSalida = now();
  c.esperaSalida = now() + rand(4, 40); // no salen todos a la vez
  velocidad(npc, 0);
  ponerHaciendo(npc, s, "saliendo de clase");
  if (conBono) burst(npc, PARTICLES.idea, { x: 0, y: 2.2, z: 0 });
}

function tickSalida(npc, s, c) {
  hostil(npc, s, false);
  if (now() - c.desdeSalida > 500) return salirDeClase(npc, s, c.conBono); // nunca se queda atrapado
  if (now() < c.esperaSalida || caminando(npc)) return;
  const wp = c.salida[c.paso];
  if (!wp) return salirDeClase(npc, s, c.conBono);
  if (distancia2D(npc.location, wp) < 0.9 || seAtasco(npc)) {
    c.paso++;
    return;
  }
  caminarA(npc, wp, (s.pers?.paso ?? 0.22) * 1.05);
}

export function saliendo(sesion) {
  return alumnos(sesion).length > 0;
}

export function salirDeClase(npc, s, conBono) {
  const c = s.clase;
  if (!c) return;
  c.sesion.alumnos.delete(npc.id);
  s.clase = undefined;
  if (s.sentado) sentarse(npc, s, false);
  velocidad(npc, VELOCIDAD.caminar);
  sostener(npc, pico(s));
  sostener(npc, "minecraft:shield", "slot.weapon.offhand");
  if (conBono) {
    s.bono = { x: c.sesion.bono ?? MAESTRO_CFG.bono.x, hasta: now() + MAESTRO_CFG.bono.duracion };
    burst(npc, PARTICLES.confeti, { x: 0, y: 2, z: 0 });
  }
  ponerHaciendo(npc, s, "");
  s.ocupadoHasta = now() + rand(10, 40);
}

// --- Lo que el maestro hace con sus alumnos ----------------------------------------

export function alumnos(sesion) {
  const lista = [];
  for (const id of sesion.alumnos.keys()) {
    const npc = world.getEntity(id);
    const s = estados.get(id);
    if (!npc?.isValid || !s?.clase) {
      sesion.alumnos.delete(id);
      continue;
    }
    lista.push({ npc, s });
  }
  return lista;
}

export function sentados(sesion) {
  return alumnos(sesion).filter(({ s }) => s.clase.fase === "sentado");
}

// IQ por atender: suben hasta el máximo (1000), incluso por encima del IQ del maestro.
export function darPuntos(sesion) {
  for (const { npc, s } of sentados(sesion)) {
    if (s.iq < IQ.maximo) aprender(npc, s, sesion.puntos ?? MAESTRO_CFG.puntos);
  }
}

// Gestos de clase: apuntes, mirar al maestro, levantar la mano.
export function gestos(sesion) {
  for (const { npc } of sentados(sesion)) {
    if (Math.random() < 0.3) animate(npc, ANIM.tomarNotas);
  }
}

export function levantarMano(sesion) {
  const lista = sentados(sesion);
  if (!lista.length) return undefined;
  // Con más IQ, más ganas de responder.
  lista.sort((x, y) => y.s.iq * (0.5 + Math.random()) - x.s.iq * (0.5 + Math.random()));
  const elegido = lista[0];
  animate(elegido.npc, ANIM.levantarMano);
  burst(elegido.npc, PARTICLES.idea, { x: 0, y: 2.2, z: 0 });
  return elegido;
}

export function acierta(alumno) {
  return Math.random() < 0.45 + nivel(alumno.s) * 0.5;
}

export function aplausos(sesion) {
  for (const { npc } of sentados(sesion)) animate(npc, ANIM.aplaudir);
}

// Fin de la clase: aprenden la táctica de la lección, suben la habilidad del tema,
// se levantan y salen del aula con el bono de aprendizaje (aprenden el doble un rato).
export function terminarClase(sesion, completa) {
  sesion.terminada = true;
  const nodo = sesion.leccion?.nodo;
  for (const { npc, s } of alumnos(sesion)) {
    if (s.clase.fase === "saliendo") continue;
    if (completa && nodo) {
      if (nodo === "escudo") s.memoria.arco += 3;
      else s.memoria.exitos[nodo] = (s.memoria.exitos[nodo] ?? 0) + 3;
    }
    // El tema de la clase sube su habilidad (más con un maestro genio).
    if (completa && sesion.leccion?.habilidad) estudiar(npc, s, sesion.leccion.habilidad, sesion.genio);
    empezarSalida(npc, s, completa);
  }
}
