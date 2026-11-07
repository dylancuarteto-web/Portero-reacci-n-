import { INFINITO_CFG } from "./config.js";

// PhaseManager: las 20 fases de Claude Exponencial Infinito. Cada fase SUMA técnicas (las de
// las fases anteriores siguen) y cambia su reacción, su puntería, su ritmo de golpes y sus
// errores. Las técnicas son nombres que usan el cerebro, las armas, los combos y el
// movimiento para decidir qué puede hacer (ver `puede`).
//
// reaccion: ticks entre decisiones · precision: error de puntería (bloques a 10 de distancia)
// golpeCada: ticks mínimos entre golpes · error: probabilidad de fallar un golpe
// tier: material del arma (0 madera, 1 piedra, 2 hierro, 3 diamante, 4 netherita)
// armadura: -1 ninguna, 0 cuero, 1 cota, 2 hierro, 3 diamante, 4 netherita
// observa: ticks que estudia al rival antes de atacar

export const FASES = [
  { n: 1, nombre: "NOOB", reaccion: 30, precision: 2.0, golpeCada: 30, error: 0.35, tier: 0, armadura: -1, observa: 0,
    nuevas: ["acercarse"] },
  { n: 2, nombre: "APRENDIZ", reaccion: 26, precision: 1.7, golpeCada: 26, error: 0.25, tier: 1, armadura: 0, observa: 6,
    nuevas: ["distancia", "escudo", "saltarAntes", "critico"] },
  { n: 3, nombre: "NOVATO", reaccion: 22, precision: 1.4, golpeCada: 22, error: 0.18, tier: 1, armadura: 0, observa: 10,
    nuevas: ["correrAtacar", "comboSimple", "arco", "rango"] },
  { n: 4, nombre: "COMBATIENTE", reaccion: 19, precision: 1.2, golpeCada: 20, error: 0.12, tier: 2, armadura: 1, observa: 14,
    nuevas: ["espadaEscudo", "retroceder", "cambiarObjetivo", "comer"] },
  { n: 5, nombre: "GUERRERO", reaccion: 17, precision: 1.0, golpeCada: 18, error: 0.09, tier: 2, armadura: 1, observa: 18,
    nuevas: ["hacha", "cadenas", "castigar", "perseguir", "reposicionar"] },
  { n: 6, nombre: "DUELISTA", reaccion: 15, precision: 0.85, golpeCada: 16, error: 0.07, tier: 2, armadura: 2, observa: 22,
    nuevas: ["intercambios", "controlDistancia", "fintas", "alternar", "adaptar"] },
  { n: 7, nombre: "ESPECIALISTA EN ESPADAS", reaccion: 13, precision: 0.75, golpeCada: 14, error: 0.05, tier: 3, armadura: 2, observa: 24,
    nuevas: ["combosRapidos", "strafe", "sprintReset", "wtap", "stap", "alcance"] },
  { n: 8, nombre: "ESPECIALISTA EN HACHAS", reaccion: 12, precision: 0.65, golpeCada: 14, error: 0.05, tier: 3, armadura: 2, observa: 26,
    nuevas: ["hachaEscudo", "aperturas", "pesado", "cambioArma", "romperGuardia"] },
  { n: 9, nombre: "ESPECIALISTA EN MOVILIDAD", reaccion: 11, precision: 0.6, golpeCada: 13, error: 0.04, tier: 3, armadura: 3, observa: 28,
    nuevas: ["saltosEstrategicos", "cambiosDireccion", "persecucionInteligente", "altura", "impredecible", "perla", "jumpReset"] },
  { n: 10, nombre: "MAESTRO DE COMBOS", reaccion: 10, precision: 0.5, golpeCada: 12, error: 0.035, tier: 3, armadura: 3, observa: 30,
    nuevas: ["combosMixtos", "sinRepetir", "interrumpir"] },
  { n: 11, nombre: "MAESTRO DE CUBETAS", reaccion: 9, precision: 0.45, golpeCada: 12, error: 0.03, tier: 3, armadura: 3, observa: 30,
    nuevas: ["aguaClutch", "mlg", "aguaTactica", "lava"] },
  { n: 12, nombre: "MAESTRO DE PROYECTILES", reaccion: 8, precision: 0.38, golpeCada: 11, error: 0.025, tier: 3, armadura: 3, observa: 32,
    nuevas: ["ballesta", "tridente", "prediccion", "alternarDistancia"] },
  { n: 13, nombre: "MAESTRO DE TNT Y CRISTAL", reaccion: 8, precision: 0.34, golpeCada: 11, error: 0.02, tier: 3, armadura: 3, observa: 34,
    nuevas: ["tnt", "cristal"] },
  { n: 14, nombre: "MAESTRO DE MACE", reaccion: 7, precision: 0.3, golpeCada: 10, error: 0.02, tier: 4, armadura: 3, observa: 36,
    nuevas: ["maza", "bloques"] },
  { n: 15, nombre: "MAESTRO MULTIMODAL", reaccion: 7, precision: 0.26, golpeCada: 10, error: 0.015, tier: 4, armadura: 4, observa: 38,
    nuevas: ["multimodal", "pociones"] },
  { n: 16, nombre: "COMPETIDOR PROFESIONAL", reaccion: 6, precision: 0.22, golpeCada: 9, error: 0.012, tier: 4, armadura: 4, observa: 40,
    nuevas: ["patrones", "contraCombos", "ritmo"] },
  { n: 17, nombre: "ÉLITE", reaccion: 6, precision: 0.18, golpeCada: 9, error: 0.01, tier: 4, armadura: 4, observa: 42,
    nuevas: ["terreno", "escapar"] },
  { n: 18, nombre: "TOP 10", reaccion: 5, precision: 0.14, golpeCada: 8, error: 0.008, tier: 4, armadura: 4, observa: 44,
    nuevas: ["estilos", "predecirPatrones"] },
  { n: 19, nombre: "TOP 1", reaccion: 5, precision: 0.1, golpeCada: 8, error: 0.005, tier: 4, armadura: 4, observa: 46,
    nuevas: ["anticipar", "noRepetir"] },
  { n: 20, nombre: "INFINITE DETERMINATION", reaccion: 4, precision: 0.06, golpeCada: 8, error: 0, tier: 4, armadura: 4, observa: 50,
    nuevas: ["infinito"] },
];

