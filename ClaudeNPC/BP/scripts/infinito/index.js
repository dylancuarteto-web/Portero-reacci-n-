import { system, world } from "@minecraft/server";
import { DIMENSIONES } from "../config.js";
import { alSensor, etiqueta, EVENTO, ponerVida, TAG, vida } from "../dano.js";
import { flat, now, sound } from "../util.js";
import { gesto, pose } from "./animacion.js";
import { ARMAS, bajarEscudo, equipar, escudoMano, tier, vestirFase } from "./armas.js";
import { cambiarEstado, pensar, tickPelea, victoria } from "./cerebro.js";
import { iniciarCinematica, tickCinematica } from "./cinematica.js";
import { COMBOS, tickCombo } from "./combos.js";
import { INFINITO, INFINITO_CFG, NOMBRE_INFINITO, PROP_SELLADOS, TAG_INF } from "./config.js";
import { tickCaida } from "./cubetas.js";
import { alEvolucionar, ganar, niveles, ponerDeterminacion, ponerFase } from "./determinacion.js";
import { fase, puede, tramo } from "./fases.js";
import { armaDe, golpeDelRival, olvidar, rival } from "./memoria.js";
import { jumpReset, moverTick } from "./movimiento.js";
import { actualizarNombre, decir } from "./personalidad.js";
import { cargar, guardar, infinitos, nuevoEstado } from "./registro.js";
import { cuantosTemporales, errores, limpiarDe, registrarError, repartirTurnos } from "./rendimiento.js";
import { derribar, tickCargado, tickEtapa } from "./rescate.js";
import { vfxEvolucion } from "./vfx.js";

// Claude Exponencial Infinito (INFINITE DETERMINATION): registro, bucles, eventos y guardado.
// Ver docs/FEATURE_SPEC_INFINITO.md. Módulos: fases (PhaseManager), determinacion
// (DeterminationSystem), memoria (MemorySystem), adaptacion (AdaptationEngine), armas
// (WeaponManager), golpe, movimiento (MovementController), cubetas (BucketController),
// proyectiles (ProjectileController), combos (ComboEngine), cerebro (CombatBrain), animacion
// (AnimationController), vfx (VFXController), rendimiento (PerformanceManager), personalidad,
// rescate (derribo, rescate y sello) y registro (estado y guardado).

const TAG_SELLADO = "claudenpc_sellado";

// --- Aspecto según la fase ---------------------------------------------------------------
function aplicarAspecto(e, s) {
  const t = tramo(s.fase);
  if (t !== s.tramo) {
    try {
      e.triggerEvent(`claudenpc:nivel_${t}`);
    } catch {
      // Paquete de comportamiento antiguo.
    }
    s.tramo = t;
  }
  const a = s.fase >= 20 ? 1 : 0;
  if (a !== s.aura) {
    try {
      e.triggerEvent(`claudenpc:aura_${a}`);
    } catch {
      // Sin aura.
    }
    s.aura = a;
  }
  vestirFase(e, s);
  escudoMano(e, s);
  const cat = s.arma ?? "espada";
  if (ARMAS[cat]?.item(tier(s), s) !== s.item) equipar(e, s, cat, { forzar: true, urgente: true });
}

export function registrar(e) {
  if (infinitos.has(e.id)) return infinitos.get(e.id);
  try {
    if (e.hasTag(TAG_SELLADO)) return undefined;
  } catch {
    return undefined;
  }
  const s = nuevoEstado(e);
  cargar(e, s);
  infinitos.set(e.id, s);
  try {
    s.tramo = e.getComponent("minecraft:variant")?.value ?? -1;
    s.aura = e.getComponent("minecraft:mark_variant")?.value ?? -1;
  } catch {
    // Sin componentes todavía.
  }
  aplicarAspecto(e, s);
  if (s.etapa === "derribado") pose(e, s, "derrota");
  else if (s.etapa === "recuperando") pose(e, s, "recuperar");
  actualizarNombre(e, s, true);
  return s;
}

// --- Evolución: cada fase tiene su presentación -------------------------------------------
function presentar(e, s, anterior) {
  const f = fase(s.fase);
  const t = tramo(s.fase);
  const cambioTramo = tramo(anterior) !== t;
  s.presentacionHasta = now() + 24;
  gesto(e, s, "evolucion", true);
  vfxEvolucion(e, s, t);
  const colores = ["§f", "§e", "§6", "§c", "§4"];
  const titulo = s.fase >= 20 ? "§4§lINFINITE DETERMINATION" : `${colores[t]}§lFASE ${s.fase}`;
  const sub = s.fase >= 20 ? `§c${NOMBRE_INFINITO} alcanzó la determinación infinita` : `§f${f.nombre}`;
  try {
    for (const p of e.dimension.getPlayers({ location: e.location, maxDistance: 40 })) {
      p.onScreenDisplay.setTitle(titulo, { subtitle: sub, fadeInDuration: 5, stayDuration: 30, fadeOutDuration: 12 });
    }
  } catch {
    // Sin jugadores.
  }
  sound(e, "random.levelup", 0.7 + s.fase * 0.03, 1);
  if (cambioTramo) sound(e, "beacon.power", 0.8 + t * 0.1, 1);
  if (s.fase >= 20) sound(e, "mob.wither.spawn", 1.4, 0.5);
  decir(e, s, "evolucion", true);
}

