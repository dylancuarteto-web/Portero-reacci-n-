import { MINERIA } from "./config.js";
import { estados } from "./estado.js";
import { rand } from "./util.js";

// Personalidad de cada Claude: qué le gusta hacer cuando está solo, qué tácticas
// prefiere al pelear, a qué distancia se fija en el jugador, su ritmo, el bloque
// con el que construye y el estilo de su casa. Se elige al nacer (evitando repetir
// las de los Claudes cercanos), cada valor se varía un poco y se guarda en la entidad.

const PROPIEDAD = "claudenpc:personalidad";

const TIPOS = [
  { id: "minero", titulo: "minero", radio: [20, 26], casa: [2400, 5000], bloque: "minecraft:cobblestone", paleta: "piedra",
    gustos: { minar: 6, craftear: 2, explorar: 1, descansar: 1, talar: 1, casa: 1 },
    estilo: { cavar: 2, trampa: 1.4, torre: 1.2 } },
  { id: "constructor", titulo: "constructor", radio: [18, 24], casa: [300, 700], bloque: "minecraft:oak_planks", paleta: "roble",
    gustos: { casa: 8, decorar: 4, talar: 2, craftear: 1, explorar: 1 },
    estilo: { torre: 2, puente: 2, torreta: 1.4 } },
  { id: "explorador", titulo: "explorador", radio: [26, 32], casa: [3600, 7000], bloque: "minecraft:stone_bricks", paleta: "abeto",
    gustos: { explorar: 6, bote: 2, observar: 2, talar: 1, descansar: 1, casa: 0.5 },
    estilo: { perla: 2.2, elytra: 2, arco: 1.2 } },
  { id: "lenador", titulo: "leñador", radio: [18, 24], casa: [1200, 2600], bloque: "minecraft:spruce_planks", paleta: "abeto",
    gustos: { talar: 6, craftear: 2, casa: 2, descansar: 1, decorar: 1 },
    estilo: { martillazo: 1.6, puente: 1.3 } },
  { id: "granjero", titulo: "granjero", radio: [14, 20], casa: [900, 1800], bloque: "minecraft:birch_planks", paleta: "abedul",
    gustos: { granja: 6, descansar: 2, observar: 2, casa: 2, talar: 1 },
    estilo: { arco: 1.5, trampa: 1.2 } },
  { id: "pescador", titulo: "pescador", radio: [14, 18], casa: [2000, 4000], bloque: "minecraft:spruce_planks", paleta: "abeto",
    gustos: { pescar: 6, bote: 4, descansar: 2, explorar: 1, casa: 1 },
    estilo: { bote: 2, arco: 1.4 } },
  { id: "arquero", titulo: "arquero", radio: [26, 32], casa: [2600, 5200], bloque: "minecraft:mossy_cobblestone", paleta: "roble",
    gustos: { explorar: 3, observar: 2, craftear: 2, talar: 1, minar: 1, casa: 1 },
    estilo: { arco: 3.2, perla: 1.3 } },
  { id: "inventor", titulo: "inventor", radio: [20, 28], casa: [1200, 2600], bloque: "minecraft:polished_andesite", paleta: "ladrillo",
    gustos: { craftear: 4, minar: 2, decorar: 2, explorar: 1, casa: 1.5 },
    estilo: { torreta: 3, trampa: 3, torre: 1.2 } },
  { id: "dormilon", titulo: "dormilón", radio: [12, 16], casa: [2600, 5200], bloque: "minecraft:sandstone", paleta: "abedul",
    gustos: { descansar: 6, pescar: 2, observar: 2, explorar: 1, casa: 1 },
    estilo: { arco: 1.2 } },
  { id: "guerrero", titulo: "guerrero", radio: [28, 32], casa: [3600, 7000], bloque: "minecraft:cobbled_deepslate", paleta: "piedra",
    gustos: { explorar: 3, minar: 2, craftear: 2, descansar: 1, casa: 0.5 },
    estilo: { martillazo: 2.2, elytra: 1.8, vacio: 1.6, perla: 1.3 } },
];

const variar = (v) => Math.round(v * (0.6 + Math.random() * 0.8) * 100) / 100;

function crear() {
  // Cuenta las personalidades de los Claudes ya cargados para no repetir.
  const usadas = {};
  for (const s of estados.values()) if (s.pers) usadas[s.pers.id] = (usadas[s.pers.id] ?? 0) + 1;
  const pesos = TIPOS.map((t) => ({ t, p: 1 / (1 + (usadas[t.id] ?? 0) * 3) }));
  const total = pesos.reduce((a, b) => a + b.p, 0);
  let r = Math.random() * total;
  let tipo = TIPOS[0];
  for (const { t, p } of pesos) {
    r -= p;
    if (r <= 0) {
      tipo = t;
      break;
    }
  }
  const gustos = {};
  for (const [k, v] of Object.entries(tipo.gustos)) gustos[k] = variar(v);
  // Un poco de todo: cada Claude tiene además algún gusto propio inesperado.
  for (const extra of ["explorar", "descansar", "observar", "talar", "pescar", "craftear", "decorar", "granja", "bote", "minar"]) {
    if (gustos[extra] === undefined && Math.random() < 0.45) gustos[extra] = variar(0.6);
  }
  const estilo = {};
  for (const [k, v] of Object.entries(tipo.estilo)) estilo[k] = variar(v);
  return {
    id: tipo.id,
    titulo: tipo.titulo,
    gustos,
    estilo,
    radio: rand(...tipo.radio),
    casaEn: rand(...tipo.casa),
    bloque: tipo.bloque,
    paleta: tipo.paleta,
    ritmo: Math.round((0.8 + Math.random() * 0.4) * 100) / 100, // menor = más rápido
    paso: Math.round((0.19 + Math.random() * 0.05) * 1000) / 1000,
    profundidad: rand(...MINERIA.profundidad),
    tunel: rand(...MINERIA.tunel),
  };
}

export function cargarPersonalidad(npc) {
  try {
    const raw = npc.getDynamicProperty(PROPIEDAD);
    if (typeof raw === "string") {
      const p = JSON.parse(raw);
      if (p && p.id && p.gustos) return p;
    }
  } catch {
    // Dato dañado: se crea otra.
  }
  const p = crear();
  try {
    npc.setDynamicProperty(PROPIEDAD, JSON.stringify(p));
  } catch {
    // No se pudo guardar.
  }
  return p;
}
