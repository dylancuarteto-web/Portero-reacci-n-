import { system } from "@minecraft/server";
import { ANIM, CRAFTEO, MINERIA, MODIFICA_MUNDO, PARTICLES, PICOS } from "./config.js";
import { romper } from "./construccion.js";
import { pico, sostener, vestir } from "./equipo.js";
import { aprender } from "./iq.js";
import { velocidad } from "./movimiento.js";
import { animate, blockAt, burst, impulse, mirarA, now, particleAt, rand, sound } from "./util.js";

// Lo que "saca" de la mesa cuando no le alcanza para una mejora.
const EXTRAS = ["minecraft:torch", "minecraft:bread", "minecraft:arrow", "minecraft:bow", "minecraft:ladder",
  "minecraft:compass", "minecraft:lantern", "minecraft:bucket"];
const CARDINALES = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];

const centro = (b) => ({ x: b.x + 0.5, y: b.y + 0.5, z: b.z + 0.5 });

function nuevaMina(npc) {
  const v = npc.getViewDirection();
  const dir = Math.abs(v.x) > Math.abs(v.z) ? { x: Math.sign(v.x) || 1, z: 0 } : { x: 0, z: Math.sign(v.z) || 1 };
  return { dir, pasos: 0, modo: "escalera", cola: [] };
}

// Bloques a despejar para el siguiente paso: escalera hacia abajo o túnel recto.
function planificarPaso(npc, mina) {
  const x = Math.floor(npc.location.x) + mina.dir.x;
  const y = Math.floor(npc.location.y);
  const z = Math.floor(npc.location.z) + mina.dir.z;
  mina.cola = mina.modo === "escalera"
    ? [{ x, y: y + 1, z }, { x, y, z }, { x, y: y - 1, z }]
    : [{ x, y: y + 1, z }, { x, y, z }];
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

// Mina en escalera hacia abajo y luego en túnel, un bloque por golpe, a ritmo humano.
function minar(npc, state) {
  state.mina ??= nuevaMina(npc);
  const mina = state.mina;
  if (!mina.cola.length) planificarPaso(npc, mina);
  const pos = mina.cola[0];
  const block = blockAt(npc.dimension, pos);
  if (!block) return cambiarRumbo(state);
  if (block.typeId.includes("lava") || (block.isLiquid && !block.isAir)) return cambiarRumbo(state);

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

  // Paso hacia delante (y abajo si es escalera), caminando.
  const atras = { ...npc.location };
  impulse(npc, { x: mina.dir.x * 0.22, y: 0, z: mina.dir.z * 0.22 });
  state.ocupadoHasta = now() + 10;
  mina.pasos++;
  if (mina.pasos % MINERIA.antorchaCada === 0) system.runTimeout(() => npc.isValid && ponerAntorcha(npc, atras), 12);
  const limite = mina.modo === "escalera" ? MINERIA.profundidad : MINERIA.tunel;
  if (mina.pasos >= limite || (mina.modo === "escalera" && npc.location.y < -54)) {
    mina.modo = mina.modo === "escalera" ? "tunel" : "escalera";
    mina.pasos = 0;
    cambiarRumbo(state);
  }
}

function lugarMesa(npc) {
  for (const d of CARDINALES) {
    const p = { x: npc.location.x + d.x * 1.3, y: npc.location.y, z: npc.location.z + d.z * 1.3 };
    const b = blockAt(npc.dimension, p);
    const suelo = blockAt(npc.dimension, { x: p.x, y: p.y - 1, z: p.z });
    if (b?.isAir && suelo && !suelo.isAir) return b;
  }
  return undefined;
}

// Simula craftear despacio: pone la mesa, la mira trabajando unos 9 s, saca el objeto
// y luego recoge la mesa.
function craftear(npc, state) {
  const mesa = lugarMesa(npc);
  if (!mesa) return false;
  const where = { ...mesa.location };
  const arriba = { x: where.x + 0.5, y: where.y + 1, z: where.z + 0.5 };
  sostener(npc, "minecraft:crafting_table");
  animate(npc, ANIM.colocar);
  try {
    mesa.setType("minecraft:crafting_table");
  } catch {
    return false;
  }
  state.ocupadoHasta = now() + CRAFTEO.duracion + 50;
  system.runTimeout(() => npc.isValid && sostener(npc, "minecraft:air"), 12);
  for (let t = 16; t < CRAFTEO.duracion; t += 60) {
    system.runTimeout(() => {
      if (!npc.isValid) return;
      mirarA(npc, arriba);
      animate(npc, ANIM.crafteo);
    }, t);
  }
  for (let t = 30; t < CRAFTEO.duracion; t += 25) {
    system.runTimeout(() => {
      particleAt(npc.dimension, PARTICLES.crafteo, arriba);
      if (npc.isValid) sound(npc, "random.wood_click", 1.1);
    }, t);
  }
  system.runTimeout(() => {
    if (!npc.isValid) return;
    let resultado;
    if (state.minados >= CRAFTEO.picoCuesta && state.nivelPico < PICOS.length - 1) {
      state.minados -= CRAFTEO.picoCuesta;
      state.nivelPico++;
      resultado = pico(state);
    } else if (state.minados >= CRAFTEO.armaduraCuesta && state.nivelArmadura < 4) {
      state.minados -= CRAFTEO.armaduraCuesta;
      state.nivelArmadura++;
      vestir(npc, state.nivelArmadura);
      resultado = "minecraft:anvil";
    } else {
      resultado = EXTRAS[rand(0, EXTRAS.length - 1)];
    }
    sostener(npc, resultado);
    burst(npc, PARTICLES.cambio, { x: 0, y: 1.4, z: 0 });
    sound(npc, "random.levelup", 1.6);
    aprender(npc, state, 0.5);
  }, CRAFTEO.duracion);
  system.runTimeout(() => {
    try {
      const b = blockAt(npc.dimension, where);
      if (b?.typeId === "minecraft:crafting_table") b.setType("minecraft:air");
      if (npc.isValid) sostener(npc, pico(state));
    } catch {
      // La mesa ya no está.
    }
  }, CRAFTEO.duracion + 40);
  return true;
}

export function tickTrabajo(npc, state) {
  if (!MODIFICA_MUNDO || now() < state.ocupadoHasta) return;
  velocidad(npc, 0); // mientras trabaja se mueve solo con sus pasos de minero
  if (now() >= (state.cd.craftear ?? now() + 400) && craftear(npc, state)) {
    state.cd.craftear = now() + rand(...CRAFTEO.espera);
    return;
  }
  state.cd.craftear ??= now() + 400;
  minar(npc, state);
}
