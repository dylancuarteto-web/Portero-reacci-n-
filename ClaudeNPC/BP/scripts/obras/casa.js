import { BlockPermutation, ItemStack, system, world } from "@minecraft/server";
import { ANIM, CASA, PARTICLES } from "../config.js";
import { simularCrafteo } from "../crafteo.js";
import { sostener } from "../equipo.js";
import { aprender } from "../iq.js";
import { caminarA, caminando, detener, velocidad } from "../movimiento.js";
import { iniciarTorre } from "./torre.js";
import {
  animate, blockAt, burst, colocar, distancia, mirarA, now, particleAt, piso, rand, reemplazable, sound, superficie,
} from "../util.js";

// Casa construida como la haría un jugador, sin prisa:
//  1. tala un árbol cercano (y planta un brote), 2. craftea, 3. busca un terreno plano,
//  4. limpia, cimiento y piso, esquinas de tronco, paredes por hileras, puerta y ventanas,
//  vigas, 5. sube a un andamio para el techo (con alero y chimenea), baja quitando el andamio,
//  6. farol, muebles y alfombra, 7. sale cerrando la puerta, hace un camino con antorchas y celebra.

const perm = (id, estados) => BlockPermutation.resolve(id, estados);
const LISTA_CASAS = "claudenpc:casas";
const FRENTES = { north: { x: 0, z: -1 }, south: { x: 0, z: 1 }, west: { x: -1, z: 0 }, east: { x: 1, z: 0 } };
const IRROMPIBLES = new Set(["minecraft:bedrock", "minecraft:obsidian", "minecraft:barrier", "minecraft:chest",
  "minecraft:crafting_table", "minecraft:furnace", "minecraft:spawner"]);

