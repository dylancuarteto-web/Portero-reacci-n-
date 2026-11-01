import { ItemStack, system, world } from "@minecraft/server";
import { ANIM, DIMENSIONES, MULTI, MULTI_CFG, NPC, PARTICLES, PROP } from "../config.js";
import { estados } from "../estado.js";
import { nivelHab } from "../habilidades.js";
import { ponerHaciendo } from "../iq.js";
import { seAtasco, detener, velocidad } from "../movimiento.js";
import { hostil } from "../postura.js";
import { abrirPaso, esPorton, esPuerta } from "../puertas.js";
import { esNatural, estorbaEnLaObra } from "../obras/terreno.js";
import { animate, avisar, blockAt, distancia, now, particleAt, reemplazable, sound, soundAt } from "../util.js";
import {
  bajada, caracol, desatascar, hayHueco, hayPared, puente, quitable, rampa, sueloEn, tunel,
} from "./combinaciones.js";

// Robot multi: robot constructor de apoyo (distinto del robot de pelea). Vuela con
// propulsores, pica con el taladro y coloca con la pinza. Lleva su batería encima del
// nombre: cada bloque y cada segundo encendido la gastan; sin batería se apaga.
//   Pelea: si los Claudes no pueden alcanzarte, dos de ellos te olvidan un momento y lo
//   arman (los demás siguen peleando). El robot mira la situación y elige una
//   combinación: desatascar, rampa, caracol, puente, túnel o bajada.
//   Maestros: el maestro lo arma; el robot localiza el terreno (recorre el borde
//   escaneando), lo aplana rompiendo todo lo que estorba y después vigila la obra: si
//   queda algo (un bloque suelto, una montañita), abre la puerta y lo rompe.

export const multis = new Map(); // id → estado
const obras = new Map(); // armados en curso (id → obra)
const descansoPorJugador = new Map();

function barra(bat) {
  const n = Math.max(0, Math.min(10, Math.ceil(bat / 10)));
  const c = bat > 50 ? "§a" : bat > 20 ? "§e" : "§c";
  return `${c}[${"|".repeat(n)}§8${"|".repeat(10 - n)}${c}] ${Math.max(0, Math.ceil(bat))}%`;
}

function nombrar(r) {
  const que = r.apagado ? "§capagado" : r.texto ?? "";
  try {
    r.e.nameTag = `${barra(r.bateria)}\n§b§lRobot multi${que ? `\n§r§7${que}` : ""}`;
  } catch {
    // Sin nombre.
  }
}

function poner(r, prop, v) {
  try {
    if (r[prop] !== v) {
      r[prop] = v;
      r.e.setProperty(prop === "volando" ? PROP.volando : PROP.apagado, v);
    }
  } catch {
    // Sin propiedad.
  }
}

// --- Crear y apagar ----------------------------------------------------------------------

export function crearMulti(dim, pos, tarea) {
  let e;
  try {
    e = dim.spawnEntity(MULTI, pos);
  } catch {
    return undefined;
  }
  const r = { e, bateria: 100, tarea, cola: [], tic: 0, texto: "", volando: false, apagado: false, hasta: 0 };
  multis.set(e.id, r);
  nombrar(r);
  particleAt(dim, PARTICLES.fusionDestello, { x: pos.x, y: pos.y + 1.2, z: pos.z });
  particleAt(dim, PARTICLES.onda, { x: pos.x, y: pos.y + 0.1, z: pos.z });
  soundAt(dim, pos, "beacon.activate", 1.4, 1);
  soundAt(dim, pos, "claudenpc.martillando", 1.1, 0.8);
  return r;
}

function apagar(r, motivo) {
  if (r.apagado) return;
  r.cola = [];
  r.hasta = now() + 80;
  poner(r, "volando", false);
  poner(r, "apagado", true);
  r.texto = motivo;
  nombrar(r);
  sound(r.e, "beacon.deactivate", 1, 1);
  avisar(r.e.dimension, r.e.location, `§bRobot multi:§r ${motivo}`, 24);
}

