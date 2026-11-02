import { BlockPermutation, ItemStack, Player, system, world } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { ANIM, DIMENSIONES, IQ, MAESTRO, MAESTRO_CFG, MODIFICA_MUNDO, NPC, PARTICLES, PROP, VARIANTES } from "./config.js";
import {
  acierta, alumnos, aplausos, convocar, darPuntos, gestos, levantarMano, saliendo, sentados, terminarClase,
} from "./clase.js";
import { estados } from "./estado.js";
import { aprender } from "./iq.js";
import { dentroDeOtra, listar, mismaObra, ocupado, ocupadoSalvo, registrar } from "./estructuras.js";
import { LECCIONES, LECCIONES_GENIOS } from "./lecciones.js";
import { caminarA, caminando, detener, velocidad } from "./movimiento.js";
import { candidatosAlrededor, frenteHacia, sitioPlano } from "./obras/casa.js";
import { tickObra } from "./obras/index.js";
import { encargarTerreno, multis, progresoTerreno, robotLibreCerca } from "./multi/index.js";
import { ejecutarPlano, escribirLetrero } from "./obras/plano.js";
import { bloquesDe, planTerreno, rectangulo } from "./obras/terreno.js";
import { AULA, planAula } from "./planes/aula_plano.js";
import { centroAula, ladosAula, nombreEscuela, planEscuela } from "./planes/escuela_plano.js";
import {
  animate, avisar, blockAt, burst, cada, distancia2D, FRENTES, mirarA, now, particleAt, rand, sortear, sound, soundAt,
  superficie,
} from "./util.js";

// Claude Maestro (IQ 280) y los maestros genios (IQ 500: Einstein, Tesla, Curie,
// Newton y Lovelace, cada uno con su ciencia). No atacan: construyen un aula como un jugador (pizarra,
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

function variante(e) {
  try {
    const v = e.getProperty(PROP.variante);
    return VARIANTES[typeof v === "number" ? v : 0] ?? VARIANTES[0];
  } catch {
    return VARIANTES[0];
  }
}

function nombre(e, estado) {
  const v = maestros.get(e.id)?.variante ?? variante(e);
  const color = v.iq >= 500 ? "§c" : "§d";
  const t = `${color}IQ ${v.iq}§r\n${v.nombre}${estado ? `\n§o§7${estado}` : ""}`;
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
  const plano = planAula(datos.c, datos.frente, perm, datos.titulo ?? "Claude Maestro", datos.iq ?? 280, datos.lados ?? {});
  return { ...datos, puntos: plano.puntos, pasos: plano.pasos };
}

