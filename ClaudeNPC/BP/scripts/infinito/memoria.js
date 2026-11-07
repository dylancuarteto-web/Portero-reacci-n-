import { EquipmentSlot } from "@minecraft/server";
import { now } from "../util.js";

// MemorySystem: lo que recuerda de cada rival (jugador o mob). Memoria LIMITADA: 6 rivales a
// la vez, 24 acciones por rival, 60 secuencias, y todo se va olvidando con el tiempo.
//   - saltos, distancia, escudo, corre, acercamiento: promedios que se actualizan al observar;
//   - escapes: cuántas veces se fue corriendo;
//   - armas: con qué lo ataca;
//   - secuencia y ngramas: qué hace después de qué (para detectar combinaciones repetidas);
//   - estrategias: qué combos le funcionaron o fallaron contra ese rival;
//   - contrarrestados: combos que ese rival le contrarrestó en esta pelea.

const MAX_RIVALES = 6;
const MAX_SECUENCIA = 24;
const MAX_NGRAMAS = 60;
const k = 0.12; // peso de cada observación en los promedios

function categoria(id) {
  if (!id) return "mano";
  if (id.endsWith("_sword")) return "espada";
  if (id.endsWith("_axe")) return "hacha";
  if (id === "minecraft:bow") return "arco";
  if (id === "minecraft:crossbow") return "ballesta";
  if (id === "minecraft:trident") return "tridente";
  if (id === "minecraft:mace") return "maza";
  if (id === "minecraft:shield") return "escudo";
  return "otra";
}

export function armaDe(ent) {
  try {
    const eq = ent.getComponent("minecraft:equippable");
    return categoria(eq?.getEquipment(EquipmentSlot.Mainhand)?.typeId);
  } catch {
    return "mano";
  }
}

export function tieneEscudo(ent) {
  try {
    const eq = ent.getComponent("minecraft:equippable");
    return [EquipmentSlot.Offhand, EquipmentSlot.Mainhand].some((s) => eq?.getEquipment(s)?.typeId === "minecraft:shield");
  } catch {
    return false;
  }
}

// Nivel de armadura del rival (0 sin nada … 4 netherita) mirando el peto.
export function armaduraDe(ent) {
  try {
    const id = ent.getComponent("minecraft:equippable")?.getEquipment(EquipmentSlot.Chest)?.typeId ?? "";
    return id.includes("netherite") ? 4 : id.includes("diamond") ? 3 : id.includes("iron") ? 2 : id.includes("chain") ? 1.5 : id ? 1 : 0;
  } catch {
    return 0;
  }
}

function nuevo(ent) {
  let nombre = "";
  try {
    nombre = ent.typeId === "minecraft:player" ? ent.name : ent.typeId;
  } catch {
    nombre = "";
  }
  return {
    id: ent.id, nombre, visto: now(), muestras: 0, saltos: 0, distancia: 4, escudo: 0, corre: 0, acercamiento: 0,
    escapes: 0, ultimoEscape: -1000, armas: {}, golpes: [], secuencia: [], ngramas: {}, estrategias: {},
    contrarrestados: {}, patrones: [], armadura: 0, enAire: false, ultimaDist: undefined, ultimoSalto: -1000,
  };
}

export function rival(s, ent) {
  let m = s.memoria.get(ent.id);
  if (!m) {
    if (s.memoria.size >= MAX_RIVALES) {
      // Olvida al que hace más tiempo que no ve.
      let viejo;
      for (const [id, x] of s.memoria) if (!viejo || x.visto < s.memoria.get(viejo).visto) viejo = id;
      if (viejo) s.memoria.delete(viejo);
    }
    m = nuevo(ent);
    // Si ya lo conocía de antes (guardado por nombre), recupera lo que aprendió.
    const previo = s.memoriaGuardada?.[m.nombre];
    if (previo) Object.assign(m, { saltos: previo.saltos ?? 0, escudo: previo.escudo ?? 0, escapes: previo.escapes ?? 0,
      estrategias: previo.estrategias ?? {}, patrones: previo.patrones ?? [], muestras: Math.min(200, previo.muestras ?? 0) });
    s.memoria.set(ent.id, m);
  }
  m.visto = now();
  return m;
}

export function anotar(m, accion) {
  const sec = m.secuencia;
  sec.push(accion);
  if (sec.length > MAX_SECUENCIA) sec.shift();
  if (sec.length >= 3) {
    const clave = sec.slice(-3).join("|");
    m.ngramas[clave] = (m.ngramas[clave] ?? 0) + 1;
    const claves = Object.keys(m.ngramas);
    if (claves.length > MAX_NGRAMAS) {
      claves.sort((a, b) => m.ngramas[a] - m.ngramas[b]);
      for (const c of claves.slice(0, claves.length - MAX_NGRAMAS)) delete m.ngramas[c];
    }
  }
}