function desarmar(r) {
  multis.delete(r.e.id);
  try {
    const l = r.e.location;
    particleAt(r.e.dimension, PARTICLES.construir, { x: l.x, y: l.y + 1, z: l.z });
    particleAt(r.e.dimension, PARTICLES.chispaElectrica, { x: l.x, y: l.y + 1.2, z: l.z });
    soundAt(r.e.dimension, l, "random.anvil_land", 1.4, 0.6);
    r.e.dimension.spawnItem(new ItemStack("minecraft:iron_ingot", 2), l);
    r.e.remove();
  } catch {
    // Ya no está.
  }
}

// --- Vuelo (lo mueve el script: no tiene gravedad) -----------------------------------------

function ocupado(dim, p) {
  for (const h of [0.1, 1.0, 1.75]) { // cabe por una puerta de dos bloques
    const b = blockAt(dim, { x: p.x, y: p.y + h, z: p.z });
    if (!b || b.isAir || reemplazable(b) || b.isLiquid) continue;
    if (esPuerta(b) || esPorton(b)) {
      abrirPaso(dim, b); // abre la puerta y pasa
      continue;
    }
    return true;
  }
  return false;
}

// Un paso hacia "meta"; si algo le cierra el paso, sube por encima. true al llegar.
function volar(r, meta, rapidez = MULTI_CFG.rapidez) {
  const e = r.e;
  const p = e.location;
  const dx = meta.x - p.x;
  const dy = meta.y - p.y;
  const dz = meta.z - p.z;
  const d = Math.hypot(dx, dy, dz);
  if (d < 0.35) return true;
  const paso = Math.min(rapidez, d);
  let sig = { x: p.x + (dx / d) * paso, y: p.y + (dy / d) * paso, z: p.z + (dz / d) * paso };
  if (ocupado(e.dimension, sig)) {
    sig = { x: p.x, y: p.y + paso, z: p.z };
    if (ocupado(e.dimension, sig)) return false;
  }
  try {
    e.teleport(sig, { keepVelocity: false, facingLocation: { x: meta.x, y: sig.y + 1.6, z: meta.z } });
  } catch {
    return false;
  }
  const suelo = blockAt(e.dimension, { x: sig.x, y: sig.y - 0.6, z: sig.z });
  poner(r, "volando", !suelo || suelo.isAir || reemplazable(suelo));
  return false;
}

// Dónde ponerse para trabajar en "pos": al lado (del lado donde está) o encima.
function puestoPara(r, pos) {
  const dim = r.e.dimension;
  const c = { x: pos.x + 0.5, y: pos.y, z: pos.z + 0.5 };
  const dx = r.e.location.x - c.x;
  const dz = r.e.location.z - c.z;
  const d = Math.hypot(dx, dz) || 1;
  const lados = [[dx / d, dz / d], [1, 0], [-1, 0], [0, 1], [0, -1]];
  const candidatos = [];
  for (const dh of [-0.6, 0.05, 1.0]) {
    for (const [ux, uz] of lados) candidatos.push({ x: c.x + ux * 1.8, y: pos.y + dh, z: c.z + uz * 1.8 });
    if (dh === -0.6) candidatos.push({ x: c.x, y: pos.y + 1.2, z: c.z }); // encima
  }
  candidatos.push({ x: c.x + (dx / d) * 2.5, y: pos.y + 1.5, z: c.z + (dz / d) * 2.5 });
  const lado = (q) => !conPuerta(r) || adentroDe(r.tarea.interior, q) === adentroDe(r.tarea.interior, c);
  return candidatos.find((q) => lado(q) && !ocupado(dim, q)) ?? candidatos.find((q) => !ocupado(dim, q)) ?? candidatos[candidatos.length - 1];
}

// --- Puerta del aula: entra y sale por ella (la abre al pasar) -----------------------------

// ¿"p" está dentro del aula (entre sus paredes)?
function adentroDe(rect, p) {
  return !!rect && p.x >= rect.x0 + 1 && p.x < rect.x1 && p.z >= rect.z0 + 1 && p.z < rect.z1;
}

