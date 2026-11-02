import { system, world } from "@minecraft/server";
import { ANIM, DIMENSIONES, MULTI, MULTI_CFG, NPC, PARTICLES, PROP } from "../config.js";
import { estados } from "../estado.js";
import { nivelHab } from "../habilidades.js";
import { ponerHaciendo } from "../iq.js";
import { detener, saltoGuiado, velocidad } from "../movimiento.js";
import { hostil } from "../postura.js";
import { abrirPaso, esPorton, esPuerta } from "../puertas.js";
import { esNatural, estorbaEnLaObra } from "../obras/terreno.js";
import { animate, avisar, blockAt, distancia, now, particleAt, reemplazable, sound, soundAt } from "../util.js";
import {
  bajada, caracol, hayHueco, hayPared, puente, quitable, rampa, sePuedeQuitar, sueloEn, tunel,
} from "./combinaciones.js";
import { planLiberar } from "./liberar.js";
import { empezarPlataforma, planPlataforma, techoSobre, terminar as terminarPlataforma, tickPlataforma } from "./plataforma.js";

// Robot multi: robot constructor de apoyo (distinto del robot de pelea). Vuela con
// propulsores, pica con el taladro y coloca con la pinza. Lleva su batería encima del
// nombre: cada bloque y cada segundo trabajando la gastan.
//   Pelea: si los Claudes no pueden alcanzarte, dos de ellos te olvidan un momento y lo
//   arman (los demás siguen peleando). El robot mira la situación y elige una
//   combinación: liberar a un Claude, rampa, caracol, puente, túnel o bajada.
//   Maestros: el maestro lo arma; el robot localiza el terreno, lo aplana y vigila la obra.
//   Siempre: si ve a un Claude atascado cerca, lo libera; si él mismo se atasca, rompe lo
//   que le cierra el paso. Nunca se rompe: sin batería (o si lo golpeas hasta el final) se
//   queda apagado en reposo, y un Claude lo lleva a un lugar seguro y lo recarga
//   (multi/reparar.js). Al terminar un trabajo descansa y se puede volver a usar.

export const multis = new Map(); // id → estado
const obras = new Map(); // armados en curso (id → obra)
const descansoPorJugador = new Map();
const DP_BATERIA = "claudenpc:bateria";

const clave = (p) => `${p.x},${p.y},${p.z}`;
const piso = (l) => ({ x: Math.floor(l.x), y: Math.floor(l.y), z: Math.floor(l.z) });

function barra(bat) {
  const n = Math.max(0, Math.min(10, Math.ceil(bat / 10)));
  const c = bat > 50 ? "§a" : bat > 20 ? "§e" : "§c";
  return `${c}[${"|".repeat(n)}§8${"|".repeat(10 - n)}${c}] ${Math.max(0, Math.ceil(bat))}%`;
}

export function nombrar(r) {
  const que = r.cargando ? `§e¡cargando! ${Math.floor(r.bateria)}%` : r.apagado ? `§capagado: ${r.texto || "sin batería"}`
    : r.reposo ? `§7en reposo${r.texto ? ` (${r.texto})` : ""}` : r.texto ?? "";
  try {
    r.e.nameTag = `${barra(r.bateria)}\n§b§lRobot multi${que ? `\n§r§7${que}` : ""}`;
  } catch {
    // Sin nombre.
  }
}

const PROPIEDADES = { volando: PROP.volando, apagado: PROP.apagado, cargando: PROP.cargando };

export function poner(r, prop, v) {
  try {
    if (r[prop] !== v) {
      r[prop] = v;
      r.e.setProperty(PROPIEDADES[prop], v);
    }
  } catch {
    // Sin propiedad.
  }
}

// Guarda la batería en el robot (así no la pierde al cerrar el mundo).
export function guardar(r) {
  try {
    r.e.setDynamicProperty(DP_BATERIA, Math.round(r.bateria * 10) / 10);
  } catch {
    // Sin propiedades.
  }
}

// --- Crear, descansar, apagar y encender ---------------------------------------------------

function estadoNuevo(e, bateria, tarea) {
  return { e, bateria, tarea, cola: [], tic: 0, texto: "", volando: false, apagado: false, reposo: !tarea, cargando: false };
}