alEvolucionar((e, s, anterior) => {
  aplicarAspecto(e, s);
  actualizarNombre(e, s, true);
  if (s.fase > anterior && s.etapa === "pelea") {
    // Al llegar a la fase 20: la cinemática (si hay jugadores cerca); si no, la presentación.
    if (!(s.fase >= 20 && anterior < 20 && iniciarCinematica(e, s))) presentar(e, s, anterior);
  }
  guardar(s);
});

// --- Etiquetas que leen los sensores de daño (cada tick, solo si cambian) ------------------
function frente(e, q) {
  try {
    const v = e.getViewDirection();
    const d = flat(e.location, q.location);
    return v.x * d.x + v.z * d.z;
  } catch {
    return -1;
  }
}

function sincronizarEtiquetas(e, s) {
  const t = now();
  etiqueta(e, TAG.intocable, s.etapa !== "pelea" || t < s.presentacionHasta);
  etiqueta(e, TAG.sinCaida, t < (s.sinCaidaHasta ?? 0) || s.etapa === "cargado");
  etiqueta(e, TAG_INF.antiexplosion, s.fase >= 13);
  let cono = -1;
  if (s.escudoArriba) cono = s.objetivo?.isValid ? frente(e, s.objetivo) : 1;
  etiqueta(e, TAG.escudo, s.escudoArriba && cono > 0.3);
  etiqueta(e, TAG.escudoFlechas, s.escudoArriba && cono > -0.15);
}

// --- Bucles -------------------------------------------------------------------------------
function tick(e, s) {
  sincronizarEtiquetas(e, s);
  if (s.cine) return tickCinematica(e, s);
  if (s.etapa === "cargado") return tickCargado(e, s);
  if (s.etapa !== "pelea") return;
  if (e.isOnGround && now() % 20 === 0) s.ultimoSuelo = { ...e.location };
  tickCaida(e, s);
  if (s.combo) tickCombo(e, s);
  else if (s.estado === "COMBO") {
    cambiarEstado(e, s, "ENGAGING", true);
    s.proximaDecision = now();
  }
  tickPelea(e, s);
  moverTick(e, s);
}

system.runInterval(() => {
  for (const s of infinitos.values()) {
    const e = s.e;
    if (!e?.isValid) continue;
    try {
      tick(e, s);
    } catch (err) {
      registrarError("tick", err);
    }
  }
}, 1);

// Decisiones: cada "reacción" ticks de su fase (40 sin nadie cerca), repartidas entre ticks.
system.runInterval(() => {
  if (!infinitos.size) return;
  const lista = [];
  for (const s of infinitos.values()) if (s.e?.isValid && s.etapa === "pelea" && now() >= s.presentacionHasta) lista.push(s);
  for (const s of repartirTurnos(lista, INFINITO_CFG.maxPensandoPorTick)) {
    try {
      pensar(s.e, s);
    } catch (err) {
      registrarError("cerebro", err);
    }
    s.decisiones = (s.decisiones ?? 0) + 1;
    s.proximaDecision = now() + (s.objetivo ? fase(s.fase).reaccion : 40);
  }
}, 1);

// Etapas (derribado, recuperándose), nombre y curación fuera de combate.
system.runInterval(() => {
  for (const s of infinitos.values()) {
    const e = s.e;
    if (!e?.isValid) continue;
    try {
      if (s.etapa !== "pelea") tickEtapa(e, s);
      else if (!s.combate && now() - (s.ultimoDano ?? -1000) > 200 && now() % 40 < 10) {
        const v = vida(e);
        if (v.actual < v.max) ponerVida(e, v.actual + 1);
      }
      if (s.etapa !== "sellado") actualizarNombre(e, s);
    } catch (err) {
      registrarError("etapas", err);
    }
  }
}, 10);

// Guardado y olvido (cada 10 s).
system.runInterval(() => {
  for (const s of infinitos.values()) {
    if (!s.e?.isValid) continue;
    try {
      olvidar(s);
      guardar(s);
    } catch (err) {
      registrarError("guardar", err);
    }
  }
}, 200);