// Observa al rival en este turno (lo llama el cerebro).
export function observar(m, yo, ent) {
  try {
    const d = Math.hypot(ent.location.x - yo.location.x, ent.location.z - yo.location.z);
    // En el aire (sin contar agua ni escaleras): quien salta todo el tiempo pasa ahí más de
    // la mitad del tiempo; quien camina, casi nunca.
    const enAire = !ent.isOnGround && !ent.isInWater && !ent.isClimbing;
    const salta = !!ent.isJumping || enAire;
    if (salta && !m.enAire && now() - m.ultimoSalto > 6) {
      m.ultimoSalto = now();
      anotar(m, "salto");
    }
    m.enAire = enAire;
    const cubre = !!ent.isSneaking && tieneEscudo(ent);
    const corre = !!ent.isSprinting;
    const acerca = m.ultimaDist !== undefined ? m.ultimaDist - d : 0;
    m.saltos += k * ((salta ? 1 : 0) - m.saltos);
    m.escudo += k * ((cubre ? 1 : 0) - m.escudo);
    m.corre += k * ((corre ? 1 : 0) - m.corre);
    m.distancia += k * (d - m.distancia);
    m.acercamiento += k * (acerca - m.acercamiento);
    if (cubre && (m.secuencia.at(-1) !== "escudo")) anotar(m, "escudo");
    // Se escapa: se aleja corriendo y ya está lejos.
    if (acerca < -0.25 && corre && d > 7 && now() - m.ultimoEscape > 80) {
      m.escapes++;
      m.ultimoEscape = now();
      anotar(m, "escapa");
    } else if (acerca > 0.25 && d < 8 && m.secuencia.at(-1) !== "acerca") {
      anotar(m, "acerca");
    }
    m.ultimaDist = d;
    m.armadura = armaduraDe(ent);
    m.muestras++;
  } catch {
    // Rival descargado.
  }
}

// El rival lo golpeó (melee o flecha).
export function golpeDelRival(m, ent, flecha) {
  const cat = flecha ? "flecha" : armaDe(ent);
  m.armas[cat] = (m.armas[cat] ?? 0) + 1;
  m.golpes.push(now());
  if (m.golpes.length > 12) m.golpes.shift();
  anotar(m, flecha ? "flecha" : `golpe_${cat}`);
}

// ¿Qué hará después? (según lo que hizo las últimas dos veces). Devuelve { accion, confianza }.
export function predecir(m) {
  const sec = m.secuencia;
  if (sec.length < 2) return undefined;
  const pre = `${sec.at(-2)}|${sec.at(-1)}|`;
  let mejor;
  let total = 0;
  for (const [clave, n] of Object.entries(m.ngramas)) {
    if (!clave.startsWith(pre)) continue;
    total += n;
    if (!mejor || n > mejor.n) mejor = { accion: clave.slice(pre.length), n };
  }
  if (!mejor || total < 2) return undefined;
  return { accion: mejor.accion, confianza: mejor.n / total, veces: mejor.n };
}

// La combinación que más repite (para "detectar si usa siempre la misma").
export function combinacionRepetida(m) {
  let mejor;
  for (const [clave, n] of Object.entries(m.ngramas)) if (!mejor || n > mejor.n) mejor = { clave, n };
  return mejor && mejor.n >= 3 ? mejor : undefined;
}

// Ritmo de ataque del rival: ticks promedio entre sus golpes (Infinity si casi no golpea).
export function ritmoDeAtaque(m) {
  const g = m.golpes.filter((t) => now() - t < 200);
  if (g.length < 2) return Infinity;
  return (g.at(-1) - g[0]) / (g.length - 1);
}

export function resultado(m, comboId, ok) {
  const e = (m.estrategias[comboId] ??= { ok: 0, mal: 0 });
  if (ok) e.ok++;
  else {
    e.mal++;
    m.contrarrestados[comboId] = (m.contrarrestados[comboId] ?? 0) + 1;
  }
}

// Se va olvidando (cada 10 s): las secuencias pierden peso.
export function olvidar(s) {
  for (const [id, m] of s.memoria) {
    if (now() - m.visto > 6000) {
      s.memoria.delete(id);
      continue;
    }
    for (const c of Object.keys(m.ngramas)) {
      m.ngramas[c] *= 0.9;
      if (m.ngramas[c] < 0.5) delete m.ngramas[c];
    }
  }
}

// Lo que se guarda (por nombre del rival) para recordarlo después de cerrar el mundo.
export function resumen(s) {
  const out = { ...(s.memoriaGuardada ?? {}) };
  for (const m of s.memoria.values()) {
    if (!m.nombre) continue;
    out[m.nombre] = { saltos: +m.saltos.toFixed(2), escudo: +m.escudo.toFixed(2), escapes: m.escapes, muestras: m.muestras,
      estrategias: m.estrategias, patrones: m.patrones.slice(0, 8) };
  }
  const nombres = Object.keys(out);
  while (nombres.length > 12) delete out[nombres.shift()];
  return out;
}

// Al empezar otra pelea: se reinician los "contrarrestados" de esta pelea.
export function nuevaPelea(m) {
  m.contrarrestados = {};
}
