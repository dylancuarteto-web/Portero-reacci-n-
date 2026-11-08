import { flat, impulse, mirarA, now, sortear, sound } from "../util.js";
import { prohibido, pesoCombo } from "./adaptacion.js";
import { gesto } from "./animacion.js";
import { disponible, equipar, esDistancia, levantarEscudo, bajarEscudo } from "./armas.js";
import { INFINITO_CFG } from "./config.js";
import { ponerTemporal, aguaTactica, lavaControl } from "./cubetas.js";
import { ganar } from "./determinacion.js";
import { puede } from "./fases.js";
import { alcance, cayendo, distanciaA, enAlcance, golpear, impactoMaza, listoParaGolpear } from "./golpe.js";
import { resultado, rival } from "./memoria.js";
import {
  acercar, buscarAltura, esquivar, mover, perseguir, presion, presionar, reposicionar, retroceder, saltar, stap, strafe, wtap,
} from "./movimiento.js";
import { decir } from "./personalidad.js";
import {
  carga, comer, detonarCristal, disparar, hayVista, lanzarPerla, lanzarPocion, lanzarTridente, ponerCristal, ponerTnt,
} from "./proyectiles.js";
import { registrarError } from "./rendimiento.js";

// ComboEngine. Un combo es un objeto de datos:
//   { id, nombre, fase, peso, rango: [min, max], armas: [...], etiquetas: [...], si(ctx)?, pasos }
// y cada paso es una ACCIÓN REAL del registro ACCIONES (golpe, crítico, sprint reset, W-tap,
// S-tap, strafe, salto, cambio de arma, disparo, tridente, perla, cubeta, lava, TNT,
// cristal, maza, pilar, poción, comida, finta, escudo, persecución, retirada...).
// Para agregar un combo basta con llamar a registrarCombo({...}); para agregar una acción,
// accion("nombre", fn). Nada más cambia.
//
// Una acción recibe { e, s, obj, c, paso } y devuelve { espera: ticks } (hecha), SEGUIR
// (todavía no: se vuelve a llamar el tick siguiente, con tope paso.max) o false (falló).

export const SEGUIR = "seguir";
const listo = (espera = 0) => ({ espera });
export const ACCIONES = {};
const MAX = { golpe: 30, critico: 26, acercar: 40, perseguir: 60, retroceder: 40, reposicionar: 35, disparar: 55, tridente: 45,
  perla: 60, maza: 55, pilar: 55, altura: 25 };

export function accion(nombre, fn) {
  ACCIONES[nombre] = fn;
}

function contar(c, r) {
  c.golpes++;
  if (r.ok) c.aciertos++;
  if (r.bloqueado) c.bloqueados++;
}

// --- Acciones ---------------------------------------------------------------------------
accion("golpe", ({ e, s, obj, c, paso }) => {
  if (!enAlcance(e, s, obj)) {
    acercar(s, obj, { hasta: alcance(s) - 0.4, correr: true });
    return SEGUIR;
  }
  if (!listoParaGolpear(s)) {
    if (!s.mov || s.mov.modo === "quieto") presionar(s, obj); // espera su golpe moviéndose
    return SEGUIR;
  }
  contar(c, golpear(e, s, obj, { tipo: paso.tipo }));
  return listo(1);
});

// Crítico: salta y golpea al caer.
accion("critico", ({ e, s, obj, c }) => {
  if (!puede(s, "critico")) return ACCIONES.golpe({ e, s, obj, c, paso: {} });
  if (c.datos.salto === undefined) {
    if (!enAlcance(e, s, obj, 0.9)) {
      acercar(s, obj, { hasta: 2.2, correr: true });
      return SEGUIR;
    }
    if (!saltar(e, s, obj, 0.42, 0.12)) return SEGUIR;
    c.datos.salto = now();
    return SEGUIR;
  }
  if (cayendo(e) && enAlcance(e, s, obj, 0.4) && listoParaGolpear(s)) {
    contar(c, golpear(e, s, obj, { tipo: "critico" }));
    return listo(1);
  }
  if (now() - c.datos.salto > 18) {
    // No llegó a caer cerca: golpe normal si se puede.
    if (enAlcance(e, s, obj) && listoParaGolpear(s)) contar(c, golpear(e, s, obj, {}));
    return listo(1);
  }
  return SEGUIR;
});

