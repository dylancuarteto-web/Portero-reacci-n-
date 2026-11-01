import { BlockPermutation, ItemStack, system } from "@minecraft/server";
import { ANIM, CASA, PARTICLES } from "../config.js";
import { simularCrafteo } from "../crafteo.js";
import { hacha, sostener } from "../equipo.js";
import { dentroDeOtra, mismaObra, ocupado, registrar } from "../estructuras.js";
import { aprender, ponerHaciendo } from "../iq.js";
import { caminarA, detener, velocidad } from "../movimiento.js";
import { planCasa } from "../planes/casa_plano.js";
import { animate, blockAt, colocar, mirarA, now, particleAt, piso, reemplazable, sound, superficie } from "../util.js";
import { ejecutarPlano } from "./plano.js";
import { planTerreno } from "./terreno.js";

// Casa construida como la haría un jugador (ahora a buen ritmo):
//  1. tala un árbol cercano (y planta un brote), 2. craftea, 3. busca un terreno plano,
//  4. construye con el estilo de su personalidad (roble, abeto, abedul, piedra o ladrillo).

const perm = (id, estados) => BlockPermutation.resolve(id, estados);

// --- 1. Talar ------------------------------------------------------------------

export function buscarTronco(npc, radio = 10, evitar) {
  const p = piso(npc.location);
  let mejor;
  let md = Infinity;
  for (let dx = -radio; dx <= radio; dx++) {
    for (let dz = -radio; dz <= radio; dz++) {
      const d2 = dx * dx + dz * dz;
      if (d2 > radio * radio || d2 >= md) continue;
      const top = superficie(npc.dimension, p.x + dx, p.z + dz);
      if (!top || !(top.typeId.endsWith("_leaves") || top.typeId.endsWith("_log"))) continue;
      let base;
      for (let y = top.location.y; y >= top.location.y - 12; y--) {
        const b = blockAt(npc.dimension, { x: p.x + dx, y, z: p.z + dz });
        if (b?.typeId.endsWith("_log")) base = b.location;
        else if (base) break;
      }
      if (base && !evitar?.has(`${base.x},${base.z}`)) {
        mejor = base;
        md = d2;
      }
    }
  }
  return mejor;
}

// Un golpe de tala: devuelve "caminando", "talando" o "listo".
export function talarPaso(npc, state, t) {
  const base = t.tronco;
  const centroTronco = { x: base.x + 0.5, y: base.y, z: base.z + 0.5 };
  const lejos = Math.hypot(npc.location.x - centroTronco.x, npc.location.z - centroTronco.z);
  if (lejos > 2.2) {
    const dx = npc.location.x - centroTronco.x;
    const dz = npc.location.z - centroTronco.z;
    const d = Math.hypot(dx, dz) || 1;
    caminarA(npc, { x: centroTronco.x + (dx / d) * 1.4, y: base.y, z: centroTronco.z + (dz / d) * 1.4 }, state.pers?.paso ?? 0.2);
    t.intentos = (t.intentos ?? 0) + 1;
    state.ocupadoHasta = now() + 10;
    return t.intentos > 12 ? "listo" : "caminando";
  }
  t.altura ??= 0;
  const pos = { x: base.x, y: base.y + t.altura, z: base.z };
  const tronco = blockAt(npc.dimension, pos);
  if (!tronco?.typeId.endsWith("_log") || t.altura > 6) {
    // Planta un brote donde estaba el árbol, como buen jugador.
    const suelo = blockAt(npc.dimension, { x: base.x, y: base.y - 1, z: base.z });
    if (suelo && (suelo.typeId === "minecraft:dirt" || suelo.typeId === "minecraft:grass_block")) {
      sostener(npc, "minecraft:oak_sapling");
      animate(npc, ANIM.colocarAbajo);
      colocar(npc.dimension, base, "minecraft:oak_sapling");
    }
    state.ocupadoHasta = now() + 12;
    return "listo";
  }
  sostener(npc, hacha(state));
  const c = { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 };
  mirarA(npc, c);
  animate(npc, ANIM.minar);
  const tipo = tronco.typeId;
  system.runTimeout(() => {
    try {
      const b = blockAt(npc.dimension, pos);
      if (b?.typeId !== tipo) return;
      b.setType("minecraft:air");
      npc.dimension.spawnItem(new ItemStack(tipo, 1), c);
      particleAt(npc.dimension, PARTICLES.construir, c);
      sound(npc, "dig.wood", 1);
    } catch {
      // Ya no está.
    }
  }, 11);
  t.altura++;
  t.troncos = (t.troncos ?? 0) + 1;
  state.ocupadoHasta = now() + 14 + Math.floor(Math.random() * 4);
  return "talando";
}

// --- 3. Sitio ------------------------------------------------------------------

export function sitioPlano(dimension, cx, cz, rx = 4, rz = rx, tolerancia = 1) {
  const alturas = [];
  for (let i = -rx; i <= rx; i++) {
    for (let j = -rz; j <= rz; j++) {
      const top = superficie(dimension, cx + i, cz + j);
      if (!top || top.isLiquid) return undefined;
      const id = top.typeId;
      if (id.includes("water") || id.includes("lava") || id.endsWith("_leaves") || id.endsWith("_log")) return undefined;
      alturas.push(reemplazable(top) ? top.location.y - 1 : top.location.y);
    }
  }
  if (Math.max(...alturas) - Math.min(...alturas) > tolerancia) return undefined;
  const cuenta = {};
  for (const a of alturas) cuenta[a] = (cuenta[a] ?? 0) + 1;
  const y = Number(Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0][0]);
  return { x: cx, y, z: cz };
}

