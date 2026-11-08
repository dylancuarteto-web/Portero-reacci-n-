import { sostener } from "../equipo.js";
import { now, run } from "../util.js";
import { ESTILOS } from "./adaptacion.js";
import { gesto, pose } from "./animacion.js";
import { fase, puede } from "./fases.js";

// WeaponManager: cada arma tiene propósito, rango, estrategia, combos, animación y la
// técnica (fase) que la desbloquea. La elección sigue reglas (distancia, altura, escudo
// del rival, estilo); nunca es al azar. Cambiar cuesta tiempo (15 ticks en la fase 1, 3 en
// la 20) y cada arma se sostiene un mínimo antes de cambiarla, salvo una razón fuerte.

const MAT = ["wooden", "stone", "iron", "diamond", "netherite"];

export const ARMAS = {
  espada: {
    item: (t) => `minecraft:${MAT[t]}_sword`, tecnica: "acercarse", rango: [0, 3.2], cuerpo: true,
    dano: [5, 6, 7, 8, 9], extraCadencia: 0,
    proposito: "Daño constante y combos rápidos", estrategia: "Cadenas con W-tap y S-tap",
    combos: ["espada_reset_espada", "espada_salto_critico", "wtap_cadena", "strafe_golpe"],
  },
  hacha: {
    item: (t) => `minecraft:${MAT[t]}_axe`, tecnica: "hacha", rango: [0, 3], cuerpo: true,
    dano: [6, 7, 8, 9, 10], extraCadencia: 8,
    proposito: "Golpe pesado que desactiva escudos", estrategia: "Castigar la guardia",
    combos: ["hacha_escudo_espada", "rompeguardia", "cambio_sorpresa"],
  },
  maza: {
    item: () => "minecraft:mace", tecnica: "maza", rango: [0, 3], cuerpo: true,
    dano: [6, 6, 6, 6, 6], extraCadencia: 6,
    proposito: "Ataque vertical: más daño cuanto más cae", estrategia: "Ganar altura y caer encima",
    combos: ["maza_caida_vertical", "pilar_maza"],
  },
  tridente: {
    item: () => "minecraft:trident", tecnica: "tridente", rango: [4, 20], cuerpo: true,
    dano: [9, 9, 9, 9, 9], extraCadencia: 4,
    proposito: "Lanzamiento que abre el combo", estrategia: "Lanzar y entrar",
    combos: ["tridente_acercamiento_combo"],
  },
  arco: {
    item: () => "minecraft:bow", tecnica: "arco", rango: [6, 30], distancia: true,
    proposito: "Presión a distancia con predicción", estrategia: "Desgastar y forzar el acercamiento",
    combos: ["arco_persecucion_espada", "alternar_distancia"],
  },
  ballesta: {
    item: () => "minecraft:crossbow", tecnica: "ballesta", rango: [5, 24], distancia: true,
    proposito: "Disparo fuerte y recto", estrategia: "Castigar al que se queda quieto",
    combos: ["ballesta_castigo"],
  },
  cubeta: {
    item: () => "minecraft:water_bucket", tecnica: "aguaClutch",
    proposito: "Salvar caídas y frenar al rival", estrategia: "Clutch y control", combos: ["agua_reposicion_ataque"],
  },
  lava: {
    item: () => "minecraft:lava_bucket", tecnica: "lava", rango: [3, 6],
    proposito: "Cortar el paso", estrategia: "Control del terreno", combos: ["lava_corte"],
  },
  perla: {
    item: () => "minecraft:ender_pearl", tecnica: "perla", rango: [8, 30],
    proposito: "Reposicionarse", estrategia: "Flanquear o escapar", combos: ["perla_flanco"],
  },
  pocion: {
    item: () => "minecraft:splash_potion", tecnica: "pociones", rango: [3, 8],
    proposito: "Curarse o castigar", estrategia: "Pot PvP", combos: ["pociones_presion"],
  },
  comida: {
    item: (t, s) => (s.fase >= 10 ? "minecraft:golden_apple" : "minecraft:cooked_beef"), tecnica: "comer",
    proposito: "Curarse", estrategia: "Retirarse y comer", combos: [],
  },
  tnt: {
    item: () => "minecraft:tnt", tecnica: "tnt", rango: [3, 8],
    proposito: "Negar una zona", estrategia: "Ponerla y alejarse", combos: ["tnt_zona"],
  },
  cristal: {
    item: () => "minecraft:end_crystal", tecnica: "cristal", rango: [2.5, 6],
    proposito: "Explosión precisa", estrategia: "Poner y detonar", combos: ["cristal_preciso"],
  },
  bloques: {
    item: () => "minecraft:cobblestone", tecnica: "altura",
    proposito: "Altura", estrategia: "Pilar para ganar altura o preparar la maza", combos: ["pilar_maza"],
  },
  mano: { item: () => "minecraft:air", tecnica: "acercarse", rango: [0, 3], cuerpo: true, dano: [1, 1, 1, 1, 1], extraCadencia: 0, combos: [] },
};

export function disponible(s, cat) {
  const a = ARMAS[cat];
  return !!a && puede(s, a.tecnica);
}

export function tier(s) {
  return fase(s.fase).tier;
}

export function costeCambio(s) {
  return Math.round(15 - (12 * (s.fase - 1)) / 19);
}