function casasExistentes() {
  try {
    const raw = world.getDynamicProperty(LISTA_CASAS);
    return typeof raw === "string" ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function guardarCasa(c) {
  const lista = casasExistentes();
  lista.push({ x: c.x, y: c.y, z: c.z });
  world.setDynamicProperty(LISTA_CASAS, JSON.stringify(lista.slice(-50)));
}

// --- 1. Talar ------------------------------------------------------------------

function buscarTronco(npc) {
  const p = piso(npc.location);
  let mejor;
  let md = Infinity;
  for (let dx = -10; dx <= 10; dx++) {
    for (let dz = -10; dz <= 10; dz++) {
      const d2 = dx * dx + dz * dz;
      if (d2 > 100 || d2 >= md) continue;
      const top = superficie(npc.dimension, p.x + dx, p.z + dz);
      if (!top || !(top.typeId.endsWith("_leaves") || top.typeId.endsWith("_log"))) continue;
      let base;
      for (let y = top.location.y; y >= top.location.y - 10; y--) {
        const b = blockAt(npc.dimension, { x: p.x + dx, y, z: p.z + dz });
        if (b?.typeId.endsWith("_log")) base = b.location;
        else if (base) break;
      }
      if (base) {
        mejor = base;
        md = d2;
      }
    }
  }
  return mejor;
}

function talar(npc, state, casa) {
  const t = casa.tala;
  if (!t.tronco) {
    t.tronco = buscarTronco(npc);
    if (!t.tronco) {
      casa.fase = "craftear";
      return;
    }
    t.altura = 0;
  }
  const base = t.tronco;
  const centroTronco = { x: base.x + 0.5, y: base.y, z: base.z + 0.5 };
  const lejos = Math.hypot(npc.location.x - centroTronco.x, npc.location.z - centroTronco.z);
  if (lejos > 2.2) {
    const dx = npc.location.x - centroTronco.x;
    const dz = npc.location.z - centroTronco.z;
    const d = Math.hypot(dx, dz) || 1;
    caminarA(npc, { x: centroTronco.x + (dx / d) * 1.4, y: base.y, z: centroTronco.z + (dz / d) * 1.4 }, 0.2);
    t.intentos = (t.intentos ?? 0) + 1;
    if (t.intentos > 12) casa.fase = "craftear";
    state.ocupadoHasta = now() + 10;
    return;
  }
  const pos = { x: base.x, y: base.y + t.altura, z: base.z };
  const tronco = blockAt(npc.dimension, pos);
  if (!tronco?.typeId.endsWith("_log") || t.altura > 4) {
    // Planta un brote donde estaba el árbol, como buen jugador.
    const suelo = blockAt(npc.dimension, { x: base.x, y: base.y - 1, z: base.z });
    if (suelo && (suelo.typeId === "minecraft:dirt" || suelo.typeId === "minecraft:grass_block")) {
      sostener(npc, "minecraft:oak_sapling");
      animate(npc, ANIM.colocarAbajo);
      colocar(npc.dimension, base, "minecraft:oak_sapling");
    }
    casa.fase = "craftear";
    state.ocupadoHasta = now() + 16;
    return;
  }
  sostener(npc, "minecraft:stone_axe");
  mirarA(npc, { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 });
  animate(npc, ANIM.minar);
  const tipo = tronco.typeId;
  system.runTimeout(() => {
    try {
      const b = blockAt(npc.dimension, pos);
      if (b?.typeId !== tipo) return;
      b.setType("minecraft:air");
      npc.dimension.spawnItem(new ItemStack(tipo, 1), { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 });
      particleAt(npc.dimension, PARTICLES.construir, { x: pos.x + 0.5, y: pos.y + 0.5, z: pos.z + 0.5 });
      sound(npc, "dig.wood", 1);
    } catch {
      // Ya no está.
    }
  }, 18);
  t.altura++;
  state.ocupadoHasta = now() + 24 + rand(0, 6);
}

// --- 3. Sitio ------------------------------------------------------------------

function sitioPlano(dimension, cx, cz) {
  const alturas = [];
  for (let i = -4; i <= 4; i++) {
    for (let j = -4; j <= 4; j++) {
      const top = superficie(dimension, cx + i, cz + j);
      if (!top || top.isLiquid) return undefined;
      const id = top.typeId;
      if (id.includes("water") || id.includes("lava") || id.endsWith("_leaves") || id.endsWith("_log")) return undefined;
      alturas.push(reemplazable(top) ? top.location.y - 1 : top.location.y);
    }
  }
  if (Math.max(...alturas) - Math.min(...alturas) > 1) return undefined;
  const cuenta = {};
  for (const a of alturas) cuenta[a] = (cuenta[a] ?? 0) + 1;
  const y = Number(Object.entries(cuenta).sort((a, b) => b[1] - a[1])[0][0]);
  return { x: cx, y, z: cz };
}

function candidatos(npc) {
  const lista = [];
  for (let r = 5; r <= 15; r += 2) {
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2 + r;
      lista.push({ x: Math.floor(npc.location.x + Math.cos(a) * r), z: Math.floor(npc.location.z + Math.sin(a) * r) });
    }
  }
  return lista;
}

function frenteHacia(c, npc) {
  const dx = npc.location.x - c.x;
  const dz = npc.location.z - c.z;
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? "east" : "west";
  return dz > 0 ? "south" : "north";
}

function elegirSitio(npc, state, casa) {
  const existentes = casasExistentes();
  for (let k = 0; k < 3 && casa.candidatos.length; k++) {
    const cand = casa.candidatos.shift();
    if (existentes.some((c) => Math.hypot(c.x - cand.x, c.z - cand.z) < 16)) continue;
    const sitio = sitioPlano(npc.dimension, cand.x, cand.z);
    if (!sitio) continue;
    casa.c = sitio;
    casa.frente = frenteHacia(sitio, npc);
    casa.plan = plan(sitio, casa.frente);
    casa.i = 0;
    casa.fase = "construir";
    caminarA(npc, { x: sitio.x + 0.5, y: sitio.y + 1, z: sitio.z + 0.5 }, 0.2);
    return;
  }
  if (!casa.candidatos.length) casa.fase = "abandonar";
}

// --- 4-7. Plano de la casa -------------------------------------------------------

function plan(c, frente) {
  const f = FRENTES[frente];
  const der = { x: -f.z, z: f.x };
  const P = (i, h, j) => ({ x: c.x + i, y: c.y + h, z: c.z + j });
  const L = (a, b) => ({ i: f.x * a + der.x * b, j: f.z * a + der.z * b }); // a: hacia el frente, b: hacia la derecha
  const perimetro = (i, j) => Math.max(Math.abs(i), Math.abs(j)) === 3;
  const esquina = (i, j) => Math.abs(i) === 3 && Math.abs(j) === 3;
  const frontal = (i, j) => i * f.x + j * f.z === 3;
  const aLoLargo = (i, j) => (Math.abs(i) === 3 ? j : i);
  const puerta = (i, j) => frontal(i, j) && aLoLargo(i, j) === 0;
  const ventana = (i, j) => perimetro(i, j) && !esquina(i, j) && !frontal(i, j) && aLoLargo(i, j) === 0;
  const pasos = [];
  const add = (p) => pasos.push(p);

  // Recorrido del perímetro en orden, como quien camina alrededor de la obra.
  const vuelta = [];
  for (let k = -3; k <= 3; k++) vuelta.push([k, -3]);
  for (let k = -2; k <= 3; k++) vuelta.push([3, k]);
  for (let k = 2; k >= -3; k--) vuelta.push([k, 3]);
  for (let k = 2; k >= -2; k--) vuelta.push([-3, k]);

  for (let h = 1; h <= 5; h++) for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) add({ tipo: "quitar", pos: P(i, h, j) });
  for (let j = -3; j <= 3; j++) {
    const fila = [];
    for (let i = -3; i <= 3; i++) fila.push(i);
    if (j % 2) fila.reverse(); // en zigzag, como quien avanza fila por fila
    for (const i of fila) {
      add({ tipo: "rellenar", pos: P(i, -1, j), bloque: "minecraft:cobblestone" });
      add({ tipo: "colocar", pos: P(i, 0, j), bloque: perimetro(i, j) ? "minecraft:cobblestone" : "minecraft:oak_planks", forzar: true });
    }
  }
  for (const [i, j] of [[-3, -3], [3, -3], [3, 3], [-3, 3]]) {
    for (let h = 1; h <= 4; h++) add({ tipo: "colocar", pos: P(i, h, j), bloque: perm("minecraft:oak_log", { pillar_axis: "y" }) });
  }
  for (let h = 1; h <= 3; h++) {
    for (const [i, j] of vuelta) {
      if (esquina(i, j) || (puerta(i, j) && h <= 2) || (ventana(i, j) && h >= 2)) continue;
      add({ tipo: "colocar", pos: P(i, h, j), bloque: "minecraft:oak_planks" });
    }
  }
  const d = L(3, 0);
  add({ tipo: "colocar", pos: P(d.i, 1, d.j), bloque: perm("minecraft:wooden_door", {
    "minecraft:cardinal_direction": frente, upper_block_bit: false, open_bit: false, door_hinge_bit: false }) });
  add({ tipo: "colocar", pos: P(d.i, 2, d.j), bloque: perm("minecraft:wooden_door", {
    "minecraft:cardinal_direction": frente, upper_block_bit: true, open_bit: false, door_hinge_bit: false }) });
  for (const [i, j] of vuelta) {
    if (ventana(i, j)) for (const h of [2, 3]) add({ tipo: "colocar", pos: P(i, h, j), bloque: "minecraft:glass_pane" });
  }
  for (const [i, j] of vuelta) {
    if (esquina(i, j)) continue;
    add({ tipo: "colocar", pos: P(i, 4, j), bloque: perm("minecraft:stripped_oak_log", { pillar_axis: Math.abs(j) === 3 ? "x" : "z" }) });
  }
  // Techo desde un andamio en el centro.
  add({ tipo: "ir", pos: P(0, 1, 0) });
  add({ tipo: "andamio", hasta: c.y + 4 });
  for (let r = 1; r <= 3; r++) {
    for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
      if (Math.max(Math.abs(i), Math.abs(j)) === r) add({ tipo: "colocar", pos: P(i, 5, j), bloque: "minecraft:spruce_planks", techo: true });
    }
  }
  for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) {
    if (Math.max(Math.abs(i), Math.abs(j)) === 4) {
      add({ tipo: "colocar", pos: P(i, 5, j), bloque: perm("minecraft:spruce_slab", { "minecraft:vertical_half": "bottom" }), techo: true });
    }
  }
  const ch = L(-3, 3);
  add({ tipo: "colocar", pos: P(ch.i, 6, ch.j), bloque: "minecraft:cobblestone", techo: true });
  add({ tipo: "colocar", pos: P(ch.i, 7, ch.j), bloque: "minecraft:campfire", techo: true });
  add({ tipo: "bajar", veces: 3 });
  add({ tipo: "colocar", pos: P(0, 5, 0), bloque: "minecraft:spruce_planks" });
  add({ tipo: "colocar", pos: P(0, 4, 0), bloque: perm("minecraft:lantern", { hanging: true }) });
  // Muebles contra la pared del fondo y una alfombra.
  const muebles = [{ p: L(-2, -2), b: "minecraft:crafting_table" },
    { p: L(-2, -1), b: perm("minecraft:furnace", { "minecraft:cardinal_direction": frente }) },
    { p: L(-2, 2), b: perm("minecraft:chest", { "minecraft:cardinal_direction": frente }) },
    { p: L(0, 0), b: "minecraft:red_carpet" }, { p: L(1, 0), b: "minecraft:red_carpet" },
    { p: L(-1, 0), b: "minecraft:red_carpet" }];
  for (const { p, b } of muebles) add({ tipo: "colocar", pos: P(p.i, 1, p.j), bloque: b });
  // Sale cerrando la puerta, hace un camino y pone antorchas.
  add({ tipo: "puerta", pos: P(d.i, 1, d.j), abrir: true });
  const fuera = L(5, 0);
  add({ tipo: "ir", pos: P(fuera.i, 1, fuera.j) });
  add({ tipo: "puerta", pos: P(d.i, 1, d.j), abrir: false });
  for (const a of [4, 5, 6]) {
    const p = L(a, 0);
    add({ tipo: "camino", pos: P(p.i, 0, p.j) });
  }
  for (const b of [-1, 1]) {
    const p = L(4, b);
    add({ tipo: "colocar", pos: P(p.i, 1, p.j), bloque: perm("minecraft:torch", { torch_facing_direction: "top" }) });
  }
  const mirador = L(7, 0);
  add({ tipo: "celebrar", pos: P(mirador.i, 1, mirador.j) });
  return pasos;
}

