import { BlockPermutation, Player, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { ANIM, DIMENSIONES, IQ, MAESTRO, MAESTRO_CFG, MODIFICA_MUNDO, NPC, PARTICLES } from "./config.js";
import {
  acierta, alumnos, aplausos, convocar, darPuntos, gestos, levantarMano, saliendo, sentados, terminarClase,
} from "./clase.js";
import { estados } from "./estado.js";
import { aprender } from "./iq.js";
import { listar, ocupado, registrar } from "./estructuras.js";
import { LECCIONES } from "./lecciones.js";
import { caminarA, caminando, detener, velocidad } from "./movimiento.js";
import { candidatosAlrededor, frenteHacia, sitioPlano } from "./obras/casa.js";
import { tickObra } from "./obras/index.js";
import { ejecutarPlano, escribirLetrero } from "./obras/plano.js";
import { AULA, planAula } from "./planes/aula_plano.js";
import {
  animate, avisar, blockAt, burst, cada, distancia2D, FRENTES, mirarA, now, particleAt, rand, sortear, sound, soundAt,
  superficie,
} from "./util.js";

// Claude Maestro (IQ 280). No ataca: construye un aula como un jugador (pizarra,
// mesa con campana, atril, pupitres y sillas), y cada cierto tiempo toca la campana.
// Los Claudes cercanos dejan lo que hacen, van a clase y se sientan; él escribe en la
// pizarra, explica, señala, hace una pregunta y reparte IQ. Si lo golpeas, suspende
// la clase y los Claudes lo defienden. Tócalo para hablar con él.

const PROP_AULA = "claudenpc:aula";
const maestros = new Map();

const perm = (id, estados_) => {
  try {
    return BlockPermutation.resolve(id, estados_);
  } catch {
    try {
      return BlockPermutation.resolve(id);
    } catch {
      return id;
    }
  }
};
const centro = (p) => ({ x: p.x + 0.5, y: p.y, z: p.z + 0.5 });
const centroBloque = (p) => ({ x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5 });

function local(aula, a, h, b) {
  const f = FRENTES[aula.frente];
  return { x: aula.c.x + f.x * a - f.z * b, y: aula.c.y + h, z: aula.c.z + f.z * a + f.x * b };
}

function dentro(aula, p) {
  if (aula.aire) return true;
  const f = FRENTES[aula.frente];
  const dx = p.x - (aula.c.x + 0.5);
  const dz = p.z - (aula.c.z + 0.5);
  const a = dx * f.x + dz * f.z;
  const b = -dx * f.z + dz * f.x;
  return Math.abs(a) <= AULA.a - 0.5 && Math.abs(b) <= AULA.b - 0.5;
}

function nombre(e, estado) {
  const t = `§dIQ ${MAESTRO_CFG.iq}§r\nClaude Maestro${estado ? `\n§o§7${estado}` : ""}`;
  try {
    if (e.nameTag !== t) e.nameTag = t;
  } catch {
    // Entidad descargada.
  }
}

// --- Aula: guardar, cargar y puntos -------------------------------------------------

// Clase al aire libre (si no puede construir): alumnos sentados en el suelo en tres filas.
function puntosAlAire(dimension, c, frente) {
  const P = (a, b) => {
    const p = local({ c, frente }, a, 1, b);
    const top = superficie(dimension, p.x, p.z);
    return top ? { x: p.x, y: top.location.y + 1, z: p.z } : p;
  };
  const asientos = [];
  const filas = [{ a: 0, cols: [-3, -1, 1, 3] }, { a: 2, cols: [-4, -2, 0, 2, 4] }, { a: 4, cols: [-3, -1, 1, 3] }];
  for (const { a, cols } of filas) {
    for (const b of cols) asientos.push({ suelo: P(a, b), ruta: [] });
  }
  const yo = P(-3, 0);
  return {
    asientos, pizarra: yo, explicar: yo, campana: yo, campanaBloque: yo, atril: yo, letreros: [],
    tablero: { x: yo.x, y: yo.y + 1, z: yo.z }, puertaFuera: P(5, 0), puertaDentro: P(5, 0), centro: P(0, 0),
  };
}

function prepararAula(dimension, datos) {
  if (datos.aire) return { ...datos, puntos: puntosAlAire(dimension, datos.c, datos.frente) };
  const plano = planAula(datos.c, datos.frente, perm);
  return { ...datos, puntos: plano.puntos, pasos: plano.pasos };
}

function guardar(e, m) {
  try {
    const a = m.aula;
    e.setDynamicProperty(PROP_AULA, JSON.stringify({
      c: a?.c, frente: a?.frente, listo: a?.listo, aire: a?.aire, leccion: m.leccion, dadas: m.dadas,
    }));
  } catch {
    // No se pudo guardar.
  }
}

function cargar(e, m) {
  try {
    const raw = e.getDynamicProperty(PROP_AULA);
    if (typeof raw !== "string") return;
    const d = JSON.parse(raw);
    m.leccion = d.leccion ?? m.leccion;
    m.dadas = d.dadas ?? 0;
    if (d.c && d.frente) m.aula = prepararAula(e.dimension, d);
  } catch {
    // Dato dañado.
  }
}

function obtener(e) {
  let m = maestros.get(e.id);
  if (!m) {
    m = {
      e, ocupadoHasta: now() + 20, cd: {}, iq: MAESTRO_CFG.iq, pers: { ritmo: 0.85, paso: 0.21 },
      memoria: { exitos: {} }, minados: 0, nivelPico: 2, fase: "inicio", leccion: rand(0, LECCIONES.length - 1), dadas: 0,
    };
    maestros.set(e.id, m);
    cargar(e, m);
    velocidad(e, 0);
    nombre(e, "");
  }
  m.e = e;
  return m;
}

function leccionActual(m) {
  return LECCIONES[m.leccion % LECCIONES.length];
}

function letrero(m, i, texto) {
  const p = m.aula?.puntos.letreros[i];
  if (p) escribirLetrero(m.e.dimension, p, texto);
}

function abrirPuerta(m, abrir) {
  if (!m.aula || m.aula.aire) return;
  const p = local(m.aula, AULA.a, 1, 0);
  let cambio = false;
  for (const h of [0, 1]) {
    const b = blockAt(m.e.dimension, { x: p.x, y: p.y + h, z: p.z });
    if (b?.typeId !== "minecraft:wooden_door") continue;
    try {
      if (b.permutation.getState("open_bit") !== abrir) {
        b.setPermutation(b.permutation.withState("open_bit", abrir));
        cambio = true;
      }
    } catch {
      // Puerta sin ese estado.
    }
  }
  if (cambio) soundAt(m.e.dimension, p, abrir ? "random.door_open" : "random.door_close");
}

// Camina hasta un punto y, al llegar, hace algo. Devuelve true cuando lo hizo.
function irYHacer(e, m, destino, hacer) {
  if (distancia2D(e.location, centro(destino)) > 0.9) {
    if (!caminando(e)) {
      m.intentosIr = (m.intentosIr ?? 0) + 1;
      if (m.intentosIr > 5) {
        // No llega caminando: aparece allí con una perla, como sus alumnos.
        burst(e, PARTICLES.teletransporte);
        try {
          e.teleport(centro(destino), { checkForBlocks: false });
        } catch {
          // Sin teletransporte.
        }
        sound(e, "mob.endermen.portal", 1.2, 0.6);
      } else {
        caminarA(e, centro(destino), m.pers.paso);
      }
    }
    return false;
  }
  m.intentosIr = 0;
  hacer?.();
  return true;
}

// Se mueve a un punto cercano y luego mira hacia algo.
function irYMirar(e, m, destino, mira) {
  caminarA(e, centro(destino), m.pers.paso);
  system.runTimeout(() => e.isValid && mirarA(e, mira), 14);
}

function haciaAlumnos(m) {
  return centroBloque(local(m.aula, 3, 1, 0));
}

function haciaPizarra(m) {
  return centroBloque(m.aula.puntos.tablero);
}

// --- Fases ---------------------------------------------------------------------------

function inicio(e, m) {
  m.cd.clase ??= now() + MAESTRO_CFG.primeraClase;
  if (m.aula) {
    m.fase = m.aula.listo ? "recreo" : "construir";
    if (!m.aula.listo) prepararObra(m);
    return;
  }
  // ¿Hay un aula sin maestro cerca? La adopta.
  const enUso = new Set([...maestros.values()].filter((x) => x !== m && x.aula).map((x) => `${x.aula.c.x},${x.aula.c.z}`));
  const cercana = listar("aula").find((a) => Math.hypot(a.x - e.location.x, a.z - e.location.z) < 48 && !enUso.has(`${a.x},${a.z}`));
  if (cercana?.frente) {
    m.aula = prepararAula(e.dimension, { c: { x: cercana.x, y: cercana.y, z: cercana.z }, frente: cercana.frente, listo: true });
    guardar(e, m);
    m.fase = "recreo";
    return;
  }
  if (!MODIFICA_MUNDO) return alAireLibre(e, m);
  m.busqueda = { candidatos: candidatosAlrededor(e, 8, 26), vueltas: 0 };
  m.fase = "buscar";
}

function alAireLibre(e, m) {
  const c = { x: Math.floor(e.location.x), y: Math.floor(e.location.y) - 1, z: Math.floor(e.location.z) };
  const v = e.getViewDirection();
  const frente = Math.abs(v.x) > Math.abs(v.z) ? (v.x > 0 ? "east" : "west") : (v.z > 0 ? "south" : "north");
  m.aula = prepararAula(e.dimension, { c, frente, listo: true, aire: true });
  guardar(e, m);
  m.fase = "recreo";
  avisar(e.dimension, e.location, "§6Claude Maestro:§r Hoy daremos la clase al aire libre.", 32);
}

function buscar(e, m) {
  nombre(e, "buscando lugar para el aula");
  if (caminando(e)) return;
  const b = m.busqueda;
  const cand = b.candidatos.shift();
  if (!cand) {
    if (++b.vueltas >= 3) return alAireLibre(e, m);
    // Camina a otra zona y vuelve a buscar.
    const ang = Math.random() * Math.PI * 2;
    caminarA(e, { x: e.location.x + Math.cos(ang) * 20, y: e.location.y, z: e.location.z + Math.sin(ang) * 20 }, m.pers.paso);
    b.candidatos = candidatosAlrededor(e, 8, 26);
    m.ocupadoHasta = now() + 60;
    return;
  }
  if (ocupado(cand.x, cand.z, 12)) return;
  const sitio = sitioPlano(e.dimension, cand.x, cand.z, 7, 7, 2);
  if (!sitio) return;
  const frente = frenteHacia(sitio, e);
  m.aula = prepararAula(e.dimension, { c: sitio, frente, listo: false });
  registrar("aula", { x: sitio.x, y: sitio.y, z: sitio.z, frente });
  guardar(e, m);
  prepararObra(m);
  avisar(e.dimension, e.location, "§6Claude Maestro:§r ¡Aquí construiré el aula para mis alumnos!", 40);
  m.fase = "construir";
}

function pararseAula(aula) {
  return (pos) => {
    const f = FRENTES[aula.frente];
    const dx = pos.x - aula.c.x;
    const dz = pos.z - aula.c.z;
    const a = Math.max(-4, Math.min(4, dx * f.x + dz * f.z));
    const b = Math.max(-3, Math.min(3, -dx * f.z + dz * f.x));
    return centro(local(aula, Math.round(a), 1, Math.round(b)));
  };
}

function prepararObra(m) {
  m.obra = undefined;
  m.obraAula = { c: m.aula.c, plan: m.aula.pasos, i: 0, pararse: pararseAula(m.aula), lejos: 16, animCelebrar: ANIM.maestroAplaudir };
}

function construir(e, m) {
  const o = m.obraAula;
  nombre(e, `construyendo el aula ${Math.min(99, Math.floor((o.i / o.plan.length) * 100))}%`);
  velocidad(e, 0);
  if (!ejecutarPlano(e, m, o)) return;
  m.aula.listo = true;
  guardar(e, m);
  m.fase = "recreo";
  m.cd.clase = now() + MAESTRO_CFG.primeraClase;
  letrero(m, 1, `§lPróxima:§r\n${leccionActual(m).tema}`);
  avisar(e.dimension, e.location, "§6Claude Maestro:§r ¡El aula está lista! La primera clase empieza muy pronto.", 48);
}

// Recreo: lee en el atril, prepara la pizarra, revisa pupitres, mira por la ventana
// y saluda a los jugadores que se acercan.
function recreo(e, m) {
  if (now() >= m.cd.clase) return llamar(e, m);
  const faltan = Math.max(0, Math.ceil((m.cd.clase - now()) / 20));
  nombre(e, `próxima clase en ${faltan} s`);
  if (caminando(e)) return;
  const aula = m.aula;
  if (!aula.aire && !dentro(aula, e.location) && !m.tarea) {
    m.tarea = { lugar: aula.puntos.puertaFuera, hacer: () => {
      abrirPuerta(m, true);
      m.tarea = { lugar: aula.puntos.puertaDentro, hacer: () => system.runTimeout(() => !m.sesion && !m.salida && abrirPuerta(m, false), 30) };
    } };
  }
  if (!m.tarea) {
    const [p] = e.dimension.getPlayers({ location: e.location, maxDistance: 7, closest: 1 });
    if (p && cada(m, "saludo", 1200)) {
      mirarA(e, p.getHeadLocation());
      animate(e, ANIM.maestroSaludar);
      avisar(e.dimension, e.location, "§6Claude Maestro:§r ¡Hola! Soy el maestro de los Claudes. Tócame para hablar.", 10);
      m.ocupadoHasta = now() + 50;
      return;
    }
    m.tarea = tareaDeRecreo(m);
  }
  const t = m.tarea;
  if (irYHacer(e, m, t.lugar, () => {
    m.tarea = undefined;
    t.hacer();
  })) m.ocupadoHasta = Math.max(m.ocupadoHasta, now() + 10);
}

function tareaDeRecreo(m) {
  const aula = m.aula;
  const P = aula.puntos;
  const e = m.e;
  const tipo = aula.aire ? sortear([{ t: "leer", p: 3 }, { t: "pensar", p: 1 }]).t
    : sortear([{ t: "leer", p: 3 }, { t: "preparar", p: 2 }, { t: "revisar", p: 2 }, { t: "ventana", p: 1 }, { t: "pensar", p: 1 }]).t;
  switch (tipo) {
    case "leer":
      return { lugar: P.atril, hacer: () => {
        mirarA(e, aula.aire ? haciaAlumnos(m) : centroBloque(local(aula, -3, 1, -3)));
        animate(e, ANIM.maestroLeer);
        sound(e, "item.book.page_turn", 1, 0.8);
        system.runTimeout(() => e.isValid && animate(e, ANIM.maestroLeer), 60);
        m.ocupadoHasta = now() + rand(110, 160);
      } };
    case "preparar":
      return { lugar: P.pizarra, hacer: () => {
        mirarA(e, haciaPizarra(m));
        animate(e, ANIM.maestroEscribir);
        for (let k = 0; k < 3; k++) system.runTimeout(() => particleAt(e.dimension, PARTICLES.tiza, centroBloque(P.letreros[1])), 8 + k * 12);
        letrero(m, 1, `§lPróxima:§r\n${leccionActual(m).tema}`);
        m.ocupadoHasta = now() + 60;
      } };
    case "revisar": {
      const a = [-1, 1, 3][rand(0, 2)];
      return { lugar: local(aula, a + 1, 1, 0), hacer: () => {
        mirarA(e, centroBloque(local(aula, a, 1, Math.random() < 0.5 ? -1 : 1)));
        animate(e, ANIM.maestroPensar);
        m.ocupadoHasta = now() + 60;
      } };
    }
    case "ventana": {
      const lado = Math.random() < 0.5 ? -1 : 1;
      const a = [-4, -1, 2][rand(0, 2)];
      return { lugar: local(aula, a, 1, lado * 4), hacer: () => {
        mirarA(e, centroBloque(local(aula, a, 2, lado * 9)));
        m.ocupadoHasta = now() + rand(60, 100);
      } };
    }
    default:
      return { lugar: { x: Math.floor(e.location.x), y: Math.floor(e.location.y), z: Math.floor(e.location.z) }, hacer: () => {
        animate(e, Math.random() < 0.5 ? ANIM.maestroPensar : ANIM.maestroLentes);
        m.ocupadoHasta = now() + 50;
      } };
  }
}

function tocarCampana(e, m, veces) {
  const bell = centroBloque(m.aula.puntos.campanaBloque);
  for (let k = 0; k < veces; k++) {
    system.runTimeout(() => {
      if (!e.isValid) return;
      animate(e, ANIM.maestroCampana);
      soundAt(e.dimension, bell, "block.bell.hit", 1, 2);
      particleAt(e.dimension, PARTICLES.notas, { x: bell.x, y: bell.y + 0.6, z: bell.z });
    }, k * 14);
  }
}

function llamar(e, m) {
  m.tarea = undefined;
  m.fase = "campana";
  m.sesion = { maestro: e, aula: m.aula, alumnos: new Map(), activa: true, leccion: leccionActual(m) };
}

function campana(e, m) {
  nombre(e, "llamando a clase");
  if (!irYHacer(e, m, m.aula.puntos.campana)) return;
  mirarA(e, centroBloque(m.aula.puntos.campanaBloque));
  tocarCampana(e, m, 3);
  abrirPuerta(m, true);
  avisar(e.dimension, e.location, `§6Claude Maestro:§r ¡A clase! Hoy veremos: §e${m.sesion.leccion.tema}`, MAESTRO_CFG.llamada);
  const n = convocar(m.sesion);
  m.ocupadoHasta = now() + 40;
  if (!n) {
    avisar(e.dimension, e.location, "§6Claude Maestro:§r Nadie vino a clase... lo intentaré más tarde.", 32);
    m.sesion.activa = false;
    m.sesion = undefined;
    m.fase = "recreo";
    m.cd.clase = now() + 1200;
    system.runTimeout(() => abrirPuerta(m, false), 60);
    return;
  }
  m.fase = "esperando";
  m.esperaHasta = now() + MAESTRO_CFG.espera;
  system.runTimeout(() => e.isValid && irYMirar(e, m, m.aula.puntos.explicar, haciaAlumnos(m)), 44);
}

function esperando(e, m) {
  const ses = m.sesion;
  if (cada(m, "reconvocar", 100)) convocar(ses);
  const total = alumnos(ses).length;
  const listos = sentados(ses).length;
  nombre(e, `esperando alumnos (${listos}/${total})`);
  if (cada(m, "gestoEspera", 120)) animate(e, Math.random() < 0.5 ? ANIM.maestroLentes : ANIM.maestroLeer);
  const tarde = now() > m.esperaHasta;
  if (listos > 0 && (listos === total || tarde)) return empezarClase(e, m);
  if (tarde && !total) return cancelar(e, m, "Nadie llegó a clase...");
}

function empezarClase(e, m) {
  m.fase = "clase";
  m.clase = { desde: now(), t: -1, prev: -2 };
  m.dadas = (m.dadas ?? 0) + 1;
  const L = m.sesion.leccion;
  const dia = Math.floor(world.getAbsoluteTime() / 24000) + 1;
  letrero(m, 0, `§lLección ${m.dadas}§r\n\nDía ${dia}`);
  letrero(m, 1, "");
  letrero(m, 2, "Apuntes:\n");
  avisar(e.dimension, e.location, `§6Claude Maestro:§r Buenos días, clase. Hoy aprenderemos: §e${L.tema}`, 28);
  irYMirar(e, m, m.aula.puntos.pizarra, haciaPizarra(m));
}

function apuntes(L, hasta) {
  return `Apuntes:\n${L.pizarra.slice(0, hasta).join("\n")}`;
}

// Línea de tiempo de la clase (unos 75 s).
function clase(e, m) {
  const c = m.clase;
  const ses = m.sesion;
  const L = ses.leccion;
  const P = m.aula.puntos;
  c.prev = c.t;
  c.t = now() - c.desde;
  const llega = (T) => c.prev < T && c.t >= T;
  nombre(e, `dando clase: ${L.tema}`);
  if (!alumnos(ses).length) return cancelar(e, m, "Se fueron todos los alumnos...");
  if (cada(m, "puntos", 40)) darPuntos(ses);
  if (cada(m, "gestos", 30)) gestos(ses);
  if (cada(m, "reconvocar", 200)) convocar(ses);

  // 1. Escribe el tema en la pizarra, letra por letra.
  if (c.t < 140) {
    if (cada(m, "escribir", 36)) {
      animate(e, ANIM.maestroEscribir);
      if (P.letreros[1]) particleAt(e.dimension, PARTICLES.tiza, centroBloque(P.letreros[1]));
      sound(e, "random.wood_click", 1.6, 0.4);
    }
    const n = Math.min(L.tema.length, Math.floor(c.t / 7));
    if (n !== c.letras) {
      c.letras = n;
      letrero(m, 1, `§l${L.tema.slice(0, n)}`);
    }
    return;
  }
  if (llega(140)) {
    letrero(m, 1, `§l${L.tema}`);
    irYMirar(e, m, P.explicar, haciaAlumnos(m));
    animate(e, ANIM.maestroExplicar);
  }
  // 2. Tres explicaciones: habla, señala a un alumno y escribe el apunte.
  for (let k = 0; k < 3; k++) {
    const base = 180 + k * 280;
    if (llega(base)) {
      avisar(e.dimension, e.location, `§6Claude Maestro:§r ${L.frases[k]}`, 28);
      animate(e, ANIM.maestroExplicar);
    }
    if (llega(base + 90)) {
      const lista = sentados(ses);
      const a = lista[rand(0, Math.max(0, lista.length - 1))];
      if (a) mirarA(e, a.npc.getHeadLocation());
      animate(e, ANIM.maestroSenalar);
    }
    if (llega(base + 150)) irYMirar(e, m, P.pizarra, haciaPizarra(m));
    if (llega(base + 170)) {
      animate(e, ANIM.maestroEscribir);
      if (P.letreros[2]) particleAt(e.dimension, PARTICLES.tiza, centroBloque(P.letreros[2]));
      letrero(m, 2, apuntes(L, k + 1));
    }
    if (llega(base + 215)) {
      irYMirar(e, m, P.explicar, haciaAlumnos(m));
      system.runTimeout(() => e.isValid && animate(e, k === 1 ? ANIM.maestroLentes : ANIM.maestroLeer), 16);
    }
  }
  // 3. Pregunta: un alumno levanta la mano y responde.
  if (llega(1000)) {
    avisar(e.dimension, e.location, `§6Claude Maestro:§r Pregunta: ${L.pregunta}`, 28);
    animate(e, ANIM.maestroPensar);
    c.alumno = levantarMano(ses);
  }
  if (llega(1080)) {
    const a = c.alumno;
    if (a?.npc.isValid && acierta(a)) {
      avisar(e.dimension, e.location, `§a${L.respuesta}§r §6¡Excelente respuesta!`, 28);
      animate(e, ANIM.maestroAplaudir);
      aplausos(ses);
      burst(a.npc, PARTICLES.confeti, { x: 0, y: 2, z: 0 });
      if (a.s.iq < IQ.maximo) aprender(a.npc, a.s, 2);
    } else {
      avisar(e.dimension, e.location, `§6Claude Maestro:§r Casi... ${L.respuesta}`, 28);
      animate(e, ANIM.maestroPensar);
    }
  }
  // 4. Repaso y tarea.
  if (llega(1180)) {
    avisar(e.dimension, e.location, "§6Claude Maestro:§r Repasemos los apuntes de la pizarra...", 28);
    animate(e, ANIM.maestroLeer);
  }
  if (llega(1320)) {
    avisar(e.dimension, e.location, `§6Claude Maestro:§r Tarea: practicar ${L.tema.toLowerCase()}. ¡Hasta la próxima!`, 28);
    animate(e, ANIM.maestroLentes);
  }
  if (llega(1440)) tocarCampana(e, m, 2);
  if (c.t >= MAESTRO_CFG.duracion) terminar(e, m, true);
}

function terminar(e, m, completa) {
  if (m.sesion) {
    terminarClase(m.sesion, completa);
    abrirPuerta(m, true);
    m.salida = { sesion: m.sesion, hasta: now() + 700 }; // la puerta queda abierta hasta que salgan
  }
  m.sesion = undefined;
  m.clase = undefined;
  m.fase = "recreo";
  m.tarea = undefined;
  if (completa) {
    m.leccion++;
    m.cd.clase = now() + rand(...MAESTRO_CFG.cadaClase);
    avisar(e.dimension, e.location, "§6Claude Maestro:§r ¡Muy bien, clase! Ahora aprenderán el doble durante un rato.", 32);
    animate(e, ANIM.maestroAplaudir);
  }
  guardar(e, m);
  letrero(m, 1, `§lPróxima:§r\n${leccionActual(m).tema}`);
}

// Cierra la puerta cuando ya salieron todos los alumnos.
function vigilarSalida(m) {
  const sal = m.salida;
  if (!sal) return;
  if (saliendo(sal.sesion) && now() < sal.hasta) return;
  sal.sesion.activa = false;
  m.salida = undefined;
  if (!m.sesion) abrirPuerta(m, false);
}

function cancelar(e, m, motivo) {
  avisar(e.dimension, e.location, `§6Claude Maestro:§r ${motivo}`, 32);
  terminar(e, m, false);
  m.cd.clase = now() + 1200;
}

// --- Bucle, golpes, menú y comando ---------------------------------------------------

function tickMaestro(e) {
  const m = obtener(e);
  if (cada(m, "curar", 100)) {
    try {
      const h = e.getComponent("minecraft:health");
      if (h && h.currentValue < h.effectiveMax) h.setCurrentValue(Math.min(h.effectiveMax, h.currentValue + 1));
    } catch {
      // Sin vida.
    }
  }
  vigilarSalida(m);
  if (tickObra(e, m)) return;
  if (m.fase === "clase" && m.sesion) return clase(e, m); // la clase avanza aunque esté gesticulando
  if (now() < m.ocupadoHasta) return;
  switch (m.fase) {
    case "inicio": return inicio(e, m);
    case "buscar": return buscar(e, m);
    case "construir": return construir(e, m);
    case "recreo": return recreo(e, m);
    case "campana": return campana(e, m);
    case "esperando": return esperando(e, m);
    default:
      m.fase = "inicio";
  }
}

system.runInterval(() => {
  for (const id of DIMENSIONES) {
    let lista = [];
    try {
      lista = world.getDimension(id).getEntities({ type: MAESTRO });
    } catch {
      continue;
    }
    for (const e of lista) {
      try {
        tickMaestro(e);
      } catch {
        // Descargado durante el tick.
      }
    }
  }
}, 4);

// Si lo golpeas: se queja, suspende la clase y los Claudes cercanos lo defienden.
world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource }) => {
  if (hurtEntity.typeId !== MAESTRO || !(damageSource.damagingEntity instanceof Player)) return;
  const m = maestros.get(hurtEntity.id);
  animate(hurtEntity, ANIM.maestroLentes);
  avisar(hurtEntity.dimension, hurtEntity.location, "§6Claude Maestro:§r ¡Ay! ¡Al maestro no se le pega!", 24);
  if (m?.sesion) cancelar(hurtEntity, m, "§c¡Se suspende la clase!");
  try {
    for (const npc of hurtEntity.dimension.getEntities({ type: NPC, location: hurtEntity.location, maxDistance: 32 })) {
      const s = estados.get(npc.id);
      if (s) s.provocadoHasta = now() + 1200;
    }
  } catch {
    // Sin Claudes.
  }
});

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => {
  const m = maestros.get(removedEntityId);
  if (!m) return;
  if (m.sesion) terminarClase(m.sesion, false);
  maestros.delete(removedEntityId);
});

