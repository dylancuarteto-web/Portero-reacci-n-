import { system } from "@minecraft/server";
import { ANIM, MINERIA, MODIFICA_MUNDO, PARTICLES } from "../config.js";
import { romper } from "../construccion.js";
import { pico, sostener } from "../equipo.js";
import { ocupado } from "../estructuras.js";
import { nivelHab, practicar } from "../habilidades.js";
import { aprender } from "../iq.js";
import { caminarA, caminando, seAtasco } from "../movimiento.js";
import { perlaHasta } from "../tacticas.js";
import { animate, blockAt, burst, mirarA, now, rand, superficie } from "../util.js";

// Minería: baja en escalera (cada Claude hasta su propia profundidad), sigue en
// túnel y vuelve a subir a la superficie, un bloque por golpe, con antorchas y
// evitando la lava. Solo rompe lo que su pico permite.

const CARDINALES = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
const centro = (b) => ({ x: b.x + 0.5, y: b.y + 0.5, z: b.z + 0.5 });

function nuevaMina(npc) {
  const v = npc.getViewDirection();
  const dir = Math.abs(v.x) > Math.abs(v.z) ? { x: Math.sign(v.x) || 1, z: 0 } : { x: 0, z: Math.sign(v.z) || 1 };
  return { dir, pasos: 0, modo: "escalera", cola: [] };
}

function planificarPaso(npc, mina) {
  const x = Math.floor(npc.location.x) + mina.dir.x;
  const y = Math.floor(npc.location.y);
  const z = Math.floor(npc.location.z) + mina.dir.z;
  const aqui = { x: Math.floor(npc.location.x), z: Math.floor(npc.location.z) };
  if (mina.modo === "escalera") mina.cola = [{ x, y: y + 1, z }, { x, y, z }, { x, y: y - 1, z }];
  else if (mina.modo === "tunel") mina.cola = [{ x, y: y + 1, z }, { x, y, z }];
  else mina.cola = [{ x: aqui.x, y: y + 2, z: aqui.z }, { x, y: y + 2, z }, { x, y: y + 1, z }]; // subida
}

function cambiarRumbo(state) {
  const opciones = CARDINALES.filter((d) => d.x !== -state.mina.dir.x || d.z !== -state.mina.dir.z);
  state.mina.dir = opciones[rand(0, opciones.length - 1)];
  state.mina.cola = [];
  state.mina.fallos = (state.mina.fallos ?? 0) + 1;
}

// Si la mina no avanza (bloques que no puede romper, atascos), primero sube; si
// tampoco puede, sale a la superficie con una perla. Nunca se queda picando sin fin.
function revisarAtasco(npc, state) {
  const mina = state.mina;
  if ((mina.fallos ?? 0) < 4) return false;
  if (mina.modo !== "subida") {
    mina.modo = "subida";
    mina.fallos = 0;
    mina.cola = [];
    return false;
  }
  const top = superficie(npc.dimension, npc.location.x, npc.location.z);
  if (top) perlaHasta(npc, { x: Math.floor(npc.location.x) + 0.5, y: top.location.y + 1, z: Math.floor(npc.location.z) + 0.5 });
  state.mina = undefined;
  return true;
}

function ponerAntorcha(npc, donde) {
  const b = blockAt(npc.dimension, donde);
  const suelo = blockAt(npc.dimension, { x: donde.x, y: donde.y - 1, z: donde.z });
  if (!b?.isAir || !suelo || suelo.isAir) return;
  try {
    sostener(npc, "minecraft:torch");
    animate(npc, ANIM.colocar);
    b.setType("minecraft:torch");
  } catch {
    // No se pudo colocar.
  }
}

function olfatear(npc, mina) {
  const p = { x: Math.floor(npc.location.x), y: Math.floor(npc.location.y), z: Math.floor(npc.location.z) };
  let mejor;
  let md = Infinity;
  for (let dx = -4; dx <= 4; dx++) for (let dy = -1; dy <= 2; dy++) for (let dz = -4; dz <= 4; dz++) {
    const b = blockAt(npc.dimension, { x: p.x + dx, y: p.y + dy, z: p.z + dz });
    if (!b || !b.typeId.endsWith("_ore")) continue;
    const d = Math.abs(dx) + Math.abs(dz);
    if (d < md) {
      md = d;
      mejor = { dx, dz };
    }
  }
  if (!mejor || md === 0) return;
  const dir = Math.abs(mejor.dx) >= Math.abs(mejor.dz) ? { x: Math.sign(mejor.dx), z: 0 } : { x: 0, z: Math.sign(mejor.dz) };
  if (dir.x === -mina.dir.x && dir.z === -mina.dir.z) return; // no da media vuelta
  if (dir.x !== mina.dir.x || dir.z !== mina.dir.z) {
    mina.dir = dir;
    mina.cola = [];
    burst(npc, PARTICLES.idea, { x: 0, y: 2.2, z: 0 });
  }
}