// Técnicas acumuladas por fase.
const TECNICAS = [];
{
  const acumuladas = new Set();
  for (const f of FASES) {
    for (const t of f.nuevas) acumuladas.add(t);
    TECNICAS.push(new Set(acumuladas));
  }
}

// Primera fase en la que aparece cada técnica (para la documentación y las pruebas).
export const DESDE = {};
for (const f of FASES) for (const t of f.nuevas) DESDE[t] ??= f.n;

export function fase(n) {
  return FASES[Math.max(1, Math.min(FASES.length, n)) - 1];
}

export function puede(s, tecnica) {
  return TECNICAS[Math.max(1, Math.min(FASES.length, s.fase)) - 1].has(tecnica);
}

// Tramo de aspecto: 0 (1-5), 1 (6-10), 2 (11-15), 3 (16-19), 4 (20).
export function tramo(n) {
  return n >= 20 ? 4 : n >= 16 ? 3 : n >= 11 ? 2 : n >= 6 ? 1 : 0;
}

// Determinación que hace falta para la fase n (exponencial).
export function umbral(n) {
  const { base, crecimiento } = INFINITO_CFG;
  return base * (crecimiento ** (Math.max(1, n) - 1) - 1);
}

export function faseDe(determinacion) {
  let n = 1;
  while (n < INFINITO_CFG.maxFase && determinacion >= umbral(n + 1)) n++;
  return n;
}

export function maxDeterminacion() {
  return umbral(INFINITO_CFG.maxFase) * INFINITO_CFG.maxDeterminacionX;
}

// Vida máxima por tramo (la entidad la toma de su grupo de componentes).
export const VIDA_TRAMO = [40, 52, 64, 72, 80];
