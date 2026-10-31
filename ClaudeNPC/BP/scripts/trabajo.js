import { system, world } from "@minecraft/server";
import { ANIM, BOTE, CASA, CRAFTEO, MINERIA, MODIFICA_MUNDO, PICOS } from "./config.js";
import { buscarAgua, subirABote } from "./bote.js";
import { romper } from "./construccion.js";
import { simularCrafteo } from "./crafteo.js";
import { pico, sostener, vestir } from "./equipo.js";
import { aprender } from "./iq.js";
import { caminarA, caminando, velocidad } from "./movimiento.js";
import { empezarCasa, tickCasa } from "./obras/casa.js";
import { animate, blockAt, impulse, mirarA, now, rand, superficie } from "./util.js";

// Rutina sin jugadores cerca, como un jugador de supervivencia:
// primero su casa; luego mina en escalera, túnel y de vuelta a la superficie;
// craftea de vez en cuando, da paseos en bote si hay agua y de noche vuelve a casa.

const EXTRAS = ["minecraft:torch", "minecraft:bread", "minecraft:arrow", "minecraft:bow", "minecraft:ladder",
  "minecraft:compass", "minecraft:lantern", "minecraft:bucket"];
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

function enSuperficie(npc) {
  const top = superficie(npc.dimension, npc.location.x, npc.location.z);
  return !top || top.location.y < npc.location.y + 1;
}

// Mina un bloque por golpe a ritmo humano; el ciclo es escalera → túnel → subida.
function minar(npc, state) {
  state.mina ??= nuevaMina(npc);
  const mina = state.mina;
  if (mina.modo === "subida" && enSuperficie(npc)) {
    state.mina = undefined;
    state.cd.mina = now() + rand(600, 1200); // descansa en la superficie antes de volver a bajar
    return;
  }
  if (!mina.cola.length) planificarPaso(npc, mina);
  const pos = mina.cola[0];
  const block = blockAt(npc.dimension, pos);
  if (!block || block.typeId.includes("lava") || (block.isLiquid && !block.isAir)) return cambiarRumbo(state);

  if (!block.isAir) {
    sostener(npc, pico(state));
    mirarA(npc, centro(pos));
    animate(npc, ANIM.minar);
    state.ocupadoHasta = now() + MINERIA.pasoCada;
    system.runTimeout(() => {
      if (!npc.isValid) return;
      if (!romper(npc, state, blockAt(npc.dimension, pos))) return cambiarRumbo(state);
      mina.cola.shift();
      aprender(npc, state, 0.05);
    }, MINERIA.pasoCada - 4);
    return;
  }
  mina.cola.shift();
  if (mina.cola.length) return;

  const atras = { ...npc.location };
  if (mina.modo === "subida") impulse(npc, { x: mina.dir.x * 0.17, y: 0.42, z: mina.dir.z * 0.17 });
  else impulse(npc, { x: mina.dir.x * 0.22, y: 0, z: mina.dir.z * 0.22 });
  state.ocupadoHasta = now() + 10;
  mina.pasos++;
  if (mina.pasos % MINERIA.antorchaCada === 0) system.runTimeout(() => npc.isValid && ponerAntorcha(npc, atras), 12);
  if (mina.modo === "escalera" && (mina.pasos >= MINERIA.profundidad || npc.location.y < -54)) {
    mina.modo = "tunel";
    mina.pasos = 0;
    cambiarRumbo(state);
  } else if (mina.modo === "tunel" && mina.pasos >= MINERIA.tunel) {
    mina.modo = "subida";
    mina.pasos = 0;
  }
}

function craftearMejora(npc, state) {
  return simularCrafteo(npc, state, () => {
    if (state.minados >= CRAFTEO.picoCuesta && state.nivelPico < PICOS.length - 1) {
      state.minados -= CRAFTEO.picoCuesta;
      state.nivelPico++;
      return pico(state);
    }
    if (state.minados >= CRAFTEO.armaduraCuesta && state.nivelArmadura < 4) {
      state.minados -= CRAFTEO.armaduraCuesta;
      state.nivelArmadura++;
      vestir(npc, state.nivelArmadura);
      return "minecraft:anvil";
    }
    return EXTRAS[rand(0, EXTRAS.length - 1)];
  }, CRAFTEO.duracion, () => sostener(npc, pico(state)));
}

// Paseo en bote: camina hasta el agua y rema hasta otro punto del lago o río.
function paseoEnBote(npc, state) {
  const agua = state.paseo ?? buscarAgua(npc.dimension, npc.location, 3, 14);
  if (!agua) return false;
  state.paseo = agua;
  const d = Math.hypot(agua.x - npc.location.x, agua.z - npc.location.z);
  if (d > 1.8) {
    caminarA(npc, agua, 0.2);
    state.ocupadoHasta = now() + 10;
    state.paseoIntentos = (state.paseoIntentos ?? 0) + 1;
    if (state.paseoIntentos > 20) {
      state.paseo = undefined;
      state.paseoIntentos = 0;
    }
    return true;
  }
  const lejos = buscarAgua(npc.dimension, agua, 10, 26) ?? agua;
  state.paseo = undefined;
  state.paseoIntentos = 0;
  return subirABote(npc, state, lejos, true);
}

function esDeNoche() {
  const t = world.getTimeOfDay();
  return t > 13000 && t < 23000;
}

export function tickTrabajo(npc, state) {
  if (!MODIFICA_MUNDO) return;
  if (state.casa) {
    velocidad(npc, 0);
    tickCasa(npc, state);
    return;
  }
  if (now() < state.ocupadoHasta || caminando(npc)) return;
  velocidad(npc, 0); // mientras trabaja se mueve con sus propios pasos

  // De noche vuelve a casa y se queda dentro.
  if (state.hogar && esDeNoche() && !state.mina) {
    const d = Math.hypot(state.hogar.x - npc.location.x, state.hogar.z - npc.location.z);
    if (d > 1.5 && d < 64) {
      caminarA(npc, state.hogar, 0.2);
      state.ocupadoHasta = now() + 20;
    } else {
      state.ocupadoHasta = now() + rand(40, 80);
    }
    return;
  }
  state.cd.casa ??= now() + CASA.primeraVez;
  if (!state.hogar && now() >= state.cd.casa && enSuperficie(npc)) {
    empezarCasa(npc, state);
    return;
  }
  state.cd.bote ??= now() + rand(...BOTE.paseoCada);
  if (!state.mina && now() >= state.cd.bote) {
    if (!paseoEnBote(npc, state)) state.cd.bote = now() + rand(...BOTE.paseoCada);
    else if (!state.paseo) state.cd.bote = now() + rand(...BOTE.paseoCada);
    return;
  }
  state.cd.craftear ??= now() + 600;
  if (!state.mina && now() >= state.cd.craftear && craftearMejora(npc, state)) {
    state.cd.craftear = now() + rand(...CRAFTEO.espera);
    return;
  }
  if (now() >= (state.cd.mina ?? 0)) minar(npc, state);
}