// Solo vigilando: mientras aplana todavía no hay paredes.
function conPuerta(r) {
  const t = r.tarea;
  return t?.tipo === "vigilar" && !!t.puerta && !!t.interior;
}

function mismoLado(r, p) {
  return !conPuerta(r) || adentroDe(r.tarea.interior, r.e.location) === adentroDe(r.tarea.interior, p);
}

// Si "meta" está del otro lado de la pared, primero va delante de la puerta y después cruza.
function porLaPuerta(r, meta) {
  if (!conPuerta(r)) return meta;
  const t = r.tarea;
  const pu = t.puerta;
  const l = r.e.location;
  const yo = adentroDe(t.interior, l);
  if (yo === adentroDe(t.interior, meta)) {
    r.cruce = undefined;
    return meta;
  }
  const [antes, despues] = yo ? [pu.dentro, pu.fuera] : [pu.fuera, pu.dentro];
  if (r.cruce?.despues !== despues) {
    r.cruce = { despues, etapa: 0, pasos: 0 };
    if (!yo) r.texto = "abriendo la puerta del aula";
  }
  if (r.cruce.etapa === 0) {
    // Delante de la puerta (si algo no lo deja bajar del todo, cruza igual al rato).
    const lejos = Math.hypot(l.x - antes.x, l.z - antes.z) > 0.7 || Math.abs(l.y - antes.y) > 0.9;
    if (lejos && ++r.cruce.pasos < 90) return antes;
    r.cruce.etapa = 1;
  }
  return despues;
}

function alcanza(r, pos) {
  const l = r.e.location;
  return Math.hypot(l.x - (pos.x + 0.5), l.y + 1.2 - (pos.y + 0.5), l.z - (pos.z + 0.5)) <= MULTI_CFG.alcance;
}

// --- Acciones: picar y colocar ---------------------------------------------------------------

function hacer(r, a) {
  const dim = r.e.dimension;
  const b = blockAt(dim, a.pos);
  if (!b) return;
  const centro = { x: a.pos.x + 0.5, y: a.pos.y + 0.5, z: a.pos.z + 0.5 };
  if (a.tipo === "quitar") {
    if (b.isAir || !quitable(b, a.pos, a.suObra)) return;
    try {
      const tipo = b.typeId;
      b.setType("minecraft:air");
      particleAt(dim, PARTICLES.polvo, centro);
      if (Math.random() < 0.5) soundAt(dim, centro, /sand|dirt|grass|gravel|clay|mud|snow/.test(tipo) ? "dig.gravel" : /log|wood|leaves|planks/.test(tipo) ? "dig.wood" : "dig.stone", 1, 0.7);
    } catch {
      return;
    }
    if (r.tic % 3 === 0) animate(r.e, ANIM.multiTaladrar);
  } else {
    if (!(b.isAir || b.isLiquid || reemplazable(b))) return;
    try {
      if (typeof a.bloque === "string") b.setType(a.bloque);
      else b.setPermutation(a.bloque);
      particleAt(dim, PARTICLES.construir, centro);
      if (Math.random() < 0.5) soundAt(dim, centro, "use.stone", 1, 0.8);
    } catch {
      return;
    }
    if (r.tic % 3 === 0) animate(r.e, ANIM.multiColocar);
  }
  r.bateria -= r.tarea?.tipo === "ayudar" ? MULTI_CFG.costoBloque : MULTI_CFG.costoObra;
}

