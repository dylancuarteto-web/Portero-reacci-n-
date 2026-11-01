import { system } from "@minecraft/server";
import { blockAt, reemplazable } from "./util.js";

// Búsqueda de camino (A*) para cuando el camino recto está cerrado: paredes, casas,
// cuevas o la escalera de la mina. Mira los bloques de alrededor como lo haría
// alguien que busca por dónde pasar: sube escalones de un bloque, baja hasta tres,
// cruza puertas y portones (el motor los abre) y evita lava, fuego y cactus.
// Se reparte en varios ticks (system.runJob) para no trabar el juego en el celular.

const AIRE = 0;
const SOLIDO = 1;
const MURO = 2;
const PELIGRO = 3;
const AGUA = 4;
const PUERTA = 5;
const FUERA = 6;

const PASA = /(carpet|torch|_button|pressure_plate|rail|_sign|lever|redstone_wire|trip_wire|banner|ladder|tripwire_hook)$/;
const NO_PISO = /(_fence|fence|_wall|cobblestone_wall|iron_bars|_pane|glass_pane|chain|_trapdoor|trapdoor)$/;
const QUEMA = new Set(["minecraft:magma", "minecraft:magma_block", "minecraft:cactus", "minecraft:sweet_berry_bush",
  "minecraft:wither_rose", "minecraft:powder_snow", "minecraft:pointed_dripstone"]);

function clasificar(b) {
  if (!b) return FUERA;
  if (b.isAir) return AIRE;
  const id = b.typeId;
  if (QUEMA.has(id) || id.includes("lava") || id.endsWith("fire")) return PELIGRO;
  if (id === "minecraft:water" || id === "minecraft:flowing_water") return AGUA;
  if (b.isLiquid) return PELIGRO;
  if (reemplazable(b)) return AIRE;
  if (id.endsWith("_door")) return id === "minecraft:iron_door" ? MURO : PUERTA;
  if (id.endsWith("fence_gate")) return PUERTA;
  if (PASA.test(id)) return AIRE;
  if (NO_PISO.test(id)) return MURO;
  return SOLIDO;
}

// Montículo binario por "f" para la lista abierta.
class Monticulo {
  constructor() {
    this.a = [];
  }

  get size() {
    return this.a.length;
  }

