import { DyeColor, ItemStack, system } from "@minecraft/server";
import { ANIM, CASA, PARTICLES } from "../config.js";
import { sostener } from "../equipo.js";
import { nivel } from "../iq.js";
import { caminarA, caminando } from "../movimiento.js";
import { perlaHasta } from "../tacticas.js";
import {
  animate, blockAt, burst, colocar, distancia, mirarA, now, particleAt, rand, reemplazable, sound,
} from "../util.js";
import { esNatural } from "./terreno.js";
import { iniciarTorre } from "./torre.js";

// Ejecuta un plano paso a paso como un jugador: camina hasta tener el bloque a su
// alcance, lo mira, saca el objeto, lo coloca (o lo quita) y sigue. Con más IQ
// encadena dos o tres bloques seguidos, como quien construye rápido. Lo usan la
// casa de cada Claude y el aula de Claude Maestro.
//
// obra = { plan, i, c, pararse(pos) → punto donde pararse, lejos, colocados, pausa,
//         salvo(pos) → true si es de otra obra (no se toca), terreno: nº de pasos de
//         preparar el terreno al principio del plano }
//
// Nunca deshace lo que ya construyó (al retomar una obra tras recargar el mundo se
// salta lo hecho) y al terminar revisa el plano entero: si falta algún bloque (agua
// que volvió a entrar, hojas, tierra), lo vuelve a poner. Así la obra queda completa.

const IRROMPIBLES = new Set(["minecraft:bedrock", "minecraft:obsidian", "minecraft:barrier", "minecraft:chest",
  "minecraft:crafting_table", "minecraft:furnace", "minecraft:spawner", "minecraft:lectern", "minecraft:bell"]);

const idDe = (bloque) => (typeof bloque === "string" ? bloque : bloque.type.id);

function itemDe(bloque) {
  const id = idDe(bloque);
  if (id === "minecraft:grass_path") return "minecraft:wooden_shovel";
  if (id.endsWith("_wall_sign") || id === "minecraft:wall_sign") return "minecraft:oak_sign";
  if (id === "minecraft:wooden_door") return "minecraft:wooden_door";
  return id;
}

function sonidoDe(id) {
  return /planks|log|door|chest|table|slab|stairs|campfire|bookshelf|sign|lectern|fence/.test(id) ? "use.wood" : "use.stone";
}

function herramienta(id) {
  if (id.endsWith("_log") || id.endsWith("_leaves")) return "minecraft:stone_axe";
  if (/dirt|grass|sand|gravel|clay|snow|mud/.test(id)) return "minecraft:wooden_shovel";
  return "minecraft:stone_pickaxe";
}

function cerca(npc, pos, alcance) {
  const cabeza = { x: npc.location.x, y: npc.location.y + 1.6, z: npc.location.z };
  return distancia(cabeza, { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 }) <= alcance;
}

const centroDe = (p) => ({ x: p.x + 0.5, y: p.y, z: p.z + 0.5 });

function acercarse(npc, state, obra, paso) {
  paso.intentos = (paso.intentos ?? 0) + 1;
  if (paso.intentos > (paso.terreno ? 1 : 3)) return false;
  const destino = paso.tipo === "ir" || paso.tipo === "celebrar" ? centroDe(paso.pos)
    : paso.desde ? centroDe(paso.desde) : obra.pararse(paso.pos);
  caminarA(npc, destino, state.pers?.paso ?? 0.22);
  state.ocupadoHasta = now() + 4;
  return true;
}

// Ritmo de un jugador rápido: unos 4-6 bloques por segundo con pausas cortas.
function ritmo(state, obra) {
  obra.colocados = (obra.colocados ?? 0) + 1;
  state.ocupadoHasta = now() + Math.round(rand(2, 4) * (state.pers?.ritmo ?? 1));
  if (obra.colocados % 55 === 0) obra.pausa = true; // de vez en cuando se detiene y mira
}

const claveDe = (p) => `${p.x},${p.y},${p.z}`;

// Qué bloque debe quedar en cada posición según el plano (para no deshacerlo).
function esperado(obra) {
  if (!obra.esperado) {
    obra.esperado = new Map();
    for (const p of obra.base ?? obra.plan) {
      if (p.pos && (p.tipo === "colocar" || p.tipo === "letrero")) obra.esperado.set(claveDe(p.pos), idDe(p.bloque));
    }
  }
  return obra.esperado;
}