export function crearMulti(dim, pos, tarea) {
  let e;
  try {
    e = dim.spawnEntity(MULTI, pos);
  } catch {
    return undefined;
  }
  const r = estadoNuevo(e, 100, tarea);
  multis.set(e.id, r);
  guardar(r);
  nombrar(r);
  particleAt(dim, PARTICLES.fusionDestello, { x: pos.x, y: pos.y + 1.2, z: pos.z });
  particleAt(dim, PARTICLES.onda, { x: pos.x, y: pos.y + 0.1, z: pos.z });
  soundAt(dim, pos, "beacon.activate", 1.4, 1);
  soundAt(dim, pos, "claudenpc.martillando", 1.1, 0.8);
  return r;
}

// Trabajo terminado: aterriza y descansa (no se rompe). Se puede volver a usar.
export function descansar(r, motivo) {
  if (r.apagado) return;
  if (r.plataforma) terminarPlataforma(r);
  r.cola = [];
  r.tarea = undefined;
  r.reposo = true;
  r.texto = "";
  poner(r, "volando", false);
  guardar(r);
  nombrar(r);
  if (motivo) avisar(r.e.dimension, r.e.location, `§bRobot multi:§r ${motivo} Me quedo en reposo.`, 24);
}

// Sin batería: se apaga y se queda quieto en el suelo hasta que un Claude lo recargue.
export function sinBateria(r, motivo = "¡batería agotada!") {
  if (r.apagado) return;
  if (r.plataforma) terminarPlataforma(r);
  r.bateria = 0;
  r.cola = [];
  r.tareaPrevia = r.tarea?.tipo === "ayudar" || r.tarea?.tipo === "vigilar" || r.tarea?.tipo === "terreno" ? r.tarea : undefined;
  r.tarea = undefined;
  r.reposo = false;
  r.texto = "";
  poner(r, "volando", false);
  poner(r, "apagado", true);
  guardar(r);
  nombrar(r);
  sound(r.e, "beacon.deactivate", 1, 1);
  avisar(r.e.dimension, r.e.location, `§bRobot multi:§r ${motivo} Me apago...`, 24);
}

// Recargado: se enciende y vuelve a lo que hacía (si sigue haciendo falta) o descansa.
export function encender(r) {
  poner(r, "apagado", false);
  poner(r, "cargando", false);
  try {
    const h = r.e.getComponent("minecraft:health");
    if (h) h.setCurrentValue(h.effectiveMax);
  } catch {
    // Sin vida.
  }
  const previa = r.tareaPrevia;
  r.tareaPrevia = undefined;
  // En la pelea solo vuelve si los Claudes siguen peleando contigo.
  const peleando = (j) => !!j?.isValid && [...estados.values()].some((s) => s.objetivo?.id === j.id && now() <= (s.combateHasta ?? 0));
  const sigue = previa && (previa.tipo === "ayudar" ? peleando(previa.jugador) : previa.sigue?.() ?? false);
  if (sigue) {
    r.tarea = previa.tipo === "terreno" ? { ...previa, localizado: false, esquina: 0 } : previa;
    r.reposo = false;
    r.texto = "¡de vuelta al trabajo!";
  } else {
    r.tarea = undefined;
    r.reposo = true;
    r.texto = "";
  }
  guardar(r);
  nombrar(r);
}

// ¿Un robot encendido y libre (en reposo, con batería) cerca? Para no armar otro.
export function robotLibreCerca(dim, pos, radio = 64) {
  for (const r of multis.values()) {
    if (!r.e.isValid || !r.reposo || r.apagado || r.cargadoPor || r.bateria < MULTI_CFG.reuso) continue;
    if (r.e.dimension.id === dim.id && distancia(r.e.location, pos) < radio) return r;
  }
  return undefined;
}