  push(n) {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length && last) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

const VECINOS = [
  { x: 1, z: 0, c: 1 }, { x: -1, z: 0, c: 1 }, { x: 0, z: 1, c: 1 }, { x: 0, z: -1, c: 1 },
  { x: 1, z: 1, c: 1.414 }, { x: 1, z: -1, c: 1.414 }, { x: -1, z: 1, c: 1.414 }, { x: -1, z: -1, c: 1.414 },
];

function* busqueda(dim, inicio, meta, max, radio, terminar) {
  let resultado;
  try {
    const cache = new Map();
    const tipo = (x, y, z) => {
      const k = `${x},${y},${z}`;
      let t = cache.get(k);
      if (t === undefined) {
        t = clasificar(blockAt(dim, { x, y, z }));
        cache.set(k, t);
      }
      return t;
    };
    const pasable = (t) => t === AIRE || t === PUERTA;
    const dePie = (x, y, z) => {
      const pie = tipo(x, y, z);
      return (pasable(pie) || pie === AGUA) && pasable(tipo(x, y + 1, z)) && tipo(x, y - 1, z) === SOLIDO;
    };
    const h = (n) => {
      const dx = Math.abs(n.x - meta.x);
      const dz = Math.abs(n.z - meta.z);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz) + Math.abs(n.y - meta.y);
    };

    // Si está sobre una losa o un escalón, su casilla "de pie" es la de arriba.
    let ini = { ...inicio };
    if (!dePie(ini.x, ini.y, ini.z)) {
      if (dePie(ini.x, ini.y + 1, ini.z)) ini.y++;
      else if (dePie(ini.x, ini.y - 1, ini.z)) ini.y--;
    }
    const clave = (n) => `${n.x},${n.y},${n.z}`;
    const k0 = clave(ini);
    const g = new Map([[k0, 0]]);
    const padre = new Map();
    const nodos = new Map([[k0, ini]]);
    const cerrados = new Set();
    const abiertos = new Monticulo();
    abiertos.push({ k: k0, f: h(ini) * 1.3 });
    const h0 = h(ini);
    let mejor = { k: k0, h: h0 };
    let n = 0;

    while (abiertos.size) {
      const { k } = abiertos.pop();
      if (cerrados.has(k)) continue;
      cerrados.add(k);
      const c = nodos.get(k);
      const hc = h(c);
      if (hc < mejor.h) mejor = { k, h: hc };
      if (c.x === meta.x && c.z === meta.z && Math.abs(c.y - meta.y) <= 1) {
        mejor = { k, h: 0 };
        break;
      }
      if (++n > max) break;
      if (n % 8 === 0) yield;
      const gc = g.get(k) ?? 0;
      for (const v of VECINOS) {
        const nx = c.x + v.x;
        const nz = c.z + v.z;
        if (Math.abs(nx - ini.x) > radio || Math.abs(nz - ini.z) > radio) continue;
        const diagonal = v.x !== 0 && v.z !== 0;
        if (diagonal) {
          // No corta esquinas: las dos casillas de al lado tienen que estar libres.
          if (!pasable(tipo(c.x + v.x, c.y, c.z)) || !pasable(tipo(c.x + v.x, c.y + 1, c.z))
            || !pasable(tipo(c.x, c.y, c.z + v.z)) || !pasable(tipo(c.x, c.y + 1, c.z + v.z))) continue;
        }
        let ny;
        let extra = 0;
        if (dePie(nx, c.y, nz)) {
          ny = c.y;
          if (tipo(nx, c.y, nz) === AGUA) extra = 2;
          if (tipo(nx, c.y, nz) === PUERTA) extra = 0.5;
        } else if (!diagonal && dePie(nx, c.y + 1, nz)) {
          ny = c.y + 1; // escalón (con techo bajo el salto guiado va casi rozando)
          extra = pasable(tipo(c.x, c.y + 2, c.z)) ? 0.6 : 1.8;
        } else if (!diagonal && pasable(tipo(nx, c.y, nz)) && pasable(tipo(nx, c.y + 1, nz))) {
          for (let caida = 1; caida <= 3; caida++) {
            if (!pasable(tipo(nx, c.y - caida, nz)) && tipo(nx, c.y - caida, nz) !== AGUA) break;
            if (dePie(nx, c.y - caida, nz)) {
              ny = c.y - caida;
              extra = 0.4 * caida;
              break;
            }
          }
        }
        if (ny === undefined) continue;
        const sig = { x: nx, y: ny, z: nz };
        const ks = clave(sig);
        if (cerrados.has(ks)) continue;
        const gs = gc + v.c + extra;
        if (gs >= (g.get(ks) ?? Infinity)) continue;
        g.set(ks, gs);
        padre.set(ks, k);
        nodos.set(ks, sig);
        abiertos.push({ k: ks, f: gs + h(sig) * 1.3 });
      }
    }

    // Camino completo o, si no llegó, hasta el punto más cercano a la meta (si mejora).
    if (mejor.k !== k0 && (mejor.h === 0 || h0 - mejor.h >= 2.5)) {
      const lista = [];
      for (let k = mejor.k; k && k !== k0; k = padre.get(k)) lista.push(nodos.get(k));
      lista.reverse();
      resultado = { puntos: simplificar(ini, lista), completo: mejor.h === 0 };
    }
  } catch {
    resultado = undefined;
  }
  terminar(resultado);
}

// Deja solo los puntos donde el camino gira o cambia de altura.
function simplificar(ini, lista) {
  const puntos = [];
  for (let i = 0; i < lista.length; i++) {
    const a = lista[i];
    const prev = lista[i - 1] ?? ini;
    const sig = lista[i + 1];
    const centro = { x: a.x + 0.5, y: a.y, z: a.z + 0.5 };
    if (!sig) {
      puntos.push(centro);
      break;
    }
    const gira = a.x - prev.x !== sig.x - a.x || a.z - prev.z !== sig.z - a.z;
    if (gira || a.y !== prev.y || sig.y !== a.y) puntos.push(centro);
  }
  return puntos;
}

let activas = 0;

// Busca un camino de "npc" a "destino". Llama a "alTerminar" con { puntos, completo }
// o con undefined si no hay por dónde. Devuelve false si ya hay demasiadas búsquedas.
export function buscarCamino(npc, destino, alTerminar, { max = 650, radio = 28 } = {}) {
  if (activas >= 2) return false;
  activas++;
  const inicio = { x: Math.floor(npc.location.x), y: Math.floor(npc.location.y + 0.01), z: Math.floor(npc.location.z) };
  const meta = { x: Math.floor(destino.x), y: Math.floor(destino.y + 0.01), z: Math.floor(destino.z) };
  let hecho = false;
  const fin = (r) => {
    if (hecho) return;
    hecho = true;
    activas--;
    try {
      alTerminar(r);
    } catch {
      // El que pidió el camino ya no existe.
    }
  };
  try {
    system.runJob(busqueda(npc.dimension, inicio, meta, max, radio, fin));
  } catch {
    fin(undefined);
  }
  return true;
}