export function mantener(s) {
  return Math.round(40 - (28 * (s.fase - 1)) / 19);
}

export function danoBase(s, cat = s.arma) {
  const a = ARMAS[cat] ?? ARMAS.mano;
  return (a.dano ?? ARMAS.mano.dano)[tier(s)];
}

export function esCuerpo(cat) {
  return !!ARMAS[cat]?.cuerpo;
}

export function esDistancia(cat) {
  return !!ARMAS[cat]?.distancia;
}

// Se pone el arma (o el objeto) en la mano. Devuelve los ticks que tarda.
export function equipar(e, s, cat, op = {}) {
  const a = ARMAS[cat];
  if (!a) return 0;
  const item = a.item(tier(s), s);
  if (s.arma === cat && s.item === item && !op.forzar) return 0;
  sostener(e, item);
  const anterior = s.arma;
  s.arma = cat;
  s.item = item;
  s.armaDesde = now();
  if (a.cuerpo || a.distancia) s.armaPrincipal = cat; // a esta vuelve después de usar un objeto
  if (!op.urgente) gesto(e, s, "cambio");
  const coste = op.urgente ? 1 : costeCambio(s);
  if (anterior !== cat) s.listoEn = Math.max(s.listoEn, now() + coste);
  return coste;
}

// Escudo en la otra mano (fase 2+). Con el arco o la ballesta también lo lleva.
export function escudoMano(e, s) {
  const quiere = puede(s, "escudo");
  if (quiere === s.escudo) return;
  s.escudo = quiere;
  sostener(e, quiere ? "minecraft:shield" : "minecraft:air", "slot.weapon.offhand");
}

// Escudo arriba (lo leen los sensores de daño con las etiquetas que pone index.js).
export function levantarEscudo(e, s, ticks = 12) {
  if (!s.escudo || now() < (s.escudoRotoHasta ?? 0)) return false;
  s.escudoArriba = true;
  s.escudoHasta = now() + ticks;
  pose(e, s, "cubrirse");
  return true;
}

export function bajarEscudo(e, s) {
  if (!s.escudoArriba) return;
  s.escudoArriba = false;
  pose(e, s, s.fase >= 6 ? "guardia" : "ninguna");
}

// Armadura de la fase (-1 nada, 0 cuero ... 4 netherita).
const PIEZAS = [["slot.armor.head", "helmet"], ["slot.armor.chest", "chestplate"], ["slot.armor.legs", "leggings"], ["slot.armor.feet", "boots"]];
const MATERIAL_ARMADURA = ["leather", "chainmail", "iron", "diamond", "netherite"];

export function vestirFase(e, s) {
  const n = fase(s.fase).armadura;
  if (n === s.armadura) return;
  s.armadura = n;
  for (const [slot, pieza] of PIEZAS) {
    run(e, `replaceitem entity @s ${slot} 0 ${n < 0 ? "minecraft:air" : `minecraft:${MATERIAL_ARMADURA[n]}_${pieza}`}`);
  }
}

// El arma que le conviene ahora (reglas, sin azar). c: { d, dy, caida, r (rasgos),
// rivalEnAgua, rivalQuieto, rivalCubre }.
export function elegirArma(s, c) {
  const pesos = ESTILOS[s.estilo]?.armas ?? {};
  /** @type {{ cat: string, w: number }[]} */
  const op = [];
  // El arco solo cuando estás lejos de verdad (y no justo después de usarlo): si no, te persigue.
  const lejos = c.d > (puede(s, "alternarDistancia") ? 12 : 18) && now() >= (s.cd.arco ?? 0);
  if (lejos && disponible(s, "arco")) {
    op.push({ cat: "arco", w: 1 + (c.r.escapista ? 0.6 : 0) });
    if (disponible(s, "ballesta")) op.push({ cat: "ballesta", w: c.rivalQuieto ? 1.7 : 0.8 });
    if (disponible(s, "tridente") && now() >= (s.cd.tridente ?? 0)) op.push({ cat: "tridente", w: c.rivalEnAgua ? 2.2 : 0.75 });
  }
  if (!lejos || !disponible(s, "arco")) {
    op.push({ cat: "espada", w: 1 });
    if (disponible(s, "hacha")) {
      let w = 0.35;
      if (c.rivalCubre || c.r.usaEscudo) w = 2.4;
      else if (puede(s, "pesado") && c.r.blindado) w = 1.15;
      op.push({ cat: "hacha", w });
    }
    if (disponible(s, "maza") && (c.dy > 1.5 || c.caida > 1.5)) op.push({ cat: "maza", w: 2.6 });
  }
  for (const o of op) o.w *= pesos[o.cat] ?? 1;
  op.sort((a, b) => b.w - a.w);
  return op[0]?.cat ?? "espada";
}

// Cambia al arma elegida si ya la sostuvo el tiempo mínimo (o si hay una razón fuerte).
export function decidirArma(e, s, c) {
  const quiere = elegirArma(s, c);
  if (quiere === s.arma) return false;
  const fuerte = (esDistancia(s.arma) && c.d < 8) || (esCuerpo(s.arma) && c.d > 14) || quiere === "maza"
    || (quiere === "hacha" && c.rivalCubre && puede(s, "aperturas"));
  if (!fuerte && now() - s.armaDesde < mantener(s)) return false;
  equipar(e, s, quiere);
  return true;
}