function robotsCerca(dim, pos, radio) {
  return [...multis.values()].filter((r) => r.e.isValid && r.e.dimension.id === dim.id && distancia(r.e.location, pos) < radio);
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

function dentroRect(rect, p) {
  return !!rect && p.x >= rect.x0 && p.x <= rect.x1 && p.z >= rect.z0 && p.z <= rect.z1;
}

// ¿Puede romper este bloque para abrirse paso? En la obra de su maestro, todo menos lo ya
// construido (y lo de otras obras); fuera, lo que se puede romper (nunca casas ni aulas).
function puedeRomper(r, b, pos) {
  const t = r.tarea;
  if ((t?.tipo === "terreno" || t?.tipo === "vigilar") && dentroRect(t.area, pos)) {
    if (t.salvo?.(pos)) return false;
    const quiere = t.esperado?.get(clave(pos));
    if (quiere !== undefined && quiere === b.typeId) return false;
    return quitable(b, pos, true);
  }
  return sePuedeQuitar(b, pos);
}

// Atascado (no puede avanzar ni subir): rompe lo que le cierra el paso.
function abrirseCamino(r, sig) {
  const dim = r.e.dimension;
  let rotos = 0;
  for (const h of [0.1, 1.0, 1.75, 2.4]) {
    const pos = piso({ x: sig.x, y: sig.y + h, z: sig.z });
    const b = blockAt(dim, pos);
    if (!b || b.isAir || b.isLiquid || reemplazable(b) || esPuerta(b) || esPorton(b) || !puedeRomper(r, b, pos)) continue;
    try {
      b.setType("minecraft:air");
      rotos++;
      particleAt(dim, PARTICLES.polvo, { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 });
    } catch {
      // No se pudo.
    }
  }
  if (!rotos) return false;
  animate(r.e, ANIM.multiTaladrar);
  soundAt(dim, sig, "dig.stone", 0.8, 0.8);
  r.bateria -= (r.tarea?.tipo === "ayudar" ? MULTI_CFG.costoBloque : MULTI_CFG.costoObra) * rotos;
  r.aviso = "rompiendo lo que me atascaba";
  return true;
}

// Un paso hacia "meta"; si algo le cierra el paso, sube por encima; si tampoco puede
// subir, al rato rompe lo que lo atasca. true al llegar.
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
    const arriba = { x: p.x, y: p.y + paso, z: p.z };
    if (ocupado(e.dimension, arriba)) {
      r.trabado = (r.trabado ?? 0) + 1;
      if (r.trabado >= 3) {
        r.trabado = 0;
        abrirseCamino(r, sig) || abrirseCamino(r, arriba);
      }
      return false;
    }
    sig = arriba;
  }
  r.trabado = 0;
  try {
    e.teleport(sig, { keepVelocity: false, facingLocation: { x: meta.x, y: sig.y + 1.6, z: meta.z } });
  } catch {
    return false;
  }
  const suelo = blockAt(e.dimension, { x: sig.x, y: sig.y - 0.6, z: sig.z });
  poner(r, "volando", !suelo || suelo.isAir || reemplazable(suelo));
  return false;
}

