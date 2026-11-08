import { GameMode } from "@minecraft/server";
import { vida } from "../dano.js";
import { flat, now } from "../util.js";
import { anticipar, elegirEstilo, patronNuevo, rasgos } from "./adaptacion.js";
import { gesto, poseDeEstado } from "./animacion.js";
import { bajarEscudo, decidirArma, equipar, esDistancia, levantarEscudo } from "./armas.js";
import { INFINITO_CFG } from "./config.js";
import { elegirCombo, iniciarCombo, terminarCombo, TIRO } from "./combos.js";
import { apagarse } from "./cubetas.js";
import { ganar, niveles } from "./determinacion.js";
import { fase, puede } from "./fases.js";
import { alcance, distanciaA, enAlcance, golpear, listoParaGolpear, seCubre } from "./golpe.js";
import { armaDe, armaduraDe, nuevaPelea, observar, resumen, rival, ritmoDeAtaque } from "./memoria.js";
import {
  acorralado, buscarAltura, esquivar, mover, presionar, RAPIDEZ, reposicionar, retroceder, saltar, stap, wtap,
} from "./movimiento.js";
import { actitud, decir } from "./personalidad.js";
import { comer, lanzarPerla, lanzarPocion, tntCerca } from "./proyectiles.js";
import { limpiarDe } from "./rendimiento.js";

// CombatBrain: máquina de estados del Infinito.
//   IDLE → OBSERVING → APPROACHING → ENGAGING → COMBO → DEFENDING → COUNTERING
//   → RETREATING → RECOVERING → ADAPTING
// Prioridades (de mayor a menor): emergencias (TNT cerca, vida bajo su umbral) → ADAPTING
// (aprendió un patrón o lo contrarrestaron 3 veces seguidas) → DEFENDING (el rival va a
// golpear o disparar) → la lógica del estado actual. Cada estado dura al menos 8 ticks salvo
// las transiciones urgentes. Decide cada "reacción" ticks de su fase (30 en la 1, 4 en la
// 20); el golpe, el movimiento y los combos corren cada tick.

export const ESTADOS = ["IDLE", "OBSERVING", "APPROACHING", "ENGAGING", "COMBO", "DEFENDING", "COUNTERING", "RETREATING", "RECOVERING", "ADAPTING"];
const MIN_ESTADO = 8;

function alEntrar(e, s, estado) {
  const x = s.x;
  switch (estado) {
    case "OBSERVING":
      decir(e, s, "observar");
      break;
    case "DEFENDING":
      s.cd.defensa = now() + 40;
      if (!levantarEscudo(e, s, 16) && puede(s, "impredecible") && x?.obj) esquivar(e, s, x.obj);
      break;
    case "COUNTERING":
      s.contraHecho = false;
      break;
    case "ADAPTING": {
      const nuevo = x ? elegirEstilo(s, x.m, x.r) : undefined;
      if (nuevo) {
        s.estilo = nuevo;
        s.estiloDesde = now();
      }
      s.seguidasMal = 0;
      break;
    }
    case "RETREATING":
      s.atacar = false;
      break;
    case "ENGAGING":
      s.atacar = true;
      break;
    default:
      break;
  }
}

export function cambiarEstado(e, s, nuevo, urgente = false) {
  if (s.estado === nuevo) return true;
  if (!urgente && now() - s.estadoDesde < MIN_ESTADO) return false;
  if (s.estado === "COMBO" && s.combo) terminarCombo(e, s, false);
  if (s.estado === "DEFENDING" && nuevo !== "COUNTERING") bajarEscudo(e, s);
  s.estadoPrevio = s.estado;
  s.estado = nuevo;
  s.estadoDesde = now();
  s.transiciones = (s.transiciones ?? 0) + 1;
  alEntrar(e, s, nuevo);
  poseDeEstado(e, s);
  return true;
}

// --- Objetivo ------------------------------------------------------------------------------
function valido(x) {
  try {
    return !!x?.isValid && vida(x).actual > 0;
  } catch {
    return false;
  }
}

function iniciarCombate(s) {
  s.combate = { inicio: now(), ganado: 0, dados: 0, recibidos: 0, danoDado: 0, danoRecibido: 0, bajo: false, ultimoAguante: now() };
}

