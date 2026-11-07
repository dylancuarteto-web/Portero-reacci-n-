import { GANANCIA, INFINITO_CFG } from "./config.js";
import { faseDe, maxDeterminacion, umbral } from "./fases.js";

// DeterminationSystem: la DETERMINACIÓN es lo que lo hace evolucionar. Sube peleando (golpes,
// críticos, combos, bloqueos, esquivas, aguantar contra alguien mejor equipado, aprender un
// patrón, descubrir una estrategia que funciona, remontar con poca vida, levantarse después de
// un rescate y ganar). Los umbrales de cada fase crecen de forma exponencial (fases.js) y todo
// tiene tope: fase 20, determinación máxima y ganancia máxima por combate.
//
// Niveles (0 a 1) que usan los demás módulos:
//   reaccion, precision, movimiento, combos, armas, prediccion: según la fase;
//   adaptacion: según la fase y cuánto conoce al rival actual.

const oyentes = [];

// fn(entidad, estado, faseAnterior) cuando sube de fase (la presentación está en index.js).
export function alEvolucionar(fn) {
  oyentes.push(fn);
}

function vidaRelativa(e) {
  try {
    const h = e.getComponent("minecraft:health");
    return h ? h.currentValue / h.effectiveMax : 1;
  } catch {
    return 1;
  }
}

export function ganar(e, s, motivo, factor = 1) {
  const base = (GANANCIA[motivo] ?? 1) * factor;
  if (!(base > 0)) return 0;
  const conPocaVida = vidaRelativa(e) < 0.4 ? 1.5 : 1;
  const resto = Math.max(0, INFINITO_CFG.maxPorCombate - (s.combate?.ganado ?? 0));
  const g = Math.min(resto, base * INFINITO_CFG.ritmo * conPocaVida);
  s.experiencia = (s.experiencia ?? 0) + base;
  s.estadisticas[motivo] = (s.estadisticas[motivo] ?? 0) + 1;
  if (g <= 0) return 0;
  s.determinacion = Math.min(maxDeterminacion(), (s.determinacion ?? 0) + g);
  if (s.combate) s.combate.ganado = (s.combate.ganado ?? 0) + g;
  revisarFase(e, s);
  return g;
}

export function revisarFase(e, s) {
  const nueva = faseDe(s.determinacion);
  if (nueva <= s.fase) return false;
  const anterior = s.fase;
  s.fase = nueva;
  for (const fn of oyentes) {
    try {
      fn(e, s, anterior);
    } catch {
      // La presentación no debe frenar la pelea.
    }
  }
  return true;
}

// Para los comandos y las pruebas.
export function ponerFase(e, s, n) {
  const f = Math.max(1, Math.min(INFINITO_CFG.maxFase, Math.round(n)));
  const anterior = s.fase;
  const hasta = f < INFINITO_CFG.maxFase ? umbral(f + 1) - 0.01 : maxDeterminacion();
  s.determinacion = Math.max(umbral(f), Math.min(hasta, s.determinacion));
  s.fase = f;
  for (const fn of oyentes) {
    try {
      fn(e, s, anterior);
    } catch {
      // Sin presentación.
    }
  }
}

export function ponerDeterminacion(e, s, valor) {
  const anterior = s.fase;
  s.determinacion = Math.max(0, Math.min(maxDeterminacion(), valor));
  s.fase = faseDe(s.determinacion);
  if (s.fase !== anterior) {
    for (const fn of oyentes) {
      try {
        fn(e, s, anterior);
      } catch {
        // Sin presentación.
      }
    }
  }
}

const curva = (n, k) => 1 - Math.exp(-k * (n - 1));

export function niveles(s, memoriaRival) {
  const n = s.fase;
  const conoce = memoriaRival ? Math.min(1, (memoriaRival.muestras ?? 0) / 400) : 0;
  return {
    reaccion: curva(n, 0.16),
    precision: curva(n, 0.18),
    movimiento: curva(n, 0.14),
    combos: curva(n, 0.12),
    armas: curva(n, 0.15),
    prediccion: n >= 12 ? curva(n - 10, 0.35) : 0,
    adaptacion: Math.min(1, curva(n, 0.12) * (0.6 + 0.4 * conoce)),
  };
}

// Progreso hacia la siguiente fase (0 a 1) para mostrarlo.
export function progreso(s) {
  if (s.fase >= INFINITO_CFG.maxFase) return 1;
  const a = umbral(s.fase);
  const b = umbral(s.fase + 1);
  return Math.max(0, Math.min(1, (s.determinacion - a) / (b - a)));
}