// Baja suave hasta el suelo (al descansar o al apagarse).
function aterrizar(r, rapidez) {
  const l = r.e.location;
  const y = sueloEn(r.e.dimension, Math.floor(l.x), l.y, Math.floor(l.z));
  if (l.y - y > 0.15) {
    try {
      r.e.teleport({ x: l.x, y: Math.max(y, l.y - rapidez), z: l.z }, { keepVelocity: false });
    } catch {
      // Sin teletransporte.
    }
  } else poner(r, "volando", false);
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
    if (!yo) r.aviso = "abriendo la puerta del aula";
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

// --- Acciones: picar, colocar y levantar ---------------------------------------------------

function costo(r) {
  return r.tarea?.tipo === "ayudar" ? MULTI_CFG.costoBloque : MULTI_CFG.costoObra;
}

// Rayo tractor: saca a un Claude de un pozo hasta el borde.
function levantar(r, a) {
  const n = a.claude;
  if (!n?.isValid) return;
  const dim = r.e.dimension;
  saltoGuiado(n, a.destino, { ticks: 18, alto: 0.7, retraso: 0.5 });
  animate(r.e, ANIM.multiEscanear);
  sound(r.e, "beacon.power_select", 1.6, 1);
  for (let t = 0; t < 18; t += 3) {
    system.runTimeout(() => {
      if (!r.e.isValid || !n.isValid) return;
      const o = { x: r.e.location.x, y: r.e.location.y + 1.6, z: r.e.location.z };
      const c = { x: n.location.x, y: n.location.y + 0.9, z: n.location.z };
      for (let k = 0; k <= 6; k++) {
        const f = k / 6;
        particleAt(dim, PARTICLES.chispaElectrica, { x: o.x + (c.x - o.x) * f, y: o.y + (c.y - o.y) * f, z: o.z + (c.z - o.z) * f });
      }
    }, t);
  }
  avisar(dim, n.location, "§bRobot multi:§r ¡rayo tractor! Te saco del pozo.", 24);
  r.bateria -= costo(r) * 4;
}

function hacer(r, a) {
  if (a.tipo === "levantar") return levantar(r, a);
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
  r.bateria -= costo(r);
}

// ¿Esa acción ya no hace falta?
function sobra(r, a) {
  if (a.tipo === "levantar") return !a.claude?.isValid || distancia(a.claude.location, a.destino) < 1.2;
  const b = blockAt(r.e.dimension, a.pos);
  if (!b || (a.suObra && r.tarea?.salvo?.(a.pos))) return true;
  if (a.tipo === "quitar") return b.isAir || !quitable(b, a.pos, a.suObra);
  return !(b.isAir || b.isLiquid || reemplazable(b));
}

// Trabaja la cola: vuela al sitio y hace hasta 3 acciones seguidas que tenga a su alcance.
function trabajar(r) {
  let hechas = 0;
  while (r.cola.length && hechas < 3) {
    const a = r.cola[0];
    if (sobra(r, a)) {
      r.cola.shift();
      continue;
    }
    if (a.tipo === "levantar") a.pos = piso(a.claude.location);
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
    if (a.tipo === "levantar") break;
  }
  if (!r.cola.length && r.volando) aterrizar(r, 0.3);
}

// --- Liberar Claudes atascados ---------------------------------------------------------------

// Busca un Claude atascado cerca y pone delante de su trabajo lo que hace falta para
// liberarlo. true si encontró a alguno.
function buscarAtascados(r) {
  if (r.plataforma || r.cola.some((a) => a.liberar) || r.bateria < 8) return false;
  const dim = r.e.dimension;
  let lista = [];
  try {
    lista = dim.getEntities({ type: NPC, location: r.e.location, maxDistance: MULTI_CFG.ayudaRadio });
  } catch {
    lista = [];
  }
  r.liberados ??= new Map();
  for (const n of lista) {
    const s = estados.get(n.id);
    if (!s || s.fusion || s.robot || s.clase || s.multiObra || s.reparacion || s.bote || s.plataforma) continue;
    if (now() < (r.liberados.get(n.id) ?? 0)) continue;
    const enPelea = s.objetivo?.isValid && now() <= (s.combateHasta ?? 0);
    const plan = planLiberar(dim, n, enPelea ? s.objetivo.location : undefined);
    if (!plan) continue;
    r.liberados.set(n.id, now() + 160);
    const acciones = plan.acciones.map((x) => ({ ...x, liberar: true }));
    if (plan.levantar) acciones.push({ tipo: "levantar", pos: piso(n.location), claude: n, destino: plan.levantar, liberar: true });
    if (!acciones.length) continue;
    r.cola = [...acciones, ...r.cola];
    r.aviso = "¡liberando a un Claude!";
    avisar(dim, n.location, `§bRobot multi:§r ¡aguanta, Claude! Te libero (${plan.motivo}).`, 24);
    sound(r.e, "random.orb", 1.6, 0.6);
    return true;
  }
  return false;
}

// --- Tareas ----------------------------------------------------------------------------------

// Maestros: localiza el terreno (recorre el borde escaneando), lo aplana y luego vigila.
function tareaTerreno(r) {
  const t = r.tarea;
  if (t.sigue && !t.sigue()) {
    descansar(r, "la obra se canceló.");
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
    descansar(r, "¡trabajo terminado!");
    return;
  }
  r.texto = r.cola.some((a) => a.liberar) ? "liberando a un Claude" : "vigilando la obra";
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
        const k = clave(pos);
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
    if (t.solo > 600) descansar(r, "ya no hay a quién alcanzar.");
    return;
  }
  t.solo = 0;
  if (r.plataforma) {
    tickPlataforma(r, { trabajar, volar });
    return;
  }
  if (r.cola.length) {
    r.texto = r.cola.some((a) => a.liberar) ? "liberando a un Claude" : r.texto;
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
  // Si ya nadie pelea contigo, el robot descansa al rato.
  t.sinClaudes = claudes.length ? 0 : (t.sinClaudes ?? 0) + 1;
  if (t.sinClaudes > 16) {
    descansar(r, "la pelea terminó.");
    return;
  }
  const plan = elegir(dim, claudes, j, t);
  if (!plan || !plan.acciones.length) {
    r.texto = "buscando cómo ayudar";
    return;
  }
  r.cola = plan.acciones;
  if (plan.plataforma) empezarPlataforma(r, plan);
  r.texto = `haciendo: ${plan.nombre}`;
  avisar(dim, r.e.location, `§bRobot multi:§r ¡${plan.nombre}!`, 32);
  sound(r.e, "random.orb", 1.8, 0.6);
}

// Mira la situación y elige la combinación de construcción.
function elegir(dim, claudes, j, t = {}) {
  if (!claudes.length) return undefined;
  // 1. Un Claude atascado o encerrado: lo libera (le quita el bloque que no puede escalar,
  //    le abre la salida o lo saca del pozo con el rayo tractor).
  for (const n of claudes) {
    const plan = planLiberar(dim, n, j.location);
    if (!plan) continue;
    const acciones = plan.acciones.map((x) => ({ ...x, liberar: true }));
    if (plan.levantar) acciones.push({ tipo: "levantar", pos: piso(n.location), claude: n, destino: plan.levantar, liberar: true });
    if (acciones.length) return { nombre: "liberar a un Claude", acciones };
  }
  const c = claudes.reduce((a, n) => ({ x: a.x + n.location.x / claudes.length, y: Math.min(a.y, n.location.y), z: a.z + n.location.z / claudes.length }),
    { x: 0, y: Infinity, z: 0 });
  const dy = j.location.y - c.y;
  // 2. Estás arriba. Con techo (o si la rampa ya no bastó, o estás muy alto): plataforma
  //    voladora con 3 Claudes. Si no, rampa (o caracol si la rampa no cabe).
  if (dy >= 2.5) {
    if ((techoSobre(dim, j) || (t.rampas ?? 0) >= 2 || dy >= 10) && now() >= (t.plataformaEn ?? 0)) {
      const p = planPlataforma(dim, claudes, j);
      if (p) {
        t.plataformaEn = now() + 600; // después de una, espera un rato antes de armar otra
        return p;
      }
    }
    t.rampas = (t.rampas ?? 0) + 1;
    return rampa(dim, j, c) ?? caracol(dim, j, c) ?? (now() >= (t.plataformaEn ?? 0) ? planPlataforma(dim, claudes, j) : undefined);
  }
  // 3. Estás abajo: escalera excavada.
  if (dy <= -3) return bajada(dim, j, c);
  // 4. Hay un hueco o agua en medio: puente. 5. Hay una pared: túnel.
  if (hayHueco(dim, c, j)) return puente(dim, j, c);
  if (hayPared(dim, c, j)) return tunel(dim, j, c);
  return undefined;
}

// Libera Claudes cuando está en reposo (se despierta un momento y vuelve a descansar).
function tareaLiberar(r) {
  if (r.cola.length) {
    r.texto = "liberando a un Claude";
    trabajar(r);
    return;
  }
  descansar(r);
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

// Cada 2 s: ¿hay Claudes que no te pueden alcanzar? Si hay un Robot multi libre cerca, lo
// despiertan; si no, dos de ellos arman uno (si no hay ya uno cerca, aunque esté apagado:
// a ese lo repara un Claude).
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
      if (!s?.objetivo?.isValid || now() > (s.combateHasta ?? 0) || s.multiObra || s.robot || s.robotObra || s.fusion || s.clase || s.reparacion
        || s.plataforma) continue;
      const g = porJugador.get(s.objetivo.id) ?? { jugador: s.objetivo, peleando: [], sinAlcance: 0 };
      g.peleando.push(n);
      if ((s.sinAlcanceDesde && now() - s.sinAlcanceDesde > MULTI_CFG.sinAlcance) || (s.atascadoDesde && now() - s.atascadoDesde > MULTI_CFG.sinAlcance)) g.sinAlcance++;
      porJugador.set(s.objetivo.id, g);
    }
    for (const [jid, g] of porJugador) {
      if (g.peleando.length < 2 || g.sinAlcance < 1) continue;
      if (now() < (descansoPorJugador.get(jid) ?? 0)) continue;
      if ([...obras.values()].some((o) => o.jugador.id === g.jugador.id)) continue;
      // Uno que ya está ayudando en esta pelea: no hace falta otro.
      if ([...multis.values()].some((r) => r.e.isValid && r.tarea?.tipo === "ayudar" && r.tarea.jugador?.id === jid)) continue;
      const libre = robotLibreCerca(dim, g.jugador.location, 64);
      if (libre) {
        libre.reposo = false;
        libre.tarea = { tipo: "ayudar", jugador: g.jugador };
        libre.texto = "¡a ayudar!";
        descansoPorJugador.set(jid, now() + 400);
        avisar(dim, g.jugador.location, "§bRobot multi:§r ¡despierto! Voy a ayudar a los Claudes.", 48);
        continue;
      }
      const activos = [...multis.values()].filter((r) => r.e.isValid && !r.reposo && !r.apagado).length;
      if (activos >= MULTI_CFG.maximo || multis.size >= MULTI_CFG.total) continue;
      if (robotsCerca(dim, g.jugador.location, 40).length) continue; // hay uno cerca (quizá apagado)
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

// Para los maestros: usa el robot del maestro (o uno libre cerca) o arma uno nuevo, que
// aplana el terreno y vigila la obra. "sigue()" dice si la obra sigue en marcha.
export function encargarTerreno(dim, junto, datos) {
  const tarea = { tipo: "terreno", ...datos };
  let r = [...multis.values()].find((x) => x.e.isValid && !x.apagado && x.tarea?.maestroId === datos.maestroId)
    ?? robotLibreCerca(dim, junto, 64);
  if (r) {
    r.tarea = tarea;
    r.reposo = false;
    r.cola = [];
    r.cruce = undefined;
    avisar(dim, r.e.location, "§bRobot multi:§r ¡nuevo trabajo! Voy a localizar el terreno.", 32);
    return r;
  }
  r = crearMulti(dim, junto, tarea);
  return r;
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
      if (r.cargadoPor || r.cargando) continue; // lo lleva o lo recarga un Claude (reparar.js)
      if (r.apagado) {
        aterrizar(r, 0.5);
        if (r.tic % 20 === 0) nombrar(r);
        continue;
      }
      if (r.reposo) {
        aterrizar(r, 0.3);
        // En reposo también ayuda: si ve a un Claude atascado cerca, se despierta y lo libera.
        if (r.tic % 40 === 0 && buscarAtascados(r)) {
          r.reposo = false;
          r.tarea = { tipo: "liberar" };
        }
        if (r.tic % 20 === 0) nombrar(r);
        continue;
      }
      const tipo = r.tarea?.tipo;
      r.bateria -= (tipo === "ayudar" || tipo === "liberar" ? MULTI_CFG.gastoTick : MULTI_CFG.gastoObra) * 2;
      if (r.bateria <= 0) {
        sinBateria(r);
        continue;
      }
      // Mientras trabaja, mira cada 2 s si hay Claudes atascados cerca (salvo aplanando).
      if (tipo !== "terreno" && !r.plataforma && r.tic % 40 === 0) buscarAtascados(r);
      if (tipo === "terreno") tareaTerreno(r);
      else if (tipo === "vigilar") tareaVigilar(r);
      else if (tipo === "ayudar") tareaAyudar(r);
      else if (tipo === "liberar") tareaLiberar(r);
      else descansar(r);
      if (r.aviso && r.tic % 20 === 0) {
        r.texto = r.aviso;
        r.aviso = undefined;
      }
      if (r.tic % 20 === 0) nombrar(r);
      if (r.tic % 100 === 0) guardar(r);
    } catch {
      // Descargado.
    }
  }
}, 2);