export function terminarCombate(e, s) {
  if (!s.combate) return;
  s.combate = undefined;
  s.memoriaGuardada = resumen(s);
  limpiarDe(s.id, "minecraft:cobblestone");
  bajarEscudo(e, s);
}

function nuevoObjetivo(e, s, obj) {
  s.objetivo = obj;
  s.objetivoDesde = now();
  if (!s.combate) iniciarCombate(s);
  nuevaPelea(rival(s, obj));
}

export function elegirObjetivo(e, s) {
  const actual = valido(s.objetivo) ? s.objetivo : undefined;
  let lista = [];
  try {
    lista = e.dimension.getPlayers({ location: e.location, maxDistance: actual ? INFINITO_CFG.persigue : INFINITO_CFG.vista,
      excludeGameModes: [GameMode.Creative, GameMode.Spectator] });
  } catch {
    lista = [];
  }
  // El que lo atacó desde lejos (flechas) también cuenta.
  if (valido(s.provocador) && now() - (s.provocadoEn ?? -1000) < 200 && !lista.some((p) => p.id === s.provocador.id)
    && distanciaA(e, s.provocador) <= INFINITO_CFG.persigue) lista.push(s.provocador);
  if (!lista.length && INFINITO_CFG.pve) {
    try {
      lista = e.dimension.getEntities({ location: e.location, maxDistance: 16, families: ["monster"], excludeFamilies: ["claudenpc"] });
    } catch {
      lista = [];
    }
  }
  lista = lista.filter(valido);
  if (!lista.length) {
    s.objetivo = undefined;
    return undefined;
  }
  if (actual && lista.some((p) => p.id === actual.id) && (!puede(s, "cambiarObjetivo") || now() - s.objetivoDesde < 60)) return actual;
  let mejor;
  let mejorP = -Infinity;
  // Puntos: cerca, el que más daño le hizo hace poco y (fase 4+) el que está por caer.
  for (const p of lista) {
    let pts = -distanciaA(e, p) * 0.6;
    const ag = s.aggro.get(p.id);
    if (ag && now() - ag.t < 200) pts += Math.min(10, ag.dano * 0.8);
    if (puede(s, "cambiarObjetivo")) {
      const v = vida(p);
      pts += (1 - v.actual / Math.max(1, v.max)) * 10 + (v.actual <= 6 ? 4 : 0);
    }
    if (actual && p.id === actual.id) pts += 4;
    if (p.typeId !== "minecraft:player") pts -= 6;
    if (pts > mejorP) {
      mejorP = pts;
      mejor = p;
    }
  }
  if (mejor && mejor.id !== actual?.id) nuevoObjetivo(e, s, mejor);
  return mejor;
}

// --- Lectura del rival -----------------------------------------------------------------------
// ¿Va a golpear? (cerca, mirándolo y con su ritmo de golpes, o acercándose rápido)
function vaAGolpear(e, obj, m, d) {
  if (d > 4.2) return false;
  try {
    const v = obj.getViewDirection();
    const dir = flat(obj.location, e.location);
    if (v.x * dir.x + v.z * dir.z < 0.8) return false;
    const arma = armaDe(obj);
    if (arma === "arco" || arma === "ballesta") return false;
    const ritmo = ritmoDeAtaque(m);
    if (Number.isFinite(ritmo)) return now() - (m.golpes.at(-1) ?? -1000) >= ritmo * 0.7;
    return m.acercamiento > 0.05 || d < 3.2;
  } catch {
    return false;
  }
}

// ¿Viene una flecha hacia él? (solo si el rival usa arco o ballesta)
function flechaViene(e, obj) {
  try {
    const arma = armaDe(obj);
    if (arma !== "arco" && arma !== "ballesta") return false;
    for (const f of e.dimension.getEntities({ type: "minecraft:arrow", location: e.location, maxDistance: 12 })) {
      const v = f.getVelocity();
      const rap = Math.hypot(v.x, v.y, v.z);
      if (rap < 0.6) continue;
      const dx = e.location.x - f.location.x;
      const dz = e.location.z - f.location.z;
      const l = Math.hypot(dx, dz) || 1;
      if ((v.x * dx + v.z * dz) / (l * Math.hypot(v.x, v.z) || 1) > 0.85) return true;
    }
  } catch {
    return false;
  }
  return false;
}

