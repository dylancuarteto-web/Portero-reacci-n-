import { puede } from "./fases.js";
import { armaDe, combinacionRepetida, predecir, ritmoDeAtaque } from "./memoria.js";

// AdaptationEngine: lee la memoria del rival y decide cómo responderle.
//   - rasgos: salta mucho, se cubre con escudo, es arquero, se escapa, es agresivo, repite la
//     misma combinación, va muy blindado;
//   - estilo (fase 15+): espada, hacha, 1.8, 1.9+, UHC, pociones, SMP, maza, arco, tridente,
//     cubetas o cristal, según el rival y según lo que le está funcionando;
//   - pesos de los combos: suben los que le funcionaron y los que contrarrestan sus rasgos;
//     bajan los que fallaron; en la fase 19+ prohíbe los que ya le contrarrestaron;
//   - anticipación (fase 16+): qué va a hacer el rival después.

export const ESTILOS = {
  espada: { armas: { espada: 1.6 }, etiquetas: ["espada"] },
  hacha: { armas: { hacha: 1.8 }, etiquetas: ["hacha"] },
  "1.8": { armas: { espada: 1.4 }, etiquetas: ["rapido", "wtap"] },
  "1.9": { armas: { espada: 1.2, hacha: 1.3 }, etiquetas: ["pesado", "tiempo"] },
  uhc: { armas: { espada: 1.2, arco: 1.4 }, etiquetas: ["arco", "cubeta", "comida"] },
  pociones: { armas: { espada: 1.3 }, etiquetas: ["pocion"] },
  smp: { armas: { espada: 1.1, hacha: 1.1, arco: 1.1 }, etiquetas: ["escudo", "perla"] },
  maza: { armas: { maza: 1.8 }, etiquetas: ["maza", "altura"] },
  arco: { armas: { arco: 1.6, ballesta: 1.3 }, etiquetas: ["distancia"] },
  tridente: { armas: { tridente: 1.8 }, etiquetas: ["tridente"] },
  cubetas: { armas: { espada: 1.1 }, etiquetas: ["cubeta"] },
  cristal: { armas: { espada: 1.1 }, etiquetas: ["explosion"] },
};

export function rasgos(m, rivalEnt) {
  const arma = rivalEnt ? armaDe(rivalEnt) : "mano";
  return {
    saltaMucho: m.saltos > 0.3,
    usaEscudo: m.escudo > 0.22,
    arquero: (m.armas.flecha ?? 0) >= 2 || arma === "arco" || arma === "ballesta",
    escapista: m.escapes >= 2,
    agresivo: ritmoDeAtaque(m) < 18 && m.acercamiento > 0.04,
    repite: !!combinacionRepetida(m),
    blindado: m.armadura >= 3,
    arma,
  };
}

// Revisa si aprendió algo nuevo de este rival (para el estado ADAPTING y la determinación).
export function patronNuevo(s, m, r) {
  if (!puede(s, "adaptar")) return undefined;
  for (const nombre of ["saltaMucho", "usaEscudo", "arquero", "escapista", "agresivo", "repite", "blindado"]) {
    if (r[nombre] && !m.patrones.includes(nombre)) {
      m.patrones.push(nombre);
      return nombre;
    }
  }
  return undefined;
}

// Estilo de combate (fase 15+). Cambia si el actual no funciona.
export function elegirEstilo(s, m, r) {
  if (!puede(s, "multimodal")) return undefined;
  const candidatos = [];
  if (r.usaEscudo) candidatos.push("hacha", "1.9");
  if (r.arquero) candidatos.push("smp", "1.8");
  if (r.escapista) candidatos.push("arco", "tridente", "uhc");
  if (r.saltaMucho) candidatos.push("1.9", "espada");
  if (r.blindado) candidatos.push("maza", "cristal", "pociones");
  if (r.agresivo) candidatos.push("smp", "espada");
  if (!candidatos.length) candidatos.push("1.8", "espada", "uhc", "maza", "cubetas");
  // Si va perdiendo el intercambio con el estilo actual, prueba otro.
  const actual = s.estilo;
  const malo = actual && (s.combate?.recibidos ?? 0) > (s.combate?.dados ?? 0) + 3;
  const lista = malo ? candidatos.filter((c) => c !== actual) : candidatos;
  if (!malo && actual && lista.includes(actual)) return actual;
  return lista[Math.floor(Math.random() * lista.length)] ?? actual;
}

// Multiplicador del peso de un combo contra este rival.
export function pesoCombo(s, m, r, combo) {
  let w = 1;
  const e = m.estrategias[combo.id];
  if (e) w *= (1 + e.ok * 0.5) / (1 + e.mal * 0.8);
  const t = combo.etiquetas ?? [];
  if (r.usaEscudo && (t.includes("hacha") || t.includes("rompeGuardia"))) w *= 2.4;
  if (r.saltaMucho && (t.includes("antiSalto") || t.includes("stap"))) w *= 2;
  if (r.escapista && (t.includes("distancia") || t.includes("persecucion"))) w *= 2.2;
  if (r.agresivo && (t.includes("contra") || t.includes("escudo"))) w *= 2;
  if (r.arquero && (t.includes("cierre") || t.includes("perla"))) w *= 1.8;
  if (r.blindado && (t.includes("maza") || t.includes("explosion"))) w *= 1.8;
  const estilo = ESTILOS[s.estilo];
  if (estilo && t.some((x) => estilo.etiquetas.includes(x))) w *= 1.7;
  // No repetir sin necesidad (fase 10+): baja el peso de lo que acaba de usar.
  if (puede(s, "sinRepetir")) {
    const usos = s.ultimosCombos.filter((x) => x === combo.id).length;
    w /= 1 + usos * 1.5;
  }
  return w;
}

export function prohibido(s, m, combo) {
  if (!puede(s, "noRepetir")) return false;
  return (m.contrarrestados[combo.id] ?? 0) >= 2;
}

// Anticipación (fase 16+): qué va a hacer el rival. Devuelve "atacar", "saltar", "escapar",
// "cubrirse", "disparar" o undefined.
export function anticipar(s, m) {
  if (!puede(s, "patrones")) return undefined;
  const p = predecir(m);
  const umbral = puede(s, "anticipar") ? 0.4 : puede(s, "predecirPatrones") ? 0.48 : 0.55;
  if (!p || p.confianza < umbral) return undefined;
  if (p.accion.startsWith("golpe")) return "atacar";
  if (p.accion === "salto") return "saltar";
  if (p.accion === "escapa") return "escapar";
  if (p.accion === "escudo") return "cubrirse";
  if (p.accion === "flecha") return "disparar";
  return undefined;
}