// Trabaja la cola: vuela al sitio y hace hasta 3 acciones seguidas que tenga a su alcance.
function trabajar(r) {
  let hechas = 0;
  while (r.cola.length && hechas < 3) {
    const a = r.cola[0];
    const b = blockAt(r.e.dimension, a.pos);
    // Lo que ya está como debe (o es de otra obra), se salta.
    if (!b || (a.suObra && r.tarea?.salvo?.(a.pos)) || (a.tipo === "quitar" && (b.isAir || !quitable(b, a.pos, a.suObra)))
      || (a.tipo === "poner" && !(b.isAir || b.isLiquid || reemplazable(b)))) {
      r.cola.shift();
      continue;
    }
    const centro = { x: a.pos.x + 0.5, y: a.pos.y, z: a.pos.z + 0.5 };
    const lado = mismoLado(r, centro); // dentro del aula se trabaja desde dentro
    if (!lado || !alcanza(r, a.pos)) {
      a.vuelo = (a.vuelo ?? 0) + 1;
      if (a.vuelo > (conPuerta(r) ? 160 : 60)) {
        r.cola.shift(); // no llega: lo deja
        continue;
      }
      if (!lado) {
        a.puesto = undefined;
        volar(r, porLaPuerta(r, centro));
        return;
      }
      a.puesto ??= puestoPara(r, a.pos);
      volar(r, porLaPuerta(r, a.puesto));
      return;
    }
    r.cola.shift();
    hacer(r, a);
    hechas++;
  }
  if (!r.cola.length && r.volando) {
    // Sin trabajo en el aire: baja suave al suelo.
    const l = r.e.location;
    const y = sueloEn(r.e.dimension, Math.floor(l.x), l.y, Math.floor(l.z));
    if (l.y - y > 0.3) volar(r, { x: l.x, y, z: l.z }, 0.3);
    else poner(r, "volando", false);
  }
}

// --- Tareas ----------------------------------------------------------------------------------

// Maestros: localiza el terreno (recorre el borde escaneando), lo aplana y luego vigila.
function tareaTerreno(r) {
  const t = r.tarea;
  if (t.sigue && !t.sigue()) {
    apagar(r, "la obra se canceló");
    return;
  }
  if (!t.localizado) {
    r.texto = `localizando el terreno (${Math.min(4, t.esquina ?? 0)}/4)`;
    t.esquina ??= 0;
    const a = t.area;
    const esquinas = [[a.x0, a.z0], [a.x1, a.z0], [a.x1, a.z1], [a.x0, a.z1]];
    const [x, z] = esquinas[t.esquina] ?? [];
    if (x === undefined) {
      t.localizado = true;
      r.cola = t.plan.map((p) => ({ tipo: p.tipo === "quitar" ? "quitar" : "poner", pos: p.pos, bloque: p.bloque, suObra: true }));
      t.total = r.cola.length;
      const picar = r.cola.filter((p) => p.tipo === "quitar").length;
      avisar(r.e.dimension, r.e.location, `§bRobot multi:§r terreno localizado: ${picar} bloques que picar y ${r.cola.length - picar} que rellenar.`, 40);
      return;
    }
    const meta = { x: x + 0.5, y: t.y + 3, z: z + 0.5 };
    if (volar(r, meta) || (t.intentos = (t.intentos ?? 0) + 1) > 80) {
      t.intentos = 0;
      t.esquina++;
      animate(r.e, ANIM.multiEscanear);
      sound(r.e, "beacon.ambient", 1.8, 0.8);
      // Rayo de escaneo a lo largo del borde.
      const sig = esquinas[t.esquina % 4];
      for (let k = 0; k <= 10; k++) {
        const f = k / 10;
        particleAt(r.e.dimension, PARTICLES.laser, { x: x + 0.5 + (sig[0] - x) * f, y: t.y + 1.1, z: z + 0.5 + (sig[1] - z) * f });
      }
    }
    return;
  }
  if (r.cola.length) {
    const pct = Math.floor((1 - r.cola.length / Math.max(1, t.total)) * 100);
    r.texto = `aplanando ${pct}%`;
    t.pct = pct;
    trabajar(r);
    return;
  }
  // Terminó: avisa al maestro y pasa a vigilar la obra.
  t.listo = true;
  r.tarea = { tipo: "vigilar", maestroId: t.maestroId, interior: t.interior, area: t.area, y: t.y, esperado: t.esperado, sigue: t.sigue,
    salvo: t.salvo, romper: t.romper, todoAdentro: t.todoAdentro, puerta: t.puerta };
  r.texto = "vigilando la obra";
  avisar(r.e.dimension, r.e.location, "§bRobot multi:§r ¡terreno listo! Vigilo la obra por si queda algo.", 40);
}