function contexto(e, s, obj, m, r, d, salud) {
  let rivalQuieto = false;
  let rivalEnAgua = false;
  try {
    const v = obj.getVelocity();
    rivalQuieto = Math.hypot(v.x, v.z) < 0.03;
    rivalEnAgua = obj.isInWater;
  } catch {
    // Sin datos.
  }
  let techoLibre = true;
  try {
    for (let h = 2; h <= 5 && techoLibre; h++) {
      const b = e.dimension.getBlock({ x: Math.floor(e.location.x), y: Math.floor(e.location.y) + h, z: Math.floor(e.location.z) });
      if (b && !b.isAir) techoLibre = false;
    }
  } catch {
    techoLibre = false;
  }
  const caida = !e.isOnGround ? Math.max(0, (s.alturaMax ?? e.location.y) - e.location.y) : 0;
  return {
    obj, m, r, d, salud, dy: e.location.y - obj.location.y, caida, rivalQuieto, rivalEnAgua, techoLibre,
    rivalCubre: seCubre(obj, e), rivalAtaca: vaAGolpear(e, obj, m, d), flecha: r.arquero ? flechaViene(e, obj) : false,
    anticipa: anticipar(s, m),
  };
}

function umbralRetirada(s) {
  if (puede(s, "infinito")) return 0; // la fase 20 nunca se retira: se cura peleando
  return Math.max(0.1, 0.2 - (s.fase - 4) * 0.006); // solo con muy poca vida
}

function puedeDefender(s) {
  return (s.escudo && now() >= (s.escudoRotoHasta ?? 0)) || puede(s, "impredecible");
}

function progresoCombate(e, s, obj, x) {
  const c = s.combate;
  if (!c) return;
  if (x.salud < 0.25) c.bajo = true;
  else if (c.bajo && x.salud > 0.5) {
    c.bajo = false;
    ganar(e, s, "remontada");
  }
  if (now() - (c.ultimoAguante ?? c.inicio) >= 200) {
    c.ultimoAguante = now();
    if (obj.typeId === "minecraft:player" && armaduraDe(obj) > Math.max(0, fase(s.fase).armadura)) ganar(e, s, "aguante");
  }
  if (puede(s, "multimodal") && !s.estilo) {
    s.estilo = elegirEstilo(s, x.m, x.r);
    s.estiloDesde = now();
  }
  if (puede(s, "estilos") && now() - (s.estiloDesde ?? 0) > 400) {
    const nuevo = elegirEstilo(s, x.m, x.r);
    s.estiloDesde = now();
    if (nuevo) s.estilo = nuevo;
  }
  // Esquiva que salió bien (nadie le pegó en los 10 ticks siguientes).
  if (s.esquivoEn && now() - s.esquivoEn >= 10) {
    if ((s.ultimoDano ?? -1000) < s.esquivoEn) ganar(e, s, "esquiva");
    s.esquivoEn = undefined;
  }
}