function guardar(e, m) {
  try {
    const a = m.aula;
    e.setDynamicProperty(PROP_AULA, JSON.stringify({
      c: a?.c, frente: a?.frente, listo: a?.listo, aire: a?.aire, leccion: m.leccion, dadas: m.dadas, titulo: m.titulo, iq: m.iq,
      lados: a?.lados, escuela: a?.escuela, k: a?.k, fachada: a?.fachada, revisada: a?.revisada,
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
      memoria: { exitos: {} }, minados: 0, nivelPico: 2, fase: "inicio", leccion: rand(0, 11), dadas: 0,
    };
    m.variante = variante(e);
    m.iq = m.variante.iq;
    m.titulo = m.variante.nombre;
    maestros.set(e.id, m);
    cargar(e, m);
    velocidad(e, 0);
    nombre(e, "");
  }
  m.e = e;
  return m;
}

function lecciones(m) {
  return LECCIONES_GENIOS[m.variante?.materia] ?? LECCIONES;
}

function leccionActual(m) {
  const lista = lecciones(m);
  return lista[m.leccion % lista.length];
}

// Firma de cada genio (chispas eléctricas, brillo verde, una manzana, ceros y unos...).
function firma(e, m) {
  const id = m.variante?.id;
  const cabeza = e.getHeadLocation();
  try {
    if (id === "tesla") {
      for (const lado of [-0.4, 0.4]) particleAt(e.dimension, PARTICLES.chispaElectrica, { x: e.location.x + lado, y: e.location.y + 0.9, z: e.location.z });
      sound(e, "random.fizz", 1.8, 0.3);
    } else if (id === "curie") {
      particleAt(e.dimension, PARTICLES.brilloVerde, { x: e.location.x, y: e.location.y + 1, z: e.location.z });
    } else if (id === "einstein") {
      particleAt(e.dimension, PARTICLES.idea, { x: cabeza.x, y: cabeza.y + 0.6, z: cabeza.z });
    } else if (id === "lovelace") {
      particleAt(e.dimension, PARTICLES.binario, { x: cabeza.x, y: cabeza.y + 0.5, z: cabeza.z });
    } else if (id === "newton" && Math.random() < 0.35) {
      // Una manzana cae del cielo... sobre su cabeza.
      e.dimension.spawnItem(new ItemStack("minecraft:apple", 1), { x: cabeza.x, y: cabeza.y + 3, z: cabeza.z });
    }
  } catch {
    // Sin firma.
  }
}

function letrero(m, i, texto) {
  const p = m.aula?.puntos.letreros[i];
  if (p) escribirLetrero(m.e.dimension, p, texto);
}

// Abre o cierra la puerta doble del aula (las dos hojas).
function abrirPuerta(m, abrir) {
  if (!m.aula || m.aula.aire) return;
  let cambio = false;
  const p0 = local(m.aula, AULA.a, 1, 0);
  for (const hoja of [0, 1]) {
    const p = local(m.aula, AULA.a, 1, hoja);
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
  }
  if (cambio) soundAt(m.e.dimension, p0, abrir ? "random.door_open" : "random.door_close");
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
    const a = m.aula;
    if (!a.aire) registrar("aula", { x: a.c.x, y: a.c.y, z: a.c.z, frente: a.frente, escuela: a.escuela, k: a.k, iq: m.iq, profe: m.variante.id });
    // Un aula sin terminar (o de una versión anterior, sin revisar) se termina primero:
    // aplana el terreno, se salta lo que ya está hecho y repone lo que falte.
    const revisar = !a.aire && MODIFICA_MUNDO && (!a.listo || !a.revisada);
    m.fase = revisar ? "construir" : "recreo";
    if (revisar) prepararObra(m);
    else if (a.escuela && !a.fachada && MODIFICA_MUNDO) empezarFachada(e, m);
    return;
  }
  // ¿Hay un aula sin maestro cerca? La adopta.
  const enUso = new Set([...maestros.values()].filter((x) => x !== m && x.aula).map((x) => `${x.aula.c.x},${x.aula.c.z}`));
  const cercana = listar("aula").find((a) => Math.hypot(a.x - e.location.x, a.z - e.location.z) < 48 && !enUso.has(`${a.x},${a.z}`));
  if (cercana?.frente) {
    // Puede estar a medias (su maestro se fue): primero la termina y la revisa.
    m.aula = prepararAula(e.dimension, { c: { x: cercana.x, y: cercana.y, z: cercana.z }, frente: cercana.frente, listo: false,
      titulo: m.titulo, iq: m.iq, escuela: cercana.escuela, k: cercana.k, fachada: false,
      lados: cercana.k ? ladosAula(cercana.k, 3) : undefined });
    registrar("aula", { ...cercana, iq: m.iq, profe: m.variante.id });
    if (MODIFICA_MUNDO) {
      guardar(e, m);
      prepararObra(m);
      m.fase = "construir";
      avisar(e.dimension, e.location, `§6${m.titulo}:§r Esta aula será mía. Primero la termino y reviso que no le falte nada.`, 40);
      return;
    }
    guardar(e, m);
    m.fase = "recreo";
    return;
  }
  if (!MODIFICA_MUNDO) return alAireLibre(e, m);
  if (unirseAEscuela(e, m)) return;
  m.busqueda = { candidatos: candidatosAlrededor(e, 8, 26), vueltas: 0 };
  m.fase = "buscar";
}

// --- Escuela: 2 maestros juntos (escuela o preparatoria) o 3 (universidad) ------------

const claveDe = (c) => `${c.x},${c.y},${c.z}`;

// Aulas de la escuela cuya aula principal está en "principal".
function aulasDe(principal) {
  const k0 = claveDe(principal);
  return listar("aula").filter((a) => claveDe(a) === k0 || (a.escuela && claveDe(a.escuela) === k0));
}

const ASIGNATURA = { general: "IQ y tácticas", einstein: "Física", tesla: "Electricidad", curie: "Química",
  newton: "Matemáticas", lovelace: "Programación" };

function profeDe(registro) {
  const v = VARIANTES.find((x) => x.id === registro?.profe) ?? VARIANTES[0];
  return { nombre: v.nombre.replace(/^Claude\s+/, ""), materia: ASIGNATURA[v.materia] ?? "IQ", genio: v.iq >= 500 };
}

function aguaHonda(dim, x, y, z) {
  for (let k = 0; k <= 5; k++) {
    const b = blockAt(dim, { x, y: y - k, z });
    if (b && !b.isLiquid && !b.isAir) return false;
  }
  return true;
}

// Si otro maestro tiene su aula cerca, este construye la suya pegada a ella (mismo
// piso, misma orientación): juntos forman una escuela. El tercero, una universidad.
function unirseAEscuela(e, m) {
  for (const x of maestros.values()) {
    if (x === m || !x.e.isValid || !x.aula || x.aula.aire || x.e.dimension.id !== e.dimension.id) continue;
    if (Math.hypot(x.aula.c.x - e.location.x, x.aula.c.z - e.location.z) > 48) continue;
    const principal = x.aula.escuela ?? x.aula.c;
    const frente = x.aula.frente;
    const lista = aulasDe(principal);
    if (lista.length >= 3) continue;
    const tomados = new Set(lista.map((a) => a.k ?? 0));
    for (const k of [1, 2]) {
      if (tomados.has(k)) continue;
      const c = centroAula(principal, frente, k);
      const f = FRENTES[frente];
      const plaza = { x: principal.x + f.x * 11, z: principal.z + f.z * 11 };
      const deLaEscuela = (o) => (o.tipo === "proyecto" && o.x === plaza.x && o.z === plaza.z)
        || (o.tipo === "aula" && lista.some((a) => claveDe(a) === claveDe(o)));
      if (ocupadoSalvo(c.x, c.z, 7, deLaEscuela)) continue;
      // Se adapta al terreno (pica hasta 14 arriba y rellena hasta 6 abajo), pero no
      // construye sobre agua honda ni dentro de una montaña.
      const top = superficie(e.dimension, c.x, c.z);
      if (!top || top.location.y > c.y + 12 || (top.isLiquid && aguaHonda(e.dimension, c.x, top.location.y, c.z))) continue;
      m.aula = prepararAula(e.dimension, { c, frente, listo: false, titulo: m.titulo, iq: m.iq, lados: ladosAula(k, 3),
        escuela: { ...principal }, k });
      registrar("aula", { x: c.x, y: c.y, z: c.z, frente, escuela: { ...principal }, k, iq: m.iq, profe: m.variante.id });
      guardar(e, m);
      prepararObra(m);
      const nombreEsc = nombreEscuela(lista.length + 1, [...lista.map((a) => a.iq ?? 280), m.iq].some((iq) => iq >= 500));
      avisar(e.dimension, e.location, `§6${m.titulo}:§r ¡Construiré mi aula junto a la de ${x.titulo}! Juntos haremos una ${nombreEsc.toLowerCase()}.`, 48);
      m.fase = "construir";
      return true;
    }
  }
  return false;
}

// La fachada que une las aulas: pórtico, plaza, gran letrero y (universidad) campanario.
function empezarFachada(e, m) {
  const principal = m.aula.escuela;
  const frente = m.aula.frente;
  const lista = aulasDe(principal);
  const total = Math.min(3, Math.max(2, lista.length));
  const porK = new Map(lista.map((a) => [a.k ?? 0, a]));
  const profes = [0, 1, 2].filter((k) => porK.has(k)).map((k) => profeDe(porK.get(k)));
  const f = FRENTES[frente];
  const P = (a, h, b) => ({ x: principal.x + f.x * a - f.z * b, y: principal.y + h, z: principal.z + f.z * a + f.x * b });
  // Si delante hay otra obra (la casa de un Claude), no hace plaza: solo pórtico y letrero.
  const centroPlaza = P(11, 0, 0);
  const deLaEscuela = (o) => (o.tipo === "proyecto" && o.x === centroPlaza.x && o.z === centroPlaza.z)
    || (o.tipo === "aula" && lista.some((a) => claveDe(a) === claveDe(o)));
  const frenteLibre = !ocupadoSalvo(P(12, 0, 0).x, P(12, 0, 0).z, 4, deLaEscuela);
  const plano = planEscuela(principal, frente, perm, total, profes, frenteLibre);
  const plaza = P(11, 0, total >= 3 ? 0 : 5);
  const salvo = (p) => dentroDeOtra(p, deLaEscuela);
  m.fachadaNombre = plano.nombre;
  m.obraAula = undefined;
  // Aplana el frente (pórtico y plaza) y después construye.
  const area = rectangulo(principal, frente, plano.area.a0, plano.area.a1, plano.area.b0, plano.area.b1);
  // Se registra con su rectángulo exacto (antes era un cuadrado que tapaba las aulas).
  registrar("proyecto", { x: centroPlaza.x, y: principal.y, z: centroPlaza.z, r: 13, rect: area, alto: 13 });
  m.fase = "fachada";
  const turno = (m.turnoObra = (m.turnoObra ?? 0) + 1);
  planTerreno(e.dimension, area, principal.y, (terreno) => {
    if (m.turnoObra !== turno) return;
    m.estudio = undefined;
    m.obraAula = { c: plaza, plan: [...plano.pasos], i: 0, terreno: 0, lejos: 30, salvo,
      animCelebrar: ANIM.maestroAplaudir,
      pararse: (pos) => {
        const dx = pos.x - principal.x;
        const dz = pos.z - principal.z;
        const b = Math.round(-dx * f.z + dz * f.x);
        return centro(P(plano.area.a1, 1, b)); // al borde de la plaza, lejos de bancas y columnas
      } };
    const interiorF = rectangulo(principal, frente, plano.area.a0, plano.area.a1 - 1, plano.area.b0 + 1, plano.area.b1 - 1);
    encargar(m, terreno, { area, interior: interiorF, y: principal.y, plan: plano.pasos, salvo });
  }, { plan: plano.pasos, salvo, alto: 12, hondo: 5 });
}

function fachada(e, m) {
  const o = m.obraAula;
  velocidad(e, 0);
  if (!o) {
    nombre(e, "midiendo el terreno de la escuela");
    return;
  }
  if (esperarMulti(e, m)) return;
  if (m.estudio) return estudiar(e, m);
  nombre(e, textoObra(o, `la ${m.fachadaNombre.toLowerCase()}`));
  if (!ejecutarPlano(e, m, o)) return;
  m.aula.fachada = true;
  guardar(e, m);
  m.fase = "recreo";
  m.cd.clase = now() + MAESTRO_CFG.primeraClase;
  const titulo = m.fachadaNombre === "UNIVERSIDAD" ? "§6§l¡UNIVERSIDAD DE LOS CLAUDES!" : `§e§l¡${m.fachadaNombre} DE LOS CLAUDES!`;
  for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: 64 })) {
    try {
      p.onScreenDisplay.setTitle(titulo, { subtitle: "§fLos maestros unieron sus aulas", fadeInDuration: 10, stayDuration: 60, fadeOutDuration: 15 });
    } catch {
      // Sin título.
    }
  }
  soundAt(e.dimension, e.location, "random.levelup", 0.8, 1);
}