accion("sprintReset", ({ e, s, obj }) => {
  wtap(e, s, obj);
  return listo(5);
});
ACCIONES.wtap = ACCIONES.sprintReset;

accion("stap", ({ e, s, obj }) => {
  stap(e, s, obj);
  return listo(4);
});

accion("strafe", ({ e, s, obj, paso }) => {
  const lado = paso.lado ?? -(s.lado ?? 1);
  const ticks = paso.ticks ?? 10;
  strafe(s, obj, lado, ticks, Math.max(2.2, Math.min(3, distanciaA(e, obj))));
  return listo(ticks);
});

accion("saltar", ({ e, s, obj, c }) => {
  if (!c.datos.hecho) {
    if (!saltar(e, s, obj, 0.42, 0.22)) return SEGUIR;
    c.datos.hecho = true;
  }
  return listo(3);
});

accion("acercar", ({ e, s, obj, paso }) => {
  const hasta = paso.hasta ?? alcance(s) - 0.2;
  if (distanciaA(e, obj) <= hasta) return listo(0);
  acercar(s, obj, { hasta: hasta - 0.2, correr: true });
  return SEGUIR;
});

accion("perseguir", ({ e, s, obj, paso }) => {
  const hasta = paso.hasta ?? alcance(s) - 0.2;
  if (distanciaA(e, obj) <= hasta) return listo(0);
  perseguir(s, obj);
  return SEGUIR;
});

accion("retroceder", ({ e, s, obj, paso }) => {
  const hasta = paso.hasta ?? 6;
  if (distanciaA(e, obj) >= hasta) return listo(0);
  retroceder(s, obj, hasta + 0.5);
  return SEGUIR;
});

accion("reposicionar", ({ e, s, obj, c }) => {
  if (!c.datos.hecho) {
    if (!reposicionar(e, s, obj)) return false;
    c.datos.hecho = true;
  }
  return s.mov?.modo === "punto" ? SEGUIR : listo(0);
});

accion("altura", ({ e, s, obj, c }) => {
  if (!c.datos.hecho) {
    if (!buscarAltura(e, s, obj)) return false;
    c.datos.hecho = true;
  }
  return s.mov?.modo === "punto" ? SEGUIR : listo(0);
});

accion("esquivar", ({ e, s, obj }) => (esquivar(e, s, obj) ? listo(6) : false));

// Cambio de arma. "otra": a la que sorprende (de espada a hacha y al revés).
accion("cambio", ({ e, s, paso }) => {
  let cat = paso.arma;
  if (cat === "otra") cat = s.arma === "hacha" ? "espada" : disponible(s, "hacha") ? "hacha" : "espada";
  if (!disponible(s, cat)) return false;
  return listo(equipar(e, s, cat));
});

accion("escudo", ({ e, s, paso }) => {
  const ticks = paso.ticks ?? 12;
  return levantarEscudo(e, s, ticks) ? listo(ticks) : false;
});

// Disparo con arco o ballesta: se pone el arma, tensa (camina lento) y dispara con predicción.
accion("disparar", ({ e, s, obj, c, paso }) => {
  let arma = paso.arma ?? "arco";
  if (arma === "auto") arma = esDistancia(s.arma) ? s.arma : "arco";
  if (!disponible(s, arma)) return false;
  if (s.arma !== arma) {
    equipar(e, s, arma);
    return SEGUIR;
  }
  if (now() < s.listoEn) return SEGUIR;
  if (c.datos.lista === undefined) {
    if (!hayVista(e, obj)) return false;
    c.datos.lista = now() + carga(s, arma);
    s.tensando = true;
    gesto(e, s, "arco", true);
    return SEGUIR;
  }
  try {
    mirarA(e, obj.getHeadLocation());
  } catch {
    // Sin giro.
  }
  if (now() < c.datos.lista) return SEGUIR;
  s.tensando = false;
  if (!hayVista(e, obj) || !disparar(e, s, obj, arma)) return false;
  return listo(2);
});

accion("tridente", ({ e, s, obj, c }) => {
  if (!disponible(s, "tridente") || now() < (s.cd.tridente ?? 0)) return false;
  if (s.arma !== "tridente") {
    equipar(e, s, "tridente");
    return SEGUIR;
  }
  if (now() < s.listoEn) return SEGUIR;
  if (c.datos.carga === undefined) {
    if (!hayVista(e, obj)) return false;
    c.datos.carga = now() + 8;
    gesto(e, s, "preparar", true);
    return SEGUIR;
  }
  if (now() < c.datos.carga) return SEGUIR;
  if (!lanzarTridente(e, s, obj)) return false;
  return listo(equipar(e, s, "espada"));
});