system.runInterval(revisar, 40);

// Al recargar el mundo: recupera los robots con su batería; los que estaban apagados
// siguen apagados (un Claude los recargará) y los demás quedan en reposo.
system.runInterval(() => {
  for (const id of DIMENSIONES) {
    try {
      for (const e of world.getDimension(id).getEntities({ type: MULTI })) {
        if (multis.has(e.id)) continue;
        let bateria = 50;
        let apagado = false;
        try {
          const b = e.getDynamicProperty(DP_BATERIA);
          if (typeof b === "number") bateria = b;
          apagado = e.getProperty(PROP.apagado) === true;
        } catch {
          // Sin datos.
        }
        const r = estadoNuevo(e, apagado ? 0 : Math.max(5, bateria), undefined);
        r.apagado = apagado || bateria <= 0;
        r.reposo = !r.apagado;
        if (r.apagado) poner(r, "apagado", true);
        multis.set(e.id, r);
        nombrar(r);
      }
    } catch {
      // Dimensión sin cargar.
    }
  }
}, 200);

// Nunca se rompe: si un golpe lo dejaría sin vida, se apaga (y un Claude lo reparará).
world.beforeEvents.entityHurt.subscribe((event) => {
  const e = event.hurtEntity;
  let vida = 1;
  try {
    vida = e.getComponent("minecraft:health")?.currentValue ?? 1;
  } catch {
    vida = 1;
  }
  if (event.damage < vida - 1) return;
  event.cancel = true;
  system.run(() => {
    if (!e.isValid) return;
    try {
      e.getComponent("minecraft:health")?.setCurrentValue(1);
    } catch {
      // Sin vida.
    }
    const r = multis.get(e.id);
    if (r) sinBateria(r, "¡me dejaste sin energía!");
  });
}, { entityFilter: { type: MULTI } });