// --- Turno de decisión ----------------------------------------------------------------------
export function pensar(e, s) {
  const f = fase(s.fase);
  const obj = elegirObjetivo(e, s);
  actitud(e, s);
  if (!obj) return sinObjetivo(e, s);
  s.sinObjetivoDesde = undefined;
  const m = rival(s, obj);
  observar(m, e, obj);
  const r = rasgos(m, obj);
  const d = distanciaA(e, obj);
  const { actual, max } = vida(e);
  const x = contexto(e, s, obj, m, r, d, actual / Math.max(1, max));
  s.x = x;
  progresoCombate(e, s, obj, x);
  apagarse(e, s);

  // 1) Emergencias.
  if (!["COMBO", "RETREATING"].includes(s.estado) && tntCerca(e) && now() >= (s.tntHasta ?? 0)) {
    cambiarEstado(e, s, "RETREATING", true);
  } else if (puede(s, "retroceder") && x.salud < umbralRetirada(s) && !["RETREATING", "RECOVERING"].includes(s.estado)
    && now() >= (s.cd.retirada ?? 0)) {
    s.cd.retirada = now() + 600;
    cambiarEstado(e, s, "RETREATING", true);
    decir(e, s, "retirada");
  }
  // 2) Adaptación.
  if (!["COMBO", "RETREATING", "DEFENDING", "ADAPTING"].includes(s.estado)) {
    const nuevo = patronNuevo(s, m, r);
    if (nuevo) {
      ganar(e, s, "patron");
      s.ultimoPatron = nuevo;
      decir(e, s, "patron", true);
      cambiarEstado(e, s, "ADAPTING", true);
    } else if (puede(s, "adaptar") && (s.seguidasMal ?? 0) >= 3) {
      cambiarEstado(e, s, "ADAPTING", true);
    }
  }
  // 3) Defensa y aperturas.
  const enGuardia = ["APPROACHING", "ENGAGING", "COUNTERING", "OBSERVING"].includes(s.estado)
    || (s.estado === "COMBO" && !s.combo) || (s.interrumpido && now() - s.interrumpido < 6);
  const amenaza = x.rivalAtaca || x.flecha || x.anticipa === "atacar" || (x.anticipa === "disparar" && x.d > 5);
  if (enGuardia && amenaza && x.d < 3.8 && puedeDefender(s) && now() >= (s.cd.defensa ?? 0)
    && Math.random() < 0.15 + 0.45 * niveles(s).reaccion) {
    cambiarEstado(e, s, "DEFENDING", true);
  } else if (puede(s, "aperturas") && now() - (s.rompioEscudo ?? -1000) < 10 && s.estado !== "COMBO") {
    cambiarEstado(e, s, "COUNTERING", true); // le acaba de romper el escudo: castiga
  }

  switch (s.estado) {
    case "IDLE":
      cambiarEstado(e, s, f.observa > 0 ? "OBSERVING" : "APPROACHING", true);
      break;
    case "OBSERVING":
      return observando(e, s, x, f);
    case "APPROACHING":
      return acercandose(e, s, x);
    case "ENGAGING":
      return peleando(e, s, x);
    case "COMBO":
      if (!s.combo) cambiarEstado(e, s, "ENGAGING", true);
      break;
    case "DEFENDING":
      return defendiendo(e, s, x);
    case "COUNTERING":
      return contraatacando(e, s, x);
    case "RETREATING":
      return retirandose(e, s, x);
    case "RECOVERING":
      return recuperandose(e, s, x);
    case "ADAPTING":
      return adaptando(e, s, x);
    default:
      cambiarEstado(e, s, "IDLE", true);
  }
}

function sinObjetivo(e, s) {
  if (s.estado !== "IDLE") cambiarEstado(e, s, "IDLE", true);
  s.atacar = false;
  bajarEscudo(e, s);
  if (s.mov?.modo !== "quieto") mover(s, "quieto", {});
  if (s.combate) {
    s.sinObjetivoDesde ??= now();
    if (now() - s.sinObjetivoDesde > 200) terminarCombate(e, s);
  }
}

function observando(e, s, x, f) {
  const t = now() - s.estadoDesde;
  // Te estudia un momento (como mucho 1,2 s) dando vueltas a tu alrededor, sin alejarse.
  if (t >= Math.min(f.observa, 24) || x.d < 4 || now() - (s.ultimoDano ?? -1000) < 20) {
    cambiarEstado(e, s, "APPROACHING", true);
    return acercandose(e, s, x);
  }
  presionar(s, x.obj, { ideal: 5, rapidezLado: RAPIDEZ.lado * 0.7 });
}

function intentarCombo(e, s, x, prob) {
  if (!puede(s, "comboSimple") || now() < (s.cd.combo ?? 0) || Math.random() >= prob) return false;
  const c = elegirCombo(e, s, x);
  if (!c || !iniciarCombo(e, s, c, x.obj)) return false;
  s.atacar = false;
  return cambiarEstado(e, s, "COMBO", true);
}