// ¿Este paso ya no hace falta (bloque libre o ya colocado)?
function sobra(npc, paso, obra) {
  const b = paso.pos ? blockAt(npc.dimension, paso.pos) : undefined;
  if (paso.terreno && obra?.salvo?.(paso.pos)) return true; // es de otra obra
  if (paso.tipo === "quitar") {
    if (!b || b.isAir || IRROMPIBLES.has(b.typeId)) return true;
    if (obra && esperado(obra).get(claveDe(paso.pos)) === b.typeId) return true; // ya está construido
    return !!paso.terreno && !reemplazable(b) && !esNatural(b);
  }
  if (paso.tipo === "rellenar") return !!b && !b.isAir && !b.isLiquid && !reemplazable(b);
  if (paso.tipo === "colocar" || paso.tipo === "letrero") {
    if (!b) return true;
    const forzar = paso.forzar || paso.tipo === "letrero";
    return forzar ? b.typeId === idDe(paso.bloque) && paso.tipo !== "letrero" : !reemplazable(b);
  }
  return false;
}

export function escribirLetrero(dimension, pos, texto, blanco = true) {
  try {
    const sign = blockAt(dimension, pos)?.getComponent("minecraft:sign");
    if (!sign) return false;
    sign.setText(texto);
    if (blanco) sign.setTextDyeColor(DyeColor.White);
    sign.setWaxed(true);
    return true;
  } catch {
    return false;
  }
}

function colocarPaso(npc, paso, retraso) {
  const forzar = paso.forzar || paso.tipo === "rellenar" || paso.tipo === "letrero";
  system.runTimeout(() => {
    if (!npc.isValid) return;
    if (retraso > 0) animate(npc, paso.pos.y < npc.location.y ? ANIM.colocarAbajo : ANIM.colocar);
    if (!colocar(npc.dimension, paso.pos, paso.bloque, forzar)) return;
    sound(npc, sonidoDe(idDe(paso.bloque)), rand(9, 11) / 10);
    if (paso.tipo === "letrero") system.runTimeout(() => escribirLetrero(npc.dimension, paso.pos, paso.texto ?? "", paso.blanco !== false), 2);
  }, 3 + retraso);
}

// Quita un bloque como un jugador (con la herramienta adecuada). El terreno que pica
// para aplanar no suelta objetos: así no se llena el suelo de cosas (y no da lag).
function quitarBloque(npc, paso, b, retraso) {
  if (!b) return;
  const rapido = reemplazable(b);
  const tipo = b.typeId;
  const centroPaso = { x: paso.pos.x + 0.5, y: paso.pos.y + 0.5, z: paso.pos.z + 0.5 };
  if (retraso === 0) {
    mirarA(npc, centroPaso);
    sostener(npc, rapido ? "minecraft:air" : herramienta(tipo));
    animate(npc, rapido ? ANIM.golpe : ANIM.minar);
  }
  system.runTimeout(() => {
    try {
      const x = blockAt(npc.dimension, paso.pos);
      if (x?.typeId !== tipo) return;
      x.setType("minecraft:air");
      if (!rapido && !paso.terreno && !tipo.endsWith("_leaves")) npc.dimension.spawnItem(new ItemStack(tipo, 1), centroPaso);
      particleAt(npc.dimension, PARTICLES.construir, centroPaso);
      if (paso.terreno && Math.random() < 0.35) sound(npc, /sand|dirt|grass|gravel|clay|mud|snow/.test(tipo) ? "dig.gravel" : /log|wood|leaves/.test(tipo) ? "dig.wood" : "dig.stone", 1, 0.6);
    } catch {
      // Ya no está.
    }
  }, (rapido ? 2 : paso.terreno ? 3 : 8) + retraso);
}

const EQUIVALENTES = { "minecraft:grass_block": "minecraft:dirt", "minecraft:water": "minecraft:flowing_water", "minecraft:grass_path": "minecraft:dirt" };

function falta(b, p) {
  if (p.tipo === "rellenar") return b.isAir || b.isLiquid || reemplazable(b);
  const id = idDe(p.bloque);
  return b.typeId !== id && EQUIVALENTES[id] !== b.typeId;
}

// Al terminar el plano lo revisa entero (hasta dos veces): lo que falte (agua que volvió
// a entrar, hojas, tierra, un bloque que no se pudo poner) lo vuelve a poner, aunque
// tenga que reemplazar lo que haya. Devuelve true cuando la obra está completa.
function revisar(npc, obra) {
  obra.base ??= obra.plan;
  if ((obra.revisiones ?? 0) >= 2) return true;
  obra.revisiones = (obra.revisiones ?? 0) + 1;
  const faltan = [];
  for (const p of obra.base) {
    if (!p.pos || !(p.tipo === "colocar" || p.tipo === "letrero" || p.tipo === "rellenar")) continue;
    if (obra.salvo?.(p.pos)) continue; // lo de otra obra (el aula vecina) no se toca
    const b = blockAt(npc.dimension, p.pos);
    if (!b || IRROMPIBLES.has(b.typeId) || !falta(b, p)) continue;
    faltan.push({ ...p, forzar: true, intentos: 0 });
  }
  if (!faltan.length) return true;
  obra.plan = faltan;
  obra.i = 0;
  obra.revisando = true;
  return false;
}