// Revisa el aula: lo que no es del plano (un bloque suelto, una montañita) lo rompe.
function tareaVigilar(r) {
  const t = r.tarea;
  if (!t.sigue?.()) {
    apagar(r, "¡trabajo terminado!");
    return;
  }
  r.texto = "vigilando la obra";
  if (r.cola.length) {
    trabajar(r);
    return;
  }
  if (r.tic % 30 !== 0) {
    if (r.tic % 10 === 0) trabajar(r);
    return;
  }
  const dim = r.e.dimension;
  const a = t.area;
  const sobrantes = [];
  // El maestro puede estar subido a su andamio de tierra: esa columna no se toca.
  let m;
  try {
    m = world.getEntity(t.maestroId);
  } catch {
    m = undefined;
  }
  const mx = m ? Math.floor(m.location.x) : NaN;
  const mz = m ? Math.floor(m.location.z) : NaN;
  for (let x = a.x0; x <= a.x1 && sobrantes.length < 24; x++) {
    for (let z = a.z0; z <= a.z1 && sobrantes.length < 24; z++) {
      if (Math.abs(x - mx) <= 1 && Math.abs(z - mz) <= 1) continue;
      const adentro = !!t.interior && x >= t.interior.x0 && x <= t.interior.x1 && z >= t.interior.z0 && z <= t.interior.z1;
      for (let h = 1; h <= 5; h++) {
        const pos = { x, y: t.y + h, z };
        const k = `${x},${pos.y},${z}`;
        if (t.salvo?.(pos)) continue;
        const b = blockAt(dim, pos);
        if (!b || b.isAir || reemplazable(b) || b.isLiquid) continue;
        if (t.esperado?.has(k)) {
          // Sitio de la obra: lo construido se queda; tierra o piedra donde va otra cosa, estorba.
          if (!(adentro && t.todoAdentro && estorbaEnLaObra(b, t.esperado.get(k)))) continue;
        }
        // Dentro del aula: cualquier cosa que no sea del plano. Fuera (y en la fachada): lo
        // que debía picar y no picó, y montañitas de tierra, piedra o árboles.
        const sobra = (adentro && t.todoAdentro) || t.romper?.has(k) || esNatural(b);
        if (sobra && quitable(b, pos, true)) sobrantes.push({ tipo: "quitar", pos, suObra: true });
      }
    }
  }
  if (sobrantes.length) {
    r.cola = sobrantes;
    r.texto = `rompiendo lo que quedó (${r.cola.length})`;
    avisar(dim, r.e.location, `§bRobot multi:§r quedó algo en la obra: ¡lo rompo! (${sobrantes.length})`, 24);
  }
}

// Pelea: busca la manera de que los Claudes te alcancen.
function tareaAyudar(r) {
  const t = r.tarea;
  const j = t.jugador;
  if (!j?.isValid || distancia(j.location, r.e.location) > 96) {
    t.solo = (t.solo ?? 0) + 2;
    if (t.solo > 600) apagar(r, "ya no hay a quién alcanzar");
    return;
  }
  t.solo = 0;
  if (r.cola.length) {
    trabajar(r);
    return;
  }
  if (now() < (t.pensarEn ?? 0)) {
    // Mientras piensa, se queda cerca de los Claudes.
    const l = r.e.location;
    if (Math.hypot(l.x - j.location.x, l.z - j.location.z) > 10) volar(r, { x: (l.x + j.location.x) / 2, y: Math.max(l.y, j.location.y), z: (l.z + j.location.z) / 2 }, 0.3);
    return;
  }
  t.pensarEn = now() + 30;
  const dim = r.e.dimension;
  let claudes = [];
  try {
    claudes = dim.getEntities({ type: NPC, location: j.location, maxDistance: 28 }).filter((n) => estados.get(n.id)?.objetivo?.id === j.id);
  } catch {
    claudes = [];
  }
  // Si ya nadie pelea contigo, el robot se apaga al rato.
  t.sinClaudes = claudes.length ? 0 : (t.sinClaudes ?? 0) + 1;
  if (t.sinClaudes > 40) {
    apagar(r, "la pelea terminó");
    return;
  }
  const plan = elegir(dim, claudes, j);
  if (!plan || !plan.acciones.length) {
    r.texto = "buscando cómo ayudar";
    return;
  }
  r.cola = plan.acciones;
  r.texto = `haciendo: ${plan.nombre}`;
  avisar(dim, r.e.location, `§bRobot multi:§r ¡${plan.nombre}!`, 32);
  sound(r.e, "random.orb", 1.8, 0.6);
}