// --- Ejecución de los pasos ----------------------------------------------------------

function itemDe(bloque) {
  const id = typeof bloque === "string" ? bloque : bloque.type.id;
  if (id === "minecraft:grass_path") return "minecraft:wooden_shovel";
  return id;
}

function sonidoDe(id) {
  return /planks|log|door|chest|table|slab|campfire/.test(id) ? "use.wood" : "use.stone";
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

// Lugar para pararse: dentro de la casa, en la línea entre el centro y el bloque.
function dondePararse(casa, pos) {
  const c = casa.c;
  const di = pos.x - c.x;
  const dj = pos.z - c.z;
  const dist = Math.hypot(di, dj);
  const lejos = Math.max(0, Math.min(dist - 2.2, 2));
  const k = dist > 0 ? lejos / dist : 0;
  return { x: c.x + 0.5 + di * k, y: c.y + 1, z: c.z + 0.5 + dj * k };
}

function acercarse(npc, state, casa, paso) {
  paso.intentos = (paso.intentos ?? 0) + 1;
  if (paso.intentos > 3) return false;
  caminarA(npc, paso.tipo === "ir" ? { x: paso.pos.x + 0.5, y: paso.pos.y, z: paso.pos.z + 0.5 } : dondePararse(casa, paso.pos), 0.2);
  state.ocupadoHasta = now() + 6;
  return true;
}

function ritmoHumano(state, casa) {
  casa.colocados = (casa.colocados ?? 0) + 1;
  state.ocupadoHasta = now() + rand(7, 11);
  if (casa.colocados % rand(15, 25) === 0) casa.pausa = true; // de vez en cuando se detiene y mira
}

function ejecutar(npc, state, casa) {
  if (caminando(npc)) return;
  // Si se alejó (por ejemplo, tras una pelea), primero vuelve a la obra.
  if (Math.hypot(npc.location.x - (casa.c.x + 0.5), npc.location.z - (casa.c.z + 0.5)) > 10 && !state.obra) {
    caminarA(npc, { x: casa.c.x + 0.5, y: casa.c.y + 1, z: casa.c.z + 0.5 }, 0.22);
    state.ocupadoHasta = now() + 10;
    return;
  }
  if (casa.pausa) {
    casa.pausa = false;
    const a = Math.random() * Math.PI * 2;
    mirarA(npc, { x: npc.location.x + Math.cos(a) * 6, y: npc.location.y + 1.5, z: npc.location.z + Math.sin(a) * 6 });
    state.ocupadoHasta = now() + rand(25, 45);
    return;
  }
  // Salta rápido los pasos que no hacen falta (bloques ya libres o ya colocados).
  for (let saltos = 0; saltos < 30; saltos++) {
    const paso = casa.plan[casa.i];
    if (!paso) return terminar(npc, state, casa);
    const b = paso.pos ? blockAt(npc.dimension, paso.pos) : undefined;
    const sobra = (paso.tipo === "quitar" && (!b || b.isAir || IRROMPIBLES.has(b.typeId)))
      || (paso.tipo === "rellenar" && b && !b.isAir && !b.isLiquid && !reemplazable(b))
      || (paso.tipo === "colocar" && !b);
    if (!sobra) break;
    casa.i++;
  }
  const paso = casa.plan[casa.i];
  if (!paso) return terminar(npc, state, casa);
  const alcance = paso.techo ? CASA.alcanceTecho : CASA.alcance;

  switch (paso.tipo) {
    case "ir": {
      if (Math.hypot(npc.location.x - (paso.pos.x + 0.5), npc.location.z - (paso.pos.z + 0.5)) > 0.8 && acercarse(npc, state, casa, paso)) return;
      casa.i++;
      return;
    }
    case "andamio":
      iniciarTorre(npc, state, paso.hasta, "minecraft:dirt");
      casa.i++;
      return;
    case "bajar": {
      // Quita el andamio de tierra bajo sus pies, uno a uno.
      const bajo = blockAt(npc.dimension, { x: npc.location.x, y: npc.location.y - 1, z: npc.location.z });
      if (paso.veces <= 0 || bajo?.typeId !== "minecraft:dirt") {
        casa.i++;
        return;
      }
      sostener(npc, "minecraft:wooden_shovel");
      mirarA(npc, { x: npc.location.x, y: npc.location.y - 1, z: npc.location.z });
      animate(npc, ANIM.minar);
      const pos = { ...bajo.location };
      system.runTimeout(() => {
        const x = blockAt(npc.dimension, pos);
        if (x?.typeId === "minecraft:dirt") x.setType("minecraft:air");
        if (npc.isValid) sound(npc, "dig.gravel", 1);
      }, 10);
      paso.veces--;
      state.ocupadoHasta = now() + 18;
      return;
    }
    case "puerta": {
      if (!cerca(npc, paso.pos, alcance) && acercarse(npc, state, casa, paso)) return;
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
      casa.i++;
      state.ocupadoHasta = now() + 12;
      return;
    }
    case "celebrar": {
      if (Math.hypot(npc.location.x - (paso.pos.x + 0.5), npc.location.z - (paso.pos.z + 0.5)) > 1 && acercarse(npc, state, casa, paso)) return;
      mirarA(npc, { x: casa.c.x + 0.5, y: casa.c.y + 3, z: casa.c.z + 0.5 });
      animate(npc, ANIM.celebrar);
      burst(npc, PARTICLES.idea, { x: 0, y: 2.2, z: 0 });
      burst(npc, PARTICLES.confeti, { x: 0, y: 2, z: 0 });
      sound(npc, "random.levelup", 1.2);
      casa.i++;
      state.ocupadoHasta = now() + 40;
      return;
    }
    default:
      break;
  }

  // quitar / rellenar / colocar / camino
  if (!cerca(npc, paso.pos, alcance) && !paso.techo && acercarse(npc, state, casa, paso)) return;
  const b = blockAt(npc.dimension, paso.pos);
  const centroPaso = { x: paso.pos.x + 0.5, y: paso.pos.y + 0.5, z: paso.pos.z + 0.5 };
  casa.i++;
  if (!b) return;
  mirarA(npc, centroPaso);
  if (paso.tipo === "quitar") {
    const rapido = reemplazable(b);
    sostener(npc, rapido ? "minecraft:air" : herramienta(b.typeId));
    animate(npc, rapido ? ANIM.golpe : ANIM.minar);
    const tipo = b.typeId;
    system.runTimeout(() => {
      try {
        const x = blockAt(npc.dimension, paso.pos);
        if (x?.typeId !== tipo) return;
        x.setType("minecraft:air");
        if (!rapido && !tipo.endsWith("_leaves")) npc.dimension.spawnItem(new ItemStack(tipo, 1), centroPaso);
        particleAt(npc.dimension, PARTICLES.construir, centroPaso);
      } catch {
        // Ya no está.
      }
    }, rapido ? 4 : 12);
    state.ocupadoHasta = now() + (rapido ? 6 : 16);
    return;
  }
  if (paso.tipo === "camino") {
    if (!b || !/grass_block|dirt/.test(b.typeId)) return;
    sostener(npc, "minecraft:wooden_shovel");
    animate(npc, ANIM.colocarAbajo);
    colocar(npc.dimension, paso.pos, "minecraft:grass_path", true);
    sound(npc, "dig.grass", 1);
    ritmoHumano(state, casa);
    return;
  }
  const forzar = paso.forzar || paso.tipo === "rellenar";
  if (!forzar && !reemplazable(b)) return;
  if (forzar && b.typeId === (typeof paso.bloque === "string" ? paso.bloque : paso.bloque.type.id)) return;
  sostener(npc, itemDe(paso.bloque));
  animate(npc, paso.pos.y < npc.location.y ? ANIM.colocarAbajo : ANIM.colocar);
  const id = typeof paso.bloque === "string" ? paso.bloque : paso.bloque.type.id;
  system.runTimeout(() => {
    if (!npc.isValid) return;
    if (colocar(npc.dimension, paso.pos, paso.bloque, forzar)) sound(npc, sonidoDe(id), rand(9, 11) / 10);
  }, 3);
  ritmoHumano(state, casa);
}

function terminar(npc, state, casa) {
  state.casa = undefined;
  state.hogar = { x: casa.c.x + 0.5, y: casa.c.y + 1, z: casa.c.z + 0.5 };
  try {
    guardarCasa(casa.c);
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
  state.casa = { fase: "talar", tala: {}, candidatos: candidatos(npc), plan: [], i: 0 };
}

export function tickCasa(npc, state) {
  const casa = state.casa;
  if (!casa || now() < state.ocupadoHasta) return;
  switch (casa.fase) {
    case "talar":
      talar(npc, state, casa);
      return;
    case "craftear":
      casa.fase = "esperando";
      if (!simularCrafteo(npc, state, () => "minecraft:oak_planks", 120, () => {
        casa.fase = "sitio";
        sostener(npc, "minecraft:wooden_door");
      })) casa.fase = "sitio";
      return;
    case "esperando":
      return;
    case "sitio":
      elegirSitio(npc, state, casa);
      return;
    case "construir":
      ejecutar(npc, state, casa);
      return;
    default:
      state.casa = undefined;
      state.cd.casa = now() + CASA.reintento;
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