function acercandose(e, s, x) {
  decidirArma(e, s, x);
  if (esDistancia(s.arma)) {
    if (x.d >= 5 && x.d <= 22) return cambiarEstado(e, s, "ENGAGING");
    presionar(s, x.obj);
    return;
  }
  if (x.d <= alcance(s) + 0.6) return cambiarEstado(e, s, "ENGAGING");
  if (intentarCombo(e, s, x, 0.25 + 0.5 * niveles(s).combos)) return;
  const zigzag = puede(s, "impredecible") && (x.r.arquero || esDistancia(armaDe(x.obj)));
  presionar(s, x.obj, { zigzag });
}

function peleando(e, s, x) {
  decidirArma(e, s, x);
  const n = niveles(s);
  if (esDistancia(s.arma)) {
    if (x.d > 26) return cambiarEstado(e, s, "APPROACHING");
    // Mientras dispara se mueve de lado y se va acercando; tras dos tiros vuelve a la carga.
    presionar(s, x.obj, { ideal: Math.max(6, x.d - 1), rapidezLado: RAPIDEZ.lado * 0.7 });
    if ((s.tiros ?? 0) >= 2) {
      s.tiros = 0;
      s.cd.arco = now() + 140;
      equipar(e, s, "espada");
      return cambiarEstado(e, s, "APPROACHING", true);
    }
    if (now() >= (s.cd.tiro ?? 0) && iniciarCombo(e, s, TIRO, x.obj)) {
      s.cd.tiro = now() + 16;
      s.tiros = (s.tiros ?? 0) + 1;
      s.atacar = false;
      cambiarEstado(e, s, "COMBO", true);
    }
    return;
  }
  if (x.d > alcance(s) + 3) return cambiarEstado(e, s, "APPROACHING");
  if (intentarCombo(e, s, x, 0.2 + 0.55 * n.combos)) return;
  // Come en medio de la pelea si va bajo y el rival no está encima (la fase 20 también).
  if (x.salud < 0.45 && x.d > 3.8 && comer(e, s)) return;
  if (puede(s, "altura") && Math.random() < 0.05 && buscarAltura(e, s, x.obj)) return;
  if (puede(s, "terreno") && Math.random() < 0.4 && acorralado(e, x.obj)) {
    reposicionar(e, s, x.obj);
    return;
  }
  movimientoCuerpo(e, s, x);
  s.atacar = true;
}

function movimientoCuerpo(e, s, x) {
  // Llega saltando para caer golpeando (crítico): fase 2+ (y el NOOB a veces, por torpe).
  const salta = puede(s, "saltarAntes") ? 0.35 : 0.12;
  if (e.isOnGround && x.d > 2.3 && x.d < 3.9 && s.proximoGolpe - now() < 10 && Math.random() < salta) {
    saltar(e, s, x.obj, 0.42, 0.22);
  }
  // Nunca se queda quieto ni retrocede para guardar distancia: te rodea y vuelve a entrar.
  presionar(s, x.obj);
}

function defendiendo(e, s, x) {
  const t = now() - s.estadoDesde;
  if (now() - (s.bloqueoEn ?? -1000) < 10 && puede(s, "castigar")) return cambiarEstado(e, s, "COUNTERING", true);
  if (t > 12 || (!x.rivalAtaca && !x.flecha && t > 6)) {
    bajarEscudo(e, s);
    return cambiarEstado(e, s, "ENGAGING", true);
  }
  // Con el escudo arriba va lento, pero sigue moviéndose a tu alrededor.
  presionar(s, x.obj);
}

function contraatacando(e, s, x) {
  bajarEscudo(e, s);
  if (!s.contraHecho) {
    s.contraHecho = true;
    if (puede(s, "contraCombos")) {
      const c = elegirCombo(e, s, { ...x, rivalAtaca: true, anticipa: "atacar" });
      if (c?.etiquetas.includes("contra") && iniciarCombo(e, s, c, x.obj)) return cambiarEstado(e, s, "COMBO", true);
    }
    // El rival acaba de gastar su golpe (o su escudo): el castigo sale ya.
    s.proximoGolpe = Math.min(s.proximoGolpe, now());
  }
  s.atacar = true;
  presionar(s, x.obj, { ideal: 1.8 });
  if (now() - s.estadoDesde > 14 || now() - s.ultimoGolpe < 3) cambiarEstado(e, s, "ENGAGING", true);
}