export function enSuperficie(npc) {
  const top = superficie(npc.dimension, npc.location.x, npc.location.z);
  return !top || top.location.y < npc.location.y + 1;
}

// Un golpe de pico (o un paso) del ciclo escalera → túnel → subida.
function paso(npc, state) {
  const mina = state.mina;
  if (mina.modo === "subida" && enSuperficie(npc)) {
    state.mina = undefined;
    return;
  }
  if (revisarAtasco(npc, state)) return;
  if (seAtasco(npc)) mina.fallos = (mina.fallos ?? 0) + 1;
  if (!mina.cola.length) planificarPaso(npc, mina);
  const pos = mina.cola[0];
  const block = blockAt(npc.dimension, pos);
  if (!block || block.typeId.includes("lava") || (block.isLiquid && !block.isAir)) return cambiarRumbo(state);

  if (!block.isAir) {
    sostener(npc, pico(state));
    mirarA(npc, centro(pos));
    animate(npc, ANIM.minar);
    // Minería 1: pico rápido.
    const t = Math.max(6, Math.round(MINERIA.pasoCada * (state.pers?.ritmo ?? 1) * (nivelHab(npc, state, "mineria") >= 1 ? 0.7 : 1)));
    state.ocupadoHasta = now() + t;
    system.runTimeout(() => {
      if (!npc.isValid || !state.mina) return;
      if (!romper(npc, state, blockAt(npc.dimension, pos))) return cambiarRumbo(state);
      mina.cola.shift();
      mina.fallos = 0;
      aprender(npc, state, 0.05);
      if (mina.pasos % 6 === 0) practicar(npc, state, "mineria", 0.03);
    }, t - 4);
    return;
  }
  mina.cola.shift();
  if (mina.cola.length) return;
  // Minería 2: olfato de minerales. En el túnel, si huele una veta cerca, va hacia ella.
  if (mina.modo === "tunel" && mina.pasos % 3 === 0 && nivelHab(npc, state, "mineria") >= 2) olfatear(npc, mina);

  const atras = { ...npc.location };
  // Avanza un paso con el motor (sube el escalón solo si hace falta).
  const sube = mina.modo === "subida" ? 1 : 0;
  caminarA(npc, { x: Math.floor(npc.location.x) + mina.dir.x + 0.5, y: Math.floor(npc.location.y) + sube,
    z: Math.floor(npc.location.z) + mina.dir.z + 0.5 }, 0.2);
  state.ocupadoHasta = now() + 6;
  mina.pasos++;
  if (mina.pasos % MINERIA.antorchaCada === 0) system.runTimeout(() => npc.isValid && ponerAntorcha(npc, atras), 12);
  const profundidad = state.pers?.profundidad ?? 20;
  const tunel = state.pers?.tunel ?? 10;
  if (mina.modo === "escalera" && (mina.pasos >= profundidad || npc.location.y < -54)) {
    mina.modo = "tunel";
    mina.pasos = 0;
    cambiarRumbo(state);
  } else if (mina.modo === "tunel" && mina.pasos >= tunel) {
    mina.modo = "subida";
    mina.pasos = 0;
  }
}

export const minar = {
  nombre: "minando",
  // Nunca empieza a minar dentro o al lado de una casa o del aula.
  puede: (npc) => MODIFICA_MUNDO && !ocupado(npc.location.x, npc.location.z, 3),
  duracion: () => 9000, // termina al volver a la superficie
  iniciar(npc, state, a) {
    state.mina ??= nuevaMina(npc);
    a.subirEn = now() + rand(1800, 3200);
    return true;
  },
  tick(npc, state, a) {
    if (!state.mina) return true;
    if (caminando(npc)) return false;
    // Ya minó bastante: empieza a subir.
    if (now() > a.subirEn && state.mina.modo !== "subida") {
      state.mina.modo = "subida";
      state.mina.cola = [];
    }
    paso(npc, state);
    return !state.mina;
  },
};