// Mira la situación y elige la combinación de construcción.
function elegir(dim, claudes, j) {
  if (!claudes.length) return undefined;
  // 1. Un Claude atascado: le quita el bloque que no puede escalar.
  const desat = [];
  for (const n of claudes) {
    const s = estados.get(n.id);
    if (!s) continue;
    if (seAtasco(n) || (s.atascadoDesde && now() - s.atascadoDesde > 30) || (s.sinAlcanceDesde && now() - s.sinAlcanceDesde > 40)) {
      desat.push(...desatascar(dim, n, j.location));
    }
  }
  if (desat.length) return { nombre: "desatascar a los Claudes", acciones: desat };
  const c = claudes.reduce((a, n) => ({ x: a.x + n.location.x / claudes.length, y: Math.min(a.y, n.location.y), z: a.z + n.location.z / claudes.length }),
    { x: 0, y: Infinity, z: 0 });
  const dy = j.location.y - c.y;
  // 2. Estás arriba: rampa (o caracol si la rampa no cabe).
  if (dy >= 2.5) return rampa(dim, j, c) ?? caracol(dim, j, c);
  // 3. Estás abajo: escalera excavada.
  if (dy <= -3) return bajada(dim, j, c);
  // 4. Hay un hueco o agua en medio: puente. 5. Hay una pared: túnel.
  if (hayHueco(dim, c, j)) return puente(dim, j, c);
  if (hayPared(dim, c, j)) return tunel(dim, j, c);
  return undefined;
}

// --- Armado por dos Claudes en la pelea --------------------------------------------------

function elegirArmadores(peleando) {
  return [...peleando].sort((a, b) => {
    const sa = estados.get(a.id);
    const sb = estados.get(b.id);
    return (nivelHab(b, sb, "construccion") * 100 + sb.iq) - (nivelHab(a, sa, "construccion") * 100 + sa.iq);
  }).slice(0, 2);
}

function empezarArmado(dim, jugador, peleando) {
  const armadores = elegirArmadores(peleando);
  if (armadores.length < 2) return;
  const m = { x: (armadores[0].location.x + armadores[1].location.x) / 2, z: (armadores[0].location.z + armadores[1].location.z) / 2 };
  const y = sueloEn(dim, Math.floor(m.x), Math.min(armadores[0].location.y, armadores[1].location.y), Math.floor(m.z));
  const sitio = { x: Math.floor(m.x), y, z: Math.floor(m.z) };
  const o = { id: `${sitio.x},${sitio.y},${sitio.z}`, dim, jugador, armadores, sitio, t: 0, puestos: [] };
  obras.set(o.id, o);
  for (const n of armadores) {
    const s = estados.get(n.id);
    s.multiObra = o;
    ponerHaciendo(n, s, "§b¡armando el robot multi!");
  }
  avisar(dim, jugador.location, "§bDos Claudes te dejan un momento: ¡van a armar un Robot multi para alcanzarte!", 48);
}

const PIEZAS = ["minecraft:iron_block", "minecraft:copper_block", "minecraft:iron_block"];