const ESTADOS = {
  inicio: "Preparándose", buscar: "Buscando dónde construir el aula", construir: "Construyendo el aula",
  recreo: "En el recreo", campana: "Llamando a clase", esperando: "Esperando a los alumnos", clase: "Dando clase",
};

function menu(player, e, m) {
  const L = leccionActual(m);
  let cerca = 0;
  try {
    cerca = e.dimension.getEntities({ type: NPC, location: e.location, maxDistance: MAESTRO_CFG.llamada }).length;
  } catch {
    // Sin Claudes.
  }
  const progreso = m.fase === "construir" && m.obraAula ? ` (${Math.floor((m.obraAula.i / m.obraAula.plan.length) * 100)}%)` : "";
  const form = new ActionFormData()
    .title("§lClaude Maestro")
    .body(`§dIQ ${MAESTRO_CFG.iq}§r · Maestro de los Claudes\n\n`
      + `§7Estado:§r ${ESTADOS[m.fase] ?? "Pensando"}${progreso}\n`
      + `§7Claudes cerca:§r ${cerca}\n§7Clases dadas:§r ${m.dadas ?? 0}\n`
      + `§7Próxima lección:§r ${m.sesion?.leccion.tema ?? L.tema}\n\n`
      + "§7En clase los Claudes ganan IQ y después aprenden el doble durante 5 minutos.");
  const acciones = [];
  if (m.fase === "recreo") {
    form.button("§l¡Empezar la clase ahora!");
    acciones.push("clase");
  }
  form.button("¿Qué vamos a aprender?");
  acciones.push("leccion");
  form.button("Cerrar");
  acciones.push("cerrar");
  form.show(player).then((r) => {
    if (r.canceled || r.selection === undefined) return;
    const accion = acciones[r.selection];
    if (accion === "clase") {
      m.cd.clase = now();
      player.sendMessage("§6Claude Maestro:§r ¡Muy bien! Voy a tocar la campana.");
    } else if (accion === "leccion") {
      new ActionFormData()
        .title(`§lLección: ${L.tema}`)
        .body(`${L.frases.map((f, i) => `§e${i + 1}.§r ${f}`).join("\n\n")}\n\n§7Pregunta del día:§r ${L.pregunta}`)
        .button("¡Entendido!")
        .show(player)
        .catch(() => {});
    }
  }).catch(() => {});
}

world.afterEvents.playerInteractWithEntity.subscribe(({ player, target }) => {
  if (target.typeId !== MAESTRO) return;
  const m = obtener(target);
  detener(target);
  mirarA(target, player.getHeadLocation());
  animate(target, ANIM.maestroSaludar);
  system.run(() => menu(player, target, m));
});

// /claudenpc:clase: el maestro más cercano empieza la clase ahora.
export function claseAhora(player) {
  let mejor;
  let md = Infinity;
  for (const m of maestros.values()) {
    if (!m.e.isValid || m.e.dimension.id !== player.dimension.id) continue;
    const d = Math.hypot(m.e.location.x - player.location.x, m.e.location.z - player.location.z);
    if (d < md) {
      md = d;
      mejor = m;
    }
  }
  if (!mejor || md > 96) return "No hay ningún Claude Maestro cerca.";
  if (mejor.fase !== "recreo") return `Claude Maestro está ocupado: ${ESTADOS[mejor.fase] ?? mejor.fase}.`;
  mejor.cd.clase = now();
  return "Claude Maestro va a tocar la campana.";
}