function retirandose(e, s, x) {
  const t = now() - s.estadoDesde;
  if (x.d >= 8 || t > 120) return cambiarEstado(e, s, x.d >= 8 ? "RECOVERING" : "ENGAGING", true);
  if (puede(s, "escapar") && x.d < 5 && x.salud < 0.3 && now() >= (s.cd.perlaEscape ?? 0)) {
    s.cd.perlaEscape = now() + 300;
    const d = flat(x.obj.location, e.location);
    if (lanzarPerla(e, s, { x: e.location.x + d.x * 14, y: e.location.y, z: e.location.z + d.z * 14 })) return;
  }
  if (x.rivalAtaca && Math.random() < 0.5) levantarEscudo(e, s, 8);
  retroceder(s, x.obj, 10);
  s.mov.saltos = true;
}

function recuperandose(e, s, x) {
  const t = now() - s.estadoDesde;
  if (x.salud >= 0.5 || x.d < 5 || t > 120) return cambiarEstado(e, s, "APPROACHING", true);
  if (x.d < 7) retroceder(s, x.obj, 9);
  else presionar(s, x.obj, { ideal: 8, rapidezLado: RAPIDEZ.lado * 0.6 });
  if (s.comiendo) return;
  if (puede(s, "pociones") && now() >= (s.cd.pocionCura ?? 0)) {
    s.cd.pocionCura = now() + 300;
    lanzarPocion(e, s, "curacion");
  } else {
    comer(e, s);
  }
}

function adaptando(e, s, x) {
  if (now() - s.estadoDesde >= 10) return cambiarEstado(e, s, "APPROACHING", true);
  presionar(s, x.obj, { ideal: 3.2 });
}

// --- Cada tick: golpe cuerpo a cuerpo, escudo y volver al arma ------------------------------
function tipoGolpe(s) {
  if (s.estilo === "1.8") return "rapido";
  if (s.estilo === "1.9" || s.arma === "hacha") return "pesado";
  return "normal";
}

function despuesDelGolpe(e, s, obj, r) {
  if (!r.ok && !r.bloqueado) return;
  const x = s.x;
  if (puede(s, "wtap") && (s.estilo === "1.8" || !x?.r?.agresivo) && Math.random() < 0.6) return wtap(e, s, obj);
  if (puede(s, "stap") && (x?.r?.agresivo || x?.rivalAtaca) && Math.random() < 0.6) return stap(e, s, obj);
  if (puede(s, "intercambios") && Math.random() < 0.3) return stap(e, s, obj);
  return undefined;
}

export function tickPelea(e, s) {
  if (s.escudoArriba && now() >= s.escudoHasta) bajarEscudo(e, s);
  if (s.volverArma && now() >= s.volverArma && !s.combo && !s.comiendo) {
    s.volverArma = undefined;
    equipar(e, s, s.armaPrincipal ?? "espada", { urgente: true });
  }
  const obj = s.objetivo;
  if (!obj?.isValid || !s.atacar || (s.estado !== "ENGAGING" && s.estado !== "COUNTERING")) return;
  if (esDistancia(s.arma) || s.escudoArriba || s.comiendo) return;
  if (!listoParaGolpear(s) || !enAlcance(e, s, obj)) return;
  // Fase 16+: rompe su propio ritmo de vez en cuando para que no lo lean.
  if (puede(s, "ritmo") && Math.random() < 0.12) {
    s.proximoGolpe = now() + 3 + Math.floor(Math.random() * 5);
    return;
  }
  despuesDelGolpe(e, s, obj, golpear(e, s, obj, { tipo: tipoGolpe(s) }));
}

// Ganó el combate contra "muerto".
export function victoria(e, s, muerto) {
  const jugador = muerto.typeId === "minecraft:player";
  ganar(e, s, jugador ? "victoria" : "monstruo", jugador ? 1 + s.fase / 10 : 1);
  if (s.objetivo?.id === muerto.id) s.objetivo = undefined;
  if (jugador) {
    decir(e, s, "victoria", true);
    gesto(e, s, "victoria", true);
  }
}