function tickArmado(o) {
  o.t++;
  const vivos = o.armadores.filter((n) => n.isValid && estados.get(n.id)?.multiObra === o);
  if (vivos.length < 2 || o.t > 200) return terminarArmado(o, false);
  const centro = { x: o.sitio.x + 0.5, y: o.sitio.y + 1, z: o.sitio.z + 0.5 };
  if (o.t === 1) {
    vivos.forEach((n, i) => {
      try {
        detener(n);
        velocidad(n, 0);
        n.setProperty(PROP.herramienta, i === 0 ? 1 : 3);
      } catch {
        // Claude no disponible.
      }
    });
  }
  // Se acercan a la obra y trabajan con martillo y llave.
  if (o.t % 8 === 0) {
    vivos.forEach((n, i) => {
      try {
        const lado = i === 0 ? 1.6 : -1.6;
        const p = { x: centro.x + lado, y: o.sitio.y, z: centro.z };
        if (Math.hypot(n.location.x - p.x, n.location.z - p.z) > 1.2) n.teleport(p, { facingLocation: centro });
        animate(n, i === 0 ? ANIM.martillar : ANIM.apretar);
      } catch {
        // Claude no disponible.
      }
    });
    soundAt(o.dim, centro, o.t % 16 === 0 ? "claudenpc.martillo" : "random.anvil_use", o.t % 16 === 0 ? 1 : 1.8, 0.8);
    particleAt(o.dim, PARTICLES.chispaCae, { x: centro.x, y: centro.y + 0.5, z: centro.z });
  }
  const k = [12, 24, 36].indexOf(o.t);
  if (k >= 0) {
    const pos = { x: o.sitio.x, y: o.sitio.y + k, z: o.sitio.z };
    const b = blockAt(o.dim, pos);
    if (b && (b.isAir || reemplazable(b))) {
      try {
        b.setType(PIEZAS[k]);
        o.puestos.push(pos);
        particleAt(o.dim, PARTICLES.construir, { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 });
      } catch {
        // Sin bloque.
      }
    }
  }
  if (o.t === 48) {
    for (const p of o.puestos) {
      try {
        const b = blockAt(o.dim, p);
        if (b && !b.isAir) b.setType("minecraft:air");
      } catch {
        // Chunk descargado.
      }
    }
    const r = crearMulti(o.dim, { x: centro.x, y: o.sitio.y, z: centro.z }, { tipo: "ayudar", jugador: o.jugador });
    if (r) r.texto = "¡a ayudar!";
    terminarArmado(o, true);
  }
}

function terminarArmado(o, exito) {
  obras.delete(o.id);
  for (const n of o.armadores) {
    const s = estados.get(n.id);
    if (!s || s.multiObra !== o) continue;
    s.multiObra = undefined;
    try {
      if (n.isValid) n.setProperty(PROP.herramienta, 0);
    } catch {
      // Claude no disponible.
    }
    if (n.isValid) ponerHaciendo(n, s, "");
  }
  if (!exito) {
    for (const p of o.puestos) {
      try {
        const b = blockAt(o.dim, p);
        if (b && !b.isAir) b.setType("minecraft:air");
      } catch {
        // Chunk descargado.
      }
    }
  }
}

// Cada 2 s: ¿hay Claudes que no te pueden alcanzar? Dos de ellos arman un Robot multi.
function revisar() {
  for (const id of DIMENSIONES) {
    let dim;
    let lista = [];
    try {
      dim = world.getDimension(id);
      lista = dim.getEntities({ type: NPC });
    } catch {
      continue;
    }
    const porJugador = new Map();
    for (const n of lista) {
      const s = estados.get(n.id);
      if (!s?.objetivo?.isValid || now() > (s.combateHasta ?? 0) || s.multiObra || s.robot || s.robotObra || s.fusion || s.clase) continue;
      const g = porJugador.get(s.objetivo.id) ?? { jugador: s.objetivo, peleando: [], sinAlcance: 0 };
      g.peleando.push(n);
      if ((s.sinAlcanceDesde && now() - s.sinAlcanceDesde > MULTI_CFG.sinAlcance) || (s.atascadoDesde && now() - s.atascadoDesde > MULTI_CFG.sinAlcance)) g.sinAlcance++;
      porJugador.set(s.objetivo.id, g);
    }
    for (const [jid, g] of porJugador) {
      if (g.peleando.length < 2 || g.sinAlcance < 1) continue;
      if (now() < (descansoPorJugador.get(jid) ?? 0)) continue;
      if ([...multis.values()].length >= MULTI_CFG.maximo) continue;
      if ([...multis.values()].some((r) => r.e.isValid && r.e.dimension.id === id && distancia(r.e.location, g.jugador.location) < 48)) continue;
      if ([...obras.values()].some((o) => o.jugador.id === g.jugador.id)) continue;
      descansoPorJugador.set(jid, now() + MULTI_CFG.descanso);
      empezarArmado(dim, g.jugador, g.peleando);
    }
  }
}