function alAireLibre(e, m) {
  const c = { x: Math.floor(e.location.x), y: Math.floor(e.location.y) - 1, z: Math.floor(e.location.z) };
  const v = e.getViewDirection();
  const frente = Math.abs(v.x) > Math.abs(v.z) ? (v.x > 0 ? "east" : "west") : (v.z > 0 ? "south" : "north");
  m.aula = prepararAula(e.dimension, { c, frente, listo: true, aire: true });
  guardar(e, m);
  m.fase = "recreo";
  avisar(e.dimension, e.location, `§6${m.titulo}:§r Hoy daremos la clase al aire libre.`, 32);
}

function buscar(e, m) {
  nombre(e, "buscando lugar para el aula");
  if (caminando(e)) return;
  if (cada(m, "escuela", 100) && unirseAEscuela(e, m)) return; // otro maestro ya empezó la suya cerca
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
  const sitio = sitioPlano(e.dimension, cand.x, cand.z, 7, 7, 4); // con desnivel: lo aplana antes
  if (!sitio) return;
  const frente = frenteHacia(sitio, e);
  m.aula = prepararAula(e.dimension, { c: sitio, frente, listo: false, titulo: m.titulo, iq: m.iq });
  registrar("aula", { x: sitio.x, y: sitio.y, z: sitio.z, frente, iq: m.iq, profe: m.variante.id });
  guardar(e, m);
  prepararObra(m);
  avisar(e.dimension, e.location, `§6${m.titulo}:§r ¡Aquí construiré el aula para mis alumnos!`, 40);
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

// --- Estudiar el terreno ------------------------------------------------------------
// Antes de picar nada recorre las cuatro esquinas del área mirando el suelo (marca el
// borde con luces), cuenta lo que sobra y lo que falta y lo dice. Después aplana.

function nuevoEstudio(dim, area, y, terreno) {
  const alto = (x, z) => {
    const top = superficie(dim, x, z);
    return top ? Math.max(y + 1, top.location.y + 1) : y + 1;
  };
  const esquinas = [[area.x0, area.z0], [area.x1, area.z0], [area.x1, area.z1], [area.x0, area.z1]]
    .map(([x, z]) => ({ x: x + 0.5, y: alto(x, z), z: z + 0.5 }));
  return {
    area, y, esquinas, i: 0, desde: now(), intentos: 0,
    centro: { x: (area.x0 + area.x1) / 2 + 0.5, y: y + 1, z: (area.z0 + area.z1) / 2 + 0.5 },
    picar: terreno.filter((p) => p.tipo === "quitar").length,
    rellenar: terreno.filter((p) => p.tipo === "rellenar").length,
  };
}

function marcarBorde(dim, area, y) {
  for (let x = area.x0; x <= area.x1; x += 2) {
    particleAt(dim, PARTICLES.holo, { x: x + 0.5, y: y + 1.5, z: area.z0 + 0.5 });
    particleAt(dim, PARTICLES.holo, { x: x + 0.5, y: y + 1.5, z: area.z1 + 0.5 });
  }
  for (let z = area.z0; z <= area.z1; z += 2) {
    particleAt(dim, PARTICLES.holo, { x: area.x0 + 0.5, y: y + 1.5, z: z + 0.5 });
    particleAt(dim, PARTICLES.holo, { x: area.x1 + 0.5, y: y + 1.5, z: z + 0.5 });
  }
}

function estudiar(e, m) {
  const es = m.estudio;
  nombre(e, `estudiando el terreno (${Math.min(4, es.i)}/4)`);
  velocidad(e, 0);
  const esquina = es.esquinas[es.i];
  if (!esquina || now() - es.desde > 420) {
    m.estudio = undefined;
    const texto = es.picar + es.rellenar === 0 ? "El terreno está parejo: ¡a construir!"
      : `Estudié el terreno: hay que picar ${es.picar} bloques y rellenar ${es.rellenar}. ¡Primero lo aplano!`;
    avisar(e.dimension, e.location, `§6${m.titulo}:§r ${texto}`, 40);
    mirarA(e, es.centro);
    animate(e, ANIM.maestroExplicar);
    marcarBorde(e.dimension, es.area, es.y);
    m.ocupadoHasta = now() + 40;
    return;
  }
  if (Math.hypot(e.location.x - esquina.x, e.location.z - esquina.z) > 1.8 && es.intentos < 24) {
    es.intentos++;
    if (!caminando(e)) caminarA(e, esquina, m.pers.paso);
    return;
  }
  // En la esquina: mira el área, piensa y marca el borde.
  es.intentos = 0;
  es.i++;
  detener(e);
  mirarA(e, es.centro);
  animate(e, ANIM.maestroPensar);
  marcarBorde(e.dimension, es.area, es.y);
  sound(e, "item.book.page_turn", 1, 0.6);
  m.ocupadoHasta = now() + 24;
}

// Primero mide el terreno (en varios ticks) y arma el plano completo: aplanar el área
// del aula y 2 bloques alrededor (0 del lado de un aula vecina) y después construir.
function prepararObra(m) {
  m.obra = undefined;
  m.obraAula = undefined;
  const aula = m.aula;
  const lados = aula.lados ?? {};
  const area = rectangulo(aula.c, aula.frente, -AULA.a - 2, AULA.a + 2, -AULA.b - (lados.izq ? 0 : 2), AULA.b + (lados.der ? 0 : 2));
  const interior = rectangulo(aula.c, aula.frente, -AULA.a, AULA.a, -AULA.b, AULA.b);
  const salvo = (p) => dentroDeOtra(p, propiaDelAula(aula));
  const turno = (m.turnoObra = (m.turnoObra ?? 0) + 1);
  // Un aula nueva: el Robot multi aplana rompiendo TODO lo que estorba dentro de la huella.
  // Un aula ya terminada que solo se revisa: el maestro arregla el terreno natural él mismo.
  const nueva = !aula.listo;
  planTerreno(m.e.dimension, area, aula.c.y, (terreno) => {
    if (m.turnoObra !== turno || m.aula !== aula) return; // ya cambió de obra
    m.estudio = undefined;
    m.terrenoMulti = undefined;
    m.obraAula = { c: aula.c, plan: nueva ? [...aula.pasos] : [...terreno, ...aula.pasos], i: 0, terreno: nueva ? 0 : terreno.length,
      pararse: pararseAula(aula), lejos: 18, animCelebrar: ANIM.maestroAplaudir, salvo };
    if (!nueva) return;
    // El terreno lo aplana un Robot multi que arma el maestro (él espera y después construye).
    const fuera = centro(local(aula, AULA.a + 2, 1, 0));
    const fuera1 = centro(local(aula, AULA.a + 2, 1, 1));
    // Justo detrás de la puerta doble (el pasillo entre las sillas y la pared).
    const dentro1 = centro(local(aula, AULA.a - 1, 1, 0));
    const dentro2 = centro(local(aula, AULA.a - 1, 1, 1));
    const medio = (a, b) => ({ x: (a.x + b.x) / 2, y: a.y, z: (a.z + b.z) / 2 });
    encargar(m, terreno, { area, interior, y: aula.c.y, plan: aula.pasos, salvo, todoAdentro: true,
      puerta: { fuera: medio(fuera, fuera1), dentro: medio(dentro1, dentro2) } });
  }, { interior, plan: aula.pasos, salvo, alto: 14, hondo: 6, todoAdentro: nueva });
}

// Para el aula, no cuentan como "otra obra" ella misma ni la fachada de su propia escuela
// (que está justo delante: si no, su terreno se quedaba sin aplanar).
function propiaDelAula(aula) {
  const f = FRENTES[aula.frente];
  const plaza = aula.escuela ? { x: aula.escuela.x + f.x * 11, z: aula.escuela.z + f.z * 11 } : undefined;
  return (e) => (e.tipo === "aula" && e.x === aula.c.x && e.y === aula.c.y && e.z === aula.c.z)
    || (!!plaza && e.tipo === "proyecto" && e.x === plaza.x && e.z === plaza.z);
}

// --- Robot multi para el terreno ------------------------------------------------------
// El maestro arma el robot junto a la obra (martillazos y chispas); el robot localiza el
// terreno, lo aplana rompiendo todo lo que estorba y después vigila la obra. Si el robot
// se rompe antes de terminar, el maestro aplana lo que falte él mismo.

function encargar(m, terreno, datos) {
  m.terrenoMulti = undefined;
  if (!terreno.length) {
    m.estudio = undefined;
    return;
  }
  const esperado = bloquesDe(datos.plan); // posición → bloque que va ahí
  // Lo que había que picar (terreno y despeje del plano): si sigue ahí, el robot lo rompe.
  const romper = new Set([...terreno, ...datos.plan].filter((p) => p.pos && p.tipo === "quitar").map((p) => `${p.pos.x},${p.pos.y},${p.pos.z}`));
  m.terrenoMulti = { terreno, datos: { ...datos, esperado, romper }, armado: 0 };
}

function armarMulti(e, m) {
  const tm = m.terrenoMulti;
  // Si ya tiene un robot encendido (el del aula) o hay uno libre cerca, no arma otro: le
  // da el nuevo trabajo.
  const viejo = multis.get(m.multiId ?? "");
  if ((viejo?.e?.isValid && !viejo.apagado) || (tm.armado === 0 && robotLibreCerca(e.dimension, e.location, 64))) tm.armado = 12;
  tm.armado++;
  nombre(e, "armando un robot multi");
  velocidad(e, 0);
  const dim = e.dimension;
  const v = e.getViewDirection();
  tm.sitio ??= { x: Math.floor(e.location.x + v.x * 2), y: Math.floor(e.location.y), z: Math.floor(e.location.z + v.z * 2) };
  const c = { x: tm.sitio.x + 0.5, y: tm.sitio.y + 1, z: tm.sitio.z + 0.5 };
  if (tm.armado % 2 === 0) {
    mirarA(e, c);
    animate(e, tm.armado % 4 === 0 ? ANIM.maestroSenalar : ANIM.maestroExplicar);
    soundAt(dim, c, tm.armado % 4 === 0 ? "claudenpc.martillo" : "random.anvil_use", tm.armado % 4 === 0 ? 1 : 1.8, 0.8);
    particleAt(dim, PARTICLES.chispaCae, c);
  }
  if (tm.armado < 12) return;
  const sigue = () => m.e.isValid && (m.fase === "construir" || m.fase === "fachada");
  // "obra" es el plano del aula; "plan", el terreno que aplana el robot.
  const { plan: obra, ...datos } = tm.datos;
  const r = encargarTerreno(dim, { x: c.x, y: tm.sitio.y, z: c.z },
    { ...datos, maestroId: e.id, plan: tm.terreno, sigue, obra });
  if (!r) {
    // No se pudo: estudia el terreno y lo aplana él mismo.
    m.obraAula.plan = [...tm.terreno, ...m.obraAula.plan];
    m.obraAula.terreno = tm.terreno.length;
    m.estudio = nuevoEstudio(dim, tm.datos.area, tm.datos.y, tm.terreno);
    m.terrenoMulti = undefined;
    return;
  }
  m.multiId = r.e.id;
  tm.listoArmar = true;
  avisar(dim, e.location, `§6${m.titulo}:§r Robot multi, ¡aplana el terreno! Yo espero y después construyo.`, 40);
}

// Devuelve true mientras el maestro tenga que esperar al robot.
function esperarMulti(e, m) {
  const tm = m.terrenoMulti;
  if (!tm) return false;
  if (!tm.listoArmar) {
    armarMulti(e, m);
    return true;
  }
  const r = multis.get(m.multiId);
  const pr = progresoTerreno(r);
  if (!pr.vivo) {
    // El robot ya no está: el maestro aplana lo que falte (lo hecho se salta solo).
    if (!tm.terminado) {
      m.obraAula.plan = [...tm.terreno, ...m.obraAula.plan.slice(m.obraAula.i)];
      m.obraAula.i = 0;
      m.obraAula.terreno = tm.terreno.length;
    }
    m.terrenoMulti = undefined;
    return false;
  }
  if (!pr.listo) {
    velocidad(e, 0);
    if (r?.e?.isValid) mirarA(e, { x: r.e.location.x, y: r.e.location.y + 1.5, z: r.e.location.z });
    nombre(e, pr.localizando ? "esperando: el robot multi localiza el terreno" : `esperando al robot multi (aplanando ${pr.pct}%)`);
    if (cada(m, "pensarRobot", 120)) animate(e, ANIM.maestroPensar);
    return true;
  }
  tm.terminado = true; // terreno listo: construye mientras el robot vigila
  return false;
}

// Texto de la obra: aplanando el terreno, construyendo o revisando.
function textoObra(o, que) {
  if (o.revisando) return `revisando ${que}`;
  const t = o.terreno ?? 0;
  if (o.i < t) return `aplanando el terreno ${Math.min(99, Math.floor((o.i / Math.max(1, t)) * 100))}%`;
  return `construyendo ${que} ${Math.min(99, Math.floor(((o.i - t) / Math.max(1, o.plan.length - t)) * 100))}%`;
}

function construir(e, m) {
  const o = m.obraAula;
  velocidad(e, 0);
  if (!o) {
    nombre(e, "midiendo el terreno");
    return;
  }
  if (esperarMulti(e, m)) return;
  if (m.estudio) return estudiar(e, m);
  nombre(e, textoObra(o, "el aula"));
  if (!ejecutarPlano(e, m, o)) return;
  m.aula.listo = true;
  m.aula.revisada = true;
  guardar(e, m);
  m.fase = "recreo";
  m.cd.clase = now() + MAESTRO_CFG.primeraClase;
  letrero(m, 1, `§lPróxima:§r\n${leccionActual(m).tema}`);
  avisar(e.dimension, e.location, `§6${m.titulo}:§r ¡El aula está lista! La primera clase empieza muy pronto.`, 48);
  if (m.aula.escuela && !m.aula.fachada && MODIFICA_MUNDO) empezarFachada(e, m);
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
      avisar(e.dimension, e.location, `§6${m.titulo}:§r ¡Hola! Soy ${m.titulo}. Tócame para hablar.`, 10);
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
  m.sesion = { maestro: e, aula: m.aula, alumnos: new Map(), activa: true, leccion: leccionActual(m),
    puntos: m.variante?.puntos ?? MAESTRO_CFG.puntos, bono: m.variante?.bono ?? MAESTRO_CFG.bono.x, genio: (m.iq ?? 280) >= 500 };
}

function campana(e, m) {
  nombre(e, "llamando a clase");
  if (!irYHacer(e, m, m.aula.puntos.campana)) return;
  mirarA(e, centroBloque(m.aula.puntos.campanaBloque));
  tocarCampana(e, m, 3);
  abrirPuerta(m, true);
  avisar(e.dimension, e.location, `§6${m.titulo}:§r ¡A clase! Hoy veremos: §e${m.sesion.leccion.tema}`, MAESTRO_CFG.llamada);
  const n = convocar(m.sesion);
  m.ocupadoHasta = now() + 40;
  if (!n) {
    avisar(e.dimension, e.location, `§6${m.titulo}:§r Nadie vino a clase... lo intentaré más tarde.`, 32);
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
  avisar(e.dimension, e.location, `§6${m.titulo}:§r Buenos días, clase. Hoy aprenderemos: §e${L.tema}`, 28);
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
      avisar(e.dimension, e.location, `§6${m.titulo}:§r ${L.frases[k]}`, 28);
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
    avisar(e.dimension, e.location, `§6${m.titulo}:§r Pregunta: ${L.pregunta}`, 28);
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
      avisar(e.dimension, e.location, `§6${m.titulo}:§r Casi... ${L.respuesta}`, 28);
      animate(e, ANIM.maestroPensar);
    }
  }
  // 4. Repaso y tarea.
  if (llega(1180)) {
    avisar(e.dimension, e.location, `§6${m.titulo}:§r Repasemos los apuntes de la pizarra...`, 28);
    animate(e, ANIM.maestroLeer);
  }
  if (llega(1320)) {
    avisar(e.dimension, e.location, `§6${m.titulo}:§r Tarea: practicar ${L.tema.toLowerCase()}. ¡Hasta la próxima!`, 28);
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
    avisar(e.dimension, e.location, `§6${m.titulo}:§r ¡Muy bien, clase! Ahora aprenderán ${(m.variante?.bono ?? 2) >= 3 ? "el triple" : "el doble"} durante un rato.`, 32);
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
  avisar(e.dimension, e.location, `§6${m.titulo}:§r ${motivo}`, 32);
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
  if (m.variante?.id !== "maestro" && cada(m, "firma", 60)) firma(e, m);
  if (tickObra(e, m)) return;
  if (m.fase === "clase" && m.sesion) return clase(e, m); // la clase avanza aunque esté gesticulando
  if (now() < m.ocupadoHasta) return;
  switch (m.fase) {
    case "inicio": return inicio(e, m);
    case "buscar": return buscar(e, m);
    case "construir": return construir(e, m);
    case "fachada": return fachada(e, m);
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
  avisar(hurtEntity.dimension, hurtEntity.location, `§6${m?.titulo ?? "Claude Maestro"}:§r ¡Ay! ¡Al maestro no se le pega!`, 24);
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
  fachada: "Construyendo la escuela",
};

// Nombre de la escuela a la que pertenece su aula (o undefined si es un aula sola).
function escuelaDe(m) {
  if (!m.aula || m.aula.aire) return undefined;
  const lista = aulasDe(m.aula.escuela ?? m.aula.c);
  if (lista.length < 2) return undefined;
  const nombreEsc = nombreEscuela(lista.length, lista.some((a) => (a.iq ?? 280) >= 500));
  return `${nombreEsc} DE LOS CLAUDES (${lista.length} maestros)`;
}

function menu(player, e, m) {
  const L = leccionActual(m);
  let cerca = 0;
  try {
    cerca = e.dimension.getEntities({ type: NPC, location: e.location, maxDistance: MAESTRO_CFG.llamada }).length;
  } catch {
    // Sin Claudes.
  }
  const progreso = m.fase === "construir" && m.obraAula ? ` (${Math.floor((m.obraAula.i / m.obraAula.plan.length) * 100)}%)` : "";
  const v = m.variante ?? VARIANTES[0];
  const form = new ActionFormData()
    .title(`§l${v.nombre}`)
    .body(`${v.iq >= 500 ? "§c" : "§d"}IQ ${v.iq}§r · ${v.lema}\n\n`
      + `§7Estado:§r ${ESTADOS[m.fase] ?? "Pensando"}${progreso}\n`
      + (escuelaDe(m) ? `§7Escuela:§r ${escuelaDe(m)}\n` : "")
      + `§7Claudes cerca:§r ${cerca}\n§7Clases dadas:§r ${m.dadas ?? 0}\n`
      + `§7Próxima lección:§r ${m.sesion?.leccion.tema ?? L.tema}\n\n`
      + `§7En clase los Claudes ganan IQ y después aprenden ${v.bono >= 3 ? "el triple" : "el doble"} durante 5 minutos.`);
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
      player.sendMessage(`§6${m.titulo}:§r ¡Muy bien! Voy a tocar la campana.`);
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
  if (mejor.fase !== "recreo") return `${mejor.titulo} está ocupado: ${ESTADOS[mejor.fase] ?? mejor.fase}.`;
  mejor.cd.clase = now();
  return `${mejor.titulo} va a tocar la campana.`;
}