export function candidatosAlrededor(npc, rmin = 5, rmax = 15) {
  const lista = [];
  for (let r = rmin; r <= rmax; r += 2) {
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + r;
      lista.push({ x: Math.floor(npc.location.x + Math.cos(a) * r), z: Math.floor(npc.location.z + Math.sin(a) * r) });
    }
  }
  return lista;
}

export function frenteHacia(c, npc) {
  const dx = npc.location.x - c.x;
  const dz = npc.location.z - c.z;
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? "east" : "west";
  return dz > 0 ? "south" : "north";
}

// Lugar para pararse: dentro de la casa, en la línea entre el centro y el bloque.
function pararseEnCasa(c) {
  return (pos) => {
    const di = pos.x - c.x;
    const dj = pos.z - c.z;
    const dist = Math.hypot(di, dj);
    const lejos = Math.max(0, Math.min(dist - 2.2, 2));
    const k = dist > 0 ? lejos / dist : 0;
    return { x: c.x + 0.5 + di * k, y: c.y + 1, z: c.z + 0.5 + dj * k };
  };
}

function elegirSitio(npc, state, casa) {
  for (let k = 0; k < 3 && casa.candidatos.length; k++) {
    const cand = casa.candidatos.shift();
    if (ocupado(cand.x, cand.z, 10)) continue;
    const sitio = sitioPlano(npc.dimension, cand.x, cand.z, 4, 4, 3); // con desnivel: lo aplana antes
    if (!sitio) continue;
    const frente = frenteHacia(sitio, npc);
    const plan = planCasa(sitio, frente, state.pers?.paleta, perm);
    const salvo = (p) => dentroDeOtra(p, mismaObra("casa", sitio));
    casa.fase = "midiendo";
    registrar("casa", { x: sitio.x, y: sitio.y, z: sitio.z });
    // Primero aplana: pica lo que sobra y rellena los huecos (la casa y 2 bloques alrededor).
    planTerreno(npc.dimension, { x0: sitio.x - 5, x1: sitio.x + 5, z0: sitio.z - 5, z1: sitio.z + 5 }, sitio.y, (terreno) => {
      if (state.casa !== casa) return;
      casa.obra = { c: sitio, frente, plan: [...terreno, ...plan], i: 0, terreno: terreno.length, pararse: pararseEnCasa(sitio), salvo };
      casa.fase = "construir";
    }, { interior: { x0: sitio.x - 3, x1: sitio.x + 3, z0: sitio.z - 3, z1: sitio.z + 3 }, plan, salvo, alto: 10, hondo: 4,
      relleno: "minecraft:dirt" });
    caminarA(npc, { x: sitio.x + 0.5, y: sitio.y + 1, z: sitio.z + 0.5 }, state.pers?.paso ?? 0.2);
    return;
  }
  if (!casa.candidatos.length) casa.fase = "abandonar";
}

function terminar(npc, state, casa) {
  const c = casa.obra.c;
  state.casa = undefined;
  state.hogar = { x: c.x + 0.5, y: c.y + 1, z: c.z + 0.5 };
  try {
    npc.setDynamicProperty("claudenpc:casa", JSON.stringify(state.hogar));
  } catch {
    // No se pudo guardar.
  }
  aprender(npc, state, 3);
  velocidad(npc, 0);
}

// --- Entrada ---------------------------------------------------------------------

export function empezarCasa(npc, state) {
  detener(npc);
  velocidad(npc, 0);
  state.casa = { fase: "talar", tala: {}, candidatos: candidatosAlrededor(npc) };
}

export function tickCasa(npc, state) {
  const casa = state.casa;
  if (!casa || now() < state.ocupadoHasta) return;
  switch (casa.fase) {
    case "talar": {
      ponerHaciendo(npc, state, "talando para su casa");
      casa.tala.tronco ??= buscarTronco(npc);
      if (!casa.tala.tronco || talarPaso(npc, state, casa.tala) === "listo") casa.fase = "craftear";
      return;
    }
    case "craftear":
      ponerHaciendo(npc, state, "crafteando");
      casa.fase = "esperando";
      if (!simularCrafteo(npc, state, () => "minecraft:oak_planks", 60, () => {
        casa.fase = "sitio";
        sostener(npc, "minecraft:wooden_door");
      })) casa.fase = "sitio";
      return;
    case "esperando":
      return;
    case "sitio":
      ponerHaciendo(npc, state, "buscando terreno");
      elegirSitio(npc, state, casa);
      return;
    case "midiendo":
      ponerHaciendo(npc, state, "midiendo el terreno");
      return;
    case "construir":
      ponerHaciendo(npc, state, casa.obra.i < (casa.obra.terreno ?? 0) ? "aplanando el terreno" : "construyendo su casa");
      if (ejecutarPlano(npc, state, casa.obra)) terminar(npc, state, casa);
      return;
    default:
      state.casa = undefined;
      state.cd.casaListo = now() + CASA.reintento;
  }
}

// Recupera la casa guardada al recargar el mundo.
export function cargarHogar(npc) {
  try {
    const raw = npc.getDynamicProperty("claudenpc:casa");
    return typeof raw === "string" ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}