// Perla: "flanco" (al costado del rival), "lejos" (para escapar) o "cerca".
accion("perla", ({ e, s, obj, c, paso }) => {
  if (!c.datos.lanzada) {
    let destino;
    const d = flat(obj.location, e.location);
    if (paso.modo === "lejos") destino = { x: e.location.x + d.x * 14, y: e.location.y, z: e.location.z + d.z * 14 };
    else if (paso.modo === "cerca") destino = { ...obj.location };
    else {
      const lado = s.lado ?? 1;
      destino = { x: obj.location.x - d.z * lado * 2.5, y: obj.location.y, z: obj.location.z + d.x * lado * 2.5 };
    }
    if (!lanzarPerla(e, s, destino)) return false;
    c.datos.lanzada = true;
    return SEGUIR;
  }
  return s.perlaEnVuelo ? SEGUIR : listo(1);
});

accion("agua", ({ e, s, obj }) => (aguaTactica(e, s, obj) ? listo(4) : false));
accion("lava", ({ e, s, obj }) => (lavaControl(e, s, obj) ? listo(4) : false));
accion("tnt", ({ e, s, obj }) => (ponerTnt(e, s, obj) ? listo(3) : false));

accion("cristal", ({ e, s, obj, c }) => {
  const cr = ponerCristal(e, s, obj);
  if (!cr) return false;
  c.cristal = cr;
  return listo(2);
});

accion("detonar", ({ e, s, c }) => (detonarCristal(e, s, c.cristal) ? listo(2) : false));

// Maza: gana altura (si ya está más alto, se deja caer; si no, salta muy alto) y golpea
// al caer encima del rival. Sin daño por caída mientras dura.
accion("maza", ({ e, s, obj, c }) => {
  if (!disponible(s, "maza")) return false;
  if (s.arma !== "maza") {
    equipar(e, s, "maza");
    return SEGUIR;
  }
  if (now() < s.listoEn) return SEGUIR;
  if (c.datos.etapa === undefined) {
    const dy = e.location.y - obj.location.y;
    if (dy > 1.5) {
      s.alturaMax = e.location.y;
    } else {
      if (distanciaA(e, obj) > 5) {
        acercar(s, obj, { hasta: 3.5, correr: true });
        return SEGUIR;
      }
      if (!e.isOnGround) return SEGUIR;
      const d = flat(e.location, obj.location);
      const k = Math.min(0.3, distanciaA(e, obj) * 0.06);
      impulse(e, { x: d.x * k, y: 0.95, z: d.z * k });
      s.alturaMax = e.location.y;
      sound(e, "wind_charge.burst", 1, 0.8);
      gesto(e, s, "preparar", true);
    }
    s.sinCaidaHasta = now() + 70;
    mover(s, "hacia", { obj, hasta: 0.4, correr: true, permiteCaer: true, fin: now() + 50, luego: { modo: "quieto", obj } });
    c.datos.etapa = "caer";
    c.datos.desde = now();
    return SEGUIR;
  }
  if (e.isOnGround && now() - c.datos.desde > 5) return false; // cayó sin acertar
  if (cayendo(e) && distanciaA(e, obj) <= 2.4) {
    const caida = (s.alturaMax ?? e.location.y) - e.location.y;
    // Golpea cuando ya cayó lo suficiente y el rival está a su alcance (no desde muy arriba).
    if (caida < 1.5 || e.location.y - obj.location.y > 2.1) return SEGUIR;
    const r = impactoMaza(e, s, obj, caida);
    if (r.lejos) return SEGUIR;
    contar(c, r);
    s.sinCaidaHasta = now() + 12;
    return listo(4);
  }
  return SEGUIR;
});