// Recupera los Infinitos al cargar el mundo o un chunk; olvida los que ya no están.
system.runInterval(() => {
  for (const id of DIMENSIONES) {
    try {
      for (const e of world.getDimension(id).getEntities({ type: INFINITO })) registrar(e);
    } catch {
      // Dimensión sin cargar.
    }
  }
  for (const [id, s] of infinitos) if (!s.e?.isValid) infinitos.delete(id);
}, 100);

world.afterEvents.entitySpawn.subscribe(({ entity }) => {
  if (entity.typeId === INFINITO) system.run(() => entity.isValid && registrar(entity));
});

world.afterEvents.entityRemove.subscribe(({ removedEntityId }) => infinitos.delete(removedEntityId));

// --- Golpes que recibe ----------------------------------------------------------------------
world.afterEvents.entityHurt.subscribe(({ hurtEntity, damageSource, damage }) => {
  const s = infinitos.get(hurtEntity.id);
  if (!s) return;
  const e = hurtEntity;
  s.ultimoDano = now();
  // Cada golpe que recibe le da determinación (proporcional al daño).
  if (damage > 0 && s.etapa === "pelea") ganar(e, s, "herido", damage);
  if (s.combate) {
    s.combate.recibidos++;
    s.combate.danoRecibido += damage;
  }
  if (s.combo) s.combo.golpeado = true;
  const atacante = damageSource.damagingEntity;
  if (atacante?.isValid && atacante.id !== e.id) {
    const ag = s.aggro.get(atacante.id) ?? { dano: 0, t: 0 };
    ag.dano = (now() - ag.t < 200 ? ag.dano : 0) + damage;
    ag.t = now();
    s.aggro.set(atacante.id, ag);
    if (s.aggro.size > 12) s.aggro.delete(s.aggro.keys().next().value);
    s.provocador = atacante;
    s.provocadoEn = now();
    const flecha = !!damageSource.damagingProjectile;
    try {
      golpeDelRival(rival(s, atacante), atacante, flecha);
    } catch {
      // Sin memoria.
    }
    // Jump reset (fase 9+): salta al recibir el golpe y pierde parte del empuje.
    if (!flecha && puede(s, "jumpReset") && Math.random() < 0.3 + 0.6 * niveles(s).reaccion) jumpReset(e);
    // Un hacha le desactiva el escudo 5 s (como a un jugador).
    if (s.escudoArriba && armaDe(atacante) === "hacha") {
      bajarEscudo(e, s);
      s.escudoRotoHasta = now() + 100;
      sound(e, "random.break", 0.9, 0.8);
    }
  }
  if (s.estado === "OBSERVING") cambiarEstado(e, s, "APPROACHING", true);
}, { entityTypes: [INFINITO] });

// El escudo paró un golpe o una flecha (sensor de daño).
alSensor(EVENTO.bloqueo, [INFINITO], (e, golpe) => {
  const s = infinitos.get(e.id);
  if (!s) return;
  s.bloqueoEn = now();
  sound(e, "item.shield.block", 0.9 + Math.random() * 0.2, 1);
  ganar(e, s, "bloqueo");
  decir(e, s, "bloqueo");
  const q = golpe?.quien;
  if (q?.isValid && q.id !== e.id) {
    try {
      golpeDelRival(rival(s, q), q, !!golpe.proyectil);
      if (!golpe.proyectil) {
        const d = flat(e.location, q.location);
        q.applyKnockback({ x: d.x * 0.3, z: d.z * 0.3 }, 0.1);
      }
    } catch {
      // Sin datos del atacante.
    }
  }
  if (puede(s, "castigar") && s.estado === "DEFENDING") cambiarEstado(e, s, "COUNTERING", true);
});

// El golpe que lo mataría: queda derribado (no muere).
alSensor(EVENTO.fatal, [INFINITO], (e) => {
  const s = infinitos.get(e.id) ?? registrar(e);
  if (s) derribar(e, s);
});

// Victorias.
// Si aun así muere de verdad (lava, vacío, algo que el sensor no paró), no se pierde:
// aparece derribado en el mismo lugar con todo lo que sabía y un Claude se lo lleva.
// Excepciones: sellado, o quitado a propósito con /kill (causa "override"/"selfDestruct").
function revivir(muerto, s) {
  let dim;
  let lugar;
  try {
    dim = muerto.dimension;
    lugar = { ...muerto.location };
  } catch {
    return;
  }
  if (s.ultimoSuelo && (lugar.y < dim.heightRange.min + 4 || Math.abs(lugar.y - s.ultimoSuelo.y) > 30)) lugar = { ...s.ultimoSuelo };
  let nuevo;
  try {
    nuevo = dim.spawnEntity(INFINITO, lugar);
  } catch {
    return;
  }
  // El estado (en memoria) se guarda en la entidad nueva y se vuelve a cargar.
  s.e = nuevo;
  s.etapa = "pelea";
  guardar(s);
  const s2 = registrar(nuevo);
  if (s2) derribar(nuevo, s2);
}