// Mientras arma el robot, el Claude no pelea (lo llama el cerebro).
export function tickArmador(npc, s) {
  hostil(npc, s, false);
  velocidad(npc, 0);
}

// Para los maestros: arma (o reutiliza) un Robot multi que aplana el terreno y vigila la obra.
// "sigue()" dice si la obra sigue en marcha. Devuelve el robot.
export function encargarTerreno(dim, junto, datos) {
  const tarea = { tipo: "terreno", ...datos };
  for (const r of multis.values()) {
    if (r.e.isValid && !r.apagado && r.tarea?.maestroId === datos.maestroId) {
      r.tarea = tarea;
      r.cola = [];
      r.cruce = undefined;
      avisar(dim, r.e.location, "§bRobot multi:§r ¡nuevo trabajo! Voy a localizar el terreno.", 32);
      return r;
    }
  }
  return crearMulti(dim, junto, tarea);
}

export function progresoTerreno(r) {
  if (!r?.e?.isValid || r.apagado) return { vivo: false };
  const t = r.tarea;
  if (t?.tipo !== "terreno") return { vivo: true, listo: true };
  return { vivo: true, listo: false, pct: t.localizado ? t.pct ?? 0 : 0, localizando: !t.localizado, pendientes: r.cola };
}

// --- Bucle --------------------------------------------------------------------------------------

system.runInterval(() => {
  for (const o of [...obras.values()]) {
    try {
      tickArmado(o);
    } catch {
      terminarArmado(o, false);
    }
  }
}, 1);

system.runInterval(() => {
  for (const r of [...multis.values()]) {
    const e = r.e;
    if (!e.isValid) {
      multis.delete(e.id);
      continue;
    }
    try {
      r.tic += 2;
      if (r.apagado) {
        if (now() >= r.hasta) desarmar(r);
        continue;
      }
      r.bateria -= (r.tarea?.tipo === "ayudar" || !r.tarea ? MULTI_CFG.gastoTick : MULTI_CFG.gastoObra) * 2;
      if (r.bateria <= 0) {
        r.bateria = 0;
        apagar(r, "¡batería agotada!");
        continue;
      }
      const tipo = r.tarea?.tipo;
      if (tipo === "terreno") tareaTerreno(r);
      else if (tipo === "vigilar") tareaVigilar(r);
      else if (tipo === "ayudar") tareaAyudar(r);
      else if (r.tic > 200) apagar(r, "sin tarea");
      if (r.tic % 20 === 0) nombrar(r);
    } catch {
      // Descargado.
    }
  }
}, 2);

system.runInterval(revisar, 40);

// Al recargar el mundo, un robot multi sin tarea se apaga solo.
system.runInterval(() => {
  for (const id of DIMENSIONES) {
    try {
      for (const e of world.getDimension(id).getEntities({ type: MULTI })) {
        if (multis.has(e.id)) continue;
        const r = { e, bateria: 30, tarea: undefined, cola: [], tic: 0, texto: "", volando: false, apagado: false, hasta: 0 };
        multis.set(e.id, r);
      }
    } catch {
      // Dimensión sin cargar.
    }
  }
}, 200);