// Pilar: salta y pone bloques debajo para ganar altura (fase 14+). Se quitan solos.
accion("pilar", ({ e, s, c, paso }) => {
  if (!puede(s, "bloques") || !INFINITO_CFG.modificaMundo) return false;
  const n = paso.alto ?? 2;
  c.datos.puestos ??= 0;
  if (c.datos.puestos >= n) return listo(2);
  if (s.arma !== "bloques") {
    equipar(e, s, "bloques", { urgente: true });
    return SEGUIR;
  }
  if (e.isOnGround && c.datos.base === undefined) {
    const techo = e.dimension.getBlock({ x: Math.floor(e.location.x), y: Math.floor(e.location.y) + 2, z: Math.floor(e.location.z) });
    if (techo && !techo.isAir) return c.datos.puestos ? listo(0) : false;
    mover(s, "quieto", {});
    try {
      const v = e.getVelocity();
      impulse(e, { x: -v.x, y: 0.42, z: -v.z });
    } catch {
      return false;
    }
    c.datos.base = Math.floor(e.location.y + 0.01);
    return SEGUIR;
  }
  if (c.datos.base !== undefined && e.location.y >= c.datos.base + 1.05) {
    const pos = { x: Math.floor(e.location.x), y: c.datos.base, z: Math.floor(e.location.z) };
    if (ponerTemporal(e, s, pos, "minecraft:cobblestone", 900)) {
      c.datos.puestos++;
      gesto(e, s, "torre", true);
      sound(e, "dig.stone", 1, 0.8);
    }
    c.datos.base = undefined;
  } else if (e.isOnGround && c.datos.base !== undefined && now() % 10 === 0) {
    c.datos.base = undefined; // el salto no subió (techo bajo): lo intenta otra vez
  }
  return SEGUIR;
});

accion("pocion", ({ e, s, obj, paso }) => (lanzarPocion(e, s, paso.efecto ?? "curacion", obj) ? listo(6) : false));
accion("comer", ({ e, s }) => (comer(e, s) ? listo(34) : false));

// Finta: amaga hacia el rival y se echa atrás (para sacarle el golpe).
accion("finta", ({ e, s, obj, c }) => {
  try {
    if (c.datos.t0 === undefined) {
      c.datos.t0 = now();
      gesto(e, s, "finta", true);
      const d = flat(e.location, obj.location);
      impulse(e, { x: d.x * 0.25, y: 0, z: d.z * 0.25 });
      return SEGUIR;
    }
    if (!c.datos.atras && now() - c.datos.t0 >= 4) {
      c.datos.atras = true;
      const d = flat(obj.location, e.location);
      impulse(e, { x: d.x * 0.3, y: 0, z: d.z * 0.3 });
    }
  } catch {
    return false;
  }
  return now() - c.datos.t0 >= 7 ? listo(0) : SEGUIR;
});

accion("esperar", ({ paso }) => listo(paso.ticks ?? 6));

// --- Catálogo -------------------------------------------------------------------------------
export const COMBOS = [];

export function registrarCombo(def) {
  if (!def?.id || !def.pasos) return false;
  const c = { peso: 1, rango: [0, 99], armas: [], etiquetas: [], fase: 1, ...def };
  const i = COMBOS.findIndex((x) => x.id === c.id);
  if (i >= 0) COMBOS[i] = c;
  else COMBOS.push(c);
  return true;
}

const E = { a: "cambio", arma: "espada" };
const H = { a: "cambio", arma: "hacha" };

// Los diez pedidos.
registrarCombo({ id: "espada_reset_espada", nombre: "Espada, sprint reset, espada", fase: 7, peso: 1.2, rango: [0, 4], armas: ["espada"],
  etiquetas: ["espada", "wtap", "rapido", "1.8"], pasos: [E, "golpe", "sprintReset", "golpe"] });
registrarCombo({ id: "espada_salto_critico", nombre: "Espada, salto, crítico", fase: 2, peso: 1, rango: [0, 3.5], armas: ["espada"],
  etiquetas: ["espada", "critico"], pasos: [E, "golpe", "critico"] });
registrarCombo({ id: "hacha_escudo_espada", nombre: "Hacha, escudo, espada", fase: 8, peso: 1, rango: [0, 3.5], armas: ["hacha", "espada"],
  etiquetas: ["hacha", "escudo", "rompeGuardia", "contra"], pasos: [H, { a: "golpe", tipo: "pesado" }, { a: "escudo", ticks: 10, opcional: true }, E, "golpe"] });
registrarCombo({ id: "arco_persecucion_espada", nombre: "Arco, persecución, espada", fase: 5, peso: 1.1, rango: [6, 24], armas: ["arco", "espada"],
  etiquetas: ["arco", "distancia", "persecucion", "cierre"], pasos: [{ a: "disparar", arma: "arco" }, E, "perseguir", "golpe"] });