world.afterEvents.entityDie.subscribe(({ deadEntity, damageSource }) => {
  try {
    if (deadEntity.typeId === INFINITO) {
      const s = infinitos.get(deadEntity.id);
      limpiarDe(deadEntity.id);
      infinitos.delete(deadEntity.id);
      const causa = String(damageSource?.cause ?? "");
      if (s && s.etapa !== "sellado" && !deadEntity.hasTag(TAG_SELLADO) && causa !== "override" && causa !== "selfDestruct") revivir(deadEntity, s);
      return;
    }
    const killer = damageSource?.damagingEntity;
    let s = killer?.typeId === INFINITO ? infinitos.get(killer.id) : undefined;
    if (!s) {
      for (const x of infinitos.values()) {
        if (x.objetivo?.id === deadEntity.id && now() - x.ultimoGolpe < 100) {
          s = x;
          break;
        }
      }
    }
    if (s?.e?.isValid && s.etapa === "pelea") victoria(s.e, s, deadEntity);
  } catch {
    // Sin datos.
  }
});

// --- Para los comandos --------------------------------------------------------------------
export function infinitoCercano(p, radio = 32) {
  try {
    const [e] = p.dimension.getEntities({ type: INFINITO, location: p.location, maxDistance: radio, closest: 1 });
    return e ? registrar(e) : undefined;
  } catch {
    return undefined;
  }
}

export function generarInfinito(p, n) {
  try {
    const v = p.getViewDirection();
    const e = p.dimension.spawnEntity(INFINITO, { x: p.location.x + v.x * 3, y: p.location.y, z: p.location.z + v.z * 3 });
    const s = registrar(e);
    if (!s) return "§cNo se pudo registrar.";
    if (n !== undefined && Number.isFinite(n)) ponerFase(e, s, n);
    return `§c${NOMBRE_INFINITO} §7llegó en la fase ${s.fase} (${fase(s.fase).nombre}).`;
  } catch {
    return "§cNo se pudo generar aquí.";
  }
}

export function comandoFase(p, n) {
  const s = infinitoCercano(p);
  if (!s) return `§cNo hay ningún ${NOMBRE_INFINITO} a 32 bloques.`;
  ponerFase(s.e, s, n);
  return `§aFase ${s.fase}: ${fase(s.fase).nombre} (determinación ${Math.floor(s.determinacion)}).`;
}

export function comandoDeterminacion(p, valor) {
  const s = infinitoCercano(p);
  if (!s) return `§cNo hay ningún ${NOMBRE_INFINITO} a 32 bloques.`;
  ponerDeterminacion(s.e, s, valor);
  return `§aDeterminación ${Math.floor(s.determinacion)}: fase ${s.fase} (${fase(s.fase).nombre}).`;
}

export function comandoInfo(p) {
  const s = infinitoCercano(p);
  if (!s) return `§cNo hay ningún ${NOMBRE_INFINITO} a 32 bloques.`;
  const n = niveles(s);
  const pct = (x) => `${Math.round(x * 100)}%`;
  const mejores = [];
  for (const m of s.memoria.values()) {
    for (const [id, e] of Object.entries(m.estrategias)) mejores.push(`${id} ${e.ok}/${e.mal}`);
  }
  const errs = errores();
  return [
    `§c${NOMBRE_INFINITO} §7— fase §f${s.fase} ${fase(s.fase).nombre}§7, determinación §6${Math.floor(s.determinacion)}§7, experiencia ${Math.floor(s.experiencia)}`,
    `§7Estado §f${s.estado}§7 · etapa §f${s.etapa}§7 · arma §f${s.arma ?? "-"}§7 · estilo §f${s.estilo ?? "-"}§7 · actitud §f${s.actitud}`,
    `§7Reacción ${pct(n.reaccion)} · precisión ${pct(n.precision)} · movimiento ${pct(n.movimiento)} · combos ${pct(n.combos)} · armas ${pct(n.armas)} · predicción ${pct(n.prediccion)} · adaptación ${pct(n.adaptacion)}`,
    `§7Rivales que recuerda: ${s.memoria.size} · combos en el catálogo: ${COMBOS.length} · últimos: ${s.ultimosCombos.join(", ") || "-"}`,
    `§7Estrategias: ${mejores.slice(0, 8).join(" · ") || "-"}`,
    `§7Bloques temporales: ${cuantosTemporales()} · sellados en este mundo: ${Number(world.getDynamicProperty(PROP_SELLADOS)) || 0}`,
    errs.length ? `§cErrores (${errs.length}): ${errs.slice(-3).map((x) => `${x.txt} ×${x.n}`).join(" | ")}` : "§aSin errores registrados.",
  ].join("\n");
}