// Devuelve true cuando el plano está terminado.
export function ejecutarPlano(npc, state, obra) {
  // Mientras aplana puede picar caminando; en el resto de la obra primero llega y luego trabaja.
  if (caminando(npc) && !obra.plan[obra.i]?.terreno) return false;
  // Si se alejó (por ejemplo, tras una pelea o una clase), primero vuelve a la obra.
  if (Math.hypot(npc.location.x - (obra.c.x + 0.5), npc.location.z - (obra.c.z + 0.5)) > (obra.lejos ?? 10) && !state.obra) {
    const destino = { x: obra.c.x + 0.5, y: obra.c.y + 1, z: obra.c.z + 0.5 };
    if (!caminando(npc)) {
      obra.volver = (obra.volver ?? 0) + 1;
      if (obra.volver > 4) {
        perlaHasta(npc, destino); // no encuentra el camino de vuelta: llega con una perla
        obra.volver = 0;
      } else {
        caminarA(npc, destino, state.pers?.paso ?? 0.22);
      }
    }
    state.ocupadoHasta = now() + 10;
    return false;
  }
  obra.volver = 0;
  if (obra.pausa) {
    obra.pausa = false;
    const a = Math.random() * Math.PI * 2;
    mirarA(npc, { x: npc.location.x + Math.cos(a) * 6, y: npc.location.y + 1.5, z: npc.location.z + Math.sin(a) * 6 });
    state.ocupadoHasta = now() + rand(12, 24);
    return false;
  }
  // Salta rápido los pasos que no hacen falta (y lo que ya está hecho).
  for (let saltos = 0; saltos < 120; saltos++) {
    const paso = obra.plan[obra.i];
    if (!paso) return revisar(npc, obra);
    if (!sobra(npc, paso, obra)) break;
    obra.i++;
  }
  const paso = obra.plan[obra.i];
  if (!paso) return revisar(npc, obra);
  const alcance = paso.terreno ? 12 : paso.techo ? CASA.alcanceTecho : CASA.alcance;

  switch (paso.tipo) {
    case "ir": {
      if (Math.hypot(npc.location.x - (paso.pos.x + 0.5), npc.location.z - (paso.pos.z + 0.5)) > 0.8 && acercarse(npc, state, obra, paso)) return false;
      obra.i++;
      return false;
    }
    case "andamio":
      iniciarTorre(npc, state, paso.hasta, "minecraft:dirt", true);
      obra.i++;
      return false;
    case "bajar": {
      // Quita el andamio de tierra bajo sus pies, uno a uno.
      const bajo = blockAt(npc.dimension, { x: npc.location.x, y: npc.location.y - 1, z: npc.location.z });
      if (paso.veces <= 0 || bajo?.typeId !== "minecraft:dirt") {
        obra.i++;
        return false;
      }
      sostener(npc, "minecraft:wooden_shovel");
      mirarA(npc, { x: npc.location.x, y: npc.location.y - 1, z: npc.location.z });
      animate(npc, ANIM.minar);
      const pos = { ...bajo.location };
      system.runTimeout(() => {
        const x = blockAt(npc.dimension, pos);
        if (x?.typeId === "minecraft:dirt") x.setType("minecraft:air");
        if (npc.isValid) sound(npc, "dig.gravel", 1);
      }, 6);
      paso.veces--;
      state.ocupadoHasta = now() + 10;
      return false;
    }
    case "puerta": {
      if (!cerca(npc, paso.pos, alcance) && acercarse(npc, state, obra, paso)) return false;
      for (const h of [0, 1]) {
        const b = blockAt(npc.dimension, { x: paso.pos.x, y: paso.pos.y + h, z: paso.pos.z });
        if (b?.typeId !== "minecraft:wooden_door") continue;
        try {
          b.setPermutation(b.permutation.withState("open_bit", paso.abrir));
        } catch {
          // Puerta sin ese estado.
        }
      }
      mirarA(npc, { x: paso.pos.x + 0.5, y: paso.pos.y + 1, z: paso.pos.z + 0.5 });
      animate(npc, ANIM.colocar);
      sound(npc, paso.abrir ? "random.door_open" : "random.door_close", 1);
      obra.i++;
      state.ocupadoHasta = now() + 8;
      return false;
    }
    case "celebrar": {
      if (Math.hypot(npc.location.x - (paso.pos.x + 0.5), npc.location.z - (paso.pos.z + 0.5)) > 1 && acercarse(npc, state, obra, paso)) return false;
      const m = paso.mira ?? obra.c;
      mirarA(npc, { x: m.x + 0.5, y: m.y + 0.5, z: m.z + 0.5 });
      animate(npc, obra.animCelebrar ?? ANIM.celebrar);
      burst(npc, PARTICLES.idea, { x: 0, y: 2.2, z: 0 });
      burst(npc, PARTICLES.confeti, { x: 0, y: 2, z: 0 });
      sound(npc, "random.levelup", 1.2);
      obra.i++;
      state.ocupadoHasta = now() + 40;
      return false;
    }
    default:
      break;
  }

  // Aplanando: pica o rellena lo que tenga a su alcance (hasta 12 bloques) y, si queda
  // lejos, va caminando hacia allá sin dejar de trabajar.
  if (paso.terreno) {
    const cabeza = { x: npc.location.x, y: npc.location.y + 1.6, z: npc.location.z };
    const d = distancia(cabeza, { x: paso.pos.x + 0.5, y: paso.pos.y + 0.5, z: paso.pos.z + 0.5 });
    if (d > 6 && !caminando(npc)) {
      caminarA(npc, { x: paso.pos.x + 0.5, y: npc.location.y, z: paso.pos.z + 0.5 }, state.pers?.paso ?? 0.22);
    }
    if (d > alcance) {
      paso.intentos = (paso.intentos ?? 0) + 1;
      if (paso.intentos <= 2) {
        state.ocupadoHasta = now() + 6;
        return false;
      }
    }
  } else if (!cerca(npc, paso.pos, alcance) && acercarse(npc, state, obra, paso)) return false;
  const b = blockAt(npc.dimension, paso.pos);
  const centroPaso = { x: paso.pos.x + 0.5, y: paso.pos.y + 0.5, z: paso.pos.z + 0.5 };
  obra.i++;
  if (!b) return false;
  mirarA(npc, centroPaso);
  if (paso.tipo === "quitar") {
    quitarBloque(npc, paso, b, 0);
    // Preparando el terreno pica rápido: varios bloques seguidos que tenga al alcance.
    let ultimo = paso;
    if (paso.terreno) {
      const cadena = 1 + Math.min(3, Math.floor(nivel(state) * 3));
      for (let k = 1; k < cadena; k++) {
        const sig = obra.plan[obra.i];
        if (!sig || sig.tipo !== "quitar" || !sig.terreno || sobra(npc, sig, obra) || !cerca(npc, sig.pos, 12)) break;
        obra.i++;
        quitarBloque(npc, sig, blockAt(npc.dimension, sig.pos), k * 2);
        ultimo = sig;
      }
    }
    const rapido = reemplazable(blockAt(npc.dimension, ultimo.pos));
    state.ocupadoHasta = now() + (paso.terreno ? 4 : rapido ? 3 : 10);
    return false;
  }
  if (paso.tipo === "rellenar" && paso.terreno) {
    // Rellena huecos de abajo arriba, también en cadena.
    sostener(npc, itemDe(paso.bloque));
    animate(npc, ANIM.colocarAbajo);
    colocarPaso(npc, paso, 0);
    const cadena = 1 + Math.min(3, Math.floor(nivel(state) * 3));
    for (let k = 1; k < cadena; k++) {
      const sig = obra.plan[obra.i];
      if (!sig || sig.tipo !== "rellenar" || !sig.terreno || sobra(npc, sig, obra) || !cerca(npc, sig.pos, 12)) break;
      obra.i++;
      colocarPaso(npc, sig, k * 2);
    }
    state.ocupadoHasta = now() + 4;
    return false;
  }
  if (paso.tipo === "camino") {
    if (!/grass_block|dirt/.test(b.typeId)) return false;
    sostener(npc, "minecraft:wooden_shovel");
    animate(npc, ANIM.colocarAbajo);
    colocar(npc.dimension, paso.pos, "minecraft:grass_path", true);
    sound(npc, "dig.grass", 1);
    ritmo(state, obra);
    return false;
  }
  sostener(npc, itemDe(paso.bloque));
  animate(npc, paso.pos.y < npc.location.y ? ANIM.colocarAbajo : ANIM.colocar);
  colocarPaso(npc, paso, 0);
  // Con práctica encadena más bloques del mismo tipo que tenga a su alcance.
  const extra = Math.floor(nivel(state) * 2.2);
  const primero = idDe(paso.bloque);
  for (let k = 1; k <= extra; k++) {
    const sig = obra.plan[obra.i];
    if (!sig || sig.tipo !== "colocar" || idDe(sig.bloque) !== primero || sobra(npc, sig, obra)) break;
    if (!cerca(npc, sig.pos, sig.techo ? CASA.alcanceTecho : CASA.alcance)) break;
    obra.i++;
    colocarPaso(npc, sig, k * 3);
  }
  ritmo(state, obra);
  return false;
}