registrarCombo({ id: "agua_reposicion_ataque", nombre: "Cubeta de agua, reposicionamiento, ataque", fase: 11, peso: 1, rango: [1.5, 5], armas: ["cubeta", "espada"],
  etiquetas: ["cubeta", "control", "uhc"], pasos: ["agua", "reposicionar", E, "golpe", "golpe"] });
registrarCombo({ id: "persecucion_salto_aereo", nombre: "Persecución, salto, ataque aéreo", fase: 9, peso: 1, rango: [4, 14], armas: ["espada"],
  etiquetas: ["persecucion", "altura", "critico"], pasos: [E, "perseguir", "critico"] });
registrarCombo({ id: "tridente_acercamiento_combo", nombre: "Tridente, acercamiento, combo", fase: 12, peso: 1, rango: [5, 18], armas: ["tridente", "espada"],
  etiquetas: ["tridente", "distancia", "cierre"], pasos: ["tridente", "acercar", "golpe", "wtap", "golpe"] });
registrarCombo({ id: "maza_caida_vertical", nombre: "Maza, caída, ataque vertical", fase: 14, peso: 1.1, rango: [1, 6], armas: ["maza", "espada"],
  etiquetas: ["maza", "altura"], pasos: ["maza", E] });
registrarCombo({ id: "bloqueo_contra_persecucion", nombre: "Bloqueo, contraataque, persecución", fase: 5, peso: 1, rango: [0, 4], armas: ["espada"],
  etiquetas: ["escudo", "contra", "persecucion"], si: (x) => x.rivalAtaca,
  pasos: [{ a: "escudo", ticks: 14 }, { a: "golpe", tipo: "pesado" }, "perseguir", "golpe"] });
registrarCombo({ id: "cambio_sorpresa", nombre: "Cambio de arma, ataque sorpresa", fase: 8, peso: 0.9, rango: [0, 3.5], armas: ["hacha", "espada"],
  etiquetas: ["sorpresa", "rompeGuardia", "finta"], pasos: ["finta", { a: "cambio", arma: "otra" }, { a: "golpe", tipo: "pesado" }] });

// Más combos.
registrarCombo({ id: "doble_golpe", nombre: "Doble golpe", fase: 3, rango: [0, 3.5], etiquetas: ["rapido"],
  pasos: ["golpe", { a: "esperar", ticks: 2 }, "golpe"] });
registrarCombo({ id: "carrera_golpe", nombre: "Carrera y golpe", fase: 3, peso: 0.9, rango: [3, 9], etiquetas: ["cierre", "persecucion"],
  pasos: ["acercar", "golpe"] });
registrarCombo({ id: "escudo_castigo", nombre: "Escudo y castigo", fase: 4, peso: 0.9, rango: [0, 3.5], etiquetas: ["escudo", "contra"],
  si: (x) => x.rivalAtaca, pasos: [{ a: "escudo", ticks: 12 }, "golpe"] });
registrarCombo({ id: "cadena_guerrero", nombre: "Cadena del guerrero", fase: 5, rango: [0, 3.5], etiquetas: ["rapido", "persecucion"],
  pasos: ["golpe", "acercar", "golpe", "acercar", "golpe"] });
registrarCombo({ id: "finta_retrasada", nombre: "Finta y golpe retrasado", fase: 6, rango: [1.5, 4], etiquetas: ["finta", "contra", "tiempo"],
  pasos: ["finta", { a: "esperar", ticks: 5 }, "golpe"] });
registrarCombo({ id: "intercambio", nombre: "Intercambio y salida", fase: 6, peso: 0.9, rango: [0, 3.5], etiquetas: ["stap", "contra"],
  pasos: ["golpe", "stap", { a: "strafe", ticks: 8 }, "golpe"] });
registrarCombo({ id: "wtap_cadena", nombre: "W-tap en cadena", fase: 7, peso: 1.2, rango: [0, 4], armas: ["espada"], etiquetas: ["wtap", "rapido", "1.8", "espada"],
  pasos: [E, "golpe", "wtap", "golpe", "wtap", "golpe"] });
registrarCombo({ id: "stap_espaciado", nombre: "S-tap", fase: 7, rango: [0, 3.5], etiquetas: ["stap", "antiSalto", "contra"],
  pasos: ["golpe", "stap", "golpe", "stap"] });
