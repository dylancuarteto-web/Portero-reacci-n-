// Planificador central: un único runInterval procesa todas las tareas activas
// (habilidades, proyectiles guiados, efectos). Si no hay tareas no hace nada.
// Cada tarea está aislada con try/catch: una tarea que falla se cierra y limpia
// en lugar de repetir el error cada tick.
import { system } from "@minecraft/server";
import { CONFIG } from "../config.js";

/**
 * @typedef {object} Task
 * @property {string} name
 * @property {string} [owner] id del jugador propietario
 * @property {number} [every] ejecutar cada N ticks (por defecto 1)
 * @property {(age: number) => boolean | void} tick devuelve false para terminar
 * @property {(cancelled: boolean) => void} [onEnd]
 */

/** @type {(Task & {age: number, done: boolean})[]} */
const tasks = [];
const loggedErrors = new Set();

function logOnce(key, err) {
  if (loggedErrors.has(key)) return;
  loggedErrors.add(key);
  console.warn(`[LaCobra] Error en ${key}: ${err}`);
}

function finish(t, cancelled) {
  if (t.done) return;
  t.done = true;
  if (t.onEnd) {
    try {
      t.onEnd(cancelled);
    } catch (e) {
      logOnce(t.name + ":onEnd", e);
    }
  }
}

/** @param {Task} task */
export function addTask(task) {
  if (tasks.length >= CONFIG.limites.maxTareas) {
    logOnce("limite-tareas", "se alcanzó el máximo de tareas; se descarta " + task.name);
    if (task.onEnd) task.onEnd(true);
    return null;
  }
  const t = Object.assign({ every: 1, age: 0, done: false }, task);
  tasks.push(t);
  return t;
}

/** Cancela todas las tareas de un jugador (muerte, salida del mundo). */
export function cancelOwner(ownerId) {
  for (const t of tasks) {
    if (t.owner === ownerId) finish(t, true);
  }
  compact();
}

export function cancelTask(t) {
  if (t) finish(t, true);
}

export function taskCount(name, owner) {
  let n = 0;
  for (const t of tasks) if (!t.done && t.name === name && (!owner || t.owner === owner)) n++;
  return n;
}

export function activeTasks() {
  return tasks.filter((t) => !t.done).length;
}

function compact() {
  for (let i = tasks.length - 1; i >= 0; i--) if (tasks[i].done) tasks.splice(i, 1);
}

export function step() {
  if (tasks.length === 0) return;
  // copia: las tareas pueden crear tareas nuevas durante el tick
  const snapshot = tasks.slice();
  for (const t of snapshot) {
    if (t.done) continue;
    const age = t.age++;
    if (age % t.every !== 0) continue;
    let keep;
    try {
      keep = t.tick(age);
    } catch (e) {
      logOnce(t.name, e);
      keep = false;
    }
    if (keep === false) finish(t, false);
  }
  compact();
}

let started = false;
export function startScheduler() {
  if (started) return;
  started = true;
  system.runInterval(step, 1);
}
