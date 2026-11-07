import { system, world } from "@minecraft/server";
import { now } from "../util.js";

// PerformanceManager: lo que hace falta para que muchos Infinitos (o uno en un celular
// modesto) no pesen.
//   - Bloques temporales: toda el agua, la lava, la obsidiana del cristal y los bloques de
//     sus pilares se anotan aquí y se quitan solos (también si el mundo se cerró antes: la
//     lista se guarda en el mundo y se limpia al volver a abrirlo).
//   - Proyectiles propios (flechas, tridentes, perlas, cristales): se quitan a los pocos
//     segundos para que no queden flechas ni tridentes que se puedan recoger.
//   - Turnos: cuántos Infinitos piensan en el mismo tick (los demás esperan al siguiente).
//   - Registro de errores: los últimos 20, sin detener el juego.

const PROP_TEMP = "claudenpc:inf_temporales";
const MAX_TEMP = 160;
const temporales = [];
let sucio = false;

const iguales = (tipo, id) => id === tipo
  || (tipo === "minecraft:water" && id === "minecraft:flowing_water")
  || (tipo === "minecraft:lava" && id === "minecraft:flowing_lava");

// Anota un bloque que puso el Infinito para quitarlo dentro de "ticks".
export function temporal(dimension, pos, tipo, ticks, dueno) {
  const t = { dim: dimension.id, x: Math.floor(pos.x), y: Math.floor(pos.y), z: Math.floor(pos.z), tipo, hasta: now() + ticks, dueno };
  temporales.push(t);
  puestos++;
  historialPuestos.push({ dim: t.dim, x: t.x, y: t.y, z: t.z, tipo });
  if (historialPuestos.length > 200) historialPuestos.shift();
  while (temporales.length > MAX_TEMP) quitar(temporales.shift());
  sucio = true;
  return t;
}

// Quita el bloque si sigue siendo el que puso (si alguien lo cambió, no lo toca).
function quitar(t) {
  try {
    const b = world.getDimension(t.dim).getBlock({ x: t.x, y: t.y, z: t.z });
    if (!b) return false; // chunk descargado: se intenta más tarde
    if (iguales(t.tipo, b.typeId)) b.setType("minecraft:air");
    return true;
  } catch {
    return false;
  }
}

// Quita ya los bloques de un dueño (al terminar la pelea, al sellarlo...). "tipo" opcional.
export function limpiarDe(dueno, tipo) {
  for (let i = temporales.length - 1; i >= 0; i--) {
    const t = temporales[i];
    if (t.dueno !== dueno || (tipo && t.tipo !== tipo)) continue;
    if (quitar(t)) temporales.splice(i, 1);
    else t.hasta = now();
  }
  sucio = true;
}

// Quita uno en concreto ahora (recoger el agua del clutch).
export function quitarAhora(t) {
  const i = temporales.indexOf(t);
  if (i >= 0 && quitar(t)) temporales.splice(i, 1);
  sucio = true;
}

export function cuantosTemporales() {
  return temporales.length;
}

// Cuántos bloques puso en total (para /claudenpc:infinito_info y las pruebas).
let puestos = 0;
const historialPuestos = [];
export function bloquesPuestos() {
  return { total: puestos, ultimos: historialPuestos.slice() };
}

system.runInterval(() => {
  const t = now();
  for (let i = temporales.length - 1; i >= 0; i--) {
    const x = temporales[i];
    if (x.hasta > t) continue;
    if (quitar(x)) {
      temporales.splice(i, 1);
      sucio = true;
    } else {
      x.hasta = t + 100; // chunk descargado: reintenta en 5 s
    }
  }
}, 5);

// Guardado de la lista (para limpiar lo que quedó si se cerró el mundo).
system.runInterval(() => {
  if (!sucio) return;
  sucio = false;
  try {
    world.setDynamicProperty(PROP_TEMP, JSON.stringify(temporales.map(({ dim, x, y, z, tipo }) => ({ dim, x, y, z, tipo }))));
  } catch (err) {
    registrarError("temporales", err);
  }
}, 40);

system.runTimeout(() => {
  try {
    const raw = world.getDynamicProperty(PROP_TEMP);
    const guardados = typeof raw === "string" ? JSON.parse(raw) : [];
    for (const g of guardados) temporales.push({ ...g, hasta: now() + 20, dueno: "guardado" });
  } catch {
    // Nada guardado.
  }
}, 40);

// --- Proyectiles propios ---------------------------------------------------------------
const proyectiles = new Map(); // id → { ent, hasta }

export function proyectil(ent, ticks = 100) {
  try {
    proyectiles.set(ent.id, { ent, hasta: now() + ticks });
  } catch {
    // Entidad no válida.
  }
  return ent;
}

export function olvidarProyectil(id) {
  proyectiles.delete(id);
}

system.runInterval(() => {
  const t = now();
  for (const [id, p] of proyectiles) {
    if (p.hasta > t && p.ent.isValid) continue;
    proyectiles.delete(id);
    try {
      if (p.ent.isValid) p.ent.remove();
    } catch {
      // Ya no existe.
    }
  }
}, 10);

// --- Turnos ---------------------------------------------------------------------------
// Entre los que tienen que pensar este tick, solo los "max" que más esperaron.
export function repartirTurnos(lista, max) {
  const t = now();
  const listos = lista.filter((s) => s.proximaDecision <= t);
  if (listos.length <= max) return listos;
  listos.sort((a, b) => a.proximaDecision - b.proximaDecision);
  return listos.slice(0, max);
}

// --- Registro de errores ----------------------------------------------------------------
const registro = [];
let ultimoAviso = -1000;

export function registrarError(modulo, err) {
  const txt = `${modulo}: ${err?.message ?? err}`;
  const ultimo = registro.at(-1);
  if (ultimo && ultimo.txt === txt) {
    ultimo.n++;
    ultimo.t = now();
    return;
  }
  registro.push({ t: now(), txt, n: 1 });
  if (registro.length > 20) registro.shift();
  if (now() - ultimoAviso > 200) {
    ultimoAviso = now();
    console.warn(`[Claude Exponencial Infinito] ${txt}`);
  }
}

export function errores() {
  return registro.map((r) => ({ ...r }));
}