registrarCombo({ id: "strafe_golpe", nombre: "Strafe y golpe", fase: 7, peso: 1.1, rango: [0, 4], etiquetas: ["strafe", "rapido"],
  pasos: [{ a: "strafe", ticks: 8 }, "golpe", { a: "strafe", ticks: 8 }, "golpe"] });
registrarCombo({ id: "rompeguardia", nombre: "Rompeguardia", fase: 8, peso: 1.3, rango: [0, 3.5], armas: ["hacha", "espada"], etiquetas: ["hacha", "rompeGuardia"],
  si: (x) => x.rivalCubre || x.r.usaEscudo, pasos: [H, { a: "golpe", tipo: "pesado" }, E, "golpe", "golpe"] });
registrarCombo({ id: "altura_ataque", nombre: "Altura y ataque", fase: 9, peso: 0.8, rango: [1.5, 5], etiquetas: ["altura", "terreno", "antiSalto"],
  pasos: ["altura", "critico"] });
registrarCombo({ id: "perla_flanco", nombre: "Perla de flanco", fase: 9, rango: [9, 30], armas: ["perla", "espada"], etiquetas: ["perla", "cierre"],
  pasos: [{ a: "perla", modo: "flanco" }, E, "golpe", "golpe"] });
registrarCombo({ id: "combo_mixto", nombre: "Combo mixto", fase: 10, peso: 1.1, rango: [0, 3.5], armas: ["espada", "hacha"], etiquetas: ["rapido", "pesado", "rompeGuardia"],
  pasos: [E, "golpe", "sprintReset", "golpe", H, { a: "golpe", tipo: "pesado" }, E] });
registrarCombo({ id: "lava_corte", nombre: "Lava de control", fase: 11, peso: 0.7, rango: [3, 7], armas: ["lava", "arco"], etiquetas: ["control", "cubeta", "distancia"],
  pasos: ["lava", { a: "retroceder", hasta: 8 }, { a: "disparar", arma: "arco" }] });
registrarCombo({ id: "ballesta_castigo", nombre: "Ballesta y castigo", fase: 12, rango: [5, 20], armas: ["ballesta", "espada"], etiquetas: ["distancia", "cierre"],
  si: (x) => x.rivalQuieto, pasos: [{ a: "disparar", arma: "ballesta" }, E, "perseguir", "golpe"] });
registrarCombo({ id: "alternar_distancia", nombre: "Alternar distancia", fase: 12, peso: 0.5, rango: [0, 4], armas: ["arco", "espada"], etiquetas: ["distancia", "stap"],
  pasos: ["golpe", { a: "retroceder", hasta: 8 }, { a: "disparar", arma: "arco" }, E, "perseguir", "golpe"] });
registrarCombo({ id: "tnt_zona", nombre: "TNT y presión", fase: 13, peso: 0.8, rango: [3, 8], armas: ["tnt", "arco", "espada"], etiquetas: ["explosion", "control"],
  pasos: ["tnt", { a: "retroceder", hasta: 8 }, { a: "disparar", arma: "arco" }, E] });
registrarCombo({ id: "cristal_preciso", nombre: "Cristal", fase: 13, peso: 0.9, rango: [2.5, 6], armas: ["cristal", "espada"], etiquetas: ["explosion"],
  pasos: [{ a: "retroceder", hasta: 4 }, "cristal", { a: "esperar", ticks: 2 }, "detonar", E, "perseguir", "golpe"] });
registrarCombo({ id: "pilar_maza", nombre: "Pilar y maza", fase: 14, peso: 0.9, rango: [1.5, 5], armas: ["bloques", "maza", "espada"], etiquetas: ["maza", "altura"],
  si: (x) => x.techoLibre, pasos: [{ a: "pilar", alto: 2 }, "maza", E] });
registrarCombo({ id: "pociones_presion", nombre: "Pot PvP", fase: 15, peso: 0.9, rango: [0, 5], armas: ["pocion", "espada"], etiquetas: ["pocion"],
  pasos: [{ a: "pocion", efecto: "fuerza" }, E, "golpe", "golpe", { a: "pocion", efecto: "lentitud", opcional: true }] });
registrarCombo({ id: "estilo_18", nombre: "Estilo 1.8", fase: 15, rango: [0, 4], armas: ["espada"], etiquetas: ["1.8", "rapido", "wtap"],
  pasos: [E, { a: "golpe", tipo: "rapido" }, "wtap", { a: "golpe", tipo: "rapido" }, { a: "strafe", ticks: 6 }, { a: "golpe", tipo: "rapido" }] });
registrarCombo({ id: "estilo_19", nombre: "Estilo 1.9+", fase: 15, rango: [0, 4], etiquetas: ["1.9", "pesado", "tiempo", "escudo"],
  pasos: [{ a: "escudo", ticks: 8, opcional: true }, { a: "golpe", tipo: "pesado" }, { a: "escudo", ticks: 8, opcional: true }, { a: "golpe", tipo: "pesado" }] });
registrarCombo({ id: "uhc", nombre: "Estilo UHC", fase: 15, peso: 0.9, rango: [4, 14], armas: ["arco", "cubeta", "espada"], etiquetas: ["uhc", "arco", "cubeta"],
  pasos: [{ a: "disparar", arma: "arco" }, E, "acercar", { a: "agua", opcional: true }, "golpe", "golpe"] });
registrarCombo({ id: "contra_combo", nombre: "Contra-combo", fase: 16, peso: 1.2, rango: [0, 4], etiquetas: ["contra", "escudo"],
  si: (x) => x.anticipa === "atacar", pasos: [{ a: "escudo", ticks: 8, opcional: true }, "esquivar", "critico", "stap"] });
registrarCombo({ id: "ritmo_roto", nombre: "Ritmo roto", fase: 16, peso: 0.9, rango: [0, 4], etiquetas: ["tiempo", "finta"],
  pasos: ["golpe", { a: "esperar", ticks: 9 }, "finta", "golpe", { a: "esperar", ticks: 3 }, "golpe"] });

// Fase 20: combo propio que se arma con lo que mejor le funcionó contra ESTE rival.
function comboInfinito(e, s, obj) {
  const m = rival(s, obj);
  const d = distanciaA(e, obj);
  const buenos = COMBOS.filter((c) => !c.interno && c.id !== "infinito" && c.fase <= s.fase && d >= c.rango[0] - 1 && d <= c.rango[1] + 1
    && c.armas.every((a) => disponible(s, a)) && (m.estrategias[c.id]?.ok ?? 0) > (m.estrategias[c.id]?.mal ?? 0))
    .sort((a, b) => (m.estrategias[b.id].ok - m.estrategias[b.id].mal) - (m.estrategias[a.id].ok - m.estrategias[a.id].mal))
    .slice(0, 3);
  if (!buenos.length) return ["perseguir", "golpe", "sprintReset", "critico", "stap", { a: "strafe", ticks: 6 }, "golpe"];
  const pasos = [];
  for (const c of buenos) for (const p of c.pasos) pasos.push(p);
  pasos.push("critico");
  return pasos.slice(0, 14);
}

registrarCombo({ id: "infinito", nombre: "Combo infinito (adaptativo)", fase: 20, peso: 1.6, rango: [0, 10], armas: ["espada"], etiquetas: ["infinito"],
  pasos: comboInfinito });

// Secuencias internas (no son combos para aprender): el disparo del estado ENGAGING a distancia.
export const TIRO = { id: "tiro", nombre: "Tiro", interno: true, fase: 1, peso: 0, rango: [0, 99], armas: [], etiquetas: [],
  pasos: (e, s) => [s.arma === "tridente" ? { a: "tridente" } : { a: "disparar", arma: "auto" }] };

// --- Elección y ejecución -------------------------------------------------------------
// x: { d, m, r, rivalCubre, rivalAtaca, rivalQuieto, anticipa, techoLibre }
export function elegirCombo(e, s, x) {
  const lista = [];
  for (const c of COMBOS) {
    if (c.interno || c.fase > s.fase) continue;
    if (x.d < c.rango[0] || x.d > c.rango[1]) continue;
    if (c.armas.some((a) => !disponible(s, a))) continue;
    if (now() < (s.cd[`combo:${c.id}`] ?? 0)) continue;
    if (prohibido(s, x.m, c)) continue;
    try {
      if (c.si && !c.si(x)) continue;
    } catch {
      continue;
    }
    let p = c.peso * pesoCombo(s, x.m, x.r, c);
    // Contra un escudo levantado no tiene sentido una cadena de espada: rompe la guardia.
    if (x.rivalCubre && !c.etiquetas.some((t) => t === "rompeGuardia" || t === "hacha" || t === "distancia" || t === "explosion")) {
      p *= puede(s, "romperGuardia") ? 0.12 : 0.5;
    }
    lista.push({ c, p });
  }
  return lista.length ? sortear(lista).c : undefined;
}

export function iniciarCombo(e, s, def, obj) {
  let pasos;
  try {
    pasos = typeof def.pasos === "function" ? def.pasos(e, s, obj) : def.pasos;
  } catch (err) {
    registrarError(`combo ${def.id}`, err);
    return false;
  }
  s.combo = {
    def, pasos: pasos.map((p) => (typeof p === "string" ? { a: p } : p)), i: 0, t: 0, espera: 0, obj,
    golpes: 0, aciertos: 0, bloqueados: 0, datos: {}, desde: now(), golpeado: false,
  };
  if (!def.interno) {
    s.ultimosCombos.push(def.id);
    if (s.ultimosCombos.length > 6) s.ultimosCombos.shift();
    s.cd[`combo:${def.id}`] = now() + 80;
    gesto(e, s, "preparar");
  }
  return true;
}

function celebrar(e, s, obj) {
  decir(e, s, "combo");
  if (s.fase >= 16) return; // en las fases altas ya no celebra: sigue serio
  let lejos = true;
  try {
    lejos = !obj?.isValid || distanciaA(e, obj) > 3.2;
  } catch {
    lejos = true;
  }
  if (!lejos) return;
  gesto(e, s, s.fase >= 10 ? "giro" : "celebrar");
}

function murio(x) {
  try {
    return !x?.isValid || (x.getComponent("minecraft:health")?.currentValue ?? 1) <= 0;
  } catch {
    return true;
  }
}

export function terminarCombo(e, s, exito) {
  const c = s.combo;
  s.combo = undefined;
  s.tensando = false;
  if (s.escudoArriba && now() >= s.escudoHasta) bajarEscudo(e, s);
  if (!c) return;
  // Al terminar un combo vuelve a presionar (no se queda alejándose ni quieto).
  if (c.obj?.isValid && ["lejos", "quieto", "lado", "punto"].includes(s.mov?.modo) && !s.mov.fin) s.mov = presion(s, c.obj);
  // Si el combo terminó al rival, salió bien aunque no llegara al último paso.
  if (!exito && c.aciertos > 0 && murio(c.obj)) exito = true;
  s.cd.combo = now() + Math.max(8, 46 - s.fase * 2);
  if (c.def.interno) return;
  const ok = exito && (c.golpes === 0 || c.aciertos * 2 >= c.golpes);
  let m;
  try {
    if (c.obj?.isValid) m = rival(s, c.obj);
  } catch {
    m = undefined;
  }
  if (m) {
    const antes = m.estrategias[c.def.id]?.ok ?? 0;
    resultado(m, c.def.id, ok);
    if (ok && antes === 0) ganar(e, s, "estrategia");
  }
  if (ok) {
    ganar(e, s, "combo", 1 + c.aciertos * 0.25);
    s.seguidasMal = 0;
    celebrar(e, s, c.obj);
  } else {
    s.seguidasMal = (s.seguidasMal ?? 0) + 1;
  }
  s.ultimoCombo = { id: c.def.id, ok, t: now() };
}

// Cada tick mientras hay combo.
export function tickCombo(e, s) {
  const c = s.combo;
  if (!c) return;
  if (!c.obj?.isValid) return terminarCombo(e, s, false);
  // Fase 10+: si recibe un golpe en medio del combo, lo corta (el cerebro pasa a defender).
  if (c.golpeado && !c.def.interno && puede(s, "interrumpir")) {
    s.interrumpido = now();
    return terminarCombo(e, s, false);
  }
  if (now() < c.espera) return;
  const paso = c.pasos[c.i];
  if (!paso) return terminarCombo(e, s, true);
  const fn = ACCIONES[paso.a];
  if (!fn) {
    registrarError("combos", `acción desconocida: ${paso.a}`);
    c.i++;
    return;
  }
  c.t++;
  let r;
  try {
    r = fn({ e, s, obj: c.obj, c, paso });
  } catch (err) {
    registrarError(`combo ${c.def.id}/${paso.a}`, err);
    r = false;
  }
  if (r === SEGUIR && c.t < (paso.max ?? MAX[paso.a] ?? 30)) return;
  if (r === false || r === SEGUIR) {
    if (!paso.opcional) return terminarCombo(e, s, false);
    r = listo(0);
  }
  c.i++;
  c.t = 0;
  c.datos = {};
  c.espera = now() + (r.espera ?? 0);
}
